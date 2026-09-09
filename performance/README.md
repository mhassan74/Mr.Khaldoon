# Performance testing

Three tracks, because this app has three fundamentally different
performance profiles: a normal REST backend, an LLM-backed chatbot, and a
media-heavy frontend. See the memory note `feedback-mrkhaldoon-perf-strategy`
for why they're split instead of one generic load test plan.

```
performance/
  README.md          This file
  k6/                 Track 1: API load testing
    *.js                 The 3 test scripts
    reports/             Every run's output lives here: timestamped
                          history + a *-latest.html convenience copy per
                          script (both tracked in git)
  lighthouse/         Track 3: frontend Core Web Vitals
    reports/            <slug>-report-latest.html only — no history kept (see below)
    lighthouserc.js       LHCI config: which URLs, thresholds, throttling
    login-puppeteer.js    Auth hook LHCI runs before each audited URL
    generate-latest-reports.js  Extracts + cleans up after every `npm run perf`
```

1. **API load (k6)** — this file, below.
2. **AI chatbot & quiz-generation latency** — not built yet.
3. **Frontend Core Web Vitals (Lighthouse CI)** — see the section near the
   bottom of this file.

---

# Track 1: API load testing (k6)

k6 load tests for Mr Khaldoon. Three scripts so far, each targeting a
different endpoint. All commands below assume you're running from the
repo root.

## Install k6

Windows: `winget install --id GrafanaLabs.k6`. If just installed, open a
**new** terminal window — an already-open one won't see it on PATH until
you do.

## Scripts

| Script | Target | Session model |
| --- | --- | --- |
| `k6/dashboard-load-test.js` | `GET /api/student/dashboard` | One shared login (`setup()` runs once, every VU reuses it) |
| `k6/classes-page-load-test.js` | `GET /en/classes` | Per-VU login, round-robin across a `TEST_ACCOUNTS` pool |
| `k6/dashboard-load-test-multi-user.js` | `GET /api/student/dashboard` | Per-VU login, round-robin across a `TEST_ACCOUNTS` pool |

---

### `k6/dashboard-load-test.js`

`GET /api/student/dashboard` — the highest-traffic authenticated
endpoint (hit by every student on every session) and the one that
aggregates the most data per request (stats + points breakdown), making
it a useful single target for a first performance check.

**How it works**: `setup()` logs in **once** (real NextAuth flow:
`GET /api/auth/csrf` → `POST /api/auth/callback/credentials`) and shares
that session across every virtual user, so the load is isolated to the
dashboard endpoint itself rather than mixed with repeated login traffic.

```bash
k6 run performance/k6/dashboard-load-test.js -e BASE_URL=https://staging.mrkhaldoon.com -e TEST_USER_EMAIL=student@test.com -e TEST_USER_PASSWORD=your-password -e VUS=5 -e DURATION=15s
```

### `k6/classes-page-load-test.js`

`GET /en/classes` (the "All Subjects" page), spreading load across a
pool of test accounts so virtual users represent real, distinct sessions
rather than one shared login replayed thousands of times. Each VU logs
in once (round-robin-assigned from `TEST_ACCOUNTS`) and reuses that
session for its later iterations.

**First run — verify it works (small, fast, safe):**

```bash
k6 run performance/k6/classes-page-load-test.js -e BASE_URL=https://mrkhaldoon.com -e ALLOW_PROD=true -e TEST_ACCOUNTS="nthabet.patexs@gmail.com:password123,mabdelkawi@patexs.com:password123,ssafwat@patexs.com:password123" -e VUS=3 -e DURATION=6s
```

Already confirmed passing (2026-09-09): `vus_max: 3`, ran exactly 6s,
100% checks passed, p95 ~412ms. **Check `vus_max` and elapsed time in the
output yourself before trusting any future run of this command** — if
they don't match the small numbers you passed, the VUS/DURATION override
isn't working and you're about to run the full ramp instead (see
"Lesson learned" below).

**Full ramp-up run** (0 → 100 → 300 → 600 → 1000 VUs over ~2 minutes,
holds at 1000 for 54s, ramps down over 36s — **total ~3 minutes**):

```bash
k6 run performance/k6/classes-page-load-test.js -e BASE_URL=https://mrkhaldoon.com -e ALLOW_PROD=true -e TEST_ACCOUNTS="nthabet.patexs@gmail.com:password123,mabdelkawi@patexs.com:password123,ssafwat@patexs.com:password123"
```

**This target is production** (`mrkhaldoon.com`) — `ALLOW_PROD=true` is
required and real. A prior run of this exact profile measured **10.83%
request failures and response times degrading to 9–51+ seconds** under
1000 concurrent connections — expect similar this time, and be aware
real users on the app may be affected during the run.

**Known limitation**: 3 accounts shared round-robin across up to 1000
VUs means each account carries roughly 333 concurrent sessions at peak —
a real test of the endpoint's throughput, but not 1000 truly distinct
users. For less session overlap, add more accounts to `TEST_ACCOUNTS`.

### `k6/dashboard-load-test-multi-user.js`

Multi-account variant of `dashboard-load-test.js` — same target
(`GET /api/student/dashboard`), but each VU is assigned one account from
a `TEST_ACCOUNTS` pool (round-robin by VU id) and logs in as that account
on its first iteration, instead of every VU sharing one login. Verified
against the real app (2026-09-08): 6 VUs across the 3 `patexs.com`
accounts, 100% checks passed.

Unlike the other two scripts, this one reads `VUS`/`DURATION` directly
into `options.vus`/`options.duration` rather than baking in a fixed ramp
— there's no hardcoded stages array to accidentally bypass, so passing
`-e VUS`/`-e DURATION` (or a `--stage` CLI flag) works exactly as
expected without the override pattern the other two scripts need.

```bash
k6 run performance/k6/dashboard-load-test-multi-user.js -e BASE_URL=https://mrkhaldoon.com -e ALLOW_PROD=true -e TEST_ACCOUNTS="nthabet.patexs@gmail.com:password123,mabdelkawi@patexs.com:password123,ssafwat@patexs.com:password123" -e VUS=6 -e DURATION=6s
```

For a gradual ramp instead of a flat VU count, use k6's `--stage` flag
(overrides `options.vus`/`duration` entirely):

```bash
k6 run performance/k6/dashboard-load-test-multi-user.js -e BASE_URL=https://mrkhaldoon.com -e ALLOW_PROD=true -e TEST_ACCOUNTS="nthabet.patexs@gmail.com:password123,mabdelkawi@patexs.com:password123,ssafwat@patexs.com:password123" --stage 30s:50,1m:150,1m:300,30s:0
```

---

## Safety guard

Both scripts refuse to run against `mrkhaldoon.com` (production) unless
you explicitly pass `-e ALLOW_PROD=true`. Point `BASE_URL` at a staging
environment when one exists — this app has real students and real data.

## Reports

Every run writes a uniquely timestamped HTML report into `k6/reports/`,
plus a `-latest.html` convenience copy in that same folder (overwritten
each run — hard-refresh with Ctrl+F5 if viewing it in an already-open
browser tab, since an IDE's "reload on save" preview doesn't react to
files an external process like k6 rewrites).

## Thresholds

Starter values in both scripts — tune once you have a real baseline:
- `http_req_failed` rate < 1%
- p95 response time < 800ms

## Lesson learned: VUS/DURATION overrides are not automatic

A script's `options.stages` (or `options.vus`/`duration`) is whatever is
hardcoded in the file unless the script explicitly checks
`__ENV.VUS`/`__ENV.DURATION` and branches on them. Passing `-e VUS=3` to
a script that never reads that variable does **nothing** — k6 silently
ignores it. This actually happened once: a command intended as a small
3-VU/6-second check instead ran the full 1000-VU ramp against production
for 3.5 minutes, because the script's stages were hardcoded with no
override path. Both scripts here now include the override correctly —
verify it by checking `vus_max` and elapsed time in a verification run's
own output before trusting the result.

---

# Track 3: Frontend Core Web Vitals (Lighthouse CI)

`npm run perf` (from the repo root) runs Lighthouse CI against the URLs
listed in `collect.url` in `lighthouse/lighthouserc.js` (currently the
dashboard, a course page, and `/en/practice`), mobile-throttled, 3 runs
each per URL — Lighthouse scores are noisy, so the assertions look at all
3 runs, not a single one.

**Setup**: `lighthouse/login-puppeteer.js` logs in once per audited URL
using the same login form as the Playwright tests
(`#email`/`#password`/submit button). LHCI reuses one browser (and its
cookies) across every URL it audits and re-runs this script before each
one — on the 2nd+ URL the session is already authenticated, so
`/en/login` redirects straight to the dashboard and `#email` never
renders. The script checks `page.url()` after navigating and skips the
form fill when that happens, instead of timing out waiting for a field
that will never appear.

**Reports**: `lighthouse/reports/<slug>-report-latest.html` — one fixed
filename per URL (e.g. `dashboard-report-latest.html`), same idea as the
k6 `-latest.html` files above, tracked in git. Unlike the k6 track,
**no timestamped history is kept** — `generate-latest-reports.js`
(chained onto `npm run perf`) reads `manifest.json` to find each URL's
representative (median) run, writes it to the fixed filename, then
**deletes every raw timestamped `.report.html`/`.report.json` and
`manifest.json`**. LHCI itself never prunes those on its own and they'd
otherwise accumulate several files per URL on every single run, so
nothing but the `-latest.html` files remains on disk between runs.

Adding more URLs to `collect.url` in `lighthouserc.js`? Each gets its own
`<slug>-report-latest.html` automatically, derived from the URL path (e.g.
`/en/practice` → `practice-report-latest.html`) — no other config needed.

**Results so far, confirmed against production (reproduced across four
separate runs on 2026-09-09, dashboard + course page every time, plus
`/en/practice` from the run that added it):**
- Performance score: 0.30–0.75 across runs (target was ≥0.8) — noisy, but
  never once met the target on any of the 3 URLs
- Largest Contentful Paint: 6.2–9.3s on mobile-simulated throttling
  (target was ≤2.5s) — consistently ~3x over budget on every page tested
- Total Blocking Time occasionally spiked to 300–790ms against a 300ms
  target; CLS stayed within budget every run

Thresholds in `lighthouserc.js` are currently `warn`, not `error`, since
that first run is the only baseline that exists so far. Once you've run
this a few more times (ideally against staging, and ideally investigating
*why* LCP is 3x over budget first — image/video sizing on the dashboard's
subject cards is a likely suspect), tighten the assertions to `error` with
realistic targets so `npm run perf` can fail a CI job, not just report.

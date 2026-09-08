# Mr Khaldoon — Playwright automation

## Folder structure

```
playwright.config.ts   Multi-browser (chromium/firefox/webkit), storageState-based auth, trace/video/screenshot on failure
fixtures/base.ts        Custom test/expect that blocks GA + Microsoft Clarity network calls
tsconfig.json           Strict TypeScript
.env / .env.example      BASE_URL + test account credentials (never commit .env)
tests/
  auth.setup.ts          Logs in once via the real login form, saves storage state (Playwright's "setup project" pattern)
  login.spec.ts          TC: logged-in user reaches the dashboard with nav visible
  start-learning.spec.ts TC: full flow to start a lesson and begin a chat with the tutor
pages/
  LoginPage.ts             #email/#password + "Log In" button
  DashboardPage.ts          Nav links + subject-card navigation
  StudyFlowPage.ts          Lesson -> Start -> Section -> "Start Learning" -> "Start with <tutor>"
data/
  test-data.ts              Non-secret fixtures: real subject/lesson names
```

## First run

1. `npm install`
2. `npx playwright install --with-deps`
3. `.env` is already filled in with the QA test account (`student@test.com`)
   — double-check it before running in case the password changes.
4. `npm test` (or `npm run test:ui` to watch it run)

## Test cases

- **login.spec.ts** — student logs in with credentials, lands on the
  dashboard, top nav (Home/Subject/Ask Khaldoon/Practice Quiz) is visible.
- **start-learning.spec.ts** — full flow confirmed live (2026-09-08):
  Dashboard → open a Subject card → expand a lesson card → "Start" →
  section page → "Start Learning" (reveals the split chat+video interface)
  → "Start with `<tutor name>`" (dynamic, e.g. "الأستاذ بليغ") → chat
  interface is active. Stops at confirming the chat surface loaded (input
  box + "End" button visible) — it does **not** assert on any AI-generated
  message text, since tutor responses are non-deterministic. Content
  accuracy (does the tutor's answer match the source material) is a
  separate concern for a future chat-accuracy/chat-consistency suite, not
  this flow test.

## What's confirmed real (inspected live, not guessed)

- Login form: `#email`, `#password`, "Log In" button (no data-testid
  anywhere in the app, no CAPTCHA). A "Continue with Google" button also
  exists on the form — deliberately not automated.
- NextAuth.js session (httpOnly cookie + `/api/auth/session`), Next.js App
  Router — no `networkidle`/fixed-timeout waits used.
- Each lesson card under "Course Content" is itself a toggle `<button>`
  (number + title + description) that expands to reveal "Interactive
  Slides" / "Lesson Summary" / "Start".
- Clicking a lesson's "Start" lands on the section view via a `?section=`
  query param (not a `/section/` path segment, despite the same id
  appearing in both forms in different parts of the UI).
- GA + Microsoft Clarity trackers present on every page — blocked in
  `fixtures/base.ts`.

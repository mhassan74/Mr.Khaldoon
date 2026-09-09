import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

/**
 * Focused single-endpoint load test: GET /api/student/dashboard.
 * Logs in ONCE in setup() and shares that session across every VU, so the
 * load is isolated to the dashboard endpoint itself rather than mixed
 * with repeated login traffic.
 *
 * SAFETY: refuses to run against mrkhaldoon.com production unless
 * ALLOW_PROD=true is explicitly set.
 */

const BASE_URL = __ENV.BASE_URL || 'https://staging.mrkhaldoon.com';
const ALLOW_PROD = (__ENV.ALLOW_PROD || 'false').toLowerCase() === 'true';

// k6's JS runtime has no global URL/URLSearchParams, so match the host
// straight off the string instead of parsing it.
if (/^https?:\/\/([^/]*\.)?mrkhaldoon\.com(\/|$)/.test(BASE_URL) && !ALLOW_PROD) {
  fail(
    `Refusing to run against ${BASE_URL} — this looks like production. ` +
      `Point BASE_URL at staging, or set ALLOW_PROD=true if you really mean it.`
  );
}

const EMAIL = __ENV.TEST_USER_EMAIL;
const PASSWORD = __ENV.TEST_USER_PASSWORD;

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '15s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

// Runs once, regardless of VU count — this is what keeps the load isolated
// to /api/student/dashboard instead of every VU also hitting login.
export function setup() {
  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`);
  const csrfToken = csrfRes.json('csrfToken');
  const cookiesFromCsrf = csrfRes.cookies;

  const loginRes = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    {
      email: EMAIL,
      password: PASSWORD,
      redirect: 'false',
      csrfToken,
      callbackUrl: `${BASE_URL}/en/login`,
      json: 'true',
    },
    { cookies: cookiesFromCsrf }
  );

  if (loginRes.status !== 200) {
    fail(`setup login failed: ${loginRes.status} ${loginRes.body}`);
  }

  // Build a single "name=value; name2=value2" header from every Set-Cookie
  // this exchange produced (csrf cookie + session cookie), since the
  // http.get "headers" option below wants a plain string.
  const allCookies = { ...csrfRes.cookies, ...loginRes.cookies };
  const cookieHeader = Object.entries(allCookies)
    .map(([name, jar]) => `${name}=${jar[0].value}`)
    .join('; ');

  return { cookieHeader };
}

export default function (data) {
  const res = http.get(`${BASE_URL}/api/student/dashboard`, {
    headers: { Cookie: data.cookieHeader },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has body': (r) => r.body && r.body.length > 0,
  });

  sleep(1);
}

export function handleSummary(data) {
  // A fixed filename risks a stale browser/editor preview cache (the
  // JetBrains "reload on save" preview only reacts to saves made inside
  // the IDE, not files an external process like k6 overwrites) — write a
  // uniquely timestamped report every run so there's never any doubt
  // you're looking at the latest result, plus a "latest" copy for
  // convenience (still fine to bookmark, just hard-refresh it).
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const report = htmlReport(data);
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [`performance/k6/reports/dashboard-load-report-${stamp}.html`]: report,
    'performance/k6/dashboard-load-report-latest.html': report,
  };
}

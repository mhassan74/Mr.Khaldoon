import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

/**
 * Multi-user variant of dashboard-load-test.js — a separate file so the
 * original stays untouched. Each VU is assigned one account from a pool
 * (round-robin by VU id), logs in ONCE as that account on its first
 * iteration, then reuses that real session for every later iteration.
 * One k6 process, one HTML report, but every VU authenticates as a
 * genuinely distinct student instead of sharing a single session.
 *
 * SAFETY: refuses to run against mrkhaldoon.com production unless
 * ALLOW_PROD=true is explicitly set.
 */

const BASE_URL = __ENV.BASE_URL || 'https://staging.mrkhaldoon.com';
const ALLOW_PROD = (__ENV.ALLOW_PROD || 'false').toLowerCase() === 'true';

if (/^https?:\/\/([^/]*\.)?mrkhaldoon\.com(\/|$)/.test(BASE_URL) && !ALLOW_PROD) {
  fail(
    `Refusing to run against ${BASE_URL} — this looks like production. ` +
      `Point BASE_URL at staging, or set ALLOW_PROD=true if you really mean it.`
  );
}

// TEST_ACCOUNTS="email1:pw1,email2:pw2,email3:pw3"
const ACCOUNTS = (__ENV.TEST_ACCOUNTS || '')
  .split(',')
  .map((pair) => pair.trim())
  .filter(Boolean)
  .map((pair) => {
    const [email, password] = pair.split(':');
    return { email, password };
  });

if (ACCOUNTS.length === 0) {
  fail(
    'TEST_ACCOUNTS is required, e.g. -e TEST_ACCOUNTS="a@x.com:pw1,b@x.com:pw2,c@x.com:pw3"'
  );
}

export const options = {
  vus: Number(__ENV.VUS || ACCOUNTS.length),
  duration: __ENV.DURATION || '15s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

function login(email, password) {
  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`);
  const csrfToken = csrfRes.json('csrfToken');

  const loginRes = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    {
      email,
      password,
      redirect: 'false',
      csrfToken,
      callbackUrl: `${BASE_URL}/en/login`,
      json: 'true',
    },
    { cookies: csrfRes.cookies }
  );

  if (loginRes.status !== 200) {
    fail(`login failed for ${email}: ${loginRes.status} ${loginRes.body}`);
  }

  const allCookies = { ...csrfRes.cookies, ...loginRes.cookies };
  return Object.entries(allCookies)
    .map(([name, jar]) => `${name}=${jar[0].value}`)
    .join('; ');
}

// Per-VU session cache, keyed by k6's __VU id — each VU logs in once (on
// its first iteration) as its round-robin-assigned account, then reuses
// that cookie on every later iteration instead of re-authenticating.
const vuSessions = {};

export default function () {
  const vuId = __VU;
  if (!vuSessions[vuId]) {
    const account = ACCOUNTS[(vuId - 1) % ACCOUNTS.length];
    vuSessions[vuId] = { account, cookieHeader: login(account.email, account.password) };
  }
  const { account, cookieHeader } = vuSessions[vuId];

  const res = http.get(`${BASE_URL}/api/student/dashboard`, {
    headers: { Cookie: cookieHeader },
    tags: { account: account.email },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has body': (r) => r.body && r.body.length > 0,
  });

  sleep(1);
}

export function handleSummary(data) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const report = htmlReport(data);
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [`performance/k6/reports/dashboard-load-report-multiuser-${stamp}.html`]: report,
    'performance/k6/dashboard-load-report-multiuser-latest.html': report,
  };
}

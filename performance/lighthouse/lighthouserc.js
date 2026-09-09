require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'https://mrkhaldoon.com';

/**
 * Track 3 of the Mr Khaldoon performance strategy (see ../README.md) —
 * frontend Core Web Vitals on the pages students actually feel slowness
 * on: the dashboard (many stat cards + subject images), a course page
 * (video + images), and the practice quiz config page. Track 1 (k6 API
 * load) lives in ../k6/; track 2 (chatbot latency) not built yet.
 *
 * Raw output lands in reports/ temporarily, then generate-latest-reports.js
 * (chained onto `npm run perf`) extracts each URL's representative run to
 * a fixed <slug>-report-latest.html and deletes the rest — LHCI itself
 * writes 6+ heavy HTML/JSON files per run and never prunes old ones, so
 * nothing but the latest files should persist on disk between runs.
 *
 * Thresholds start as 'warn', not 'error' - this app has no established
 * performance baseline yet. Run `npm run perf` once, look at the numbers
 * in the local report, then tighten the assertions below to 'error' with
 * realistic targets instead of guessed ones.
 */
module.exports = {
  ci: {
    collect: {
      url: [
        `${BASE_URL}/en/dashboard`,
        `${BASE_URL}/en/course/cmhswisll000rpj01buejz1q0`,
        `${BASE_URL}/en/practice`,
        `${BASE_URL}/en/ask`,
      ],
      numberOfRuns: 3,
      puppeteerScript: './performance/lighthouse/login-puppeteer.js',
      settings: {
        formFactor: 'mobile',
        throttlingMethod: 'simulate',
        screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 2.625 },
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './performance/lighthouse/reports',
    },
  },
};

require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'https://mrkhaldoon.com';

/**
 * Track 3 of the Mr Khaldoon performance strategy (see README.md) —
 * frontend Core Web Vitals on the pages students actually feel slowness
 * on: the dashboard (many stat cards + subject images) and a course page
 * (video + images). Tracks 1 (k6 API load) and 2 (chatbot latency) live
 * alongside this file in the same performance/ folder.
 *
 * Reports go to reports/lighthouse/ (gitignored, unlike the k6 reports
 * next to it) — LHCI writes 6+ heavy HTML/JSON files per run (~3-4MB
 * total), versus k6's single overwritten HTML file, so committing every
 * run here would bloat the repo fast. Share a specific report manually if
 * a finding needs to be handed off.
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
      ],
      numberOfRuns: 3,
      puppeteerScript: './performance/login-puppeteer.js',
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
      outputDir: './performance/reports/lighthouse',
    },
  },
};

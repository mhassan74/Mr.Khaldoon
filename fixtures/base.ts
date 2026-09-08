import { test as base, expect } from '@playwright/test';

/**
 * Confirmed via playwright-site-preflight against mrkhaldoon.com: Google
 * Analytics (gtag) and Microsoft Clarity are loaded on every page. Blocking
 * them here (not the app's own mrkhaldoon.com requests) cuts network noise
 * and a source of flakiness without touching anything under test.
 */
const BLOCKED_DOMAINS = [
  'googletagmanager.com',
  'google-analytics.com',
  'clarity.ms',
];

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (BLOCKED_DOMAINS.some((domain) => url.includes(domain))) {
        return route.abort();
      }
      return route.continue();
    });
    await use(page);
  },
});

export { expect };

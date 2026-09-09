require('dotenv').config();

/**
 * LHCI runs this once before each URL it audits, in the same browser
 * instance Lighthouse then uses — so logging in here carries the session
 * cookie into the audit. Reuses the exact form confirmed in
 * pages/LoginPage.ts (#email, #password, submit button type="submit").
 * NextAuth's session cookie is httpOnly, which is fine here since
 * Puppeteer drives a real browser, not fetch.
 *
 * @param {import('puppeteer').Browser} browser
 * @param {{url: string}} context
 */
module.exports = async (browser, context) => {
  const page = await browser.newPage();
  await page.goto(`${process.env.BASE_URL}/en/login`, { waitUntil: 'networkidle0' });

  // Confirmed live: LHCI reuses the same browser (and its cookies) across
  // every URL it audits, and this script re-runs before each one. On the
  // second+ URL the session is already authenticated, so /en/login
  // redirects straight to the dashboard and #email never renders — skip
  // the form fill in that case instead of timing out waiting for it.
  if (page.url().includes('/login')) {
    await page.waitForSelector('#email');
    await page.type('#email', process.env.TEST_USER_EMAIL);
    await page.type('#password', process.env.TEST_USER_PASSWORD);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);
  }

  await page.close();
};

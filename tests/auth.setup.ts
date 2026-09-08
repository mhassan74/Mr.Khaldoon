import { test as setup } from '../fixtures/base';
import { LoginPage } from '../pages/LoginPage';
import { STORAGE_STATE } from '../playwright.config';

/**
 * Runs once before every other project (see the `setup` project + its
 * `dependencies` in playwright.config.ts) and saves the authenticated
 * browser state to STORAGE_STATE. Every other project reuses that file,
 * so individual specs never need to log in themselves.
 *
 * Mr Khaldoon also offers a "Continue with Google" button on this form —
 * do not automate that path; this project only exercises the credentials
 * login, which is what the QA test account uses.
 */
setup('authenticate', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!);
  await page.waitForURL(/dashboard/);
  await page.context().storageState({ path: STORAGE_STATE });
});

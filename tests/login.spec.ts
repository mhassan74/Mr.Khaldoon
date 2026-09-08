import { test, expect } from '../fixtures/base';
import { DashboardPage } from '../pages/DashboardPage';

/**
 * Runs already-authenticated (see tests/auth.setup.ts + storageState in
 * playwright.config.ts). Confirmed passing against the real app.
 */
test('logged-in user reaches the dashboard with nav visible', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();

  await expect(page).toHaveURL(/dashboard/);
  await expect(dashboard.homeLink).toBeVisible();
  await expect(dashboard.subjectLink).toBeVisible();
  await expect(dashboard.askKhaldoonLink).toBeVisible();
  await expect(dashboard.practiceQuizLink).toBeVisible();
});

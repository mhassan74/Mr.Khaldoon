import { Page, Locator } from '@playwright/test';

/**
 * Nav links and subject-card navigation, confirmed by inspecting a real
 * authenticated session (2026-09-08). Subject cards are
 * `<a href="/en/course/{id}">` containing the subject name as visible text.
 */
export class DashboardPage {
  readonly page: Page;
  readonly homeLink: Locator;
  readonly subjectLink: Locator;
  readonly askKhaldoonLink: Locator;
  readonly practiceQuizLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.homeLink = page.getByRole('link', { name: 'Home' });
    this.subjectLink = page.getByRole('link', { name: 'Subject' });
    this.askKhaldoonLink = page.getByRole('link', { name: 'Ask Khaldoon' }).first();
    this.practiceQuizLink = page.getByRole('link', { name: 'Practice Quiz' }).first();
  }

  async goto() {
    await this.page.goto('/en/dashboard');
    await this.page.getByText('Classes completed', { exact: true }).waitFor({ state: 'visible' });
  }

  /** Clicks a subject card by its visible name (e.g. "Arabic", "Social Studies") and waits for the course page. */
  async openSubject(subjectName: string) {
    await this.page
      .locator('a[href^="/en/course/"]')
      .filter({ hasText: subjectName })
      .first()
      .click();
    await this.page.waitForURL(/\/course\//);
  }
}

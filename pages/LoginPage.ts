import { Page, Locator } from '@playwright/test';

/**
 * Confirmed via preflight: mrkhaldoon.com has zero data-testid coverage.
 * The login form's #email/#password ids are plain and stable, so this page
 * object uses them directly instead of a testid that doesn't exist. The
 * submit button is matched by its accessible name ("Log In"). A "Continue
 * with Google" button also exists on this form — deliberately not modeled
 * here, since automation only drives the credentials path.
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.getByRole('button', { name: 'Log In' });
  }

  async goto() {
    await this.page.goto('/en/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

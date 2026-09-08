import { Page, Locator } from '@playwright/test';

/**
 * Covers the full "start learning" flow, confirmed by walking through it
 * live (2026-09-08): course page -> expand/open a lesson card -> "Start"
 * -> section page (/en/course/{id}/section/{id}) -> "Start Learning"
 * reveals the split chat+video interface -> "Start with <tutor name>"
 * begins the AI tutor chat.
 *
 * Each lesson card in "Course Content" is itself a toggle button (number +
 * title + description all inside one <button>) that expands to reveal
 * "Interactive Slides" / "Lesson Summary" / "Start". The tutor's name is
 * dynamic (seen live as "الأستاذ بليغ"), so the chat-start button is
 * matched by its "Start with " prefix rather than a hardcoded name.
 */
export class StudyFlowPage {
  readonly page: Page;
  readonly startLearningButton: Locator;
  readonly startChatButton: Locator;
  readonly chatInput: Locator;
  readonly endSessionButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.startLearningButton = page.getByRole('button', { name: 'Start Learning', exact: true });
    this.startChatButton = page.getByRole('button', { name: /^Start with/ });
    this.chatInput = page.getByPlaceholder(/ask anything/i);
    this.endSessionButton = page.getByRole('button', { name: 'End', exact: true });
  }

  /** Expands the lesson card by name (if not already) and clicks its "Start" button. */
  async startLesson(lessonName: string) {
    await this.page.getByRole('button', { name: lessonName }).first().click();
    await this.page.getByRole('button', { name: 'Start', exact: true }).first().click();
    // Confirmed live: this lands on ?section=<id> (query param), not a
    // /section/<id> path segment, despite the same id appearing either way.
    await this.page.waitForURL(/section/);
  }

  async startLearning() {
    await this.startLearningButton.click();
  }

  async startChatWithTutor() {
    await this.startChatButton.click();
  }
}

import { test, expect } from '../fixtures/base';
import { DashboardPage } from '../pages/DashboardPage';
import { StudyFlowPage } from '../pages/StudyFlowPage';
import { testData } from '../data/test-data';

/**
 * Full "start learning" flow: Dashboard -> Subject -> Lesson -> Start ->
 * Section -> "Start Learning" -> "Start with <tutor>" -> chat interface
 * is active. Stops at confirming the chat surface is up (input box + End
 * button visible) rather than asserting on any AI-generated message text,
 * since tutor responses are non-deterministic — content-accuracy checks
 * belong in a separate chat-accuracy/chat-consistency suite, not here.
 */
test('student can start a lesson and begin a chat with the tutor', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  const study = new StudyFlowPage(page);

  await dashboard.goto();
  await dashboard.openSubject(testData.startLearning.subjectName);
  await study.startLesson(testData.startLearning.lessonName);
  await study.startLearning();
  await study.startChatWithTutor();

  await expect(study.chatInput).toBeVisible();
  await expect(study.endSessionButton).toBeVisible();
});

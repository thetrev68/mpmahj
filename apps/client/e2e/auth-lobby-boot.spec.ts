import { test } from '@playwright/test';
import { expectLobbyConnected, expectNoLoadingDeadlock } from './support/assertions';
import { gotoLobby } from './support/fixtures';

test.describe('Phase 1 - Auth + Lobby Boot Stability', () => {
  test('lobby reaches stable connected state on initial boot', async ({ page }) => {
    await gotoLobby(page);
    await expectLobbyConnected(page);
    await expectNoLoadingDeadlock(page);
  });

  test('lobby remains stable across repeated refreshes', async ({ page }) => {
    await gotoLobby(page);

    for (let i = 0; i < 3; i += 1) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expectLobbyConnected(page);
      await expectNoLoadingDeadlock(page);
    }
  });
});

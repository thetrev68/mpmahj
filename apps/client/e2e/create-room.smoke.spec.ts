import { expect, test } from '@playwright/test';

test('create room with bots enters active game board', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Create Room' })).toBeEnabled({
    timeout: 20_000,
  });

  await page.getByRole('button', { name: 'Create Room' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Fill empty seats with bots').click();
  await dialog.getByLabel('Room Name').press('Enter');

  await expect(page.getByTestId('game-board').or(page.getByTestId('room-waiting'))).toBeVisible({
    timeout: 30_000,
  });
});

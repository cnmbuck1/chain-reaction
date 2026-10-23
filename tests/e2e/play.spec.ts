import { expect, test, type Page } from '@playwright/test';

const board = (page: Page) => page.locator('.board[data-ready="true"]');
const run = (page: Page) => page.getByRole('button', { name: 'Run', exact: true });
const status = (page: Page) => page.getByRole('status');

async function dismissIntro(page: Page) {
  await expect(page.getByRole('dialog', { name: 'Get the ball to the goal' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
}

async function solve(page: Page, switches: string[]) {
  await expect(board(page)).toBeVisible();
  for (const name of switches)
    await page.getByRole('button', { name: new RegExp(`^Switch ${name},`) }).click();
  await run(page).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a new player opens on level 1 and can play all three levels', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'First Spark' })).toBeVisible();
    await dismissIntro(page);
    await solve(page, ['A']);
    await page.getByRole('button', { name: 'Next level' }).click();
    await expect(page.getByRole('heading', { name: 'Reverse Logic' })).toBeVisible();
    await solve(page, ['A']);
    await page.getByRole('button', { name: 'Next level' }).click();
    await expect(page.getByRole('heading', { name: 'Double Duty' })).toBeVisible();
    await solve(page, ['A', 'B']);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('3 of 3 solved')).toBeVisible();
  });

  test('a failed run explains where the ball stopped and keeps switch positions', async ({
    page,
  }) => {
    await page.goto('/');
    await dismissIntro(page);
    await expect(board(page)).toBeVisible();
    await run(page).click();
    await expect(status(page)).toHaveText('Stopped at Gate 1: it needs power but got no power.');
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(page.getByText('The gate opens only when power reaches it.')).toBeVisible();
    await page.getByRole('button', { name: /^Switch A,/ }).click();
    await run(page).click();
    await expect(page.getByRole('dialog')).toContainText('Solved in 2 runs.');
  });

  test('progress survives a reload', async ({ page }) => {
    await page.goto('/');
    await dismissIntro(page);
    await solve(page, ['A']);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Reverse Logic' })).toBeVisible();
    await page.getByRole('button', { name: '‹ Levels' }).click();
    await expect(page.getByText('1 of 3 solved')).toBeVisible();
    await page.getByRole('button', { name: 'Level 1, First Spark, solved' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '‹ Levels' }).click();
    await expect(page.getByRole('button', { name: 'Level 1, First Spark, solved' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Level 3, Double Duty, locked' })).toBeDisabled();
  });

  test('the change budget, undo and reset stay in step', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem(
        'chain-reaction/progress',
        JSON.stringify({
          version: 1,
          completed: { 'level-01': { bestAttempts: 1 }, 'level-02': { bestAttempts: 1 } },
        }),
      ),
    );
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Double Duty' })).toBeVisible();
    const meter = page.locator('.meter-count');
    await page.getByRole('button', { name: /^Switch A,/ }).click();
    await page.getByRole('button', { name: /^Switch B,/ }).click();
    await expect(meter).toHaveText('2/2');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(meter).toHaveText('1/2');
    await expect(page.getByRole('button', { name: /^Switch B, on/ })).toBeVisible();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(meter).toHaveText('0/2');
    await expect(page.getByRole('button', { name: /^Switch A, off/ })).toBeVisible();
  });
});

test('the full animation plays and ends on the success card', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await dismissIntro(page);
  await expect(board(page)).toBeVisible();
  await page.getByRole('button', { name: /^Switch A,/ }).click();
  await run(page).click();
  await expect(status(page)).toHaveText('Running…');
  await expect(page.getByRole('button', { name: /^Switch A,/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
  expect(errors).toEqual([]);
});

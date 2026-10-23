import { expect, test, type Page } from '@playwright/test';

const board = (page: Page) => page.locator('.board[data-ready="true"]');
const run = (page: Page) => page.getByRole('button', { name: 'Run', exact: true });
const status = (page: Page) => page.getByRole('status');

async function dismissIntro(page: Page) {
  await expect(page.getByRole('dialog', { name: 'Get the ball to the goal' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
}

/** One shortest solution per level, by switch label (the solver's, checked in unit tests). */
const SOLUTIONS = [
  { name: 'First Spark', switches: ['A'] },
  { name: 'Reverse Logic', switches: ['A'] },
  { name: 'Double Duty', switches: ['A', 'B'] },
  { name: 'The Tradeoff', switches: ['A', 'B'] },
  { name: 'Two Conditions', switches: ['A', 'B', 'C'] },
  { name: 'False Friend', switches: ['B', 'C'] },
  { name: 'Minimal Moves', switches: ['A', 'D'] },
  { name: 'Split Signal', switches: ['A', 'B', 'D'] },
  { name: 'Interlock', switches: ['A', 'B', 'D'] },
  { name: 'Master Circuit', switches: ['A', 'B', 'C', 'D'] },
];

async function solve(page: Page, switches: string[]) {
  await expect(board(page)).toBeVisible();
  for (const name of switches)
    await page.getByRole('button', { name: new RegExp(`^Switch ${name},`) }).click();
  await run(page).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a new player opens on level 1 and can play all ten levels', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'First Spark' })).toBeVisible();
    await dismissIntro(page);
    for (const [i, { name, switches }] of SOLUTIONS.entries()) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      await solve(page, switches);
      if (i < SOLUTIONS.length - 1) await page.getByRole('button', { name: 'Next level' }).click();
    }
    await expect(page.getByRole('dialog')).toContainText('Every machine solved. 10 of 10 on the');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('10 of 10 solved')).toBeVisible();
  });

  test('a failed run explains where the ball stopped and keeps switch positions', async ({
    page,
  }) => {
    await page.goto('/');
    await dismissIntro(page);
    await expect(board(page)).toBeVisible();
    await run(page).click();
    await expect(status(page)).toHaveText('Stopped at Gate 1: it needs power but got no power.');
    await page.getByRole('button', { name: /^Hint, free/ }).click();
    await page.getByRole('button', { name: 'Make a free move' }).click();
    await expect(page.locator('.switch.is-hinted')).toHaveAttribute('aria-label', /^Switch A,/);
    await expect(page.getByLabel('Changes used 0 of 1')).toBeVisible();
    await run(page).click();
    await expect(page.getByRole('dialog')).toContainText('Solved in 2 runs.');
  });

  test('progress survives a reload', async ({ page }) => {
    await page.goto('/');
    await dismissIntro(page);
    await solve(page, ['A']);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Reverse Logic' })).toBeVisible();
    await page.getByRole('button', { name: 'Levels', exact: true }).click();
    await expect(page.getByText('1 of 10 solved')).toBeVisible();
    await page.getByRole('button', { name: 'Level 1, First Spark, solved' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Levels', exact: true }).click();
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

test('settings persist, and resetting progress asks first', async ({ page }) => {
  await page.goto('/');
  await dismissIntro(page);
  await solve(page, ['A']);
  await page.getByRole('dialog').getByRole('button', { name: 'Levels' }).click();
  await expect(page.getByText('1 of 10 solved')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();

  await page.getByRole('switch', { name: 'Sound' }).click();
  await expect(page.getByRole('switch', { name: 'Sound' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await page.getByRole('radio', { name: 'Reduce' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('switch', { name: 'Sound' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await expect(page.getByRole('radio', { name: 'Reduce' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Reset' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByText('Progress cleared.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '‹ Levels' }).click();
  await expect(page.getByText('0 of 10 solved')).toBeVisible();
});

test('the sound button mutes from the game screen', async ({ page }) => {
  await page.goto('/');
  await dismissIntro(page);
  const button = page.getByRole('button', { name: /^Sound / });
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await button.click();
  await expect(page.getByRole('button', { name: 'Sound off' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sound off' })).toBeVisible();
});

test('the game fits a small phone without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await dismissIntro(page);
  await expect(board(page)).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(run(page)).toBeInViewport();
});

test('hints: two free moves, then the demo shop, and they last across reloads', async ({
  page,
}) => {
  const completed = Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`level-0${n}`, { bestAttempts: 1 }]),
  );
  await page.goto('/');
  await page.evaluate(
    (done) =>
      localStorage.setItem(
        'chain-reaction/progress',
        JSON.stringify({ version: 1, completed: done, seenIntro: true }),
      ),
    completed,
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Master Circuit' })).toBeVisible();
  await expect(board(page)).toBeVisible();
  const hinted = page.locator('.switch.is-hinted');

  await page.getByRole('button', { name: 'Hint, 2 left' }).click();
  await page.getByRole('button', { name: 'Use 1 hint' }).click();
  await expect(hinted).toHaveCount(1);
  await expect(hinted).toHaveAttribute('aria-label', /^Switch D,.*set by a hint/);
  await expect(page.getByLabel('Changes used 0 of 4')).toBeVisible();
  await hinted.click({ force: true });
  await expect(hinted).toHaveCount(1);

  await page.getByRole('button', { name: 'Hint, 1 left' }).click();
  await page.getByRole('button', { name: 'Use 1 hint' }).click();
  await expect(hinted).toHaveCount(2);

  await page.getByRole('button', { name: 'Hint, 0 left' }).click();
  await page.getByRole('button', { name: 'Get more hints' }).click();
  await expect(page.getByText(/^Demo: nothing is shown or charged/)).toBeVisible();
  await page.getByRole('button', { name: /Watch a short ad/ }).click();
  await expect(page.getByText('1 hint added.')).toBeVisible();
  await page.getByRole('button', { name: 'Use 1 hint' }).click();
  await expect(hinted).toHaveCount(3);

  await page.getByRole('button', { name: 'Hint, 0 left' }).click();
  await expect(page.getByText('The last step is yours.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Hint, 0 left' })).toBeVisible();
  await expect(hinted).toHaveCount(3);
  await expect(page.getByLabel('Changes used 0 of 4')).toBeVisible();
});

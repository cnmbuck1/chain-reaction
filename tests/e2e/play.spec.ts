import { expect, test, type Page } from '@playwright/test';
import { dailyFor } from '../../src/daily/schedule';
import { indexLevel, switchStage } from '../../src/engine/graph';
import { turnsFor } from '../../src/engine/reducer';
import { solve as solveLevel } from '../../src/engine/solver';

const board = (page: Page) => page.locator('.board[data-ready="true"]');
/** Run, which reads Retry after a miss. */
const run = (page: Page) => page.getByRole('button', { name: /^(Run|Retry)$/ });
const status = (page: Page) => page.getByRole('status');

async function dismissIntro(page: Page) {
  await expect(page.getByRole('dialog', { name: 'Get the ball to the goal' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
}

/** In a solution: run to the checkpoint, so the next part opens. */
const PART = '|';

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
  { name: 'Fork in the Road', switches: ['F'] },
  { name: 'Dead Lane', switches: ['A', 'F'] },
  { name: 'Long Way Round', switches: ['A', 'F'] },
  { name: 'Switchyard', switches: ['C', 'F'] },
  { name: 'Grand Junction', switches: ['F', 'B', 'C'] },
  { name: 'Two Parts', switches: ['A', PART, 'E'] },
  { name: 'Second Wind', switches: ['B', 'C', PART, 'E', 'F'] },
  { name: 'Carry Over', switches: ['B', PART, 'D'] },
  { name: 'Relay Race', switches: ['A', 'C', PART, 'D', 'E'] },
  { name: 'Grand Finale', switches: ['B', 'C', PART, 'D', 'E'] },
  { name: 'Crossroads', switches: ['F', PART, 'D'] },
  { name: 'Detour', switches: ['F', PART, 'E'] },
  { name: 'Stay the Course', switches: ['B', PART, 'D', 'E'] },
  { name: 'Through Traffic', switches: ['A', 'F', PART, 'D'] },
  { name: 'Crossover', switches: ['B', 'C', 'F', PART, 'D'] },
  { name: 'Branch Line', switches: ['A', 'B', PART, 'H'] },
  { name: 'Signal Box', switches: ['A', PART, 'D', 'G'] },
  { name: 'Junction Box', switches: ['B', 'C', PART, 'H'] },
  { name: 'Double Junction', switches: ['A', 'F', PART, 'D'] },
  { name: 'Grand Central', switches: ['A', 'B', 'F', PART, 'H'] },
  { name: 'Inverter', switches: ['A', 'C'] },
  { name: 'Opposite Day', switches: ['B', 'D'] },
  { name: 'Contrary Fork', switches: ['A', 'B'] },
  { name: 'Upside Down', switches: ['A', 'C'] },
  { name: 'Double Negative', switches: ['C', 'D', 'E'] },
  { name: 'Mirror Stage', switches: ['C', 'D', PART, 'E'] },
  { name: 'Dark Crossing', switches: ['C', 'D', PART, 'E', 'G'] },
  { name: 'Long Haul', switches: ['B', 'C', 'D', PART, 'E'] },
  { name: 'Backwire', switches: ['C', 'D', PART, 'F'] },
  { name: 'Grand Inversion', switches: ['A', 'B', PART, 'F', 'G'] },
  { name: 'Meshed', switches: ['B', 'C'] },
  { name: 'Gear Train', switches: ['B', 'C'] },
  { name: 'Chain Drive', switches: ['A', 'C', 'D'] },
  { name: 'Clockwork', switches: ['A', 'B', 'D'] },
  { name: 'Escapement', switches: ['B', 'D', 'E', 'F'] },
  { name: 'Skeleton Key', switches: ['B', 'F'] },
  { name: 'Key Ring', switches: ['A', 'B', PART, 'D'] },
  { name: 'Lockstep', switches: ['B', 'F', PART, 'D'] },
  { name: 'Turnkey', switches: ['C', 'F', PART, 'D', 'G'] },
  { name: 'Master Key', switches: ['A', 'B', 'F', PART, 'D'] },
  { name: 'Trip Plate', switches: ['B', 'C'] },
  { name: 'Tripwire', switches: ['A', 'D'] },
  { name: 'Pressure Point', switches: ['A', 'B', 'D'] },
  { name: 'Switchback', switches: ['C', 'F'] },
  { name: 'Double Trip', switches: ['A', 'B', 'D'] },
  { name: 'Two Keys', switches: ['B', 'F', PART, 'D', 'I'] },
  { name: 'Gold and Silver', switches: ['A', 'F', PART, 'D', 'E'] },
  { name: 'Key Chain', switches: ['C', 'F', PART, 'E', 'H'] },
  { name: 'Locksmith', switches: ['A', 'C', 'F', PART, 'E', 'H'] },
  { name: 'Keymaster', switches: ['C', 'F', PART, 'E', 'H', 'I'] },
];

async function solve(page: Page, switches: string[]) {
  await expect(board(page)).toBeVisible();
  for (const name of switches) {
    if (name === PART) {
      await run(page).click();
      await expect(status(page)).toContainText('cleared');
    } else await page.getByRole('button', { name: new RegExp(`^Switch ${name},`) }).click();
  }
  await run(page).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a new player opens on level 1 and can play every level', async ({ page }) => {
    test.setTimeout(SOLUTIONS.length * 9_000);
    await page.goto('/');
    // Ads between levels have their own test; here they would only slow the run down.
    await page.evaluate(() =>
      localStorage.setItem(
        'chain-reaction/ads',
        JSON.stringify({ version: 1, adFree: true, solves: 0, lastAt: 0 }),
      ),
    );
    await page.reload();
    await expect(page.getByRole('heading', { name: 'First Spark' })).toBeVisible();
    await dismissIntro(page);
    for (const [i, { name, switches }] of SOLUTIONS.entries()) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      await solve(page, switches);
      if (i < SOLUTIONS.length - 1)
        await page.getByRole('button', { name: 'Next challenge' }).click();
    }
    await expect(page.getByRole('dialog')).toContainText(
      `Every machine solved. ${SOLUTIONS.length * 3} of ${SOLUTIONS.length * 3} stars.`,
    );
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText(`${SOLUTIONS.length} of ${SOLUTIONS.length} solved`)).toBeVisible();
  });

  test('a failed run explains where the ball stopped and keeps switch positions', async ({
    page,
  }) => {
    await page.goto('/');
    await dismissIntro(page);
    await expect(board(page)).toBeVisible();
    await run(page).click();
    await expect(status(page)).toHaveText('Stopped at Gate 1: it needs power but got no power.');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(page.locator('.gate-tag.is-stopped')).toHaveCount(1);
    await page.getByRole('button', { name: /^Hint, free/ }).click();
    await page.getByRole('button', { name: 'Make a free move' }).click();
    await expect(page.locator('.switch.is-hinted')).toHaveAttribute('aria-label', /^Switch A,/);
    await expect(page.getByLabel('Changes 0, par 1')).toBeVisible();
    await run(page).click();
    const card = page.getByRole('dialog');
    await expect(card).toContainText('Solved in 2 Runs');
    await expect(card).toContainText('1 hint used');
    await expect(card.getByRole('img', { name: '1 of 3 stars' })).toBeVisible();
    // A replay of a solved level starts clean, without the hint's move.
    await card.getByRole('button', { name: 'Replay' }).click();
    await expect(page.locator('.switch.is-hinted')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Switch A, off/ })).toBeVisible();
  });

  test('a first-Run solve earns 3 stars; Close shows the machine and Replay starts fresh', async ({
    page,
  }) => {
    await page.goto('/');
    await dismissIntro(page);
    await solve(page, ['A']);
    const card = page.getByRole('dialog');
    await expect(card.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
    await expect(card).toContainText('First Run');
    await expect(card.getByRole('button', { name: 'Next challenge' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    await page.getByRole('button', { name: 'Result' }).click();
    await card.getByRole('button', { name: 'Replay' }).click();
    await expect(card).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'First Spark' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Switch A, off/ })).toBeVisible();
    await expect(run(page)).toHaveText('Run');
  });

  test('a missed first Run stays spent after leaving the level, so the solve earns 2 stars', async ({
    page,
  }) => {
    await page.goto('/');
    await dismissIntro(page);
    await solve(page, ['A']);
    await page.getByRole('button', { name: 'Next challenge' }).click();
    await expect(page.getByRole('heading', { name: 'Reverse Logic' })).toBeVisible();
    await expect(board(page)).toBeVisible();
    await run(page).click();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await page.getByRole('button', { name: 'Levels', exact: true }).click();
    await page.reload();
    // The app reopens on the first unsolved level, with the first Run still spent.
    await expect(page.getByRole('heading', { name: 'Reverse Logic' })).toBeVisible();
    await solve(page, ['A']);
    const card = page.getByRole('dialog');
    await expect(card.getByRole('img', { name: '2 of 3 stars' })).toBeVisible();
    await expect(card).toContainText('Not your first Run');
    await card.getByRole('button', { name: 'Levels' }).click();
    await expect(
      page.getByRole('button', { name: 'Level 2, Reverse Logic, solved, 2 of 3 stars' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Level 1, First Spark, solved, 3 of 3 stars' }),
    ).toBeVisible();
  });

  test('the level select groups chapters, previews the next machine, and Continue plays on', async ({
    page,
  }) => {
    const completed = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        `level-${String(i + 1).padStart(2, '0')}`,
        { stars: i === 1 ? 2 : 3, bestAttempts: 1 },
      ]),
    );
    await page.goto('/');
    await page.evaluate(
      (done) =>
        localStorage.setItem(
          'chain-reaction/progress',
          JSON.stringify({ version: 2, completed: done, firstRunUsed: {}, seenIntro: true }),
        ),
      completed,
    );
    await page.reload();
    await page.getByRole('button', { name: 'Levels', exact: true }).click();
    await expect(page.getByLabel(`29 of ${SOLUTIONS.length * 3} stars`)).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Basics/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Forks/ })).toBeVisible();
    await expect(page.getByText('Coming up: Clear part A')).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Next machine' })).toContainText(
      'Dead Lane',
    );
    await expect(page.getByRole('button', { name: 'Level 12, Dead Lane, locked' })).toBeDisabled();
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expect(page.getByRole('heading', { name: 'Fork in the Road' })).toBeVisible();
  });

  test('the tip sits in the status line until the first switch change', async ({ page }) => {
    await page.goto('/');
    await dismissIntro(page);
    const status = page.locator('p.status');
    await expect(status).toHaveText('Tap switch A to turn it on, then press Run.');
    await page.getByRole('button', { name: /^Switch A,/ }).click();
    await expect(status).not.toHaveText(/Tap switch A/);
  });

  test('progress survives a reload', async ({ page }) => {
    await page.goto('/');
    await dismissIntro(page);
    await solve(page, ['A']);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Reverse Logic' })).toBeVisible();
    await page.getByRole('button', { name: 'Levels', exact: true }).click();
    await expect(page.getByText(`1 of ${SOLUTIONS.length} solved`)).toBeVisible();
    await page.getByRole('button', { name: 'Level 1, First Spark, solved' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Levels', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Level 1, First Spark, solved' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Level 3, Double Duty, locked' })).toBeDisabled();
  });

  test('a two-part board shows one part at a time, and says when part B is out of reach', async ({
    page,
  }) => {
    const done = Object.fromEntries(
      Array.from({ length: 17 }, (_, i) => [
        `level-${String(i + 1).padStart(2, '0')}`,
        { bestAttempts: 1 },
      ]),
    );
    await page.goto('/');
    await page.evaluate(
      (completed) =>
        localStorage.setItem(
          'chain-reaction/progress',
          JSON.stringify({ version: 1, completed, seenIntro: true }),
        ),
      done,
    );
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Carry Over' })).toBeVisible();
    await expect(page.getByText('Level 18 · Part A')).toBeVisible();
    // Each part fills the screen on its own; the other part's switches are out of view.
    await expect(page.getByRole('button', { name: /^Switch D,/ })).toBeHidden();
    await page.getByRole('button', { name: /^Switch A,/ }).click();
    await run(page).click();
    await expect(status(page)).toContainText('Part A cleared.');
    await expect(page.getByText('Level 18 · Part B')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Switch A,/ })).toBeHidden();
    await page.getByRole('button', { name: /^Switch D,/ }).click();
    await run(page).click();
    await expect(status(page)).toContainText("Part A's switches leave no way through here.");
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText('Level 18 · Part A')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Switch A, off/ })).toBeVisible();
  });

  test('changes, undo and reset stay in step, with no limit', async ({ page }) => {
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
    await expect(meter).toHaveText('2 · par 2');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(meter).toHaveText('1 · par 2');
    await expect(page.getByRole('button', { name: /^Switch B, on/ })).toBeVisible();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(meter).toHaveText('0 · par 2');
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
  await expect(status(page)).toHaveText('Running… Tap the board to skip.');
  await expect(page.getByRole('button', { name: /^Switch A,/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('a trip plate flips its switch mid-run, and the switch springs back after', async ({
  page,
}) => {
  await page.goto('/');
  await dismissIntro(page);
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('switch', { name: 'Unlock all levels' }).click();
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  await page.getByRole('button', { name: /^Level 51, Trip Plate$/ }).click();
  await expect(status(page)).toContainText('New: trip plates');
  await page.getByRole('button', { name: /^Switch B,/ }).click();
  await run(page).click();
  // D flips on as the ball rolls over the plate, so the gate after it opens.
  await expect(
    page.getByRole('button', { name: /^Switch D, on, flipped by a trip plate/ }),
  ).toBeVisible({
    timeout: 10_000,
  });
  await expect(status(page)).toHaveText(
    'Stopped at Gate 3: it needs power but got no power. On the way, a trip plate flipped D.',
    { timeout: 10_000 },
  );
  await expect(page.getByRole('button', { name: /^Switch D, off$/ })).toBeVisible();
});

test('Skip jumps a run straight to the result card, and completion counts once', async ({
  page,
}) => {
  await page.goto('/');
  await dismissIntro(page);
  await expect(board(page)).toBeVisible();
  await page.getByRole('button', { name: /^Switch A,/ }).click();
  await run(page).click();
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 1_500 });
  await expect(page.getByRole('dialog').getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Levels' }).click();
  await expect(page.getByText(`1 of ${SOLUTIONS.length} solved`)).toBeVisible();
});

test('settings persist, and resetting progress asks first', async ({ page }) => {
  await page.goto('/');
  await dismissIntro(page);
  await solve(page, ['A']);
  await page.getByRole('dialog').getByRole('button', { name: 'Levels' }).click();
  await expect(page.getByText(`1 of ${SOLUTIONS.length} solved`)).toBeVisible();
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
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  await expect(page.getByText(`0 of ${SOLUTIONS.length} solved`)).toBeVisible();
});

test('Unlock all levels opens every level for testing', async ({ page }) => {
  await page.goto('/');
  await dismissIntro(page);
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Level 20, Grand Finale, locked' })).toBeDisabled();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('switch', { name: 'Unlock all levels' }).click();
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  await page.getByRole('button', { name: /^Level 20, Grand Finale$/ }).click();
  await expect(page.getByRole('heading', { name: 'Grand Finale' })).toBeVisible();
});

test('play stats count runs, misses and quits on this device, and can be cleared', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await dismissIntro(page);
  await solve(page, ['A']);
  await page.getByRole('button', { name: 'Next challenge' }).click();
  await expect(page.getByRole('heading', { name: 'Reverse Logic' })).toBeVisible();
  await run(page).click();
  await expect(run(page)).toHaveText(/Retry/);
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'View' }).click();

  await expect(page.getByRole('heading', { name: 'Play stats' })).toBeVisible();
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('Sessions1');
  await expect(totals).toContainText(`Levels solved1/${SOLUTIONS.length}`);
  await expect(totals).toContainText('Runs2');
  const rows = page.locator('.stats-table tbody tr');
  // Level, Runs, Miss, Hint, Retry, Quit, First solve; the funnel ends at the first level not opened.
  await expect(rows.nth(0)).toHaveText(['1', '1', '0', '0', '0', '0', '1 · ★★★'].join(''));
  await expect(rows.nth(1)).toHaveText(['2', '1', '1', '0', '0', '1', 'not yet'].join(''));
  await expect(rows).toHaveCount(3);
  await expect(page.getByRole('region', { name: 'Hardest levels' })).toContainText(
    'Level 2 · Reverse Logic1 quit, 1 missed Run',
  );

  await page.getByRole('button', { name: 'Clear stats' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByText('Stats cleared.')).toBeVisible();
  await expect(totals).toContainText('Runs0');
  await expect(rows).toHaveCount(1);
});

test('the coin count shows on every screen and opens the shop', async ({ page }) => {
  await page.goto('/');
  await dismissIntro(page);
  const coins = page.getByRole('button', { name: 'Shop, 20 coins' });
  const shop = page.getByRole('dialog', { name: 'Coins' });
  const check = async () => {
    await coins.click();
    await expect(shop).toBeVisible();
    await shop.getByRole('button', { name: 'Close' }).click();
    await expect(shop).toHaveCount(0);
  };
  await check();
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  await check();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await check();
  await page.getByRole('button', { name: 'View' }).click();
  await expect(page.getByRole('heading', { name: 'Play stats' })).toBeVisible();
  await check();
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

/** Opens the game on level `n`, with every level before it solved and the intro seen. */
async function openLevel(page: Page, n: number) {
  const completed = Object.fromEntries(
    Array.from({ length: n - 1 }, (_, i) => [
      `level-${String(i + 1).padStart(2, '0')}`,
      { bestAttempts: 1 },
    ]),
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
  await expect(board(page)).toBeVisible();
}

test('hints cost coins or a short ad, and coins come from the shop', async ({ page }) => {
  // Two page loads plus the demo ads and purchase: slower CI runners need more than the default.
  test.setTimeout(60_000);
  await openLevel(page, 10);
  await expect(page.getByRole('heading', { name: 'Master Circuit' })).toBeVisible();
  const hinted = page.locator('.switch.is-hinted');
  const hint = page.getByRole('button', { name: 'Hint, 10 coins' });

  await hint.click();
  await expect(page.getByRole('dialog')).toContainText('20 coins');
  await page.getByRole('button', { name: /^Use coins/ }).click();
  await expect(hinted).toHaveCount(1);
  await expect(hinted).toHaveAttribute('aria-label', /^Switch D,.*set by a hint/);
  await expect(page.getByLabel('Changes 0, par 4')).toBeVisible();
  await hinted.click({ force: true });
  await expect(hinted).toHaveCount(1);

  await hint.click();
  await page.getByRole('button', { name: /^Use coins/ }).click();
  await expect(hinted).toHaveCount(2);

  // Out of coins: the ad pays for the move instead.
  await hint.click();
  await expect(page.getByRole('dialog')).toContainText('0 coins');
  await expect(page.getByRole('button', { name: /^Use coins/ })).toBeDisabled();
  await expect(page.getByText(/^Demo: nothing is shown or charged/)).toBeVisible();
  await page.getByRole('button', { name: /^Watch a short ad/ }).click();
  await expect(hinted).toHaveCount(3);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await hint.click();
  await expect(page.getByText('The last step is yours.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.reload();
  await expect(hinted).toHaveCount(3);
  await expect(page.getByLabel('Changes 0, par 4')).toBeVisible();

  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  await page.getByRole('button', { name: 'Shop, 0 coins' }).click();
  const shop = page.getByRole('dialog', { name: 'Coins' });
  await expect(shop).toContainText('3 left today');
  await shop.getByRole('button', { name: /^Watch a short ad/ }).click();
  await expect(shop.getByText('3 coins added.')).toBeVisible();
  await expect(shop).toContainText('2 left today');
  await shop.getByRole('button', { name: /100 coins/ }).click();
  await expect(shop.getByText('100 coins added.')).toBeVisible();
  await expect(shop).toContainText('103 coins');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Shop, 103 coins' })).toBeVisible();
});

test('two free retries per level, then one costs coins or an ad, and solving refills them', async ({
  page,
}) => {
  // Seven Runs: without the animations, so slower CI runners finish in time.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLevel(page, 11);
  await expect(page.getByRole('heading', { name: 'Fork in the Road' })).toBeVisible();
  const badge = page.locator('.run-badge');
  await expect(badge).toHaveCount(0);

  await run(page).click();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(badge).toHaveText('2');
  await expect(run(page)).toHaveAccessibleDescription('2 retries left');
  await run(page).click();
  await expect(badge).toHaveText('1');
  await run(page).click();
  await expect(badge).toHaveText('+');

  // Out of retries: the button asks before running.
  await run(page).click();
  const offer = page.getByRole('dialog', { name: 'One more try?' });
  await expect(offer).toContainText('20 coins');
  await offer.getByRole('button', { name: /^Retry for coins/ }).click();
  await expect(offer).toHaveCount(0);
  await expect(status(page)).toContainText('Stopped');
  await expect(badge).toHaveText('+');

  await run(page).click();
  await expect(offer).toContainText('15 coins');
  await offer.getByRole('button', { name: /^Watch a short ad/ }).click();
  await expect(offer).toHaveCount(0);
  await expect(status(page)).toContainText('Stopped');

  // Leaving doesn't refill them.
  await page.reload();
  await expect(board(page)).toBeVisible();
  await expect(badge).toHaveText('+');

  await page.getByRole('button', { name: /^Switch F,/ }).click();
  await run(page).click();
  await offer.getByRole('button', { name: /^Retry for coins/ }).click();
  const card = page.getByRole('dialog', { name: 'Fork in the Road' });
  await expect(card.getByRole('img', { name: '2 of 3 stars' })).toBeVisible();
  await expect(card).toContainText('+2 coins');
  await card.getByRole('button', { name: 'Replay' }).click();
  await expect(board(page)).toBeVisible();
  await expect(badge).toHaveCount(0);
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Shop, 12 coins' })).toBeVisible();
});

test('the tutorial levels have free hints and unlimited retries', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await dismissIntro(page);
  await expect(board(page)).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await run(page).click();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  }
  await expect(page.locator('.run-badge')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hint, free on this level' })).toBeVisible();
});

/** The daily's one par answer, by switch label, part by part, from the solver. */
function dailySolution(day: string): string[] {
  const { level } = dailyFor(day);
  const turned = new Set(turnsFor(level, solveLevel(level).parWins[0]!));
  const parts = indexLevel(level).checkpoints.length + 1;
  const out: string[] = [];
  for (let part = 0; part < parts; part++) {
    if (part > 0) out.push(PART);
    for (const n of level.nodes)
      if (n.type === 'switch' && turned.has(n.id) && switchStage(n) === part) out.push(n.label!);
  }
  return out;
}

test('the daily puzzle: opens after level 10, earns coins and a streak, and shares', async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // No share sheet in the test browser, so sharing falls back to the clipboard.
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00Z'));

  // A new player sees it locked.
  await page.goto('/');
  await dismissIntro(page);
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  const card = page.getByRole('region', { name: 'Daily puzzle #1' });
  await expect(card).toContainText('Opens after 10 more levels');
  await expect(card.getByRole('button')).toHaveCount(0);

  await openLevel(page, 11);
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  await card.getByRole('button', { name: 'Play the daily puzzle' }).click();
  await expect(page.getByRole('heading', { name: 'Thursday 29 Oct' })).toBeVisible();
  await solve(page, dailySolution('2026-10-29'));
  const result = page.getByRole('dialog', { name: 'Thursday 29 Oct' });
  await expect(result).toContainText('Daily #1 solved');
  await expect(result.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(result).toContainText('+2 coins');
  await result.getByRole('button', { name: 'Share result' }).click();
  await expect(result.getByText('Copied. Paste it anywhere.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'Chain Reaction Daily #1\n★★★ first Run, par\n🟩',
  );
  await result.getByRole('button', { name: 'Levels' }).click();
  await expect(card).toContainText('Solved.');
  await expect(card.getByLabel('1-day streak')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shop, 22 coins' })).toBeVisible();

  // The next day brings the next puzzle, and the streak waits on it.
  await page.clock.setFixedTime(new Date('2026-10-30T08:00:00Z'));
  await page.reload();
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  const tomorrow = page.getByRole('region', { name: 'Daily puzzle #2' });
  await expect(tomorrow).toContainText('Solve today to make it a 2-day streak.');
  await tomorrow.getByRole('button', { name: 'Play the daily puzzle' }).click();
  await solve(page, dailySolution('2026-10-30'));
  await expect(page.getByRole('dialog', { name: 'Friday 30 Oct' })).toContainText('2-day streak');
});

test('a missed day after the weekly freeze can be repaired with coins or an ad', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00Z'));
  await openLevel(page, 11);
  // Solved up to Tuesday 27 October with the week's freeze spent; Wednesday 28 was missed.
  await page.evaluate(() =>
    localStorage.setItem(
      'chain-reaction/daily',
      JSON.stringify({
        version: 1,
        results: {},
        streak: 3,
        best: 3,
        lastDay: '2026-10-27',
        freezes: ['2026-10-26'],
      }),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  const card = page.getByRole('region', { name: 'Daily puzzle #1' });
  await expect(card).toContainText('You missed a day. Keep your 3-day streak');
  await expect(card.getByRole('button', { name: /^Repair streak/ })).toBeDisabled();
  await card.getByRole('button', { name: /^Repair with a short ad/ }).click();
  await expect(card.getByText('Streak saved.')).toBeVisible();
  await expect(card).toContainText('Solve today to make it a 4-day streak.');
  await page.reload();
  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  await expect(card).toContainText('Solve today to make it a 4-day streak.');
});

test('an ad plays between levels after every third solve from level 10, until Remove ads', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLevel(page, 10);
  for (const i of [9, 10, 11]) {
    await solve(page, SOLUTIONS[i]!.switches);
    if (i < 11) await page.getByRole('button', { name: 'Next challenge' }).click();
  }
  await page.getByRole('button', { name: 'Next challenge' }).click();
  const ad = page.getByRole('dialog', { name: 'Ad break' });
  await expect(ad).toBeVisible();
  await expect(ad.getByRole('button', { name: /^Close in/ })).toBeDisabled();
  await ad.getByRole('button', { name: 'Close ad' }).click();
  await expect(ad).toHaveCount(0);
  await expect(page.getByRole('heading', { name: SOLUTIONS[12]!.name })).toBeVisible();

  await page.getByRole('button', { name: 'Levels', exact: true }).click();
  await page.getByRole('button', { name: /^Shop,/ }).click();
  const shop = page.getByRole('dialog', { name: 'Coins' });
  await shop.getByRole('button', { name: /^Remove ads/ }).click();
  await expect(shop.getByText('Ads between levels are off for good.')).toBeVisible();
  await expect(shop.getByRole('button', { name: /^Remove ads/ })).toContainText('Owned');
});

test.describe('on the smallest phone', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('every level fits the board, with no labels or switches overlapping', async ({ page }) => {
    test.setTimeout(SOLUTIONS.length * 6_000);
    const completed = Object.fromEntries(
      SOLUTIONS.map((_, i) => [`level-${String(i + 1).padStart(2, '0')}`, { bestAttempts: 1 }]),
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
    for (const [i, { name }] of SOLUTIONS.entries()) {
      // With every level solved, the game opens on the level list.
      if (i > 0) await page.getByRole('button', { name: 'Levels', exact: true }).click();
      await page.getByRole('button', { name: `Level ${i + 1}, ${name}, solved` }).click();
      await expect(board(page)).toBeVisible();
      const problems = await page.evaluate(() => {
        const frame = document.querySelector('.board')!.getBoundingClientRect();
        const boxes = [
          ...document.querySelectorAll(
            [
              '.board-stage > .switch',
              '.board-stage > .tag:not(.gate-tag, .fork-tag, .lane-tag)',
              '.board-stage > :is(.gate-tag, .fork-tag, .lane-tag) > *',
            ].join(','),
          ),
        ]
          // Parts of a staged board out of view are hidden.
          .filter((el) => getComputedStyle(el).visibility !== 'hidden')
          .map((el) => ({
            name: el.getAttribute('aria-label') ?? el.textContent,
            r: el.getBoundingClientRect(),
          }));
        const out: string[] = boxes.length < 3 ? ['no overlays found'] : [];
        for (const [j, a] of boxes.entries()) {
          if (a.r.left < frame.left || a.r.right > frame.right || a.r.bottom > frame.bottom)
            out.push(`${a.name} leaves the board`);
          for (const b of boxes.slice(j + 1)) {
            const overlap =
              Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 1 &&
              Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 1;
            if (overlap) out.push(`${a.name} overlaps ${b.name}`);
          }
        }
        return out;
      });
      expect(problems, name).toEqual([]);
    }
  });
});

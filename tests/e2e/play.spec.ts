import { expect, test, type Page } from '@playwright/test';

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
    test.setTimeout(180_000);
    await page.goto('/');
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
  await page.getByRole('button', { name: '‹ Levels' }).click();
  await expect(page.getByText(`0 of ${SOLUTIONS.length} solved`)).toBeVisible();
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
  // Three page loads plus the demo shop: slower CI runners need more than the default.
  test.setTimeout(60_000);
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
  await expect(page.getByLabel('Changes 0, par 4')).toBeVisible();
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
  await expect(page.getByLabel('Changes 0, par 4')).toBeVisible();
});

test.describe('on the smallest phone', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('every level fits the board, with no labels or switches overlapping', async ({ page }) => {
    test.setTimeout(120_000);
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

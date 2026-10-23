// Local progress, versioned. Reads never throw: missing, corrupt or blocked storage
// falls back to a fresh profile, so the game always starts.

export interface LevelRecord {
  /** Fewest attempts the level was solved in. */
  bestAttempts: number;
}

export interface Progress {
  version: 1;
  completed: Record<string, LevelRecord>;
  /** The how-it-works card has been dismissed. */
  seenIntro?: boolean;
}

export const STORAGE_KEY = 'chain-reaction/progress';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export const emptyProgress = (): Progress => ({ version: 1, completed: {} });

function defaultStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadProgress(store: KeyValueStore | null = defaultStore()): Progress {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    return migrate(JSON.parse(raw));
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress: Progress, store: KeyValueStore | null = defaultStore()) {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage full or blocked: progress lasts for this session only.
  }
}

/** Accepts any stored value and returns valid current-version progress. */
export function migrate(data: unknown): Progress {
  if (typeof data !== 'object' || data === null) return emptyProgress();
  const { version, completed, seenIntro } = data as {
    version?: unknown;
    completed?: unknown;
    seenIntro?: unknown;
  };
  if (version !== 1 || typeof completed !== 'object' || completed === null) return emptyProgress();
  const clean: Record<string, LevelRecord> = {};
  for (const [id, record] of Object.entries(completed)) {
    const best = (record as { bestAttempts?: unknown })?.bestAttempts;
    if (typeof best === 'number' && Number.isInteger(best) && best >= 1)
      clean[id] = { bestAttempts: best };
  }
  return seenIntro === true
    ? { version: 1, completed: clean, seenIntro }
    : { version: 1, completed: clean };
}

export function recordWin(progress: Progress, levelId: string, attempts: number): Progress {
  const previous = progress.completed[levelId]?.bestAttempts;
  const bestAttempts = previous === undefined ? attempts : Math.min(previous, attempts);
  return { ...progress, completed: { ...progress.completed, [levelId]: { bestAttempts } } };
}

/** A level is open once every level before it is solved. */
export function isUnlocked(
  levelIds: readonly string[],
  progress: Progress,
  index: number,
): boolean {
  return levelIds.slice(0, index).every((id) => id in progress.completed);
}

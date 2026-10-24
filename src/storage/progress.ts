// Local progress, versioned. Reads never throw: missing, corrupt or blocked storage
// falls back to a fresh profile, so the game always starts. Records are keyed by level
// id, so adding or reordering levels never loses progress.

import type { Stars } from '../game/scoring';

export interface LevelRecord {
  /** Best stars earned. Never lowered. */
  stars: Stars;
  /** Fewest Runs the level was solved in. */
  bestAttempts: number;
  /** Fewest switch changes in a winning solve. */
  fewestChanges?: number;
  /** When the level was first solved (ISO time). Never changed after. */
  firstCompletedAt?: string;
}

export interface Progress {
  version: 2;
  completed: Record<string, LevelRecord>;
  /**
   * Levels whose first Run is spent: any Run that ended (won or missed), or leaving or
   * resetting after clearing a part. Only a level's first Run can earn three stars.
   */
  firstRunUsed: Record<string, true>;
  /** The how-it-works card has been dismissed. */
  seenIntro?: boolean;
}

export const STORAGE_KEY = 'chain-reaction/progress';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export const emptyProgress = (): Progress => ({ version: 2, completed: {}, firstRunUsed: {} });

function defaultStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * `hintsUsed` (free moves per level, from the hint wallet) lets a version 1 save award
 * the right stars: a hinted solve earns one.
 */
export function loadProgress(
  store: KeyValueStore | null = defaultStore(),
  hintsUsed: Readonly<Record<string, number>> = {},
): Progress {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    return migrate(JSON.parse(raw), hintsUsed);
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

const isCount = (n: unknown, min = 0): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min;
const isStars = (n: unknown): n is Stars => n === 1 || n === 2 || n === 3;

/** Accepts any stored value and returns valid current-version progress. */
export function migrate(data: unknown, hintsUsed: Readonly<Record<string, number>> = {}): Progress {
  if (typeof data !== 'object' || data === null) return emptyProgress();
  const { version, completed, firstRunUsed, seenIntro } = data as Record<string, unknown>;
  if ((version !== 1 && version !== 2) || typeof completed !== 'object' || completed === null)
    return emptyProgress();
  const out = emptyProgress();
  for (const [id, value] of Object.entries(completed)) {
    const r = (value ?? {}) as Record<string, unknown>;
    if (!isCount(r.bestAttempts, 1)) continue;
    // Version 1 kept only Runs. Its change limit equalled par, so every solve was at par.
    const stars = version === 1 ? (hintsUsed[id] ? 1 : r.bestAttempts === 1 ? 3 : 2) : r.stars;
    if (!isStars(stars)) continue;
    const record: LevelRecord = { stars, bestAttempts: r.bestAttempts };
    if (isCount(r.fewestChanges)) record.fewestChanges = r.fewestChanges;
    if (typeof r.firstCompletedAt === 'string') record.firstCompletedAt = r.firstCompletedAt;
    out.completed[id] = record;
    // A level solved under version 1 has had its first Run.
    out.firstRunUsed[id] = true;
  }
  if (version === 2 && typeof firstRunUsed === 'object' && firstRunUsed !== null) {
    for (const [id, used] of Object.entries(firstRunUsed))
      if (used === true) out.firstRunUsed[id] = true;
  }
  if (seenIntro === true) out.seenIntro = true;
  return out;
}

export interface WinResult {
  stars: Stars;
  attempts: number;
  changes: number;
  /** ISO time of this win. */
  at: string;
}

/** Keeps the better of the old and new result for each field; a replay never lowers one. */
export function recordWin(progress: Progress, levelId: string, win: WinResult): Progress {
  const old = progress.completed[levelId];
  const record: LevelRecord = old
    ? {
        stars: Math.max(old.stars, win.stars) as Stars,
        bestAttempts: Math.min(old.bestAttempts, win.attempts),
        fewestChanges: Math.min(old.fewestChanges ?? win.changes, win.changes),
        firstCompletedAt: old.firstCompletedAt ?? win.at,
      }
    : {
        stars: win.stars,
        bestAttempts: win.attempts,
        fewestChanges: win.changes,
        firstCompletedAt: win.at,
      };
  return {
    ...progress,
    completed: { ...progress.completed, [levelId]: record },
    firstRunUsed: { ...progress.firstRunUsed, [levelId]: true },
  };
}

/** Marks a level's first Run as spent. Returns the same object when it already was. */
export function spendFirstRun(progress: Progress, levelId: string): Progress {
  if (progress.firstRunUsed[levelId]) return progress;
  return { ...progress, firstRunUsed: { ...progress.firstRunUsed, [levelId]: true } };
}

/** A level is open once every level before it is solved. */
export function isUnlocked(
  levelIds: readonly string[],
  progress: Progress,
  index: number,
): boolean {
  return levelIds.slice(0, index).every((id) => id in progress.completed);
}

/** Total stars earned over the given levels. */
export const totalStars = (levelIds: readonly string[], progress: Progress) =>
  levelIds.reduce((sum, id) => sum + (progress.completed[id]?.stars ?? 0), 0);

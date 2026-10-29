// Play stats, kept on this device only: nothing here is ever sent anywhere. They answer
// where players get stuck and how often they reach for hints, retries and ads, for
// playtests now and as the shape of the real analytics once the apps ship.
// Counters are kept rather than a full event log, so the record stays small however long
// someone plays; the last RECENT_LIMIT events are kept too, to show what just happened.
// Reads never throw: anything missing or malformed falls back to a fresh record.

/** Where a rewarded ad can be offered. */
export type AdPlacement = 'hint' | 'retry' | 'shop' | 'repair';
export const AD_PLACEMENTS: readonly AdPlacement[] = ['hint', 'retry', 'shop', 'repair'];

export type MetricEvent =
  /** The game opened, on this UTC day. */
  | { type: 'session'; day: string }
  /** A level or daily opened, replays included. */
  | { type: 'start'; level: string }
  /** A Run ended at the goal or a stop; Runs that only clear a part don't count. */
  | { type: 'run'; level: string; won: boolean }
  | { type: 'solve'; level: string; stars: number; runs: number; hints: number }
  | { type: 'hint'; level: string; paid: 'coins' | 'ad' | 'free' }
  | { type: 'retry'; level: string; paid: 'coins' | 'ad' }
  /** Next tapped on the result card. */
  | { type: 'next'; level: string }
  /** Left a level without solving it. */
  | { type: 'quit'; level: string }
  | { type: 'adOffered'; placement: AdPlacement }
  | { type: 'adWatched'; placement: AdPlacement }
  /** An ad between levels was due, and whether it was closed. */
  | { type: 'betweenAd'; closed: boolean }
  | { type: 'purchase'; item: string };

export interface LevelStats {
  starts: number;
  /** Runs that ended, at the goal or not. */
  runs: number;
  misses: number;
  solves: number;
  hints: number;
  retries: number;
  nexts: number;
  quits: number;
  /** How the first solve went, kept once: Runs and hints it took. */
  first?: { runs: number; hints: number; stars: number };
}

export interface Metrics {
  version: 1;
  /** When counting began, in ms since the epoch. */
  since: number;
  sessions: number;
  /** The UTC days the game was opened, most recent last, capped at DAYS_LIMIT. */
  days: string[];
  /** Keyed by level id; every daily puzzle counts under DAILY_KEY. */
  levels: Record<string, LevelStats>;
  ads: Record<AdPlacement, { offered: number; watched: number }>;
  between: { due: number; closed: number };
  purchases: Record<string, number>;
  /** The latest events, newest last, each with its time in ms since the epoch. */
  recent: (MetricEvent & { at: number })[];
}

export const METRICS_KEY = 'chain-reaction/metrics';
export const DAILY_KEY = 'daily';
export const RECENT_LIMIT = 100;
export const DAYS_LIMIT = 120;

/** Daily puzzles have one id per day; their stats are pooled. */
export const statsKey = (levelId: string) => (levelId.startsWith('daily-') ? DAILY_KEY : levelId);

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

const freshAdCounts = () =>
  Object.fromEntries(AD_PLACEMENTS.map((p) => [p, { offered: 0, watched: 0 }])) as Metrics['ads'];

export const freshMetrics = (now = Date.now()): Metrics => ({
  version: 1,
  since: now,
  sessions: 0,
  days: [],
  levels: {},
  ads: freshAdCounts(),
  between: { due: 0, closed: 0 },
  purchases: {},
  recent: [],
});

export const emptyLevelStats = (): LevelStats => ({
  starts: 0,
  runs: 0,
  misses: 0,
  solves: 0,
  hints: 0,
  retries: 0,
  nexts: 0,
  quits: 0,
});

function defaultStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadMetrics(store: KeyValueStore | null = defaultStore()): Metrics {
  try {
    const raw = store?.getItem(METRICS_KEY);
    return raw ? migrateMetrics(JSON.parse(raw)) : freshMetrics();
  } catch {
    return freshMetrics();
  }
}

export function saveMetrics(metrics: Metrics, store: KeyValueStore | null = defaultStore()) {
  try {
    store?.setItem(METRICS_KEY, JSON.stringify(metrics));
  } catch {
    // Storage full or blocked: the stats last for this session only.
  }
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const count = (n: unknown) => (isCount(n) ? n : 0);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function migrateLevel(data: unknown): LevelStats {
  if (!isRecord(data)) return emptyLevelStats();
  const stats: LevelStats = {
    starts: count(data.starts),
    runs: count(data.runs),
    misses: count(data.misses),
    solves: count(data.solves),
    hints: count(data.hints),
    retries: count(data.retries),
    nexts: count(data.nexts),
    quits: count(data.quits),
  };
  const first = data.first;
  if (isRecord(first) && isCount(first.runs) && isCount(first.hints) && isCount(first.stars)) {
    stats.first = { runs: first.runs, hints: first.hints, stars: first.stars };
  }
  return stats;
}

export function migrateMetrics(data: unknown): Metrics {
  if (!isRecord(data) || data.version !== 1) return freshMetrics();
  const fresh = freshMetrics(isCount(data.since) ? data.since : undefined);
  const ads = fresh.ads;
  if (isRecord(data.ads)) {
    for (const p of AD_PLACEMENTS) {
      const a = data.ads[p];
      if (isRecord(a)) ads[p] = { offered: count(a.offered), watched: count(a.watched) };
    }
  }
  const between = isRecord(data.between)
    ? { due: count(data.between.due), closed: count(data.between.closed) }
    : fresh.between;
  return {
    ...fresh,
    sessions: count(data.sessions),
    days: Array.isArray(data.days)
      ? data.days.filter((d): d is string => typeof d === 'string' && DAY.test(d))
      : [],
    levels: isRecord(data.levels)
      ? Object.fromEntries(Object.entries(data.levels).map(([id, s]) => [id, migrateLevel(s)]))
      : {},
    ads,
    between,
    purchases: isRecord(data.purchases)
      ? Object.fromEntries(
          Object.entries(data.purchases).filter((e): e is [string, number] => isCount(e[1])),
        )
      : {},
    recent: Array.isArray(data.recent)
      ? data.recent
          .filter(
            (e): e is MetricEvent & { at: number } =>
              isRecord(e) && typeof e.type === 'string' && isCount(e.at),
          )
          .slice(-RECENT_LIMIT)
      : [],
  };
}

/** Adds one event to the counters. Never changes `metrics` itself. */
export function record(metrics: Metrics, event: MetricEvent, now = Date.now()): Metrics {
  const next: Metrics = {
    ...metrics,
    recent: [...metrics.recent, { ...event, at: now }].slice(-RECENT_LIMIT),
  };
  const level = (id: string, edit: (s: LevelStats) => LevelStats) => {
    const key = statsKey(id);
    next.levels = { ...metrics.levels, [key]: edit(metrics.levels[key] ?? emptyLevelStats()) };
  };
  switch (event.type) {
    case 'session':
      next.sessions = metrics.sessions + 1;
      if (!metrics.days.includes(event.day)) {
        next.days = [...metrics.days, event.day].slice(-DAYS_LIMIT);
      }
      break;
    case 'start':
      level(event.level, (s) => ({ ...s, starts: s.starts + 1 }));
      break;
    case 'run':
      level(event.level, (s) => ({
        ...s,
        runs: s.runs + 1,
        misses: s.misses + (event.won ? 0 : 1),
      }));
      break;
    case 'solve':
      level(event.level, (s) => ({
        ...s,
        solves: s.solves + 1,
        first: s.first ?? { runs: event.runs, hints: event.hints, stars: event.stars },
      }));
      break;
    case 'hint':
      level(event.level, (s) => ({ ...s, hints: s.hints + 1 }));
      break;
    case 'retry':
      level(event.level, (s) => ({ ...s, retries: s.retries + 1 }));
      break;
    case 'next':
      level(event.level, (s) => ({ ...s, nexts: s.nexts + 1 }));
      break;
    case 'quit':
      level(event.level, (s) => ({ ...s, quits: s.quits + 1 }));
      break;
    case 'adOffered':
    case 'adWatched': {
      const a = metrics.ads[event.placement];
      const watched = event.type === 'adWatched';
      next.ads = {
        ...metrics.ads,
        [event.placement]: {
          offered: a.offered + (watched ? 0 : 1),
          watched: a.watched + (watched ? 1 : 0),
        },
      };
      break;
    }
    case 'betweenAd':
      next.between = {
        due: metrics.between.due + 1,
        closed: metrics.between.closed + (event.closed ? 1 : 0),
      };
      break;
    case 'purchase':
      next.purchases = {
        ...metrics.purchases,
        [event.item]: (metrics.purchases[event.item] ?? 0) + 1,
      };
      break;
  }
  return next;
}

export interface FunnelRow {
  id: string;
  /** Opened at least once. */
  reached: boolean;
  stats: LevelStats;
}

/**
 * The campaign in order, with each level's counters. Reaching a level and not solving it is
 * where a player stalled; many misses or quits on a level point at a difficulty spike.
 */
export function funnel(metrics: Metrics, levelIds: readonly string[]): FunnelRow[] {
  return levelIds.map((id) => {
    const stats = metrics.levels[id] ?? emptyLevelStats();
    return { id, reached: stats.starts > 0, stats };
  });
}

/** The levels players left unsolved most often, worst first: quits, then misses. */
export function stuckLevels(rows: readonly FunnelRow[], limit = 3): FunnelRow[] {
  return rows
    .filter((r) => r.stats.quits > 0 || r.stats.misses > 0)
    .toSorted((a, b) => b.stats.quits - a.stats.quits || b.stats.misses - a.stats.misses)
    .slice(0, limit);
}

import { describe, expect, it } from 'vitest';
import {
  DAILY_KEY,
  DAYS_LIMIT,
  freshMetrics,
  funnel,
  loadMetrics,
  METRICS_KEY,
  migrateMetrics,
  RECENT_LIMIT,
  record,
  saveMetrics,
  statsKey,
  stuckLevels,
  type MetricEvent,
  type Metrics,
} from '../../src/storage/metrics';

const T0 = 1_800_000_000_000;

const play = (events: MetricEvent[], start = freshMetrics(T0)): Metrics =>
  events.reduce((m, e, i) => record(m, e, T0 + i), start);

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('play stats', () => {
  it('counts a level visit: Runs, misses, hints, retries, the solve and Next', () => {
    const m = play([
      { type: 'start', level: 'level-05' },
      { type: 'run', level: 'level-05', won: false },
      { type: 'hint', level: 'level-05', paid: 'coins' },
      { type: 'run', level: 'level-05', won: false },
      { type: 'run', level: 'level-05', won: false },
      { type: 'retry', level: 'level-05', paid: 'ad' },
      { type: 'run', level: 'level-05', won: true },
      { type: 'solve', level: 'level-05', stars: 1, runs: 4, hints: 1 },
      { type: 'next', level: 'level-05' },
    ]);
    expect(m.levels['level-05']).toEqual({
      starts: 1,
      runs: 4,
      misses: 3,
      solves: 1,
      hints: 1,
      retries: 1,
      nexts: 1,
      quits: 0,
      first: { runs: 4, hints: 1, stars: 1 },
    });
  });

  it('keeps the first solve when the level is replayed', () => {
    const m = play([
      { type: 'solve', level: 'level-02', stars: 2, runs: 2, hints: 0 },
      { type: 'solve', level: 'level-02', stars: 3, runs: 1, hints: 0 },
    ]);
    expect(m.levels['level-02']!.solves).toBe(2);
    expect(m.levels['level-02']!.first).toEqual({ runs: 2, hints: 0, stars: 2 });
  });

  it('pools every daily puzzle under one row', () => {
    expect(statsKey('daily-2026-10-29')).toBe(DAILY_KEY);
    expect(statsKey('level-12')).toBe('level-12');
    const m = play([
      { type: 'start', level: 'daily-2026-10-29' },
      { type: 'start', level: 'daily-2026-10-30' },
      { type: 'solve', level: 'daily-2026-10-30', stars: 3, runs: 1, hints: 0 },
    ]);
    expect(Object.keys(m.levels)).toEqual([DAILY_KEY]);
    expect(m.levels[DAILY_KEY]).toMatchObject({ starts: 2, solves: 1 });
  });

  it('counts sessions and distinct days, capped', () => {
    const m = play([
      { type: 'session', day: '2026-10-29' },
      { type: 'session', day: '2026-10-29' },
      { type: 'session', day: '2026-10-30' },
    ]);
    expect(m.sessions).toBe(3);
    expect(m.days).toEqual(['2026-10-29', '2026-10-30']);
    const many = Array.from({ length: DAYS_LIMIT + 5 }, (_, i): MetricEvent => {
      const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      return { type: 'session', day: d };
    });
    expect(play(many).days).toHaveLength(DAYS_LIMIT);
  });

  it('counts ads offered and watched by place, ads between levels and purchases', () => {
    const m = play([
      { type: 'adOffered', placement: 'retry' },
      { type: 'adOffered', placement: 'retry' },
      { type: 'adWatched', placement: 'retry' },
      { type: 'adWatched', placement: 'repair' },
      { type: 'betweenAd', closed: true },
      { type: 'betweenAd', closed: false },
      { type: 'purchase', item: 'coins_100' },
      { type: 'purchase', item: 'coins_100' },
      { type: 'purchase', item: 'remove_ads' },
    ]);
    expect(m.ads.retry).toEqual({ offered: 2, watched: 1 });
    expect(m.ads.repair).toEqual({ offered: 0, watched: 1 });
    expect(m.ads.shop).toEqual({ offered: 0, watched: 0 });
    expect(m.between).toEqual({ due: 2, closed: 1 });
    expect(m.purchases).toEqual({ coins_100: 2, remove_ads: 1 });
  });

  it('keeps only the latest events, and never changes the record it was given', () => {
    const start = freshMetrics(T0);
    const events = Array.from({ length: RECENT_LIMIT + 20 }, (): MetricEvent => ({
      type: 'start',
      level: 'level-01',
    }));
    const m = play(events, start);
    expect(m.recent).toHaveLength(RECENT_LIMIT);
    expect(m.recent.at(-1)).toEqual({ type: 'start', level: 'level-01', at: T0 + 119 });
    expect(m.levels['level-01']!.starts).toBe(RECENT_LIMIT + 20);
    expect(start).toEqual(freshMetrics(T0));
  });

  it('lines levels up in campaign order and finds the hardest', () => {
    const m = play([
      { type: 'start', level: 'a' },
      { type: 'solve', level: 'a', stars: 3, runs: 1, hints: 0 },
      { type: 'start', level: 'b' },
      { type: 'run', level: 'b', won: false },
      { type: 'run', level: 'b', won: false },
      { type: 'quit', level: 'b' },
      { type: 'start', level: 'c' },
      { type: 'run', level: 'c', won: false },
      { type: 'quit', level: 'c' },
      { type: 'quit', level: 'c' },
    ]);
    const rows = funnel(m, ['a', 'b', 'c', 'd']);
    expect(rows.map((r) => r.reached)).toEqual([true, true, true, false]);
    expect(stuckLevels(rows).map((r) => r.id)).toEqual(['c', 'b']);
  });

  it('round-trips and cleans bad data', () => {
    const store = memoryStore();
    const m = play([
      { type: 'session', day: '2026-10-29' },
      { type: 'start', level: 'level-01' },
      { type: 'solve', level: 'level-01', stars: 3, runs: 1, hints: 0 },
    ]);
    saveMetrics(m, store);
    expect(loadMetrics(store)).toEqual(m);

    const cleaned = migrateMetrics({
      version: 1,
      since: T0,
      sessions: -2,
      days: ['2026-10-29', 'yesterday', 4],
      levels: { 'level-01': { starts: 2, runs: 'many', first: { runs: 1 } }, x: null },
      ads: { hint: { offered: 3, watched: 1.5 }, bogus: { offered: 9 } },
      between: 'often',
      purchases: { coins_100: 1, coins_600: -1 },
      recent: [{ type: 'start', level: 'level-01', at: T0 }, { at: 'now' }, null],
    });
    expect(cleaned.sessions).toBe(0);
    expect(cleaned.days).toEqual(['2026-10-29']);
    expect(cleaned.levels['level-01']).toMatchObject({ starts: 2, runs: 0 });
    expect(cleaned.levels['level-01']!.first).toBeUndefined();
    expect(cleaned.levels.x!.starts).toBe(0);
    expect(cleaned.ads.hint).toEqual({ offered: 3, watched: 0 });
    expect(cleaned.ads).not.toHaveProperty('bogus');
    expect(cleaned.between).toEqual({ due: 0, closed: 0 });
    expect(cleaned.purchases).toEqual({ coins_100: 1 });
    expect(cleaned.recent).toHaveLength(1);

    expect(migrateMetrics({ version: 2 })).toMatchObject({ sessions: 0, levels: {} });
    store.data.set(METRICS_KEY, '{broken');
    expect(loadMetrics(store).sessions).toBe(0);
    expect(loadMetrics(null).sessions).toBe(0);
  });
});

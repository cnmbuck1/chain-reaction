import { describe, expect, it } from 'vitest';
import { furthestLevel, toAnalytics } from './analytics';

const ids = ['one', 'two', 'three'];

describe('toAnalytics', () => {
  it('names campaign levels by id and number', () => {
    expect(toAnalytics({ type: 'start', level: 'two' }, ids)).toEqual({
      name: 'level_start',
      params: { level_name: 'two', level: 2 },
    });
  });

  it('pools daily puzzles as level 0', () => {
    expect(toAnalytics({ type: 'quit', level: 'daily-2026-10-31' }, ids)).toEqual({
      name: 'level_quit',
      params: { level_name: 'daily', level: 0 },
    });
  });

  it('carries how a solve went', () => {
    expect(
      toAnalytics({ type: 'solve', level: 'three', stars: 2, runs: 3, hints: 1 }, ids),
    ).toEqual({
      name: 'level_end',
      params: { level_name: 'three', level: 3, success: 1, stars: 2, runs: 3, hints: 1 },
    });
  });

  it('marks missed runs', () => {
    expect(toAnalytics({ type: 'run', level: 'one', won: false }, ids)?.params.success).toBe(0);
  });

  it('skips stats Firebase counts itself', () => {
    expect(toAnalytics({ type: 'session', day: '2026-10-31' }, ids)).toBeNull();
    expect(toAnalytics({ type: 'adOffered', placement: 'hint' }, ids)).toBeNull();
  });
});

describe('furthestLevel', () => {
  it('is the highest solved number', () => {
    expect(furthestLevel(ids, {})).toBe(0);
    expect(furthestLevel(ids, { one: {}, three: {} })).toBe(3);
    expect(furthestLevel(ids, { one: {} }, 'two')).toBe(2);
  });
});

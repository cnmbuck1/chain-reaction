import { levels } from '../levels';
import { DAILY_EPOCH } from './rules';
import { DAILY_POOL } from './pool';
import { applySpec, finishDaily } from './transform';
import type { LevelDef } from '../engine/types';
import { daysBetween } from './dates';

// Which daily puzzle belongs to a date. Days run on UTC, so everyone has the same puzzle at
// the same moment, and the pool ships with the app, so it works offline.

export interface Daily {
  number: number;
  day: string;
  level: LevelDef;
}

const cache = new Map<string, Daily>();

/** The daily puzzle for a UTC date. A clock set before the first daily gets Daily #1. */
export function dailyFor(day: string): Daily {
  const cached = cache.get(day);
  if (cached) return cached;
  const index = Math.max(0, daysBetween(DAILY_EPOCH, day));
  const spec = DAILY_POOL[index % DAILY_POOL.length]!;
  const base = levels.find((l) => l.id === spec.base)!;
  const number = index + 1;
  // The pool test checks every row finishes, so this never falls back in practice.
  const level = finishDaily(applySpec(base, spec), day) ?? base;
  const daily = { number, day, level };
  cache.set(day, daily);
  return daily;
}

import type { LevelDef } from '../engine/types';
import { level01 } from './data/level-01';
import { level02 } from './data/level-02';
import { level03 } from './data/level-03';

/** Curated levels in play order. */
export const levels: readonly LevelDef[] = [level01, level02, level03];

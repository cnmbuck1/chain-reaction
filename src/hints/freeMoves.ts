import { switchStage } from '../engine/graph';
import { solve } from '../engine/solver';
import type { LevelDef, NodeId } from '../engine/types';

// A hint is a free move: the game sets one switch to where every solution needs it and
// locks it there. The level is rebuilt with that switch's start moved to its target, so
// the move doesn't count as one of the player's changes and the engine needs no special case.

export interface FreeMove {
  switchId: NodeId;
  on: boolean;
}

/** Levels whose hints cost nothing: the tutorial. */
export const FREE_HINT_LEVELS = 3;

const plans = new WeakMap<LevelDef, FreeMove[]>();

/**
 * The moves hints make, in order: the level's key switch first, then the rest of the
 * solution, part by part on staged boards. Capped one short of the full solution so the player always makes the last
 * change themselves, except on one-change levels.
 */
export function freeMovePlan(level: LevelDef): FreeMove[] {
  const cached = plans.get(level);
  if (cached) return cached;
  const report = solve(level);
  const win = report.parWins[0];
  const moves: FreeMove[] = [];
  if (win) {
    const changed = level.nodes.filter(
      (n) => n.type === 'switch' && !n.locked && win[n.id] !== n.initialOn,
    );
    // Part by part, so a hint always helps where the player is; the key switch leads its part.
    const key = level.meta.keySwitch;
    changed.sort(
      (a, b) => switchStage(a) - switchStage(b) || Number(b.id === key) - Number(a.id === key),
    );
    for (const n of changed) moves.push({ switchId: n.id, on: win[n.id]! });
  }
  const plan = moves.slice(0, Math.max(1, moves.length - 1));
  plans.set(level, plan);
  return plan;
}

/** The level as played after `used` free moves: those switches start where hinted, locked. */
export function withFreeMoves(level: LevelDef, used: number): LevelDef {
  const moves = freeMovePlan(level).slice(0, used);
  if (moves.length === 0) return level;
  const target = new Map(moves.map((m) => [m.switchId, m.on]));
  return {
    ...level,
    nodes: level.nodes.map((n) =>
      n.type === 'switch' && target.has(n.id)
        ? { ...n, initialOn: target.get(n.id)!, locked: true }
        : n,
    ),
  };
}

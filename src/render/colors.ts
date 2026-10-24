import { indexLevel } from '../engine/graph';
import type { LevelDef, NodeId } from '../engine/types';

// Each switch gets its own color, carried by its wires and the badges on the gates it
// feeds, so a player can trace cause and effect at a glance. Cyan is the power source's.

const SWITCH_COLORS = ['#b18cff', '#6ee7a8', '#ff8fa3', '#7cb8ff', '#f6e27a'] as const;
export const SOURCE_COLOR = '#4fd6e8';

/** CSS color for a signal node (switch or source), stable by switch order. */
export function signalColor(level: LevelDef, id: NodeId): string {
  const index = indexLevel(level);
  if (index.nodes.get(id)?.type !== 'switch') return SOURCE_COLOR;
  const i = level.nodes.filter((n) => n.type === 'switch').findIndex((n) => n.id === id);
  return SWITCH_COLORS[i % SWITCH_COLORS.length]!;
}

export const toHex = (css: string) => parseInt(css.slice(1), 16);

// Keys are metals, so they never read as a switch's wire: gold, then silver, then copper. A lock
// takes its key's metal.
const KEY_COLORS = ['#f0d08a', '#dfe6ee', '#e8935f'] as const;

/** CSS color for a key, or for the key a lock needs; the first key on a board is gold. */
export function keyColor(level: LevelDef, id: NodeId): string {
  const node = indexLevel(level).nodes.get(id);
  const keyId = node?.type === 'lock' ? node.key : id;
  const i = level.nodes.filter((n) => n.type === 'key').findIndex((n) => n.id === keyId);
  return KEY_COLORS[Math.max(i, 0) % KEY_COLORS.length]!;
}

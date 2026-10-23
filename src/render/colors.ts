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

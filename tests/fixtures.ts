import type { LevelDef, LevelNode, SignalEdge } from '../src/engine/types';

/** Builds a level with sensible defaults so tests only spell what matters. */
export function makeLevel(
  parts: Partial<LevelDef> & { nodes: LevelNode[]; signalEdges: SignalEdge[]; track: string[][] },
): LevelDef {
  return {
    schemaVersion: 1,
    id: 'test',
    name: 'Test',
    difficulty: 'medium',
    maxToggles: 2,
    meta: { teachingPoint: '', hint: '', minChanges: 0 },
    ...parts,
  };
}

const at = { x: 0.5, y: 0.5 };
export const source = (id = 'source'): LevelNode => ({ id, type: 'source', ...at });
export const sw = (id: string, initialOn = false): LevelNode => ({
  id,
  type: 'switch',
  initialOn,
  ...at,
});
export const gate = (
  id: string,
  requiredSignal = true,
  combine: 'single' | 'and' | 'or' = 'single',
): LevelNode => ({ id, type: 'gate', combine, requiredSignal, ...at });
export const ball = (id = 'ball'): LevelNode => ({ id, type: 'ballStart', ...at });
export const goal = (id = 'goal'): LevelNode => ({ id, type: 'goal', ...at });
export const deadEnd = (id: string): LevelNode => ({ id, type: 'deadEnd', ...at });
export const junction = (id: string, whenTrue: string, whenFalse: string): LevelNode => ({
  id,
  type: 'junction',
  whenTrue,
  whenFalse,
  ...at,
});

/**
 * The design doc's Level 4 example. A feeds gate 1 (needs ON) and, through B in
 * series, gate 2 (needs OFF). B starts ON. Answer: A on, B off.
 */
export const tradeoff = makeLevel({
  id: 'tradeoff',
  maxToggles: 2,
  nodes: [source(), sw('a'), sw('b', true), gate('g1', true), gate('g2', false), ball(), goal()],
  signalEdges: [
    { from: 'source', to: 'a' },
    { from: 'a', to: 'g1' },
    { from: 'a', to: 'b' },
    { from: 'b', to: 'g2' },
  ],
  track: [['ball', 'g1', 'g2', 'goal']],
  meta: { teachingPoint: '', hint: '', minChanges: 2 },
});

/** A junction picks the route: ON goes to a dead end, OFF to the goal. */
export const fork = makeLevel({
  id: 'fork',
  maxToggles: 1,
  nodes: [source(), sw('a', true), junction('j', 'dead', 'goal'), ball(), goal(), deadEnd('dead')],
  signalEdges: [
    { from: 'source', to: 'a' },
    { from: 'a', to: 'j' },
  ],
  track: [['ball', 'j']],
  meta: { teachingPoint: '', hint: '', minChanges: 1 },
});

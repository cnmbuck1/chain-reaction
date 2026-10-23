import type { LevelDef } from '../../engine/types';

export const level01: LevelDef = {
  schemaVersion: 1,
  id: 'level-01',
  name: 'First Spark',
  difficulty: 'tutorial',
  maxToggles: 1,
  nodes: [
    { id: 'source', type: 'source', x: 0.1, y: 0.25, label: 'Power' },
    { id: 's1', type: 'switch', x: 0.4, y: 0.25, initialOn: false, label: 'Switch A' },
    {
      id: 'g1',
      type: 'gate',
      x: 0.6,
      y: 0.7,
      combine: 'single',
      requiredSignal: true,
      label: 'Gate 1',
    },
    { id: 'ball', type: 'ballStart', x: 0.1, y: 0.7, label: 'Start' },
    { id: 'goal', type: 'goal', x: 0.9, y: 0.7, label: 'Goal' },
  ],
  signalEdges: [
    { from: 'source', to: 's1' },
    { from: 's1', to: 'g1' },
  ],
  track: [['ball', 'g1', 'goal']],
  meta: {
    teachingPoint: 'A powered switch opens the gate it feeds.',
    hint: 'The gate opens only when power reaches it.',
    minChanges: 1,
  },
};

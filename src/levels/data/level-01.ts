import type { LevelDef } from '../../engine/types';

export const level01: LevelDef = {
  schemaVersion: 1,
  id: 'level-01',
  name: 'First Spark',
  difficulty: 'tutorial',
  maxToggles: 1,
  nodes: [
    { id: 'source', type: 'source', x: 0.14, y: 0.16, label: 'Power' },
    { id: 's1', type: 'switch', x: 0.5, y: 0.4, initialOn: false, label: 'A' },
    {
      id: 'g1',
      type: 'gate',
      x: 0.5,
      y: 0.78,
      combine: 'single',
      requiredSignal: true,
      label: 'Gate 1',
    },
    { id: 'ball', type: 'ballStart', x: 0.1, y: 0.78, label: 'Start' },
    { id: 'goal', type: 'goal', x: 0.9, y: 0.78, label: 'Goal' },
  ],
  signalEdges: [
    { from: 'source', to: 's1' },
    { from: 's1', to: 'g1' },
  ],
  track: [['ball', 'g1', 'goal']],
  meta: {
    teachingPoint: 'A powered switch opens the gate it feeds.',
    hint: 'The gate opens only when power reaches it.',
    prompt: 'Tap switch A to turn it on, then press Run.',
    minChanges: 1,
    focus: 'g1',
    keySwitch: 's1',
  },
};

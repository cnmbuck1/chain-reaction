import type { LevelDef } from '../../engine/types';

export const level02: LevelDef = {
  schemaVersion: 1,
  id: 'level-02',
  name: 'Reverse Logic',
  difficulty: 'tutorial',
  maxToggles: 1,
  nodes: [
    { id: 'source', type: 'source', x: 0.14, y: 0.16, label: 'Power' },
    { id: 's1', type: 'switch', x: 0.5, y: 0.4, initialOn: true, label: 'A' },
    {
      id: 'g1',
      type: 'gate',
      x: 0.5,
      y: 0.78,
      combine: 'single',
      requiredSignal: false,
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
    teachingPoint: 'Some gates open only when they get no power.',
    hint: 'Look at what this gate needs before you touch anything.',
    prompt: 'This gate is marked OFF: it opens only without power.',
    minChanges: 1,
  },
};

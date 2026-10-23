import type { LevelDef } from '../../engine/types';

export const level11: LevelDef = {
  schemaVersion: 1,
  id: 'level-11',
  name: 'Flip Side',
  difficulty: 'easy',
  maxToggles: 2,
  nodes: [
    { id: 'source', type: 'source', x: 0.5, y: 0.06, label: 'Power' },
    { id: 'a', type: 'switch', x: 0.3, y: 0.36, initialOn: true, label: 'A' },
    { id: 'b', type: 'switch', x: 0.7, y: 0.36, initialOn: false, label: 'B' },
    {
      id: 'g1',
      type: 'gate',
      x: 0.36,
      y: 0.84,
      combine: 'single',
      requiredSignal: true,
      label: 'Gate 1',
    },
    {
      id: 'g2',
      type: 'gate',
      x: 0.64,
      y: 0.84,
      combine: 'single',
      requiredSignal: true,
      label: 'Gate 2',
    },
    { id: 'ball', type: 'ballStart', x: 0.06, y: 0.84, label: 'Start' },
    { id: 'goal', type: 'goal', x: 0.94, y: 0.84, label: 'Goal' },
  ],
  signalEdges: [
    { from: 'source', to: 'a' },
    { from: 'source', to: 'b' },
    { from: 'a', to: 'g1', invert: true },
    { from: 'b', to: 'g2' },
  ],
  track: [['ball', 'g1', 'g2', 'goal']],
  meta: {
    teachingPoint: 'A NOT flips a wire, so a gate can need a switch turned off.',
    hint: 'Power through a NOT comes out dark. Gate 1 needs power, so A must stop sending it.',
    prompt: 'A NOT flips its wire: power in means none out, and no power in means power out.',
    minChanges: 2,
    keySwitch: 'a',
  },
};

import type { LevelDef } from '../../engine/types';

export const level04: LevelDef = {
  schemaVersion: 1,
  id: 'level-04',
  name: 'The Tradeoff',
  difficulty: 'easy',
  maxToggles: 2,
  nodes: [
    {
      id: 'source',
      type: 'source',
      x: 0.22,
      y: 0.1,
      label: 'Power',
    },
    {
      id: 'a',
      type: 'switch',
      x: 0.22,
      y: 0.34,
      initialOn: false,
      label: 'A',
    },
    {
      id: 'b',
      type: 'switch',
      x: 0.66,
      y: 0.52,
      initialOn: true,
      label: 'B',
    },
    {
      id: 'g1',
      type: 'gate',
      x: 0.32,
      y: 0.84,
      combine: 'single',
      requiredSignal: true,
      label: 'Gate 1',
    },
    {
      id: 'g2',
      type: 'gate',
      x: 0.68,
      y: 0.84,
      combine: 'single',
      requiredSignal: false,
      label: 'Gate 2',
    },
    {
      id: 'ball',
      type: 'ballStart',
      x: 0.06,
      y: 0.84,
      label: 'Start',
    },
    {
      id: 'goal',
      type: 'goal',
      x: 0.94,
      y: 0.84,
      label: 'Goal',
    },
  ],
  signalEdges: [
    {
      from: 'source',
      to: 'a',
    },
    {
      from: 'a',
      to: 'b',
    },
    {
      from: 'a',
      to: 'g1',
    },
    {
      from: 'b',
      to: 'g2',
    },
  ],
  track: [['ball', 'g1', 'g2', 'goal']],
  meta: {
    teachingPoint:
      'A switch only passes on power it receives, so one change can ripple down a chain.',
    hint: 'Powering A also powers B. Gate 2 wants B dark.',
    prompt: 'B gets its power from A, not from the source. Turning A on reaches B too.',
    minChanges: 2,
    keySwitch: 'b',
  },
};

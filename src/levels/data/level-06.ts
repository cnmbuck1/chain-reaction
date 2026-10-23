import type { LevelDef } from '../../engine/types';

export const level06: LevelDef = {
  schemaVersion: 1,
  id: 'level-06',
  name: 'False Friend',
  difficulty: 'medium',
  maxToggles: 2,
  nodes: [
    {
      id: 'source',
      type: 'source',
      x: 0.5,
      y: 0.08,
      label: 'Power',
    },
    {
      id: 'a',
      type: 'switch',
      x: 0.2,
      y: 0.34,
      initialOn: false,
      label: 'A',
    },
    {
      id: 'b',
      type: 'switch',
      x: 0.6,
      y: 0.3,
      initialOn: false,
      label: 'B',
    },
    {
      id: 'c',
      type: 'switch',
      x: 0.82,
      y: 0.54,
      initialOn: false,
      label: 'C',
    },
    {
      id: 'g1',
      type: 'gate',
      x: 0.32,
      y: 0.84,
      combine: 'or',
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
      from: 'source',
      to: 'b',
    },
    {
      from: 'b',
      to: 'c',
    },
    {
      from: 'a',
      to: 'g1',
    },
    {
      from: 'c',
      to: 'g1',
    },
    {
      from: 'a',
      to: 'g2',
    },
  ],
  track: [['ball', 'g1', 'g2', 'goal']],
  meta: {
    teachingPoint: 'The quickest fix for one gate can be the thing that blocks the next.',
    hint: 'A opens Gate 1 but also feeds Gate 2. Is there another way into Gate 1?',
    prompt: 'An ANY ON gate opens when at least one of its wires carries power.',
    minChanges: 2,
    keySwitch: 'c',
  },
};

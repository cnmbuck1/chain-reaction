import type { LevelDef } from '../../engine/types';

export const level33: LevelDef = {
  schemaVersion: 1,
  id: 'level-33',
  name: 'Chain Drive',
  difficulty: 'medium',
  boardHeight: 420,
  nodes: [
    {
      id: 'a',
      type: 'switch',
      x: 0.16,
      y: 0.16,
      initialOn: false,
      label: 'A',
      turns: ['b'],
    },
    {
      id: 'b',
      type: 'switch',
      x: 0.5,
      y: 0.16,
      initialOn: false,
      label: 'B',
      turns: ['d'],
    },
    {
      id: 'c',
      type: 'switch',
      x: 0.84,
      y: 0.16,
      initialOn: false,
      label: 'C',
    },
    {
      id: 'd',
      type: 'switch',
      x: 0.33,
      y: 0.46,
      initialOn: false,
      label: 'D',
    },
    {
      id: 'e',
      type: 'switch',
      x: 0.67,
      y: 0.46,
      initialOn: false,
      label: 'E',
    },
    {
      id: 'g1',
      type: 'gate',
      x: 0.25,
      y: 1,
      combine: 'and',
      requiredSignal: true,
      label: 'Gate 1',
    },
    {
      id: 'g2',
      type: 'gate',
      x: 0.5,
      y: 1,
      combine: 'and',
      requiredSignal: true,
      label: 'Gate 2',
    },
    {
      id: 'g3',
      type: 'gate',
      x: 0.78,
      y: 1,
      combine: 'and',
      requiredSignal: false,
      label: 'Gate 3',
    },
    {
      id: 'source',
      type: 'source',
      x: 0.5,
      y: 0,
      label: 'Power',
    },
    {
      id: 'ball',
      type: 'ballStart',
      x: 0,
      y: 1,
      label: 'Start',
    },
    {
      id: 'goal',
      type: 'goal',
      x: 1,
      y: 1,
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
      from: 'source',
      to: 'c',
    },
    {
      from: 'source',
      to: 'd',
    },
    {
      from: 'source',
      to: 'e',
    },
    {
      from: 'd',
      to: 'g1',
    },
    {
      from: 'a',
      to: 'g1',
    },
    {
      from: 'd',
      to: 'g2',
    },
    {
      from: 'c',
      to: 'g2',
    },
    {
      from: 'b',
      to: 'g2',
    },
    {
      from: 'e',
      to: 'g3',
    },
    {
      from: 'c',
      to: 'g3',
    },
    {
      from: 'b',
      to: 'g3',
    },
  ],
  track: [['ball', 'g1', 'g2', 'g3', 'goal']],
  meta: {
    teachingPoint:
      "Gears turn one step only: a switch moved by a gear doesn't turn its own partner.",
    hint: 'Turning A brings B along. D still needs a turn by hand.',
    minChanges: 3,
    keySwitch: 'a',
  },
};

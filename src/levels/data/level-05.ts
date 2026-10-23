import type { LevelDef } from '../../engine/types';

export const level05: LevelDef = {
  schemaVersion: 1,
  id: 'level-05',
  name: 'Two Conditions',
  difficulty: 'medium',
  maxToggles: 3,
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
      x: 0.22,
      y: 0.32,
      initialOn: false,
      label: 'A',
    },
    {
      id: 'b',
      type: 'switch',
      x: 0.56,
      y: 0.32,
      initialOn: false,
      label: 'B',
    },
    {
      id: 'c',
      type: 'switch',
      x: 0.8,
      y: 0.54,
      initialOn: true,
      label: 'C',
    },
    {
      id: 'g1',
      type: 'gate',
      x: 0.32,
      y: 0.84,
      combine: 'and',
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
      from: 'b',
      to: 'g1',
    },
    {
      from: 'c',
      to: 'g2',
    },
  ],
  track: [['ball', 'g1', 'g2', 'goal']],
  meta: {
    teachingPoint: 'An ALL ON gate opens only when every wire feeding it carries power.',
    hint: 'Gate 1 needs both A and B. Then check what B powers next.',
    prompt: 'Gate 1 is an ALL ON gate: every wire into it must carry power.',
    minChanges: 3,
    focus: 'g2',
    keySwitch: 'c',
  },
};

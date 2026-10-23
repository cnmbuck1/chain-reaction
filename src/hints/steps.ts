import { solve } from '../engine/solver';
import { initialState } from '../engine/reducer';
import type { LevelDef, NodeId } from '../engine/types';
import { nodeName } from '../ui/describe';

// The three hint steps for a level, from its authored metadata and the solver.
// Each step gives away a little more; none hands over the whole solution.

export type HintStep =
  | { kind: 'nudge'; text: string }
  | { kind: 'focus'; text: string; gateId: NodeId }
  | { kind: 'move'; text: string; switchId: NodeId; on: boolean };

/** Levels whose hints cost nothing: the tutorial. */
export const FREE_HINT_LEVELS = 3;

export function hintSteps(level: LevelDef): HintStep[] {
  const steps: HintStep[] = [{ kind: 'nudge', text: level.meta.hint }];
  const { focus, keySwitch } = level.meta;
  if (focus) {
    steps.push({
      kind: 'focus',
      gateId: focus,
      text: `Look hard at ${nodeName(level, focus)} and the switches that feed it. It decides this level.`,
    });
  }
  if (keySwitch) {
    // The check guarantees every solution in budget agrees on this switch.
    const win = solve(level).wins[0];
    const on = win ? win[keySwitch]! : !initialState(level).switches[keySwitch];
    steps.push({
      kind: 'move',
      switchId: keySwitch,
      on,
      text: `Switch ${nodeName(level, keySwitch)} must end up ${on ? 'ON' : 'OFF'}. The rest is up to you.`,
    });
  }
  return steps;
}

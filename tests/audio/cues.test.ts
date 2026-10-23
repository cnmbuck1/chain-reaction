import { describe, expect, it } from 'vitest';
import { runSounds } from '../../src/audio/cues';
import { simulateRun } from '../../src/engine/simulate';
import { buildTimeline, INSTANT_TIMING, NORMAL_TIMING } from '../../src/render/timeline';
import { tradeoff } from '../fixtures';

const win = simulateRun(tradeoff, { a: true, b: false }, 1);
const blocked = simulateRun(tradeoff, { a: true, b: true }, 1);

describe('run sounds', () => {
  it('follow the animation: hum, gates, roll, then the outcome', () => {
    const timeline = buildTimeline(win.events, NORMAL_TIMING);
    const sounds = runSounds(timeline);
    expect(sounds.map((s) => s.sound)).toEqual(['hum', 'gateOpen', 'roll', 'chime']);
    const finish = timeline.cues.find((c) => c.kind === 'finish')!;
    expect(sounds.at(-1)!.at).toBe(finish.at);
    const roll = sounds.find((s) => s.sound === 'roll')!;
    expect(roll.at + roll.dur).toBe(finish.at);
  });

  it('a closed gate clunks and the run ends in a thud', () => {
    const sounds = runSounds(buildTimeline(blocked.events, NORMAL_TIMING));
    expect(sounds.some((s) => s.sound === 'gateClose')).toBe(true);
    expect(sounds.at(-1)!.sound).toBe('thud');
  });

  it('several gates resolving at once make one sound', () => {
    const sounds = runSounds(buildTimeline(win.events, NORMAL_TIMING));
    expect(sounds.filter((s) => s.sound.startsWith('gate'))).toHaveLength(1);
  });

  it('reduced motion plays only the outcome', () => {
    expect(runSounds(buildTimeline(win.events, INSTANT_TIMING))).toEqual([
      { at: 0, sound: 'chime', dur: 0 },
    ]);
    expect(runSounds(buildTimeline(blocked.events, INSTANT_TIMING))).toEqual([
      { at: 0, sound: 'thud', dur: 0 },
    ]);
  });
});

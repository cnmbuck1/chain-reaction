import type { Timeline } from '../render/timeline';

// Which sound plays when during a run, read off the same timeline the board animates,
// so sound and picture stay in step. Pure, so it is tested without audio.

export type SoundName =
  'click' | 'deny' | 'hum' | 'gateOpen' | 'gateClose' | 'roll' | 'chime' | 'thud' | 'win';

export interface SoundCue {
  /** Milliseconds from the start of the run. */
  at: number;
  sound: SoundName;
  /** Length for sustained sounds (hum, roll). */
  dur: number;
}

export function runSounds(timeline: Timeline): SoundCue[] {
  const out: SoundCue[] = [];
  // Reduced motion: everything lands at once, so only the outcome is heard.
  if (timeline.duration === 0) {
    for (const cue of timeline.cues)
      if (cue.kind === 'finish')
        out.push({
          at: 0,
          sound: cue.result === 'goal' || cue.result === 'checkpoint' ? 'chime' : 'thud',
          dur: 0,
        });
    return out;
  }
  const powered = timeline.cues.filter((c) => c.kind === 'wire' && c.value);
  if (powered.length > 0) {
    const start = powered[0]!.at;
    const end = Math.max(...powered.map((c) => c.at + c.dur));
    out.push({ at: start, sound: 'hum', dur: Math.max(end - start, 120) });
  }
  // One gate sound per moment: several gates resolving together make one clunk.
  const gateTimes = new Set<number>();
  for (const cue of timeline.cues) {
    if (cue.kind === 'gate' && !gateTimes.has(cue.at)) {
      gateTimes.add(cue.at);
      const anyClosed = timeline.cues.some((c) => c.kind === 'gate' && c.at === cue.at && !c.open);
      out.push({ at: cue.at, sound: anyClosed ? 'gateClose' : 'gateOpen', dur: cue.dur });
    }
  }
  const rolls = timeline.cues.filter((c) => c.kind === 'ball');
  if (rolls.length > 0) {
    const start = rolls[0]!.at;
    const end = Math.max(...rolls.map((c) => c.at + c.dur));
    out.push({ at: start, sound: 'roll', dur: end - start });
  }
  for (const cue of timeline.cues) {
    if (cue.kind === 'finish') {
      out.push({
        at: cue.at,
        sound: cue.result === 'goal' || cue.result === 'checkpoint' ? 'chime' : 'thud',
        dur: cue.dur,
      });
    }
    if (cue.kind === 'circuit') out.push({ at: cue.at, sound: 'win', dur: cue.dur });
  }
  return out.sort((a, b) => a.at - b.at);
}

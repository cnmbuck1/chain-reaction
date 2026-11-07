import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import type { SoundCue, SoundName } from './cues';

// Every sound is synthesized with WebAudio, so the game ships no audio files.
// Browsers only allow audio after a user gesture: the context is created on the
// first tap (unlock) and stays silent until then. Any audio failure is swallowed;
// sound is a garnish and must never break play.

type Ctx = AudioContext;

export class Sound {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private live: AudioScheduledSourceNode[] = [];
  enabled = true;

  /** Call from a tap or key handler. Safe to call repeatedly. */
  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stopAll();
  }

  play(name: SoundName, dur = 0) {
    this.schedule([{ at: 0, sound: name, dur }]);
  }

  /** Plays a run's cues against the audio clock. */
  schedule(cues: readonly SoundCue[]) {
    if (!this.enabled) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    try {
      const t0 = ctx.currentTime + 0.02;
      for (const cue of cues) this.voice(cue.sound, t0 + cue.at / 1000, cue.dur / 1000);
    } catch {
      // Ignore: a missing node type on an old browser only costs the sound.
    }
  }

  stopAll() {
    for (const node of this.live) {
      try {
        node.stop();
      } catch {
        // Already stopped.
      }
    }
    this.live = [];
  }

  dispose() {
    this.stopAll();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  private voice(name: SoundName, t: number, dur: number) {
    switch (name) {
      case 'click':
        this.tone(t, 'square', 1800, 900, 0.03, 0.12);
        this.burst(t, 0.025, 3500, 0.18);
        break;
      case 'deny':
        this.tone(t, 'square', 180, 150, 0.12, 0.08);
        break;
      case 'hum':
        this.tone(t, 'sawtooth', 110, 110, Math.max(dur, 0.12), 0.05, 1200);
        this.tone(t, 'sine', 220, 330, Math.max(dur, 0.12), 0.07);
        break;
      case 'gateOpen':
        this.burst(t, 0.06, 900, 0.35);
        this.tone(t, 'triangle', 220, 440, 0.18, 0.12);
        break;
      case 'gateClose':
        this.burst(t, 0.09, 500, 0.45);
        this.tone(t, 'triangle', 160, 90, 0.22, 0.16);
        break;
      case 'roll':
        this.rumble(t, Math.max(dur, 0.1));
        break;
      case 'chime':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(t + i * 0.09, 'sine', f, f, 0.9, 0.12));
        break;
      case 'win':
        // A soft major chord under a latch: the machine settling into place.
        this.burst(t, 0.05, 1200, 0.25);
        [523, 659, 784, 1047].forEach((f) => this.tone(t + 0.04, 'triangle', f, f, 1.1, 0.05));
        break;
      case 'thud':
        this.tone(t, 'sine', 120, 45, 0.35, 0.4);
        this.burst(t, 0.08, 300, 0.4);
        break;
    }
  }

  /** An oscillator with a quick attack and exponential decay, optionally low-passed. */
  private tone(
    t: number,
    type: OscillatorType,
    from: number,
    to: number,
    dur: number,
    gain: number,
    lowpass?: number,
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    const env = this.envelope(t, dur, gain);
    if (lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      osc.connect(filter).connect(env);
    } else {
      osc.connect(env);
    }
    this.start(osc, t, dur);
  }

  /** A short filtered noise hit: clicks, latches, impacts. */
  private burst(t: number, dur: number, cutoff: number, gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 1.2;
    src.connect(filter).connect(this.envelope(t, dur, gain));
    this.start(src, t, dur);
  }

  /** The ball rolling: low noise with a slow wobble, faded in and out. */
  private rumble(t: number, dur: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 11;
    const depth = ctx.createGain();
    depth.gain.value = 120;
    lfo.connect(depth).connect(filter.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
    env.gain.setValueAtTime(0.5, t + Math.max(0.08, dur - 0.12));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    env.connect(this.master!);
    src.connect(filter).connect(env);
    this.start(src, t, dur);
    this.start(lfo, t, dur);
  }

  private envelope(t: number, dur: number, gain: number): GainNode {
    const env = this.ctx!.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, 0.02));
    env.connect(this.master!);
    return env;
  }

  private start(node: AudioScheduledSourceNode, t: number, dur: number) {
    node.start(t);
    node.stop(t + Math.max(dur, 0.02) + 0.05);
    this.live.push(node);
    node.onended = () => {
      this.live = this.live.filter((n) => n !== node);
    };
  }

  private noiseBuffer(): AudioBuffer {
    if (!this.noise) {
      const ctx = this.ctx!;
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 1;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 16807) % 2147483647;
        data[i] = (seed / 2147483647) * 2 - 1;
      }
      this.noise = buffer;
    }
    return this.noise;
  }
}

/** What a buzz marks. Each has a vibration pattern on the web and a native haptic in the apps. */
export type Buzz = 'flip' | 'hint' | 'deny' | 'win';

const PATTERNS: Record<Buzz, number | number[]> = {
  flip: 12,
  hint: [12, 60, 12],
  deny: [30, 40, 30],
  win: [20, 50, 20, 50, 60],
};

/** True where buzz() can be felt: the phone apps, and browsers with a vibration API. */
export const canBuzz = () =>
  Capacitor.isNativePlatform() || (typeof navigator !== 'undefined' && 'vibrate' in navigator);

/** A short buzz. The apps use the phone's own haptics; iOS Safari has none, so it is a no-op there. */
export function buzz(kind: Buzz) {
  if (Capacitor.isNativePlatform()) {
    const done =
      kind === 'flip'
        ? Haptics.impact({ style: ImpactStyle.Light })
        : kind === 'hint'
          ? Haptics.impact({ style: ImpactStyle.Medium })
          : Haptics.notification({
              type: kind === 'win' ? NotificationType.Success : NotificationType.Warning,
            });
    void done.catch(() => undefined);
    return;
  }
  try {
    navigator.vibrate?.(PATTERNS[kind]);
  } catch {
    // Not allowed here.
  }
}

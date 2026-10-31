// Player preferences, stored apart from progress so resetting progress keeps them.
// Reads never throw: anything missing or malformed falls back to the default.

export type MotionSetting = 'system' | 'reduce';
/** The ball: the original steel ball, or the Cnmbuck Orb (won by solving every level). */
export type BallStyle = 'steel' | 'orb';

export interface Settings {
  version: 1;
  sound: boolean;
  haptics: boolean;
  /** 'system' follows prefers-reduced-motion; 'reduce' always skips animation. */
  motion: MotionSetting;
  /** Testing aid: every level is open, whatever has been solved. */
  unlockAll: boolean;
  ball: BallStyle;
  /** The Orb has been awarded and switched on once (after that the player picks freely). */
  orbAwarded: boolean;
}

export const SETTINGS_KEY = 'chain-reaction/settings';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** The shareable prototype is a test build, so every level starts open there. */
const TEST_BUILD = import.meta.env.MODE === 'single';

export const defaultSettings = (): Settings => ({
  version: 1,
  sound: true,
  haptics: true,
  motion: 'system',
  unlockAll: TEST_BUILD,
  ball: 'steel',
  orbAwarded: false,
});

function defaultStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(store: KeyValueStore | null = defaultStore()): Settings {
  try {
    const raw = store?.getItem(SETTINGS_KEY);
    return raw ? migrateSettings(JSON.parse(raw)) : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings, store: KeyValueStore | null = defaultStore()) {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked: settings last for this session only.
  }
}

/** Keeps each valid field and defaults the rest. */
export function migrateSettings(data: unknown): Settings {
  const out = defaultSettings();
  if (typeof data !== 'object' || data === null) return out;
  const { version, sound, haptics, motion, unlockAll, ball, orbAwarded } = data as Record<
    string,
    unknown
  >;
  if (version !== 1) return out;
  if (typeof sound === 'boolean') out.sound = sound;
  if (typeof haptics === 'boolean') out.haptics = haptics;
  if (motion === 'system' || motion === 'reduce') out.motion = motion;
  if (typeof unlockAll === 'boolean') out.unlockAll = unlockAll;
  if (ball === 'steel' || ball === 'orb') out.ball = ball;
  if (typeof orbAwarded === 'boolean') out.orbAwarded = orbAwarded;
  return out;
}

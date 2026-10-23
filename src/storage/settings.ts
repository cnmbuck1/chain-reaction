// Player preferences, stored apart from progress so resetting progress keeps them.
// Reads never throw: anything missing or malformed falls back to the default.

export type MotionSetting = 'system' | 'reduce';

export interface Settings {
  version: 1;
  sound: boolean;
  haptics: boolean;
  /** 'system' follows prefers-reduced-motion; 'reduce' always skips animation. */
  motion: MotionSetting;
}

export const SETTINGS_KEY = 'chain-reaction/settings';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export const defaultSettings = (): Settings => ({
  version: 1,
  sound: true,
  haptics: true,
  motion: 'system',
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
  const { version, sound, haptics, motion } = data as Record<string, unknown>;
  if (version !== 1) return out;
  if (typeof sound === 'boolean') out.sound = sound;
  if (typeof haptics === 'boolean') out.haptics = haptics;
  if (motion === 'system' || motion === 'reduce') out.motion = motion;
  return out;
}

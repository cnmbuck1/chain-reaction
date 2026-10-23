import { describe, expect, it } from 'vitest';
import {
  defaultSettings,
  loadSettings,
  migrateSettings,
  saveSettings,
  SETTINGS_KEY,
} from '../../src/storage/settings';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('settings storage', () => {
  it('defaults to sound and haptics on, motion following the device', () => {
    expect(loadSettings(memoryStore())).toEqual(defaultSettings());
    expect(defaultSettings()).toMatchObject({ sound: true, haptics: true, motion: 'system' });
  });

  it('round-trips', () => {
    const store = memoryStore();
    const settings = { ...defaultSettings(), sound: false, motion: 'reduce' as const };
    saveSettings(settings, store);
    expect(loadSettings(store)).toEqual(settings);
  });

  it('keeps valid fields and defaults bad ones', () => {
    expect(migrateSettings({ version: 1, sound: false, haptics: 'yes', motion: 'fast' })).toEqual({
      ...defaultSettings(),
      sound: false,
    });
    expect(migrateSettings({ version: 2, sound: false })).toEqual(defaultSettings());
    expect(migrateSettings(null)).toEqual(defaultSettings());
  });

  it('survives corrupt or blocked storage', () => {
    const store = memoryStore();
    store.data.set(SETTINGS_KEY, '{nope');
    expect(loadSettings(store)).toEqual(defaultSettings());
    expect(loadSettings(null)).toEqual(defaultSettings());
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSettings(throwing)).toEqual(defaultSettings());
    expect(() => saveSettings(defaultSettings(), throwing)).not.toThrow();
  });
});

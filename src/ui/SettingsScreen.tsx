import { useState } from 'react';
import type { MotionSetting, Settings } from '../storage/settings';

interface Props {
  settings: Settings;
  systemReduced: boolean;
  onChange: (next: Settings) => void;
  onResetProgress: () => void;
  /** Opens the play stats kept on this device. */
  onStats: () => void;
  onBack: () => void;
}

export function SettingsScreen({
  settings,
  systemReduced,
  onChange,
  onResetProgress,
  onStats,
  onBack,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const motionOptions: { value: MotionSetting; label: string }[] = [
    { value: 'system', label: 'Follow device' },
    { value: 'reduce', label: 'Reduce' },
  ];

  return (
    <main className="select settings">
      <header className="settings-top">
        <button type="button" className="ghost" onClick={onBack}>
          ‹ Levels
        </button>
        <h1>Settings</h1>
      </header>

      <section className="setting-list" aria-label="Settings">
        <Toggle
          label="Sound"
          detail="Clicks, hums and chimes while the machine runs."
          on={settings.sound}
          onChange={(sound) => onChange({ ...settings, sound })}
        />
        <Toggle
          label="Vibration"
          detail={
            canVibrate
              ? 'A short buzz when you flip a switch.'
              : 'This browser does not support vibration.'
          }
          on={settings.haptics && canVibrate}
          disabled={!canVibrate}
          onChange={(haptics) => onChange({ ...settings, haptics })}
        />
        <div className="setting">
          <div className="setting-text">
            <span className="setting-label" id="motion-label">
              Motion
            </span>
            <span className="setting-detail">
              {settings.motion === 'reduce'
                ? 'Runs finish instantly.'
                : systemReduced
                  ? 'Your device asks for reduced motion, so runs finish instantly.'
                  : 'Runs are animated.'}
            </span>
          </div>
          <div className="segmented" role="radiogroup" aria-labelledby="motion-label">
            {motionOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={settings.motion === option.value}
                className={settings.motion === option.value ? 'active' : ''}
                onClick={() => onChange({ ...settings, motion: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <Toggle
          label="Unlock all levels"
          detail="For testing: open every level without solving the ones before it. Stars still count."
          on={settings.unlockAll}
          onChange={(unlockAll) => onChange({ ...settings, unlockAll })}
        />
        <div className="setting">
          <div className="setting-text">
            <span className="setting-label">Play stats</span>
            <span className="setting-detail">
              For testing: where you got stuck, and how often you used hints, retries and ads. Kept
              on this device only.
            </span>
          </div>
          <button type="button" className="ghost small" onClick={onStats}>
            View
          </button>
        </div>
        <div className="setting">
          <div className="setting-text">
            <span className="setting-label">Progress</span>
            <span className="setting-detail" role="status">
              {resetDone
                ? 'Progress cleared. Level 1 is waiting.'
                : 'Clears solved levels and shows the intro again.'}
            </span>
          </div>
          <button type="button" className="ghost small danger" onClick={() => setConfirming(true)}>
            Reset
          </button>
        </div>
      </section>

      {confirming && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <div className="card">
            <p className="eyebrow">Reset progress</p>
            <h2 id="reset-title">Start over?</h2>
            <p>Every level will be marked unsolved. Your settings stay as they are.</p>
            <div className="card-actions">
              <button
                type="button"
                className="ghost"
                autoFocus
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-solid"
                onClick={() => {
                  onResetProgress();
                  setConfirming(false);
                  setResetDone(true);
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Toggle({
  label,
  detail,
  on,
  disabled = false,
  onChange,
}: {
  label: string;
  detail: string;
  on: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="setting">
      <div className="setting-text">
        <span className="setting-label">{label}</span>
        <span className="setting-detail">{detail}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        className="toggle"
        onClick={() => onChange(!on)}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

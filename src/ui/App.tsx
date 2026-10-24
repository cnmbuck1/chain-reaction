import { useEffect, useMemo, useState } from 'react';
import { Sound } from '../audio/sound';
import { FREE_HINT_LEVELS, freeMovePlan } from '../hints/freeMoves';
import { demoHintShop } from '../monetize/hintShop';
import { levels } from '../levels';
import {
  emptyProgress,
  isUnlocked,
  loadProgress,
  recordWin,
  saveProgress,
  spendFirstRun,
  totalStars,
  type Progress,
} from '../storage/progress';
import {
  grantHints,
  loadHints,
  saveHints,
  freeMovesUsed,
  spendFreeMove,
  type HintWallet,
} from '../storage/hints';
import { loadSettings, saveSettings, type Settings } from '../storage/settings';
import { GameScreen } from './GameScreen';
import { LevelSelect } from './LevelSelect';
import { SettingsScreen } from './SettingsScreen';

type Screen =
  | { kind: 'select' }
  | { kind: 'settings' }
  /** `play` counts replays, so a replay starts the level fresh. */
  | { kind: 'game'; index: number; play?: number };

const ids = levels.map((l) => l.id);

/**
 * Opens on the first unsolved level so a new player is playing in one tap. With every
 * level unlocked for testing, it opens on the level list instead.
 */
function firstScreen(progress: Progress, unlockAll: boolean): Screen {
  if (unlockAll) return { kind: 'select' };
  const index = ids.findIndex((id) => !(id in progress.completed));
  return index === -1 ? { kind: 'select' } : { kind: 'game', index };
}

function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function App() {
  // Hint moves let an old save tell hinted solves apart when it is upgraded.
  const [progress, setProgress] = useState(() => loadProgress(undefined, loadHints().used));
  const [settings, setSettings] = useState(loadSettings);
  const [wallet, setWallet] = useState(loadHints);
  const shop = useMemo(() => demoHintShop(), []);
  const [screen, setScreen] = useState<Screen>(() => firstScreen(progress, settings.unlockAll));
  const systemReduced = usePrefersReducedMotion();
  const reducedMotion = settings.motion === 'reduce' || systemReduced;

  const sound = useMemo(() => new Sound(), []);
  useEffect(() => sound.setEnabled(settings.sound), [sound, settings.sound]);
  useEffect(() => () => sound.dispose(), [sound]);

  const update = (next: Progress) => {
    setProgress(next);
    saveProgress(next);
  };
  /** For changes that can land in the same tick as another (a Run, then its win). */
  const change = (edit: (p: Progress) => Progress) =>
    setProgress((p) => {
      const next = edit(p);
      if (next !== p) saveProgress(next);
      return next;
    });
  const updateWallet = (next: HintWallet) => {
    setWallet(next);
    saveHints(next);
  };
  const changeSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
    if (next.sound) sound.unlock();
  };
  /**
   * Opens a level. A level already solved starts clean, without the hint moves of an
   * earlier visit, so its stars can be earned back. Spent hints are not refunded.
   */
  const play = (index: number, replay = 0) => {
    const id = ids[index]!;
    if (id in progress.completed && freeMovesUsed(wallet, id) > 0) {
      const used = { ...wallet.used };
      delete used[id];
      updateWallet({ ...wallet, used });
    }
    setScreen({ kind: 'game', index, play: replay });
  };

  if (screen.kind === 'settings') {
    return (
      <SettingsScreen
        settings={settings}
        systemReduced={systemReduced}
        onChange={changeSettings}
        onResetProgress={() => update(emptyProgress())}
        onBack={() => setScreen({ kind: 'select' })}
      />
    );
  }

  if (screen.kind === 'select') {
    return (
      <LevelSelect
        levels={levels}
        progress={progress}
        unlockAll={settings.unlockAll}
        onPlay={(index) => (settings.unlockAll || isUnlocked(ids, progress, index)) && play(index)}
        onSettings={() => setScreen({ kind: 'settings' })}
      />
    );
  }

  const level = levels[screen.index]!;
  const hasNext = screen.index + 1 < levels.length;
  const finale = hasNext ? null : { stars: totalStars(ids, progress), total: levels.length };
  return (
    <GameScreen
      key={`${level.id}:${screen.play ?? 0}`}
      level={level}
      number={screen.index + 1}
      hasNext={hasNext}
      finale={finale}
      reducedMotion={reducedMotion}
      sound={sound}
      soundOn={settings.sound}
      haptics={settings.haptics}
      onToggleSound={() => changeSettings({ ...settings, sound: !settings.sound })}
      hints={{
        balance: wallet.balance,
        used: freeMovesUsed(wallet, level.id),
        free: screen.index < FREE_HINT_LEVELS,
        shop,
        onUse: (moves) => {
          const free = screen.index < FREE_HINT_LEVELS;
          const available = freeMovePlan(level).length;
          const result = spendFreeMove(wallet, level.id, available, free, moves);
          if (result.ok) updateWallet(result.wallet);
          return result.ok;
        },
        onGrant: (count) =>
          setWallet((w) => {
            const next = grantHints(w, count);
            saveHints(next);
            return next;
          }),
      }}
      showIntro={screen.index === 0 && !progress.seenIntro}
      onIntroDone={() => update({ ...progress, seenIntro: true })}
      firstRunOpen={!progress.firstRunUsed[level.id]}
      onFirstRunUsed={() => change((p) => spendFirstRun(p, level.id))}
      onSolved={(win) =>
        change((p) => recordWin(p, level.id, { ...win, at: new Date().toISOString() }))
      }
      onNext={() => play(screen.index + 1)}
      onReplay={() => play(screen.index, (screen.play ?? 0) + 1)}
      onLevels={() => setScreen({ kind: 'select' })}
    />
  );
}

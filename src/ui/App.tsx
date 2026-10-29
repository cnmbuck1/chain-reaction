import { useEffect, useMemo, useState } from 'react';
import { Sound } from '../audio/sound';
import { freeMovePlan } from '../hints/freeMoves';
import { addDays, utcDay } from '../daily/dates';
import { DAILY_UNLOCK_LEVELS } from '../daily/rules';
import { dailyFor } from '../daily/schedule';
import { share, shareText } from '../daily/share';
import type { LevelDef } from '../engine/types';
import {
  COINS_PER_NEW_STAR,
  HINT_PRICE,
  RETRY_PRICE,
  STREAK_REPAIR_PRICE,
  TUTORIAL_LEVELS,
} from '../monetize/prices';
import {
  loadDaily,
  recordDailyWin,
  repairStreak,
  saveDaily,
  streakOn,
  type DailyRecord,
} from '../storage/daily';
import { demoShop } from '../monetize/shop';
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
  adsLeftToday,
  buyRetry,
  freeMovesUsed,
  grantCoins,
  loadWallet,
  refillRuns,
  rewardAd,
  runsLeft,
  saveWallet,
  spendFreeMove,
  spendCoins,
  spendRun,
  type Wallet,
} from '../storage/wallet';
import { loadSettings, saveSettings, type Settings } from '../storage/settings';
import { GameScreen } from './GameScreen';
import { LevelSelect } from './LevelSelect';
import { DailyCard } from './DailyCard';
import { SettingsScreen } from './SettingsScreen';
import { ShopPanel } from './ShopPanel';

type Screen =
  | { kind: 'select' }
  | { kind: 'settings' }
  /** `play` counts replays, so a replay starts the level fresh. */
  | { kind: 'game'; index: number; play?: number }
  /** The daily puzzle of `day`, kept while playing even if midnight passes. */
  | { kind: 'daily'; day: string; play?: number };

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
  const [progress, setProgress] = useState(() => loadProgress(undefined, loadWallet().used));
  const [settings, setSettings] = useState(loadSettings);
  const [wallet, setWallet] = useState(loadWallet);
  const shop = useMemo(() => demoShop(), []);
  const [shopOpen, setShopOpen] = useState(false);
  const [daily, setDaily] = useState(loadDaily);
  const changeDaily = (edit: (d: DailyRecord) => DailyRecord | null) =>
    setDaily((d) => {
      const next = edit(d);
      if (!next || next === d) return d;
      saveDaily(next);
      return next;
    });
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
  /** Wallet changes can land in the same tick too (a missed Run, then a bought retry). */
  const changeWallet = (edit: (w: Wallet) => Wallet | null) =>
    setWallet((w) => {
      const next = edit(w);
      if (!next || next === w) return w;
      saveWallet(next);
      return next;
    });
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
      changeWallet((w) => {
        const used = { ...w.used };
        delete used[id];
        return { ...w, used };
      });
    }
    setScreen({ kind: 'game', index, play: replay });
  };

  const shopPanel = shopOpen && (
    <ShopPanel
      coins={wallet.coins}
      adsLeft={adsLeftToday(wallet, new Date())}
      shop={shop}
      onAdWatched={() => changeWallet((w) => rewardAd(w, new Date()))}
      onBought={(coins) => changeWallet((w) => grantCoins(w, coins))}
      onClose={() => setShopOpen(false)}
    />
  );

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

  const now = new Date();
  const today = utcDay(now);
  const todays = dailyFor(today);
  const streak = streakOn(daily, today);
  const solvedCount = ids.filter((id) => id in progress.completed).length;
  const levelsToGo = settings.unlockAll ? 0 : Math.max(0, DAILY_UNLOCK_LEVELS - solvedCount);
  const shareDaily = async (day: string) => {
    const result = daily.results[day];
    if (!result) return null;
    const outcome = await share(shareText(dailyFor(day).number, result, streakOn(daily, day).days));
    return outcome === 'copied'
      ? 'Copied. Paste it anywhere.'
      : outcome === 'failed'
        ? 'Sharing isn’t available here.'
        : null;
  };
  /** Opens a daily; a replay of a solved one starts without its hint moves, like levels. */
  const playDaily = (day: string, replay = 0) => {
    const id = dailyFor(day).level.id;
    if (day in daily.results && freeMovesUsed(wallet, id) > 0) {
      changeWallet((w) => {
        const used = { ...w.used };
        delete used[id];
        return { ...w, used };
      });
    }
    setScreen({ kind: 'daily', day, play: replay });
  };

  if (screen.kind === 'select') {
    return (
      <>
        <LevelSelect
          levels={levels}
          progress={progress}
          unlockAll={settings.unlockAll}
          coins={wallet.coins}
          daily={
            <DailyCard
              number={todays.number}
              levelsToGo={levelsToGo}
              streak={streak}
              result={daily.results[today] ?? null}
              coins={wallet.coins}
              shop={shop}
              hoursLeft={Math.ceil(
                (Date.parse(`${addDays(today, 1)}T00:00:00Z`) - now.getTime()) / 3_600_000,
              )}
              onPlay={() => playDaily(today)}
              onShare={() => shareDaily(today)}
              onRepair={(paid) => {
                const paidWallet =
                  paid === 'coins' ? spendCoins(wallet, STREAK_REPAIR_PRICE) : wallet;
                if (!paidWallet || !repairStreak(daily, today)) return false;
                changeDaily((d) => repairStreak(d, today));
                changeWallet(() => paidWallet);
                return true;
              }}
            />
          }
          onPlay={(index) =>
            (settings.unlockAll || isUnlocked(ids, progress, index)) && play(index)
          }
          onShop={() => setShopOpen(true)}
          onSettings={() => setScreen({ kind: 'settings' })}
        />
        {shopPanel}
      </>
    );
  }

  const toLevels = () => setScreen({ kind: 'select' });
  /** What every game needs, campaign level or daily: sound, coins, hints and retries. */
  const gameProps = (level: LevelDef, free: boolean) => ({
    level,
    reducedMotion,
    sound,
    soundOn: settings.sound,
    haptics: settings.haptics,
    onToggleSound: () => changeSettings({ ...settings, sound: !settings.sound }),
    coins: wallet.coins,
    shop,
    onShop: () => setShopOpen(true),
    hints: {
      used: freeMovesUsed(wallet, level.id),
      free,
      onUse: (moves: number, paid: 'coins' | 'ad' | 'free') => {
        if (paid === 'free' && !free) return false;
        const cost = paid === 'coins' ? HINT_PRICE : 0;
        const available = freeMovePlan(level).length;
        const result = spendFreeMove(wallet, level.id, available, cost, moves);
        if (result.ok) changeWallet(() => result.wallet);
        return result.ok;
      },
    },
    retries: free
      ? null
      : {
          left: runsLeft(wallet, level.id),
          onMiss: () => changeWallet((w) => spendRun(w, level.id)),
          onBuy: (paid: 'coins' | 'ad') => {
            const next = buyRetry(wallet, level.id, paid === 'coins' ? RETRY_PRICE : 0);
            if (next) changeWallet(() => next);
            return next !== null;
          },
        },
    firstRunOpen: !progress.firstRunUsed[level.id],
    onFirstRunUsed: () => change((p) => spendFirstRun(p, level.id)),
    onLevels: toLevels,
  });

  if (screen.kind === 'daily') {
    const { day } = screen;
    const { number, level } = dailyFor(day);
    return (
      <>
        <GameScreen
          key={`${level.id}:${screen.play ?? 0}`}
          {...gameProps(level, false)}
          label={`Daily #${number}`}
          hasNext={false}
          finale={null}
          showIntro={false}
          onIntroDone={toLevels}
          onSolved={(win) => {
            const result = {
              stars: win.stars,
              runs: win.attempts,
              hintsUsed: freeMovesUsed(wallet, level.id),
              changes: win.changes,
              par: level.meta.minChanges,
            };
            const outcome = recordDailyWin(daily, day, result);
            changeDaily(() => outcome.record);
            changeWallet((w) => grantCoins(refillRuns(w, level.id), outcome.coins));
            const days = outcome.record.streak;
            return {
              coins: outcome.coins,
              note: outcome.first && days > 1 ? `${days}-day streak` : undefined,
            };
          }}
          onShare={() => shareDaily(day)}
          onNext={toLevels}
          onReplay={() => playDaily(day, (screen.play ?? 0) + 1)}
        />
        {shopPanel}
      </>
    );
  }

  const level = levels[screen.index]!;
  const hasNext = screen.index + 1 < levels.length;
  const finale = hasNext ? null : { stars: totalStars(ids, progress), total: levels.length };
  return (
    <>
      <GameScreen
        key={`${level.id}:${screen.play ?? 0}`}
        {...gameProps(level, screen.index < TUTORIAL_LEVELS)}
        label={`Level ${screen.index + 1}`}
        hasNext={hasNext}
        finale={finale}
        showIntro={screen.index === 0 && !progress.seenIntro}
        onIntroDone={() => update({ ...progress, seenIntro: true })}
        onSolved={(win) => {
          const before = progress.completed[level.id]?.stars ?? 0;
          const coins = Math.max(0, win.stars - before) * COINS_PER_NEW_STAR;
          changeWallet((w) => grantCoins(refillRuns(w, level.id), coins));
          change((p) => recordWin(p, level.id, { ...win, at: new Date().toISOString() }));
          return { coins };
        }}
        onNext={() => play(screen.index + 1)}
        onReplay={() => play(screen.index, (screen.play ?? 0) + 1)}
      />
      {shopPanel}
    </>
  );
}

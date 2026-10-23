import { useEffect, useState } from 'react';
import { levels } from '../levels';
import {
  isUnlocked,
  loadProgress,
  recordWin,
  saveProgress,
  type Progress,
} from '../storage/progress';
import { GameScreen } from './GameScreen';
import { LevelSelect } from './LevelSelect';

type Screen = { kind: 'select' } | { kind: 'game'; index: number };

const ids = levels.map((l) => l.id);

/** Opens on the first unsolved level so a new player is playing in one tap. */
function firstScreen(progress: Progress): Screen {
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
  const [progress, setProgress] = useState(loadProgress);
  const [screen, setScreen] = useState<Screen>(() => firstScreen(progress));
  const reducedMotion = usePrefersReducedMotion();

  const update = (next: Progress) => {
    setProgress(next);
    saveProgress(next);
  };
  const solved = (levelId: string, attempts: number) =>
    update(recordWin(progress, levelId, attempts));

  if (screen.kind === 'select') {
    return (
      <LevelSelect
        levels={levels}
        progress={progress}
        onPlay={(index) => isUnlocked(ids, progress, index) && setScreen({ kind: 'game', index })}
      />
    );
  }

  const level = levels[screen.index]!;
  const hasNext = screen.index + 1 < levels.length;
  return (
    <GameScreen
      key={level.id}
      level={level}
      number={screen.index + 1}
      hasNext={hasNext}
      reducedMotion={reducedMotion}
      showIntro={screen.index === 0 && !progress.seenIntro}
      onIntroDone={() => update({ ...progress, seenIntro: true })}
      onSolved={(attempts) => solved(level.id, attempts)}
      onNext={() => setScreen({ kind: 'game', index: screen.index + 1 })}
      onLevels={() => setScreen({ kind: 'select' })}
    />
  );
}

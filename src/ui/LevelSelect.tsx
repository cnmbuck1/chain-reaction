import type { LevelDef } from '../engine/types';
import { isUnlocked, type Progress } from '../storage/progress';

interface Props {
  levels: readonly LevelDef[];
  progress: Progress;
  onPlay: (index: number) => void;
  onSettings: () => void;
}

export function LevelSelect({ levels, progress, onPlay, onSettings }: Props) {
  const ids = levels.map((l) => l.id);
  const solved = ids.filter((id) => id in progress.completed).length;
  return (
    <main className="select">
      <header>
        <div className="select-top">
          <p className="eyebrow">
            {solved} of {levels.length} solved
          </p>
          <button type="button" className="ghost small" onClick={onSettings}>
            Settings
          </button>
        </div>
        <h1>Chain Reaction</h1>
        <p className="tagline">Understand the machine. Find the sequence. Watch it work.</p>
      </header>
      <ol className="level-list">
        {levels.map((level, i) => {
          const open = isUnlocked(ids, progress, i);
          const record = progress.completed[level.id];
          return (
            <li key={level.id}>
              <button
                type="button"
                className={`level-card ${record ? 'solved' : ''}`}
                disabled={!open}
                onClick={() => onPlay(i)}
                aria-label={`Level ${i + 1}, ${level.name}${record ? ', solved' : open ? '' : ', locked'}`}
              >
                <span className="level-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="level-name">{level.name}</span>
                <span className="level-state">
                  {record
                    ? record.bestAttempts === 1
                      ? 'First run'
                      : 'Solved'
                    : open
                      ? 'Play'
                      : 'Locked'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

import { useEffect, useRef } from 'react';
import type { Stars } from '../game/scoring';

interface Props {
  number: number;
  name: string;
  stars: Stars;
  firstRun: boolean;
  runs: number;
  hintsUsed: number;
  /** What the next star needs; null at three stars. */
  tip: string | null;
  teachingPoint: string;
  hasNext: boolean;
  /** Set on the last level: how the whole run of levels went. */
  finale: { firstTry: number; total: number } | null;
  onNext: () => void;
  onReplay: () => void;
  onLevels: () => void;
  /** Hides the card to look at the lit machine. */
  onClose: () => void;
}

/** The solved card: stars, how the solve went, and the way on. */
export function ResultCard({
  number,
  name,
  stars,
  firstRun,
  runs,
  hintsUsed,
  tip,
  teachingPoint,
  hasNext,
  finale,
  onNext,
  onReplay,
  onLevels,
  onClose,
}: Props) {
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => next.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="overlay result-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="solved-title"
    >
      <div className="card result-card">
        <button
          type="button"
          className="ghost icon card-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <p className="eyebrow">Level {number} solved</p>
        <h2 id="solved-title">{name}</h2>
        <p className="stars" role="img" aria-label={`${stars} of 3 stars`}>
          {[1, 2, 3].map((i) => (
            <StarIcon key={i} filled={i <= stars} index={i} />
          ))}
        </p>
        <ul className="result-facts">
          <li className={firstRun ? 'is-yes' : ''}>
            <span aria-hidden="true">{firstRun ? '✓' : '·'}</span>
            {firstRun ? 'First Run' : `Solved in ${runs} Runs`}
          </li>
          <li className={hintsUsed === 0 ? 'is-yes' : ''}>
            <span aria-hidden="true">{hintsUsed === 0 ? '✓' : '·'}</span>
            {hintsUsed === 0
              ? 'No hints'
              : `${hintsUsed} ${hintsUsed === 1 ? 'hint' : 'hints'} used`}
          </li>
        </ul>
        {tip && <p className="result-tip">{tip}</p>}
        <p className="result-lesson">{teachingPoint}</p>
        {finale && (
          <p className="finale">
            <strong>Every machine solved.</strong> {finale.firstTry} of {finale.total} on the first
            Run.{' '}
            {finale.firstTry === finale.total
              ? 'Flawless.'
              : 'Replay any level to try for a first-Run solve.'}
          </p>
        )}
        {hasNext ? (
          <button type="button" className="run next-challenge" ref={next} onClick={onNext}>
            Next challenge
          </button>
        ) : (
          <button type="button" className="run next-challenge" ref={next} onClick={onLevels}>
            Done
          </button>
        )}
        <div className="card-actions even">
          <button type="button" className="ghost" onClick={onReplay}>
            Replay
          </button>
          <button type="button" className="ghost" onClick={onLevels}>
            Levels
          </button>
        </div>
      </div>
    </div>
  );
}

function StarIcon({ filled, index }: { filled: boolean; index: number }) {
  return (
    <svg
      className={`star${filled ? ' is-filled' : ''}`}
      style={{ animationDelay: `${120 + index * 110}ms` }}
      viewBox="0 0 24 24"
      width="40"
      height="40"
      aria-hidden="true"
    >
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

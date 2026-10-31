import { useEffect, useRef, useState } from 'react';
import type { Stars } from '../game/scoring';
import { CoinIcon, coinsText } from './coins';

interface Props {
  /** "Level 12", or "Daily #4". */
  label: string;
  name: string;
  stars: Stars;
  firstRun: boolean;
  runs: number;
  hintsUsed: number;
  changes: number;
  par: number;
  /** What the next star needs; null at three stars. */
  tip: string | null;
  /** Coins this solve earned: one per new star. */
  coinsEarned: number;
  teachingPoint: string;
  hasNext: boolean;
  /** A line under the coins, such as the daily streak. */
  note?: string;
  /** Daily puzzles: shares the result; resolves to a line saying what happened. */
  onShare?: () => Promise<string | null>;
  /** Set on the last level: how the whole run of levels went. */
  finale: { stars: number; total: number } | null;
  onNext: () => void;
  onReplay: () => void;
  onLevels: () => void;
  /** Hides the card to look at the lit machine. */
  onClose: () => void;
}

/** The solved card: stars, how the solve went, and the way on. */
export function ResultCard({
  label,
  name,
  stars,
  firstRun,
  runs,
  hintsUsed,
  changes,
  par,
  tip,
  coinsEarned,
  note,
  onShare,
  teachingPoint,
  hasNext,
  finale,
  onNext,
  onReplay,
  onLevels,
  onClose,
}: Props) {
  const next = useRef<HTMLButtonElement>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
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
        <p className="eyebrow">{label} solved</p>
        <h2 id="solved-title">{name}</h2>
        <p className="stars" role="img" aria-label={`${stars} of 3 stars`}>
          {[1, 2, 3].map((i) => (
            <StarIcon key={i} filled={i <= stars} index={i} />
          ))}
        </p>
        <ul className="result-facts">
          <li className={firstRun ? 'is-yes' : ''}>
            <span aria-hidden="true">{firstRun ? '✓' : '·'}</span>
            {firstRun ? 'First Run' : runs > 1 ? `Solved in ${runs} Runs` : 'Not your first Run'}
          </li>
          <li className={hintsUsed === 0 ? 'is-yes' : ''}>
            <span aria-hidden="true">{hintsUsed === 0 ? '✓' : '·'}</span>
            {hintsUsed === 0
              ? 'No hints'
              : `${hintsUsed} ${hintsUsed === 1 ? 'hint' : 'hints'} used`}
          </li>
          <li className={changes <= par ? 'is-yes' : ''}>
            <span aria-hidden="true">{changes <= par ? '✓' : '·'}</span>
            {changes <= par
              ? `Par: ${par} ${par === 1 ? 'change' : 'changes'}`
              : `${changes} changes, par ${par}`}
          </li>
        </ul>
        {coinsEarned > 0 && (
          <p className="result-coins">
            <CoinIcon /> +{coinsText(coinsEarned)}
          </p>
        )}
        {note && <p className="result-note">{note}</p>}
        {tip && <p className="result-tip">{tip}</p>}
        <p className="result-lesson">{teachingPoint}</p>
        {finale && (
          <p className="finale">
            <strong>Every machine solved.</strong> {finale.stars} of {finale.total * 3} stars.{' '}
            {finale.stars === finale.total * 3
              ? 'Flawless.'
              : 'Replay any level to raise its stars.'}
            <span className="orb-won">
              You've won the <b>Cnmbuck Orb</b>, Cnmbuck Studios' signature ball. It's your ball now
              (change it in Settings).
            </span>
          </p>
        )}
        {onShare ? (
          <button
            type="button"
            className="run next-challenge"
            ref={next}
            onClick={() => void onShare().then(setShareNote)}
          >
            Share result
          </button>
        ) : hasNext ? (
          <button type="button" className="run next-challenge" ref={next} onClick={onNext}>
            Next challenge
          </button>
        ) : (
          <button type="button" className="run next-challenge" ref={next} onClick={onLevels}>
            Done
          </button>
        )}
        {shareNote && (
          <p className="hint-notice" role="status">
            {shareNote}
          </p>
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

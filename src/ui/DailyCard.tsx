import { STREAK_REPAIR_PRICE } from '../monetize/prices';
import type { Payment, Shop } from '../monetize/shop';
import type { DailyResult, Streak } from '../storage/daily';
import { CoinIcon, DemoNote, useShopAction } from './coins';

interface Props {
  number: number;
  /** Levels still to solve before the daily opens; 0 once it is open. */
  levelsToGo: number;
  streak: Streak;
  /** Today's result, once solved. */
  result: DailyResult | null;
  coins: number;
  shop: Shop;
  /** Hours until the next daily, rounded up. */
  hoursLeft: number;
  onPlay: () => void;
  onShare: () => Promise<string | null>;
  /** Covers yesterday's missed day; false if it could not. */
  onRepair: (paid: Payment) => boolean;
}

const days = (n: number) => `${n}-day streak`;

/** The daily puzzle on the home screen: play it, see how it went, keep the streak. */
export function DailyCard({
  number,
  levelsToGo,
  streak,
  result,
  coins,
  shop,
  hoursLeft,
  onPlay,
  onShare,
  onRepair,
}: Props) {
  const { busy, status, run } = useShopAction();
  const locked = levelsToGo > 0;

  let line: string;
  if (locked)
    line = `Opens after ${levelsToGo} more ${levelsToGo === 1 ? 'level' : 'levels'}. A new machine every day, the same for everyone.`;
  else if (result)
    line = `Solved. The next machine arrives in ${hoursLeft} ${hoursLeft === 1 ? 'hour' : 'hours'}.`;
  else if (streak.state === 'repairable')
    line = `You missed a day. Keep your ${days(streak.days)} for ${STREAK_REPAIR_PRICE} coins or a short ad, or start a new one.`;
  else if (streak.state === 'frozen')
    line = `This week’s free freeze covered the day you missed. Solve today to keep your ${days(streak.days)}.`;
  else if (streak.state === 'alive') line = `Solve today to make it a ${days(streak.days + 1)}.`;
  else line = 'A new machine every day, the same for everyone.';

  return (
    <section className={`daily${locked ? ' is-locked' : ''}`} aria-labelledby="daily-title">
      <div className="daily-head">
        <h2 id="daily-title" className="eyebrow">
          Daily puzzle #{number}
        </h2>
        {streak.days > 0 && (
          <span className="daily-streak" aria-label={days(streak.days)}>
            <FlameIcon /> {streak.days}
          </span>
        )}
      </div>
      <div className="daily-body">
        <p className="daily-line">
          {result && (
            <span className="daily-stars" role="img" aria-label={`${result.stars} of 3 stars`}>
              {'★'.repeat(result.stars)}
              <span className="dim">{'★'.repeat(3 - result.stars)}</span>{' '}
            </span>
          )}
          {line}
        </p>
        {!locked &&
          (result ? (
            <button
              type="button"
              className="ghost small"
              onClick={() => void run(onShare)}
              disabled={busy}
            >
              Share
            </button>
          ) : (
            <button
              type="button"
              className="run daily-play"
              onClick={onPlay}
              aria-label="Play the daily puzzle"
            >
              Play
            </button>
          ))}
      </div>
      {!locked && !result && streak.state === 'repairable' && (
        <>
          {shop.demo && <DemoNote />}
          <div className="shop-list daily-repair">
            <button
              type="button"
              className="shop-item"
              disabled={busy || coins < STREAK_REPAIR_PRICE}
              onClick={() => void run(async () => (onRepair('coins') ? 'Streak saved.' : null))}
            >
              <span className="shop-name">Repair streak</span>
              <span className="shop-price">
                <CoinIcon /> {STREAK_REPAIR_PRICE}
              </span>
            </button>
            <button
              type="button"
              className="shop-item"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (!(await shop.watchAd())) return 'The ad didn’t finish. Try again.';
                  return onRepair('ad') ? 'Streak saved.' : null;
                })
              }
            >
              <span className="shop-name">Repair with a short ad</span>
              <span className="shop-price">Free</span>
            </button>
          </div>
        </>
      )}
      {status && (
        <p className="hint-notice" role="status">
          {status}
        </p>
      )}
    </section>
  );
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M8 1.5c.6 2.3 3.9 3.9 3.9 7.4A3.9 3.9 0 0 1 8 12.8a3.9 3.9 0 0 1-3.9-3.9c0-1.6.8-2.6 1.6-3.4.1 1.1.6 1.9 1.4 2.3C7 6 7.3 3.6 8 1.5z"
        fill="currentColor"
      />
    </svg>
  );
}

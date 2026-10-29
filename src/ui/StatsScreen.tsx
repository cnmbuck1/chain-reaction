import { useState } from 'react';
import type { LevelDef } from '../engine/types';
import {
  AD_PLACEMENTS,
  DAILY_KEY,
  emptyLevelStats,
  funnel,
  stuckLevels,
  type AdPlacement,
  type LevelStats,
  type Metrics,
} from '../storage/metrics';

interface Props {
  metrics: Metrics;
  levels: readonly LevelDef[];
  onClear: () => void;
  onBack: () => void;
}

const placementName: Record<AdPlacement, string> = {
  hint: 'Hint panel',
  retry: 'Retry panel',
  shop: 'Coin shop',
  repair: 'Streak repair',
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** For playtests: the play stats this device has counted, and a way to send them on. */
export function StatsScreen({ metrics, levels, onClear, onBack }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const rows = funnel(
    metrics,
    levels.map((l) => l.id),
  );
  const number = new Map(levels.map((l, i) => [l.id, i + 1]));
  const name = new Map(levels.map((l) => [l.id, l.name]));
  // Every level opened so far, and the first one not yet opened, where the funnel ends.
  const lastReached = rows.findLastIndex((r) => r.reached);
  const shown = rows.slice(0, Math.min(rows.length, lastReached + 2));
  const stuck = stuckLevels(rows);
  const daily = metrics.levels[DAILY_KEY] ?? emptyLevelStats();
  const all = Object.values(metrics.levels);
  const sum = (pick: (s: LevelStats) => number) => all.reduce((n, s) => n + pick(s), 0);
  const solvedLevels = rows.filter((r) => r.stats.solves > 0).length;
  const purchases = Object.entries(metrics.purchases);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(metrics, null, 2));
      setCopyNote('Copied. Paste it into a message to send it on.');
    } catch {
      setCopyNote('Copying isn’t available here.');
    }
  };

  return (
    <main className="select stats">
      <header className="settings-top">
        <button type="button" className="ghost" onClick={onBack}>
          ‹ Settings
        </button>
        <h1>Play stats</h1>
      </header>
      <p className="tagline">
        Counted on this device since{' '}
        {new Date(metrics.since).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.
        Nothing is sent anywhere.
      </p>

      <section aria-label="Totals">
        <dl className="stat-tiles">
          <Tile label="Days played" value={metrics.days.length} />
          <Tile label="Sessions" value={metrics.sessions} />
          <Tile label="Levels solved" value={`${solvedLevels}/${levels.length}`} />
          <Tile label="Runs" value={sum((s) => s.runs)} />
          <Tile label="Hints" value={sum((s) => s.hints)} />
          <Tile label="Retries bought" value={sum((s) => s.retries)} />
        </dl>
      </section>

      <section className="stats-section" aria-labelledby="stuck-title">
        <h2 id="stuck-title" className="chapter-head">
          Hardest levels
        </h2>
        {stuck.length === 0 ? (
          <p className="chapter-intro">No missed Runs or quits yet.</p>
        ) : (
          <ol className="stuck-list">
            {stuck.map((r) => (
              <li key={r.id}>
                <strong>
                  Level {number.get(r.id)} · {name.get(r.id)}
                </strong>
                <span>
                  {plural(r.stats.quits, 'quit')}, {plural(r.stats.misses, 'missed Run')}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="stats-section" aria-labelledby="funnel-title">
        <h2 id="funnel-title" className="chapter-head">
          Level by level
        </h2>
        <p className="chapter-intro">
          Runs, misses, hints, retries bought and quits. First is the Runs and stars of the first
          solve.
        </p>
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">Level</th>
                <th scope="col">Runs</th>
                <th scope="col">Miss</th>
                <th scope="col">Hint</th>
                <th scope="col">Retry</th>
                <th scope="col">Quit</th>
                <th scope="col">First</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className={r.reached ? '' : 'is-unreached'}>
                  <th scope="row">{number.get(r.id)}</th>
                  <Counts stats={r.stats} />
                  <td>{firstSolve(r.stats.first, r.reached)}</td>
                </tr>
              ))}
              {daily.starts > 0 && (
                <tr className="is-daily">
                  <th scope="row">Daily</th>
                  <Counts stats={daily} />
                  <td>{plural(daily.solves, 'solve')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stats-section" aria-labelledby="ads-title">
        <h2 id="ads-title" className="chapter-head">
          Ads and purchases
        </h2>
        <ul className="stats-lines">
          {AD_PLACEMENTS.map((p) => (
            <li key={p}>
              <span>{placementName[p]}</span>
              <span>
                {p === 'repair' ? '' : `${metrics.ads[p].offered} offered, `}
                {metrics.ads[p].watched} watched
              </span>
            </li>
          ))}
          <li>
            <span>Between levels</span>
            <span>{plural(metrics.between.closed, 'ad')} shown</span>
          </li>
          <li>
            <span>Purchases</span>
            <span>
              {purchases.length === 0
                ? 'none'
                : purchases.map(([item, n]) => `${item} ×${n}`).join(', ')}
            </span>
          </li>
        </ul>
      </section>

      <div className="card-actions even stats-actions">
        <button type="button" onClick={copy}>
          Copy stats
        </button>
        <button type="button" className="ghost danger" onClick={() => setConfirming(true)}>
          Clear stats
        </button>
      </div>
      <p className="chapter-intro" role="status">
        {copyNote}
      </p>

      {confirming && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="clear-title">
          <div className="card">
            <p className="eyebrow">Play stats</p>
            <h2 id="clear-title">Clear the stats?</h2>
            <p>Counting starts again from now. Progress, coins and settings stay as they are.</p>
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
                  onClear();
                  setConfirming(false);
                  setCopyNote('Stats cleared.');
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat-tile">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Counts({ stats }: { stats: LevelStats }) {
  return (
    <>
      <td>{stats.runs}</td>
      <td>{stats.misses}</td>
      <td>{stats.hints}</td>
      <td>{stats.retries}</td>
      <td>{stats.quits}</td>
    </>
  );
}

function firstSolve(first: LevelStats['first'], reached: boolean) {
  if (!first) return reached ? 'not yet' : '';
  return `${first.runs} · ${'★'.repeat(first.stars)}`;
}

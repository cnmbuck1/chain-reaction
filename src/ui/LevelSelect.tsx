import type { LevelDef } from '../engine/types';
import { chaptersFor } from '../levels/chapters';
import { isUnlocked, totalStars, type Progress } from '../storage/progress';

interface Props {
  levels: readonly LevelDef[];
  progress: Progress;
  /** Testing aid: treat every level as open. */
  unlockAll?: boolean;
  onPlay: (index: number) => void;
  onSettings: () => void;
}

export function LevelSelect({ levels, progress, unlockAll = false, onPlay, onSettings }: Props) {
  const ids = levels.map((l) => l.id);
  const isOpen = (i: number) => unlockAll || isUnlocked(ids, progress, i);
  const solved = ids.filter((id) => id in progress.completed).length;
  const stars = totalStars(ids, progress);
  const next = ids.findIndex((id) => !(id in progress.completed));
  const chapters = chaptersFor(levels);
  // The first locked level, previewed so the player can see what's coming.
  const teaser = ids.findIndex((_, i) => !isOpen(i));
  const teaserChapter = chapters.find((c) => c.indexes[0] === teaser)?.chapter;

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
        <p className="star-total" aria-label={`${stars} of ${levels.length * 3} stars`}>
          <span aria-hidden="true">★</span> {stars}
          <span className="dim"> / {levels.length * 3}</span>
        </p>
      </header>

      {next !== -1 && (
        <button type="button" className="run continue" onClick={() => onPlay(next)}>
          {solved === 0 ? 'Start' : 'Continue'}
          <span className="continue-level">
            Level {next + 1} · {levels[next]!.name}
          </span>
        </button>
      )}

      {chapters.map(({ chapter, indexes }) => {
        const open = isOpen(indexes[0]!);
        const got = indexes.reduce((n, i) => n + (progress.completed[ids[i]!]?.stars ?? 0), 0);
        return (
          <section key={chapter.id} className={`chapter${open ? '' : ' is-locked'}`}>
            <h2 className="chapter-head">
              <span>{chapter.name}</span>
              <span className="chapter-stars" aria-label={`${got} of ${indexes.length * 3} stars`}>
                ★ {got}/{indexes.length * 3}
              </span>
            </h2>
            {!open && <p className="chapter-intro">Coming up: {chapter.intro}</p>}
            <ol className="level-grid">
              {indexes.map((i) => {
                const level = levels[i]!;
                const unlocked = isOpen(i);
                const record = progress.completed[level.id];
                return (
                  <li key={level.id}>
                    <button
                      type="button"
                      className={`level-tile${record ? ' solved' : ''}${unlocked ? '' : ' locked'}${i === next ? ' is-next' : ''}`}
                      disabled={!unlocked}
                      onClick={() => onPlay(i)}
                      aria-label={`Level ${i + 1}, ${level.name}${record ? `, solved, ${record.stars} of 3 stars` : unlocked ? '' : ', locked'}`}
                    >
                      <span className="tile-num" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className="tile-state" aria-hidden="true">
                        {record ? (
                          <span className="mini-stars">
                            {'★'.repeat(record.stars)}
                            <span className="dim">{'☆'.repeat(3 - record.stars)}</span>
                          </span>
                        ) : unlocked ? (
                          'Play'
                        ) : (
                          <LockIcon />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      {teaser !== -1 && (
        <aside className="teaser" aria-label="Next machine">
          <p className="eyebrow">Next machine · Level {teaser + 1}</p>
          <p className="teaser-name">{levels[teaser]!.name}</p>
          <p className="teaser-text">
            {teaserChapter
              ? `New: ${teaserChapter.intro}.`
              : `Opens when you solve level ${teaser}.`}
          </p>
        </aside>
      )}
    </main>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

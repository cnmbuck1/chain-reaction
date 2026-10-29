import { useEffect, useMemo, useRef, useState } from 'react';
import { runSounds } from '../audio/cues';
import { buzz, type Sound } from '../audio/sound';
import { indexLevel, switchStage } from '../engine/graph';
import { changesUsed, initialState, step } from '../engine/reducer';
import { solve } from '../engine/solver';
import type { GameAction, GameState, LevelDef, RejectReason } from '../engine/types';
import { freeMovePlan, withFreeMoves } from '../hints/freeMoves';
import { FULL_RUNS } from '../storage/wallet';
import { HINT_PRICE } from '../monetize/prices';
import type { Payment, Shop } from '../monetize/shop';
import { buildTimeline, INSTANT_TIMING, NORMAL_TIMING } from '../render/timeline';
import { BoardView, type RunPlayback } from './BoardView';
import { explainRun, gateRequirement, nodeName, partName, rejectMessage } from './describe';
import { nextStarTip, starsFor, type Solve, type Stars } from '../game/scoring';
import { CoinChip, CoinIcon } from './coins';
import { HintPanel } from './HintPanel';
import { RetryPanel } from './RetryPanel';
import { ResultCard } from './ResultCard';

interface Props {
  level: LevelDef;
  /** "Level 12", or "Daily #4". */
  label: string;
  hasNext: boolean;
  /** Set on the last level: how the whole run of levels went, for the closing card. */
  finale: { stars: number; total: number } | null;
  reducedMotion: boolean;
  sound: Sound;
  haptics: boolean;
  coins: number;
  shop: Shop;
  /** Opens the coin shop over the game. */
  onShop: () => void;
  hints: {
    /** Free moves already used on this level. */
    used: number;
    free: boolean;
    /** Pays for the next free move (passing over `moves - 1` stale ones); false if it could not. */
    onUse: (moves: number, paid: Payment | 'free') => boolean;
  };
  /** Runs left before a retry must be bought; null on levels with unlimited retries. */
  retries: {
    left: number;
    /** A Run missed and used up one of the level's Runs. */
    onMiss: () => void;
    /** Pays for one more Run; false if it could not. */
    onBuy: (paid: Payment) => boolean;
  } | null;
  showIntro: boolean;
  onIntroDone: () => void;
  /** This level's first Run is still unspent, so this visit can earn three stars. */
  firstRunOpen: boolean;
  /** The first Run is spent: a Run ended, or the player reset or left after clearing a part. */
  onFirstRunUsed: () => void;
  /** Saves the win; returns the coins it earned and a line for the result card, if any. */
  onSolved: (win: { stars: Stars; attempts: number; changes: number }) => {
    coins: number;
    note?: string;
  };
  /** Daily puzzles: shares the result from the result card. */
  onShare?: () => Promise<string | null>;
  onNext: () => void;
  /** Plays this level again from the start. */
  onReplay: () => void;
  onLevels: () => void;
  /** For play stats: the player left by the back button before solving. */
  onQuit?: () => void;
  /** For play stats: a Run ended (not one that only cleared a part). */
  onRunEnded?: (won: boolean) => void;
  /** For play stats: a panel offering a rewarded ad opened. */
  onAdOffered?: (panel: 'hint' | 'retry') => void;
}

export function GameScreen({
  level: baseLevel,
  label,
  hasNext,
  finale,
  reducedMotion,
  sound,
  haptics,
  coins,
  shop,
  onShop,
  hints,
  retries,
  showIntro,
  onIntroDone,
  firstRunOpen,
  onFirstRunUsed,
  onSolved,
  onShare,
  onNext,
  onReplay,
  onLevels,
  onRunEnded,
  onAdOffered,
  onQuit,
}: Props) {
  // Free moves from hints are baked into the level: hinted switches start set and locked.
  const level = useMemo(() => withFreeMoves(baseLevel, hints.used), [baseLevel, hints.used]);
  const plan = freeMovePlan(baseLevel);
  const partOf = (id: string) => switchStage(indexLevel(level).nodes.get(id)!);
  const [state, setState] = useState<GameState>(() => initialState(level));
  const [justHinted, setJustHinted] = useState<string | null>(null);
  const [playback, setPlayback] = useState<RunPlayback | null>(null);
  const [playing, setPlaying] = useState(false);
  // On a run that clears a part, the view follows the ball down into the next part.
  const [followed, setFollowed] = useState(false);
  const follow = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(follow.current), []);
  const [notice, setNotice] = useState<RejectReason | null>(null);
  const [panel, setPanel] = useState<'hint' | 'retry' | null>(null);
  // The level's tip stands in for the status line until the first switch change.
  const [promptOpen, setPromptOpen] = useState(true);

  const useHint = (paid: Payment | 'free') => {
    // Moves for a part already cleared are no use now, so the hint passes over them.
    let skip = 0;
    while (plan[hints.used + skip] && partOf(plan[hints.used + skip]!.switchId) < state.stage) {
      skip++;
    }
    const move = plan[hints.used + skip];
    if (!move || playing || !hints.onUse(skip + 1, paid)) return;
    setState((s) => ({
      ...s,
      switches: { ...s.switches, [move.switchId]: move.on },
      undoStack: s.undoStack.filter((id) => id !== move.switchId),
    }));
    setPlayback(null);
    setNotice(null);
    setPanel(null);
    setJustHinted(move.switchId);
    sound.play('chime');
    if (haptics) buzz([12, 60, 12]);
  };
  const runId = useRef(0);
  // Completion is reported once per visit, however playback ends (finished, skipped).
  const solvedRef = useRef(false);
  const [skipToken, setSkipToken] = useState(0);
  const [resultOpen, setResultOpen] = useState(true);
  // Read once: spending the first Run mid-visit must not change what this visit can earn.
  const [firstRunLive, setFirstRunLive] = useState(firstRunOpen);
  const [solved, setSolved] = useState<Solve | null>(null);
  const [reward, setReward] = useState<{ coins: number; note?: string }>({ coins: 0 });

  // Leaving after clearing a part spends the first Run, as a Reset would; otherwise
  // backing out would dodge a part cleared the wrong way.
  const leaving = useRef({ partCleared: false, onFirstRunUsed });
  useEffect(() => {
    leaving.current = {
      partCleared: state.stage > 0 && state.phase !== 'won',
      onFirstRunUsed,
    };
  });
  useEffect(
    () => () => {
      if (leaving.current.partCleared) leaving.current.onFirstRunUsed();
    },
    [],
  );

  const won = state.phase === 'won' && !playing;

  /** Jumps the run to its last frame; the outcome is already decided. */
  const skip = () => {
    if (!playing) return;
    window.clearTimeout(follow.current);
    sound.stopAll();
    if (state.phase === 'won') sound.play('chime');
    setSkipToken((n) => n + 1);
  };

  // Leaving the level silences any run still sounding.
  useEffect(() => () => sound.stopAll(), [sound]);

  /** `paidRun` is a Run the player just bought, so the out-of-Runs check is already passed. */
  const dispatch = (action: GameAction, paidRun = false) => {
    if (playing) return;
    sound.unlock();
    if (action.type === 'run' && !paidRun && retries?.left === 0) {
      setPanel('retry');
      onAdOffered?.('retry');
      return;
    }
    const result = step(level, state, action);
    setNotice(result.rejected ?? null);
    if (result.rejected) {
      sound.play('deny');
      if (haptics) buzz([30, 40, 30]);
      return;
    }
    setState(result.state);
    const ended = action.type === 'run' && result.state.lastRun?.outcome.kind !== 'checkpoint';
    if (ended) onRunEnded?.(result.state.lastRun?.won ?? false);
    if (ended && !result.state.lastRun?.won) retries?.onMiss();
    if (ended || (action.type === 'reset' && state.stage > 0)) {
      onFirstRunUsed();
      if (!result.state.lastRun?.won || action.type === 'reset') setFirstRunLive(false);
    }
    if (action.type === 'toggle') {
      sound.play('click');
      if (haptics) buzz(12);
    } else if (action.type !== 'run') {
      sound.play('click');
    }
    if (action.type === 'run') {
      const timing = reducedMotion ? INSTANT_TIMING : NORMAL_TIMING;
      const timeline = buildTimeline(result.events, timing);
      sound.schedule(runSounds(timeline));
      window.clearTimeout(follow.current);
      setFollowed(false);
      if (result.state.stage > state.stage) {
        // Pan as the ball drops off the bottom of the part it just cleared.
        const drop = timeline.cues.filter((c) => c.kind === 'ball').at(-1);
        const at = drop ? drop.at + drop.dur / 2 : 0;
        follow.current = window.setTimeout(() => setFollowed(true), at);
      }
      runId.current += 1;
      setPlayback({ id: runId.current, events: result.events, stage: state.stage });
      setPlaying(true);
    } else {
      setPlayback(null);
    }
  };

  const onPlayed = (id: number) => {
    if (id !== runId.current) return;
    setPlaying(false);
    if (state.phase !== 'won' || solvedRef.current) return;
    solvedRef.current = true;
    if (haptics) buzz([20, 50, 20, 50, 60]);
    const facts: Solve = {
      hintsUsed: hints.used,
      firstRun: firstRunLive && state.attempt === 1,
      changes: used,
      par,
    };
    setSolved(facts);
    setResultOpen(true);
    setReward(onSolved({ stars: starsFor(facts), attempts: state.attempt, changes: used }));
  };

  // Changes over the whole machine; hinted switches start where the hint set them.
  const used = changesUsed(level, state.switches);
  const par = baseLevel.meta.minChanges;
  const lastRun = state.lastRun;
  const missed = lastRun !== null && !lastRun.won && lastRun.outcome.kind !== 'checkpoint';
  const staged = indexLevel(level).checkpoints.length > 0;
  // On a staged board, how an earlier part was cleared can leave a later one unsolvable.
  const stuck = useMemo(() => state.stage > 0 && !solve(level, state).solvable, [level, state]);
  // After a miss, until a switch changes, the part that stopped the ball stays marked.
  const showingMiss = !playing && playback !== null && missed;
  const stoppedAt =
    showingMiss && lastRun?.outcome.kind === 'blocked'
      ? lastRun.outcome.gateId
      : showingMiss && lastRun?.outcome.kind === 'locked'
        ? lastRun.outcome.nodeId
        : showingMiss && lastRun?.outcome.kind === 'deadEnd'
          ? (lastRun.events.findLast((e) => e.type === 'junction')?.nodeId ?? null)
          : null;

  // Once a Run has missed here, the Run button carries the retries left.
  const retryNote =
    retries && retries.left < FULL_RUNS
      ? retries.left === 0
        ? 'No free retries left'
        : `${retries.left} ${retries.left === 1 ? 'retry' : 'retries'} left`
      : null;

  let status: string;
  if (notice) status = rejectMessage[notice];
  else if (playing) status = 'Running… Tap the board to skip.';
  else if (lastRun && playback && missed && stuck)
    status = `${explainRun(level, lastRun)} ${partName(state.stage - 1)}'s switches leave no way through here. Reset to try another way.`;
  else if (lastRun && playback) status = explainRun(level, lastRun);
  else if (lastRun) status = 'Switches changed. Run again when ready.';
  else if (promptOpen && level.meta.prompt) status = level.meta.prompt;
  else status = 'Set the switches, then press Run.';

  const wiring = level.signalEdges
    .map((e) => {
      const to = level.nodes.find((n) => n.id === e.to);
      const req = to?.type === 'gate' ? ` (needs ${gateRequirement(level, e.to)})` : '';
      return `${nodeName(level, e.from)} to ${e.invert ? 'NOT ' : ''}${nodeName(level, e.to)}${req}`;
    })
    .concat(
      level.nodes.flatMap((n) =>
        n.type === 'switch' && n.turns
          ? [
              `gear: turning ${nodeName(level, n.id)} also turns ${n.turns.map((id) => nodeName(level, id)).join(' and ')}`,
            ]
          : n.type === 'trip'
            ? [
                `trip plate on the track: it flips ${nodeName(level, n.flips)} as the ball rolls over`,
              ]
            : [],
      ),
    )
    .join('; ');

  return (
    <main className="game">
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="ghost back"
            onClick={() => {
              if (state.phase !== 'won') onQuit?.();
              onLevels();
            }}
            aria-label="Levels"
          >
            ‹ <span className="back-text">Levels</span>
          </button>
          <CoinChip coins={coins} onShop={onShop} />
        </div>
        <div className="title">
          <span className="eyebrow">
            {label}
            {staged && ` · ${partName(state.stage)}`}
          </span>
          <h1>{level.name}</h1>
        </div>
        <div className="meter" aria-label={`Changes ${used}, par ${par}`}>
          <span className="meter-label">Changes</span>
          <span className="pips" aria-hidden="true">
            {Array.from({ length: par }, (_, i) => (
              <span key={i} className={i < used ? 'pip used' : 'pip'} />
            ))}
          </span>
          <span className={`meter-count${used > par ? ' over' : ''}`}>
            {used}
            <span className="meter-par"> · par {par}</span>
          </span>
        </div>
      </header>

      <p className="sr-only">Wiring: {wiring}.</p>
      <BoardView
        level={level}
        state={state}
        playback={playback}
        stage={playing && playback ? playback.stage + (followed ? 1 : 0) : state.stage}
        reducedMotion={reducedMotion}
        locked={playing || state.phase === 'won'}
        justHinted={justHinted}
        stoppedAt={stoppedAt}
        skipToken={skipToken}
        onSkip={playing ? skip : undefined}
        onToggle={(switchId) => {
          setPromptOpen(false);
          dispatch({ type: 'toggle', switchId });
        }}
        onPlayed={onPlayed}
      />

      <div className="status-row">
        <p
          className={`status ${notice ? 'warn' : !playing && playback && missed ? 'fail' : ''}`}
          role="status"
          aria-live="polite"
        >
          {status}
        </p>
        {!won && (
          <button
            type="button"
            className="ghost small hint-button"
            onClick={() => {
              setPanel('hint');
              if (!hints.free && plan.length > hints.used) onAdOffered?.('hint');
            }}
            disabled={playing}
            aria-label={`Hint, ${hints.free ? 'free on this level' : `${HINT_PRICE} coins`}`}
          >
            Hint
            <span className="hint-badge" aria-hidden="true">
              {hints.free ? (
                'free'
              ) : (
                <>
                  <CoinIcon size={12} />
                  {HINT_PRICE}
                </>
              )}
            </span>
          </button>
        )}
      </div>

      <div className="controls">
        <button
          type="button"
          onClick={() => dispatch({ type: 'undo' })}
          disabled={playing || won || state.undoStack.length === 0}
        >
          Undo
        </button>
        <button type="button" onClick={() => dispatch({ type: 'reset' })} disabled={playing || won}>
          Reset
        </button>
        {playing ? (
          <button type="button" className="run" onClick={skip}>
            Skip
          </button>
        ) : won ? (
          <button type="button" className="run" onClick={() => setResultOpen(true)}>
            Result
          </button>
        ) : (
          <button
            type="button"
            className="run run-button"
            onClick={() => dispatch({ type: 'run' })}
            aria-describedby={retryNote ? 'retries-left' : undefined}
          >
            {showingMiss ? 'Retry' : 'Run'}
            {retryNote && (
              <span className="run-badge" aria-hidden="true">
                {retries!.left > 0 ? retries!.left : '+'}
              </span>
            )}
          </button>
        )}
      </div>

      {showIntro && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="intro-title">
          <div className="card">
            <p className="eyebrow">How it works</p>
            <h2 id="intro-title">Get the ball to the goal</h2>
            <ol className="steps">
              <li>
                <strong>Switches send power</strong> down their wires. Lit wires carry power; each
                switch has its own color.
              </li>
              <li>
                <strong>Gates show what they need.</strong> <em>ON</em> opens with power.{' '}
                <em>OFF</em> opens only without power. The letters on a gate are the switches
                feeding it.
              </li>
              <li>
                <strong>Press Run.</strong> The ball rolls until it reaches the goal or a closed
                gate. Plan first: a first-Run solve with the fewest changes earns three stars.
              </li>
            </ol>
            <div className="card-actions single">
              <button type="button" className="run" autoFocus onClick={onIntroDone}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {retryNote && (
        <span id="retries-left" className="sr-only">
          {retryNote}
        </span>
      )}

      {panel === 'hint' && !won && (
        <HintPanel
          remaining={plan.length - hints.used}
          free={hints.free}
          coins={coins}
          shop={shop}
          onUse={useHint}
          onShop={onShop}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === 'retry' && retries && !won && (
        <RetryPanel
          coins={coins}
          shop={shop}
          onRetry={(paid) => {
            if (!retries.onBuy(paid)) return;
            setPanel(null);
            dispatch({ type: 'run' }, true);
          }}
          onShop={onShop}
          onClose={() => setPanel(null)}
        />
      )}

      {won && resultOpen && solved && (
        <ResultCard
          label={label}
          name={level.name}
          stars={starsFor(solved)}
          firstRun={solved.firstRun}
          runs={state.attempt}
          hintsUsed={solved.hintsUsed}
          changes={solved.changes}
          par={solved.par}
          tip={nextStarTip(solved)}
          coinsEarned={reward.coins}
          note={reward.note}
          onShare={onShare}
          teachingPoint={level.meta.teachingPoint}
          hasNext={hasNext}
          finale={finale}
          onNext={onNext}
          onReplay={onReplay}
          onLevels={onLevels}
          onClose={() => setResultOpen(false)}
        />
      )}
    </main>
  );
}

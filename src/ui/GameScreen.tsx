import { useEffect, useRef, useState } from 'react';
import { runSounds } from '../audio/cues';
import { buzz, type Sound } from '../audio/sound';
import { changesUsed, initialState, step } from '../engine/reducer';
import type { GameAction, GameState, LevelDef, RejectReason } from '../engine/types';
import { buildTimeline, INSTANT_TIMING, NORMAL_TIMING } from '../render/timeline';
import { BoardView, type RunPlayback } from './BoardView';
import { explainRun, gateRequirement, nodeName, rejectMessage } from './describe';

interface Props {
  level: LevelDef;
  number: number;
  hasNext: boolean;
  reducedMotion: boolean;
  sound: Sound;
  soundOn: boolean;
  haptics: boolean;
  onToggleSound: () => void;
  showIntro: boolean;
  onIntroDone: () => void;
  onSolved: (attempts: number) => void;
  onNext: () => void;
  onLevels: () => void;
}

export function GameScreen({
  level,
  number,
  hasNext,
  reducedMotion,
  sound,
  soundOn,
  haptics,
  onToggleSound,
  showIntro,
  onIntroDone,
  onSolved,
  onNext,
  onLevels,
}: Props) {
  const [state, setState] = useState<GameState>(() => initialState(level));
  const [playback, setPlayback] = useState<RunPlayback | null>(null);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<RejectReason | null>(null);
  const [showHint, setShowHint] = useState(false);
  const runId = useRef(0);
  const nextButton = useRef<HTMLButtonElement>(null);

  const won = state.phase === 'won' && !playing;
  useEffect(() => {
    if (won) nextButton.current?.focus();
  }, [won]);

  // Leaving the level silences any run still sounding.
  useEffect(() => () => sound.stopAll(), [sound]);

  const dispatch = (action: GameAction) => {
    if (playing) return;
    sound.unlock();
    const result = step(level, state, action);
    setNotice(result.rejected ?? null);
    if (result.rejected) {
      sound.play('deny');
      if (haptics) buzz([30, 40, 30]);
      return;
    }
    setState(result.state);
    if (action.type === 'toggle') {
      sound.play('click');
      if (haptics) buzz(12);
    } else if (action.type !== 'run') {
      sound.play('click');
    }
    if (action.type === 'run') {
      const timing = reducedMotion ? INSTANT_TIMING : NORMAL_TIMING;
      sound.schedule(runSounds(buildTimeline(result.events, timing)));
      runId.current += 1;
      setPlayback({ id: runId.current, events: result.events });
      setPlaying(true);
    } else {
      setPlayback(null);
    }
  };

  const onPlayed = (id: number) => {
    if (id !== runId.current) return;
    setPlaying(false);
    if (state.phase === 'won') onSolved(state.attempt);
  };

  const used = changesUsed(level, state.switches);
  const lastRun = state.lastRun;

  let status: string;
  if (notice) status = rejectMessage[notice];
  else if (playing) status = 'Running…';
  else if (lastRun && playback) status = explainRun(level, lastRun);
  else if (lastRun) status = 'Switches changed. Run again when ready.';
  else status = 'Set the switches, then press Run.';

  const wiring = level.signalEdges
    .map((e) => {
      const to = level.nodes.find((n) => n.id === e.to);
      const req = to?.type === 'gate' ? ` (needs ${gateRequirement(level, e.to)})` : '';
      return `${nodeName(level, e.from)} to ${e.invert ? 'NOT ' : ''}${nodeName(level, e.to)}${req}`;
    })
    .join('; ');

  return (
    <main className="game">
      <header className="topbar">
        <div className="topbar-left">
          <button type="button" className="ghost back" onClick={onLevels} aria-label="Levels">
            ‹ <span className="back-text">Levels</span>
          </button>
          <button
            type="button"
            className="ghost icon"
            onClick={onToggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Sound on' : 'Sound off'}
          >
            <SpeakerIcon muted={!soundOn} />
          </button>
        </div>
        <div className="title">
          <span className="eyebrow">Level {number}</span>
          <h1>{level.name}</h1>
        </div>
        <div className="meter" aria-label={`Changes used ${used} of ${level.maxToggles}`}>
          <span className="meter-label">Changes</span>
          <span className="pips" aria-hidden="true">
            {Array.from({ length: level.maxToggles }, (_, i) => (
              <span key={i} className={i < used ? 'pip used' : 'pip'} />
            ))}
          </span>
          <span className="meter-count">
            {used}/{level.maxToggles}
          </span>
        </div>
      </header>

      {level.meta.prompt && <p className="prompt">{level.meta.prompt}</p>}

      <p className="sr-only">Wiring: {wiring}.</p>
      <BoardView
        level={level}
        state={state}
        playback={playback}
        reducedMotion={reducedMotion}
        locked={playing || state.phase === 'won'}
        onToggle={(switchId) => dispatch({ type: 'toggle', switchId })}
        onPlayed={onPlayed}
      />

      <div className="status-row">
        <p
          className={`status ${notice ? 'warn' : lastRun && !playing && playback && !lastRun.won ? 'fail' : ''}`}
          role="status"
          aria-live="polite"
        >
          {status}
        </p>
        {lastRun && !lastRun.won && !playing && (
          <button type="button" className="ghost small" onClick={() => setShowHint((v) => !v)}>
            {showHint ? 'Hide hint' : 'Hint'}
          </button>
        )}
      </div>
      {showHint && <p className="hint">{level.meta.hint}</p>}

      <div className="controls">
        <button
          type="button"
          onClick={() => dispatch({ type: 'undo' })}
          disabled={playing || won || state.undoStack.length === 0}
        >
          Undo
        </button>
        <button type="button" onClick={() => dispatch({ type: 'reset' })} disabled={playing}>
          Reset
        </button>
        <button
          type="button"
          className="run"
          onClick={() => dispatch({ type: 'run' })}
          disabled={playing || won}
        >
          Run
        </button>
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
                gate. Changes are limited, so plan first.
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

      {won && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="solved-title">
          <div className="card">
            <p className="eyebrow">Level {number} solved</p>
            <h2 id="solved-title">{level.name}</h2>
            <p>
              {state.attempt === 1
                ? 'Solved on the first run.'
                : `Solved in ${state.attempt} runs.`}{' '}
              {level.meta.teachingPoint}
            </p>
            <div className="card-actions">
              <button type="button" className="ghost" onClick={onLevels}>
                Levels
              </button>
              {hasNext ? (
                <button type="button" className="run" ref={nextButton} onClick={onNext}>
                  Next level
                </button>
              ) : (
                <button type="button" className="run" ref={nextButton} onClick={onLevels}>
                  Done
                </button>
              )}
            </div>
            {!hasNext && (
              <p className="fine">That's every level in this build. More are on the way.</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {muted ? (
        <path
          d="M16 9l5 6M21 9l-5 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}

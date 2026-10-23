import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { canToggle } from '../engine/reducer';
import type { GameState, LevelDef, RunEvent } from '../engine/types';
import { Board, BOARD_PAD } from '../render/board';
import { signalColor } from '../render/colors';
import { INSTANT_TIMING, NORMAL_TIMING } from '../render/timeline';
import { gateRequirement, nodeName } from './describe';

export interface RunPlayback {
  id: number;
  events: readonly RunEvent[];
}

interface Props {
  level: LevelDef;
  state: GameState;
  /** The run to show; null shows the idle machine. */
  playback: RunPlayback | null;
  reducedMotion: boolean;
  locked: boolean;
  /** The switch a hint just set, for a one-off flourish. */
  justHinted?: string | null;
  onToggle: (switchId: string) => void;
  onPlayed: (id: number) => void;
}

const place = (x: number, y: number) =>
  ({ '--x': x, '--y': y, '--pad': `${BOARD_PAD}px` }) as CSSProperties;

/** The Pixi machine plus DOM overlays for switches and labels. */
export function BoardView({
  level,
  state,
  playback,
  reducedMotion,
  locked,
  justHinted,
  onToggle,
  onPlayed,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<Board | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const onPlayedRef = useRef(onPlayed);
  useEffect(() => {
    onPlayedRef.current = onPlayed;
  });

  useEffect(() => {
    const board = new Board();
    boardRef.current = board;
    let live = true;
    board.init(hostRef.current!).then(
      () => live && setReady(true),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
      boardRef.current = null;
      setReady(false);
      board.destroy();
    };
  }, [tries]);

  useEffect(() => {
    if (ready) boardRef.current?.setLevel(level);
  }, [ready, level]);

  useEffect(() => {
    if (ready) boardRef.current?.setReducedMotion(reducedMotion);
  }, [ready, reducedMotion]);

  // Live wire power before a run. Kept apart from playback so toggling never restarts a run.
  const switches = state.switches;
  useEffect(() => {
    if (ready && !playback) boardRef.current?.showIdle(switches);
  }, [ready, level, playback, switches]);

  useEffect(() => {
    const board = boardRef.current;
    if (!ready || !board) return;
    if (!playback) return;
    let live = true;
    void board
      .play(playback.events, reducedMotion ? INSTANT_TIMING : NORMAL_TIMING)
      .then(() => live && onPlayedRef.current(playback.id));
    return () => {
      live = false;
    };
  }, [ready, level, playback, reducedMotion]);

  if (failed) {
    return (
      <div className="board board-failed" role="alert">
        <p>
          <strong>The machine couldn't start.</strong> This browser may have graphics acceleration
          turned off.
        </p>
        <button
          type="button"
          className="ghost small"
          onClick={() => {
            setFailed(false);
            setTries((n) => n + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="board" ref={hostRef} data-ready={ready}>
      {level.nodes.map((node) => {
        const style = place(node.x, node.y);
        switch (node.type) {
          case 'switch': {
            const on = state.switches[node.id] ?? false;
            const changed = on !== node.initialOn;
            const hinted = node.locked === true;
            const blocked = !locked && !hinted && !canToggle(level, state, node.id);
            return (
              <button
                key={node.id}
                type="button"
                className={`switch ${on ? 'is-on' : 'is-off'}${blocked ? ' is-blocked' : ''}${hinted ? ' is-hinted' : ''}${node.id === justHinted ? ' just-hinted' : ''}`}
                style={{ ...style, '--swatch': signalColor(level, node.id) } as CSSProperties}
                aria-pressed={on}
                aria-disabled={locked || blocked || hinted}
                aria-label={`Switch ${nodeName(level, node.id)}, ${on ? 'on' : 'off'}${changed ? ', changed' : ''}${hinted ? ', set by a hint' : ''}${blocked ? ', no changes left' : ''}`}
                onClick={() => !locked && onToggle(node.id)}
              >
                <span className="switch-name">{nodeName(level, node.id)}</span>
                <span className="lever" aria-hidden="true">
                  <span className="rod">
                    <span className="knob" />
                  </span>
                </span>
                <span className="switch-state">
                  <span className="lamp" aria-hidden="true" />
                  {on ? 'ON' : 'OFF'}
                </span>
                {changed && <span className="changed-dot" aria-hidden="true" />}
                {hinted && (
                  <span className="hint-pin" aria-hidden="true">
                    HINT
                  </span>
                )}
              </button>
            );
          }
          case 'gate': {
            const feeders = level.signalEdges.filter((e) => e.to === node.id);
            return (
              <div key={node.id} className="tag gate-tag" style={style} aria-hidden="true">
                <span className="feeders">
                  {feeders.map((e) => (
                    <span
                      key={e.from}
                      className="feeder"
                      style={{ '--swatch': signalColor(level, e.from) } as CSSProperties}
                    >
                      {e.invert ? 'NOT ' : ''}
                      {nodeName(level, e.from)}
                    </span>
                  ))}
                </span>
                <NeedBadge label={gateRequirement(level, node.id)} on={node.requiredSignal} />
              </div>
            );
          }
          case 'source':
            return (
              <div key={node.id} className="tag above" style={style} aria-hidden="true">
                Power
              </div>
            );
          case 'goal':
            return (
              <div key={node.id} className="tag below" style={style} aria-hidden="true">
                Goal
              </div>
            );
          case 'ballStart':
            return (
              <div key={node.id} className="tag below" style={style} aria-hidden="true">
                Start
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

/** What a gate needs. Multi-input gates put ALL/ANY on its own line to stay narrow. */
function NeedBadge({ label, on }: { label: string; on: boolean }) {
  const words = label.split(' ');
  const state = words.pop()!;
  const mode = words.join(' ');
  return (
    <span className={`need ${on ? 'need-on' : 'need-off'}${mode ? ' multi' : ''}`}>
      {mode && <span className="need-mode">{mode}</span>}
      <span className="need-state">
        <BoltIcon crossed={!on} />
        {state}
      </span>
    </span>
  );
}

/** Lightning bolt; crossed out for gates that need no power. */
function BoltIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg className="bolt" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M9.5 1 3.5 9h4l-1 6 6-8h-4l1-6z" fill="currentColor" />
      {crossed && (
        <path d="M2 14 14 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { canToggle } from '../engine/reducer';
import type { GameState, LevelDef, RunEvent, SignalEdge } from '../engine/types';
import { Board } from '../render/board';
import {
  BOARD_WIDTH,
  boardHeight,
  boardPoint,
  partDividers,
  partViews,
  trackRoute,
  wireRoutes,
} from '../render/layout';
import type { Point } from '../render/geometry';
import { signalColor } from '../render/colors';
import { INSTANT_TIMING, NORMAL_TIMING } from '../render/timeline';
import { gateRequirement, nodeName, partName } from './describe';

export interface RunPlayback {
  id: number;
  events: readonly RunEvent[];
  /** The part of a staged board the run played. */
  stage: number;
}

interface Props {
  level: LevelDef;
  state: GameState;
  /** The run to show; null shows the idle machine. */
  playback: RunPlayback | null;
  /** The part of a staged board shown as in play. */
  stage: number;
  reducedMotion: boolean;
  locked: boolean;
  /** The switch a hint just set, for a one-off flourish. */
  justHinted?: string | null;
  /** After a miss: the gate or fork that stopped the ball, kept marked until a switch moves. */
  stoppedAt?: string | null;
  /** Bumped to jump the playing run to its last frame. */
  skipToken?: number;
  /** Set while a run plays: a tap on the board skips to the end. */
  onSkip?: () => void;
  onToggle: (switchId: string) => void;
  onPlayed: (id: number) => void;
}

/** Boards grow a little on large screens, but not so far that the machine looks blown up. */
const MAX_SCALE = 1.2;

const placeAt = (at: Point): CSSProperties => ({ left: at.x, top: at.y });

/** The Pixi machine plus DOM overlays for switches and labels. */
export function BoardView({
  level,
  state,
  playback,
  stage,
  reducedMotion,
  locked,
  justHinted,
  stoppedAt = null,
  skipToken = 0,
  onSkip,
  onToggle,
  onPlayed,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const height = boardHeight(level);
  const routes = useMemo(() => wireRoutes(level), [level]);
  const dividers = useMemo(() => partDividers(level), [level]);
  // On staged boards the screen shows one part at a time, filling the frame, and pans
  // down to the next part when the ball drops through the checkpoint.
  const views = useMemo(() => partViews(level), [level]);
  const view = views[Math.min(stage, views.length - 1)]!;
  const tallest = Math.max(...views.map((v) => v.height));
  // Labels and switches of the parts out of view are hidden, so they can't be tapped.
  const offView = (y: number): CSSProperties =>
    y >= view.top - 1 && y <= view.top + view.height + 1 ? {} : { visibility: 'hidden' };
  const place = (at: Point): CSSProperties => ({ ...placeAt(at), ...offView(at.y) });
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

  // The machine is laid out at one fixed size and scaled to fit, so every phone sees the
  // same picture and labels never collide on small screens.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fit = () => {
      const k = Math.min(frame.clientWidth / BOARD_WIDTH, frame.clientHeight / view.height);
      // Rounded so sub-pixel jitter can't keep re-scaling the board.
      if (k > 0) setScale(Math.round(Math.min(k, MAX_SCALE) * 1000) / 1000);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [failed, view.height]);

  useEffect(() => {
    if (ready) boardRef.current?.setScale(scale);
  }, [ready, scale]);

  useEffect(() => {
    if (ready) boardRef.current?.setLevel(level);
  }, [ready, level]);

  useEffect(() => {
    if (ready) boardRef.current?.setReducedMotion(reducedMotion);
  }, [ready, reducedMotion]);

  // Live wire power before a run. Kept apart from playback so toggling never restarts a run.
  const switches = state.switches;
  useEffect(() => {
    if (ready && !playback) boardRef.current?.showIdle(switches, stage);
  }, [ready, level, playback, switches, stage]);

  useEffect(() => {
    const board = boardRef.current;
    if (!ready || !board) return;
    if (!playback) return;
    let live = true;
    void board
      .play(playback.events, reducedMotion ? INSTANT_TIMING : NORMAL_TIMING, playback.stage)
      .then(() => live && onPlayedRef.current(playback.id));
    return () => {
      live = false;
    };
  }, [ready, level, playback, reducedMotion]);

  useEffect(() => {
    if (skipToken > 0) boardRef.current?.skip();
  }, [skipToken]);

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
    <div
      className={`board${reducedMotion ? ' still' : ''}`}
      ref={frameRef}
      data-ready={ready}
      data-skippable={onSkip ? true : undefined}
      style={{ '--aspect': tallest / BOARD_WIDTH } as CSSProperties}
      onClick={onSkip}
    >
      <div
        className="board-stage"
        ref={hostRef}
        style={
          {
            '--k': scale,
            '--h': `${height}px`,
            '--view-top': `${view.top}px`,
            '--view-h': `${view.height}px`,
          } as CSSProperties
        }
      >
        {level.nodes.map((node) => {
          const style = place(boardPoint(node.x, node.y, height));
          switch (node.type) {
            case 'switch': {
              const on = state.switches[node.id] ?? false;
              const changed = on !== node.initialOn;
              const hinted = node.locked === true;
              const part = node.stage ?? 0;
              const done = part < stage;
              const ahead = part > stage;
              const blocked =
                !locked && !hinted && !done && !ahead && !canToggle(level, state, node.id);
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`switch ${on ? 'is-on' : 'is-off'}${blocked ? ' is-blocked' : ''}${hinted ? ' is-hinted' : ''}${done ? ' is-done' : ''}${ahead ? ' is-ahead' : ''}${node.id === justHinted ? ' just-hinted' : ''}`}
                  style={{ ...style, '--swatch': signalColor(level, node.id) } as CSSProperties}
                  aria-pressed={on}
                  aria-disabled={locked || blocked || hinted || done || ahead}
                  aria-label={`Switch ${nodeName(level, node.id)}, ${on ? 'on' : 'off'}${changed ? ', changed' : ''}${hinted ? ', set by a hint' : ''}${blocked ? ', no changes left' : ''}${done ? ', part cleared' : ''}${ahead ? `, opens in ${partName(part)}` : ''}`}
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
                <div
                  key={node.id}
                  className={`tag gate-tag${node.id === stoppedAt ? ' is-stopped' : ''}`}
                  style={style}
                  aria-hidden="true"
                >
                  <Feeders level={level} edges={feeders} />
                  <NeedBadge label={gateRequirement(level, node.id)} on={node.requiredSignal} />
                </div>
              );
            }
            case 'junction': {
              const feeders = level.signalEdges.filter((e) => e.to === node.id);
              // Each lane's sign sits on the first leg out of the fork.
              const lane = (to: string) => {
                const [a, b] = trackRoute(level, node.id, to);
                return place({ x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 });
              };
              return [
                <div
                  key={node.id}
                  className={`tag fork-tag${node.id === stoppedAt ? ' is-stopped' : ''}`}
                  style={style}
                  aria-hidden="true"
                >
                  <Feeders level={level} edges={feeders} />
                </div>,
                <div
                  key={`${node.id}-on`}
                  className="tag lane-tag"
                  style={lane(node.whenTrue)}
                  aria-hidden="true"
                >
                  <NeedBadge label="ON" on />
                </div>,
                <div
                  key={`${node.id}-off`}
                  className="tag lane-tag"
                  style={lane(node.whenFalse)}
                  aria-hidden="true"
                >
                  <NeedBadge label="OFF" on={false} />
                </div>,
              ];
            }
            case 'deadEnd':
              return (
                <div key={node.id} className="tag below" style={style} aria-hidden="true">
                  Dead end
                </div>
              );
            case 'source':
              return (
                <div key={node.id} className="tag above" style={style} aria-hidden="true">
                  Power
                </div>
              );
            case 'checkpoint':
              return (
                <div key={node.id} className="tag below" style={style} aria-hidden="true">
                  Checkpoint
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
        {dividers.length > 0 &&
          [0, ...dividers].map((y, part) => (
            <div
              key={`part-${part}`}
              className={`tag part-tag${part === stage ? ' is-current' : ''}`}
              style={{ top: y + 14, ...offView(y + 14) }}
              aria-hidden="true"
            >
              {partName(part)}
            </div>
          ))}
        {[...routes].map(
          ([key, route]) =>
            route.flip && (
              <div
                key={key}
                className="tag not-tag"
                style={place(route.flip.point)}
                aria-hidden="true"
              >
                NOT
              </div>
            ),
        )}
      </div>
    </div>
  );
}

/** The switches feeding a gate or fork, in their wire colors. */
function Feeders({ level, edges }: { level: LevelDef; edges: readonly SignalEdge[] }) {
  return (
    <span className="feeders">
      {edges.map((e) => (
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

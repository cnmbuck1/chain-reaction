import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { canToggle } from '../engine/reducer';
import type { GameState, LevelDef, RunEvent } from '../engine/types';
import { Board, BOARD_PAD } from '../render/board';
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
  onToggle,
  onPlayed,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<Board | null>(null);
  const [ready, setReady] = useState(false);
  const onPlayedRef = useRef(onPlayed);
  useEffect(() => {
    onPlayedRef.current = onPlayed;
  });

  useEffect(() => {
    const board = new Board();
    boardRef.current = board;
    let live = true;
    void board.init(hostRef.current!).then(() => live && setReady(true));
    return () => {
      live = false;
      boardRef.current = null;
      setReady(false);
      board.destroy();
    };
  }, []);

  useEffect(() => {
    if (ready) boardRef.current?.setLevel(level);
  }, [ready, level]);

  useEffect(() => {
    const board = boardRef.current;
    if (!ready || !board) return;
    if (!playback) {
      board.showIdle();
      return;
    }
    let live = true;
    void board
      .play(playback.events, reducedMotion ? INSTANT_TIMING : NORMAL_TIMING)
      .then(() => live && onPlayedRef.current(playback.id));
    return () => {
      live = false;
    };
  }, [ready, level, playback, reducedMotion]);

  return (
    <div className="board" ref={hostRef} data-ready={ready}>
      {level.nodes.map((node) => {
        const style = place(node.x, node.y);
        switch (node.type) {
          case 'switch': {
            const on = state.switches[node.id] ?? false;
            const changed = on !== node.initialOn;
            const blocked = !locked && !canToggle(level, state, node.id);
            return (
              <button
                key={node.id}
                type="button"
                className={`switch ${on ? 'is-on' : 'is-off'}${blocked ? ' is-blocked' : ''}`}
                style={style}
                aria-pressed={on}
                aria-disabled={locked || blocked}
                aria-label={`Switch ${nodeName(level, node.id)}, ${on ? 'on' : 'off'}${changed ? ', changed' : ''}${blocked ? ', no changes left' : ''}`}
                onClick={() => !locked && onToggle(node.id)}
              >
                <span className="switch-name">{nodeName(level, node.id)}</span>
                <span className="lever" aria-hidden="true">
                  <span className="knob" />
                </span>
                <span className="switch-state">{on ? 'ON' : 'OFF'}</span>
                {changed && <span className="changed-dot" aria-hidden="true" />}
              </button>
            );
          }
          case 'gate':
            return (
              <div key={node.id} className="tag gate-tag" style={style} aria-hidden="true">
                <span className={node.requiredSignal ? 'need-on' : 'need-off'}>
                  <small>Needs</small>
                  {gateRequirement(level, node.id)}
                </span>
              </div>
            );
          case 'source':
            return (
              <div key={node.id} className="tag below" style={style} aria-hidden="true">
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

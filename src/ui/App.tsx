import { useState } from 'react';
import { canToggle, changesUsed, initialState, step } from '../engine/reducer';
import type { GameAction, GameState, RejectReason } from '../engine/types';
import { levels } from '../levels';
import { describeEvent, describeOutcome, describeWire, nodeName, rejectMessage } from './describe';

/** M1 functional slice: plain controls over the engine, no board rendering yet. */
export function App() {
  const level = levels[0]!;
  const [state, setState] = useState<GameState>(() => initialState(level));
  const [notice, setNotice] = useState<RejectReason | null>(null);

  const dispatch = (action: GameAction) => {
    const result = step(level, state, action);
    setNotice(result.rejected ?? null);
    setState(result.state);
  };

  const switches = level.nodes.filter((n) => n.type === 'switch');
  const used = changesUsed(level, state.switches);
  const won = state.phase === 'won';

  return (
    <main className="app">
      <header>
        <p className="eyebrow">Level 1 · {level.difficulty}</p>
        <h1>{level.name}</h1>
        <p className="hint">{level.meta.hint}</p>
      </header>

      <section aria-labelledby="wiring">
        <h2 id="wiring">Wiring</h2>
        <ul className="wires">
          {level.signalEdges.map((edge) => (
            <li key={`${edge.from}>${edge.to}`}>{describeWire(level, edge)}</li>
          ))}
        </ul>
        <p className="track">
          Track:{' '}
          {level.track.map((path) => path.map((id) => nodeName(level, id)).join(' → ')).join('; ')}
        </p>
      </section>

      <section aria-labelledby="switches">
        <h2 id="switches">
          Switches{' '}
          <span className="budget">
            Changes {used}/{level.maxToggles}
          </span>
        </h2>
        <div className="switches">
          {switches.map((node) => {
            const on = state.switches[node.id] ?? false;
            const locked = !canToggle(level, state, node.id);
            return (
              <button
                key={node.id}
                type="button"
                className={`switch ${on ? 'on' : 'off'}`}
                aria-pressed={on}
                aria-disabled={locked}
                onClick={() => dispatch({ type: 'toggle', switchId: node.id })}
              >
                {node.label ?? node.id}: {on ? 'ON' : 'OFF'}
                {locked && !won ? ' (locked)' : ''}
              </button>
            );
          })}
        </div>
      </section>

      <div className="controls">
        <button
          type="button"
          className="primary"
          onClick={() => dispatch({ type: 'run' })}
          disabled={won}
        >
          Run
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'undo' })}
          disabled={won || state.undoStack.length === 0}
        >
          Undo
        </button>
        <button type="button" onClick={() => dispatch({ type: 'reset' })}>
          Reset
        </button>
      </div>

      <p className="status" role="status" aria-live="polite">
        {notice
          ? rejectMessage[notice]
          : state.lastRun
            ? describeOutcome(level, state.lastRun.outcome)
            : `Attempt ${state.attempt}. Set the switches, then Run.`}
      </p>

      {state.lastRun && (
        <section aria-labelledby="log">
          <h2 id="log">Last run</h2>
          <ol className="log">
            {state.lastRun.events
              .map((event) => describeEvent(level, event))
              .filter((line): line is string => line !== null)
              .map((line, i) => (
                <li key={i}>{line}</li>
              ))}
          </ol>
        </section>
      )}
    </main>
  );
}

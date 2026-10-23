import type { LevelIndex } from './graph';
import type { GateNode, NodeId, RunEvent, SignalEdge, SwitchStates } from './types';

export interface Evaluation {
  /** Output signal of every source and switch. */
  signals: ReadonlyMap<NodeId, boolean>;
  /** Combined input of every gate and junction. */
  sinkInputs: ReadonlyMap<NodeId, boolean>;
  /** Open/closed for every gate. */
  gateOpen: ReadonlyMap<NodeId, boolean>;
  /** Power-propagation and gate events, in playback order. */
  events: RunEvent[];
}

const wireValue = (edge: SignalEdge, signals: ReadonlyMap<NodeId, boolean>) =>
  (signals.get(edge.from) ?? false) !== (edge.invert ?? false);

/**
 * Computes every signal from a snapshot of switch positions.
 * Source: TRUE. Switch: ON and at least one live input. Unpowered is FALSE.
 */
export function evaluate(index: LevelIndex, switches: SwitchStates): Evaluation {
  const signals = new Map<NodeId, boolean>();
  const events: RunEvent[] = [];

  for (const id of index.signalOrder) {
    const node = index.nodes.get(id)!;
    let value: boolean;
    if (node.type === 'source') {
      value = true;
    } else {
      const powered = (index.incoming.get(id) ?? []).some((e) => wireValue(e, signals));
      value = (switches[id] ?? false) && powered;
    }
    signals.set(id, value);
    events.push({ type: 'signal', nodeId: id, value });
    for (const edge of index.outgoing.get(id) ?? []) {
      events.push({ type: 'wire', from: edge.from, to: edge.to, value: wireValue(edge, signals) });
    }
  }

  const sinkInputs = new Map<NodeId, boolean>();
  const gateOpen = new Map<NodeId, boolean>();
  for (const id of index.sinks) {
    const node = index.nodes.get(id)!;
    const inputs = (index.incoming.get(id) ?? []).map((e) => wireValue(e, signals));
    const combine = node.type === 'gate' ? node.combine : 'single';
    const input = combineInputs(combine, inputs);
    sinkInputs.set(id, input);
    if (node.type === 'gate') {
      const open = input === node.requiredSignal;
      gateOpen.set(id, open);
      events.push({ type: 'gate', gateId: id, input, open });
    }
  }

  return { signals, sinkInputs, gateOpen, events };
}

function combineInputs(combine: GateNode['combine'], inputs: boolean[]): boolean {
  switch (combine) {
    case 'single':
      return inputs[0] ?? false;
    case 'and':
      return inputs.length > 0 && inputs.every(Boolean);
    case 'or':
      return inputs.some(Boolean);
  }
}

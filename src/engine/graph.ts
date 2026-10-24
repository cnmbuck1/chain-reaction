import type { LevelDef, LevelNode, NodeId, SignalEdge } from './types';

/** Precomputed lookups for a level. Assumes the level passed validation. */
export interface LevelIndex {
  level: LevelDef;
  nodes: ReadonlyMap<NodeId, LevelNode>;
  incoming: ReadonlyMap<NodeId, readonly SignalEdge[]>;
  outgoing: ReadonlyMap<NodeId, readonly SignalEdge[]>;
  /** Signal-producing nodes (sources, switches) in topological order, ties broken by id. */
  signalOrder: readonly NodeId[];
  /** Gates and junctions sorted by id. */
  sinks: readonly NodeId[];
  switchIds: readonly NodeId[];
  ballStart: NodeId;
  /** Checkpoint ids by the part they complete. Empty on boards without parts. */
  checkpoints: readonly NodeId[];
  /** Next track node for every non-junction track node that has one. */
  trackNext: ReadonlyMap<NodeId, NodeId>;
}

/** The part of a staged board a switch belongs to. */
export const switchStage = (node: LevelNode) => (node.type === 'switch' ? (node.stage ?? 0) : 0);

/** Where the ball sets off for a part: the start, or the checkpoint that ended the part before. */
export const stageStart = (index: LevelIndex, stage: number): NodeId =>
  stage === 0 ? index.ballStart : index.checkpoints[stage - 1]!;

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const cache = new WeakMap<LevelDef, LevelIndex>();

export function indexLevel(level: LevelDef): LevelIndex {
  const cached = cache.get(level);
  if (cached) return cached;

  const nodes = new Map(level.nodes.map((n) => [n.id, n]));
  const incoming = new Map<NodeId, SignalEdge[]>();
  const outgoing = new Map<NodeId, SignalEdge[]>();
  for (const n of level.nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const e of level.signalEdges) {
    incoming.get(e.to)?.push(e);
    outgoing.get(e.from)?.push(e);
  }
  for (const list of outgoing.values()) list.sort((a, b) => byId(a.to, b.to));
  for (const list of incoming.values()) list.sort((a, b) => byId(a.from, b.from));

  const producers = level.nodes
    .filter((n) => n.type === 'source' || n.type === 'switch')
    .map((n) => n.id);
  const signalOrder = topoSort(producers, incoming);

  const sinks = level.nodes
    .filter((n) => n.type === 'gate' || n.type === 'junction')
    .map((n) => n.id)
    .sort(byId);
  const switchIds = level.nodes
    .filter((n) => n.type === 'switch')
    .map((n) => n.id)
    .sort(byId);
  const ballStart = level.nodes.find((n) => n.type === 'ballStart')?.id ?? '';

  const checkpoints: NodeId[] = [];
  for (const n of level.nodes) if (n.type === 'checkpoint') checkpoints[n.stage] = n.id;

  const trackNext = new Map<NodeId, NodeId>();
  for (const path of level.track) {
    for (let i = 0; i + 1 < path.length; i++) trackNext.set(path[i]!, path[i + 1]!);
  }

  const index: LevelIndex = {
    level,
    nodes,
    incoming,
    outgoing,
    signalOrder,
    sinks,
    switchIds,
    ballStart,
    checkpoints,
    trackNext,
  };
  cache.set(level, index);
  return index;
}

/**
 * Kahn's algorithm over the given nodes, always taking the smallest ready id so the
 * order is deterministic. Nodes left in a cycle are omitted (the validator rejects cycles).
 */
function topoSort(ids: NodeId[], incoming: ReadonlyMap<NodeId, readonly SignalEdge[]>): NodeId[] {
  const members = new Set(ids);
  const remaining = new Map<NodeId, number>();
  for (const id of ids) {
    remaining.set(id, (incoming.get(id) ?? []).filter((e) => members.has(e.from)).length);
  }
  const order: NodeId[] = [];
  const ready = ids.filter((id) => remaining.get(id) === 0).sort(byId);
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const other of ids) {
      const deps = (incoming.get(other) ?? []).filter((e) => e.from === id).length;
      if (deps === 0) continue;
      const left = remaining.get(other)! - deps;
      remaining.set(other, left);
      if (left === 0) {
        ready.push(other);
        ready.sort(byId);
      }
    }
  }
  return order;
}

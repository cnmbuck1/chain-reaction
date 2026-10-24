import type { LevelDef, LevelNode, NodeId } from '../engine/types';

export type ValidationCode =
  | 'SCHEMA_VERSION'
  | 'DUPLICATE_ID'
  | 'UNKNOWN_NODE'
  | 'BAD_EDGE'
  | 'SIGNAL_CYCLE'
  | 'SWITCH_NO_INPUT'
  | 'GATE_NO_INPUT'
  | 'GATE_ARITY'
  | 'TRACK_SHAPE'
  | 'TRACK_CYCLE'
  | 'NOT_ON_TRACK'
  | 'BAD_POSITION'
  | 'BAD_STAGE'
  | 'BAD_GEAR'
  | 'BAD_KEY';

export interface ValidationError {
  code: ValidationCode;
  message: string;
  ref?: NodeId;
}

const SIGNAL_FROM = new Set<LevelNode['type']>(['source', 'switch']);
const SIGNAL_TO = new Set<LevelNode['type']>(['switch', 'gate', 'junction']);
const TRACK_TYPES = new Set<LevelNode['type']>([
  'ballStart',
  'gate',
  'junction',
  'goal',
  'deadEnd',
  'checkpoint',
  'key',
  'lock',
]);
const TERMINAL = new Set<LevelNode['type']>(['goal', 'deadEnd']);

/** Structural validation. Returns every problem found; an empty list means valid. */
export function validateLevel(level: LevelDef): ValidationError[] {
  const errors: ValidationError[] = [];
  const add = (code: ValidationCode, message: string, ref?: NodeId) =>
    errors.push({ code, message, ref });

  if (level.schemaVersion !== 1)
    add('SCHEMA_VERSION', `Unsupported schemaVersion ${level.schemaVersion}`);

  // Nodes
  const nodes = new Map<NodeId, LevelNode>();
  for (const n of level.nodes) {
    if (nodes.has(n.id)) add('DUPLICATE_ID', `Duplicate node id "${n.id}"`, n.id);
    nodes.set(n.id, n);
    if (!(n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1)) {
      add('BAD_POSITION', `Node "${n.id}" position must be within 0..1`, n.id);
    }
  }

  // Parts: checkpoints number them 0..n-1, and every switch belongs to one of the n+1 parts.
  const checkpoints = level.nodes.flatMap((n) => (n.type === 'checkpoint' ? [n.stage] : []));
  const parts = checkpoints.length + 1;
  if ([...checkpoints].sort((a, b) => a - b).some((stage, i) => stage !== i)) {
    add('BAD_STAGE', `Checkpoints must complete parts 0 to ${parts - 2}, one each`);
  }
  for (const n of level.nodes) {
    if (n.type !== 'switch' || n.stage === undefined) continue;
    if (!Number.isInteger(n.stage) || n.stage < 0 || n.stage >= parts) {
      add('BAD_STAGE', `Switch "${n.id}" is in part ${n.stage}, but the board has ${parts}`, n.id);
    }
  }

  // Gears turn other switches in the same part, and never back round to themselves.
  const geared = new Map<NodeId, NodeId[]>();
  for (const n of level.nodes) {
    if (n.type !== 'switch' || !n.turns) continue;
    for (const to of n.turns) {
      const other = nodes.get(to);
      if (other?.type !== 'switch' || to === n.id) {
        add(
          'BAD_GEAR',
          `Switch "${n.id}" has a gear to "${to}", which is not another switch`,
          n.id,
        );
      } else if ((other.stage ?? 0) !== (n.stage ?? 0)) {
        add('BAD_GEAR', `Switch "${n.id}" has a gear to "${to}" in another part`, n.id);
      }
    }
    geared.set(n.id, n.turns);
  }
  const gearCycle = (id: NodeId, path: Set<NodeId>): boolean =>
    path.has(id) || (geared.get(id) ?? []).some((to) => gearCycle(to, new Set([...path, id])));
  for (const id of geared.keys()) {
    if (gearCycle(id, new Set())) add('BAD_GEAR', `Gears from "${id}" turn back round to it`, id);
  }

  // Every lock names a key on the board.
  for (const n of level.nodes) {
    if (n.type === 'lock' && nodes.get(n.key)?.type !== 'key') {
      add('BAD_KEY', `Lock "${n.id}" needs key "${n.key}", which is not a key`, n.id);
    }
  }

  // Signal edges
  const inputs = new Map<NodeId, number>();
  for (const e of level.signalEdges) {
    const from = nodes.get(e.from);
    const to = nodes.get(e.to);
    if (!from || !to) {
      add(
        'UNKNOWN_NODE',
        `Signal edge ${e.from} -> ${e.to} names a missing node`,
        from ? e.to : e.from,
      );
      continue;
    }
    if (!SIGNAL_FROM.has(from.type) || !SIGNAL_TO.has(to.type)) {
      add(
        'BAD_EDGE',
        `Signal edge ${e.from} (${from.type}) -> ${e.to} (${to.type}) is not allowed`,
        e.from,
      );
      continue;
    }
    inputs.set(e.to, (inputs.get(e.to) ?? 0) + 1);
  }
  for (const n of level.nodes) {
    const count = inputs.get(n.id) ?? 0;
    if (n.type === 'switch' && count === 0) {
      add('SWITCH_NO_INPUT', `Switch "${n.id}" has no input`, n.id);
    }
    if (n.type === 'gate' || n.type === 'junction') {
      if (count === 0) add('GATE_NO_INPUT', `${n.type} "${n.id}" has no input`, n.id);
      else {
        const combine = n.type === 'gate' ? n.combine : 'single';
        if (combine === 'single' ? count !== 1 : count < 2) {
          add('GATE_ARITY', `${n.type} "${n.id}" (${combine}) has ${count} inputs`, n.id);
        }
      }
    }
  }
  const cycleNode = findSignalCycle(level, nodes);
  if (cycleNode) add('SIGNAL_CYCLE', `Signal wiring has a cycle through "${cycleNode}"`, cycleNode);

  validateTrack(level, nodes, add);
  return errors;
}

function findSignalCycle(level: LevelDef, nodes: Map<NodeId, LevelNode>): NodeId | null {
  const next = new Map<NodeId, NodeId[]>();
  for (const e of level.signalEdges) {
    if (!nodes.has(e.from) || !nodes.has(e.to)) continue;
    next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
  }
  const state = new Map<NodeId, 'visiting' | 'done'>();
  const visit = (id: NodeId): NodeId | null => {
    if (state.get(id) === 'done') return null;
    if (state.get(id) === 'visiting') return id;
    state.set(id, 'visiting');
    for (const to of next.get(id) ?? []) {
      const found = visit(to);
      if (found) return found;
    }
    state.set(id, 'done');
    return null;
  };
  for (const n of level.nodes) {
    const found = visit(n.id);
    if (found) return found;
  }
  return null;
}

function validateTrack(
  level: LevelDef,
  nodes: Map<NodeId, LevelNode>,
  add: (code: ValidationCode, message: string, ref?: NodeId) => void,
) {
  const starts = level.nodes.filter((n) => n.type === 'ballStart');
  if (starts.length !== 1) {
    add('TRACK_SHAPE', `Level needs exactly one ballStart, found ${starts.length}`);
    return;
  }
  if (!level.nodes.some((n) => n.type === 'goal')) add('TRACK_SHAPE', 'Level has no goal');

  // Collect the exits of each track node from paths and junctions.
  const next = new Map<NodeId, NodeId>();
  let ok = true;
  for (const path of level.track) {
    for (let i = 0; i < path.length; i++) {
      const id = path[i]!;
      const node = nodes.get(id);
      if (!node) {
        add('UNKNOWN_NODE', `Track names missing node "${id}"`, id);
        ok = false;
        continue;
      }
      if (!TRACK_TYPES.has(node.type)) {
        add('TRACK_SHAPE', `${node.type} "${id}" cannot be on the track`, id);
        ok = false;
      }
      const to = path[i + 1];
      if (to === undefined) continue;
      if (node.type === 'junction' || TERMINAL.has(node.type)) {
        add('TRACK_SHAPE', `${node.type} "${id}" cannot have a track exit in a path`, id);
        ok = false;
      } else if (next.has(id) && next.get(id) !== to) {
        add('TRACK_SHAPE', `Track branches at "${id}"; only junctions may branch`, id);
        ok = false;
      } else {
        next.set(id, to);
      }
      if (nodes.get(to)?.type === 'ballStart') {
        add('TRACK_SHAPE', `Track leads back into the ball start`, to);
        ok = false;
      }
    }
  }
  for (const n of level.nodes) {
    if (n.type !== 'junction') continue;
    for (const to of [n.whenTrue, n.whenFalse]) {
      if (!nodes.has(to)) {
        add('UNKNOWN_NODE', `Junction "${n.id}" exit names missing node "${to}"`, n.id);
        ok = false;
      }
    }
  }
  if (!ok) return;

  const exits = (id: NodeId): NodeId[] => {
    const node = nodes.get(id)!;
    if (node.type === 'junction') return [node.whenTrue, node.whenFalse];
    const to = next.get(id);
    return to === undefined ? [] : [to];
  };

  // Walk every route from the ball start.
  const reached = new Set<NodeId>();
  const state = new Map<NodeId, 'visiting' | 'done'>();
  const walk = (id: NodeId) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      add('TRACK_CYCLE', `Track loops through "${id}"`, id);
      return;
    }
    state.set(id, 'visiting');
    reached.add(id);
    const node = nodes.get(id)!;
    const out = exits(id);
    if (out.length === 0 && !TERMINAL.has(node.type)) {
      add(
        'TRACK_SHAPE',
        `Track stops at ${node.type} "${id}" without reaching a goal or dead end`,
        id,
      );
    }
    for (const to of out) walk(to);
    state.set(id, 'done');
  };
  walk(starts[0]!.id);

  for (const n of level.nodes) {
    if (
      (n.type === 'gate' || n.type === 'junction' || n.type === 'checkpoint') &&
      !reached.has(n.id)
    ) {
      add('NOT_ON_TRACK', `${n.type} "${n.id}" is not reachable by the ball`, n.id);
    }
  }
}

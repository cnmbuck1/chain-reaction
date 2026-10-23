// Level data and engine types. Positions (x, y) are normalized 0..1 and only
// affect rendering; nothing in the engine reads them.

export type NodeId = string;

interface NodeBase {
  id: NodeId;
  x: number;
  y: number;
  label?: string;
}

export interface SourceNode extends NodeBase {
  type: 'source';
}

export interface SwitchNode extends NodeBase {
  type: 'switch';
  initialOn: boolean;
  /** Fixed in place, as when a hint has set it. Locked switches cannot be toggled. */
  locked?: boolean;
}

export interface GateNode extends NodeBase {
  type: 'gate';
  /** How multiple inputs combine. `single` requires exactly one input. */
  combine: 'single' | 'and' | 'or';
  /** The gate is open when the combined input equals this value. */
  requiredSignal: boolean;
}

/** Routes the ball to `whenTrue` or `whenFalse` based on its single signal input. */
export interface JunctionNode extends NodeBase {
  type: 'junction';
  whenTrue: NodeId;
  whenFalse: NodeId;
}

export interface BallStartNode extends NodeBase {
  type: 'ballStart';
}

export interface GoalNode extends NodeBase {
  type: 'goal';
}

export interface DeadEndNode extends NodeBase {
  type: 'deadEnd';
}

export type LevelNode =
  SourceNode | SwitchNode | GateNode | JunctionNode | BallStartNode | GoalNode | DeadEndNode;

export type NodeType = LevelNode['type'];

export interface SignalEdge {
  from: NodeId;
  to: NodeId;
  /** Flips the signal at the receiving end (drawn as a NOT notch). */
  invert?: boolean;
}

export interface LevelDef {
  schemaVersion: 1;
  id: string;
  name: string;
  difficulty: 'tutorial' | 'easy' | 'medium' | 'hard';
  /** Maximum number of switches that may differ from their initial position. */
  maxToggles: number;
  nodes: LevelNode[];
  signalEdges: SignalEdge[];
  /**
   * Ball track as a list of paths. Each consecutive pair in a path is a directed
   * track link. Junction exits are given on the junction node, not here.
   */
  track: NodeId[][];
  meta: {
    teachingPoint: string;
    hint: string;
    /** Short coaching line shown before the first run (tutorial levels). */
    prompt?: string;
    /** Minimum switch changes to win, as computed by the solver (checked in tests). */
    minChanges: number;
    /** The first switch a hint sets: one every in-budget solution changes. */
    keySwitch?: NodeId;
  };
}

export type SwitchStates = Readonly<Record<NodeId, boolean>>;

// ---- RUN events ----------------------------------------------------------

export type RunEvent =
  | { type: 'signal'; nodeId: NodeId; value: boolean }
  | { type: 'wire'; from: NodeId; to: NodeId; value: boolean }
  | { type: 'gate'; gateId: NodeId; input: boolean; open: boolean }
  | { type: 'ballMove'; from: NodeId; to: NodeId }
  | { type: 'junction'; nodeId: NodeId; input: boolean; to: NodeId }
  | { type: 'ballBlocked'; gateId: NodeId }
  | { type: 'ballDeadEnd'; nodeId: NodeId }
  | { type: 'ballGoal'; goalId: NodeId }
  | { type: 'attemptEnd'; won: boolean; attempt: number };

export type RunOutcome =
  | { kind: 'goal'; goalId: NodeId }
  | { kind: 'blocked'; gateId: NodeId }
  | { kind: 'deadEnd'; nodeId: NodeId };

export interface RunResult {
  won: boolean;
  outcome: RunOutcome;
  events: RunEvent[];
}

// ---- Player state and actions --------------------------------------------

export interface GameState {
  switches: SwitchStates;
  /** Switch ids toggled since the last RUN, most recent last. */
  undoStack: readonly NodeId[];
  /** 1-based attempt number. A failed RUN starts the next attempt. */
  attempt: number;
  phase: 'editing' | 'won';
  lastRun: RunResult | null;
}

export type GameAction =
  { type: 'toggle'; switchId: NodeId } | { type: 'undo' } | { type: 'run' } | { type: 'reset' };

export type RejectReason = 'budget' | 'locked' | 'notASwitch' | 'nothingToUndo' | 'levelWon';

export interface StepResult {
  state: GameState;
  /** RUN events; empty for every other action. */
  events: RunEvent[];
  /** Set when the action was not applied; `state` is then unchanged. */
  rejected?: RejectReason;
}

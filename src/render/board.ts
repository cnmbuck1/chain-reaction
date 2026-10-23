import { Application, Graphics } from 'pixi.js';
import { evaluate } from '../engine/evaluate';
import { indexLevel } from '../engine/graph';
import type { LevelDef, NodeId, RunEvent, SwitchStates } from '../engine/types';
import { signalColor, toHex } from './colors';
import {
  buildTimeline,
  edgeKey,
  sampleTimeline,
  type Timeline,
  type Timing,
  type VisualState,
} from './timeline';

// PixiJS drawing of the machine. Shapes only: text labels and switches are DOM
// elements laid over the canvas (see BoardView), so they stay crisp and accessible.
// The board never decides outcomes; it plays back a timeline built from engine events.

const COLORS = {
  panel: 0x161c28,
  panelEdge: 0x2a3244,
  groove: 0x232a39,
  rail: 0x3d475c,
  wire: 0x343d52,
  energy: 0x4fd6e8,
  gold: 0xc9a45c,
  metal: 0x8b94a8,
  metalDark: 0x4a5266,
  amber: 0xf0a43a,
  ball: 0xe4e7ee,
  ballShade: 0x9aa2b4,
};

/** Board padding in CSS pixels; BoardView uses the same value to place overlays. */
export const BOARD_PAD = 28;
export const GATE_HALF_HEIGHT = 20;

export interface Point {
  x: number;
  y: number;
}

export class Board {
  private app = new Application();
  private initPromise: Promise<void> | null = null;
  private destroyed = false;
  private shapes = new Graphics();
  private level: LevelDef | null = null;
  private timeline: Timeline | null = null;
  private startedAt = 0;
  private visual: VisualState = emptyVisual(null);
  private resolvePlay: (() => void) | null = null;
  private dirty = true;
  private reducedMotion = false;
  /** True while any wire carries power, so the flow animation keeps drawing. */
  private flowing = false;

  init(host: HTMLElement): Promise<void> {
    this.initPromise ??= (async () => {
      await this.app.init({
        backgroundAlpha: 0,
        antialias: true,
        resizeTo: host,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      if (this.destroyed) return;
      this.app.canvas.setAttribute('aria-hidden', 'true');
      host.prepend(this.app.canvas);
      this.app.stage.addChild(this.shapes);
      this.app.renderer.on('resize', () => (this.dirty = true));
      this.app.ticker.add(() => this.frame());
    })();
    return this.initPromise;
  }

  setLevel(level: LevelDef) {
    this.level = level;
    this.dirty = true;
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced;
    this.dirty = true;
  }

  /**
   * Before a run: wires show live power for the current switch positions so the
   * player can trace it, while gates stay unresolved and the ball waits at the start.
   */
  showIdle(switches: SwitchStates) {
    this.finishPlayback();
    this.timeline = null;
    const visual = emptyVisual(this.level ? indexLevel(this.level).ballStart : null);
    if (this.level) {
      const { signals } = evaluate(indexLevel(this.level), switches);
      for (const edge of this.level.signalEdges) {
        const live = (signals.get(edge.from) ?? false) !== (edge.invert ?? false);
        if (live) visual.wires.set(edgeKey(edge.from, edge.to), 1);
      }
    }
    this.visual = visual;
    this.dirty = true;
  }

  /** Plays a RUN. Resolves when the last cue has finished. */
  play(events: readonly RunEvent[], timing: Timing): Promise<void> {
    this.finishPlayback();
    this.timeline = buildTimeline(events, timing);
    this.startedAt = performance.now();
    this.dirty = true;
    return new Promise((resolve) => {
      this.resolvePlay = resolve;
      if (this.timeline!.duration === 0) {
        this.visual = sampleTimeline(this.timeline!, 0);
        this.finishPlayback();
      }
    });
  }

  destroy() {
    this.destroyed = true;
    this.finishPlayback();
    void this.initPromise?.then(() => this.app.destroy(true, { children: true }));
  }

  private finishPlayback() {
    const resolve = this.resolvePlay;
    this.resolvePlay = null;
    resolve?.();
  }

  private frame() {
    if (this.timeline && this.resolvePlay) {
      const t = performance.now() - this.startedAt;
      this.visual = sampleTimeline(this.timeline, t);
      this.dirty = true;
      if (t >= this.timeline.duration) this.finishPlayback();
    }
    if (this.flowing && !this.reducedMotion) this.dirty = true;
    if (!this.dirty || !this.level) return;
    this.dirty = false;
    this.draw(this.level, this.visual);
  }

  private point(level: LevelDef, id: NodeId): Point {
    const node = indexLevel(level).nodes.get(id)!;
    const { width, height } = this.app.screen;
    return {
      x: BOARD_PAD + node.x * (width - 2 * BOARD_PAD),
      y: BOARD_PAD + node.y * (height - 2 * BOARD_PAD),
    };
  }

  private draw(level: LevelDef, visual: VisualState) {
    const g = this.shapes;
    const index = indexLevel(level);
    const { width, height } = this.app.screen;
    const at = (id: NodeId) => this.point(level, id);
    g.clear();

    g.roundRect(1, 1, width - 2, height - 2, 18)
      .fill(COLORS.panel)
      .stroke({ width: 1.5, color: COLORS.panelEdge });

    // Track: a groove with a rail, for every link the ball can travel.
    for (const [from, to] of trackLinks(level)) {
      const a = at(from);
      const b = at(to);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 16, color: COLORS.groove, cap: 'round' });
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 3, color: COLORS.rail, cap: 'round' });
    }

    // Wires take their switch's color: dim when dead, bright with flowing sparks when live.
    this.flowing = false;
    const now = performance.now();
    for (const edge of level.signalEdges) {
      const a = at(edge.from);
      const b = wireEnd(index.nodes.get(edge.to)!.type, at(edge.to));
      const color = toHex(signalColor(level, edge.from));
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 3, color: COLORS.wire, cap: 'round' });
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 3, color, alpha: 0.3, cap: 'round' });
      const p = visual.wires.get(edgeKey(edge.from, edge.to));
      if (p !== undefined && p > 0) {
        const c = { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
        g.moveTo(a.x, a.y).lineTo(c.x, c.y).stroke({ width: 11, color, alpha: 0.2, cap: 'round' });
        g.moveTo(a.x, a.y).lineTo(c.x, c.y).stroke({ width: 4, color, cap: 'round' });
        if (p >= 1) {
          this.flowing = true;
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          const sparks = Math.max(1, Math.round(len / 45));
          const phase = this.reducedMotion ? 0.5 : (now / 1100) % 1;
          for (let i = 0; i < sparks; i++) {
            const q = (phase + i / sparks) % 1;
            g.circle(a.x + (b.x - a.x) * q, a.y + (b.y - a.y) * q, 2.2).fill({
              color: 0xffffff,
              alpha: 0.85,
            });
          }
        }
      }
      if (edge.invert) {
        const n = { x: b.x - (b.x - a.x) * 0.12, y: b.y - (b.y - a.y) * 0.12 };
        g.circle(n.x, n.y, 6).fill(COLORS.panel).stroke({ width: 2.5, color: COLORS.gold });
      }
    }

    for (const node of level.nodes) {
      const p = at(node.id);
      switch (node.type) {
        case 'source':
          g.circle(p.x, p.y, 21).fill({ color: COLORS.energy, alpha: 0.12 });
          g.circle(p.x, p.y, 16).fill(COLORS.metalDark).stroke({ width: 3, color: COLORS.gold });
          g.poly([
            p.x + 2,
            p.y - 10,
            p.x - 6,
            p.y + 2,
            p.x,
            p.y + 2,
            p.x - 2,
            p.y + 10,
            p.x + 6,
            p.y - 2,
            p.x,
            p.y - 2,
          ]).fill(COLORS.energy);
          break;
        case 'gate':
          drawGate(g, p, visual.gates.get(node.id));
          break;
        case 'junction':
          g.poly([p.x, p.y - 14, p.x + 14, p.y, p.x, p.y + 14, p.x - 14, p.y])
            .fill(COLORS.metalDark)
            .stroke({ width: 2.5, color: COLORS.metal });
          break;
        case 'goal':
          g.circle(p.x, p.y, 17).fill(COLORS.groove).stroke({ width: 3, color: COLORS.gold });
          g.circle(p.x, p.y, 7).fill({ color: COLORS.gold, alpha: 0.35 });
          break;
        case 'deadEnd':
          g.roundRect(p.x - 4, p.y - 14, 8, 28, 3).fill(COLORS.metalDark);
          break;
        case 'ballStart':
          g.circle(p.x, p.y, 15).fill(COLORS.groove).stroke({ width: 2, color: COLORS.metalDark });
          break;
        case 'switch':
          // The switch itself is a DOM button; this is its mounting plate.
          g.roundRect(p.x - 34, p.y - 26, 68, 52, 12).fill(COLORS.groove);
          break;
      }
    }

    drawFinish(g, visual, at);
    const approach =
      visual.finish && trackLinks(level).find(([, to]) => to === visual.finish!.nodeId)?.[0];
    drawBall(g, visual, at, approach ? at(approach) : null);
  }
}

function emptyVisual(ballStart: NodeId | null): VisualState {
  return {
    wires: new Map(),
    gates: new Map(),
    ball: ballStart ? { at: ballStart } : null,
    finish: null,
  };
}

/** Wires into a gate end at the top of its housing, not its center. */
function wireEnd(type: string, p: Point): Point {
  return type === 'gate' ? { x: p.x, y: p.y - GATE_HALF_HEIGHT - 6 } : p;
}

export function trackLinks(level: LevelDef): [NodeId, NodeId][] {
  const links: [NodeId, NodeId][] = [];
  for (const path of level.track) {
    for (let i = 0; i + 1 < path.length; i++) links.push([path[i]!, path[i + 1]!]);
  }
  for (const node of level.nodes) {
    if (node.type === 'junction') links.push([node.id, node.whenTrue], [node.id, node.whenFalse]);
  }
  return links;
}

function drawGate(g: Graphics, p: Point, openness: number | undefined) {
  const h = GATE_HALF_HEIGHT;
  // Housing posts either side of the track.
  g.roundRect(p.x - 15, p.y - h - 6, 6, 2 * h + 12, 2).fill(COLORS.metalDark);
  g.roundRect(p.x + 9, p.y - h - 6, 6, 2 * h + 12, 2).fill(COLORS.metalDark);
  // The bar lifts as the gate opens.
  const o = openness ?? 0;
  const lift = o * (2 * h + 4);
  const color = openness === undefined ? COLORS.metal : o > 0.5 ? COLORS.energy : COLORS.amber;
  g.roundRect(p.x - 8, p.y - h - lift, 16, 2 * h, 4).fill(color);
  g.moveTo(p.x - 8, p.y - h - lift + 7)
    .lineTo(p.x + 8, p.y - h - lift + 7)
    .stroke({ width: 1.5, color: 0x000000, alpha: 0.25 });
}

function ballPosition(visual: VisualState, at: (id: NodeId) => Point): Point | null {
  const ball = visual.ball;
  if (!ball) return null;
  if ('at' in ball) return at(ball.at);
  const a = at(ball.from);
  const b = at(ball.to);
  return { x: a.x + (b.x - a.x) * ball.p, y: a.y + (b.y - a.y) * ball.p };
}

function drawBall(
  g: Graphics,
  visual: VisualState,
  at: (id: NodeId) => Point,
  approach: Point | null,
) {
  const pos = ballPosition(visual, at);
  if (!pos) return;
  let { x, y } = pos;
  const finish = visual.finish;
  if (finish?.result === 'blocked' || finish?.result === 'deadEnd') {
    // Bounce back from the obstacle, then settle just in front of it.
    const back = Math.sin(Math.min(1, finish.p * 2) * Math.PI) * 6 + 26 * Math.min(1, finish.p * 3);
    const dx = approach ? x - approach.x : 1;
    const dy = approach ? y - approach.y : 0;
    const len = Math.hypot(dx, dy) || 1;
    x -= (dx / len) * back;
    y -= (dy / len) * back;
  }
  g.circle(x + 1.5, y + 2, 10).fill({ color: 0x000000, alpha: 0.3 });
  g.circle(x, y, 10).fill(COLORS.ballShade);
  g.circle(x - 2, y - 2, 7.5).fill(COLORS.ball);
  g.circle(x - 4, y - 4, 2.5).fill({ color: 0xffffff, alpha: 0.9 });
}

function drawFinish(g: Graphics, visual: VisualState, at: (id: NodeId) => Point) {
  const finish = visual.finish;
  if (!finish) return;
  const p = at(finish.nodeId);
  if (finish.result === 'goal') {
    // Two expanding rings and a burst of sparks, fixed angles so it's deterministic.
    for (const [delay, color] of [
      [0, COLORS.gold],
      [0.25, COLORS.energy],
    ] as const) {
      const q = Math.max(0, Math.min(1, (finish.p - delay) / (1 - delay)));
      if (q > 0)
        g.circle(p.x, p.y, 17 + q * 34).stroke({ width: 3 * (1 - q) + 0.5, color, alpha: 1 - q });
    }
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const r = 14 + finish.p * 40;
      g.circle(
        p.x + Math.cos(angle) * r,
        p.y + Math.sin(angle) * r,
        2.2 * (1 - finish.p) + 0.3,
      ).fill({
        color: i % 2 ? COLORS.gold : COLORS.energy,
        alpha: 1 - finish.p,
      });
    }
  } else {
    // Steady amber ring marks where the ball stopped.
    g.circle(p.x, p.y, 30).stroke({
      width: 2.5,
      color: COLORS.amber,
      alpha: 0.35 + 0.5 * finish.p,
    });
  }
}

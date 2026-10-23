import { Application, Container, FillGradient, Graphics, Sprite, Texture } from 'pixi.js';
import { evaluate } from '../engine/evaluate';
import { indexLevel } from '../engine/graph';
import type { LevelDef, NodeId, RunEvent, SwitchStates } from '../engine/types';
import { signalColor, toHex } from './colors';
import {
  GATE_HALF_HEIGHT,
  partialPath,
  pathLength,
  pointAlong,
  SOURCE_RADIUS,
  slicePath,
  SWITCH_HALF_HEIGHT,
  type Point,
} from './geometry';
import {
  boardHeight,
  boardPoint,
  forkExits,
  FORK_RADIUS,
  trackRoute,
  wireRoutes,
  type WireRoute,
} from './layout';
import { drawPanel } from './panel';
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
//
// Layers, back to front: brushed-metal panel (a canvas texture rebuilt on resize),
// fixed parts (track, cable runs, housings; redrawn only on layout change), moving
// parts (energy, gear, gates, ball; redrawn while something changes), and an additive glow layer.

const C = {
  recess: 0x0a0e15,
  channel: 0x171e2c,
  rail: 0x6b7487,
  railLight: 0xaab2c3,
  cable: 0x0c1017,
  energy: 0x4fd6e8,
  gold: 0xc9a45c,
  brassLight: 0xf0d08a,
  brassDark: 0x6e5a2e,
  metal: 0x8b94a8,
  metalDark: 0x3f4759,
  amber: 0xf0a43a,
  hazard: 0x1b1408,
  lampOff: 0x2b3140,
};

const MAX_RESOLUTION = 3;

interface Wire extends WireRoute {
  color: number;
}

export class Board {
  private app = new Application();
  private initPromise: Promise<void> | null = null;
  private destroyed = false;
  private panel = new Sprite();
  private panelTexture: Texture | null = null;
  private fixed = new Graphics();
  private moving = new Graphics();
  private glow = new Graphics();
  private gradients = makeGradients();
  private level: LevelDef | null = null;
  private timeline: Timeline | null = null;
  private startedAt = 0;
  private visual: VisualState = emptyVisual(null);
  private resolvePlay: (() => void) | null = null;
  private dirty = true;
  private layoutDirty = true;
  private reducedMotion = false;
  /** True while something idles in motion (sparks, gear), so frames keep drawing. */
  private animatedIdle = false;
  private wires = new Map<string, Wire>();
  /** Switch and source signals for the current picture; NOT wires and forks read them. */
  private signals: ReadonlyMap<NodeId, boolean> = new Map();
  private forks = new Map<NodeId, NodeId>();

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
      this.glow.blendMode = 'add';
      const stage = new Container();
      stage.addChild(this.panel, this.fixed, this.moving, this.glow);
      this.app.stage.addChild(stage);
      this.app.renderer.on('resize', () => (this.layoutDirty = true));
      this.app.ticker.add(() => this.frame());
      document.addEventListener('visibilitychange', this.onVisibility);
    })();
    return this.initPromise;
  }

  /** Renders sharply at the on-screen scale the board is shown at. */
  setScale(scale: number) {
    const resolution = Math.min(
      Math.min(window.devicePixelRatio || 1, 2) * Math.max(scale, 1),
      MAX_RESOLUTION,
    );
    if (Math.abs(resolution - this.app.renderer.resolution) < 0.01) return;
    this.app.renderer.resize(this.app.screen.width, this.app.screen.height, resolution);
    this.layoutDirty = true;
    this.dirty = true;
  }

  private setSignals(level: LevelDef, signals: ReadonlyMap<NodeId, boolean>) {
    this.signals = signals;
    this.forks = forkExits(level, signals);
  }

  setLevel(level: LevelDef) {
    this.level = level;
    this.layoutDirty = true;
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
      this.setSignals(this.level, signals);
      for (const edge of this.level.signalEdges) {
        const key = edgeKey(edge.from, edge.to);
        visual.reached.set(key, 1);
        const live = (signals.get(edge.from) ?? false) !== (edge.invert ?? false);
        if (live) visual.wires.set(key, 1);
      }
    }
    this.visual = visual;
    this.dirty = true;
  }

  /** Plays a RUN. Resolves when the last cue has finished. */
  play(events: readonly RunEvent[], timing: Timing): Promise<void> {
    this.finishPlayback();
    if (this.level) {
      const signals = new Map<NodeId, boolean>();
      for (const e of events) if (e.type === 'signal') signals.set(e.nodeId, e.value);
      this.setSignals(this.level, signals);
    }
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
    document.removeEventListener('visibilitychange', this.onVisibility);
    void this.initPromise
      ?.catch(() => {})
      .then(() => {
        try {
          this.app.destroy(true, { children: true });
        } catch {
          // A failed init leaves nothing to tear down.
        }
        this.panelTexture?.destroy(true);
        for (const gradient of Object.values(this.gradients)) gradient.destroy();
      });
  }

  /** Stop drawing while the page is hidden; on return the timeline picks up where time says. */
  private onVisibility = () => {
    if (document.hidden) this.app.ticker.stop();
    else {
      this.app.ticker.start();
      this.dirty = true;
    }
  };

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
    if (!this.level) return;
    if (this.layoutDirty) {
      this.layoutDirty = false;
      this.dirty = true;
      this.layout(this.level);
    }
    if (this.animatedIdle && !this.reducedMotion) this.dirty = true;
    if (!this.dirty) return;
    this.dirty = false;
    this.drawMoving(this.level, this.visual, performance.now());
  }

  private at(level: LevelDef, id: NodeId): Point {
    const node = indexLevel(level).nodes.get(id)!;
    return boardPoint(node.x, node.y, boardHeight(level));
  }

  /** Rebuilds everything that only changes with size or level. */
  private layout(level: LevelDef) {
    const { width, height } = this.app.screen;
    const at = (id: NodeId) => this.at(level, id);

    this.panelTexture?.destroy(true);
    this.panelTexture = Texture.from(drawPanel(width, height, this.app.renderer.resolution));
    this.panel.texture = this.panelTexture;
    this.panel.width = width;
    this.panel.height = height;

    this.wires.clear();
    for (const [key, route] of wireRoutes(level)) {
      this.wires.set(key, { ...route, color: toHex(signalColor(level, route.edge.from)) });
    }

    const g = this.fixed;
    g.clear();

    // Track: a recessed channel with two rails.
    for (const [from, to] of trackLinks(level)) {
      const route = trackRoute(level, from, to);
      for (let i = 1; i < route.length; i++) this.drawTrack(g, route[i - 1]!, route[i]!);
    }

    // Cable runs: a dark sheath with the switch's color showing through.
    for (const { points, color } of this.wires.values()) {
      line(g, points, 7, C.cable, 0.9);
      line(g, points, 3, color, 0.32);
    }

    for (const node of level.nodes) {
      const p = at(node.id);
      switch (node.type) {
        case 'switch':
          // Shadow under the DOM lever plate.
          g.roundRect(p.x - 30, p.y - SWITCH_HALF_HEIGHT + 4, 60, 2 * SWITCH_HALF_HEIGHT, 12).fill({
            color: 0x000000,
            alpha: 0.35,
          });
          break;
        case 'source':
          g.circle(p.x + 2, p.y + 3, SOURCE_RADIUS + 4).fill({ color: 0x000000, alpha: 0.35 });
          g.circle(p.x, p.y, SOURCE_RADIUS + 3).fill(this.gradients.brass);
          g.circle(p.x, p.y, SOURCE_RADIUS - 2).fill(C.recess);
          break;
        case 'ballStart':
          g.circle(p.x, p.y, 17).fill(C.recess).stroke({ width: 3, color: C.metalDark });
          g.circle(p.x, p.y, 17).stroke({ width: 1, color: C.railLight, alpha: 0.25 });
          break;
        case 'goal':
          g.circle(p.x + 2, p.y + 3, 21).fill({ color: 0x000000, alpha: 0.35 });
          g.circle(p.x, p.y, 20).fill(this.gradients.brass);
          g.circle(p.x, p.y, 14).fill(C.recess);
          g.circle(p.x, p.y, 14).stroke({ width: 1.5, color: C.brassDark });
          g.circle(p.x, p.y, 5).fill({ color: C.gold, alpha: 0.25 });
          break;
        case 'deadEnd':
          g.roundRect(p.x - 6, p.y - 16, 12, 32, 3).fill(C.metalDark);
          for (let i = 0; i < 4; i++) {
            g.moveTo(p.x - 6, p.y - 12 + i * 8)
              .lineTo(p.x + 6, p.y - 8 + i * 8)
              .stroke({ width: 2, color: C.amber, alpha: 0.7 });
          }
          break;
        case 'junction':
          // Turntable plate; the pointer showing where it sends the ball moves with power.
          g.circle(p.x + 2, p.y + 3, 18).fill({ color: 0x000000, alpha: 0.35 });
          g.circle(p.x, p.y, FORK_RADIUS)
            .fill(this.gradients.metal)
            .stroke({ width: 2, color: C.metalDark });
          g.circle(p.x, p.y, 12).fill(C.channel);
          break;
        case 'gate':
          break;
      }
    }
  }

  /** A recessed channel with two rails, extended past its ends so bends join cleanly. */
  private drawTrack(g: Graphics, a0: Point, b0: Point) {
    const len = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1;
    const ex = ((b0.x - a0.x) / len) * 5;
    const ey = ((b0.y - a0.y) / len) * 5;
    const a = { x: a0.x - ex, y: a0.y - ey };
    const b = { x: b0.x + ex, y: b0.y + ey };
    line(g, [a, b], 22, C.recess);
    line(g, [a, b], 17, C.channel);
    const nx = (-(b.y - a.y) / (len + 10)) * 5;
    const ny = ((b.x - a.x) / (len + 10)) * 5;
    line(
      g,
      [
        { x: a.x + nx, y: a.y + ny },
        { x: b.x + nx, y: b.y + ny },
      ],
      2,
      C.rail,
    );
    line(
      g,
      [
        { x: a.x - nx, y: a.y - ny },
        { x: b.x - nx, y: b.y - ny },
      ],
      2,
      C.rail,
    );
    line(
      g,
      [
        { x: a.x - nx, y: a.y - ny - 1 },
        { x: b.x - nx, y: b.y - ny - 1 },
      ],
      1,
      C.railLight,
      0.45,
    );
  }

  /** Draws everything that moves: energy, the gear, gates, ball and effects. */
  private drawMoving(level: LevelDef, visual: VisualState, now: number) {
    const g = this.moving;
    const glow = this.glow;
    const at = (id: NodeId) => this.at(level, id);
    const still = this.reducedMotion;
    g.clear();
    glow.clear();
    this.animatedIdle = false;

    // Energy along live wires, with sparks flowing once the wire is fully lit. A NOT wire
    // lights before the NOT when the switch is live, and after it when the switch is not.
    const energize = (points: Point[], color: number, done: boolean) => {
      if (points.length < 2) return;
      line(glow, points, 12, color, 0.18);
      line(g, points, 3.5, color);
      if (!done) return;
      this.animatedIdle = true;
      const sparks = Math.max(1, Math.round(pathLength(points) / 42));
      const phase = still ? 0.5 : (now / 1200) % 1;
      for (let i = 0; i < sparks; i++) {
        const s = pointAlong(points, (phase + i / sparks) % 1);
        glow.circle(s.x, s.y, 4).fill({ color, alpha: 0.35 });
        g.circle(s.x, s.y, 1.8).fill({ color: 0xffffff, alpha: 0.9 });
      }
    };
    for (const [key, wire] of this.wires) {
      if (wire.flip) {
        const r = visual.reached.get(key) ?? 0;
        if (r <= 0) continue;
        const f = wire.flip.at;
        if (this.signals.get(wire.edge.from)) {
          energize(slicePath(wire.points, 0, Math.min(r, f)), wire.color, r >= 1);
        } else if (r > f) {
          energize(slicePath(wire.points, f, r), wire.color, r >= 1);
        }
        continue;
      }
      const p = visual.wires.get(key);
      if (p === undefined || p <= 0) continue;
      energize(partialPath(wire.points, p), wire.color, p >= 1);
    }
    // NOT housings sit over the energy so the flip reads as a part. The word is a DOM tag.
    for (const { flip } of this.wires.values()) {
      if (!flip) continue;
      const n = flip.point;
      g.roundRect(n.x - 17, n.y - 9, 34, 18, 5)
        .fill(C.recess)
        .stroke({ width: 1.5, color: C.gold });
    }

    for (const node of level.nodes) {
      const p = at(node.id);
      if (node.type === 'source') {
        this.animatedIdle = true;
        const angle = still ? 0 : now / 900;
        drawGear(g, p, SOURCE_RADIUS - 4, SOURCE_RADIUS - 9, 10, angle, this.gradients.brass);
        g.circle(p.x, p.y, 4).fill(C.recess);
        const pulse = still ? 0.2 : 0.16 + 0.06 * Math.sin(now / 400);
        glow.circle(p.x, p.y, SOURCE_RADIUS + 10).fill({ color: C.energy, alpha: pulse });
      } else if (node.type === 'junction') {
        const exit = this.forks.get(node.id);
        if (exit) {
          const lane = trackRoute(level, node.id, exit);
          const q = lane[1]!;
          const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
          const ux = (q.x - p.x) / len;
          const uy = (q.y - p.y) / len;
          // Glow along the chosen lane, and a brass pointer aimed down it.
          line(glow, lane, 10, C.gold, 0.16);
          const tip = { x: p.x + ux * 13, y: p.y + uy * 13 };
          g.poly([
            tip.x,
            tip.y,
            p.x - uy * 6 - ux * 4,
            p.y + ux * 6 - uy * 4,
            p.x + uy * 6 - ux * 4,
            p.y - ux * 6 - uy * 4,
          ]).fill(C.gold);
          g.circle(p.x, p.y, 3).fill(C.recess);
        }
      } else if (node.type === 'gate') {
        const finish = visual.finish;
        const flash = finish?.result === 'blocked' && finish.nodeId === node.id ? finish.p : null;
        drawGate(g, glow, p, visual.gates.get(node.id), flash, this.gradients);
      }
    }

    drawFinish(g, glow, visual, at);
    const finish = visual.finish;
    const approach = finish && trackLinks(level).find(([, to]) => to === finish.nodeId)?.[0];
    const route = (from: NodeId, to: NodeId) => trackRoute(level, from, to);
    const before = approach ? route(approach, finish.nodeId).at(-2)! : null;
    drawBall(g, glow, visual, at, route, before, this.gradients.ball);
  }
}

function emptyVisual(ballStart: NodeId | null): VisualState {
  return {
    wires: new Map(),
    reached: new Map(),
    gates: new Map(),
    ball: ballStart ? { at: ballStart } : null,
    finish: null,
  };
}

function makeGradients() {
  return {
    brass: new FillGradient({
      type: 'radial',
      center: { x: 0.35, y: 0.3 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.55,
      colorStops: [
        { offset: 0, color: C.brassLight },
        { offset: 0.55, color: C.gold },
        { offset: 1, color: C.brassDark },
      ],
      textureSpace: 'local',
    }),
    metal: new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
      colorStops: [
        { offset: 0, color: 0x4a5266 },
        { offset: 0.45, color: 0xa7afc0 },
        { offset: 1, color: 0x3f4759 },
      ],
      textureSpace: 'local',
    }),
    ball: new FillGradient({
      type: 'radial',
      center: { x: 0.35, y: 0.3 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: 0xffffff },
        { offset: 0.3, color: 0xe2e6ee },
        { offset: 0.75, color: 0x8d95a6 },
        { offset: 1, color: 0x4b5366 },
      ],
      textureSpace: 'local',
    }),
  };
}

type Gradients = ReturnType<typeof makeGradients>;

function line(g: Graphics, points: readonly Point[], width: number, color: number, alpha = 1) {
  if (points.length < 2) return;
  g.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i]!.x, points[i]!.y);
  g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
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

function drawGear(
  g: Graphics,
  p: Point,
  outer: number,
  inner: number,
  teeth: number,
  angle: number,
  fill: FillGradient,
) {
  const points: number[] = [];
  const steps = teeth * 4;
  for (let i = 0; i < steps; i++) {
    const a = angle + (i / steps) * Math.PI * 2;
    const r = i % 4 < 2 ? outer : inner;
    points.push(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
  }
  g.poly(points).fill(fill);
}

/**
 * A portcullis: two pillars under a header with a status lamp, and a bar that lifts.
 * Unresolved gates are plain steel; a closed gate shows hazard stripes.
 */
function drawGate(
  g: Graphics,
  glow: Graphics,
  p: Point,
  openness: number | undefined,
  blockedFlash: number | null,
  gradients: Gradients,
) {
  const h = GATE_HALF_HEIGHT;
  const headerBottom = p.y - h - 8;
  const o = openness ?? 0;
  const resolved = openness !== undefined;
  const open = resolved && o > 0.5;

  // Bar, drawn first so the header covers it as it lifts.
  const shake =
    blockedFlash !== null ? Math.sin(blockedFlash * Math.PI * 8) * 2 * (1 - blockedFlash) : 0;
  const top = Math.max(headerBottom, p.y - h - o * (2 * h + 2));
  const bottom = p.y + h - o * (2 * h + 2);
  if (bottom > top + 1) {
    const x0 = p.x - 9 + shake;
    if (resolved && !open) {
      g.rect(x0, top, 18, bottom - top).fill(C.amber);
      for (let y = top + 2; y + 8 <= bottom; y += 10) {
        g.moveTo(x0 + 1, y + 8)
          .lineTo(x0 + 17, y)
          .stroke({ width: 3.5, color: C.hazard, alpha: 0.6 });
      }
    } else {
      g.rect(x0, top, 18, bottom - top).fill(gradients.metal);
      for (let y = top + 6; y < bottom - 2; y += 8) {
        g.moveTo(x0 + 2, y)
          .lineTo(x0 + 16, y)
          .stroke({ width: 1, color: 0x000000, alpha: 0.25 });
      }
    }
  }

  // Pillars and header.
  g.roundRect(p.x - 19, p.y - h - 10, 8, 2 * h + 18, 2).fill(gradients.metal);
  g.roundRect(p.x + 11, p.y - h - 10, 8, 2 * h + 18, 2).fill(gradients.metal);
  g.roundRect(p.x - 22, p.y - h - 17, 44, 10, 3)
    .fill(C.metalDark)
    .stroke({ width: 1, color: C.metal, alpha: 0.5 });

  // Status lamp: dark until the run resolves the gate.
  const lamp = !resolved ? C.lampOff : open ? C.energy : C.amber;
  g.circle(p.x, p.y - h - 12, 3.5).fill(lamp);
  if (resolved) glow.circle(p.x, p.y - h - 12, 10).fill({ color: lamp, alpha: 0.35 });
  if (blockedFlash !== null) {
    glow.circle(p.x, p.y, 34).fill({ color: C.amber, alpha: 0.18 * (1 - blockedFlash * 0.6) });
  }
}

type RouteOf = (from: NodeId, to: NodeId) => Point[];

function ballPosition(
  visual: VisualState,
  at: (id: NodeId) => Point,
  route: RouteOf,
): Point | null {
  const ball = visual.ball;
  if (!ball) return null;
  if ('at' in ball) return at(ball.at);
  return pointAlong(route(ball.from, ball.to), ball.p);
}

function drawBall(
  g: Graphics,
  glow: Graphics,
  visual: VisualState,
  at: (id: NodeId) => Point,
  route: RouteOf,
  approach: Point | null,
  fill: FillGradient,
) {
  const pos = ballPosition(visual, at, route);
  if (!pos) return;
  let { x, y } = pos;
  const finish = visual.finish;
  if (finish?.result === 'blocked' || finish?.result === 'deadEnd') {
    // Bounce back from the obstacle, then settle just in front of it.
    const back = Math.sin(Math.min(1, finish.p * 2) * Math.PI) * 6 + 28 * Math.min(1, finish.p * 3);
    const dx = approach ? x - approach.x : 1;
    const dy = approach ? y - approach.y : 0;
    const len = Math.hypot(dx, dy) || 1;
    x -= (dx / len) * back;
    y -= (dy / len) * back;
  }
  const ball = visual.ball;
  if (ball && 'from' in ball) {
    // Motion trail while rolling, pointing back along the current leg of the route.
    const legs = route(ball.from, ball.to);
    const b = pointAlong(legs, Math.min(1, ball.p + 0.02));
    const a = pointAlong(legs, Math.max(0, ball.p - 0.02));
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    for (let i = 1; i <= 3; i++) {
      glow
        .circle(x - ((b.x - a.x) / len) * i * 7, y - ((b.y - a.y) / len) * i * 7, 9 - i * 1.5)
        .fill({ color: 0xffffff, alpha: 0.12 / i });
    }
  }
  g.circle(x + 2, y + 3, 11).fill({ color: 0x000000, alpha: 0.4 });
  g.circle(x, y, 11).fill(fill);
  g.circle(x - 3.5, y - 4, 2.6).fill({ color: 0xffffff, alpha: 0.95 });
}

function drawFinish(g: Graphics, glow: Graphics, visual: VisualState, at: (id: NodeId) => Point) {
  const finish = visual.finish;
  if (!finish) return;
  const p = at(finish.nodeId);
  const q = finish.p;
  if (finish.result === 'goal') {
    glow.circle(p.x, p.y, 14 + 10 * (1 - q)).fill({ color: C.gold, alpha: 0.5 * (1 - q) + 0.15 });
    for (const [delay, color] of [
      [0, C.gold],
      [0.2, C.energy],
      [0.4, C.gold],
    ] as const) {
      const r = Math.max(0, Math.min(1, (q - delay) / (1 - delay)));
      if (r > 0) {
        glow
          .circle(p.x, p.y, 20 + r * 48)
          .stroke({ width: 3 * (1 - r) + 0.5, color, alpha: 1 - r });
      }
    }
    // Sparks thrown up and pulled down by gravity; fixed angles keep it deterministic.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2;
      const speed = 55 + (i % 3) * 22;
      const sx = p.x + Math.cos(a) * speed * q;
      const sy = p.y + Math.sin(a) * speed * q - 30 * q + 90 * q * q;
      glow
        .circle(sx, sy, 2.6 * (1 - q) + 0.4)
        .fill({ color: i % 2 ? C.gold : C.energy, alpha: 1 - q });
    }
  } else {
    // A short burst of amber sparks where the ball struck, then a steady marker ring.
    if (q < 0.6) {
      const r = q / 0.6;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        glow
          .circle(p.x - 14 + Math.cos(a) * 18 * r, p.y + Math.sin(a) * 18 * r, 2 * (1 - r))
          .fill({ color: C.amber, alpha: 1 - r });
      }
    }
    g.circle(p.x, p.y, 32).stroke({ width: 2, color: C.amber, alpha: 0.25 + 0.45 * q });
  }
}

// The Cnmbuck Orb in 3D, as Gravitor shows it: the brand kit's ball material and rim glow, lit the
// way Gravitor lights it (the kit's tools/render.ts), drawn into a small canvas the board shows as a
// sprite. Loaded on demand, because three.js is only needed once the Orb is the ball.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createOrbMaterial, OrbFx } from '@cnmbuck/orb';

/** The flat Orb, for when WebGL isn't there. */
export { drawOrbIcon } from '@cnmbuck/orb';

const RADIUS = 0.5;
/** The canvas shows this many radii either side of the centre, room for the halo (2.1 radii). */
const VIEW = 2.2;
const FOV = 30;
/** A sprite this many times the ball's on-screen radius fits the view. */
export const ORB3D_SPRITE_PER_RADIUS = 2 * VIEW;

export class Orb3d {
  readonly canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  private ball: THREE.Mesh;
  private fx = new OrbFx(RADIUS, { groundGlow: false });
  /** The ball's turn: starts with the band across it, as in the kit's 3D render. */
  private turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 1.55));
  private step = new THREE.Quaternion();
  private axis = new THREE.Vector3();
  private readonly origin = new THREE.Vector3();

  constructor() {
    // The renderer settings the Orb was tuned under (the kit's examples/three-usage.ts), on a clear
    // background so the board shows through.
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    // Lit as in the kit's reference render of the Orb in 3D
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight('#6fa8ff', '#1a0f2e', 0.5));
    const key = new THREE.DirectionalLight('#ffffff', 1.2);
    key.position.set(2, 4, 3);
    this.scene.add(key);
    // Looking straight down on the board, so the ball fills the middle of the canvas
    this.camera.position.set(0, 0, (VIEW * RADIUS) / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    this.camera.lookAt(0, 0, 0);
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 32), createOrbMaterial());
    this.scene.add(this.ball);
    this.fx.on = true;
    this.scene.add(this.fx.group);
  }

  /** Forget the turn, so a new board starts with the band across the ball. */
  reset() {
    this.turn.setFromEuler(new THREE.Euler(0.35, 0, 1.55));
  }

  /**
   * Rolls the ball by a move on the board (screen pixels, y down) for a ball `radius` pixels across:
   * it turns about the axis at right angles to the move, by the distance over the radius.
   */
  roll(dx: number, dy: number, radius: number) {
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;
    // Seen from above (+z), a move of (dx, -dy) on the ground turns the ball about up × move.
    this.axis.set(dy / dist, dx / dist, 0);
    this.step.setFromAxisAngle(this.axis, dist / radius);
    this.turn.premultiply(this.step).normalize();
  }

  /** Draws the ball at `px` canvas pixels square. */
  render(px: number, dt: number) {
    if (this.canvas.width !== px) this.renderer.setSize(px, px, false);
    this.ball.quaternion.copy(this.turn);
    this.fx.update(this.origin, null, false, true, dt, this.camera, this.renderer);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

let shared: Orb3d | null = null;

/**
 * The one 3D Orb every board draws with. Setting up a WebGL renderer and its lighting (the PMREM
 * environment) is the slow part, so it happens once, the first time a ball is shown, and not again
 * each time a level opens. Only one board shows at a time; a new board resets the ball's turn.
 */
export function sharedOrb3d(): Orb3d {
  shared ??= new Orb3d();
  return shared;
}

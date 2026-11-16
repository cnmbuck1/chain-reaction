// Types for the parts of the Cnmbuck Orb kit the game uses.
//
// The kit (src/brand/cnmbuck-orb.ts) must stay byte for byte as it is in cnmbuck1/cnmbuckstudios-brand,
// but this project's stricter TypeScript settings (noUncheckedIndexedAccess) flag two lines in it. So
// the game imports it as '@cnmbuck/orb' (a Vite alias to the real file) and type-checks against these
// declarations instead. They mirror the kit's own signatures; keep them in step if the kit changes.
declare module '@cnmbuck/orb' {
  import type * as THREE from 'three';

  /** The Orb's colours. */
  export const ORB: {
    readonly glassDeep: 0x020818;
    readonly glass: 0x0c3486;
    readonly bandOuter: 0x0a8cff;
    readonly band: 0x00e5ff;
    readonly bandCore: 0xf0feff;
    readonly rimBlue: 0x00d8ff;
    readonly rimOrange: 0xff9a1a;
  };
  /** The Orb drawn flat in a `size` square at (x, y); `spin` turns the band for a rolling ball. */
  export function drawOrbIcon(
    g: CanvasRenderingContext2D,
    size: number,
    x?: number,
    y?: number,
    spin?: number,
    halo?: boolean,
  ): void;

  /** The Orb's material (built once and shared). Put it on a THREE.SphereGeometry. */
  export function createOrbMaterial(): THREE.MeshPhysicalMaterial;
  export interface OrbFxOptions {
    groundGlow?: boolean;
    trailLength?: number;
    trailLife?: number;
  }
  /** The Orb's extras: rim glow, halo, optional ground glow and light trail. */
  export class OrbFx {
    readonly group: THREE.Group;
    constructor(radius: number, opts?: OrbFxOptions);
    set on(v: boolean);
    get on(): boolean;
    update(
      pos: THREE.Vector3,
      groundY: number | null,
      moving: boolean,
      visible: boolean,
      dt: number,
      camera: THREE.PerspectiveCamera,
      renderer: THREE.WebGLRenderer,
    ): void;
  }
}

# Cnmbuck Orb

`cnmbuck-orb.ts` is copied **unchanged** from
[cnmbuck1/cnmbuckstudios-brand](https://github.com/cnmbuck1/cnmbuckstudios-brand) (`orb/cnmbuck-orb.ts`).
Never edit, reformat or lint it here; change it in the brand repo first, then copy it again.

Check the copy against the brand repo's checksum (copied alongside it):

```sh
(cd src/brand && sha256sum -c cnmbuck-orb.ts.sha256)   # cnmbuck-orb.ts: OK
```

The game imports it as `@cnmbuck/orb` (a Vite alias), with types from `src/cnmbuck-orb.d.ts`, because
this project's stricter TypeScript settings would flag two lines in the kit. The ball is the kit's 3D Orb
(`createOrbMaterial` and `OrbFx`, lit as in the kit's `tools/render.ts`), drawn by three.js into a small
canvas in `src/render/orb3d.ts` and shown on the board by `OrbBall` in `src/render/board.ts`, which rolls it
as it moves. three.js loads as its own chunk the first time the Orb is shown; `drawOrbIcon` stands in if
WebGL isn't there.

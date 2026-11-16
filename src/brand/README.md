# Cnmbuck Orb

`cnmbuck-orb.ts` is copied **unchanged** from
[cnmbuck1/cnmbuckstudios-brand](https://github.com/cnmbuck1/cnmbuckstudios-brand) (`orb/cnmbuck-orb.ts`).
Never edit, reformat or lint it here; change it in the brand repo first, then copy it again.

Check the copy against the brand repo's checksum (copied alongside it):

```sh
(cd src/brand && sha256sum -c cnmbuck-orb.ts.sha256)   # cnmbuck-orb.ts: OK
```

The game imports it as `@cnmbuck/orb` (a Vite alias), with types from `src/cnmbuck-orb.d.ts`, because
this project's stricter TypeScript settings would flag two lines in the kit. The board uses
`drawOrbIcon` with its `spin` argument for the rolling ball (`OrbBall` in `src/render/board.ts`).

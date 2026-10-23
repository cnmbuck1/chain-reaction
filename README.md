# Chain Reaction

A mobile-first, deterministic logic puzzle game (working title). Players set switches, press
**Run**, and watch power, gates and a ball play out exactly as the logic engine computed.

Status: **M1, logic-first vertical slice.** The engine, level validator, solver and Level 1 are
done, with a plain functional UI. The animated board, sound and levels 2 to 10 come in M2 to M4.

## Commands

| Command             | What it does                                                           |
| ------------------- | ---------------------------------------------------------------------- |
| `npm install`       | Install dependencies (Node 22+)                                        |
| `npm run dev`       | Start the dev server                                                   |
| `npm test`          | Run unit, determinism and level tests (Vitest)                         |
| `npm run levels`    | Print the solver report for every level; fails if any level is invalid |
| `npm run lint`      | ESLint                                                                 |
| `npm run typecheck` | TypeScript, strict                                                     |
| `npm run build`     | Typecheck and build to `dist/`                                         |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, the level report and the build on
every push.

## Rules (summary)

- **Signals.** A source is always TRUE. A switch outputs TRUE only when it is ON and at least one
  input is TRUE. No power is FALSE. A wire may be inverted. Signals are evaluated once per run in
  topological order, ties broken by node id.
- **Gates.** `combine` is `single`, `and` or `or`. A gate is open when the combined input equals
  `requiredSignal`, so `false` makes a normally-open gate.
- **Junctions.** Route the ball to `whenTrue` or `whenFalse` from one signal input.
- **Ball.** Follows the track from the start. It stops at the first closed gate or dead end.
  Reaching a goal wins.
- **Budget.** `maxToggles` limits how many switches may differ from the level's starting position.
  Flipping a changed switch back refunds it. The limit holds across attempts.
- **Run** keeps switch positions after a failure and clears Undo. **Undo** reverses the last toggle
  since the last run. **Reset** restores the starting positions.
- **Events.** Each run returns one ordered event list: signals and wires, then gates, then ball
  moves, then the outcome. Rendering only plays events back; it never decides the result.

## Layout

```
src/engine/   pure rules: types, graph index, evaluate, simulate, reducer, solver (no UI imports)
src/levels/   level data, schema validator, level checker
src/ui/       React screens (plain functional UI in M1)
tests/        Vitest: engine, determinism and properties, schema, every curated level
scripts/      level-report.ts
```

Planned for later milestones: `src/render/` (PixiJS board and animation timeline) and
`src/storage/` (versioned local progress).

## Level format

Levels are typed data (`LevelDef` in `src/engine/types.ts`). The track is a list of paths; each
consecutive pair is a directed link, and junction exits live on the junction node.
`meta.minChanges` must match what the solver finds; tests enforce it. The validator reports every
problem with a code: `DUPLICATE_ID`, `UNKNOWN_NODE`, `BAD_EDGE`, `SIGNAL_CYCLE`,
`SWITCH_NO_INPUT`, `GATE_NO_INPUT`, `GATE_ARITY`, `TRACK_SHAPE`, `TRACK_CYCLE`, `NOT_ON_TRACK`,
`BAD_POSITION`, `BAD_BUDGET`, plus the solver checks `UNSOLVABLE`, `TRIVIAL` and `MIN_MISMATCH`.

## Solver report

`npm run levels` lists, per level: minimum changes, one shortest solution, winning positions out of
those reachable within the budget, whether turning every switch ON wins, and whether a greedy "fix
whatever blocked the ball" player wins. For `medium` and `hard` levels the last two are errors,
because those levels should need deduction.

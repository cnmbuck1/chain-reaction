# Chain Reaction

A mobile-first, deterministic logic puzzle game (working title). Players set switches, press
**Run**, and watch power, gates and a ball play out exactly as the logic engine computed.

Status: **M4, all ten Phase 1 levels.** The game has:

- a brushed-metal machine drawn in PixiJS (cable wires, brass parts, portcullis gates, glowing
  energy) and lever switches;
- synthesized sound with a mute button, and vibration on phones that support it;
- a settings screen for sound, vibration, motion and resetting progress;
- saved progress, a level select, and a completion card after level 10;
- fallbacks when graphics fail to start.

The solver checks every level.

## Commands

| Command                | What it does                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| `npm install`          | Install dependencies (Node 22+)                                         |
| `npm run dev`          | Start the dev server                                                    |
| `npm test`             | Run unit, determinism, level, timeline and storage tests (Vitest)       |
| `npm run e2e`          | Play all ten levels in Chromium at phone and desktop sizes (Playwright) |
| `npm run levels`       | Print the solver report for every level; fails if any level is invalid  |
| `npm run lint`         | ESLint                                                                  |
| `npm run typecheck`    | TypeScript, strict                                                      |
| `npm run build`        | Typecheck and build to `dist/`                                          |
| `npm run build:single` | Build one bundled script to `dist-single/` for a shareable single page  |

Run `npx playwright install chromium` once before `npm run e2e`. After `build:single`,
`node scripts/single-page.mjs out.html` packs the build into one HTML page.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, the level report and the build, plus
the Playwright suite, on every push.

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
  moves, then the outcome.

**Animation never decides outcomes.** The engine computes the run; `buildTimeline` turns its events
into timed cues and `sampleTimeline` gives the frame at any moment. Reduced motion uses zero-length
cues, which land on the same final frame. Before a run, the wires show live power for the current
switch positions, but gates stay unresolved until Run, so the player still reasons about what
each gate will do.

## Layout

```
src/engine/   pure rules: types, graph index, evaluate, simulate, reducer, solver (no UI imports)
src/levels/   level data, schema validator, level checker
src/render/   PixiJS board, wire geometry, panel texture, and the timeline built from RUN events
src/audio/    WebAudio synth and the run's sound cues, read off the same timeline
src/storage/  versioned local progress and settings with safe fallbacks
src/ui/       React screens: game, level select, settings; switches and labels are DOM over the canvas
tests/        Vitest: engine, determinism, schema, levels, timeline, geometry, audio cues, storage;
              e2e/ for Playwright (iPhone 14, iPhone SE, desktop)
scripts/      level-report.ts, single-page.mjs
```

## Level format

Levels are typed data (`LevelDef` in `src/engine/types.ts`). The track is a list of paths; each
consecutive pair is a directed link, and junction exits live on the junction node.
`meta.minChanges` must match what the solver finds; tests enforce it. `meta.prompt` is an optional
coaching line for tutorial levels. The validator reports every problem with a code:
`DUPLICATE_ID`, `UNKNOWN_NODE`, `BAD_EDGE`, `SIGNAL_CYCLE`, `SWITCH_NO_INPUT`, `GATE_NO_INPUT`,
`GATE_ARITY`, `TRACK_SHAPE`, `TRACK_CYCLE`, `NOT_ON_TRACK`, `BAD_POSITION`, `BAD_BUDGET`, plus the
solver checks `UNSOLVABLE`, `TRIVIAL` and `MIN_MISMATCH`.

## Levels

| #   | Name           | Teaches                                                    | Budget | Min |
| --- | -------------- | ---------------------------------------------------------- | ------ | --- |
| 1   | First Spark    | A powered switch opens the gate it feeds                   | 1      | 1   |
| 2   | Reverse Logic  | OFF gates open only without power                          | 1      | 1   |
| 3   | Double Duty    | One switch can feed two gates                              | 2      | 2   |
| 4   | The Tradeoff   | Switch chains: B only has power if A does                  | 2      | 2   |
| 5   | Two Conditions | ALL ON gates need every wire powered                       | 3      | 3   |
| 6   | False Friend   | ANY ON gates; the obvious fix blocks a later gate          | 2      | 2   |
| 7   | Minimal Moves  | The step-by-step route costs 3; one switch fixes two gates | 2      | 2   |
| 8   | Split Signal   | One switch feeds three; choose which branches stay dark    | 3      | 3   |
| 9   | Interlock      | A forbidden route forces you to build the other one        | 3      | 3   |
| 10  | Master Circuit | Chains, splits, ALL/ANY gates and a false friend together  | 4      | 4   |

Each of levels 4 to 10 has exactly one winning position within its budget, and turning every
switch ON never wins. From level 5 on, a greedy player who fixes whatever blocked the ball also
fails. Level 4 is marked `easy` and still allows it.

## Known limitations

- The engine supports junctions (branching tracks) and inverted (NOT) wires, but no level uses
  them yet. Both were left out to keep the Phase 1 rule set small. The board draws them
  plainly, and they would need UI work before use.
- Boards are laid out for at most five switches and three gates on one straight track. More
  gates would crowd the labels at phone width.
- Tested in Chromium only, emulating iPhone 14, iPhone SE and desktop. Real iOS Safari and
  Android Chrome have not been checked. Vibration does nothing on iPhones, because Safari
  has no vibration API.
- Fonts come from Google Fonts. Offline, the game falls back to system fonts.
- Progress and settings live in this browser's local storage, with no sync between devices.
- The greedy-player check is a heuristic. A level passing it can still feel easy to some
  players, so playtesting is the real test.

## Questions for playtesters

Observe without coaching, as the build sheet asks.

1. Without the intro card, can players say what a lit wire means and what ON/OFF under a gate
   means? How long does it take before their first deliberate toggle?
2. On level 4, do players notice that B gets its power from A? Do they need the prompt?
3. Are "ALL ON", "ANY ON" and "ALL OFF" understood at a glance, or do players read them as a
   single switch requirement?
4. On level 7, do players hit the change limit on their first try? Does that feel fair or
   frustrating?
5. Where do players open Hint, and does the hint unblock them without giving the answer away?
6. Which level takes the longest, and do players say they would like to keep going after level
   10?
7. Is the sound welcome or quickly muted? Does anyone change the motion setting?

## Solver report

`npm run levels` lists, per level: minimum changes, one shortest solution, winning positions out of
those reachable within the budget, whether turning every switch ON wins, and whether a greedy "fix
whatever blocked the ball" player wins. For `medium` and `hard` levels the last two are errors,
because those levels should need deduction.

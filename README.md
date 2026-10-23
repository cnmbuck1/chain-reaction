# Chain Reaction

A mobile-first, deterministic logic puzzle game (working title). Players set switches, press
**Run**, and watch power, gates and a ball play out exactly as the logic engine computed.

Status: **Stage 2, S3: twenty levels, with forks from level 11 and two-part boards from level 16.** The game has:

- a brushed-metal machine drawn in PixiJS (cable wires, brass parts, portcullis gates, glowing
  energy) and lever switches;
- synthesized sound with a mute button, and vibration on phones that support it;
- a settings screen for sound, vibration, motion and resetting progress;
- saved progress, a level select, and a completion card after the last level;
- hints that make a free move, with a demo shop for more;
- fallbacks when graphics fail to start.

The solver checks every level.

## Commands

| Command                | What it does                                                           |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm install`          | Install dependencies (Node 22+)                                        |
| `npm run dev`          | Start the dev server                                                   |
| `npm test`             | Run unit, determinism, level, timeline and storage tests (Vitest)      |
| `npm run e2e`          | Play every level in Chromium at phone and desktop sizes (Playwright)   |
| `npm run levels`       | Print the solver report for every level; fails if any level is invalid |
| `npm run lint`         | ESLint                                                                 |
| `npm run typecheck`    | TypeScript, strict                                                     |
| `npm run build`        | Typecheck and build to `dist/`                                         |
| `npm run build:single` | Build one bundled script to `dist-single/` for a shareable single page |

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
- **NOT wires.** A wire with `invert` flips its signal. The board draws a NOT part on the wire,
  lit before it when the switch is live and after it when not. Playtesting found NOT hard this
  early, so no level uses it before level 21; a test enforces that.
- **Forks (junctions).** Route the ball to `whenTrue` (ON lane) or `whenFalse` (OFF lane) from one
  signal input. The board shows a pointer aimed down the lane the fork will take.
- **Parts (checkpoints).** A staged board is split into parts by `checkpoint` nodes on the
  track. Each switch has a `stage` (0 is part A). Only the part in play can be changed; the
  ball stops at that part's checkpoint, the part's switches lock where they are, and the next
  run starts from the checkpoint. A cleared part's switches still power their wires, so wires
  crossing into a later part make the way part A is cleared matter. Reaching a checkpoint is
  not a miss: the attempt count stays the same.
- **Ball.** Follows the track from the start. It stops at the first closed gate or dead end.
  Reaching a goal wins.
- **Budget.** `maxToggles` limits how many switches may differ from the level's starting position.
  Flipping a changed switch back refunds it. The limit holds across attempts. On staged boards
  each part gets its own `maxToggles`.
- **Run** keeps switch positions after a failure and clears Undo. **Undo** reverses the last toggle
  since the last run. **Reset** restores the starting positions, and on staged boards goes back to part A.
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
src/render/   PixiJS board, board layout and wire geometry, panel texture, and the RUN timeline
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
coaching line, used on tutorial levels and where a new part appears. `boardHeight` (layout
pixels, default 400) gives fork levels room for two lanes, and two-part boards room for both parts. The validator reports every problem with a code:
`DUPLICATE_ID`, `UNKNOWN_NODE`, `BAD_EDGE`, `SIGNAL_CYCLE`, `SWITCH_NO_INPUT`, `GATE_NO_INPUT`,
`GATE_ARITY`, `TRACK_SHAPE`, `TRACK_CYCLE`, `NOT_ON_TRACK`, `BAD_POSITION`, `BAD_BUDGET`,
`BAD_STAGE`, plus the
solver checks `UNSOLVABLE`, `TRIVIAL` and `MIN_MISMATCH`.

## Levels

| #   | Name             | Teaches                                                    | Budget | Min |
| --- | ---------------- | ---------------------------------------------------------- | ------ | --- |
| 1   | First Spark      | A powered switch opens the gate it feeds                   | 1      | 1   |
| 2   | Reverse Logic    | OFF gates open only without power                          | 1      | 1   |
| 3   | Double Duty      | One switch can feed two gates                              | 2      | 2   |
| 4   | The Tradeoff     | Switch chains: B only has power if A does                  | 2      | 2   |
| 5   | Two Conditions   | ALL ON gates need every wire powered                       | 3      | 3   |
| 6   | False Friend     | ANY ON gates; the obvious fix blocks a later gate          | 2      | 2   |
| 7   | Minimal Moves    | The step-by-step route costs 3; one switch fixes two gates | 2      | 2   |
| 8   | Split Signal     | One switch feeds three; choose which branches stay dark    | 3      | 3   |
| 9   | Interlock        | A forbidden route forces you to build the other one        | 3      | 3   |
| 10  | Master Circuit   | Chains, splits, ALL/ANY gates and a false friend together  | 4      | 4   |
| 11  | Fork in the Road | A fork picks the lane; change the route, not the gates     | 1      | 1   |
| 12  | Dead Lane        | A lane whose gates contradict each other can never open    | 2      | 2   |
| 13  | Long Way Round   | Count what each lane costs; rerouting can be cheaper       | 2      | 2   |
| 14  | Switchyard       | One switch both picks the lane and guards the other one    | 2      | 2   |
| 15  | Grand Junction   | Rule out a lane, then follow a chain on the other one      | 3      | 3   |
| 16  | Two Parts        | Clear part A, then part B opens                            | 1 + 1  | 2   |
| 17  | Second Wind      | Each part has its own changes to spend                     | 2 + 2  | 4   |
| 18  | Carry Over       | A wire crosses into part B, so clear part A the right way  | 1 + 1  | 2   |
| 19  | Relay Race       | Spend a spare change in part A to set up part B            | 2 + 2  | 4   |
| 20  | Grand Finale     | Plan both parts before the first run                       | 2 + 2  | 4   |

Each of levels 4 to 20 has exactly one winning position within its budget, and turning every
switch ON never wins. From level 5 on, a greedy player who fixes whatever blocked the ball also
fails, except on the `easy` levels 4, 11, 16 and 17, which introduce a new idea. On levels 18
to 20 the greedy player clears part A the obvious way and finds part B out of reach; the game
then says so and suggests Reset.

## Board layout

The board is laid out at 360 layout pixels wide (`src/render/layout.ts`) and scaled to fit the
screen, so every phone shows the same picture and labels can't collide on small screens. A
browser test opens every level at 320 by 568 and fails if any switch or label overlaps another
or leaves the board. On fork boards, wires turn just below their switch and drop straight into
their gate, and several wires into one gate land side by side.

Two-part boards stack part A over part B with a dashed seam between them. The part not in play
is shaded and its switches dimmed; when the ball reaches the checkpoint, the shade slides onto
the part just cleared. Wires crossing into part B drop straight down a column clear of part B's
own switches.

The board draws only when something changes, rather than every frame, which keeps phones cool
and the browser tests quick.

## Hints

A hint is a free move. The game sets one switch to where every solution needs it, locks it
there and marks it with a HINT pin. The move doesn't count against the level's changes:
`withFreeMoves` (`src/hints/freeMoves.ts`) rebuilds the level with that switch's start moved
to its target, so the engine needs no special case beyond refusing to toggle a locked switch.

The first move is always `meta.keySwitch`, then the rest of the solver's solution, part by
part on staged boards. A hint asked for in part B passes over moves left for part A. A level
gives at most one fewer move than its minimum changes, so the player always makes the last
change, except on one-change levels. `checkLevel` reports `BAD_HINT` when the key switch
doesn't need to change or solutions disagree on it.

Players start with 2 hints, stored in `chain-reaction/hints` apart from progress, so resetting
progress doesn't refill them. Hints on levels 1 to 3 are free. Moves already made stay made,
including on replays.

When hints run out, "Get more hints" calls a `HintShop` (`src/monetize/hintShop.ts`). The
current one is a demo that grants hints without showing an ad or charging anything. AdMob and
App Store / Google Play in-app purchases replace it in the native-app milestone.

## Known limitations

- Fork boards hold one fork and two lanes. A second fork would need more height and new wire
  routing.
- Boards fit about four or five switches across. Wires can cross tracks, which is legal but
  busier to read.
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

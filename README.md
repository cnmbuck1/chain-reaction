# Chain Reaction

A mobile-first, deterministic logic puzzle game (working title). Players set switches, press
**Run**, and watch power, gates and a ball play out exactly as the logic engine computed.

Status: **Stage 2, S3: twenty levels, with forks from level 11 and two-part boards from level 16.** The game has:

- a brushed-metal machine drawn in PixiJS (cable wires, brass parts, portcullis gates, glowing
  energy) and lever switches;
- synthesized sound with a mute button, and vibration on phones that support it;
- a settings screen for sound, vibration, motion and resetting progress;
- a win sequence (the goal lights, light runs back along the ball's route, a chord plays) and a
  result card with stars, Next challenge, Replay and Levels;
- saved progress, a level select, and a closing note after the last level;
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
- **Changes and par.** A change is a switch that differs from the level's starting position, so
  flipping one back undoes it. There is no limit. `meta.minChanges` is the level's par, shown
  beside the change count; a solve at par can earn the third star. On staged boards
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
`GATE_ARITY`, `TRACK_SHAPE`, `TRACK_CYCLE`, `NOT_ON_TRACK`, `BAD_POSITION`,
`BAD_STAGE`, plus the
solver checks `UNSOLVABLE`, `TRIVIAL` and `MIN_MISMATCH`.

## Levels

| #   | Name             | Teaches                                                    | Par | Guess   |
| --- | ---------------- | ---------------------------------------------------------- | --- | ------- |
| 1   | First Spark      | A powered switch opens the gate it feeds                   | 1   | 1 in 1  |
| 2   | Reverse Logic    | OFF gates open only without power                          | 1   | 1 in 1  |
| 3   | Double Duty      | One switch can feed two gates                              | 2   | 1 in 1  |
| 4   | The Tradeoff     | Switch chains: B only has power if A does                  | 2   | 1 in 1  |
| 5   | Two Conditions   | ALL ON gates need every wire powered                       | 3   | 1 in 1  |
| 6   | False Friend     | ANY ON gates; the obvious fix blocks a later gate          | 2   | 1 in 3  |
| 7   | Minimal Moves    | The step-by-step route costs 3; one switch fixes two gates | 2   | 1 in 6  |
| 8   | Split Signal     | One switch feeds three; choose which branches stay dark    | 3   | 1 in 4  |
| 9   | Interlock        | A forbidden route forces you to build the other one        | 3   | 1 in 4  |
| 10  | Master Circuit   | Chains, splits, ALL/ANY gates and a false friend together  | 4   | 1 in 5  |
| 11  | Fork in the Road | A fork picks the lane; change the route, not the gates     | 1   | 1 in 3  |
| 12  | Dead Lane        | A lane whose gates contradict each other can never open    | 2   | 1 in 3  |
| 13  | Long Way Round   | Count what each lane costs; rerouting can be cheaper       | 2   | 1 in 6  |
| 14  | Switchyard       | One switch both picks the lane and guards the other one    | 2   | 1 in 3  |
| 15  | Grand Junction   | Rule out a lane, then follow a chain on the other one      | 3   | 1 in 4  |
| 16  | Two Parts        | Clear part A, then part B opens                            | 2   | 1 in 6  |
| 17  | Second Wind      | Each part is its own puzzle: clear one, then the next      | 4   | 1 in 15 |
| 18  | Carry Over       | A wire crosses into part B, so clear part A the right way  | 2   | 1 in 3  |
| 19  | Relay Race       | A change in part A can set up part B                       | 4   | 1 in 5  |
| 20  | Grand Finale     | Plan both parts before the first run                       | 4   | 1 in 5  |

Every level has exactly one winning position at par, and from level 4 on turning every switch
ON never wins. Without a change limit some levels also have longer wins, which earn at most two
stars. From level 5 on, a greedy player who fixes whatever blocked the ball never wins at par,
except on the `easy` levels 4, 11, 16 and 17, which introduce a new idea. On levels 18
to 20 the greedy player clears part A the obvious way and finds part B out of reach; the game
then says so and suggests Reset.

## Board layout

The board is laid out at 360 layout pixels wide (`src/render/layout.ts`) and scaled to fit the
screen, so every phone shows the same picture and labels can't collide on small screens. A
browser test opens every level at 320 by 568 and fails if any switch or label overlaps another
or leaves the board. On fork boards, wires turn just below their switch and drop straight into
their gate, and several wires into one gate land side by side.

Two-part boards stack part A over part B, but the screen shows one part at a time, scaled to
fill the board (`partViews` in `layout.ts`), so each part reads as large as a one-part level.
The ball drops off the bottom of part A into the checkpoint, and the view pans down to part B
as it falls. Reset pans back up. With reduced motion the view cuts instead of panning. Wires crossing into part B drop straight down a column clear of part B's
own switches.

The board draws only when something changes, rather than every frame, which keeps phones cool
and the browser tests quick.

## Finishing a level

A win plays the ball to the goal, then a `circuit` cue: light runs along the route the ball took,
each open gate flares as it passes, and a soft chord plays. Then the result card shows the level,
stars, whether it was a first-Run solve, and hints used, with **Next challenge** focused and
**Replay** and **Levels** below. Close (or Escape) hides the card to look at the lit machine;
**Result** brings it back. Completion is reported once per visit, however the run ends.

While a run plays, **Skip** (in Run's place) or a tap on the board jumps to the last frame, which
is the same frame the full animation ends on. Reduced motion shows it at once.

After a miss, the gate or fork that stopped the ball stays outlined and the status line says what
it needed. Run reads **Retry** until a switch moves. There is no failure pop-up.

## Stars

`src/game/scoring.ts`: 1 star for reaching the goal, 2 with no hints on that solve, 3 with no hints,
on the level's first Run, at par.

The first Run is the first Run ever made on that level. It is spent, and saved, the moment any
Run ends (won or missed), or when the player resets or leaves after clearing a part of a two-part
board. Leaving, reloading or replaying never gives it back, so only a level's very first solve can
earn three stars. Runs themselves are unlimited.

Progress (`chain-reaction/progress`, version 2) keeps per level the best stars, fewest Runs, fewest
changes and the first time it was solved, plus which levels have spent their first Run. A later
result never lowers an earlier one, and recording the same win twice changes nothing. Version 1
saves upgrade in place: a first-Run solve becomes 3 stars, a later one 2, and a level that had
hint moves 1 (the old change limit equalled par, so every old solve was at par).

A replay of a solved level starts without the hint moves of an earlier visit, so its stars can be
earned back. Hints already spent are not refunded.

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

`npm run levels` lists, per level: par, one shortest solution, how many positions win at par (it
must be one) and in all, the first-Run guess odds, idle switches (ones no gate or fork depends on),
whether turning every switch ON wins, and whether a greedy "fix whatever blocked the ball" player
wins at par. For `medium` and `hard` levels the last two are errors, because those levels should
need deduction.

**Guess odds** ("Guess" in the level table) answer "how often does a random pick of par-many
switches win on the first Run?". 1 in 3 means a guesser earns three stars a third of the time;
levels from 21 on should aim much lower.

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
  early, so no level uses it before level 31; a test enforces that.
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
- **Trip plates.** A `trip` node on the track flips the switch in `flips` as the ball passes.
  The run's event list then carries a `ballTrip` event and a fresh set of signal, wire and gate
  events. The switch goes back to where the player set it when the run ends.
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
| 21  | Crossroads       | Pick the lane that can open before changing anything       | 2   | 1 in 6  |
| 22  | Detour           | A lane that needs a switch both ways can never open        | 2   | 1 in 10 |
| 23  | Stay the Course  | Count each lane's cost before flipping the fork            | 3   | 1 in 10 |
| 24  | Through Traffic  | Part B can read a switch from part A                       | 3   | 1 in 10 |
| 25  | Crossover        | A switch part B needs closes part A's easy lane            | 4   | 1 in 15 |
| 26  | Branch Line      | A fork in part B gives part B two ways through             | 3   | 1 in 10 |
| 27  | Signal Box       | A part A switch sets the fork in part B                    | 3   | 1 in 10 |
| 28  | Junction Box     | What part A needs can shut a lane in part B                | 3   | 1 in 20 |
| 29  | Double Junction  | Two forks: plan both lanes before the first run            | 3   | 1 in 20 |
| 30  | Grand Central    | Price every lane in both parts                             | 4   | 1 in 15 |
| 31  | Inverter         | A NOT wire carries the opposite of its switch              | 2   | 1 in 10 |
| 32  | Opposite Day     | To turn a NOT wire off, turn its switch on                 | 2   | 1 in 10 |
| 33  | Contrary Fork    | A NOT on the fork wire flips which lane the ball takes     | 2   | 1 in 6  |
| 34  | Upside Down      | Read every NOT before flipping anything                    | 2   | 1 in 6  |
| 35  | Double Negative  | Powering a NOT's switch through a chain                    | 3   | 1 in 10 |
| 36  | Mirror Stage     | NOT wires on a two-part board                              | 3   | 1 in 20 |
| 37  | Dark Crossing    | One switch feeds a plain wire and a NOT wire               | 4   | 1 in 15 |
| 38  | Long Haul        | Set part A's switches for part B before leaving            | 4   | 1 in 35 |
| 39  | Backwire         | A wire from part A decides a NOT gate in part B            | 3   | 1 in 35 |
| 40  | Grand Inversion  | Turning one switch on turns a NOT off somewhere else       | 4   | 1 in 35 |
| 41  | Meshed           | A gear turns its partner, so you may turn it back          | 2   | 1 in 10 |
| 42  | Gear Train       | Let the gears do the work                                  | 2   | 1 in 10 |
| 43  | Chain Drive      | Gears turn one step only                                   | 3   | 1 in 10 |
| 44  | Clockwork        | One gear turns two switches                                | 3   | 1 in 20 |
| 45  | Escapement       | Plan which switch to turn by hand                          | 4   | 1 in 15 |
| 46  | Skeleton Key     | The lock opens only if the ball rolled past the key        | 2   | 1 in 6  |
| 47  | Key Ring         | Clearing part A isn't enough without the key               | 3   | 1 in 35 |
| 48  | Lockstep         | Keys and gears together                                    | 3   | 1 in 35 |
| 49  | Turnkey          | A geared switch isn't always the cheapest turn             | 4   | 1 in 35 |
| 50  | Master Key       | Pick the gear that moves only what you need                | 4   | 1 in 35 |
| 51  | Trip Plate       | A plate flips its switch while the ball rolls              | 2   | 1 in 10 |
| 52  | Tripwire         | Set a switch the wrong way for the plate to fix            | 2   | 1 in 10 |
| 53  | Pressure Point   | A switch the plate turns on must start off                 | 3   | 1 in 10 |
| 54  | Switchback       | A plate before the fork turns it after you set it          | 2   | 1 in 6  |
| 55  | Double Trip      | Two flips cancel out                                       | 3   | 1 in 10 |
| 56  | Two Keys         | Each lock needs its own key                                | 4   | 1 in 70 |
| 57  | Gold and Silver  | A gear can move a switch you needed anyway                 | 4   | 1 in 70 |
| 58  | Key Chain        | One geared turn opens two gates                            | 4   | 1 in 70 |
| 59  | Locksmith        | Gears and keys in both parts                               | 5   | 1 in 56 |
| 60  | Keymaster        | Plan both parts before the first run                       | 5   | 1 in 56 |

Every level has exactly one winning position at par, and from level 4 on turning every switch
ON never wins. Without a change limit some levels also have longer wins, which earn at most two
stars. From level 5 on, a greedy player who fixes whatever blocked the ball never wins at par,
except on the `easy` levels 4, 11, 16 and 17, which introduce a new idea. On levels 18
to 20 the greedy player clears part A the obvious way and finds part B out of reach; the game
then says so and suggests Reset.

Levels 21 to 30 bridge the gap to NOT wires with no new parts: forks on two-part boards. On 21
to 25 the fork is in part A, and from 24 a part A switch also feeds a gate in part B. On 26 to
28 the fork moves to part B (on 27 a part A switch sets it), and 29 and 30 have a fork in each
part. Blind guessing wins at par 1 in 6 on 21, then 1 in 10 to 1 in 20, so players get used to
bigger boards before NOT wires arrive. Levels 31 to 40 bring in NOT wires, which carry power while
their switch is off. Blind guessing wins at par about 1 in 10 on one-part NOT boards, 1 in 6 on
the two fork boards, and 1 in 15 to 1 in 35 on the two-part boards.

Levels 41 to 45 bring in gears: a switch with a cog badge also turns the switches it names
when turned by hand (one step only, never onward). Par counts turns by hand; worked out
drivers first, every position has exactly one set of turns (`turnsFor` in `reducer.ts`).
Levels 46 to 50 bring in keys: the ball picks up a key as it rolls past, and a lock stops it
unless it has that key. Keys ride along into the next part, so on 47 to 50 the lane part A
takes decides whether part B can be finished.
Levels 51 to 55 bring in trip plates: as the ball rolls over a plate, it flips the switch named
on it, and power and gates are worked out again while the ball is still rolling. The switch
springs back when the run ends. On every plate level the par position loses with the plates
taken out, so the flip has to be planned for.
Levels 56 to 60 have two keys, gold and silver, with a lock for each before the goal. Part
A's lane decides the gold key and part B's fork the silver one, and on every one of these levels
taking out either lock opens a cheaper win. Keys are drawn in metals (gold, silver, copper) so
they never read as a switch's wire color, and a lock takes its key's metal.

## Board layout

The board is laid out at 312 layout pixels wide (`src/render/layout.ts`) and scaled to fit the
screen, so every phone shows the same picture and labels can't collide on small screens. A
browser test opens every level at 320 by 568 and fails if any switch or label overlaps another
or leaves the board. On fork boards, wires turn just below their switch and drop straight into
their gate, and several wires into one gate land side by side.

A level's tip stands in for the status line until the first switch change, so it costs the
board no height.
The board sits at the top of its area, and on short screens (under 700px high, such as a phone
app's sheet) the header and status text shrink so the board gets the room.

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

## Level select

Levels are grouped into chapters (`src/levels/chapters.ts`): Basics (1 to 10), Forks (11 to 15)
and Two Parts (16 to 20). Each shows its stars, a locked chapter previews its new idea, and
levels no chapter lists appear under "More machines", so adding levels never hides one. The
screen shows total stars, a **Continue** button for the first unsolved level, and a card for the
next locked machine. Settings has **Unlock all levels**, a testing switch that opens every level.

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

Hints on levels 1 to 3 are free. Elsewhere a hint costs 10 coins or one rewarded ad. Moves
already made stay made until a solved level is replayed.

## Coins and retries

One currency, coins, pays for hints and extra retries. Every price and reward lives in
`src/monetize/prices.ts`:

| Item  | Free                                | Rewarded ad               | Coins | Real money                   |
| ----- | ----------------------------------- | ------------------------- | ----- | ---------------------------- |
| Coins | 20 to start, 1 per new star         | +3, up to 3 ads a UTC day | n/a   | 100 for $0.99, 600 for $3.99 |
| Hint  | Levels 1 to 3                       | One hint                  | 10    | Through coins                |
| Retry | 2 per level, refilled on solving it | One retry                 | 5     | Through coins                |

A level gives its first Run and 2 free retries; only a Run that misses uses one up. With none
left, the Run button opens an offer for one more. Levels 1 to 3 have unlimited retries, so a
new player never meets the offer while learning.

The wallet (`src/storage/wallet.ts`) keeps coins, hint moves per level, Runs left per level
and today's coin-ad count under `chain-reaction/hints`, apart from progress, so resetting
progress refills nothing. A version 1 hint wallet converts at 10 coins per hint.

Ads and purchases go through a `Shop` (`src/monetize/shop.ts`). The current one is a demo
that succeeds without showing an ad or charging anything, and every panel says so. AdMob and
App Store / Google Play in-app purchases replace it in the native-app milestone.

## Ads between levels

After every third solved campaign level, an ad plays once the player leaves the result card
(`src/storage/ads.ts`, stored under `chain-reaction/ads`). It never plays:

- before level 10, so new players never see one;
- straight after a solve with a missed Run or a hint, so it never lands on a frustrated
  player (the due ad waits for the next clean solve);
- after a daily puzzle;
- for anyone who bought Remove ads ($2.99) or any coin pack.

Rewarded ads for coins, hints and retries stay optional for everyone. Until AdMob is wired
in, a demo "Ad break" card stands in, closable after 3 seconds.

## Daily puzzle

A new puzzle every UTC day, the same for everyone, playable offline. It opens after level
10 and sits on the home screen under Continue.

Puzzles are variants of campaign levels 4 to 30 (`src/daily/transform.ts`): switches start in
other positions, gates want the opposite signal or swap AND and OR, and switch letters are
shuffled. `npm run daily-pool` searches seeded variants and keeps only those the level
checks pass with exactly one par answer and first-Run guess odds of 1 in 10 or worse
(`src/daily/rules.ts`), then writes a year of them to `src/daily/pool.ts`. A unit test
re-checks every row. Daily #1 is 29 October 2026, and the pool repeats after 365 days. After
launch, only append to the pool: changing a row changes that day's puzzle for everyone.

Only 13 of the 27 allowed boards are big enough to pass the guess-odds filter, so a layout
comes back about every two weeks, with different starts, gates and letters.

Dailies follow the level rules for stars, hints and retries. Solving one earns 2 coins once,
plus 5 more on every seventh day of a streak. The streak (`src/storage/daily.ts`, stored
under `chain-reaction/daily`) counts days in a row. One missed day a week is covered by a
free freeze, used automatically. A second missed day in that week can be repaired for 30
coins or a rewarded ad before the next solve. Two missed days in a row end the streak.

"Share result" opens the system share sheet, or copies the text where there is none. It
shows stars, Runs, par, a block per Run and the streak, never the answer:

```
Chain Reaction Daily #12
★★☆ 2 Runs, par
🟥🟩
🔥 5-day streak
```

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
levels from 31 on should aim much lower.

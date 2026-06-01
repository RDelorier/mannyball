# 1D Football — Design Spec

**Date:** 2026-06-01
**Status:** Approved

## Concept

A zero-dependency browser game played on a **one-dimensional American football
field** (a single horizontal line from end zone to end zone). The game is
possession-based and follows real football structure: downs, rushing, passing,
kicking, and kickoffs. Two players battle (or one player vs. AI) to be the
**first to 21 points**.

No build step, no external dependencies, no asset files. Audio is synthesized at
runtime. The whole game is opened by loading `index.html` in a browser.

## Core Model

### The field

- Position is a continuous number representing a **yard line**.
- The playable field is 100 yards plus two 10-yard end zones.
- Internal representation: `ballOn` ∈ `[0, 100]` where `0` = left goal line,
  `100` = right goal line, `50` = midfield. End zones extend beyond (left end
  zone `[-10, 0]`, right end zone `[100, 110]`) for kick/score geometry.
- Each team attacks one direction: **Home** drives toward `100`, **Away** drives
  toward `0`. Crossing the defended goal line scores a touchdown.

### Possession & downs

- The offense has **4 downs to gain 10 yards** (a first down resets to 1st & 10).
- Reaching/crossing the goal line → **touchdown (6)** followed by a **PAT (1)**
  timing kick.
- Failing to gain 10 yards in 4 downs → **turnover on downs**; possession flips
  and attack direction reverses, ball spotted where the last play ended.
- Tracked state: `down` (1–4), `lineToGain` (yard line needed for 1st down),
  `possession` (Home/Away), `ballOn`.

### Scoring & win condition

- Touchdown = 6, PAT = 1, Field goal = 3, (no safeties in v1).
- **First team to 21 points wins.** `21` is the default target, adjustable on the
  start screen (e.g. 14 / 21 / 28).
- On reaching the target, the game ends and the win screen is shown.

## Plays

Each non-kicking down, the offense calls **Rush** or **Pass**. All player timing
inputs share one skill primitive: a marker sweeps a bar with a green sweet spot;
pressing freezes the read and grades it **green / yellow / red(miss)**.

### Rush (`rush.js`)

- The ball carrier advances along the line toward the defended end zone.
- One or more **defenders** are positioned ahead. As the carrier reaches a
  defender, a **timing window** opens; tap your key:
  - **Green** → break the tackle, keep advancing.
  - **Yellow** → break but lose momentum (fewer extra yards).
  - **Red/miss** → **tackled** at that spot; the play ends.
- Yards gained = distance advanced before being tackled (or a **touchdown** if
  the carrier crosses the goal line).
- Resolution returns: `{ endYard, touchdown: bool, tackled: bool }`.

### Pass (`pass.js`)

- The thrower targets a **receiver** at a downfield yard line; the ball travels
  along the line toward the receiver over a short animated interval.
- **Defense control snaps to the defender nearest the targeted receiver.** That
  defender's controller (human or AI) taps **SPACE** as the ball arrives:
  - **Good timing (ball adjacent)** → **interception** (possession flips at that
    spot) or **knockdown** (incomplete, next down, no gain). v1: a strong-timing
    result intercepts; a weak-but-present press knocks it down.
  - **Miss** → **completion**: receiver catches; offense gains the yards to the
    receiver's spot (TD if in the end zone).
- Resolution returns:
  `{ outcome: 'completion'|'incomplete'|'interception', endYard, touchdown }`.

## Kicking (`kick.js`)

All kicks use a **power + accuracy timing meter**: a sweeping marker the kicker
stops to set power, graded for accuracy. One module covers every kick type.

### Field goal (3 pts)

- Available on any down (typically 4th). Success probability scales with
  **distance to the uprights** and timing accuracy: short = easy, long = hard.
- **Made** → +3, then the scoring team kicks off (see Kickoffs).
- **Missed** → opponent takes over at the spot of the kick.

### Punt

- Available on 4th down. A timing kick that **flips possession** and pushes the
  ball downfield by the landed power. No points; pure field position.

### PAT (extra point, 1 pt)

- A quick, short timing kick immediately after a touchdown. Make → +1.

### Kickoffs & onside (`kick.js`)

After any score (TD or FG), the scoring team kicks off and chooses:

- **Regular kickoff** → ball goes deep; receiving team takes possession with
  normal field position.
- **Onside kick** → a short, risky timing **recovery battle**. Land the kick in a
  tight window → **kicking team recovers** (keeps possession, short field). Miss
  → **receiving team recovers** with strong field position.

## 4th-Down Decision

On 4th down the offense chooses among: **Go for it** (rush/pass), **Field goal**,
or **Punt**. (Field goal is also selectable earlier if desired.)

## AI (`ai.js`)

- **Play-calling on normal downs:** **35% rush, 65% pass.**
- **4th down:** sensible kicking — field goal when in range, punt when deep in own
  territory, occasionally go for it when trailing late.
- **Onside:** occasionally attempts when behind; more often on higher difficulty.
- **Difficulty (Easy / Med / Hard):** tunes the AI's timing accuracy on offense
  (breaking tackles, throw accuracy) and defense (tackles, interceptions), and
  its kicking precision.

## Modes

- **1-player vs AI** — you control the human side; AI controls the other. On
  defense against a pass, control snaps to your nearest defender for the SPACE
  catch attempt.
- **2-player local** — Home keys vs. Away keys. Offense times rush/pass; defense
  times tackles and pass defense. Suggested bindings: Home = **A**, Away = **L**,
  shared catch = **SPACE** (final bindings confirmed during implementation; shown
  on-screen).

## Visuals & Audio

### Field rendering

- Green turf with white **yard lines** numbered **10–20–30–40–50–40–30–20–10**.
- Two **end zones** in team colors (e.g. Home = blue, Away = red) with end-zone
  lettering.
- **Football icon** (drawn oval or 🏈) marking `ballOn`, sliding as the ball
  moves.
- **Stadium HUD**: scoreboard (both scores + target), **down & distance**,
  ball-on / yard-to-gain, current play state, and the active **timing bar(s)**.

### Screens / flow

Start screen (mode, difficulty, points target) → game (field + HUD) → play
resolution (rush/pass/kick) → score events (TD flash + crowd roar + PAT →
kickoff/onside) → win screen (replay).

### Audio (`sound.js`)

- **Crowd roar synthesized via the Web Audio API** (filtered noise swell that
  rises and fades) on every touchdown. No audio files.
- Audio context unlocked on first user interaction (the start screen handles
  this per browser autoplay rules).

## File Structure (no build step)

- `index.html` — markup, HUD scaffold, screen containers.
- `style.css` — field, end zones, yard lines, HUD, timing bars, screens.
- `game.js` — main loop, game state, downs/possession, scoring, screen flow,
  mode wiring.
- `rush.js` — rush play: defender encounters, tackle-break timing, resolution.
- `pass.js` — pass play: throw, ball travel, nearest-defender snap, catch/INT.
- `kick.js` — timing meter + field goal, punt, PAT, kickoff, onside recovery.
- `ai.js` — AI play-calling (35/65), 4th-down/kick decisions, difficulty tuning.
- `sound.js` — Web Audio crowd-roar synthesis and audio unlock.

The push/scoring, rush, pass, and kick resolution logic are pure and isolated so
they can be unit-tested independently of the DOM/render layer.

## Out of Scope (v1)

- Game clock / quarters (win is points-based).
- Safeties, two-point conversions, penalties.
- Sound beyond the touchdown crowd roar (optional blips deferred).
- Networked / online multiplayer.
- Field goals/kicking are added; advanced special-teams returns are simplified.

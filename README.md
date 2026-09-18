# Continental Republic — War Command (prototype)

A minimal prototype of a real time strategy core loop with a pausable clock.
React + TypeScript + Vite, no backend, no persistence: all state lives in a
`useReducer` store and resets on reload.

## Setting

The player governs the Continental Republic, a spacefaring human civilization
descended from the 1945 unification of Earth under the United States. The game
opens in the chaotic days after the Imperial Directorate, a fascist state born
from a defeated colonial rebellion, seized the Republic world of New Virginia.

## Run it

```
npm install
npm run dev      # dev server
npm run build    # typecheck + production build
npm run preview  # serve the production build
```

## The clock

At 1x, **one real minute is one in game day**. Speed multiplies that directly,
so 5x is five in game days per real minute. Speeds are paused, 1x, 2x, 3x, 4x
and 5x, selectable at any time from the status bar.

The loop never counts its own ticks. A 100ms interval reports the wall clock,
the reducer takes the real milliseconds since the last settled moment, and
`daysElapsed` grows by `realMs * speed / MS_PER_GAME_DAY`. Interval jitter,
a throttled background tab and long frames therefore cannot accumulate error.
A speed change settles the elapsed time at the old speed before switching, so
the interval it lands in is neither lost nor counted twice.

Whole days are then walked one at a time so daily upkeep, delayed effects,
fleet arrivals and event thresholds land in order even when a single long tick
spans several days. An event stops that walk: the clock clamps to exactly that
day and the speed drops to paused, so no in game time runs past a decision the
player has not made. Speeds other than paused are disabled until it is resolved.

## The screen

A system map of local space with four nodes, colored by controller (Republic
blue, Directorate red, contested amber). Clicking a node opens its side panel.

- **Status bar** shows the day, a progress bar through the current day, the
  speed controls, and materiel, population, approval and leadership points.
- **System panel** has four tabs. Military, Buildings and Economy are
  placeholders. **Political** is wired to the live event system: when the pending
  event belongs to that system, its title, body and choices render there.
- **National events** (congressional sessions, nationwide decisions) render in a
  banner above the map instead, and stay visible whichever system is selected.
- **History log** runs along the bottom and records every day's drift, every
  choice, and every fleet movement.

A node with a pending decision gets a marker, and a hint bar appears whenever
that decision is off screen (wrong system selected, or the right system open on
another tab) so a paused clock always has a visible cause.

## Events

| Day | Event | Scope |
| --- | --- | --- |
| 0 | The Fall of New Virginia | New Virginia |
| 4 | Refugee Transports at Earth Orbit | Sol |
| 9 | Emergency Conscription Authority | national |
| 15 | Directorate Industrial Estimates | Shiloh |
| 22 | A Senator from the Frontier | national |
| 28+ | Unconfirmed Fleet Movement | Shiloh |

The last one is random: from day 28 it is checked once per day at
`RANDOM_EVENT_CHANCE` (0.5), so in practice it lands within a day or two of
becoming eligible. Lower that constant for a longer tail.

Two choices pay off later rather than immediately: emergency conscription
returns materiel 6 days on, and deep reconnaissance returns leadership points
7 days on. Both are queued against an absolute day and applied when the clock
reaches it.

## Fleets

A stub, with no combat. Two fleets start at Sol and Anchorage, using the
existing First Fleet / Third Fleet names.

A system's Military tab shows any fleet stationed there and any fleet that
departed *from* there and is still in transit (its destination and days
remaining). A stationed fleet's tab offers a "Send to..." button per other
system, each labelled with that pair's travel time. Assigning one schedules an
arrival using the flat per-pair table in `src/game/travel.ts` — placeholder
values from 3 to 10 days, loosely following how far apart the systems sit on
the map, not real distance, kept as plain data so they're easy to retune.
Transit is stored as absolute `departureDay` and `arrivalDay` rather than a
countdown, so it's drift free like the rest of the clock; `daysOut` in
`src/game/fleets.ts` derives the remaining days from those against the current
clock reading.

A fleet in transit renders as a marker that slides along the dotted lane
between its origin and destination, in proportion to elapsed vs. total travel
time; the map now draws a lane between every pair of systems (not just from
Sol) so any route a fleet is sent on has a line to travel along.

On arrival the fleet becomes stationed at its destination and the arrival is
logged like everything else. If the destination is Directorate controlled, the
log line is distinct — "First Fleet arrives at New Virginia. Directorate
forces detected in system." — rather than a plain arrival line. This is a log
only distinction: no combat, no new game state, just a hook for later.

A fleet is a composition, not a single abstract unit: `{ escort, cruiser }`
counts. Every display shows it — "First Fleet: 2 Escorts, 1 Cruiser" on the
map, in the Military tab, and on the in transit marker — the shape combat
resolution will need next, already in place even though nothing consumes it
yet.

## Ship construction

The Military tab shows a Shipyard section only when Sol is selected —
construction is Sol only for now, enforced both in the UI and, defensively, in
the reducer. Two ship types, defined as plain data in `src/game/ships.ts`:
Escort (15 materiel, 4 days) and Cruiser (40 materiel, 10 days). Clicking a
build button deducts the cost immediately (disabled if you can't afford it)
and adds an order to a build queue, shown under the Shipyard while anything is
building. The order stores an absolute `completesOnDay`, the same pattern as
fleet transit, so it counts down on the shared clock rather than a timer of
its own, and survives a pause exactly like everything else.

When a ship completes, it joins a fleet already stationed at that system if
one exists — First Fleet at Sol, at the start of a game — or forms a new one
if the system currently has no fleet there. New fleets are named Second Fleet
first, then keep incrementing, skipping any ordinal already in use (Third
Fleet is taken from the start, so the next new fleet after Second is Fourth).
Completion is logged: "Escort construction complete at Sol, assigned to First
Fleet." or "... forms Second Fleet."

## Data model

`src/game/types.ts`:

- `GameState`: `daysElapsed`, `materiel`, `population`, `approval`,
  `leadershipPoints`, `log: string[]`. `daysElapsed` is fractional; the whole
  number is what the readout and log lines show.
- `EventDef`: `id`, `dayTrigger` (a day number or `'random'`, with
  `earliestDay`), `title`, `text`, `choices` (each with `label`, `effects` as a
  partial `GameState` of deltas, `resultText`, and an optional `delayed` payload
  of `{ afterDays, effects, text }`).
- `GameSession` wraps `GameState` with the clock (`speed`, `lastTickAt`), the
  pending event, queued delayed effects and fleets.

`Effects` deliberately excludes `daysElapsed`: time comes from the clock, never
from a choice's deltas.

Daily drift (`DAILY_UPKEEP` in `src/game/state.ts`) is materiel -1.2,
population +1, approval -0.4, leadership +0.2. The scripted events now span 22
days where they once spanned 5 turns, so the old per turn drift was scaled to
roughly a fifth to keep the same economic pressure; a run to day 30 lands within
a few points of where the turn based version landed at its last scripted event.

`src/game/systems.ts` holds the four systems plus an `EVENT_SCOPE` map from
event id to system id or `'global'`, keeping event content free of layout
concerns. An event id missing from that map falls back to `'global'`.

## Files

- `src/game/events.ts` — event content.
- `src/game/state.ts` — the clock, the reducer, upkeep, delayed effects, fleets.
- `src/game/systems.ts` — systems, controllers, map positions, event scope.
- `src/game/fleets.ts` — transit, naming and composition helpers shared by
  the map and the panel.
- `src/game/travel.ts` — the per-pair travel time table and lane list.
- `src/game/ships.ts` — ship type data: cost and build time per type.
- `src/components/` — `SystemMap`, `SystemPanel` (tabs), `SpeedControls`,
  `DecisionCard` (shared by the Political tab and the national banner).

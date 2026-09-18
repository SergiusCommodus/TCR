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

## Combat

Each ship type carries a `strength` in `src/game/ships.ts`: Escort 1, Cruiser
3. A fleet's strength is the sum of its ships'. Each Directorate or contested
system carries a starting `garrisonStrength` on its `SystemDef` in
`src/game/systems.ts` — New Virginia 8, Shiloh 4 — but the strength that
actually changes as battles are fought lives in `GameSession.garrisons`
(a map of system id to current strength), the same split as a ship type's
fixed data versus a fleet's live composition.

When a fleet's travel countdown reaches zero and its destination is
Directorate or contested, arrival does not complete. The clock pauses (the
same as any decision event; every speed but Paused is disabled) and a Combat
Orders panel opens in that system's Military tab, showing the attacking
fleet's composition and strength side by side with the defending garrison's
strength. A single Commit to Attack button, no stance options.

On commit (`src/game/combat.ts`), both sides roll their strength with
independent ±20% variance and whichever total is higher wins. Both sides take
losses: the winner's loss fraction is proportional to how close the fight
was (0 at a rout, up to 50% at a near-even fight), and the loser's is the
complement of that (as low as 50%, up to a full wipe at a rout). Losses are
split proportionally across a fleet's ship counts, rounded to whole ships. If
the attacker wins, the fleet holds position at the system (composition
reduced) and the garrison weakens; if the defender wins, the fleet's
survivors — if any — retreat to the nearest other system by travel time, or
the fleet is destroyed outright if the loss rounds it down to zero ships. A
fleet mid-combat can't be reassigned (it still holds a destination, so the
same guard that blocks reassigning an in-transit fleet already covers it).

Winning a naval battle only clears the system's naval defense — it never
changes who controls the system by itself. That takes a ground invasion.

## Ground invasion and occupation

A third ship type, Transport (`src/game/ships.ts`): cost and build time
between Escort and Cruiser, 0 combat strength, and a `groundTroopsCarried` of
2 — the only ship type that adds to a fleet's separate `groundTroops` count
rather than fighting. Each Directorate or contested system also carries a
`groundDefense` baseline, distinct from its naval `garrisonStrength` — New
Virginia 6, Shiloh 3 — tracked live in `GameSession.groundDefenses`, the same
static/live split as everything else here.

Ground troops ride the same ships that take naval losses, so a fleet's
`groundTroops` takes the identical proportional hit its composition does in
`commitAttack` — this doesn't change naval combat's own resolution, just
extends the loss it already applies to the rest of the fleet to this new
field too. If the attacker wins the naval battle with 0 ground troops
surviving, the log says the system is cleared but cannot be taken without
landing forces, and control stays as it was.

With ground troops aboard, a stationed fleet at a hostile system shows an
Invade button (labelled with the defense strength) in its Military tab —
available whenever the player chooses, not a forced pause; naval combat
already made the player commit to being there. Committing resolves troops
against `groundDefense` with the exact same `rollCombat` naval combat uses,
applying `applySurvivingShare` to both sides same as naval losses. A loss
that leaves the fleet with 0 ground troops needs a fresh Transport to try
again; one that leaves troops standing can simply retry, since a failed
attempt still wears down the defense.

A won invasion opens an Occupation Decision, pausing the clock like any
other event: four choices in `src/game/occupation.ts` — Bombard, Enslave and
Deport, Exterminate, Occupy and Govern — each with a population and approval
effect (there is no per-system population tracked, so the consequence is
narrated as falling on the taken system while mechanically landing on the
same national totals every other choice in the game already uses). Bombard
and Exterminate are the most severe on population, Enslave and Deport falls
between, Occupy and Govern is the least severe and the only one that costs
the Republic nothing in approval — the other three cost it, on the read that
a nominally democratic Republic pays a political price for atrocity even in
wartime. Only Occupy and Govern flips the system to Republic control,
recorded in `GameSession.controllerOverrides` (a system's live controller,
versus its static `SystemDef.controller` baseline — the same split pattern
again). The other three leave the system un-flipped: population devastated
but not administered, a hook for a later "install a government" step. The
panel reuses the existing `DecisionCard` component via a synthetic
`EventDef` built on the fly (`occupationEventFor` in `occupation.ts`) rather
than a second card component — it never enters `EVENTS` or `firedEventIds`.

A system's live controller, not its static baseline, is what decides
whether an arriving fleet triggers combat at all — a system Occupy and
Govern has already flipped no longer pauses the clock for a later arrival.

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
  pending event, a pending combat if a fleet has arrived at a hostile system
  and not yet been ordered to attack, a pending occupation if an invasion has
  just succeeded, queued delayed effects, fleets, the build queue, current
  garrison and ground defense strength per system, and each system's live
  controller override.

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
- `src/game/ships.ts` — ship type data: cost, build time and strength per type.
- `src/game/combat.ts` — the pure combat roll: strength, variance, losses.
  Shared unchanged by naval combat and ground invasion.
- `src/game/occupation.ts` — the four occupation choices and the synthetic
  `EventDef` that lets DecisionCard render them.
- `src/components/` — `SystemMap`, `SystemPanel` (tabs), `SpeedControls`,
  `DecisionCard` (shared by the Political tab and the national banner).

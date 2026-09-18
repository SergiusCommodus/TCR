# Continental Republic — War Command (prototype)

A minimal, single screen prototype of a turn based strategy core loop. React +
TypeScript + Vite, no backend, no persistence: all state lives in a `useReducer`
store and resets on reload.

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

## The screen

A system map of local space with four nodes, colored by controller (Republic
blue, Directorate red, contested amber). Clicking a node opens its side panel.

- **Status bar** (top) shows turn, materiel, population, approval and leadership
  points as plain numbers.
- **System panel** has four tabs. Military, Buildings and Economy are
  placeholders. **Political** is wired to the live event system: when the pending
  event belongs to that system, its title, body and choices render there.
- **National events** (congressional sessions, nationwide decisions) render in a
  banner above the map instead, and stay visible whichever system is selected.
- **History log and Advance Turn** sit along the bottom, unchanged in behavior.

A node with a pending decision gets a marker, and a hint bar appears whenever
that decision is off screen (wrong system selected, or the right system open on
another tab) so a disabled Advance Turn always has a visible cause.

## The loop

1. Resolve the pending decision, in the system's Political tab or the national
   banner. Each choice button lists the deltas it applies; picking one applies
   the effects and writes its result text to the history log.
2. **Advance Turn** increments the turn, applies automatic per turn drift
   (`UPKEEP` in `src/game/state.ts`), releases any delayed effects that came due,
   moves fleets one turn closer, appends lines to the scrollable history log, and
   checks for the next event. It is disabled while a decision is pending.

## Fleets

A stub, with no combat. Two fleets start at Sol and Anchorage. A stationed
fleet's Military tab offers a button per other system; ordering one sets a
`TRAVEL_TURNS` countdown (2) that ticks down on each Advance Turn and arrives at
zero. Orders, transit and arrival are logged like everything else, and a fleet
in transit shows as a marker interpolated along its lane on the map.

## Data model

`src/game/types.ts`:

- `GameState`: `turn`, `materiel`, `population`, `approval`, `leadershipPoints`,
  `log: string[]`.
- `EventDef`: `id`, `turnTrigger` (a turn number or `'random'`), `text`,
  `choices` (each with `label`, `effects` as a partial `GameState` of deltas,
  and `resultText`).

Two additions beyond that spec, both needed to express the seeded content:

- `EventDef.title`, since the decision panel shows a title above the body text.
- `Choice.delayed`, a `{ afterTurns, effects, text }` payload for the choices
  written as "materiel up over time" and "leadership points up later". It is
  queued on choice and released during a later `advanceTurn`.

Random events carry `earliestTurn`; the frontier fleet event is eligible from
turn 7 and fires with a 50% chance per turn until it does.

`GameState` and `EventDef` are untouched by the map view. The map layer adds
`Fleet` and a `fleets` array on `GameSession` (session state, not game
resources), and `src/game/systems.ts` holds the four systems plus an
`EVENT_SCOPE` map from event id to system id or `'global'`. That mapping lives
there rather than on `EventDef` so `events.ts` and the core types stay as they
were; an event id missing from the map falls back to `'global'`.

## Events

Turns 1 to 5 are scripted: the fall of New Virginia, refugee transports,
emergency conscription, Directorate industrial estimates, and a frontier
senator's criticism. From turn 7 the random frontier fleet event reuses the
turn 4 structure (fund reconnaissance vs. rely on existing estimates) with new
framing, to test how a repeated event at that cadence feels.

Events live in `src/game/events.ts`; adding one is a single object in that array,
plus a line in `EVENT_SCOPE` if it belongs to a system rather than the nation.

## Files

- `src/game/events.ts` — event content.
- `src/game/state.ts` — reducer: choices, upkeep, delayed effects, fleet moves.
- `src/game/systems.ts` — systems, controllers, map positions, event scope.
- `src/components/` — `SystemMap`, `SystemPanel` (tabs), `DecisionCard` (shared
  by the Political tab and the national banner).

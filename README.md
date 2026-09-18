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

## The loop

1. **Briefing panel** shows turn, materiel, population, approval and leadership
   points as plain numbers.
2. **Decision panel** shows the pending event (title, body, 2 to 4 choices).
   Each button lists the deltas it applies. Picking one applies the effects and
   writes its result text to the history log.
3. **Advance Turn** increments the turn, applies automatic per turn drift
   (`UPKEEP` in `src/game/state.ts`), releases any delayed effects that came due,
   appends a line to the scrollable history log, and checks for the next event.
   It is disabled while a decision is pending.

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

## Events

Turns 1 to 5 are scripted: the fall of New Virginia, refugee transports,
emergency conscription, Directorate industrial estimates, and a frontier
senator's criticism. From turn 7 the random frontier fleet event reuses the
turn 4 structure (fund reconnaissance vs. rely on existing estimates) with new
framing, to test how a repeated event at that cadence feels.

Everything lives in `src/game/events.ts`; adding an event is one object in that
array.

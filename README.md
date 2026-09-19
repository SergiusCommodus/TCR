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
so 20x is twenty game days per real minute. Speeds are paused, 1x, 5x, 10x and
20x, selectable at any time from the status bar.

The loop never counts its own ticks. A 100ms interval reports the wall clock,
the reducer takes the real milliseconds since the last settled moment, and
`daysElapsed` grows by `realMs * speed / MS_PER_GAME_DAY`. Interval jitter,
a throttled background tab and long frames therefore cannot accumulate error.
A speed change settles the elapsed time at the old speed before switching, so
the interval it lands in is neither lost nor counted twice.

Whole days are then walked one at a time so daily upkeep, delayed effects,
fleet arrivals and event thresholds land in order even when a single long tick
spans several days. A political or narrative decision event no longer stops
that walk: it drops the speed to 1x if it was running faster, but the clock
keeps ticking with the panel open, and the player is free to pick any speed,
including pausing manually, while it's unresolved — the drop is a one-time
floor, not a lock. Combat arriving (either side) and an occupation decision
are the exception: those still clamp the walk to that exact day and force the
speed to paused, with every other speed disabled until resolved, since they
represent an active engagement rather than a background decision.

## The screen

A system map of local space with six nodes, colored by controller (Republic
blue, Directorate red, contested amber). Clicking a node opens its side panel.

- **Status bar** shows the day, a progress bar through the current day, the
  speed controls, and materiel, population, approval and leadership points.
- **System panel** has five tabs. Military, Buildings and Economy are
  placeholders. **Political** is wired to the live event system: when the pending
  event belongs to that system, its title, body and choices render there.
  **Focus** carries the National Focus tree, another standing national
  control like Tax Policy, visible whichever system is selected.
- **National events** (congressional sessions, nationwide decisions) render in a
  banner above the map instead, and stay visible whichever system is selected.
- **History log** runs along the bottom and records every day's drift, every
  choice, and every fleet movement.

A node with a pending decision gets a marker, and a hint bar appears whenever
that decision is off screen (wrong system selected, or the right system open on
another tab) so a running-but-slowed or paused clock always has a visible
cause.

Six systems in total: Sol (the capital) and Anchorage (a forward naval
station) started Republic; New Virginia started Directorate held, per the
opening event; Shiloh started contested. Meridian, a Republic agricultural
colony behind the lines, and Vicksburg, a former Confederate shipyard world
overrun in the war's first week (Directorate held, `garrisonStrength` 5,
`groundDefense` 4 — in line with New Virginia's and Shiloh's own baselines),
round the map out to six, each with travel times to every other system in
`src/game/travel.ts`.

## Events

| Day | Event | Scope |
| --- | --- | --- |
| 0 | The Fall of New Virginia | New Virginia |
| 2 | The Colonial Infrastructure Bill | national |
| 4 | Refugee Transports at Earth Orbit | Sol |
| 7 | Word from Occupied New Virginia | New Virginia |
| 9 | Emergency Conscription Authority | national |
| 12 | Fleet Fuel Reserves | national |
| 15 | Directorate Industrial Estimates | Shiloh |
| 18 | The Prisoners from Shiloh | Shiloh |
| 22 | A Senator from the Frontier | national |
| 25 | The Colonial Governors' Conference | national |
| 28+ | Unconfirmed Fleet Movement | Shiloh |
| 32+ | Allegations of War Profiteering | national |

The last two are random: each is checked once per day at
`RANDOM_EVENT_CHANCE` (0.5) from its own `earliestDay` onward, so in practice
each lands within a day or two of becoming eligible. Lower that constant for
a longer tail. The six added this pass are spread through the gaps between
the original five rather than clustered together, and vary in kind: The
Colonial Infrastructure Bill is a purely domestic budget fight with nothing
to do with the war; Word from Occupied New Virginia ties directly to the
colony's fall, offering to fund its resistance movement; Fleet Fuel Reserves
is a straightforward logistics dilemma; The Prisoners from Shiloh is a moral
choice with no clearly best option (intelligence value against how it's
obtained); the last two round out the political side.

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
Directorate or contested, arrival does not complete. The clock hard pauses
(every speed but Paused is disabled, unlike the softer drop a decision event
causes) and a Combat Orders panel opens in that system's Military tab, showing
the attacking fleet's composition and strength side by side with the
defending garrison's strength, followed by a stance choice — see Combat
stances below.

On commit (`src/game/combat.ts` and `src/game/stance.ts`), both sides roll
their strength with variance and whichever total is higher wins. Both sides
take losses: the winner's loss fraction is proportional to how close the
fight was (0 at a rout, up to 50% at a near-even fight before any stance
multiplier), and the loser's is the complement of that (as low as 50%, up to
a full wipe at a rout). Losses are split proportionally across a fleet's ship
counts, rounded to whole ships. If the attacker wins, the fleet holds
position at the system (composition reduced) and the garrison weakens; if
the defender wins, the fleet's survivors — if any — retreat to the nearest
other system by travel time, or the fleet is destroyed outright if the loss
rounds it down to zero ships (Defensive stance is the one exception — see
below). A fleet mid-combat can't be reassigned (it still holds a
destination, so the same guard that blocks reassigning an in-transit fleet
already covers it).

Winning a naval battle only clears the system's naval defense — it never
changes who controls the system by itself. That takes a ground invasion.

## Combat stances

Three stances — Aggressive, Moderate, Defensive (`src/game/stance.ts`) —
replace the old single Commit to Attack button with a real choice, applied
identically wherever combat is about to resolve. Moderate reproduces the
original combat formula exactly: no multiplier on strength, variance or
casualties, the untouched baseline. Aggressive multiplies effective strength
by 1.3 at the same ±20% variance, and both sides' casualties by 1.4 — a
harder hit that costs more regardless of outcome. Defensive multiplies
effective strength by 0.8, tightens variance to ±10%, and multiplies
casualties by 0.6; a loss while Defensive never makes a last stand — it
always retreats with partial losses instead of being destroyed outright
(`guaranteeSurvivor` in `src/game/state.ts` keeps at least one ship alive to
retreat with, even at a near total loss).

Before committing, each stance shows an estimated win chance —
`estimateWinChance` in `src/game/stance.ts`, the ratio of the stance
holder's stance-modified effective strength to the total strength in play,
rounded to a percentage. It's a displayed estimate to inform the choice, not
a guaranteed outcome: `resolveStanceCombat` still rolls through
`rollCombat`'s own variance to actually resolve it. `rollCombat` itself
gained an optional `variance` parameter (default the original ±20%) purely
so a stance can override it — ground invasion's own call is untouched and
keeps the original band.

The exact same stance panel is used in two places: committing to a naval
attack on a Directorate or contested system, and defending a Republic system
once a Directorate attack's countdown reaches zero — see Directorate AI
below for how that pause is triggered. Whichever side the player is on, the
stance always modifies *their own* strength; the opponent's is never
touched. If no Republic fleet is present when a Directorate attack lands, it
still resolves automatically against the baseline defense of 2 exactly as
before — nothing to command, no stance choice shown. Whichever stance is
chosen and its outcome are logged in the same narrated voice as every other
combat line.

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

## Manpower and tax policy

A fifth resource, Manpower, sits in the Briefing panel alongside the
original four. It starts at 30 and drifts up by a small flat amount each
day (0.5, folded into the same `DAILY_UPKEEP` mechanism materiel and
population already drift on), narrated as population converting into a
form the war effort can spend. Transport is the one ship type that spends
it: building one now costs `manpowerCost` (8) alongside `materielCost`, so
the Shipyard's affordability check and button label cover both; Escort and
Cruiser stay materiel only (`manpowerCost: 0`).

The Political tab carries a standing Tax Policy control — Low, Standard,
Wartime — visible whichever system you're looking at, since taxation is a
national setting, not a per-system one, the same reasoning that puts
national events in the top banner rather than a system's own tab. Standard
reproduces the original daily drift exactly. Low subtracts from materiel's
daily drift and adds to approval's; Wartime does the reverse, by the same
magnitude in the other direction (`TAX_POLICY_MODIFIERS` in
`src/game/state.ts`, layered onto `DAILY_UPKEEP` rather than replacing it).
Population, leadership and manpower drift are untouched by tax policy.
Changing it applies to the very next day processed and holds until changed
again; picking the policy already active is a no-op, so the log doesn't
fill with redundant lines.

The "Emergency Conscription Authority" event (day 9, unchanged framing and
choices) now pulls its payoff from manpower instead of a flat approval
hit: granting conscription still pulls 40 from population, exactly as
before, but grants 15 manpower rather than costing 8 approval. The delayed
materiel payoff six days later is untouched. The other two choices on that
event are untouched.

## National Focus tree

A sixth tab, Focus, carries a single linear path of eleven National Focuses
(`src/game/focuses.ts`), each locked until the one before it completes. Only
one can be underway at a time, and starting one deducts its `leadershipCost`
immediately and begins a day based countdown using the exact same absolute
`completesOnDay` / `settleDueWork` mechanism as fleet transit and ship
construction — it never pauses the clock at all, unlike combat or an
occupation decision (a pending event only slows it). `GameSession.activeFocus`
(the one in progress, or
`null`) and `completedFocusIds` (finished ones, in path order) are the two
new live fields; the next startable focus is always the one at
`completedFocusIds.length` in `FOCUS_PATH`.

| # | Focus | Days | Leadership | Effect |
| - | --- | --- | --- | --- |
| 1 | National Mobilization Act | 10 | 2 | Permanent materiel income increase |
| 2 | Colonial Shipyard Expansion | 14 | 2 | Ship construction time -15% |
| 3 | Refugee Resettlement Program | 8 | 1 | One time approval increase |
| 4 | Emergency War Powers Act | 12 | 3 | Permanent leadership income increase, one time approval cost |
| 5 | Frontier Intelligence Network | 10 | 2 | Placeholder — narrative only for now |
| 6 | Total War Footing | 16 | 3 | Permanent materiel and manpower increase, ongoing approval drain |
| 7 | Reconstruction Directive | 12 | 2 | Placeholder hook for future occupation outcomes |
| 8 | Emergency Requisition Powers | 14 | 3 | Larger permanent materiel increase than #1 alone, one time approval cost |
| 9 | Unified War Production Board | 18 | 4 | Ship construction time cut further, stacking with #2 |
| 10 | Total Mobilization Decree | 20 | 4 | Larger materiel and manpower increase than #6 alone, larger approval drain |
| 11 | Continental Defense Initiative | 22 | 5 | Larger permanent leadership increase than #4 alone, one time approval boost |

The last four escalate deliberately from the first seven: larger day and
leadership costs, and effects that build on their earlier counterparts
(`dailyModifier`s add, so completing both National Mobilization Act and
Emergency Requisition Powers stacks their materiel bonuses) rather than
replacing them — a nation further committed to total war, one step at a
time.

A completed focus's permanent effect is a `dailyModifier` layered onto
`DAILY_UPKEEP` by `dailyUpkeepFor`, the exact same additive layering tax
policy already uses — every completed focus with one just adds another term,
so National Mobilization, Total War Footing, Emergency Requisition Powers
and Total Mobilization Decree's materiel bonuses all stack together.
Colonial Shipyard Expansion and Unified War Production Board instead each
carry a `buildTimeMultiplier` (0.85 and 0.8), read by `buildTimeMultiplierFor`
wherever a ship's `buildDays` is consumed and multiplied together — both
queuing a new build order and the Shipyard's advertised time per ship apply
it, so the button always shows the build time you'll actually get. Refugee
Resettlement, Emergency War Powers, Emergency Requisition Powers and
Continental Defense Initiative instead carry a one time `onComplete` effect,
applied the moment the focus completes, the same
`applyEffects`/`describeEffects` machinery every other effect in the game
already goes through. Frontier Intelligence and Reconstruction Directive
carry no numeric effect yet — completing them is still recorded in
`completedFocusIds` for other systems to read once intelligence and
occupation outcomes exist to hook into it.

Each focus's start and completion are narrated to the history log in the
same voice as everything else, and the Focus tab shows the active focus's
remaining days prominently, both in a summary line above the path and inline
on its node; completed nodes, the active node and locked future nodes are
each visually distinct.

## Directorate AI and intelligence alerts

Three fixed campaign traits in `src/game/directorate.ts` — aggression 0.6,
patience 0.4, brutality 0.7, each on a 0 to 1 scale — turn the Directorate
from a static garrison into an opponent that acts on its own. An abstract
`directorateFleetStrength` (`GameSession`, starting at 8) grows passively by
0.6 a day, the same way materiel accrues for the Republic; there is no
Directorate economy panel, only the results of it.

Roughly every 5 to 7 days (`directorateNextCheckDay`), the Directorate
evaluates whether to attack: below a threshold of 20 it never does; above it,
`directorateWantsToAttack` weighs aggression against accumulated surplus
strength, damped by patience, plus random noise, so action becomes likelier
but never certain as strength and time build up. When it decides to act,
`pickDirectorateTarget` weighs every Republic controlled system by nearness
to New Virginia (its staging system) and by how weakly defended it currently
is, then rolls a weighted pick — nearer and weaker systems are more likely
targets, never guaranteed ones.

The decision doesn't resolve immediately. An intelligence alert — sourced to
the deliberately generic "Naval Intelligence" rather than an invented agency
name — logs the target and a random 3 to 7 day estimated arrival, and
briefly hard pauses the clock (the same `speed: 0` combat and occupation use,
a stronger stop than the 1x floor a decision event causes) so it's impossible
to miss even at 20x. Unlike every other pending state, nothing needs to be
dismissed: a timer in `App.tsx` acknowledges the
alert on its own a few seconds later and the clock resumes at whatever speed
it was running before, mirrored by an "incoming" marker on the map that
stays lit for the whole countdown. The countdown itself runs on the
identical absolute day mechanism as fleet transit and ship construction
(`directorateAttack.arrivalDay`, resolved in `settleDueWork`) — the clock
never pauses again for it, so the player is free to reassign fleets to
reinforce the target for the rest of the window, exactly like any other
fleet order.

On arrival, `directorateFleetStrength` splits roughly 70% naval / 30% ground
troops. If a Republic fleet is stationed at the target system (summed across
every fleet there), arrival pauses the clock and opens the same combat
stance panel a player initiated attack uses — see Combat stances above —
letting the player defend with Aggressive, Moderate or Defensive rather than
the fight resolving on its own (`pendingDirectorateCombat`,
`commitDirectorateDefense`). An undefended system has nothing to command, so
it still resolves automatically at Moderate strength against a small
baseline defense of 2, exactly as before. Either way the roll goes through
the same `rollCombat`/`resolveStanceCombat` machinery naval combat always
uses. A Republic win destroys the Directorate's committed fleet outright and
changes nothing else — no occupation follows a purely defensive win. A
Directorate win resolves an occupation automatically, no player choice this
time: `rollDirectorateOccupationOutcome` weights Bombard and Exterminate
(split evenly), Enslave and Deport, and Occupy and Govern by brutality — at
0.7 that lands at roughly 55% / 30% / 15% — and applies the exact same
population and approval effects `OCCUPATION_CHOICES` already defines for
the player's own invasions, narrated from the Directorate's side rather
than the Republic's. Only Occupy and Govern flips the system to Directorate
control, the same asymmetry the player's own Occupy and Govern already has
in reverse (`applyDirectorateOccupation` in `src/game/state.ts` is the
single shared implementation both the automatic and player-resolved paths
call, so they can never drift apart).

Alert, arrival and outcome are all logged in the same narrated voice as
everything else in the history panel.

## Win and lose conditions

Four conditions, checked continuously (`checkGameEnd` in
`src/game/gameEnd.ts`, run after every single action by a wrapper around the
reducer, so effectively every clock tick): Sol falling to anything but
Republic control is an immediate, existential defeat, named as such;
population reaching 0 is a defeat; approval sitting at or below 0 for more
than 10 consecutive in game days is a defeat, tracked day boundary by day
boundary in `runClock` via `GameSession.approvalCollapseStartDay` (cleared
the moment approval reads above 0 again) and read against
`APPROVAL_COLLAPSE_DAYS`; and every system on the map reading Republic
controlled at once is a victory. The wrapper (`reducer` in `src/game/state.ts`,
with the original switch statement renamed `reducerCore` underneath it) sets
`GameSession.gameOver`, forces `speed: 0`, and appends a `Victory:`/`Defeat:`
log line the moment any of these trips — and once `gameOver` is set, every
action but `reset` is refused outright, so nothing else can ever process
again: no further ticks, no events, no AI decisions.

`EndScreen.tsx` replaces the entire main view the instant `gameOver` is set
(`App.tsx` checks it before rendering anything else): which of Victory or
Defeat, the exact narrated reason (naming Sol by name for that defeat,
"fully repelled" for the win, the internal collapse framing for the other
two), the final day count, and a Restart button wired to the same restart
logic every other Restart button in the app already uses.

## Data model

`src/game/types.ts`:

- `GameState`: `daysElapsed`, `materiel`, `population`, `approval`,
  `leadershipPoints`, `manpower`, `log: string[]`. `daysElapsed` is fractional;
  the whole number is what the readout and log lines show.
- `EventDef`: `id`, `dayTrigger` (a day number or `'random'`, with
  `earliestDay`), `title`, `text`, `choices` (each with `label`, `effects` as a
  partial `GameState` of deltas, `resultText`, and an optional `delayed` payload
  of `{ afterDays, effects, text }`).
- `GameSession` wraps `GameState` with the clock (`speed`, `lastTickAt`), the
  pending event, a pending combat if a fleet has arrived at a hostile system
  and not yet been ordered to attack, a pending occupation if an invasion has
  just succeeded, a pending Directorate defend stance choice, queued delayed
  effects, fleets, the build queue, current garrison and ground defense
  strength per system, each system's live controller override, the standing
  tax policy, National Focus progress (`completedFocusIds`, `activeFocus`),
  the Directorate's own fleet strength, next check day, in-flight attack and
  pending alert, the approval collapse tracker (`approvalCollapseStartDay`),
  and `gameOver` once a win or loss condition has triggered.

`Effects` deliberately excludes `daysElapsed`: time comes from the clock, never
from a choice's deltas.

Daily drift (`DAILY_UPKEEP` in `src/game/state.ts`, at Standard tax policy) is
materiel -1.2, population +1, approval -0.4, leadership +0.2, manpower +0.5.
The scripted events now span 22 days where they once spanned 5 turns, so the
old per turn drift was scaled to roughly a fifth to keep the same economic
pressure; a run to day 30 lands within a few points of where the turn based
version landed at its last scripted event.

`src/game/systems.ts` holds the six systems plus an `EVENT_SCOPE` map from
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
  Shared unchanged by naval combat and ground invasion; `variance` is now an
  optional parameter (default the original ±20%) so a stance can override it.
- `src/game/stance.ts` — the three combat stances, their modifiers,
  `estimateWinChance` and `resolveStanceCombat`, wrapping `rollCombat`.
- `src/game/occupation.ts` — the four occupation choices and the synthetic
  `EventDef` that lets DecisionCard render them.
- `src/game/focuses.ts` — the eleven National Focus definitions: name,
  description, days, leadership cost, narrated log lines, and effects.
- `src/game/directorate.ts` — Directorate traits, fleet strength growth,
  the periodic attack decision and target weighting, and the automatic
  occupation outcome roll, re-narrated from OCCUPATION_CHOICES.
- `src/game/gameEnd.ts` — `checkGameEnd`, the pure win/lose condition check
  run after every action by the reducer wrapper in `state.ts`.
- `src/components/` — `SystemMap`, `SystemPanel` (tabs, including the
  Shipyard, Invade, Tax Policy, Focus tree and combat stance controls),
  `SpeedControls`, `DecisionCard` (shared by the Political tab and the
  national banner), `EndScreen` (replaces the whole view once `gameOver` is
  set); the map also shows an "incoming" marker on a system targeted by a
  Directorate attack.

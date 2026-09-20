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
spans several days. Nothing in that walk touches speed anymore except an
occupation decision: a political or narrative decision event, a Directorate
intelligence alert, and combat arriving (either side) all open their panel and
let the walk keep going exactly as if nothing were pending — upkeep, fleets,
construction and everything else on the clock keep advancing in the
background while the player decides at their own pace, at whatever speed they
already had selected. The only ways speed ever changes are the player picking
a different one or pausing manually. An occupation decision is the one
exception: since it settles a fight that already happened rather than
something still unfolding, it still clamps the walk to that exact day and
forces the speed to paused, with every other speed disabled until resolved.

Since panels can no longer rely on pausing to hold the player's attention, a
second decision, alert or combat trigger firing while an earlier one is still
open doesn't replace it or get lost — it queues (`GameSession.queuedPanels`)
behind whichever one is active, and promotes automatically, front first, the
moment the active one resolves (`promoteNextPanel` in `src/game/state.ts`).
A small pill (`+N more waiting`) appears near the pending hint banners
whenever more than one item is waiting, so the player always knows something
else needs attention even though nothing is forcing them to look. At most one
panel is ever "active" (mirrored into `pendingEventId`,
`pendingDirectorateAlert`, `pendingCombat` or `pendingDirectorateCombat`) at a
time; the rest sit in the queue. A fleet left "arrived, awaiting orders" is
never re-detected or re-logged on a later day boundary — `runClock` tracks
which fleets already have a combat panel open or queued and skips them until
that panel actually resolves.

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
that decision is off screen (wrong system selected, or the right system open
on another tab), so a panel waiting for attention is never silently lost even
though the clock keeps running right through it. A small `+N more waiting`
pill appears alongside the hint bars whenever more than one panel is queued.

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

Whenever two or more fleets are stationed at the same system, each one's card
in the Military tab gets a "Merge N fleets into `<name>`" button — the player
picks which fleet's name and id survive by which button they click. Merging
(`mergeFleets` in `src/game/state.ts`) sums every stationed fleet's
composition and ground troops (`sumComposition` in `src/game/fleets.ts`) into
the chosen survivor and retires the rest, logging who absorbed whom and the
resulting composition. Guarded defensively against fewer than two fleets, a
survivor not actually stationed there, or fleets spread across more than one
system; any of those leaves the fleet list untouched.

## Ship construction

The Military tab shows a Shipyard section only when Sol is selected —
construction is Sol only for now, enforced both in the UI and, defensively, in
the reducer. Two ship types, defined as plain data in `src/game/ships.ts`:
Escort ($150M, 4 days) and Cruiser ($400M, 10 days). Clicking a
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

Whichever Directorate or contested system is selected shows its current
`garrisons` and `groundDefenses` values plainly in the system panel's
header — a `panel-stats` block, the same labelled dt/dd treatment the
status bar's national Briefing already uses, sitting under the panel note
regardless of which tab is open. A Republic system shows none: it never had
either value to begin with. The point is the same known strength a Combat
Orders panel would show is visible before committing to an attack, not only
once a fleet has already arrived and triggered one.

When a fleet's travel countdown reaches zero and its destination is
Directorate or contested, arrival does not complete. A Combat Orders panel
opens in that system's Military tab, showing the attacking fleet's
composition and strength side by side with the defending garrison's strength,
followed by a stance choice — see Combat stances below — but the clock keeps
running at whatever speed the player has selected; only resolving the panel
by committing a stance actually settles the fight.

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

Above the stance choices, the panel shows both sides' raw strength — the
player's own (plus composition, if it's a fleet) and the opponent's — not
just the odds derived from them, so the numbers behind a stance's estimate
are always visible, not hidden behind a single percentage. Each stance then
shows its own estimated win chance next to it — `estimateWinChance` in
`src/game/stance.ts`, the ratio of the stance holder's stance-modified
effective strength to the total strength in play, rounded to a percentage.
It's a displayed estimate to inform the choice, not a guaranteed outcome:
`resolveStanceCombat` still rolls through `rollCombat`'s own variance to
actually resolve it. `rollCombat` itself gained an optional `variance`
parameter (default the original ±20%) purely so a stance can override it —
ground invasion's own call is untouched and keeps the original band.

The exact same stance panel is used in two places: committing to a naval
attack on a Directorate or contested system, and defending a Republic system
once a Directorate attack's countdown reaches zero — see Directorate AI
below for how that panel is triggered. Whichever side the player is on, the
stance always modifies *their own* strength; the opponent's is never
touched. If no Republic fleet is present when a Directorate attack lands, it
still resolves automatically against the baseline defense of 2 exactly as
before — nothing to command, no stance choice shown. Whichever stance is
chosen and its outcome are logged in the same narrated voice as every other
combat line.

## Ground invasion and occupation

A third ship type, Transport (`src/game/ships.ts`): cost and build time
between Escort and Cruiser, 0 combat strength, and a `groundTroopCapacity` of
2 — the only ship type that carries ground troops rather than fighting.
Unlike Escort and Cruiser, completing one adds no troops by itself: it only
raises the ceiling that `groundTroopCapacity` (`src/game/fleets.ts`) sums
across a fleet's Transports, the amount Load Troops (below) can move
aboard. Each
Directorate or contested system also carries a `groundDefense` baseline,
distinct from its naval `garrisonStrength` — New Virginia 6, Shiloh 3 —
tracked live in `GameSession.groundDefenses`, the same static/live split as
everything else here.

Ground troops are trained directly, independent of Transports, the same
general shape as ship construction but landing in a per system pool rather
than joining a fleet: Sol's Military tab carries a Ground Troop Training
section (enforced Sol only in the reducer too, not just the panel) that
spends materiel and manpower (`TROOP_TRAINING` in `src/game/troops.ts`) on a
day based order, the same absolute `completesOnDay` mechanism as everything
else on the clock. Completing one adds a fixed batch of troops to
`GameSession.groundTroopPool`, keyed by system id — troops sitting there,
not yet aboard any fleet, shown in that system's Fleets section whenever the
pool there is nonzero. Any stationed fleet with room (its
`groundTroopCapacity` above its current `groundTroops`) at a system whose
pool is nonzero gets a Load Troops button, moving `min(room, pool)` aboard —
some or all of what's waiting, capped by capacity either way — and logging
how many.

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
that leaves the fleet with 0 ground troops needs a fresh trip home to train
and load more before trying again (the Transports themselves usually
survive; it's the troops they carried that are gone); one that leaves
troops standing can simply retry, since a failed attempt still wears down
the defense.

A won invasion opens an Occupation Decision, still hard pausing the clock —
the one panel that does, since it settles a fight that already happened
rather than something still unfolding: four choices in `src/game/occupation.ts`
— Bombard, Enslave and
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
Govern has already flipped no longer opens a combat panel for a later
arrival.

## Manpower and tax policy

A fifth resource, Manpower, sits in the Briefing panel alongside the
original four. It starts at 30 and drifts up by a small flat amount each
day (0.5, folded into the same `DAILY_UPKEEP` mechanism materiel and
population already drift on), narrated as population converting into a
form the war effort can spend. Transport is the one ship type that spends
it: building one now costs `manpowerCost` (8) alongside `materielCost`, so
the Shipyard's affordability check and button label cover both; Escort and
Cruiser stay materiel only (`manpowerCost: 0`). Ground troop training
spends it too (`TROOP_TRAINING.manpowerCost`, 15 per order), on the same
read that raising and crewing formations is what manpower represents,
whether they ride Transports or fill them out.

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
hit: granting conscription still pulls 40M from population, exactly the
same relative size as before the rescale, but grants 15 manpower rather
than costing 8 approval. The delayed materiel payoff six days later is
untouched. The other two choices on that event are untouched.

## National Focus tree

A sixth tab, Focus, carries a single linear path of eleven National Focuses
(`src/game/focuses.ts`), each locked until the one before it completes. Only
one can be underway at a time, and starting one deducts its `leadershipCost`
immediately and begins a day based countdown using the exact same absolute
`completesOnDay` / `settleDueWork` mechanism as fleet transit and ship
construction — it never pauses the clock at all, same as everything else now
except an occupation decision. `GameSession.activeFocus`
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
name — logs the target and a random 3 to 7 day estimated arrival, and shows a
banner so it's impossible to miss even at 20x, but doesn't touch the clock's
speed at all. Nothing needs to be dismissed: a timer in `App.tsx`
acknowledges the alert on its own a few seconds later, mirrored by an
"incoming" marker on the map that stays lit for the whole countdown. The
countdown itself runs on the identical absolute day mechanism as fleet
transit and ship construction (`directorateAttack.arrivalDay`, resolved in
`settleDueWork`), so the player is free to reassign fleets to reinforce the
target for the rest of the window, exactly like any other fleet order.

On arrival, `directorateFleetStrength` splits roughly 70% naval / 30% ground
troops. If a Republic fleet is stationed at the target system (summed across
every fleet there), arrival opens the same combat stance panel a player
initiated attack uses — see Combat stances above — letting the player defend
with Aggressive, Moderate or Defensive rather than the fight resolving on its
own, with the clock running the whole time until a stance is actually
committed (`pendingDirectorateCombat`,
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
action but `reset` or `load` is refused outright, so nothing else can ever
process again: no further ticks, no events, no AI decisions, short of
starting over or loading a different game entirely.

`EndScreen.tsx` replaces the entire main view the instant `gameOver` is set
(`App.tsx` checks it before rendering anything else): which of Victory or
Defeat, the exact narrated reason (naming Sol by name for that defeat,
"fully repelled" for the win, the internal collapse framing for the other
two), the final day count, and Restart and Load Game buttons — Restart wired
to the same restart logic every other Restart button in the app already
uses, Load Game the same load path described below, since an ended game is
exactly the kind of dead end a save from before it should be able to escape.

## Save and load

A single save slot, kept in the browser's `localStorage` under the key
`tcr-save` — no backend, no file picker, just Save Game and Load Game
buttons in the footer (and, on the end screen, a Load Game button next to
Restart, since a finished game is otherwise a dead end). Saving and loading
are plain reducer actions and pure functions, not something wired around the
reducer, so they get the same guarantees every other state change does.

`serializeSession` (`src/game/state.ts`) writes the entire `GameSession` —
`state`, every fleet (stationed or in transit), the build and training
queues, garrisons and ground defenses, controller overrides, the Directorate's
own fleet strength and any in-flight attack, National Focus progress, the
active and queued panels, `speed`, all of it — as JSON, wrapped with a
`SAVE_VERSION` number: `{ version, session }`. `lastTickAt` is cleared to
`null` before writing, since it is a wall clock reading tied to the saving
tab's own `performance.now()` origin and means nothing once written down or
reloaded elsewhere.

`deserializeSession` is the reverse, and refuses to load anything it isn't
certain about rather than risk a half-broken session: invalid JSON, a
missing or mismatched `version` (bumped whenever `GameSession`'s shape
changes), or a session that fails `isValidSession`'s structural check (every
field a load actually reads present and the right JS type) all come back
`null`. On success, `lastTickAt` is set back to `null` in the returned
session — the next tick just calibrates a fresh baseline against the current
wall clock instead of jumping the day count by however long ago the save
happened to be written.

Loading dispatches a `load` action carrying the already-deserialized session;
`reducerCore` treats it as a wholesale replace, the same way `reset` swaps in
a fresh `initialSession()`, and the public `reducer` wrapper lets `load`
through even when `gameOver` is set — the one other exception to that lock,
alongside `reset`. Speed and `queuedPanels` come back exactly as saved, so
the clock resumes ticking at whatever speed was selected and however many
panels were queued the moment it was saved, with no extra step to "resume"
anything: the existing speed-driven tick interval in `App.tsx` just keeps
running once a `speed` above 0 comes back in.

Save and load both leave a short status line in the footer (a `<p
role="status">`, cleared automatically after a few seconds) — "Saved at Day
N.", "Loaded save from Day N.", "No saved game found." if the slot is empty,
or a message naming the problem if the saved data doesn't parse or validate
— so success and failure are both visible without a native browser dialog.

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
  just succeeded, a pending Directorate defend stance choice, a queue of
  panels waiting behind whichever of those is currently active
  (`queuedPanels`, promoted front first as the active one resolves — see The
  clock above), queued delayed effects, fleets, the ship build queue, the
  ground troop training queue (`trainingQueue`) and pool (`groundTroopPool`,
  per system id), current garrison and ground defense strength per system,
  each system's live controller override, the standing tax policy, National
  Focus progress (`completedFocusIds`, `activeFocus`), the Directorate's own
  fleet strength, next check day, in-flight attack and pending alert, the
  approval collapse tracker (`approvalCollapseStartDay`), and `gameOver` once
  a win or loss condition has triggered.

`Effects` deliberately excludes `daysElapsed`: time comes from the clock, never
from a choice's deltas.

Daily drift (`DAILY_UPKEEP` in `src/game/state.ts`, at Standard tax policy) is
materiel -$12M, population +1M, approval -0.4, leadership +0.2, manpower +0.5.
The scripted events now span 22 days where they once spanned 5 turns, so the
old per turn drift was scaled to roughly a fifth to keep the same economic
pressure; a run to day 30 lands within a few points of where the turn based
version landed at its last scripted event.

### Economy scale

Materiel and population are large, realistic magnitudes — a national war
treasury in the hundreds of millions to low billions, a population in the
millions to billions — rather than the small abstract numbers earlier
versions used, formatted with a K/M/B/T suffix wherever they're shown
(`formatMoney`/`formatPopulation`/`formatMagnitude` in `src/game/scale.ts`):
"$1.2B", "-$250M", "9.4B", "340M". `describeEffects` (`src/game/state.ts`)
uses the same formatting for materiel and population in every log line and
decision preview; approval, leadership and manpower stay small plain numbers,
untouched by the rescale.

Underneath, this is a pure linear rescale, not a balance change: every
materiel literal in the codebase — `INITIAL_STATE`, `DAILY_UPKEEP`, tax
policy modifiers, every event and National Focus effect, ship and troop
training costs — is the old placeholder value times `MAT_SCALE`
(10,000,000); every population literal is the old value times `POP_SCALE`
(1,000,000). Every ratio, threshold and "can I afford this" comparison the
game's balance depends on is exactly what it always was; only the numbers
themselves, and how they're displayed, changed. Both constants live in
`src/game/scale.ts` rather than `state.ts`, since `state.ts` already imports
from every file (events, occupation, focuses, ships, troops) that needs
them to scale its own literals, and a two way import would be circular.

Population also gained a per-system dimension, but only as flavor: each
`SystemDef` in `src/game/systems.ts` now carries a static `population` —
Sol, the capital, at 2.8B; small colonies and the forward naval station at
Anchorage from 3M to 240M — shown in every system panel's header regardless
of controller. It plays no part in game logic: it never feeds the national
`GameState.population` total and no effect reads or writes it, the same way
a Republic system's absent `garrisonStrength` isn't summed into anything
either. Garrison and Ground Defense stay hostile-system-only in that same
header, unchanged.

`src/game/systems.ts` holds the six systems plus an `EVENT_SCOPE` map from
event id to system id or `'global'`, keeping event content free of layout
concerns. An event id missing from that map falls back to `'global'`.

## Files

- `src/game/events.ts` — event content.
- `src/game/state.ts` — the clock, the reducer, upkeep, delayed effects,
  fleets, and `serializeSession`/`deserializeSession` for save and load.
- `src/game/scale.ts` — `MAT_SCALE`/`POP_SCALE` and the
  `formatMoney`/`formatPopulation`/`formatMagnitude` display helpers, kept
  separate from `state.ts` to avoid a circular import.
- `src/game/systems.ts` — systems, controllers, map positions, event scope,
  and each system's flavor-only `population`.
- `src/game/fleets.ts` — transit, naming and composition helpers shared by
  the map and the panel, including `groundTroopCapacity`.
- `src/game/travel.ts` — the per-pair travel time table and lane list.
- `src/game/ships.ts` — ship type data: cost, build time and strength per
  type; Transport's `groundTroopCapacity` is carrying capacity only, no
  longer troops granted on completion.
- `src/game/troops.ts` — `TROOP_TRAINING`, the cost, time and batch size for
  training ground troops directly, independent of Transports.
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

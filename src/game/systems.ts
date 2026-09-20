export type Controller = 'republic' | 'directorate' | 'contested';

export interface SystemDef {
  id: string;
  name: string;
  controller: Controller;
  /** One line of situational context shown at the top of the system panel. */
  note: string;
  /** Map position as a percentage of the map box. */
  x: number;
  y: number;
  /**
   * Starting naval defensive strength for a Directorate or contested system —
   * undefined for a Republic one, which is never attacked. This is the
   * baseline a fresh game starts from; the strength that actually changes as
   * battles are fought lives in GameSession.garrisons, not here, the same
   * split as a ship type's fixed data versus a fleet's live composition.
   */
  garrisonStrength?: number;
  /** Starting ground defensive strength, the invasion equivalent of
   *  garrisonStrength — a separate number, since a system can be navally
   *  cleared without being taken. Same static/live split, in
   *  GameSession.groundDefenses. */
  groundDefense?: number;
  /** This system's population — flavor data only, shown in its panel
   *  header, sized realistically by what kind of system it is (a small
   *  colony in the low millions, a core world in the billions). It plays no
   *  part in game logic: it never feeds the national GameState.population
   *  total (see INITIAL_STATE in state.ts) and no effect reads or writes it,
   *  the same way a Republic system's absent garrisonStrength isn't summed
   *  into anything either. */
  population: number;
}

export const CONTROLLER_LABEL: Record<Controller, string> = {
  republic: 'Republic control',
  directorate: 'Directorate control',
  contested: 'Contested',
};

export const SYSTEMS: SystemDef[] = [
  {
    id: 'sol',
    name: 'Sol',
    controller: 'republic',
    note: 'Capital system. Congress, the orbital yards, and two thirds of Republic heavy industry.',
    x: 34,
    y: 58,
    population: 2_800_000_000,
  },
  {
    id: 'new-virginia',
    name: 'New Virginia',
    controller: 'directorate',
    note: 'Fallen. Directorate ground forces hold the capital; the naval garrison was overwhelmed in hours.',
    x: 76,
    y: 30,
    garrisonStrength: 8,
    groundDefense: 6,
    population: 240_000_000,
  },
  {
    id: 'anchorage',
    name: 'Anchorage',
    controller: 'republic',
    note: 'Forward naval station. Intact, under-provisioned, and now the nearest Republic base to the front.',
    x: 18,
    y: 22,
    population: 3_000_000,
  },
  {
    id: 'shiloh',
    name: 'Shiloh',
    controller: 'contested',
    note: 'Former Confederate mining frontier. Local government has not answered Republic hails in six days.',
    x: 68,
    y: 80,
    garrisonStrength: 4,
    groundDefense: 3,
    population: 60_000_000,
  },
  {
    id: 'meridian',
    name: 'Meridian',
    controller: 'republic',
    note: "Republic agricultural belt, feeding fleets and cities alike since before the war. Distance from the front is its only real defense.",
    x: 14,
    y: 78,
    population: 140_000_000,
  },
  {
    id: 'vicksburg',
    name: 'Vicksburg',
    controller: 'directorate',
    note: "Former Confederate shipyard world, overrun in the war's first week. Directorate colors already fly over what's left of its orbital works.",
    x: 90,
    y: 55,
    garrisonStrength: 5,
    groundDefense: 4,
    population: 95_000_000,
  },
];

export const HOME_SYSTEM_ID = 'sol';

/**
 * Which system each event belongs to. Events that are national in scope map to
 * 'global' and surface as a banner rather than inside a system panel.
 *
 * This lives here rather than on EventDef so that events.ts and the core types
 * stay untouched; unknown event ids fall back to 'global'.
 */
const EVENT_SCOPE: Record<string, string> = {
  'fall-of-new-virginia': 'new-virginia',
  'refugee-transports': 'sol',
  'conscription-authority': 'global',
  'directorate-industry': 'shiloh',
  'frontier-senator': 'global',
  'frontier-fleet-movement': 'shiloh',
  'colonial-infrastructure-bill': 'global',
  'new-virginia-resistance': 'new-virginia',
  'fleet-fuel-reserves': 'global',
  'shiloh-prisoners': 'shiloh',
  'colonial-governors-conference': 'global',
  'war-profiteering-allegations': 'global',
};

export function scopeOf(eventId: string): string {
  return EVENT_SCOPE[eventId] ?? 'global';
}

export function isGlobalEvent(eventId: string): boolean {
  return scopeOf(eventId) === 'global';
}

export function systemById(id: string | null): SystemDef | undefined {
  return SYSTEMS.find((s) => s.id === id);
}

export function systemName(id: string | null): string {
  return systemById(id)?.name ?? 'unknown space';
}

/** A system's live controller: its static baseline, unless a successful
 *  Occupy and Govern choice has overridden it. */
export function currentController(
  system: SystemDef,
  overrides: Record<string, Controller>,
): Controller {
  return overrides[system.id] ?? system.controller;
}

import type { EventDef } from './types';

export const EVENTS: EventDef[] = [
  {
    id: 'fall-of-new-virginia',
    dayTrigger: 0,
    title: 'The Fall of New Virginia',
    text:
      'NEW VIRGINIA HAS FALLEN. Congress is in emergency session. The Directorate struck ' +
      'without warning, overwhelming the naval garrison before reinforcement was possible. ' +
      'The nation demands action.',
    choices: [
      {
        label: 'Declare full wartime mobilization',
        effects: { materiel: -25, approval: 12, leadershipPoints: 3 },
        resultText:
          'Wartime mobilization is declared. Yards and foundries convert overnight, stockpiles ' +
          'are drawn down hard, and Congress grants you broad emergency latitude.',
      },
      {
        label: 'Measured response, avoid panic',
        effects: { materiel: -6, approval: -4 },
        resultText:
          'The Republic responds in measured steps. Markets stay calm; the public reads restraint ' +
          'as hesitation.',
      },
      {
        label: 'Address the nation personally',
        effects: { approval: 8 },
        resultText:
          'You speak to the Republic from the Capitol steps. Nothing material changes tonight, but ' +
          'the country hears its government and steadies.',
      },
    ],
  },
  {
    id: 'refugee-transports',
    dayTrigger: 4,
    title: 'Refugee Transports at Earth Orbit',
    text:
      'Refugee transports from New Virginia are requesting clearance to dock at Earth orbital ' +
      'stations. Thousands of displaced civilians await word.',
    choices: [
      {
        label: 'Grant full clearance, house them in emergency facilities',
        effects: { materiel: -12, approval: 9 },
        resultText:
          'The stations open. Emergency housing consumes supplies meant for the fleet, and the ' +
          'Republic is seen to keep faith with its own.',
      },
      {
        label: 'Redirect to outer colony processing centers',
        effects: { materiel: -4, approval: -3 },
        resultText:
          'The transports are routed outward. Costs stay low; the frontier press notes whose ' +
          'doorstep the displaced were left on.',
      },
      {
        label: 'Prioritize screening for Directorate infiltrators first',
        effects: { approval: -7, leadershipPoints: 2 },
        resultText:
          'Screening begins before docking. Families wait in orbit for days. Counterintelligence ' +
          'flags two agents and your standing with the security services rises.',
      },
    ],
  },
  {
    id: 'conscription-authority',
    dayTrigger: 9,
    title: 'Emergency Conscription Authority',
    text:
      'Military planners request emergency conscription authority, citing the scale of the ' +
      'Directorate threat.',
    choices: [
      {
        label: 'Grant it, scrape the barrel if needed',
        effects: { population: -40, approval: -8 },
        resultText:
          'Conscription notices go out across the core worlds. Industry loses hands now; the ' +
          'formations they fill will pay for themselves later.',
        delayed: {
          afterDays: 6,
          effects: { materiel: 18 },
          text: 'Conscripted formations reach the line and captured production comes back online.',
        },
      },
      {
        label: 'Standard recruitment only for now',
        effects: {},
        resultText:
          'Recruitment continues under peacetime law. Nothing changes, which is itself a decision.',
      },
      {
        label: 'Delay the decision, gather more intelligence first',
        effects: { leadershipPoints: 1, approval: -2 },
        resultText:
          'The request is tabled pending better intelligence. Congress reads deliberation as ' +
          'competence; the general staff reads it as delay.',
      },
    ],
  },
  {
    id: 'directorate-industry',
    dayTrigger: 15,
    title: 'Directorate Industrial Estimates',
    text:
      "Intelligence reports the Directorate's industrial capacity may be larger than previously " +
      'estimated, concentrated in former Confederate mining and manufacturing systems.',
    choices: [
      {
        label: 'Fund a deep reconnaissance operation',
        effects: { materiel: -10 },
        resultText:
          'A deep reconnaissance flight is authorized. The ships are gone for weeks; what they ' +
          'bring back will shape the campaign.',
        delayed: {
          afterDays: 7,
          effects: { leadershipPoints: 3 },
          text: 'The reconnaissance flight returns with hard numbers on Directorate industry.',
        },
      },
      {
        label: 'Rely on existing estimates',
        effects: {},
        resultText:
          'The existing estimates stand. Planning proceeds on figures nobody has confirmed.',
      },
    ],
  },
  {
    id: 'frontier-senator',
    dayTrigger: 22,
    title: 'A Senator from the Frontier',
    text:
      'A senator from a former Confederate world publicly questions whether the war could have ' +
      'been prevented, citing decades of federal neglect of the frontier.',
    choices: [
      {
        label: 'Address the criticism directly in Congress',
        effects: { approval: 7, materiel: -3 },
        resultText:
          'You answer the senator on the floor and pledge frontier appropriations. The chamber ' +
          'quiets; the pledge has a price.',
      },
      {
        label: 'Dismiss it as disloyalty',
        effects: { approval: -9, leadershipPoints: 2 },
        resultText:
          'The remarks are called disloyal in wartime. The frontier delegations go cold, and the ' +
          'war cabinet closes ranks behind you.',
      },
      {
        label: 'Quietly investigate whether the claims have merit',
        effects: { approval: 3, materiel: -4 },
        resultText:
          'A quiet audit of frontier appropriations begins. It costs staff and funds, and it will ' +
          'tell you something the speeches will not.',
      },
    ],
  },
  {
    id: 'frontier-fleet-movement',
    dayTrigger: 'random',
    earliestDay: 28,
    title: 'Unconfirmed Fleet Movement',
    text:
      'An unconfirmed report places a Directorate fleet massing near another frontier system. ' +
      'The source is a single merchant transponder log, and the system has no standing garrison.',
    choices: [
      {
        label: 'Fund a deep reconnaissance operation',
        effects: { materiel: -10 },
        resultText:
          'Scouts are diverted to the frontier system. The Republic pays now for a picture it will ' +
          'not have for weeks.',
        delayed: {
          afterDays: 7,
          effects: { leadershipPoints: 3 },
          text: 'Scouts confirm the frontier fleet report and chart its approach lanes.',
        },
      },
      {
        label: 'Rely on existing estimates',
        effects: {},
        resultText:
          'The report is filed with the other unconfirmed sightings. The frontier system stays dark.',
      },
    ],
  },
];

export function findEvent(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}

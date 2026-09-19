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
    id: 'colonial-infrastructure-bill',
    dayTrigger: 2,
    title: 'The Colonial Infrastructure Bill',
    text:
      'A pre-war infrastructure bill for the outer colonies comes up for a vote. Its sponsors ' +
      "demand it move forward despite the war footing; its critics call it an indulgence the " +
      "Republic can't afford right now.",
    choices: [
      {
        label: 'Push it through as planned',
        effects: { materiel: -8, approval: 5 },
        resultText:
          'The bill passes largely intact. Colonial governors are pleased; the treasury notices.',
      },
      {
        label: 'Table it until the war is won',
        effects: { approval: -6, leadershipPoints: 1 },
        resultText:
          'The bill is shelved indefinitely. Congress grumbles, but the war cabinet gains a ' +
          'freer hand.',
      },
      {
        label: 'Gut it to a token gesture',
        effects: { materiel: -2, approval: -2 },
        resultText:
          'A watered down version passes, satisfying no one badly enough to matter, and no one ' +
          'enough to notice.',
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
    id: 'new-virginia-resistance',
    dayTrigger: 7,
    title: 'Word from Occupied New Virginia',
    text:
      "Smuggled reports describe an underground resistance forming among New Virginia's " +
      'remaining population, asking Sol for support — weapons, funds, or simply acknowledgment ' +
      "that they haven't been forgotten.",
    choices: [
      {
        label: 'Fund the resistance covertly',
        effects: { materiel: -15, leadershipPoints: 2 },
        resultText:
          'Quiet channels move funds and small arms toward New Virginia. If discovered, the ' +
          'cost will be political as much as material.',
        delayed: {
          afterDays: 5,
          effects: { approval: 6 },
          text: "Word of the funded resistance reaches Sol's press, and public mood lifts.",
        },
      },
      {
        label: 'Acknowledge them publicly, offer no material aid',
        effects: { approval: 4 },
        resultText:
          "A carefully worded statement affirms solidarity with New Virginia's resistance. It " +
          'costs nothing and reassures many; it also does nothing for those still under occupation.',
      },
      {
        label: 'Stay silent, avoid provoking reprisals',
        effects: { approval: -5 },
        resultText:
          'Congress says nothing, fearing reprisals against the very people it would be seen to ' +
          'encourage. The silence is noticed, and resented.',
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
        effects: { population: -40, manpower: 15 },
        resultText:
          'Conscription notices go out across the core worlds. Industry loses hands now; the ' +
          'manpower those formations provide will pay for itself later.',
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
    id: 'fleet-fuel-reserves',
    dayTrigger: 12,
    title: 'Fleet Fuel Reserves',
    text:
      'The Quartermaster Corps reports fleet fuel reserves running below safe thresholds after ' +
      'weeks of elevated patrol tempo. Diverting civilian shipping allocations would ease the ' +
      'shortage; rationing patrols would not.',
    choices: [
      {
        label: 'Divert civilian shipping fuel to the fleet',
        effects: { materiel: 10, approval: -6 },
        resultText:
          'Cargo lines and passenger routes lose priority overnight. The fleet refuels; ' +
          'merchants and commuters do not forget it.',
      },
      {
        label: 'Ration patrol tempo instead',
        effects: { materiel: -3, leadershipPoints: -1 },
        resultText:
          'Patrol schedules thin out across the frontier. Nothing dramatic happens today, which ' +
          'is exactly the risk.',
      },
      {
        label: 'Fund emergency synthetic fuel production',
        effects: { materiel: -18 },
        resultText:
          "A costly stopgap is authorized. It will take weeks to pay for itself, if it works at all.",
        delayed: {
          afterDays: 8,
          effects: { materiel: 20 },
          text:
            "The emergency synthetic fuel plants come online, and the fleet's fuel problem " +
            'quietly disappears.',
        },
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
    id: 'shiloh-prisoners',
    dayTrigger: 18,
    title: 'The Prisoners from Shiloh',
    text:
      'A raiding action nets several dozen captured Directorate personnel, among them officers ' +
      'who may know something about Directorate war planning. Intelligence wants them ' +
      "interrogated hard and fast, before word reaches the Directorate that they're missing.",
    choices: [
      {
        label: 'Authorize enhanced interrogation',
        effects: { leadershipPoints: 4, approval: -12 },
        resultText:
          'The interrogations proceed by whatever means intelligence judges necessary. What ' +
          'they learn is real. So is what it costs to have learned it that way.',
      },
      {
        label: 'Standard interrogation under the laws of war',
        effects: { leadershipPoints: 1 },
        resultText:
          "The prisoners are processed by the book. It yields less, slower. Nobody has to " +
          'explain later how it was done.',
      },
      {
        label: 'Offer a prisoner exchange through back channels',
        effects: { materiel: 6, approval: 3 },
        resultText:
          'Quiet feelers go out for an exchange. It buys goodwill nobody can point to and gives ' +
          'up whatever the prisoners knew.',
        delayed: {
          afterDays: 10,
          effects: { leadershipPoints: -2 },
          text:
            'The exchange falls through Directorate channels quietly, and whatever intelligence ' +
            'value the prisoners had is gone with them.',
        },
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
    id: 'colonial-governors-conference',
    dayTrigger: 25,
    title: "The Colonial Governors' Conference",
    text:
      'Governors from every Republic held system convene at Sol, several pressing for greater ' +
      "autonomy in wartime requisitioning, citing New Virginia's fall as proof that Sol cannot " +
      'always respond in time.',
    choices: [
      {
        label: 'Grant expanded emergency authority to colonial governors',
        effects: { approval: 5, leadershipPoints: -2 },
        resultText:
          "Governors get the authority they asked for. Sol's grip loosens a little; the colonies " +
          'feel heard.',
      },
      {
        label: 'Centralize wartime requisition authority further',
        effects: { leadershipPoints: 3, approval: -7 },
        resultText:
          "Sol tightens its hold instead. The war cabinet moves faster; the governors leave the " +
          'conference cold.',
      },
      {
        label: 'Split the difference with a temporary compromise',
        effects: { approval: 1, materiel: -5 },
        resultText:
          'A compromise structure satisfies the room without truly resolving anything. It ' +
          'usually does.',
      },
    ],
  },
  {
    id: 'war-profiteering-allegations',
    dayTrigger: 'random',
    earliestDay: 32,
    title: 'Allegations of War Profiteering',
    text:
      'A Congressional inquiry surfaces evidence that at least one major materiel contractor has ' +
      'been overbilling the war effort for months. The story is about to break in the press ' +
      'regardless of what Congress does.',
    choices: [
      {
        label: 'Launch a public investigation immediately',
        effects: { approval: 8, materiel: -6 },
        resultText:
          'The investigation is announced from the Capitol steps. It costs contracts and ' +
          'schedules in the short term, and buys back some public trust.',
      },
      {
        label: 'Handle it quietly through contract renegotiation',
        effects: { materiel: 8, approval: -5 },
        resultText:
          'The matter is settled behind closed doors. The treasury recovers something; when the ' +
          'story breaks anyway, the quiet handling looks like part of the problem.',
      },
      {
        label: 'Do nothing until the story breaks on its own',
        effects: { approval: -10 },
        resultText:
          'Congress waits. The press does not. The story breaks anyway, on its own terms, with ' +
          'nobody able to say the government did anything about it.',
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

// The issue a homeowner picks under a trade. A copy of the app's catalog
// (app/lib/models/service_issues.dart in the-nohm-application-1.1):
// same titles, same order, keyed by the server's Trade.name. Change
// both or the web and the app drift.
//
// The pick only feeds the job title, "<Trade> · <Issue>", exactly as
// the app builds it.

export const ISSUES = {
  HVAC: [
    { emoji: '❄️', title: 'No cool air', description: 'AC running but not cooling' },
    { emoji: '🔥', title: 'No heat', description: "Heater won't turn on or isn't warming" },
    { emoji: '💧', title: 'Water leak', description: 'Water dripping from unit or pipes' },
    { emoji: '🔊', title: 'Strange noise', description: 'Banging, buzzing, or rattling sounds' },
    { emoji: '⚡', title: "System won't turn on", description: 'Unit is completely unresponsive' },
  ],
  PLUMBING: [
    { emoji: '🚿', title: 'No hot water', description: 'Water heater not producing hot water' },
    { emoji: '🚽', title: 'Clogged drain', description: "Toilet, sink, or shower won't drain" },
    { emoji: '💧', title: 'Pipe leak', description: 'Visible water leak from pipes' },
    { emoji: '🔧', title: 'Faucet trouble', description: 'Dripping or broken faucet' },
    { emoji: '🚨', title: 'Sewer backup', description: 'Sewage backing up into the home' },
  ],
  APPLIANCE: [
    { emoji: '🧊', title: 'Refrigerator', description: 'Fridge warm, freezer not freezing, or not running' },
    { emoji: '🍽️', title: 'Dishwasher', description: "Won't start, drain, or clean properly" },
    { emoji: '👕', title: 'Washer or dryer', description: 'Washing machine or dryer malfunction' },
    { emoji: '🔥', title: 'Oven or stove', description: "Oven or stovetop won't heat up" },
    { emoji: '💨', title: 'Garbage disposal', description: 'Disposal stuck or not working' },
  ],
  ELECTRICAL: [
    { emoji: '💡', title: 'Outlet not working', description: 'Dead outlet or no power' },
    { emoji: '⚡', title: 'Breaker keeps tripping', description: "Circuit breaker won't stay on" },
    { emoji: '💡', title: 'Flickering lights', description: 'Lights dimming or flickering' },
    { emoji: '🔌', title: 'Wiring concern', description: 'Exposed wires or burning smell' },
    { emoji: '🏠', title: 'No power', description: 'Partial or full power outage' },
  ],
  ROOFING: [
    { emoji: '💧', title: 'Roof leak', description: 'Water coming through the ceiling' },
    { emoji: '🌬️', title: 'Missing shingles', description: 'Shingles blown off or damaged' },
    { emoji: '🏚️', title: 'Sagging roof', description: 'Visible dip or sag in roofline' },
    { emoji: '🌿', title: 'Gutter trouble', description: 'Gutters clogged, broken, or leaking' },
    { emoji: '🔍', title: 'Inspection needed', description: 'General roof inspection or assessment' },
  ],
};

export const ISSUES_FALLBACK = [
  { emoji: '🔧', title: "Something isn't working", description: 'Recent malfunction or breakdown' },
  { emoji: '➕', title: 'Install something', description: 'New fixture, device, or system install' },
  { emoji: '🔍', title: 'General inspection', description: 'Have a pro look at the situation' },
  { emoji: '❓', title: 'Other', description: 'Something else the pro should look at' },
];

/** The issues for a server trade name (case-insensitive), or the generic four. */
export function issuesForTrade(tradeName) {
  if (!tradeName) return ISSUES_FALLBACK;
  return ISSUES[String(tradeName).trim().toUpperCase()] || ISSUES_FALLBACK;
}

/** The job title the app would build for this pick. */
export function jobTitle(tradeLabel, issueTitle) {
  return `${tradeLabel} · ${issueTitle}`;
}

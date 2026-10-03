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
  LOCKSMITH: [
    { emoji: '🔑', title: 'Locked out', description: "Can't get into the house" },
    { emoji: '🔁', title: 'Rekey locks', description: 'New keys after a move or a lost key' },
    { emoji: '🔒', title: "Lock won't turn", description: 'Lock sticks, jams, or is broken' },
    { emoji: '🚪', title: "Door won't lock", description: "Deadbolt or latch won't catch" },
    { emoji: '🛠️', title: 'New locks', description: 'Install deadbolts or smart locks' },
  ],
  PRESSURE_WASHING: [
    { emoji: '🚗', title: 'Driveway', description: 'Stains, oil, and grime on concrete' },
    { emoji: '🏠', title: 'House siding', description: 'Mildew and dirt on the outside walls' },
    { emoji: '🪵', title: 'Deck or fence', description: 'Weathered, gray, or green wood' },
    { emoji: '🧱', title: 'Patio or walkway', description: 'Slick, dirty, or mossy paving' },
    { emoji: '🏡', title: 'Whole exterior', description: 'House, driveway, and walks together' },
  ],
  HANDYMAN: [
    { emoji: '🧱', title: 'Drywall patch', description: 'Holes, dents, or cracks in walls' },
    { emoji: '🚪', title: 'Door trouble', description: "Sticking, squeaking, or won't close" },
    { emoji: '📺', title: 'Mount something', description: 'TV, shelves, mirrors, or art' },
    { emoji: '🪑', title: 'Assembly', description: 'Furniture or fixtures to put together' },
    { emoji: '📝', title: 'Small repairs list', description: 'A few small jobs in one visit' },
  ],
  LANDSCAPING: [
    { emoji: '🌱', title: 'Lawn mowing', description: 'Mow, edge, and blow' },
    { emoji: '🍂', title: 'Yard cleanup', description: 'Leaves, branches, and debris' },
    { emoji: '🌿', title: 'Beds and mulch', description: 'Weeding, edging, and fresh mulch' },
    { emoji: '✂️', title: 'Shrub trimming', description: 'Hedges and bushes shaped up' },
    { emoji: '💧', title: 'Sprinklers', description: 'Sprinkler heads or timer not working' },
  ],
  GUTTERS: [
    { emoji: '🍂', title: 'Clogged gutters', description: 'Leaves and debris, water spilling over' },
    { emoji: '💧', title: 'Leaking gutters', description: 'Drips at seams or corners' },
    { emoji: '📉', title: 'Sagging gutters', description: 'Pulling away from the house' },
    { emoji: '⬇️', title: 'Downspout trouble', description: 'Clogged, loose, or draining too close' },
    { emoji: '🛡️', title: 'Gutter guards', description: 'Guards to keep leaves out' },
  ],
  GARAGE_DOOR: [
    { emoji: '🚪', title: 'Door stuck', description: "Won't open or close all the way" },
    { emoji: '🌀', title: 'Broken spring', description: 'Loud bang, door too heavy to lift' },
    { emoji: '📡', title: 'Opener trouble', description: 'Remote or keypad not working' },
    { emoji: '🔊', title: 'Noisy door', description: 'Grinding, squeaking, or shaking' },
    { emoji: '↘️', title: 'Off track', description: 'Door crooked or off its rollers' },
  ],
  PEST_CONTROL: [
    { emoji: '🪳', title: 'Roaches', description: 'Roaches in the kitchen or bath' },
    { emoji: '🐜', title: 'Ants', description: 'Ant trails inside the house' },
    { emoji: '🐭', title: 'Mice or rats', description: 'Droppings, scratching, chewed food' },
    { emoji: '🐝', title: 'Wasps or hornets', description: 'A nest near a door or eave' },
    { emoji: '🪵', title: 'Termites', description: 'Mud tubes, swarmers, or damaged wood' },
  ],
  PAINTING: [
    { emoji: '🎨', title: 'Interior room', description: 'Walls and ceilings in a room' },
    { emoji: '🏠', title: 'Exterior', description: 'Siding, trim, or doors outside' },
    { emoji: '🖌️', title: 'Touch-ups', description: 'Scuffs, patches, and small spots' },
    { emoji: '🪟', title: 'Trim and doors', description: 'Baseboards, doors, and window trim' },
    { emoji: '🗄️', title: 'Cabinets', description: 'Kitchen or bath cabinets refreshed' },
  ],
  FLOORING: [
    { emoji: '🪵', title: 'New floors', description: 'Hardwood, laminate, vinyl, or tile' },
    { emoji: '🔧', title: 'Floor repair', description: 'Loose, cracked, or damaged boards or tiles' },
    { emoji: '✨', title: 'Refinish hardwood', description: 'Sand and refinish worn wood' },
    { emoji: '🧶', title: 'Carpet', description: 'Install, repair, or stretch carpet' },
    { emoji: '📢', title: 'Squeaky floor', description: 'Squeaks or soft spots underfoot' },
  ],
  HOUSE_CLEANING: [
    { emoji: '🧹', title: 'Regular cleaning', description: 'Weekly or every-other-week clean' },
    { emoji: '✨', title: 'Deep clean', description: 'Top to bottom, inside and out' },
    { emoji: '📦', title: 'Move-out clean', description: 'Empty home, ready for the next' },
    { emoji: '🍽️', title: 'Kitchen and baths', description: 'Just the rooms that need it most' },
    { emoji: '🎉', title: 'After a party', description: 'Clean up after guests' },
  ],
  TREE_SERVICE: [
    { emoji: '✂️', title: 'Tree trimming', description: 'Overgrown or low branches' },
    { emoji: '🪓', title: 'Tree removal', description: 'Dead, dying, or unwanted tree' },
    { emoji: '⛈️', title: 'Storm damage', description: 'Fallen tree or broken limbs' },
    { emoji: '🪵', title: 'Stump grinding', description: 'A stump left from an old tree' },
    { emoji: '🏠', title: 'Branches near the house', description: 'Limbs over the roof or driveway' },
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

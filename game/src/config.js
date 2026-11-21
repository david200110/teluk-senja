// Teluk Senja — config.js
// One job: every tunable number, name and reward in the game lives here.

export const GAME_TITLE = 'Teluk Senja';
export const GAME_SUBTITLE = 'A dusk-city story of debt, driving and getting out clean.';
export const DEBT_TOTAL = 2400000;
export const BOSS_NAME = 'Bos Reno';
export const PLAYER_NAME = 'Arga';
export const CITY_NAME = 'Teluk Senja';

// World size (metres). The city is a grid; the sea lies to the west (-x).
export const WORLD = {
  half: 320,          // playable half-extent on land
  seaEdge: -150,      // x < seaEdge is water / beach
  beachWidth: 34,
  block: 56,          // city block pitch
  road: 14,           // road width
  buildingCount: 92,
  palmCount: 70,
  lampCount: 46,
  crateCount: 26,
};

// Player tuning
export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 11,
  punchDamage: 34,
  punchRange: 2.4,
  punchCooldown: 0.45,
  maxHealth: 100,
  carEnterRange: 4.5,
};

// Driving tuning
export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 9,
  maxSpeed: 34,
  maxReverse: 10,
  steer: 1.9,
  grip: 6.5,
  trafficCount: 14,
  policeCount: 6,
};

// Wanted system
export const WANTED = {
  maxStars: 5,
  stealHeat: 1,       // stealing a car in view of a cop / ped
  assaultHeat: 1,     // punching a civilian
  cooldownPerStar: 14, // seconds of staying clean to drop one star
  bustRange: 3.2,
  bustSpeed: 2.0,     // player must be slower than this to be busted
  finePerStar: 50000,
  hospitalFee: 75000,
};

// The 8 chained story missions. Rewards sum exactly to DEBT_TOTAL.
export const MISSIONS = [
  {
    id: 1, name: 'First Delivery', reward: 200000,
    brief: 'Arga, you owe me. Start small: drop three parcels around town and do not keep me waiting.',
    giver: 'Bos Reno',
    kind: 'deliver', count: 3,
    spots: ['Market Square', 'Senja Bar', 'Old Mosque'],
  },
  {
    id: 2, name: 'The Harbour Pickup', reward: 250000,
    brief: 'Three crates came in on the night boat. Collect them from the pier before the harbour patrol notices.',
    giver: 'Bos Reno',
    kind: 'collect', count: 3,
    spots: ['Pier North', 'Pier Mid', 'Pier South'],
  },
  {
    id: 3, name: 'Midnight Taxi', reward: 250000,
    brief: 'Sari needs a ride to Senja Bar and she pays in cash. Get a car, pick her up, and drive like a gentleman.',
    giver: 'Sari',
    kind: 'taxi', count: 1,
    spots: ['Senja Bar'],
  },
  {
    id: 4, name: 'The Repo Job', reward: 300000,
    brief: 'A red coupe near the beach garage. The owner stopped paying. Take it, bring it to my garage, no scratches.',
    giver: 'Bos Reno',
    kind: 'steal-deliver', count: 1,
    spots: ['Reno Garage'],
  },
  {
    id: 5, name: 'Beachside Brawl', reward: 300000,
    brief: 'Three of Darto\'s thugs are shaking down the beach stalls. Teach them a lesson with your fists.',
    giver: 'Bos Reno',
    kind: 'fight', count: 3,
    spots: ['Beach Stalls'],
  },
  {
    id: 6, name: 'The Getaway', reward: 350000,
    brief: 'The job went loud. Lose the heat: get to three stars, then reach the safehouse and stay clean until it cools.',
    giver: 'Bos Reno',
    kind: 'getaway', count: 1,
    spots: ['Safehouse'],
  },
  {
    id: 7, name: 'Harbour Heist', reward: 350000,
    brief: 'Four cash bags on the pier, harbour patrol everywhere. Grab them all and get out. Quiet is optional.',
    giver: 'Bos Reno',
    kind: 'collect', count: 4,
    spots: ['Pier North', 'Pier Mid', 'Pier South', 'Harbour Office'],
  },
  {
    id: 8, name: 'Settle the Debt', reward: 400000,
    brief: 'Last run. Take the final payment to Villa Reno on the hill and walk away a free man, Arga.',
    giver: 'Bos Reno',
    kind: 'deliver', count: 1,
    spots: ['Villa Reno'],
  },
];

export const MISSION_REWARD_SUM = MISSIONS.reduce((s, m) => s + m.reward, 0);

// Named places in the city (x, z) — the mission system and the minimap use these.
export const PLACES = {
  market: { x: 40, z: -60, label: 'Market Square' },
  senjaBar: { x: -40, z: 90, label: 'Senja Bar' },
  mosque: { x: 110, z: 40, label: 'Old Mosque' },
  pierNorth: { x: -168, z: -110, label: 'Pier North' },
  pierMid: { x: -168, z: 0, label: 'Pier Mid' },
  pierSouth: { x: -168, z: 110, label: 'Pier South' },
  harbourOffice: { x: -120, z: 150, label: 'Harbour Office' },
  sariPickup: { x: 60, z: 130, label: 'Sari Pickup' },
  beachGarage: { x: -110, z: -40, label: 'Beach Garage' },
  renoGarage: { x: 130, z: -120, label: 'Reno Garage' },
  beachStalls: { x: -128, z: 60, label: 'Beach Stalls' },
  safehouse: { x: -60, z: -150, label: 'Safehouse' },
  villaReno: { x: 170, z: 170, label: 'Villa Reno' },
  spawn: { x: 0, z: 0, label: 'Apartment' },
};

export const DAY_LENGTH = 240; // seconds for a full day/night cycle
export const SAVE_KEY = 'teluk-senja-save-v1';

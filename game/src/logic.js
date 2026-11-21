// Teluk Senja — logic.js
// One job: the pure, testable game rules — mission chain, debt, combat,
// wanted level, save/load. No DOM, no three.js: Node can import this file
// directly and the browser game uses the same code.

import { MISSIONS, DEBT_TOTAL, WANTED, PLAYER } from './config.js';
import { blankSave } from './util.js';

export { MISSIONS, DEBT_TOTAL, blankSave };

export function createState() {
  return {
    missionIndex: 0,          // 0-based; 8 means the story is complete
    objectiveDone: 0,         // objectives finished in the current mission
    money: 0,
    debtPaid: 0,
    health: PLAYER.maxHealth,
    wanted: 0,
    heatTimer: 0,             // seconds clean; drops a star when it passes the threshold
    dead: false,
    busted: false,
    completed: [],
    playSeconds: 0,
  };
}

export function currentMission(state) {
  return state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
}

export function objectivesTotal(state) {
  const m = currentMission(state);
  return m ? m.count : 0;
}

export function debtRemaining(state) {
  return DEBT_TOTAL - state.debtPaid;
}

// Advance one objective. Returns 'objective' | 'mission-complete' | 'story-complete' | 'none'.
export function completeObjective(state) {
  const m = currentMission(state);
  if (!m) return 'none';
  state.objectiveDone += 1;
  if (state.objectiveDone < m.count) return 'objective';
  state.objectiveDone = 0;
  state.money += m.reward;
  state.debtPaid += m.reward;
  state.completed.push(m.id);
  state.missionIndex += 1;
  return state.missionIndex >= MISSIONS.length ? 'story-complete' : 'mission-complete';
}

// Combat: punch a target with `health`. Returns remaining health.
export function punchDamage(targetHealth) {
  return Math.max(0, targetHealth - PLAYER.punchDamage);
}

// Damage the player. Returns 'alive' | 'wasted'.
export function hurtPlayer(state, amount) {
  state.health = Math.max(0, state.health - amount);
  if (state.health <= 0) { state.dead = true; return 'wasted'; }
  return 'alive';
}

export function healPlayer(state, amount) {
  state.health = Math.min(PLAYER.maxHealth, state.health + amount);
  return state.health;
}

// Wanted level: add stars, capped at the maximum.
export function addHeat(state, stars) {
  state.wanted = Math.min(WANTED.maxStars, state.wanted + stars);
  state.heatTimer = 0;
  return state.wanted;
}

// Tick the cooldown. `dt` seconds of staying clean; returns the new star count.
export function tickHeat(state, dt, clean) {
  if (state.wanted <= 0) { state.heatTimer = 0; return 0; }
  if (!clean) { state.heatTimer = 0; return state.wanted; }
  state.heatTimer += dt;
  const need = WANTED.cooldownPerStar * state.wanted;
  if (state.heatTimer >= need) {
    state.wanted -= 1;
    state.heatTimer = 0;
  }
  return state.wanted;
}

// Bust check: a cop within range while the player is slow. Returns true when busted.
export function bustCheck(state, copDistance, playerSpeed) {
  if (state.wanted <= 0) return false;
  if (copDistance <= WANTED.bustRange && playerSpeed <= WANTED.bustSpeed) {
    state.busted = true;
    const fine = WANTED.finePerStar * state.wanted;
    state.money = Math.max(0, state.money - fine);
    state.wanted = 0;
    state.heatTimer = 0;
    return true;
  }
  return false;
}

// Wasted: hospital fee and respawn with half health.
export function respawnAfterWasted(state) {
  state.money = Math.max(0, state.money - WANTED.hospitalFee);
  state.health = Math.floor(PLAYER.maxHealth / 2);
  state.wanted = 0;
  state.dead = false;
  return state;
}

// Save / load round-trip through the plain object shape in util.js.
export function toSave(state, playerPos) {
  return {
    version: 1,
    missionIndex: state.missionIndex,
    money: state.money,
    debtPaid: state.debtPaid,
    health: state.health,
    wanted: state.wanted,
    player: { x: playerPos.x, z: playerPos.z, heading: playerPos.heading || 0 },
    completed: [...state.completed],
    playSeconds: Math.floor(state.playSeconds),
  };
}

export function fromSave(state, save) {
  if (!save) return false;
  state.missionIndex = save.missionIndex;
  state.money = save.money;
  state.debtPaid = save.debtPaid;
  state.health = save.health;
  state.wanted = save.wanted;
  state.completed = [...save.completed];
  state.playSeconds = save.playSeconds || 0;
  state.objectiveDone = 0;
  state.dead = false;
  state.busted = false;
  state.heatTimer = 0;
  return true;
}

// Small helper used by the HUD: stars as a string, e.g. "***--".
export function starsString(wanted) {
  return '★'.repeat(wanted) + '☆'.repeat(WANTED.maxStars - wanted);
}

// Teluk Senja — util.js
// One job: small pure helpers (seeded RNG, math, money formatting, save shape).

// Mulberry32 — tiny deterministic RNG so the city layout is stable per seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}
export function dist(ax, az, bx, bz) { return Math.sqrt(dist2(ax, az, bx, bz)); }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Indonesian rupiah: 2400000 -> "Rp 2,400,000"
export function formatRp(n) {
  const v = Math.round(n);
  return 'Rp ' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatClock(seconds) {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor(seconds / 60) % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Blank save shape — the shape save/load round-trips through localStorage.
export function blankSave() {
  return {
    version: 1,
    missionIndex: 0,      // 0-based index into MISSIONS
    money: 0,
    debtPaid: 0,
    health: 100,
    wanted: 0,
    player: { x: 0, z: 0, heading: 0 },
    completed: [],
    playSeconds: 0,
  };
}

export function serializeSave(save) { return JSON.stringify(save); }

export function parseSave(text) {
  try {
    const s = JSON.parse(text);
    if (!s || typeof s !== 'object' || s.version !== 1) return null;
    const b = blankSave();
    for (const k of Object.keys(b)) if (k in s) b[k] = s[k];
    b.missionIndex = clamp(b.missionIndex | 0, 0, 8);
    b.money = Math.max(0, b.money | 0);
    b.debtPaid = clamp(b.debtPaid | 0, 0, 2400000);
    b.health = clamp(b.health | 0, 1, 100);
    b.wanted = clamp(b.wanted | 0, 0, 5);
    return b;
  } catch (_e) { return null; }
}

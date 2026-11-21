// Teluk Senja — peds.js
// One job: people on foot — wandering civilians, the three beach thugs for
// mission 5, and Sari, the passenger for mission 3.

import * as THREE from 'three';
import { WORLD } from './config.js';
import { mulberry32, clamp, dist } from './util.js';

const SHIRT_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1];

export function buildPersonMesh(shirt, skin = 0xc68642) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.0, 0.4),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.85;
  head.castShadow = true;
  g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  for (const sx of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.55, 0.26), legMat);
    leg.position.set(sx, 0.28, 0);
    g.add(leg);
  }
  return g;
}

export class Ped {
  constructor(scene, x, z, shirt) {
    this.mesh = buildPersonMesh(shirt);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.heading = Math.random() * Math.PI * 2;
    this.health = 100;
    this.speed = 1.2 + Math.random() * 0.8;
    this.fleeing = false;
    this.alive = true;
    this.walkPhase = Math.random() * 10;
  }

  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // Simple walk bob.
    this.walkPhase += 0.12;
    this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.06;
  }
}

export class Crowd {
  constructor(scene, city, count = 26, seed = 31337) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(seed);
    this.peds = [];
    for (let i = 0; i < count; i++) {
      const x = -130 + this.rng() * 420;
      const z = -290 + this.rng() * 580;
      const shirt = SHIRT_COLORS[Math.floor(this.rng() * SHIRT_COLORS.length)];
      const p = new Ped(scene, x, z, shirt);
      this.peds.push(p);
    }
  }

  update(dt, playerX, playerZ, playerPunching) {
    for (const p of this.peds) {
      if (!p.alive) continue;
      const d = dist(p.x, p.z, playerX, playerZ);
      if (playerPunching && d < 6) p.fleeing = true;
      if (p.fleeing) {
        // Run away from the player.
        const away = Math.atan2(p.x - playerX, p.z - playerZ);
        p.heading = away;
        p.x += Math.sin(away) * 4.5 * dt;
        p.z += Math.cos(away) * 4.5 * dt;
        if (d > 30) p.fleeing = false;
      } else {
        // Wander: mostly straight, occasionally turn at a corner.
        if (this.rng() < dt * 0.15) p.heading += (this.rng() - 0.5) * 1.6;
        const nx = p.x + Math.sin(p.heading) * p.speed * dt;
        const nz = p.z + Math.cos(p.heading) * p.speed * dt;
        const pos = this.city.resolveCollision(nx, nz, 0.6);
        if (Math.abs(pos.x - nx) > 0.1 || Math.abs(pos.z - nz) > 0.1) {
          p.heading += Math.PI * (0.5 + this.rng() * 0.5);
        } else {
          p.x = pos.x; p.z = pos.z;
        }
        p.x = clamp(p.x, -140, 330);
        p.z = clamp(p.z, -300, 300);
      }
      p.sync();
    }
  }

  // Punch resolution: the closest living ped within range takes the hit.
  // Returns the ped hit (or null) and whether it was a civilian (heat).
  punchAt(x, z, range, heading) {
    let best = null, bestD = range;
    for (const p of this.peds) {
      if (!p.alive) continue;
      const d = dist(p.x, p.z, x, z);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best) return null;
    best.health -= 34;
    best.fleeing = true;
    if (best.health <= 0) {
      best.alive = false;
      best.mesh.visible = false;
    }
    return best;
  }
}

// The three thugs of mission 5: they stand at the beach stalls and fight back.
export class Thugs {
  constructor(scene, spots) {
    this.scene = scene;
    this.thugs = spots.map(([x, z], i) => {
      const p = new Ped(scene, x + (i - 1) * 3, z, 0x8a2f2f);
      p.health = 100;
      p.isThug = true;
      p.attackCooldown = 0;
      return p;
    });
    this.active = false;
  }

  get aliveCount() { return this.thugs.filter((t) => t.alive).length; }

  reset() {
    for (const t of this.thugs) {
      t.alive = true;
      t.health = 100;
      t.mesh.visible = true;
    }
    this.active = false;
  }

  update(dt, playerX, playerZ, onHitPlayer) {
    if (!this.active) return;
    for (const t of this.thugs) {
      if (!t.alive) continue;
      const d = dist(t.x, t.z, playerX, playerZ);
      t.attackCooldown = Math.max(0, t.attackCooldown - dt);
      if (d > 2.2) {
        // Close in on the player.
        const h = Math.atan2(playerX - t.x, playerZ - t.z);
        t.heading = h;
        t.x += Math.sin(h) * 3.4 * dt;
        t.z += Math.cos(h) * 3.4 * dt;
      } else if (t.attackCooldown <= 0) {
        t.attackCooldown = 1.1;
        if (onHitPlayer) onHitPlayer(12);
      }
      t.sync();
    }
  }

  // The player's punch lands on the closest living thug in range.
  punchAt(x, z, range) {
    let best = null, bestD = range;
    for (const t of this.thugs) {
      if (!t.alive) continue;
      const d = dist(t.x, t.z, x, z);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (!best) return null;
    best.health -= 34;
    if (best.health <= 0) {
      best.alive = false;
      best.mesh.visible = false;
    }
    return best;
  }
}

// Sari — mission 3's passenger. Waits at her pickup spot, then rides along.
export class Sari {
  constructor(scene, x, z) {
    this.ped = new Ped(scene, x, z, 0xff6b9d);
    this.state = 'waiting'; // waiting | riding | done
  }

  get pos() { return { x: this.ped.x, z: this.ped.z }; }
}

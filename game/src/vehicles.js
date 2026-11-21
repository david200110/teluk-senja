// Teluk Senja — vehicles.js
// One job: cars. Building them, driving physics for the player car, and the
// simple traffic + police-chase steering that fills the streets.

import * as THREE from 'three';
import { CAR, WORLD } from './config.js';
import { mulberry32, clamp, angleLerp, dist } from './util.js';

const CAR_COLORS = [0xd64545, 0x3a6ea5, 0xe8c547, 0x7a7f85, 0x4a9e5c, 0xe8e8e8, 0x222222, 0xc77dff];

export function buildCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a33 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.2, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
  }
  // Headlights + taillights.
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), hl);
    h.position.set(sx, 0.6, 2.22);
    g.add(h);
  }
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const sx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tl);
    h.position.set(sx, 0.6, -2.22);
    g.add(h);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.65, -0.2);
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.position.set(0.5, 1.65, -0.2);
    g.add(bar2);
  }
  return g;
}

export class Car {
  constructor(scene, x, z, heading, color, isPolice = false) {
    this.mesh = buildCarMesh(color, isPolice);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
    this.isPolice = isPolice;
    this.color = color;
    this.stolen = false;
    this.driver = null; // 'player' | 'traffic' | null (parked)
  }

  get pos() { return { x: this.x, z: this.z }; }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  // Arcade driving: throttle, steer, grip. Returns distance driven this tick.
  drive(dt, throttle, steerInput, handbrake) {
    const accel = throttle > 0 ? CAR.accel * throttle : (throttle < 0 ? CAR.reverseAccel * throttle : 0);
    this.speed += accel * dt;
    if (throttle === 0) {
      const drag = 8 * dt;
      this.speed = Math.abs(this.speed) < drag ? 0 : this.speed - Math.sign(this.speed) * drag;
    }
    if (handbrake) this.speed *= Math.max(0, 1 - 5 * dt);
    this.speed = clamp(this.speed, -CAR.maxReverse, CAR.maxSpeed);
    const steerAmount = steerInput * CAR.steer * clamp(Math.abs(this.speed) / 8, 0, 1) * (this.speed < 0 ? -1 : 1);
    this.heading += steerAmount * dt * (handbrake ? 1.5 : 1);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;
    this.syncMesh();
    return Math.abs(this.speed) * dt;
  }
}

export class Traffic {
  constructor(scene, city, seed = 777) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(seed);
    this.cars = [];
    this.spawnTraffic();
  }

  randomRoadSpot() {
    const pitch = 56;
    const onVertical = this.rng() < 0.5;
    if (onVertical) {
      const gx = Math.floor(this.rng() * 7) - 3;
      return { x: gx * pitch + (this.rng() < 0.5 ? -3.5 : 3.5), z: -280 + this.rng() * 560, heading: this.rng() < 0.5 ? 0 : Math.PI };
    }
    const gz = Math.floor(this.rng() * 9) - 4;
    return { x: -120 + this.rng() * 380, z: gz * pitch + (this.rng() < 0.5 ? -3.5 : 3.5), heading: this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  }

  spawnTraffic() {
    for (let i = 0; i < CAR.trafficCount; i++) {
      const s = this.randomRoadSpot();
      const color = CAR_COLORS[Math.floor(this.rng() * CAR_COLORS.length)];
      const car = new Car(this.scene, s.x, s.z, s.heading, color);
      car.driver = 'traffic';
      car.speed = 6 + this.rng() * 5;
      car.cruise = car.speed;
      this.cars.push(car);
    }
    // A few parked cars near the spawn plaza for the player to steal.
    const parked = [
      { x: 8, z: 18, h: Math.PI / 2, c: 0xd64545 },
      { x: -14, z: 22, h: -Math.PI / 2, c: 0x3a6ea5 },
      { x: 20, z: -16, h: 0, c: 0xe8c547 },
      { x: -110, z: -30, h: Math.PI, c: 0xc0392b }, // the red coupe for mission 4
    ];
    for (const p of parked) {
      const car = new Car(this.scene, p.x, p.z, p.h, p.c);
      car.driver = null;
      this.cars.push(car);
    }
    this.redCoupe = this.cars[this.cars.length - 1];
  }

  nearestCar(x, z, maxDist, excludePolice = true) {
    let best = null, bestD = maxDist;
    for (const c of this.cars) {
      if (excludePolice && c.isPolice) continue;
      if (c.driver === 'player') continue;
      const d = dist(x, z, c.x, c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  update(dt, playerX, playerZ) {
    for (const car of this.cars) {
      if (car.driver !== 'traffic') continue;
      // Cruise forward; if a building is ahead, pick a new road heading.
      const ahead = this.city.resolveCollision(
        car.x + Math.sin(car.heading) * 6, car.z + Math.cos(car.heading) * 6, 2,
      );
      const blocked = Math.abs(ahead.x - (car.x + Math.sin(car.heading) * 6)) > 0.5 ||
        Math.abs(ahead.z - (car.z + Math.cos(car.heading) * 6)) > 0.5;
      if (blocked || Math.abs(car.x) > WORLD.half + 30 || Math.abs(car.z) > WORLD.half + 10) {
        // Turn around at a junction: snap to a perpendicular road heading.
        car.heading = (Math.round((car.heading + Math.PI / 2) / (Math.PI / 2)) * (Math.PI / 2));
        car.speed = car.cruise;
      }
      car.speed = clamp(car.speed, car.cruise * 0.8, car.cruise * 1.2);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.syncMesh();
    }
  }
}

export class Police {
  constructor(scene, city, seed = 4242) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(seed);
    this.cars = [];
    for (let i = 0; i < CAR.policeCount; i++) {
      const s = { x: -100 + this.rng() * 340, z: -260 + this.rng() * 520 };
      const car = new Car(scene, s.x, s.z, this.rng() * Math.PI * 2, 0x1a1a2e, true);
      car.driver = 'police';
      car.active = false;
      this.cars.push(car);
    }
    this.sirenCooldown = 0;
  }

  // Chase the player: steer toward them, ram at close range. Returns the
  // nearest active cop distance (Infinity when no cop is active).
  update(dt, playerX, playerZ, wanted, onRam) {
    let nearest = Infinity;
    const active = wanted > 0;
    for (const car of this.cars) {
      if (!active) {
        car.active = false;
        car.speed *= Math.max(0, 1 - 2 * dt);
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        car.syncMesh();
        continue;
      }
      // Activate the closest idle cops first.
      const d = dist(car.x, car.z, playerX, playerZ);
      if (!car.active && d < 260 + wanted * 40) car.active = true;
      if (!car.active) continue;
      nearest = Math.min(nearest, d);
      const targetHeading = Math.atan2(playerX - car.x, playerZ - car.z);
      car.heading = angleLerp(car.heading, targetHeading, clamp(2.2 * dt, 0, 1));
      const top = 20 + wanted * 2.5;
      car.speed = clamp(car.speed + 14 * dt, 0, top);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const pos = this.city.resolveCollision(car.x, car.z, 2);
      car.x = pos.x; car.z = pos.z;
      car.syncMesh();
      if (d < 3.4 && onRam) onRam(car, d);
    }
    return nearest;
  }
}

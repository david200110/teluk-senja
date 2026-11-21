// Teluk Senja — city.js
// One job: build the procedural coastal city and run the day/night sky.
// Everything is low-poly boxes, cylinders and planes — no loaded assets.

import * as THREE from 'three';
import { WORLD, PLACES, DAY_LENGTH } from './config.js';
import { mulberry32, clamp, lerp } from './util.js';

const DUSK_PALETTE = [
  0xff9a5c, 0xffb27a, 0xf2c14e, 0x8ecae6, 0xff7f51, 0xe07a5f, 0x90be6d,
];

export class City {
  constructor(scene, seed = 20261122) {
    this.scene = scene;
    this.rng = mulberry32(seed);
    this.buildings = [];   // {x, z, w, d, h, mesh}
    this.palms = [];
    this.lamps = [];        // {x, z, light, bulb}
    this.crates = [];       // {x, z, mesh, taken}
    this.colliders = [];    // {x, z, r} circles the player/cars cannot pass
    this.timeOfDay = 0.72;  // 0..1, 0.72 = 17:15, late-afternoon dusk light
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildGround();
    this.buildSea();
    this.buildPier();
    this.buildRoads();
    this.buildBuildings();
    this.buildPalms();
    this.buildLamps();
    this.buildCrates();
    this.buildLandmarks();
    this.sun = new THREE.DirectionalLight(0xffb27a, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -260; this.sun.shadow.camera.right = 260;
    this.sun.shadow.camera.top = 260; this.sun.shadow.camera.bottom = -260;
    this.sun.shadow.camera.far = 900;
    scene.add(this.sun);
    this.ambient = new THREE.AmbientLight(0x8a7a9e, 0.7);
    scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xff9a5c, 0x2c3e50, 0.55);
    scene.add(this.hemi);
    this.updateSky();
  }

  box(w, h, d, color, x, y, z, opts = {}) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color, emissive: opts.emissive || 0x000000 }),
    );
    m.position.set(x, y, z);
    if (opts.ry) m.rotation.y = opts.ry;
    m.castShadow = !!opts.shadow;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  buildGround() {
    // Land: warm asphalt-toned ground plane, from the shoreline (seaEdge)
    // to the eastern edge of the city — it must NOT cover the sea.
    const landW = (WORLD.half + 40) - WORLD.seaEdge;
    const land = new THREE.Mesh(
      new THREE.PlaneGeometry(landW, WORLD.half * 2 + 60),
      new THREE.MeshLambertMaterial({ color: 0x5c5648 }),
    );
    land.rotation.x = -Math.PI / 2;
    land.position.set(WORLD.seaEdge + landW / 2, 0, 0);
    land.receiveShadow = true;
    this.group.add(land);
    // Beach strip: pale sand between the city edge and the water.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.beachWidth + 6, WORLD.half * 2 + 60),
      new THREE.MeshLambertMaterial({ color: 0xd9b380 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(WORLD.seaEdge + WORLD.beachWidth / 2 - 3, 0.05, 0);
    sand.receiveShadow = true;
    this.group.add(sand);
  }

  buildSea() {
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(420, WORLD.half * 2 + 400),
      new THREE.MeshLambertMaterial({ color: 0x1d5f7a, transparent: true, opacity: 0.94 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(WORLD.seaEdge - 210, -0.4, 0);
    this.group.add(sea);
    this.sea = sea;
    // Gentle animated swell is done in update() by moving the sea plane's z.
  }

  buildPier() {
    // Wooden pier jutting into the bay at z = 0, with lamp posts.
    const deck = this.box(46, 1.2, 10, 0x7a5230, WORLD.seaEdge - 20, 0.9, 0);
    deck.receiveShadow = true;
    for (let i = 0; i < 5; i++) {
      this.box(1, 2.6, 1, 0x4a3220, WORLD.seaEdge - 2 - i * 9, 0.4, -4.2);
      this.box(1, 2.6, 1, 0x4a3220, WORLD.seaEdge - 2 - i * 9, 0.4, 4.2);
    }
    this.box(8, 1.5, 8, 0x6b4a2a, WORLD.seaEdge - 40, 2.2, 0); // pier hut
  }

  buildRoads() {
    // Grid roads: dark strips along every block line, plus a coast road.
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x33302e });
    const pitch = WORLD.block;
    const half = WORLD.half;
    for (let gx = -3; gx <= 3; gx++) {
      const x = gx * pitch;
      const r = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.road, half * 2), roadMat);
      r.rotation.x = -Math.PI / 2;
      r.position.set(x, 0.08, 0);
      r.receiveShadow = true;
      this.group.add(r);
    }
    for (let gz = -4; gz <= 4; gz++) {
      const z = gz * pitch;
      const r = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 120, WORLD.road), roadMat);
      r.rotation.x = -Math.PI / 2;
      r.position.set(60, 0.08, z);
      r.receiveShadow = true;
      this.group.add(r);
    }
    // Centre dashes on the main avenue.
    for (let z = -280; z <= 280; z += 12) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4), new THREE.MeshBasicMaterial({ color: 0xd9c25a }));
      d.rotation.x = -Math.PI / 2;
      d.position.set(0, 0.1, z);
      this.group.add(d);
    }
  }

  buildBuildings() {
    const rng = this.rng;
    const pitch = WORLD.block;
    const palette = DUSK_PALETTE;
    let placed = 0;
    let guard = 0;
    while (placed < WORLD.buildingCount && guard++ < 4000) {
      const gx = Math.floor(rng() * 7) - 3;
      const gz = Math.floor(rng() * 9) - 4;
      const bx = gx * pitch + (rng() - 0.5) * 18;
      const bz = gz * pitch + (rng() - 0.5) * 18;
      if (bx < WORLD.seaEdge + 30) continue; // keep the beach clear
      if (Math.abs(bx) < 12 && Math.abs(bz) < 12) continue; // spawn plaza
      const w = 14 + rng() * 16;
      const d = 14 + rng() * 16;
      const h = 8 + rng() * rng() * 42;
      const color = palette[Math.floor(rng() * palette.length)];
      const mesh = this.box(w, h, d, color, bx, h / 2, bz, { shadow: true });
      // Lit windows: a few emissive strips near the top.
      if (rng() < 0.6) {
        const win = this.box(w * 0.7, 1.2, 0.4, 0x000000, bx, h * (0.55 + rng() * 0.3), bz + d / 2 + 0.1, { emissive: 0xffd27a });
        win.material = new THREE.MeshBasicMaterial({ color: 0xffd27a });
      }
      // Rooftop box for taller towers.
      if (h > 30) this.box(w * 0.35, 3, d * 0.35, 0x6b6258, bx, h + 1.5, bz);
      this.buildings.push({ x: bx, z: bz, w, d, h, mesh });
      this.colliders.push({ x: bx, z: bz, r: Math.max(w, d) * 0.62 });
      placed++;
    }
  }

  buildPalms() {
    const rng = this.rng;
    for (let i = 0; i < WORLD.palmCount; i++) {
      let x, z;
      if (i < 24) { // beach row
        x = WORLD.seaEdge + 8 + rng() * 22;
        z = -300 + rng() * 600;
      } else {
        x = -120 + rng() * 380;
        z = -300 + rng() * 600;
        if (x < WORLD.seaEdge + 30) continue;
      }
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.55, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x8a6a45 }),
      );
      trunk.position.set(x, 3.5, z);
      trunk.rotation.z = (rng() - 0.5) * 0.2;
      trunk.castShadow = true;
      this.group.add(trunk);
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 2.6, 7),
        new THREE.MeshLambertMaterial({ color: 0x2e7d32 }),
      );
      crown.position.set(x, 8, z);
      this.group.add(crown);
      this.palms.push({ x, z });
      this.colliders.push({ x, z, r: 1 });
    }
  }

  buildLamps() {
    const rng = this.rng;
    for (let i = 0; i < WORLD.lampCount; i++) {
      const gx = Math.floor(rng() * 7) - 3;
      const gz = Math.floor(rng() * 9) - 4;
      const x = gx * WORLD.block + WORLD.road / 2 + 2;
      const z = gz * WORLD.block;
      if (x < WORLD.seaEdge + 30) continue;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 6, 6),
        new THREE.MeshLambertMaterial({ color: 0x222222 }),
      );
      pole.position.set(x, 3, z);
      this.group.add(pole);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), bulbMat);
      bulb.position.set(x, 6.2, z);
      this.group.add(bulb);
      const light = new THREE.PointLight(0xffd27a, 0, 26, 1.6);
      light.position.set(x, 6, z);
      this.scene.add(light);
      this.lamps.push({ x, z, light, bulb });
    }
  }

  buildCrates() {
    const rng = this.rng;
    const spots = [
      [PLACES.pierNorth.x + 6, PLACES.pierNorth.z], [PLACES.pierMid.x + 6, PLACES.pierMid.z],
      [PLACES.pierSouth.x + 6, PLACES.pierSouth.z], [-120, 40], [-100, -90], [90, 150],
    ];
    for (let i = 0; i < WORLD.crateCount; i++) {
      let x, z;
      if (i < spots.length) { [x, z] = spots[i]; }
      else {
        x = -120 + rng() * 360;
        z = -280 + rng() * 560;
        if (x < WORLD.seaEdge + 30) continue;
      }
      const mesh = this.box(2.2, 2.2, 2.2, 0xa67c3d, x, 1.1, z, { shadow: true, ry: rng() * Math.PI });
      this.crates.push({ x, z, mesh, taken: false });
      this.colliders.push({ x, z, r: 1.8 });
    }
  }

  buildLandmarks() {
    // Senja Bar — low neon-lit block on the west avenue.
    this.box(20, 7, 14, 0x7a2e4a, PLACES.senjaBar.x, 3.5, PLACES.senjaBar.z, { shadow: true });
    const neon = this.box(12, 1.4, 0.5, 0x000000, PLACES.senjaBar.x, 6.4, PLACES.senjaBar.z + 7.2, { emissive: 0xff2e88 });
    neon.material = new THREE.MeshBasicMaterial({ color: 0xff2e88 });
    // Old Mosque — white block with a dome and a minaret.
    this.box(16, 9, 16, 0xe8e0cc, PLACES.mosque.x, 4.5, PLACES.mosque.z, { shadow: true });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2e7d6b }));
    dome.position.set(PLACES.mosque.x, 9, PLACES.mosque.z);
    this.group.add(dome);
    const minaret = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 20, 8), new THREE.MeshLambertMaterial({ color: 0xe8e0cc }));
    minaret.position.set(PLACES.mosque.x + 11, 10, PLACES.mosque.z);
    minaret.castShadow = true;
    this.group.add(minaret);
    // Villa Reno — big house on the north-east hill.
    this.box(26, 12, 20, 0xf2e6c9, PLACES.villaReno.x, 6, PLACES.villaReno.z, { shadow: true });
    this.box(30, 2, 24, 0x8a2f2f, PLACES.villaReno.x, 13, PLACES.villaReno.z);
    // Reno Garage — grey block with a red door.
    this.box(22, 8, 16, 0x5a6068, PLACES.renoGarage.x, 4, PLACES.renoGarage.z, { shadow: true });
    const door = this.box(10, 5, 0.5, 0x000000, PLACES.renoGarage.x, 2.5, PLACES.renoGarage.z + 8.2, { emissive: 0xc0392b });
    door.material = new THREE.MeshBasicMaterial({ color: 0xc0392b });
    // Harbour office.
    this.box(14, 6, 10, 0x4a6b7a, PLACES.harbourOffice.x, 3, PLACES.harbourOffice.z, { shadow: true });
    // Safehouse — small blue house.
    this.box(12, 6, 10, 0x3a6ea5, PLACES.safehouse.x, 3, PLACES.safehouse.z, { shadow: true });
    this.colliders.push(
      { x: PLACES.senjaBar.x, z: PLACES.senjaBar.z, r: 13 },
      { x: PLACES.mosque.x, z: PLACES.mosque.z, r: 12 },
      { x: PLACES.villaReno.x, z: PLACES.villaReno.z, r: 16 },
      { x: PLACES.renoGarage.x, z: PLACES.renoGarage.z, r: 13 },
      { x: PLACES.harbourOffice.x, z: PLACES.harbourOffice.z, r: 9 },
      { x: PLACES.safehouse.x, z: PLACES.safehouse.z, r: 8 },
    );
  }

  // --- Day / night ---
  // timeOfDay t maps to the clock as t * 24h: 0.25 = 06:00 sunrise,
  // 0.5 = 12:00 noon, 0.75 = 18:00 sunset, 0.85 = 20:24 night.
  setTimeOfDay(t) { this.timeOfDay = clamp(t, 0, 1); this.updateSky(); }

  updateSky() {
    const t = this.timeOfDay;
    // Sun elevation: 1 at noon, 0 at sunrise/sunset, negative at night.
    const dayFrac = (t - 0.25) / 0.5;
    const elev = Math.sin(dayFrac * Math.PI);
    const daylight = clamp(elev * 1.6, 0, 1);
    const dusk = clamp(1 - Math.abs(elev) * 2.6, 0, 1);
    const night = clamp((0.06 - elev) * 4, 0, 1);
    // Sun position follows the day arc (east at sunrise, west at sunset).
    const az = Math.cos(dayFrac * Math.PI);
    this.sun.position.set(az * 300, Math.max(10, elev * 320), 140);
    // Sky: night blue -> day blue, then pulled to orange at dusk.
    const sky = new THREE.Color().setHSL(0.62, 0.55, lerp(0.07, 0.58, daylight));
    if (dusk > 0) {
      const duskSky = new THREE.Color().setHSL(0.07, 0.78, lerp(0.42, 0.55, daylight));
      sky.lerp(duskSky, dusk * (1 - night * 0.6));
    }
    if (this.scene.background && this.scene.background.isColor) this.scene.background.copy(sky);
    else this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 180, 620);
    // The low sun still lights dusk (afterglow); ambient/hemi floors keep
    // the city readable at dusk and at night under the lamps.
    this.sun.intensity = lerp(0.2, 2.6, daylight) + dusk * 0.8;
    this.sun.color.setHSL(dusk > 0.4 ? 0.08 : 0.12, 0.75, 0.62);
    this.ambient.intensity = lerp(0.55, 0.8, daylight);
    this.hemi.intensity = lerp(0.45, 0.65, daylight);
    const lampsOn = elev < 0.08;
    for (const l of this.lamps) {
      l.light.intensity = lampsOn ? 14 : 0;
      l.bulb.material.color.setHex(lampsOn ? 0xffe9a8 : 0x555555);
    }
  }

  update(dt, elapsed) {
    // Slow day/night drift.
    this.timeOfDay = (this.timeOfDay + dt / DAY_LENGTH) % 1;
    this.updateSky();
    // Sea swell.
    if (this.sea) this.sea.position.y = -0.4 + Math.sin(elapsed * 0.6) * 0.12;
  }

  // Circle-collider resolve: push a point out of every collider it overlaps.
  resolveCollision(x, z, radius) {
    let nx = x, nz = z;
    for (const c of this.colliders) {
      const dx = nx - c.x, dz = nz - c.z;
      const d2 = dx * dx + dz * dz;
      const min = c.r + radius;
      if (d2 < min * min && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = c.x + (dx / d) * min;
        nz = c.z + (dz / d) * min;
      }
    }
    // World bounds + water: the player cannot walk into the sea past the pier line.
    nx = clamp(nx, WORLD.seaEdge - 38, WORLD.half + 40);
    nz = clamp(nz, -WORLD.half - 20, WORLD.half + 20);
    return { x: nx, z: nz };
  }
}

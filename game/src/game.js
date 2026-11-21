// Teluk Senja — game.js
// One job: the running game. Player on foot and in cars, the third-person
// camera, punch combat, the wanted system (chase / ram / bust / cooldown),
// menus and save/load. It wires city, traffic, police, crowd, missions,
// audio and HUD together.

import * as THREE from 'three';
import { WORLD, PLAYER, CAR, WANTED, PLACES, DAY_LENGTH, SAVE_KEY, GAME_TITLE, MISSIONS } from './config.js';
import {
  createState, currentMission, completeObjective, hurtPlayer, healPlayer,
  addHeat, tickHeat, bustCheck, respawnAfterWasted, toSave, fromSave, debtRemaining,
} from './logic.js';
import { clamp, dist, formatRp, formatClock, parseSave, serializeSave, angleLerp } from './util.js';
import { City } from './city.js';
import { Traffic, Police } from './vehicles.js';
import { Crowd, Thugs, Sari } from './peds.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';

export const SCREENS = ['menu', 'playing', 'paused', 'busted', 'wasted', 'complete'];

export class Game {
  constructor() {
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.state = createState();
    this.screen = 'menu';
    this.keys = {};
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 9;
    this.camOrbit = 0;
    this.player = null;      // THREE.Group mesh
    this.playerX = PLACES.spawn.x;
    this.playerZ = PLACES.spawn.z;
    this.playerHeading = 0;
    this.playerSpeed = 0;
    this.inCar = null;       // Car the player is driving
    this.punchTimer = 0;
    this.punchAnim = 0;
    this.ramCooldown = 0;
    this.sirenTimer = 0;
    this.elapsed = 0;
    this.engineSound = null;
    this.startedAt = 0;
    this.shotMode = null;
  }

  init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2c1e3a);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(0, 8, -14);

    this.city = new City(this.scene);
    this.traffic = new Traffic(this.scene, this.city);
    this.police = new Police(this.scene, this.city);
    this.crowd = new Crowd(this.scene, this.city);
    this.thugs = new Thugs(this.scene, [
      [PLACES.beachStalls.x, PLACES.beachStalls.z],
      [PLACES.beachStalls.x + 4, PLACES.beachStalls.z + 3],
      [PLACES.beachStalls.x - 4, PLACES.beachStalls.z + 2],
    ]);
    this.sari = new Sari(this.scene, PLACES.sariPickup.x, PLACES.sariPickup.z);
    this.hud = new HUD();
    this.audio = new AudioEngine();
    this.missions = new MissionManager(this.scene, this.state, {
      onDialogue: (lines) => this.hud.showDialogue(lines),
      onHint: (t) => this.hud.showHint(t, 6000),
      onObjective: (m, done, label) => {
        this.audio.pickup();
        this.hud.toast(`Objective done: ${label}  (${done}/${m.count})`);
        this.hud.setMission(this.state, true);
      },
      onMissionComplete: (m) => {
        this.audio.missionComplete();
        this.audio.cash();
        this.hud.showCenter(`<h2>Mission Complete</h2><p>${m.name}</p><p class="gold">+ ${formatRp(m.reward)}</p><p>Debt left: ${formatRp(debtRemaining(this.state))}</p>`);
        this.hud.setCash(this.state.money);
        this.hud.setDebt(this.state);
        this.hud.setMission(this.state, false);
        this.saveGame();
      },
      onStoryComplete: () => {
        this.audio.missionComplete();
        this.setScreen('complete');
      },
    });

    // Player mesh: Arga in a teal jacket.
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.05, 0.42), new THREE.MeshLambertMaterial({ color: 0x0e7c7b }));
    body.position.y = 1.05; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 10), new THREE.MeshLambertMaterial({ color: 0xc68642 }));
    head.position.y = 1.88; head.castShadow = true; g.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.16, 12), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    cap.position.y = 2.12; g.add(cap);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    for (const sx of [-0.19, 0.19]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.55, 0.27), legMat);
      leg.position.set(sx, 0.28, 0); g.add(leg);
    }
    // Punch arm (swings forward on attack).
    this.punchArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.7), new THREE.MeshLambertMaterial({ color: 0x0e7c7b }));
    this.punchArm.position.set(0.35, 1.35, 0.3);
    g.add(this.punchArm);
    this.player = g;
    this.player.position.set(this.playerX, 0, this.playerZ);
    this.scene.add(this.player);

    // Mission 5 thugs activate when the mission starts.
    this.missionStartHook = () => {
      const m = currentMission(this.state);
      if (m && m.id === 5) { this.thugs.reset(); this.thugs.active = true; }
      if (m && m.id === 6) { addHeat(this.state, 3); this.hud.setWanted(this.state.wanted); }
      if (m && m.id === 7) { addHeat(this.state, 1); this.hud.setWanted(this.state.wanted); }
    };

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.refreshHUD();
  }

  // --- Screens ---
  setScreen(name) {
    this.screen = name;
    for (const s of SCREENS) {
      const el = document.getElementById('screen-' + s);
      if (el) el.classList.toggle('active', s === name);
    }
    document.getElementById('hud').classList.toggle('hidden', name !== 'playing');
    if (name === 'playing') {
      this.audio.ensure();
      this.audio.startMusic();
      if (!this.engineSound) this.engineSound = this.audio.engine();
    } else {
      this.audio.stopMusic();
    }
    if (name === 'complete') {
      const el = document.getElementById('complete-stats');
      if (el) el.textContent = `Debt paid: ${formatRp(this.state.debtPaid)}  ·  Cash: ${formatRp(this.state.money)}  ·  Missions: ${this.state.completed.length}/8  ·  Time: ${Math.floor(this.state.playSeconds / 60)}m ${Math.floor(this.state.playSeconds % 60)}s`;
    }
  }

  startNewGame() {
    this.state = createState();
    this.missions.state = this.state;
    this.playerX = PLACES.spawn.x;
    this.playerZ = PLACES.spawn.z;
    this.playerHeading = 0;
    this.inCar = null;
    this.thugs.reset();
    this.setScreen('playing');
    this.hud.showHint('Welcome to Teluk Senja, Arga. Press M to start Mission 1 — First Delivery.', 6000);
    this.refreshHUD();
  }

  continueGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    const save = raw ? parseSave(raw) : null;
    if (!save) { this.startNewGame(); return; }
    this.state = createState();
    fromSave(this.state, save);
    this.missions.state = this.state;
    this.playerX = save.player.x;
    this.playerZ = save.player.z;
    this.playerHeading = save.player.heading || 0;
    this.setScreen('playing');
    this.hud.showHint(`Welcome back, Arga. Mission ${Math.min(this.state.missionIndex + 1, 8)}/8 — press M to continue.`, 6000);
    this.refreshHUD();
  }

  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, serializeSave(toSave(this.state, { x: this.playerX, z: this.playerZ, heading: this.playerHeading })));
      return true;
    } catch (_e) { return false; }
  }

  refreshHUD() {
    this.hud.setCash(this.state.money);
    this.hud.setDebt(this.state);
    this.hud.setHealth(this.state.health);
    this.hud.setWanted(this.state.wanted);
    this.hud.setMission(this.state, this.missions.missionActive);
  }

  // --- Input ---
  onKeyDown(e) {
    if (e.repeat) return;
    this.keys[e.code] = true;
    if (this.screen !== 'playing') return;
    if (e.code === 'KeyM') {
      if (!this.missions.missionActive) {
        if (this.missions.startMission()) {
          this.missionStartHook();
          this.hud.setMission(this.state, true);
          this.audio.blip(520, 0.12, 'triangle', 0.2);
        }
      }
    }
    if (e.code === 'KeyE') this.tryEnterExitCar();
    if (e.code === 'KeyF') this.tryPunch();
    if (e.code === 'KeyP' || e.code === 'Escape') this.setScreen('paused');
    if (e.code === 'KeyR' && this.saveGame()) this.hud.toast('Game saved.');
  }

  onKeyUp(e) { this.keys[e.code] = false; }

  tryEnterExitCar() {
    if (this.inCar) {
      const car = this.inCar;
      car.driver = null;
      this.inCar = null;
      this.playerX = car.x - Math.sin(car.heading) * 3;
      this.playerZ = car.z - Math.cos(car.heading) * 3;
      this.player.visible = true;
      this.audio.doorSlam();
      return;
    }
    const car = this.traffic.nearestCar(this.playerX, this.playerZ, PLAYER.carEnterRange);
    if (!car) return;
    // Stealing a car the driver is in, or any car while a cop is near, is a crime.
    const copNear = this.police.cars.some((c) => dist(c.x, c.z, this.playerX, this.playerZ) < 30);
    const witnessed = car.driver === 'traffic' || copNear || this.crowd.peds.some((p) => p.alive && dist(p.x, p.z, this.playerX, this.playerZ) < 18);
    if (witnessed) {
      addHeat(this.state, WANTED.stealHeat);
      this.hud.setWanted(this.state.wanted);
      this.hud.toast('Car stolen — the city saw it. Wanted level up!');
    }
    if (car.driver === 'traffic') car.driver = null;
    car.driver = 'player';
    car.stolen = true;
    this.inCar = car;
    this.player.visible = false;
    this.audio.doorSlam();
    // Mission 4: the red coupe is the target.
    if (currentMission(this.state)?.id === 4 && car === this.traffic.redCoupe && this.missions.missionActive) {
      this.hud.toast('That is the coupe. Take it to Reno Garage — no scratches.');
    }
  }

  tryPunch() {
    if (this.inCar || this.punchTimer > 0) return;
    this.punchTimer = PLAYER.punchCooldown;
    this.punchAnim = 0.28;
    this.audio.punch();
    const fx = this.playerX + Math.sin(this.playerHeading) * 1.6;
    const fz = this.playerZ + Math.cos(this.playerHeading) * 1.6;
    // Thugs first (mission 5), then civilians.
    const thug = this.thugs.active ? this.thugs.punchAt(fx, fz, PLAYER.punchRange) : null;
    if (thug) {
      if (!thug.alive) {
        this.hud.toast(`Thug down — ${this.thugs.aliveCount} left.`);
        if (this.thugs.aliveCount === 0 && this.missions.missionActive && currentMission(this.state)?.id === 5) {
          const finished = currentMission(this.state);
          completeObjective(this.state);
          this.missions.missionActive = false;
          this.missions.hideMarker();
          this.missions.hooks.onMissionComplete(finished);
        }
      }
      return;
    }
    const ped = this.crowd.punchAt(fx, fz, PLAYER.punchRange, this.playerHeading);
    if (ped) {
      addHeat(this.state, WANTED.assaultHeat);
      this.hud.setWanted(this.state.wanted);
      this.hud.toast(ped.alive ? 'You hit a civilian! The police will hear about this.' : 'You knocked someone out cold!');
    }
  }

  // --- Wanted / bust / wasted ---
  handleBusted() {
    this.audio.busted();
    // The fine was already deducted by bustCheck (finePerStar x stars).
    this.setScreen('busted');
    const el = document.getElementById('busted-text');
    if (el) el.textContent = `Busted! The Teluk Senja police took you in and fined you. You are back on the street — lay low, Arga.`;
    if (this.inCar) { this.inCar.driver = null; this.inCar = null; this.player.visible = true; }
    this.playerX = PLACES.spawn.x; this.playerZ = PLACES.spawn.z;
    this.state.health = Math.max(50, this.state.health);
    this.state.busted = false;
    this.refreshHUD();
    this.saveGame();
  }

  handleWasted() {
    this.audio.wasted();
    respawnAfterWasted(this.state);
    this.setScreen('wasted');
    if (this.inCar) { this.inCar.driver = null; this.inCar = null; this.player.visible = true; }
    this.playerX = PLACES.spawn.x; this.playerZ = PLACES.spawn.z;
    this.refreshHUD();
    this.saveGame();
  }

  // --- Frame update ---
  update(dt) {
    this.elapsed += dt;
    this.city.update(dt, this.elapsed);
    if (this.screen !== 'playing') {
      // Idle menu camera: slow orbit over the dusk avenue.
      const t = this.elapsed * 0.05;
      this.camera.position.set(Math.sin(t) * 60, 26, Math.cos(t) * 60 - 20);
      this.camera.lookAt(0, 6, 0);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.state.playSeconds += dt;
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.ramCooldown = Math.max(0, this.ramCooldown - dt);

    // --- Movement ---
    const run = this.keys.ShiftLeft || this.keys.ShiftRight;
    if (this.inCar) this.updateDriving(dt);
    else this.updateOnFoot(dt, run);

    // --- World life ---
    this.traffic.update(dt, this.playerX, this.playerZ);
    this.crowd.update(dt, this.playerX, this.playerZ, this.punchTimer > 0);
    this.thugs.update(dt, this.playerX, this.playerZ, (dmg) => {
      if (hurtPlayer(this.state, dmg) === 'wasted') this.handleWasted();
      this.hud.setHealth(this.state.health);
    });

    // --- Police ---
    const nearestCop = this.police.update(dt, this.playerX, this.playerZ, this.state.wanted, (car, d) => {
      if (this.ramCooldown > 0) return;
      this.ramCooldown = 1.2;
      if (this.inCar) {
        this.inCar.speed *= 0.55;
        this.audio.punch();
      } else if (hurtPlayer(this.state, 10) === 'wasted') {
        this.handleWasted();
      }
      this.hud.setHealth(this.state.health);
    });
    if (this.state.wanted > 0) {
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) { this.sirenTimer = 2.4; this.audio.siren(); }
    }

    // --- Wanted cooldown: clean means no crime recently and no cop close. ---
    const clean = nearestCop > 60;
    tickHeat(this.state, dt, clean);
    this.hud.setWanted(this.state.wanted);

    // --- Bust check ---
    if (nearestCop !== Infinity && bustCheck(this.state, nearestCop, Math.abs(this.playerSpeed))) {
      this.handleBusted();
      return;
    }
    if (this.state.dead) { this.handleWasted(); return; }

    // --- Missions ---
    const inCarNow = !!this.inCar;
    const m = currentMission(this.state);
    if (m && m.id === 6 && this.missions.missionActive) {
      // Getaway: the safehouse only counts once the player has 3 stars and
      // has then cooled back down to 0.
      if (this.state.wanted >= 3) this.missions.getawayArmed = true;
      if (this.missions.getawayArmed && this.state.wanted === 0 &&
        dist(this.playerX, this.playerZ, PLACES.safehouse.x, PLACES.safehouse.z) < 5) {
        completeObjective(this.state);
        this.missions.missionActive = false;
        this.missions.hideMarker();
        this.missions.hooks.onMissionComplete(MISSIONS[5]);
      }
    } else {
      this.missions.update(this.playerX, this.playerZ, inCarNow);
    }
    this.missions.pulse(this.elapsed);

    // --- Sari (mission 3) ---
    if (m && m.id === 3 && this.missions.missionActive) {
      if (this.sari.state === 'waiting' && dist(this.playerX, this.playerZ, this.sari.pos.x, this.sari.pos.z) < 4 && this.inCar) {
        this.sari.state = 'riding';
        this.sari.ped.mesh.visible = false;
        this.hud.toast('Sari is in. Drive her to Senja Bar.');
        this.missions.spotIndex = 1;
        this.missions.placeMarker();
      }
    }

    // --- HUD + clock ---
    const tod = this.city.timeOfDay;
    const clockSeconds = tod * 24 * 3600;
    const dayPart = tod > 0.8 || tod < 0.24 ? 'Night' : (tod > 0.68 && tod < 0.8) || (tod > 0.24 && tod < 0.32) ? 'Dusk' : 'Day';
    this.hud.setClock(formatClock(clockSeconds) + '  ·  ' + dayPart);
    this.hud.setSpeed(this.inCar ? this.inCar.speed : this.playerSpeed, !!this.inCar);
    this.hud.drawMinimap(
      { x: this.playerX, z: this.playerZ, heading: this.inCar ? this.inCar.heading : this.playerHeading },
      {
        objective: this.missions.missionActive ? this.missions.activeSpot : null,
        police: this.state.wanted > 0 ? this.police.cars.filter((c) => c.active) : [],
        thugs: this.thugs.active ? this.thugs.thugs : [],
      },
    );

    // --- Camera ---
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  updateOnFoot(dt, run) {
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = 0, mz = 0;
    if (this.keys.KeyW) mz += 1;
    if (this.keys.KeyS) mz -= 1;
    if (this.keys.KeyA) mx -= 1;
    if (this.keys.KeyD) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      // Move relative to the camera yaw.
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      const wx = (mx * cos - mz * sin);
      const wz = (-mx * sin - mz * cos);
      const targetHeading = Math.atan2(wx, wz);
      this.playerHeading = angleLerp(this.playerHeading, targetHeading, clamp(12 * dt, 0, 1));
      const nx = this.playerX + wx * speed * dt;
      const nz = this.playerZ + wz * speed * dt;
      const pos = this.city.resolveCollision(nx, nz, 0.7);
      this.playerX = pos.x;
      this.playerZ = pos.z;
      this.playerSpeed = speed;
    } else {
      this.playerSpeed = 0;
    }
    this.player.position.set(this.playerX, Math.abs(Math.sin(this.elapsed * (run ? 11 : 7))) * (len > 0 ? 0.06 : 0), this.playerZ);
    this.player.rotation.y = this.playerHeading;
    // Punch arm swing.
    if (this.punchAnim > 0) {
      this.punchAnim -= dt;
      this.punchArm.position.z = 0.3 + Math.sin((0.28 - this.punchAnim) / 0.28 * Math.PI) * 0.7;
    } else {
      this.punchArm.position.z = 0.3;
    }
  }

  updateDriving(dt) {
    const car = this.inCar;
    const throttle = (this.keys.KeyW ? 1 : 0) + (this.keys.KeyS ? -1 : 0);
    const steer = (this.keys.KeyA ? 1 : 0) + (this.keys.KeyD ? -1 : 0);
    const handbrake = !!this.keys.Space;
    car.drive(dt, throttle, steer, handbrake);
    const pos = this.city.resolveCollision(car.x, car.z, 2.2);
    if (Math.abs(pos.x - car.x) > 0.05 || Math.abs(pos.z - car.z) > 0.05) {
      car.speed *= 0.4; // bumped a building
    }
    car.x = pos.x; car.z = pos.z;
    car.syncMesh();
    this.playerX = car.x;
    this.playerZ = car.z;
    this.playerHeading = car.heading;
    this.playerSpeed = car.speed;
    this.audio.setEngineRpm(this.engineSound, clamp(Math.abs(car.speed) / CAR.maxSpeed, 0, 1), true);
  }

  updateCamera(dt) {
    const target = this.inCar ? this.inCar : null;
    const focusX = this.playerX;
    const focusZ = this.playerZ;
    const heading = this.inCar ? this.inCar.heading : this.playerHeading;
    // Camera follows behind the player's facing, mouse orbits with drag.
    const yaw = this.inCar ? heading + Math.PI + this.camOrbit : this.camYaw;
    const pitch = this.camPitch;
    const distC = this.inCar ? this.camDist + 3 : this.camDist;
    const cx = focusX + Math.sin(yaw) * Math.cos(pitch) * distC;
    const cz = focusZ + Math.cos(yaw) * Math.cos(pitch) * distC;
    const cy = 2 + Math.sin(pitch) * distC + (this.inCar ? 1.5 : 0);
    this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), clamp(8 * dt, 0, 1));
    this.camera.lookAt(focusX, 2.2, focusZ);
  }

  // --- Screenshot poses (used only by shots.js through ?shot=...) ---
  applyShot(name) {
    this.shotMode = name;
    this.setScreen('playing');
    this.state = createState();
    this.missions.state = this.state;
    if (name === 'cover') {
      this.city.setTimeOfDay(0.70); // 16:48, warm late-afternoon light
      this.playerX = 0; this.playerZ = -40;
      this.camYaw = Math.PI; this.camPitch = 0.22; this.camDist = 14;
    } else if (name === 'drive') {
      this.city.setTimeOfDay(0.75); // 18:00, sunset
      this.state.missionIndex = 0;
      this.missions.startMission();
      // Long-lived dialogue for the shot: the capture may come seconds later.
      this.hud.showDialogue([['Bos Reno', 'Three parcels. Market Square, Senja Bar, Old Mosque. Go.']], 30000);
      const car = this.traffic.cars.find((c) => !c.isPolice && c.driver === null);
      if (car) {
        car.driver = 'player';
        this.inCar = car;
        this.player.visible = false;
        this.playerX = car.x; this.playerZ = car.z;
        car.speed = 12;
      }
      this.camOrbit = 0;
    } else if (name === 'chase') {
      this.city.setTimeOfDay(0.72); // 17:15, late afternoon
      addHeat(this.state, 3);
      this.hud.setWanted(3);
      const car = this.traffic.cars.find((c) => !c.isPolice && c.driver === null);
      if (car) {
        car.driver = 'player';
        this.inCar = car;
        this.player.visible = false;
        this.playerX = car.x; this.playerZ = car.z;
        car.speed = 20;
      }
      for (const pc of this.police.cars) {
        pc.active = true;
        pc.x = this.playerX + (Math.random() - 0.5) * 30;
        pc.z = this.playerZ - 14 - Math.random() * 10;
      }
      this.camOrbit = 0;
    } else if (name === 'harbor') {
      this.city.setTimeOfDay(0.86); // 20:38, night at the pier
      this.playerX = PLACES.pierMid.x + 14;
      this.playerZ = PLACES.pierMid.z + 4;
      this.playerHeading = -Math.PI / 2;
      this.camYaw = Math.PI / 2; this.camPitch = 0.3; this.camDist = 12;
    }
    this.refreshHUD();
    this.hud.setMission(this.state, this.missions.missionActive);
  }
}

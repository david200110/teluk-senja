// Teluk Senja — missions.js
// One job: the 8-mission story chain — where each objective lives, what the
// marker shows, and the dialogue each mission opens with. It reads the pure
// rules from logic.js and drives the 3D markers.

import * as THREE from 'three';
import { MISSIONS, PLACES } from './config.js';
import { currentMission, completeObjective } from './logic.js';
import { dist } from './util.js';

// Objective coordinates per mission id (1-based). Each entry is a list of
// [x, z, label] spots the player must reach, in order.
export function missionSpots(missionId) {
  switch (missionId) {
    case 1: return [
      [PLACES.market.x, PLACES.market.z, 'Market Square'],
      [PLACES.senjaBar.x, PLACES.senjaBar.z, 'Senja Bar'],
      [PLACES.mosque.x, PLACES.mosque.z, 'Old Mosque'],
    ];
    case 2: return [
      [PLACES.pierNorth.x + 4, PLACES.pierNorth.z, 'Pier North crate'],
      [PLACES.pierMid.x + 4, PLACES.pierMid.z, 'Pier Mid crate'],
      [PLACES.pierSouth.x + 4, PLACES.pierSouth.z, 'Pier South crate'],
    ];
    case 3: return [
      [PLACES.sariPickup.x, PLACES.sariPickup.z, 'Pick up Sari'],
      [PLACES.senjaBar.x, PLACES.senjaBar.z, 'Drive Sari to Senja Bar'],
    ];
    case 4: return [
      [PLACES.beachGarage.x, PLACES.beachGarage.z, 'Steal the red coupe'],
      [PLACES.renoGarage.x, PLACES.renoGarage.z, 'Deliver it to Reno Garage'],
    ];
    case 5: return [[PLACES.beachStalls.x, PLACES.beachStalls.z, 'Beat the thugs']];
    case 6: return [
      [PLACES.safehouse.x, PLACES.safehouse.z, 'Reach the Safehouse'],
    ];
    case 7: return [
      [PLACES.pierNorth.x + 4, PLACES.pierNorth.z, 'Cash bag 1'],
      [PLACES.pierMid.x + 4, PLACES.pierMid.z, 'Cash bag 2'],
      [PLACES.pierSouth.x + 4, PLACES.pierSouth.z, 'Cash bag 3'],
      [PLACES.harbourOffice.x, PLACES.harbourOffice.z, 'Cash bag 4'],
    ];
    case 8: return [[PLACES.villaReno.x, PLACES.villaReno.z, 'Deliver the payment']];
    default: return [];
  }
}

// Dialogue lines shown when a mission starts (giver -> line).
export const MISSION_DIALOGUE = {
  1: [
    ['Bos Reno', 'Arga. You owe me two million four hundred thousand. Work it off, or the boys come for the bike.'],
    ['Arga', 'I will pay it back. Every rupiah. What do you need first?'],
    ['Bos Reno', 'Three parcels. Market Square, Senja Bar, Old Mosque. Go.'],
  ],
  2: [
    ['Bos Reno', 'A boat came in at the pier. Three crates, my name on them. Collect them before the patrol gets curious.'],
    ['Arga', 'On my way. Anything else hiding in those crates?'],
    ['Bos Reno', 'Less questions, more walking.'],
  ],
  3: [
    ['Sari', 'Arga! You drive now? Take me to Senja Bar — I have a shift and the bus never comes.'],
    ['Arga', 'Get in. First ride is on Bos Reno, I suppose.'],
    ['Sari', 'Just drive like a gentleman and we will get along.'],
  ],
  4: [
    ['Bos Reno', 'A red coupe by the beach garage. The owner stopped paying his dues. Take it. Bring it to my garage.'],
    ['Arga', 'Stealing a car in broad daylight. This is how the debt gets paid?'],
    ['Bos Reno', 'This is how it gets paid. No scratches, Arga.'],
  ],
  5: [
    ['Bos Reno', 'Darto\'s thugs are shaking down my beach stalls. Three of them. Sort it out with your fists.'],
    ['Arga', 'Three against one. Fair enough for a Tuesday.'],
    ['Bos Reno', 'Come back in one piece. The debt does not pay itself.'],
  ],
  6: [
    ['Bos Reno', 'The job went loud, Arga. Cops are coming. Get to the safehouse — and stay out of sight until the heat dies.'],
    ['Arga', 'Three stars and a safehouse. I have done worse.'],
    ['Bos Reno', 'Do not get caught. A busted courier pays nothing.'],
  ],
  7: [
    ['Bos Reno', 'Four cash bags on the pier. Harbour patrol is thick tonight. Grab them all, get out clean.'],
    ['Arga', 'Four bags, one pier, half the police in Teluk Senja. Fine.'],
    ['Bos Reno', 'Quiet is optional. Coming back is not.'],
  ],
  8: [
    ['Bos Reno', 'Last run, Arga. Take the final payment to Villa Reno. After this, we are square.'],
    ['Arga', 'Two million four hundred thousand. Every rupiah earned. I am coming, Bos.'],
    ['Bos Reno', 'Walk away a free man. Do not look back.'],
  ],
};

export class MissionManager {
  constructor(scene, state, hooks) {
    this.scene = scene;
    this.state = state;   // the pure logic state from logic.js
    this.hooks = hooks;   // { onObjective, onMissionComplete, onStoryComplete, onDialogue, onHint }
    this.marker = null;
    this.markerRing = null;
    this.spotIndex = 0;   // which spot of the current mission is active
    this.missionActive = false;
    this.buildMarker();
  }

  buildMarker() {
    const geo = new THREE.CylinderGeometry(2.6, 2.6, 0.35, 24);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.75 });
    this.marker = new THREE.Mesh(geo, mat);
    this.marker.position.y = 0.3;
    this.marker.visible = false;
    this.scene.add(this.marker);
    const ringGeo = new THREE.TorusGeometry(3.2, 0.18, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    this.markerRing = new THREE.Mesh(ringGeo, ringMat);
    this.markerRing.rotation.x = Math.PI / 2;
    this.markerRing.position.y = 0.4;
    this.markerRing.visible = false;
    this.scene.add(this.markerRing);
    // A tall light pillar so the objective is visible across the city.
    const pillarGeo = new THREE.CylinderGeometry(0.9, 0.9, 60, 12, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
    this.pillar = new THREE.Mesh(pillarGeo, pillarMat);
    this.pillar.position.y = 30;
    this.pillar.visible = false;
    this.scene.add(this.pillar);
  }

  get mission() { return currentMission(this.state); }

  get activeSpot() {
    const spots = this.mission ? missionSpots(this.mission.id) : [];
    return spots[this.spotIndex] || null;
  }

  startMission() {
    const m = this.mission;
    if (!m || this.missionActive) return false;
    this.missionActive = true;
    this.spotIndex = 0;
    this.state.objectiveDone = 0;
    this.placeMarker();
    if (this.hooks.onDialogue) this.hooks.onDialogue(MISSION_DIALOGUE[m.id] || []);
    if (this.hooks.onHint) this.hooks.onHint(`Mission ${m.id}: ${m.name} — ${m.brief}`);
    return true;
  }

  placeMarker() {
    const spot = this.activeSpot;
    if (!spot) { this.hideMarker(); return; }
    const [x, z] = spot;
    this.marker.position.set(x, 0.3, z);
    this.markerRing.position.set(x, 0.4, z);
    this.pillar.position.set(x, 30, z);
    this.marker.visible = true;
    this.markerRing.visible = true;
    this.pillar.visible = true;
  }

  hideMarker() {
    this.marker.visible = false;
    this.markerRing.visible = false;
    this.pillar.visible = false;
  }

  // Called every frame with the player's position. Returns true when an
  // objective was completed this tick.
  update(playerX, playerZ, inCar) {
    if (!this.missionActive || !this.mission) return false;
    const spot = this.activeSpot;
    if (!spot) return false;
    const [x, z, label] = spot;
    const reach = this.mission.kind === 'taxi' && this.spotIndex === 1 ? 7 : 4.5;
    if (dist(playerX, playerZ, x, z) > reach) return false;
    // Mission-specific gates: taxi leg 2 and repo delivery need a car.
    if ((this.mission.id === 3 && this.spotIndex === 1 && !inCar) ||
        (this.mission.id === 4 && this.spotIndex === 1 && !inCar)) {
      return false;
    }
    const result = completeObjective(this.state);
    if (result === 'objective') {
      this.spotIndex += 1;
      this.placeMarker();
      if (this.hooks.onObjective) this.hooks.onObjective(this.mission, this.state.objectiveDone, label);
      return true;
    }
    if (result === 'mission-complete') {
      this.missionActive = false;
      this.hideMarker();
      if (this.hooks.onMissionComplete) this.hooks.onMissionComplete(this.mission);
      return true;
    }
    if (result === 'story-complete') {
      this.missionActive = false;
      this.hideMarker();
      if (this.hooks.onStoryComplete) this.hooks.onStoryComplete();
      return true;
    }
    return false;
  }

  // Mission 6 special: the getaway needs 3 stars before the safehouse counts.
  getawayReady() {
    return this.mission && this.mission.id === 6 && this.state.wanted >= 3;
  }

  pulse(elapsed) {
    if (!this.marker.visible) return;
    const s = 1 + Math.sin(elapsed * 4) * 0.12;
    this.marker.scale.set(s, 1, s);
    this.markerRing.position.y = 0.4 + Math.sin(elapsed * 3) * 0.35;
  }
}

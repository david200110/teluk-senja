// Teluk Senja — hud.js
// One job: the 2D overlay — cash, debt, health, wanted stars, mission tracker,
// dialogue box, hints, and the live minimap canvas.

import { WORLD } from './config.js';
import { formatRp } from './util.js';
import { debtRemaining, currentMission, starsString } from './logic.js';

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['cash', 'debt', 'health', 'healthbar', 'stars', 'clock', 'mission', 'objective', 'hint', 'dialogue', 'dlgName', 'dlgText', 'speed', 'center', 'toast']) {
      this.el[id] = document.getElementById(id);
    }
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map ? this.map.getContext('2d') : null;
    this.dialogueQueue = [];
    this.dialogueTimer = null;
    this.hintTimer = null;
  }

  setCash(money) { if (this.el.cash) this.el.cash.textContent = formatRp(money); }
  setDebt(state) {
    if (this.el.debt) this.el.debt.textContent = 'Debt: ' + formatRp(debtRemaining(state));
  }
  setHealth(h) {
    if (this.el.health) this.el.health.textContent = Math.round(h) + ' HP';
    if (this.el.healthbar) this.el.healthbar.style.width = Math.max(0, h) + '%';
  }
  setWanted(w) {
    if (this.el.stars) {
      this.el.stars.textContent = starsString(w);
      this.el.stars.classList.toggle('hot', w > 0);
    }
  }
  setClock(text) { if (this.el.clock) this.el.clock.textContent = text; }
  setSpeed(kmh, inCar) {
    if (!this.el.speed) return;
    this.el.speed.textContent = inCar ? Math.round(Math.abs(kmh) * 3.6) + ' km/h' : '';
  }

  setMission(state, active) {
    const m = currentMission(state);
    if (!m) {
      if (this.el.mission) this.el.mission.textContent = 'Story complete — Teluk Senja is yours, Arga.';
      if (this.el.objective) this.el.objective.textContent = 'Debt paid in full.';
      return;
    }
    if (this.el.mission) this.el.mission.textContent = `Mission ${m.id}/8 — ${m.name}  ·  ${formatRp(m.reward)}`;
    if (this.el.objective) {
      this.el.objective.textContent = active
        ? `Objective ${state.objectiveDone + 1}/${m.count} — follow the gold marker`
        : 'Press M to start the mission';
    }
  }

  showHint(text, ms = 4200) {
    if (!this.el.hint) return;
    this.el.hint.textContent = text;
    this.el.hint.classList.add('show');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.el.hint.classList.remove('show'), ms);
  }

  toast(text, ms = 3000) {
    if (!this.el.toast) return;
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    setTimeout(() => this.el.toast.classList.remove('show'), ms);
  }

  // Dialogue: queue of [name, line]; each line shows ~ms (default 3.4s).
  showDialogue(lines, ms = 3400) {
    this.dialogueMs = ms;
    this.dialogueQueue = [...lines];
    this.nextDialogue();
  }

  nextDialogue() {
    clearTimeout(this.dialogueTimer);
    const line = this.dialogueQueue.shift();
    if (!line) {
      if (this.el.dialogue) this.el.dialogue.classList.remove('show');
      return;
    }
    const [name, text] = line;
    if (this.el.dlgName) this.el.dlgName.textContent = name;
    if (this.el.dlgText) this.el.dlgText.textContent = text;
    if (this.el.dialogue) this.el.dialogue.classList.add('show');
    this.dialogueTimer = setTimeout(() => this.nextDialogue(), this.dialogueMs || 3400);
  }

  showCenter(html, ms = 2600) {
    if (!this.el.center) return;
    this.el.center.innerHTML = html;
    this.el.center.classList.add('show');
    setTimeout(() => this.el.center.classList.remove('show'), ms);
  }

  // --- Minimap ---
  drawMinimap(player, opts) {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const W = this.map.width, H = this.map.height;
    const half = WORLD.half + 60;
    const toMap = (x, z) => [((x + half) / (half * 2)) * W, ((z + half) / (half * 2)) * H];
    // Sea + land.
    ctx.fillStyle = '#14384a';
    ctx.fillRect(0, 0, W, H);
    const [lx] = toMap(WORLD.seaEdge, 0);
    ctx.fillStyle = '#3d3a33';
    ctx.fillRect(lx, 0, W - lx, H);
    ctx.fillStyle = '#d9b380';
    ctx.fillRect(lx - 8, 0, 8, H);
    // Roads.
    ctx.strokeStyle = '#55524a';
    ctx.lineWidth = 3;
    for (let gx = -3; gx <= 3; gx++) {
      const [x] = toMap(gx * 56, 0);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let gz = -4; gz <= 4; gz++) {
      const [, y] = toMap(0, gz * 56);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // Objective marker (gold, pulsing).
    if (opts.objective) {
      const [ox, oy] = toMap(opts.objective[0], opts.objective[1]);
      const r = 5 + Math.sin(performance.now() / 200) * 2;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ox, oy, r + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // Police dots (blue).
    if (opts.police) for (const p of opts.police) {
      const [px, py] = toMap(p.x, p.z);
      ctx.fillStyle = '#4a90ff';
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Thugs (red).
    if (opts.thugs) for (const t of opts.thugs) {
      if (!t.alive) continue;
      const [tx, ty] = toMap(t.x, t.z);
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow (white, rotated by heading).
    const [px, py] = toMap(player.x, player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-player.heading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // North label.
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('N', 6, 12);
  }
}

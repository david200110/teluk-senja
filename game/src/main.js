// Teluk Senja — main.js
// One job: boot the game. Wires the canvas, keyboard/mouse input, menu
// buttons, the frame loop, and the ?shot= poses the screenshot run uses.

import { Game } from './game.js';
import { GAME_TITLE, GAME_SUBTITLE } from './config.js';

const game = new Game();
window.__game = game; // the play-test and screenshot scripts drive the game through this.

const canvas = document.getElementById('game-canvas');
game.init(canvas);

document.getElementById('menu-title').textContent = GAME_TITLE;
document.getElementById('menu-subtitle').textContent = GAME_SUBTITLE;

// --- Menu buttons ---
const btnNew = document.getElementById('btn-new');
const btnContinue = document.getElementById('btn-continue');
const btnResume = document.getElementById('btn-resume');
const btnRestart = document.getElementById('btn-restart');
const btnRetry = document.getElementById('btn-retry');
const btnMenuBusted = document.getElementById('btn-menu-busted');
const btnMenuWasted = document.getElementById('btn-menu-wasted');
const btnMenuComplete = document.getElementById('btn-menu-complete');
const btnMute = document.getElementById('btn-mute');

if (btnNew) btnNew.addEventListener('click', () => { game.audio.ensure(); game.startNewGame(); });
if (btnContinue) btnContinue.addEventListener('click', () => { game.audio.ensure(); game.continueGame(); });
if (btnResume) btnResume.addEventListener('click', () => game.setScreen('playing'));
if (btnRestart) btnRestart.addEventListener('click', () => { game.startNewGame(); });
if (btnRetry) btnRetry.addEventListener('click', () => { game.startNewGame(); });
if (btnMenuBusted) btnMenuBusted.addEventListener('click', () => game.setScreen('menu'));
if (btnMenuWasted) btnMenuWasted.addEventListener('click', () => game.setScreen('menu'));
if (btnMenuComplete) btnMenuComplete.addEventListener('click', () => game.setScreen('menu'));
if (btnMute) btnMute.addEventListener('click', () => {
  game.audio.setMuted(!game.audio.muted);
  btnMute.textContent = game.audio.muted ? 'Sound: Off' : 'Sound: On';
});

// Show "Continue" only when a save exists.
try {
  if (localStorage.getItem('teluk-senja-save-v1')) btnContinue.classList.remove('hidden');
} catch (_e) { /* storage unavailable — new game only */ }

// --- Keyboard ---
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  game.onKeyDown(e);
});
window.addEventListener('keyup', (e) => game.onKeyUp(e));

// --- Mouse orbit: drag to look around on foot; in a car it orbits the chase cam. ---
let dragging = false;
let lastX = 0, lastY = 0;
canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  game.camYaw -= dx * 0.005;
  game.camPitch = Math.max(0.05, Math.min(1.1, game.camPitch + dy * 0.004));
  game.camOrbit = game.camOrbit || 0;
  game.camOrbit -= dx * 0.005;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  game.camDist = Math.max(5, Math.min(18, game.camDist + Math.sign(e.deltaY)));
}, { passive: false });

// --- Frame loop ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    game.update(dt);
  } catch (err) {
    console.error('[Teluk Senja] frame error:', err);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- Screenshot poses: ?shot=cover|drive|chase|harbor ---
// The screenshot run loads the page with one of these and waits for
// window.__shotReady before capturing, so every shot is a real render.
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  window.__shotReady = false;
  const settle = () => {
    game.applyShot(shot);
    // Let a few frames render (sky, traffic, markers) before the capture.
    setTimeout(() => { window.__shotReady = true; }, 1200);
  };
  // Wait for the first frames so three.js has compiled everything.
  setTimeout(settle, 400);
}

window.addEventListener('error', (e) => {
  console.error('[Teluk Senja] uncaught:', e.message);
});

// Hoofdmodule: scene, camera, game-loop en match-verloop.

import * as THREE from 'three';
import { MATCH_TIME, rand, lerp, clamp } from './util.js';
import { itemBoxSpots } from './world.js';
import { MAPS, buildMap } from './maps.js';
import { initEffects, updateEffects, shake } from './effects.js';
import { Kart, collideKarts, setKartFace, MAX_SPEED } from './kart.js';
import { ItemManager } from './items.js';
import { BotBrain, makeBotRoster } from './bots.js';
import { initInput, updateInput, input } from './input.js';
import * as hud from './hud.js';
import { sfx, unlockAudio, setMuted, isMuted, updateEngine } from './audio.js';

const BOT_COUNT = 7;
const KART_COLORS = [
  0x3b7ddd, 0xe8564f, 0x53c26a, 0xf7b32b,
  0x9a5ce0, 0x38c2c8, 0xf06fa8, 0x8a939e,
];

// ---------- renderer & scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

initEffects(scene);
initInput();
hud.initHud();

// ---------- game-state ----------
const state = {
  running: false,
  countdown: 0,
  timeLeft: MATCH_TIME,
  karts: [],
  brains: [],
  me: null,
  gameTime: 0,
  mapId: localStorage.getItem('sk_map') || 'office',
  builtMapId: null,
};
if (!MAPS[state.mapId]) state.mapId = 'office';

// startscherm toont alvast de gekozen map
let mapCfg = buildMap(scene, state.mapId);
state.builtMapId = state.mapId;

const items = new ItemManager(scene, {
  onKill(victim, killer, weaponType) {
    hud.addKillFeed(victim, killer, weaponType);
    if (victim === state.me) hud.announce('Uitgeschakeld! \u{1F4A5}', 1600);
    if (killer === state.me) hud.announce('+1 kill! \u{1F525}', 1100);
  },
  onPickup(kart) {
    if (kart === state.me) hud.updateItemIcon(kart);
  },
});
items.setBoxes(itemBoxSpots, mapCfg.boxStyle);

function setupMatch(playerName) {
  // oude karts opruimen
  for (const k of state.karts) scene.remove(k.mesh);
  state.karts = [];
  state.brains = [];

  // gekozen map (her)bouwen
  if (state.builtMapId !== state.mapId) {
    mapCfg = buildMap(scene, state.mapId);
    state.builtMapId = state.mapId;
  }
  items.setBoxes(itemBoxSpots, mapCfg.boxStyle);
  items.reset();

  const me = new Kart(scene, { name: playerName, color: KART_COLORS[0], isBot: false });
  state.me = me;
  state.karts.push(me);

  const names = makeBotRoster(BOT_COUNT);
  names.forEach((name, i) => {
    const bot = new Kart(scene, { name, color: KART_COLORS[(i + 1) % KART_COLORS.length], isBot: true });
    state.karts.push(bot);
    state.brains.push(new BotBrain(bot));
  });

  for (const k of state.karts) k.spawn(state.karts, state.gameTime);

  state.timeLeft = MATCH_TIME;
  state.countdown = 3.5;
  // spawn-bescherming pas laten aflopen ná de countdown
  for (const k of state.karts) k.invulnUntil = state.gameTime + state.countdown + 2.5;
  state.running = true;
  hud.updateItemIcon(me);
  hud.updateHealth(me);
}

function endMatch() {
  state.running = false;
  const sorted = hud.updateLeaderboard(state.karts, state.me);
  hud.showEnd(sorted, state.me);
}

// ---------- camera ----------
const camPos = new THREE.Vector3(0, 30, 40);
const camLook = new THREE.Vector3();

function updateCamera(dt) {
  const me = state.me;
  if (state.running && me) {
    const fwd = me.forward();
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const targetPos = new THREE.Vector3(
      me.pos.x - fwd.x * 7.6,
      me.pos.y + 4.4,
      me.pos.z - fwd.z * 7.6
    );
    const t = 1 - Math.exp(-6 * dt);
    camPos.lerp(targetPos, t);
    // kijkpunt schuift de bocht in (steer + is naar -side)
    const lookAside = -me.steer * 1.4;
    camLook.lerp(
      new THREE.Vector3(
        me.pos.x + fwd.x * 3 + side.x * lookAside,
        me.pos.y + 1.4,
        me.pos.z + fwd.z * 3 + side.z * lookAside
      ),
      Math.min(1, t * 1.4)
    );
    // FOV rekt mee met snelheid voor extra vaart-gevoel
    const targetFov = 60 + 13 * clamp(me.speed / MAX_SPEED, 0, 1);
    camera.fov = lerp(camera.fov, targetFov, Math.min(1, 5 * dt));
    camera.updateProjectionMatrix();
  } else {
    // idle: langzaam om de arena heen draaien (startscherm / einde)
    const a = performance.now() * 0.00012;
    camPos.lerp(new THREE.Vector3(Math.sin(a) * 55, 26, Math.cos(a) * 55), 0.05);
    camLook.lerp(new THREE.Vector3(0, 2, 0), 0.05);
    camera.fov = lerp(camera.fov, 62, Math.min(1, 5 * dt));
    camera.updateProjectionMatrix();
  }

  camera.position.copy(camPos);
  if (shake.t > 0) {
    const s = shake.power * shake.t;
    camera.position.x += rand(-s, s);
    camera.position.y += rand(-s, s);
    camera.position.z += rand(-s, s);
  }
  camera.lookAt(camLook);
}

// ---------- HUD-timers ----------
let fpsFrames = 0, fpsTime = 0;
let lbTimer = 0;
let lastCountdownWhole = 4;

// ---------- game-loop ----------
let lastT = performance.now();

function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (nowMs - lastT) / 1000);
  lastT = nowMs;
  state.gameTime += dt;
  const now = state.gameTime;

  // fps-teller
  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    hud.updateFps(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
  }

  if (state.running) {
    // aftellen bij start
    let controlsLocked = false;
    if (state.countdown > 0) {
      state.countdown -= dt;
      controlsLocked = true;
      const whole = Math.ceil(state.countdown);
      if (whole !== lastCountdownWhole && whole > 0) {
        hud.announce(String(whole), 700);
        sfx.countdown();
        lastCountdownWhole = whole;
      }
      if (state.countdown <= 0) {
        hud.announce('GO!', 800);
        sfx.go();
        lastCountdownWhole = 4;
      }
    } else {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        endMatch();
      }
    }

    // speler-input
    updateInput();
    const me = state.me;
    if (!me.dead && !controlsLocked) {
      me.ctrl.steer = input.steer;
      me.ctrl.throttle = input.throttle;
      if (input.fire) items.fire(me, state.karts, now) && hud.updateItemIcon(me);
    } else {
      me.ctrl.steer = 0; me.ctrl.throttle = 0;
    }

    // bots
    if (!controlsLocked) {
      for (const brain of state.brains) {
        brain.update(dt, now, state.karts, items);
        const bk = brain.kart;
        if (bk.ctrl.fire) items.fire(bk, state.karts, now);
      }
    }

    // physics
    for (const k of state.karts) {
      if (k.dead && now >= k.respawnAt) {
        k.spawn(state.karts, now);
        if (k === me) hud.updateItemIcon(me);
      }
      k.update(dt, now);
    }
    collideKarts(state.karts);
    items.update(dt, now, state.karts);

    // HUD
    hud.updateHealth(me);
    hud.updateTimer(state.timeLeft);
    lbTimer -= dt;
    if (lbTimer <= 0) {
      lbTimer = 0.3;
      hud.updateLeaderboard(state.karts, me);
      hud.updateItemIcon(me);
    }
  }

  // motorgeluid volgt de snelheid van de speler
  updateEngine(
    state.running && state.me && !state.me.dead
      ? clamp(Math.abs(state.me.speed) / MAX_SPEED, 0, 1)
      : 0
  );

  updateEffects(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// ---------- UI-koppelingen ----------
const nameInput = document.getElementById('nameinput');
nameInput.value = localStorage.getItem('sk_name') || '';

document.getElementById('startbtn').addEventListener('click', () => {
  unlockAudio();
  const name = (nameInput.value.trim() || 'Speler').slice(0, 14);
  localStorage.setItem('sk_name', name);
  hud.hideOverlay();
  setupMatch(name);
});

document.getElementById('restartbtn').addEventListener('click', () => {
  unlockAudio();
  hud.hideOverlay();
  setupMatch(state.me ? state.me.name : 'Speler');
});

document.getElementById('menubtn').addEventListener('click', () => {
  document.getElementById('endpanel').classList.add('hidden');
  document.getElementById('startpanel').classList.remove('hidden');
});

// map-keuze in het startscherm
for (const btn of document.querySelectorAll('.mapbtn')) {
  if (btn.dataset.map === state.mapId) btn.classList.add('selected');
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mapbtn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.mapId = btn.dataset.map;
    localStorage.setItem('sk_map', state.mapId);
    // meteen tonen op de achtergrond van het startscherm
    if (state.builtMapId !== state.mapId) {
      mapCfg = buildMap(scene, state.mapId);
      state.builtMapId = state.mapId;
      items.setBoxes(itemBoxSpots, mapCfg.boxStyle);
    }
  });
}

// ---------- koppel-API voor het hoofdspel ----------
// Het omliggende spel kan hiermee per speler een gezichtsfoto inladen.
// Bronnen: url-string, HTMLImageElement of Canvas.
window.KartGame = {
  setPlayerFace(source) {
    if (state.me) setKartFace(state.me, source);
  },
  setFaceByName(name, source) {
    const k = state.karts.find((q) => q.name === name);
    if (k) setKartFace(k, source);
  },
  listDrivers() {
    return state.karts.map((k) => ({ name: k.name, isBot: k.isBot }));
  },
};

document.getElementById('mute').addEventListener('click', (e) => {
  setMuted(!isMuted());
  e.target.textContent = isMuted() ? '\u{1F507}' : '\u{1F50A}';
});

// Keyboard + touch input. Op touch-apparaten rijdt de kart automatisch vooruit;
// de joystick links stuurt (x) en remt/achteruit (y omlaag), de grote knop
// rechts vuurt het huidige item af.

import { clamp } from './util.js';
import { unlockAudio } from './audio.js';

export const input = {
  steer: 0,      // -1 .. 1
  throttle: 0,   // -1 .. 1
  fire: false,
  touchMode: false,
};

const keys = new Set();

export function initInput() {
  input.touchMode = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (input.touchMode) document.body.classList.add('touchmode');

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  setupJoystick();
  setupFireButton();
}

function readKeyboard() {
  let steer = 0, throttle = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) steer -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) steer += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) throttle += 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) throttle -= 1;
  return { steer, throttle, fire: keys.has('Space') };
}

// -------- floating joystick --------
// De hele linkerhelft van het scherm is stuurzone; de joystick springt naar de
// plek waar je hem aanraakt, zodat je nooit "mis" grijpt.
const joy = { active: false, id: null, x: 0, y: 0, cx: 0, cy: 0 };
const JOY_RADIUS = 52;

function setupJoystick() {
  const zone = document.getElementById('joyzone');
  const el = document.getElementById('joystick');
  const knob = document.getElementById('joyknob');
  if (!zone || !el) return;

  el.classList.add('idle');

  const setKnob = () => {
    knob.style.transform =
      `translate(calc(-50% + ${joy.x * 36}px), calc(-50% + ${joy.y * 36}px))`;
  };

  const update = (e) => {
    let dx = (e.clientX - joy.cx) / JOY_RADIUS;
    let dy = (e.clientY - joy.cy) / JOY_RADIUS;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    joy.x = dx; joy.y = dy;
    setKnob();
  };

  zone.addEventListener('pointerdown', (e) => {
    unlockAudio();
    joy.active = true; joy.id = e.pointerId;
    joy.cx = e.clientX; joy.cy = e.clientY;
    // basis verplaatsen naar de aanraakplek
    el.style.left = `${e.clientX - 64}px`;
    el.style.top = `${e.clientY - 64}px`;
    el.style.bottom = 'auto';
    el.classList.remove('idle');
    try { zone.setPointerCapture(e.pointerId); } catch { /* geen actieve pointer */ }
    update(e);
    e.preventDefault();
  });
  zone.addEventListener('pointermove', (e) => {
    if (joy.active && e.pointerId === joy.id) update(e);
  });
  const end = (e) => {
    if (e.pointerId !== joy.id) return;
    joy.active = false; joy.id = null; joy.x = 0; joy.y = 0;
    setKnob();
    // terug naar de rustplek linksonder
    el.style.left = ''; el.style.top = ''; el.style.bottom = '';
    el.classList.add('idle');
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
}

// -------- vuurknop --------
let firePressed = false;

function setupFireButton() {
  const el = document.getElementById('firebtn');
  if (!el) return;
  el.addEventListener('pointerdown', (e) => {
    unlockAudio();
    firePressed = true;
    try { el.setPointerCapture(e.pointerId); } catch { /* geen actieve pointer */ }
    e.preventDefault();
  });
  const end = () => { firePressed = false; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Wordt elke frame aangeroepen; combineert keyboard en touch.
export function updateInput() {
  const kb = readKeyboard();
  let steer = kb.steer;
  let throttle = kb.throttle;
  let fire = kb.fire || firePressed;

  if (input.touchMode) {
    if (joy.active) {
      // progressieve stuurcurve: fijn rond het midden, vol aan de rand
      const jx = Math.abs(joy.x) < 0.08 ? 0
        : Math.sign(joy.x) * Math.pow(Math.abs(joy.x), 1.4);
      steer += jx;
      // omlaag duwen = remmen/achteruit, anders automatisch gas
      throttle += joy.y > 0.45 ? -1 : 1;
    } else if (!kb.throttle && !kb.steer) {
      throttle += 1; // auto-gas op mobiel
    }
  }

  input.steer = clamp(steer, -1, 1);
  input.throttle = clamp(throttle, -1, 1);
  input.fire = fire;
}

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

// -------- joystick --------
const joy = { active: false, id: null, x: 0, y: 0 };

function setupJoystick() {
  const el = document.getElementById('joystick');
  const knob = document.getElementById('joyknob');
  if (!el) return;

  const setKnob = () => {
    knob.style.transform =
      `translate(calc(-50% + ${joy.x * 36}px), calc(-50% + ${joy.y * 36}px))`;
  };

  const update = (e) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2);
    let dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    joy.x = dx; joy.y = dy;
    setKnob();
  };

  el.addEventListener('pointerdown', (e) => {
    unlockAudio();
    joy.active = true; joy.id = e.pointerId;
    el.setPointerCapture(e.pointerId);
    update(e);
  });
  el.addEventListener('pointermove', (e) => {
    if (joy.active && e.pointerId === joy.id) update(e);
  });
  const end = (e) => {
    if (e.pointerId !== joy.id) return;
    joy.active = false; joy.id = null; joy.x = 0; joy.y = 0;
    setKnob();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// -------- vuurknop --------
let firePressed = false;

function setupFireButton() {
  const el = document.getElementById('firebtn');
  if (!el) return;
  el.addEventListener('pointerdown', (e) => {
    unlockAudio();
    firePressed = true;
    el.setPointerCapture(e.pointerId);
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
      steer += joy.x;
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

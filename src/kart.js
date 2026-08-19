// Kart: mesh-opbouw, arcade-rijfysica, schade, dood & respawn.

import * as THREE from 'three';
import {
  KART_RADIUS, MAX_HP, clamp, lerp, angleDiff, rand, pick, dist2D,
} from './util.js';
import { groundHeightAt, resolveCircle, spawnPoints } from './world.js';
import { puff } from './effects.js';

const ACCEL = 30;
const BRAKE = 34;
const FRICTION = 10;
export const MAX_SPEED = 22;
const MAX_REVERSE = -8;
const TURN_RATE_LOW = 3.0;   // draaisnelheid bij lage snelheid
const TURN_RATE_HIGH = 1.85; // bij topsnelheid: ruimere bochten
const GRIP_NORMAL = 10;      // demping van zijwaartse slip
const GRIP_DRIFT = 4.6;      // bij hard insturen op snelheid: drift
const GRAVITY = 28;

function makeLabel(name) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = 'bold 34px "Trebuchet MS", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(240, g.measureText(name).width + 30);
  g.fillStyle = 'rgba(20, 60, 120, 0.65)';
  g.beginPath();
  g.roundRect(128 - w / 2, 8, w, 48, 14);
  g.fill();
  g.fillStyle = '#fff';
  g.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set(3.4, 0.85, 1);
  sp.position.y = 2.6;
  return sp;
}

// ---------- gezichten ----------
// Elke bestuurder is een platte ronde disc met een gezichtstexture. Standaard
// tekenen we zelf een gezichtje; via setKartFace() kan een externe afbeelding
// (bijv. een foto per speler vanuit het hoofdspel) worden ingeladen.

const FACE_SIZE = 256;

function drawFaceRing(g, color) {
  // rand in de kartkleur
  g.strokeStyle = color;
  g.lineWidth = 18;
  g.beginPath();
  g.arc(FACE_SIZE / 2, FACE_SIZE / 2, FACE_SIZE / 2 - 10, 0, Math.PI * 2);
  g.stroke();
}

function defaultFaceTexture(colorHex) {
  const color = '#' + colorHex.toString(16).padStart(6, '0');
  const cv = document.createElement('canvas');
  cv.width = cv.height = FACE_SIZE;
  const g = cv.getContext('2d');
  const c = FACE_SIZE / 2;
  // gezicht
  g.beginPath();
  g.arc(c, c, c - 12, 0, Math.PI * 2);
  g.fillStyle = '#f7cf9f';
  g.fill();
  // ogen
  g.fillStyle = '#2b2b33';
  for (const ox of [-42, 42]) {
    g.beginPath();
    g.ellipse(c + ox, c - 22, 15, 21, 0, 0, Math.PI * 2);
    g.fill();
  }
  // glimmertjes in de ogen
  g.fillStyle = '#fff';
  for (const ox of [-36, 48]) {
    g.beginPath();
    g.arc(c + ox, c - 30, 6, 0, Math.PI * 2);
    g.fill();
  }
  // mond
  g.strokeStyle = '#8a4a2a';
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(c, c + 26, 38, 0.25 * Math.PI, 0.75 * Math.PI);
  g.stroke();
  // blosjes
  g.fillStyle = 'rgba(240, 130, 130, .5)';
  for (const ox of [-62, 62]) {
    g.beginPath();
    g.arc(c + ox, c + 18, 14, 0, Math.PI * 2);
    g.fill();
  }
  drawFaceRing(g, color);
  return new THREE.CanvasTexture(cv);
}

// Laadt een afbeelding (url, HTMLImageElement of Canvas) als gezicht van een
// kart: rond uitgesneden, met een rand in de kartkleur.
export function setKartFace(kart, source) {
  const apply = (img) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = FACE_SIZE;
    const g = cv.getContext('2d');
    const c = FACE_SIZE / 2;
    g.save();
    g.beginPath();
    g.arc(c, c, c - 12, 0, Math.PI * 2);
    g.clip();
    // cover-fit: kortste zijde vult de cirkel
    const s = Math.max(FACE_SIZE / img.width, FACE_SIZE / img.height);
    const w = img.width * s, h = img.height * s;
    g.drawImage(img, c - w / 2, c - h / 2, w, h);
    g.restore();
    drawFaceRing(g, '#' + kart.color.toString(16).padStart(6, '0'));
    const tex = new THREE.CanvasTexture(cv);
    const old = kart.faceSprite.material.map;
    kart.faceSprite.material.map = tex;
    kart.faceSprite.material.needsUpdate = true;
    if (old) old.dispose();
  };
  if (typeof source === 'string') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => apply(img);
    img.src = source;
  } else {
    apply(source);
  }
}

function buildKartMesh(color, showLabel, name) {
  const grp = new THREE.Group();
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });

  // chassis
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2.2), lam(color));
  body.position.y = 0.55;
  grp.add(body);

  // neus + spoiler
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.5), lam(color));
  nose.position.set(0, 0.5, -1.25);
  grp.add(nose);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.45), lam(0x333a4a));
  spoiler.position.set(0, 1.05, 1.15);
  grp.add(spoiler);

  // stoel/rugleuning
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.25), lam(0x333a4a));
  seat.position.set(0, 1.0, 0.55);
  grp.add(seat);

  // bestuurder: romp + platte ronde gezichts-disc (altijd naar de camera)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.45), lam(color));
  torso.position.set(0, 1.05, 0.3);
  grp.add(torso);
  const faceSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: defaultFaceTexture(color),
  }));
  faceSprite.scale.set(1.25, 1.25, 1);
  faceSprite.position.set(0, 1.75, 0.3);
  grp.add(faceSprite);

  // wielen
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  const wheelMat = lam(0x23262e);
  const wheels = [];
  for (const [wx, wz] of [[-0.85, -0.75], [0.85, -0.75], [-0.85, 0.85], [0.85, 0.85]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    grp.add(w);
    wheels.push(w);
  }

  // blob-schaduw
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  grp.add(shadow);

  // schild-bubbel (zichtbaar bij invulnerability door schild-item)
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(1.9, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.28 })
  );
  bubble.position.y = 1;
  bubble.visible = false;
  grp.add(bubble);

  let label = null;
  if (showLabel) {
    label = makeLabel(name);
    label.position.y = 2.9;
    grp.add(label);
  }
  return { grp, wheels, shadow, bubble, body, faceSprite };
}

let nextId = 1;

export class Kart {
  constructor(scene, { name, color, isBot }) {
    this.id = nextId++;
    this.name = name;
    this.color = color;
    this.isBot = isBot;

    const { grp, wheels, shadow, bubble, faceSprite } = buildKartMesh(color, isBot, name);
    this.mesh = grp;
    this.wheels = wheels;
    this.shadow = shadow;
    this.bubble = bubble;
    this.faceSprite = faceSprite;
    scene.add(grp);

    this.pos = new THREE.Vector3();
    this.heading = 0;        // yaw; forward = (sin, 0, cos)
    this.vel = new THREE.Vector3();  // horizontale snelheid in wereldruimte
    this.speed = 0;          // voorwaartse component van vel (voor bots/visuals)
    this.steer = 0;          // gladgestreken stuurinput
    this.drifting = false;
    this.vy = 0;
    this.airborne = false;
    this.knock = new THREE.Vector3();

    this.hp = MAX_HP;
    this.score = 0;
    this.deaths = 0;
    this.dead = false;
    this.respawnAt = 0;
    this.invulnUntil = 0;
    this.shieldUntil = 0;

    this.weapon = null;      // { type: 'gun'|'rocket'|'mine'|'shield', ammo }
    this.fireCooldown = 0;

    this.dustTimer = 0;

    // input van speler of bot: {steer, throttle, fire}
    this.ctrl = { steer: 0, throttle: 0, fire: false };
  }

  forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  isInvulnerable(now) {
    return now < this.invulnUntil || now < this.shieldUntil;
  }

  spawn(karts, now) {
    // kies spawnpunt zo ver mogelijk bij vijanden vandaan
    let best = pick(spawnPoints), bestScore = -1;
    for (const s of spawnPoints) {
      let minD = 1e9;
      for (const k of karts) {
        if (k === this || k.dead) continue;
        minD = Math.min(minD, dist2D(s.x, s.z, k.pos.x, k.pos.z));
      }
      if (minD > bestScore) { bestScore = minD; best = s; }
    }
    this.pos.set(best.x + rand(-2, 2), 0, best.z + rand(-2, 2));
    this.heading = Math.atan2(-this.pos.x, -this.pos.z); // kijk naar het midden
    this.speed = 0; this.vy = 0; this.steer = 0;
    this.vel.set(0, 0, 0);
    this.knock.set(0, 0, 0);
    this.hp = MAX_HP;
    this.dead = false;
    this.weapon = null;
    this.invulnUntil = now + 2.5;
    this.mesh.visible = true;
  }

  update(dt, now) {
    if (this.dead) return;

    const c = this.ctrl;

    // --- stuurinput gladstrijken (geen binair geschok bij toetsenbord) ---
    this.steer = lerp(this.steer, c.steer, Math.min(1, 9 * dt));

    // --- sturen: draaicirkel schaalt met snelheid, omgekeerd bij achteruit ---
    const spFactor = clamp(Math.abs(this.speed) / 7, 0, 1);
    const spNorm = clamp(Math.abs(this.speed) / MAX_SPEED, 0, 1);
    const turnRate = lerp(TURN_RATE_LOW, TURN_RATE_HIGH, spNorm);
    const dir = this.speed >= 0 ? 1 : -1;
    const airFactor = this.airborne ? 0.25 : 1; // beetje luchtcontrole
    this.heading -= this.steer * turnRate * spFactor * dir * airFactor * dt;

    // --- snelheid ontbinden in voorwaarts + zijwaarts (slip) ---
    const fwd = this.forward();
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    let vF = this.vel.x * fwd.x + this.vel.z * fwd.z;
    let vS = this.vel.x * side.x + this.vel.z * side.z;

    // --- motor & rem werken op de voorwaartse component ---
    const shieldBoost = now < this.shieldUntil ? 1.18 : 1;
    const maxSp = MAX_SPEED * shieldBoost;
    if (!this.airborne) {
      if (c.throttle > 0) {
        // pittige start, aflopend richting topsnelheid
        const headroom = 1 - clamp(Math.max(0, vF) / maxSp, 0, 1);
        vF += ACCEL * c.throttle * (0.35 + 0.65 * headroom) * dt;
      } else if (c.throttle < 0) {
        vF += (vF > 0 ? -BRAKE : ACCEL * c.throttle) * dt;
      } else {
        const f = FRICTION * dt;
        if (Math.abs(vF) <= f) vF = 0;
        else vF -= Math.sign(vF) * f;
      }
    }
    vF = clamp(vF, MAX_REVERSE, maxSp);

    // --- grip: zijwaartse slip wegdempen, minder bij drift/in de lucht ---
    const wantsDrift = Math.abs(this.steer) > 0.5 && vF > 13;
    const grip = this.airborne ? 0.4 : (wantsDrift ? GRIP_DRIFT : GRIP_NORMAL);
    vS *= Math.exp(-grip * dt);
    this.drifting = !this.airborne && Math.abs(vS) > 2.5;

    this.vel.set(fwd.x * vF + side.x * vS, 0, fwd.z * vF + side.z * vS);
    this.speed = vF;

    // --- beweging ---
    const prevX = this.pos.x, prevZ = this.pos.z;
    const nx = prevX + (this.vel.x + this.knock.x) * dt;
    const nz = prevZ + (this.vel.z + this.knock.z) * dt;
    const intended = Math.hypot(nx - prevX, nz - prevZ);

    this.pos.x = nx; this.pos.z = nz;
    const hitWall = resolveCircle(this.pos, KART_RADIUS, this.pos.y);
    if (hitWall) {
      // schampen kost weinig snelheid, frontaal knallen veel
      const actual = Math.hypot(this.pos.x - prevX, this.pos.z - prevZ);
      const keep = intended > 0.0001 ? clamp(actual / intended, 0, 1) : 0;
      const damp = 0.35 + 0.6 * keep;
      this.vel.multiplyScalar(damp);
      this.speed *= damp;
      this.knock.multiplyScalar(0.4);
    }

    // knockback dempen
    this.knock.multiplyScalar(Math.max(0, 1 - 3.2 * dt));

    // --- hoogte / zwaartekracht ---
    const gh = groundHeightAt(this.pos.x, this.pos.z);
    if (this.pos.y <= gh + 0.05) {
      // op de grond (of helling): volg het terrein
      if (gh - this.pos.y > 0.001) {
        this.pos.y = Math.min(gh, this.pos.y + 12 * dt); // vloeiend omhoog op hellingen
      } else {
        this.pos.y = gh;
      }
      // lanceersnelheid meenemen als de grond wegvalt
      this.vy = 0;
      this.airborne = false;
    } else {
      this.airborne = true;
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gh) {
        this.pos.y = gh;
        this.vy = 0;
        this.airborne = false;
        puff(this.pos.x, this.pos.y + 0.2, this.pos.z, 0xf6e6d0);
      }
    }
    // van een helling af springen: kleine opwaartse impuls
    if (!this.airborne) {
      const ahead = groundHeightAt(
        this.pos.x + fwd.x * 0.9, this.pos.z + fwd.z * 0.9
      );
      if (ahead < this.pos.y - 0.8 && this.speed > 12) {
        this.vy = 4.5;
        this.airborne = true;
      }
    }

    // --- visuals ---
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    // kart kantelt in bochten, extra bij drift
    const tilt = -this.steer * spFactor * (this.drifting ? 0.2 : 0.12);
    this.mesh.rotation.z = lerp(this.mesh.rotation.z, tilt, 10 * dt);
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 2.2;

    // blob-schaduw op de grond houden
    this.shadow.position.y = gh - this.pos.y + 0.03;
    const airH = this.pos.y - gh;
    this.shadow.material.opacity = Math.max(0.06, 0.22 - airH * 0.03);

    // schild-bubbel
    this.bubble.visible = now < this.shieldUntil;

    // spawn-bescherming knippert
    if (now < this.invulnUntil) {
      this.mesh.visible = Math.floor(now * 8) % 2 === 0;
    } else if (!this.dead) {
      this.mesh.visible = true;
    }

    // stofwolkjes bij drift of scherpe bochten op snelheid
    this.dustTimer -= dt;
    const kickingUpDust = this.drifting ||
      (Math.abs(this.steer) > 0.55 && Math.abs(this.speed) > 12);
    if (!this.airborne && kickingUpDust && this.dustTimer <= 0) {
      this.dustTimer = this.drifting ? 0.03 : 0.05;
      const side = fwd.clone().cross(new THREE.Vector3(0, 1, 0));
      puff(
        this.pos.x - fwd.x * 1 + side.x * rand(-0.6, 0.6),
        this.pos.y + 0.2,
        this.pos.z - fwd.z * 1 + side.z * rand(-0.6, 0.6)
      );
    }

    if (this.fireCooldown > 0) this.fireCooldown -= dt;
  }
}

// kart-vs-kart botsingen (cirkels, elastische duw)
export function collideKarts(karts) {
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i], b = karts[j];
      if (a.dead || b.dead) continue;
      if (Math.abs(a.pos.y - b.pos.y) > 1.4) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      const minD = KART_RADIUS * 2;
      if (d < minD && d > 0.0001) {
        const nx = dx / d, nz = dz / d;
        const push = (minD - d) / 2 + 0.02;
        a.pos.x -= nx * push; a.pos.z -= nz * push;
        b.pos.x += nx * push; b.pos.z += nz * push;
        // impuls uitwisselen
        const rel = a.speed - b.speed;
        a.knock.x -= nx * Math.abs(rel) * 0.4; a.knock.z -= nz * Math.abs(rel) * 0.4;
        b.knock.x += nx * Math.abs(rel) * 0.4; b.knock.z += nz * Math.abs(rel) * 0.4;
        a.vel.multiplyScalar(0.85); b.vel.multiplyScalar(0.85);
      }
    }
  }
}

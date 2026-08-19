// Bouwt de kleurrijke low-poly arena en levert botsings- en hoogtefuncties.

import * as THREE from 'three';
import { ARENA_HALF, KART_RADIUS } from './util.js';

// Blokken waar je niet doorheen kunt (muren, decor).
// {x, z, w, d, h, color}  — as-uitgelijnde boxen.
export const obstacles = [];

// Plateaus waar je bovenop kunt rijden. {x, z, w, d, h, color}
export const platforms = [];

// Hellingen omhoog naar hoogte h. dir: 0=+z, 1=+x, 2=-z, 3=-x (rijrichting omhoog)
// {x, z, w, len, h, dir}
export const ramps = [];

export const spawnPoints = [
  { x: -44, z: -44 }, { x: 44, z: -44 }, { x: -44, z: 44 }, { x: 44, z: 44 },
  { x: 0, z: -48 }, { x: 0, z: 48 }, { x: -48, z: 0 }, { x: 48, z: 0 },
];

export const itemBoxSpots = [
  { x: 0, z: -20 }, { x: 0, z: 20 }, { x: -20, z: 0 }, { x: 20, z: 0 },
  { x: -36, z: -36 }, { x: 36, z: -36 }, { x: -36, z: 36 }, { x: 36, z: 36 },
  { x: 0, z: 0 },                       // midden op het plateau
  { x: -14, z: -38 }, { x: 14, z: 38 },
  { x: -44, z: 12 }, { x: 44, z: -12 },
];

const mat = (color) => new THREE.MeshLambertMaterial({ color });

function addBox(scene, list, x, z, w, d, h, color, yBase = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, yBase + h / 2, z);
  scene.add(m);
  if (list) list.push({ x, z, w, d, h, color });
  return m;
}

function addRamp(scene, x, z, w, len, h, dir, color) {
  // wig-geometrie: loopt op van 0 naar h in +z-richting, daarna gedraaid
  const geo = new THREE.BufferGeometry();
  const hw = w / 2, hl = len / 2;
  // hoekpunten (lokaal): laag aan -z, hoog aan +z
  const v = [
    // bovenvlak (helling)
    -hw, 0, -hl,   hw, 0, -hl,   hw, h, hl,
    -hw, 0, -hl,   hw, h, hl,   -hw, h, hl,
    // zijkant links
    -hw, 0, -hl,  -hw, h, hl,  -hw, 0, hl,
    // zijkant rechts
    hw, 0, -hl,   hw, 0, hl,   hw, h, hl,
    // achterkant (hoog)
    -hw, 0, hl,   -hw, h, hl,   hw, h, hl,
    -hw, 0, hl,    hw, h, hl,   hw, 0, hl,
  ];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, 0.01, z);
  m.rotation.y = -dir * Math.PI / 2;
  scene.add(m);
  ramps.push({ x, z, w, len, h, dir });
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x8fd3f4);
  scene.fog = new THREE.Fog(0x8fd3f4, 90, 190);

  // licht
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(40, 70, 25);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe8ff, 0xffc9e0, 0.5));

  // grondvlak (pastel roze zoals in de gifjes)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF * 2 + 40, ARENA_HALF * 2 + 40),
    mat(0xf2a7c3)
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // gekleurde vlakken op de grond voor variatie
  const patch = (x, z, w, d, color) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color));
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.02, z);
    scene.add(p);
  };
  patch(-30, -30, 40, 40, 0x9be07a);   // gras-groen
  patch(32, 28, 44, 40, 0x66c6f0);     // blauw
  patch(30, -32, 36, 36, 0xf7d154);    // geel
  patch(-32, 32, 36, 36, 0xc48ae8);    // paars

  // buitenmuren
  const wallC = 0x3f6fd8;
  addBox(scene, obstacles, 0, -(ARENA_HALF + 2), ARENA_HALF * 2 + 8, 4, 5, wallC);
  addBox(scene, obstacles, 0, ARENA_HALF + 2, ARENA_HALF * 2 + 8, 4, 5, wallC);
  addBox(scene, obstacles, -(ARENA_HALF + 2), 0, 4, ARENA_HALF * 2 + 8, 5, wallC);
  addBox(scene, obstacles, ARENA_HALF + 2, 0, 4, ARENA_HALF * 2 + 8, 5, wallC);

  // kantelen-decor bovenop de muren
  for (let i = -5; i <= 5; i++) {
    addBox(scene, null, i * 10, -(ARENA_HALF + 2), 4, 4.6, 2, 0x5b8bef, 5);
    addBox(scene, null, i * 10, ARENA_HALF + 2, 4, 4.6, 2, 0x5b8bef, 5);
    addBox(scene, null, -(ARENA_HALF + 2), i * 10, 4.6, 4, 2, 0x5b8bef, 5);
    addBox(scene, null, ARENA_HALF + 2, i * 10, 4.6, 4, 2, 0x5b8bef, 5);
  }

  // centraal plateau met vier oprij-hellingen
  platforms.push({ x: 0, z: 0, w: 16, d: 16, h: 3 });
  addBox(scene, null, 0, 0, 16, 16, 3, 0xf08c4a);
  addRamp(scene, 0, -13, 8, 10, 3, 0, 0xff9f5e);   // vanaf -z omhoog
  addRamp(scene, 0, 13, 8, 10, 3, 2, 0xff9f5e);    // vanaf +z omhoog
  addRamp(scene, -13, 0, 8, 10, 3, 1, 0xff9f5e);   // vanaf -x omhoog
  addRamp(scene, 13, 0, 8, 10, 3, 3, 0xff9f5e);    // vanaf +x omhoog

  // losse obstakels / dekking
  addBox(scene, obstacles, -30, -12, 10, 3, 3.4, 0xe8564f);
  addBox(scene, obstacles, 30, 12, 10, 3, 3.4, 0xe8564f);
  addBox(scene, obstacles, -12, 30, 3, 10, 3.4, 0x53b7e8);
  addBox(scene, obstacles, 12, -30, 3, 10, 3.4, 0x53b7e8);
  addBox(scene, obstacles, -38, 20, 7, 7, 4.5, 0x8e5ce0);
  addBox(scene, obstacles, 38, -20, 7, 7, 4.5, 0x8e5ce0);
  addBox(scene, obstacles, -20, -40, 12, 4, 2.6, 0xf7b32b);
  addBox(scene, obstacles, 20, 40, 12, 4, 2.6, 0xf7b32b);

  // springschansen langs de randen (los, zonder plateau: je vliegt eraf)
  addRamp(scene, -46, -20, 7, 9, 2.4, 2, 0x7ddba3);
  addRamp(scene, 46, 20, 7, 9, 2.4, 0, 0x7ddba3);

  // decoratieve bomen (bol op cilinder), buiten de rijzone
  const treeSpots = [[-52, -52], [52, -52], [-52, 52], [52, 52]];
  for (const [tx, tz] of treeSpots) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 4, 8), mat(0xa86a3d));
    trunk.position.set(tx, 2, tz);
    scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 8), mat(0x63c74d));
    crown.position.set(tx, 6, tz);
    scene.add(crown);
  }
}

// ---------- hoogte & botsingen ----------

function rampHeightAt(r, x, z) {
  // transformeer naar lokale ruimte van de helling
  const dx = x - r.x, dz = z - r.z;
  let lx, lz; // lz loopt van -len/2 (laag) naar +len/2 (hoog)
  switch (r.dir) {
    case 0: lx = dx; lz = dz; break;      // omhoog richting +z
    case 1: lx = -dz; lz = dx; break;     // omhoog richting +x
    case 2: lx = -dx; lz = -dz; break;    // omhoog richting -z
    case 3: lx = dz; lz = -dx; break;     // omhoog richting -x
  }
  if (Math.abs(lx) > r.w / 2 || Math.abs(lz) > r.len / 2) return null;
  const t = (lz + r.len / 2) / r.len;
  return t * r.h;
}

export function groundHeightAt(x, z) {
  let h = 0;
  for (const p of platforms) {
    if (Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2) h = Math.max(h, p.h);
  }
  for (const r of ramps) {
    const rh = rampHeightAt(r, x, z);
    if (rh !== null) h = Math.max(h, rh);
  }
  return h;
}

// Duwt een cirkel (kart of projectiel) uit muren/obstakels.
// Retourneert true als er iets geraakt is.
export function resolveCircle(pos, radius, y = 0) {
  let hit = false;

  // arena-randen
  const lim = ARENA_HALF - radius;
  if (pos.x < -lim) { pos.x = -lim; hit = true; }
  if (pos.x > lim) { pos.x = lim; hit = true; }
  if (pos.z < -lim) { pos.z = -lim; hit = true; }
  if (pos.z > lim) { pos.z = lim; hit = true; }

  const pushOut = (b) => {
    const hw = b.w / 2 + radius, hd = b.d / 2 + radius;
    const dx = pos.x - b.x, dz = pos.z - b.z;
    if (Math.abs(dx) >= hw || Math.abs(dz) >= hd) return false;
    // duw eruit langs de as met de kleinste overlap
    const ox = hw - Math.abs(dx);
    const oz = hd - Math.abs(dz);
    if (ox < oz) pos.x = b.x + Math.sign(dx || 1) * hw;
    else pos.z = b.z + Math.sign(dz || 1) * hd;
    return true;
  };

  for (const b of obstacles) {
    if (y < b.h - 0.3 && pushOut(b)) hit = true;
  }
  // plateau-zijkanten blokkeren alleen als je er lager dan de rand tegenaan rijdt
  for (const p of platforms) {
    if (y < p.h - 0.55) {
      // niet blokkeren op plekken waar een helling toegang geeft
      const gh = groundHeightAt(pos.x, pos.z);
      if (gh - y > 0.55 && pushOut(p)) hit = true;
    }
  }
  return hit;
}

// Kijkt of een punt geblokkeerd is (voor bot-navigatie).
export function isBlocked(x, z, y = 0) {
  if (Math.abs(x) > ARENA_HALF - KART_RADIUS || Math.abs(z) > ARENA_HALF - KART_RADIUS) return true;
  for (const b of obstacles) {
    if (y < b.h - 0.3 &&
        Math.abs(x - b.x) < b.w / 2 + KART_RADIUS &&
        Math.abs(z - b.z) < b.d / 2 + KART_RADIUS) return true;
  }
  for (const p of platforms) {
    if (groundHeightAt(x, z) - y > 0.55 &&
        Math.abs(x - p.x) < p.w / 2 + KART_RADIUS &&
        Math.abs(z - p.z) < p.d / 2 + KART_RADIUS) return true;
  }
  return false;
}

// Wereld-state: botsingsdata, terreinhoogte en bouw-helpers.
// De daadwerkelijke levels staan in maps.js en vullen deze arrays.

import * as THREE from 'three';
import { KART_RADIUS } from './util.js';

// Blokken waar je niet doorheen kunt. {x, z, w, d, h}
export const obstacles = [];

// Plateaus waar je bovenop kunt rijden. {x, z, w, d, h}
export const platforms = [];

// Hellingen omhoog naar hoogte h. dir: 0=+z, 1=+x, 2=-z, 3=-x (rijrichting omhoog)
// {x, z, w, len, h, dir}
export const ramps = [];

export const spawnPoints = [];
export const itemBoxSpots = [];

// Speelveldgrenzen (halve breedte per as) — maps mogen rechthoekig zijn.
export const bounds = { hx: 58, hz: 58 };

export function resetWorldData(hx, hz) {
  obstacles.length = 0;
  platforms.length = 0;
  ramps.length = 0;
  spawnPoints.length = 0;
  itemBoxSpots.length = 0;
  bounds.hx = hx;
  bounds.hz = hz;
}

// ---------- bouw-helpers (gebruikt door maps.js) ----------

export const mat = (color) => new THREE.MeshLambertMaterial({ color });

// material mag een kleur (number) of een THREE.Material zijn
export function addBox(group, list, x, z, w, d, h, material, yBase = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    typeof material === 'number' ? mat(material) : material
  );
  m.position.set(x, yBase + h / 2, z);
  group.add(m);
  if (list) list.push({ x, z, w, d, h });
  return m;
}

export function addRamp(group, x, z, w, len, h, dir, material) {
  // wig-geometrie: loopt op van 0 naar h richting +z, daarna gedraaid
  const geo = new THREE.BufferGeometry();
  const hw = w / 2, hl = len / 2;
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
  // uv's zodat er een texture op de helling kan (zijkanten krijgen een strook)
  const uv = [
    0, 0,   1, 0,   1, 1,
    0, 0,   1, 1,   0, 1,
    0, 0,   1, 1,   1, 0,
    0, 0,   1, 0,   1, 1,
    0, 0,   0, 1,   1, 1,
    0, 0,   1, 1,   1, 0,
  ];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, typeof material === 'number' ? mat(material) : material);
  m.position.set(x, 0.01, z);
  m.rotation.y = -dir * Math.PI / 2;
  group.add(m);
  ramps.push({ x, z, w, len, h, dir });
  return m;
}

// ---------- hoogte & botsingen ----------

function rampHeightAt(r, x, z) {
  const dx = x - r.x, dz = z - r.z;
  let lx, lz; // lz loopt van -len/2 (laag) naar +len/2 (hoog)
  switch (r.dir) {
    case 0: lx = dx; lz = dz; break;
    case 1: lx = -dz; lz = dx; break;
    case 2: lx = -dx; lz = -dz; break;
    case 3: lx = dz; lz = -dx; break;
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
export function resolveCircle(pos, radius, y = 0) {
  let hit = false;

  const limX = bounds.hx - radius, limZ = bounds.hz - radius;
  if (pos.x < -limX) { pos.x = -limX; hit = true; }
  if (pos.x > limX) { pos.x = limX; hit = true; }
  if (pos.z < -limZ) { pos.z = -limZ; hit = true; }
  if (pos.z > limZ) { pos.z = limZ; hit = true; }

  const pushOut = (b) => {
    const hw = b.w / 2 + radius, hd = b.d / 2 + radius;
    const dx = pos.x - b.x, dz = pos.z - b.z;
    if (Math.abs(dx) >= hw || Math.abs(dz) >= hd) return false;
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
      const gh = groundHeightAt(pos.x, pos.z);
      if (gh - y > 0.55 && pushOut(p)) hit = true;
    }
  }
  return hit;
}

// Kijkt of een punt geblokkeerd is (voor bot-navigatie).
export function isBlocked(x, z, y = 0) {
  if (Math.abs(x) > bounds.hx - KART_RADIUS || Math.abs(z) > bounds.hz - KART_RADIUS) return true;
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

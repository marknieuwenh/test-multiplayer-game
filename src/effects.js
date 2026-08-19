// Simpel particle-systeem met gepoolde box-deeltjes, plus camera-shake.

import * as THREE from 'three';
import { rand } from './util.js';

const POOL_SIZE = 160;
const pool = [];
let scene = null;

export let shake = { t: 0, power: 0 };

export function initEffects(sc) {
  scene = sc;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < POOL_SIZE; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    m.visible = false;
    scene.add(m);
    pool.push({ mesh: m, vel: new THREE.Vector3(), life: 0, maxLife: 1, grav: 0, size: 1 });
  }
}

function spawn(x, y, z, color, size, vel, life, grav = -14) {
  const p = pool.find((q) => q.life <= 0);
  if (!p) return;
  p.mesh.visible = true;
  p.mesh.position.set(x, y, z);
  p.mesh.material.color.setHex(color);
  p.mesh.material.opacity = 1;
  p.size = size;
  p.mesh.scale.setScalar(size);
  p.mesh.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  p.vel.copy(vel);
  p.life = p.maxLife = life;
  p.grav = grav;
}

export function explosion(x, y, z, big = true) {
  const n = big ? 16 : 8;
  const colors = [0xffd23e, 0xff8c2e, 0xf0463c, 0xffffff];
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(4, big ? 14 : 9);
    spawn(
      x, y + rand(0.2, 1.2), z,
      colors[i % colors.length],
      rand(0.35, big ? 0.9 : 0.55),
      new THREE.Vector3(Math.cos(a) * sp, rand(3, 10), Math.sin(a) * sp),
      rand(0.5, 0.9)
    );
  }
  if (big) { shake.t = 0.35; shake.power = 0.5; }
}

export function sparks(x, y, z) {
  for (let i = 0; i < 5; i++) {
    const a = rand(0, Math.PI * 2);
    spawn(x, y, z, 0xfff3a0, rand(0.15, 0.3),
      new THREE.Vector3(Math.cos(a) * rand(2, 6), rand(2, 6), Math.sin(a) * rand(2, 6)),
      rand(0.25, 0.45));
  }
}

export function puff(x, y, z, color = 0xffffff) {
  spawn(x, y, z, color, rand(0.25, 0.45),
    new THREE.Vector3(rand(-1, 1), rand(0.5, 1.6), rand(-1, 1)),
    rand(0.35, 0.6), -1);
}

export function pickupBurst(x, y, z) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    spawn(x, y, z, 0x7fe3ff, 0.3,
      new THREE.Vector3(Math.cos(a) * 4, 4, Math.sin(a) * 4), 0.5, -8);
  }
}

export function updateEffects(dt) {
  for (const p of pool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    p.vel.y += p.grav * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.mesh.position.y < 0.1) { p.mesh.position.y = 0.1; p.vel.y *= -0.3; p.vel.x *= 0.7; p.vel.z *= 0.7; }
    const t = p.life / p.maxLife;
    p.mesh.material.opacity = t;
    p.mesh.scale.setScalar(p.size * (0.4 + 0.6 * t));
  }
  if (shake.t > 0) shake.t -= dt;
}

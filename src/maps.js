// De drie levels, elk met een eigen werkthema:
//   office       — racen over een lang bureaulandschap
//   warehouse    — distributiecentrum met stellingen en pallets
//   construction — bouwplaats met stenen, buizen en een steiger
// Elke map vult de world-arrays (obstacles/platforms/ramps/spawns/items).

import * as THREE from 'three';
import { rand } from './util.js';
import {
  resetWorldData, addBox, addRamp, mat,
  spawnPoints, itemBoxSpots, obstacles, platforms,
} from './world.js';

// ---------- canvas-texture helpers ----------

function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

function woodTexture(repX, repY) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c99a63';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(140, 92, 45, ${rand(0.12, 0.3)})`;
      g.lineWidth = rand(1, 4);
      const y = rand(0, h);
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + rand(-9, 9), w * 0.7, y + rand(-9, 9), w, y);
      g.stroke();
    }
  }, repX, repY);
}

function keysTexture(repX, repY) {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#3a3f4a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2f4f7';
    const kw = 26, kh = 26, gap = 6;
    for (let y = gap; y + kh < h; y += kh + gap) {
      for (let x = gap; x + kw < w; x += kw + gap) {
        g.beginPath();
        g.roundRect(x, y, kw, kh, 5);
        g.fill();
      }
    }
  }, repX, repY);
}

function screenTexture() {
  return canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#eef3f8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f7fd0';
    g.fillRect(0, 0, w, 22);           // titelbalk
    // spreadsheet-cellen
    g.strokeStyle = '#c3cedd';
    for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 22); g.lineTo(x, h); g.stroke(); }
    for (let y = 22; y < h; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#5a6b80';
    for (let i = 0; i < 22; i++) g.fillRect(4 + (i % 7) * 32, 26 + Math.floor(i / 7) * 18, rand(10, 24), 8);
  });
}

function paperTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#f7f7f2';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90, 120, 200, .5)';
    for (let y = 16; y < h; y += 14) { g.beginPath(); g.moveTo(10, y); g.lineTo(w - 10, y); g.stroke(); }
  });
}

function cardboardTexture(repX = 1, repY = 1) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#c99a63';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.fillRect(w * 0.3, 0, w * 0.4, 14); // tape
    g.strokeStyle = 'rgba(120, 78, 36, .6)';
    g.lineWidth = 2;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = 'rgba(120, 78, 36, .8)';
    g.font = 'bold 15px sans-serif';
    g.fillText('FRAGILE', 12, h - 14);
  }, repX, repY);
}

function concreteTexture(repX, repY) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#a9adb3';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 350; i++) {
      g.fillStyle = `rgba(${rand(70, 150)}, ${rand(70, 150)}, ${rand(75, 155)}, .2)`;
      g.fillRect(rand(0, w), rand(0, h), rand(1, 4), rand(1, 4));
    }
    // gele vloertape
    g.fillStyle = '#e8c31e';
    g.fillRect(0, 0, w, 9);
    g.fillRect(0, 0, 9, h);
  }, repX, repY);
}

function brickTexture(repX, repY) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#b8503e';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e0d6c8';
    g.lineWidth = 4;
    const bh = 22;
    for (let row = 0; row * bh < h + bh; row++) {
      const y = row * bh;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      const off = row % 2 ? 0 : 32;
      for (let x = off; x < w; x += 64) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + bh); g.stroke();
      }
    }
  }, repX, repY);
}

function sandTexture(repX, repY) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ddb877';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      g.fillStyle = `rgba(${rand(150, 210)}, ${rand(110, 165)}, ${rand(55, 95)}, .3)`;
      g.fillRect(rand(0, w), rand(0, h), rand(1, 3), rand(1, 3));
    }
  }, repX, repY);
}

function fenceTexture(repX, repY) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#8a6a42';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60, 42, 22, .55)';
    g.lineWidth = 3;
    for (let x = 0; x <= w; x += 26) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }, repX, repY);
}

function shutterTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#7d8894';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40, 50, 60, .5)';
    g.lineWidth = 3;
    for (let y = 0; y <= h; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
}

// ---------- gedeelde bouwstenen ----------

function addGround(group, w, d, material) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  p.rotation.x = -Math.PI / 2;
  group.add(p);
}

function addCylinder(group, x, z, r, h, color, yBase = 0, obstacle = null) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat(color));
  m.position.set(x, yBase + h / 2, z);
  group.add(m);
  if (obstacle) obstacle.push({ x, z, w: r * 2, d: r * 2, h: yBase + h });
  return m;
}

function addCone(group, obstacles, x, z) {
  // verkeerspion: oranje kegel met witte band op een voetplaat
  const foot = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 1.2), mat(0xd9531e));
  foot.position.set(x, 0.08, z);
  group.add(foot);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.7, 12), mat(0xf06a1e));
  cone.position.set(x, 1, z);
  group.add(cone);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.3, 12), mat(0xf5f5f5));
  band.position.set(x, 1.1, z);
  group.add(band);
  obstacles.push({ x, z, w: 1.2, d: 1.2, h: 1.8 });
}

function defaultSpawns(hx, hz) {
  const mx = hx - 8, mz = hz - 8;
  spawnPoints.push(
    { x: -mx, z: -mz }, { x: mx, z: -mz }, { x: -mx, z: mz }, { x: mx, z: mz },
    { x: 0, z: -mz }, { x: 0, z: mz }, { x: -mx, z: 0 }, { x: mx, z: 0 },
  );
}

// ---------- KANTOOR ----------

function buildOffice(group, world) {
  const HX = 70, HZ = 30;
  resetWorldData(HX, HZ);
  const { obstacles } = world;

  group.add(new THREE.AmbientLight(0xfff3e0, 0.8));
  const sun = new THREE.DirectionalLight(0xfff6e8, 1.25);
  sun.position.set(30, 80, 40);
  group.add(sun);

  // bureaublad-vloer
  addGround(group, HX * 2 + 30, HZ * 2 + 30, new THREE.MeshLambertMaterial({ map: woodTexture(10, 5) }));

  // bureaurand rondom (donkerder hout)
  const edge = 0x9a6b3c;
  addBox(group, obstacles, 0, -(HZ + 2), HX * 2 + 10, 4, 3, edge);
  addBox(group, obstacles, 0, HZ + 2, HX * 2 + 10, 4, 3, edge);
  addBox(group, obstacles, -(HX + 2), 0, 4, HZ * 2 + 10, 3, edge);
  addBox(group, obstacles, HX + 2, 0, 4, HZ * 2 + 10, 3, edge);

  // ordners tegen de randen (kleurige ruggen als skyline)
  const binder = [0xd9534f, 0x2e78c2, 0x3fa45b, 0xe8a13c, 0x8a5ce0];
  for (let i = -5; i <= 5; i++) {
    addBox(group, null, i * 12, -(HZ + 3.5), 3.4, 2, rand(7, 9.5), binder[(i + 5) % 5], 3);
    addBox(group, null, i * 12 + 5, HZ + 3.5, 3.4, 2, rand(7, 9.5), binder[(i + 7) % 5], 3);
  }

  // --- open laptops waar je overheen rijdt: toetsenbord op, scherm af ---
  const keysMat = new THREE.MeshLambertMaterial({ map: keysTexture(3, 1) });
  const screenMat = new THREE.MeshLambertMaterial({ map: screenTexture() });
  const laptop = (x, z, flip) => {
    // flip=false: toetsenbord aan de -z kant omhoog, scherm loopt af naar +z
    const s = flip ? -1 : 1;
    addRamp(group, x, z - 4.25 * s, 9, 8.5, 1.8, flip ? 2 : 0, keysMat);
    addRamp(group, x, z + 4.7 * s, 9, 9.4, 1.8, flip ? 0 : 2, screenMat);
  };
  laptop(-40, -12, false);
  laptop(40, 12, true);

  // --- monitor op voet (obstakel) ---
  const monitor = (x, z, flip) => {
    addCylinder(group, x, z, 1.6, 0.5, 0x545b66, 0, obstacles);
    addCylinder(group, x, z, 0.5, 2.4, 0x545b66);
    addBox(group, obstacles, x, z, 10, 0.8, 6, 0x3a3f4a, 2.2);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 5), screenMat);
    sc.position.set(x, 5.1, z + (flip ? -0.42 : 0.42));
    if (flip) sc.rotation.y = Math.PI;
    group.add(sc);
  };
  monitor(0, -22, false);
  monitor(0, 22, true);

  // --- koffiemokken (ronde obstakels, met oor) ---
  const mug = (x, z, color) => {
    addCylinder(group, x, z, 2.1, 3.4, color, 0, obstacles);
    const inside = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.2, 16), mat(0x4a2f1d));
    inside.position.set(x, 3.42, z);
    group.add(inside);
    const ear = new THREE.Mesh(new THREE.TorusGeometry(1, 0.3, 8, 16), mat(color));
    ear.position.set(x + 2.1, 1.8, z);
    group.add(ear);
  };
  mug(-18, 8, 0xd9534f);
  mug(18, -8, 0x2e78c2);
  mug(-55, 14, 0xf5f5f0);
  mug(55, -14, 0x3fa45b);

  // --- papierstapels: plateau met een 'afgegleden vel' als oprit ---
  const paperMat = new THREE.MeshLambertMaterial({ map: paperTexture() });
  const paperStack = (x, z, dir) => {
    platformsPush(world, x, z, 9, 9, 2.4);
    for (let i = 0; i < 6; i++) {
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(9 + rand(-0.5, 0.5), 0.4, 9 + rand(-0.5, 0.5)), paperMat);
      sheet.position.set(x + rand(-0.3, 0.3), 0.2 + i * 0.4, z + rand(-0.3, 0.3));
      sheet.rotation.y = rand(-0.06, 0.06);
      group.add(sheet);
    }
    const rx = dir === 1 ? x - 8 : x + 8;
    addRamp(group, rx, z, 7, 7.5, 2.4, dir, paperMat);
  };
  paperStack(-14, -8, 1);
  paperStack(14, 8, 3);

  // --- losse toetsenborden en muizen: lage hobbels ---
  const kbBump = (x, z) => {
    platformsPush(world, x, z, 11, 4.5, 0.45);
    const b = new THREE.Mesh(new THREE.BoxGeometry(11, 0.45, 4.5), keysMat);
    b.position.set(x, 0.225, z);
    group.add(b);
  };
  kbBump(-30, 16);
  kbBump(30, -16);
  const mouse = (x, z, color) => {
    platformsPush(world, x, z, 2.6, 3.8, 0.5);
    const m = new THREE.Mesh(new THREE.SphereGeometry(2, 14, 10), mat(color));
    m.scale.set(0.65, 0.42, 1);
    m.position.set(x, 0.35, z);
    group.add(m);
    // snoer
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6, 6), mat(0x3a3f4a));
    cord.rotation.x = Math.PI / 2;
    cord.rotation.z = rand(-0.4, 0.4);
    cord.position.set(x, 0.1, z + 4.5);
    group.add(cord);
  };
  mouse(-4, 12, 0xf5f5f0);
  mouse(4, -12, 0x3a3f4a);

  // --- pennen als lage hobbels ---
  const pen = (x, z, rot, color) => {
    platformsPush(world, x, z, 7, 1, 0.35);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 7, 8), mat(color));
    p.rotation.z = Math.PI / 2;
    p.rotation.y = rot;
    p.position.set(x, 0.35, z);
    group.add(p);
  };
  pen(-52, -14, 0.2, 0x2e78c2);
  pen(52, 14, -0.15, 0xd9534f);

  // plaknotitie-gele item-boxen
  defaultSpawns(HX, HZ);
  itemBoxSpots.push(
    { x: 0, z: 0 }, { x: -14, z: -8 }, { x: 14, z: 8 },
    { x: -30, z: 0 }, { x: 30, z: 0 }, { x: -48, z: -18 }, { x: 48, z: 18 },
    { x: -62, z: 0 }, { x: 62, z: 0 }, { x: 0, z: -14 }, { x: 0, z: 14 },
  );

  return {
    sky: 0xdfe8f2, fogNear: 100, fogFar: 220,
    boxStyle: { c1: '#ffe95e', c2: '#f5c518', ink: '#8a6d00' },
  };
}

// kleine helper: platform registreren zonder mesh (mesh apart)
function platformsPush(world, x, z, w, d, h) {
  world.platforms.push({ x, z, w, d, h });
}

// ---------- MAGAZIJN ----------

function buildWarehouse(group, world) {
  const HX = 58, HZ = 58;
  resetWorldData(HX, HZ);
  const { obstacles } = world;

  group.add(new THREE.AmbientLight(0xe8f0ff, 0.7));
  const lamp = new THREE.DirectionalLight(0xf2f7ff, 1.3);
  lamp.position.set(-30, 70, 20);
  group.add(lamp);

  addGround(group, HX * 2 + 30, HZ * 2 + 30, new THREE.MeshLambertMaterial({ map: concreteTexture(8, 8) }));

  // wanden met rolluiken
  const wallMat = mat(0x8d99a6);
  const shutMat = new THREE.MeshLambertMaterial({ map: shutterTexture() });
  addBox(group, obstacles, 0, -(HZ + 2), HX * 2 + 10, 4, 8, wallMat);
  addBox(group, obstacles, 0, HZ + 2, HX * 2 + 10, 4, 8, wallMat);
  addBox(group, obstacles, -(HX + 2), 0, 4, HZ * 2 + 10, 8, wallMat);
  addBox(group, obstacles, HX + 2, 0, 4, HZ * 2 + 10, 8, wallMat);
  for (const [sx, sz, ry] of [[-20, -(HZ - 0.2), 0], [20, -(HZ - 0.2), 0], [0, HZ - 0.2, Math.PI], [HX - 0.2, 0, -Math.PI / 2], [-(HX - 0.2), 0, Math.PI / 2]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), shutMat);
    s.position.set(sx, 3.5, sz);
    s.rotation.y = ry;
    group.add(s);
  }

  // stellingkasten: oranje staanders + planken met dozen
  const boxMat = new THREE.MeshLambertMaterial({ map: cardboardTexture() });
  const shelf = (x, z, horizontal) => {
    const w = horizontal ? 26 : 4.5, d = horizontal ? 4.5 : 26;
    addBox(group, obstacles, x, z, w, d, 2.6, 0x2e5f8a);               // onderbak
    addBox(group, null, x, z, w, d, 0.5, 0xf07d1e, 2.6);               // plank
    addBox(group, null, x, z, w, d, 0.5, 0xf07d1e, 6.1);               // plank 2
    // staanders
    for (const [ox, oz] of [[-w / 2 + 0.4, -d / 2 + 0.4], [w / 2 - 0.4, -d / 2 + 0.4], [-w / 2 + 0.4, d / 2 - 0.4], [w / 2 - 0.4, d / 2 - 0.4]]) {
      addBox(group, null, x + ox, z + oz, 0.8, 0.8, 7.5, 0xf07d1e);
    }
    // dozen op de planken
    for (let i = 0; i < 5; i++) {
      const bx = horizontal ? x - w / 2 + 3 + i * 5 : x;
      const bz = horizontal ? z : z - d / 2 + 3 + i * 5;
      const bm = new THREE.Mesh(new THREE.BoxGeometry(rand(2.4, 3.6), rand(1.8, 2.6), rand(2.4, 3.6)), boxMat);
      bm.position.set(bx, 3.1 + rand(0.9, 1.3) / 2 + 0.3, bz);
      bm.rotation.y = rand(-0.2, 0.2);
      group.add(bm);
    }
  };
  shelf(-26, -26, true);
  shelf(26, 26, true);
  shelf(-30, 24, false);
  shelf(30, -24, false);

  // doosstapels (dekking)
  const boxStack = (x, z) => {
    addBox(group, obstacles, x, z, 5, 5, 3.4, boxMat);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 3.4), boxMat);
    top.position.set(x + rand(-0.5, 0.5), 4.6, z + rand(-0.5, 0.5));
    top.rotation.y = rand(-0.3, 0.3);
    group.add(top);
  };
  boxStack(-10, 14);
  boxStack(10, -14);
  boxStack(-44, 0);
  boxStack(44, 0);

  // pallets: lage hobbels
  const pallet = (x, z) => {
    platformsPush(world, x, z, 5.5, 5.5, 0.5);
    const woodM = new THREE.MeshLambertMaterial({ map: woodTexture(2, 2) });
    for (let i = -1; i <= 1; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.25, 1.5), woodM);
      plank.position.set(x, 0.4, z + i * 1.9);
      group.add(plank);
    }
    for (const ox of [-2.2, 0, 2.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 5.5), woodM);
      leg.position.set(x + ox, 0.15, z);
      group.add(leg);
    }
  };
  pallet(-18, -6);
  pallet(18, 6);
  pallet(0, 30);
  pallet(0, -30);

  // centraal laadplateau met twee laadkleppen
  addBox(group, null, 0, 0, 18, 12, 3, 0x6f7a86);
  world.platforms.push({ x: 0, z: 0, w: 18, d: 12, h: 3 });
  const rampMat = new THREE.MeshLambertMaterial({ map: concreteTexture(2, 2) });
  addRamp(group, 0, -10.5, 9, 9, 3, 0, rampMat);
  addRamp(group, 0, 10.5, 9, 9, 3, 2, rampMat);

  // losse springplank van pallets
  addRamp(group, -40, 30, 6, 8, 2.2, 1, new THREE.MeshLambertMaterial({ map: woodTexture(3, 2) }));
  addRamp(group, 40, -30, 6, 8, 2.2, 3, new THREE.MeshLambertMaterial({ map: woodTexture(3, 2) }));

  // pionnen
  addCone(group, obstacles, -6, -20);
  addCone(group, obstacles, 6, 20);
  addCone(group, obstacles, -34, 10);
  addCone(group, obstacles, 34, -10);

  defaultSpawns(HX, HZ);
  itemBoxSpots.push(
    { x: 0, z: 0 }, { x: -18, z: 18 }, { x: 18, z: -18 },
    { x: -36, z: -36 }, { x: 36, z: 36 }, { x: 0, z: -42 }, { x: 0, z: 42 },
    { x: -48, z: 20 }, { x: 48, z: -20 }, { x: -22, z: 0 }, { x: 22, z: 0 },
  );

  return {
    sky: 0xb9c4ce, fogNear: 90, fogFar: 200,
    boxStyle: { c1: '#d9a869', c2: '#b97f3f', ink: '#5e3d16' },
  };
}

// ---------- BOUWPLAATS ----------

function buildConstruction(group, world) {
  const HX = 58, HZ = 58;
  resetWorldData(HX, HZ);
  const { obstacles } = world;

  group.add(new THREE.AmbientLight(0xfff2dd, 0.85));
  const sun = new THREE.DirectionalLight(0xffe9c4, 1.5);
  sun.position.set(50, 70, -30);
  group.add(sun);

  addGround(group, HX * 2 + 30, HZ * 2 + 30, new THREE.MeshLambertMaterial({ map: sandTexture(9, 9) }));

  // houten schutting rondom
  const fence = new THREE.MeshLambertMaterial({ map: fenceTexture(12, 1) });
  addBox(group, obstacles, 0, -(HZ + 2), HX * 2 + 10, 4, 5, fence);
  addBox(group, obstacles, 0, HZ + 2, HX * 2 + 10, 4, 5, fence);
  addBox(group, obstacles, -(HX + 2), 0, 4, HZ * 2 + 10, 5, fence);
  addBox(group, obstacles, HX + 2, 0, 4, HZ * 2 + 10, 5, fence);

  // bakstenen muurtjes in aanbouw
  const brick = new THREE.MeshLambertMaterial({ map: brickTexture(4, 2) });
  addBox(group, obstacles, -24, -14, 14, 2, 3.2, brick);
  addBox(group, obstacles, 24, 14, 14, 2, 3.2, brick);
  addBox(group, obstacles, -14, 26, 2, 14, 2.6, brick);
  addBox(group, obstacles, 14, -26, 2, 14, 2.6, brick);

  // betonblokken
  addBox(group, obstacles, -42, 8, 6, 6, 4, 0x9ea3a8);
  addBox(group, obstacles, 42, -8, 6, 6, 4, 0x9ea3a8);

  // cementzakken: lage hobbels
  const bag = (x, z, rot) => {
    platformsPush(world, x, z, 3.4, 2.4, 0.5);
    const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 2.2), mat(0xd8d3c8));
    b.scale.y = 0.7;
    b.rotation.y = rot;
    b.position.set(x, 0.36, z);
    group.add(b);
    const label = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.72, 2.26), mat(0xd9531e));
    label.rotation.y = rot;
    label.position.set(x, 0.37, z);
    group.add(label);
  };
  bag(-8, 10, 0.3);
  bag(8, -10, -0.2);
  bag(-30, -30, 0.1);
  bag(30, 30, -0.4);

  // stapel buizen (obstakel)
  const pipes = (x, z, horizontal) => {
    const len = 12;
    const pipe = (px, pz, py) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, len, 12), mat(0xc2571e));
      p.rotation.z = horizontal ? Math.PI / 2 : 0;
      if (!horizontal) p.rotation.x = Math.PI / 2;
      p.position.set(px, py, pz);
      group.add(p);
    };
    if (horizontal) {
      pipe(x, z - 1, 0.9); pipe(x, z + 1, 0.9); pipe(x, z, 2.4);
      obstacles.push({ x, z, w: len, d: 3.8, h: 3.3 });
    } else {
      pipe(x - 1, z, 0.9); pipe(x + 1, z, 0.9); pipe(x, z, 2.4);
      obstacles.push({ x, z, w: 3.8, d: len, h: 3.3 });
    }
  };
  pipes(0, -30, true);
  pipes(0, 30, true);
  pipes(-38, 32, false);
  pipes(38, -32, false);

  // centrale steiger: plateau op buispoten met planken-opritten
  const plankMat = new THREE.MeshLambertMaterial({ map: woodTexture(4, 2) });
  addBox(group, null, 0, 0, 16, 16, 0.6, plankMat, 3);
  world.platforms.push({ x: 0, z: 0, w: 16, d: 16, h: 3.6 });
  for (const [ox, oz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) {
    addCylinder(group, ox, oz, 0.4, 3, 0xf0b91e);
  }
  addRamp(group, 0, -12, 7, 8.5, 3.6, 0, plankMat);
  addRamp(group, 0, 12, 7, 8.5, 3.6, 2, plankMat);

  // losse springschansen van planken
  addRamp(group, -44, -20, 6, 8, 2.4, 1, plankMat);
  addRamp(group, 44, 20, 6, 8, 2.4, 3, plankMat);

  // pionnen
  addCone(group, obstacles, -20, 2);
  addCone(group, obstacles, 20, -2);
  addCone(group, obstacles, -6, -44);
  addCone(group, obstacles, 6, 44);

  // zandhopen (berijdbare bulten via ramp aan beide kanten? decor-heuvel als platform)
  const sandPile = (x, z) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(4.5, 14, 10), mat(0xcfa25e));
    s.scale.y = 0.4;
    s.position.set(x, 0, z);
    group.add(s);
    world.platforms.push({ x, z, w: 5, d: 5, h: 0.5 });
  };
  sandPile(-34, -8);
  sandPile(34, 8);

  defaultSpawns(HX, HZ);
  itemBoxSpots.push(
    { x: 0, z: 0 }, { x: -16, z: -16 }, { x: 16, z: 16 },
    { x: -36, z: 20 }, { x: 36, z: -20 }, { x: 0, z: -44 }, { x: 0, z: 44 },
    { x: -48, z: -40 }, { x: 48, z: 40 }, { x: -24, z: 4 }, { x: 24, z: -4 },
  );

  return {
    sky: 0xf2d9a8, fogNear: 90, fogFar: 200,
    boxStyle: { c1: '#f0a41e', c2: '#d9531e', ink: '#ffffff' },
  };
}

// ---------- registry & builder ----------

export const MAPS = {
  office: { name: 'Kantoor', build: buildOffice },
  warehouse: { name: 'Magazijn', build: buildWarehouse },
  construction: { name: 'Bouwplaats', build: buildConstruction },
};

let currentGroup = null;

export function buildMap(scene, id) {
  if (currentGroup) {
    scene.remove(currentGroup);
    currentGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
  const group = new THREE.Group();
  const world = { obstacles, platforms };
  const cfg = MAPS[id].build(group, world);
  scene.background = new THREE.Color(cfg.sky);
  scene.fog = new THREE.Fog(cfg.sky, cfg.fogNear, cfg.fogFar);
  scene.add(group);
  currentGroup = group;
  return cfg;
}

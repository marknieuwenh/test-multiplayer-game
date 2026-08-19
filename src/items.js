// Item-boxen, wapens, projectielen, mijnen en schade-afhandeling.

import * as THREE from 'three';
import { KART_RADIUS, rand, pick, clamp, angleDiff, dist2D } from './util.js';
import { itemBoxSpots, resolveCircle, groundHeightAt } from './world.js';
import { explosion, sparks, pickupBurst } from './effects.js';
import { sfx } from './audio.js';

export const WEAPONS = {
  gun:    { icon: '\u{1F52B}', ammo: 14, interval: 0.11, name: 'Machinegeweer' },
  rocket: { icon: '\u{1F680}', ammo: 3,  interval: 0.5,  name: 'Raketten' },
  mine:   { icon: '\u{1F4A3}', ammo: 3,  interval: 0.45, name: 'Mijnen' },
  shield: { icon: '\u{1F6E1}️', ammo: 1, interval: 0.3, name: 'Schild' },
};
const WEAPON_KEYS = ['gun', 'gun', 'rocket', 'rocket', 'mine', 'shield'];

function questionTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#ff5f6d');
  grad.addColorStop(1, '#ffc371');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,.9)';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 118, 118);
  g.fillStyle = '#fff';
  g.font = 'bold 84px "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('?', 64, 70);
  return new THREE.CanvasTexture(cv);
}

export class ItemManager {
  constructor(scene, events) {
    this.scene = scene;
    this.events = events; // { onKill(victim, killer, weaponType), onPickup(kart) }
    this.projectiles = [];
    this.mines = [];
    this.boxes = [];

    const tex = questionTexture();
    const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const boxMat = new THREE.MeshLambertMaterial({ map: tex });
    for (const s of itemBoxSpots) {
      const mesh = new THREE.Mesh(boxGeo, boxMat);
      const y = groundHeightAt(s.x, s.z);
      mesh.position.set(s.x, y + 1.1, s.z);
      scene.add(mesh);
      this.boxes.push({ mesh, x: s.x, z: s.z, baseY: y + 1.1, active: true, respawnAt: 0 });
    }

    this.bulletGeo = new THREE.SphereGeometry(0.22, 8, 6);
    this.bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe36e });
    this.rocketGeo = new THREE.ConeGeometry(0.32, 1.1, 8);
    this.rocketMat = new THREE.MeshLambertMaterial({ color: 0xf0463c });
    this.mineGeo = new THREE.SphereGeometry(0.5, 10, 8);
    this.mineMat = new THREE.MeshLambertMaterial({ color: 0x2b2f3a });
  }

  reset() {
    for (const b of this.boxes) { b.active = true; b.mesh.visible = true; }
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const m of this.mines) this.scene.remove(m.mesh);
    this.projectiles = [];
    this.mines = [];
  }

  giveRandomWeapon(kart) {
    const type = pick(WEAPON_KEYS);
    kart.weapon = { type, ammo: WEAPONS[type].ammo };
  }

  tryPickups(karts, now) {
    for (const b of this.boxes) {
      if (!b.active) {
        if (now >= b.respawnAt) { b.active = true; b.mesh.visible = true; }
        continue;
      }
      for (const k of karts) {
        if (k.dead) continue;
        if (Math.abs(k.pos.y + 1 - b.baseY) > 2) continue;
        if (dist2D(k.pos.x, k.pos.z, b.x, b.z) < 1.9) {
          b.active = false;
          b.mesh.visible = false;
          b.respawnAt = now + 6;
          this.giveRandomWeapon(k);
          pickupBurst(b.x, b.baseY, b.z);
          if (!k.isBot) sfx.pickup();
          if (this.events.onPickup) this.events.onPickup(k);
          break;
        }
      }
    }
  }

  fire(kart, karts, now) {
    const w = kart.weapon;
    if (!w || kart.fireCooldown > 0 || kart.dead) return false;
    const cfg = WEAPONS[w.type];
    kart.fireCooldown = cfg.interval;

    const fwd = kart.forward();
    const y = kart.pos.y + 0.9;

    if (w.type === 'gun') {
      const spread = rand(-0.045, 0.045);
      const a = kart.heading + spread;
      const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
      mesh.position.set(kart.pos.x + fwd.x * 1.6, y, kart.pos.z + fwd.z * 1.6);
      this.scene.add(mesh);
      this.projectiles.push({
        mesh, type: 'gun', owner: kart, dmg: 1, radius: 0.25,
        vel: dir.multiplyScalar(46 + Math.max(0, kart.speed)),
        life: 1.1,
      });
      sfx.shoot();
    } else if (w.type === 'rocket') {
      const mesh = new THREE.Mesh(this.rocketGeo, this.rocketMat);
      mesh.position.set(kart.pos.x + fwd.x * 1.8, y, kart.pos.z + fwd.z * 1.8);
      mesh.rotation.x = Math.PI / 2;
      this.scene.add(mesh);
      this.projectiles.push({
        mesh, type: 'rocket', owner: kart, dmg: 3, radius: 0.45,
        vel: fwd.clone().multiplyScalar(30 + Math.max(0, kart.speed)),
        life: 2.6, karts,
      });
      sfx.rocket();
    } else if (w.type === 'mine') {
      const mesh = new THREE.Group();
      const ball = new THREE.Mesh(this.mineGeo, this.mineMat);
      ball.position.y = 0.4;
      mesh.add(ball);
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xff3030 })
      );
      light.position.y = 0.85;
      mesh.add(light);
      const px = kart.pos.x - fwd.x * 2.2, pz = kart.pos.z - fwd.z * 2.2;
      mesh.position.set(px, groundHeightAt(px, pz), pz);
      this.scene.add(mesh);
      this.mines.push({
        mesh, light, owner: kart,
        x: px, z: pz, y: mesh.position.y,
        armAt: now + 0.8, safeOwnerUntil: now + 3, dieAt: now + 30,
      });
      sfx.mine();
    } else if (w.type === 'shield') {
      kart.shieldUntil = now + 5;
      sfx.shield();
    }

    w.ammo -= 1;
    if (w.ammo <= 0) kart.weapon = null;
    return true;
  }

  explode(x, y, z, owner, karts, now, radius = 3.4, dmg = 3, weaponType = 'rocket') {
    explosion(x, y, z, true);
    sfx.explosion();
    for (const k of karts) {
      if (k.dead) continue;
      const d = dist2D(k.pos.x, k.pos.z, x, z);
      if (d < radius && Math.abs(k.pos.y - y) < 3) {
        const falloff = d < radius * 0.5 ? 1 : 0.6;
        this.damage(k, Math.max(1, Math.round(dmg * falloff)), owner, weaponType, now);
        // knockback
        const nx = (k.pos.x - x) / (d || 1), nz = (k.pos.z - z) / (d || 1);
        const power = 14 * (1 - d / radius) + 5;
        k.knock.x += nx * power;
        k.knock.z += nz * power;
        k.vy = Math.max(k.vy, 5 * (1 - d / radius));
      }
    }
  }

  damage(kart, dmg, attacker, weaponType, now) {
    if (kart.dead || kart.isInvulnerable(now)) return;
    kart.hp -= dmg;
    if (!kart.isBot) sfx.hit();
    if (kart.hp <= 0) {
      kart.hp = 0;
      kart.dead = true;
      kart.deaths += 1;
      kart.respawnAt = now + 2.6;
      kart.mesh.visible = false;
      kart.weapon = null;
      explosion(kart.pos.x, kart.pos.y + 0.8, kart.pos.z, true);
      sfx.die();
      if (attacker && attacker !== kart) attacker.score += 1;
      if (this.events.onKill) this.events.onKill(kart, attacker, weaponType);
    }
  }

  update(dt, now, karts) {
    // --- item-boxen draaien/zweven ---
    for (const b of this.boxes) {
      if (!b.active) {
        if (now >= b.respawnAt) { b.active = true; b.mesh.visible = true; }
        continue;
      }
      b.mesh.rotation.y += dt * 1.6;
      b.mesh.rotation.x += dt * 0.7;
      b.mesh.position.y = b.baseY + Math.sin(now * 2.2 + b.x) * 0.15;
    }
    this.tryPickups(karts, now);

    // --- projectielen ---
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;

      // raketten sturen licht bij richting dichtstbijzijnde vijand
      if (p.type === 'rocket') {
        let best = null, bestD = 26;
        for (const k of karts) {
          if (k === p.owner || k.dead) continue;
          const d = dist2D(k.pos.x, k.pos.z, p.mesh.position.x, p.mesh.position.z);
          if (d < bestD) {
            const toK = Math.atan2(k.pos.x - p.mesh.position.x, k.pos.z - p.mesh.position.z);
            const cur = Math.atan2(p.vel.x, p.vel.z);
            if (Math.abs(angleDiff(toK, cur)) < 0.7) { best = k; bestD = d; }
          }
        }
        if (best) {
          const sp = p.vel.length();
          const cur = Math.atan2(p.vel.x, p.vel.z);
          const toK = Math.atan2(best.pos.x - p.mesh.position.x, best.pos.z - p.mesh.position.z);
          const turn = clamp(angleDiff(toK, cur), -1.6 * dt, 1.6 * dt);
          const a = cur + turn;
          p.vel.set(Math.sin(a) * sp, 0, Math.cos(a) * sp);
        }
        p.mesh.rotation.y = Math.atan2(p.vel.x, p.vel.z);
        p.mesh.rotation.x = Math.PI / 2;
        if (Math.random() < 0.5) sparks(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z);
      }

      p.mesh.position.addScaledVector(p.vel, dt);
      const pos = p.mesh.position;

      let remove = false;

      // muur of grond geraakt?
      const test = { x: pos.x, z: pos.z };
      const hitWall = resolveCircle(test, p.radius, pos.y - 0.6);
      const hitGround = pos.y < groundHeightAt(pos.x, pos.z) + 0.1;
      if (hitWall || hitGround || p.life <= 0) {
        if (p.type === 'rocket') {
          this.explode(pos.x, pos.y, pos.z, p.owner, karts, now, 3.4, 3, 'rocket');
        } else if (hitWall || hitGround) {
          sparks(pos.x, pos.y, pos.z);
        }
        remove = true;
      } else {
        // karts geraakt?
        for (const k of karts) {
          if (k === p.owner || k.dead) continue;
          if (Math.abs(k.pos.y + 0.8 - pos.y) > 1.6) continue;
          if (dist2D(k.pos.x, k.pos.z, pos.x, pos.z) < KART_RADIUS + p.radius) {
            if (p.type === 'rocket') {
              this.explode(pos.x, pos.y, pos.z, p.owner, karts, now, 3.4, 3, 'rocket');
            } else {
              this.damage(k, p.dmg, p.owner, 'gun', now);
              sparks(pos.x, pos.y, pos.z);
              const nx = pos.x - k.pos.x, nz = pos.z - k.pos.z;
              const nd = Math.hypot(nx, nz) || 1;
              k.knock.x -= (nx / nd) * 2.4;
              k.knock.z -= (nz / nd) * 2.4;
            }
            remove = true;
            break;
          }
        }
      }

      if (remove) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // --- mijnen ---
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      if (now >= m.dieAt) {
        this.scene.remove(m.mesh);
        this.mines.splice(i, 1);
        continue;
      }
      const armed = now >= m.armAt;
      m.light.material.color.setHex(
        armed && Math.floor(now * 5) % 2 === 0 ? 0xff3030 : 0x701010
      );
      if (!armed) continue;
      for (const k of karts) {
        if (k.dead) continue;
        if (k === m.owner && now < m.safeOwnerUntil) continue;
        if (Math.abs(k.pos.y - m.y) > 1.6) continue;
        if (dist2D(k.pos.x, k.pos.z, m.x, m.z) < 2.1) {
          this.explode(m.x, m.y + 0.5, m.z, m.owner, karts, now, 3.6, 3, 'mine');
          this.scene.remove(m.mesh);
          this.mines.splice(i, 1);
          break;
        }
      }
    }
  }
}

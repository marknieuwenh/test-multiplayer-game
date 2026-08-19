// Bot-AI: rijdt naar item-boxen, jaagt op tegenstanders, ontwijkt muren
// en vuurt met een beetje menselijke onnauwkeurigheid.

import { rand, pick, clamp, angleDiff, dist2D, ARENA_HALF } from './util.js';
import { isBlocked } from './world.js';

export const BOT_NAMES = [
  'ThunderTurbo', 'DriftCore', 'Frikandelbroodje', 'SirBotsalot',
  'TurboTosti', 'KartKampioen', 'MegaMuis', 'Bliksem',
  'Dragocat', 'BadSpawn', 'Zzzoef', 'PixelPiloot',
];

export class BotBrain {
  constructor(kart) {
    this.kart = kart;
    this.target = null;          // {x, z} of kart
    this.retargetAt = 0;
    this.avoidDir = 0;
    this.avoidUntil = 0;
    this.stuckTimer = 0;
    this.lastPos = { x: kart.pos.x, z: kart.pos.z };
    // per-bot "skill"
    this.aimError = rand(0.03, 0.14);
    this.aggro = rand(0.6, 1);
  }

  chooseTarget(karts, items, now) {
    const k = this.kart;
    this.retargetAt = now + rand(1.2, 2.6);

    // met wapen: jaag op de dichtstbijzijnde levende vijand
    if (k.weapon && k.weapon.type !== 'shield' && Math.random() < this.aggro) {
      let best = null, bestD = 1e9;
      for (const other of karts) {
        if (other === k || other.dead) continue;
        const d = dist2D(k.pos.x, k.pos.z, other.pos.x, other.pos.z);
        if (d < bestD) { best = other; bestD = d; }
      }
      if (best) { this.target = best; return; }
    }

    // anders: naar een actieve item-box
    const active = items.boxes.filter((b) => b.active);
    if (!k.weapon && active.length) {
      let best = null, bestD = 1e9;
      for (const b of active) {
        const d = dist2D(k.pos.x, k.pos.z, b.x, b.z) * rand(0.8, 1.3);
        if (d < bestD) { best = b; bestD = d; }
      }
      this.target = { x: best.x, z: best.z };
      return;
    }

    // zwerfpunt
    this.target = {
      x: rand(-ARENA_HALF + 8, ARENA_HALF - 8),
      z: rand(-ARENA_HALF + 8, ARENA_HALF - 8),
    };
  }

  update(dt, now, karts, items) {
    const k = this.kart;
    if (k.dead) return;

    if (!this.target || now >= this.retargetAt) this.chooseTarget(karts, items, now);
    // doelwit dood? nieuw doel
    if (this.target && this.target.dead) this.chooseTarget(karts, items, now);

    const tx = this.target.pos ? this.target.pos.x : this.target.x;
    const tz = this.target.pos ? this.target.pos.z : this.target.z;

    const toTarget = Math.atan2(tx - k.pos.x, tz - k.pos.z);
    let steerAngle = angleDiff(toTarget, k.heading);

    // --- obstakel-ontwijking met drie voelsprieten ---
    const probe = (offset) => {
      const a = k.heading + offset;
      const px = k.pos.x + Math.sin(a) * 4.5;
      const pz = k.pos.z + Math.cos(a) * 4.5;
      return isBlocked(px, pz, k.pos.y);
    };
    if (now < this.avoidUntil) {
      steerAngle = this.avoidDir;
    } else {
      const mid = probe(0);
      if (mid) {
        const left = probe(-0.65);
        const right = probe(0.65);
        this.avoidDir = left && !right ? 1.4 : !left && right ? -1.4 : (Math.random() < 0.5 ? 1.4 : -1.4);
        this.avoidUntil = now + 0.35;
        steerAngle = this.avoidDir;
      }
    }

    // --- vastzit-detectie ---
    this.stuckTimer += dt;
    if (this.stuckTimer > 1.2) {
      const moved = dist2D(k.pos.x, k.pos.z, this.lastPos.x, this.lastPos.z);
      if (moved < 1.5 && !k.dead) {
        // achteruit en wegdraaien
        this.avoidDir = Math.random() < 0.5 ? 1.5 : -1.5;
        this.avoidUntil = now + 0.7;
        k.ctrl.throttle = -1;
        k.ctrl.steer = clamp(-this.avoidDir, -1, 1);
        this.stuckTimer = 0;
        this.lastPos = { x: k.pos.x, z: k.pos.z };
        return;
      }
      this.stuckTimer = 0;
      this.lastPos = { x: k.pos.x, z: k.pos.z };
    }

    // NB: heading -= steer * rate, dus steer = -richting van de gewenste draai
    k.ctrl.steer = clamp(-steerAngle * 2.2, -1, 1);
    // remmen in scherpe bochten
    k.ctrl.throttle = Math.abs(steerAngle) > 1.5 ? 0.35 : 1;

    // --- vuren ---
    k.ctrl.fire = false;
    if (k.weapon) {
      const w = k.weapon.type;
      if (w === 'shield') {
        if (k.hp <= 3) k.ctrl.fire = true;   // schild bij lage hp
      } else {
        let best = null, bestD = 1e9;
        for (const other of karts) {
          if (other === k || other.dead || other.isInvulnerable(now)) continue;
          const d = dist2D(k.pos.x, k.pos.z, other.pos.x, other.pos.z);
          if (d < bestD) { best = other; bestD = d; }
        }
        if (best) {
          const aim = Math.atan2(best.pos.x - k.pos.x, best.pos.z - k.pos.z);
          const err = Math.abs(angleDiff(aim, k.heading));
          if (w === 'gun' && bestD < 24 && err < 0.16 + this.aimError) k.ctrl.fire = true;
          if (w === 'rocket' && bestD < 34 && err < 0.3 + this.aimError) k.ctrl.fire = true;
          if (w === 'mine') {
            // mijn droppen als iemand achter je zit, of af en toe zomaar
            const behind = Math.abs(angleDiff(aim, k.heading + Math.PI)) < 0.6;
            if ((behind && bestD < 12) || Math.random() < 0.004) k.ctrl.fire = true;
          }
        }
      }
    }
  }
}

export function makeBotRoster(count) {
  const names = [...BOT_NAMES];
  const out = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * names.length);
    out.push(names.splice(idx, 1)[0]);
  }
  return out;
}

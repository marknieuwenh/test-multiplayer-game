// Gedeelde helpers en constanten.

export const ARENA_HALF = 58;          // halve breedte van de arena
export const KART_RADIUS = 1.15;       // botsingscirkel van een kart
export const MAX_HP = 6;
export const MATCH_TIME = 180;         // seconden

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// kleinste hoekverschil in [-PI, PI]
export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.hypot(dx, dz);
}

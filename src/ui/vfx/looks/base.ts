/** Small helpers every element's look shares. (This was once the look every
 *  element started from — one shared shape per effect, told apart by colour —
 *  until each element had a look of its own; BORE was the last, see bore.ts.) */
import type { Pt } from "./types";

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const centre = (r: { x: number; y: number; w: number; h: number }): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** THE SHIELD PLATE a blow meets (see ../shield-hit.ts): how far out from a
 *  card's centre it stands, px — just clear of the card's edge — and the point
 *  on it facing a blow along `angle` (attacker to card, screen radians), which
 *  is where a blow the shields soaked stops. Here rather than in the layer
 *  because the game side (use-spell-impacts.ts) aims at it too, and this file
 *  costs nothing to load. */
export const plateRadius = (r: { w: number; h: number }) => Math.min(r.w, r.h) * 0.56;
export function platePoint(r: { x: number; y: number; w: number; h: number }, angle: number): Pt {
  const c = centre(r), R = plateRadius(r);
  return { x: c.x - Math.cos(angle) * R, y: c.y - Math.sin(angle) * R };
}

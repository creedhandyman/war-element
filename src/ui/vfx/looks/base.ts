/** Small helpers every element's look shares. (This was once the look every
 *  element started from — one shared shape per effect, told apart by colour —
 *  until each element had a look of its own; BORE was the last, see bore.ts.) */
import type { Pt } from "./types";

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const centre = (r: { x: number; y: number; w: number; h: number }): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

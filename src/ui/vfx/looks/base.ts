/** The look every element started from: one shared shape per kind of effect,
 *  told apart by colour and a few knobs. An element's own file spreads this
 *  and overrides what it draws differently. */
import type { ElementLook, Pt } from "./types";

export interface BaseParams {
  /** A thrown thing's glowing head. */
  head: number;
  /** Pale -> deep: trails and thrown sparks. */
  trail: number[];
  /** orb: a ball of it; streak: a fast dart; lob: thrown in an arc; zap:
   *  lightning does not travel — it crackles, then strikes. */
  shape: "orb" | "streak" | "lob" | "zap";
  /** arc: two sweeping cuts; claw: parallel rakes; cuts: several thin
   *  wind-cuts; smash: a blow into the ground. */
  mark: "arc" | "claw" | "cuts" | "smash";
  markColor: number;
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const centre = (r: { x: number; y: number; w: number; h: number }): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function baseLook(p: BaseParams): ElementLook {
  return {
    markColor: p.markColor,
    windUp(t, d) {
      // The attacker gathers itself — visibly more for a Special, which also
      // draws its element in around it, and least for a basic melee swing,
      // where the lunge itself is the wind-up.
      const basicMelee = d.melee && !d.special;
      t.charge(d.at, d.size * (d.special ? 1.7 : basicMelee ? 0.8 : 1.1), p.head,
        d.special ? 0.85 : basicMelee ? 0.22 : 0.4, d.wind + (d.T - d.wind) * 0.3);
      if (d.special)
        t.emit({ count: 28, palette: p.trail, from: d.rect, at: "ring", speed: [110, 190], gravity: 0, drag: 1,
          life: [0.2, d.wind], size: [9, 3] });
    },
    gather(t, d) {
      // The square it will land on is still empty, so the element GATHERS
      // there — drawn in from around it, building — and the strike comes out.
      t.charge(d.at, d.size * (d.special ? 1.9 : 1.4), p.head, d.special ? 0.95 : 0.6, d.T);
      t.emit({ count: d.special ? 40 : 24, palette: p.trail, from: d.rect, at: "ring", speed: [100, 180], gravity: 0,
        drag: 1, life: [0.2, d.wind], size: [10, 3] });
    },
    projectile(t, s) {
      if (p.shape === "zap") {
        // Lightning does not fly: it crackles on the caster, then strikes on
        // the landing frame.
        t.arcs(s.from, t.style.palette, s.special ? 0.8 : 0.5, 3);
        t.later(Math.max(0, s.delay + s.seconds - 0.06), () => t.bolt(s.from, s.to, 0xffffff, 0x9575ff, s.special ? 0.35 : 0.22));
        return;
      }
      const dist = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
      t.shot({
        from: s.from, to: s.to, seconds: s.seconds, delay: s.delay,
        ease: p.shape === "lob" ? "linear" : "in",
        arc: p.shape === "lob" ? dist * 0.35 : 0,
        head: p.head, headSize: s.size * (s.special ? 0.42 : 0.26), stretch: p.shape === "streak",
        trail: { palette: p.trail, rate: s.special ? 170 : 80, size: s.special ? [13, 4] : [9, 3], life: [0.2, 0.45], drift: 18 },
      });
    },
    swing(t, s) {
      // The swing's path, shadowing the token as the hook lunges it — or, for
      // a card arriving with no token yet, the whole pounce. A basic swing's
      // trail is a whisper of it: the token's lunge is the motion, and a basic
      // happens every turn.
      t.shot({
        from: s.from, to: s.to, seconds: s.seconds, delay: s.delay, ease: "in",
        head: p.head, headSize: s.size * (s.special ? 0.2 : 0.1),
        trail: { palette: p.trail, rate: s.special ? 130 : 26, size: s.special ? [10, 3] : [7, 2], life: [0.15, 0.3], drift: 16 },
      });
    },
    mark(t, m) {
      const width = 6;
      switch (p.mark) {
        case "arc":
          t.arcCut(m.c, m.reach, m.across, p.markColor, width, 0.09, 0.28);
          t.arcCut(m.c, m.reach, m.across + Math.PI / 2, p.markColor, width, 0.09, 0.32, -0.35);
          break;
        case "claw":
          t.rakes(m.c, m.reach * 0.9, m.across, p.markColor, 4, m.reach * 0.3, width * 0.7);
          break;
        case "cuts":
          for (let i = 0; i < 5; i++)
            t.arcCut(m.c, m.reach * rand(0.7, 1.05), m.across + rand(-0.5, 0.5), p.markColor, width * 0.55, 0.07, 0.25, rand(-0.3, 0.3));
          break;
        case "smash":
          t.ring(m.rect, p.markColor, 0.25, 1.15, 0.4, 6);
          t.emit({ count: Math.round(28 * m.k), palette: p.trail, from: { x: m.c.x - 8, y: m.c.y - 8, w: 16, h: 16 },
            dir: [-160, -20], speed: [120, 300], gravity: 900, drag: 0.5, life: [0.35, 0.7], size: [11, 5] });
          break;
      }
      // Sparks thrown off the blow, in the element's colours.
      t.emit({ count: Math.round(28 * m.k), palette: p.trail, from: { x: m.c.x - 6, y: m.c.y - 6, w: 12, h: 12 },
        speed: [120, 300], gravity: 300, drag: 0.4, life: [0.2, 0.4], size: [8, 2], streak: true });
      t.glow(m.rect, p.markColor, 0.45, 0.35, 1.15);
      t.ring(m.rect, p.markColor, 0.4, 1.15, 0.45, 4);
    },
    xSparks(t, c, count) {
      t.emit({ count, palette: p.trail, from: { x: c.x - 4, y: c.y - 4, w: 8, h: 8 },
        speed: [90, 220], gravity: 300, drag: 0.4, life: [0.15, 0.3], size: [6, 2], streak: true });
    },
    arrive(t, r) {
      // A burst of its element outward from where it gathered.
      const c = centre(r);
      t.glow(r, p.head, 0.8, 0.45, 1.25);
      t.ring(r, p.markColor, 0.3, 1.3, 0.45, 5);
      t.emit({ count: 34, palette: p.trail, from: { x: c.x - 8, y: c.y - 8, w: 16, h: 16 }, speed: [120, 300],
        gravity: 0, drag: 0.3, life: [0.25, 0.5], size: [10, 3] });
    },
    shield(t, r) {
      const color = t.style.palette[1];
      t.ring(r, color, 1.35, 0.95, 0.35, 5);
      t.later(0.18, () => t.ring(r, 0xffffff, 1.0, 1.05, 0.6, 3));
      t.emit({ count: 18, palette: [0xffffff, color], from: r, at: "ring", speed: [40, 80], gravity: 0,
        drag: 0.9, life: [0.4, 0.6], size: [8, 3] });
    },
    heal(t, r, k) {
      // Light rising off the card — gentle, and in the caster's colour over a
      // living green, so a DAWN heal is gold and a LEAF one is leaf.
      const kk = Math.max(0.7, Math.min(2.2, k));
      t.emit({ count: Math.round(28 * kk), palette: [0xffffff, 0xe4ffd2, t.style.palette[2]], from: r, at: "bottom",
        dir: [-105, -75], speed: [50, 140], gravity: -90, drag: 0.5, life: [0.8, 1.4], size: [11, 3] });
      t.glow(r, 0xc8ffb0, 0.45, 0.8);
    },
    wall(t, r) {
      // A curtain rising off the whole row, in the wall's element.
      const el = t.style;
      t.band(r, el.palette[2], 0.9);
      t.emit({ count: Math.round(r.w / 5), palette: el.palette, from: r, at: "bottom", dir: [-100, -80],
        speed: [140, 380], gravity: el.gravity > 0 ? 200 : -100, drag: 0.3, life: [0.4, 0.9], size: [12, 3],
        streak: el.streak });
    },
    field(t, r) {
      // The weather changes: three waves across the whole board.
      const el = t.style;
      t.band(r, el.palette[2], 1.2);
      const rain = el.gravity > 500; // AQUA, BORE: it comes down
      for (let w = 0; w < 3; w++)
        t.later(w * 0.25, () => t.emit({
          count: 70, palette: el.palette, from: r,
          dir: rain ? [80, 100] : el.gravity < 0 ? [-110, -70] : [0, 360],
          speed: rain ? [300, 520] : [30, 120], gravity: rain ? 600 : el.gravity * 0.3, drag: 0.4,
          life: [0.6, 1.2], size: rain ? [9, 3] : [10, 3], streak: rain || el.streak, swirl: el.swirl,
        }));
    },
    move(t, from, to) {
      // Dissolve where it stood, gather where it lands, a thread between.
      const el = t.style;
      t.emit({ count: 26, palette: el.palette, from, speed: [60, 160], gravity: 0, drag: 0.3,
        life: [0.3, 0.6], size: [10, 3] });
      const a = centre(from), b = centre(to);
      t.draw(0.5, (g, k) => {
        g.moveTo(a.x, a.y).lineTo(a.x + (b.x - a.x) * Math.min(1, k * 2), a.y + (b.y - a.y) * Math.min(1, k * 2))
          .stroke({ width: 3, color: el.palette[1], alpha: 0.7 * (1 - k) });
      });
      t.later(0.18, () => t.emit({ count: 30, palette: el.palette, from: to, at: "ring", speed: [120, 200],
        gravity: 0, drag: 0.9, life: [0.3, 0.5], size: [10, 3] }));
    },
    trapSet(t, r) {
      // Sinking into the square: gathered in, then a ring that closes.
      const el = t.style;
      t.emit({ count: 22, palette: [0xffffff, el.palette[1], el.palette[2]], from: r, at: "ring",
        speed: [100, 170], gravity: 0, drag: 0.9, life: [0.3, 0.5], size: [9, 3] });
      t.later(0.3, () => t.ring(r, el.palette[2], 0.9, 0.2, 0.4, 3));
    },
    pulse(t, r) {
      const el = t.style;
      t.band(r, el.palette[1], 0.8);
      t.emit({ count: 40, palette: el.palette, from: r, speed: [80, 200], gravity: 0, drag: 0.3,
        life: [0.4, 0.8], size: [10, 3] });
    },
  };
}

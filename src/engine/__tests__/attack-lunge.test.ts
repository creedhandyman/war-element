import { describe, expect, it } from "vitest";
import { easeIn, lungeAt } from "../../ui/vfx/use-spell-impacts";

// THE MELEE LUNGE, drawn by hand. It was a Web Animation — compositor-only,
// which gave the token a GPU layer of its own for every melee turn and took it
// away after. Set per frame it is only paint; this keeps the path the Web
// Animation had (matched in Edge to 0.0001px over its whole run).
describe("the melee lunge keeps the path it had", () => {
  const strike = 450 / (450 + 220); // ATTACK_MS, plus the return

  it("is timed by CSS ease-in over the whole run", () => {
    expect(easeIn(0)).toBe(0);
    expect(easeIn(1)).toBe(1);
    expect(easeIn(0.5)).toBeCloseTo(0.3154, 3); // cubic-bezier(0.42, 0, 1, 1)
    let last = 0;
    for (let u = 0.01; u <= 1; u += 0.01) {
      expect(easeIn(u)).toBeGreaterThanOrEqual(last);
      last = easeIn(u);
    }
  });

  it("starts and ends home, draws back a tenth, and reaches all the way", () => {
    // The moment the eased run reaches `p` — where a keyframe sits.
    const when = (p: number) => {
      let lo = 0, hi = 1;
      for (let i = 0; i < 60; i++) {
        const m = (lo + hi) / 2;
        if (easeIn(m) < p) lo = m;
        else hi = m;
      }
      return (lo + hi) / 2;
    };
    expect(lungeAt(0, strike)).toBe(0);
    expect(lungeAt(1, strike)).toBe(0);
    expect(lungeAt(when(strike * 0.4), strike)).toBeCloseTo(-0.1, 5);
    expect(lungeAt(when(strike), strike)).toBeCloseTo(1, 5);
    for (let u = 0; u <= 1; u += 0.001) {
      expect(lungeAt(u, strike)).toBeGreaterThanOrEqual(-0.1 - 1e-9);
      expect(lungeAt(u, strike)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

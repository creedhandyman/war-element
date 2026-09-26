import { describe, expect, it } from "vitest";
import type { SpellFx } from "../../ui/vfx/spell-fx";
import { budgeted } from "../../ui/vfx/use-spell-impacts";

type Tick = Extract<SpellFx, { kind: "tick" }>;
const tick = (t: Tick["tick"], col: number, delay = 0): Tick =>
  ({ kind: "tick", tick: t, at: { row: 0, col }, element: "LEAF", delay, strength: 1, status: t === "bite" ? "BURN" : undefined });

describe("a crowded round's end, made affordable", () => {
  it("keeps every bite and the drains, and sheds the flavour first", () => {
    const fx: SpellFx[] = [
      { kind: "drain", from: { row: 1, col: 1 }, to: { row: 2, col: 1 }, element: "DUSK", delay: 0.3 },
      ...Array.from({ length: 6 }, (_, i) => tick("bite", i)),
      ...Array.from({ length: 6 }, (_, i) => tick("zephyr", i, 0.3)),
      ...Array.from({ length: 6 }, (_, i) => tick("firstLight", i, 0.3)),
      ...Array.from({ length: 4 }, (_, i) => tick("regen", i, 0.3)),
      ...Array.from({ length: 2 }, (_, i) => tick("expire", i, 0.6)),
      { kind: "hit", at: { row: 3, col: 0 }, from: { row: 2, col: 0 }, element: "PYRO", strength: 1, melee: true, special: false },
    ];
    const out = budgeted(fx);
    const ticks = out.filter((f): f is Tick => f.kind === "tick");
    expect(ticks.filter((f) => f.tick === "bite")).toHaveLength(6); // what happened is never dropped
    expect(ticks).toHaveLength(14);
    // The endings and the heals outrank the auras.
    expect(ticks.filter((f) => f.tick === "expire")).toHaveLength(2);
    expect(ticks.filter((f) => f.tick === "regen")).toHaveLength(4);
    expect(ticks.filter((f) => f.tick === "zephyr" || f.tick === "firstLight")).toHaveLength(2);
    expect(out.filter((f) => f.kind === "drain")).toHaveLength(1);
    expect(out.find((f) => f.kind === "hit")).toEqual(fx.at(-1)); // not a tick: untouched
  });

  it("spreads the ticks a beat apart, never more than 0.3s later than Cleanup's own order", () => {
    const fx = Array.from({ length: 12 }, (_, i) => tick("bite", i));
    const out = budgeted(fx) as Tick[];
    expect(out).toHaveLength(12); // under the budget: nothing shed
    const extra = out.map((f, i) => +(f.delay - fx[i].delay).toFixed(3));
    expect(extra[0]).toBe(0);
    for (let i = 1; i < extra.length; i++) expect(extra[i]).toBeGreaterThanOrEqual(extra[i - 1]);
    expect(Math.max(...extra)).toBeLessThanOrEqual(0.3);
  });
});

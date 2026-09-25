import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import type { GameState, PlayerId } from "../types";
import { spellEffects, trapsSprung, type SpellFx } from "../../ui/vfx/spell-fx";
import { place, prepState } from "./helpers";

// What a spell LOOKS like is read off what it DID: the engine applies the cast,
// and every effect is derived from the change. So these cast real spells
// through applyIntent and check the effects the change produces — no table of
// per-spell looks exists to fall out of date with the rules.

/** Arm one spell for `who`, with magic to spare and priority. */
function armed(spellId: string, who: PlayerId = "P1"): GameState {
  const s = prepState(1, who);
  s.players[who].magicPool = 20;
  s.players[who].spellbook = [{ defId: spellId, used: false }];
  return s;
}
const kinds = (fx: SpellFx[]) => fx.map((f) => f.kind).sort();
const at = (f: SpellFx) => ("at" in f ? `${f.at.row},${f.at.col}` : "");

describe("damage (the effect that already existed)", () => {
  it("a damage spell is an impact on the square it hit, in its element", () => {
    const s = armed("pyro_spark", "P2");
    const t = place(s, "leaf_greegon", "P1", 1, 2, { curHp: 9, curShields: 0 });
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "pyro_spark", targetId: t.instanceId });
    const impact = spellEffects(s, after, "P1").find((f) => f.kind === "impact")!;
    expect(impact).toMatchObject({ kind: "impact", at: { row: 1, col: 2 }, element: "PYRO" });
  });

  it("a lethal cast still has its impact — the card is gone, not unhit", () => {
    const s = armed("pyro_spark", "P2");
    const t = place(s, "leaf_greegon", "P1", 1, 2, { curHp: 2, curShields: 0 });
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "pyro_spark", targetId: t.instanceId });
    expect(spellEffects(s, after, "P1").filter((f) => f.kind === "impact").map(at)).toEqual(["1,2"]);
  });

  it("damage with no spell spent draws nothing", () => {
    const s = armed("pyro_spark", "P2");
    const t = place(s, "leaf_greegon", "P1", 1, 2, { curHp: 9 });
    const after = structuredClone(s);
    after.cards[t.instanceId].curHp -= 4;
    expect(spellEffects(s, after, "P1")).toEqual([]);
  });

  it("impact strength grows with the damage and is clamped", () => {
    const s = armed("pyro_spark", "P2");
    const t = place(s, "leaf_greegon", "P1", 1, 2, { curHp: 40 });
    const hit = (n: number) => {
      const a = structuredClone(s);
      a.players.P2.spellbook[0].used = true;
      a.cards[t.instanceId].curHp -= n;
      return (spellEffects(s, a, "P1").find((f) => f.kind === "impact") as { strength: number }).strength;
    };
    expect(hit(1)).toBe(0.7);
    expect(hit(30)).toBe(2.2);
  });
});

describe("every other spell", () => {
  it("shields: Fortify shields every BORE ally", () => {
    const s = armed("bore_fortify");
    place(s, "bore_smith", "P1", 3, 0);
    place(s, "bore_old_timer", "P1", 3, 2);
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "bore_fortify" });
    const fx = spellEffects(s, after, "P1");
    expect(fx.filter((f) => f.kind === "shield").map(at).sort()).toEqual(["3,0", "3,2"]);
  });

  it("heals: a wounded ally healed by Dawn's Grace gets a heal (and its shields)", () => {
    const s = armed("dawn_dawns_grace");
    const hurt = place(s, "dawn_ballista", "P1", 3, 1, { curHp: 2 });
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "dawn_dawns_grace" } as never);
    expect(after.cards[hurt.instanceId].curHp).toBeGreaterThan(2);
    const fx = spellEffects(s, after, "P1").filter((f) => at(f) === "3,1");
    expect(kinds(fx)).toEqual(expect.arrayContaining(["heal", "shield"]));
    expect(fx.find((f) => f.kind === "heal")).toMatchObject({ element: "DAWN" });
  });

  it("status: Frost Patch freezes the row — a FREEZE effect on each card in it", () => {
    const s = armed("aqua_frost_patch", "P2");
    place(s, "leaf_greegon", "P1", 2, 0);
    place(s, "leaf_greegon", "P1", 2, 2);
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "aqua_frost_patch", row: 2 });
    const fx = spellEffects(s, after, "P1").filter((f) => f.kind === "status");
    expect(fx.map(at).sort()).toEqual(["2,0", "2,2"]);
    expect(fx.every((f) => f.kind === "status" && f.status === "FREEZE")).toBe(true);
    // The freeze also drops their speed; the ice says that, so no debuff too.
    expect(spellEffects(s, after, "P1").some((f) => f.kind === "debuff")).toBe(false);
  });

  it("walls: Firewall draws along the row it was set on", () => {
    const s = armed("pyro_firewall");
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "pyro_firewall", row: 2 });
    expect(spellEffects(s, after, "P1")).toContainEqual({ kind: "wall", row: 2, element: "PYRO" });
  });

  it("fields: Lushfield changes the weather over the whole board", () => {
    const s = armed("leaf_lushfield");
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "leaf_lushfield" });
    expect(spellEffects(s, after, "P1")).toContainEqual({ kind: "field", element: "LEAF" });
  });

  it("your own trap is drawn sinking into its square", () => {
    const s = armed("pyro_ember_trap");
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "pyro_ember_trap", row: 2, col: 1 });
    expect(spellEffects(s, after, "P1")).toContainEqual({ kind: "trapSet", at: { row: 2, col: 1 }, element: "PYRO" });
  });

  it("an OPPONENT'S trap is never drawn where it went — hidden stays hidden", () => {
    const s = armed("pyro_ember_trap");
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "pyro_ember_trap", row: 2, col: 1 });
    const theirView = spellEffects(s, after, "P2");
    expect(theirView.some((f) => f.kind === "trapSet")).toBe(false);
    // Nothing that names a square at all: only the generic cast ripple.
    expect(theirView.every((f) => !("at" in f))).toBe(true);
  });

  it("moves: Rewire swaps two cards — each drawn leaving and arriving", () => {
    const s = armed("bolt_rewire");
    const a = place(s, "leaf_alpha", "P1", 3, 0);
    const b = place(s, "dusk_gool", "P1", 1, 2);
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "bolt_rewire", targetIds: [a.instanceId, b.instanceId] });
    const moves = spellEffects(s, after, "P1").filter((f) => f.kind === "move");
    expect(moves).toHaveLength(2);
    expect(moves).toContainEqual({ kind: "move", from: { row: 3, col: 0 }, to: { row: 1, col: 2 }, element: "BOLT" });
  });

  it("a spell that changes nothing on the board still ripples from its caster", () => {
    const s = armed("bolt_power_rebate");
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "bolt_power_rebate" });
    const fx = spellEffects(s, after, "P1");
    expect(fx).toHaveLength(1);
    expect(fx[0]).toMatchObject({ kind: "pulse", element: "BOLT" });
  });
});

describe("traps going off", () => {
  it("a trap that springs under a card bursts on its square", () => {
    const s = prepState(1);
    s.traps.push({ owner: "P1", element: "PYRO", pos: { row: 2, col: 1 } } as never);
    const after = structuredClone(s);
    after.traps = [];
    place(after, "leaf_greegon", "P2", 2, 1);
    expect(trapsSprung(s, after)).toEqual([{ kind: "trapSprung", at: { row: 2, col: 1 }, element: "PYRO" }]);
  });

  it("a trap that merely expires, with nothing on it, is not a spring", () => {
    const s = prepState(1);
    s.traps.push({ owner: "P1", element: "PYRO", pos: { row: 2, col: 1 } } as never);
    const after = structuredClone(s);
    after.traps = [];
    expect(trapsSprung(s, after)).toEqual([]);
  });
});

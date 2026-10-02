// WHO AN AURA REACHES (state.ts `hasAura`, `auraReach`). The board lights these
// up when an aura card lands (ui/aura-glow.ts), so they have to answer the same
// way the rules do — and a NEW aura passive has to be noticed, or its card lands
// dark. Owner, 2026-10-02: "Glow animation when a card with an aura shows up."
import { describe, expect, it } from "vitest";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import { describePassives } from "../../ui/card-text";
import { auraReach, hasAura } from "../state";
import type { CardInstance, GameState } from "../types";
import { bigPrepState, place } from "./helpers";

const ids = (cards: CardInstance[]) => cards.map((c) => c.instanceId).sort();
const reach = (s: GameState, holder: CardInstance) => {
  const r = auraReach(s, holder);
  return { allies: ids(r.allies), foes: ids(r.foes) };
};

describe("hasAura", () => {
  it("every card whose text labels a passive an Aura is one the board lights up", () => {
    // The label, not the word: "Aura — …", "Name — Aura: …", "Name — (Aura): …".
    // Angale's "Alluring Aura" is only a NAME, a when-hit thorns rather than
    // something it projects, and stays dark.
    const label = /^Aura —|\bAura:|\(Aura\)/;
    const missed = [...CARDS, ...TOKENS]
      .filter((d) => describePassives(d).some((line) => label.test(line)) && !hasAura(d))
      .map((d) => d.id);
    expect(missed, "add the passive to hasAura and auraReach in state.ts").toEqual([]);
  });

  it("is not every card: a plain body, and the rules a whole element or class shares, are not auras", () => {
    expect(hasAura(getDef("leaf_oak"))).toBe(false);
    expect(hasAura(getDef("bolt_hacker"))).toBe(false);
    expect(hasAura(getDef("gale_angale"))).toBe(false);
    expect(hasAura(getDef("bolt_rodd"))).toBe(true);
  });
});

describe("auraReach", () => {
  it("a stat aura reaches the allies it buffs: Rodd's adjacent BOLT allies", () => {
    const s = bigPrepState();
    const rodd = place(s, "bolt_rodd", "P1", 3, 2);
    const nextBolt = place(s, "bolt_hacker", "P1", 3, 3);
    const nextLeaf = place(s, "leaf_oak", "P1", 3, 1);
    place(s, "bolt_hacker", "P1", 4, 0); // BOLT, but not beside it
    place(s, "bolt_hacker", "P2", 2, 2); // beside it, but an opponent
    expect(reach(s, rodd)).toEqual({ allies: [nextBolt.instanceId], foes: [] });
    expect(ids(auraReach(s, rodd).allies)).not.toContain(nextLeaf.instanceId);
  });

  it("an element aura reaches every ally of that element, wherever it stands", () => {
    const s = bigPrepState();
    const efy = place(s, "leaf_efy", "P1", 4, 0);
    const far = place(s, "leaf_oak", "P1", 2, 4);
    place(s, "bolt_hacker", "P1", 4, 1);
    place(s, "leaf_oak", "P2", 0, 0);
    expect(reach(s, efy)).toEqual({ allies: [far.instanceId], foes: [] });
  });

  it("Totem Spirit reaches the whole side and nothing across it", () => {
    const s = bigPrepState();
    const totem = place(s, "gale_totem", "P1", 4, 2);
    const a = place(s, "leaf_oak", "P1", 4, 0);
    const b = place(s, "bolt_hacker", "P1", 2, 4);
    place(s, "leaf_oak", "P2", 0, 0);
    expect(reach(s, totem)).toEqual({ allies: ids([a, b]), foes: [] });
  });

  it("Purelight reaches DAWN allies only", () => {
    const s = bigPrepState();
    const halo = place(s, "dawn_halo", "P1", 4, 2);
    const dawn = place(s, "dawn_commander", "P1", 4, 0);
    place(s, "leaf_oak", "P1", 4, 4);
    expect(reach(s, halo)).toEqual({ allies: [dawn.instanceId], foes: [] });
  });

  it("Blinding Star reaches every opponent and no ally", () => {
    const s = bigPrepState();
    const nova = place(s, "dawn_supernova", "P1", 4, 2);
    place(s, "leaf_oak", "P1", 4, 0);
    const f1 = place(s, "leaf_oak", "P2", 0, 0);
    const f2 = place(s, "bolt_hacker", "P2", 1, 4);
    expect(reach(s, nova)).toEqual({ allies: [], foes: ids([f1, f2]) });
  });

  it("Intimidation reaches the opponents it actually weighs on: weaker in DMG", () => {
    const s = bigPrepState();
    const oakgre = place(s, "leaf_oakgre", "P1", 4, 2);
    const weak = place(s, "leaf_oak", "P2", 0, 0);
    const strong = place(s, "leaf_oak", "P2", 0, 4, { dmgBonus: 50 });
    const r = reach(s, oakgre);
    expect(r.foes).toContain(weak.instanceId);
    expect(r.foes).not.toContain(strong.instanceId);
  });
});

// Fields (Cost-6 board-wide terrain) — cast, element-scoped buffs, one-per-owner.

import { describe, expect, it } from "vitest";
import { resolveHit } from "../combat";
import { applyIntent } from "../phases";
import { canCastSpell, effectiveSpecialCost } from "../rules";
import { effectiveDmg, effectiveSp, fieldBonus, fieldEvasion } from "../state";
import { place, prepState, statusOf } from "./helpers";

function arm(s: ReturnType<typeof prepState>, ids: string[], magic = 12) {
  s.players.P1.spellbook = ids.map((defId) => ({ defId, used: false }));
  s.players.P1.magicPool = magic;
}

describe("Fields (Cost-6 terrain)", () => {
  it("casts a board-wide field and buffs only the caster's same-element allies", () => {
    const s = prepState();
    arm(s, ["bore_bedrock"]);
    const bore = place(s, "bore_crock", "P1", 2, 0);
    const leaf = place(s, "leaf_alpha", "P1", 2, 1); // wrong element
    const foeBore = place(s, "bore_crock", "P2", 1, 0); // enemy
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "bore_bedrock" });
    expect(n.fields.length).toBe(1);
    expect(n.fields[0].element).toBe("BORE");
    expect(fieldBonus(n, n.cards[bore.instanceId], "block")).toBe(1);
    expect(fieldBonus(n, n.cards[bore.instanceId], "reflect")).toBe(1);
    expect(fieldBonus(n, n.cards[leaf.instanceId], "block")).toBe(0); // wrong element
    expect(fieldBonus(n, n.cards[foeBore.instanceId], "block")).toBe(0); // enemy side
  });

  it("Heatwave adds +2 DMG and Jetstream +3 SP to their element allies", () => {
    const s1 = prepState();
    arm(s1, ["pyro_heatwave"]);
    const pyro = place(s1, "pyro_bbq", "P1", 2, 0);
    const before = effectiveDmg(s1, s1.cards[pyro.instanceId]);
    const n1 = applyIntent(s1, { type: "CAST_SPELL", player: "P1", spellId: "pyro_heatwave" });
    expect(effectiveDmg(n1, n1.cards[pyro.instanceId]) - before).toBe(2);

    const s2 = prepState();
    arm(s2, ["gale_jetstream"]);
    const gale = place(s2, "gale_duster", "P1", 2, 0);
    const spBefore = effectiveSp(s2, s2.cards[gale.instanceId]);
    const n2 = applyIntent(s2, { type: "CAST_SPELL", player: "P1", spellId: "gale_jetstream" });
    expect(effectiveSp(n2, n2.cards[gale.instanceId]) - spBefore).toBe(3);
  });

  it("Bedrock's BLOCK 1 softens a hit on a BORE ally", () => {
    const s = prepState();
    arm(s, ["bore_bedrock"]);
    const ally = place(s, "bore_crock", "P1", 2, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const foe = place(s, "leaf_alpha", "P2", 1, 0);
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "bore_bedrock" });
    resolveHit(n, n.cards[foe.instanceId], n.cards[ally.instanceId], { kind: "special", dmg: 5, hits: 1, pen: false, crit: false });
    expect(n.cards[ally.instanceId].curHp).toBe(16); // 5 − BLOCK 1 = 4
  });

  it("allows only one field per owner at a time", () => {
    const s = prepState();
    arm(s, ["bore_bedrock", "gale_jetstream"]);
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "bore_bedrock" });
    expect(canCastSpell(n, "P1", "gale_jetstream", {}).ok).toBe(false);
  });

  it("Nightfall grants EVASION to DUSK allies only", () => {
    const s = prepState();
    arm(s, ["dusk_nightfall"]);
    const dusk = place(s, "dusk_vamp", "P1", 2, 0);
    const leaf = place(s, "leaf_alpha", "P1", 2, 1);
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "dusk_nightfall" });
    expect(fieldEvasion(n, n.cards[dusk.instanceId])).toBe(true);
    expect(fieldEvasion(n, n.cards[leaf.instanceId])).toBe(false);
  });
});

describe("Total Network Control (BOLT Cost-10 ultimate)", () => {
  it("MUTEs every opponent 2 rounds and permanently discounts BOLT Specials (min 1)", () => {
    const s = prepState();
    s.players.P1.spellbook = [{ defId: "bolt_total_network_control", used: false }];
    s.players.P1.magicPool = 10;
    const foe1 = place(s, "leaf_alpha", "P2", 1, 0);
    const foe2 = place(s, "bore_crock", "P2", 1, 1);
    const bolt = place(s, "bolt_thunder", "P1", 2, 0); // BOLT card
    const leaf = place(s, "leaf_alpha", "P1", 2, 1); // non-BOLT, unaffected
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "bolt_total_network_control" });
    expect(statusOf(n.cards[foe1.instanceId], "MUTED")).toBeTruthy();
    expect(statusOf(n.cards[foe2.instanceId], "MUTED")).toBeTruthy();
    expect(n.players.P1.boltDiscount).toBe(1);
    expect(effectiveSpecialCost(n, n.cards[bolt.instanceId], 3)).toBe(2); // −1
    expect(effectiveSpecialCost(n, n.cards[bolt.instanceId], 1)).toBe(1); // floors at 1
    expect(effectiveSpecialCost(n, n.cards[leaf.instanceId], 3)).toBe(3); // non-BOLT untouched
  });
});

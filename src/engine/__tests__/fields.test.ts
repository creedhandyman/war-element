// Fields (Cost-6 board-wide terrain) — cast, element-scoped buffs, one-per-owner.

import { describe, expect, it } from "vitest";
import { applyStatus, basicAttack, resolveHit } from "../combat";
import { advance, applyIntent } from "../phases";
import { canCastSpell, effectiveSpecialCost } from "../rules";
import { effectiveSp, fieldBonus, fieldEvasion } from "../state";
import { atCleanup, place, prepState, statusOf } from "./helpers";

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

  it("Jetstream adds +3 SP to its element allies", () => {
    const s = prepState();
    arm(s, ["gale_jetstream"]);
    const gale = place(s, "gale_duster", "P1", 2, 0);
    const spBefore = effectiveSp(s, s.cards[gale.instanceId]);
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "gale_jetstream" });
    expect(effectiveSp(n, n.cards[gale.instanceId]) - spBefore).toBe(3);
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

  it("Heatwave freezes BURN on the caster's enemies (it stops ticking down)", () => {
    const run = (withField: boolean) => {
      const s = prepState();
      const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 40, maxHp: 40 });
      applyStatus(s, foe, "BURN", 2, 1, "PYRO");
      if (withField) {
        s.fields.push({ owner: "P1", spellId: "pyro_heatwave", element: "PYRO", roundsLeft: 3, burnPersists: true });
      }
      const next = advance(atCleanup(s));
      return statusOf(next.cards[foe.instanceId], "BURN")?.duration ?? 0;
    };
    expect(run(false)).toBe(1); // normally ticks 2 → 1
    expect(run(true)).toBe(2); // Heatwave: frozen at 2
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

describe("Power Grid (BOLT field)", () => {
  it("discounts BOLT Specials by 1 (min 1) while up; non-BOLT untouched", () => {
    const s = prepState();
    s.players.P1.spellbook = [{ defId: "bolt_power_grid", used: false }];
    s.players.P1.magicPool = 6;
    const bolt = place(s, "bolt_thunder", "P1", 2, 0);
    const leaf = place(s, "leaf_alpha", "P1", 2, 1);
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "bolt_power_grid" });
    expect(effectiveSpecialCost(n, n.cards[bolt.instanceId], 3)).toBe(2); // −1
    expect(effectiveSpecialCost(n, n.cards[bolt.instanceId], 1)).toBe(1); // floors at 1
    expect(effectiveSpecialCost(n, n.cards[leaf.instanceId], 3)).toBe(3); // non-BOLT
  });

  it("boosts Electrify to +2 DMG vs a statused foe", () => {
    const run = (withField: boolean) => {
      const s = prepState();
      const bolt = place(s, "bolt_kore", "P1", 2, 0); // BOLT, no crit/evasion
      const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
      applyStatus(s, foe, "WEAKEN", 2, 0, "BOLT"); // foe is now "statused"
      if (withField) s.fields.push({ owner: "P1", spellId: "bolt_power_grid", element: "BOLT", roundsLeft: 3, electrify: 1 });
      basicAttack(s, bolt.instanceId, foe.instanceId);
      return 40 - s.cards[foe.instanceId].curHp;
    };
    expect(run(true) - run(false)).toBe(1); // +1 Electrify becomes +2
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

describe("Nightfall — DRAIN +1", () => {
  const arm = (id: string) => {
    const s = prepState();
    s.players.P1.spellbook = [{ defId: id, used: false }];
    s.players.P1.magicPool = 12;
    return s;
  };

  it("every DRAIN instance steals 1 extra max HP", () => {
    const s = arm("dusk_nightfall");
    const thief = place(s, "dusk_vamp", "P1", 2, 0); // DUSK, DRAIN keyword
    const prey = place(s, "leaf_greegon", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const before = { prey: prey.maxHp, thief: thief.maxHp };
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "dusk_nightfall" });
    basicAttack(n, thief.instanceId, prey.instanceId);
    // 1 from the keyword + 1 from the field.
    expect(before.prey - n.cards[prey.instanceId].maxHp).toBe(2);
    expect(n.cards[thief.instanceId].maxHp - before.thief).toBe(2);
  });

  it("without the field it is the plain 1", () => {
    const s = prepState();
    const thief = place(s, "dusk_vamp", "P1", 2, 0);
    const prey = place(s, "leaf_greegon", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const before = prey.maxHp;
    basicAttack(s, thief.instanceId, prey.instanceId);
    expect(before - s.cards[prey.instanceId].maxHp).toBe(1);
  });

  it("the ENEMY's Nightfall doesn't boost your drains", () => {
    // fieldBonus matches owner AND element; a field the opponent owns must not
    // leak into your steal.
    const s = prepState();
    s.fields.push({ owner: "P2", spellId: "dusk_nightfall", element: "DUSK", roundsLeft: 3, drainBonus: 1 });
    const thief = place(s, "dusk_vamp", "P1", 2, 0);
    const prey = place(s, "leaf_greegon", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const before = prey.maxHp;
    basicAttack(s, thief.instanceId, prey.instanceId);
    expect(before - s.cards[prey.instanceId].maxHp).toBe(1);
  });
});

describe("Jetstream — push +1", () => {
  it("a spell's knockback travels one space further", () => {
    const s = prepState();
    s.players.P1.spellbook = [
      { defId: "gale_jetstream", used: false },
      { defId: "gale_gust", used: false }, // 3 DMG + push 1
    ];
    s.players.P1.magicPool = 20;
    place(s, "gale_duster", "P1", 3, 0); // a GALE ally so the field has a home
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    let n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "gale_jetstream" });
    n = applyIntent(n, { type: "CAST_SPELL", player: "P1", spellId: "gale_gust", targetId: foe.instanceId });
    // P2 is blown back toward row 0: 1 printed + 1 from the field = 2 rows.
    expect(n.cards[foe.instanceId].pos!.row).toBe(0);
  });

  it("without the field the same push moves it one row", () => {
    const s = prepState();
    s.players.P1.spellbook = [{ defId: "gale_gust", used: false }];
    s.players.P1.magicPool = 20;
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "gale_gust", targetId: foe.instanceId });
    expect(n.cards[foe.instanceId].pos!.row).toBe(1);
  });

  it("the bonus follows the PUSHER, not the card being pushed", () => {
    // pushBack takes the victim, so reading the field off that card would credit
    // the wrong side entirely — here the victim's owner has the field and must
    // NOT get a longer shove out of it.
    const s = prepState();
    s.players.P1.spellbook = [{ defId: "gale_gust", used: false }];
    s.players.P1.magicPool = 20;
    s.fields.push({ owner: "P2", spellId: "gale_jetstream", element: "GALE", roundsLeft: 3, push: 1 });
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "gale_gust", targetId: foe.instanceId });
    expect(n.cards[foe.instanceId].pos!.row).toBe(1); // still just the printed 1
  });
});

describe("Lushfield — BLEED / ROOT last +1 round", () => {
  const armLush = () => {
    const s = prepState();
    s.players.P1.spellbook = [{ defId: "leaf_lushfield", used: false }];
    s.players.P1.magicPool = 12;
    place(s, "leaf_greegon", "P1", 3, 0); // a LEAF ally so the field has a home
    return s;
  };

  it("a ROOT the owner applies lands with an extra round", () => {
    const s = armLush();
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40 });
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "leaf_lushfield" });
    applyStatus(n, n.cards[foe.instanceId], "ROOT", 2, 0, "LEAF");
    expect(statusOf(n.cards[foe.instanceId], "ROOT")?.duration).toBe(3);
  });

  it("BLEED too, and from ANY source — this rides applyStatus, not one card", () => {
    // Basics, Specials, spells, walls and round-ticks all funnel through
    // applyStatus, so covering it there covers every source at once.
    const s = armLush();
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40 });
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "leaf_lushfield" });
    applyStatus(n, n.cards[foe.instanceId], "BLEED", 2, 1, "LEAF");
    expect(statusOf(n.cards[foe.instanceId], "BLEED")?.duration).toBe(3);
  });

  it("other statuses are untouched", () => {
    const s = armLush();
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40 });
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "leaf_lushfield" });
    applyStatus(n, n.cards[foe.instanceId], "BURN", 2, 1, "PYRO");
    applyStatus(n, n.cards[foe.instanceId], "FREEZE", 2, 0, "AQUA");
    expect(statusOf(n.cards[foe.instanceId], "BURN")?.duration).toBe(2);
    expect(statusOf(n.cards[foe.instanceId], "FREEZE")?.duration).toBe(2);
  });

  it("it does NOT lengthen what the enemy puts on the field owner's own cards", () => {
    // The whole reason the lookup skips a field whose owner matches the victim:
    // otherwise casting Lushfield would extend the ROOTs being used against you.
    const s = armLush();
    const mine = place(s, "leaf_greegon", "P1", 2, 0, { curHp: 40, maxHp: 40 });
    const n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "leaf_lushfield" });
    applyStatus(n, n.cards[mine.instanceId], "ROOT", 2, 0, "DUSK");
    expect(statusOf(n.cards[mine.instanceId], "ROOT")?.duration).toBe(2);
  });

  it("without the field the same ROOT is the plain duration", () => {
    const s = prepState();
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40 });
    applyStatus(s, s.cards[foe.instanceId], "ROOT", 2, 0, "LEAF");
    expect(statusOf(s.cards[foe.instanceId], "ROOT")?.duration).toBe(2);
  });

  it("the longer ROOT really survives an extra Cleanup", () => {
    // Duration is only meaningful if it outlasts the tick — 2r would expire
    // after two cleanups, 3r has to still be there.
    const s = armLush();
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 400, maxHp: 400 });
    let n = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "leaf_lushfield" });
    applyStatus(n, n.cards[foe.instanceId], "ROOT", 2, 0, "LEAF");
    n = advance(atCleanup(n));
    n = advance(atCleanup(n));
    expect(statusOf(n.cards[foe.instanceId], "ROOT")?.duration).toBe(1); // still pinned
  });
});

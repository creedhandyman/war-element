// Fields (Cost-6 board-wide terrain) — cast, element-scoped buffs, one-per-owner.

import { describe, expect, it } from "vitest";
import { applyStatus, basicAttack, resolveHit } from "../combat";
import { advance, applyIntent } from "../phases";
import { canCastSpell, canTarget, effectiveSpecialCost, validTargets } from "../rules";
import { effectiveSp, fieldBonus, fieldEvasion } from "../state";
import { atCleanup, place, prepState, seedForCoins, statusOf } from "./helpers";
import type { GameState } from "../types";

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

describe("Blazing Sun — cannot miss, sees STEALTH", () => {
  const armSun = (dawnCard = "dawn_beam") => {
    const s = prepState();
    s.players.P1.spellbook = [{ defId: "dawn_blazing_sun", used: false }];
    s.players.P1.magicPool = 12;
    const me = place(s, dawnCard, "P1", 2, 1, { autoMode: "manual" });
    return { s, me };
  };
  const light = (st: ReturnType<typeof armSun>["s"]) =>
    applyIntent(st, { type: "CAST_SPELL", player: "P1", spellId: "dawn_blazing_sun" });

  it("BLIND no longer costs it hits", () => {
    // Every coin seeded to FAIL: without the field a blinded basic whiffs each hit.
    const { s, me } = armSun();
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 400, maxHp: 400, curShields: 0 });
    applyStatus(s, s.cards[me.instanceId], "BLIND", 3, 0, "DAWN");
    s.rngState = seedForCoins(false, false, false, false);
    const n = light(s);
    basicAttack(n, me.instanceId, foe.instanceId);
    expect(400 - n.cards[foe.instanceId].curHp).toBeGreaterThan(0);
  });

  it("EVASION no longer dodges it", () => {
    const { s, me } = armSun();
    const dodger = place(s, "gale_tumbleweed", "P2", 1, 1, { curHp: 400, maxHp: 400, curShields: 0 });
    s.rngState = seedForCoins(true, true, true, true); // every dodge roll would succeed
    const n = light(s);
    basicAttack(n, me.instanceId, dodger.instanceId);
    expect(400 - n.cards[dodger.instanceId].curHp).toBeGreaterThan(0);
  });

  it("without the field that same evasive target does dodge", () => {
    // Guards the test above from passing for the wrong reason.
    const { s, me } = armSun();
    const dodger = place(s, "gale_tumbleweed", "P2", 1, 1, { curHp: 400, maxHp: 400, curShields: 0 });
    s.rngState = seedForCoins(true, true, true, true);
    basicAttack(s, me.instanceId, dodger.instanceId); // no cast
    expect(400 - s.cards[dodger.instanceId].curHp).toBe(0);
  });

  it("a cloaked card becomes targetable", () => {
    const { s, me } = armSun();
    const sneak = place(s, "leaf_darth", "P2", 1, 1); // STEALTH until it attacks
    expect(canTarget(s, s.cards[me.instanceId], s.cards[sneak.instanceId])).toBe(false);
    const n = light(s);
    expect(canTarget(n, n.cards[me.instanceId], n.cards[sneak.instanceId])).toBe(true);
    expect(validTargets(n, me.instanceId).map((t) => t.instanceId)).toContain(sneak.instanceId);
  });

  it("it reveals for DAWN only — a non-DAWN ally still can't see the cloak", () => {
    // Element-matched like every other field grant: the buff is "your DAWN
    // allies", not "your whole side".
    const { s } = armSun();
    const other = place(s, "leaf_greegon", "P1", 2, 0, { autoMode: "manual" });
    const sneak = place(s, "leaf_darth", "P2", 1, 1);
    const n = light(s);
    expect(canTarget(n, n.cards[other.instanceId], n.cards[sneak.instanceId])).toBe(false);
  });

  it("the ENEMY's Blazing Sun doesn't reveal cloaks to you", () => {
    const s = prepState();
    s.fields.push({ owner: "P2", spellId: "dawn_blazing_sun", element: "DAWN", roundsLeft: 3, seeStealth: true, neverMiss: true });
    const me = place(s, "dawn_beam", "P1", 2, 1, { autoMode: "manual" });
    const sneak = place(s, "leaf_darth", "P2", 1, 1);
    expect(canTarget(s, s.cards[me.instanceId], s.cards[sneak.instanceId])).toBe(false);
  });
});

describe("Downpour — the Flow re-pick", () => {
  /** A round-1 state with Downpour up for P1 and two AQUA allies. */
  const armed = (humans: ("P1" | "P2")[] = ["P1"]) => {
    const s = prepState();
    s.humans = humans;
    s.fields.push({ owner: "P1", spellId: "aqua_downpour", element: "AQUA", roundsLeft: 3, shield: 2, flowRepick: true });
    const a = place(s, "aqua_subcool", "P1", 3, 0);
    const b = place(s, "aqua_owlette", "P1", 3, 1);
    place(s, "dusk_gool", "P2", 0, 0);
    return { s, a, b };
  };
  /** Run the round machinery from Cleanup round into the next round's Prep. */
  const intoNextRound = (g: GameState) => {
    let n = advance(atCleanup(g)); // cleanup -> draw
    for (let i = 0; i < 4 && n.phase !== "prep"; i++) n = advance(n);
    return n;
  };

  it("an AI side re-picks by itself, every round, with no prompt", () => {
    const { s, a } = armed([]); // nobody human — P1 is AI
    const n = intoNextRound(s);
    expect(n.pendingFlow).toBeNull(); // never blocks an AI
    // SubCool is a MAGE, so aiFlowChoice falls through to water (+2 DMG) —
    // not the ice a Tank/Support would take.
    expect(n.cards[a.instanceId].dmgBonusRound).toBe(2);
  });

  it("a human side gets ONE prompt flagged for the whole element", () => {
    const { s, a, b } = armed();
    const n = intoNextRound(s);
    expect(n.pendingFlow).toBeTruthy();
    expect(n.pendingFlowAll).toBe(true);
    // Nothing applied until the player actually chooses.
    expect(n.cards[a.instanceId].spBonusRound).toBe(0);
    expect(n.cards[b.instanceId].spBonusRound).toBe(0);
  });

  it("one pick lands on EVERY AQUA ally, not just the prompted card", () => {
    const { s, a, b } = armed();
    let n = intoNextRound(s);
    n = applyIntent(n, { type: "FLOW_CHANGE", player: "P1", instanceId: n.pendingFlow!, mode: "steam" });
    expect(n.cards[a.instanceId].spBonusRound).toBe(4);
    expect(n.cards[b.instanceId].spBonusRound).toBe(4);
    expect(n.pendingFlow).toBeNull();
    expect(n.pendingFlowAll).toBe(false);
  });

  it("it comes back the NEXT round too — that is the whole point", () => {
    // Flow buffs are round-scoped and wiped in Cleanup, so the re-pick has to
    // reopen at the top of each round or the field does nothing after round 1.
    const { s, a } = armed();
    let n = intoNextRound(s);
    n = applyIntent(n, { type: "FLOW_CHANGE", player: "P1", instanceId: n.pendingFlow!, mode: "steam" });
    expect(n.cards[a.instanceId].spBonusRound).toBe(4);
    n = intoNextRound(n);
    expect(n.cards[a.instanceId].spBonusRound).toBe(0); // last round's pick expired
    expect(n.pendingFlowAll).toBe(true); // ...and a fresh pick is offered
  });

  it("no field, no prompt", () => {
    const s = prepState();
    place(s, "aqua_subcool", "P1", 3, 0);
    place(s, "dusk_gool", "P2", 0, 0);
    let n = advance(atCleanup(s));
    for (let i = 0; i < 4 && n.phase !== "prep"; i++) n = advance(n);
    expect(n.pendingFlow).toBeNull();
  });

  it("a Downpour with no AQUA allies left doesn't hang the round on a prompt", () => {
    const s = prepState();
    s.humans = ["P1"];
    s.fields.push({ owner: "P1", spellId: "aqua_downpour", element: "AQUA", roundsLeft: 3, shield: 2, flowRepick: true });
    place(s, "leaf_greegon", "P1", 3, 0); // not AQUA
    place(s, "dusk_gool", "P2", 0, 0);
    let n = advance(atCleanup(s));
    for (let i = 0; i < 4 && n.phase !== "prep"; i++) n = advance(n);
    expect(n.pendingFlow).toBeNull();
  });
});

describe("Nightfall — EVASION covers the FIRST hit each round only", () => {
  const armed = () => {
    const s = prepState();
    s.fields.push({ owner: "P1", spellId: "dusk_nightfall", element: "DUSK", roundsLeft: 3, evasion: true, drainBonus: 1 });
    const me = place(s, "dusk_gool", "P1", 2, 0, { curHp: 400, maxHp: 400, curShields: 0 });
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { autoMode: "manual" });
    return { s, me, foe };
  };

  it("it covers the first HIT, not the first attack — the rest of the volley lands", () => {
    // Alpha is 1x4 and stands in a mid row, so King of the Hill makes it 2x4 = 8.
    // One hit is dodged; the other three land for 6. A cover that stopped the
    // whole VOLLEY would read 400 here, which is the mistake worth pinning.
    const { s, me, foe } = armed();
    s.rngState = seedForCoins(true, true, true, true); // every dodge roll would succeed
    basicAttack(s, foe.instanceId, me.instanceId);
    expect(s.cards[me.instanceId].curHp).toBe(394); // 8 − 2 for the one dodged hit
    expect(s.cards[me.instanceId].fieldEvasionUsed).toBe(true);
    basicAttack(s, foe.instanceId, me.instanceId);
    // Same round, cover spent: the full volley lands despite the seed. The
    // attacker is LEAF Alpha, so its Overgrowth aura now BLEEDs the target on
    // the first volley and cuts +2/hit into it on this one — 4 hits × (2+2) =
    // 16, not 8. What this test PINS is that the cover stopped one hit, not the
    // whole volley: 394 → 378 proves the cover is spent either way.
    expect(s.cards[me.instanceId].curHp).toBe(374);
  });

  it("a failed roll still spends it — it covers the hit, it isn't a re-roll", () => {
    const { s, me, foe } = armed();
    s.rngState = seedForCoins(false, false, false, false); // the dodge fails
    basicAttack(s, foe.instanceId, me.instanceId);
    expect(s.cards[me.instanceId].curHp).toBeLessThan(400); // it landed
    expect(s.cards[me.instanceId].fieldEvasionUsed).toBe(true); // and the cover is gone
  });

  it("the cover comes back next round", () => {
    const { s, me, foe } = armed();
    s.rngState = seedForCoins(true, true, true, true);
    basicAttack(s, foe.instanceId, me.instanceId);
    expect(s.cards[me.instanceId].fieldEvasionUsed).toBe(true);
    const next = advance(atCleanup(s));
    expect(next.cards[me.instanceId].fieldEvasionUsed).toBe(false);
  });

  it("a card with STANDING evasion doesn't burn the field's cover", () => {
    // Tumbleweed dodges on its own every hit; spending Nightfall's single cover
    // on it would quietly waste the field.
    const s = prepState();
    s.fields.push({ owner: "P1", spellId: "dusk_nightfall", element: "DUSK", roundsLeft: 3, evasion: true });
    const weed = place(s, "gale_tumbleweed", "P1", 2, 0, { curHp: 400, maxHp: 400, curShields: 0 });
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { autoMode: "manual" });
    s.rngState = seedForCoins(true, true, true, true);
    basicAttack(s, foe.instanceId, weed.instanceId);
    expect(s.cards[weed.instanceId].fieldEvasionUsed).toBeFalsy();
  });
});

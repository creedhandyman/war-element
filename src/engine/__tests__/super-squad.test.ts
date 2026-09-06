// SUPER SQUAD — the tribe whose members level up.
//
// Fourteen cards across five elements share one passive: Level Up, which turns
// every kill into +1 on ONE stat, chosen at random. It is the first tribe in the
// set defined by a shared PASSIVE rather than by an aura holder standing on the
// board — Broodmother, Trinezer and the rest all need a specific card alive, and
// this one travels with the member.
//
// The roll is a d3 over DMG / max HP / SP, and the three-way split is the whole
// design: each of those is worth exactly one point of the stat budget
// (`dmg*hits + hp + shields*2 + sp`), so the roll decides WHICH stat grows and
// never how much the card gained. Shields are worth two, and folding them in
// would have made a quarter of the rolls silently worth double.
import { describe, expect, it } from "vitest";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import { basicAttack } from "../combat";
import { chanceProblems } from "../../data/void-tower";
import { bigPrepState, place } from "./helpers";
import type { CardDef, GameState } from "../types";

const TRIBE = "Super Squad";
const tribesOf = (d: CardDef): string[] =>
  d.tribe == null ? [] : Array.isArray(d.tribe) ? d.tribe : [d.tribe];
const members = () => [...CARDS, ...TOKENS].filter((d) => tribesOf(d).includes(TRIBE));

/** One kill by `id`, from a fixed seed. Returns what the killer gained. */
function killOnce(id: string, seed: number) {
  const s: GameState = bigPrepState(seed);
  const hero = place(s, id, "P1", 3, 2);
  const before = { dmg: hero.dmgBonus, maxHp: hero.maxHp, curHp: hero.curHp, sp: hero.spBonus };
  // Adjacent so a melee member reaches, 1 HP and no shields so any of them kills
  // in a single hit whatever its printed damage.
  const prey = place(s, "leaf_stickviper", "P2", 2, 2, { curHp: 1, maxHp: 1, curShields: 0 });
  basicAttack(s, hero.instanceId, prey.instanceId);
  const after = s.cards[hero.instanceId];
  return {
    dmg: after.dmgBonus - before.dmg,
    maxHp: after.maxHp - before.maxHp,
    curHp: after.curHp - before.curHp,
    sp: after.spBonus - before.sp,
    died: s.cards[prey.instanceId] === undefined || s.cards[prey.instanceId].curHp <= 0,
  };
}

describe("the Super Squad roster", () => {
  it("is the fourteen cards the tribe was created for", () => {
    expect(members().map((d) => d.id).sort()).toEqual([
      "aqua_rain",        // Cloudburst
      "bolt_shoksa",      // Dynamo
      "bolt_storm",       // Storm
      "bolt_stormcaller", // Stormcaller
      "bolt_thunder",     // Thunder
      "bolt_thundercat",  // ThunderCat
      "bolt_zagphu",      // Ricochet
      "bolt_zoez",        // Voltedge
      "gale_bluejay",     // Bluejay
      "leaf_fallow",      // Fallow
      "pyro_chopper",     // Chopper
      "pyro_dyna",        // Dyna
      "pyro_dynomight",   // Dynomight
      "pyro_firefly",     // FireFly
    ]);
  });

  it("keeps the tribes those cards already had", () => {
    // Added, never replaced: eight of the fourteen are Voltis, ARC, Avian,
    // Liquid or Forged Tech and stay eligible for those cards' auras.
    const kept: Record<string, string> = {
      pyro_dynomight: "Forged Tech", pyro_dyna: "Forged Tech", pyro_chopper: "Forged Tech",
      aqua_rain: "Liquid", gale_bluejay: "Avian", bolt_shoksa: "ARC", bolt_thunder: "Voltis",
    };
    for (const [id, old] of Object.entries(kept))
      expect(tribesOf(getDef(id)), id).toEqual([old, TRIBE]);
  });

  // The membership and the passive are one fact stored in two places, so this is
  // the guard against them drifting: a card added to the tribe without Level Up
  // reads as a Super Squad member and is not one, and a card given Level Up
  // without the tribe is one and does not read as it.
  it("membership and Level Up imply each other, both ways", () => {
    const withPassive = [...CARDS, ...TOKENS].filter((d) => d.onKill?.randomStat);
    expect(members().map((d) => d.id).sort()).toEqual(withPassive.map((d) => d.id).sort());
    for (const d of members()) {
      expect(d.onKill?.randomStat, `${d.id} levels up by 1`).toBe(1);
      expect(d.passiveNames?.onKill, `${d.id} names it`).toBe("Level Up");
    }
  });

  it("no member is a Void Tower boss — the roll would break the replay rule", () => {
    // Bosses must roll no dice. `chanceProblems` now lists this field, so the
    // day a member is promoted the build says so rather than the replay quietly
    // diverging; this pins the other half, that none is one today.
    for (const d of members()) {
      expect(d.boss ?? false, `${d.id} is a boss`).toBe(false);
      // `toContain`, not `toEqual`: Fallow already prints CRIT, which is its own
      // coin. The point is that the roll is DECLARED, not that it is the only one.
      expect(chanceProblems(d), `${d.id}`).toContain("onKill.randomStat (a roll)");
    }
  });
});

describe("Level Up", () => {
  it("raises exactly ONE stat, by exactly one, on every kill", () => {
    for (const d of members())
      for (let seed = 0; seed < 12; seed++) {
        const g = killOnce(d.id, seed * 31 + 7);
        expect(g.died, `${d.id} killed its prey`).toBe(true);
        const moved = [g.dmg, g.maxHp, g.sp].filter((n) => n !== 0);
        expect(moved, `${d.id} @${seed}: one stat, one point`).toEqual([1]);
      }
  });

  it("grows the body rather than wounding it — new max HP arrives filled", () => {
    // Through gainMaxHp, so the card is BIGGER, not carrying a fresh gap it has
    // to go and heal. Every paired-by-hand site in the engine had drifted out of
    // step on exactly this before that helper existed.
    let saw = 0;
    for (let seed = 0; seed < 60; seed++) {
      const g = killOnce("bolt_stormcaller", seed);
      if (g.maxHp > 0) { saw++; expect(g.curHp, "filled").toBe(g.maxHp); }
    }
    expect(saw, "the HP branch came up").toBeGreaterThan(0);
  });

  it("can land on any of the three, and does not favour one", () => {
    // The d3 is one roll branched three ways, not three rolls: three would
    // sometimes grant nothing and sometimes grant everything. 300 kills is
    // enough that a branch stuck at zero, or one taking half the rolls, shows.
    const tally = { dmg: 0, maxHp: 0, sp: 0 };
    for (let seed = 0; seed < 300; seed++) {
      const g = killOnce("bolt_stormcaller", seed);
      if (g.dmg) tally.dmg++;
      if (g.maxHp) tally.maxHp++;
      if (g.sp) tally.sp++;
    }
    expect(tally.dmg + tally.maxHp + tally.sp, "one per kill").toBe(300);
    for (const [k, n] of Object.entries(tally))
      expect(n, `${k} came up ${n}/300`).toBeGreaterThan(60);
  });

  it("stacks across kills, and replays identically from a seed", () => {
    const run = () => {
      const s = bigPrepState(9);
      const hero = place(s, "bolt_stormcaller", "P1", 3, 2);
      for (let i = 0; i < 9; i++) {
        const prey = place(s, "leaf_stickviper", "P2", 2, 2, { curHp: 1, maxHp: 1, curShields: 0 });
        basicAttack(s, hero.instanceId, prey.instanceId);
      }
      const h = s.cards[hero.instanceId];
      const base = getDef("bolt_stormcaller");
      return { dmg: h.dmgBonus, hp: h.maxHp - base.hp, sp: h.spBonus };
    };
    const a = run();
    expect(a.dmg + a.hp + a.sp, "nine kills, nine points").toBe(9);
    expect(run(), "same seed, same growth").toEqual(a);
  });
});

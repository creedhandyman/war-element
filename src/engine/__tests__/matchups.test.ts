// THE ELEMENT WHEEL (matchups.ts, owner 2026-10-08): one rule for every
// element — +25% DMG to the element it beats, +25% taken from the one that
// beats it. Replaced seven one-off matchups. BURN's heal penalty is a rule of
// the BURN status, and BORE's paralysis immunity is part of its aura.

import { describe, expect, it } from "vitest";
import { applyStatus, basicAttack, defeatCard, directDamage, shieldsBrokenBy, SPECIAL_HANDLERS } from "../combat";
import { advance, applyIntent } from "../phases";
import { boardCards, effectiveDmg, healCard } from "../state";
import { getDef } from "../../data/cards";
import { describePassives } from "../../ui/card-text";
import {
  BURN_HEAL_MULT,
  ELEMENT_BEATS,
  ELEMENT_MATCHUP,
  applyMatchupDamage,
  beatenBy,
} from "../matchups";
import type { Element } from "../types";
import { atCleanup, place, prepState, statusOf } from "./helpers";

const EIGHT: Element[] = ["PYRO", "LEAF", "BORE", "BOLT", "GALE", "AQUA", "DAWN", "DUSK"];

describe("the element wheel", () => {
  it("every element beats exactly one and is beaten by exactly one", () => {
    for (const el of EIGHT) {
      expect(ELEMENT_BEATS[el], el).toBeDefined();
      expect(EIGHT.filter((x) => ELEMENT_BEATS[x] === el), el).toHaveLength(1);
      expect(beatenBy(el), el).toBeDefined();
    }
  });

  it("the six natural elements make one circle; DAWN and DUSK beat each other", () => {
    expect(["PYRO", "LEAF", "BORE", "BOLT", "GALE", "AQUA"].map((e) => ELEMENT_BEATS[e as Element]))
      .toEqual(["LEAF", "BORE", "BOLT", "GALE", "AQUA", "PYRO"]);
    expect(ELEMENT_BEATS.DAWN).toBe("DUSK");
    expect(ELEMENT_BEATS.DUSK).toBe("DAWN");
  });

  it("+25% to the element it beats, floored; nothing the other way or anywhere else", () => {
    expect(applyMatchupDamage("PYRO", "LEAF", 8)).toBe(10);
    expect(applyMatchupDamage("BORE", "BOLT", 4)).toBe(5);
    expect(applyMatchupDamage("DAWN", "DUSK", 10)).toBe(12);
    expect(applyMatchupDamage("LEAF", "PYRO", 8)).toBe(8); // the weak direction
    expect(applyMatchupDamage("PYRO", "BOLT", 8)).toBe(8); // not on each other's arc
    expect(applyMatchupDamage("PYRO", "PYRO", 8)).toBe(8);
    // Floored: a 1-3 DMG hit is never inflated to a +50% swing.
    expect(applyMatchupDamage("PYRO", "LEAF", 3)).toBe(3);
    expect(applyMatchupDamage("PYRO", "LEAF", 0)).toBe(0);
  });

  it("each element's line names what it beats and what beats it", () => {
    expect(ELEMENT_MATCHUP.PYRO!.desc).toContain("LEAF");
    expect(ELEMENT_MATCHUP.PYRO!.desc).toContain("AQUA");
    expect(ELEMENT_MATCHUP.PYRO!.name).toBe("Strong vs LEAF");
  });

  it("the old one-offs are gone: AQUA takes full BURN, LEAF gains nothing from AQUA hits", () => {
    const s = prepState();
    const aqua = place(s, "aqua_piranha", "P1", 2, 0);
    applyStatus(s, aqua, "BURN", 4, 2, "PYRO");
    expect(statusOf(s.cards[aqua.instanceId], "BURN")?.duration).toBe(4);
    const atk = place(s, "aqua_piranha", "P2", 0, 0);
    const tgt = place(s, "leaf_hunter", "P1", 1, 0, { curHp: 30, maxHp: 40, curShields: 0 });
    const hits = getDef("aqua_piranha").hits ?? 1;
    const dmg = effectiveDmg(s, s.cards[atk.instanceId]);
    basicAttack(s, atk.instanceId, tgt.instanceId);
    expect(s.cards[tgt.instanceId].curHp).toBe(30 - dmg * hits);
  });
});

describe("BORE's aura: stone cannot be PARALYZED", () => {
  it("PARALYZE does not take on a BORE card; ELECTRIFIED now does", () => {
    const s = prepState();
    const stone = place(s, "bore_kobra", "P1", 3, 0);
    applyStatus(s, stone, "PARALYZE", 2, 0, "BOLT");
    expect(statusOf(stone, "PARALYZE")).toBeUndefined();
    applyStatus(s, stone, "ELECTRIFIED", 2, 0, "BOLT");
    expect(statusOf(stone, "ELECTRIFIED")).toBeDefined();
  });

  it("other elements are paralyzed as usual", () => {
    const s = prepState();
    const c = place(s, "leaf_hunter", "P1", 3, 0);
    applyStatus(s, c, "PARALYZE", 2, 0, "BOLT");
    expect(statusOf(c, "PARALYZE")).toBeDefined();
  });
});

describe("BURN's heal penalty", () => {
  it("a BURNing card heals at half (2026-10-01; was 75%)", () => {
    const s = prepState();
    const c = place(s, "leaf_hunter", "P1", 2, 0, { curHp: 5, maxHp: 40 });
    expect(healCard(s, c, 8)).toBe(8); // clean
    applyStatus(s, c, "BURN", 3, 2, "PYRO");
    expect(healCard(s, c, 8)).toBe(Math.floor(8 * BURN_HEAL_MULT)); // 4
  });

  it("never taxes a heal down to nothing", () => {
    const s = prepState();
    const c = place(s, "leaf_hunter", "P1", 2, 0, { curHp: 5, maxHp: 40 });
    applyStatus(s, c, "BURN", 3, 2, "PYRO");
    expect(healCard(s, c, 1)).toBe(1); // floor would be 0 — clamped to 1
  });
});

describe("Exostone (BORE): stone chips one plate at a time", () => {
  it("a heavy hit takes ONE shield off a BORE card, not two or three", () => {
    const s = prepState();
    // 25 damage would break 3 shields off anyone else (shieldsBrokenBy: 1 / 2 at
    // 10+ / 3 at 21+) — which fell hardest on the element made of shields.
    expect(shieldsBrokenBy(25)).toBe(3);
    const bore = place(s, "bore_armadillo", "P1", 2, 0, { curHp: 60, maxHp: 60, curShields: 5 });
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40 });
    directDamage(s, s.cards[foe.instanceId], s.cards[bore.instanceId], 25, false);
    expect(s.cards[bore.instanceId].curShields).toBe(4);
  });

  it("...while a non-BORE card still loses the full sliding-scale amount", () => {
    const s = prepState();
    const other = place(s, "leaf_hunter", "P1", 2, 0, { curHp: 60, maxHp: 60, curShields: 5 });
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40 });
    directDamage(s, s.cards[foe.instanceId], s.cards[other.instanceId], 25, false);
    expect(s.cards[other.instanceId].curShields).toBe(5 - shieldsBrokenBy(25));
  });

  it("a small hit is unchanged — it only ever took one anyway", () => {
    const s = prepState();
    const bore = place(s, "bore_armadillo", "P1", 2, 0, { curHp: 60, maxHp: 60, curShields: 5 });
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40 });
    directDamage(s, s.cards[foe.instanceId], s.cards[bore.instanceId], 3, false);
    expect(s.cards[bore.instanceId].curShields).toBe(4);
  });
});

describe("Exostone (BORE): the stone takes what it breaks", () => {
  it("gains a shield when its attack breaks one off an opponent", () => {
    const s = prepState();
    const bore = place(s, "bore_armadillo", "P1", 2, 0, { curShields: 2 });
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 3 });
    basicAttack(s, bore.instanceId, foe.instanceId);
    expect(s.cards[foe.instanceId].curShields).toBe(2); // the gate's usual strip
    expect(s.cards[bore.instanceId].curShields).toBe(3); // ...worn by the attacker
  });

  it("takes nothing off an unarmoured target — it loots breaks, not bodies", () => {
    const s = prepState();
    const bore = place(s, "bore_armadillo", "P1", 2, 0, { curShields: 2 });
    const bare = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, bore.instanceId, bare.instanceId);
    expect(s.cards[bore.instanceId].curShields).toBe(2);
  });

  it("costs the target no MORE than it always did", () => {
    // The gain rides the break the shield gate was already making; it does not
    // pry off an extra plate. A non-BORE attacker is the control.
    const s = prepState();
    const bore = place(s, "bore_armadillo", "P1", 2, 0, { curShields: 0 });
    const other = place(s, "leaf_hunter", "P1", 3, 0, { curShields: 0 });
    const a = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 4 });
    const b = place(s, "dusk_gool", "P2", 3, 1, { curHp: 40, maxHp: 40, curShields: 4 });
    basicAttack(s, bore.instanceId, a.instanceId);
    basicAttack(s, other.instanceId, b.instanceId);
    expect(s.cards[a.instanceId].curShields).toBe(s.cards[b.instanceId].curShields);
  });
});

describe("Photosynthesis feeds on the roots", () => {
  it("heals +1 per ROOTed opponent on top of its base +2", () => {
    const s = prepState();
    const leaf = place(s, "leaf_alpha", "P1", 3, 0, { curHp: 5, maxHp: 40, curShields: 0 });
    const a = place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30 });
    const b = place(s, "dusk_gool", "P2", 1, 1, { curHp: 30, maxHp: 30 });
    place(s, "dusk_gool", "P2", 1, 2, { curHp: 30, maxHp: 30 }); // left free
    applyStatus(s, a, "ROOT", 3, 0, "LEAF");
    applyStatus(s, b, "ROOT", 3, 0, "LEAF");
    const n = advance(atCleanup(s));
    expect(n.cards[leaf.instanceId].curHp).toBe(5 + 2 + 2); // base 2, +1 per rooted foe
  });

  it("...and only counts OPPONENTS, not rooted allies", () => {
    const s = prepState();
    const leaf = place(s, "leaf_alpha", "P1", 3, 0, { curHp: 5, maxHp: 40, curShields: 0 });
    const ally = place(s, "leaf_hunter", "P1", 3, 1, { curHp: 20, maxHp: 20 });
    place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30 });
    applyStatus(s, ally, "ROOT", 3, 0, "DUSK");
    const n = advance(atCleanup(s));
    expect(n.cards[leaf.instanceId].curHp).toBe(5 + 2); // base only
  });
});

describe("Magnetite's Magnetic Shield", () => {
  it("plates every ally in range, not just the row ahead", () => {
    // Fired end-to-end so rules.ts supplies the targets — the point of the
    // change is that reach now comes from the normal ally-AOE path instead of a
    // hardcoded rowAhead sweep, which missed allies beside and behind Magnetite.
    const s = prepState();
    s.players.P1.magicPool = 4;
    const gem = place(s, "bore_gemaga", "P1", 3, 1);
    const beside = place(s, "bore_armadillo", "P1", 3, 0); // same row — was missed before
    const ahead = place(s, "bore_valcana", "P1", 2, 1); // row directly ahead
    place(s, "dusk_gool", "P2", 0, 0);
    s.phase = "battle";
    s.prep = null;
    s.battle = { queue: [gem.instanceId], index: 0, awaitingInput: gem.instanceId };
    const next = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special" });
    for (const id of [beside.instanceId, ahead.instanceId]) {
      expect(next.cards[id].reflectPower).toBe(2);
      expect(next.cards[id].reflectRoundsLeft).toBe(2);
    }
  });

  it("the granted REFLECT actually bounces damage back", () => {
    const s = prepState();
    const ally = place(s, "bore_armadillo", "P1", 2, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    ally.reflectPower = 1;
    ally.reflectRoundsLeft = 2;
    basicAttack(s, foe.instanceId, ally.instanceId);
    expect(30 - s.cards[foe.instanceId].curHp).toBe(1); // bitten back
  });
});

describe("Venomarch's Toxic Contagion — the death burst", () => {
  /** Infect `victim` with Venomarch's Special, straight through the handler.
   *
   *  THE CARD'S OWN PARAMS, not a copy of them: these were written out here,
   *  so the day the poison's length changed on the card this suite went on
   *  testing the old one and passing. */
  function infect(s: ReturnType<typeof prepState>, score: { instanceId: string }, victim: { instanceId: string }) {
    SPECIAL_HANDLERS.toxicContagion(
      s, s.cards[score.instanceId], [s.cards[victim.instanceId]],
      getDef("bore_score").special!.params!,
    );
  }

  it("rots for five rounds, and sleeps for one", () => {
    // Owner, 2026-10-22. The sleep is short on purpose — cast in BATTLE, a
    // status is ticked away at that round's Cleanup, so one round is all it can
    // land; the poison is what the card is really for.
    const spec = getDef("bore_score").special!;
    expect(spec.params!.dotDuration).toBe(5);
    expect(spec.params!.dotPower).toBe(3);
    expect(spec.params!.sleep).toBe(1);
    // ...and the card SAYS both, which it did not before: the printed text
    // never mentioned how long the sleep was at all.
    expect(spec.text).toContain("for 1 round");
    expect(spec.text).toContain("for 5 rounds");
  });

  it("the poison it applies is the poison the card promises", () => {
    const s = prepState();
    const score = place(s, "bore_score", "P1", 3, 0);
    const victim = place(s, "dusk_gool", "P2", 1, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    infect(s, score, victim);
    const dot = s.cards[victim.instanceId].statuses.find((x) => x.kind === "DOT")!;
    expect(dot.duration).toBe(5);
    expect(dot.power).toBe(3);
    expect(s.cards[victim.instanceId].statuses.find((x) => x.kind === "SLEEP")!.duration).toBe(1);
  });

  it("...and five rounds of it is fifteen damage, if nothing cleanses", () => {
    // The point of the change: 6 damage from one cast became 15, and the death
    // burst stays armed for all of it.
    const s = prepState();
    const score = place(s, "bore_score", "P1", 3, 0);
    const victim = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    infect(s, score, victim);
    let cur: ReturnType<typeof prepState> = s;
    let ticks = 0;
    while (cur.cards[victim.instanceId]?.statuses.some((x) => x.kind === "DOT") && ticks < 12) {
      cur.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
      cur = advance(atCleanup(cur));
      ticks++;
    }
    expect(ticks, "five ticks, then it wears off").toBe(5);
    expect(40 - cur.cards[victim.instanceId].curHp).toBe(15);
  });

  it("bursts for 3 onto the victim's OWN neighbours when it dies poisoned", () => {
    const s = prepState();
    const score = place(s, "bore_score", "P1", 3, 0);
    const victim = place(s, "dusk_gool", "P2", 1, 1, { curHp: 5, maxHp: 20, curShields: 0 });
    const neighbour = place(s, "dusk_vamp", "P2", 1, 2, { curHp: 20, maxHp: 20, curShields: 0 });
    const ally = place(s, "bore_armadillo", "P1", 2, 1, { curHp: 20, maxHp: 20, curShields: 0 });
    infect(s, score, victim);
    defeatCard(s, s.cards[victim.instanceId], "test");
    // The splash spreads through the victim's own ranks...
    expect(20 - s.cards[neighbour.instanceId].curHp).toBe(3);
    // ...and never back onto the caster's side, even standing adjacent.
    expect(s.cards[ally.instanceId].curHp).toBe(20);
  });

  it("stays quiet when the poison has already worn off", () => {
    const s = prepState();
    const score = place(s, "bore_score", "P1", 3, 0);
    const victim = place(s, "dusk_gool", "P2", 1, 1, { curHp: 5, maxHp: 20, curShields: 0 });
    const neighbour = place(s, "dusk_vamp", "P2", 1, 2, { curHp: 20, maxHp: 20, curShields: 0 });
    infect(s, score, victim);
    // Outlived the DOT — "dies while affected" is the whole gate.
    s.cards[victim.instanceId].statuses = [];
    defeatCard(s, s.cards[victim.instanceId], "test");
    expect(s.cards[neighbour.instanceId].curHp).toBe(20);
  });

  it("still bursts when the poison itself lands the kill", () => {
    // Armed at the death choke-point rather than on the cast, so it pays out
    // however the body finally drops — here, the DOT tick at Cleanup.
    const s = prepState();
    const score = place(s, "bore_score", "P1", 3, 0);
    const victim = place(s, "dusk_gool", "P2", 1, 1, { curHp: 2, maxHp: 20, curShields: 0 });
    const neighbour = place(s, "dusk_vamp", "P2", 1, 2, { curHp: 20, maxHp: 20, curShields: 0 });
    infect(s, score, victim);
    const next = advance(atCleanup(s));
    expect(next.cards[victim.instanceId]).toBeUndefined(); // poisoned to death
    expect(20 - next.cards[neighbour.instanceId].curHp).toBe(3);
  });
});

describe("Venomarch's Sand Trap — the melee answer", () => {
  /** One melee swing into Venomarch, on a given seed. Returns the attacker. */
  function swing(seed: number) {
    const s = prepState();
    s.rngState = seed;
    const score = place(s, "bore_score", "P1", 2, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    const brute = place(s, "bore_clubber", "P2", 1, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    basicAttack(s, brute.instanceId, score.instanceId);
    return s.cards[brute.instanceId];
  }

  it("is what the card now says it is: rot 3 for 2, and half a sleep", () => {
    // Owner, 2026-10-22. It used to be a guaranteed SLEEP and nothing else —
    // a strange answer from a card whose whole kit is venom.
    const m = getDef("bore_score").onHitByMelee!;
    expect(m.status).toEqual({ kind: "DOT", duration: 2, power: 3 });
    expect(m.chanceStatus).toEqual({ kind: "SLEEP", duration: 2, power: 0, chance: 50 });
  });

  it("bites back EVERY time, whatever the coin does", () => {
    // The two rolls are separate on purpose: putting the odds on the shared
    // `chance` would have made the damage half a coin flip too.
    for (let seed = 0; seed < 24; seed++) {
      const dot = swing(seed).statuses.find((x) => x.kind === "DOT");
      expect(dot, `seed ${seed}`).toBeTruthy();
      expect(dot!.power).toBe(3);
      expect(dot!.duration).toBe(2);
    }
  });

  it("...and the sleep is a coin, not a promise", () => {
    const slept = new Set<boolean>();
    for (let seed = 0; seed < 24; seed++)
      slept.add(swing(seed).statuses.some((x) => x.kind === "SLEEP"));
    expect(slept, "both outcomes happen across seeds").toEqual(new Set([true, false]));
  });

  it("...and when it lands it is two rounds, like the card says", () => {
    for (let seed = 0; seed < 24; seed++) {
      const sleep = swing(seed).statuses.find((x) => x.kind === "SLEEP");
      if (sleep) { expect(sleep.duration).toBe(2); return; }
    }
    throw new Error("no seed in 24 ever slept the attacker");
  });

  it("the card face prints both halves, odds and durations", () => {
    // This file's own history: a passive that said "retaliate — SLEEP." could
    // not tell you whether that was one round or four.
    const line = describePassives(getDef("bore_score")).find((l) => l.startsWith("Sand Trap"))!;
    expect(line).toContain("DOT 3 for 2 rounds");
    expect(line).toContain("50% chance of SLEEP for 2 rounds");
  });
});

describe("Kore's Meltdown", () => {
  it("dies into a Static Wisp on its owner's side", () => {
    const s = prepState();
    const kore = place(s, "bolt_kore", "P1", 2, 0, { curHp: 3, curShields: 0 });
    place(s, "dusk_gool", "P2", 0, 3); // someone for the board to be legal
    defeatCard(s, kore, "test");
    const wisps = boardCards(s, "P1").filter((c) => c.defId === "bolt_static_wisp_tok");
    expect(wisps).toHaveLength(1);
    expect(wisps[0].curHp).toBe(getDef("bolt_static_wisp_tok").hp);
  });

  it("leaves the WISP, not the full Static Cloud card", () => {
    // Meltdown used to spawn bolt_staticcloud — a real cost-2 rare with double
    // the body and double the discharge. Pinning the weakened token here so a
    // future edit can't quietly hand a cost-5 epic a whole extra card again.
    const wisp = getDef("bolt_static_wisp_tok");
    const cloud = getDef("bolt_staticcloud");
    expect(wisp.hp).toBeLessThan(cloud.hp);
    expect(wisp.roundTick?.randomEnemyDmg).toBeLessThan(cloud.roundTick!.randomEnemyDmg!);
    expect(wisp.roundTick?.randomEnemyStatus?.duration)
      .toBeLessThan(cloud.roundTick!.randomEnemyStatus!.duration);
  });
});

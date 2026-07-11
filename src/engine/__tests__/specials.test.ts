// Milestone 7: specials registry, pool spend, summon-turn lockout, statuses.

import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { canFireSpecial } from "../rules";
import { atCleanup, place, prepState, seedForCoins } from "./helpers";
import { advance } from "../phases";
import type { GameState } from "../types";

/** Park the battle so `active` is the next card to act, awaiting P1 input. */
function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

describe("firing specials", () => {
  it("strike: damage + status + self-heal, and the pool is spent", () => {
    const s = prepState();
    s.players.P1.pool = 5;
    const a = place(s, "leaf_sumerose", "P1", 2, 0, { curHp: 8, maxHp: 13 }); // Siphoning Slash cost 3
    const t = place(s, "bore_armadillo", "P2", 1, 0, { curHp: 15, curShields: 4 });
    const next = applyIntent(battleWith(s, a.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: t.instanceId,
    });
    // 5 dmg PEN − BLOCK 2 = 3 straight to HP; shields untouched; BLEED 3 applied
    const target = next.cards[t.instanceId];
    expect(target.curHp).toBe(12);
    expect(target.curShields).toBe(4);
    expect(target.status?.kind).toBe("BLEED");
    expect(next.cards[a.instanceId].curHp).toBe(11); // healed 3
    expect(next.players.P1.pool).toBe(2);
  });

  it("barrage: hits up to N targets", () => {
    const s = prepState();
    s.players.P1.pool = 5;
    const a = place(s, "leaf_fallona", "P1", 2, 0); // Leaf Storm: 2 dmg, 3 targets, cost 2
    const t1 = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const t2 = place(s, "dusk_ghastly", "P2", 1, 1, { curHp: 19 });
    const t3 = place(s, "bore_smith", "P2", 1, 2, { curHp: 11, curShields: 0 });
    const next = applyIntent(battleWith(s, a.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: t1.instanceId,
    });
    expect(next.cards[t1.instanceId].curHp).toBe(11);
    expect(next.cards[t2.instanceId].curHp).toBe(17);
    expect(next.cards[t3.instanceId].curHp).toBe(9);
  });

  it("barrage multi-selection: strikes exactly the picked targets, stacking repeats", () => {
    const s = prepState();
    s.players.P1.pool = 5;
    const sol = place(s, "pyro_sol", "P1", 2, 0); // Pyro Ball Barrage: 3 dmg, up to 4 targets
    const t1 = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const t2 = place(s, "dusk_ghastly", "P2", 1, 1, { curHp: 19 });
    place(s, "bore_smith", "P2", 1, 2, { curHp: 11 }); // NOT picked — must be untouched
    const next = applyIntent(battleWith(s, sol.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetIds: [t1.instanceId, t1.instanceId, t1.instanceId, t2.instanceId], // stack 3 on t1
    });
    expect(next.cards[t1.instanceId].curHp).toBe(4); // 3 strikes × 3
    expect(next.cards[t2.instanceId].curHp).toBe(16); // 1 strike
    expect(next.cards[sol.instanceId]).toBeTruthy();
    expect(next.log.filter((l) => l.includes("Smith")).length).toBe(0);
  });

  it("barrage rejects more picks than the special allows", () => {
    const s = prepState();
    s.players.P1.pool = 5;
    const fallona = place(s, "leaf_fallona", "P1", 2, 0); // Leaf Storm: up to 3 targets
    const t = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    expect(() =>
      applyIntent(battleWith(s, fallona.instanceId), {
        type: "BATTLE_ACTION",
        player: "P1",
        action: "special",
        targetIds: [t.instanceId, t.instanceId, t.instanceId, t.instanceId],
      }),
    ).toThrow(/Too many targets/);
  });

  it("multi-hit basic can split hits across targets (and still gate per target)", () => {
    const s = prepState();
    const krysteel = place(s, "bore_krysteel", "P1", 2, 0, { autoMode: "manual" }); // 3 dmg × 3, CRIT
    const t1 = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const t2 = place(s, "dusk_ghastly", "P2", 1, 1, { curHp: 19, curShields: 1 });
    s.rngState = seedForCoins(false, false, false); // no CRITs muddying the math
    const next = applyIntent(battleWith(s, krysteel.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "basic",
      targetIds: [t1.instanceId, t1.instanceId, t2.instanceId], // 2 hits + 1 hit
    });
    expect(next.cards[t1.instanceId].curHp).toBe(7); // 13 − 3 − 3
    // t2: 3 − 1 shield = 2 to HP, shield stripped
    expect(next.cards[t2.instanceId].curHp).toBe(17);
    expect(next.cards[t2.instanceId].curShields).toBe(0);
  });

  it("basic rejects more picks than the card has hits", () => {
    const s = prepState();
    const vamp = place(s, "leaf_alpha", "P1", 2, 0); // 1 hit
    const t = place(s, "dusk_gool", "P2", 1, 0);
    expect(() =>
      applyIntent(battleWith(s, vamp.instanceId), {
        type: "BATTLE_ACTION",
        player: "P1",
        action: "basic",
        targetIds: [t.instanceId, t.instanceId],
      }),
    ).toThrow(/Too many targets/);
  });

  it("a single pick still takes the full volley (AI / one-click path)", () => {
    const s = prepState();
    const sol = place(s, "pyro_sol", "P1", 2, 0); // 3 dmg × 2 hits
    const t = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const next = applyIntent(battleWith(s, sol.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "basic",
      targetId: t.instanceId,
    });
    expect(next.cards[t.instanceId].curHp).toBe(7); // both hits landed on it
  });

  it("statusNova: SLEEPs up to 2 targets; a sleeper skips its turn on tails", () => {
    const s = prepState();
    s.players.P2.pool = 9;
    const sandman = place(s, "bore_sandman", "P2", 1, 0); // Nightmare cost 4
    const v1 = place(s, "leaf_alpha", "P1", 2, 0);
    const v2 = place(s, "leaf_greegon", "P1", 2, 1);
    s.phase = "battle";
    s.battle = { queue: [sandman.instanceId, v1.instanceId], index: 0, awaitingInput: null };
    let next = advance(s); // AI acts: Nightmare is its best opener vs 2 fresh targets
    expect(next.cards[v1.instanceId].status?.kind).toBe("SLEEP");
    expect(next.cards[v2.instanceId].status?.kind).toBe("SLEEP");
    // force the sleeper's wake-coin to tails: it stays asleep and skips
    next.rngState = seedForCoins(false);
    next = advance(next);
    expect(next.battle?.index).toBe(2);
    expect(next.cards[v1.instanceId].status?.kind).toBe("SLEEP");
  });

  it("a sleeper wakes on heads and can act", () => {
    const s = prepState();
    const sleeper = place(s, "leaf_alpha", "P1", 2, 0, {
      autoMode: "basic",
      status: { kind: "SLEEP", duration: 2, power: 0, source: "BORE" },
    });
    place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    s.phase = "battle";
    s.battle = { queue: [sleeper.instanceId], index: 0, awaitingInput: null };
    s.rngState = seedForCoins(true); // wake!
    const next = advance(s);
    expect(next.cards[sleeper.instanceId].status).toBeNull();
    expect(next.log.some((l) => l.includes("wakes up"))).toBe(true);
  });

  it("grantShield: Smith reinforces an ally", () => {
    const s = prepState();
    s.players.P1.pool = 4;
    const smith = place(s, "bore_smith", "P1", 3, 0);
    const ally = place(s, "leaf_greegon", "P1", 2, 0, { curShields: 0 });
    place(s, "dusk_gool", "P2", 0, 1);
    const next = applyIntent(battleWith(s, smith.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: ally.instanceId,
    });
    expect(next.cards[ally.instanceId].curShields).toBe(2);
    expect(next.players.P1.pool).toBe(2);
  });
});

describe("special legality", () => {
  it("multiple cards may each fire a Special in the same round if the pool affords it", () => {
    const s = prepState();
    s.players.P1.pool = 3; // Web Snare (1) + Leaf Storm (2) = exactly affordable
    const silk = place(s, "dusk_silkstalker", "P1", 2, 0); // Web Snare, cost 1
    const fallona = place(s, "leaf_fallona", "P1", 2, 1); // Leaf Storm, cost 2
    const t = place(s, "bore_smith", "P2", 1, 0, { curHp: 11, curShields: 0 });
    s.phase = "battle";
    s.battle = {
      queue: [silk.instanceId, fallona.instanceId],
      index: 0,
      awaitingInput: silk.instanceId,
    };
    let g = applyIntent(s, {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: t.instanceId,
    });
    expect(g.players.P1.pool).toBe(2);
    // second card, same round: its own Special is fresh — only the pool gates it
    g.battle!.awaitingInput = fallona.instanceId;
    expect(canFireSpecial(g, fallona.instanceId).ok).toBe(true);
    g = applyIntent(g, {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: t.instanceId,
    });
    expect(g.players.P1.pool).toBe(0);
    expect(g.cards[t.instanceId].curHp).toBe(2); // 11 − 7 (Web Snare) − 2 (Leaf Storm)
    // and both cards are now individually recharging
    expect(g.cards[silk.instanceId].specialCooldown).toBe(2);
    expect(g.cards[fallona.instanceId].specialCooldown).toBe(2);
  });

  it("one-round cooldown: fire -> blocked next round -> available the round after", () => {
    const s = prepState();
    s.players.P1.pool = 9;
    const a = place(s, "leaf_fallona", "P1", 2, 0); // Leaf Storm cost 2
    place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    place(s, "leaf_alpha", "P1", 3, 0); // keeps P1 alive on board
    let g = applyIntent(battleWith(s, a.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    expect(g.cards[a.instanceId].specialCooldown).toBe(2);
    // Cleanup of the round it fired: cooldown ticks to 1 -> still blocked next round.
    g = advance(atCleanup(g));
    expect(g.cards[a.instanceId].specialCooldown).toBe(1);
    expect(canFireSpecial(g, a.instanceId).ok).toBe(false);
    expect(canFireSpecial(g, a.instanceId).reason).toMatch(/recharging/i);
    // Next Cleanup: cooldown expires -> available again.
    g = advance(atCleanup(g));
    expect(g.cards[a.instanceId].specialCooldown).toBe(0);
    expect(canFireSpecial(g, a.instanceId).ok).toBe(true);
  });

  it("summon-turn lockout: no Special the round a card lands", () => {
    const s = prepState();
    s.players.P1.pool = 9;
    const a = place(s, "leaf_fallona", "P1", 3, 0, { summonedThisRound: true });
    place(s, "dusk_gool", "P2", 1, 0);
    expect(canFireSpecial(s, a.instanceId).ok).toBe(false);
    // ...and the lockout clears at Cleanup
    place(s, "leaf_alpha", "P1", 3, 1);
    const next = advance(atCleanup(s));
    expect(canFireSpecial(next, a.instanceId).ok).toBe(true);
  });

  it("rejects when the pool can't cover the cost", () => {
    const s = prepState();
    s.players.P1.pool = 1;
    const a = place(s, "leaf_fallona", "P1", 3, 0); // Leaf Storm cost 2
    place(s, "dusk_gool", "P2", 1, 0);
    expect(canFireSpecial(s, a.instanceId).ok).toBe(false);
  });

  it("rejects when MUTED and when no valid target exists", () => {
    const s = prepState();
    s.players.P1.pool = 9;
    const muted = place(s, "leaf_fallona", "P1", 3, 0, {
      status: { kind: "MUTED", duration: 1, power: 0, source: "BOLT" },
    });
    place(s, "dusk_gool", "P2", 1, 0);
    expect(canFireSpecial(s, muted.instanceId).ok).toBe(false);

    const s2 = prepState();
    s2.players.P1.pool = 9;
    const alone = place(s2, "leaf_fallona", "P1", 3, 0);
    place(s2, "dusk_gool", "P2", 0, 0); // enemy home camper — unreachable from own home
    expect(canFireSpecial(s2, alone.instanceId).ok).toBe(false);
  });

  it("FRIGHTEN blocks acting entirely", () => {
    const s = prepState();
    s.players.P1.pool = 9;
    const scared = place(s, "leaf_fallona", "P1", 2, 0, {
      status: { kind: "FRIGHTEN", duration: 1, power: 0, source: "DUSK" },
    });
    place(s, "dusk_gool", "P2", 1, 0);
    expect(canFireSpecial(s, scared.instanceId).ok).toBe(false);
    s.phase = "battle";
    s.battle = { queue: [scared.instanceId], index: 0, awaitingInput: null };
    const next = advance(s); // auto-skips, never awaits input
    expect(next.battle?.index).toBe(1);
    expect(next.log.some((l) => l.includes("can't act"))).toBe(true);
  });
});

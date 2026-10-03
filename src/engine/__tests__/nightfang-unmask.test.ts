// NIGHTFANG'S BUTLER CAN UNMASK ON COMMAND (owner's call, 2026-10-03).
//
// Nightfang enters play as its Butler and used to come out ONLY when killed in
// it. The Butler now has a Talent — Unmask, free and once per game — that drops
// the disguise as the turn's action. And the match report credits the body to
// Nightfang, the card in the deck, instead of to the Butler it was wearing.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { chooseBattleAction } from "../ai";
import { applyIntent } from "../phases";
import { canFireTalent } from "../rules";
import { place, prepState } from "./helpers";
import type { GameState } from "../types";

/** It is `id`'s turn in the Battle Phase. */
function turnOf(s: GameState, id: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.cards[id].summonedThisRound = false;
  s.battle = { queue: [id], index: 0, awaitingInput: id };
  return s;
}

describe("Unmask", () => {
  it("Nightfang arrives as the Butler, and Unmask brings it out at full HP", () => {
    const s = prepState();
    const nf = place(s, "dusk_nightfang", "P1", 2, 0);
    expect(s.cards[nf.instanceId].defId, "still in disguise").toBe("dusk_butler");
    s.cards[nf.instanceId].curHp = 4; // hurt as the Butler
    const n = applyIntent(turnOf(s, nf.instanceId), { type: "BATTLE_ACTION", player: "P1", action: "talent" });
    const c = n.cards[nf.instanceId];
    expect(c.defId).toBe("dusk_nightfang");
    expect(c.transformedFrom).toBeUndefined();
    expect(c.curHp).toBe(getDef("dusk_nightfang").hp);
    expect(c.talentUsed, "once per game").toBe(true);
    expect(n.log.some((l) => /drops the act/.test(l))).toBe(true);
  });

  it("is offered only to a Butler that IS a disguise", () => {
    const s = prepState();
    const plain = place(s, "dusk_butler", "P1", 2, 1); // a Butler and nothing more
    expect(canFireTalent(s, plain.instanceId)).toEqual({ ok: false, reason: "Nothing to unmask" });
    const nf = place(s, "dusk_nightfang", "P1", 2, 0);
    expect(canFireTalent(s, nf.instanceId).ok).toBe(true);
  });

  it("killing the Butler still reveals Nightfang with its free strike — Unmask did not replace that", () => {
    expect(getDef("dusk_nightfang").disguise).toEqual({ as: "dusk_butler", strikeKillerOnReveal: true });
    expect(getDef("dusk_butler").talent?.handler).toBe("unmask");
  });
});

describe("the AI keeps the disguise until Nightfang has a kill to take", () => {
  it("holds the mask with nothing to finish", () => {
    const s = prepState();
    const nf = place(s, "dusk_nightfang", "P2", 1, 0);
    place(s, "bore_armadillo", "P1", 2, 0, { curHp: 40, maxHp: 40 });
    expect(chooseBattleAction(turnOf(s, nf.instanceId), nf.instanceId).action).not.toBe("talent");
  });

  it("drops it to finish what only Nightfang can", () => {
    const s = prepState();
    const nf = place(s, "dusk_nightfang", "P2", 1, 0);
    // 8 HP: the Butler's 2 does not finish it; Nightfang's 11 does.
    place(s, "leaf_python", "P1", 2, 0, { curHp: 8, maxHp: 17, curShields: 0 });
    expect(chooseBattleAction(turnOf(s, nf.instanceId), nf.instanceId).action).toBe("talent");
  });
});

describe("the match report counts Nightfang, not its Butler", () => {
  it("credits what the Butler does to Nightfang's row", () => {
    const s = prepState();
    const nf = place(s, "dusk_nightfang", "P1", 2, 0);
    const foe = place(s, "bore_armadillo", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const n = applyIntent(turnOf(s, nf.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "basic", targetId: foe.instanceId,
    });
    const row = n.stats.byCard[nf.instanceId];
    expect(row?.defId).toBe("dusk_nightfang");
    expect(row?.name).toBe("Nightfang");
    expect(row?.dmg).toBeGreaterThan(0);
  });
});

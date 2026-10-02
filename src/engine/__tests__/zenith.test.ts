// Zenith (dawn_raya): Orbital Shot and Star Blaster (owner, 2026-10-02).
//
// The arrow never fell: it was resolved inside Cleanup's meteor loop, after a
// `continue` for any side with no meteor pending. And Star Blaster blinded
// around ZENITH — a Ranger who kills from two squares off — instead of around
// the card that died.
import { describe, expect, it } from "vitest";
import { basicAttack, defeatCard } from "../combat";
import { advance, applyIntent } from "../phases";
import { place, prepState, statusOf } from "./helpers";
import type { GameState } from "../types";

function battleFor(s: GameState, active: string): GameState {
  s.phase = "battle"; s.prep = null;
  s.battle = { queue: [active], index: 0, awaitingInput: active };
  return s;
}

/** Play on (both sides pass and skip) until `stop` holds. */
function until(g: GameState, stop: (g: GameState) => boolean): GameState {
  for (let i = 0; i < 60 && !stop(g); i++) {
    g = g.phase === "prep" ? applyIntent(g, { type: "PASS", player: g.prep!.priority })
      : g.battle?.awaitingInput
        ? applyIntent(g, { type: "BATTLE_ACTION", player: g.cards[g.battle.awaitingInput].owner, action: "skip" })
        : advance(g);
  }
  return g;
}

function paint(targetHp: number, targetId = "dusk_gool") {
  const s = prepState();
  s.players.P1.magicPool = 5;
  const zen = place(s, "dawn_raya", "P1", 3, 0);
  const target = place(s, targetId, "P2", 1, 1, { curHp: targetHp, maxHp: targetHp, curShields: 0 });
  // Two opponents touching the target, one well away from it.
  const touchA = place(s, "dusk_gool", "P2", 0, 1, { curHp: 30, maxHp: 30 });
  const touchB = place(s, "dusk_gool", "P2", 1, 2, { curHp: 30, maxHp: 30 });
  const far = place(s, "dusk_gool", "P2", 0, 3, { curHp: 30, maxHp: 30 });
  const g = applyIntent(battleFor(s, zen.instanceId), {
    type: "BATTLE_ACTION", player: "P1", action: "special", targetId: target.instanceId,
  });
  return { g, zen, target, touchA, touchB, far };
}

describe("Zenith — Orbital Shot", () => {
  it("the arrow falls at the START of next round, with no meteor in the air", () => {
    // LEAF, so the hit is the printed 14 (DAWN deals +25% to DUSK).
    const { g, target } = paint(40, "leaf_cactus");
    expect(g.players.P1.pendingArrows).toHaveLength(1);
    const next = until(g, (x) => x.round === 2);
    expect(next.phase).toBe("draw");
    expect(next.cards[target.instanceId].curHp).toBe(40 - 14);
    expect(next.players.P1.pendingArrows).toHaveLength(0);
  });

  it("an arrow kill BLINDs every opponent touching the fallen card, through that round's battle", () => {
    const { g, target, touchA, touchB, far } = paint(10);
    const landed = until(g, (x) => x.round === 2);
    expect(landed.cards[target.instanceId]).toBeUndefined();
    expect(statusOf(landed.cards[touchA.instanceId], "BLIND")).toBeDefined();
    expect(statusOf(landed.cards[touchB.instanceId], "BLIND")).toBeDefined();
    expect(statusOf(landed.cards[far.instanceId], "BLIND")).toBeUndefined();
    // "For the turn": still on when that round's battle starts.
    const battle = until(landed, (x) => x.phase === "battle");
    expect(battle.round).toBe(2);
    expect(statusOf(battle.cards[touchA.instanceId], "BLIND")).toBeDefined();
  });

  it("the arrow still falls, and still bursts, if Zenith has fallen meanwhile", () => {
    const { g, zen, target, touchA } = paint(10);
    defeatCard(g, g.cards[zen.instanceId], "test");
    const landed = until(g, (x) => x.round === 2);
    expect(landed.cards[zen.instanceId]).toBeUndefined();
    expect(landed.cards[target.instanceId]).toBeUndefined();
    expect(statusOf(landed.cards[touchA.instanceId], "BLIND")).toBeDefined();
  });
});

describe("Zenith — Star Blaster", () => {
  it("a basic kill blinds around the DEAD card, not around Zenith, and spares her allies", () => {
    const s = prepState();
    const zen = place(s, "dawn_raya", "P1", 3, 0);
    const nearZen = place(s, "dusk_gool", "P2", 2, 1, { curHp: 30, maxHp: 30 });
    const target = place(s, "dusk_gool", "P2", 1, 0, { curHp: 3, maxHp: 3, curShields: 0 });
    const touching = place(s, "dusk_gool", "P2", 0, 0, { curHp: 30, maxHp: 30 });
    const ally = place(s, "dawn_glime", "P1", 1, 1);
    basicAttack(s, zen.instanceId, target.instanceId);
    expect(s.cards[target.instanceId]).toBeUndefined();
    expect(statusOf(s.cards[touching.instanceId], "BLIND")?.duration).toBe(1);
    // nearZen touches BOTH Zenith and the dead card's square (1,0)->(2,1).
    expect(statusOf(s.cards[nearZen.instanceId], "BLIND")).toBeDefined();
    expect(statusOf(s.cards[ally.instanceId], "BLIND")).toBeUndefined();
  });

  it("an opponent beside Zenith but NOT beside the dead card is left alone", () => {
    const s = prepState();
    const zen = place(s, "dawn_raya", "P1", 3, 0);
    const besideZen = place(s, "dusk_gool", "P2", 3, 1, { curHp: 30, maxHp: 30 });
    const target = place(s, "dusk_gool", "P2", 1, 2, { curHp: 3, maxHp: 3, curShields: 0 });
    basicAttack(s, zen.instanceId, target.instanceId);
    expect(s.cards[target.instanceId]).toBeUndefined();
    expect(statusOf(s.cards[besideZen.instanceId], "BLIND")).toBeUndefined();
  });
});

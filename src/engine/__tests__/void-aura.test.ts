// ONE EYES - the VOID aura.
//
// Two halves, both bounded, and both tested through `elementAuras` rather than
// through a VOID card: that field is how a boss borrows an element's aura, so
// it exercises exactly the same code path `hasElementAura` takes for a real
// VOID card (auras.ts:12-14).
import { describe, expect, it } from "vitest";
import { CARD_INDEX } from "../../data/cards";
import { basicAttack } from "../combat";
import { advance, createInitialState } from "../index";
import { effectiveDmg, summonCard } from "../state";
import { VOID_DEFLECT_EVERY, VOID_STEAL_CAP, VOID_STEAL_FLOOR } from "../auras";
import type { CardInstance, GameState } from "../types";

const DECK = ["leaf_oak", "leaf_weeds", "leaf_birch", "leaf_nettle", "leaf_sticks", "leaf_cactus"];

/** A board with nothing on it, past the mulligan, parked in Prep. */
function board(): GameState {
  let s: GameState = createInitialState(5, DECK, DECK, [], undefined, undefined, 5);
  s.players.P1.mulliganDone = true;
  s.players.P2.mulliganDone = true;
  for (let i = 0; i < 40 && s.phase === "mulligan"; i++) s = advance(s);
  s.phase = "prep";
  return s;
}

/** Lend a card the VOID aura for one test, and take it back afterwards. */
function withVoid<T>(defId: string, run: () => T): T {
  const def = CARD_INDEX[defId] as { elementAuras?: string[] };
  const had = def.elementAuras;
  def.elementAuras = ["VOID"];
  try { return run(); } finally { def.elementAuras = had; }
}

const put = (s: GameState, defId: string, owner: "P1" | "P2", row: number, col: number, hp = 999) => {
  const c = summonCard(s, owner, defId, { row, col });
  c.summonedThisRound = false;
  c.curHp = hp; c.maxHp = hp;
  return c;
};

describe("One Eyes - the deflect", () => {
  /** Which of the first ten incoming hits got deflected. */
  function deflectedHits(): number[] {
    return withVoid("leaf_oak", () => {
      const s = board();
      const victim = put(s, "leaf_oak", "P2", 2, 2);
      const hitter = put(s, "leaf_weeds", "P1", 3, 2);
      const out: number[] = [];
      for (let hit = 1; hit <= 10; hit++) {
        const before = s.log.length;
        basicAttack(s, hitter.instanceId, victim.instanceId);
        if (s.log.slice(before).some((l) => l.includes("deflects"))) out.push(hit);
      }
      return out;
    });
  }

  it("opens on the FIRST hit, then every fourth", () => {
    // Phased to 1 rather than to VOID_DEFLECT_EVERY on purpose. Same rate over a
    // long fight; the difference is at the short end, which is the end this game
    // is played at. Measured across 321 bodies, only 2.8% ever took a fourth
    // hit - so deflecting on the 4th meant the eye never opened at all for
    // ninety-seven cards in a hundred.
    expect(deflectedHits()).toEqual([1, 5, 9]);
  });

  it("is a count and not a coin - the same board twice gives the same answer", () => {
    // The whole reason this is not the 25% roll it was first written as: the
    // Void Tower requires a floor to be a puzzle with an answer you can play
    // toward, and a roll on every incoming hit makes the same line win or lose
    // on the dice.
    expect(deflectedHits()).toEqual(deflectedHits());
  });

  it("throws half of the blow back at the attacker", () => {
    withVoid("leaf_oak", () => {
      const s = board();
      const victim = put(s, "leaf_oak", "P2", 2, 2);
      const hitter = put(s, "leaf_weeds", "P1", 3, 2);
      const hitterHp = hitter.curHp;
      basicAttack(s, hitter.instanceId, victim.instanceId);   // hit 1 = deflected
      expect(s.cards[hitter.instanceId].curHp, "nothing came back").toBeLessThan(hitterHp);
    });
  });

  it("does not ping-pong when both sides carry the aura", () => {
    // The reflected half is dealt as its own kind, and the deflect gate refuses
    // to fire on one - which is what stops two Void cards volleying a halved
    // hit back and forth until one of them dies inside a single attack.
    withVoid("leaf_oak", () => {
      const s = board();
      const a = put(s, "leaf_oak", "P1", 3, 2);
      const b = put(s, "leaf_oak", "P2", 2, 2);
      expect(() => basicAttack(s, a.instanceId, b.instanceId)).not.toThrow();
      expect(s.cards[a.instanceId].curHp).toBeGreaterThan(0);
      expect(s.cards[b.instanceId].curHp).toBeGreaterThan(0);
    });
  });
});

describe("One Eyes - the steal", () => {
  it("moves damage from the victim onto the thief, and stops at the cap", () => {
    withVoid("leaf_oak", () => {
      const s = board();
      const thief = put(s, "leaf_oak", "P1", 3, 3);
      const prey = put(s, "leaf_birch", "P2", 2, 3);
      const thief0 = effectiveDmg(s, thief);
      const prey0 = effectiveDmg(s, prey);
      for (let i = 0; i < 12; i++) basicAttack(s, thief.instanceId, prey.instanceId);
      const t = s.cards[thief.instanceId] as CardInstance;
      const p = s.cards[prey.instanceId] as CardInstance;
      // Conserved: what the thief gained is what the prey lost.
      expect(effectiveDmg(s, t) - thief0, "the thief kept the cap").toBe(VOID_STEAL_CAP);
      expect(prey0 - effectiveDmg(s, p), "and the prey lost exactly that").toBe(VOID_STEAL_CAP);
      // Twelve attacks, four stolen: it stopped rather than running forever.
      expect(t.voidStolen).toBe(VOID_STEAL_CAP);
    });
  });

  it("never robs a card below its floor", () => {
    // A card on 0 DMG has been deleted, and deleting cards is what damage is
    // already for. Weeds is the cheapest body in the deck, so it reaches the
    // floor long before the thief reaches its cap.
    withVoid("leaf_oak", () => {
      const s = board();
      const thief = put(s, "leaf_oak", "P1", 3, 1);
      const prey = put(s, "leaf_weeds", "P2", 2, 1);
      for (let i = 0; i < 12; i++) basicAttack(s, thief.instanceId, prey.instanceId);
      expect(effectiveDmg(s, s.cards[prey.instanceId])).toBeGreaterThanOrEqual(VOID_STEAL_FLOOR);
    });
  });

  it("takes nothing when the card has no VOID about it", () => {
    const s = board();
    const plain = put(s, "leaf_oak", "P1", 3, 2);
    const prey = put(s, "leaf_birch", "P2", 2, 2);
    const prey0 = effectiveDmg(s, prey);
    basicAttack(s, plain.instanceId, prey.instanceId);
    expect(effectiveDmg(s, s.cards[prey.instanceId])).toBe(prey0);
    expect((s.cards[plain.instanceId] as CardInstance).voidStolen ?? 0).toBe(0);
  });

  it("VOID_DEFLECT_EVERY is the rate the card text promises", () => {
    expect(VOID_DEFLECT_EVERY).toBe(4);
  });
});

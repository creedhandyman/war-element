// Radiant Court — Imperator gains +1 max HP per DAWN ally already on the board
// when it arrives.
//
// The interesting properties are the edges, not the sum: who counts, whether it
// counts ITSELF, and whether it keeps counting after the summon. A "+1 per ally"
// that quietly includes the card is a floor nobody asked for, and one that
// tracks the board live makes a mythic's HP move every time a token trades.
import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { getDef } from "../../data/cards";
import { giveHand, place, prepState } from "./helpers";
import type { GameState } from "../types";

const IMPERATOR = "dawn_imperator";
const BASE_HP = getDef(IMPERATOR).hp;

/** Summon Imperator for P1 into its home row and hand back the instance. */
function summon(s: GameState, col = 0) {
  s.players.P1.gold = 20;
  const handId = giveHand(s, "P1", IMPERATOR);
  // The intent takes a COLUMN, not a slot: a summon always lands in your own
  // home row, so the row is never the caller's to choose.
  const n = applyIntent(s, { type: "SUMMON", player: "P1", handId, col });
  const inst = Object.values(n.cards).find(
    (c) => c.defId === IMPERATOR && c.owner === "P1" && c.pos,
  )!;
  return { n, inst };
}

describe("Radiant Court", () => {
  it("gains nothing arriving onto an empty board", () => {
    // The card itself must not count. It is standing there by the time this
    // resolves, so an unguarded count would hand out a guaranteed +1.
    const s = prepState();
    place(s, "dusk_gool", "P2", 0, 0);
    const { inst } = summon(s);
    expect(inst.maxHp).toBe(BASE_HP);
  });

  it("gains +1 max HP per DAWN ally already standing", () => {
    const s = prepState();
    place(s, "dawn_star", "P1", 3, 1);
    place(s, "dawn_musk_ox", "P1", 3, 2);
    place(s, "dawn_halo", "P1", 2, 1);
    place(s, "dusk_gool", "P2", 0, 0);
    const { inst, n } = summon(s);
    expect(inst.maxHp).toBe(BASE_HP + 3);
    expect(inst.curHp, "it arrives at the new full, not wounded").toBe(inst.maxHp);
    expect(n.log.some((l) => /rises before 3 DAWN/.test(l)), "and says so").toBe(true);
  });

  it("counts DAWN only, and allies only", () => {
    // A LEAF ally is still an ally; an enemy DAWN card is still DAWN. Neither
    // is the emperor's court, and a mirror match must not pump both Imperators.
    const s = prepState();
    place(s, "dawn_star", "P1", 3, 1);       // counts
    place(s, "leaf_alpha", "P1", 3, 2);      // ally, wrong element
    place(s, "dawn_musk_ox", "P2", 0, 0);    // right element, wrong side
    const { inst } = summon(s);
    expect(inst.maxHp).toBe(BASE_HP + 1);
  });

  it("ignores the dead", () => {
    const s = prepState();
    place(s, "dawn_star", "P1", 3, 1);
    place(s, "dawn_musk_ox", "P1", 3, 2, { curHp: 0 });
    place(s, "dusk_gool", "P2", 0, 0);
    const { inst } = summon(s);
    expect(inst.maxHp).toBe(BASE_HP + 1);
  });

  it("is fixed at summon — later arrivals do not move it", () => {
    // A live count would make a mythic's HP a moving target every time a 1-cost
    // token traded, in both directions.
    const s = prepState();
    place(s, "dawn_star", "P1", 3, 1);
    place(s, "dusk_gool", "P2", 0, 0);
    const { n, inst } = summon(s);
    const settled = inst.maxHp;
    expect(settled).toBe(BASE_HP + 1);
    place(n, "dawn_halo", "P1", 2, 2);
    place(n, "dawn_solara", "P1", 2, 3);
    expect(n.cards[inst.instanceId].maxHp, "still what it was").toBe(settled);
  });

  it("leaves the rest of the card alone", () => {
    // Crowned and Strike of Dawn are what the ten Gold is actually for.
    const def = getDef(IMPERATOR);
    expect(def.roundTick?.cleanseAllies).toBe(true);
    expect(def.special?.name).toBe("Strike of Dawn");
  });
});

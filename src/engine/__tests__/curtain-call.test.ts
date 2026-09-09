// CURTAIN CALL — Scarecrow conducts the four closest allies that can shoot.
//
// It used to command the ROW AHEAD, whoever happened to be standing in it. A
// row is a poor proxy for a firing squad in both directions: it counts allies
// with nothing in range, so the order goes out and the volley comes back short,
// and it ignores an ally one square away in the wrong rank with a clean shot.
//
// `nearest` is Scarecrow's alone. Sunbanner prints no such param and still takes
// its own line plus the rank ahead — the two share a handler, not a rule.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { SPECIAL_HANDLERS } from "../combat";
import { bigPrepState, place, prepState } from "./helpers";
import type { CardInstance, GameState } from "../types";

const SCARECROW = "dusk_tatterhand";
/** Total HP+shields on the far side — the volley's footprint in one number. */
const enemyTotal = (s: GameState) =>
  Object.values(s.cards)
    .filter((c: CardInstance) => c.owner === "P2" && c.curHp > 0)
    .reduce((a, c) => a + c.curHp + c.curShields, 0);

function conduct(s: GameState, caster: CardInstance) {
  const def = getDef(SCARECROW);
  SPECIAL_HANDLERS[def.special!.handler]!(s, caster, [], def.special!.params ?? {});
}

describe("the card", () => {
  it("asks for the four closest, not a row", () => {
    const sp = getDef(SCARECROW).special!;
    expect(sp.name).toBe("Curtain Call");
    expect(sp.params?.nearest, "the squad size is printed, not hardcoded").toBe(4);
    expect(sp.params?.aheadOnly, "the row rule is gone").toBeUndefined();
    // The text a player reads has to match what the handler does — this repo
    // has a whole section on card text that lied in four places.
    expect(sp.text).toContain("4 closest");
  });
});

describe("who answers the call", () => {
  it("commands allies BESIDE the caster, which the row rule could not", () => {
    // The old rule took `rowAhead` only. An ally on the caster's own rank with a
    // clean shot was ignored no matter how close it stood.
    const s = prepState(7, "P1");
    const caster = place(s, SCARECROW, "P1", 3, 0);
    place(s, "pyro_wick", "P1", 3, 1);      // same row as the caster
    place(s, "leaf_nettle", "P2", 2, 1);    // in reach of it
    const before = enemyTotal(s);
    conduct(s, s.cards[caster.instanceId]);
    expect(enemyTotal(s), "the ally beside the caster fired").toBeLessThan(before);
  });

  it("does not spend a slot on an ally with nothing in range", () => {
    // The point of the change. Four allies, only two with a shot: the two that
    // can fire must both fire — a body with no prey must not consume a slot and
    // silently shorten the volley.
    const s = prepState(7, "P1");
    const caster = place(s, SCARECROW, "P1", 3, 0);
    for (const col of [1, 2, 3]) place(s, "pyro_wick", "P1", 3, col);
    const victim = place(s, "leaf_nettle", "P2", 2, 3);
    const before = s.cards[victim.instanceId].curHp + s.cards[victim.instanceId].curShields;
    conduct(s, s.cards[caster.instanceId]);
    const after = s.cards[victim.instanceId];
    expect((after?.curHp ?? 0) + (after?.curShields ?? 0),
      "whoever could reach it did").toBeLessThan(before);
  });

  it("never commands the caster, and never the other side", () => {
    const s = prepState(7, "P1");
    const caster = place(s, SCARECROW, "P1", 3, 0);
    const foe = place(s, "pyro_wick", "P2", 2, 0);
    const foeHp = s.cards[foe.instanceId].curHp;
    const casterHp = s.cards[caster.instanceId].curHp;
    conduct(s, s.cards[caster.instanceId]);
    // The caster is a Ranged Support spending its turn on the order, not on a
    // swing — and an enemy body is not in anyone's squad.
    expect(s.cards[caster.instanceId].curHp, "the caster took no damage").toBe(casterHp);
    expect(s.cards[foe.instanceId]?.curHp ?? 0,
      "an unconducted board leaves the far side alone").toBe(foeHp);
  });

  it("caps the squad at four however many could answer", () => {
    // Six allies with shots, four slots. The cap is the whole reason the number
    // is printed on the card.
    // `bigPrepState` IS the 5x5 — `prepState` takes (seed, priority) and has no
    // third argument, so the board this test needs was never being built.
    const s = bigPrepState(7, "P1");
    const caster = place(s, SCARECROW, "P1", 4, 0);
    let placed = 0;
    for (const col of [1, 2, 3, 4]) { place(s, "pyro_wick", "P1", 4, col); placed++; }
    for (const col of [0, 1]) { place(s, "pyro_wick", "P1", 3, col); placed++; }
    for (const col of [0, 1, 2, 3, 4]) place(s, "leaf_nettle", "P2", 2, col);
    expect(placed, "more allies than slots").toBeGreaterThan(4);
    const dead0 = Object.values(s.cards).filter((c) => c.owner === "P2" && c.curHp <= 0).length;
    conduct(s, s.cards[caster.instanceId]);
    const struck = Object.values(s.cards)
      .filter((c) => c.owner === "P2" && (c.curHp < getDef(c.defId).hp || c.curHp <= 0)).length;
    expect(struck - dead0, "at most four allies answered").toBeLessThanOrEqual(4);
  });
});

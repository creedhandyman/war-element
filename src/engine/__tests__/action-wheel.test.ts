// The action ring's seating, and what it does once a verb is armed.
//
// The ring sits ON the four slots around the acting card, which is where that
// card's targets are. That is right while you are choosing a verb and wrong the
// moment you have chosen one — so an armed ring collapses to the verb you
// picked plus a way out of it. This is that rule; the component around it is
// two divs and cannot be rendered in this repo's test setup.

import { describe, expect, it } from "vitest";
import { seatVerbs, type WheelVerb } from "../../ui/ActionWheel";

const verb = (key: string): WheelVerb => ({ key, short: key.toUpperCase(), tone: "#fff", onClick: () => {} });
/** The ring as App builds it: skip, attack, special, then talent OR card. */
const FULL = (fourth = "talent") => [verb("skip"), verb("basic"), verb("special"), verb(fourth)];
const CANCEL = verb("cancel");

describe("the ring at rest", () => {
  it("seats the four verbs on the compass, in the order handed over", () => {
    expect(seatVerbs(FULL()).map((v) => [v.key, v.seat])).toEqual([
      ["skip", "top"], ["basic", "right"], ["special", "bottom"], ["talent", "left"],
    ]);
  });

  it("stays whole when nothing is armed, even with a cancel available", () => {
    expect(seatVerbs(FULL(), null, CANCEL).length).toBe(4);
    expect(seatVerbs(FULL(), null, CANCEL).some((v) => v.key === "cancel")).toBe(false);
  });

  it("never renders more than the four seats it has", () => {
    const five = [...FULL(), verb("extra")];
    expect(seatVerbs(five).map((v) => v.key)).toEqual(["skip", "basic", "special", "talent"]);
  });
});

describe("the ring once a verb is armed", () => {
  it("drops to the armed verb and CANCEL, and keeps the verb in its own seat", () => {
    const chips = seatVerbs(FULL(), "basic", CANCEL);
    expect(chips.map((v) => v.key)).toEqual(["basic", "cancel"]);
    expect(chips[0].seat, "the armed verb does not move under the player").toBe("right");
  });

  it("puts CANCEL where the card-inspect button was", () => {
    // The seat nobody reaches for mid-action, and the one a thumb has already
    // learned is harmless.
    expect(seatVerbs(FULL("card"), "special", CANCEL)[1].seat).toBe("left");
    expect(seatVerbs(FULL(), "skip", CANCEL)[1].seat).toBe("left");
  });

  it("...and gets out of the armed verb's way when that verb IS in that seat", () => {
    // A Talent sits where CARD would. Two chips in one seat is one chip.
    const chips = seatVerbs(FULL(), "talent", CANCEL);
    expect(chips[0].seat).toBe("left");
    expect(chips[1].seat).toBe("right");
    expect(new Set(chips.map((v) => v.seat)).size, "no two chips share a seat").toBe(2);
  });

  it("leaves the ring whole when the armed mode has no chip of its own", () => {
    // Otherwise the player is left holding a lone CANCEL with no way to fire
    // the thing they armed.
    expect(seatVerbs(FULL(), "plummet", CANCEL).length).toBe(4);
  });

  it("leaves the ring whole when there is no cancel to offer", () => {
    expect(seatVerbs(FULL(), "basic").length).toBe(4);
  });
});

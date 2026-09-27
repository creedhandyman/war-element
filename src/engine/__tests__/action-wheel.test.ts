// The action ring's seating, and what it does once a verb is armed.
//
// The ring sits ON the four slots around the acting card, which is where that
// card's targets are. That is right while you are choosing a verb and wrong the
// moment you have chosen one — so an armed ring collapses to the verb you
// picked plus a way out of it. This is that rule; the component around it is
// two divs and cannot be rendered in this repo's test setup.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { seatVerbs, underWheel, wheelTap, type WheelVerb } from "../../ui/ActionWheel";

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

// ── a tap next to the ring ──────────────────────────────────────────────────
// Owner's call: the chips are small and sit on the squares around the acting
// card, so a tap that just missed one opened the card underneath. Next to the
// ring a card now opens on its second tap; everywhere else, on its first.
describe("a tap next to the ring", () => {
  const at = (row: number, col: number) => ({ row, col });

  it("covers the acting card and the eight squares around it, and nothing further", () => {
    const acting = at(2, 2);
    for (const [r, c] of [[2, 2], [1, 2], [3, 2], [2, 1], [2, 3], [1, 1], [1, 3], [3, 1], [3, 3]])
      expect(underWheel(acting, at(r, c)), `${r},${c}`).toBe(true);
    for (const [r, c] of [[0, 2], [4, 2], [2, 0], [2, 4], [0, 0], [4, 4], [1, 4]])
      expect(underWheel(acting, at(r, c)), `${r},${c}`).toBe(false);
    // No ring position, or a card that is not on the board: not under it.
    expect(underWheel(null, at(2, 2))).toBe(false);
    expect(underWheel(acting, null)).toBe(false);
  });

  it("lines a card up on the first tap and opens it on the second", () => {
    expect(wheelTap(null, "c1", true)).toBe("line-up");
    expect(wheelTap("c1", "c1", true)).toBe("open");
    // A tap on a DIFFERENT card next to the ring lines that one up instead.
    expect(wheelTap("c1", "c2", true)).toBe("line-up");
  });

  it("opens on one tap anywhere else, as it always did", () => {
    expect(wheelTap(null, "far", false)).toBe("open");
    expect(wheelTap("c1", "far", false)).toBe("open");
  });
});

describe("the wiring in App.tsx", () => {
  const APP = readFileSync(join(__dirname, "..", "..", "ui", "App.tsx"), "utf8").replace(/\r\n/g, "\n");
  const fn = (name: string) => {
    const at = APP.indexOf(`function ${name}(`);
    expect(at, `${name} exists`).toBeGreaterThan(-1);
    const end = APP.indexOf("\n  }\n", at);
    expect(end, `${name} ends`).toBeGreaterThan(at);
    return APP.slice(at, end);
  };

  it("measures 'next to the ring' from the acting card, only while the ring is up", () => {
    const tap = fn("inspectTapped");
    expect(tap).toContain("const near = wheelUp && underWheel(acting, card.pos);");
    expect(tap).toContain("wheelTap(linedUp, card.instanceId, near)");
    expect(tap).toContain("setDetailId(card.instanceId);");
  });

  it("every battle tap that inspects goes through it, and a target pick does not", () => {
    const click = fn("onSlotClick");
    const battle = click.slice(0, click.indexOf("// Spell cast — a spell is armed."));
    expect(battle).not.toContain("setDetailId(");
    expect(battle.match(/inspectTapped\(clicked\)/g)).toHaveLength(3);
    // The pick itself is untouched: a legal target is still taken on one tap.
    expect(battle).toContain("const next = [...picks, clicked.instanceId];");
    // ...and the idle tap on a card (no verb armed) inspects through it too.
    expect(click.slice(click.indexOf("// Default: one of your cards"))).toContain("inspectTapped(clicked);");
  });

  it("shows what the first tap did, and forgets it when the moment passes", () => {
    expect(APP).toContain('selectedId={sel?.kind === "card" ? sel.instanceId : linedUp}');
    expect(APP).toContain('(pending !== null || hint.startsWith("⚠") || linedUp !== null)');
    expect(APP).toContain("useEffect(() => { setLinedUp(null); }, [awaitingId, pending, wheelUp]);");
  });
});

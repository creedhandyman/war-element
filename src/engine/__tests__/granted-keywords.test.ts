// Granted keywords — BLOCK/REFLECT/REGEN/FLYING handed out by a Special, as
// opposed to printed on the card. They used to vanish into a generic "▲3" count
// on the board, which told an attacker that something good was happening but not
// that the thing in front of them reflects 2 for another two rounds.

import { describe, expect, it } from "vitest";
import { grantedKeywords, cardMods } from "../../ui/Token";
import { place, prepState } from "./helpers";

describe("granted keywords", () => {
  it("reports nothing for a card that was given nothing", () => {
    const s = prepState();
    const c = place(s, "leaf_greegon", "P1", 3, 0);
    expect(grantedKeywords(s.cards[c.instanceId])).toEqual([]);
  });

  it("names each grant and how long it holds", () => {
    const s = prepState();
    const c = place(s, "leaf_greegon", "P1", 3, 0, {
      blockRoundsLeft: 2, blockPower: 3,
      reflectRoundsLeft: 1, reflectPower: 4,
      regenRoundsLeft: 3, regenPower: 2,
      flyingRoundsLeft: 2,
    });
    const got = grantedKeywords(s.cards[c.instanceId]);
    expect(got.map((g) => g.kw)).toEqual(["BLOCK", "REFLECT", "REGEN", "FLYING"]);
    expect(got.map((g) => g.rounds)).toEqual([2, 1, 3, 2]);
    expect(got.find((g) => g.kw === "BLOCK")!.label).toContain("BLOCK 3");
    expect(got.find((g) => g.kw === "BLOCK")!.label).toContain("2 round(s)");
  });

  it("ignores a grant whose timer has run out", () => {
    const s = prepState();
    const c = place(s, "leaf_greegon", "P1", 3, 0, { blockRoundsLeft: 0, blockPower: 3 });
    expect(grantedKeywords(s.cards[c.instanceId])).toEqual([]);
  });

  it("counts a banked dodge in charges, not rounds", () => {
    // Blur lasts until it is spent, however many rounds that takes. Printing it
    // as "2r" would be a straightforward lie about when it expires.
    const s = prepState();
    const c = place(s, "dusk_hoax", "P1", 3, 0, { guaranteedDodge: 2 });
    const [dodge] = grantedKeywords(s.cards[c.instanceId]);
    expect(dodge.rounds).toBeNull();
    expect(dodge.charges).toBe(2);
    expect(dodge.label).toContain("until spent");
  });

  it("is no longer double-counted inside the generic buff list", () => {
    // The reason they were extracted. If cardMods still claimed them, the tile
    // would show both a REFLECT pip and a ▲1 that meant the same thing.
    const s = prepState();
    const c = place(s, "leaf_greegon", "P1", 3, 0, { reflectRoundsLeft: 2, reflectPower: 4 });
    const card = s.cards[c.instanceId];
    expect(grantedKeywords(card)).toHaveLength(1);
    expect(cardMods(s, card).buffs.join(" ")).not.toContain("REFLECT");
  });

  it("leaves real buffs alone", () => {
    // Timed +DMG has no keyword of its own and must keep counting toward ▲N.
    const s = prepState();
    const c = place(s, "leaf_greegon", "P1", 3, 0);
    s.cards[c.instanceId].buffs.push({ dmg: 3, sp: 0, rounds: 2 });
    expect(grantedKeywords(s.cards[c.instanceId])).toEqual([]);
    expect(cardMods(s, s.cards[c.instanceId]).buffs.join(" ")).toContain("+3 DMG");
  });
});

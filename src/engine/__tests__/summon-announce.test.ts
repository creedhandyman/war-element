// The legendary entrance: which cards get one, and where the card goes when it
// is done being looked at.

import { describe, expect, it } from "vitest";
import { announces, dropOnto, type Box } from "../../ui/SummonAnnounce";
import { CARDS } from "../../data/cards";

/** The entrance card, middle of a phone screen, and a board square under it. */
const CARD: Box = { left: 56, top: 180, width: 268, height: 368 };
const SLOT: Box = { left: 120, top: 520, width: 72, height: 72 };

describe("who gets an entrance", () => {
  it("is legendary and mythic, and nothing quieter", () => {
    const byRarity = (r: string) => CARDS.find((c) => c.rarity === r && !c.disguise)!;
    expect(announces(byRarity("legendary").id)).toBe(true);
    expect(announces(byRarity("mythic").id)).toBe(true);
    expect(announces(byRarity("epic").id)).toBe(false);
    expect(announces(byRarity("rare").id)).toBe(false);
  });

  it("...and a disguise is silent in BOTH directions", () => {
    // Announcing the true form names a card that is not what lands; announcing
    // the face gives a full-screen entrance to something meant to look like
    // furniture. Nightfang arrives as the Butler and nobody can tell.
    const masked = CARDS.filter((c) => c.disguise);
    expect(masked.length).toBeGreaterThan(0);
    for (const c of masked) {
      expect(announces(c.id), `${c.id} (the true form)`).toBe(false);
      expect(announces(c.disguise!.as), `${c.id}'s face`).toBe(false);
    }
  });
});

describe("lowering it onto the field", () => {
  it("flies the card's centre to the square's centre", () => {
    const d = dropOnto(CARD, SLOT)!;
    expect(d.dx).toBe((120 + 36) - (56 + 134));
    expect(d.dy).toBe((520 + 36) - (180 + 184));
    // It is going DOWN and the board is below the card — the one thing a reader
    // of this file would want to be sure of.
    expect(d.dy).toBeGreaterThan(0);
  });

  it("shrinks to fit INSIDE the square, not to its width", () => {
    // A card is taller than it is wide and a square is square, so scaling by
    // width alone would hang its chin over the slot below.
    const d = dropOnto(CARD, SLOT)!;
    expect(d.k).toBeCloseTo(72 / 368, 6);
    expect(CARD.height * d.k).toBeLessThanOrEqual(SLOT.height + 1e-9);
    expect(CARD.width * d.k).toBeLessThanOrEqual(SLOT.width + 1e-9);
  });

  it("lands a WIDE destination the same way — the tighter axis wins", () => {
    const wide: Box = { left: 0, top: 600, width: 300, height: 60 };
    const d = dropOnto(CARD, wide)!;
    expect(d.k).toBeCloseTo(60 / 368, 6);
  });

  it("has no flight to make when either rectangle is empty", () => {
    // A board that has not laid out yet, or a measurement taken as the screen
    // goes away: the entrance just fades, which is what it always did.
    expect(dropOnto({ ...CARD, width: 0 }, SLOT)).toBeNull();
    expect(dropOnto(CARD, { ...SLOT, height: 0 })).toBeNull();
  });

  it("an entrance on top of its own square is a pure shrink", () => {
    const over: Box = { left: 156, top: 300, width: 72, height: 72 };
    const d = dropOnto({ left: 56, top: 180, width: 268, height: 368 }, over)!;
    expect(Math.round(d.dx)).toBe(2);   // centres nearly line up
    expect(d.k).toBeLessThan(1);
  });
});

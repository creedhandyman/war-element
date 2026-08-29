// THE THIRD AND FOURTH SEATS ARE THE PLAYER'S TO CHOOSE.
//
// Domination is the only mode that deals more than two, and until now the extra
// seats were filled FOR the player — "the first premades not already seated" —
// so a four-way free-for-all was three armies you could not see and one you
// could. The lobby picks them now, and what has to hold is that the choice
// actually reaches the match: a deck named in the lobby is the deck sitting in
// that chair when the board is dealt.
//
// The picker itself is React and belongs to the browser pass (this repo runs
// `environment: "node"` and has no component tests). What is testable here is
// the seating, which is where a wiring mistake would actually cost the player a
// match.
import { describe, expect, it } from "vitest";
import { premadeDecksFor, deckSizeFor } from "../../data/custom-decks";
import { DOMINATION_7X7 } from "../../data/domination";
import { createInitialState } from "../state";
import type { PlayerId } from "../types";

const BOARD = DOMINATION_7X7.boardSize;
/** Four different decks off the shelf the 7x7 actually uses. */
const shelf = () => premadeDecksFor(BOARD);

function deal(seatCount: number) {
  const decks = shelf().slice(0, seatCount);
  const extra = (["P3", "P4"] as PlayerId[]).slice(0, seatCount - 2).map((id, i) => ({
    id,
    deck: decks[i + 2].cards,
    spells: decks[i + 2].spells,
  }));
  const s = createInitialState(
    7, decks[0].cards, decks[1].cards, [], decks[0].spells, decks[1].spells,
    BOARD, undefined, undefined, undefined, extra.length ? extra : undefined,
  );
  return { s, decks };
}

describe("Domination deals the decks the lobby chose", () => {
  it("the 7x7 shelf is the LARGE one — thirty cards, not the standard eighteen", () => {
    // `premadeDecksFor` matches `boardSize >= 5`, so the 7x7 draws from the
    // 30-card builds. A 4x4 shelf here would hand every seat a deck it cannot
    // legally field, and the picker offers exactly this list.
    expect(deckSizeFor(BOARD)).toBe(30);
    expect(shelf().length, "enough decks for four distinct seats").toBeGreaterThanOrEqual(4);
    for (const d of shelf().slice(0, 4)) expect(d.cards).toHaveLength(30);
  });

  it("seats three players, each with its own deck", () => {
    const { s } = deal(3);
    expect(s.seats).toEqual(["P1", "P2", "P3"]);
    expect(s.players.P3.deck.length + s.players.P3.hand.length, "P3 was dealt a real deck")
      .toBe(deckSizeFor(BOARD));
  });

  it("seats four, and no two share a list", () => {
    const { s } = deal(4);
    expect(s.seats).toEqual(["P1", "P2", "P3", "P4"]);
    // The whole reason the extra seats were auto-picked from the unseated
    // premades in the first place: a table of four copies of one deck is not a
    // free-for-all. Choosing them by hand must not lose that.
    const lists = (["P1", "P2", "P3", "P4"] as PlayerId[]).map(
      (p) => [...s.players[p].deck, ...s.players[p].hand.map((h) => h.defId)].sort().join(","),
    );
    expect(new Set(lists).size, "four distinct armies").toBe(4);
  });

  it("P3 and P4 get the deck they were NAMED, not the next one off the shelf", () => {
    // The actual regression this guards: the old code ignored any choice and
    // took `modePremades.filter(not already seated)[i]`. Naming a specific deck
    // for the third seat and finding a different one there is the failure.
    const want = shelf()[5];
    const s = createInitialState(
      7, shelf()[0].cards, shelf()[1].cards, [], undefined, undefined, BOARD,
      undefined, undefined, undefined,
      [{ id: "P3" as PlayerId, deck: want.cards, spells: want.spells }],
    );
    // DECK **PLUS HAND**. `deck` is the remaining draw pile and the opening
    // hand has already been dealt off it, so comparing the pile alone finds 26
    // of the 30 and looks like the wrong deck. What was dealt is the union.
    const seated = [
      ...s.players.P3.deck,
      ...s.players.P3.hand.map((h) => h.defId),
    ].sort().join(",");
    expect(seated, `P3 should be holding ${want.name}`).toBe([...want.cards].sort().join(","));
  });

  it("their spellbooks come with them", () => {
    // A seat dealt cards but no book would cast nothing all match, which is the
    // quiet half of this wiring and easy to drop.
    const want = shelf()[6];
    const s = createInitialState(
      7, shelf()[0].cards, shelf()[1].cards, [], undefined, undefined, BOARD,
      undefined, undefined, undefined,
      [{ id: "P3" as PlayerId, deck: want.cards, spells: want.spells }],
    );
    expect(s.players.P3.spellbook.length, "P3 brought its book").toBe(want.spells!.length);
  });

  it("two seats deal no extras at all — every other mode is a duel", () => {
    const { s } = deal(2);
    expect(s.seats).toEqual(["P1", "P2"]);
  });
});

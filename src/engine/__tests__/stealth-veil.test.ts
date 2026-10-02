// THE SHADOW FOLLOWS THE RULE. Owner, 2026-10-02: "Give the stealth animation
// to the two cards that have the ability to be stealth by sitting still.
// Magalogoon and Grizzly." The board's shadow read the STEALTH status alone, so
// a card hidden by a RULE — lying still (Swamp Monster, Thicket Ambush), or the
// STEALTH keyword before its first attack — sat untargetable with nothing on it
// to say so. The token now asks `isStealthed`, the question targeting asks, so
// what the board shows and what can be hit cannot drift apart.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { Token } from "../../ui/Token";
import { applyIntent } from "../phases";
import { isStealthed } from "../rules";
import type { GameState } from "../types";
import { bigPrepState, place } from "./helpers";

/** Draw the card the way the board does, and say whether it wears the shadow. */
function veiled(s: GameState, id: string): boolean {
  const html = renderToStaticMarkup(
    createElement(Token, { game: s, card: s.cards[id], viewer: "P1", selected: false, acting: false }),
  );
  return html.includes("tk-veil");
}

describe("the stealth shadow", () => {
  for (const defId of ["aqua_magalogoon", "leaf_grizzly"]) {
    const name = getDef(defId).name;

    it(`covers ${name} while it lies still, and comes off when it steps`, () => {
      const s = bigPrepState();
      const c = place(s, defId, "P1", 3, 2);
      expect(veiled(s, c.instanceId), "lying still").toBe(true);
      const moved = applyIntent(s, { type: "MOVE", player: "P1", instanceId: c.instanceId, to: { row: 2, col: 2 } });
      expect(moved.cards[c.instanceId].pos, "the step went through").toEqual({ row: 2, col: 2 });
      expect(veiled(moved, c.instanceId), "after the step").toBe(false);
    });

    it(`comes off ${name} once it has attacked`, () => {
      const s = bigPrepState();
      const c = place(s, defId, "P1", 3, 2, { attackedThisRound: true });
      expect(veiled(s, c.instanceId)).toBe(false);
    });
  }

  it("shows exactly when targeting says the card is hidden", () => {
    const s = bigPrepState();
    const cards = [
      place(s, "leaf_grizzly", "P1", 3, 0), //                      lying still
      place(s, "aqua_magalogoon", "P1", 3, 1, { movedThisRound: true }), // stepped
      place(s, "bolt_hacker", "P1", 3, 3), //                       keyword, not yet attacked
      place(s, "bolt_hacker", "P2", 1, 3, { attackedThisRound: true }), // keyword, attacked
      place(s, "leaf_oak", "P2", 1, 0, { status: { kind: "STEALTH", duration: 2, power: 0, source: "LEAF" } }),
      place(s, "leaf_oak", "P2", 1, 1), //                          nothing hides it
    ];
    for (const c of cards)
      expect(veiled(s, c.instanceId), getDef(c.defId).name).toBe(isStealthed(getDef(c.defId), c));
    expect(cards.map((c) => veiled(s, c.instanceId))).toEqual([true, false, true, false, true, false]);
  });
});

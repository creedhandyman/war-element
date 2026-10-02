// AN AURA LANDING, SEEN (ui/aura-glow.ts → Board → Token). Owner, 2026-10-02:
// "Glow animation when a card with an aura shows up. Allow that card to glow
// and the card that it affects glows as well. Only for a moment."
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AURA_STEP_MS, auraArrivals, type AuraGlow } from "../../ui/aura-glow";
import { Token } from "../../ui/Token";
import type { GameState } from "../types";
import { bigPrepState, place } from "./helpers";

/** The board, then the same board one step later with `defId` landed at `at`. */
function landing(setup: (s: GameState) => void, defId: string, row: number, col: number) {
  const before = bigPrepState();
  setup(before);
  const after = structuredClone(before);
  const holder = place(after, defId, "P1", row, col);
  return { before, after, holder };
}

describe("auraArrivals", () => {
  it("lights the card that landed, then each card its aura reaches, nearest first", () => {
    let near = "", far = "", other = "";
    const { before, after, holder } = landing((s) => {
      near = place(s, "leaf_oak", "P1", 4, 1).instanceId; // one step away
      far = place(s, "leaf_oak", "P1", 1, 2).instanceId; // three steps away
      other = place(s, "bolt_hacker", "P1", 4, 3).instanceId; // not LEAF: Efy's aura passes it by
    }, "leaf_efy", 4, 0);
    const lit = auraArrivals(before, after);
    expect(lit.get(holder.instanceId)).toEqual({ role: "source", delay: 0, element: "LEAF" });
    expect(lit.get(near)).toEqual({ role: "ally", delay: AURA_STEP_MS, element: "LEAF" });
    expect(lit.get(far)).toEqual({ role: "ally", delay: 3 * AURA_STEP_MS, element: "LEAF" });
    expect(lit.has(other)).toBe(false);
    expect(lit.size).toBe(3);
  });

  it("an aura that weighs on the other side lights the opponents it reaches as foes", () => {
    let foe = "";
    const { before, after } = landing((s) => { foe = place(s, "leaf_oak", "P2", 0, 2).instanceId; }, "dawn_supernova", 4, 2);
    expect(auraArrivals(before, after).get(foe)?.role).toBe("foe");
  });

  it("lands dark for a card with no aura, and stays dark for an aura card already standing", () => {
    const plain = landing((s) => { place(s, "leaf_oak", "P1", 4, 1); }, "leaf_oak", 4, 0);
    expect(auraArrivals(plain.before, plain.after).size).toBe(0);
    // Efy was already there; the oak is what arrived.
    const standing = landing((s) => { place(s, "leaf_efy", "P1", 4, 0); }, "leaf_oak", 4, 1);
    expect(auraArrivals(standing.before, standing.after).size).toBe(0);
  });
});

describe("the token's glow", () => {
  const draw = (aura: AuraGlow) => {
    const s = bigPrepState();
    const c = place(s, "leaf_efy", "P1", 4, 0);
    return renderToStaticMarkup(createElement(Token, { game: s, card: c, viewer: "P1", selected: false, acting: false, aura }));
  };
  const at = { key: 1, start: 0, delay: 0, element: "LEAF" as const };

  it("the card that landed glows in its element's colour and throws a ring", () => {
    const html = draw({ ...at, role: "source" });
    expect(html).toContain('class="tk-aura source"');
    expect(html).toContain("tk-aura-ring");
    expect(html).toContain("--aura:#4caf6d");
  });

  it("a card it reaches glows without the ring; an opponent glows in the threat colour (styles.css)", () => {
    const ally = draw({ ...at, role: "ally" });
    expect(ally).toContain('class="tk-aura ally"');
    expect(ally).not.toContain("tk-aura-ring");
    const foe = draw({ ...at, role: "foe" });
    expect(foe).toContain('class="tk-aura foe"');
    expect(foe).not.toContain("--aura:");
  });

  it("is not there when nothing is lit", () => {
    const s = bigPrepState();
    const c = place(s, "leaf_efy", "P1", 4, 0);
    const html = renderToStaticMarkup(createElement(Token, { game: s, card: c, viewer: "P1", selected: false, acting: false }));
    expect(html).not.toContain("tk-aura");
  });
});

// Imperator's Strike of Dawn, once an Heir already stands.
//
// The cast is a 5-cost special on a 3-round cooldown, and its whole body was
// "raise a 10/10". With an Heir already on the field that is the least
// interesting thing the crown could do — so the summons reaches higher: a
// random DAWN epic instead. This file pins the three things that make that a
// rule rather than a coincidence.
import { describe, expect, it } from "vitest";
import { CARDS, getDef } from "../../data/cards";
import { SPECIAL_HANDLERS } from "../combat";
import { boardCards, createInitialState } from "../state";
import type { GameState } from "../types";

const IMPERATOR = "dawn_imperator";
const HEIR = "dawn_heir_tok";

/** The params the CARD actually ships, not a hand-written copy of them. Three
 *  vacuous tests in this repo have been written by passing invented params to a
 *  handler and asserting on the invention. */
const params = () => {
  const sp = getDef(IMPERATOR).special!;
  return sp.params as Record<string, string | number | number[]>;
};

/** Plant a card for P1 at a slot and return it. */
function plant(g: GameState, defId: string, row: number, col: number) {
  const id = `t_${defId}_${row}${col}`;
  g.cards[id] = {
    instanceId: id, defId, owner: "P1",
    pos: { row: row as never, col: col as never },
    curHp: getDef(defId).hp, curShields: getDef(defId).shields,
    statuses: [], hasMoved: false, hasActed: false,
  } as never;
  return g.cards[id];
}

describe("Strike of Dawn escalates once an Heir stands", () => {
  it("is configured off the real card, aimed at its own token", () => {
    const p = params();
    expect(p.token).toBe(HEIR);
    // The escalation triggers on the very body the cast would otherwise raise.
    // If these ever drift apart the special escalates on the wrong condition.
    expect(p.escalateIfPresent).toBe(p.token);
    expect(p.escalateElement).toBe("DAWN");
    expect(p.escalateRarity).toBe("epic");
  });

  it("raises an Heir when none is standing", () => {
    const g = createInitialState(11, [IMPERATOR], ["leaf_sakuroot"], [], undefined, undefined, 4);
    const imp = plant(g, IMPERATOR, 3, 1);
    SPECIAL_HANDLERS.spawn(g, imp, [], params());
    const raised = boardCards(g, "P1").filter((c) => c.defId === HEIR);
    expect(raised, "the ordinary cast is untouched").toHaveLength(1);
  });

  it("raises a DAWN epic instead when one already is", () => {
    const g = createInitialState(11, [IMPERATOR], ["leaf_sakuroot"], [], undefined, undefined, 4);
    const imp = plant(g, IMPERATOR, 3, 1);
    plant(g, HEIR, 3, 2);
    const before = boardCards(g, "P1").map((c) => c.instanceId);
    SPECIAL_HANDLERS.spawn(g, imp, [], params());
    const born = boardCards(g, "P1").filter((c) => !before.includes(c.instanceId));
    expect(born, "something was raised").toHaveLength(1);
    const def = getDef(born[0].defId);
    expect(def.element).toBe("DAWN");
    expect(def.rarity).toBe("epic");
    expect(born[0].defId, "and NOT a second Heir").not.toBe(HEIR);
  });

  it("rolls from the whole DAWN epic pool, not one favourite", () => {
    // A pool of fifteen that always returns the same card is indistinguishable
    // from a hardcoded spawn, which is the failure this is really watching for.
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const g = createInitialState(seed, [IMPERATOR], ["leaf_sakuroot"], [], undefined, undefined, 5);
      const imp = plant(g, IMPERATOR, 4, 2);
      plant(g, HEIR, 4, 3);
      const before = boardCards(g, "P1").map((c) => c.instanceId);
      SPECIAL_HANDLERS.spawn(g, imp, [], params());
      for (const c of boardCards(g, "P1")) if (!before.includes(c.instanceId)) seen.add(c.defId);
    }
    const pool = CARDS.filter((c) => c.element === "DAWN" && c.rarity === "epic");
    expect(pool.length).toBeGreaterThan(4);
    expect(seen.size, `saw ${[...seen].join(", ")}`).toBeGreaterThan(3);
    for (const id of seen) expect(pool.some((c) => c.id === id), id).toBe(true);
  });

  it("still commands the charge either way", () => {
    // The escalation replaces WHAT is raised, and nothing else. The rider that
    // makes the special worth its cost has to survive the branch.
    for (const withHeir of [false, true]) {
      const g = createInitialState(7, [IMPERATOR], ["leaf_sakuroot"], [], undefined, undefined, 4);
      const imp = plant(g, IMPERATOR, 3, 1);
      if (withHeir) plant(g, HEIR, 3, 2);
      SPECIAL_HANDLERS.spawn(g, imp, [], params());
      expect(
        g.log.some((l) => l.includes("commands the charge")),
        withHeir ? "with an Heir" : "without one",
      ).toBe(true);
    }
  });

  it("only looks at the caster's own side", () => {
    // An enemy Heir in a mirror is a reason to raise yours, not to skip it.
    const g = createInitialState(11, [IMPERATOR], [IMPERATOR], [], undefined, undefined, 4);
    const imp = plant(g, IMPERATOR, 3, 1);
    const foe = plant(g, HEIR, 1, 1);
    foe.owner = "P2";
    SPECIAL_HANDLERS.spawn(g, imp, [], params());
    expect(boardCards(g, "P1").filter((c) => c.defId === HEIR)).toHaveLength(1);
  });
});

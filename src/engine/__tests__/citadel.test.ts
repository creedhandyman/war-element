// NOTHING STANDS ON A CITADEL (owner's call, 2026-10-02).
//
// A Point's centre was closed to the Move and to `spawnTokens`, and open to
// everything else: a headless audit of 150 Domination games found ~200 bodies
// standing on a citadel, put there by FRIGHTEN, trample shoves, charges,
// roll-throughs, drags and spawns. Every placement path now asks
// `groundClosed`, and `keepOffClosedGround` backstops both engine entry points.
// These pin both halves: the paths that leaked, the backstop itself, and a run
// of real matches in which the backstop is never needed.
import { describe, expect, it } from "vitest";
import { DOMINATION_7X7, isImpassable, newDomination } from "../../data/domination";
import { premadeDecksFor } from "../../data/custom-decks";
import { applyStatus } from "../combat";
import { advance, createInitialState } from "../index";
import { CITADEL_EVICTED } from "../phases";
import { shoveTarget } from "../rules";
import { boardCards, groundClosed } from "../state";
import { place } from "./helpers";
import type { GameState, PlayerId, Pos } from "../types";

const DECK = [
  "leaf_oak", "leaf_python", "leaf_birch", "leaf_stickers", "leaf_nettle", "leaf_weeds",
  "leaf_sticks", "leaf_cactus", "leaf_leaf", "leaf_stickviper", "leaf_hunter", "leaf_walking_tree",
];
/** Point A's citadel on the 7x7. */
const CITADEL = DOMINATION_7X7.pois[0].centre;

function domState(): GameState {
  const s: GameState = createInitialState(7, DECK, DECK, ["P1", "P2"], undefined, [], DOMINATION_7X7.boardSize);
  s.domination = newDomination(DOMINATION_7X7);
  for (const c of boardCards(s)) delete s.cards[c.instanceId];
  s.phase = "prep";
  s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
  return s;
}

const onCitadel = (s: GameState) =>
  boardCards(s).filter((c) => c.pos && isImpassable(DOMINATION_7X7, c.pos.row, c.pos.col));

describe("a Point's citadel is closed ground", () => {
  it("the terrain rule says so, and only in Domination", () => {
    expect(groundClosed(domState(), CITADEL.row, CITADEL.col)).toBe(true);
    expect(groundClosed(domState(), 3, 3), "the Well is open").toBe(false);
  });

  it("a FRIGHTENED card does not retreat onto one", () => {
    const s = domState();
    // P1 retreats toward row +1; from just above the citadel that is the citadel.
    const scared = place(s, "leaf_python", "P1", CITADEL.row - 1, CITADEL.col);
    applyStatus(s, s.cards[scared.instanceId], "FRIGHTEN", 1, 0, "DUSK");
    expect(s.cards[scared.instanceId].pos).toEqual({ row: CITADEL.row - 1, col: CITADEL.col });
  });

  it("a trample shove never drives its victim onto one", () => {
    const s = domState();
    // P1 bulls DOWN the column into a light P2 body standing right above the
    // citadel: straight back is the citadel itself.
    const bull = place(s, "dawn_warphant", "P1", CITADEL.row - 2, CITADEL.col);
    place(s, "leaf_birch", "P2", CITADEL.row - 1, CITADEL.col);
    const shove = shoveTarget(s, s.cards[bull.instanceId], { row: CITADEL.row - 1, col: CITADEL.col } as Pos);
    if (shove) expect(isImpassable(DOMINATION_7X7, shove.dest.row, shove.dest.col)).toBe(false);
  });

  it("the backstop moves anything left on one, and says so", () => {
    const s = domState();
    const stray = place(s, "leaf_python", "P1", 4, 4);
    s.cards[stray.instanceId].pos = { ...CITADEL };
    s.phase = "draw";
    const next = advance(s);
    const pos = next.cards[stray.instanceId].pos!;
    expect(isImpassable(DOMINATION_7X7, pos.row, pos.col)).toBe(false);
    expect(Math.max(Math.abs(pos.row - CITADEL.row), Math.abs(pos.col - CITADEL.col)), "the nearest open square").toBe(1);
    expect(next.log.some((l) => l.includes(CITADEL_EVICTED))).toBe(true);
  });

  it("real matches never put a body on one — and never need the backstop", () => {
    // 2-, 3- and 4-seat tables off the large shelf. The audit that found the
    // leaks saw one in about every second game, so 24 is enough to catch a
    // regression in any of the common paths.
    const shelf = premadeDecksFor(7);
    for (let g = 0; g < 24; g++) {
      const seats = 2 + (g % 3);
      const pick = (k: number) => shelf[(g * 7 + k * 11) % shelf.length];
      const extra = (["P3", "P4"] as PlayerId[]).slice(0, seats - 2)
        .map((id, i) => ({ id, deck: pick(i + 2).cards, spells: pick(i + 2).spells }));
      let s: GameState = createInitialState(
        900 + g, pick(0).cards, pick(1).cards, [], pick(0).spells, pick(1).spells, 7,
        undefined, undefined, undefined, extra.length ? extra : undefined,
      );
      s.domination = newDomination(DOMINATION_7X7);
      // The backstop guarantees nothing is LEFT on a citadel after a step, so
      // what this watches is whether it ever had to act: its log line is the
      // last thing a step writes, read every step because a long match's log
      // is trimmed.
      const missed: string[] = [];
      for (let n = 0; s.phase !== "gameover" && n < 20000; n++) {
        s = advance(s);
        expect(onCitadel(s).map((c) => c.defId), `game ${g}`).toEqual([]);
        const tail = s.log[s.log.length - 1] ?? "";
        if (tail.includes(CITADEL_EVICTED)) missed.push(s.log.slice(-4).join(" / "));
      }
      expect(missed, `game ${g}: a placement path that skips groundClosed`).toEqual([]);
    }
  }, 120_000);
});

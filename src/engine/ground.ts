// WHICH GROUND A MATCH IS FOUGHT ON (owner, 2026-10-03).
//
// A Story fight is painted as its region's element. Everything else (Arena,
// the Void Tower, training) takes the element the match is MADE of: every card
// in every seated deck is counted, the most common element wins, and a tie is
// settled by the match seed, so two decks with five Pyro each get either
// basalt or whatever the other five are, not always the same one.
//
// Picked once, at createInitialState, and stored on the state: the decks are
// whole then (nothing drawn, nothing summoned), so the ground cannot drift as
// tokens arrive. It also means an online opponent and a replay land on the same
// ground. Purely cosmetic: nothing in the engine reads it.
import { CARD_INDEX } from "../data/cards";

/** The elements that have a ground texture (public/ground/<el>.webp). VOID and
 *  anything else are not counted, so a deck of them falls through to stone. */
export const GROUND_ELEMENTS = ["LEAF", "PYRO", "AQUA", "GALE", "BOLT", "BORE", "DUSK", "DAWN"] as const;

/** The most common ground element across these decks (defIds), ties broken by
 *  `seed`. Undefined when no card counts — the board keeps its stone.
 *
 *  Draws NOTHING from the match's RNG cursor: like `dealSuits`, it hashes the
 *  seed on a stream of its own, so adding it changed no shuffle or coin. */
export function pickGround(seed: number, decks: readonly (readonly string[])[]): string | undefined {
  const count = new Map<string, number>();
  for (const deck of decks)
    for (const id of deck) {
      const el = CARD_INDEX[id]?.element; // tolerant: a fixture may hold made-up ids
      if (el && (GROUND_ELEMENTS as readonly string[]).includes(el)) count.set(el, (count.get(el) ?? 0) + 1);
    }
  if (count.size === 0) return undefined;
  const top = Math.max(...count.values());
  // In GROUND_ELEMENTS order, so the tie-break never depends on Map order.
  const tied = GROUND_ELEMENTS.filter((el) => count.get(el) === top);
  return tied[groundHash(seed) % tied.length];
}

/** mulberry32's mix, keyed away from the match stream and from `dealSuits`. */
function groundHash(seed: number): number {
  let t = ((seed ^ 0x6a09e667) + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

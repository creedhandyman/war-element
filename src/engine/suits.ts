// SUITS — the AI's personality, dealt fresh every match.
//
// The four suits already existed, as a per-seat glyph in the UI: P1 was always
// ♠, P2 always ♣, and the shape carried nothing but "which seat is this". A
// fixed decoration on a fixed seat is a label, not information.
//
// Now the suit is a TELL. It is dealt at random each game and it says how that
// seat's AI will play, so reading the glyph before the first summon tells you
// what you are about to be hit with — and tells you something different next
// game with the same decks on the same board.
//
//   ♠ Spades    ATTACK    — bodies out early, forward at every opportunity.
//   ♣ Clubs     DEFENSE   — holds the line, and makes you come to it.
//   ♥ Hearts    CONTROL   — spells and Specials first; wins the board, not the race.
//   ♦ Diamonds  HOARD     — banks gold for the heavy end. Slow, then very large.
//
// DEALT FROM THE MATCH SEED, not from Math.random: the engine is a
// deterministic reducer and a replay, an online match and a test all have to
// land on the same deal. `dealSuits` shuffles through the same `shuffle` the
// opening hand uses, so the suits are part of the seed like everything else.
//
// STYLE IS A BIAS, NOT A SCRIPT. Every tunable here nudges an existing decision
// — which card to reach for, whether to leave the home row, when a Special is
// worth its magic — and none of them switch a behaviour off. An AI that
// refused to advance would not read as defensive, it would read as broken, so
// Clubs still takes a capture and still breaks a standoff. The difference is
// what it does when it has a CHOICE.
import type { PlayerId, Suit } from "./types";

export type { Suit };

/** In deal order, which is also the order the glyphs read on screen. */
export const SUITS: readonly Suit[] = ["spade", "club", "heart", "diamond"];

/** What a card the AI reaches for should be sorted by.
 *  - `biggest`    the old behaviour: highest cost it can afford
 *  - `cheapest`   most bodies soonest
 *  - `toughest`   the wall: HP + shields
 *  - `caster`     Support and Mage first, then biggest */
export type SummonTaste = "biggest" | "cheapest" | "toughest" | "caster";

export interface SuitStyle {
  key: Suit;
  glyph: string;
  /** One word, for the versus screen. */
  name: string;
  /** One line, in the game's voice, for a tooltip or the intro. */
  blurb: string;
  summon: SummonTaste;
  /** BANK GOLD instead of spending it, unless what it can afford is at least
   *  this fraction of the priciest card in hand. 0 disables banking entirely.
   *
   *  Only Diamonds banks, and only up to `bankMaxRounds` — a hoarder that
   *  never spends is not a long-term thinker, it is an empty board. */
  bankFor: number;
  /** Rounds after which Diamonds stops saving and starts deploying. */
  bankMaxRounds: number;
  /** How readily it leaves the Home row when nothing forces the issue.
   *  `reluctant` skips the ordinary advance — it still captures, and still
   *  breaks a standoff, because neither of those is a choice. */
  advance: "eager" | "normal" | "reluctant";
  /** Magic surplus, above a Special's cost, before firing a non-lethal one.
   *  Lower = readier. The engine's own default was 2. */
  specialSurplus: number;
}

export const SUIT_STYLES: Record<Suit, SuitStyle> = {
  spade: {
    key: "spade", glyph: "♠", name: "Attack",
    blurb: "Bodies out early and forward at every opportunity. It will trade with you.",
    summon: "cheapest", bankFor: 0, bankMaxRounds: 0, advance: "eager", specialSurplus: 1,
  },
  club: {
    key: "club", glyph: "♣", name: "Defense",
    blurb: "Holds its line and makes you come to it. Everything it fields is hard to move.",
    summon: "toughest", bankFor: 0, bankMaxRounds: 0, advance: "reluctant", specialSurplus: 3,
  },
  heart: {
    key: "heart", glyph: "♥", name: "Control",
    blurb: "Spells and Specials first. It would rather own the board than win the race.",
    summon: "caster", bankFor: 0, bankMaxRounds: 0, advance: "normal", specialSurplus: 0,
  },
  diamond: {
    key: "diamond", glyph: "♦", name: "Hoard",
    blurb: "Banks its gold for the heavy end. Slow to start, and then very large.",
    summon: "biggest", bankFor: 0.6, bankMaxRounds: 3, advance: "normal", specialSurplus: 2,
  },
};

/** Deal the four suits across the four seats, from the match seed.
 *
 *  ON ITS OWN DERIVATION, deliberately, rather than through `rng.ts`'s shared
 *  cursor. That cursor is a single advancing stream and every shuffle, coin and
 *  tie-break in the match reads from it in order — so spending four draws here
 *  would shift the opening hands of every seeded game ever recorded, and with
 *  them every test, replay and online match. Keyed off the same seed, so it is
 *  still deterministic and still replays; it simply does not stand in the
 *  queue.
 *
 *  Fisher-Yates over a local copy, so the deal is a permutation — four
 *  different suits, never two seats reading the same tell. */
export function dealSuits(seed: number): Record<PlayerId, Suit> {
  // mulberry32, keyed away from the match stream so the two never collide.
  let a = (seed ^ 0x5ba1c0de) | 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = [...SUITS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { P1: order[0], P2: order[1], P3: order[2], P4: order[3] };
}

/** The style a seat is playing. Falls back to the seat's traditional suit when
 *  a state predates the deal (a saved game, or a hand-built test fixture), so
 *  nothing has to check for absence. */
export function styleOf(
  seatSuits: Partial<Record<PlayerId, Suit>> | undefined,
  seat: PlayerId,
): SuitStyle {
  const fallback: Record<PlayerId, Suit> = {
    P1: "spade", P2: "club", P3: "diamond", P4: "heart",
  };
  return SUIT_STYLES[seatSuits?.[seat] ?? fallback[seat]];
}

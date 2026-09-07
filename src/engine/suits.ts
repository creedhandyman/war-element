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
//   ♠ Spades    ATTACK    — the hardest hitter it can afford, forward always.
//   ♣ Clubs     DEFENSE   — holds the line, and makes you come to it.
//   ♥ Hearts    CONTROL   — Specials first, and it genuinely does not race.
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
//
// ─────────────────────────────────────────────────────────────────────────
// BALANCED AS A MATRIX, not one style at a time. Every suit against every
// other, both seats played so the second-seat advantage cancels, 80 games a
// pairing, heroes ON:
//
//              vs   Attack Defense Control   Hoard      overall
//     ♠ Attack        —      46%     53%     51%         50.0%
//     ♣ Defense      54%      —      44%     59%         52.1%
//     ♥ Control      48%     56%      —      46%         50.0%
//     ♦ Hoard        49%     41%     54%      —          47.9%
//
// Spread 4.2 points across the four.
//
// THE CYCLE IS THE POINT: Attack beats Control, Control beats Defense, Defense
// beats Attack. Three of the four counter each other, which is what keeps a
// dealt suit a matchup rather than a difficulty roll.
//
// CONTROL WAS THE OUTLIER — 60.0% with no losing matchup at all — and what
// fixed it was not a nerf to its strengths but giving it the COST its identity
// already implied. Every other style pays for itself: Attack walks into walls,
// Hoard starves early, Defense gives up tempo. Control had three upsides and no
// bill, so it got the two it should always have had — it does not race
// (`reluctant`), and it curves out slowly because its casters are expensive (a
// light two-round bank). 60.0% -> 53.3%, and it now LOSES to Attack, which is
// the part that matters: a style with no bad matchup is not a personality, it
// is just the best one.
//
// Two things that did NOT work, recorded so they are not retried: moving the
// Special-eagerness between suits (0.4 points) and re-ordering the caster
// preference (1.3 points, the wrong way). Neither `specialSurplus` nor the
// summon RANK is a real lever — the costs are.
//
// HOARD STOPPED HOARDING GOLD, and that is the other half of this table. It
// banked for three rounds, lost to everything, and lost worst of all to the
// turtle (42.3% against Defense over 300 games). The economy simply does not
// pay for saving: income is 1/round early, so a 60%-of-dearest threshold is
// unreachable inside the window, and `POOL_CARRYOVER_CAP` truncates gold to 10
// before each round's income lands — a hoarder was saving into a bucket with a
// hole in it. All of the tempo cost, none of the payoff.
//
// So the long game is now what COMPOUNDS rather than what is banked: Diamonds
// fields cards that grow (on-kill ramps, per-round growth), which is the one
// form of "long term" this economy actually rewards. 42.3% -> 47.7% against
// Defense, and the spread across all four fell from 14.2 points to 4.2.
//
// The bank gate is kept and now respects the carryover cap. It is unused by any
// style, but it was wrong in a way the next author would have hit.
//
// Attack's first cut took `cheapest` and measured 40.4% overall, losing to
// Defense 31-63: a board of 1-drops run eagerly into a wall. `hardest` is the
// same identity spent better and took it to 48.3%.
import type { PlayerId, Suit } from "./types";

export type { Suit };

/** In deal order, which is also the order the glyphs read on screen. */
export const SUITS: readonly Suit[] = ["spade", "club", "heart", "diamond"];

/** What a card the AI reaches for should be sorted by.
 *  - `biggest`    the old behaviour: highest cost it can afford
 *  - `cheapest`   most bodies soonest
 *  - `hardest`    the most damage on the board: dmg x hits
 *  - `toughest`   the wall: HP + shields
 *  - `caster`     Mages first, then biggest
 *  - `scaling`    cards that GROW: on-kill ramps and per-round growth
 *
 *  `cheapest` was Spades' first taste and it measured as the worst thing in the
 *  set: a board of 1-drops run eagerly into a wall lost to Defense 31-63. The
 *  style is "attack", not "spend little" — so it reaches for the biggest hitter
 *  it can afford instead, and the eagerness stays in the MOVEMENT where it
 *  belongs. */
export type SummonTaste = "biggest" | "cheapest" | "hardest" | "toughest" | "caster" | "scaling";

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
    blurb: "The hardest hitter it can afford, pushed forward at every opportunity.",
    summon: "hardest", bankFor: 0, bankMaxRounds: 0, advance: "eager", specialSurplus: 1,
  },
  club: {
    key: "club", glyph: "♣", name: "Defense",
    blurb: "Holds its line and makes you come to it. Everything it fields is hard to move.",
    summon: "toughest", bankFor: 0, bankMaxRounds: 0, advance: "reluctant", specialSurplus: 3,
  },
  heart: {
    key: "heart", glyph: "♥", name: "Control",
    blurb: "Specials first, and slow to start. It would rather own the board than win the race.",
    summon: "caster", bankFor: 0, bankMaxRounds: 0, advance: "reluctant", specialSurplus: 0,
  },
  diamond: {
    key: "diamond", glyph: "♦", name: "Hoard",
    blurb: "Fields what compounds. Every kill and every round makes its line worse to face.",
    summon: "scaling", bankFor: 0, bankMaxRounds: 0, advance: "normal", specialSurplus: 2,
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

/** Pin one seat to a chosen suit.
 *
 *  A player who picks a hero is choosing their suit (see `heroes.ts`), and the
 *  other seats keep whatever they were dealt.
 *
 *  IT ASSIGNS, IT DOES NOT SWAP, and that was a bug worth its own paragraph.
 *  The first cut swapped — hand the seat what it wants, give its old suit to
 *  whoever was holding it — to keep the deal a permutation. That is right for a
 *  DEAL and wrong for a CHOICE: with both seats pinned from their own decks,
 *  two players who picked the same hero had the second pin quietly steal it
 *  back off the first, and one of them played a hero they never chose. A choice
 *  the game silently overrides is worse than a duplicate.
 *
 *  So two seats CAN share a suit now. `suitVariantOf` is what keeps the board
 *  readable when they do.
 *
 *  Returns a new record; the caller owns when to apply it. */
export function pinSuit(
  dealt: Record<PlayerId, Suit>, seat: PlayerId, want: Suit,
): Record<PlayerId, Suit> {
  return { ...dealt, [seat]: want };
}

/** Which SHADE of its suit a seat wears: 0 for the first seat holding it in
 *  seating order, 1 for anyone after.
 *
 *  Suits used to be unique by construction, so the glyph alone identified a
 *  seat. Now that a chosen suit can be duplicated, two seats can show the same
 *  shape — and the colour is the channel that has to separate them, exactly as
 *  it did before the suits meant anything. The FIRST seat keeps the familiar
 *  colour so the common case never changes. */
export function suitVariantOf(
  seatSuits: Partial<Record<PlayerId, Suit>> | undefined, seat: PlayerId,
): 0 | 1 {
  const mine = seatSuits?.[seat];
  if (!mine) return 0;
  for (const other of ["P1", "P2", "P3", "P4"] as PlayerId[]) {
    if (other === seat) break;              // nobody before us shares it
    if (seatSuits?.[other] === mine) return 1;
  }
  return 0;
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

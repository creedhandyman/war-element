// HEROES — one per suit, and the suit is how you wear one.
//
// The suit was already the seat's identity (`suits.ts`): dealt per match, and
// for an AI seat it decides how that AI plays. A hero binds to the same channel
// from the other side — YOU pick a hero, and that choice sets your suit. One
// glyph then says everything about a seat: what it is running on, and (for an
// AI) how it will play. Nothing new to learn and nothing extra on screen.
//
// ─────────────────────────────────────────────────────────────────────────
// BOUNDARY SHIFTS, NOT RATE CHANGES. This is the whole safety argument.
//
// A rate change ("+1 gold per round") compounds without limit: by round 20 it
// is +20, and the hero is balanced at one match length and wrong at every
// other. A boundary shift ("reach gold tier 2 two rounds early") is worth a
// fixed few points and then the curves RE-CONVERGE — the hero is ahead early
// and even later, which is a tempo effect and a bounded one. Every hero here
// shifts boundaries only, expressed as rounds of offset into
// `poolGainForRound`.
//
// ─────────────────────────────────────────────────────────────────────────
// THE EXCHANGE RATE IS NOT 1:1, AND IT IS NOT CLOSE. Measured over 120 mirror
// matches per row (same deck both seats, so the baseline is symmetric and the
// only variable is the bonus):
//
//     bonus to P2, per round      P2 win rate      lift over baseline
//     none (baseline)                47.5%                 —
//     +1 GOLD                        86.7%              +39.2
//     +2 GOLD                        97.5%              +50.0
//     +1 MAGIC                       55.8%               +8.3
//     +2 MAGIC                       61.7%              +14.2
//     +3 MAGIC                       65.8%              +18.3
//     +4 MAGIC                       68.3%              +20.8
//
// Gold is worth MORE THAN FOUR TIMES magic, and the gap widens: magic's
// returns diminish hard (+8.3, then +5.9, +4.1, +2.5) while gold's do not.
// The reason is structural — a board can only fire so many Specials a round, so
// surplus magic evaporates, where gold always becomes a body that then works
// every round after.
//
// Two rules follow, and both are load-bearing here:
//   1. GOLD SHIFTS ARE TINY. One round of offset is already a real edge.
//   2. MAGIC SHIFTS CAN BE GENEROUS. Three rounds of magic offset costs less
//      than one round of gold, so the Mage can actually feel like a Mage.
//
// A hero that trades gold for magic at anything near parity is taking a
// downgrade, not a sidegrade. None of these do.
//
// ─────────────────────────────────────────────────────────────────────────
// AND THE ROSTER, MEASURED THE SAME WAY. Both seats pinned to one AI style and
// the hero's income delta injected by hand — varying the suit itself would have
// varied the PERSONALITY reading the economy, which is what made the first
// attempt at this table nonsense (two heroes with identical curves posted 66.7%
// and 50.0%).
//
//     hero        curve              win rate    vs baseline
//     Sentinel    —                    66.7%         control
//     Warlord     gold+1 magic−1       64.2%          −2.5
//     Mage        gold−1 magic+5       65.8%          −0.8
//     Scholar     —                    66.7%         control
//
// (The control sits at 66.7% rather than 50% because a defensive mirror runs
// long and the timeout tiebreak favours the second seat — a real asymmetry, but
// one that cancels here since every row shares it.)
import type { PlayerId, Suit } from "./types";

export interface Hero {
  suit: Suit;
  name: string;
  /** One sentence. If it needs two, the hero is too complicated. */
  identity: string;
  /** Rounds of offset into the gold curve. POSITIVE = earlier tiers. */
  goldShift: number;
  /** Rounds of offset into the magic curve. POSITIVE = earlier tiers. */
  magicShift: number;
  /** The one visible thing — a free, once-per-game ability, so the hero has
   *  presence rather than being an invisible arithmetic change. Declared here
   *  and NOT yet wired: the curve shift is the part that needed measuring and
   *  the part that can be wrong, so it ships first and alone. */
  power: { name: string; text: string };
}

export const HEROES: Record<Suit, Hero> = {
  spade: {
    suit: "spade", name: "Warlord",
    identity: "Bodies on the board sooner. Fewer tricks, more army.",
    // ONE round, against the Mage's three. Gold is the strong currency and a
    // Warlord that opened two tiers up would simply win the opening.
    goldShift: 1, magicShift: -1,
    power: { name: "Muster", text: "Once per game, free: summon a card from hand at no gold cost." },
  },
  club: {
    suit: "club", name: "Sentinel",
    identity: "The baseline. No curve to learn, and always viable.",
    // THE DEFAULT, deliberately unmodified. A roster needs a seat that is
    // simply the game as designed, or "balanced" has nothing to mean.
    goldShift: 0, magicShift: 0,
    power: { name: "Hold the Line", text: "Once per game, free: every ally gains 2 shields." },
  },
  heart: {
    suit: "heart", name: "Mage",
    identity: "Specials early and often, paid for out of the board.",
    // FIVE rounds of magic for ONE of gold, and it is still not a bargain —
    // which is the exchange rate arriving as a design constraint. The first cut
    // traded 1 gold for 3 magic, looked generous, and measured at −7.5 points
    // against the baseline. At +5 it lands at −0.8. Anything that reads as a
    // fair-looking trade here is a trap for the player who takes it.
    goldShift: -1, magicShift: 5,
    power: { name: "Arcane Focus", text: "Once per game, free: refund the magic cost of one Special." },
  },
  diamond: {
    suit: "diamond", name: "Scholar",
    identity: "Turns the cards it cannot cast into the gold to cast them.",
    // NO CURVE SHIFT. The Scholar's axis is DRAW, and draw already outruns gold
    // roughly three to one — a hero that drew more would be handing the player
    // a bigger pile of cards they cannot afford. Its power converts the surplus
    // instead, which is why it is the one hero whose ability IS the identity.
    goldShift: 0, magicShift: 0,
    power: { name: "Requisition", text: "Once per game, free: discard 2 cards, gain 4 gold." },
  },
};

export const heroOf = (suit: Suit): Hero => HEROES[suit];

/** The round to read a seat's GOLD curve at — the real round, shifted by the
 *  hero. Floored at 1: a penalty must slow the ramp, never run it backwards.
 *
 *  `on` is `GameState.heroes`. With heroes off this is the identity function,
 *  which is what every mode that shipped before them still gets — a dealt suit
 *  alone must never move the economy. */
export const goldRoundFor = (round: number, suit: Suit | undefined, on = false): number =>
  on && suit ? Math.max(1, round + HEROES[suit].goldShift) : round;

/** The same for MAGIC. */
export const magicRoundFor = (round: number, suit: Suit | undefined, on = false): number =>
  on && suit ? Math.max(1, round + HEROES[suit].magicShift) : round;

/** Every seat's hero, for a readout. */
export const heroesOf = (
  seatSuits: Partial<Record<PlayerId, Suit>> | undefined,
): Partial<Record<PlayerId, Hero>> => {
  const out: Partial<Record<PlayerId, Hero>> = {};
  for (const seat of ["P1", "P2", "P3", "P4"] as PlayerId[]) {
    const s = seatSuits?.[seat];
    if (s) out[seat] = HEROES[s];
  }
  return out;
};

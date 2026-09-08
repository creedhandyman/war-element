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
//
// ──────────────────────────────────────────────────────────────────
// THE POWERS BROKE THE TABLE, and the fix was not the one it looked like.
//
// Wiring them and letting the AI use them took the spread across the four
// suits from 4.2 points to 59.6: Attack 82.1%, Hoard 67.5%, Defense 27.9%,
// Control 22.5%. The two ECONOMY powers (a free body, a purse of gold) buried
// the two combat ones, exactly as the exchange rate above predicts.
//
// What did NOT work: buffing the weak two. Hold the Line went 3 shields to 5
// plus a 6 HP heal and Arcane Focus went 2 free casts to 4 — 60 to 100% more
// power — and the table moved 0.4 points. They were never size-limited.
//
// What DID: `HERO_MIN_ROUND`. The economy powers were not too big, they were
// too EARLY. Income is 1 gold a round until round 5, so a free body on round
// one is five rounds of economy arriving at once, and no amount of shields
// competes with that. Gating every power behind round 5 took the spread from
// 34.2 to 11.2 without touching a single magnitude.
//
// AND THE LAST 7 POINTS WERE A TYPO. Control sat at 43.3% because its AI never
// fired Arcane Focus — not rarely, NEVER, in 0% of games while the other three
// fired in 100%. The trigger matched the reason string "Not enough Magic" and
// the engine says "Not enough magic". One capital letter, no error, a branch
// that was simply never true, and a hero power that did not exist in play. It
// compares numbers now, Control fires in 73% of games, and the table closed to
// where the styles alone were:
//
//     suit        overall     (spread 4.2 points)
//     ♣ Defense    51.7%
//     ♠ Attack     51.2%
//     ♦ Hoard      49.6%
//     ♥ Control    47.5%
//
// A power measured as WEAK and a power never FIRED look identical in a win
// rate table. The usage rate is what tells them apart, and it is worth
// checking first the next time a suit reads as underpowered.
//
// ──────────────────────────────────────────────────────────────────
// THAT 4.2 NO LONGER REPRODUCES, and this is a different harness saying so
// rather than a correction to it — the lesson under "Measuring balance" is that
// two readings which disagree on their setup are not two readings of the same
// thing. This one, written down so it can be re-run:
//
//     every ordered pair of suits (a !== b), CORES[i] vs CORES[(i+3)%8] for all
//     eight i, 40 seeds (k*31+7), board 4, `heroes = true`, suits pinned with
//     `pinSuit`, humans []. n=1,920 per suit, +/-2.2 at 95%.
//
//     suit         win     power fired
//     ♦ Scholar   58.8%        93%
//     ♠ Warlord   48.0%        91%
//     ♣ Sentinel  47.8%        88%
//     ♥ Mage      45.5%        43%      spread 13.3
//
// ──────────────────────────────────────────────────────────────────
// THE MAGE WAS PAYING FOR SOMETHING IT ALREADY HAD. Three changes, ablated one
// at a time on the harness above, and only the third of them is worth anything:
//
//     change                                      ♥ Mage    spread
//     (baseline)                                   45.5      13.3
//     + fixed the dead trigger (fires 43% -> 58%)  45.7      13.0
//     + Arcane Focus waives COOLDOWN, not just     46.3      12.4
//       cost
//     + dropped `goldShift: -1`                    49.1      11.5
//
// The diagnosis came first and the numbers only confirmed it. Sampling every
// Special-capable body on every prep turn across 160 matches, what stops a cast:
//
//     blocker            ♥ Mage    ♣ Sentinel
//     ready                33%         34%
//     no valid target      26%         25%
//     cooldown             24%         18%
//     just summoned        16%         15%
//     NOT ENOUGH MAGIC      0%          8%
//
// Zero. Not rarely — never, in any round, because `magicShift: +5` had already
// taken magic off the table (pool 10-13 by round 10). So the hero's own bonus
// suppressed its own power: Arcane Focus refunded a cost nobody was paying, and
// the AI trigger asked "is there a Special you cannot afford" of the one seat
// that always could — 0% true in every round, firing at all only by catching a
// mid-round moment after the pool had been spent down. That is the
// capital-letter bug one layer deeper: not a branch that never matched, a
// branch whose premise the rest of the hero had made impossible.
//
// The outcome it produced: the Mage cast 2.9 Specials a match. The Sentinel,
// with no bonus at all, cast 3.0. An identity line promising "Specials early
// and often" over a hero that cast fewer of them than the baseline.
//
// AND THE LESSON IS THE SAME ONE TWICE. +0.2 for fixing usage and +0.6 for
// making the power act on the constraint that actually binds; +2.8 for one
// round of the gold curve. A hero's strength is in its CURVE. The button is
// presence, not power — which is what the Hold the Line experiment above found
// when a 60-100% buff moved the table 0.4 points, and `FOCUS_CASTS` climbing
// 2 -> 4 while nothing happened was the same signal going unread.
//
// STILL OPEN: the Scholar at 57.6%, eight clear of second and untouched by any
// of this. `HERO_GOLD` went back to 4 on the reading that 4 and 2 were "the
// same table within noise"; on this harness they are not. Re-measure the payout
// before touching anything else — and note Requisition's discard rule is not
// the cause, it measured at −1.7 for the Scholar.
import type { CardDef, PlayerId, Suit } from "./types";

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
   *  presence rather than being an invisible arithmetic change.
   *
   *  TWO OF THE FOUR ARM RATHER THAN ACT. Muster and Arcane Focus make the
   *  NEXT summon or Special free instead of picking one themselves, because
   *  choosing what to spend a free cast on IS the power — a version that
   *  summoned "a card" would be handing the player a random body. The other two
   *  resolve on the spot, since neither has a meaningful target: shielding the
   *  whole line and turning the two weakest cards in hand into gold.
   *
   *  Fired by the `HERO_POWER` intent, gated on `GameState.heroes` like the
   *  curve — a dealt suit must never hand a skirmish a hero. */
  power: { name: string; text: string };
}

/** The numbers behind the powers, named rather than inlined at the one place
 *  each is used — they appear in the card text the player reads AND in the
 *  effect, and those two drifting apart is how a power comes to lie. */
export const HERO_SHIELDS = 5;   // Hold the Line, per ally
export const HERO_HEAL = 6;      // Hold the Line, HP per ally
export const HERO_DISCARD = 2;   // Requisition, cards spent

/** How strong a card is on paper — the stat budget, which is the same formula
 *  the whole set is costed against (`5 * cost + 10`, +/-2).
 *
 *  Named here rather than inlined because Requisition discards by it, and a
 *  power that says "your weakest cards" has to mean the same thing the rest of
 *  the game means by weak. HP and shields are not interchangeable — a shield
 *  blocks a whole hit — which is why shields are worth two, and `dmg` is worth
 *  `hits` because a four-hit card swings four times. */
export const cardPower = (d: CardDef): number =>
  d.dmg * d.hits + d.hp + d.shields * 2 + d.sp;
/** Requisition's payout.
 *
 *  FOUR, and it was briefly 2 for the wrong reason. The cut happened during the
 *  panic pass when the powers had just blown the spread to 59.6 points, before
 *  `HERO_MIN_ROUND` was found — so it was calibrated against a problem that the
 *  round gate then solved. Measured again with the gate in place, 4 gold gives
 *  a spread of 4.6 points against 2 gold's 4.2: the same table within noise.
 *  The early spike was never the SIZE of the purse, it was WHEN it arrived. */
export const HERO_GOLD = 4;      // Requisition, gold gained
/** Muster only pays for a card up to this cost.
 *
 *  UNCAPPED IT WAS THE WHOLE PROBLEM. A free summon of anything is a free
 *  cost-10 body, and gold measures at four times magic — so Attack posted
 *  82.1% against a 50.0% baseline the moment the powers were wired. Capped, it
 *  is a strong tempo swing instead of a free Mythic.
 *
 *  THREE, measured: at 4 the spread across the four suits was 21.7 points, at
 *  3 it is 11.2. This bound is on the GOLD waiver only — see
 *  `MUSTER_OPENING_MAX`, which is a different lever with a different bound. */
export const MUSTER_OPENING_MAX = 6;
/* ^ Muster beating the OPENING cost cap is not the same lever as waiving gold,
 *  and tying them to one number made the gold bound (3) silently delete the
 *  opening rule — `OPENING_COST_CAP` is 3, so no card was ever both over the
 *  cap and within reach.
 *
 *  Opening placement costs no gold, so this is a "what may lead" rule rather
 *  than an economy one: it lets a Warlord open with a Legendary instead of a
 *  3-drop. UNMEASURED, and honestly so — the Arena has no opening phase, so the
 *  balance matrix never exercises it. Bounded at 6 rather than left open for
 *  exactly that reason: a rule no simulation covers should not also be
 *  unlimited. */
export const MUSTER_MAX_COST = 3;
/** Arcane Focus arms this many free Specials.
 *
 *  TWO, because one was worth almost nothing: magic is the cheap currency and a
 *  single refunded cast left Control at 22.5%. Two casts is still under what
 *  one free body is worth, which is the exchange rate doing its job. (Four now
 *  — the count kept climbing while the power stayed worthless, which was the
 *  clue that the count was never the problem. See below.)
 *
 *  AND THE CHARGES WAIVE COOLDOWN, not just cost, which is the whole of what
 *  makes this a power at all. Measured across 160 matches: magic blocked 0% of
 *  the Mage's Specials — never, in any round — because its own `magicShift: +5`
 *  had already taken magic off the table (average pool 10-13 by round 10). A
 *  refund of a cost nobody was paying is worth exactly nothing, and it showed:
 *  the Mage cast 2.9 Specials a match against the Sentinel's 3.0, last in the
 *  suit table, under an identity line promising "Specials early and often".
 *
 *  What DID block it: cooldown 24%, no valid target 26%, summon-turn 16%. The
 *  waiver acts on cooldown because that is the one a hero can move — and it
 *  stays BOUNDED at `FOCUS_CASTS` casts, once a game, rather than becoming the
 *  rate change this file's whole safety argument is against. */
export const FOCUS_CASTS = 4;
/** No hero power before this round.
 *
 *  THE SPIKE WAS THE PROBLEM, not the size. Muster and Requisition are economy
 *  effects, and early gold is the scarcest thing in the game — income is 1 a
 *  round until round 5, so a free body on round 1 is five rounds of economy
 *  arriving at once. Buffing the two COMBAT powers by 60-100% moved the table
 *  0.4 points, which is what said the imbalance was never about magnitude. */
export const HERO_MIN_ROUND = 5;

export const HEROES: Record<Suit, Hero> = {
  spade: {
    suit: "spade", name: "Warlord",
    identity: "Bodies on the board sooner. Fewer tricks, more army.",
    // ONE round, against the Mage's three. Gold is the strong currency and a
    // Warlord that opened two tiers up would simply win the opening.
    goldShift: 1, magicShift: -1,
    power: { name: "Muster", text: `Once per game, free: your next summon of a cost-${MUSTER_MAX_COST} or cheaper card is free — gold and the opening cap alike.` },
  },
  club: {
    suit: "club", name: "Sentinel",
    identity: "The baseline. No curve to learn, and always viable.",
    // THE DEFAULT, deliberately unmodified. A roster needs a seat that is
    // simply the game as designed, or "balanced" has nothing to mean.
    goldShift: 0, magicShift: 0,
    power: { name: "Hold the Line", text: `Once per game, free: every ally gains ${HERO_SHIELDS} shields and heals ${HERO_HEAL}.` },
  },
  heart: {
    suit: "heart", name: "Mage",
    identity: "Specials early and often, and the magic to keep them coming.",
    // NO GOLD PENALTY ANY MORE, and this is the single change that fixed the
    // Mage. It used to pay `goldShift: -1` for its magic, on the reasoning that
    // five rounds of the cheap currency for one of the dear one is a fair-
    // looking trade that is really a trap — measured, at the time, at −0.8
    // against the baseline.
    //
    // That reading came from injecting income deltas by hand into a mirror
    // match, which answers "what is +5 magic worth if you can spend it". On the
    // live table the answer is: nothing. Magic blocks 0% of this hero's
    // Specials, in every round, because the +5 has already taken magic off the
    // table — the pool sits at 10-13 by round 10 and never runs short. The
    // Mage was paying real money for a benefit it had already saturated, and it
    // sat LAST at 45.5% under an identity line promising more casting than
    // anyone else while casting 2.9 Specials a match to the Sentinel's 3.0.
    //
    // Dropping the penalty alone moved it 46.3% -> 49.1% and took the suit
    // spread to 11.5, the tightest of any configuration measured. The two
    // changes to the POWER either side of it were worth +0.2 and +0.6 — inside
    // noise, and the third time this file has found that a hero's strength
    // lives in its curve and not in its once-per-game button.
    //
    // The +5 magic stays. It is close to free (it buys off the 8% of casts the
    // Sentinel loses to an empty pool and nothing more), it is what the hero
    // reads as, and removing it would leave a Sentinel with a different power.
    goldShift: 0, magicShift: 5,
    power: { name: "Arcane Focus", text: `Once per game, free: your next ${FOCUS_CASTS} Specials cost no magic and ignore cooldown.` },
  },
  diamond: {
    suit: "diamond", name: "Scholar",
    identity: "Turns the cards it does not need into the gold for the ones it does.",
    // NO CURVE SHIFT. The Scholar's axis is DRAW, and draw already outruns gold
    // roughly three to one — a hero that drew more would be handing the player
    // a bigger pile of cards they cannot afford. Its power converts the surplus
    // instead, which is why it is the one hero whose ability IS the identity.
    //
    // WHICH surplus changed. Requisition used to take the two DEAREST cards,
    // which is on-theme and miserable to press: the power asked you to burn the
    // Mythic you were saving for, so the honest play was often not to fire it at
    // all. A once-per-game button whose best use is "don't" is not a power. It
    // takes the two WEAKEST now — read off `cardPower`, ties broken toward the
    // dearer of two equally-weak cards, since the same stats at a higher price
    // is the worse card twice over.
    goldShift: 0, magicShift: 0,
    power: { name: "Requisition", text: `Once per game, free: discard your ${HERO_DISCARD} weakest cards, gain ${HERO_GOLD} gold.` },
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

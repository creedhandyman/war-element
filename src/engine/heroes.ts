// HEROES — one per suit, and the suit is how you wear one.
//
// The suit was already the seat's identity (`suits.ts`): dealt per match, and
// for an AI seat it decides how that AI plays. A hero binds to the same channel
// from the other side — YOU pick a hero, and that choice sets your suit. One
// glyph then says everything about a seat: what it is running on, and (for an
// AI) how it will play. Nothing new to learn and nothing extra on screen.
//
// ─────────────────────────────────────────────────────────────────────────
// A HERO IS ITS POWER. There is no economy curve any more.
//
// Each one used to carry a `goldShift`/`magicShift` as well — an offset in
// rounds into `poolGainForRound`, so a suit reached its next income tier early
// or late. That half is gone, and the case against it is in this file's own
// measurements.
//
// IT WAS INVISIBLE. Nobody feels `poolGainForRound(round + 1)`. It is a number
// behind a number, and it was the part that needed a paragraph of explanation
// in a picker — the opposite of what a chosen thing should be.
//
// AND IT WAS THE PART THAT MATTERED, which is worse. Removing the Mage's ONE
// round of gold penalty moved it 46.3% -> 49.1%; fixing its power outright was
// worth +0.2 and +0.6. A hero whose hidden arithmetic outweighs its visible
// ability is not really being chosen by anyone.
//
// The exchange-rate table below is kept because it is why: it is the reason a
// curve could never be a SMALL effect here, and therefore the reason a hero
// built on one could not be both fair and interesting.
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
// Gold is worth MORE THAN FOUR TIMES magic, and a single round of it is a real
// edge. Reproduced independently later: a flat +2 gold a round to one seat wins
// ~99% of games whatever hero is flying it. An economy dial in this game has no
// gentle setting, which is exactly why the heroes no longer own one.
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
// ...and where it stands NOW, after the Mage's curve and Requisition's payout
// were each taken apart below. Same harness, n=1,920 per suit, +/-2.2:
//
//     ♦ Scholar   52.1%        93%
//     ♥ Mage      50.7%        65%
//     ♠ Warlord   48.9%        91%
//     ♣ Sentinel  48.3%        88%      spread 3.8
//
// 3.8 is the tightest reading in this file, and both points of it came off the
// same two questions: what is this hero's advantage actually made of, and is
// anything stopping it from arriving.
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
// AND THE SCHOLAR WAS THE OTHER HALF, resolved the same way. It sat 8 clear of
// second on nothing but `HERO_GOLD`, which had gone back to 4 on the reading
// that 4 and 2 were "the same table within noise". On this harness they are 12.2
// against 4.2, and Requisition's discard rule was not the cause — it measured at
// −1.7. The payout at 3 is what closed the table; see `HERO_GOLD` below for the
// full sweep and why 4 stopped being the right answer.
//
// THE PATTERN ACROSS BOTH. The Mage's fix was its CURVE and its power was worth
// +0.8; the Scholar's fix was its POWER and it has no curve at all. What they
// share is that neither deficit was a magnitude — one hero could not use what it
// was given, the other was given too much of the only thing it had — and in both
// cases the arithmetic had to be checked against what the game actually does
// with it. USAGE RATE FIRST, then what the currency is worth on a real board,
// then the number.
import type { CardDef, PlayerId, Suit } from "./types";

export interface Hero {
  suit: Suit;
  name: string;
  /** One sentence. If it needs two, the hero is too complicated. */
  identity: string;
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
 *  THREE, and the number is load-bearing: the Scholar has no curve at all, so
 *  unlike every other hero this power IS the hero, and the payout is the only
 *  dial it has. One gold is worth about 4.8 points of win rate to it — close to
 *  linear across the range, which is what makes this measurable at all:
 *
 *      gold   ♠      ♣      ♥      ♦ Scholar   spread
 *         4   47.7   45.6   49.0     57.7       12.2
 *         3   48.4   47.6   51.1     52.9        5.3
 *         2   50.7   48.3   52.4     48.6        4.2
 *
 *  (n=1,152 per suit, +/-2.9. Harness spec is in the roster section above.)
 *
 *  2 AND 3 THEN HAD TO BE SEPARATED AT FULL RESOLUTION, because at that sample
 *  size they were symmetric — 2 landed the Scholar 1.4 low, 3 landed it 2.9
 *  high, which is a coin flip and not an answer. Re-run at n=1,920 (+/-2.2):
 *
 *      gold=2   spade 51.0 · club 49.8 · heart 52.1 · diamond 47.1   spread 5.0
 *      gold=3   spade 48.9 · club 48.3 · heart 50.7 · diamond 52.1   spread 3.8
 *
 *  The extra samples moved 2 further out, not closer — the Scholar went from
 *  48.6 to 47.1 and finished LAST — so 3 wins on both counts and the choice
 *  needed no judgement call in the end.
 *
 *  WHY FOUR STOPPED BEING RIGHT. It was defended on a reading that 4 gave a
 *  spread of 4.6 against 2 gold's 4.2 — the same table within noise, and on
 *  that evidence 4 was the reasonable pick. Two things changed. Requisition
 *  used to discard your two DEAREST cards, which is a real price; it now takes
 *  your two weakest, which is close to free, so a payout calibrated against the
 *  expensive version was calibrated against a power that no longer exists. And
 *  on the harness above the two values are nowhere near within noise — 12.2
 *  against 4.2. That earlier harness's setup was never written down, so the two
 *  readings cannot be reconciled; this one is recorded in the file it measures
 *  for exactly that reason. */
export const HERO_GOLD = 2;      // Requisition, gold gained
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
    power: { name: "Muster", text: `Once per game, free: your next summon of a cost-${MUSTER_MAX_COST} or cheaper card is free — gold and the opening cap alike.` },
  },
  club: {
    suit: "club", name: "Sentinel",
    identity: "The baseline. No curve to learn, and always viable.",
    power: { name: "Hold the Line", text: `Once per game, free: every ally gains ${HERO_SHIELDS} shields and heals ${HERO_HEAL}.` },
  },
  heart: {
    suit: "heart", name: "Mage",
    identity: "Fires a Special where no Special should be — in the Prep phase.",
    // A SPECIAL IN THE PREP PHASE, which the game does not otherwise sell.
    //
    // Arcane Focus used to refund the magic on the next few Specials, and it
    // bought almost nothing. Ablated against the same seat with its power
    // disabled, the discount was worth +1.3 while Muster was worth +14.2,
    // Requisition +12.2 and Hold the Line +10.1.
    //
    // BE PRECISE ABOUT THE OTHER NUMBER, because it is the more dramatic one
    // and it belongs to a build that no longer exists: back when the Mage
    // also carried `magicShift: +5`, the same ablation said the power cost it
    // 11.4 points — it was actively NEGATIVE. Both readings are true and they
    // are not in conflict. The curve made magic free, so a magic refund was
    // pure downside: all it did was talk the seat into casting more, and
    // casting is the axis this game pays least for (gold is worth 4x magic; a
    // wall deck beats a damage deck 65-35; the Mage out-cast the Sentinel 4.0
    // to 2.6 and still lost). Remove the curve and the harm goes with it,
    // leaving a power worth 1.3 points.
    //
    // A discount is also not a DECISION. Nothing about it is chosen except when
    // to press it, which is the thin end of what a hero should be. This one is
    // chosen twice — which body, and what it aims at — and what it buys is an
    // ACTION rather than a rebate: a Special outside the battle phase, off
    // cooldown, on a body that may have arrived too late to have earned it.
    // Nothing else in the game does that, which is the point.
    power: { name: "Arcane Focus", text: "Once per game, free: channel an ally — its Special fires now, in Prep, off cooldown." },
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
    power: { name: "Requisition", text: `Once per game, free: discard your ${HERO_DISCARD} weakest cards, gain ${HERO_GOLD} gold.` },
  },
};

export const heroOf = (suit: Suit): Hero => HEROES[suit];

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

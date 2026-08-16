// Element auras — a passive every card of that element carries. Fired from the
// existing hook points (summon / basic hit / death / Cleanup) keyed by element.
// The table below is the source of truth for the human-readable description
// (shown in the card inspector); the actual effects live at each hook site.

import { getDef } from "../data/cards";
import { MULTI_HIT_BONUS_MIN } from "./types";
import type { CardDef, CardInstance, Element } from "./types";

/** Does this card carry element `el`'s aura? True for its own element, plus any
 *  extra elements it borrows via `elementAuras` (SirCrest's PYRO/AQUA mastery). */
export function hasElementAura(def: CardDef, el: Element): boolean {
  return def.element === el || !!def.elementAuras?.includes(el);
}

export interface AuraDef {
  name: string;
  desc: string;
}

export const ELEMENT_AURA: Record<Element, AuraDef> = {
  LEAF: { name: "Photosynthesis", desc: "End of round, LEAF cards heal +2 HP — plus 1 more for every ROOTed opponent — and gain +1 shield per hit they took that round, up to 3 above their printed shields." },
  PYRO: { name: "Scorch", desc: "Basic attacks apply BURN, stacking up to BURN 5 on the same target." },
  BORE: { name: "Exostone", desc: "Enters play with shields by rarity — Rare 2, Epic 2, Legendary 3, Mythic 4. Never loses more than 1 shield to a single hit however heavy, and gains +1 shield whenever its attack breaks one off an opponent." },
  DUSK: { name: "Midnight Shade", desc: "On death, deals its full DMG back to the killer, and the shadows thicken — every DUSK card you control gains +5% dodge for a round, stacking with each fallen DUSK card (max 25%)." },
  AQUA: { name: "Flow Change", desc: "On summon, choose a boost for 3 rounds: Liquid +2 DMG · Frozen +3 shields · Vapor +4 SP." },
  DAWN: { name: "Awakening", desc: "On summon, strikes the nearest enemy for its full DMG. End of round, burns one negative status off itself and gains +1 SP (caps at SP 14)." },
  GALE: { name: "Zephyr", desc: "Its speed is a weapon: +1 DMG per 6 SP (max +3), and a dodge chance of 5% per 3 SP above 6 (max 20%). End of round, +2 SP (caps at SP 21); the first time it passes SP 15, a one-time +1 DMG." },
  BOLT: { name: "Electrify", desc: "Basic attacks leave the target ELECTRIFIED, and BOLT cards deal +1 DMG to any opponent carrying a status." },
};

/** Exostone's arrival plating, by rarity. It was a flat +2 for every BORE card,
 *  which handed the same slab to a 1-cost Rare and a 10-cost Mythic — most
 *  valuable on the cheapest body, where 2 shields is a large share of what the
 *  card is. Tiering it makes the aura scale with the card it is plating.
 *
 *  Rare and Epic both sit AT the old flat value; only the top two tiers climb.
 *  BORE's pool is rare-heavy — 18 Rare, 12 Epic, 7 Legendary, 2 Mythic — so a
 *  ladder centred on 2 (the first cut was 1/2/3/4) took a shield off 18 cards to
 *  give to 9, and measured as a small net loss for the element. Holding the
 *  bottom two flat means no card is worse off than before and the 9 rarest get
 *  the scaling. */
export const EXOSTONE_SHIELDS: Record<string, number> = {
  rare: 2, epic: 2, legendary: 3, mythic: 4,
};
/** Fallback for any rarity outside the table above. */
export const EXOSTONE_DEFAULT = 2;

export const GALE_SP_CAP = 21;

/** ZEPHYR'S TWO NEW HALVES — the speed GALE pays for finally converts.
 *
 *  Measured, GALE sat bottom of the game at 32.5% with the lowest damage (53 a
 *  match against a field of 85-95) and the fewest cards left standing (1.77,
 *  next worst 2.45). The cause is structural rather than any one card: the stat
 *  budget counts SP against HP and damage, and GALE spends 31.6% of its power
 *  on SP — the most of any element, against BORE's 21.8% — for a stat that
 *  bought nothing but turn order. It was paying full price for a dead stat,
 *  which is why it is simultaneously the weakest attacker (5.4 dmg×hits) and
 *  the flimsiest body in the game (0.33 shields, against BORE's 2.64).
 *
 *  So the answer is not to hand GALE stats it has not paid for — it has paid —
 *  but to make what it bought worth something. Both halves key off SP, so they
 *  scale with exactly the stat that was being wasted and nothing else changes.
 *
 *  Deliberately NOT another speed nudge: that axis was tried on DAWN (First
 *  Light) and measured as not working. */

/** TAILWIND: +1 DMG per this many SP. */
export const GALE_TAILWIND_PER = 6;
/** ...to here, so a multi-hit body cannot turn it into a blowout. */
export const GALE_TAILWIND_CAP = 3;

/** SLIPSTREAM: dodge starts once a card is faster than this. */
export const GALE_SLIPSTREAM_BASE = 6;
/** Each this-many SP above the base is worth `GALE_SLIPSTREAM_PCT`. */
export const GALE_SLIPSTREAM_PER = 3;
export const GALE_SLIPSTREAM_PCT = 5;
/** And no further — a card that dodges most of what is thrown at it stops
 *  being fragile-and-fast and starts being unkillable. */
export const GALE_SLIPSTREAM_CAP = 20;

/** Tailwind's bonus damage, per hit, for a card at `sp`. */
export const tailwindDmg = (sp: number): number =>
  Math.min(GALE_TAILWIND_CAP, Math.floor(Math.max(0, sp) / GALE_TAILWIND_PER));

/** Slipstream's dodge chance, as a percentage, for a card at `sp`. */
export const slipstreamPct = (sp: number): number =>
  Math.min(
    GALE_SLIPSTREAM_CAP,
    Math.max(0, Math.floor((sp - GALE_SLIPSTREAM_BASE) / GALE_SLIPSTREAM_PER)) * GALE_SLIPSTREAM_PCT,
  );

/** AWAKENING'S STRIKE — what a DAWN card hits for as it lands, as a fraction of
 *  its own DMG. Was a half; it is the whole thing now.
 *
 *  DAWN sat bottom of the game at 37.3% with the lowest damage in it: 56 a
 *  match against a field of 85-95. This is the smallest change that goes at
 *  that number directly, and it is on-theme — the light arriving IS the card's
 *  attack, so it should hit like one.
 *
 *  GOLD WAS THE WRONG LEVER, and the two attempts are recorded because the
 *  finding generalises well beyond DAWN:
 *
 *    -1 Gold on every card       37.3 -> 82.8%   (spread 23.4 -> 44.8)
 *    -1 Gold from cost 5 up      37.3 -> 34.9%   (WORSE than no change)
 *    -1 Gold up to cost 3        37.3 -> 78.5%
 *
 *  Three things fall out of that. Gold is enormously more valuable than stats
 *  here — one Gold off a summon moved an element +45 points, where GALE's whole
 *  Zephyr rework (damage AND dodge, on 39 cards) moved it +16. Essentially all
 *  of that value is at the CHEAP end: twelve cheap cards bought +41 of the +45.
 *  And discounting the HEAVY end is actively harmful, because
 *  `aiPrepIntent` summons the highest-cost affordable card, so cheapening big
 *  cards only brings them into reach sooner and spends on one body where two
 *  would have gone down.
 *
 *  So gold has no granularity to offer: every shape of discount is worth 40+
 *  points and DAWN needs about 13. A damage aura is the right size — it is the
 *  size GALE's was. */
export const DAWN_STRIKE_DIVISOR = 1;

/** Where First Light (DAWN) stops quickening. Well under GALE's 21: speed is
 *  GALE's identity, and this exists to lift the game's most expensive, second
 *  slowest element off the floor of the capture race — not to make a second
 *  speed element. */
export const DAWN_SP_CAP = 14;

/** How much armour Photosynthesis may add ON TOP OF a card's printed shields.
 *  Uncapped, a LEAF card under sustained fire would plate up faster than it
 *  could be chewed through and the aura would stop being a comeback mechanic
 *  and start being a stall engine.
 *
 *  This is a BONUS cap, not a total. Read as a total it silently excluded every
 *  LEAF card printing 3+ shields from its own element aura. */
export const LEAF_SHIELD_CAP = 3;

/** ELECTRIFY's damage rider: what a BOLT card adds against an opponent already
 *  carrying a status. Power Grid adds its field bonus on top.
 *
 *  Was 2, and 2 was too much once the other half of the aura made it
 *  self-enabling: a BOLT basic ELECTRIFIES a clean target, so from the second
 *  hit of any exchange onward the rider is simply always on. It is not a
 *  conditional bonus in practice, it is BOLT's base damage — and BOLT measured
 *  top of the game at 62.1% with the field's best board presence (4.21 cards
 *  alive against a 3.2 average).
 *
 *  The pairing is the problem rather than either half. Both were introduced
 *  together to lift BOLT off 38%, and together they overshot; halving the rider
 *  keeps the setup — which is what made the aura legible — and takes back the
 *  part that was double-counting. */
export const BOLT_VS_STATUS_DMG = 1;

/** Blinding Star (Supernova): the flat miss chance its glare imposes on every
 *  enemy basic attack, board-wide, while it lives.
 *
 *  It replaces a splash SUPPRESSION — "opponents' basics hit one fewer target" —
 *  which read as a strong aura and almost never did anything: it only bit
 *  against the handful of cards carrying `basicSplash` or a `splashAura`, so
 *  against most boards the mythic's signature aura was literally inert. A miss
 *  chance applies to every attacker on the field.
 *
 *  10 is deliberately small next to BLIND's 50. BLIND is a status somebody has
 *  to land, lasts a few rounds and is cleansable; this is unconditional,
 *  uncleansable, and covers the whole enemy side for as long as a 34 HP flier
 *  survives. Rolled per HIT, like every other accuracy check in the chain, so a
 *  multi-hit attacker loses a fraction of its volley rather than all of it. */
export const BLINDING_STAR_MISS_PCT = 10;

/** How often an attack is lost in a standing fog, when the source does not say
 *  otherwise. A coin, which is what the mechanic has always been — Aftermath's
 *  Smog still pays a cost-4 Special off a cost-6 body for exactly that. */
export const FOG_MISS_PCT = 50;

/** Misty's Fog Settlement, which is the same mechanic bought at a very
 *  different price: a cost-1 body that lays it FREE the moment it lands, with
 *  no target, no roll to land it, and nothing the opponent can cleanse.
 *
 *  Halving every attack an opponent makes for a round is not a 1-drop's worth
 *  of effect, and at 50% it was strictly better than most cards' entire
 *  Specials while costing a single gold. Quartering is still the widest
 *  accuracy debuff in the game per gold spent — Blinding Star, on a cost-9
 *  mythic, is 10 — it is just no longer a coin flip on the opponent's turn. */
export const MISTY_FOG_MISS_PCT = 25;

/** WEAKEN's bite per stack, as a percentage of damage removed.
 *
 *  It used to be a PRESENCE flag: one flat -25%, and a second application did
 *  nothing but refresh the timer. Every source in the game applies it with
 *  power 0, so a card built to WEAKEN repeatedly — Angale retaliating on every
 *  hit, a row spell cast twice, a Special on a two-round cooldown — got
 *  progressively less out of its own ability the more of it it did. */
export const WEAKEN_PCT_PER_STACK = 25;

/** And no deeper. Three stacks is -58% (see below), which is a heavy debuff
 *  and still leaves the card a threat.
 *
 *  The stacks are MULTIPLICATIVE — 0.75, then 0.75 of that — not additive.
 *  Additive 25s reach exactly zero at four stacks, and a card that deals no
 *  damage at all is removed from the game by a status rather than debuffed by
 *  one; there is no counterplay left to find once the number is 0. Compounding
 *  can be stacked forever and never gets there, so the cap is about how fast
 *  it bites rather than about preventing a lock. */
export const WEAKEN_MAX_STACKS = 3;

/** How many WEAKEN stacks a card is carrying, 0 if none.
 *
 *  `power` is the stack depth, but every pre-existing source applies WEAKEN
 *  with power 0 — those are one stack, not zero, or the status would do
 *  nothing at all on the cards that have always applied it. */
export function weakenStacks(card: { statuses: { kind: string; power: number }[] }): number {
  const st = card.statuses.find((s) => s.kind === "WEAKEN");
  if (!st) return 0;
  return Math.min(WEAKEN_MAX_STACKS, Math.max(1, st.power));
}

/** The damage multiplier for `n` stacks of WEAKEN. 1 when clean. */
export function weakenMult(n: number): number {
  return (1 - WEAKEN_PCT_PER_STACK / 100) ** n;
}

/** Scorch stacks its BURN to here and no further. Uncapped, a multi-hit PYRO
 *  card would stack a lethal DOT off one attack and the aura would stop being
 *  chip damage. */
export const PYRO_BURN_STACK_CAP = 5;

/** Midnight Shade's first half: what fraction of its own DMG a dying DUSK card
 *  deals back to whoever killed it — its DMG divided by this. ONE, so all of it.
 *
 *  This dial has now been a third, a half, and none: killing a DUSK card costs
 *  the killer exactly what that card hit for. The reasoning behind the original
 *  cut still reads correctly — an aura that pays out for LOSING cards rewards
 *  the disposable-body element for what it is already best at — but DUSK has
 *  measured last every time since, by six points and more, and a fraction of a
 *  small printed DMG rounds away to nothing on precisely the cheap bodies the
 *  element is built out of.
 *
 *  What full damage buys is not really the number. It is that the trade becomes
 *  legible: a DUSK card's printed DMG is now what it costs to remove, so an
 *  opponent can read the price off the card before committing. Half of a
 *  printed 7 was a real cost that nothing on the board announced.
 *
 *  THE DODGE HALF IS STILL NOT RESTORED. That one stacks per corpse, scales
 *  with how badly the round went, and is what could make a bad round
 *  unwinnable. This one is flat, once per death, and cannot chain — the recoil
 *  is dealt by a card already off the board.
 *
 *  At a divisor of 1 the max(1, ...) floor below only does work for RIP, the
 *  one DUSK-aura carrier printing 0 DMG. */
export const DUSK_SHADE_DEATH_DIVISOR = 1;

/** Midnight Shade's second half: each DUSK card that falls thickens the shadows
 *  over its surviving DUSK allies by this much dodge chance. */
export const DUSK_SHADE_PCT = 5;

/** And no further. DUSK is the disposable-body element — 7 of its cards cost 2
 *  or less and two of them are spawnable tokens — so it can put more corpses on
 *  the board in a round than anything else. Uncapped, a bad round for DUSK would
 *  hand it a dodge chance that made the NEXT round unwinnable. This is the half
 *  that scales with how badly the round went, so it stays capped even now that
 *  the death recoil has gone back to a half (DUSK_SHADE_DEATH_DIVISOR). Five
 *  stacks — a quarter of all incoming hits — is the ceiling. */
export const DUSK_SHADE_MAX_STACKS = 5;

// AQUA Flow Change — the three-way summon choice (the summon pick lasts 3 rounds).
export type FlowMode = "water" | "ice" | "steam";
export const FLOW_MODES: Record<FlowMode, { label: string; blurb: string }> = {
  water: { label: "Liquid", blurb: "+2 DMG" },
  ice: { label: "Frozen", blurb: "+3 shields" },
  steam: { label: "Vapor", blurb: "+4 SP" },
};

/** True when Liquid should grant an extra hit rather than +2 DMG — i.e. the
 *  card already strikes multiple times, so a flat per-hit bonus would balloon
 *  (Vaporem 2×5, Sapphire 3×2, …). */
export function liquidGivesHit(card: CardInstance): boolean {
  return getDef(card.defId).hits >= MULTI_HIT_BONUS_MIN;
}

/** Apply the chosen Flow Change buff.
 *
 *  `rounds > 0` (the SUMMON pick) grants a TIMED buff that lasts that many rounds
 *  then fades — the current design: on-summon Flow lasts 3 rounds. It used to be
 *  round-scoped (one round only, the weakest aura in the game), then permanent;
 *  3 rounds is the middle ground.
 *
 *  `permanent`/round-scoped remain for Downpour, which re-picks Flow for every
 *  AQUA ally EVERY round — a timed or permanent grant there would stack without
 *  limit, so that path keeps the one-round version it was designed around. */
export function applyFlow(card: CardInstance, mode: FlowMode, permanent = false, rounds = 0): void {
  // The SUMMON pick now grants a TIMED buff (rounds > 0) instead of a permanent
  // one — Flow Change lasts 3 rounds, then fades. Pushed straight onto the same
  // `buffs` array applyTimedBuff uses (avoids an auras→combat import cycle); the
  // Cleanup that ticks those handles the expiry.
  const timed = rounds > 0;
  if (mode === "water") {
    // Liquid: +1 hit on multi-hit cards (avoids the per-hit +2 blowout),
    // otherwise +2 DMG. The timed grant uses flat +2 DMG for all — on a
    // temporary buff the multi-hit blowout no longer needs guarding against.
    if (timed) card.buffs.push({ dmg: 2, sp: 0, rounds });
    else if (liquidGivesHit(card)) {
      if (permanent) card.hitsBonus += 1;
      else card.hitsBonusRound += 1;
    } else if (permanent) card.dmgBonus += 2;
    else card.dmgBonusRound += 2;
  } else if (mode === "ice") {
    card.curShields += 3;
    // tempShields is the round-scoped refund marker; a permanent OR timed grant
    // omits it (timed shields simply last until spent — no per-round shield timer).
    if (!permanent && !timed) card.tempShields += 3;
  } else if (mode === "steam") {
    if (timed) card.buffs.push({ dmg: 0, sp: 4, rounds });
    else if (permanent) card.spBonus += 4;
    else card.spBonusRound += 4;
  }
}

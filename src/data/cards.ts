// War Element — alpha card set (78 cards across 8 elements), grouped into
// four selectable element-pair decks:
//   leaf_pyro  · aggro (bleed/burn, LIFESTEAL, on-summon blasts)
//   bore_dusk  · shields/reflect + evasion/drain/sleep
//   aqua_dawn  · freeze/scald control + blind/cleanse/healing
//   gale_bolt  · STUN/WEAKEN lockdown + PARALYZE/MUTED disruption (fast fliers)
// Legendaries (cost 6-8) sprinkled through each pair.
//
// DAMAGE NOTATION: card text "A×B DMG" reads hits-first — A hits of B damage
// each (e.g. Spitfire "2×3" = 2 hits × 3 dmg). Encoded as { hits: A, dmg: B }.
// Cards are pulled from the element card files (Desktop\Everything\war element\
// *_Cards.docx). Abilities were audited against those docs and the correct
// passives restored where the engine supports them: onKill buffs, thorns
// (onHitByMelee), gated on-hit riders (chance/first-hit/second-hit), conditional
// keywords vs a target's status (vsStatus), periodic self effects (roundTick),
// on-death row-ahead AoE, on-summon ally buffs, and self/adjacent special
// riders. All 8 element auras are implemented too (src/engine/auras.ts), plus
// timed team buffs, forced push / −SP debuffs, on-death revive, and HP-threshold
// transforms. A few DEEP per-card mechanics remain unmodeled — noted inline as
// NOTE/"not yet modeled" (token/minion spawns, traps, damage-redirect,
// attack-allies-to-heal, recast/persistent specials, status-absorbing barrier,
// positional untargetability, and the "Electrified" mark).
// Stat guideline: total ≈ 5*cost + 10, shields = 2 pts (stat rebalances vs the
// docs are intentional alpha scope, not bugs).

import { LORE } from "./lore";
import type { CardDef, Element } from "../engine/types";

export const CARDS: CardDef[] = [
  // ───────────────────────── LEAF ─────────────────────────
  {
    id: "leaf_sumerose",
    name: "Estival",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 4,
    dmg: 8,
    hits: 1,
    hp: 13,
    sp: 8,
    shields: 1,
    keywords: { LIFESTEAL: true },
    // Blood Bloom: basic hits apply BLEED 1 for 2 rounds.
    onHitStatus: { kind: "BLEED", duration: 2, power: 1 },
    special: {
      name: "Siphoning Slash",
      cost: 3,
      handler: "strike",
      params: { dmg: 10, pen: 1, lifesteal: 1, statusKind: "BLEED", statusPower: 3, statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 10 DMG (PEN), lifesteal it, and apply BLEED 3 for 2 rounds.",
    },
  },
  {
    id: "leaf_stickviper",
    name: "StickViper",
    tribe: "Reptile", // Trinezer's Brood Command
    rarity: "rare",
    element: "LEAF",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 1,
    dmg: 3,
    hits: 1,
    hp: 5,
    sp: 9, // a fast snake — 5 HP survives a 1-cost spell AND one weak hit (2+5+9=16, +1 over cost-1)
    shields: 0,
    keywords: {},
    onHitStatus: { kind: "BLEED", duration: 2, power: 2 },
    // Venomous: basic attacks apply BLEED 2 (non-stacking → newest overwrites).
  },
  {
    id: "leaf_dartfrog",
    art: "leaf_dart_frog",
    name: "Dart Frog",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 6,
    hits: 1,
    hp: 10,
    sp: 10,
    shields: 0,
    keywords: {},
    // Darts: basic attacks apply BLEED 1 for 2 rounds (refreshes; true stacking
    // isn't modelled).
    passiveNames: { onHitStatus: "Darts" },
    onHitStatus: { kind: "BLEED", duration: 2, power: 1 },
    // Bleed Out (Talent, free, once per game): fire it instead of attacking to
    // load the darts; next basic fires as 3 (1 + 2 loaded).
    talent: {
      name: "Bleed Out",
      text: "Skip this attack to load your darts — your next basic attack fires as 3 darts.",
      handler: "loadHits",
      params: { hits: 2 },
    },
  },
  {
    id: "leaf_greegon",
    name: "Greegon",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 3,
    // Pushed back toward the wall it started as: DMG 5 -> 4, HP 15 -> 19, SP 6 -> 4.
    // Budget 27 vs a Cost-3 target of 25 — +2, at the edge of the band but inside it.
    //
    // The SP is the real change, not the DMG. SP_SLOW_MAX is 5, so dropping 6 -> 4
    // crosses the movement tier and its stride halves, 2 slots to 1. That works
    // against the Bramble note below: the thorns were added BECAUSE it never closed
    // anything, and at reach 1 it closes less still. With REGEN 2 on top of
    // Photosynthesis it mends 4 a round, which is where its value has gone.
    dmg: 4,
    hits: 1,
    hp: 19,
    sp: 4,
    shields: 0,
    keywords: { REGEN: 2 }, // Canopy: REGEN 2 at end of round
    // Bramble: its basic leaves BLEED 1 for 2 rounds. Greegon was a pure wall —
    // 4 DMG, REGEN, and nothing offensive — so it never closed anything and got
    // never closed anything. The thorns give it a bite — a BLEED DoT on the foe.
    passiveNames: { onHitStatus: "Bramble" },
    onHitStatus: { kind: "BLEED", duration: 2, power: 1 },
  },
  {
    id: "leaf_alpha",
    name: "Alpha",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 4,
    dmg: 2, // "4×1 DMG" = 4 hits × 1 dmg
    hits: 4,
    hp: 15,
    sp: 7,
    shields: 0,
    keywords: {},
    // The pack's leader — Stormfang's Wolf aura reads this tribe.
    tribe: "Wolf",
    // Gnashing Bite: LIFESTEAL only on attacks against ROOTed opponents.
    passiveNames: { vsStatus: "Gnashing Bite" },
    vsStatus: { status: "ROOT", lifesteal: true },
    // Back to Epic: Takedown is a repeatable Special again (rarity rule — a
    // repeatable Special needs epic+), not the one-shot Talent of its Rare form.
    // Takedown: a TACKLE now, not a swipe from where it stands — Alpha closes
    // on the target first and hits from the slot it lands in.
    //
    // `chargeFirst` is what buys the reach as well as the movement: a Special
    // that charges BEFORE it strikes may aim as far as it can travel
    // (validSpecialTargets' chargeReach), so charge 2 gives this Melee card a
    // 2-space target list without `ranged: true` — which would have handed it
    // unlimited board reach instead. `chargeLateral` lets it track the victim
    // across columns rather than ploughing straight up its own, which is what
    // "the closest spot to the opponent" means on a grid.
    special: {
      name: "Takedown",
      cost: 2,
      handler: "strike",
      params: { dmg: 8, statusKind: "ROOT", statusDuration: 3, charge: 2, chargeLateral: 1, chargeFirst: 1 },
      targetSide: "enemy",
      text: "Tackle an opponent within 2 spaces for 8 DMG and ROOT them for 3 rounds, closing to the nearest slot beside them first.",
    },
  },
  {
    id: "leaf_fallona",
    name: "Autumnal",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Mage",
    attackType: "Ranged",
    // Down a cost, paid entirely out of per-hit damage: 2x5 + 13 + 7 = 30,
    // exactly the cost-4 budget. The five-hit shape is the card, so the hits
    // stay — and a 2-damage shredder is not the dead weapon it looks like,
    // because every landed hit strips a plate, so the volley opens armour for
    // its own later hits (2 shields eats the first hit, the third onward land
    // clean).
    cost: 4,
    dmg: 2, // "5×1 DMG" in the doc; 5 small hits is the identity
    hits: 5,
    hp: 13,
    sp: 7,
    shields: 0,
    keywords: {},
    // Fall's Emergence: +1 DMG at the end of every 3rd round (stacking). The
    // bonus applies to her basic attack AND to Leaf Storm (scaleDmg).
    roundTick: { buffDmgEveryN: { n: 3, amount: 1, maxTicks: 5 } },
    special: {
      name: "Leaf Storm",
      cost: 2,
      handler: "barrage",
      // printed "3×1 DMG to all opponents" — 3 hits per target, each scaling
      // with Fall's Emergence (base 1 + accumulated DMG bonus).
      params: { dmg: 1, hits: 3, targets: 99, scaleDmg: 1 },
      targetSide: "enemy",
      text: "Deal (1 + Fall's Emergence) DMG × 3 to every opponent in range.",
    },
  },

  {
    id: "leaf_squanch",
    name: "Squanch",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 5,
    dmg: 6,
    hits: 1,
    hp: 25,
    sp: 4,
    shields: 0,
    keywords: {},
    // Regenerative: at end of round, +1 shield per enemy hit taken (capped at 5).
    passiveNames: { shieldPerHitTaken: "Regenerative" },
    shieldPerHitTaken: { shields: 1, maxShields: 5 },
    special: {
      name: "Bushwhacker",
      cost: 2,
      handler: "strike",
      // "6 DMG to one opponent AND ROOT all opponents adjacent to Squanch 3r"
      params: { dmg: 6, adjStatusKind: "ROOT", adjStatusDuration: 3 },
      targetSide: "enemy",
      text: "Deal 6 DMG and ROOT every opponent adjacent to Squanch for 3 rounds.",
    },
  },
  {
    id: "leaf_leaf",
    name: "Frond",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 2,
    dmg: 4, // "2×3 DMG" = 2 hits × 3 dmg
    hits: 2,
    hp: 4,
    sp: 9,
    shields: 0,
    keywords: {},
    tribe: "Grove",
    // Razor Leaf. Named on the card now rather than only in this comment — it
    // was "Magic Razor Leaf" back when Frond was a Mage, and an ability name
    // that lives nowhere but a code comment reaches nobody.
    passiveNames: { onHitStatus: "Razor Leaf" },
    onHitStatus: { kind: "BLEED", duration: 2, power: 1 },
  },
  {
    id: "leaf_nettle",
    name: "Nettle",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 1,
    dmg: 1,
    hits: 3,
    hp: 5,
    sp: 7,
    shields: 0,
    keywords: {},
    tribe: "Grove",
    onHitStatus: { kind: "BLEED", duration: 2, power: 1 }, // Stinging Barbs
    // Bloodletting: Nettle chips BLEED itself, and once a PYRO ally has set the
    // target burning too, each of its three little hits leeches life and bites
    // harder off the bloodfire. Cheap, sticky sustain for the aggro core.
    //
    // Three ONE-damage hits, not two twos, and the hit count is the point: both
    // Bloodletting's +1 and its lifesteal are paid PER HIT, and BLEED lands per
    // hit too. At 1 base the bonus is half of every swing rather than a third,
    // so the card leans harder on its own combo and does less without it.
    passiveNames: { vsStatus: "Bloodletting" },
    vsStatus: { status: "BLEED", bloodfire: true, lifesteal: true, bonusDmg: 1 },
  },
  {
    id: "leaf_thorn",
    name: "Thorn",
    rarity: "legendary",
    element: "LEAF",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 6, // LEGENDARY
    dmg: 8,
    hits: 1,
    hp: 18,
    sp: 9,
    shields: 3,
    keywords: { LIFESTEAL: true },
    tribe: "Grove",
    // Barbed Basics: every basic deepens the wound — BLEED 1 for 2 rounds that
    // STACKS (up to 6), onto its own prior hits AND onto the Special's BLEED.
    // Feeds Transfusion, which drinks from all the BLEED Thorn's side deals.
    // Transfusion (On Hit by Melee): apply BLEED 2 to the attacker (stacks), and
    // heal Thorn each round for the total BLEED damage dealt to its enemies at
    // Cleanup (own + teammate BLEED — the team's BLEED cluster fuels Thorn).
    passiveNames: { onHitStatus: "Barbed Basics", onHitByMelee: "Transfusion" },
    onHitStatus: { kind: "BLEED", duration: 2, power: 1, stack: true, stackCap: 6 },
    onHitByMelee: { status: { kind: "BLEED", duration: 2, power: 2 } },
    healsFromBleed: true,
    special: {
      name: "Blood on the Petals",
      // 4, up from 3. Was a single-target strike and the worst legendary damage
      // special in the game (2.3/magic). The sweep fixed that too well: 21 burst
      // plus BLEED 3 running 2 rounds on three targets is 39 damage, which at
      // cost 3 came out at 13.0/magic — the highest in the game, above the two
      // outliers cut in the same pass. The extra magic prices the sweep instead
      // of shrinking it (9.75/magic).
      cost: 4,
      // Now a sweep of up to 3 — BLEED drops 5 -> 3 to pay for the extra reach,
      // and Thorn's healsFromBleed drinks from all three.
      handler: "barrage",
      // Sweep 3 -> 2. It measured 19.5 damage/round (21 burst + 18 BLEED), the
      // highest sustained output of any legendary and above every mythic; two
      // targets brings it to about 13, in line with the top of the tier.
      params: { dmg: 7, pen: 1, targets: 2, statusKind: "BLEED", statusPower: 3, statusDuration: 2, statusStack: 1, statusStackCap: 6 },
      targetSide: "enemy",
      text: "Sweep up to 2 opponents in range for 7 DMG (PEN) each and stack BLEED 3 (basics keep deepening it).",
    },
  },

  // ───────────────────────── PYRO ─────────────────────────
  {
    id: "pyro_sol",
    name: "Sol",
    rarity: "legendary",
    element: "PYRO",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 6,
    // 3*3 + 16 + 2*2 + 11 = 40 = 5*6+10, exactly — the same total it carried at
    // 3x2 and 19 HP. The third hit is paid for out of the body, three points for
    // three points, and it is worth more to THIS card than to almost any other:
    // Incinerate ramps +1 per consecutive hit on the same target, so a basic
    // goes from 3+4 = 7 to 3+4+5 = 12 while the stat sheet has not moved.
    dmg: 3,
    hits: 3,
    hp: 16,
    sp: 11,
    shields: 2,
    tribe: "Suns",
    keywords: {},
    // Incinerate: consecutive hits on the same target this round ramp +1 DMG/hit.
    passiveNames: { incinerate: "Incinerate" },
    incinerate: true,
    special: {
      name: "Pyro Ball Barrage",
      cost: 3,
      handler: "barrage",
      // Four hits into ONE target, not one hit across four. That's the whole
      // point: Incinerate ramps on consecutive hits against the SAME target, so
      // spreading the volley guaranteed the passive did nothing. Stacked it
      // reads 3 + 4 + 5 + 6 = 18.
      params: { dmg: 3, hits: 4, targets: 1 },
      targetSide: "enemy",
      text: "Deal 3 DMG up to 4 times to one opponent — Incinerate ramps each hit.",
    },
  },
  {
    id: "pyro_firebird",
    name: "FireBird",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 4,
    dmg: 8,
    hits: 1,
    hp: 12,
    sp: 11,
    shields: 0,
    keywords: {},
    // Burnout (On Death): 4 DMG to the enemy row directly ahead.
    passiveNames: { onDeath: "Burnout" },
    onDeath: { dmg: 4, rowAhead: true },
    special: {
      name: "Flame Charge",
      cost: 1,
      handler: "strike",
      // BLOODFIRE: BLEED and BURN together — `isBloodfire` reads both being
      // present, so the second status is what makes the charge live up to its
      // name rather than being another plain burn.
      params: {
        dmg: 10, selfDamage: 3,
        statusKind: "BURN", statusPower: 2, statusDuration: 2,
        debuffStatus: "BLEED", debuffStatusRounds: 2,
      },
      targetSide: "enemy",
      text: "Deal 10 DMG and set the target BLOODFIRE — BURN 2 and BLEED, both for 2 rounds. FireBird loses 3 HP.",
    },
  },
  {
    id: "pyro_fenrir",
    name: "Fenrir",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 5,
    dmg: 4,
    hits: 2,
    hp: 17,
    sp: 10,
    shields: 0,
    keywords: { FLYING: true },
    tribe: ["Dragon", "Wolf", "Volcanic"],
    // Scorch: basic attacks apply BURN, stacking up to the BURN 4 cap on a target.
    passiveNames: { onHitStatus: "Scorch" },
    onHitStatus: { kind: "BURN", duration: 2, power: 1 },
    // Fury Unleashed: on summon, 4 DMG to the 3-wide row directly ahead
    // (melee → reaches one row forward, hitting left/mid/right).
    onSummon: { handler: "barrage", params: { dmg: 4, spread: 1, targets: 99 } },
    // On Kill: permanent +1 hit on the basic attack (stacks until Fenrir dies).
    onKill: { buffHits: 1 },
    special: {
      name: "Inferno Pounce",
      cost: 3,
      handler: "strike",
      params: { dmg: 8, statusKind: "BURN", statusPower: 3, statusDuration: 2, statusSplash: 1 },
      targetSide: "enemy",
      text: "Deal 8 DMG and splash BURN 3 (2 rounds) to the target and its neighbours.",
    },
  },
  {
    id: "pyro_tiki",
    name: "Tiki",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 4,
    dmg: 2,
    hits: 2,
    hp: 18,
    sp: 4,
    shields: 2,
    keywords: {},
    passiveNames: { roundTick: "Sweeping Flames" },
    // Sweeping Flames: BURN 1 on every opponent in reach, laid down as the
    // Battle phase OPENS — `roundTick.inRangeStatus` is read by `startBattle`
    // (phases.ts), not by the Cleanup tick, so the fire is already on them for
    // the battle it was meant to affect rather than a round late.
    //
    // Was `rowAheadDmg: 1` — one point of direct damage to whoever happened to
    // be standing in the single row ahead, which on a board where the enemy is
    // arranged as a column, or simply anywhere else, was nothing at all. A
    // torch-bearing tank should set light to what it can REACH, and a burn is
    // a burn: it ticks, it stacks with PYRO's own Scorch, and it is worth more
    // than the point of damage it replaces without being a bigger number.
    roundTick: { inRangeStatus: { kind: "BURN", duration: 2, power: 1 } },
    // Axe Spin has to be WORTH MORE than Sweeping Flames, or it is not a
    // Special. The passive lays BURN 1 for 2 on everything in reach, free, every
    // round; a Special that laid the identical mark for 3 magic was a button
    // with nothing behind it — `applyStatus` keeps the better of power and of
    // duration, so casting it over the passive's own fire changed literally
    // nothing. The drip is the passive; the flare is this.
    //
    // TWO ROUNDS, matching the passive's own clock. The separation is now
    // POWER alone — 3 against 1, tripling the tick on everything in reach —
    // which is still a real button because `applyStatus` keeps the better
    // power: casting over the drip upgrades every existing burn rather than
    // being swallowed by it. The third round was the part that made this read
    // as "the passive, but longer" instead of "the passive, but hotter".
    special: {
      name: "Axe Spin",
      cost: 3,
      handler: "statusNova",
      params: { statusKind: "BURN", statusPower: 3, statusDuration: 2, targets: 99 },
      targetSide: "enemy",
      ranged: true, // "all opponents" — reaches the whole board
      text: "Apply BURN 3 for 2 rounds to every opponent in range.",
    },
  },
  {
    id: "pyro_ember_scorpion",
    name: "Ember Scorpion",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 3,
    dmg: 9,
    hits: 1,
    hp: 8,
    sp: 8,
    shields: 0,
    keywords: {},
    onHitStatus: { kind: "BURN", duration: 2, power: 2 }, // Venomous Sting
  },

  {
    id: "pyro_sarra",
    name: "Sarra",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 4,
    dmg: 4,
    hits: 2,
    hp: 14,
    sp: 8,
    shields: 1,
    keywords: {},
    // Fire Aegis (On Hit by Melee): 2 DMG straight back to the attacker, and it
    // walks away BURNing 2 for 2 rounds. Same shape as Cactus's Needles, in
    // PYRO's damage type — the ward answers the swing and then keeps answering.
    passiveNames: { onHitByMelee: "Fire Aegis" },
    onHitByMelee: { dmg: 2, status: { kind: "BURN", duration: 2, power: 2 } },
    special: {
      name: "Bluflame Slashing",
      cost: 3,
      handler: "statusNova",
      // Bluflame mark = SEAL (can't be healed) for the BURN's duration. Targets
      // the row directly ahead (spread 1, one row deep). statusNova is required —
      // it's the only handler that honors sealRounds.
      params: { statusKind: "BURN", statusPower: 3, statusDuration: 2, spread: 1, forwardDepth: 1, targets: 99, sealRounds: 2 },
      targetSide: "enemy",
      // Names SEAL outright. The mark has always APPLIED the SEAL status, but
      // the text only said "Bluflame them (cannot be healed)" — so the icon
      // sitting on the board and the words on the card shared no vocabulary and
      // a player had nothing to connect them with.
      text: "Apply BURN 3 for 2 rounds to opponents in the row directly ahead, and Bluflame them — SEAL 2 rounds (cannot be healed).",
    },
  },
  {
    id: "pyro_flamehound",
    name: "Flamehound",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 2,
    dmg: 6,
    hits: 1,
    hp: 6,
    sp: 8,
    shields: 0,
    keywords: {},
    // Fire Blast (On Summon): 2 DMG to every opponent in range, and each one
    // catches BURN 1 for a round.
    //
    // No corridor: dropping `spread` falls through to "every enemy in normal
    // range", which for a Ranged card is the 5×5 it can see. Wider than the old
    // 3-wide corridor but for two damage instead of three, and the burn is where
    // the card's identity moved — a hound that sets things alight, not a cannon.
    //
    // Capped at 3. Uncapped it put 8 on a packed board plus a burn on each,
    // clearing cost-3 Spitfire's 9 off a cost-2 body; 3 targets is 6 plus 3 from
    // the burn, which lands level with Spitfire rather than past it.
    //
    // `closest` so the cap is the NEAREST three rather than whichever three the
    // board list happened to yield — the old corridor was sorted that way, and a
    // cap that picks arbitrarily reads as a bug from the other side of the board.
    onSummon: {
      handler: "barrage",
      params: {
        dmg: 2, targets: 3, closest: 1,
        statusKind: "BURN", statusPower: 1, statusDuration: 1,
      },
    },
  },
  {
    id: "pyro_spitfire",
    name: "Spitfire",
    tribe: "Forged Tech",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 3,
    hits: 2,
    hp: 11,
    sp: 8,
    shields: 0,
    keywords: {},
    // Spit Shot (On Summon): 3 DMG to up to 3 opponents anywhere in range.
    onSummon: { handler: "barrage", params: { dmg: 3, targets: 3 } },
  },
  {
    id: "pyro_volcanon",
    name: "Volcanon",
    tribe: "Volcanic",
    rarity: "legendary",
    element: "PYRO",
    cardClass: "Assassin",
    // RANGED, basic and Special both. It shells from a distance rather than
    // closing — a volcano does not walk to you.
    attackType: "Ranged",
    // Cost 6 -> 7. The body does NOT rise with it: 40 against a Cost-7 budget of
    // 45, deliberately under-statted, because what it pays for is not printed on
    // the line — a 13-damage RANGED basic, FLYING, Bad Temper to +5, and
    // Eruption shredding up to 5 shields with a free recast on kill. Registered
    // as an ability-carried exception in state.test.ts, same shape as Siren.
    cost: 7, // LEGENDARY
    dmg: 13,
    hits: 1,
    hp: 19,
    sp: 8,
    shields: 0,
    keywords: { FLYING: true },
    // Bad Temper (passive): a landed basic attack grows Volcanon permanently,
    // to a ceiling of +5. The cap covers BOTH triggers — the on-hit passive and
    // Eruption's per-use +1 — because they are one ability, and capping only the
    // passive would have moved the entire ramp onto the Special.
    passiveNames: { onHitSelfBuff: "Bad Temper" },
    onHitSelfBuff: { dmg: 1, max: 5 },
    special: {
      name: "Eruption",
      cost: 3,
      handler: "strike",
      // printed "5×2 DMG" = 5 hits of 2 — a shield shredder (strips up to 5).
      // selfDamage 2 = "loses 2 HP per use" (was 1); selfDmg 1 = Bad Temper's
      // "+1 DMG permanently after each Eruption", now capped at +5 total;
      // freeRecastOnKill = "On Kill, use Eruption again next round at no cost."
      //
      // The HP toll is the brake that free recasts were outrunning: a kill chain
      // let Eruption fire round after round for nothing, and 1 HP a cast on a
      // 19 HP body was not a cost worth counting.
      params: { dmg: 2, hits: 5, selfDamage: 2, selfDmg: 1, freeRecastOnKill: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 2 DMG × 5 hits to one opponent at range (shreds shields). Costs 2 HP; +1 DMG per use (Bad Temper, max +5); On Kill, recast free next round.",
    },
  },

  // ───────────────────────── BORE ─────────────────────────
  {
    id: "bore_armadillo",
    name: "Granite Armadillo",
    rarity: "rare",
    element: "BORE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 3,
    dmg: 1,
    hits: 1,
    hp: 15,
    sp: 1,
    shields: 4,
    // Adapted for alpha: Curl Up (+2 shields when melee-targeted) → BLOCK 2.
    tribe: "Mountain Beasts",
    keywords: { BLOCK: 2 },
  },
  {
    id: "bore_clubber",
    name: "Clubber",
    rarity: "rare",
    element: "BORE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 2,
    dmg: 4,
    hits: 1,
    hp: 9,
    sp: 3, // juggernaut — slowed from 6 (2-space -> 1-space); the 3 SP went to HP, so the slowness is the whole cost
    shields: 2,
    // Adapted for alpha: HomeRun (50% reflect ranged) → REFLECT 1.
    keywords: { REFLECT: 1 },
    // A club knocks you off your feet. At SP 3 this thing gets ONE swing in
    // before anything else moves, so the shove is what makes being slow
    // survivable — it buys back the distance the low speed costs it.
    passiveNames: { onHitPush: "Haymaker" },
    onHitPush: 1,
  },
  {
    id: "bore_sandman",
    name: "Dunewraith",
    rarity: "legendary",
    element: "BORE",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 7,
    dmg: 2, // "5×2 DMG"
    hits: 5,
    hp: 17,
    sp: 11,
    shields: 1,
    tribe: "Sand Village",
    keywords: {},
    // Sandstorm (Aura): 1 DMG to all opponents each round.
    roundTick: { aoeDmg: 1 },
    // Nightmare (passive): his hits never wake sleepers; deal 2× DMG to SLEEPING
    // opponents; and a flat mid-lane bonus added ONCE to the total (not per hit).
    passiveNames: { ignoresSleepWake: "Nightmare" },
    ignoresSleepWake: true,
    vsStatus: { status: "SLEEP", dmgMult: 2 },
    basicBonus: { midLane: 2, midLaneFull: 3 },
    special: {
      name: "Nightmare",
      cost: 4,
      handler: "statusNova",
      params: { statusKind: "SLEEP", statusDuration: 2, targets: 2 },
      targetSide: "enemy",
      text: "SLEEP up to 2 opponents for 2 rounds.",
    },
  },
  {
    id: "bore_krysteel",
    name: "Krysteel",
    rarity: "epic",
    element: "BORE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 4,
    // 4 hits × 2, from 3×3 — a nerf, and a bigger one than 9→8 raw looks.
    // Going to 4 hits crosses MULTI_HIT_BONUS_MIN, which flips which King of
    // the Hill bonus a mid row pays: under 4 hits it's +1 DMG (every shard),
    // at 4+ it's +1 HIT. So the mid row went 4×3=12 to 2×5=10, while its own
    // back row went 9 to 8. Measured, both rows.
    // The upside is hit COUNT — each shard strips a shield and rolls CRIT
    // separately, so it shreds stacks. The downside is flat reduction: BLOCK
    // is charged per shard BEFORE the crit doubles, so BLOCK 2 zeroes it.
    dmg: 2,
    hits: 4,
    hp: 10,
    sp: 8,
    shields: 1,
    keywords: { CRIT: true },
    passiveNames: { statusImmune: "Krysteellized Field" },
    statusImmune: true, // Krysteellized Field: immune to negative statuses
    special: {
      name: "Krystal Rain",
      // 3, up from 2. The board-deleting engine: 3 DMG with a CRIT roll on
      // EVERY opponent in range, measured at 12 flat / 24 all-crit against a
      // four-card board, from a mid row, with no cooldown. The problem was
      // never one cast — it was that 2 magic made it the default every round.
      cost: 3,
      handler: "barrage",
      // printed "3 DMG CRIT to all opponents"
      params: { dmg: 3, targets: 99, crit: 1 },
      targetSide: "enemy",
      text: "Deal 3 DMG (CRIT) to every opponent in range.",
    },
  },
  {
    id: "bore_smith",
    name: "Smith",
    rarity: "rare",
    element: "BORE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 2,
    dmg: 2,
    hits: 1,
    hp: 10,
    sp: 6,
    shields: 1,
    keywords: {},
    passiveNames: { onSummon: "Reforged", roundTick: "Forge Work" },
    // Reforged (On Summon): plate every NEARBY ally (the 8 surrounding slots,
    // itself included) with +2 shields, and stoke them for +1 DMG this round.
    onSummon: {
      handler: "grantShield",
      params: { amount: 2, nearby: 1, buffDmg: 1, buffRounds: 1 },
      targetSide: "ally",
    },
    // Forge Work: and then it keeps working. End of every round, the strongest
    // ally in reach gets +1 shield and +1 DMG, permanently.
    //
    // CAPPED AT FIVE, which is this roster's own convention rather than a
    // judgement call: every per-round DMG ramp in the game carries a maxTicks,
    // and seven of the nine are at 5. Uncapped, a surviving 2-drop hands one
    // body +9 DMG by round ten and keeps going — the shape the balance notes
    // name as the thing to avoid. Five is +5/+5 on one card, which is a real
    // engine and still a number a match can answer.
    roundTick: { topDmgAllyForge: { shields: 1, dmg: 1, maxTicks: 5 } },
  },

  {
    id: "bore_rhe",
    name: "Rhyolite",
    rarity: "epic",
    element: "BORE",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 4,
    dmg: 7,
    hits: 1,
    hp: 9,
    sp: 8,
    shields: 2,
    keywords: {},
    // Rocky Force Field: 50% chance to deflect a ranged attacker's hit.
    passiveNames: { blocksRangedChance: "Rocky Force Field" },
    blocksRangedChance: 50,
    special: {
      name: "Rigid Smash",
      cost: 3,
      handler: "barrage",
      // canon "9 DMG and SLEEP 2 opponents in the row ahead" (restored to 9)
      params: { dmg: 9, targets: 2, statusKind: "SLEEP", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 9 DMG and SLEEP up to 2 opponents for 2 rounds.",
    },
  },
  {
    id: "bore_rockgoblin",
    name: "Rock Goblin",
    rarity: "rare",
    element: "BORE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 2, // formula-correct: 4+6+2·2+6 = 20 → cost 2
    dmg: 4,
    hits: 1,
    hp: 9,
    sp: 3, // juggernaut — slowed from 6 (2-space -> 1-space); the 3 SP went to HP, so the slowness is the whole cost
    shields: 2,
    keywords: {},
    tribe: "Goblin",
    // CAVE GUARD is one thing now, not two. It used to be a zone AND a screen:
    // `guardsHomeRow` made the square behind it untargetable by anything,
    // fliers and ranged included. That is a strong, invisible rule — the
    // opponent finds out by having a shot refused — and it was doing a
    // different job from the damage. Only the zone is left, and it is gated on
    // the goblin actually standing where a guard stands.
    //
    // ON ITS OWN HOME ROW, which is the condition that makes the name true. A
    // "guard" that follows you up the board is a chaser; this one holds a line,
    // and stepping off that line is what switches it off. `guardsHomeRow` stays
    // on the cards that still screen (Vigil, Hold the Line) — this is a change
    // to Rock Goblin, not to the keyword.
    //
    // Reach is whatever the card really has (canTarget decides), so on a Melee
    // body that is the adjacent ring — walk next to the goblin and it swings.
    passiveNames: { onOppMove: "Cave Guard" },
    onOppMove: { dmg: 2, onlyOnHomeRow: true },
  },
  {
    id: "bore_hillbilly",
    name: "Hillbilly",
    rarity: "rare",
    element: "BORE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 5,
    sp: 2,
    shields: 3,
    keywords: {},
    // Hillside (On an ally being hit, first time): +1 shield to that ally. Was
    // keyed off Hillbilly's OWN landed basic and only reached the row directly
    // ahead — a cost-1 Tank had to attack to protect anyone, and could not brace
    // the card standing next to it. Reuses Monger's Pride Guardian hook
    // (onAllyHitShield), which is already exactly this trigger; the two differ
    // only in slab size (Monger 2, Hillbilly 1).
    passiveNames: { onAllyHitShield: "Hillside" },
    onAllyHitShield: 1,
  },
  {
    id: "bore_bearocks",
    name: "Bearocks",
    rarity: "legendary",
    element: "BORE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 8, // LEGENDARY
    dmg: 10,
    hits: 1,
    hp: 30,
    sp: 3,
    shields: 2,
    keywords: { TRAMPLE: true },
    trampleDmg: 3,
    passiveNames: { statusImmune: "Hibernation" },
    statusImmune: true, // Hibernation: immune to status effects
    // Trample Through: 30 HP walks through most of the board's front line.
    // On Death: revive once at 24 HP, then SLEEP itself for 1 round.
    onRevive: { heal: 24, sleep: 1 },
    special: {
      name: "Blunt Bash",
      cost: 5,
      handler: "barrage",
      // printed "5 DMG to opponents in the row directly ahead and SLEEP 2r"
      params: { dmg: 5, targets: 3, statusKind: "SLEEP", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 5 DMG and SLEEP up to 3 opponents for 2 rounds.",
    },
  },

  // ───────────────────────── DUSK ─────────────────────────
  {
    id: "dusk_silkstalker",
    name: "Silkstalker",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 4,
    dmg: 4,
    hits: 2,
    hp: 10,
    sp: 12,
    shields: 0,
    keywords: { EVASION: true }, // Silent Weaver
    // Its dodge only works while it is on the ENEMY's side (like Ravven). It
    // stalks evasive but is exposed defending its own ground — a defensive nerf,
    // since permanent everywhere-evasion made it far too hard to remove at home.
    evasionEnemySideOnly: true,
    tribe: "Spider",
    special: {
      name: "Web Snare",
      cost: 1,
      handler: "strike",
      // printed "7 DMG and −50% accuracy for 2 rounds" — BLIND models the accuracy cut
      params: { dmg: 7, statusKind: "BLIND", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 7 DMG and BLIND the target (−50% accuracy) for 2 rounds.",
    },
  },
  {
    id: "dusk_widowbite",
    name: "Widowbite",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Assassin",
    attackType: "Melee",
    // 7 + 6 + 7 = 20 = 5*2+10. Down from cost 3, and the five points come
    // entirely off the BODY — which is the one stat this card is happier
    // without. Lingering Venom pays out when Widowbite DIES, so a cheaper,
    // flimsier spider is a better spider: 2 gold buys something that trades
    // itself for 15 damage of venom on whatever ate it. The bite and the legs
    // are what it needs to get there, so both are untouched.
    cost: 2,
    dmg: 7,
    hits: 1,
    hp: 6,
    sp: 7,
    shields: 0,
    keywords: {},
    tribe: "Spider",
    // Lingering Venom (On Death): was a 10 PEN slap at the killer. It is now a
    // venom — no impact damage at all, the killer just walks away carrying 5
    // DOT for 3 rounds (15 total, if it lives that long). inRangeOnly: a melee
    // grudge only reaches a killer that came within a slot of it, so a ranged
    // pick-off is now clean. NOTE a card-specific onDeath REPLACES DUSK's
    // Midnight Shade retaliation, so it trades that instant hit for the venom.
    passiveNames: { onDeath: "Lingering Venom" },
    onDeath: { dmg: 0, inRangeOnly: true, killerStatus: { kind: "DOT", duration: 3, power: 5 } },
  },
  {
    id: "dusk_vamp",
    name: "Vamp",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 1,
    dmg: 1,
    hits: 2, // two small bites — each DRAINs, so it lifesteals twice per swing
    hp: 6,
    sp: 7,
    shields: 0,
    keywords: { DRAIN: true }, // DUSK's lifesteal-equivalent
    tribe: "Vamp",
    // Two bites that DRAIN, and a kill is a full meal. Small numbers on purpose:
    // this is a cost-1 body and the heal is meant to keep it alive one more
    // swing, not to make it a lifesteal engine.
    passiveNames: { onKill: "First Blood" },
    onKill: { healSelf: 3 },
  },
  {
    id: "dusk_gool",
    name: "Gool",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    // 4 + 8 + 13 = 25, still exactly the cost-3 budget — five HP traded straight
    // across for five SP. It does NOT buy extra movement: moveReach steps at
    // SP 8 and Gool was already there, so what the speed buys is TURN ORDER,
    // and what it costs is a body that now folds to almost anything.
    dmg: 4,
    hits: 1,
    hp: 8,
    sp: 13,
    shields: 0,
    keywords: {},
    tribe: "Ghost",
    // Spook (On Hit, first time only): FRIGHTEN the opponent for 2 rounds.
    // One touch, and whoever took it spends the next two rounds deciding not to
    // move.
    //
    // Back to 2, which is the floor that buys the move-lock at all: a status
    // applied during BATTLE at duration 1 is ticked away at Cleanup before Prep
    // comes round, so at 1 the half of FRIGHTEN that stops a card MOVING never
    // lands and Spook is a knockback and nothing else. At 2 it survives into the
    // opponent's Prep and actually pins them.
    //
    // It is the whole card now. Gool trades 5 HP for 5 SP above — it goes early
    // and it dies to anything — so what it is FOR is touching something once,
    // first, and taking it out of the race for two rounds.
    passiveNames: { onHitStatus: "Spook" },
    onHitStatus: { kind: "FRIGHTEN", duration: 2, power: 0, firstHitOnly: true },
  },
  {
    id: "dusk_ghastly",
    name: "Ghastly Groom",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 4,
    dmg: 7,
    hits: 1,
    hp: 19,
    sp: 4,
    shields: 0,
    keywords: {},
    tribe: ["Ghost", "Skeleton"],
    special: {
      name: "Phantom Gouge",
      cost: 2,
      handler: "barrage",
      // printed "3 DMG PEN to all opponents in range" — targets 99 -> 2, because
      // a board-wide PEN wipe for 2 magic measured 12.0 dmg/magic, tied for the
      // highest in the game on a cost-4 epic. The 2-target cap is what pays for
      // the damage; the printed number is now 5.
      // NOTE each target takes 8, not 5: attackTrade (Ethereal Trade) adds its
      // +3 to the Special as well as to basics. 8 x 2 = 16 for 2 magic.
      // SEAL 2 joins the PEN, same pairing as the Reaper's scythe: the pierce
      // beats the plate, the seal beats the repair.
      //
      // WORTH WATCHING ON THIS ONE. The comment above records why the target
      // count was cut to 2 — a board-wide version measured 12.0 dmg/magic, tied
      // for the highest in the game — and Ethereal Trade already lifts each hit
      // from 5 to 8, so this is 16 damage for 2 magic before the seal. If the
      // card turns up hot, the TARGET COUNT is the dial that has been used on it
      // before, not the damage.
      params: { dmg: 5, targets: 2, pen: 1, statusKind: "SEAL", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 5 DMG (PEN) to up to 2 opponents in range and SEAL them for 2 rounds (they cannot be healed).",
    },
    // Ethereal Trade (On Attack): +3 DMG per attack — basic AND Phantom Gouge —
    // at the cost of 2 HP each time.
    passiveNames: { attackTrade: "Ethereal Trade" },
    attackTrade: { bonusDmg: 3, hpCost: 2 },
  },
  {
    id: "dusk_haunt",
    name: "Haunt",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 4,
    dmg: 5,
    hits: 1,
    hp: 13,
    sp: 10,
    shields: 0,
    keywords: {},
    tribe: ["Ghost", "ScareKrow"],
    // Frightening (On Hit, first time only): FRIGHTEN the target for 2 rounds.
    //
    // Up from 1, and the extra round is not a small buff — it is the difference
    // between half the status working and all of it. At duration 1 the mark is
    // ticked away at Cleanup before Prep, so the move-lock never landed and
    // Frightening was a pure knockback. At 2 it survives into the opponent's
    // Prep and actually pins the card.
    passiveNames: { onHitStatus: "Frightening" },
    onHitStatus: { kind: "FRIGHTEN", duration: 2, power: 0, firstHitOnly: true },
    special: {
      name: "Jacked",
      cost: 2,
      handler: "drainMax",
      params: { amount: 5, selfShields: 3, selfShieldsMax: 9 },
      targetSide: "enemy",
      text: "Permanently drain 5 max HP from the target. Gain +3 shields.",
    },
  },
  {
    id: "dusk_pumpkin",
    name: "Pumpkin",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 8,
    sp: 5,
    shields: 0,
    keywords: {},
    tribe: "Dark",
    passiveNames: { ignoresHomeRule: "Catapult" },
    ignoresHomeRule: true, // Catapult: can target the whole battlefield
  },
  {
    id: "dusk_skeleton_knight",
    name: "Skeleton Knight",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 2,
    dmg: 4,
    hits: 1,
    hp: 8,
    sp: 8,
    shields: 0,
    keywords: {},
    tribe: "Skeleton",
    // Bone Shield: enters play with a +3 shield barrier (an off-curve passive
    // grant, so it's not counted in the base-stat total).
    summonSelfShields: 3,
  },
  {
    id: "leaf_darth",
    name: "Nightbriar",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 4,
    dmg: 7,
    hits: 1,
    hp: 13,
    sp: 9,
    shields: 1,
    // Shadow Step: STEALTH until first attack each round — exactly the
    // alpha STEALTH keyword.
    keywords: { CRIT: true, STEALTH: true },
    tribe: "Grove",
    // Predator's Snare (On Kill): lay a trap on the slot the prey fell on. The
    // next opponent to walk onto it — OR be summoned onto it — eats 3 DMG,
    // ROOT 2, and LIFESTEAL to Nightbriar.
    //
    // Halved from 7 to 3. The trap was a full copy of Dark Hunting for free, on
    // a card that also carries CRIT and STEALTH, and it now triggers on summons
    // as well — the same payload on twice the triggers would have been a
    // straight buff to a card that did not need one.
    passiveNames: { onKill: "Predator's Snare" },
    onKill: { setTrap: { dmg: 3, rootDuration: 2, lifesteal: 1 } },
    // Dark Hunting: strike a target, ROOT it, and LIFESTEAL the damage.
    special: {
      name: "Dark Hunting",
      cost: 3,
      handler: "strike",
      params: { dmg: 7, statusKind: "ROOT", statusDuration: 2, lifesteal: 1 },
      targetSide: "enemy",
      text: "Deal 7 DMG, ROOT the target for 2 rounds, and LIFESTEAL the damage dealt.",
    },
  },
  {
    id: "dusk_crow",
    name: "Crow",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 2,
    sp: 11,
    shields: 0,
    keywords: { FLYING: true },
    tribe: "Dark",
    // Bird Bomb: explodes on whoever kills it — but only a killer close enough
    // to be caught in it. Crow is FLYING, so in practice its killers are ranged;
    // the gate is what makes standing off and shooting it the safe play.
    // Bird Bomb: it detonates. 5 DMG to EVERYTHING inside its own reach when it
    // falls, not 5 to whoever killed it — a bomb does not care who set it off.
    //
    // The old shape was `dmg: 5, inRangeOnly: true`: a grudge against the killer
    // alone, gated on that killer being close enough. So the card punished
    // exactly one attacker and only when the attacker was melee, which made it
    // a deterrent against the shape of card least able to avoid it and nothing
    // at all against a crowd standing beside it.
    passiveNames: { onDeath: "Bird Bomb" },
    onDeath: { dmg: 0, inRangeDmg: 5 },
  },
  {
    id: "dusk_skelider",
    name: "Skelider",
    tribe: "Skeleton",
    rarity: "legendary",
    element: "DUSK",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 8, // LEGENDARY
    // 10x1 + 21 + 4 + 10 = 45 — the SAME total it printed before (5 DMG / 26 HP),
    // just redistributed, so its existing entry in state.test.ts's cost-8 band
    // exception still describes it correctly and needed no edit.
    dmg: 10,
    hits: 1,
    hp: 21,
    sp: 10,
    shields: 2,
    // TRAMPLE on the lightest body of the five, and that is the point rather
    // than an oversight: the shove needs strictly MORE effective max HP than
    // the victim, so at 21 HP Skelider bulls through chaff and stops dead at
    // anything solid. A cavalry card that can be walled is the right shape.
    keywords: { TRAMPLE: true },
    // Mounted until Dismount: below 10 HP it loses the mount, and with it the
    // king-move — `transformed` gates that, so a dismounted rider walks.
    mounted: true,
    // The mount is worth 10 HP on top, so it rides at 31 and walks away at 21.
    // Off-curve on purpose and modelled on Equestrian's 24K Stallion, which
    // carries its mount the same way (+20 HP via summonSelfBuff) — the formula
    // prices the rider, not the horse.
    //
    // NOT removed at Dismount, and that is deliberate rather than an oversight:
    // this grants MAX and CURRENT HP together, and Dismount only fires once the
    // card is already under 10 HP, so by then the mount's HP has been spent.
    // Clawing back a ceiling the card is nowhere near would change nothing
    // except to make a legendary read as if it loses something it does not.
    summonSelfBuff: { dmg: 0, hp: 10 },
    // Dismount: below 10 HP, deal 5 DMG, lose 5 SP and the Special (basic skeleton).
    passiveNames: { onLowHp: "Dismount" },
    onLowHp: { threshold: 10, dmg: 5, loseSp: 5, loseSpecial: true },
    special: {
      name: "Piercing Charge",
      cost: 4,
      handler: "strike",
      // printed "Move up to 4 and deal 15 PEN" — ranged reach + charge advance.
      // chargeLateral: the rider tracks its victim across columns instead of
      // ploughing straight ahead, so a blocked lane no longer pins it in place.
      params: { dmg: 15, pen: 1, charge: 4, chargeLateral: 1, chargeFirst: 1 },
      ranged: true,
      targetSide: "enemy",
      text: "Ride up to 4 slots in any direction toward your target and deal 15 DMG (PEN) to it.",
    },
  },

  // PYRO stat sweep: HP shifted into DMG across the roster (1.59 -> 1.81
  // dmg/cost), and six cards pushed over the SP-8 movement cliff. moveReach is
  // a STEP FUNCTION — 1 slot at SP<=7, 2 at SP 8+ — and the game is won by
  // walking onto enemy home slots, so a whole element parked under the
  // threshold could not race. Measured: the damage half was worth +0.9 points
  // (noise), the SP half +7.2. Every card keeps its exact budget total.

  // ───────────────────────── AQUA ─────────────────────────
  // Element-locked: FREEZE (SP 0 + half DMG) and SCALD (DOT). Aura deferred.
  {
    id: "aqua_spinefin",
    name: "Spinefin",
    tribe: "SeaC", // Kraken's school (+4 max HP)
    rarity: "rare",
    element: "AQUA",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 6,
    hits: 1,
    hp: 12,
    sp: 7,
    shields: 0,
    keywords: {},
    // Vapor Spines: basic attacks apply SCALD 1 for 2 rounds (non-stacking).
    // Renamed from "Venom Spines", which named the wrong thing — the status is
    // SCALD, AQUA's scalding-steam DOT, and has never been poison. The lore
    // line already read "what they leave in the water", which is vapour.
    //
    // POWER, not duration: SCALD "1 for 2 rounds" ticks 1 a round for two, so
    // the rider is 2 damage over the fight rather than 4. Halved from 2 — the
    // spines are a lingering scald off a 6-DMG ranged basic, not a second
    // damage source, and non-stacking means a Spinefin cannot pile it up by
    // shooting the same target twice.
    passiveNames: { onHitStatus: "Vapor Spines" },
    onHitStatus: { kind: "SCALD", duration: 2, power: 1 },
  },
  {
    id: "aqua_bulletshrimp",
    name: "Bullet Shrimp",
    tribe: "SeaC", // Kraken's school (+4 max HP)
    rarity: "rare",
    element: "AQUA",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 2,
    dmg: 12,
    hits: 1,
    hp: 1,
    sp: 7,
    shields: 0,
    keywords: {},
    onHitStatus: { kind: "FREEZE", duration: 1, power: 0 }, // Thumper
  },
  {
    id: "aqua_polarbear",
    name: "PolarBear",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 4,
    dmg: 5, // +1: 5+22+4 = 31 vs a cost-4 budget of 30, inside the ±2 band
    hits: 1,
    hp: 22,
    sp: 4,
    shields: 0,
    keywords: { TRAMPLE: true },
    tribe: "Ice",
    // Polar Storm (On Summon): give allies in the row directly ahead +1 shield.
    // (Simplified from the canon 3-round ally buff + AoE — owner's call: shields only.)
    onSummon: { handler: "grantShield", params: { amount: 1 }, targetSide: "ally" },
    special: {
      name: "Ice Crash Claw",
      cost: 2,
      // TWO claws, aimed separately — `barrage` with targets: 2, one hit each.
      // It was `strike`, which only ever reads targets[0], so both hits landed
      // on one body and the FREEZE was applied twice to the same card, which
      // refreshes rather than accumulating: 2 rounds, never 4, and never a
      // second target.
      //
      // The battle UI already lets you spend the picks on the same card twice
      // ("repeat to stack"), so concentrating both claws is a real choice — and
      // statusRoundsStack is what makes it worth making: 2 rounds per claw,
      // 4 if you spend them both on one, capped there.
      handler: "barrage",
      params: {
        dmg: 3, hits: 1, targets: 2,
        statusKind: "FREEZE", statusDuration: 2,
        statusRoundsStack: 1, statusRoundsCap: 4,
      },
      targetSide: "enemy",
      text: "Two claws: 3 DMG each, FREEZE 2 rounds each. Spend both on one opponent to freeze it for 4.",
    },
  },
  {
    id: "aqua_owlette",
    name: "Owlette",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 4,
    dmg: 6,
    hits: 1,
    hp: 16,
    sp: 8,
    shields: 0,
    keywords: { FLYING: true },
    tribe: ["Avian", "Ice"],
    // Icy Swoop (End of Round): FREEZE the lowest-HP opponent for 1 round.
    roundTick: { lowestEnemyStatus: { kind: "FREEZE", duration: 1, power: 0 } },
    special: {
      name: "Owl Hail",
      cost: 3,
      handler: "barrage",
      params: { dmg: 4, targets: 3, statusKind: "FREEZE", statusDuration: 1 },
      targetSide: "enemy",
      text: "Deal 4 DMG and FREEZE up to 3 opponents for 1 round.",
    },
  },
  {
    id: "aqua_phrost",
    name: "Phrost",
    tribe: ["Dragon", "Ice"],
    // Dragon's Fury (tribe trait): every kill is +1 DMG, permanently.
    passiveNames: { onKill: "Dragon's Fury" },
    onKill: { buffDmg: 1 },
    rarity: "legendary",
    element: "AQUA",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 6, // LEGENDARY
    dmg: 8,
    hits: 1,
    hp: 16,
    sp: 12,
    shields: 2,
    keywords: {},
    // Freezer Burn (Aura): FROZEN opponents take SCALD 3 each round.
    roundTick: { scaldFrozen: 3 },
    special: {
      name: "Icicle Freeze",
      cost: 4,
      handler: "barrage",
      // "2×4 DMG and FREEZE each target 2r" — hits two opponents.
      params: { dmg: 4, hits: 2, targets: 2, statusKind: "FREEZE", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 4 DMG × 2 and FREEZE up to 2 opponents for 2 rounds.",
    },
  },
  {
    id: "aqua_polarking",
    name: "Polar King",
    tribe: "Ice Kingdom",
    rarity: "legendary",
    element: "AQUA",
    cardClass: "Tank",
    // Back to cost 6, and the stat line goes back with it. The 6->7 recost
    // bought exactly +1 DMG and +4 HP under the "re-stat to match, based on
    // class" rule (Tank: DMG 13% / HP 61% / SHIELD 13% / SP 13%), so undoing
    // the cost undoes the purchase — 40 points against a Cost-6 budget of 40,
    // on the nose. Keeping the bigger body at the lower price would be five
    // free points on a legendary that already answers melee with a 50% FREEZE.
    attackType: "Melee",
    cost: 6, // LEGENDARY
    dmg: 6,
    hits: 1,
    hp: 22,
    sp: 4,
    shields: 4,
    keywords: {},
    // King of Ice (On Hit by Melee): 50% chance to FREEZE the attacker 2 rounds.
    passiveNames: { onHitByMelee: "King of Ice" },
    onHitByMelee: { chance: 50, status: { kind: "FREEZE", duration: 2, power: 0 } },
    special: {
      name: "Polar Shift",
      cost: 4,
      handler: "statusNova",
      params: { statusKind: "FREEZE", statusDuration: 2, targets: 3 },
      targetSide: "enemy",
      ranged: true, // "FREEZE all opponents ≤4 HP" — reaches the whole board
      text: "FREEZE up to 3 opponents anywhere for 2 rounds.",
    },
  },
  {
    id: "aqua_blackbeard",
    name: "BlackBeard",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Warrior",
    attackType: "Ranged",
    cost: 5,
    dmg: 5,
    hits: 1,
    hp: 19,
    sp: 7,
    shields: 1,
    keywords: {},
    // SeaC -> Pirate. Note what that costs him: Kraken's school aura is
    // tribe-matched on SeaC and grants +4 max HP, so BlackBeard no longer
    // receives it. He trades a conditional +4 HP for leading a crew of six.
    tribe: ["Pirate", "Vapor"],
    // King of the Seas (On Kill): coin flip — gain +2 or +1 DMG permanently.
    // Scalding Shot: the cannon's basic sears whatever it hits (SCALD 1).
    // Pirate (Aura): +1 DMG to the whole crew. No element filter — Pirates are
    // a cross-element tribe (Scallywag is PYRO), so this reaches all of them.
    passiveNames: { onKill: "King of the Seas", onHitStatus: "Scalding Shot", aura: "Pirate" },
    aura: { scope: "tribe", match: "Pirate", dmg: 1 },
    onKill: { coinBonusDmg: 2 },
    onHitStatus: { kind: "SCALD", duration: 2, power: 1 },
    special: {
      name: "Vapor Shark Cannon",
      cost: 4,
      handler: "barrage",
      params: { dmg: 5, targets: 3, statusKind: "SCALD", statusPower: 2, statusDuration: 2 },
      targetSide: "enemy",
      ranged: true, // printed "3 opponents anywhere on the board"
      text: "Deal 5 DMG and apply SCALD 2 (2r) to up to 3 opponents anywhere.",
    },
  },
  {
    id: "aqua_sapphire",
    name: "Sapphire",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 5,
    dmg: 3,
    hits: 2,
    hp: 15,
    sp: 10,
    shields: 2,
    keywords: {},
    tribe: ["Dragon", "Vapor"],
    // Vaporizer (On Kill): +1 SP and +1 DMG permanently. (Doc also pokes the
    // lowest-HP enemy + repositions — those halves aren't modeled yet.)
    passiveNames: { onKill: "Vaporizer" },
    onKill: { buffSp: 1, buffDmg: 1 },
    special: {
      name: "Geyser Gash",
      cost: 3,
      handler: "barrage",
      params: { dmg: 3, targets: 2, statusKind: "SCALD", statusPower: 3, statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 3 DMG and apply SCALD 3 (2r) to up to 2 opponents.",
    },
  },
  {
    id: "aqua_coralgolem",
    name: "Coral Golem",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 3,
    dmg: 2,
    hits: 1,
    hp: 14,
    sp: 1,
    shields: 4,
    keywords: {},
    // Calcify: regrows +1 shield at the end of each round.
    roundTick: { selfShields: 1, selfShieldsMax: 7 },
    // Coral Spurs: 2 DMG back to melee attackers.
    passiveNames: { onHitByMelee: "Coral Spurs" },
    onHitByMelee: { dmg: 2 },
  },
  {
    id: "aqua_vaporem",
    name: "Vaporem",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 5,
    dmg: 2,
    hits: 5, // 2×5 shield shredder
    hp: 17,
    sp: 8,
    shields: 0,
    keywords: {},
    tribe: "Vapor",
    // Misty Haze: basic attacks BLIND (−50% accuracy) for a round.
    passiveNames: { onHitStatus: "Misty Haze" },
    onHitStatus: { kind: "BLIND", duration: 1, power: 0 },
    special: {
      name: "Drowning Mist",
      cost: 2,
      handler: "barrage",
      // printed "5×1 DMG to all opponents" — 5 hits of 1 per target (shreds shields)
      params: { dmg: 1, hits: 5, targets: 99 },
      targetSide: "enemy",
      text: "Deal 1 DMG × 5 to every opponent in range (shreds shields).",
    },
  },

  // ───────────────────────── DAWN ─────────────────────────
  // Element-locked: BLIND (−50% accuracy) and CLEANSE. Aura deferred.
  {
    id: "dawn_beam",
    name: "Beam",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Ranger",
    tribe: "Stars",
    attackType: "Ranged",
    cost: 1,
    dmg: 1,
    hits: 3,
    hp: 5,
    sp: 7,
    shields: 0,
    keywords: {},
    // RayBeam (On Summon): 3 DMG + BLIND 2r to a single opponent in range.
    onSummon: { handler: "barrage", params: { dmg: 3, statusKind: "BLIND", statusDuration: 2, targets: 1 } },
  },
  {
    id: "dawn_flash",
    name: "Flash",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Assassin",
    tribe: "Stars",
    attackType: "Melee",
    cost: 1,
    // 3 + 4 + 9 = 16, one over 5*1+10 and inside the +/-2. Up from 2 HP and
    // SP 10: it buys a second point of body with a point of speed, and the
    // speed is the cheaper of the two here because it changes nothing. Both
    // tiers sit either side of nothing — moveReach is 2 anywhere above SP 5,
    // and the king-move tier starts ABOVE SP_MID_MAX (10), which 10 itself
    // does not clear. So 10 and 9 are the same card to the rules, while 2 HP
    // and 4 HP are the difference between dying to a 3-damage basic and not.
    dmg: 3,
    hits: 1,
    hp: 4,
    sp: 9,
    shields: 0,
    keywords: {},
    onHitStatus: { kind: "BLIND", duration: 1, power: 0 }, // Speed Flash
  },
  {
    id: "dawn_musk_ox",
    name: "Musk Ox",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Warrior",
    tribe: "Suns",
    attackType: "Melee",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 18,
    sp: 2,
    shields: 0,
    // Thick Hide: −1 DMG from every incoming attack (flat, applies pre-shield
    // and even to PEN) — that's exactly what BLOCK does.
    keywords: { BLOCK: 1, TRAMPLE: true },
    trampleDmg: 2,
    // Trample Through: it shoulders past anything smaller than it.
  },
  {
    id: "dawn_star",
    name: "Star",
    // Doc "retiers" Star to Rare but keeps its Star Shower Special; a Special is
    // structurally Epic in this codebase (a Rare gets a passive or a once-per-game
    // Talent), so it stays Epic. The faithful fix here is the missing passive half.
    rarity: "epic",
    element: "DAWN",
    cardClass: "Mage",
    tribe: "Stars",
    attackType: "Ranged",
    cost: 3,
    dmg: 2,
    hits: 2,
    hp: 10,
    sp: 7,
    shields: 2,
    keywords: { FLYING: true },
    // Raising Star: BLINDs the enemy board (once, the round it lands — the
    // every-round version let DAWN perma-BLIND the board, so it's held to a
    // single fire for balance) AND its basic attacks heal all allies +1.
    passiveNames: { basicHealsTeam: "Raising Star" },
    basicHealsTeam: 1,
    roundTick: { firstRoundOnly: true, aoeStatus: { kind: "BLIND", duration: 1, power: 0 } },
    special: {
      name: "Star Shower",
      cost: 2,
      handler: "barrage",
      params: { dmg: 4, targets: 99, statusKind: "BLIND", statusDuration: 1 },
      targetSide: "enemy",
      text: "Deal 4 DMG and BLIND every opponent in range.",
    },
  },
  {
    id: "dawn_kosmos",
    name: "Kosmos",
    rarity: "legendary",
    element: "DAWN",
    cardClass: "Ranger",
    tribe: "Stars",
    attackType: "Ranged",
    cost: 6, // LEGENDARY
    dmg: 2,
    hits: 4,
    hp: 18,
    sp: 10,
    shields: 2,
    keywords: {},
    // Shooting Stars (End of Round): 2 DMG to the closest opponent + BLIND them.
    roundTick: { pokeDmg: 2, pokeStatus: { kind: "BLIND", duration: 1, power: 0 } },
    special: {
      name: "Flashing Barrage",
      cost: 3,
      handler: "barrage",
      // printed "4×2 DMG and BLIND all opponents" — 4 hits of 2 to each, BLIND all
      // hits 4 -> 3. At 4 this was 8 damage to EVERY opponent in range for 3
      // magic — measured at 32 burst across a four-card cluster, i.e. 10.7 per
      // magic, higher than any MYTHIC special and roughly double the legendary
      // median, off a cost-6 body. The board-wide BLIND is the real prize here;
      // the volley behind it did not need to be the best in the game as well.
      params: { dmg: 2, hits: 3, targets: 99, statusKind: "BLIND", statusDuration: 1 },
      targetSide: "enemy",
      text: "Deal 2 DMG × 3 and BLIND every opponent in range for 1 round.",
    },
  },
  {
    id: "dawn_solstice",
    name: "Solstice",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Support",
    tribe: "Suns",
    attackType: "Ranged",
    cost: 4,
    dmg: 5,
    hits: 1,
    hp: 14,
    sp: 7,
    shields: 2,
    keywords: {},
    // Radiant Ward: each round, raise a barrier over all allies that absorbs the
    // next incoming negative status.
    roundTick: { wardAllies: true },
    special: {
      name: "Daybreak",
      cost: 2,
      handler: "heal",
      // Heal all allies 5 HP and give them +2 SP for the round.
      params: { amount: 5, targets: 99, buffSp: 2, buffRounds: 1 },
      targetSide: "ally",
      text: "Heal every ally 5 HP and give them +2 SP for the round.",
    },
  },
  {
    id: "dawn_amble",
    name: "Amble",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Support",
    tribe: "Suns",
    attackType: "Ranged",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 10,
    sp: 7,
    shields: 2,
    keywords: { FLYING: true },
    // First Responder (End of Round): heal the lowest-HP ally +4 HP.
    roundTick: { healLowestAlly: 4 },
    // …and the other half of First Responder, which this card carried a
    // "not modeled yet" note about since it was written: the basic attack can
    // be aimed at a hurt ally to heal them for its DMG instead of striking.
    // The machinery was already here and four other cards use it — Amble is a
    // Support that heals on a timer, on a Special, and now on demand, which is
    // what a medic on a battlefield is for.
    //
    // Reaches the whole board: Amble is Ranged and FLYING, so the basic's own
    // range is what limits where it can help, and that is deliberately generous
    // on a 10-HP body that dies to a stiff breeze.
    basicHealsAllies: true,
    special: {
      name: "Battle Maiden",
      cost: 2,
      handler: "heal",
      params: { amount: 4, targets: 3, buffDmg: 1, buffRounds: 1 },
      targetSide: "ally",
      text: "Heal up to 3 allies 4 HP and give them +1 DMG for the round.",
    },
  },
  {
    id: "dawn_dawn",
    name: "Empyrean",
    rarity: "legendary",
    element: "DAWN",
    cardClass: "Support",
    tribe: "Suns",
    attackType: "Ranged",
    cost: 8, // LEGENDARY
    dmg: 3,
    hits: 3,
    hp: 19,
    sp: 12,
    shields: 5,
    keywords: { FLYING: true },
    // War Maiden was named only in this comment, so the card face showed the
    // heal with no name on it. Declared properly now, alongside the new one.
    passiveNames: { roundTick: "War Maiden", onSummon: "Standard Raised" },
    // War Maiden (End of Round): heal all allies +3 HP.
    roundTick: { healAllies: 3 },
    // STANDARD RAISED — Golden Courage fires FREE the moment Empyrean lands.
    // `castsOwnSpecial` is the existing hook for this and Killer Whale is the
    // precedent: a costly body that "needed a whole turn and 3 magic before it
    // did anything" now does its job on arrival.
    //
    // It reads as the card's whole point rather than a bonus. Empyrean is a
    // cost-8 Support whose Special heals the team, cleanses it and hands it +1
    // DMG for two rounds — an army-wide rally that arrived a turn late and only
    // once the magic was banked. A standard is raised when the reinforcement
    // gets there, not a round afterwards.
    onSummon: { castsOwnSpecial: true },
    special: {
      name: "Golden Courage",
      cost: 3,
      handler: "heal",
      // Team +1 DMG for 2 rounds, heal 5, CLEANSE.
      params: { amount: 5, targets: 99, cleanse: 1, buffDmg: 1, buffRounds: 2 },
      targetSide: "ally",
      text: "Heal every ally 5 HP, CLEANSE them, and give the team +1 DMG for 2 rounds.",
    },
  },
  {
    id: "dawn_veil",
    name: "Veil",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Tank",
    tribe: "Suns",
    attackType: "Melee",
    cost: 4,
    dmg: 3,
    hits: 1,
    hp: 20,
    sp: 2,
    shields: 3,
    keywords: {},
    // Gate Keeper: raises a massive golden shield (+8) on summon, and hardens
    // (+1 DMG, +2 SP) the first time that shield is broken.
    summonSelfShields: 8,
    onShieldBreak: { dmg: 1, sp: 2 },
    special: {
      name: "Light Shield",
      cost: 1,
      handler: "grantShield",
      params: { amount: 3 },
      targetSide: "ally",
      text: "Give an ally +3 shields.",
    },
  },
  {
    id: "dawn_lazor",
    name: "Lazor",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Assassin",
    tribe: "Stars",
    attackType: "Melee",
    // Down a cost, and the five points come entirely out of HP: 7 + 10 + 8 = 25,
    // exactly the cost-3 budget. Keeping the 7 DMG is the point — an Assassin
    // whose Special, on-kill ramp and death recoil are all built around landing
    // one big hit does not want to be re-costed by having the hit shrunk. What
    // it becomes is genuinely fragile, which suits a card that deals 7 back to
    // whoever kills it: dying was always half its plan.
    cost: 3,
    dmg: 7,
    hits: 1,
    hp: 10,
    sp: 8,
    shields: 0,
    keywords: {},
    passiveNames: { onDeath: "Flashing Final" },
    onDeath: { dmg: 7 }, // Flashing Final: Flash Ray Strike on the killer
    onKill: { buffDmg: 2 }, // Flash Ray Strike On Kill → +2 DMG permanently
    special: {
      name: "Flash Ray Strike",
      cost: 2,
      handler: "strike",
      params: { dmg: 7 },
      targetSide: "enemy",
      text: "Deal 7 DMG to one opponent.",
    },
  },
  {
    id: "dawn_clipsey",
    name: "Eclipse",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Ranger",
    tribe: "Stars",
    attackType: "Ranged",
    cost: 5,
    dmg: 1,
    hits: 7, // 7×1 shield shredder, SP 14
    hp: 12,
    sp: 14,
    shields: 1,
    keywords: {},
    // Hot Shot (On Kill): +1 DMG for the rest of the round.
    passiveNames: { onKill: "Hot Shot" },
    onKill: { buffDmgRound: 1 },
    // High-noon aim: attacks never miss (ignores the caster's BLIND + target EVASION).
    alwaysHit: true,
    special: {
      name: "High Noon Revolver",
      cost: 3,
      handler: "barrage",
      // printed "7×1 DMG to all in range" — 7 hits of 1 per target (shreds shields)
      params: { dmg: 1, hits: 7, targets: 99 },
      targetSide: "enemy",
      text: "Deal 1 DMG × 7 to every opponent in range (shreds shields).",
    },
  },

  // ───────────────────────── GALE ─────────────────────────
  // Element-locked: STUN (full skip) and WEAKEN (−25% DMG). Fast fliers. Aura deferred.
  {
    id: "gale_duster",
    name: "Duster",
    rarity: "rare",
    element: "GALE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 2,
    dmg: 4,
    hits: 1,
    hp: 8,
    sp: 8,
    shields: 0,
    keywords: {},
    // Dust Off (On Summon): +2 SP to self and the nearest ally.
    onSummon: { handler: "buffSp", params: { amount: 2 }, targetSide: "ally" },
  },
  {
    id: "gale_luna",
    name: "Luna",
    rarity: "rare",
    element: "GALE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 8,
    sp: 13,
    shields: 0,
    keywords: {},
    tribe: "Wolf",
    // Omega Restore (On Kill): +2 max HP and heal 4 per opponent killed — the
    // same restore Omega carries, so the pair share their signature.
    passiveNames: { onKill: "Omega Restore" },
    onKill: { buffMaxHp: 2, healSelf: 4 },
  },
  {
    id: "gale_hawk",
    name: "Stormquill",
    rarity: "rare", // a Talent is not a Special — talents are tier-free
    element: "GALE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 8,
    hits: 1,
    hp: 10,
    sp: 7,
    shields: 0,
    tribe: "Avian",
    keywords: {},
    // High Speed Impact: +1 DMG per SP point above 10, to a maximum of +5.
    //
    // The cap is the whole point. Uncapped, this card had no ceiling at all:
    // its own Talent hands it SP, SP converts 1:1 into damage, and every haste
    // effect in GALE — aura, field, ally buff — fed the same loop. A 3-cost
    // was the best scaling body in the game because nothing said stop.
    passiveNames: { highSpeedImpact: "High Speed Impact" },
    highSpeedImpact: { cap: 5 },
    // Glide Rush (Talent, free · once per game): +2 SP and EVASION, both for 2
    // rounds. The SP is TEMPORARY (buffRounds) and it feeds High Speed Impact
    // above, so the Talent is half of what it takes to reach the cap rather
    // than a third of the way past it.
    talent: {
      name: "Glide Rush",
      text: "Gain +2 SP and EVASION for 2 rounds.",
      handler: "empower",
      params: { selfSp: 2, buffRounds: 2, selfStatus: "EVASION", selfStatusDuration: 2 },
    },
  },
  {
    id: "gale_vaga",
    name: "Squall",
    rarity: "epic",
    element: "GALE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 4,
    dmg: 7,
    hits: 1,
    hp: 11,
    sp: 12,
    shields: 0,
    keywords: {},
    // Shadow: only adjacent attackers reach it; on the enemy side, +1 DMG on the
    // first strike against each opponent.
    onlyAdjacentAttackers: true,
    firstStrikeBonus: 1,
    firstStrikeEnemySideOnly: true,
    special: {
      name: "Extinguisher",
      cost: 1,
      handler: "strike",
      params: { dmg: 8, pen: 1, requireBelowHp: 9 },
      targetSide: "enemy",
      text: "Deal 8 DMG (PEN) to a foe under 9 HP — an execute finisher.",
    },
  },
  {
    id: "gale_buf",
    name: "Hornrush",
    rarity: "epic",
    element: "GALE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    dmg: 2,
    hits: 2,
    hp: 18,
    sp: 3,
    shields: 0,
    // Roost: −1 DMG from all incoming (BLOCK 1) and +1 HP end of round (REGEN 1).
    keywords: { BLOCK: 1, REGEN: 1, TRAMPLE: true },
    trampleDmg: 1,
    tribe: "Avian",
    // Trample Through: the horns are the whole card. At 18 HP it only bullies
    // the genuinely small, which is the point of the max-HP gate.
    special: {
      name: "Horn Toss",
      cost: 2,
      handler: "barrage",
      params: { dmg: 4, targets: 2, statusKind: "STUN", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 4 DMG and STUN up to 2 opponents for 2 rounds.",
    },
  },
  {
    id: "gale_angale",
    name: "Angale",
    rarity: "epic",
    element: "GALE",
    cardClass: "Mage",
    attackType: "Ranged",
    // Up a cost, and the five points go to HP and SPEED rather than to the
    // basic. 4 + 15 + 11 = 30, exactly the cost-4 budget.
    //
    // Purple Wind Surge is now a board-wide control cast, and a controller is
    // worth what it can apply BEFORE the other side swings — WEAKEN and −2 SP
    // landed after the enemy turn are half a card. So the speed is the buy, and
    // the HP is what lets it cast twice. GALE compounds both: Tailwind reads SP
    // as damage and Slipstream reads it as dodge, so a point of speed on this
    // element is never only a point of speed.
    cost: 4,
    dmg: 4,
    hits: 1,
    hp: 15,
    sp: 11,
    shields: 0,
    keywords: { FLYING: true },
    tribe: "Avian",
    // Alluring Aura (When hit): the attacker is WEAKENed — whoever it was.
    //
    // `anyAttacker` upgrades it off the default melee-only thorns. Melee-only
    // was close to dead text on this card: Angale is a Ranged FLYING Mage that
    // stands at the back, so the attackers that actually reach it are the
    // shooters the aura could not answer. Same effect, now on the attacks the
    // card is realistically going to take.
    passiveNames: { onHitByMelee: "Alluring Aura" },
    onHitByMelee: { anyAttacker: true, status: { kind: "WEAKEN", duration: 2, power: 0 } },
    special: {
      name: "Purple Wind Surge",
      cost: 2,
      handler: "barrage",
      // targets: 99 = everything the surge can reach, not a hand-picked three.
      // The damage is deliberately trivial (4 pinpricks); what the cast is FOR
      // is the WEAKEN and the −2 SP, and a wind that blows across a line has no
      // business stopping at the third body in it.
      // -2 SP out, a 1-space shove in — the same trade WolfBane's Whirlwind
      // Slasher took. A speed sap only ever reorders a queue, and on a card
      // whose WEAKEN already cuts what the target hits FOR, it was the second
      // debuff doing the less interesting job. A push moves the board, which is
      // the thing GALE wins with, and it stacks with the surge's own reach:
      // everything in range is shoved a step further from what it was about to
      // capture.
      //
      // applyDebuffRiders runs once per TARGET rather than per hit, so the four
      // pinpricks do not compound into a four-space shove.
      params: { dmg: 1, hits: 4, targets: 99, statusKind: "WEAKEN", statusDuration: 2, push: 1 },
      targetSide: "enemy",
      text: "Deal 1 DMG × 4 to up to all opponents in range, WEAKEN them for 2 rounds, and push each back 1 space.",
    },
  },
  {
    id: "gale_guan",
    name: "Dreadgaze",
    rarity: "epic",
    element: "GALE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 4,
    dmg: 3,
    hits: 1,
    hp: 21,
    sp: 6,
    shields: 0,
    keywords: {},
    // Totem Alert (On Summon): WEAKEN the enemy row directly ahead.
    onSummon: {
      handler: "statusNova",
      params: { statusKind: "WEAKEN", statusDuration: 2, spread: 1, targets: 99 },
    },
    special: {
      name: "Vision of Fear",
      cost: 3,
      handler: "statusNova",
      // WEAKEN all + gain +5 max HP.
      params: { statusKind: "WEAKEN", statusDuration: 2, targets: 99, selfMaxHp: 5 },
      targetSide: "enemy",
      ranged: true, // "WEAKEN all opponents" — reaches the whole board
      text: "WEAKEN every opponent in range for 2 rounds; gain +5 max HP.",
    },
  },
  {
    id: "gale_wolfbane",
    name: "WolfBane",
    rarity: "epic",
    element: "GALE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 5,
    dmg: 9,
    hits: 1,
    hp: 17,
    sp: 9, // restored to canon SP 9 (with the +1 cost, budget stays exact: 9+17+9=35)
    shields: 0,
    keywords: {},
    // Hastened Assault: CRIT only while faster than the target, and heal 3 HP
    // per critical hit (was a flat, unconditional CRIT keyword).
    passiveNames: { critIfFaster: "Hastened Assault" },
    critIfFaster: true,
    healPerCrit: 3,
    special: {
      name: "Whirlwind Slasher",
      cost: 3,
      handler: "barrage",
      // -2 SP for ONE round was close to nothing: it expired before the next
      // Prep in most cases and only ever reordered a queue. WEAKEN 2 cuts what
      // they hit for, stacks with the rest of the element's, and the 1-space
      // shove buys the board position GALE actually wants.
      params: { dmg: 5, targets: 99, push: 1, statusKind: "WEAKEN", statusDuration: 2 },
      targetSide: "enemy",
      ranged: true, // "5 DMG to all opponents" — reaches the whole board
      text: "Deal 5 DMG to every opponent, WEAKEN them for 2 rounds, and push each back 1 space.",
    },
  },
  {
    id: "gale_galeon",
    name: "Galeon",
    tribe: "Avian",
    rarity: "legendary",
    element: "GALE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 8, // LEGENDARY
    dmg: 4,
    hits: 2,
    hp: 30,
    sp: 6,
    shields: 3,
    keywords: {},
    // Wind Guardian (End of Round): blow opponents in range back 1 slot.
    roundTick: { pushEnemies: 1 },
    special: {
      name: "Mighty Winds",
      cost: 3,
      handler: "statusNova",
      // Push all back 2, WEAKEN, and −8 SP for the round.
      params: { statusKind: "WEAKEN", statusDuration: 2, targets: 99, push: 2, spDebuff: 8, spDebuffRounds: 1 },
      targetSide: "enemy",
      ranged: true, // reaches the whole board
      text: "Push every opponent back 2, WEAKEN them (2r), and −8 SP for the round.",
    },
  },
  {
    id: "gale_klipso",
    name: "Klipso",
    rarity: "legendary",
    element: "GALE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 6, // LEGENDARY
    // 8 + 16 + 1*2 + 13 = 39 against a cost-6 budget of 40 — one under, which is
    // inside the ±2 the formula is checked at. Was 9, i.e. exactly on; the point
    // that came off is the one EVASION never paid for. The stat formula does not
    // price keywords, and this card carries the game's best defensive one on an
    // Assassin that already king-moves, so being a point light is the honest
    // place for it to sit.
    //
    // THE THREE POINTS COME OFF THE BODY, and deliberately not off the other
    // two stats. SP 13 clears SP_MID_MAX, so Klipso moves like a king and cuts
    // corners; dropping it to 10 to pay for the re-cost would have bought the
    // cheaper card by taking away the movement that makes an Assassin an
    // Assassin. EVASION is the same story — it is the card's identity and the
    // stat formula does not price it anyway, which is what the note below has
    // always said. So the HP goes: 19 -> 16, a knife that is easier to reach
    // and easier to afford.
    dmg: 8,
    hits: 1,
    hp: 16,
    sp: 13,
    shields: 1,
    // EVASION paid for in HP: the stat formula doesn't price keywords, so the
    // −3 is what keeps it honest rather than a free upgrade.
    keywords: { EVASION: true },
    // Harsh Winds: +4 DMG on the first strike vs each opponent.
    passiveNames: { firstStrikeBonus: "Harsh Winds" },
    firstStrikeBonus: 4,
    special: {
      name: "Tranq Feather Blade",
      cost: 2,
      handler: "strike",
      // STUN is a full skip, not a debuff — 3 rounds took a card out of the game
      // almost entirely for a Cost-2 Special.
      params: { dmg: 10, pen: 1, statusKind: "STUN", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 10 DMG (PEN) and STUN the target for 2 rounds.",
    },
  },

  // ───────────────────────── BOLT ─────────────────────────
  // Element-locked: PARALYZE (50% skip/turn) and MUTED (no Specials). Aura deferred.
  {
    id: "bolt_zap",
    name: "Zap",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 1,
    // 5 + 4 + 8 = 17, unchanged from 5/2/10 — a straight swap of two points of
    // speed for two of body, and it sits at the +2 ceiling of the curve either
    // way. The speed is the cheap side: moveReach is 2 anywhere above
    // SP_SLOW_MAX (5) and the king-move tier starts strictly ABOVE SP_MID_MAX
    // (10), which 10 itself does not clear, so 10 and 8 are the same card to
    // every rule that reads SP. The body is not cheap at all — at 2 HP Zap
    // fired Stuck once and was traded off by the next basic that touched it.
    dmg: 5,
    hits: 1,
    hp: 4,
    sp: 8,
    shields: 0,
    keywords: {},
    // Stuck (On Summon): 5 DMG to one opponent in range.
    // `reachNearest` because it could not otherwise reach anything: a Melee card
    // lands in its own home row, where its on-summon target list is king-step
    // reach, and on the turn you play it that square is almost always empty. The
    // same hole ThunderCat had. Splint, Ariel and Sticks already carry this.
    onSummon: { handler: "barrage", params: { dmg: 5, targets: 1, reachNearest: 1 } },
  },
  {
    id: "bolt_twotales",
    name: "Twintail",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hits: 2,
    hp: 5,
    sp: 5,
    shields: 1,
    keywords: {},
    // Buzz Whip: basic attacks have a 50% chance to PARALYZE for the round.
    passiveNames: { onHitStatus: "Buzz Whip" },
    onHitStatus: { kind: "PARALYZE", duration: 2, power: 0, chance: 50 },
  },
  {
    id: "bolt_zagphu",
    name: "Ricochet",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 4,
    dmg: 6,
    hits: 1,
    hp: 16,
    sp: 8,
    shields: 0,
    keywords: {},
    // Precision Strike: vs an Electrified (any-statused) OR PARALYZED opponent,
    // basic attacks CRIT and heal +4.
    passiveNames: { vsStatus: "Precision Strike" },
    vsStatus: { status: "PARALYZE", anyStatus: true, crit: true, healOnHit: 4 },
    special: {
      name: "Static Toss",
      cost: 2,
      handler: "strike",
      params: { dmg: 8, statusKind: "PARALYZE", statusDuration: 3 },
      targetSide: "enemy",
      text: "Deal 8 DMG and PARALYZE the target for 3 rounds.",
    },
  },
  {
    id: "bolt_static",
    name: "Static",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 10,
    sp: 7,
    shields: 2,
    keywords: {},
    tribe: "ARC",
    // Static Charge (On Kill): extend PARALYZE on every already-paralyzed foe by 1r.
    passiveNames: { onKill: "Static Charge" },
    onKill: { extendStatus: { kind: "PARALYZE", rounds: 1 } },
    special: {
      name: "Discharge",
      cost: 2,
      handler: "barrage",
      // printed "3×1 DMG and PARALYZE all opponents" — 3 hits of 1 per target
      params: { dmg: 1, hits: 3, targets: 99, statusKind: "PARALYZE", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 1 DMG × 3 and PARALYZE every opponent in range for 2 rounds.",
    },
  },
  {
    id: "bolt_webster",
    name: "Webster",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 2,
    hits: 2,
    hp: 9,
    sp: 8,
    shields: 2,
    keywords: {},
    tribe: "ARC",
    // Electro Wrap (On Hit twice in one round): MUTE the target for the round.
    passiveNames: { onHitStatus: "Electro Wrap" },
    onHitStatus: { kind: "MUTED", duration: 1, power: 0, onSecondHit: true },
    special: {
      name: "Web Shock",
      cost: 2,
      handler: "barrage",
      params: { dmg: 3, targets: 3, statusKind: "PARALYZE", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 3 DMG and PARALYZE up to 3 opponents for 2 rounds.",
    },
  },
  {
    id: "bolt_lytning",
    name: "Lytning",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 5,
    dmg: 5,
    hits: 2,
    hp: 17,
    sp: 8,
    shields: 0,
    keywords: {},
    // Complete Circuit: each round, current arcs through every PARALYZED enemy
    // in range for 2 DMG (Whip Strike sets up the stun; this punishes it).
    roundTick: { aoeParalyzedDmg: 2 },
    special: {
      name: "Whip Strike",
      // 3, up from 2. Reviving Static Discharge (PARALYZE 1 -> 2) handed back
      // most of the damage cut — 12.0 -> 6.0 -> 10.0/magic — and doubled the
      // board-wide control on top. Pricing the cast keeps the combo whole
      // rather than breaking it again: ~6.7/magic.
      cost: 3,
      handler: "barrage",
      // printed "2×3 DMG and PARALYZE all opponents" — 2 hits of 3 per target
      // hits 2 -> 1. Measured at 12.0 damage per magic — tied for the highest
      // in the game, on a cost-3 epic that ALSO paralyzes the whole board. Same
      // cut as Vernal: the board-wide PARALYZE is the identity, so the reach and
      // the control stay and only the damage halves.
      //
      // statusDuration 2, not 1, and it's what makes Static Discharge real: the
      // roundTick above hits PARALYZED enemies at Cleanup step 4b, but statuses
      // tick down at step 3 — so a 1-round PARALYZE was always gone before its
      // own tick looked for it. Measured 0 damage from the combo. Same trap as
      // Fallow's ROOT feeding Trapper.
      params: { dmg: 3, hits: 1, targets: 99, statusKind: "PARALYZE", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 3 DMG and PARALYZE every opponent in range for 2 rounds.",
    },
  },
  {
    id: "bolt_sentry",
    name: "Sentry",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 4,
    dmg: 5,
    hits: 1,
    hp: 15,
    sp: 5,
    shields: 3,
    keywords: {},
    tribe: "ARC",
    // Volt Turret (End of Round): 5 DMG to one PARALYZED opponent in range.
    roundTick: { pokeParalyzedDmg: 5 },
    special: {
      name: "Static Blaster",
      cost: 2,
      handler: "barrage",
      params: { dmg: 5, targets: 99, requireStatus: "PARALYZE" },
      targetSide: "enemy",
      text: "Deal 5 DMG to every PARALYZED opponent in range.",
    },
  },
  {
    id: "bolt_thundercat",
    name: "ThunderCat",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 4,
    dmg: 4,
    hits: 2,
    hp: 11,
    sp: 11,
    shields: 0,
    keywords: {},
    onHitStatus: { kind: "DOT", duration: 2, power: 1 }, // Lightning Scars
    // Arrival Pounce (On Summon): rush straight up its own column and strike
    // what it finds, for 4 CRIT.
    //
    // It did nothing at all before. `spread: 0` scoped the target list to a
    // zero-wide forward corridor measured from where it LANDED — its own home
    // row — and a Melee card standing there reaches one row. On the summon turn
    // that row is almost always empty, so the pounce never fired. It now charges
    // first (sameColumn keeps it honest to "the column ahead") and the target
    // list is widened by the charge, so there is something to land on.
    onSummon: {
      handler: "barrage",
      params: { dmg: 4, crit: 1, targets: 1, sameColumn: 1, chargeFirst: 1, charge: 3 },
    },
    special: {
      name: "Claw Surge",
      cost: 2,
      handler: "strike",
      // printed "Move up to 2 and deal 8 to an opponent in range" — ranged reach
      // (the move) + charge advance afterward.
      //
      // Pounces like Shadow Horsemen rides: `chargeLateral` lets it track its
      // victim across columns instead of only straight ahead, and
      // `chargeDiagonal` lets it cut corners. Ground chargers are otherwise
      // orthogonal-only, so without BOTH a 2-slot charge around a body costs an
      // L and simply fails to arrive — which is not how a cat closes a gap.
      // Note the engine only reads `chargeDiagonal` inside the `chargeLateral`
      // branch, so the pair has to travel together.
      params: { dmg: 8, charge: 2, chargeFirst: 1, chargeLateral: 1, chargeDiagonal: 1 },
      ranged: true,
      targetSide: "enemy",
      text: "Pounce up to 2 spaces in any direction onto your target and deal 8 DMG.",
    },
  },
  {
    id: "bolt_voltogon",
    name: "Voltogon",
    tribe: "Dragon",
    rarity: "legendary",
    element: "BOLT",
    cardClass: "Warrior",
    // AIRBORNE AND AT RANGE. A storm dragon that had to walk into melee was the
    // one thing the art never showed. 10 + 28 + 2*2 + 7 = 49 against a cost-8
    // budget of 50, one under, and the SP pays for the reach: 10 -> 7 is still a
    // two-step body (moveReach is 2 anywhere above SP_SLOW_MAX) but it gives up
    // the king-move tier, which starts above SP_MID_MAX. FLYING hands that back
    // in a better form — it cuts corners AND ignores every ground obstacle.
    attackType: "Ranged",
    cost: 8, // LEGENDARY
    dmg: 10,
    hits: 1,
    hp: 28,
    sp: 7,
    shields: 2,
    keywords: { FLYING: true },
    // Powertrip (On Kill, once per round): 5 DMG to all ELECTRIFIED opponents
    // (= any statused enemy, the BOLT "electrified" proxy).
    passiveNames: { onKill: "Powertrip" },
    onKill: { buffDmg: 1, aoeDmgElectrified: 5 },
    special: {
      name: "Gigavolt Strike",
      cost: 4,
      handler: "strike",
      params: { dmg: 11, healSelf: 11 },
      targetSide: "enemy",
      text: "Deal 11 DMG and heal self 11 HP.",
    },
  },

  // ─────────────── MYTHICS (element core centerpieces) ───────────────
  {
    // 7 + 14 + (4x2) + 11 = 40, exactly a cost-6 budget.
    id: "bore_prism",
    name: "Prism",
    rarity: "legendary",
    element: "BORE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 6,
    dmg: 7,
    hits: 1,
    hp: 14,
    sp: 11,
    shields: 4,
    keywords: {},
    // Elemental Fury: it lands with the Special already paid for, so the first
    // Enchantment costs nothing.
    passiveNames: {
      startsWithFreeSpecial: "Elemental Fury",
      onDeath: "Elemental Fury",
      enchanter: "Rekindle",
    },
    startsWithFreeSpecial: true,
    enchanter: true,
    // ...and the last one it was holding is handed on as it dies.
    onDeath: { dmg: 0, passEnchant: "sharpen" },
    special: {
      name: "Enchantment",
      cost: 1,
      // The Special IS the arming — `enchanter` above does the work in the
      // reducer, from the mode the caster picked. spawn with no token is the
      // codebase's no-op handler.
      handler: "spawn",
      params: {},
      targetSide: "self",
      text: "Enchant your weapon — Freezing (−6 SP), Burning (3 DOT), Sleeping (SLEEP 2), or Sharpen (+6 DMG) — then strike at once if an opponent is in range, otherwise store the charge for your next basic.",
    },
  },
  {
    // 11 + 17 + (1x2) + 10 = 40, exactly a cost-6 budget.
    id: "bolt_keeper",
    name: "Keeper",
    rarity: "legendary",
    element: "BOLT",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 6,
    // Rebalanced WITHIN the same budget (40): DMG 11 -> 7, HP 17 -> 21. Keeper
    // is a breeder, not a sniper — its damage comes from the swarm, and an
    // 11-DMG basic on a 17 HP body meant the one thing it could not do was
    // survive long enough to breed. The points are better spent on the body.
    dmg: 7,
    hits: 1,
    hp: 21,
    sp: 10,
    shields: 1,
    keywords: {},
    // Hive Command: the swarm is only a threat because of this. A 2 DMG Beebot
    // stings for 5 while Keeper lives, and drops back to 2 the moment it dies.
    aura: { scope: "tribe", match: "Bot", dmg: 3 },
    // Hive Mind: half of everything aimed at a 17 HP body goes into the swarm
    // instead — but only as far as the swarm's own HP will stretch.
    passiveNames: { hiveAbsorb: "Hive Mind", summonSpawn: "Hive Mind", roundTick: "Hive Command" },
    hiveAbsorb: { tribe: "Bot", pct: 50 },
    summonSpawn: { token: "bolt_beebot", count: 2 },
    // Hive Command also breeds: one fresh Beebot at the end of every round,
    // replacing the ones that spent themselves stinging. Capped so the swarm
    // holds at a size the opponent can fight through rather than eating the board.
    roundTick: { spawn: { token: "bolt_beebot", count: 1 }, spawnMaxAlive: 5 },
    special: {
      name: "Storm Swarm",
      cost: 3,
      handler: "stormSwarm",
      params: { token: "bolt_beebot" },
      targetSide: "enemy",
      // "per opponent carrying a status" — the handler counts any status, not
      // ELECTRIFIED alone, and BOLT's whole kit is built on that broader read.
      text: "Raise one Beebot per opponent carrying a status, then every Beebot on the board stings.",
    },
  },
  {
    // 8 + 33 + 4 = 45, exactly a cost-7 budget.
    id: "aqua_magalogoon",
    name: "Magalogoon",
    rarity: "legendary",
    element: "AQUA",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 7,
    dmg: 8,
    hits: 1,
    hp: 33,
    sp: 4,
    shields: 0,
    // Swamp Monster: stealth is a PASSIVE, not a keyword — Magalogoon is hidden
    // only while it has neither moved nor attacked this round, and gains nothing
    // the rest of the time. The movedThisRound/attackedThisRound flags clear
    // each Cleanup, so a round spent still re-buries it.
    keywords: {},
    passiveNames: { stealthWhenIdle: "Swamp Monster" },
    stealthWhenIdle: true,
    tribe: "SeaC",
    special: {
      name: "Bog Ambush",
      cost: 3,
      handler: "strike",
      ranged: true, // 2-space reach — drags a foe from up to 2 rows away
      // Drag first, then 8 DMG, then the murk. The accuracy debuff is a flat
      // 25% whiff carried on the card rather than a status — nothing cleanses
      // water in the eyes.
      params: { dmg: 10, dragToCaster: 1, spDebuffPerm: 4 },
      targetSide: "enemy",
      text: "Drag an opponent from up to two rows away into this row, deal 10 DMG, and mire them — 4 SP, permanently.",
    },
  },
  {
    // 7 + 38 + 5 = 50, exactly a cost-8 budget.
    id: "pyro_magmadon",
    name: "Magmadon",
    rarity: "legendary",
    element: "PYRO",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 8,
    dmg: 7,
    hits: 1,
    hp: 38,
    sp: 5,
    shields: 0,
    keywords: {},
    tribe: "Volcanic",
    // Scorched Fury, in two halves: the tick below bleeds 1 HP each Cleanup for
    // +2 DMG the following round, and furyBelowHp adds a further flat +2 once
    // it drops under 10. A 38 HP body that gets angrier the longer it burns.
    furyBelowHp: { hp: 10, dmg: 2 },
    roundTick: {
      selfBurnForDmg: { hp: 1, dmg: 2 },
      // ...and the Meltdown channel, which only runs once the Special lights it.
      // In RANGE, not the row ahead: Magmadon is a melee tank that wades into
      // the middle of things, and an eruption that only ever went forward left
      // whatever was packed around it untouched.
      //
      // `inRangeDmg` is a FLOOR, not the figure: channelDmg() adds whatever
      // Magmadon's damage has gained over its printed 7, so the two halves of
      // Scorched Fury above feed the eruption they are paying HP to sustain.
      channel: { hpCost: 2, inRangeDmg: 5 },
    },
    // Volcanic (Aura): +2 DMG and -1 max HP to the Volcanic line — Fenrir,
    // Volcanon, Infernus Rex, Pyrogon and Magmadon itself.
    //
    // It replaces Trial by Fire, which did the same thing ONCE, on arrival, for
    // a single round: every PYRO ally paid 1 HP for +2 DMG. As a standing aura
    // the trade is the same shape and always on, and it reads off the board
    // instead of off a log line that scrolled away three rounds ago.
    //
    // THE FIRST AURA IN THE GAME THAT CHARGES FOR WHAT IT GIVES. Negative aura
    // components were silently discarded before this (see auraPick in state.ts):
    // the fold kept the highest value from a floor of 0, so -1 was never picked
    // and this would have shipped as a free +2.
    //
    // Retires `empowerElement` — Magmadon was its only caller. Left wired, like
    // `lure`, for the next card that wants it.
    passiveNames: { roundTick: "Scorched Fury", furyBelowHp: "Scorched Fury", aura: "Volcanic" },
    aura: { scope: "tribe", match: "Volcanic", dmg: 2, maxHp: -1 },
    special: {
      name: "Meltdown",
      cost: 4,
      // No handler damage of its own: startsChannel fires the row-ahead blast
      // immediately and then hands the attack to the roundTick above. `spawn`
      // with no token is the codebase's existing no-op handler for a Special
      // whose whole effect is a rider.
      handler: "spawn",
      params: { startsChannel: 1 },
      targetSide: "self",
      text: "Deal 5 DMG (+ Magmadon's bonus DMG) to every opponent in range, then keep erupting every round for 2 HP a round — until Magmadon dies, or is FROZEN or ROOTED. Scorched Fury makes each eruption hotter than the last.",
    },
  },
  {
    // 6 + 31 + 3 = 40, exactly a cost-6 budget.
    id: "dusk_zombination",
    name: "Zombination",
    tribe: "Zombie", // Zombie onTribeDeath payoff
    rarity: "legendary",
    element: "DUSK",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 7,
    dmg: 7,
    hits: 1,
    hp: 34,
    sp: 3,
    shields: 0,
    keywords: {},
    // Contagion (Aura): while Zombination lives, every one of its Zombies that
    // dies sprays 2 DMG to opponents beside it. Strictly Zombination's effect —
    // it ends the instant Zombination is gone.
    passiveNames: { contagionAura: "Contagion", onTribeDeath: "Mass Grave" },
    contagionAura: true,
    // Mass Grave: every Zombie that falls swells the horde-lord — +1 max HP,
    // permanently (its own death is excluded).
    onTribeDeath: { tribe: "Zombie", hp: 1, max: 5 },
    special: {
      name: "Toxic Eruption",
      cost: 3,
      handler: "statusNova",
      // DOT 4 for 3 rounds to everything in range (targets 99 = all of them),
      // and the harvest runs for those same 3 rounds — so a body that finally
      // succumbs on the third tick still rises. The poison does the killing;
      // reviveAsToken only decides who gets the corpse.
      params: {
        targets: 99,
        statusKind: "DOT", statusPower: 4, statusDuration: 3,
        reviveAsToken: "dusk_zombie_tok", reviveRounds: 3,
      },
      targetSide: "enemy",
      text: "Deal 4 DOT for 3 rounds to every opponent in range. Anything that dies while it runs rises as your Zombie.",
    },
  },
  {
    // 9 + 15 + (3x2) + 5 = 35, exactly the cost-5 budget. (The old note here
    // read "7 + 14 + (3x2) + 3 = 30, a cost-4 budget" — the line it described
    // has not existed for some time.) Neither the bane nor Sunlight Strike is
    // priced by the formula: keywords and Specials never are.
    id: "dawn_drakonbane",
    name: "Drakonbane",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Assassin",
    // SUNS, against the class rule that would put an Assassin in Stars — see
    // CLASS_RULE_EXCEPTIONS in auras.test.ts, where it is named rather than the
    // rule being loosened.
    //
    // It swaps Aurora's aura (+1 DMG, +2 SP) for Equestrian's (+1 DMG, +1
    // shield, +1 max HP), and that is the right package for what this card
    // does: it walks up to the biggest thing on the board and trades with it.
    // Three shields on an Assassin was already a bruiser's stat line.
    //
    // THE COST IS A MOVEMENT STEP. At SP 5 it sits on `SP_SLOW_MAX`, so Aurora's
    // +2 used to carry it to 7 and `moveReach` 1 -> 2 whenever she was out. In
    // Suns it is reach 1 always, which in a capture race is a real loss and the
    // one thing given up here.
    tribe: "Suns",
    attackType: "Melee",
    cost: 5,
    dmg: 9,
    hits: 1,
    hp: 15,
    sp: 5,
    shields: 3,
    keywords: {},
    // Dragon's Bane: +2 on BASICS against a Dragon, or anything whose MAX HP is
    // 25 or more — max, not current, so a giant stays bane-worthy after you
    // have opened it up. Specials carry their own printed number, exactly as
    // vsStatus works, so Sunlight Strike is 14/10 flat.
    passiveNames: { vsTarget: "Dragon's Bane" },
    vsTarget: { tribe: "Dragon", maxHpFrom: 25, bonusDmg: 2 },
    // ...and if it lands next to such a target, it opens on it immediately.
    // onlyVsTarget gates the shot: no bane-worthy enemy in range, no ambush.
    onSummon: {
      handler: "strike",
      params: { dmg: 7, onlyVsTarget: 1 },
    },
    // ANTI-AIR, because the Dragons took to the air. Drakonbane is Melee and its
    // whole reason to exist is `vsTarget: { tribe: "Dragon" }` — so the moment
    // Pyrogon and Hydrogon gained FLYING, the game's dedicated dragon-slayer
    // could not touch the two biggest Dragons in it, with either the basic or
    // the Special. A card that cannot reach the thing it is named after is not
    // a counter, it is a dead slot.
    //
    // Same remedy the tower's melee bosses got for the same reason (Rotten
    // Grasp, and the one below it): `antiAir` lifts ONLY the FLYING dodge and
    // leaves the melee reach intact, where `ranged: true` would have quietly
    // handed this Special the whole board. The BASIC is deliberately left
    // grounded — a flying Dragon now costs Drakonbane its Special rather than
    // being farmed by its basic, which is the trade the wings were bought for.
    special: {
      name: "Sunlight Strike",
      cost: 2,
      handler: "strike",
      params: { antiAir: 1, dmg: 10, dmgVsTarget: 14, onKillSelfShields: 2, onKillSelfHeal: 7 },
      targetSide: "enemy",
      text: "Deal 14 DMG to a Dragon (or anything with 25+ max HP), 10 DMG otherwise. On Kill: gain 2 shield and heal 7 HP.",
    },
  },
  {
    // 10 + 24 + 2 + 9 = 45, exactly a cost-7 budget.
    id: "gale_bluejay",
    name: "Bluejay",
    rarity: "legendary",
    element: "GALE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 7,
    dmg: 5,
    hits: 2, // "2x5 DMG"
    hp: 24,
    sp: 9,
    shields: 1,
    keywords: { FLYING: true },
    tribe: "Avian",
    // Gustarrows (On Opp Summon): a reaction shot at anything that arrives in
    // range. Can CRIT, so an unshielded newcomer sometimes eats 4.
    passiveNames: { onOppSummon: "Gustarrows" },
    onOppSummon: { dmg: 2, crit: true },
    special: {
      name: "Twin Wind Strikes",
      cost: 4,
      // barrage, not strike: TWO 7-DMG strikes the caster assigns — one each to
      // two foes, or both onto one. Each strike carries its riders PER STRIKE,
      // because barrage runs maybeStatus + applyDebuffRiders on every target
      // slot — so double-tapping one body is the FOCUS play the card asks for.
      //
      // -5 SP out, a 2-space shove in. The sap was the second debuff on a
      // Special that already WEAKENs, and it only ever reordered a queue; the
      // push moves the board, which is what GALE wins with. It also makes the
      // two ways to aim this genuinely different rather than just bigger:
      // SPLIT shoves two separate bodies back 2, FOCUS shoves ONE back 4 (the
      // rider fires per strike, and pushBack walks it a slot at a time), which
      // can put a card out of its own reach entirely.
      handler: "barrage",
      params: { dmg: 7, hits: 1, targets: 2, statusKind: "WEAKEN", statusDuration: 2, push: 2 },
      targetSide: "enemy",
      text: "Two 7-DMG strikes — split across two opponents, or both onto one. Each WEAKENs for 2 rounds and pushes 2 spaces, so a double hit is 14 DMG and a 4-space shove.",
    },
  },
  {
    // LEAF's heaviest body: an oak that starts LITERALLY rooted (SP 0 — it
    // cannot move at all) and has to tear itself out of the ground to advance.
    // 6 + 55 = 61 against a cost-10 budget of 60.
    id: "leaf_oakgre",
    name: "Oakgre",
    rarity: "mythic",
    element: "LEAF",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 10,
    dmg: 7,
    hits: 1,
    hp: 55,
    sp: 0, // rooted — moveReach(0) is 0. Uprooted is the only way it ever moves.
    shields: 0,
    keywords: { TRAMPLE: true },
    trampleDmg: 4,
    // Intimidation (Aura): anything weaker than Oakgre flinches. Gated on a LIVE
    // comparison, so as Uprooted grows its DMG the aura catches more of the
    // board — and a card that out-grows Oakgre walks out from under it.
    passiveNames: { intimidate: "Intimidation" },
    intimidate: { dmg: 1, rows: 1 },
    // Trample Through: a walking tree does not go around things. Dead weight
    // until Uprooted clears its SP 0 — Oakgre cannot move at all before that,
    // and a trample is a move — which suits the card: the Special is what turns
    // it from a wall into something that walks over you.
    special: {
      name: "Uprooted",
      cost: 5,
      handler: "empower",
      // No buffRounds, so both grants are PERMANENT and stack across casts —
      // but only three times (maxStacks). Left unchecked, an Oakgre parked out
      // of reach simply grows every round for the rest of the game.
      // The +3 SP is what unpins it: 0 -> 3 clears moveReach's zero and puts it
      // in the slow tier (1 space); fully grown it is +6 DMG / +9 SP.
      // selfHpCost is refused when lethal — it does not opt into selfHpLethal,
      // so Oakgre can never tear itself apart.
      params: { selfHpCost: 9, selfDmg: 2, selfSp: 3, maxStacks: 3 },
      targetSide: "self",
      text: "Lose 9 HP. Permanently gain +2 DMG and +3 SP — it can move for the rest of the game. Three casts maximum.",
    },
  },
  {
    id: "leaf_trinezer",
    name: "Trinezer",
    rarity: "mythic",
    element: "LEAF",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 9,
    dmg: 12,
    hits: 1,
    hp: 23,
    sp: 15,
    shields: 3,
    keywords: {},
    tribe: "Reptile",
    // Reptilian Screech (On Summon): spawn 3 Reptilian tokens into open
    // king's-reach slots (fills what's open; no spawn if none are).
    summonSpawn: { token: "leaf_reptilian_tok", count: 3 },
    // Brood Command: Reptile allies (incl. Trinezer) gain +1 DMG / +1 SP.
    aura: { scope: "tribe", match: "Reptile", dmg: 1, sp: 1 },
    special: {
      name: "Jungle Culling",
      cost: 4,
      handler: "strike",
      // Buffed: a cost-9 mythic was measured at 2.8 damage per magic — the
      // WORST value in LEAF, below a cost-2 Squanch. PEN makes the 11 land on
      // the armoured targets a finisher is aimed at, and Culling the Weak turns
      // each kill into a permanent, stacking team-wide +1 DMG.
      params: {
        dmg: 11, pen: 1,
        onKillSelfStatus: "STEALTH", onKillSelfStatusDuration: 2,
        onKillAllyBuffDmg: 1,
      },
      targetSide: "enemy",
      ranged: true, // reaches the lowest-HP opponent anywhere
      text: "Deal 11 DMG (PEN) to a target (aim the lowest-HP). On a kill: gain STEALTH until end of next round, and Culling the Weak gives EVERY ally +1 DMG permanently.",
    },
  },
  {
    id: "pyro_pyrogon",
    name: "Pyrogon",
    tribe: ["Dragon", "Volcanic"],
    rarity: "mythic",
    element: "PYRO",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 10,
    dmg: 15,
    hits: 1,
    hp: 39,
    sp: 8,
    shields: 0,
    // FLYING. It is a dragon; the one thing the art always showed and the card
    // never did. Note it stays MELEE, so unlike Voltogon — which traded its
    // melee for reach when it took off — this is asymmetric: Pyrogon can still
    // be answered by a flier, by anything RANGED, or by grounding it
    // (ROOT/FREEZE/STUN/SLEEP/PARALYZE), and by nothing else on the ground.
    keywords: { FLYING: true },
    // On Summon: a free Flame Engulf — same reach as the Special (2 rows deep).
    onSummon: {
      handler: "barrage",
      params: { dmg: 7, spread: 1, forwardDepth: 2, targets: 99, statusKind: "BURN", statusDuration: 3, statusPower: 3 },
    },
    // On Kill: permanent +7 HP and +1 DMG.
    onKill: { buffMaxHp: 7, buffDmg: 1 },
    // Volcanic (Aura): the mountain lends its PYRO allies its own heat and bulk.
    // Dragon, not Volcanic — the tribe it shares with Sapphire, Hydrogon,
    // Supernova, Phrost and the rest, rather than every PYRO card on the board.
    //
    // NOTE this NARROWS it inside a mono-PYRO deck (element scope reached all 15
    // of them; Dragon reaches the handful that are Dragons) and WIDENS it
    // everywhere else, because Dragon is a cross-element tribe 13 strong. It is
    // a different aura, not a bigger or smaller one. Pyrogon is itself a Dragon,
    // so it keeps buffing itself either way.
    passiveNames: { aura: "Dragon" },
    aura: { scope: "tribe", match: "Dragon", dmg: 1, maxHp: 3 },
    special: {
      name: "Flame Engulf",
      cost: 4,
      cooldown: 3, // heavy 2-row AoE — 3-round lockout between casts
      // 7 DMG + BURN 3 to a 3-wide corridor, TWO rows deep — the 3 opponents
      // directly ahead plus the row behind them (spread 1, forwardDepth 2).
      handler: "barrage",
      // BURN power 3 -> 2. The corridor can catch six cards, and at power 3 for
      // 3 rounds the burn was 9 per victim — more than the hit itself, and the
      // reason Pyrogon measured 16 damage/round against a cluster, the highest
      // of any mythic by half again. The 7 up front is untouched; it is the
      // sustained tail that was out of band.
      params: { dmg: 7, spread: 1, forwardDepth: 2, targets: 99, statusKind: "BURN", statusDuration: 3, statusPower: 2 },
      targetSide: "enemy",
      text: "Deal 7 DMG + BURN 2 to the 3 opponents directly ahead and the row behind them (2 rows deep). 3-round cooldown.",
    },
    // Aura (Scorch BURN stacks) deferred.
  },
  {
    id: "aqua_kraken",
    name: "Kraken",
    rarity: "mythic",
    element: "AQUA",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 10,
    dmg: 4,
    hits: 3,
    hp: 42,
    sp: 6,
    shields: 0,
    keywords: {},
    tribe: "SeaC",
    // From the Deep: first time it drops to ≤16 HP, permanent +3 DMG/+3 SP/+3 shield.
    passiveNames: { onLowHp: "From the Deep" },
    onLowHp: { threshold: 17, buffDmg: 3, buffSp: 3, gainShields: 3 },
    // Aura: SeaC allies gain +4 max HP.
    aura: { scope: "tribe", match: "SeaC", maxHp: 4 },
    special: {
      name: "Black Wave Crash",
      cost: 4,
      // It was the ONLY mythic damage Special with no printed cooldown, so it
      // ran on the default 1-round lockout — a board-wide 8 + BLIND every other
      // round for 4 magic, measured at 12 damage/round against a cluster, double
      // any other mythic on that pace. 3 brings it in line with its peers.
      cooldown: 3,
      handler: "barrage",
      // Lose 5 HP (can dip Kraken into From the Deep), 8 DMG to all, −accuracy
      // via BLIND for 2 rounds.
      // `reach: 2` — two slots in every direction. Kraken is Melee and the
      // Special carried no reach of its own, so "all opponents" was silently
      // "whatever is touching me": a cost-10 mythic's signature wave hit the one
      // or two bodies pressed against it. The wave now covers the 5×5 around it.
      params: { dmg: 8, targets: 99, reach: 2, statusKind: "BLIND", statusDuration: 2, selfDamage: 5 },
      targetSide: "enemy",
      text: "Lose 5 HP. Deal 8 DMG to every opponent within 2 spaces and BLIND them 2 rounds (water in their eyes). 3-round cooldown.",
    },
  },
  {
    id: "dawn_imperator",
    name: "Imperator",
    rarity: "mythic",
    element: "DAWN",
    cardClass: "Tank",
    tribe: "Suns",
    attackType: "Melee",
    cost: 10,
    dmg: 10,
    hits: 1,
    hp: 26, // Element_Cores' corrected value (the printed 65-total 21-HP was a checksum error)
    sp: 4,
    shields: 10,
    // BLOCK 2 on top of the ten shields, and the two do different jobs: shields
    // are a pool that runs out, BLOCK is a flat toll on every hit that never
    // does. It is what stops a cost-10 emperor being chipped down by a swarm of
    // small hits once the plate is gone. Free against the curve.
    keywords: { BLOCK: 2 },
    // Triple Sun — Crowned: CLEANSE all allies each round (strip negatives).
    // (Order's shield-on-ally-summon and Chaos/Awakening remain deferred — the
    //  "Awakening" bonus-attack mechanic is undefined elsewhere in the docs.)
    roundTick: { cleanseAllies: true },
    // Radiant Court: +1 max HP for every DAWN ally already standing when it
    // arrives. A reward for arriving LATE, which is the right shape for a
    // cost-10 body — an emperor summoned onto an empty board is just an
    // expensive card, and one summoned behind a standing court is worth the ten
    // Gold it took to get there. Fixed at summon; it does not track the board.
    passiveNames: { summonScaleFromKin: "Radiant Court" },
    summonScaleFromKin: { element: "DAWN", maxHp: 1 },
    special: {
      name: "Strike of Dawn",
      cost: 5,
      cooldown: 3, // spawns a 10/10 Heir — 3-round lockout between casts
      handler: "spawn",
      params: {
        token: "dawn_heir_tok",
        count: 1,
        commandAllies: 1,
        // With an Heir already standing, a second one is the least interesting
        // thing a 5-cost 3-round special could do — so the summons reaches
        // higher instead. Data-driven so the pool grows with the set.
        escalateIfPresent: "dawn_heir_tok",
        escalateElement: "DAWN",
        escalateRarity: "epic",
      },
      targetSide: "self",
      text: "Spawn Heir (10/10/2🛡/SP10) — or, if an Heir already stands, a random DAWN Epic instead — then command the charge: every ally immediately fires a basic attack. Crowned: cleanses allies each round. 3-round cooldown.",
    },
  },
  {
    id: "gale_griffith",
    name: "Skyrend",
    rarity: "mythic",
    element: "GALE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 10,
    dmg: 17,
    hits: 1,
    hp: 29,
    sp: 17,
    shields: 0,
    keywords: { FLYING: true },
    tribe: "Avian",
    // On Kill: permanent +2 SP.
    onKill: { buffSp: 2 },
    // Skyborn (Aura): AVIAN allies only — the flock it actually leads — gain
    // +1 DMG and +3 SP. Narrowed from "every GALE ally +1 SP": a mythic's aura
    // should reward building around it, not pay out to the whole element.
    passiveNames: { aura: "Skyborn" },
    aura: { scope: "tribe", match: "Avian", dmg: 1, sp: 3 },
    special: {
      name: "Dive Bomb",
      cost: 5,
      cooldown: 3, // huge nuke + STEALTH escape — 3-round lockout between casts
      handler: "strike",
      // recoilPct is a share of the HP damage DEALT to the main target, so the
      // cost scales with how well the dive lands: ~6 back on a clean 24, less
      // into shields. At 25% it can finish a wounded Skyrend outright.
      // The dive DIVES: it closes up to 3 slots onto whatever it hit, in any
      // direction (it flies, so sideways and diagonals are free). That plants a
      // 29-HP mythic deep in enemy ground — STEALTH covers the landing for
      // exactly one round, so the reposition is a real gamble.
      // Trimmed 27 -> 24 and splash 11 -> 5, with the lost burst paid back as
      // WEAKEN 2 on the main target (-25% of ITS damage, per effectiveDmg). The
      // splash cut is the big one: 11 was most of a second full hit landing on
      // every neighbour. maybeStatus applies to the struck target only, so the
      // splashed neighbours take damage and nothing else.
      params: {
        dmg: 24, splash: 5, recoilPct: 25,
        statusKind: "WEAKEN", statusDuration: 2,
        selfStatus: "STEALTH", selfStatusDuration: 1,
        // A dive that kills lands ON the perch it cleared. It already flies
        // three slots in any direction to get there; stopping one square short
        // of the thing it just deleted was the one part that did not read.
        charge: 3, chargeLateral: 1, chargeFirst: 1, takeSpotOnKill: 1,
      },
      targetSide: "enemy",
      text: "Dive up to 3 spaces in any direction onto your target, deal 24 DMG (+5 splash) and WEAKEN it for 2 rounds, taking 25% recoil, then vanish into STEALTH until next round. A kill leaves Skyrend standing in its place. 3-round cooldown.",
    },
  },
  {
    id: "bolt_elecdroid",
    // ALL CAPS, to match the tribe it is the mythic of. Every other mention of
    // ARC in the game — the tribe field, the aura text, the boss's roster — is
    // capitalised, so the one card actually named after it was the only place
    // it read as an ordinary word.
    name: "ARC",
    rarity: "mythic",
    element: "BOLT",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 10,
    dmg: 15, // 5 + 10
    hits: 1,
    hp: 27,
    sp: 10,
    shields: 7,
    keywords: {},
    tribe: "ARC",
    // Hyper Power Surge (On Kill): +5 DMG this round, +5 SP (round-long, applies
    // to future basics — separate from the combo's in-special escalation).
    // Arc (Aura): the grid it anchors — ARC allies gain +2 DMG and +2 SP.
    passiveNames: { onKill: "Hyper Power Surge", aura: "Arc" },
    onKill: { buffDmgRound: 5, buffSp: 5 },
    aura: { scope: "tribe", match: "ARC", dmg: 2, sp: 2 },
    special: {
      name: "Light Slasher",
      cost: 5,
      cooldown: 3, // chaining 4-hit combo — 3-round lockout between casts
      handler: "combo",
      // 5 → 5 → 5 → 10 combo; a kill chains to the next enemy and raises the
      // remaining hits +5 (that raise lasts only for this combo).
      params: { dmg: 5, hits: 4, finisherDmg: 10, killBoost: 5 },
      targetSide: "enemy",
      text: "5·5·5·10 combo on a target; on a kill, chain to the next enemy with +5 to the rest of the combo. 3-round cooldown.",
    },
    // The on-Surge BOLT-ally aura is deferred.
  },
  {
    id: "dusk_shadowhorsemen",
    art: "dusk_shadow_horsemen",
    name: "Shadow Horsemen",
    rarity: "mythic",
    element: "DUSK",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 10,
    dmg: 16,
    hits: 1,
    hp: 35, // 15 base + 20 Mount (baked in)
    mounted: true, // rides — moves like a king in Prep, same as its charge
    sp: 13,
    shields: 0,
    tribe: "Dark",
    keywords: {},
    // Long Reach: the lance carries. Its BASIC strikes up to 2 slots straight
    // ahead, behind, or to either side — diagonals stay at the usual one step,
    // so the threat is a cross rather than a wider box.
    passiveNames: { basicLineReach: "Long Reach" },
    basicLineReach: 2,
    // Blood Ruby: DUSK allies' basic attacks gain PEN.
    aura: { scope: "element", pen: true },
    special: {
      name: "Shadow Charge",
      cost: 5,
      cooldown: 3, // charge nuke + EVASION escape — 3-round lockout between casts
      handler: "strike",
      // The board-wide splash is gone; what replaced it is a TRAMPLE tied to the
      // path — 5 PEN to anything the rider passes close to on its way in, once
      // each. That rewards riding through a formation instead of paying out
      // regardless of where the target stood.
      // Every part of this pierces: the 19 carries `pen`, the trample is PEN by
      // construction, and DOT already bypasses shields at the Cleanup tick, so
      // armour blunts none of it.
      params: {
        // chargeDiagonal: the horse cuts corners. Ground chargers are otherwise
        // orthogonal-only, mirroring prep movement (where a diagonal costs a
        // non-FLYING card two of its steps) — this Special is an explicit
        // exception, so the ride threads a formation instead of stepping around
        // it in an L. It reaches further per step AND changes who gets trampled.
        dmg: 19, pen: 1, trampleDmg: 5, chargeDiagonal: 1,
        statusKind: "DOT", statusDuration: 1, statusPower: 9,
        selfStatus: "EVASION", selfStatusDuration: 1,
        charge: 4, chargeLateral: 1, chargeFirst: 1,
      },
      targetSide: "enemy",
      ranged: true, // the dive reaches across the board
      text: "Ride up to 4 spaces in any direction toward your target, dealing 5 DMG (PEN) to every opponent you pass. Then hit it for 19 DMG (PEN) + 9 DOT and gain EVASION for a round. 3-round cooldown.",
    },
  },
  {
    id: "bore_deepest",
    art: "bore_the_deepest",
    name: "The Deepest",
    rarity: "mythic",
    element: "BORE",
    cardClass: "Support",
    attackType: "Ranged", // a blind sonar-support that shells from the back — Echolocation gates what it can hit
    cost: 10,
    dmg: 9,
    hits: 1,
    hp: 39,
    sp: 3, // juggernaut pace — it sits still and listens; slowness suits a blind sniper
    shields: 8,
    // Echolocation: BLIND — it can only aim a basic at an enemy in king reach or
    // one that MOVED this round (footsteps). See `targetsOnSound` in canTarget.
    targetsOnSound: true,
    // NO innate STEALTH. Abyssal Emergence is something it DOES, not something
    // it arrives with: the keyword cloaked it from the moment it was summoned,
    // so a cost-10 body sat untargetable before doing anything to earn it. The
    // Special's `selfStatus: STEALTH` is now the only source — it surfaces,
    // quakes, and slips back under.
    keywords: {},
    tribe: "Cavernous",
    // Cavernous (Aura): its own kin, not the whole element — topped up to +1
    // shield each round and carrying +2 max HP while it stands.
    passiveNames: { targetsOnSound: "Echolocation", aura: "Cavernous" },
    aura: { scope: "tribe", match: "Cavernous", shields: 1, maxHp: 2 },
    special: {
      name: "Drilling Quake",
      cost: 5,
      cooldown: 3, // Sinkhole is a heavy AoE — 3-round lockout between casts
      handler: "barrage",
      ranged: true, // "Sinkhole all opponents" reaches the whole board — the quake is felt through the ground, so it ignores Echolocation's sound gate
      // Sinkhole: DOT 3 (maybeStatus) + −5 SP (spDebuff) + −accuracy via BLIND
      // (debuffStatus) — all for 3 rounds.
      params: {
        dmg: 3, targets: 99,
        statusKind: "DOT", statusDuration: 3, statusPower: 3,
        spDebuff: 5, spDebuffRounds: 3,
        debuffStatus: "BLIND", debuffStatusRounds: 3,
        selfStatus: "STEALTH", selfStatusDuration: 1, // slips back underground after the quake
        // Surfacing costs it. Deliberately NO selfHpLethal — a 10-cost mythic
        // deleting itself is a misclick, so the cast is refused at 5 HP or less.
        selfHpCost: 5,
      },
      targetSide: "enemy",
      text: "Tear off 5 HP to sinkhole all opponents in range for 3 DMG — DOT 3, −5 SP, −50% accuracy for 3 rounds — then slip into STEALTH. 3-round cooldown.",
    },
  },

  // ─────────────── EXPANSION: one more canon card per element ───────────────
  {
    id: "leaf_cactus",
    name: "Cactus",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 2,
    dmg: 4, // 2->3
    hits: 1,
    hp: 12,
    sp: 6,
    shields: 0,
    keywords: {},
    tribe: "Grove",
    // Needles (On Hit by Melee): a melee attacker takes 2 back AND is left
    // BLEEDing 2 for 2. Was a limp 1-DMG poke — Cactus was the weakest LEAF
    // card, a 2-DMG body with a rounding-error thorn and no aura synergy. The
    // spines now stick and fester, and the wound they open lets a LEAF ally
    // leave a BLEED DoT on the attacker.
    passiveNames: { onHitByMelee: "Needles" },
    onHitByMelee: { dmg: 2, status: { kind: "BLEED", duration: 2, power: 2 } },
  },
  {
    id: "pyro_baboom",
    name: "BaBoom",
    tribe: "Forged Tech",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 2,
    // 2x2 + 10 + 2*1 + 6 = 22 against a cost-2 budget of 20 — 2 over, inside
    // the band. Trades the single heavy swing this session's PYRO sweep gave it
    // for a two-hit line with real bulk behind it.
    dmg: 2,
    hits: 2,
    hp: 10,
    sp: 6,
    shields: 1,
    keywords: {},
    // Swinging Sweep (On Summon): 2 DMG to every opponent in king's-move reach
    // (the adjacent tiles) and push each back 1.
    onSummon: { handler: "barrage", params: { dmg: 2, targets: 99, push: 1 } },
  },
  {
    id: "bore_cavedweller",
    name: "CaveDweller",
    rarity: "rare",
    element: "BORE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 5,
    sp: 6,
    shields: 1,
    keywords: {},
    // Stalactite Drop (On Summon): 2 DMG and SLEEP one opponent for 1 round.
    onSummon: { handler: "barrage", params: { dmg: 2, targets: 1, statusKind: "SLEEP", statusDuration: 1 } },
  },
  {
    id: "dusk_spider",
    name: "Spider",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 3,
    sp: 9,
    shields: 1,
    keywords: {},
    tribe: "Spider",
    // Venom Bite: basic attacks apply DOT 2 for 1 round.
    passiveNames: { onHitStatus: "Venom Bite" },
    onHitStatus: { kind: "DOT", duration: 1, power: 2 },
    // Webbed (On Summon): FRIGHTEN one opponent for 1 round.
    onSummon: { handler: "statusNova", params: { statusKind: "FRIGHTEN", statusDuration: 1, targets: 1 } },
  },
  {
    id: "aqua_subcool",
    name: "SubCool",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 1,
    dmg: 4,
    hits: 1,
    hp: 5,
    sp: 7,
    shields: 0,
    keywords: {},
    // Too Cool: basic attacks have a 50% chance to FREEZE for 1 round.
    passiveNames: { onHitStatus: "Too Cool" },
    onHitStatus: { kind: "FREEZE", duration: 1, power: 0, chance: 50 },
  },
  {
    id: "dawn_sparkle",
    name: "Sparkle",
    rarity: "rare",
    element: "DAWN",
    // Mage, not Ranger. Class is not cosmetic: the AI's threat score gives
    // Assassins and Mages a +100 bias, so a 2 HP Sparkle is now the first thing
    // an AI opponent reaches for.
    cardClass: "Mage",
    tribe: "Stars",
    attackType: "Ranged",
    // Cost 1 at 4+2+9 = 15, exactly 5*1+10. It used to run SP 14, which put it 5
    // over the cost-1 budget and earned it a budget-test exemption; trimming the
    // speed pays for the price instead.
    cost: 1,
    dmg: 2,
    hits: 2,
    hp: 2,
    sp: 9,
    shields: 0,
    keywords: {},
    // Fickle Wand: basic attacks have a 25% chance to BLIND for 1 round.
    passiveNames: { onHitStatus: "Fickle Wand" },
    onHitStatus: { kind: "BLIND", duration: 1, power: 0, chance: 25 },
  },
  {
    id: "gale_skyforce",
    name: "Skyforce",
    rarity: "rare",
    element: "GALE",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 1,
    // 1x3 -> 1x2, and SP 8 -> 10. 2 + 4 + 10 = 16 against a cost-1 budget of 15,
    // +1 and inside tolerance. A hit comes off the volley and the points go into
    // speed, which on GALE is never only speed:
    //
    //   · SHIELD STRIPPING, the real cut. Every landed hit chips a plate, so
    //     three 1-damage pinpricks stripped THREE plates a turn off a cost-1
    //     body — more than most heavy hitters manage. Two hits strip two.
    //   · Damage falls a third. Tailwind is per HIT and pays +1 at either speed
    //     (it steps every 6 SP), so the volley goes from (1+1)x3 = 6 to
    //     (1+1)x2 = 4 effective.
    //   · SLIPSTREAM is what the SP actually buys, and it is a THRESHOLD, not a
    //     slope: dodge starts at 5% once a card is 3 SP clear of 6, so Skyforce
    //     goes from 0% to 5%. At SP 9 it would have been the same 5%; at 8 it
    //     was nothing at all. Plus it acts earlier in the speed queue.
    //
    // Both shapes stay under MULTI_HIT_BONUS_MIN (4), so the hill keeps giving
    // it +1 DMG rather than flipping to the +1 HIT branch.
    dmg: 1,
    hits: 2,
    hp: 4,
    sp: 10,
    shields: 0,
    keywords: { FLYING: true },
    // Sonic Boom (On Summon): 1 DMG to all opponents.
    onSummon: { handler: "barrage", params: { dmg: 1, targets: 99 } },
  },
  {
    id: "bolt_drshock",
    name: "DrShock",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 2,
    dmg: 3, // one 3-DMG jolt (was 1x3); 3 + 8 + 8 = 19, a cost-2 budget
    hits: 1,
    hp: 8,
    sp: 8,
    shields: 0,
    keywords: {},
    // Shocker: ELECTRIFY an opponent summoned within DrShock's range for 2
    // rounds — it no longer PARALYZEs. ELECTRIFIED is BOLT's own "carries a
    // status" marker, so every BOLT card on the field then reads +2 DMG into
    // the newcomer via the Electrify aura. A setup, where PARALYZE was a lock.
    passiveNames: { onOppSummon: "Shocker" },
    onOppSummon: { status: { kind: "ELECTRIFIED", duration: 2, power: 0 } },
  },

  // ═════════════ RARE + EPIC EXPANSION (2 per element) ═════════════
  // Pulled from the element card docs (*_Cards.docx). Each card carries a
  // `rarity` tag. Stats are rebalanced to the 5·cost+10 curve (the docs'
  // printed totals drift); the printed cost is kept unless it broke the curve
  // (noted inline). Modeled mechanics only — a few doc riders stay unmodeled and
  // are flagged, matching the rest of this file's convention. No art PNGs yet,
  // so these fall back to the flat element token.

  // ───────────────────────── LEAF ─────────────────────────
  {
    id: "leaf_citra",
    name: "Citra",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 5,
    dmg: 6,
    hits: 2, // "2×3 DMG, PEN"
    hp: 16,
    sp: 5,
    shields: 1,
    keywords: { PEN: true },
    // Acidic Leaf Blaze: basic attacks apply BLEED 2 for 1 round (non-stacking).
    passiveNames: { onHitStatus: "Acidic Leaf Blaze" },
    onHitStatus: { kind: "BLEED", duration: 2, power: 2 },
    special: {
      name: "Acidic Bloom",
      cost: 3,
      handler: "statusNova",
      params: { statusKind: "BLEED", statusDuration: 4, statusPower: 2, targets: 4 },
      targetSide: "enemy",
      text: "Apply BLEED 2 for 4 rounds to up to 4 opponents.",
    },
  },
  {
    id: "leaf_guardian",
    name: "Guardian",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 13,
    sp: 5,
    shields: 2, // 1->2
    keywords: {},
    // On Summon: 3 DMG to opponents in the same + adjacent row (forward area).
    onSummon: { handler: "barrage", params: { dmg: 3, spread: 1, targets: 99 } },
    // On Kill: +2 DMG permanently.
    onKill: { buffDmg: 2 },
  },

  // ───────────────────────── AQUA ─────────────────────────
  {
    id: "aqua_octoirate",
    name: "Octoirate",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 14,
    sp: 9,
    shields: 0,
    keywords: {},
    // Liquid -> Pirate; SeaC is KEPT, so unlike BlackBeard and Driftwraith this
    // one stays in Kraken's school and gains the crew's +1 DMG on top. "Liquid"
    // is read by no aura or payoff in the game, so nothing was lost with it.
    tribe: ["SeaC", "Pirate"],
    // On Kill: +3 max HP permanently. Sucker Sword: a landed basic drags the
    // struck enemy 1 slot toward Octoirate.
    onKill: { buffMaxHp: 3 },
    pullOnAttack: 1,
    special: {
      name: "Wave Crash",
      cost: 2,
      handler: "barrage",
      params: { dmg: 4, spread: 1, forwardDepth: 1, targets: 99 },
      targetSide: "enemy",
      // A 3-wide corridor, not the row: `spread: 1` reaches one column each
      // side, which on a 4-wide board can never cover all of it. Worded like
      // Pyrogon's, which uses the same shape.
      text: "Deal 4 DMG to the 3 opponents directly ahead.",
    },
  },
  {
    id: "aqua_krakler",
    name: "Krakler",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 3,
    dmg: 9,
    hits: 1,
    hp: 8,
    sp: 8,
    shields: 0,
    keywords: {},
    // SeaC, not a tribe of one: "Kraken" was Krakler's alone and nothing keyed
    // on it, so it bought nothing. Under SeaC it picks up Kraken's own aura
    // (+4 max HP to SeaC allies) like the rest of the school.
    tribe: ["Kraken", "SeaC"], // brief's Kraken + the school it had
    // Abyssal Grasp (On Summon): SCALD 3 for 2 rounds AND FREEZE an opponent in
    // range for 2 rounds (primary SCALD DoT + secondary FREEZE via debuffStatus).
    // `reachNearest` for the same reason as Zap and Electricel: a Melee card
    // lands in its own home row and its on-summon list is king-step reach, so on
    // the turn you play it there is usually nothing to put the SCALD on.
    onSummon: { handler: "barrage", params: { dmg: 0, targets: 1, reachNearest: 1, statusKind: "SCALD", statusPower: 3, statusDuration: 2, debuffStatus: "FREEZE", debuffStatusRounds: 2 } },
  },

  // ───────────────────────── PYRO ─────────────────────────
  {
    id: "pyro_twins",
    name: "Twins",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 5,
    dmg: 2,
    hits: 2, // "2×2 DMG"
    hp: 29,
    sp: 2,
    shields: 0,
    keywords: {},
    // Rager Twins: +1 DMG permanently on every landed basic attack — but its
    // basics deal half DMG while below 12 HP (the rage downside).
    passiveNames: { onHitSelfBuff: "Rager Twins" },
    onHitSelfBuff: { dmg: 1, max: 3 }, // 2 hits, so +3 is +6 on the swing — Volcanon's +5 ceiling, adjusted for the extra hit
    weakBelowHp: { hp: 12, dmgMult: 0.5 },
    // Doubled damage, and the sustain changes KIND: `selfMaxHp` raises the
    // ceiling permanently (and the current HP with it) where `healSelf` only
    // topped up toward a fixed 29. On a card whose own Rager Twins ramp is
    // switched OFF below 12 HP, a bigger pool is worth more than a bigger heal —
    // it moves the floor it must not fall through, rather than climbing back
    // toward it. It also stacks across casts, which a heal cannot.
    //
    // Twins measured LAST of every card ranked in mixed decks (-25.7 against its
    // cost-5 cohort), though at n=42 that carries a +/-15 band — this is a buff
    // aimed at a card that reads weak rather than one proven weak.
    special: {
      name: "Double Trouble",
      cost: 2,
      handler: "strike",
      params: { dmg: 4, hits: 2, selfMaxHp: 8 },
      targetSide: "enemy",
      text: "Deal 2×4 DMG to an opponent and gain +8 max HP.",
    },
  },
  {
    id: "pyro_smog_card",
    art: "pyro_smog",
    name: "Smog",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 2,
    dmg: 0,
    hits: 1,
    hp: 20,
    sp: 0,
    shields: 0,
    keywords: {},
    // Black Smoke (End of Round): 1 DMG to every opponent in range (Ranged → the
    // whole enemy board), and 1 HP back to every ally. The cloud does not care
    // whose lungs it is in; it just favours the side that brought it.
    //
    // 1 -> 2 cost, 15 -> 20 HP. It prints 0 DMG and SP 0, so the only thing it
    // ever does is this tick — which means the card is entirely a question of
    // how many rounds it survives, and 15 HP at cost 1 was too few to matter
    // against anything that could reach it. Cost 2 / 20 HP sits exactly on the
    // stat budget (5x2 + 10 = 20) and buys the attrition engine enough rounds
    // to actually be one.
    passiveNames: { roundTick: "Black Smoke", onKill: "Creeping Cloud" },
    roundTick: { inRangeDmg: 1, healAllies: 1 },
    // Creeping Cloud: +1 SP per kill. It prints SP 0 — a cloud that cannot move
    // at all — and the only thing that can kill for it is Black Smoke, so every
    // point of speed is earned by choking something out. (Tick kills feed onKill
    // via tickDamage; the ordinary death path only counts basic/special kills,
    // which a 0-DMG card can never land.)
    onKill: { buffSp: 1 },
  },

  // ───────────────────────── BORE ─────────────────────────
  {
    id: "bore_shift",
    name: "Shift",
    rarity: "epic",
    element: "BORE",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 5,
    dmg: 3,
    hits: 3, // "3×2 DMG"
    hp: 15,
    sp: 9,
    shields: 1,
    keywords: {},
    // FAULT LINE. Shift was a bare body: three little hits and a Special, and
    // nothing at all in between — the only cost-5 Epic in BORE with no passive
    // to its name. The ground it stands on is the whole card, so its basic now
    // moves that ground: whatever it hits is shoved a slot back.
    //
    // Once per ATTACK, not per hit — `onHitPush` fires on the volley, so the
    // three-hit spray does not become a three-slot shove. Free against the
    // curve, like every passive: the line stays at 3*3 + 15 + 1*2 + 9 = 35.
    passiveNames: { onHitPush: "Fault Line" },
    onHitPush: 1,
    special: {
      name: "Quaking Comet",
      cost: 2,
      handler: "barrage",
      // Magnitude Shift (per-use +1 DMG ramp) is unmodeled — flat each cast.
      params: { dmg: 2, hits: 2, targets: 99 },
      targetSide: "enemy",
      text: "Deal 2×2 DMG to all opponents.",
    },
  },
  {
    id: "bore_warthog",
    name: "Warthog",
    rarity: "rare",
    element: "BORE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 13,
    sp: 3, // juggernaut — slowed from 6 (2-space -> 1-space); the 3 SP went to HP, so the slowness is the whole cost
    shields: 2,
    keywords: {},
    // Tusk Rush (On Summon): it rolls up to TWO slots forward (Seed Roll's
    // mechanic), THEN gores — 5 DMG to opponents directly ahead of where it ends
    // up. The charge finally moves it, not just the tusks.
    // (The "keep charging on each kill" follow-up is unmodeled.)
    // targets 99 -> 2, the same uncapped-corridor problem Flamehound had: 15
    // damage on arrival off a cost-2 body, by some way the most of any rare.
    // Kept at 5 per target rather than cut to Flamehound's 3, because this
    // corridor only reaches ONE row ahead — Warthog has to be in contact to
    // connect at all, where Flamehound's shot carries down the board.
    passiveNames: { summonAdvance: "Tusk Rush" },
    summonAdvance: 2,
    onSummon: { handler: "barrage", params: { dmg: 5, spread: 1, forwardDepth: 1, targets: 2 } },
  },

  // ───────────────────────── GALE ─────────────────────────
  {
    id: "gale_whirlwolf",
    name: "Whirlwolf",
    rarity: "rare",
    element: "GALE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    dmg: 3,
    hits: 1,
    hp: 14,
    sp: 8,
    shields: 0,
    keywords: { FLYING: true },
    tribe: ["Avian", "Wolf"],
    // Hastening Breeze (On Summon): +5 SP to all allies for the round.
    onSummon: { handler: "buffSp", params: { amount: 5, allAllies: 1, rounds: 1 }, targetSide: "ally" },
    // Wave Pounce (Talent, free, once per game): −3 SP to all opponents for the
    // round and 2 DMG.
    talent: {
      name: "Wave Pounce",
      text: "Once per game, free: deal 2 DMG to all opponents and WEAKEN them for 2 rounds.",
      handler: "barrage",
      params: { dmg: 2, targets: 99, statusKind: "WEAKEN", statusDuration: 2 },
    },
  },
  {
    id: "gale_hawko",
    name: "Hawko",
    rarity: "rare",
    element: "GALE",
    cardClass: "Ranger",
    attackType: "Ranged",
    // Cost 1: 2×1 + 3 HP + 10 SP = 15, exactly the cost-1 budget. The fastest
    // thing in the game on the cheapest body there is — it exists to be
    // somewhere on turn one and to answer a summon, not to trade.
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 3,
    sp: 10,
    shields: 0,
    tribe: "Avian",
    keywords: { FLYING: true },
    // Aerial Dominance: 1 DMG to any opponent summoned within range.
    passiveNames: { onOppSummon: "Aerial Dominance" },
    onOppSummon: { dmg: 1 },
  },

  // ───────────────────────── BOLT ─────────────────────────
  {
    id: "bolt_thunder",
    name: "Thunder",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 5, // doc prints cost 7; re-costed to fit the 5·cost+10 curve
    dmg: 4,
    hits: 2, // "2×4 DMG"
    hp: 16,
    sp: 11,
    shields: 0,
    keywords: {},
    // Electrifying Thunder Clap (On Summon): 5 DMG to all opponents in range.
    // 5 -> 3. A free board-wide hit on arrival, on top of an Arcing Strike that
    // was already the most efficient Special in the game — none of the per-cast
    // figures in the epic audit captured this half of the card.
    onSummon: { handler: "barrage", params: { dmg: 3, targets: 99 } },
    special: {
      name: "Arcing Strike",
      cost: 2,
      handler: "strike",
      // Splash 7 -> 3. It arced the FULL hit to every neighbour, so a target in a
      // cluster took 28 for 2 magic — 14.0 damage per magic, the most efficient
      // card in the game, ahead of every legendary and mythic (Skyrend is 7.8).
      // Skyrend's own splash is 5 on a 24 hit; an arc should be a graze, not a
      // second full strike on each body. The 7 up front is untouched.
      params: { dmg: 7, splash: 3 },
      targetSide: "enemy",
      text: "Deal 7 DMG to a target and 3 DMG to each adjacent opponent.",
    },
  },
  {
    id: "bolt_electricel",
    name: "Electricel",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 2,
    // Was a 4×1 chip attacker; now one clean 5 — a fast single-strike assassin.
    dmg: 5,
    hits: 1,
    hp: 5,
    sp: 10,
    shields: 0,
    keywords: {},
    // Wrap (On Summon): PARALYZE an opponent in range for 2 rounds.
    // `reachNearest` because it could not otherwise reach anything: a Melee card
    // lands in its own home row, where its on-summon target list is king-step
    // reach, and on the turn you play it that square is almost always empty. The
    // same hole ThunderCat had. Splint, Ariel and Sticks already carry this.
    onSummon: { handler: "barrage", params: { dmg: 0, targets: 1, reachNearest: 1, statusKind: "PARALYZE", statusDuration: 2 } },
  },

  // ───────────────────────── DUSK ─────────────────────────
  {
    id: "dusk_reaper",
    name: "Reaper",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 4,
    dmg: 7,
    hits: 1,
    hp: 11,
    sp: 11,
    shields: 0,
    keywords: {},
    tribe: "Skeleton",
    // Soul Reaper (On Kill): +1 DMG permanently, heal 7.
    passiveNames: { onKill: "Soul Reaper" },
    onKill: { healSelf: 7, buffDmg: 1 },
    special: {
      name: "Death's Approach",
      cost: 2,
      handler: "strike",
      ranged: true, // the reaper hurls its scythe — reaches any opponent on the board
      // SEAL rides the cut: PEN already puts the 7 straight through armour, and
      // sealing the wound stops it being healed back for two rounds. The two
      // halves answer the two ways a target survives a sniper — plating and
      // repair — which is what makes this a finisher rather than chip damage.
      params: { dmg: 7, pen: 1, statusKind: "SEAL", statusDuration: 2 },
      targetSide: "enemy",
      text: "Hurl the scythe — 7 DMG (PEN) to any opponent, anywhere, and SEAL it for 2 rounds (it cannot be healed).",
    },
  },
  {
    id: "dusk_skulldrake",
    name: "SkullDrake",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3, // body brought to the 5·cost+10 = 25 budget for a 3-drop (was a cost-2 line)
    dmg: 7,
    hits: 1,
    hp: 10,
    sp: 8,
    shields: 0,
    // FLYING, which a Dragon should always have had. Two things come with it
    // beyond the flavour: melee cannot touch it at all (unless the attacker
    // flies too, or a grounding status lands — ROOT, FREEZE, STUN, SLEEP or
    // PARALYZE), and it moves like a king, so a diagonal costs it one step.
    // On a RANGED body that is a real jump: it was already safe at distance and
    // is now hard to answer up close as well. The grounding statuses are the
    // counter, and DUSK is not short of them.
    keywords: { FLYING: true },
    tribe: ["Dragon", "Skeleton"],
    // Dragon's Fury (tribe trait): every kill is +1 DMG, permanently.
    passiveNames: { onKill: "Dragon's Fury" },
    onKill: { buffDmg: 1 },
    // Purple Flames (On Summon): apply DOT 2 for 3 rounds to the row directly ahead.
    onSummon: { handler: "barrage", params: { dmg: 0, spread: 1, forwardDepth: 1, targets: 99, statusKind: "DOT", statusDuration: 3, statusPower: 2 } },
  },

  // ───────────────────────── DAWN ─────────────────────────
  {
    id: "dawn_radiance",
    name: "Radiance",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Warrior",
    tribe: "Suns",
    attackType: "Melee",
    // Back to the cost the card doc printed. 6 + 19 + 4 + 6 = 35, exactly the
    // cost-5 budget; the five new points are split rather than poured into one
    // stat, and two of them go to SPEED. At 4 SP a Melee Warrior acted close to
    // last every round, which is a poor place to be holding an 11-DMG any-target
    // Special — the extra damage matters less than getting to use it.
    cost: 5,
    dmg: 6,
    hits: 1,
    hp: 19,
    sp: 6,
    shields: 2,
    keywords: {},
    // Brightest Warrior (On Summon): +1 max HP & +1 DMG per 7 max HP of the
    // highest-HP opponent on the board.
    summonScaleFromEnemy: { per: 7, dmg: 1, maxHp: 1 },
    special: {
      name: "SunSword Blasting Strike",
      cost: 2,
      handler: "strike",
      ranged: true, // "any target"
      params: { dmg: 11, selfDamage: 1 },
      targetSide: "enemy",
      text: "Lose 1 HP to deal 11 DMG to any target.",
    },
  },
  {
    id: "dawn_sphere",
    name: "Sphere",
    rarity: "rare",
    element: "DAWN",
    // A Tank now, not a Mage. Note what that costs elsewhere: Kloud's class aura
    // (+1 DMG to allied Mages) no longer reaches Sphere in a mixed DAWN/GALE
    // deck, and nothing grants Tanks in exchange.
    cardClass: "Tank",
    tribe: "Stars",
    attackType: "Ranged",
    // 2 + 7 + 0 + 6 = 15, EXACTLY the cost-1 budget. The remodel left the stat
    // line five under a cost-2 budget and needed an ability-carried exception in
    // state.test.ts to ship; dropping the cost deletes the exception instead of
    // widening what that list is allowed to excuse, which is the better end of
    // the same trade. PEN, the off-curve +2 barrier and DAWN's Awakening are now
    // value ON TOP of a card that pays its own way rather than the argument for
    // why it does not have to.
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 7,
    sp: 6,
    shields: 0,
    keywords: { PEN: true }, // Light Sphere — basic attacks gain PEN
    // Light Sphere (On Summon): raise a +2 shield (a passive grant, off-curve).
    summonSelfShields: 2,
  },

  // ═════════════ REGION FILL — bring each element to 15 cards ═════════════
  // More doc-sourced cards (stats rebalanced to 5*cost+10; unmodeled riders noted).
  {
    id: "pyro_fenix",
    name: "Fenix",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 4,
    dmg: 9,
    hits: 1,
    hp: 10,
    sp: 11,
    shields: 0,
    tribe: "Avian",
    keywords: {},
    // Burning Ashes (On Death): revive once at 1 HP. (Doc also grants +4 shields
    // and a skipped turn on revive — not modeled.)
    passiveNames: { onRevive: "Burning Ashes" },
    onRevive: { heal: 1 },
    special: {
      name: "Phoenix Blast",
      cost: 2,
      handler: "strike",
      // BURN 2 on the target spreads to its adjacent opponents (statusSplash).
      params: { dmg: 10, statusKind: "BURN", statusPower: 3, statusDuration: 2, statusSplash: 1 },
      targetSide: "enemy",
      text: "Deal 10 DMG and apply BURN 3 (2r) to the target and its neighbors.",
    },
  },
  {
    id: "pyro_bbq",
    name: "Grill",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 1,
    dmg: 2, // −1 DMG shifted into +1 SP (budget unchanged: 2 + 12 + 1 = 15 = 5·1+10)
    hits: 1,
    hp: 12,
    sp: 1,
    shields: 0,
    keywords: {},
    // Smokin' Dogs (End of Round): +1 DMG every round, to +5. The doc always
    // capped it there; the ceiling was dropped on the way in and never replaced,
    // which left a cost-1 body climbing past 12 DMG by round 10 without acting.
    roundTick: { buffDmgEveryN: { n: 1, amount: 1, maxTicks: 5 } },
  },
  {
    id: "bore_rollo",
    name: "Rumbler",
    rarity: "epic",
    element: "BORE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 4,
    dmg: 4,
    hits: 1,
    hp: 16,
    sp: 4, // juggernaut — slowed from 6 (2-space -> 1-space); the 3 SP went to HP, so the slowness is the whole cost
    shields: 3,
    keywords: {},
    // Rolling Start: every basic carries the boulder a slot further downfield.
    passiveNames: { advanceOnBasic: "Rolling Start" },
    advanceOnBasic: 1,
    special: {
      name: "Rolling Bash",
      cost: 2,
      handler: "strike",
      // Rover, modeled at last: ranged targeting picks an opponent anywhere in
      // range, then Rumbler ROLLS UP TO 2 SLOTS INTO THEM and bashes — chargeFirst
      // puts the movement before the hit. Without the ranged flag this would do
      // nothing: a Melee card is already adjacent when it attacks, so there is
      // no gap left to roll across.
      params: { dmg: 3, hits: 3, charge: 2, chargeLateral: 1, chargeFirst: 1 },
      ranged: true,
      targetSide: "enemy",
      text: "Roll up to 2 slots into an opponent in range, then deal 3×3 DMG.",
    },
  },
  {
    id: "bore_crock",
    name: "Crock",
    rarity: "rare",
    element: "BORE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 1,
    dmg: 5,
    hits: 1,
    hp: 3,
    sp: 7,
    shields: 0,
    keywords: {},
    // Deathroll (On Death): deal 5 DMG to the attacker — but only one it can
    // actually reach. A death roll is a melee thrash; it was landing on ranged
    // killers clear across the board.
    passiveNames: { onDeath: "Deathroll" },
    onDeath: { dmg: 5, inRangeOnly: true },
  },
  {
    id: "aqua_bahari",
    name: "Bahari",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 3,
    dmg: 2,
    hits: 2,
    hp: 12,
    sp: 9,
    shields: 0,
    keywords: {},
    tribe: "Liquid",
    // Liquification: heal +1 HP per landed basic hit.
    passiveNames: { healPerHit: "Liquification" },
    healPerHit: 1,
    special: {
      name: "Tsunami",
      // cost 3 -> 4 and a printed 3-round cooldown. It measured 24 burst for 3
      // magic off a COST-3 body — 12 damage/round, the top of its bracket by
      // some way (Lytning 10, Autumnal 6) — and like most epics it was running on
      // the 1-round default lockout. Board-wide damage now costs more and comes
      // round less often; the 6 itself is untouched.
      cost: 4,
      cooldown: 3,
      handler: "barrage",
      params: { dmg: 6, targets: 99, spDebuff: 3, spDebuffRounds: 1 },
      targetSide: "enemy",
      text: "Deal 6 DMG to all opponents and −3 SP for the round. 3-round cooldown.",
    },
  },
  {
    id: "gale_rayfen",
    name: "Rayfen",
    rarity: "epic",
    element: "GALE",
    // Ranged Mage, same kit otherwise. Wind Warp — its basics reaching any row
    // like a Ranged card — used to sit here as an unmodeled note on a Melee
    // Assassin; being Ranged simply IS that passive, so the note is gone and the
    // card does what it always said it did.
    cardClass: "Mage",
    attackType: "Ranged",
    // Up a cost, spread across all three stats: 3x2 + 18 + 11 = 35, exactly the
    // cost-5 budget. Nothing here is a specialist's bump — Rayfen warps into
    // range, ambushes, and has to survive standing where it landed, so it wants
    // a little of each rather than a lot of one.
    cost: 5,
    // 4x2 + 16 + 11 = 35, still exactly the cost-5 budget — the two points come
    // straight off HP and land on the blades. Read as TWO hits of 4, keeping
    // the two-blade shape the card is built around; four hits of 2 would total
    // the same 8 and sit on the same budget, but it is a different card.
    dmg: 4,
    hits: 2,
    hp: 16,
    sp: 11,
    shields: 0,
    // Both blades of the 4×2 roll for a crit — which is where the shape matters:
    // CRIT doubles a HIT, so heavier blades are worth more to it than more of
    // them, and an unshielded target can now take 16 off a single swing.
    keywords: { CRIT: true },
    // Wind Warp: it moves to anywhere open on the board, at any distance.
    passiveNames: { windWarp: "Wind Warp" },
    windWarp: true,
    special: {
      name: "Ambush",
      cost: 3,
      handler: "barrage",
      ranged: true, // strikes the far row
      params: { dmg: 7, pen: 1, targets: 3 },
      targetSide: "enemy",
      text: "Deal 7 DMG (PEN) to up to 3 opponents anywhere on the board.",
    },
  },
  {
    id: "bolt_kore",
    name: "Kore",
    // Promoted from the old Rare Cost-1/2 "Electric Pulse" Tank to the Epic
    // reactor-mech the doc describes; its vacated Rare Tank slot is Junker
    // (bolt_junker). NOTE: the doc wants new reactor-mech art — until that lands
    // the card keeps its existing bolt_kore.webp image.
    rarity: "epic",
    element: "BOLT",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 5,
    dmg: 5,
    hits: 1,
    hp: 18,
    sp: 6,
    shields: 3,
    keywords: {},
    tribe: "ARC",
    // Living Reactor (Start of Round): +1 shield every round, no cap — the
    // reactor never stops drawing power.
    // Meltdown (On Death): the containment fails and the charge escapes as a
    // Static Wisp — the weakened token version of Static Cloud (10 HP, 2 DMG +
    // PARALYZE 1 a round). Spawning the FULL cost-2 Static Cloud card here paid
    // a cost-5 epic an entire second card for free.
    passiveNames: { selfShields: "Living Reactor", onDeath: "Meltdown" },
    roundTick: { selfShields: 1, selfShieldsMax: 6 },
    onDeath: { dmg: 0, spawnToken: { token: "bolt_static_wisp_tok", count: 1 } },
    // Core Overload: release the built-up charge — 8 DMG to all opponents in
    // range and PARALYZE each for 1 round.
    special: {
      name: "Core Overload",
      cost: 3,
      handler: "barrage",
      params: { dmg: 8, targets: 99, statusKind: "PARALYZE", statusDuration: 1 },
      targetSide: "enemy",
      text: "Deal 8 DMG to all opponents in range and PARALYZE each for 1 round.",
    },
  },
  {
    id: "dusk_scarlett",
    name: "Scarlett",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    dmg: 2,
    hits: 2,
    hp: 10,
    sp: 11,
    shields: 0,
    keywords: { DRAIN: true }, // Bloody Bite: basics DRAIN
    tribe: "Vamp",
    // Bat Swarm (Talent, free, once per game): swarm all opponents for 2 each,
    // draining 1 max HP from each (the swarm feeds). Retiered Epic→Rare per the
    // doc, Special→Talent. (Doc's 75% per-target hit chance isn't modeled.)
    talent: {
      name: "Bat Swarm",
      text: "Once per game, free: deal 2 DMG to all opponents and DRAIN 1 max HP from each.",
      handler: "barrage",
      params: { dmg: 2, targets: 99, drain: 1 },
    },
  },

  // ─────────────── LEGENDARY EXPANSION (one per element) ───────────────
  // Each hits the stat budget exactly (dmg*hits + hp + 2*shields + sp = 5*cost+10)
  // and its Special/passives reuse proven handlers, so the card text is literally
  // what the engine does. Synergizes with each element's auto-passive.
  {
    id: "leaf_elderroot",
    name: "Elderroot",
    rarity: "legendary",
    element: "LEAF",
    cardClass: "Support",
    attackType: "Melee",
    cost: 6,
    dmg: 5,
    hits: 1,
    hp: 20,
    sp: 6,
    shields: 5,
    keywords: {},
    tribe: "Grove",
    // Basic attacks entangle: ROOT the target (SP→0, can't move) for 2 rounds.
    // Duration 2, not 1: a ROOT applied in Battle with duration 1 is ticked away
    // by the same Cleanup, so it expires before the victim's next Prep and never
    // stops a single move. Every "roots for a round" on a battle-applied source
    // was a no-op — see the same note on Fallow's critStatus.
    passiveNames: { onHitStatus: "Basic attacks entangle" },
    onHitStatus: { kind: "ROOT", duration: 2, power: 0 },
    // Ancient grove: LEAF allies gain +3 max HP while it lives (non-stacking).
    aura: { scope: "element", maxHp: 3 },
    special: {
      name: "Grove's Embrace",
      cost: 4,
      handler: "heal",
      params: { targets: 99, amount: 7, cleanse: 1 },
      targetSide: "ally",
      text: "Heal all allies 7 HP and cleanse their negative statuses.",
    },
  },
  {
    id: "pyro_magmaw",
    name: "Magmaw",
    rarity: "legendary",
    element: "PYRO",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 7,
    dmg: 10,
    hits: 1,
    hp: 17,
    sp: 8,
    shields: 5,
    keywords: {},
    tribe: "Volcanic",
    // Feeds on the slain: each kill grants a permanent +2 DMG.
    passiveNames: { onKill: "Feeds on the slain" },
    onKill: { buffDmg: 2 },
    special: {
      name: "Molten Rampage",
      cost: 4,
      handler: "combo",
      // Up to 4 hits of 4 DMG that stay on one target until it dies, then chain
      // to the next enemy with +3 DMG per kill.
      params: { dmg: 4, hits: 4, killBoost: 3 },
      targetSide: "enemy",
      text: "Strike one opponent up to 4× for 4 DMG; on a kill the rest chain to a new enemy at +3 DMG each.",
    },
  },
  {
    id: "aqua_glacius",
    name: "Glacius",
    rarity: "legendary",
    element: "AQUA",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 8,
    dmg: 4,
    hits: 2,
    hp: 25,
    sp: 11,
    shields: 3,
    keywords: {},
    // Freezer Burn: SCALD any FROZEN enemy for 2 each Cleanup (pairs with the Special).
    roundTick: { scaldFrozen: 2 },
    special: {
      name: "Deep Freeze",
      cost: 4,
      handler: "barrage",
      params: { dmg: 4, targets: 3, statusKind: "FREEZE", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 4 DMG and FREEZE up to 3 opponents for 2 rounds.",
    },
  },
  {
    id: "dawn_aurelion",
    name: "Reveille",
    rarity: "legendary",
    element: "DAWN",
    cardClass: "Support",
    tribe: "Suns",
    attackType: "Ranged",
    cost: 7,
    dmg: 5,
    hits: 1,
    hp: 21,
    sp: 9,
    shields: 5, // 5+21+10+9 = 45, a cost-7 legend budget
    keywords: {},
    // Radiant Ward: each round the whole team gains a barrier that absorbs the
    // next negative status.
    roundTick: { wardAllies: true },
    special: {
      name: "Dawn's Rally",
      cost: 4,
      handler: "heal",
      params: { targets: 99, amount: 3, buffDmg: 2, buffSp: 2, buffRounds: 2 },
      targetSide: "ally",
      text: "Heal all allies 3 HP and grant them +2 DMG and +2 speed for 2 rounds.",
    },
  },
  {
    id: "gale_tempest",
    name: "Tempest",
    rarity: "legendary",
    element: "GALE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 6,
    dmg: 6,
    hits: 1,
    hp: 16,
    sp: 14,
    shields: 2,
    keywords: { EVASION: true },
    // High Speed Impact: +1 DMG per point of SP above 10, to a maximum of +10
    // — double Stormquill's ceiling, on double its cost, for a legendary.
    //
    // The number came off the distribution rather than off the rarity. Played
    // across GALE's whole matchup spread, Tempest's peak SP ran min 16 /
    // median 20 / max 21, so uncapped the passive was already handing it +10
    // to +11: a cap at 10 trims the top half and hard-stops the tail, where 12
    // would never have fired and been a ceiling in name only. Games run longer
    // on 5x5 than the 4x4 sample, and the aura adds a point a round, so this
    // bites harder there — which is the case it exists for.
    //
    // Small sample, stated plainly: a 6-drop reached the board in 10 of 112
    // games. The shape is clear; the exact percentile is not.
    passiveNames: { highSpeedImpact: "High Speed Impact" },
    highSpeedImpact: { cap: 10 },
    special: {
      name: "Cyclone Strike",
      cost: 3,
      handler: "strike",
      // ranged + chargeFirst together, exactly as on Rumbler: Tempest is MELEE, so
      // without reach its "charge up to 3 slots" had nothing to cross — the
      // target was already adjacent and the charge moved zero. The reach is what
      // makes the promised charge exist.
      params: { dmg: 8, charge: 3, pen: 1, chargeFirst: 1 },
      ranged: true,
      targetSide: "enemy",
      text: "Charge up to 3 slots and strike one opponent for 8 DMG (PEN).",
    },
  },
  {
    id: "bolt_stormcaller",
    name: "Stormcaller",
    rarity: "legendary",
    element: "BOLT",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 7,
    dmg: 2,
    hits: 2,
    hp: 25,
    sp: 12,
    shields: 2,
    keywords: {},
    // Complete Circuit: each Cleanup, zap every PARALYZED enemy in range for 2
    // (pairs with the Special; BOLT's Electrify also +1 DMG vs the statused).
    roundTick: { aoeParalyzedDmg: 2 },
    special: {
      name: "Chain Paralysis",
      // Glacius is the same cost, rarity, class, attack type and stat total, pays
      // the same 4 magic, hits the same 3 targets for the same 2 rounds — and
      // deals 4 damage a head on top. This dealt none at all, which made
      // Stormcaller's signature Special strictly worse than its own twin.
      //
      // The fix is the payload, not the price: 4 magic for a 3-target nova is an
      // established template here (Polar Shift, Nightmare), so dropping the cost
      // would have put a cost-7 legendary below every nova in its own rung.
      // 3 damage rather than Glacius's 4, because FREEZE is the stronger status —
      // it zeroes SP outright and halves damage, where PARALYZE only caps a move.
      cost: 4,
      handler: "barrage",
      params: { dmg: 3, targets: 3, statusKind: "PARALYZE", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 3 DMG to up to 3 opponents and PARALYZE them for 2 rounds.",
    },
  },
  {
    id: "dusk_nightfang",
    name: "Nightfang",
    rarity: "legendary",
    element: "DUSK",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 8,
    // 11/25/0sh/11sp = 47 against a cost-8 budget of 50, inside the band. No
    // armour on purpose: it reads as the assassin its class says it is, not the
    // bruiser it once was (7/24/4sh/6sp).
    dmg: 11,
    hits: 1,
    hp: 25,
    sp: 11,
    shields: 0,
    tribe: "Vamp",
    keywords: { LIFESTEAL: true },
    // The Butler (On Summon): it does not arrive as itself. It takes the
    // Butler's face and stat line, and the disguise is only dropped when
    // somebody kills it — at which point Nightfang stands back up at full HP
    // and puts Soul Slash through whoever swung.
    //
    // It rides the transform-revert path Siren's Sea Terror already uses: a card
    // holding `transformedFrom` does not die, it reverts. What the flag adds is
    // the answer to the killer.
    passiveNames: { disguise: "The Butler" },
    disguise: { as: "dusk_butler", strikeKillerOnReveal: true },
    special: {
      name: "Soul Slash",
      cost: 4,
      handler: "drainMax",
      // DELETE, not steal: `deleteOnly` destroys the max HP instead of moving
      // it, so Nightfang gains nothing — the swing lands entirely on the victim
      // and the caster's own HP bar is left alone. Then it slips into STEALTH
      // (selfStatus rider, untargetable until it next attacks).
      params: { amount: 15, deleteOnly: 1, selfStatus: "STEALTH", selfStatusDuration: 1 },
      targetSide: "enemy",
      text: "Delete 15 max HP from an opponent — destroying it outright if it has 15 or less — then slip into STEALTH until you next attack.",
    },
  },
  {
    id: "bore_bastion",
    name: "Bastion",
    rarity: "legendary",
    element: "BORE",
    cardClass: "Tank",
    attackType: "Ranged",
    cost: 8,
    dmg: 5,
    hits: 1,
    hp: 31,
    sp: 2,
    shields: 6,
    keywords: { TRAMPLE: true },
    trampleDmg: 2,
    // Rebuilds its barrier +2 shields each round (on top of BORE's Exostone +2
    // on summon); when the barrier first breaks it enrages (+3 DMG / +2 SP).
    roundTick: { selfShields: 2, selfShieldsMax: 12 },
    // Trample Through: a moving wall. The gate reads effective MAX HP, not
    // shields, so its six plates buy it nothing here — 31 HP does.
    onShieldBreak: { dmg: 3, sp: 2 },
    special: {
      name: "Boulder Barrage",
      cost: 5,
      handler: "barrage",
      params: { dmg: 6, targets: 3, statusKind: "WEAKEN", statusDuration: 2 },
      ranged: true, // lobs rocks anywhere on the board despite being Melee
      targetSide: "enemy",
      text: "Hurl boulders — 6 DMG and WEAKEN (2r) to up to 3 opponents anywhere on the board.",
    },
  },

  // ─────────────── RARE EXPANSION (one per element) ───────────────
  // Verbatim from the canonical element card sheets (post cost-curve rebalance),
  // on previously-orphan art. Each passive maps to a real engine hook.
  {
    id: "bore_ufo",
    name: "UFO",
    rarity: "rare",
    element: "BORE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    // Re-statted to the card sheet: 2/2/5sh/12sp = 2+2+10+12 = 26 vs a Cost-3
    // budget of 25, so it sits +1 and inside the band. The shape changed more
    // than the total: it trades a 6 HP body for a 2 HP one behind 5 shields
    // (7 once Exostone lands), so it is now armour rather than flesh — cheap
    // chip strips a shield a hit and takes seven of them to get through, but
    // anything that PIERCES kills it outright.
    dmg: 2,
    hits: 1,
    hp: 2,
    sp: 12,
    shields: 5,
    // FLYING: it hovers. Melee cannot touch it unless the attacker also flies,
    // and it moves like a chess king in Prep — pure evasiveness, which suits a
    // turret whose job is to sit in range and irradiate.
    keywords: { FLYING: true },
    // Radiation (End of Round): 1 DMG PEN (bypasses shields) to every opponent in
    // range. Halved from 2 — it is untargetable by melee since UFO gained FLYING,
    // ticks EVERY round with no cost or cooldown, and hits everything in range at
    // once, so the per-target number is the only thing holding it down.
    roundTick: { inRangeDmg: 1, inRangeDmgPen: true },
  },
  {
    id: "leaf_sticks",
    name: "Sticks",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 2,
    dmg: 8,
    hits: 1,
    hp: 3,
    sp: 10,
    shields: 0,
    keywords: {},
    tribe: "Grove",
    // Boon Striker (On Summon): strike the NEAREST opponent for 7 and sap its
    // NEXT basic attack by 2 (a flat, statusless debuff). reachNearest lets it
    // pounce a foe anywhere — melee-gated it never fired from the home row.
    onSummon: { handler: "strike", params: { dmg: 7, nextAtkDebuff: 2, reachNearest: 1 }, targetSide: "enemy" },
  },
  // ───── cost-1 wave: one per element (all 15-budget) ─────
  {
    id: "leaf_birch",
    name: "Birch",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 1,
    dmg: 5,
    hits: 1,
    hp: 7,
    sp: 4,
    shields: 0,
    keywords: {},
    tribe: "Grove",
    // Quadruple Strike (On Kill): the kill flows into the nearest survivor —
    // 4x1, four separate hits, so it shreds shields.
    passiveNames: { onKill: "Quadruple Strike" },
    onKill: { nearestVolley: { dmg: 1, hits: 4 } },
  },
  {
    id: "pyro_staph",
    name: "Staph",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 1,
    dmg: 3,
    hits: 1,
    hp: 5,
    sp: 7,
    shields: 0,
    keywords: {},
    tribe: "Goblin",
    // Fire Stick (On Summon): BURN 2 (2 rounds) on the nearest opponent.
    onSummon: { handler: "statusNova", params: { statusKind: "BURN", statusPower: 2, statusDuration: 2, targets: 1, reachNearest: 1 }, targetSide: "enemy" },
  },
  {
    id: "aqua_misty",
    name: "Misty",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 7,
    sp: 6,
    shields: 0,
    keywords: {},
    tribe: "Vapor",
    // Fog Settlement (On Summon): the whole battlefield fogs for 1 round —
    // every enemy basic aimed at your cards whiffs on a MISTY_FOG_MISS_PCT roll.
    // Flat, no status, and nothing has to be landed for it.
    //
    // It was a coin — 50%, board-wide, uncleansable, free on summon, on a
    // cost-1 card. Halving every attack the opponent makes for a round is not
    // a 1-drop's worth of effect at any price, and it is priced at nothing.
    // Aftermath's Smog buys the same mechanic for a cost-4 Special on a cost-6
    // body, which is why the rate lives on the source rather than on the fog
    // (see PlayerState.foggedPct) — the paid one keeps its coin.
    passiveNames: { summonFog: "Fog Settlement" },
    summonFog: 1,
  },
  {
    id: "gale_sirocco",
    name: "Sirocco",
    rarity: "rare",
    element: "GALE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 1,
    dmg: 3,
    hits: 1,
    hp: 10,
    sp: 2,
    shields: 0,
    keywords: {},
    // Windfist (On Hit): blow the target all the way back to its own Home row,
    // as far as open slots allow (pushBack stops at home / an obstacle).
    passiveNames: { onHitPush: "Windfist" },
    onHitPush: 5,
  },
  {
    // 2x2 + 4 + 2 + 7 = 17, +2 over the cost-1 budget (within tolerance).
    id: "bolt_stingray",
    name: "Stingray",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 1,
    dmg: 2,
    hits: 2,
    hp: 4,
    sp: 7,
    shields: 1,
    keywords: {},
    // Piercing Pulse: its basics gain PEN against an ELECTRIFIED foe.
    passiveNames: { vsStatus: "Piercing Pulse" },
    vsStatus: { status: "ELECTRIFIED", pen: true },
  },
  {
    id: "bore_kcor",
    name: "Pebble",
    rarity: "rare",
    element: "BORE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 1,
    dmg: 2,
    hits: 2,
    hp: 2,
    sp: 7,
    shields: 1,
    keywords: {},
    // Rock Slide (On Summon): 5 rocks (1 DMG each) scattered RANDOMLY over the
    // opponents in range, each a coin to land. Ranged, so validTargets already
    // gives the in-range foes — spread picks a random one per rock; no shields.
    onSummon: { handler: "rockslide", params: { dmg: 1, hits: 5, shieldPerMiss: 0, scatter: 1 }, targetSide: "enemy" },
  },
  {
    id: "dusk_harve",
    name: "Harrow",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 2,
    dmg: 4,
    hits: 1,
    hp: 6,
    sp: 10, // cost 1->2, sp 5->10 (4+6+10 = 20, a cost-2 budget)
    shields: 0,
    keywords: {},
    tribe: "Ghost",
    // Dancing Shadow (On Summon): raise a Specter (3/1/SP7).
    passiveNames: { summonSpawn: "Dancing Shadow" },
    summonSpawn: { token: "dusk_specter_tok", count: 1 },
  },
  {
    id: "aqua_icyninza",
    name: "Frostveil",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 2,
    dmg: 4,
    hits: 1,
    hp: 8,
    sp: 8,
    shields: 0,
    // Always CRITs (keyword) — but the keyword only rides BASIC attacks, so the
    // on-summon opener asks for `crit` explicitly or it would land uncritted.
    // Icy Mist (On Summon): open with a 3 DMG CRIT on one opponent in range,
    // then cloak in STEALTH for 1 round, extended +1 for each kill while cloaked.
    // The handler resolves BEFORE the self-status, so it strikes and then vanishes.
    keywords: { CRIT: true },
    passiveNames: { onSummon: "Icy Mist" },
    onSummon: {
      handler: "barrage",
      params: { dmg: 3, targets: 1, crit: 1 },
      targetSide: "enemy",
      selfStatus: "STEALTH",
      selfStatusDuration: 1,
      extendSelfStatusOnKill: 1,
    },
  },
  {
    id: "pyro_ingit",
    name: "Ingit",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 1,
    dmg: 1,
    hits: 1,
    hp: 8,
    sp: 4,
    shields: 2,
    keywords: {},
    // Hot Hot (On Hit by Melee): double the BURN stacked on the attacker.
    passiveNames: { onHitByMelee: "Hot Hot" },
    onHitByMelee: { doubleBurn: true },
  },
  {
    id: "dawn_glime",
    name: "Glimmer",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Warrior",
    tribe: "Suns",
    attackType: "Melee",
    cost: 2,
    dmg: 3,
    hits: 1,
    hp: 10,
    sp: 5,
    shields: 1,
    keywords: {},
    // Shiny Shield (On Summon): +2 barrier; when it first breaks, +1 DMG / +1 SP.
    summonSelfShields: 2,
    onShieldBreak: { dmg: 1, sp: 1 },
  },
  {
    id: "gale_toxhawk",
    name: "Toxhawk",
    rarity: "rare",
    element: "GALE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 2,
    dmg: 3,
    hits: 1,
    // 3+6+13 = 22 vs a cost-2 budget of 20 — 2 over, i.e. inside the +/-2 band.
    // At 8 HP it was 4 over and needed a budget-test exemption; it no longer does.
    hp: 6,
    sp: 13, // SP-heavy flyer, still riding the top of the curve
    shields: 0,
    // Tox: a flyer whose basic attacks leave a generic DOT ticking (GALE owns no
    // named DOT status, so this is element-free).
    tribe: "Avian",
    keywords: { FLYING: true },
    onHitStatus: { kind: "DOT", duration: 2, power: 1 },
  },
  {
    id: "dusk_zombie_husk",
    name: "Zombie Husk",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 8,
    sp: 5,
    shields: 0,
    keywords: {},
    tribe: "Zombie",
    // Reanimation (On Death): the husk no longer gets back up as ITSELF — what
    // rises is a Zombie (3/3/SP4, carrying Contagion). Still exactly one body
    // per death, so the horde is bounded as before, but the thing you now have
    // to kill twice is a different card rather than a decayed copy — and a
    // Zombie bursts when it falls, which a husk never did.
    passiveNames: { onDeath: "Reanimation" },
    onDeath: { dmg: 0, spawnToken: { token: "dusk_zombie_tok", count: 1 } },
  },
  {
    id: "bolt_buzz",
    name: "Buzz",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 3,
    dmg: 3,
    hits: 1,
    hp: 13,
    sp: 7,
    shields: 1,
    keywords: {},
    // Electro Surge: starts armed on summon; while armed it's status-immune, and
    // the first hit it takes discharges — PARALYZE the attacker 3r, then goes
    // inert until re-armed.
    passiveNames: { electroSurge: "Electro Surge" },
    electroSurge: { paralyze: 3, shield: 1, dmgBoost: 5, boostRounds: 2 },
    // Rares carry Talents, not repeatable Specials — but Buzz's whole kit is the
    // surge, so its once-per-game Talent re-arms it (same effect as Surge's).
    talent: {
      name: "Electro Surge",
      handler: "electroSurge",
      params: {},
      text: "Once per game: re-arm Electro Surge — +1 shield and +5 DMG for 2 rounds. While armed: status-immune, and the next hit PARALYZEs the attacker 3 rounds.",
    },
  },

  {
    id: "leaf_fallow",
    name: "Fallow",
    rarity: "legendary",
    element: "LEAF",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 7,
    dmg: 9,
    hits: 1,
    hp: 23,
    sp: 12,
    shields: 1,
    keywords: { CRIT: true },
    // Trapper (End of Round): the snares bite everything they're holding.
    // 1, down from 2. The aura pins the whole side's targets, so this ticks on
    // most of the enemy board at once — the reach is the power, not the number.
    roundTick: { rootedDmg: 1 },
    // Aura, in the real sense: while Fallow is on the board, everything YOUR
    // WHOLE SIDE hits is pinned — then walks into Trapper at end of round. The
    // two passives are one engine, and the team-wide reach is what makes it an
    // engine rather than a solo gimmick.
    //
    // Fires on any landed hit, not on the crit ROLL: that roll needs an
    // unshielded target plus a coin flip, measured 0% against a shielded card,
    // which starved Trapper along with it.
    // duration 2, not 1, and it matters twice. Cleanup ticks statuses down at
    // step 3 but runs Trapper at step 4b, so a 1-round ROOT is already gone when
    // Trapper looks for it — measured: 0 damage. And ROOT blocks MOVEMENT, which
    // happens in Prep, so a ROOT applied during Battle with duration 1 expires
    // before the victim's next Prep and never stops a single move.
    critStatus: { kind: "ROOT", duration: 2, power: 0 },
    special: {
      name: "Hunting Season",
      cost: 4,
      handler: "barrage",
      // alwaysHit: aimed shots. Specials already ignore the caster's BLIND, so
      // this is what carries the "ignores accuracy checks" half — it also
      // pierces EVASION, which nothing else about the volley would.
      params: { dmg: 3, targets: 4, crit: 1, alwaysHit: 1 },
      targetSide: "enemy",
      text: "Deal 3 DMG CRIT to 4 opponents. Auto-hits — ignores BLIND and EVASION.",
    },
  },
  {
    id: "dusk_ravven",
    name: "Ravven",
    rarity: "legendary",
    element: "DUSK",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 6,
    dmg: 4,
    hits: 2,
    hp: 17,
    sp: 11,
    shields: 2,
    keywords: { FLYING: true, EVASION: true },
    tribe: ["Dark", "Avian"],
    // Shadow Haunter: the EVASION keyword above is CONDITIONAL — it only lives
    // while Ravven stands on the opponent's battlefield. On its own ground it
    // dodges nothing. Read via hasEvasion(), never keywords.EVASION.
    evasionEnemySideOnly: true,
    special: {
      name: "Night Stalk",
      cost: 3,
      handler: "empower",
      // buffRounds makes it temporary — +3 DMG that expires, not a permanent ramp.
      params: { selfDmg: 3, buffRounds: 3 },
      targetSide: "self",
      text: "Gain +3 DMG for 3 rounds.",
    },
  },

  {
    id: "leaf_sprinu",
    name: "Vernal",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 4,
    dmg: 6,
    hits: 1,
    hp: 16,
    sp: 8,
    shields: 0,
    keywords: {},
    // Morning Dew, both halves: the dew each round, and a basic attack that can
    // be aimed at a hurt friend to heal for its DMG instead of striking.
    roundTick: { roundHealElement: { element: "LEAF", amount: 1 } },
    basicHealsAllies: true,
    special: {
      name: "Root Spring",
      cost: 2,
      handler: "barrage",
      // One burst: snares the enemy and waters its own side.
      // statusDuration 2, same reason as Fallow: a Special resolves in Battle,
      // Prep already happened, and a 1-round ROOT expires at that same Cleanup —
      // so it would never stop a single move. 2 costs the victim one Prep.
      // 2×1, down from 3×2. Measured at 12 damage per magic across a 4-card
      // board — double the next LEAF special and 4× the cost-9 mythic, on a
      // cost-3 SUPPORT that also roots the board and heals the team. The reach
      // and the ROOT are the identity; the damage was the outlier, so only the
      // damage was cut. Now 8 for 2 magic (4.0/magic).
      params: {
        dmg: 2, hits: 1, targets: 8,
        statusKind: "ROOT", statusDuration: 2,
        healAlliesElement: "LEAF", healAllies: 4,
      },
      targetSide: "enemy",
      text: "Deal 2 DMG and ROOT for 2 rounds, then heal LEAF allies 4 HP.",
    },
  },
  {
    id: "dusk_wedded_wraith",
    name: "Wedded Wraith",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 5,
    dmg: 4,
    hits: 2,
    hp: 12,
    sp: 11,
    shields: 1,
    keywords: {},
    tribe: "Ghost",
    // Harvester: every kill raises another Specter.
    passiveNames: { onDeath: "Last Waltz", onKill: "Harvester" },
    onKill: { spawnToken: { token: "dusk_specter_tok", count: 1 } },
    // Last Waltz: the ballroom dances on. Fires on ANY death, not just a kill.
    onDeath: {
      dmg: 0,
      allyTribeBuffDmg: { tribe: "Ghost", dmg: 2 },
      // 2, for the same off-by-one Brood Summon had. FRIGHTEN retreats a card
      // on application and stops it MOVING in Prep; a death resolves in BATTLE
      // and Cleanup ticks straight after, so at 1 the status expired before the
      // Prep it was meant to freeze — everyone stepped back and then moved
      // freely anyway. 2 is one round of fear as the player experiences it.
      frightenInRange: 2,
    },
    special: {
      name: "Shadow Summon",
      cost: 3,
      cooldown: 3, // three bodies a cast is board presence — 3-round lockout
      handler: "spawn",
      params: { token: "dusk_specter_tok", count: 3 },
      targetSide: "self",
      text: "Spawn 3 Specters (3 DMG / 1 HP / SP 7). 3-round cooldown.",
    },
  },
  {
    id: "pyro_sseerr",
    name: "Emberclaw",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 5,
    dmg: 4,
    hits: 2,
    hp: 12,
    sp: 11,
    shields: 2,
    keywords: { EVASION: true },
    tribe: "Dragon",
    // Dragon's Fury (tribe trait): every kill is +1 DMG, permanently.
    passiveNames: { onKill: "Dragon's Fury" },
    onKill: { buffDmg: 1 },
    // Dragon's Blade: it grows into the fight — +1 DMG and +1 SP every 2nd round,
    // stacking with no ceiling.
    roundTick: { buffDmgEveryN: { n: 2, amount: 1, sp: 1, maxTicks: 5 } },
    // Arrives breathing fire across the whole row directly ahead. spread is the
    // column reach to EACH side, so on a 4-wide board 3 is what actually covers
    // the full row from any column — spread 1 would leave the far edge standing.
    onSummon: {
      handler: "barrage",
      params: { dmg: 3, targets: 8, spread: 3, forwardDepth: 1 },
    },
    special: {
      name: "Flaming Slasher",
      cost: 2,
      // A sweep now, not a loaded blade: one swing across everything in reach
      // rather than two charges spent one target at a time.
      handler: "barrage",
      params: { dmg: 4, targets: 99, statusKind: "BURN", statusPower: 4, statusDuration: 2 },
      targetSide: "enemy",
      text: "Slash every opponent in range for 4 DMG and BURN 4 for 2 rounds.",
    },
  },
  {
    id: "bore_monger",
    name: "Monger",
    rarity: "epic",
    element: "BORE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 4,
    dmg: 5,
    hits: 1,
    hp: 21,
    sp: 3,
    shields: 1,
    keywords: {},
    // Pride Guardian: the first hit any teammate takes, Monger throws it a slab.
    passiveNames: { onAllyHitShield: "Pride Guardian" },
    onAllyHitShield: 2,
    special: {
      name: "Rock Slide",
      cost: 2,
      handler: "rockslide",
      // Five boulders, each a coin flip. Every miss becomes 2 shields instead of
      // nothing, so a cold streak arms the tank rather than wasting the cast.
      params: { dmg: 4, hits: 5, shieldPerMiss: 2 },
      targetSide: "enemy",
      text: "Throw 5 boulders for 4 DMG each — 50% to hit. Every miss becomes +2 shields.",
    },
  },
  {
    id: "aqua_kinguin",
    name: "Kinguin",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 2,
    dmg: 3,
    hits: 1,
    hp: 8,
    sp: 4,
    shields: 2,
    keywords: {},
    // King's Guard: it never lands alone. adjacentOnly keeps the guard AT its
    // side — a scattered escort would defeat the point.
    summonSpawn: { token: "aqua_guin_tok", count: 2, adjacentOnly: true },
  },
  {
    id: "dawn_goldeneagle",
    name: "GoldenEagle",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Ranger",
    tribe: "Stars",
    attackType: "Ranged",
    cost: 3,
    dmg: 1,
    hits: 5,
    hp: 6,
    sp: 12,
    shields: 1,
    keywords: { FLYING: true },
    // Soaring Sun: it climbs. +1 DMG every third round, stacking, forever.
    roundTick: { buffDmgEveryN: { n: 3, amount: 1, maxTicks: 5 } },
    talent: {
      name: "Shimmering Featherrows",
      handler: "barrage",
      // Volley first, then vanish — stealthRounds cloaks the caster afterwards.
      params: { dmg: 3, targets: 3, stealthRounds: 2 },
      text: "Deal 3 DMG to 3 opponents, then gain STEALTH for 2 rounds.",
    },
  },
  {
    id: "gale_windsor",
    name: "Windsor",
    rarity: "rare",
    element: "GALE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 3,
    dmg: 3,
    hits: 1,
    hp: 13,
    sp: 9,
    shields: 0,
    keywords: {},
    // Right Through Me: hit it and the wind goes straight through you —
    // anyAttacker, so shooters get WEAKENed at range too.
    passiveNames: { onHitByMelee: "Right Through Me" },
    onHitByMelee: { anyAttacker: true, status: { kind: "WEAKEN", duration: 2, power: 0 } },
  },
  {
    id: "bolt_jolt",
    name: "Jolt",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 2,
    dmg: 2,
    hits: 1,
    hp: 8,
    sp: 3,
    shields: 3,
    keywords: {},
    // Electrifying, both halves. The ZONE is the threat: at the end of every
    // round the current arcs into everything Jolt can reach. The ON-HIT mark is
    // the backstop — it answers RANGED attackers, who shoot Jolt from outside
    // its reach and would otherwise never be marked at all. Together there is no
    // safe way to engage it: close in and the zone takes you, shoot it and the
    // counterpunch does. ELECTRIFIED does nothing by itself; its whole job is to
    // BE a status, so BOLT's Electrify aura (+1 DMG vs a statused target) turns
    // either mark into damage for the entire BOLT side.
    roundTick: { inRangeStatus: { kind: "ELECTRIFIED", duration: 2, power: 0 } },
    onHitByMelee: { anyAttacker: true, status: { kind: "ELECTRIFIED", duration: 2, power: 0 } },
  },

  // ── Rarity fill-in ─────────────────────────────────────────────────────────
  // One card per element, each dropped into that element's thinnest rarity, to
  // even out a spread that had run from 4 to 8 epics and 5 to 10 rares. Stats
  // hold the house budget: dmg×hits + hp + 2×shields + sp = 5×cost + 10.
  {
    id: "pyro_ash_boar",
    name: "Ash Boar",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    dmg: 7,
    hits: 1,
    hp: 10,
    sp: 8,
    shields: 0,
    keywords: {},
    // Charging Tusks (On Summon): it arrives mid-charge — everything in reach
    // takes 4, then it keeps going one more slot into enemy ground. `targets: 8`
    // is "all of them"; a board only ever holds 8 enemies.
    // NO chargeFirst, unlike the other chargers: this is an ON-SUMMON, so there
    // is nothing to roll in from, and the boar is meant to trample THROUGH.
    onSummon: {
      handler: "barrage",
      params: { dmg: 4, targets: 8, rollThrough: 1 },
    },
  },
  {
    id: "bore_obsidi",
    name: "Obsidian",
    tribe: "Cavernous",
    rarity: "epic",
    element: "BORE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 5,
    dmg: 4,
    hits: 2,
    hp: 12,
    sp: 8,
    shields: 3,
    keywords: { BLOCK: 1 },
    // Obsidian Claws: it tunnels. Out of sight it covers ground it never could
    // above, so STEALTH replaces its printed SP with 11.
    spWhileStealthed: 11,
    special: {
      name: "Dirt Driller",
      cost: 3,
      handler: "burrow",
      // Two-stage: STEALTH now (up to 2 rounds), and the 6×2 comes up out of the
      // ground on the next basic attack — which is also what breaks cover.
      params: { dmg: 6, hits: 2, stealthRounds: 2 },
      targetSide: "self",
      text: "Gain STEALTH for up to 2 rounds. Your next attack erupts for 6×2 DMG.",
    },
  },
  {
    id: "aqua_piranha",
    name: "Piranha",
    tribe: "SeaC", // Kraken's school (+4 max HP)
    rarity: "rare",
    element: "AQUA",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 1,
    dmg: 2, // 2x2 — a shoal that bites twice (4+3+8 = 15, on a cost-1 budget)
    hits: 2,
    hp: 3,
    sp: 8,
    shields: 0,
    keywords: {},
    // Chomp (On Summon): the shoal hits the water biting — two 1-DMG bites into
    // everything in reach, each leaving BLEED 2 for 2 rounds.
    onSummon: {
      handler: "barrage",
      params: { dmg: 1, hits: 2, targets: 8, statusKind: "BLEED", statusDuration: 2, statusPower: 2 },
    },
  },
  {
    id: "gale_tumbleweed",
    name: "Tumbleweed",
    rarity: "rare",
    element: "GALE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 2,
    dmg: 4,
    hits: 1,
    hp: 9,
    sp: 7,
    shields: 0,
    // Nothing lands cleanly on something that never stops rolling.
    keywords: { EVASION: true },
    // Rares carry Talents, not repeatable Specials: free, but once per game.
    talent: {
      name: "Roll Through",
      handler: "strike",
      // TWO spaces, not one. `rollThrough` is a MINIMUM step count, so this
      // clears the slot in front rather than settling into it, and keeps going
      // if that landing is occupied.
      params: { dmg: 5, rollThrough: 2 },
      // Hits, THEN rolls THROUGH — past the struck body toward the enemy home.
      // Plain charge stalled on the target it just hit, which made a talent
      // named Roll Through do nothing in the common case.
      //
      // AND IT ROLLS WITH NOTHING TO HIT. The `strike` handler used to return
      // the moment it had no target, so a Tumbleweed with an empty board ahead
      // of it burned its once-per-game Talent standing still — the case where
      // rolling is the only thing you wanted from it.
      text: "Once per game: deal 5 DMG, then roll two spaces toward the enemy home — and roll even with nothing to hit.",
    },
  },
  {
    id: "bolt_jellyfish",
    name: "Jellyfish",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 15,
    sp: 5,
    shields: 0,
    keywords: {},
    // Jelly Shock: touch it and the whole cluster lights up — 2 DMG to whoever
    // struck it (range is no protection) and to every enemy standing beside it.
    passiveNames: { onHitZap: "Jelly Shock" },
    onHitZap: { dmg: 2 },
    // Storm Conduit is a TALENT, not a Special: once per game, free, no cooldown.
    talent: {
      name: "Storm Conduit",
      handler: "strike",
      params: { dmg: 6, statusKind: "PARALYZE", statusDuration: 3, statusPower: 0 },
      text: "Deal 6 DMG and PARALYZE the target for 3 rounds.",
    },
  },
  {
    id: "dawn_shine",
    name: "Shine",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Mage",
    tribe: "Stars",
    attackType: "Ranged",
    cost: 2,
    dmg: 1,
    hits: 3,
    hp: 11,
    sp: 6,
    shields: 0,
    keywords: {},
    // Brightling Ball: it doesn't defend allies, it avenges them. The first time
    // any ally falls, the killer eats 4 and fights blind for 3 rounds. Once per
    // game — a single answer, saved for whoever takes the first one.
    passiveNames: { onAllyKilled: "Brightling Ball" },
    onAllyKilled: { dmg: 4, status: { kind: "BLIND", duration: 3, power: 0 }, oneUse: true },
  },

  // ── Promoted from tokens ───────────────────────────────────────────────────
  // Reptilian and Heir are still SPAWNED (Trinezer's Screech, Imperator's Strike
  // of Dawn) — moving them into CARDS only additionally makes them draftable.
  // getDef resolves them the same either way, since CARD_INDEX merges both lists.
  // Both sit under the stat curve on purpose: they are ability-carried, and they
  // are listed in the cost-formula test's exceptions for that reason.
  {
    id: "dawn_heir_tok",
    art: "dawn_heir",
    name: "Heir",
    rarity: "legendary",
    element: "DAWN",
    cardClass: "Assassin",
    tribe: "Stars",
    attackType: "Melee",
    cost: 6,
    dmg: 10,
    hits: 1,
    hp: 10,
    sp: 10,
    shields: 2,
    keywords: {},
    // Royal Guard: gain +1 shield each round.
    roundTick: { selfShields: 1, selfShieldsMax: 5 },
    // King Me (On Kill): each kill shaves 1 off Crowned's cost.
    passiveNames: { onKill: "King Me" },
    onKill: { reduceSpecialCost: 1 },
    special: {
      name: "Crowned",
      cost: 3,
      // The only PERMANENT stat grant in the game, and King Me drives its cost
      // toward zero, so the default 1-round gap let it be cast almost every
      // other round and compound without limit. 3 matches every other
      // game-warping Special.
      cooldown: 3,
      handler: "empower",
      // …and a lifetime limit, which the cooldown alone never gave it. A long
      // game reaches a third cast, a fourth, a fifth; the grant is permanent and
      // nothing took it back. maxStacks is the brake rules.ts already enforces
      // (Oakgre uses it for the same reason), and it works here where a `max`
      // on the card would not: `empower` writes dmgBonus raw and never passes
      // through cappedSelfGrowth.
      params: { selfDmg: 5, selfMaxHp: 5, selfSp: 5, maxStacks: 3 },
      targetSide: "self",
      text: "Gain +5 DMG, +5 HP, +5 SP permanently. 3-round cooldown, three times in all.",
    },
  },
  // ── Wave 1 of the eight new element cards ──────────────────────────────────
  {
    id: "bore_rohojohn",
    name: "Crystal Sabor",
    rarity: "epic",
    element: "BORE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 5,
    // 31 vs the formula's 35 — deliberately under-statted, and listed in
    // state.test.ts's exceptions. War Mount pays the difference: +3 shield on
    // arrival plus a permanent +4 on every basic landed from melee range.
    // Was +5 / +6 — measured the top damage carry in BORE by 40% (9.1/game vs
    // the field's 6.5) on a body that also tanks and king-moves, so both riders
    // came down.
    dmg: 7,
    hits: 1,
    hp: 12,
    sp: 12,
    shields: 0,
    keywords: {},
    mounted: true, // War Mount — a king-move in Prep
    passiveNames: { summonSelfShields: "War Mount", meleeBonusDmg: "War Mount" },
    summonSelfShields: 3, // rides in armoured...
    meleeBonusDmg: 4, // ...and the mount mauls whatever it stands beside.
    // Sabor Pounce — named for the card since the card was renamed; a Cougar
    // pounce on something called Crystal Sabor was the old name outliving it.
    //
    // BLEED IS THE PRIMARY AND STUN THE RIDER, which is backwards from how it
    // reads but right for the engine: `strike` passes the primary through
    // `maybeStatus` (which carries `statusPower`) and the `debuffStatus` rider
    // through `applyStatus` with the power hardcoded to 0. BLEED needs its 3;
    // STUN is a binary pin and wants no magnitude, so it is the one that can
    // afford the rider slot.
    special: {
      name: "Sabor Pounce",
      cost: 3,
      handler: "strike",
      params: {
        dmg: 10,
        statusKind: "BLEED", statusPower: 3, statusDuration: 2,
        debuffStatus: "STUN", debuffStatusRounds: 2,
      },
      targetSide: "enemy",
      text: "Deal 10 DMG to an opponent in range, STUN them for 2 rounds and BLEED 3 for 2 rounds.",
    },
  },
  {
    id: "bolt_shoksa",
    name: "Dynamo",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 4,
    dmg: 6,
    hits: 1,
    hp: 12,
    sp: 12,
    shields: 0,
    tribe: "ARC",
    keywords: {},
    // Discharges into whatever it marked. The literal ELECTRIFIED status, so it
    // combos with its OWN Special rather than with any stray DOT on the board.
    passiveNames: { aoeElectrifiedDmg: "Static Discharge" },
    roundTick: { aoeElectrifiedDmg: 2 },
    // "On Summon: use Special" needs no new mechanic — the same handler and
    // params, wired to the summon trigger.
    onSummon: {
      handler: "overload",
      params: { paralyzeExtend: 1, markRounds: 1 },
      targetSide: "enemy",
    },
    special: {
      name: "Static Pressure Overload",
      cost: 2,
      handler: "overload",
      params: { paralyzeExtend: 1, markRounds: 1 },
      targetSide: "enemy",
      text: "PARALYZE lasts 1 round longer on every already-PARALYZED opponent; everyone else is marked ELECTRIFIED for the round.",
    },
  },
  {
    id: "leaf_lumberjack",
    name: "Lumberjack",
    rarity: "epic", // it has a Special, and Specials are epic-and-up
    element: "LEAF",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 4,
    dmg: 6,
    hits: 1,
    hp: 18,
    sp: 6,
    shields: 0,
    keywords: {},
    special: {
      name: "Timberer",
      cost: 2,
      handler: "barrage",
      // The tree falls DOWN ITS OWN COLUMN: spread 0 = a single lane,
      // forwardDepth 3 = the three slots ahead of it, which on a 4x4 carries all
      // the way into the enemy summoning row. A forwardDepth corridor
      // deliberately projects past melee reach and the Home-Slot rule, so a
      // Lumberjack standing on its own home row can still fell into theirs.
      // The whole trunk pins whatever it lands across, not just the nearest
      // body: firstOnlyStatus (which limited the ROOT to the first target) is
      // gone, so every opponent in the corridor is rooted.
      params: {
        dmg: 6, pen: 1, targets: 99, forwardDepth: 3, spread: 0, // dmg 4 -> 6
        statusKind: "ROOT", statusDuration: 2,
        selfShields: 3, selfShieldsMax: 9,
      },
      targetSide: "enemy",
      text: "Fell a tree straight down your own column: 6 DMG (PEN) to every opponent in the 3 slots ahead, reaching into their summoning row. ROOT them all for 2 rounds and gain 3 shield.",
    },
  },
  {
    id: "aqua_bootlegger",
    name: "Bootlegger",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 2,
    dmg: 4,
    hits: 1,
    hp: 10,
    // A fast runner that gets there first and hurts on the crossing.
    sp: 7,
    shields: 0,
    keywords: {},
    tribe: "Pirate",
    // Fires on the CROSSING onto enemy ground, not on every step taken once it
    // is already there. 1 -> 3 DMG, so the invasion actually hurts.
    // Running Profits (On Kill): +2 HP, permanently (max and current).
    passiveNames: { onEnterEnemySide: "Stomp", onKill: "Running Profits" },
    onEnterEnemySide: { dmg: 3 },
    onKill: { buffMaxHp: 2 },
  },
  // ── Wave 2 ────────────────────────────────────────────────────────────────
  {
    id: "gale_wista",
    name: "Zephyra",
    rarity: "epic",
    element: "GALE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 5,
    dmg: 4,
    hits: 2,
    hp: 15,
    sp: 10,
    shields: 1,
    keywords: { FLYING: true },
    tribe: "Avian",
    passiveNames: { onHitPush: "Wind Wake" },
    onHitPush: 1, // every landed hit shoves the victim a slot back
    special: {
      name: "Blue Wind Spiral",
      cost: 3,
      handler: "spiral",
      // Each landing is a real hit, so Wind Wake fires on every bounce.
      params: { dmg: 4, bounces: 3 },
      targetSide: "enemy",
      text: "Deal 4 DMG that ricochets between opponents standing within 1 space of each other (up to 4 landings). Wind Wake shoves each one hit.",
    },
  },
  {
    id: "dawn_warphant",
    name: "WarPhant",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Tank",
    tribe: "Suns",
    attackType: "Melee",
    cost: 5,
    dmg: 5,
    hits: 1,
    hp: 29,
    sp: 1,
    shields: 0,
    keywords: { TRAMPLE: true },
    trampleDmg: 2,
    passiveNames: {
      summonSelfShields: "War Ready",
      onEnterMidRow: "War Ready",
      onDeath: "Last Rider",
    },
    mounted: true, // an armoured elephant IS the mount — king-move in Prep
    // Trample Through: in PREP it may step onto an adjacent enemy with less
    // effective max HP, shoving it one slot further along the same line and
    // taking the square. Needs the slot beyond the victim open — nothing gets
    // crushed against a wall or another body.
    summonSelfShields: 4, // the Hardened Gold Armor it rides in with
    onEnterMidRow: { shields: 2 }, // ...and it plates up on reaching the middle
    onDeath: { dmg: 0, spawnToken: { token: "dawn_warrider_tok", count: 1 } },
    special: {
      name: "Battle Charge",
      cost: 3,
      handler: "battleCharge",
      // Two tiers down the lane instead of a flat 10 to everyone ahead: the
      // FIRST opponent takes 10 and is shoved back, and anything packed
      // contiguously behind it takes 7. The chain stops at the first gap, so
      // the charge shunts a stack rather than raking the whole column.
      params: { dmg: 10, chainDmg: 7, push: 1, charge: 4 },
      // ranged: the same defect Rumbler and Tempest had. WarPhant is MELEE, so
      // without this the "charge up to 4 spaces forward" could only be cast at
      // something already touching it — there was never a lane to charge down.
      // The handler picks its own victims from the column, so the target choice
      // only has to make the cast legal.
      ranged: true,
      targetSide: "enemy",
      text: "Charge up to 4 spaces forward: 10 DMG to the first opponent in your column and shove it back, plus 7 DMG to any opponents touching behind it.",
    },
  },
  {
    id: "dusk_rip",
    name: "RIP",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 5,
    // 0 DMG on purpose: RIP never swings. basicIsInert already skips the attack
    // prompt for a 0-damage card, and its Special is free, so it always has a
    // meaningful action.
    dmg: 0,
    hits: 1,
    hp: 33,
    sp: 0,
    shields: 0,
    keywords: {},
    tribe: "Zombie",
    summonSpawn: { token: "dusk_zombie_husk", count: 1, spawnRadius: 2 },
    // One body a round, paid in its own HP, and only ever within 2 spaces of the
    // grave it crawled out of. The clock jams at 4 standing husks: unleashed it
    // simply ate the board (14 husks / 42 DMG a round by round 10). Every 4
    // raised, Horde fires free and the tally resets.
    passiveNames: {
      roundTick: "Dead Clock", selfHpCost: "Dead Clock",
      spawnTriggerAt: "Dead Clock", spawnMaxAlive: "Dead Clock",
    },
    roundTick: {
      spawn: { token: "dusk_zombie_husk", count: 1, spawnRadius: 2 },
      selfHpCost: 3,
      spawnTriggerAt: 4,
      spawnMaxAlive: 4,
    },
    special: {
      name: "Horde",
      cost: 0,
      handler: "spawn",
      // selfHpCost is charged on the MANUAL cast only — the Dead Clock's
      // auto-fire calls the handler directly and pays nothing.
      // selfHpLethal: RIP may spend its LAST 6 HP here. The husks are raised
      // before it falls, so going out to leave two more bodies is a real play.
      params: { token: "dusk_zombie_husk", count: 2, radius: 2, selfHpCost: 6, selfHpLethal: 1 },
      targetSide: "self",
      text: "Tear off 6 HP to spawn 2 Zombie Husks within 2 spaces — RIP may spend its last. Fires FREE on its own whenever the Dead Clock has raised 4.",
    },
  },
  {
    id: "pyro_scorch",
    name: "Scorch",
    rarity: "epic", // it has a Special, and Specials are epic-and-up
    element: "PYRO",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 4,
    dmg: 4,
    hits: 1,
    hp: 12,
    sp: 8,
    shields: 3,
    // FLYING. Same jump as SkullDrake's and for the same reason — a Ranged
    // Support that melee cannot reach — but Scorch pays for it with the softest
    // body of the three (12 HP behind 3 shields), so a grounding status or
    // anything that flies still finishes it quickly.
    keywords: { FLYING: true },
    // The ground stays lit while Scorch stands, so anything that walks or is
    // summoned onto the enemy home row catches. The BURN itself now runs out
    // after 3 rounds rather than never — leave the row (or kill Scorch) and it
    // burns down instead of lasting the match.
    passiveNames: { roundTick: "Wildfire", onSummon: "Wildfire" },
    roundTick: { enemyHomeRowStatus: { kind: "BURN", duration: 3, power: 1 } },
    onSummon: {
      handler: "barrage",
      // The enemy home row, set alight the moment it arrives.
      params: { dmg: 0, targets: 99, statusKind: "BURN", statusDuration: 3, statusPower: 1, enemyHomeRow: 1 },
      targetSide: "enemy",
    },
    special: {
      name: "Accelerator",
      cost: 3,
      handler: "accelerate",
      // The speed is PERMANENT now and three points of it; the double-BURN
      // window stays the 2-round burst it always was.
      params: { rounds: 2, allySp: 3, permanentSp: 1 },
      targetSide: "self",
      text: "PYRO allies gain +3 SP permanently. For 2 rounds, every BURN on an opponent also deals double.",
    },
  },

  // ── Balance pass: one new card per element (from the conversion doc) ──────────
  {
    id: "leaf_gecko",
    name: "Gecko",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 3,
    dmg: 7,
    hits: 1,
    hp: 10,
    sp: 9,
    shields: 0,
    keywords: {},
    tribe: "Reptile",
    // Venomous Bite: basics apply a light BLEED — a feeder for Thorn's
    // heal-off-BLEED payoff, and a third Reptile body for Trinezer's tribe aura.
    passiveNames: { onHitStatus: "Venomous Bite" },
    onHitStatus: { kind: "BLEED", duration: 2, power: 1 },
    // Tail Drop: the first lethal hit leaves Gecko at 1 HP with STEALTH 1r, then
    // REGEN 2 for 2 rounds as the tail regrows. Once per game.
    deathSave: { stealth: 1, regen: { power: 2, rounds: 2 } },
  },
  {
    id: "pyro_slag_tortoise",
    name: "Slag Tortoise",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 3,
    dmg: 2,
    hits: 1,
    hp: 15,
    // 0 -> 1. One step a round: enough to be walked into a lane over a couple of
    // turns, not enough to chase anything. Puts it at 26 against a 25 budget —
    // inside the +/-2 tolerance — and level with Granite Armadillo and Coral
    // Golem, its exact peers at cost 3 behind 4 shields.
    sp: 1,
    shields: 4,
    // Molten Shell: −1 DMG from every incoming hit (flat, pre-shield, even PEN)
    // — that's exactly BLOCK. PYRO's first proper wall to hold a lane.
    keywords: { BLOCK: 1 },
    // Slag Field: the heat comes off it whether it acts or not — 1 DMG at the
    // end of every round to each opponent it can reach.
    //
    // The card's problem was that it did nothing. It was the only Melee card in
    // the game printing SP 0 with no kit at all: it could never move, so its
    // 2 DMG only ever landed on something that volunteered to stand beside it,
    // and 25 of its stat points did nothing. Every other rooted card has a
    // reason to be rooted (Oakgre's aura, RIP's spawner, Oak's Talent,
    // Dandelion's charge, Doom's timer); this is the Tortoise's. Paired with
    // the single point of SP above, it can now be walked into a lane AND make
    // that lane cost something to stand in — it never has to reach you.
    //
    // `inRangeDmg` is reach-relative, so the same field that gives Smog the
    // whole enemy board (Ranged) gives the Tortoise the eight squares around it.
    // A passive rather than a stat bump because the card already sits exactly on
    // its cost-3 budget (2 + 15 + 4x2 = 25), and kit is the part that's free.
    passiveNames: { roundTick: "Slag Field" },
    roundTick: { inRangeDmg: 1 },
  },
  {
    id: "aqua_anglerfish",
    name: "Anglerfish",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 1,
    dmg: 3,
    hits: 1,
    hp: 6,
    sp: 5,
    shields: 0,
    keywords: {},
    // Kraken's school — the SeaC aura grants its members +4 max HP.
    tribe: "SeaC",
    // Lure (On Summon): 2 DMG to the closest opponent. The name still fits —
    // an anglerfish draws prey in and then bites it — but the ability is now
    // the bite rather than the dangle.
    //
    // `reachNearest` scans the WHOLE board and sorts by distance, so this does
    // not depend on Anglerfish being able to reach anything from the home row
    // it lands in. A range-gated on-summon on a cost-1 body would have fired
    // almost never (see Saltjacks).
    //
    // NOTE this leaves `lure` unused by any card in the set. The mechanic is
    // still fully wired — types, state, combat and card text — so it costs
    // nothing to keep and is there for the next card that wants it.
    passiveNames: { onSummon: "Lure" },
    onSummon: { handler: "strike", params: { dmg: 2, reachNearest: 1 }, targetSide: "enemy" },
  },
  {
    id: "gale_stormhide_bison",
    name: "Stormhide Bison",
    rarity: "rare",
    element: "GALE",
    cardClass: "Tank",
    attackType: "Melee",
    // Cost 3 -> 2 with the armour stripped: a cheap wall of hide and stubbornness
    // rather than plate. Budget 19 against a target of 20, one under, so the
    // cheaper slot is paid for by the 6 points the shields were worth.
    cost: 2,
    dmg: 2,
    hits: 1,
    hp: 16,
    sp: 1,
    shields: 0,
    // Braced Stance: −1 DMG from every incoming attack (BLOCK) and immune to
    // knockback/pull — it plants and lets GALE's storms wash over it.
    keywords: { BLOCK: 1, TRAMPLE: true },
    trampleDmg: 1,
    passiveNames: { pushImmune: "Braced Stance" },
    pushImmune: true,
    // Trample Through: it moves things, and nothing moves it. A Bison mirror is
    // a stalemate on purpose — Braced Stance now blocks a trample the same way
    // it blocks every other push.
  },
  {
    id: "bolt_junker",
    name: "Junker",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 11,
    sp: 1,
    shields: 1,
    keywords: {},
    // Stop Sign: swing at it in melee and the scavenged scrap-shield bites back.
    passiveNames: { onHitByMelee: "Stop Sign" },
    onHitByMelee: { dmg: 2 },
  },
  {
    id: "bore_old_timer",
    name: "Old Timer",
    rarity: "rare",
    element: "BORE",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 2,
    dmg: 4,
    hits: 2,
    hp: 7,
    sp: 3,
    shields: 1,
    // Rocking Chair: patches itself up each round from that porch rocker (REGEN).
    // (Doc's self-cleanse omitted — kept as the plain heal it reads as.)
    keywords: { REGEN: 2 },
    // He is not going anywhere, and that is the joke and the mechanic. REGEN 2
    // on a body nothing can shove is a rock that quietly refills — and at SP 3
    // being immovable is worth more than being fast.
    passiveNames: { pushImmune: "Set In His Ways" },
    pushImmune: true,
  },
  {
    id: "dusk_soul_wisp",
    name: "Soul Wisp",
    tribe: "Ghost", // Wedded Wraith's Last Waltz
    rarity: "rare",
    element: "DUSK",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    dmg: 2,
    hits: 1,
    hp: 10,
    sp: 13,
    shields: 0,
    keywords: {},
    // Wandering Light: a soul-fire wisp mending the fallen — the sustain DUSK
    // wants most on the big board. Heals the DUSK side +2 at end of round and can
    // aim its basic at a hurt ally.
    passiveNames: { roundTick: "Wandering Light" },
    roundTick: { roundHealElement: { element: "DUSK", amount: 2 } },
    basicHealsAllies: true,
  },
  {
    id: "dawn_roy",
    name: "Outrider",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Warrior",
    tribe: "Suns",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hp: 8,
    hits: 1,
    sp: 3,
    shields: 1,
    keywords: {},
    // Frontline Scout: plates up (+2 shields) the moment it pushes into the mid.
    // Shrunk to a Cost-1 filler on purpose: at Cost 2 it displaced DAWN's stronger
    // bodies in the AI's summon order and dragged the already-top DAWN core down
    // ~16 points in testing. As a cheap footnote it measures balance-neutral.
    passiveNames: { onEnterMidRow: "Frontline Scout" },
    onEnterMidRow: { shields: 2 },
  },

  // ── Class-per-cost grid, COST 1 (batch 1: cells with a doc card + staged art
  //    and no new engine code). Fills LEAF c1 Tank/Assassin, PYRO c1 Assassin,
  //    GALE c1 Ranger/Support. Remaining c1 gaps need art or a new mechanic. ──
  {
    id: "leaf_stickers",
    name: "Stickers",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 1,
    // 2*3 + 1 + 8 = 15 = 5*1+10, exactly, down from 2*4 + 3 + 5 = 16. A jab and
    // two points of body are sold for three points of speed, and EVASION is
    // bought with nothing at all — keywords sit outside the budget.
    //
    // That is the whole card now: it cannot be hit reliably, and it dies the
    // moment it is. EVASION is ~50% a hit, so 1 HP is not the liability it
    // reads as — but it IS one hit, so nothing here is a mistake to be
    // forgiven. SP 5 -> 8 also crosses a real line: SP_SLOW_MAX is 5, so this
    // goes from a one-step body to a two-step one, which is what lets a
    // one-hit-point Assassin pick its fight instead of taking whichever one
    // walks up to it. (The same line makes it feel PARALYZE, which caps reach
    // at 1 and did nothing to it before.)
    dmg: 2,
    hits: 3,
    hp: 1,
    sp: 8,
    shields: 0,
    keywords: { EVASION: true },
    // Sticky: the little jabs BUILD one wound rather than overwriting it —
    // BLEED stacks, to 4, for 2 rounds. It used to apply BLEED 1 for 1 round per
    // hit, which (since a status REPLACES a same-kind one) meant the jabs left
    // exactly 1 damage of bleed total. Stickers measured 0.1 DMG a game and a
    // 22% win rate, the worst card in the set, on a card whose own comment
    // called it a BLEED feeder.
    //
    // THREE jabs against a cap of 4, so one attack no longer caps the wound on
    // its own: it lands 3 and the fourth comes next round. Deliberate rather
    // than an oversight of the re-cut — the cap is what Sticky is worth, and
    // making Stickers survive a round to collect it is the fee for a body that
    // dodges half of what is thrown at it.
    passiveNames: { onHitStatus: "Sticky" },
    onHitStatus: { kind: "BLEED", duration: 2, power: 1, stack: true, stackCap: 4 },
  },
  {
    id: "leaf_oak",
    name: "Oak",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Tank",
    attackType: "Melee",
    // Bumped 1→2 (swapped with Weeds): a beefier 19-HP body that earns its
    // Acorn-per-hit + Root Growth engine.
    cost: 2,
    dmg: 2,
    hits: 1,
    hp: 19,
    sp: 0,
    shields: 0,
    keywords: {},
    tribe: "Grove",
    // Acorn Drop: every hit Oak takes sprouts an Acorn — a 2/3/3 seedling that
    // Seed-Rolls one slot forward each round. Root Growth: Oak drinks in 2× from
    // every healing source (REGEN, aura heals, ally lifesteal…).
    // Taproot: a landed basic ROOTs for 2 rounds — a planted SP-0 tree that
    // can't chase needs the enemy to stop coming to it.
    passiveNames: { spawnOnHitTaken: "Acorn Drop", healReceivedMult: "Root Growth", onHitStatus: "Taproot" },
    // One sprout per ROUND, not per landed hit. It used to multiply by
    // `landedHits`, so a single four-hit attacker handed Oak four Acorns — the
    // card was rewarded most by exactly the thing that should have been beating
    // it, and a wide attacker fed it a whole board.
    spawnOnHitTaken: { token: "leaf_acorn_tok", count: 1, oncePerRound: true },
    healReceivedMult: 2,
    onHitStatus: { kind: "ROOT", duration: 2, power: 0 },
    // Rares carry Talents, not repeatable Specials: free, but once per game.
    // Reroot: a planted SP-0 tree uproots and marches up to 3 slots forward.
    talent: {
      name: "Reroot",
      handler: "reposition",
      params: { charge: 2 },
      text: "Once per game: uproot and advance up to 2 slots toward the enemy home.",
    },
  },
  {
    id: "pyro_sparky",
    name: "Sparky",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 1,
    dmg: 4,
    hits: 1,
    hp: 4,
    sp: 7,
    shields: 0,
    keywords: {},
    // Burning Bark: when an opponent is summoned, Sparky hops to the closest
    // empty adjacent slot and sears it with BURN 1.
    passiveNames: { onOppSummon: "Burning Bark" },
    onOppSummon: { chase: true, status: { kind: "BURN", duration: 1, power: 1 } },
  },
  {
    id: "gale_syt_bird",
    name: "Sightwing",
    rarity: "rare",
    element: "GALE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 2,
    sp: 11,
    shields: 0,
    tribe: "Avian",
    keywords: { FLYING: true },
    // Sky Scout: when Sightwing enters a Mid row, allies' basic attacks hit +1
    // adjacent target for the round.
    passiveNames: { skyScout: "Sky Scout" },
    skyScout: true,
  },

  // ── Class-per-cost grid, COST 1 (batch 2: cells needing a small mechanic, all
  //    reusing existing handlers). Fills PYRO Ranger, AQUA Ranger, BORE Warrior/
  //    Mage, DAWN Tank/Support. Kits kept thin (coverage first). ──
  {
    id: "pyro_florence",
    name: "Florence",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 1,
    dmg: 2,
    hits: 2,
    hp: 4,
    sp: 7,
    shields: 0,
    keywords: {},
    // Pop (On Death): bursts across the whole enemy board for 1.
    passiveNames: { onDeath: "Pop" },
    onDeath: { dmg: 0, aoeDmg: 1 },
  },
  {
    id: "aqua_buccaneers",
    name: "Saltjacks",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 1,
    dmg: 2,
    hits: 2,
    hp: 3,
    sp: 8,
    shields: 0,
    keywords: {},
    tribe: "Pirate",
    // Back-ups (On Summon): a shot straight down its column, hitting every
    // opponent in that line for 2. (Doc's on-death self-copy is deferred — a
    // full copy would recurse its own On-Death, and there's no non-recursive
    // Saltjacks token/art to spawn instead.)
    passiveNames: { onSummon: "Back-ups" },
    onSummon: { handler: "barrage", params: { dmg: 2, sameColumn: 1, targets: 99 }, targetSide: "enemy" },
  },
  {
    id: "bore_iron",
    name: "Iron",
    rarity: "rare",
    element: "BORE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 1,
    dmg: 3,
    hits: 1,
    hp: 3,
    sp: 3,
    shields: 3,
    keywords: {},
    // Plate Cover (On Summon): shields the row ahead (Smith's grantShield).
    passiveNames: { onSummon: "Plate Cover" },
    onSummon: { handler: "grantShield", params: { amount: 2 }, targetSide: "ally" },
  },
  {
    id: "bore_cosmic",
    name: "Cosmic",
    rarity: "rare",
    element: "BORE",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 1,
    dmg: 3,
    hits: 1,
    hp: 4,
    sp: 6,
    shields: 1,
    keywords: {},
    // Meteor (On Death): as Cosmic falls it calls down a strike that lands at
    // the END of the round — 3 DMG to every opponent.
    passiveNames: { onDeath: "Meteor" },
    onDeath: { dmg: 0, roundEndAoe: 3 },
  },
  {
    id: "dawn_reflection",
    name: "Reflection",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Tank",
    tribe: "Suns",
    attackType: "Melee",
    cost: 2,
    dmg: 2,
    hits: 1,
    hp: 12,
    sp: 3,
    shields: 2,
    // REFLECT 1: returns 1 DMG to attackers.
    keywords: { REFLECT: 1 },
    // Light Screen (End of Round): plates up allies within range +1 shield.
    //
    // One, not three. Shields never expire, so this is a GENERATOR: three
    // allies in range at +3 was nine shields a round, compounding for the rest
    // of the game off a cost-2 body that also reflects. A drip is the fantasy
    // — armour handed out steadily — and it still adds up over a long game
    // without deciding one by round four.
    passiveNames: { roundTick: "Light Screen" },
    roundTick: { allyInRangeShields: 1 },
  },
  {
    id: "dawn_able",
    name: "Vigil",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Support",
    tribe: "Suns",
    attackType: "Ranged",
    cost: 1,
    dmg: 1,
    hits: 1,
    hp: 12,
    sp: 2,
    shields: 0,
    keywords: {},
    // Emergency Support: at end of round, heal any ally that's dropped below
    // 4 HP by +2. Its basic can also aim at a hurt ally to heal.
    passiveNames: { roundTick: "Emergency Support" },
    roundTick: { healWoundedAllies: { underHp: 4, amount: 2 } },
    basicHealsAllies: true,
  },

  // ── Class-per-cost grid, COST 2 (thin kits, coverage first) ──
  {
    id: "leaf_python",
    name: "Python",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 2,
    dmg: 2,
    hits: 1,
    hp: 17,
    sp: 2,
    shields: 0,
    tribe: "Reptile",
    keywords: {},
    // Constriction: while adjacent to an opponent, drains 2 HP from it at end of
    // round (deal 2, heal 2) — a squeeze that doesn't need to swing.
    // Coil Hold: the squeeze also pins — a landed basic ROOTs for 2 rounds. A
    // constrictor that its victim can simply stroll away from was the odd one
    // out in a pool whose whole answer to a capture race is holding bodies still.
    passiveNames: { roundTick: "Constriction", onHitStatus: "Coil Hold" },
    roundTick: { drainAdjacent: 2 },
    onHitStatus: { kind: "ROOT", duration: 2, power: 0 },
  },
  {
    id: "leaf_weeds",
    name: "Weeds",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Support",
    attackType: "Ranged",
    // Dropped 2→1 (swapped with Oak): a cheap, disposable body that keeps coming
    // back.
    //
    // 3 + 7 + 6 = 16, the same total it carried at 9 HP and 4 SP — a straight
    // swap of two points of body for two of speed, one over 5*1+10 and inside
    // the +/-2 either way. What the budget does NOT price is the tier: SP_SLOW_MAX
    // is 5, so 4 was a one-step mover and 6 is a two-step one. That is the real
    // change here, and it is the right one for this card — Spread puts copies
    // wherever Weeds is standing, so a Weeds that can reach further is a Weeds
    // that seeds further, and the thing being bought is spread rather than legs.
    cost: 1,
    dmg: 3,
    hits: 1,
    hp: 7,
    sp: 6,
    shields: 0,
    keywords: {},
    tribe: "Grove",
    // Spread: a landed basic has a 15% chance to put another Weeds on the board.
    //
    // Replaces Offspring (revive at half HP with a 50% second chance). Same
    // fantasy — weeds you cannot get rid of — moved from dying to living, so the
    // card does something while it is on the board instead of only when it
    // leaves it. Capped at 2 and every copy is born sterile: a card that copies
    // itself compounds, and an uncapped generator is the failure this set has
    // already had to fix twice (Aurora's orb recharge, Reflection's shields).
    passiveNames: { onHitSpawn: "Spread" },
    onHitSpawn: { token: "leaf_weeds", chance: 15, max: 2 },
  },
  {
    id: "pyro_heatsink_golem",
    name: "Heatsink Golem",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 2,
    dmg: 2,
    hits: 1,
    hp: 15,
    sp: 3,
    shields: 0,
    tribe: "Forged Tech",
    keywords: {},
    // Bloodember (basic): its molten barbs open a BLEED — and being PYRO, the
    // Scorch aura layers BURN on the same swing. So a single basic sets the
    // target BLEEDING and BURNING at once — bloodfire — with no help. A durable
    // 15-HP engine that keeps re-lighting the condition the payoff cards want.
    passiveNames: { onHitStatus: "Bloodember" },
    onHitStatus: { kind: "BLEED", duration: 2, power: 2 },
  },
  {
    id: "pyro_firecrack",
    name: "Firecrack",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 2,
    dmg: 5,
    hits: 1,
    hp: 4,
    sp: 11,
    shields: 0,
    keywords: {},
    tribe: "Goblin",
    // Bloodfire Detonator: a glass-cannon finisher that DOUBLES its hit against
    // a target already BLEEDING and BURNING — the payoff for the blood engine
    // and the fire engine landing on the same body. Amplify, not consume: the
    // DOTs keep ticking, so a fast Firecrack can cash in every round.
    passiveNames: { vsStatus: "Bloodfire Detonator", bonusVsShield: "Shell Cracker" },
    vsStatus: { status: "BURN", bloodfire: true, dmgMult: 2 },
    // Shell Cracker: basics hit DOUBLE against a shielded target. A firecracker
    // packed into a seam does more than one lit in the open.
    //
    // Does NOT compound with Bloodfire Detonator above. Against a target that is
    // bleeding, burning AND shielded both amplifiers match, and the engine takes
    // the LARGEST rather than the product — so that is 2x, the same as either
    // one alone, not the 5 -> 10 -> 20 the two would multiply to. Firecrack
    // picks whichever opening the board gives it; it does not get paid twice for
    // finding both. See the amplifier block in combat.ts.
    bonusVsShield: 2,
  },
  {
    id: "pyro_taper",
    name: "Taper",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 2,
    dmg: 5,
    hits: 1,
    hp: 8,
    sp: 7,
    shields: 0,
    keywords: {},
    // Out with a Bang (On Death): applies BURN 1 to opponents in the far (home)
    // row — stacks with the Scorch aura.
    passiveNames: { onDeath: "Out with a Bang" },
    onDeath: { dmg: 0, farRowStatus: { kind: "BURN", duration: 1, power: 1 } },
  },
  {
    id: "aqua_arctik",
    name: "Arctik",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 2,
    dmg: 4,
    hits: 1,
    hp: 7,
    sp: 9,
    shields: 0,
    tribe: "Ice",
    keywords: {},
    // Freeze Tag: a 25% chance to FREEZE on a basic hit. (A simpler take than the
    // doc's on-kill retaliation, using the same coin-flip on-hit.)
    passiveNames: { onHitStatus: "Freeze Tag" },
    onHitStatus: { kind: "FREEZE", duration: 1, power: 0, chance: 25 },
  },
  {
    id: "aqua_harp",
    name: "Harp",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 2,
    dmg: 6,
    hits: 1,
    hp: 9,
    sp: 5,
    shields: 0,
    keywords: {},
    // Harpoon Hook: a landed basic drags the struck enemy 1 slot toward Harp,
    // reeling a backline threat into the front line.
    pullOnAttack: 1,
  },
  {
    id: "bolt_scrapper",
    name: "Scrapper",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 2,
    dmg: 5,
    hits: 1,
    hp: 9,
    sp: 5,
    shields: 1,
    keywords: {},
    // Jolt Fist: a 40% chance to PARALYZE on a basic hit. On Kill: +2 shields.
    passiveNames: { onHitStatus: "Jolt Fist", onKill: "Salvage Plating" },
    onHitStatus: { kind: "PARALYZE", duration: 1, power: 0, chance: 40 },
    onKill: { gainShields: 2 },
  },
  {
    id: "bore_sling",
    name: "Sling",
    rarity: "rare",
    element: "BORE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 2,
    dmg: 2,
    hits: 2,
    hp: 3,
    sp: 11,
    shields: 1,
    // Crack Shot: an EXEMPTION from the shield gate, not a rider on top of one.
    // A plain CRIT can't fire at all while the target still has shields (see the
    // rules header in combat.ts), so the headline here is that Sling's coin is
    // still live against a shielded target — and a landed crit then pierces
    // rather than being eaten. Describing it as "the crit also pierces" read as
    // a bonus on a crit that, by the rules, would never have happened.
    keywords: { CRIT: true },
    passiveNames: { critPen: "Crack Shot" },
    critPen: true,
  },
  {
    id: "dusk_zhunk",
    name: "Zhunk",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 17,
    sp: 2,
    shields: 0,
    keywords: {},
    tribe: "Zombie",
    // Carnage: grows +1 DMG / +1 HP every time any Zombie falls.
    passiveNames: { onTribeDeath: "Carnage" },
    onTribeDeath: { tribe: "Zombie", dmg: 1, hp: 1, max: 5 },
  },
  {
    id: "dawn_stbern",
    name: "St. Bernard",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Support",
    tribe: "Suns",
    attackType: "Ranged",
    cost: 2,
    dmg: 3,
    hits: 1,
    hp: 12,
    sp: 6,
    shields: 0,
    keywords: {},
    // Rescue Pack: at end of round, heal any ally that's fallen to 1 HP by +4.
    // Its basic can also aim at a hurt ally to heal.
    passiveNames: { roundTick: "Rescue Pack" },
    roundTick: { healWoundedAllies: { underHp: 2, amount: 4 } },
    basicHealsAllies: true,
  },

  // ── Class-per-cost grid, COST 3 (thin kits, coverage first). BOLT Tank has no
  //    doc/art source. ──
  {
    id: "pyro_wick",
    name: "Wick",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 3,
    dmg: 3,
    hits: 1,
    hp: 12,
    sp: 9,
    shields: 0,
    keywords: {},
    // Wax Bomb: a basic hit plants a charge that detonates for 5 at the next
    // round end (a single delayed explosion, not a recurring burn).
    passiveNames: { onHitStatus: "Wax Bomb" },
    onHitStatus: { kind: "DOT", duration: 1, power: 5 },
    // 5 Wicked Frag (Talent, free, once per game): 5 DMG to a target, 3 to all
    // other opponents.
    talent: {
      name: "5 Wicked Frag",
      text: "Once per game, free: deal 5 DMG to a target and 3 DMG to all other opponents.",
      handler: "fragBlast",
      params: { dmg: 5, splash: 3 },
    },
  },
  {
    id: "aqua_tide",
    name: "Tide",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 13,
    sp: 2,
    shields: 3,
    keywords: {},
    tribe: "SeaC",
    // Surfs Up (On Summon): a wave 2 DMG to the enemy row ahead, and +2 HP to the
    // whole crew.
    passiveNames: { onSummon: "Surfs Up" },
    onSummon: { handler: "surfsUp", params: { dmg: 2, heal: 2 }, targetSide: "enemy" },
    // Shell Tuck (Talent, free, once per game): gain 6 shields; Tide's basics
    // suffer −50% accuracy for 2 rounds.
    talent: {
      name: "Shell Tuck",
      text: "Once per game, free: gain 6 shields, but Tide's basic attacks miss 50% of the time for 2 rounds.",
      handler: "shellTuck",
      params: { shields: 6, missPct: 50, missRounds: 2 },
    },
  },
  {
    id: "bolt_storm",
    name: "Storm",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 3,
    dmg: 3,
    hits: 1,
    hp: 14,
    sp: 9,
    shields: 0,
    keywords: {},
    // Supercell: +1 DMG, +2 HP, +1 SP every round for its first 3 rounds.
    passiveNames: { buffDmgEveryN: "Supercell" },
    roundTick: { buffDmgEveryN: { n: 1, amount: 1, sp: 1, hp: 2, maxTicks: 3 } },
    // Thunder Strike: 5 DMG to every ELECTRIFIED opponent (BOLT lights them up).
    special: {
      name: "Thunder Strike",
      cost: 1,
      handler: "smite",
      params: { dmg: 5, requireStatus: "ELECTRIFIED" },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 5 DMG to every ELECTRIFIED opponent.",
    },
  },
  {
    id: "bore_rock",
    name: "Slugger",
    rarity: "rare",
    element: "BORE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 11,
    sp: 9,
    shields: 0,
    keywords: {},
    // Punch Drunk: each basic has a 30% chance to knock the target out — SLEEP
    // for 2 rounds. (Was gated on a "2nd hit this round", which a single-hit
    // card can't reach, so it never fired.)
    passiveNames: { onHitStatus: "Punch Drunk" },
    onHitStatus: { kind: "SLEEP", duration: 2, power: 0, chance: 30 },
    // Roll Out Combo Killer (Talent, free, once per game): a 1→2→3→4 DMG combo.
    talent: {
      name: "Roll Out Combo Killer",
      text: "Once per game, free: hit with a 1 → 2 → 3 → 4 DMG combo.",
      handler: "combo",
      params: { hits: 4, dmg: 1, ramp: 1 },
    },
  },
  {
    id: "bore_stone",
    name: "Stone",
    rarity: "rare",
    element: "BORE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 5,
    sp: 11,
    shields: 2,
    keywords: {},
    // Quartz Hound (On Summon): arrives with +3 shields, and adds a 2-DMG strike
    // to every basic attack (basicBonus.flat).
    passiveNames: { summonSelfShields: "Quartz Hound" },
    summonSelfShields: 3,
    basicBonus: { flat: 2 },
    // Search and Rescue (Talent, free, once per game): swap board spots with an
    // ally.
    talent: {
      name: "Search and Rescue",
      text: "Once per game, free: trade board positions with an ally.",
      handler: "swapAlly",
      // ALLY, said out loud. `swapAlly` looks through its target list for a
      // friendly body, and the Talent path handed it the ENEMY list — so it
      // found nothing, returned silently, and burned the once-per-game charge
      // for no effect. Specials have always declared this; Talents can now too.
      targetSide: "ally",
      params: {},
    },
  },
  {
    id: "dusk_sarachnid",
    name: "Sarachnid",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 4,
    dmg: 4,
    hits: 1,
    hp: 16,
    sp: 10,
    shields: 0,
    keywords: {},
    tribe: "Spider",
    // Nesting: spawns a Spider on summon and one more each round (capped so the
    // board can't flood).
    summonSpawn: { token: "dusk_spider", count: 1 },
    roundTick: { spawn: { token: "dusk_spider", count: 1 }, spawnMaxAlive: 4 },
    passiveNames: { roundTick: "Nesting" },
    // Silk Chase: every allied Spider takes a swing, each opponent hit is
    // FRIGHTENed, Sarachnid heals 2 HP per hit landed, and every KILL nests
    // another Spider.
    special: {
      name: "Silk Chase",
      cost: 2,
      handler: "tribeSwarm",
      // frighten: 2 — see Last Waltz and Brood Summon. The swarm resolves in
      // BATTLE and Cleanup follows immediately, so a 1-round FRIGHTEN was gone
      // before it could pin anything. The card text still reads "1 round"
      // because that is what 2 ticks buys: one Prep turn where they cannot move.
      // spawnCount 2: the cast nests two Spiders outright, on top of the one per
      // KILL it already paid. The kill spawns are the reward for a good hunt;
      // these are the floor, so a Silk Chase that finds nothing still leaves the
      // web wider than it found it — which is the half of this card that was
      // missing when the board was empty in front of her.
      params: { tribe: "Spider", frighten: 2, healPerHit: 2, spawnOnKill: "dusk_spider",
                spawn: "dusk_spider", spawnCount: 2 },
      targetSide: "enemy",
      text: "Every allied Spider attacks; each opponent hit is FRIGHTENed 1 round and Sarachnid heals 2 HP per hit. Nests 2 Spiders, plus another for every opponent killed.",
    },
  },
  {
    id: "dusk_spectra",
    name: "Spectra",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 3,
    dmg: 2,
    hits: 1,
    hp: 13,
    sp: 10,
    shields: 0,
    keywords: {},
    tribe: "Ghost",
    // Strength Sap: a melee attacker leaves WEAKENed (−25% DMG) — the ghost
    // saps its strength. (EVASION is no longer innate; it's granted on demand
    // by Opaque Realm below.)
    passiveNames: { onHitByMelee: "Strength Sap" },
    onHitByMelee: { status: { kind: "WEAKEN", duration: 1, power: 0 } },
    // Opaque Realm: cloak Spectra and whoever stands directly behind it in
    // EVASION for 2 rounds.
    special: {
      name: "Opaque Realm",
      cost: 2,
      handler: "veilBehind",
      params: { rounds: 2 },
      targetSide: "self",
      text: "Give Spectra and the ally directly behind it EVASION for 2 rounds.",
    },
  },
  {
    id: "dusk_hix",
    name: "Hexvial",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 3,
    // Re-cut as a glass cannon: 5/13/7 -> 8/6/11. Budget-neutral at 25 either way
    // (8 + 6 + 11 = 25 = 5*3 + 10), so this trades durability for damage and speed
    // rather than adding power. At 6 HP it now dies to most single Specials, which
    // is the price of throwing 8 a shot from the 11-SP band.
    dmg: 8,
    hits: 1,
    hp: 6,
    sp: 11,
    shields: 0,
    keywords: {},
    // Both: Dark is what it does, Goblin is what it is. Added rather than
    // swapped, so nothing that already reads Dark loses a member.
    tribe: ["Dark", "Goblin"],
    // Magic Potion (On Attack): a landed basic hurls a random potion — poison
    // (DOT 1), damage (3), or FRIGHTEN 2. On Death: the flasks shatter across the
    // enemy row directly ahead.
    passiveNames: { potionOnHit: "Magic Potion", onDeath: "Magic Potion" },
    potionOnHit: true,
    onDeath: { dmg: 3, rowAhead: true },
  },
  {
    id: "dawn_golde",
    name: "Gilden",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Warrior",
    tribe: "Suns",
    attackType: "Melee",
    // Up a cost. 5 + 16 + 4 + 5 = 30, exactly the cost-4 budget (it was a point
    // OVER the cost-3 one). The four points go to the bruiser half — Relentless
    // only pays while Gilden is alive and being swung at, so HP is the stat that
    // makes its own passive worth more.
    //
    // Note it leaves OPENING_COST_CAP territory doing this: a cost-4 body can no
    // longer be placed in a region's opening battle, where a cost-3 one could.
    cost: 4,
    dmg: 5,
    hits: 1,
    hp: 16,
    sp: 5,
    shields: 2,
    keywords: {},
    // Relentless (On Hit by Melee): strikes 2 back at the attacker.
    passiveNames: { onHitByMelee: "Relentless" },
    onHitByMelee: { dmg: 2 },
    // War Cry: Gilden plates up (+2 shields) and rallies the team (+1 DMG) for
    // 2 rounds.
    special: {
      name: "War Cry",
      cost: 1,
      handler: "warCry",
      params: { selfShields: 2, selfShieldsMax: 8, buffDmg: 1, buffRounds: 2 },
      targetSide: "self",
      text: "Gain 2 shields, then give the team +1 DMG for 2 rounds.",
    },
  },
  {
    id: "dawn_oxin",
    name: "Oxin",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Tank",
    tribe: "Suns",
    attackType: "Melee",
    cost: 3,
    dmg: 2,
    hits: 1,
    hp: 19,
    sp: 2,
    shields: 1,
    // Fountain (On Hit by Melee): saps 1 SP from the attacker; Oxin also can't be
    // moved by opponent abilities. Plus BLOCK 1 — a stolid 19-HP wall.
    keywords: { BLOCK: 1 },
    passiveNames: { onHitByMelee: "Fountain", pushImmune: "Braced Stance" },
    onHitByMelee: { spDrain: 1 },
    pushImmune: true,
  },

  // ───────────────────── COST-4 EPICS (grid fill) ─────────────────────
  {
    id: "leaf_whintey",
    name: "Hibernal",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 5,
    dmg: 9,
    hits: 1,
    hp: 18,
    sp: 8,
    shields: 0,
    keywords: {},
    // Frosty Bites (End of Round): FREEZE an opponent with 0 SP for 2 rounds.
    // It ROOTed before. FREEZE is the heavier pin — both hold SP at 0 and stop
    // the card moving, and FREEZE takes half its damage on top.
    passiveNames: { freezeZeroSp: "Frosty Bites" },
    roundTick: { freezeZeroSp: 2 },
    // Winter's Bundle: still the DEEPENING it always was — +2 rounds on every
    // opponent already ROOTed — and now a one-round ROOT on everyone who is not,
    // rather than passing them over.
    //
    // The deepening on its own needed someone else to have done the rooting
    // first. That was fine while the passive above supplied the ROOTs, and
    // became a dead cast the moment it started freezing instead. Seeding and
    // deepening in the same breath is what keeps the Special working off its own
    // card: cast once and the board is briefly held, cast again and everything
    // still standing in it is held for far longer.
    special: {
      name: "Winter's Bundle",
      cost: 2,
      handler: "extendStatusAll",
      params: { status: "ROOT", addRounds: 2, applyRounds: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "ROOT every opponent for 1 round — and every opponent already ROOTed is held for 2 rounds longer instead.",
    },
  },
  {
    id: "aqua_anos",
    name: "Serenos",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 4,
    dmg: 6,
    hits: 1,
    hp: 16,
    sp: 8,
    shields: 0,
    keywords: {},
    tribe: "Liquid",
    // Liquid Serenity (End of Round): if Serenos didn't attack this round, heal +8
    // and gain +1 DMG next round.
    passiveNames: { idleBuff: "Liquid Serenity" },
    idleBuff: { heal: 8, dmg: 1 },
    // Mind Bubble Channeling: for 2 rounds, each Cleanup gain +1 DMG, heal +4,
    // and self-cleanse (burns only — CLEANSE is DAWN-locked).
    special: {
      name: "Mind Bubble Channeling",
      cost: 2,
      handler: "channelBuff",
      params: { dmg: 1, heal: 4, rounds: 2 },
      targetSide: "self",
      text: "For 2 rounds, each round end: +1 DMG, heal +4, and fully cleanse yourself.",
    },
  },
  {
    id: "aqua_cryo",
    name: "Cryo",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 4,
    dmg: 5,
    hits: 1,
    hp: 15,
    sp: 5,
    shields: 3,
    keywords: {},
    tribe: "Ice",
    // Cold Snap: basic attacks deal +2 DMG to a FROZEN opponent.
    passiveNames: { vsStatus: "Cold Snap" },
    vsStatus: { status: "FREEZE", bonusDmg: 2 },
    // Mega Icicle: 5 DMG to a 2×2 area; a target already FROZEN has its remaining
    // FREEZE doubled (Cryo Freeze).
    special: {
      name: "Mega Icicle",
      cost: 2,
      handler: "areaBlast",
      params: { dmg: 5, freezeDouble: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Throw an icicle dealing 5 DMG to a 2×2 area; a FROZEN target's FREEZE is doubled.",
    },
  },
  {
    id: "gale_fano",
    name: "Fanwing",
    rarity: "epic",
    element: "GALE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 4,
    dmg: 5,
    hits: 1,
    hp: 12,
    sp: 9,
    shields: 2,
    keywords: {},
    // Blade Breaker (On Attack): 50% chance to WEAKEN the target.
    passiveNames: { onHitStatus: "Blade Breaker" },
    onHitStatus: { kind: "WEAKEN", duration: 1, power: 0, chance: 50 },
    // Feather Fan: give every slower teammate Fanwing's SP value for 1 round.
    special: {
      name: "Feather Fan",
      cost: 1,
      handler: "featherFan",
      params: {},
      targetSide: "self",
      text: "Give every slower teammate Fanwing's SP value for 1 round.",
    },
  },
  {
    id: "bolt_surge",
    name: "Surge",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 4,
    // A TANK THAT SOAKS RATHER THAN SWINGS. The line has walked twice now, both
    // times the same direction: 5 shields and 10 HP became 3 and 15, and then
    // 7 damage became 5 to buy two more HP. Every step trades output for the
    // ability to still be standing, which is what a Tank whose whole kit is a
    // reactive charge wants — Electro Surge only pays if Surge is alive to
    // re-arm it, and the retaliation punishes whoever hit it, not whoever it
    // hit. HP is also the half of the line that shield-strip cannot take away.
    dmg: 5,
    hits: 1,
    hp: 17,
    sp: 5,
    shields: 3,
    keywords: {},
    tribe: "ARC",
    // Surge Protector + Electro Surge: starts armed on summon; while armed it's
    // status-immune, and the first hit it takes discharges — PARALYZE the
    // attacker 3r, then deactivate. Re-arming also stores ONE ranged basic.
    // Buzz shares this passive and deliberately does NOT get the shot: its
    // re-arm is a once-per-game Talent on a cost-3 rare, so a free ranged
    // attack on top would be the better half of a legendary's kit for 3.
    passiveNames: { electroSurge: "Electro Surge" },
    electroSurge: { paralyze: 3, shield: 1, dmgBoost: 5, boostRounds: 2, rangedShots: 1 },
    // Live current: +2 SP every round (stacking).
    roundTick: { buffDmgEveryN: { n: 1, amount: 0, sp: 2, maxTicks: 5 } },
    special: {
      name: "Electro Surge",
      cost: 1,
      handler: "electroSurge",
      params: {},
      targetSide: "self",
      text: "Re-arm Electro Surge: +1 shield and +5 DMG for 2 rounds, and its next attack strikes at RANGE. While armed: status-immune, and the next hit PARALYZEs the attacker 3 rounds.",
    },
  },
  {
    id: "bolt_voltcher",
    name: "Voltcher",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 4,
    dmg: 4,
    hits: 1,
    hp: 13,
    sp: 7,
    shields: 3,
    keywords: { FLYING: true },
    tribe: "ARC",
    // High Voltage Sentry: auto-fires Thunderbird the first time it lands a hit
    // and again when it dies.
    passiveNames: { firePassiveSpecial: "High Voltage Sentry" },
    firePassiveSpecial: { onFirstHit: true, onDeath: true },
    special: {
      name: "Thunderbird",
      cost: 2,
      handler: "barrage",
      params: { dmg: 3, targets: 99 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 3 DMG to opponents in the near or far row.",
    },
  },
  {
    id: "bolt_striik",
    name: "Highroller",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 4,
    dmg: 4,
    hits: 1,
    hp: 14,
    sp: 10,
    shields: 1,
    keywords: { CRIT: true },
    // Jackpot: a basic CRIT auto-fires Purple Strikes free; 3 crits in a round
    // grants +7 HP / +2 DMG.
    passiveNames: { jackpot: "Jackpot" },
    jackpot: { critsForBonus: 3, bonusHp: 7, bonusDmg: 2 },
    special: {
      name: "Purple Strikes",
      cost: 2,
      handler: "barrage",
      params: { dmg: 2, crit: 1, targets: 4, closest: 1, statusKind: "ELECTRIFIED", statusDuration: 99 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 2 CRIT damage to the 4 closest opponents and mark them Electrified permanently.",
    },
  },
  {
    id: "bore_bolder",
    name: "Bolder",
    rarity: "epic",
    element: "BORE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 5,
    dmg: 6,
    hits: 1,
    hp: 20,
    sp: 3,
    shields: 3,
    keywords: { TRAMPLE: true },
    // A third of attack, the same ratio every other carrier took.
    trampleDmg: 2,
    // Iron Ore: take half damage (round down) from Ranger + Assassin attackers.
    passiveNames: { blockVsClasses: "Iron Ore" },
    blockVsClasses: ["Ranger", "Assassin"],
    // Vengeance: deal the damage Bolder took this round back (with PEN) and SLEEP
    // an opponent 2 rounds.
    //
    // `reach` because it is a RETALIATION, and Bolder is a melee wall whose whole
    // job is being shot at — Iron Ore halves Ranger and Assassin damage, so the
    // things that hurt it are usually the things standing furthest away. Gated on
    // the ordinary melee square it could not answer any of them: the Special was
    // refused for "No valid target" in exactly the situation the card is built
    // for. 9 king-steps is the whole board, which is what "deal it back" means.
    special: {
      name: "Vengeance",
      cost: 2,
      handler: "vengeance",
      params: { sleep: 2, reach: 9 },
      targetSide: "enemy",
      text: "Deal PEN damage equal to what Bolder took this round to any opponent, and SLEEP it for 2 rounds.",
    },
  },
  {
    id: "bore_sheish",
    name: "Kimberlite",
    rarity: "epic",
    element: "BORE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 4,
    dmg: 7,
    hits: 1,
    hp: 11,
    sp: 8,
    shields: 2,
    keywords: {},
    // Diamond's Edge: basic attacks deal 2× damage vs a shielded target.
    passiveNames: { bonusVsShield: "Diamond's Edge" },
    bonusVsShield: 2,
    // Diamond Assault: 5 DMG to two opponents, then bank shields equal to what
    // was broken.
    special: {
      name: "Diamond Assault",
      cost: 2,
      handler: "diamondAssault",
      params: { dmg: 5, targets: 2 },
      targetSide: "enemy",
      text: "Deal 5 DMG to two opponents, then gain shields equal to the amount of shields broken.",
    },
  },
  {
    id: "bore_lithara",
    name: "Lithara",
    rarity: "epic",
    element: "BORE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 4,
    dmg: 4,
    hits: 1,
    hp: 10,
    sp: 5,
    shields: 5,
    keywords: {},
    // Golden Resonance: each successful Special use grants +2 shields and +1 DMG.
    passiveNames: { onSpecialUse: "Golden Resonance" },
    onSpecialUse: { shields: 2, dmg: 1 },
    // Earth Shatter: 5 DMG to a single target and SLEEP it until end of round.
    special: {
      name: "Earth Shatter",
      cost: 2,
      handler: "barrage",
      // maxStacks caps Golden Resonance, not the damage: every cast adds +2
      // PERMANENT shields and +1 permanent DMG (onSpecialUse below), on a 2-magic
      // Special with no other limit. Shields are the worst stat to leave running
      // — they come off every incoming hit — and three casts is Oakgre's
      // precedent for exactly this shape.
      params: { dmg: 5, targets: 1, statusKind: "SLEEP", statusDuration: 1, maxStacks: 3 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 5 DMG to a single target and SLEEP it until end of round.",
    },
  },
  {
    id: "dusk_brute",
    name: "Brute",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 5,
    dmg: 4,
    hits: 1,
    hp: 22,
    sp: 5,
    shields: 2,
    keywords: { CRIT: true },
    tribe: "Skeleton",
    // Brutal (On CRIT): the target loses 1 DMG on its attacks for the round.
    passiveNames: { onCritDebuff: "Brutal" },
    onCritDebuff: 1,
    // Sweep: basic-attack every opponent IN RANGE; +2 shields per kill.
    special: {
      name: "Sweep",
      cost: 3,
      handler: "sweep",
      params: { shieldPerKill: 2 },
      targetSide: "enemy",
      // NO `ranged` flag, deliberately, and it used to have one. That flag is
      // about the FIRE GATE: canFireSpecial refuses when nothing is in normal
      // targeting range, and the old Sweep took the whole row ahead — a set
      // that could be occupied while the adjacent tiles were empty, so the gate
      // and the effect disagreed and Brute was locked out of its own printed
      // ability. Sweep now hits exactly what a basic could reach, so the
      // ordinary melee gate IS the right gate and the flag would only let it
      // fire at nothing.
      text: "Attack every opponent in range; gain +2 shields per kill.",
    },
  },
  {
    id: "dusk_plaguecrow",
    name: "Plaguecrow",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 4,
    dmg: 4,
    hits: 2,
    hp: 11,
    sp: 11,
    shields: 0,
    keywords: { CRIT: true, PEN: true },
    tribe: "Skeleton",
    // Diagnosis (On Summon): opponents cannot use Specials this round.
    passiveNames: { onSummon: "Diagnosis", onDeath: "Plague" },
    onSummon: { handler: "lockSpecials", params: { rounds: 1 }, targetSide: "enemy" },
    // On Death: raise a RedRaven, which imposes the same quarantine (Red Shift).
    onDeath: { dmg: 0, spawnToken: { token: "dusk_redreven", count: 1 } },
    // Miasma Burst: 4 DMG CRIT + PEN to all opponents in range.
    special: {
      name: "Miasma Burst",
      // 3, not 2. Krysteel is the same cost, class, rarity and attack type, and
      // its Krystal Rain is this Special with one LESS damage and no PEN — for
      // one MORE magic. The source comment on that card records that this exact
      // shape at 2 magic is what forced Krysteel to 3 in the first place.
      cost: 3,
      handler: "barrage",
      params: { dmg: 4, targets: 99, crit: 1, pen: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 4 DMG (CRIT, PEN) to all opponents in range.",
    },
  },
  {
    id: "dawn_ty",
    name: "Tether",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Mage",
    tribe: "Stars",
    attackType: "Ranged",
    cost: 4,
    dmg: 6,
    hits: 1,
    hp: 12,
    sp: 7,
    shields: 2,
    keywords: {},
    // Magic Ropes (each round): bind 2 in-range opponents — their Specials are
    // disabled for the coming round.
    passiveNames: { roundTick: "Magic Ropes" },
    roundTick: { lockEnemySpecials: 2 },
    // Lacing Knots: 8 DMG to every opponent still bound by Magic Ropes.
    special: {
      name: "Lacing Knots",
      cost: 3,
      handler: "lacingKnots",
      params: { dmg: 8 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 8 DMG to all opponents bound by Magic Ropes (locked Specials) this round.",
    },
  },
  {
    id: "dawn_raya",
    name: "Zenith",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Ranger",
    tribe: "Stars",
    attackType: "Ranged",
    cost: 4,
    dmg: 7,
    hits: 1,
    hp: 10,
    sp: 7,
    shields: 2,
    keywords: {},
    // Star Blaster (On Kill): BLIND nearby opponents for the round.
    passiveNames: { onKill: "Star Blaster" },
    onKill: { blindInRange: 1 },
    // Orbital Shot: mark a target; a 14-DMG arrow falls on it next round.
    special: {
      name: "Orbital Shot",
      cost: 2,
      handler: "orbitalShot",
      params: { dmg: 14 },
      targetSide: "enemy",
      ranged: true,
      text: "Choose a target; an arrow falls at the start of next round dealing 14 DMG to it.",
    },
  },

  // ───────────────────── COST-5 EPICS (grid fill) ─────────────────────
  {
    id: "dusk_ender",
    name: "Ender",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 5,
    dmg: 8,
    hits: 1,
    hp: 16,
    sp: 11,
    shields: 0,
    keywords: { CRIT: true },
    tribe: ["Skeleton", "ScareKrow"],
    // Unpredictable: a slower opponent has only a 50% chance to hit Ender.
    passiveNames: { evadeVsSlower: "Unpredictable" },
    evadeVsSlower: true,
    // Dark Warp: swap places with any opponent and deal 8 DMG to it.
    special: {
      name: "Dark Warp",
      cost: 2,
      handler: "darkWarp",
      params: { dmg: 8 },
      targetSide: "enemy",
      ranged: true,
      text: "Swap places with any opponent and deal 8 DMG to it.",
    },
  },
  {
    id: "dusk_violet",
    name: "Violet",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 5,
    dmg: 2,
    hits: 3,
    hp: 13,
    // Violet banks max HP three ways at once — DRAIN on all three basic hits,
    // Draining Siphon off everything adjacent every round, and Bloody Exchange
    // taking 2 from every other card on the board at once — and nothing in any
    // of them ever stopped. Left alone on a 5×5 it does not plateau, it
    // compounds: the bigger it gets the longer it survives to keep draining.
    // 60 is a shade under five times its printed 13 and roughly the biggest
    // body in the game, so the ramp is still the point and the ceiling is only
    // where the ramp stops being a win condition on its own.
    maxHpCap: 60,
    sp: 12,
    shields: 2,
    keywords: { DRAIN: true },
    tribe: "Vamp",
    // Draining Siphon (End of Round): DRAIN 3 max HP from opponents within 1
    // space. Basics carry DRAIN (keyword).
    passiveNames: { roundTick: "Draining Siphon" },
    roundTick: { drainMaxAdjacent: 3 },
    // Bloody Exchange: DRAIN 2 max HP from every other card on the board and bank
    // the total onto Violet's own max HP.
    special: {
      name: "Bloody Exchange",
      cost: 3,
      handler: "bloodyExchange",
      params: { amount: 2 },
      targetSide: "self",
      text: "DRAIN 2 max HP from all other cards on the battlefield and add the total to Violet's max HP.",
    },
  },
  {
    id: "gale_omega",
    name: "Omega",
    rarity: "epic",
    element: "GALE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 5,
    dmg: 7,
    hits: 1,
    hp: 13,
    sp: 12,
    shields: 1,
    keywords: {},
    tribe: "Wolf",
    // Ride or Die: Luna grants +3 DMG and +8 HP on summon.
    // Omega Restore: each kill grants +2 max HP and heals 4 — the pair feed on
    // the hunt, so a kill should put something back as well as build.
    passiveNames: { summonSelfBuff: "Ride or Die", onKill: "Omega Restore" },
    summonSelfBuff: { dmg: 3, hp: 8 },
    onKill: { buffMaxHp: 2, healSelf: 4 },
    // Search and Destroy: charge up to 3 into the enemy field and deal 10 DMG.
    special: {
      name: "Search and Destroy",
      cost: 2,
      handler: "strike",
      params: { chargeFirst: 1, charge: 3, dmg: 10 },
      targetSide: "enemy",
      text: "Move up to 3 spaces into the enemy battlefield and deal 10 DMG to an opponent in range.",
    },
  },
  {
    id: "pyro_firefly",
    name: "FireFly",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 5,
    dmg: 2,
    hits: 4,
    hp: 13,
    sp: 12,
    shields: 1,
    keywords: {},
    // BlastOff (On Kill): fire Flying Flame Strike for free, then gain FLYING
    // until the end of next round.
    passiveNames: { firePassiveSpecial: "BlastOff" },
    firePassiveSpecial: { onKill: true, grantFlyingRounds: 2 },
    // Flying Flame Strike: TWELVE 1-DMG shots, each rolled independently at a
    // random opponent in range, then a reposition. `targets` is the SHOT count,
    // not a victim cap — see the handler.
    special: {
      name: "Flying Flame Strike",
      cost: 2,
      handler: "flameStrike",
      params: { dmg: 1, targets: 12, move: 3 },
      targetSide: "enemy",
      ranged: true,
      text: "Fire 12 shots for 1 DMG each at RANDOM opponents in range, then move up to 3 spaces.",
    },
  },
  {
    id: "bolt_general",
    name: "General",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 5,
    dmg: 6,
    hits: 1,
    hp: 16,
    sp: 9,
    shields: 2,
    keywords: {},
    tribe: "ARC",
    // Power Grab (On Move, once/round): cycle the Basic Attack Weapon, changing
    // its basic's dmg × hits. Weapon 0 is the printed 6×1.
    //
    // THE ORDER IS THE LADDER, and it is sorted by OUTPUT so that moving is
    // what buys damage. It used to run Standard 6 → AKVolt 10 → ARC88 8 →
    // ThunderRPG 10, which put the joint-best gun ONE move from the start and
    // then dipped: a General that moved once had everything the ramp had to
    // give, and two more moves bought nothing. Now each step is worth more than
    // the last (6 → 8 → 10 → 10), so reaching the top of it costs three moves
    // and the walk is the price of the damage.
    //
    // The two tens are not a tie in play: AKVolt splits its 10 across two hits
    // (better into shields, worse into one big body) and ThunderRPG lands all
    // of it at once, so the last step is a change of shape rather than a
    // change of size — the finisher, after the ramp.
    //
    // `spCost` stays attached to its own gun rather than to the slot it now
    // sits in, which is why it reads 0, 2, 1, 3. Nothing has ever read it: the
    // per-weapon ⚡ cost from the design doc was simplified out when Power Grab
    // was built (see phases.ts), and it is kept only as a record of the intent.
    passiveNames: { weaponModes: "Power Grab" },
    weaponModes: [
      { name: "Standard", dmg: 6, hits: 1, spCost: 0 },
      { name: "ARC88", dmg: 2, hits: 4, spCost: 2 },
      { name: "AKVolt Shot", dmg: 5, hits: 2, spCost: 1 },
      { name: "ThunderRPG", dmg: 10, hits: 1, spCost: 3 },
    ],
    // Spraying Thunder: rake the three CLOSEST opponents with the current weapon.
    // Was the row directly ahead, which meant an enemy line arranged as a column
    // — or simply standing anywhere but that one row — took nothing at all.
    special: {
      name: "Spraying Thunder",
      cost: 3,
      handler: "sprayWeapon",
      // `closest` is for the PREVIEW, not the handler — specialTargets mirrors it
      // (rules.ts) to sort by distance and slice to `targets`, so the on-board
      // highlight shows the three that will actually be hit. Without it the
      // preview lights up every reachable foe and over-reports, which it did for
      // the row-ahead version too.
      params: { targets: 3, closest: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Attack the 3 closest opponents using the current Basic Attack Weapon.",
    },
  },

  // ───────────────── GALE roster fill (bring GALE to parity) ─────────────────
  {
    id: "gale_gastly",
    name: "Gastly",
    rarity: "rare",
    element: "GALE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 8,
    sp: 5,
    shields: 0,
    keywords: {},
    // Fade (On Summon): gain STEALTH for 1 round.
    //
    // 2 -> 1. Two rounds of untargetable on a cheap body meant it arrived, was
    // ignored for the whole ramp, and was still hidden when the board filled.
    // One round is the head start the card is for.
    passiveNames: { onSummon: "Fade" },
    onSummon: { selfStatus: "STEALTH", selfStatusDuration: 1 },
  },
  {
    id: "gale_swillow",
    name: "Swillow",
    rarity: "rare",
    element: "GALE",
    cardClass: "Assassin",
    attackType: "Ranged",
    cost: 1,
    dmg: 4,
    hits: 1,
    hp: 3,
    sp: 8,
    shields: 0,
    tribe: "Avian",
    keywords: { FLYING: true },
    // Gusta Burst (On Summon): deal 4 DMG to the nearest opponent.
    passiveNames: { onSummon: "Gusta Burst" },
    onSummon: { handler: "strike", params: { dmg: 4, reachNearest: 1 }, targetSide: "enemy" },
  },
  {
    id: "gale_megair",
    name: "Megair",
    rarity: "rare",
    element: "GALE",
    cardClass: "Mage",
    attackType: "Ranged",
    // Cost 2 with SP 8: the extra gold buys 5 points of budget and 4 go straight
    // into speed. 3×2 + 5 HP + 8 SP = 19 against a cost-2 budget of 20.
    cost: 2,
    dmg: 3,
    hits: 2,
    hp: 5,
    sp: 8,
    shields: 0,
    keywords: {},
    // Mega Push: while below 3 HP, a landed basic also deals 3 to every opponent
    // and pushes them all back 2.
    passiveNames: { lowHpNova: "Mega Push" },
    lowHpNova: { belowHp: 3, dmg: 3, push: 2 },
  },
  {
    id: "gale_wailverine",
    name: "Wailverine",
    rarity: "rare",
    element: "GALE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 16,
    sp: 4,
    shields: 0,
    keywords: {},
    // Twisted Rush (end of EVERY round): gore the enemy directly ahead for 3;
    // if it dies, Wailverine takes its slot. Was a one-off 6 on its first round
    // only — the same total against a single body, but a standing threat that
    // keeps pushing rather than a single opening lunge.
    passiveNames: { roundTick: "Twisted Rush" },
    roundTick: { pokeAheadAdvance: 3 },
  },
  {
    id: "gale_vvulture",
    name: "Vulture",
    tribe: "Avian",
    rarity: "epic",
    element: "GALE",
    cardClass: "Tank",
    // MELEE now, not Ranged. A scavenger should have to come down to the body —
    // and FLYING is gone too, so it stays down once it lands. A Tank that melee
    // could not touch was the wrong shape: soaking hits is the whole job, and
    // FLYING made it the one body on the board that could not be swung at.
    attackType: "Melee",
    // Cost 3 -> 4, with the body raised to match. The budget rule is
    // total = 5*cost + 10 (shields count 2), so cost 4 wants ~30 and the old
    // 2/15/6/1 was built for 3. Raising the cost alone would have left it a
    // Cost-3 card charging Cost-4 — the stat-formula test catches exactly that.
    cost: 4,
    dmg: 3,
    hits: 1,
    hp: 17,
    sp: 7,
    shields: 2,
    keywords: {},
    // Salvage: any card's death grants +2 max HP. Carrion Feast (On Kill): +1 DMG.
    //
    // The two used to SHARE the name "Salvage", so the card printed two passives
    // called the same thing with different effects — one about anything dying,
    // one about this card killing. They are different triggers and now read as
    // different abilities.
    passiveNames: { salvageOnDeath: "Salvage", onKill: "Carrion Feast" },
    salvageOnDeath: 2,
    salvageMax: 5, // +10 HP at most, not +2 for every body that falls all game
    onKill: { buffDmg: 1 },
    // Roosting Wing Shield: gain 5 shields and heal +5.
    special: {
      name: "Roosting Wing Shield",
      // 1 -> 2 magic: 5 shields plus a 5 heal on a Tank is a real turn now that
      // the body behind it is a Cost-4 body.
      cost: 2,
      handler: "grantShield",
      params: { amount: 5, heal: 5 },
      targetSide: "self",
      text: "Gain 5 shields and heal +5 HP.",
    },
  },
  {
    id: "gale_klouy",
    name: "Spindrift",
    rarity: "rare",
    element: "GALE",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 3,
    dmg: 2,
    hits: 2,
    hp: 10,
    sp: 9,
    shields: 1,
    keywords: {},
    // Twister: a second basic hit on a target within a round STUNs it 1 round.
    // Cut from 2. At 2 the stun always cost the victim a whole action and often
    // two — a 3-cost Rare locking a Mythic out of the game for a third of a
    // battle. At 1 it costs them the action they had left in the round Spindrift
    // hit them in, which is the round Spindrift paid for.
    passiveNames: { onHitStatus: "Twister" },
    onHitStatus: { kind: "STUN", duration: 1, power: 0, onSecondHit: true },
    // Spiraling Windrow, now a Talent: free, once per game — the Rare pattern.
    // Same shot, same bounces; what changes is that it fires once instead of
    // every few rounds for magic.
    talent: {
      name: "Spiraling Windrow",
      handler: "spiral",
      params: { dmg: 5, bounces: 3 },
      text: "Once per game, free: deal 5 DMG bouncing between opponents within 1 space of each other.",
    },
  },

  // ───────────────── COST-6 LEGENDARIES (grid fill) ─────────────────
  {
    id: "leaf_efy",
    name: "Sylvane",
    rarity: "legendary",
    element: "LEAF",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 6,
    dmg: 6,
    hits: 1,
    hp: 20,
    sp: 11,
    shields: 2,
    keywords: {},
    tribe: "Grove",
    // Nature's Protection (End of Round): refresh Sylvane's shields back up to 2.
    // Shared Grove (Aura): LEAF allies are topped up +1 shield each round too.
    passiveNames: { refreshShieldsTo: "Nature's Protection", aura: "Shared Grove" },
    roundTick: { refreshShieldsTo: 2 },
    aura: { scope: "element", shields: 1 },
    // Emergence: raise an Elephlora in an adjacent slot (it marches forward,
    // drops fruit, and heals allies each round).
    special: {
      name: "Emergence",
      // 4 -> 3. Emergence is Sylvane's whole reason to be a Warrior standing in
      // the line: it buys a body AND a team heal, but at 4 it competed with
      // simply holding magic for a round, and a card that wants to cast every
      // few rounds should be able to.
      cost: 3,
      handler: "spawn",
      // No `radius`. It was 1, which is a HARD tether: `spawnTokens` searches
      // only the 8 slots around the caster and gives up if none are free.
      // Sylvane is a melee Warrior standing in the line, so crowded neighbours
      // are its normal state — the exact shape that was eating Zipp's Drone.
      // Omitting radius keeps adjacency as the PREFERENCE and then opens the
      // search to the rest of the board, so a cast always raises something.
      params: { token: "leaf_walking_tree", count: 1, healAllies: 4 },
      targetSide: "self",
      text: "Spawn an Elephlora in an adjacent slot and heal all allies 4; each round the tree marches forward, hits an opponent for 3, and heals an ally 3.",
    },
  },
  {
    id: "leaf_season",
    name: "Evera",
    rarity: "legendary",
    element: "LEAF",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 7,
    dmg: 4,
    hits: 2,
    hp: 25,
    // 10 -> 7. Grounded roots the FASTEST opponent, so Evera at 10 SP was
    // usually acting before the card she was about to pin and taking the first
    // shot as well. At 7 the root still lands, but she is no longer quicker
    // than most of what she is answering.
    sp: 12,
    shields: 0,
    keywords: {},
    // Grounded (End of Round): ROOT the fastest opponent 2 rounds. Aura: heal all
    // LEAF allies +4 each round.
    passiveNames: { rootFastest: "Grounded", roundHealElement: "Evera's Bloom" },
    roundTick: { rootFastest: 2, roundHealElement: { element: "LEAF", amount: 4 } },
    // Spiraling Root Coil: ROOT up to 4 in the adjacent row for 3 rounds NOW; the
    // roots creep on to ROOT up to 4 in the far row for 2 rounds NEXT round.
    // The far-row duration was 1, which was a no-op: the delayed roots are
    // applied early in Cleanup, BEFORE the status tick, so a 1-round root was
    // stripped by the same Cleanup that laid it and never reached a Prep.
    special: {
      name: "Spiraling Root Coil",
      cost: 4,
      handler: "barrage",
      params: { dmg: 0, rowAhead: 1, targets: 4, statusKind: "ROOT", statusDuration: 3, farRowRootNext: 1, farRowRootCount: 4, farRowRootDuration: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "ROOT up to 4 opponents in the adjacent row for 3 rounds. Next round, ROOT up to 4 in the far row for 2 rounds.",
    },
  },
  {
    id: "leaf_nightshade",
    name: "Nightshade",
    rarity: "legendary",
    element: "LEAF",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 7,
    dmg: 6,
    hits: 3,
    hp: 19,
    sp: 9,
    shields: 0,
    keywords: { CRIT: true },
    // Poisonous Roots (Aura): ROOTed opponents take POISON 3 (DOT) each round
    // until unrooted.
    passiveNames: { rootedStatus: "Poisonous Roots" },
    roundTick: { rootedStatus: { kind: "DOT", duration: 3, power: 3 } },
    // Night Bloom: POISON 3 (DOT) to all opponents for 3 rounds.
    special: {
      name: "Night Bloom",
      cost: 3,
      handler: "statusNova",
      params: { statusKind: "DOT", statusDuration: 3, statusPower: 3, targets: 99 },
      targetSide: "enemy",
      ranged: true,
      text: "Apply POISON 3 (DOT) to all opponents for 3 rounds.",
    },
  },
  {
    id: "leaf_rubyo",
    name: "Rubyscale",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Warrior",
    // Cost 5. Every other card that spawns a REAL card on summon pays multiples
    // of what it gives away — Trinezer 9 for 3, Keeper 6 for 2, Sway 3 for 1 —
    // and Rubyscale hands over a whole Greegon, which is 27 points of its own
    // and switches on this card's +8 Special rider besides. The gold is where
    // that is paid for; the printed line is deliberately short of the budget.
    attackType: "Melee",
    cost: 5,
    dmg: 6,
    hits: 1,
    hp: 12,
    sp: 8,
    shields: 2,
    keywords: {},
    tribe: "Dragon",
    // Dragon's Fury (tribe trait): every kill is +1 DMG, permanently.
    onKill: { buffDmg: 1 },
    // Bloodscale: its basic opens a wound. BLEED 2 for 2 rounds, the same cut
    // Stickviper makes — Greegon's Bramble is the weaker version of the same
    // idea, which is the right way round for the dragon and the sapling it
    // plants.
    passiveNames: { onKill: "Dragon's Fury", summonSpawn: "Ancient Protection", onHitStatus: "Bloodscale" },
    onHitStatus: { kind: "BLEED", duration: 2, power: 2 },
    // Ancient Protection (On Summon): spawn Greegon (the existing card) in an
    // adjacent slot. Dragon's Dance then adds an 8-DMG blow while Greegon lives.
    summonSpawn: { token: "leaf_greegon", count: 1 },
    // Dragon's Dance: 1 → 2 → 4 DMG split across up to 3 targets, gain +3 SP for
    // the round, and +8 DMG to a foe while Greegon stands.
    special: {
      name: "Dragon's Dance",
      cost: 3,
      handler: "dragonDance",
      params: { d1: 1, d2: 2, d3: 4, sp: 3, greegonBonus: 8, greegonToken: "leaf_greegon" },
      targetSide: "enemy",
      text: "Deal 1, then 2, then 4 DMG (split across up to 3 targets) and gain +3 SP. While Greegon lives, also deal 8 to an opponent.",
    },
  },
  {
    id: "aqua_siren",
    name: "Siren",
    rarity: "legendary",
    element: "AQUA",
    cardClass: "Mage",
    attackType: "Ranged",
    // Cost 7 with no stat bump (Total 40 vs the Cost-7 budget of 45) — the
    // transform-into-Krakler kit carries the missing value. Stat exception.
    cost: 7,
    dmg: 2,
    hits: 4,
    hp: 17,
    sp: 13,
    shields: 1,
    keywords: {},
    tribe: "SeaC",
    // Siren Song (On Hit): FREEZE the attacker for 1 round.
    passiveNames: { onHitByMelee: "Siren Song" },
    onHitByMelee: { anyAttacker: true, status: { kind: "FREEZE", duration: 1, power: 0 } },
    // Sea Terror: transform into Krakler (9/8/SP8). Krakler's Abyssal Grasp fires
    // on the change (SCALD 3 + FREEZE a foe); when Krakler dies, Siren returns at
    // full HP.
    special: {
      name: "Sea Terror",
      cost: 4,
      handler: "transform",
      params: { into: "aqua_krakler" },
      targetSide: "self",
      text: "Transform into Krakler (9/8/SP8), applying SCALD 3 + FREEZE. When Krakler dies, revert to Siren at full HP.",
    },
  },
  {
    id: "aqua_rain",
    name: "Cloudburst",
    rarity: "legendary",
    element: "AQUA",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 6,
    dmg: 10,
    hits: 1,
    hp: 19,
    sp: 11,
    shields: 0,
    keywords: {},
    tribe: "Liquid",
    // Rainstorm: Cloudburst's own basics splash 1 DMG to EVERY opponent adjacent
    // to the target. Downpour: while it lives, every ally's basic splashes 1 to
    // every adjacent opponent too — the same storm, handed to the team, at chip
    // value. `splashAll` is what widens both; without it each would find only
    // the first neighbour, which is rain falling on one square.
    //
    // Rainstorm was 2. Widening the splash from one neighbour to all of them is
    // most of a formation's worth of chip on a packed board, so the per-target
    // number came down to pay for the coverage: a surrounded card now takes 2
    // (1 + 1) from Cloudburst's own basic rather than 3.
    //
    // It was `true`, i.e. a second FULL basic hit for the whole team. On
    // Cloudburst itself that stacked with Rainstorm onto the same neighbour: a
    // 10-damage basic put 10 + 2 = 12 on the card next to the target, more than
    // it dealt to the thing it aimed at. The team keeps the reach; the damage is
    // a chip.
    passiveNames: { basicSplash: "Rainstorm", splashAura: "Downpour" },
    basicSplash: 1,
    splashAura: 1,
    splashAll: true,
    // Scoped 50GAL: scope in — the next basic shot spreads across up to 3
    // targets (range = extra shots, replacing the deleted +2 RANGE).
    special: {
      name: "Scoped 50GAL",
      cost: 3,
      handler: "scopeUp",
      params: { hits: 2 },
      targetSide: "self",
      text: "Your next basic attack fires 3 shots and can aim across up to 3 opponents.",
    },
  },
  {
    id: "aqua_driftwraith",
    name: "Driftwraith",
    rarity: "legendary",
    element: "AQUA",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 6,
    dmg: 9,
    hits: 1,
    hp: 14,
    sp: 11,
    shields: 3,
    keywords: { STEALTH: true },
    // Deep Creatures and SeaC both replaced by Pirate. "Deep Creatures" was read
    // by nothing at all, so dropping it is free; SeaC costs it Kraken's +4 max
    // HP the same way it costs BlackBeard.
    tribe: ["Pirate", "Vapor"],
    // Perpetual Fog (On Kill): cloak Driftwraith and same-row AQUA allies in
    // STEALTH for 1 round.
    // On a kill the fog closes around it: EVASION for 2 rounds, itself only.
    //
    // It used to grant STEALTH for 1 round to itself and its same-row AQUA kin —
    // and the self half was very nearly a no-op, because Driftwraith PRINTS the
    // STEALTH keyword permanently. A dodge window is something it does not
    // already have. The same-row cloak is what this gives up.
    passiveNames: { onKill: "Perpetual Fog" },
    onKill: { grantEvasion: 2 },
    // Boneyard Ambush: 14 DMG PEN to an opponent in range.
    special: {
      name: "Boneyard Ambush",
      cost: 3,
      handler: "barrage",
      params: { dmg: 14, targets: 1, pen: 1 },
      targetSide: "enemy",
      text: "Break stealth to deal 14 DMG (PEN) to an opponent.",
    },
  },
  {
    id: "dawn_leo",
    name: "Leo",
    rarity: "legendary",
    element: "DAWN",
    cardClass: "Warrior",
    tribe: "Suns",
    attackType: "Melee",
    cost: 7,
    dmg: 7,
    hits: 1,
    hp: 25,
    sp: 7,
    shields: 2,
    keywords: {},
    // King of the Wild (On Opp Summon, once/round): gain +2 shields and +1 DMG
    // for the round.
    passiveNames: { onOppSummonSelfBuff: "King of the Wild" },
    onOppSummonSelfBuff: { shields: 2, dmg: 1 },
    // Golden Guardian: +5 HP every round for 7 rounds.
    special: {
      name: "Golden Guardian",
      cost: 3,
      handler: "regenBuff",
      params: { rounds: 7, power: 5 },
      targetSide: "self",
      cooldown: 5,
      text: "Gain +5 HP every round for 7 rounds.",
    },
  },
  {
    id: "dawn_aurora",
    name: "Aurora",
    rarity: "legendary",
    element: "DAWN",
    cardClass: "Mage",
    attackType: "Ranged",
    // 15 + 17 + 6 + 12 = 50, exactly the cost-8 budget.
    cost: 8,
    dmg: 3,
    hits: 5,
    hp: 17,
    sp: 12,
    shields: 3,
    keywords: {},
    tribe: "Stars",
    // Stars (Aura): the constellation it leads fights faster and harder — DAWN's
    // back half, the Assassins, Mages and Rangers. Equestrian leads the front
    // half (Tanks, Warriors, Supports) as Suns; the comment there explains why
    // the element is split down class lines.
    // Life Cycle: each incoming hit is absorbed by a Light Orb that then bursts
    // at the attacker (blue: 3 DMG + BLIND 2 · green: 2 DMG + heal weakest ally 7
    // · red: POISON 2). An opponent's death recharges one orb.
    passiveNames: { lightOrbs: "Life Cycle", aura: "Stars" },
    aura: { scope: "tribe", match: "Stars", dmg: 1, sp: 2 },
    lightOrbs: true,
    // Light Orb Creation: conjure the three orbs.
    special: {
      name: "Light Orb Creation",
      cost: 3,
      handler: "spawnOrbs",
      params: {},
      targetSide: "self",
      text: "Conjure 3 Light Orbs — blue (3 DMG + BLIND 2), green (2 DMG + heal weakest ally 7), red (POISON 2). Each absorbs one incoming hit, then bursts at the attacker.",
    },
  },
  {
    id: "bolt_shock",
    name: "Blackout",
    rarity: "legendary",
    element: "BOLT",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 7,
    dmg: 2,
    hits: 5,
    hp: 22,
    sp: 13,
    shields: 0,
    keywords: {},
    // Amplifier (On Summon): 5 DMG CRIT to a foe. On Kill: +1 DMG for the round.
    // Power Grid (aura): PARALYZE every opponent under 4 HP each round.
    passiveNames: { onSummon: "Amplifier", onKill: "Overcharge", paralyzeLowHp: "Power Grid" },
    onSummon: { handler: "strike", params: { dmg: 5, crit: 1, reachNearest: 1 }, targetSide: "enemy" },
    onKill: { buffDmgRound: 1 },
    roundTick: { paralyzeLowHp: { underHp: 4, rounds: 1 } },
    // Fryer: 4×1 DMG to all opponents, +1 vs PARALYZED, and MUTED 1 round — the
    // surge takes their lights out, so nothing struck can fire a Special next
    // round. Recomputed per target so Overcharge (earned on a kill mid-Fryer)
    // boosts the opponents struck after.
    special: {
      name: "Fryer",
      cost: 4,
      handler: "fryer",
      params: { dmg: 4, hits: 1, paralyzeBonus: 1, mute: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 4 DMG to all opponents and MUTE them for 1 round; PARALYZED opponents take +1 DMG.",
    },
  },
  {
    id: "bolt_rodd",
    name: "Rodd",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 1,
    dmg: 0,
    hits: 1,
    hp: 7,
    sp: 0,
    shields: 4,
    keywords: {},
    // Conduction: adjacent BOLT allies (of the 8 surrounding slots) gain +1 DMG.
    // Arc (End of Round): 2 DMG to the closest opponent. A fixed pylon — SP 0,
    // never moves.
    //
    // BOLT only. A conduit powers the grid it belongs to; buffing whatever
    // happened to stand next to it made Rodd a colourless +1 for any deck that
    // could afford a 1-cost body, which is not what a pylon is for.
    passiveNames: { aura: "Conduction", roundTick: "Arc" },
    aura: { scope: "adjacent", dmg: 1, element: "BOLT" },
    roundTick: { pokeDmg: 2 },
  },
  {
    id: "bolt_zipp",
    name: "Zipp",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 1,
    // 3 + 3 + 1*2 + 7 = 15 = 5*1+10, exactly, from 16 at SP 8. The point comes
    // off the legs and costs nothing that shows: moveReach is 2 anywhere above
    // SP_SLOW_MAX (5), so 8 and 7 are the same two-step body. What it buys is
    // the middle of the band instead of the edge of it — room to give this card
    // something later without the curve refusing it.
    dmg: 3,
    hits: 1,
    hp: 3,
    sp: 7,
    shields: 1,
    keywords: {},
    // ARC, not Forged Tech: every other Forged Tech card is PYRO, and Zipp
    // builds ARC's own drones. Picks up Jack Arc's Overclock (+2 SP).
    tribe: "ARC",
    // Swarm Deploy (On Summon): pop a 1/1 FLYING Drone out beside it.
    //
    // No `radius`. It used to be 1, which is a HARD tether: `spawnTokens` only
    // searches the 8 slots around the spawner and gives up if none are free.
    // Zipp lands in the home row, which is exactly where a board gets crowded,
    // so the Drone silently failed to appear whenever its neighbours were full.
    // Omitting radius keeps the adjacent ring as the PREFERENCE and then opens
    // the search to the rest of the board, so the promise on the card is kept.
    passiveNames: { onSummon: "Swarm Deploy" },
    onSummon: { handler: "spawn", params: { token: "bolt_drone_tok", count: 1 } },
  },
  {
    id: "bolt_volta",
    name: "Volta",
    tribe: "ARC",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 5,
    dmg: 4,
    hits: 1,
    hp: 19,
    sp: 6,
    shields: 3,
    keywords: {},
    // Relay Network (On Summon): deploy a Rodd immediately. Overcharge: basics
    // gain PEN while any allied Rodd stands.
    //
    // No `radius` on either spawn. It was 1, a HARD tether: `spawnTokens`
    // searches only the 8 slots around the caster and gives up if none are
    // free. Volta is a Support that sits behind its own line, so its neighbours
    // are its own team and being boxed in is its normal state — and Overcharge
    // keys off a Rodd STANDING, so a failed deploy quietly costs the passive
    // too. Omitting radius keeps adjacency as the preference and then opens the
    // search to the rest of the board.
    passiveNames: { onSummon: "Relay Network", penWhileAlly: "Overcharge" },
    onSummon: { handler: "spawn", params: { token: "bolt_rodd", count: 1 } },
    penWhileAlly: ["bolt_rodd"],
    // Grid Deployment: deploy another Rodd into an adjacent open slot.
    special: {
      name: "Grid Deployment",
      cost: 3,
      handler: "spawn",
      params: { token: "bolt_rodd", count: 1 },
      targetSide: "self",
      text: "Deploy a Rodd (0/7/4🛡 · Conduction, Arc) into an open slot beside it, or the nearest free one if it is boxed in.",
    },
  },
  {
    id: "bolt_jack_arc",
    name: "Jack Arc",
    rarity: "legendary",
    element: "BOLT",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 6,
    dmg: 2,
    hits: 3,
    hp: 16,
    sp: 12,
    shields: 3,
    keywords: {},
    tribe: "ARC",
    // Static Electricity (each round): PARALYZE an un-paralyzed opponent 2r.
    // Overclock aura: ARC allies gain +2 SP.
    passiveNames: { roundTick: "Static Electricity" },
    roundTick: { paralyzeOne: 2 },
    aura: { scope: "tribe", match: "ARC", sp: 2 },
    // StunGun: 4 DMG + PARALYZE 3 rounds to 3 targets.
    special: {
      name: "StunGun",
      cost: 3,
      handler: "barrage",
      params: { dmg: 4, targets: 3, statusKind: "PARALYZE", statusDuration: 3 },
      targetSide: "enemy",
      ranged: true,
      text: "Blast 3 targets for 4 DMG and PARALYZE them for 3 rounds.",
    },
  },
  {
    id: "bolt_zoez",
    name: "Voltedge",
    rarity: "legendary",
    element: "BOLT",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 6,
    dmg: 7,
    hits: 1,
    hp: 19,
    sp: 14,
    shields: 0,
    keywords: {},
    // Striking Defense: immune to Ranged attacks; a melee attacker takes 3 back.
    passiveNames: { onHitByMelee: "Striking Defense", blocksRangedChance: "Striking Defense" },
    // 50, not 100. At 100 this was TOTAL permanent immunity to every attack from
    // every Ranged card in the game, on a card sitting exactly on budget. The
    // only other holder of this passive, Rhyolite, runs it at 50 AND pays 2 stat
    // points for it.
    blocksRangedChance: 50,
    onHitByMelee: { dmg: 3 },
    // Razr Lightning Bladerang: 7 DMG to a target + a 7-power DOT for 1 round.
    special: {
      name: "Razr Lightning Bladerang",
      cost: 2,
      handler: "barrage",
      params: { dmg: 7, targets: 1, statusKind: "DOT", statusPower: 7, statusDuration: 1 },
      targetSide: "enemy",
      text: "Hurl the bladerang for 7 DMG to a target and apply a 7-DOT for 1 round.",
    },
  },
  {
    id: "pyro_aftermath",
    name: "Aftermath",
    rarity: "legendary",
    element: "PYRO",
    cardClass: "Support",
    attackType: "Ranged",
    // 2x3 + 20 + 2 + 12 = 40, exactly the cost-6 budget. Rebuilt off the single
    // 29 HP body it was: the same points, spent on a second swing, armour and
    // twelve speed instead of a wall of HP, which is what a Ranged Support that
    // opens with a two-row blast and then wants to cast Smog is actually doing.
    cost: 6,
    dmg: 3,
    hits: 2,
    hp: 20,
    sp: 12,
    shields: 1,
    keywords: {},
    // Explosion (On Summon): 5 DMG to the adjacent row and 3 to the row beyond.
    passiveNames: { onSummon: "Explosion" },
    onSummon: { handler: "barrage", params: { dmg: 5, rowAhead: 1, targets: 99, farRowDmg: 3 }, targetSide: "enemy" },
    // Smog: lay a smoke screen — attacks on Aftermath's team start to whiff.
    special: {
      name: "Smog",
      cost: 4,
      handler: "smokeScreen",
      params: { rounds: 2 },
      targetSide: "self",
      text: "Blanket your side in smoke for 2 rounds — attacks on your cards may miss.",
    },
  },
  {
    id: "pyro_dynomight",
    name: "Dynomight",
    rarity: "legendary",
    element: "PYRO",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 6,
    dmg: 9,
    hits: 1,
    hp: 20,
    sp: 11,
    shields: 0,
    keywords: {},
    tribe: "Forged Tech",
    // Explosive Power: basic attacks deal 2× damage vs a shielded target OR vs a
    // Warrior/Tank.
    passiveNames: { bonusVsShield: "Explosive Power" },
    bonusVsShield: 2,
    bonusVsClass: { classes: ["Warrior", "Tank"], mult: 2 },
    // Grand Finally: 6 DMG to the adjacent row and 4 DMG to the rest; Dynomight
    // loses 2 HP.
    special: {
      name: "Grand Finally",
      cost: 4,
      handler: "grandFinally",
      params: { nearDmg: 6, farDmg: 4, selfDamage: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 6 DMG to opponents in the adjacent row and 4 DMG to the rest. Dynomight loses 2 HP.",
    },
  },
  {
    id: "gale_eagon",
    name: "Eagon",
    rarity: "legendary",
    element: "GALE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 7,
    dmg: 9,
    hits: 1,
    hp: 25,
    // Traded its 2 shields straight across for +4 SP — a GALE flier should be
    // fast rather than armoured, and 4 shield-points = 4 SP keeps it on budget.
    sp: 11,
    shields: 0,
    // FLYING, and the movement half is already paid for: SP 11 clears
    // SP_MID_MAX, so Eagon ALREADY moved like a king and cut corners. What this
    // actually buys is the melee immunity and a clear path — no enemy body
    // blocks its two-step move, and it crosses walls instead of setting them
    // off. On a 9-DMG Melee Warrior that is the difference between a threat that
    // can be screened and one that cannot.
    keywords: { FLYING: true },
    tribe: ["Dragon", "Avian"],
    // Dragon's Fury (tribe trait): every kill is +1 DMG, permanently.
    onKill: { buffDmg: 1 },
    // Vision Guard (On Hit): 50% chance to deflect — take half, deal half back.
    passiveNames: { onKill: "Dragon's Fury", onHitDeflect: "Vision Guard" },
    onHitDeflect: 50,
    // Dark Wind Wave: 5 DMG to the far row, shoving survivors toward the near row.
    special: {
      name: "Dark Wind Wave",
      cost: 3,
      handler: "barrage",
      // `pull`, not `push`: every target of this Special is standing on its own
      // home row, and pushBack only ever moves a card TOWARD its own home — so
      // the push displaced nothing, on every cast, and pointed the wrong way
      // besides. See applyDebuffRiders.
      params: { dmg: 5, enemyHomeRow: 1, targets: 99, pull: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 5 DMG to opponents in the far row, pushing them toward the near row.",
    },
  },
  {
    id: "gale_totem",
    name: "Totem",
    rarity: "legendary",
    element: "GALE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 6,
    dmg: 6,
    hits: 1,
    hp: 23,
    sp: 11,
    shields: 0,
    keywords: { FLYING: true },
    tribe: ["Avian", "Wolf"],
    // Totem Spirit (Aura): while Totem lives, allied basic attacks cannot miss,
    // and they see through STEALTH and through the Home-Slot rule ("invasion
    // blind"). It used to hand the team an extra splash target; the aura is now
    // about ACCURACY, which is what a totem watching over a war band should do.
    passiveNames: { totemSpiritAura: "Totem Spirit" },
    totemSpiritAura: true,
    // Raise the Totem Pole (On Summon): plant a Pole that scorches the row ahead.
    summonSpawn: { token: "gale_totem_pole", count: 1 },
    // Rampage: one extra BASIC hit for 3 rounds. On a 6-DMG single-hit body that
    // is a doubled basic while it runs, rather than the +1 DMG it granted before.
    special: {
      name: "Rampage",
      cost: 2,
      handler: "empower",
      params: { selfHits: 1, buffRounds: 3 },
      targetSide: "self",
      text: "Gain 1 basic attack hit for 3 rounds.",
    },
  },
  {
    id: "bore_diam",
    name: "Adamant",
    rarity: "legendary",
    element: "BORE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 7,
    dmg: 8,
    hits: 1,
    hp: 14,
    sp: 11,
    shields: 6,
    keywords: {},
    // Diamond Kingdom (Aura): BORE allies gain +1 shield; when a BORE ally
    // falls, the lowest-HP survivor is hardened with a one-round BLOCK 2.
    aura: { scope: "element", shields: 1 },
    passiveNames: { blockOnAllyDeath: "Diamond Kingdom" },
    blockOnAllyDeath: { block: 2, rounds: 1, element: "BORE" },
    // Adamantize: harden the whole team's armour — every ally gains BLOCK 2 for
    // two rounds (stacks with their own BLOCK).
    special: {
      name: "Adamantize",
      cost: 4,
      handler: "diamallize",
      params: { block: 2, rounds: 2 },
      targetSide: "self",
      text: "Harden allies' armor — each ally gains BLOCK 2 for 2 rounds.",
    },
  },
  {
    id: "bore_score",
    name: "Venomarch",
    rarity: "legendary",
    element: "BORE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 6,
    dmg: 2,
    hits: 3,
    hp: 12,
    sp: 12,
    shields: 5,
    keywords: {},
    tribe: "Cavernous",
    // Sand Trap (On Hit by melee): infect the attacker (SLEEP). On Death: leave
    // the killer poisoned. Toxic Contagion: Venomarch's own basics spread POISON.
    passiveNames: { onHitByMelee: "Sand Trap", onDeath: "Sand Trap", onHitStatus: "Toxic Contagion" },
    onHitByMelee: { status: { kind: "SLEEP", duration: 2, power: 0 } },
    onDeath: { dmg: 0, killerStatus: { kind: "DOT", duration: 2, power: 3 } },
    onHitStatus: { kind: "DOT", duration: 2, power: 2 },
    // Toxic Contagion: SLEEP a target and apply POISON 3 for 2 rounds. If it
    // dies while still poisoned, the body bursts for 3 to everything adjacent.
    special: {
      name: "Toxic Contagion",
      cost: 3,
      handler: "toxicContagion",
      params: { sleep: 1, dotDuration: 2, dotPower: 3, deathSplash: 3 },
      targetSide: "enemy",
      ranged: true,
      text: "SLEEP a target and apply POISON 3 (DOT) for 2 rounds. If it dies while poisoned, it bursts for 3 DMG to every adjacent card.",
    },
  },
  {
    id: "dusk_scar",
    name: "Vesper",
    rarity: "legendary",
    element: "DUSK",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 6,
    dmg: 6,
    hits: 1,
    hp: 23,
    sp: 11,
    shields: 0,
    keywords: { FLYING: true, DRAIN: true },
    tribe: "Vamp",
    // Blood Mending: basic attacks DRAIN (lifesteal). Blood Moon (Aura): when an
    // opponent dies, heal Vesper and its allies +1.
    passiveNames: { deathHealAura: "Blood Moon" },
    deathHealAura: 1,
    // Moon Frenzy: 3 DMG to all opponents, draining from each (DUSK lifesteal).
    special: {
      name: "Moon Frenzy",
      cost: 3,
      handler: "barrage",
      // SEAL on top of DRAIN, and the pairing is the point: DRAIN moves HP from
      // them to the caster, and SEAL stops them putting it back. Draining a
      // board that can simply heal through it is a wash; draining a sealed board
      // is permanent for two rounds.
      params: { dmg: 3, targets: 99, drain: 1, statusKind: "SEAL", statusDuration: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "Attack all opponents for 3 DMG, DRAIN from each, and SEAL them for 2 rounds (they cannot be healed).",
    },
  },

  // ───────────────── COST-7 LEGENDARIES (grid fill) ─────────────────
  {
    id: "leaf_warden",
    name: "Hartwood",
    rarity: "legendary",
    element: "LEAF",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 8,
    dmg: 9,
    hits: 1,
    hp: 28,
    sp: 5,
    shields: 4,
    keywords: {},
    tribe: "Grove",
    // Overwatch: when an ally is killed, answer the killer with 7 DMG (once per
    // round).
    passiveNames: { onAllyKilled: "Overwatch" },
    onAllyKilled: { dmg: 7, oncePerRound: true },
    // Justice: 2×4 DMG (PEN) to all opponents in range, draining from them.
    special: {
      name: "Justice",
      // 4 magic, not 2. `hits` is PER TARGET, so this is 8 shield-piercing damage
      // to every body in reach plus permanent max-HP theft — 12 damage per magic
      // against three targets, which is the exact figure this file's own comment
      // on Ghastly calls the highest in the game and nerfs. The cost-7 rung's
      // other area Specials pay 4 magic for a third to two-thirds as much, and
      // none of them pierce.
      //
      // Price rather than target cap: Justice is melee-gated to the king square
      // already, so capping targets would over-correct AND contradict its own
      // printed "all opponents in range".
      cost: 4,
      handler: "barrage",
      params: { dmg: 2, hits: 4, targets: 99, pen: 1, drain: 1 },
      targetSide: "enemy",
      text: "Deal 2×4 DMG (PEN) to all opponents in range and drain from them.",
    },
  },
  {
    id: "gale_kloud",
    name: "Kloud",
    rarity: "legendary",
    element: "GALE",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 7,
    dmg: 6,
    hits: 2,
    hp: 23,
    sp: 10,
    shields: 0,
    keywords: {},
    // Storm Surge (End of Round): 2 DMG to the closest opponent. Aura: Mage AND
    // Ranger allies gain +1 basic DMG.
    passiveNames: { roundTick: "Storm Surge" },
    roundTick: { pokeDmg: 2 },
    aura: { scope: "class", match: "Mage", dmg: 1 },
    auras: [{ scope: "class", match: "Ranger", dmg: 1 }],
    // Twisted Rage: a 4 → 6 → 8 → 10 chain across adjacent opponents.
    special: {
      name: "Twisted Rage",
      cost: 5,
      handler: "combo",
      params: { hits: 4, dmg: 4, ramp: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "Chain 4 → 6 → 8 → 10 DMG across adjacent opponents.",
    },
  },
  {
    id: "bolt_gigavolt",
    name: "GigaVolt",
    rarity: "legendary",
    element: "BOLT",
    cardClass: "Tank",
    attackType: "Ranged",
    cost: 7,
    dmg: 0,
    hits: 1,
    hp: 35,
    sp: 0,
    shields: 5,
    keywords: {},
    tribe: "ARC",
    // Power Up (End of Round): +1 DMG. On Kill: +2 shields. Aura: BOLT allies
    // +1 basic DMG. (Doc's "after 3 Power Ups" gate simplified.)
    //
    // POWER ONLY — the +1 SP a round is gone. GigaVolt is printed at SP 0 and
    // Power Up was the thing that unpinned it, so this leaves it immobile for
    // the whole game: moveReach(0) is 0. That is the card — Turret Mode is its
    // Special and a turret does not walk — but it is a real consequence, not a
    // rounding: it can never advance, never take a home slot, and never
    // contribute to the capture race that decides almost every match. It holds
    // ground and shoots, and that is all.
    passiveNames: { roundTick: "Power Up", onKill: "Power Up" },
    // Cap raised 5 -> 15. GigaVolt prints at DMG 0 and cannot move, so the cap
    // IS the card: at +5 it topped out at 5 DMG in round five and then sat
    // there for the rest of the match as a 35 HP turret that could not chase
    // anything. Fifteen rounds of winding up is a real investment on a body
    // that never takes a slot and never contributes to the capture race — the
    // payoff should be a gun worth protecting for that long.
    roundTick: { buffDmgEveryN: { n: 1, amount: 1, maxTicks: 15 } },
    onKill: { gainShields: 2 },
    aura: { scope: "element", dmg: 1 },
    // Turret Mode: lock down and open fire on the ELECTRIFIED — 3 DMG to every
    // electrified opponent, now and at the end of each round for 3 rounds.
    special: {
      name: "Turret Mode",
      cost: 5,
      handler: "turretMode",
      params: { dmg: 3, rounds: 3 },
      targetSide: "self",
      text: "ELECTRIFY all opponents, then deal 3 DMG to every Electrified opponent now and at the end of each round for 3 rounds.",
    },
  },
  {
    id: "bore_steel",
    name: "Ironclad",
    rarity: "legendary",
    element: "BORE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 8,
    dmg: 8,
    hits: 1,
    hp: 18,
    sp: 9,
    shields: 5,
    keywords: { BLOCK: 2 },
    tribe: "Dragon",
    // Dragon's Fury (tribe trait): every kill is +1 DMG, permanently.
    passiveNames: { onKill: "Dragon's Fury" },
    onKill: { buffDmg: 1 },
    // Hardened Stainless Steel: BLOCK 2 (each shield harder to break) and immune
    // to status/DOT.
    statusImmune: true,
    // Magnetic Steel: 3 DMG to ALL opponents, and strip up to 3 shields each off
    // the row directly ahead, equipping them. The theft is short-ranged (the
    // magnet only reaches the rank it stands against) while the shockwave is
    // board-wide — hence stealRowAheadOnly alongside targets 99.
    special: {
      name: "Magnetic Steel",
      cost: 5,
      handler: "barrage",
      params: { dmg: 3, targets: 99, stealShields: 3, stealRowAheadOnly: 1 },
      targetSide: "enemy",
      text: "Deal 3 DMG to all opponents, and steal up to 3 shields each from opponents in the row directly ahead and equip them.",
    },
  },
  {
    id: "dusk_hoax",
    name: "Hoax",
    rarity: "legendary",
    element: "DUSK",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 7,
    dmg: 8,
    hits: 1,
    hp: 22,
    sp: 15,
    shields: 0,
    keywords: { CRIT: true, EVASION: true },
    tribe: "ScareKrow",
    // Blur: EVASION (keyword) + when a MARKED target dies, Hoax banks a one-time
    // guaranteed dodge (next incoming attack auto-misses). Mark of Hoax brands a
    // foe so every basic against it is a guaranteed CRIT.
    special: {
      name: "Mark of Hoax",
      cost: 4,
      handler: "markTarget",
      // A LASTING seal, matching the brand it rides. The mark itself is a flag
      // with no timer — it holds until the target dies — so a 2-round seal would
      // have expired while the thing it was attached to was still on the card.
      // 99 is this codebase's idiom for "does not expire" (Velvolt Knight's Live
      // Current, Voltis' arrival volley), and card text renders it as "the rest
      // of the match" rather than printing the number.
      params: { statusKind: "SEAL", statusDuration: 99 },
      targetSide: "enemy",
      ranged: true,
      text: "Mark an opponent — every basic attack against them is a guaranteed CRIT, and they cannot be healed for the rest of the match. When a marked target dies, Blur banks a one-time auto-dodge.",
    },
  },
  {
    id: "dusk_destro",
    name: "Destro",
    rarity: "legendary",
    element: "DUSK",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 7,
    dmg: 4,
    hits: 3,
    hp: 16,
    sp: 11,
    shields: 3,
    keywords: {},
    tribe: "Ghost",
    // White Shadow (On Summon): arrives plated in shields. On Death: revives once.
    passiveNames: { summonSelfShields: "White Shadow", onRevive: "Ghost Return" },
    summonSelfShields: 3,
    onRevive: { heal: 8 },
    // Flaming Chains: DRAIN 2 max HP from all opponents and WEAKEN them 2 rounds.
    special: {
      name: "Flaming Chains",
      cost: 5,
      handler: "barrage",
      params: { dmg: 0, targets: 99, drain: 2, statusKind: "WEAKEN", statusDuration: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "DRAIN 2 max HP from all opponents and WEAKEN them for 2 rounds.",
    },
  },
  {
    id: "dawn_commander",
    name: "Sunbanner",
    rarity: "legendary",
    element: "DAWN",
    cardClass: "Tank",
    tribe: "Suns",
    attackType: "Melee",
    cost: 7,
    dmg: 6,
    hits: 1,
    hp: 17,
    sp: 7,
    shields: 7,
    keywords: {},
    // Light Mitigation (Aura): allies are topped up +1 shield each round (the
    // doc's flat −1 DMG expressed as standing armour).
    aura: { scope: "all", shields: 1 },
    // Flash Squad: order the allies beside and ahead of Sunbanner to fire their
    // basics. Magic 3 rather than 2 — the squad is roughly twice the size now,
    // and an extra free basic per body is the strongest thing a Special can
    // hand out on a board where damage is the scarce resource.
    special: {
      name: "Flash Squad",
      cost: 3,
      handler: "flashSquad",
      params: {},
      targetSide: "self",
      text: "Command allies in the same row and the row directly ahead to each use their basic attack.",
    },
  },

  // ───────────────── COST-8 LEGENDARY ─────────────────
  {
    id: "pyro_infernus_rex",
    name: "Infernus Rex",
    rarity: "legendary",
    element: "PYRO",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 8,
    dmg: 9,
    hits: 1,
    hp: 32,
    sp: 7,
    shields: 3,
    keywords: {},
    tribe: "Volcanic",
    // On Summon: BURN 2 (3r) to the adjacent row. Burning Roar (On Hit): +1 DMG
    // on a landed basic (stacking). On Kill: +2 DMG permanently. (Doc's Burning
    // Roar shield + 3-stack cap simplified to a permanent +1-DMG-on-hit.)
    // The on-kill was called "Volcanic Charge" too — the same name as the
    // Special, on a different ability. Named for what it does instead.
    passiveNames: { onSummon: "Volcanic Arrival", onHitSelfBuff: "Burning Roar", onKill: "Eruption" },
    onSummon: { handler: "barrage", params: { dmg: 0, rowAhead: 1, targets: 99, statusKind: "BURN", statusPower: 2, statusDuration: 3 }, targetSide: "enemy" },
    onHitSelfBuff: { dmg: 1, max: 5 }, // single hit, so the same ceiling Volcanon carries
    // Volcanic Charge (On Kill): +2 DMG permanently AND a 3-DMG eruption across
    // the whole enemy board.
    onKill: { buffDmg: 2, aoeDmg: 3 },
    // Volcanic Charge: charge up to 3 forward and deal 12 to the first opponent
    // hit. (Doc's on-kill 6-splash simplified; the +2-DMG-on-kill is the onKill.)
    special: {
      name: "Volcanic Charge",
      cost: 4,
      handler: "strike",
      params: { chargeFirst: 1, charge: 3, dmg: 12 },
      targetSide: "enemy",
      text: "Move up to 3 spaces forward and deal 12 DMG to the first opponent hit.",
    },
  },

  // ───────────── PARITY FILL (bring each element to 36) ─────────────
  {
    id: "leaf_splint",
    name: "Splint",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 5,
    dmg: 9,
    hits: 1,
    hp: 17,
    sp: 9,
    shields: 0,
    keywords: {},
    // Bush Dagger (On Summon): 5 to a foe. Jungle Whisper: STEALTH on kill,
    // basics BLEED 1.
    passiveNames: { onSummon: "Bush Dagger", onKill: "Jungle Whisper", onHitStatus: "Jungle Whisper" },
    onSummon: { handler: "strike", params: { dmg: 5, reachNearest: 1 }, targetSide: "enemy" },
    onKill: { grantStealth: 1 },
    onHitStatus: { kind: "BLEED", duration: 2, power: 1 },
    // Leafy Cloak: STEALTH 3 + REGEN 3 for 3 rounds.
    special: {
      name: "Leafy Cloak",
      cost: 2,
      handler: "cloak",
      params: { stealth: 3, regen: 3, regenRounds: 3 },
      targetSide: "self",
      text: "Gain STEALTH for 3 rounds and REGEN 3 for 3 rounds.",
    },
  },
  {
    id: "leaf_dande",
    name: "Dandelion",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 16,
    sp: 0,
    shields: 3,
    keywords: { REGEN: 3 },
    tribe: "Grove",
    // Super Weed: REGEN 3 each round and grows +2 max HP (it just keeps
    // spreading). Bramble: a melee attacker takes 1 back and is left with a
    // clinging thorn (DOT 1 for 2 rounds).
    passiveNames: { onHitByMelee: "Bramble", roundTick: "Super Weed" },
    roundTick: { buffDmgEveryN: { n: 1, amount: 0, hp: 2, maxTicks: 5 } },
    onHitByMelee: { dmg: 1, status: { kind: "DOT", duration: 2, power: 1 } },
    // Razor Guard: the weed lurches a space forward (it's SP 0, so this is the
    // only way it advances), THEN rakes everything in range for 3 + BLEED 1.
    special: {
      name: "Razor Guard",
      cost: 3,
      handler: "barrage",
      params: {
        dmg: 3, targets: 3, charge: 1, chargeFirst: 1,
        statusKind: "BLEED", statusPower: 1, statusDuration: 2,
      },
      targetSide: "enemy",
      text: "Move forward one space, then deal 3 DMG and apply BLEED 1 (2 rounds) to opponents in range.",
    },
  },
  {
    id: "leaf_hunter",
    name: "Hunter",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 13,
    sp: 8,
    shields: 0,
    keywords: {},
    // Trapper: a snare bite on summon, on death, and on a landed basic — a hit
    // has a 50% chance to ROOT the target for 2 rounds. (Duration 2 for the same
    // reason as Elderroot: a 1-round battle-applied ROOT never survives to Prep.)
    //
    // The bite is 4, up from 1. It is ONE passive with three triggers, so both
    // damage instances move together — a snare that bit for 1 on arrival and 1
    // on death was a rounding error next to the ROOT, which was the only part
    // anyone played it for.
    passiveNames: { onSummon: "Trapper", onDeath: "Trapper", onHitStatus: "Trapper" },
    onSummon: { handler: "strike", params: { dmg: 4, reachNearest: 1 }, targetSide: "enemy" },
    onDeath: { dmg: 4 },
    onHitStatus: { kind: "ROOT", duration: 2, power: 0, chance: 50 },
  },
  {
    id: "pyro_woof",
    name: "Woof",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 13,
    sp: 8,
    shields: 0,
    keywords: {},
    tribe: "Wolf",
    // Flame Eater: heal 3 HP when it strikes a BURNing opponent.
    passiveNames: { vsStatus: "Flame Eater" },
    vsStatus: { status: "BURN", healOnHit: 3 },
    // Heat Crunch: bite NOW and set the wound alight. Was a loaded buff on the
    // next three basics — a cost-1 special that did nothing the turn you spent
    // it, on a melee body that has to survive to cash it in.
    special: {
      name: "Heat Crunch",
      cost: 1,
      handler: "strike",
      params: { dmg: 6, statusKind: "BURN", statusPower: 2, statusDuration: 3 },
      targetSide: "enemy",
      text: "Bite an opponent for 6 DMG and set BURN 2 on it for 3 rounds.",
    },
  },
  {
    id: "pyro_scully",
    name: "Scallywag",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 5,
    dmg: 9,
    hits: 1,
    hp: 20,
    sp: 6,
    shields: 0,
    keywords: {},
    // First card in the Pirate tribe. Nothing reads it yet — no aura or payoff
    // matches "Pirate" — so it is flavour until something does, exactly as
    // Suns and Stars were before they had members.
    tribe: "Pirate",
    // Bounty Hunter: basics apply BURN 2, and any opponent who fires a Special
    // is marked with BURN 2 for it (reactive bounty).
    // King of Sunfall Harbor (On Kill): a coin — +1 shield or +1 DMG, permanent.
    // Modelled on BlackBeard's King of the Seas, but that coin picks between two
    // sizes of DMG; this one picks between two STATS, so a Scallywag that keeps
    // killing drifts toward armour or toward teeth rather than up a fixed line.
    passiveNames: {
      onHitStatus: "Bounty Hunter",
      onEnemySpecial: "Bounty Hunter",
      onKill: "King of Sunfall Harbor",
    },
    onHitStatus: { kind: "BURN", duration: 2, power: 2 },
    onEnemySpecial: { status: { kind: "BURN", duration: 2, power: 2 } },
    onKill: { coinShieldOrDmg: { shields: 1, dmg: 1 } },
    // Powder Keg: MINE the row ahead rather than blowing it now. The kegs sit
    // concealed until something walks onto one — which is the trap trigger the
    // card was written around before it was simplified into instant damage.
    special: {
      name: "Powder Keg",
      cost: 2,
      handler: "trapRow",
      params: { dmg: 6, statusKind: "BURN", statusPower: 2, statusDuration: 2 },
      targetSide: "self",
      text: "Lay a concealed powder keg on every open slot of the enemy row ahead. Each deals 6 DMG and BURN 2 to the first opponent that moves onto it.",
    },
  },
  {
    id: "pyro_dyna",
    name: "Dyna",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 11,
    sp: 9,
    shields: 0,
    keywords: {},
    tribe: "Forged Tech",
    // Demolition Charge (Talent, free, once per game): a bomb sized to the mark
    // — 4 DMG plus a fifth of its MAX HP.
    //
    // Was half the target's CURRENT HP, which made one free, once-per-game click
    // the best opener in the game against anything large: 22 off a 40 HP body
    // before it had acted. Reading MAX HP instead of current also settles what
    // the charge is — a fixed demolition sized to the target, not an execute
    // that shrinks as the target weakens.
    talent: {
      name: "Demolition Charge",
      text: "Once per game, free: deal 4 DMG plus 20% of the target's max HP.",
      handler: "barrage",
      params: { dmg: 4, targets: 1, pctMaxHpDmg: 20 },
    },
  },
  {
    id: "aqua_icynin",
    name: "Coilblade",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 10,
    sp: 11,
    shields: 0,
    keywords: { CRIT: true },
    tribe: ["Ice", "Dragon"],
    // Dragon's Fury (tribe trait): every kill is +1 DMG, permanently.
    onKill: { buffDmg: 1 },
    // Frozen Serpent: basics FREEZE a foe (50%), and a hit on an already-FROZEN
    // target shatters the ice — 3 splash to everyone adjacent to it.
    passiveNames: { onKill: "Dragon's Fury", onHitStatus: "Frozen Serpent" },
    onHitStatus: { kind: "FREEZE", duration: 1, power: 0, chance: 50 },
    shatterFrozen: 3,
    // Icy Storm: 3 DMG to 2 opponents, then vanish into STEALTH for 2 rounds.
    special: {
      name: "Icy Storm",
      cost: 2,
      handler: "barrage",
      params: { dmg: 3, targets: 2, stealthRounds: 2 },
      targetSide: "enemy",
      text: "Deal 3 DMG to 2 opponents, then gain STEALTH for 2 rounds.",
    },
  },
  {
    id: "aqua_liquark",
    name: "Liquark",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 4,
    dmg: 6,
    hits: 1,
    hp: 18,
    sp: 6,
    shields: 0,
    keywords: {},
    tribe: "SeaC",
    // Lurk (On Summon): dive into STEALTH; while hidden, +4 DMG and +4 SP.
    // Attacking breaks the STEALTH (Lurk ends) — Bloody Waters' kill re-enters it.
    passiveNames: { lurk: "Lurk" },
    lurk: { dmg: 4, sp: 4 },
    onSummon: { selfStatus: "STEALTH", selfStatusDuration: 99 },
    // Bloody Waters: 4 to the lowest-HP foe; a kill heals +5 and re-enters Lurk.
    special: {
      name: "Bloody Waters",
      cost: 2,
      handler: "bloodyWaters",
      params: { dmg: 4, healOnKill: 5 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 4 DMG to the lowest-HP opponent. On a kill: heal +5 HP and re-enter Lurk (STEALTH).",
    },
  },
  {
    id: "aqua_blackice",
    name: "Blackice",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 3,
    dmg: 2,
    hits: 1,
    hp: 16,
    sp: 3,
    shields: 2,
    keywords: {},
    tribe: "Ice",
    // Icicle Shields: arrives plated in +3 shields. Icicle Weapon: its basic
    // attack damage equals its current shield count (its armour IS its weapon).
    passiveNames: { summonSelfShields: "Icicle Shields" },
    summonSelfShields: 3,
    weaponFromShields: true,
    // Avalanche: 3 DMG to the enemy row ahead.
    special: {
      name: "Avalanche",
      cost: 3,
      handler: "barrage",
      params: { dmg: 3, rowAhead: 1, targets: 99 },
      targetSide: "enemy",
      text: "Deal 3 DMG to opponents in the row directly ahead.",
    },
  },
  {
    id: "aqua_siphon",
    name: "Siphon",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 10,
    sp: 7,
    shields: 2,
    keywords: {},
    tribe: "Liquid",
    // Cyclone (Talent, free, once per game): rake the adjacent row AND scrub
    // every debuff off the whole team.
    talent: {
      name: "Cyclone",
      text: "Once per game, free: hit all opponents in the adjacent row and CLEANSE all allies.",
      handler: "barrage",
      params: { dmg: 4, rowAhead: 1, targets: 99, cleanseAllies: 1 },
    },
  },
  {
    id: "dawn_solara",
    name: "Solara",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Support",
    tribe: "Suns",
    attackType: "Ranged",
    cost: 4,
    dmg: 8,
    hits: 1,
    hp: 11,
    sp: 11,
    shields: 1,
    keywords: {},
    // Morning Glow (End of Round): heal all allies +1.
    passiveNames: { roundTick: "Morning Glow" },
    roundTick: { healAllies: 1 },
    // Radiant Guardian (On Summon): arrives with a sturdy bodyguard at her side.
    summonSpawn: { token: "dawn_radiant_guardian", count: 1 },
    // Blinding Sunrise: BLIND all opponents for the round AND call another
    // Radiant Guardian to her side.
    special: {
      name: "Blinding Sunrise",
      cost: 3,
      handler: "statusNova",
      params: { statusKind: "BLIND", statusDuration: 1, targets: 99, spawnToken: "dawn_radiant_guardian", spawnCount: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "BLIND all opponents for the round and summon a Radiant Guardian.",
    },
  },
  {
    id: "dawn_ariel",
    name: "Ariel",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Assassin",
    tribe: "Stars",
    attackType: "Melee",
    cost: 4,
    dmg: 7,
    hits: 1,
    hp: 11,
    sp: 7,
    shields: 2,
    keywords: {},
    // Dawning Assault (On Summon): 7 DMG to a foe and blind its aim for THE
    // ROUND — 1, not 2, matching what the card says.
    //
    // Last Light is now an on-OPPONENT-death trigger rather than an on-its-own-
    // death one: every time a foe falls, anywhere, Ariel strikes the nearest
    // survivor for 2.
    passiveNames: { onSummon: "Dawning Assault", onOpponentDeath: "Last Light" },
    onSummon: { handler: "strike", params: { dmg: 7, reachNearest: 1, targetAttackMissPct: 50, targetAttackMissRounds: 1 }, targetSide: "enemy" },
    onOpponentDeath: { dmg: 2 },
    // 100,000°: Ariel charges, and the blow lands NEXT round — 7 + 11 = 18 DMG,
    // PEN, and thrown at RANGE from a card that is otherwise Melee.
    //
    // The damage came DOWN, from +14 to +11, and the reach is what it bought.
    // A melee assassin has to walk into the fight to use a charge, which is the
    // round its target gets to move or kill it; at range the charge lands from
    // wherever Ariel is standing, so the swing was worth more than the three
    // points it gave up.
    //
    // `selfPen` rides the timed buff rather than sitting on Ariel, because it
    // is the boost that pierces and not the card. `selfRangedShots` rides
    // `rangedShotsLeft`, the pocket Surge already uses.
    special: {
      name: "100,000°",
      cost: 2,
      handler: "empower",
      // TWO ROUNDS, and one was a bug rather than a balance choice. Buffs tick
      // down in CLEANUP (phases.ts), and a card takes exactly one battle action
      // — Basic or Special, never both — so a charge fired this round can only
      // ever be spent NEXT round. At `buffRounds: 1` it was decremented to zero
      // at the end of the very round it was cast and dropped before the attack
      // it exists to power: 2 Magic for nothing, every time. The card's own
      // comment already said "the blow lands NEXT round", which is exactly what
      // could not happen. Two rounds survives one Cleanup and is spent on the
      // following basic, then expires — the printed behaviour, at last.
      params: { selfDmg: 11, selfPen: 1, selfRangedShots: 1, buffRounds: 2 },
      targetSide: "self",
      text: "Charge: your NEXT round's basic attack fires at RANGE for +11 DMG (PEN).",
    },
  },
  {
    id: "dawn_sircrest",
    name: "SirCrest",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Mage",
    tribe: "Stars",
    attackType: "Ranged",
    cost: 5,
    dmg: 3,
    hits: 2,
    hp: 17,
    sp: 7,
    shields: 2,
    keywords: {},
    // A DAWN mage who wields both fire and water: he carries the PYRO Scorch
    // aura (his basics apply BURN) and the AQUA Flow Change aura (on-summon
    // boost pick), on top of his native DAWN Awakening.
    elementAuras: ["PYRO", "AQUA"],
    // Burning Waterfall: BURN 2 + SCALD 2 to all opponents in range.
    special: {
      name: "Burning Waterfall",
      cost: 3,
      handler: "barrage",
      params: { dmg: 0, targets: 99, statusKind: "BURN", statusPower: 2, statusDuration: 2, debuffStatus: "SCALD", debuffStatusRounds: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "Apply BURN 2 and SCALD 2 to all opponents in range.",
    },
  },
  // ── Parity fill: bring every element up to 38 playable cards ────────────────
  {
    id: "bolt_ning",
    name: "Twinbolt",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 2,
    dmg: 3,
    hits: 1,
    hp: 8,
    sp: 9,
    shields: 0,
    // Every basic CRITs.
    keywords: { CRIT: true },
    // Twin Strike (On CRIT): chain a bonus 2×1 CRIT strike at the target, once
    // per round.
    passiveNames: { onCritBonus: "Twin Strike" },
    onCritBonus: { dmg: 1, hits: 2 },
  },
  {
    id: "bolt_buzzard",
    name: "Buzzard",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 14,
    sp: 7,
    shields: 0,
    keywords: {},
    // Drone Sweep: when an opponent is summoned, launch a drone into the closest
    // empty slot beside the newcomer; the drone strafes it for 1. Buzzard itself
    // stays put now — it deploys rather than chases.
    //
    // ONE per round, and ONE ON THE BOARD. A turn where the opponent summons
    // three bodies used to pay three drones, so a single 3-cost card punished
    // the whole turn and left a wall of chip damage behind it — that was the
    // rate. The stock was still unbounded: one a round over a fifteen-round
    // match is fifteen drones, since the only way one leaves is dying. Buzzard
    // keeps a single drone up now and launches the next when that one falls.
    passiveNames: { onOppSummon: "Drone Sweep" },
    onOppSummon: { spawnToken: "bolt_drone_tok", dmg: 1, oncePerRound: true, spawnMaxAlive: 1 },
  },
  {
    id: "bolt_staticcloud",
    name: "Static Cloud",
    tribe: "ARC",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 2,
    dmg: 0,
    hits: 1,
    hp: 20,
    sp: 0,
    shields: 0,
    keywords: {},
    // Rolling Static (End of Round): the cloud drifts one slot forward, then
    // discharges — 4 DMG to a random opponent and PARALYZE it for 2 rounds. No
    // basic of its own (0 DMG / SP 0); it just rolls and strikes.
    passiveNames: { roundTick: "Rolling Static" },
    roundTick: { advance: 1, randomEnemyDmg: 4, randomEnemyStatus: { kind: "PARALYZE", duration: 2, power: 0 } },
  },
  {
    id: "bolt_velvolt_knight",
    name: "Velvolt Knight",
    rarity: "mythic",
    element: "BOLT",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 9,
    dmg: 9,
    hits: 2,
    hp: 20,
    sp: 13,
    shields: 2,
    keywords: {},
    // Electro Knight: +1 shield each round, and a broken shield PARALYZEs the
    // breaker for 2 rounds.
    //
    // Live Current is the aura, and it is now a FIELD rather than a pulse. It
    // used to be `roundTick.inRangeStatus` — a 1-round mark, reapplied every
    // Cleanup, to whatever happened to be in reach at that moment. Two things
    // were wrong with that on a cost-9 mythic. Range: a Ranged knight standing
    // in its own home row can see very little, so the "aura" routinely lit up
    // nobody. And timing: a 1-round status refreshed at Cleanup means allies
    // attacking earlier in the round found the mark already expired — the very
    // window the +2-vs-statused payoff is supposed to open.
    //
    // So it lands ONCE and stays: every opponent on the board when the Knight
    // arrives (onSummon, reachNearest = the whole board, not its reach), and
    // every opponent that arrives afterwards (onOppSummon). Duration 99 is the
    // codebase's existing "for the match" idiom — see Voltis' arrival volley.
    passiveNames: { onShieldBreak: "Electro Knight", onSummon: "Live Current", onOppSummon: "Live Current" },
    roundTick: { selfShields: 1, selfShieldsMax: 5 },
    onSummon: {
      handler: "statusNova",
      targetSide: "enemy",
      params: { reachNearest: 1, targets: 99, statusKind: "ELECTRIFIED", statusDuration: 99 },
    },
    onOppSummon: { boardWide: true, status: { kind: "ELECTRIFIED", duration: 99, power: 0 } },
    onShieldBreak: { status: { kind: "PARALYZE", duration: 2, power: 0 } },
    // Ultra Power Gauntlets: +2 DMG, FLYING, and basics clip +1 adjacent target,
    // all for 3 rounds.
    special: {
      name: "Ultra Power Gauntlets",
      cost: 4,
      handler: "powerGauntlets",
      params: { dmg: 2, rounds: 3 },
      targetSide: "self",
      text: "Gain +2 DMG and FLYING for 3 rounds; basic attacks also hit +1 adjacent target.",
    },
  },
  {
    id: "bore_gemaga",
    name: "Magnetite",
    // DRAGON, not "Dragon Born". Tribes are free-text and nothing in the game
    // matched that string — not Rakor's tribe aura, not Drakonbane's Dragon's
    // Bane, not the new tribe filter — so it was a tribe of one that did nothing
    // but sit in the data. Folded into the tribe it was always describing.
    tribe: "Dragon",
    // Dragon's Fury (tribe trait): every kill is +1 DMG, permanently.
    onKill: { buffDmg: 1 },
    rarity: "epic",
    element: "BORE",
    cardClass: "Support",
    attackType: "Melee",
    cost: 5,
    dmg: 6,
    hits: 1,
    hp: 19,
    sp: 6,
    shields: 2,
    // Gemstone scales REFLECT 2 damage back at attackers.
    keywords: { REFLECT: 2 },
    // Magnetic Field (Aura): the plates it wears extend to whatever is touching
    // it — adjacent allies carry its own REFLECT 2 while it lives.
    //
    // It was the only cost-5 card in the game with no passive at all, on a body
    // sitting exactly on budget. REFLECT is already its whole identity, so the
    // aura gives the Support something to do besides stand there.
    passiveNames: { aura: "Magnetic Field", onKill: "Dragon's Fury" },
    aura: { scope: "adjacent", reflect: 2 },
    // Magnetic Shield: plate every ally in range with REFLECT 2.
    special: {
      name: "Magnetic Shield",
      // 3, not 4. Seventeen of the cost-5 rung's Specials are priced at 3, and
      // this one still buys no damage and no status — but REFLECT 1 was a
      // rounding error next to the card's own aura, which hands every ADJACENT
      // ally 2 for free and forever. The sources ADD (keyword + field + aura +
      // granted, see resolveHit), so at 1 the Special's whole contribution to a
      // neighbour was a third of what standing still already gave them. At 2 it
      // matches the aura and extends its reach to everyone the caster can see.
      cost: 3,
      handler: "magneticShield",
      params: { targets: 99, reflect: 2, rounds: 2 },
      targetSide: "ally",
      text: "Give all allies in range REFLECT 2 for 2 rounds.",
    },
  },
  {
    id: "bore_valcana",
    name: "Valcana",
    rarity: "epic",
    element: "BORE",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 5,
    dmg: 5,
    hits: 2,
    hp: 14,
    sp: 7,
    shields: 2,
    keywords: {},
    // Volcanic Fury (On Hit): each landed basic grows +1 DMG — until her Special
    // is used, which vents the whole ramp.
    passiveNames: { onHitRampUntilSpecial: "Volcanic Fury" },
    onHitRampUntilSpecial: 1,
    // Magma Rock Burst: 5 DMG + DOT 2 to a target, and 2 DMG to every other foe.
    special: {
      name: "Magma Rock Burst",
      cost: 2,
      handler: "strike",
      params: { dmg: 5, statusKind: "DOT", statusPower: 2, statusDuration: 2, splashAll: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 5 DMG and DOT 2 (2 rounds) to a target, and 2 DMG to all other opponents.",
    },
  },
  {
    id: "bore_thorny_ripper",
    name: "Thorny Ripper",
    rarity: "rare",
    element: "BORE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 2,
    dmg: 4,
    hits: 1,
    hp: 4,
    sp: 8,
    shields: 2,
    // Spined Hide: REFLECT 2 — anything that hits it takes 2 back.
    keywords: { REFLECT: 2 },
    tribe: "Sand Village",
    // False Head: ONE free dodge for the whole game — the first BASIC attack it
    // takes, melee or ranged, hits the decoy and does nothing. It was the first
    // MELEE attack EACH round, which on a 4 HP body meant a melee attacker could
    // never finish it while a ranged one ignored the passive entirely. Specials
    // punch through: a cost-2 blocker should turn away a swing, not someone's
    // once-a-game payoff. Spined Hide (REFLECT 2) is unchanged.
    passiveNames: { falseHead: "False Head" },
    falseHead: true,
  },
  {
    id: "bore_ankylosaur",
    name: "Granite Ankylosaur",
    rarity: "rare",
    element: "BORE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 11,
    sp: 2,
    shields: 4,
    // Rock Hide: BLOCK 1 — shaves a point off every hit, before shields and
    // even through PEN.
    keywords: { BLOCK: 1 },
    tribe: "Mountain Beasts",
    // Tail Club (On Hit): a clubbing blow to the head — 50% to SLEEP for 2 rounds.
    passiveNames: { onHitStatus: "Tail Club" },
    onHitStatus: { kind: "SLEEP", duration: 2, power: 0, chance: 50 },
  },
  {
    id: "dusk_skrow",
    name: "Strawman",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 5,
    dmg: 7,
    hits: 2,
    hp: 14,
    sp: 7,
    shields: 0,
    keywords: {},
    tribe: "ScareKrow",
    // Goodnight (On Death): two Crows burst from the straw as it falls.
    passiveNames: { onDeath: "Goodnight" },
    onDeath: { dmg: 0, spawnToken: { token: "dusk_crow", count: 2 } },
    // Murder (Special): conjure 3 Crows, and again once it comes off cooldown.
    //
    // This was a Talent — free, once per game — which is the RARE pattern, and
    // Strawman is an Epic. It was the only non-rare card in the game still
    // carrying one; the other 107 Epics all have repeatable Specials.
    //
    // Costed off Sway, its closest peer: also Epic, also a cost-3 body, also
    // three tokens for three magic. Renamed too, because "Bird Bomb" is already
    // the name of the Crow's OWN on-death blast — the card and the thing it
    // summons cannot share an ability name. A murder is what a group of crows is.
    special: {
      name: "Murder",
      cost: 3,
      handler: "spawn",
      params: { token: "dusk_crow", count: 3, radius: 2 },
      targetSide: "self",
      text: "Create 3 Crows near it.",
    },
  },
  {
    id: "dusk_doom",
    name: "Doom",
    tribe: "Dark",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Support",
    attackType: "Melee",
    cost: 2,
    dmg: 3,
    hits: 1,
    hp: 13,
    sp: 0,
    shields: 2,
    keywords: {},
    // Boom: a live fuse. SP 0 means it never moves, but it can now swing at
    // whatever wanders adjacent — and after 4 rounds it detonates for 8 DMG to
    // every enemy, then dies. Kill it first or eat the blast.
    boom: { afterRounds: 4, dmg: 8 },
  },
  {
    id: "dusk_jackl",
    name: "Jackl",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 2,
    dmg: 2,
    hits: 2,
    hp: 8,
    sp: 9,
    shields: 0,
    keywords: {},
    tribe: "ScareKrow",
    // Arrow of Darkness (On Kill): loose a 2-DMG arrow at the closest other foe.
    passiveNames: { onKill: "Arrow of Darkness" },
    onKill: { nearestVolley: { dmg: 2, hits: 1 } },
  },
  {
    id: "pyro_nitro",
    name: "Nitro",
    rarity: "mythic",
    element: "PYRO",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 9,
    dmg: 8,
    hits: 2,
    hp: 20,
    sp: 15,
    shields: 2,
    keywords: {},
    tribe: "Forged Tech",
    // Unstable Core (On Death): a final explosion — 10 DMG to every opponent on
    // the board, however it dies.
    // Forged Tech (Aura): the whole workshop runs hotter — +1 DMG and +3 SP.
    passiveNames: { deathExplosion: "Unstable Core", aura: "Forged Tech" },
    deathExplosion: 10,
    aura: { scope: "tribe", match: "Forged Tech", dmg: 1, sp: 3 },
    // Volatile Formula: 13 DMG to all opponents in range, 30% chance to double.
    special: {
      name: "Volatile Formula",
      // 3-round cooldown, like every other mythic that hits the whole board.
      // 13 damage to every opponent — 26 on the 30% double — was running on the
      // DEFAULT 2-round lockout. Kraken was given a printed 3 for exactly this
      // reason at 8 damage; this is the same access pattern for half again as
      // much. (SkullKing and Coreborer also lack one and are deliberately left:
      // SkullKing's board-wide Special deals no damage, and Coreborer's hits a
      // single column rather than the board.)
      cooldown: 3,
      cost: 5,
      handler: "barrage",
      params: { dmg: 13, targets: 99, doubleChance: 30 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 13 DMG to all opponents in range — 30% chance to deal double.",
    },
  },
  {
    id: "aqua_icewall",
    name: "Ice Wall",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Tank",
    attackType: "Ranged",
    cost: 5,
    dmg: 3,
    hits: 1,
    hp: 20,
    sp: 4,
    shields: 4,
    // Rime Barrier: BLOCK 2 against every hit (before shields, even vs PEN).
    keywords: { BLOCK: 2 },
    // Frostbite: basics have a 50% chance to FREEZE for 2 rounds.
    passiveNames: { onHitStatus: "Frostbite" },
    onHitStatus: { kind: "FREEZE", duration: 2, power: 0, chance: 50 },
    // Rapid Shot: fire 3 shots split among targets in range; each independently
    // rolls Frostbite (40% → FREEZE 2).
    special: {
      name: "Rapid Shot",
      cost: 3,
      handler: "barrage",
      params: { dmg: 3, targets: 3, statusKind: "FREEZE", statusDuration: 2, statusChance: 40 },
      targetSide: "enemy",
      ranged: true,
      text: "Fire 3 shots split among targets in range. Each hit has a 40% chance to FREEZE for 2 rounds.",
    },
  },
  {
    id: "dawn_supernova",
    name: "Supernova",
    rarity: "mythic",
    element: "DAWN",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 9,
    dmg: 7,
    hits: 2,
    // 14 + 34 + 9 = 57 against a cost-9 budget of 55 — inside the ±2 the stat
    // test allows, and the two points are what the aura's rewrite is paid with.
    hp: 34,
    sp: 9,
    shields: 0,
    keywords: { FLYING: true },
    // Both, and it answers to either aura: a Dragon by shape, a Star by what it
    // is. Tribes are free-text and may be arrays, so nothing had to give.
    tribe: ["Dragon", "Stars"],
    // Dragon's Fury (tribe trait): every kill is +1 DMG, permanently.
    onKill: { buffDmg: 1 },
    // Immediate Impact (On Summon): 2 DMG to all opponents on arrival.
    onSummon: { handler: "barrage", params: { dmg: 2, targets: 99 } },
    // Blinding Star (Aura): every enemy basic attack rolls a 10% miss.
    passiveNames: { onKill: "Dragon's Fury", blindingStar: "Blinding Star" },
    blindingStar: true,
    // Gamma Ray Burst: 14 DMG to a target AND to opponents adjacent to it (same
    // damage — a blast zone around the mark); Supernova pays 5 HP.
    special: {
      name: "Gamma Ray Burst",
      cost: 4,
      handler: "strike",
      params: { dmg: 14, splash: 14, selfDamage: 5 },
      targetSide: "enemy",
      ranged: true,
      cooldown: 3,
      text: "Deal 14 DMG to a target and 14 DMG to every opponent adjacent to it. Supernova loses 5 HP.",
    },
  },
  {
    id: "dawn_halo",
    name: "Halo",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Support",
    tribe: "Suns",
    attackType: "Ranged",
    cost: 5,
    dmg: 3,
    hits: 1,
    hp: 18,
    sp: 10,
    shields: 2,
    // FLYING (owner's call). Free against the stat budget — the formula counts
    // only dmg/hp/shields/sp — so the printed line is unchanged and no exception
    // is needed. What it buys is SURVIVAL: melee cannot reach it unless the
    // attacker also flies or a status grounds it. That matters on THIS card in
    // particular — it is the element's only board-wide heal-and-cleanse, so it
    // is the thing the other side most wants dead. DAWN already carries the most
    // FLYING outside GALE (5 cards), so this sits inside the element's identity
    // rather than borrowing GALE's.
    keywords: { FLYING: true },
    // Blessed Light (End of Round): heal allies on the home row +1 HP.
    passiveNames: { roundTick: "Blessed Light", purelightAura: "Purelight" },
    roundTick: { healHomeRow: 1 },
    // Purelight (Aura): DAWN allies immune to BLIND; their attacks pierce EVASION.
    purelightAura: true,
    // Mending Horn: heal the WHOLE side +7 and strip their negatives + stat
    // changes. `validAllyTargets` has no range limit, so targets 99 is every
    // card you have on the board, not merely the ones standing nearby.
    //
    // It was one ally for +8. Widening it to the team is most of a card's worth
    // of healing, so the 3-round lockout is the price rather than decoration —
    // the default is 2, and on matches that average about eleven rounds that is
    // roughly four casts instead of five or six.
    //
    // WORTH KNOWING NEXT TO GROVE'S EMBRACE (leaf_elderroot): that one heals the
    // same 7 across the same whole side for FOUR magic off a cost-6 card, on the
    // default 2-round cooldown, and its `cleanse` wipes everything — including
    // the ally's own buffs. This heals for three off a cost-5 card and its
    // `cleanseNegatives` keeps those buffs. The longer lockout is the only axis
    // on which Grove's Embrace is now ahead. Deliberate, and flagged here so it
    // is a decision rather than a thing nobody noticed.
    special: {
      name: "Mending Horn",
      cost: 3,
      cooldown: 3,
      handler: "heal",
      params: { targets: 99, amount: 7, cleanseNegatives: 1 },
      targetSide: "ally",
      text: "Heal allies +7 HP and CLEANSE them (remove negative statuses and stat changes).",
    },
  },
  {
    id: "gale_stormfang",
    name: "Stormfang",
    rarity: "mythic",
    element: "GALE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 9,
    dmg: 11,
    hits: 1,
    hp: 27,
    sp: 17,
    shields: 0,
    keywords: {},
    tribe: "Wolf",
    // Apex Predator: +1 DMG for every 2 SP above 15.
    passiveNames: { speedDmgTiered: "Apex Predator" },
    speedDmgTiered: { above: 15, per: 2 },
    // Pack Leader: Wolf allies gain +1 DMG, +2 max HP and +1 SP.
    aura: { scope: "tribe", match: "Wolf", dmg: 1, maxHp: 2, sp: 1 },
    // Whirling Missile: dash into the target's row, then 14 to it + 7 splash to
    // opponents adjacent to that target.
    special: {
      name: "Whirling Missile",
      cost: 5,
      handler: "strike",
      // splashStatus: the WEAKEN rides the blast, so the four bodies caught by
      // the splash are weakened too — otherwise a board-clearing missile would
      // debuff exactly one card. And WEAKEN STACKS now (25% / 44% / 58%), so
      // this is the anchor of GALE's new identity rather than a rider on it.
      params: {
        dmg: 14, splash: 7, charge: 4, chargeFirst: 1, chargeLateral: 1,
        statusKind: "WEAKEN", statusDuration: 3, splashStatus: 1,
      },
      targetSide: "enemy",
      text: "Dash into the target's row, then deal 14 DMG to it and 7 DMG to opponents adjacent to it.",
    },
  },
  {
    // THE ID STAYS `gale_breeze` though the card is now Nightwing, and that is
    // deliberate. Card ids are persisted in save data — collections, saved
    // squads, deck codes (which are INDICES into deck-code.ts's id list) and
    // story rosters all store them. Renaming the id would not rename anyone's
    // copy; it would delete it, silently, out of every existing collection.
    // There is no id-alias mechanism in the codebase to migrate through, so the
    // id is a permanent handle and the name is the thing that may change.
    // The art file is named from the id too, so the plate at
    // public/cards/gale_breeze.webp is Nightwing's.
    id: "gale_breeze",
    name: "Nightwing",
    rarity: "rare",
    element: "GALE",
    cardClass: "Support",
    attackType: "Melee",
    cost: 2,
    // 5x1 + 8 + 0x2 + 7 = 20, which is exactly a cost-2's budget (5c + 10) —
    // the same 20 Breeze spent, moved off SP and onto damage. It was a 2-DMG
    // blinder with 10 SP; it is now a 5-DMG drainer with 7, which is a real
    // card rather than a faster one.
    dmg: 5,
    hits: 1,
    hp: 8,
    sp: 7,
    shields: 0,
    // DRAIN and FLYING, replacing Dust Gust's 30% BLIND. The chance goes with
    // it, which is no loss: a coin-flip blind on a 2-cost was the kind of
    // passive you could not plan around in either direction.
    keywords: { FLYING: true, DRAIN: true },
    // Nightfeed exists because of a CONTRACT, and it is worth saying so. Every
    // cost-1 and cost-2 Rare must carry a passive and not merely a keyword
    // (`passives.test.ts` "a cheap Rare is never a blank body") — a cheap Rare
    // cannot have a Talent, so a passive is the only thing it has to be
    // interesting with, and `keywords` is deliberately excluded from what
    // counts. DRAIN alone would have left this card technically blank.
    //
    // So rather than bolt on something unrelated, it is the same hunger on a
    // second beat: DRAIN takes 1 max HP off whatever it HITS, and Nightfeed
    // takes 1 more off whatever it is STANDING NEXT TO at end of round. One max
    // HP, against Violet's three, because Violet costs what it costs.
    passiveNames: { roundTick: "Nightfeed" },
    roundTick: { drainMaxAdjacent: 1 },
  },
  {
    id: "aqua_hydrogon",
    name: "Hydrogon",
    rarity: "mythic",
    element: "AQUA",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 9,
    dmg: 13,
    hits: 1,
    hp: 31,
    sp: 11,
    shields: 0,
    // FLYING, for the same reason as its Dragon kin — and with the same caveat:
    // it keeps its Melee attack, so it dodges ground melee without giving any
    // reach up for it. A serpent of steam has no business being blocked by a
    // wall, which FLYING also fixes.
    keywords: { FLYING: true },
    tribe: ["Dragon", "Vapor"],
    // Infinite Serpent (On Kill): grow permanently (+1 SP, +1 DMG) and snipe the
    // lowest-HP survivor for 3.
    // Vapor (Aura): the steam it trails carries its Vapor kin along — +4 SP.
    passiveNames: { onKill: "Infinite Serpent", aura: "Vapor" },
    onKill: { buffSp: 1, buffDmg: 1, lowestHpDmg: 3 },
    aura: { scope: "tribe", match: "Vapor", sp: 4 },
    // Vapor Beam: 18 to a target; the scald splashes SCALD 6 (DOT, 2r) to every
    // opponent adjacent to the struck slot.
    special: {
      name: "Vapor Beam",
      cost: 4,
      handler: "strike",
      params: { dmg: 18, statusKind: "SCALD", statusPower: 6, statusDuration: 2, statusSplash: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 18 DMG to a target and splash SCALD 6 (DOT, 2 rounds) to adjacent opponents.",
    },
  },
  {
    id: "pyro_liza",
    name: "Liza",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    dmg: 2,
    hits: 2,
    hp: 11,
    sp: 8,
    shields: 1,
    keywords: {},
    // Gaslighting: when an ally lands a kill, that ally gains +1 DMG until the
    // end of next round.
    passiveNames: { allyKillBuff: "Gaslighting" },
    allyKillBuff: { dmg: 1, rounds: 2 },
    // Igniter: double the power AND remaining duration of a DOT on an opponent.
    special: {
      name: "Igniter",
      cost: 1,
      handler: "igniter",
      params: {},
      targetSide: "enemy",
      ranged: true,
      text: "Double the damage and remaining duration of one DOT on an opponent.",
    },
  },
  {
    id: "leaf_bark_bushmen",
    name: "Bark Bushmen",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 3,
    hits: 2,
    hp: 7,
    sp: 9,
    shields: 2,
    keywords: {},
    tribe: "Grove",
    // Bark Shield (End of Round): +1 shield each round, capping at 5.
    passiveNames: { roundTick: "Bark Shield" },
    roundTick: { selfShields: 1, selfShieldsMax: 5 },
    // Night Spear: a crushing, piercing spear (4 crit = 8, ignores shields) that
    // ROOTs the target for 3 rounds and MUTES it for one.
    special: {
      name: "Night Spear",
      // 2, not 1. Damage that PIERCES shields, plus ROOT 3 and MUTE 1, is a
      // payload the rest of the game charges 2-3 magic for; Static Toss is the
      // mp2 comparison and it has neither PEN nor the second status.
      cost: 2,
      handler: "strike",
      // 5, down from 8, with the card back at cost 3 — the spear keeps its PEN
      // and both statuses, which is what made it worth casting.
      params: { dmg: 5, pen: 1, statusKind: "ROOT", statusDuration: 3, debuffStatus: "MUTED", debuffStatusRounds: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 5 DMG, piercing shields, ROOT the target for 3 rounds, and MUTE it for 1 round.",
    },
  },
  {
    id: "leaf_walking_tree",
    name: "Elephlora",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    // Was DMG 0 — literally unable to make a basic attack, so a whole turn of
    // the card did nothing but tick. A printed 3 (paid for out of HP) makes it a
    // body that can actually swing while Moving Forest carries the real output.
    // (This comment said "DMG 2" while the field read 3; the field is right.)
    dmg: 3,
    hits: 1,
    hp: 23,
    sp: 0,
    shields: 0,
    keywords: {},
    tribe: "Grove",
    // Moving Forest (End of Round): march forward one space if it's open (this
    // overrides its SP 0), and drop fruit — 2 DMG to the nearest opponent and
    // +2 HP to the lowest-HP ally.
    // Undergrowth: a landed basic ROOTs for 2 rounds.
    //
    // Down from 3 and 3. Moving Forest is unconditional, needs no target, no
    // magic and no cooldown, and fires EVERY round from a cost-3 body that also
    // walks itself forward at SP 0 — so it is free value that compounds with
    // how long the card survives, which Root Growth's doubled healing is built
    // to extend. It measured +20.4 against its cost-3 cohort over n=187, third
    // of every card ranked in mixed decks and the highest with a sample that
    // size.
    passiveNames: { roundTick: "Moving Forest", healReceivedMult: "Root Growth", onHitStatus: "Undergrowth" },
    roundTick: { advance: 1, randomEnemyDmg: 2, healLowestAlly: 2 },
    onHitStatus: { kind: "ROOT", duration: 2, power: 0 },
    // Root Growth: drinks in 2× from every healing source.
    healReceivedMult: 2,
  },
  {
    id: "leaf_sakuroot",
    name: "Sakuroot",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 11,
    sp: 3,
    shields: 4,
    // LIFESTEAL: basics heal Sakuroot for the damage dealt.
    keywords: { LIFESTEAL: true },
    tribe: "Grove",
    // Deep Roots: planted — immune to push / pull / knockback.
    // Petalfall (End of Round): heal LEAF allies on the home row +2 HP.
    passiveNames: { pushImmune: "Deep Roots", roundTick: "Petalfall" },
    pushImmune: true,
    roundTick: { healHomeRowElement: 2 },
    // Petal Storm: 3 DMG to every opponent in the row directly ahead + ROOT 3.
    special: {
      name: "Petal Storm",
      cost: 3,
      handler: "barrage",
      params: { dmg: 3, targets: 99, rowAhead: 1, statusKind: "ROOT", statusDuration: 3 },
      targetSide: "enemy",
      text: "Deal 3 DMG to all opponents in the row directly ahead and ROOT them for 3 rounds.",
    },
  },
  {
    id: "dusk_skullking",
    name: "SkullKing",
    tribe: "Skeleton", // its own King of Bones aura
    rarity: "mythic",
    element: "DUSK",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 9,
    dmg: 11,
    hits: 1,
    hp: 32,
    sp: 9,
    shields: 0,
    keywords: {},
    // King of Bones (Aura): Skeleton allies (skeletons, Risen Drakes, the King)
    // gain +2 DMG and are topped up +1 shield each round.
    passiveNames: { aura: "King of Bones", summonSpawn: "Dead Court", roundTick: "Dead Siege" },
    aura: { scope: "tribe", match: "Skeleton", dmg: 2, shields: 1 },
    // On Summon: raise 2 Skeletons at his side.
    summonSpawn: { token: "dusk_skeleton_tok", count: 2 },
    // Dead Siege (End of Round): raise 2 more Skeletons (capped at 6 standing).
    roundTick: { spawn: { token: "dusk_skeleton_tok", count: 2 }, spawnMaxAlive: 6 },
    // King's SkullDrake: DOT the row ahead and raise an attacking Risen Drake.
    special: {
      name: "King's SkullDrake",
      cost: 4,
      handler: "barrage",
      params: { dmg: 0, rowAhead: 1, targets: 99, statusKind: "DOT", statusPower: 3, statusDuration: 3, spawnToken: "dusk_skulldrake_tok", spawnCount: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Apply DOT 3 (3 rounds) to opponents in the row directly ahead and raise an attacking Risen Drake.",
    },
  },
  {
    id: "bore_the_coreborer",
    name: "The Coreborer",
    rarity: "mythic",
    element: "BORE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 9,
    dmg: 8,
    hits: 1,
    hp: 30,
    sp: 5,
    shields: 6,
    // Crystal Carapace: BLOCK 1 (harder shields) and REFLECT 1 back at attackers.
    keywords: { BLOCK: 1, REFLECT: 1 },
    tribe: "Cavernous",
    // Cavernous (Aura): the carapace is catching — Cavernous allies gain
    // REFLECT 1. Stacks onto their own REFLECT rather than replacing it.
    passiveNames: { aura: "Cavernous" },
    aura: { scope: "tribe", match: "Cavernous", reflect: 1 },
    // Core Drill: burrow straight through its own column, 12 PEN to every
    // opponent standing in it.
    special: {
      name: "Core Drill",
      cost: 5,
      handler: "barrage",
      params: { dmg: 12, pen: 1, sameColumn: 1, targets: 99 },
      targetSide: "enemy",
      ranged: true,
      text: "Burrow through the column directly ahead, dealing 12 DMG (PEN) to every opponent in it.",
    },
  },
  {
    id: "aqua_blub",
    name: "Dewling",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 6,
    sp: 7,
    shields: 0,
    keywords: {},
    // Kraken's school — the SeaC aura grants its members +4 max HP.
    tribe: "SeaC",
    // Liquid Humidity (End of Round): drinks itself back to full HP.
    passiveNames: { roundTick: "Liquid Humidity" },
    roundTick: { healSelfToFull: true },
  },
  {
    id: "dusk_gravekeeper",
    name: "Gravekeeper",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 2,
    dmg: 2,
    hits: 1,
    hp: 14,
    sp: 4,
    shields: 0,
    keywords: {},
    tribe: "Dark",
    // Grave Harvest: gains +2 max HP whenever any card dies.
    passiveNames: { salvageOnDeath: "Grave Harvest" },
    salvageOnDeath: 2,
    salvageMax: 5, // +10 HP at most, not +2 for every body that falls all game
  },
  {
    id: "gale_masala",
    name: "Mesala",
    rarity: "epic",
    element: "GALE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 4,
    dmg: 3,
    hits: 2,
    hp: 12,
    sp: 10,
    shields: 0,
    // EVASION rather than FLYING. Both are defensive, but they answer different
    // things: FLYING is about what can REACH it, EVASION about what LANDS. A
    // Ranger that already sits out of reach and whose whole job is to keep a
    // Raptor standing in front of it gets more out of shrugging off the shots
    // that do arrive than out of another layer of unreachability.
    keywords: { EVASION: true },
    tribe: "Avian",
    // Raptor Assault (End of Round): if no Raptor stands, raise one (capped at 1).
    passiveNames: { roundTick: "Raptor Assault" },
    roundTick: { spawn: { token: "gale_toxhawk_tok", count: 1 }, spawnMaxAlive: 1 },
    // Razor Wind Talon: rake the enemy's far (home) row — 3 DMG + DOT 1.
    special: {
      name: "Razor Wind Talon",
      cost: 3,
      handler: "barrage",
      params: { dmg: 3, targets: 99, enemyHomeRow: 1, statusKind: "DOT", statusPower: 1, statusDuration: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 3 DMG and DOT 1 (2 rounds) to opponents in the far (home) row.",
    },
  },
  {
    id: "gale_sway",
    name: "Sway",
    rarity: "epic",
    element: "GALE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 4,
    dmg: 6,
    hits: 1,
    hp: 13,
    sp: 11,
    shields: 0,
    keywords: {},
    // Bird Hunt (On Summon): arrives with an Ollie at its wing.
    passiveNames: { summonSpawn: "Bird Hunt" },
    summonSpawn: { token: "gale_ollie", count: 1 },
    // Birds of Prey: loose 3 attacking Ollies.
    special: {
      name: "Birds of Prey",
      cost: 3,
      handler: "spawn",
      params: { token: "gale_ollie", count: 3, radius: 2 },
      targetSide: "self",
      text: "Spawn 3 attacking Ollies — each also fires at whatever the ally behind it strikes at.",
    },
  },
  {
    id: "pyro_canister",
    name: "Canister",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 1,
    dmg: 0,
    hits: 1,
    hp: 15,
    sp: 0,
    shields: 0,
    keywords: {},
    tribe: "Forged Tech",
    // KaBoooom (On Death): 5 DMG to every non-PYRO card within one square.
    // Was 6 to the ENTIRE board, which is why a 1-cost body was one of the
    // scariest cards in the game: it cost nothing, it wanted to die, and the
    // payout was the same whether you placed it thoughtfully or parked it in a
    // corner and forgot about it. A radius makes the placement the play — which
    // is what Rollout below was always for.
    passiveNames: { onDeath: "KaBoooom" },
    onDeath: { dmg: 0, boardBlast: { dmg: 5, exceptElement: "PYRO", radius: 1 } },
    // Rares carry Talents, not repeatable Specials: free, but once per game.
    // Rollout: the canister rolls off the back line, striking then phasing PAST
    // bodies to the first open slot toward the enemy home — parking the bomb in
    // their line so KaBoooom lands where it hurts.
    talent: {
      name: "Rollout",
      handler: "strike",
      // 4 -> 2. The damage was never the point: Rollout exists to PARK the bomb
      // in the enemy line so KaBoooom lands where it hurts — and now that the
      // blast only reaches one square, the trip is the whole card.
      params: { dmg: 2, rollThrough: 1 },
      text: "Once per game: deal 2 DMG, then roll through to the first open slot toward the enemy home.",
    },
  },
  {
    id: "dawn_equestrian",
    name: "Equestrian",
    rarity: "mythic",
    element: "DAWN",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 9,
    dmg: 12,
    hits: 1,
    hp: 23,
    sp: 12,
    shields: 4,
    keywords: { TRAMPLE: true },
    tribe: "Suns",
    // 24K Stallion (On Summon): the mount arrives with +20 HP. Down from 24 —
    // the Suns aura below is new power on a card that was already on budget,
    // and the on-summon buff is the half that is not priced by 5*cost + 10.
    summonSelfBuff: { dmg: 0, hp: 20 },
    // Solar Sovereign (Aura): allies are immune to stat reduction (WEAKEN).
    // Suns (Aura): the host it rides at the head of hits harder and holds longer.
    //
    // DAWN'S TWO TRIBES SPLIT THE ELEMENT BY CLASS, and this is the front half:
    // Suns are the Tanks, Warriors and Supports — the line that holds — while
    // Stars are the Assassins, Mages and Rangers behind it (see Aurora). Every
    // DAWN card belongs to exactly one, so both auras have a side to lead
    // instead of the single member each had when the tribes were first written.
    // A split down class lines rather than a hand-picked roster: it needs no
    // upkeep as cards are added, and a player can read which tribe a card is in
    // off the card itself.
    passiveNames: { statDropImmuneAura: "Solar Sovereign", aura: "Suns" },
    statDropImmuneAura: true,
    aura: { scope: "tribe", match: "Suns", dmg: 1, shields: 1, maxHp: 1 },
    // Solar Horse Power: charge the column ahead, 15 DMG to opponents hit and
    // shove the lead one to the farthest slot.
    special: {
      name: "Solar Horse Power",
      cost: 4,
      handler: "battleCharge",
      params: { charge: 4, dmg: 15, chainDmg: 15, push: 5 },
      targetSide: "self",
      text: "Charge straight ahead, dealing 15 DMG to opponents in the column and pushing the leader to the farthest slot.",
    },
  },

  // ─────────────────── THE EIGHT LEGENDS (one per element) ───────────────────
  // Stat lines land on their own cost's budget (dmg*hits + hp + shields*2 + sp
  // against 5*cost + 10) EXACTLY — Snapmaw and Dreamcatcher at cost 6 on 40,
  // Killer Whale and Destro at cost 7 on 45 — with two deliberate exceptions,
  // both of which buy a free body instead of stats: Kobra is 4 under and brings
  // King Cobra, Havoc is 8 under and brings Surge. Those two are asserted in
  // eight-legends.test.ts rather than merely skipped, so deleting the spawn
  // breaks a test that names the reason.
  {
    id: "bolt_havoc",
    name: "Havoc",
    rarity: "legendary",
    element: "BOLT",
    cardClass: "Warrior",
    // Ranged, and the only card in the set that pays for its reach in ACCURACY
    // rather than in stats: 15% of its hits go wide (see `basicMissPct`). Two
    // hits is what makes that a cost instead of a coin flip — the usual outcome
    // is one-and-a-bit landing, not nothing.
    attackType: "Ranged",
    basicMissPct: 15,
    cost: 7,
    dmg: 3,
    hits: 2,
    hp: 20,
    sp: 5,
    shields: 3,
    keywords: {},
    tribe: "Bolt City Gang",
    passiveNames: { onHitByMelee: "Spiked Conduit", summonSpawn: "Running Crew" },
    // Spiked Conduit: the armour is live. Melee only — walking into it is the
    // mistake, shooting it is not.
    onHitByMelee: { dmg: 3, status: { kind: "ELECTRIFIED", duration: 2, power: 0 } },
    // Running Crew: Havoc does not arrive alone. Surge is a real cost-4 CARD
    // rather than a token, and at cost 7 that free body IS the card's remaining
    // value: 37 body points against a budget of 45, with a 33-point Surge
    // arriving beside it. See the exceptions note in state.test.ts — this is
    // ability-carried, downward, and deliberately so.
    summonSpawn: { token: "bolt_surge", count: 1 },
    special: {
      name: "ThunderShot",
      cost: 3,
      handler: "strike",
      // A shot, so it reaches. Unlike the basics above it does NOT roll to
      // miss: Specials auto-hit throughout the game, and carving an exception
      // for this one would make a 3-magic cast a gamble.
      ranged: true,
      // The MUTE lands only on a target that was ALREADY carrying something
      // when the shot was fired — BOLT's identity is punishing the afflicted,
      // spent here on silence instead of damage.
      params: {
        dmg: 7,
        statusKind: "PARALYZE", statusDuration: 2,
        statusIfAlready: "MUTED", statusIfAlreadyRounds: 2,
      },
      targetSide: "enemy",
      text: "7 DMG to any target and PARALYZE it for 2 rounds. If it already had a status, MUTE it for 2 rounds as well.",
    },
  },
  {
    id: "leaf_snapmaw",
    name: "Snapmaw",
    rarity: "legendary",
    element: "LEAF",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 6,
    dmg: 5,
    hits: 1,
    hp: 18,
    sp: 13,
    shields: 2,
    keywords: {},
    // NO TRIBE. It was Reptile, and the lore beside its story node has always
    // said why that never sat right — "Reptiles, not Keepers… a decision made
    // early, never put to the brood, and Snapmaw has never once accepted it."
    // The cost is real and worth naming: it drops out of Trinezer's Brood
    // Command, so it no longer collects +1 DMG / +1 SP from a Reptile aura.
    // The L6 warden node lists it by id rather than by tribe, so that fight is
    // unchanged.
    passiveNames: { onSummon: "Snare Garden", roundTick: "Snare Garden", vsStatus: "Devour" },
    // Snare Garden, first half: it plants a root the moment it lands, so the
    // aura below and Devour both have something to work with immediately.
    onSummon: { handler: "barrage", params: { dmg: 0, targets: 1, statusKind: "ROOT", statusDuration: 2 } },
    // …and second half: the roots ARE the weapon. Any ROOT counts, not only its
    // own — a LEAF deck full of them turns this into a board-wide DOT.
    roundTick: { rootedBleed: 1 },
    // Devour: it feeds on what it has already caught. Carried as a passive so
    // the basic drinks too, which is what "devour" means.
    vsStatus: { status: "ROOT", lifesteal: true },
    special: {
      name: "Devour",
      cost: 3,
      // BARRAGE, not strike: the bite takes the whole snare at once now — 4 into
      // every ROOTed body rather than 8 into one. `requireStatus` filters the
      // volley (barrage has always had it) and `volleyFilters` applies the same
      // filter to the preview and to `canFireSpecial`, so with nothing ROOTed
      // the Special cannot be fired at all. That replaces strike's spoken
      // refusal with a button that is simply unavailable, which is the better
      // half of the same promise: the magic can never be spent for nothing.
      //
      // THE TEXT NO LONGER CLAIMS A HEAL. It used to end "and heal for the
      // damage dealt", and the Special never did: `lifesteal` is a param strike
      // takes and Devour never passed, and the card's `vsStatus` lifesteal is
      // computed in the BASIC path only. Snapmaw drinks when it bites with its
      // attack; the Special is the snap, not the meal. Left that way rather
      // than made true, because lifesteal across every ROOTed body on the board
      // is a different card.
      handler: "barrage",
      // ignoreHomeRule: anything ROOTed, ANYWHERE — the enemy home row
      // included, which ordinary targeting keeps off-limits from your own back
      // line. Scoped to this Special, so Snapmaw's basic still respects it.
      // Having spent a root on the target is what pays for the reach.
      // +2 a kill, to a CEILING of +6. Unbounded it was a number that only
      // ever went up, on a card that also makes its own prey — Snare Garden
      // ROOTs on arrival, rootedBleed finishes the wounded, Devour reaches
      // anywhere on the board and heals for what it deals. Nothing in a match
      // interrupted the loop except the match ending, which is a duration
      // rather than a limit. Three devours still doubles its damage; the
      // fourth is where a legendary stops being a snowball.
      params: {
        dmg: 4, targets: 99, requireStatus: "ROOT", ignoreHomeRule: 1,
        onKillSelfDmg: 2, onKillSelfDmgMax: 6,
      },
      targetSide: "enemy",
      text: "4 DMG to EVERY ROOTed opponent on the board. Each one that dies gives Snapmaw +2 DMG permanently, up to +6. Does nothing to anything that is not ROOTed.",
    },
  },
  {
    id: "gale_dreamcatcher",
    name: "Dreamcatcher",
    rarity: "legendary",
    element: "GALE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 6,
    dmg: 4,
    hits: 1,
    hp: 16,
    sp: 16,
    shields: 2,
    keywords: {},
    tribe: "Dark Wind",
    passiveNames: { roundTick: "Dreamweaver" },
    // Dreamweaver: always the biggest threat it can reach, never whatever is
    // nearly dead — a debuffer that softens a corpse is wasting its round.
    roundTick: { topDmgInRangeStatus: { kind: "WEAKEN", duration: 2, power: 1 } },
    special: {
      name: "Soul Snare",
      cost: 3,
      handler: "statusNova",
      params: {
        targets: 99,
        statusKind: "SLEEP", statusDuration: 1,
        debuffStatus: "WEAKEN", debuffStatusRounds: 2,
      },
      targetSide: "enemy",
      text: "Every opponent in range falls asleep for a round and is WEAKENed for 2. No damage — waking them is the opponent's problem.",
    },
  },
  {
    id: "aqua_killerwhale",
    name: "Killer Whale",
    rarity: "legendary",
    element: "AQUA",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 7,
    dmg: 7,
    hits: 1,
    hp: 27,
    sp: 5,
    shields: 3,
    keywords: {},
    tribe: "SeaC", // Kraken's school (+4 max HP)
    passiveNames: { vsStatus: "Apex Predator", onSummon: "Breach" },
    // Apex Predator: it hunts what cannot run. Pairs with its own Special, which
    // is the point — Tidal Crush freezes the row and then it eats.
    vsStatus: { status: "FREEZE", bonusDmg: 3 },
    // BREACH: it does not arrive, it lands ON something. Tidal Crush fires free
    // the moment Killer Whale hits the board, which also switches its own combo
    // on from the first round — the row ahead is FROZEN and Apex Predator is +3
    // against exactly that. It was a cost-7 body that needed a whole turn and 3
    // magic before it did anything, on the element that measured last for most
    // of its life.
    onSummon: { castsOwnSpecial: true },
    special: {
      name: "Tidal Crush",
      cost: 3,
      handler: "barrage",
      params: { dmg: 6, targets: 99, rowAhead: 1, statusKind: "FREEZE", statusDuration: 2 },
      targetSide: "enemy",
      text: "6 DMG to every opponent in the row directly ahead and FREEZE them for 2 rounds.",
    },
  },
  {
    id: "dawn_lassos",
    name: "Lassos",
    rarity: "legendary",
    element: "DAWN",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 6,
    dmg: 6,
    hits: 1,
    hp: 16,
    sp: 14,
    shields: 2,
    keywords: {},
    // A ONE-OFF: SUNS, though the class rule says otherwise. DAWN splits by
    // class — Suns are the Tanks/Warriors/Supports, Stars the
    // Assassins/Mages/Rangers — and a Ranger is a Star. Lassos is the exception,
    // and it is the mount that earns it: this is a RIDER, not a marksman
    // standing behind the line, so it takes Equestrian's shield and HP over
    // Aurora's speed. Named in `CLASS_RULE_EXCEPTIONS` (auras.test.ts) rather
    // than the rule being loosened, so an untagged DAWN newcomer is still caught.
    //
    // "Sun's Army" goes with it. It was flavour shared with the Golden Bull this
    // card ropes and nothing ever read it — the only tribe aura in DAWN matches
    // "Suns" — so it bought the card nothing while keeping it out of the tribe
    // that pays.
    tribe: "Suns",
    passiveNames: {
      alwaysHit: "Deadeye", vsStatus: "Deadeye",
      mounted: "Ride or Die", summonSelfBuff: "Ride or Die",
      summonSpawn: "Rope the Herd",
    },
    // Rope the Herd: the rope goes out ONCE, as Lassos rides in, and what comes
    // back on the end of it is a Golden Bull already at a dead run.
    //
    // On SUMMON rather than on Hogtie, deliberately: Hogtie is a repeatable
    // Special on a 1-round cooldown, and a free 4-cost body every other round
    // is a second card stapled to this one rather than a flourish on its
    // entrance. Once, on arrival, is the whole of it.
    summonSpawn: { token: "dawn_golden_bull_tok", count: 1 },
    // Deadeye, both halves: it never misses, and it hits hardest what cannot
    // see it coming — which its own Hogtie arranges.
    alwaysHit: true,
    vsStatus: { status: "BLIND", bonusDmg: 2 },
    // Ride or Die: the horse is the extra body. Mounted is the king-move in
    // Prep; the HP is a passive grant, so it stays off the cost curve like every
    // other summon-time buff.
    mounted: true,
    summonSelfBuff: { dmg: 0, hp: 12 },
    special: {
      name: "Hogtie",
      cost: 2,
      handler: "strike",
      // pullToCaster, not `pull`. `pull` drags toward the caster's HOME ROW along
      // the target's own column, which for a rope is the wrong axis entirely:
      // anything off to one side was hauled up the board and ended no nearer
      // Lassos than it started. This closes both axes, so the rope pulls from
      // any direction — sideways and backwards included — and stops when the
      // target is standing beside it.
      params: { dmg: 5, pullToCaster: 1, statusKind: "BLIND", statusDuration: 2 },
      targetSide: "enemy",
      text: "5 DMG, rope the target one slot toward you from any direction, and BLIND it for 2 rounds — which Deadeye then punishes.",
    },
  },
  {
    id: "bore_kobra",
    name: "Kobra",
    rarity: "legendary",
    element: "BORE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 7,
    dmg: 10,
    hits: 1,
    hp: 15,
    sp: 12,
    shields: 2,
    // EVASION: it is not there when the blow lands. A striker holding 16 HP
    // does not survive by soaking, so the dodge is the armour.
    keywords: { EVASION: true },
    tribe: "Sand Village",
    passiveNames: { vsStatus: "Ambush Coil", summonSpawn: "Ambush Coil" },
    // Ambush Coil: doubles into a sleeping target, which its own Venom Strike
    // puts there — the Special sets up the next round's basic.
    vsStatus: { status: "SLEEP", dmgMult: 2 },
    summonSpawn: { token: "bore_kingcobra_tok", count: 1 },
    special: {
      name: "Venom Strike",
      cost: 3,
      handler: "strike",
      params: { dmg: 10, statusKind: "SLEEP", statusDuration: 2 },
      targetSide: "enemy",
      text: "10 DMG and SLEEP the target for 2 rounds. Ambush Coil then doubles everything Kobra lands on it.",
    },
  },
  {
    id: "pyro_burnout",
    name: "Burnout",
    rarity: "legendary",
    element: "PYRO",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 7,
    dmg: 6,
    hits: 1,
    hp: 24,
    sp: 8,
    shields: 4,
    keywords: { TRAMPLE: true },
    trampleDmg: 2,
    tribe: "Forged Tech",
    passiveNames: {
      onHitByMelee: "Burning Frame", onSpecialUse: "Super Charger",
      onKill: "King of the Streets",
    },
    // Burning Frame: the chassis is on fire. No damage of its own — hitting it
    // simply costs you the burn.
    onHitByMelee: { status: { kind: "BURN", duration: 2, power: 2 } },
    // Trample Through: 24 HP of burning machine does not go around things. It
    // pairs with both halves of the kit rather than sitting beside them —
    // Burning Frame punishes whatever is forced to touch it, and Super Charger
    // is a rented +8 SP, so the rounds it spends shouldering through the front
    // line are exactly the rounds it can afford to.
    // Super Charger: RENTED speed, not owned. An SP 8 tank that spikes to 16
    // crosses ground it otherwise never would — and then settles back, so the
    // ram is a commitment rather than a permanent stat line.
    //
    // TWO rounds, not one: at one it was spent almost entirely on the cast's own
    // charge, which Crash Out already pays for itself. Two is the difference
    // between a longer ram and a genuine repositioning — the tank arrives, and
    // then still has a turn of speed to be somewhere else with.
    onSpecialUse: { sp: 8, spRounds: 2 },
    // King of the Streets: every kill is permanently +1 DMG and +1 SP. The same
    // rider Sapphire's Vaporizer carries, and uncapped for the same reason it is
    // uncapped there — the growth is paid for in kills you had to go and get,
    // with a melee body, in contested combat.
    //
    // Which is the line Snapmaw's Devour is on the wrong side of, and worth
    // stating so the two do not look inconsistent: that one has a ceiling
    // because it manufactures its own prey — Snare Garden ROOTs on arrival,
    // Devour reaches any square on the board and heals for what it deals — so
    // the loop never had to leave home. Burnout has to drive at things.
    //
    // It compounds with TRAMPLE and with Super Charger, which is the point: a
    // wrecking ball that gets faster and hits harder the more it wrecks. The
    // permanent SP is the half to watch, because speed is what lets it reach
    // the NEXT kill — re-measure PYRO if it starts climbing.
    onKill: { buffDmg: 1, buffSp: 1 },
    special: {
      name: "Crash Out",
      cost: 3,
      handler: "strike",
      // chargeFirst: it closes the distance and THEN crashes, so the splash is
      // measured from where it ends up. statusSplash carries the BURN to
      // everything touching the impact — "all touching it".
      //
      // chargeLateral: it rams TOWARD THE TARGET rather than straight ahead.
      // Without it `chargeForward` walks it at the enemy home row whatever it
      // aimed at, so a target off to one side was struck from wherever Burnout
      // happened to end up — the charge and the crash pointed different ways.
      // No `chargeDiagonal`: a ground charger spends two steps to cut a corner,
      // the same price prep movement charges, and a chassis this heavy has not
      // earned the exemption a horse gets.
      params: {
        // THREE slots, and it keeps the wreck. Two was a nudge — a ram whose
        // whole identity is TRAMPLE could not reach across a mid row to find
        // anything worth ramming. At three it crosses a rank, and if the crash
        // kills, Burnout ends the turn standing where its target was instead of
        // one slot short of it.
        chargeFirst: 1, charge: 3, chargeLateral: 1, takeSpotOnKill: 1,
        // 6 -> 10, and it now COSTS 2 HP to pull. The ram was the one part of
        // this kit that did not read like the rest of it: a 3-slot charge into
        // a burning crash that landed for less than the card's own basic plus
        // King of the Streets. Ten hurts. Two HP off a 24 HP chassis, every
        // cast, is what keeps it from being free.
        //
        // NOT lethal: `selfHpCost` is refused by canFireSpecial when the cost
        // would kill, unless the Special declares `selfHpLethal` (RIP's Horde
        // does; this does not). So a burnt-down Burnout simply cannot ram any
        // more — it runs out of chassis to spend rather than driving itself
        // into the ground, which is the right shape for a card that also grows
        // +1 DMG and +1 SP on every kill.
        dmg: 10,
        selfHpCost: 2,
        statusKind: "BURN", statusDuration: 3, statusPower: 3,
        statusSplash: 1,
      },
      targetSide: "enemy",
      text: "Charge up to 3 slots and crash into a target: 10 DMG and BURN 3 for 3 rounds, with the same burn spreading to everything touching it. If the crash kills, Burnout takes its place. Costs Burnout 2 HP.",
    },
  },
  {
    id: "dusk_aranea",
    name: "Aranea",
    rarity: "legendary",
    element: "DUSK",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 6,
    dmg: 6,
    hits: 1,
    hp: 16,
    sp: 14,
    shields: 2,
    keywords: {},
    tribe: "Spider",
    passiveNames: { tribeDmgAura: "Broodmother" },
    // Broodmother: a STANDING aura, so it is rented — the brood she raises picks
    // it up as it lands, and killing her takes it back from all of them at once.
    // That is what makes her the thing to shoot rather than the spiders.
    tribeDmgAura: { tribe: "Spider", dmg: 2 },
    special: {
      name: "Brood Summon",
      cost: 3,
      handler: "statusNova",
      params: {
        targets: 99,
        // DURATION 2 FOR ONE ROUND OF FEAR — not a typo, an off-by-one between
        // engine ticks and what a player experiences. FRIGHTEN does two things:
        // it retreats the target a slot on application, and it stops it MOVING
        // during Prep. The cast happens in Battle, and Cleanup runs immediately
        // after, so at duration 1 the status was already gone before the Prep it
        // was supposed to freeze — the retreat fired and the fear never did.
        // Reported as "spiders don't fright". 2 survives that Cleanup and
        // blocks exactly one Prep turn, which is what "for a round" means from
        // the chair. The set's two other FRIGHTEN statuses are both 2.
        statusKind: "FRIGHTEN", statusDuration: 2,
        // TWO at a time, no more. The Monstrous Spider is a free cost-4 body
        // (27 points) that bursts into two more Spiders when it falls, all of
        // them carrying Broodmother's +2 — and Brood Summon repeats on a
        // cooldown with nothing counting what was already standing. That is
        // Buzzard's fleet again: the only way one left the board was by dying,
        // and here dying is the PAYOFF. A stock rather than an allowance, so
        // clearing the brood is still what re-arms it.
        spawnToken: "dusk_monstrous_spider_tok", spawnCount: 1, spawnMaxAlive: 2,
      },
      targetSide: "enemy",
      text: "Raise a Monstrous Spider and FRIGHTEN every opponent in range for a round. It bursts into 2 Spiders when it falls, and all three carry Broodmother's +2 DMG.",
    },
  },
  // ─────────────────── VOID TOWER — FLOOR 1 BOSSES ───────────────────────────
  // The doc's formula: Element A gives the TRIBE, Element B gives the MECHANIC,
  // and the boss summons its tribe on a 12-Gold budget. The budget is not a
  // runtime wallet — it is a build-time cap on the boss's formation, validated
  // in void-tower.test.ts against the lists in src/data/void-tower.ts.
  //
  // Every def here is `boss: true`: in CARDS so the inspector/lore/art
  // pipelines see them, but refused by isBuildable, the shop pools, the element
  // cores and escalationPool — a boss can be FOUGHT and nothing else. Their
  // bodies answer the Void Tower floor cap (80 +5 at Floor 1), not the cost
  // curve; `cost: 12` is the summon budget worn as a badge, never paid.
  //
  // EVERY BOSS'S SPECIAL IS ON A CLOCK — free, automatic, every 3 rounds, and
  // it never casts any other way (`roundTick.fireSpecialEveryN`, gated in
  // canFireSpecial). A puzzle needs a threat you can COUNT: left on the
  // ordinary path the same Special lands whenever the AI could afford it, which
  // is a different fight on every retry. Three is the doc's own number for
  // Xilty — "one guaranteed clean round in three, so a combo can be banked for
  // the window" — and what was right for the lock is right for all of them.
  //
  // NO RANDOM PERCENTAGES, and it is testable: no chance/statusChance/EVASION/
  // CRIT-coin field appears on any boss def. Where the design doc rolled dice
  // (50% revive, 55% evasion, 55% crit) these use the deterministic forms
  // (allyRevive once-per-card, firstAttackMisses, critAlways) — the doc's own
  // §6 conversion table, implemented.
  //
  // Each boss has its OWN art at public/cards/boss_<name>.webp (they shipped
  // with placeholder aliases for one commit; real art landed the same day).
  {
    id: "boss_rotroot",
    name: "Rotroot",
    rarity: "mythic",
    element: "DUSK",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, LEAF is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["LEAF"],
    cardClass: "Tank",
    attackType: "Melee",
    cost: 12,
    // Doubled body and damage. At 15/60 it died on round 16 of a 24-round
    // clock — two thirds of the way through a fight it is meant to be able to
    // outlast — and 15 damage a round killed nothing, so it could not win by
    // any route at all. A Tank on the floor's 170 budget, spent almost entirely
    // on meat, because "kill the source" should mean a long dig.
    dmg: 46,
    hits: 1,
    hp: 202,
    sp: 5,
    shields: 0,
    keywords: {},
    tribe: "Zombie",
    boss: true,
    // Floor 1 — THE ENGINE. Killing Zombies is wasted damage: Undead Resilience
    // stands each one back up once, and RIP's Dead Clock refills what stays
    // down. The answer is to ignore the board and reach Rotroot behind it.
    passiveNames: { allyRevive: "Undead Resilience" },
    allyRevive: { tribe: "Zombie", healFraction: 0.5 },
    // The clock, and a SHAMBLE: one slot every three rounds.
    //
    // It had a full `advance` once and that was too much — under the Void Tower
    // rule the player must come to the boss to win at all, so a boss that jogs
    // out to meet them throws away the fight's one structural advantage.
    // Rotroot went 39% -> 19% doing exactly that. At a third of the pace it is
    // something coming for you rather than something running at you, which is
    // what a corpse should be, and it gives its ground up slowly.
    roundTick: { fireSpecialEveryN: 3, advanceEveryN: 3 },
    special: {
      name: "Rotten Grasp",
      cost: 3,
      handler: "barrage",
      // reach 2 = the widened melee square, Kraken's Black Wave Crash precedent.
      // ANTI-AIR. Every melee boss on the tower was unanswerable-proof against
      // FLYING, and that included the ones whose Specials apply a grounding
      // status: they could not land ROOT or FREEZE on a flier because they
      // could not TARGET one, so the answer needed the answer. `antiAir` lifts
      // only the FLYING dodge — `ranged` would have worked too and would also
      // have thrown away this Special's printed radius.
      params: {
        antiAir: 1, dmg: 7, targets: 99, reach: 2, statusKind: "ROOT", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 7 DMG and ROOT for 2 rounds to every opponent within 2 spaces.",
    },
  },
  {
    id: "boss_skeleeze",
    name: "Skeleeze Ranger",
    rarity: "mythic",
    element: "DUSK",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, GALE is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["GALE"],
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 12,
    // Floor 2's budget is 230 and this was built to 58 — it died on round 14,
    // faster than any Floor-1 boss, on the floor above them. Damage doubled so
    // the column shot is a threat between Piercing Arrows.
    // 12/105 -> 30/110 (body 128 -> 151). The archer had the same wall problem
    // from the other side: Piercing Arrow clears ONE column per cast, so five
    // gates is five casts — fifteen rounds of a twenty-four round clock spent
    // shooting masonry. A bigger arrow is what buys those rounds back.
    dmg: 52,
    hits: 1,
    hp: 192,
    sp: 11,
    shields: 0,
    keywords: {},
    tribe: "Skeleton",
    boss: true,
    // Floor 2 — THE ROTATING KILL-COLUMN. Swiftshooter slides one slot along
    // the home row each Cleanup, wrapping, so the column is telegraphed and
    // moves predictably: clear out of it while the Skeletons press forward.
    // The doc's random sidestep is gone on purpose — same threat, now solvable.
    passiveNames: { roundTick: "Swiftshooter" },
    // SWIFTSHOOTER: it AIMS now, the way Helion does — toward the column holding
    // the most of your cards — but two slots a round instead of one, and it does
    // not stop for bodies. Anything in the way trades places with it.
    //
    // `shiftLateral` before, which slid one slot along the row and wrapped to
    // the next OPEN one: a blind shuffle that happened to end up somewhere. An
    // archer whose whole Special is a column shot should be CHOOSING the column,
    // and a screen parked in front of it should relocate the problem rather than
    // solve it.
    roundTick: {
      fireSpecialEveryN: 3,
      aimLateral: true, aimLateralSteps: 2, aimLateralSwap: true,
    },
    // `critPen` is what lets the guaranteed CRIT below fire through shields —
    // the printed "10 DMG (PEN)" is a crit that pierces, not a pen that crits.
    critPen: true,
    special: {
      name: "Piercing Arrow",
      cost: 3,
      handler: "barrage",
      params: { dmg: 10, targets: 99, sameColumn: 1, crit: 1, critAlways: 1 },
      targetSide: "enemy",
      text: "10 DMG to every opponent in the column directly ahead — a guaranteed CRIT that pierces shields.",
    },
  },
  {
    id: "boss_xilty",
    name: "Xilty",
    rarity: "mythic",
    element: "DUSK",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, BOLT is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["BOLT"],
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 12,
    // Floor 3, built to 82 of a 290 budget. Scaling it alone barely moved the
    // fight (5x body took it from 7% to 10%) because the clock, not its HP, was
    // what decided things — so this is sized to the floor rather than to a
    // measurement that could not respond. Shields carry a big share: Web Trap
    // buys the rounds, armour is what it buys them for.
    // 154 body points, trimmed from 166 to pay for Web Trap finally working —
    // see the Special. That repair was worth only +3.2 points on its own
    // (78.1% -> 81.3%), which is the clearest measure of how little the Special
    // had been doing; 66/24 puts Xilty back at 72.9%, beside Hoarfell and
    // Thunderfangs.
    //
    // The ARMOUR is the lever here, not the HP, and the old comment was right
    // about that before the harness was: dropping 72->40 HP with shields left
    // at 27 moves this fight ~5 points, while moving both together runs 81.3%
    // down to 40.6%. Shields block per HIT, so against a board of many small
    // attacks they are worth far more than the 2 budget points apiece they cost.
    dmg: 32,
    hits: 2,
    hp: 154,
    sp: 12,
    shields: 55,
    keywords: {},
    tribe: "Spider",
    boss: true,
    // Floor 3 — THE STATUS LOCK. The answer is deckbuilding: bring cleanse or
    // immunity (Siphon, Buzz, Surge, Anos, Halo, Elderroot). Web Trap at 3 CD
    // means one guaranteed clean round in three — bank the combo for it.
    // 82 body vs the 80 cap: inside the Floor band's +5, held deliberately.
    passiveNames: {
      onHitStatus: "Venomous Stinger", firstAttackMisses: "Slip the Silk",
      roundTick: "Stalk", vsStatus: "Feeding Time",
    },
    // FEEDING TIME — the kit fix, and the diagnosis was in the win types.
    // Xilty's `overrun` count sat at exactly 4 of 96 across a FIFTY PERCENT body
    // buff: it never killed anything, it only survived. Web Trap is a pure
    // status nova with no damage at all, so the boss locked the board down and
    // then had no way to cash the lock in. It won by outlasting the clock, which
    // is why raising the clock to 30 gutted it and why more body did nothing.
    //
    // Now the web is the setup and the bite is the payoff: everything within 2
    // is ROOTed every three rounds, and a rooted target takes +20 from every
    // hit of a 2-hit basic. Wrap, then eat.
    vsStatus: { status: "ROOT", bonusDmg: 20 },
    onHitStatus: { kind: "DOT", duration: 2, power: 2 },
    firstAttackMisses: true,
    // It walks. A melee lockdown boss that sits home is binary — approach and
    // get locked, or kite and its Special never fires. Advancing forces the
    // engagement (straight up its column; the doc's "toward the nearest
    // opponent" simplifies to this, and the telegraph is better for it).
    roundTick: { fireSpecialEveryN: 3, advance: 1 },
    special: {
      name: "Web Trap",
      cost: 3,
      // BARRAGE, not statusNova. A `statusNova` deals NO DAMAGE AT ALL, and that
      // was the whole of Xilty's problem: it locked the board down every three
      // rounds with no way to cash the lock in, so it won by outlasting the
      // clock and nothing else. Its `overrun` count sat at 4 of 96 through a 50%
      // body buff AND through a +20 payoff on its basics — the bite could not
      // reach what the web caught, because a melee spider advancing one slot a
      // round mostly never gets there. So the web bites. Same PARALYZE, same
      // ROOT — barrage carries both riders — with damage on top.
      handler: "barrage",
      // ONE round, not two. Two rounds of PARALYZE on a three-round clock is
      // two-thirds uptime on everything in range: the player acted one round in
      // three, and Xilty went undamaged in over half its fights. A lock you
      // cannot play through does not teach "bring cleanse or immunity", it just
      // ends the game — and now that the win condition is reaching Xilty and
      // killing it, being unable to act is being unable to play at all. At one
      // round the answer still matters and the fight still exists without it.
      //
      // REACH 2 — the widened melee square, and the thing that was actually
      // wrong with this Special. `reach` is a generic param that
      // `validSpecialTargets` honours for ANY handler, and Web Trap never
      // declared one, so a MELEE boss's signature move only ever caught what
      // was literally touching it. Every other nova on the tower (Aurora Break,
      // Thunder Run, Burning Roots, Fissure) declares reach 2; Xilty's was the
      // narrowest ability in the mode by omission rather than by design, and
      // then took the duration cut from 2 rounds to 1 on top of that. Both
      // nerfs landed on the same card and it stopped reading as a lockdown boss
      // at all — "Web Trap is trash", from the device.
      //
      // ROOT is what pays for the duration staying at 1. PARALYZE for one round
      // in three is the fair version of a lock (see above — two was the game
      // ending), but on its own it is a blink. The web HOLDS: everything caught
      // is ROOTed for 2, which stops it moving without stopping it acting, so
      // the board freezes around Xilty while you can still fight back. That is
      // a spider's Special rather than a stun, and it is the half that makes
      // approaching Xilty a decision.
      // ANTI-AIR. Every melee boss on the tower was unanswerable-proof against
      // FLYING, and that included the ones whose Specials apply a grounding
      // status: they could not land ROOT or FREEZE on a flier because they
      // could not TARGET one, so the answer needed the answer. `antiAir` lifts
      // only the FLYING dodge — `ranged` would have worked too and would also
      // have thrown away this Special's printed radius.
      params: {
        antiAir: 1, dmg: 15,
        statusKind: "PARALYZE", statusDuration: 1, targets: 99, reach: 2,
        debuffStatus: "ROOT", debuffStatusRounds: 2,
      },
      targetSide: "enemy",
      text: "15 DMG to every opponent within 2 spaces, PARALYZED for 1 round and ROOTed for 2 — and Feeding Time adds 20 to every hit it lands on the rooted.",
    },
  },
  {
    id: "boss_permafrost",
    name: "Permafrost",
    rarity: "mythic",
    element: "AQUA",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, BORE is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["BORE"],
    cardClass: "Tank",
    attackType: "Melee",
    cost: 12,
    // 6 damage a round killed nothing, which is why no amount of extra HP could
    // make it win: it survived longer and still lost. Doubled, and the armour
    // that is its whole identity gets most of the floor's budget.
    // 14/70 -> 22/90 (body 133 -> 161, under Floor 1's 170 cap). THE WALL: five
    // Fortress Gates took Permafrost to 6.3%, the worst on the tower, and no
    // amount of speed fixed it — advancing every round instead of every second
    // measured WORSE (9.4%). Its kit simply has no answer to masonry: Whiteout
    // only fires on targets at 6 HP or less, so a 20 HP gate is invisible to it,
    // and a glacier that arrives with nothing to say is still a glacier with
    // nothing to say. Damage is the only lever it has. 34.4%.
    dmg: 42,
    hits: 1,
    // 90/30 -> 70/22 (body 169 -> 133). Glacial Creep took this fight from
    // 82.3% to 89.6%, which made a FLOOR 1 boss harder than anything on Floor 3
    // — the gait was worth keeping and the progression was not worth inverting
    // for it. 70/22 reads 77.1%, between Rotroot (81.3) and Smolder (70.8).
    hp: 171,
    sp: 5,
    shields: 42,
    keywords: { BLOCK: 2 },
    tribe: "Ice",
    boss: true,
    // Floor 1 — THE WALL. Fifteen shields behind BLOCK 2, re-plating its side
    // every cast: crack it with PEN and shield-strips, or go around and take
    // the slots it is too slow to defend. Tribe from AQUA (Ice), mechanic from
    // BORE (the armour) — the doc's Cavernous pick could not spend 12 Gold.
    // The clock: its Special fires itself every 3 rounds, free.
    // A GLACIER: one slot every second round, and it never stops. It was every
    // FOURTH, which was the right pace for an empty board and hopeless once the
    // Fortress Gates went up — Permafrost could not cross the board AND break
    // five gates inside the then-24-round clock, and read 6.3%. Its Special cannot help
    // either: Whiteout only fires on targets at 6 HP or less, so a 20 HP gate is
    // invisible to it. Speed is the only lever it has.
    passiveNames: { roundTick: "Glacial Creep" },
    roundTick: { fireSpecialEveryN: 3, advanceEveryN: 2 },
    special: {
      name: "Whiteout",
      cost: 3,
      handler: "polarShift",
      // allyShield 1, not 2. It lands on EVERY ally every three rounds and
      // never expires, so on a wide Ice board it compounded into armour nothing
      // in the set could chew through — the boss sat at 90% HP, untouched,
      // behind a wall it thickened for free every third round. A wall you are
      // meant to "break through, or go around" has to be finite.
      // ANTI-AIR. Every melee boss on the tower was unanswerable-proof against
      // FLYING, and that included the ones whose Specials apply a grounding
      // status: they could not land ROOT or FREEZE on a flier because they
      // could not TARGET one, so the answer needed the answer. `antiAir` lifts
      // only the FLYING dodge — `ranged` would have worked too and would also
      // have thrown away this Special's printed radius.
      params: {
        antiAir: 1, underHp: 6, freeze: 2, allyShield: 1 },
      targetSide: "enemy",
      ranged: true, // board-wide, like Polar King's own cast
      text: "FREEZE every opponent at 6 HP or less for 2 rounds, and every ally gains +2 shields.",
    },
  },
  {
    id: "boss_overclock",
    name: "Overclock",
    rarity: "mythic",
    element: "BOLT",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, PYRO is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["PYRO"],
    cardClass: "Warrior",
    attackType: "Ranged",
    cost: 12,
    // Body only. Overclock was already one of the two that could hold a fight,
    // and it does that on its KIT — a capped Drone line and BURN — so the extra
    // budget goes into staying up rather than into hitting harder.
    dmg: 10,
    hits: 1,
    // 40 -> 50 -> 45 (body 76 -> 81), and HP IS NOT WHAT MOVES THIS FIGHT.
    // Overclock read 67.7% before OVERRUN shipped and 91.7% after, and the
    // first explanation given was the +25% HP it took in the same pass. Wrong,
    // and measured: 40, 45 and 50 HP all read 91.7% to the decimal, and 91% of
    // its wins are BY OVERRUN. Production Run floods the board with drones,
    // the drones walk into the player's home row, and the fight ends there —
    // the boss barely participates. The 45 is kept because it was asked for and
    // costs nothing; the number to turn is the overrun rule, not this one.
    hp: 56,
    sp: 12,
    shields: 10,
    keywords: {},
    tribe: "ARC",
    boss: true,
    // Floor 1 — THE SWARM. All 12 Gold in cost-1 and cost-2 machines, and the
    // factory keeps stamping Drones out behind them: AoE the tide or choke the
    // approach. Tribe from BOLT (ARC — the doc's Forged Tech is mono-PYRO and
    // could not span the pair), mechanic from PYRO: everything it touches
    // BURNs, no roll. As a mythic ARC it also carries the tribe's Discharge,
    // which is exactly what a dynamo at the head of a machine tide should do.
    passiveNames: { onHitStatus: "Sparks Catch" },
    onHitStatus: { kind: "BURN", duration: 2, power: 2 },
    // The clock: its Special fires itself every 3 rounds, free.
    roundTick: { fireSpecialEveryN: 3 },
    special: {
      name: "Production Run",
      cost: 3,
      handler: "spawn",
      // maxAlive, because this fires FREE every 3 rounds forever and nothing
      // capped the stock: `spawnMaxAlive` already leashes the round-tick spawn
      // and the onOppSummon one, and the SPECIAL was the single spawn path
      // without a ceiling. Uncapped it is the Buzzard problem again — two a
      // cast, and the only way a body leaves the board is by dying. The puzzle
      // is "AoE it, or choke the approach"; a line you can never get ahead of
      // is not a puzzle, it is a clock you lose to. Four standing Drones is a
      // wall you must clear, and it re-stamps the moment you do.
      // ANTI-AIR. Every melee boss on the tower was unanswerable-proof against
      // FLYING, and that included the ones whose Specials apply a grounding
      // status: they could not land ROOT or FREEZE on a flier because they
      // could not TARGET one, so the answer needed the answer. `antiAir` lifts
      // only the FLYING dodge — `ranged` would have worked too and would also
      // have thrown away this Special's printed radius.
      params: {
        antiAir: 1, token: "bolt_firebolt_tok", count: 2, maxAlive: 4 },
      targetSide: "self",
      text: "Stamp out 2 Firebolt Drones beside it, up to 4 at once — each one burns what it shoots and detonates when it falls.",
    },
  },
  {
    id: "boss_nightshrike",
    name: "Nightshrike",
    rarity: "mythic",
    element: "GALE",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, DUSK is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["DUSK"],
    cardClass: "Assassin",
    attackType: "Ranged",
    cost: 12,
    dmg: 15,
    // ONE hit, not two. At 15x2 it put out 30 ranged damage a round, more than
    // twice any other boss, and cleared the board before the player had
    // deployed — which is not "kill it first, or survive one round", it is
    // "there was no round". One heavy shot is the shape the puzzle names:
    // something has to eat it, and then you get to answer. Doubly so now that
    // slaying it is the win condition, since the fight only exists if the
    // player's board survives long enough to walk over and do that.
    hits: 1,
    // STILL THE GLASS ONE. It ends up with the smallest body on the floor by a
    // distance, and that is the design — "kill it first, or survive one round"
    // is not a boss you grind down. It survived 45 rounds at 20 HP because it
    // FLIES and shoots, not because it was tough, so the budget it did not
    // spend is the puzzle rather than an oversight.
    hp: 55,
    sp: 14,
    // 0 -> 12. THE LEVER, measured: shields alone took this fight from 45.5% to
    // 65.2% where a straight Special upgrade managed 51.8%, and they do it in
    // the matchups that mattered — Kraken 7 -> 43, The Deepest 21 -> 64,
    // Imperator 14 -> 36. Shields block per HIT, so on a board of many small
    // attacks they buy far more than the 2 budget points apiece they cost;
    // Xilty proved the same thing from the other direction.
    //
    // It is STILL the smallest body on Floor 1 at 108 (Smolder 114, Rotroot 165,
    // Permafrost 169), so the glass cannon is intact — it just is not made of
    // tissue paper any more.
    // 0 -> 12 -> 6 (body 108 -> 96). The 12 was right when this was the EASIEST
    // fight on the tower at 45.5%; it overshot once everything else landed — the
    // war chest, auto-fired Specials obeying their reach, and the Fortress Gates
    // — and Nightshrike ended up the hardest thing on Floor 1 at 77.1%, ahead of
    // Smolder's 60.4 and well ahead of Rotroot's 40.6. Halving the armour and
    // trimming the dive puts it at 61.5%: still the top of the floor, no longer
    // running away with it.
    shields: 6,
    // FLYING, REINSTATED at the owner's call after playing it — Nightshrike was
    // the tower's easiest fight by a distance (41.7%) and the one boss the war
    // chest did not move at all (41.7 -> 40.6), so its problem was never gold.
    //
    // Know what this turns back on. FLYING is outright immunity to Melee, and
    // the win condition is now SLAYING the boss, so a melee-weighted board does
    // not merely struggle, it cannot finish the fight and loses on the 24-round
    // clock. That is why it came off: it held 100% of its fights with the dodge
    // gone and at four tenths of this body, because nothing about this card was
    // ever survivability — it was unreachability.
    //
    // What makes it survivable now is that the ground is not the only answer:
    // ROOT, FREEZE, STUN, SLEEP and PARALYZE all drag a flier down
    // (GROUNDING_STATUSES), and Floor 1's own bosses hand those out. The body
    // below is sized to it — see the measured per-deck check, which is the real
    // gate: no core deck may be locked out of the floor the doc requires be
    // beatable with LEAF alone.
    keywords: { FLYING: true },
    tribe: "Avian",
    boss: true,
    // It does not hold still either. Nightshrike slides along its row every
    // round, which is what a bird on a wire does and, more usefully, means the
    // column you lined a shot up on is not the column it is in when the shot
    // lands. LATERAL rather than forward on purpose: a glass cannon does not
    // close, it repositions.
    // Floor 1 — THE GLASS CANNON. Kill it first or survive one round; there is
    // no third plan.
    //
    // It used to carry `firstAttackMisses` — the first attack on it each round
    // whiffed — and that turned out to be the entire boss. It held 100% of its
    // fights at full body and 93% at four TENTHS of it: HP was never what kept
    // it alive, being unreachable was. A board that could not spare two
    // attackers in one turn simply never touched it, which makes "kill it
    // first" not a plan but a wish. Gone, and what is left is what the card
    // says: almost no HP, the hardest hit on the floor, and it dies the moment
    // you get to it.
    // The clock: its Special fires itself every 3 rounds, free.
    // It slides along the wire, and once it is hurt it BREAKS OFF — a glass
    // cannon that stands and trades is just a slow cannon.
    passiveNames: { roundTick: "Wingbeat" },
    roundTick: { fireSpecialEveryN: 3, shiftLateral: 1, kite: { belowPct: 50 } },
    special: {
      name: "Death From Above",
      cost: 3,
      handler: "barrage",
      // 8x2 -> 12x3. This was the weakest Special on the tower by a distance —
      // 16 damage every three rounds, against Aurora Break's 10-to-everything
      // plus BLIND and Thunder Run's 9 plus ELECTRIFIED. On its own the upgrade
      // was worth 6 points (45.5 -> 51.8), so it is not what makes the fight
      // hard; it is what makes the dive read like a dive.
      //
      // Shipped alongside the shields rather than instead of them BECAUSE of
      // where it lands: shields alone left Shadow Horsemen at 7% and the two
      // together take it to 21%. Same average, better fight — the gain comes
      // from the matchup Nightshrike was losing worst instead of padding the
      // ones it already won.
      params: { dmg: 9, targets: 2 },
      targetSide: "enemy",
      text: "Dive two opponents for 9 DMG each.",
    },
  },
  {
    id: "boss_basilisk",
    name: "Basilisk",
    rarity: "mythic",
    element: "LEAF",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, AQUA is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["AQUA"],
    cardClass: "Tank",
    attackType: "Melee",
    cost: 12,
    // The nearest to the band already — it reached round 30 unaided — so this
    // is the lightest hand on the tower: enough body to hold the clock,
    // and REGEN + LIFESTEAL keep doing the rest.
    dmg: 25,
    hits: 1,
    // +25% HP (44 -> 55, body 70 -> 81) — Floor 2 across the board,
    // Skeleeze excepted, at the owner's call after playing the floor.
    hp: 116,
    sp: 8,
    // 3 -> 10 (body 81 -> 95). Honouring `reach` on auto-fired Specials cost
    // Basilisk more than any other boss — 68.8% -> 54.2%, the weakest fight in
    // the mode — because Wither Coil's radius had never bound before, and PROWL
    // spends half its cycle pacing AWAY from what it wants to reach.
    //
    // ARMOUR, not more HP, and not a wider Special: +12 shields alone measured
    // 73.2% where widening Wither Coil to reach 3 managed 58.0%, which is the
    // honest size of that kit tension. At 10 it reads 68.8%, level with Skeleeze
    // (68.8) and Helion (67.7). Shields block per HIT, and an attrition boss
    // that REGENs 3 a round wants exactly that: the chip never lands, and what
    // does land it heals back.
    shields: 21,
    keywords: { REGEN: 3, LIFESTEAL: true },
    tribe: "Reptile",
    boss: true,
    // Floor 2 — ATTRITION. REGEN 3 and LIFESTEAL on the body, max-HP theft on
    // the Special: every round you fail to close, it is further ahead. Out-heal
    // it, out-burst it, or race the capture win — waiting is the one wrong
    // answer, which is the lesson this fight exists to teach.
    // The clock: its Special fires itself every 3 rounds, free.
    // PROWL — forward, forward, back, still, and round again. This is the one
    // the AI was doing by accident and the owner asked for on purpose: a thing
    // that paces, coils back, waits a beat, then comes again. It suits the
    // attrition puzzle better than a straight line, because Basilisk wins by
    // lasting and pacing is what lasting looks like.
    roundTick: { fireSpecialEveryN: 3, prowl: true },
    special: {
      name: "Wither Coil",
      cost: 3,
      handler: "barrage",
      // reach 2 = the widened melee square, the same one Rotroot, Hoarfell,
      // Thunderfangs, Smolder and Xilty all declare.
      //
      // This one was not LYING the way Web Trap and Fissure were — "3
      // opponents" promises no range — but the kit was fighting itself, which
      // is the same complaint from the player's side. PROWL paces Basilisk
      // forward, forward, BACK, still; Wither Coil then fires itself every
      // three rounds and needs those opponents to be touching it. The gait
      // spends half its cycle undoing the Special's only requirement, so the
      // free cast landed on one card or none and the boss read as inert.
      //
      // At reach 2 the pacing becomes the point instead of the problem: it
      // withers what it circles. Which is also what a basilisk does — the gaze
      // is a look, not a touch.
      // ANTI-AIR. Every melee boss on the tower was unanswerable-proof against
      // FLYING, and that included the ones whose Specials apply a grounding
      // status: they could not land ROOT or FREEZE on a flier because they
      // could not TARGET one, so the answer needed the answer. `antiAir` lifts
      // only the FLYING dodge — `ranged` would have worked too and would also
      // have thrown away this Special's printed radius.
      params: {
        antiAir: 1, dmg: 5, targets: 3, drain: 2, reach: 2 },
      targetSide: "enemy",
      text: "5 DMG and DRAIN 2 max HP from up to 3 opponents within 2 spaces.",
    },
  },
  {
    id: "boss_helion",
    name: "Helion",
    rarity: "mythic",
    element: "DAWN",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, BORE is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["BORE"],
    cardClass: "Tank",
    attackType: "Ranged",
    cost: 12,
    // Floor 2's budget is 230 and almost all of it is armour. Helion is a siege
    // engine: it barely moves, it barely swings, and once every three rounds it
    // deletes a column. The basic is a formality — what you are racing is the
    // clock, and what the body has to do is survive being raced.
    // 8/70 -> 14/90 (body 121 -> 147). Solar Lance already pierces and already
    // deletes the gate in its lane; the basic was the problem — 8 damage between
    // casts on a boss that cannot move meant the three rounds between shots did
    // nothing at all. 29.2% -> 51.0%.
    dmg: 24,
    hits: 1,
    hp: 153,
    sp: 3,
    shields: 34,
    // BLOCK is the BORE half of the pairing, expressed without borrowing BORE's
    // aura: stone does not dodge, it simply refuses to be dented. Every hit,
    // however small, arrives 3 lighter — which makes chip damage useless against
    // it and rewards the one big swing, the opposite of the swarm answer.
    keywords: { BLOCK: 3 },
    tribe: "Suns",
    boss: true,
    // Floor 2 — THE SIEGE. Its Special fires down the column it is STANDING in,
    // and Traverse walks it toward whichever column holds the most of your
    // cards, one square a round. So the shot is announced twice: once by the
    // three-round clock, and once by a hundred tons of gold walking into your
    // lane while you watch. The lesson is that you are given the answer in
    // advance and still have to pay to take it — move, and give up the ground;
    // stay, and block the lane with something you can afford to lose.
    passiveNames: { roundTick: "Traverse" },
    // EMPLACED. Traverse IS Helion's movement — the AI walking it forward on top
    // of that is what put a siege engine in the front rank with nothing left to
    // shoot down. See `holdsPosition`.
    holdsPosition: true,
    roundTick: { fireSpecialEveryN: 3, aimLateral: true },
    special: {
      name: "Solar Lance",
      // No cooldown: the clock owns this Special outright (see fireSpecialEveryN).
      cost: 3,
      handler: "barrage",
      // The whole column, through everything. `pen` because a lance that stopped
      // at the first body would be answered by parking a token in front of it,
      // and "the front rank eats it" is not a puzzle, it is a tax.
      // ignoreHomeRule: the lance reaches the BACK LINE. Two changes collided to
      // make this necessary. Helion is EMPLACED (holdsPosition) so it never
      // leaves its own home row, and auto-fired Specials now go through
      // validSpecialTargets — which enforces the Home-Slot rule, where a slot in
      // the defender's home row may only be targeted from a MID row or from
      // inside that row. Measured: a card in the player's home row took 0 while
      // one in the mid row took 22. A siege engine that cannot shell the back
      // line is one you beat by parking everything in it.
      //
      // The same exemption Snapmaw's Devour declares, scoped to this one
      // ability rather than the card-level `ignoresHomeRule` — Helion's BASIC
      // still obeys the rule like everything else.
      params: { dmg: 22, targets: 99, sameColumn: 1, pen: 1, ignoreHomeRule: 1 },
      targetSide: "enemy",
      text: "Fires down the column it stands in: 22 DMG to every opponent in the lane, straight through shields.",
    },
  },
  {
    id: "boss_hoarfell",
    name: "Hoarfell",
    rarity: "mythic",
    element: "AQUA",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, DAWN is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["DAWN"],
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 12,
    // Floor 3's budget is 290. Hoarfell spends it on a body that has to survive
    // crossing the whole board, because crossing the board IS the threat.
    dmg: 40,
    hits: 1,
    // Retuned when it moved from SeaC to Ice: the frost brood — Phrost, two
    // PolarBears, two Cryos — is a great deal heavier than the school of fish
    // it used to lead, and the same body behind it read 92%.
    // 66 -> 90 (body 111 -> 135). Raised alongside the reach fix: every boss
    // Special had been firing board-wide regardless of its printed radius, and
    // honouring `reach` cut Aurora Break from a whole-board nova to the two
    // squares its text actually promises. Hoarfell loses more than most to
    // that — it is the JUGGERNAUT, so the rounds it spends walking are rounds
    // it now threatens nothing at range, and the body is what those rounds are
    // bought with.
    hp: 238,
    sp: 6,
    shields: 31,
    // TRAMPLE is the point rather than a rider: it walks THROUGH the lighter
    // half of your board instead of stopping at it, so a chump block has to be
    // something with real max HP or it just gets shoved aside.
    keywords: { TRAMPLE: true },
    // AVALANCHE CRUSHES. Shoving something aside merely REARRANGES it — against
    // the Fortress Gates the gate lived, the line still stood, and Hoarfell had
    // spent its round tidying the wall (30.2% -> 31.3%, which is nothing). A
    // thing whose whole identity is an unstoppable run should break what it runs
    // over, so every trample now costs the victim 12, straight through shields:
    // masonry is not armour to a juggernaut.
    trampleDmg: 12,
    tribe: "Ice",
    boss: true,
    // Floor 3 — THE JUGGERNAUT. It advances a slot a round and every
    // unobstructed step makes it hit harder, to +12; stop it once and the whole
    // run is gone. That is the entire fight in one sentence — standing in front
    // of it costs you the blocker, letting it run costs you the damage — and
    // unlike a status lock or a swarm, the answer is a decision rather than a
    // card you either brought or did not.
    passiveNames: { roundTick: "Avalanche", vsStatus: "Whiteout Hunter" },
    // THE COLD ARRIVES BEFORE IT DOES. Hoarfell's `overrun` count was 16/15/15
    // across a 50% body buff — dead flat. It spends the fight WALKING, and while
    // it walked it threatened nothing, so every point of body bought another
    // round of walking rather than a kill. `inRangeDmg` gives the approach teeth
    // without giving the juggernaut a ranged attack it should not have: stand
    // near it and you are already losing.
    //
    // Measured, it is the ONLY lever that moves this boss: 0 -> 6 -> 11 took its
    // ally case 10.4 -> 35.4 -> 41.7 where a 50% body buff had moved it 2. 17 is
    // the third step on that curve.
    roundTick: { fireSpecialEveryN: 3, momentum: { per: 3, max: 12 }, inRangeDmg: 17 },
    // The DAWN half of the pairing: its Special BLINDs, and it hunts what it has
    // blinded. Aurora light off a wall of ice — you do not see it coming, which
    // is a strange thing to say about something this size and exactly the joke.
    vsStatus: { status: "BLIND", bonusDmg: 5 },
    special: {
      name: "Aurora Break",
      cost: 3,
      handler: "barrage",
      // reach 2 = the widened melee square, the Kraken/Rotroot precedent.
      // ANTI-AIR. Every melee boss on the tower was unanswerable-proof against
      // FLYING, and that included the ones whose Specials apply a grounding
      // status: they could not land ROOT or FREEZE on a flier because they
      // could not TARGET one, so the answer needed the answer. `antiAir` lifts
      // only the FLYING dodge — `ranged` would have worked too and would also
      // have thrown away this Special's printed radius.
      params: {
        antiAir: 1, dmg: 17, targets: 99, reach: 2, statusKind: "BLIND", statusDuration: 2 },
      targetSide: "enemy",
      text: "17 DMG and BLIND for 2 rounds to every opponent within 2 spaces — and Whiteout Hunter adds 5 to everything it lands on the blinded.",
    },
  },
  {
    id: "boss_vulcanyx",
    name: "Vulcanyx",
    rarity: "mythic",
    element: "BORE",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, PYRO is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["PYRO"],
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 12,
    // 156 body points, down from 200 — it was the HEAVIEST boss on the tower and
    // no longer needs to be. That 200 was meat bought to cover a kit that was
    // not working; LIFESTEAL does the job properly, so the card got leaner AND
    // stronger in the same pass (70.8% -> 87.5%). Now in line with Hoarfell's 135
    // rather than towering over it.
    //
    // "More meat is not the lever" was the right conclusion from the old sweep
    // (132/26 to 144/28 bought 1.1 points) and "give it a kit that fires without
    // cooperation" was the right prescription — LIFESTEAL is that kit.
    dmg: 41,
    hits: 1,
    hp: 244,
    sp: 8,
    shields: 22,
    // LIFESTEAL — the apex predator EATS, and this is what finally made the card
    // work. It read 70.8%, the weakest fight on Floor 3 by eleven points, and
    // the old comment here guessed wrong about why: it assumed the problem was
    // that Apex Hunger needs kills an opponent can decline to give. Measured,
    // the problem was the opposite. Vulcanyx kills fine — bonus damage does
    // NOTHING for it (vsStatus BURN at +6 and at +10 both read 70.8% to the
    // decimal, because 28 DMG already one-shot anything it touched, so every
    // point past lethal was thrown away). What killed it was dying.
    //
    // So the overkill was traded for sustain. LIFESTEAL alone took it to 90.6%,
    // and cutting DMG 28 -> 18 cost exactly one point (90.6 -> 89.6) because that
    // damage was never being used. 18/110 reads 87.5%.
    keywords: { LIFESTEAL: true },
    tribe: "Mountain Beasts",
    boss: true,
    // Floor 3 — THE APEX. Every other boss on the tower asks "can you get
    // through this"; this one asks "what are you willing to give it". It walks
    // a slot a round and every kill it makes is permanently +3 DMG and 10 HP
    // back, so the reflex that beats a juggernaut — throw a cheap body in front
    // of it and buy a round — is the single worst thing you can do here.
    //
    // That is deliberately the INVERSE of Hoarfell, one floor-mate over: there,
    // standing in front of it is the answer and the cost is the blocker. Here
    // the blocker IS the cost, twice, because it comes back as teeth. Kill it
    // or starve it; there is no third thing.
    passiveNames: { onKill: "Apex Hunger", roundTick: "Magma Tread" },
    // APEX HUNGER, now with a ceiling. +3 a kill is the biggest on-kill ramp in
    // the set (the next is +2) and it was uncapped, on the only boss that also
    // carries LIFESTEAL — so every point of it is healing too. Measured across
    // real fights it reached a mean PEAK of +36 on a printed 41 (worst +81,
    // top swing 122); ENRAGED, where `statScale` multiplies the total including
    // this bonus, mean peak +54, worst +108, top swing 223 into a 366 HP pool.
    // A swing that heals 61% of its own bar is not a snowball, it is a wall.
    //
    // 18 is six kills of growth, and it costs the fight NOTHING where it
    // matters: bare 66.7 -> 64.6 and bare-enraged 75 -> 75 (n=96), because the
    // ramp was overkill in the fights it already won. What it removes is the
    // long grind where the ramp turned a losing position around — with a tamed
    // ally, enraged 59.4 -> 40.6. The lesson the card is built on (chump-block
    // it and you feed it) survives; it just stops being unbounded.
    onKill: { buffDmg: 3, buffDmgMax: 18, healSelf: 10 },
    roundTick: { fireSpecialEveryN: 3, advance: 1 },
    special: {
      name: "Fissure",
      cost: 3,
      // The PYRO half, delivered the BORE way: the ground opens along the lane
      // it is walking down. A COLUMN rather than the reach-2 nova both of its
      // floor-mates throw (the Skeleeze precedent) — the floor should not ask
      // the same positional question three times.
      handler: "barrage",
      // EVERYTHING IN MELEE REACH — the plain 8-square melee box, which is what
      // a Melee card's Special targets when it declares no `reach` at all.
      //
      // It was a COLUMN before (ranged + sameColumn, the whole lane ahead), and
      // before that a BROKEN column: `sameColumn` filters targets the layer has
      // already chosen rather than rescanning, so on a melee card with no reach
      // it narrowed the box down to the one card directly in front. The lane
      // version worked, but the ground opening in a ring around a charging rex
      // is the better read of the card — it walks INTO you, and what it does on
      // arrival should be about where it is standing.
      //
      // No `reach: 2` on purpose: three of its floor-mates already throw a
      // reach-2 nova, and the tight radius is what distinguishes this one. `pen`
      // stays — that is about SHIELDS, not distance, and lava does not care what
      // you are holding up.
      // ANTI-AIR. Every melee boss on the tower was unanswerable-proof against
      // FLYING, and that included the ones whose Specials apply a grounding
      // status: they could not land ROOT or FREEZE on a flier because they
      // could not TARGET one, so the answer needed the answer. `antiAir` lifts
      // only the FLYING dodge — `ranged` would have worked too and would also
      // have thrown away this Special's printed radius.
      params: {
        antiAir: 1,
        dmg: 11, pen: 1, targets: 99,
        statusKind: "BURN", statusDuration: 2, statusPower: 3,
      },
      targetSide: "enemy",
      text: "11 DMG to every opponent in melee reach, through shields, and BURN 3 for 2 rounds on all of it.",
    },
  },
  {
    id: "boss_thunderfangs",
    name: "Thunderfangs",
    rarity: "mythic",
    element: "GALE",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, BOLT is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["BOLT"],
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 12,
    // Fast and sharp rather than heavy: Thunderfangs is the one boss that is
    // NOT supposed to be a wall. Most of its damage is borrowed from the pack
    // and hands itself back as the pack dies, so the printed line is what is
    // left of it when you have done the work.
    dmg: 19,
    hits: 2,
    // Written at 90/10 and it measured 97% — most of its damage is BORROWED
    // from the pack, so a body sized like a Floor-3 boss's on top of that is
    // two bosses' worth of threat. At roughly half it lands in band, and the
    // small printed line is the point: this is what is left of Thunderfangs
    // once you have done the work the fight is asking for.
    // 90/10 -> 50/6 -> 32/3 (body 96 -> 72). Same finding as Umbranova, arrived at
    // the same way: broken down, its 88.5% was 74% OVERRUN and 15% timeout with
    // the player's only wins coming by slaying. The pack was not the cause —
    // halving Pack Law's cap moved it 1 point and removing the wolves ENTIRELY
    // moved it 4 — because the wolves are bodies, and bodies are not what the
    // clock is spent on. The BODY is.
    //
    // Still the smallest printed line on Floor 3, which was always the design:
    // most of this card's damage is borrowed from the pack and handed back as
    // the pack dies.
    //
    // Settled at 76 (69.8%) rather than 72 (60.4%) — the owner wants this one
    // near 70, and it is the top of Floor 3 either way. The curve here is steep:
    // 72 -> 76 -> 80 reads 60.4 -> 69.8 -> 77.1, so four points of body is worth
    // roughly eight of win rate and this number wants leaving alone.
    hp: 70,
    sp: 14,
    shields: 6,
    keywords: {},
    tribe: "Wolf",
    boss: true,
    // Floor 3 — THE PACK, and it is the tower's one INVERSION. Every other boss
    // teaches "kill the source, ignore the tokens"; this one is only dangerous
    // while its escorts live, and the number falls in front of you as they die.
    // The fight tells you what to do without a tutorial: thin the pack first.
    //
    // BOLT is the mechanic half — the storm in its teeth. Thunder Run leaves
    // everything ELECTRIFIED and Storm Teeth hits the afflicted harder, so the
    // Special sets up its own basic exactly the way BOLT's aura does.
    passiveNames: {
      roundTick: "Pack Law", vsStatus: "Storm Teeth",
      onKill: "Raise the Pack", transformAtKills: "Stormform",
      transformOnDefeat: "Last Howl",
    },
    // LAST HOWL: put it down before it has earned Stormform and it takes the
    // form anyway — at 70% of that body, with a PARALYZE shockwave two squares
    // out.
    //
    // It only exists on THIS form, which is the whole rule: kill it as
    // Stormform and it stays dead. So the fight has two answers rather than
    // one — starve it of kills and face a wolf that gets back up, or let it
    // earn the form and kill the thing it became.
    //
    // The burst is timed where it hurts: the round you finally break it is the
    // round your whole board is stacked around it.
    transformOnDefeat: {
      into: "boss_thunderfangs_2",
      hpPct: 0.7,
      burst: { status: "PARALYZE", duration: 2, reach: 2 },
    },
    // Raise the Pack: every kill puts another Spark Wind Wolf on the board. It
    // feeds the boss twice over — a body, and another point of Pack Law, which
    // is the stat its own damage is borrowed from. The wolves ELECTRIFY what
    // they bite and Storm Teeth adds 4 against the electrified, so the pack
    // sets its leader up as well as escorting it.
    onKill: { spawnToken: { token: "gale_sparkwolf_tok", count: 1, maxAlive: 3, everyNKills: 2 } },
    // STORMFORM at five kills: the hunt becomes the storm. +20% on every line
    // (10/50/14/6 -> 12/60/17/7), taken as a real second form rather than a
    // buff, so the art and the name change with it and the board can see what
    // it has become.
    transformAtKills: { kills: 5, into: "boss_thunderfangs_2" },
    vsStatus: { status: "ELECTRIFIED", bonusDmg: 4 },
    // PACK LAW moves it, too. It used to carry plain `advance` — Acorn's Seed
    // Roll — so the one boss whose entire design is "only dangerous with the
    // pack up" walked down the board ahead of its wolves and died there.
    roundTick: {
      fireSpecialEveryN: 3,
      packDmg: { tribe: "Wolf", per: 3, max: 12 },
      escortAdvance: { need: 2 },
    },
    special: {
      name: "Thunder Run",
      cost: 3,
      handler: "barrage",
      // ANTI-AIR. Every melee boss on the tower was unanswerable-proof against
      // FLYING, and that included the ones whose Specials apply a grounding
      // status: they could not land ROOT or FREEZE on a flier because they
      // could not TARGET one, so the answer needed the answer. `antiAir` lifts
      // only the FLYING dodge — `ranged` would have worked too and would also
      // have thrown away this Special's printed radius.
      params: {
        antiAir: 1,
        dmg: 9, targets: 99, reach: 2,
        statusKind: "ELECTRIFIED", statusDuration: 2,
      },
      targetSide: "enemy",
      text: "9 DMG and ELECTRIFIED for 2 rounds to every opponent within 2 spaces — and Storm Teeth adds 4 to everything it lands on the afflicted.",
    },
  },
  {
    id: "boss_thunderfangs_2",
    name: "Thunderfangs, Stormform",
    rarity: "mythic",
    element: "GALE",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, BOLT is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["BOLT"],
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 12,
    // Every printed line +20% off the first form (10/36/14/3), rounded to the
    // nearest whole: body 76 -> 92. Not a floor-4 body and not meant to be —
    // this is Floor 3's boss having earned five kills, not a bigger boss. Moves
    // whenever the first form moves; a test pins the +20% relationship.
    dmg: 23,
    hits: 2,
    hp: 84,
    sp: 17,
    shields: 7,
    keywords: {},
    tribe: "Wolf",
    boss: true,
    // NOT reachable except by transforming: it is absent from VOID_BOSSES, so
    // no floor lists it and nothing summons it. The `boss` flag keeps it out of
    // every acquisition path exactly like the rest.
    passiveNames: { roundTick: "Pack Law", vsStatus: "Storm Teeth", onKill: "Raise the Pack" },
    vsStatus: { status: "ELECTRIFIED", bonusDmg: 4 },
    onKill: { spawnToken: { token: "gale_sparkwolf_tok", count: 1, maxAlive: 3, everyNKills: 2 } },
    roundTick: {
      fireSpecialEveryN: 3,
      packDmg: { tribe: "Wolf", per: 3, max: 12 },
      escortAdvance: { need: 2 },
    },
    // No further transform — Stormform is the end of the line, and the guard in
    // `registerKill` (defId === into) would stop a loop anyway.
    special: {
      name: "Thunder Run",
      cost: 3,
      handler: "barrage",
      // ANTI-AIR. Every melee boss on the tower was unanswerable-proof against
      // FLYING, and that included the ones whose Specials apply a grounding
      // status: they could not land ROOT or FREEZE on a flier because they
      // could not TARGET one, so the answer needed the answer. `antiAir` lifts
      // only the FLYING dodge — `ranged` would have worked too and would also
      // have thrown away this Special's printed radius.
      params: {
        antiAir: 1,
        dmg: 11, targets: 99, reach: 2,
        statusKind: "ELECTRIFIED", statusDuration: 2,
      },
      targetSide: "enemy",
      text: "11 DMG and ELECTRIFIED for 2 rounds to every opponent within 2 spaces — and Storm Teeth adds 4 to everything it lands on the afflicted.",
    },
  },
  {
    id: "boss_umbranova",
    name: "Umbranova",
    rarity: "mythic",
    element: "PYRO",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, DAWN is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["DAWN"],
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 12,
    dmg: 41,
    hits: 1,
    // 150/15 -> 90/9 -> 60/5 (body 128 -> 90). Lighter than Thunderfangs' 96 on
    // the floor below, and that is consistent rather than strange: this boss has
    // never needed meat, because its damage ignores position and escalates.
    //
    // THE NUMBERS THAT MATTERED, measured. Umbranova sat at 94.8% and was the one
    // boss NOTHING moved — not the Fortress Gates, not the reach fix, not the
    // overrun changes. Breaking its wins down showed why: 69% overrun, 26%
    // TIMEOUT, and 0% elimination. The player was never killing it at all. So the
    // Special was not the problem and the sweeps say so — 6 damage instead of 10
    // still read 88.5%, and removing `pen` entirely changed NOTHING. Its body was
    // the problem, because the body is what the clock is spent on.
    //
    // 60 -> 100 (body 90 -> 130) at the owner's call. Worth knowing what that
    // walks back toward: 128 is the body the two paragraphs above tore down for
    // reading 94.8%. It is NOT the same 128, because that measurement predates
    // the Fortress Gates, the auto-fire reach fix and the overrun rework — and
    // measured after all three, this was the WEAKEST fight on Floor 4 (60.4%,
    // against Cryovex and Kato at 70.8 and Kazehaya at 67.7).
    //
    // HP is a very strong lever on THIS boss specifically — swept in one pass:
    //
    //     hp 60   60.4%       hp 100   82.3%
    //     hp 80   77.1%       hp 120   86.5%
    //
    // which is the mirror image of the finding above. Damage did nothing to this
    // fight (6 instead of 10 read 88.5%, dropping `pen` read the same) because
    // the Special was never what decided it; HP moves it 22 points across the
    // same span, because the body IS what the clock gets spent on and Meteor
    // Fall means the player cannot shorten the clock by repositioning.
    //
    // 100 is the owner's call and it puts this ~12 points clear of the rest of
    // the floor. That is a deliberate difficulty ordering, not a miss — if it
    // should come back into band, 80 is the nearest rung.
    hp: 336,
    sp: 8,
    shields: 17,
    keywords: {},
    // IT ACTUALLY SHOOTS. Same hole Stormwing had: `attackType: "Ranged"` caps a
    // basic at reach 2 from the row it was summoned in and 3 once it advances
    // off it, and `avoidLateral` never advances at all — so measured, the boss
    // whose entire lesson is "position buys nothing" reached rows 1 and 2 with
    // its own attack and could not touch the back half of the board.
    //
    // That was the one place on this card where position bought EVERYTHING, and
    // it sat directly against the fight's premise. `ignoresHomeRule` drops the
    // reach cap and the sight screen, so the basic finally agrees with Meteor
    // Fall about what kind of boss this is.
    ignoresHomeRule: true,
    tribe: "Dragon",
    // Dragon's Fury (tribe trait): every kill is +1 DMG, permanently.
    onKill: { buffDmg: 1 },
    boss: true,
    // Floor 4 — THE RAIN, and it is the first boss the board cannot answer.
    // Every other fight in the tower is decided by WHERE you stand: get out of
    // Helion's lane, block Hoarfell, thin Thunderfangs' pack, reach Rotroot.
    // Meteor Fall lands on every opponent alive, wherever they are, so position
    // buys nothing at all. What is left is sustain, armour, or killing it
    // before the sky finishes falling.
    //
    // And it ESCALATES: every cast makes the next one worse, permanently
    // (onSpecialUse). That turns the 24-round clock from a deadline into a
    // countdown you can hear getting louder — eight casts is the whole fight,
    // and the eighth is not the first.
    //
    // NO FLYING, deliberately, however much a dragon wants it: FLYING is
    // immunity to Melee outright, and "own ranged cards or you cannot
    // participate" is the lockout that came off Nightshrike. A boss whose
    // damage already ignores position must not also be unreachable.
    passiveNames: { onKill: "Dragon's Fury", ignoresHomeRule: "Skyfire", onSpecialUse: "Kindling", alwaysHit: "Coronal", roundTick: "High Circle" },
    // Coronal, the DAWN half: light does not miss. Deterministic, which the
    // mode requires — a board-wide nuke that sometimes whiffs would make the
    // countdown unreadable.
    alwaysHit: true,
    // Kindling +3 -> +2. Eight casts used to run 10,13,16,19,22,25,28,31; it now
    // runs 7,9,11,13,15,17,19,21 — still a countdown that gets louder, and still
    // the loudest thing in the tower, but one the player can outlive long enough
    // to reach the dragon.
    onSpecialUse: { dmg: 2 },
    // ALOOF. Meteor Fall ignores position entirely, so closing buys Umbranova
    // nothing and distance costs it nothing — it drifts toward the emptiest
    // lane instead, the mirror of Helion's Traverse. Previously it did not
    // move at all, which is not a personality, it is an omission.
    roundTick: { fireSpecialEveryN: 3, avoidLateral: true },
    special: {
      name: "Meteor Fall",
      cost: 3,
      handler: "smite",
      // `smite` with no requireStatus is every living opponent, ignoring range.
      // pen, because shields are one of the three real answers and stripping
      // them is the point — a wall you can hide behind forever is a fourth.
      // 7 -> 17. THE BODY WAS SCALED AND THE SPECIAL WAS NOT — across three
      // retunes this card went to 336 HP and a 41 basic while Meteor Fall still
      // hit the whole board for SEVEN. That is the whole of its "saturation":
      // more body simply meant more rounds of a Special that could not matter.
      // 17 measured 94.8% with an ally and 14 measured 93.8% — it saturates at the
      // top, so the dial-back has to go further than the gap suggests.
      params: { dmg: 12, pen: 1 },
      targetSide: "enemy",
      text: "The sky falls: 12 DMG to every opponent on the board, through shields, wherever they stand. Each cast makes the next one worse.",
    },
  },
  {
    id: "boss_cryovex",
    name: "Cryovex",
    rarity: "mythic",
    element: "AQUA",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, DUSK is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["DUSK"],
    cardClass: "Tank",
    attackType: "Melee",
    cost: 12,
    // 131 body points, sized against Umbranova's 128 rather than against Floor
    // 4's 350 cap — the cap has measured 97-100% every time anyone has built to
    // it. Written at 163 first and trimmed, though honestly the number barely
    // matters here: see below.
    //
    // NOTHING MOVES THIS FIGHT IN THE HARNESS. Measured across the whole design
    // space — 7 / 5 / 4 / 3-body formations, Absolute Zero freezing for 2 or 1,
    // Hoarbite on and off, the crystals inert, and NO FREEZE ANYWHERE AT ALL —
    // every single variant read between 97.9% and 100.0%, with 79-85% of the
    // wins ending by overrun. Floor 4 is where the AI cannot hold a board, so
    // the fight ends in the back line whatever the boss is doing. Umbranova is
    // the same shape at 96.9%. Do not tune this card against those numbers; the
    // rule is what decides it. Its FEEL is what the kit below is for.
    dmg: 33,
    hits: 1,
    hp: 200,
    sp: 6,
    shields: 41,
    keywords: {},
    tribe: "Dragon",
    boss: true,
    // Floor 4 — THE DEEP FREEZE, and the tower's second Floor-4 fight beside
    // Umbranova. AQUA gives the tribe (Dragon spans all eight elements, so an
    // ice flight is the tribe behaving normally rather than a compromise) and
    // DUSK gives the mechanic: the cold that does not stop once it has you.
    //
    // THE LESSON: break the freeze EARLY. Deep Freeze adds 4 damage for every
    // round a target has been held, to +16, and the counter resets the moment
    // the freeze lifts — so cleanse is not a tax here, it is the fight. Waiting
    // out a freeze is how you lose, which is the exact inverse of Xilty's lock
    // one floor down, where the answer was to bank a round and play through it.
    passiveNames: {
      vsFrozenRamp: "Deep Freeze", onKill: "Crystal Bloom",
      onHitStatus: "Hoarbite", roundTick: "Glacial Advance",
    },
    vsFrozenRamp: { per: 4, max: 16 },
    // Hoarbite: it freezes what it touches, so it starts its own clock.
    onHitStatus: { kind: "FREEZE", duration: 1, power: 0 },
    // Crystal Bloom: every kill grows a Blackice Crystal, capped at three alive.
    // The crystals keep the freezes running and burst into another freeze when
    // killed, which is what makes Deep Freeze climb without Cryovex having to do
    // anything itself.
    onKill: { buffDmg: 1, spawnToken: { token: "aqua_blackice_crystal_tok", count: 1, maxAlive: 3 } },
    roundTick: { fireSpecialEveryN: 3, advanceEveryN: 2 },
    special: {
      name: "Absolute Zero",
      cost: 3,
      handler: "barrage",
      // REACH 3, damage 7 -> 12, raised to sit level with the rest of Floor 4.
      //
      // Reach first, and that ordering is the finding: this is a nova, and on a
      // 5x5 board the radius is what decides how much of the player's side it
      // touches. Measured in one pass from 70.8% —
      //
      //     reach 3                 80.2%
      //     reach 3 + dmg 12        86.5%   <- shipped
      //     reach 3 + dmg 12 + 110hp 95.8%  <- overshoots badly
      //
      // The body is deliberately NOT raised. It was already the heaviest on the
      // floor at 131, and adding to it took the fight straight past every
      // neighbour. Kazehaya's sweep said the same thing about the same shape.
      //
      // FREEZE 2 still rather than damage-heavy: the Special exists to START
      // clocks on everything nearby, and Deep Freeze (+4 a round held, to +16)
      // is what turns them into damage — so a wider radius compounds through
      // the ramp rather than just hitting harder once.
      // ANTI-AIR. Every melee boss on the tower was unanswerable-proof against
      // FLYING, and that included the ones whose Specials apply a grounding
      // status: they could not land ROOT or FREEZE on a flier because they
      // could not TARGET one, so the answer needed the answer. `antiAir` lifts
      // only the FLYING dodge — `ranged` would have worked too and would also
      // have thrown away this Special's printed radius.
      params: {
        antiAir: 1,
        dmg: 12, targets: 99, reach: 3,
        statusKind: "FREEZE", statusDuration: 2,
      },
      targetSide: "enemy",
      text: "12 DMG and FREEZE for 2 rounds to every opponent within 3 spaces — and Deep Freeze then hits the frozen for 4 more per round they have been held, to +16.",
    },
  },
  {
    id: "boss_kazehaya",
    name: "Kazehaya",
    rarity: "mythic",
    element: "LEAF",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, GALE is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["GALE"],
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 12,
    // 129 body points, sized against its Floor-4 neighbours rather than the
    // floor's 350 cap — building to that cap has measured 97-100% every single
    // time anyone has tried it.
    //
    // THE SPECIAL IS THE LEVER HERE, not the body, and that is the opposite of
    // what the same sweep found one seat over on Kato's jet (whose Special was
    // unraisable — 10 and 40 damage read identically). Measured in one pass:
    //
    //     old Special, hp 60   67.7%      new Special, hp  80   85.4%
    //     new Special, hp 60   82.3%      new Special, hp 100   88.5%
    //
    // Reach 3 is why. A nova that catches three squares out on a five-square
    // board is catching most of what the player owns, and hauling it two slots
    // in leaves it standing next to a 15-damage sword.
    dmg: 40,
    hits: 1,
    // 60 -> 80 (body 109 -> 129) at the owner's call, and the SMALLER half of
    // what moved this fight. See the Special: 15 damage on a reach-3 nova was
    // worth +14.6 points on its own, before a single hit point was added.
    hp: 211,
    sp: 10,
    shields: 31,
    keywords: {},
    tribe: "Grove",
    boss: true,
    art: "boss_kazehaya",
    // Floor 4 — THE DUELLIST, and the fourth fight on the top floor. LEAF gives
    // the tribe (a grove that has learned to hold a line) and GALE gives the
    // mechanic: wind, which on this card means the board itself moving.
    //
    // THE LESSON: it punishes the BIG SWING. Everything else on the tower is
    // answered by hitting it as hard as you can as fast as you can, and doing
    // that here throws your own line backwards and takes its damage with it —
    // Gale Riposte trips on any single blow over 15, and the whole swing counts,
    // so hiding the hit behind its shields does not help. The answer is small,
    // frequent damage, which is the exact inverse of the fight one seat over:
    // Cryovex has to be broken early and hard.
    //
    // And it does not let you keep your distance either. Cutting Wind DRAGS what
    // it hits into contact, so a ranged line gets reeled into the reach of a
    // melee mythic and then has to walk back out — which is the second half of
    // the same idea. The two halves fight each other on purpose: come close and
    // you are inside a 15-damage sword, stay back and it pulls you in anyway.
    passiveNames: {
      onHeavyHit: "Gale Riposte", roundTick: "Iai Stance",
      shieldPerHitTaken: "Heartwood",
    },
    // HEARTWOOD: it regrows its own armour, one plate per blow it took — up to
    // 9, which is MOST of the 14 it prints and deliberately not all of them. A
    // full rebuild measured 62.5% with an ally against floormates at 32-51: it
    // over-corrected past the thing it was repairing. The ceiling is the lever
    // and the curve is steep at the top —
    //
    //     no Heartwood  11.5%      cap 8   36.5%      cap 10  49.0%
    //     cap 4         19.8%      cap 9   45.8%  <-  cap 14  62.5%
    //     cap 6         26.0%
    //
    // 9 puts it between Cryovex (44.8) and Kato (51.0) rather than at either
    // end. Bare it reads 96.9%, second only to Cryovex on the floor.
    //
    // This is not a buff so much as a REPAIR of one, and the measurement is why
    // it exists. Photosynthesis used to regrow any LEAF card to its printed
    // shields plus three; it is now a flat cap of 3, which is the right rule for
    // the element and lands almost entirely on ONE card — this one. A LEAF boss
    // printing 14 shields, fielding Warden (4) and two Sakuroot (4), lost
    // its armour permanently the first time it was stripped. Isolated at 35
    // points of win rate: 46.9% with the old ceiling against 11.5% with the new
    // one, while every other boss on the tower moved 0-2.
    //
    // Given back on the CARD rather than by reverting the element rule, because
    // the element rule was the thing that was wrong and this boss is the thing
    // that depended on it. Same mechanism Squanch carries, and a tree that
    // grows its bark back is not a new idea for it.
    shieldPerHitTaken: { shields: 1, maxShields: 20 },
    // Gale Riposte. 40 is set to its OWN damage deliberately: the threshold a
    // player has to stay under is printed on the card twice, once as the number
    // and once as the sword that enforces it.
    onHeavyHit: { over: 40, reach: 2, push: 1, status: "WEAKEN", statusDuration: 2 },
    // IAI STANCE — it squares up rather than closing. `aimLateral` slides it
    // along to line its column up with a target and it never advances a row,
    // which is the whole posture: the duellist does not walk to you. Cutting
    // Wind is what closes the distance, and it closes it in the wrong direction
    // for whoever is standing there.
    //
    // It shambled forward like Permafrost and Cryovex when first written, which
    // was three bosses on one gait and, worse, a samurai jogging up the board.
    roundTick: { fireSpecialEveryN: 3, aimLateral: true },
    special: {
      name: "Cutting Wind",
      cost: 3,
      handler: "barrage",
      // `pullToCaster` rather than `pull`: the rope closes sideways and
      // backwards too, so a card that slipped past the samurai gets hauled back
      // to it rather than merely shuffled one row toward its home.
      //
      // A LONGER ROPE, at the owner's call: reach 2 -> 3 and the haul 1 -> 2.
      // Both halves of "range" moved on purpose — it now catches things a full
      // three squares out AND drags them twice as far in, so slipping the net is
      // a matter of leaving the samurai's half of the board rather than of
      // standing one square further back.
      //
      // Damage 8 -> 15. It was low BY DESIGN (the sword was meant to be how this
      // boss killed, the Special only undoing your positioning) and that reading
      // is now retired: at 15 the Special is a real threat on its own, and 15 is
      // also the Riposte's threshold — the boss hits its own magic number with
      // both hands.
      // ANTI-AIR. Every melee boss on the tower was unanswerable-proof against
      // FLYING, and that included the ones whose Specials apply a grounding
      // status: they could not land ROOT or FREEZE on a flier because they
      // could not TARGET one, so the answer needed the answer. `antiAir` lifts
      // only the FLYING dodge — `ranged` would have worked too and would also
      // have thrown away this Special's printed radius.
      params: {
        antiAir: 1,
        dmg: 15, targets: 99, reach: 3, pullToCaster: 2,
        statusKind: "ROOT", statusDuration: 1,
      },
      targetSide: "enemy",
      text: "15 DMG to every opponent within 3 spaces, hauls each of them 2 slots into contact, and ROOTs them there for a round.",
    },
  },
  {
    id: "boss_spindle",
    name: "Spindle",
    rarity: "mythic",
    element: "VOID",
    // Floor 5 is a THREE-element design, and VOID can only print one of them.
    // VOID is the tribe (the brood of eyes), DUSK is the mechanic its Special
    // expresses (the gaze that blinds), BOLT is the lock it puts on a Special
    // it does not like. `elementAuras` must list exactly the two it does NOT
    // print -- void-tower.test.ts asserts the card and its VOID_BOSSES entry
    // agree, which is how sixteen bosses were caught running one element while
    // their entry described two.
    elementAuras: ["BOLT", "DUSK"],
    cardClass: "Mage",
    tribe: "Watcher",
    attackType: "Ranged",
    boss: true,
    cost: 12,
    // 22*2 + 290 + 28*2 + 10 = 400.
    //
    // NOT the 660 the Floor-5 cap allows, and the cap is the trap here: it is a
    // CEILING and the spread underneath it is the tuning. Its floor-mates are
    // measured at 337 (Skybreaker) and 511 (Continental), so 400 sits between
    // them -- and this boss should be the SMALLER kind of Floor 5, because the
    // threat is not the body. It brings nine Watchers, every one of them running
    // One Eyes, so the fight is a brood stealing a point of damage per swing and
    // deflecting every fourth blow back. Meat on top of that is two bosses.
    //
    // It needs no printed steal or deflect for the same reason: One Eyes is
    // VOID's ELEMENT aura, so the boss and all nine spawns run it for free.
    dmg: 22,
    hits: 2,
    hp: 290,
    sp: 10,
    shields: 28,
    keywords: { PEN: true },
    // A GIANT, like the rest of Floor 5 — and the plate is the argument. The
    // eye is the middle of the card and the LEGS are the rest of it: they come
    // down through the spires on both sides and out past the frame, so the
    // thing is not standing somewhere on the board, it is standing OVER it.
    // Skybreaker and Continental both reach the whole board on the same
    // reasoning; this was the Floor-5 boss that did not, which was an oversight
    // rather than a decision. The sight screen still applies, so the player's
    // free wall of Fortress Gates is still cover.
    fullBoardBasic: true,
    // THE 3-ROUND CLOCK every boss is on, plus a gait. `kite` because a giant
    // eye keeps its sight lines: it backs off as the board closes rather than
    // standing to be hit. Deliberately not "still" -- that list is NAMED
    // (Overclock is a production line, Smolder is a tree) and a third cannot
    // join it by accident.
    roundTick: { fireSpecialEveryN: 3, kite: { belowPct: 50 } },
    special: {
      name: "Unblinking Gaze",
      cost: 4,
      // NO `cooldown`. The boss clock owns boss timing -- `fireSpecialEveryN`
      // above is the beat, and void-tower.test.ts fails a boss Special that
      // declares its own.
      handler: "statusNova",
      // The two borrowed elements, in one button: BOLT's lock and DUSK's dark.
      params: { targets: 3, statusKind: "MUTED", statusDuration: 2,
                debuffStatus: "BLIND", debuffStatusRounds: 2 },
      targetSide: "enemy",
      text: "It looks at three of you: MUTED for 2 rounds, and BLIND for 2. 3-round cooldown.",
    },
  },
  {
    id: "boss_kheiringer",
    name: "Princess Kheiringer",
    rarity: "mythic",
    // PYRO gives the tribe, BORE gives the mechanic — she is fire, and what she
    // stands on and behind is obsidian. Floor 5 allows a third element; she does
    // not take one, because two is what the picture has in it.
    element: "PYRO",
    elementAuras: ["BORE"],
    cardClass: "Mage",
    attackType: "Ranged",
    tribe: "Volcanic",
    boss: true,
    cost: 12,
    // 20x2 + 230 + 18x2 + 12 = 318 body against Floor 5's 660 cap, and the
    // LIGHTEST body on the floor by a distance (Spindle 290hp, Skybreaker 269,
    // Continental 360). Deliberately: she is not the wall, the wall is the wall.
    // What she is, is the reason standing behind it is a problem.
    dmg: 20,
    hits: 2,
    hp: 230,
    sp: 12,
    shields: 18,
    keywords: {},
    // A GIANT's reach, like the rest of Floor 5 — she rains fire on the board
    // rather than on whatever is nearest, and a stationary ranged boss without
    // the reach cannot answer anything that stays two squares away.
    fullBoardBasic: true,
    art: "boss_kheiringer",
    passiveNames: { avoidLateral: "Highborn", spawn: "Call the Deep" },
    // SHE DOES NOT COME TO YOU. `avoidLateral` slides her along the row toward
    // the emptiest column — away from whatever is closing — which is what a
    // caster with a fortress in front of her and giants in front of that would
    // actually do. It is also the one gait that reads as "stays back" without
    // making a fourth boss that never moves at all, which the roster spread
    // would refuse.
    //
    // ...and the giants keep coming: one every round, to a ceiling of two
    // standing at once, so killing one is progress rather than a treadmill.
    roundTick: {
      fireSpecialEveryN: 3,
      avoidLateral: true,
      spawn: { token: "pyro_fire_giant_tok", count: 1 },
      spawnMaxAlive: 2,
    },
    special: {
      name: "Rain of Fire",
      cost: 4,
      handler: "barrage",
      // Both hands are up and open on the plate and the sky is already alight.
      // It does not pick a target; it lands on the board.
      params: { dmg: 12, targets: 99, statusKind: "BURN", statusPower: 3, statusDuration: 3 },
      targetSide: "enemy",
      ranged: true,
      text: "12 DMG to every opponent and BURN 3 for 3 rounds. 3-round cooldown.",
    },
  },
  {
    id: "boss_skybreaker",
    name: "Skybreaker",
    rarity: "mythic",
    // A THREE-ELEMENT CARD, which Floor 5 is the first floor to allow. GALE is
    // the printed element; `elementAuras` makes it behave as BOLT and AQUA too,
    // so it runs those elements' auras and its basics carry their on-hit riders
    // — a hurricane is wind over warm water with lightning in it, and here it
    // actually is all three rather than being described as three.
    //
    // Held back on the first pass precisely because it is REAL power and not
    // flavour; it is measured now (see the MEASURED note in void-tower.test.ts).
    element: "GALE",
    elementAuras: ["BOLT", "AQUA"],
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 12,
    // 3 x 16 + 288 + 20 = 356 body points against Floor 5's 660 cap. Well
    // under, like every boss that has ever been measured: building to the
    // ceiling has read 97-100% every time it has been tried, and the number
    // under it is the tuning. Owner-specified stat line — 298 -> 269 -> 288,
    // the last step because it measured as the floor's outlier at 70.8% where
    // the other three sat between 82 and 91.
    dmg: 16,
    hits: 3,
    hp: 288,
    sp: 20,
    shields: 0,
    keywords: {},
    tribe: "Hurricane",
    boss: true,
    // A GIANT. Floor 5's bosses tower over the board and their BASIC attacks
    // reach all of it — which matters most on THIS one, because it never walks:
    // without the reach a stationary boss simply cannot answer anything that
    // stays two squares away. The sight screen still applies, so the player's
    // free wall of Fortress Gates is still cover.
    fullBoardBasic: true,
    art: "boss_skybreaker",
    // FLOOR 5, and the first boss on it. GALE gives the tribe, BOLT gives the
    // mechanic.
    //
    // THE LESSON: it never moves, and it is never where you left it. Skybreaker
    // has NO movement tick at all — no `advance`, no `aimLateral`, nothing — so
    // it sits on its home row and shoots. Its only way forward is Eye of the
    // Storm, which trades places with its own hurricane. That makes the token
    // the boss's legs, and it turns the obvious instinct into a real decision:
    // kill the hurricane and the boss is stranded at the back but you have
    // spent your damage on a token; leave it standing and the boss can blink
    // into the middle of your line whenever the clock comes round.
    //
    // Both answers cost something, which is what stops it having a right one.
    passiveNames: {
      fullBoardBasic: "Titan's Reach",
      onHitStatus: "Vapor Waves",
      slowEnemies: "Storm Front",
      cycloneSpin: "High-Speed Cyclone",
      spawnOnRound: "Gathering Storm",
    },
    // VAPOR WAVES — the AQUA half, on the basics rather than in the elements.
    onHitStatus: { kind: "SCALD", duration: 2, power: 2 },
    roundTick: {
      // THE CLOCK, and it is the one thing in this fight a player can plan
      // around exactly: the hurricane forms on round 6, wherever the board is
      // then. `minRow: 2` keeps it off the boss's own back line — the storm
      // gathers out over the field, not behind the thing that called it.
      spawnOnRound: { round: 6, token: "gale_thundering_hurricane_tok", minRow: 2, spawnMaxAlive: 1 },
      // STORM FRONT: -2 SP to every opponent, every round. SP is this game's
      // tempo currency — it is queue order AND move reach — so this is a tax on
      // the two things a player uses to answer a stationary boss.
      slowEnemies: 2,
      // HIGH-SPEED CYCLONE: everything the player owns is carried one step
      // clockwise around the boss each round. It preserves distance and
      // destroys FORMATION, which is the resource a one-move-a-turn game is
      // actually made of.
      cycloneSpin: 1,
      fireSpecialEveryN: 3,
    },
    special: {
      name: "Eye of the Storm",
      cost: 4,
      handler: "stormCall",
      // ONE SPECIAL, TWO FACES, picked by whether the storm is already up — see
      // `stormCall` in combat.ts. No hurricane: call one. Hurricane standing:
      // trade places with it, break its wind wake over the field again, and
      // blast whatever is now next to the boss.
      // 25 -> 15 (owner's call). Worth stating plainly: this is a FLAVOUR
      // change, not a balance one. Measured at n=192 with the clock at three,
      // Eye of the Storm's damage is inert — 25 reads 95.8% and ZERO reads
      // 97.4%, and its PARALYZE is the same story (2r / 1r / 0r → 95.8 / 95.3
      // / 95.3). So is the teleport itself: swap off with the hurricane left
      // intact reads 97.4%.
      //
      // What this fight is actually made of is the HURRICANE AS A BODY —
      // replacing it with a 1-cost wolf reads 87.0%. Every lever that has ever
      // moved this boss traces back to that: the token going Ranged (+18.7,
      // because a ranged token survives where a melee one walks up and dies)
      // and the clock at seven (-7.8, because a slower clock is fewer casts).
      params: {
        token: "gale_thundering_hurricane_tok",
        dmg: 15, reach: 1, statusDuration: 2,
      },
      // "self": the handler picks its own victims from wherever the boss lands
      // AFTER the swap, so there is no slot for the caster to nominate — the
      // square it will be standing in does not exist yet at target-selection
      // time. `stormCall` is in TARGETLESS_HANDLERS for the same reason.
      targetSide: "self",
      text: "No hurricane on the field: call one. Otherwise trade places with it, break its wind wake over the board, and deal 15 DMG to every opponent within 1 space of where Skybreaker lands, PARALYZING them for 2 rounds.",
    },
  },
  {
    id: "boss_continental",
    name: "Continental",
    rarity: "mythic",
    // BORE printed, LEAF carried — "Bore and Leaf auras", and `elementAuras` is
    // how a card actually RUNS a second element's aura rather than being
    // described as having it. Two elements, not three: Floor 5 ALLOWS a third,
    // it does not require one.
    element: "BORE",
    elementAuras: ["LEAF"],
    cardClass: "Tank",
    attackType: "Melee",
    cost: 12,
    // 50 + 360 + 50x2 + 1 = 511 body points against Floor 5's 660 cap. Still the
    // heaviest body on the tower by a distance, and the stat line is the
    // owner's — HP came down from 400. SP 1 is the counterweight: it acts
    // near-last in every queue it is ever in, so everything on the board hits it
    // before it hits back.
    dmg: 50,
    hits: 1,
    hp: 360,
    sp: 1,
    shields: 50,
    // TRAMPLE: it does not go around. Paired with the gait below, that is the
    // whole body language of the card — it is not fast and it does not stop.
    keywords: { TRAMPLE: true },
    tribe: "Cavernous",
    boss: true,
    // A GIANT, and a MELEE one — which is why `fullBoardBasic` had to learn to
    // lift melee adjacency and not only the ranged reach cap. A rule that
    // reached half of Floor 5 would be a rule about half of Floor 5.
    fullBoardBasic: true,
    art: "boss_continental",
    // FLOOR 5's second boss. BORE gives the tribe, LEAF gives the mechanic.
    //
    // THE LESSON: it is the only thing on the tower you are not supposed to
    // out-damage. 400 HP behind 50 shields, and shields block PER HIT — so the
    // multi-hit, many-small-blows answer that beats Kazehaya is the worst
    // possible answer here, and the fight inverts the one two floors below it.
    //
    // AND IT COMES TO YOU, eventually. It holds its home row while your
    // Fortress Gates stand, sliding along it to line up on whatever hits
    // hardest; the round the last gate falls it starts walking. So the wall is
    // not just cover, it is the clock — every gate you spend is time, and the
    // boulders are what spend them for you.
    passiveNames: {
      fullBoardBasic: "Titan's Reach",
      roundTick: "Continental Drift",
      spawnEveryN: "Rockfall",
    },
    roundTick: {
      // CONTINENTAL DRIFT. Lateral while the wall stands — and aimed at the
      // biggest HITTER rather than the biggest crowd, which is the question a
      // siege engine actually asks.
      aimLateral: true,
      aimLateralBy: "topDmg",
      // ...then it walks, and only then. TWO holds, and it needs BOTH released:
      // not a step before round 15 — half of the tower's 30-round clock — and
      // not while a single Fortress Gate still stands. So the first half of
      // this fight is fought entirely against its boulders and its reach, and
      // the giant itself only ever arrives late.
      advance: 1,
      advanceFromRound: 15,
      advanceWhenWallsDown: true,
      // ROCKFALL: a boulder every even round, in the row in front of it.
      // ROCKFALL, on the boss's own beat. Every 2 rounds at 3 alive was one tap
      // of two and the smaller one: the Special's on-kill rider poured rocks in
      // over the top of this cap without checking it, which is why moving this
      // number 3 -> 1 measured -1.0 and nothing else. Capped on BOTH taps now,
      // and slowed to the clock the rest of the boss runs on.
      spawnEveryN: { n: 3, token: "bore_rolling_boulder_tok", spawnMaxAlive: 2 },
      fireSpecialEveryN: 3,
    },
    special: {
      name: "Rolling Boulder",
      cost: 4,
      handler: "boulderThrow",
      // ...and on a KILL the rock stays, in the square the body left. That is
      // what makes this Special more than chip damage: every kill it lands
      // converts into a rolling body the player then has to answer.
      // `maxAlive`: the rider is capped like Rockfall is. Uncapped, a kill every
      // three rounds meant a board that only ever gained rocks, and the printed
      // Rockfall ceiling was decorative — see the note on `spawnEveryN` above.
      params: { dmg: 35, spawnOnKill: "bore_rolling_boulder_tok", maxAlive: 2 },
      // "self": the handler picks its own victim, board-wide and at random.
      targetSide: "self",
      text: "Hurls a boulder at one random opponent anywhere on the board for 35 DMG. If that kills it, the boulder settles in its square and starts rolling — up to 2 rolling from this at a time.",
    },
  },
  {
    id: "boss_kato",
    name: "Kato",
    rarity: "mythic",
    element: "BORE",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, BOLT is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["BOLT"],
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 12,
    // THREE BODIES, so each is small: 62 + 74 + 72 = 208 across a fight the
    // player has to win three times. Only the FIRST form is checked against
    // Floor 4's 350 cap — the other two are reached by the chain and carry no
    // VOID_BOSSES entry, exactly like Stormform.
    //
    // BODY IS A WEAK LEVER HERE, measured: 40/40/34, 36/36/30 and 32/32/26 read
    // 83.3%, 79.2% and 82.3% — all inside noise. Three lives means trimming each
    // shell removes only a fraction of the total, so if this ever needs moving,
    // move the CHAIN (a form's keywords, or how many forms there are) rather
    // than the numbers on any one of them.
    //
    // And that is exactly what happened: giving each shell its own HANDLER, and
    // the jet its bank-across, took the fight 79.2% -> 67.7% while the numbers
    // stayed put — and doubled how often the chain runs its full length (26% ->
    // 42% of fights reach Stormwing). The kit is the lever on a chain, not the
    // stat line.
    // RAISED TO MATCH THE FLOOR (69.8% -> 85.4%), and the route there is the
    // whole lesson of this card. BODY ALONE HITS A HARD CEILING: +40, +55 and
    // +70 HP read 78.1 / 81.3 / 82.3, and adding SHIELDS on top of any of them
    // read 82.3 four times over — the same number, four different ways. The win
    // types said why: 72-75 of 96 wins were TIMEOUTS, so more body just bought
    // more timeouts. Kato was not losing because it died, it was losing because
    // it could not kill fast enough. +6 basic DMG on each shell is what broke
    // the ceiling (hp+55 dmg+6 = 85.4%), and it is identity-preserving: the
    // machine's tracks, the cat's claws and the jet's guns, not a new shape.
    dmg: 57,
    hits: 1,
    hp: 260,
    sp: 8,
    shields: 7,
    // THE MACHINE TRAMPLES — it is a war engine on tracks, and it rolls over
    // what is in front of it. Lost when the shell breaks. Each form answers to
    // something different, which is the whole fight: what beat the machine will
    // not beat the cat.
    keywords: { TRAMPLE: true },
    tribe: "Cavernous",
    boss: true,
    // Floor 4 — THE THING THAT WON'T STAY DEAD, and the floor's third fight.
    // Umbranova ignores position and Cryovex freezes you in place; both are, in
    // their way, immune to where you stand. Kato is the opposite: it is a
    // POSITIONAL fight three times over, and the position that solves one form
    // is the wrong one for the next.
    //
    // Kill it and it gets back up as something else, at full HP, with different
    // rules. Machine, then beast, then whatever is left flying — each shell
    // lighter and faster than the one it climbed out of.
    passiveNames: { transformOnDefeat: "Rebuild", onHitStatus: "Shardstrike" },
    transformOnDefeat: { into: "boss_kato_2" },
    // The BOLT half: crystal shrapnel leaves the storm in the wound.
    onHitStatus: { kind: "ELECTRIFIED", duration: 2, power: 0 },
    // Tracks: it grinds forward and the run builds, and TRAMPLE means bodies do
    // not stop it — the two halves of a war machine working together.
    roundTick: { fireSpecialEveryN: 3, advance: 1, momentum: { per: 2, max: 8 } },
    // A DIFFERENT HANDLER PER FORM, not one move with three sets of numbers.
    // `battleCharge` is the machine's: it rolls forward and ploughs the lane it
    // ends up in, biggest hit on whatever it meets first and the shunt behind.
    special: {
      name: "Shattercharge",
      cost: 3,
      handler: "battleCharge",
      params: { charge: 1, dmg: 14, chainDmg: 8, pen: 1, push: 1 },
      targetSide: "enemy",
      text: "Rolls a slot forward and ploughs the lane: 14 DMG through shields to the first opponent ahead and 8 to everything packed behind it, shoving the front one back.",
    },
  },
  {
    id: "boss_kato_2",
    name: "Kato, Prowlform",
    rarity: "mythic",
    element: "BORE",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, BOLT is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["BOLT"],
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 12,
    dmg: 64,
    hits: 1,
    hp: 260,
    sp: 12,
    shields: 13,
    // NO TRAMPLE — the tracks are gone and it walks on crystal now. It DODGES
    // instead, and loses that too when this shell breaks: the cat is hard to HIT
    // where the machine was hard to STOP. Whatever you brought for the first
    // form is the wrong tool for the second.
    //
    // `firstAttackMisses`, not the EVASION keyword. Void Tower bosses roll no
    // dice — `chanceProblems` fails the build on EVASION by name — and the
    // design doc replaced its own 55% EVASION with exactly this for exactly that
    // reason. It is the same idea made countable: the first swing at it each
    // round misses, every round, and the player can plan around that instead of
    // praying. `neverMiss` still beats it, like every other dodge.
    keywords: {},
    firstAttackMisses: true,
    tribe: "Cavernous",
    boss: true,
    passiveNames: {
      transformOnDefeat: "Rebuild", onHitStatus: "Shardstrike",
      firstAttackMisses: "Crystal Blur",
    },
    transformOnDefeat: { into: "boss_kato_3" },
    onHitStatus: { kind: "ELECTRIFIED", duration: 2, power: 0 },
    // It stalks rather than rolls: forward, forward, back, hold — the same beat
    // Basilisk keeps, on a body that is suddenly much quicker than the tank it
    // climbed out of.
    roundTick: { fireSpecialEveryN: 3, prowl: true },
    special: {
      name: "Pounce",
      cost: 3,
      // `strike`, and it HAS to be: `takeSpotOnKill` and `chargeLateral` are
      // strike-only params, and this was written as a barrage — which reads
      // `chargeFirst`/`charge` but ignores both of those, so the pounce never
      // took the square and never sprang sideways. It was a slightly odd volley
      // wearing a cat's name.
      handler: "strike",
      // TWICE. The second spring re-picks its target from where the cat LANDED,
      // so killing the first one sends it somewhere you were not expecting.
      //
      // 11 a leap, measured: one 13 read 60.4%, two 9s 64.6%, two 11s 70.8% —
      // and two 13s ALSO 70.8%, i.e. saturated. Past 11 the extra damage lands
      // on things the pounce was already killing, so 11 is the whole gain at
      // the smaller number. The control matters as much as the result: one 9
      // read 61.5%, so the lift is the second spring, not the numbers.
      // ANTI-AIR. Every melee boss on the tower was unanswerable-proof against
      // FLYING, and that included the ones whose Specials apply a grounding
      // status: they could not land ROOT or FREEZE on a flier because they
      // could not TARGET one, so the answer needed the answer. `antiAir` lifts
      // only the FLYING dodge — `ranged` would have worked too and would also
      // have thrown away this Special's printed radius.
      params: {
        antiAir: 1,
        dmg: 11, pen: 1, chargeFirst: 1, charge: 2, chargeLateral: 1,
        takeSpotOnKill: 1, pounceAgain: 1,
        statusKind: "ELECTRIFIED", statusDuration: 2,
      },
      targetSide: "enemy",
      text: "Springs up to 2 slots onto a target for 11 DMG through shields and ELECTRIFIED for 2 rounds — then springs AGAIN at whatever is nearest where it landed. Either pounce that kills takes the victim's square.",
    },
  },
  {
    id: "boss_kato_3",
    name: "Kato, Stormwing",
    rarity: "mythic",
    element: "BORE",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, BOLT is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["BOLT"],
    cardClass: "Assassin",
    attackType: "Ranged",
    cost: 12,
    dmg: 68,
    hits: 1,
    hp: 242,
    sp: 16,
    shields: 11,
    // FLYING, and no dodge — the last shell gets off the ground instead. The end of the chain: it declares no `transformOnDefeat`, so this
    // one actually dies, and killing it is what ends the floor.
    //
    // FLYING is immunity to Melee, which is a lockout when a boss has it from
    // round one (see Nightshrike). Here it is EARNED — the player has already
    // beaten two forms by the time it matters, and it arrives as a change of
    // problem rather than a wall in front of the whole fight.
    keywords: { FLYING: true },
    // IT ACTUALLY SHOOTS. `attackType: "Ranged"` alone was not buying this form
    // anything you could feel: a ranged basic is capped at reach 2 from the row
    // it was summoned in and 3 once it advances off it, and this shell's
    // `aimLateral` gait slides it along its OWN home row and never advances at
    // all. Measured, that left the jet reaching rows 1 and 2 and nothing beyond
    // — one row further than the melee cat it grew out of, on a five-row board.
    // A flier that cannot reach the back line is not a strafing run.
    //
    // `ignoresHomeRule` is the same exemption Catapult carries and the same one
    // its own Special already declares as a param: it drops the reach cap AND
    // the sight screen, so the jet shoots the whole board and bodies in the lane
    // do not block it. From above, there is no lane.
    ignoresHomeRule: true,
    tribe: "Cavernous",
    boss: true,
    passiveNames: { onHitStatus: "Shardstrike", vsStatus: "Stormfall", ignoresHomeRule: "Gun Run" },
    onHitStatus: { kind: "ELECTRIFIED", duration: 2, power: 0 },
    // The BOLT payoff, at the end of the chain: it hits the storm-struck harder,
    // and every form before it has been leaving that storm behind.
    vsStatus: { status: "ELECTRIFIED", bonusDmg: 5 },
    // NEVER STILL: two slots a round toward the crowd between passes, then the
    // bank across the board on every strafe (selfMirror, below). It is the most
    // active thing on the tower and it should be — the other two shells were a
    // tank and a stalking cat.
    roundTick: { fireSpecialEveryN: 3, aimLateral: true, aimLateralSteps: 2 },
    special: {
      name: "Thunderhead",
      cost: 3,
      // The only barrage of the three: a strafing pass over the nearest four,
      // from above and out of reach, and then it is gone. Machine ploughs, cat
      // springs, jet strafes and leaves.
      handler: "barrage",
      // ignoreHomeRule, the same exemption Helion's Solar Lance needs and for
      // the same reason: the Home-Slot rule lets a defender's home slot be
      // targeted only from a MID row or from inside it, and this thing lives in
      // its own home row (aimLateral only slides along that row). Measured, the
      // strafing run was doing 10 to the mid row and ZERO to the back line —
      // beatable by parking everything at the back, which is not what a jet is.
      // FOUR TARGETS IN RANGE, then it withdraws.
      //
      // This replaced a `sameColumn` strafe, and the reason is measured: as a
      // one-column run its damage could not be raised into relevance AT ALL —
      // 10 and 40 read the same 68.8% with a byte-identical win breakdown,
      // because by Floor 4 the column the jet happens to be over is usually
      // empty. Widening it to three columns did not help either (68.8-69.8%
      // across every spread x damage combination). A shape that keeps missing
      // cannot be fixed with a number, which is the general lesson: check what
      // a Special can REACH before raising what it hits for.
      //
      // `closest` picks the nearest four rather than whatever order the pool
      // arrived in — deterministic, like everything else in this mode, and it
      // means the four it takes are the four you can see it is nearest to.
      params: {
        dmg: 16, pen: 1, targets: 4, closest: 1, ignoreHomeRule: 1,
        // ...and then it BREAKS OFF, back toward its own lines, down the column
        // it just fired along. The jet inherits whatever square the panther died
        // on — `takeSpotOnKill` regularly leaves that shell deep in the player's
        // half — so this is what gets it out again. It stops at the first body
        // in the way, which is the counter-play: pin it forward and you can
        // reach it.
        retreatHome: 2,
        statusKind: "ELECTRIFIED", statusDuration: 2,
      },
      ranged: true,
      targetSide: "enemy",
      text: "16 DMG through shields to the nearest 4 opponents in range, and ELECTRIFIED for 2 rounds — then it breaks off 2 slots back toward its own lines. Stormfall adds 5 to everything it lands on the afflicted.",
    },
  },
  {
    id: "boss_smolder",
    name: "Smolder",
    rarity: "mythic",
    element: "LEAF",
    // TWO elements, per its own VOID_BOSSES entry: the printed one is where
    // the tribe comes from, PYRO is where the MECHANIC comes from — and that
    // entry states the boss runs that element's aura on the card. It did not.
    elementAuras: ["PYRO"],
    cardClass: "Tank",
    attackType: "Melee",
    cost: 12,
    dmg: 20,
    hits: 1,
    hp: 156,
    sp: 4,
    shields: 20,
    keywords: {},
    tribe: "Grove",
    boss: true,
    // Floor 1 — THE BONFIRE. Everything that touches it burns: its own hits set
    // you alight, and so does hitting it. Nothing else in the tower teaches the
    // difference between reaching something and standing next to it, which is
    // the most basic positional idea in the game and was somehow not on the
    // tutorial floor. Answer it from range, or bring something that does not
    // mind being on fire.
    //
    // Burning Roots is the LEAF/PYRO pairing in one move: the roots take hold
    // (ROOT, LEAF's own control) and everything they hold is already burning.
    // A rooted card cannot walk out of melee, which is the joke — the punishment
    // for touching it also stops you leaving.
    passiveNames: { onHitByMelee: "Ashen Bark", onHitStatus: "Ember Grain" },
    onHitByMelee: { status: { kind: "BURN", duration: 3, power: 4 } },
    onHitStatus: { kind: "BURN", duration: 3, power: 3 },
    roundTick: { fireSpecialEveryN: 3 },
    special: {
      name: "Burning Roots",
      cost: 3,
      handler: "barrage",
      // reach 2 = the widened melee square, the Kraken/Rotroot precedent.
      //
      // IT BURNS NOW. The move is called Burning Roots and applied only ROOT —
      // the "burning" half lived on Smolder's basic (Ember Grain) and on being
      // touched (Ashen Bark), so the Special that carries the name was the one
      // part of the kit that did not set anything alight. Same class of mistake
      // as Web Trap declaring no reach: the text promised what the params did
      // not do.
      //
      // BURN is the PRIMARY status because `debuffStatus` applies at power 0,
      // and a BURN with no power is nothing. So the burn carries the power and
      // ROOT rides along — which is also the right way round for the fiction:
      // the roots take hold, and everything they hold is already on fire.
      // Matched to the rest of the kit at 3 rounds (Ember Grain's BURN 3/3).
      // ANTI-AIR. Every melee boss on the tower was unanswerable-proof against
      // FLYING, and that included the ones whose Specials apply a grounding
      // status: they could not land ROOT or FREEZE on a flier because they
      // could not TARGET one, so the answer needed the answer. `antiAir` lifts
      // only the FLYING dodge — `ranged` would have worked too and would also
      // have thrown away this Special's printed radius.
      params: {
        antiAir: 1,
        dmg: 8, targets: 99, reach: 2,
        statusKind: "BURN", statusDuration: 3, statusPower: 3,
        debuffStatus: "ROOT", debuffStatusRounds: 2,
      },
      targetSide: "enemy",
      text: "8 DMG to every opponent within 2 spaces, setting them alight — BURN 3 for 3 rounds — and ROOTing them for 2, so they burn where they stand.",
    },
  },

  // ══════════════════ THE FORTY-CARD PASS ══════════════════
  //
  // Five per element, drafted against the measured holes in the set rather than
  // by feel. Three numbers drove every choice here:
  //   - 132 of 319 cards were Rare, and only 17 carried a Talent — the design
  //     doc says "a Rare gets a Talent" and 87% of them did not. A Talent costs
  //     NOTHING against the stat budget, so it is the only way to give a Rare
  //     texture without re-cutting its body. Most of the Rares below have one.
  //   - class counts per element, filled at the deficits (DAWN's Assassins were
  //     4 against a mean of 6.7 — the single biggest hole in the matrix).
  //   - the cost curve, which cliffed between 5 (41 cards) and 6 (24).
  //
  // Every line below is EXACT on `dmg*hits + hp + shields*2 + sp === 5*cost+10`,
  // so none of them needs an entry in state.test.ts's exceptions.

  // ── DAWN ──────────────────────────────────────────────────
  {
    id: "dawn_riflemen",
    name: "Bailey",
    rarity: "legendary",
    element: "DAWN",
    // RANGER, not Mage. A rank of riflemen taking aim is the Ranger read, and
    // the swap is free of the DAWN tribe rule: Suns is Tank/Warrior/Support and
    // Stars is Assassin/Mage/Ranger, so a Stars card moving Mage -> Ranger stays
    // inside its own half.
    cardClass: "Ranger",
    tribe: "Stars",
    attackType: "Ranged",
    cost: 6,
    // 3*4 + 16 + 2*2 + 8 = 40 = 5*6+10.
    dmg: 3,
    hits: 4,
    hp: 16,
    sp: 8,
    shields: 2,
    keywords: { PEN: true },
    passiveNames: { firstStrikeBonus: "Opening Volley", alwaysHit: "Dead Eye" },
    firstStrikeBonus: 1,
    // DEAD EYE. The Special was already the aimed one that cannot miss
    // (`alwaysHit` in its params); this puts the same promise on the card
    // itself, so a rank of riflemen taking aim does not whiff its BASIC either.
    // `alwaysHit` on the def is threaded through every miss check in combat.ts
    // — its own BLIND, the target's EVASION, both fogs, Blinding Star, Midnight
    // Shade and the first-blow guard — so this flag is the whole passive.
    alwaysHit: true,
    special: {
      name: "Volley Fire",
      cost: 3,
      handler: "barrage",
      // `closest` + `alwaysHit`: DAWN's other volleys (Star, Kosmos, Eclipse)
      // all rake the whole board. A firing LINE picks its shots, so this one is
      // deliberately narrow and cannot miss — it ignores EVASION and its own
      // BLIND, which is the point of a rank of riflemen taking aim.
      params: { dmg: 3, hits: 2, targets: 3, closest: 1, alwaysHit: 1 },
      targetSide: "enemy",
      text: "3 DMG x2 to the 3 NEAREST opponents in range. Aimed — it cannot miss.",
    },
  },
  {
    id: "dawn_sunspot",
    name: "Sunspot",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Assassin",
    tribe: "Stars",
    attackType: "Melee",
    // Rarity is a cost band, so the mix and the curve are one decision: this
    // moved to hit the 2 Rare / 2 Epic / 1 Legendary split every element now
    // carries, and the stat line is re-cut to the budget that comes with it.
    cost: 3,
    // 6 + 8 + 11 = 25 = 5*3+10.
    dmg: 6,
    hits: 1,
    hp: 8,
    sp: 11,
    shields: 0,
    keywords: {},
    passiveNames: { vsStatus: "Blind Spot" },
    // THE PAYOFF DAWN NEVER CASHED. Beam, Star, Kosmos, Zenith, Solara and
    // Sunbanner all hand out BLIND, and until now nothing in the element
    // executed what it had blinded.
    vsStatus: { status: "BLIND", crit: true },
    special: {
      // TOTAL ECLIPSE, after two collisions caught by hand rather than by the
      // suite: "Eclipse" is already the DAWN card `dawn_clipsey`, and "Blackout"
      // is already the BOLT card `bolt_shock`. The ability-name guard compares
      // abilities to abilities only, so a Special wearing an existing CARD's
      // name sails straight through it -- checked against every `name:` in
      // cards.ts and spells.ts this time.
      name: "Total Eclipse",
      // COST 2, down from 3. Measured: over 124 rounds with Sunspot alive, P1
      // could afford 3 magic in only 32% of them. On a body this cheap and this
      // short-lived, the magic cost was a second gate stacked on top of the
      // status gate below.
      cost: 2,
      handler: "barrage",
      // UNCONDITIONAL, and the `requireStatus: "BLIND"` gate that used to be here
      // is gone. Two reworks of this card have now been measured and the second
      // was WORSE than the first:
      //
      //   Corona Flare (self-blinding)   0.22 casts per Sunspot summon
      //   Total Eclipse (BLIND-gated)    0.038
      //
      // The gate was not the AI misplaying it -- the AI cast it every single
      // time it was legal, 3 for 3. The window simply never opened: across 124
      // rounds with Sunspot alive, an opponent was BLIND in 7.3% of them, and
      // everything lined up in 2.4%.
      //
      // THE REAL LESSON IS ABOUT WHICH CARDS CAN AFFORD A CONDITION. Sunspot is
      // summoned 0.24 times a match and is an 8 HP body that does not last;
      // `aiPrepIntent` buys the dearest card it can afford, so a cost-3 rarely
      // gets bought at all. A card that is seldom on the board needs
      // UNCONDITIONAL value. Conditions belong on cards you reliably draw and
      // keep -- the setup cost is only payable if there are turns to pay it in.
      //
      // Blind Spot (above) is still the BLIND payoff, and it is the right place
      // for one: it rides the BASIC, so it costs no magic and needs no window.
      // Quasar's synergy is untouched.
      //
      // Sized against its peers rather than left at 99 targets: Growrilla and
      // Mortar both pay 3 magic for ~6 damage over 2-3 targets plus a rider,
      // and both sit on cost-5 bodies. This is 6 over 2 with PEN on a cost-3
      // body for 2 magic. `ranged: true` stays -- a MELEE assassin with 8 HP
      // diving into three adjacent enemies is not a play anyone makes.
      params: { dmg: 6, targets: 2, closest: 1, pen: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Strike the 2 nearest opponents for 6, straight through shields (PEN).",
    },
  },
  {
    id: "dawn_quasar",
    name: "Quasar",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Assassin",
    tribe: "Stars",
    attackType: "Melee",
    // 5 + 8 + 7 = 20 = 5*2+10. Down from cost 3, and the five points come off
    // all three rather than out of one, because Outshine is what this card IS
    // and every stat feeds it: the BLIND rides the basic, so it has to reach a
    // body, connect with it, and still be standing next round to do it again.
    // Damage gives up the most (7 -> 5) since the payload is the blindness
    // rather than the hit, and SP stops at 7 on purpose — SP_SLOW_MAX is 5, so
    // anything above it still strides 2, and dropping to 4 would have cost a
    // whole movement tier for one budget point.
    //
    // AND IT KEEPS STARFALL, which the "a Talent is a cost-3 Rare's trick" rule
    // would otherwise refuse. Owner's call, taken after the re-cost and written
    // down in that test's exception list rather than waived quietly — the
    // Talent is worth more on this card than the gold was.
    cost: 2,
    dmg: 5,
    hits: 1,
    hp: 8,
    sp: 7,
    shields: 0,
    keywords: {},
    // OUTSHINE, and it is now a BLIND rather than a CRIT. Quasar and Sunspot
    // were the same card twice: both cost-3 DAWN melee Assassins in Stars, both
    // applying BLIND with their ability and both paying themselves off with a
    // crit. Two knives that happened to share a keyword is not a pair.
    //
    // So they split along the line their own names already drew. A quasar is
    // the brightest thing there is, so this one BLINDS -- every basic, not once
    // a game -- and it gives up the crit entirely. `critIfFaster` was the
    // redundant half: Sunspot owns crit, and it owns it CONDITIONALLY, which is
    // the more interesting of the two.
    passiveNames: { onHitStatus: "Outshine" },
    onHitStatus: { kind: "BLIND", duration: 2, power: 0 },
    talent: {
      name: "Starfall",
      text: "Once per game, free: 7 DMG (PEN) to an adjacent opponent and BLIND it for 2 rounds.",
      // BLINDs, like its basic now does -- Starfall is the same job done at
      // PEN and at range, for the turn you need the mark to land through armour.
      handler: "strike",
      params: { dmg: 7, pen: 1, statusKind: "BLIND", statusDuration: 2 },
    },
  },
  {
    id: "dawn_meridian",
    // SUNSTALKER. "Meridian" is a line on a chart -- it named the noon point of
    // the sun's path and said nothing about the card, which is a black panther
    // with golden wings that leaps, kills, takes the ground and springs again.
    // The new name carries the two halves the art actually shows: the sun, and
    // a big cat hunting. It also stops colliding conceptually with Zenith, an
    // existing DAWN card whose name means very nearly the same thing.
    name: "Sunstalker",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Assassin",
    tribe: "Stars",
    attackType: "Melee",
    // Rarity is a cost band, so the mix and the curve are one decision: this
    // moved to hit the 2 Rare / 2 Epic / 1 Legendary split every element now
    // carries, and the stat line is re-cut to the budget that comes with it.
    cost: 5,
    // 11 + 13 + 1*2 + 9 = 35 = 5*5+10.
    dmg: 11,
    hits: 1,
    hp: 13,
    sp: 9,
    shields: 1,
    keywords: { FLYING: true },
    passiveNames: { deathSave: "Second Sunrise" },
    deathSave: { stealth: 2, regen: { power: 3, rounds: 3 } },
    special: {
      name: "Solar Pounce",
      cost: 3,
      handler: "strike",
      // `chargeFirst` is what makes the leap legal from range on a MELEE card —
      // validSpecialTargets reads chargeReach. Without it the pounce could only
      // be cast at something already touching it, which is not a pounce.
      params: { dmg: 9, charge: 3, chargeFirst: 1, takeSpotOnKill: 1, onKillSelfHeal: 4, pounceAgain: 1 },
      targetSide: "enemy",
      text: "Leap up to 3 spaces and strike for 9. A kill heals it 4, it takes the ground it cleared, and it springs again.",
    },
  },


  // ── DUSK ──────────────────────────────────────────────────
  {
    id: "dusk_grafft",
    name: "Grafft",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Mage",
    // NO TRIBE. It was in Ghost and never read as one — Bad Batch is a WEAKEN
    // off a mislabelled dose, and the lore is a man who wrote the error down and
    // used the batch anyway. That is an apothecary, not a haunting. Ghost is
    // DUSK's largest tribe and Duet's aura pays every member of it, so a card
    // sitting in it for want of anywhere else was collecting +1 DMG on the
    // strength of a tag nothing else about it supports.
    //
    // Untribed is a real state here rather than a gap: plenty of cards carry no
    // tribe, and the only thing lost is the Ballroom Light buff — which is the
    // point.
    attackType: "Ranged",
    cost: 1,
    // 3 + 5 + 7 = 15 = 5*1+10.
    dmg: 3,
    hits: 1,
    hp: 5,
    sp: 7,
    shields: 0,
    keywords: {},
    passiveNames: { onHitStatus: "Bad Batch" },
    onHitStatus: { kind: "WEAKEN", duration: 2, power: 1 },
  },
  {
    id: "dusk_duet",
    name: "Duet",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Support",
    tribe: "Ghost",
    attackType: "Ranged",
    cost: 3,
    // 2*2 + 11 + 10 = 25 = 5*3+10. `hits: 2` is the pair — two dancers landing
    // two blows, which is also why the card reads as one body and not two.
    dmg: 2,
    hits: 2,
    hp: 11,
    sp: 10,
    shields: 0,
    keywords: { EVASION: true },
    passiveNames: { aura: "Ballroom Light" },
    aura: { scope: "tribe", match: "Ghost", dmg: 1 },
    special: {
      name: "Partner Dance",
      cost: 2,
      handler: "grantShield",
      params: { amount: 3, buffDmg: 3, buffRounds: 2 },
      targetSide: "ally",
      text: "Take one ally as a partner — +3 shields and +3 DMG for 2 rounds.",
    },
  },
  {
    id: "dusk_prestige",
    name: "Prestige",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Mage",
    tribe: "Ghost",
    attackType: "Ranged",
    cost: 5,
    // 6 + 15 + 1*2 + 12 = 35 = 5*5+10.
    dmg: 6,
    hits: 1,
    hp: 15,
    sp: 12,
    shields: 1,
    keywords: {},
    passiveNames: { vsStatus: "Now You Don't" },
    // The Special sets up its own payoff, which is the whole card: MUTE, then
    // hit the muted thing twice as hard.
    vsStatus: { status: "MUTED", dmgMult: 2 },
    special: {
      name: "Sleight of Hand",
      cost: 2,
      handler: "statusNova",
      params: { targets: 2, statusKind: "MUTED", statusDuration: 2, debuffStatus: "WEAKEN", debuffStatusRounds: 2 },
      targetSide: "enemy",
      text: "MUTE up to 2 opponents for 2 rounds and WEAKEN them.",
    },
  },
  {
    // The id stays `dusk_tatterhand` though the card is now Scarecrow: ids are
    // persisted in collections, saved squads, story rosters and deck codes
    // (which are INDICES into deck-code.ts), and there is no id-alias mechanism
    // to migrate through — renaming would delete the card out of every save
    // rather than rename it. The art plate is named from the id too.
    id: "dusk_tatterhand",
    name: "Scarecrow",
    rarity: "legendary",
    element: "DUSK",
    cardClass: "Support",
    // IN ITS OWN TRIBE AT LAST. Five cards carry ScareKrow and the card the
    // tribe is named after was not one of them — it sat in Ghost alone. Both,
    // not a swap: the Ghost half was a deliberate call when this was renamed off
    // Tatterhand, and dropping it now would quietly take it out of every Ghost
    // aura it has been feeding since.
    tribe: ["Ghost", "ScareKrow"],
    attackType: "Ranged",
    cost: 6,
    // 5 + 20 + 2*2 + 11 = 40 = 5*6+10.
    dmg: 5,
    hits: 1,
    hp: 20,
    sp: 11,
    shields: 2,
    keywords: {},
    passiveNames: { aura: "Taut Strings" },
    aura: { scope: "all", sp: 2 },
    special: {
      name: "Curtain Call",
      cost: 4,
      handler: "flashSquad",
      // THE ROW AHEAD ONLY. The shared handler commands the caster's own line as
      // well, which is right for Sunbanner (a Melee Tank at the front) and wrong
      // here: Scarecrow is Ranged, stands BEHIND its line, and conducting the
      // bodies stood beside it is not what it is doing. `aheadOnly` narrows it
      // without touching Sunbanner, which prints no such param.
      params: { aheadOnly: 1 },
      targetSide: "self",
      text: "Command the allies in the row ahead to each make their basic attack.",
    },
  },

  // ── GALE ──────────────────────────────────────────────────
  {
    id: "gale_goldspur",
    name: "Goldspur",
    rarity: "legendary",
    element: "GALE",
    cardClass: "Ranger",
    tribe: "Avian",
    attackType: "Ranged",
    // COST 5 -> 6, and with it Epic -> Legendary, because the rarity bands make
    // those the same decision. The recost is the payment: a free Falcon is a
    // 25-point body with FLYING and PLUMMET on it, and Kobra's note says plainly
    // that shaving a few points off a printed line "nowhere near pays for" a
    // free body — the extra gold is what does.
    cost: 6,
    // 4*2 + 15 + 12 = 35 = 5*5+10.
    dmg: 4,
    hits: 2,
    // ...and six points under the cost-6 budget of 40 on top of the recost, the
    // same shape as Kobra sitting four under at cost 7. Trimmed from HP rather
    // than DMG so the guns still read as the card's point.
    hp: 14,
    sp: 12,
    shields: 0,
    keywords: { CRIT: true },
    // Twin Golden Pistols: the CRIT is the card, so the payoff hangs off it.
    // This replaced a Talent when the set rule settled on "only cost-3 Rares get
    // one" — a Rare at any other cost earns its texture from passives, which is
    // what they were always for.
    passiveNames: { onCritBonus: "Fan the Hammer", summonSpawn: "Falconer" },
    onCritBonus: { dmg: 4, hits: 1 },
    // ONE Falcon, on arrival. The bird is a real card in its own right — a
    // cost-3 Rare with FLYING and PLUMMET — which is the whole reason this
    // needed paying for rather than printing as a rider.
    summonSpawn: { token: "gale_falcon", count: 1, adjacentOnly: true },
    special: {
      name: "Both Barrels",
      cost: 3,
      handler: "barrage",
      // Two shots, two targets, and CRIT is printed on the card — so this is the
      // volley version of what its basic already does, which is what a
      // gunslinger's Special ought to be.
      // The shove is the GALE half: Zephyr is speed and displacement, so the
      // shots move the line as well as hurt it.
      params: { dmg: 5, targets: 2, closest: 1, crit: 1, push: 1 },
      targetSide: "enemy",
      text: "5 DMG to the 2 nearest opponents, both shots rolling for a CRIT.",
    },
  },
  {
    id: "gale_leeward",
    name: "Leeward",
    rarity: "epic",
    element: "GALE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 5,
    // 3 + 24 + 2*2 + 4 = 35 = 5*5+10.
    dmg: 3,
    hits: 1,
    hp: 24,
    sp: 4,
    shields: 2,
    keywords: {},
    passiveNames: { onHeavyHit: "Backdraft" },
    // Hit it small and often, or don't hit it at all — a big single blow answers
    // itself. Fills GALE's Tank hole (6, joint-lowest) without another flier.
    onHeavyHit: { over: 6, reach: 1, push: 1, status: "WEAKEN", statusDuration: 2 },
    special: {
      name: "Windbreak",
      cost: 3,
      handler: "grantShield",
      params: { amount: 3, nearby: 1 },
      targetSide: "ally",
      text: "+3 shields to itself and every adjacent ally.",
    },
  },
  {
    id: "gale_aerostat",
    name: "Aerostat",
    rarity: "epic",
    element: "GALE",
    cardClass: "Tank",
    // RANGED, which is what a balloon dropping ballast was always doing. It
    // also widens Burst below: `onDeath.inRangeOnly` measures reach as
    // `Melee ? 1 : RANGED_REACH` (combat.ts), so the death blast goes from
    // catching what is adjacent to catching everything within 2. That is a real
    // buff riding along with a targeting change, not a side effect of the
    // damage — worth knowing before the 6 DMG + STUN is judged.
    attackType: "Ranged",
    // Rarity is a cost band, so the mix and the curve are one decision: this
    // moved to hit the 2 Rare / 2 Epic / 1 Legendary split every element now
    // carries, and the stat line is re-cut to the budget that comes with it.
    cost: 5,
    // 3 + 25 + 2*2 + 4 = 36, one over a cost-5's 35 and inside the +/-2 the
    // curve allows. A 25 HP envelope on 3 DMG: still much more wall than
    // threat, but it can now answer something without closing on it.
    dmg: 3,
    hits: 1,
    hp: 25,
    sp: 4,
    shields: 2,
    keywords: { FLYING: true },
    passiveNames: { onDeath: "Burst" },
    onDeath: { dmg: 6, inRangeOnly: true, inRangeStatus: { kind: "STUN", duration: 1, power: 0 } },
    special: {
      name: "Sandbag Drop",
      cost: 3,
      handler: "barrage",
      // Ballast dropped from above lands as weight AND wind — the shove is what
      // makes it read as GALE rather than as a generic row-nuke.
      params: { dmg: 6, targets: 99, rowAhead: 1, statusKind: "STUN", statusDuration: 1,
                push: 1, selfShields: 2 },
      targetSide: "enemy",
      text: "6 DMG and STUN 1 to every opponent in the row directly ahead; brace for +2 shields.",
    },
  },
  {
    id: "gale_gyre",
    name: "Gyre",
    rarity: "rare",
    element: "GALE",
    cardClass: "Mage",
    attackType: "Ranged",
    // Rarity is a cost band, so the mix and the curve are one decision: this
    // moved to hit the 2 Rare / 2 Epic / 1 Legendary split every element now
    // carries, and the stat line is re-cut to the budget that comes with it.
    cost: 3,
    // 3*2 + 12 + 7 = 25 = 5*3+10.
    dmg: 3,
    hits: 2,
    hp: 12,
    sp: 7,
    shields: 0,
    keywords: {},
    passiveNames: { roundTick: "Wheeling Sky" },
    // `cycloneSpin` is Skybreaker's — the storm does not push the line back, it
    // TURNS it, which destroys formation while preserving distance. This is the
    // first player card to carry it.
    roundTick: { cycloneSpin: 1 },
    talent: {
      name: "Eye of the Gyre",
      text: "Once per game, free: drag up to 3 opponents 2 spaces toward you, STUN them 1 round and -3 SP for 2.",
      // The Special it had, at the rung that allows one. Cost 3 is the only rung
      // a Talent may sit on, which is what made this the right card to drop.
      handler: "statusNova",
      params: { statusKind: "STUN", statusDuration: 1, targets: 3, pullToCaster: 2, spDebuff: 3, spDebuffRounds: 2 },
    },
  },


  // -- BORE --------------------------------------------------
  {
    id: "bore_rhino",
    // Renamed to Crystal Rhino, joining Crystal Sabor in BORE. The id stays
    // `bore_rhino` — it is what saves, deck codes, the art plate, the lore entry
    // and the R11 roster are all keyed on.
    name: "Crystal Rhino",
    rarity: "epic",
    element: "BORE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 4,
    // 7 + 18 + 2*2 + 2 = 31, one over 5*4+10 and inside the +/-2 the curve
    // allows. Warrior, NOT Tank: BORE's Tanks were the element's surplus at 8,
    // and a rhino is the obvious card to get that wrong.
    //
    // Re-cut from 9/13/4 into something slower and thicker, and the HORN pays
    // for most of it: DMG 9 -> 7 and SP 4 -> 2 buy HP 13 -> 18. The speed is
    // sold for nothing lost — SP_SLOW_MAX is 5, so 4 and 2 are the same one-step
    // reach, and Full Charge is a Special that closes ground for it anyway. What
    // actually changes hands is damage for staying power: it hits softer and it
    // is there for two more rounds to keep hitting. Trample Through and Horn
    // Toss both want that, since both are riders on being ALIVE and adjacent.
    dmg: 7,
    hits: 1,
    hp: 18,
    sp: 2,
    shields: 2,
    keywords: { TRAMPLE: true },
    passiveNames: { trampleDmg: "Trample Through", onHitPush: "Horn Toss" },
    trampleDmg: 3,
    onHitPush: 1,
    special: {
      name: "Full Charge",
      cost: 3,
      handler: "battleCharge",
      // `ranged: true` is the WarPhant fix: without it a MELEE charger can only
      // cast at something already touching it, so there is never a lane left to
      // charge down.
      params: { charge: 2, dmg: 9, chainDmg: 3, push: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "Rumble up to 2 slots up the column, crush what is packed behind the front rank, and gore what it reaches.",
    },
  },
  {
    id: "bore_dunebuggy",
    name: "Dune Buggy",
    rarity: "rare",
    element: "BORE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    // 3*2 + 6 + 1*2 + 11 = 25 = 5*3+10.
    dmg: 3,
    hits: 2,
    hp: 6,
    sp: 11,
    shields: 1,
    keywords: {},
    passiveNames: { firstStrikeBonus: "Hit and Run" },
    firstStrikeBonus: 2,
    // Redline: speed and GROUND, not damage. The talent used to be +2 DMG and
    // +4 SP, which made it a smaller copy of every other "floor it" button on
    // the roster; a buggy's whole argument is that it gets somewhere. So the
    // damage came off and the distance went on — it is now the one talent that
    // converts a turn into position, on a card whose printed SP 11 already says
    // that is what it is for.
    talent: {
      name: "Redline",
      text: "Once per game, free: floor it -- +5 SP for 2 rounds, then roll 2 spaces forward.",
      handler: "empower",
      params: { selfSp: 5, buffRounds: 2, moveForward: 2 },
    },
  },
  {
    id: "bore_badlands_bandits",
    name: "Badlands Bandits",
    rarity: "epic",
    element: "BORE",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 5,
    // 3*3 + 12 + 2*2 + 10 = 35 = 5*5+10. Three guns, each rolling CRIT
    // separately -- the gang is MULTI-HIT rather than a token spawner, which
    // keeps it one card instead of a card plus a token plus a second render.
    dmg: 3,
    hits: 3,
    hp: 12,
    sp: 10,
    shields: 2,
    keywords: { CRIT: true },
    passiveNames: { onKill: "Bounty" },
    onKill: { buffDmg: 1, buffDmgMax: 3, gainShields: 2 },
    special: {
      name: "Dust Devil",
      cost: 3,
      handler: "barrage",
      params: { dmg: 4, targets: 3, closest: 1, statusKind: "BLIND", statusDuration: 2 },
      targetSide: "enemy",
      text: "4 DMG to the 3 nearest opponents and BLIND them for 2 rounds.",
    },
  },
  {
    id: "bore_spinosaur",
    name: "Spinosaur",
    rarity: "legendary",
    element: "BORE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 6,
    // 8 + 28 + 0 + 4 = 40 = 5*6+10. Fills the thinnest cost slot in the set
    // -- BORE had only 2 cards at cost 6.
    //
    // Re-cut from 11/18/7 with 2 shields into a far heavier, far slower body,
    // and the ARMOUR is what pays for it: hide rather than plate. A shield pool
    // costs 2 budget points each and runs out; 28 HP does not, and on a card
    // whose Gorge passive feeds on kills the thing worth protecting is the time
    // it stays on the board. Owner-specified DMG 8 / HP 28 / SP 4 — shields to
    // 0 is what lands that line exactly on the cost-6 budget without moving it
    // to cost 7.
    dmg: 8,
    hits: 1,
    hp: 28,
    sp: 4,
    shields: 0,
    keywords: {},
    passiveNames: { onKill: "Gorge" },
    // CAPPED, using the ceiling added for Vulcanyx. An uncapped +DMG per kill on
    // an 11-DMG body is the exact runaway that made enraged Apex Hunger a wall.
    onKill: { buffDmg: 2, buffDmgMax: 6 },
    special: {
      name: "Tail Spin",
      cost: 4,
      handler: "barrage",
      // A SWEEP, so `targets: 99` -- every foe the swing can reach, which on a
      // MELEE body is everything adjacent. `push` rides applyDebuffRiders, and
      // barrage calls that PER TARGET, so each one is knocked a space back
      // rather than the volley shoving a single card.
      params: { dmg: 6, pen: 1, push: 1, targets: 99 },
      targetSide: "enemy",
      text: "Sweep the tail through everything in reach — 6 DMG (PEN) each, and every one of them is knocked back a space.",
    },
  },

  // -- BOLT --------------------------------------------------
  {
    id: "bolt_hacker",
    name: "Hacker",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Assassin",
    attackType: "Ranged",
    cost: 3,
    // 5 + 8 + 1*2 + 10 = 25 = 5*3+10.
    dmg: 5,
    hits: 1,
    hp: 8,
    sp: 10,
    shields: 1,
    // STEALTH was on TWO cards in the entire 319-card set, and BOLT carried
    // three keyword instances in total -- the most barren element in the game.
    keywords: { STEALTH: true },
    passiveNames: { onHitStatus: "Signal Jam" },
    onHitStatus: { kind: "MUTED", duration: 2, power: 0, chance: 50 },
    talent: {
      name: "Kill Switch",
      text: "Once per game, free: quarantine every opponent out of their Specials for 2 rounds.",
      handler: "lockSpecials",
      params: { count: 99, rounds: 2 },
    },
  },
  {
    id: "bolt_handyman",
    name: "Handyman",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Support",
    tribe: "ARC",
    attackType: "Ranged",
    // Epic cost 5 -> Rare cost 3: rarity is a cost band here, so the demotion
    // and the recost are one decision, and the line is re-cut to the budget
    // that comes with it.
    cost: 3,
    // 3 + 10 + 3*2 + 6 = 25 = 5*3+10.
    dmg: 3,
    hits: 1,
    hp: 10,
    sp: 6,
    shields: 3,
    keywords: {},
    passiveNames: { aura: "Preventive Maintenance" },
    aura: { scope: "tribe", match: "ARC", shields: 1 },
    talent: {
      name: "Patch Job",
      // The Special it had, at the rung that allows one. A Rare carries no
      // repeatable Special; cost 3 is the only rung a Talent may sit on, and
      // Preventive Maintenance above is the passive that keeps it from blank.
      text: "Once per game, free: plate every nearby ally — itself included — with +2 shields and repair 4 HP.",
      handler: "grantShield",
      params: { amount: 2, heal: 4, nearby: 1 },
    },
  },
  {
    id: "bolt_kingpin",
    name: "Kingpin",
    rarity: "legendary",
    element: "BOLT",
    cardClass: "Warrior",
    // RANGED, and that is the character rather than a stat: a Kingpin does not
    // walk across the board to hit you. He stays at the table and the work
    // reaches you.
    attackType: "Ranged",
    cost: 8,
    // 11 + 26 + 4*2 + 5 = 50 = 5*8+10.
    dmg: 11,
    hits: 1,
    hp: 26,
    sp: 5,
    shields: 4,
    // BLOCK 1 with the PEN: he cuts through armour and shrugs the first point
    // off everything coming back. Free against the curve — keywords are not in
    // the stat formula — so the line stays at 50 = 5*8+10.
    keywords: { PEN: true, BLOCK: 1 },
    passiveNames: { onKill: "Made Man", contractPayout: "Payout" },
    onKill: { buffDmg: 2, buffDmgMax: 6, gainShields: 1 },
    // PAYOUT — the contract pays when it is FILLED, not when it is signed.
    // Reads the brand Contract Out already leaves (`hoaxMarked`), so the two
    // halves of the card are one loop: mark a target, collect when it dies.
    //
    // ANY ally may fill it and the money still goes to the player, which is the
    // whole fantasy — he is not the one doing the killing. It does require
    // Kingpin to still be standing: no boss, no payroll.
    contractPayout: 1,
    special: {
      name: "Contract Out",
      cost: 3,
      handler: "markTarget",
      // markTarget brands the victim so every basic against it CRITs, then puts
      // the rider through the shared status path -- so the PARALYZE is declared
      // here on the card rather than hard-coded inside the handler.
      params: { statusKind: "PARALYZE", statusDuration: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "Mark one opponent anywhere on the board and PARALYZE it 2 rounds -- while marked, every basic against it is a guaranteed CRIT.",
    },
  },
  {
    id: "bolt_airship",
    name: "Police Helicopter",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Support",
    tribe: "ARC",
    attackType: "Ranged",
    // SPOTLIGHT. A searchlight does not care that you are hiding, and neither
    // does the side flying it: like Sonar Ping's Echo Return this reveals for
    // the WHOLE team while the helicopter is alive, so every ally may target a
    // cloaked opponent normally. Kill the light and the cloak comes back, which
    // is the counter and the reason it is worth flying.
    revealsStealth: true,
    // Rarity is a cost band, so the mix and the curve are one decision: this
    // moved to hit the 2 Rare / 2 Epic / 1 Legendary split every element now
    // carries, and the stat line is re-cut to the budget that comes with it.
    cost: 5,
    // 6 + 15 + 3*2 + 8 = 35 = 5*5+10.
    dmg: 6,
    hits: 1,
    hp: 15,
    sp: 8,
    shields: 3,
    keywords: { FLYING: true },
    passiveNames: { aura: "Rotor Wash", onSummon: "Deploy", revealsStealth: "Spotlight" },
    aura: { scope: "all", sp: 1 },
    onSummon: { handler: "grantShield", params: { amount: 2, nearby: 1 }, targetSide: "ally" },
    special: {
      name: "Airlift",
      cost: 2,
      // swapAlly reads NO params -- its signature is (draft, attacker, targets,
      // _params), so anything passed here would be decoration.
      handler: "swapAlly",
      params: {},
      targetSide: "ally",
      text: "Trade board positions with an ally -- lift it out of the line and drop into its place.",
    },
  },


  // -- LEAF --------------------------------------------------
  {
    id: "leaf_forestdeer",
    name: "Forest Deer",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 2,
    // 3 + 8 + 9 = 20 = 5*2+10.
    dmg: 3,
    hits: 1,
    hp: 8,
    sp: 9,
    shields: 0,
    keywords: {},
    passiveNames: { evadeVsSlower: "Startle" },
    evadeVsSlower: true,
  },
  {
    id: "leaf_monkey",
    // Renamed to Rookey. Same rule as its neighbour Growrilla: the id is what
    // saves, deck codes and the art file are keyed on, so only the name moves.
    name: "Rookey",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 1,
    // 2 + 8 + 1*2 + 3 = 15 = 5*1+10.
    dmg: 2,
    hits: 1,
    hp: 8,
    sp: 3,
    shields: 1,
    keywords: {},
    passiveNames: { falseHead: "Fake Out" },
    falseHead: true,
  },
  {
    id: "leaf_gorilla",
    // Renamed to Growrilla. The ID stays `leaf_gorilla` — ids are persisted in
    // saves and in deck codes (CODE_IDS is append-only and positional), and the
    // art is keyed off the id too, so a rename is the `name` field and nothing
    // else.
    name: "Growrilla",
    rarity: "epic",
    element: "LEAF",
    // TANK, and this is the note above resolving itself. It was Ranger purely to
    // fill a class hole -- LEAF's Ranger count sat at 6 where Warrior and Tank
    // sat at 8 -- with the file itself admitting "a gorilla reads melee" and
    // inviting the flip if the picture mattered more than the count. It does:
    // an 18 HP body that shoves what it hits (Timber Toss) and pins the three
    // nearest with falling canopy is a Tank doing Tank things, and now it has
    // art of a silverback to argue the point.
    //
    // The cost is that LEAF's classes get LESS even, not more -- Ranger drops to
    // 6 and Tank climbs to 10, against a 7-to-9 spread everywhere else. Stated
    // rather than discovered later.
    //
    // MELEE too, so the card finally reads the way the original note wanted: a
    // silverback that hits what it can reach, not one lobbing timber from the
    // back rank. Its basic loses board-wide reach, which is the real cost and
    // the point -- an 18 HP Tank should have to walk into the fight.
    cardClass: "Tank",
    attackType: "Melee",
    cost: 5,
    // 6 + 21 + 1*2 + 6 = 35 = 5*5+10. Re-cut from 7/18/8: a point of damage and
    // two of speed traded for three of HP, which lands on the same 35 exactly.
    // More silverback, less sprinter — it hits slightly softer and stands up
    // rather longer, which is the Tank the notes above argue it should be.
    //
    // SP 6 KEEPS ITS STRIDE. `moveReach` is 2 for anything above SP_SLOW_MAX
    // (5), so 8 -> 6 costs no movement at all, and it was never in the FAST
    // tier (SP > 10) to fall out of. What it does lose is margin: at 8 it took
    // a 3-point SP debuff to halve its stride, and at 6 it takes a single point.
    dmg: 6,
    hits: 1,
    hp: 21,
    sp: 6,
    shields: 1,
    keywords: {},
    passiveNames: { onHitPush: "Timber Toss" },
    onHitPush: 1,
    special: {
      name: "Canopy Crash",
      cost: 3,
      // `barrage`, not `fragBlast`. fragBlast reads only dmg and splash, so it
      // cannot carry a status — and the falling timber SHOULD pin. ROOT also
      // feeds Photosynthesis, which is the element's whole engine, and it drops
      // a shape Growrilla was sharing with Dyna's Demolition anyway.
      handler: "barrage",
      params: { dmg: 6, targets: 3, closest: 1, statusKind: "ROOT", statusDuration: 2 },
      targetSide: "enemy",
      // REQUIRED once the card went Melee, and it is the same WarPhant fix
      // Crystal Rhino carries. `validSpecialTargets` gates a Melee caster to what it is
      // already touching, so without this the "3 NEAREST opponents" this text
      // promises would collapse to "up to 3 opponents already adjacent" — the
      // basic is what got shorter here, not the canopy coming down.
      ranged: true,
      text: "6 DMG to the 3 nearest opponents, pinning them (ROOT) for 2 rounds.",
    },
  },
  {
    id: "leaf_wintermoose",
    name: "Winter Moose",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Support",
    attackType: "Melee",
    // Rarity is a cost band, so the mix and the curve are one decision: this
    // moved to hit the 2 Rare / 2 Epic / 1 Legendary split every element now
    // carries, and the stat line is re-cut to the budget that comes with it.
    cost: 5,
    // 5 + 22 + 3*2 + 3 = 36, one over a cost-5's 35 and inside the +/-2 the
    // curve allows. Re-cut from 6/18/5: a point of damage and two of speed for
    // four of HP. Support/MELEE, which only a handful of cards are -- legal and
    // precedented, but off the beaten path.
    //
    // SP 3 COSTS IT NO MOVEMENT. It was already in the slow tier at 5 --
    // `moveReach` is 1 for anything at or below SP_SLOW_MAX -- so it strode one
    // slot before and strides one now. What it buys is a later slot in the
    // speed queue: this thing plants itself, heals the herd and is in no hurry,
    // which is the card the passives already describe.
    dmg: 5,
    hits: 1,
    hp: 22,
    sp: 3,
    shields: 3,
    keywords: { TRAMPLE: true },
    passiveNames: { pushImmune: "Planted Hooves", roundTick: "Herd Warmth" },
    pushImmune: true,
    roundTick: { healAlliesInRange: 3 },
    special: {
      name: "Winter Coat",
      cost: 3,
      handler: "grantShield",
      params: { amount: 3, nearby: 1, heal: 4 },
      targetSide: "ally",
      text: "Shoulder in — +3 shields and 4 HP to itself and every ally in the 8 slots around it.",
    },
  },
  {
    id: "leaf_grizzly",
    name: "Grizzly",
    rarity: "legendary",
    element: "LEAF",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 7,
    // 12 + 25 + 1*2 + 6 = 45 = 5*7+10. Three points of speed traded straight
    // across for three of HP, so the budget does not move.
    //
    // It stays in the SAME movement tier: `moveReach` reads 6+ as two slots a
    // move, so 9 -> 6 sits on the threshold rather than crossing it and the
    // bear covers exactly as much ground as before. What it loses is TURN
    // ORDER -- it acts later in the round now, which for an ambusher that wants
    // to be struck first (Thicket Ambush hides it while it is idle, First Blood
    // pays on the opening wound) is closer to what the card is doing anyway.
    dmg: 12,
    hits: 1,
    hp: 25,
    sp: 6,
    shields: 1,
    keywords: {},
    passiveNames: { stealthWhenIdle: "Thicket Ambush", onHitStatus: "First Blood" },
    // `stealthWhenIdle` is Magalogoon's rule, NOT the STEALTH keyword: hidden
    // only while it has neither moved nor attacked this round, so it is never
    // "always" cloaked.
    stealthWhenIdle: true,
    // FIRST BLOOD IS A WOUND NOW, not a bonus. It was `firstStrikeBonus: 4`:
    // +4 DMG on the first basic against each DISTINCT opponent, once per
    // opponent for the game — a burst of opening damage that could never be
    // collected twice from the same target.
    //
    // BLEED 2 for 2 rounds on every basic is the opposite shape, and stronger
    // in the fight this card actually wants. Against a fresh target it is the
    // same four damage; against one it keeps mauling it is four MORE every
    // swing, refreshed each time. And BLEED bypasses shields (it ticks straight
    // to HP at Cleanup, like BURN and DOT), so the plated bodies that used to
    // blunt a bear's opening swing no longer do.
    onHitStatus: { kind: "BLEED", duration: 2, power: 2 },
    special: {
      name: "Maul",
      cost: 3,
      handler: "strike",
      // The ROOT is not decoration: Photosynthesis heals EVERY LEAF card +1 per
      // ROOTed opponent, so pinning what it mauls pays the whole board, not just
      // the bear.
      params: { dmg: 14, charge: 2, chargeFirst: 1, takeSpotOnKill: 1, onKillSelfHeal: 8,
                statusKind: "ROOT", statusDuration: 2 },
      targetSide: "enemy",
      text: "Close up to 2 spaces and maul for 14. A kill heals it 8 and it takes the ground.",
    },
  },

  // -- PYRO --------------------------------------------------
  {
    id: "pyro_komodo",
    name: "Komodo",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Assassin",
    tribe: "Reptile",
    attackType: "Melee",
    // Rarity is a cost band, so the mix and the curve are one decision: this
    // moved to hit the 2 Rare / 2 Epic / 1 Legendary split every element now
    // carries, and the stat line is re-cut to the budget that comes with it.
    cost: 3,
    // 6 + 12 + 7 = 25 = 5*3+10.
    dmg: 6,
    hits: 1,
    hp: 12,
    sp: 7,
    shields: 0,
    keywords: {},
    passiveNames: { onHitStatus: "Septic Bite", vsStatus: "Blood Scent" },
    // Self-enabling: the bite applies the BLEED that Blood Scent then cashes.
    onHitStatus: { kind: "BLEED", duration: 3, power: 2 },
    vsStatus: { status: "BLEED", bonusDmg: 4 },
    talent: {
      name: "Death Roll",
      text: "Once per game, free: 8 DMG to an adjacent opponent and open it up — BLEED 4 for 3 rounds.",
      handler: "strike",
      params: { dmg: 8, statusKind: "BLEED", statusPower: 4, statusDuration: 3 },
    },
  },
  {
    id: "pyro_chopper",
    name: "Chopper",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Support",
    tribe: "Forged Tech",
    // A MOTORCYCLE, not a helicopter — which is what it was built as first, and
    // the difference is most of the card. No FLYING, it closes on the ground,
    // and the fire it lays is a trail behind it rather than a load dropped from
    // above.
    //
    // RANGED, though, which this comment used to argue against ("a chopper
    // rides you down"). It throws fire; it does not have to be on top of you.
    //
    // THAT CHANGES DRIP TORCH, and by far more than it changes the basic. The
    // round-tick burn marks everything `canTarget` can see (phases.ts), so its
    // radius is the card's own attack reach — 1 while this was Melee, and
    // RANGED_REACH now. MEASURED on a 5x5, one lone target at a time so nothing
    // screened anything: from its home row it went from 5 squares to 19 of 24,
    // and from the middle of the board from 8 to ALL 24. A cost-3 body that
    // BURNs the entire board every round, for free, is the real edit here; the
    // attack type is only how it is spelled.
    //
    // Left as it stands because it was asked for, and noted at this length
    // because nothing else in the card says it.
    attackType: "Ranged",
    cost: 3,
    // 3 + 9 + 13 = 25 = 5*3+10. Re-cut toward SPEED, which is what a bike is:
    // SP 13 on a cost-3 body makes it one of the first things to move each
    // round, and it is frail enough that being fast is the only defence it has.
    dmg: 3,
    hits: 1,
    hp: 9,
    sp: 13,
    shields: 0,
    keywords: {},
    passiveNames: { roundTick: "Drip Torch", advanceOnBasic: "Throttle" },
    // Drip Torch survives the rewrite unchanged, because a drip torch is
    // literally the tool you lay a fire LINE with — it fitted a bike better than
    // it ever fitted the helicopter.
    roundTick: { inRangeStatus: { kind: "BURN", duration: 2, power: 1 } },
    // ...and it does not stop after it swings. Rolls a slot further in on every
    // basic, which is what carries the burning trail up the board.
    advanceOnBasic: 1,
    talent: {
      name: "Peel Out",
      text: "Once per game, free: open the throttle — 4 DMG and BURN 3 for 3 rounds to every opponent in the two spaces directly ahead, then roll two spaces forward.",
      // THE COLUMN AHEAD, TWO DEEP — `spread: 0` is one column wide (its own),
      // `forwardDepth: 2` is how far up it runs. It was `rowAhead: 1`, the whole
      // rank ACROSS the board, which is a strange thing for a motorcycle to do:
      // a bike lays its fire in the direction it is travelling, not sideways
      // through everything beside it. This is the same trail, pointed the way
      // the card is already facing.
      //
      // Not `sameColumn`, which is the other way to say "straight ahead" here:
      // that one is unbounded up the board and the branch that reads it
      // (phases.ts) is checked BEFORE `spread`, so setting both would silently
      // ignore the depth.
      handler: "barrage",
      // ...and it does not stop where it burned. `rollThrough: 2` carries the
      // bike two slots up its own column afterwards — the same primitive
      // Tumbleweed rolls on, and the same one `advanceOnBasic` already gives
      // this card on every ordinary swing. A talent called Peel Out that left
      // the bike parked was the odd part.
      params: {
        dmg: 4, targets: 99, spread: 0, forwardDepth: 2,
        statusKind: "BURN", statusPower: 3, statusDuration: 3, rollThrough: 2,
      },
    },
  },
  {
    id: "pyro_warkiln",
    name: "Warkiln",
    rarity: "legendary",
    element: "PYRO",
    cardClass: "Tank",
    tribe: "Forged Tech",
    attackType: "Melee",
    cost: 8,
    // 4*2 + 32 + 3*2 + 4 = 50 = 5*8+10. The +10 HP the recost buys IS the whole
    // recost -- it lands the budget exactly, with nothing left over.
    dmg: 4,
    hits: 2,
    hp: 32,
    sp: 4,
    shields: 3,
    // BLOCK is flat per-hit reduction applied BEFORE shields and even to PEN, so
    // it is brutal against this set's multi-hit style. Precedented (Ice Wall,
    // Granite Armadillo), but this is the number to cut first if the batch runs hot.
    keywords: { BLOCK: 2, TRAMPLE: true },
    passiveNames: { onShieldBreak: "Blowout", aura: "Forge Plating" },
    onShieldBreak: { status: { kind: "BURN", duration: 3, power: 3 } },
    // FORGE PLATING — the kiln armours its own. Tribe-scoped, so it reaches the
    // eleven Forged Tech cards and nothing else; a flat board-wide +2 on a
    // legendary would have been a different card.
    aura: { scope: "tribe", match: "Forged Tech", shields: 2 },
    special: {
      name: "Breakthrough",
      cost: 3,
      handler: "battleCharge",
      params: { charge: 2, dmg: 10, chainDmg: 5, push: 1 },
      targetSide: "enemy",
      // `ranged: true` is REQUIRED and is the WarPhant fix: without it a MELEE
      // charger can only cast at something already touching it, so there is
      // never a lane left to charge down.
      ranged: true,
      text: "Roll up to 2 slots forward, then grind the lane: 10 DMG to the first opponent ahead and 5 to each one packed behind it.",
    },
  },

  // -- AQUA --------------------------------------------------
  {
    id: "aqua_bluewhale",
    name: "Blue Whale",
    rarity: "legendary",
    element: "AQUA",
    cardClass: "Tank",
    tribe: "SeaC",
    attackType: "Melee",
    // Rarity is a cost band, so the mix and the curve are one decision: this
    // moved to hit the 2 Rare / 2 Epic / 1 Legendary split every element now
    // carries, and the stat line is re-cut to the budget that comes with it.
    cost: 6,
    // 3 + 33 + 1*2 + 2 = 40 = 5*6+10. Now huge in absolute terms too, and one
    // cost under Killer Whale so the two legendary AQUA whales still separate.
    dmg: 3,
    hits: 1,
    hp: 33,
    sp: 2,
    shields: 1,
    // THICK FAT. Blubber is the armour: every incoming hit comes off by 2
    // BEFORE shields, and PEN does not get through it either — which is the
    // difference between a big HP pool and a body that is genuinely hard to
    // hurt. The 33 HP was already there; this is what makes the 33 hold.
    //
    // Free, and deliberately: keywords sit outside the stat budget
    // (dmg*hits + hp + shields*2 + sp), so the line stays exactly on its cost-6
    // 40. That is the Tank half of the bargain — 3 DMG is what it pays for it,
    // and BLOCK 2 is well-trodden ground (nine other cards carry it).
    keywords: { BLOCK: 2 },
    passiveNames: { pushImmune: "Deep Ballast", BLOCK: "Thick Fat" },
    pushImmune: true,
    special: {
      name: "Breach",
      cost: 3,
      handler: "strike",
      // A shove rather than a self-buff. `empower` with `selfMaxHp` was the
      // Talent version and worked BECAUSE it fired once — repeatable, a
      // permanent +max HP every few rounds is a body that never stops growing.
      // The cold comes up with it. Damage and a shove was a shape any element
      // could have printed; FREEZE is what makes it AQUA's.
      params: { dmg: 8, push: 2, statusKind: "FREEZE", statusDuration: 2 },
      targetSide: "enemy",
      text: "Surface under an opponent for 9 DMG and shove it back 2 spaces.",
    },
  },
  {
    id: "aqua_divebill",
    name: "Divebill",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Ranger",
    // SEAC, not Avian. Divebill was the ONLY AQUA card in Avian, a tribe that is
    // otherwise entirely GALE (Galeon, Vvulture, Goldspur, Falcon) — so the one
    // aura keyed on it, +1 DMG and +3 SP to Avian allies, was a bonus this card
    // could only ever collect in a mixed GALE/AQUA deck, and never in its own
    // element's.
    //
    // SeaC is Kraken's school and pays +4 max HP to its members, which Divebill
    // can actually reach from an AQUA deck. It keeps FLYING and it is still a
    // diving seabird; what changes is whose school it belongs to, and a bird
    // that hunts by going underwater belongs to the water.
    tribe: "SeaC",
    attackType: "Ranged",
    // Rarity is a cost band, so the mix and the curve are one decision: this
    // moved to hit the 2 Rare / 2 Epic / 1 Legendary split every element now
    // carries, and the stat line is re-cut to the budget that comes with it.
    cost: 3,
    // 7 + 10 + 1*2 + 6 = 25 = 5*3+10.
    dmg: 7,
    hits: 1,
    hp: 10,
    sp: 6,
    shields: 1,
    keywords: { FLYING: true },
    // Spearpoint: the dive lands hardest the first time it finds a given target,
    // once per opponent per game. Replaced its Talent under the cost-3 rule.
    passiveNames: { firstStrikeBonus: "Spearpoint" },
    firstStrikeBonus: 3,
    talent: {
      name: "Spearpoint Dive",
      text: "Once per game, free: fold and drop — 10 DMG straight through shields (PEN) and leave the target SCALDED 3 for 2 rounds.",
      handler: "strike",
      // SCALD rather than FREEZE. Both are AQUA's own -- SCALD is already the
      // element's word for water that has been made a weapon (Steam Vent lands
      // it on anything FROZEN) -- but they are opposite tools: FREEZE is a LOCK
      // and SCALD is a DOT, so this stops being crowd control and starts being
      // damage that keeps arriving. It needs `statusPower`, which FREEZE never
      // did: a scald with no power is a status that burns for nothing.
      params: { dmg: 10, pen: 1, statusKind: "SCALD", statusPower: 3, statusDuration: 2 },
    },
  },
  {
    id: "aqua_firefighter",
    name: "Firefighter",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 5,
    // 4 + 18 + 2*2 + 9 = 35 = 5*5+10. AQUA healed for ZERO before this card, and
    // it is deliberately a hard counter to PYRO's BURN/SCALD.
    dmg: 4,
    hits: 1,
    hp: 18,
    sp: 9,
    shields: 2,
    keywords: { BLOCK: 1 },
    passiveNames: {
      roundTick: "First Response", onSummon: "Hose Down", onHitPush: "High Pressure",
    },
    roundTick: { healWoundedAllies: { underHp: 8, amount: 2 } },
    // HIGH PRESSURE — the hose does not stop after the arrival. Hose Down blows
    // the front line back once, on summon; this is the same jet on every basic,
    // which is what makes Firefighter a Support that can hold a lane instead of
    // a healer that happens to be standing in one. Free against the curve:
    // `onHitPush` is a passive, and the stat line is untouched at 35 = 5*5+10.
    onHitPush: 1,
    // HOSE DOWN — it arrives with the line already charged and blows the front
    // back a space. `statusNova` rather than a 0-damage `barrage`: nova runs
    // `applyDebuffRiders` (which owns `push`) and `maybeStatus` no-ops without a
    // statusKind, so this is a PURE shove. A barrage would have had to fake a
    // hit for zero to reach the same rider, and a fake hit is a real event --
    // it would trip Electrify, on-hit riders and every hit-taken counter on the
    // board for no damage.
    //
    // `targets: 99` with no spread/column/row param, which the on-summon path
    // reads as "every opponent in normal targeting range" -- a Ranged card's
    // reach, so the blast covers what the hose could actually cover.
    // ...AND IT CLEANSES ON THE WAY IN. `cleanseAlliesNegatives` rather than
    // barrage's `cleanseAllies`, which wipes buffs too -- this strips only what
    // is negative, the same rule the card's own Knock Down already follows.
    //
    // One `onSummon` carries both halves because it has to: the hook runs a
    // SINGLE handler with a SINGLE targetSide, so an enemy push and an ally
    // cleanse cannot be two entries. statusNova targets the enemy and the
    // cleanse rides along as a rider on the caster's own side.
    //
    // It is also the card finally doing what its stat comment always claimed --
    // "a hard counter to PYRO's BURN/SCALD" -- from the moment it lands, rather
    // than only once it has 3 magic for Knock Down.
    onSummon: {
      handler: "statusNova",
      params: { targets: 99, push: 1, cleanseAlliesNegatives: 1 },
      targetSide: "enemy",
    },
    special: {
      name: "Knock Down",
      cost: 3,
      handler: "heal",
      params: { targets: 99, amount: 5, cleanseNegatives: 1 },
      targetSide: "ally",
      text: "Heal every ally 5 HP and strip every negative status and debuff off them.",
    },
  },


  // -- the eight that needed engine work first ---------------
  {
    id: "dawn_ballista",
    name: "Ballista",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Ranger",
    tribe: "Stars",
    attackType: "Ranged",
    cost: 2,
    // 8 + 8 + 2*2 + 0 = 20 = 5*2+10.
    //
    // SP -2 / SHIELDS +2 IS NOT AN EVEN SWAP, which is why the HP moved too:
    // shields cost DOUBLE in the budget and SP costs single, so the trade as
    // asked lands at 22 against a 20 line. The general guard tolerates +/-2, but
    // the cards from this pass are held EXACT by forty-pass-engine.test.ts, so
    // two points had to come off -- and HP is the only place they could, with
    // 8 DMG PEN being the card's whole identity and the shields being the point
    // of the change.
    //
    // IN PLAY IT IS PROBABLY STILL A NERF, which is the more interesting half.
    // SP 2 -> 0 does not cost two points of speed, it costs ALL of it:
    // `moveReach` reads 0 as "cannot move at all", so the Ballista is now an
    // emplacement like Mortar -- where you set it down is the whole decision,
    // and it is a 2-cost body that can be walked around rather than one that
    // can reposition. Two shields on something that can never move is worth
    // less than two shields on something that can.
    dmg: 8,
    hits: 1,
    hp: 8,
    sp: 0,
    shields: 2,
    keywords: { PEN: true },
    passiveNames: { reachBonus: "Crank and Loose", attackEveryOtherRound: "Crank and Loose" },
    // RANGED_REACH is 2, so +1 prints as the card's "3 spaces". It stacks with
    // the King-of-the-Hill +1 like every other reach modifier.
    reachBonus: 1,
    // ...and the price of that range. Note what it does NOT restrain: DAWN's
    // Awakening aura strikes for full DMG the instant the card lands, and that
    // is not this card's turn, so 8 PEN still arrives free on a 2-cost body.
    attackEveryOtherRound: true,
  },
  {
    id: "gale_falcon",
    name: "Falcon",
    rarity: "rare",
    element: "GALE",
    cardClass: "Assassin",
    tribe: "Avian",
    attackType: "Melee",
    cost: 3,
    // 5 + 5 + 15 = 25 = 5*3+10. The owner's stat line, verbatim.
    dmg: 5,
    hits: 1,
    hp: 5,
    sp: 15,
    shields: 0,
    keywords: { FLYING: true },
    passiveNames: { plummet: "Plummet" },
    // 1 HP a dive on a 5 HP body: four dives and it is out of bird, which is the
    // whole restraint. See the field's own note for why this is not TRAMPLE.
    plummet: { selfDmg: 1, reach: 1 },
    talent: {
      name: "Falcon Punch",
      text: "Once per game, free: 10 DMG (PEN) to an adjacent opponent, taking its square on a kill.",
      handler: "strike",
      params: { dmg: 10, pen: 1, takeSpotOnKill: 1 },
    },
  },
  {
    id: "aqua_surferdude",
    // THE ID STAYS `aqua_surferdude`. Card ids are persisted -- collections,
    // saved squads, story rosters, and deck codes, which are INDICES into
    // deck-code.ts's list -- so renaming one would not rename anyone's copy, it
    // would delete it out of every existing collection. Same rule Nightwing
    // follows at `gale_breeze`. The art is named from the id too, so the plate
    // stays public/cards/aqua_surferdude.webp.
    name: "Kauai",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 4,
    // 5 + 15 + 1*2 + 8 = 30 = 5*4+10.
    dmg: 5,
    hits: 1,
    hp: 15,
    sp: 8,
    shields: 1,
    keywords: {},
    passiveNames: { advanceOnBasic: "Riding It In" },
    // The wave breaks on the row DIRECTLY AHEAD, so a Ranger parked at the back
    // would fire it into an empty row. `advanceOnBasic` walks it into range as it
    // shoots, which is what makes the Special reachable at all on this class.
    advanceOnBasic: 1,
    special: {
      name: "Surfs Up",
      cost: 2,
      handler: "surfsUp",
      params: { dmg: 5, heal: 3, push: 2 },
      targetSide: "enemy",
      text: "Send a wave through the row directly ahead — 5 DMG, shoved back 2 — and buoy the crew for 3 HP.",
    },
  },
  {
    id: "bolt_policecar",
    name: "Police Car",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Tank",
    tribe: "ARC",
    attackType: "Melee",
    cost: 4,
    // 3 + 15 + 3*2 + 6 = 30 = 5*4+10.
    //
    // The five points the recost buys go to HP and SPEED rather than damage,
    // because Hot Pursuit only means anything on a car that survives the shot
    // and can actually cover ground. SP 2 -> 6 is the load-bearing half: 6 is
    // where `moveReach` switches a card from one slot a move to two, so the
    // pursuit passive and the car's own legs finally agree about what this
    // thing is. It is still a Tank at 3 damage — it catches you, it does not
    // kill you.
    dmg: 3,
    hits: 1,
    hp: 15,
    sp: 6,
    shields: 3,
    keywords: { BLOCK: 1 },
    passiveNames: { spawnOnHitTaken: "Call for Backup", onAllyHitSpawn: "Officer Down", onHitByRangedAdvance: "Hot Pursuit" },
    // BOTH taps capped at 3, and the cap is the point: this is a free body per
    // hit on a cost-3 card, which is the shape that buries a board. The tick's
    // ceiling had to be BUILT (spawnOnHitTaken called spawnTokens uncapped).
    spawnOnHitTaken: { token: "bolt_police_tok", count: 1, oncePerRound: true, maxAlive: 3 },
    onAllyHitSpawn: { token: "bolt_police_tok", count: 1, oncePerRound: true, maxAlive: 3 },
    // HOT PURSUIT — shoot it and it comes for you. Ranged attackers only: a
    // melee card is already in its face and has nothing to close.
    //
    // ONCE PER ROUND, like both taps above and for the same reason. Per
    // hit-event a four-shot volley would tow the car four times in one attack,
    // and a back line taking turns on it could walk it across the board on the
    // opponent's turn — the two spaces are a threat, not a leash.
    onHitByRangedAdvance: { steps: 2, oncePerRound: true },
    special: {
      name: "All Units Respond",
      cost: 3,
      cooldown: 2,
      // Repeatable now rather than once-per-game, which is what an Epic owes.
      // It needs no new restraint: `maxAlive: 3` is the SAME ceiling the two
      // passives above answer to, so all three taps share one cap of three
      // Officers and a re-cast just tops the squad back up.
      handler: "spawn",
      params: { token: "bolt_police_tok", count: 2, radius: 1, maxAlive: 3 },
      targetSide: "self",
      text: "Call in 2 Officers beside it, up to 3 on the board. 2-round cooldown.",
    },
  },
  {
    id: "pyro_mortar",
    name: "Mortar",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Support",
    tribe: "Forged Tech",
    attackType: "Ranged",
    cost: 5,
    // 6 + 23 + 3*2 + 0 = 35 = 5*5+10.
    //
    // SP 0 -- IT DOES NOT MOVE. `moveReach` reads 0 as "cannot move at all",
    // which is the correct shape for a mortar: you emplace it, and where you
    // put it is the decision. The six points that bought speed it was never
    // going to use went into the two stats an emplacement actually wants, +3
    // damage and +3 HP, and the budget still lands exactly.
    dmg: 6,
    hits: 1,
    hp: 23,
    sp: 0,
    shields: 3,
    keywords: {},
    passiveNames: { vsStatus: "Ranging Shot", attackEveryOtherRound: "Reload", onHitStatus: "Concussive Impact", reachBonus: "Long Tube" },
    // RANGE 3. `rangedReachFor` is RANGED_REACH(2) + this + 1 for standing off
    // your own home row -- and the mortar can never collect that last one,
    // because SP 0 means it never leaves the row it was emplaced on. So this
    // reads as a flat 3 in play rather than the 3-or-4 the same field gives
    // Ballista, which can walk.
    reachBonus: 1,
    vsStatus: { status: "ROOT", bonusDmg: 4 },
    // RELOAD + CONCUSSIVE IMPACT, and they are one trade rather than two
    // abilities: the tube fires every OTHER round, and in exchange the shell
    // that does land rattles what it hits. Same shape Ballista buys its 8 PEN
    // with.
    //
    // STUN 2, RAISED FROM 1 -- and the 1 was load-bearing. This comment used to
    // read "short enough that the mortar cannot chain it, since it is reloading
    // on the round the stun would have to be refreshed". At 2 the stun now
    // covers the reload round, so the next shell lands while the target is
    // still held and refreshes it: one mortar can keep a single body stunned
    // for as long as it keeps hitting the same one. Measured: the shell lands
    // STUN 2, and after a full round -- the mortar's reload -- the target is
    // still held at 1, so the next shell refreshes it before it ever gets a
    // turn back.
    //
    // Deliberate, and left here in full so it is a choice rather than a
    // discovery. If it wants breaking, the cheapest lever is `attackEveryOtherRound`
    // -- a mortar that fires EVERY round with STUN 2 would not lock, because
    // the target gets its turn back between refreshes.
    attackEveryOtherRound: true,
    onHitStatus: { kind: "STUN", duration: 2, power: 0 },
    special: {
      name: "Airburst Shell",
      cost: 3,
      handler: "barrage",
      // `vsFlyingDmg`, NOT `antiAir`. antiAir is a TARGETING lift that lets a
      // MELEE swing pick a flier through the dodge, and is a complete no-op on a
      // Ranged caster like this one — printing it here would have been a param
      // that costs magic and silently does nothing.
      // A 4x4 BURST rather than two picked bodies. `blastSize` anchors the
      // square on the target and grows it AWAY from the mortar, so the card you
      // aim at is the near corner and the shell bursts onward through what is
      // behind it. `targets: 99` because the square decides the count now, not
      // the cap.
      params: { dmg: 6, targets: 99, blastSize: 4, vsFlyingDmg: 4, statusKind: "ROOT", statusDuration: 2 },
      targetSide: "enemy",
      text: "6 DMG and ROOT 2 rounds to every opponent in a 4×4 burst — 10 instead against anything FLYING, which the shell brings down.",
    },
  },
  {
    id: "pyro_pyrodactyl",
    name: "Pyrodactyl",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Mage",
    tribe: ["Avian", "Dragon"],
    // Dragon's Fury (tribe trait): every kill is +1 DMG, permanently.
    passiveNames: { onKill: "Dragon's Fury" },
    onKill: { buffDmg: 1 },
    attackType: "Ranged",
    // Rarity is a cost band, so the mix and the curve are one decision: this
    // moved to hit the 2 Rare / 2 Epic / 1 Legendary split every element now
    // carries, and the stat line is re-cut to the budget that comes with it.
    cost: 5,
    // 5*2 + 13 + 12 = 35 = 5*5+10.
    dmg: 5,
    hits: 2,
    hp: 13,
    sp: 12,
    shields: 0,
    keywords: { FLYING: true },
    special: {
      name: "Firestorm Pass",
      cost: 3,
      handler: "barrage",
      // `closest`, not `enemyHomeRow`. The back-line version needed an
      // `ignoreHomeRule` param to reach cards the home-slot rule protects, and
      // punching a hole in that rule for one card is a bad trade — the rule is
      // what stops every board-wide volley reaching the summon row. A pass over
      // the three nearest is the same card without the hole.
      params: { dmg: 5, targets: 3, closest: 1, statusKind: "BURN", statusPower: 2, statusDuration: 2 },
      targetSide: "enemy",
      text: "Fly the line: 5 DMG and BURN 2 for 2 rounds to the 3 nearest opponents.",
    },
  },
  {
    id: "aqua_sonarping",
    name: "Sonar Ping",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 2,
    // 3 + 9 + 8 = 20 = 5*2+10.
    dmg: 3,
    hits: 1,
    hp: 9,
    sp: 8,
    shields: 0,
    keywords: {},
    passiveNames: { onOppSummon: "Contact Ping", revealsStealth: "Echo Return" },
    // The ALWAYS-useful half is the ping, not the reveal: STEALTH-as-keyword is
    // on three cards in the whole set, so a pure anti-stealth body would answer
    // almost nothing. `boardWide` because arrivals land in the summoner's home
    // row, which the home-slot rule puts outside ordinary reach — a range-gated
    // summon reaction is a reaction to nothing.
    onOppSummon: { dmg: 2, boardWide: true, oncePerRound: true },
    revealsStealth: true,
  },


  // -- PROMOTED: both were TOKENS with real kits and real art, spawned by Kobra
  // and Aranea and otherwise unobtainable. They are draftable cards now, the way
  // `dawn_heir_tok` already is, and they keep their ids so both summoners go on
  // working untouched.
  //
  // Cost 4 Epic -> cost 3 RARE, because the set's two rules point at the same
  // slot: a Talent belongs to a cost-3 Rare, and an Epic owes a repeatable
  // Special these have never had. Rare at 3 satisfies both and is where the
  // Talent the owner asked for can actually live. Restatted to the cost-3
  // budget, which costs each summoner a little body — Kobra's cobra loses 6
  // points and Aranea's spider 2.
  {
    id: "bore_kingcobra_tok",
    art: "bore_kingcobra_tok",
    name: "King Cobra",
    rarity: "rare",
    element: "BORE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 3,
    // 5 + 8 + 2*2 + 8 = 25 = 5*3+10.
    dmg: 5,
    hits: 1,
    hp: 8,
    sp: 8,
    shields: 2,
    keywords: {},
    tribe: "Sand Village",
    passiveNames: { vsStatus: "Ambush Coil", onHitStatus: "Sleeping Venom" },
    onHitStatus: { kind: "SLEEP", duration: 2, power: 0, chance: 30 },
    vsStatus: { status: "SLEEP", dmgMult: 2 },
    talent: {
      name: "Hood Flare",
      text: "Once per game, free: rear up and put 2 opponents to SLEEP for 2 rounds.",
      // SLEEP, not the BLIND the shelved duplicate used: this card's whole
      // payoff is Ambush Coil doubling into a SLEEPING body, so the Talent sets
      // up its own kit instead of importing a status nothing here reads.
      handler: "statusNova",
      params: { statusKind: "SLEEP", statusDuration: 2, targets: 2 },
    },
  },
  {
    id: "dusk_monstrous_spider_tok",
    art: "dusk_monstrous_spider_tok",
    name: "Monstrous Spider",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    // 5 + 12 + 2*2 + 4 = 25 = 5*3+10.
    dmg: 5,
    hits: 1,
    hp: 12,
    sp: 4,
    shields: 2,
    keywords: {},
    tribe: "Spider",
    passiveNames: { onDeath: "Bursting Brood" },
    onDeath: { dmg: 0, spawnToken: { token: "dusk_spider", count: 2 } },
    talent: {
      name: "Wrapping Web",
      text: "Once per game, free: ROOT every opponent in range for 2 rounds.",
      // Duration 2, not 1: a status applied in BATTLE is ticked away at Cleanup
      // before Prep, so at 1 the move-lock never actually lands on anybody.
      handler: "statusNova",
      params: { targets: 99, statusKind: "ROOT", statusDuration: 2 },
    },
  },

];

// ── Tokens ───────────────────────────────────────────────────────────────────
// Spawned by cards, never dealt from a deck. Kept OUT of CARDS so decks + the
// cost-formula test ignore them; merged into CARD_INDEX below so getDef resolves
// them. (Reptilian and Heir used to live here — they are draftable now, but are
// still spawned by Trinezer and Imperator exactly as before.)
export const TOKENS: CardDef[] = [
  // ── VOID — the Watcher brood ────────────────────────────────────────
  // One Eyes is VOID's aura and every one of these carries it by element: each
  // landed strike steals a point of damage from what it hits, and every fourth
  // hit against it is deflected. That is the whole tribe's identity, so the
  // spawns need no printed passive to express it -- the swarm IS the mechanic,
  // and a board of nine of them is nine small thefts a round.
  //
  // In TOKENS rather than CARDS on purpose: the set's evenness invariant is
  // `45 draftable x 8 elements = 360`, and a ninth element with draftable cards
  // breaks it. VOID is the tower's element, not a ninth deck.
  {
    id: "void_mote_tok",
    name: "Mote",
    rarity: "rare",
    element: "VOID",
    cardClass: "Assassin",
    tribe: "Watcher",
    attackType: "Melee",
    cost: 2,
    // 5 + 9 + 6 = 20 = 5*2+10. On the curve like everything else, even though
    // nothing buys these -- a token off the curve is a boss budget that lies.
    // 5 + 12 + 6 = 23 against a cost-2's ordinary 20. Still above a common,
    // pulled back from 26 — see the note on Spindle's clear rate.
    dmg: 5,
    hits: 1,
    hp: 12,
    sp: 6,
    shields: 0,
    keywords: {},
    // THE PLATE IS A SWARM — a dozen identical bodies coming over the rubble
    // together, not one creature. So the card is worth what the brood around it
    // is worth: +1 DMG for every other Watcher still standing, to +3. Kill the
    // motes and the motes get weaker, which is the read the picture gives you
    // before any text does.
    // `packDmg` lives on roundTick, not on the def — it is recomputed each round
    // from who is still standing rather than accumulated, which is exactly the
    // behaviour this art wants: the number falls as the swarm is thinned, in
    // front of you.
    passiveNames: { roundTick: "Swarm Sense" },
    roundTick: { packDmg: { tribe: "Watcher", per: 1, max: 3 } },
    // A mote is a splinter off the eye, and the plate shows a dozen of them —
    // so what it does with a moment of magic is BE more of them.
    special: {
      name: "Split",
      cost: 2,
      handler: "spawn",
      params: { token: "void_mote_tok", count: 1, radius: 2 },
      targetSide: "self",
      cooldown: 3, // a self-replicating token needs a leash
      text: "Split off another Mote nearby. 3-round cooldown.",
    },
  },
  {
    id: "void_watcher_tok",
    name: "Watcher",
    rarity: "rare",
    element: "VOID",
    cardClass: "Ranger",
    tribe: "Watcher",
    attackType: "Ranged",
    cost: 3,
    // 6 + 10 + 1*2 + 7 = 25 = 5*3+10.
    // 7 + 12 + 1x2 + 7 = 28 against a cost-3's 25. Back from 32.
    dmg: 7,
    hits: 1,
    hp: 12,
    sp: 7,
    shields: 1,
    // IT HAS WINGS AND IT IS IN THE AIR — the plate is a flier banking over the
    // spires, which is the one thing a Ranger token can say with a keyword.
    keywords: { FLYING: true },
    // It is already in the air on its plate; the Special is the part where it
    // stops circling. Two targets, because a stoop picks one and the wings
    // carry it through a second.
    special: {
      name: "Stoop",
      cost: 2,
      handler: "barrage",
      params: { dmg: 7, targets: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "Dive on up to 2 opponents for 7 DMG each.",
    },
  },
  {
    id: "void_lidless_tok",
    name: "Lidless",
    rarity: "rare",
    element: "VOID",
    cardClass: "Mage",
    tribe: "Watcher",
    // MELEE. An eye this size does not shoot — it looms, and what it looks at
    // has to be in front of it. The basic drops from reach 2 to adjacency, which
    // is a real cost on an 8-DMG body; Regard is untouched because that Special
    // already prints `ranged: true`, so it keeps its three targets from wherever
    // Lidless is standing.
    attackType: "Melee",
    cost: 4,
    // 7 + 13 + 1*2 + 8 = 30 = 5*4+10.
    // 8 + 16 + 1x2 + 8 = 34 against a cost-4's 30. Back from 38.
    dmg: 8,
    hits: 1,
    hp: 16,
    sp: 8,
    shields: 1,
    keywords: {},
    // A LIDLESS EYE, open in the middle of the face and impossible to look away
    // from. What it does to what it looks at is take its sight: BLIND for 2.
    // The name is the ability — this is the card that is always looking, and
    // the thing it looks at stops being able to.
    passiveNames: { onHitStatus: "Unblinking", revealsStealth: "Nothing Hides" },
    onHitStatus: { kind: "BLIND", duration: 2, power: 0 },
    // NOTHING HIDES. A lidless eye that could be hidden from was the one thing
    // this card could not be. Like Sonar Ping's Echo Return it is SIDE-WIDE
    // rather than personal: while Lidless is alive on the board, every card on
    // its side may target a cloaked opponent normally. The counter is the
    // obvious one — kill the eye and the cloak comes back.
    revealsStealth: true,
    // The basic takes one opponent's sight. The Special is the eye opening
    // properly: three of them at once, and it hurts to be looked at.
    special: {
      name: "Regard",
      cost: 3,
      handler: "barrage",
      params: { dmg: 8, targets: 3, statusKind: "BLIND", statusDuration: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "Look at up to 3 opponents: 8 DMG each and BLIND for 2 rounds.",
    },
  },
  {
    id: "void_scryer_tok",
    name: "Scryer",
    rarity: "epic",
    element: "VOID",
    cardClass: "Support",
    tribe: "Watcher",
    attackType: "Ranged",
    cost: 5,
    // 6 + 18 + 2*2 + 7 = 35 = 5*5+10.
    // 6 + 22 + 2x2 + 7 = 39 against a cost-5's 35. Back from 43.
    dmg: 6,
    hits: 1,
    hp: 22,
    sp: 7,
    shields: 2,
    keywords: {},
    // IT CARRIES A STAFF OF THREE EYES and holds a hand out over the brood —
    // it is not fighting, it is directing. A Support that sharpens the whole
    // Watcher line rather than swinging: +1 DMG to every Watcher while it
    // lives, itself included, and killing it takes that back off all of them.
    passiveNames: { aura: "Farsight" },
    aura: { scope: "tribe", match: "Watcher", dmg: 1 },
    // The staff has three eyes and the free hand is held OUT, over the brood.
    // A Support's Special should be the thing the picture is already doing:
    // seeing what is coming and putting something between it and the line.
    special: {
      name: "Foresight",
      cost: 3,
      handler: "grantShield",
      params: { amount: 4, nearby: 1, buffDmg: 1, buffRounds: 2 },
      targetSide: "ally",
      text: "Shield an ally and its neighbours for 4, and give them +1 DMG for 2 rounds.",
    },
  },
  {
    id: "void_sentinel_tok",
    name: "Sentinel Eye",
    rarity: "epic",
    element: "VOID",
    cardClass: "Tank",
    tribe: "Watcher",
    attackType: "Melee",
    cost: 6,
    // 6 + 24 + 3*2 + 4 = 40 = 5*6+10.
    // 7 + 26 + 4x2 + 3 = 44 against a cost-6's 40. Back from 49; still a wall
    // that answers, just not one that also wins the exchange.
    dmg: 7,
    hits: 1,
    hp: 26,
    sp: 3,
    shields: 4,
    // ARMOUR WITH EYES SET INTO IT, greatsword planted point-down in the
    // ground: a thing standing watch rather than advancing. BLOCK 2 is the
    // plate, flat off every hit rather than a pool that runs out...
    keywords: { BLOCK: 2 },
    // ...and this is the stance. It screens the three columns of its own home
    // row, which is what a sentinel with a planted sword IS — you go around it
    // or you go through it.
    passiveNames: { guardsHomeRow: "Vigil" },
    guardsHomeRow: true,
    // The greatsword is planted point-down and it has not moved. What a thing
    // like that does under pressure is dig in harder — plate for itself and for
    // whatever is standing behind it.
    special: {
      name: "Bulwark",
      cost: 3,
      handler: "grantShield",
      params: { amount: 5, nearby: 2, heal: 5 },
      targetSide: "ally",
      text: "Plate an ally and up to 2 neighbours for 5 shields and heal them 5.",
    },
  },
  {
    id: "void_occulith_tok",
    name: "Occulith",
    rarity: "legendary",
    element: "VOID",
    cardClass: "Warrior",
    tribe: "Watcher",
    attackType: "Melee",
    cost: 8,
    // 11 + 26 + 4*2 + 5 = 50 = 5*8+10.
    // SIX BLADED LIMBS on the plate, so it strikes like six and not like one:
    // 3 x 4 with PEN, against the single 11-damage swing it printed before.
    // Twelve total rather than eleven, and every point of it goes through
    // shields — which is what a wall of scythes should feel like to stand in
    // front of.
    // 5x3 + 26 + 4x2 + 6 = 55 against a cost-8's 50. Back from 60.
    dmg: 5,
    hits: 3,
    hp: 26,
    sp: 6,
    shields: 4,
    keywords: { PEN: true },
    // Six scythes on the plate. The basic swings three of them; this is all of
    // them at once, through the rank in front and through their shields.
    special: {
      name: "Reap",
      cost: 4,
      handler: "barrage",
      params: { dmg: 9, targets: 99, spread: 1, forwardDepth: 1, pen: 1 },
      targetSide: "enemy",
      text: "Sweep every opponent in the row directly ahead for 9 DMG, ignoring shields.",
    },
  },
  {
    id: "bore_rolling_boulder_tok",
    name: "Rolling Boulder",
    rarity: "epic",
    element: "BORE",
    cardClass: "Tank",
    attackType: "Melee",
    // Costed as a body it would be fair to field: 0 damage and 70 body points
    // of pure obstruction that happens to be moving toward you.
    cost: 4,
    // NO ATTACK AT ALL. It never takes a turn in the battle phase — everything
    // it does happens in the round tick, by rolling. A 0-DMG body is normally a
    // mistake; here it is the design, and SP 0 says the same thing twice.
    dmg: 0,
    hits: 1,
    // 50 -> 40 (owner's call). Its survivability is the whole of what a boulder
    // costs the player: it has no attack, so the only question a rock asks is
    // how many swings it takes to stop one before it rolls into somebody.
    // `tramplesAnything` means the HP does NOT gate what it can crush — that
    // weight check is lifted — so this is a pure durability trim and its 35
    // damage is untouched.
    hp: 40,
    sp: 0,
    // 10 -> 5 (owner's call), alongside the HP. Shields block PER HIT in this
    // game, so on a body the player chips down this is the heavier half of the
    // two cuts: it is not 5 fewer points of health, it is 5 fewer points off
    // EVERY swing that lands. 70 body points at first writing, 50 now.
    shields: 5,
    keywords: { TRAMPLE: true },
    // MASS IN MOTION. An ordinary trample only shoves something lighter than
    // itself; a 50-HP rock would therefore stop dead at nearly every real card
    // and its 35-damage crush would be an ability that never fired.
    tramplesAnything: true,
    tribe: "Cavernous",
    art: "bore_rolling_boulder_tok",
    passiveNames: { roundTick: "Rolling Start", trampleDmg: "Crush" },
    // CRUSH: 35 to whatever it rolls over. The same `trampleDmg` Hoarfell
    // carries, and it PENETRATES shields (`applyShove`) — masonry is not armour
    // to a boulder, which is what lets a rockfall answer a wall.
    // CRUSH, 35 -> 12. A big cut that buys little, and BOTH halves of that are
    // the point: set to ZERO the fight still read 90.6% (from 95.3), so the
    // boulders were never winning on this number. They win by BODY — filling
    // the player's home row for the overrun — which is why the count (Rockfall's
    // cadence and the two caps) is the real tuning and this is only the share of
    // it that happens to be damage. Cutting it is nearly free, so it is cut to
    // where the fight lands mid-band rather than shaved to taste.
    trampleDmg: 12,
    // It rolls THROUGH, not up to. `advance` stops dead at the first occupied
    // slot, which is right for a seed and wrong for a boulder; `advanceTrample`
    // routes through `chargeForward` so the shove and its crush damage are the
    // ones every other trampling thing uses.
    roundTick: { advanceTrample: 1 },
  },
  {
    id: "gale_thundering_hurricane_tok",
    name: "Thundering Hurricane",
    rarity: "epic",
    element: "GALE",
    // BACK TO A RANGED MAGE (owner's call, after a spell as a melee Warrior).
    // It reaches from where it stands again, which is what a storm should do —
    // and it resolves the tension the melee spell created: a body whose passive
    // shoves the board away could never reach what it pushed. Ranged, that
    // passive costs it nothing, and Storm Surge's splash lands from range.
    cardClass: "Mage",
    attackType: "Ranged",
    // Cost held at 6 even though the body came down, and deliberately: it is
    // priced for what it DOES on arrival — reeling the board in, 15 damage and
    // a 2-round hold — not for its meat. It also keeps Skybreaker's formation
    // on its exact 44-gold budget.
    cost: 6,
    dmg: 20,
    hits: 1,
    // 85 -> 55 (owner's call). Cost stays 6 for the reason above — this body is
    // priced for what it does on ARRIVAL, not for its meat — and holding the
    // cost is also what keeps Skybreaker's formation on its exact 44-gold
    // budget, which a re-cost would break.
    hp: 55,
    sp: 15,
    shields: 0,
    keywords: {},
    tribe: "Hurricane",
    art: "gale_thundering_hurricane_tok",
    passiveNames: { roundTick: "Wind Wake", basicSplash: "Storm Surge" },
    // STORM SURGE — it does not hit one thing. `splashAll` rather than the
    // single-neighbour default (Cloudburst's Rainstorm clips one): a hurricane
    // that picked one card out of a cluster would be a lightning bolt.
    //
    // 10 is half its printed 20 — a real second hit rather than Rainstorm's
    // 1-point chip, and the reason is this token specifically: Wind Wake shoves
    // the board away from it every Cleanup, so its basic lands SELDOM. Splash
    // is what makes the rounds it does connect worth the wait.
    basicSplash: 10,
    splashAll: true,
    // WIND WAKE, the same name Zephyra's `onHitPush` carries, and deliberately
    // the AoE version of it: this one does not need to land a hit. Everything
    // the player owns is shoved a slot away at the end of every round, so a
    // board trying to close on the hurricane loses ground just for standing
    // near it.
    //
    // ON A TWO-BEAT. It arrived to fix the melee version's self-defeat (a body
    // that shoved away everything its own basic needed to touch), and it is
    // KEPT now that the card is ranged again, because it is better weather:
    // a board shoved every single round can never form up at all, while a
    // two-beat lets it re-form and then breaks it again.
    roundTick: { pushEnemies: 1, pushEnemiesEveryN: 2 },
    // ON ARRIVAL it does the exact opposite — reels everything within 2 into
    // contact, hits for 15 and holds it there for 2 rounds. The two halves
    // fight each other on purpose: it drags you in once, then spends the rest
    // of the fight pushing you back out, so the round it lands is the round
    // your formation is worst and its damage is highest.
    onSummon: {
      handler: "barrage",
      params: {
        antiAir: 1,
        dmg: 15, targets: 99, reach: 2, pullToCaster: 2,
        statusKind: "PARALYZE", statusDuration: 2,
      },
      targetSide: "enemy",
    },
  },
  {
    id: "pyro_fire_giant_tok",
    name: "Fire Giant",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Warrior",
    attackType: "Melee",
    tribe: "Volcanic",
    cost: 8,
    // 12 + 34 + 5x2 + 5 = 61 against a cost-8's ordinary 50. Boss brood, and
    // the same tier above the curve Spindle's Occulith sits at.
    dmg: 12,
    hits: 1,
    hp: 34,
    sp: 5,
    shields: 5,
    // TRAMPLE, because the plate is a thing that does not go around. It is also
    // the keyword the Lava Gate deliberately answers rather than deletes — a
    // giant shoves a gate ASIDE and opens a lane, which is the interaction the
    // void gate's own note argues for.
    keywords: { TRAMPLE: true },
    passiveNames: { onHitStatus: "Molten Fists" },
    // Everything it touches catches: its hands are lava on the plate.
    onHitStatus: { kind: "BURN", duration: 2, power: 2 },
    special: {
      name: "Magma Fist",
      cost: 3,
      handler: "strike",
      params: { dmg: 18, charge: 1, chargeFirst: 1, statusKind: "BURN", statusPower: 3, statusDuration: 2 },
      targetSide: "enemy",
      text: "Wade in a space and hammer one opponent for 18, BURNing it 3 for 2 rounds.",
    },
  },
  {
    id: "pyro_lava_gate_tok",
    name: "Lava Fortress Gate",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 0,
    // Masonry, on the Fortress Gate's pattern — but HERS, and hotter: 24 HP
    // behind 12 plates against the void gate's 20 behind 10.
    dmg: 0,
    hits: 1,
    hp: 24,
    sp: 0, // it is a wall — it does not move, and moveReach(0) is 0
    shields: 12,
    keywords: {},
    passiveNames: {
      noKillReward: "Nothing to Gain", guardsHomeRow: "Hold the Line",
      noBattleTurn: "Masonry", onHitByMelee: "Molten Stone",
    },
    // A PIECE, not a combatant — it never takes a battle turn and never enters
    // the speed queue, exactly like the wall the player gets.
    noBattleTurn: true,
    guardsHomeRow: true,
    noKillReward: true,
    // ...but this one is still molten. Hitting it with your hands burns them,
    // which is the difference between her wall and the player's: theirs is
    // cold stone, hers has not finished cooling.
    onHitByMelee: { dmg: 3, status: { kind: "BURN", duration: 2, power: 2 } },
  },
  {
    id: "void_fortress_gate_tok",
    name: "Fortress Gate",
    rarity: "rare",
    element: "BORE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 0,
    // 20 HP behind 10 shields. Shields block per HIT, which is exactly what a
    // gate should do to a boss that swings once for a great deal: Vulcanyx's 18
    // and Hoarfell's 15 both arrive 10 lighter, so the wall holds for rounds
    // rather than for one swing.
    dmg: 0,
    hits: 1,
    hp: 20,
    sp: 0, // it is masonry — it does not move, and moveReach(0) is 0
    shields: 10,
    keywords: {},
    // NOT pushImmune, and that is the point. TRAMPLE shoves the gate ASIDE
    // rather than through it, so a juggernaut opens a lane without the wall
    // having to fall — which is exactly what a juggernaut should do to a gate.
    //
    // It was pushImmune first, on the reasoning that a fortress does not budge.
    // Measured, that reasoning cost Hoarfell its whole identity: TRAMPLE
    // refused, its momentum ramp needs UNOBSTRUCTED advance so Avalanche never
    // built once, and it read 12.5% — the wall did not slow the juggernaut down,
    // it switched it off. A keyword the wall answers is fine; a keyword the wall
    // deletes is not.
    passiveNames: {
      noKillReward: "Nothing to Gain", guardsHomeRow: "Hold the Line",
      noBattleTurn: "Masonry",
    },
    // Masonry: it is a PIECE, not a combatant, so it never enters the speed
    // queue. Five gates were adding five "CAN'T ACT" rows to the queue every
    // round of a tower fight — for both sides, since the display shows the
    // whole board's order. It still stands, still screens, still has to be
    // broken; it just does not queue up to do nothing.
    noBattleTurn: true,
    // Hold the Line: nothing may be targeted in the three home squares BEHIND it
    // while it stands — fliers and ranged included, which is the entire point. A
    // gate a dragon can simply shoot over is not a gate.
    guardsHomeRow: true,
    // Nothing to Gain: killing it feeds NOTHING. Every boss in this mode is
    // built to grow on kills, so a gate that paid out on the way down would be
    // a free meal parked inside the boss's reach rather than a wall.
    noKillReward: true,
  },
  {
    id: "leaf_leafwind_guardian_tok",
    name: "Leafwind Forest Guardian",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 4,
    // Fast and light — 8 SP so it arrives before the thing it is dragging can
    // reposition, and a body that folds to the same chip damage Kazehaya's
    // riposte is trying to make you use. Killing the retinue is meant to be the
    // easy part; getting to swing at the samurai is not.
    dmg: 6,
    hits: 2,
    hp: 26,
    sp: 8,
    shields: 2,
    keywords: {},
    tribe: "Grove",
    art: "leaf_leafwind_guardian_tok",
    passiveNames: { pullOnAttack: "Hooked Vine" },
    // Hooked Vine: it does the samurai's work. Every landed hit hauls the
    // target one slot closer, so a back line that is carefully staying out of
    // Kazehaya's 15-damage reach gets walked into it by the escorts — the same
    // idea as Cutting Wind, arriving twice a round instead of once every three.
    pullOnAttack: 1,
  },
  {
    id: "gale_whirlwind_warrior_tok",
    name: "Whirlwind Forest Warrior",
    rarity: "epic",
    element: "GALE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    // The other half of the pincer, and deliberately the cheaper one: it costs
    // 3 so a formation can field two of it beside one Guardian.
    dmg: 7,
    hits: 1,
    hp: 24,
    sp: 9,
    shields: 1,
    keywords: {},
    tribe: "Grove",
    art: "gale_whirlwind_warrior_tok",
    passiveNames: { onHitPush: "Wind Shear" },
    // Wind Shear: it shoves. Pointed the OPPOSITE way to the Guardian's hook on
    // purpose — one drags you in, the other blows you back out, and between them
    // a player's careful line stops being a line at all. Neither does much
    // damage; scattering the board is the contribution.
    onHitPush: 1,
  },
  {
    id: "dawn_golden_bull_tok",
    name: "Golden Bull",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 4,
    // It is a RUNAWAY, not a bodyguard: heavy enough to hurt on the way through
    // and thin enough that whatever it lands next to gets to answer it. The
    // damage that matters is on the charge, not on the body.
    //
    // 18/11 -> 14/7 at the owner's call. It arrives deep in enemy territory by
    // design, so a body that could also survive there was doing two jobs; now
    // the charge is the whole of it and what it runs into gets to answer.
    dmg: 5,
    hits: 1,
    hp: 14,
    sp: 7,
    shields: 0,
    keywords: { TRAMPLE: true },
    tribe: "Sun's Army",
    art: "dawn_golden_bull_tok",
    passiveNames: { summonCharge: "Wild Charge" },
    // Wild Charge: it arrives already running. Straight up its column for the
    // enemy home row, 6 PEN to every opponent in the lane, and it does not stop
    // for any of them — it ends on the furthest open square it reached, which
    // on an empty board is the far side of the battlefield.
    //
    // 6 is a lane, not a nova: it only ever touches the column it was spawned
    // into, so a player who keeps their line spread pays almost nothing and one
    // who stacks a column pays for all of it. That is the decision the card is
    // for.
    summonCharge: { dmg: 6 },
  },
  {
    id: "aqua_blackice_crystal_tok",
    name: "Blackice Crystal",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 2,
    dmg: 0,
    hits: 1,
    hp: 14,
    sp: 0, // a spire of ice — it is grown, not deployed
    shields: 3,
    keywords: {},
    tribe: "Ice",
    passiveNames: {
      roundTick: "Creeping Rime", onDeath: "Shatter", noBattleTurn: "Ice Spire",
    },
    // Ice Spire: SCENERY, the same as the Fortress Gates. Cryovex keeps up to
    // three of these alive at once, and each one was taking a speed-queue slot
    // to swing for the 1 damage the effective-damage floor hands any 0-DMG card
    // — against a card whose own note two lines down says "it does no damage at
    // all". Both of the things it actually does happen outside the queue:
    // Creeping Rime is a roundTick (Cleanup) and Shatter is an onDeath.
    //
    // The other 0-DMG boss-side pieces were deliberately NOT given this. The
    // static wisps and Static Cloud (Overclock) carry BOLT's Electrify, which
    // turns a 0-damage basic into a real one against anything statused, and they
    // drift forward on a roundTick — they are hazards that act, not masonry.
    noBattleTurn: true,
    // Creeping Rime: it does no damage at all. Its whole job is to keep the
    // nearest opponent FROZEN, which is what feeds Cryovex — Deep Freeze scales
    // with how long a card has been held, so the crystals are the clock and the
    // dragon is the hammer. `pokeStatus` takes the CLOSEST, so it telegraphs.
    roundTick: { pokeStatus: { kind: "FREEZE", duration: 1, power: 0 } },
    // Shatter: killing it is not an escape. It bursts as it dies and freezes
    // everything in the eight squares around it — so clearing the crystals off
    // your board is itself the thing that starts the next freeze.
    onDeath: { dmg: 0, inRangeStatus: { kind: "FREEZE", duration: 1, power: 0 } },
  },
  {
    id: "gale_sparkwolf_tok",
    name: "Spark Wind Wolf",
    rarity: "rare",
    element: "GALE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 1,
    dmg: 3,
    hits: 1,
    hp: 8,
    sp: 9,
    shields: 0,
    keywords: {},
    // WOLF, which is the whole point of it: Thunderfangs' Pack Law scales its
    // damage with living Wolves to +12, so every wolf raised is teeth on the
    // boss as well as a body on the board.
    tribe: "Wolf",
    passiveNames: { onHitStatus: "Static Coat" },
    // Static Coat: it leaves the storm on whatever it bites — and Storm Teeth
    // adds 4 to everything Thunderfangs lands on the ELECTRIFIED, so the pack
    // sets up its own leader. Fast (SP 9) and paper-thin, because a spark on
    // the wind is not supposed to survive being answered.
    onHitStatus: { kind: "ELECTRIFIED", duration: 2, power: 0 },
  },
  {
    // Nightfang's disguise. A TOKEN, not a draftable card: you never put the
    // Butler in a deck — Nightfang wears it, and killing it is what takes it
    // off. The stat line is deliberately unremarkable, because the whole trick
    // is that it reads as a cost-2 body sitting in the back until it isn't.
    //
    // Costed at 8 for display only: that is what you actually paid for it.
    id: "dusk_butler",
    name: "The Butler",
    // RARE, not legendary — the rarity is part of the disguise. The card face
    // prints its tier, so a Butler stamped LEGEND is a Butler everybody reads
    // correctly and nobody touches. Nothing mechanical keys on this for a DUSK
    // token: the one rarity-driven effect in the game is BORE's Exostone shield
    // table, and Nightfang's true form carries its own rarity regardless.
    rarity: "rare",
    element: "DUSK",
    cardClass: "Support",
    attackType: "Melee",
    cost: 8,
    dmg: 2,
    hits: 1,
    hp: 12,
    sp: 5,
    shields: 0,
    keywords: {},
    tribe: "Dark",
    // Butler's Service: +4 HP to every other ally standing beside it, each
    // round. It is a Support by class and now by behaviour, which is the
    // disguise doing its job — a card that visibly mends the line reads as
    // exactly the harmless back-row body Nightfang wants you to see, and the
    // healing is real while it lasts. Melee, so "in range" is adjacent: it has
    // to stand with the people it keeps alive.
    passiveNames: { roundTick: "Butler's Service" },
    roundTick: { healAlliesInRange: 4 },
  },
  {
    id: "gale_ollie",
    name: "Ollie",
    rarity: "rare",
    element: "GALE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 2,
    sp: 11,
    shields: 0,
    keywords: { FLYING: true },
    // Flying Arrow: also fires at whatever the ally directly BEHIND it just
    // struck with a basic attack.
    passiveNames: { flyingArrow: "Flying Arrow" },
    flyingArrow: true,
  },
  {
    // The remnant of Kore's Meltdown. A deliberately weakened Static Cloud:
    // half the body, half the discharge, and a PARALYZE that lasts one round
    // instead of two. Kore dying into the FULL cost-2 Static Cloud card handed
    // a cost-5 epic a second real card for free, on top of Living Reactor and
    // Core Overload — this keeps the flavour of the containment failing without
    // paying out a whole extra body. Borrows the cloud's art.
    id: "bolt_static_wisp_tok",
    art: "bolt_staticcloud",
    name: "Static Wisp",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 1,
    dmg: 0,
    hits: 1,
    hp: 10,
    sp: 0,
    shields: 0,
    keywords: {},
    tribe: "ARC",
    // Fading Static: drifts a slot forward, then discharges 2 DMG + PARALYZE 1
    // at a random opponent. Same shape as Rolling Static, dialled down.
    passiveNames: { roundTick: "Fading Static" },
    roundTick: { advance: 1, randomEnemyDmg: 2, randomEnemyStatus: { kind: "PARALYZE", duration: 1, power: 0 } },
  },
  {
    id: "bolt_drone_tok",
    art: "bolt_drone",
    name: "Drone",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 1,
    dmg: 1,
    hits: 1,
    hp: 1,
    sp: 8,
    shields: 1,
    // A disposable flying eye — it dodges melee outright, so it survives long
    // enough to chip in (and BOLT's Electrify means its 1 DMG still marks).
    keywords: { FLYING: true },
    // ARC with the rest of BOLT's machines, and with Zipp that builds it.
    tribe: "ARC",
  },
  {
    id: "bolt_firebolt_tok",
    name: "Firebolt Drone",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Ranger",
    attackType: "Ranged",
    // The Drone's line exactly — 1/1/1, flying, ARC — because the point is that
    // it is the SAME machine off the same line, with two things bolted on.
    cost: 1,
    dmg: 1,
    hits: 1,
    hp: 1,
    sp: 8,
    shields: 1,
    keywords: { FLYING: true },
    tribe: "ARC",
    passiveNames: { onDeath: "Scrap Blast", onHitStatus: "Cinder Rounds" },
    // Scrap Blast: it goes off like a Crow does (`inRangeDmg`, the Bird Bomb
    // shape). Four rather than the Crow's five — this one is spawned in
    // numbers by a boss on a free three-round clock, and a Crow is a card you
    // had to buy and place.
    onDeath: { dmg: 0, inRangeDmg: 4 },
    // Cinder Rounds: the PYRO half of Overclock's pairing, expressed on the
    // thing it builds rather than on itself. A 1-damage drone is a rounding
    // error; a 1-damage drone that leaves you burning is a reason to shoot it,
    // which is what the swarm puzzle wants you doing.
    onHitStatus: { kind: "BURN", duration: 2, power: 2 },
  },
  {
    id: "dusk_redreven",
    name: "RedRaven",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 4,
    dmg: 6,
    hits: 1,
    hp: 9,
    sp: 9,
    shields: 0,
    keywords: {},
    tribe: "Dark",
    // Red Shift (On Summon): opponents cannot use Specials this round.
    passiveNames: { onSummon: "Red Shift" },
    onSummon: { handler: "lockSpecials", params: { rounds: 1 }, targetSide: "enemy" },
  },
  {
    id: "leaf_acorn_tok",
    art: "leaf_acorn",
    name: "Acorn",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 3,
    sp: 3,
    shields: 0,
    keywords: {},
    tribe: "Grove",
    // Seed Roll: rolls one slot forward toward the enemy home at end of each round.
    passiveNames: { roundTick: "Seed Roll" },
    roundTick: { advance: 1 },
  },
  {
    id: "leaf_reptilian_tok",
    art: "leaf_reptilian",
    name: "Reptilian",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 1,
    dmg: 3,
    hits: 1,
    hp: 5, // 3->5 (3+5+7 = 15, exactly a cost-1 budget)
    sp: 7,
    shields: 0,
    keywords: {},
    tribe: "Reptile",
    // Conspiracy (On Kill): +2 DMG, +2 HP (max), +2 SP.
    passiveNames: { onKill: "Conspiracy" },
    onKill: { buffDmg: 2, buffMaxHp: 2, buffSp: 2 },
  },
  {
    // Keeper's swarm. The spec did not print a line for it, so: small, cheap to
    // lose, and only dangerous in numbers — 1 DMG base becomes 4 under Hive
    // Command. Deliberately NOT given FLYING: they exist to be killed in
    // Keeper's place, and melee has to be able to reach them for that to be a
    // real trade rather than a free damage sponge.
    // 2 + 3 + (1x2) + 8 = 15, exactly a cost-1 budget.
    id: "bolt_beebot",
    name: "Beebot",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Assassin",
    attackType: "Ranged",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 3,
    sp: 8,
    shields: 1,
    keywords: {},
    tribe: "Bot",
    // Stinger Buzz: every sting leaves 2 DOT for 2 rounds — BOLT's ONLY DOT, a
    // deliberate exception for Keeper's swarm — and the bee dies at the Cleanup
    // of the round it stings. A one-shot: it lands, it poisons, it's gone.
    passiveNames: { onHitStatus: "Stinger Buzz", diesAfterAttacking: "Stinger Buzz" },
    onHitStatus: { kind: "DOT", duration: 2, power: 2 },
    diesAfterAttacking: true,
  },
  {
    // Raised by Toxic Eruption. Same 3/3/4 frame as Risen; reuses the husk art
    // (there is no separate Zombie plate in the files).
    id: "dusk_zombie_tok",
    art: "dusk_zombie",
    name: "Zombie",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 1,
    dmg: 3,
    hits: 1,
    hp: 3,
    sp: 4,
    shields: 0,
    keywords: {},
    // Zombie, not Dark: Contagion is the ZOMBIE tribe's trait now (in defeatCard),
    // so every Zombie — this token, the Husk, anything raised — bursts on death.
    // No per-card onDeath needed; the tribe carries it.
    tribe: "Zombie",
  },
  {
    // Wake of the Dead's payout. A separate token from Specter (3/1/SP7) because
    // the spec prints this one at 3/3/SP4 — sturdier, slower, and raised from a
    // corpse rather than summoned by a Wraith.
    id: "dusk_risen_tok",
    art: "dusk_specter",
    name: "Risen",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 1,
    dmg: 3,
    hits: 1,
    hp: 3,
    sp: 4,
    shields: 0,
    keywords: {},
    tribe: "Dark",
  },
  {
    id: "dusk_specter_tok",
    art: "dusk_specter",
    name: "Specter",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 1,
    dmg: 3,
    hits: 1,
    hp: 1,
    sp: 7,
    shields: 0,
    keywords: {},
    tribe: "Ghost", // so Last Waltz lifts them
  },
  {
    id: "aqua_guin_tok",
    art: "aqua_guin",
    name: "Guin",
    rarity: "rare",
    element: "AQUA",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 3,
    sp: 5,
    shields: 0,
    keywords: {},
  },
  {
    id: "dawn_warrider_tok",
    // Its own art at last — it was borrowing WarPhant's, which made the rider
    // and the mount it outlives look like the same card.
    art: "dawn_warrider",
    name: "WarRider",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 2,
    dmg: 5,
    hits: 1,
    hp: 7,
    sp: 7,
    shields: 0,
    keywords: {},
  },
  {
    id: "dawn_radiant_guardian",
    name: "Radiant Guardian",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    dmg: 3,
    hits: 1,
    hp: 14,
    sp: 4,
    shields: 3,
    // A sturdy bodyguard summoned by Solara — soaks damage behind BLOCK 1.
    tribe: "Suns",
    keywords: { BLOCK: 1 },
  },
  {
    id: "gale_totem_pole",
    name: "Totem Pole",
    rarity: "legendary",
    element: "GALE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    dmg: 2,
    hits: 1,
    hp: 12,
    sp: 0, // a planted pole — never moves
    shields: 2,
    keywords: {},
    // Totem Wrath (End of Round): crackling energy scorches the row ahead.
    // On summon the pole's first act is to WEAKEN everything it can reach —
    // no damage, just the debuff, which is the point: an SP-0 body that can
    // never reposition needs its arrival to matter where it lands.
    passiveNames: { roundTick: "Totem Wrath", onSummon: "Totem Wrath" },
    roundTick: { rowAheadDmg: 2 },
    onSummon: {
      handler: "statusNova",
      params: { statusKind: "WEAKEN", statusDuration: 2, targets: 99 },
      targetSide: "enemy",
    },
    // Spirit Ward, replacing TOTEM RAMPAGE — a 4-DMG five-target barrage that
    // was the wrong ability twice over. It shared a name with the Totem's own
    // Rampage, so the pair read as one card printed at two sizes; and it was a
    // third attack on a SUPPORT whose damage is already covered by Totem Wrath
    // ticking the row ahead every round plus a WEAKEN nova on arrival.
    //
    // A totem pole is a WARD — a guardian post you plant and then hold ground
    // around. `nearby` is the 8 slots surrounding it, itself included, so what
    // it protects is exactly the ground an SP-0 body that can never move is
    // committed to. It also completes the pair properly: the Totem's aura makes
    // the war band HIT (Totem Spirit, no misses), and its pole makes the war
    // band LAST.
    special: {
      name: "Spirit Ward",
      cost: 3,
      handler: "grantShield",
      params: { amount: 3, nearby: 1, heal: 2 },
      targetSide: "ally",
      text: "Ward the ground it stands on: +3 shields and 2 HP to itself and every ally beside it.",
    },
  },
  {
    id: "dusk_skeleton_tok",
    art: "dusk_skeleton",
    name: "Skeleton",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 2,
    dmg: 3,
    hits: 1,
    hp: 2,
    sp: 6,
    shields: 0,
    keywords: {},
    tribe: "Skeleton",
  },
  {
    id: "dusk_skulldrake_tok",
    art: "dusk_skulldrake",
    // Renamed off "SkullDrake": it shared that name EXACTLY with the draftable
    // Rare dusk_skulldrake, which breaks any lookup, deck list or node roster
    // keyed on name rather than id. The two are different cards — the Rare is a
    // c3 Ranged Ranger with Purple Flames, this is the c4 bruiser SkullKing
    // raises. Borrows the Rare's art, which is why they read as one thing.
    //
    // RANGED, AND STILL A WARRIOR. Only `attackType` moved, which is the field
    // the engine actually reads: reach 2 rather than adjacency, and it stops
    // tripping the `onHitByMelee` defences that fire on being hit in melee.
    // Its CLASS stays Warrior on purpose, because class is not decoration here
    // — Iron Ore halves damage from Rangers and Assassins and Dynomight hits
    // Warriors and Tanks twice as hard, so "Ranger" would quietly rewrite two
    // matchups nobody asked to change. BlackBeard is already a Ranged Warrior,
    // so the pairing is not a one-off. The stat line does not move either:
    // 11 + 10 + 9 = 30 is exactly the cost-4 budget, and attackType is not one
    // of the terms the budget prices.
    name: "Risen Drake",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Warrior",
    attackType: "Ranged",
    cost: 4,
    dmg: 11,
    hits: 1,
    hp: 10,
    sp: 9,
    shields: 0,
    // FLYING, with the Rare whose art it wears — the two read as one creature
    // and only one of them was leaving the ground. Free against the budget
    // (keywords are not priced, and a token is off the curve regardless), and
    // at SP 9 it does not clear SP_MID_MAX, so the king-move is a real grant
    // here rather than something it already had.
    keywords: { FLYING: true },
    tribe: "Skeleton",
  },
  {
    id: "gale_toxhawk_tok",
    art: "gale_toxhawk",
    // Renamed off "ToxHawk": it differed from the draftable Rare "Toxhawk" only
    // in the capital H, which is a collision in every case-insensitive lookup
    // and unreadable in a deck list. Named for the passive that raises it
    // (Masala's Raptor Assault). Borrows Toxhawk's art.
    name: "Raptor",
    rarity: "rare",
    element: "GALE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 2,
    dmg: 3,
    hits: 1,
    hp: 3,
    sp: 13,
    shields: 0,
    keywords: { FLYING: true },
    tribe: "Avian",
    // Toxic Talons: basics leave DOT 1 for 2 rounds.
    passiveNames: { onHitStatus: "Toxic Talons" },
    onHitStatus: { kind: "DOT", duration: 2, power: 1 },
  },
  {
    id: "bolt_police_tok",
    name: "Officer",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Ranger",
    tribe: "ARC",
    attackType: "Ranged",
    cost: 1,
    // 2 + 5 + 1*2 + 6 = 15 = 5*1+10 — on the curve even though nothing buys it.
    dmg: 2,
    hits: 1,
    hp: 5,
    sp: 6,
    shields: 1,
    keywords: {},
    passiveNames: { onHitStatus: "Taser" },
    onHitStatus: { kind: "PARALYZE", duration: 2, power: 0, chance: 50 },
  },
];

export const CARD_INDEX: Record<string, CardDef> = Object.fromEntries(
  [...CARDS, ...TOKENS].map((c) => [c.id, c]),
);

export function getDef(defId: string): CardDef {
  const def = CARD_INDEX[defId];
  if (!def) throw new Error(`Unknown card def: ${defId}`);
  return def;
}

// Attach flavour text. Done here rather than inline on each def so the prose can
// live in data/lore/<element>.ts; CARD_INDEX holds the same object references as
// CARDS and TOKENS, so one pass covers every reader of `def.lore`.
//
// Missing lore is left as undefined rather than defaulted to a placeholder: the
// roster renders "(none yet)" for it, which is how coverage stays visible.
for (const def of [...CARDS, ...TOKENS]) {
  const line = LORE[def.id];
  if (line) def.lore = line;
}

// Element-pair decks. Each card appears once (once-per-game rule). LEAF is
// ≥50% of the leaf_pyro deck, so its Photosynthesis aura is active there.
const deckFor = (...els: string[]): string[] =>
  // `!c.boss`: a Void Tower boss shares an element with 40 real cards, and
  // without this it would quietly enter the element CORES — including the
  // balance harness, where an off-curve 80-stat body would poison every number.
  CARDS.filter((c) => els.includes(c.element) && !c.boss).map((c) => c.id);

export const DECK_P1: string[] = deckFor("LEAF", "PYRO");
export const DECK_P2: string[] = deckFor("BORE", "DUSK");

export interface DeckDef {
  id: string;
  name: string;
  cards: string[];
}

/** Selectable decks for the pre-game picker. */
export const DECKS: DeckDef[] = [
  { id: "leaf_pyro", name: "Leaf / Pyro", cards: DECK_P1 },
  { id: "bore_dusk", name: "Bore / Dusk", cards: DECK_P2 },
  { id: "aqua_dawn", name: "Aqua / Dawn", cards: deckFor("AQUA", "DAWN") },
  { id: "gale_bolt", name: "Gale / Bolt", cards: deckFor("GALE", "BOLT") },
];

export function deckById(id: string): DeckDef {
  return DECKS.find((d) => d.id === id) ?? DECKS[0];
}

// ── Element Cores ────────────────────────────────────────────────────────────
// Eight single-element "cores" (named after each element's Mythic, per
// Element_Cores.docx), built from the currently-implemented cards of that
// element. Players mix any two cores into a pairing deck at the picker. NOTE:
// these are the "thin" cores — the doc's full 14-card lists (incl. the 8
// Mythics) aren't all built yet, so a core is however many of its element's
// cards exist today.

export interface CoreDef {
  id: string; // element key: leaf | pyro | aqua | dawn | gale | bolt | dusk | bore
  name: string; // Mythic / core name
  element: Element;
  cards: string[];
}

export const CORES: CoreDef[] = [
  { id: "leaf", name: "Trinezer", element: "LEAF", cards: deckFor("LEAF") },
  { id: "pyro", name: "Pyrogon", element: "PYRO", cards: deckFor("PYRO") },
  { id: "aqua", name: "Kraken", element: "AQUA", cards: deckFor("AQUA") },
  { id: "dawn", name: "Imperator", element: "DAWN", cards: deckFor("DAWN") },
  { id: "gale", name: "Skyrend", element: "GALE", cards: deckFor("GALE") },
  { id: "bolt", name: "Elecdroid", element: "BOLT", cards: deckFor("BOLT") },
  { id: "dusk", name: "Shadow Horsemen", element: "DUSK", cards: deckFor("DUSK") },
  { id: "bore", name: "The Deepest", element: "BORE", cards: deckFor("BORE") },
];

export function coreById(id: string): CoreDef {
  return CORES.find((c) => c.id === id) ?? CORES[0];
}

/** Combine two cores into a pairing deck (deduped — same core twice = mono). */
export function pairingCards(coreA: string, coreB: string): string[] {
  return [...new Set([...coreById(coreA).cards, ...coreById(coreB).cards])];
}

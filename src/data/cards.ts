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

import type { CardDef, Element } from "../engine/types";

export const CARDS: CardDef[] = [
  // ───────────────────────── LEAF ─────────────────────────
  {
    id: "leaf_sumerose",
    name: "Sumerose",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 5,
    dmg: 8,
    hits: 1,
    hp: 16,
    sp: 9,
    shields: 2,
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
    dmg: 2,
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
    dmg: 5,
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
    dmg: 4,
    hits: 1,
    hp: 15,
    sp: 6,
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
    cost: 3,
    dmg: 1, // "4×1 DMG" = 4 hits × 1 dmg
    hits: 4,
    hp: 14,
    sp: 7,
    shields: 0,
    keywords: {},
    // Gnashing Bite: LIFESTEAL only on attacks against ROOTed opponents.
    passiveNames: { vsStatus: "Gnashing Bite" },
    vsStatus: { status: "ROOT", lifesteal: true },
    // Back to Epic: Takedown is a repeatable Special again (rarity rule — a
    // repeatable Special needs epic+), not the one-shot Talent of its Rare form.
    special: {
      name: "Takedown",
      cost: 3,
      handler: "strike",
      params: { dmg: 6, statusKind: "ROOT", statusDuration: 3 },
      targetSide: "enemy",
      text: "Tackle an opponent for 6 DMG and ROOT them for 3 rounds.",
    },
  },
  {
    id: "leaf_fallona",
    name: "Fallona",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 3,
    dmg: 1, // "5×1 DMG" = 5 hits × 1 dmg
    hits: 5,
    hp: 13,
    sp: 7,
    shields: 0,
    keywords: {},
    // Fall's Emergence: +1 DMG at the end of every 3rd round (stacking). The
    // bonus applies to her basic attack AND to Leaf Storm (scaleDmg).
    roundTick: { buffDmgEveryN: { n: 3, amount: 1 } },
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
    dmg: 5,
    hits: 1,
    hp: 26,
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
      // "6 DMG to one opponent AND ROOT all opponents adjacent to Squanch 2r"
      params: { dmg: 6, adjStatusKind: "ROOT", adjStatusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 6 DMG and ROOT every opponent adjacent to Squanch for 2 rounds.",
    },
  },
  {
    id: "leaf_leaf",
    name: "Leaf",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 2,
    dmg: 3, // "2×3 DMG" = 2 hits × 3 dmg
    hits: 2,
    hp: 5,
    sp: 9,
    shields: 0,
    keywords: {},
    onHitStatus: { kind: "BLEED", duration: 1, power: 1 }, // Magic Razor Leaf
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
    hp: 6,
    sp: 6,
    shields: 0,
    keywords: {},
    onHitStatus: { kind: "BLEED", duration: 1, power: 1 }, // Stinging Barbs
    // Bloodletting: Nettle chips BLEED itself, and once a PYRO ally has set the
    // target burning too, each of its three little hits leeches life and bites
    // harder off the bloodfire. Cheap, sticky sustain for the aggro core.
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
    dmg: 7,
    hits: 1,
    hp: 18,
    sp: 9,
    shields: 3,
    keywords: {},
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
    dmg: 3,
    hits: 2,
    hp: 19,
    sp: 11,
    shields: 2,
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
    cost: 3,
    dmg: 6,
    hits: 1,
    hp: 8,
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
      params: { dmg: 8, selfDamage: 3, statusKind: "BURN", statusPower: 2, statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 8 DMG and apply BURN 2 for 2 rounds. FireBird loses 3 HP.",
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
    // Sweeping Flames (End of Round): 1 DMG to opponents in the row ahead.
    roundTick: { rowAheadDmg: 1 },
    special: {
      name: "Axe Spin",
      cost: 3,
      handler: "statusNova",
      params: { statusKind: "BURN", statusPower: 1, statusDuration: 2, targets: 99 },
      targetSide: "enemy",
      ranged: true, // "all opponents" — reaches the whole board
      text: "Apply BURN 1 for 2 rounds to every opponent in range.",
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
    special: {
      name: "Bluflame Slashing",
      cost: 3,
      handler: "statusNova",
      // Bluflame mark = SEAL (can't be healed) for the BURN's duration. Targets
      // the row directly ahead (spread 1, one row deep). statusNova is required —
      // it's the only handler that honors sealRounds.
      params: { statusKind: "BURN", statusPower: 3, statusDuration: 2, spread: 1, forwardDepth: 1, targets: 99, sealRounds: 2 },
      targetSide: "enemy",
      text: "Apply BURN 3 for 2 rounds to opponents in the row directly ahead, and Bluflame them (cannot be healed).",
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
    // Fire Blast: on summon, blast the 3-wide corridor ahead (left/mid/right
    // columns), reaching forward across the battlefield (ranged).
    // targets 99 -> 2. The corridor was UNCAPPED, so this cost-2 card put 12 damage
    // on the board on arrival while cost-3 Spitfire — capped at 3 targets —
    // managed 9: the cheaper card was strictly better at the one thing they both
    // do. Two targets is 6, the same 3-per-cost as Spitfire. The 3-wide corridor
    // SHAPE is untouched.
    onSummon: { handler: "barrage", params: { dmg: 3, spread: 1, targets: 2 } },
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
    attackType: "Melee",
    cost: 6, // LEGENDARY
    dmg: 13,
    hits: 1,
    hp: 19,
    sp: 8,
    shields: 0,
    keywords: { FLYING: true },
    // Bad Temper (passive): a landed basic attack grows Volcanon permanently.
    passiveNames: { onHitSelfBuff: "Bad Temper" },
    onHitSelfBuff: { dmg: 1 },
    special: {
      name: "Eruption",
      cost: 3,
      handler: "strike",
      // printed "5×2 DMG" = 5 hits of 2 — a shield shredder (strips up to 5).
      // selfDamage 1 = "loses 1 HP per use"; selfDmg 1 = Bad Temper's "+1 DMG
      // permanently after each Eruption"; freeRecastOnKill = "On Kill, use
      // Eruption again next round at no cost."
      params: { dmg: 2, hits: 5, selfDamage: 1, selfDmg: 1, freeRecastOnKill: 1 },
      targetSide: "enemy",
      text: "Deal 2 DMG × 5 hits to one opponent (shreds shields). Costs 1 HP; +1 DMG per use; On Kill, recast free next round.",
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
  },
  {
    id: "bore_sandman",
    name: "Sandman",
    rarity: "legendary",
    element: "BORE",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 6,
    dmg: 2, // "5×2 DMG"
    hits: 5,
    hp: 14,
    sp: 9,
    shields: 1,
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
    // Reforged (On Summon): plate every NEARBY ally (the 8 surrounding slots,
    // itself included) with +2 shields, and stoke them for +1 DMG this round.
    onSummon: {
      handler: "grantShield",
      params: { amount: 2, nearby: 1, buffDmg: 1, buffRounds: 1 },
      targetSide: "ally",
    },
  },

  {
    id: "bore_rhe",
    name: "Rhe",
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
    // Cave Guard (On Opp enter battlefield): deal 4 DMG to a newcomer summoned
    // within Rock Goblin's (melee) range — gated by canTarget in the SUMMON reducer.
    passiveNames: { onOppSummon: "Cave Guard" },
    onOppSummon: { dmg: 4 },
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
    // Hillside (On Hit, first time): +1 shield to allies in the row directly ahead.
    passiveNames: { onHitAllyBuff: "Hillside" },
    onHitAllyBuff: { shields: 1, firstTimeOnly: true },
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
    keywords: {},
    passiveNames: { statusImmune: "Hibernation" },
    statusImmune: true, // Hibernation: immune to status effects
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
    cost: 3,
    dmg: 3,
    hits: 2,
    hp: 7,
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
    cost: 3,
    dmg: 7,
    hits: 1,
    hp: 11,
    sp: 7,
    shields: 0,
    keywords: {},
    tribe: "Spider",
    // Lingering Venom (On Death): was a 10 PEN slap at the killer. It is now a
    // venom — no impact damage at all, the killer just walks away carrying 5
    // DOT for 3 rounds (15 total, if it lives that long). inRangeOnly: a melee
    // grudge only reaches a killer that came within a slot of it, so a ranged
    // pick-off is now clean. NOTE a card-specific onDeath REPLACES DUSK's
    // Midnight Shade retaliation, so it trades that instant 3 for the venom.
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
  },
  {
    id: "dusk_gool",
    name: "Gool",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 13,
    sp: 8,
    shields: 0,
    keywords: {},
    tribe: "Ghost",
    // Spook (On Hit, first time only): FRIGHTEN the opponent.
    passiveNames: { onHitStatus: "Spook" },
    onHitStatus: { kind: "FRIGHTEN", duration: 1, power: 0, firstHitOnly: true },
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
      params: { dmg: 5, targets: 2, pen: 1 },
      targetSide: "enemy",
      text: "Deal 5 DMG (PEN) to up to 2 opponents in range.",
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
    // Frightening (On Hit, first time only): FRIGHTEN the target for 1 round.
    passiveNames: { onHitStatus: "Frightening" },
    onHitStatus: { kind: "FRIGHTEN", duration: 1, power: 0, firstHitOnly: true },
    special: {
      name: "Jacked",
      cost: 2,
      handler: "drainMax",
      params: { amount: 5, selfShields: 3 },
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
    name: "Darth",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 5,
    dmg: 6,
    hits: 1,
    hp: 17,
    sp: 10,
    shields: 1,
    // Shadow Step: STEALTH until first attack each round — exactly the
    // alpha STEALTH keyword.
    keywords: { CRIT: true, STEALTH: true },
    // Predator's Snare (On Kill): lay a trap on the slot the prey fell on. The
    // next opponent to walk onto it eats the SAME payload as Dark Hunting —
    // 7 DMG, ROOT 2, and LIFESTEAL to Darth.
    passiveNames: { onKill: "Predator's Snare" },
    onKill: { setTrap: { dmg: 7, rootDuration: 2, lifesteal: 1 } },
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
    passiveNames: { onDeath: "Bird Bomb" },
    onDeath: { dmg: 5, inRangeOnly: true },
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
    dmg: 5,
    hits: 1,
    hp: 26,
    sp: 10,
    shields: 2,
    keywords: {},
    // Mounted until Dismount: below 10 HP it loses the mount, and with it the
    // king-move — `transformed` gates that, so a dismounted rider walks.
    mounted: true,
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
    // Venom Spines: basic attacks apply SCALD 2 for 2 rounds (non-stacking).
    passiveNames: { onHitStatus: "Venom Spines" },
    onHitStatus: { kind: "SCALD", duration: 2, power: 2 },
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
    keywords: {},
    tribe: "Ice",
    // Polar Storm (On Summon): give allies in the row directly ahead +1 shield.
    // (Simplified from the canon 3-round ally buff + AoE — owner's call: shields only.)
    onSummon: { handler: "grantShield", params: { amount: 1 }, targetSide: "ally" },
    special: {
      name: "Ice Crash Claw",
      cost: 2,
      handler: "strike",
      params: { dmg: 3, hits: 2, statusKind: "FREEZE", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 3 DMG × 2 and FREEZE the target for 2 rounds.",
    },
  },
  {
    id: "aqua_owlette",
    name: "Owlette",
    rarity: "epic",
    element: "AQUA",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 12,
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
    tribe: "SeaC",
    // King of the Seas (On Kill): coin flip — gain +2 or +1 DMG permanently.
    // Scalding Shot: the cannon's basic sears whatever it hits (SCALD 1).
    passiveNames: { onKill: "King of the Seas", onHitStatus: "Scalding Shot" },
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
    roundTick: { selfShields: 1 },
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
    attackType: "Melee",
    cost: 1,
    dmg: 3,
    hits: 1,
    hp: 2,
    sp: 10,
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
    attackType: "Melee",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 18,
    sp: 2,
    shields: 0,
    // Thick Hide: −1 DMG from every incoming attack (flat, applies pre-shield
    // and even to PEN) — that's exactly what BLOCK does.
    keywords: { BLOCK: 1 },
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
    attackType: "Ranged",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 10,
    sp: 7,
    shields: 2,
    keywords: { FLYING: true },
    // First Responder (End of Round): heal the lowest-HP ally +4 HP. (Doc also
    // lets basic attacks target allies to heal — not modeled yet.)
    roundTick: { healLowestAlly: 4 },
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
    name: "Dawn",
    rarity: "legendary",
    element: "DAWN",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 8, // LEGENDARY
    dmg: 3,
    hits: 3,
    hp: 19,
    sp: 12,
    shields: 5,
    keywords: { FLYING: true },
    // War Maiden (End of Round): heal all allies +3 HP.
    roundTick: { healAllies: 3 },
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
    attackType: "Melee",
    cost: 3,
    dmg: 5,
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
    name: "Clipsey",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Ranger",
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
    // Omega Restore (On Kill): heal +4 HP per opponent killed.
    passiveNames: { onKill: "Omega Restore" },
    onKill: { healSelf: 4 },
  },
  {
    id: "gale_hawk",
    name: "Hawk",
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
    keywords: {},
    // High Speed Impact: +1 DMG per SP point above 10.
    passiveNames: { highSpeedImpact: "High Speed Impact" },
    highSpeedImpact: true,
    // Glide Rush (Talent, free · once per game): +3 SP and EVASION, both for 2
    // rounds. The SP is TEMPORARY (buffRounds) — it feeds High Speed Impact
    // above, so for those two rounds a 7 SP Hawk is at 10 and every further
    // point of SP it can find turns straight into damage.
    talent: {
      name: "Glide Rush",
      text: "Gain +3 SP and EVASION for 2 rounds.",
      handler: "empower",
      params: { selfSp: 3, buffRounds: 2, selfStatus: "EVASION", selfStatusDuration: 2 },
    },
  },
  {
    id: "gale_vaga",
    name: "Vaga",
    rarity: "epic",
    element: "GALE",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 8,
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
    name: "Buf",
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
    keywords: { BLOCK: 1, REGEN: 1 },
    tribe: "Avian",
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
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 12,
    sp: 9,
    shields: 0,
    keywords: { FLYING: true },
    tribe: "Avian",
    // Alluring Aura (On Hit by Melee): the attacker is WEAKENed.
    passiveNames: { onHitByMelee: "Alluring Aura" },
    onHitByMelee: { status: { kind: "WEAKEN", duration: 2, power: 0 } },
    special: {
      name: "Purple Wind Surge",
      cost: 2,
      handler: "barrage",
      // "4×1 DMG to the row ahead + WEAKEN + −2 SP each"
      params: { dmg: 1, hits: 4, targets: 3, statusKind: "WEAKEN", statusDuration: 2, spDebuff: 2, spDebuffRounds: 2 },
      targetSide: "enemy",
      text: "Deal 1 DMG × 4, WEAKEN, and −2 SP to up to 3 opponents for 2 rounds.",
    },
  },
  {
    id: "gale_guan",
    name: "Guan",
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
      params: { dmg: 5, targets: 99, spDebuff: 2, spDebuffRounds: 1 },
      targetSide: "enemy",
      ranged: true, // "5 DMG to all opponents" — reaches the whole board
      text: "Deal 5 DMG to every opponent and −2 SP for the round.",
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
    cost: 7, // LEGENDARY
    dmg: 4,
    hits: 2,
    hp: 27,
    sp: 6,
    shields: 2,
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
    cost: 7, // LEGENDARY
    dmg: 9,
    hits: 1,
    hp: 19,
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
    dmg: 5,
    hits: 1,
    hp: 2,
    sp: 10,
    shields: 0,
    keywords: {},
    // Stuck (On Summon): 5 DMG to one opponent in range.
    onSummon: { handler: "barrage", params: { dmg: 5, targets: 1 } },
  },
  {
    id: "bolt_twotales",
    name: "TwoTales",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hits: 2,
    hp: 6,
    sp: 5,
    shields: 0,
    keywords: {},
    // Buzz Whip: basic attacks have a 50% chance to PARALYZE for the round.
    passiveNames: { onHitStatus: "Buzz Whip" },
    onHitStatus: { kind: "PARALYZE", duration: 2, power: 0, chance: 50 },
  },
  {
    id: "bolt_zagphu",
    name: "Zagphu",
    rarity: "epic",
    element: "BOLT",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 12,
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
    hp: 14,
    sp: 7,
    shields: 0,
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
    hp: 8,
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
    cost: 3,
    dmg: 3,
    hits: 2,
    hp: 11,
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
      // cut as Sprinu: the board-wide PARALYZE is the identity, so the reach and
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
    // On Summon: strike the closest opponent for 4 CRIT.
    onSummon: { handler: "barrage", params: { dmg: 4, spread: 0, crit: 1, targets: 1 } },
    special: {
      name: "Claw Surge",
      cost: 2,
      handler: "strike",
      // printed "Move up to 2 and deal 8 to an opponent in range" — ranged reach
      // (the move) + charge advance afterward
      params: { dmg: 8, charge: 2, chargeFirst: 1 },
      ranged: true,
      targetSide: "enemy",
      text: "Charge up to 2 slots and deal 8 DMG to one opponent.",
    },
  },
  {
    id: "bolt_voltogon",
    name: "Voltogon",
    tribe: "Dragon",
    rarity: "legendary",
    element: "BOLT",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 8, // LEGENDARY
    dmg: 7,
    hits: 1,
    hp: 29,
    sp: 10,
    shields: 2,
    keywords: {},
    // Powertrip (On Kill, once per round): 5 DMG to all ELECTRIFIED opponents
    // (= any statused enemy, the BOLT "electrified" proxy).
    passiveNames: { onKill: "Powertrip" },
    onKill: { aoeDmgElectrified: 5 },
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
    passiveNames: { startsWithFreeSpecial: "Elemental Fury", onDeath: "Elemental Fury" },
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
      text: "Enchant your weapon — Freezing (−5 SP), Burning (2 DOT), Sleeping (SLEEP 1), or Sharpen (+5 DMG) — then strike at once if an opponent is in range, otherwise store the charge for your next basic.",
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
    dmg: 11,
    hits: 1,
    hp: 17,
    sp: 10,
    shields: 1,
    keywords: {},
    // Hive Command: the swarm is only a threat because of this. A 1 DMG Beebot
    // stings for 4 while Keeper lives, and drops back to 1 the moment it dies.
    aura: { scope: "tribe", match: "Bot", dmg: 3 },
    // Hive Mind: half of everything aimed at a 17 HP body goes into the swarm
    // instead — but only as far as the swarm's own HP will stretch.
    passiveNames: { hiveAbsorb: "Hive Mind", summonSpawn: "Hive Mind", roundTick: "Hive Command" },
    hiveAbsorb: { tribe: "Bot", pct: 50 },
    summonSpawn: { token: "bolt_beebot", count: 2 },
    // Hive Command also breeds: one fresh Beebot at the end of every round,
    // replacing the ones that spent themselves stinging. Capped so the swarm
    // holds at a size the opponent can fight through rather than eating the board.
    roundTick: { spawn: { token: "bolt_beebot", count: 1 }, spawnMaxAlive: 4 },
    special: {
      name: "Storm Swarm",
      cost: 3,
      handler: "stormSwarm",
      params: { token: "bolt_beebot" },
      targetSide: "enemy",
      text: "Raise one Beebot per ELECTRIFIED opponent, then every Beebot on the board stings.",
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
    passiveNames: { roundTick: "Scorched Fury", furyBelowHp: "Scorched Fury" },
    furyBelowHp: { hp: 10, dmg: 2 },
    roundTick: {
      selfBurnForDmg: { hp: 1, dmg: 2 },
      // ...and the Meltdown channel, which only runs once the Special lights it.
      channel: { hpCost: 2, rowAheadDmg: 5 },
    },
    // Trial by Fire: the whole PYRO line pays a point of blood for a round of
    // fire the moment Magmadon lands.
    onSummon: {
      handler: "empowerElement",
      targetSide: "ally",
      params: { amount: 2, hpCost: 1, rounds: 1 },
    },
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
      text: "Deal 5 DMG to the row directly ahead, then keep erupting every round for 2 HP a round — until Magmadon dies, or is FROZEN or ROOTED.",
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
    cost: 6,
    dmg: 6,
    hits: 1,
    hp: 31,
    sp: 3,
    shields: 0,
    keywords: {},
    // Contagion (Aura): while Zombination lives, every one of its Zombies that
    // dies sprays 2 DMG to opponents beside it. Strictly Zombination's effect —
    // it ends the instant Zombination is gone.
    passiveNames: { contagionAura: "Contagion" },
    contagionAura: true,
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
    // 7 + 14 + (3x2) + 3 = 30, exactly a cost-4 budget.
    id: "dawn_drakonbane",
    name: "Drakonbane",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 5,
    dmg: 9,
    hits: 1,
    hp: 15,
    sp: 5,
    shields: 3,
    keywords: {},
    // Dragon's Bane: +2 on BASICS against a Dragon or anything still above 25
    // HP (current, not max — see vsTarget). Specials carry their own printed
    // number, exactly as vsStatus works, so Sunlight Strike is 14/10 flat.
    passiveNames: { vsTarget: "Dragon's Bane" },
    vsTarget: { tribe: "Dragon", hpAbove: 25, bonusDmg: 2 },
    // ...and if it lands next to such a target, it opens on it immediately.
    // onlyVsTarget gates the shot: no bane-worthy enemy in range, no ambush.
    onSummon: {
      handler: "strike",
      params: { dmg: 7, onlyVsTarget: 1 },
    },
    special: {
      name: "Sunlight Strike",
      cost: 2,
      handler: "strike",
      params: { dmg: 10, dmgVsTarget: 14, onKillSelfShields: 2 },
      targetSide: "enemy",
      text: "Deal 14 DMG to a Dragon (or anything above 25 HP), 10 DMG otherwise. On Kill: gain 2 shield.",
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
    keywords: {},
    tribe: "Avian",
    // Gustarrows (On Opp Summon): a reaction shot at anything that arrives in
    // range. Can CRIT, so an unshielded newcomer sometimes eats 4.
    passiveNames: { onOppSummon: "Gustarrows" },
    onOppSummon: { dmg: 2, crit: true },
    special: {
      name: "Twin Wind Strikes",
      cost: 4,
      // barrage, not strike: TWO 7-DMG strikes the caster assigns — one each to
      // two foes, or both onto one. Each strike carries -5 SP + WEAKEN, applied
      // PER strike (barrage runs maybeStatus + applyDebuffRiders every target
      // slot). Double-tapping one target is now the FOCUS play the card asks
      // for: 14 DMG and a stacked -10 SP, at the cost of hitting only one.
      handler: "barrage",
      params: { dmg: 7, hits: 1, targets: 2, statusKind: "WEAKEN", statusDuration: 2, spDebuff: 5, spDebuffRounds: 2 },
      targetSide: "enemy",
      text: "Two 7-DMG strikes — split across two opponents, or both onto one. Each saps 5 SP and WEAKENs for 2 rounds, so a double hit stacks to 14 DMG and −10 SP.",
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
    dmg: 6,
    hits: 1,
    hp: 55,
    sp: 0, // rooted — moveReach(0) is 0. Uprooted is the only way it ever moves.
    shields: 0,
    keywords: {},
    // Intimidation (Aura): anything weaker than Oakgre flinches. Gated on a LIVE
    // comparison, so as Uprooted grows its DMG the aura catches more of the
    // board — and a card that out-grows Oakgre walks out from under it.
    passiveNames: { intimidate: "Intimidation" },
    intimidate: { dmg: 1, rows: 1 },
    special: {
      name: "Uprooted",
      cost: 5,
      handler: "empower",
      // No buffRounds, so both grants are PERMANENT and stack across casts.
      // The +3 SP is what unpins it: 0 -> 3 clears moveReach's zero and puts it
      // in the slow tier (1 space). selfHpCost is refused when lethal — it does
      // not opt into selfHpLethal, so Oakgre can never tear itself apart.
      params: { selfHpCost: 9, selfDmg: 2, selfSp: 3 },
      targetSide: "self",
      text: "Lose 9 HP. Permanently gain +2 DMG and +3 SP (it can move for the rest of the game).",
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
    dmg: 11,
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
    keywords: {},
    // On Summon: a free Flame Engulf — same reach as the Special (2 rows deep).
    onSummon: {
      handler: "barrage",
      params: { dmg: 7, spread: 1, forwardDepth: 2, targets: 99, statusKind: "BURN", statusDuration: 3, statusPower: 3 },
    },
    // On Kill: permanent +7 HP and +1 DMG.
    onKill: { buffMaxHp: 7, buffDmg: 1 },
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
      params: { dmg: 8, targets: 99, statusKind: "BLIND", statusDuration: 2, selfDamage: 5 },
      targetSide: "enemy",
      text: "Lose 5 HP. Deal 8 DMG to all opponents and BLIND them 2 rounds (water in their eyes). 3-round cooldown.",
    },
  },
  {
    id: "dawn_imperator",
    name: "Imperator",
    rarity: "mythic",
    element: "DAWN",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 10,
    dmg: 10,
    hits: 1,
    hp: 26, // Element_Cores' corrected value (the printed 65-total 21-HP was a checksum error)
    sp: 4,
    shields: 10,
    keywords: {},
    // Triple Sun — Crowned: CLEANSE all allies each round (strip negatives).
    // (Order's shield-on-ally-summon and Chaos/Awakening remain deferred — the
    //  "Awakening" bonus-attack mechanic is undefined elsewhere in the docs.)
    roundTick: { cleanseAllies: true },
    special: {
      name: "Strike of Dawn",
      cost: 5,
      cooldown: 3, // spawns a 10/10 Heir — 3-round lockout between casts
      handler: "spawn",
      params: { token: "dawn_heir_tok", count: 1, commandAllies: 1 },
      targetSide: "self",
      text: "Spawn Heir (10/10/2🛡/SP10), then command the charge — every ally immediately fires a basic attack. Crowned: cleanses allies each round. 3-round cooldown.",
    },
  },
  {
    id: "gale_griffith",
    name: "Griffith",
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
    // Aura: GALE allies gain +1 SP.
    aura: { scope: "element", sp: 1 },
    special: {
      name: "Dive Bomb",
      cost: 5,
      cooldown: 3, // huge nuke + STEALTH escape — 3-round lockout between casts
      handler: "strike",
      // recoilPct is a share of the HP damage DEALT to the main target, so the
      // cost scales with how well the dive lands: ~6 back on a clean 24, less
      // into shields. At 25% it can finish a wounded Griffith outright.
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
        charge: 3, chargeLateral: 1, chargeFirst: 1,
      },
      targetSide: "enemy",
      text: "Dive up to 3 spaces in any direction onto your target, deal 24 DMG (+5 splash) and WEAKEN it for 2 rounds, taking 25% recoil, then vanish into STEALTH until next round. 3-round cooldown.",
    },
  },
  {
    id: "bolt_elecdroid",
    name: "Elecdroid",
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
    // Hyper Power Surge (On Kill): +5 DMG this round, +5 SP (round-long, applies
    // to future basics — separate from the combo's in-special escalation).
    passiveNames: { onKill: "Hyper Power Surge" },
    onKill: { buffDmgRound: 5, buffSp: 5 },
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
    name: "The DEEPEST",
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
    passiveNames: { targetsOnSound: "Echolocation" },
    targetsOnSound: true,
    // NO innate STEALTH. Abyssal Emergence is something it DOES, not something
    // it arrives with: the keyword cloaked it from the moment it was summoned,
    // so a cost-10 body sat untargetable before doing anything to earn it. The
    // Special's `selfStatus: STEALTH` is now the only source — it surfaces,
    // quakes, and slips back under.
    keywords: {},
    tribe: "Cavernous",
    // Pressure: BORE allies are topped up to +1 shield each round.
    aura: { scope: "element", shields: 1 },
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
      text: "Tear off 5 HP to sinkhole all opponents in range — DOT 3, −5 SP, −50% accuracy for 3 rounds — then slip into STEALTH. 3-round cooldown.",
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
    dmg: 3, // 2->3
    hits: 1,
    hp: 12,
    sp: 6,
    shields: 0,
    keywords: {},
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
    dmg: 1,
    hits: 3,
    hp: 4,
    sp: 8,
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
    cost: 4,
    dmg: 3,
    hits: 2, // "2×3 DMG, PEN"
    hp: 14,
    sp: 8,
    shields: 1,
    keywords: { PEN: true },
    // Acidic Leaf Blaze: basic attacks apply BLEED 2 for 1 round (non-stacking).
    passiveNames: { onHitStatus: "Acidic Leaf Blaze" },
    onHitStatus: { kind: "BLEED", duration: 1, power: 2 },
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
    dmg: 4,
    hits: 1,
    hp: 13,
    sp: 6,
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
    tribe: ["SeaC", "Liquid"],
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
      text: "Deal 4 DMG to all opponents in the row directly ahead.",
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
    onSummon: { handler: "barrage", params: { dmg: 0, targets: 1, statusKind: "SCALD", statusPower: 3, statusDuration: 2, debuffStatus: "FREEZE", debuffStatusRounds: 2 } },
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
    onHitSelfBuff: { dmg: 1 },
    weakBelowHp: { hp: 12, dmgMult: 0.5 },
    special: {
      name: "Double Trouble",
      cost: 2,
      handler: "strike",
      params: { dmg: 2, hits: 2, healSelf: 6 },
      targetSide: "enemy",
      text: "Deal 2×2 DMG to an opponent and gain +6 HP.",
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
    cost: 1,
    dmg: 0,
    hits: 1,
    hp: 15,
    sp: 0,
    shields: 0,
    keywords: {},
    // Black Smoke (End of Round): 1 DMG to every opponent in range (Ranged → the whole enemy board).
    roundTick: { inRangeDmg: 1 },
    // Creeping Cloud: +1 SP per kill. It prints SP 0 — a cloud that cannot move
    // at all — and the only thing that can kill for it is Black Smoke, so every
    // point of speed is earned by choking something out. (Tick kills feed onKill
    // via tickDamage; the ordinary death path only counts basic/special kills,
    // which a 0-DMG card can never land.)
    passiveNames: { onKill: "Creeping Cloud" },
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
    cost: 3,
    dmg: 2,
    hits: 3, // "3×2 DMG"
    hp: 8,
    sp: 9,
    shields: 1,
    keywords: {},
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
    cost: 2,
    dmg: 5,
    hits: 1,
    hp: 8,
    sp: 3, // juggernaut — slowed from 6 (2-space -> 1-space); the 3 SP went to HP, so the slowness is the whole cost
    shields: 2,
    keywords: {},
    // Tusk Rush (On Summon): it rolls one slot forward (Seed Roll's mechanic),
    // THEN gores — 5 DMG to opponents directly ahead of where it ends up. The
    // charge finally moves it, not just the tusks.
    // (The "keep charging on each kill" follow-up is unmodeled.)
    // targets 99 -> 2, the same uncapped-corridor problem Flamehound had: 15
    // damage on arrival off a cost-2 body, by some way the most of any rare.
    // Kept at 5 per target rather than cut to Flamehound's 3, because this
    // corridor only reaches ONE row ahead — Warthog has to be in contact to
    // connect at all, where Flamehound's shot carries down the board.
    passiveNames: { summonAdvance: "Tusk Rush" },
    summonAdvance: 1,
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
      text: "Once per game, free: deal 2 DMG to all opponents and drop their SP by 3 for the round.",
      handler: "barrage",
      params: { dmg: 2, targets: 99, spDebuff: 3, spDebuffRounds: 1 },
    },
  },
  {
    id: "gale_hawko",
    name: "Hawko",
    rarity: "rare",
    element: "GALE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 3,
    hits: 2, // "2x3 DMG" = 2 hits of 3
    // Rebuilt as a glass-cannon harasser: HP 11 -> 5, SP 8 -> 14. Same 25-point
    // budget for cost 3, just poured into speed. FLYING already keeps melee off
    // it, so 5 HP only matters to ranged answers.
    hp: 5,
    sp: 14,
    shields: 0,
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
      // card in the game, ahead of every legendary and mythic (Griffith is 7.8).
      // Griffith's own splash is 5 on a 24 hit; an arc should be a graze, not a
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
    cost: 1,
    dmg: 1,
    hits: 4, // "4×1 DMG"
    hp: 3,
    sp: 8,
    shields: 0,
    keywords: {},
    // Wrap (On Summon): PARALYZE an opponent in range for 2 rounds.
    onSummon: { handler: "barrage", params: { dmg: 0, targets: 1, statusKind: "PARALYZE", statusDuration: 2 } },
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
      params: { dmg: 7, pen: 1 },
      targetSide: "enemy",
      text: "Hurl the scythe — 7 DMG (PEN) to any opponent, anywhere.",
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
    keywords: {},
    tribe: ["Dragon", "Skeleton"],
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
    attackType: "Melee",
    cost: 4, // doc prints cost 5; re-costed to fit the curve
    dmg: 5,
    hits: 1,
    hp: 17,
    sp: 4,
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
    cardClass: "Mage",
    attackType: "Ranged",
    // Cost 2 at 4+7+9 = 20, exactly 5*2+10. The printed 0 shields is what the
    // formula reads; the +2 barrier below is an off-curve on-summon grant.
    cost: 2,
    // One heavy shot instead of 2x2. Same 4 raw, but it lands very differently:
    // BLOCK is subtracted PER HIT, so BLOCK 2 used to zero the whole volley and
    // now only halves it. It also raises the DAWN Awakening on-summon strike
    // (floor(dmg/2)) from 1 to 2, since that reads printed DMG, not dmg x hits.
    dmg: 4,
    hits: 1,
    hp: 7,
    sp: 9,
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
      params: { dmg: 8, statusKind: "BURN", statusPower: 2, statusDuration: 2, statusSplash: 1 },
      targetSide: "enemy",
      text: "Deal 8 DMG and apply BURN 2 (2r) to the target and its neighbors.",
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
    // Smokin' Dogs (End of Round): +1 DMG every round (doc caps at +5 — uncapped here).
    roundTick: { buffDmgEveryN: { n: 1, amount: 1 } },
  },
  {
    id: "bore_rollo",
    name: "Rollo",
    rarity: "epic",
    element: "BORE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 16,
    sp: 3, // juggernaut — slowed from 6 (2-space -> 1-space); the 3 SP went to HP, so the slowness is the whole cost
    shields: 1,
    keywords: {},
    special: {
      name: "Rolling Bash",
      cost: 2,
      handler: "strike",
      // Rover, modeled at last: ranged targeting picks an opponent anywhere in
      // range, then Rollo ROLLS UP TO 2 SLOTS INTO THEM and bashes — chargeFirst
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
      // some way (Lytning 10, Fallona 6) — and like most epics it was running on
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
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 4,
    dmg: 2,
    hits: 2,
    hp: 16,
    sp: 10,
    shields: 0,
    // Both blades of the 2×2 roll for a crit.
    keywords: { CRIT: true },
    // (Wind Warp — its basic attacks reach any row like a Ranged card — unmodeled.)
    special: {
      name: "Ambush",
      cost: 2,
      handler: "barrage",
      ranged: true, // strikes the far row
      params: { dmg: 5, pen: 1, targets: 2 },
      targetSide: "enemy",
      text: "Deal 5 DMG (PEN) to 2 opponents anywhere on the board.",
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
    passiveNames: { selfShields: "Living Reactor" },
    roundTick: { selfShields: 1 },
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
    dmg: 4,
    hits: 1,
    hp: 20,
    sp: 6,
    shields: 5,
    keywords: {},
    // Basic attacks entangle: ROOT the target (SP→0, can't move) for a round.
    passiveNames: { onHitStatus: "Basic attacks entangle" },
    onHitStatus: { kind: "ROOT", duration: 1, power: 0 },
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
    cost: 7,
    dmg: 3,
    hits: 2,
    hp: 25,
    sp: 8,
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
    name: "Aurelion",
    rarity: "legendary",
    element: "DAWN",
    cardClass: "Support",
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
    // High Speed Impact: +1 DMG per point of SP above 10 (GALE's +1 SP/round
    // climbs this over time).
    passiveNames: { highSpeedImpact: "High Speed Impact" },
    highSpeedImpact: true,
    special: {
      name: "Cyclone Strike",
      cost: 3,
      handler: "strike",
      // ranged + chargeFirst together, exactly as on Rollo: Tempest is MELEE, so
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
      cost: 4,
      handler: "statusNova",
      params: { statusKind: "PARALYZE", statusDuration: 2, targets: 3 },
      targetSide: "enemy",
      text: "PARALYZE up to 3 opponents for 2 rounds.",
    },
  },
  {
    id: "dusk_nightfang",
    name: "Nightfang",
    rarity: "legendary",
    element: "DUSK",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 7,
    // 9/25/0sh/9sp = 43 against a cost-7 budget of 45, inside the band. Armour
    // traded for reach and speed: it was 7/24/4sh/6sp, which read as a bruiser
    // rather than the assassin its class says it is.
    dmg: 9,
    hits: 1,
    hp: 25,
    sp: 9,
    shields: 0,
    keywords: { LIFESTEAL: true },
    special: {
      name: "Soul Slash",
      cost: 4,
      handler: "drainMax",
      // DELETE, not steal: `deleteOnly` destroys the max HP instead of moving
      // it, so Nightfang gains nothing. 6-stolen was a 12-point swing (they lose
      // 6, it gains 6); 12-deleted is the same 12-point swing with the caster's
      // own HP bar left alone. Then it slips into STEALTH (selfStatus rider,
      // untargetable until it next attacks).
      params: { amount: 12, deleteOnly: 1, selfStatus: "STEALTH", selfStatusDuration: 1 },
      targetSide: "enemy",
      text: "Delete 12 max HP from an opponent — destroying it outright if it has 12 or less — then slip into STEALTH until you next attack.",
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
    keywords: {},
    // Rebuilds its barrier +2 shields each round (on top of BORE's Exostone +2
    // on summon); when the barrier first breaks it enrages (+3 DMG / +2 SP).
    roundTick: { selfShields: 2 },
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
    dmg: 0,
    hits: 1,
    hp: 6,
    sp: 13,
    shields: 3,
    // FLYING: it hovers. Melee cannot touch it unless the attacker also flies,
    // and it moves like a chess king in Prep. Stats are unchanged (0+6+6+13 = 25
    // = 5*3+10, still exactly on budget) — this is pure evasiveness, which suits
    // a 0-DMG turret whose whole job is to sit in range and irradiate.
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
    dmg: 7,
    hits: 1,
    hp: 3,
    sp: 10,
    shields: 0,
    keywords: {},
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
    dmg: 4,
    hits: 1,
    hp: 7,
    sp: 4,
    shields: 0,
    keywords: {},
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
    // Fog Settlement (On Summon): the whole battlefield fogs for 1 round —
    // every enemy basic aimed at your cards whiffs on a coin. Flat, no status.
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
    name: "Kcor",
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
    name: "Harve",
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
    name: "IcyNinza",
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
    name: "Glime",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Warrior",
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
    hp: 15,
    sp: 7,
    shields: 0,
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
    dmg: 8,
    hits: 1,
    hp: 21,
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
    name: "Sprinu",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 13,
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
      frightenInRange: 1,
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
    name: "SSeerr",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 4,
    dmg: 4,
    hits: 2,
    hp: 9,
    sp: 11,
    shields: 1,
    keywords: { EVASION: true },
    tribe: "Dragon",
    // Dragon's Blade: it grows into the fight — +1 DMG and +1 SP every 2nd round,
    // stacking with no ceiling.
    roundTick: { buffDmgEveryN: { n: 2, amount: 1, sp: 1 } },
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
      handler: "loadOnHit",
      // Lights the blade AND swings with it — the cast strike spends the first
      // of the two charges, so the burn starts landing immediately.
      params: { statusKind: "BURN", statusPower: 4, statusDuration: 2, attacks: 2, strikeOnCast: 1 },
      targetSide: "enemy",
      text: "Strike an opponent. That hit and your next basic attack apply BURN 4 for 2 rounds.",
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
    attackType: "Ranged",
    cost: 3,
    dmg: 1,
    hits: 5,
    hp: 6,
    sp: 12,
    shields: 1,
    keywords: { FLYING: true },
    // Soaring Sun: it climbs. +1 DMG every third round, stacking, forever.
    roundTick: { buffDmgEveryN: { n: 3, amount: 1 } },
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
    dmg: 1,
    hits: 1,
    hp: 16,
    sp: 3,
    shields: 0,
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
    name: "Obsidi",
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
      params: { dmg: 5, rollThrough: 1 },
      // Hits, THEN rolls THROUGH — past the struck body to the first open slot
      // toward the enemy home. Plain charge stalled on the target it just hit,
      // which made a talent named Roll Through do nothing in the common case.
      text: "Once per game: deal 5 DMG, then roll through to the first open slot toward the enemy home.",
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
    attackType: "Melee",
    cost: 6,
    dmg: 10,
    hits: 1,
    hp: 10,
    sp: 10,
    shields: 2,
    keywords: {},
    // Royal Guard: gain +1 shield each round.
    roundTick: { selfShields: 1 },
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
      params: { selfDmg: 5, selfMaxHp: 5, selfSp: 5 },
      targetSide: "self",
      text: "Gain +5 DMG, +5 HP, +5 SP permanently. 3-round cooldown.",
    },
  },
  // ── Wave 1 of the eight new element cards ──────────────────────────────────
  {
    id: "bore_rohojohn",
    name: "RohoJohn",
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
    special: {
      name: "Cougar Pounce",
      cost: 3,
      handler: "strike",
      params: { dmg: 10, statusKind: "SLEEP", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 10 DMG to an opponent in range and SLEEP them for 2 rounds.",
    },
  },
  {
    id: "bolt_shoksa",
    name: "Shoksa",
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
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 15,
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
      // firstOnlyStatus keeps the ROOT on the NEAREST body it lands on.
      params: {
        dmg: 6, pen: 1, targets: 99, forwardDepth: 3, spread: 0, // dmg 4 -> 6
        statusKind: "ROOT", statusDuration: 2, firstOnlyStatus: 1,
        selfShields: 3,
      },
      targetSide: "enemy",
      text: "Fell a tree straight down your own column: 6 DMG (PEN) to every opponent in the 3 slots ahead, reaching into their summoning row. ROOT the nearest for 2 rounds and gain 3 shield.",
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
    name: "Wista",
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
    attackType: "Melee",
    cost: 5,
    dmg: 5,
    hits: 1,
    hp: 29,
    sp: 1,
    shields: 0,
    keywords: {},
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
    shoveWeaker: true,
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
      // ranged: the same defect Rollo and Tempest had. WarPhant is MELEE, so
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
    cost: 3,
    dmg: 3,
    hits: 1,
    hp: 8,
    sp: 8,
    shields: 3,
    keywords: {},
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
      params: { rounds: 2, allySp: 1 },
      targetSide: "self",
      text: "For 2 rounds: every BURN on an opponent deals double, and PYRO allies gain +1 SP.",
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
    dmg: 6,
    hits: 1,
    hp: 10,
    sp: 9,
    shields: 0,
    keywords: {},
    tribe: "Reptile",
    // Venomous Bite: basics apply a light BLEED — a feeder for Thorn's
    // heal-off-BLEED payoff, and a third Reptile body for Trinezer's tribe aura.
    passiveNames: { onHitStatus: "Venomous Bite" },
    onHitStatus: { kind: "BLEED", duration: 1, power: 1 },
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
    sp: 0,
    shields: 4,
    // Molten Shell: −1 DMG from every incoming hit (flat, pre-shield, even PEN)
    // — that's exactly BLOCK. PYRO's first proper wall to hold a lane.
    keywords: { BLOCK: 1 },
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
    // Lure (On Summon): opponents in range have −25% accuracy against Anglerfish
    // for 1 round.
    passiveNames: { lure: "Lure" },
    lure: { pct: 25, rounds: 1 },
  },
  {
    id: "gale_stormhide_bison",
    name: "Stormhide Bison",
    rarity: "rare",
    element: "GALE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 3,
    dmg: 2,
    hits: 1,
    hp: 16,
    sp: 1,
    shields: 3,
    // Braced Stance: −1 DMG from every incoming attack (BLOCK) and immune to
    // knockback/pull — it plants and lets GALE's storms wash over it.
    keywords: { BLOCK: 1 },
    passiveNames: { pushImmune: "Braced Stance" },
    pushImmune: true,
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
    name: "Roy",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Warrior",
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
    dmg: 1,
    hits: 4,
    hp: 3,
    sp: 8,
    shields: 0,
    keywords: {},
    // Sticky: each of its four little jabs leaves BLEED — a cheap BLEED feeder.
    passiveNames: { onHitStatus: "Sticky" },
    onHitStatus: { kind: "BLEED", duration: 1, power: 1 },
  },
  {
    id: "leaf_oak",
    name: "OAK",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Tank",
    attackType: "Melee",
    // Bumped 1→2 (swapped with Weeds): a beefier 19-HP body that earns its
    // Acorn-per-hit + Root Growth engine.
    cost: 2,
    dmg: 1,
    hits: 1,
    hp: 19,
    sp: 0,
    shields: 0,
    keywords: {},
    // Acorn Drop: every hit OAK takes sprouts an Acorn — a 2/3/3 seedling that
    // Seed-Rolls one slot forward each round. Root Growth: OAK drinks in 2× from
    // every healing source (REGEN, aura heals, ally lifesteal…).
    passiveNames: { spawnOnHitTaken: "Acorn Drop", healReceivedMult: "Root Growth" },
    spawnOnHitTaken: { token: "leaf_acorn_tok", count: 1 },
    healReceivedMult: 2,
    // Rares carry Talents, not repeatable Specials: free, but once per game.
    // Reroot: a planted SP-0 tree uproots and marches up to 3 slots forward.
    talent: {
      name: "Reroot",
      handler: "reposition",
      params: { charge: 3 },
      text: "Once per game: uproot and advance up to 3 slots toward the enemy home.",
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
    // Flying Arrow: also fires at whatever the ally directly in front of it just
    // struck with a basic attack.
    passiveNames: { flyingArrow: "Flying Arrow" },
    flyingArrow: true,
  },
  {
    id: "gale_syt_bird",
    name: "Syt Bird",
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
    keywords: { FLYING: true },
    // Sky Scout: when Syt Bird enters a Mid row, allies' basic attacks hit +1
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
    name: "Buccaneers",
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
    // Back-ups (On Summon): a shot straight down its column, hitting every
    // opponent in that line for 2. (Doc's on-death self-copy is deferred — a
    // full copy would recurse its own On-Death, and there's no non-recursive
    // Buccaneers token/art to spawn instead.)
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
    attackType: "Melee",
    cost: 2,
    dmg: 2,
    hits: 1,
    hp: 12,
    sp: 3,
    shields: 2,
    // REFLECT 1: returns 1 DMG to attackers.
    keywords: { REFLECT: 1 },
    // Light Screen (End of Round): plates up allies within range +3 shields.
    passiveNames: { roundTick: "Light Screen" },
    roundTick: { allyInRangeShields: 3 },
  },
  {
    id: "dawn_able",
    name: "Able",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Support",
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
    dmg: 1,
    hits: 1,
    hp: 17,
    sp: 2,
    shields: 0,
    keywords: {},
    // Constriction: while adjacent to an opponent, drains 2 HP from it at end of
    // round (deal 2, heal 2) — a squeeze that doesn't need to swing.
    passiveNames: { roundTick: "Constriction" },
    roundTick: { drainAdjacent: 2 },
  },
  {
    id: "leaf_weeds",
    name: "Weeds",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Support",
    attackType: "Ranged",
    // Dropped 2→1 (swapped with OAK): a cheap, disposable body that keeps coming
    // back.
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 9,
    sp: 4,
    shields: 0,
    keywords: {},
    // Offspring (On Death): sprouts back up at half HP, with a 50% coin flip to
    // revive a second time.
    passiveNames: { onRevive: "Offspring" },
    onRevive: { heal: 5, secondChance: 50 },
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
    // Bloodfire Detonator: a glass-cannon finisher that DOUBLES its hit against
    // a target already BLEEDING and BURNING — the payoff for the blood engine
    // and the fire engine landing on the same body. Amplify, not consume: the
    // DOTs keep ticking, so a fast Firecrack can cash in every round.
    passiveNames: { vsStatus: "Bloodfire Detonator" },
    vsStatus: { status: "BURN", bloodfire: true, dmgMult: 2 },
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
    sp: 6,
    shields: 0,
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
    // Crack Shot: a 50% coin (the CRIT keyword) to deal a crushing shot — and
    // when it crits, the shot also PIERCES shields.
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
    onTribeDeath: { tribe: "Zombie", dmg: 1, hp: 1 },
  },
  {
    id: "dawn_stbern",
    name: "St.Bern",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Support",
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
    dmg: 2,
    hits: 1,
    hp: 16,
    sp: 7,
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
    name: "R.O.C.K",
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
      params: { tribe: "Spider", frighten: 1, healPerHit: 2, spawnOnKill: "dusk_spider" },
      targetSide: "enemy",
      text: "Every allied Spider attacks; each opponent hit is FRIGHTENed 1 round and Sarachnid heals 2 HP per hit. Every opponent killed nests another Spider.",
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
    name: "Hix",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 3,
    dmg: 5,
    hits: 1,
    hp: 13,
    sp: 7,
    shields: 0,
    keywords: {},
    tribe: "Dark",
    // Magic Potion (On Attack): a landed basic hurls a random potion — poison
    // (DOT 1), damage (3), or FRIGHTEN 2. On Death: the flasks shatter across the
    // enemy row directly ahead.
    passiveNames: { potionOnHit: "Magic Potion", onDeath: "Magic Potion" },
    potionOnHit: true,
    onDeath: { dmg: 3, rowAhead: true },
  },
  {
    id: "dawn_golde",
    name: "Golde",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 13,
    sp: 5,
    shields: 2,
    keywords: {},
    // Relentless (On Hit by Melee): strikes 2 back at the attacker.
    passiveNames: { onHitByMelee: "Relentless" },
    onHitByMelee: { dmg: 2 },
    // War Cry: Golde plates up (+2 shields) and rallies the team (+1 DMG) for
    // 2 rounds.
    special: {
      name: "War Cry",
      cost: 1,
      handler: "warCry",
      params: { selfShields: 2, buffDmg: 1, buffRounds: 2 },
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
    name: "Whintey",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 4,
    dmg: 6,
    hits: 1,
    hp: 13,
    sp: 9,
    shields: 1,
    keywords: {},
    // Frosty Bites (End of Round): ROOT an opponent with 0 SP for 2 rounds.
    passiveNames: { rootZeroSp: "Frosty Bites" },
    roundTick: { rootZeroSp: 2 },
    // Whinter's Bundle: extend the ROOT on every already-ROOTed opponent by 2.
    special: {
      name: "Whinter's Bundle",
      cost: 2,
      handler: "extendStatusAll",
      params: { status: "ROOT", addRounds: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "ROOT every already-ROOTed opponent for 2 additional rounds.",
    },
  },
  {
    id: "aqua_anos",
    name: "Anos",
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
    // Liquid Serenity (End of Round): if Anos didn't attack this round, heal +8
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
    name: "Fano",
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
    // Feather Fan: give every slower teammate Fano's SP value for 1 round.
    special: {
      name: "Feather Fan",
      cost: 1,
      handler: "featherFan",
      params: {},
      targetSide: "self",
      text: "Give every slower teammate Fano's SP value for 1 round.",
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
    dmg: 7,
    hits: 1,
    hp: 10,
    sp: 5,
    shields: 5,
    keywords: {},
    tribe: "ARC",
    // Surge Protector + Electro Surge: starts armed on summon; while armed it's
    // status-immune, and the first hit it takes discharges — PARALYZE the
    // attacker 3r, then deactivate.
    passiveNames: { electroSurge: "Electro Surge" },
    electroSurge: { paralyze: 3, shield: 1, dmgBoost: 5, boostRounds: 2 },
    // Live current: +2 SP every round (stacking).
    roundTick: { buffDmgEveryN: { n: 1, amount: 0, sp: 2 } },
    special: {
      name: "Electro Surge",
      cost: 1,
      handler: "electroSurge",
      params: {},
      targetSide: "self",
      text: "Re-arm Electro Surge: +1 shield and +5 DMG for 2 rounds. While armed: status-immune, and the next hit PARALYZEs the attacker 3 rounds.",
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
    name: "Striik",
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
    keywords: {},
    // Iron Ore: take half damage (round down) from Ranger + Assassin attackers.
    passiveNames: { blockVsClasses: "Iron Ore" },
    blockVsClasses: ["Ranger", "Assassin"],
    // Vengeance: deal the damage Bolder took this round back (with PEN) and SLEEP
    // an opponent 2 rounds.
    special: {
      name: "Vengeance",
      cost: 2,
      handler: "vengeance",
      params: { sleep: 2 },
      targetSide: "enemy",
      text: "Deal PEN damage equal to what Bolder took this round, and SLEEP an opponent for 2 rounds.",
    },
  },
  {
    id: "bore_sheish",
    name: "Sheish",
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
      params: { dmg: 5, targets: 1, statusKind: "SLEEP", statusDuration: 1 },
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
    // Sweep: basic-attack every opponent in the row ahead; +2 shields per kill.
    special: {
      name: "Sweep",
      cost: 3,
      handler: "sweep",
      params: { shieldPerKill: 2 },
      targetSide: "enemy",
      text: "Attack every opponent in the row directly ahead; gain +2 shields per kill.",
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
      cost: 2,
      handler: "barrage",
      params: { dmg: 4, targets: 99, crit: 1, pen: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 4 DMG (CRIT, PEN) to all opponents in range.",
    },
  },
  {
    id: "dawn_ty",
    name: "Ty",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Mage",
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
    name: "Raya",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Ranger",
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
    keywords: {},
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
    // Ride or Die: Luna grants +3 DMG and +8 HP on summon; each kill grants +2 HP.
    passiveNames: { summonSelfBuff: "Ride or Die", onKill: "Ride or Die" },
    summonSelfBuff: { dmg: 3, hp: 8 },
    onKill: { buffMaxHp: 2 },
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
    // Flying Flame Strike: 1 DMG to up to 8 opponents, then move up to 3 spaces.
    special: {
      name: "Flying Flame Strike",
      cost: 2,
      handler: "flameStrike",
      params: { dmg: 1, targets: 8, move: 3 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 1 DMG to up to 8 RANDOM opponents and move up to 3 spaces.",
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
    passiveNames: { weaponModes: "Power Grab" },
    weaponModes: [
      { name: "Standard", dmg: 6, hits: 1, spCost: 0 },
      { name: "AKVolt Shot", dmg: 5, hits: 2, spCost: 1 },
      { name: "ARC88", dmg: 2, hits: 4, spCost: 2 },
      { name: "ThunderRPG", dmg: 10, hits: 1, spCost: 3 },
    ],
    // Spraying Thunder: rake the row ahead with the current weapon.
    special: {
      name: "Spraying Thunder",
      cost: 3,
      handler: "sprayWeapon",
      params: {},
      targetSide: "enemy",
      ranged: true,
      text: "Attack every opponent in the row directly ahead using the current Basic Attack Weapon.",
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
    // Fade (On Summon): gain STEALTH for 2 rounds.
    passiveNames: { onSummon: "Fade" },
    onSummon: { selfStatus: "STEALTH", selfStatusDuration: 2 },
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
    cost: 1,
    dmg: 3,
    hits: 2,
    hp: 5,
    sp: 4,
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
    // Twisted Rush (end of its first round): gore the enemy directly ahead for 6;
    // if it dies, Wailverine takes its slot.
    passiveNames: { roundTick: "Twisted Rush" },
    roundTick: { firstRoundOnly: true, pokeAheadAdvance: 6 },
  },
  {
    id: "gale_vvulture",
    name: "VVulture",
    tribe: "Avian",
    rarity: "epic",
    element: "GALE",
    cardClass: "Tank",
    attackType: "Ranged",
    cost: 3,
    dmg: 2,
    hits: 1,
    hp: 15,
    sp: 6,
    shields: 1,
    keywords: { FLYING: true },
    // Salvage: any card's death grants +2 max HP. On Kill: +1 DMG.
    passiveNames: { salvageOnDeath: "Salvage", onKill: "Salvage" },
    salvageOnDeath: 2,
    onKill: { buffDmg: 1 },
    // Roosting Wing Shield: gain 10 shields and heal +5.
    special: {
      name: "Roosting Wing Shield",
      cost: 1,
      handler: "grantShield",
      params: { amount: 5, heal: 5 },
      targetSide: "self",
      text: "Gain 5 shields and heal +5 HP.",
    },
  },
  {
    id: "gale_klouy",
    name: "Klouy",
    rarity: "epic",
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
    // Twister: a second basic hit on a target within a round STUNs it 2 rounds.
    passiveNames: { onHitStatus: "Twister" },
    onHitStatus: { kind: "STUN", duration: 2, power: 0, onSecondHit: true },
    // Spiraling Windrow: a 5-DMG shot that ricochets between nearby opponents.
    special: {
      name: "Spiraling Windrow",
      cost: 2,
      handler: "spiral",
      params: { dmg: 5, bounces: 3 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 5 DMG bouncing between opponents within 1 space of each other.",
    },
  },

  // ───────────────── COST-6 LEGENDARIES (grid fill) ─────────────────
  {
    id: "leaf_efy",
    name: "Efy",
    rarity: "legendary",
    element: "LEAF",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 6,
    dmg: 5,
    hits: 1,
    hp: 20,
    sp: 11,
    shields: 2,
    keywords: {},
    // Nature's Protection (End of Round): refresh Efy's shields back up to 2.
    // Shared Grove (Aura): LEAF allies are topped up +1 shield each round too.
    passiveNames: { refreshShieldsTo: "Nature's Protection", aura: "Shared Grove" },
    roundTick: { refreshShieldsTo: 2 },
    aura: { scope: "element", shields: 1 },
    // Emergence: raise a Walking Tree in an adjacent slot (it marches forward,
    // drops fruit, and heals allies each round).
    special: {
      name: "Emergence",
      cost: 4,
      handler: "spawn",
      params: { token: "leaf_walking_tree", count: 1, radius: 1, healAllies: 4 },
      targetSide: "self",
      text: "Spawn a Walking Tree in an adjacent slot and heal all allies 4; each round the tree marches forward, hits an opponent for 3, and heals an ally 3.",
    },
  },
  {
    id: "leaf_season",
    name: "Season",
    rarity: "legendary",
    element: "LEAF",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 6,
    dmg: 3,
    hits: 2,
    hp: 24,
    sp: 10,
    shields: 0,
    keywords: {},
    // Grounded (End of Round): ROOT the fastest opponent 2 rounds. Aura: heal all
    // LEAF allies +4 each round.
    passiveNames: { rootFastest: "Grounded", roundHealElement: "Season's Bloom" },
    roundTick: { rootFastest: 2, roundHealElement: { element: "LEAF", amount: 4 } },
    // Spiraling Root Coil: ROOT up to 4 in the adjacent row for 2 rounds NOW; the
    // roots creep on to ROOT up to 4 in the far row for 1 round NEXT round.
    special: {
      name: "Spiraling Root Coil",
      cost: 4,
      handler: "barrage",
      params: { dmg: 0, rowAhead: 1, targets: 4, statusKind: "ROOT", statusDuration: 2, farRowRootNext: 1, farRowRootCount: 4, farRowRootDuration: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "ROOT up to 4 opponents in the adjacent row for 2 rounds. Next round, ROOT up to 4 in the far row for 1 round.",
    },
  },
  {
    id: "leaf_nightshade",
    name: "Nightshade",
    rarity: "legendary",
    element: "LEAF",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 6,
    dmg: 4,
    hits: 3,
    hp: 17,
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
    name: "Rubyo",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 5,
    dmg: 3,
    hits: 1,
    hp: 12,
    sp: 7,
    shields: 2,
    keywords: {},
    tribe: "Dragon",
    // Ancient Protection (On Summon): spawn Greegon (the existing card) in an
    // adjacent slot. Dragon's Dance then adds an 8-DMG blow while Greegon lives.
    passiveNames: { summonSpawn: "Ancient Protection" },
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
    name: "Rain",
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
    // Rainstorm: basic attacks splash 2 DMG to one adjacent opponent, and while
    // Rain lives the whole team's basics clip +1 adjacent target (team aura).
    passiveNames: { basicSplash: "Rainstorm", splashAura: "Downpour" },
    basicSplash: 2,
    splashAura: true,
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
    tribe: ["Deep Creatures", "SeaC"], // brief's Deep Creatures + the school it had
    // Perpetual Fog (On Kill): cloak Driftwraith and same-row AQUA allies in
    // STEALTH for 1 round.
    passiveNames: { onKill: "Perpetual Fog" },
    onKill: { grantStealth: 1 },
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
    cost: 6,
    dmg: 5,
    hits: 2,
    hp: 14,
    sp: 10,
    shields: 3,
    keywords: {},
    // Life Cycle: each incoming hit is absorbed by a Light Orb that then bursts
    // at the attacker (blue: 3 DMG + BLIND 2 · green: 2 DMG + heal weakest ally 7
    // · red: POISON 2). An opponent's death recharges one orb.
    passiveNames: { lightOrbs: "Life Cycle" },
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
    name: "Shock",
    rarity: "legendary",
    element: "BOLT",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 6,
    dmg: 2,
    hits: 5,
    hp: 19,
    sp: 11,
    shields: 0,
    keywords: {},
    // Amplifier (On Summon): 5 DMG CRIT to a foe. On Kill: +1 DMG for the round.
    // Power Grid (aura): PARALYZE every opponent under 4 HP each round.
    passiveNames: { onSummon: "Amplifier", onKill: "Overcharge", paralyzeLowHp: "Power Grid" },
    onSummon: { handler: "strike", params: { dmg: 5, crit: 1, reachNearest: 1 }, targetSide: "enemy" },
    onKill: { buffDmgRound: 1 },
    roundTick: { paralyzeLowHp: { underHp: 4, rounds: 1 } },
    // Fryer: 4×1 DMG to all opponents, +1 vs PARALYZED. Recomputed per target so
    // Overcharge (earned on a kill mid-Fryer) boosts the opponents struck after.
    special: {
      name: "Fryer",
      cost: 4,
      handler: "fryer",
      params: { dmg: 4, hits: 1, paralyzeBonus: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 4 DMG to all opponents; PARALYZED opponents take +1 DMG.",
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
    // Conduction: adjacent allies (all 8 surrounding slots) gain +1 DMG. Arc (End
    // of Round): 2 DMG to the closest opponent. A fixed pylon — SP 0, never moves.
    passiveNames: { aura: "Conduction", roundTick: "Arc" },
    aura: { scope: "adjacent", dmg: 1 },
    roundTick: { pokeDmg: 2 },
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
    passiveNames: { onSummon: "Relay Network", penWhileAlly: "Overcharge" },
    onSummon: { handler: "spawn", params: { token: "bolt_rodd", count: 1, radius: 1 } },
    penWhileAlly: ["bolt_rodd"],
    // Grid Deployment: deploy another Rodd into an adjacent open slot.
    special: {
      name: "Grid Deployment",
      cost: 3,
      handler: "spawn",
      params: { token: "bolt_rodd", count: 1, radius: 1 },
      targetSide: "self",
      text: "Deploy a Rodd (0/7/4🛡 · Conduction, Arc) into an adjacent open slot.",
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
    name: "Zoez",
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
    blocksRangedChance: 100,
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
    cost: 6,
    dmg: 3,
    hits: 1,
    hp: 29,
    sp: 8,
    shields: 0,
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
    cost: 6,
    dmg: 7,
    hits: 1,
    hp: 22,
    // Traded its 2 shields straight across for +4 SP — a GALE flier should be
    // fast rather than armoured, and 4 shield-points = 4 SP keeps it on budget.
    sp: 11,
    shields: 0,
    keywords: {},
    tribe: ["Dragon", "Avian"],
    // Vision Guard (On Hit): 50% chance to deflect — take half, deal half back.
    passiveNames: { onHitDeflect: "Vision Guard" },
    onHitDeflect: 50,
    // Dark Wind Wave: 5 DMG to the far row, shoving survivors toward the near row.
    special: {
      name: "Dark Wind Wave",
      cost: 3,
      handler: "barrage",
      params: { dmg: 5, enemyHomeRow: 1, targets: 99, push: 1 },
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
    tribe: "Avian",
    // Totem Spirit (Aura): while Totem lives, the team's basics clip +1 target.
    passiveNames: { splashAura: "Totem Spirit" },
    splashAura: true,
    // Raise the Totem Pole (On Summon): plant a Pole that scorches the row ahead.
    summonSpawn: { token: "gale_totem_pole", count: 1 },
    // Rampage: gain +1 DMG for 3 rounds.
    special: {
      name: "Rampage",
      cost: 2,
      handler: "empower",
      params: { selfDmg: 1, buffRounds: 3 },
      targetSide: "self",
      text: "Gain +1 DMG for 3 rounds.",
    },
  },
  {
    id: "bore_diam",
    name: "Diam",
    rarity: "legendary",
    element: "BORE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 6,
    dmg: 8,
    hits: 1,
    hp: 9,
    sp: 11,
    shields: 6,
    keywords: {},
    // Diamond Kingdom (Aura): BORE allies gain +1 shield; when a BORE ally
    // falls, the lowest-HP survivor is hardened with a one-round BLOCK 2.
    aura: { scope: "element", shields: 1 },
    passiveNames: { blockOnAllyDeath: "Diamond Kingdom" },
    blockOnAllyDeath: { block: 2, rounds: 1, element: "BORE" },
    // Diamallize: harden the whole team's armour — every ally gains BLOCK 2 for
    // two rounds (stacks with their own BLOCK).
    special: {
      name: "Diamallize",
      cost: 4,
      handler: "diamallize",
      params: { block: 2, rounds: 2 },
      targetSide: "self",
      text: "Harden allies' armor — each ally gains BLOCK 2 for 2 rounds.",
    },
  },
  {
    id: "bore_score",
    name: "Score",
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
    // the killer poisoned. Toxic Contagion: Score's own basics spread POISON.
    passiveNames: { onHitByMelee: "Sand Trap", onDeath: "Sand Trap", onHitStatus: "Toxic Contagion" },
    onHitByMelee: { status: { kind: "SLEEP", duration: 1, power: 0 } },
    onDeath: { dmg: 0, killerStatus: { kind: "DOT", duration: 2, power: 3 } },
    onHitStatus: { kind: "DOT", duration: 2, power: 2 },
    // Toxic Contagion: SLEEP a target and apply POISON 3 for 2 rounds.
    special: {
      name: "Toxic Contagion",
      cost: 3,
      handler: "toxicContagion",
      params: { sleep: 1, dotDuration: 2, dotPower: 3 },
      targetSide: "enemy",
      ranged: true,
      text: "SLEEP a target and apply POISON 3 (DOT) for 2 rounds.",
    },
  },
  {
    id: "dusk_scar",
    name: "Scar",
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
    // opponent dies, heal Scar and its allies +1.
    passiveNames: { deathHealAura: "Blood Moon" },
    deathHealAura: 1,
    // Moon Frenzy: 3 DMG to all opponents, draining from each (DUSK lifesteal).
    special: {
      name: "Moon Frenzy",
      cost: 3,
      handler: "barrage",
      params: { dmg: 3, targets: 99, drain: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Attack all opponents for 3 DMG and DRAIN from each.",
    },
  },

  // ───────────────── COST-7 LEGENDARIES (grid fill) ─────────────────
  {
    id: "leaf_warden",
    name: "Warden",
    rarity: "legendary",
    element: "LEAF",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 7,
    dmg: 8,
    hits: 1,
    hp: 24,
    sp: 5,
    shields: 4,
    keywords: {},
    // Overwatch: when an ally is killed, answer the killer with 7 DMG (once per
    // round).
    passiveNames: { onAllyKilled: "Overwatch" },
    onAllyKilled: { dmg: 7, oncePerRound: true },
    // Justice: 2×4 DMG (PEN) to all opponents in range, draining from them.
    special: {
      name: "Justice",
      cost: 2,
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
    // Power Up (End of Round): +1 DMG, +1 SP. On Kill: +2 shields. Aura: BOLT
    // allies +1 basic DMG. (Doc's "after 3 Power Ups" gate simplified.)
    passiveNames: { roundTick: "Power Up", onKill: "Power Up" },
    roundTick: { buffDmgEveryN: { n: 1, amount: 1, sp: 1 } },
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
    name: "Steel",
    rarity: "legendary",
    element: "BORE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 7,
    dmg: 8,
    hits: 1,
    hp: 18,
    sp: 9,
    shields: 5,
    keywords: { BLOCK: 2 },
    tribe: "Dragon",
    // Hardened Stainless Steel: BLOCK 2 (each shield harder to break) and immune
    // to status/DOT.
    statusImmune: true,
    // Magnetic Steel: 3 DMG to all opponents and pull a shield off each onto Steel.
    special: {
      name: "Magnetic Steel",
      cost: 5,
      handler: "barrage",
      params: { dmg: 3, targets: 99, stealShields: 1 },
      targetSide: "enemy",
      text: "Deal 3 DMG to all opponents and steal 1 shield from each onto Steel.",
    },
  },
  {
    id: "dusk_hoax",
    name: "HOAX",
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
      params: {},
      targetSide: "enemy",
      ranged: true,
      text: "Mark an opponent — every basic attack against them is a guaranteed CRIT. When a marked target dies, Blur banks a one-time auto-dodge.",
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
    name: "Commander",
    rarity: "legendary",
    element: "DAWN",
    cardClass: "Tank",
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
    // Flash Squad: order the allies in the row ahead to fire their basics.
    special: {
      name: "Flash Squad",
      cost: 2,
      handler: "flashSquad",
      params: {},
      targetSide: "self",
      text: "Command allies in the row directly ahead to each use their basic attack.",
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
    passiveNames: { onSummon: "Volcanic Arrival", onHitSelfBuff: "Burning Roar", onKill: "Volcanic Charge" },
    onSummon: { handler: "barrage", params: { dmg: 0, rowAhead: 1, targets: 99, statusKind: "BURN", statusPower: 2, statusDuration: 3 }, targetSide: "enemy" },
    onHitSelfBuff: { dmg: 1 },
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
    cost: 4,
    dmg: 6,
    hits: 1,
    hp: 11,
    sp: 10,
    shields: 1,
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
    name: "Dande",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 4,
    dmg: 3,
    hits: 1,
    hp: 20,
    sp: 0,
    shields: 3,
    keywords: { REGEN: 3 },
    // Super Weed: REGEN 3 each round and grows +2 max HP (it just keeps
    // spreading). Bramble: a melee attacker takes 1 back and is left with a
    // clinging thorn (DOT 1 for 2 rounds).
    passiveNames: { onHitByMelee: "Bramble", roundTick: "Super Weed" },
    roundTick: { buffDmgEveryN: { n: 1, amount: 0, hp: 2 } },
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
    dmg: 4,
    hits: 1,
    hp: 13,
    sp: 8,
    shields: 0,
    keywords: {},
    // Trapper: a snare bite on summon, on death, and on a landed basic — a hit
    // has a 50% chance to ROOT the target for a round.
    passiveNames: { onSummon: "Trapper", onDeath: "Trapper", onHitStatus: "Trapper" },
    onSummon: { handler: "strike", params: { dmg: 1, reachNearest: 1 }, targetSide: "enemy" },
    onDeath: { dmg: 1 },
    onHitStatus: { kind: "ROOT", duration: 1, power: 0, chance: 50 },
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
    // Heat Crunch: the next 3 basic attacks apply BURN 2 for 3 rounds.
    special: {
      name: "Heat Crunch",
      cost: 1,
      handler: "loadOnHit",
      params: { statusKind: "BURN", statusPower: 2, statusDuration: 3, attacks: 3 },
      targetSide: "self",
      text: "Your next 3 basic attacks apply BURN 2 for 3 rounds.",
    },
  },
  {
    id: "pyro_scully",
    name: "Scully",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 3,
    dmg: 6,
    hits: 1,
    hp: 13,
    sp: 6,
    shields: 0,
    keywords: {},
    // Bounty Hunter: basics apply BURN 2, and any opponent who fires a Special
    // is marked with BURN 2 for it (reactive bounty).
    passiveNames: { onHitStatus: "Bounty Hunter", onEnemySpecial: "Bounty Hunter" },
    onHitStatus: { kind: "BURN", duration: 2, power: 2 },
    onEnemySpecial: { status: { kind: "BURN", duration: 2, power: 2 } },
    // Scallywag: a fire bomb on the enemy row ahead — 2 DMG + BURN. (Doc's
    // home-slot trap trigger simplified.)
    special: {
      name: "Scallywag",
      cost: 2,
      handler: "barrage",
      params: { dmg: 2, rowAhead: 1, targets: 99, statusKind: "BURN", statusPower: 2, statusDuration: 2 },
      targetSide: "enemy",
      ranged: true,
      text: "Bomb the enemy row ahead for 2 DMG and BURN 2.",
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
    // — 4 DMG plus half its current HP.
    talent: {
      name: "Demolition Charge",
      text: "Once per game, free: deal 4 DMG plus half the target's current HP.",
      handler: "barrage",
      params: { dmg: 4, targets: 1, pctHpDmg: 50 },
    },
  },
  {
    id: "aqua_icynin",
    name: "ICYNIN",
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
    // Frozen Serpent: basics FREEZE a foe (50%), and a hit on an already-FROZEN
    // target shatters the ice — 3 splash to everyone adjacent to it.
    passiveNames: { onHitStatus: "Frozen Serpent" },
    onHitStatus: { kind: "FREEZE", duration: 1, power: 0, chance: 50 },
    shatterFrozen: 3,
    // Icy Storm: 3 DMG to 2 opponents, then vanish into STEALTH for 2 rounds.
    special: {
      name: "Icy Storm",
      cost: 3,
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
      params: { statusKind: "BLIND", statusDuration: 1, targets: 99, spawnToken: "dawn_radiant_guardian", spawnCount: 1, spawnRadius: 1 },
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
    attackType: "Melee",
    cost: 4,
    dmg: 7,
    hits: 1,
    hp: 11,
    sp: 7,
    shields: 2,
    keywords: {},
    // Dawning Assault (On Summon): 7 DMG to a foe and blind its aim (its attacks
    // miss 50% for 2 rounds). Ariel's fall chips the killer for 3.
    passiveNames: { onSummon: "Dawning Assault", onDeath: "Dawning Assault" },
    onSummon: { handler: "strike", params: { dmg: 7, reachNearest: 1, targetAttackMissPct: 50, targetAttackMissRounds: 2 }, targetSide: "enemy" },
    onDeath: { dmg: 3 },
    // 100,000°: +14 DMG on the next basic attack (with PEN, folded in).
    special: {
      name: "100,000°",
      cost: 2,
      handler: "empower",
      params: { selfDmg: 14, buffRounds: 1 },
      targetSide: "self",
      text: "Your next basic attack deals +14 DMG (PEN).",
    },
  },
  {
    id: "dawn_sircrest",
    name: "SirCrest",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Mage",
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
    name: "Ning",
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
    // Drone Sweep: when an opponent is summoned, hop to the nearest slot beside
    // the newcomer and peck it for 2.
    passiveNames: { onOppSummon: "Drone Sweep" },
    onOppSummon: { chase: true, dmg: 2 },
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
    // breaker for 2 rounds. Aura: opponents in range are ELECTRIFIED, so BOLT
    // allies (which hit statused foes harder) get the bonus against them.
    passiveNames: { onShieldBreak: "Electro Knight" },
    roundTick: { selfShields: 1, inRangeStatus: { kind: "ELECTRIFIED", duration: 1, power: 0 } },
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
    name: "Gemaga",
    tribe: "Dragon Born",
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
    // Dragon Born: gemstone scales REFLECT 2 damage back at attackers.
    keywords: { REFLECT: 2 },
    // Magnetic Shield: grant the allies in the row directly ahead REFLECT 1.
    special: {
      name: "Magnetic Shield",
      cost: 4,
      handler: "magneticShield",
      params: { reflect: 1, rounds: 2 },
      targetSide: "self",
      text: "Give allies in the row directly ahead REFLECT 1 for 2 rounds.",
    },
  },
  {
    id: "bore_valcana",
    name: "Valcana",
    rarity: "epic",
    element: "BORE",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 3,
    dmg: 3,
    hits: 2,
    hp: 8,
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
    id: "bore_granite_armadillo",
    name: "Granite Armadillo",
    rarity: "rare",
    element: "BORE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 3,
    dmg: 2,
    hits: 1,
    hp: 14,
    sp: 3,
    shields: 3,
    keywords: {},
    // Granite Plates: every hit it takes hardens another shield (caps at 6).
    passiveNames: { shieldPerHitTaken: "Granite Plates" },
    shieldPerHitTaken: { shields: 1, maxShields: 6 },
  },
  {
    id: "dusk_skrow",
    name: "Skrow",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 5,
    hits: 2,
    hp: 8,
    sp: 7,
    shields: 0,
    keywords: {},
    tribe: "ScareKrow",
    // Goodnight (On Death): two Crows burst from the straw as it falls.
    passiveNames: { onDeath: "Goodnight" },
    onDeath: { dmg: 0, spawnToken: { token: "dusk_crow", count: 2 } },
    // Bird Bomb (Talent, free, once per game): conjure 3 Crows.
    talent: {
      name: "Bird Bomb",
      text: "Once per game, free: create 3 Crows.",
      handler: "spawn",
      params: { token: "dusk_crow", count: 3 },
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
    dmg: 0,
    hits: 1,
    hp: 20,
    sp: 0,
    shields: 0,
    keywords: {},
    // Boom: a live fuse. It cannot attack — after 4 rounds it detonates for 11
    // DMG to every enemy, then dies. Kill it first or eat the blast.
    boom: { afterRounds: 4, dmg: 11 },
  },
  {
    id: "dusk_jackl",
    name: "Jackl",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 3,
    dmg: 2,
    hits: 2,
    hp: 12,
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
    passiveNames: { deathExplosion: "Unstable Core" },
    deathExplosion: 10,
    // Volatile Formula: 13 DMG to all opponents in range, 30% chance to double.
    special: {
      name: "Volatile Formula",
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
    hp: 32,
    sp: 9,
    shields: 0,
    keywords: { FLYING: true },
    tribe: "Dragon",
    // Immediate Impact (On Summon): 2 DMG to all opponents on arrival.
    onSummon: { handler: "barrage", params: { dmg: 2, targets: 99 } },
    // Blinding Star (Aura): opponents' basics hit one fewer target.
    passiveNames: { blindingStar: "Blinding Star" },
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
    attackType: "Ranged",
    cost: 5,
    dmg: 3,
    hits: 1,
    hp: 18,
    sp: 10,
    shields: 2,
    keywords: {},
    // Blessed Light (End of Round): heal allies on the home row +1 HP.
    passiveNames: { roundTick: "Blessed Light", purelightAura: "Purelight" },
    roundTick: { healHomeRow: 1 },
    // Purelight (Aura): DAWN allies immune to BLIND; their attacks pierce EVASION.
    purelightAura: true,
    // Mending Horn: heal an ally +8 and strip its negatives + stat changes.
    special: {
      name: "Mending Horn",
      cost: 3,
      handler: "heal",
      params: { targets: 1, amount: 8, cleanseNegatives: 1 },
      targetSide: "ally",
      text: "Heal an ally +8 HP and CLEANSE them (remove negative statuses and stat changes).",
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
    // Pack Leader: Wolf allies gain +1 DMG and +1 SP.
    aura: { scope: "tribe", match: "Wolf", dmg: 1, sp: 1 },
    // Whirling Missile: dash into the target's row, then 14 to it + 7 splash to
    // opponents adjacent to that target.
    special: {
      name: "Whirling Missile",
      cost: 5,
      handler: "strike",
      params: { dmg: 14, splash: 7, charge: 4, chargeFirst: 1, chargeLateral: 1 },
      targetSide: "enemy",
      text: "Dash into the target's row, then deal 14 DMG to it and 7 DMG to opponents adjacent to it.",
    },
  },
  {
    id: "gale_breeze",
    name: "Breeze",
    rarity: "rare",
    element: "GALE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 2,
    dmg: 2,
    hits: 1,
    hp: 8,
    sp: 10,
    shields: 0,
    keywords: { FLYING: true },
    // Dust Gust: basics have a 30% chance to BLIND for the round.
    passiveNames: { onHitStatus: "Dust Gust" },
    onHitStatus: { kind: "BLIND", duration: 1, power: 0, chance: 30 },
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
    keywords: {},
    tribe: ["Dragon", "Vapor"],
    // Infinite Serpent (On Kill): grow permanently (+1 SP, +1 DMG) and snipe the
    // lowest-HP survivor for 3.
    passiveNames: { onKill: "Infinite Serpent" },
    onKill: { buffSp: 1, buffDmg: 1, lowestHpDmg: 3 },
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
    name: "Bark",
    rarity: "epic",
    element: "LEAF",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 4,
    dmg: 2,
    hits: 2,
    hp: 9,
    sp: 11,
    shields: 3,
    keywords: {},
    // Bark Shield (End of Round): +1 shield each round, capping at 5.
    passiveNames: { roundTick: "Bark Shield" },
    roundTick: { selfShields: 1, selfShieldsMax: 5 },
    // Night Spear: a crushing, piercing spear (4 crit = 8, ignores shields) that
    // ROOTs the target for 3 rounds and MUTES it for one.
    special: {
      name: "Night Spear",
      cost: 1,
      handler: "strike",
      params: { dmg: 8, pen: 1, statusKind: "ROOT", statusDuration: 3, debuffStatus: "MUTED", debuffStatusRounds: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Deal 8 DMG (4 CRIT), piercing shields, ROOT the target for 3 rounds, and MUTE it for 1 round.",
    },
  },
  {
    id: "leaf_walking_tree",
    name: "Walking Tree",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    dmg: 0,
    hits: 1,
    hp: 24,
    sp: 0,
    shields: 0,
    keywords: {},
    // Moving Forest (End of Round): march forward one space if it's open (this
    // overrides its SP 0), and drop fruit — 3 DMG to the nearest opponent and
    // +3 HP to the lowest-HP ally.
    passiveNames: { roundTick: "Moving Forest", healReceivedMult: "Root Growth" },
    roundTick: { advance: 1, randomEnemyDmg: 3, healLowestAlly: 3 },
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
    cost: 4,
    dmg: 3,
    hits: 1,
    hp: 16,
    sp: 3,
    shields: 4,
    // LIFESTEAL: basics heal Sakuroot for the damage dealt.
    keywords: { LIFESTEAL: true },
    // Deep Roots: planted — immune to push / pull / knockback.
    // Petalfall (End of Round): heal LEAF allies on the home row +2 HP.
    passiveNames: { pushImmune: "Deep Roots", roundTick: "Petalfall" },
    pushImmune: true,
    roundTick: { healHomeRowElement: 2 },
    // Petal Storm: 3 DMG to every opponent in the row directly ahead + ROOT 1.
    special: {
      name: "Petal Storm",
      cost: 3,
      handler: "barrage",
      params: { dmg: 3, targets: 99, rowAhead: 1, statusKind: "ROOT", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 3 DMG to all opponents in the row directly ahead and ROOT them for 2 rounds.",
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
    // King of Bones (Aura): Skeleton allies (skeletons, SkullDrakes, the King)
    // gain +2 DMG and are topped up +1 shield each round.
    passiveNames: { aura: "King of Bones", summonSpawn: "Dead Court", roundTick: "Dead Siege" },
    aura: { scope: "tribe", match: "Skeleton", dmg: 2, shields: 1 },
    // On Summon: raise 2 Skeletons at his side.
    summonSpawn: { token: "dusk_skeleton_tok", count: 2 },
    // Dead Siege (End of Round): raise 2 more Skeletons (capped at 6 standing).
    roundTick: { spawn: { token: "dusk_skeleton_tok", count: 2 }, spawnMaxAlive: 6 },
    // King's SkullDrake: DOT the row ahead and raise an attacking SkullDrake.
    special: {
      name: "King's SkullDrake",
      cost: 4,
      handler: "barrage",
      params: { dmg: 0, rowAhead: 1, targets: 99, statusKind: "DOT", statusPower: 3, statusDuration: 3, spawnToken: "dusk_skulldrake_tok", spawnCount: 1 },
      targetSide: "enemy",
      ranged: true,
      text: "Apply DOT 3 (3 rounds) to opponents in the row directly ahead and raise an attacking SkullDrake.",
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
    name: "Blub",
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
    keywords: { FLYING: true },
    tribe: "Avian",
    // Raptor Assault (End of Round): if no ToxHawk stands, raise one (capped at 1).
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
    cost: 3,
    dmg: 4,
    hits: 1,
    hp: 9,
    sp: 11,
    shields: 0,
    keywords: {},
    // Bird Hunt (On Summon): arrives with an Owlly at its wing.
    passiveNames: { summonSpawn: "Bird Hunt" },
    summonSpawn: { token: "gale_owlly", count: 1 },
    // Birds of Prey: loose 3 attacking Owllies.
    special: {
      name: "Birds of Prey",
      cost: 3,
      handler: "spawn",
      params: { token: "gale_owlly", count: 3, radius: 2 },
      targetSide: "self",
      text: "Spawn 3 attacking Owllies.",
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
    // KaBoooom (On Death): 6 DMG to every non-PYRO card on the board.
    passiveNames: { onDeath: "KaBoooom" },
    onDeath: { dmg: 0, boardBlast: { dmg: 6, exceptElement: "PYRO" } },
    // Rares carry Talents, not repeatable Specials: free, but once per game.
    // Rollout: the canister rolls off the back line, striking then phasing PAST
    // bodies to the first open slot toward the enemy home — parking the bomb in
    // their line so KaBoooom lands where it hurts.
    talent: {
      name: "Rollout",
      handler: "strike",
      params: { dmg: 4, rollThrough: 1 },
      text: "Once per game: deal 4 DMG, then roll through to the first open slot toward the enemy home.",
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
    keywords: {},
    // 24K Stallion (On Summon): the mount arrives with +24 HP.
    summonSelfBuff: { dmg: 0, hp: 24 },
    // Solar Sovereign (Aura): allies are immune to stat reduction (WEAKEN).
    passiveNames: { statDropImmuneAura: "Solar Sovereign" },
    statDropImmuneAura: true,
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
];

// ── Tokens ───────────────────────────────────────────────────────────────────
// Spawned by cards, never dealt from a deck. Kept OUT of CARDS so decks + the
// cost-formula test ignore them; merged into CARD_INDEX below so getDef resolves
// them. (Reptilian and Heir used to live here — they are draftable now, but are
// still spawned by Trinezer and Imperator exactly as before.)
export const TOKENS: CardDef[] = [
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
    passiveNames: { roundTick: "Totem Wrath" },
    roundTick: { rowAheadDmg: 2 },
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
    name: "SkullDrake",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 4,
    dmg: 11,
    hits: 1,
    hp: 10,
    sp: 9,
    shields: 0,
    keywords: {},
    tribe: "Skeleton",
  },
  {
    id: "gale_toxhawk_tok",
    art: "gale_toxhawk",
    name: "ToxHawk",
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
    id: "gale_owlly",
    art: "owlette",
    name: "Owlly",
    rarity: "rare",
    element: "GALE",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 2,
    dmg: 2,
    hits: 1,
    hp: 2,
    sp: 11,
    shields: 0,
    keywords: { FLYING: true },
    tribe: "Avian",
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

// Element-pair decks. Each card appears once (once-per-game rule). LEAF is
// ≥50% of the leaf_pyro deck, so its Photosynthesis aura is active there.
const deckFor = (...els: string[]): string[] =>
  CARDS.filter((c) => els.includes(c.element)).map((c) => c.id);

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
  { id: "gale", name: "Griffith", element: "GALE", cards: deckFor("GALE") },
  { id: "bolt", name: "Elecdroid", element: "BOLT", cards: deckFor("BOLT") },
  { id: "dusk", name: "Shadow Horsemen", element: "DUSK", cards: deckFor("DUSK") },
  { id: "bore", name: "The DEEPEST", element: "BORE", cards: deckFor("BORE") },
];

export function coreById(id: string): CoreDef {
  return CORES.find((c) => c.id === id) ?? CORES[0];
}

/** Combine two cores into a pairing deck (deduped — same core twice = mono). */
export function pairingCards(coreA: string, coreB: string): string[] {
  return [...new Set([...coreById(coreA).cards, ...coreById(coreB).cards])];
}

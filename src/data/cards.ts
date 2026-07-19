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
    cost: 4,
    dmg: 7,
    hits: 1,
    hp: 13,
    sp: 8,
    shields: 1,
    keywords: { LIFESTEAL: true },
    onHitStatus: { kind: "BLEED", duration: 2, power: 1 }, // Blood Bloom
    special: {
      name: "Siphoning Slash",
      cost: 3,
      handler: "strike",
      params: { dmg: 5, pen: 1, healSelf: 3, statusKind: "BLEED", statusPower: 3, statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 5 DMG (PEN) and apply BLEED 3 for 2 rounds. Heal self 3 HP.",
    },
  },
  {
    id: "leaf_stickviper",
    name: "StickViper",
    rarity: "rare",
    element: "LEAF",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 3,
    sp: 10,
    shields: 0,
    keywords: {},
    tribe: "Reptile", // fed by Trinezer's Brood Command
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
    hp: 17,
    sp: 4,
    shields: 0,
    keywords: { REGEN: 2 }, // Canopy: REGEN 2 at end of round
  },
  {
    id: "leaf_alpha",
    name: "Alpha",
    rarity: "rare",
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
    vsStatus: { status: "ROOT", lifesteal: true },
    // Demoted Epic→Rare: Takedown becomes a one-shot Talent (free, once per game)
    // instead of a repeatable SP-cost Special.
    special: {
      name: "Takedown",
      cost: 0,
      talent: true,
      handler: "strike",
      params: { dmg: 6, statusKind: "ROOT", statusDuration: 3 },
      targetSide: "enemy",
      text: "Talent (once per game): tackle an opponent for 6 DMG and ROOT them for 3 rounds.",
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
    cost: 4,
    dmg: 4,
    hits: 1,
    hp: 23,
    sp: 3,
    shields: 0,
    keywords: {},
    // Regenerative: at end of round, +1 shield per enemy hit taken (capped at 5).
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
    hp: 7,
    sp: 5,
    shields: 0,
    keywords: {},
    onHitStatus: { kind: "BLEED", duration: 1, power: 1 }, // Stinging Barbs
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
    // Transfusion (On Hit by Melee): apply BLEED 2 to the attacker (stacks), and
    // heal Thorn each round for the total BLEED damage dealt to its enemies at
    // Cleanup (own + teammate BLEED — the team's BLEED cluster fuels Thorn).
    onHitByMelee: { status: { kind: "BLEED", duration: 2, power: 2 } },
    healsFromBleed: true,
    special: {
      name: "Blood on the Petals",
      cost: 3,
      handler: "strike",
      params: { dmg: 7, pen: 1, statusKind: "BLEED", statusPower: 5, statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 7 DMG (PEN) and apply BLEED 5 to the target.",
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
    hp: 20,
    sp: 10,
    shields: 2,
    keywords: {},
    // Incinerate: consecutive hits on the same target this round ramp +1 DMG/hit.
    incinerate: true,
    special: {
      name: "Pyro Ball Barrage",
      cost: 3,
      handler: "barrage",
      params: { dmg: 3, targets: 4 },
      targetSide: "enemy",
      text: "Deal 3 DMG to up to 4 opponents.",
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
    dmg: 5,
    hits: 1,
    hp: 11,
    sp: 9,
    shields: 0,
    keywords: {},
    // Burnout (On Death): 4 DMG to the enemy row directly ahead.
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
    cost: 4,
    dmg: 3,
    hits: 2,
    hp: 17,
    sp: 7,
    shields: 0,
    keywords: { FLYING: true },
    tribe: "Wolf",
    // Fury Unleashed: on summon, 3 DMG to the 3-wide row directly ahead
    // (melee → reaches one row forward, hitting left/mid/right).
    onSummon: { handler: "barrage", params: { dmg: 3, spread: 1, targets: 99 } },
    // On Kill: permanent +1 hit on the basic attack (stacks until Fenrir dies).
    onKill: { buffHits: 1 },
    special: {
      name: "Inferno Pounce",
      cost: 3,
      handler: "strike",
      params: { dmg: 8, statusKind: "BURN", statusPower: 4, statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 8 DMG and apply BURN 4 for 2 rounds.",
    },
  },
  {
    id: "pyro_tiki",
    name: "Tiki",
    rarity: "epic",
    element: "PYRO",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 3,
    dmg: 2,
    hits: 1,
    hp: 16,
    sp: 3,
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
    dmg: 5,
    hits: 1,
    hp: 7,
    sp: 8,
    shields: 0,
    keywords: {},
    // Fire Blast: on summon, blast the 3-wide corridor ahead (left/mid/right
    // columns), reaching forward across the battlefield (ranged).
    onSummon: { handler: "barrage", params: { dmg: 3, spread: 1, targets: 99 } },
  },
  {
    id: "pyro_spitfire",
    name: "Spitfire",
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
    rarity: "legendary",
    element: "PYRO",
    cardClass: "Assassin",
    attackType: "Melee",
    cost: 6, // LEGENDARY
    dmg: 11,
    hits: 1,
    hp: 21,
    sp: 8,
    shields: 0,
    keywords: { FLYING: true },
    // Bad Temper (passive): a landed basic attack grows Volcanon permanently.
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
    hp: 7,
    sp: 5,
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
    hp: 19,
    sp: 9,
    shields: 1,
    keywords: {},
    // Sandstorm (Aura): 1 DMG to all opponents each round.
    roundTick: { aoeDmg: 1 },
    // Nightmare (passive): his hits never wake sleepers; deal 2× DMG to SLEEPING
    // opponents; and a flat mid-lane bonus added ONCE to the total (not per hit).
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
    dmg: 3,
    hits: 3,
    hp: 10,
    sp: 8,
    shields: 1,
    keywords: { CRIT: true },
    statusImmune: true, // Krysteellized Field: immune to negative statuses
    special: {
      name: "Krystal Rain",
      cost: 2,
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
    hp: 11,
    sp: 5,
    shields: 1,
    keywords: {},
    // Reforged (On Summon): give allies in the row directly ahead +2 shields.
    onSummon: { handler: "grantShield", params: { amount: 2 }, targetSide: "ally" },
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
    hp: 6,
    sp: 6,
    shields: 2,
    keywords: {},
    // Cave Guard (On Opp enter battlefield): deal 4 DMG to a newcomer summoned
    // within Rock Goblin's (melee) range — gated by canTarget in the SUMMON reducer.
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
    tribe: "Dark",
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
    tribe: "Dark",
    onDeath: { dmg: 10, pen: true }, // Lingering Venom: 10 DMG PEN to the killer
  },
  {
    id: "dusk_vamp",
    name: "Vamp",
    rarity: "rare",
    element: "DUSK",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hits: 1,
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
    onHitStatus: { kind: "FRIGHTEN", duration: 1, power: 0, firstHitOnly: true },
  },
  {
    id: "dusk_ghastly",
    name: "Ghastly",
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
    tribe: "Ghost",
    special: {
      name: "Phantom Gouge",
      cost: 2,
      handler: "barrage",
      // printed "3 DMG PEN to all opponents in range"
      params: { dmg: 3, targets: 99, pen: 1 },
      targetSide: "enemy",
      text: "Deal 3 DMG (PEN) to every opponent in range.",
    },
    // Ethereal Trade (On Attack): +3 DMG per attack — basic AND Phantom Gouge —
    // at the cost of 2 HP each time.
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
    tribe: "Ghost",
    // Frightening (On Hit, first time only): FRIGHTEN the target for 1 round.
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
    dmg: 3,
    hits: 1,
    hp: 7,
    sp: 5,
    shields: 0,
    keywords: {},
    tribe: "Dark",
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
    dmg: 5,
    hits: 1,
    hp: 7,
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
    cost: 4,
    dmg: 4,
    hits: 1,
    hp: 16,
    sp: 8,
    shields: 1,
    // Shadow Step: STEALTH until first attack each round — exactly the
    // alpha STEALTH keyword.
    keywords: { CRIT: true, STEALTH: true },
    // Dark Hunting: the doc's version is a trap (mark an enemy home slot; ROOT +
    // LIFESTEAL when a card enters it). Traps aren't modeled, so this is the
    // immediate payoff — strike a target, ROOT it, and LIFESTEAL the damage.
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
    dmg: 3,
    hits: 1,
    hp: 1,
    sp: 11,
    shields: 0,
    keywords: { FLYING: true },
    tribe: "Dark",
    onDeath: { dmg: 5 }, // Bird Bomb: explodes on whoever kills it
  },
  {
    id: "dusk_skelider",
    name: "Skelider",
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
    // Dismount: below 10 HP, deal 5 DMG, lose 5 SP and the Special (basic skeleton).
    onLowHp: { threshold: 10, dmg: 5, loseSp: 5, loseSpecial: true },
    special: {
      name: "Piercing Charge",
      cost: 4,
      handler: "strike",
      // printed "Move up to 4 and deal 15 PEN" — ranged reach + charge advance
      params: { dmg: 15, pen: 1, charge: 4 },
      ranged: true,
      targetSide: "enemy",
      text: "Charge up to 4 slots and deal 15 DMG (PEN) to one opponent.",
    },
  },

  // ───────────────────────── AQUA ─────────────────────────
  // Element-locked: FREEZE (SP 0 + half DMG) and SCALD (DOT). Aura deferred.
  {
    id: "aqua_spinefin",
    name: "Spinefin",
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
    onHitStatus: { kind: "SCALD", duration: 2, power: 2 },
  },
  {
    id: "aqua_bulletshrimp",
    name: "Bullet Shrimp",
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
    dmg: 4,
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
    tribe: "Avian",
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
    attackType: "Melee",
    cost: 4,
    dmg: 5,
    hits: 1,
    hp: 19,
    sp: 6,
    shields: 0,
    keywords: {},
    tribe: "Pirate",
    // King of the Seas (On Kill): coin flip — gain +2 or +1 DMG permanently.
    onKill: { coinBonusDmg: 2 },
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
    tribe: "Dragon",
    // Vaporizer (On Kill): +1 SP and +1 DMG permanently. (Doc also pokes the
    // lowest-HP enemy + repositions — those halves aren't modeled yet.)
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
    cost: 2,
    dmg: 6,
    hits: 1,
    hp: 12,
    sp: 2,
    shields: 0,
    // Thick Hide: −1 DMG from every incoming attack (flat, applies pre-shield
    // and even to PEN) — that's exactly what BLOCK does.
    keywords: { BLOCK: 1 },
  },
  {
    id: "dawn_star",
    name: "Star",
    rarity: "epic",
    element: "DAWN",
    cardClass: "Mage",
    attackType: "Ranged",
    cost: 3,
    dmg: 2,
    hits: 2,
    hp: 9,
    sp: 7,
    shields: 2,
    keywords: { FLYING: true },
    // Raising Star (End of Round): BLIND all opponents. (Doc also heals allies
    // +1 on basic attacks — the attack-heal half isn't modeled yet.)
    roundTick: { aoeStatus: { kind: "BLIND", duration: 1, power: 0 } },
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
      params: { dmg: 2, hits: 4, targets: 99, statusKind: "BLIND", statusDuration: 1 },
      targetSide: "enemy",
      text: "Deal 2 DMG × 4 and BLIND every opponent in range for 1 round.",
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
    cost: 1,
    dmg: 4,
    hits: 1,
    hp: 5,
    sp: 6,
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
    cost: 2,
    dmg: 3,
    hits: 1,
    hp: 5,
    sp: 12,
    shields: 0,
    keywords: {},
    // Omega Restore (On Kill): heal +2 HP per opponent killed.
    onKill: { healSelf: 2 },
  },
  {
    id: "gale_hawk",
    name: "Hawk",
    rarity: "epic",
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
    highSpeedImpact: true,
    // Wind Surge (Talent, free · once per game): gain +2 SP. (The "next basic
    // hits +1 adjacent target" rider is unmodeled.)
    talent: {
      name: "Wind Surge",
      text: "Gain +2 SP. (Next basic attack would hit +1 adjacent target.)",
      handler: "empower",
      params: { selfSp: 2 },
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
    rarity: "legendary",
    element: "GALE",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 6, // LEGENDARY
    dmg: 4,
    hits: 2,
    hp: 22,
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
    hp: 22,
    sp: 13,
    shields: 1,
    keywords: {},
    // Harsh Winds: +4 DMG on the first strike vs each opponent.
    firstStrikeBonus: 4,
    special: {
      name: "Tranq Feather Blade",
      cost: 2,
      handler: "strike",
      params: { dmg: 10, pen: 1, statusKind: "STUN", statusDuration: 3 },
      targetSide: "enemy",
      text: "Deal 10 DMG (PEN) and STUN the target for 3 rounds.",
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
    onHitStatus: { kind: "PARALYZE", duration: 1, power: 0, chance: 50 },
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
    onKill: { extendStatus: { kind: "PARALYZE", rounds: 1 } },
    special: {
      name: "Discharge",
      cost: 2,
      handler: "barrage",
      // printed "3×1 DMG and PARALYZE all opponents" — 3 hits of 1 per target
      params: { dmg: 1, hits: 3, targets: 99, statusKind: "PARALYZE", statusDuration: 1 },
      targetSide: "enemy",
      text: "Deal 1 DMG × 3 and PARALYZE every opponent in range for 1 round.",
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
      cost: 2,
      handler: "barrage",
      // printed "2×3 DMG and PARALYZE all opponents" — 2 hits of 3 per target
      params: { dmg: 3, hits: 2, targets: 99, statusKind: "PARALYZE", statusDuration: 1 },
      targetSide: "enemy",
      text: "Deal 3 DMG × 2 and PARALYZE every opponent in range for 1 round.",
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
      params: { dmg: 8, charge: 2 },
      ranged: true,
      targetSide: "enemy",
      text: "Charge up to 2 slots and deal 8 DMG to one opponent.",
    },
  },
  {
    id: "bolt_jackarc",
    name: "Jack Arc",
    rarity: "legendary",
    element: "BOLT",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 8, // LEGENDARY
    dmg: 3,
    hits: 2,
    hp: 26,
    sp: 12,
    shields: 3,
    keywords: {},
    // Static Electricity (Start of Round): PARALYZE an un-paralyzed enemy 2r.
    roundTick: { paralyzeOne: 2 },
    // Overclock (Aura): BOLT allies gain +2 SP. (Doc scopes it to the ARC tribe;
    // ARC isn't tagged on the BOLT cards yet, so element scope is the stand-in.)
    aura: { scope: "element", sp: 2 },
    special: {
      name: "StunGun",
      cost: 3,
      handler: "barrage",
      params: { dmg: 4, targets: 3, statusKind: "PARALYZE", statusDuration: 3 },
      targetSide: "enemy",
      text: "Blast up to 3 targets for 4 DMG and PARALYZE for 3 rounds.",
    },
  },
  {
    id: "bolt_voltogon",
    name: "Voltogon",
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
      params: { dmg: 11, onKillSelfStatus: "STEALTH", onKillSelfStatusDuration: 2 },
      targetSide: "enemy",
      ranged: true, // reaches the lowest-HP opponent anywhere
      text: "Deal 11 DMG to a target (aim the lowest-HP); if it dies, gain STEALTH until end of next round.",
    },
  },
  {
    id: "pyro_pyrogon",
    name: "Pyrogon",
    rarity: "mythic",
    element: "PYRO",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 10,
    dmg: 13,
    hits: 1,
    hp: 42,
    sp: 7,
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
      params: { dmg: 7, spread: 1, forwardDepth: 2, targets: 99, statusKind: "BURN", statusDuration: 3, statusPower: 3 },
      targetSide: "enemy",
      text: "Deal 7 DMG + BURN 3 to the 3 opponents directly ahead and the row behind them (2 rows deep). 3-round cooldown.",
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
    onLowHp: { threshold: 17, buffDmg: 3, buffSp: 3, gainShields: 3 },
    // Aura: SeaC allies gain +4 max HP.
    aura: { scope: "tribe", match: "SeaC", maxHp: 4 },
    special: {
      name: "Black Wave Crash",
      cost: 4,
      handler: "barrage",
      // Lose 5 HP (can dip Kraken into From the Deep), 8 DMG to all, −accuracy
      // via BLIND for 2 rounds.
      params: { dmg: 8, targets: 99, statusKind: "BLIND", statusDuration: 2, selfDamage: 5 },
      targetSide: "enemy",
      text: "Lose 5 HP. Deal 8 DMG to all opponents and BLIND them 2 rounds (water in their eyes).",
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
      params: { token: "dawn_heir_tok", count: 1 },
      targetSide: "ally", // no enemy target needed; always castable
      text: "Spawn Heir (10/10/2🛡/SP10) in an open slot. Crowned: cleanses allies each round. 3-round cooldown.",
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
      params: { dmg: 27, splash: 11, recoilPct: 10, selfStatus: "STEALTH", selfStatusDuration: 1 },
      targetSide: "enemy",
      text: "Deal 27 DMG (+11 splash) and take 10% recoil, then vanish into STEALTH until next round. 3-round cooldown.",
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
    sp: 13,
    shields: 0,
    keywords: {},
    // Blood Ruby: DUSK allies' basic attacks gain PEN.
    aura: { scope: "element", pen: true },
    special: {
      name: "Shadow Charge",
      cost: 5,
      cooldown: 3, // charge nuke + EVASION escape — 3-round lockout between casts
      handler: "strike",
      params: { dmg: 19, splash: 9, statusKind: "DOT", statusDuration: 1, statusPower: 9, selfStatus: "EVASION", selfStatusDuration: 1, charge: 4 },
      targetSide: "enemy",
      ranged: true, // the dive reaches across the board
      text: "Charge up to 4 spaces, deal 19 DMG + 9 DOT (+9 splash), and gain EVASION for a round. 3-round cooldown.",
    },
  },
  {
    id: "bore_deepest",
    art: "bore_the_deepest",
    name: "The DEEPEST",
    rarity: "mythic",
    element: "BORE",
    cardClass: "Warrior",
    attackType: "Melee", // a Warrior fights up close; the ranged reach lives on the Special
    cost: 10,
    dmg: 9,
    hits: 1,
    hp: 37,
    sp: 5,
    shields: 8,
    keywords: { STEALTH: true }, // Abyssal Emergence — hidden until it attacks
    tribe: "Cavernous",
    // Pressure: BORE allies are topped up to +1 shield each round.
    aura: { scope: "element", shields: 1 },
    special: {
      name: "Drilling Quake",
      cost: 5,
      cooldown: 3, // Sinkhole is a heavy AoE — 3-round lockout between casts
      handler: "barrage",
      ranged: true, // "Sinkhole all opponents" reaches the whole board (basic is Melee now)
      // Sinkhole: DOT 3 (maybeStatus) + −5 SP (spDebuff) + −accuracy via BLIND
      // (debuffStatus) — all for 3 rounds.
      params: {
        dmg: 3, targets: 99,
        statusKind: "DOT", statusDuration: 3, statusPower: 3,
        spDebuff: 5, spDebuffRounds: 3,
        debuffStatus: "BLIND", debuffStatusRounds: 3,
        selfStatus: "STEALTH", selfStatusDuration: 1, // slips back underground after the quake
      },
      targetSide: "enemy",
      text: "Sinkhole all opponents in range — DOT 3, −5 SP, −50% accuracy for 3 rounds — then re-STEALTH. 3-round cooldown.",
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
    dmg: 2,
    hits: 1,
    hp: 14,
    sp: 4,
    shields: 0,
    keywords: {},
    // Needles (On Hit by Melee): deal 1 DMG back to the attacker.
    onHitByMelee: { dmg: 1 },
  },
  {
    id: "pyro_baboom",
    name: "BaBoom",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 2,
    dmg: 5,
    hits: 1,
    hp: 10,
    sp: 5,
    shields: 0,
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
    onHitStatus: { kind: "FREEZE", duration: 1, power: 0, chance: 50 },
  },
  {
    id: "dawn_sparkle",
    name: "Sparkle",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Ranger",
    attackType: "Ranged",
    cost: 1,
    dmg: 2,
    hits: 2,
    hp: 2,
    sp: 14,
    shields: 0,
    keywords: {},
    // Fickle Wand: basic attacks have a 25% chance to BLIND for 1 round.
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
    dmg: 1,
    hits: 3,
    hp: 8,
    sp: 8,
    shields: 0,
    keywords: {},
    // Shocker: PARALYZE an opponent summoned within DrShock's range for 1 round.
    onOppSummon: { status: { kind: "PARALYZE", duration: 1, power: 0 } },
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
    cost: 2,
    dmg: 4,
    hits: 1,
    hp: 10,
    sp: 4,
    shields: 1,
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
    tribe: "SeaC", // fed by Kraken's SeaC aura (+4 max HP)
    // On Kill: +3 max HP permanently. (Sucker Sword's target-pull is unmodeled.)
    onKill: { buffMaxHp: 3 },
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
    tribe: "Kraken",
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
    hp: 6,
    sp: 5,
    shields: 2,
    keywords: {},
    // Tusk Rush (On Summon): charge — 5 DMG to opponents directly ahead.
    // (The "keep charging on each kill" follow-up is unmodeled.)
    onSummon: { handler: "barrage", params: { dmg: 5, spread: 1, forwardDepth: 1, targets: 99 } },
  },

  // ───────────────────────── GALE ─────────────────────────
  {
    id: "gale_whirlwolf",
    name: "Whirlwolf",
    rarity: "epic",
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
    tribe: "Avian",
    // Hastening Breeze (On Summon): +5 SP to all allies (the whole team). Doc's
    // "for a round" temporality isn't modeled — the SP grant is permanent.
    onSummon: { handler: "buffSp", params: { amount: 5, allAllies: 1 }, targetSide: "ally" },
    special: {
      name: "Wave Pounce",
      cost: 2,
      handler: "barrage",
      params: { dmg: 2, targets: 99, spDebuff: 3, spDebuffRounds: 1 },
      targetSide: "enemy",
      text: "Deal 2 DMG to all opponents and −3 SP for the round.",
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
    hits: 2, // "2×3 DMG"
    hp: 11,
    sp: 8,
    shields: 0,
    keywords: { FLYING: true },
    tribe: "Avian",
    // Aerial Dominance: 1 DMG to any opponent summoned within range.
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
    onSummon: { handler: "barrage", params: { dmg: 5, targets: 99 } },
    special: {
      name: "Arcing Strike",
      cost: 2,
      handler: "strike",
      // 7 to the target, arcing 7 to each adjacent opponent (splash).
      params: { dmg: 7, splash: 7 },
      targetSide: "enemy",
      text: "Deal 7 DMG to a target and 7 DMG to each adjacent opponent.",
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
    cost: 3,
    dmg: 7,
    hits: 1,
    hp: 9,
    sp: 9,
    shields: 0,
    keywords: {},
    tribe: "Skeleton",
    // Soul Reaper (On Kill): +5 HP, +1 DMG permanently.
    // (The doc's "CRIT for a turn" and Death's Approach reuse-on-kill are unmodeled.)
    onKill: { healSelf: 5, buffDmg: 1 },
    special: {
      name: "Death's Approach",
      cost: 2,
      handler: "strike",
      params: { dmg: 8, pen: 1 },
      targetSide: "enemy",
      text: "Deal 8 DMG (PEN) to an opponent.",
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
    tribe: "Skeleton",
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
    cost: 1,
    dmg: 2,
    hits: 2, // "2×2 DMG"
    hp: 4,
    sp: 7,
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
    dmg: 8,
    hits: 1,
    hp: 13,
    sp: 9,
    shields: 0,
    keywords: {},
    // Burning Ashes (On Death): revive once at 1 HP. (Doc also grants +4 shields
    // and a skipped turn on revive — not modeled.)
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
    hp: 13,
    sp: 6,
    shields: 1,
    keywords: {},
    special: {
      name: "Rolling Bash",
      cost: 2,
      handler: "strike",
      params: { dmg: 3, hits: 3 },
      targetSide: "enemy",
      // (Rover — move up to 2 after attacking — is unmodeled.)
      text: "Deal 3×3 DMG to an opponent.",
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
    // Deathroll (On Death): deal 5 DMG to the attacker.
    onDeath: { dmg: 5 },
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
    healPerHit: 1,
    special: {
      name: "Tsunami",
      cost: 3,
      handler: "barrage",
      params: { dmg: 6, targets: 99, spDebuff: 3, spDebuffRounds: 1 },
      targetSide: "enemy",
      text: "Deal 6 DMG to all opponents and −3 SP for the round.",
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
    keywords: {},
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
    rarity: "rare",
    element: "BOLT",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 2,
    dmg: 2,
    hits: 1,
    hp: 16,
    sp: 2,
    shields: 0,
    keywords: {},
    // Electric Pulse (End of Round): 1 DMG to all opponents. (Doc's one-round
    // ally +DMG boost isn't modeled.)
    roundTick: { aoeDmg: 1 },
  },
  {
    id: "dusk_scarlett",
    name: "Scarlett",
    rarity: "epic",
    element: "DUSK",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 3,
    dmg: 2,
    hits: 2,
    hp: 10,
    sp: 11,
    shields: 0,
    keywords: { DRAIN: true }, // Bloody Bite
    tribe: "Vamp",
    special: {
      name: "Bat Swarm",
      cost: 2,
      handler: "barrage",
      // (Doc's 75% per-target hit chance isn't modeled — it lands on all.)
      params: { dmg: 2, targets: 99 },
      targetSide: "enemy",
      text: "Deal 2 DMG to all opponents.",
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
    hp: 22,
    sp: 4,
    shields: 5,
    keywords: {},
    // Basic attacks entangle: ROOT the target (SP→0, can't move) for a round.
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
    dmg: 8,
    hits: 1,
    hp: 22,
    sp: 5,
    shields: 5,
    keywords: {},
    // Feeds on the slain: each kill grants a permanent +2 DMG.
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
    dmg: 4,
    hits: 1,
    hp: 21,
    sp: 6,
    shields: 7,
    keywords: {},
    // Radiant Ward: each round the whole team gains a barrier that absorbs the
    // next negative status.
    roundTick: { wardAllies: true },
    special: {
      name: "Dawn's Rally",
      cost: 4,
      handler: "heal",
      params: { targets: 99, amount: 5, buffDmg: 2, buffRounds: 2 },
      targetSide: "ally",
      text: "Heal all allies 5 HP and grant them +2 DMG for 2 rounds.",
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
    highSpeedImpact: true,
    special: {
      name: "Cyclone Strike",
      cost: 3,
      handler: "strike",
      params: { dmg: 8, charge: 3, pen: 1 },
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
    dmg: 7,
    hits: 1,
    hp: 24,
    sp: 6,
    shields: 4,
    keywords: { LIFESTEAL: true },
    special: {
      name: "Soul Drain",
      cost: 4,
      handler: "drainMax",
      // Permanently steal 6 max HP, then slip into STEALTH (selfStatus rider,
      // untargetable until it next attacks).
      params: { amount: 6, selfStatus: "STEALTH", selfStatusDuration: 2 },
      targetSide: "enemy",
      text: "Steal 6 max HP from an opponent, then slip into STEALTH until you next attack.",
    },
  },
  {
    id: "bore_bastion",
    name: "Bastion",
    rarity: "legendary",
    element: "BORE",
    cardClass: "Tank",
    attackType: "Melee",
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
    keywords: {},
    // Radiation (End of Round): 2 DMG PEN (bypasses shields) to every opponent in range.
    roundTick: { inRangeDmg: 2, inRangeDmgPen: true },
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
    // Boon Striker (On Summon): strike a reachable opponent for 7 and sap its NEXT
    // basic attack by 2 (a flat, statusless debuff).
    onSummon: { handler: "strike", params: { dmg: 7, nextAtkDebuff: 2 }, targetSide: "enemy" },
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
    // Always CRITs (keyword). Icy Mist (On Summon): cloak in STEALTH for 2 rounds,
    // extended +1 round for each kill made while cloaked.
    keywords: { CRIT: true },
    onSummon: { selfStatus: "STEALTH", selfStatusDuration: 2, extendSelfStatusOnKill: 1 },
  },
  {
    id: "pyro_ingit",
    name: "Ingit",
    rarity: "rare",
    element: "PYRO",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 2,
    dmg: 3,
    hits: 1,
    hp: 13,
    sp: 4,
    shields: 0,
    keywords: {},
    // Hot Hot (On Hit by Melee): double the BURN stacked on the attacker.
    onHitByMelee: { doubleBurn: true },
  },
  {
    id: "dawn_glime",
    name: "Glime",
    rarity: "rare",
    element: "DAWN",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 1,
    dmg: 2,
    hits: 1,
    hp: 8,
    sp: 5,
    shields: 0,
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
    hp: 8,
    sp: 13, // SP-heavy flyer — sits above the stat curve (budget-test exempt)
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
    dmg: 3,
    hits: 1,
    hp: 7,
    sp: 5,
    shields: 0,
    keywords: {},
    tribe: "Zombie",
    // Reanimation (On Death): comes back on every death, each time −1 to all stats,
    // until a stat would hit 0 — then it stays down.
    onRevive: { heal: 7, decay: 1 },
  },
  {
    id: "bolt_buzz",
    name: "Buzz",
    rarity: "rare",
    element: "BOLT",
    cardClass: "Tank",
    attackType: "Melee",
    cost: 2,
    dmg: 2,
    hits: 1,
    hp: 11,
    sp: 7,
    shields: 0,
    keywords: {},
    // Electro Shield (On Summon): +1 barrier; when it BREAKS, PARALYZE the attacker
    // that shattered it for 1 turn.
    summonSelfShields: 1,
    onShieldBreak: { status: { kind: "PARALYZE", duration: 1, power: 0 } },
  },
];

// ── Tokens ───────────────────────────────────────────────────────────────────
// Spawned by cards (Trinezer's Reptilian Screech, etc.), never dealt from a deck.
// Kept OUT of CARDS so decks + the cost-formula test ignore them; merged into
// CARD_INDEX below so getDef resolves them.
export const TOKENS: CardDef[] = [
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
    hp: 3,
    sp: 3,
    shields: 0,
    keywords: {},
    tribe: "Reptile",
    // Conspiracy (On Kill): +2 DMG, +2 HP (max), +2 SP.
    onKill: { buffDmg: 2, buffMaxHp: 2, buffSp: 2 },
  },
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
    onKill: { reduceSpecialCost: 1 },
    special: {
      name: "Crowned",
      cost: 3,
      handler: "empower",
      params: { selfDmg: 5, selfMaxHp: 5, selfSp: 5 },
      targetSide: "ally", // self-buff; always castable
      text: "Gain +5 DMG, +5 HP, +5 SP permanently.",
    },
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

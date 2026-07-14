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
    special: {
      name: "Takedown",
      cost: 1,
      handler: "strike",
      params: { dmg: 6, statusKind: "ROOT", statusDuration: 3 },
      targetSide: "enemy",
      cooldown: 0, // "no cooldown"
      text: "Tackle an opponent for 6 DMG and ROOT them for 3 rounds.",
    },
  },
  {
    id: "leaf_fallona",
    name: "Fallona",
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
    // NOTE: Regenerative (On Hit → +1 shield next round, max 5) not yet modeled
    // (no on-hit self-buff hook).
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
      params: { statusKind: "BURN", statusPower: 3, statusDuration: 2, targets: 3 },
      targetSide: "enemy",
      text: "Apply BURN 3 for 2 rounds to up to 3 opponents.",
    },
  },
  {
    id: "pyro_flamehound",
    name: "Flamehound",
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
    // Spit Shot (On Summon): 3 DMG straight ahead down its own column, up to 2 spaces.
    onSummon: { handler: "barrage", params: { dmg: 3, spread: 0, forwardDepth: 2, targets: 99 } },
  },
  {
    id: "pyro_volcanon",
    name: "Volcanon",
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
    // Nightmare (passive): his hits never wake sleepers; and after a basic
    // attack a flat bonus is added ONCE to the total (not per hit).
    ignoresSleepWake: true,
    basicBonus: { midLane: 2, midLaneFull: 3, vsSleeping: 5 },
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
    special: {
      name: "Rigid Smash",
      cost: 3,
      handler: "barrage",
      // printed "9 DMG and SLEEP 2 opponents in the row ahead"
      params: { dmg: 6, targets: 2, statusKind: "SLEEP", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 6 DMG and SLEEP up to 2 opponents for 2 rounds.",
    },
  },
  {
    id: "bore_rockgoblin",
    name: "Rock Goblin",
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
  },
  {
    id: "bore_bearocks",
    name: "Bearocks",
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
    onDeath: { dmg: 10, pen: true }, // Lingering Venom: 10 DMG PEN to the killer
  },
  {
    id: "dusk_vamp",
    name: "Vamp",
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
  },
  {
    id: "dusk_gool",
    name: "Gool",
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
    // Spook (On Hit, first time only): FRIGHTEN the opponent.
    onHitStatus: { kind: "FRIGHTEN", duration: 1, power: 0, firstHitOnly: true },
  },
  {
    id: "dusk_ghastly",
    name: "Ghastly",
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
    ignoresHomeRule: true, // Catapult: can target the whole battlefield
  },
  {
    id: "dusk_skeleton_knight",
    name: "Skeleton Knight",
    element: "DUSK",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 2, // stat total 20 → cost 2 (Bone Shield's +3 is a passive grant)
    dmg: 5,
    hits: 1,
    hp: 7,
    sp: 8,
    shields: 3, // Bone Shield
    keywords: {},
  },
  {
    id: "leaf_darth",
    name: "Darth",
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
    // alpha STEALTH keyword. (Dark Hunting is trap-like — out of alpha scope.)
    keywords: { CRIT: true, STEALTH: true },
  },
  {
    id: "dusk_crow",
    name: "Crow",
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
    onDeath: { dmg: 5 }, // Bird Bomb: explodes on whoever kills it
  },
  {
    id: "dusk_skelider",
    name: "Skelider",
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
  },
  {
    id: "aqua_bulletshrimp",
    name: "Bullet Shrimp",
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
  },
  {
    id: "aqua_vaporem",
    name: "Vaporem",
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
    // RayBeam: on summon, a single-lane blast that BLINDs down the column.
    onSummon: { handler: "barrage", params: { dmg: 3, spread: 0, statusKind: "BLIND", statusDuration: 2, targets: 99 } },
  },
  {
    id: "dawn_flash",
    name: "Flash",
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
    id: "dawn_star",
    name: "Star",
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
    // Raising Star (End of Round): BLIND the closest opponent. (Doc also heals
    // allies +1 on basic attacks — the attack-heal half isn't modeled yet.)
    roundTick: { pokeStatus: { kind: "BLIND", duration: 1, power: 0 } },
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
      params: { amount: 4, targets: 3 },
      targetSide: "ally",
      text: "Heal up to 3 allies 4 HP.",
    },
  },
  {
    id: "dawn_dawn",
    name: "Dawn",
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
    // Hot Shot (On Kill): +1 DMG for the rest of the round. (Doc also grants
    // always-hit / ignore-EVASION — not modeled yet.)
    onKill: { buffDmgRound: 1 },
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
  },
  {
    id: "gale_vaga",
    name: "Vaga",
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
    special: {
      name: "Extinguisher",
      cost: 1,
      handler: "strike",
      params: { dmg: 8, pen: 1 },
      targetSide: "enemy",
      text: "Deal 8 DMG (PEN) — a finisher for low-HP targets.",
    },
  },
  {
    id: "gale_buf",
    name: "Buf",
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
    element: "GALE",
    cardClass: "Warrior",
    attackType: "Melee",
    cost: 4,
    dmg: 9,
    hits: 1,
    hp: 17,
    sp: 4,
    shields: 0,
    keywords: { CRIT: true },
    special: {
      name: "Whirlwind Slasher",
      cost: 3,
      handler: "barrage",
      params: { dmg: 5, targets: 99 },
      targetSide: "enemy",
      ranged: true, // "5 DMG to all opponents" — reaches the whole board
      text: "Deal 5 DMG to every opponent in range.",
    },
  },
  {
    id: "gale_galeon",
    name: "Galeon",
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
    // Precision Strike: vs a PARALYZED opponent, basic attacks CRIT and heal +4.
    vsStatus: { status: "PARALYZE", crit: true, healOnHit: 4 },
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
    special: {
      name: "Static Blaster",
      cost: 2,
      handler: "barrage",
      params: { dmg: 5, targets: 99 },
      targetSide: "enemy",
      text: "Deal 5 DMG to every opponent in range.",
    },
  },
  {
    id: "bolt_thundercat",
    name: "ThunderCat",
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
    // Powertrip (On Kill): 5 DMG to all enemies (doc: "Electrified" enemies —
    // approximated to all, since the Electrified mark isn't modeled yet).
    onKill: { aoeDmg: 5 },
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
    // Reptilian Screech (End of Round): spawn 1 Reptilian into an open king's-
    // reach slot; no spawn if none is open.
    roundTick: { spawn: { token: "leaf_reptilian_tok", count: 1, adjacentOnly: true } },
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
    // On Summon: a free Flame Engulf (BURN straight ahead, 3 deep).
    onSummon: {
      handler: "barrage",
      params: { dmg: 7, spread: 0, forwardDepth: 3, targets: 99, statusKind: "BURN", statusDuration: 3, statusPower: 3 },
    },
    // On Kill: permanent +7 HP and +1 DMG.
    onKill: { buffMaxHp: 7, buffDmg: 1 },
    special: {
      name: "Flame Engulf",
      cost: 4,
      handler: "barrage",
      // A straight lane down its own column, up to 3 spaces ahead (spread 0).
      params: { dmg: 7, spread: 0, forwardDepth: 3, targets: 99, statusKind: "BURN", statusDuration: 3, statusPower: 3 },
      targetSide: "enemy",
      text: "Deal 7 DMG + BURN 3 to opponents in its own column, up to 3 spaces ahead.",
    },
    // Aura (Scorch BURN stacks) deferred.
  },
  {
    id: "aqua_kraken",
    name: "Kraken",
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
    // From the Deep: first time it drops to ≤8 HP, permanent +3 DMG/+3 SP/+3 shield.
    onLowHp: { threshold: 9, buffDmg: 3, buffSp: 3, gainShields: 3 },
    // Aura: SeaC allies gain +4 max HP.
    aura: { scope: "tribe", match: "SeaC", maxHp: 4 },
    special: {
      name: "Black Wave Crash",
      cost: 4,
      handler: "barrage",
      params: { dmg: 8, targets: 99, statusKind: "BLIND", statusDuration: 2 },
      targetSide: "enemy",
      text: "Deal 8 DMG to all opponents and BLIND them 2 rounds (water in their eyes).",
    },
    // The 5-HP self-cost on Black Wave Crash is deferred.
  },
  {
    id: "dawn_imperator",
    name: "Imperator",
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
    special: {
      name: "Strike of Dawn",
      cost: 5,
      handler: "spawn",
      params: { token: "dawn_heir_tok", count: 1 },
      targetSide: "ally", // no enemy target needed; always castable
      text: "Spawn Heir (10/10/2🛡/SP10) in an open slot.",
    },
    // Triple Sun auras (Order/Chaos/Crowned) deferred.
  },
  {
    id: "gale_griffith",
    name: "Griffith",
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
      handler: "strike",
      params: { dmg: 27, splash: 11, selfStatus: "STEALTH", selfStatusDuration: 1 },
      targetSide: "enemy",
      text: "Deal 27 DMG (+11 splash), then vanish into STEALTH until next round.",
    },
  },
  {
    id: "bolt_elecdroid",
    name: "Elecdroid",
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
      handler: "combo",
      // 5 → 5 → 5 → 10 combo; a kill chains to the next enemy and raises the
      // remaining hits +5 (that raise lasts only for this combo).
      params: { dmg: 5, hits: 4, finisherDmg: 10, killBoost: 5 },
      targetSide: "enemy",
      text: "5·5·5·10 combo on a target; on a kill, chain to the next enemy with +5 to the rest of the combo.",
    },
    // The on-Surge BOLT-ally aura is deferred.
  },
  {
    id: "dusk_shadowhorsemen",
    art: "dusk_shadow_horsemen",
    name: "Shadow Horsemen",
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
      handler: "strike",
      params: { dmg: 19, splash: 9, statusKind: "DOT", statusDuration: 1, statusPower: 9, selfStatus: "EVASION", selfStatusDuration: 1, charge: 4 },
      targetSide: "enemy",
      ranged: true, // the dive reaches across the board
      text: "Charge up to 4 spaces, deal 19 DMG + 9 DOT (+9 splash), and gain EVASION for a round.",
    },
  },
  {
    id: "bore_deepest",
    art: "bore_the_deepest",
    name: "The DEEPEST",
    element: "BORE",
    cardClass: "Support",
    attackType: "Ranged",
    cost: 10,
    dmg: 9,
    hits: 1,
    hp: 37,
    sp: 5,
    shields: 8,
    keywords: { STEALTH: true }, // Abyssal Emergence — hidden until it attacks
    tribe: "Cavernous",
    // Pressure: BORE allies are topped up to +2 shields each round.
    aura: { scope: "element", shields: 2 },
    special: {
      name: "Drilling Quake",
      cost: 5,
      handler: "barrage",
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
      text: "Sinkhole all opponents in range — DOT 3, −5 SP, −50% accuracy for 3 rounds — then re-STEALTH.",
    },
  },

  // ─────────────── EXPANSION: one more canon card per element ───────────────
  {
    id: "leaf_cactus",
    name: "Cactus",
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
    // Swinging Sweep (On Summon): 2 DMG to the row ahead and push each back 1.
    onSummon: { handler: "barrage", params: { dmg: 2, spread: 1, targets: 99, push: 1 } },
  },
  {
    id: "bore_cavedweller",
    name: "CaveDweller",
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
    // Webbed (On Summon): FRIGHTEN one opponent for 1 round.
    onSummon: { handler: "statusNova", params: { statusKind: "FRIGHTEN", statusDuration: 1, targets: 1 } },
  },
  {
    id: "aqua_subcool",
    name: "SubCool",
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
  },
  {
    id: "dawn_heir_tok",
    art: "dawn_heir",
    name: "Heir",
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

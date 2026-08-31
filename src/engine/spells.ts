// Spells — a one-time Prep-Phase effect (no stats, no slot), paid from the magic
// pool, once per game. This is the first slice: the Cost-1 "small damage / small
// support" spells for every element, plus the Cost-4 row "walls". The rest of the
// 1–10 curve (from Spells_All_Elements.md) is a follow-up.
//
// Canon rules put Spells in the same deck as Champions. For now each player gets a
// separate spellbook (spellbookFor) derived from the elements present in their
// deck — contained, and easy to migrate to same-deck later.

import { getDef } from "../data/cards";
import { loreForSpell } from "../data/lore";
import type { Element, SpellDef, SpellSlot } from "./types";

/** A custom spellbook holds at most this many spells (each castable once) on the
 *  STANDARD 4×4 board. */
export const MAX_SPELLBOOK = 5;
/** The large 5×5 board runs a deeper deck, so it also runs a deeper spellbook. */
export const MAX_SPELLBOOK_LARGE = 8;
/** Spellbook cap for a battlefield — the single source of truth for both the
 *  deck builder's picker and match setup. */
export function spellCapForBoard(boardSize = 4): number {
  return boardSize >= 5 ? MAX_SPELLBOOK_LARGE : MAX_SPELLBOOK;
}

export const SPELLS: SpellDef[] = [
  // ───────── Cost 1 — small damage / support ─────────
  {
    id: "leaf_sprout",
    name: "Sprout",
    element: "LEAF",
    cost: 1,
    kind: "heal",
    text: "Heal a LEAF ally 3 HP (5 if any opponent is ROOTed).",
    allyHeal: 3,
    allyHealIfRooted: 5,
  },
  {
    id: "pyro_spark",
    name: "Spark",
    element: "PYRO",
    cost: 1,
    kind: "damage",
    text: "Deal 3 DMG to a target and apply BURN 1 for 1 round.",
    dmg: 3,
    status: { kind: "BURN", duration: 1, power: 1 },
  },
  {
    id: "gale_gust",
    name: "Gust",
    element: "GALE",
    cost: 1,
    kind: "damage",
    text: "Deal 3 DMG to a target and push them back 1 space.",
    dmg: 3,
    push: 1,
  },
  {
    id: "dawn_sunbeam",
    name: "Sunbeam",
    element: "DAWN",
    cost: 1,
    kind: "damage",
    text: "Deal 3 DMG to a target and BLIND them for 1 round.",
    dmg: 3,
    status: { kind: "BLIND", duration: 1, power: 0 },
  },
  {
    id: "bore_pebble_toss",
    name: "Pebble Toss",
    element: "BORE",
    cost: 1,
    kind: "damage",
    text: "Deal 3 DMG to a target and give a BORE ally +1 shield.",
    dmg: 3,
    allyShield: 1,
  },
  {
    id: "dusk_chill_touch",
    name: "Chill Touch",
    element: "DUSK",
    cost: 1,
    kind: "damage",
    text: "Deal 3 DMG to a target and DRAIN 1 max HP to a DUSK ally.",
    dmg: 3,
    drainMaxHp: 1,
  },
  {
    id: "aqua_chill",
    name: "Chill",
    element: "AQUA",
    cost: 1,
    kind: "choice",
    // Modal: STRIKE a foe (3 DMG + FREEZE 1) OR SHIELD an AQUA ally (+4). The
    // caster picks the mode at cast; the ice-shard vs water-shield of the art.
    // +2, not +4. The shield half was worth more than Bulwark, the DEDICATED
    // shield spell two rungs up at cost 3 (+3), and more than Fortify at cost 5
    // (+2 to the whole team) — a cost-1 modal beating both on their own axis
    // while also carrying a strike mode. +2 keeps it the strongest rider on the
    // cost-1 rung (Pebble Toss gives +1) without outdoing the spells that exist
    // to do this.
    text: "Choose — strike a foe for 3 DMG + FREEZE 1, or shield an AQUA ally +2.",
    dmg: 3,
    status: { kind: "FREEZE", duration: 1, power: 0 },
    allyShield: 2,
  },
  {
    id: "bolt_zap",
    name: "Zap",
    element: "BOLT",
    cost: 1,
    kind: "damage",
    text: "Deal 3 DMG to a target and PARALYZE them for 2 rounds.",
    dmg: 3,
    status: { kind: "PARALYZE", duration: 2, power: 0 },
  },

  // ───────── Cost 4 — Walls (row-level, trigger on movement in) ─────────
  {
    id: "pyro_firewall",
    name: "Firewall",
    element: "PYRO",
    cost: 4,
    kind: "wall",
    text: "Set a row ablaze for 3 rounds. A card that MOVES into it takes 3 DMG and BURN 1. Ranged attacks and FLYING cards pass over.",
    wall: { dmg: 3, status: { kind: "BURN", duration: 1, power: 1 }, rounds: 3 },
  },
  {
    id: "leaf_bramble_wall",
    name: "Bramble Wall",
    element: "LEAF",
    cost: 4,
    kind: "wall",
    text: "Thorned vines across a row for 3 rounds. A card that MOVES in takes 2 DMG and is ROOTed 1 round. Ranged attacks and FLYING cards pass over.",
    wall: { dmg: 2, status: { kind: "ROOT", duration: 1, power: 0 }, rounds: 3 },
  },
  {
    id: "aqua_ice_wall",
    name: "Ice Wall",
    element: "AQUA",
    cost: 4,
    kind: "wall",
    text: "A wall of ice across a row for 3 rounds. A card that MOVES in takes 2 DMG and is FROZEN 1 round. Ranged attacks and FLYING cards pass over.",
    wall: { dmg: 2, status: { kind: "FREEZE", duration: 1, power: 0 }, rounds: 3 },
  },
  {
    id: "gale_squall_line",
    name: "Squall Line",
    element: "GALE",
    cost: 4,
    kind: "wall",
    text: "Violent wind across a row for 3 rounds. A card that MOVES in takes 2 DMG and is pushed back 1. Ranged attacks and FLYING cards pass over.",
    wall: { dmg: 2, push: 1, rounds: 3 },
  },
  {
    id: "bolt_overload_field",
    name: "Overload Field",
    element: "BOLT",
    cost: 4,
    kind: "wall",
    text: "Charge a row with current for 3 rounds. A card that MOVES in takes 2 DMG and is PARALYZED 2 rounds. Ranged attacks and FLYING cards pass over.",
    wall: { dmg: 2, status: { kind: "PARALYZE", duration: 2, power: 0 }, rounds: 3 },
  },
  {
    id: "bore_stone_wall",
    name: "Stone Wall",
    element: "BORE",
    cost: 4,
    kind: "wall",
    text: "Wall of stone across your OWN Home row for 3 rounds. A card that MOVES in loses 1 shield then takes 3 DMG. BORE allies in the row gain BLOCK 2. Ranged attacks and FLYING cards pass over.",
    wall: { dmg: 3, stripShields: 1, ownHomeOnly: true, allyBuff: { block: 2 }, rounds: 3 },
  },
  {
    id: "dusk_veil_of_shadows",
    name: "Veil of Shadows",
    element: "DUSK",
    cost: 4,
    kind: "wall",
    // 3 rounds, like every other Cost-4 wall. It was the only one of the eight at
    // 2 — a third of the duration gone at the same price, with nothing raised to
    // pay for it (its 2 damage and one ally rider match Radiant Barrier's, which
    // gets the full three).
    text: "Cloak a row in darkness for 3 rounds. A card that MOVES in takes 2 DMG and is FRIGHTENed 1 round. DUSK allies in the row gain EVASION. Ranged attacks and FLYING cards pass over.",
    wall: { dmg: 2, status: { kind: "FRIGHTEN", duration: 1, power: 0 }, allyBuff: { evasion: true }, rounds: 3 },
  },
  {
    id: "dawn_radiant_barrier",
    name: "Radiant Barrier",
    element: "DAWN",
    cost: 4,
    kind: "wall",
    text: "A wall of light across a row for 3 rounds. A card that MOVES in takes 2 DMG and is BLINDed 1 round. DAWN allies in the row take 1 less DMG from all attacks. Ranged attacks and FLYING cards pass over.",
    wall: { dmg: 2, status: { kind: "BLIND", duration: 1, power: 0 }, allyBuff: { dmgReduction: 1 }, rounds: 3 },
  },

  // ───────── Cost 3 — ally support (auto-targets an ally of the element) ─────────
  {
    id: "bore_bulwark",
    name: "Bulwark",
    element: "BORE",
    cost: 3,
    kind: "heal",
    text: "Give a BORE ally +3 shield.",
    allyShield: 3,
  },
  {
    id: "gale_tailwind",
    name: "Tailwind",
    element: "GALE",
    cost: 3,
    kind: "heal",
    text: "Give a GALE ally +5 SP (jumps it up the Speed queue).",
    allySp: 5,
  },
  {
    id: "dusk_shadow_step",
    name: "Shadow Step",
    element: "DUSK",
    cost: 3,
    kind: "heal",
    text: "Cloak a DUSK ally in EVASION for 1 round.",
    allyStatus: { kind: "EVASION", duration: 1, power: 0 },
  },

  // ───────── Cost 5 — team defense ─────────
  {
    id: "bore_fortify",
    name: "Fortify",
    element: "BORE",
    cost: 5,
    kind: "heal",
    text: "Give ALL BORE allies +2 shield.",
    allyShield: 2,
    allAllies: true,
  },

  // ───────── Cost 7 — anti-shield strikes (10 PEN, ignore shields) ─────────
  {
    id: "gale_vortex_strike",
    name: "Vortex Strike",
    element: "GALE",
    cost: 7,
    kind: "damage",
    text: "Deal 10 DMG (PEN) to a target and STUN them for 1 round.",
    dmg: 10,
    pen: true,
    status: { kind: "STUN", duration: 1, power: 0 },
  },
  {
    id: "bore_shatterpoint",
    name: "Shatterpoint",
    element: "BORE",
    cost: 7,
    kind: "damage",
    text: "Deal 12 DMG (PEN) to a target — ignores shields entirely.",
    dmg: 12,
    pen: true,
  },
  {
    id: "dusk_phantom_spikes",
    name: "Phantom Spikes",
    element: "DUSK",
    cost: 7,
    kind: "damage",
    text: "Deal 10 DMG (PEN) to a target and DRAIN 3 max HP to a DUSK ally.",
    dmg: 10,
    pen: true,
    drainMaxHp: 3,
  },

  // ───────── Cost 2 — row control (a chosen row of opponents) ─────────
  {
    id: "leaf_thorn_patch",
    name: "Thorn Patch",
    element: "LEAF",
    cost: 2,
    kind: "aoe",
    area: "row",
    text: "Apply BLEED 1 for 2 rounds to every opponent in a chosen row.",
    status: { kind: "BLEED", duration: 2, power: 1 },
  },
  {
    id: "aqua_frost_patch",
    name: "Frost Patch",
    element: "AQUA",
    cost: 2,
    kind: "aoe",
    area: "row",
    text: "FREEZE every opponent in a chosen row for 1 round.",
    status: { kind: "FREEZE", duration: 1, power: 0 },
  },
  {
    id: "gale_downdraft",
    name: "Downdraft",
    element: "GALE",
    cost: 2,
    kind: "aoe",
    area: "row",
    text: "WEAKEN every opponent in a chosen row for 2 rounds.",
    status: { kind: "WEAKEN", duration: 2, power: 0 },
  },
  {
    id: "bore_sand_trap",
    name: "Sand Trap",
    element: "BORE",
    cost: 2,
    kind: "aoe",
    area: "row",
    text: "SLEEP every opponent in a chosen row for 1 round.",
    status: { kind: "SLEEP", duration: 1, power: 0 },
  },

  // ───────── Cost 8 — wide control (two adjacent rows) ─────────
    {
    // COMMAND, and the big one — move AND strike, the whole line, uncapped. The
    // order is fixed (advance first, then swing), so the charge hits from where
    // it arrives rather than where it set off.
    id: "dawn_solar_flare",
    name: "Charge",
    element: "DAWN",
    cost: 8,
    kind: "damage",
    text: "Every DAWN ally advances 1 space and then strikes the nearest opponent it can reach.",
    command: { step: 1, strike: true, sameElement: true },
  },

  // ───────── Cleanse — strip negative statuses off your own side ─────────
    {
    // COMMAND. DAWN had THREE spells carrying a cleanse (this, Dawn's Grace and
    // Judgment) and four carrying BLIND — an element of ten spells saying the
    // same two things repeatedly. Four of them are orders to your own line now,
    // which is what the DAWN roster has always looked like: Sunbanner,
    // Imperator, Reveille, Outrider, Vigil.
    id: "dawn_cleansing_light",
    name: "Retreat",
    element: "DAWN",
    cost: 2,
    kind: "heal",
    text: "Order the DAWN line back 1 space toward your Home row and brace: +2 shields each.",
    command: { step: -1, shield: 2, sameElement: true },
  },
  {
    id: "leaf_groves_blessing",
    name: "Grove's Blessing",
    element: "LEAF",
    cost: 5,
    kind: "heal",
    text: "Heal all LEAF allies 5 HP and cleanse one negative status from each.",
    allAllies: true,
    allyHeal: 5,
    cleanse: 1,
  },
  {
    id: "dawn_dawns_grace",
    name: "Dawn's Grace",
    element: "DAWN",
    cost: 5,
    kind: "heal",
    text: "Heal all DAWN allies 5 HP, give each 2 shields, and cleanse one negative status from each.",
    allAllies: true,
    allyHeal: 5,
    allyShield: 2,
    cleanse: 1,
  },
    {
    // COMMAND. Reuses `rerouteCount`, which BOLT's Full Reroute already
    // implements — redeploying the line IS a battle command, and it needed no
    // engine work at all. Fewer cards than Full Reroute (3 vs its own count) so
    // the two spells are not the same card in different colours.
    id: "dawn_judgment",
    name: "Flanking Order",
    element: "DAWN",
    cost: 7,
    // "convert" is what Full Reroute — the same mechanic — already uses. It is a
    // poor name for a reposition, but it is the kind the reroute path is keyed
    // on, and inventing a ninth SpellKind for one spell would be worse.
    kind: "convert",
    text: "Redeploy up to 3 of your cards to any open slots, ignoring their movement tier.",
    rerouteCount: 3,
  },

  // ───────── Cost 7 — BOLT's one board wipe ─────────
  {
    id: "bolt_lightning_storm",
    name: "Lightning Storm",
    element: "BOLT",
    cost: 7,
    kind: "aoe",
    area: "board",
    text: "Deal 8 DMG to every opponent and PARALYZE each for 2 rounds.",
    dmg: 8,
    status: { kind: "PARALYZE", duration: 2, power: 0 },
  },

  // ───────── Cost 9 — board wipes that punish a condition (double DMG) ─────────
  {
    id: "aqua_maelstrom",
    name: "Maelstrom",
    element: "AQUA",
    cost: 9,
    kind: "aoe",
    area: "board",
    text: "Deal 8 DMG to every opponent — double (16) to any that are FROZEN.",
    dmg: 8,
    doubleIf: "FREEZE",
  },
  {
    id: "bore_tremor",
    name: "Tremor",
    element: "BORE",
    cost: 9,
    kind: "aoe",
    area: "board",
    text: "Deal 8 DMG to every opponent — double (16) to any with no shields.",
    dmg: 8,
    doubleIf: "noShields",
  },
  {
    id: "dawn_dawns_judgment",
    name: "Dawn's Judgment",
    element: "DAWN",
    cost: 9,
    kind: "aoe",
    area: "board",
    text: "Deal 8 DMG to every opponent — double (16) to any that are BLINDed.",
    dmg: 8,
    doubleIf: "BLIND",
  },

  {
    // BOLT's Cost-10 ultimate — not a damage nuke, but its identity made
    // permanent: shut the enemy's tools down for three rounds, then make every
    // BOLT Special (current AND future) cost 1 less (min 1) for the rest of the game.
    //
    // A LOCK, not a status sprayed once. The old version applied MUTED to
    // whatever happened to be standing when it landed, so the answer to a Cost-10
    // ultimate was to summon a fresh card and carry on — the network was "down"
    // for exactly the cards that were already on it. `networkLock` holds the
    // whole side down for the duration, arrivals included.
    id: "bolt_total_network_control",
    name: "Total Network Control",
    element: "BOLT",
    cost: 10,
    kind: "aoe",
    area: "board",
    text: "The opposing network goes down for 3 rounds: every opponent is MUTED, and anything they summon arrives MUTED too. Then, for the rest of the game, your BOLT Specials cost 1 less (min 1).",
    status: { kind: "MUTED", duration: 3, power: 0 },
    networkLock: 3,
    grantBoltDiscount: 1,
  },

  // ─────────────── FIELDS (Cost 6, board-wide terrain, 3 rounds) ───────────────
  // The mirror of a Wall: empowers the caster's SAME-element allies. This pass
  // implements each field's CORE buff; the fiddly secondary riders (BURN-persist,
  // −1 special cost, see-STEALTH, Flow re-choose, DRAIN+1, first-hit EVASION,
  // status-duration +1) are deferred — noted per field below.
  {
    id: "leaf_lushfield",
    name: "Lushfield",
    element: "LEAF",
    cost: 6,
    kind: "field",
    text: "Field (3 rounds): your LEAF allies REGEN 2 HP each round, and every BLEED and ROOT you apply lasts 1 round longer.",
    field: { rounds: 3, regen: 2, extendStatus: { kinds: ["BLEED", "ROOT"], rounds: 1 } },
  },
  {
    id: "aqua_downpour",
    name: "Downpour",
    element: "AQUA",
    cost: 6,
    kind: "field",
    text: "Field (3 rounds): your AQUA allies gain +2 shield each round, and you re-pick Flow Change for all of them every round.",
    field: { rounds: 3, shield: 2, flowRepick: true },
  },
  {
    id: "pyro_heatwave",
    name: "Heatwave",
    element: "PYRO",
    cost: 6,
    kind: "field",
    text: "Field (3 rounds): your PYRO allies gain +1 DMG, and BURN you inflict never expires — your opponents' BURN stops ticking down.",
    field: { rounds: 3, burnPersists: true, dmgBonus: 1 },
  },
  {
    id: "gale_jetstream",
    name: "Jetstream",
    element: "GALE",
    cost: 6,
    kind: "field",
    text: "Field (3 rounds): your GALE allies gain +3 SP, and every push you cause travels 1 space further.",
    field: { rounds: 3, sp: 3, push: 1 },
  },
  {
    id: "bolt_power_grid",
    name: "Power Grid",
    element: "BOLT",
    cost: 6,
    kind: "field",
    text: "Field (3 rounds): your BOLT Specials cost 1 less (min 1), and Electrify hits statused foes for +3 (instead of +2).",
    field: { rounds: 3, specialDiscount: 1, electrify: 1 }, // electrify:1 = the extra on top of the base +1
  },
  {
    // The id matches its art file (public/spells/bolt_power_rebate.webp), which
    // was drawn for the older "Power Rebate" design. The spell was rebuilt as a
    // pool converter; the id is left alone so spellArtSrc() keeps resolving.
    id: "bolt_power_rebate",
    name: "Power Rebate",
    element: "BOLT",
    // Moved 6 -> 5: BOLT carried TWO Cost-6 spells (this and Power Grid), which
    // left a hole at 5 and a collision at 6.
    cost: 5,
    kind: "convert",
    text: "Spend 5 Magic to gain 6 Gold.",
    gainGold: 6,
  },
  {
    id: "bolt_recon_ping",
    name: "Recon Ping",
    element: "BOLT",
    cost: 2,
    kind: "convert", // no target, no board effect — the convert branch's shape
    // The reveal is information only — the UI reads it and nothing else does —
    // so against the AI, which is every single-player mode, this was a dead card
    // at the price of a row-wide trap. The discount gives it a board consequence
    // in its own element's idiom without touching what makes it interesting.
    text: "Reveal the opponent's hand for the rest of this round, and your Specials cost 1 less this round (minimum 1).",
    revealHand: true,
    specialDiscountRound: 1,
  },
  {
    id: "bolt_system_override",
    name: "System Override",
    element: "BOLT",
    cost: 9,
    kind: "convert", // no target; it changes what the caster can afford
    // The discount alone did not fill a cost-9 slot: every other cost-9 in the
    // game is a board wipe, and BOLT's own cost-6 Power Grid already gives a
    // smaller discount for THREE rounds plus an Electrify rider. The rung is
    // fixed — one spell per cost per element — so the effect grows instead of
    // the price dropping. Cheap Specials AND every one of them ready at once is
    // a round you build a whole turn around, which is what the slot is for.
    text: "All of your Specials cost 3 less this round (minimum 1), and every ally's Special comes off cooldown.",
    specialDiscountRound: 3,
    clearCooldowns: true,
  },
  {
    id: "bore_bedrock",
    name: "Bedrock",
    element: "BORE",
    cost: 6,
    kind: "field",
    text: "Field (3 rounds): your BORE allies gain BLOCK 1 and REFLECT 1.",
    field: { rounds: 3, block: 1, reflect: 1 }, // full effect
  },
  {
    id: "dusk_nightfall",
    name: "Nightfall",
    element: "DUSK",
    cost: 6,
    kind: "field",
    // dmgBonus carries the TERRAIN form. As DUSK's region terrain the flags are
    // stripped and the numbers halved, which left Nightfall as `drainBonus: 1`
    // alone — and drainBonus does nothing at all for a card without the DRAIN
    // keyword, so a DUSK team drafted without drainers stood on terrain that did
    // literally nothing. The narrowest of the eight regions by a distance.
    text: "Field (3 rounds): your DUSK allies dodge the FIRST hit they take each round, deal +1 DMG, and every DRAIN steals 1 extra max HP.",
    field: { rounds: 3, evasion: true, drainBonus: 1, dmgBonus: 1 },
  },
  {
    id: "dawn_blazing_sun",
    name: "Blazing Sun",
    element: "DAWN",
    cost: 6,
    kind: "field",
    text: "Field (3 rounds): your DAWN allies heal 2 HP each round, cannot miss, and can see and target STEALTH cards.",
    field: { rounds: 3, regen: 2, neverMiss: true, seeStealth: true },
  },
  // ───────── PYRO ladder ─────────────────────────────────────────────────
  // PYRO had THREE spells (damage/wall/field) where DAWN and BORE have eight,
  // which is the likeliest remaining explanation for it measuring last on every
  // balance run this session. These fill the ladder out to cost 1-10.
  {
    id: "pyro_ember_trap",
    name: "Ember Trap",
    element: "PYRO",
    cost: 2,
    kind: "trap",
    text: "Hide a trap on an empty slot. The first opponent to MOVE onto it takes 5 DMG and BURN 2 for 2 rounds.",
    trap: { dmg: 5, status: { kind: "BURN", duration: 2, power: 2 } },
  },
  {
    id: "pyro_flare_push",
    name: "Flare Push",
    element: "PYRO",
    cost: 3,
    kind: "damage",
    text: "Deal 4 DMG (PEN) to a target and push it back 1 space (if open).",
    dmg: 4,
    pen: true,
    push: 1,
  },
  {
    id: "pyro_ashfall",
    name: "Ashfall",
    element: "PYRO",
    cost: 5,
    kind: "aoe",
    area: "board",
    text: "Deal 3 DMG to every opponent and BURN 2 each for 2 rounds.",
    dmg: 3,
    status: { kind: "BURN", duration: 2, power: 2 },
  },
  {
    id: "pyro_meltdown",
    name: "Meltdown",
    element: "PYRO",
    cost: 7,
    kind: "damage",
    text: "Deal 10 DMG (PEN — ignores shields entirely) to a target and BURN 4 for 3 rounds.",
    dmg: 10,
    pen: true,
    status: { kind: "BURN", duration: 3, power: 4 },
  },
  {
    id: "pyro_inferno_pit",
    name: "Inferno Pit",
    element: "PYRO",
    cost: 8,
    kind: "trap",
    // No PEN on purpose: the payload stays pure BURN so it does not step on
    // Meltdown's anti-shield niche one cost below it.
    text: "Hide a trap on an empty slot. The first opponent to MOVE onto it — and every opponent beside it — takes 8 DMG and BURN 4 for 3 rounds.",
    trap: { dmg: 8, status: { kind: "BURN", duration: 3, power: 4 }, splash: true },
  },
  {
    id: "pyro_cataclysm",
    name: "Cataclysm",
    element: "PYRO",
    cost: 9,
    kind: "aoe",
    area: "board",
    text: "Deal 8 DMG to every opponent — 16 to anything already BURNing.",
    dmg: 8,
    doubleIf: "BURN",
  },
  {
    id: "pyro_volcanic_eruption",
    name: "Volcanic Eruption",
    element: "PYRO",
    cost: 10,
    kind: "aoe",
    area: "board",
    text: "Deal 15 DMG to every opponent and BURN 5 each for 3 rounds. For the rest of the game, your PYRO allies permanently gain +2 DMG.",
    dmg: 15,
    status: { kind: "BURN", duration: 3, power: 5 },
    grantElementDmg: 2,
  },

  // ───────── The seven remaining element ladders ──────────────────────────
  // Built on the PYRO prototype's shape: cost 1-10, a Wall at 4, a Field at 6,
  // an anti-shield PEN answer at 7, a board wipe at 9, and an ultimate at 10
  // that leaves a PERMANENT element-wide engine behind.

  // ── LEAF ────────────────────────────────────────────────────────────────
  {
    id: "leaf_snare",
    name: "Snare",
    element: "LEAF",
    cost: 3,
    kind: "trap",
    text: "Hide a trap on an empty slot. The first opponent to MOVE onto it is ROOTed for 3 rounds and takes BLEED 2 for 2 rounds.",
    // ROOT is the payload; the BLEED rides along as the trap's damage-over-time.
    trap: { dmg: 0, status: { kind: "ROOT", duration: 3, power: 0 } },
    status: { kind: "BLEED", duration: 2, power: 2 },
  },
  {
    id: "leaf_withering_grasp",
    name: "Withering Grasp",
    element: "LEAF",
    cost: 7,
    kind: "damage",
    text: "Deal 8 DMG (PEN) to a target and apply BLEED 3 for 3 rounds. Heal a LEAF ally for the damage dealt.",
    dmg: 8,
    pen: true,
    status: { kind: "BLEED", duration: 3, power: 3 },
    healAllyForDamage: true,
  },
  {
    id: "leaf_overgrowth",
    name: "Overgrowth",
    element: "LEAF",
    cost: 8,
    kind: "trap",
    text: "Hide a trap on an empty slot. The first opponent to MOVE onto it — and every opponent beside it — is ROOTed for 2 rounds and takes BLEED 1 for 2 rounds.",
    trap: { dmg: 0, status: { kind: "ROOT", duration: 2, power: 0 }, splash: true },
    status: { kind: "BLEED", duration: 2, power: 1 },
  },
  {
    id: "leaf_bloodroot_surge",
    name: "Bloodroot Surge",
    element: "LEAF",
    cost: 9,
    kind: "aoe",
    area: "board",
    text: "Apply BLEED 3 for 3 rounds to every opponent, and heal all LEAF allies for the total BLEED that will be dealt.",
    status: { kind: "BLEED", duration: 3, power: 3 },
    healAlliesForStatus: true,
  },
  {
    id: "leaf_heart_of_the_forest",
    name: "Heart of the Forest",
    element: "LEAF",
    cost: 10,
    kind: "aoe",
    area: "board",
    text: "Heal all LEAF allies to full HP and ROOT every opponent for 2 rounds. For the rest of the game, LEAF allies heal 1 extra HP each round.",
    status: { kind: "ROOT", duration: 2, power: 0 },
    healAlliesFull: true,
    grantElementPerm: { healPerRound: 1 },
  },

  // ── AQUA ────────────────────────────────────────────────────────────────
  {
    id: "aqua_steam_vent",
    name: "Steam Vent",
    element: "AQUA",
    cost: 3,
    kind: "damage",
    text: "Deal 4 DMG to a target, and apply SCALD 2 for 2 rounds if it is FROZEN.",
    dmg: 4,
    statusIfFrozen: { kind: "SCALD", duration: 2, power: 2 },
  },
  {
    id: "aqua_dense_fog",
    name: "Dense Fog",
    element: "AQUA",
    cost: 5,
    kind: "field",
    // A field that hurts the OTHER side — the only one of its kind, which is
    // why it needs its own flag rather than reusing an ally buff.
    text: "Field (3 rounds): a fog rolls in — every opponent attack has a chance to miss.",
    field: { rounds: 3, enemyMissChance: true },
  },
  {
    id: "aqua_pressure_crush",
    name: "Pressure Crush",
    element: "AQUA",
    cost: 7,
    kind: "damage",
    text: "Deal 10 DMG (PEN — ignores shields entirely) to a target and drop its SP to 0 for the round.",
    dmg: 10,
    pen: true,
    spDebuff: 99,
  },
  {
    id: "aqua_glacial_wave",
    name: "Glacial Wave",
    element: "AQUA",
    cost: 8,
    kind: "aoe",
    area: "tworows",
    text: "FREEZE every opponent across two adjacent rows for 2 rounds, and give AQUA allies in those rows +2 shield.",
    status: { kind: "FREEZE", duration: 2, power: 0 },
    allyShieldInArea: 2,
  },
  {
    id: "aqua_tsunami",
    name: "Tsunami",
    element: "AQUA",
    cost: 10,
    kind: "aoe",
    area: "board",
    text: "Deal 15 DMG to every opponent and FREEZE them for 2 rounds. For the rest of the game, AQUA allies gain +2 shield at the start of each round.",
    dmg: 15,
    status: { kind: "FREEZE", duration: 2, power: 0 },
    grantElementPerm: { shieldPerRound: 2 },
  },

  // ── GALE ────────────────────────────────────────────────────────────────
  {
    id: "gale_storm_front",
    name: "Storm Front",
    element: "GALE",
    cost: 5,
    kind: "aoe",
    area: "board",
    text: "Deal 3 DMG to every opponent and sap 3 SP from each for the round.",
    dmg: 3,
    spDebuff: 3,
  },
  {
    id: "gale_gale_force",
    name: "Gale Force",
    element: "GALE",
    cost: 8,
    kind: "aoe",
    area: "tworows",
    text: "WEAKEN every opponent across two adjacent rows for 2 rounds and push each back 1 space.",
    status: { kind: "WEAKEN", duration: 2, power: 0 },
    push: 1,
  },
  {
    id: "gale_cyclone",
    name: "Cyclone",
    element: "GALE",
    cost: 9,
    kind: "aoe",
    area: "board",
    text: "Deal 8 DMG to every opponent and drop each to 0 SP for the round.",
    dmg: 8,
    spDebuff: 99,
  },
  {
    id: "gale_tempest",
    name: "Tempest",
    element: "GALE",
    cost: 10,
    kind: "aoe",
    area: "board",
    text: "Deal 15 DMG to every opponent and drop each to 0 SP for the round. For the rest of the game, GALE allies permanently gain +2 SP.",
    dmg: 15,
    spDebuff: 99,
    grantElementPerm: { sp: 2 },
  },

  // ── BORE ────────────────────────────────────────────────────────────────
  {
    id: "bore_landslide",
    name: "Landslide",
    element: "BORE",
    cost: 8,
    kind: "aoe",
    area: "tworows",
    text: "SLEEP every opponent across two adjacent rows for 1 round, and give BORE allies in those rows +2 shield.",
    status: { kind: "SLEEP", duration: 1, power: 0 },
    allyShieldInArea: 2,
  },
  {
    id: "bore_mountains_fall",
    name: "Mountain's Fall",
    element: "BORE",
    cost: 10,
    kind: "aoe",
    area: "board",
    text: "Deal 15 DMG to every opponent and give all BORE allies +5 shield. For the rest of the game, BORE allies gain +1 shield at the start of each round.",
    dmg: 15,
    allyShield: 5,
    allAllies: true,
    grantElementPerm: { shieldPerRound: 1 },
  },

  // ── DUSK ────────────────────────────────────────────────────────────────
  {
    id: "dusk_bone_snare",
    name: "Bone Snare",
    element: "DUSK",
    cost: 2,
    kind: "trap",
    text: "Hide a trap on an empty slot. The first opponent to MOVE onto it takes 4 DMG and is FRIGHTENed for 2 rounds.",
    trap: { dmg: 4, status: { kind: "FRIGHTEN", duration: 2, power: 0 } },
  },
  {
    id: "dusk_grave_pit",
    name: "Grave Pit",
    element: "DUSK",
    cost: 8,
    kind: "trap",
    text: "Hide a trap on an empty slot. The first opponent to MOVE onto it takes 12 DMG (PEN), and every opponent beside it is FRIGHTENed for 1 round.",
    trap: { dmg: 12, pen: true, status: { kind: "FRIGHTEN", duration: 1, power: 0 }, splash: true },
  },
  {
    id: "dusk_harvest",
    name: "Harvest",
    element: "DUSK",
    cost: 9,
    kind: "aoe",
    area: "board",
    text: "Deal 8 DMG to every opponent and DRAIN 2 max HP from each, permanently.",
    dmg: 8,
    drainMaxHpAll: 2,
  },
  {
    id: "dusk_endless_night",
    name: "Endless Night",
    element: "DUSK",
    cost: 10,
    kind: "aoe",
    area: "board",
    text: "Deal 15 DMG to every opponent and FRIGHTEN them for 2 rounds. For the rest of the game, DUSK allies gain DRAIN on their basic attacks.",
    dmg: 15,
    status: { kind: "FRIGHTEN", duration: 2, power: 0 },
    grantElementPerm: { drain: true },
  },

  // ── DAWN ────────────────────────────────────────────────────────────────
    {
    // COMMAND. Capped at two, and that cap is the whole design: a free basic for
    // every body on the board is the strongest thing a spell can do at any
    // price, so this is a raid by whoever is already furthest forward.
    id: "dawn_grace",
    name: "Surprise Attack",
    element: "DAWN",
    cost: 3,
    kind: "damage",
    text: "The 2 DAWN allies closest to the enemy each strike the nearest opponent immediately.",
    command: { strike: true, sameElement: true, max: 2 },
  },
  {
    id: "dawn_eternal_dawn",
    name: "Eternal Dawn",
    element: "DAWN",
    cost: 10,
    kind: "aoe",
    area: "board",
    text: "Deal 15 DMG to every opponent and BLIND them for 2 rounds. For the rest of the game, DAWN allies heal 2 extra HP at the end of each round.",
    dmg: 15,
    status: { kind: "BLIND", duration: 2, power: 0 },
    grantElementPerm: { healPerRound: 2 },
  },

  // ───────── The last three ───────────────────────────────────────────────
  // Held back from the ladder pass because each needed engine work the other 25
  // did not: multi-card targeting for the two BOLT ones, and death-tracking
  // across a round for Wake of the Dead.
  {
    id: "bolt_rewire",
    name: "Rewire",
    element: "BOLT",
    cost: 3,
    kind: "convert", // targetless branch; the picks ride targetIds
    text: "Instantly swap the board positions of two of your own cards.",
    swapAllies: true,
  },
  {
    id: "bolt_full_reroute",
    name: "Full Reroute",
    element: "BOLT",
    cost: 8,
    kind: "convert",
    text: "Instantly move any 2 of your cards to open slots anywhere on the board, ignoring their SP movement limit.",
    rerouteCount: 2,
  },
  {
    id: "dusk_wake_of_the_dead",
    name: "Wake of the Dead",
    element: "DUSK",
    cost: 5,
    kind: "aoe",
    area: "board",
    text: "Deal 3 DMG to every opponent. Anything you kill for the rest of this round rises next round as a Risen (3 DMG / 3 HP / SP 4) under your control.",
    dmg: 3,
    reviveAsToken: "dusk_risen_tok",
  },

];

export const SPELL_INDEX: Record<string, SpellDef> = Object.fromEntries(
  SPELLS.map((s) => [s.id, s]),
);

export function getSpell(id: string): SpellDef {
  const s = SPELL_INDEX[id];
  if (!s) throw new Error(`Unknown spell: ${id}`);
  return s;
}

export function isSpell(id: string): boolean {
  return id in SPELL_INDEX;
}

/** Build a player's spellbook from the elements present in their deck: every
 *  implemented spell whose element the deck plays, castable once. This is the
 *  default when a deck carries no hand-picked spellbook. */
/** What a spell asks the caster to choose before it can resolve.
 *
 *  "none"   resolves on the spot — heal (auto-targets an ally), field, board
 *           AoE, and the targetless conversions.
 *  "enemy"  a single opposing card.
 *  "row"    a row of the board (walls, row/two-row AoE).
 *  "slot"   one empty square (traps).
 *  "ally"   a single one of the caster's own cards, of the spell's element.
 *  "cards"  two or more of the caster's OWN cards (Rewire, Full Reroute).
 *  "mode"   a modal choice first (Chill), which then asks for a card itself.
 *
 *  This lives in the engine because THREE separate places in the UI encode it —
 *  whether the tray arms or fires immediately, which squares light up, and what
 *  the click handler does with them — and each got it wrong independently:
 *  traps had their column dropped, and Rewire/Full Reroute auto-fired with no
 *  picks and so could never be cast by hand at all. One function, one answer,
 *  covered by a test that walks every spell in the set.
 */
export function spellPickKind(
  spell: SpellDef,
): "none" | "enemy" | "ally" | "row" | "slot" | "cards" | "mode" | "command" {
  // BATTLE COMMANDS order your OWN line, never an enemy. Ahead of the kind
  // checks because a command borrows a kind for its tray colour (Charge is
  // "damage"), and the tray would otherwise sit waiting for an enemy target
  // that the spell never reads. There is a whole-pool test asserting this
  // function and canCastSpell agree, and it is what caught the mismatch.
  //
  // The CAP decides whether there is anything to pick. An uncapped command is a
  // general order — every kin on the board obeys, so the caster has no choice to
  // make and it still fires the moment it is tapped. A CAPPED one is the engine
  // choosing a subset of your army for you, and "the two standing nearest the
  // enemy" is only ever the right two by accident: the pair you want swinging is
  // the pair that can reach something worth hitting, or the two that are not
  // holding STEALTH. Same argument that took auto-aim off the ally heals.
  if (spell.command) return spell.command.max != null ? "command" : "none";
  if (spell.swapAllies || spell.rerouteCount) return "cards";
  if (spell.kind === "choice") return "mode";
  if (spell.kind === "trap") return "slot";
  if (spell.kind === "wall") return "row";
  if (spell.kind === "aoe") return spell.area === "board" ? "none" : "row";
  if (spell.kind === "damage") return "enemy";
  // A support spell that lands on ONE ally is a targeted spell and the caster
  // should aim it. It used to auto-fire at whichever kin had the lowest HP
  // fraction, which is only ever right by accident: the card you want shielded
  // before a push, or SP'd to reach a Home slot, is rarely the hurt one. Heals
  // that hit every ally (`allAllies`) still have nothing to pick.
  if (spell.kind === "heal") return spell.allAllies ? "none" : "ally";
  return "none"; // field, convert
}


export function spellbookFor(deck: string[], cap: number = MAX_SPELLBOOK): SpellSlot[] {
  const elements = new Set<Element>(deck.map((id) => getDef(id).element));
  // Capped like a hand-picked book — and by the SAME cap, which is the bug this
  // parameter fixes. The caller computes spellCapForBoard() and passed it to the
  // hand-picked branch only, so a DERIVED book was pinned to 5 even on the large
  // board where 8 are legal: every story, arena and AI match that did not carry
  // a custom book fought three spells short of its allowance, and the two
  // branches of one ternary disagreed about the rules.
  //
  // Uncapped, a two-element
  // deck derived up to THIRTEEN spells and the battle tray was unusable —
  // "at most this many spells" has to hold however the book was built.
  //
  // One of each KIND first, then fill. A plain slice(0, 5) took the first five
  // in declaration order, which is grouped by kind — so a book came out as
  // damage,damage,wall,wall,wall and the later kinds could never appear at all
  // (the game's only `convert` spell is declared at index 42 and was
  // unreachable). Deriving a book should sample the element, not the file.
  //
  // AND IT OBEYS THE COST-TIER LAW, which it did not used to. This branch took
  // one of each KIND and then filled in declaration order with no cap of any
  // sort, so a derived book could arrive holding three 6-costs -- a book the
  // deck builder would have refused to let anyone assemble by hand. An
  // auto-filled book must be a book the player could have built.
  const pool = SPELLS.filter((s) => elements.has(s.element));
  const seen = new Set<string>();
  const spread = pool.filter((s) => (seen.has(s.kind) ? false : (seen.add(s.kind), true)));
  const ordered = [...spread, ...pool.filter((s) => !spread.includes(s))];
  return spellbookFromIds(ordered.map((s) => s.id), cap);
}

/** Build a spellbook from an explicit, ordered list of spell ids (a deck's
 *  custom spellbook). Unknown ids are dropped, duplicates removed, and the
 *  result is capped at `cap` — so a bad/oversized saved book can never break
 *  match setup. The cap is board-size dependent (5 standard / 8 large), passed
 *  in by the caller; a flat MAX_SPELLBOOK here would cut a legal large-board
 *  book of 8 down to 5 at match setup. */
/** THE SPELLBOOK LAW — how many spells of a given Magic COST one book may hold.
 *
 *  PER COST TIER, not per spell, and that distinction is the whole rule. The
 *  cap counts every spell sharing a cost rung against one allowance, so a book
 *  may not answer the same question twice by naming two different spells that
 *  cost the same. It used to be a per-SPELL copy cap, which stopped two
 *  Cataclysms and happily allowed Cataclysm plus a second, third and fourth
 *  distinct 6-cost — eight of them on the large board, which is a book with no
 *  curve in it at all.
 *
 *    cost 6-10  ->  1 of each cost    the finishers: one six, one seven,
 *                                     one eight, one nine, one ten
 *    cost 3-5   ->  2 of each cost
 *    cost 1-2   ->  unlimited         the book's own size is the only cap
 *
 *  The per-tier form STRICTLY SUBSUMES the copy cap it replaced — two copies of
 *  one spell are also two spells of that cost — so this is one rule where there
 *  were two, and there is no case the old one caught that this one does not.
 *
 *  It bites hardest where the set is shaped to make it bite: there are exactly
 *  80 spells, TEN PER ELEMENT, one per cost rung 1 through 10. So a cost tier
 *  offers a mono-element deck exactly one spell and a dual-element deck exactly
 *  two, and at the top of the curve the rule is therefore a genuine choice
 *  between the two elements' finishers rather than a formality. At the cheap
 *  end "unlimited" means unlimited copies of the SAME spell, since that is all
 *  an element has at that cost. */
export const SPELL_COST_CAPS: readonly { minCost: number; perCost: number }[] = [
  { minCost: 6, perCost: 1 },
  { minCost: 3, perCost: 2 },
  { minCost: 0, perCost: Infinity },
];

/** How many spells of this COST a book may hold. */
export function spellCostCap(cost: number): number {
  return SPELL_COST_CAPS.find((t) => cost >= t.minCost)!.perCost;
}

/** The same allowance, addressed by a spell id. Unknown ids get 0 so a bad id
 *  can never be added rather than being treated as unlimited. */
export function spellCapForId(spellId: string): number {
  const sp = SPELL_INDEX[spellId];
  return sp ? spellCostCap(sp.cost) : 0;
}

/** THE ONE IMPLEMENTATION. Trim a list of spell ids to a legal book: real
 *  spells only, cost-tier caps applied in order, then the book's size cap.
 *
 *  Every path that builds or loads a book goes through this — the deck
 *  builder, the deck sanitiser, match setup, the derived book, and the
 *  campaign save. It is a single function ON PURPOSE: the rule it replaced was
 *  hand-copied as the same six-line counting loop into four different files,
 *  and they had already drifted (the derived book in `spellbookFor` applied no
 *  cap at all, so an auto-filled book could walk in with three 6-costs while
 *  the deck builder refused to let anyone pick them by hand).
 *
 *  Order is preserved and earlier entries win, so a book trimmed on load keeps
 *  the front of what the player chose rather than an arbitrary subset. */
export function legalSpellIds(ids: readonly string[], cap: number = MAX_SPELLBOOK): string[] {
  const perCost = new Map<number, number>();
  const out: string[] = [];
  for (const id of ids) {
    if (out.length >= cap) break;
    if (typeof id !== "string" || !isSpell(id)) continue;
    const sp = SPELL_INDEX[id];
    if (!sp) continue;
    const taken = perCost.get(sp.cost) ?? 0;
    if (taken >= spellCostCap(sp.cost)) continue;
    perCost.set(sp.cost, taken + 1);
    out.push(id);
  }
  return out;
}

export function spellbookFromIds(ids: string[], cap = MAX_SPELLBOOK): SpellSlot[] {
  // Each slot carries its own `used` flag, so two legal copies of a cheap spell
  // really are two casts.
  return legalSpellIds(ids, cap).map((id) => ({ defId: id, used: false }));
}

// Flavour text, attached the same way cards get theirs — see data/lore/index.ts.
// Goes through loreForSpell rather than a bare LORE lookup because two ids are
// both a card and a spell; the prefixed key is how the spell claims its own line.
for (const spell of SPELLS) {
  const line = loreForSpell(spell.id);
  if (line) spell.lore = line;
}

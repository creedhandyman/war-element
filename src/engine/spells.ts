// Spells — a one-time Prep-Phase effect (no stats, no slot), paid from the magic
// pool, once per game. This is the first slice: the Cost-1 "small damage / small
// support" spells for every element, plus the Cost-4 row "walls". The rest of the
// 1–10 curve (from Spells_All_Elements.md) is a follow-up.
//
// Canon rules put Spells in the same deck as Champions. For now each player gets a
// separate spellbook (spellbookFor) derived from the elements present in their
// deck — contained, and easy to migrate to same-deck later.

import { getDef } from "../data/cards";
import type { Element, SpellDef, SpellSlot } from "./types";

/** A custom spellbook holds at most this many spells (each castable once). */
export const MAX_SPELLBOOK = 5;

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
    text: "Choose — strike a foe for 3 DMG + FREEZE 1, or shield an AQUA ally +4.",
    dmg: 3,
    status: { kind: "FREEZE", duration: 1, power: 0 },
    allyShield: 4,
  },
  {
    id: "bolt_zap",
    name: "Zap",
    element: "BOLT",
    cost: 1,
    kind: "damage",
    text: "Deal 3 DMG to a target and PARALYZE them for 1 round.",
    dmg: 3,
    status: { kind: "PARALYZE", duration: 1, power: 0 },
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
    text: "Charge a row with current for 3 rounds. A card that MOVES in takes 2 DMG and is PARALYZED 1 round. Ranged attacks and FLYING cards pass over.",
    wall: { dmg: 2, status: { kind: "PARALYZE", duration: 1, power: 0 }, rounds: 3 },
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
    text: "Cloak a DUSK ally in EVASION for 2 rounds.",
    allyStatus: { kind: "EVASION", duration: 2, power: 0 },
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
    id: "dawn_solar_flare",
    name: "Solar Flare",
    element: "DAWN",
    cost: 8,
    kind: "aoe",
    area: "tworows",
    text: "BLIND every opponent across two adjacent rows for 2 rounds.",
    status: { kind: "BLIND", duration: 2, power: 0 },
  },

  // ───────── Cleanse — strip negative statuses off your own side ─────────
  {
    id: "dawn_cleansing_light",
    name: "Cleansing Light",
    element: "DAWN",
    cost: 2,
    kind: "heal",
    text: "CLEANSE all DAWN allies — remove every negative status.",
    allAllies: true,
    cleanse: 99,
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
    text: "Heal all DAWN allies 5 HP and cleanse one negative status from each.",
    allAllies: true,
    allyHeal: 5,
    cleanse: 1,
  },
  {
    id: "dawn_judgment",
    name: "Judgment",
    element: "DAWN",
    cost: 7,
    kind: "damage",
    text: "Deal 10 DMG (PEN) to a target and cleanse one status from each DAWN ally.",
    dmg: 10,
    pen: true,
    cleanse: 1,
  },

  // ───────── Cost 7 — BOLT's one board wipe ─────────
  {
    id: "bolt_lightning_storm",
    name: "Lightning Storm",
    element: "BOLT",
    cost: 7,
    kind: "aoe",
    area: "board",
    text: "Deal 8 DMG to every opponent and PARALYZE each for 1 round.",
    dmg: 8,
    status: { kind: "PARALYZE", duration: 1, power: 0 },
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
    // permanent: shut the enemy's tools down for two rounds, then make every
    // BOLT Special (current AND future) cost 1 less (min 1) for the rest of the game.
    id: "bolt_total_network_control",
    name: "Total Network Control",
    element: "BOLT",
    cost: 10,
    kind: "aoe",
    area: "board",
    text: "MUTE every opponent for 2 rounds. Then, for the rest of the game, your BOLT Specials cost 1 less (min 1).",
    status: { kind: "MUTED", duration: 2, power: 0 },
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
    text: "Field (3 rounds): BURN you inflict never expires — your opponents' BURN stops ticking down.",
    field: { rounds: 3, burnPersists: true }, // full doc effect
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
    text: "Field (3 rounds): your BOLT Specials cost 1 less (min 1), and Electrify hits statused foes for +2 (instead of +1).",
    field: { rounds: 3, specialDiscount: 1, electrify: 1 }, // electrify:1 = the extra on top of the base +1
  },
  {
    // The id matches its art file (public/spells/bolt_power_rebate.webp), which
    // was drawn for the older "Power Rebate" design. The spell was rebuilt as a
    // pool converter; the id is left alone so spellArtSrc() keeps resolving.
    id: "bolt_power_rebate",
    name: "Power Converter",
    element: "BOLT",
    cost: 6,
    kind: "convert",
    text: "Spend 6 magic to gain 4 summoning resource.",
    gainSummon: 4,
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
    text: "Field (3 rounds): your DUSK allies gain EVASION, and every DRAIN steals 1 extra max HP.",
    // NOTE: the EVASION here is full-time; the design doc scopes it to the FIRST
    // hit taken each round, which is still deferred.
    field: { rounds: 3, evasion: true, drainBonus: 1 },
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
export function spellbookFor(deck: string[]): SpellSlot[] {
  const elements = new Set<Element>(deck.map((id) => getDef(id).element));
  return SPELLS.filter((s) => elements.has(s.element)).map((s) => ({
    defId: s.id,
    used: false,
  }));
}

/** Build a spellbook from an explicit, ordered list of spell ids (a deck's
 *  custom spellbook). Unknown ids are dropped, duplicates removed, and the
 *  result is capped at MAX_SPELLBOOK — so a bad/oversized saved book can never
 *  break match setup. */
export function spellbookFromIds(ids: string[]): SpellSlot[] {
  const seen = new Set<string>();
  const book: SpellSlot[] = [];
  for (const id of ids) {
    if (seen.has(id) || !isSpell(id)) continue;
    seen.add(id);
    book.push({ defId: id, used: false });
    if (book.length >= MAX_SPELLBOOK) break;
  }
  return book;
}

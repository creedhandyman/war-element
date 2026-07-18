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
    id: "aqua_frost_shard",
    name: "Frost Shard",
    element: "AQUA",
    cost: 1,
    kind: "damage",
    text: "Deal 3 DMG to a target and FREEZE them for 1 round.",
    dmg: 3,
    status: { kind: "FREEZE", duration: 1, power: 0 },
  },
  {
    id: "bolt_jolt",
    name: "Jolt",
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
    text: "Deal 10 DMG (PEN) to a target — ignores shields entirely.",
    dmg: 10,
    pen: true,
  },
  {
    id: "dusk_soul_rend",
    name: "Soul Rend",
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

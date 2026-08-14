// Story Mode — campaign data, save state, and the recruitment roll.
//
// The map IS the progression system: there is no XP and no character level, so
// everything here is (a) where the nodes are, (b) which nodes you've cleared,
// and (c) which cards you own. Deck size is unlocked by clearing Thrones.
//
// This module is pure data + pure functions. It never imports from the engine's
// RUNTIME or from React, so the whole campaign layer stays testable headlessly.
// `engine/spells` is the one engine-side import and it is deliberate: that file
// is itself pure data plus pure helpers (no state, no phases, no React), and the
// hero's spell unlocks have to read the real spell table or they would need a
// duplicate of it here that could drift.

import { CARDS, CARD_INDEX, getDef } from "./cards";
import { SPELLS, getSpell, spellCapForBoard } from "../engine/spells";

// ── shape ───────────────────────────────────────────────────────────────────

export type NodeKind = "skirmish" | "warden" | "landmark" | "throne" | "blight" | "gate";

/** A Gate's composition requirement (§7). Recruitment is broad enough that the
 *  player always HAS the cards — the gate just forces them to actually slot
 *  them, so a deck can't be a pile of whatever dropped last. */
export interface GateDemand {
  kind: "class" | "attack";
  /** A CardClass ("Ranger") or an AttackType ("Ranged"). */
  value: string;
  count: number;
}

export interface StoryNode {
  id: string;
  name: string;
  kind: NodeKind;
  /** Recruitable roster — the cards this node can actually give you. */
  roster: string[];
  /** Non-recruitable filler. Tokens where the element has them; never rollable. */
  adds: string[];
  /** Elemental Overflow (§10.5): cheap Rares from the NEIGHBOURING region that
   *  bleed across this border node. Recruitable, but at half rate — a taste of
   *  the next element, not a shortcut past walking there. Each keeps its home
   *  node, which stays the reliable place to farm it at full odds. */
  overflow?: string[];
  /** Nodes that must be cleared before this one opens. Empty = open from the start. */
  requires: string[];
  /** How many of `requires` are actually needed. Absent = all of them. Act V's
   *  Shadow Border wants TWO of the three Gray Thrones, in any combination —
   *  §2 makes the Gray Continent order-free, so demanding a specific one would
   *  quietly re-impose an order. */
  requiresCount?: number;
  /** A required Throne opens the region's borders; an optional one is a detour. */
  required?: boolean;
  /** Gate nodes only: the composition this border demands. */
  demand?: GateDemand;
  /** Gate nodes only: the region ids this gate opens, for the map's copy. A
   *  list because one gate can open several — Gate E is the Gray Continent
   *  ports, and everything past it is Act IV. */
  opens?: string[];
  /** Board size for THIS node, overriding the region's. Lets a region run its
   *  Skirmishes small and its Landmarks/Thrones large — but see
   *  `boardsLegalFor`: deck size and board size are locked together by format,
   *  so a region can only mix boards while its deck cap is exactly 20. */
  board?: number;
  /** Practical orientation: what this node is FOR, in the game's own voice. */
  note?: string;
  /** Lore from the Story Bible, in the bible's voice. Deliberately separate
   *  from `note` — one tells you what to expect from the fight, the other
   *  tells you where you are standing. The prep screen shows both. */
  lore?: string;
  /** Position on the region's painted map, as a PERCENTAGE of its width and
   *  height. Percentages rather than pixels so the map scales to any viewport
   *  and the art can be re-exported at a different size without moving a node. */
  at: { x: number; y: number };
}

export interface StoryRegion {
  id: string;
  name: string;
  element: string;
  /** The Field spell that runs permanently on every node in the region. */
  terrain: string;
  /** Board for this region's ORDINARY nodes. Its Landmarks and Thrones go to
   *  5x5 regardless — see `boardForNode` / `BIG_BATTLE_KINDS`. */
  board: number;
  /** Blight the region ships with, painted into the map at generation rather
   *  than creeping in later. LEAF's Rot Line is the template: it is simply the
   *  region DUSK has been working on longest. */
  baseBlight?: number;
  /** Where a Blight Node materialises at level 3 — the region's blight-capable
   *  border zone. A region without one can never host the node. */
  blightAt?: { x: number; y: number };
  /** The painted region map this node layout is placed against. */
  art?: string;
  /** The art's aspect ratio (w/h). Per-region because the paintings are not all
   *  the same shape — AQUA is 4:3 where LEAF and PYRO are 3:2 — and forcing one
   *  ratio would crop somebody's map. Defaults to 3:2. */
  artRatio?: number;
  /** Node ids that must be cleared before this region is reachable at all.
   *  Empty/absent = open from the start (LEAF). */
  requires?: string[];
  /** The region's rags-to-riches opener. See `RegionOpening`. */
  opening: RegionOpening;
  /** The Throne that counts as CONQUERING this region — the one flagged
   *  `required: true` among its nodes. Clearing it opens the region's borders,
   *  widens the squad by SQUAD_PER_THRONE, and makes this region "home": your
   *  whole collection is available here, with no squad limit. */
  throne: string;
  nodes: StoryNode[];
}

/** A region's OPENING BATTLE — the fight you walk into with almost nothing.
 *
 *  LEAF sets the pattern the others copy: Sakuroot, alone, against the three
 *  Rares standing at Spring Village Outskirts. She is a 3-cost Tank behind 4
 *  shields who heals her own home row, which is the only reason one card can
 *  hold a board at all — that "sticking power" is the whole reason the campaign
 *  can start this poor.
 *
 *  Two rules make it survivable, and both are exceptions carved out here rather
 *  than anywhere else in the campaign:
 *
 *  1. The node fields EXACTLY its own roster — three cards — instead of filling
 *     to the deck cap like every other fight. See `buildFormation`.
 *  2. Winning hands that roster over GUARANTEED, no recruit roll and no pity.
 *     See `guaranteedDrops`. Rags to riches: one card in, four out.
 */
export interface RegionOpening {
  /** The node that IS the opening battle — always the region's first. */
  node: string;
  /** The Epic this region's opening awards. LEAF's is Sakuroot, which you are
   *  handed at the start instead of earning (she is the deck). Every other
   *  region's is earned by winning its opener, so you always arrive somewhere
   *  new with one card that can hold a line while the Rares accumulate. */
  epic: string;
}

// ── the LEAF slice ──────────────────────────────────────────────────────────
// Act I. Full vertical slice: every draftable LEAF card is placed exactly once,
// which `story.test.ts` enforces rather than trusting.

const LEAF: StoryRegion = {
  id: "leaf",
  name: "Four Seasons Mega Forest",
  element: "LEAF",
  terrain: "Lushfield",
  board: 4,
  opening: { node: "L1", epic: "leaf_sakuroot" },
  throne: "L14",
  art: "/maps/leaf.webp",
  artRatio: 1536 / 1024,
  baseBlight: 1, // the Rot Line — see L8
  // The violet band the art paints across the southern treeline, between the Rot
  // Line and the Southern Burn. This is where the shadow already pools.
  blightAt: { x: 62, y: 87 },
  nodes: [
    // Placed against the painted map. The north arc runs west -> north -> east
    // (Spring Bloom -> Winter's Reach -> Autumn's Gold); the south arc runs
    // west -> south -> east (Evergreen Plains -> the Rot Line / Jungle Wilds).
    // Both converge on the Heart of Nature in the centre.
    { id: "L1", name: "Spring Village Outskirts", kind: "skirmish", at: { x: 15, y: 41 },
      requires: [], roster: ["leaf_nettle", "leaf_weeds", "leaf_greegon"], adds: [],
      note: "The tutorial. Greegon is a REGEN tank you cannot out-race — capture the slot.",
      lore: "Keepers of Renewal. Their duty is beginnings: healing what's broken, coaxing new growth from old wounds. The least warlike of the four tribes, and the most trusted by outsiders."
    },
    { id: "L2", name: "Cherry Grove Path", kind: "skirmish", at: { x: 19, y: 24 },
      requires: ["L1"], roster: ["leaf_birch", "leaf_leaf", "leaf_guardian"], adds: [],
      lore: "The blossom lasts nine days, and the Spring Tribe dates its agreements by it. A promise made under the petals is understood to expire when they fall."
     },
    { id: "L3", name: "Bloomwardens' Ring", kind: "warden", at: { x: 32, y: 40 },
      requires: ["L2"], roster: ["leaf_stickers", "leaf_splint", "leaf_fallona"], adds: ["leaf_acorn_tok"],
      lore: "Bloomwardens are not appointed. A candidate of any season stands inside the ring until it blooms around them, and a year of standing there is an ordinary wait."
     },
    { id: "L4", name: "Evergreen Plains", kind: "skirmish", at: { x: 25, y: 62 },
      requires: ["L1"], roster: ["leaf_oak", "leaf_python", "leaf_sticks", "leaf_sprinu"], adds: [],
      lore: "Green in every month. The four tribes divide the Mega Forest by season, and the plains are the one stretch that division has never managed to reach."
     },
    { id: "L5", name: "Summer's Embrace Grove", kind: "warden", at: { x: 40, y: 74 },
      requires: ["L4"], roster: ["leaf_alpha", "leaf_dande", "leaf_squanch"], adds: ["leaf_acorn_tok"] ,
      lore: "Where Spring starts things, Summer sustains them. Guardians of Growth, stewards of the plains where the forest stands at its fullest strength."
    },
    { id: "L6", name: "Jungle Wilds", kind: "warden", at: { x: 83, y: 60 },
      requires: ["L5"], roster: ["leaf_stickviper", "leaf_gecko", "leaf_cactus"], adds: ["leaf_reptilian_tok"],
      note: "The Reptile node — StickViper and Gecko are the tribe. Fight it before the warlord who buffs it.",
      lore: "Reptiles, not Keepers. The four tribes count the Wilds as forest rather than as a fifth people, a decision made early and never put to the brood."
     },
    // Gated off L10, not L2: the art puts Rustling Woods at Autumn's Gold in the
    // far north-east, so the approach is along the northern treeline.
    { id: "L7", name: "Rustling Woods", kind: "skirmish", at: { x: 78, y: 38 },
      requires: ["L10"], roster: ["leaf_walking_tree", "leaf_hunter", "leaf_dartfrog"], adds: [],
      overflow: ["aqua_misty"], // fronts Eastleaf Port — the Gateway to Aqua
      note: "Autumn's Gold. Eastleaf Port and the sea road to AQUA lie just east.",
      lore: "Autumn's Gold, where the leaves turn fire-coloured and then to rot that feeds the following spring. LEAF's realists tend the ending as carefully as the growth."
    },
    // Gated off L5, not L7: the Rot Line is painted across the SOUTHERN treeline,
    // a step past Summer's Embrace — nowhere near the northern woods.
    { id: "L8", name: "The Rot Line", kind: "warden", at: { x: 41, y: 84 },
      requires: ["L5"], roster: ["leaf_nightshade", "leaf_darth", "leaf_bark_bushmen"], adds: [],
      overflow: ["pyro_staph"], // fronts the Southern Burn — the open road to PYRO
      note: "The mid-forest spike, and the scar DUSK left. Where a starter deck stops working.",
      lore: "Every other ending in the Mega Forest feeds a beginning — this one feeds something else. No Keeper will say aloud how much further south the Cycle still holds."
     },
    { id: "L9", name: "Winter's Reach Treeline", kind: "skirmish", at: { x: 40, y: 21 },
      requires: ["L2"], roster: ["leaf_lumberjack", "leaf_whintey", "leaf_sakuroot"], adds: [] ,
      lore: "Along Winter's Reach the Sun's Army Fronts ride in open daylight, beside LEAF's Winter Tribe, watching the same snow. It is the only border DAWN keeps this way."
    },
    { id: "L10", name: "Winter Village Sentinels", kind: "warden", at: { x: 58, y: 23 },
      requires: ["L9"], roster: ["leaf_sumerose", "leaf_rubyo", "leaf_citra"], adds: [],
      note: "Under the Arctic Veil. The ice wall north is DAWN's border — sealed all campaign.",
      lore: "Sentinels of Rest. Not dormant — on duty. Winter holds that a forest which never stops to sleep eventually forgets how to grow."
    },
    { id: "L11", name: "Heart of Nature: Outer Roots", kind: "landmark", at: { x: 40, y: 60 },
      requires: ["L3", "L8"], roster: ["leaf_season", "leaf_thorn", "leaf_elderroot"], adds: [],
      note: "Elderroot is the game's only melee Support.",
      lore: "The weathered stones around the Tree are not markers. Graves. The first Keepers of every tribe chose to be buried here, at the roots, rather than in their own season's ground."
    },
    { id: "L12", name: "Heart of Nature: The Spirit Tree", kind: "landmark", at: { x: 56, y: 56 },
      requires: ["L11"], roster: ["leaf_warden", "leaf_efy", "leaf_fallow"], adds: [] ,
      lore: "Some elders whisper the roots go down farther than any living Keeper has followed — that the Tree draws from something already there when the first tribe arrived."
    },
    { id: "L13", name: "Jungle Throne", kind: "throne", at: { x: 67, y: 81 },
      requires: ["L6", "L12"], roster: ["leaf_trinezer"],
      // Escorts: the Reptile tribe it commands, already farmable at L6.
      adds: ["leaf_reptilian_tok", "leaf_stickviper", "leaf_gecko", "leaf_alpha"],
      note: "Deep Grove. Optional — an early skill check with a Mythic reward.",
      lore: "Unchecked growth is only rot arriving later — every Keeper will say so. Not one of the four tribes ever volunteered for the work. The Deep Grove did."
     },
    { id: "L14", name: "The Spirit Tree Rises", kind: "throne", at: { x: 48, y: 45 },
      requires: ["L12"], roster: ["leaf_oakgre"],
      // Escorts: the old growth around it, farmable at L4 and L2.
      adds: ["leaf_acorn_tok", "leaf_oak", "leaf_birch", "leaf_bark_bushmen"], required: true,
      note: "Required. Clearing it opens the borders to PYRO and AQUA.",
      lore: "LEAF has no king, and the reason is not modesty: the forest decides for itself. A Keeper's entire training is learning to notice the moment it has."
     },
    // Gates. Rosters live in `adds` because a gate is a checkpoint, not a farm —
    // its squad is a mixed border patrol of BOTH elements, and putting real
    // cards in a recruitable roster would place them a second time.
    { id: "GA", name: "Gate A: Summer's Southern Burn", kind: "gate", at: { x: 63, y: 94 },
      requires: ["L14"], roster: [], opens: ["pyro"],
      adds: ["leaf_gecko", "leaf_dartfrog", "pyro_staph", "pyro_sparky", "pyro_florence", "pyro_ingit", "leaf_alpha", "pyro_firebird"],
      demand: { kind: "attack", value: "Ranged", count: 3 },
      note: "The open road south. The burn punishes anything that has to close distance.",
      lore: "The forest simply stops here, in a line nobody drew. LEAF calls it the Southern Burn and PYRO the northern treeline, and both are naming the same scorched mile."
     },
    { id: "GB", name: "Gate B: Eastleaf Port", kind: "gate", at: { x: 93, y: 30 },
      requires: ["L14"], roster: [], opens: ["aqua"],
      adds: ["leaf_hunter", "leaf_walking_tree", "aqua_misty", "aqua_buccaneers", "aqua_piranha", "aqua_blub", "leaf_bark_bushmen", "aqua_bahari"],
      demand: { kind: "class", value: "Support", count: 2 },
      note: "The sea road east. A long crossing — bring something that can keep a crew alive.",
      lore: "Eastleaf keeps no harbourmaster. A ship is met by whichever Autumn family is nearest the water, an arrangement the sea trade long ago stopped finding strange."
     },
  ],
};


// ── the PYRO slice ──────────────────────────────────────────────────────────
// Act II, the land march. Reached through Gate A, the Southern Burn. Placed
// against `public/maps/pyro.webp`; where the doc's flow chart and the painting
// disagreed about adjacency, the painting won — same rule as LEAF.

const PYRO: StoryRegion = {
  id: "pyro",
  name: "Pyro — The Burning South",
  element: "PYRO",
  terrain: "Heatwave",
  board: 4,
  opening: { node: "P1", epic: "pyro_tiki" },
  throne: "P13",
  art: "/maps/pyro.webp",
  artRatio: 1536 / 1024,
  requires: ["GA", "GC2"], // Gate A from LEAF, or Gate C from AQUA
  // The Veil Gate: the art paints DUSK's corruption already bleeding through it.
  blightAt: { x: 80, y: 87 },
  nodes: [
    // Two arms out of Ashfall — the city road south-east and the forge road
    // west — converging on the Inner Keep and then the Dragon's Lair.
    { id: "P1", name: "Ashfall Approach", kind: "skirmish", at: { x: 52, y: 17 },
      requires: [], roster: ["pyro_staph", "pyro_sparky", "pyro_florence"], adds: [],
      note: "Where the forest dies. The road back to LEAF is right behind you.",
      lore: "Where other nations fear the volcano, PYRO simply built a city that agrees with it. Flame fuels progress, and the strongest rule — stamped into every gate and forge-wall in the city."
    },
    { id: "P3", name: "Cinder Road", kind: "skirmish", at: { x: 61, y: 27 },
      requires: ["P1"], roster: ["pyro_ingit", "pyro_bbq", "pyro_baboom", "pyro_taper"], adds: [],
      lore: "No one laid the Cinder Road: ash banked against ash for longer than the city has kept records, until there was a road, and PYRO counts that as having built it."
     },
    { id: "P4", name: "Dessaer District: Forge of Fire", kind: "skirmish", at: { x: 30, y: 31 },
      requires: ["P1"], roster: ["pyro_smog_card", "pyro_heatsink_golem", "pyro_spitfire", "pyro_dyna"], adds: [],
      note: "Forged Tech works. Fight the tribe here before you meet its Mythic at the Forge Core.",
      lore: "The Forged are not soldiers first but makers: constructs, war-engines, and the strange half-alive machinery that keeps the city's less glamorous work running."
    },
    { id: "P5", name: "The Slagfields", kind: "skirmish", at: { x: 84, y: 31 },
      requires: ["P3"], roster: ["pyro_ash_boar", "pyro_slag_tortoise", "pyro_ember_scorpion", "pyro_wick"], adds: [],
      note: "Cooled lava badlands. Four Rares and no champion — the heaviest Skirmish in the region.",
      lore: "The name suggests a dumping ground. The Slagfields are older than the forges that would have filled them — this is lava the mountain put down and has never come back to collect."
     },
    { id: "P6", name: "Pyro City Gates", kind: "warden", at: { x: 46, y: 55 },
      requires: ["P3"], roster: ["pyro_firebird", "pyro_liza", "pyro_scully"], adds: [],
      lore: "Pyro City's gates have hinges that have never been used. Closing one would concede there is something out there worth closing against, and nobody here will say that aloud."
     },
    { id: "P9", name: "Firespine Foothills", kind: "warden", at: { x: 16, y: 34 },
      requires: ["P4"], roster: ["pyro_fenrir", "pyro_firefly", "pyro_twins"], adds: [],
      note: "The whole Cost-5 band on one node. The last gate before the Landmarks.",
      lore: "Above the last forge the slopes belong to whatever climbed there first. PYRO stopped building at that line and still calls the decision a courtesy rather than a retreat."
     },
    { id: "P7", name: "Ember Fortress Drill Yard", kind: "warden", at: { x: 68, y: 41 },
      requires: ["P6"], roster: ["pyro_woof", "pyro_scorch", "pyro_tiki"], adds: [] ,
      lore: "The Pyro Knights garrison here. Where the Forged build the city's strength, the Knights are sworn to make sure nothing ever gets close enough to test it."
    },
    { id: "P8", name: "Forgotten Ruins", kind: "warden", at: { x: 88, y: 57 },
      requires: ["P5"], roster: ["pyro_sarra", "pyro_sseerr", "pyro_fenix"], adds: [],
      note: "Half-buried civilization. Where a LEAF-only deck stops working — three BURN Epics with real Specials.",
      lore: "Pyro City was built, quite literally, on top of whatever came before it — and has never once apologized for building over the evidence."
    },
    // Gated off the city, not off P1: the painted road to the harbour runs
    // through Pyro City. Still only four nodes deep, which keeps the doc's
    // point that a player finding PYRO too punishing can sail out early.
    { id: "P2", name: "Sunfall Coast", kind: "skirmish", at: { x: 34, y: 88 },
      requires: ["P6"], roster: ["pyro_flamehound", "pyro_firecrack", "pyro_canister"], adds: [],
      overflow: ["aqua_buccaneers"], // pirate haven — the sea road to AQUA
      note: "Pirate haven. Gate C opens the sea route to AQUA from here.",
      lore: "Ships fly no particular flag here. The city tolerates it the way a forge tolerates ash: not proudly, but as an acknowledged cost of the fire being worth having."
    },
    { id: "P10", name: "Ember Fortress: Inner Keep", kind: "landmark", at: { x: 74, y: 49 },
      requires: ["P7", "P8"], roster: ["pyro_infernus_rex", "pyro_magmadon", "pyro_magmaw"], adds: [],
      note: "The three heavy bruisers. Magmaw exists only in the live build — no project doc has it.",
      lore: "The Inner Keep's heaviest walls face inward — a detail visitors notice and the garrison declines to explain. Ember Fortress was raised around what PYRO keeps, not against what might arrive."
     },
    { id: "P11", name: "Sunfall Watch", kind: "landmark", at: { x: 62, y: 72 },
      requires: ["P2", "P10"], roster: ["pyro_volcanon", "pyro_sol", "pyro_aftermath", "pyro_dynomight"], adds: [],
      note: "The Cost-6 utility tier, all four on one node.",
      lore: "Sunfall Watch counts the days the Firespine has left before it opens again. That number has only ever changed how hot the forges run, never who was told to leave."
     },
    { id: "P13", name: "Firespine Peaks: Dragon's Lair", kind: "throne", at: { x: 10, y: 53 },
      requires: ["P9", "P10"], roster: ["pyro_pyrogon"],
      // Escorts: the volcanic beasts of the slopes, farmable at P5.
      adds: ["pyro_ash_boar", "pyro_wick", "pyro_firebird"], required: true,
      note: "Required. Clearing it opens Gate D — the Veil Gate, and the DUSK reach.",
      lore: "Every child here is raised on the same understanding: the city's fire and the Dragon's fire are the same fire, and the Dragon has simply been keeping more of it, longer, than anyone alive."
    },
    { id: "P12", name: "The Forge Core", kind: "throne", at: { x: 23, y: 66 },
      requires: ["P13"], roster: ["pyro_nitro"],
      // Escorts: Forged Tech, the tribe Nitro tops — farmable at P4.
      adds: ["pyro_heatsink_golem", "pyro_dyna", "pyro_liza"],
      note: "Optional. Where the first flame burns — Forged Tech's Mythic.",
      lore: "The Flame Spire has never gone cold, not once in any account anyone still tells. Every district's forge-fire is lit, however many generations removed, from that first flame."
    },
    // Gate C, PYRO side. Its twin sits on AQUA's map, so switching routes never
    // means walking back through LEAF.
    { id: "GC", name: "Gate C: Sunfall Harbor", kind: "gate", at: { x: 53, y: 94 },
      requires: ["P2"], roster: [], opens: ["aqua"],
      adds: ["pyro_flamehound", "pyro_canister", "aqua_buccaneers", "aqua_bootlegger", "aqua_piranha", "aqua_blub", "pyro_liza", "aqua_blackice"],
      demand: { kind: "class", value: "Tank", count: 3 },
      note: "Boarding actions in the pirate lanes. Bring bodies that can hold a deck.",
      lore: "Neither nation admits to governing the harbour and both collect a fee at it. The arrangement has outlasted three separate attempts to write it down."
     },
  ],
};


// ── the AQUA slice ──────────────────────────────────────────────────────────
// Act II, the naval route — the other half of the branch. Reached through Gate
// B. Placed against `public/maps/aqua.webp`, which is 4:3 rather than the 3:2
// of the other two. AQUA is the one region where long edges are honest: the art
// draws dashed sea lanes radiating from Atlantis to every corner, so ships DO
// cross open water rather than following a road.

const AQUA: StoryRegion = {
  id: "aqua",
  name: "Aqua — The Life Source",
  element: "AQUA",
  terrain: "Downpour",
  board: 4,
  opening: { node: "A1", epic: "aqua_blackice" },
  throne: "A13",
  art: "/maps/aqua.webp",
  artRatio: 1440 / 1080,
  requires: ["GB", "GC"], // Gate B from LEAF, or Gate C from PYRO
  // The Drowned Blight: the art already paints DUSK's violet across the
  // south-east water.
  blightAt: { x: 86, y: 91 },
  nodes: [
    { id: "A1", name: "Leafward Crossing", kind: "skirmish", at: { x: 24, y: 30 },
      requires: [], roster: ["aqua_misty", "aqua_buccaneers", "aqua_piranha"], adds: [],
      note: "Where ships arrive. Misty and Saltjacks bleed out to LEAF and PYRO — this is their home.",
      lore: "Not simply the sea between the continents: the Life Source of the World, the endless water that sustained life before there were eight elements to sustain."
    },
    { id: "A2", name: "Coral Isles Shallows", kind: "skirmish", at: { x: 8, y: 44 },
      requires: ["A1"], roster: ["aqua_blub", "aqua_anglerfish", "aqua_subcool"], adds: [],
      lore: "AQUA's shallowest people: a whole culture living where the bottom is always underfoot. Outsiders read that as caution, and the isles call it the floor of the house."
     },
    { id: "A3", name: "Aqua Village Docks", kind: "skirmish", at: { x: 17, y: 54 },
      requires: ["A1"], roster: ["aqua_arctik", "aqua_bootlegger", "aqua_harp", "aqua_kinguin"],
      adds: ["aqua_guin_tok"] ,
      lore: "Harmony between land and sea, half on stilts and half submerged. Where most outsiders first meet AQUA, and where AQUA first decides whether it likes them."
    },
    { id: "A4", name: "Corsair Lanes", kind: "warden", at: { x: 26, y: 64 },
      requires: ["A3"], roster: ["aqua_bulletshrimp", "aqua_icyninza", "aqua_krakler", "aqua_spinefin"], adds: [],
      note: "The SeaC crews. Krakler is what Siren turns into — you meet the shape before the source.",
      lore: "Sailors without kings, seekers of treasure and infamy, answering to no crown and no council. A kingdom, they'll tell you, is just a very large ship no one's allowed to leave."
    },
    { id: "A5", name: "The Reef Wall", kind: "skirmish", at: { x: 9, y: 63 },
      requires: ["A2"], roster: ["aqua_coralgolem", "aqua_siphon", "aqua_tide"], adds: [],
      overflow: ["pyro_canister"], // fronts the open sea route to PYRO
      note: "The Talent node — Siphon and Tide both carry once-per-game Talents. The clearest teaching fight for them.",
      lore: "Most of what AQUA eats begins somewhere on the reef. Nobody quarries it, nobody anchors on it, and no crew in these lanes has ever had to be told why."
     },
    { id: "A6", name: "Mists of Despair", kind: "warden", at: { x: 28, y: 85 },
      requires: ["A5"], roster: ["aqua_octoirate", "aqua_bahari", "aqua_blackice"], adds: [],
      note: "Shipwreck boneyard, perpetual fog.",
      lore: "A shipwreck boneyard wrapped in fog that has never once lifted for a living sailor. Neither AQUA nor DUSK claims what happens inside, and neither has gone looking."
    },
    // Gated off A1, not A3: the floes are the next water NORTH of where ships
    // arrive, while the village is well south of them.
    { id: "A7", name: "Northern Ice Floes", kind: "skirmish", at: { x: 38, y: 18 },
      requires: ["A1"], roster: ["aqua_icynin", "aqua_owlette", "aqua_polarbear"], adds: [],
      lore: "The Ice Kingdom's outermost water — a border never twice the same shape. Its northern families name every floe they winter on, and keep the name long after the floe is gone."
     },
    { id: "A8", name: "Ice Castle Outer Ward", kind: "warden", at: { x: 46, y: 26 },
      requires: ["A7"], roster: ["aqua_cryo", "aqua_anos", "aqua_icewall"], adds: [],
      note: "Ice Wall belongs to the castle it walls. A real wall, not a damage race — bring something that gets through 20 HP behind BLOCK.",
      lore: "The Ice Kingdom does not simply neighbour the Arctic. \"Descendants of the frozen deep\" is not a poetic title to them. It is a genealogy."
    },
    // Gated off A8, not A6: the Trench is painted on the EAST edge and the mists
    // are in the far south-west. The lane from the Ice Castle is the short one.
    { id: "A9", name: "The Steamvent Trench", kind: "warden", at: { x: 78, y: 40 },
      requires: ["A8"], roster: ["aqua_sapphire", "aqua_vaporem", "aqua_blackbeard", "aqua_liquark"], adds: [],
      note: "The spike — three Cost-5s and a lurker, 19 gold of board. Liquark hunts from the vents rather than holding a line.",
      lore: "Scalding water and freezing water meet along the trench and neither wins. In the deep, cold and heat have never needed permission to coexist." },
    { id: "A10", name: "Ice Castle: Guardians of Ice", kind: "landmark", at: { x: 60, y: 14 },
      requires: ["A8"], roster: ["aqua_polarking", "aqua_phrost", "aqua_glacius"], adds: [],
      note: "A pure FREEZE wall, and the only node touching the Arctic Gate — DAWN's border, sealed until Act V.",
      lore: "Three nations claim the Frozen Citadel, and the Guardians have never confirmed any of them — either diplomacy, or the oldest joke in Concord, depending entirely on who's asking."
    },
    { id: "A11", name: "Atlantis Outer Ring", kind: "landmark", at: { x: 65, y: 55 },
      requires: ["A6", "A9"], roster: ["aqua_siren", "aqua_rain", "aqua_driftwraith", "aqua_magalogoon"], adds: [],
      note: "Four Legendaries — the richest node in the first three acts. Both arms of the sea have to be yours first.",
      lore: "Everything the sea carries stops at the outer ring, and almost none of it was invited. Atlantis does not refuse arrivals. It simply lets the ring do the deciding."
     },
    { id: "A13", name: "Atlantis: Heart of the Ocean", kind: "throne", at: { x: 50, y: 45 },
      requires: ["A11"], roster: ["aqua_hydrogon"],
      // Escorts: the reef that guards the city, farmable at A5.
      adds: ["aqua_coralgolem", "aqua_tide", "aqua_blackice"], required: true,
      note: "Required. Clearing it opens the sea lanes, which is what makes the rest of the campaign non-linear.",
      lore: "Press an elder and the answer is always some version of the same sentence: \"Atlantis was not lost. It was put down there.\" No one has ever gotten one to finish explaining."
    },
    { id: "A12", name: "The Deep", kind: "throne", at: { x: 54, y: 88 },
      requires: ["A13"], roster: ["aqua_kraken"],
      // Escorts: the deep's own, farmable at A4.
      adds: ["aqua_krakler", "aqua_spinefin", "aqua_bahari"],
      note: "Optional, and the hardest fight in Act II — deliberately harder than either required Throne.",
      lore: "Some say the Deep is a place. Some say it is a thing — the oldest and hungriest of the Deep Creatures, coiled beneath the city, keeping something in or keeping something out."
    },
    // Gate F: the Arctic Gate. The AQUA art paints it "To Dawn (Locked)" — it
    // stays sealed until Act V, so it wants two of the three Gray Thrones just
    // as the Shadow Border does. Neither Act V region is gated on the other.
    { id: "GF", name: "Gate F: The Arctic Gate", kind: "gate", at: { x: 46, y: 7 },
      requires: ["G14", "B14", "R14"], requiresCount: 2, roster: [], opens: ["dawn"],
      adds: ["aqua_cryo", "aqua_anos", "dawn_beam", "dawn_flash", "dawn_able", "dawn_sparkle", "aqua_icynin", "dawn_amble"],
      demand: { kind: "class", value: "Mage", count: 3 },
      note: "The road through the ice wall. Nothing has crossed it in either direction all campaign.",
      lore: "DAWN opens the ice from the far side, or it does not open. The Golden Kingdom has never explained the rule, and the nations below it have stopped asking for one."
     },
    // Gate E: the Gray Continent ports. Gated on BOTH Green Thrones rather than
    // AQUA's alone — §2 makes PYRO and AQUA mandatory before Act IV so the
    // player reaches the 5x5 board with a three-element pool.
    { id: "GE", name: "Gate E: Gray Continent Ports", kind: "gate", at: { x: 88, y: 20 },
      requires: ["A13", "P13"], roster: [], opens: ["gale", "bolt", "bore"],
      adds: ["aqua_arctik", "aqua_harp", "gale_sirocco", "gale_megair", "gale_gastly", "gale_skyforce", "aqua_bahari", "gale_angale"],
      demand: { kind: "attack", value: "Ranged", count: 4 },
      note: "The airship lanes north. Everything past here is fought on the 5x5 board.",
      lore: "The crossing that made the Gray Continent reachable at all. Every line running north still paints the old charter markings on its hulls, centuries after the company that issued them dissolved."
     },
    // Gate C, AQUA side — the same harbor from the other direction.
    { id: "GC2", name: "Gate C: Sunfall Harbor", kind: "gate", at: { x: 10, y: 72 },
      requires: ["A5"], roster: [], opens: ["pyro"],
      adds: ["aqua_buccaneers", "aqua_bootlegger", "pyro_flamehound", "pyro_canister", "pyro_firecrack", "pyro_taper", "aqua_icynin", "pyro_scorch"],
      demand: { kind: "class", value: "Tank", count: 3 },
      note: "The same harbor from the water. Sail east and PYRO's coast is yours without going back through LEAF.",
      lore: "The glow reaches a ship long before the coast does. AQUA's charts mark Sunfall by that light rather than its docks, and no captain has ever admitted to steering by another nation's fire."
     },
  ],
};


// ── the GALE slice ──────────────────────────────────────────────────────────
// Act IV, the sky route, and the first region on the **5x5 board** — the
// campaign's biggest structural break. Highest average SP in the game, and
// Jetstream compounds it, so this is where initiative decides exchanges before
// damage is ever compared.
//
// Long edges are honest here for the same reason they are in AQUA: the art is
// open plains and circling raptors, and the region travels by wind. The
// Roosts really are that far south-east of the Amberleaf.

const GALE: StoryRegion = {
  id: "gale",
  name: "Gale — The Gray Continent North",
  element: "GALE",
  terrain: "Jetstream",
  board: 4,
  opening: { node: "G1", epic: "gale_vvulture" },
  throne: "G14",
  art: "/maps/gale.webp",
  artRatio: 1536 / 1024,
  requires: ["GE"],
  // The Blighted Plains: the art paints DUSK's violet across the whole southern
  // margin, and names it "Spawn of the Storm".
  blightAt: { x: 46, y: 85 },
  nodes: [
    { id: "G1", name: "Windward Steps", kind: "skirmish", at: { x: 14, y: 33 },
      requires: [], roster: ["gale_gastly", "gale_megair", "gale_sirocco"], adds: [],
      note: "Where the airships put down. The sea road back to AQUA is west.",
      lore: "GALE's proof of strength is simpler than any other nation's: you're still here, and the storm hasn't taken you yet."
    },
    { id: "G2", name: "Amberleaf Groves", kind: "skirmish", at: { x: 26, y: 46 },
      requires: ["G1"], roster: ["gale_skyforce", "gale_swillow", "gale_syt_bird"], adds: [],
      note: "Orangewood bent flat by the wind.",
      lore: "GALE's only forest. Its orangewood exists for exactly one purpose — standing between the worst of the storms and the people trying to grow something in its shadow. No one worships it. They thank it."
    },
    { id: "G3", name: "The Rolling Flats", kind: "skirmish", at: { x: 40, y: 56 },
      requires: ["G2"], roster: ["gale_breeze", "gale_duster", "gale_tumbleweed"], adds: [],
      lore: "Open ground in every direction, and a prevailing wind steady enough to reckon by. GALE gives directions across the Flats in hours of wind, not in distance."
     },
    { id: "G5", name: "Dark Wind Township", kind: "skirmish", at: { x: 17, y: 79 },
      requires: ["G2"], roster: ["gale_luna", "gale_wailverine", "gale_windsor"], adds: [],
      note: "Under perpetual cloud. The Wolves start here — Luna is the first of the pack.",
      lore: "GALE's furthest edge, where the nation's own patience runs out and its rawest weather takes over. Airship and sea traffic cross here more often than either nation admits."
    },
    { id: "G4", name: "The Raptor Roosts", kind: "skirmish", at: { x: 89, y: 79 },
      requires: ["G3"], roster: ["gale_toxhawk", "gale_hawk", "gale_hawko"], adds: ["gale_toxhawk_tok"],
      note: "Cliffside aeries. Fight the birds here before you meet what raises them.",
      lore: "Wyverns and young dragons test their wings in GALE's storms before they are strong enough to fly anywhere else in Concord. This sky is a proving ground for more than GALE's own people."
    },
    { id: "G6", name: "Northern Wind Villages", kind: "warden", at: { x: 38, y: 22 },
      requires: ["G3"], roster: ["gale_vvulture", "gale_stormhide_bison", "gale_whirlwolf"], adds: [] ,
      lore: "Farmsteads and highland homes behind the natural windbreaks of the Amberleaf. GALE's villages are practical in a way few other nations bother to be."
    },
    { id: "G8", name: "Gale Village", kind: "warden", at: { x: 58, y: 35 },
      requires: ["G3"], roster: ["gale_klouy", "gale_vaga", "gale_fano"], adds: [],
      note: "The hardy people of the Orange Plains, and the wandering twisters they live with.",
      lore: "Funnel clouds rise and dissolve across the horizon on any given day, and the nation's heart has simply learned to build around them rather than pretend they'll stop."
    },
    { id: "G7", name: "Skyforge Aerie", kind: "warden", at: { x: 91, y: 62 },
      requires: ["G4"], roster: ["gale_angale", "gale_buf", "gale_sway"], adds: ["gale_ollie"],
      note: "Sway's Birds of Prey spawns Ollie, so the filler here is diegetic rather than padding.",
      lore: "GALE does not train the birds of this aerie. It keeps an arrangement with them, and its handlers say it has always been the bird's to end."
     },
    { id: "G9", name: "The Shrike Line", kind: "warden", at: { x: 72, y: 58 },
      requires: ["G7", "G8"], roster: ["gale_guan", "gale_masala", "gale_rayfen"],
      adds: ["gale_toxhawk_tok"],
      note: "Mesala's Raptor Assault raises the same bird you fought at the Roosts.",
      lore: "Shrikes keep their larder along the thorn line, and GALE has never thinned it. A bird that stores more than it can eat is a neighbour this nation understands."
     },
    { id: "G10", name: "Stormwall Approach", kind: "warden", at: { x: 73, y: 27 },
      requires: ["G6"], roster: ["gale_omega", "gale_wista", "gale_wolfbane"], adds: [],
      note: "Omega and Luna were written as a pair — this is where the pack closes.",
      lore: "GALE's mapmakers draw exactly one fixed line on the continent, and the Stormwall is it. They have redrawn it four times in living memory and still call it fixed."
     },
    { id: "G11", name: "Stormwatch Cliffs: The Totem", kind: "landmark", at: { x: 84, y: 52 },
      requires: ["G9", "G10"], roster: ["gale_eagon", "gale_tempest", "gale_totem"],
      adds: ["gale_totem_pole"],
      note: "The wind elemental shrine. The only node in the game whose filler is a Legendary-rarity token.",
      lore: "Stormwatch keeps no calendar of years. It keeps a count of the totems the cliffs have taken, and a second count of the ones standing again before anyone climbed up to raise them."
     },
    { id: "G12", name: "The Eye of the Storm", kind: "landmark", at: { x: 60, y: 80 },
      requires: ["G5", "G9"],
      roster: ["gale_bluejay", "gale_galeon", "gale_klipso", "gale_kloud"], adds: [],
      note: "The whole Cost-7 Legendary band on one node — the richest recruit in Act IV.",
      lore: "The only still air in GALE, and the least trusted: a people who read wind for warning have never settled on what to make of a place with nothing to read."
     },
    { id: "G13", name: "Wolfrun Hollow", kind: "throne", at: { x: 62, y: 10 },
      requires: ["G10"], roster: ["gale_stormfang"],
      // Escorts: the pack itself, farmable at G6 and G5.
      adds: ["gale_whirlwolf", "gale_luna", "gale_buf"],
      note: "StormFang's Throne. Optional — the Wolf payoff, and its Pack aura reaches four cards you already met.",
      lore: "Wolfrun does not hunt its wolves. It watches them — the pack picks its ground by weather that has not arrived yet, and a village that ignores where they run loses roofs."
     },
    { id: "G14", name: "Tempest Peaks", kind: "throne", at: { x: 93, y: 26 },
      requires: ["G11", "G12"], roster: ["gale_griffith"],
      // Escorts: the birds of the Roosts, farmable at G4 and G2.
      adds: ["gale_ollie", "gale_hawk", "gale_skyforce", "gale_angale"], required: true,
      note: "Thunder Reach. Required — clearing it opens the airship routes on to BOLT and BORE.",
      lore: "Past Stormwatch the storms stop being merely violent and become constant — close enough to BOLT that lightning from both skies is hard to tell apart by the time it reaches the ground."
    },
  ],
};


// ── the BOLT slice ──────────────────────────────────────────────────────────
// Act IV, the combo route, 5x5. ELECTRIFIED marks anything it touches and BOLT
// cards hit status-carriers for +2, so the region teaches punishment chains:
// apply, then capitalise. The most mechanically demanding of the three Gray
// Continent regions and the one most likely to punish an unfocused deck.

const BOLT: StoryRegion = {
  id: "bolt",
  name: "Bolt City — Tech Heart of the Continent",
  element: "BOLT",
  terrain: "Power Grid",
  board: 4,
  opening: { node: "B1", epic: "bolt_surge" },
  throne: "B14",
  art: "/maps/bolt.webp",
  artRatio: 1440 / 1080,
  requires: ["GE"],
  // The Blighted Margin: the art names it the southern industrial blight zone
  // and even prints a contamination key for it.
  blightAt: { x: 36, y: 90 },
  nodes: [
    { id: "B1", name: "Scrapyard Verge", kind: "skirmish", at: { x: 16, y: 30 },
      requires: [], roster: ["bolt_junker", "bolt_zap", "bolt_twotales"], adds: [],
      note: "Where the sea road from AQUA meets the sprawl.",
      lore: "\"Magic is just power no one's bothered to wire up yet.\" Painted above the door of every research wing in the city."
    },
    { id: "B2", name: "Drone Field", kind: "skirmish", at: { x: 27, y: 46 },
      requires: ["B1"], roster: ["bolt_rodd", "bolt_stingray", "bolt_zipp"], adds: ["bolt_drone_tok"],
      note: "Neon sprawl and strung cables. Zipp's Swarm Deploy makes the Drones.",
      lore: "BOLT wires ground before anyone settles it. The lines go out to empty lots first, and whoever builds there afterwards is treated as proof the survey was right."
     },
    { id: "B3", name: "Substation Row", kind: "skirmish", at: { x: 34, y: 33 },
      requires: ["B1"], roster: ["bolt_drshock", "bolt_electricel", "bolt_jolt"], adds: [],
      lore: "Substation Row splits the city's current between districts, and posts the division publicly each morning. BOLT holds that a grid nobody can audit is a grid somebody has already tapped."
     },
    { id: "B4", name: "The Static Flats", kind: "skirmish", at: { x: 28, y: 12 },
      requires: ["B3"], roster: ["bolt_ning", "bolt_scrapper", "bolt_staticcloud"],
      adds: ["bolt_static_wisp_tok"],
      note: "Fused glass and a lightning-scarred gateway. The north road to GALE runs through here.",
      lore: "BOLT did not merely build lines to carry lightning after it struck. It built a spire at the border to gather it before it has finished being GALE's storm at all."
    },
    { id: "B5", name: "Conduit Marsh", kind: "skirmish", at: { x: 26, y: 63 },
      requires: ["B2"], roster: ["bolt_buzz", "bolt_buzzard", "bolt_jellyfish"], adds: ["bolt_drone_tok"],
      note: "The same Drone from a second source — Buzzard's Drone Sweep.",
      lore: "Wet ground carries a charge better than dry, which is the only reason the marsh was never drained. BOLT keeps it flooded on purpose and treats the water as wiring."
     },
    { id: "B6", name: "Breaker Yard", kind: "warden", at: { x: 41, y: 41 },
      requires: ["B3"], roster: ["bolt_lytning", "bolt_storm", "bolt_zagphu"], adds: [],
      lore: "Every grid fails somewhere, and BOLT's answer was to decide in advance where. The Breaker Yard is the address the rest of the city agreed to hand it."
     },
    { id: "B8", name: "Overload Junction", kind: "warden", at: { x: 63, y: 45 },
      requires: ["B6"], roster: ["bolt_shoksa", "bolt_striik", "bolt_thundercat"], adds: [],
      lore: "More current arrives at the junction than anything downstream of it can spend, and that is the specification, not an accident. Overload was a boast before anyone read it as a warning."
     },
    { id: "B7", name: "Arc Industries Yards", kind: "warden", at: { x: 89, y: 55 },
      requires: ["B8"], roster: ["bolt_static", "bolt_webster", "bolt_sentry"], adds: [],
      note: "Cooling towers and conduit pylons. The ARC spine starts here — every one of them Epic or above.",
      lore: "The mega fabrication plant. Machines, weapons, innovation: if it can be built, Arc Industries has already built a faster version."
    },
    { id: "B9", name: "The Forge Grid", kind: "warden", at: { x: 79, y: 41 },
      requires: ["B7"], roster: ["bolt_surge", "bolt_voltcher", "bolt_kore"],
      adds: ["bolt_static_wisp_tok"] ,
      lore: "Voltis Plaza honours whoever first proved storm-lightning could be caught. The official histories name no one. Ask an old GearHollow dwarf and you may get a different answer."
    },
    { id: "B10", name: "Forsaken Heights", kind: "warden", at: { x: 88, y: 21 },
      requires: ["B9"], roster: ["bolt_general", "bolt_thunder", "bolt_volta"], adds: [],
      note: "Iron lightning-rods drawing the storm. Volta's Grid Deployment spawns Rodd — a card you already own from the Drone Field.",
      lore: "The Heights were homes before they were rods. BOLT records the buyout as an upgrade — a word none of the families who signed it has ever used since."
     },
    { id: "B11", name: "The Hive Array", kind: "landmark", at: { x: 72, y: 67 },
      requires: ["B5", "B9"], roster: ["bolt_jack_arc", "bolt_keeper", "bolt_shock", "bolt_zoez"],
      adds: ["bolt_beebot"],
      note: "GearHollow's swarm. Keeper breeds a Beebot every round to a cap of 5 — solve the engine, not the board.",
      lore: "GearHollow's dwarves sign nothing they build. In the tunnels a name on a diagram reads as an admission that one person could have got the whole thing wrong."
     },
    { id: "B12", name: "Stormcaller's Spire", kind: "landmark", at: { x: 66, y: 18 },
      requires: ["B4", "B10"], roster: ["bolt_gigavolt", "bolt_stormcaller", "bolt_voltogon"],
      adds: ["bolt_static_wisp_tok"],
      note: "By the airship docks. GigaVolt's Turret Mode pins the board with ELECTRIFIED, which turns every other BOLT card into a +2 threat.",
      lore: "GALE's storms are sacred and untamed. BOLT's engineers look at the same lightning and ask a very different question: what is this actually for?"
    },
    { id: "B13", name: "The Grid Vault", kind: "throne", at: { x: 43, y: 83 },
      requires: ["B11"], roster: ["bolt_velvolt_knight"],
      // Escorts: the Drone Field's own, farmable at B2.
      adds: ["bolt_drone_tok", "bolt_zipp", "bolt_rodd", "bolt_static"],
      note: "Sealed below the core behind blast doors. Optional.",
      lore: "A season of charge, sealed under the city and never once drawn on. BOLT files it as ballast rather than reserve: a grid this large needs weight at the bottom of it."
     },
    { id: "B14", name: "City Power Core", kind: "throne", at: { x: 50, y: 31 },
      requires: ["B11", "B12"], roster: ["bolt_elecdroid"],
      // Escorts: the scrapyard where the region started, farmable at B1.
      adds: ["bolt_beebot", "bolt_zap", "bolt_junker", "bolt_lytning"], required: true,
      note: "The Arc Lightning Conduit itself. Required — clearing it opens the mountain pass to BORE.",
      lore: "BOLT calls the Core a machine — engineered, replicable, understood. Its senior engineers admit, quietly, that no one has explained why it draws more power than its conduits should allow."
    },
  ],
};


// ── the BORE slice ──────────────────────────────────────────────────────────
// Act IV, the grind route, 5x5 — and the last of the Gray Continent. Shields,
// BLOCK, and walls that do not fall to one good turn: Exostone plates every
// enemy on arrival by rarity, caps their shield loss at one plate per hit
// however hard you swing, and pays them a shield back for every plate they
// break off you. No other region punishes a deck with no way through armour
// this directly.
//
// BORE has NO tokens, so its filler is non-recruitable duplicate Rares drawn
// from cards already placed elsewhere in the region — the same fallback PYRO
// needs, and the reason the adds rule is "farmable somewhere" rather than
// "must be a token".

const BORE: StoryRegion = {
  id: "bore",
  name: "Bore — Bore Mountain & Reveen",
  element: "BORE",
  terrain: "Bedrock",
  board: 4,
  opening: { node: "R1", epic: "bore_monger" },
  throne: "R14",
  art: "/maps/bore.webp",
  artRatio: 1440 / 1080,
  requires: ["GE"],
  // The corruption band the art paints across the bottom, beside the locked
  // Shadow Border. It even ships a legend: light / moderate / severe.
  blightAt: { x: 24, y: 88 },
  nodes: [
    { id: "R1", name: "Quarry Mouth", kind: "skirmish", at: { x: 22, y: 16 },
      requires: [], roster: ["bore_cavedweller", "bore_iron", "bore_kcor"], adds: [],
      note: "The Reveen Foothills, where the mountain pass down from BOLT lets out.",
      lore: "Not old the way a kingdom counts its kings — old the way stone is old: unhurried, and entirely uninterested in proving anything to anyone in less time than it takes."
    },
    { id: "R2", name: "Rubble Road", kind: "skirmish", at: { x: 36, y: 22 },
      requires: ["R1"], roster: ["bore_cosmic", "bore_crock", "bore_hillbilly"], adds: [],
      lore: "Reveen's hill folk do not repair the road so much as walk it flat again. Some of the stone they shoulder aside did not fall from the mountain."
     },
    { id: "R3", name: "The Smithy Camp", kind: "skirmish", at: { x: 23, y: 47 },
      requires: ["R1"], roster: ["bore_clubber", "bore_rockgoblin", "bore_smith"], adds: [],
      note: "Open forges — home of the legendary crafters.",
      lore: "Nothing leaves the Black Smith's forges quickly. BORE's crafters have never once apologized for a customer who waited a year for something worth carrying for a lifetime."
    },
    { id: "R4", name: "Sand Village", kind: "skirmish", at: { x: 23, y: 80 },
      requires: ["R3"], roster: ["bore_old_timer", "bore_sling", "bore_thorny_ripper"], adds: [],
      note: "Desert dwellers under cloth awnings. We trade, travel, survive.",
      lore: "Desert dwellers who live not in the mountain's stone but on its sand — closer to the Worm's territory than anyone in the Fortress would prefer, and entirely unbothered by that fact."
    },
    { id: "R5", name: "Mountain Beast Range", kind: "skirmish", at: { x: 52, y: 20 },
      requires: ["R2"], roster: ["bore_ankylosaur", "bore_armadillo", "bore_warthog"], adds: [],
      note: "The armour school — three Tanks, two of them Granite. A deck that cannot break shields stops here, early enough to be a lesson rather than a wall.",
      lore: "The herds were on this range before anyone thought to name it, and BORE has never fenced a foot of it. Grazing rights here run the other direction."
     },
    { id: "R6", name: "The Standing Stones", kind: "skirmish", at: { x: 65, y: 34 },
      requires: ["R5"], roster: ["bore_rock", "bore_stone", "bore_ufo"], adds: [],
      note: "Out toward the sand worm's dunes. UFO is 2 HP behind 5 shields that irradiates the whole board — the damage is trivial, getting to it is the fight.",
      lore: "A single vast Sand Worm prowls the depths, dragging the dunes into slow spiralling wounds when it surfaces. BORE's storytellers never call it the only one. They call it the one that's already awake."
    },
    { id: "R7", name: "Faultline", kind: "warden", at: { x: 30, y: 38 },
      requires: ["R5"], roster: ["bore_shift", "bore_valcana", "bore_rhe"],
      adds: ["bore_cosmic", "bore_crock"],
      lore: "The stonework here is set without mortar on purpose: the ground can shift a hand's width and the wall goes with it. Building rigid was tried once."
     },
    { id: "R8", name: "Crystal Seam", kind: "warden", at: { x: 9, y: 38 },
      requires: ["R3"], roster: ["bore_krysteel", "bore_lithara", "bore_monger"],
      adds: ["bore_smith", "bore_clubber"],
      note: "Giant mystical crystals, light spilling out of the rock.",
      lore: "Giant mystical crystals grow undisturbed here. The scholars who first theorized the War Element still cross-reference their notes against something they only ever call \"the deeper hum.\""
    },
    { id: "R9", name: "The Rolling Deep", kind: "warden", at: { x: 52, y: 45 },
      requires: ["R7"], roster: ["bore_rollo", "bore_sheish", "bore_bolder"],
      adds: ["bore_iron", "bore_kcor"],
      lore: "Stone that has been rolling long enough to lose its corners, in galleries no one has finished clearing. The haulers work by ear and step aside before they see a reason to."
     },
    { id: "R10", name: "Cavernous Descent", kind: "warden", at: { x: 35, y: 65 },
      requires: ["R4", "R9"], roster: ["bore_gemaga", "bore_obsidi", "bore_rohojohn"],
      adds: ["bore_hillbilly", "bore_cavedweller"],
      note: "Beneath the mountain, secrets breathe.",
      lore: "Miners go down here with a lamp, and the ones who stay stop carrying it back up. No one teaches that. The dark simply arranges it."
     },
    { id: "R11", name: "The Gem Vault", kind: "landmark", at: { x: 44, y: 55 },
      requires: ["R8", "R9"], roster: ["bore_diam", "bore_prism", "bore_sandman", "bore_score"],
      adds: [],
      note: "The lantern-lit descent of the Diamond Mine. The utility tier, all four on one node.",
      lore: "The Diamond Mine carves its stronghold out of rock too patient to notice the excavation. BORE's quiet wealth: beauty that simply accumulates, given enough centuries."
    },
    { id: "R12", name: "The Unbroken Wall", kind: "landmark", at: { x: 79, y: 58 },
      requires: ["R6", "R10"], roster: ["bore_bastion", "bore_bearocks", "bore_steel"], adds: [],
      note: "Bore Fortress — stone guardians. The campaign's hardest Landmark to out-damage rather than out-think, and Ironclad is immune to every status and DOT in the game. Bring PEN or bring a plan.",
      lore: "Bore Fortress is held by the Stone Guardians — and \"held\" is the correct word, not \"ruled.\" A mountain is handed to whoever is willing to keep living on it."
    },
    { id: "R13", name: "Corebore Shaft", kind: "throne", at: { x: 66, y: 76 },
      requires: ["R12"], roster: ["bore_the_coreborer"],
      // Escorts: the quarry crew, farmable at R1.
      adds: ["bore_cavedweller", "bore_iron", "bore_valcana"],
      note: "Optional.",
      lore: "Every other shaft in the mountain carries the tool marks of the crew that cut it. This one is round, unmarked, and still a little deeper each time anyone measures it."
     },
    // The door the BORE art paints as "To Dusk — Shadow Border (Locked)".
    // Two of the three Gray Thrones open it, in any combination.
    { id: "GS", name: "The Shadow Border", kind: "gate", at: { x: 8, y: 82 },
      requires: ["G14", "B14", "R14"], requiresCount: 2, roster: [], opens: ["dusk"],
      adds: ["bore_stone", "bore_iron", "dusk_crow", "dusk_pumpkin", "dusk_spider", "dusk_doom", "bore_shift", "dusk_silkstalker"],
      demand: { kind: "class", value: "Tank", count: 4 },
      note: "Where the stone gives out and the shadow starts. Everything past here is Act V.",
      lore: "Not a wall, and not guarded. The stone thins, the light goes, and somewhere inside that thinning the maps quietly stop agreeing with one another."
     },
    { id: "R14", name: "The Deepest Dark", kind: "throne", at: { x: 49, y: 84 },
      requires: ["R11", "R12"], roster: ["bore_deepest"],
      // Escorts: the standing stones, farmable at R6.
      adds: ["bore_stone", "bore_rock", "bore_shift"], required: true,
      note: "Below all other levels — an endless black drop. Required. The Shadow Border west stays sealed until Act V.",
      lore: "Titans sleep beneath the sands. Not titan. Titans — plural, ancient, and, as far as anyone in Bore Fortress will confirm out loud, not yet disturbed."
    },
  ],
};


// ── the DUSK slice ──────────────────────────────────────────────────────────
// Act V. The attrition route, and the only region the campaign has been
// fighting all along — its Blight has been landing in cleared territory since
// Act I, so arriving here is a counter-invasion rather than a tour.
//
// DUSK is NEVER Blighted (`canBlight`) — it is the source, which is why this is
// the one region with no `blightAt` and no corruption band on its art.
//
// It also has the richest token pool in the game: six. Every Warden and Throne
// fields diegetic adds, which is what makes its squads read as hordes rather
// than parties.

const DUSK: StoryRegion = {
  id: "dusk",
  name: "Dusk — Realm of Shadows",
  element: "DUSK",
  terrain: "Nightfall",
  board: 4,
  opening: { node: "D1", epic: "dusk_spectra" },
  throne: "D13",
  art: "/maps/dusk.webp",
  artRatio: 1440 / 1080,
  requires: ["GS"],
  nodes: [
    { id: "D1", name: "The Blighted Verge", kind: "skirmish", at: { x: 20, y: 13 },
      requires: [], roster: ["dusk_crow", "dusk_pumpkin", "dusk_doom"], adds: [],
      note: "Under the Rot Line door. These are the bodies that have been turning up in your regions for four Acts.",
      lore: "\"Shadows hold power, and only the forgotten endure.\" Carved above the gates of every Dead Forest cemetery in Concord."
    },
    { id: "D2", name: "Potter's Field", kind: "skirmish", at: { x: 33, y: 22 },
      requires: ["D1"], roster: ["dusk_zombie_husk", "dusk_skeleton_knight", "dusk_zhunk"],
      adds: ["dusk_zombie_tok", "dusk_skeleton_tok"],
      note: "Dead Forest West. The risen — they rot, they rise, they do not stop.",
      lore: "DUSK's dead do not rise because they refuse to die. They rise because dying was never the part of the process the living world actually controlled. Being forgotten was."
    },
    { id: "D3", name: "Widow's Hollow", kind: "skirmish", at: { x: 34, y: 34 },
      requires: ["D2"], roster: ["dusk_spider", "dusk_widowbite", "dusk_vamp", "dusk_scarlett"],
      adds: [],
      note: "Spiders weave and wait; vampires rule the night.",
      lore: "Widows here go on keeping the house exactly as it was kept, and the household is under no obligation to still be alive. The hollow's spiders were named for them."
     },
    { id: "D4", name: "The Weeping Chapel", kind: "skirmish", at: { x: 44, y: 22 },
      requires: ["D2"], roster: ["dusk_harve", "dusk_gool", "dusk_soul_wisp"],
      adds: ["dusk_specter_tok"],
      lore: "The chapel is older than the forest that grew around it, and whoever built it left no name on anything. Only the congregation has changed, one funeral at a time."
     },
    { id: "D5", name: "Scarecrow Rows", kind: "skirmish", at: { x: 41, y: 49 },
      requires: ["D3"], roster: ["dusk_jackl", "dusk_hix", "dusk_gravekeeper", "dusk_skulldrake"],
      adds: [],
      note: "The Nightmare Fields, at the western landing of the bridge — torn ground, and the hoofprints of the damned.",
      lore: "Nothing has grown in these rows in living memory, and the scarecrows are still maintained: restuffed, re-hung, and walked back out each season by hands that have no use for a harvest."
     },
    { id: "D6", name: "Forsaken Heights", kind: "warden", at: { x: 22, y: 27 },
      requires: ["D1"], roster: ["dusk_silkstalker", "dusk_skrow", "dusk_spectra"],
      adds: ["dusk_specter_tok"],
      note: "The Green Continent reach, fought at Act III scale by anyone who came through PYRO's Veil Gate early.",
      lore: "The Dead Forest spreads on both continents at once — the same leafless blight in LEAF's southern edge and BORE's western mountains, one corruption that never respected a border."
    },
    { id: "D7", name: "The Haunting Ground", kind: "warden", at: { x: 84, y: 22 },
      requires: ["D8"], roster: ["dusk_ghastly", "dusk_haunt", "dusk_plaguecrow"],
      adds: ["dusk_specter_tok"],
      note: "Dead Forest East — the souls that remain.",
      lore: "The eastern forest is not cleared but conceded — a strip of ground the living quietly hand back, fence by fence, to whatever declined to move on."
     },
    { id: "D8", name: "Bonefield Muster", kind: "warden", at: { x: 63, y: 46 },
      requires: ["D5"], roster: ["dusk_reaper", "dusk_sarachnid", "dusk_brute"],
      adds: ["dusk_skeleton_tok"],
      note: "The eastern landing of the bridge, below the Boneyard. Born of bone, and they march eternal — the only way across the Shadow Pass ravine.",
      lore: "Where LEAF's people speak of the Cycle as a wheel, DUSK's people speak of Shadow Pass as a door — one that has never fully closed since whatever died first opened it."
    },
    { id: "D9", name: "The Veil Gate", kind: "warden", at: { x: 13, y: 46 },
      requires: ["D6"], roster: ["dusk_ender", "dusk_rip", "dusk_violet", "dusk_wedded_wraith"],
      adds: ["dusk_risen_tok", "dusk_specter_tok"],
      note: "The portal to the forgotten souls, and the region's spike at cost 20.",
      lore: "DUSK's account of the Sundering is the shortest, and the one no other nation enjoys hearing repeated: something died. Not a person. Not a nation."
    },
    { id: "D10", name: "Death Island: The Landing", kind: "landmark", at: { x: 40, y: 62 },
      requires: ["D5", "D9"],
      roster: ["dusk_ravven", "dusk_scar", "dusk_hoax", "dusk_zombination"],
      adds: ["dusk_zombie_tok", "dusk_redreven"],
      lore: "Nobody is carried up the stones from the Landing. Whatever condition an arrival is in, DUSK holds that the last stretch of a journey belongs to the one making it."
     },
    { id: "D11", name: "Death Island: The Barrows", kind: "landmark", at: { x: 66, y: 64 },
      requires: ["D7"], roster: ["dusk_destro", "dusk_nightfang", "dusk_skelider"],
      adds: ["dusk_skeleton_tok"],
      lore: "The mounds are numbered, swept, and reopened as needed, the way a street keeps its houses. The families who do the upkeep are mostly buried in the same row."
     },
    { id: "D12", name: "The Bone Throne", kind: "throne", at: { x: 86, y: 58 },
      requires: ["D11"], roster: ["dusk_skullking"],
      adds: ["dusk_skeleton_tok", "dusk_skulldrake_tok", "dusk_skrow"],
      note: "Nightward Keep — the watchers of Dusk. Optional.",
      lore: "Every piece of the Bone Throne was given rather than taken. A place in the seat is the last posting of a very long service. Most apply early."
     },
    { id: "D13", name: "The Long Night", kind: "throne", at: { x: 50, y: 79 },
      requires: ["D10", "D11"], roster: ["dusk_shadowhorsemen"],
      adds: ["dusk_specter_tok", "dusk_risen_tok", "dusk_silkstalker"], required: true,
      note: "Death Island, land of the forgotten. Required.",
      lore: "Not a place the forgotten go, but a place where forgetting itself has settled permanently, the way fog settles into a valley it likes. No living ruler has ever claimed it."
    },
  ],
};


// ── the DAWN slice ──────────────────────────────────────────────────────────
// Act V, and the last region. The endurance route: cleanse, armour and
// sustained light. Awakening burns a status off itself every round and quickens
// to SP 14, so DAWN squads are hard to lock down and hard to grind out — the
// one region that answers a control deck directly.
//
// DAWN is SEALED IN BOTH DIRECTIONS (§10.5): it neither bleeds Overflow nor
// receives it, and `canBlight` excludes it, so it has no `blightAt` either. It
// is the only region the player arrives at having seen none of its cards.
//
// It is also the only element with THREE Mythics, and the painting gives each
// of them a seat — which is why this is the one region with three Thrones.

const DAWN: StoryRegion = {
  id: "dawn",
  name: "Dawn — The Golden Kingdom",
  element: "DAWN",
  terrain: "Blazing Sun",
  board: 4,
  opening: { node: "W1", epic: "dawn_veil" },
  throne: "W13",
  art: "/maps/dawn.webp",
  artRatio: 1440 / 1080,
  requires: ["GF"],
  nodes: [
    // The whole region runs south to north: in through the Arctic Veil at the
    // bottom, fanning west and east, converging on the castle at the top.
    { id: "W1", name: "The Arctic Veil", kind: "skirmish", at: { x: 49, y: 78 },
      requires: [], roster: ["dawn_able", "dawn_beam", "dawn_flash"], adds: [],
      note: "The guarded way, and the only road in. Everything past the wall has been unseen all campaign.",
      lore: "Sailors who have tried to chart the Veil all report the same thing: the storm does not end because you outlast it. It ends because it decides you may pass."
    },
    { id: "W2", name: "First Light Camp", kind: "skirmish", at: { x: 36, y: 72 },
      requires: ["W1"], roster: ["dawn_roy", "dawn_sparkle", "dawn_glime"], adds: [],
      lore: "Whoever the Veil lets through is fed and warmed here before being asked a single question. The order is deliberate: no one lies well an hour after surviving that storm."
     },
    { id: "W3", name: "Mirrorfield", kind: "skirmish", at: { x: 27, y: 62 },
      requires: ["W2"], roster: ["dawn_reflection", "dawn_shine", "dawn_sphere"], adds: [],
      lore: "Mirror banks angled at the low sun. They put DAWN's light on ground the sun itself cannot reach, and the polishers will never see the wall they keep lit."
     },
    { id: "W4", name: "Golden Farmlands", kind: "skirmish", at: { x: 16, y: 58 },
      requires: ["W3"],
      roster: ["dawn_stbern", "dawn_goldeneagle", "dawn_musk_ox", "dawn_oxin"], adds: [],
      note: "Royal gardens, green in the snow — and the herd that works them.",
      lore: "Fertile soil nurtured by sunlight and care. Even a kingdom built around a wall against the dark still has to eat."
    },
    { id: "W5", name: "Sunrise Muster", kind: "warden", at: { x: 44, y: 64 },
      requires: ["W2"], roster: ["dawn_amble", "dawn_golde", "dawn_lazor", "dawn_star"], adds: [],
      lore: "The names are called here at sunrise, and the fallen are read out with the living. Someone in the line answers for each. DAWN keeps no separate list."
     },
    { id: "W6", name: "The Blazing Road", kind: "warden", at: { x: 58, y: 70 },
      requires: ["W5"], roster: ["dawn_ariel", "dawn_radiance", "dawn_raya", "dawn_ty"], adds: [],
      lore: "Not the shortest road north — the only one never in shadow. DAWN would rather add a day's march than hand the dark a stretch of road."
     },
    { id: "W7", name: "The Solar Bastion", kind: "warden", at: { x: 26, y: 38 },
      requires: ["W4"],
      roster: ["dawn_solara", "dawn_solstice", "dawn_veil", "dawn_warphant"],
      adds: ["dawn_radiant_guardian"],
      note: "The wall that shines. We hold the wall; nothing passes.",
      lore: "The Golden Kingdom does not hide because it is proud. It hides because it is standing in front of something, and it has never been fully certain what happens if it stops."
    },
    { id: "W8", name: "High Noon", kind: "warden", at: { x: 68, y: 47 },
      requires: ["W6"],
      roster: ["dawn_clipsey", "dawn_drakonbane", "dawn_halo", "dawn_sircrest"], adds: [],
      lore: "Every clock and boundary stone in the Kingdom is reckoned from the moment the sun crosses this ground. No king set the mark: generations of surveyors argued their way to it."
     },
    { id: "W9", name: "Castle Grounds", kind: "landmark", at: { x: 50, y: 57 },
      requires: ["W5", "W7"],
      roster: ["dawn_aurora", "dawn_heir_tok", "dawn_kosmos", "dawn_aurelion"],
      adds: ["dawn_radiant_guardian"],
      note: "Outer wards, tilt-yards and gatehouses. Heir is a Legendary despite the token-shaped id — it is fully draftable.",
      lore: "An heir is named in these yards, not in the Court above them, so that whoever is standing watch that morning is a witness. DAWN does not crown anyone in private."
     },
    { id: "W10", name: "The Golden Court", kind: "landmark", at: { x: 50, y: 41 },
      requires: ["W8", "W9"], roster: ["dawn_commander", "dawn_leo", "dawn_dawn"],
      adds: ["dawn_radiant_guardian"] ,
      lore: "DAWN's nobility is a chess hierarchy every child learns before they learn to read: King, Queen, Bishop, Rook, Knight — and Pawn, which is most of DAWN."
    },
    // Two optional Thrones, both seats the painting names outright.
    { id: "W11", name: "Sun's Army Fronts", kind: "throne", at: { x: 72, y: 70 },
      requires: ["W6"], roster: ["dawn_equestrian"],
      adds: ["dawn_warrider_tok", "dawn_stbern", "dawn_golde"],
      note: "Guardians of Dawn, watching over the wilds. Optional — the Equestrian seat.",
      lore: "Knights of the Sun, who march without fear and consider retreat a kind of lie. They fight in daylight, by choice. Light that hides has already lost."
    },
    { id: "W12", name: "Stars Army Flakes", kind: "throne", at: { x: 88, y: 43 },
      requires: ["W8"], roster: ["dawn_supernova"],
      adds: ["dawn_sparkle", "dawn_glime", "dawn_lazor"],
      note: "Silver pavilions where the lights touch down. Optional — the Supernova seat, and the star that fell is still burning in the Sundered Sky above it.",
      lore: "Named for the way starlight and snowfall look the same from far enough away. The Flakes keep their oldest devotions where the frozen lands can hear them. The sun sleeps; they do not."
    },
    { id: "W13", name: "Dawn Castle", kind: "throne", at: { x: 50, y: 22 },
      requires: ["W10"], roster: ["dawn_imperator"],
      adds: ["dawn_warrider_tok", "dawn_radiant_guardian", "dawn_amble"], required: true,
      note: "The Golden Seat, throne of the kingdom. Required — the end of the road.",
      lore: "The Golden King's title is not simply \"ruler.\" It is keeper of the Eternal Vigil, an unbroken watch DAWN's records insist has never once been allowed to fail."
    },
  ],
};

export const REGIONS: StoryRegion[] = [LEAF, PYRO, AQUA, GALE, BOLT, BORE, DUSK, DAWN];

/** A region is reachable once every node gating it is cleared. */
/** A region opens when ANY of its gates has been cleared — not all of them.
 *  AQUA is reachable through LEAF's Eastleaf Port or PYRO's Sunfall Harbor, and
 *  demanding both would mean an AQUA-first player could never take the second
 *  road without walking back through LEAF. Empty/absent = open from the start. */
export const isRegionOpen = (save: StorySave, r: StoryRegion): boolean => {
  const gates = r.requires ?? [];
  return gates.length === 0 || gates.some((id) => save.cleared.includes(id));
};

export const ALL_NODES: StoryNode[] = REGIONS.flatMap((r) => r.nodes);
export const nodeById = (id: string): StoryNode | undefined => ALL_NODES.find((n) => n.id === id);
export const regionOfNode = (id: string): StoryRegion | undefined =>
  REGIONS.find((r) => r.nodes.some((n) => n.id === id));

// ── the starter deck ────────────────────────────────────────────────────────
// One card. Sakuroot, and nothing else.
//
// This was twelve curated LEAF Rares handed over at Spring Village — all six
// classes and a bottom-heavy curve, a functioning deck before the first fight.
// The campaign now starts at rags instead: you own a single Epic, and the
// opening battle at L1 is Sakuroot alone against the three Rares standing
// there. Winning hands all three over guaranteed, so the twelve-card deck is
// something the player assembles rather than something they are given.
//
// Sakuroot specifically because one card can only hold a board if it refuses to
// die: a 3-cost Tank behind 4 shields that heals its own home row. Every other
// region's opener awards the same shape of card — see `RegionOpening`.
export const STARTER_DECK: string[] = ["leaf_sakuroot"];

// ── the battle squad ────────────────────────────────────────────────────────
// What you may CARRY into a region you have not taken yet, as opposed to what
// you own. The campaign's restriction moved here: the collection grows freely,
// but crossing a border means choosing twelve of it and living with the choice
// until you walk back.
//
// A region you have conquered is HOME — no limit there, your whole collection
// is available, and that is what makes going back to re-pack the core loop
// rather than a chore. Each Throne widens the squad for everywhere you have not
// been yet, and unlocking DUSK removes the limit entirely.

/** Squad size on arriving somewhere new, before any Throne has widened it. */
export const SQUAD_BASE = 12;

/** Each conquered region adds this much to the travelling squad. */
export const SQUAD_PER_THRONE = 2;

/** The Throne per region that counts as conquering it — every node flagged
 *  `required: true`. Derived from REGIONS rather than restated, so a region
 *  whose required Throne moves cannot silently fall out of the squad maths. */
export const REQUIRED_THRONES: readonly string[] = REGIONS.map((r) => r.throne);

/** Has this region's required Throne been cleared? A conquered region is home
 *  turf: full roster, no squad limit. */
export const isRegionConquered = (cleared: readonly string[], region: StoryRegion): boolean =>
  cleared.includes(region.throne);

/** Is the whole squad limit lifted? DUSK's Throne is the campaign's answer to
 *  "when do I get my collection back" — taking the Realm of Shadows means every
 *  region's War Element is open to you, everywhere, for the rest of the run. */
export const squadUnlocked = (cleared: readonly string[]): boolean =>
  cleared.includes(DUSK.throne);

/** How many cards may travel into an UNCONQUERED region right now.
 *  `null` means no limit — DUSK is taken and the collection travels whole. */
export function squadCapFor(cleared: readonly string[]): number | null {
  if (squadUnlocked(cleared)) return null;
  const conquered = REQUIRED_THRONES.filter((id) => cleared.includes(id)).length;
  return SQUAD_BASE + SQUAD_PER_THRONE * conquered;
}

/** The squad limit for a SPECIFIC region: none at home, the travelling cap
 *  away. This is the number the prep screen enforces. */
export function squadCapInRegion(
  cleared: readonly string[],
  region: StoryRegion,
): number | null {
  if (isRegionConquered(cleared, region)) return null;
  return squadCapFor(cleared);
}

/** The cards actually available to build a deck from in `region`.
 *
 *  At HOME — a region whose Throne you hold, or anywhere once DUSK has fallen —
 *  that is the whole collection. AWAY it is the squad you packed for this
 *  region, and nothing else: cards left behind are left behind until you walk
 *  back. A squad packed for somewhere ELSE does not travel, which is what stops
 *  one deck answering every element.
 *
 *  Filtered against the collection on the way out so a card that somehow left
 *  the collection (a save edited by an older build) cannot be fielded. */
/** Owned cards of the region's OWN element.
 *
 *  These never need carrying. You are fighting in their homeland, among their
 *  own people, and every one of them you have unlocked answers the call — so
 *  the squad is only ever a question about what you bring from ELSEWHERE. It
 *  also means a region you are deep into gets easier to field for as you
 *  recruit there, which is the reward for having been there. */
export const localCards = (save: StorySave, region: StoryRegion): string[] =>
  save.collection.filter((id) => getDef(id).element === region.element);

/** The foreign cards packed for this region, filtered to what is still owned. */
export const squadFor = (save: StorySave, region: StoryRegion): string[] =>
  (save.squads?.[region.id] ?? []).filter((id) => save.collection.includes(id));

/** Everything available to build a deck from in `region`.
 *
 *  At HOME — a region whose Throne you hold, or anywhere once DUSK has fallen —
 *  the whole collection. AWAY it is the region's own element plus whatever you
 *  packed, and nothing else: foreign cards left behind stay behind until you
 *  walk back. */
export function poolForRegion(save: StorySave, region: StoryRegion): string[] {
  const limit = squadCapInRegion(save.cleared, region);
  if (limit === null) return [...save.collection];
  // A squad you have actually chosen wins. Otherwise one is picked FOR you —
  // the campaign must never stop and demand a modal before a fight it could
  // have started. Packing is a choice you may make, not a toll you must pay.
  const packed = save.squads?.[region.id] ? squadFor(save, region) : autoSquad(save, region);
  return [...new Set([...localCards(save, region), ...packed])];
}

/** The squad chosen for you when you have not chosen one: the strongest foreign
 *  cards you own, by cost. Deterministic, so walking into a region twice without
 *  touching the picker gives the same team both times.
 *
 *  Cost is a blunt proxy for power, but it is the one the stat budget makes
 *  honest — every card is priced at 5*cost + 10 — so the most expensive things
 *  you own really are the biggest. */
export function autoSquad(save: StorySave, region: StoryRegion): string[] {
  const limit = squadCapInRegion(save.cleared, region);
  if (limit === null) return [];
  return [...packableFor(save, region)]
    .sort((a, b) => getDef(b).cost - getDef(a).cost || a.localeCompare(b))
    .slice(0, limit);
}

/** The cards a squad may be chosen FROM: everything owned that is not already
 *  travelling free with the region's own element. */
export const packableFor = (save: StorySave, region: StoryRegion): string[] =>
  save.collection.filter((id) => getDef(id).element !== region.element);

/** Is a squad worth OFFERING here — i.e. away from home with more foreign cards
 *  than can be carried, so there is a real choice to make?
 *
 *  This no longer blocks anything. It used to gate the fight behind a modal, and
 *  that modal was the single worst thing about the campaign: standing in LEAF
 *  holding eighteen LEAF cards, you were stopped and made to choose twelve
 *  FOREIGN ones before you could play. The pool auto-packs now (see
 *  `autoSquad`); this only decides whether to show the "Squad" button. */
export const squadIsOfferable = (save: StorySave, region: StoryRegion): boolean => {
  const limit = squadCapInRegion(save.cleared, region);
  if (limit === null) return false;
  return packableFor(save, region).length > limit;
};

/** The team last taken into a fight in this region, filtered to what is still
 *  fieldable here. Empty when you have never fought here. */
export const deckForRegion = (save: StorySave, region: StoryRegion): string[] => {
  const pool = new Set(poolForRegion(save, region));
  return (save.decks?.[region.id] ?? []).filter((id) => pool.has(id));
};

/** Remember the team taken into a fight here, so returning restores it. */
export const rememberDeck = (save: StorySave, region: StoryRegion, deck: string[]): StorySave => ({
  ...save,
  deck,
  decks: { ...(save.decks ?? {}), [region.id]: [...deck] },
});

/** Has the player explicitly chosen the squad here, as opposed to being handed
 *  `autoSquad`? Drives the wording on the prep screen. */
export const squadIsExplicit = (save: StorySave, region: StoryRegion): boolean =>
  Boolean(save.squads?.[region.id]);

/** Commit (or re-commit) the squad for `region`. Clamped to the limit and to
 *  cards actually owned, and stored under this region so returning here finds
 *  it again instead of re-opening the picker. */
export function packSquad(save: StorySave, region: StoryRegion, cards: string[]): StorySave {
  const limit = squadCapInRegion(save.cleared, region);
  // At home there is nothing to pack — the whole collection is already yours.
  if (limit === null) return save;
  const owned = [...new Set(cards)].filter((id) => save.collection.includes(id));
  return { ...save, squads: { ...(save.squads ?? {}), [region.id]: owned.slice(0, limit) } };
}

/** The size of the fight, for BOTH sides.
 *
 *  The ladder and the board say how big a fight COULD be; this also asks how
 *  big a fight the player can actually bring. Away from home with a thin pool,
 *  `capForNode` alone would field a full enemy deck across from half of one.
 *
 *  Used by `gateCheck` alone. A gate demands a FULL deck, and
 *  a gate asking for the ladder's 15 while the player can field 14 is a gate
 *  nobody can pass. Reading the pool means the demand is always satisfiable. */
export function fightCap(save: StorySave, region: StoryRegion, node: StoryNode): number {
  const ceiling = capForNode(save.cleared, region, node);
  const pool = poolForRegion(save, region).length;
  return pool > 0 ? Math.min(ceiling, pool) : ceiling;
}

// ── the hero ────────────────────────────────────────────────────────────────

/** The hero a new campaign starts with. Named by the player later; the default
 *  is deliberately plain rather than cute, so it reads as a placeholder. */
export const newHero = (): Hero => ({
  name: "Keeper",
  affinity: REGIONS[0].element, // LEAF — wherever the campaign opens
  spells: [],
  essence: {},
  shards: 0,
  shiny: [],
});

/** Essence paid for clearing a node, by what kind of node it was.
 *
 *  A Throne is worth a week of skirmishes because it is one. The numbers are
 *  small on purpose: essence is the SLOW route to a card you never rolled, the
 *  one that guarantees you finish a collection eventually rather than the one
 *  that skips the game. */
export const ESSENCE_PER_CLEAR: Record<NodeKind, number> = {
  skirmish: 1, warden: 2, gate: 2, landmark: 3, blight: 3, throne: 5,
};

/** Spells unlock by walking the region that owns them.
 *
 *  The set is already shaped for this and it is worth saying why it fits so
 *  cleanly: there are exactly 80 spells, ten per element, one per cost rung 1
 *  through 10. So "how deep into this region have you been" maps straight onto
 *  "how expensive a spell of theirs will answer to you" with no new data and no
 *  unlock table to maintain — clear n nodes in a region and its spells up to
 *  cost n are yours. Ten nodes gets the element's whole book, and every region
 *  has more nodes than that, so finishing a region always finishes its spells.
 */
export function spellsUnlockedIn(save: StorySave, region: StoryRegion): string[] {
  const depth = region.nodes.filter((n) => save.cleared.includes(n.id)).length;
  return SPELLS
    .filter((sp) => sp.element === region.element && sp.cost <= depth)
    .map((sp) => sp.id);
}

/** Every spell the hero has earned, across every region walked so far, CHEAPEST
 *  FIRST.
 *
 *  The order is load-bearing rather than tidy: `heroBookFor` fills the book off
 *  the front of this list, and magic starts at 0 and drips in, so the spells
 *  worth defaulting to are the ones that can actually be cast. Left in
 *  declaration order the automatic book came out as cost 1, 4, 2, 5, 6 — a
 *  spread nobody chose, with two spells in it the player could not afford for
 *  most of a short match. */
export const heroSpellShelf = (save: StorySave): string[] =>
  [...new Set(REGIONS.flatMap((r) => spellsUnlockedIn(save, r)))]
    .sort((a, b) => getSpell(a).cost - getSpell(b).cost || a.localeCompare(b));

/** The book the hero actually carries into a fight: their chosen spells if they
 *  have picked any, else the shelf, trimmed to the board's cap.
 *
 *  Trimmed rather than refused — a hero holding thirty spells and a five-slot
 *  book should walk in with five, not with none. */
export function heroBookFor(save: StorySave, boardSize: number): string[] {
  const shelf = heroSpellShelf(save);
  const chosen = (save.hero?.spells ?? []).filter((id) => shelf.includes(id));
  return (chosen.length ? chosen : shelf).slice(0, spellCapForBoard(boardSize));
}

/** Bank the essence a clear is worth, in the element of the region it was in. */
export function awardEssence(save: StorySave, region: StoryRegion, node: StoryNode): StorySave {
  const hero = save.hero ?? newHero();
  const gain = ESSENCE_PER_CLEAR[node.kind] ?? 1;
  return {
    ...save,
    hero: {
      ...hero,
      essence: { ...hero.essence, [region.element]: (hero.essence[region.element] ?? 0) + gain },
    },
  };
}

/** Essence to conjure a card you never rolled, by rarity.
 *
 *  Priced against what the campaign actually pays. A full clear of a region
 *  banks roughly 29-38 essence of its element (LEAF's 18 nodes are worth 37,
 *  DUSK's 13 are worth 29), and every element has 39 cards. So one complete
 *  walk buys about eight Rares, or four Epics, or two Legendaries, or a single
 *  Mythic — nowhere near a set.
 *
 *  That ratio is the whole design. Essence is not a second way to collect; it is
 *  the guarantee that the ONE card the dice never gave you is still reachable,
 *  and repeat clears keep paying it, so "eventually" is always true. A cheaper
 *  table would let a player skip the recruitment game entirely. */
export const CRAFT_COST: Record<string, number> = {
  rare: 4, epic: 8, legendary: 16, mythic: 30,
};

export const craftCostOf = (defId: string): number =>
  CRAFT_COST[getDef(defId).rarity ?? "rare"] ?? 4;

/** Can this card be conjured right now? Owning it already is the usual no. */
export function canCraft(save: StorySave, defId: string): { ok: boolean; reason?: string } {
  if (!CARD_INDEX[defId]) return { ok: false, reason: "No such card" };
  if (save.collection.includes(defId)) return { ok: false, reason: "Already collected" };
  const el = getDef(defId).element;
  const have = save.hero?.essence[el] ?? 0;
  const cost = craftCostOf(defId);
  if (have < cost) return { ok: false, reason: `Needs ${cost} ${el} essence — you have ${have}` };
  return { ok: true };
}

/** Spend the essence and add the card. Refuses rather than going negative. */
export function craftCard(save: StorySave, defId: string): StorySave {
  if (!canCraft(save, defId).ok) return save;
  const hero = save.hero ?? newHero();
  const el = getDef(defId).element;
  return {
    ...save,
    collection: [...save.collection, defId],
    hero: { ...hero, essence: { ...hero.essence, [el]: (hero.essence[el] ?? 0) - craftCostOf(defId) } },
  };
}

// ── shinies ─────────────────────────────────────────────────────────────────

/** Chance, as a PERCENTAGE, that a card arrives shiny — one card in a hundred.
 *
 *  Same scale as DROP_RATE (50/30/15/5) and `pctChance`, which divides by 100.
 *  Started at 0.25 and was raised: at one in four hundred a five-card pack had
 *  about a 1% chance of holding a foil, so most players would finish a campaign
 *  never having seen one, and a chase item nobody catches is just an unused
 *  code path. At 1% a pack carries roughly a one-in-twenty chance — rare enough
 *  to be worth shouting about, common enough to exist.
 *
 *  Rolled per CARD ACQUIRED rather than per pack or per clear, and duplicates
 *  roll too: a card you already own coming back shiny is the one thing that
 *  makes a duplicate worth seeing, and it costs nothing to allow because a
 *  shiny is cosmetic. Nothing about a shiny changes a stat, a cost or a rule. */
export const SHINY_CHANCE = 1;

/** Roll one acquisition. `rand` is injected so a test can pin it. */
export const rollShiny = (rand: () => number = Math.random): boolean =>
  rand() * 100 < SHINY_CHANCE;

/** Does the player hold this card in foil? */
export const isShiny = (save: StorySave, defId: string): boolean =>
  (save.hero?.shiny ?? []).includes(defId);

/** Bank shiny copies, ignoring ones already held. */
export function addShiny(save: StorySave, ids: readonly string[]): StorySave {
  if (!ids.length) return save;
  const hero = save.hero ?? newHero();
  const next = [...new Set([...hero.shiny, ...ids])];
  if (next.length === hero.shiny.length) return save;
  return { ...save, hero: { ...hero, shiny: next } };
}

// ── boosters ────────────────────────────────────────────────────────────────

/** Shards paid for winning a match. Story nodes pay more than the Arena for the
 *  same reason a Throne pays more essence than a skirmish: the campaign is the
 *  game, and the Arena is the place you go to practise. Arena still pays, so a
 *  player who only wants to fight is still collecting. */
export const SHARDS_PER_WIN = { story: 3, arena: 2 } as const;

/** What a pack costs, and what it holds. Five cards, one of them Epic or better
 *  — the guarantee is what stops a pack ever feeling like nothing happened. */
export const PACK_COST = 40;
export const PACK_SIZE = 5;

/** Pull weights. Deliberately close to the recruitment table (`DROP_RATE`, which
 *  runs 50/30/15/5) so a pack does not quietly become the best odds in the game;
 *  it trades the story's TARGETED roll for volume, not for better luck. */
export const PACK_WEIGHT: Record<string, number> = {
  rare: 58, epic: 29, legendary: 11, mythic: 2,
};

/** A duplicate is refunded as essence rather than wasted.
 *
 *  This is what ties the two paid routes together instead of leaving them as
 *  rivals: packs you open for volume feed the essence you spend on the one card
 *  you actually want. Worth less than crafting the card costs — a pack must not
 *  be a cheaper way to buy the exact thing crafting is for. */
export const dupeEssenceFor = (defId: string): number =>
  Math.max(1, Math.floor(craftCostOf(defId) / 2));

/** One card pulled at `weights`, from `pool`. Pure: the caller supplies rand. */
function pullOne(pool: readonly string[], rand: () => number, weights: Record<string, number>): string | null {
  if (!pool.length) return null;
  const total = pool.reduce((n, id) => n + (weights[getDef(id).rarity ?? "rare"] ?? 0), 0);
  if (total <= 0) return pool[Math.floor(rand() * pool.length) % pool.length];
  let roll = rand() * total;
  for (const id of pool) {
    roll -= weights[getDef(id).rarity ?? "rare"] ?? 0;
    if (roll <= 0) return id;
  }
  return pool[pool.length - 1];
}

export interface PackResult {
  /** Every card pulled, in order, including duplicates. */
  pulled: string[];
  /** The ones that were new. */
  fresh: string[];
  /** Element -> essence refunded for the duplicates. */
  refund: Record<string, number>;
  /** Cards that came out of this pack in foil. Duplicates can be shiny too — it
   *  is the only thing that makes pulling one twice worth seeing. */
  shiny: string[];
}

/** Open a pack. Pure — `rand` is injected so a test can pin every pull.
 *
 *  Pulls from the WHOLE card set rather than only what is missing: a pack that
 *  could only ever contain new cards would be strictly better the more complete
 *  your collection got, which is backwards. Duplicates are the cost of buying
 *  volume, and they come back as essence. */
export function openPack(save: StorySave, rand: () => number = Math.random): PackResult {
  const pool = CARDS.map((c) => c.id);
  const owned = new Set(save.collection);
  const pulled: string[] = [];
  const fresh: string[] = [];
  const refund: Record<string, number> = {};
  const shiny: string[] = [];

  for (let i = 0; i < PACK_SIZE; i++) {
    // The last slot is the guarantee: if nothing Epic-or-better has shown up
    // yet, pull from that tier instead of the whole set.
    const guarantee =
      i === PACK_SIZE - 1 &&
      !pulled.some((id) => ["epic", "legendary", "mythic"].includes(getDef(id).rarity ?? ""));
    const from = guarantee
      ? pool.filter((id) => ["epic", "legendary", "mythic"].includes(getDef(id).rarity ?? ""))
      : pool;
    const id = pullOne(from, rand, PACK_WEIGHT);
    if (!id) break;
    pulled.push(id);
    // Every card acquired rolls, duplicates included, and only if it is not
    // already held in foil — a second shiny of the same card is nothing.
    if (!(save.hero?.shiny ?? []).includes(id) && !shiny.includes(id) && rollShiny(rand)) shiny.push(id);
    // `owned` is updated as we go, so two copies in ONE pack refund the second.
    if (owned.has(id)) {
      const el = getDef(id).element;
      refund[el] = (refund[el] ?? 0) + dupeEssenceFor(id);
    } else {
      owned.add(id);
      fresh.push(id);
    }
  }
  return { pulled, fresh, refund, shiny };
}

/** Can a pack be bought right now? */
export const canOpenPack = (save: StorySave): boolean => (save.hero?.shards ?? 0) >= PACK_COST;

/** Charge for a pack and bank everything it produced. */
export function applyPack(save: StorySave, result: PackResult): StorySave {
  const hero = save.hero ?? newHero();
  const essence = { ...hero.essence };
  for (const [el, n] of Object.entries(result.refund)) essence[el] = (essence[el] ?? 0) + n;
  return addShiny(
    {
      ...save,
      collection: [...save.collection, ...result.fresh],
      hero: { ...hero, shards: Math.max(0, hero.shards - PACK_COST), essence },
    },
    result.shiny,
  );
}

/** Pay out shards for a win. */
export function awardShards(save: StorySave, kind: keyof typeof SHARDS_PER_WIN): StorySave {
  const hero = save.hero ?? newHero();
  return { ...save, hero: { ...hero, shards: hero.shards + SHARDS_PER_WIN[kind] } };
}

// ── opening battles ─────────────────────────────────────────────────────────

/** How many cards an opening battle fields: ONE MORE than the player can bring.
 *
 *  Measured on LEAF's opener with a lone Sakuroot, where the whole curve is
 *  visible. One enemy is a 100% win in a single round — Sakuroot simply deletes
 *  a 1-cost body and the tutorial teaches nothing. Three (the full roster, which
 *  is what flooring at the roster produced) is 57% across 34.6 rounds with 26 of
 *  60 running out the clock, because the third card is Greegon and the node's
 *  own note calls it a REGEN tank "you cannot out-race". Two is 100% across 13.5
 *  rounds: you cannot lose it, but you have to play it.
 *
 *  The +1 is what stops a single strong card one-shotting its own tutorial, and
 *  it keeps the rule honest later — arriving in a new region with a packed squad
 *  still meets a fight the size of the squad, not a walkover. Combined with the
 *  cheapest-first ordering in `buildFormation`, the expensive cards on an
 *  opener's roster only turn up once the player has a force to meet them. */
export const openingTarget = (save: StorySave, region: StoryRegion): number =>
  poolForRegion(save, region).length + 1;

/** Is this the region's rags-to-riches opener? */
export const isOpeningNode = (region: StoryRegion, node: StoryNode): boolean =>
  region.opening.node === node.id;

/** What clearing `node` hands over with no roll and no pity.
 *
 *  Only opening battles grant anything guaranteed: the node's whole roster plus
 *  the region's Epic. Everywhere else this is empty and recruitment runs its
 *  ordinary odds. LEAF's Epic is already in the starting collection, so adding
 *  it again is a no-op the caller de-dupes — listing it anyway keeps the rule
 *  "an opener gives you its Epic" true of every region without a special case. */
export function guaranteedDrops(region: StoryRegion, node: StoryNode): string[] {
  if (!isOpeningNode(region, node)) return [];
  return [...new Set([region.opening.epic, ...node.roster])];
}

// ── deck cap ladder ─────────────────────────────────────────────────────────
// The ladder runs 12/15/18/22/28 and says how far the campaign has come. What a
// given FIGHT will take is `capForNode`, which clamps it by board: 18 on 4x4,
// 28 on 5x5. So the ordinary campaign is an 18-card game that opens to 28 for
// its set pieces, and both boards sit inside their constructed format.

/** One rung of the ladder. `unlockedBy` is a single node id, or an array
 *  meaning ALL of them unless `count` says how many of the set suffice. The
 *  shipped ladder currently uses only the single-id form, but the shape is kept
 *  general — the Gray Continent rungs used both, and re-adding one should be a
 *  data edit, not a rewrite of `deckCapFor`. */
export type CapRung = {
  cap: number;
  board: number;
  unlockedBy: string | readonly string[] | null;
  count?: number;
  label: string;
};

export const CAP_LADDER: readonly CapRung[] = [
  { cap: 12, board: 4, unlockedBy: null, label: "Starting deck" },
  { cap: 15, board: 4, unlockedBy: "L14", label: "LEAF Throne" },
  { cap: 18, board: 4, unlockedBy: "P13", label: "PYRO Throne" }, // = the 4x4 format
  { cap: 18, board: 4, unlockedBy: "A13", label: "AQUA Throne" }, // either Act II Throne
  // Act IV wants BOTH Green Thrones, not either — an array means ALL of them.
  { cap: 24, board: 5, unlockedBy: ["P13", "A13"], label: "Both Green Thrones" },
  // Act V: TWO of the three Gray Thrones, in any combination. `count` is what
  // keeps the Gray Continent order-free.
  { cap: 30, board: 5, unlockedBy: ["G14", "B14", "R14"], count: 2, label: "Two of three Gray Thrones" },
];

/** The ceiling a fight imposes, by board — and these ARE the constructed
 *  formats: 4x4 is eighteen cards and 5x5 is thirty, exactly, in the Arena.
 *  The campaign ramps up to them rather than living inside a band, so the deck
 *  a finished campaign builds is a legal Arena deck for the same board.
 *
 *  BIG_BOARD_CAP was 28 — the old 5x5 *target* when the format was a 20-30
 *  range. A campaign that went all the way still topped out two cards short of
 *  a legal big-board deck, with nothing saying why. Changing either of these
 *  is a FORMAT change: `DECK_LIMITS` in `custom-decks.ts` is the other half,
 *  the Arena shares it, and the premade decks are built to it exactly. */
export const STANDARD_CAP = 18;
export const BIG_BOARD_CAP = 30;

/** The deck cap for THIS fight: the ladder, clamped by the board.
 *
 *  The ladder says how far the campaign has come; the board says how much of
 *  that a given fight will take. An ordinary 4x4 node tops out at 18 however
 *  far along you are, and a 5x5 set piece opens up to 28 once the ladder has
 *  actually earned it — an Act I Throne is still 12, because the clamp can only
 *  ever lower the ladder, never raise it. Without that, the first Throne on the
 *  map would field 28 against a starter deck.
 *
 *  Both sides use this: `buildFormation` sizes the enemy from the same number,
 *  so a set piece is a bigger fight on both sides of the board, not just one. */
export function capForNode(
  cleared: readonly string[],
  region: StoryRegion,
  node: StoryNode,
): number {
  const ceiling = boardForNode(region, node) === 5 ? BIG_BOARD_CAP : STANDARD_CAP;
  // Ladder and board only. What the PLAYER can actually field is a separate
  // question and belongs to `fightCap`, which is what the enemy, the gates and
  // the prep screen all read — clamping by the squad limit here was wrong once
  // the region's own element started travelling free, because the fieldable
  // pool is then legitimately larger than the squad.
  return Math.min(deckCapFor(cleared), ceiling);
}

export function deckCapFor(cleared: readonly string[]): number {
  let cap: number = CAP_LADDER[0].cap;
  for (const step of CAP_LADDER) {
    if (!step.unlockedBy) continue;
    const needed: readonly string[] =
      typeof step.unlockedBy === "string" ? [step.unlockedBy] : step.unlockedBy;
    const have = needed.filter((id) => cleared.includes(id)).length;
    const want = step.count ?? needed.length;
    if (have >= want) cap = Math.max(cap, step.cap);
  }
  return cap;
}

// ── recruitment ─────────────────────────────────────────────────────────────

export const DROP_RATE: Record<string, number> = {
  mythic: 5, legendary: 15, epic: 30, rare: 50,
};
/** Each clear that drops nothing adds this much to that card's chance here. */
export const PITY_STEP = 5;

export const baseRateFor = (defId: string): number => DROP_RATE[getDef(defId).rarity ?? "rare"] ?? 50;

/** A card's live chance at a node, base + accumulated pity, clamped to 100.
 *  `overflow` halves the BASE only — pity still accrues at full step, so a
 *  border card is slower to get but never unreachable. */
export function recruitChance(defId: string, pity: number, overflow = false): number {
  const base = overflow ? baseRateFor(defId) * OVERFLOW_RATE : baseRateFor(defId);
  return Math.min(100, base + pity * PITY_STEP);
}

// ── the Blight (§10.4) ──────────────────────────────────────────────────────
// DUSK does not wait in its region; it spreads across territory you have
// already taken. The load-bearing constraint is that Blight ONLY touches
// CLEARED regions — difficulty rises behind you, never in front of you — which
// is what lets it be aggressive without ever blocking progress or spiking a
// first-time route.

export const BLIGHT_MAX = 3;

/** Non-recruitable DUSK filler joining Warden-tier and higher squads at level
 *  1-2. Deliberately the cheap end: the Blight is pressure, not a power spike,
 *  and only a Blight NODE ever drops DUSK cards. */
export const BLIGHT_ADDS = ["dusk_crow", "dusk_pumpkin", "dusk_spider", "dusk_zombie_husk"];

/** DUSK is the source and can never be Blighted; DAWN is sealed behind the
 *  Arctic Veil and is the one place the shadow cannot reach. */
export const canBlight = (region: StoryRegion): boolean =>
  region.element !== "DUSK" && region.element !== "DAWN";

/** A region's live Blight: whatever the world has pushed onto it, never below
 *  the baseline it shipped with, never above the cap. */
export function blightLevel(save: StorySave, region: StoryRegion): number {
  if (!canBlight(region)) return 0;
  const earned = save.blight?.[region.id] ?? 0;
  return Math.min(BLIGHT_MAX, Math.max(region.baseBlight ?? 0, earned));
}

/** Blight only reaches a region you have finished — its required Throne down. */
export function isRegionCleared(save: StorySave, region: StoryRegion): boolean {
  if (!canBlight(region)) return false;
  const req = region.nodes.filter((n) => n.required);
  return req.length > 0 && req.every((n) => save.cleared.includes(n.id));
}

/** How many DUSK bodies join this node's squad. Skirmishes are never Blighted —
 *  the pressure lands on Warden tier and up, so the region's easy nodes stay
 *  farmable at the difficulty they were designed for. */
export function blightAddsFor(save: StorySave, region: StoryRegion, node: StoryNode): string[] {
  if (!isRegionCleared(save, region)) return [];
  // A Blight Node is already a pure DUSK squad — adding shadow to shadow is
  // double-counting, not pressure. A Gate is a border checkpoint rather than
  // territory, and §10.4 puts Blight on Warden-tier squads and up.
  if (node.kind === "skirmish" || node.kind === "throne"
      || node.kind === "blight" || node.kind === "gate") return [];
  const lvl = blightLevel(save, region);
  return lvl <= 0 ? [] : BLIGHT_ADDS.slice(0, Math.min(lvl, 2));
}

/** At level 2 the region's own Field spell is contested by Nightfall. */
export const terrainContested = (save: StorySave, region: StoryRegion): boolean =>
  isRegionCleared(save, region) && blightLevel(save, region) >= 2;

/** Every Throne cleared anywhere pushes Blight into one cleared region. Rises on
 *  WORLD PROGRESS, never on idle time or turn count, so farming and exploring
 *  are never punished. */
export function advanceBlight(save: StorySave, clearedNode: StoryNode): StorySave {
  if (clearedNode.kind !== "throne") return save;
  const target = REGIONS.find(
    (r) => isRegionCleared(save, r) && blightLevel(save, r) < BLIGHT_MAX,
  );
  if (!target) return save;
  return { ...save, blight: { ...save.blight, [target.id]: (save.blight?.[target.id] ?? 0) + 1 } };
}

/** The full DUSK squad that occupies a region at Blight 3. These cards ALSO
 *  live in the Realm of Shadows — the one deliberate break in one-card-one-node,
 *  and the point of the whole system: pushing the shadow out is the only way to
 *  field DUSK before you reach it. */
export const BLIGHT_NODE_ROSTER = ["dusk_reaper", "dusk_plaguecrow", "dusk_gool"];

/** The Blight Node itself — a map marker that exists only while the region is at
 *  the cap. It is generated, not authored, so it can appear in any region that
 *  has a border zone. */
export function blightNodeFor(save: StorySave, region: StoryRegion): StoryNode | null {
  if (!region.blightAt || blightLevel(save, region) < BLIGHT_MAX) return null;
  return {
    id: `${region.id.toUpperCase()}-B`,
    name: `${region.name}: The Blight`,
    kind: "blight",
    roster: [...BLIGHT_NODE_ROSTER],
    adds: [],
    requires: [],
    at: region.blightAt,
    note: "A full DUSK squad holding ground you already took. Clearing it pushes the shadow back a level — and DUSK cards join you.",
  };
}

export const isBlightNode = (node: StoryNode): boolean => node.kind === "blight";

/** Clearing a Blight Node is the counter-play: the shadow drops a level. This is
 *  what makes the Blight a choice rather than a tax. */
export function pushBackBlight(save: StorySave, node: StoryNode): StorySave {
  if (!isBlightNode(node)) return save;
  const region = REGIONS.find((r) => node.id === `${r.id.toUpperCase()}-B`);
  if (!region) return save;
  // Floor at the region's OWN baseline — you can drive out what the world pushed
  // in, but the Rot Line was painted into the map and does not wash off.
  const floor = region.baseBlight ?? 0;
  const now = blightLevel(save, region);
  return { ...save, blight: { ...save.blight, [region.id]: Math.max(floor, now - 1) } };
}

// ── Elemental Overflow (§10.5) ──────────────────────────────────────────────

/** Overflow cards roll at HALF base — a taste of the neighbour, not a shortcut
 *  past walking there. The card's home node stays the reliable farm. */
export const OVERFLOW_RATE = 0.5;

export const isOverflow = (node: StoryNode, defId: string): boolean =>
  !!node.overflow?.includes(defId);

/** Everything a node can actually give you: its own roster plus any bleed. */
export const recruitablePool = (node: StoryNode): string[] => [...node.roster, ...(node.overflow ?? [])];

// ── board size ──────────────────────────────────────────────────────────────

/** Node kinds fought on the LARGE board. Everything else is 4x4.
 *
 *  The campaign is a 4x4 game that opens up for its set pieces: a Landmark or a
 *  Throne is the fight the Act has been building to, and the extra rank and file
 *  of a 5x5 is what makes it feel like one. 33 of the campaign's ~124 nodes are
 *  big, so the large board stays an event rather than the default. */
export const BIG_BATTLE_KINDS: readonly NodeKind[] = ["landmark", "throne"];

/** The board a node is fought on — decided by the NODE, not by deck size.
 *
 *  This deliberately breaks the old coupling. Constructed play ties the two
 *  together (`custom-decks.ts` DECK_LIMITS: 4x4 is exactly 18 cards, 5x5 is
 *  exactly 30), and while the campaign cap ladder ran to 28 the campaign could honour
 *  it — every tier was legal on exactly one board. With the ladder now topping
 *  out at 18 that is no longer possible: an 18-card deck is under the
 *  constructed 5x5 minimum, so a Landmark or Throne is fought DELIBERATELY off
 *  the constructed format.
 *
 *  That is a campaign rule, not a rules change — nothing else in the game reads
 *  it, and both sides bring the same count (`formationSize(cap) === cap`), so
 *  the fight stays symmetric. It just means a set piece is a smaller army on a
 *  wider field, which is the manoeuvring the big board exists for. */
export const boardForNode = (region: StoryRegion, node: StoryNode): number =>
  node.board ?? (BIG_BATTLE_KINDS.includes(node.kind) ? 5 : region.board);

// ── border gates (§7) ───────────────────────────────────────────────────────

export const isGate = (n: StoryNode): boolean => n.kind === "gate";

export interface GateCheck {
  ok: boolean;
  /** Plain-language reasons the gate is refusing, in the order to show them. */
  reasons: string[];
}

/** How many cards in a deck satisfy a demand. */
export function demandMet(deck: readonly string[], demand: GateDemand): number {
  return deck.filter((id) => {
    const d = getDef(id);
    return demand.kind === "class" ? d.cardClass === demand.value : d.attackType === demand.value;
  }).length;
}

/**
 * §7's twofold gate requirement, checked against the CURRENT story deck.
 *
 * The deck-size half is exact, not a minimum: a gate is the campaign's one
 * moment of "prove you actually built something", and letting a 9-card deck
 * through a cap-15 gate would defeat the point of the cap ladder existing.
 */
export function gateCheck(save: StorySave, node: StoryNode): GateCheck {
  if (!isGate(node)) return { ok: true, reasons: [] };
  const reasons: string[] = [];
  // A gate is fought on 4x4, so it asks for a full 4x4 deck — not the 28 the
  // ladder may already allow for set pieces.
  const region = regionOfNode(node.id);
  const cap = region ? fightCap(save, region, node) : deckCapFor(save.cleared);
  if (save.deck.length !== cap)
    reasons.push(
      save.deck.length < cap
        ? `Your deck is ${save.deck.length}/${cap}. A gate takes a full deck — add ${cap - save.deck.length} more.`
        : `Your deck is ${save.deck.length}/${cap}. Drop ${save.deck.length - cap}.`,
    );
  if (node.demand) {
    const have = demandMet(save.deck, node.demand);
    if (have < node.demand.count)
      reasons.push(
        `This border wants ${node.demand.count} ${node.demand.value} card` +
        `${node.demand.count === 1 ? "" : "s"} — you have ${have}.`,
      );
  }
  return { ok: reasons.length === 0, reasons };
}

// ── formations (§10.7) ──────────────────────────────────────────────────────
// An enemy squad is a FORMATION, not a deck: it may field several copies of the
// same card. The player's collection stays one-card-one-copy; the AI's board
// does not. This is what lets a 3-card roster still fill a board at any tier —
// the node's card pool never changes, only how many bodies it puts up, so you
// always know exactly what you are farming for.

/** Copies of one card allowed in a formation, by rarity. Legendary and Mythic
 *  are never doubled: two Pyrogons is not a difficulty setting. */
export const DUPLICATE_CAP: Record<string, number> = {
  rare: 3, epic: 2, legendary: 1, mythic: 1,
};

/** Deck cap from which a formation may double its EPICS. Rares fill a board at
 *  every tier, but a second copy of an Epic means a second copy of a real
 *  Special every round — early Acts should not be padded with that. It unlocks
 *  at the 4x4 format max, which is Act III: the point the campaign stops being
 *  an introduction. */
export const EPIC_DUPLICATE_FROM_CAP = 18;

/**
 * How much of a formation may be Legendary and Epic, as a share of the whole
 * deck. Everything not taken by these is Rare.
 *
 * This is what makes a node tier feel different. A Skirmish is rank and file;
 * a Throne hands you its Mythic for free on a first clear, so the fight has to
 * earn it — the boss shows up with its region's Legendaries and Epics behind
 * it. The roster always goes in regardless, so a node whose own cards already
 * exceed its quota simply gets nothing more of that rarity.
 */
/** Act I runs its quotas at three quarters. The starting deck is 12 fixed Rares
 *  with no rebuilding done yet, and a Throne at the full share landed on it as
 *  1 Mythic + 2 Legendary + 4 Epic — a wall rather than a skill check. Later
 *  Acts keep the full profile, because by then the deck is yours. */
export const ACT_I_QUOTA_SCALE = 0.75;
export const quotaScale = (deckCap: number): number =>
  deckCap <= 12 ? ACT_I_QUOTA_SCALE : 1;

export const FILL_PROFILE: Record<NodeKind, { legendary: number; epic: number }> = {
  skirmish: { legendary: 0,    epic: 0    },
  warden:   { legendary: 0,    epic: 0.15 },
  blight:   { legendary: 0,    epic: 0.15 },
  gate:     { legendary: 0.10, epic: 0.25 },
  landmark: { legendary: 0.15, epic: 0.30 },
  throne:   { legendary: 0.20, epic: 0.35 },
};

/** Node kinds where a second Epic is the point rather than padding: a border
 *  checkpoint and a boss are supposed to be a wall. */
export const doublesEpics = (node: StoryNode): boolean =>
  node.kind === "gate" || node.kind === "landmark" || node.kind === "throne";

/**
 * Copies of one card allowed.
 *
 * Epics double when it SERVES A PURPOSE — either the campaign has scaled past
 * its introduction (`EPIC_DUPLICATE_FROM_CAP`), or the node is one of the ones
 * meant to stop you. An ordinary Act I Skirmish still meets each Epic once, so
 * a second real Special is a thing that happens at checkpoints rather than
 * everywhere. Legendary and Mythic never double at all.
 */
export function copyCapFor(defId: string, deckCap: number, epicsMayDouble = false): number {
  const rarity = getDef(defId).rarity ?? "";
  if (rarity === "epic")
    return deckCap >= EPIC_DUPLICATE_FROM_CAP || epicsMayDouble ? DUPLICATE_CAP.epic : 1;
  return DUPLICATE_CAP[rarity] ?? DUPLICATE_CAP_DEFAULT;
}
export const DUPLICATE_CAP_DEFAULT = 1;

/** Bodies a formation aims for: a WHOLE DECK, matched to the player's own card
 *  count. The enemy brings as many cards as you do — the fight is decided by
 *  what the cards are, not by who ran out of board first. §10.7's smaller
 *  table left a node fielding roughly half a deck, which read as the AI simply
 *  having less to work with. */
export const formationSize = (cap: number): number => cap;

/**
 * The enemy squad for a node, filled to the tier's target.
 *
 * Fill order is §10.7's, and the first step is load-bearing: every unique card
 * goes in before any duplicate, so the node still looks like itself. Four
 * identical cards reads as a bug, not a boss.
 *
 *   1. every unique card in the node's pool (roster + any overflow)
 *   2. filler — the node's tokens, plus any Blight bodies
 *   3. duplicate Rares, cheapest first
 *   4. duplicate Epics — ONLY from Act III (see EPIC_DUPLICATE_FROM_CAP)
 *
 * Never trims: a roster card dropped to hit the target would be unrecruitable
 * that run, so a big Landmark is simply allowed to be big.
 */
/** Opening deployment (§10.6) is now the PLAYER'S alone: one free teammate on
 *  the board before round one, and the opponent gets nothing.
 *
 *  It used to be symmetric — one each, two for a Throne. But the enemy already
 *  fields a whole deck built to the player's own card count (`formationSize`),
 *  with a rarity profile on top (`FILL_PROFILE`), so the free placement was
 *  paying difficulty into the side that needed it least. Handing it to the
 *  player only turns it into what it should have been: your head start, and the
 *  answer to "who do you lead with?".
 *
 *  Mechanically the AI simply finds no legal opening summon (`canSummon` fails
 *  on zero slots), so `aiPrepIntent` falls through to PASS and deployment ends
 *  on the usual two consecutive passes. No phase logic changes. */
export const PLAYER_DEPLOY = 1;
export const ENEMY_DEPLOY = 0;

/** The campaign's very first fight, and nothing else.
 *
 *  LEAF's opener is the one battle where the free placement is doing real work:
 *  a lone Sakuroot against three cards needs to choose her ground. Everywhere
 *  else it is an unearned head start on top of a deck the player built, so it
 *  is switched off — including at the other regions' openers, which are reached
 *  with a full squad.
 *
 *  Identified by structure rather than by hardcoding "L1": the first battle is
 *  the opening node of the one region no gate stands in front of. */
export const isFirstBattle = (region: StoryRegion, node: StoryNode): boolean =>
  !region.requires?.length && region.opening.node === node.id;

export function buildFormation(save: StorySave, region: StoryRegion, node: StoryNode): string[] {
  const uniques = recruitablePool(node);
  const opening = isOpeningNode(region, node);
  // An opening battle is sized ONE-FOR-ONE against what the player can field,
  // and takes the CHEAPEST of its roster first.
  //
  // Measured, LEAF's opener was a lone Sakuroot against all three of Spring
  // Village's cards, one of them Greegon — a REGEN tank the node's own note
  // calls one "you cannot out-race". The player won 57% of the time but took
  // 34.6 rounds to do it and 26 of 60 runs ran out the clock. That is not a
  // hard tutorial, it is a war of attrition as the first thing the game shows
  // you. One card should face one card, and the cheapest one.
  //
  // Rewards are untouched: `guaranteedDrops` hands over the whole roster plus
  // the region's Epic however few of them actually stood on the board, so a
  // smaller opener costs the player nothing.
  const openingRoster = opening
    ? [...uniques].sort((a, b) => getDef(a).cost - getDef(b).cost)
    : uniques;
  // Filler is non-recruitable by construction — tokens can't be decked and
  // Blight adds only drop from a Blight Node. An opener takes no filler at all.
  const out = opening
    ? openingRoster.slice(0, openingTarget(save, region))
    : [...uniques, ...node.adds, ...blightAddsFor(save, region, node)];

  const copies = new Map<string, number>();
  for (const id of out) copies.set(id, (copies.get(id) ?? 0) + 1);

  // The ladder and board, as always: the enemy is sized by how far the
  // campaign has come, NOT by how thin the player is travelling. Clamping
  // every fight to the pool rewrote the whole difficulty curve — an early
  // node fielded four cards because the player owned four.
  const cap = capForNode(save.cleared, region, node);
  // An opening battle MATCHES THE PLAYER rather than filling to the cap, and is
  // floored at ONE rather than at the roster.
  //
  // Flooring at the roster was the previous attempt and it is what made LEAF's
  // opener a slog: three cards is the smallest that node could ever field, so a
  // one-card player was always outnumbered three to one. Arriving somewhere new
  // with a packed squad of fourteen still gets fourteen, so the welcome mat does
  // not become a walkover later in the campaign — the fight simply tracks the
  // force you actually brought.
  const target = opening ? Math.min(cap, openingTarget(save, region)) : formationSize(cap);
  const byCost = (a: string, b: string) => getDef(a).cost - getDef(b).cost;
  const rarity = (id: string) => getDef(id).rarity ?? "";
  const countOf = (r: string) => out.filter((id) => rarity(id) === r).length;
  const epicsMayDouble = doublesEpics(node);

  // Everything already standing: the node's own pool plus its tokens, patrol and
  // escorts. A Throne's roster is a lone Mythic and a Gate has no roster at all,
  // so a pool of just `uniques` leaves both unable to fill past a body or two.
  const present = [...new Set([...uniques, ...node.adds])];
  /** The region's own cards of a rarity, minus anything already standing. All
   *  placed on their own nodes, so nothing is made unobtainable by being used
   *  here as non-recruitable rank and file. */
  const regionPool = (r: string) =>
    [...new Set(region.nodes.flatMap((n) => n.roster))]
      .filter((id) => rarity(id) === r && !present.includes(id))
      .sort(byCost);

  /** Add from `pool` until the formation hits `limit` of that rarity, or fills. */
  const fill = (pool: string[], limit: number) => {
    for (let guard = 0; guard < 40 && out.length < target; guard++) {
      let placed = false;
      for (const id of pool) {
        if (out.length >= target) break;
        if (limit >= 0 && countOf(rarity(id)) >= limit) return;
        if ((copies.get(id) ?? 0) >= copyCapFor(id, cap, epicsMayDouble)) continue;
        out.push(id);
        copies.set(id, (copies.get(id) ?? 0) + 1);
        placed = true;
      }
      if (!placed) return; // everything in this pool is capped
    }
  };

  // Power bands FIRST, up to the node's quota, then Rares mop up the rest. A
  // Throne hands you its Mythic for free on a first clear, so the fight has to
  // be worth it — the boss arrives with its region's Legendaries and Epics
  // behind it, not ten Rares. A Skirmish is all rank and file, which is what
  // makes a Throne read as different.
  const p = FILL_PROFILE[node.kind];
  const scale = quotaScale(cap);
  const maxLeg = Math.floor(target * p.legendary * scale);
  const maxEpic = Math.floor(target * p.epic * scale);
  fill(regionPool("legendary"), maxLeg);
  fill(present.filter((id) => rarity(id) === "epic").sort(byCost), maxEpic);
  fill(regionPool("epic"), maxEpic);
  // Rares are the remainder — no quota, they fill whatever is left.
  fill(present.filter((id) => rarity(id) === "rare").sort(byCost), -1);
  fill(regionPool("rare"), -1);
  return out;
}

// ── save state ──────────────────────────────────────────────────────────────

export interface StorySave {
  /** Node ids cleared at least once. */
  cleared: string[];
  /** Card ids owned. Starts as the starter deck. */
  collection: string[];
  /** `${nodeId}:${defId}` -> dry clears since the last recruit of that card. */
  pity: Record<string, number>;
  /** The player's current story deck — whatever they last took into a fight. */
  deck: string[];
  /** Saved teams, built from the collection and kept between fights.
   *
   *  The campaign asks you to fight eight different elements with one deck,
   *  which in practice means rebuilding it on the map every time the terrain
   *  changes. A loadout is that rebuild, remembered: tag it with the element it
   *  answers and the prep screen surfaces it when you walk into that region. */
  loadouts?: Loadout[];
  /** The team most recently saved or taken into a fight. Prep offers this one
   *  back first — without it, "which team do I get?" answered with whichever
   *  matching team was saved EARLIEST, so saving a new one and returning
   *  silently fought with an older deck. */
  lastTeamId?: string;
  /** Region id -> Blight earned from world progress. The region's own baseline
   *  is applied on read, so it can never be saved away. */
  blight: Record<string, number>;
  /** Region id -> the foreign cards packed for that region, REMEMBERED.
   *
   *  One entry per region rather than a single travelling squad: you are asked
   *  to pack the first time you cross a border and never again, because coming
   *  back finds the expedition exactly as you left it. A single squad meant
   *  re-entering anywhere re-opened the picker, which is the same question
   *  answered over and over. */
  squads?: Record<string, string[]>;
  /** The player. See `Hero`. Absent on a save written before heroes existed;
   *  `loadStory` mints a default one rather than leaving it undefined. */
  hero?: Hero;
  /** Region id -> the deck last taken into a fight THERE.
   *
   *  `deck` alone is one global team, so walking LEAF -> PYRO -> LEAF handed the
   *  PYRO team back on arrival and the LEAF one had to be rebuilt from memory.
   *  Remembering per region means coming back finds the board you left. */
  decks?: Record<string, string[]>;
  /** Pre-`squads` saves carried one travelling squad. Read once on load and
   *  folded into `squads`, never written again. */
  squad?: { region: string; cards: string[] };
}

const STORAGE_KEY = "we_story_v1";

/** The player themselves: the one who casts the spells and keeps the cards.
 *
 *  Deliberately a SAVE FIELD and nothing more. The hero never stands on the
 *  board, is never targeted and cannot die — it is a face, a spellbook and a
 *  wallet. That is not a limitation dodged, it is the whole reason this costs
 *  nothing: spells in this game have always been cast by the PLAYER rather than
 *  by a card, so "the hero casts them" was already true mechanically and only
 *  needed a name attached. A hero unit on the board would be a new actor type
 *  touching targeting, AoE, capture, defeat, the AI threat model and every
 *  spell that reads "all enemies" — a different project.
 *
 *  What it owns is the three things that were already lying around unattached:
 *  the collection (which `StorySave` already held), the spellbook (which the
 *  campaign was not using at all — story matches passed an empty one), and
 *  essence (which the map has been PROMISING the player since before it
 *  existed — see the exhausted-node copy in StoryMap). */
export interface Hero {
  name: string;
  /** The element the hero began with. LEAF for every campaign that starts at
   *  Spring Village, which is all of them today; kept as a field because the
   *  starting region is data, not a constant. */
  affinity: string;
  /** Spell ids unlocked so far. NOT the book taken into a fight — that is
   *  capped at 5 (8 on a large board), so this is the shelf you choose from. */
  spells: string[];
  /** Element id -> essence banked. The crafting currency: buys one EXACT card,
   *  slowly, in the element that paid for it. */
  essence: Record<string, number>;
  /** Shards. The booster currency, and deliberately NOT essence.
   *
   *  The three routes to a complete collection have to be genuinely different
   *  or they are one route wearing three hats: the story pays in dice, essence
   *  buys the exact card the dice withheld, and shards buy VOLUME at random.
   *  Shards come from winning matches — anywhere, Arena included — which is
   *  also the only thing that gives the Arena a reason to exist beside practice.
   *
   *  A separate currency is what makes a real-money top-up a price change later
   *  rather than a redesign: nothing but `shards` would need to move. */
  shards: number;
  /** Card ids you hold a SHINY copy of. Cosmetic only — a shiny is the same
   *  card with the same stats, and the deck builder neither knows nor cares.
   *  Kept on the hero rather than as a parallel collection because that is what
   *  it is: a thing that happened to you, not a different card. */
  shiny: string[];
}

/** A saved team. `element` is the element this team is FOR — the one it expects
 *  to fight, not the one it is built from — and is only ever a hint for
 *  ordering the prep screen, never a restriction. */
export interface Loadout {
  id: string;
  name: string;
  element?: string;
  cards: string[];
  /** The spellbook this team carries.
   *
   *  A team used to be cards only, so every campaign fight went in with
   *  `heroBookFor` — the cheapest spells you have unlocked, in cost order,
   *  trimmed to the board. That is a sensible default and a poor deck: the
   *  answer a LEAF team wants against PYRO is not the same as the one it wants
   *  against AQUA, and the Arena has let you choose since it shipped.
   *
   *  Absent or empty = the old behaviour, deliberately: an existing save has no
   *  books, and "none chosen" must keep meaning "give me the shelf" rather than
   *  "walk in with nothing". */
  spells?: string[];
}

/** The book a team actually carries: its own if it has one, else the hero's
 *  shelf. Trimmed to the board's cap either way — a team saved for a 5x5 set
 *  piece must not smuggle eight spells onto a 4x4 skirmish. */
export function bookForLoadout(
  save: StorySave,
  loadout: Loadout | undefined,
  boardSize: number,
): string[] {
  const shelf = heroSpellShelf(save);
  const own = (loadout?.spells ?? []).filter((id) => shelf.includes(id));
  return (own.length ? own : heroBookFor(save, boardSize)).slice(0, spellCapForBoard(boardSize));
}

/** Loadouts most likely to be wanted against `element`, best first. A team
 *  tagged for this element leads; everything else keeps its own order. */
export function loadoutsFor(save: StorySave, element?: string): Loadout[] {
  const all = save.loadouts ?? [];
  if (!element) return all;
  return [...all].sort((a, b) => Number(b.element === element) - Number(a.element === element));
}

/** The team to offer on arrival at a node, or undefined for "keep the last deck".
 *
 *  Order: the team last saved or fought with, then the MOST RECENT team tagged
 *  for this element. Newest-first is the whole point — teams are appended, so
 *  searching forwards returned the oldest match and a freshly saved team was
 *  never the one you got back. `legal` is applied to both so a team that has
 *  outgrown the node's cap is skipped rather than silently offered and refused. */
export function preferredLoadout(
  save: StorySave,
  element: string | undefined,
  legal: (l: Loadout) => boolean,
): Loadout | undefined {
  const all = save.loadouts ?? [];
  const last = all.find((l) => l.id === save.lastTeamId);
  if (last && legal(last)) return last;
  for (let i = all.length - 1; i >= 0; i--)
    if (all[i].element === element && legal(all[i])) return all[i];
  return undefined;
}

/** Whether a team can legally be taken into this fight. Undersized is the only
 *  hard failure — the cap is a ceiling, not a quota, and a player who wants to
 *  fight a Skirmish with twelve good cards instead of eighteen mediocre ones
 *  should be allowed to. */
export function loadoutLegal(cards: string[], cap: number): { ok: boolean; reason?: string } {
  if (cards.length === 0) return { ok: false, reason: "Empty team" };
  if (cards.length > cap) return { ok: false, reason: `${cards.length} cards — the cap here is ${cap}` };
  return { ok: true };
}

export function newSave(): StorySave {
  return {
    cleared: [], collection: [...STARTER_DECK], pity: {},
    deck: [...STARTER_DECK], blight: {}, hero: newHero(),
  };
}

/** Read the save, dropping anything that no longer exists — so removing a card
 *  or renaming a node can never brick a campaign the way it could a deck. */
export function loadStory(): StorySave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return newSave();
    const p = JSON.parse(raw) as Partial<StorySave>;
    const known = (ids: unknown): string[] =>
      Array.isArray(ids) ? ids.filter((i): i is string => typeof i === "string" && !!CARD_INDEX[i]) : [];
    const collection = known(p.collection);
    const save: StorySave = {
      cleared: Array.isArray(p.cleared) ? p.cleared.filter((c) => typeof c === "string" && !!nodeById(c)) : [],
      collection: collection.length ? collection : [...STARTER_DECK],
      pity: p.pity && typeof p.pity === "object" ? (p.pity as Record<string, number>) : {},
      // A deck can only hold cards you own — a stale entry silently drops out.
      deck: known(p.deck).filter((id) => collection.includes(id)),
      blight: p.blight && typeof p.blight === "object" ? (p.blight as Record<string, number>) : {},
      // Saved teams are additive: a pre-loadouts save simply has none, and every
      // card is re-checked against the collection so a team cannot smuggle in
      // something that was never recruited.
      // Dropped if it names a team that no longer exists, so a deleted team
      // cannot leave the save pointing at nothing.
      lastTeamId: typeof p.lastTeamId === "string" ? p.lastTeamId : undefined,
      loadouts: Array.isArray(p.loadouts)
        ? (p.loadouts as Loadout[])
            .filter((l) => l && typeof l.id === "string" && typeof l.name === "string")
            .map((l) => ({
              id: l.id,
              name: l.name,
              element: typeof l.element === "string" ? l.element : undefined,
              cards: known(l.cards).filter((id) => collection.includes(id)),
              // A book naming a spell that no longer exists must not reach the
              // engine; an absent one keeps meaning "use the shelf".
              spells: Array.isArray(l.spells)
                ? [...new Set(l.spells)].filter((id) => SPELLS.some((sp) => sp.id === id))
                : undefined,
            }))
            .filter((l) => l.cards.length > 0)
        : [],
      // The packed expeditions, restored like everything else: real region ids,
      // and only cards still owned. Without this they were written on packing
      // and silently forgotten on reload, so every trip back to a region asked
      // the player to pack again — every field of StorySave is rebuilt by hand
      // here, so a new one is invisible until it is listed.
      // Restored like every other field, and MINTED when absent: a campaign
      // saved before heroes existed still has a player, it just never had a
      // name for them. Essence values are coerced to finite numbers so a
      // hand-edited or older save cannot poison the wallet with NaN.
      hero: (() => {
        const h = p.hero;
        const base = newHero();
        if (!h || typeof h !== "object") return base;
        const essence: Record<string, number> = {};
        for (const [el, n] of Object.entries(h.essence ?? {}))
          if (typeof n === "number" && Number.isFinite(n) && n > 0) essence[el] = Math.floor(n);
        return {
          name: typeof h.name === "string" && h.name.trim() ? h.name : base.name,
          affinity: typeof h.affinity === "string" ? h.affinity : base.affinity,
          spells: Array.isArray(h.spells) ? h.spells.filter((x): x is string => typeof x === "string") : [],
          essence,
          shards:
            typeof h.shards === "number" && Number.isFinite(h.shards) && h.shards > 0
              ? Math.floor(h.shards)
              : 0,
          shiny: Array.isArray(h.shiny)
            ? [...new Set(h.shiny.filter((x): x is string => typeof x === "string" && !!CARD_INDEX[x]))]
            : [],
        };
      })(),
      decks: Object.fromEntries(
        Object.entries((p.decks ?? {}) as Record<string, unknown>)
          .filter(([id]) => REGIONS.some((r) => r.id === id))
          .map(([id, cards]) => [id, known(cards).filter((c) => collection.includes(c))]),
      ),
      squads: Object.fromEntries(
        Object.entries((p.squads ?? {}) as Record<string, unknown>)
          .filter(([id]) => REGIONS.some((r) => r.id === id))
          .map(([id, cards]) => [id, known(cards).filter((c) => collection.includes(c))]),
      ),
    };
    // Saves written before squads were per-region carried a single travelling
    // one. Fold it into its region and drop it, so an in-flight campaign is not
    // asked to re-pack where it already had.
    const legacy = p.squad;
    if (legacy && typeof legacy === "object" && typeof legacy.region === "string" &&
        !save.squads![legacy.region] && REGIONS.some((r) => r.id === legacy.region))
      save.squads![legacy.region] = known(legacy.cards).filter((c) => collection.includes(c));
    if (!save.deck.length) save.deck = save.collection.slice(0, deckCapFor(save.cleared));
    return save;
  } catch {
    return newSave();
  }
}

export function saveStory(save: StorySave): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    /* storage full or unavailable — the campaign stays in memory for the session */
  }
}

export function clearStory(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ── node availability ───────────────────────────────────────────────────────

export const isCleared = (save: StorySave, id: string): boolean => save.cleared.includes(id);

/** A node is open when its own prerequisites AND its region's gate are cleared.
 *  The region check matters because every region's entry node has no
 *  prerequisites of its own — without it, PYRO's P1 would read as open from the
 *  first turn of the campaign. */
export const isOpen = (save: StorySave, n: StoryNode): boolean => {
  const home = regionOfNode(n.id);
  if (home && !isRegionOpen(save, home)) return false;
  const have = n.requires.filter((r) => save.cleared.includes(r)).length;
  return have >= (n.requiresCount ?? n.requires.length);
};

// ── where do I get this card? ───────────────────────────────────────────────
// Pillar 3 is "you fight what you want to own" — which is only true if the
// collection can actually answer "so where is it?". These invert the placement
// data rather than duplicating it, so a node move can never desync the answer.

export interface CardSource {
  node: StoryNode;
  region: StoryRegion;
  /** True when this node only bleeds the card across a border at half odds. */
  overflow: boolean;
}

/** Every node that can recruit a card. Empty = it lives in a region that has
 *  not been built yet, which is a content gap, not a locked door. */
export function sourcesOf(defId: string): CardSource[] {
  const out: CardSource[] = [];
  for (const region of REGIONS)
    for (const node of region.nodes) {
      if (node.roster.includes(defId)) out.push({ node, region, overflow: false });
      else if (node.overflow?.includes(defId)) out.push({ node, region, overflow: true });
    }
  // Full-odds homes first: the answer to "where do I farm this" is never the
  // border node when a home node exists.
  return out.sort((a, b) => Number(a.overflow) - Number(b.overflow));
}

/** The best odds available for a card right now, and where. Null when the card
 *  is unplaced or every source is still locked. */
export function bestSource(save: StorySave, defId: string): CardSource | null {
  const open = sourcesOf(defId).filter((s) => isOpen(save, s.node));
  if (open.length === 0) return null;
  return open.reduce((best, s) =>
    recruitChance(defId, save.pity[`${s.node.id}:${defId}`] ?? 0, s.overflow) >
    recruitChance(defId, save.pity[`${best.node.id}:${defId}`] ?? 0, best.overflow) ? s : best,
  );
}

/** Everything placed anywhere — the denominator for "N of M collected". Counts
 *  cards, not placements, so an overflow copy never inflates the total. */
export const PLACED_CARDS: string[] = [...new Set(
  REGIONS.flatMap((r) => r.nodes.flatMap((n) => [...n.roster, ...(n.overflow ?? [])])),
)];

// ── the recruitment roll ────────────────────────────────────────────────────

export interface RecruitResult {
  /** Cards newly added to the collection. */
  won: string[];
  /** Cards that rolled and missed, with their pity now one step higher. */
  missed: string[];
  rolls: number;
  /** Of the cards won, the ones that came in foil. */
  shiny: string[];
}

/**
 * Roll recruitment for a cleared node.
 *
 * Rolls are earned by CAPTURE: a sloppy win that padlocks two slots gets two
 * rolls, a dominant win that padlocks five gets five. That makes the win
 * condition the collection engine rather than a separate reward table.
 *
 * A win by elimination padlocks nothing, so it would otherwise pay zero — it is
 * floored at one roll, since "you won and got nothing to even roll on" reads as
 * a bug however it is documented.
 *
 * Cards already owned do not roll. The eligible pool shrinks as you clear a
 * node repeatedly, so late runs are increasingly targeted at the one card you
 * still want — and duplicates can never occur.
 *
 * `rand` is injected so this is deterministic under test.
 */
export function rollRecruits(
  save: StorySave,
  node: StoryNode,
  capturedSlots: number,
  rand: () => number = Math.random,
): RecruitResult {
  const eligible = recruitablePool(node).filter((id) => !save.collection.includes(id));
  const rolls = Math.max(1, capturedSlots);
  const won: string[] = [];
  const missed: string[] = [];

  // The opening battle pays out in full, no dice. Checked BEFORE the empty-pool
  // return below, because the region's Epic is not in the recruitable pool — it
  // lives on a node deeper in — and an opener whose Rares are already owned
  // would otherwise hand over nothing at all.
  const openingRegion = regionOfNode(node.id);
  if (openingRegion && isOpeningNode(openingRegion, node)) {
    const opened = guaranteedDrops(openingRegion, node).filter((id) => !save.collection.includes(id));
    return { won: opened, missed: [], rolls, shiny: opened.filter(() => rollShiny(rand)) };
  }
  if (!eligible.length) return { won, missed, rolls, shiny: [] };

  // A Throne's Mythic is a guaranteed recruit on first clear: no RNG on a
  // story-critical unlock.
  if (node.kind === "throne" && !isCleared(save, node.id)) {
    return { won: [...eligible], missed, rolls, shiny: eligible.filter(() => rollShiny(rand)) };
  }

  const pool = [...eligible];
  for (let i = 0; i < rolls && pool.length; i++) {
    const pick = pool[Math.floor(rand() * pool.length) % pool.length];
    const key = `${node.id}:${pick}`;
    if (rand() * 100 < recruitChance(pick, save.pity[key] ?? 0, isOverflow(node, pick))) {
      won.push(pick);
      pool.splice(pool.indexOf(pick), 1); // can't win the same card twice in one clear
    } else if (!missed.includes(pick)) {
      missed.push(pick);
    }
  }
  return { won, missed, rolls, shiny: won.filter(() => rollShiny(rand)) };
}

/** Fold a clear + its recruits into the save. Pure — returns a new save. */
export function applyClear(save: StorySave, node: StoryNode, result: RecruitResult): StorySave {
  const pity = { ...save.pity };
  for (const id of result.won) delete pity[`${node.id}:${id}`];
  for (const id of result.missed) {
    const key = `${node.id}:${id}`;
    pity[key] = (pity[key] ?? 0) + 1;
  }
  const next: StorySave = {
    // A Blight Node is never banked as "cleared" — it can come back, and a stale
    // tick would make the returning node render as already beaten.
    cleared: isBlightNode(node) || save.cleared.includes(node.id)
      ? save.cleared
      : [...save.cleared, node.id],
    collection: [...save.collection, ...result.won.filter((id) => !save.collection.includes(id))],
    pity,
    deck: save.deck,
    blight: save.blight ?? {},
  };
  // Blight is read AFTER the clear is banked, so finishing a region's Throne can
  // immediately push shadow into it.
  const region = regionOfNode(node.id);
  const paid = region ? awardEssence(next, region, node) : next;
  return advanceBlight(pushBackBlight(addShiny(paid, result.shiny), node), node);
}

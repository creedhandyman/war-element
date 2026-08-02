// Story Mode — campaign data, save state, and the recruitment roll.
//
// The map IS the progression system: there is no XP and no character level, so
// everything here is (a) where the nodes are, (b) which nodes you've cleared,
// and (c) which cards you own. Deck size is unlocked by clearing Thrones.
//
// This module is pure data + pure functions. It never imports from the engine's
// runtime or from React, so the whole campaign layer stays testable headlessly.

import { CARD_INDEX, getDef } from "./cards";

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
  note?: string;
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
  nodes: StoryNode[];
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
      note: "The tutorial. Greegon is a REGEN tank you cannot out-race — capture the slot." },
    { id: "L2", name: "Cherry Grove Path", kind: "skirmish", at: { x: 19, y: 24 },
      requires: ["L1"], roster: ["leaf_birch", "leaf_leaf", "leaf_guardian"], adds: [] },
    { id: "L3", name: "Bloomwardens' Ring", kind: "warden", at: { x: 32, y: 40 },
      requires: ["L2"], roster: ["leaf_stickers", "leaf_splint", "leaf_fallona"], adds: ["leaf_acorn_tok"] },
    { id: "L4", name: "Evergreen Plains", kind: "skirmish", at: { x: 25, y: 62 },
      requires: ["L1"], roster: ["leaf_oak", "leaf_python", "leaf_sticks", "leaf_sprinu"], adds: [] },
    { id: "L5", name: "Summer's Embrace Grove", kind: "warden", at: { x: 40, y: 74 },
      requires: ["L4"], roster: ["leaf_alpha", "leaf_dande", "leaf_squanch"], adds: ["leaf_acorn_tok"] },
    { id: "L6", name: "Jungle Wilds", kind: "warden", at: { x: 83, y: 60 },
      requires: ["L5"], roster: ["leaf_stickviper", "leaf_gecko", "leaf_cactus"], adds: ["leaf_reptilian_tok"],
      note: "The Reptile node — StickViper and Gecko are the tribe. Fight it before the warlord who buffs it." },
    // Gated off L10, not L2: the art puts Rustling Woods at Autumn's Gold in the
    // far north-east, so the approach is along the northern treeline.
    { id: "L7", name: "Rustling Woods", kind: "skirmish", at: { x: 78, y: 38 },
      requires: ["L10"], roster: ["leaf_walking_tree", "leaf_hunter", "leaf_dartfrog"], adds: [],
      overflow: ["aqua_misty"], // fronts Eastleaf Port — the Gateway to Aqua
      note: "Autumn's Gold. Eastleaf Port and the sea road to AQUA lie just east." },
    // Gated off L5, not L7: the Rot Line is painted across the SOUTHERN treeline,
    // a step past Summer's Embrace — nowhere near the northern woods.
    { id: "L8", name: "The Rot Line", kind: "warden", at: { x: 41, y: 84 },
      requires: ["L5"], roster: ["leaf_nightshade", "leaf_darth", "leaf_bark_bushmen"], adds: [],
      overflow: ["pyro_staph"], // fronts the Southern Burn — the open road to PYRO
      note: "The mid-forest spike, and the scar DUSK left. Where a starter deck stops working." },
    { id: "L9", name: "Winter's Reach Treeline", kind: "skirmish", at: { x: 40, y: 21 },
      requires: ["L2"], roster: ["leaf_lumberjack", "leaf_whintey", "leaf_sakuroot"], adds: [] },
    { id: "L10", name: "Winter Village Sentinels", kind: "warden", at: { x: 58, y: 23 },
      requires: ["L9"], roster: ["leaf_sumerose", "leaf_rubyo", "leaf_citra"], adds: [],
      note: "Under the Arctic Veil. The ice wall north is DAWN's border — sealed all campaign." },
    { id: "L11", name: "Heart of Nature: Outer Roots", kind: "landmark", at: { x: 40, y: 60 },
      requires: ["L3", "L8"], roster: ["leaf_season", "leaf_thorn", "leaf_elderroot"], adds: [],
      note: "Elderroot is the game's only melee Support." },
    { id: "L12", name: "Heart of Nature: The Spirit Tree", kind: "landmark", at: { x: 56, y: 56 },
      requires: ["L11"], roster: ["leaf_warden", "leaf_efy", "leaf_fallow"], adds: [] },
    { id: "L13", name: "Jungle Throne", kind: "throne", at: { x: 67, y: 81 },
      requires: ["L6", "L12"], roster: ["leaf_trinezer"],
      // Escorts: the Reptile tribe it commands, already farmable at L6.
      adds: ["leaf_reptilian_tok", "leaf_stickviper", "leaf_gecko"],
      note: "Deep Grove. Optional — an early skill check with a Mythic reward." },
    { id: "L14", name: "The Spirit Tree Rises", kind: "throne", at: { x: 48, y: 45 },
      requires: ["L12"], roster: ["leaf_oakgre"],
      // Escorts: the old growth around it, farmable at L4 and L2.
      adds: ["leaf_acorn_tok", "leaf_oak", "leaf_birch"], required: true,
      note: "Required. Clearing it opens the borders to PYRO and AQUA." },
    // Gates. Rosters live in `adds` because a gate is a checkpoint, not a farm —
    // its squad is a mixed border patrol of BOTH elements, and putting real
    // cards in a recruitable roster would place them a second time.
    { id: "GA", name: "Gate A: Summer's Southern Burn", kind: "gate", at: { x: 63, y: 94 },
      requires: ["L14"], roster: [], opens: ["pyro"],
      adds: ["leaf_gecko", "leaf_dartfrog", "pyro_staph", "pyro_sparky", "pyro_florence", "pyro_ingit"],
      demand: { kind: "attack", value: "Ranged", count: 3 },
      note: "The open road south. The burn punishes anything that has to close distance." },
    { id: "GB", name: "Gate B: Eastleaf Port", kind: "gate", at: { x: 93, y: 30 },
      requires: ["L14"], roster: [], opens: ["aqua"],
      adds: ["leaf_hunter", "leaf_walking_tree", "aqua_misty", "aqua_buccaneers", "aqua_piranha", "aqua_blub"],
      demand: { kind: "class", value: "Support", count: 2 },
      note: "The sea road east. A long crossing — bring something that can keep a crew alive." },
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
      note: "Where the forest dies. The road back to LEAF is right behind you." },
    { id: "P3", name: "Cinder Road", kind: "skirmish", at: { x: 61, y: 27 },
      requires: ["P1"], roster: ["pyro_ingit", "pyro_bbq", "pyro_baboom", "pyro_taper"], adds: [] },
    { id: "P4", name: "Dessaer District: Forge of Fire", kind: "skirmish", at: { x: 30, y: 31 },
      requires: ["P1"], roster: ["pyro_smog_card", "pyro_heatsink_golem", "pyro_spitfire", "pyro_dyna"], adds: [],
      note: "Forged Tech works. Fight the tribe here before you meet its Mythic at the Forge Core." },
    { id: "P5", name: "The Slagfields", kind: "skirmish", at: { x: 84, y: 31 },
      requires: ["P3"], roster: ["pyro_ash_boar", "pyro_slag_tortoise", "pyro_ember_scorpion", "pyro_wick"], adds: [],
      note: "Cooled lava badlands. Four Rares and no champion — the heaviest Skirmish in the region." },
    { id: "P6", name: "Pyro City Gates", kind: "warden", at: { x: 46, y: 55 },
      requires: ["P3"], roster: ["pyro_firebird", "pyro_liza", "pyro_scully"], adds: [] },
    { id: "P9", name: "Firespine Foothills", kind: "warden", at: { x: 16, y: 34 },
      requires: ["P4"], roster: ["pyro_fenrir", "pyro_firefly", "pyro_twins"], adds: [],
      note: "The whole Cost-5 band on one node. The last gate before the Landmarks." },
    { id: "P7", name: "Ember Fortress Drill Yard", kind: "warden", at: { x: 68, y: 41 },
      requires: ["P6"], roster: ["pyro_woof", "pyro_scorch", "pyro_tiki"], adds: [] },
    { id: "P8", name: "Forgotten Ruins", kind: "warden", at: { x: 88, y: 57 },
      requires: ["P5"], roster: ["pyro_sarra", "pyro_sseerr", "pyro_fenix"], adds: [],
      note: "Half-buried civilization. Where a LEAF-only deck stops working — three BURN Epics with real Specials." },
    // Gated off the city, not off P1: the painted road to the harbour runs
    // through Pyro City. Still only four nodes deep, which keeps the doc's
    // point that a player finding PYRO too punishing can sail out early.
    { id: "P2", name: "Sunfall Coast", kind: "skirmish", at: { x: 34, y: 88 },
      requires: ["P6"], roster: ["pyro_flamehound", "pyro_firecrack", "pyro_canister"], adds: [],
      overflow: ["aqua_buccaneers"], // pirate haven — the sea road to AQUA
      note: "Pirate haven. Gate C opens the sea route to AQUA from here." },
    { id: "P10", name: "Ember Fortress: Inner Keep", kind: "landmark", at: { x: 74, y: 49 },
      requires: ["P7", "P8"], roster: ["pyro_infernus_rex", "pyro_magmadon", "pyro_magmaw"], adds: [],
      note: "The three heavy bruisers. Magmaw exists only in the live build — no project doc has it." },
    { id: "P11", name: "Sunfall Watch", kind: "landmark", at: { x: 62, y: 72 },
      requires: ["P2", "P10"], roster: ["pyro_volcanon", "pyro_sol", "pyro_aftermath", "pyro_dynomight"], adds: [],
      note: "The Cost-6 utility tier, all four on one node." },
    { id: "P13", name: "Firespine Peaks: Dragon's Lair", kind: "throne", at: { x: 10, y: 53 },
      requires: ["P9", "P10"], roster: ["pyro_pyrogon"],
      // Escorts: the volcanic beasts of the slopes, farmable at P5.
      adds: ["pyro_ash_boar", "pyro_wick"], required: true,
      note: "Required. Clearing it opens Gate D — the Veil Gate, and the DUSK reach." },
    { id: "P12", name: "The Forge Core", kind: "throne", at: { x: 23, y: 66 },
      requires: ["P13"], roster: ["pyro_nitro"],
      // Escorts: Forged Tech, the tribe Nitro tops — farmable at P4.
      adds: ["pyro_heatsink_golem", "pyro_dyna"],
      note: "Optional. Where the first flame burns — Forged Tech's Mythic." },
    // Gate C, PYRO side. Its twin sits on AQUA's map, so switching routes never
    // means walking back through LEAF.
    { id: "GC", name: "Gate C: Sunfall Harbor", kind: "gate", at: { x: 53, y: 94 },
      requires: ["P2"], roster: [], opens: ["aqua"],
      adds: ["pyro_flamehound", "pyro_canister", "aqua_buccaneers", "aqua_bootlegger", "aqua_piranha", "aqua_blub"],
      demand: { kind: "class", value: "Tank", count: 3 },
      note: "Boarding actions in the pirate lanes. Bring bodies that can hold a deck." },
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
  art: "/maps/aqua.webp",
  artRatio: 1440 / 1080,
  requires: ["GB", "GC"], // Gate B from LEAF, or Gate C from PYRO
  // The Drowned Blight: the art already paints DUSK's violet across the
  // south-east water.
  blightAt: { x: 86, y: 91 },
  nodes: [
    { id: "A1", name: "Leafward Crossing", kind: "skirmish", at: { x: 24, y: 30 },
      requires: [], roster: ["aqua_misty", "aqua_buccaneers", "aqua_piranha"], adds: [],
      note: "Where ships arrive. Misty and Buccaneers bleed out to LEAF and PYRO — this is their home." },
    { id: "A2", name: "Coral Isles Shallows", kind: "skirmish", at: { x: 8, y: 44 },
      requires: ["A1"], roster: ["aqua_blub", "aqua_anglerfish", "aqua_subcool"], adds: [] },
    { id: "A3", name: "Aqua Village Docks", kind: "skirmish", at: { x: 17, y: 54 },
      requires: ["A1"], roster: ["aqua_arctik", "aqua_bootlegger", "aqua_harp", "aqua_kinguin"],
      adds: ["aqua_guin_tok"] },
    { id: "A4", name: "Corsair Lanes", kind: "warden", at: { x: 26, y: 64 },
      requires: ["A3"], roster: ["aqua_bulletshrimp", "aqua_icyninza", "aqua_krakler", "aqua_spinefin"], adds: [],
      note: "The SeaC crews. Krakler is what Siren turns into — you meet the shape before the source." },
    { id: "A5", name: "The Reef Wall", kind: "skirmish", at: { x: 9, y: 63 },
      requires: ["A2"], roster: ["aqua_coralgolem", "aqua_siphon", "aqua_tide"], adds: [],
      overflow: ["pyro_canister"], // fronts the open sea route to PYRO
      note: "The Talent node — Siphon and Tide both carry once-per-game Talents. The clearest teaching fight for them." },
    { id: "A6", name: "Mists of Despair", kind: "warden", at: { x: 28, y: 85 },
      requires: ["A5"], roster: ["aqua_octoirate", "aqua_bahari", "aqua_blackice"], adds: [],
      note: "Shipwreck boneyard, perpetual fog." },
    // Gated off A1, not A3: the floes are the next water NORTH of where ships
    // arrive, while the village is well south of them.
    { id: "A7", name: "Northern Ice Floes", kind: "skirmish", at: { x: 38, y: 18 },
      requires: ["A1"], roster: ["aqua_icynin", "aqua_owlette", "aqua_polarbear"], adds: [] },
    { id: "A8", name: "Ice Castle Outer Ward", kind: "warden", at: { x: 46, y: 26 },
      requires: ["A7"], roster: ["aqua_cryo", "aqua_anos", "aqua_liquark"], adds: [] },
    // Gated off A8, not A6: the Trench is painted on the EAST edge and the mists
    // are in the far south-west. The lane from the Ice Castle is the short one.
    { id: "A9", name: "The Steamvent Trench", kind: "warden", at: { x: 78, y: 40 },
      requires: ["A8"], roster: ["aqua_sapphire", "aqua_vaporem", "aqua_blackbeard", "aqua_icewall"], adds: [],
      note: "The spike — the whole Cost-5 band at cost 20. Ice Wall is a real wall, not a damage race." },
    { id: "A10", name: "Ice Castle: Guardians of Ice", kind: "landmark", at: { x: 60, y: 14 },
      requires: ["A8"], roster: ["aqua_polarking", "aqua_phrost", "aqua_glacius"], adds: [],
      note: "A pure FREEZE wall, and the only node touching the Arctic Gate — DAWN's border, sealed until Act V." },
    { id: "A11", name: "Atlantis Outer Ring", kind: "landmark", at: { x: 65, y: 55 },
      requires: ["A6", "A9"], roster: ["aqua_siren", "aqua_rain", "aqua_driftwraith", "aqua_magalogoon"], adds: [],
      note: "Four Legendaries — the richest node in the first three acts. Both arms of the sea have to be yours first." },
    { id: "A13", name: "Atlantis: Heart of the Ocean", kind: "throne", at: { x: 50, y: 45 },
      requires: ["A11"], roster: ["aqua_hydrogon"],
      // Escorts: the reef that guards the city, farmable at A5.
      adds: ["aqua_coralgolem", "aqua_tide"], required: true,
      note: "Required. Clearing it opens the sea lanes, which is what makes the rest of the campaign non-linear." },
    { id: "A12", name: "The Deep", kind: "throne", at: { x: 54, y: 88 },
      requires: ["A13"], roster: ["aqua_kraken"],
      // Escorts: the deep's own, farmable at A4.
      adds: ["aqua_krakler", "aqua_spinefin"],
      note: "Optional, and the hardest fight in Act II — deliberately harder than either required Throne." },
    // Gate E: the Gray Continent ports. Gated on BOTH Green Thrones rather than
    // AQUA's alone — §2 makes PYRO and AQUA mandatory before Act IV so the
    // player reaches the 5x5 board with a three-element pool.
    { id: "GE", name: "Gate E: Gray Continent Ports", kind: "gate", at: { x: 88, y: 20 },
      requires: ["A13", "P13"], roster: [], opens: ["gale", "bolt", "bore"],
      adds: ["aqua_arctik", "aqua_harp", "gale_sirocco", "gale_megair", "gale_gastly", "gale_skyforce"],
      demand: { kind: "attack", value: "Ranged", count: 4 },
      note: "The airship lanes north. Everything past here is fought on the 5x5 board." },
    // Gate C, AQUA side — the same harbor from the other direction.
    { id: "GC2", name: "Gate C: Sunfall Harbor", kind: "gate", at: { x: 10, y: 72 },
      requires: ["A5"], roster: [], opens: ["pyro"],
      adds: ["aqua_buccaneers", "aqua_bootlegger", "pyro_flamehound", "pyro_canister", "pyro_firecrack", "pyro_taper"],
      demand: { kind: "class", value: "Tank", count: 3 },
      note: "The same harbor from the water. Sail east and PYRO's coast is yours without going back through LEAF." },
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
  board: 5,
  art: "/maps/gale.webp",
  artRatio: 1536 / 1024,
  requires: ["GE"],
  // The Blighted Plains: the art paints DUSK's violet across the whole southern
  // margin, and names it "Spawn of the Storm".
  blightAt: { x: 46, y: 85 },
  nodes: [
    { id: "G1", name: "Windward Steps", kind: "skirmish", at: { x: 14, y: 33 },
      requires: [], roster: ["gale_gastly", "gale_megair", "gale_sirocco"], adds: [],
      note: "Where the airships put down. The sea road back to AQUA is west." },
    { id: "G2", name: "Amberleaf Groves", kind: "skirmish", at: { x: 26, y: 46 },
      requires: ["G1"], roster: ["gale_skyforce", "gale_swillow", "gale_syt_bird"], adds: [],
      note: "Orangewood bent flat by the wind." },
    { id: "G3", name: "The Rolling Flats", kind: "skirmish", at: { x: 40, y: 56 },
      requires: ["G2"], roster: ["gale_breeze", "gale_duster", "gale_tumbleweed"], adds: [] },
    { id: "G5", name: "Dark Wind Township", kind: "skirmish", at: { x: 17, y: 79 },
      requires: ["G2"], roster: ["gale_luna", "gale_wailverine", "gale_windsor"], adds: [],
      note: "Under perpetual cloud. The Wolves start here — Luna is the first of the pack." },
    { id: "G4", name: "The Raptor Roosts", kind: "skirmish", at: { x: 89, y: 79 },
      requires: ["G3"], roster: ["gale_toxhawk", "gale_hawk", "gale_hawko"], adds: ["gale_toxhawk_tok"],
      note: "Cliffside aeries. Fight the birds here before you meet what raises them." },
    { id: "G6", name: "Northern Wind Villages", kind: "warden", at: { x: 38, y: 22 },
      requires: ["G3"], roster: ["gale_vvulture", "gale_stormhide_bison", "gale_whirlwolf"], adds: [] },
    { id: "G8", name: "Gale Village", kind: "warden", at: { x: 58, y: 35 },
      requires: ["G3"], roster: ["gale_klouy", "gale_vaga", "gale_fano"], adds: [],
      note: "The hardy people of the Orange Plains, and the wandering twisters they live with." },
    { id: "G7", name: "Skyforge Aerie", kind: "warden", at: { x: 91, y: 62 },
      requires: ["G4"], roster: ["gale_angale", "gale_buf", "gale_sway"], adds: ["gale_ollie"],
      note: "Sway's Birds of Prey spawns Ollie, so the filler here is diegetic rather than padding." },
    { id: "G9", name: "The Shrike Line", kind: "warden", at: { x: 72, y: 58 },
      requires: ["G7", "G8"], roster: ["gale_guan", "gale_masala", "gale_rayfen"],
      adds: ["gale_toxhawk_tok"],
      note: "Mesala's Raptor Assault raises the same bird you fought at the Roosts." },
    { id: "G10", name: "Stormwall Approach", kind: "warden", at: { x: 73, y: 27 },
      requires: ["G6"], roster: ["gale_omega", "gale_wista", "gale_wolfbane"], adds: [],
      note: "Omega and Luna were written as a pair — this is where the pack closes." },
    { id: "G11", name: "Stormwatch Cliffs: The Totem", kind: "landmark", at: { x: 84, y: 52 },
      requires: ["G9", "G10"], roster: ["gale_eagon", "gale_tempest", "gale_totem"],
      adds: ["gale_totem_pole"],
      note: "The wind elemental shrine. The only node in the game whose filler is a Legendary-rarity token." },
    { id: "G12", name: "The Eye of the Storm", kind: "landmark", at: { x: 60, y: 80 },
      requires: ["G5", "G9"],
      roster: ["gale_bluejay", "gale_galeon", "gale_klipso", "gale_kloud"], adds: [],
      note: "The whole Cost-7 Legendary band on one node — the richest recruit in Act IV." },
    { id: "G13", name: "Wolfrun Hollow", kind: "throne", at: { x: 62, y: 10 },
      requires: ["G10"], roster: ["gale_stormfang"],
      // Escorts: the pack itself, farmable at G6 and G5.
      adds: ["gale_whirlwolf", "gale_luna"],
      note: "StormFang's Throne. Optional — the Wolf payoff, and its Pack aura reaches four cards you already met." },
    { id: "G14", name: "Tempest Peaks", kind: "throne", at: { x: 93, y: 26 },
      requires: ["G11", "G12"], roster: ["gale_griffith"],
      // Escorts: the birds of the Roosts, farmable at G4 and G2.
      adds: ["gale_ollie", "gale_hawk", "gale_skyforce"], required: true,
      note: "Thunder Reach. Required — clearing it opens the airship routes on to BOLT and BORE." },
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
  board: 5,
  art: "/maps/bolt.webp",
  artRatio: 1440 / 1080,
  requires: ["GE"],
  // The Blighted Margin: the art names it the southern industrial blight zone
  // and even prints a contamination key for it.
  blightAt: { x: 36, y: 90 },
  nodes: [
    { id: "B1", name: "Scrapyard Verge", kind: "skirmish", at: { x: 16, y: 30 },
      requires: [], roster: ["bolt_junker", "bolt_zap", "bolt_twotales"], adds: [],
      note: "Where the sea road from AQUA meets the sprawl." },
    { id: "B2", name: "Drone Field", kind: "skirmish", at: { x: 27, y: 46 },
      requires: ["B1"], roster: ["bolt_rodd", "bolt_stingray", "bolt_zipp"], adds: ["bolt_drone_tok"],
      note: "Neon sprawl and strung cables. Zipp's Swarm Deploy makes the Drones." },
    { id: "B3", name: "Substation Row", kind: "skirmish", at: { x: 34, y: 33 },
      requires: ["B1"], roster: ["bolt_drshock", "bolt_electricel", "bolt_jolt"], adds: [] },
    { id: "B4", name: "The Static Flats", kind: "skirmish", at: { x: 28, y: 12 },
      requires: ["B3"], roster: ["bolt_ning", "bolt_scrapper", "bolt_staticcloud"],
      adds: ["bolt_static_wisp_tok"],
      note: "Fused glass and a lightning-scarred gateway. The north road to GALE runs through here." },
    { id: "B5", name: "Conduit Marsh", kind: "skirmish", at: { x: 26, y: 63 },
      requires: ["B2"], roster: ["bolt_buzz", "bolt_buzzard", "bolt_jellyfish"], adds: ["bolt_drone_tok"],
      note: "The same Drone from a second source — Buzzard's Drone Sweep." },
    { id: "B6", name: "Breaker Yard", kind: "warden", at: { x: 41, y: 41 },
      requires: ["B3"], roster: ["bolt_lytning", "bolt_storm", "bolt_zagphu"], adds: [] },
    { id: "B8", name: "Overload Junction", kind: "warden", at: { x: 63, y: 45 },
      requires: ["B6"], roster: ["bolt_shoksa", "bolt_striik", "bolt_thundercat"], adds: [] },
    { id: "B7", name: "Arc Industries Yards", kind: "warden", at: { x: 89, y: 55 },
      requires: ["B8"], roster: ["bolt_static", "bolt_webster", "bolt_sentry"], adds: [],
      note: "Cooling towers and conduit pylons. The ARC spine starts here — every one of them Epic or above." },
    { id: "B9", name: "The Forge Grid", kind: "warden", at: { x: 79, y: 41 },
      requires: ["B7"], roster: ["bolt_surge", "bolt_voltcher", "bolt_kore"],
      adds: ["bolt_static_wisp_tok"] },
    { id: "B10", name: "Forsaken Heights", kind: "warden", at: { x: 88, y: 21 },
      requires: ["B9"], roster: ["bolt_general", "bolt_thunder", "bolt_volta"], adds: [],
      note: "Iron lightning-rods drawing the storm. Volta's Grid Deployment spawns Rodd — a card you already own from the Drone Field." },
    { id: "B11", name: "The Hive Array", kind: "landmark", at: { x: 72, y: 67 },
      requires: ["B5", "B9"], roster: ["bolt_jack_arc", "bolt_keeper", "bolt_shock", "bolt_zoez"],
      adds: ["bolt_beebot"],
      note: "GearHollow's swarm. Keeper breeds a Beebot every round to a cap of 5 — solve the engine, not the board." },
    { id: "B12", name: "Stormcaller's Spire", kind: "landmark", at: { x: 66, y: 18 },
      requires: ["B4", "B10"], roster: ["bolt_gigavolt", "bolt_stormcaller", "bolt_voltogon"],
      adds: ["bolt_static_wisp_tok"],
      note: "By the airship docks. GigaVolt's Turret Mode pins the board with ELECTRIFIED, which turns every other BOLT card into a +2 threat." },
    { id: "B13", name: "The Grid Vault", kind: "throne", at: { x: 43, y: 83 },
      requires: ["B11"], roster: ["bolt_velvolt_knight"],
      // Escorts: the Drone Field's own, farmable at B2.
      adds: ["bolt_drone_tok", "bolt_zipp", "bolt_rodd"],
      note: "Sealed below the core behind blast doors. Optional." },
    { id: "B14", name: "City Power Core", kind: "throne", at: { x: 50, y: 31 },
      requires: ["B11", "B12"], roster: ["bolt_elecdroid"],
      // Escorts: the scrapyard where the region started, farmable at B1.
      adds: ["bolt_beebot", "bolt_zap", "bolt_junker"], required: true,
      note: "The Arc Lightning Conduit itself. Required — clearing it opens the mountain pass to BORE." },
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
  board: 5,
  art: "/maps/bore.webp",
  artRatio: 1440 / 1080,
  requires: ["GE"],
  // The corruption band the art paints across the bottom, beside the locked
  // Shadow Border. It even ships a legend: light / moderate / severe.
  blightAt: { x: 24, y: 88 },
  nodes: [
    { id: "R1", name: "Quarry Mouth", kind: "skirmish", at: { x: 22, y: 16 },
      requires: [], roster: ["bore_cavedweller", "bore_iron", "bore_kcor"], adds: [],
      note: "The Reveen Foothills, where the mountain pass down from BOLT lets out." },
    { id: "R2", name: "Rubble Road", kind: "skirmish", at: { x: 36, y: 22 },
      requires: ["R1"], roster: ["bore_cosmic", "bore_crock", "bore_hillbilly"], adds: [] },
    { id: "R3", name: "The Smithy Camp", kind: "skirmish", at: { x: 23, y: 47 },
      requires: ["R1"], roster: ["bore_clubber", "bore_rockgoblin", "bore_smith"], adds: [],
      note: "Open forges — home of the legendary crafters." },
    { id: "R4", name: "Sand Village", kind: "skirmish", at: { x: 23, y: 80 },
      requires: ["R3"], roster: ["bore_old_timer", "bore_sling", "bore_thorny_ripper"], adds: [],
      note: "Desert dwellers under cloth awnings. We trade, travel, survive." },
    { id: "R5", name: "Mountain Beast Range", kind: "skirmish", at: { x: 52, y: 20 },
      requires: ["R2"], roster: ["bore_ankylosaur", "bore_armadillo", "bore_warthog"], adds: [],
      note: "The armour school — three Tanks, two of them Granite. A deck that cannot break shields stops here, early enough to be a lesson rather than a wall." },
    { id: "R6", name: "The Standing Stones", kind: "skirmish", at: { x: 65, y: 34 },
      requires: ["R5"], roster: ["bore_rock", "bore_stone", "bore_ufo"], adds: [],
      note: "Out toward the sand worm's dunes. UFO is 2 HP behind 5 shields that irradiates the whole board — the damage is trivial, getting to it is the fight." },
    { id: "R7", name: "Faultline", kind: "warden", at: { x: 30, y: 38 },
      requires: ["R5"], roster: ["bore_shift", "bore_valcana", "bore_rhe"],
      adds: ["bore_cosmic", "bore_crock"] },
    { id: "R8", name: "Crystal Seam", kind: "warden", at: { x: 9, y: 38 },
      requires: ["R3"], roster: ["bore_krysteel", "bore_lithara", "bore_monger"],
      adds: ["bore_smith", "bore_clubber"],
      note: "Giant mystical crystals, light spilling out of the rock." },
    { id: "R9", name: "The Rolling Deep", kind: "warden", at: { x: 52, y: 45 },
      requires: ["R7"], roster: ["bore_rollo", "bore_sheish", "bore_bolder"],
      adds: ["bore_iron", "bore_kcor"] },
    { id: "R10", name: "Cavernous Descent", kind: "warden", at: { x: 35, y: 65 },
      requires: ["R4", "R9"], roster: ["bore_gemaga", "bore_obsidi", "bore_rohojohn"],
      adds: ["bore_hillbilly", "bore_cavedweller"],
      note: "Beneath the mountain, secrets breathe." },
    { id: "R11", name: "The Gem Vault", kind: "landmark", at: { x: 44, y: 55 },
      requires: ["R8", "R9"], roster: ["bore_diam", "bore_prism", "bore_sandman", "bore_score"],
      adds: [],
      note: "The lantern-lit descent of the Diamond Mine. The utility tier, all four on one node." },
    { id: "R12", name: "The Unbroken Wall", kind: "landmark", at: { x: 79, y: 58 },
      requires: ["R6", "R10"], roster: ["bore_bastion", "bore_bearocks", "bore_steel"], adds: [],
      note: "Bore Fortress — stone guardians. The campaign's hardest Landmark to out-damage rather than out-think, and Steel is immune to every status and DOT in the game. Bring PEN or bring a plan." },
    { id: "R13", name: "Corebore Shaft", kind: "throne", at: { x: 66, y: 76 },
      requires: ["R12"], roster: ["bore_the_coreborer"],
      // Escorts: the quarry crew, farmable at R1.
      adds: ["bore_cavedweller", "bore_iron"],
      note: "Optional." },
    { id: "R14", name: "The DEEPEST Dark", kind: "throne", at: { x: 49, y: 84 },
      requires: ["R11", "R12"], roster: ["bore_deepest"],
      // Escorts: the standing stones, farmable at R6.
      adds: ["bore_stone", "bore_rock"], required: true,
      note: "Below all other levels — an endless black drop. Required. The Shadow Border west stays sealed until Act V." },
  ],
};

export const REGIONS: StoryRegion[] = [LEAF, PYRO, AQUA, GALE, BOLT, BORE];

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
// Fixed and non-optional, handed over at Spring Village. All six classes, a
// bottom-heavy curve, and every card is a draftable Rare the player will meet
// again on a LEAF node — nothing in it is a dead end.

export const STARTER_DECK: string[] = [
  "leaf_oak", "leaf_python",           // Tank
  "leaf_birch", "leaf_cactus",         // Warrior
  "leaf_stickers", "leaf_sticks",      // Assassin
  "leaf_nettle", "leaf_leaf",          // Mage
  "leaf_stickviper", "leaf_hunter",    // Ranger
  "leaf_weeds", "leaf_walking_tree",   // Support
];

// ── deck cap ladder ─────────────────────────────────────────────────────────
// Every cap below a format's maximum is a CAMPAIGN restriction, not a rule
// change: 18 on 4x4 and 28 on 5x5 are legal everywhere else in the game. Story
// Mode is gating access to full-size list building, nothing more.

export const CAP_LADDER = [
  { cap: 12, board: 4, unlockedBy: null, label: "Starting deck" },
  { cap: 15, board: 4, unlockedBy: "L14", label: "LEAF Throne" },
  { cap: 18, board: 4, unlockedBy: "P13", label: "PYRO Throne" }, // 4x4 format max
  { cap: 18, board: 4, unlockedBy: "A13", label: "AQUA Throne" }, // either Act II Throne
  // Act IV wants BOTH Green Thrones, not either: §2's revision makes PYRO and
  // AQUA mandatory so a player arrives on the 5x5 board with three elements
  // rather than two. An array means ALL of them.
  { cap: 22, board: 5, unlockedBy: ["P13", "A13"], label: "Both Green Thrones" },
] as const;

export function deckCapFor(cleared: readonly string[]): number {
  let cap: number = CAP_LADDER[0].cap;
  for (const step of CAP_LADDER) {
    if (!step.unlockedBy) continue;
    const needed: readonly string[] =
      typeof step.unlockedBy === "string" ? [step.unlockedBy] : step.unlockedBy;
    if (needed.every((id) => cleared.includes(id))) cap = Math.max(cap, step.cap);
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

/** Legal deck sizes per board, mirroring `custom-decks.ts` DECK_LIMITS. Kept
 *  here so the campaign layer can reason about format without importing the
 *  deck-builder. */
const BOARD_DECK_RANGE: Record<number, [number, number]> = { 4: [12, 20], 5: [20, 30] };

/** Which boards a deck of this size may legally be played on.
 *
 *  This is the constraint that governs whether a region can vary its board by
 *  node. The ranges overlap at EXACTLY 20 cards, and the cap ladder
 *  (12/15/18/22/28) never lands there — so at every current tier a deck is legal
 *  on precisely one board, and "small nodes 4x4, big nodes 5x5" would mean
 *  playing off-format in one direction or the other. Setting an Act's cap to 20
 *  is the only way to unlock a mixed-board Act. */
export function boardsLegalFor(deckCap: number): number[] {
  return Object.entries(BOARD_DECK_RANGE)
    .filter(([, [lo, hi]]) => deckCap >= lo && deckCap <= hi)
    .map(([b]) => Number(b));
}

/** The board a node is fought on. */
export const boardForNode = (region: StoryRegion, node: StoryNode): number =>
  node.board ?? region.board;

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
  const cap = deckCapFor(save.cleared);
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

/** Copies of one card allowed, scaled by the player's tier. */
export function copyCapFor(defId: string, deckCap: number): number {
  const rarity = getDef(defId).rarity ?? "";
  if (rarity === "epic") return deckCap >= EPIC_DUPLICATE_FROM_CAP ? DUPLICATE_CAP.epic : 1;
  return DUPLICATE_CAP[rarity] ?? DUPLICATE_CAP_DEFAULT;
}
export const DUPLICATE_CAP_DEFAULT = 1;

/** Bodies a formation aims for, by the player's current deck tier (deployed +
 *  reserve from §10.7's table). */
export function formationSize(cap: number): number {
  if (cap >= 28) return 15; // Act V     — 6 deployed + 8-9 reserve
  if (cap >= 22) return 12; // Act IV    — 5 + 6-7
  if (cap >= 15) return 9;  // Act II-III — 4 + 4-5
  return 7;                 // Act I     — 4 + 2-3
}

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
/** Opening deployment slots (§10.6), deliberately small: one free teammate each
 *  and then a traditional game. A full opening board front-loaded the match and
 *  skipped the ramp entirely; one card just removes the dead first turn.
 *  Asymmetry stays as the BOSS lever — a Throne leading with two against your
 *  one reads as a boss, where the same thing on every Skirmish would read as a
 *  broken game. */
export const PLAYER_DEPLOY = 1;
export function enemyDeployFor(node: StoryNode): number {
  return node.kind === "throne" ? 2 : PLAYER_DEPLOY;
}

export function buildFormation(save: StorySave, region: StoryRegion, node: StoryNode): string[] {
  const uniques = recruitablePool(node);
  // Filler is non-recruitable by construction — tokens can't be decked and
  // Blight adds only drop from a Blight Node.
  const out = [...uniques, ...node.adds, ...blightAddsFor(save, region, node)];

  const copies = new Map<string, number>();
  for (const id of out) copies.set(id, (copies.get(id) ?? 0) + 1);

  const cap = deckCapFor(save.cleared);
  const target = formationSize(cap);
  // Drawn from everything already standing — including the tokens and border
  // patrol in `adds`. A Throne's roster is a lone Mythic and a Gate has no
  // roster at all, so a pool of just `uniques` would leave both unable to fill
  // past a body or two.
  const byCost = (a: string, b: string) => getDef(a).cost - getDef(b).cost;
  const present = [...new Set([...uniques, ...node.adds])];
  // Rares carry the fill at every tier. Epics only join it once the campaign has
  // scaled past its introduction — a second copy of an Epic is a second copy of
  // a real Special every round.
  const rares = present.filter((id) => getDef(id).rarity === "rare").sort(byCost);
  const epics = cap >= EPIC_DUPLICATE_FROM_CAP
    ? present.filter((id) => getDef(id).rarity === "epic").sort(byCost)
    : [];

  // Round-robin inside each tier, so nothing reaches three copies while another
  // card of the same tier is still on one. Rares are exhausted before an Epic is
  // ever doubled.
  for (const tier of [rares, epics]) {
    for (let guard = 0; guard < 8 && out.length < target; guard++) {
      let placed = false;
      for (const id of tier) {
        if (out.length >= target) break;
        if ((copies.get(id) ?? 0) >= copyCapFor(id, cap)) continue;
        out.push(id);
        copies.set(id, (copies.get(id) ?? 0) + 1);
        placed = true;
      }
      if (!placed) break; // every card in this tier is capped
    }
  }
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
  /** The player's current story deck. */
  deck: string[];
  /** Region id -> Blight earned from world progress. The region's own baseline
   *  is applied on read, so it can never be saved away. */
  blight: Record<string, number>;
}

const STORAGE_KEY = "we_story_v1";

export function newSave(): StorySave {
  return { cleared: [], collection: [...STARTER_DECK], pity: {}, deck: [...STARTER_DECK], blight: {} };
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
    };
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
  return n.requires.every((r) => save.cleared.includes(r));
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
  if (!eligible.length) return { won, missed, rolls };

  // A Throne's Mythic is a guaranteed recruit on first clear: no RNG on a
  // story-critical unlock.
  if (node.kind === "throne" && !isCleared(save, node.id)) {
    return { won: [...eligible], missed, rolls };
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
  return { won, missed, rolls };
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
  return advanceBlight(pushBackBlight(next, node), node);
}

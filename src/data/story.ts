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
import { SPELLS, getSpell, legalSpellIds, spellCapForBoard } from "../engine/spells";
import { DOMINATION_7X7 } from "./domination";
import { DECK_TIERS } from "./custom-decks";
import type { GauntletState } from "./gauntlet";
import type { LadderState } from "./matchmaker";

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
  /** The tribe this node fights AS — "Ghost", "Spider", "ARC" — driving both
   *  the fight's filler (`buildFormation` pads with same-tribe cards before the
   *  region's generic rank and file) and how the node reads.
   *
   *  Explicit rather than always derived, because the roster is only the
   *  recruitable seed: a three-card Ghost roster in a fifteen-card fight says
   *  almost nothing about what actually stands on the board. Absent = derive
   *  from the roster's dominant tribe (2+ cards sharing one), so untagged and
   *  future nodes still benefit; `null` would mean "explicitly none" if a node
   *  ever needs to opt out. */
  tribe?: string;
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
  /** THE REGION MUSTERS. Every node you have already beaten here reinforces the
   *  ones above it: their rosters join the filler pool for later fights, heaviest
   *  card first, ahead of the region's ordinary rank and file.
   *
   *  Without it, filler is `regionPool` — the region's CHEAPEST cards of each
   *  rarity, drawn the same whether you are on the first node or the last. That
   *  is a flat curve dressed as a climb: the roster changes but the padding
   *  behind it never does.
   *
   *  With it, the pool grows as you clear and the fights at the top field what
   *  you already put down. It self-scales — an early node has cleared almost
   *  nothing and is untouched — so the difficulty compounds where the region is
   *  supposed to be hardest rather than needing a hand-tuned curve.
   *
   *  DAWN and DUSK only, the two late regions, where the fiction is a kingdom
   *  and a host closing ranks behind you.
   *
   *  WHAT IT ACTUALLY MOVES, measured at cap 30 as total formation cost, fresh
   *  vs the region cleared behind you:
   *
   *      DUSK  skirmish 61->71  warden 65->75  landmark 99->111  throne 102->123
   *      DAWN  skirmish 57->57  warden 66->66  landmark 86->104  throne 104->112
   *
   *  DAWN's ordinary nodes do not move, and that is the mechanism showing
   *  through rather than a bug: a preference can only bite where the fill has a
   *  CHOICE, and DAWN's rare pool is small enough that a 30-card formation
   *  already takes all of it twice. Reordering an exhausted pool moves nothing.
   *  DUSK prints more cards, so it strengthens at every tier. Both hold the
   *  property that matters — never weaker anywhere, strictly heavier at the set
   *  pieces, which are the upper levels this was asked for. */
  musters?: boolean;
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
      requires: [], tribe: "Grove", roster: ["leaf_nettle", "leaf_weeds", "leaf_greegon"], adds: [],
      note: "The tutorial. Greegon is a REGEN tank you cannot out-race — capture the slot.",
      lore: "Nobody planted the verge. Nettle and weed took it themselves, and the village long ago stopped pulling them: an edge that grows back on its own is cheaper than a wall that does not."
    },
    { id: "L2", name: "Cherry Grove Path", kind: "skirmish", at: { x: 19, y: 24 },
      requires: ["L1"], tribe: "Grove", roster: ["leaf_sakuroot", "leaf_sprinu", "leaf_leaf"], adds: [],
      lore: "The blossom lasts nine days and the Spring Tribe dates its promises by it. Vernal and Frond hold the path for all nine and then let it fall — a grove is not defended by refusing to lose it."
     },
    { id: "L3", name: "Bloomwardens' Ring", kind: "warden", at: { x: 32, y: 40 },
      requires: ["L2"], tribe: "Grove", roster: ["leaf_stickers", "leaf_dartfrog", "leaf_bark_bushmen"], adds: ["leaf_acorn_tok"],
      note: "No Reptiles here — just what lives in the blooms. The dart frog is not decoration.",
      lore: "A Bloomwarden is not appointed. The candidate stands inside the ring until it blooms around them, and Stickers and the Bark Bushmen stand there for however long that takes."
     },
    { id: "L4", name: "Evergreen Plains", kind: "skirmish", at: { x: 25, y: 62 },
      requires: ["L1"], tribe: "Grove", roster: ["leaf_oak", "leaf_python", "leaf_sticks", "leaf_walking_tree"], adds: [],
      note: "Unclaimed by any season, so everything grazes here — including the python.",
      lore: "Green in every month, so no season could ever claim it. The four tribes gave up dividing the plains and left Oak and Elephlora to hold the one stretch of forest that never changes hands."
     },
    { id: "L5", name: "Summer's Embrace Grove", kind: "warden", at: { x: 40, y: 74 },
      requires: ["L4"], tribe: "Grove", roster: ["leaf_sumerose", "leaf_dande", "leaf_splint"], adds: ["leaf_acorn_tok"] ,
      note: "Summer at full strength. Estival left the Wilds to sun herself here — she is still an assassin.",
      lore: "Guardians of Growth, where the forest stands at its fullest. Summer is in no hurry — Dandelion has outlasted every boot that crossed this grove, and Estival simply waits in the warm."
    },
    { id: "L6", name: "Jungle Wilds", kind: "warden", tribe: "Reptile", at: { x: 83, y: 60 },
      requires: ["L5"], roster: ["leaf_stickviper", "leaf_gecko", "leaf_cactus", "leaf_snapmaw"], adds: ["leaf_reptilian_tok"],
      note: "The Reptile node — StickViper and Gecko are the tribe. Fight it before the warlord who buffs it.",
      lore: "Reptiles, not Keepers. The four tribes counted the Wilds as forest rather than as a fifth people: a decision made early, never put to the brood, and Snapmaw has never once accepted it."
     },
    // Gated off L10, not L2: the art puts Rustling Woods at Autumn's Gold in the
    // far north-east, so the approach is along the northern treeline.
    { id: "L7", name: "Rustling Woods", kind: "skirmish", at: { x: 78, y: 38 },
      requires: ["L10"], tribe: "Grove", roster: ["leaf_hunter", "leaf_alpha", "leaf_fallona"], adds: ["leaf_oak", "leaf_sticks"],
      overflow: ["aqua_misty"], // fronts Eastleaf Port — the Gateway to Aqua
      note: "Autumn's Gold, and the pack that hunts it. Eastleaf Port and the sea road to AQUA lie just east.",
      lore: "Autumn's Gold, where the leaves turn fire-coloured and then to the rot that feeds the spring. The pack tends the ending — Alpha hunts the slow, and the woods are quieter for it."
    },
    // Gated off L5, not L7: the Rot Line is painted across the SOUTHERN treeline,
    // a step past Summer's Embrace — nowhere near the northern woods.
    { id: "L8", name: "The Rot Line", kind: "warden", at: { x: 41, y: 84 },
      requires: ["L5"], tribe: "Grove", roster: ["leaf_nightshade", "leaf_rubyo", "leaf_darth"], adds: ["leaf_oak", "leaf_birch"],
      overflow: ["pyro_staph"], // fronts the Southern Burn — the open road to PYRO
      note: "The scar DUSK left, and what nests in it now. Where a starter deck stops working.",
      lore: "Every other ending in the Mega Forest feeds a beginning. This one feeds Nightshade. No Keeper will say aloud how much further south the Cycle still holds."
     },
    { id: "L9", name: "Winter's Reach Treeline", kind: "skirmish", at: { x: 40, y: 21 },
      requires: ["L2"], tribe: "Grove", roster: ["leaf_whintey", "leaf_lumberjack", "leaf_birch"], adds: ["leaf_oak", "leaf_sticks"] ,
      lore: "The one border DAWN keeps in the open: the Sun's Army rides in daylight while Hibernal and Birch watch the same snow from the treeline. Neither side has ever needed to explain itself."
    },
    { id: "L10", name: "Winter Village Sentinels", kind: "warden", at: { x: 58, y: 23 },
      requires: ["L9"], tribe: "Grove", roster: ["leaf_citra", "leaf_guardian", "leaf_squanch"], adds: ["leaf_oak", "leaf_sticks"],
      note: "Under the Arctic Veil. The ice wall north is DAWN's border — sealed all campaign.",
      lore: "Sentinels of Rest — not dormant, on duty. Winter holds that a forest which never stops to sleep forgets how to grow, and Squanch has stood the village gate through four of them."
    },
    { id: "L11", name: "Heart of Nature: Outer Roots", kind: "landmark", at: { x: 40, y: 60 },
      requires: ["L3", "L8"], tribe: "Grove", roster: ["leaf_forestdeer", "leaf_monkey", "leaf_gorilla", "leaf_season", "leaf_thorn", "leaf_elderroot"], adds: [],
      note: "Elderroot is the game's only melee Support.",
      lore: "The weathered stones around the Tree are not markers but graves. The first Keepers of every tribe chose the roots over their own season's ground, and Elderroot has not left them since."
    },
    { id: "L12", name: "Heart of Nature: The Spirit Tree", kind: "landmark", at: { x: 56, y: 56 },
      requires: ["L11"], tribe: "Grove", roster: ["leaf_wintermoose", "leaf_grizzly", "leaf_warden", "leaf_efy", "leaf_fallow"], adds: [] ,
      lore: "Elders whisper that the roots reach further down than any Keeper has followed — to something already here when the first tribe arrived. Hartwood does not whisper it, and does not deny it."
    },
    { id: "L13", name: "Jungle Throne", kind: "throne", at: { x: 67, y: 81 },
      requires: ["L6", "L12"], tribe: "Reptile", roster: ["leaf_trinezer"],
      // Escorts: the Reptile tribe it commands, already farmable at L6.
      adds: ["leaf_reptilian_tok", "leaf_stickviper", "leaf_gecko", "leaf_alpha"],
      note: "Deep Grove. Optional — an early skill check with a Mythic reward.",
      lore: "Unchecked growth is only rot arriving later; every Keeper says so, and not one of the four tribes volunteered for the pruning. The Deep Grove did, and it sent Trinezer to do it."
     },
    { id: "L14", name: "The Spirit Tree Rises", kind: "throne", at: { x: 48, y: 45 },
      requires: ["L12"], tribe: "Grove", roster: ["leaf_oakgre"],
      // Escorts: the old growth around it, farmable at L4 and L2.
      adds: ["leaf_acorn_tok", "leaf_oak", "leaf_birch", "leaf_bark_bushmen"], required: true,
      note: "Required. Clearing it opens the borders to PYRO and AQUA.",
      lore: "LEAF has no king, and the reason is not modesty: the forest decides for itself. A Keeper's whole training is noticing the moment it has — and when Oakgre pulls up its roots, it has."
     },
    // Gates. Rosters live in `adds` because a gate is a checkpoint, not a farm —
    // its squad is a mixed border patrol of BOTH elements, and putting real
    // cards in a recruitable roster would place them a second time.
    { id: "GA", name: "Gate A: Summer's Southern Burn", kind: "gate", at: { x: 63, y: 94 },
      requires: ["L14"], tribe: "Reptile", roster: [], opens: ["pyro"],
      adds: ["leaf_gecko", "leaf_dartfrog", "pyro_staph", "pyro_sparky", "pyro_florence", "pyro_ingit", "leaf_alpha", "pyro_firebird", "leaf_stickviper"],
      demand: { kind: "attack", value: "Ranged", count: 3 },
      note: "The open road south. The burn punishes anything that has to close distance.",
      lore: "The forest simply stops here, in a line nobody drew. LEAF calls it the Southern Burn and PYRO the northern treeline, and the patrol that walks it has Gecko on one flank and FireBird on the other."
     },
    { id: "GB", name: "Gate B: Eastleaf Port", kind: "gate", at: { x: 93, y: 30 },
      requires: ["L14"], tribe: "Grove", roster: [], opens: ["aqua"],
      adds: ["leaf_hunter", "leaf_walking_tree", "aqua_misty", "aqua_buccaneers", "aqua_piranha", "aqua_blub", "leaf_bark_bushmen", "aqua_bahari"],
      demand: { kind: "class", value: "Support", count: 2 },
      note: "The sea road east. A long crossing — bring something that can keep a crew alive.",
      lore: "Eastleaf keeps no harbourmaster. A ship is met by whichever Autumn family is nearest the water — lately Hunter, and whatever came up the channel behind it with Misty."
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
      requires: [], tribe: "Goblin", roster: ["pyro_staph", "pyro_sparky", "pyro_florence"], adds: ["pyro_firecrack"],
      note: "Where the forest dies. The road back to LEAF is right behind you.",
      lore: "Where other nations fear the volcano, PYRO built a city that agrees with it. The approach is not guarded so much as advertised — Staph and Sparky are what the city sends out to say hello."
    },
    { id: "P3", name: "Cinder Road", kind: "skirmish", at: { x: 61, y: 27 },
      requires: ["P1"], tribe: "Forged Tech", roster: ["pyro_ingit", "pyro_bbq", "pyro_taper", "pyro_heatsink_golem"], adds: ["pyro_canister"],
      note: "Nobody built this fight either — loose embers off the road. Cheap, and they add up if you dawdle.",
      lore: "No one laid the Cinder Road: ash banked against ash until there was a road, and PYRO counts that as having built it. Ingit and the Heatsink Golem keep it warm; the embers do the rest."
     },
    { id: "P4", name: "Dessaer District: Forge of Fire", kind: "skirmish", tribe: "Forged Tech", at: { x: 30, y: 31 },
      requires: ["P1"], roster: ["pyro_baboom", "pyro_spitfire", "pyro_flamehound", "pyro_canister"], adds: [],
      note: "Forged Tech works. Fight the tribe here before you meet its Mythic at the Forge Core.",
      lore: "The Forged are makers before they are soldiers, and the district fights the way it works. BaBoom and Canister go off exactly as designed, and Spitfire is already assembling the next one."
    },
    { id: "P5", name: "The Slagfields", kind: "skirmish", at: { x: 84, y: 31 },
      requires: ["P3"], tribe: "Volcanic", roster: ["pyro_ash_boar", "pyro_slag_tortoise", "pyro_ember_scorpion", "pyro_smog_card"], adds: [],
      note: "Cooled lava badlands. Four Rares and no champion — the heaviest Skirmish in the region.",
      lore: "Older than the forges that would have filled it — this is lava the mountain put down and never came back to collect. The Slag Tortoise has not moved since, and sees no reason to start."
     },
    { id: "P6", name: "Pyro City Gates", kind: "warden", at: { x: 46, y: 55 },
      requires: ["P3"], tribe: "Forged Tech", roster: ["pyro_liza", "pyro_sarra", "pyro_firefly"], adds: ["pyro_baboom", "pyro_spitfire"],
      note: "The gates never close, so the watch does the closing. Utility Epics — answer them or play around them all day.",
      lore: "The gates have hinges that have never been used: closing one would concede there is something out there worth closing against. Liza and Sarra do the closing instead, and do it faster."
     },
    { id: "P9", name: "Firespine Foothills", kind: "warden", tribe: "Wolf", at: { x: 16, y: 34 },
      requires: ["P4"], roster: ["pyro_woof", "pyro_firebird", "pyro_fenrir"], adds: [],
      note: "Wolf country. The pack hunts as one — drop the howler before the flanks close.",
      lore: "Above the last forge the slopes belong to whatever climbed there first. PYRO calls stopping at that line a courtesy, and Fenrir's pack has never asked which word the city prefers."
     },
    { id: "P7", name: "Ember Fortress Drill Yard", kind: "warden", at: { x: 68, y: 41 },
      requires: ["P6"], tribe: "Forged Tech", roster: ["pyro_tiki", "pyro_twins", "pyro_scorch", "pyro_burnout"], adds: ["pyro_canister", "pyro_baboom"] ,
      note: "The Knights at drill: a wall, a second wall, and the Support keeping both standing. Bring a can opener.",
      lore: "The Pyro Knights garrison here. The Forged build the city's strength; the Knights make certain nothing gets close enough to test it — and Burnout would honestly rather something tried."
    },
    { id: "P8", name: "Forgotten Ruins", kind: "warden", at: { x: 88, y: 57 },
      requires: ["P5"], tribe: "Dragon", roster: ["pyro_dyna", "pyro_sseerr", "pyro_fenix"], adds: ["pyro_pyrodactyl"],
      note: "A wyrm roost in the rubble. The dragons were under the city before there was a city — Emberclaw still is.",
      lore: "Pyro City was built, quite literally, on top of whatever came before it, and has never once apologised for building over the evidence. Fenix keeps coming back up through the floor."
    },
    // Gated off the city, not off P1: the painted road to the harbour runs
    // through Pyro City. Still only four nodes deep, which keeps the doc's
    // point that a player finding PYRO too punishing can sail out early.
    { id: "P2", name: "Sunfall Coast", kind: "skirmish", at: { x: 34, y: 88 },
      requires: ["P6"], tribe: "Pirate", roster: ["pyro_scully", "pyro_wick", "pyro_firecrack"], adds: ["aqua_buccaneers"],
      overflow: ["aqua_buccaneers"], // pirate haven — the sea road to AQUA
      note: "Pirate haven. Gate C opens the sea route to AQUA from here.",
      lore: "Ships fly no particular flag here. The city tolerates it the way a forge tolerates ash — an acknowledged cost of the fire being worth having — and Scallywag charges rent on the ash."
    },
    { id: "P10", name: "Ember Fortress: Inner Keep", kind: "landmark", tribe: "Volcanic", at: { x: 74, y: 49 },
      requires: ["P7", "P8"], roster: ["pyro_infernus_rex", "pyro_magmadon", "pyro_volcanon"], adds: [],
      note: "The mountain's own: three Volcanic Legendaries behind walls that face inward. Now you know what they keep.",
      lore: "The heaviest walls face inward, a detail visitors notice and the garrison declines to explain. Ember Fortress was raised around Infernus Rex, not against anything that might arrive."
     },
    { id: "P11", name: "Sunfall Watch", kind: "landmark", at: { x: 62, y: 72 },
      requires: ["P2", "P10"], tribe: "Forged Tech", roster: ["pyro_mortar", "pyro_pyrodactyl", "pyro_chopper", "pyro_komodo", "pyro_warkiln", "pyro_magmaw", "pyro_sol", "pyro_aftermath", "pyro_dynomight"], adds: [],
      note: "The long watch — Sol and Magmaw counting the mountain's days, plus the loose Legendaries that answer to no tribe.",
      lore: "Sunfall Watch counts the days the Firespine has left before it opens again. Sol has never revised that number downward, and Aftermath is the name given to being wrong about it."
     },
    { id: "P13", name: "Firespine Peaks: Dragon's Lair", kind: "throne", at: { x: 10, y: 53 },
      requires: ["P9", "P10"], tribe: "Dragon", roster: ["pyro_pyrogon"],
      // Escorts: the volcanic beasts of the slopes, farmable on the story map.
      adds: ["pyro_ash_boar", "pyro_sseerr", "pyro_firebird"], required: true,
      note: "Required. Clearing it opens Gate D — the Veil Gate, and the DUSK reach.",
      lore: "Every child here is raised on the same understanding: the city's fire and the Dragon's fire are one fire. Pyrogon has simply been keeping more of it, longer, than anyone alive."
    },
    { id: "P12", name: "The Forge Core", kind: "throne", at: { x: 23, y: 66 },
      requires: ["P13"], tribe: "Forged Tech", roster: ["pyro_nitro"],
      // Escorts: Forged Tech, the tribe Nitro tops — farmable at P4.
      adds: ["pyro_heatsink_golem", "pyro_dyna", "pyro_liza"],
      note: "Optional. Where the first flame burns — Forged Tech's Mythic.",
      lore: "The Flame Spire has never gone cold in any account still told, and every district lights its forge from it. Nitro is what the Spire produces when it is asked for more than heat."
    },
    // Gate C, PYRO side. Its twin sits on AQUA's map, so switching routes never
    // means walking back through LEAF.
    { id: "GC", name: "Gate C: Sunfall Harbor", kind: "gate", at: { x: 53, y: 94 },
      requires: ["P2"], tribe: "Pirate", roster: [], opens: ["aqua"],
      adds: ["pyro_flamehound", "pyro_canister", "aqua_buccaneers", "aqua_bootlegger", "aqua_piranha", "aqua_blub", "pyro_liza", "aqua_blackice"],
      demand: { kind: "class", value: "Tank", count: 3 },
      note: "Boarding actions in the pirate lanes. Bring bodies that can hold a deck.",
      lore: "Neither nation admits to governing the harbour and both collect a fee at it. The arrangement has outlasted three attempts to write it down, and Saltjacks board alongside Flamehound."
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
      requires: [], tribe: "SeaC", roster: ["aqua_misty", "aqua_buccaneers", "aqua_piranha"], adds: ["aqua_blub"],
      note: "Where ships arrive. Misty and Saltjacks bleed out to LEAF and PYRO — this is their home.",
      lore: "Not simply the sea between the continents but the Life Source itself, the water that sustained life before there were eight elements to sustain. Piranha has been permitted the crossing for most of it."
    },
    { id: "A2", name: "Coral Isles Shallows", kind: "skirmish", tribe: "SeaC", at: { x: 8, y: 44 },
      requires: ["A1"], roster: ["aqua_blub", "aqua_anglerfish", "aqua_bulletshrimp"], adds: [],
      note: "The SeaC nursery — everything here is small, cheap, and wet. Learn the tribe before the sea starts meaning it.",
      lore: "AQUA's shallowest people: a culture living where the bottom is always underfoot. Outsiders call that caution, the isles call it the floor of the house — and Anglerfish keeps the dark beneath it."
     },
    { id: "A3", name: "Aqua Village Docks", kind: "skirmish", at: { x: 17, y: 54 },
      requires: ["A1"], tribe: "SeaC", roster: ["aqua_arctik", "aqua_icyninza", "aqua_kinguin", "aqua_subcool"],
      adds: ["aqua_guin_tok", "aqua_piranha", "aqua_blub"] ,
      note: "Kinguin's village — the Stars run cold this far south, and the Guin turning out to watch is the whole town.",
      lore: "Harmony between land and sea, half on stilts and half submerged. Where most outsiders first meet AQUA, and where AQUA decides whether it likes them — Frostveil is usually already on the dock."
    },
    { id: "A4", name: "Corsair Lanes", kind: "warden", tribe: "Pirate", at: { x: 26, y: 64 },
      requires: ["A3"], roster: ["aqua_bootlegger", "aqua_octoirate", "aqua_blackbeard", "aqua_harp"], adds: [],
      note: "The Pirate node — every corsair in the region flies through these lanes. Harp keeps the crew singing; cut the song first.",
      lore: "Sailors without kings, seekers of treasure and infamy, answering to no crown and no council. A kingdom, BlackBeard will tell you, is only a very large ship nobody is allowed to leave."
    },
    { id: "A5", name: "The Reef Wall", kind: "skirmish", tribe: "SeaC", at: { x: 9, y: 63 },
      requires: ["A2"], roster: ["aqua_coralgolem", "aqua_tide", "aqua_spinefin"], adds: [],
      overflow: ["pyro_canister"], // fronts the open sea route to PYRO
      note: "The reef fights for itself. Tide still teaches the once-per-game Talent, and Spinefin is why nobody anchors here.",
      lore: "Most of what AQUA eats begins somewhere on the reef. Nobody quarries it and nobody anchors on it, and the Coral Golem is the reef's way of never having to put that in writing."
     },
    { id: "A6", name: "Mists of Despair", kind: "warden", tribe: "Liquid", at: { x: 28, y: 85 },
      requires: ["A5"], roster: ["aqua_siphon", "aqua_bahari", "aqua_anos"], adds: [],
      note: "Shipwreck boneyard, perpetual fog — and the water in it is the tribe. Three Liquid casters and no frontline to hit.",
      lore: "A shipwreck boneyard wrapped in fog that has never once lifted for a living sailor. Neither AQUA nor DUSK claims what happens inside, and Serenos has never been asked to account for it."
    },
    // Gated off A1, not A3: the floes are the next water NORTH of where ships
    // arrive, while the village is well south of them.
    { id: "A7", name: "Northern Ice Floes", kind: "skirmish", tribe: "Ice", at: { x: 38, y: 18 },
      requires: ["A1"], roster: ["aqua_icynin", "aqua_owlette", "aqua_polarbear"], adds: [],
      lore: "The Ice Kingdom's outermost water, a border never twice the same shape. The northern families name every floe they winter on, and the PolarBear keeps the name long after the floe is gone."
     },
    { id: "A8", name: "Ice Castle Outer Ward", kind: "warden", tribe: "Ice", at: { x: 46, y: 26 },
      requires: ["A7"], roster: ["aqua_cryo", "aqua_blackice", "aqua_icewall"], adds: [],
      note: "Ice Wall belongs to the castle it walls. A real wall, not a damage race — bring something that gets through 20 HP behind BLOCK.",
      lore: "\"Descendants of the frozen deep\" is not a poetic title here, it is a genealogy. The Ice Kingdom does not merely neighbour the Arctic, and Cryo has never had to argue the point."
    },
    // Gated off A8, not A6: the Trench is painted on the EAST edge and the mists
    // are in the far south-west. The lane from the Ice Castle is the short one.
    { id: "A9", name: "The Steamvent Trench", kind: "warden", tribe: "Vapor", at: { x: 78, y: 40 },
      requires: ["A8"], roster: ["aqua_sapphire", "aqua_vaporem", "aqua_liquark", "aqua_krakler"], adds: [],
      note: "Still the spike — two Cost-5 Vapors holding the steam while Liquark and Krakler hunt from the vents underneath.",
      lore: "Scalding water and freezing water meet along the trench and neither one wins. In the deep, cold and heat have never needed permission to coexist — Vaporem is what the argument looks like." },
    { id: "A10", name: "Ice Castle: Guardians of Ice", kind: "landmark", at: { x: 60, y: 14 },
      requires: ["A8"], tribe: "Ice", roster: ["aqua_polarking", "aqua_phrost", "aqua_glacius"], adds: [],
      note: "A pure FREEZE wall, and the only node touching the Arctic Gate — DAWN's border, sealed until Act V.",
      lore: "Three nations claim the Frozen Citadel and the Polar King has confirmed none of them: diplomacy, or the oldest joke in Concord, depending entirely on who is doing the asking."
    },
    { id: "A11", name: "Atlantis Outer Ring", kind: "landmark", tribe: "SeaC", at: { x: 65, y: 55 },
      requires: ["A6", "A9"], roster: ["aqua_surferdude", "aqua_sonarping", "aqua_divebill", "aqua_bluewhale", "aqua_firefighter", "aqua_siren", "aqua_rain", "aqua_driftwraith", "aqua_magalogoon", "aqua_killerwhale"], adds: [],
      note: "Four Legendaries — the richest node in the first three acts. Both arms of the sea have to be yours first.",
      lore: "Everything the sea carries stops at the outer ring, and almost none of it was invited. Atlantis does not refuse arrivals — it lets the ring decide, and the Siren does the deciding."
     },
    { id: "A13", name: "Atlantis: Heart of the Ocean", kind: "throne", at: { x: 50, y: 45 },
      requires: ["A11"], tribe: "SeaC", roster: ["aqua_hydrogon"],
      // Escorts: the reef that guards the city, farmable at A5.
      adds: ["aqua_divebill", "aqua_tide", "aqua_blackice"], required: true,
      note: "Required. Clearing it opens the sea lanes, which is what makes the rest of the campaign non-linear.",
      lore: "Press an elder and the answer is always a version of the same sentence: Atlantis was not lost, it was put down there. None has ever finished the thought, and Hydrogon is not asked to."
    },
    { id: "A12", name: "The Deep", kind: "throne", at: { x: 54, y: 88 },
      requires: ["A13"], tribe: "SeaC", roster: ["aqua_kraken"],
      // Escorts: the deep's own, farmable at A4.
      adds: ["aqua_krakler", "aqua_spinefin", "aqua_bahari"],
      note: "Optional, and the hardest fight in Act II — deliberately harder than either required Throne.",
      lore: "Some say the Deep is a place. Some say it is the Kraken — oldest and hungriest of the Deep Creatures, coiled beneath the city, keeping something in or else keeping something out."
    },
    // Gate F: the Arctic Gate. The AQUA art paints it "To Dawn (Locked)" — it
    // stays sealed until Act V, so it wants two of the three Gray Thrones just
    // as the Shadow Border does. Neither Act V region is gated on the other.
    { id: "GF", name: "Gate F: The Arctic Gate", kind: "gate", at: { x: 46, y: 7 },
      requires: ["G14", "B14", "R14"], requiresCount: 2, tribe: "Ice", roster: [], opens: ["dawn"],
      adds: ["aqua_cryo", "aqua_anos", "dawn_beam", "dawn_flash", "dawn_able", "dawn_sparkle", "aqua_icynin", "dawn_amble"],
      demand: { kind: "class", value: "Mage", count: 3 },
      note: "The road through the ice wall. Nothing has crossed it in either direction all campaign.",
      lore: "DAWN opens the ice from the far side, or it does not open. The Golden Kingdom has never explained the rule, and Vigil has stood that seam long enough that nobody below still asks for one."
     },
    // Gate E: the Gray Continent ports. Gated on BOTH Green Thrones rather than
    // AQUA's alone — §2 makes PYRO and AQUA mandatory before Act IV so the
    // player reaches the 5x5 board with a three-element pool.
    { id: "GE", name: "Gate E: Gray Continent Ports", kind: "gate", at: { x: 88, y: 20 },
      requires: ["A13", "P13"], tribe: "Pirate", roster: [], opens: ["gale", "bolt", "bore"],
      adds: ["aqua_arctik", "aqua_harp", "gale_sirocco", "gale_megair", "gale_gastly", "gale_skyforce", "aqua_bahari", "gale_angale", "aqua_bootlegger", "aqua_buccaneers"],
      demand: { kind: "attack", value: "Ranged", count: 4 },
      note: "The airship lanes north. Everything past here is fought on the 5x5 board.",
      lore: "The crossing that made the Gray Continent reachable at all. Every line running north still paints the old charter markings on its hulls, and Skyforce still honours them."
     },
    // Gate C, AQUA side — the same harbor from the other direction.
    { id: "GC2", name: "Gate C: Sunfall Harbor", kind: "gate", at: { x: 10, y: 72 },
      requires: ["A5"], tribe: "Pirate", roster: [], opens: ["pyro"],
      adds: ["aqua_buccaneers", "aqua_bootlegger", "pyro_flamehound", "pyro_canister", "pyro_firecrack", "pyro_taper", "aqua_icynin", "pyro_scorch"],
      demand: { kind: "class", value: "Tank", count: 3 },
      note: "The same harbor from the water. Sail east and PYRO's coast is yours without going back through LEAF.",
      lore: "The glow reaches a ship long before the coast does. AQUA's charts mark Sunfall by that light rather than by its docks, and no captain admits to steering by Flamehound's fire."
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
      requires: [], tribe: "Avian", roster: ["gale_gastly", "gale_megair", "gale_sirocco"], adds: ["gale_swillow", "gale_hawko"],
      note: "Where the airships put down. The sea road back to AQUA is west.",
      lore: "GALE's proof of strength is simpler than any other nation's: you are still here, and the storm has not taken you. Sirocco was on the steps before the airship finished tying up."
    },
    { id: "G2", name: "Amberleaf Groves", kind: "skirmish", at: { x: 26, y: 46 },
      requires: ["G1"], tribe: "Avian", roster: ["gale_skyforce", "gale_swillow", "gale_syt_bird"], adds: [],
      note: "Orangewood bent flat by the wind.",
      lore: "GALE's only forest, and the orangewood exists for one purpose: standing between the worst of the storms and whatever is trying to grow behind it. Nobody worships it. Sightwing nests in it."
    },
    { id: "G3", name: "The Rolling Flats", kind: "skirmish", at: { x: 40, y: 56 },
      requires: ["G2"], tribe: "Dark Wind", roster: ["gale_breeze", "gale_tumbleweed", "gale_klouy"], adds: ["gale_toxhawk"],
      note: "Everything out here moves with the wind — tumbleweed, spindrift, and you.",
      lore: "Open ground in every direction and a prevailing wind steady enough to reckon by. GALE gives directions across the Flats in hours of wind, and Tumbleweed has already covered most of them."
     },
    { id: "G5", name: "Dark Wind Township", kind: "skirmish", at: { x: 17, y: 79 },
      requires: ["G2"], tribe: "Dark Wind", roster: ["gale_luna", "gale_duster", "gale_windsor"], adds: ["gale_toxhawk"],
      note: "Under perpetual cloud. The Wolves start here — Luna is the first of the pack.",
      lore: "GALE's furthest edge, where the nation's own patience runs out and its rawest weather takes over. Airship and sea traffic cross here more than either admits, and Duster watches all of it."
    },
    { id: "G4", name: "The Raptor Roosts", kind: "skirmish", at: { x: 89, y: 79 },
      requires: ["G3"], roster: ["gale_vaga", "gale_hawk", "gale_hawko"], adds: ["gale_toxhawk_tok"],
      note: "Cliffside aeries. Fight the birds here before you meet what raises them.",
      lore: "Wyverns and young dragons test their wings in these storms before they are strong enough for anywhere else in Concord. Stormquill was raised on this cliff and has never needed a second."
    },
    { id: "G6", name: "Northern Wind Villages", kind: "warden", at: { x: 38, y: 22 },
      requires: ["G3"], tribe: "Dark Wind", roster: ["gale_stormhide_bison", "gale_wailverine", "gale_rayfen", "gale_dreamcatcher"], adds: ["gale_angale"] ,
      note: "Herd country. Count the bison on the way in; count what's watching them on the way out.",
      lore: "Farmsteads and highland homes behind the Amberleaf's natural windbreaks. GALE's villages are practical in a way few nations bother to be, and the Stormhide Bison are part of the windbreak."
    },
    { id: "G8", name: "Gale Village", kind: "warden", tribe: "Avian", at: { x: 58, y: 35 },
      requires: ["G3"], roster: ["gale_toxhawk", "gale_wista", "gale_fano"], adds: [],
      note: "The hardy people of the Orange Plains, and the wandering twisters they live with.",
      lore: "Funnel clouds rise and dissolve across the horizon most days, and the nation's heart builds around them rather than pretend they will stop. Zephyra has never once been surprised by one."
    },
    { id: "G7", name: "Skyforge Aerie", kind: "warden", tribe: "Avian", at: { x: 91, y: 62 },
      requires: ["G4"], roster: ["gale_angale", "gale_buf", "gale_sway"], adds: ["gale_ollie"],
      note: "Sway's Birds of Prey spawns Ollie, so the filler here is diegetic rather than padding.",
      lore: "GALE does not train the birds of this aerie, it keeps an arrangement with them. The handlers say it has always been Sway's to end, and not one of them expects to be told first."
     },
    { id: "G9", name: "The Shrike Line", kind: "warden", tribe: "Avian", at: { x: 72, y: 58 },
      requires: ["G7", "G8"], roster: ["gale_masala", "gale_vvulture", "gale_guan"],
      adds: ["gale_toxhawk_tok"],
      note: "Mesala's Raptor Assault raises the same bird you fought at the Roosts.",
      lore: "Shrikes keep their larder along the thorn line and GALE has never thinned it. A bird that stores more than it can eat is a neighbour this nation understands, and Vulture waits on the surplus."
     },
    { id: "G10", name: "Stormwall Approach", kind: "warden", tribe: "Wolf", at: { x: 73, y: 27 },
      requires: ["G6"], roster: ["gale_omega", "gale_whirlwolf", "gale_wolfbane"], adds: [],
      note: "Omega and Luna were written as a pair — this is where the pack closes.",
      lore: "GALE's mapmakers draw exactly one fixed line on the continent, and the Stormwall is it. They have redrawn it four times in living memory, and WolfBane had crossed each version already."
     },
    { id: "G11", name: "Stormwatch Cliffs: The Totem", kind: "landmark", tribe: "Avian", at: { x: 84, y: 52 },
      requires: ["G9", "G10"], roster: ["gale_eagon", "gale_tempest", "gale_totem"],
      adds: ["gale_totem_pole"],
      note: "The wind elemental shrine. The only node in the game whose filler is a Legendary-rarity token.",
      lore: "Stormwatch keeps no calendar of years. It counts the totems the cliffs have taken, and counts separately the ones standing again before anyone climbed up — Eagon does not explain the second number."
     },
    { id: "G12", name: "The Eye of the Storm", kind: "landmark", tribe: "Avian", at: { x: 60, y: 80 },
      requires: ["G5", "G9"],
      roster: ["gale_falcon", "gale_leeward", "gale_goldspur", "gale_aerostat", "gale_gyre", "gale_bluejay", "gale_galeon", "gale_klipso", "gale_kloud"], adds: [],
      note: "The whole Cost-7 Legendary band on one node — the richest recruit in Act IV.",
      lore: "The only still air in GALE and the least trusted: a people who read wind for warning have never settled what to make of a place with nothing to read. Galeon keeps the eye regardless."
     },
    { id: "G13", name: "Wolfrun Hollow", kind: "throne", at: { x: 62, y: 10 },
      requires: ["G10"], tribe: "Wolf", roster: ["gale_stormfang"],
      // Escorts: the pack itself, farmable at G6 and G5.
      adds: ["gale_whirlwolf", "gale_luna", "gale_buf"],
      note: "StormFang's Throne. Optional — the Wolf payoff, and its Pack aura reaches four cards you already met.",
      lore: "Wolfrun does not hunt its wolves, it watches them. Stormfang's pack picks its ground by weather that has not arrived yet, and a village that ignores where they run loses roofs."
     },
    { id: "G14", name: "Tempest Peaks", kind: "throne", at: { x: 93, y: 26 },
      requires: ["G11", "G12"], tribe: "Avian", roster: ["gale_griffith"],
      // Escorts: the birds of the Roosts, farmable at G4 and G2.
      adds: ["gale_ollie", "gale_hawk", "gale_skyforce", "gale_angale"], required: true,
      note: "Thunder Reach. Required — clearing it opens the airship routes on to BOLT and BORE.",
      lore: "Past Stormwatch the storms stop being merely violent and become constant, close enough to BOLT that lightning from both skies is hard to tell apart. Skyrend is already up there in it."
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
      requires: [], tribe: "Voltis", roster: ["bolt_junker", "bolt_zap", "bolt_twotales"], adds: ["bolt_ning"],
      note: "Where the sea road from AQUA meets the sprawl.",
      lore: "“Magic is just power no one has bothered to wire up yet” — painted above the door of every research wing in the city. Junker has been dragging the proof out of the sprawl for years."
    },
    { id: "B2", name: "Drone Field", kind: "skirmish", tribe: "ARC", at: { x: 27, y: 46 },
      requires: ["B1"], roster: ["bolt_zipp", "bolt_rodd", "bolt_static"], adds: ["bolt_drone_tok"],
      note: "Neon sprawl and strung cables. Zipp's Swarm Deploy makes the Drones.",
      lore: "BOLT wires ground before anyone settles it. The lines go out to empty lots first and whoever builds there afterwards is filed as proof the survey was right; the Drones were here before the lots."
     },
    { id: "B3", name: "Substation Row", kind: "skirmish", at: { x: 34, y: 33 },
      requires: ["B1"], tribe: "ARC", roster: ["bolt_drshock", "bolt_electricel", "bolt_jolt"], adds: ["bolt_zipp", "bolt_staticcloud"],
      lore: "Substation Row splits the city's current between districts and posts the division publicly each morning. A grid nobody can audit, DrShock will tell you, is a grid somebody has already tapped."
     },
    { id: "B4", name: "The Static Flats", kind: "skirmish", tribe: "ARC", at: { x: 28, y: 12 },
      requires: ["B3"], roster: ["bolt_staticcloud", "bolt_ning", "bolt_stingray"],
      adds: ["bolt_static_wisp_tok"],
      note: "Fused glass and a lightning-scarred gateway. The north road to GALE runs through here.",
      lore: "BOLT did not build lines to carry lightning after it struck — it built a spire to gather it before it has finished being GALE's storm. The Static Cloud is what the spire has not collected yet."
    },
    { id: "B5", name: "Conduit Marsh", kind: "skirmish", at: { x: 26, y: 63 },
      requires: ["B2"], tribe: "ARC", roster: ["bolt_buzz", "bolt_buzzard", "bolt_jellyfish"], adds: ["bolt_drone_tok", "bolt_static"],
      note: "The same Drone from a second source — Buzzard's Drone Sweep.",
      lore: "Wet ground carries a charge better than dry, which is the only reason the marsh was never drained. BOLT keeps it flooded to spec and treats the water as wiring; Jellyfish treats it as home."
     },
    { id: "B6", name: "Breaker Yard", kind: "warden", at: { x: 41, y: 41 },
      requires: ["B3"], tribe: "ARC", roster: ["bolt_scrapper", "bolt_storm", "bolt_thundercat"], adds: ["bolt_staticcloud", "bolt_static"],
      lore: "Every grid fails somewhere, so BOLT decided in advance where. The Breaker Yard is the address the rest of the city agreed to hand it, and Scrapper is what the address is staffed with."
     },
    { id: "B8", name: "Overload Junction", kind: "warden", at: { x: 63, y: 45 },
      requires: ["B6"], tribe: "Voltis", roster: ["bolt_shoksa", "bolt_striik", "bolt_lytning"], adds: [],
      note: "More current than anything downstream can spend. Dynamo makes it, Highroller bets it, Lytning spends it on you.",
      lore: "More current arrives here than anything downstream can spend, and that is the specification rather than an accident. Dynamo was built to that number before it was ever read as a warning."
     },
    { id: "B7", name: "Arc Industries Yards", kind: "warden", tribe: "ARC", at: { x: 89, y: 55 },
      requires: ["B8"], roster: ["bolt_webster", "bolt_sentry", "bolt_voltcher"], adds: [],
      note: "Cooling towers and conduit pylons. The ARC spine starts here — every one of them Epic or above.",
      lore: "The mega fabrication plant — machines, weapons, innovation. If it can be built, Arc has already built a faster one, and Sentry is the version they stopped improving because it was finished."
    },
    { id: "B9", name: "The Forge Grid", kind: "warden", tribe: "ARC", at: { x: 79, y: 41 },
      requires: ["B7"], roster: ["bolt_surge", "bolt_kore", "bolt_zagphu", "bolt_havoc"],
      adds: ["bolt_static_wisp_tok"] ,
      note: "ARC's heavy line — Surge, Kore, and Ricochet, fresh off the forge floor.",
      lore: "Voltis Plaza honours whoever first proved storm-lightning could be caught, and the official histories name no one. Ask an old GearHollow dwarf and you may get a name; Havoc came off this floor."
    },
    { id: "B10", name: "Forsaken Heights", kind: "warden", tribe: "ARC", at: { x: 88, y: 21 },
      requires: ["B9"], roster: ["bolt_general", "bolt_thunder", "bolt_volta"], adds: [],
      note: "Iron lightning-rods drawing the storm. Volta's Grid Deployment spawns Rodd — a card you already own from the Drone Field.",
      lore: "The Heights were homes before they were lightning-rods. BOLT records the buyout as an upgrade, a word none of the families who signed it has used since, and the General does not discuss it."
     },
    { id: "B11", name: "The Hive Array", kind: "landmark", tribe: "ARC", at: { x: 72, y: 67 },
      requires: ["B5", "B9"], roster: ["bolt_jack_arc", "bolt_keeper", "bolt_gigavolt", "bolt_zoez"],
      adds: ["bolt_beebot"],
      note: "GearHollow's swarm. Keeper breeds a Beebot every round to a cap of 5 while GigaVolt's Turret Mode pins what it touches — solve the engine, not the board.",
      lore: "GearHollow's dwarves sign nothing they build: in the tunnels a name on a diagram reads as an admission that one person could have got the whole thing wrong. Jack Arc signs nothing either."
     },
    { id: "B12", name: "Stormcaller's Spire", kind: "landmark", at: { x: 66, y: 18 },
      requires: ["B4", "B10"], tribe: "Voltis", roster: ["bolt_policecar", "bolt_handyman", "bolt_hacker", "bolt_kingpin", "bolt_airship", "bolt_stormcaller", "bolt_shock", "bolt_voltogon"],
      adds: ["bolt_static_wisp_tok"],
      note: "By the airship docks. The machines stay below — this is the storm itself, and Voltogon rides it in.",
      lore: "GALE's storms are sacred and untamed. BOLT's engineers look at the same lightning and ask what it is for — Stormcaller is the answer they built, and nothing here is struck by accident."
    },
    { id: "B13", name: "The Grid Vault", kind: "throne", at: { x: 43, y: 83 },
      requires: ["B11"], tribe: "ARC", roster: ["bolt_velvolt_knight"],
      // Escorts: the Drone Field's own, farmable at B2.
      adds: ["bolt_drone_tok", "bolt_zipp", "bolt_rodd", "bolt_static"],
      note: "Sealed below the core behind blast doors. Optional.",
      lore: "A season of charge sealed under the city and never once drawn on. BOLT files it as ballast rather than reserve, and the Velvolt Knight is what that filing looks like from the wrong side."
     },
    { id: "B14", name: "City Power Core", kind: "throne", at: { x: 50, y: 31 },
      requires: ["B11", "B12"], tribe: "ARC", roster: ["bolt_elecdroid"],
      // Escorts: the scrapyard where the region started, farmable at B1.
      adds: ["bolt_beebot", "bolt_zap", "bolt_static", "bolt_lytning"], required: true,
      note: "The Arc Lightning Conduit itself. Required — clearing it opens the mountain pass to BORE.",
      lore: "BOLT calls the Core a machine: engineered, replicable, understood. Its senior engineers admit, quietly, that nobody has explained why ARC draws more power than its conduits should allow."
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
      requires: [], tribe: "Cavernous", roster: ["bore_cavedweller", "bore_iron", "bore_kcor"], adds: ["bore_ufo"],
      note: "The Reveen Foothills, where the mountain pass down from BOLT lets out.",
      lore: "Old the way stone is old rather than the way a kingdom counts its kings: unhurried, and uninterested in proving anything in less time than it takes. Iron was at the mouth before the pass was."
    },
    { id: "R2", name: "Rubble Road", kind: "skirmish", at: { x: 36, y: 22 },
      requires: ["R1"], tribe: "Cavernous", roster: ["bore_cosmic", "bore_crock", "bore_hillbilly"], adds: ["bore_cavedweller", "bore_ufo"],
      lore: "Reveen's hill folk do not repair the road so much as walk it flat again. Hillbilly has shouldered stone aside for years, and some of it did not fall from the mountain."
     },
    { id: "R3", name: "The Smithy Camp", kind: "skirmish", at: { x: 23, y: 47 },
      requires: ["R1"], tribe: "Cavernous", roster: ["bore_clubber", "bore_rockgoblin", "bore_smith"], adds: ["bore_cavedweller", "bore_ufo"],
      note: "Open forges — home of the legendary crafters.",
      lore: "Nothing leaves the Black Smith's forges quickly. Smith has never once apologised to a customer who waited a year for something worth carrying for a lifetime."
    },
    { id: "R4", name: "Sand Village", kind: "skirmish", at: { x: 23, y: 80 },
      requires: ["R3"], tribe: "Sand Village", roster: ["bore_sling", "bore_thorny_ripper", "bore_valcana"], adds: [],
      note: "Desert dwellers under cloth awnings. We trade, travel, survive.",
      lore: "Desert dwellers who live on the mountain's sand rather than in its stone, closer to the Worm's territory than anyone in the Fortress would prefer. Valcana has never raised the subject."
    },
    { id: "R5", name: "Mountain Beast Range", kind: "skirmish", at: { x: 52, y: 20 },
      requires: ["R2"], tribe: "Mountain Beasts", roster: ["bore_ankylosaur", "bore_armadillo", "bore_warthog"], adds: [],
      note: "The armour school — three Tanks, two of them Granite. A deck that cannot break shields stops here, early enough to be a lesson rather than a wall.",
      lore: "The herds were on this range before anyone thought to name it, and BORE has never fenced a foot of it. Grazing rights here run the other direction, and the Granite Ankylosaur collects them."
     },
    { id: "R6", name: "The Standing Stones", kind: "skirmish", at: { x: 65, y: 34 },
      requires: ["R5"], tribe: "Cavernous", roster: ["bore_rock", "bore_stone", "bore_ufo"], adds: ["bore_cavedweller"],
      note: "Out toward the sand worm's dunes. UFO is 2 HP behind 5 shields that irradiates the whole board — the damage is trivial, getting to it is the fight.",
      lore: "A vast Sand Worm drags the dunes into slow spiralling wounds when it surfaces. BORE's storytellers never call it the only one, only the one already awake. Slugger has stood the stones throughout."
    },
    { id: "R7", name: "Faultline", kind: "warden", at: { x: 30, y: 38 },
      requires: ["R5"], tribe: "Cavernous", roster: ["bore_shift", "bore_rhe", "bore_sheish", "bore_kobra"],
      adds: ["bore_cosmic", "bore_crock", "bore_obsidi"],
      lore: "The stonework is set without mortar on purpose: the ground can shift a hand's width and the wall goes with it. Building rigid was tried once, and Shift is what the ground does about it."
     },
    { id: "R8", name: "Crystal Seam", kind: "warden", at: { x: 9, y: 38 },
      requires: ["R3"], tribe: "Mountain Beasts", roster: ["bore_krysteel", "bore_lithara", "bore_monger"],
      adds: ["bore_smith", "bore_clubber", "bore_rhino"],
      note: "Giant mystical crystals, light spilling out of the rock.",
      lore: "Giant crystals grow undisturbed in the seam and Krysteel grows with them. The scholars who first theorised the War Element still cross-reference their notes against what they only call the deeper hum."
    },
    { id: "R9", name: "The Rolling Deep", kind: "warden", at: { x: 52, y: 45 },
      requires: ["R7"], tribe: "Mountain Beasts", roster: ["bore_rollo", "bore_bolder", "bore_old_timer"],
      adds: ["bore_iron", "bore_kcor", "bore_rohojohn"],
      lore: "Stone that has been rolling long enough to lose its corners, in galleries nobody has finished clearing. The haulers work by ear, and Old Timer steps aside before there is a reason to."
     },
    { id: "R10", name: "Cavernous Descent", kind: "warden", tribe: "Cavernous", at: { x: 35, y: 65 },
      requires: ["R4", "R9"], roster: ["bore_gemaga", "bore_obsidi", "bore_score"],
      adds: ["bore_hillbilly", "bore_cavedweller"],
      note: "Beneath the mountain, secrets breathe.",
      lore: "Miners go down here with a lamp, and the ones who stay stop carrying it back up. Nobody teaches that; the dark arranges it, and the CaveDweller was arranged for a long time ago."
     },
    { id: "R11", name: "The Gem Vault", kind: "landmark", at: { x: 44, y: 55 },
      requires: ["R8", "R9"], tribe: "Mountain Beasts", roster: ["bore_diam", "bore_prism", "bore_sandman", "bore_rohojohn"],
      adds: ["bore_spinosaur"],
      note: "The lantern-lit descent of the Diamond Mine. The utility tier, all four on one node.",
      lore: "The Diamond Mine carves its stronghold out of rock too patient to notice the excavation. Beauty that simply accumulates, given centuries, and Adamant is what accumulating looks like finished."
    },
    { id: "R12", name: "The Unbroken Wall", kind: "landmark", at: { x: 79, y: 58 },
      requires: ["R6", "R10"], tribe: "Mountain Beasts", roster: ["bore_dunebuggy", "bore_kingcobra_tok", "bore_rhino", "bore_badlands_bandits", "bore_spinosaur", "bore_bastion", "bore_bearocks", "bore_steel"], adds: [],
      note: "Bore Fortress — stone guardians. The campaign's hardest Landmark to out-damage rather than out-think, and Ironclad is immune to every status and DOT in the game. Bring PEN or bring a plan.",
      lore: "Bore Fortress is held by the Stone Guardians, and held is the correct word rather than ruled. A mountain is handed to whoever will keep living on it, and Bastion has kept living on it."
    },
    { id: "R13", name: "Corebore Shaft", kind: "throne", at: { x: 66, y: 76 },
      requires: ["R12"], tribe: "Cavernous", roster: ["bore_the_coreborer"],
      // Escorts: the quarry crew, farmable at R1.
      adds: ["bore_cavedweller", "bore_iron", "bore_valcana"],
      note: "Optional.",
      lore: "Every other shaft in the mountain carries the tool marks of the crew that cut it. This one is round, unmarked, and a little deeper each time anyone measures. The Coreborer is still in it."
     },
    // The door the BORE art paints as "To Dusk — Shadow Border (Locked)".
    // Two of the three Gray Thrones open it, in any combination.
    { id: "GS", name: "The Shadow Border", kind: "gate", at: { x: 8, y: 82 },
      requires: ["G14", "B14", "R14"], requiresCount: 2, tribe: "Dark", roster: [], opens: ["dusk"],
      adds: ["bore_stone", "bore_iron", "dusk_crow", "dusk_pumpkin", "dusk_spider", "dusk_doom", "bore_shift", "dusk_silkstalker"],
      demand: { kind: "class", value: "Tank", count: 4 },
      note: "Where the stone gives out and the shadow starts. Everything past here is Act V.",
      lore: "Not a wall, and not guarded. The stone thins, the light goes, and somewhere inside that thinning the maps stop agreeing with one another — Silkstalker crossed before they disagreed."
     },
    { id: "R14", name: "The Deepest Dark", kind: "throne", at: { x: 49, y: 84 },
      requires: ["R11", "R12"], tribe: "Cavernous", roster: ["bore_deepest"],
      // Escorts: the standing stones, farmable at R6.
      adds: ["bore_stone", "bore_ufo", "bore_shift"], required: true,
      note: "Below all other levels — an endless black drop. Required. The Shadow Border west stays sealed until Act V.",
      lore: "Titans sleep beneath the sands. Not titan — Titans, plural and ancient and, as far as anyone in Bore Fortress will confirm aloud, not yet disturbed. The Deepest is not one of them."
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
  // FIVE. Its ordinary nodes were on the standard board, which ceilinged them
  // at STANDARD_CAP 18 no matter how far the cap ladder had come — and anyone
  // who can reach here is on 24 or 30. The fights were capped below the army
  // the player was allowed to bring.
  board: 5,
  musters: true,
  opening: { node: "D1", epic: "dusk_spectra" },
  throne: "D13",
  art: "/maps/dusk.webp",
  artRatio: 1440 / 1080,
  requires: ["GS"],
  nodes: [
    { id: "D1", name: "The Blighted Verge", kind: "skirmish", at: { x: 20, y: 13 },
      requires: [], tribe: "Dark", roster: ["dusk_crow", "dusk_pumpkin", "dusk_doom"], adds: [],
      note: "Under the Rot Line door. These are the bodies that have been turning up in your regions for four Acts.",
      lore: "“Shadows hold power, and only the forgotten endure” — carved above the gates of every Dead Forest cemetery in Concord. Crow has been reading it to arrivals for a long time."
    },
    { id: "D2", name: "Potter's Field", kind: "skirmish", tribe: "Zombie", at: { x: 33, y: 22 },
      requires: ["D1"], roster: ["dusk_zombie_husk", "dusk_zhunk", "dusk_gravekeeper"],
      adds: ["dusk_zombie_tok", "dusk_skeleton_tok"],
      note: "Dead Forest West. The risen — they rot, they rise, they do not stop.",
      lore: "DUSK's dead do not rise because they refuse to die. They rise because dying was never the part the living world controlled — being forgotten was, and the Gravekeeper keeps that register."
    },
    { id: "D3", name: "Widow's Hollow", kind: "skirmish", tribe: "Spider", at: { x: 34, y: 34 },
      requires: ["D2"], roster: ["dusk_spider", "dusk_widowbite", "dusk_silkstalker", "dusk_sarachnid"],
      adds: [],
      note: "Spiders weave and wait — every widow in the hollow, and nothing that isn't one.",
      lore: "Widows here go on keeping the house exactly as it was kept, and the household is under no obligation to still be alive. The hollow's spiders were named for them; Widowbite kept the name."
     },
    { id: "D4", name: "The Weeping Chapel", kind: "skirmish", tribe: "Ghost", at: { x: 44, y: 22 },
      requires: ["D2"], roster: ["dusk_harve", "dusk_gool", "dusk_soul_wisp"],
      adds: ["dusk_specter_tok"],
      lore: "The chapel is older than the forest that grew around it, and whoever built it left no name on anything. Only the congregation changes, one funeral at a time, and Harrow keeps the book."
     },
    { id: "D5", name: "Scarecrow Rows", kind: "skirmish", tribe: "ScareKrow", at: { x: 41, y: 49 },
      requires: ["D3"], roster: ["dusk_jackl", "dusk_skrow", "dusk_hix", "dusk_plaguecrow"],
      adds: [],
      note: "The Nightmare Fields, at the western landing of the bridge — torn ground, and the hoofprints of the damned.",
      lore: "Nothing has grown in these rows in living memory and the scarecrows are still maintained — restuffed, re-hung, walked back out each season. Strawman has been walked back out more than most."
     },
    { id: "D6", name: "Forsaken Heights", kind: "warden", tribe: "Vamp", at: { x: 22, y: 27 },
      requires: ["D1"], roster: ["dusk_vamp", "dusk_scarlett", "dusk_violet"],
      adds: ["dusk_specter_tok"],
      note: "The Green Continent reach, fought at Act III scale by anyone who came through PYRO's Veil Gate early.",
      lore: "The Dead Forest spreads on both continents at once, the same leafless blight in LEAF's southern edge and BORE's western mountains: one corruption that never respected a border, and Scarlett came with it."
    },
    { id: "D7", name: "The Haunting Ground", kind: "warden", tribe: "Ghost", at: { x: 84, y: 22 },
      requires: ["D8"], roster: ["dusk_spectra", "dusk_ghastly", "dusk_haunt"],
      adds: ["dusk_specter_tok"],
      note: "Dead Forest East — the souls that remain.",
      lore: "The eastern forest is not cleared but conceded, a strip of ground the living hand back fence by fence to whatever declined to move on. The Ghastly Groom is still waiting on one of them."
     },
    { id: "D8", name: "Bonefield Muster", kind: "warden", tribe: "Skeleton", at: { x: 63, y: 46 },
      requires: ["D5"], roster: ["dusk_skeleton_knight", "dusk_skulldrake", "dusk_reaper"],
      adds: ["dusk_skeleton_tok"],
      note: "The eastern landing of the bridge, below the Boneyard. Born of bone, and they march eternal — the only way across the Shadow Pass ravine.",
      lore: "Where LEAF speaks of the Cycle as a wheel, DUSK speaks of Shadow Pass as a door — one that has never fully closed since whatever died first opened it. The Reaper works the near side."
    },
    { id: "D9", name: "The Veil Gate", kind: "warden", at: { x: 13, y: 46 },
      requires: ["D6"], tribe: "Skeleton", roster: ["dusk_ender", "dusk_rip", "dusk_brute", "dusk_wedded_wraith", "dusk_aranea"],
      adds: ["dusk_risen_tok", "dusk_specter_tok"],
      note: "The portal to the forgotten souls, and the region's spike at cost 20.",
      lore: "DUSK's account of the Sundering is the shortest, and the one no other nation enjoys hearing repeated: something died. Not a person, not a nation. Ender has never elaborated on it."
    },
    { id: "D10", name: "Death Island: The Landing", kind: "landmark", at: { x: 40, y: 62 },
      requires: ["D5", "D9"],
      tribe: "Vamp", roster: ["dusk_ravven", "dusk_scar", "dusk_hoax", "dusk_nightfang"],
      adds: ["dusk_zombie_tok", "dusk_redreven"],
      lore: "Nobody is carried up the stones from the Landing. Whatever condition an arrival is in, DUSK holds the last stretch of a journey belongs to the one making it, and Vesper only counts them in."
     },
    { id: "D11", name: "Death Island: The Barrows", kind: "landmark", at: { x: 66, y: 64 },
      requires: ["D7"], tribe: "Ghost", roster: ["dusk_duet", "dusk_grafft", "dusk_monstrous_spider_tok", "dusk_prestige", "dusk_tatterhand", "dusk_zombination", "dusk_skelider", "dusk_destro"],
      adds: ["dusk_skeleton_tok"],
      lore: "The mounds are numbered, swept, and reopened as needed, the way a street keeps its houses. The families who do the upkeep are mostly buried in the same row, and Zombination works both shifts."
     },
    { id: "D12", name: "The Bone Throne", kind: "throne", at: { x: 86, y: 58 },
      requires: ["D11"], tribe: "Skeleton", roster: ["dusk_skullking"],
      adds: ["dusk_skeleton_tok", "dusk_skulldrake_tok", "dusk_skrow"],
      note: "Nightward Keep — the watchers of Dusk. Optional.",
      lore: "Every piece of the Bone Throne was given rather than taken. A place in the seat is the last posting of a very long service, and SkullKing applied a good deal earlier than most."
     },
    { id: "D13", name: "The Long Night", kind: "throne", at: { x: 50, y: 79 },
      requires: ["D10", "D11"], tribe: "Dark", roster: ["dusk_shadowhorsemen"],
      adds: ["dusk_specter_tok", "dusk_risen_tok", "dusk_silkstalker"], required: true,
      note: "Death Island, land of the forgotten. Required.",
      lore: "Not a place the forgotten go, but a place where forgetting itself has settled, the way fog settles into a valley it likes. No living ruler has claimed it; the Shadow Horsemen ride it anyway."
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
  // FIVE. Its ordinary nodes were on the standard board, which ceilinged them
  // at STANDARD_CAP 18 no matter how far the cap ladder had come — and anyone
  // who can reach here is on 24 or 30. The fights were capped below the army
  // the player was allowed to bring.
  board: 5,
  musters: true,
  opening: { node: "W1", epic: "dawn_veil" },
  throne: "W13",
  art: "/maps/dawn.webp",
  artRatio: 1440 / 1080,
  requires: ["GF"],
  nodes: [
    // The whole region runs south to north: in through the Arctic Veil at the
    // bottom, fanning west and east, converging on the castle at the top.
    { id: "W1", name: "The Arctic Veil", kind: "skirmish", at: { x: 49, y: 78 },
      requires: [], tribe: "Stars", roster: ["dawn_able", "dawn_beam", "dawn_flash"], adds: [],
      note: "The guarded way, and the only road in. Everything past the wall has been unseen all campaign.",
      lore: "Sailors who have tried to chart the Veil report the same thing: the storm does not end because you outlast it, it ends because it decides you may pass. Vigil keeps the gate on this side."
    },
    { id: "W2", name: "First Light Camp", kind: "skirmish", tribe: "Suns", at: { x: 36, y: 72 },
      requires: ["W1"], roster: ["dawn_roy", "dawn_sparkle", "dawn_glime"], adds: [],
      lore: "Whoever the Veil lets through is fed and warmed before being asked a single question. The order is deliberate, and the Outrider who brings them in asks nothing at all on the way."
     },
    { id: "W3", name: "Mirrorfield", kind: "skirmish", tribe: "Stars", at: { x: 27, y: 62 },
      requires: ["W2"], roster: ["dawn_reflection", "dawn_shine", "dawn_sphere"], adds: [],
      lore: "Mirror banks angled at the low sun, putting DAWN's light on ground the sun cannot reach. The polishers will never see the wall they keep lit, and Reflection is how the light gets there."
     },
    { id: "W4", name: "Golden Farmlands", kind: "skirmish", tribe: "Suns", at: { x: 16, y: 58 },
      requires: ["W3"],
      roster: ["dawn_stbern", "dawn_goldeneagle", "dawn_musk_ox", "dawn_oxin"], adds: [],
      note: "Royal gardens, green in the snow — and the herd that works them.",
      lore: "Fertile soil nurtured by sunlight and care: a kingdom built around a wall against the dark still has to eat, and the Musk Ox works the rows without ever being told twice."
    },
    { id: "W5", name: "Sunrise Muster", kind: "warden", tribe: "Suns", at: { x: 44, y: 64 },
      requires: ["W2"], roster: ["dawn_amble", "dawn_halo", "dawn_star", "dawn_ty"], adds: [],
      note: "Sun and star answer the same roll call — DAWN keeps no separate list.",
      lore: "The names are called at sunrise and the fallen are read out with the living, and someone in the line answers for each of them. Halo has answered for more than one."
     },
    { id: "W6", name: "The Blazing Road", kind: "warden", tribe: "Suns", at: { x: 58, y: 70 },
      requires: ["W5"], roster: ["dawn_golde", "dawn_radiance", "dawn_drakonbane", "dawn_lazor"], adds: [],
      note: "The knights' road north, never in shadow — and never unguarded.",
      lore: "Not the shortest road north — the only one never in shadow. DAWN would rather add a day's march than hand the dark a stretch of road, and Drakonbane rides the whole of it."
     },
    { id: "W7", name: "The Solar Bastion", kind: "warden", tribe: "Suns", at: { x: 26, y: 38 },
      requires: ["W4"],
      roster: ["dawn_solara", "dawn_solstice", "dawn_veil", "dawn_warphant"],
      adds: ["dawn_radiant_guardian"],
      note: "The wall that shines. We hold the wall; nothing passes.",
      lore: "The Golden Kingdom does not hide because it is proud. It hides because it is standing in front of something, and Solara has held this wall a long time without being certain what happens if it stops."
    },
    { id: "W8", name: "High Noon", kind: "warden", tribe: "Stars", at: { x: 68, y: 47 },
      requires: ["W6"],
      roster: ["dawn_clipsey", "dawn_sircrest", "dawn_ariel", "dawn_raya", "dawn_lassos"], adds: [],
      note: "Noon, and the sky darkens anyway. The Stars take the sun's own hour.",
      lore: "Every clock and boundary stone in the Kingdom is reckoned from the moment the sun crosses this ground. No king set the mark — surveyors argued their way to it, and Zenith holds it now."
     },
    { id: "W9", name: "Castle Grounds", kind: "landmark", tribe: "Stars", at: { x: 50, y: 57 },
      requires: ["W5", "W7"],
      roster: ["dawn_aurora", "dawn_heir_tok", "dawn_kosmos", "dawn_aurelion"],
      adds: ["dawn_radiant_guardian"],
      note: "Outer wards, tilt-yards and gatehouses. Heir is a Legendary despite the token-shaped id — it is fully draftable.",
      lore: "An heir is named in these yards rather than in the Court above them, so whoever stands watch that morning is a witness. DAWN crowns nobody in private, and Reveille sounds the hour."
     },
    { id: "W10", name: "The Golden Court", kind: "landmark", tribe: "Suns", at: { x: 50, y: 41 },
      requires: ["W8", "W9"], roster: ["dawn_ballista", "dawn_sunspot", "dawn_riflemen", "dawn_meridian", "dawn_quasar", "dawn_commander", "dawn_leo", "dawn_dawn"],
      adds: ["dawn_radiant_guardian"] ,
      lore: "DAWN's nobility is a chess hierarchy every child learns before reading: King, Queen, Bishop, Rook, Knight — and Pawn, which is most of DAWN. Leo stands where the board says to stand."
    },
    // Two optional Thrones, both seats the painting names outright.
    { id: "W11", name: "Sun's Army Fronts", kind: "throne", at: { x: 72, y: 70 },
      requires: ["W6"], tribe: "Suns", roster: ["dawn_equestrian"],
      adds: ["dawn_warrider_tok", "dawn_stbern", "dawn_golde"],
      note: "Guardians of Dawn, watching over the wilds. Optional — the Equestrian seat.",
      lore: "Knights of the Sun, who march without fear and consider retreat a kind of lie. They fight in daylight by choice, and the Equestrian has never asked anyone for a second reason."
    },
    { id: "W12", name: "Stars Army Flakes", kind: "throne", at: { x: 88, y: 43 },
      requires: ["W8"], tribe: "Stars", roster: ["dawn_supernova"],
      adds: ["dawn_sparkle", "dawn_glime", "dawn_lazor"],
      note: "Silver pavilions where the lights touch down. Optional — the Supernova seat, and the star that fell is still burning in the Sundered Sky above it.",
      lore: "Named for the way starlight and snowfall look the same from far enough away. The Flakes keep their oldest devotions where the frozen lands can hear them; the sun sleeps and Supernova does not."
    },
    { id: "W13", name: "Dawn Castle", kind: "throne", at: { x: 50, y: 22 },
      requires: ["W10"], tribe: "Suns", roster: ["dawn_imperator"],
      adds: ["dawn_warrider_tok", "dawn_radiant_guardian", "dawn_amble"], required: true,
      note: "The Golden Seat, throne of the kingdom. Required — the end of the road.",
      lore: "The Golden King's title is not ruler but keeper of the Eternal Vigil, a watch the records insist has never once failed. Imperator holds the Golden Seat and does not discuss the alternative."
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

/** Fill the deck to the cap from everything you can field here.
 *
 *  NOT your best cards, and that is the one thing here that is settled. Three
 *  strategies played against the premade field, 216 matches a cell:
 *
 *      pool        board  stride  cheapest  priciest
 *      DAWN+BOLT   4x4     59.7     67.1      5.1
 *      DAWN+BOLT   5x5     41.3     62.1     12.1
 *      LEAF+AQUA   4x4     58.8     47.2      3.2
 *      LEAF+AQUA   5x5     51.9     43.2     14.0
 *
 *  Filling with the priciest cards wins 3-14% of the time. It is the obvious
 *  reading of "fill with my best" and it is a button that loses you the
 *  fight: a fat curve draws cards it cannot afford while the other side takes
 *  squares. Same effect measured on the gauntlet decks, where swapping in the
 *  benched Legendaries took Blazing Cyclone from 47.7% to 31.0%.
 *
 *  Between the other two it is a TIE — 52.9 against 54.9 on average, inside
 *  the error bar, and they split two pools each. So this does not claim the
 *  better one. It STRIDES the pool in cost order, which is the steadier of the
 *  two (41-60 against cheapest's 43-67) and produces something that reads as a
 *  deck, with an opening and a finisher, rather than thirty one-drops a player
 *  would look at and rebuild by hand. Ties go to the rarer card, then the
 *  heavier stat line, using the budget the cost formula itself uses.
 *
 *  It is a DEFAULT, not a commitment: everything else on this screen still
 *  edits what it produces. */
const AUTO_RARITY: Record<string, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3 };
export function autoDeck(pool: readonly string[], cap: number): string[] {
  const weight = (id: string) => {
    const d = getDef(id);
    return d.dmg * d.hits + d.hp + d.shields * 2 + d.sp;
  };
  const ranked = [...new Set(pool)].sort((a, b) =>
    getDef(a).cost - getDef(b).cost
    || (AUTO_RARITY[getDef(a).rarity ?? ""] ?? 9) - (AUTO_RARITY[getDef(b).rarity ?? ""] ?? 9)
    || weight(b) - weight(a));
  if (cap <= 0) return [];
  // floor(i * L / cap) is strictly increasing while cap <= L, so the picks are
  // distinct without a dedupe pass.
  return ranked.length <= cap
    ? ranked
    : Array.from({ length: cap }, (_, i) => ranked[Math.floor((i * ranked.length) / cap)]);
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
  // A booster on the house. The campaign opens at rags — one Sakuroot — which
  // is the right shape for the OPENING BATTLE and a poor shape for everything
  // around it: a deck builder with one card in it, a collection reading 1 of
  // 312, and no reason to visit the Shop. Five cards and a guaranteed Epic
  // turns all three into something you can actually use, and it costs the
  // rags-to-riches framing nothing, because the pack is opened by the player
  // rather than handed to them mid-fight.
  //
  // Exactly one pack: the opening deck cap is SIX, and one Sakuroot plus a
  // five-card pack is exactly six.
  freePacks: 1,
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
  // legalSpellIds, not slice: the shelf is every spell the hero has EARNED, and
  // a campaign deep into two regions has earned both of their cost-9s. A plain
  // slice handed that straight to the engine, so the automatic book broke the
  // cost-tier law the deck builder enforces on a hand-picked one.
  return legalSpellIds(chosen.length ? chosen : shelf, spellCapForBoard(boardSize));
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
  if (CARD_INDEX[defId].boss) return { ok: false, reason: "Void Tower bosses cannot be crafted" };
  if (save.collection.includes(defId)) return { ok: false, reason: "Already collected" };
  const el = getDef(defId).element;
  const have = save.hero?.essence[el] ?? 0;
  const cost = craftCostOf(defId);
  if (have < cost) return { ok: false, reason: `Needs ${cost} ${el} essence — you have ${have}` };
  return { ok: true };
}

/** Mark cards as acquired-but-unread. Every path that adds to the collection
 *  goes through here — pack, craft and story recruit — because a fourth path
 *  added later that forgets is a card that is silently never new. */
export function markUnseen(save: StorySave, ids: readonly string[]): StorySave {
  const add = ids.filter((id) => !(save.unseen ?? []).includes(id));
  return add.length ? { ...save, unseen: [...(save.unseen ?? []), ...add] } : save;
}

/** The player opened this card and has now seen it. */
export const markSeen = (save: StorySave, id: string): StorySave =>
  (save.unseen ?? []).includes(id)
    ? { ...save, unseen: (save.unseen ?? []).filter((x) => x !== id) }
    : save;

/** Spend the essence and add the card. Refuses rather than going negative. */
export function craftCard(save: StorySave, defId: string): StorySave {
  if (!canCraft(save, defId).ok) return save;
  const hero = save.hero ?? newHero();
  const el = getDef(defId).element;
  return markUnseen({
    ...save,
    collection: [...save.collection, defId],
    hero: { ...hero, essence: { ...hero.essence, [el]: (hero.essence[el] ?? 0) - craftCostOf(defId) } },
  }, [defId]);
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
/** What a finished match pays.
 *
 *  ONLINE is the outlier and deliberately so. It pays 10 for a win and — alone
 *  among the three — pays for a LOSS as well, at 5. The AI rates are low
 *  because the AI is infinite: a deck you built yourself in the other seat was
 *  two shards a match for as long as you cared to click, and the Gauntlet exists
 *  because that had to stop being the fast way to earn. A human opponent is not
 *  infinite. Somebody has to show up, and the match takes as long as it takes,
 *  so it can afford to be the best rate in the game — a pack in five wins.
 *
 *  Paying the loser is the same argument pushed one step: an online loss that
 *  paid nothing is twenty minutes for nothing, against an opponent who could
 *  simply be better than you, and the thing that gets quit is the mode. Half
 *  price keeps winning worth twice as much without making losing a waste.
 *
 *  STORY 3 -> 5, at the owner's call, alongside the pack dropping to 50: the
 *  campaign is the mode the game wants played, and at 3 a pack was seventeen
 *  nodes. Ten is a run of the map rather than a grind of it. It stays under the
 *  online rate, which is the ordering the whole block argues for — a human
 *  opponent is the scarce thing — and comfortably over the Arena, which is
 *  still the place you go to practise. */
export const SHARDS_PER_WIN = { story: 5, arena: 2, online: 10 } as const;

/** Consolation for an online LOSS. No other mode pays one — see above. */
export const SHARDS_ONLINE_LOSS = 5;

/** What an online match pays the player who just finished it.
 *
 *  Pure and separate from the effect that calls it because it is the money
 *  path, and because the two ways to get it wrong are both invisible from the
 *  UI: paying the wrong seat (the guest sits in P2, so "P1 won" is not "I won")
 *  and paying a concede.
 *
 *  `surrendered` means THIS player surrendered — a concede pays nothing. The
 *  consolation is for showing up and losing a real match; without that rule the
 *  best rate in the game is two people conceding to each other on repeat. */
export const onlineMatchShards = (opts: { won: boolean; surrendered: boolean }): number =>
  opts.won ? SHARDS_PER_WIN.online : opts.surrendered ? 0 : SHARDS_ONLINE_LOSS;

/** What a pack costs, and what it holds. Five cards, one of them Epic or better
 *  — the guarantee is what stops a pack ever feeling like nothing happened.
 *
 *  40 -> 70 -> 50, each at the owner's call. `BOX_COST` is DERIVED from this
 *  (five paid packs), so the box has tracked it every time — 200 -> 350 -> 250
 *  — and the "priced at five packs exactly" promise below still holds without a
 *  second edit, which is the whole reason it was written as a derivation rather
 *  than a second number. `BOX_SAVING` rides the same derivation (now 100). */
export const PACK_COST = 50;

/** The booster BOX: five packs bought, two thrown in, seven opened.
 *
 *  Priced at five packs exactly, so the two bonus packs are the whole offer and
 *  the discount is legible without a percentage: you pay for what it says on
 *  the front and get what it says underneath.
 *
 *  It does NOT open anything. Buying banks seven owed packs and the player tears
 *  them one at a time through the pack flow that already exists — same odds,
 *  same Epic guarantee, same foil roll, same reveal. A box that opened itself in
 *  one burst would need a second copy of all of that, and would take the best
 *  part of the shop away to save seven taps. */
export const BOX_PAID_PACKS = 5;
export const BOX_BONUS_PACKS = 2;
export const BOX_PACKS = BOX_PAID_PACKS + BOX_BONUS_PACKS;
export const BOX_COST = PACK_COST * BOX_PAID_PACKS;
/** What the box saves against buying the same seven packs one at a time. */
export const BOX_SAVING = PACK_COST * BOX_BONUS_PACKS;
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
  const pool = CARDS.filter((c) => !c.boss).map((c) => c.id); // bosses are not pullable
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

/** How many packs are owed for free. */
export const freePacks = (save: StorySave): number => save.hero?.freePacks ?? 0;

/** Would the next pack cost nothing? The single source of truth for BOTH the
 *  charge in `applyPack` and the price the Shop prints, so the button can never
 *  say one thing and the wallet do another. */
export const packIsFree = (save: StorySave): boolean => freePacks(save) > 0;

/** Can a pack be opened right now — bought, or owed? */
export const canOpenPack = (save: StorySave): boolean =>
  packIsFree(save) || (save.hero?.shards ?? 0) >= PACK_COST;

/** Charge for a pack and bank everything it produced.
 *
 *  A free pack is spent FIRST, always. The alternative — shards first, free
 *  packs as a fallback — means a player holding both pays for every pack until
 *  their shards run dry, so the gift only arrives once they are broke and the
 *  balance they were saving quietly evaporates instead. */
/** THE FIRST PACK WALKS STRAIGHT INTO THE SQUAD.
 *
 *  A brand-new player owns one card, opens one pack, and owns six — against a
 *  squad cap of six. The onboarding then sent them to the Squad Builder, which
 *  is a screen for making a CHOICE, to make a choice that does not exist: every
 *  card they own fits, so the only correct action is "take all of them". Walking
 *  the opening as a new player, that step cost four interactions (Build the
 *  squad, Auto-fill, Save, Close) and a full-screen modal, at the exact moment
 *  the player wants to be fighting.
 *
 *  So when the whole collection fits the cap there is nothing to decide and the
 *  cards are simply in. The Squad Builder is then something you go and find when
 *  you have more cards than slots — which is when it starts being interesting —
 *  rather than a toll gate before the first battle.
 *
 *  BOUNDED TO THE OPENING, deliberately. `firstFightWon` closes it: an
 *  established player who happens to own few cards mid-campaign has their own
 *  reasons for the squad they are carrying, and this must never overwrite it. */
function foldIntoSquad(save: StorySave): StorySave {
  // The opening node, derived rather than the literal "L1" that Onboarding.tsx
  // names — and NOT imported from there: that is a UI module and it already
  // imports this one, so reaching back would invert the layering and close a
  // cycle. Structurally it is the first node of the first region either way.
  const opener = REGIONS[0]?.nodes[0]?.id;
  if (!opener || save.cleared.includes(opener)) return save;
  const owned = [...new Set(save.collection)];
  if (owned.length > deckCapFor(save.cleared)) return save;   // a real choice exists
  if (owned.every((id) => save.deck.includes(id))) return save;
  return { ...save, deck: owned };
}

export function applyPack(save: StorySave, result: PackResult): StorySave {
  const hero = save.hero ?? newHero();
  const essence = { ...hero.essence };
  for (const [el, n] of Object.entries(result.refund)) essence[el] = (essence[el] ?? 0) + n;
  const free = hero.freePacks > 0;
  return foldIntoSquad(addShiny(
    markUnseen({
      ...save,
      collection: [...save.collection, ...result.fresh],
      hero: {
        ...hero,
        shards: free ? hero.shards : Math.max(0, hero.shards - PACK_COST),
        freePacks: free ? hero.freePacks - 1 : hero.freePacks,
        essence,
      },
    }, result.fresh),
    result.shiny,
  ));
}

/** Bank free packs. Mints a hero when the save has none, for the same reason
 *  `addShards` does — a reward must never land on the floor. */
export function addFreePacks(save: StorySave, n: number): StorySave {
  if (!n) return save;
  const hero = save.hero ?? newHero();
  return { ...save, hero: { ...hero, freePacks: Math.max(0, hero.freePacks + n) } };
}

/** Can the box be afforded right now? Free packs do NOT pay for a box — they
 *  are the thing it hands out, and spending one to buy seven would be a loop. */
export const canBuyBox = (save: StorySave): boolean =>
  (save.hero?.shards ?? 0) >= BOX_COST;

/** Buy the box: charge for five, bank seven.
 *
 *  Returns the save UNCHANGED when it cannot be afforded rather than granting on
 *  credit — the Shop disables the button, but the guard lives here so the rule
 *  is enforced where the shards actually move. */
export function buyBox(save: StorySave): StorySave {
  if (!canBuyBox(save)) return save;
  const hero = save.hero ?? newHero();
  return addFreePacks(
    { ...save, hero: { ...hero, shards: Math.max(0, hero.shards - BOX_COST) } },
    BOX_PACKS,
  );
}

/** Bank shards. The one place they are added, so a grant that is not a match
 *  win — an event reward, a top-up later — mints a hero the same way a win does
 *  rather than quietly dropping the payment on a save that has none yet. */
export function addShards(save: StorySave, n: number): StorySave {
  if (!n) return save;
  const hero = save.hero ?? newHero();
  return { ...save, hero: { ...hero, shards: Math.max(0, hero.shards + n) } };
}

/** Pay out shards for a win. */
export function awardShards(save: StorySave, kind: keyof typeof SHARDS_PER_WIN): StorySave {
  return addShards(save, SHARDS_PER_WIN[kind]);
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

/** What a set piece never drops below — the ladder's old first rung, kept as a
 *  floor for Landmarks and Thrones. See `capForNode`. */
export const OPENING_LADDER_FLOOR = 12;

export const CAP_LADDER: readonly CapRung[] = [
  // TWO RUNGS BEFORE THE OLD FIRST ONE, because the ladder IS the difficulty
  // curve and it used to open at its second gear.
  //
  // The opener is sized one-for-one against what you can field, so LEAF's first
  // fight was 1-v-2. The very next node took the ladder's 12 against a pool of
  // four: a 3x wall, the worst ratio anywhere in the region, arriving directly
  // after the gentlest fight in the game and easing only as the player caught
  // up. The curve spiked where it should have ramped.
  //
  // Fixing this in `buildFormation` — clamping the fight to the player's pool —
  // is the obvious move and it is WRONG; it was tried, reverted, and pinned by
  // "the fight is sized by the ladder, not by how thin the player travels",
  // because a rule keyed on the pool lets a thin traveller shrink every fight
  // in a region. The ladder is the right place: it already decides how big the
  // campaign's fights are, it is keyed on PROGRESS rather than on what you are
  // carrying, and nothing can farm it.
  //
  // L2 and L4 are LEAF's second and fourth nodes, so the first four fights now
  // run 2 / 6 / 8 / 12 instead of 2 / 12 / 12 / 12.
  { cap: 6, board: 4, unlockedBy: null, label: "First steps" },
  { cap: 8, board: 4, unlockedBy: "L2", label: "Spring Village" },
  { cap: 12, board: 4, unlockedBy: "L4", label: "Starting deck" },
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
  // `>= 5`, not `=== 5`. A gate is fought on the 7x7 now, and an equality test
  // dropped it straight through to STANDARD_CAP -- eighteen cards spread across
  // forty-nine slots, on the biggest board in the game.
  const ceiling = boardForNode(region, node) >= 5 ? BIG_BOARD_CAP : STANDARD_CAP;
  // A SET PIECE IS ALWAYS A FULL FIGHT. The ladder's two opening rungs exist to
  // ramp the first few skirmishes of the campaign (see CAP_LADDER) and a
  // Landmark or a Throne is the opposite of that — the boss has to arrive with
  // its Legendaries and Epics behind it or the guaranteed Mythic is not worth
  // the walk. In practice a Throne is unreachable that early anyway; this makes
  // it true by construction rather than by map layout.
  const floor = BIG_BATTLE_KINDS.includes(node.kind) ? OPENING_LADDER_FLOOR : 0;
  // Ladder and board only. What the PLAYER can actually field is a separate
  // question and belongs to `fightCap`, which is what the enemy, the gates and
  // the prep screen all read — clamping by the squad limit here was wrong once
  // the region's own element started travelling free, because the fieldable
  // pool is then legitimately larger than the squad.
  return Math.min(Math.max(deckCapFor(cleared), floor), ceiling);
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

/** Everything a node actually puts on the board — what you can WIN from it plus
 *  the filler it spawns. Not the same question as `recruitablePool`: the adds
 *  are real opponents you simply cannot recruit, and a screen describing the
 *  fight has to count them.
 *
 *  One expression for every node kind. A Border Gate carries an empty `roster`
 *  and keeps its patrol in `adds`, so this collapses to the patrol there without
 *  needing to ask whether the node is a gate. */
export const fieldedBy = (node: StoryNode): string[] =>
  [...new Set([...recruitablePool(node), ...node.adds])];

// ── board size ──────────────────────────────────────────────────────────────

/** Declared HERE rather than with the other gate helpers below, because
 *  `boardForNode` reads it and both are `const` -- a gate predicate defined
 *  after its own use is a TDZ crash at module load, not a lint nit. */
export const isGate = (n: StoryNode): boolean => n.kind === "gate";

/** Node kinds fought on the LARGE board. Everything else is 4x4.
 *
 *  The campaign is a 4x4 game that opens up for its set pieces: a Landmark or a
 *  Throne is the fight the Act has been building to, and the extra rank and file
 *  of a 5x5 is what makes it feel like one. 33 of the campaign's ~124 nodes are
 *  big, so the large board stays an event rather than the default. */
export const BIG_BATTLE_KINDS: readonly NodeKind[] = ["landmark", "throne"];

/** A Throne's opening is PRE-ORCHESTRATED: this many of its cheapest cards are
 *  dealt first, and the rest of its deck stays shuffled.
 *
 *  A Throne is a region's climax and it was losing seven fights in ten. Part of
 *  that is the draw: gold is tight for the first several rounds, and a boss that
 *  opens with nothing it can afford hands the player the board before the fight
 *  starts. Guaranteeing it can act is not a difficulty knob so much as removing
 *  a coin flip that was never meant to be there.
 *
 *  Deliberately shallow, and the depth is measured rather than guessed. All
 *  seventeen Thrones against Frostkeep, 680 matches per depth:
 *
 *      depth  0 (shuffled)   29.0%
 *      depth  3              52.8%
 *      depth  5              54.1%   <- this
 *      depth 30 (full sort)  48.4%
 *
 *  Sorting the WHOLE deck is worse than stacking five, because it front-loads
 *  every cheap body before anything with weight: BOLT's City Power Core holds
 *  thirteen 1-drops in thirty and a full sort sent it DOWN to 25% from 43%,
 *  while LEAF's Spirit Tree fell to 20% from 45%. At five, every one of the
 *  seventeen improves and none regress. See `restackByCost`.
 *
 *  Landmarks are the other set piece and are left alone for now: they are not
 *  the climax, and there are far more of them. */
export const THRONE_OPENING_STACK = 5;

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
/** A BORDER CROSSING IS A DOMINATION MAP. A gate is not another skirmish with a
 *  composition requirement bolted on -- it is the moment the campaign leaves one
 *  region for the next, and the 7x7 makes it play like one: four Points to
 *  contest instead of a home row to reach, and no capture win at all.
 *
 *  It also puts the mode somewhere other than a menu. Domination shipped as an
 *  arena option, which means most players meet it by choosing it; this makes the
 *  campaign hand it to them seven times, at the exact moments a change of ground
 *  reads as the story rather than as a setting.
 *
 *  The economy is already built for it: DECK_LIMITS[7] is 30 cards and 8 spells,
 *  the same pair the large board uses, so a gate asks for the deck a Landmark
 *  already asks for and no new format appears. `node.board` still overrides, so
 *  a single gate can be pulled back to a duel without touching this. */
export const boardForNode = (region: StoryRegion, node: StoryNode): number =>
  node.board ?? (isGate(node) ? DOMINATION_7X7.boardSize
    : BIG_BATTLE_KINDS.includes(node.kind) ? 5 : region.board);

// ── border gates (§7) ───────────────────────────────────────────────────────


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

/** A card's tribes, whichever shape the field takes. */
const tribesOf = (d: { tribe?: string | string[] }): string[] =>
  d.tribe == null ? [] : Array.isArray(d.tribe) ? d.tribe : [d.tribe];

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
  /** The muster: cards off the nodes you have already BEATEN in this region,
   *  heaviest first. Empty unless the region musters, and empty at its opening
   *  node either way, so it grows with the climb — which is the whole point.
   *
   *  Descending, where `regionPool` ascends. Ordinary filler is padding and
   *  should be the cheap end; this is the region's defeated force arriving
   *  behind its next defender, and it should be the heavy end. Sorting it the
   *  same way would have added cards without adding weight. */
  /** The tribe this fight is OF — the node's declared tribe, else the roster's
   *  dominant one (2+ members). What makes a node a Ghost manor rather than a
   *  rarity band with a ghost in it. */
  const nodeTribe = node.tribe ?? (() => {
    const counts = new Map<string, number>();
    for (const id of uniques)
      for (const tb of tribesOf(getDef(id)))
        counts.set(tb, (counts.get(tb) ?? 0) + 1);
    let best: string | undefined; let bestN = 1;
    for (const [tb, n2] of counts) if (n2 > bestN) { best = tb; bestN = n2; }
    return best;
  })();
  /** Same-tribe cards of a rarity, from the whole REGION, not yet standing.
   *  Filled ahead of `regionPool` at every band, so a Ghost node pads with
   *  ghosts before it reaches for the region's generic cheap end — the roster
   *  is only the recruitable seed, and before this the other ten or twelve
   *  bodies in the fight were whatever was cheapest, which is why a "Spider
   *  Woods" fielded one spider and a crowd of unrelated rank and file.
   *
   *  AFTER the muster, not before: the muster is the region's defeated force
   *  arriving behind its next defender, a difficulty mechanic that was asked
   *  for by name, and a tribe pool ahead of it would starve it of slots. The
   *  fallen legions reinforcing the next bastion reads fine. */
  const tribePool = (r: string) =>
    nodeTribe == null ? [] :
      [...new Set(region.nodes.flatMap((n) => n.roster))]
        .filter((id) => rarity(id) === r && !present.includes(id)
          && tribesOf(getDef(id)).includes(nodeTribe))
        .sort(byCost);
  const musterPool = (r: string) =>
    !region.musters ? [] :
      [...new Set(
        region.nodes.filter((n) => save.cleared.includes(n.id)).flatMap((n) => n.roster),
      )]
        .filter((id) => rarity(id) === r && !present.includes(id))
        .sort((a, b) => getDef(b).cost - getDef(a).cost);

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
  // The muster goes in AHEAD of the ordinary pool at every rarity, so a late
  // node fills with what you beat before it falls back to the region's cheap
  // rank and file. Both are no-ops in a region that does not muster.
  fill(musterPool("legendary"), maxLeg);
  fill(tribePool("legendary"), maxLeg);
  fill(regionPool("legendary"), maxLeg);
  fill(present.filter((id) => rarity(id) === "epic").sort(byCost), maxEpic);
  fill(musterPool("epic"), maxEpic);
  fill(tribePool("epic"), maxEpic);
  fill(regionPool("epic"), maxEpic);
  // Rares are the remainder — no quota, they fill whatever is left.
  fill(present.filter((id) => rarity(id) === "rare").sort(byCost), -1);
  fill(musterPool("rare"), -1);
  fill(tribePool("rare"), -1);
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
  /** The Gauntlet run in progress, and which rungs have been cleared. Lives in
   *  the save rather than in React state precisely so it CANNOT be re-rolled:
   *  leaving the Arena and coming back has to resume the same four opponents. */
  gauntlet?: GauntletState;
  /** Tutorial steps already taught. See `ui/TutorialCoach.tsx`.
   *
   *  In the save because a tutorial that repeats is a nag: these fire once per
   *  PLAYER, not once per fight. "SKIP" is the sentinel for "teach me nothing
   *  else" — a single value rather than the whole list, so adding a sixth step
   *  later does not un-skip everyone who already opted out. */
  taught?: string[];
  /** The matchmaker's win streak. See `data/matchmaker.ts`.
   *
   *  In the save rather than in React state for the same reason the Gauntlet
   *  run is: a streak you can reset by reloading the tab is not a streak. Absent
   *  on every save written before this existed, which reads as zero — the right
   *  answer, since nobody has beaten anything on a ladder that did not exist. */
  ladder?: LadderState;
  /** Cards you own but have not LOOKED at yet — the ones that still wear a
   *  NEW flag in the collection.
   *
   *  Stored as the unseen set rather than the seen one because it shrinks to
   *  nothing: a completed collection carries an empty array here, where a
   *  `seen` list would carry all 312 ids forever. Cleared per card the moment
   *  its detail is opened, so "checked out" means exactly what it looks like.
   *
   *  Absent on every save written before this existed. Those are treated as
   *  ALL SEEN, not all new — retro-flagging a finished collection as three
   *  hundred unread cards is a worse lie than flagging none of them. */
  unseen?: string[];
  /** Event ids already beaten. See `data/events.ts`.
   *
   *  The whole of the event feature's state. An event is available until its id
   *  is in here and gone afterwards, and its reward is paid by the same write
   *  that adds it — so this is also the thing that makes paying twice
   *  impossible. Absent on every save written before events existed, which
   *  correctly reads as "none beaten yet". */
  eventsDone?: string[];
  /** VOID TOWER TAMINGS: boss card id -> battles remaining on it.
   *
   *  Beat an ENRAGED boss (any boss on a floor you have cleared) and it fights
   *  for you three times at half strength. A key is present only while it has
   *  uses left; spending the last one removes it, so `tamed` is also the answer
   *  to "what can I bring".
   *
   *  Deliberately NOT the collection. A tamed boss is a loaner, not a card you
   *  own — it never enters `collection`, is never craftable, packable or
   *  buildable, and the test asserting a boss can be acquired nowhere still
   *  holds. Absent on every save written before taming existed, which correctly
   *  reads as "nothing tamed". */
  tamed?: Record<string, number>;
  /** One-time GIFTS already handed to this save, by id.
   *
   *  A ledger and not a flag per gift: the point is that a gift lands exactly
   *  once for a player who was already here, and never again however many times
   *  the app reloads. A NEW save starts with every past gift marked as given —
   *  it is compensation for something that happened, not a starter bonus. */
  gifts?: string[];
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

/** Mirrors `TAME_USES` in data/void-tower.ts, which cannot be imported here:
 *  void-tower imports DUPLICATE_CAP from this file, so the dependency only
 *  runs one way. A test round-trips a save through `loadStory` and asserts the
 *  clamp lands on `TAME_USES`, so the two cannot drift silently. */
const MAX_TAME_USES = 3;
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
  /** The profile picture: the card id of a Void Tower boss this save has BEATEN,
   *  worn as a trophy. Absent = the hero's initial, which is what every save
   *  before this had and what a player who has cleared no floors still gets.
   *
   *  Stored as an id rather than an image path so it survives an art rename, and
   *  re-validated against the tower on load — see `ownsAvatar` in player.ts. A
   *  head is the one cosmetic in the game that cannot be bought, rolled or
   *  crafted, so it has to be impossible to arrive at by editing a save. */
  avatar?: string;
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
  /** Packs owed to you, openable without paying.
   *
   *  A COUNT rather than shards-worth-of-a-pack, because those are different
   *  promises. Handing over `PACK_COST` shards is spending money, and spent
   *  money is fungible: it drifts into the crafter, it makes the next pack
   *  cheaper rather than free, and if the price ever changes the old gift
   *  silently becomes worth more or less than the pack it was supposed to be.
   *  A free pack is a free pack at any price. */
  freePacks: number;
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

/* Squads used to be listed and ranked from here, out of `save.loadouts`. Both
 * lookups moved to `data/squads.ts` (`squadsFor` / `preferredSquad`) when the
 * campaign's library merged with the Arena's — "which lineup do I offer" is not
 * a question about a save file. `loadouts` survives in the save as a MIGRATION
 * SOURCE only: `absorbLegacy` reads it once, on boot. Nothing writes it. */

/** Whether a team can legally be taken into this fight. Undersized is the only
 *  hard failure — the cap is a ceiling, not a quota, and a player who wants to
 *  fight a Skirmish with twelve good cards instead of eighteen mediocre ones
 *  should be allowed to. */
export function loadoutLegal(cards: string[], cap: number): { ok: boolean; reason?: string } {
  if (cards.length === 0) return { ok: false, reason: "Empty squad" };
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
/** The saved teams EXACTLY as written, with no collection filter.
 *
 *  `loadStory` deliberately trims a team's cards to what you currently own, which
 *  is right for playing — you cannot field what you have not earned — and wrong
 *  for migrating. A team naming a card the save no longer owns comes back from
 *  loadStory with those cards stripped, and if that empties it, dropped entirely.
 *  Reading through it during the one-time merge into the squad library would have
 *  quietly destroyed exactly the lineups the merge promised to keep.
 *
 *  Migration wants the truth on disk; `squadUsableIn` decides fieldability later.
 */
export function rawStoredLoadouts(): Loadout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as Partial<StorySave>;
    return Array.isArray(p.loadouts)
      ? (p.loadouts as Loadout[]).filter(
          (l) => l && typeof l.id === "string" && typeof l.name === "string" && Array.isArray(l.cards),
        )
      : [];
  } catch {
    return [];
  }
}

/** One-time grants, oldest first. Append only — an id that has been shipped
 *  must never be reused or removed, because the ledger below is what stops a
 *  gift landing twice and a recycled id would re-grant it to everyone. */
export const GIFTS: { id: string; apply: (s: StorySave) => StorySave }[] = [
  // ON THE HOUSE. Taming Continental did not hand it over for the players who
  // earned it, so it is given directly. `tameBoss` REFILLS rather than adds, so
  // a player who already has one is topped back up to full rather than
  // double-credited.
  { id: "tame-continental-1", apply: (s) => tameBoss(s, "boss_continental") },
];

/** Hand over anything in `GIFTS` this save has not had yet. Idempotent by the
 *  ledger, so calling it on every load is safe. */
export function applyGifts(save: StorySave): { save: StorySave; granted: string[] } {
  const had = new Set(save.gifts ?? []);
  const granted: string[] = [];
  let out = save;
  for (const g of GIFTS) {
    if (had.has(g.id)) continue;
    out = g.apply(out);
    had.add(g.id);
    granted.push(g.id);
  }
  // Spread, never enumerate — see `tameBoss`. Writing the ledger back on a save
  // that got nothing is harmless and keeps the field present.
  return { save: { ...out, gifts: [...had] }, granted };
}

export function loadStory(): StorySave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // A brand-new player is not "a current player": they start with every past
    // gift already marked given, so compensation for something they never
    // experienced is not also a welcome bonus.
    if (!raw) return { ...newSave(), gifts: GIFTS.map((g) => g.id) };
    const p = JSON.parse(raw) as Partial<StorySave>;
    const known = (ids: unknown): string[] =>
      Array.isArray(ids) ? ids.filter((i): i is string => typeof i === "string" && !!CARD_INDEX[i]) : [];
    const collection = known(p.collection);
    const save: StorySave = {
      cleared: Array.isArray(p.cleared) ? p.cleared.filter((c) => typeof c === "string" && !!nodeById(c)) : [],
      collection: collection.length ? collection : [...STARTER_DECK],
      pity: p.pity && typeof p.pity === "object" ? (p.pity as Record<string, number>) : {},
      // Scoped to what is actually owned: a card refunded, or dropped by a
      // rename, must not sit in the collection wearing a flag for a row that
      // is not there. Absent => [], i.e. an old save reads as all seen.
      unseen: known(p.unseen).filter((id) => collection.includes(id)),
      // Plain strings, deduped. NOT checked against the event list: an id for an
      // event that has been retired must SURVIVE the load, because dropping it
      // would re-open the event and pay its reward again the moment it came
      // back. Unknown ids are inert everywhere else — `completeEvent` looks the
      // event up before it pays — so keeping them costs nothing.
      eventsDone: Array.isArray(p.eventsDone)
        ? [...new Set(p.eventsDone.filter((x): x is string => typeof x === "string"))]
        : [],
      // Tamings. Clamped to 1..TAME_USES on the way in and dropped at 0, so a
      // hand-edited save cannot mint an infinite loaner and a spent entry can
      // never linger as a 0-use ghost in the picker. Keys are NOT checked
      // against the boss list, for the same reason `eventsDone` is not: an id
      // for a boss that was renamed is inert everywhere (`voidBossById` returns
      // null) and costs nothing to keep.
      tamed: p.tamed && typeof p.tamed === "object" && !Array.isArray(p.tamed)
        ? Object.fromEntries(
            Object.entries(p.tamed as Record<string, unknown>)
              .map(([k, v]) => [k, Math.min(MAX_TAME_USES, Math.floor(Number(v) || 0))] as const)
              .filter(([, v]) => v > 0),
          )
        : {},
      // THE GIFT LEDGER, and it has to be read back or the whole mechanism
      // inverts: `applyGifts` treats a missing ledger as "never given", so a
      // loader that forgets this field re-grants every gift on every single
      // load — which for a taming means one that silently refills instead of
      // running down. Caught by a test that spent one and reloaded.
      gifts: Array.isArray(p.gifts)
        ? [...new Set(p.gifts.filter((x): x is string => typeof x === "string"))]
        : undefined,
      // A deck can only hold cards you own — a stale entry silently drops out.
      deck: known(p.deck).filter((id) => collection.includes(id)),
      blight: p.blight && typeof p.blight === "object" ? (p.blight as Record<string, number>) : {},
      // Saved teams are additive: a pre-loadouts save simply has none, and every
      // card is re-checked against the collection so a team cannot smuggle in
      // something that was never recruited.
      // Dropped if it names a team that no longer exists, so a deleted team
      // cannot leave the save pointing at nothing.
      lastTeamId: typeof p.lastTeamId === "string" ? p.lastTeamId : undefined,
      // Restored as written. A malformed run is dropped rather than repaired:
      // half a run is not a thing the rest of the code should have to reason
      // about, and starting a fresh one costs the player nothing.
      gauntlet: (() => {
        const g = p.gauntlet as GauntletState | undefined;
        if (!g || typeof g !== "object") return undefined;
        const run = g.run;
        const ok = run && Array.isArray(run.seats) && run.seats.every((x) => typeof x === "string")
          && typeof run.won === "number" && run.won >= 0 && run.won <= run.seats.length
          && DECK_TIERS.includes(run.tier);
        return {
          // `board` decides the PAYOUT, so a junk value would pay the wrong
          // rate; anything that is not 4 or 5 is dropped and `boardOfRun`
          // falls back to reading the seat ids.
          run: ok
            // 7 included, or a Domination run came back from storage with its
            // board erased, fell through `boardOfRun` to the seat-id sniff, read
            // as a 5x5 and paid the 5x5 rate for a 7x7 clear.
            ? { ...run, board: [4, 5, 7].includes(run.board as number) ? run.board : undefined }
            : undefined,
          cleared: Array.isArray(g.cleared) ? g.cleared.filter((t) => DECK_TIERS.includes(t)) : [],
        };
      })(),
      taught: Array.isArray(p.taught) ? p.taught.filter((x) => typeof x === "string") : undefined,
      // Two non-negative integers or nothing. A junk streak would pick the rung
      // the matchmaker seats, so a hand-edited save could deal itself elite
      // decks — which is allowed (it is a local save) but must not crash the
      // rung lookup, and `best` must never read below `streak`.
      ladder: (() => {
        const l = p.ladder as LadderState | undefined;
        if (!l || typeof l !== "object") return undefined;
        const streak = Number.isFinite(l.streak) ? Math.max(0, Math.floor(l.streak)) : 0;
        const best = Number.isFinite(l.best) ? Math.max(0, Math.floor(l.best)) : 0;
        return { streak, best: Math.max(best, streak) };
      })(),
      loadouts: Array.isArray(p.loadouts)
        ? (p.loadouts as Loadout[])
            .filter((l) => l && typeof l.id === "string" && typeof l.name === "string")
            .map((l) => ({
              id: l.id,
              name: l.name,
              element: typeof l.element === "string" ? l.element : undefined,
              cards: known(l.cards).filter((id) => collection.includes(id)),
              // A book naming a spell that no longer exists must not reach the
              // engine; an absent one keeps meaning "use the shelf". Trimmed
              // by the shared cost-tier law, NOT by a local loop and not by a
              // flat `new Set` (which quietly threw away the player's second
              // copy of a cheap spell every time the save was reopened).
              //
              // No SIZE cap here on purpose: the shelf is trimmed to the
              // board's allowance later, in `heroBookFor`, and a save should
              // keep everything the player legally owns.
              spells: Array.isArray(l.spells)
                ? legalSpellIds(l.spells, Infinity)
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
          // Same coercion as shards, and absent reads as none — a save written
          // before free packs existed is owed nothing, which is correct.
          freePacks:
            typeof h.freePacks === "number" && Number.isFinite(h.freePacks) && h.freePacks > 0
              ? Math.floor(h.freePacks)
              : 0,
          shiny: Array.isArray(h.shiny)
            ? [...new Set(h.shiny.filter((x): x is string => typeof x === "string" && !!CARD_INDEX[x]))]
            : [],
          // Kept only if it names a real card. Whether the player has EARNED it
          // is a second question and deliberately not asked here: this module
          // cannot see the tower (void-tower.ts imports this one), so ownership
          // is enforced by `activeAvatar` at the point of use, which re-checks
          // it on every render rather than trusting what was written to disk.
          avatar: typeof h.avatar === "string" && CARD_INDEX[h.avatar] ? h.avatar : undefined,
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
    // GIFTS, last: an existing save gets anything it has not had yet, and the
    // ledger is written back IMMEDIATELY. Without that write the gift is
    // re-granted on every single load until something else happens to save —
    // harmless for a refill, but it would mean a taming that never runs down.
    const gifted = applyGifts(save);
    if (gifted.granted.length) saveStory(gifted.save);
    return gifted.save;
  } catch {
    return newSave();
  }
}

/** Record a taming: the boss fights for the player for the next MAX_TAME_USES
 *  battles. Beating an already-tamed boss REFILLS rather than adding, so a
 *  stable cannot be stockpiled past three and running one dry is a setback
 *  rather than a dead end.
 *
 *  Spreads the save (see the applyClear bug in CLAUDE.md — a writer that
 *  enumerates fields silently wipes every field it forgot). */
export function tameBoss(save: StorySave, cardId: string): StorySave {
  return { ...save, tamed: { ...(save.tamed ?? {}), [cardId]: MAX_TAME_USES } };
}

/** Spend one battle of a taming. Called when the player ENTERS a fight with it,
 *  win or lose. The key is deleted at zero rather than left as a 0, so `tamed`
 *  is directly the list of what can still be brought. */
export function spendTame(save: StorySave, cardId: string): StorySave {
  const left = Math.floor(save.tamed?.[cardId] ?? 0) - 1;
  const next = { ...(save.tamed ?? {}) };
  if (left > 0) next[cardId] = left;
  else delete next[cardId];
  return { ...save, tamed: next };
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

  /** Foils roll on cards you ALREADY OWN, at the same 1 in 100 a pack uses.
   *
   *  They used to roll only on `won`, so a foil was available exactly once per
   *  card — the clear that first handed it over — and a node whose roster you
   *  had finished could never produce one again. That is the opposite of how
   *  the Shop works: `openPack` rolls every card it pulls, duplicates included,
   *  and skips only what you already hold in foil. Story had no way to chase a
   *  shiny at all, which made the rarest thing in the game unfarmable.
   *
   *  Skips anything already held in foil for the same reason `openPack` does —
   *  a second shiny of the same card is nothing — and cannot pick the same card
   *  twice in one clear. */
  const heldFoil = new Set(save.hero?.shiny ?? []);
  const foilable = recruitablePool(node)
    .filter((id) => save.collection.includes(id) && !heldFoil.has(id));
  function dupeFoils(exclude: readonly string[]): string[] {
    const pool = foilable.filter((id) => !exclude.includes(id));
    const out: string[] = [];
    for (let i = 0; i < rolls && pool.length; i++) {
      const pick = pool[Math.floor(rand() * pool.length) % pool.length];
      pool.splice(pool.indexOf(pick), 1);
      if (rollShiny(rand)) out.push(pick);
    }
    return out;
  }

  // The opening battle pays out in full, no dice. Checked BEFORE the empty-pool
  // return below, because the region's Epic is not in the recruitable pool — it
  // lives on a node deeper in — and an opener whose Rares are already owned
  // would otherwise hand over nothing at all.
  const openingRegion = regionOfNode(node.id);
  if (openingRegion && isOpeningNode(openingRegion, node)) {
    const opened = guaranteedDrops(openingRegion, node).filter((id) => !save.collection.includes(id));
    return {
      won: opened, missed: [], rolls,
      shiny: [...opened.filter(() => rollShiny(rand)), ...dupeFoils(opened)],
    };
  }
  // A finished node still rolls — that is the whole point of the change above.
  if (!eligible.length) return { won, missed, rolls, shiny: dupeFoils([]) };

  // A Throne's Mythic is a guaranteed recruit on first clear: no RNG on a
  // story-critical unlock.
  if (node.kind === "throne" && !isCleared(save, node.id)) {
    return {
      won: [...eligible], missed, rolls,
      shiny: [...eligible.filter(() => rollShiny(rand)), ...dupeFoils(eligible)],
    };
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
  return {
    won, missed, rolls,
    shiny: [...won.filter(() => rollShiny(rand)), ...dupeFoils(won)],
  };
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
    // SPREAD, and this is not a style choice. This object used to be written
    // out field by field — cleared, collection, pity, deck, blight — which
    // silently DELETED everything else on the save every time a node was
    // beaten: the hero (name, shards, essence, foils, chosen spells), every
    // saved team, `lastTeamId`, the per-region decks and squads. Shards not
    // surviving a campaign was the reported symptom; it was wiping the wallet,
    // the collection's foils and the teams along with them. Anything added to
    // StorySave from here on is kept by default rather than lost by omission.
    ...save,
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
  // Recruits are new until looked at, same as a pack pull or a conjure.
  const flagged = markUnseen(paid, result.won.filter((id) => !save.collection.includes(id)));
  return advanceBlight(pushBackBlight(addShiny(flagged, result.shiny), node), node);
}

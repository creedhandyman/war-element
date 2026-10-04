/**
 * AQUA card & spell lore.
 *
 * Keyed by card id, merged onto CardDef.lore / SpellDef.lore at load — see
 * ./index.ts.
 *
 * Note `aqua_icewall` (the Tank card) and `aqua_ice_wall` (the Cost-4 spell) share
 * a NAME but not an id, so both key plainly — no `spell:` prefix needed here.
 *
 * VOICE RULES — AQUA
 *   1. AQUA decides. It does not react — it chooses a shape and you deal with the
 *      shape. Lines imply *chosen*, *permitted*, *before you*. (LEAF: later.
 *      PYRO: now. GALE: already. DUSK: still. BOLT: solved.)
 *   2. Deep time. It was the Life Source before there were eight elements to
 *      sustain, and it does not measure itself against the other seven.
 *   3. Mechanic-tied: the line should telegraph what the card does before the box
 *      is read.
 *   4. THREE cultures, and the kit shows all three — the pirate lanes (no crown,
 *      no council), the Ice Kingdom (a genealogy, not a title), and the Deep under
 *      Atlantis. Attribute only where the kit leans one.
 *   5. 1-2 sentences. Under ~150 chars where possible — card frames are small.
 *   6. Never eager. AQUA grants and withholds; it permits rather than attacks.
 *
 * Coverage: 48 cards (bosses included) + 2 tokens + 10 spells = 60 entries, which is all of AQUA.
 */

export const AQUA_LORE: Record<string, string> = {
  // ---------------------------------------------------------------- MYTHIC

  aqua_hydrogon:
    "A serpent of steam, out of reach of melee. It picks one target for the beam and scalds everyone standing beside it.",

  aqua_kraken:
    "The Deep decides to surface: a black wave blinds everything near it, at a cost in its own blood. Wound it badly and it hits harder.",

  // ------------------------------------------------------------- LEGENDARY

  aqua_phrost:
    "A frost dragon. It freezes you in place, then scalds whatever it has frozen, every round.",

  aqua_polarking: // Polar King
    "The Ice Kingdom's king. Strike him and you may freeze; his word freezes three foes anywhere and armours his own side.",

  aqua_rain: // Cloudburst
    "It does not aim at one. Rain falls on whatever stands near what it aimed at, and it teaches the whole crew to do the same.",

  aqua_driftwraith:
    "A drowned pirate in the boneyard fog. Unseen until it strikes, then fourteen straight through armour, and the fog covers its retreat.",

  aqua_magalogoon:
    "A swamp monster, untargetable while it sits still. It drags one foe out of its row, hits it for ten, and roots it in the bog.",

  aqua_glacius:
    "It freezes three foes under the ice and scalds them while they are held. Its shots can armour its own side instead.",

  aqua_siren:
    "Strike the singer and you freeze. She can become a Krakler; kill that, and the Siren returns at full health.",

  // ------------------------------------------------------------------ EPIC

  aqua_owlette:
    "An owl on the wing. Each round it freezes the weakest foe, and Owl Hail freezes three at once.",

  aqua_octoirate:
    "A pirate octopus. Its tentacles reel struck foes in close, and Wave Crash hits the three ahead.",

  aqua_bahari:
    "It does not pick a target. Tsunami hits every opponent for six and leaves them slow for the round.",

  aqua_icynin: // Coilblade
    "It freezes first, then strikes the ice. Whatever was standing beside you gets the pieces.",

  aqua_blackice:
    "It fights with its own armour. Strip that away and there is nothing left to be hit with.",

  aqua_polarbear: // PolarBear
    "A polar bear that tramples into your square and drives you back, then claws you frozen.",

  aqua_anos: // Serenos
    "It is stronger for the rounds it chooses not to fight. Most nations have no word for that.",

  aqua_cryo:
    "It works best on what has already stopped, and it makes the stopping last twice as long.",

  aqua_liquark:
    "It is at its best unseen, so it surfaces only for the weakest thing on the board — and goes straight back down.",

  aqua_blackbeard: // BlackBeard
    "Captain of the pirate lanes. His cannon reaches anywhere on the board, scalding three foes; each kill makes him hit harder.",

  aqua_sapphire:
    "A sapphire dragon that opens a geyser under two foes, scalding them, and grows faster and fiercer with every kill.",

  aqua_vaporem:
    "Five small breaths, and armour is no use against any of them. Whoever is left cannot see well enough to answer.",

  aqua_icewall: // Ice Wall — the card; the Cost-4 spell is aqua_ice_wall
    "A wall of ice that shoots back. Every hit on it lands two points lighter, and its shots can freeze you where you stand.",

  // ------------------------------------------------------------------ RARE

  aqua_subcool: // SubCool
    "Cheap, cold, and even odds you lose the round.",

  aqua_misty:
    "It rolls in once and takes a quarter of everything aimed at your side. Nothing to cleanse — it is only weather.",

  aqua_piranha:
    "One is nothing. They do not arrive as one, and the water is already red.",

  aqua_anglerfish:
    "The lamp is bait. The nearest foe is struck and frightened for a round.",

  aqua_buccaneers: // Saltjacks
    "Pirates boarding as a pack: the moment they land, every enemy in their column takes 2.",

  aqua_blub: // Dewling
    "Six points of water. Take all six and it will simply be full again next round.",

  aqua_bulletshrimp: // Bullet Shrimp
    "Eight points of pressure behind one point of shrimp. Where it lands, the water goes still for a round.",

  aqua_icyninza: // Frostveil
    "A ninja in frost. It strikes the moment it arrives, and its shots can crit for double against unarmoured foes.",

  aqua_kinguin:
    "It does not travel without its two. Nobody has asked the two whether they agreed to this.",

  aqua_bootlegger:
    "It only turns a profit on the far side of the lane, so that is the side it walks onto.",

  aqua_arctik:
    "A quarter of the time it costs you the round. The Ice Kingdom calls that a fair rate for a conscript.",

  aqua_harp:
    "The hook is the point. Where you were standing was never going to be where you stayed.",

  aqua_spinefin:
    "Steaming spines: every hit leaves a scald that keeps burning for two rounds.",

  aqua_coralgolem: // Coral Golem
    "A living reef. It adds a shield every round, and anything that hits it in melee gets spurred for 2.",

  aqua_krakler:
    "A smaller piece of something much larger. It arrives cold and burning at the same time.",

  aqua_tide:
    "It comes in with the tide and the whole crew is better for it. When it tucks up, it stops pretending to aim.",

  aqua_siphon:
    "It holds one turn of the tide back, then washes the whole crew clean at once. Once a game, it also hits the row beside it.",

  // ---------------------------------------------------------------- TOKENS

  aqua_guin_tok: // Guin
    "Two of them, always, and never their own idea. They stand where Kinguin puts them.",

  // ---------------------------------------------------------------- SPELLS

  aqua_chill:
    "The water is asked which it would rather do today. It has never minded either answer.",

  aqua_frost_patch:
    "One row, one round, standing still.",

  aqua_steam_vent:
    "Four damage to anything, and it scalds too if the cold got there first.",

  aqua_ice_wall:
    "Three rounds of ice across a row. Fly it or shoot over it; walking in costs you the round.",

  aqua_dense_fog:
    "A fog over the field for three rounds: a quarter of enemy attacks miss.",

  aqua_downpour:
    "Armour every round — and every round the water is asked again what shape it would like to be.",

  aqua_pressure_crush:
    "At that depth the plate is a formality, and so is moving.",

  aqua_glacial_wave:
    "Two rows held for two rounds, and yours come out of it wearing more than they went in with.",

  aqua_maelstrom:
    "Eight to everybody. Sixteen to whatever was already too cold to move.",

  aqua_tsunami:
    "The Life Source, briefly reminded of what it is. Afterwards your side is armoured every round, for good.",

  aqua_killerwhale:
    "A killer whale that breaches into play and freezes the row ahead, then hits what it froze harder.",

  // ── Void Tower bosses ──
  boss_permafrost: "A glacier older than the war. Hits barely scratch it, and every third round it freezes everyone nearly dead.",
  boss_hoarfell: "It tramples into your square, and every third round an aurora blinds and batters everything within two spaces.",

  boss_cryovex:
    "A frost dragon whose bite freezes. The longer you are held the harder it hits, and every third round its cold reaches everyone near.",

  aqua_blackice_crystal_tok:
    "It grows where something stopped moving.",

  // -- the forty-card pass --
  aqua_bluewhale:
    "Immovable and thick-skinned: nothing pushes it, and every hit lands two lighter. Its Breach surfaces under any foe and shoves it back.",
  aqua_divebill:
    "It picked the spot from four hundred feet and did not adjust.",
  aqua_firefighter:
    "She puts the fire out: heals every ally and strips their burns and other ailments, and her hose shoves foes back.",
  aqua_surferdude:
    "Kauai sends a wave down the row ahead, shoving foes back 2 and lifting his crew, then rides forward on it.",
  aqua_sonarping:
    "One ping out, one back. Whatever is hiding is now a number on a page.",
};

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
 * Coverage: 39 cards + 1 token + 10 spells = 50 entries, which is all of AQUA.
 */

export const AQUA_LORE: Record<string, string> = {
  // ---------------------------------------------------------------- MYTHIC

  aqua_hydrogon:
    "The serpent does not end anywhere in particular. Every coil it closes finds the next weakest thing without being asked.",

  aqua_kraken:
    "Whether the Deep is a place or an animal, this is the part that surfaces. It is at its worst after you have hurt it.",

  // ------------------------------------------------------------- LEGENDARY

  aqua_phrost:
    "Ice first, and then the burning. Held still long enough, the cold stops being the part that hurts.",

  aqua_polarking: // Polar King
    "Descendants of the frozen deep is not a poetic title in his court. It is a genealogy, and touching him proves it.",

  aqua_rain: // Cloudburst
    "It does not aim at one. Rain falls on whatever stands near what it aimed at, and it teaches the whole crew to do the same.",

  aqua_driftwraith:
    "The boneyard fog has never lifted for a living sailor. Whatever it takes in there, it goes back into the fog afterwards.",

  aqua_magalogoon:
    "It is only there when it decides to be. Whatever it reaches for does not walk properly again.",

  aqua_glacius:
    "It closes the water over you and waits. The cold is patient, and it is not the only thing working.",

  aqua_siren:
    "The song is the smaller half. What answers it can be killed — and then the singer is simply back, unhurt.",

  // ------------------------------------------------------------------ EPIC

  aqua_owlette:
    "Each round it picks the one least able to argue, and that one stops moving.",

  aqua_octoirate:
    "It does not close the distance. It takes hold of you and shortens it on your behalf.",

  aqua_bahari:
    "Every hit it lands comes back to it as water. It can afford to keep going for longer than you can.",

  aqua_icynin: // Coilblade
    "It freezes first, then strikes the ice. Whatever was standing beside you gets the pieces.",

  aqua_blackice:
    "It fights with its own armour. Strip that away and there is nothing left to be hit with.",

  aqua_polarbear: // PolarBear
    "Two claws, and the only question is whether one of you loses two rounds or one of you loses four.",

  aqua_anos: // Serenos
    "It is stronger for the rounds it chooses not to fight. Most nations have no word for that.",

  aqua_cryo:
    "It works best on what has already stopped, and it makes the stopping last twice as long.",

  aqua_liquark:
    "It is at its best unseen, so it surfaces only for the weakest thing on the board — and goes straight back down.",

  aqua_blackbeard: // BlackBeard
    "No crown, no council, and a cannon that reaches the whole lane. Every prize taken makes the next shot heavier.",

  aqua_sapphire:
    "It opens the vent and lets the pressure do the rest. It leaves a little quicker each time.",

  aqua_vaporem:
    "Five small breaths, and armour is no use against any of them. Whoever is left cannot see well enough to answer.",

  aqua_icewall: // Ice Wall — the card; the Cost-4 spell is aqua_ice_wall
    "A wall that shoots back. Everything that reaches it arrives two points lighter, and often stops there.",

  // ------------------------------------------------------------------ RARE

  aqua_subcool: // SubCool
    "Cheap, cold, and even odds you lose the round.",

  aqua_misty:
    "It rolls in once and takes half of everything aimed at your side. Nothing to cleanse — it is only weather.",

  aqua_piranha:
    "One is nothing. They do not arrive as one, and the water is already red.",

  aqua_anglerfish:
    "The light is the invitation. Aim at it and you find your aim was the thing being played with.",

  aqua_buccaneers: // Saltjacks
    "They come over the rail together, and everybody on deck gets something.",

  aqua_blub: // Dewling
    "Six points of water. Take all six and it will simply be full again next round.",

  aqua_bulletshrimp: // Bullet Shrimp
    "Twelve points of pressure behind one point of shrimp. It only needs the shot to land once.",

  aqua_icyninza: // Frostveil
    "It is already aiming when it arrives. Sometimes that is the whole engagement.",

  aqua_kinguin:
    "It does not travel without its two. Nobody has asked the two whether they agreed to this.",

  aqua_bootlegger:
    "It only turns a profit on the far side of the lane, so that is the side it walks onto.",

  aqua_arctik:
    "A quarter of the time it costs you the round. The Ice Kingdom calls that a fair rate for a conscript.",

  aqua_harp:
    "The hook is the point. Where you were standing was never going to be where you stayed.",

  aqua_spinefin:
    "The spines are not the injury. What they leave in the water is.",

  aqua_coralgolem: // Coral Golem
    "It grows all battle and never once moves. Taking hold of it is its own answer.",

  aqua_krakler:
    "A smaller piece of something much larger. It arrives cold and burning at the same time.",

  aqua_tide:
    "It comes in with the tide and the whole crew is better for it. When it tucks up, it stops pretending to aim.",

  aqua_siphon:
    "It holds one turn of the water back until the entire crew needs washing clean at once.",

  // ---------------------------------------------------------------- TOKENS

  aqua_guin_tok: // Guin
    "Two of them, always, and never their own idea. They stand where Kinguin puts them.",

  // ---------------------------------------------------------------- SPELLS

  aqua_chill:
    "The water is asked which it would rather do today. It has never minded either answer.",

  aqua_frost_patch:
    "One row, one round, standing still.",

  aqua_steam_vent:
    "Four points on anything — and twice the trouble if the cold got there first.",

  aqua_ice_wall:
    "Three rounds of ice across a row. Fly it or shoot over it; walking in costs you the round.",

  aqua_dense_fog:
    "It does not favour you. It simply makes everything aimed your way less certain of itself.",

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
    "The water goes still before it does. That is the part to notice.",

  // ── Void Tower bosses ──
  boss_permafrost: "The wall was here before the war, and it has heard your plan to crack it.",
  boss_hoarfell: "Every step is louder than the last. That is not a warning, it is a count.",

  boss_cryovex:
    "It does not hunt. It waits, and the cold does the walking.",

  aqua_blackice_crystal_tok:
    "It grows where something stopped moving.",

  // -- the forty-card pass --
  aqua_bluewhale:
    "It chose this depth. Nothing that arrives here changes that.",
  aqua_divebill:
    "It picked the spot from four hundred feet and did not adjust.",
  aqua_firefighter:
    "The fire had terms. She declined them.",
  aqua_surferdude:
    "He read the set before it formed. Everything after that was paddling.",
  aqua_sonarping:
    "One ping out, one back. Whatever is hiding is now a number on a page.",
};

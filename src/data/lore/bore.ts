/**
 * BORE card & spell lore — the eighth and last element.
 *
 * Keyed by card id, merged onto CardDef.lore / SpellDef.lore at load — see
 * ./index.ts.
 *
 * VOICE RULES — BORE
 *   1. BORE is not in a hurry and does not need to be. Lines imply *eventually*,
 *      *unhurried*, *still here*.
 *   2. NOT LEAF's patience — the distinction the whole element turns on. LEAF
 *      watches, and waits for you. BORE has not looked up. It holds no opinion
 *      about you and offers none.
 *   3. Understated to the point of dryness. It never proves anything and never
 *      makes a claim it would then have to defend.
 *   4. Mechanic-tied: the line should telegraph what the card does before the box
 *      is read.
 *   5. Attribution (the Black Smith's forges, the Stone Guardians, the Diamond
 *      Kingdom, the Worm, the Titans, the deeper hum) only where the kit leans
 *      one.
 *   6. 1-2 sentences. Under ~150 chars where possible — card frames are small.
 *   7. ONE crack, used twice at most: nobody in the Fortress will say more about
 *      the Titans than "not yet disturbed", and nobody has explained the hum.
 *
 * Coverage: 39 cards + 0 tokens + 10 spells = 49 entries, which is all of BORE.
 */

export const BORE_LORE: Record<string, string> = {
  // ---------------------------------------------------------------- MYTHIC

  bore_the_coreborer: // The Coreborer
    "It does not go around the mountain, and it does not go around you. The hole it leaves is the same width either way.",

  bore_deepest: // The Deepest
    "Blind, and it has never needed the eyes. Stand still and it does not know you are there; the ground tells it everything else.",

  // ------------------------------------------------------------- LEGENDARY

  bore_sandman: // Dunewraith
    "It puts you under and then keeps working, quietly — nothing it does is ever loud enough to wake you.",

  bore_prism:
    "The Black Smith's forges send it out already loaded. When it falls, whoever hits hardest inherits the charge.",

  bore_diam: // Adamant
    "The Diamond Kingdom's answer to a loss is not grief. It is another layer on whoever is left worst off.",

  bore_score: // Venomarch
    "Touch it and you sleep. Kill it and you keep the poison. Neither outcome was ever in your hands.",

  bore_bearocks:
    "Nothing takes hold of it, and killing it only puts it down for a season. It wakes at twenty-four and carries on.",

  bore_bastion:
    "It armours up every round, and is better off the first time you get through. Patience is not on your side here.",

  bore_steel: // Ironclad
    "It takes the plate off the row in front and wears it. Nothing sticks to it, and the armour keeps accumulating.",

  // ------------------------------------------------------------------ EPIC

  bore_shift:
    "A tremor with no particular target. Everything standing feels the same amount of it.",

  bore_valcana:
    "It builds pressure with every hit and spends all of it at once. Afterwards it starts again from nothing.",

  bore_krysteel:
    "Grown, not forged. Nothing the other nations throw finds anywhere on it to settle.",

  bore_rhe: // Rhyolite
    "Half of everything shot at it simply does not arrive. It has never commented on which half.",

  bore_rollo: // Rumbler
    "Every swing carries it one slot further in. It has no plan for stopping and has never been asked for one.",

  bore_monger:
    "It throws five and does not much mind which land. Whatever misses comes back as armour.",

  bore_sheish: // Kimberlite
    "Armour is what it is for. It doubles against anything wearing plate, and keeps whatever it breaks off.",

  bore_lithara:
    "It rings once each time it works, and the ringing settles on it as another layer.",

  bore_obsidi: // Obsidian
    "Underground it moves quickly, which is the only place it does. What comes back up is not the size that went down.",

  bore_rohojohn: // Cragrider
    "The mount does its own mauling. Whatever stands beside your target does not get to watch.",

  bore_bolder:
    "Hurt it and it hands the exact amount back, through the plate. Archers and knives get half a say.",

  bore_gemaga: // Magnetite
    "It returns what it is given, and teaches the line beside it to do the same.",

  // ------------------------------------------------------------------ RARE

  bore_hillbilly:
    "It watches the others take theirs, then hands out a plate afterwards. Once each.",

  bore_cavedweller: // CaveDweller
    "It has lived in the dark long enough to prefer everyone else asleep.",

  bore_crock:
    "Five points, and it does not much matter which direction they travel.",

  bore_kcor: // Pebble
    "Five rocks, thrown without aiming. Some of them arrive.",

  bore_iron:
    "It arrives with plate for the neighbours, and keeps three for itself.",

  bore_cosmic:
    "Killing it settles nothing. What it called is already on its way, and it takes a round to arrive.",

  bore_clubber:
    "A club, and a habit of returning one point of whatever it is handed.",

  bore_smith:
    "The Black Smith's forges do not hurry, and nothing that leaves them is thin.",

  bore_rockgoblin: // Rock Goblin
    "It guards the entrance. Anything arriving is given four points of welcome.",

  bore_old_timer: // Old Timer
    "Slow, and mending faster than most things can open it. It has outlasted several people who found that funny.",

  bore_sling:
    "Plate is not cover, only a delay. It has been putting stones through gaps its whole life.",

  bore_thorny_ripper: // Thorny Ripper
    "The first swing takes the wrong head. Only the first, and only a swing — a Special knows better.",

  bore_armadillo: // Granite Armadillo
    "One point of damage and no interest in dealing it. Everything that reaches it arrives two lighter.",

  bore_warthog:
    "It does not deploy so much as commit — two slots in before anyone has agreed to the engagement.",

  bore_ufo: // UFO
    "Nobody in the Fortress has explained it, and nobody has managed to bring it down. It hums, and the plate does not help.",

  bore_rock: // Slugger
    "It hits until something stops standing, and roughly a third of the time it hits them asleep.",

  bore_stone:
    "It will change places with whoever needs the spot more. Once, and it does not discuss the arrangement.",

  bore_ankylosaur: // Granite Ankylosaur
    "A tail like a dropped boulder. Even odds that whatever it lands on wakes up two rounds later.",

  // ---------------------------------------------------------------- SPELLS

  bore_pebble_toss:
    "Three points at them, one plate for you. Nothing about it is clever.",

  bore_sand_trap:
    "One row, one round, face down in the sand.",

  bore_bulwark:
    "Three more plates on whoever is going to need them.",

  bore_stone_wall:
    "A wall across your OWN home row — BORE builds inward. Yours stand behind it, taking less.",

  bore_fortify:
    "Everybody gets two. The Fortress does not distinguish between the front and the back.",

  bore_bedrock:
    "Standing on bedrock, everything of yours takes less and gives some of it back.",

  bore_shatterpoint:
    "Twelve points, straight through. Every stone has one place where it comes apart.",

  bore_landslide:
    "Two rows asleep, and yours come out of it wearing more than they went in with.",

  bore_tremor:
    "Eight to everybody. Sixteen to whoever turned up without armour.",

  bore_mountains_fall:
    "The mountain, arriving all at once. Afterwards your side puts on another plate every round, for as long as it takes.",

  bore_kobra:
    "You are not bitten where you were looking.",

  bore_kingcobra_tok:
    "The second one was always there. You were busy.",

  boss_vulcanyx:
    "The mountain did not erupt. It got hungry.",
};

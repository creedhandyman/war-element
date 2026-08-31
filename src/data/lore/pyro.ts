/**
 * PYRO card & spell lore.
 *
 * Keyed by card id, merged onto CardDef.lore / SpellDef.lore at load — see
 * ./index.ts.
 *
 * VOICE RULES — PYRO
 *   1. PYRO states its terms. It does not imply, and it does not wait. (LEAF
 *      observes; PYRO announces.)
 *   2. The threat is escalation, not time. Lines point at *hotter*, *again*,
 *      *now* — where LEAF's point at *later*.
 *   3. Mechanic-tied: the line should telegraph what the card does before the box
 *      is read.
 *   4. Faction attribution (the Forged / the Knights / the Spire / the pirate
 *      lanes) only where the kit leans one.
 *   5. 1-2 sentences. Under ~150 chars where possible — card frames are small.
 *   6. Cost is never mourned. PYRO spends its own HP and calls the price fair.
 *
 * Coverage: 39 cards + 0 tokens + 10 spells = 49 entries, which is all of PYRO.
 */

export const PYRO_LORE: Record<string, string> = {
  // ---------------------------------------------------------------- MYTHIC

  pyro_nitro:
    "The Forge Core's finest formula and its least stable. Kill him and the experiment simply completes without him.",

  pyro_pyrogon:
    "Every forge-fire in the city was lit from him, however many generations removed. He arrives already burning, and grows on what he kills.",

  // ------------------------------------------------------------- LEGENDARY

  pyro_sol:
    "The first hit is a courtesy. Every one after it is an argument, and the argument gets louder.",

  pyro_aftermath:
    "He arrives with the blast still settling, and what settles is cover. The Knights learned to advance behind him.",

  pyro_dynomight:
    "The Forged built him to open armour. Plate, shields, or a Tank's ribs — he was told those are the same problem.",

  pyro_volcanon:
    "It pays two of its own HP for every eruption and has never once counted the cost. It only counts what it has learned to hit harder.",

  pyro_magmaw:
    "It does not stop when the target drops. The swing is already moving, and there is always something else standing.",

  pyro_magmadon:
    "It burns its own body for the heat, and asks the whole district to do the same. Only ice or roots have ever made it stop.",

  pyro_infernus_rex:
    "It does not hold a line. It picks a direction, and the ground it crossed is still burning behind it.",

  // ------------------------------------------------------------------ EPIC

  pyro_firebird:
    "Eight points of health and a full tank. It spends three to hit harder, and the last of them on the way down.",

  pyro_scorch:
    "It does not fight the front line. It sets fire to the ground the reinforcements have to stand on.",

  pyro_woof:
    "It only eats what is already cooking. So it makes very sure that everything is.",

  pyro_scully: // Scallywag
    "The pirate lanes pay by the head, and she charges extra for showing off. Use a Special near her and it costs you.",

  pyro_liza:
    "She never lights anything herself. She finds what is already burning and tells it to take its time.",

  pyro_tiki:
    "Planted, spinning, and permanently too close. Standing in front of it costs a point a round, indefinitely.",

  pyro_sarra:
    "Blue flame burns cleaner and closes nothing. Whatever her fire opens, nobody is putting back.",

  pyro_fenix:
    "Kill it and it stands up with one point left and nothing else to lose. The second life is the dangerous one.",

  pyro_sseerr: // Emberclaw
    "Young, quick, and worse every other round. The Dragons let it hunt early so it learns while it is still small.",

  pyro_fenrir:
    "Three bloodlines, one appetite. Every throat it closes teaches it to open two at once.",

  pyro_twins:
    "Two tempers, one body, and a shared limit: hurt them enough and they start arguing instead of swinging.",

  pyro_firefly:
    "It does not aim. It scatters — and a kill only convinces it to do the whole thing again, from the air.",

  // ------------------------------------------------------------------ RARE

  pyro_smog_card: // Smog
    "It carries no weapon at all. Everything near it simply breathes a little less each round.",

  pyro_bbq: // Grill
    "Left alone it only gets hotter. Pyro City has never understood why anyone leaves it alone.",

  pyro_staph:
    "The cheapest way to start a fire in Pyro City, and by a wide margin the most common.",

  pyro_ingit:
    "Hitting it is the mistake. If you were already burning, hitting it is the worse one.",

  pyro_sparky:
    "It waits by the deployment line. Whatever arrives is lit before it has finished arriving.",

  pyro_florence:
    "Four points of health and one job, which it does on the way out.",

  pyro_canister:
    "The Forged built it to roll somewhere and stop being their problem. It explodes politely — never onto its own side.",

  pyro_flamehound:
    "It arrives at a run, already lit, and touches everything on the way past.",

  pyro_baboom:
    "The Forged's opening argument: everybody takes one step back, whether or not they agreed to it.",

  pyro_heatsink_golem:
    "It runs so hot its edges cut before they burn. What it opens keeps opening.",

  pyro_firecrack:
    "It is looking for one specific thing — something already bleeding and already burning. Then it doubles.",

  pyro_taper:
    "A wick burns to the end and then does the only thing left to do. The back line is what it reaches.",

  pyro_ember_scorpion:
    "Nine points of damage and a sting that keeps working long after the tail has moved on.",

  pyro_spitfire:
    "The Forged do not build one barrel where three will fit.",

  pyro_ash_boar:
    "It does not enter a battlefield so much as land in the middle of one.",

  pyro_slag_tortoise:
    "Cooled slag over a fire that never went out. It will not move, and it takes something off every blow.",

  pyro_wick:
    "It strikes once and the heat keeps working through the wax. One frag held back, for the round that needs it.",

  pyro_dyna:
    "The Forged measure a charge against whatever is standing there. The bigger it is, the more of it goes.",

  // ---------------------------------------------------------------- SPELLS

  pyro_spark:
    "Every fire in the city's history started at about this size.",

  pyro_ember_trap:
    "Left in a doorway and banked low. It is patient in a way nothing else in PYRO is.",

  pyro_flare_push:
    "The flare is not the point. The step backward is.",

  pyro_firewall:
    "Three rounds of open flame across a row. Fly it, shoot over it — walking is the option it takes personally.",

  pyro_ashfall:
    "Ash does not fall on the guilty only. Everything still standing gets its share.",

  pyro_heatwave:
    "Nothing you set alight in this weather ever goes out again. The city calls that a good day.",

  pyro_meltdown:
    "Straight through the plate. Whatever the armour was made for, it was not made for this.",

  pyro_inferno_pit:
    "One step wrong, and everyone standing beside the mistake pays for it too.",

  pyro_cataclysm:
    "It hurts everything on the board. It finishes what was already burning.",

  pyro_volcanic_eruption:
    "The Flame Spire answers once a battle. Every forge on your side runs hotter afterwards — permanently.",

  pyro_burnout:
    "It does not stop at the target. Stopping is a separate system it was not given.",

  // ── Void Tower bosses ──
  boss_umbranova: "It is not aiming. There is nowhere it is not aiming.",

  // -- the forty-card pass --
  pyro_komodo:
    "One bite. The rest is just a matter of following you.",
  pyro_chopper:
    "It lays the line at sixty. Everything inside it is already burning.",
  pyro_warkiln:
    "It does not stop for the rank in front. That is what the rank in front is for.",
  pyro_mortar:
    "It does not aim at the flier. It aims at where the flier stops being one.",
  pyro_pyrodactyl:
    "It comes down the line once. There is no second pass, and there does not need to be.",
};

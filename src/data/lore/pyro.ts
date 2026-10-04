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
    "Forged chemistry, tested on everyone at once: 13 damage to the whole board, sometimes double. Kill him and a last 10 goes off anyway.",

  pyro_pyrogon:
    "A dragon of living flame. He lands burning everything ahead, Flame Engulf breathes on two rows at once, and every kill makes him bigger.",

  // ------------------------------------------------------------- LEGENDARY

  pyro_sol:
    "The sun does not stop at one. Four hits on a single target, each one hotter than the last.",

  pyro_aftermath:
    "The blast first, the smoke after. He hits the row ahead for 5, then hangs a cloud over your side so a quarter of their attacks miss.",

  pyro_dynomight:
    "The Forged built him to open armour. Plate, shields, or a Tank's ribs — he was told those are the same problem.",

  pyro_volcanon:
    "A flying volcano. Each Eruption costs it 2 HP and lands five hits on one target, and every blow leaves it angrier than before.",

  pyro_magmaw:
    "Four bites at one target, and if it drops the rest carry on into the next enemy, harder each time.",

  pyro_magmadon:
    "Meltdown scorches everyone in range, then repeats every round for 2 of its own HP. Only freezing it, or running out of HP, stops it.",

  pyro_infernus_rex:
    "The king of the volcano charges up to three spaces and hits the first enemy for 12. Every kill erupts for 3 on all of them.",

  // ------------------------------------------------------------------ EPIC

  pyro_firebird:
    "Flame Charge hits for 10 and leaves the target burning and bleeding, at 3 HP of its own. If it dies anyway, it blasts the row ahead for 4.",

  pyro_scorch:
    "It does not fight the front line. It sets fire to the ground the reinforcements have to stand on.",

  pyro_woof:
    "It only eats what is already cooking. So it makes very sure that everything is.",

  pyro_scully: // Scallywag
    "Powder kegs on every open slot ahead: 6 damage and a burn for whoever steps on one. Any enemy that fires a Special catches fire for it.",

  pyro_liza:
    "She doubles whatever is already burning, anywhere on the board, and talks any ally that scores a kill into hitting harder for 2 rounds.",

  pyro_tiki:
    "Planted, spinning, and permanently too close. Everyone in range is alight before the first blow, and its Special reaches anywhere.",

  pyro_sarra:
    "Blue flame. Bluflame Slashing burns the row ahead and seals it from healing, and anyone who hits her in melee gets burned back.",

  pyro_fenix:
    "A phoenix. Kill it once and it stands back up at 1 HP behind 4 shields. Its Blast hits for 10 and burns the target and its neighbours.",

  boss_kheiringer: // Princess Kheiringer
    "She never leaves her row. Every third round Rain of Fire burns the whole board for 12, and every round she raises another Fire Giant.",
  pyro_fire_giant_tok:
    "A mountain Kheiringer told to stand. It tramples smaller foes underfoot, and Magma Fist hammers one enemy for 18 and burns it.",
  pyro_lava_gate_tok:
    "A wall of poured lava. Nothing can target the square behind it until it falls, and anyone who hits it in melee takes 3 damage and a burn.",
  pyro_sseerr: // Emberclaw
    "Dragon claws. Flaming Slasher cuts every enemy in range for 5 and burns them, while it dodges half of what comes back and sharpens every two rounds.",

  pyro_fenrir:
    "A flying fire wolf. Inferno Pounce hits for 8 and burns the target and its neighbours, and every kill earns it an extra hit.",

  pyro_twins:
    "Twice the temper, one body. Double Trouble swells them 8 HP and every hit makes them angrier, but below 12 HP they fight at half strength.",

  pyro_firefly:
    "It does not aim. It scatters — and a kill only convinces it to do the whole thing again, from the air.",

  // ------------------------------------------------------------------ RARE

  pyro_smog_card: // Smog
    "A drifting cloud. Every round it mends your side for 1 and chokes every enemy in range for 1.",

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
    "A Forged firework. It lands, hits the nearest enemy for 2 and knocks it back a step.",

  pyro_heatsink_golem:
    "Forged plating run so hot it cuts instead of burns. It stands in front, and every hit it lands leaves a bleeding wound.",

  pyro_firecrack:
    "It is looking for one specific thing — something already bleeding and already burning. Then it doubles.",

  pyro_taper:
    "A candle that passes the flame on. It calls a PYRO card costing 4 or more from your deck at 1 less, and singes the enemy back row when it dies.",

  pyro_ember_scorpion:
    "Nine points of damage and a sting that keeps working long after the tail has moved on.",

  pyro_spitfire:
    "The Forged do not build one barrel where three will fit.",

  pyro_ash_boar:
    "It does not enter the battlefield, it lands on it: 4 damage to up to eight enemies the moment it arrives.",

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
    "Hidden on an empty slot. The first enemy to step on it takes 5 damage and burns.",

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
    "Crash Out charges up to three slots for 10 and spreads the burn to everything touching the target. A kill leaves Burnout standing in its place.",

  // ── Void Tower bosses ──
  boss_umbranova: "Every third round the sky falls. Meteor Fall hits every enemy for 12 through shields, and each fall makes the next worse.",

  // -- the forty-card pass --
  pyro_komodo:
    "Its bite leaves a bleed, and it hits anything bleeding for 4 more. Death Roll opens a target for 8, once a game.",
  pyro_chopper:
    "A motorcycle on fire. It burns everything in range at the start, rolls forward after each attack, and Peel Out scorches the two spaces ahead.",
  pyro_warkiln:
    "A kiln on tracks. Breakthrough rolls forward and grinds the lane, 10 to the first enemy and 5 to each one behind. It takes 2 off every blow.",
  pyro_mortar:
    "Forged artillery. Airburst Shell stuns a 4x4 burst and drops fliers for 10. It only fires its basic shot every other round.",
  pyro_pyrodactyl:
    "A flying fire-lizard. Firestorm Pass sweeps the line for 5 damage and a burn on the 3 nearest enemies.",
};

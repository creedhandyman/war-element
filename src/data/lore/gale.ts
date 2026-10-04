/**
 * GALE card & spell lore.
 *
 * Keyed by card id, merged onto CardDef.lore / SpellDef.lore at load — see
 * ./index.ts. NOTE the one `spell:` key below: `gale_tempest` is both a card and
 * a spell, so the spell claims its own line explicitly.
 *
 * VOICE RULES — GALE
 *   1. GALE does not threaten. It has already moved. Lines imply *first*,
 *      *already*, *gone* — where LEAF's imply later and PYRO's imply now.
 *   2. Weather is the neighbour, not a metaphor. Survival is the only credential
 *      the nation recognises: you are still here, and the storm hasn't taken you.
 *   3. Mechanic-tied: the line should telegraph what the card does before the box
 *      is read.
 *   4. Place attribution (the Amberleaf, Stormwatch, the highland farms, the
 *      wyvern nurseries) only where the kit leans one.
 *   5. 1-2 sentences. Under ~150 chars where possible — card frames are small.
 *   6. No ceremony and no boasting. GALE thanks things; it does not worship them,
 *      and it never mentions being fast. It simply got there first.
 *
 * Coverage: 39 cards + 3 tokens + 10 spells = 52 entries, which is all of GALE.
 */

export const GALE_LORE: Record<string, string> = {
  // ---------------------------------------------------------------- MYTHIC

  gale_stormfang:
    "Stormfang is in your row before the call is finished: 14 to one foe, 7 to those beside it. Every wolf near him hits harder.",

  gale_griffith: // Skyrend
    "Skyrend drops out of the sky onto one target for 24, then vanishes into the cloud. Every bird beside him flies harder.",

  // ------------------------------------------------------------- LEGENDARY

  gale_tempest: // the CARD — the cost-10 spell keys itself below
    "Charges three slots and strikes through armour for 8. Half the blows at it find only the place it was.",

  gale_eagon:
    "Dragon-blooded and winged: half the time a blow to Eagon goes back at whoever threw it. His Dark Wind Wave shoves the far row toward you.",

  gale_totem:
    "Its spirit watches over the band: allied shots cannot miss, see through stealth, and reach the back row. It plants a Totem Pole when it lands.",

  gale_galeon:
    "A galleon of wind. Every round its sails push the whole enemy line back a slot, and Mighty Winds shoves it two more.",

  gale_klipso:
    "Opens with a feather blade: 10 through armour and a stun. Half of what you swing at it misses.",

  gale_bluejay:
    "Bluejay shoots anything that lands in her range, and every kill makes her a little stronger for good.",

  gale_kloud:
    "Kloud calls a Thundering Hurricane onto the board, and every Mage and Ranger beside it hits harder.",

  // ------------------------------------------------------------------ EPIC

  gale_vaga: // Squall
    "Squall hides in the gale: only a foe standing next to it can strike back. It finishes anyone under 9 HP.",

  gale_buf: // Hornrush
    "Hornrush tramples smaller foes out of their square, and Horn Toss stuns two at once. Thick hide, and it mends itself.",

  gale_angale:
    "Angale's wind surge weakens everything in range and shoves it back. Anyone who strikes her is weakened for it.",

  gale_sway:
    "Sway lands with an Ollie, and each little bird fires at whatever the ally behind it shoots at. Birds of Prey sends three more.",

  gale_guan: // Dreadgaze
    "Dreadgaze stands in front, and its stare weakens the foes ahead the moment it lands. Vision of Fear does it again, anywhere on the board.",

  gale_rayfen:
    "Rayfen can step to any open slot on the board, and Ambush hits three foes anywhere for 7 through armour.",

  gale_fano: // Fanwing
    "Feather Fan lends Fanwing's SP to every slower teammate for a round, so they act sooner. Its hits can weaken.",

  gale_vvulture: // Vulture
    "Vulture grows from every death on the field, and Roosting Wing Shield wraps it in 5 shields and heals 5.",

  gale_masala: // Mesala
    "Mesala hatches a Toxhawk each round, but never a second while the first still flies. Razor Wind Talon leaves the back row hurting.",

  gale_wolfbane:
    "WolfBane hits every foe for 5 with Whirlwind Slasher, and crits any foe slower than it, healing 3 each time.",

  gale_wista: // Zephyra
    "Zephyra's Blue Wind Spiral ricochets between foes standing close together, and every hit shoves its target back a slot.",

  gale_omega:
    "Omega enters play stronger, with +3 DMG and +8 HP. Search and Destroy carries it three slots into your side for a 10-damage hit.",

  // ------------------------------------------------------------------ RARE

  gale_skyforce:
    "The moment Skyforce lands it clips every foe in range for 1, and then it stays up out of melee reach.",

  gale_hawko:
    "Hawko pecks any enemy that lands in its range for 1, and stays out of melee reach.",

  gale_sirocco:
    "Sirocco fetches a GALE card costing 4 or more from your deck when it lands. Every blow it lands sends the target back to its home row.",

  gale_syt_bird: // Sightwing
    "Sightwing flies into a middle row and spots targets: your allies' basic attacks hit one extra neighbour that round.",

  gale_gastly:
    "Gastly lands unseen, stealthed for its first round, then stands in front as a warrior.",

  gale_swillow:
    "Swillow dives on the nearest enemy for 4 as it lands, then flies on out of melee reach.",

  gale_duster:
    "Duster blows in with a tailwind: nearby allies get +2 SP when it lands.",

  gale_toxhawk:
    "Toxhawk's talons poison: each basic hit leaves 1 damage a round for 2 rounds.",

  gale_tumbleweed:
    "Tumbleweed rolls through for 5 damage once a game, two spaces on toward your home row. Half the blows at it miss.",

  gale_stormhide_bison:
    "Stormhide Bison stands in front, shrugs 1 off every hit, cannot be pushed, and tramples smaller foes.",

  gale_megair:
    "Megair's last stand: once a game, the first hit it lands below 3 HP also hits everyone for 3 and shoves them back 2.",

  gale_breeze: // Nightwing — the id predates the card; see cards.ts
    "Nightwing drains 1 max HP from every adjacent foe each round, and heals itself from the bite.",

  gale_luna: // Wolf
    "Luna is a young wolf: each kill heals her 4 and adds 2 max HP.",

  gale_hawk: // Stormquill
    "Stormquill's shots gain +1 damage for every SP above 10, and Glide Rush adds 2 SP and evasion once a game.",

  gale_whirlwolf:
    "Whirlwolf gives nearby allies +5 SP as it lands, and once a game pounces for 2 damage and a weaken on every foe.",

  gale_windsor:
    "Windsor weakens whoever hits him, and 30% of the time he takes half the damage and throws it back at the attacker.",

  gale_wailverine:
    "Wailverine gores the enemy directly ahead for 3 every round, and steps into its square if it dies.",

  gale_klouy: // Spindrift
    "Spindrift's second hit stuns, and once a game its Spiraling Windrow bounces 5 damage between close foes.",

  // ---------------------------------------------------------------- TOKENS

  gale_ollie:
    "Ollie fires at whatever the ally directly behind it shoots at.",

  gale_totem_pole:
    "The Totem Pole never moves: each round it hits the row ahead for 2, and Spirit Ward gives it and its neighbours +3 shields.",

  gale_toxhawk_tok: // Raptor
    "A Raptor from Mesala's nest. Its talons poison: 1 damage a round for 2 rounds.",

  // ---------------------------------------------------------------- SPELLS

  gale_gust:
    "A single gust: 3 damage, and the target is shoved back a space.",

  gale_downdraft:
    "The air drops out from over a whole row, and everything in it is weakened for 2 rounds.",

  gale_tailwind:
    "A tailwind behind every GALE ally: +3 SP, so they go ahead of the rest. Nobody here calls that a favour.",

  gale_squall_line:
    "A wall of wind across a row for 3 rounds. Anything that moves in takes 2 and is pushed back, flyers included. Shots pass over.",

  gale_storm_front:
    "The front hits every foe for 3 and saps 3 SP from each for the round.",

  gale_jetstream:
    "A current for 3 rounds: your GALE allies gain +3 SP, and every push you cause goes a space further.",

  gale_vortex_strike:
    "10 damage straight through armour, and the target is stunned for a round.",

  gale_gale_force:
    "Weakens every foe across two rows for 2 rounds and shoves each back a space.",

  gale_cyclone:
    "8 damage to every foe, and each is dropped to 0 SP for the round, so they act last.",

  "spell:gale_tempest":
    "15 damage to every foe and 0 SP for the round. Afterwards your GALE allies keep +2 SP for the rest of the game.",

  gale_dreamcatcher:
    "Soul Snare puts every foe in range to sleep for a round and weakens them. Each round it also weakens the hardest hitter.",

  // ── Void Tower bosses ──
  boss_nightshrike:
    "Every third round Nightshrike dives on two of you for 9 each. Between dives it feeds on the weakest foe beside it.",

  // ── Void Tower bosses ──
  boss_thunderfangs:
    "Thunderfangs runs with a pack: every third round Thunder Run shocks everyone within 2 spaces, and each living wolf adds to its bite.",

  boss_thunderfangs_2:
    "Thunderfangs, risen as Stormform: Thunder Run now hits for 11 and still electrifies, and the pack keeps growing.",

  gale_sparkwolf_tok:
    "A Spark Wind Wolf: every bite leaves its target electrified for 2 rounds.",

  gale_whirlwind_warrior_tok:
    "A warrior of leaves and wind. It stands in front, and every hit shoves its target back a slot.",

  boss_skybreaker:
    "Skybreaker keeps a Thundering Hurricane on the field and every third round trades places with it, paralyzing everyone near the landing.",

  gale_thundering_hurricane_tok:
    "A storm on the board. It lands for 15 and paralyzes, shoves every foe back a slot every 2 rounds, and splashes 10 beside its target.",

  // -- the forty-card pass --
  gale_goldspur:
    "Goldspur fires both barrels at the two nearest foes for 7 each, with a chance to crit, and lands with a Falcon beside it.",
  gale_leeward:
    "Leeward shelters its neighbours: Windbreak gives itself and adjacent allies +3 shields, and a hard hit throws back the foes beside it.",
  gale_aerostat:
    "Aerostat drops sandbags: 6 damage and a stun on up to three foes. Brought down, it bursts and stuns those beside it.",
  gale_gyre:
    "Gyre's whirl saps 3 SP from the nearest foe each round, and once a game drags up to three foes 2 spaces toward it and stuns them.",
  gale_falcon:
    "Falcon drops on any adjacent foe whose HP is below its damage, destroying it and taking its square. Once a game it hits for 10 through armour.",
};

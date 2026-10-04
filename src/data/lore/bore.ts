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
    "It bores straight down the column, through every card in it and through their plate. The hole is the same width either way.",

  bore_deepest: // The Deepest
    "Blind, and it has never needed the eyes. Stand still and it does not know you are there; the ground tells it everything else.",

  // ------------------------------------------------------------- LEGENDARY

  bore_sandman: // Dunewraith
    "It puts you under and then keeps working, quietly — nothing it does is ever loud enough to wake you.",

  bore_prism:
    "A prism splits one blow into frost, fire, sleep or edge, and re-lights it every round. When it falls, your hardest hitter takes the enchantment.",

  bore_diam: // Adamant
    "Adamant by name. One cast hardens your whole line to take two less per hit, and when an ally falls the weakest one left is hardened too.",

  bore_score: // Venomarch
    "Venom on the march: it poisons whatever it puts to sleep. Hit it in melee and you sleep; kill it and you are poisoned.",

  bore_bearocks:
    "Nothing takes hold of it, and killing it only puts it down for a season. It wakes at twenty-four and carries on.",

  bore_bastion:
    "A bastion that adds two plates every round, and the first time you break its shields it hits harder and moves faster. Waiting does not help you.",

  bore_steel: // Ironclad
    "Ironclad, and not content with its own plate: it pulls the shields off the enemies in front of it and wears them. No status takes hold.",

  // ------------------------------------------------------------------ EPIC

  bore_shift:
    "A fault shifts and everything on it feels it: Quaking Comet hits every enemy, and each cast adds a point of damage. Its hits shove the target back.",

  bore_valcana:
    "It builds pressure with every hit and spends all of it at once. Afterwards it starts again from nothing.",

  bore_krysteel:
    "Crystal that rains shards on every enemy in range, with a crit that only bites the unarmoured. No status will stick to it.",

  bore_rhe: // Rhyolite
    "Rock that smashes for nine and puts two enemies to sleep. Half of everything shot at it glances off.",

  bore_rollo: // Rumbler
    "Every swing carries it one slot further in. It has no plan for stopping and has never been asked for one.",

  bore_monger:
    "A rock-monger: it throws five boulders and turns every miss into two shields. Each ally also gets two plates the first time it is hit.",

  bore_sheish: // Kimberlite
    "Diamond-edged: double damage against anything wearing plate, and it keeps the shields it breaks.",

  bore_lithara:
    "Earth Shatter strikes anywhere on the board and puts the target to sleep for the round. Every cast leaves Lithara two shields and a point of damage up.",

  bore_obsidi: // Obsidian
    "It tunnels out of sight, faster underground, and its next attack erupts for 6 twice.",

  bore_rohojohn: // Crystal Sabor
    "The Sabor pounces up to two spaces onto its prey for 10, stunning it and leaving it bleeding. Anything adjacent takes four more from its basics.",

  bore_bolder:
    "A boulder that keeps count: Vengeance hands back all the damage it took this round and puts the target to sleep. Archers and knives only do half to it.",

  bore_gemaga: // Magnetite
    "It returns what it is given, and teaches the line beside it to do the same.",

  // ------------------------------------------------------------------ RARE

  bore_hillbilly:
    "A hillbilly looks after the neighbours: the first time each ally is hit, it hands that ally a plate.",

  bore_cavedweller: // CaveDweller
    "It lives in the dark and prefers everyone asleep: on arrival it hits one enemy for 2 and puts it out for a round.",

  bore_crock:
    "A crocodile's last move is its worst: kill it and it rolls for 5 damage on whoever finished it, if they were close.",

  bore_kcor: // Pebble
    "Five rocks, thrown without aiming. Some of them arrive.",

  bore_iron:
    "It arrives with plate for the neighbours, and keeps three for itself.",

  bore_cosmic:
    "Killing it settles nothing. The meteor it called lands a round later, 3 damage to every enemy.",

  bore_clubber:
    "A club that shoves its target back a slot, and hands a point of damage back to anyone who hits it.",

  bore_smith:
    "The Smith works the forge: each round your hardest hitter gets a shield and a point of damage, five times in all.",

  bore_rockgoblin: // Rock Goblin
    "It guards the entrance. Anything that moves in is given two points of welcome, and something heavier is sent for from the back.",

  bore_old_timer: // Old Timer
    "Slow, and not about to be moved by anything in a hurry. It has outlasted several people who found that funny.",

  bore_sling:
    "Plate is not cover, only a delay. It has been putting stones through gaps its whole life.",

  bore_thorny_ripper: // Thorny Ripper
    "The first swing takes the wrong head. Only the first, and only a swing — a Special knows better.",

  bore_armadillo: // Granite Armadillo
    "One point of damage and no interest in dealing it. Everything that reaches it arrives two lighter.",

  bore_warthog:
    "It charges in on arrival: two slots forward, and 5 damage to everything ahead of it.",

  bore_ufo: // UFO
    "Nobody has explained it. Melee cannot reach it, and its hum costs every enemy in range 1 HP a round, plate or not.",

  bore_rock: // Slugger
    "A slugger: about a third of its punches put the target to sleep, and once a game it throws a four-hit combo.",

  bore_stone:
    "It will change places with whoever needs the spot more. Once, and it does not discuss the arrangement.",

  bore_ankylosaur: // Granite Ankylosaur
    "A tail club that puts its target to sleep for two rounds half the time. It takes a point less from every hit.",

  // ---------------------------------------------------------------- SPELLS

  bore_pebble_toss:
    "Three points at them, one plate for you. Nothing about it is clever.",

  bore_sand_trap:
    "One row, one round, face down in the sand.",

  bore_bulwark:
    "Three more plates on whoever is going to need them.",

  bore_stone_wall:
    "A wall across your home row: anything that walks into it loses a plate and takes 3, and your cards in the row take 2 less per hit.",

  bore_fortify:
    "Everybody gets two. The Fortress does not distinguish between the front and the back.",

  bore_bedrock:
    "Three rounds on bedrock: your BORE cards take 1 less from every hit and hand 1 back to whoever hit them.",

  bore_shatterpoint:
    "Twelve points, straight through. Every stone has one place where it comes apart.",

  bore_landslide:
    "Two rows asleep, and yours come out of it wearing more than they went in with.",

  bore_tremor:
    "Eight to everybody. Sixteen to whoever turned up without armour.",

  bore_mountains_fall:
    "The mountain, arriving all at once. Afterwards your side puts on another plate every round, for as long as it takes.",

  bore_kobra:
    "A cobra: it dodges about half of what is thrown at it, bites its target to sleep, and hits sleepers for double. It arrives with a second cobra.",

  bore_kingcobra_tok:
    "The second cobra rears up once a game to put two enemies to sleep, and bites sleepers for double.",

  boss_vulcanyx:
    "A walking volcano: it burns what it hits, heals from the damage, and every third round splits the ground under everything in reach.",

  void_fortress_gate_tok:
    "A gate across the home row. While it stands, nothing can target the square behind it, not even fliers or archers.",

  boss_kato:
    "Kill it and it rises again, faster. Until then it charges down the lane, hitting the front card for 14 and those packed behind for 8.",

  boss_kato_2:
    "It springs twice in one go for 11 each, and the first attack on it each round always misses. Kill it and it takes to the air.",

  boss_kato_3:
    "The last form flies out of reach and calls lightning on four enemies at once for 16 each, and hits the shocked harder.",
  boss_continental:
    "A titan too big to hurry. Its basic attack reaches the whole board, and every third round it hurls a boulder for 35 at a random target.",

  bore_rolling_boulder_tok:
    "A boulder that rolls one slot forward every round, straight through whatever is there, for 12 damage that ignores plate.",

  // -- the forty-card pass --
  bore_rhino:
    "It charges up the column, tramples what stands in front for 3 through plate, and tosses it back a slot with the horn.",
  bore_dunebuggy:
    "Floors it once a game: +5 speed for two rounds and two slots forward. Its first strike on each opponent hits 2 harder.",
  bore_badlands_bandits:
    "A dust devil: 4 damage and blind to the three nearest enemies. Each kill pays out a point of damage and two shields, up to a cap.",
  bore_spinosaur:
    "Its tail sweeps everything in reach for 6 through plate and knocks it back, and every kill it makes feeds it +2 damage.",
};
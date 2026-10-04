/**
 * LEAF card & spell lore — calibration pass.
 *
 * Keyed by card id, merged onto CardDef.lore / SpellDef.lore at load (see
 * ./index.ts and the attach step in data/cards.ts). Kept out of cards.ts on
 * purpose: this is prose, written an element at a time, and cards.ts is already
 * nine thousand lines of mechanics.
 *
 * VOICE RULES — LEAF
 *   1. LEAF never boasts. It observes, and it waits.
 *   2. Time is the threat, not force. Lines imply *later*, not *now*.
 *   3. Mechanic-tied: the line should telegraph what the card does before the box is read.
 *   4. Season attribution (Spring / Summer / Autumn / Winter) only where the kit leans one.
 *   5. 1-2 sentences. Under ~150 chars where possible — card frames are small.
 *
 * Coverage: 39 cards + 2 tokens + 10 spells = 51 entries, which is all of LEAF.
 */

export const LEAF_LORE: Record<string, string> = {
  // ---------------------------------------------------------------- MYTHIC

  leaf_trinezer:
    "He arrives with three Reptilians already at your throat, and culls the weakest from across the board. Every kill sharpens the whole pack.",

  leaf_oakgre:
    "He starts rooted in place. Tearing loose costs him blood, up to three times, and each time he hits harder and walks over anything smaller.",

  // ------------------------------------------------------------- LEGENDARY

  leaf_elderroot:
    "Elderroot's roots pin whatever he strikes, then his Embrace heals the whole line and cleanses what ails it.",

  leaf_season: // Evera
    "Every round Evera heals her grove and roots the fastest enemy. Her Coil pins a whole row, then the row behind it.",

  leaf_efy: // Sylvane
    "Her bark refills to two shields every round, and her Emergence raises a walking tree that heals the line as it marches.",

  leaf_thorn:
    "Every thorn she lands deepens the bleed, and every drop her enemies lose heals her. Her petals sweep two at once.",

  leaf_fallow:
    "In Fallow's hunting season every crit pins its target, and pinned enemies take 1 damage each round. Every kill makes him stronger.",

  leaf_warden: // Hartwood
    "Hartwood shields his Grove, and when an ally falls he answers the killer with 7 damage.",

  leaf_nightshade:
    "Nightshade's bloom poisons every enemy on the board, and anything rooted is poisoned again each round.",

  // ------------------------------------------------------------------ EPIC

  leaf_alpha:
    "Alpha tackles his prey and roots it to the ground. Against a pinned target, every bite heals him.",

  leaf_fallona: // Autumnal
    "Every three rounds Autumnal grows stronger for good, and her Leaf Storm hits everything in range three times over.",

  leaf_bark_bushmen: // Bark
    "Bark Bushmen grows a new layer of bark every round, up to five shields. His Night Spear pins and silences a target from anywhere.",

  leaf_citra:
    "Citra's acidic bloom leaves up to four enemies bleeding for four rounds, and her shots pierce armour.",

  leaf_dande: // Dandelion
    "Dandelion heals 3 HP every round, grows tougher with each one, and pricks whoever hits it. You cannot weed it out fast enough.",

  leaf_whintey: // Hibernal
    "Hibernal's Winter's Bundle roots every enemy on the board, and anyone already pinned stays pinned two rounds longer.",

  leaf_lumberjack:
    "Lumberjack fells a tree down his own column: it hits everything in the three slots ahead, roots it, and shields him.",

  leaf_sakuroot:
    "Sakuroot cannot be pushed. Its Petal Storm roots the three squares ahead, and falling petals heal the home row each round.",

  leaf_splint:
    "Splint stabs on arrival, then pulls the leaves around himself: hidden and healing for three rounds. A kill hides him again.",

  leaf_sprinu: // Vernal
    "Vernal's basic attack can heal a wounded ally instead of striking, and her Root Spring pins an enemy while mending the grove.",

  leaf_sumerose: // Estival
    "Estival's summer thorns bleed what they cut, and every hit heals her. Her Siphoning Slash steals even more.",

  leaf_darth: // Nightbriar
    "Nightbriar hides until he shoots, roots his target with Dark Hunting, and leaves a trap where each victim falls.",

  leaf_rubyo: // Rubyscale
    "Rubyscale arrives with a Greegon at his side. His Dragon's Dance hits up to three targets, and hits one for 8 more while Greegon lives.",

  leaf_squanch:
    "Squanch grows a shield for every hit it takes, up to five. Its Bushwhacker clubs and roots everything standing next to it.",

  // ------------------------------------------------------------------ RARE

  leaf_birch:
    "Fell something with Birch and it keeps chopping: four more hits of 1 at the closest enemy.",

  leaf_nettle:
    "Nettle stings from range and leaves a bleed. Against anything already bleeding and burning, it hits harder and heals itself.",

  leaf_stickers:
    "Stickers dodges half the hits aimed at it and clings to one target, each hit deepening the bleed up to four.",

  leaf_stickviper:
    "StickViper looks like a stick until it bites from range, and each bite leaves a deep bleed.",

  leaf_weeds:
    "Weeds spread: a landed hit may sprout another Weeds beside it, up to two copies. Pulling one rarely ends it.",

  leaf_cactus:
    "It asks nothing of you — only that you not touch it. It asks with needles.",

  leaf_leaf: // Frond
    "Frond flings razor leaves, two a turn, and each cut bleeds. The Mega Forest has more of these than anything else.",

  leaf_oak:
    "Oak roots whatever it hits and drops an Acorn the first time it is struck each round. Once a game it can pull up and advance two slots.",

  leaf_python:
    "Python coils around whatever it hits, pinning it, and drains 2 HP from an adjacent enemy every round.",

  leaf_sticks:
    "Sticks comes in fast: the moment it lands it stabs the nearest enemy for 7 and weakens their next attack.",

  leaf_dartfrog:
    "Dart Frog's bright colours are a warning. Once a game it loads up, and its next shot fires three bleeding darts.",

  leaf_walking_tree: // Elephlora
    "Elephlora walks one slot toward the enemy every round, healing its most wounded ally and prodding a random foe.",

  leaf_gecko:
    "The first killing blow only takes Gecko's tail: it survives at 1 HP, hidden and healing. Once a game.",

  leaf_greegon:
    "Greegon stands in front and heals 2 HP every round. Its thorny hits bleed, and each kill sharpens it.",

  leaf_guardian:
    "It arrives already swinging, and every kill teaches it to swing harder.",

  leaf_hunter:
    "Hunter's traps bite on arrival for 4, sometimes pin whatever he shoots, and snap once more for 4 at his killer when he falls.",

  // ---------------------------------------------------------------- TOKENS

  leaf_acorn_tok:
    "Dropped, not planted. It rolls toward the enemy because nothing in the grove told it to stop.",

  leaf_reptilian_tok:
    "Trinezer's Reptilians come in threes, and each kill leaves the one that got it faster, stronger and tougher.",

  // ---------------------------------------------------------------- SPELLS

  leaf_sprout:
    "A patch of thorns scratches one enemy and everything packed beside it, and each keeps bleeding for two rounds.",

  leaf_thorn_patch:
    "A little new growth across a chosen row heals each LEAF ally in it for 3 HP.",

  leaf_snare:
    "A hidden trap in an empty slot: the first enemy to step on it is rooted for three rounds and bleeds.",

  leaf_bramble_wall:
    "Three rounds of thorn. Fly over it, shoot across it — but do not try to walk it.",

  leaf_groves_blessing:
    "The grove thickens: every LEAF ally gains +4 max HP, heals 5, and sheds a bad status.",

  leaf_lushfield:
    "In Lushfield your LEAF allies regrow every round, and every bleed and root you apply lasts a round longer.",

  leaf_withering_grasp:
    "A grasping root pierces for 8, leaves the target bleeding, and gives what it takes to a LEAF ally.",

  leaf_overgrowth:
    "One wrong step, and the whole patch closes — on you and on whoever was standing beside you.",

  leaf_bloodroot_surge:
    "Every enemy starts bleeding, and the blood it will cost them is paid out up front as healing to your whole grove.",

  leaf_heart_of_the_forest:
    "The Spirit Tree wakes: LEAF allies are healed to full and made sturdier for good, while every enemy is rooted in place.",

  leaf_snapmaw:
    "Snapmaw feeds on the rooted: it devours every pinned enemy on the board, and grows stronger for each one that dies.",

  // ── Void Tower bosses ──
  boss_basilisk: "Basilisk heals every round and bites back what it takes. Every three rounds its Wither Coil withers up to three enemies' max HP.",

  // ── Void Tower bosses ──
  boss_smolder: "Smolder burns where it roots: every three rounds it sets everything near it alight and pins it in the flames.",

  boss_kazehaya: "Every three rounds Kazehaya's Cutting Wind slashes everything near it and drags it close. Hit it too hard and the gale throws you back.",

  leaf_leafwind_guardian_tok:
    "A vine hook on every strike drags the enemy one slot toward the Guardian, whether it wanted to come or not.",

  // -- the forty-card pass --
  leaf_forestdeer:
    "Forest Deer bolts before you can strike: a slower attacker only has a 50% chance to hit it.",
  leaf_monkey:
    "Rookey's decoy head soaks the first basic attack, and on arrival it digs a LEAF card costing 4 or more out of your deck.",
  leaf_gorilla:
    "Growrilla's Canopy Crash pounds the three nearest enemies and pins them, and every hit it lands shoves the target back a slot.",
  leaf_wintermoose:
    "The herd keeps its own weather: the Winter Moose heals nearby allies 3 HP every round, and its Winter Coat shields them all.",
  leaf_grizzly:
    "Grizzly hides in the thicket until it moves. Then it closes two spaces and mauls for 14, and a kill heals it.",
};

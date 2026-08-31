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
    "The Cycle asked him to keep the balance. It never asked him to enjoy it less. He arrives with the brood already fed.",

  leaf_oakgre:
    "Older than the tribes sheltering beneath him. He has torn free of the soil three times in a thousand years, and never once put a root back.",

  // ------------------------------------------------------------- LEGENDARY

  leaf_elderroot:
    "The outer roots reach every grave beneath the Spirit Tree. What they draw up, he gives back to the living.",

  leaf_season: // Evera
    "Spring's mercy, Summer's patience, Autumn's ending, Winter's stillness. She does not choose between them — she is the sentence they finish.",

  leaf_efy: // Sylvane
    "Bark closes over the wound before the blade has finished leaving it. She teaches this to anyone standing in her shade.",

  leaf_thorn:
    "Autumn's honest lesson: the ending feeds the beginning. She simply insists on being the one to open it.",

  leaf_fallow:
    "Blindfold him. Salt the trail. Wait in the dark. The Winter Tribe has a word for people who try this: found.",

  leaf_warden: // Hartwood
    "Nothing falls in the Mega Forest without being counted. He keeps the count, and he collects from the one who opened it.",

  leaf_nightshade:
    "The Rot Line grows what the other three seasons agreed not to name. She tends it anyway, and the Autumn Tribe looks elsewhere.",

  // ------------------------------------------------------------------ EPIC

  leaf_alpha:
    "Once per hunt the pack picks a throat and puts it on the ground. Everything after that is bookkeeping.",

  leaf_fallona: // Autumnal
    "She does not need this round. She has been counting since the first one.",

  leaf_bark_bushmen: // Bark
    "Every round he stands still, the forest adds another layer. Wait long enough and you are shooting at a tree.",

  leaf_citra:
    "The rot is not an accident of the bloom. The bloom was always the delivery.",

  leaf_dande: // Dandelion
    "Cut it down and it comes back taller. Spring Tribe children are taught to weed carefully; this is why.",

  leaf_whintey: // Hibernal
    "Winter does not kill what it holds. It simply keeps holding, and lets the season do the rest.",

  leaf_lumberjack:
    "He does not fell trees toward himself. The gap opens away from him, all the way to whatever was standing behind them.",

  leaf_sakuroot:
    "The cherry grove does not retreat and cannot be pushed. Petals fall on the wounded whether or not anyone asked.",

  leaf_splint:
    "The underbrush closes behind him a little more slowly each time. He has decided that is a fair price.",

  leaf_sprinu: // Vernal
    "The same water that drowns a root can raise one. Spring Tribe doctrine, delivered at range.",

  leaf_sumerose: // Estival
    "The Autumn Tribe calls it pruning. The pruned have rarely agreed.",

  leaf_darth: // Nightbriar
    "He does not aim at where you are. He aims at the ground you will be standing on after he is finished.",

  leaf_rubyo: // Rubyscale
    "Small, red, and never arriving alone. The old lizard behind him is the part you should have been watching.",

  leaf_squanch:
    "Hit it and it thickens. Hit it twice and you have spent two rounds making it harder to hit.",

  // ------------------------------------------------------------------ RARE

  leaf_birch:
    "One clean fall opens the canopy. Four more strikes come through the gap.",

  leaf_nettle:
    "A child's injury, repeated at range. It finds the ones already bleeding and burning, and finishes the errand.",

  leaf_stickers:
    "It picks one target and simply refuses to be anywhere else.",

  leaf_stickviper:
    "You will not notice the branch that bit you until the branch has stopped mattering.",

  leaf_weeds:
    "Pull it, burn it, salt the ground it grew in. Next season, ask the ground how that went.",

  leaf_cactus:
    "It asks nothing of you — only that you not touch it. It asks with needles.",

  leaf_leaf: // Frond
    "A single leaf, edge-on, at speed. The Mega Forest has more of these than it has anything else.",

  leaf_oak:
    "It cannot hurt you and it will not move — except once, when it decides the forest needs it further forward.",

  leaf_python:
    "It does not strike. It arrives beside you, and then there is simply less of you each round.",

  leaf_sticks:
    "Three grams of dry wood, moving very fast, at exactly the wrong moment.",

  leaf_dartfrog:
    "Bright colors are not decoration in the Mega Forest. They are a courtesy.",

  leaf_walking_tree: // Elephlora
    "It was not there yesterday. It will be closer tomorrow, and the wounded behind it will be standing.",

  leaf_gecko:
    "It leaves the tail. It has never once needed the tail.",

  leaf_greegon:
    "The canopy closes over its wounds every evening, whether anyone asked it to or not.",

  leaf_guardian:
    "It arrives already swinging, and every kill teaches it to swing harder.",

  leaf_hunter:
    "He sets a trap on arrival, another when he lands a hit, and one last one on his way down. Autumn Tribe thoroughness.",

  // ---------------------------------------------------------------- TOKENS

  leaf_acorn_tok:
    "Dropped, not planted. It rolls toward the enemy because nothing in the grove told it to stop.",

  leaf_reptilian_tok:
    "One is a nuisance. A dozen is a plan. Trinezer never sends just one.",

  // ---------------------------------------------------------------- SPELLS

  leaf_sprout:
    "The smallest possible amount of growth, applied exactly where the wound is. It is usually enough.",

  leaf_thorn_patch:
    "Nothing here will kill you. It only makes certain the round after this one costs you something.",

  leaf_snare:
    "The forest does not chase. It waits on the ground you were always going to walk across.",

  leaf_bramble_wall:
    "Three rounds of thorn. Fly over it, shoot across it — but do not try to walk it.",

  leaf_groves_blessing:
    "Whatever the enemy spent this round undoing, the grove quietly puts back.",

  leaf_lushfield:
    "Everything grows longer here — the healing, the bleeding, and the roots holding you still for both.",

  leaf_withering_grasp:
    "Nothing the forest takes is wasted. It is simply moved to whoever needed it more.",

  leaf_overgrowth:
    "One wrong step, and the whole patch closes — on you and on whoever was standing beside you.",

  leaf_bloodroot_surge:
    "Every drop the field is about to spill has already been promised to something with roots.",

  leaf_heart_of_the_forest:
    "The Spirit Tree does not intervene often. When it does, the Cycle simply resumes from the beginning — for one side only.",

  leaf_snapmaw:
    "It does not chase. It waits for the roots to finish the argument.",

  // ── Void Tower bosses ──
  boss_basilisk: "It is not winning the fight. It is winning the wait.",

  // ── Void Tower bosses ──
  boss_smolder: "The forest did not burn down. It stood up.",

  boss_kazehaya: "It has never taken the first swing. It has never needed to.",

  leaf_leafwind_guardian_tok:
    "It does not catch you. It decides where you will be standing.",

  // -- the forty-card pass --
  leaf_forestdeer:
    "It heard you decide. That was several minutes ago.",
  leaf_monkey:
    "It watched which way you looked, and left something there for you.",
  leaf_gorilla:
    "It has not stood up yet. There has not been a reason to.",
  leaf_wintermoose:
    "The herd keeps its own weather. It can stand in this until spring.",
  leaf_grizzly:
    "It has been in this thicket the whole time. You will know when that stops being true.",
};

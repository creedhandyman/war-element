/**
 * DUSK card & spell lore.
 *
 * Keyed by card id, merged onto CardDef.lore / SpellDef.lore at load — see
 * ./index.ts.
 *
 * VOICE RULES — DUSK
 *   1. DUSK does not threaten. It keeps records. The threat is that nothing here
 *      is finished — lines imply *still*, *again*, *after*. (LEAF implies later,
 *      PYRO now, GALE already.)
 *   2. Death is procedural, not dramatic. Dying is a step in the process, and the
 *      card usually has business afterwards. Never mourn it, never savour it.
 *   3. Mechanic-tied: the line should telegraph what the card does before the box
 *      is read.
 *   4. Place and tribe attribution (the Dead Forest, Shadow Pass, the cemeteries,
 *      the register) only where the kit leans one.
 *   5. 1-2 sentences. Under ~150 chars where possible — card frames are small.
 *   6. Courteous and quiet. DUSK is the polite element: it never gloats and never
 *      raises its voice, which is most of what makes it read as worse.
 *
 * Coverage: 39 cards + 6 tokens + 10 spells = 55 entries, which is all of DUSK.
 */

export const DUSK_LORE: Record<string, string> = {
  // ---------------------------------------------------------------- MYTHIC

  dusk_skullking:
    "He does not command an army so much as keep a register. Every round it is longer, and every name on it stands a little straighter.",

  dusk_shadowhorsemen:
    "They ride the line the way a rumour travels — through everything in between. Armour was never part of the conversation.",

  // ------------------------------------------------------------- LEGENDARY

  dusk_ravven:
    "It is only hard to hit on your side of the field. That is where it prefers to be, and it grows bolder the longer it stays.",

  dusk_scar: // Vesper
    "She keeps a count of the fallen, and the whole house is a little healthier for every one of them.",

  dusk_zombination:
    "It does not mind losing bodies. Each one that drops makes it heavier, and takes something with it on the way down.",

  dusk_hoax:
    "It points, politely, and everyone understands the matter is settled. When the marked one falls, the crow collects.",

  dusk_destro:
    "Killing it is a formality it has already filed an objection to. It returns at eight, and the chains do not care either way.",

  dusk_skelider:
    "The horse is bone as well, and it holds together right up until it doesn't. What is left still walks — slower, and without the lance.",

  dusk_nightfang:
    "It does not kill so much as subtract. What it takes does not come back, and it is not there to be asked about it.",

  dusk_butler:
    "He takes the coats, pours the wine, and stands where the light does not reach. Nobody in the household can say which year he was hired, and nobody has ever thought to ask.",

  // ------------------------------------------------------------------ EPIC

  dusk_silkstalker:
    "It only spins on your side of the field. Whatever it catches spends two rounds unsure where anything is.",

  dusk_spectra:
    "It stands in front, and the one behind it becomes difficult to see as well. Striking it in person is discouraged.",

  dusk_skrow: // Strawman
    "Stuffed, silent, and never actually alone. Knock it down and the field it was watching fills with wings.",

  dusk_ghastly: // Ghastly Groom
    "He pays two of his own for every three he lands. He has been at this long enough that the arithmetic no longer troubles him.",

  dusk_haunt:
    "It takes five, and it keeps them. The first touch is only to make sure you are standing still for the rest.",

  dusk_reaper:
    "Distance is a clerical detail. Every collection makes the next one easier, and it keeps what it collects.",

  dusk_sarachnid:
    "One nest a round, and never more than four at a time. Anything the brood kills becomes somewhere to put the next one.",

  dusk_plaguecrow:
    "It lands, and for one round nobody remembers how their own tricks worked. Kill it and something worse comes off the body.",

  dusk_wedded_wraith:
    "The procession never shortens. When she finally stops, everyone still dancing is stronger for it.",

  dusk_rip: // RIP
    "It has no attack at all. It tears pieces off itself on a schedule, and the pieces do the walking.",

  dusk_brute:
    "Every clean hit takes something out of your swing. It collects armour off the ones that stop swinging entirely.",

  dusk_ender:
    "Anything slower than it struggles to be certain where it is. It will happily trade places with you to prove the point.",

  dusk_violet:
    "She does not distinguish between sides at the table. Everyone present contributes, and she keeps the total.",

  // ------------------------------------------------------------------ RARE

  dusk_vamp:
    "The first lesson, and the cheapest. It leaves with slightly more than it arrived with.",

  dusk_pumpkin:
    "It lobs. The back row has never once been out of reach, which the back row keeps forgetting.",

  dusk_crow:
    "Two points of almost anything. Whoever takes it usually regrets having stood so close.",

  dusk_spider:
    "It chooses somebody to be afraid on arrival, and then gets to work.",

  dusk_zombie_husk:
    "Putting it down is a step in the process, not the end of one.",

  dusk_skeleton_knight:
    "It arrives with the shield already up. Nobody in the cemeteries has ever seen it arrive otherwise.",

  dusk_harve: // Harrow
    "It comes up the path with company, and the company is quieter than it is.",

  dusk_doom:
    "It is counting. Four rounds, and then it stops being a problem for everybody at once.",

  dusk_jackl:
    "The arrow that finishes one is already leaving for the next.",

  dusk_gravekeeper:
    "He does not much care whose. Every burial makes the man doing the burying harder to bury.",

  dusk_widowbite:
    "Killing it is the opening of a three-round conversation.",

  dusk_gool:
    "One touch, and whoever took it spends the next two rounds deciding not to move.",

  dusk_skulldrake:
    "A dragon does not stop being a dragon once the meat is gone. What it breathes now settles, and stays.",

  dusk_scarlett:
    "She holds the swarm back until it is worth spending. Once.",

  dusk_soul_wisp:
    "It carries no grudge, and no weapon it insists on using. Point it at your own wounded and it will oblige.",

  dusk_zhunk:
    "It grieves by getting larger. The horde loses one, and Zhunk is the one who benefits.",

  dusk_hix: // Hexvial
    "It does not know which vial it threw either. Whatever it was, there is one more when it drops.",

  // ---------------------------------------------------------------- TOKENS

  dusk_redreven: // RedRaven
    "It comes off the body already screaming, and for one round nobody's tricks answer.",

  dusk_zombie_tok: // Zombie
    "It was somebody. The register no longer records which, and it has not asked.",

  dusk_risen_tok: // Risen
    "Raised by an act rather than a burial. It answers to whoever performed the act.",

  dusk_specter_tok: // Specter
    "One point of substance and a great deal of intent. It only has to arrive once.",

  dusk_skeleton_tok: // Skeleton
    "The most common thing in the Dead Forest, and the most replaceable. The King counts them anyway.",

  dusk_skulldrake_tok: // Risen Drake
    "The King keeps one back for occasions. Eleven points of bone that used to fly.",

  // ---------------------------------------------------------------- SPELLS

  dusk_chill_touch:
    "A small unkindness, and the warmth goes somewhere it is wanted more.",

  dusk_bone_snare:
    "Nothing in the ground here is idle. Step wrong and it remembers you for two rounds.",

  dusk_shadow_step:
    "One round of not quite being where you were aimed.",

  dusk_veil_of_shadows:
    "Three rounds of dark laid across a row. Yours see perfectly well in it.",

  dusk_wake_of_the_dead:
    "Whatever you finish this round has somewhere to be next round — on your side of it.",

  dusk_nightfall:
    "In this dark the first blow always misses, and everything you take, you keep.",

  dusk_phantom_spikes:
    "Straight through, and the three it takes are handed to somebody who will use them.",

  dusk_grave_pit:
    "A deep one, unmarked. The neighbours only get the fright.",

  dusk_harvest:
    "Eight from everybody, and two apiece that never comes back.",

  dusk_endless_night:
    "The door at Shadow Pass, opened all the way, once. Afterwards everything of yours feeds itself.",

  dusk_aranea:
    "Killing the web is not the answer. The web is not the one deciding.",

  dusk_monstrous_spider_tok:
    "Stepping on it does not end it. It ends the part of it you could see.",

  // ── Void Tower bosses ──
  boss_rotroot: "It does not raise the dead. It declines their resignation.",
  boss_skeleeze: "One slot to the right, every round, forever. You have been told.",
  boss_xilty: "The first blow finds silk. The web decides about the second.",

  // -- the forty-card pass --
  dusk_grafft:
    "The batch was labelled wrong. He wrote that down too, and used it anyway.",
  dusk_duet:
    "They have not missed a step since the hall burned down. Neither has stopped counting.",
  dusk_prestige:
    "The trick is not the quicker hand. It is that the record says the card was never there.",
  dusk_tatterhand:
    "Every string is accounted for. So is everyone who ever cut one.",
};

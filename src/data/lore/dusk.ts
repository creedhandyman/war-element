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
 * Coverage: 48 cards (bosses included) + 7 tokens + 10 spells = 65 entries, which is all of DUSK.
 */

export const DUSK_LORE: Record<string, string> = {
  // ---------------------------------------------------------------- MYTHIC

  dusk_skullking:
    "The Skull King raises two more Skeletons every round and keeps them armed. The register only ever gets longer.",

  dusk_shadowhorsemen:
    "The Horsemen ride straight through the line, cutting down everyone they pass, and then settle accounts with the one at the end.",

  // ------------------------------------------------------------- LEGENDARY

  dusk_ravven:
    "Ravven is only hard to hit once it has flown over to your side of the field. Night Stalk then adds three to every shot.",

  dusk_scar: // Vesper
    "Vesper's Moon Frenzy bites every opponent and seals their healing. Whenever one of them falls, her whole side is healed a little.",

  dusk_zombination:
    "Toxic Eruption poisons everyone in range, and whatever dies of it rises as a Zombie. Each Zombie that falls makes it larger.",

  dusk_hoax:
    "Hoax marks one opponent, politely. It can no longer heal, and while unshielded every hit on it lands as a critical.",

  dusk_destro:
    "Destro comes back once at eight HP when killed. Flaming Chains weaken every opponent and take two max HP from each.",

  dusk_skelider:
    "Skelider rides up to four slots to put a lance through its target. Below 10 HP the horse gives out, and it walks on slower, without the charge.",

  dusk_nightfang:
    "Nightfang arrives disguised as the Butler. Kill the Butler and it stands up at full health and Soul Slashes whoever did it.",

  dusk_butler:
    "The Butler tends the household, healing every ally nearby each round. When he is ready he drops the disguise, and Nightfang stands there instead.",

  // ------------------------------------------------------------------ EPIC

  dusk_silkstalker:
    "Silkstalker is only hard to hit once it is on your side of the field. Web Snare hits hard and blinds the target for two rounds.",

  dusk_spectra:
    "Spectra stands in front and fogs itself and the ally behind it, so both are hard to hit. Hit it in melee and you come away weakened.",

  dusk_skrow: // Strawman
    "The Strawman calls a murder of three Crows on command, and when it is knocked down, two more come out of the straw.",

  dusk_ghastly: // Ghastly Groom
    "The Groom hits three harder with every attack and pays two HP for it. Phantom Gouge also seals two foes against healing.",

  dusk_haunt:
    "Haunt's Jacked takes five max HP from the target for good and wraps Haunt in three shields. Its first touch frightens.",

  dusk_reaper:
    "The Reaper hurls its scythe at any opponent on the board and seals it against healing. Each kill heals the Reaper seven and sharpens it.",

  dusk_sarachnid:
    "Sarachnid hatches a Spider every round, up to four at a time. Silk Chase sends the whole brood in to bite and frighten.",

  dusk_plaguecrow:
    "Plaguecrow lands, and for one round no opponent can use a Special. Miasma Burst hits every foe in range, and a RedRaven rises when it dies.",

  dusk_wedded_wraith:
    "She walks three Specters down the aisle at a time. When she falls, nearby foes are frightened and surviving Ghosts hit two harder.",

  dusk_rip: // RIP
    "Rest in pieces. RIP cannot attack, so it tears off a Zombie Husk of itself every round and sends it in.",

  dusk_brute:
    "The Brute's Sweep hits everyone in range and armours it for each kill. Its crits sap the target's damage, but shields switch them off.",

  dusk_ender:
    "Ender swaps places with any opponent and hits it for eight. Anything slower than Ender misses it half the time.",

  dusk_violet:
    "She does not play favourites. Bloody Exchange drains two max HP from every other card, friend or foe, and she keeps the total.",

  // ------------------------------------------------------------------ RARE

  dusk_vamp:
    "Vamp's bites steal max HP, so it grows as it feeds. A cheap card that leaves each fight bigger than it arrived.",

  dusk_pumpkin:
    "It lobs. The back row has never once been out of reach, which the back row keeps forgetting.",

  dusk_crow:
    "A Crow flies over melee, and when it dies its Bird Bomb drops five damage on every opponent within reach.",

  dusk_spider:
    "A Spider frightens one enemy as it arrives, then bites, and the venom keeps working after.",

  dusk_zombie_husk:
    "Putting down a Husk is a step in the process: it leaves a Zombie behind.",

  dusk_skeleton_knight:
    "It arrives with the shield already up. Nobody in the cemeteries has ever seen it arrive otherwise.",

  dusk_harve: // Harrow
    "Harrow never turns up alone. A Specter comes onto the board with it, and the Specter is the quiet one.",

  dusk_doom:
    "Doom is counting. In four rounds it goes off for eight damage to every enemy, and that is the end of it.",

  dusk_jackl:
    "Jackl never stops at one. Each kill sends a second arrow, for two damage, at the nearest opponent.",

  dusk_gravekeeper:
    "The Gravekeeper digs up a costly DUSK card on arrival, then grows tougher at every death on the board, whoever's it is.",

  dusk_widowbite:
    "Widowbite's bite poisons, and killing it is no escape: whoever kills it up close is left with five poison damage a round for three rounds.",

  dusk_gool:
    "Gool's first touch frightens its target for two rounds, pushing it back a row and holding it off.",

  dusk_skulldrake:
    "A dragon that outlived its flesh. It flies over melee, and on arrival its breath leaves the enemies ahead poisoned for three rounds.",

  dusk_scarlett:
    "Scarlett looses her bat swarm once per game: two damage and a max HP drain on every opponent. Her bites drain as well.",

  dusk_soul_wisp:
    "Soul Wisp's light mends every DUSK ally two HP each round, and its basic attack can be aimed at a wounded friend instead.",

  dusk_zhunk:
    "Zhunk grieves by getting larger. Every Zombie that dies, on either side, gives it +1 damage and +1 HP for good.",

  dusk_hix: // Hexvial
    "Hexvial throws a random potion with each hit: poison, damage or fright. When it breaks, the row ahead takes one last splash for three.",

  // ---------------------------------------------------------------- TOKENS

  dusk_redreven: // RedRaven
    "RedRaven shrieks as it arrives, and for one round no opponent can use a Special.",

  dusk_zombie_tok: // Zombie
    "It was somebody. It stands in front now, and the register no longer records who.",

  dusk_risen_tok: // Risen
    "Raised by a spell rather than a burial. It stands in front for whoever raised it.",

  dusk_specter_tok: // Specter
    "A Specter has one HP and three damage, and no plans beyond the first strike.",

  dusk_skeleton_tok: // Skeleton
    "The most common thing in the Dead Forest, and the most replaceable. The King counts them anyway.",

  dusk_skulldrake_tok: // Risen Drake
    "The King keeps one back for occasions. A drake of bone that flies over melee and hits for eleven.",

  // ---------------------------------------------------------------- SPELLS

  dusk_chill_touch:
    "Three damage to a target, and the cold it takes warms a DUSK ally: one max HP changes hands.",

  dusk_bone_snare:
    "Nothing in the ground here is idle. Step wrong and it remembers you for two rounds.",

  dusk_shadow_step:
    "One round of not quite being where you were aimed.",

  dusk_veil_of_shadows:
    "Three rounds of dark across a row. Yours slip about unseen in it, and anything that steps in is hurt and frightened.",

  dusk_wake_of_the_dead:
    "Whatever you finish this round has somewhere to be next round — on your side of it.",

  dusk_nightfall:
    "In this dark the first blow tends to miss, and everything you take, you keep.",

  dusk_phantom_spikes:
    "Straight through, and the three it takes are handed to somebody who will use them.",

  dusk_grave_pit:
    "A deep pit, unmarked. Whoever steps in takes twelve straight through, and the neighbours only get the fright.",

  dusk_harvest:
    "Eight from everybody, and two apiece that never comes back.",

  dusk_endless_night:
    "The night is let in all the way, once: fifteen to every opponent and a fright. From then on every DUSK attack feeds.",

  dusk_aranea:
    "Aranea raises a Monstrous Spider and frightens everyone in range, and every Spider on her side hits two harder while she lives.",

  dusk_monstrous_spider_tok:
    "It webs everyone in range once, rooting them for two rounds. Stepping on it does not end it: it bursts into two Spiders.",

  // ── Void Tower bosses ──
  boss_rotroot: "Rotroot roots everyone near it every third round, and any Zombie of its that falls gets back up once.",
  boss_skeleeze: "Every round it slides two slots toward your thickest column, and every third round Piercing Arrow runs the whole column through.",
  boss_xilty: "Xilty's first attacker each round hits only silk, and every third round Web Trap pins everything near it in place.",

  // -- the forty-card pass --
  dusk_grafft:
    "Grafft's bad batch weakens whatever it hits for two rounds. The label said otherwise, and he used it anyway.",
  dusk_duet:
    "Still dancing after the hall burned down. Partner Dance gives one ally +3 shields and +3 damage for two rounds.",
  dusk_prestige:
    "Prestige mutes two opponents so they cannot use Specials, then hits them for double and stuns them. Now you don't.",
  dusk_tatterhand:
    "The Scarecrow pulls the strings: allies move faster, and Curtain Call makes the four nearest allies with a shot fire on cue.",
};

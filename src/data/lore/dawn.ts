/**
 * DAWN card & spell lore.
 *
 * Keyed by card id, merged onto CardDef.lore / SpellDef.lore at load — see
 * ./index.ts. Note `dawn_heir_tok` is a draftable Legendary despite the
 * token-shaped id, so it sits with the cards below, not the tokens.
 *
 * VOICE RULES — DAWN
 *   1. DAWN holds. It does not advance and it does not retreat — it does not
 *      stop. Lines imply *still standing*, *without fail*, *by choice*. (LEAF:
 *      later. PYRO: now. GALE: already. DUSK: still. BOLT: solved. AQUA: chosen.)
 *   2. Duty is the register — formal, plain, a little archaic. DAWN speaks of
 *      watches and posts and orders, and it does not boast about any of them.
 *   3. Mechanic-tied: the line should telegraph what the card does before the box
 *      is read.
 *   4. The chess hierarchy every DAWN child learns before reading (King, Queen,
 *      Bishop, Rook, Knight, and Pawn — which is most of DAWN) and the orders
 *      (Knights of the Sun, the Flakes) only where the kit leans one.
 *   5. 1-2 sentences. Under ~150 chars where possible — card frames are small.
 *   6. ONE crack, used sparingly and only around the crown: nobody in the Kingdom
 *      is quite certain what happens if the Vigil ever stops.
 *
 * Coverage: 46 cards (bosses included) + 3 tokens + 10 spells = 59 entries, which is all of DAWN.
 */

export const DAWN_LORE: Record<string, string> = {
  // ---------------------------------------------------------------- MYTHIC

  dawn_supernova:
    "A dying star hangs overhead. It scorches everything in range on arrival, and its glare makes enemy shots miss more often.",

  dawn_equestrian:
    "A Knight of the Sun on horseback: it charges up a column and tramples what it meets, and no ally beside it can be weakened.",

  dawn_imperator:
    "Imperator, keeper of the Eternal Vigil. He crowns an Heir and sends the whole line in at once; the ranks behind him are cleansed each round.",

  // ------------------------------------------------------------- LEGENDARY

  dawn_kosmos:
    "Kosmos, the whole sky at once. Every round it blinds the nearest foe, and its Flashing Barrage blinds everyone in range.",

  dawn_heir_tok: // Heir — a draftable Legendary, despite the id
    "Named, not born. Three coronations are permitted, and every throat it closes makes the next one cheaper.",

  dawn_aurora:
    "Three lights, each taking a blow meant for her and handing it back. Every death out there kindles another.",

  dawn_aurelion: // Reveille
    "Reveille sounds and the line wakes healed, faster and hitting harder; each round a ward turns aside the next curse on every ally.",

  dawn_leo:
    "The old lion, king of the wild. Every foe that arrives makes him tougher and sharper, and Golden Guardian mends him every round.",

  dawn_commander: // Sunbanner
    "The Sunbanner stands at the front, every ally beneath it carries an extra plate, and its order sends the nearby rows in to strike together.",

  dawn_dawn: // Empyrean
    "Empyrean descends from above already sounding Golden Courage, then mends every ally 3 HP each round.",

  // ------------------------------------------------------------------ EPIC

  dawn_star:
    "A star falls and the whole field looks away; each shot it lands afterwards heals every ally a point.",

  dawn_amble:
    "She ambles the line each round and heals whoever is worst off, and has never once needed telling who.",

  dawn_lazor:
    "A laser: each kill sharpens it, its Flash Ray reaches anywhere on the board, and whoever finally drops it takes 7 back.",

  dawn_golde: // Gilden
    "Gilden stands gilded in front of the archers; strike him in melee and he hits back for 2, and his War Cry sharpens the whole team.",

  dawn_solstice:
    "Solstice, the longest day: Daybreak heals the line and quickens it, and each round a ward turns aside the next curse on every ally.",

  dawn_veil:
    "Eight plates on arrival, and it is better off once they are gone. Breaking it is not the same as stopping it.",

  dawn_radiance:
    "Radiance grows to match the toughest foe on the field, and its SunSword strikes any target on the board for 11.",

  dawn_ty: // Tether
    "Tether ropes two foes each round so they cannot cast, then its Lacing Knots hit every one still bound for 9.",

  dawn_raya: // Zenith
    "It fires straight up and tells you where. The waiting is the part nobody manages well.",

  dawn_solara:
    "Solara's sunrise blinds the enemy line and posts a Radiant Guardian in front of hers; she mends every ally 1 HP each round.",

  dawn_ariel:
    "Ariel heats to 100,000 degrees, and its next shot fires from range for 11 more damage, straight through shields.",

  dawn_clipsey: // Eclipse
    "High noon, and seven shots that do not miss. Cover has never once been the answer to her.",

  dawn_drakonbane:
    "Drakonbane, the dragon-slayer. Anything as big as a dragon takes extra, and its Special can strike flyers that melee cannot.",

  dawn_warphant: // WarPhant
    "It does not go around. Anything smaller in the way is moved — and when it finally falls, somebody rides out of it.",

  dawn_sircrest:
    "SirCrest burns and drowns at once: his basic hits set foes alight, and Burning Waterfall scalds and burns the whole line.",

  dawn_halo:
    "Halo circles overhead: its horn heals and cleanses the line, and in its light DAWN cannot be blinded and no foe can dodge them.",

  // ------------------------------------------------------------------ RARE

  dawn_beam:
    "It opens with a light in somebody's eyes, and holds it there for two rounds.",

  dawn_flash:
    "A flash, then it is gone: fast and fragile, and whoever it hits is blinded for a round.",

  dawn_sparkle:
    "A cheap wand: one hit in four dazzles its target blind. The Kingdom issues them regardless.",

  dawn_roy: // Outrider
    "A pawn, and most of DAWN is pawns. It sends back for something larger, and grows braver the further forward it goes.",

  dawn_able: // Vigil
    "It keeps the watch nobody writes down: whoever is nearly gone, every round, without being asked.",

  dawn_sphere:
    "A sphere ringed in two plates on arrival, and what it fires pierces plate.",

  dawn_glime: // Glimmer
    "A halo of two plates; when they break it hits harder and moves faster. It has never minded losing them.",

  dawn_shine:
    "It watches the line. The first time somebody takes one of its own, it answers — once, and it remembers the face.",

  dawn_reflection:
    "A mirror held up: each blow that lands sends a point back, and every round it lends a plate to the allies in range.",

  dawn_stbern: // St. Bernard
    "A rescue dog: each round it reaches anyone nearly dead and restores 4 HP, and asks no questions.",

  dawn_musk_ox: // Musk Ox
    "A musk ox: slow, and it does not need speed. Every hit on it is reduced by a point, and smaller foes are trampled underfoot.",

  dawn_goldeneagle: // GoldenEagle
    "The golden eagle circles overhead, hitting harder every third round, and once per game rains feathers on three foes and slips from sight.",

  dawn_oxin:
    "Planted, patient, and it takes the speed out of whatever touches it.",

  // ---------------------------------------------------------------- TOKENS

  dawn_warrider_tok: // WarRider
    "Whoever was riding the WarPhant. They get up, and they carry on forward.",

  dawn_radiant_guardian: // Radiant Guardian
    "Posted where the light falls, and it stays posted. Blows arrive at it already reduced.",

  // ---------------------------------------------------------------- SPELLS

  dawn_sunbeam:
    "A light in the eyes, and three points for the trouble.",

  dawn_cleansing_light:
    "The line gives ground by one step, no more, and braces for it. Two plates apiece.",

  dawn_grace:
    "The two nearest the enemy do not wait for the signal. They strike first.",

  dawn_radiant_barrier:
    "A wall of light across one row: DAWN inside it take less damage, and any foe that steps in is burned and blinded.",

  dawn_dawns_grace:
    "The whole line healed, plated twice over, and one thing lifted off each of them.",

  dawn_blazing_sun:
    "Under a sun like this nothing of yours misses, and nothing gets to stay hidden from it.",

  dawn_judgment:
    "Three cards are sent to posts of the commander's choosing, and none of them asks leave to quit its rank.",

  dawn_solar_flare:
    "Every DAWN card steps forward and strikes in the same breath. Nobody on the line was asked twice.",

  dawn_dawns_judgment:
    "Eight to everyone. Sixteen to whoever was already looking away.",

  dawn_eternal_dawn:
    "The sun held at noon: fifteen to every foe and blinded, and for the rest of the game the line mends faster.",

  dawn_lassos:
    "Every shot lands. The rope is only there to decide where you are standing when it does.",

  // ── Void Tower bosses ──
  boss_helion: "It has already chosen your lane. Walking there was the courtesy.",

  dawn_golden_bull_tok: "The rope did not tame it. It only pointed it.",

  // -- the forty-card pass --
  dawn_riflemen:
    "Every rifle is already laid on a man. The word to fire is a formality.",
  dawn_sunspot:
    "Sunspot hides in the glare: it strikes two foes straight through their shields, and any blinded foe takes a crit.",
  dawn_quasar:
    "A quasar outshines everything: its hits blind for two rounds, and once per game Starfall strikes any foe on the board for 7.",
  dawn_meridian:
    "Sunstalker pounces twice in one leap, and the first blow that should kill it leaves it standing at 1 HP, once.",
  dawn_ballista:
    "It fires once, and then it is wound back. Both halves are the drill.",
};

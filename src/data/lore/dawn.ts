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
 * Coverage: 39 cards + 2 tokens + 10 spells = 51 entries, which is all of DAWN.
 */

export const DAWN_LORE: Record<string, string> = {
  // ---------------------------------------------------------------- MYTHIC

  dawn_supernova:
    "It burns five of its own for every burst — and while it hangs there, nobody else's light spreads as far.",

  dawn_equestrian:
    "The order does not permit its people to be diminished. Nothing on the field can make them less than they arrived.",

  dawn_imperator:
    "Keeper of the Eternal Vigil. He names a successor, gives one order, and the whole line answers it at once.",

  // ------------------------------------------------------------- LEGENDARY

  dawn_kosmos:
    "It is not trying to kill the front rank. Every round, whoever stands nearest simply stops being able to see.",

  dawn_heir_tok: // Heir — a draftable Legendary, despite the id
    "Named, not born. Three coronations are permitted, and every throat it closes makes the next one cheaper.",

  dawn_aurora:
    "Three lights, each taking a blow meant for her and handing it back. Every death out there kindles another.",

  dawn_aurelion: // Reveille
    "The morning call. Each round the line wakes up wearing one more thing that cannot be taken off it.",

  dawn_leo:
    "He answers arrivals. Every new banner on the field leaves the old lion a little harder to move.",

  dawn_commander: // Sunbanner
    "The banner does not strike. It tells the row in front of it when to, and the row does.",

  dawn_dawn: // Empyrean
    "It holds no post. It moves along the line, and behind it nobody is still carrying what they were hit with.",

  // ------------------------------------------------------------------ EPIC

  dawn_star:
    "It arrives and the whole field looks away at once. Every shot it lands afterwards is worth a point to somebody.",

  dawn_amble:
    "She walks the line each round and finds whoever is worst off. She has never once needed telling who.",

  dawn_lazor:
    "It burns brighter with each one it takes, and it does not go out quietly.",

  dawn_golde: // Gilden
    "One shout and the whole line stands straighter. Reaching him in person is answered without comment.",

  dawn_solstice:
    "The longest day. Every round it hands out one more thing the dark has to get through first.",

  dawn_veil:
    "Eight plates on arrival, and it is better off once they are gone. Breaking it is not the same as stopping it.",

  dawn_radiance:
    "It measures itself against the largest thing on the field, and arrives sized accordingly.",

  dawn_ty: // Tether
    "It ties two hands every round, then bills whoever is still tied.",

  dawn_raya: // Zenith
    "It fires straight up and tells you where. The waiting is the part nobody manages well.",

  dawn_solara:
    "Sunrise arrives with a guard already posted. Nobody quite sees it happen.",

  dawn_ariel:
    "It does not wind up so much as reach temperature. Whatever it touches next is not standing afterwards.",

  dawn_clipsey: // Eclipse
    "High noon, and seven shots that do not miss. Cover has never once been the answer to her.",

  dawn_drakonbane:
    "Commissioned for one job. Anything large enough to need doing counts as a dragon.",

  dawn_warphant: // WarPhant
    "It does not go around. Anything smaller in the way is moved — and when it finally falls, somebody rides out of it.",

  dawn_sircrest:
    "A DAWN mage carrying another two nations' fire and water at once. The harbour where they meet is where he is most at home.",

  dawn_halo:
    "Under its light nothing of DAWN's can be blinded, and nothing can slip a DAWN blade. Light that hides has already lost.",

  // ------------------------------------------------------------------ RARE

  dawn_beam:
    "It opens with a light in somebody's eyes, and holds it there for two rounds.",

  dawn_flash:
    "Two points of health and no intention of being looked at directly.",

  dawn_sparkle:
    "A quarter of the time it works. The Kingdom issues them regardless.",

  dawn_roy: // Outrider
    "A pawn, and most of DAWN is pawns. It grows braver the further forward it is sent.",

  dawn_able: // Vigil
    "It keeps the watch nobody writes down: whoever is nearly gone, every round, without being asked.",

  dawn_sphere:
    "It arrives already plated, and what it fires does not stop for plate.",

  dawn_glime: // Glimmer
    "Two plates, and it is quicker once they are off. It has never minded losing them.",

  dawn_shine:
    "It watches the line. The first time somebody takes one of its own, it answers — once, and it remembers the face.",

  dawn_reflection:
    "It gives armour away every round and keeps only what comes back off its own skin.",

  dawn_stbern: // St. Bernard
    "It goes out for the ones already down. Four points, and it never asks how they got there.",

  dawn_musk_ox: // Musk Ox
    "It does not move quickly and does not need to. Everything that reaches it arrives a point lighter.",

  dawn_goldeneagle: // GoldenEagle
    "It circles. Every third round it comes back a little worse, and it keeps one trick in reserve.",

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
    "Whatever they were carrying, they put down. Two of it, each.",

  dawn_grace:
    "Five points and a sharper edge, for one round, to whoever needs both.",

  dawn_radiant_barrier:
    "A row of standing light. Yours take less inside it; walking into it costs the rest.",

  dawn_dawns_grace:
    "The whole line healed, and one thing lifted off each of them.",

  dawn_blazing_sun:
    "Under a sun like this nothing of yours misses, and nothing gets to stay hidden from it.",

  dawn_judgment:
    "Ten straight through the plate — and the line behind it puts something down as well.",

  dawn_solar_flare:
    "Two rows that cannot see for two rounds. The Kingdom calls that mercy, and means it.",

  dawn_dawns_judgment:
    "Eight to everyone. Sixteen to whoever was already looking away.",

  dawn_eternal_dawn:
    "The Vigil, held all at once. Afterwards the line mends a little more every round, for good.",

  dawn_lassos:
    "Every shot lands. The rope is only there to decide where you are standing when it does.",

  // ── Void Tower bosses ──
  boss_helion: "It has already chosen your lane. Walking there was the courtesy."
};

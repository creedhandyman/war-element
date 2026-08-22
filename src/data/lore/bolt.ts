/**
 * BOLT card & spell lore.
 *
 * Keyed by card id, merged onto CardDef.lore / SpellDef.lore at load — see
 * ./index.ts. NOTE the one `spell:` key below: `bolt_zap` is both a card and a
 * spell, so the spell claims its own line explicitly.
 *
 * VOICE RULES — BOLT
 *   1. BOLT does not marvel. It specifies. Lines imply *solved*, *measured*,
 *      *to spec* — where LEAF's imply later, PYRO's now, GALE's already, and
 *      DUSK's still.
 *   2. Awe is an unfinished problem. GALE thanks the storm; BOLT asks what the
 *      storm is for, and then wires it up.
 *   3. Mechanic-tied: the line should telegraph what the card does before the box
 *      is read.
 *   4. Attribution (Arc Industries, Voltis Plaza, GearHollow, the Core) only
 *      where the kit leans one.
 *   5. 1-2 sentences. Under ~150 chars where possible — card frames are small.
 *   6. ONE crack in the confidence, used twice and no more: nobody has explained
 *      the Core. BOLT admits that quietly, and only around the Core itself.
 *
 * Coverage: 39 cards + 3 tokens + 10 spells = 52 entries, which is all of BOLT.
 */

export const BOLT_LORE: Record<string, string> = {
  // ---------------------------------------------------------------- MYTHIC

  bolt_velvolt_knight:
    "Plate that reports its own faults. Break the first layer and the current goes back up your arm for two rounds.",

  bolt_elecdroid:
    "Four strikes, each one measured against the last. On a kill it does not stop — it continues the sequence on whatever is next.",

  // ------------------------------------------------------------- LEGENDARY

  bolt_keeper:
    "The hive is the armour. Aim at him and half the current goes into the bots instead, which is what the bots are for.",

  bolt_shock: // Blackout
    "It does not need the whole grid down. It needs the ones already failing, and they stay down.",

  bolt_jack_arc:
    "Arc's field engineer. Every round somebody on the other side stops working, and he files it as routine.",

  bolt_zoez: // Voltedge
    "Shooting at it is a category error — nothing ranged connects. Reaching it in person costs three.",

  bolt_stormcaller:
    "It holds them still, then bills them by the round for standing there.",

  bolt_gigavolt:
    "It arrives with no weapon and no legs, and gets measurably worse every round it is left standing.",

  bolt_voltogon:
    "The only dragon on the payroll. Whatever it takes out of you goes straight back into itself.",

  // ------------------------------------------------------------------ EPIC

  bolt_zagphu: // Ricochet
    "It does not open the wound. It waits for something else to leave a charge on you, and hits exactly there.",

  bolt_static:
    "Every one it finishes buys the rest of the field another round of standing still.",

  bolt_webster:
    "The first hit is the wire. The second is where the wire goes, and then you have nothing to say.",

  bolt_lytning:
    "It cracks once to stop everything moving, and after that it simply reads the meter each round.",

  bolt_storm:
    "The cheapest thing on the board in round one. By round six nobody has agreed on what it is.",

  bolt_sentry:
    "It does not aim at people. It aims at whatever has stopped moving, which is a far simpler specification.",

  bolt_thundercat:
    "It lands on the target rather than approaching it, and what the claws leave behind keeps ticking.",

  bolt_shoksa: // Dynamo
    "It arrives already working. Whoever was held stays held, and everyone else is now on the list.",

  bolt_surge:
    "Armed on arrival: nothing sticks to it, and the first thing to touch it spends three rounds regretting the contact.",

  bolt_voltcher:
    "It discharges on first contact, and again on the way out. Arc files that under redundancy.",

  bolt_striik: // Highroller
    "A gambler with an engineer's odds. Three good rolls in one round and it stops being a fair fight.",

  bolt_thunder:
    "Nothing complicated. It arrives loud, and the noise carries to whoever was standing next to the target.",

  bolt_kore:
    "Named for the Core, and the only thing in the city that behaves like it. Break it and something is still discharging afterwards.",

  bolt_general:
    "Four weapons on one rack, and a new one selected every time he moves. Arc built the rack; the choosing is his.",

  bolt_volta:
    "It does not fight so much as install. With a rod on the grid, its own current goes through anything.",

  // ------------------------------------------------------------------ RARE

  bolt_zap: // the CARD — the cost-1 spell keys itself below
    "Two points of health and one job, discharged on arrival.",

  bolt_twotales: // Twintail
    "Two tails, one contact each, and even odds you do not move afterwards.",

  bolt_stingray:
    "Against anything already carrying a charge, armour stops being part of the calculation.",

  bolt_junker:
    "Scrap welded into a shape that objects to being touched.",

  bolt_rodd:
    "A rod in the ground. It does not move and it does not aim, and everything wired beside it hits harder.",

  bolt_zipp:
    "It brings its own drone. Arc stopped issuing engineers without one.",

  bolt_drshock:
    "He meets everything at the door and puts a charge on it before it has taken a step.",

  bolt_electricel:
    "One touch on arrival, and somebody spends two rounds working out what happened.",

  bolt_jolt:
    "It charges the whole room before the first round, and anything that hits it gets topped up.",

  bolt_scrapper:
    "It builds its own armour out of whatever it has put down.",

  bolt_ning: // Twinbolt
    "One good hit is specified to produce a second. Once a round and no more — Arc is strict about duty cycles.",

  bolt_staticcloud: // Static Cloud
    "Nobody steers it. It rolls one slot forward each round and discharges into whoever it happens to be near.",

  bolt_buzz:
    "Armed once at the factory, and once more by hand when it matters.",

  bolt_jellyfish:
    "Hitting it discharges into you and into everyone near you. It does not have to survive well — only survive.",

  bolt_buzzard:
    "Every arrival is logged, tagged with one point of damage, and assigned a drone.",

  // ---------------------------------------------------------------- TOKENS

  bolt_static_wisp_tok: // Static Wisp
    "What is left over when a Core body fails. It drifts forward and keeps discharging until it doesn't.",

  bolt_drone_tok: // Drone
    "Arc issues them by the crate. One point of everything, and entirely replaceable.",

  bolt_beebot: // Beebot
    "It stings once and the shift is over. The hive was built expecting that.",

  // ---------------------------------------------------------------- SPELLS

  "spell:bolt_zap":
    "Three points and two rounds of standing still. The cheapest line item in the catalogue.",

  bolt_recon_ping:
    "You cannot wire what you have not surveyed. For one round, the whole hand is on the table.",

  bolt_rewire:
    "Two of yours, swapped where they stand. Not a spell so much as a correction.",

  bolt_overload_field:
    "A live row for three rounds. Fly it or shoot across it — walking in earns two rounds of nothing.",

  bolt_power_rebate:
    "Magic in, gold out. BOLT is the only nation that files the two as the same substance.",

  bolt_power_grid:
    "On the grid everything of yours costs less and hits harder. That is the entire argument for the grid.",

  bolt_lightning_storm:
    "Eight to everybody and two rounds of nobody moving. Not subtle, and not meant to be.",

  bolt_full_reroute:
    "Two of your cards, anywhere, at once. Their speed was never the limiting factor — the routing was.",

  bolt_system_override:
    "Every cooldown cleared and every price cut, for one round. Somebody in Voltis Plaza signed off on this.",

  bolt_total_network_control:
    "Two rounds of silence on their side, and your grid never pays full price again.",

  bolt_havoc:
    "The current has somewhere to be. Standing in the way is not a plan.",
};

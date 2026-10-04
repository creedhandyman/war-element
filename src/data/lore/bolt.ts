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
  bolt_velvolt_knight:
    "A knight in live plate. It electrifies every enemy for good, and whoever first breaks its armour gets paralyzed.",
  bolt_elecdroid:
    "ARC itself: one 15-damage strike, a four-hit combo that chains on a kill, and sparks that hit everyone in reach each round.",
  bolt_keeper:
    "Keeper of the hive. It raises a Beebot every round, and the bots soak half the damage aimed at him.",
  bolt_shock:
    "Blackout shuts down every enemy at 4 HP or less each round, and its Fryer hits them all and mutes them.",
  bolt_jack_arc:
    "Arc's field engineer. One enemy is paralyzed every round as routine, and StunGun holds three more at once.",
  bolt_zoez:
    "Voltedge hits back: melee attackers take 3, half of ranged shots are deflected, and its bladerang hits for 7 plus 7 over time.",
  bolt_stormcaller:
    "Stormcaller calls the storm down on the held: Chain Paralysis freezes up to three enemies, and every paralyzed one takes 2 each round.",
  bolt_gigavolt:
    "A 35-HP wall with no weapon at first. Turret Mode zaps every enemy for 3 rounds, and it gains +1 DMG each round.",
  bolt_voltogon:
    "The dragon. It flies over melee, Gigavolt Strike hits for 11 and heals 11, and each kill burns every charged enemy for 5.",
  bolt_zagphu:
    "Ricochet bounces off a status: Static Toss hits for 8 and paralyzes, and its basics crit and heal 4 against anything afflicted.",
  bolt_static:
    "Static spreads: Discharge paralyzes every enemy in range, and each kill adds a round to everyone still frozen.",
  bolt_webster:
    "Webster spins a web: Web Shock paralyzes up to three enemies, and its second hit on a target mutes it.",
  bolt_lytning:
    "Lytning cracks a whip: Whip Strike paralyzes everything in range, then each paralyzed enemy takes 2 more every round.",
  bolt_storm:
    "Storm marks whatever it hits, then Thunder Strike deals 5 to every marked enemy anywhere. It grows stronger each round.",
  bolt_sentry:
    "A sentry gun that fires only at paralyzed enemies: 5 damage at the end of every round, and 5 to all of them with its Special.",
  bolt_thundercat:
    "ThunderCat pounces: Claw Surge leaps up to 2 spaces onto its target for 8, and its claws leave a stinging damage-over-time.",
  bolt_shoksa:
    "Dynamo keeps the current running. On arrival it extends every paralysis and electrifies the rest, which then take 2 each round.",
  bolt_surge:
    "Surge arms itself: while charged it ignores status, and the first hit on it paralyzes the attacker for 3 rounds.",
  bolt_voltcher:
    "A thunderbird. It flies over melee, Thunderbird hits a whole row for 3, and it fires once more for free on its first hit and when it dies.",
  bolt_striik:
    "Highroller gambles on crits: each crit fires Purple Strikes for free, and three crits in one round grant +7 HP and +2 DMG.",
  bolt_thunder:
    "Thunder arcs: Arcing Strike hits one target for 7 and its neighbours for 4, and it arrives with 3 damage to everything in range.",
  bolt_kore:
    "Kore is the reactor. Its shield grows every round, Core Overload paralyzes everything in range, and a Static Wisp is left when it dies.",
  bolt_general:
    "General swaps weapons: each time he moves he cycles through four guns, and Spraying Thunder fires the current one at the 3 closest enemies.",
  bolt_volta:
    "Volta builds Rodds: one on arrival, another with Grid Deployment, and its shots pierce armour while a Rodd stands.",
  bolt_zap:
    "Zap hits first. The moment it lands, 5 damage goes to the nearest enemy.",
  bolt_twotales:
    "Twintail swings twice, and each hit has a 50% chance to paralyze.",
  bolt_stingray:
    "Stingray's sting pierces armour on any enemy that is already electrified.",
  bolt_junker:
    "A scrap wall that stands in front. Anything that hits it in melee takes 2 back.",
  bolt_rodd:
    "A lightning rod. It pings the closest enemy for 1 each round, and adjacent BOLT allies gain +1 DMG.",
  bolt_zipp:
    "Zipp zips in with a Drone: summoning it puts a free Drone on the board.",
  bolt_drshock:
    "Dr. Shock zaps new arrivals: any enemy summoned in his range is electrified at once.",
  bolt_electricel:
    "Electricel shocks on contact. On arrival it paralyzes the nearest enemy for 2 rounds.",
  bolt_jolt:
    "Jolt is a live wire: it electrifies every enemy in range when battle begins, and anything that hits it is electrified back.",
  bolt_scrapper:
    "Scrapper hits and salvages: a 50% chance to paralyze, and every kill adds 2 shields.",
  bolt_ning:
    "Twinbolt strikes twice: a crit chains a second 2-damage crit at the same target, once a round.",
  bolt_staticcloud:
    "Static Cloud drifts one slot forward each round, zapping a random enemy for 4 and paralyzing a random enemy for 2 rounds.",
  bolt_buzz:
    "Buzz starts armed: immune to status, and the first hit on it paralyzes the attacker for 3 rounds. Once per game it re-arms.",
  bolt_jellyfish:
    "Jellyfish stings back: when hit and it survives, it shocks the attacker and the enemies beside it for 2.",
  bolt_buzzard:
    "Buzzard circles new arrivals: whenever an enemy is summoned, it answers with a Drone and 1 damage.",
  bolt_static_wisp_tok:
    "A leftover of Kore's core. It drifts forward each round, zapping a random enemy for 2 and paralyzing another for a round.",
  bolt_drone_tok:
    "Arc issues them by the crate: a 1-HP flyer that melee cannot reach.",
  bolt_beebot:
    "Beebot stings once: its hit keeps damaging for 2 rounds, and then it dies at the end of that round.",
  "spell:bolt_zap":
    "Three damage and two rounds of standing still, for the price of 1.",
  bolt_recon_ping:
    "Look at their whole hand this round, and your Specials cost 1 less while you plan around it.",
  bolt_rewire:
    "Two of yours, swapped where they stand. Not a spell so much as a correction.",
  bolt_overload_field:
    "A row of live current for 3 rounds. Anything that walks in takes 2 and is paralyzed; fliers and ranged shots pass over.",
  bolt_power_rebate:
    "Magic in, gold out. BOLT is the only nation that files the two as the same substance.",
  bolt_power_grid:
    "For 3 rounds your BOLT Specials cost 1 less, and electrified foes take +3 instead of +2.",
  bolt_lightning_storm:
    "Eight to everybody and a round of nobody moving. Not subtle, and not meant to be.",
  bolt_full_reroute:
    "Reroute any two of your cards to open slots anywhere on the board, however slow they are.",
  bolt_system_override:
    "For one round your Specials cost 3 less, and every ally's Special comes off cooldown. Voltis Plaza signed off on this.",
  bolt_total_network_control:
    "Their whole side is muted for 3 rounds, and from now on your BOLT Specials cost 1 less.",
  bolt_havoc:
    "Havoc fires wild: ThunderShot hits any target for 7 and paralyzes it, and mutes it too if it already had a status.",
  bolt_firebolt_tok:
    "A flying drone whose hits set the target burning, and which explodes for 4 on everything in reach when it dies.",
  boss_overclock:
    "A production line with a gun. Every 3 rounds it stamps out Firebolt Drones, and the line does not stop for losses.",
  bolt_hacker:
    "Hacker hides in stealth, and once per game Kill Switch locks every enemy out of their Specials for 2 rounds.",
  bolt_handyman:
    "Handyman fixes things: once per game Patch Job gives allies in range +2 shields and 4 HP, and ARC allies always carry +1 shield.",
  bolt_kingpin:
    "Kingpin puts out a contract: it marks any enemy and paralyzes it, every basic on the mark is a crit, and you collect gold when it dies.",
  bolt_airship:
    "The helicopter flies over melee, airlifts an ally into its place, and its spotlight means nothing on the other side can hide.",
  bolt_policecar:
    "Police Car calls for backup: its Special and the first hit on it each round put Officers beside it, up to 3 at a time.",
  bolt_police_tok:
    "Officer tasers its target: half its hits paralyze for 2 rounds.",
};

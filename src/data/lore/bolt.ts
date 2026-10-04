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
 * Coverage: 46 cards (bosses included) + 5 tokens + 10 spells = 61 entries, which is all of BOLT.
 */

export const BOLT_LORE: Record<string, string> = {

  // ---------------------------------------------------------------- MYTHIC

  bolt_velvolt_knight:
    "Plate that reports its own faults. Everything that enters is electrified for the match, and whoever first breaks the armour is paralyzed.",
  bolt_elecdroid:
    "ARC itself. One strike of fifteen, a four-hit combo that carries on to the next enemy on a kill, and a quarter of it leaking to all in reach each round.",

  // ------------------------------------------------------------- LEGENDARY

  bolt_keeper:
    "The hive is the armour. It raises a Beebot every round, and the bots take half of whatever is aimed at him.",
  bolt_shock: // Blackout
    "Anything at four HP or under goes dark at the start of every round. Fryer mutes the rest of the grid. It does not need everyone, only the failing.",
  bolt_jack_arc:
    "Arc's field engineer. Every round one enemy stops working and he files it as routine. StunGun does three at once.",
  bolt_zoez: // Voltedge
    "Half the shots aimed at it go elsewhere, and melee pays on contact. The bladerang is the follow-up.",
  bolt_stormcaller:
    "Chain Paralysis holds up to three, then it bills everything held, every round, for standing there.",
  bolt_gigavolt:
    "Arrives with no weapon and no legs, and is measurably worse every round it is left standing. Turret Mode electrifies and burns every enemy for three rounds.",
  bolt_voltogon:
    "The only dragon on the payroll. It flies over melee, Gigavolt Strike heals what it hits, and each kill burns everyone still carrying a charge.",

  // ------------------------------------------------------------------ EPIC

  bolt_zagphu: // Ricochet
    "It waits for something else to leave a status on you, then hits exactly there: crits, and heals off it. Static Toss supplies the status itself.",
  bolt_static:
    "Everything in range is paralyzed, and every one it finishes buys the rest of the field another round of standing still.",
  bolt_webster:
    "Web Shock pins up to three in place, and the second hit on any of them takes its voice. The first hit is the wire.",
  bolt_lytning:
    "It cracks the whip once to stop everything in range, then reads the meter: two more off every paralyzed enemy, every round.",
  bolt_storm:
    "Cheap, and it marks everything it touches. Thunder Strike then reaches every marked enemy anywhere, and it outgrows its price within a few rounds.",
  bolt_sentry:
    "It does not aim at people, only at what has stopped moving, which is a simpler specification. Its Special hits every paralyzed enemy in range.",
  bolt_thundercat:
    "It lands on the target rather than approaching it, and what the claws leave behind keeps ticking.",
  bolt_shoksa: // Dynamo
    "It arrives already working: every paralysis on the board runs a round longer, everyone else is marked, and the marked pay every round.",
  bolt_surge:
    "Armed on arrival: nothing sticks to it, and the first thing to touch it spends three rounds regretting the contact.",
  bolt_voltcher:
    "A thunderbird: it flies over melee and strikes a whole row, and fires again free on its first hit and on the way out. Arc files that under redundancy.",
  bolt_striik: // Highroller
    "A gambler with an engineer's odds. Every crit fires Purple Strikes free, and three good rolls in one round stops being a fair fight.",
  bolt_thunder:
    "It arrives loud, with a hit on everything in range, and Arcing Strike carries the noise to whoever was standing next to the target.",
  bolt_kore:
    "Named for the Core, and the only thing in the city that behaves like it. Shield growing, Core Overload paralyzing all in range, a Static Wisp left when it breaks.",
  bolt_general:
    "Four guns on one rack, a new one selected every time he moves. Spraying Thunder fires whichever is up at the three closest.",
  bolt_volta:
    "It does not fight so much as install: a Rodd on arrival, another on demand, and its shots go through armour while one stands.",

  // ------------------------------------------------------------------ RARE

  bolt_zap: // the CARD — the cost-1 spell keys itself below
    "A hooded runner with a live blade. It lands knife-first on the nearest enemy, and the rest of it is not important.",
  bolt_twotales: // Twintail
    "Two swings, and each one is a coin flip between a bruise and a paralysis.",
  bolt_stingray:
    "Armour stops being part of the calculation once the target is already electrified.",
  bolt_junker:
    "Scrap welded into a shape that objects to being touched. Melee hits on it come straight back.",
  bolt_rodd:
    "A rod in the ground. It pings the nearest enemy each round, and the BOLT ally beside it hits harder.",
  bolt_zipp:
    "It brings its own drone. Arc stopped issuing engineers without one.",
  bolt_drshock:
    "He meets every arrival at the door and puts a charge on it before it has taken a step.",
  bolt_electricel:
    "One touch on arrival, and somebody spends two rounds working out what happened.",
  bolt_jolt:
    "It charges the whole room before the first round, and anything that hits it gets topped up.",
  bolt_scrapper:
    "Half its hits paralyze, and it builds its own armour out of whatever it has put down.",
  bolt_ning: // Twinbolt
    "A crit is specified to produce a second, at the same target. Once a round and no more; Arc is strict about duty cycles.",
  bolt_staticcloud: // Static Cloud
    "Nobody steers it. It rolls one slot forward each round, zapping one enemy and paralyzing another as it passes.",
  bolt_buzz:
    "Armed at the factory: status-immune, and the first hit on it paralyzes the attacker. Once per game, re-armed by hand.",
  bolt_jellyfish:
    "Hit it and it discharges into you and everyone beside you. It does not have to survive well, only survive.",
  bolt_buzzard:
    "Every arrival is logged, tagged with a point of damage, and assigned a drone.",

  // ---------------------------------------------------------------- TOKENS

  bolt_static_wisp_tok: // Static Wisp
    "What is left when a Core body fails. It drifts forward, zapping one enemy and paralyzing another, until it doesn't.",
  bolt_drone_tok: // Drone
    "Arc issues them by the crate: a 1-HP flyer that melee cannot reach.",
  bolt_beebot: // Beebot
    "A sting that keeps hurting, and then the bot is done. The hive was built expecting that.",

  // ---------------------------------------------------------------- SPELLS

  "spell:bolt_zap":
    "Three points and two rounds of standing still. The cheapest line item in the catalogue.",
  bolt_recon_ping:
    "You cannot wire what you have not surveyed. Their whole hand is on the table this round, and your Specials run cheaper while you plan.",
  bolt_rewire:
    "Two of yours, swapped where they stand. Not a spell so much as a correction.",
  bolt_overload_field:
    "A live row for three rounds. Whatever walks in is hurt and stopped; fliers and ranged shots pass over.",
  bolt_power_rebate:
    "Magic in, gold out. BOLT is the only nation that files the two as the same substance.",
  bolt_power_grid:
    "For three rounds your BOLT Specials run cheaper and electrified foes take more. That is the entire argument for the grid.",
  bolt_lightning_storm:
    "Eight to everybody and a round of nobody moving. Not subtle, and not meant to be.",
  bolt_full_reroute:
    "Any two of your cards, anywhere, at once. Their speed was never the limiting factor; the routing was.",
  bolt_system_override:
    "For one round every Special is cheaper and every cooldown is cleared. Somebody in Voltis Plaza signed off on this.",
  bolt_total_network_control:
    "Three rounds of silence on their side, and your grid never pays full price again.",
  bolt_havoc:
    "ThunderShot goes anywhere on the board and stops what it hits, and silences it if it was already afflicted. Standing in the way is not a plan.",
  bolt_firebolt_tok:
    "Shipped with a warranty. The warranty is the explosion.",
  boss_overclock:
    "A production line with a gun. Every 3 rounds it stamps out Firebolt Drones, and the line does not stop for losses.",
  bolt_hacker:
    "Out of sight until it strikes. Once per game, Kill Switch leaves every enemy Special listed but not resolving.",
  bolt_handyman:
    "Fault found, part replaced, twelve seconds. Once per game Patch Job plates and repairs every ally in range; ARC units carry spares.",
  bolt_kingpin:
    "The contract names one card and one outcome: marked anywhere, stopped, and every basic on it a crit. Gold goes to whoever fills it.",
  bolt_airship:
    "Lift capacity: one ally, swapped into its place. It flies over melee, and the spotlight leaves nothing on the other side hidden.",
  bolt_policecar:
    "Unit responding. Units responding. Each call for backup puts Officers beside it, up to three: a dispatch log, not a boast.",
  bolt_police_tok:
    "Badge, taser, twelve weeks of training. Half its hits paralyze, which is sufficient.",
};

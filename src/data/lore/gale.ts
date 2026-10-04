/**
 * GALE card & spell lore.
 *
 * Keyed by card id, merged onto CardDef.lore / SpellDef.lore at load — see
 * ./index.ts. NOTE the one `spell:` key below: `gale_tempest` is both a card and
 * a spell, so the spell claims its own line explicitly.
 *
 * VOICE RULES — GALE
 *   1. GALE does not threaten. It has already moved. Lines imply *first*,
 *      *already*, *gone* — where LEAF's imply later and PYRO's imply now.
 *   2. Weather is the neighbour, not a metaphor. Survival is the only credential
 *      the nation recognises: you are still here, and the storm hasn't taken you.
 *   3. Mechanic-tied: the line should telegraph what the card does before the box
 *      is read.
 *   4. Place attribution (the Amberleaf, Stormwatch, the highland farms, the
 *      wyvern nurseries) only where the kit leans one.
 *   5. 1-2 sentences. Under ~150 chars where possible — card frames are small.
 *   6. No ceremony and no boasting. GALE thanks things; it does not worship them,
 *      and it never mentions being fast. It simply got there first.
 *
 * Coverage: 49 cards (bosses included) + 6 tokens + 10 spells = 65 entries, which is all of GALE.
 */

export const GALE_LORE: Record<string, string> = {
  // ---------------------------------------------------------------- MYTHIC

  gale_stormfang:
    "Stormfang is in your row before the call is finished, and the foes beside his target feel it too. Every wolf in the pack hits harder for it.",

  gale_griffith: // Skyrend
    "Skyrend comes down out of the sky on one foe, takes a little of it back, and vanishes into the cloud. Every bird in the sky flies harder for him.",

  // ------------------------------------------------------------- LEGENDARY

  gale_tempest: // the CARD — the cost-10 spell keys itself below
    "Three slots of open ground mean nothing to it, and armour less. Half your swings find only the place it was.",

  gale_eagon:
    "Strike Eagon and the wind may hand half the blow back to you. His Dark Wind Wave drags the far row in toward your side.",

  gale_totem:
    "Nothing the band shoots misses under its eye: not the hidden, not the far. It plants a Totem Pole where it lands.",

  gale_galeon:
    "It never needs to reach you. Every round the whole field stands a step further back than it chose, and Mighty Winds adds two.",

  gale_klipso:
    "The first meeting is the expensive one: a feather blade through armour, then a stun. Half of what you swing back finds nothing.",

  gale_bluejay:
    "Whatever lands in her range takes an arrow before it has unpacked, and every kill leaves her a little stronger for good.",

  gale_kloud:
    "It raises a Thundering Hurricane over your foes, and every Mage and Ranger on your side shoots a little harder under it.",

  // ------------------------------------------------------------------ EPIC

  gale_vaga: // Squall
    "Come close and it is a fight; shoot from range and there was never anything there. It finishes whatever is already going.",

  gale_buf: // Hornrush
    "A highland animal, bred behind the windbreaks. It walks over anything smaller, mends as it goes, and Horn Toss lays two foes flat.",

  gale_angale:
    "Her wind surge leaves everything in range weaker and a step back, and anyone who lays a hand on her walks away weaker too.",

  gale_sway:
    "She never lands alone: the little Ollies shoot wherever the ally behind them does. Birds of Prey sends three more.",

  gale_guan: // Dreadgaze
    "It holds the front line, and the foes ahead are weaker the moment they see it. Vision of Fear lets the whole board see it again.",

  gale_rayfen:
    "There is no distance in this sky, only open slots. It moves to any of them, and Ambush reaches three foes anywhere, through armour.",

  gale_fano: // Fanwing
    "The fan is not for striking. Slower teammates act as early as she does for a round, and her hits sometimes weaken.",

  gale_vvulture: // Vulture
    "It does not hunt so much as wait. Every death on the field leaves it sturdier, and Roosting Wing Shield mends what is left.",

  gale_masala: // Mesala
    "One Toxhawk at a time, never a new one while the last still flies. The nurseries are strict, and Razor Wind Talon leaves the back row hurting.",

  gale_wolfbane:
    "Whirlwind Slasher cuts every foe on the board and sends each back a step. Against anything it beats to the move, a crit also heals it.",

  gale_wista: // Zephyra
    "She throws once and the wind decides how many it lands on, so long as they stand close. Every hit shoves its target out of formation.",

  gale_omega:
    "It arrives bigger than its papers say, and Search and Destroy walks it deep into your side for one heavy hit. It does not plan on walking back.",

  // ------------------------------------------------------------------ RARE

  gale_skyforce:
    "A thin cut for every foe in range on the way in, then it stays up where melee cannot reach.",

  gale_hawko:
    "A permanent opinion about whatever just landed in range, delivered from a perch no melee can reach.",

  gale_sirocco:
    "It does not kill anything: every blow it lands blows the target back to its own home row. On arrival it calls a bigger GALE card down from your deck.",

  gale_syt_bird: // Sightwing
    "It flies into the middle rows and calls the targets, so for a round every ally's basic attack also catches a neighbour.",

  gale_gastly:
    "It steps into the wind on arrival and the wind agrees not to mention it. One round of that, then it holds the front line.",

  gale_swillow:
    "It does its whole job on the way in, a dive on the nearest foe, then spends the battle as a very small bird out of melee's reach.",

  gale_duster:
    "It brings nothing but a tailwind, and the tailwind is why the others got there first.",

  gale_toxhawk:
    "The talons are the smaller problem: every hit leaves a poison that keeps working after it has flown on.",

  gale_tumbleweed:
    "Nothing out here is anchored, including this. Once a game it rolls straight through a foe and out the far side; half of what's thrown at it misses.",

  gale_stormhide_bison:
    "Hide thick enough to take something off every gust. The wind has tried to move it for years, and it walks over anything smaller.",

  gale_megair:
    "It is at its worst nearly dead: once a game, a hit from the edge of death sends the whole enemy line reeling back.",

  gale_breeze: // Nightwing — the id predates the card; see cards.ts
    "It hunts the long way round, downwind and patient. Every round it takes a little of every foe beside it, for good, and keeps it.",

  gale_luna: // Wolf
    "The pack's youngest hunter. Every kill patches her up and leaves her a little bigger for the next.",

  gale_hawk: // Stormquill
    "The quills are the least of it. Past a certain pace she hits like something much heavier, and Glide Rush finds her that pace once a game.",

  gale_whirlwolf:
    "Half wolf, half weather: the pack beside it gets a tailwind as it lands, and once a game Wave Pounce leaves every foe scratched and weaker.",

  gale_windsor:
    "Hitting him costs you something at any range: you leave weaker, and now and then half the blow is handed back.",

  gale_wailverine:
    "Whatever stands directly ahead gets gored every round, and if it drops, the ground changes hands.",

  gale_klouy: // Spindrift
    "The first hit is spray; the second stops you where you stand. Once a game Spiraling Windrow bounces between foes standing close.",

  // ---------------------------------------------------------------- TOKENS

  gale_ollie:
    "It has no plan of its own: it shoots at whatever the ally behind it shoots at.",

  gale_totem_pole:
    "Planted where the Totem set it, facing forward: it strikes the row ahead each round and wards its neighbours.",

  gale_toxhawk_tok: // Raptor
    "A Raptor from Mesala's nest. Small, high, and whatever its talons touch keeps hurting.",

  // ---------------------------------------------------------------- SPELLS

  gale_gust:
    "Barely a spell: a small hit and a shove, mostly about where you would rather they were standing.",

  gale_downdraft:
    "The air drops out from over a whole row, and everything in it swings softer for a while.",

  gale_tailwind:
    "GALE's oldest courtesy: every ally of ours goes ahead of the rest. Nobody in this nation considers that a favour.",

  gale_squall_line:
    "Three rounds of wind across a row: whatever moves in gets hurt and pushed back, flyers too. Shots pass over.",

  gale_storm_front:
    "It hurts a little and leaves everything a step behind for the round, which in this nation is the same as hurting a lot.",

  gale_jetstream:
    "For three rounds, stand in the right current: your wings act sooner and every shove carries a space further.",

  gale_vortex_strike:
    "Straight through the plate, and then a round of standing very still.",

  gale_gale_force:
    "Two rows at once. Everything weaker, everything one pace back, nothing where it wanted to be.",

  gale_cyclone:
    "Heavy damage across the whole side, and then, for one round, nothing over there acts until you have.",

  "spell:gale_tempest":
    "The full storm, once: the far side takes a great deal and stops dead for the round, and every wing on your side acts sooner for the rest of the game.",

  gale_dreamcatcher:
    "It takes the loudest thing in the room first, every round. Soul Snare puts the rest to sleep.",

  // ── Void Tower bosses ──
  boss_nightshrike:
    "Every third round it dives on two of you, and one wingbeat is the only warning. Between dives it feeds on the weakest beside it.",

  // ── Void Tower bosses ──
  boss_thunderfangs:
    "It never hunts alone. Every third round Thunder Run shocks everyone close, and each wolf at its side adds to the bite.",

  boss_thunderfangs_2:
    "Five kills, and the storm stopped following it around. Thunder Run hits harder now, and the pack keeps growing.",

  gale_sparkwolf_tok:
    "You hear the pack before the weather turns, and every bite leaves its target electrified.",

  gale_whirlwind_warrior_tok:
    "Every leaf in it was somebody's cover. It holds the front line, and every hit shoves its target back a step.",

  boss_skybreaker:
    "Every third round it trades places with its own Thundering Hurricane, and whoever is near the landing is paralyzed.",

  gale_thundering_hurricane_tok:
    "A storm on the board: it lands hard and paralyzes, pushes the whole line back every other round, and splashes beside its target.",

  // -- the forty-card pass --
  gale_goldspur:
    "A Falcon lands beside it, and both barrels go at the two nearest foes before the challenge is finished, each shot free to crit.",
  gale_leeward:
    "Windbreak shelters it and the allies beside it. Hit it hard and it answers with a gust: the foes around it are weaker and a step back.",
  gale_aerostat:
    "Sandbags overboard: three foes in range are hit, stunned and shoved back. Bring it down and it bursts, stunning whoever is beside it.",
  gale_gyre:
    "Its whirl holds the nearest foe back every round, and once a game the eye opens and drags up to three in, stunned.",
  gale_falcon:
    "It was above you a moment ago. Any adjacent foe too hurt to survive its blow is taken, square and all; once a game it punches through armour.",
};

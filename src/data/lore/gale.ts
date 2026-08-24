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
 * Coverage: 39 cards + 3 tokens + 10 spells = 52 entries, which is all of GALE.
 */

export const GALE_LORE: Record<string, string> = {
  // ---------------------------------------------------------------- MYTHIC

  gale_stormfang:
    "The pack runs at his speed, which is the only rank GALE recognises. The faster he gets, the harder it lands.",

  gale_griffith: // Skyrend
    "He comes down out of his own sky, takes the recoil without comment, and is gone before the dust decides which way to fall.",

  // ------------------------------------------------------------- LEGENDARY

  gale_tempest: // the CARD — the cost-10 spell keys itself below
    "Three slots of open ground mean nothing to it. Whatever the armour was, it went straight through.",

  gale_eagon:
    "Hit him and half of it comes back on the wind. The Dragons taught him that; the birds taught him not to explain it.",

  gale_totem:
    "Raised where the storm is loudest, watching over the war band. Nothing under its eye misses — not the hidden, not the far.",

  gale_galeon:
    "It does not need to reach you. Every round, the whole field is standing one step further back than it chose to.",

  gale_klipso:
    "The first meeting is the expensive one. After that you know to watch the feathers, which is already too late.",

  gale_bluejay:
    "Two strikes, and she decides on the way whether they land on one of you or two. Either way, nobody leaves quicker.",

  gale_kloud:
    "The storm does not pick a target, it picks a direction — and grows louder at every body it finds along the way.",

  // ------------------------------------------------------------------ EPIC

  gale_vaga: // Squall
    "Come close and it is a fight. Shoot from range and there was never anything there. It only finishes what is already going.",

  gale_buf: // Hornrush
    "A highland animal, bred behind the windbreaks. Slow, patient, mends itself, and puts you on the ground for two rounds.",

  gale_angale:
    "She does not swing back so much as take something out of you for trying.",

  gale_sway:
    "She never arrives alone, and the ones with her shoot at whatever she was looking at.",

  gale_guan: // Dreadgaze
    "It does not need to strike the front rank. It only needs them to have seen it coming.",

  gale_rayfen:
    "There is no distance in this sky, only open slots. It was on the far side of the field a moment ago because that suited it better.",

  gale_fano: // Fanwing
    "The fan is not a weapon. It is for the people behind her, who are suddenly moving at her speed.",

  gale_vvulture: // Vulture
    "It does not hunt so much as wait for the arithmetic. Everything that dies out here makes it a little larger.",

  gale_masala: // Mesala
    "One raptor at a time, and never a new one while the last still flies. The nurseries are strict about that.",

  gale_wolfbane:
    "It only crits what it can outrun, and it heals on every one. So it makes very sure it is the faster animal.",

  gale_wista: // Zephyra
    "She throws once and the wind decides how many times it lands — shoving each of them a step out of formation.",

  gale_omega:
    "It arrives already bigger than its papers say, walks into your half of the field, and does not plan on walking back.",

  // ------------------------------------------------------------------ RARE

  gale_skyforce:
    "Three thin cuts on the way in. The Sky Force does not carry anything heavier than it can fly with.",

  gale_hawko:
    "Three points of health and a permanent opinion about whatever just landed.",

  gale_sirocco:
    "It does not kill anything. It simply keeps putting you back where you started.",

  gale_syt_bird: // Sightwing
    "Two HP, no weapon worth the name. It flies into the middle and tells everyone where to shoot.",

  gale_gastly:
    "It steps into the wind on arrival and the wind agrees not to mention it. One round is usually enough.",

  gale_swillow:
    "It does its whole job in the first second, and spends the rest of the battle being a very small bird.",

  gale_duster:
    "It brings nothing but a tailwind, and the tailwind is why the others got there first.",

  gale_toxhawk:
    "The talons are the smaller problem. What they leave keeps working after it has flown on.",

  gale_tumbleweed:
    "Nothing out here is anchored, including this. Hard to catch, and it rolls straight through once.",

  gale_stormhide_bison:
    "Hide thick enough to take something off every gust. The storm has been trying to move it for years.",

  gale_megair:
    "It is at its worst nearly dead — one hit then, and the whole field takes a step back with it.",

  gale_breeze:
    "It carries the dust of the dry plains. Sometimes that is all it takes to make someone shoot at nothing.",

  gale_luna: // Wolf
    "The pack's youngest hunter. Every kill puts her back on her feet for the next one.",

  gale_hawk: // Stormquill
    "The quills are the least of it. Above a certain speed she starts hitting like something much heavier.",

  gale_whirlwolf:
    "Half wolf, half weather. It arrives and suddenly the whole pack is running faster than it was.",

  gale_windsor:
    "Hitting him at any range costs you something. He does not seem to mind which range you choose.",

  gale_wailverine:
    "It waits out the round, then gores whatever is directly ahead — and takes the ground if it drops.",

  gale_klouy: // Spindrift
    "The first hit is spray. The second one is what puts you down for two rounds.",

  // ---------------------------------------------------------------- TOKENS

  gale_ollie:
    "It has no plan of its own. It simply shoots at whatever the bird in front of it is shooting at.",

  gale_totem_pole:
    "Planted where the Totem set it, facing forward. Standing in front of it costs two a round and it never moves.",

  gale_toxhawk_tok: // Raptor
    "Bred one at a time in the cliff nurseries. Small, quick, and everything it touches keeps hurting.",

  // ---------------------------------------------------------------- SPELLS

  gale_gust:
    "Barely a spell. It is mostly about where you would rather they were standing.",

  gale_downdraft:
    "The air drops out from over a whole row, and everything in it swings softer for a while.",

  gale_tailwind:
    "GALE's oldest courtesy: you go ahead. Nobody in this nation considers that a favour.",

  gale_squall_line:
    "Three rounds of wind across a row. Fly it or shoot over it — walking in gets you moved.",

  gale_storm_front:
    "It hurts a little and slows everything, which in this nation is the same as hurting a lot.",

  gale_jetstream:
    "Stand in the right current and everything happens sooner, including whatever you were pushing.",

  gale_vortex_strike:
    "Straight through the plate, and then a round of standing very still.",

  gale_gale_force:
    "Two rows at once. Everything weaker, everything one pace back, nothing where it wanted to be.",

  gale_cyclone:
    "The damage is not the point. For one round nothing on that side of the board moves at all.",

  "spell:gale_tempest":
    "The full storm, once. Everything on the far side stops dead — and afterwards, every wing on your side is quicker for good.",

  gale_dreamcatcher:
    "It takes the loudest thing in the room first. Everything after that is quiet.",

  // ── Void Tower bosses ──
  boss_nightshrike: "You will hear one wingbeat. Payment is due on the second.",

  // ── Void Tower bosses ──
  boss_thunderfangs: "It never hunts alone, and it has never had to learn how.",

  boss_thunderfangs_2:
    "Five, and the storm stopped following it around.",

  gale_sparkwolf_tok:
    "You hear the pack before the weather turns. Only just before."
};

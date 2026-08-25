// War Element — engine types. Pure data, no React.

export type PlayerId = "P1" | "P2";

export type Element =
  | "LEAF"
  | "AQUA"
  | "PYRO"
  | "BORE"
  | "GALE"
  | "BOLT"
  | "DUSK"
  | "DAWN";

export type CardClass =
  | "Assassin"
  | "Warrior"
  | "Tank"
  | "Ranger"
  | "Mage"
  | "Support";

export type AttackType = "Melee" | "Ranged";

export type Keyword =
  | "CRIT"
  | "PEN"
  | "FLYING"
  | "STEALTH"
  | "LIFESTEAL"
  | "REGEN"
  | "BLOCK"
  | "REFLECT"
  | "EVASION"
  | "DRAIN"
  | "TRAMPLE";

/** Prism's four single-use weapon buffs. Each is spent by the next basic
 *  attack the holder makes, and only one can be armed at a time. */
export type EnchantMode = "freezing" | "burning" | "sleeping" | "sharpen";

export type StatusKind =
  | "ROOT"
  | "BLEED"
  | "BURN"
  | "SCALD"
  | "DOT" // generic, element-free
  | "FREEZE"
  | "STUN"
  | "WEAKEN"
  | "PARALYZE"
  | "MUTED"
  | "SLEEP"
  | "FRIGHTEN"
  | "BLIND"
  | "SEAL" // Bluflame (Sarra): cannot be healed while sealed
  /** Electrified (Jolt): inert on its own — it exists to BE a status, so BOLT's
   *  Electrify aura (+1 DMG vs any statused target) picks the marked card up. */
  | "ELECTRIFIED"
  // Buff statuses — a temporary grant of the like-named keyword, ticked down at
  // Cleanup (Dive Bomb → STEALTH, Shadow Charge → EVASION).
  | "STEALTH"
  | "EVASION";

/** Negative statuses — the ones Radiant Ward absorbs and Crowned cleanses.
 *  (STEALTH/EVASION are self-buffs and are excluded.) */
export const NEGATIVE_STATUSES: StatusKind[] = [
  "ROOT", "BLEED", "BURN", "SCALD", "DOT", "FREEZE", "STUN", "WEAKEN",
  "PARALYZE", "MUTED", "SLEEP", "FRIGHTEN", "BLIND", "SEAL", "ELECTRIFIED",
];

export interface StatusEffect {
  kind: StatusKind;
  duration: number; // rounds remaining; ticks down in Cleanup
  power: number; // DOT damage per round / stat delta; 0 when N/A
  source: Element;
}

export interface SpecialDef {
  name: string;
  cost: number; // paid from the MAGIC pool in Battle Phase
  handler: string; // key into the handler registry in combat.ts
  params?: Record<string, number | string>;
  /** "self" = the caster is the only target. Use it for Specials whose handler
   *  ignores `targets` entirely (empower, spawn, burrow); marking those "ally"
   *  makes the UI demand a pick from every ally on the board for an effect that
   *  never touches them. */
  targetSide: "enemy" | "ally" | "self";
  /** This special reaches like a Ranged attack (any slot) even on a Melee
   *  card — for "hit anywhere on the board" specials. */
  ranged?: boolean;
  /** Rounds locked out after firing. Omit for the standard 1-round floor;
   *  a card may print a longer cooldown (2/3/5). */
  cooldown?: number;
  /** Talent mode: the Special is FREE and fires only ONCE per game (no magic
   *  cost, no cooldown, gone after one use). Used when an Epic is demoted to
   *  Rare — its Special becomes a one-shot Talent. Reuses `card.talentUsed`. */
  talent?: boolean;
  text: string; // human-readable card text
}

/** Status a basic attack applies. Optional gating restores the printed
 *  "50% chance", "first time only", or "on the 2nd hit" riders. */
export interface OnHitStatusDef {
  kind: StatusKind;
  duration: number;
  power: number;
  chance?: number; // 0–100; omit = always
  firstHitOnly?: boolean; // only the first basic hit vs a given target each round
  onSecondHit?: boolean; // only from the 2nd+ basic hit vs a target in a round
  /** ADD this power onto an existing same-kind status instead of replacing it
   *  (Thorn's cumulative BLEED — each basic deepens the wound). */
  stack?: boolean;
  stackCap?: number; // ceiling for the stacked power
}

/** Thorns / retaliation when this card is hit by a MELEE attacker. */
export interface OnHitByMeleeDef {
  /** Answer RANGED attackers too (Windsor's Right Through Me, Jolt's
   *  Electrifying). Default false keeps the classic melee-only thorns. */
  anyAttacker?: boolean;
  chance?: number; // 0–100; omit = always
  dmg?: number; // direct damage back to the attacker
  pen?: boolean;
  status?: { kind: StatusKind; duration: number; power: number };
  doubleBurn?: boolean; // Hot Hot (Spitfire): double the attacker's BURN power
  spDrain?: number; // Fountain (Oxin): sap N SP from the melee attacker
}

/** Fires when this card's basic/special attack KILLS an enemy (per kill). */
export interface OnKillDef {
  buffDmg?: number; // permanent +DMG (stacks)
  buffDmgRound?: number; // +DMG for the rest of the round
  buffSp?: number; // permanent +SP
  buffHits?: number; // permanent +1 basic hit (stacks)
  buffMaxHp?: number; // permanent +max HP (Pyrogon)
  healSelf?: number; // heal self N
  gainShields?: number;
  aoeDmg?: number; // deal N to every reachable enemy
  blindInRange?: number; // Star Blaster (Zenith): BLIND nearby enemies N rounds
  /** Perpetual Fog (Driftwraith): a kill cloaks it (and same-row same-element
   *  allies) in STEALTH for N rounds. */
  grantStealth?: number;
  /** Powertrip (Voltogon): deal N to every ELECTRIFIED enemy (= carrying any
   *  status, the BOLT proxy), at most once per round. */
  aoeDmgElectrified?: number;
  /** Harvester (Wedded Wraith): every kill raises another token. */
  spawnToken?: { token: string; count: number; maxAlive?: number; everyNKills?: number };
  /** Quadruple Strike (Birch): on a kill, hit the CLOSEST surviving enemy for
   *  dmg×hits (a shield-shredding follow-up, distinct from aoeDmg's spray). */
  nearestVolley?: { dmg: number; hits: number };
  /** `everyNKills`: raise one only on every Nth kill, not on all of them.
   *
   *  The DETERMINISTIC form of "sometimes". Void Tower requires its bosses to
   *  roll no dice (`chanceProblems` pins it, and the design doc replaced its own
   *  50% rolls with deterministic effects for exactly this reason), so a
   *  chance-based pack is not available here — but "every other kill" gives the
   *  same every-so-often feel and stays readable: the player can count it. */
  /** Infinite Serpent (Hydrogon): on a kill, snipe the LOWEST-HP surviving
   *  opponent for `lowestHpDmg` — the serpent finishes the weak. */
  lowestHpDmg?: number;
  coinBonusDmg?: number; // coin flip: +this or +this−1 permanent DMG
  /** King of Sunfall Harbor (Scallywag): a coin flip between two DIFFERENT
   *  stats — armour or teeth — where coinBonusDmg only ever chooses between two
   *  sizes of the same one. Both permanent, both stacking with every kill.
   *
   *  Its own field rather than a flag on coinBonusDmg because the two answer
   *  different questions: BlackBeard's coin is "how much DMG", this one is
   *  "which stat", and folding them together would make either card's number
   *  ambiguous to read off the data. */
  coinShieldOrDmg?: { shields: number; dmg: number };
  /** Perpetual Fog (Driftwraith): a kill leaves it EVASIVE for this many rounds.
   *
   *  Distinct from `grantStealth`, which cloaks the killer AND its same-row,
   *  same-element kin. This one is the killer alone, and EVASION rather than
   *  STEALTH — a dodge chance instead of untargetability. On a card that already
   *  prints the STEALTH keyword permanently, granting itself more STEALTH was
   *  close to a no-op; a dodge is something it did not already have. */
  grantEvasion?: number;
  reduceSpecialCost?: number; // King Me (Heir): shave N off this card's Special cost per kill
  /** Static Charge (Static): on a kill, extend the named status on every enemy
   *  that already carries it by `rounds` (deepen the crowd-control). */
  extendStatus?: { kind: StatusKind; rounds: number };
  /** Dark Hunting (Nightbriar): a kill lays a trap on the slot where the victim fell.
   *  The next enemy to MOVE onto it takes `dmg`, is ROOTed `rootDuration` rounds,
   *  and the killer LIFESTEALs the HP dealt — the same payload as his Special. */
  setTrap?: { dmg: number; rootDuration: number; lifesteal?: number };
}

/** A basic-attack conditional keyword that only applies vs a target already
 *  carrying `status` (e.g. LIFESTEAL vs ROOTed, CRIT vs PARALYZED). */
export interface VsStatusDef {
  status: StatusKind;
  /** Match ANY status instead of the named one — models "Electrified" (BOLT's
   *  "has a status") triggers, e.g. Ricochet's "vs Electrified OR PARALYZED". */
  anyStatus?: boolean;
  /** Bloodfire (leaf_pyro payoff): match only a target carrying BOTH BLEED and
   *  BURN (see isBloodfire). Amplify-style — the bonus applies while the DOTs
   *  persist; nothing is consumed. Overrides `status`/`anyStatus` matching. */
  bloodfire?: boolean;
  lifesteal?: boolean;
  crit?: boolean;
  bonusDmg?: number; // +DMG per hit
  dmgMult?: number; // multiply per-hit DMG (2 = double vs the status)
  healOnHit?: number; // heal self N when a hit lands on such a target
  pen?: boolean; // basic gains PEN vs such a target (Stingray's Piercing Pulse)
}

/** A periodic self-driven effect resolved in Cleanup (end of round). */
export interface RoundTickDef {
  /** Fire this tick ONCE — on the card's first end-of-round after it lands —
   *  instead of every round (Star's Raising Star). Gating on match round 1
   *  would be dead weight: Gold starts at 0, so nothing costing more
   *  than nothing is even on the board that round. */
  firstRoundOnly?: boolean;
  /** Scorched Fury (Magmadon): pay `hp` of its own each Cleanup to run `dmg`
   *  hotter for the NEXT round. Deliberately not RIP's `selfHpCost`, which is
   *  wired to the spawn clock — sharing that field would couple two unrelated
   *  cards' bleed rules. Floors at 1 HP: the passive is an engine, not a
   *  suicide timer. */
  selfBurnForDmg?: { hp: number; dmg: number };
  /** Meltdown (Magmadon): a SUSTAINED Special. Runs only while the card is
   *  channelling, costs `hpCost` every round it continues, and breaks on death,
   *  FREEZE or ROOT — the Special says "until frozen or rooted", so hard control
   *  is the counterplay it is priced against.
   *
   *  Its own field rather than a flag over the whole roundTick: Magmadon's
   *  Scorched Fury lives in that same tick and must keep running whether or not
   *  the Special is lit. Gating the tick wholesale silently switched the passive
   *  off, which is exactly what the first version did. */
  /** Meltdown (Magmadon): once lit, it erupts every Cleanup for `hpCost` of
   *  its own HP until it dies, is broken, or cannot pay. `inRangeDmg` is the
   *  same reach `roundTick.inRangeDmg` uses — everything this card can
   *  actually target — rather than the row directly ahead. */
  channel?: { hpCost: number; inRangeDmg: number };
  rootedDmg?: number; // Trapper (Fallow): damage every ROOTed enemy, range-free
  /** Constriction (Python): while adjacent to an opponent, drain N HP from it at
   *  end of round — deal N to the nearest adjacent enemy and heal that much. */
  drainAdjacent?: number;
  /** Overheating (Heatsink Golem): end of round, N DMG to the closest opponent;
   *  DOUBLED when it's the same target as last round (heat builds up). */
  overheatDmg?: number;
  /** Emergency Support (Vigil) / Rescue Pack (St. Bernard): heal every ally whose
   *  curHp is under `underHp` by `amount` at end of round. */
  healWoundedAllies?: { underHp: number; amount: number };
  /** Frosty Bites (Hibernal): at end of round, ROOT one opponent whose effective
   *  SP is 0 for this many rounds. */
  rootZeroSp?: number;
  /** Magic Ropes (Tether): each round, lock this many in-range opponents out of
   *  their Specials for the coming round. */
  lockEnemySpecials?: number;
  /** Draining Siphon (Violet): at end of round, DRAIN N max HP from every
   *  opponent within 1 space. */
  drainMaxAdjacent?: number;
  /** Grounded (Evera): ROOT the fastest opponent on the board for N rounds. */
  rootFastest?: number;
  /** Nature's Protection (Sylvane): refresh shields back UP TO N at end of round. */
  refreshShieldsTo?: number;
  /** Poisonous Roots (Ivey): apply this status to every ROOTed opponent each
   *  round (POISON on the rooted). */
  rootedStatus?: { kind: StatusKind; duration: number; power: number };
  /** Overload/Power Grid (Blackout): PARALYZE every opponent under `underHp` HP for
   *  `rounds` at end of round. */
  paralyzeLowHp?: { underHp: number; rounds: number };
  /** Twisted Rush (Wailverine): deal N DMG to the enemy directly ahead; if it
   *  dies, Wailverine advances into its slot. Pair with firstRoundOnly. */
  pokeAheadAdvance?: number;
  /** Morning Dew (Vernal): heal every ally of this element at end of round. */
  roundHealElement?: { element: Element; amount: number };
  aoeDmg?: number; // damage every enemy in range
  aoeStatus?: { kind: StatusKind; duration: number; power: number };
  lowestEnemyStatus?: { kind: StatusKind; duration: number; power: number };
  pokeDmg?: number; // damage the closest single enemy
  randomEnemyDmg?: number; // Elephlora's fruit — damage ONE random living enemy
  randomEnemyStatus?: { kind: StatusKind; duration: number; power: number }; // Static Cloud — status the SAME random enemy
  pokeStatus?: { kind: StatusKind; duration: number; power: number };
  healAllies?: number; // heal every ally N
  healLowestAlly?: number; // heal the lowest-HP ally N
  healHomeRow?: number; // Blessed Light (Halo): heal allies on the caster's home row N
  healHomeRowElement?: number; // Petalfall (Sakuroot): heal SAME-element allies on the home row N
  allyInRangeShields?: number; // Reflection: grant N shields to allies within range each round
  /** Snare Garden (Snapmaw): every ROOTed opponent — from ANY source, not just
   *  this card's — takes N BLEED at the end of the round.
   *
   *  For THAT ROUND ONLY: applied at duration 1 so the cleanup tick that
   *  follows expires it, and re-applied next round if the target is still
   *  rooted. So it neither stacks nor carries, and a target that breaks the
   *  root stops bleeding immediately — the garden is the damage, not the wound. */
  rootedBleed?: number;
  /** Dreamweaver (Dreamcatcher): at the end of the round, put a status on the
   *  single HIGHEST-DMG opponent this card can reach.
   *
   *  The opposite selection to `lowestEnemyStatus`, which picks the weakest
   *  thing on the board. A debuffer that softens whatever is nearly dead is
   *  wasting itself; this one always spends its round on the biggest threat in
   *  front of it, which is what makes a 4-DMG Support worth a slot. Range is
   *  `canTarget`'s, so a Ranged holder reaches and a Melee one has to stand in
   *  it. Effective DMG, so it reads buffs and auras rather than the printed
   *  number. */
  topDmgInRangeStatus?: { kind: StatusKind; duration: number; power: number };
  /** Butler's Service: heal every OTHER ally within this card's own attack
   *  range N HP each round. Range, not the whole board — the same reach
   *  `allyInRangeShields` uses (RANGED_REACH for a shooter, adjacent for
   *  everyone else), so a melee healer has to stand with the people it is
   *  keeping alive. */
  healAlliesInRange?: number;
  healSelfToFull?: boolean; // Dewling's Liquid Humidity — restore to full max HP
  /** +DMG (and optionally +SP) every Nth round, stacking (Dragon's Blade). */
  buffDmgEveryN?: { n: number; amount: number; sp?: number; hp?: number; maxTicks?: number };
  scaldFrozen?: number; // apply SCALD N to FROZEN enemies (Freezer Burn)
  paralyzeOne?: number; // PARALYZE one un-paralyzed enemy for N rounds
  pushEnemies?: number; // blow every enemy back N slots (Wind Guardian)
  rowAheadDmg?: number; // deal N DMG to enemies in the row directly ahead (Sweeping Flames)
  inRangeDmg?: number; // deal N DMG to EVERY opponent this card can reach (Smog's Black Smoke)
  /** Electrifying (Jolt): apply a status to every opponent this card can REACH
   *  at end of round. Distinct from aoeStatus, which ignores range and marks the
   *  whole enemy board. */
  inRangeStatus?: { kind: StatusKind; duration: number; power: number };
  inRangeDmgPen?: boolean; // make inRangeDmg PENetrate shields (UFO's Radiation)
  selfShields?: number; // gain N shields each round (Heir's Royal Guard)
  selfShieldsMax?: number; // cap the self-shield stack (Bark Shield: max 5)
  pokeParalyzedDmg?: number; // deal N DMG to one PARALYZED enemy in range (Sentry's Volt Turret)
  aoeParalyzedDmg?: number; // deal N DMG to EVERY PARALYZED enemy in range (Lytning's Complete Circuit)
  wardAllies?: boolean; // refresh a status-absorbing barrier on all allies (Solstice's Radiant Ward)
  cleanseAllies?: boolean; // strip all negative statuses from allies (Imperator's Crowned)
  /** Seed Roll (Acorn token): roll forward N rows toward the enemy home each
   *  round, stopping at the first occupied/captured slot or the board edge. */
  advance?: number;
  /** THE PACK: this card's damage scales with how many living allies of `tribe`
   *  stand with it — `per` each, to `max` — RECOMPUTED every round.
   *
   *  Recomputed rather than accumulated, and that is the entire design. Every
   *  other boss in the tower teaches "kill the source, ignore the tokens"; this
   *  one inverts it. The number goes DOWN as the escorts die, in front of you,
   *  so the fight tells you what to do without a tutorial: thin the pack and
   *  the thing leading it stops being a problem. It is the one boss you are
   *  supposed to answer by clearing the board first. */
  packDmg?: { tribe: string; per: number; max: number };
  /** SIEGE AIM: slide one slot along the OWN home row toward the column holding
   *  the most opponents, one step a round.
   *
   *  THE TELEGRAPH IS THE BODY. A siege boss that simply picked a lane and fired
   *  would be a die roll with extra steps; this one walks to your lane in front
   *  of you, a square at a time, and its Special hits the column it is standing
   *  in. You can read where the shot is going two rounds before it lands, and
   *  the answer — move, or block the last square — is one you can actually
   *  execute. Ties go to the lowest column, because a tie broken at random is a
   *  telegraph that lies. */
  aimLateral?: true;
  /** How many columns `aimLateral` covers in one Cleanup. Default 1 (Helion's
   *  Traverse — a hundred tons of gold does not sidestep twice). */
  aimLateralSteps?: number;
  /** Skeleeze's Swiftshooter: it does not stop for bodies, it TRADES with them.
   *  An occupied slot in its path swaps the two cards rather than halting the
   *  slide, so a screen parked in front of the archer relocates the archer's
   *  problem instead of solving it. Captured slots still stop it — nothing may
   *  come to rest on one, the swap victim included. */
  aimLateralSwap?: true;
  /** JUGGERNAUT: advance one slot a round, and let the run build.
   *
   *  Each unobstructed step adds `per` DMG up to `max`; being stopped — by a
   *  body, a captured slot, or the board's edge — resets it to nothing. That is
   *  the whole puzzle in one field: standing in front of it costs you the
   *  blocker, and letting it run costs you the damage. */
  momentum?: { per: number; max: number };
  /** PROWL: a four-beat pacing pattern — forward, forward, back, hold — walked
   *  one slot at a time toward and away from the enemy home.
   *
   *  DETERMINISTIC, and that is the whole trick. It reads as a restless animal
   *  that cannot decide, which is exactly what it looked like when the AI was
   *  moving Basilisk around by accident and the owner liked it. But a Void
   *  Tower fight is a puzzle, and a puzzle cannot be solved against a coin —
   *  so this is a CYCLE you can count, not a roll. Watch two beats and you know
   *  where it will be on the fourth. */
  prowl?: true;
  /** Shamble: advance one slot every N rounds instead of every round. The slow
   *  half of `advance` — something that is coming for you, but not quickly. */
  advanceEveryN?: number;
  /** THE BOSS CLOCK: fire this card's Special FREE every N rounds, at Cleanup.
   *
   *  It is a clock rather than a discount, and that is the whole point — a Void
   *  Tower fight is a puzzle, and a puzzle needs a threat you can COUNT. Left to
   *  the ordinary path the same Special lands whenever the AI happens to be able
   *  to afford it, which is a different fight every time you retry and nothing a
   *  player can plan around.
   *
   *  A card carrying this cannot cast that Special the ordinary way at all (see
   *  `canFireSpecial`): the clock is the only way it fires, so what you count is
   *  what you get. It also never misses a beat for lack of magic — free means
   *  free — though MUTE and the action-blocking statuses still stop it, which is
   *  what keeps silencing a boss a real answer. */
  fireSpecialEveryN?: number;
  /** Swiftshooter (Skeleeze): slide one slot along the OWN home row each
   *  Cleanup, wrapping — to the NEXT OPEN slot, staying put when the row is
   *  full. Only fires while the card is standing in its home row: a boss that
   *  has been dragged off its rail stops sliding. Deterministic and
   *  telegraphed, which is the point — the rotating kill-column is a puzzle
   *  precisely because the player can read where it goes next. */
    /** PACK HUNTER (Thunderfangs): advance only when `need` living allies are
   *  level with it or further forward. A wolf does not charge alone — and the
   *  boss that most obviously should not was marching down the board by itself
   *  and dying, which is what the owner reported. */
  escortAdvance?: { need: number };
  /** SKITTISH (Nightshrike): once below `belowPct` of max HP, give ground —
   *  one slot back toward its own home row, if it is open. A glass cannon that
   *  never retreats is just a slow cannon. */
  kite?: { belowPct: number };
  /** ALOOF (Umbranova): slide along the row toward the EMPTIEST column — the
   *  mirror of `aimLateral`, which seeks the busiest. For a boss whose damage
   *  ignores position entirely, closing is pointless and staying out of reach
   *  is the whole game. */
  avoidLateral?: true;
shiftLateral?: number;
  /** Spawn a token each round (Trinezer's Reptilian Screech). adjacentOnly =
   *  only into an open king's-reach slot; no spawn if none is open. */
  /** Wildfire (Scorch): re-apply a status to every opponent standing in THEIR
   *  home row, each round. The on-summon burst only catches whoever happens to
   *  be there at that instant — and enemies summon INTO that row, so without
   *  this the ground never stays lit and the card reads as doing nothing. */
  enemyHomeRowStatus?: { kind: StatusKind; duration: number; power: number };
  /** Dynamo: damage every ELECTRIFIED opponent in range at end of round. Reads
   *  the literal ELECTRIFIED status (what its own Special applies), NOT the
   *  "carries any status" proxy that onKill.aoeDmgElectrified uses. */
  aoeElectrifiedDmg?: number;
  spawn?: { token: string; count: number; adjacentOnly?: boolean; spawnRadius?: number };
  /** Dead Clock (RIP): the tick costs the ticker HP. Never self-lethal — it
   *  floors at 1, so the clock stalls rather than killing its own owner. */
  selfHpCost?: number;
  /** Horde (RIP): once `spawn` has raised this many bodies in total, fire the
   *  card's Special for free and reset the tally. */
  spawnTriggerAt?: number;
  /** Dead Clock leash (RIP): the clock won't wind — and pays no HP — while this
   *  many of its own tokens are already standing. Without it the only limit was
   *  running out of board, which is how RIP reached 14 husks. Killing one is
   *  what buys the horde its next body. A Horde burst may still overshoot it;
   *  the clock then stays jammed until the count falls back under. */
  spawnMaxAlive?: number;
}

/** A persistent per-card aura (Brood Command, GALE +SP, …): a flat DMG/SP buff
 *  to living allies matching `scope`. `match` names the tribe/class for those
 *  scopes; the `element` scope uses the aura-holder's own element. */
export interface AuraBonusDef {
  scope: "element" | "tribe" | "class" | "all" | "adjacent";
  match?: string;
  /** Narrow ANY scope to one element as well. Rodd's Conduction is a BOLT
   *  conduit: it powers the grid, not whatever happens to be standing beside
   *  it. Composes with `scope` rather than replacing it, so "adjacent BOLT
   *  allies" is expressible without a scope per combination. */
  element?: string;
  dmg?: number;
  sp?: number;
  maxHp?: number; // matching allies gain +N max HP while the holder lives (SeaC)
  pen?: boolean; // matching allies' basic attacks gain PEN (Blood Ruby)
  shields?: number; // matching allies are topped up to base+N shields each round (Pressure)
  /** Matching allies gain REFLECT N while the holder lives (Magnetite's
   *  Magnetic Field). Stacks the same way the keyword does — it is added to
   *  the target's own REFLECT rather than replacing it. */
  reflect?: number;
}

/** A temporary flat DMG/SP modifier with a Cleanup countdown. Positive = a buff
 *  (Golden Courage team +DMG), negative = a debuff (Mighty Winds −SP). */
export interface TimedBuff {
  dmg: number;
  sp: number;
  /** The buffed basic PIERCES shields for the duration (Ariel's 100,000°).
   *  On the buff rather than the card because it is the BOOST that pierces, not
   *  Ariel — the +14 was being eaten whole by armour on a card whose text
   *  promised otherwise. */
  pen?: boolean;
  /** Extra BASIC hits for the duration (Totem's Rampage). Optional so every
   *  existing buff stays a two-stat buff; `effectiveBasicHits` sums it. Distinct
   *  from `loadedHits`, which is spent by the next basic rather than timed. */
  hits?: number;
  rounds: number;
}

/** On-death revival (Bearocks Hibernation): the first time this card would be
 *  defeated it instead survives at `heal` HP, optionally sleeping for `sleep`
 *  rounds. Once only. */
export interface OnReviveDef {
  heal: number;
  sleep?: number;
  /** Zombie Husk's Reanimation: instead of a one-time revive, come back with
   *  every base stat (DMG/HP/SP) reduced by `decay`, until a stat would hit 0 —
   *  then it stays dead. Revives at its (now lower) full HP. */
  decay?: number;
  /** Hard ceiling on how many times a decaying revive may fire. Without it the
   *  only limit is the stat floor, which let a 1-cost token soak three lives. */
  maxRevives?: number;
  /** Offspring (Weeds): after the guaranteed first revive, a `secondChance`%
   *  coin flip on the NEXT death grants one more revive. */
  secondChance?: number;
}

/** HP-threshold transformation (Skelider Dismount): the first time this card
 *  drops below `threshold` HP it fires once — deal `dmg`, lose `loseSp` SP, and
 *  (if loseSpecial) can no longer cast its Special. */
export interface OnLowHpDef {
  threshold: number;
  dmg?: number;
  loseSp?: number;
  loseSpecial?: boolean;
  // One-time positive surge when first dropping below threshold (Kraken's
  // From the Deep). Permanent, fires once (guarded by `transformed`).
  buffDmg?: number;
  buffSp?: number;
  gainShields?: number;
}

export interface CardDef {
  id: string; // stable unique key, e.g. 'leaf_sumerose'
  /** Art filename stem under /cards (defaults to `id`). Set when the PNG is
   *  named differently from the id (e.g. token/underscore variants). */
  art?: string;
  /** Flavour text. Never authored here — it lives in data/lore/<element>.ts and is
   *  attached onto the def at load, so a lore pass is a diff in one prose file
   *  instead of nine thousand lines of mechanics. No engine effect. */
  lore?: string;
  name: string;
  /** Collector rarity. Cosmetic today (drives a deck-builder badge); no engine
   *  effect. Older alpha cards leave it undefined. */
  rarity?: "mythic" | "legendary" | "epic" | "rare" | "common";
  element: Element;
  cardClass: CardClass;
  attackType: AttackType; // derived from class, stored for clarity
  cost: number; // 1–10
  dmg: number; // base damage per hit
  hits: number; // multi-hit count (1 = single); dmg × hits
  hp: number;
  /** Ceiling on how far this card's max HP may GROW, in absolute HP.
   *
   *  For the handful of cards whose whole design is banking other cards' max HP
   *  — Violet drains on every basic, again every round from anything adjacent,
   *  and again in bulk off its Special — which otherwise compounds without any
   *  ceiling at all. Enforced in `gainMaxHp`, the one place growth happens, so
   *  no route around it exists.
   *
   *  Caps the card's OWN pool, not `effectiveMaxHp`: aura bonuses still layer
   *  on top, the same way they do for every other card. They are a property of
   *  the board rather than of the card, they come off when the holder dies, and
   *  they cannot compound — `auraPick` folds them non-stacking. The unbounded
   *  thing is the banking, so that is what this bounds. */
  maxHpCap?: number;
  sp: number; // 0–15 (GALE cap 21 out of alpha scope — no GALE cards)
  shields: number;
  keywords: Partial<Record<Keyword, number | true>>;
  /** Status applied by basic attacks that land at least one hit. */
  onHitStatus?: OnHitStatusDef;
  /** Spread (Weeds): a landed basic has `chance`% to put another body on the
   *  board beside the attacker.
   *
   *  Bounded twice over, because a card that copies itself is the classic
   *  runaway: `max` caps how many one body may ever put up, and every copy is
   *  born STERILE (its counter starts spent) so the second generation cannot
   *  spawn a third. Without the sterility a 15% roll compounds — each new body
   *  rolls too, and the board is the only limit. */
  onHitSpawn?: { token: string; chance: number; max: number };
  /** Thorns: retaliate when hit by a melee attacker. */
  onHitByMelee?: OnHitByMeleeDef;
  /** Jelly Shock (Jellyfish): discharge when HIT and still standing — `dmg` to
   *  the attacker plus every enemy adjacent to this card. Unlike thorns it
   *  answers RANGED attackers too, and it splashes rather than hitting one. */
  onHitZap?: {
    dmg: number;
    status?: { kind: StatusKind; duration: number; power: number };
  };
  /** EMPLACED: nothing may MOVE this card — not the AI, not its own side. Its
   *  `roundTick` gait is the whole of its movement.
   *
   *  For cards whose kit is a fixed weapon rather than a body. Helion is the
   *  case that produced it: a Ranged siege engine whose Special fires down the
   *  column it STANDS in, with `aimLateral` to line that column up, and a card
   *  comment promising "it barely moves". The generic AI marched it down the
   *  board anyway — closing on the enemy home row is what the mover wants for
   *  every card it owns — and a siege engine standing INSIDE your home row has
   *  no lane left in front of it, so Solar Lance fired into empty space every
   *  three rounds for the rest of the fight. It arrived, and then it had no kit.
   *
   *  Enforced in `canMove`, which the gaits deliberately bypass (they assign
   *  `pos` directly), so this stops everything except the movement the card was
   *  designed around. */
  holdsPosition?: true;
  /** SECOND FORM: once this card has made `kills` kills, it becomes `into`.
   *
   *  Thunderfangs is the first — a pack hunter that grows into the storm it has
   *  been carrying. The count is on the INSTANCE (`killCount`), so it is earned
   *  in one battle rather than banked across a run, and the transform runs the
   *  ordinary `transform` handler: fresh body from the new form, stat mods
   *  wiped, the new form's onSummon fired. */
  transformAtKills?: { kills: number; into: string };
  /** WORTH NOTHING TO KILL. Defeating this card fires NO on-kill rider on the
   *  killer and does not advance its `killCount`.
   *
   *  The Fortress Gate is why: it stands in front of the player's home row to
   *  buy them a few rounds, and every Void Tower boss is built to be FED by
   *  kills — Vulcanyx grows +3 DMG and heals 10, Thunderfangs raises a wolf and
   *  counts toward Stormform, Cryovex grows a Blackice Crystal. A gate that
   *  handed all of that over on the way down would be worse than no gate at
   *  all: it would be a free meal parked within reach. So it is masonry, and
   *  masonry does not feed anything. */
  noKillReward?: true;
  /** A WALL: while this card stands, enemies cannot target anything in its
   *  owner's HOME ROW. They have to come through it first.
   *
   *  FLYING is the reason this is a targeting rule rather than a pathing one.
   *  `pathBlocker` already stops a ground card walking past a body, but it lets
   *  fliers over by design, and it says nothing about who may be SHOT — so a
   *  flying or ranged boss would simply reach over the gate and kill what it was
   *  built to protect. `canTarget` is the one door every attack, Special and
   *  spell passes through, so screening there covers all of them at once.
   *
   *  Scoped to the gate's own column and the two beside it — what is BEHIND it —
   *  rather than the whole row. Measured: screening all five squares took
   *  Permafrost from 77.1% to 27.1%, because a slow ranged boss had nothing it
   *  could legally touch. One column alone would be a decoration on a five-wide
   *  board; three is wide enough to matter and narrow enough that going around
   *  it is a real answer. */
  guardsHomeRow?: true;

  /** CRUSH: a TRAMPLE shove from this card also deals this much damage to what
   *  it bulls through, wherever the shove happens — the Prep move and the
   *  round-tick gait both.
   *
   *  Hoarfell is why. Shoving a Fortress Gate aside merely REARRANGES the wall:
   *  the gate lives, the line still stands, and the juggernaut has spent its
   *  round tidying. A thing whose whole identity is an unstoppable run should
   *  break what it runs over. */
  trampleDmg?: number;
  /** On-kill trigger (this card's attack defeats an enemy). */
  onKill?: OnKillDef;
  /** DEEP FREEZE (Cryovex): bonus damage against a FROZEN target that GROWS with
   *  how long it has been frozen — `per` for each round it has been held, capped
   *  at `max`. Reads the victim's `frozenRounds`, which the Cleanup tick keeps.
   *
   *  Distinct from `vsStatus`, which is a flat bonus for carrying a status at
   *  all: this one makes the freeze itself the threat, so the answer is to break
   *  it early rather than to play around a fixed number. */
  vsFrozenRamp?: { per: number; max: number };
  /** Conditional basic-attack keyword vs a target carrying a status. */
  vsStatus?: VsStatusDef;
  /** Dragon's Bane (Drakonbane): a bonus keyed on WHAT the target IS rather
   *  than what status it carries — a tribe, or simply a big enough body. The
   *  two conditions are OR'd: either one makes a target "bane-worthy".
   *
   *  `maxHpFrom` reads MAX HP, and inclusively — 25 means 25 counts.
   *
   *  It used to read CURRENT HP, on the argument that a wounded giant stops
   *  being the thing a bane hunter is built to kill, and that this is what kept
   *  a cost-5 card from carrying a permanent +2 against the whole top of the
   *  curve. That is a real cost and it is being paid deliberately: what it
   *  bought was a passive that turned itself off exactly when the fight got
   *  long, so the answer to Drakonbane was to let it hit the giant once. A bane
   *  hunter that stops working on a bleeding target is a strange kind of hunter.
   *
   *  The bound is ~10% of the pool — 30 of 330 cards print 25 or more, plus the
   *  13 Dragons that qualify by tribe whatever their HP.
   *
   *  Reads the INSTANCE's `maxHp`, so growth counts (Violet banking its way past
   *  25 becomes bane-worthy) but auras do not — `matchesVsTarget` has no state
   *  to resolve them against, and a target sliding in and out of range as an
   *  aura holder dies is the flicker this just moved away from. */
  vsTarget?: { tribe?: string; maxHpFrom?: number; bonusDmg?: number };
  /** Swamp Monster (Magalogoon): stealth as a CONDITIONAL passive, not a
   *  standing keyword. The card is hidden ONLY while it has neither moved nor
   *  attacked this round — so it is never "always" stealthed the way the STEALTH
   *  keyword is. Read exclusively through isStealthed(). */
  stealthWhenIdle?: boolean;
  /** Stinger Buzz (Beebot): a one-shot. The round it ATTACKS, it dies at that
   *  round's Cleanup — the sting is spent and the bee is gone. Its on-hit DOT
   *  still lands and still ticks; the corpse just doesn't linger. */
  diesAfterAttacking?: boolean;
  /** Harpoon Hook (Harp) / Sucker Sword (Octoirate): after a landed basic
   *  attack, drag the struck enemy this many slots toward the attacker —
   *  reeling a ranged/backline target into melee range. */
  pullOnAttack?: number;
  /** Tail Drop (Gecko): a once-per-game cheat-death. The first lethal blow
   *  leaves it at 1 HP instead, cloaked in STEALTH and regenerating as the tail
   *  regrows. */
  deathSave?: { stealth?: number; regen?: { power: number; rounds: number } };
  /** Boomer (Firecrack): the second+ basic hit against a given opponent deals
   *  DOUBLE base damage — a delayed detonation on the repeat strike. */
  boomer?: boolean;
  /** Braced Stance (Stormhide Bison): immune to knockback / pull — it plants and
   *  the storms other GALE cards ride wash over it. */
  pushImmune?: boolean;
  /** Flying Arrow (Ollie): also fires at whatever the ally directly BEHIND it
   *  just struck with a basic attack — the bird flies point and answers the
   *  shot called from behind it. */
  flyingArrow?: boolean;
  /** Sky Scout (Sightwing): entering a Mid row lets allied basics hit +1 adjacent
   *  target for the round. */
  skyScout?: boolean;
  /** Crack Shot (Sling): exempts this card's CRIT from the shield gate. A normal
   *  CRIT only rolls against an UNSHIELDED target; with this the coin is live
   *  regardless, and a landed crit PIERCES (doubles, skips the shield entirely).
   *  The exemption is the point — the piercing is what follows from it. */
  critPen?: boolean;
  /** Overcharge (Volta): basic attacks gain PEN while any allied card whose id is
   *  in this list is alive on the board. */
  penWhileAlly?: string[];
  /** Electro Surge (Surge): a reactive charge. Starts active on summon and is
   *  re-armed by the Special, which also grants +`shield` and +`dmgBoost` DMG
   *  for `boostRounds` rounds. While active the card is status-immune (Surge
   *  Protector); the first time it's hit while active it PARALYZEs the attacker
   *  `paralyze` rounds and deactivates. */
  /** A VOID TOWER BOSS. Structural, like `tribe` — not an ability.
   *
   *  Bosses live in CARDS so the inspector, lore and art pipelines all see
   *  them, but they are NOT part of the player's game: `isBuildable`, the shop
   *  pack/craft/collection pools, the element cores (`deckFor`) and
   *  `escalationPool` all refuse a `boss` card. The stat-budget test skips
   *  them too — a boss's body answers the Void Tower floor cap
   *  (`void-tower.ts`), not the cost curve. There is a test asserting a boss
   *  can be acquired nowhere. */
  boss?: true;
  /** Undead Resilience (Rotroot): while this card lives, a defeated ALLY (of
   *  `tribe`, when named) gets back up at `healFraction` of its max HP — once
   *  per card per battle, deterministically. The design doc wrote this as a
   *  50% roll; the Void Tower rule is no random percentages, and "once per
   *  card, at half HP" is its own stated replacement. */
  allyRevive?: { tribe?: string; healFraction: number };
  /** The first attack against this card each ROUND misses, whole — the
   *  deterministic replacement for a 55% EVASION (Xilty, Nightshrike). The
   *  attempt springs it whatever happens: an `alwaysHit` attacker or Blazing
   *  Sun connects, but the guard is still spent, so leading with the sure hit
   *  is the correct sequencing and is rewarded. Re-arms each Cleanup. */
  firstAttackMisses?: true;
  /** A PERMANENT accuracy penalty on this card's own basic attacks, in percent
   *  (15 = lands 85% of the time). Rolled per hit, like BLIND, and skipped by
   *  the same alwaysHit / neverMiss exemptions — a card that cannot miss still
   *  cannot miss. Distinct from the instance-level `attackMissPct`, which is a
   *  TIMED penalty a card inflicts on itself (Tide's Shell Tuck); this one is
   *  part of the card. Havoc is the first: reach across the whole board, bought
   *  with a shakier hand rather than with stats. */
  basicMissPct?: number;
  electroSurge?: {
    paralyze: number; shield: number; dmgBoost: number; boostRounds: number;
    /** Basics that fire at RANGE after the Special re-arms it (Surge). Casting a
     *  Special is the whole of that round's action, so a grant made here is
     *  always spent on a LATER round's attack — which is what "one ranged attack
     *  on the next turn" means, without needing to track a round number. */
    rangedShots?: number;
  };
  /** Magic Potion (Hexvial): a landed basic hurls a random potion at the target —
   *  Poison (DOT 1), Damage (3), or Sleep (FRIGHTEN 2). */
  potionOnHit?: boolean;
  /** High Voltage Sentry (Voltcher) / BlastOff (FireFly): auto-fires this card's
   *  own Special for free on a first hit, on death, and/or on a kill.
   *  `grantFlyingRounds` grants temporary FLYING after an on-kill fire. */
  firePassiveSpecial?: { onFirstHit?: boolean; onDeath?: boolean; onKill?: boolean; grantFlyingRounds?: number };
  /** Jackpot (Highroller): a basic CRIT auto-fires the Special free; `critsForBonus`
   *  crits in one round grants +bonusHp / +bonusDmg (once per round). */
  jackpot?: { critsForBonus: number; bonusHp: number; bonusDmg: number };
  /** Iron Ore (Bolder): take half damage (round down) from attackers of these
   *  classes. */
  blockVsClasses?: string[];
  /** Diamond's Edge (Kimberlite): basic attacks multiply their damage by this vs a
   *  SHIELDED target. */
  bonusVsShield?: number;
  /** Explosive Power (Dynomight): basics deal `mult`× damage vs any listed
   *  cardClass (e.g. Warrior/Tank). Stacks with bonusVsShield. */
  bonusVsClass?: { classes: string[]; mult: number };
  /** Icicle Weapon (Blackice): the card's basic DMG equals its CURRENT shields
   *  (its armour IS its weapon), instead of the printed dmg. */
  weaponFromShields?: boolean;
  /** Shatter (Coilblade): a landed basic on a FROZEN target shatters the ice —
   *  `shatterFrozen` splash damage to enemies adjacent to it. */
  shatterFrozen?: number;
  /** Bounty (Scallywag): when an OPPONENT fires a Special, this card answers with a
   *  status on the caster (reactive burn). */
  onEnemySpecial?: { status: { kind: StatusKind; duration: number; power: number } };
  /** Graveyard (Destro): +1 DMG for every allied card that has died this game. */
  graveyardDmg?: boolean;
  /** Gaslighting (Liza): when any ALLY lands a kill, that ally gains +`dmg` DMG
   *  for `rounds` (until end of next round). */
  allyKillBuff?: { dmg: number; rounds: number };
  /** Extra element/class/tribe auras beyond the primary `aura` (Kloud's
   *  Mage+Ranged buff). */
  auras?: AuraBonusDef[];
  /** Extra ELEMENT auras this card carries beyond its own element (SirCrest,
   *  a DAWN mage who also wields PYRO Scorch and AQUA Flow Change). The card
   *  behaves as if it belonged to each listed element for aura purposes — its
   *  basics apply that element's on-hit aura, and it runs that element's
   *  on-summon aura when it lands. */
  elementAuras?: Element[];
  /** Golden Resonance (Lithara): each successful Special use grants +shields and
   *  +DMG (stacking). */
  onSpecialUse?: {
    shields?: number;
    dmg?: number;
    /** Super Charger (Burnout): a TIMED speed burst rather than a permanent
     *  grant — `sp` for `spRounds` rounds after each cast, through the same
     *  `applyTimedBuff` every other temporary stat change uses. Lithara's
     *  shields/DMG stay permanent and stacking; both halves live here because
     *  they answer the same trigger and splitting them would mean two hooks on
     *  one line of the cast path. */
    sp?: number;
    spRounds?: number;
  };
  /** Brutal (Brute): a basic CRIT saps N DMG off the target's attacks for the
   *  round. */
  onCritDebuff?: number;
  /** Twin Strike (Twinbolt): landing a CRIT fires a bonus `hits`×`dmg` CRIT strike
   *  at the same target, once per round. */
  onCritBonus?: { dmg: number; hits: number };
  /** Unpredictable (Ender): a SLOWER attacker (lower effective SP) has only a
   *  50% chance to hit — a conditional EVASION. */
  evadeVsSlower?: boolean;
  /** Rolling Start (Rumbler): after each basic attack it rolls this many slots
   *  further toward the enemy home. */
  advanceOnBasic?: number;
  /** False Head (Thorny Ripper): ONE free dodge for the whole game, against a
   *  BASIC attack — melee or ranged. Specials go straight through: a cost-2
   *  blocker should turn away a swing, not someone's once-a-game payoff.
   *
   *  Blanks the whole attack rather than one hit of it: a multi-hit volley is
   *  wasted entire, because it is one ATTACK that missed. */
  falseHead?: boolean;
  /** Ride or Die (Omega): Luna grants a permanent +dmg / +hp the moment it
   *  lands. Applied at instance creation so it never misses. */
  summonSelfBuff?: { dmg: number; hp: number };
  /** Lure (Anglerfish): on summon, attackers have `pct`% reduced accuracy against
   *  this card for `rounds` rounds. */
  lure?: { pct: number; rounds: number };
  /** Mega Push (Megair): while below `belowHp` HP, a landed basic also deals
   *  `dmg` to every opponent and pushes them all back `push` spaces. */
  lowHpNova?: { belowHp: number; dmg: number; push: number };
  /** Ariel's Last Light: whenever an OPPONENT dies — to anything, anywhere —
   *  this card strikes the nearest surviving opponent for `dmg`. Distinct from
   *  `onDeath`, which fires when THIS card dies. */
  onOpponentDeath?: { dmg: number };
  /** Nightfang's Butler: the card enters play wearing another def's face. When
   *  the disguise is killed it does not die — it reverts to its true form at
   *  full HP (the same path Siren's Sea Terror uses), and with
   *  `strikeKillerOnReveal` it answers whoever pulled the mask off by casting
   *  its own Special at them, free. */
  disguise?: { as: string; strikeKillerOnReveal?: boolean };
  /** Salvage (Vulture): whenever ANY card dies, gain `salvageOnDeath` max HP,
   *  at most `salvageMax` times. The cap is not optional in practice: a board
   *  sees a dozen deaths in a long game and this grows off EVERY one of them,
   *  either side, so uncapped it is the only stat line in the game with no
   *  ceiling at all. */
  salvageOnDeath?: number;
  salvageMax?: number;
  /** Blood Moon (Vesper): when an opponent dies while this card lives, heal it and
   *  all its allies `deathHealAura` HP. */
  deathHealAura?: number;
  /** Diamond Kingdom (Adamant): when an allied card of `element` dies while this
   *  card lives, grant the lowest-HP surviving ally BLOCK `block` for `rounds`. */
  blockOnAllyDeath?: { block: number; rounds: number; element?: string };
  /** Boom (Doom): a time bomb. After `afterRounds` Cleanups it detonates for
   *  `dmg` to every enemy, then dies. Inert until then (0 DMG on purpose). */
  boom?: { afterRounds: number; dmg: number };
  /** Unstable Core (Nitro): a final explosion — however this card dies, it
   *  deals `deathExplosion` to every opponent on the board. Handled in
   *  defeatCard (the ONE chokepoint every death path funnels through), so unlike
   *  onDeath.aoeDmg it also fires on tick / reflect / detonation deaths. */
  deathExplosion?: number;
  /** Acorn Drop (Oak): every landed hit it TAKES sprouts `count` token(s). */
  spawnOnHitTaken?: {
    token: string;
    count: number;
    /** Sprout at most ONE volley per round, however many hits land. Without it
     *  the spawn scales with `landedHits`, so a single four-hit attacker sprouts
     *  four — the card punishes being swung at, not being ground down. */
    oncePerRound?: boolean;
  };
  /** Rainstorm (Cloudburst): a landed basic also splashes N DMG to an enemy
   *  adjacent to the primary target — one of them, or ALL of them with
   *  `splashAll`. */
  basicSplash?: number;
  /** Cloudburst's storm hits the whole neighbourhood: every splash this card is
   *  responsible for — its own `basicSplash` AND the `splashAura` it grants its
   *  team — lands on EVERY opponent adjacent to the primary target instead of
   *  the first one found.
   *
   *  A property of the card, not of the mechanic, so Totem Spirit keeps clipping
   *  a single extra target. */
  splashAll?: boolean;
  /** Life Cycle (Aurora): this card fields Light Orbs — each incoming hit is
   *  absorbed by an orb that bursts its effect at the attacker, and every enemy
   *  death recharges one orb. */
  lightOrbs?: boolean;
  /** Vision Guard (Eagon): when hit, `onHitDeflect`% chance to take HALF damage
   *  and deal half that back to the attacker. */
  onHitDeflect?: number;
  /** King of the Wild (Leo): when an opponent is summoned (once/round), gain
   *  shields + DMG. */
  onOppSummonSelfBuff?: { shields: number; dmg: number };
  /** Power Grab (General): switchable basic-attack weapons. On move (once/round)
   *  it cycles to the next, paying that weapon's `spCost`, changing its basic's
   *  dmg × hits. Index 0 is the starting weapon. */
  weaponModes?: { name: string; dmg: number; hits: number; spCost: number }[];
  /** Raising Star (Star): a landed basic also heals every ally +N HP. */
  basicHealsTeam?: number;
  /** Liquid Serenity (Serenos): at end of a round in which it did NOT attack, heal
   *  `heal` and gain `dmg` DMG for the next round. */
  idleBuff?: { heal: number; dmg: number };
  /** Elemental Fury (Prism): lands with its Special already paid for, so the
   *  first Enchantment is free. */
  startsWithFreeSpecial?: boolean;
  /** Prism's Special arms an Enchantment rather than doing anything itself. */
  enchanter?: boolean;
  /** Contagion (Zombination): while THIS card lives, the death of any friendly
   *  Zombie sprays 2 DMG to opponents beside the corpse. It is Zombination's
   *  aura — strictly its effect — so it stops the moment Zombination is gone,
   *  unlike a trait baked into the tribe. */
  contagionAura?: boolean;
  /** Hive Mind (Keeper): living allies of `tribe` soak up to `pct`% of the HP
   *  damage aimed at this card. Applied AFTER the shield gate, so it splits
   *  what would actually have reached HP — and capped by what the swarm can
   *  actually take, since a 3 HP Beebot cannot absorb 20. */
  hiveAbsorb?: { tribe: string; pct: number };
  /** Periodic self effect resolved each Cleanup. */
  roundTick?: RoundTickDef;
  /** On-death revival (Bearocks). */
  onRevive?: OnReviveDef;
  /** Root Growth (Oak): all healing this card receives is multiplied by N. */
  healReceivedMult?: number;
  /** Carnage (Zhunk): when any card of `tribe` dies anywhere, this card gains
   *  the listed permanent stat bumps. */
  /** `max` is how many deaths it may feed on, for the same reason Salvage
   *  needs one — and it matters more here, because DUSK fields the token
   *  factories that produce the deaths, so the deck feeds its own scaler. */
  onTribeDeath?: { tribe: string; dmg?: number; hp?: number; sp?: number; max?: number };
  /** HP-threshold transformation (Skelider Dismount). */
  onLowHp?: OnLowHpDef;
  /** Reaction when an ENEMY card is summoned (Rock Goblin's Cave Guard,
   *  DrShock's Shocker): zap the newcomer with damage and/or a status. */
  onOppSummon?: {
    dmg?: number;
    /** The reaction shot can CRIT (Bluejay's Gustarrows). Same coin as any
     *  other CRIT — 50%, and only against an unshielded target. */
    crit?: boolean;
    status?: { kind: StatusKind; duration: number; power: number };
    /** Burning Bark (Sparky): first hop to the closest empty slot adjacent to
     *  the newcomer, then apply the reaction — chasing every fresh arrival. */
    chase?: boolean;
    /** Drone Sweep (Buzzard): instead of moving itself, drop this token into the
     *  closest empty slot beside the newcomer. The DRONE then deals `dmg` (it is
     *  adjacent by construction, so the guard's own reach never gates it). */
    spawnToken?: string;
    /** Ceiling on how many of `spawnToken` this card may have ALIVE at once.
     *
     *  `oncePerRound` is a RATE limit and does not bound the total: one drone a
     *  round across a fifteen-round match is fifteen drones, and they only ever
     *  leave the board by dying. This is the stock — Buzzard keeps one drone up,
     *  and the next summon it answers replaces nothing until that one falls. */
    spawnMaxAlive?: number;
    /** Answer at most ONE summon per round. Without it a wide summoning turn
     *  pays out a drone per body, which is the whole opponent's turn punished
     *  several times over by a single 3-cost card. */
    oncePerRound?: boolean;
    /** Ignore the reach gate — react to a newcomer ANYWHERE on the board
     *  (Velvolt Knight's Live Current).
     *
     *  The gate is right for a reaction that is a strike: something has to be
     *  in range to be hit. It is wrong for an aura, and every arrival lands in
     *  the summoning player's HOME ROW, which the Home Slot rule puts outside
     *  normal targeting entirely — so a range-gated reaction to a summon is
     *  close to a reaction to nothing. Opt-in rather than the default, because
     *  the existing carriers (Cave Guard, Shocker, Drone Sweep) are strikes and
     *  are balanced around having to reach. */
    boardWide?: boolean;
  };
  /** This card's attacks do NOT wake SLEEPING targets (Dunewraith's Nightmare —
   *  his hits ignore SLEEP's break-on-hit rule). */
  ignoresSleepWake?: boolean;
  /** Bonus DMG on the FIRST basic attack this card lands against each distinct
   *  opponent (Klipso's Harsh Winds), once per opponent for the game. */
  firstStrikeBonus?: number;
  /** A flat bonus added ONCE to the total after a basic attack resolves (not
   *  per hit), gated on board conditions (Dunewraith). Lands on the primary target. */
  basicBonus?: {
    midLane?: number; // +N while this card sits in a Mid row
    midLaneFull?: number; // +N when 4+ cards occupy the Mid rows
    vsSleeping?: number; // +N when the primary target is SLEEPING
    flat?: number; // Quartz Hound (Stone): an unconditional extra N added to the volley
  };
  /** Ethereal Trade (Ghastly): every ATTACK — basic AND an offensive Special —
   *  deals +bonusDmg but the attacker pays hpCost HP once per attack (can be
   *  lethal, like a self-damage Special). */
  attackTrade?: { bonusDmg: number; hpCost: number };
  /** On summon, spawn `count` token cards (one-shot). The token's def lives in
   *  CARD_INDEX but never appears in a deck. */
  summonSpawn?: { token: string; count: number; adjacentOnly?: boolean; spawnRadius?: number };
  /** Brightest Warrior (Radiance): on summon, scale up by the strongest foe —
   *  +`dmg` DMG and/or +`maxHp` max HP for each `per` max-HP the highest-HP
   *  opponent on the board has. */
  summonScaleFromEnemy?: { per: number; dmg?: number; maxHp?: number };
  /** Radiant Court (Imperator): on summon, scale off the ARMY already standing
   *  — `maxHp` / `dmg` per matching ally on the board.
   *
   *  The mirror of `summonScaleFromEnemy` above, pointed the other way: that one
   *  reads the strongest thing across the table, this one reads how many of your
   *  own are out. Which makes it a REWARD FOR ARRIVING LATE, and that is the
   *  point on a cost-10 body — an emperor summoned into an empty board is just
   *  an expensive card, and one summoned behind a standing court is worth the
   *  ten Gold it took to get there.
   *
   *  `element` filters who counts (omit to count every ally). The card itself is
   *  never counted: it is on the board by the time this resolves, and "+1 per
   *  ally" that silently includes yourself is a floor nobody asked for.
   *
   *  Fixed at summon, permanently — allies arriving or dying later do not move
   *  it. A live count would make a mythic's HP a moving target every time a
   *  1-cost token traded. */
  summonScaleFromKin?: { element?: string; maxHp?: number; dmg?: number };
  /** A permanent self-buff applied when a basic attack LANDS (once per attack):
   *  Volcanon's Bad Temper and the Rager Twins (+1 DMG on hit).
   *
   *  `max` caps the TOTAL permanent DMG this card may gain from its own growth —
   *  counting both this passive and any permanent `selfDmg` its Special grants,
   *  since on Volcanon both are Bad Temper and capping one would just move the
   *  ramp to the other. Cards that omit `max` are uncapped exactly as before. */
  onHitSelfBuff?: { dmg: number; max?: number };
  /** Regenerative (Squanch): a DEFENSIVE passive. At the end of each round it
   *  gains `shields` armor for every enemy hit it TOOK that round — one hit, one
   *  shield — until it is sitting on `maxShields` total. */
  shieldPerHitTaken?: { shields: number; maxShields?: number };
  /** Liquification (Bahari): heal N HP per landed basic hit (unconditional). */
  healPerHit?: number;
  /** Rager (Twins): while this card is below `hp` HP, its basic attacks deal
   *  `dmgMult`× damage (a rage downside). */
  weakBelowHp?: { hp: number; dmgMult: number };
  /** Scorched Fury's second half (Magmadon): a FLAT bonus once the card drops
   *  below `hp`. The mirror of weakBelowHp — a wounded volcano hits harder, not
   *  softer, which is what makes bleeding itself out a plan rather than a cost. */
  furyBelowHp?: { hp: number; dmg: number };
  /** Incinerate (Sol): consecutive hits on the same target within a round deal
   *  +1 DMG per hit (the ramp climbs with each landed hit). */
  incinerate?: boolean;
  /** High Speed Impact (Stormquill): +1 DMG per point of effective SP above 10. */
  /** High Speed Impact: +1 DMG per point of SP above 10, up to `cap`.
   *
   *  Both carriers are capped now — Stormquill +5, Tempest +10 — and each cap
   *  was picked from what that card's SP actually reaches in play rather than
   *  from its cost or rarity. `cap` stays OPTIONAL because unbounded is what
   *  this field used to mean, and a required cap would let a card added later
   *  inherit a ceiling nobody chose for it. Anything new carrying this passive
   *  should say a number; see either card for how to arrive at one. */
  highSpeedImpact?: { cap?: number };
  /** Apex Predator (Stormfang): +1 DMG for every `per` SP above `above`. */
  speedDmgTiered?: { above: number; per: number };
  /** Lurk (Liquark): while STEALTHed, gain +`dmg` DMG and +`sp` SP. Attacking
   *  breaks the STEALTH (so the buffs drop); Bloody Waters' kill re-applies it. */
  lurk?: { dmg: number; sp: number };
  /** Volcanic Fury (Valcana): each landed basic grows +`onHitRampUntilSpecial`
   *  DMG, accumulating in `rampDmg` — wiped the moment her Special fires. */
  onHitRampUntilSpecial?: number;
  /** Hot Shot (Eclipse): attacks never miss — ignores the caster's own BLIND
   *  and the target's EVASION (200% accuracy / ignore-evasion). */
  alwaysHit?: boolean;
  /** Shadow (Squall): can only be attacked by ADJACENT opponents — attackers a row
   *  or more away (incl. ranged) can't reach it. */
  onlyAdjacentAttackers?: boolean;
  /** This card rides something. Mounted cards move like a chess king in Prep —
   *  a diagonal costs one step, not two — the same footing FLYING already had.
   *  A mount that is LOST puts its rider back on foot: Skelider's Dismount sets
   *  `transformed`, and the king-move goes with it. */
  mounted?: boolean;
  /** Long Reach (Shadow Horsemen): a MELEE card whose BASIC attack also reaches
   *  up to N along the four straight lines — ahead, behind, and to either side.
   *  Diagonals are NOT extended; those stay at the usual adjacent step, so the
   *  threat range is a cross laid over the king-move square rather than a bigger
   *  box. Enemy bodies in between block it, the same rule ranged shots follow —
   *  a rider reaches PAST its own allies but not through an enemy front line.
   *  Basics only: melee Specials keep their own reach. */
  basicLineReach?: number;
  /** Echolocation (The Deepest): the card is BLIND and aims by sound. Its BASIC
   *  attack can only find a target that is either right beside it (king reach,
   *  chebyshev ≤ 1) or that MOVED this round — footsteps it can hear anywhere on
   *  the board. A stationary enemy out of arm's reach is silent and untargetable.
   *  Basics only; a board-wide Special (its Sinkhole quake) is felt through the
   *  ground and ignores this. */
  targetsOnSound?: boolean;
  /** Gate the firstStrikeBonus so it only applies while this card stands on the
   *  enemy battlefield (Squall's Shadow first-strike). */
  firstStrikeEnemySideOnly?: boolean;
  /** Shadow Haunter (Ravven): its EVASION is CONDITIONAL — live only while the
   *  card stands on the enemy battlefield. On its own ground it dodges nothing,
   *  so the keyword is a raider's reward, not a permanent shield. Read through
   *  `hasEvasion()`, never `keywords.EVASION` directly, or the gate is skipped. */
  evasionEnemySideOnly?: boolean;
  /** Fallow's trapper aura: a landed CRIT pins whatever it hits. */
  critStatus?: { kind: StatusKind; duration: number; power: number };
  /** Brightling Ball (Shine): when an ALLY of this card is killed, it answers
   *  the killer. `oneUse` spends it for the rest of the game. */
  onAllyKilled?: {
    dmg?: number;
    status?: { kind: StatusKind; duration: number; power: number };
    oneUse?: boolean;
    /** Hartwood's Overwatch: answer at most once per ROUND (not once per game). */
    oncePerRound?: boolean;
  };
  /** Obsidian Claws (Obsidian): SP is replaced by this while the card is
   *  STEALTHed — underground it moves far faster than it does in the open. */
  spWhileStealthed?: number;
  /** Pride Guardian (Monger): the first time each ALLY takes a hit, this card
   *  throws it `shields`. Once per ally, tracked on the ally itself. */
  onAllyHitShield?: number;
  /** Morning Dew (Vernal): its basic attack may be aimed at an ALLY, healing
   *  them for its DMG instead of striking. Allies become legal basic targets. */
  basicHealsAllies?: boolean;
  /** Gate Keeper (Veil): grant this many shields to SELF on summon (a passive
   *  grant, not a base stat, so it stays off the cost curve). */
  /** Display names for this card's passives, keyed by the def field each one
   *  comes from. The card face prints "Wind Wake — every landed hit shoves…"
   *  instead of an unnamed sentence. Per-CARD, not per-field, because the same
   *  mechanic is named differently on different cards: summonSelfShields is
   *  "War Ready" on WarPhant and "War Mount" on Cragrider. */
  passiveNames?: Record<string, string>;
  /** Intimidation (Oakgre): while this card lives, every ENEMY within `rows`
   *  rows of it whose own DMG is LOWER than this card's loses `dmg` from its
   *  BASIC attacks. Unlike `aura` — which buffs allies by tribe/class/element —
   *  this reaches across the board and is gated on a live stat comparison, so a
   *  card that grows past the intimidator stops being cowed by it.
   *
   *  Only basics: it is read inside effectiveDmg, and Specials carry their own
   *  printed damage rather than routing through it. */
  intimidate?: { dmg: number; rows: number };
  /** Broodmother (Aranea): a STANDING aura — allied cards of this tribe hit for
   *  +`dmg` while a living holder is on the board.
   *
   *  Not `onDeath.allyTribeBuffDmg`, which is the Wedded Wraith's parting gift
   *  and permanent. This one is rented: kill the queen and the brood goes back
   *  to normal, which is what makes her worth targeting. Read live in
   *  `dmgBeforeIntimidation`, so it follows tokens spawned after she landed. */
  tribeDmgAura?: { tribe: string; dmg: number };
  /** Blinding Star (Supernova): while this card lives, every OPPONENT's basic
   *  attack rolls a flat BLINDING_STAR_MISS_PCT chance to miss — board-wide,
   *  range-free, per hit.
   *
   *  It used to suppress the attacker's extra splash target instead, which only
   *  bit against the few cards carrying `basicSplash` or `splashAura` and was
   *  inert against everything else. See auras.ts for why 10%. */
  blindingStar?: boolean;
  /** A team aura: while this card lives, its side's basic attacks also clip ONE
   *  extra adjacent target.
   *
   *  `true` = the extra target takes FULL basic damage (Totem Spirit).
   *  A number = it takes that flat amount instead (Cloudburst's Downpour, which
   *  hands the whole team a chip rather than a second full hit).
   *  With both on the board the stronger one wins. */
  splashAura?: boolean | number;
  /** Equestrian's aura: while it lives, its allies can't be WEAKENed (immune to
   *  stat reduction). */
  statDropImmuneAura?: boolean;
  /** Purelight (Halo): while it lives, its DAWN allies can't be BLINDed, and
   *  their attacks pierce enemy EVASION (light always finds its mark). */
  purelightAura?: boolean;
  /** Totem Spirit (Totem): while it stands, THIS SIDE's basic attacks cannot
   *  miss, and they find what they should not be able to see — through STEALTH,
   *  and through the Home-Slot rule that otherwise blinds a card in its own home
   *  row to the enemy home row.
   *
   *  Team-wide and element-agnostic, unlike Purelight (DAWN allies only). Two
   *  dodges deliberately survive it, the same two that survive Blazing Sun: a
   *  banked guaranteed dodge (Hoax's Blur) and an intercepting Light Orb. Those
   *  are not the attack missing — they are a charge being spent to stop it. */
  totemSpiritAura?: boolean;
  summonSelfShields?: number;
  /** Fog Settlement (Misty): on summon, its owner's battlefield gains N rounds
   *  of the fog (see PlayerState.foggedRounds). */
  summonFog?: number;
  /** War Mount (Cragrider): a mounted Ranger also mauls what it stands beside —
   *  its BASIC gains +N damage against a target inside melee reach. Modelled as
   *  a proximity bonus rather than a literal second attack, which keeps it on
   *  one damage path instead of inventing a dual-attack system. */
  meleeBonusDmg?: number;
  /** Stomp (Bootlegger): fires the moment this card MOVES onto the enemy half
   *  of the board (two-plus rows from its own home), once per crossing. */
  onEnterEnemySide?: { dmg: number; pen?: boolean };
  /** War Ready (WarPhant): shields gained on CROSSING into a Mid row. Read on
   *  both sides of the step like Stomp, so shuffling between two mid rows does
   *  not farm it. */
  onEnterMidRow?: { shields: number };
  /** Seed Roll (Oak): on summon, roll forward this many rows toward the enemy
   *  home, stopping at the first occupied/captured slot or the board edge. */
  summonAdvance?: number;
  /** Wind Wake (Zephyra): every landed hit shoves the victim back a slot. */
  onHitPush?: number;
  /** Gate Keeper (Veil): the first time this card's shields break to 0, gain
   *  these permanent buffs. */
  onShieldBreak?: { dmg?: number; sp?: number; status?: { kind: StatusKind; duration: number; power: number } };
  /** Rocky Force Field (Rhyolite): a coin-flip chance (0–100) to dodge a RANGED
   *  attacker's hit entirely. */
  blocksRangedChance?: number;
  /** Hastened Assault (WolfBane): basic attacks CRIT only when this card is
   *  faster (higher effective SP) than the target; `healPerCrit` heals on each
   *  critical hit landed. */
  critIfFaster?: boolean;
  healPerCrit?: number;
  /** Tribe tag (Reptile, Dragon, SeaC, Avian, …) — used by tribe-scoped auras
   *  and tribe payoffs. Free-text; no effect on its own. */
  tribe?: string | string[];
  /** A persistent per-card aura: while this card is alive on the board, it grants
   *  a flat DMG/SP bonus to matching living allies (incl. itself if it matches).
   *  Non-stacking — the single highest matching aura applies, never sums. */
  aura?: AuraBonusDef;
  /** A Talent: a FREE, once-per-game Battle-Phase ability (fired instead of a
   *  basic attack). After it fires the card reverts to passive-only. */
  talent?: { name: string; text: string; handler: string; params?: Record<string, number | string> };
  /** Wind Warp (Rayfen): distance is no object when it MOVES — it may step out
   *  of the wind onto any open slot on the board, however far.
   *
   *  Movement only. Every other rule still binds: it needs SP above zero, it
   *  cannot land on an occupied or captured slot, a pinning status still stops
   *  it, and — the one that matters — the home-to-home ban still holds, so it
   *  cannot leave its own home row and take an enemy home slot in a single move.
   *  That rule exists to stop a fast card stealing a capture before the opponent
   *  has a turn to answer, and a card that can cross the whole board is exactly
   *  what it was written for. */
  windWarp?: boolean;
  /** Catapult-style passives: this card may target the enemy Home row from
   *  anywhere (skips the Home Slot Targeting Rule). */
  ignoresHomeRule?: boolean;
  /** Hibernation-style passives: negative statuses never land on this card
   *  (ROOT/BURN/SLEEP/etc. are all refused). */
  statusImmune?: boolean;
  /** Transfusion (Thorn): at Cleanup, this card heals HP equal to the total
   *  BLEED damage dealt to its enemies that round (its own BLEED + any teammate
   *  BLEED). Capped at maxHp; no heal while dead. */
  healsFromBleed?: boolean;
  /** On-death retaliation (Lingering Venom / Bird Bomb): when this card is
   *  killed by an attack, deal dmg back to the killer. Direct damage — no
   *  evasion, no reflect chains. DOT/self-damage deaths have no killer.
   *  `rowAhead` (FireBird Burnout) instead blasts the enemy row directly ahead
   *  of where this card died, regardless of who the killer was. */
  onDeath?: {
    dmg: number;
    pen?: boolean;
    rowAhead?: boolean;
    /** Pop (Florence): as it dies, deal this to EVERY opponent immediately. */
    aoeDmg?: number;
    /** KaBoooom (Canister): on death, deal `dmg` to EVERY card on the board
     *  (both sides) except those of `exceptElement`. */
    /** A detonation on death. `radius` is a king-move distance from the body:
     *  1 = the eight squares around it. Omitted = the whole board, which is
     *  what this was before Canister's blast was given a blast radius. */
    boardBlast?: { dmg: number; exceptElement?: string; radius?: number };
    /** Out with a Bang (Taper): on death, apply a status to every opponent in
     *  their far (home) row. */
    farRowStatus?: { kind: StatusKind; duration: number; power: number };
    /** Meteor (Cosmic): as it dies it flags a strike that lands at the END of
     *  the round — `roundEndAoe` DMG to every opponent, fired from Cleanup. */
    roundEndAoe?: number;
    /** Last Waltz (Wedded Wraith): as she falls, every surviving ally of this
     *  tribe takes a permanent +DMG, and enemies in range are FRIGHTENed. */
    allyTribeBuffDmg?: { tribe: string; dmg: number };
    /** WarPhant: the rider survives the mount and keeps fighting. */
    spawnToken?: { token: string; count: number };
    frightenInRange?: number; // rounds of FRIGHTEN on reachable enemies
    /** SHATTER (Blackice Crystal): it bursts as it dies and applies a status to
     *  every opponent in the eight squares around it. The generic form of
     *  `frightenInRange` — kill the crystal and it still gets you. */
    inRangeStatus?: { kind: StatusKind; duration: number; power: number };
    /** Bird Bomb: the body detonates — this much to EVERY opponent inside the
     *  dying card's own attack reach, measured from the slot it fell on.
     *
     *  Distinct from `dmg` + `inRangeOnly`, which is a grudge against whoever
     *  landed the kill and hits exactly one card; and from `boardBlast`, whose
     *  radius is a fixed king-distance rather than the card's reach. A bomb does
     *  not care who set it off. */
    inRangeDmg?: number;
    /** Contagion (Zombination's zombies): damage to enemies ADJACENT TO THE
     *  SLOT IT FELL ON. Distinct from `dmg`, which retaliates against whoever
     *  landed the kill — a zombie bursting is not a grudge, so it hits whatever
     *  was standing next to it however it died. */
    /** Prism: as it falls it hands its armed Enchantment to an ally. Passes on
     *  whatever was actually loaded, or this mode when nothing was. */
    passEnchant?: EnchantMode;
    /** Lingering Venom (Widowbite): the killer is left carrying a status rather
     *  than just taking a hit back. Applied even when `dmg` is 0. */
    killerStatus?: { kind: StatusKind; duration: number; power: number };
    /** Gate the retaliation on the killer being within the DYING card's own
     *  attack reach, measured from the slot it fell on — a melee card's grudge
     *  can't cross the board, so a sniper picks it off unpunished. */
    inRangeOnly?: boolean;
  };
  /** On-summon passive (Fire Blast / Fury Unleashed): fires the moment the
   *  card lands, through the same handler registry as Specials. Free — not a
   *  Special, so no magic cost, no cooldown, no summon-turn lockout. Targets
   *  obey normal targeting rules; params.rowAhead=1 limits them to the row
   *  directly ahead of where it was summoned. */
  onSummon?: {
    /** Fire this card's OWN Special as it lands, free — no magic, no cooldown,
     *  no summon-turn lockout.
     *
     *  A flag rather than a copy of the Special's handler and params into the
     *  fields below, which is the obvious way to write it and the wrong one:
     *  two descriptions of one effect drift the first time the Special is
     *  retuned, and the card then does something its own text no longer says.
     *  Routed through `fireCardSpecial`, so target selection, `targetSide` and
     *  the re-entrancy guard are the same ones the ordinary cast uses. */
    castsOwnSpecial?: true;
    /** Optional — omit for a pure self-status on-summon (Frostveil's Icy Mist). */
    handler?: string;
    params?: Record<string, number | string>;
    /** Who the on-summon effect hits. Default "enemy". "ally" fires an ally
     *  handler (grantShield/buffSp/heal) on friendly cards in the forward area
     *  (Smith Reforged, Duster Dust Off). */
    targetSide?: "enemy" | "ally";
    /** A buff status the summoned card grants ITSELF (e.g. STEALTH for N rounds). */
    selfStatus?: StatusKind;
    selfStatusDuration?: number;
    /** Frostveil's Icy Mist: while the self-status (STEALTH) is up, each kill
     *  extends its duration by this many rounds. */
    extendSelfStatusOnKill?: number;
  };
  special?: SpecialDef;
  // future: spells / traps / talents / auras beyond the LEAF alpha aura
}

export type AutoMode = "manual" | "basic" | "full";

/** A board coordinate. Plain numbers, not a 0|1|2|3 literal union: the union
 *  pinned the whole game to a 4×4 grid at the TYPE level, so no larger board was
 *  expressible. Bounds are enforced at runtime against `state.boardSize`
 *  (canSummon / canMoveTo / the walkers all range-check), not by the type. */
export interface Pos {
  row: number;
  col: number;
}

export interface CardInstance {
  instanceId: string;
  defId: string;
  owner: PlayerId;
  curHp: number;
  maxHp: number; // can grow/shrink via DRAIN
  curShields: number;
  dmgBonus: number; // permanent DMG modifiers (DRAIN, on-kill buffs)
  dmgBonusRound: number; // DMG buff that resets each Cleanup (on-kill "for the round")
  spBonus: number; // permanent SP modifiers (on-kill buffs, GALE Zephyr)
  spBonusRound: number; // SP buff that resets each Cleanup (AQUA Flow Change Steam)
  hitsBonus: number; // permanent extra basic hits (Fenrir On Kill)
  /** The Flow this AQUA card picked at summon, kept so the tide can deepen it
   *  later (see `AQUA_TIDE_EVERY`). Set at the two PERMANENT `applyFlow` call
   *  sites; absent on anything that never chose one. */
  flowMode?: "water" | "ice" | "steam";   // mirrors auras.ts FlowMode
  /** How many tides this card has already taken, against `AQUA_TIDE_MAX`. */
  tideTicks?: number;
  /** Which beat of the four-beat `prowl` cycle this card is on. */
  prowlStep?: number;
  /** How much of this card's `dmgBonus` is JUGGERNAUT momentum right now, so a
   *  reset takes back exactly what the run put on and nothing else. */
  momentumDmg?: number;
  /** …and the same bookkeeping for THE PACK, which recomputes every round and
   *  so has to be able to hand back exactly what it last gave. */
  packBonus?: number;
  hitsBonusRound: number; // extra basic hits for the turn (Flow Change Liquid on multi-hit)
  tempShields: number; // shields granted "for the turn" (removed in Cleanup)
  /** Basic hits this card has LANDED on each target this round (keyed by target
   *  instanceId). Powers first-hit-only / on-second-hit riders; reset in Cleanup. */
  struckThisRound: Record<string, number>;
  /** Spread: how many bodies this one has already put up. Seeded at the card's
   *  `max` on a spawned copy, which is what makes clones sterile. */
  spawnedOnHit?: number;
  /** Instance ids this card has SPAWNED, for a per-card fleet cap
   *  (`onOppSummon.spawnMaxAlive`). Tokens are indistinguishable on the board —
   *  every drone is `bolt_drone_tok` — so counting the owner's side would make a
   *  second Buzzard dead weight, sharing one ceiling with the first. The ids are
   *  filtered against the living each time rather than decremented on death, so
   *  nothing has to hook into `defeatCard` to keep the count honest. */
  spawnedIds?: string[];
  /** Enemy hits this card has TAKEN this round — every attack that connected,
   *  including one fully soaked by shields. Powers Squanch's Regenerative, which
   *  cashes it in at Cleanup; reset there too. */
  hitsTakenThisRound: number;
  /** Nightfall (DUSK field): its EVASION covers only the FIRST hit taken each
   *  round, so the cover is spent on the first attempt — landed or dodged — and
   *  cleared again in Cleanup. */
  fieldEvasionUsed?: boolean;
  /** An ambush loaded into the NEXT basic attack (Obsidian's Dirt Driller): it
   *  overrides both DMG and hit count for that one attack, then clears. */
  loadedStrike?: { dmg: number; hits: number };
  /** An armed Enchantment (Prism). Spent by the next BASIC attack this card
   *  makes, whoever is holding it — Prism can hand one on as it dies. */
  enchant?: EnchantMode;
  /** A status riding the next `attacks` basic attacks (Emberclaw's Flaming
   *  Slasher). Decremented once per attack that lands, not per hit. */
  loadedOnHit?: { kind: StatusKind; duration: number; power: number; attacks: number };
  /** Sea Terror (Siren): while transformed into another card, the defId to
   *  revert to when this form dies. Set on transform, cleared on revert. */
  transformedFrom?: string;
  /** Consecutive rounds this card has spent FROZEN. Reset the moment the freeze
   *  lifts. Read by `vsFrozenRamp` — the longer you are held, the harder the
   *  thing holding you hits. */
  frozenRounds?: number;
  /** Kills this card has made THIS BATTLE. Drives `transformAtKills`. */
  killCount?: number;
  /** King of the Wild (Leo): its once-per-round on-opp-summon buff has fired. */
  kingWildFiredRound?: boolean;
  /** Zephyr (GALE): the one-time +1 DMG for crossing SP 15 has been granted. */
  zephyrBoosted?: boolean;
  /** Life Cycle (Aurora): the queue of Light Orbs. Each incoming hit is absorbed
   *  by the front orb, which then bursts its effect and disappears. */
  orbs?: string[];
  /** Aurora's rotation index for the orb an enemy death recharges. */
  orbCycle?: number;
  /** Per-round guard for a `oncePerRound` onAllyKilled (Hartwood's Overwatch). */
  allyKilledFiredRound?: boolean;
  /** Per-round guard for Twin Strike (Twinbolt's onCritBonus). */
  twinStrikeFiredRound?: boolean;
  /** Drone Sweep (Buzzard): one reaction per round, however many bodies the
   *  opponent summons. Reset in Cleanup with the others. */
  oppSummonFiredRound?: boolean;
  /** Per-round guard for a `oncePerRound` spawnOnHitTaken (Oak's Acorn Drop). */
  hitSpawnFiredRound?: boolean;
  /** Permanent DMG already taken from a capped `onHitSelfBuff` (Bad Temper).
   *  Never reset — the growth is permanent, so its ceiling has to be too. */
  selfBuffGained?: number;
  /** False Head (Thorny Ripper) has been spent. Once per GAME, so this is never
   *  reset — that is the whole difference between a decoy and a dodge. */
  falseHeadUsed?: boolean;
  /** Toxic Contagion (Venomarch): a body carrying the poison bursts when it dies,
   *  splashing its neighbours. `by` is the caster's instanceId so the splash is
   *  credited to whoever infected it, not to the corpse. Only pays out while
   *  the DOT is still on the card — "dies while affected". */
  toxicSplash?: { dmg: number; by: string };
  /** One-shot guard for a `oneUse` onAllyKilled (Shine's Brightling Ball). */
  allyKilledFired: boolean;
  /** Dead Clock (RIP): bodies raised so far, counted toward spawnTriggerAt. */
  spawnTally?: number;
  /** One-shot guard for a `firstRoundOnly` roundTick (Star's Raising Star). */
  roundTickFired?: boolean;
  /** Set once this card has been shielded by a Pride Guardian, so the guard
   *  spends itself once per ALLY rather than once per hit. */
  guardedByPride?: boolean;
  /** Every opponent this card has landed a basic attack on (instanceIds).
   *  Persistent — powers first-strike-per-opponent bonuses (Klipso Harsh Winds). */
  struckEver: string[];
  /** Timed DMG/SP modifiers (team buffs, −SP debuffs); tick down each Cleanup. */
  buffs: TimedBuff[];
  /** On-revive guard (Bearocks) — set once it has revived, so it can't again. */
  revived: boolean;
  /** Weeds Offspring: the coin-flip SECOND revive has been rolled (win or lose),
   *  so it never rolls again. */
  secondReviveUsed?: boolean;
  /** Gecko Tail Drop: the once-per-game cheat-death has fired. */
  deathSaveUsed?: boolean;
  /** Electro Surge (Surge): whether the reactive charge is currently armed. */
  electroSurgeActive?: boolean;
  /** Basic attacks that fire at RANGE while this is > 0, on a card that is
   *  otherwise Melee (Surge, after Electro Surge). Decremented as each one is
   *  thrown, so it is a count of SHOTS and not a count of rounds — a shot kept
   *  in the pocket is still there next round. */
  rangedShotsLeft?: number;
  /** BlastOff (FireFly): rounds of granted temporary FLIGHT remaining. */
  flyingRoundsLeft?: number;
  /** Power Grab (General): index of the current weapon; whether it already
   *  switched this round. */
  weaponMode?: number;
  weaponSwitchedRound?: boolean;
  /** High Voltage Sentry (Voltcher): its free first-hit Special has fired. */
  autoSpecialFired?: boolean;
  /** Jackpot (Highroller): basic crits landed so far this round. */
  critsThisRound?: number;
  /** HP lost this round (Bolder's Vengeance reflects it). Reset at Cleanup. */
  dmgTakenThisRound?: number;
  /** Diagnosis / Red Shift / Magic Ropes: rounds this card cannot fire Specials.
   *  Ticked down at Cleanup. */
  specialLockedRounds?: number;
  /** A granted heal-over-time (Tail Drop's regrow): heals `regenPower` at each
   *  Cleanup until `regenRoundsLeft` reaches 0. */
  regenRoundsLeft?: number;
  regenPower?: number;
  /** A granted, timed BLOCK X (Adamant's Adamantize / Diamond Kingdom): while
   *  `blockRoundsLeft` > 0 this card reduces every incoming hit by `blockPower`,
   *  stacking with its own BLOCK keyword. Counts down each Cleanup. */
  blockRoundsLeft?: number;
  blockPower?: number;
  /** Volcanic Fury (Valcana): DMG accumulated from on-hit ramp, reset on Special. */
  rampDmg?: number;
  /** Magnetic Shield (Magnetite): a granted, timed REFLECT — while `reflectRoundsLeft`
   *  > 0 this card reflects `reflectPower` back at attackers. Counts down at Cleanup. */
  reflectRoundsLeft?: number;
  reflectPower?: number;
  /** Boom (Doom): Cleanups survived so far; detonates once it reaches the def's
   *  `boom.afterRounds`. */
  boomTimer?: number;
  /** Mind Bubble Channeling (Serenos): each Cleanup while `channelBuffRounds` > 0,
   *  gain `channelBuffDmg` DMG, heal `channelBuffHeal`, and self-cleanse. */
  channelBuffRounds?: number;
  channelBuffDmg?: number;
  channelBuffHeal?: number;
  /** Overheating (Heatsink Golem): the target its coils discharged into last
   *  round — a repeat is what doubles the burst. */
  lastOverheatTargetId?: string;
  /** Boomer (Firecrack): opponents this card has already struck at least once —
   *  a second strike vs the same target detonates for double. */
  boomerStruck?: string[];
  /** Shell Tuck (Tide): while tucked in, this card's OWN basic attacks miss
   *  `attackMissPct`% of the time, for `attackMissRounds` more rounds. */
  attackMissPct?: number;
  attackMissRounds?: number;
  /** Lure (Anglerfish): INCOMING attacks miss `incomingMissPct`% of the time for
   *  `incomingMissRounds` more rounds — a flat accuracy debuff on its attackers. */
  incomingMissPct?: number;
  incomingMissRounds?: number;
  /** Mark of Hoax: while marked, EVERY basic attack against this card is a
   *  guaranteed CRIT. `hoaxMarkedBy` is the marking Hoax's id — when this card
   *  dies, that Hoax banks a guaranteed dodge. Persistent (no timer). */
  hoaxMarked?: boolean;
  hoaxMarkedBy?: string;
  /** Blur (Hoax): banked one-shot auto-dodges — the next `guaranteedDodge`
   *  incoming attacks miss outright (earned when a marked target falls). */
  guaranteedDodge?: number;
  /** How many times a `decay` reviver (Zombie Husk) has come back — drives the
   *  −1-per-death stat decay. */
  reviveDecay?: number;
  /** A flat one-shot penalty to this card's NEXT basic attack's damage (Sticks'
   *  Boon Striker — statusless). Consumed and cleared after that attack. */
  nextAttackDmgDebuff?: number;
  /** HP-threshold transform guard (Skelider) — set once Dismount has fired;
   *  blocks the Special thereafter. */
  transformed: boolean;
  /** A Talent fires once per game; set true after it's used. */
  talentUsed: boolean;
  /** The next Special use is free (no magic, no cooldown) — Volcanon's Eruption
   *  On Kill grants this for the following round. Consumed when the Special fires. */
  freeSpecial: boolean;
  /** Meltdown is running (Magmadon). Set when the Special is cast, cleared on
   *  FREEZE / ROOT / death. */
  channelOn?: boolean;
  /** Turret Mode (GigaVolt): rounds of end-of-round electrified volleys left,
   *  and the damage each fires. Set by the Special. */
  turretRoundsLeft?: number;
  turretDmg?: number;
  /** How many times a capped `buffDmgEveryN` ramp has fired (Storm's Supercell
   *  stops after `maxTicks` rounds). Absent = never ramped. */
  rampTicks?: number;
  /** Already dragged back up once by an ally's `allyRevive` — the once-per-card
   *  cap lives on the REVIVED card, so it survives the keeper dying later. */
  allyRevived?: boolean;
  /** `firstAttackMisses` has been sprung this round. Set by the first basic
   *  attack AGAINST this card whether or not the miss was overridden; cleared
   *  each Cleanup. */
  firstGuardUsedRound?: boolean;
  /** One-shot guard for Gate Keeper's shield-break buff (Veil). */
  shieldBroken: boolean;
  /** Per-round guard for Powertrip's once-per-round on-kill AoE (Voltogon).
   *  Reset each Cleanup. */
  onKillAoeFiredRound: boolean;
  /** Permanent reduction to this card's Special magic cost (Heir's King Me:
   *  each kill shaves 1 off Crowned). Floored at 0 when the cost is paid. */
  specialCostReduction: number;
  /** One-time guard for an onLowHp trigger (Kraken's From the Deep surge,
   *  Skelider's Dismount) — fires once when the card first drops below its
   *  threshold. Kept separate from `transformed` so a positive surge doesn't
   *  cost the card its Special. */
  onLowHpFired: boolean;
  /** UI-only transient combat counters — bumped when a hit on this card is
   *  dodged/missed (fxMiss) or crits (fxCrit). The renderer floats "MISS"/"CRIT"
   *  over the token when the count rises. No gameplay effect. */
  fxMiss?: number;
  fxCrit?: number;
  /** Bumped when this card lands an OUT-OF-TURN strike that has no attack
   *  animation of its own — currently DAWN's Awakening, which fires the instant
   *  the card is summoned. The renderer plays a quick lunge so the damage isn't
   *  unexplained. */
  fxLunge?: number;
  /** Bumped when this card is struck by a DYING card's parting shot (DUSK's
   *  Midnight Shade). The source is already off the board by then and cannot be
   *  animated, so the telegraph has to live on the card taking the hit. */
  fxRecoil?: number;
  /** Bumped whenever this card earns — or becomes able to earn — its home-slot
   *  coin: once per Resource phase while it stands on its own home row, and once
   *  the moment it steps onto that row. The renderer floats a +1 coin off it, so
   *  the income rule is something you watch happen rather than infer from the
   *  gold counter ticking. */
  fxCoin?: number;
  /** Bumped when PARALYZE actually COSTS this card its attack — the renderer
   *  diffs it and floats "PARALYZED" over the token.
   *
   *  A counter rather than a boolean, because the interesting event is the
   *  ROLL, not the status: PARALYZE is a coin flipped at act time, so the card
   *  carries the icon whether or not it was stopped this turn, and the one
   *  thing the player could not see was which. The status pip says "might be
   *  stopped"; this says "was". */
  fxParalyzed?: number;
  /** Bumped when a never-miss source (Blazing Sun, Totem Spirit) SAVES a swing
   *  that would otherwise have been shrugged off — the renderer floats it.
   *
   *  Same reasoning as `fxParalyzed`, pointed the other way: the effect is the
   *  ABSENCE of a miss, which is invisible by construction. A card under
   *  Blazing Sun wears its BLIND pip exactly like one that is about to whiff,
   *  and the only difference between them is a branch that quietly does not
   *  run. Without this the field's whole promise is unobservable. */
  fxNeverMiss?: number;
  /** UI-only damage readout: every point of HP this card has lost, one entry
   *  per hit, most recent last — and a counter that ticks once per entry.
   *
   *  A whole volley resolves inside ONE engine step, so the renderer never sees
   *  the intermediate states; without a list it could only ever float the last
   *  number of a three-hit attack. The renderer diffs `fxDmgSeq` against what it
   *  last drew and floats the tail it hasn't shown yet.
   *
   *  Display state, not a ledger: the tail is capped (see FX_DMG_KEEP) so a long
   *  match can't grow it without bound. Damage credit lives in `stats`. */
  /** How many deaths each death-scaler has already fed on. Separate counters:
   *  no card carries both today, and one shared counter would silently make
   *  them compete if one ever did. */
  salvageStacks?: number;
  tribeFeedStacks?: number;
  fxDmgHits?: number[];
  fxDmgSeq?: number;
  /** Extra basic hits queued for the NEXT basic attack (Dart Frog's loaded
   *  darts). Consumed the next time this card basic-attacks. */
  loadedHits: number;
  /** Active statuses. DIFFERENT kinds coexist (a card can be ROOTed and
   *  BURNing); re-applying the SAME kind refreshes it instead of stacking —
   *  same-kind stacking only when a card explicitly states it (future flag). */
  statuses: StatusEffect[];
  summonedThisRound: boolean; // summon-turn Special lockout
  /** Specials have a one-round cooldown: firing sets 2, Cleanup ticks it down,
   *  and the Special is blocked while > 0 (so: skip one full round between uses). */
  specialCooldown: number;
  /** How many times this card has fired its Special this game. Only read by
   *  Specials that opt into a `maxStacks` limit — a permanent, stacking buff
   *  otherwise grows without bound on a card left alone in a corner. */
  specialCasts: number;
  attackedThisRound: boolean; // STEALTH break tracking; reset each Cleanup
  /** Swamp Monster (Magalogoon): moving breaks its STEALTH as surely as
   *  attacking does. Per-CARD, unlike prep.movedThisTurn which is the
   *  one-move-per-turn budget for the whole side. Reset each Cleanup. */
  movedThisRound?: boolean;
  autoMode: AutoMode;
  pos: Pos | null; // null only transiently (never for a living board card)
}

export interface HandCard {
  handId: string; // unique per dealt copy
  defId: string;
}

// ── Spells ───────────────────────────────────────────────────────────────────
// A Spell is not a Champion: no stats, no board slot, can't be attacked. It's a
// one-time Prep-Phase effect paid from the magic pool, once per game. (Canon
// rules put Spells in the same deck as Champions; for now each player carries a
// separate spellbook derived from their deck's elements — see spells.ts.)

// "choice" = a modal spell the caster resolves one of two ways at cast time
// (Chill: an attack on a foe, or a shield on an ally). It reuses the damage
// fields (dmg/status) for the attack mode and allyShield for the shield mode;
// the CAST_SPELL intent's `mode` picks which.
// "field" = a Cost-6 board-wide terrain buff (the mirror of a Wall): no target,
// empowers the caster's SAME-element allies for a few rounds. See FieldState.
// "trap" = a Cost-2/8 hidden mine on a single EMPTY slot. Unlike a wall (a
// whole row, visible, expiring) a trap is one square, concealed from the
// opponent, and waits indefinitely until an enemy MOVES onto it.
export type SpellKind =
  | "damage" | "heal" | "wall" | "aoe" | "choice" | "field" | "convert" | "trap";

/** A hidden mine on ONE slot, laid by a trap spell. Occupies no space and does
 *  not block movement or line of sight — it simply waits. Triggers when an
 *  ENEMY card MOVES onto its square (ranged attacks and adjacency do nothing),
 *  then is spent.
 *
 *  Distinct from a Wall in three ways: a single square rather than a row, no
 *  expiry, and CONCEALED — the UI shows it to its owner only, so walking into
 *  one is a real mistake rather than a visible toll. */
export interface TrapState {
  owner: PlayerId;
  /** Set for trap SPELLS (names/logs via getSpell). On-kill traps laid by a
   *  card (Nightbriar) leave this empty and carry `label` instead. */
  spellId?: string;
  /** Display name when there's no spell behind the trap (Nightbriar's Dark Hunting). */
  label?: string;
  element: Element;
  pos: Pos;
  dmg: number;
  pen?: boolean;
  status?: { kind: StatusKind; duration: number; power: number };
  /** A SECOND status riding along with `status`. Snare and Overgrowth print a
   *  ROOT and a BLEED, and declare them in two places — the ROOT inside `trap`,
   *  the BLEED as the spell's own top-level `status`. The trap branch only ever
   *  copied the first, so the BLEED half of both cards never happened. */
  extraStatus?: { kind: StatusKind; duration: number; power: number };
  /** Inferno Pit: the payload also hits opponents adjacent to the victim. */
  splash?: boolean;
  /** Dark Hunting: heal `sourceId` by the HP the primary victim loses when the
   *  trap springs (LIFESTEAL), mirroring Nightbriar's Special. */
  lifesteal?: number;
  sourceId?: string;
}

/** A row-level "wall" laid down by a Cost-4 spell. Occupies no slot; triggers
 *  only when an ENEMY card MOVES into its row (ranged attacks pass through). */
/** A buff granted to the wall owner's SAME-element allies while they stand in
 *  the wall's row (stacks additively with the card's own keywords). */
export interface WallAllyBuff {
  block?: number; // +BLOCK (Stone Wall)
  evasion?: boolean; // EVASION (Veil of Shadows)
  dmgReduction?: number; // flat −N incoming, unnamed (Radiant Barrier)
}

export interface WallState {
  owner: PlayerId;
  spellId: string;
  element: Element;
  row: number;
  dmg: number;
  status?: { kind: StatusKind; duration: number; power: number };
  push?: number;
  stripShields?: number; // strip N shields on entry, before the dmg (Stone Wall)
  allyBuff?: WallAllyBuff;
  roundsLeft: number;
}

/** A Cost-6 Field's buffs, granted to the caster's SAME-element allies while
 *  it's up. Per-round (applied at Cleanup): `regen` heals, `shield` adds armor.
 *  Passive-while-up (read live by the effective-stat / combat helpers):
 *  `sp`, `dmgBonus`, `block`, `reflect`. */
export interface FieldBuff {
  regen?: number;
  shield?: number;
  sp?: number;
  dmgBonus?: number;
  block?: number;
  reflect?: number;
  evasion?: boolean;      // element allies gain EVASION while up (Nightfall)
  specialDiscount?: number; // BOLT Specials cost −N while up (Power Grid), floors at 1
  electrify?: number;       // +N extra Electrify DMG vs statused foes (Power Grid)
  /** Dense Fog (AQUA): the only field that debuffs the OPPONENT rather than
   *  buffing its owner — every attack by the field owner's ENEMIES rolls to
   *  miss, the same coin the BLIND check uses. */
  enemyMissChance?: boolean;
  /** Downpour: at the start of every round the owner re-picks a Flow Change and
   *  it lands on ALL their element allies, not just a newly-summoned one. */
  flowRepick?: boolean;
  /** Blazing Sun: the field owner's element allies cannot miss — negates BLIND,
   *  the target's EVASION, and any other roll-to-hit. */
  neverMiss?: boolean;
  /** Blazing Sun: the field owner's element allies can see and target STEALTH
   *  cards, which are otherwise untargetable until they attack. */
  seeStealth?: boolean;
  /** Lushfield: statuses of these kinds, applied by the field owner's side,
   *  land with +`rounds` extra duration. Declared as data rather than hardcoded
   *  to BLEED/ROOT so another element's field can reuse the mechanic. */
  extendStatus?: { kinds: StatusKind[]; rounds: number };
  /** Nightfall: every DRAIN instance steals +N extra max HP. Element-matched
   *  like the other bonuses, so only DUSK cards under a DUSK field get it. */
  drainBonus?: number;
  /** Jetstream: every knockback the field OWNER causes travels +N further.
   *  Owner-scoped, not element-matched — the text reads "all knockback / push
   *  effects", and a push can come from a spell or a wall with no card behind
   *  it at all. */
  push?: number;
  /** Heatwave: BURN the field owner inflicted on its ENEMIES stops expiring
   *  while the field is up (their BURN durations don't tick down). */
  burnPersists?: boolean;
}

/** A live board-wide Field (the mirror of a WallState). No slot/row; buffs the
 *  owner's element allies for `roundsLeft` rounds, then lifts at Cleanup. */
export interface FieldState extends FieldBuff {
  owner: PlayerId;
  spellId: string;
  element: Element;
  roundsLeft: number;
  /** Standing terrain (§4): a region's Field spell runs for the WHOLE battle
   *  rather than a few rounds, so Cleanup neither ticks nor removes it. Cast
   *  fields leave this unset and expire normally. */
  permanent?: boolean;
  /** Downpour: the round its Flow re-pick was last offered. Without this the
   *  re-entrant check that catches a SECOND player in hot-seat immediately
   *  re-opens the prompt for the player who just answered — forever. */
  repickRound?: number;
}

export interface SpellDef {
  id: string;
  name: string;
  element: Element;
  cost: number;
  kind: SpellKind;
  text: string;
  /** Flavour text, attached at load from data/lore/. See CardDef.lore. */
  lore?: string;
  /** Field spells (kind "field"): the board-wide buff + how long it lasts. */
  field?: FieldBuff & { rounds: number };
  /** Conversion spells (kind "convert"): the magic paid as `cost` comes back as
   *  N Gold. No target — it just moves value between the two resources. */
  gainGold?: number;
  // ── damage spells (need an enemy target) ──
  dmg?: number;
  pen?: boolean;
  status?: { kind: StatusKind; duration: number; power: number }; // onto the enemy target
  push?: number; // push the enemy target back N (if open)
  /** AoE spells (kind "aoe"): which opponents the dmg/status hits. "board" = all
   *  (no pick); "row" = a picked row; "tworows" = the picked row + the one behind. */
  area?: "row" | "board" | "tworows";
  /** AoE double-damage rider: a target meeting this condition takes 2× the dmg
   *  (Maelstrom vs FREEZE, Dawn's Judgment vs BLIND, Tremor vs "noShields"). */
  doubleIf?: StatusKind | "noShields";
  /** Total Network Control: permanently discount the caster's BOLT Specials by N
   *  (min 1) for the rest of the game — applied after the AoE resolves. */
  grantBoltDiscount?: number;
  /** Volcanic Eruption: permanently grant every SAME-element ally +N DMG for the
   *  rest of the game, applied after the AoE resolves. Unlike the BOLT discount
   *  this lands on the CARDS, so it also covers allies summoned later. */
  grantElementDmg?: number;
  /** The Cost-10 ultimates: a PERMANENT, element-wide grant for the rest of the
   *  game. Recorded on the player so allies summoned later inherit it too —
   *  "for the rest of the game" has to mean the game, not the board as it stood.
   *  The per-round halves (shield/heal) are paid out at Cleanup. */
  grantElementPerm?: {
    sp?: number;
    shieldPerRound?: number;
    healPerRound?: number;
    /** Endless Night: DUSK allies gain the DRAIN keyword if they lack it. */
    drain?: boolean;
  };
  /** Sap N SP from every target for the round (99 = drop it to nothing).
   *  Round-scoped, so it wears off at Cleanup like Flow Change's boosts. */
  spDebuff?: number;
  /** Steam Vent: this status lands INSTEAD of the plain damage, and only when
   *  the target is already FROZEN — cold and heat refusing to cancel out. */
  statusIfFrozen?: { kind: StatusKind; duration: number; power: number };
  /** Withering Grasp: heal an element ally for the HP damage this spell dealt. */
  healAllyForDamage?: boolean;
  /** Bloodroot Surge: heal every element ally for the TOTAL DOT this spell just
   *  queued up across the enemy board (power x duration x targets). */
  healAlliesForStatus?: boolean;
  /** Heart of the Forest: restore every element ally to full HP. */
  healAlliesFull?: boolean;
  /** Glacial Wave / Landslide: element allies standing INSIDE the AoE's area
   *  gain shields — the area is the same one the enemies were hit in. */
  allyShieldInArea?: number;
  /** Harvest: DRAIN N max HP from every target, spread across the caster's
   *  surviving element allies. */
  drainMaxHpAll?: number;
  /** Grace: +N DMG to the healed ally for the round. */
  allyDmgRound?: number;
  /** System Override: every Special the caster fires costs N less this round. */
  specialDiscountRound?: number;
  /** System Override: every ally's Special comes off cooldown at once. The
   *  discount alone did not fill a cost-9 slot — every other cost-9 in the
   *  game is a board wipe — and the rung is fixed, one spell per cost per
   *  element, so the effect had to grow rather than the price shrink. */
  clearCooldowns?: boolean;
  /** BATTLE COMMANDS (DAWN): an order given to your own army rather than an
   *  effect aimed at the enemy. One composable field instead of four bespoke
   *  mechanics, because the four DAWN commands differ only in which riders they
   *  carry — Retreat is step-back plus armour, Charge is step-forward plus a
   *  strike, Surprise Attack is the strike alone and capped.
   *
   *  Order of resolution is fixed and matters: MOVE, then STRIKE, so a charge
   *  hits from where it arrives rather than where it set off, and a retreat is
   *  out of reach before anything answers. */
  command?: {
    /** Slots each ordered ally steps. NEGATIVE retreats toward its own home row
     *  (through pushBack, so pushImmune cards hold the line); POSITIVE advances
     *  toward the enemy (through chargeForward, which stops at an occupied or
     *  captured square). */
    step?: number;
    /** After moving, each ordered ally fires a basic at the nearest foe it can
     *  actually reach. Cards that can reach nothing simply do not swing. */
    strike?: boolean;
    /** Armour handed out with the order. */
    shield?: number;
    /** Restrict the order to allies of the spell's own element — DAWN commands
     *  the DAWN line, not whatever else happens to share the board. */
    sameElement?: boolean;
    /** Cap on how many allies obey, nearest the enemy first. A raid is not a
     *  general order, and an uncapped free strike for every body on the board is
     *  the strongest thing a spell can do at any price. */
    max?: number;
  };
  /** Rewire: swap the board positions of two of the caster's own cards. */
  swapAllies?: boolean;
  /** Full Reroute: freely relocate up to N of the caster's cards to open slots,
   *  ignoring their SP movement tier for this cast. */
  rerouteCount?: number;
  /** Wake of the Dead: opponents killed for the REST OF THIS ROUND come back at
   *  the start of the next one as this token, under the caster's control. */
  reviveAsToken?: string;
  /** Recon Ping: reveal the opponent's hand for the rest of this round. */
  revealHand?: boolean;
  /** Trap spells: the payload delivered when an enemy steps on the square. */
  trap?: { dmg: number; pen?: boolean; status?: { kind: StatusKind; duration: number; power: number }; splash?: boolean };
  /** Cleanse rider: remove up to N negative statuses from each of the caster's
   *  element allies (99 = all). Runs on support spells and on Judgment. */
  cleanse?: number;
  // ── ally rider / support (auto-picked ally of the spell's element) ──
  allyShield?: number;
  allyHeal?: number;
  allyHealIfRooted?: number; // heal this instead when any opponent is ROOTed
  allySp?: number; // grant the ally +N SP (Tailwind)
  allyStatus?: { kind: StatusKind; duration: number; power: number }; // e.g. EVASION (Shadow Step)
  /** Apply the ally rider(s) to EVERY living ally of the spell's element instead
   *  of a single auto-picked one (Fortify, team heals). */
  allAllies?: boolean;
  drainMaxHp?: number; // steal N max HP from the enemy target → an ally
  // ── wall spells (need a target row) ──
  wall?: {
    dmg: number;
    status?: { kind: StatusKind; duration: number; power: number };
    push?: number;
    stripShields?: number;
    ownHomeOnly?: boolean;
    allyBuff?: WallAllyBuff;
    rounds: number;
  };
}

/** One entry in a player's spellbook — castable once per game. */
export interface SpellSlot {
  defId: string;
  used: boolean;
}

export interface PlayerState {
  deck: string[]; // defIds, top of deck = index 0
  hand: HandCard[];
  /** Spells available to this player this game (each castable once). */
  spellbook: SpellSlot[];
  /** GOLD — the summoning resource. Gains = round # each round (cap 10
   *  carryover). Pays for
   *  summoning Champions only. */
  gold: number;
  /** Magic pool: starts at 3, +1 per round from round 2 (cap 10 carryover).
   *  Pays for Specials (and, post-alpha, Spells). Never drains the summon
   *  pool and vice-versa. */
  magicPool: number;
  mulliganDone: boolean;
  /** How many of this deck's CHEAPEST cards are dealt first — a pre-orchestrated
   *  opening. The rest of the deck stays shuffled.
   *
   *  A scripted opponent, used by the one-off events. Gold is tight for the
   *  first several rounds, so a top-heavy list drawn at random simply stands
   *  there — Darkest Night holds four 1-cost cards in thirty at an average cost
   *  of 4.27, against the six-to-eight the tuned 5x5 builds carry at ~3.1, and
   *  it opened unable to summon anything on round one almost half the time. A
   *  designed fight should not be decided by whether the AI happened to draw a
   *  1-drop.
   *
   *  A DEPTH, not a flag: sorting the whole deck is measurably worse for lists
   *  that are already cheap. See `restackByCost`.
   *
   *  Enforced next to EVERY shuffle rather than once at the deal, because the
   *  mulligan reshuffles: stacking only at deal time was undone the moment the
   *  AI tossed a card. */
  stackCheapest?: number;
  /** Hoist exactly THESE cards to the top of the deck, in this order, after
   *  every shuffle — one deck slot per entry, so duplicates in the list hoist
   *  duplicates. The sibling of `stackCheapest` for a fight that cares WHICH
   *  cards arrive rather than how cheap they are.
   *
   *  Void Tower is why it exists. A boss's budgeted formation is the fight —
   *  "kill the source, ignore the tokens" needs the source to turn up — but the
   *  formation is the EXPENSIVE half of a deck padded out with tribe chaff, so
   *  `stackCheapest` would reliably bury it under the chaff and guarantee the
   *  opposite of what was wanted.
   *
   *  Applied after the cheapest-stack when both are set, so the named cards end
   *  up on top; and beside every shuffle for the same reason as its sibling,
   *  because the mulligan reshuffles. */
  stackFirst?: readonly string[];
  /** Running tally of this player's cards that have died — feeds Destro's
   *  graveyard-scaling (its DMG grows with the fallen). */
  deaths?: number;
  /** Accelerator (Scorch): rounds remaining in which BURN this player inflicted
   *  on its ENEMIES deals double. Ticked down in Cleanup. */
  burnBoostRounds?: number;
  /** Fog Settlement (Misty) / Smog (Aftermath): rounds left of a board-wide
   *  accuracy penalty on attacks aimed at THIS player's cards. Flat, not a
   *  status — uncleansed. Decrements each Cleanup. */
  foggedRounds?: number;
  /** How thick the standing fog is — the miss chance the SOURCE laid it at.
   *  Absent = FOG_MISS_PCT.
   *
   *  On the player rather than folded into the mechanic because the two
   *  carriers are priced nothing alike: Misty is a cost-1 body that fogs for
   *  free the moment it lands, while Aftermath spends a cost-4 Special off a
   *  cost-6 card. One number for both meant tuning either one moved the other.
   *  Every application writes this, so a thin fog can never linger under a
   *  thick one laid afterwards. */
  foggedPct?: number;
  /** Sky Scout (Sightwing): rounds left in which this player's single-target
   *  basics also clip one enemy adjacent to their target. Ticked in Cleanup. */
  basicSplashRounds?: number;
  /** Midnight Shade (DUSK aura): how many of this player's DUSK cards have
   *  fallen inside the live window. Each is +5% dodge for this player's DUSK
   *  cards, capped at DUSK_SHADE_MAX_STACKS. Not a status — flat and uncleansed,
   *  like Misty's fog above. */
  shadeStacks?: number;
  /** The last round `shadeStacks` still applies on. Every fresh DUSK death sets
   *  this to `round + 1`, so the shadows cover the rest of the round the card
   *  fell in plus one whole round after — that is the "1 round" a player reads,
   *  since a death landing late in a battle queue would otherwise expire before
   *  anything could swing at the survivors. Cleared in Cleanup once passed. */
  shadeUntilRound?: number;
  /** Orbital Shot (Zenith): delayed single-target strikes that land on a later
   *  round's Cleanup. */
  pendingArrows?: { round: number; dmg: number; targetId: string; source: CardInstance }[];
  /** Radiant Ward (Solstice): a single team-wide barrier that absorbs the first
   *  negative status to hit any ally this round. Refreshed each round it's up. */
  statusWard?: boolean;
  /** Total Network Control (BOLT ultimate): a permanent −N to this player's BOLT
   *  Specials (min 1), applied to current AND future BOLT cards for the game. */
  boltDiscount?: number;
  /** System Override: EVERY Special this player casts costs N less, for THIS
   *  round only (boltDiscount is the permanent, BOLT-only version). Cleared at
   *  Cleanup. */
  specialDiscountRound?: number;
  /** Recon Ping: the round through which this player's hand is visible to the
   *  opponent. Information, not board state — the UI reads it. */
  handRevealedUntilRound?: number;
  /** Wake of the Dead, armed. `deaths` is the opponent's death count at the
   *  moment of casting, so only kills made AFTER it resolves are harvested —
   *  the spell says "killed this round", not "killed so far". */
  /** An armed "anything that dies becomes mine" harvest. `roundsLeft` lets it
   *  span several rounds (Toxic Eruption's DOT kills over 3) rather than only
   *  the round it was cast — each Start of Round it banks what died, re-arms
   *  with a fresh baseline, and counts down. */
  wakePending?: { round: number; deaths: number; token: string; roundsLeft?: number };
  /** Meteor (Cosmic): pending round-end strikes armed by a death this round.
   *  Each fires at the Cleanup of its `round`, hitting the owner's opponents.
   *  `source` is the (now-removed) caster, kept only for damage crediting. */
  pendingMeteors?: { round: number; dmg: number; source: CardInstance }[];
  /** Spiraling Root Coil (Evera): a next-round ROOT scheduled on the far row.
   *  `roundsLeft` counts down each Cleanup; at 0 it roots up to `count` opponents
   *  in the source's far row for `duration`. */
  pendingFarRoots?: { roundsLeft: number; source: CardInstance; count: number; duration: number }[];
  /** Volcanic Eruption: permanent +DMG for this player's cards of that element. */
  elementDmgBuff?: { element: Element; amount: number };
  /** The Cost-10 ultimates' lasting engines, keyed by element. Read at Cleanup
   *  (shield/heal), on summon (sp), and by the DRAIN keyword check. */
  elementPerm?: {
    element: Element;
    sp?: number;
    shieldPerRound?: number;
    healPerRound?: number;
    drain?: boolean;
  };
}

export type Phase =
  | "mulligan"
  | "draw"
  | "resource"
  | "prep"
  | "battle"
  | "cleanup"
  | "gameover";

export interface PrepState {
  priority: PlayerId;
  consecutivePasses: number;
  movedThisTurn: boolean; // move ≤1 card per priority turn
}

export interface BattleState {
  queue: string[]; // instanceIds ordered SP 15→0, ties coin-flipped
  index: number; // next card to act
  /** Set when a P1 manual card is up and has at least one legal action. */
  awaitingInput: string | null; // instanceId
}

export interface SlotState {
  capturedBy: PlayerId | null; // permanent capture — no summons in/out, ever
}

export interface WinInfo {
  /** null only on a timeout that nothing could separate — a genuine draw. */
  winner: PlayerId | null;
  by: "capture" | "elimination" | "surrender" | "timeout" | "slain" | "overrun";
}

/** Post-match analytics, accumulated live in the reducer. `dmg` is HP damage
 *  dealt to enemies; `heal` is HP restored (self-sustain + support); `captures`
 *  are enemy Home slots locked; `kills` are enemy cards defeated. */
export interface CardStat {
  defId: string;
  name: string;
  owner: PlayerId;
  /** Offence: HP damage dealt to enemies. */
  dmg: number;
  /** Support: HP restored to others AND to itself — credited to the HEALER.
   *  See `healRecv` for the other half; conflating the two made a card that
   *  got healed look like the one doing the healing. */
  heal: number;
  captures: number;
  kills: number;
  /** Defence: HP damage this card absorbed. A tank's whole contribution was
   *  invisible in the report before this. */
  taken: number;
  /** Damage its SHIELDS ate before any of it reached HP. `taken` counts HP loss
   *  only, so without this an armour card looks like it barely defended — the
   *  damage it stopped never appeared anywhere. Shield-based elements (BORE,
   *  AQUA) are unmeasurable on `taken` alone. */
  shielded: number;
  /** HP restored TO this card, by anyone (including itself). */
  healRecv: number;
  /** Negative statuses landed on this card — how hard it got locked down. */
  debuffs: number;
  /** Times it was put down (a reviving card can do this more than once). */
  deaths: number;
}
export interface SideStat {
  dmg: number;
  heal: number;
  captures: number;
  kills: number;
  taken: number;
  shielded: number;
  healRecv: number;
  debuffs: number;
  deaths: number;
}
export interface MatchStats {
  /** Per source card, keyed by instanceId (survives the card's death). */
  byCard: Record<string, CardStat>;
  /** Per-side totals — includes spell/player-level contributions with no card. */
  byPlayer: Record<PlayerId, SideStat>;
}

export interface GameState {
  rngState: number; // seeded RNG cursor — all randomness flows through this
  round: number;
  phase: Phase;
  /** Opening deployment (§10.6). Present only while it is RUNNING; the numbers
   *  are how many more cards each side may place. Absent = ordinary round flow,
   *  which is what every non-story battle uses. */
  opening?: { P1: number; P2: number };
  /** Which players are human-controlled. ["P1"] = vs-AI (default); ["P1","P2"]
   *  = local hot-seat 2-player. The driver only auto-runs AI for players NOT
   *  in this list. */
  humans: PlayerId[];
  firstPlayer: PlayerId; // coin-flip winner; preps first on ODD rounds (initiative alternates)
  players: Record<PlayerId, PlayerState>;
  /** All living board cards, keyed by instanceId. Board layout derived from pos. */
  cards: Record<string, CardInstance>;
  /** Width AND height of the square battlefield for THIS match. Lives on the
   *  state rather than as a module constant so more than one board size can
   *  exist at once (4×4 standard, 5×5 mode). `slots` is always boardSize². */
  boardSize: number;
  /** Slot metadata, [row][col]. `boardSize` × `boardSize`. */
  slots: SlotState[][];
  prep: PrepState | null;
  battle: BattleState | null;
  /** Active row-level Walls (Cost-4 spells). Empty until a wall is cast. */
  walls: WallState[];
  traps: TrapState[];
  /** Active board-wide Fields (Cost-6 spells). Empty until a field is cast. */
  fields: FieldState[];
  /** A human just summoned an AQUA card and must pick its Flow Change buff
   *  (instanceId). AI summons resolve immediately, so this only gates humans. */
  pendingFlow: string | null;
  /** Downpour re-pick: the pending choice applies to EVERY element ally of
   *  pendingFlow's owner, not just that card. pendingFlow still names one of
   *  them so the existing prompt has something to render. */
  pendingFlowAll?: boolean;
  /** A VOID TOWER boss fight, which is scored differently from every other
   *  match — see `slayWin` in phases.ts. Set by the encounter, never by a
   *  player choice, and inert everywhere else. */
  voidTower?: true;
  /** Consecutive Cleanups the boss's side has held the player's ENTIRE home row.
   *  Reset the moment it does not. See OVERRUN_HOLD_ROUNDS. */
  overrunHeld?: number;
  win: WinInfo | null;
  log: string[];
  nextId: number; // instance/hand id counter
  stats: MatchStats; // post-match analytics (damage/heal/captures/kills)
}

export type Intent =
  | { type: "MULLIGAN"; player: PlayerId; returnHandIds: string[] }
  /** `autoMode` is the summoning player's remembered default for this card
   *  (see ui/auto-prefs). Carried ON THE INTENT rather than read from storage
   *  inside the engine: the engine is pure and replayable, and a value pulled
   *  out of one browser's localStorage mid-resolution would desync an online
   *  match and make a replay non-deterministic. */
  | { type: "SUMMON"; player: PlayerId; handId: string; col: number; autoMode?: AutoMode }
  | { type: "MOVE"; player: PlayerId; instanceId: string; to: Pos }
  | {
      type: "CAST_SPELL";
      player: PlayerId;
      spellId: string;
      targetId?: string;
      row?: number;
      col?: number;
      mode?: "attack" | "shield";
      /** Rewire / Full Reroute: the caster's own cards being moved. */
      targetIds?: string[];
      /** Full Reroute: where each of `targetIds` is going, index-matched. */
      slots?: Pos[];
    }
  | { type: "PASS"; player: PlayerId }
  | { type: "SET_AUTO"; player: PlayerId; instanceId: string; mode: AutoMode }
  | { type: "SURRENDER"; player: PlayerId }
  | { type: "FLOW_CHANGE"; player: PlayerId; instanceId: string; mode: "water" | "ice" | "steam" }
  | {
      type: "BATTLE_ACTION";
      player: PlayerId;
      action: "basic" | "special" | "skip" | "talent";
      /** Prism's Enchantment: which of the four buffs the caster picked. */
      mode?: EnchantMode;
      /** Single target: the full volley lands on it. */
      targetId?: string;
      /** Multi-selection: one hit/strike per entry, in order; repeat an id to
       *  stack ("up to N targets, or stacked on fewer"). */
      targetIds?: string[];
    };

export const OPENING_HAND = 4;
/** Cost ceiling on the FREE opening placement (§10.6). Without it, "free" means
 *  cost stops being a brake for exactly one card and every side opens with the
 *  most expensive thing it drew — a Throne would lead with its Mythic on turn
 *  zero. A teammate, not a champion. Lives here rather than in phases.ts so
 *  rules.ts can read it without importing the phase machine. */
export const OPENING_COST_CAP = 3;

/** Rounds a Special sits out when its card does not print its own cooldown.
 *
 *  2, not 1. At 1 the 160 Specials that declare nothing fired every other round
 *  — for the cheap ones, effectively every turn the magic allowed — which made
 *  a Special the default action rather than a decision. The twelve cards that
 *  DO print a cooldown (3, and Leo's 5) override this and are unaffected. */
export const DEFAULT_SPECIAL_COOLDOWN = 2;
/** Max hand size — draws that would exceed this are skipped (the cards stay on
 *  top of the deck, not burned). Bonus-draw rounds (10/15) partially fizzle when
 *  you're near the cap; that's the intended cost of a hand limit. */
export const HAND_CAP = 7;
/** The per-round grant for BOTH pools, in five-round brackets: +1 through round
 *  5, +2 through 10, +3 through 15, +4 through 20, +5 from 21 on.
 *
 *  Gold adds one per home slot held on top of this (see `doResourcePhase`);
 *  magic takes it alone. They share the curve because they used not to, and the
 *  split pulled the game apart: magic climbed while gold sat at a flat 1, so a
 *  long game had Specials to spare and no way to replace a lost body. Summoning
 *  is what puts pieces back on the board, and it was the one income that never
 *  grew.
 *
 *  There is deliberately no GOLD_PER_ROUND constant any more — a single number
 *  cannot describe this, and leaving one named that would invite reading it as
 *  the whole story. */
export function poolGainForRound(round: number): number {
  return Math.min(5, Math.ceil(round / 5));
}
export const POOL_CARRYOVER_CAP = 10;
/** DEFAULT board size for a new match. The live value is `state.boardSize` —
 *  read that, not this, anywhere a GameState is in scope. This constant only
 *  seeds a new game and serves as the fallback for the handful of pure helpers
 *  that take an explicit size. */
export const BOARD_SIZE = 4;
/** Minimum printed hit count for the "gain +1 HIT instead of +1 DMG" rule
 *  (King-of-the-Hill mid row, Flow Change Liquid). Cards below this get the flat
 *  +DMG; only heavy multi-hit cards (4+) trade it for an extra hit. */
export const MULTI_HIT_BONUS_MIN = 4;
/** Which half of the King-of-the-Hill mid-row bonus a card takes: `true` = +1
 *  HIT (worth its DMG), `false` = +1 DMG (worth its hit count).
 *
 *  The +1 HIT branch exists so a heavy shredder doesn't balloon — Eclipse at
 *  1×7 would become 2×7 = 14 on a flat +1 DMG. But for a 1-damage card that
 *  branch is worth only +1, which made a 4th printed hit an actual DOWNGRADE:
 *  1×4 delivered 5 in a mid row while 1×3 delivered 6, so the card printing
 *  MORE raw damage hit for less. Low-damage cards up to 5 hits therefore keep
 *  the DMG branch; 6+ hits stay on the HIT branch, where ballooning is the real
 *  risk.
 *
 *  Both call sites (effectiveDmg, effectiveBasicHits) MUST read this one
 *  function — they are exact complements, and a card that satisfied both (or
 *  neither) would get a double bonus (or none). */
export function hillGivesHit(dmg: number, hits: number): boolean {
  return hits >= MULTI_HIT_BONUS_MIN && !(dmg === 1 && hits <= 5);
}
/** Hard ceiling on match length. Without one a match can run forever: two sides
 *  whose survivors can't reach each other, with per-round chip damage exactly
 *  offset by healing, sit frozen indefinitely. At the ceiling the match is
 *  decided on progress instead (see decideOnTime). */
export const MAX_ROUNDS = 50;

/** Rounds a Void Tower fight lasts. Slay the boss inside it or the floor keeps
 *  you.
 *
 *  WHY THE MODE NEEDS ITS OWN CLOCK. Once the slot race came off, the boss had
 *  no realistic way to win: the player wins by killing ONE card and the boss by
 *  eliminating thirty-one, so every fight was the player grinding it down. The
 *  three bosses that did "win" were not winning, they were OUTLASTING — running
 *  the 50-round global limit out at 43-48 rounds and taking it on the tiebreak.
 *  That made survival-to-50 the only dial, and it barely turned: scaling
 *  Permafrost's whole body by FIVE moved it from 10% to 20%, because a boss
 *  that survives 40 rounds and one that survives 20 both lose to a clock at 50.
 *
 *  24 rounds gives the boss a real win condition — hold out — which is exactly
 *  the shape the fights already had, at a length a phone can hold. It is also
 *  the number the mode was already telling you: the Special fires every 3
 *  rounds, so a Void Tower fight is eight casts, start to finish, and you can
 *  count them. */
/** Extra gold the BOSS's side earns each round in a Void Tower fight.
 *
 *  THE BUG THIS FIXES: "most boss battles end with a lot of its army left that
 *  was never used", from the device — and the instrumentation agreed. At the end
 *  of Prep, Thunderfangs and Umbranova spend 60-65% of rounds holding cards they
 *  cannot afford, while the AI leaves a legal summon on the table 0% of the time.
 *  It is not the AI. It is the economy.
 *
 *  The formation is priced as a BUILD-TIME budget — 28 gold on Floor 3, 36 on
 *  Floor 4 — and the doc is explicit that this "is a build-time cap on the
 *  formation's OPENING, not a runtime wallet". But Void Tower passes no opening
 *  deployment, so the boss buys its own army at retail on `min(5, ceil(r/5))`
 *  income: about 70 gold across a whole fight, against a deck whose formation
 *  alone can cost 36 and whose cheapest reinforcements cost 3 apiece. Umbranova
 *  fields 10/9/7/5/5 on pocket change. So the boss walks down alone, dies, and
 *  the army it was supposed to be leading is still in its hand.
 *
 *  Paid as income rather than a lump so it cannot be shaved by the carryover
 *  cap, and only to the boss's seat — P1 keeps `VOID_PLAYER_HEAD_START`. */
export const VOID_BOSS_INCOME = 2;

/** Consecutive Cleanups the boss's side must hold EVERY slot of the player's
 *  home row before the overrun lands.
 *
 *  Two, because at one the rule was being won by chaff. Overclock took 91.7% of
 *  its fights with 91% of those ending in an overrun: Production Run floods the
 *  board with drones, the drones walk into the back line, and the fight was over
 *  with the boss barely involved — which is the opposite of a mode whose premise
 *  is that you win by slaying the thing. Its own HP was irrelevant to that
 *  number (40, 45 and 50 all measured 91.7% to the decimal).
 *
 *  A hold turns "the board tipped over for one Cleanup" into "you had a full
 *  round to kill ONE body and did not". Same last-ditch ending, with the turn to
 *  answer it that every other threat in this mode gives you. */
export const OVERRUN_HOLD_ROUNDS = 2;

export const VOID_TOWER_ROUNDS = 24;

/** The back row a player summons into and defends. P2 is always row 0; P1 is
 *  the far edge, which depends on how big the board is — hence the required
 *  `boardSize`. It has NO default on purpose: a silent fallback to 4 would put
 *  P1's home in the middle of a 5×5 and leave the last row dead, which is
 *  exactly the bug this replaced. Pass `state.boardSize`. */
export function homeRow(player: PlayerId, boardSize: number): number {
  return player === "P1" ? boardSize - 1 : 0;
}

/** The contested middle — where King of the Hill pays out (+1 DMG or +1 HIT,
 *  and +1 ranged reach).
 *
 *  Rows 1 and 2 at BOTH board sizes. On a 5×5 that deliberately leaves row 3
 *  out: whether the large board's middle is rows 1–3 or just row 2 is an open
 *  design call, and widening it here would silently re-tune every hill bonus at
 *  once. This is the single definition — change it here and every consumer
 *  follows. */
/** Rounds a boss holds its own home row before it may take a step forward.
 *
 *  A boss is standing on the board from round one — placed outside the economy,
 *  while the player is still deploying their first one or two cards. Letting it
 *  walk immediately meant the fight was on top of you before you had a board to
 *  meet it with, and a puzzle you are supposed to read and answer has to give
 *  you the reading half first. Two rounds is the opening: it looms, its clock
 *  is visibly counting, and you get to choose your ground.
 *
 *  It HOLDS rather than freezes — attacks, Specials and the free clock all fire
 *  normally, and it may still slide ALONG its own home row (Skeleeze's
 *  Swiftshooter), because that is repositioning, not advancing. What it cannot
 *  do is leave the row. */
export const BOSS_HOLD_ROUNDS = 2;

/** Is this card a boss that has not yet been released from its home row?
 *
 *  One function, because there are two ways off that row — the AI moving it in
 *  Prep and `roundTick.advance` walking it at Cleanup — and a rule written
 *  twice is a rule that drifts. (See the ARC discharge passive, which was
 *  gated in the engine and ungated in the card text for a month.) */
export function bossHeldHome(state: GameState, def: CardDef): boolean {
  return def.boss === true && state.round <= BOSS_HOLD_ROUNDS;
}

export function isMidRow(row: number): boolean {
  return row === 1 || row === 2;
}

export function enemyOf(player: PlayerId): PlayerId {
  return player === "P1" ? "P2" : "P1";
}

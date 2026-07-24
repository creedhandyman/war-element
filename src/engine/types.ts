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
  | "DRAIN";

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
  /** Powertrip (Voltogon): deal N to every ELECTRIFIED enemy (= carrying any
   *  status, the BOLT proxy), at most once per round. */
  aoeDmgElectrified?: number;
  /** Harvester (Wedded Wraith): every kill raises another token. */
  spawnToken?: { token: string; count: number };
  coinBonusDmg?: number; // coin flip: +this or +this−1 permanent DMG
  reduceSpecialCost?: number; // King Me (Heir): shave N off this card's Special cost per kill
  /** Static Charge (Static): on a kill, extend the named status on every enemy
   *  that already carries it by `rounds` (deepen the crowd-control). */
  extendStatus?: { kind: StatusKind; rounds: number };
}

/** A basic-attack conditional keyword that only applies vs a target already
 *  carrying `status` (e.g. LIFESTEAL vs ROOTed, CRIT vs PARALYZED). */
export interface VsStatusDef {
  status: StatusKind;
  /** Match ANY status instead of the named one — models "Electrified" (BOLT's
   *  "has a status") triggers, e.g. Zagphu's "vs Electrified OR PARALYZED". */
  anyStatus?: boolean;
  lifesteal?: boolean;
  crit?: boolean;
  bonusDmg?: number; // +DMG per hit
  dmgMult?: number; // multiply per-hit DMG (2 = double vs the status)
  healOnHit?: number; // heal self N when a hit lands on such a target
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
  channel?: { hpCost: number; rowAheadDmg: number };
  rootedDmg?: number; // Trapper (Fallow): damage every ROOTed enemy, range-free
  /** Morning Dew (Sprinu): heal every ally of this element at end of round. */
  roundHealElement?: { element: Element; amount: number };
  aoeDmg?: number; // damage every enemy in range
  aoeStatus?: { kind: StatusKind; duration: number; power: number };
  lowestEnemyStatus?: { kind: StatusKind; duration: number; power: number };
  pokeDmg?: number; // damage the closest single enemy
  pokeStatus?: { kind: StatusKind; duration: number; power: number };
  healAllies?: number; // heal every ally N
  healLowestAlly?: number; // heal the lowest-HP ally N
  /** +DMG (and optionally +SP) every Nth round, stacking (Dragon's Blade). */
  buffDmgEveryN?: { n: number; amount: number; sp?: number };
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
  pokeParalyzedDmg?: number; // deal N DMG to one PARALYZED enemy in range (Sentry's Volt Turret)
  aoeParalyzedDmg?: number; // deal N DMG to EVERY PARALYZED enemy in range (Lytning's Complete Circuit)
  wardAllies?: boolean; // refresh a status-absorbing barrier on all allies (Solstice's Radiant Ward)
  cleanseAllies?: boolean; // strip all negative statuses from allies (Imperator's Crowned)
  /** Spawn a token each round (Trinezer's Reptilian Screech). adjacentOnly =
   *  only into an open king's-reach slot; no spawn if none is open. */
  /** Wildfire (Scorch): re-apply a status to every opponent standing in THEIR
   *  home row, each round. The on-summon burst only catches whoever happens to
   *  be there at that instant — and enemies summon INTO that row, so without
   *  this the ground never stays lit and the card reads as doing nothing. */
  enemyHomeRowStatus?: { kind: StatusKind; duration: number; power: number };
  /** Shoksa: damage every ELECTRIFIED opponent in range at end of round. Reads
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
  scope: "element" | "tribe" | "class" | "all";
  match?: string;
  dmg?: number;
  sp?: number;
  maxHp?: number; // matching allies gain +N max HP while the holder lives (SeaC)
  pen?: boolean; // matching allies' basic attacks gain PEN (Blood Ruby)
  shields?: number; // matching allies are topped up to base+N shields each round (Pressure)
}

/** A temporary flat DMG/SP modifier with a Cleanup countdown. Positive = a buff
 *  (Golden Courage team +DMG), negative = a debuff (Mighty Winds −SP). */
export interface TimedBuff {
  dmg: number;
  sp: number;
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
  sp: number; // 0–15 (GALE cap 21 out of alpha scope — no GALE cards)
  shields: number;
  keywords: Partial<Record<Keyword, number | true>>;
  /** Status applied by basic attacks that land at least one hit. */
  onHitStatus?: OnHitStatusDef;
  /** Thorns: retaliate when hit by a melee attacker. */
  onHitByMelee?: OnHitByMeleeDef;
  /** Jelly Shock (Jellyfish): discharge when HIT and still standing — `dmg` to
   *  the attacker plus every enemy adjacent to this card. Unlike thorns it
   *  answers RANGED attackers too, and it splashes rather than hitting one. */
  onHitZap?: {
    dmg: number;
    status?: { kind: StatusKind; duration: number; power: number };
  };
  /** On-kill trigger (this card's attack defeats an enemy). */
  onKill?: OnKillDef;
  /** Conditional basic-attack keyword vs a target carrying a status. */
  vsStatus?: VsStatusDef;
  /** Dragon's Bane (Drakonbane): a bonus keyed on WHAT the target IS rather
   *  than what status it carries — a tribe, or simply a big enough body. The
   *  two conditions are OR'd: either one makes a target "bane-worthy".
   *
   *  `hpAbove` reads CURRENT HP, not max. A wounded giant stops being the thing
   *  a bane hunter is built to kill, which is also what keeps a cost-4 card
   *  from carrying a permanent +2 against the whole top of the curve. */
  vsTarget?: { tribe?: string; hpAbove?: number; bonusDmg?: number };
  /** Swamp Monster (Magalogoon): stealth as a CONDITIONAL passive, not a
   *  standing keyword. The card is hidden ONLY while it has neither moved nor
   *  attacked this round — so it is never "always" stealthed the way the STEALTH
   *  keyword is. Read exclusively through isStealthed(). */
  stealthWhenIdle?: boolean;
  /** Stinger Buzz (Beebot): a one-shot. The round it ATTACKS, it dies at that
   *  round's Cleanup — the sting is spent and the bee is gone. Its on-hit DOT
   *  still lands and still ticks; the corpse just doesn't linger. */
  diesAfterAttacking?: boolean;
  /** Elemental Fury (Prism): lands with its Special already paid for, so the
   *  first Enchantment is free. */
  startsWithFreeSpecial?: boolean;
  /** Prism's Special arms an Enchantment rather than doing anything itself. */
  enchanter?: boolean;
  /** Hive Mind (Keeper): living allies of `tribe` soak up to `pct`% of the HP
   *  damage aimed at this card. Applied AFTER the shield gate, so it splits
   *  what would actually have reached HP — and capped by what the swarm can
   *  actually take, since a 3 HP Beebot cannot absorb 20. */
  hiveAbsorb?: { tribe: string; pct: number };
  /** Periodic self effect resolved each Cleanup. */
  roundTick?: RoundTickDef;
  /** On-death revival (Bearocks). */
  onRevive?: OnReviveDef;
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
  };
  /** This card's attacks do NOT wake SLEEPING targets (Sandman's Nightmare —
   *  his hits ignore SLEEP's break-on-hit rule). */
  ignoresSleepWake?: boolean;
  /** Bonus DMG on the FIRST basic attack this card lands against each distinct
   *  opponent (Klipso's Harsh Winds), once per opponent for the game. */
  firstStrikeBonus?: number;
  /** A flat bonus added ONCE to the total after a basic attack resolves (not
   *  per hit), gated on board conditions (Sandman). Lands on the primary target. */
  basicBonus?: {
    midLane?: number; // +N while this card sits in a Mid row
    midLaneFull?: number; // +N when 4+ cards occupy the Mid rows
    vsSleeping?: number; // +N when the primary target is SLEEPING
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
  /** A permanent self-buff applied when a basic attack LANDS (once per attack):
   *  Volcanon's Bad Temper and the Rager Twins (+1 DMG on hit). */
  onHitSelfBuff?: { dmg: number };
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
  /** Hillside (Hillbilly): when a basic attack lands, grant shields to allies in
   *  the row directly ahead. `firstTimeOnly` = only the first landed attack. */
  onHitAllyBuff?: { shields?: number; firstTimeOnly?: boolean };
  /** High Speed Impact (Hawk): +1 DMG per point of effective SP above 10. */
  highSpeedImpact?: boolean;
  /** Hot Shot (Clipsey): attacks never miss — ignores the caster's own BLIND
   *  and the target's EVASION (200% accuracy / ignore-evasion). */
  alwaysHit?: boolean;
  /** Shadow (Vaga): can only be attacked by ADJACENT opponents — attackers a row
   *  or more away (incl. ranged) can't reach it. */
  onlyAdjacentAttackers?: boolean;
  /** Trample Through (WarPhant): in PREP it may step INTO an adjacent enemy with
   *  less effective max HP, shoving it one slot further along the same line and
   *  taking the vacated square. Needs the slot beyond the victim to be open and
   *  uncaptured — nothing is crushed against a wall or another body. */
  shoveWeaker?: boolean;
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
  /** Gate the firstStrikeBonus so it only applies while this card stands on the
   *  enemy battlefield (Vaga's Shadow first-strike). */
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
  };
  /** Obsidian Claws (Obsidi): SP is replaced by this while the card is
   *  STEALTHed — underground it moves far faster than it does in the open. */
  spWhileStealthed?: number;
  /** Pride Guardian (Monger): the first time each ALLY takes a hit, this card
   *  throws it `shields`. Once per ally, tracked on the ally itself. */
  onAllyHitShield?: number;
  /** Morning Dew (Sprinu): its basic attack may be aimed at an ALLY, healing
   *  them for its DMG instead of striking. Allies become legal basic targets. */
  basicHealsAllies?: boolean;
  /** Gate Keeper (Veil): grant this many shields to SELF on summon (a passive
   *  grant, not a base stat, so it stays off the cost curve). */
  /** Display names for this card's passives, keyed by the def field each one
   *  comes from. The card face prints "Wind Wake — every landed hit shoves…"
   *  instead of an unnamed sentence. Per-CARD, not per-field, because the same
   *  mechanic is named differently on different cards: summonSelfShields is
   *  "War Ready" on WarPhant and "War Mount" on RohoJohn. */
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
  summonSelfShields?: number;
  /** War Mount (RohoJohn): a mounted Ranger also mauls what it stands beside —
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
  /** Wind Wake (Wista): every landed hit shoves the victim back a slot. */
  onHitPush?: number;
  /** Gate Keeper (Veil): the first time this card's shields break to 0, gain
   *  these permanent buffs. */
  onShieldBreak?: { dmg?: number; sp?: number; status?: { kind: StatusKind; duration: number; power: number } };
  /** Rocky Force Field (Rhe): a coin-flip chance (0–100) to dodge a RANGED
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
    /** Last Waltz (Wedded Wraith): as she falls, every surviving ally of this
     *  tribe takes a permanent +DMG, and enemies in range are FRIGHTENed. */
    allyTribeBuffDmg?: { tribe: string; dmg: number };
    /** WarPhant: the rider survives the mount and keeps fighting. */
    spawnToken?: { token: string; count: number };
    frightenInRange?: number; // rounds of FRIGHTEN on reachable enemies
    /** Contagion (Zombination's zombies): damage to enemies ADJACENT TO THE
     *  SLOT IT FELL ON. Distinct from `dmg`, which retaliates against whoever
     *  landed the kill — a zombie bursting is not a grudge, so it hits whatever
     *  was standing next to it however it died. */
    splashInRange?: number;
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
    /** Optional — omit for a pure self-status on-summon (IcyNinza's Icy Mist). */
    handler?: string;
    params?: Record<string, number | string>;
    /** Who the on-summon effect hits. Default "enemy". "ally" fires an ally
     *  handler (grantShield/buffSp/heal) on friendly cards in the forward area
     *  (Smith Reforged, Duster Dust Off). */
    targetSide?: "enemy" | "ally";
    /** A buff status the summoned card grants ITSELF (e.g. STEALTH for N rounds). */
    selfStatus?: StatusKind;
    selfStatusDuration?: number;
    /** IcyNinza's Icy Mist: while the self-status (STEALTH) is up, each kill
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
  hitsBonusRound: number; // extra basic hits for the turn (Flow Change Liquid on multi-hit)
  tempShields: number; // shields granted "for the turn" (removed in Cleanup)
  /** Basic hits this card has LANDED on each target this round (keyed by target
   *  instanceId). Powers first-hit-only / on-second-hit riders; reset in Cleanup. */
  struckThisRound: Record<string, number>;
  /** Enemy hits this card has TAKEN this round — every attack that connected,
   *  including one fully soaked by shields. Powers Squanch's Regenerative, which
   *  cashes it in at Cleanup; reset there too. */
  hitsTakenThisRound: number;
  /** Nightfall (DUSK field): its EVASION covers only the FIRST hit taken each
   *  round, so the cover is spent on the first attempt — landed or dodged — and
   *  cleared again in Cleanup. */
  fieldEvasionUsed?: boolean;
  /** An ambush loaded into the NEXT basic attack (Obsidi's Dirt Driller): it
   *  overrides both DMG and hit count for that one attack, then clears. */
  loadedStrike?: { dmg: number; hits: number };
  /** An armed Enchantment (Prism). Spent by the next BASIC attack this card
   *  makes, whoever is holding it — Prism can hand one on as it dies. */
  enchant?: EnchantMode;
  /** A status riding the next `attacks` basic attacks (SSeerr's Flaming
   *  Slasher). Decremented once per attack that lands, not per hit. */
  loadedOnHit?: { kind: StatusKind; duration: number; power: number; attacks: number };
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
  /** One-shot guard for a firstTimeOnly onHitAllyBuff (Hillbilly's Hillside). */
  onHitBuffFired: boolean;
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
  attackedThisRound: boolean; // STEALTH break tracking; reset each Cleanup
  /** Swamp Monster (Magalogoon): moving breaks its STEALTH as surely as
   *  attacking does. Per-CARD, unlike prep.movedThisTurn which is the
   *  one-move-per-turn budget for the whole side. Reset each Cleanup. */
  movedThisRound?: boolean;
  /** Bog Ambush: rounds left of a flat -25% accuracy. Deliberately NOT a status
   *  — the card reads "murky water in their eyes, flat effect, no status tag",
   *  so it survives cleanses and shows up nowhere in the status row. */
  accuracyDebuffRounds?: number;
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
  spellId: string;
  element: Element;
  pos: Pos;
  dmg: number;
  pen?: boolean;
  status?: { kind: StatusKind; duration: number; power: number };
  /** Inferno Pit: the payload also hits opponents adjacent to the victim. */
  splash?: boolean;
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
  /** Accelerator (Scorch): rounds remaining in which BURN this player inflicted
   *  on its ENEMIES deals double. Ticked down in Cleanup. */
  burnBoostRounds?: number;
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
  by: "capture" | "elimination" | "surrender" | "timeout";
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
  win: WinInfo | null;
  log: string[];
  nextId: number; // instance/hand id counter
  stats: MatchStats; // post-match analytics (damage/heal/captures/kills)
}

export type Intent =
  | { type: "MULLIGAN"; player: PlayerId; returnHandIds: string[] }
  | { type: "SUMMON"; player: PlayerId; handId: string; col: number }
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
/** Max hand size — draws that would exceed this are skipped (the cards stay on
 *  top of the deck, not burned). Bonus-draw rounds (10/15) partially fizzle when
 *  you're near the cap; that's the intended cost of a hand limit. */
export const HAND_CAP = 7;
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
 *  The +1 HIT branch exists so a heavy shredder doesn't balloon — Clipsey at
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
export function isMidRow(row: number): boolean {
  return row === 1 || row === 2;
}

export function enemyOf(player: PlayerId): PlayerId {
  return player === "P1" ? "P2" : "P1";
}

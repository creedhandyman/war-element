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
  // Buff statuses — a temporary grant of the like-named keyword, ticked down at
  // Cleanup (Dive Bomb → STEALTH, Shadow Charge → EVASION).
  | "STEALTH"
  | "EVASION";

/** Negative statuses — the ones Radiant Ward absorbs and Crowned cleanses.
 *  (STEALTH/EVASION are self-buffs and are excluded.) */
export const NEGATIVE_STATUSES: StatusKind[] = [
  "ROOT", "BLEED", "BURN", "SCALD", "DOT", "FREEZE", "STUN", "WEAKEN",
  "PARALYZE", "MUTED", "SLEEP", "FRIGHTEN", "BLIND", "SEAL",
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
  targetSide: "enemy" | "ally";
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
  aoeDmg?: number; // damage every enemy in range
  aoeStatus?: { kind: StatusKind; duration: number; power: number };
  lowestEnemyStatus?: { kind: StatusKind; duration: number; power: number };
  pokeDmg?: number; // damage the closest single enemy
  pokeStatus?: { kind: StatusKind; duration: number; power: number };
  healAllies?: number; // heal every ally N
  healLowestAlly?: number; // heal the lowest-HP ally N
  buffDmgEveryN?: { n: number; amount: number }; // +DMG every Nth round (stacking)
  scaldFrozen?: number; // apply SCALD N to FROZEN enemies (Freezer Burn)
  paralyzeOne?: number; // PARALYZE one un-paralyzed enemy for N rounds
  pushEnemies?: number; // blow every enemy back N slots (Wind Guardian)
  rowAheadDmg?: number; // deal N DMG to enemies in the row directly ahead (Sweeping Flames)
  inRangeDmg?: number; // deal N DMG to EVERY opponent this card can reach (Smog's Black Smoke)
  inRangeDmgPen?: boolean; // make inRangeDmg PENetrate shields (UFO's Radiation)
  selfShields?: number; // gain N shields each round (Heir's Royal Guard)
  pokeParalyzedDmg?: number; // deal N DMG to one PARALYZED enemy in range (Sentry's Volt Turret)
  aoeParalyzedDmg?: number; // deal N DMG to EVERY PARALYZED enemy in range (Lytning's Complete Circuit)
  wardAllies?: boolean; // refresh a status-absorbing barrier on all allies (Solstice's Radiant Ward)
  cleanseAllies?: boolean; // strip all negative statuses from allies (Imperator's Crowned)
  /** Spawn a token each round (Trinezer's Reptilian Screech). adjacentOnly =
   *  only into an open king's-reach slot; no spawn if none is open. */
  spawn?: { token: string; count: number; adjacentOnly?: boolean };
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
  /** Zombie Husk's Reanimation: instead of a one-time revive, come back on EVERY
   *  death with every base stat (DMG/HP/SP) reduced by `decay`, until a stat would
   *  hit 0 — then it stays dead. Revives at its (now lower) full HP. */
  decay?: number;
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
  /** On-kill trigger (this card's attack defeats an enemy). */
  onKill?: OnKillDef;
  /** Conditional basic-attack keyword vs a target carrying a status. */
  vsStatus?: VsStatusDef;
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
  summonSpawn?: { token: string; count: number };
  /** Brightest Warrior (Radiance): on summon, scale up by the strongest foe —
   *  +`dmg` DMG and/or +`maxHp` max HP for each `per` max-HP the highest-HP
   *  opponent on the board has. */
  summonScaleFromEnemy?: { per: number; dmg?: number; maxHp?: number };
  /** A permanent self-buff applied when a basic attack LANDS (once per attack):
   *  Volcanon's Bad Temper (+1 DMG on hit) and Squanch's Regenerative (+1 shield
   *  on hit, capped at `maxShields`). */
  onHitSelfBuff?: { dmg?: number; shields?: number; maxShields?: number };
  /** Liquification (Bahari): heal N HP per landed basic hit (unconditional). */
  healPerHit?: number;
  /** Rager (Twins): while this card is below `hp` HP, its basic attacks deal
   *  `dmgMult`× damage (a rage downside). */
  weakBelowHp?: { hp: number; dmgMult: number };
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
  /** Gate the firstStrikeBonus so it only applies while this card stands on the
   *  enemy battlefield (Vaga's Shadow first-strike). */
  firstStrikeEnemySideOnly?: boolean;
  /** Gate Keeper (Veil): grant this many shields to SELF on summon (a passive
   *  grant, not a base stat, so it stays off the cost curve). */
  summonSelfShields?: number;
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
  tribe?: string;
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
  onDeath?: { dmg: number; pen?: boolean; rowAhead?: boolean };
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

export interface Pos {
  row: 0 | 1 | 2 | 3;
  col: 0 | 1 | 2 | 3;
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

export type SpellKind = "damage" | "heal" | "wall";

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

export interface SpellDef {
  id: string;
  name: string;
  element: Element;
  cost: number;
  kind: SpellKind;
  text: string;
  // ── damage spells (need an enemy target) ──
  dmg?: number;
  pen?: boolean;
  status?: { kind: StatusKind; duration: number; power: number }; // onto the enemy target
  push?: number; // push the enemy target back N (if open)
  // ── ally rider / heal (auto-picked ally of the spell's element) ──
  allyShield?: number;
  allyHeal?: number;
  allyHealIfRooted?: number; // heal this instead when any opponent is ROOTed
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
  /** Summon pool: gains = round # each round (cap 10 carryover). Pays for
   *  summoning Champions only. */
  summonPool: number;
  /** Magic pool: starts at 3, +1 per round from round 2 (cap 10 carryover).
   *  Pays for Specials (and, post-alpha, Spells). Never drains the summon
   *  pool and vice-versa. */
  magicPool: number;
  mulliganDone: boolean;
  /** Radiant Ward (Solstice): a single team-wide barrier that absorbs the first
   *  negative status to hit any ally this round. Refreshed each round it's up. */
  statusWard?: boolean;
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
  winner: PlayerId;
  by: "capture" | "elimination" | "surrender";
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
  /** 4×4 slot metadata, [row][col]. */
  slots: SlotState[][];
  prep: PrepState | null;
  battle: BattleState | null;
  /** Active row-level Walls (Cost-4 spells). Empty until a wall is cast. */
  walls: WallState[];
  /** A human just summoned an AQUA card and must pick its Flow Change buff
   *  (instanceId). AI summons resolve immediately, so this only gates humans. */
  pendingFlow: string | null;
  win: WinInfo | null;
  log: string[];
  nextId: number; // instance/hand id counter
}

export type Intent =
  | { type: "MULLIGAN"; player: PlayerId; returnHandIds: string[] }
  | { type: "SUMMON"; player: PlayerId; handId: string; col: number }
  | { type: "MOVE"; player: PlayerId; instanceId: string; to: Pos }
  | { type: "CAST_SPELL"; player: PlayerId; spellId: string; targetId?: string; row?: number }
  | { type: "PASS"; player: PlayerId }
  | { type: "SET_AUTO"; player: PlayerId; instanceId: string; mode: AutoMode }
  | { type: "SURRENDER"; player: PlayerId }
  | { type: "FLOW_CHANGE"; player: PlayerId; instanceId: string; mode: "water" | "ice" | "steam" }
  | {
      type: "BATTLE_ACTION";
      player: PlayerId;
      action: "basic" | "special" | "skip" | "talent";
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
export const BOARD_SIZE = 4;
/** Minimum printed hit count for the "gain +1 HIT instead of +1 DMG" rule
 *  (King-of-the-Hill mid row, Flow Change Liquid). Cards below this get the flat
 *  +DMG; only heavy multi-hit cards (4+) trade it for an extra hit. */
export const MULTI_HIT_BONUS_MIN = 4;

export function homeRow(player: PlayerId): 0 | 3 {
  return player === "P1" ? 3 : 0;
}

export function enemyOf(player: PlayerId): PlayerId {
  return player === "P1" ? "P2" : "P1";
}

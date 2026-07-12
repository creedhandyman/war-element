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
  | "BLIND";

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
}

/** Fires when this card's basic/special attack KILLS an enemy (per kill). */
export interface OnKillDef {
  buffDmg?: number; // permanent +DMG (stacks)
  buffDmgRound?: number; // +DMG for the rest of the round
  buffSp?: number; // permanent +SP
  buffHits?: number; // permanent +1 basic hit (stacks)
  healSelf?: number; // heal self N
  gainShields?: number;
  aoeDmg?: number; // deal N to every reachable enemy
  coinBonusDmg?: number; // coin flip: +this or +this−1 permanent DMG
}

/** A basic-attack conditional keyword that only applies vs a target already
 *  carrying `status` (e.g. LIFESTEAL vs ROOTed, CRIT vs PARALYZED). */
export interface VsStatusDef {
  status: StatusKind;
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
}

export interface CardDef {
  id: string; // stable unique key, e.g. 'leaf_sumerose'
  name: string;
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
  /** Catapult-style passives: this card may target the enemy Home row from
   *  anywhere (skips the Home Slot Targeting Rule). */
  ignoresHomeRule?: boolean;
  /** Hibernation-style passives: negative statuses never land on this card
   *  (ROOT/BURN/SLEEP/etc. are all refused). */
  statusImmune?: boolean;
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
    handler: string;
    params?: Record<string, number | string>;
    /** Who the on-summon effect hits. Default "enemy". "ally" fires an ally
     *  handler (grantShield/buffSp/heal) on friendly cards in the forward area
     *  (Smith Reforged, Duster Dust Off). */
    targetSide?: "enemy" | "ally";
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

export interface PlayerState {
  deck: string[]; // defIds, top of deck = index 0
  hand: HandCard[];
  /** Summon pool: gains = round # each round (cap 10 carryover). Pays for
   *  summoning Champions only. */
  summonPool: number;
  /** Magic pool: starts at 3, +1 per round from round 2 (cap 10 carryover).
   *  Pays for Specials (and, post-alpha, Spells). Never drains the summon
   *  pool and vice-versa. */
  magicPool: number;
  mulliganDone: boolean;
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
  firstPlayer: PlayerId; // coin-flip winner; prep priority starts here each round
  players: Record<PlayerId, PlayerState>;
  /** All living board cards, keyed by instanceId. Board layout derived from pos. */
  cards: Record<string, CardInstance>;
  /** 4×4 slot metadata, [row][col]. */
  slots: SlotState[][];
  prep: PrepState | null;
  battle: BattleState | null;
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
  | { type: "PASS"; player: PlayerId }
  | { type: "SET_AUTO"; player: PlayerId; instanceId: string; mode: AutoMode }
  | { type: "SURRENDER"; player: PlayerId }
  | { type: "FLOW_CHANGE"; player: PlayerId; instanceId: string; mode: "water" | "ice" | "steam" }
  | {
      type: "BATTLE_ACTION";
      player: PlayerId;
      action: "basic" | "special" | "skip";
      /** Single target: the full volley lands on it. */
      targetId?: string;
      /** Multi-selection: one hit/strike per entry, in order; repeat an id to
       *  stack ("up to N targets, or stacked on fewer"). */
      targetIds?: string[];
    };

// No max hand size currently (per the rules brief — flag if hands balloon).
export const OPENING_HAND = 4;
export const POOL_CARRYOVER_CAP = 10;
export const BOARD_SIZE = 4;

export function homeRow(player: PlayerId): 0 | 3 {
  return player === "P1" ? 3 : 0;
}

export function enemyOf(player: PlayerId): PlayerId {
  return player === "P1" ? "P2" : "P1";
}

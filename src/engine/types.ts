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
  /** Rounds locked out after firing. Omit for the standard 1-round floor;
   *  a card may print a longer cooldown (2/3/5). */
  cooldown?: number;
  text: string; // human-readable card text
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
  onHitStatus?: { kind: StatusKind; duration: number; power: number };
  /** Catapult-style passives: this card may target the enemy Home row from
   *  anywhere (skips the Home Slot Targeting Rule). */
  ignoresHomeRule?: boolean;
  /** On-death retaliation (Lingering Venom / Bird Bomb): when this card is
   *  killed by an attack, deal dmg back to the killer. Direct damage — no
   *  evasion, no reflect chains. DOT/self-damage deaths have no killer. */
  onDeath?: { dmg: number; pen?: boolean };
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
  dmgBonus: number; // permanent modifiers (DRAIN-adjacent effects; 0 in alpha)
  status: StatusEffect | null; // max ONE status per card (newest overwrites)
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
  by: "capture" | "elimination";
}

export interface GameState {
  rngState: number; // seeded RNG cursor — all randomness flows through this
  round: number;
  phase: Phase;
  firstPlayer: PlayerId; // coin-flip winner; prep priority starts here each round
  players: Record<PlayerId, PlayerState>;
  /** All living board cards, keyed by instanceId. Board layout derived from pos. */
  cards: Record<string, CardInstance>;
  /** 4×4 slot metadata, [row][col]. */
  slots: SlotState[][];
  prep: PrepState | null;
  battle: BattleState | null;
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

export const HAND_CAP = 7;
export const OPENING_HAND = 5;
export const POOL_CARRYOVER_CAP = 10;
export const BOARD_SIZE = 4;

export function homeRow(player: PlayerId): 0 | 3 {
  return player === "P1" ? 3 : 0;
}

export function enemyOf(player: PlayerId): PlayerId {
  return player === "P1" ? "P2" : "P1";
}

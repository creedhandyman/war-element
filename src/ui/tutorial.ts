// THE FIRST BATTLE, STEP BY STEP (owner, 2026-10-04).
//
// A player's feedback, in short: the game explained itself before they had done
// anything, so they skipped the text, then sat in a match not knowing what to
// tap. Text that comes before any action reads as optional lore. So the first
// battle TEACHES BY FORCED PLAY: everything but the one thing to tap is dimmed
// and untappable, and one short instruction says what to do with it.
//
// The beat sheet (owner-approved, 2026-10-04) teaches, in order: placing a card,
// Pass, moving, a melee attack (the first one diagonal, so "all 8 squares
// around it" lands when it matters), buying a card with Gold, the back-and-forth
// of priority, and capture. Shields, statuses, spells and Specials stay out.
//
// BOTH SEATS ARE SCRIPTED. The match has two human seats; the player is P1 and
// this module plays P2 (`enemyStep`). An enemy run by the AI would make the
// lesson depend on the AI's choices, which change whenever the AI is tuned. A
// fixed seed, fixed decks and a scripted enemy make the whole battle the same
// every time, and `tutorial.test.ts` plays it end to end so a rules change that
// breaks a beat fails the build instead of a new player's first minute.
//
// The enemy is two Grills (the plainest card in the set: no abilities) set to
// 5 and 4 HP as they are placed, so each falls to Birch's single hit. Birch is
// faster, so neither ever strikes back, and so no element power (a Burn, a
// grown shield) ever fires during the lesson.
import { applyIntent, cardAt, createInitialState, needsInput, advance } from "../engine";
import type { CardInstance, GameState, Intent, PlayerId, Pos } from "../engine";
import type { StorySave } from "../data/story";
import { everCleared, freePacks } from "../data/story";

/** `taught` marks: the tutorial was finished, or skipped on purpose. */
export const TUT_DONE = "TUT_DONE";
export const TUT_SKIP = "TUT_SKIP";

/** The seed whose coin flip lets the enemy place its card first, so the player
 *  places theirs and presses Pass ONCE to start the round. */
export const TUTORIAL_SEED = 1;
export const TUTORIAL_YOU = ["leaf_birch", "leaf_cactus"] as const;
export const TUTORIAL_FOE = ["pyro_bbq", "pyro_bbq"] as const;
/** HP each Grill is placed at: the first in the opening, the second in round 2. */
const FOE_HP = { first: 5, second: 4 } as const;

const BIRCH = "leaf_birch";
const CACTUS = "leaf_cactus";

/** Should a player see the first-run screen (Play / the tutorial)? Only a save
 *  that has done nothing yet: no fight won, the free pack still unopened, and
 *  no tutorial mark. Everyone with progress keeps the Home they know. */
export function needsFirstRun(save: StorySave): boolean {
  const taught = save.taught ?? [];
  if (taught.includes(TUT_DONE) || taught.includes(TUT_SKIP)) return false;
  return everCleared(save).length === 0 && freePacks(save) > 0;
}

/** The tutorial's opening state: decks dealt, both hands kept, waiting on the
 *  enemy's opening placement. */
export function createTutorialState(): GameState {
  let s = createInitialState(
    TUTORIAL_SEED, [...TUTORIAL_YOU], [...TUTORIAL_FOE], ["P1", "P2"], [], [], 4, { P1: 1, P2: 1 },
  );
  s = applyIntent(s, { type: "MULLIGAN", player: "P1", returnHandIds: [] });
  s = applyIntent(s, { type: "MULLIGAN", player: "P2", returnHandIds: [] });
  for (let i = 0; i < 50 && needsInput(s) === null; i++) s = advance(s);
  return s;
}

const mine = (s: GameState, defId: string): CardInstance | undefined =>
  Object.values(s.cards).find((c) => c.owner === "P1" && c.defId === defId && c.pos && c.curHp > 0);
const foes = (s: GameState): CardInstance[] =>
  Object.values(s.cards).filter((c) => c.owner === "P2" && c.pos && c.curHp > 0);
const at = (c: CardInstance | undefined, row: number, col: number) =>
  !!c?.pos && c.pos.row === row && c.pos.col === col;

/** The enemy's scripted move, when it is the enemy's turn to act; else null.
 *  Pure: the same state always yields the same next state. */
export function enemyStep(s: GameState): GameState | null {
  if (needsInput(s) !== "P2") return null;
  const P2: PlayerId = "P2";
  const pass: Intent = { type: "PASS", player: P2 };
  let intent: Intent = pass;
  let hp: number | null = null;
  if (s.phase === "battle") {
    // Never reached on the script (each Grill dies before its turn, or has no
    // one in reach and is skipped), but a scripted seat must never stall.
    intent = { type: "BATTLE_ACTION", player: P2, action: "skip" };
  } else if (s.phase === "prep") {
    const hand = s.players.P2.hand;
    const moved = s.prep?.movedThisTurn;
    const g = foes(s)[0];
    if (s.round === 0 && hand.length === 2) {
      intent = { type: "SUMMON", player: P2, handId: hand[0].handId, col: 2 };
      hp = FOE_HP.first;
    } else if (s.round === 1 && !moved && at(g, 0, 2)) {
      intent = { type: "MOVE", player: P2, instanceId: g!.instanceId, to: { row: 1, col: 2 } as Pos };
    } else if (s.round === 2 && hand.length === 1 && foes(s).length === 0) {
      intent = { type: "SUMMON", player: P2, handId: hand[0].handId, col: 3 };
      hp = FOE_HP.second;
    } else if (s.round === 3 && !moved && at(g, 0, 3)) {
      intent = { type: "MOVE", player: P2, instanceId: g!.instanceId, to: { row: 0, col: 2 } as Pos };
    }
  }
  const next = applyIntent(s, intent);
  if (hp !== null && intent.type === "SUMMON") {
    // Wound the Grill it just placed. A shallow copy of the one card touched;
    // the reducer already handed back fresh state, so nothing shared changes.
    const placed = cardAt(next, 0, intent.col);
    if (placed) next.cards[placed.instanceId] = { ...placed, curHp: hp, maxHp: hp };
  }
  return next;
}

/** What the tutorial is pointing at. */
export type TutTarget =
  | { kind: "hand"; defId: string }
  | { kind: "slot"; row: number; col: number }
  | { kind: "pass" }
  | { kind: "verb"; verb: "basic" | "special" }
  /** The spellbook's toggle, on the layouts that fold it away. */
  | { kind: "spellbook" }
  /** One spell in the book. */
  | { kind: "spell"; spellId: string };

/** The parts of the App's UI a beat needs to see: what is selected and armed. */
export interface TutUi {
  /** The def of the hand card armed for summoning, if any. */
  handDef: string | null;
  /** The board card selected (to move), if any. */
  cardId: string | null;
  /** The armed battle verb ("basic" for Attack), if any. */
  pending: string | null;
  /** The spell armed for casting, if any. */
  spellId?: string | null;
}

export interface Beat {
  id: string;
  /** The instruction. One line, large. */
  big: string;
  /** Optional detail, small: the rule behind the move. */
  small?: string;
  /** Shown while the player cannot act yet (the enemy's turn, the board
   *  resolving) — what is happening on screen right now. */
  wait?: string;
  target: TutTarget;
  /** When `target` is not on screen yet, the tap that puts it there — the
   *  spellbook's toggle before a spell inside it — with its own line. The rail
   *  shows this instead until the real target appears. */
  pre?: { target: TutTarget; big: string; small?: string };
  /** Done once this holds — read off the game and the UI, never a counter, so
   *  a beat finished by any route (an auto-attack, say) moves on. */
  done: (s: GameState, ui: TutUi) => boolean;
}

const roundPast = (s: GameState, r: number) => s.round > r || s.phase === "gameover";
/** Round `r`'s prep is over: both sides passed. A Pass beat that is the round's
 *  LAST waits for this rather than for the player's own pass, so while the
 *  enemy finishes its turn the rail says so — instead of jumping to the next
 *  beat's line ("Battle!") a second early. Shared with tutorial-magic.ts. */
export const prepOver = (s: GameState, r: number) =>
  roundPast(s, r) || (s.round === r && s.phase !== "prep");

/** The beat sheet. */
export const BEATS: Beat[] = [
  // ── the opening placement ───────────────────────────────────────────────
  { id: "hand-birch", big: "Tap Birch.", wait: "The enemy places a card.",
    target: { kind: "hand", defId: BIRCH },
    done: (s, ui) => ui.handDef === BIRCH || !!mine(s, BIRCH) },
  { id: "place-birch", big: "Place it here. Your first card is free.",
    target: { kind: "slot", row: 3, col: 1 },
    done: (s) => !!mine(s, BIRCH) },
  { id: "pass-deploy", big: "Tap Pass to start the round.", small: "Pass ends your turn.",
    target: { kind: "pass" },
    done: (s) => roundPast(s, 0) },
  // ── round 1: move, then the first fight ─────────────────────────────────
  { id: "pick-birch-1", big: "Tap Birch to move it.", wait: "The enemy moves closer.",
    target: { kind: "slot", row: 3, col: 1 },
    done: (s, ui) => ui.cardId === mine(s, BIRCH)?.instanceId || !at(mine(s, BIRCH), 3, 1) },
  { id: "move-birch-1", big: "Move Birch here.", small: "You can move one card each turn.",
    target: { kind: "slot", row: 2, col: 1 },
    done: (s) => !at(mine(s, BIRCH), 3, 1) },
  { id: "pass-1", big: "Tap Pass.", wait: "The enemy passes.",
    target: { kind: "pass" },
    done: (s) => prepOver(s, 1) },
  { id: "attack-1", big: "Battle! Tap Attack.", wait: "Battle! The fastest cards act first.",
    target: { kind: "verb", verb: "basic" },
    done: (s, ui) => ui.pending === "basic" || roundPast(s, 1) || foes(s).length === 0 },
  { id: "hit-1", big: "Hit the enemy.", small: "Melee cards hit any of the 8 squares around them, diagonals too.",
    target: { kind: "slot", row: 1, col: 2 },
    done: (s) => roundPast(s, 1) || foes(s).length === 0 },
  // ── round 2: Gold buys a card ───────────────────────────────────────────
  { id: "hand-cactus", big: "You have 3 Gold. Buy Cactus for 2.", small: "You earn Gold every round.",
    wait: "One down!",
    target: { kind: "hand", defId: CACTUS },
    done: (s, ui) => ui.handDef === CACTUS || !!mine(s, CACTUS) },
  { id: "place-cactus", big: "Place Cactus on your back row.",
    target: { kind: "slot", row: 3, col: 2 },
    done: (s) => !!mine(s, CACTUS) },
  { id: "pick-birch-2", big: "Now tap Birch.",
    target: { kind: "slot", row: 2, col: 1 },
    done: (s, ui) => ui.cardId === mine(s, BIRCH)?.instanceId || !at(mine(s, BIRCH), 2, 1) },
  { id: "move-birch-2", big: "Move Birch forward again.",
    target: { kind: "slot", row: 1, col: 1 },
    done: (s) => !at(mine(s, BIRCH), 2, 1) },
  { id: "pass-2a", big: "Tap Pass.", wait: "The enemy buys a new card.",
    target: { kind: "pass" },
    done: (s) => roundPast(s, 1) && (foes(s).length > 0 || roundPast(s, 2)) },
  { id: "pass-2b", big: "They bought a card. Tap Pass again.",
    small: "The round goes on until both sides pass in a row.",
    wait: "They bought a card.",
    target: { kind: "pass" },
    done: (s) => prepOver(s, 2) },
  // ── round 3: capture, and the win ───────────────────────────────────────
  { id: "pick-birch-3", big: "Tap Birch.", wait: "No one was close enough to fight. Then the last enemy moves.",
    target: { kind: "slot", row: 1, col: 1 },
    done: (s, ui) => ui.cardId === mine(s, BIRCH)?.instanceId || !at(mine(s, BIRCH), 1, 1) },
  { id: "move-birch-3", big: "Step onto their back row.",
    small: "A card still standing there when the round ends captures that square.",
    target: { kind: "slot", row: 0, col: 1 },
    done: (s) => !at(mine(s, BIRCH), 1, 1) },
  { id: "pass-3", big: "Tap Pass.", wait: "The enemy passes.",
    target: { kind: "pass" },
    done: (s) => prepOver(s, 3) },
  { id: "attack-3", big: "Tap Attack.", wait: "Battle!",
    target: { kind: "verb", verb: "basic" },
    done: (s, ui) => ui.pending === "basic" || s.phase === "gameover" || foes(s).length === 0 },
  { id: "hit-3", big: "Finish it!",
    target: { kind: "slot", row: 0, col: 2 },
    done: (s) => s.phase === "gameover" || foes(s).length === 0 },
];

/** Index of the first beat not yet done (beats.length when all are). Beats are
 *  checked in order from `from`, so a later beat can never be skipped past one
 *  that is still waiting. */
export function beatIndex(s: GameState, ui: TutUi, from = 0, beats: Beat[] = BEATS): number {
  let i = from;
  while (i < beats.length && beats[i].done(s, ui)) i++;
  return i;
}

/** The intent the player's taps on beat `b` amount to, for the headless test:
 *  the two-tap beats (pick a card, then a square) resolve on their second tap. */
export function scriptedIntent(s: GameState, b: Beat): Intent | null {
  const P1: PlayerId = "P1";
  switch (b.id) {
    case "place-birch": case "place-cactus": {
      const def = b.id === "place-birch" ? BIRCH : CACTUS;
      const h = s.players.P1.hand.find((x) => x.defId === def);
      return h && b.target.kind === "slot" ? { type: "SUMMON", player: P1, handId: h.handId, col: b.target.col } : null;
    }
    case "move-birch-1": case "move-birch-2": case "move-birch-3": {
      const birch = mine(s, BIRCH);
      return birch && b.target.kind === "slot"
        ? { type: "MOVE", player: P1, instanceId: birch.instanceId, to: { row: b.target.row, col: b.target.col } as Pos }
        : null;
    }
    case "pass-deploy": case "pass-1": case "pass-2a": case "pass-2b": case "pass-3":
      return { type: "PASS", player: P1 };
    case "hit-1": case "hit-3": {
      const t = b.target.kind === "slot" ? cardAt(s, b.target.row, b.target.col) : undefined;
      return t ? { type: "BATTLE_ACTION", player: P1, action: "basic", targetId: t.instanceId } : null;
    }
    default:
      return null; // a selection tap: no intent of its own
  }
}

// ── the scripted battles, as one shape ─────────────────────────────────────
// There are two (ui/tutorials.ts lists them): this one, the basics, which a
// new player meets first; and Magic (ui/tutorial-magic.ts) — spells, Specials
// and shields — in the Training Ground's Basics. The App, the rail and the
// replay test drive both through this.

export type TutorialId = "basics" | "magic";

export interface TutorialDef {
  id: TutorialId;
  /** The `taught` mark written when it is won. */
  mark: string;
  /** The Training Ground row. */
  title: string;
  blurb: string;
  /** The player's cards and the foe's name, for the row's art strip. */
  youCards: readonly string[];
  foeName: string;
  create: () => GameState;
  beats: Beat[];
  enemyStep: (s: GameState) => GameState | null;
  scriptedIntent: (s: GameState, b: Beat) => Intent | null;
  /** The victory screen. */
  result: { lead: string; bullets: string[] };
}

export const BASICS: TutorialDef = {
  id: "basics",
  mark: TUT_DONE,
  title: "Your first battle",
  blurb: "Every move, one tap at a time: place a card, move, attack, buy a card with Gold, and capture.",
  youCards: TUTORIAL_YOU,
  foeName: "Grills",
  create: createTutorialState,
  beats: BEATS,
  enemyStep,
  scriptedIntent,
  result: {
    lead: "You captured a square and defeated every enemy card.",
    bullets: [
      "Capture all 4 squares on their home row, or defeat every enemy card, to win.",
      "Cards are placed on your back row, and you earn Gold every round to buy more.",
      "Move one card a turn. Melee cards hit the 8 squares around them.",
    ],
  },
};

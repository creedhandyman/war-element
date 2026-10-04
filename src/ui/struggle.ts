// SMALL TIPS, ONLY WHEN THE PLAYER IS STUCK (owner, 2026-10-04).
//
// After the scripted first battle (ui/tutorial.ts) the game used to keep
// teaching: a coach card for summoning, for income, for moving, for speed,
// then a five-card tour of the tabs. The owner, playing it: "a pop-up for every
// single thing you do, making it hard to focus on battling." The story's first
// node should let the player fight, and the Training Ground is where they go
// once they notice they need help.
//
// So the game no longer lectures. It watches for a few unmistakable signs that
// the player is stuck and says ONE short line about that thing, then gets out
// of the way. A player who is doing fine never sees any of it.
//
// Each sign is read off the board, never off a guess about intent:
//   · nothing tapped for a while on your own turn            (idle-*)
//   · the round started with your board empty and Gold for a card in hand
//   · your Home row full of your own cards, a card you could afford in hand
//   · two rounds broke, with nothing standing on your Home row to earn
//   · an enemy took a square of your Home row
//   · one of your cards died to a faster card before it got to act
//
// Pure and testable: `boardStruggle` compares two consecutive states; the idle
// timer and the showing live in StruggleTip.tsx.
import {
  OPENING_COST_CAP, cardAt, effectiveSp, effectiveSummonCost, homeRow, summonLandingRow,
  type CardInstance, type GameState, type PlayerId,
} from "../engine";

export type TipId =
  | "idle-deploy" | "idle-prep" | "idle-battle"
  | "empty-board" | "home-full" | "no-income" | "captured" | "outsped";

export interface StruggleTip {
  id: TipId;
  /** One line. What to do, and the rule only where the "why" is the point. */
  text: string;
  /** How many times it may ever be shown. The idle tips can come back a few
   *  times, because being lost happens in more than one match; the rest are
   *  said once. */
  times: number;
}

// Rows are named by the colour the board tints them (owner, 2026-10-04): your
// BLUE home row, their RED home row — the same words as the tutorials.
export const TIPS: Record<TipId, StruggleTip> = {
  "idle-deploy": { id: "idle-deploy", times: 3,
    text: "Tap a card in your hand, then a square on your blue home row. Your first card is free." },
  "idle-prep": { id: "idle-prep", times: 3,
    text: "Your turn: tap a card in your hand to place it, tap one of yours to move it, or tap Pass." },
  "idle-battle": { id: "idle-battle", times: 3,
    text: "Tap Attack, then a glowing enemy. Nobody in reach? Tap Skip." },
  "empty-board": { id: "empty-board", times: 1,
    text: "You had Gold for a card and nothing on the board. Tap a card in your hand, then a square on your blue home row." },
  "home-full": { id: "home-full", times: 1,
    text: "Your blue home row is full, so new cards can't come in. Move a card forward to make room." },
  "no-income": { id: "no-income", times: 1,
    text: "Cards standing on your blue home row earn extra Gold each round. Keep one there while you save up." },
  "captured": { id: "captured", times: 1,
    text: "They took a square on your blue home row for good. Knock out any enemy that steps onto it before the round ends." },
  "outsped": { id: "outsped", times: 1,
    text: "That enemy was faster, so it struck first. In battle, higher SP acts earlier." },
};

/** The idle tips, which show while the player is stuck and go the moment they act. */
export const IDLE_TIPS: readonly TipId[] = ["idle-deploy", "idle-prep", "idle-battle"];

/** Other tips one match may show. A struggling player should hear the most
 *  useful thing, not a list. */
export const TIPS_PER_MATCH = 2;

// ── the `taught` bookkeeping ───────────────────────────────────────────────
// Tips live in the same `StorySave.taught` list as every other "already said"
// mark: `tip:<id>` the first time, `tip:<id>#2`, `#3` after. The list's loader
// keeps any string, so no schema change.

/** How many times `id` has been shown, read off `taught`. */
export function tipShown(taught: readonly string[], id: TipId): number {
  const base = `tip:${id}`;
  return taught.filter((t) => t === base || t.startsWith(`${base}#`)).length;
}

/** The mark that records one more showing of `id`. */
export function tipMark(taught: readonly string[], id: TipId): string {
  const n = tipShown(taught, id);
  return n === 0 ? `tip:${id}` : `tip:${id}#${n + 1}`;
}

/** May `id` be shown again? */
export const tipLeft = (taught: readonly string[], id: TipId): boolean =>
  tipShown(taught, id) < TIPS[id].times;

// ── the board signals ──────────────────────────────────────────────────────

/** Remembered across steps within one match. */
export interface StruggleMemory {
  /** Consecutive rounds that started broke with nothing on the Home row. */
  brokeRounds: number;
}
export const freshMemory = (): StruggleMemory => ({ brokeRounds: 0 });

const alive = (c: CardInstance | undefined): c is CardInstance => !!c && !!c.pos && c.curHp > 0;
const onBoard = (s: GameState, me: PlayerId) =>
  Object.values(s.cards).filter((c) => c.owner === me && alive(c));

/** The cheapest card in hand, at what it would cost right now (the opening
 *  placement is free up to its cap), or null with an empty hand. */
function cheapest(s: GameState, me: PlayerId): number | null {
  const hand = s.players[me]?.hand ?? [];
  if (!hand.length) return null;
  const opening = (s.opening?.[me] ?? 0) > 0;
  let best = Infinity;
  for (const h of hand) {
    const cost = effectiveSummonCost(s, me, h.defId);
    if (opening) { if (cost <= OPENING_COST_CAP) best = 0; }
    else best = Math.min(best, cost);
  }
  return Number.isFinite(best) ? best : null;
}

/** Could `me` afford any card in hand? */
const canAfford = (s: GameState, me: PlayerId): boolean => {
  const c = cheapest(s, me);
  return c !== null && c <= (s.players[me]?.gold ?? 0);
};

const cols = (s: GameState) => Array.from({ length: s.boardSize }, (_, c) => c);

/** A struggle the step from `prev` to `next` shows for the player in `me`, or
 *  null. `mem` carries what has to span more than one step. */
export function boardStruggle(
  prev: GameState,
  next: GameState,
  me: PlayerId,
  mem: StruggleMemory,
): TipId | null {
  // Domination has no Home row, so most of this does not apply there. And a
  // finished match (a surrender ends the prep turn too) needs no advice.
  if (next.domination || prev.domination || next.phase === "gameover") return null;
  const home = homeRow(me, next.boardSize);

  // A Home square taken. `capturedBy` is the capturer.
  for (const col of cols(next)) {
    const was = prev.slots[home]?.[col]?.capturedBy ?? null;
    const now = next.slots[home]?.[col]?.capturedBy ?? null;
    if (now && now !== me && was !== now) return "captured";
  }

  // Killed before it acted, by a faster card. The step resolves the queue's
  // current entry; anything of mine further down the queue that it killed
  // never got its turn.
  const b = prev.battle;
  if (prev.phase === "battle" && b) {
    const actor = prev.cards[b.queue[b.index]];
    if (actor && actor.owner !== me) {
      for (const id of b.queue.slice(b.index + 1)) {
        const mine = prev.cards[id];
        if (mine?.owner !== me || !alive(mine) || alive(next.cards[id])) continue;
        if (effectiveSp(prev, actor) > effectiveSp(prev, mine)) return "outsped";
      }
    }
  }

  // The prep turn ended (both sides passed): what did it leave behind?
  if (prev.phase === "prep" && next.phase !== "prep") {
    const open = cols(prev).filter((c) => summonLandingRow(prev, me, c) !== null);
    if (canAfford(prev, me) && onBoard(prev, me).length === 0 && open.length > 0) return "empty-board";
    if (canAfford(prev, me) && cols(prev).every((c) => cardAt(prev, home, c)?.owner === me)) return "home-full";
  }

  // A new round: broke, with nobody home to earn? Two in a row is a pattern.
  if (next.round > prev.round) {
    const mine = onBoard(next, me);
    const c = cheapest(next, me);
    const broke = mine.length > 0 && c !== null && (next.players[me]?.gold ?? 0) < c
      && !mine.some((card) => card.pos!.row === home);
    mem.brokeRounds = broke ? mem.brokeRounds + 1 : 0;
    if (mem.brokeRounds >= 2) return "no-income";
  }
  return null;
}

/** Which idle tip fits what the game is waiting on `me` for, or null when it
 *  is not waiting on them (or is waiting on a modal that explains itself). */
export function idleTipFor(s: GameState, me: PlayerId, waitingOn: PlayerId | null): TipId | null {
  if (waitingOn !== me) return null;
  if (s.phase === "prep") return (s.opening?.[me] ?? 0) > 0 ? "idle-deploy" : "idle-prep";
  if (s.phase === "battle") return "idle-battle";
  return null;
}

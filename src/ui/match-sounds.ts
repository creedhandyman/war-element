/** WHAT A GAME STEP SOUNDS LIKE.
 *
 *  Found the same way the effects layer finds its hits (vfx/use-spell-impacts):
 *  by comparing two game states. The engine's log is prose, there is no "card X
 *  hit card Y" event to listen for, and the diff is exact because one intent
 *  moves the state one step. The same code therefore serves the player, the AI,
 *  an online opponent and a replay, with nothing threaded through the engine.
 *
 *  `soundsForStep` is pure so a test can hand it two states; `useMatchSounds`
 *  is the part that touches React and the speakers. */
import { useEffect, useRef } from "react";
import type { GameState } from "../engine";
import { buzz, playSfx, type Sfx } from "./sfx";

export interface MatchSound { kind: Extract<Sfx, "place" | "hit" | "break">; power: number }

/** Total toughness of a card: the health you can chew through, shields included. */
const toughness = (c: { curHp: number; curShields: number }) => Math.max(0, c.curHp) + Math.max(0, c.curShields);

/** The sounds between two states, loudest-meaning first. Nothing for a brand new
 *  match (a rematch, the next story node) — a fresh board is not a thousand
 *  cards arriving at once. */
export function soundsForStep(prev: GameState | null, next: GameState): MatchSound[] {
  if (!prev || prev === next) return [];
  if (next.round < prev.round || (prev.win && !next.win)) return [];

  const before = prev.cards, after = next.cards;
  const out: MatchSound[] = [];
  let arrived = 0, died = 0, lost = 0, hurt = 0;

  for (const id of Object.keys(after)) {
    const was = before[id];
    if (!was) { arrived++; continue; }
    const drop = toughness(was) - toughness(after[id]);
    if (drop > 0) { lost += drop; hurt++; }
  }
  for (const id of Object.keys(before)) {
    if (!after[id]) { died++; lost += toughness(before[id]); }
  }

  // A body that came back from nowhere on a board that was empty is a match
  // being dealt, not played (the tutorial sets its board with summonCard).
  if (Object.keys(before).length === 0 && arrived > 1) return [];

  if (died > 0) out.push({ kind: "break", power: 1 });
  else if (hurt > 0) out.push({ kind: "hit", power: Math.min(1, lost / 10) });
  if (arrived > 0) out.push({ kind: "place", power: 1 });
  return out;
}

/** Did the move just come back to the player? True on the step where it was not
 *  theirs and now is, in Prep or Battle — the soft two-note cue for anyone who
 *  looked away while the AI thought. Not the mulligan (a match opening is not a
 *  turn coming back) and not a new match dealt over an old one. */
export function yourMoveReturned(wasMine: boolean, isMine: boolean, prev: GameState | null, next: GameState): boolean {
  if (!prev || wasMine || !isMine) return false;
  if (next.phase !== "prep" && next.phase !== "battle") return false;
  return next.round >= prev.round && !next.win;
}

/** Play the sounds each game step earns. `on` is false off the board (menus,
 *  the replay viewer) so nothing speaks to an empty room. `myTurn` is whether the
 *  game is waiting on the player right now. */
export function useMatchSounds(game: GameState, on: boolean, myTurn: boolean): void {
  const last = useRef<GameState | null>(null);
  const wasMine = useRef(false);
  useEffect(() => {
    const prev = last.current;
    last.current = game;
    const was = wasMine.current;
    wasMine.current = myTurn;
    if (!on || !prev) return;
    if (yourMoveReturned(was, myTurn, prev, game)) playSfx("turn");
    for (const s of soundsForStep(prev, game)) {
      playSfx(s.kind, s.power);
      // A card falling is the one beat worth a buzz; a placement is too small to feel.
      if (s.kind === "break") buzz(18);
    }
  }, [game, on, myTurn]);
}

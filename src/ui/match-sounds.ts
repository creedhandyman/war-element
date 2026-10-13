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

/** Play the sounds each game step earns. `on` is false off the board (menus,
 *  the replay viewer) so nothing speaks to an empty room. */
export function useMatchSounds(game: GameState, on: boolean): void {
  const last = useRef<GameState | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = game;
    if (!on || !prev) return;
    for (const s of soundsForStep(prev, game)) {
      playSfx(s.kind, s.power);
      if (s.kind === "break") buzz(18);
      else if (s.kind === "place") buzz(8);
    }
  }, [game, on]);
}

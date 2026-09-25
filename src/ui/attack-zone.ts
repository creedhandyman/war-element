/** THE LINE A ROW OR COLUMN ATTACK IS ABOUT TO SWEEP, found before it lands.
 *
 *  A row sweep (`rowAhead`), a lane strike (`sameColumn`) or a back-line
 *  bombardment (`enemyHomeRow`) used to resolve the instant its card acted: the
 *  damage numbers appeared with nothing to say where they came from or what
 *  shape they had. The player aiming one of their OWN Specials already sees
 *  its footprint (`aimArea`), but the AI's, and your own cards on Auto, gave
 *  no warning at all.
 *
 *  FOUND BY LOOKING AHEAD, NOT BY PREDICTING. The auto-advance loop in App.tsx
 *  computes the next step with the pure `advance()` anyway; it now does that
 *  first, asks this function whether the step fired a line attack, and if so
 *  holds the ALREADY-COMPUTED result while the line is lit, then applies it.
 *  So the highlight is derived from what actually happened — it cannot light a
 *  row the attack then misses, and there is no copy of the AI's decision logic
 *  here to drift from the real one.
 *
 *  The signal is exact: `performBattleAction` bumps `specialCasts` on the card
 *  whose Special fired, and a summon is a new instance on the board. */
import type { GameState, PlayerId } from "../engine";
import { enemyOf, homeRow } from "../engine/types";
import { rowAhead } from "../engine/combat";
import { getDef } from "../data/cards";

export interface StrikeSquare {
  row: number;
  col: number;
  /** Steps from the attacker along the line — the sweep's stagger. */
  order: number;
}

export interface StrikeZone {
  /** Whose attack it is: the board colours the viewer's own gold and anyone
   *  else's threat-red, the same split `aim` and `preview` already use. */
  owner: PlayerId;
  squares: StrikeSquare[];
}

type Params = Record<string, number | string> | undefined;

/** The squares a line-shaped effect covers, from a card standing at `pos`.
 *  Null for anything that is not a line — a single target, a splash, a spread
 *  — which already reads fine from its own damage numbers. */
function lineOf(state: GameState, owner: PlayerId, pos: { row: number; col: number }, p: Params): StrikeSquare[] | null {
  if (!p) return null;
  const n = state.boardSize;
  const onBoard = (r: number) => r >= 0 && r < n;
  const row = (r: number, order0: number) =>
    onBoard(r) ? Array.from({ length: n }, (_, c) => ({ row: r, col: c, order: order0 + Math.abs(c - pos.col) })) : [];

  if (Number(p.rowAhead ?? 0) > 0) {
    const ahead = rowAhead(owner, pos.row);
    const squares = row(ahead, 0);
    // Aftermath's second, farther row — part of the same blast.
    if (Number(p.farRowDmg ?? 0) > 0) squares.push(...row(rowAhead(owner, ahead), 2));
    return squares.length ? squares : null;
  }
  if (Number(p.sameColumn ?? 0) > 0) {
    // The whole lane, both ways: the filter is "same column", not "ahead in
    // it", so an enemy behind the card is inside it too.
    const squares: StrikeSquare[] = [];
    for (let r = 0; r < n; r++)
      if (r !== pos.row) squares.push({ row: r, col: pos.col, order: Math.abs(r - pos.row) - 1 });
    return squares.length ? squares : null;
  }
  if (Number(p.enemyHomeRow ?? 0) > 0) {
    // Lands on the far line, so the sweep starts from the column the card is in.
    const squares = row(homeRow(enemyOf(owner), n), 0);
    return squares.length ? squares : null;
  }
  return null;
}

/** The line attack `after` resolved, if the step from `before` fired one. */
export function strikeZone(before: GameState, after: GameState): StrikeZone | null {
  for (const [id, now] of Object.entries(after.cards)) {
    const was = before.cards[id];
    const def = getDef(now.defId);
    if (was) {
      // A Special fired this step.
      if (now.specialCasts > was.specialCasts && was.pos && def.special) {
        const squares = lineOf(before, was.owner, was.pos, def.special.params);
        if (squares) return { owner: was.owner, squares };
      }
    } else if (now.pos && def.onSummon) {
      // Arrived this step, and its arrival is a line attack.
      const squares = lineOf(after, now.owner, now.pos, def.onSummon.params);
      if (squares) return { owner: now.owner, squares };
    }
  }
  return null;
}

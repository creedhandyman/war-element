/** WHERE AN ACTION IS AIMED, found before it lands.
 *
 *  Attacks used to resolve the instant their card acted: the damage numbers
 *  appeared with nothing to say where they came from. You could see WHO was
 *  acting (the spotlit card) and WHAT happened (the numbers), never WHERE it
 *  was aimed. Aiming your OWN Special showed its footprint; the AI's attacks,
 *  its spells, and your own cards on Auto gave no warning at all.
 *
 *  Two shapes. A LINE attack — a row sweep (`rowAhead`), a lane strike
 *  (`sameColumn`), a back-line bombard (`enemyHomeRow`) — lights the whole
 *  line, empty squares included, because the shape is the information.
 *  Everything else lights the opposing cards the step REACHED: hurt, stripped,
 *  killed, dodged, statused or shoved.
 *
 *  FOUND BY LOOKING AHEAD, NOT BY PREDICTING. The auto-advance loop in App.tsx
 *  computes the next step with the pure `advance()`, asks this module what it
 *  was aimed at, lights that, and then applies THE ALREADY-COMPUTED step. So
 *  the highlight is derived from what actually happened — it cannot light a
 *  card the attack then misses, and there is no copy of the AI's decision
 *  logic here to drift from the real one. It works because the engine applies
 *  one intent per step: a step is one card's turn, one spell, or one arrival.
 *  `performBattleAction` bumps `specialCasts` on a card whose Special fired,
 *  which is what separates a line Special from the same card's basic attack. */
import type { GameState, PlayerId } from "../engine";
import { enemyOf, homeRow, seatsOf } from "../engine/types";
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
  /** `line`: the whole row or column a line attack sweeps, empty squares
   *  included — the SHAPE is the information. `target`: just the cards the
   *  step reached, for everything else (a basic attack, a single-target or
   *  splash Special, a spell, a pounce on arrival). */
  kind: "line" | "target";
  squares: StrikeSquare[];
}

/** A spell spent between two states, and whose book it came out of. Counted,
 *  not a set: a book can hold two of one spell, and the second cast must
 *  still register. */
export function spellCast(before: GameState, after: GameState): { spellId: string; seat: PlayerId } | null {
  const count = (g: GameState, p: PlayerId) => {
    const m = new Map<string, number>();
    for (const sl of g.players[p]?.spellbook ?? []) if (sl.used) m.set(sl.defId, (m.get(sl.defId) ?? 0) + 1);
    return m;
  };
  for (const p of seatsOf(after)) {
    const was = count(before, p);
    for (const [id, n] of count(after, p)) if (n > (was.get(id) ?? 0)) return { spellId: id, seat: p };
  }
  return null;
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

/** WHO ACTED in the step, and from where. One step is one action — the engine
 *  applies one intent at a time — so it is exactly one of: a spell spent, the
 *  battle card whose turn it was, or a card arriving on the board. */
function actorOf(before: GameState, after: GameState): { seat: PlayerId; from: { row: number; col: number } | null } | null {
  const cast = spellCast(before, after);
  if (cast) return { seat: cast.seat, from: null };
  const b = before.battle;
  if (before.phase === "battle" && b && b.index < b.queue.length) {
    // The step re-sorts the untaken tail by SP before it acts, so the actor is
    // read from the queue AFTER that sort.
    const id = after.battle?.queue[b.index] ?? b.queue[b.index];
    const c = before.cards[id];
    if (c?.pos) return { seat: c.owner, from: c.pos };
  }
  for (const [id, now] of Object.entries(after.cards))
    if (!before.cards[id] && now.pos) return { seat: now.owner, from: now.pos };
  return null;
}

/** Every opposing card the step reached: hurt, shield-stripped, killed, made
 *  to dodge, given a status, or moved. Opposing only — a heal on the actor's
 *  own line, or a thorn biting the attacker back, is not where it was AIMING. */
function reachedBy(before: GameState, after: GameState, seat: PlayerId): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (const [id, was] of Object.entries(before.cards)) {
    if (!was.pos || was.owner === seat) continue;
    const now = after.cards[id];
    const reached =
      !now || !now.pos ||
      now.curHp < was.curHp ||
      now.curShields < was.curShields ||
      (now.fxMiss ?? 0) > (was.fxMiss ?? 0) ||
      now.statuses.length > was.statuses.length ||
      now.pos.row !== was.pos.row || now.pos.col !== was.pos.col;
    if (reached) out.push(was.pos);
  }
  return out;
}

/** What the step from `before` to `after` was aimed at, if anything: the full
 *  line for a line attack, otherwise the opposing cards it reached. */
export function strikeZone(before: GameState, after: GameState): StrikeZone | null {
  const line = lineZone(before, after);
  if (line) return line;
  const actor = actorOf(before, after);
  if (!actor) return null;
  const hit = reachedBy(before, after, actor.seat);
  if (hit.length === 0) return null;
  const from = actor.from;
  const dist = (p: { row: number; col: number }) => (from ? Math.abs(p.row - from.row) + Math.abs(p.col - from.col) : 0);
  // Stagger by distance from the actor, ranked, so a splash lights nearest-first.
  const ranks = [...new Set(hit.map(dist))].sort((a, b) => a - b);
  return {
    owner: actor.seat,
    kind: "target",
    squares: hit.map((p) => ({ row: p.row, col: p.col, order: ranks.indexOf(dist(p)) })),
  };
}

function lineZone(before: GameState, after: GameState): StrikeZone | null {
  for (const [id, now] of Object.entries(after.cards)) {
    const was = before.cards[id];
    const def = getDef(now.defId);
    if (was) {
      // A Special fired this step.
      if (now.specialCasts > was.specialCasts && was.pos && def.special) {
        const squares = lineOf(before, was.owner, was.pos, def.special.params);
        if (squares) return { owner: was.owner, kind: "line", squares };
      }
    } else if (now.pos && def.onSummon) {
      // Arrived this step, and its arrival is a line attack.
      const squares = lineOf(after, now.owner, now.pos, def.onSummon.params);
      if (squares) return { owner: now.owner, kind: "line", squares };
    }
  }
  return null;
}

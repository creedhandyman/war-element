/** WHERE AN ACTION IS AIMED, found before it lands.
 *
 *  Attacks used to resolve the instant their card acted: the damage numbers
 *  appeared with nothing to say where they came from. You could see WHO was
 *  acting (the spotlit card) and WHAT happened (the numbers), never WHERE it
 *  was aimed. Aiming your OWN Special showed its footprint; the AI's attacks,
 *  its spells, and your own cards on Auto gave no warning at all.
 *
 *  Three kinds (see `StrikeZone.kind`). A LINE — a row sweep (`rowAhead`), a
 *  lane strike (`sameColumn`), a back-line bombard (`enemyHomeRow`), a
 *  row-wide spell, a dying card's parting blast — lights the whole line, empty
 *  squares included, because the shape is the information. A TARGET lights the
 *  opposing cards an action reached: hurt, stripped, killed, dodged, statused
 *  or shoved. The ROUND END lights every card the end of the round is about to
 *  hurt, on both sides, since burn, bleed, poison, meteors, arrows and
 *  eruptions all land in that one step.
 *
 *  FOUND BY LOOKING AHEAD, NOT BY PREDICTING. The auto-advance loop in App.tsx
 *  computes the next step with the pure `advance()`, asks this module what it
 *  was aimed at, lights that, and then applies THE ALREADY-COMPUTED step. An
 *  online client does the same with each state that arrives over the wire. So
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
import { getSpell } from "../engine/spells";

export interface StrikeSquare {
  row: number;
  col: number;
  /** Steps from the attacker along the line — the sweep's stagger. */
  order: number;
  /** Whose effect lands here. The board colours a square gold when it is the
   *  viewer's own and threat-red otherwise — the split `aim` and `preview`
   *  already make. Per square, not per zone, because one step can land on both
   *  sides: a dying card's parting blast rebounds onto its killer's line, and
   *  the end of a round burns cards on both boards at once. */
  owner: PlayerId;
}

export interface StrikeZone {
  /** The seat that acted, when one did (the end of a round has none). */
  owner: PlayerId | null;
  /** `line`: a whole row or column, empty squares included — a line attack,
   *  a row-wide spell, a death blast — because the SHAPE is the information.
   *  `target`: the cards an action reached. `round`: what the end of the round
   *  is about to do — burn, bleed, poison, delayed meteors and arrows, roots,
   *  round-tick eruptions — all of which land in one step. */
  kind: "line" | "target" | "round";
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
type At = { row: number; col: number };

/** A full row, staggered outward from `fromCol`. */
function fullRow(state: GameState, r: number, fromCol: number, order0: number, owner: PlayerId): StrikeSquare[] {
  if (r < 0 || r >= state.boardSize) return [];
  return Array.from({ length: state.boardSize }, (_, c) => ({ row: r, col: c, order: order0 + Math.abs(c - fromCol), owner }));
}

/** The squares a line-shaped effect covers, from a card standing at `pos`.
 *  Null for anything that is not a line — a single target, a splash, a spread
 *  — which the `target` zone covers from the cards it reached. */
function lineOf(state: GameState, owner: PlayerId, pos: At, p: Params): StrikeSquare[] | null {
  if (!p) return null;
  const n = state.boardSize;
  if (Number(p.rowAhead ?? 0) > 0) {
    const ahead = rowAhead(owner, pos.row);
    const squares = fullRow(state, ahead, pos.col, 0, owner);
    // Aftermath's second, farther row — part of the same blast.
    if (Number(p.farRowDmg ?? 0) > 0) squares.push(...fullRow(state, rowAhead(owner, ahead), pos.col, 2, owner));
    return squares.length ? squares : null;
  }
  if (Number(p.sameColumn ?? 0) > 0) {
    // The whole lane, both ways: the filter is "same column", not "ahead in
    // it", so an enemy behind the card is inside it too.
    const squares: StrikeSquare[] = [];
    for (let r = 0; r < n; r++)
      if (r !== pos.row) squares.push({ row: r, col: pos.col, order: Math.abs(r - pos.row) - 1, owner });
    return squares.length ? squares : null;
  }
  if (Number(p.enemyHomeRow ?? 0) > 0) {
    // Lands on the far line, so the sweep starts from the column the card is in.
    const squares = fullRow(state, homeRow(enemyOf(owner), n), pos.col, 0, owner);
    return squares.length ? squares : null;
  }
  return null;
}

/** WHO ACTED in the step, and from where. One step is one action — the engine
 *  applies one intent at a time — so it is exactly one of: a spell spent, the
 *  battle card whose turn it was, or a card arriving on the board. */
function actorOf(before: GameState, after: GameState): { seat: PlayerId; from: At | null } | null {
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

/** The end-of-round step: the battle's queue ran out, and `stepBattle` runs
 *  the whole Cleanup phase in this one step. */
function isRoundEnd(before: GameState): boolean {
  const b = before.battle;
  return before.phase === "battle" && !!b && b.index >= b.queue.length;
}

/** The step HURT this card: it lost HP or shields, left the board, or had a
 *  damage number noted against it. The last one matters: at the end of a round
 *  a card can take 2 BURN and REGEN 2 in the same step, end on the HP it
 *  started with, and still have been burned — `noteDamageFx` is what floats
 *  that "2" over it, so it is the honest record. */
function hurt(before: GameState, after: GameState, id: string): boolean {
  const was = before.cards[id], now = after.cards[id];
  return !now || !now.pos || now.curHp < was.curHp || now.curShields < was.curShields ||
    (now.fxDmgSeq ?? 0) > (was.fxDmgSeq ?? 0);
}

/** ...or otherwise acted ON it: made it dodge, gave it a status, shoved it,
 *  or took it over. Used for the opposing side of an action only — the same
 *  changes on the actor's own side are its own buffs and moves, not a target. */
function reached(before: GameState, after: GameState, id: string): boolean {
  if (hurt(before, after, id)) return true;
  const was = before.cards[id], now = after.cards[id]!;
  return (now.fxMiss ?? 0) > (was.fxMiss ?? 0) ||
    now.statuses.length > was.statuses.length ||
    now.owner !== was.owner ||
    now.pos!.row !== was.pos!.row || now.pos!.col !== was.pos!.col;
}

/** A dying card's parting blast into the row ahead of it — a LINE, so the
 *  whole row lights, sweeping out after the hit that killed it. */
function deathBlasts(before: GameState, after: GameState, order0: number): StrikeSquare[] {
  const out: StrikeSquare[] = [];
  for (const [id, was] of Object.entries(before.cards)) {
    if (!was.pos) continue;
    if (after.cards[id]?.pos) continue;
    if (!getDef(was.defId).onDeath?.rowAhead) continue;
    out.push(...fullRow(before, rowAhead(was.owner, was.pos.row), was.pos.col, order0, was.owner));
  }
  return out;
}

/** What the step from `before` to `after` is about to do to the board, if
 *  anything. See the header for the three kinds. */
export function strikeZone(before: GameState, after: GameState): StrikeZone | null {
  const squares: StrikeSquare[] = [];
  const add = (list: StrikeSquare[]) => {
    for (const q of list)
      if (!squares.some((s) => s.row === q.row && s.col === q.col)) squares.push(q);
  };
  const nextOrder = () => squares.reduce((m, q) => Math.max(m, q.order), -1) + 1;

  if (isRoundEnd(before)) {
    // Everything lands at once, so nothing is staggered — except the death
    // blasts, which follow the ticks that caused them.
    for (const [id, was] of Object.entries(before.cards)) {
      if (!was.pos) continue;
      const now = after.cards[id];
      if (hurt(before, after, id) || (now && now.statuses.length > was.statuses.length))
        add([{ row: was.pos.row, col: was.pos.col, order: 0, owner: enemyOf(was.owner) }]);
    }
    add(deathBlasts(before, after, 1));
    return squares.length ? { owner: null, kind: "round", squares } : null;
  }

  const line = lineZone(before, after);
  const actor = actorOf(before, after);
  let kind: StrikeZone["kind"] = line ? "line" : "target";
  if (line) add(line.squares);

  if (actor) {
    const from = actor.from;
    const dist = (p: At) => (from ? Math.abs(p.row - from.row) + Math.abs(p.col - from.col) : 0);
    const hit: { at: At; owner: PlayerId }[] = [];
    const backlash: { at: At; owner: PlayerId }[] = [];
    for (const [id, was] of Object.entries(before.cards)) {
      if (!was.pos) continue;
      if (was.owner !== actor.seat) {
        if (reached(before, after, id)) hit.push({ at: was.pos, owner: actor.seat });
      } else if (hurt(before, after, id)) {
        // The actor's own side, hurt: a thorn biting back, a self-damaging
        // Special, a dying card's blast. Lit AFTER the hit that caused it.
        backlash.push({ at: was.pos, owner: enemyOf(was.owner) });
      }
    }

    // A ROW-WIDE SPELL lights its rows in full, not just the cards in them —
    // an empty square inside the blast is part of what the spell did. The rows
    // are the ones its victims stand in: exact for a one-row spell, and for a
    // two-row spell whose second row was empty, the row that was hit.
    const cast = spellCast(before, after);
    if (cast) {
      const spell = getSpell(cast.spellId);
      if (spell.kind === "aoe" && (spell.area === "row" || spell.area === "tworows")) {
        const rows = [...new Set(hit.filter((h) => h.owner === cast.seat).map((h) => h.at.row))].sort((a, b) => a - b);
        for (const r of rows) add(fullRow(before, r, 0, 0, cast.seat));
        if (rows.length) kind = "line";
      }
    }

    const ranks = [...new Set(hit.map((h) => dist(h.at)))].sort((a, b) => a - b);
    add(hit.map((h) => ({ row: h.at.row, col: h.at.col, order: ranks.indexOf(dist(h.at)), owner: h.owner })));
    // IN CAUSE ORDER: the hit, then any parting blast from a card it killed,
    // then whatever came back at the actor's own side. A card caught in a
    // death blast is then attributed to the blast, not lit before the kill.
    add(deathBlasts(before, after, nextOrder()));
    const after2 = nextOrder();
    add(backlash.map((b) => ({ row: b.at.row, col: b.at.col, order: after2, owner: b.owner })));
  } else {
    add(deathBlasts(before, after, nextOrder()));
  }

  if (squares.length === 0) return null;
  return { owner: actor?.seat ?? line?.owner ?? null, kind, squares };
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

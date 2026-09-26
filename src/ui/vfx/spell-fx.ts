/** WHAT A SPELL DID, as a list of effects to draw — read off the state change.
 *
 *  The effects layer used to play one thing: an impact where a spell's damage
 *  landed. Every other spell — heals, shields, walls, fields, traps, the
 *  status sweeps, the ones that move your cards — landed silently, even
 *  though most of the book is exactly those.
 *
 *  Same method as the impacts and the target highlights: no per-spell table
 *  of "what this spell looks like", which would be one more copy of the rules
 *  to fall out of date. The engine already applied the spell; this reads what
 *  changed and draws THAT. A spell that heals and roots (Heart of the Forest)
 *  gets both, a new spell gets effects on day one, and a spell whose numbers
 *  are retuned can never be drawn doing its old ones.
 *
 *  ONE RULE IS NOT DERIVED, it is protected: a hidden trap is placed where
 *  its owner chose, and drawing that for the other player would give it away.
 *  Only the viewer's own trap placement gets an effect. */
import type { CardInstance, Element, GameState, PlayerId, StatusKind } from "../../engine";
import { effectiveSp } from "../../engine/state";
import { getSpell } from "../../engine/spells";
import { getDef } from "../../data/cards";
import { homeRow } from "../../engine/types";
import { spellCast } from "../attack-zone";

export type At = { row: number; col: number };

export type SpellFx =
  | { kind: "impact"; at: At; element: Element; strength: number }
  | { kind: "heal"; at: At; element: Element; strength: number }
  | { kind: "shield"; at: At; element: Element }
  | { kind: "status"; at: At; status: StatusKind; element: Element }
  | { kind: "buff" | "debuff"; at: At; element: Element }
  | { kind: "move"; from: At; to: At; element: Element }
  | { kind: "wall"; row: number; element: Element }
  | { kind: "field"; element: Element }
  | { kind: "trapSet" | "trapSprung"; at: At; element: Element }
  /** A spell that changed nothing on the board (Power Rebate, Recon Ping,
   *  System Override): a ripple from the caster's own Home row, so a cast is
   *  never silent. */
  | { kind: "pulse"; row: number; element: Element }
  /** A card's attack landing on a card it struck: slashed by a melee card,
   *  burst by a ranged one's shot. */
  | { kind: "hit"; at: At; from: At; element: Element; strength: number; melee: boolean; special: boolean }
  /** A summon that struck as it landed, materialising on its square. */
  | { kind: "arrive"; at: At; element: Element }
  /** A WHOLE-BOARD spell (Tsunami, Volcanic Eruption, Lightning Storm...):
   *  the set piece that sweeps the board, over and above each card's own
   *  effect. `targets` are the opposing cards it reached, which the set piece
   *  aims at — meteors land on them, bolts strike them, roots reach them.
   *  `strength` comes from the spell's cost, so a cost-5 Ashfall is a flurry
   *  and a cost-10 Volcanic Eruption is the sky falling. */
  | { kind: "board"; element: Element; strength: number; targets: At[]; caster: PlayerId; casterRow: number };

export type BoardFx = Extract<SpellFx, { kind: "board" }>;

/** Scaled from the amount and clamped: a chip and a nuke should look
 *  different, but a 30-point hit must not fill the screen. */
const strengthOf = (n: number) => Math.max(0.7, Math.min(2.2, n / 5));

/** One card's change, and whether it happened on the side that did NOT act. */
interface Change { fx: SpellFx; opposing: boolean }

/** EVERYTHING THAT HAPPENED TO THE CARDS between two states, drawn in
 *  `element`, seen from `seat` — the side that acted. Shared by spells and by
 *  battle actions: whatever caused it, a freeze looks like a freeze. `reached`
 *  is the opposing cards it did something to — hurt, statused or drained. */
function cardChanges(before: GameState, after: GameState, element: Element, seat: PlayerId): { changes: Change[]; reached: At[] } {
  const changes: Change[] = [];
  const reached: At[] = [];
  for (const [id, was] of Object.entries(before.cards)) {
    if (!was.pos) continue;
    const now = after.cards[id];
    const opposing = was.owner !== seat;
    const add = (fx: SpellFx) => changes.push({ fx, opposing });
    // Where the card is now, for anything that happened to it: a push or a
    // redeploy moves it, and the heal should rise where it stands.
    const at: At = now?.pos ?? was.pos;

    // Damage: lost HP or shields, or left the board — or a damage number was
    // noted even though a heal in the same step put the HP back.
    const lost = was.curHp + was.curShields - (now?.pos ? now.curHp + now.curShields : 0);
    const noted = !!now && (now.fxDmgSeq ?? 0) > (was.fxDmgSeq ?? 0);
    if (lost > 0 || noted) {
      const dmg = lost > 0 ? lost : (now?.fxDmgHits?.at(-1) ?? 1);
      add({ kind: "impact", at: was.pos, element, strength: strengthOf(dmg) });
      if (opposing) reached.push(was.pos);
    }
    if (!now?.pos) continue;

    if (now.curHp > was.curHp) add({ kind: "heal", at, element, strength: strengthOf(now.curHp - was.curHp) });
    if (now.curShields > was.curShields) add({ kind: "shield", at, element });

    const had = new Set(was.statuses.map((x) => x.kind));
    let statused = false;
    for (const st of now.statuses)
      if (!had.has(st.kind)) {
        add({ kind: "status", at, status: st.kind, element });
        had.add(st.kind);
        statused = true;
      }

    // Speed and max HP: Tailwind, Grove's Blessing, Cyclone, Harvest's drain.
    // Not when a new status is what moved them — a FREEZE drops the card's
    // speed, and the ice already says so; a debuff streak on top is noise.
    const sp0 = effectiveSp(before, was), sp1 = effectiveSp(after, now);
    const weakened = !statused && (sp1 < sp0 || now.maxHp < was.maxHp);
    if (!statused && (sp1 > sp0 || now.maxHp > was.maxHp)) add({ kind: "buff", at, element });
    else if (weakened) add({ kind: "debuff", at, element });
    // Hurt already counted it; a status or a drain with no damage (Heart of
    // the Forest's roots, Bloodroot's bleed) still makes it a target.
    if (opposing && (statused || weakened) && !reached.some((r) => r.row === was.pos!.row && r.col === was.pos!.col))
      reached.push(at);

    if (now.pos.row !== was.pos.row || now.pos.col !== was.pos.col)
      add({ kind: "move", from: was.pos, to: now.pos, element });
  }
  return { changes, reached };
}

/** The effects of a spell cast between two states, or [] if none was cast.
 *  `viewer` is whose screen this is — it decides whether a trap placement may
 *  be shown at all. */
export function spellEffects(before: GameState, after: GameState, viewer: PlayerId): SpellFx[] {
  const cast = spellCast(before, after);
  if (!cast) return [];
  const spell = getSpell(cast.spellId);
  const element = spell.element;
  const { changes, reached } = cardChanges(before, after, element, cast.seat);
  const out: SpellFx[] = changes.map((c) => c.fx);

  for (const w of after.walls)
    if (!before.walls.some((b) => b.row === w.row && b.owner === w.owner && b.spellId === w.spellId))
      out.push({ kind: "wall", row: w.row, element: w.element });

  for (const f of after.fields)
    if (!before.fields.some((b) => b.spellId === f.spellId && b.owner === f.owner))
      out.push({ kind: "field", element: f.element });

  for (const t of after.traps) {
    const isNew = !before.traps.some((b) => b.owner === t.owner && b.pos.row === t.pos.row && b.pos.col === t.pos.col);
    if (isNew && t.owner === viewer) out.push({ kind: "trapSet", at: t.pos, element: t.element });
  }

  if (spell.kind === "aoe" && spell.area === "board")
    out.unshift({
      kind: "board", element, strength: boardStrength(spell.cost), targets: reached,
      caster: cast.seat, casterRow: homeRow(cast.seat, after.boardSize),
    });

  if (out.length === 0) out.push({ kind: "pulse", row: homeRow(cast.seat, after.boardSize), element });
  return out;
}

// ── CARD ATTACKS ─────────────────────────────────────────────────────────────

/** A card's attack between two states — a battle turn, or a card striking as
 *  it is summoned — read the same way as everything else here: off what the
 *  step did. */
export interface CardAttack {
  seat: PlayerId;
  /** Where it struck from — for a summon, the square it is landing on. */
  actor: At;
  element: Element;
  /** Melee cards close the distance and strike; Ranged cards throw. */
  melee: boolean;
  /** The heavier look: its Special fired (`specialCasts` rose), or it is a
   *  summon's designed entrance (an `onSummon` effect). DAWN's Awakening,
   *  which every DAWN card does as it lands, strikes at basic weight. */
  special: boolean;
  /** Summoned this step. It is not on the board until the step lands, so its
   *  attack is delivered FROM ITS SQUARE: it gathers there, strikes, and
   *  materialises as the hits land. */
  arriving: boolean;
  /** Opposing cards it hurt, statused or drained — or that DODGED it: a miss
   *  changes nothing but the dodger's MISS counter, and it was still aimed. */
  targets: At[];
}

/** Cards on the board in `after` that were not in `before` — summoned, or
 *  spawned, this step. */
export function arrivals(before: GameState, after: GameState): CardInstance[] {
  return Object.values(after.cards).filter((c) => c.pos && !before.cards[c.instanceId]);
}

/** The card that acted between two states: the battle card whose turn it was,
 *  or a card that arrived — or null for a spell, or the round's end. */
function striker(before: GameState, after: GameState) {
  if (spellCast(before, after)) return null;
  const b = before.battle;
  if (before.phase === "battle" && b) {
    if (b.index >= b.queue.length) return null; // the round's end
    // The step re-sorts the untaken tail by SP before it acts, so the actor is
    // read from the queue AFTER that sort.
    const id = after.battle?.queue[b.index] ?? b.queue[b.index];
    const was = before.cards[id];
    if (!was?.pos) return null;
    const now = after.cards[id];
    return {
      seat: was.owner, at: was.pos, def: getDef(was.defId),
      special: !!now && now.specialCasts > was.specialCasts, arriving: false,
    };
  }
  // A summon that spawns tokens brings several cards: the one with an
  // entrance is the one striking.
  const arrived = arrivals(before, after);
  const card = arrived.find((c) => getDef(c.defId).onSummon) ?? arrived[0];
  if (!card?.pos) return null;
  const def = getDef(card.defId);
  return { seat: card.owner, at: card.pos, def, special: !!def.onSummon, arriving: true };
}

/** The attack a step made, if it made one at anything. */
export function cardAttack(before: GameState, after: GameState): CardAttack | null {
  const a = striker(before, after);
  if (!a) return null;
  const { reached } = cardChanges(before, after, a.def.element, a.seat);
  const targets = [...reached];
  for (const [id, c] of Object.entries(before.cards)) {
    if (!c.pos || c.owner === a.seat) continue;
    const n = after.cards[id];
    if (n && (n.fxMiss ?? 0) > (c.fxMiss ?? 0) && !targets.some((t) => t.row === c.pos!.row && t.col === c.pos!.col))
      targets.push(c.pos);
  }
  if (targets.length === 0) return null;
  return {
    seat: a.seat, actor: a.at, element: a.def.element,
    melee: a.def.attackType === "Melee", special: a.special, arriving: a.arriving, targets,
  };
}

/** A step's attack effects at the landing: a HIT on each card it struck —
 *  slashed by a melee card, burst by a ranged one's shot — plus whatever else
 *  changed. The opposing side shows all of it (the freeze left behind, the
 *  push); the attacker's own side only the good (a lifesteal heal, a shield).
 *  Its own side's damage — a thorn biting back — is the damage numbers' job.
 *  A summon that struck also MATERIALISES: a burst on its square as it lands. */
export function cardAttackEffects(before: GameState, after: GameState): SpellFx[] {
  const a = striker(before, after);
  if (!a) return [];
  const element = a.def.element;
  const melee = a.def.attackType === "Melee";
  const out: SpellFx[] = [];
  const { changes, reached } = cardChanges(before, after, element, a.seat);
  for (const { fx, opposing } of changes) {
    if (fx.kind === "impact") {
      // A basic attack happens every turn, so it lands lighter; a Special
      // lands at full weight.
      if (opposing) out.push({ kind: "hit", at: fx.at, from: a.at, element, strength: fx.strength * (a.special ? 1 : 0.65), melee, special: a.special });
      continue;
    }
    if (opposing || fx.kind !== "debuff") out.push(fx);
  }
  if (a.arriving && reached.length > 0) out.unshift({ kind: "arrive", at: a.at, element });
  return out;
}

/** A whole-board spell's weight, from its cost: the book's board spells cost
 *  5 (a 3-damage flurry), 7-9 (8 damage) or 10 (the 15-damage ultimates). */
export const boardStrength = (cost: number) => Math.max(0.6, Math.min(1.4, (cost - 3) / 5));

/** The whole-board set piece a cast between two states calls for, if any. */
export function boardSpell(before: GameState, after: GameState): BoardFx | null {
  const cast = spellCast(before, after);
  if (!cast) return null;
  const fx = spellEffects(before, after, cast.seat).find((f): f is BoardFx => f.kind === "board");
  return fx ?? null;
}

/** A trap that went off between two states: it is gone from the board, and
 *  it was not a spell being cast. Revealed by springing, so shown to all. */
export function trapsSprung(before: GameState, after: GameState): SpellFx[] {
  if (spellCast(before, after)) return [];
  const out: SpellFx[] = [];
  for (const t of before.traps) {
    const still = after.traps.some((a) => a.owner === t.owner && a.pos.row === t.pos.row && a.pos.col === t.pos.col);
    // SPRUNG, not expired: a trap goes off when a card moves onto it, so one
    // is standing on the square. A trap that just ran out leaves it empty.
    const trodOn = Object.values(after.cards).some((c) => c.pos?.row === t.pos.row && c.pos?.col === t.pos.col);
    if (!still && trodOn) out.push({ kind: "trapSprung", at: t.pos, element: t.element });
  }
  return out;
}

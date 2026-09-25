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
import type { Element, GameState, PlayerId, StatusKind } from "../../engine";
import { effectiveSp } from "../../engine/state";
import { getSpell } from "../../engine/spells";
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
  | { kind: "pulse"; row: number; element: Element };

/** Scaled from the amount and clamped: a chip and a nuke should look
 *  different, but a 30-point hit must not fill the screen. */
const strengthOf = (n: number) => Math.max(0.7, Math.min(2.2, n / 5));

/** The effects of a spell cast between two states, or [] if none was cast.
 *  `viewer` is whose screen this is — it decides whether a trap placement may
 *  be shown at all. */
export function spellEffects(before: GameState, after: GameState, viewer: PlayerId): SpellFx[] {
  const cast = spellCast(before, after);
  if (!cast) return [];
  const element = getSpell(cast.spellId).element;
  const out: SpellFx[] = [];

  for (const [id, was] of Object.entries(before.cards)) {
    if (!was.pos) continue;
    const now = after.cards[id];
    // Where the card is now, for anything that happened to it: a push or a
    // redeploy moves it, and the heal should rise where it stands.
    const at: At = now?.pos ?? was.pos;

    // Damage: lost HP or shields, or left the board — or a damage number was
    // noted even though a heal in the same spell put the HP back.
    const lost = was.curHp + was.curShields - (now?.pos ? now.curHp + now.curShields : 0);
    const noted = !!now && (now.fxDmgSeq ?? 0) > (was.fxDmgSeq ?? 0);
    if (lost > 0 || noted) {
      const dmg = lost > 0 ? lost : (now?.fxDmgHits?.at(-1) ?? 1);
      out.push({ kind: "impact", at: was.pos, element, strength: strengthOf(dmg) });
    }
    if (!now?.pos) continue;

    if (now.curHp > was.curHp) out.push({ kind: "heal", at, element, strength: strengthOf(now.curHp - was.curHp) });
    if (now.curShields > was.curShields) out.push({ kind: "shield", at, element });

    const had = new Set(was.statuses.map((x) => x.kind));
    let statused = false;
    for (const st of now.statuses)
      if (!had.has(st.kind)) {
        out.push({ kind: "status", at, status: st.kind, element });
        had.add(st.kind);
        statused = true;
      }

    // Speed and max HP: Tailwind, Grove's Blessing, Cyclone, Harvest's drain.
    // Not when a new status is what moved them — a FREEZE drops the card's
    // speed, and the ice already says so; a debuff streak on top is noise.
    const sp0 = effectiveSp(before, was), sp1 = effectiveSp(after, now);
    if (!statused && (sp1 > sp0 || now.maxHp > was.maxHp)) out.push({ kind: "buff", at, element });
    else if (!statused && (sp1 < sp0 || now.maxHp < was.maxHp)) out.push({ kind: "debuff", at, element });

    if (now.pos.row !== was.pos.row || now.pos.col !== was.pos.col)
      out.push({ kind: "move", from: was.pos, to: now.pos, element });
  }

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

  if (out.length === 0) out.push({ kind: "pulse", row: homeRow(cast.seat, after.boardSize), element });
  return out;
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

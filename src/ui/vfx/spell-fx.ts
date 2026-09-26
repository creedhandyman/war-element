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
import type { CardDef, CardInstance, Element, GameState, PlayerId, StatusKind } from "../../engine";
import { chebyshev, effectiveSp } from "../../engine/state";
import { getSpell } from "../../engine/spells";
import { DUSK_DRAIN, hasElementAura } from "../../engine/auras";
import { getDef } from "../../data/cards";
import { homeRow, NEGATIVE_STATUSES } from "../../engine/types";
import { isRoundEnd, spellCast } from "../attack-zone";
import type { TickArgs } from "./ticks";
import type { LookVariant } from "./looks/types";

export type At = { row: number; col: number };

export type SpellFx =
  | { kind: "impact"; at: At; element: Element; strength: number; variant?: LookVariant }
  | { kind: "heal"; at: At; element: Element; strength: number }
  | { kind: "shield"; at: At; element: Element; variant?: LookVariant }
  | { kind: "status"; at: At; status: StatusKind; element: Element }
  | { kind: "buff" | "debuff"; at: At; element: Element }
  | { kind: "move"; from: At; to: At; element: Element }
  | { kind: "wall"; row: number; element: Element; variant?: LookVariant }
  /** A card crossing an enemy wall and paying for it (Ice Wall's 2 DMG and
   *  freeze), in the wall's look. */
  | { kind: "wallBite"; at: At; element: Element; variant?: LookVariant }
  | { kind: "field"; element: Element }
  | { kind: "trapSet" | "trapSprung"; at: At; element: Element }
  /** A spell that changed nothing on the board (Power Rebate, Recon Ping,
   *  System Override): a ripple from the caster's own Home row, so a cast is
   *  never silent. */
  | { kind: "pulse"; row: number; element: Element }
  /** A card's attack landing on a card it struck: slashed by a melee card,
   *  burst by a ranged one's shot. */
  | { kind: "hit"; at: At; from: At; element: Element; strength: number; melee: boolean; special: boolean; variant?: LookVariant }
  /** A summon that struck as it landed, materialising on its square. */
  | { kind: "arrive"; at: At; element: Element; variant?: LookVariant }
  /** A WHOLE-BOARD spell (Tsunami, Volcanic Eruption, Lightning Storm...):
   *  the set piece that sweeps the board, over and above each card's own
   *  effect. `targets` are the opposing cards it reached, which the set piece
   *  aims at — meteors land on them, bolts strike them, roots reach them.
   *  `strength` comes from the spell's cost, so a cost-5 Ashfall is a flurry
   *  and a cost-10 Volcanic Eruption is the sky falling. */
  | { kind: "board"; element: Element; strength: number; targets: At[]; caster: PlayerId; casterRow: number }
  /** THE END OF THE ROUND, one card at a time: a status biting or running
   *  out, a heal-over-time, an element aura paying out (ticks.ts draws each).
   *  `delay` staggers them in the order Cleanup runs them. */
  | ({ kind: "tick"; at: At; element: Element; delay: number } & TickArgs)
  /** Creeping Dark: a DUSK card drinking from the card it touches. */
  | { kind: "drain"; from: At; to: At; element: Element; delay: number };

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
  // An ice spell's damage shatters in ice, like an icy card's shot, and the
  // plating it gives is ice (Glacial Wave) — except Chill's `allyShield`: its
  // art pairs an ice strike with a WATER shield, and the modal keeps that.
  const variant = spellVariant(spell);
  const iced = (fx: SpellFx): SpellFx =>
    !variant ? fx
    : fx.kind === "impact" ? { ...fx, variant }
    : fx.kind === "shield" && !spell.allyShield ? { ...fx, variant }
    : fx;
  const out: SpellFx[] = changes.map((c) => iced(c.fx));

  for (const w of after.walls)
    if (!before.walls.some((b) => b.row === w.row && b.owner === w.owner && b.spellId === w.spellId))
      out.push({ kind: "wall", row: w.row, element: w.element, variant: spellVariant(getSpell(w.spellId)) });

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
  /** It attacks in a look unlike its element's (see `lookVariant`). */
  variant?: LookVariant;
}

/** Names that are plainly the cold: a cold word opening a name ("Frostveil",
 *  "Glacius", "Polar King") or closing one ("Blackice", "Permafrost"). */
const ICY_NAME = /\b(ice|icy|frost|frozen|glaci|snow|cryo|polar|arcti|blizzard|hail|hoar|chill)|(ice|frost)\b/i;

/** Its kit freezes something — its hit, its Special, whoever strikes it, a
 *  round tick, its death. Read from the definition's own fields rather than a
 *  list of them, so a new way of freezing counts on the day it is written.
 *  (Card text is prose and never matches a quoted "FREEZE".) Cached per card:
 *  a definition never changes. */
const freezeKit = new Map<string, boolean>();
function freezes(def: CardDef): boolean {
  let f = freezeKit.get(def.id);
  if (f === undefined) freezeKit.set(def.id, (f = JSON.stringify(def).includes('"FREEZE"')));
  return f;
}

/** An AQUA card that is ICE rather than water attacks in ice: it took the
 *  Frozen Flow as it landed, its kit freezes, or it is named for the cold.
 *  Read off the card, not a list — a new ice card is drawn in ice on day one. */
export function lookVariant(card: CardInstance): LookVariant | undefined {
  const def = getDef(card.defId);
  if (def.element !== "AQUA") return undefined;
  return card.flowMode === "ice" || freezes(def) || ICY_NAME.test(def.name) ? "ice" : undefined;
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
      special: !!now && now.specialCasts > was.specialCasts, arriving: false, variant: lookVariant(was),
    };
  }
  // A summon that spawns tokens brings several cards: the one with an
  // entrance is the one striking.
  const arrived = arrivals(before, after);
  const card = arrived.find((c) => getDef(c.defId).onSummon) ?? arrived[0];
  if (!card?.pos) return null;
  const def = getDef(card.defId);
  return { seat: card.owner, at: card.pos, def, special: !!def.onSummon, arriving: true, variant: lookVariant(card) };
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
    melee: a.def.attackType === "Melee", special: a.special, arriving: a.arriving, targets, variant: a.variant,
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
      if (opposing)
        out.push({ kind: "hit", at: fx.at, from: a.at, element, strength: fx.strength * (a.special ? 1 : 0.65), melee,
          special: a.special, variant: a.variant });
      continue;
    }
    // The attacker's own plating in its look: an icy card taking the Frozen
    // Flow as it lands is armoured in ice, not water.
    if (fx.kind === "shield" && !opposing && a.variant) out.push({ ...fx, variant: a.variant });
    else if (opposing || fx.kind !== "debuff") out.push(fx);
  }
  if (a.arriving && reached.length > 0) out.unshift({ kind: "arrive", at: a.at, element, variant: a.variant });
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

/** An AQUA SPELL is ice by its NAME alone — Ice Wall, Frost Patch, Glacial
 *  Wave, Chill. Not by whether it freezes: Tsunami and Maelstrom freeze too,
 *  and a tidal wave and a whirlpool are water. */
export function spellVariant(spell: { element: Element; name: string }): LookVariant | undefined {
  return spell.element === "AQUA" && ICY_NAME.test(spell.name) ? "ice" : undefined;
}

/** Cards that crossed an enemy wall between two states and paid for it — the
 *  engine's rule (`triggerWallsOnMove`): the wall's row lies in the span the
 *  card moved through, FLYING soars over one that does not stop it, and a
 *  wall that only buffs its own side bites no one. Drawn in the wall's look. */
export function wallsCrossed(before: GameState, after: GameState): SpellFx[] {
  const out: SpellFx[] = [];
  for (const [id, was] of Object.entries(before.cards)) {
    const now = after.cards[id];
    if (!was.pos || !now?.pos || now.pos.row === was.pos.row) continue;
    const hurt = now.curHp < was.curHp || now.curShields < was.curShields || now.statuses.length > was.statuses.length ||
      (now.fxDmgSeq ?? 0) > (was.fxDmgSeq ?? 0);
    if (!hurt) continue;
    const flying = !!getDef(was.defId).keywords.FLYING;
    const from = was.pos.row, to = now.pos.row;
    for (const w of before.walls) {
      if (w.owner === was.owner || (!w.dmg && !w.status && !w.push && !w.stripShields)) continue;
      if (flying && !w.stopsFlying) continue;
      if (w.row === from || (w.row - from) * (w.row - to) > 0) continue;
      out.push({ kind: "wallBite", at: now.pos, element: w.element, variant: spellVariant(getSpell(w.spellId)) });
      break; // one bite drawn per card, however many walls it ran
    }
  }
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

// ── THE END OF THE ROUND ────────────────────────────────────────────────────

/** The statuses that do damage at Cleanup. */
const DOTS: StatusKind[] = ["BURN", "SCALD", "BLEED", "DOT"];

/** Cleanup's own order, as a stagger — the bites, then the heals and the
 *  auras, then whatever ran out — so the eye reads cause before consequence. */
const BITE = 0, AURA = 0.3, END = 0.6;

/** What the end-of-round step did, card by card — [] for any other step.
 *
 *  Read the same way as everything else here, off the change, with one twist:
 *  Cleanup is several rules in one step, so a card's net change can hide what
 *  happened to it (2 BURN and REGEN 2 end on the HP it started with). So each
 *  effect is read from its CAUSE in `before` — the burn it carried, the aura it
 *  has, the enemy it touches — and the change only confirms it fired. */
export function roundEndEffects(before: GameState, after: GameState): SpellFx[] {
  if (!isRoundEnd(before)) return [];
  const out: SpellFx[] = [];
  // What each card's DOTs will take off it, which is also how the drain below
  // picks its victim: Cleanup ticks every DOT before any aura runs.
  const bite = new Map<string, number>();
  for (const [id, c] of Object.entries(before.cards)) {
    if (!c.pos) continue;
    bite.set(id, c.statuses.filter((st) => DOTS.includes(st.kind)).reduce((n, st) => n + st.power, 0));
  }
  const hpAfterBite = (c: CardInstance) => c.curHp - (bite.get(c.instanceId) ?? 0);

  // Creeping Dark first, because a drinker's heal and a victim's loss are
  // both explained by it. Lowest HP after the bites, ties by id — the rule
  // Cleanup uses — and only if that card really was hurt this step.
  const drained = new Map<string, number>();
  const drinkers = new Set<string>();
  for (const [id, c] of Object.entries(before.cards)) {
    if (!c.pos || !after.cards[id]?.pos || !hasElementAura(getDef(c.defId), "DUSK")) continue;
    const victim = Object.values(before.cards)
      .filter((e) => e.pos && e.owner !== c.owner && hpAfterBite(e) > 0 && chebyshev(c.pos!, e.pos) === 1)
      .sort((a, b) => hpAfterBite(a) - hpAfterBite(b) || a.instanceId.localeCompare(b.instanceId))[0];
    if (!victim || !hurtBy(before, after, victim.instanceId)) continue;
    drained.set(victim.instanceId, (drained.get(victim.instanceId) ?? 0) + DUSK_DRAIN);
    drinkers.add(id);
    out.push({ kind: "drain", from: victim.pos!, to: c.pos, element: "DUSK", delay: AURA });
  }

  for (const [id, was] of Object.entries(before.cards)) {
    if (!was.pos) continue;
    const now = after.cards[id];
    const def = getDef(was.defId);
    const element = def.element;

    // 1. The bites: every DOT it carried, BURN melting the plating it wore.
    const bit = new Set<StatusKind>();
    for (const st of was.statuses) {
      if (!DOTS.includes(st.kind) || bit.has(st.kind)) continue;
      bit.add(st.kind);
      const power = was.statuses.filter((x) => x.kind === st.kind).reduce((n, x) => n + x.power, 0);
      out.push({ kind: "tick", tick: "bite", status: st.kind, at: was.pos, element, delay: BITE,
        strength: strengthOf(power), melted: st.kind === "BURN" && was.curShields > 0 });
    }
    if (!now?.pos) continue; // it died in the tick: nothing heals or expires on a corpse
    const at = now.pos;

    // 2. The heals and auras. What came back, net of what the bites and a
    //    drain took — REGEN 2 against BURN 2 still healed 2.
    const healed = now.curHp - (hpAfterBite(was) - (drained.get(id) ?? 0));
    const leaf = hasElementAura(def, "LEAF");
    if (healed > 0 && !(drinkers.has(id) && healed <= DUSK_DRAIN))
      out.push({ kind: "tick", tick: leaf ? "photosynthesis" : "regen", at, element, delay: AURA, strength: strengthOf(healed) });
    const melted = was.statuses.some((st) => st.kind === "BURN") ? Math.min(2, was.curShields) : 0;
    const tide = (now.tideTicks ?? 0) > (was.tideTicks ?? 0);
    if (tide) out.push({ kind: "tick", tick: "tide", mode: now.flowMode, at, element, delay: AURA, strength: 1 });
    else if (now.curShields > was.curShields - melted)
      out.push({ kind: "tick", tick: leaf && was.hitsTakenThisRound > 0 ? "bark" : "shield", at, element, delay: AURA, strength: 1 });
    if (now.spBonus > was.spBonus) {
      if (hasElementAura(def, "GALE")) out.push({ kind: "tick", tick: "zephyr", at, element, delay: AURA, strength: 1 });
      else if (hasElementAura(def, "DAWN")) out.push({ kind: "tick", tick: "firstLight", at, element, delay: AURA, strength: 1 });
    }

    // 3. Statuses gone — burned off by DAWN's light (the oldest affliction,
    //    Cleanup's rule), wiped by a bubble's full cleanse, or simply run out.
    //    One cleanse per card however much it lifted; one ending per status.
    const kept = new Set(now.statuses.map((st) => st.kind));
    const dawnOff = hasElementAura(def, "DAWN") ? was.statuses.find((st) => NEGATIVE_STATUSES.includes(st.kind))?.kind : undefined;
    const wiped = (was.channelBuffRounds ?? 0) > 0;
    const ended = new Set<StatusKind>();
    let cleansed = false;
    for (const st of was.statuses) {
      if (kept.has(st.kind) || ended.has(st.kind)) continue;
      ended.add(st.kind);
      if (st.kind === dawnOff || (wiped && NEGATIVE_STATUSES.includes(st.kind))) {
        if (!cleansed) out.push({ kind: "tick", tick: "cleanse", status: st.kind, at, element, delay: AURA, strength: 1 });
        cleansed = true;
        continue;
      }
      out.push({ kind: "tick", tick: "expire", status: st.kind, at, element, delay: END, strength: 1 });
    }
    // ...and anything new: the creeping roots' far-row snare, a round tick's
    // status. Drawn as it would be from a spell — a root is a root.
    const had = new Set(was.statuses.map((st) => st.kind));
    for (const st of now.statuses)
      if (!had.has(st.kind)) {
        out.push({ kind: "status", at, status: st.kind, element: st.source });
        had.add(st.kind);
      }
  }
  return out;
}

/** The step hurt this card — lost HP or shields, left the board, or had a
 *  damage number noted against it (see attack-zone.ts `hurt`). */
function hurtBy(before: GameState, after: GameState, id: string): boolean {
  const was = before.cards[id], now = after.cards[id];
  return !now?.pos || now.curHp < was.curHp || now.curShields < was.curShields || (now.fxDmgSeq ?? 0) > (was.fxDmgSeq ?? 0);
}

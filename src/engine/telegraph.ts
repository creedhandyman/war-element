// The BOSS TELEGRAPH — what is about to happen, and to whom.
//
// A Void Tower boss does not cast its Special the way a card does. It fires on
// a clock (`roundTick.fireSpecialEveryN`) at Cleanup, free, and `canFireSpecial`
// refuses a manual cast outright, so the beat is the ONLY way it goes off. That
// is a deliberate design property — "every Void Tower puzzle is built on the
// player being able to plan around it" — and it was, until now, entirely
// invisible. The clock existed in the data and nowhere on the screen: you
// learned the rhythm by losing to it three times and counting.
//
// This module turns that clock into something you can read: how many round-ends
// remain, and which squares the blast covers when it lands.
//
// The hard rule here is that the telegraph MUST NOT UNDER-REPORT. A red square
// that turns out to be safe costs a player a cautious turn; a safe-looking
// square that turns out to be in the blast costs them the card, and teaches
// them the telegraph is a liar. So every handler a boss uses is predicted
// explicitly, `TELEGRAPHED_HANDLERS` is asserted against the live boss roster,
// and the test suite fires each Special for real and checks that nothing was
// damaged outside the lit cells.
import type { CardDef, CardInstance, GameState, PlayerId, Pos, StatusKind } from "./types";
import { enemyOf } from "./types";
import { boardCards, hasStatus } from "./state";
import { getDef } from "../data/cards";
import { specialTargets } from "./rules";

export interface BossTelegraph {
  /** The boss instance the clock belongs to. */
  bossId: string;
  /** Where it is standing — the badge hangs on this square. */
  pos: Pos;
  specialName: string;
  /** The clock's period, in rounds. */
  everyN: number;
  /** Round-ends until it fires. 0 = at the end of THIS round. */
  roundsUntil: number;
  /** Squares the Special reaches when it lands. */
  cells: Pos[];
  /** How many of those squares it actually strikes. Equal to `cells.length` for
   *  an uncapped volley; smaller when the Special picks only a few, and the UI
   *  has to say so rather than implying the whole zone dies. */
  strikes: number;
  /** Damage per hit. 0 for a Special that only spawns, freezes or shields. */
  dmg: number;
  /** The beat will be SKIPPED — the boss is silenced or stopped, and the status
   *  outlasts the tick that would clear it. Silencing a boss is one of the
   *  answers this mode is built to reward, so it has to show. */
  silenced: boolean;
}

/** Handlers this module knows how to predict. A boss whose Special uses
 *  anything else would get a countdown with no zone under it — a telegraph that
 *  under-reports, which is the one thing this must never do. The Void Tower
 *  test asserts every live boss against this set, so adding a boss on a new
 *  handler fails the build here rather than quietly on the board. */
export const TELEGRAPHED_HANDLERS: readonly string[] = [
  "barrage", "statusNova", "smite", "polarShift", "battleCharge", "strike", "spawn",
  "stormCall", "boulderThrow",
];

/** Statuses that stop the clock. Mirrors the gate in `doRoundTicks`: MUTE, and
 *  the two action-blockers `isActionBlocked` names. */
const SILENCERS: StatusKind[] = ["MUTED", "STUN", "SLEEP"];

/** Will a silencing status still be on this card when the beat lands?
 *
 *  Cleanup ticks status durations (step 3) BEFORE it runs the round ticks the
 *  boss clock lives in (step 4b), so a status showing 1 round left is already
 *  gone by the time the Special would fire. Two or more, and the beat is
 *  skipped. Getting this backwards would be its own lie — a player who spent a
 *  MUTE to buy a round needs to know whether they actually bought it. */
function silencedWhenItFires(card: CardInstance): boolean {
  return card.statuses.some((s) => SILENCERS.includes(s.kind) && s.duration >= 2);
}

/** Every enemy of `card` still standing. The board-wide handlers ignore the
 *  target list they are passed and sweep this set themselves. */
function livingFoes(state: GameState, card: CardInstance): CardInstance[] {
  return boardCards(state, enemyOf(card.owner)).filter((e) => e.curHp > 0 && e.pos);
}

/** The cards a boss's Special will actually touch, per handler.
 *
 *  Deliberately NOT one call to `specialTargets` for everything. Three of these
 *  handlers ignore the target list they are handed and pick their own victims —
 *  `smite` and `polarShift` sweep the whole board, `battleCharge` ploughs its
 *  own column — so a single generic answer would have under-reported for
 *  Umbranova, Permafrost and Kato's first form: the three bosses whose reach is
 *  least obvious from looking at them. */
function reached(
  state: GameState,
  card: CardInstance,
  sp: NonNullable<CardDef["special"]>,
): { cards: CardInstance[]; strikes: number } {
  const p = sp.params ?? {};
  const cap = Number(p.targets ?? 1);
  const need = String(p.requireStatus ?? "");
  switch (sp.handler) {
    // Spawns, self-buffs and team shields land nowhere the player can stand.
    // The countdown still shows — Overclock's tide of tokens is very much worth
    // counting — but there is no blast to draw.
    case "spawn":
      return { cards: [], strikes: 0 };
    // EYE OF THE STORM, and this is the telegraph doing the most work anywhere
    // on the tower. The Special has two faces (see `stormCall` in combat.ts):
    // with no hurricane up it merely calls one and there is nothing to draw,
    // exactly like `spawn`. With one standing, the boss TELEPORTS to it and
    // blasts what is around it — so the squares to light are the ones around
    // the HURRICANE, not the ones around the boss.
    //
    // That is the whole warning: the storm's neighbourhood glows and the player
    // reads "the boss is about to be standing there". Lighting the boss's
    // current position instead would have been worse than lighting nothing —
    // it would point at the one square the blast is guaranteed to leave.
    // A ROCK, THROWN AT SOMEBODY. Board-wide and random, so the honest drawing
    // is EVERY living opponent with `strikes: 1` — the whole board is at risk
    // and exactly one square is actually hit. This is precisely the case
    // `strikes` exists for: lighting nine cells and implying nine deaths would
    // be a worse lie than not warning at all.
    case "boulderThrow": {
      const foes = livingFoes(state, card);
      return { cards: foes, strikes: Math.min(1, foes.length) };
    }
    case "stormCall": {
      const token = String(p.token ?? "");
      const storm = boardCards(state, card.owner)
        .find((c) => c.curHp > 0 && c.defId === token && c.pos);
      if (!storm || !storm.pos) return { cards: [], strikes: 0 };
      const reach = Number(p.reach ?? 1);
      const at = storm.pos;
      const caught = livingFoes(state, card).filter(
        (e) => e.pos && Math.max(Math.abs(e.pos.row - at.row), Math.abs(e.pos.col - at.col)) <= reach,
      );
      return { cards: caught, strikes: caught.length };
    }
    // Board-wide by design, and it says so: no reach, no filters, every foe.
    case "smite": {
      const foes = livingFoes(state, card).filter((e) => !need || hasStatus(e, need as StatusKind));
      return { cards: foes, strikes: foes.length };
    }
    // Freezes the FRAIL. The HP line is the whole mechanic, so the zone is the
    // cards actually under it — lighting the healthy ones would misdescribe the
    // one Special on the tower that a player answers by healing.
    case "polarShift": {
      const under = Number(p.underHp ?? 4);
      const frail = livingFoes(state, card).filter((e) => e.curHp <= under);
      return { cards: frail, strikes: frail.length };
    }
    // The contiguous run straight ahead: it stops at the first gap, so a card
    // standing behind one is NOT in the blast and must not be lit as if it were.
    case "battleCharge": {
      if (!card.pos) return { cards: [], strikes: 0 };
      const dir = card.owner === "P1" ? -1 : 1;
      const lane = livingFoes(state, card)
        .filter((e) => e.pos!.col === card.pos!.col && (e.pos!.row - card.pos!.row) * dir > 0)
        .sort((a, b) => (a.pos!.row - card.pos!.row) * dir - (b.pos!.row - card.pos!.row) * dir);
      const run: CardInstance[] = [];
      for (const e of lane) {
        const prev = run.length ? run[run.length - 1].pos! : card.pos;
        if (Math.abs(e.pos!.row - prev.row) !== 1) break;
        run.push(e);
      }
      return { cards: run, strikes: run.length };
    }
    // A single leap, at one of these. The zone is where it can reach — which
    // one it picks is board order, not something a player can read off the
    // board, so the honest drawing is the whole reach with the count saying
    // how much of it dies.
    case "strike": {
      const list = specialTargets(state, card.instanceId);
      const leaps = 1 + (Number(p.pounceAgain ?? 0) > 0 ? 1 : 0);
      return { cards: list, strikes: Math.min(leaps, list.length) };
    }
    // The volley handlers. `specialTargets` already mirrors their own filters
    // (reach, sameColumn, rowAhead, enemyHomeRow, requireStatus) — it is the
    // function the manual-cast preview uses, and keeping the telegraph on it
    // means the two can never disagree.
    default: {
      const list = specialTargets(state, card.instanceId);
      return { cards: list, strikes: Math.min(cap, list.length) };
    }
  }
}

/** Every boss clock currently running, with its countdown and its blast zone.
 *
 *  Returns [] for an ordinary match: nothing outside the tower carries
 *  `fireSpecialEveryN`, so the caller does not have to know what mode it is in. */
export function bossTelegraphs(state: GameState): BossTelegraph[] {
  const out: BossTelegraph[] = [];
  for (const card of boardCards(state)) {
    if (card.curHp <= 0 || !card.pos) continue;
    const def = getDef(card.defId);
    const everyN = def.roundTick?.fireSpecialEveryN ?? 0;
    const sp = def.special;
    if (everyN <= 0 || !sp) continue;
    // It fires at the Cleanup of every round divisible by N, so what remains is
    // the distance to the next multiple — and 0 means "at the end of the round
    // you are playing right now", which is the last turn anything can move.
    //
    // CLAMPED TO 1, and that clamp is not cosmetic. `state.round` is 0 until the
    // first round actually begins — mulligan, the opening draw, the board the
    // player stares at before anything has happened — and 0 % N is 0, so the
    // telegraph greeted every boss fight by announcing a blast at the end of a
    // round that had not started and would not fire. Caught on the screen rather
    // than in a test: the badge read NOW under a ribbon reading ROUND 1, because
    // the ribbon shows `max(1, round)` for exactly the same reason. The first
    // real Cleanup is round 1, so that is what the pre-match board counts from.
    const roundsUntil = (everyN - (Math.max(1, state.round) % everyN)) % everyN;
    const { cards, strikes } = reached(state, card, sp);
    out.push({
      bossId: card.instanceId,
      pos: { ...card.pos },
      specialName: sp.name,
      everyN,
      roundsUntil,
      cells: cards.map((c) => ({ ...c.pos! })),
      strikes,
      dmg: Number(sp.params?.dmg ?? 0),
      silenced: silencedWhenItFires(card),
    });
  }
  return out;
}

/** The blast squares a viewer should see lit RIGHT NOW: the zones of every
 *  clock that fires at the end of this round and is not silenced.
 *
 *  Lit on the firing round rather than the one before it, and that is the whole
 *  point rather than an off-by-one. The Special goes off at Cleanup, so the
 *  turn you are taking WHILE the squares glow is the last turn in which you can
 *  walk out of them. Lighting them a round earlier and clearing them for the
 *  round that matters would be a warning that switches off exactly when it
 *  becomes useful. */
export function telegraphBlast(state: GameState, viewer: PlayerId): Pos[] {
  const out: Pos[] = [];
  const seen = new Set<string>();
  for (const t of bossTelegraphs(state)) {
    if (t.roundsUntil !== 0 || t.silenced) continue;
    const boss = state.cards[t.bossId];
    if (!boss || boss.owner === viewer) continue; // your own boss, in a mirror
    for (const c of t.cells) {
      const k = `${c.row},${c.col}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
  }
  return out;
}

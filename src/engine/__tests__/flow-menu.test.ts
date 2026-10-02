// The Flow Change menu prints numbers — each form's before -> after, its blurb,
// its tide, when the next tide comes. Every one of them is held here to what the
// engine then actually does, so the menu cannot drift from the rule it explains.
import { describe, expect, it } from "vitest";
import { AQUA_TIDE_EVERY, FLOW_MODES, LIQUID_HIT_BLURB, liquidGivesHit, type FlowMode } from "../auras";
import { effectiveBasicHits } from "../combat";
import { downpourKin, flowPreview, nextTideRound } from "../flow";
import { advance, applyIntent } from "../phases";
import { effectiveDmg, effectiveSp } from "../state";
import type { CardInstance, GameState } from "../types";
import { atCleanup, giveHand, place, prepState } from "./helpers";

const MODES: FlowMode[] = ["water", "ice", "steam"];
/** "+2 DMG" -> 2 */
const num = (blurb: string) => Number(/[+-]?\d+/.exec(blurb)![0]);

/** A human summons `defId` from hand; the Flow prompt is up for it. */
function summoned(defId: string): { s: GameState; id: string } {
  const s = prepState();
  s.humans = ["P1"];
  s.players.P1.gold = 30;
  place(s, "dusk_gool", "P2", 0, 3);
  const handId = giveHand(s, "P1", defId);
  const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
  expect(next.pendingFlow, `${defId} opens the Flow prompt`).toBeTruthy();
  return { s: next, id: next.pendingFlow! };
}

const read = (s: GameState, c: CardInstance) =>
  ({ dmg: effectiveDmg(s, c), hits: effectiveBasicHits(c, s), shields: c.curShields, sp: effectiveSp(s, c) });

describe("the Flow Change menu's preview", () => {
  it.each([
    ["a single-hit card", "aqua_kinguin"],
    ["a multi-hit card (Liquid adds a hit)", "aqua_vaporem"],
    ["a card borrowing AQUA's aura", "dawn_sircrest"],
  ])("is exactly what the pick then does — %s", (_why, defId) => {
    for (const mode of MODES) {
      const { s, id } = summoned(defId);
      const pv = flowPreview(s, s.cards[id], mode);
      expect(pv.before, `${mode}: before`).toEqual(read(s, s.cards[id]));
      const n = applyIntent(s, { type: "FLOW_CHANGE", player: "P1", instanceId: id, mode });
      expect(pv.after, `${mode}: after`).toEqual(read(n, n.cards[id]));
    }
  });

  it("previews on a copy — the card on the board is untouched", () => {
    const { s, id } = summoned("aqua_kinguin");
    const before = structuredClone(s.cards[id]);
    for (const mode of MODES) flowPreview(s, s.cards[id], mode);
    expect(s.cards[id]).toEqual(before);
  });
});

describe("the Flow Change menu's words", () => {
  it("each summon blurb is the number the pick adds", () => {
    const one = summoned("aqua_kinguin");
    const card = one.s.cards[one.id];
    expect(liquidGivesHit(card)).toBe(false);
    const d = (m: FlowMode) => flowPreview(one.s, card, m);
    expect(d("water").after.dmg - d("water").before.dmg).toBe(num(FLOW_MODES.water.blurb));
    expect(d("ice").after.shields - d("ice").before.shields).toBe(num(FLOW_MODES.ice.blurb));
    expect(d("steam").after.sp - d("steam").before.sp).toBe(num(FLOW_MODES.steam.blurb));

    const multi = summoned("aqua_vaporem");
    const m = multi.s.cards[multi.id];
    expect(liquidGivesHit(m)).toBe(true);
    const pv = flowPreview(multi.s, m, "water");
    expect(pv.after.hits - pv.before.hits).toBe(num(LIQUID_HIT_BLURB));
    expect(pv.after.dmg, "a hit, not per-hit damage").toBe(pv.before.dmg);
  });

  it("each tide blurb is the number one tide adds", () => {
    for (const mode of MODES) {
      const s = prepState();
      const c = place(s, "aqua_glacius", "P1", 3, 0);
      c.flowMode = mode;
      s.round = AQUA_TIDE_EVERY;
      const was = read(s, c);
      const n = advance(atCleanup(s));
      const now = read(n, n.cards[c.instanceId]);
      expect(n.cards[c.instanceId].tideTicks, `${mode}: the tide came in`).toBe(1);
      const moved = mode === "water" ? now.dmg - was.dmg : mode === "ice" ? now.shields - was.shields : now.sp - was.sp;
      expect(moved, `${mode}: "${FLOW_MODES[mode].tide}"`).toBe(num(FLOW_MODES[mode].tide));
    }
  });
});

describe("the next tide the menu names", () => {
  it("is this round's Cleanup in an even round, else the next even round's", () => {
    const at = (round: number) => { const s = prepState(); s.round = round; return nextTideRound(s); };
    expect([1, 2, 3, 4, 5].map(at)).toEqual([2, 2, 4, 4, 6]);
    expect(at(0), "deployment has no Cleanup of its own").toBe(2);
  });

  it("is the Cleanup where a fresh form really takes its first tide", () => {
    for (const start of [1, 2, 3]) {
      const s = prepState();
      s.round = start;
      const c = place(s, "aqua_glacius", "P1", 3, 0);
      c.flowMode = "water";
      const due = nextTideRound(s);
      let g = s;
      for (let r = start; r <= due; r++) {
        g.round = r;
        g = advance(atCleanup(g));
        const ticks = g.cards[c.instanceId].tideTicks ?? 0;
        expect(ticks, `from round ${start}, after round ${r}'s Cleanup`).toBe(r < due ? 0 : 1);
      }
    }
  });
});

describe("Downpour's side, as the menu counts it", () => {
  it("is every card the re-pick lands on, and nothing else", () => {
    const s = prepState();
    s.humans = ["P1"];
    const a = place(s, "aqua_subcool", "P1", 3, 0);
    const b = place(s, "aqua_vaporem", "P1", 3, 1);
    const other = place(s, "leaf_greegon", "P1", 3, 2);   // not AQUA
    const foe = place(s, "aqua_owlette", "P2", 0, 0);     // AQUA, the other side
    s.pendingFlow = a.instanceId;
    s.pendingFlowAll = true;
    const kin = downpourKin(s, s.cards[a.instanceId]).map((c) => c.instanceId).sort();
    expect(kin).toEqual([a.instanceId, b.instanceId].sort());

    const n = applyIntent(s, { type: "FLOW_CHANGE", player: "P1", instanceId: a.instanceId, mode: "steam" });
    const touched = [a, b, other, foe].filter((c) => n.cards[c.instanceId].spBonusRound > 0).map((c) => c.instanceId).sort();
    expect(touched).toEqual(kin);
  });
});

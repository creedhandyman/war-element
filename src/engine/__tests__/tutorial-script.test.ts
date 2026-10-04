// THE FIRST BATTLE, PLAYED BY ITS OWN SCRIPT (ui/tutorial.ts).
//
// Every beat is taken in order, the way the forced-play overlay makes a player
// take it, and the enemy plays its scripted turns. If a rules change (a stat, a
// speed tier, an element power, the opening placement) stops the battle going
// the way the beat sheet says, this fails here instead of in a new player's
// first minute.
import { describe, expect, it } from "vitest";
import { advance, applyIntent, needsInput } from "../phases";
import type { GameState } from "../types";
import { getDef } from "../../data/cards";
import { BEATS, beatIndex, createTutorialState, enemyStep, scriptedIntent, type TutUi } from "../../ui/tutorial";

function playThrough() {
  let s: GameState = createTutorialState();
  const ui: TutUi = { handDef: null, cardId: null, pending: null };
  const order: string[] = [];
  const states: GameState[] = [s];
  let cursor = 0;
  for (let guard = 0; guard < 2000 && s.phase !== "gameover"; guard++) {
    const who = needsInput(s);
    if (who === "P2") { s = enemyStep(s)!; states.push(s); continue; }
    if (who === null) { s = advance(s); states.push(s); continue; }
    cursor = beatIndex(s, ui, cursor);
    const beat = BEATS[cursor];
    if (!beat) throw new Error("P1 asked to act with no beat left");
    if (order[order.length - 1] !== beat.id) order.push(beat.id);
    const intent = scriptedIntent(s, beat);
    if (!intent) {
      // A selection tap: what the App's state becomes when the glowing thing is tapped.
      if (beat.target.kind === "hand") ui.handDef = beat.target.defId;
      else if (beat.target.kind === "verb") ui.pending = "basic";
      else if (beat.target.kind === "slot") {
        const c = Object.values(s.cards).find((x) => x.pos?.row === (beat.target as { row: number }).row && x.pos?.col === (beat.target as { col: number }).col);
        ui.cardId = c?.instanceId ?? null;
      }
      continue;
    }
    s = applyIntent(s, intent);
    states.push(s);
    ui.handDef = null; ui.cardId = null; ui.pending = null;
  }
  return { s, order, states };
}

describe("the first battle's script", () => {
  it("takes every beat, in order, and ends in a win on round 3", () => {
    const { s, order } = playThrough();
    expect(order).toEqual(BEATS.map((b) => b.id));
    expect(s.phase).toBe("gameover");
    expect(s.win).toEqual({ winner: "P1", by: "elimination" });
    expect(s.round).toBe(3);
  });

  it("captures the square Birch stepped onto", () => {
    const { s } = playThrough();
    expect(s.slots[0][1].capturedBy).toBe("P1");
  });

  it("keeps out what the lesson holds back: no status, no grown shield, no enemy strike", () => {
    const { s, states } = playThrough();
    for (const st of states)
      for (const c of Object.values(st.cards)) {
        expect(c.statuses, `${c.defId} picked up a status`).toEqual([]);
        expect(c.curShields, `${c.defId} grew a shield`).toBeLessThanOrEqual(getDef(c.defId).shields);
      }
    expect(s.log.some((l) => /Grill \(P2\) hits/.test(l)), "an enemy struck").toBe(false);
  });

  it("the beats' Gold line is true: 3 Gold when Cactus is bought", () => {
    const { states } = playThrough();
    const before = states.find((st) => st.round === 2 && st.phase === "prep" && st.prep?.priority === "P1")!;
    expect(before.players.P1.gold).toBe(3);
    expect(getDef("leaf_cactus").cost).toBe(2);
  });

  it("every enemy falls to one hit", () => {
    const { s } = playThrough();
    const hits = s.log.filter((l) => /^Birch \(P1\) hits Grill/.test(l)).length;
    expect(hits).toBe(2);
  });
});

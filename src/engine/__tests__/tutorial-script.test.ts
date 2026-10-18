// THE SCRIPTED BATTLES, PLAYED BY THEIR OWN SCRIPTS (ui/tutorials.ts).
//
// Every beat is taken in order, the way the forced-play overlay makes a player
// take it, and the enemy plays its scripted turns. If a rules change (a stat, a
// speed tier, an element power, the opening placement) stops a battle going
// the way its beat sheet says, this fails here instead of in a player's lesson.
import { describe, expect, it } from "vitest";
import { advance, applyIntent, needsInput } from "../phases";
import type { GameState } from "../types";
import { getDef } from "../../data/cards";
import { BEATS, beatIndex, type TutorialDef, type TutUi } from "../../ui/tutorial";
import { TUTORIALS, TUTORIAL_ORDER } from "../../ui/tutorials";

function playThrough(def: TutorialDef = TUTORIALS.basics) {
  let s: GameState = def.create();
  const ui: TutUi = { handDef: null, cardId: null, pending: null, spellId: null };
  const order: string[] = [];
  const states: GameState[] = [s];
  let cursor = 0;
  for (let guard = 0; guard < 2000 && s.phase !== "gameover"; guard++) {
    const who = needsInput(s);
    if (who === "P2") { s = def.enemyStep(s)!; states.push(s); continue; }
    if (who === null) { s = advance(s); states.push(s); continue; }
    cursor = beatIndex(s, ui, cursor, def.beats);
    const beat = def.beats[cursor];
    if (!beat) throw new Error(`${def.id}: P1 asked to act with no beat left`);
    if (order[order.length - 1] !== beat.id) order.push(beat.id);
    const intent = def.scriptedIntent(s, beat);
    if (!intent) {
      // A selection tap: what the App's state becomes when the glowing thing is tapped.
      const t = beat.target;
      if (t.kind === "hand") ui.handDef = t.defId;
      else if (t.kind === "verb") ui.pending = t.verb;
      else if (t.kind === "spell") ui.spellId = t.spellId;
      else if (t.kind === "slot") {
        const c = Object.values(s.cards).find((x) => x.pos?.row === t.row && x.pos?.col === t.col);
        ui.cardId = c?.instanceId ?? null;
      }
      continue;
    }
    s = applyIntent(s, intent);
    states.push(s);
    ui.handDef = null; ui.cardId = null; ui.pending = null; ui.spellId = null;
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

  it("the beats' Gold line is true: 3 Gold when Forest Deer is bought, for 2", () => {
    const { states } = playThrough();
    const before = states.find((st) => st.round === 2 && st.phase === "prep" && st.prep?.priority === "P1")!;
    expect(before.players.P1.gold).toBe(3);
    expect(getDef("leaf_forestdeer").cost).toBe(2);
  });

  it("the card bought is ranged, and the last enemy falls to its shot from 2 squares away", () => {
    // "It's a ranged card" and "up to 2 squares away" are said to the player;
    // both have to stay true of the card and the board.
    expect(getDef("leaf_forestdeer").attackType).toBe("Ranged");
    const { s, states } = playThrough();
    const shot = states.find((st) => st.phase === "battle" && st.round === 3)!;
    const deer = Object.values(shot.cards).find((c) => c.defId === "leaf_forestdeer")!;
    expect(deer.pos).toEqual({ row: 3, col: 3 });
    expect(s.log.some((l) => /^Forest Deer \(P1\) hits Grill/.test(l))).toBe(true);
  });

  it("every enemy falls to one hit: Birch's up close, then Forest Deer's shot", () => {
    const { s } = playThrough();
    expect(s.log.filter((l) => /^Birch \(P1\) hits Grill/.test(l))).toHaveLength(1);
    expect(s.log.filter((l) => /^Forest Deer \(P1\) hits Grill/.test(l))).toHaveLength(1);
  });
});

describe("every scripted battle", () => {
  it.each(TUTORIAL_ORDER)("%s takes every beat in order and is won", (id) => {
    const def = TUTORIALS[id];
    const { s, order } = playThrough(def);
    expect(order).toEqual(def.beats.map((b) => b.id));
    expect(s.win?.winner).toBe("P1");
  });

  it.each(TUTORIAL_ORDER)("%s: no status lands on any card", (id) => {
    const { states } = playThrough(TUTORIALS[id]);
    for (const st of states)
      for (const c of Object.values(st.cards)) expect(c.statuses, `${id}: ${c.defId}`).toEqual([]);
  });

  it("each has its own mark, and a pre step only where a target can be folded away", () => {
    const marks = TUTORIAL_ORDER.map((id) => TUTORIALS[id].mark);
    expect(new Set(marks).size).toBe(marks.length);
    for (const id of TUTORIAL_ORDER)
      for (const b of TUTORIALS[id].beats)
        if (b.pre) expect(b.target.kind, `${id}/${b.id}`).toBe("spell");
  });
});

describe("the magic battle's script", () => {
  const def = TUTORIALS.magic;
  const shieldsOf = (st: GameState, defId: string) =>
    Object.values(st.cards).find((c) => c.defId === defId && c.owner === "P1")!;

  it("the near enemy's hit is soaked by the Armadillo's shields: no HP lost, one shield worn", () => {
    const { s, states } = playThrough(def);
    const hit = s.log.find((l) => /^Duster \(P2\) hits Granite Armadillo \(P1\) for 0/.test(l));
    expect(hit, s.log.join(" | ")).toBeTruthy();
    const before = states.find((st) => st.phase === "battle" && st.round === 1)!;
    const arm0 = shieldsOf(before, "bore_armadillo");
    // Read right AFTER the hit: Curl Up (2026-10-10) regrows a shield at each
    // round's end, so the end of the battle no longer shows the one worn.
    const hitAt = states.find((st) =>
      st.log.some((l) => /^Duster \(P2\) hits Granite Armadillo \(P1\) for 0/.test(l)))!;
    const arm1 = shieldsOf(hitAt, "bore_armadillo");
    expect(arm1.curHp).toBe(arm0.curHp);
    expect(arm1.curShields).toBe(arm0.curShields - 1);
  });

  it("the spell is cast once, and its shield lands on the Armadillo before the hit", () => {
    const { s, states } = playThrough(def);
    expect(s.players.P1.spellbook.filter((sl) => sl.used)).toHaveLength(1);
    const start = shieldsOf(states[0], "bore_armadillo").curShields;
    const battle = states.find((st) => st.phase === "battle" && st.round === 1)!;
    expect(shieldsOf(battle, "bore_armadillo").curShields).toBe(start + 1);
  });

  it("Lazor's Special fires once, and its next hit is to HP — no shields to soak it", () => {
    const { s } = playThrough(def);
    expect(s.log.filter((l) => /^Lazor \(P1\) fires /.test(l))).toHaveLength(1);
    const lazor = shieldsOf(s, "dawn_lazor");
    expect(lazor.curShields).toBe(0);
    expect(lazor.curHp).toBeLessThan(lazor.maxHp);
  });

  it("is over in round 2, and the beats' numbers are true: 3 Magic, a 2-Magic Special, a 1-Magic spell", () => {
    const { s, states } = playThrough(def);
    expect(s.round).toBe(2);
    expect(states.find((st) => st.round === 1 && st.phase === "prep")!.players.P1.magicPool).toBe(3);
    expect(getDef("dawn_lazor").special!.cost).toBe(2);
  });
});

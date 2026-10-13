// WHAT A GAME STEP SOUNDS LIKE (ui/match-sounds.ts) and TAP-OR-CLICK WORDS
// (ui/pointer.ts). Both are pure, so both are tested on plain states / strings.
import { describe, expect, it } from "vitest";
import { advance, applyIntent, needsInput, type GameState } from "..";
import { soundsForStep, yourMoveReturned } from "../../ui/match-sounds";
import { tapWords } from "../../ui/pointer";
import { createTutorialState, enemyStep } from "../../ui/tutorial";

const clone = (s: GameState): GameState => structuredClone(s);

/** The tutorial deal, advanced until P1 must act (the opening placement owed). */
function deal(): GameState {
  let s = createTutorialState();
  for (let i = 0; i < 50 && needsInput(s) !== "P1"; i++) s = needsInput(s) === "P2" ? enemyStep(s)! : advance(s);
  return s;
}

describe("soundsForStep", () => {
  it("is silent when nothing changed, and for the first state ever seen", () => {
    const s = deal();
    expect(soundsForStep(null, s)).toEqual([]);
    expect(soundsForStep(s, s)).toEqual([]);
    expect(soundsForStep(s, clone(s))).toEqual([]);
  });

  it("a card landing on the board is a place", () => {
    const prev = deal();
    const birch = prev.players.P1.hand.find((h) => h.defId === "leaf_birch")!;
    const next = applyIntent(prev, { type: "SUMMON", player: "P1", handId: birch.handId, col: 1 });
    expect(soundsForStep(prev, next).map((s) => s.kind)).toEqual(["place"]);
  });

  it("a card losing health is a hit, scaled by how much", () => {
    const prev = deal();
    const id = Object.values(prev.cards).find((c) => c.pos)!.instanceId;
    const small = clone(prev); small.cards[id].curHp -= 1;
    const big = clone(prev); big.cards[id].curHp -= 9;
    const a = soundsForStep(prev, small)[0], b = soundsForStep(prev, big)[0];
    expect(a.kind).toBe("hit");
    expect(b.kind).toBe("hit");
    expect(b.power).toBeGreaterThan(a.power);
    expect(b.power).toBeLessThanOrEqual(1);
  });

  it("a shield soaking the blow still sounds like a blow", () => {
    const prev = deal();
    const id = Object.values(prev.cards).find((c) => c.pos)!.instanceId;
    prev.cards[id].curShields = 3;
    const next = clone(prev); next.cards[id].curShields = 2;
    expect(soundsForStep(prev, next).map((s) => s.kind)).toEqual(["hit"]);
  });

  it("a card leaving the board is a break, not a hit as well", () => {
    const prev = deal();
    const id = Object.values(prev.cards).find((c) => c.pos)!.instanceId;
    const next = clone(prev); delete next.cards[id];
    expect(soundsForStep(prev, next).map((s) => s.kind)).toEqual(["break"]);
  });

  it("healing is not a sound", () => {
    const prev = deal();
    const id = Object.values(prev.cards).find((c) => c.pos)!.instanceId;
    prev.cards[id].curHp = 1;
    const next = clone(prev); next.cards[id].curHp = 4;
    expect(soundsForStep(prev, next)).toEqual([]);
  });

  it("a new match being dealt onto an empty board is not a crowd of cards arriving", () => {
    const start = deal();
    const birch = start.players.P1.hand.find((h) => h.defId === "leaf_birch")!;
    const full = applyIntent(start, { type: "SUMMON", player: "P1", handId: birch.handId, col: 1 });
    expect(Object.keys(full.cards).length).toBeGreaterThan(1);
    const empty = clone(full); empty.cards = {};
    expect(soundsForStep(empty, full)).toEqual([]);
    // ...and neither is the old match's board clearing away for the next one.
    const earlier = clone(full); earlier.round = 7;
    expect(soundsForStep(earlier, full)).toEqual([]);
  });

});

describe("yourMoveReturned", () => {
  const s = deal();

  it("fires on the step the move comes back to the player, and only then", () => {
    expect(yourMoveReturned(false, true, s, clone(s))).toBe(true);
    expect(yourMoveReturned(true, true, s, clone(s))).toBe(false); // still theirs
    expect(yourMoveReturned(true, false, s, clone(s))).toBe(false); // just handed away
    expect(yourMoveReturned(false, false, s, clone(s))).toBe(false);
    expect(yourMoveReturned(false, true, null, s)).toBe(false); // the first state ever seen
  });

  it("is not the mulligan, a finished game, or a new match over an old one", () => {
    const mull = clone(s); mull.phase = "mulligan";
    expect(yourMoveReturned(false, true, s, mull)).toBe(false);
    const over = clone(s); over.win = { winner: "P1", by: "elimination" };
    expect(yourMoveReturned(false, true, s, over)).toBe(false);
    const later = clone(s); later.round = 5;
    expect(yourMoveReturned(false, true, later, s)).toBe(false);
  });
});

describe("tapWords", () => {
  it("leaves a desktop's words alone", () => {
    expect(tapWords("Click a glowing Home slot.", false)).toBe("Click a glowing Home slot.");
  });

  it("says tap to a thumb, keeping the capital and the markup", () => {
    expect(tapWords("Click a glowing Home slot.", true)).toBe("Tap a glowing Home slot.");
    expect(tapWords("Casting <b>Zap</b> — click a glowing enemy.", true)).toBe("Casting <b>Zap</b> — tap a glowing enemy.");
    expect(tapWords("Mulligan: click cards to send back.", true)).toBe("Mulligan: tap cards to send back.");
  });

  it("covers the other forms and not look-alikes", () => {
    expect(tapWords("clicks, clicked, clicking", true)).toBe("taps, tapped, tapping");
    expect(tapWords("a clickbait icon", true)).toBe("a clickbait icon");
  });
});

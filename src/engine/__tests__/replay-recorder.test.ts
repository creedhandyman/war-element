// The App's recorder (ui/replay-recorder.ts): it logs what LANDED on screen,
// survives React rendering only the last of several quick states, starts over
// on a fresh deal, and refuses to call a match replayable once a state arrives
// that its recipe cannot explain (the other player's, online).
import { describe, expect, it } from "vitest";
import { aiMulligan, aiPrepIntent, chooseBattleAction } from "../ai";
import { needsP1Input } from "../phases";
import { createInitialState } from "../state";
import type { GameState, Intent } from "../types";
import { PREMADE_DECKS } from "../../data/custom-decks";
import { replayFrames, stateHash } from "../replay";
import { MatchRecorder, recAdvance, recApply } from "../../ui/replay-recorder";

function p1Intent(state: GameState): Intent {
  if (state.pendingFlow) {
    const card = state.cards[state.pendingFlow];
    return { type: "FLOW_CHANGE", player: card.owner, instanceId: state.pendingFlow, mode: "water" };
  }
  if (state.phase === "mulligan") return { type: "MULLIGAN", player: "P1", returnHandIds: aiMulligan(state, "P1") };
  if (state.phase === "prep") return aiPrepIntent(state, "P1");
  const id = state.battle!.awaitingInput!;
  const c = chooseBattleAction(state, id);
  return { type: "BATTLE_ACTION", player: "P1", action: c.action, targetId: c.targetId };
}

const deal = (seed: number) => {
  const d = PREMADE_DECKS.filter((x) => x.boardSize === 4);
  return createInitialState(seed, [...d[2].cards], [...d[5].cards], ["P1"], d[2].spells, d[5].spells, 4);
};
const step = (s: GameState) => (needsP1Input(s) ? recApply(s, p1Intent(s)) : recAdvance(s));

describe("the match recorder", () => {
  it("records a whole match, even when only every third state is ever seen", () => {
    const rec = new MatchRecorder();
    let s = deal(3);
    rec.observe(s);
    for (let i = 0; i < 30_000 && s.phase !== "gameover"; i++) {
      s = step(s);
      if (i % 3 === 0 || s.phase === "gameover") rec.observe(s); // React rendered this one
    }
    const replay = rec.finish(s)!;
    expect(replay).not.toBeNull();
    const { matches, frames } = replayFrames(replay);
    expect(matches).toBe(true);
    expect(stateHash(frames[frames.length - 1])).toBe(stateHash(s));
  }, 60_000);

  it("a state it cannot explain makes the match unreplayable", () => {
    const rec = new MatchRecorder();
    let s = deal(4);
    rec.observe(s);
    s = step(s); rec.observe(s);
    const foreign = JSON.parse(JSON.stringify(step(s))) as GameState; // arrived over the wire
    rec.observe(foreign);
    expect(rec.broken).toBe(true);
    expect(rec.finish(foreign)).toBeNull();
  });

  it("a fresh deal starts a new recording", () => {
    const rec = new MatchRecorder();
    let s = deal(5);
    rec.observe(s);
    s = step(s); rec.observe(s);
    const before = rec.matchNo;
    rec.observe(deal(6));
    expect(rec.matchNo).toBe(before + 1);
    expect(rec.broken).toBe(false);
  });
});

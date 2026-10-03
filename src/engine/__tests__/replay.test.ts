// REPLAYS: a match is its opening state plus its steps, and re-running the
// steps rebuilds it exactly. These pin that promise end to end — a full match
// played by the AI on both seats, recorded the way the App records it, then
// replayed from a JSON round trip of the opening state.
import { describe, expect, it } from "vitest";
import { aiMulligan, aiPrepIntent, chooseBattleAction } from "../ai";
import { advance, applyIntent, needsP1Input } from "../phases";
import { createInitialState } from "../state";
import type { GameState, Intent } from "../types";
import { PREMADE_DECKS } from "../../data/custom-decks";
import {
  decodeReplay, encodeReplay, expandSteps, makeReplay, pushStep, replayFrames, stateHash, stepCount,
  type ReplayStep,
} from "../replay";

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

/** Play a whole match, recording every step. */
function record(seed: number, board: 4 | 5) {
  const decks = PREMADE_DECKS.filter((d) => d.boardSize === board);
  const a = decks[seed % decks.length];
  const b = decks[(seed + 3) % decks.length];
  let s = createInitialState(seed, [...a.cards], [...b.cards], ["P1"], a.spells, b.spells, board);
  const opening = JSON.parse(JSON.stringify(s)) as GameState;
  const steps: ReplayStep[] = [];
  for (let i = 0; i < 30_000 && s.phase !== "gameover"; i++) {
    if (needsP1Input(s)) {
      const intent = p1Intent(s);
      s = applyIntent(s, intent);
      pushStep(steps, intent);
    } else {
      s = advance(s);
      pushStep(steps, "advance");
    }
  }
  return { opening, steps, final: s };
}

describe("replays", () => {
  it("advances fold into runs, and expand back out in order", () => {
    const steps: ReplayStep[] = [];
    const pass = { type: "PASS", player: "P1" } as Intent;
    pushStep(steps, "advance"); pushStep(steps, "advance"); pushStep(steps, pass); pushStep(steps, "advance");
    expect(steps).toEqual([2, pass, 1]);
    expect(stepCount(steps)).toBe(4);
    expect(expandSteps(steps)).toEqual(["advance", "advance", pass, "advance"]);
  });

  it.each([[11, 4], [27, 4], [5, 5]] as const)("seed %i on the %i-board: a whole match replays to the same final state", (seed, board) => {
    const { opening, steps, final } = record(seed, board);
    expect(final.phase).toBe("gameover");
    const replay = makeReplay(opening, steps, final);
    const { frames, brokeAt, matches } = replayFrames(replay);
    expect(brokeAt).toBeNull();
    expect(frames).toHaveLength(replay.length + 1);
    expect(matches, "the fingerprint at the end agrees").toBe(true);
    expect(stateHash(frames[frames.length - 1])).toBe(stateHash(final));
    expect(frames[frames.length - 1].win).toEqual(final.win);
  }, 60_000);

  it("a replay recorded on an older build is reported, not passed off as this one", () => {
    const { opening, steps, final } = record(11, 4);
    const replay = { ...makeReplay(opening, steps, final), finalHash: "00000000" };
    expect(replayFrames(replay).matches).toBe(false);
  }, 60_000);

  it("the share code round-trips", async () => {
    const { opening, steps, final } = record(27, 4);
    const replay = makeReplay(opening, steps, final);
    const code = await encodeReplay(replay);
    expect(code.startsWith("WER1.")).toBe(true);
    const back = await decodeReplay(code);
    expect(back).toEqual(replay);
    expect(await decodeReplay("not a replay")).toBeNull();
  }, 60_000);
});

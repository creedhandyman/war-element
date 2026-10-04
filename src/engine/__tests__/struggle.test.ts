// THE STRUGGLE TIPS (ui/struggle.ts): each sign fires on the board state it
// names and on nothing else, and the save can carry how often each was shown.
// States are the tutorial's deal (ui/tutorial.ts), edited to the situation.
import { describe, expect, it } from "vitest";
import { advance, applyIntent, homeRow, needsInput, type GameState } from "..";
import { BEATS, beatIndex, createTutorialState, enemyStep, scriptedIntent, type TutUi } from "../../ui/tutorial";
import {
  TIPS, boardStruggle, freshMemory, idleTipFor, tipLeft, tipMark, tipShown, type TipId,
} from "../../ui/struggle";
import { loadStory, newSave } from "../../data/story";

const clone = (s: GameState): GameState => structuredClone(s);
const HOME = homeRow("P1", 4);

/** The tutorial deal: P2's Grill on (0,2), P1 still to place, Birch and Cactus
 *  in hand, the opening placement owed. */
function deal(): GameState {
  let s = createTutorialState();
  for (let i = 0; i < 50 && needsInput(s) !== "P1"; i++) s = needsInput(s) === "P2" ? enemyStep(s)! : advance(s);
  return s;
}

/** P1's Birch placed on (3,1), the opening spent. */
function withBirch(): GameState {
  const s = deal();
  const birch = s.players.P1.hand.find((h) => h.defId === "leaf_birch")!;
  const next = applyIntent(s, { type: "SUMMON", player: "P1", handId: birch.handId, col: 1 });
  next.opening = undefined;
  return next;
}
const idOf = (s: GameState, defId: string) =>
  Object.values(s.cards).find((c) => c.defId === defId && c.pos)!.instanceId;

describe("the board signs", () => {
  it("captured: an enemy took one of my Home squares", () => {
    const prev = deal();
    const next = clone(prev);
    next.slots[HOME][1].capturedBy = "P2";
    expect(boardStruggle(prev, next, "P1", freshMemory())).toBe("captured");
    // My own capture of THEIR row is not a struggle.
    const mine = clone(prev);
    mine.slots[0][1].capturedBy = "P1";
    expect(boardStruggle(prev, mine, "P1", freshMemory())).toBeNull();
  });

  it("outsped: a faster enemy killed my card before it acted", () => {
    // Birch (SP 4) and the Grill (SP 1), seats swapped so the FAST one is the
    // enemy's, acting first in the queue.
    const base = withBirch();
    const birch = idOf(base, "leaf_birch");
    const grill = idOf(base, "pyro_bbq");
    const prev = clone(base);
    prev.cards[birch].owner = "P2";
    prev.cards[grill].owner = "P1";
    prev.phase = "battle";
    prev.battle = { queue: [birch, grill], index: 0, awaitingInput: null } as GameState["battle"];
    const next = clone(prev);
    next.cards[grill].curHp = 0;
    expect(boardStruggle(prev, next, "P1", freshMemory())).toBe("outsped");
    // The slow card dying to a SLOWER one that happened to go first is not
    // "it was faster".
    const fair = clone(prev);
    fair.cards[birch].owner = "P1";
    fair.cards[grill].owner = "P2";
    fair.battle = { queue: [grill, birch], index: 0, awaitingInput: null } as GameState["battle"];
    const fairNext = clone(fair);
    fairNext.cards[birch].curHp = 0;
    expect(boardStruggle(fair, fairNext, "P1", freshMemory())).toBeNull();
  });

  it("empty-board: the prep turn ended with nothing placed and a card I could afford", () => {
    const prev = deal(); // the free opening card is affordable, the board is empty
    const next = clone(prev);
    next.phase = "battle";
    expect(boardStruggle(prev, next, "P1", freshMemory())).toBe("empty-board");
    // Not while the round is still going.
    expect(boardStruggle(prev, clone(prev), "P1", freshMemory())).toBeNull();
  });

  it("home-full: my Home row is all mine and I could afford another", () => {
    const prev = withBirch();
    const birch = prev.cards[idOf(prev, "leaf_birch")];
    for (const col of [0, 2, 3]) {
      const id = `${birch.instanceId}-copy${col}`;
      prev.cards[id] = { ...structuredClone(birch), instanceId: id, pos: { row: HOME, col } };
    }
    prev.players.P1.gold = 5; // Cactus is 2
    const next = clone(prev);
    next.phase = "battle";
    expect(boardStruggle(prev, next, "P1", freshMemory())).toBe("home-full");
  });

  it("no-income: two rounds broke, with nothing on my Home row", () => {
    const s = withBirch();
    s.cards[idOf(s, "leaf_birch")].pos = { row: 2, col: 1 }; // walked off home
    s.players.P1.gold = 0;                                    // Cactus is 2
    const r1 = clone(s); r1.round = 1;
    const r2 = clone(s); r2.round = 2;
    const r3 = clone(s); r3.round = 3;
    const mem = freshMemory();
    expect(boardStruggle(r1, r2, "P1", mem), "once is not a pattern").toBeNull();
    expect(boardStruggle(r2, r3, "P1", mem)).toBe("no-income");
    // A card at home breaks the run.
    const home = clone(r3); home.round = 4;
    home.cards[idOf(home, "leaf_birch")].pos = { row: HOME, col: 1 };
    const mem2 = freshMemory();
    boardStruggle(r1, r2, "P1", mem2);
    expect(boardStruggle(r2, { ...home, round: 3 }, "P1", mem2)).toBeNull();
  });

  it("says nothing when the match is over — a surrender ends the prep turn too", () => {
    const prev = deal(); // empty board, a card it could afford: empty-board, were it still on
    const over = clone(prev);
    over.phase = "gameover";
    expect(boardStruggle(prev, over, "P1", freshMemory())).toBeNull();
  });

  it("says nothing on a Domination board, which has no Home row", () => {
    const prev = deal();
    const next = clone(prev);
    next.phase = "battle";
    (prev as { domination?: unknown }).domination = {};
    expect(boardStruggle(prev, next, "P1", freshMemory())).toBeNull();
  });

  it("a well-played match is silent: the scripted first battle, every step", () => {
    // Played the way tutorial-script.test plays it; every consecutive pair of
    // states, seen from P1, shows no struggle.
    let s = createTutorialState();
    const ui: TutUi = { handDef: null, cardId: null, pending: null };
    const mem = freshMemory();
    let cursor = 0, steps = 0;
    for (let guard = 0; guard < 2000 && s.phase !== "gameover"; guard++) {
      const who = needsInput(s);
      let next: GameState;
      if (who === "P2") next = enemyStep(s)!;
      else if (who === null) next = advance(s);
      else {
        cursor = beatIndex(s, ui, cursor);
        const intent = scriptedIntent(s, BEATS[cursor]);
        if (!intent) { cursor++; continue; }
        next = applyIntent(s, intent);
      }
      expect(boardStruggle(s, next, "P1", mem), `round ${s.round} ${s.phase}`).toBeNull();
      s = next; steps++;
    }
    expect(s.phase).toBe("gameover");
    expect(steps).toBeGreaterThan(20);
  });
});

describe("the idle tips", () => {
  it("fit what the game is waiting for", () => {
    const s = deal();
    expect(idleTipFor(s, "P1", "P1")).toBe("idle-deploy");
    const prep = clone(s); prep.opening = undefined;
    expect(idleTipFor(prep, "P1", "P1")).toBe("idle-prep");
    const battle = clone(s); battle.phase = "battle";
    expect(idleTipFor(battle, "P1", "P1")).toBe("idle-battle");
    expect(idleTipFor(s, "P1", "P2"), "the enemy's turn").toBeNull();
    const mull = clone(s); mull.phase = "mulligan";
    expect(idleTipFor(mull, "P1", "P1"), "the mulligan sheet explains itself").toBeNull();
  });
});

describe("how often, kept in the save", () => {
  it("counts showings and stops at each tip's limit", () => {
    let taught: string[] = [];
    for (let i = 0; i < 3; i++) {
      expect(tipLeft(taught, "idle-prep")).toBe(true);
      taught = [...taught, tipMark(taught, "idle-prep")];
    }
    expect(taught).toEqual(["tip:idle-prep", "tip:idle-prep#2", "tip:idle-prep#3"]);
    expect(tipShown(taught, "idle-prep")).toBe(3);
    expect(tipLeft(taught, "idle-prep")).toBe(false);
    expect(tipLeft(["tip:captured"], "captured"), "the rest are said once").toBe(false);
    // One tip's marks are not another's.
    expect(tipShown(["tip:idle-prep-x", "tip:idle-battle"], "idle-prep")).toBe(0);
  });

  it("every tip is one short line that names no card", () => {
    for (const [id, tip] of Object.entries(TIPS) as [TipId, (typeof TIPS)[TipId]][]) {
      expect(tip.id).toBe(id);
      expect(tip.text.length, id).toBeLessThanOrEqual(120);
      expect(tip.text, id).not.toMatch(/\b(Sakuroot|Greegon|Birch|Grill)\b/);
      expect(tip.times, id).toBeGreaterThanOrEqual(1);
    }
  });

  it("a fresh save has nothing taught, and the marks survive a round trip", () => {
    expect(newSave().taught ?? []).toEqual([]);
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      // The sanitizer keeps only strings — a hand-edited save must not put a
      // number where an id belongs.
      store.set("we_story_v1", JSON.stringify({
        cleared: [], collection: [], pity: {}, deck: [], blight: {},
        taught: ["tip:idle-prep#2", 7, null, "SKIP"],
      }));
      expect(loadStory().taught).toEqual(["tip:idle-prep#2", "SKIP"]);
    } finally { g.localStorage = prior; }
  });
});

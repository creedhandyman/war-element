import { describe, it, expect } from "vitest";
import { advance, createInitialState } from "../index";
import type { GameState } from "../index";
import { CARDS } from "../../data/cards";
import { PREMADE_DECKS } from "../../data/custom-decks";

// Play whole AI-vs-AI matches to completion. Not a rules check — a "does the
// engine survive a real game" check, across every premade deck and both boards.
function playOut(p1: string[], p2: string[], board: number, seed: number) {
  let s: GameState = createInitialState(seed, p1, p2, [], [], [], board);
  let steps = 0;
  while (s.phase !== "gameover" && steps < 8000) {
    s = advance(s);
    steps++;
  }
  return { s, steps };
}

describe("smoke: whole matches run to completion", () => {
  const small = PREMADE_DECKS.filter((d) => (d.boardSize ?? 4) === 4);

  it(`plays ${small.length} premade 4x4 matchups without throwing`, () => {
    for (let i = 0; i < small.length; i++) {
      const a = small[i];
      const b = small[(i + 1) % small.length];
      const { s, steps } = playOut(a.cards, b.cards, 4, 100 + i);
      expect(s.phase, `${a.id} vs ${b.id} stalled after ${steps} steps`).toBe("gameover");
      expect(s.round).toBeGreaterThan(0);
    }
    expect(small.length).toBeGreaterThan(0);
  });

  it("plays 5x5 matchups without throwing", () => {
    const big = PREMADE_DECKS.filter((d) => (d.boardSize ?? 4) === 5);
    for (let i = 0; i < big.length; i++) {
      const a = big[i];
      const b = big[(i + 1) % big.length];
      const { s } = playOut(a.cards, b.cards, 5, 500 + i);
      expect(s.phase, `${a.id} vs ${b.id}`).toBe("gameover");
    }
    expect(big.length).toBeGreaterThan(0);
    // 20s, not the 5s default: the premade roster has grown to 26 5x5 decks
    // (the ladder's fifth rung members included), which sits at ~3.5s alone and
    // over 5s under a loaded parallel run — where it flaked once. The budget is
    // for scheduling noise, not for a slower game: a real stall still trips the
    // per-match step cap long before any timeout does.
  }, 20_000);

  it("rotates the whole draftable pool through real matches", () => {
    // So no single card's trigger path is left unexercised by the suite.
    const pool = CARDS.filter((c) => !c.id.endsWith("_tok")).map((c) => c.id);
    const chunk = 12;
    let played = 0;
    for (let i = 0; i + chunk <= pool.length; i += chunk) {
      const deck = pool.slice(i, i + chunk);
      const { s, steps } = playOut(deck, deck, 4, 900 + i);
      expect(s.phase, `chunk at ${i} (${deck[0]}…) stalled after ${steps} steps`).toBe("gameover");
      played += chunk;
    }
    expect(played).toBeGreaterThan(200);
  });
});

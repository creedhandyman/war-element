// DISPOSABLE — delete before committing. See CLAUDE.md "Measuring balance".
// Canonical harness, copied verbatim: humans [], spells undefined, both boards,
// 50 seeds, i!==j for both seat orders = 5,600 matches, n=1,400, +/-2.6 at 95%.
import { describe, expect, it } from "vitest";
import { CORES } from "../../data/cards";
import { createInitialState } from "../state";
import { advance } from "../phases";

describe("balance", () => {
  it("solo cores, both boards, both seat orders, 50 seeds", () => {
    const wins: Record<string, number> = {}, games: Record<string, number> = {};
    for (const c of CORES) { wins[c.id] = 0; games[c.id] = 0; }
    for (let i = 0; i < CORES.length; i++)
      for (let j = 0; j < CORES.length; j++) {
        if (i === j) continue;                       // both seat orders come from i!==j
        for (const board of [4, 5]) for (let k = 0; k < 50; k++) {
          let s = createInitialState(k * 31 + 7, CORES[i].cards, CORES[j].cards,
            [], undefined, undefined, board);        // humans [] · spells undefined
          let st = 0;
          while (s.phase !== "gameover" && st < 8000) { s = advance(s); st++; }
          games[CORES[i].id]++; games[CORES[j].id]++;
          if (s.win?.winner === "P1") wins[CORES[i].id]++;
          else if (s.win?.winner === "P2") wins[CORES[j].id]++;
        }
      }
    const rows = CORES.map((c) => ({
      id: c.id, n: games[c.id], pct: (wins[c.id] / games[c.id]) * 100,
    })).sort((a, b) => b.pct - a.pct);
    const spread = rows[0].pct - rows[rows.length - 1].pct;
    console.log("\n=== BALANCE ===");
    for (const r of rows) console.log(`${r.id.padEnd(5)} ${r.pct.toFixed(1)}   n=${r.n}`);
    console.log(`spread ${spread.toFixed(1)}`);
    console.log("PREV(pre-nerf): bolt 59.4 dawn 56.4 gale 52.0 leaf 50.1 bore 48.6 pyro 45.9 dusk 45.1 aqua 42.5 | spread 16.9");
    expect(rows.length).toBe(8);
  }, 900_000);
});

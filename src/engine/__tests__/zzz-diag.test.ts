// DISPOSABLE — delete before committing.
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { PREMADE_DECKS } from "../../data/custom-decks";
import { VOID_BOSSES, buildVoidEncounter, voidBossSeat } from "../../data/void-tower";
import { advance } from "../phases";
import { boardCards, createInitialState, summonCard } from "../state";

describe("zzz diag", () => {
  it("after unlocking the home row", () => {
    const decks = ["Deeproot Ambush", "Skydream", "Inferno Blitz"]
      .map((n) => PREMADE_DECKS.find((x) => x.name === n && x.boardSize === 5)!);
    const SEEDS = 12;
    const lines = ["boss           win%  rounds  bossHP%  foeSide   by"];
    for (const b of VOID_BOSSES) {
      const enc = buildVoidEncounter(b);
      let w = 0, rounds = 0, hp = 0, theirs = 0, n = 0;
      const by: Record<string, number> = {};
      for (const d of decks) for (let k = 0; k < SEEDS; k++) {
        let s = createInitialState(k * 31 + 7, [...d.cards], enc.deck, [], undefined,
          enc.spells, enc.boardSize, undefined, undefined, { P2: enc.stacked.P2 });
        s.voidTower = true;
        const inst = summonCard(s, "P2", b.cardId, voidBossSeat(s.boardSize) as never);
        inst.summonedThisRound = false;
        const id = inst.instanceId;
        let st = 0;
        while (s.phase !== "gameover" && st < 8000) { s = advance(s); st++; }
        n++;
        if (s.win?.winner === "P2") w++;
        by[s.win?.by ?? "none"] = (by[s.win?.by ?? "none"] ?? 0) + 1;
        rounds += s.round;
        const c = s.cards[id];
        hp += c ? Math.max(0, c.curHp) / c.maxHp : 0;
        theirs += boardCards(s, "P1").filter((x) => x.curHp > 0).length;
      }
      lines.push(b.cardId.replace("boss_", "").padEnd(14)
        + `${Math.round((w / n) * 100)}%`.padStart(5)
        + `${(rounds / n).toFixed(1)}`.padStart(8)
        + `${Math.round((hp / n) * 100)}%`.padStart(9)
        + `${(theirs / n).toFixed(1)}`.padStart(9)
        + "   " + Object.entries(by).sort((a, b2) => b2[1] - a[1])
            .map(([k, v]) => `${k}:${v}`).join(" "));
    }
    writeFileSync("diag.txt", lines.join("\n"));
    expect(true).toBe(true);
  }, 900_000);
});

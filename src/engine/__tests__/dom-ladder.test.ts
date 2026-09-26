// DOMINATION IN STREAK AND GAUNTLET — the table, the pay, and whose Point is whose.
//
// The 7x7 used to be casual Domination's alone. Now either scored mode can be
// played on it (the FORMAT toggle), pays more for it, and SOMETIMES seats more
// than one opponent. The rules live in `data/dom-ladder.ts` and the run's half
// in `data/gauntlet.ts`; both are pure, so this is where they are pinned. The
// Arena wiring is pinned at the source level in `arena-flow.test.ts`.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DOM_WIN_PAY, EXTRA_FOE_ODDS, EXTRA_FOE_PAY, dealExtras, extrasFit, rollExtraFoes, tablePay, tableWinPay,
} from "../../data/dom-ladder";
import {
  RUN_LENGTH, recordResult, rewardFor, runReward, runRewardOf, seatExtras, seatFoes, settleArena, startRun,
  type GauntletRun,
} from "../../data/gauntlet";
import { decksForTier, tiersFor } from "../../data/custom-decks";
import { awardShards, newSave, type StorySave } from "../../data/story";
import { DOMINATION_7X7, newDomination } from "../../data/domination";
import { poiHolderSuit } from "../../ui/shared";

const seq = (...n: number[]) => { let i = 0; return () => n[i++ % n.length]; };
const DOM = DOMINATION_7X7.boardSize;

describe("what a table pays", () => {
  it("a duel board pays what it always did, whatever the table", () => {
    for (const board of [4, 5]) for (const foes of [1, 2, 3]) expect(tablePay(board, foes)).toBe(1);
  });

  it("Domination pays double, and every opponent past the first adds half again", () => {
    expect(tablePay(DOM, 1)).toBe(DOM_WIN_PAY);
    expect(tablePay(DOM, 2)).toBe(DOM_WIN_PAY * 1.5);
    expect(tablePay(DOM, 3)).toBe(DOM_WIN_PAY * 2);
    expect(EXTRA_FOE_PAY).toBe(0.5);
  });

  it("...which keeps a match's expected pay level across table sizes", () => {
    // Against F equally strong opponents you win about one game in F + 1. The
    // table's share of the multiplier, (F + 1) / 2, exactly repays that — so a
    // big table is never the worse deal, and never the farm.
    for (const foes of [1, 2, 3]) {
      const perMatch = (tablePay(DOM, foes) / DOM_WIN_PAY) * (1 / (foes + 1));
      expect(perMatch, `${foes} opponents`).toBeCloseTo(0.5, 10);
    }
  });

  it("scales a whole duel price and rounds it to shards", () => {
    expect(tableWinPay(2, 4, 1)).toBe(2);
    expect(tableWinPay(2, DOM, 1)).toBe(4);
    expect(tableWinPay(7, DOM, 2)).toBe(21);
    expect(tableWinPay(5, DOM, 3)).toBe(20);
    expect(tableWinPay(3, DOM, 2)).toBe(9);
  });
});

describe("how often a table is bigger than a duel", () => {
  it("the odds are a real distribution: duel half the time, then one more, then two", () => {
    expect(EXTRA_FOE_ODDS.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(EXTRA_FOE_ODDS).toEqual([0.5, 0.3, 0.2]);
  });

  it("rolls on those odds, edges included", () => {
    const at = (r: number) => rollExtraFoes(() => r);
    expect(at(0)).toBe(0);
    expect(at(0.4999)).toBe(0);
    expect(at(0.5)).toBe(1);
    expect(at(0.7999)).toBe(1);
    expect(at(0.8)).toBe(2);
    expect(at(0.99999)).toBe(2);
  });

  it("deals the extra decks from the seat's own rung — never the seat's deck, never one twice", () => {
    for (const tier of tiersFor(DOM)) {
      const rung = new Set(decksForTier(tier, DOM).map((d) => d.id));
      const main = decksForTier(tier, DOM)[0].id;
      for (let i = 0; i < 300; i++) {
        const extras = dealExtras(tier, DOM, main);
        expect(extras.length).toBeLessThanOrEqual(2);
        expect(new Set(extras).size, "no repeats").toBe(extras.length);
        expect(extras, "never the seat's own deck").not.toContain(main);
        for (const id of extras) expect(rung.has(id), `${id} is on ${tier}`).toBe(true);
      }
    }
  });

  it("deals the number it rolled", () => {
    const main = decksForTier("hard", DOM)[0].id;
    expect(dealExtras("hard", DOM, main, seq(0.1))).toHaveLength(0);
    expect(dealExtras("hard", DOM, main, seq(0.6, 0.3))).toHaveLength(1);
    expect(dealExtras("hard", DOM, main, seq(0.9, 0.2, 0.7))).toHaveLength(2);
  });

  it("really is SOMETIMES — both duels and bigger tables come up", () => {
    const main = decksForTier("mid", DOM)[0].id;
    const sizes = new Set<number>();
    for (let i = 0; i < 400; i++) sizes.add(dealExtras("mid", DOM, main).length);
    expect([...sizes].sort()).toEqual([0, 1, 2]);
  });

  it("a duel board never deals a table", () => {
    for (const board of [4, 5]) {
      const main = decksForTier("hard", board)[0].id;
      for (let i = 0; i < 50; i++) expect(dealExtras("hard", board, main)).toEqual([]);
    }
  });

  it("a stored table that no longer fits is dealt again, not fielded", () => {
    const rung = decksForTier("hard", DOM).map((d) => d.id);
    const [main, a, b] = rung;
    expect(extrasFit([a, b], "hard", DOM, main)).toBe(true);
    expect(extrasFit([], "hard", DOM, main), "a dealt duel is a fine table").toBe(true);
    expect(extrasFit([main], "hard", DOM, main), "the seat's own deck").toBe(false);
    expect(extrasFit([a, a], "hard", DOM, main), "a deck twice").toBe(false);
    const easy = decksForTier("easy", DOM).map((d) => d.id).find((id) => !rung.includes(id))!;
    expect(extrasFit([easy], "hard", DOM, main), "another rung's deck").toBe(false);
    expect(extrasFit([a], "hard", 5, main), "any table on a duel board").toBe(false);
  });
});

describe("a Domination gauntlet", () => {
  it("deals every seat's table with the run, from the seat's rung", () => {
    for (const tier of tiersFor(DOM)) {
      const run = startRun(tier, DOM);
      expect(run.board).toBe(DOM);
      expect(run.extras, `${tier}: one table per seat`).toHaveLength(RUN_LENGTH);
      run.extras!.forEach((extras, i) => {
        expect(extras, `seat ${i + 1} sits beside itself`).not.toContain(run.seats[i]);
        expect(extrasFit(extras, tier, DOM, run.seats[i])).toBe(true);
      });
    }
  });

  it("deals the seats exactly as a duel run would — the tables come after", () => {
    // The seat shuffle draws first, so adding tables cannot change which four
    // decks a seeded run deals.
    const a = startRun("hard", DOM, seq(0.3, 0.7, 0.1, 0.9, 0.5));
    const b = startRun("hard", 5, seq(0.3, 0.7, 0.1, 0.9, 0.5));
    expect(a.seats).toEqual(b.seats);
    expect(b.extras, "a duel board run has no tables").toBeUndefined();
  });

  it("the table is fixed with the run — leaving and coming back cannot reroll it", () => {
    const run = startRun("mid", DOM);
    const tables = JSON.stringify(run.extras);
    const after = recordResult(run, true);
    expect(JSON.stringify(after.extras)).toBe(tables);
  });

  it("names the current seat's table, and nothing once the run is over", () => {
    const run = { ...startRun("hard", DOM), extras: [[], [], [], []] as string[][] };
    const other = decksForTier("hard", DOM).map((d) => d.id).find((id) => id !== run.seats[1])!;
    run.extras[1] = [other];
    expect(seatExtras(run, DOM)).toEqual([]);
    expect(seatFoes(run, 0)).toBe(1);
    const second = recordResult(run, true);
    expect(seatExtras(second, DOM).map((d) => d.id)).toEqual([other]);
    expect(seatFoes(second, 1)).toBe(2);
    expect(seatExtras(recordResult(second, false), DOM), "a lost run seats nobody").toEqual([]);
  });

  it("pays for its bigger tables, averaged over the run's seats", () => {
    expect(runReward("hard", DOM)).toBe(60);
    expect(runReward("hard", DOM, [0, 0, 0, 0])).toBe(60);
    expect(runReward("hard", DOM, [2, 2, 2, 2]), "all tables of three: double again").toBe(120);
    expect(runReward("hard", DOM, [1, 0, 2, 1])).toBe(Math.round(60 * (1 + 0.5 * 1)));
    // ...and a duel board ignores tables entirely.
    expect(runReward("hard", 5, [2, 2, 2, 2])).toBe(runReward("hard", 5));
    const run = { ...startRun("easy", DOM), extras: [[], ["x"], [], ["y", "z"]] };
    expect(runRewardOf(run)).toBe(runReward("easy", DOM, [0, 1, 0, 2]));
  });

  it("pays the run's price, tables included, when it is cleared", () => {
    let run: GauntletRun = { ...startRun("mid", DOM), extras: [[], [], ["a"], ["b", "c"]] };
    for (let i = 0; i < RUN_LENGTH; i++) run = recordResult(run, true);
    expect(rewardFor(run)).toBe(runReward("mid", DOM, [0, 0, 1, 2]));
  });
});

describe("settling a Domination seat", () => {
  const save = (over?: Partial<StorySave>): StorySave => ({ ...newSave(), ...over });
  const pay = (s: StorySave) => awardShards(s, "arena");
  const shards = (s: StorySave) => s.hero?.shards ?? 0;
  const live = () => save({ gauntlet: { run: startRun("hard", DOM, seq(0.3)), cleared: [] } });

  it("a won live seat pays the flat win AND its table's bonus", () => {
    expect(shards(settleArena(live(), { won: true, againstPremade: true, gauntletSeat: true, tableBonus: 6 }, pay)))
      .toBe(2 + 6);
  });

  it("...and never outside a live seat: not lost, not parked, not after the run, not vs your own deck", () => {
    const bonus = { tableBonus: 6 };
    expect(shards(settleArena(live(), { won: false, againstPremade: true, gauntletSeat: true, ...bonus }, pay)), "a loss").toBe(0);
    expect(shards(settleArena(live(), { won: true, againstPremade: true, ...bonus }, pay)), "run parked").toBe(2);
    expect(shards(settleArena(live(), { won: true, againstPremade: false, gauntletSeat: true, ...bonus }, pay)), "a deck you built").toBe(0);
    // A Rematch after the run ended is fought on the same 7x7.
    const lost = settleArena(live(), { won: false, againstPremade: true, gauntletSeat: true }, pay);
    expect(shards(settleArena(lost, { won: true, againstPremade: true, gauntletSeat: true, ...bonus }, pay)) - shards(lost),
      "the run is over").toBe(2);
    expect(shards(settleArena(save(), { won: true, againstPremade: true, gauntletSeat: true, ...bonus }, pay)), "no run").toBe(2);
  });

  it("a negative bonus is never a charge", () => {
    expect(shards(settleArena(live(), { won: true, againstPremade: true, gauntletSeat: true, tableBonus: -5 }, pay))).toBe(2);
  });
});

describe("whose Point is whose", () => {
  const game = (held: Partial<Record<"A" | "B" | "C" | "D", "P1" | "P2" | "P3" | "P4" | null>>) => {
    const domination = newDomination(DOMINATION_7X7);
    Object.assign(domination.held, held);
    return {
      domination,
      seatSuits: { P1: "spade", P2: "club", P3: "heart", P4: "diamond" } as const,
    };
  };
  const citadel = (id: "A" | "B" | "C" | "D") => DOMINATION_7X7.pois.find((p) => p.id === id)!.centre;

  it("wears the holder's suit on the Point's citadel", () => {
    const g = game({ A: "P3", D: "P1" });
    const a = citadel("A"), d = citadel("D");
    expect(poiHolderSuit(g, a.row, a.col)).toEqual({ seat: "P3", glyph: "♥", key: "heart" });
    expect(poiHolderSuit(g, d.row, d.col)).toEqual({ seat: "P1", glyph: "♠", key: "spade" });
  });

  it("shows nothing on a Point nobody holds, off the citadel, or off the Domination map", () => {
    const g = game({ A: "P2" });
    const b = citadel("B"), a = citadel("A");
    expect(poiHolderSuit(g, b.row, b.col), "unheld").toBeUndefined();
    expect(poiHolderSuit(g, a.row, a.col + 1), "a ring square").toBeUndefined();
    expect(poiHolderSuit({ seatSuits: g.seatSuits }, a.row, a.col), "no Domination").toBeUndefined();
  });

  it("follows the DEAL, and the alternate shade when two seats share a suit", () => {
    const g = { ...game({ A: "P2", B: "P4" }), seatSuits: { P1: "heart", P2: "heart", P3: "club", P4: "spade" } as const };
    const a = citadel("A"), b = citadel("B");
    expect(poiHolderSuit(g, a.row, a.col)?.key, "P2 shares P1's hearts").toBe("heart-alt");
    expect(poiHolderSuit(g, b.row, b.col)?.glyph).toBe("♠");
  });

  it("is drawn above the letter, in the suit's own colour", () => {
    const ui = (f: string) => readFileSync(join(__dirname, "..", "..", "ui", f), "utf8").replace(/\r\n/g, "\n");
    expect(ui("Board.tsx")).toContain("poiSuit={poiHolderSuit(game, row, col)}");
    const slot = ui("Slot.tsx");
    const letter = slot.slice(slot.indexOf('<span className="poi-letter"'));
    expect(letter.indexOf("poi-suit suit-"), "the suit is inside the letter's group").toBeGreaterThan(-1);
    expect(letter.indexOf("poi-suit suit-")).toBeLessThan(letter.indexOf("{props.poiLetter}"));
    const css = ui("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const suit of ["spade", "club", "diamond", "heart"]) {
      expect(css).toContain(`.poi-suit.suit-${suit}`);
      expect(css).toContain(`.poi-suit.suit-${suit}-alt`);
    }
  });
});

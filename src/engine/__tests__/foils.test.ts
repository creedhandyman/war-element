// A FOIL IS THE CARD PRINTED BETTER — one extra point of one stat.
//
// The bonus is DERIVED FROM THE CARD ID rather than rolled and stored, and
// every test here is really about one of the three things that buys:
//
//   RETROACTIVE — a foil pulled a year ago has its bonus the moment this
//   ships, because nothing was ever stored to be missing.
//   STABLE — the same foil is the same card across sessions, devices and a
//   restored backup.
//   AGREED — both clients in an online match compute identical stats for the
//   other player's foils with no wire message and no trust.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CARDS, getDef } from "../../data/cards";
import {
  FOIL_BONUS, FOIL_STATS, foilBonusFor, foilStatFor,
} from "../../data/foils";
import { createInitialState, effectiveDmg, effectiveSp, summonCard } from "../state";
import type { GameState, Pos } from "../types";

const SUBJECT = "leaf_alpha";

/** A board where P1 owns `ids` in foil. */
function withFoils(ids: string[]): GameState {
  return createInitialState(7, undefined, undefined, [], undefined, undefined, 4,
    undefined, undefined, undefined, undefined, { P1: ids });
}

const put = (s: GameState, id: string, player: "P1" | "P2" = "P1") =>
  summonCard(s, player, id, { row: 3, col: 1 } as Pos);

describe("which stat a foil gains", () => {
  it("is one of the four, and the same one every time", () => {
    for (const c of CARDS.slice(0, 40)) {
      const stat = foilStatFor(c.id);
      expect(FOIL_STATS).toContain(stat);
      expect(foilStatFor(c.id), "asked twice, answered twice the same").toBe(stat);
    }
  });

  it("spreads across all four rather than collapsing onto one", () => {
    // A hash that mapped every id onto the same stat would pass every other
    // test in this file and make the feature a flat buff.
    const seen: Record<string, number> = {};
    for (const c of CARDS) seen[foilStatFor(c.id)] = (seen[foilStatFor(c.id)] ?? 0) + 1;
    for (const stat of FOIL_STATS)
      expect(seen[stat] ?? 0, `${stat} never comes up`).toBeGreaterThan(CARDS.length / 10);
  });

  it("pairs the stat with the printed amount", () => {
    const b = foilBonusFor(SUBJECT);
    expect(b.amount).toBe(FOIL_BONUS[b.stat]);
    expect(FOIL_BONUS).toEqual({ dmg: 1, hp: 2, shield: 1, sp: 1 });
  });

  it("does not depend on anything but the id", () => {
    // The whole retroactive/agreed story: no save, no seed, no clock, no
    // Math.random. Calling it a thousand times in a row must not drift.
    const first = CARDS.map((c) => foilStatFor(c.id));
    const again = CARDS.map((c) => foilStatFor(c.id));
    expect(again).toEqual(first);
  });
});

describe("the bonus lands on the body", () => {
  it("adds exactly the one stat its card was dealt", () => {
    const def = getDef(SUBJECT);
    const stat = foilStatFor(SUBJECT);
    const n = FOIL_BONUS[stat];

    const plain = createInitialState(7, undefined, undefined, [], undefined, undefined, 4);
    const a = put(plain, SUBJECT);
    const s = withFoils([SUBJECT]);
    const b = put(s, SUBJECT);

    expect(effectiveDmg(s, b) - effectiveDmg(plain, a)).toBe(stat === "dmg" ? n : 0);
    expect(effectiveSp(s, b) - effectiveSp(plain, a)).toBe(stat === "sp" ? n : 0);
    expect(b.curShields - a.curShields).toBe(stat === "shield" ? n : 0);
    expect(b.maxHp - a.maxHp).toBe(stat === "hp" ? n : 0);
    // Whatever it gained, the card is not otherwise a different card.
    expect(b.maxHp - def.hp).toBe(stat === "hp" ? n : 0);
  });

  it("arrives FILLED when it is the HP one — bigger, not wounded", () => {
    const hpCard = CARDS.find((c) => foilStatFor(c.id) === "hp")!;
    const s = withFoils([hpCard.id]);
    const inst = put(s, hpCard.id);
    expect(inst.maxHp).toBe(hpCard.hp + FOIL_BONUS.hp);
    expect(inst.curHp, "a foil must not land needing a heal").toBe(inst.maxHp);
  });

  it("touches only the cards actually held in foil", () => {
    const other = CARDS.find((c) => c.id !== SUBJECT && !c.boss)!;
    const s = withFoils([SUBJECT]);
    const plain = createInitialState(7, undefined, undefined, [], undefined, undefined, 4);
    const a = summonCard(plain, "P1", other.id, { row: 3, col: 2 } as Pos);
    const b = summonCard(s, "P1", other.id, { row: 3, col: 2 } as Pos);
    expect(b.maxHp).toBe(a.maxHp);
    expect(b.curShields).toBe(a.curShields);
    expect(effectiveDmg(s, b)).toBe(effectiveDmg(plain, a));
  });

  it("is per SEAT — your foils do not shine on their side of the board", () => {
    const s = withFoils([SUBJECT]);
    const mine = put(s, SUBJECT, "P1");
    const theirs = summonCard(s, "P2", SUBJECT, { row: 0, col: 1 } as Pos);
    const stat = foilStatFor(SUBJECT);
    if (stat === "hp") expect(theirs.maxHp).toBeLessThan(mine.maxHp);
    if (stat === "shield") expect(theirs.curShields).toBeLessThan(mine.curShields);
    if (stat === "dmg") expect(effectiveDmg(s, theirs)).toBeLessThan(effectiveDmg(s, mine));
    if (stat === "sp") expect(effectiveSp(s, theirs)).toBeLessThan(effectiveSp(s, mine));
  });

  it("changes nothing at all when a seat owns no foils", () => {
    // Every AI seat and every headless harness is this case, including the
    // balance harness — an absent list must be a true no-op.
    const s = createInitialState(7, undefined, undefined, [], undefined, undefined, 4);
    expect(s.players.P1.foils).toBeUndefined();
    const def = getDef(SUBJECT);
    const inst = put(s, SUBJECT);
    expect(inst.maxHp).toBe(def.hp);
    expect(inst.curShields).toBe(def.shields);
    expect(effectiveDmg(s, inst)).toBe(def.dmg);
  });
});

describe("the wiring", () => {
  const ui = (f: string) =>
    readFileSync(join(__dirname, "..", "..", "ui", f), "utf8");

  it("every real match tells the engine which cards are foil", () => {
    // The feature is inert if a match-start site forgets. Source-level because
    // App.tsx is one 5,000-line component with no DOM to render it in — the
    // same reason the draft and level-up wiring is guarded this way.
    const APP = ui("App.tsx");
    expect(APP, "the arena/local start").toContain("seatFoilsFor(),");
    expect(APP, "the story start").toContain("undefined, { P1: [...foilIds] }");
    expect(APP, "and the online host writes BOTH seats into the state")
      .toMatch(/g\.players\[seat\]\.foils = \[\.\.\.foils\[seat\]!\]/);
  });

  it("hot-seat gives both chairs the same collection", () => {
    // One person, one shelf of foils, two seats.
    expect(ui("App.tsx")).toContain("twoPlayer ? { P1: mine, P2: mine } : { P1: mine }");
  });

  it("says on the card what the foil is worth", () => {
    // A bonus nobody can see is a bonus nobody has.
    const CV = ui("CardView.tsx");
    expect(CV).toContain("foilBonusFor(d.id)");
    expect(CV).toContain("FOIL_STAT_LABEL[b.stat]");
  });
});

// HEROES — one per suit, bound to the suit the seat is playing.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInitialState } from "../state";
import { advance } from "../phases";
import { HEROES, HERO_GOLD, HERO_MIN_ROUND, HERO_SHIELDS, goldRoundFor, magicRoundFor } from "../heroes";
import { canSummon, effectiveSpecialCost } from "../rules";
import { applyIntent } from "../phases";
import { getDef } from "../../data/cards";
import { place, prepState } from "./helpers";
import { SUITS } from "../suits";
import { poolGainForRound } from "../types";
import type { GameState, Suit } from "../types";

describe("the roster", () => {
  it("is one hero per suit, each explainable in a sentence", () => {
    for (const suit of SUITS) {
      const h = HEROES[suit];
      expect(h.suit).toBe(suit);
      expect(h.identity.length, `${h.name} identity`).toBeGreaterThan(20);
      expect(h.power.name.length, `${h.name} power`).toBeGreaterThan(2);
    }
    expect(new Set(SUITS.map((s) => HEROES[s].name)).size).toBe(4);
  });

  it("shifts BOUNDARIES, never rates — so the curves re-converge", () => {
    // The whole safety argument. A rate change compounds without limit; a
    // boundary shift is worth a fixed few points and then both curves sit at
    // the same tier cap. Checked at the cap: by round 25 nobody is ahead.
    for (const suit of SUITS) {
      const late = poolGainForRound(goldRoundFor(25, suit, true));
      expect(late, `${HEROES[suit].name} converges`).toBe(poolGainForRound(25));
    }
  });

  it("never runs a curve backwards", () => {
    // A penalty slows the ramp; it must not make round 1 into round 0.
    for (const suit of SUITS)
      for (const r of [1, 2, 3])
        expect(goldRoundFor(r, suit, true)).toBeGreaterThanOrEqual(1);
  });
});

describe("heroes are OFF unless a mode turns them on", () => {
  // A suit is dealt to EVERY match — it is the seat's identity and the AI's
  // playstyle. A hero moves the economy, and an ordinary skirmish must not
  // acquire one just because a glyph was dealt. Tying the shift straight to the
  // suit broke three resource tests, which is this rule arriving as a failure.
  it("the shift is the identity function with the flag off", () => {
    for (const suit of SUITS) {
      expect(goldRoundFor(7, suit)).toBe(7);
      expect(magicRoundFor(7, suit)).toBe(7);
      expect(goldRoundFor(7, suit, false)).toBe(7);
    }
  });

  it("a default match pays both seats the printed curve", () => {
    // Suits are dealt here, so this is the regression guard: same income for
    // both seats through the early rounds, whatever they drew.
    let s: GameState = createInitialState(99, "leaf_pyro", "bore_dusk");
    expect(s.seatSuits, "suits are still dealt").toBeTruthy();
    expect(s.heroes, "but heroes are not on").toBeFalsy();
    for (let i = 0; i < 4000 && s.round < 6; i++) {
      const n = advance(s); if (n === s) break; s = n;
    }
    expect(s.players.P1.gold).toBe(s.players.P2.gold);
    expect(s.players.P1.magicPool).toBe(s.players.P2.magicPool);
  });

  it("...and with heroes ON the Warlord banks gold sooner than the Mage", () => {
    const gold = (suit: Suit, round: number) =>
      poolGainForRound(goldRoundFor(round, suit, true));
    // ROUND 5 is where it bites: tier 2 starts at round 6, so a +1 shift reads
    // 6 (tier 2) while a -1 shift reads 4 (still tier 1). At round 4 both are
    // on tier 1 and the test proves nothing — which is what it did first.
    expect(gold("spade", 5), "Warlord is a tier up").toBe(2);
    expect(gold("heart", 5), "the Mage is not").toBe(1);
    // ...and magic runs the other way, by more, because magic is worth less.
    const magic = (suit: Suit, round: number) =>
      poolGainForRound(magicRoundFor(round, suit, true));
    expect(magic("heart", 5)).toBeGreaterThan(magic("spade", 5));
  });
});

describe("the hero powers", () => {
  /** A prep state with heroes live and the seat wearing `suit`. */
  function armed(suit: Suit) {
    const s = prepState(7, "P1");
    s.heroes = true;
    // Powers are gated behind HERO_MIN_ROUND: an economy power on round one is
    // five rounds of income arriving at once, which is what broke the table.
    s.round = HERO_MIN_ROUND;
    s.seatSuits = { ...(s.seatSuits ?? {}), P1: suit } as never;
    return s;
  }

  it("Hold the Line shields the whole line, once", () => {
    const s = armed("club");
    const a = place(s, "leaf_nettle", "P1", 3, 0, { curShields: 0 });
    const b = place(s, "leaf_weeds", "P1", 3, 1, { curShields: 1 });
    const foe = place(s, "dusk_gool", "P2", 0, 0, { curShields: 0 });
    const next = applyIntent(s, { type: "HERO_POWER", player: "P1" });
    expect(next.cards[a.instanceId].curShields).toBe(HERO_SHIELDS);
    expect(next.cards[b.instanceId].curShields, "stacks on what it had").toBe(1 + HERO_SHIELDS);
    expect(next.cards[foe.instanceId].curShields, "allies only").toBe(0);
    // ...and it is spent.
    const again = applyIntent(next, { type: "HERO_POWER", player: "P1" });
    expect(again.cards[a.instanceId].curShields, "once per game").toBe(HERO_SHIELDS);
  });

  it("Requisition trades the dearest cards for gold", () => {
    const s = armed("diamond");
    s.players.P1.gold = 0;
    s.players.P1.hand = [
      { handId: "h1", defId: "leaf_nettle" },          // c1 — kept
      { handId: "h2", defId: "bore_bastion" },         // c8 — stranded, goes
      { handId: "h3", defId: "dusk_shadowhorsemen" },  // c10 — stranded, goes
    ];
    const next = applyIntent(s, { type: "HERO_POWER", player: "P1" });
    expect(next.players.P1.gold).toBe(HERO_GOLD);
    expect(next.players.P1.hand.map((h) => h.handId), "the dearest two go")
      .toEqual(["h1"]);
  });

  it("Muster makes the next summon free, and only the next one", () => {
    const s = armed("spade");
    s.players.P1.gold = 0; // cannot afford anything at all
    s.players.P1.hand = [
      { handId: "h1", defId: "leaf_greegon" },   // c3 — inside Muster's reach
      { handId: "h2", defId: "leaf_nettle" },    // c1
    ];
    expect(canSummon(s, "P1", "h1", 0).ok, "broke, and no power yet").toBe(false);
    const ready = applyIntent(s, { type: "HERO_POWER", player: "P1" });
    expect(canSummon(ready, "P1", "h1", 0).ok, "armed: price is no object").toBe(true);
    const after = applyIntent(ready, { type: "SUMMON", player: "P1", handId: "h1", col: 0 });
    expect(after.players.P1.gold, "and nothing was paid").toBe(0);
    // The arming is spent by the summon it paid for.
    expect(canSummon(after, "P1", "h2", 1).ok, "back to broke").toBe(false);
  });

  it("Muster beats the OPENING cost cap too, not just the gold", () => {
    // The cap and the price are the same rule wearing two hats — both say "not
    // this early" — so a free summon that answered one and not the other could
    // not summon the thing you saved it for.
    const s = armed("spade");
    s.opening = { P1: 2, P2: 2 } as never;
    s.players.P1.hand = [
      { handId: "h1", defId: "leaf_alpha" },  // c4 — over the opening cap of 3
      { handId: "h2", defId: "leaf_nettle" }, // c1 — placeable anyway
    ];
    expect(canSummon(s, "P1", "h1", 0).ok, "over the cap, unarmed").toBe(false);
    const ready = applyIntent(s, { type: "HERO_POWER", player: "P1" });
    expect(canSummon(ready, "P1", "h1", 0).ok, "armed: the cap is a cost too").toBe(true);
  });

  it("...and is NOT spent on an opening placement that never needed it", () => {
    // Opening placement is already free, so a 1-drop costs the player nothing
    // to put down. Burning a once-per-game power on it would be the game
    // quietly robbing them.
    const s = armed("spade");
    s.opening = { P1: 2, P2: 2 } as never;
    s.players.P1.hand = [
      { handId: "h1", defId: "leaf_nettle" }, // c1 — under the cap
      { handId: "h2", defId: "leaf_alpha" },  // c4 — what it was saved for
    ];
    const ready = applyIntent(s, { type: "HERO_POWER", player: "P1" });
    const after = applyIntent(ready, { type: "SUMMON", player: "P1", handId: "h1", col: 0 });
    expect(after.players.P1.freeSummon, "still armed").toBe(true);
    expect(canSummon(after, "P1", "h2", 1).ok, "and still good for the big one").toBe(true);
  });

  it("Arcane Focus zeroes the next Special's cost", () => {
    const s = armed("heart");
    const caster = place(s, "aqua_sapphire", "P1", 3, 0);
    const cost = getDef("aqua_sapphire").special!.cost;
    expect(effectiveSpecialCost(s, s.cards[caster.instanceId], cost), "priced as normal").toBe(cost);
    const ready = applyIntent(s, { type: "HERO_POWER", player: "P1" });
    expect(effectiveSpecialCost(ready, ready.cards[caster.instanceId], cost), "free once armed").toBe(0);
  });

  it("does nothing at all when heroes are off", () => {
    // The same gate the curve obeys: a dealt suit must never hand a skirmish a
    // hero, and a power is the loudest possible way to break that.
    const s = prepState(7, "P1");
    s.seatSuits = { ...(s.seatSuits ?? {}), P1: "club" } as never;
    const ally = place(s, "leaf_nettle", "P1", 3, 0, { curShields: 0 });
    const next = applyIntent(s, { type: "HERO_POWER", player: "P1" });
    expect(next.cards[ally.instanceId].curShields).toBe(0);
    expect(next.players.P1.heroPowerUsed).toBeFalsy();
  });
});

// WHERE THE POWER LIVES. It spent a while as a full-width `lockin` button in
// the action bar beside Pass, which is the busiest strip on the screen and
// shared with the two controls you press every single turn — for an ability
// used ONCE in a whole match. It is free and once per game, which is the shape
// of a spell, so it moved into the spell tray.
//
// Source-level because `vite.config.ts` sets `environment: "node"` and there is
// no DOM to render App.tsx in. Same pattern as builder-foils / draft-wiring /
// levelup-wiring, and for the same reason: the bugs those catch were invisible
// to every unit test of the thing they guard.
describe("the hero power sits with the spells", () => {
  const ui = (f: string) =>
    readFileSync(join(__dirname, "..", "..", "ui", f), "utf8");

  it("is gone from the action bar", () => {
    // A second copy beside Pass is worse than either placement alone: two
    // controls that fire the same once-per-game ability, one of which goes
    // dead the moment the other is used.
    const APP = ui("App.tsx");
    expect(APP.includes("hero-btn"), "the old action-bar button").toBe(false);
    expect(ui("styles.css").includes(".hero-btn"), "and its now-dead rules").toBe(false);
  });

  it("reaches every tray, not just the one that happened to be on screen", () => {
    // App mounts the tray more than once — a vertical rail, a collapsed book,
    // a phone row. A `hero` prop passed to one of them is a power that exists
    // on desktop and not on a phone, which is the worst kind of missing.
    const APP = ui("App.tsx");
    const mounts = [...APP.matchAll(/<SpellTray\b/g)].length;
    expect(mounts, "SpellTray is mounted more than once").toBeGreaterThan(1);
    expect([...APP.matchAll(/hero=\{heroChip\}/g)].length,
      "every mount gets the hero").toBe(mounts);
  });

  it("hands the tray a chip only while there is one to spend", () => {
    // The three ways it must be absent: a mode with no heroes, an unseated
    // viewer, and a power already used. A permanently dead chip in the book is
    // worse than no chip.
    const APP = ui("App.tsx");
    const chip = APP.slice(APP.indexOf("const heroChip = ("), APP.indexOf("const heroChip = (") + 900);
    expect(chip, "modes without heroes").toContain("!game.heroes");
    expect(chip, "and a spectator").toContain("me === null");
    expect(chip, "and once it is spent").toContain("heroPowerUsed");
    expect(chip, "fires the real intent").toContain('type: "HERO_POWER"');
  });

  it("shows the tray for a deck that drafted no spells", () => {
    // The tray used to return null on an empty spellbook. With the power in it
    // that guard would hide the power too — and a draft can legitimately end
    // with a book the player never filled.
    const TRAY = ui("SpellTray.tsx");
    expect(TRAY).toMatch(/if \(\(!book \|\| book\.length === 0\) && !props\.hero\) return null/);
    // …which means every read AFTER that guard has to survive it being absent.
    // Bound once as `spells`, so a `book.map` below the guard is a real throw
    // on exactly the deck this change exists to serve.
    // Comments stripped first: this file explains itself at length, and a
    // scanner that reads prose finds `book.map` in the paragraph warning
    // against it. A test that passes on the comment is not a test.
    const code = TRAY.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const body = code.slice(code.indexOf("return null;"));
    expect(/\bbook\s*[.[]/.test(body),
      "an unguarded book read below the guard").toBe(false);
  });
});

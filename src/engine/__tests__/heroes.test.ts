// HEROES — one per suit, bound to the suit the seat is playing.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInitialState } from "../state";
import { advance } from "../phases";
import { HEROES, HERO_GOLD, HERO_MIN_ROUND, HERO_SHIELDS, cardPower } from "../heroes";
import { canFireSpecial, canSummon } from "../rules";
import { applyIntent } from "../phases";
import { CARDS, getDef } from "../../data/cards";
import { place, prepState } from "./helpers";
import { SUITS } from "../suits";
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

  it("has no economy curve at all — a hero is its POWER", () => {
    // The curves are GONE, and this is the guard that keeps them gone. Each
    // hero used to carry a `goldShift`/`magicShift`: an offset in rounds into
    // `poolGainForRound`, per suit. Two things killed it.
    //
    // It was invisible by construction. Nobody feels `poolGainForRound(round+1)`
    // — the shift is a number behind a number — so the half of the hero a
    // player could not see was the half that needed a paragraph to explain.
    //
    // And it was the half that MATTERED, which is worse. Removing the Mage's
    // one round of gold penalty moved it 46.3% -> 49.1%, while fixing its power
    // outright was worth +0.2 and +0.6. A hero whose hidden arithmetic outweighs
    // its visible ability is a hero nobody is really choosing.
    //
    // A field re-added here would be silently read by nothing, which is the
    // worst way for it to come back: this asserts the SHAPE, not a value.
    for (const suit of SUITS) {
      const h = HEROES[suit] as unknown as Record<string, unknown>;
      expect(h.goldShift, `${HEROES[suit].name} must carry no gold curve`).toBeUndefined();
      expect(h.magicShift, `${HEROES[suit].name} must carry no magic curve`).toBeUndefined();
    }
  });

  it("pays every seat the same income, hero or no hero", () => {
    // The rule the curves used to bend, now unconditional. Both seats earn the
    // printed curve whatever suit they wear and whether or not heroes are live
    // — so a dealt glyph can never move the economy.
    for (const heroes of [false, true]) {
      let s: GameState = createInitialState(99, "leaf_pyro", "bore_dusk");
      s.heroes = heroes;
      for (let i = 0; i < 4000 && s.round < 8; i++) {
        const n = advance(s); if (n === s) break; s = n;
      }
      expect(s.players.P1.gold, `gold, heroes=${heroes}`).toBe(s.players.P2.gold);
      expect(s.players.P1.magicPool, `magic, heroes=${heroes}`).toBe(s.players.P2.magicPool);
    }
  });
});

describe("heroes are OFF unless a mode turns them on", () => {
  // A suit is dealt to EVERY match — it is the seat's identity and the AI's
  // playstyle. A hero hands its owner a free once-per-game ability, and an
  // ordinary skirmish must not acquire one just because a glyph was dealt.
  it("a default match gives neither seat a power", () => {
    let s: GameState = createInitialState(99, "leaf_pyro", "bore_dusk");
    expect(s.seatSuits, "suits are still dealt").toBeTruthy();
    expect(s.heroes, "but heroes are not on").toBeFalsy();
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

  it("Requisition trades the WEAKEST cards for gold, and keeps the bomb", () => {
    // It used to take the two DEAREST, which asked the player to burn the
    // Mythic they were saving for — a once-per-game button whose best use was
    // usually not to press it. The card you were building toward survives now.
    const s = armed("diamond");
    s.players.P1.gold = 0;
    s.players.P1.hand = [
      { handId: "h1", defId: "leaf_nettle" },          // c1  — weakest, goes
      { handId: "h2", defId: "bore_bastion" },         // c8  — second, goes
      { handId: "h3", defId: "dusk_shadowhorsemen" },  // c10 — the bomb, kept
    ];
    const next = applyIntent(s, { type: "HERO_POWER", player: "P1" });
    expect(next.players.P1.gold).toBe(HERO_GOLD);
    expect(next.players.P1.hand.map((h) => h.handId), "the weakest two go")
      .toEqual(["h3"]);
  });

  it("measures weak by the stat budget, not by cost", () => {
    // The two are not the same thing — a card can be dear and under-statted,
    // which is exactly the card you want gone. If this ever sorts by cost
    // again, the identity line and the power part company.
    const s = armed("diamond");
    const hand = s.players.P1.hand = [
      { handId: "h1", defId: "dusk_shadowhorsemen" },
      { handId: "h2", defId: "bore_bastion" },
      { handId: "h3", defId: "leaf_nettle" },
    ];
    const next = applyIntent(s, { type: "HERO_POWER", player: "P1" });
    const kept = next.players.P1.hand.map((h) => getDef(h.defId));
    const gone = hand
      .filter((h) => !next.players.P1.hand.includes(h))
      .map((h) => getDef(h.defId));
    for (const k of kept)
      for (const g of gone)
        expect(cardPower(k), `${g.name} is not weaker than ${k.name}`)
          .toBeGreaterThanOrEqual(cardPower(g));
  });

  it("breaks a tie toward the dearer card", () => {
    // Same stats at a higher price is the worse card twice over. Constructed
    // rather than found in the set, so the rule is pinned even if no real pair
    // currently ties.
    const cheap = { ...getDef("leaf_nettle"), id: "t_cheap", cost: 1 };
    const dear = { ...cheap, id: "t_dear", cost: 6 };
    expect(cardPower(cheap), "the fixture must actually tie").toBe(cardPower(dear));
    expect(dear.cost).toBeGreaterThan(cheap.cost);
  });

  it("does not throw on a hand smaller than the discard", () => {
    // The late-game empty hand. `slice` is forgiving and the gold must still
    // arrive — a power that pays nothing because the hand was short would be
    // spent for free.
    for (const size of [0, 1]) {
      const s = armed("diamond");
      s.players.P1.gold = 0;
      s.players.P1.hand = [{ handId: "h1", defId: "leaf_nettle" }].slice(0, size);
      const next = applyIntent(s, { type: "HERO_POWER", player: "P1" });
      expect(next.players.P1.gold, `hand of ${size}`).toBe(HERO_GOLD);
      expect(next.players.P1.hand.length).toBe(0);
    }
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

  it("Arcane Focus fires an ally's Special in PREP, free and off cooldown", () => {
    // The whole power. It used to refund magic on the next few Specials, which
    // measured at ELEVEN POINTS WORSE than having no power at all — a discount
    // makes the seat cast more, and casting is what this game pays least for.
    // This buys an ACTION the game does not otherwise sell instead.
    const s = armed("heart");
    const caster = place(s, "aqua_sapphire", "P1", 3, 0);
    const victim = place(s, "leaf_nettle", "P2", 2, 0);
    s.cards[caster.instanceId].specialCooldown = 2;   // recharging…
    s.players.P1.magicPool = 0;                        // …and broke
    expect(canFireSpecial(s, caster.instanceId).ok, "cannot fire it normally").toBe(false);
    const hp = s.cards[victim.instanceId].curHp;
    const next = applyIntent(s, {
      type: "HERO_POWER", player: "P1", instanceId: caster.instanceId,
    });
    expect(next.cards[victim.instanceId].curHp, "the Special actually landed")
      .toBeLessThan(hp);
    expect(next.players.P1.magicPool, "and cost no magic").toBe(0);
    expect(next.players.P1.heroPowerUsed, "spent").toBe(true);
  });

  it("channels only YOUR OWN card, and refuses without spending itself", () => {
    // A once-per-game power eaten by a misclick is the worst outcome there is,
    // so an illegal channel hands the power back rather than resolving to
    // nothing. Three ways to be illegal: someone else's card, no card, and a
    // card with no Special to channel.
    const s = armed("heart");
    place(s, "aqua_sapphire", "P1", 3, 0);
    const theirs = place(s, "aqua_sapphire", "P2", 0, 0);
    const noSpecial = CARDS.find((c) => !c.boss && !c.special)!;
    const mine = place(s, noSpecial.id, "P1", 3, 1);
    for (const bad of [undefined, theirs.instanceId, mine.instanceId]) {
      const next = applyIntent(s, { type: "HERO_POWER", player: "P1", instanceId: bad });
      expect(next.players.P1.heroPowerUsed, `illegal channel: ${bad ?? "nothing"}`).toBeFalsy();
    }
  });

  it("does not waive cooldown for anything it did not channel", () => {
    // The old version armed a PLAYER-level counter that zeroed every Special's
    // cost until spent. This one touches exactly one card, once — so a second
    // body is no readier than it was.
    const s = armed("heart");
    const a = place(s, "aqua_sapphire", "P1", 3, 0);
    const b = place(s, "aqua_sapphire", "P1", 3, 1);
    place(s, "leaf_nettle", "P2", 2, 0);
    s.cards[b.instanceId].specialCooldown = 2;
    s.players.P1.magicPool = 99;
    const next = applyIntent(s, {
      type: "HERO_POWER", player: "P1", instanceId: a.instanceId,
    });
    expect(canFireSpecial(next, b.instanceId).reason, "the other one still recharges")
      .toMatch(/recharging/);
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

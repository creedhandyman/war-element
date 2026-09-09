// THE HERO YOU BUILT THE DECK UNDER SHOULD BE THE ONE YOU PLAY — ONLINE TOO.
//
// A suit is pinned per DECK in the builder, and every other mode honours it:
// the local start reads `fresh.heroes = !eventRun` and pins from `pinnedSuits`,
// and the rematch carries both forward. Online did neither.
//
// Two separate bugs, and the second hid the first. `createInitialState` deals
// `seatSuits` from the seed but never sets `heroes`, and `hostStartMatch` never
// set it either — so an online match ran with the flag OFF: no curve shift, no
// once-per-game power, the glyph on the board pure decoration. And even with
// the flag on, the host could only ever read its OWN pin (`resolveDeckSuit`
// looks in the local deck pool), so the guest's chosen hero was discarded.
//
// Source-level because `vite.config.ts` sets `environment: "node"`: there is no
// DOM, App.tsx is one enormous component, and the online path needs two live
// clients and a Supabase channel to exercise. Same pattern as the draft, foil
// and level-up wiring guards, and for the same reason — the bugs those catch
// are invisible to every unit test of the thing they guard.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInitialState } from "../state";
import { SUITS } from "../suits";
import { HEROES } from "../heroes";

const src = (...p: string[]) => readFileSync(join(__dirname, "..", "..", ...p), "utf8");
const APP = src("ui", "App.tsx");
const NET = src("net", "online.ts");
/** `hostStartMatch` alone — the online deal. */
const HOST = APP.slice(APP.indexOf("function hostStartMatch()"),
  APP.indexOf("function guestJoinRoom()"));

describe("the engine's own default", () => {
  it("leaves heroes OFF, which is why a mode has to say", () => {
    // The premise of every assertion below. If this ever starts defaulting to
    // true, the online path's explicit `g.heroes = true` becomes belt-and-
    // braces rather than the fix, and a skirmish silently grows heroes.
    const s = createInitialState(7);
    expect(s.heroes, "createInitialState must not turn heroes on").toBeFalsy();
    expect(s.seatSuits, "...but it does deal suits").toBeTruthy();
  });
});

describe("an online match runs its heroes", () => {
  it("turns them on when the host deals", () => {
    expect(/g\.heroes\s*=\s*true/.test(HOST),
      "hostStartMatch must set heroes — the engine will not").toBe(true);
  });

  it("pins the HOST's own chosen suit", () => {
    expect(HOST).toMatch(/pinSuit\([\s\S]{0,40}"P1",\s*hostSuit\)/);
  });

  it("pins every GUEST's, which is the half that could not work before", () => {
    // The host cannot look a guest's deck up — it is in that player's own
    // browser. The pin has to arrive on the join message or it does not arrive.
    expect(HOST).toMatch(/pinSuit\([\s\S]{0,40}e\.seat,\s*e\.suit\)/);
  });

  it("carries both into the REMATCH", () => {
    // `dealRematch` reads `s.heroes ?? false` and `s.suits`, so a setup missing
    // them turns the heroes off for game two of a set — the same bug the
    // offline rematch had and fixed.
    const setup = HOST.slice(HOST.indexOf("setupRef.current = {"));
    expect(setup, "heroes stay on for game two").toMatch(/heroes:\s*true/);
    expect(setup, "and so do the picks").toMatch(/suits:\s*pinned/);
  });

  it("leaves an unpinned seat on its dealt suit", () => {
    // Not everyone picks. The fallback has to be the dealt one — the same as
    // hot-seat — rather than a hardcoded default that would quietly hand every
    // undecided player the same hero.
    expect(HOST).toMatch(/if \(!e\.suit\) continue;/);
    expect(HOST).toMatch(/if \(hostSuit && g\.seatSuits\)/);
  });
});

describe("the wire carries the choice", () => {
  it("sends the suit on the join message", () => {
    expect(NET, "the payload").toMatch(/payload: \{ clientId, cards, spells, name, foils, ready, suit \}/);
    expect(NET, "and the handler reads it").toContain("payload.suit as Suit | undefined");
  });

  it("re-sends it when a player changes deck in the lobby", () => {
    // `announceMe` is the "this is my deck now" path. A lobby that let you swap
    // decks but not the hero attached to one would deal the old pick.
    const announce = APP.slice(APP.indexOf("function announceMe("),
      APP.indexOf("function announceMe(") + 700);
    expect(announce).toContain("deckNowRef.current.suit");
  });

  it("reads the suit from the same place as the cards", () => {
    // Two lookups of "which deck am I on" are two chances to disagree — the
    // reason `deckNowRef` exists at all. The suit rides in it.
    expect(APP).toMatch(/deckNowRef\.current = \{[\s\S]{0,300}suit: resolveDeckSuit\(mySeatDeckId\)/);
  });
});

describe("the lobby shows what everyone brought", () => {
  it("renders each seat's hero before the deal", () => {
    // A hero shifts its owner's economy and carries a once-per-game power, so
    // it is information you want while you can still change deck.
    expect(APP).toContain("lob-hero");
    expect(APP, "named, not just a glyph").toMatch(/HEROES\[row\.suit\]\.name/);
    expect(src("ui", "styles.css"), "and the class is styled").toContain(".lob-hero");
  });

  it("has a colour for every suit there is", () => {
    // A new suit would otherwise render an uncoloured chip that looks broken
    // only for whoever picked it.
    const CSS = src("ui", "styles.css");
    for (const s of SUITS)
      expect(CSS, `.lob-hero.suit-${s}`).toContain(`.lob-hero.suit-${s}`);
    expect(SUITS.every((s) => HEROES[s]), "every suit has a hero to name").toBe(true);
  });
});

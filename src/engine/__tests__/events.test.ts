// Guards the event decks the same way `premade-decks.test.ts` guards the shipped
// builds — an event deck is not in PREMADE_DECKS, so that suite does not see it
// and a card rename would break it silently — plus the one property the feature
// actually rests on: the reward is paid ONCE.

import { describe, expect, it } from "vitest";
import { CARD_INDEX, getDef } from "../../data/cards";
import { getSpell } from "../spells";
import { applyMulligan, createInitialState } from "../state";
import { deckLimits, isBuildable, maxSpellsFor, validateDeck, PREMADE_DECKS } from "../../data/custom-decks";
import { EVENTS, EVENT_DECKS, completeEvent, eventDone, eventForDeck, openEvents } from "../../data/events";
import {
  applyPack, canOpenPack, freePacks, newSave, openPack, packIsFree, PACK_COST, type StorySave,
} from "../../data/story";

const shards = (s: StorySave): number => s.hero?.shards ?? 0;
const withShards = (s: StorySave, n: number): StorySave =>
  ({ ...s, hero: { ...(s.hero ?? { name: "", affinity: "LEAF", spells: [], essence: {}, shards: 0, freePacks: 0, shiny: [] }), shards: n } });
/** A save whose starter pack has already been opened. A NEW campaign now ships
 *  with one free booster, so any test about the paid route, or about having
 *  nothing, has to say so rather than lean on the default. */
const spent = (s: StorySave): StorySave =>
  ({ ...s, hero: { ...s.hero!, freePacks: 0 } });

describe("event decks", () => {
  for (const event of EVENTS) {
    // From the EVENT's board, not the deck's — a `CustomDeck` has no board size
    // of its own, which is exactly why `GameEvent` carries one.
    const limits = deckLimits(event.boardSize);
    describe(`${event.name} (${event.boardSize}x${event.boardSize})`, () => {
      it("is a legal deck for its own board", () => {
        expect(validateDeck(event.deck.cards, event.boardSize)).toEqual({ ok: true });
        expect(event.deck.cards.length).toBe(limits.target);
      });

      it("references only real, buildable cards", () => {
        for (const id of event.deck.cards) {
          expect(CARD_INDEX[id], `unknown card "${id}" in ${event.name}`).toBeTruthy();
          expect(isBuildable(id), `"${id}" is not deck-eligible`).toBe(true);
        }
      });

      it("carries a full, real spellbook for its board", () => {
        const book = event.deck.spells ?? [];
        // The whole reason the book was refilled by hand: the deck code this was
        // imported from carried five, which is the STANDARD board's cap, and it
        // is fought on the large one.
        expect(book.length).toBe(maxSpellsFor(event.boardSize));
        for (const id of book) expect(getSpell(id), `unknown spell "${id}"`).toBeTruthy();
        expect(new Set(book).size, "no repeats").toBe(book.length);
      });

      it("is dressed in its OWN element, with art that exists", () => {
        // The bug a second event exposed: HomeScreen's loop renders every
        // event and had DUSK's sigil, map and rim hardcoded into it, so a
        // mono-DAWN deck was advertised as a DUSK one. Both halves are checked
        // — the element matches the deck, and the map is a real file (globbed
        // rather than fs-checked, for the reasons art.test.ts gives).
        const maps = new Set(
          Object.keys(import.meta.glob("../../../public/maps/*.webp"))
            .map((p) => `/maps/${p.split("/").pop()}`),
        );
        expect(maps.has(event.art), `${event.art} is not in public/maps`).toBe(true);
        const elements = new Set(event.deck.cards.map((id) => getDef(id).element));
        expect(elements.size, `${event.name} is meant to be mono-element`).toBe(1);
        expect(event.el, "the card wears the deck's element").toBe([...elements][0]);
      });

      it("pays a whole pack, not its price in shards", () => {
        expect(event.rewardPacks).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(event.rewardPacks)).toBe(true);
      });
    });
  }

  it("keeps event decks out of the premade pool", () => {
    // Two consequences if this ever stops being true: the deck becomes pickable
    // as an ordinary Arena opponent, and `againstPremade` starts paying win
    // shards for it on top of the pack.
    const premade = new Set(PREMADE_DECKS.map((d) => d.id));
    for (const d of EVENT_DECKS) expect(premade.has(d.id), `${d.id} leaked into PREMADE_DECKS`).toBe(false);
  });

  it("finds the event from the seat's deck id, and only that deck", () => {
    for (const e of EVENTS) expect(eventForDeck(e.deck.id)?.id).toBe(e.id);
    expect(eventForDeck("pre_inferno_blitz")).toBeUndefined();
  });

  it("has no duplicate ids", () => {
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
    expect(new Set(EVENT_DECKS.map((d) => d.id)).size).toBe(EVENT_DECKS.length);
  });
});

describe("a scripted opening", () => {
  const event = EVENTS.find((e) => e.scriptedOpening)!;
  const costs = (ids: string[]) => ids.map((id) => getDef(id).cost);
  const depth = event.scriptedOpening!;
  const start = () => createInitialState(
    12345, PREMADE_DECKS.find((d) => d.boardSize === event.boardSize)!.cards,
    event.deck.cards, ["P1"], undefined, event.deck.spells, event.boardSize,
    undefined, undefined, { P2: depth },
  );

  it("deals the scripted side its cheapest cards", () => {
    const hand = costs(start().players.P2.hand.map((h) => h.defId));
    // The point is that it can ACT on round one, when the pool affords exactly
    // a 1-cost. This deck holds four of them.
    expect(Math.min(...hand)).toBe(1);
    expect(hand.filter((c) => c === 1).length).toBeGreaterThanOrEqual(1);
  });

  it("hoists exactly the N cheapest, and no more", () => {
    const s = start();
    // The opening hand is drawn off the top, so the stacked head is split
    // between hand and deck — check them together, in draw order.
    const drawn = [...s.players.P2.hand.map((h) => h.defId), ...s.players.P2.deck];
    const head = costs(drawn.slice(0, depth));
    expect(head, "the head is ascending").toEqual([...head].sort((a, b) => a - b));
    const all = costs(event.deck.cards).sort((a, b) => a - b);
    expect(head, "and it is the cheapest N in the list").toEqual(all.slice(0, depth));
  });

  it("leaves the REST of the deck shuffled, not sorted", () => {
    // A whole-deck sort is a different thing and a measurably worse one for
    // already-cheap lists — this is an opening, not a scripted game.
    const tail = costs(start().players.P2.deck.slice(Math.max(0, depth - 5)));
    expect(tail).not.toEqual([...tail].sort((a, b) => a - b));
  });

  it("does NOT reorder the unscripted side", () => {
    // The ramp belongs to the boss. A player whose own deck was sorted would be
    // playing a different game, not a harder fight.
    const p1 = costs(start().players.P1.deck);
    expect(p1).not.toEqual([...p1].sort((a, b) => a - b));
  });

  it("survives a mulligan, which reshuffles", () => {
    // The bug this guards: stacking only at the deal was undone the moment the
    // AI tossed a card, because applyMulligan reshuffles the deck.
    const s = start();
    applyMulligan(s, "P2", s.players.P2.hand.slice(0, 2).map((h) => h.handId));
    const hand = costs(s.players.P2.hand.map((h) => h.defId));
    expect(Math.min(...hand), "still opens on something castable").toBe(1);
  });

  it("is off by default, so ordinary matches still shuffle", () => {
    const s = createInitialState(
      12345, event.deck.cards, event.deck.cards, ["P1"],
      undefined, undefined, event.boardSize,
    );
    expect(s.players.P2.stackCheapest).toBeFalsy();
    const d = costs(s.players.P2.deck);
    expect(d).not.toEqual([...d].sort((a, b) => a - b));
  });
});

describe("completing an event", () => {
  const event = EVENTS[0];

  it("is open on a fresh save and closed after a clear", () => {
    const save = newSave();
    expect(eventDone(save, event.id)).toBe(false);
    expect(openEvents(save).map((e) => e.id)).toContain(event.id);

    const done = completeEvent(save, event.id);
    expect(eventDone(done, event.id)).toBe(true);
    expect(openEvents(done).map((e) => e.id)).not.toContain(event.id);
  });

  it("pays a free pack on the first clear, and not shards", () => {
    const save = newSave();
    const done = completeEvent(save, event.id);
    expect(freePacks(done)).toBe(freePacks(save) + event.rewardPacks);
    // The point of the change: the reward must not arrive as spendable
    // currency, which could go to the crafter or just discount the next pack.
    expect(shards(done)).toBe(shards(save));
  });

  it("makes a pack openable on a save that could not afford one", () => {
    const broke = spent(withShards(newSave(), 0));
    expect(canOpenPack(broke)).toBe(false);
    const done = completeEvent(broke, event.id);
    expect(canOpenPack(done)).toBe(true);
    expect(packIsFree(done)).toBe(true);
  });

  it("spends the free pack, not the shards, and only once", () => {
    // The ordering rule in `applyPack`: holding both, the free one goes first,
    // or the gift waits until you are broke and your balance drains instead.
    // Starter pack already opened, so the ONE free pack here is the reward.
    const rich = withShards(completeEvent(spent(newSave()), event.id), 100);
    expect(packIsFree(rich)).toBe(true);

    const after = applyPack(rich, openPack(rich, () => 0.5));
    expect(shards(after), "shards untouched").toBe(100);
    expect(freePacks(after), "the free pack is consumed").toBe(freePacks(rich) - 1);

    // The next one is paid for normally.
    expect(packIsFree(after)).toBe(false);
    const paid = applyPack(after, openPack(after, () => 0.5));
    expect(shards(paid)).toBe(100 - PACK_COST);
    expect(freePacks(paid)).toBe(freePacks(after));
  });

  it("cannot pay twice — a replayed settle is a no-op", () => {
    // The property the whole design rests on. A refresh, a double render or a
    // re-entered effect must not mint a second pack, so the second call has to
    // return the SAME OBJECT — that identity is what the caller's
    // `next !== prev` guard uses to skip the write.
    const first = completeEvent(newSave(), event.id);
    const second = completeEvent(first, event.id);
    expect(second).toBe(first);
    expect(freePacks(second)).toBe(freePacks(first));

    // And it stays a no-op however many times it is replayed.
    let s = first;
    for (let i = 0; i < 5; i++) s = completeEvent(s, event.id);
    expect(freePacks(s)).toBe(freePacks(first));
    expect(s.eventsDone).toEqual([event.id]);
  });

  it("ignores an unknown event id rather than banking a flag for it", () => {
    const save = newSave();
    const next = completeEvent(save, "ev_not_a_thing");
    expect(next).toBe(save);
    expect(next.eventsDone ?? []).not.toContain("ev_not_a_thing");
  });

  it("mints a hero when the save has none, instead of dropping the payment", () => {
    const save: StorySave = { ...newSave(), hero: undefined };
    const next = completeEvent(save, event.id);
    expect(next.hero).toBeTruthy();
    // The minted hero is a NEW one, so it carries the starter booster as well
    // as the reward. A save old enough to predate heroes getting the opening
    // pack is a small gift, not a bug.
    expect(freePacks(next)).toBe(1 + event.rewardPacks);
  });
});

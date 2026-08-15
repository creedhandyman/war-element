// Guards the event decks the same way `premade-decks.test.ts` guards the shipped
// builds — an event deck is not in PREMADE_DECKS, so that suite does not see it
// and a card rename would break it silently — plus the one property the feature
// actually rests on: the reward is paid ONCE.

import { describe, expect, it } from "vitest";
import { CARD_INDEX } from "../../data/cards";
import { getSpell } from "../spells";
import { deckLimits, isBuildable, maxSpellsFor, validateDeck, PREMADE_DECKS } from "../../data/custom-decks";
import { EVENTS, EVENT_DECKS, completeEvent, eventDone, eventForDeck, openEvents } from "../../data/events";
import { newSave, PACK_COST, type StorySave } from "../../data/story";

const shards = (s: StorySave): number => s.hero?.shards ?? 0;

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

      it("pays exactly one pack", () => {
        expect(event.reward).toBe(PACK_COST);
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

  it("pays the reward on the first clear", () => {
    const save = newSave();
    expect(shards(completeEvent(save, event.id))).toBe(shards(save) + event.reward);
  });

  it("cannot pay twice — a replayed settle is a no-op", () => {
    // The property the whole design rests on. A refresh, a double render or a
    // re-entered effect must not mint a second pack, so the second call has to
    // return the SAME OBJECT — that identity is what the caller's
    // `next !== prev` guard uses to skip the write.
    const first = completeEvent(newSave(), event.id);
    const second = completeEvent(first, event.id);
    expect(second).toBe(first);
    expect(shards(second)).toBe(shards(first));

    // And it stays a no-op however many times it is replayed.
    let s = first;
    for (let i = 0; i < 5; i++) s = completeEvent(s, event.id);
    expect(shards(s)).toBe(shards(first));
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
    expect(shards(next)).toBe(event.reward);
  });
});

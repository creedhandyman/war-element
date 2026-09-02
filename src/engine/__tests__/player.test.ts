// PLAYER LEVEL and the boss-head trophies.
import { describe, expect, it } from "vitest";
import { VOID_BOSSES, trialEventId } from "../../data/void-tower";
import { activeAvatar, avatarArt, bossesBeaten, earnedAvatars, ownsAvatar, playerLevel } from "../../data/player";
import { newSave, newHero, type StorySave } from "../../data/story";

const save = (over: Partial<StorySave> = {}): StorySave => ({ ...newSave(), ...over });
const beat = (...ids: string[]) => ids.map(trialEventId);

describe("player level", () => {
  it("is cards collected plus bosses beaten", () => {
    const s = save({ collection: ["leaf_oak", "leaf_weeds", "leaf_birch"], eventsDone: [] });
    expect(playerLevel(s)).toBe(3);
    const withBoss = { ...s, eventsDone: beat(VOID_BOSSES[0].cardId, VOID_BOSSES[1].cardId) };
    expect(playerLevel(withBoss), "two bosses, two levels").toBe(5);
  });

  it("counts a card once however many copies are owned", () => {
    // The collection is a list, not a set — duplicates are real there.
    expect(playerLevel(save({ collection: ["leaf_oak", "leaf_oak", "leaf_oak"] }))).toBe(1);
  });

  it("is zero on a save that has done nothing", () => {
    expect(playerLevel(save({ collection: [], eventsDone: [] }))).toBe(0);
  });
});

describe("boss heads are earned, not set", () => {
  it("offers exactly the bosses beaten, in floor order", () => {
    const s = save({ eventsDone: beat(VOID_BOSSES[2].cardId, VOID_BOSSES[0].cardId) });
    expect(earnedAvatars(s)).toEqual([VOID_BOSSES[0].cardId, VOID_BOSSES[2].cardId]);
    expect(bossesBeaten(s)).toEqual(earnedAvatars(s));
  });

  it("REFUSES a head the save never took, however the save says otherwise", () => {
    // The whole point of the cosmetic is that it cannot be arrived at any other
    // way, so a hand-edited localStorage must not grant one. Ownership is
    // re-checked at the point of USE rather than trusted from disk.
    const cheat = save({
      eventsDone: [],
      hero: { ...newHero(), avatar: VOID_BOSSES[0].cardId },
    });
    expect(ownsAvatar(cheat, VOID_BOSSES[0].cardId)).toBe(false);
    expect(activeAvatar(cheat), "falls back to the initial").toBeUndefined();
  });

  it("wears one that WAS earned", () => {
    const id = VOID_BOSSES[0].cardId;
    const s = save({ eventsDone: beat(id), hero: { ...newHero(), avatar: id } });
    expect(activeAvatar(s)).toBe(id);
    expect(avatarArt(id)).toBe(`/cards/${id}.webp`);
  });

  it("every boss's head has art on disk to wear", () => {
    // A trophy that renders as a broken image is worse than no trophy.
    for (const b of VOID_BOSSES) expect(avatarArt(b.cardId)).toMatch(/^\/cards\/.+\.webp$/);
  });
});

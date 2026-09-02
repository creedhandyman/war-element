// PLAYER LEVEL and the boss-head trophies.
import { describe, expect, it } from "vitest";
import { VOID_BOSSES, trialEventId } from "../../data/void-tower";
import { AVATAR_FOCUS, activeAvatar, avatarArt, avatarStyle, bossesBeaten, earnedAvatars, ownsAvatar, playerLevel } from "../../data/player";
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

describe("boss heads are framed on the head", () => {
  it("every boss has a focal point, and it is not the default", () => {
    // The first cut used ONE crop rule for twenty paintings. Basilisk's head is
    // 56% down its plate and Thunderfangs is 26% across; a single rule showed
    // swamp canopy and empty sky. Each of these was read off a crosshair
    // rendered over the art, so a boss shipping without one is a boss framed by
    // a guess.
    for (const b of VOID_BOSSES) {
      const f = AVATAR_FOCUS[b.cardId];
      expect(f, `${b.cardId} has no focal point`).toBeTruthy();
      expect(f.x, `${b.cardId} x`).toBeGreaterThan(0);
      expect(f.x, `${b.cardId} x`).toBeLessThan(100);
      expect(f.y, `${b.cardId} y`).toBeGreaterThan(0);
      expect(f.y, `${b.cardId} y`).toBeLessThan(100);
      // Below 100% the art would be SMALLER than the frame and tile.
      expect(f.zoom, `${b.cardId} zoom`).toBeGreaterThan(100);
    }
  });

  it("they are genuinely different — a shared table would mean a shared guess", () => {
    const pts = VOID_BOSSES.map((b) => `${AVATAR_FOCUS[b.cardId].x},${AVATAR_FOCUS[b.cardId].y}`);
    expect(new Set(pts).size, "distinct focal points").toBeGreaterThan(VOID_BOSSES.length * 0.8);
  });

  it("avatarStyle frames a head from its focal point", () => {
    const st = avatarStyle("boss_basilisk");
    const f = AVATAR_FOCUS.boss_basilisk;
    expect(st.backgroundPosition).toBe(`${f.x}% ${f.y}%`);
    expect(st.backgroundSize).toBe(`${f.zoom}% auto`);
    expect(st.backgroundImage).toContain("boss_basilisk.webp");
  });
});

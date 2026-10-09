// PLAYER LEVEL and the boss-head trophies.
import { describe, expect, it } from "vitest";
import { VOID_BOSSES, trialEventId } from "../../data/void-tower";
import { AVATAR_FOCUS, PLATE_ASPECT, activeAvatar, avatarArt, avatarStyle, bossesBeaten, earnedAvatars, ownsAvatar, playerLevel } from "../../data/player";
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

  it("Kato wears his Prowlform: the first form is a vehicle with no head to frame", () => {
    expect(avatarArt("boss_kato")).toBe("/cards/boss_kato_2.webp");
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
    expect(st.backgroundSize).toBe(`${f.zoom}% auto`);
    expect(st.backgroundImage).toContain("boss_basilisk.webp");
  });

  it("puts the recorded head in the MIDDLE of the frame, not merely near it", () => {
    // background-position is not 'the point to centre': y% lines the point y% down
    // the image up with the point y% down the FRAME, so storing the head's
    // coordinates there left every head off-centre and several on a chest.
    // Where the head lands in the frame is  pos*(1 - size) + at*size  (frame = 1).
    for (const [id, f] of Object.entries(AVATAR_FOCUS)) {
      const st = avatarStyle(id);
      const [px] = st.backgroundPosition.split(" ").map((n) => parseFloat(n) / 100);
      const wide = f.zoom / 100;
      const landsAt = px * (1 - wide) + (f.x / 100) * wide;
      expect(landsAt, `${id} horizontal`).toBeCloseTo(0.5, 1);
    }
  });

  it("knows each plate's real shape, so a repainted boss still centres on its head", () => {
    // Vertical centring needs the plate's height over width. It is typed in by
    // hand (PLATE_ASPECT), so swapping in a painting of another shape (the 2:3
    // repaints of 2026-10-08) would frame the head too high or too low without
    // a sound. Read the real size out of each WebP header instead.
    const plates = import.meta.glob("../../../public/cards/boss_*.webp", { eager: true, query: "?inline", import: "default" }) as Record<string, string>;
    const size = (dataUrl: string) => {
      const b = Uint8Array.from(atob(dataUrl.split(",")[1].slice(0, 64)), (c) => c.charCodeAt(0));
      const kind = String.fromCharCode(...b.slice(12, 16));
      if (kind === "VP8X") return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
      if (kind === "VP8L") return { w: 1 + (((b[22] & 0x3f) << 8) | b[21]), h: 1 + (((b[24] & 0xf) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)) };
      return { w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff };
    };
    expect(Object.keys(plates).length, "found the boss plates").toBeGreaterThan(10);
    for (const b of VOID_BOSSES) {
      const name = avatarArt(b.cardId).split("/").pop()!;
      const file = Object.keys(plates).find((k) => k.endsWith(`/${name}`));
      expect(file, `${b.cardId} plate`).toBeTruthy();
      const { w, h } = size(plates[file!]);
      expect(PLATE_ASPECT[b.cardId] ?? 4 / 3, `${b.cardId} is ${w}x${h}`).toBeCloseTo(h / w, 2);
    }
  });
});

// THE LEVELS THEY ALREADY EARNED.
//
// The level-up popup shipped owing nothing for the past: a save that predated
// it started counting from wherever it stood, and a save that had loaded ONCE
// since had its mark stamped at the level it was on — which locked those
// players out permanently. Both groups did the levelling and neither was paid.
//
// `retro-levels-1` rewinds the mark, once, through the same GIFTS ledger the
// Continental taming uses. The ordinary popup then does the paying, so the
// player is SHOWN what they earned and `claimLevelUp` stays the only thing that
// ever moves the mark.
import { describe, expect, it } from "vitest";
import {
  RETRO_LEVEL_FLOOR, claimLevelUp, levelRewards, pendingLevelUp, rewindLevelSeen, seenLevel,
} from "../../data/levels";
import { GIFTS, applyGifts, newSave, type StorySave } from "../../data/story";
import { CARDS } from "../../data/cards";
import { playerLevel } from "../../data/player";

/** A save sitting at `n` levels, with the mark wherever `levelSeen` says. */
function atLevel(n: number, extra: Partial<StorySave> = {}): StorySave {
  const ids = CARDS.filter((c) => !c.boss).slice(0, n).map((c) => c.id);
  return { ...newSave(), collection: ids, ...extra };
}

describe("the rewind itself", () => {
  it("hands back every level above the floor", () => {
    const settled = atLevel(30, { levelSeen: 30 });
    expect(pendingLevelUp(settled), "square before").toBeNull();
    const owed = pendingLevelUp(rewindLevelSeen(settled))!;
    expect(owed.from).toBe(RETRO_LEVEL_FLOOR);
    expect(owed.to).toBe(playerLevel(settled));
    expect(owed.levels).toBe(playerLevel(settled) - RETRO_LEVEL_FLOOR);
  });

  it("starts at 1, because the starter card is a gift", () => {
    // Paying from 0 would hand every player two shards for being given a card.
    expect(RETRO_LEVEL_FLOOR).toBe(1);
    expect(playerLevel(newSave()), "a new save is level 1 off its starter").toBe(1);
  });

  it("is a no-op on a save that is already at the floor", () => {
    // A brand-new player must not be shown a popup that pays nothing.
    const fresh: StorySave = { ...newSave(), levelSeen: 1 };
    expect(rewindLevelSeen(fresh)).toBe(fresh);
    expect(pendingLevelUp(rewindLevelSeen(fresh))).toBeNull();
  });

  it("pays what the ordinary ladder says, not a special rate", () => {
    // No second payment path: the rewind only moves the mark, and the popup
    // prices the span exactly as it prices any other.
    const save = rewindLevelSeen(atLevel(20, { levelSeen: 20 }));
    const owed = pendingLevelUp(save)!;
    expect(owed.shards).toBe(levelRewards(RETRO_LEVEL_FLOOR, playerLevel(save)).shards);
    const paid = claimLevelUp(save);
    expect(paid.hero?.shards ?? 0).toBeGreaterThan(save.hero?.shards ?? 0);
    expect(pendingLevelUp(paid), "and it is square afterwards").toBeNull();
  });
});

describe("delivered once, through the gift ledger", () => {
  it("is registered as a gift", () => {
    expect(GIFTS.map((g) => g.id)).toContain("retro-levels-1");
  });

  it("fires for a save that was already settled, then never again", () => {
    // The players this exists for: their mark was stamped at their own level
    // the first time they loaded after the popup shipped.
    const settled = atLevel(30, { levelSeen: 30, gifts: [] });
    const first = applyGifts(settled);
    expect(first.granted).toContain("retro-levels-1");
    expect(pendingLevelUp(first.save), "now owed").not.toBeNull();

    const paid = claimLevelUp(first.save);
    const again = applyGifts(paid);
    expect(again.granted, "the ledger closes it").not.toContain("retro-levels-1");
    expect(pendingLevelUp(again.save), "and it cannot be claimed twice").toBeNull();
  });

  it("never fires for a NEW save, which carries every gift from birth", () => {
    // A new player missed nothing, so there is nothing to compensate.
    const fresh = newSave();
    const out = applyGifts({ ...fresh, gifts: GIFTS.map((g) => g.id) });
    expect(out.granted).toEqual([]);
    expect(pendingLevelUp(out.save)).toBeNull();
  });

  it("leaves a save that predates the popup owed from the floor too", () => {
    // The other group: no mark at all. `seenLevel` reads absent as the current
    // level, so without the rewind this save is silently square.
    const old = atLevel(25, { gifts: [] });
    expect(old.levelSeen, "no mark").toBeUndefined();
    expect(seenLevel(old), "absent reads as current").toBe(playerLevel(old));
    const out = applyGifts(old);
    expect(pendingLevelUp(out.save)?.from).toBe(RETRO_LEVEL_FLOOR);
  });
});

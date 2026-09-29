import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { applyStatus, SPECIAL_HANDLERS } from "../combat";
import { advance } from "../phases";
import { canFireSpecial } from "../rules";
import { atCleanup, place, prepState, statusOf } from "./helpers";

// Lacing Knots (Tether): 9 DMG with PEN to every opponent its Magic Ropes are
// holding (owner's call; was 8, no PEN). The handler used to hard-code
// `pen: false`, so a PEN param on the card would have done nothing.

describe("Lacing Knots", () => {
  it("cuts straight through shields on a bound opponent", () => {
    const s = prepState();
    const tether = place(s, "dawn_ty", "P1", 3, 1);
    const bound = place(s, "pyro_flamehound", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 5 }); // not DUSK: DAWN hits DUSK 25% harder
    applyStatus(s, s.cards[bound.instanceId], "MUTED", 1, 0, "DAWN");
    SPECIAL_HANDLERS.lacingKnots(s, s.cards[tether.instanceId], [], getDef("dawn_ty").special!.params!);
    expect(40 - s.cards[bound.instanceId].curHp, "9, none of it stopped").toBe(9);
    expect(s.cards[bound.instanceId].curShields, "and no shield stripped").toBe(5);
  });

  it("leaves an opponent the ropes are not holding alone", () => {
    const s = prepState();
    const tether = place(s, "dawn_ty", "P1", 3, 1);
    const free = place(s, "pyro_flamehound", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    SPECIAL_HANDLERS.lacingKnots(s, s.cards[tether.instanceId], [], getDef("dawn_ty").special!.params!);
    expect(s.cards[free.instanceId].curHp).toBe(40);
  });

  it("reads the MUTED status, whoever applied it", () => {
    const s = prepState();
    const tether = place(s, "dawn_ty", "P1", 3, 1);
    const muted = place(s, "pyro_flamehound", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    applyStatus(s, s.cards[muted.instanceId], "MUTED", 2, 0, "BOLT");
    SPECIAL_HANDLERS.lacingKnots(s, s.cards[tether.instanceId], [], getDef("dawn_ty").special!.params!);
    expect(s.cards[muted.instanceId].curHp).toBe(31);
  });
});

// Magic Ropes MUTES (owner's call, 2026-09-28) — a real status rather than the
// hidden special-lock counter it used to set.
describe("Magic Ropes", () => {
  it("MUTES two in-range opponents at Cleanup, and they cannot cast next round", () => {
    const s = prepState();
    place(s, "dawn_ty", "P1", 3, 1);
    const a = place(s, "pyro_sarra", "P2", 1, 1, { curHp: 40, maxHp: 40 });
    const b = place(s, "pyro_fenix", "P2", 1, 2, { curHp: 40, maxHp: 40 });
    const next = advance(atCleanup(s));
    for (const f of [a, b]) {
      expect(statusOf(next.cards[f.instanceId], "MUTED"), f.defId).toBeTruthy();
      expect(next.cards[f.instanceId].specialLockedRounds ?? 0, "no hidden counter").toBe(0);
      expect(canFireSpecial(next, f.instanceId).reason).toBe("MUTED");
    }
  });

  it("reaches for someone not already muted before re-tying the same rope", () => {
    const s = prepState();
    place(s, "dawn_ty", "P1", 3, 1);
    const tied = [0, 1].map((c) => place(s, "pyro_flamehound", "P2", 1, c, { curHp: 40, maxHp: 40 }));
    for (const t of tied) applyStatus(s, s.cards[t.instanceId], "MUTED", 3, 0, "BOLT");
    const loose = place(s, "pyro_staph", "P2", 1, 2, { curHp: 40, maxHp: 40 });
    const next = advance(atCleanup(s));
    expect(statusOf(next.cards[loose.instanceId], "MUTED")).toBeTruthy();
  });

  it("the card says MUTE", () => {
    expect(getDef("dawn_ty").special!.text).toContain("MUTED");
  });
});

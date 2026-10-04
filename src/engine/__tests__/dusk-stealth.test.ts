// Reaper, Silkstalker, Ender and Hoax carry the STEALTH keyword (owner,
// 2026-10-04): untargetable each round until they attack.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { canTarget, isStealthed } from "../rules";
import { place, prepState } from "./helpers";

describe("the four DUSK stalkers", () => {
  for (const id of ["dusk_reaper", "dusk_silkstalker", "dusk_ender", "dusk_hoax"]) {
    it(`${id} starts hidden and shows itself by attacking`, () => {
      const s = prepState();
      const hunter = place(s, "aqua_glacius", "P1", 3, 1); // ranged, reaches row 2
      const sneak = place(s, id, "P2", 2, 1);
      expect(getDef(id).keywords.STEALTH).toBe(true);
      expect(isStealthed(getDef(id), sneak)).toBe(true);
      expect(canTarget(s, hunter, sneak, true), "can't be picked while hidden").toBe(false);
      sneak.attackedThisRound = true;
      expect(canTarget(s, hunter, sneak, true), "attacking gives it away").toBe(true);
    });
  }
});

describe("Hoax", () => {
  it("is Unpredictable instead of evasive (owner, 2026-10-04)", () => {
    const d = getDef("dusk_hoax");
    expect(d.keywords.EVASION).toBeFalsy();
    expect(d.evadeVsSlower).toBe(true);
    expect(d.passiveNames?.evadeVsSlower).toBe("Unpredictable");
  });
});

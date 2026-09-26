// Two card touch-ups (owner, 2026-09):
//   · Rodd gets Arc back — at 1 DMG to the closest opponent, end of round (it
//     was 2 when it was cut for making Rodd the strongest card in the set).
//   · Sunstalker's Second Sunrise hides it for 1 round, not 2, and the copy no
//     longer says "Tail Drop" — both death-save carriers name the passive
//     themselves, and one of them is a winged panther.
import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import { defeatCard } from "../combat";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import { describePassives } from "../../ui/card-text";
import { atCleanup, place, prepState, statusOf } from "./helpers";

describe("Rodd — Arc", () => {
  it("is a 1-DMG end-of-round poke named Arc, beside Conduction", () => {
    const rodd = getDef("bolt_rodd");
    expect(rodd.roundTick?.pokeDmg).toBe(1);
    expect(rodd.passiveNames).toMatchObject({ aura: "Conduction", roundTick: "Arc" });
    expect(describePassives(rodd).join(" | ")).toContain("Arc — Each round: 1 DMG to the closest opponent.");
  });

  it("hits the CLOSEST opponent for 1 at Cleanup, and only that one", () => {
    const s = prepState();
    place(s, "bolt_rodd", "P1", 3, 0);
    const near = place(s, "bore_clubber", "P2", 1, 0, { curHp: 10, maxHp: 10, curShields: 0 });
    const far = place(s, "bore_clubber", "P2", 0, 3, { curHp: 10, maxHp: 10, curShields: 0 });
    const next = advance(atCleanup(s));
    expect(next.cards[near.instanceId].curHp, "the closest takes the Arc").toBe(9);
    expect(next.cards[far.instanceId].curHp, "the other is untouched").toBe(10);
  });
});

describe("Sunstalker — Second Sunrise", () => {
  it("hides it for 1 round, with REGEN 3 for 3", () => {
    expect(getDef("dawn_meridian").deathSave).toEqual({ stealth: 1, regen: { power: 3, rounds: 3 } });
  });

  it("leaves it at 1 HP, hidden this round only, and says so by name", () => {
    const s = prepState();
    const cat = place(s, "dawn_meridian", "P1", 3, 1);
    expect(defeatCard(s, s.cards[cat.instanceId], "test"), "it does not die").toBe(false);
    const after = s.cards[cat.instanceId];
    expect(after.curHp).toBe(1);
    expect(statusOf(after, "STEALTH")?.duration).toBe(1);
    expect(after.regenPower).toBe(3);
    expect(after.regenRoundsLeft).toBe(3);
    expect(s.log.join("\n")).toContain("Second Sunrise — it slips away at 1 HP!");
    expect(s.log.join("\n"), "no tail on a panther").not.toMatch(/tail/i);
  });

  it("reads as its own passive — no \"Tail Drop\" on any card's copy", () => {
    const text = describePassives(getDef("dawn_meridian")).join(" | ");
    expect(text).toContain(
      "Second Sunrise — The first lethal hit leaves it at 1 HP with STEALTH 1 round and REGEN 3 for 3 rounds. Once per game.",
    );
    for (const def of [...CARDS, ...TOKENS])
      expect(describePassives(def).join(" | "), def.id).not.toContain("Tail Drop");
  });
});

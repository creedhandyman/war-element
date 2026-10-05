// ONE STEALTH (owner, 2026-10-04: "the stealth should all be the same as the
// keyword to avoid confusion"). A granted, timed STEALTH now follows the
// keyword's rule while it lasts: hidden each round until the card attacks,
// in the open for the rest of that round, hidden again the next.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { describePassives } from "../../ui/card-text";
import { applyStatus } from "../combat";
import { advance, applyIntent } from "../phases";
import { isStealthed } from "../rules";
import { atCleanup, place, prepState } from "./helpers";

describe("a granted STEALTH works like the keyword", () => {
  it("hides until the card attacks, then hides again next round", () => {
    const s = prepState();
    const me = place(s, "dusk_gool", "P1", 2, 1);
    const foe = place(s, "leaf_oak", "P2", 1, 1, { curHp: 40, maxHp: 40 });
    applyStatus(s, me, "STEALTH", 3, 0, "DUSK");
    expect(isStealthed(getDef(me.defId), me)).toBe(true);
    s.phase = "battle"; s.prep = null;
    s.battle = { queue: [me.instanceId], index: 0, awaitingInput: me.instanceId };
    const g = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "basic", targetId: foe.instanceId });
    const after = g.cards[me.instanceId];
    expect(after.statuses.some((x) => x.kind === "STEALTH"), "the status is still there").toBe(true);
    expect(isStealthed(getDef(after.defId), after), "but the attack put it in the open").toBe(false);
    const next = advance(atCleanup(g));
    const later = next.cards[me.instanceId];
    expect(later.statuses.some((x) => x.kind === "STEALTH"), "3 rounds: still cloaked").toBe(true);
    expect(isStealthed(getDef(later.defId), later), "hidden again next round").toBe(true);
  });

  it("a cloak granted after the attack (a kill, a vanish) hides it at once", () => {
    const s = prepState();
    const me = place(s, "dusk_gool", "P1", 2, 1);
    me.attackedThisRound = true;
    applyStatus(s, me, "STEALTH", 1, 0, "DUSK");
    expect(isStealthed(getDef(me.defId), me)).toBe(true);
  });
});

describe("Frostveil says what Icy Mist does", () => {
  it("names the STEALTH and the extra round per kill", () => {
    const text = describePassives(getDef("aqua_icyninza")).join(" ");
    expect(text).toMatch(/STEALTH for 1 round/);
    expect(text).toMatch(/\+1 round for each kill/);
  });
});

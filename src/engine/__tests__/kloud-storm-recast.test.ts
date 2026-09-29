// Kloud's Twisted Rage cast while its storm still stands (owner's call,
// 2026-09-27). It used to be a wasted cast ("its brood is already at full
// strength"); now the standing storm re-forms: its arrival burst breaks over the
// board again and it heals 6.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { SPECIAL_HANDLERS } from "../combat";
import { applyIntent } from "../phases";
import { canFireSpecial } from "../rules";
import { boardCards, cardAt } from "../state";
import { place, prepState, statusOf } from "./helpers";
import type { GameState } from "../types";

const STORM = "gale_thundering_hurricane_tok";

/** Kloud's turn, with magic to spend and the Special off cooldown. */
function kloudUp(s: GameState, kloudId: string) {
  s.phase = "battle";
  s.prep = null;
  s.players.P1.magicPool = 20;
  s.cards[kloudId].specialCooldown = 0;
  s.battle = { queue: [kloudId], index: 0, awaitingInput: kloudId };
  return s;
}
const cast = (s: GameState, kloudId: string) =>
  applyIntent(kloudUp(s, kloudId), { type: "BATTLE_ACTION", player: "P1", action: "special" } as never);
const storms = (s: GameState) => boardCards(s, "P1").filter((c) => c.defId === STORM && c.curHp > 0);

/** A free square within 2 of `at` that is not on P1's home row (row 3). */
function nearFree(s: GameState, at: { row: number; col: number }) {
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < s.boardSize; c++)
      if (Math.max(Math.abs(r - at.row), Math.abs(c - at.col)) === 2 && !cardAt(s, r, c)) return { row: r, col: c };
  throw new Error("no free square near the storm");
}

describe("Twisted Rage, cast again while the storm stands", () => {
  it("re-forms the storm: the burst breaks again and it heals 6, and still only one storm", () => {
    let s = prepState();
    const kloud = place(s, "gale_kloud", "P1", 3, 1);
    s = cast(s, kloud.instanceId);
    const [storm] = storms(s);
    expect(storm, "the first cast raises it").toBeTruthy();

    // Wound it, and stand a fresh opponent within the burst's reach.
    s.cards[storm.instanceId].curHp = s.cards[storm.instanceId].maxHp - 10;
    const hurt = s.cards[storm.instanceId].curHp;
    const at = nearFree(s, storm.pos!);
    const foe = place(s, "leaf_alpha", "P2", at.row, at.col, { curHp: 40, maxHp: 40, curShields: 0 });

    const n = cast(s, kloud.instanceId);
    expect(storms(n), "still one storm").toHaveLength(1);
    expect(n.cards[storm.instanceId].curHp, "healed 6").toBe(hurt + 6);
    expect(n.cards[foe.instanceId].curHp, "the burst hit it for 8").toBe(32);
    expect(statusOf(n.cards[foe.instanceId], "PARALYZE"), "and holds it").toBeTruthy();
    expect(n.log.some((l) => /re-forms/.test(l))).toBe(true);
    expect(n.log.some((l) => /already at full strength/.test(l)), "no wasted cast").toBe(false);
  });

  it("the heal does not go past the storm's max HP", () => {
    let s = prepState();
    const kloud = place(s, "gale_kloud", "P1", 3, 1);
    s = cast(s, kloud.instanceId);
    const [storm] = storms(s);
    const max = s.cards[storm.instanceId].maxHp;
    s.cards[storm.instanceId].curHp = max - 2;
    const n = cast(s, kloud.instanceId);
    expect(n.cards[storm.instanceId].curHp).toBe(max);
  });

  it("with the storm gone, the cast raises a new one as before", () => {
    let s = prepState();
    const kloud = place(s, "gale_kloud", "P1", 3, 1);
    s = cast(s, kloud.instanceId);
    const [storm] = storms(s);
    delete s.cards[storm.instanceId];
    const n = cast(s, kloud.instanceId);
    expect(storms(n)).toHaveLength(1);
    expect(storms(n)[0].instanceId).not.toBe(storm.instanceId);
  });

  it("only a Special that asks for it re-forms: a capped spawn without `recastHeal` is unchanged", () => {
    const s = prepState();
    const kloud = place(s, "gale_kloud", "P1", 3, 1);
    const storm = place(s, STORM, "P1", 2, 1);
    storm.curHp = storm.maxHp - 10;
    const before = storm.curHp;
    SPECIAL_HANDLERS.spawn(s, kloud, [], { token: STORM, count: 1, maxAlive: 1 });
    expect(storm.curHp).toBe(before);
    expect(s.log.some((l) => /already at full strength/.test(l))).toBe(true);
  });

  it("the card says so", () => {
    const sp = getDef("gale_kloud").special!;
    expect(sp.params?.recastHeal).toBe(6);
    expect(sp.text).toContain("Cast again while it stands and it re-forms");
    expect(sp.text).toContain("heals 6");
  });
});

// Three rounds between casts, up from the default two (owner's call, 2026-09-28).
describe("Twisted Rage recharges for three rounds", () => {
  it("is locked out for exactly three rounds after a cast", () => {
    let s = prepState();
    const kloud = place(s, "gale_kloud", "P1", 3, 1);
    s = cast(s, kloud.instanceId);
    const k = s.cards[kloud.instanceId];
    expect(k.specialCooldown, "3, +1 for this round's own Cleanup").toBe(4);
    s.players.P1.magicPool = 20;
    s.battle = { queue: [k.instanceId], index: 0, awaitingInput: k.instanceId };
    for (let tick = 1; tick <= 3; tick++) {
      k.specialCooldown--; // one Cleanup
      expect(canFireSpecial(s, k.instanceId).ok, `still recharging after ${tick} Cleanup(s)`).toBe(false);
    }
    k.specialCooldown--;
    expect(canFireSpecial(s, k.instanceId).ok, "ready after the fourth").toBe(true);
  });

  it("the card says so", () => {
    const sp = getDef("gale_kloud").special!;
    expect(sp.cooldown).toBe(3);
    expect(sp.text).toContain("3-round cooldown");
  });
});

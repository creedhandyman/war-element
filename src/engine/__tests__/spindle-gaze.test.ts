import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { SPECIAL_HANDLERS } from "../combat";
import { place, prepState } from "./helpers";

// Spindle's Unblinking Gaze (the Void Tower's Floor 5): MUTED and BLIND on three
// of you, and DOT 8 for 2 rounds as well (owner's call). statusNova had two
// status slots and both were taken, so the DOT rides its own `dotPower` /
// `dotDuration` pair — the one Toxic Contagion already reads.

const gaze = () => {
  const s = prepState();
  const boss = place(s, "boss_spindle", "P2", 0, 1);
  const foes = [0, 1, 2, 3].map((col) =>
    place(s, "leaf_greegon", "P1", 3, col, { curHp: 40, maxHp: 40, curShields: 0 }));
  return { s, boss, foes };
};

describe("Spindle's Unblinking Gaze", () => {
  it("lays MUTED, BLIND and DOT 8 for 2 rounds on each of three, and not a fourth", () => {
    const { s, boss, foes } = gaze();
    const sp = getDef("boss_spindle").special!;
    SPECIAL_HANDLERS[sp.handler](s, s.cards[boss.instanceId], foes.map((f) => s.cards[f.instanceId]), sp.params!);
    for (const f of foes.slice(0, 3)) {
      const st = s.cards[f.instanceId].statuses;
      expect(st.find((x) => x.kind === "DOT")).toMatchObject({ power: 8, duration: 2 });
      expect(st.some((x) => x.kind === "MUTED"), "the BOLT lock").toBe(true);
      expect(st.some((x) => x.kind === "BLIND"), "the DUSK dark").toBe(true);
    }
    expect(s.cards[foes[3].instanceId].statuses, "it looks at three").toHaveLength(0);
  });

  it("a status nova without `dotPower` lays no DOT", () => {
    const { s, boss, foes } = gaze();
    const { dotPower: _drop, dotDuration: _also, ...plain } = getDef("boss_spindle").special!.params!;
    SPECIAL_HANDLERS.statusNova(s, s.cards[boss.instanceId], [s.cards[foes[0].instanceId]], plain);
    expect(s.cards[foes[0].instanceId].statuses.some((x) => x.kind === "DOT")).toBe(false);
  });
});

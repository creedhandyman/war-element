// OVERGROWTH MINES A WHOLE ROW (owner's call, 2026-10-02): one trap on every
// empty slot of the picked slot's row, each springing on its own.
import { describe, expect, it } from "vitest";
import { getSpell } from "../spells";
import { applyIntent } from "../phases";
import { place, prepState } from "./helpers";

describe("Overgrowth", () => {
  it("lays a trap on every empty slot of the row, skipping occupied ones", () => {
    const s = prepState();
    s.players.P1.magicPool = 20;
    s.players.P1.spellbook = [{ defId: "leaf_overgrowth", used: false }];
    const row = 1;
    place(s, "aqua_blub", "P2", row, 2); // a body standing in the row
    const next = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "leaf_overgrowth", row, col: 0 } as never);
    const mine = next.traps.filter((t) => t.owner === "P1" && t.spellId === "leaf_overgrowth");
    const cols = mine.map((t) => t.pos.col).sort();
    const expected = Array.from({ length: s.boardSize }, (_, c) => c).filter((c) => c !== 2);
    expect(mine.every((t) => t.pos.row === row)).toBe(true);
    expect(cols).toEqual(expected);
    // Each one carries the full payload.
    for (const t of mine) {
      expect(t.status?.kind).toBe("ROOT");
      expect(t.extraStatus?.kind).toBe("BLEED");
      expect(t.splash).toBe(true);
    }
  });

  it("is the only trap that does — Snare still takes one slot", () => {
    expect(getSpell("leaf_overgrowth").trap?.row).toBe(true);
    expect(getSpell("leaf_snare").trap?.row).toBeFalsy();
  });
});

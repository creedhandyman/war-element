import { describe, it, expect } from "vitest";
import { canAoeRow, canCastSpell, canSpellHitEnemy } from "../rules";
import { getSpell, SPELLS } from "../spells";
import { applyIntent } from "../phases";
import { homeRow } from "../types";
import type { GameState } from "../types";
import { place, prepState } from "./helpers";

/** Arm a spell in P2's book and give them the magic to cast it. */
function arm(s: GameState, spellId: string) {
  s.players.P2.spellbook = [{ defId: spellId, used: false }];
  s.players.P2.magicPool = 10;
}

describe("the enemy summon row is spell-proof", () => {
  it("refuses an area spell aimed at it, however far forward the caster is", () => {
    const s = prepState(7, "P2");
    // Fully committed: a card off its own home row AND one next to theirs.
    place(s, "leaf_alpha", "P2", 1, 0);
    place(s, "leaf_alpha", "P2", 2, 0);
    const theirHome = homeRow("P1", s.boardSize);
    expect(canAoeRow(s, "P2", theirHome), "their summon row").toBe(false);
    for (let r = 0; r < s.boardSize; r++) {
      if (r === theirHome) continue;
      expect(canAoeRow(s, "P2", r), `row ${r} is still fair game`).toBe(true);
    }
  });

  it("refuses a single-target spell at a card sitting on it", () => {
    const s = prepState(7, "P2");
    place(s, "leaf_alpha", "P2", 2, 0);
    const sitter = place(s, "leaf_alpha", "P1", homeRow("P1", s.boardSize), 0);
    expect(canSpellHitEnemy(s, "P2", sitter)).toBe(false);
  });

  it("still lets a BOARD sweep reach them — it aims at nobody", () => {
    // The deliberate pressure valve. Without it a seat that never leaves its
    // home row would be unanswerable by any spell at all.
    const boardWide = SPELLS.find((sp) => sp.kind === "aoe" && sp.area === "board");
    expect(boardWide, "the set has a board-wide sweep").toBeTruthy();
    const s = prepState(7, "P2");
    arm(s, boardWide!.id);
    expect(canCastSpell(s, "P2", boardWide!.id, {}).ok, "no row to forbid").toBe(true);
  });

  it("a two-row sweep cannot use its SPILL to reach the summon row either", () => {
    const s = prepState(7, "P2");
    const two = SPELLS.find((sp) => sp.area === "tworows");
    if (!two) return;
    const theirHome = homeRow("P1", s.boardSize);
    // The pick that would spill INTO their home row is refused as well.
    if (theirHome - 1 >= 0)
      expect(canAoeRow(s, "P2", theirHome) || canCastSpell(s, "P2", two.id, { row: theirHome - 1 }).ok)
        .not.toBe(true);
  });
});

describe("the two cheap LEAF spells traded roles", () => {
  it("the cost-1 is now 2 DMG and BLEED", () => {
    const sp = getSpell("leaf_sprout");
    expect(sp.cost).toBe(1);
    expect(sp.kind).toBe("damage");
    expect(sp.dmg).toBe(2);
    expect(sp.status).toEqual({ kind: "BLEED", duration: 2, power: 1 });
    expect(sp.allyHeal, "the heal is gone").toBeUndefined();
  });

  it("the cost-2 is now a row heal", () => {
    const sp = getSpell("leaf_thorn_patch");
    expect(sp.cost).toBe(2);
    expect(sp.area).toBe("row");
    expect(sp.allyHealInArea).toBe(3);
    expect(sp.status, "it wounds nobody now").toBeUndefined();
    expect(sp.dmg).toBeUndefined();
  });

  it("the row heal actually mends the line", () => {
    const s = prepState(7, "P2");
    arm(s, "leaf_thorn_patch");
    const hurt = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 4 });
    const other = place(s, "leaf_alpha", "P2", 1, 1, { curHp: 5 });
    const elsewhere = place(s, "leaf_alpha", "P2", 2, 0, { curHp: 4 });
    const before = { a: hurt.curHp, b: other.curHp, c: elsewhere.curHp };
    const out = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "leaf_thorn_patch", row: 1 });
    expect(out.cards[hurt.instanceId].curHp, "in the row").toBe(before.a + 3);
    expect(out.cards[other.instanceId].curHp, "in the row").toBe(before.b + 3);
    expect(out.cards[elsewhere.instanceId].curHp, "a different row is untouched").toBe(before.c);
  });

  it("does not announce a sweep that was never aimed at anyone", () => {
    const s = prepState(7, "P2");
    arm(s, "leaf_thorn_patch");
    place(s, "leaf_alpha", "P2", 1, 0, { curHp: 4 });
    const out = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "leaf_thorn_patch", row: 1 });
    expect(out.log.some((l) => /sweeps 0 opponent/.test(l)), "no phantom fizzle").toBe(false);
    expect(out.log.some((l) => /mends/.test(l))).toBe(true);
  });

  it("they swapped pictures, and the borrowed id is named in the data", () => {
    expect(getSpell("leaf_sprout").art).toBe("leaf_thorn_patch");
    expect(getSpell("leaf_thorn_patch").art).toBe("leaf_sprout");
    // Name travels with the effect, id stays put — ten shipped spellbooks
    // reference these ids and a rename would silently empty them.
    expect(getSpell("leaf_sprout").name).toBe("Thorn Patch");
    expect(getSpell("leaf_thorn_patch").name).toBe("Sprout");
  });
});

describe("Squall Line catches fliers", () => {
  it("declares it, and is the only wall that does", () => {
    expect(getSpell("gale_squall_line").wall?.stopsFlying).toBe(true);
    const others = SPELLS.filter((sp) => sp.wall && sp.id !== "gale_squall_line");
    expect(others.length).toBeGreaterThan(0);
    for (const sp of others)
      expect(sp.wall?.stopsFlying, `${sp.id} still lets fliers over`).toBeFalsy();
  });

  it("erupts on a FLYING card already standing in the row", () => {
    const s = prepState(7, "P2");
    arm(s, "gale_squall_line");
    const flier = place(s, "gale_hawko", "P1", 1, 0);
    expect(getSpell("gale_squall_line").wall?.stopsFlying).toBe(true);
    const hp = flier.curHp;
    const out = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "gale_squall_line", row: 1 });
    const after = out.cards[flier.instanceId];
    // Either it took the damage or it was pushed off the row — both are the
    // wall having caught it, which a flier used to be immune to outright.
    const caught = after.curHp < hp || after.pos?.row !== 1;
    expect(caught, "the squall does not let it over").toBe(true);
  });

  it("a wall with a top edge still lets fliers pass", () => {
    const s = prepState(7, "P2");
    arm(s, "leaf_bramble_wall");
    const flier = place(s, "gale_hawko", "P1", 1, 0);
    const hp = flier.curHp;
    const out = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "leaf_bramble_wall", row: 1 });
    const after = out.cards[flier.instanceId];
    expect(after.curHp, "brambles have a top edge").toBe(hp);
  });
});

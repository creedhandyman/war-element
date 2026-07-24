import { describe, expect, it } from "vitest";
import { SPELLS } from "../spells";
import { CARDS } from "../../data/cards";

// The two resources have OFFICIAL names — Gold (summoning) and Magic (Specials
// and Spells). Card and spell text is the game's rulebook as far as a player is
// concerned, so a card that still says "summoning resource" is teaching the
// wrong vocabulary. Naming drifts silently, hence the guard.
describe("official resource names", () => {
  const BANNED = [
    /summon(ing)? (pool|resource)/i,
    /\bmana\b/i,
    /magic pool/i,
  ];

  it("no spell text uses a retired name for a resource", () => {
    const bad: string[] = [];
    for (const s of SPELLS)
      for (const re of BANNED)
        if (re.test(s.text)) bad.push(`${s.id}: "${s.text}"`);
    expect(bad, `retired resource wording:\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("no card text uses a retired name for a resource", () => {
    // "summoning row" is deliberately still legal — that is a ROW on the board,
    // not the resource, and Lumberjack's text needs it.
    const bad: string[] = [];
    for (const c of CARDS) {
      const text = [c.special?.text, c.talent?.text].filter(Boolean).join(" ");
      for (const re of BANNED)
        if (re.test(text)) bad.push(`${c.id}: "${text}"`);
    }
    expect(bad, `retired resource wording:\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("the spell that converts between them names both correctly", () => {
    const rebate = SPELLS.find((s) => s.id === "bolt_power_rebate")!;
    expect(rebate.text).toContain("Gold");
    expect(rebate.text).toContain("Magic");
  });
});

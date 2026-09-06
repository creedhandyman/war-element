/** A Talent's prompt has to say what the Talent DOES.
 *
 *  Reported from the device against Gyre's: "Eye of the Gyre (Talent · free,
 *  once per game) — press Confirm to use it. There is no second one." Every
 *  word of that is ceremony. It is shown at the moment the player decides
 *  whether to spend an ability they get exactly once in the match, and the
 *  Talent's own `text` reached only a `title=` tooltip — invisible on touch,
 *  which is the platform the prompt renders on (`.bp-hint`).
 *
 *  The repetition the prompt was avoiding is real: 24 of the 28 talent texts
 *  open with "Once per game, free:" or "Once per game:", which the pill /
 *  prefix / parenthetical beside them already says. It solved it by dropping
 *  the other half.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import { describePassives, talentEffect, TALENT_LINE_PREFIX } from "../../ui/card-text";

const APP = readFileSync(join(__dirname, "..", "..", "ui", "App.tsx"), "utf8");
const withTalent = [...CARDS, ...TOKENS].filter((d) => d.talent);

describe("talentEffect trims the boilerplate, not the ability", () => {
  it("drops the opener and keeps a capitalised sentence", () => {
    expect(talentEffect("Once per game, free: drag up to 3 opponents 2 spaces toward you."))
      .toBe("Drag up to 3 opponents 2 spaces toward you.");
  });

  it("trims the shorter opener too — four talents leave out the 'free'", () => {
    expect(talentEffect("Once per game: re-arm Electro Surge — +1 shield."))
      .toBe("Re-arm Electro Surge — +1 shield.");
  });

  it("passes through a text that never had the opener", () => {
    // Dartfrog, Hawk, Golden Eagle and Jellyfish do not carry it, which is why
    // this trims a KNOWN prefix rather than assuming every text starts alike.
    const s = "Gain +2 SP and EVASION for 2 rounds.";
    expect(talentEffect(s)).toBe(s);
  });

  it("never returns an empty string, whatever it is handed", () => {
    expect(talentEffect("Once per game, free:")).toBe("Once per game, free:");
  });

  it("leaves every real talent with its ability intact", () => {
    for (const d of withTalent) {
      const e = talentEffect(d.talent!.text);
      expect(e.length, `${d.id} lost its text`).toBeGreaterThan(10);
      expect(e.toLowerCase().startsWith("once per game"), `${d.id} kept the opener`).toBe(false);
      // The trim is a PREFIX trim: the tail must survive byte for byte.
      expect(d.talent!.text.endsWith(e.slice(1)), `${d.id} lost its tail`).toBe(true);
    }
  });
});

describe("every surface that shows a Talent shows its effect", () => {
  it("the battle prompt names the effect, not just the ceremony", () => {
    // Source-level, because the prompt is a template string assembled in an
    // event handler that no unit test reaches. What broke was one call site
    // omitting the text, which is exactly what this reads.
    const at = APP.indexOf("function actTalent()");
    expect(at, "actTalent not found").toBeGreaterThan(-1);
    const body = APP.slice(at, APP.indexOf("\n  function ", at + 10));
    expect(body, "the prompt must interpolate the Talent's own text")
      .toContain("talentEffect(activeDef.talent.text)");
    expect(body.includes("press <b>Confirm</b> to use it. There is no second one."),
      "the description-free version is back").toBe(false);
  });

  it("the card-face passive line does not say 'once per game' twice", () => {
    // TALENT_LINE_PREFIX already carries "(free · once per game)".
    for (const d of withTalent) {
      const line = describePassives(d).find((l) => l.startsWith(TALENT_LINE_PREFIX));
      expect(line, `${d.id} has no talent line`).toBeTruthy();
      const after = line!.slice(TALENT_LINE_PREFIX.length);
      expect(after.toLowerCase(), `${d.id} repeats the opener`).not.toContain("once per game, free");
    }
  });

  it("and Gyre's in particular now reads as an ability", () => {
    const e = talentEffect(getDef("gale_gyre").talent!.text);
    expect(e).toContain("STUN");
    expect(e).toContain("3 opponents");
  });
});

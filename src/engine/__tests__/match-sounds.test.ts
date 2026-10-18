// TAP-OR-CLICK WORDS (ui/pointer.ts). Pure, so tested on plain strings.
import { describe, expect, it } from "vitest";
import { tapWords } from "../../ui/pointer";

describe("tapWords", () => {
  it("leaves a desktop's words alone", () => {
    expect(tapWords("Click a glowing Home slot.", false)).toBe("Click a glowing Home slot.");
  });

  it("says tap to a thumb, keeping the capital and the markup", () => {
    expect(tapWords("Click a glowing Home slot.", true)).toBe("Tap a glowing Home slot.");
    expect(tapWords("Casting <b>Zap</b> — click a glowing enemy.", true)).toBe("Casting <b>Zap</b> — tap a glowing enemy.");
    expect(tapWords("Mulligan: click cards to send back.", true)).toBe("Mulligan: tap cards to send back.");
  });

  it("covers the other forms and not look-alikes", () => {
    expect(tapWords("clicks, clicked, clicking", true)).toBe("taps, tapped, tapping");
    expect(tapWords("a clickbait icon", true)).toBe("a clickbait icon");
  });
});

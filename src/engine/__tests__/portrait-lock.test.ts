// Battles on a phone are portrait (owner's call, 2026-09-30). The runtime half
// (screen.orientation.lock, the resize listeners) needs a device; what can be
// pinned here is WHO counts as a phone, and that App actually uses the gate.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPhoneScreen } from "../../ui/PortraitLock";

const APP = readFileSync(join(__dirname, "..", "..", "ui", "App.tsx"), "utf8");

describe("battles are portrait on a phone", () => {
  it("counts a touch screen with a phone-sized short side, whichever way it is held", () => {
    expect(isPhoneScreen(390, 844, true)).toBe(true);
    expect(isPhoneScreen(844, 390, true)).toBe(true);
  });

  it("leaves tablets, and anything driven by a mouse, alone", () => {
    expect(isPhoneScreen(820, 1180, true), "iPad Air").toBe(false);
    expect(isPhoneScreen(390, 844, false), "a narrow desktop window").toBe(false);
  });

  it("gates only a live match, and holds a local match's auto-advance behind the cover", () => {
    expect(APP).toContain('usePortraitGate(started && game.phase !== "gameover")');
    expect(APP).toContain("if (rotateGated && !online) return;");
    expect(APP).toContain("{rotateGated && <RotateGate />}");
  });
});

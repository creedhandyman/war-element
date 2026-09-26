// THE BATTLE SPELL TRAY — a picture you can see, and a tray that fits its column.
//
// The suite runs in `node` with no DOM, so this reads the stylesheet the way
// styles.test.ts does: comments stripped (a rule named only in prose must not
// pass) and CRLF normalised (a Windows checkout slices the same as any other).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CSS = readFileSync(join(__dirname, "..", "..", "ui", "styles.css"), "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

/** Every declaration block for `sel`, in source order, media blocks included. */
function blocks(sel: string): string[] {
  const out: string[] = [];
  for (let at = CSS.indexOf(`${sel} {`); at !== -1; at = CSS.indexOf(`${sel} {`, at + 1))
    out.push(CSS.slice(at, CSS.indexOf("}", at)));
  return out;
}
/** A px value of `prop` in a block — not `min-width` when asked for `width`. */
const px = (block: string, prop: string): number =>
  Number(new RegExp(`(?:^|[;{\\s])${prop}:\\s*(\\d+)px`).exec(block)?.[1]);

describe("the battle spell tray", () => {
  it("shows each spell's picture, not a speck", () => {
    // It was 26px (24 in the phone's book, 17 on a phone held sideways). Spell
    // art is 720px and square; at that size every spell read as the same smudge.
    for (const sel of [
      ".spelltray.vertical .spellchip-art",
      ".spellbook-pop .spellchip-art",
      ".panel-spells .spellbook-pop .spellchip-art",
    ]) {
      const found = blocks(sel);
      expect(found.length, `${sel} is styled`).toBeGreaterThan(0);
      for (const b of found) {
        expect(px(b, "width"), `${sel} is square`).toBe(px(b, "height"));
        expect(px(b, "width"), `${sel}: at least 34px on every tier`).toBeGreaterThanOrEqual(34);
      }
    }
    // The desktop rail and the phone's book, where there is room: 48 or more.
    expect(px(blocks(".spelltray.vertical .spellchip-art")[0], "width")).toBeGreaterThanOrEqual(48);
    expect(px(blocks(".panel-spells .spellbook-pop .spellchip-art")[0], "width")).toBeGreaterThanOrEqual(48);
  });

  it("fits its column, scrolling inside it rather than running over the action bar", () => {
    // An eight-spell 5x5 book stood 631px in a 582px column at 1280x800 and
    // 736px in a 286px one on a phone held sideways, covering Pass Priority.
    const tray = blocks(".rightcol .spelltray.vertical").join("\n");
    expect(tray).toMatch(/flex:\s*0 1 auto/);
    expect(tray).toMatch(/min-height:\s*0/);
    const list = blocks(".rightcol .spelltray.vertical .spelltray-row").join("\n");
    expect(list).toMatch(/overflow-y:\s*auto/);
    expect(list).toMatch(/min-height:\s*0/);
    // ...and the Speed Queue sharing the column keeps room to be read.
    const queue = blocks(".rightcol .rail.queue-rail");
    expect(queue.some((b) => px(b, "min-height") >= 100), "a readable queue on the desktop tier").toBe(true);
    expect(queue.some((b) => px(b, "min-height") > 0 && px(b, "min-height") < 100), "and on the short tier").toBe(true);
  });

  it("a spell's name wraps rather than clipping to 'Embe…'", () => {
    expect(blocks(".spelltray.vertical .spellchip-head").join("\n")).toMatch(/flex-wrap:\s*wrap/);
    expect(blocks(".spelltray.vertical .spellchip-head .spellchip-name").join("\n")).toMatch(/white-space:\s*normal/);
  });

  it("a spell you cannot cast yet is dimmed, not blacked out", () => {
    const dim = blocks(".spellchip.poor .spellchip-art, .spellchip.used .spellchip-art").join("\n");
    const opacity = Number(/opacity:\s*([\d.]+)/.exec(dim)?.[1]);
    expect(opacity).toBeGreaterThanOrEqual(0.45);
    expect(opacity, "still visibly unavailable").toBeLessThan(1);
  });
});

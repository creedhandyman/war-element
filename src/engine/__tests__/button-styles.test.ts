/** EVERY BUTTON WEARS A STYLE THAT EXISTS.
 *
 *  A class name nothing in the stylesheet defines is silent: the button renders
 *  as the browser's own grey box and nothing fails. Two did exactly that —
 *  `className="bb"` on the level-up popup's Collect and the collection's "Build
 *  a squad" — because `bb` is another project's button class and it was never
 *  one of this game's. The level-up card is the one every new player sees in
 *  their first minute, and its only button was a white default rectangle.
 *
 *  The rule is deliberately loose: a button needs AT LEAST ONE class the sheet
 *  styles. Hook classes that ride on a styled base (`lockin sc-yes`, `ghost
 *  db-fill`) are fine and common; a button whose every class is unstyled is the
 *  bug. Static `className="..."` literals only — a computed className is read
 *  by the render tests, not by this scanner.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const UI = join(__dirname, "..", "..", "ui");
const CSS = readdirSync(UI).filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(join(UI, f), "utf8")).join("\n");
const styled = (cls: string) =>
  new RegExp(`\\.${cls.replace(/[-]/g, "\\-")}(?![\\w-])`).test(CSS);

describe("buttons", () => {
  it("every static button className names at least one class the stylesheet styles", () => {
    const bare: string[] = [];
    let seen = 0;
    for (const f of readdirSync(UI).filter((x) => x.endsWith(".tsx"))) {
      const src = readFileSync(join(UI, f), "utf8");
      for (const m of src.matchAll(/<button\b[^>]*?className="([^"]+)"/g)) {
        seen++;
        const classes = m[1].split(/\s+/).filter(Boolean);
        if (!classes.some(styled)) bare.push(`${f}: className="${m[1]}"`);
      }
    }
    expect(seen, "the scanner found no buttons — it is broken, not the UI").toBeGreaterThan(50);
    expect(bare).toEqual([]);
  });

  it("the scanner can tell a styled class from a missing one", () => {
    expect(styled("lockin")).toBe(true);
    expect(styled("bb")).toBe(false);
  });
});

/** EVERY WALKTHROUGH STEP POINTS AT A CONTROL THAT EXISTS.
 *
 *  A step's `anchor` is a `data-guide` value found in the DOM at show time
 *  (GuideOverlay.tsx). Nothing checks it: an anchor naming nothing just draws
 *  no ring, and the card docks over the screen instead. That is how the first
 *  battle's step ended up on top of the Fight button it was asking for — its
 *  anchor was the Story TAB, which is not on the map it was describing. The
 *  step now rings the node panel's Fight button, and this holds every anchor to
 *  a real mark in the UI source.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const UI = join(__dirname, "..", "..", "ui");
const read = (f: string) => readFileSync(join(UI, f), "utf8");
const TSX = readdirSync(UI).filter((f) => f.endsWith(".tsx")).map(read).join("\n");
const ANCHORS = [...read("Onboarding.tsx").matchAll(/anchor: "([^"]+)"/g)].map((m) => m[1]);
// The bottom nav stamps its tabs as `nav-${id}` (BottomNav.tsx).
const NAV = /data-guide=\{`nav-\$\{id\}`\}/.test(read("BottomNav.tsx"));

describe("the walkthrough's anchors", () => {
  it("found the steps (the scanner is not broken)", () => {
    expect(ANCHORS.length).toBeGreaterThanOrEqual(5);
    expect(NAV, "BottomNav's nav-<tab> stamp moved").toBe(true);
  });

  it.each(ANCHORS)("%s is a data-guide mark somewhere in the UI", (anchor) => {
    const literal = TSX.includes(`data-guide="${anchor}"`);
    const navTab = NAV && /^nav-(home|arena|story|tower|shop)$/.test(anchor);
    expect(literal || navTab, `${anchor} names no control`).toBe(true);
  });

  it("the first battle rings the Fight button, not the tab it came in by", () => {
    expect(read("Onboarding.tsx")).toMatch(/id: "fight",[\s\S]{0,200}anchor: "story-fight"/);
    expect(read("StoryMap.tsx")).toMatch(/np-fight[\s\S]{0,300}data-guide="story-fight"/);
  });
});

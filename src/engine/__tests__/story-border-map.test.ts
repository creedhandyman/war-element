// CROSSING A BORDER TAKES YOU THERE (owner, 2026-09-28): "after defeating a
// border crossing, switch to the new map that was unlocked." Winning a gate
// used to drop the player back on the map they had just left, and the region
// they fought their way into was a trip to the map picker away.
//
// Three pieces, pinned separately: which regions a clear OPENS (only ones that
// were shut), the navigation reducer carrying the player there when the result
// closes, and the App plumbing between them — source-level, like the other
// wiring tests, because App.tsx is not reachable from a unit test.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REGIONS, newSave, nodeById, regionsOpenedBy, type StorySave } from "../../data/story";
import { initialStoryNav, storyNav } from "../../ui/story-nav";

const save = (over: Partial<StorySave> = {}): StorySave => ({ ...newSave(), ...over });
const node = (id: string) => {
  const n = nodeById(id);
  expect(n, `no node ${id}`).toBeTruthy();
  return n!;
};
const ids = (s: StorySave, gate: string) => regionsOpenedBy(s, node(gate)).map((r) => r.id);

describe("which regions a clear opens", () => {
  it("names the region behind a gate that was shut", () => {
    expect(ids(save(), "GA")).toEqual(["pyro"]);
    expect(ids(save(), "GB")).toEqual(["aqua"]);
  });

  it("opens nothing when another road already opened it", () => {
    // AQUA has two gates, Eastleaf Port (GB) and Sunfall Harbor (GC): the
    // second one crossed is a border, not an unlock, and must not yank the
    // player off the map they are on.
    expect(ids(save({ cleared: ["GB"] }), "GC")).toEqual([]);
    // ...and a gate fought again after its region is open is the same case.
    expect(ids(save({ cleared: ["GA"] }), "GA")).toEqual([]);
  });

  it("reads a three-way gate in the order its own copy names them", () => {
    const ge = node("GE");
    expect(ge.opens).toEqual(["gale", "bolt", "bore"]);
    expect(ids(save(), "GE")).toEqual(ge.opens);
  });

  it("opens nothing for a node that gates no region", () => {
    const gates = new Set(REGIONS.flatMap((r) => r.requires ?? []));
    const plain = REGIONS[0].nodes.find((n) => !gates.has(n.id))!;
    expect(regionsOpenedBy(save(), plain)).toEqual([]);
  });
});

describe("closing the result", () => {
  const onLeaf = { ...initialStoryNav("leaf"), open: false, fightNode: node("GA") };
  const result = { node: node("GA"), won: [], captured: 0 };

  it("goes to the map a border win opened", () => {
    const shown = storyNav(onLeaf, { t: "result", result: { ...result, opened: "pyro" } });
    const back = storyNav(shown, { t: "closeResult" });
    expect(back.regionId).toBe("pyro");
    expect(back).toMatchObject({ open: true, view: "map", result: null, fightNode: null });
  });

  it("stays put when the win opened nothing", () => {
    const shown = storyNav(onLeaf, { t: "result", result });
    expect(storyNav(shown, { t: "closeResult" }).regionId).toBe("leaf");
  });
});

describe("the App plumbing", () => {
  const APP = readFileSync(join(__dirname, "..", "..", "ui", "App.tsx"), "utf8");
  const RESULT = readFileSync(join(__dirname, "..", "..", "ui", "StoryResult.tsx"), "utf8");

  it("reads what opened off the save BEFORE the clear lands", () => {
    // After `applyClear` the gate is in `cleared` and every region behind it
    // already reads as open, so asking then would always answer "nothing".
    const asked = APP.indexOf("regionsOpenedBy(story, storyNode)");
    const cleared = APP.indexOf("applyClear(awardShards(prev");
    expect(asked, "App never asks what the win opened").toBeGreaterThan(-1);
    expect(cleared).toBeGreaterThan(-1);
    expect(asked, "asked after the clear").toBeLessThan(cleared);
    expect(APP).toMatch(/captured, opened \} \}\)/);
  });

  it("tells the player where Done is taking them", () => {
    expect(APP).toContain("opened={storyResult.opened}");
    expect(RESULT).toMatch(/props\.opened \? `On to \$\{props\.opened\.toUpperCase\(\)\}`/);
  });
});

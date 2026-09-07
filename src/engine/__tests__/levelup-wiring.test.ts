// LEVEL UP — guards on the popup and its wiring.
//
// Source-level, like the draft ones and for the same reason: `environment` is
// "node", App.tsx is one 5,000-line component, and none of this is reachable
// from a unit test. The payout maths has its own file; what is pinned here is
// the plumbing that decides whether any of it ever runs.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ui = (f: string) => readFileSync(join(__dirname, "..", "..", "ui", f), "utf8");
const APP = ui("App.tsx");
const MODAL = ui("LevelUpModal.tsx");
const CSS = ui("styles.css");
const STORY = readFileSync(join(__dirname, "..", "..", "data", "story.ts"), "utf8");

describe("the level-up popup", () => {
  it("styles every class it puts on the page", () => {
    const names = new Set<string>();
    for (const m of MODAL.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g))
      for (const tok of (m[1] ?? m[2] ?? "").split(/[\s${}]+/))
        if (/^[a-z][a-z0-9-]*$/.test(tok)) names.add(tok);
    expect(names.size, "no classes found — the scanner is broken").toBeGreaterThan(5);
    const missing = [...names].filter((n) => !CSS.includes(`.${n}`)).sort();
    expect(missing, `classes with no rule: ${missing.join(", ")}`).toEqual([]);
  });

  it("owns no state — the reward is priced elsewhere and handed in", () => {
    // Same shape as DraftScreen. The money lives in one pure function that a
    // test can run a hundred spans through; a modal that priced its own reward
    // would be a second place for the numbers to live.
    expect(MODAL.includes("useState"), "the modal holds state").toBe(false);
    // A CALL, not the word: the file's own comment names `claimLevelUp` to say
    // the parent owns it, and matching that was matching prose.
    expect(/claimLevelUp\s*\(/.test(MODAL), "the modal pays out itself").toBe(false);
    expect(MODAL.includes("addShards"), "the modal touches the wallet").toBe(false);
    expect(MODAL).toContain("props.reward");
  });

  it("is ONE card for the whole span, not one per level", () => {
    // A five-card pack can cross three levels; three modals to dismiss is a
    // worse reward than the shards in them.
    expect(MODAL).toMatch(/r\.levels > 1/);
    expect(MODAL).toContain("r.from");
    expect(MODAL).toContain("r.to");
  });

  it("adds no always-on animation", () => {
    // The badge lands with one keyframe and stops. A modal read for a few
    // seconds does not need a shadow repainting behind it at 60fps — the same
    // rule the board cues were converted to obey.
    const block = CSS.slice(CSS.indexOf(".lvl-up"));
    expect(block).not.toContain("infinite");
  });
});

describe("the wiring", () => {
  it("derives the pending levels from the save every render", () => {
    // Not latched into state: the level is derived from the collection, so the
    // save is the only honest source, and a latch would need clearing on every
    // path that changes it — a pack, a boss, a story clear, a restore.
    expect(APP).toContain("const levelUp = useMemo(() => pendingLevelUp(story), [story])");
  });

  it("pays on close — skipping is not forfeiting", () => {
    // The button closes a message, not an envelope. Whatever dismisses it, the
    // same claim runs.
    const at = APP.indexOf("<LevelUpModal");
    expect(at, "the modal is never mounted").toBeGreaterThan(-1);
    const block = APP.slice(at, at + 700);
    expect(block).toContain("claimLevelUp(prev)");
    expect(block, "a claim that is not persisted").toContain("saveStory(next)");
  });

  it("stamps the mark on load, or the feature never fires at all", () => {
    // THE ONE THAT MATTERS. `seenLevel` reads an absent mark as the CURRENT
    // level, which is right for a save that predates this — nobody is owed
    // hundreds of shards for levels earned before there was a popup. But left
    // unwritten it follows the level upward forever and no level-up is ever
    // detected: the feature would be silently dead rather than wrong.
    expect(STORY).toContain("levelSeen: playerLevel(fresh)");
    expect(STORY).toMatch(/gifted\.save\.levelSeen === undefined/);
    // ...and the stamp is written back, not just returned.
    expect(STORY).toMatch(/marked !== gifted\.save\)\s*saveStory\(marked\)/);
  });

  it("drops a junk mark rather than clamping it", () => {
    // Absent owes nothing; zero owes the whole collection. A hand-edited save
    // must fail toward the safe one.
    expect(STORY).toMatch(/typeof p\.levelSeen === "number"[\s\S]{0,160}: undefined/);
  });
});

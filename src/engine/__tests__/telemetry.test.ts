// THE ANONYMOUS PLAY LOG (net/telemetry.ts), checked as far as a node test can:
// the names it sends are ones the table accepts, it never pulls the Supabase SDK
// onto the first frame, it is silent in tests, and the game calls it where the
// funnel needs it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PLAY_EVENTS, cleanDetail, track } from "../../net/telemetry";

const read = (...p: string[]) => readFileSync(join(__dirname, "..", "..", ...p), "utf8").replace(/\r\n/g, "\n");

describe("the play log", () => {
  it("sends only names and details the table's CHECKs accept", () => {
    for (const e of PLAY_EVENTS) expect(e, e).toMatch(/^[a-z0-9_]{1,32}$/);
    expect(cleanDetail("L1")).toBe("l1");
    expect(cleanDetail("GA")).toBe("ga");
    expect(cleanDetail("first")).toBe("first");
    expect(cleanDetail("a b-c")).toBe("a_b_c");
    expect(cleanDetail(undefined)).toBeUndefined();
    expect(cleanDetail("x".repeat(40))).toHaveLength(24);
  });

  it("is a plain fetch: no Supabase SDK on the first frame", () => {
    expect(read("net", "telemetry.ts")).not.toMatch(/from "@supabase\/supabase-js"/);
  });

  it("sends nothing from a test run", () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    track("first_open", "new");
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("the game logs each funnel step where it happens", () => {
    const app = read("ui", "App.tsx");
    for (const call of [
      'track("first_open"', 'track("day_open")', 'track("story_win", storyNode.id)', 'track("story_loss", storyNode.id)',
      'track(tutDef.id === "magic" ? "magic_done" : "tutorial_done"', 'track("tutorial_skip", "mid")', 'track("tutorial_skip", "start")',
    ]) expect(app, call).toContain(call);
    expect(read("ui", "Shop.tsx")).toContain('track("first_pack")');
  });
});

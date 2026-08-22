// The cloud-save bundle: what travels, what does not, and what a restore means.
//
// None of this touches the network — `localBundle`, `applyBundle` and
// `summarize` are the pure half, and they are the half that can silently eat a
// save. The auth calls are Supabase's and are not worth mocking; these are the
// rules that are OURS.
import { beforeEach, describe, expect, it } from "vitest";
import { SAVE_KEYS, applyBundle, localBundle, summarize } from "../../net/account";

/** A localStorage that behaves, for a test environment that may not have one. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  } as Storage;
}

const STORY = (over: Record<string, unknown> = {}) => JSON.stringify({
  collection: ["leaf_alpha", "pyro_baboom", "dusk_gool"],
  cleared: ["L1", "L2"],
  hero: { name: "Keeper", shards: 120 },
  ...over,
});
const SQUADS = JSON.stringify({ v: 1, squads: [{ id: "a", name: "One", cards: [] }] });

beforeEach(() => {
  globalThis.localStorage = fakeStorage();
});

describe("what travels between devices", () => {
  it("carries progress and leaves device preferences behind", () => {
    // The distinction that matters: muting the game on a laptop must not mute
    // it on a phone. Progress travels; preferences stay.
    localStorage.setItem("we_story_v1", STORY());
    localStorage.setItem("we_squads_v1", SQUADS);
    localStorage.setItem("we_music_muted", "1");
    const b = localBundle();
    expect(Object.keys(b.keys).sort()).toEqual(["we_squads_v1", "we_story_v1"]);
    expect(b.keys["we_music_muted"], "a property of the device, not the player").toBeUndefined();
  });

  it("only lists keys that are actually a save", () => {
    // Guards the guard: if SAVE_KEYS ever grew to include everything, the test
    // above would still pass while syncing the mute flag.
    expect(SAVE_KEYS).not.toContain("we_music_muted");
    expect(SAVE_KEYS).toContain("we_story_v1");
  });

  it("stores the raw JSON, so a save-format change needs nothing here", () => {
    const weird = JSON.stringify({ somethingNobodyHasWrittenYet: true });
    localStorage.setItem("we_story_v1", weird);
    expect(localBundle().keys["we_story_v1"]).toBe(weird);
  });
});

describe("restoring is a replacement, not a merge", () => {
  it("removes keys the incoming save does not have", () => {
    // The failure this exists for: restoring a save with no squads must not
    // leave the PREVIOUS player's squads on the device. After a restore the
    // phone looks like the save, not like a mixture of two.
    localStorage.setItem("we_story_v1", STORY());
    localStorage.setItem("we_squads_v1", SQUADS);
    applyBundle({ keys: { we_story_v1: STORY({ cleared: [] }) }, savedAt: new Date(0).toISOString() });
    expect(localStorage.getItem("we_squads_v1"), "the old squads are gone").toBeNull();
    expect(localStorage.getItem("we_story_v1")).toBeTruthy();
  });

  it("leaves device preferences alone", () => {
    localStorage.setItem("we_music_muted", "1");
    applyBundle({ keys: { we_story_v1: STORY() }, savedAt: new Date(0).toISOString() });
    expect(localStorage.getItem("we_music_muted"), "not ours to overwrite").toBe("1");
  });

  it("round-trips a save unchanged", () => {
    for (const k of SAVE_KEYS) localStorage.setItem(k, `{"k":"${k}"}`);
    const before = localBundle();
    localStorage.clear();
    applyBundle(before);
    expect(localBundle().keys).toEqual(before.keys);
  });
});

describe("summarize — what the player is shown before overwriting anything", () => {
  it("counts a real save", () => {
    const s = summarize({ keys: { we_story_v1: STORY(), we_squads_v1: SQUADS }, savedAt: "" });
    expect(s).toMatchObject({ cards: 3, cleared: 2, shards: 120, squads: 1, empty: false });
  });

  it("calls a fresh save empty, which is what makes the automatic case safe", () => {
    // An empty side never overwrites a full one, and that rule is only sound if
    // "empty" is right. A brand-new install has a NEWER save than the two-month
    // campaign in the cloud, so newest-wins would delete everything.
    expect(summarize(null).empty).toBe(true);
    expect(summarize({ keys: {}, savedAt: "" }).empty).toBe(true);
    expect(summarize({ keys: { we_story_v1: '{"collection":[],"cleared":[],"hero":{"shards":0}}' }, savedAt: "" }).empty).toBe(true);
  });

  it("does not throw on a corrupt or unrecognised save", () => {
    // It reads raw JSON without importing the save's types on purpose, so a
    // format change cannot break sign-in. Unreadable reads as zero — which
    // understates a save rather than inventing one.
    expect(() => summarize({ keys: { we_story_v1: "not json{" }, savedAt: "" })).not.toThrow();
    expect(summarize({ keys: { we_story_v1: "not json{" }, savedAt: "" }).empty).toBe(true);
    expect(summarize({ keys: { we_story_v1: "[1,2,3]" }, savedAt: "" }).empty).toBe(true);
  });

  it("counts a save that has progress but nothing collected", () => {
    // `empty` must mean "nothing to lose", not "no cards". Shards alone are
    // worth protecting.
    expect(summarize({ keys: { we_story_v1: '{"hero":{"shards":40}}' }, savedAt: "" }).empty).toBe(false);
  });
});

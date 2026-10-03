// The cloud-save bundle: what travels, what does not, and what a restore means.
//
// None of this touches the network — `localBundle`, `applyBundle` and
// `summarize` are the pure half, and they are the half that can silently eat a
// save. The auth calls are Supabase's and are not worth mocking; these are the
// rules that are OURS.
import { beforeEach, describe, expect, it } from "vitest";
import {
  SAVE_KEYS, applyBundle, autosaveEnabled, autosaveStep, continuesSave, fingerprint, localBundle,
  noteSynced, sameSave, setAutosave, summarize, type SaveBundle,
} from "../../net/account";

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

describe("sameSave — is there actually a conflict", () => {
  const A = { keys: { we_story_v1: STORY(), we_squads_v1: SQUADS }, savedAt: "2020-01-01T00:00:00Z", device: "iPhone" };

  it("ignores WHEN and WHERE it was written", () => {
    // The bug this fixes: the panel warned about a conflict on two identical
    // saves, which is what you see immediately after uploading. localBundle()
    // stamps a fresh timestamp on every call, so comparing whole objects would
    // never report a match and the warning would never stop.
    const B = { ...A, savedAt: "2026-08-22T02:26:08Z", device: "Android" };
    expect(sameSave(A, B)).toBe(true);
  });

  it("spots a real difference", () => {
    expect(sameSave(A, { ...A, keys: { ...A.keys, we_story_v1: STORY({ cleared: ["L1"] }) } })).toBe(false);
  });

  it("a missing key differs from a present one", () => {
    // Restoring is a replacement, so "has no squads" and "has squads" are
    // genuinely different saves and must not be called identical.
    expect(sameSave(A, { ...A, keys: { we_story_v1: STORY() } })).toBe(false);
  });

  it("is false when either side is absent", () => {
    expect(sameSave(A, null)).toBe(false);
    expect(sameSave(null, null), "two nothings are not a match to report").toBe(false);
  });

  it("two empty saves count as the same", () => {
    expect(sameSave({ keys: {}, savedAt: "" }, { keys: {}, savedAt: "" })).toBe(true);
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

// AUTOSAVE (owner's call, 2026-10-03). The rule that decides whether a phone
// may push over the cloud — the one thing in this file that could overwrite
// another device's campaign — so it is pinned case by case.
describe("autosave never overwrites another device's progress", () => {
  const bundle = (story: string | null, squads: string | null = SQUADS): SaveBundle => ({
    keys: {
      ...(story ? { we_story_v1: story } : {}),
      ...(squads ? { we_squads_v1: squads } : {}),
    },
    savedAt: "2026-10-03T12:00:00Z",
  });
  const older = bundle(STORY());
  const played = bundle(STORY({ collection: ["leaf_alpha", "pyro_baboom", "dusk_gool", "aqua_kraken"], cleared: ["L1", "L2", "L3"] }));
  const otherDevice = bundle(STORY({ collection: ["gale_hawk"], cleared: ["P1"] }));

  it("pushes over the cloud save this device last synced with", () => {
    expect(autosaveStep(played, older, fingerprint(older))).toBe("push");
  });

  it("stops and asks when someone else has written since", () => {
    // Synced at `older`; the cloud now holds a different device's save.
    expect(autosaveStep(played, otherDevice, fingerprint(older))).toBe("conflict");
    // ...even one that only changed squads: the baseline is the rule, not progress.
    const squadEdit = bundle(STORY(), JSON.stringify({ v: 1, squads: [] }));
    expect(autosaveStep(played, squadEdit, fingerprint(older))).toBe("conflict");
  });

  it("never pushes an empty save, and skips one that is already there", () => {
    expect(autosaveStep(bundle(null, null), older, fingerprint(older))).toBe("skip");
    expect(autosaveStep(older, older, null)).toBe("skip");
  });

  it("fills an empty cloud", () => {
    expect(autosaveStep(played, null, null)).toBe("push");
  });

  it("on a first sync, pushes only a save that continues the cloud's", () => {
    // An older hand-upload of this same campaign: every card and node still here.
    expect(continuesSave(played, older)).toBe(true);
    expect(autosaveStep(played, older, null)).toBe("push");
    // A different campaign is a conflict, however much it holds.
    expect(continuesSave(played, otherDevice)).toBe(false);
    expect(autosaveStep(played, otherDevice, null)).toBe("conflict");
  });

  it("fingerprints the game, not the write", () => {
    expect(fingerprint({ ...older, savedAt: "2030-01-01T00:00:00Z", device: "iPad" })).toBe(fingerprint(older));
    expect(fingerprint(played)).not.toBe(fingerprint(older));
  });

  it("is on by default, a per-device switch, and outside the synced keys", () => {
    expect(autosaveEnabled()).toBe(true);
    setAutosave(false);
    expect(autosaveEnabled()).toBe(false);
    noteSynced(older);
    for (const k of ["we_cloud_autosave", "we_cloud_base", "we_cloud_autosave_at"])
      expect((SAVE_KEYS as readonly string[]).includes(k), `${k} must not travel`).toBe(false);
  });
});

// THE SPEAKER BUTTON'S THREE STATES and THE DOTS ON THE BAR.
//   - effects have their own switch, and a device that never set it follows the
//     music mute (so nobody who muted before is suddenly chimed at);
//   - the tab bar says when something is waiting (daily reward, achievements, packs).
import { afterEach, describe, expect, it } from "vitest";
import { nextSoundMode } from "../../ui/useGameMusic";
import { navAttention } from "../../ui/nav-attention";
import { playSfx } from "../../ui/sfx";
import { claimDaily } from "../../data/daily";
import { newSave } from "../../data/story";

describe("nextSoundMode", () => {
  it("walks all -> effects only -> silent -> all", () => {
    let s = { music: false, sfx: false };
    s = nextSoundMode(s.music, s.sfx);
    expect(s).toEqual({ music: true, sfx: false });
    s = nextSoundMode(s.music, s.sfx);
    expect(s).toEqual({ music: true, sfx: true });
    s = nextSoundMode(s.music, s.sfx);
    expect(s).toEqual({ music: false, sfx: false });
  });
});

/** A context that accepts anything and counts the oscillators it is asked for. */
function fakeAudio() {
  const calls = { osc: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deep: any = new Proxy(function () { /* callable */ }, {
    get: (_t, k) => (k === "createOscillator" ? () => { calls.osc++; return deep; }
      : k === "currentTime" ? 0 : k === "sampleRate" ? 44100 : deep),
    apply: () => deep,
    set: () => true,
  });
  (globalThis as unknown as Record<string, unknown>).AudioContext = class { constructor() { return deep; } };
  return calls;
}
function storage(entries: Record<string, string>) {
  const store = new Map(Object.entries(entries));
  (globalThis as unknown as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}
afterEach(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.AudioContext; delete g.localStorage;
});

describe("effects and music are separate switches", () => {
  it("effects still play with the music off, when the effects switch says so", () => {
    const calls = fakeAudio();
    storage({ we_music_muted: "1", we_sfx_muted: "0" });
    playSfx("win");
    expect(calls.osc).toBeGreaterThan(0);
  });

  it("a device that never set the effects switch follows the music mute", () => {
    const calls = fakeAudio();
    storage({ we_music_muted: "1" });
    playSfx("win");
    expect(calls.osc).toBe(0);
  });

  it("silent means silent", () => {
    const calls = fakeAudio();
    storage({ we_music_muted: "1", we_sfx_muted: "1" });
    playSfx("win");
    expect(calls.osc).toBe(0);
  });
});

describe("navAttention", () => {
  const today = "2026-10-16";

  it("a fresh save has a daily reward waiting and its free first pack in the shop", () => {
    expect(navAttention(newSave(), today)).toEqual({ home: true, shop: true });
  });

  it("claiming the daily clears the Home dot", () => {
    const claimed = claimDaily(newSave(), today);
    expect(navAttention(claimed, today).home).toBe(false);
    // ...and it comes back the next day.
    expect(navAttention(claimed, "2026-10-17").home).toBe(true);
  });

  it("free packs light the Shop", () => {
    const s = claimDaily(newSave(), today);
    s.hero = { ...(s.hero as NonNullable<typeof s.hero>), freePacks: 2 };
    expect(navAttention(s, today).shop).toBe(true);
    s.hero = { ...s.hero, freePacks: 0 };
    expect(navAttention(s, today).shop).toBe(false);
  });
});

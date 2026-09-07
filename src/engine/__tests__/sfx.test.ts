// THE LEVEL-UP CHIME, and the ways audio breaks a screen it was meant to
// decorate.
//
// It is SYNTHESIZED rather than loaded: the game ships ten music tracks and not
// one sound effect, so an `<audio src="/sfx/level-up.mp3">` would be a silent
// 404 on every level-up until somebody records a file. Generating it means the
// sound exists today and a real file can replace it later.
//
// Every path here has to fail quiet. Web Audio is missing in some embedded
// browsers, suspended until a gesture in most, and refused outright in a few,
// and none of that is worth an exception on a screen celebrating something.
import { afterEach, describe, expect, it } from "vitest";
import { playLevelUp } from "../../ui/sfx";

interface Made { freq: number; started: number }

/** A fake Web Audio just rich enough to record what was asked of it. */
function fakeAudio() {
  const made: Made[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime() { return this; },
    exponentialRampToValueAtTime() { return this; },
  });
  class Ctx {
    currentTime = 0;
    destination = {};
    resume() { return Promise.resolve(); }
    createGain() { return { gain: param(), connect: (n: unknown) => n }; }
    createOscillator() {
      const o = {
        type: "", frequency: { value: 0 },
        connect: (n: unknown) => n,
        start(at: number) { made.push({ freq: o.frequency.value, started: at }); },
        stop() { /* noop */ },
      };
      return o;
    }
  }
  const g = globalThis as unknown as Record<string, unknown>;
  g.AudioContext = Ctx as unknown;
  return made;
}

const setMuted = (on: boolean) => {
  const store = new Map<string, string>([["we_music_muted", on ? "1" : "0"]]);
  (globalThis as unknown as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
};

afterEach(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.AudioContext;
  delete g.webkitAudioContext;
  delete g.localStorage;
});

describe("the level-up chime", () => {
  it("does nothing, loudly or otherwise, when Web Audio is missing", () => {
    // The node environment these tests run in has no AudioContext, which is the
    // same shape as an embedded browser that does not expose one. A level-up
    // with no sound is a level-up; one that throws is a broken app.
    expect(() => playLevelUp()).not.toThrow();
  });

  it("plays a rising arpeggio that lands on the octave", () => {
    const made = fakeAudio();
    setMuted(false);
    playLevelUp();
    expect(made.length, "four notes").toBe(4);
    // Rising, and the last note is the octave of the first — that is what makes
    // it read as an arrival rather than four beeps.
    const freqs = made.map((n) => n.freq);
    for (let i = 1; i < freqs.length; i++)
      expect(freqs[i], `note ${i} is not above the one before`).toBeGreaterThan(freqs[i - 1]);
    expect(freqs[3] / freqs[0], "the last is an octave over the first").toBeCloseTo(2, 1);
    // Overlapping, so it is one gesture: each starts before the previous ends.
    for (let i = 1; i < made.length; i++)
      expect(made[i].started, `note ${i} starts after the one before`)
        .toBeGreaterThan(made[i - 1].started);
  });

  it("stays silent when the player muted the game", () => {
    // The music mute is the whole audio preference — there is no second toggle,
    // and somebody who muted the soundtrack did not ask to be chimed at.
    const made = fakeAudio();
    setMuted(true);
    playLevelUp();
    expect(made, "muted and still made a sound").toHaveLength(0);
  });

  it("survives a localStorage that throws", () => {
    // Private mode can throw on read. Silence is not the safe default here —
    // failing to READ the preference must not mean failing to play.
    fakeAudio();
    (globalThis as unknown as Record<string, unknown>).localStorage = {
      getItem() { throw new Error("denied"); },
    };
    expect(() => playLevelUp()).not.toThrow();
  });
});

// The music mixer: tracks restart from the top, changes crossfade, and the low
// end is trimmed (owner-reported: a track came back mid-song, battle in and out
// was a hard cut, and the bass was saturated).
//
// The browser's pieces are injected (`MixerEnv`), so these run on fakes: an
// <audio> that only records what it was told, an AudioContext whose params
// record their automation, and a timer queue this file advances by hand.
import { describe, expect, it } from "vitest";
import { BASS, FADE_S, MUTE_FADE_S, MusicMixer, START_FADE_S, type MixerEnv } from "../../ui/music-mixer";

class FakeParam {
  events: Array<{ kind: string; v?: number; t: number }> = [];
  constructor(public value = 0) {}
  setValueAtTime(v: number, t: number) { this.events.push({ kind: "set", v, t }); this.value = v; return this; }
  linearRampToValueAtTime(v: number, t: number) { this.events.push({ kind: "ramp", v, t }); return this; }
  cancelScheduledValues(t: number) { this.events.push({ kind: "cancel", t }); return this; }
  cancelAndHoldAtTime(t: number) { this.events.push({ kind: "hold", t }); return this; }
  /** Where the automation is heading: the last value set or ramped to. */
  get target() { return [...this.events].reverse().find((e) => e.v !== undefined)?.v; }
  /** When the last ramp arrives. */
  get rampEnds() { return [...this.events].reverse().find((e) => e.kind === "ramp")?.t; }
}
class FakeNode {
  out: FakeNode[] = [];
  connect(n: FakeNode) { this.out.push(n); return n; }
}
class FakeGain extends FakeNode { gain = new FakeParam(1); }
class FakeBiquad extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam(350);
  Q = new FakeParam(1);
  gain = new FakeParam(0);
}
class FakeSource extends FakeNode { constructor(public el: FakeAudio) { super(); } }
class FakeCtx {
  currentTime = 0;
  state = "suspended";
  resumes = 0;
  destination = new FakeNode();
  sources: FakeSource[] = [];
  resume() { this.resumes++; this.state = "running"; return Promise.resolve(); }
  createGain() { return new FakeGain(); }
  createBiquadFilter() { return new FakeBiquad(); }
  createMediaElementSource(el: FakeAudio) { const s = new FakeSource(el); this.sources.push(s); return s; }
}
class FakeAudio {
  currentTime = 0;
  paused = true;
  ended = false;
  loop = false;
  volume = 1;
  preload = "";
  plays = 0;
  onended: (() => void) | null = null;
  constructor(public src: string) {}
  play() { this.paused = false; this.ended = false; this.plays++; return Promise.resolve(); }
  pause() { this.paused = true; }
}

const VOLUME = 0.45;

function rig(opts: { webAudio?: boolean; brokenGraph?: boolean } = {}) {
  const els = new Map<string, FakeAudio>();
  let now = 0;
  const timers: Array<{ at: number; fn: () => void; id: number }> = [];
  let nextId = 1;
  const ctx = new FakeCtx();
  if (opts.brokenGraph) ctx.createBiquadFilter = () => { throw new Error("no filters here"); };
  const env: MixerEnv = {
    makeAudio: (src) => { const a = new FakeAudio(src); els.set(src, a); return a as unknown as HTMLAudioElement; },
    makeContext: () => (opts.webAudio === false ? null : (ctx as unknown as AudioContext)),
    setTimeout: (fn, ms) => { const id = nextId++; timers.push({ at: now + ms, fn, id }); return id; },
    clearTimeout: (h) => { const i = timers.findIndex((t) => t.id === h); if (i >= 0) timers.splice(i, 1); },
  };
  /** Advance the clock (both the timer queue and the context's) by `ms`. */
  const tick = (ms: number) => {
    const end = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0];
      if (!t || t.at > end) break;
      timers.shift();
      now = t.at;
      ctx.currentTime = now / 1000;
      t.fn();
    }
    now = end;
    ctx.currentTime = now / 1000;
  };
  const m = new MusicMixer(env, VOLUME);
  const el = (name: string) => els.get(`/music/${name}.mp3`)!;
  const fader = (name: string) => ctx.sources.find((s) => s.el === el(name))!.out[0] as FakeGain;
  const play = (name: string, o: { loop?: boolean; onEnded?: () => void } = {}) =>
    m.play(name, `/music/${name}.mp3`, { loop: o.loop ?? true, onEnded: o.onEnded ?? null });
  return { m, ctx, el, fader, play, tick };
}

describe("a track you come back to starts from the top", () => {
  it("the reported bug: leave the menu mid-song, come back, and it starts over", () => {
    const { el, play, tick } = rig();
    play("growth");
    el("growth").currentTime = 73; // well into the song when the battle starts
    play("jungle");
    tick(FADE_S * 1000 + 100);
    expect(el("growth").paused, "stopped once faded").toBe(true);
    expect(el("growth").currentTime, "and rewound").toBe(0);
    play("growth");
    expect(el("growth").currentTime).toBe(0);
    expect(el("growth").paused).toBe(false);
  });

  it("a playlist track that ENDED starts over the next time round, too", () => {
    const { el, play } = rig();
    play("jungle", { loop: false });
    el("jungle").ended = true;
    el("jungle").paused = true;
    el("jungle").currentTime = 180;
    play("atlantic", { loop: false });
    expect(el("jungle").currentTime).toBe(0);
  });
});

describe("changing track crossfades", () => {
  it("the old track fades out as the new one fades in, and pauses only once silent", () => {
    const { el, fader, play, tick } = rig();
    play("growth");
    tick(3000);
    play("jungle");
    expect(fader("growth").gain.target, "growth heads for silence").toBe(0);
    expect(fader("growth").gain.rampEnds).toBeCloseTo(3 + FADE_S);
    expect(fader("jungle").gain.target, "jungle heads for full").toBe(1);
    expect(fader("jungle").gain.rampEnds).toBeCloseTo(3 + FADE_S);
    expect(fader("jungle").gain.events.find((e) => e.kind === "set")?.v, "from silence").toBe(0);
    expect(el("growth").paused, "still audible mid-fade").toBe(false);
    tick(FADE_S * 1000 + 100);
    expect(el("growth").paused).toBe(true);
    expect(el("jungle").paused).toBe(false);
  });

  it("coming back while it is still fading out picks it up where it is, not from the top", () => {
    const { el, fader, play, tick } = rig();
    play("growth");
    el("growth").currentTime = 40;
    play("jungle");
    tick(500); // half-way out
    play("growth");
    expect(el("growth").currentTime, "never went silent, so no restart").toBe(40);
    expect(fader("growth").gain.target).toBe(1);
    tick(FADE_S * 1000 + 500);
    expect(el("growth").paused, "the pending stop was called off").toBe(false);
    expect(el("jungle").paused, "and jungle is the one that stopped").toBe(true);
  });

  it("the current track asked for again changes nothing", () => {
    const { el, fader, play } = rig();
    play("growth");
    el("growth").currentTime = 10;
    const before = fader("growth").gain.events.length;
    play("growth");
    expect(el("growth").currentTime).toBe(10);
    expect(fader("growth").gain.events.length, "no new fade").toBe(before);
  });

  it("from silence (the first track, or after one ENDED) it is a short fade-in, not a crossfade", () => {
    const { el, fader, play } = rig();
    play("growth");
    expect(fader("growth").gain.rampEnds).toBeCloseTo(START_FADE_S);
    play("jungle", { loop: false });
    el("jungle").ended = true;
    el("jungle").paused = true;
    play("atlantic", { loop: false });
    expect(fader("atlantic").gain.rampEnds).toBeCloseTo(START_FADE_S);
  });

  it("a playlist's hand-over is assigned, never stacked", () => {
    const { el, play } = rig();
    let advanced = 0;
    for (let i = 0; i < 3; i++) play("jungle", { loop: false, onEnded: () => { advanced++; } });
    el("jungle").onended?.();
    expect(advanced).toBe(1);
  });
});

describe("mute", () => {
  it("fades out quickly, and unmuting starts the track from the top", () => {
    const { el, fader, m, play, tick } = rig();
    play("growth");
    el("growth").currentTime = 50;
    m.stop();
    expect(fader("growth").gain.target).toBe(0);
    tick(MUTE_FADE_S * 1000 + 100);
    expect(el("growth").paused).toBe(true);
    expect(el("growth").currentTime).toBe(0);
    play("growth");
    expect(el("growth").paused).toBe(false);
    expect(el("growth").currentTime).toBe(0);
  });
});

describe("the bass", () => {
  it("every track goes through a high-pass and a low-shelf cut before the master volume", () => {
    const { ctx, fader, play } = rig();
    play("growth");
    const hp = fader("growth").out[0] as FakeBiquad;
    expect(hp.type).toBe("highpass");
    expect(hp.frequency.value).toBe(BASS.highpassHz);
    const shelf = hp.out[0] as FakeBiquad;
    expect(shelf.type).toBe("lowshelf");
    expect(shelf.frequency.value).toBe(BASS.shelfHz);
    expect(shelf.gain.value, "a cut, not a boost").toBeLessThan(0);
    const master = shelf.out[0] as FakeGain;
    expect(master.gain.value).toBe(VOLUME);
    expect(master.out[0]).toBe(ctx.destination);
  });

  it("the trim is modest: the bass is turned down, not removed", () => {
    expect(BASS.highpassHz).toBeLessThanOrEqual(60); // under the kick and bass line
    expect(BASS.shelfDb).toBeGreaterThanOrEqual(-8);
    expect(BASS.shelfDb).toBeLessThanOrEqual(-2);
  });

  it("a second track shares the chain rather than building another", () => {
    const { fader, play } = rig();
    play("growth");
    play("jungle");
    expect(fader("jungle").out[0]).toBe(fader("growth").out[0]);
  });
});

describe("waking up", () => {
  it("unlock starts a suspended context (called from the tap itself)", () => {
    const { ctx, m } = rig();
    m.unlock();
    expect(ctx.resumes).toBe(1);
    expect(ctx.state).toBe("running");
    m.unlock();
    expect(ctx.resumes, "a running context is left alone").toBe(1);
  });
});

describe("without Web Audio it plays as it always did", () => {
  it("no AudioContext at all: element volume fades, and switching still restarts from the top", () => {
    const { el, play, tick } = rig({ webAudio: false });
    play("growth");
    expect(el("growth").paused).toBe(false);
    tick(START_FADE_S * 1000 + 200);
    expect(el("growth").volume).toBeCloseTo(VOLUME);
    el("growth").currentTime = 30;
    play("jungle");
    tick(FADE_S * 1000 + 200);
    expect(el("growth").paused).toBe(true);
    expect(el("growth").currentTime).toBe(0);
    expect(el("jungle").volume).toBeCloseTo(VOLUME);
  });

  it("a graph that refuses to build falls back the same way", () => {
    const { el, play, tick } = rig({ brokenGraph: true });
    play("growth");
    tick(START_FADE_S * 1000 + 200);
    expect(el("growth").paused).toBe(false);
    expect(el("growth").volume).toBeCloseTo(VOLUME);
  });
});

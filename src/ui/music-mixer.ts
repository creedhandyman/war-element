/** THE MUSIC MIXER — every track through one small Web Audio graph.
 *
 *  The soundtrack used to be bare `<audio>` elements, played and paused. Three
 *  things were wrong with that, all owner-reported:
 *
 *   1. A track came back where it had stopped. A pooled element that was paused
 *      mid-song was only rewound if it had played to its END, so leaving a
 *      battle brought the menu theme back in the middle of the song.
 *   2. Every change was a hard cut, in and out of battle included.
 *   3. The low end was too heavy: saturated bass, worst on a phone speaker.
 *
 *  So each element now feeds its own GainNode (the fader), and all of them share
 *  one chain: a high-pass under the audible bass, a low-shelf cut, then the
 *  master volume. The fades are gain automation rather than `audio.volume`,
 *  because iOS Safari ignores `volume` on a media element entirely.
 *
 *  The rules the tests pin:
 *   - A track that STOPS is rewound, so the next time it plays it starts from
 *     the top.
 *   - Changing track crossfades. The outgoing track fades out and is paused
 *     only once it is silent.
 *   - Coming back to a track that is still fading out picks it back up where it
 *     is, because it never went silent. Only a track that fully stopped restarts.
 *   - With no Web Audio at all (or a graph that refuses to build), it still
 *     plays exactly as it used to: element volume, no filter.
 *
 *  Pure TypeScript with its browser pieces injected (`MixerEnv`), so the fades,
 *  the restarts and the graph can be tested without a browser. */

/** A change of track: the outgoing one fades out as this one fades in. */
export const FADE_S = 1.4;
/** A start with nothing to crossfade from (the first track, after a mute, the
 *  next track of a playlist after the last one ENDED): a short fade-in, so the
 *  first beat does not arrive as a click. */
export const START_FADE_S = 0.5;
/** Mute is a fade too, just a quick one. */
export const MUTE_FADE_S = 0.3;

/** THE BASS. The tracks are mastered heavy, and a phone speaker turns that
 *  low end into saturation. This takes out the sub-bass rumble nothing can
 *  reproduce (it only eats headroom), then turns the bass itself down a few dB.
 *  It is a TRIM, not a thinning: the kick and the bass line are still there. */
export const BASS = {
  /** High-pass corner, Hz. Below this is rumble, not music. */
  highpassHz: 40,
  /** Low-shelf corner, Hz, and how far below it is turned down, dB. */
  shelfHz: 150,
  shelfDb: -5,
} as const;

export interface MixerEnv {
  makeAudio(src: string): HTMLAudioElement;
  /** A new AudioContext, or null where there is none. */
  makeContext(): AudioContext | null;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

interface Voice {
  el: HTMLAudioElement;
  /** The fader. Null when the graph could not be built (element volume instead). */
  gain: GainNode | null;
  /** The pending pause that follows a fade-out. Set = still fading out. */
  stopAt: unknown;
  /** Fallback volume ramp (no Web Audio): the timer stepping it. */
  volTimer: unknown;
}

export interface PlayOptions {
  loop: boolean;
  /** A playlist's hand-over when this track ends. */
  onEnded?: (() => void) | null;
}

export class MusicMixer {
  private ctx: AudioContext | null = null;
  private input: AudioNode | null = null;
  private graphTried = false;
  private voices = new Map<string, Voice>();
  private current: string | null = null;

  constructor(private readonly env: MixerEnv, private readonly volume: number) {}

  /** Build the graph if it is not built, and wake it. Call from INSIDE a user
   *  gesture: iOS will only start (or restart, after an interruption) an
   *  AudioContext there, and a context that stays suspended is silence. */
  unlock(): void {
    const c = this.graph();
    if (c && c.state !== "running") void c.resume().catch(() => {});
  }

  /** Make `key` the one track playing.
   *
   *  The current track asked for again only makes sure it is playing: the hook
   *  re-runs for reasons that are not a change of track (the first tap, a new
   *  playlist that starts on the same theme). */
  play(key: string, src: string, opts: PlayOptions): void {
    const v = this.voice(key, src);
    v.el.loop = opts.loop;
    // ASSIGNED, not added: elements are pooled, and a listener added on every
    // pass through a playlist would advance it in growing multiples.
    v.el.onended = opts.onEnded ?? null;

    if (this.current === key && v.stopAt == null) {
      if (v.el.paused) this.start(v); // still autoplay-blocked: try again
      return;
    }

    // Who is audible right now decides the fade: a crossfade from a playing
    // track, a short fade-in from silence.
    const from = this.current ? this.voices.get(this.current) : undefined;
    const audible = !!from && from !== v && !from.el.paused && !from.el.ended;
    for (const [k, other] of this.voices) if (k !== key) this.fadeOut(other, FADE_S);
    this.current = key;

    if (v.stopAt != null) {
      // Still fading out, so still audible: pick it back up where it is.
      this.env.clearTimeout(v.stopAt);
      v.stopAt = null;
      this.rampTo(v, 1, FADE_S);
      if (v.el.paused) this.start(v);
      return;
    }
    // Stopped: from the top (the fade-out rewound it), faded in from silence.
    this.start(v);
    this.fadeInFromSilence(v, audible ? FADE_S : START_FADE_S);
  }

  /** Fade everything out and stop it (mute, or leaving the page). */
  stop(fade = MUTE_FADE_S): void {
    this.current = null;
    for (const v of this.voices.values()) this.fadeOut(v, fade);
  }

  /** Stop at once and forget every element (unmount). */
  dispose(): void {
    for (const v of this.voices.values()) {
      if (v.stopAt != null) this.env.clearTimeout(v.stopAt);
      if (v.volTimer != null) this.env.clearTimeout(v.volTimer);
      v.el.pause();
      v.el.onended = null;
    }
    this.voices.clear();
    this.current = null;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private graph(): AudioContext | null {
    if (this.graphTried) return this.ctx;
    this.graphTried = true;
    const c = this.env.makeContext();
    if (!c) return null;
    try {
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = BASS.highpassHz;
      hp.Q.value = Math.SQRT1_2; // Butterworth: no bump at the corner
      const shelf = c.createBiquadFilter();
      shelf.type = "lowshelf";
      shelf.frequency.value = BASS.shelfHz;
      shelf.gain.value = BASS.shelfDb;
      const master = c.createGain();
      master.gain.value = this.volume;
      hp.connect(shelf);
      shelf.connect(master);
      master.connect(c.destination);
      this.ctx = c;
      this.input = hp;
    } catch {
      this.ctx = null;
      this.input = null;
    }
    return this.ctx;
  }

  private voice(key: string, src: string): Voice {
    const have = this.voices.get(key);
    if (have) return have;
    const el = this.env.makeAudio(src);
    el.preload = "auto";
    let gain: GainNode | null = null;
    const c = this.graph();
    if (c && this.input) {
      try {
        const source = c.createMediaElementSource(el);
        gain = c.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(this.input);
        el.volume = 1; // the fader and the master do the levels now
      } catch {
        gain = null;
      }
    }
    if (!gain) el.volume = 0;
    const v: Voice = { el, gain, stopAt: null, volTimer: null };
    this.voices.set(key, v);
    return v;
  }

  private start(v: Voice): void {
    // A context left suspended (no gesture yet, or iOS after an interruption)
    // would swallow the element's sound, so every start also nudges it awake.
    if (this.ctx && this.ctx.state !== "running") void this.ctx.resume().catch(() => {});
    void v.el.play().catch(() => {}); // still gesture-blocked: the next tap retries
  }

  /** Fade out, then pause AND rewind, so a later play starts from the top. A
   *  voice that is already silent is stopped at once. */
  private fadeOut(v: Voice, secs: number): void {
    if (v.stopAt != null) return; // already on its way out
    const silent = v.el.paused || v.el.ended;
    if (silent || secs <= 0) {
      this.rampTo(v, 0, 0);
      this.halt(v);
      return;
    }
    this.rampTo(v, 0, secs);
    v.stopAt = this.env.setTimeout(() => {
      v.stopAt = null;
      this.halt(v);
    }, secs * 1000 + 60);
  }

  private halt(v: Voice): void {
    v.el.pause();
    try { v.el.currentTime = 0; } catch { /* not seekable yet: it has not played either */ }
  }

  /** 0 → full over `secs`, anchored at 0 explicitly. A hold-then-ramp would
   *  hold whatever the timeline last said, and a zero set in the same instant
   *  is exactly what a hold cancels. */
  private fadeInFromSilence(v: Voice, secs: number): void {
    if (v.gain && this.ctx) {
      const g = v.gain.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(0, now);
      g.linearRampToValueAtTime(1, now + secs);
      return;
    }
    if (v.volTimer != null) this.env.clearTimeout(v.volTimer);
    v.volTimer = null;
    v.el.volume = 0;
    this.rampTo(v, 1, secs);
  }

  /** Move a voice's level to `to` (0..1) over `secs`: gain automation when
   *  there is a graph, stepped element volume when there is not. */
  private rampTo(v: Voice, to: number, secs: number): void {
    if (v.gain && this.ctx) {
      const g = v.gain.gain;
      const now = this.ctx.currentTime;
      // Hold wherever a running fade has got to, then ramp from there. Where
      // cancelAndHoldAtTime is missing, the current value is the next best
      // anchor.
      if (typeof g.cancelAndHoldAtTime === "function") g.cancelAndHoldAtTime(now);
      else {
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
      }
      if (secs <= 0) g.setValueAtTime(to, now);
      else g.linearRampToValueAtTime(to, now + secs);
      return;
    }
    // No graph. `volume` is the only fader (and on iOS it does nothing, which
    // leaves the old hard cut, never worse than before).
    if (v.volTimer != null) this.env.clearTimeout(v.volTimer);
    v.volTimer = null;
    const target = to * this.volume;
    if (secs <= 0) { v.el.volume = target; return; }
    const steps = Math.max(1, Math.round(secs * 20));
    const from = v.el.volume;
    let i = 0;
    const step = () => {
      i++;
      v.el.volume = Math.min(1, Math.max(0, from + ((target - from) * i) / steps));
      v.volTimer = i < steps ? this.env.setTimeout(step, 50) : null;
    };
    v.volTimer = this.env.setTimeout(step, 50);
  }
}

/** The real browser, for the hook. */
export function browserMixerEnv(): MixerEnv {
  type Ctor = new () => AudioContext;
  return {
    makeAudio: (src) => new Audio(src),
    makeContext: () => {
      try {
        const w = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
        const C = w.AudioContext ?? w.webkitAudioContext;
        if (!C) return null;
        // iOS: route like the <audio> elements always did, as media playback.
        // Without it the graph follows the ringer switch, and a phone on silent
        // would lose music it used to play.
        const nav = globalThis.navigator as unknown as { audioSession?: { type: string } } | undefined;
        try { if (nav?.audioSession) nav.audioSession.type = "playback"; } catch { /* older Safari */ }
        return new C();
      } catch {
        return null;
      }
    },
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
  };
}

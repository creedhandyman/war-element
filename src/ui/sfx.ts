/** SOUND EFFECTS — synthesized, because there are none to load.
 *
 *  The game ships ten music tracks and not one sound effect: no `/sfx`
 *  directory, no player, nothing. So this generates the sound rather than
 *  fetching it. A file would be nicer and a file can replace this later; what a
 *  file cannot do is exist before somebody records it, and a `<audio src>`
 *  pointing at a path with nothing behind it is a silent 404 on every level-up.
 *
 *  EVERYTHING HERE FAILS QUIET. Web Audio is missing in some embedded browsers,
 *  suspended until a gesture in most, and refused outright in a few — and none
 *  of that is worth an exception on a screen celebrating something. A level-up
 *  with no sound is a level-up; a level-up that throws is a broken app.
 */

/** The music mute is the whole audio preference — the game has no second
 *  toggle, and a player who muted the soundtrack did not ask to be chimed at. */
function muted(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    // Effects have their own switch (`we_sfx_muted`). A device that has never set it
    // follows the music mute, as it always did, so nobody who muted the game before
    // this existed is suddenly chimed at.
    const own = localStorage.getItem("we_sfx_muted");
    if (own === "1") return true;
    if (own === "0") return false;
    return localStorage.getItem("we_music_muted") === "1";
  } catch {
    return false; // private mode can throw on read; silence is not the default
  }
}

type Ctor = new () => AudioContext;

/** One context, made on first use and reused.
 *
 *  Browsers cap how many a page may open, and a level-up can fire twice in a
 *  session as easily as once. Not created at module load: constructing one
 *  before any user gesture is what gets a page flagged as autoplaying. */
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const w = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
    const C = w.AudioContext ?? w.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    return ctx;
  } catch {
    return null;
  }
}

/** One note: a sine with a short attack and an exponential tail.
 *
 *  Exponential rather than linear, and never to exactly zero — `exponentialRamp`
 *  is undefined at 0 and a linear tail on a sine is the click you hear at the
 *  end of a cheap beep. */
function note(c: AudioContext, freq: number, at: number, dur: number, peak: number): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** LEVEL UP: a major arpeggio that lands on the octave.
 *
 *  C5-E5-G5-C6, overlapping so it reads as one gesture rather than four beeps,
 *  and the last note is longer and louder because it is the one the player is
 *  meant to hear as the arrival. Quiet on purpose (0.16 peak): this fires while
 *  the soundtrack is still playing underneath it. */
export function playLevelUp(): void {
  if (muted()) return;
  const c = audio();
  if (!c) return;
  try {
    // Suspended is the normal state before a gesture. The level-up always
    // follows a tap — a pack, a boss, a clear — so this resolves in practice,
    // and when it does not the sound is simply skipped.
    void c.resume?.();
    const t = c.currentTime + 0.01;
    note(c, 523.25, t, 0.18, 0.13);        // C5
    note(c, 659.25, t + 0.085, 0.18, 0.13); // E5
    note(c, 783.99, t + 0.17, 0.2, 0.14);   // G5
    note(c, 1046.5, t + 0.255, 0.5, 0.16);  // C6, the landing
  } catch {
    /* an audio failure is never worth a broken screen */
  }
}

// ── GAME FEEL ────────────────────────────────────────────────────────────────
// A match used to be silent apart from the soundtrack: a card landed, a card
// died, you won, and nothing in your ears said so. These are the small sounds
// that make a tap feel like it did something. All synthesized (see the header),
// all short, and all quiet enough to sit under the music.

/** Everything the game can say. `power` (0..1) scales hits only. */
export type Sfx =
  | "tap" | "place" | "hit" | "break" | "win" | "lose" | "claim" | "turn"
  | "tear" | "flip" | "rare" | "epic" | "legend" | "mythic";

/** One bus for every game sound: a limiter in front of the speakers, so a board
 *  full of simultaneous hits is loud rather than clipped. Made once per context. */
let bus: { ctx: BaseAudioContext; input: GainNode } | null = null;
function busFor(c: BaseAudioContext): AudioNode {
  if (bus && bus.ctx === c) return bus.input;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 20;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.22;
  const input = c.createGain();
  input.gain.value = 0.9;
  input.connect(comp).connect(c.destination);
  bus = { ctx: c, input };
  return input;
}

interface Tone { type?: OscillatorType; f0: number; f1?: number; at: number; dur: number; peak: number }

/** A note that can glide: attack, then an exponential fall (never to exactly 0). */
function tone(c: BaseAudioContext, dest: AudioNode, o: Tone): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f0, o.at);
  if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), o.at + o.dur);
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.exponentialRampToValueAtTime(o.peak, o.at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  osc.connect(g).connect(dest);
  osc.start(o.at);
  osc.stop(o.at + o.dur + 0.02);
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(c: BaseAudioContext): AudioBuffer {
  let b = noiseBuffers.get(c);
  if (!b) {
    b = c.createBuffer(1, Math.floor(c.sampleRate * 0.6), c.sampleRate);
    const d = b.getChannelData(0);
    let s = 1234567; // a fixed seed: the same crunch every time
    for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 2147483648) - 1; }
    noiseBuffers.set(c, b);
  }
  return b;
}

interface Noise { filter: BiquadFilterType; f0: number; f1?: number; q?: number; at: number; dur: number; peak: number }

/** A burst of filtered noise that sweeps — the body of every whoosh, thud and crack. */
function noise(c: BaseAudioContext, dest: AudioNode, o: Noise): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = o.filter;
  f.Q.value = o.q ?? 0.9;
  f.frequency.setValueAtTime(o.f0, o.at);
  if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), o.at + o.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.exponentialRampToValueAtTime(o.peak, o.at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  src.connect(f).connect(g).connect(dest);
  src.start(o.at);
  src.stop(o.at + Math.min(o.dur + 0.02, 0.58));
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, B5 = 987.77, C6 = 1046.5, E6 = 1318.5, G6 = 1568;

/** Draw one sound onto any audio context (live or offline — the checks render
 *  them offline). `t` is when it starts. */
export function renderSfx(c: BaseAudioContext, kind: Sfx, t: number, power = 1): void {
  const d = busFor(c);
  const p = Math.max(0, Math.min(1, power));
  switch (kind) {
    case "tap": // a soft tick: a card picked up, a slot chosen
      tone(c, d, { type: "triangle", f0: 1100, f1: 700, at: t, dur: 0.07, peak: 0.2 });
      break;
    case "place": // a card set down on the board: a low thud with a little grit
      // Phone speakers give up below ~150 Hz, so the thud is built in the mid range
      // (a knock) with the sub underneath for the ones that can play it.
      tone(c, d, { f0: 280, f1: 120, at: t, dur: 0.14, peak: 0.42 });
      tone(c, d, { type: "triangle", f0: 140, f1: 62, at: t, dur: 0.18, peak: 0.3 });
      noise(c, d, { filter: "lowpass", f0: 1800, f1: 420, at: t, dur: 0.08, peak: 0.2 });
      break;
    case "hit": // a blow: crack on top of a thump, both bigger with the damage
      noise(c, d, { filter: "bandpass", f0: 2600, f1: 600, q: 1.1, at: t, dur: 0.11, peak: 0.2 + 0.2 * p });
      tone(c, d, { f0: 250, f1: 90, at: t, dur: 0.13, peak: 0.3 + 0.22 * p });
      break;
    case "break": // a card goes down: the blow, then glass
      noise(c, d, { filter: "bandpass", f0: 2200, f1: 450, q: 1.1, at: t, dur: 0.13, peak: 0.34 });
      tone(c, d, { f0: 220, f1: 70, at: t, dur: 0.22, peak: 0.5 });
      tone(c, d, { type: "triangle", f0: 700, f1: 190, at: t + 0.04, dur: 0.3, peak: 0.16 });
      noise(c, d, { filter: "highpass", f0: 3200, at: t + 0.03, dur: 0.22, peak: 0.12 });
      break;
    case "win": // the fanfare: a rising arpeggio, then the chord holds
      [C5, E5, G5, C6, E6].forEach((f, i) => tone(c, d, { f0: f, at: t + i * 0.085, dur: 0.34, peak: 0.2 }));
      [C5, E5, G5, C6].forEach((f) => tone(c, d, { type: "triangle", f0: f, at: t + 0.42, dur: 1.0, peak: 0.1 }));
      tone(c, d, { f0: G6, at: t + 0.6, dur: 0.7, peak: 0.07 });
      break;
    case "lose": // three notes stepping down, slow and unhurried — not a scold
      [220, 174.6, 146.8].forEach((f, i) => tone(c, d, { type: "triangle", f0: f * 2, at: t + i * 0.3, dur: 0.6, peak: 0.17 }));
      break;
    case "claim": // a coin: two bright pings
      tone(c, d, { f0: E6, at: t, dur: 0.16, peak: 0.16 });
      tone(c, d, { f0: 1760, at: t + 0.07, dur: 0.3, peak: 0.16 });
      break;
    case "turn": // your move: two soft notes rising
      tone(c, d, { f0: E5, at: t, dur: 0.14, peak: 0.12 });
      tone(c, d, { f0: 880, at: t + 0.09, dur: 0.22, peak: 0.12 });
      break;
    case "tear": // a pack's foil ripping
      noise(c, d, { filter: "bandpass", f0: 700, f1: 4200, q: 0.8, at: t, dur: 0.38, peak: 0.26 });
      noise(c, d, { filter: "highpass", f0: 2500, at: t + 0.05, dur: 0.3, peak: 0.12 });
      break;
    case "flip": // a card turning over
      noise(c, d, { filter: "highpass", f0: 400, f1: 3600, at: t, dur: 0.16, peak: 0.1 });
      break;
    case "rare":
      renderSfx(c, "flip", t);
      tone(c, d, { f0: G5, at: t + 0.1, dur: 0.38, peak: 0.16 });
      break;
    case "epic":
      renderSfx(c, "flip", t);
      tone(c, d, { f0: G5, at: t + 0.1, dur: 0.4, peak: 0.18 });
      tone(c, d, { f0: B5, at: t + 0.17, dur: 0.5, peak: 0.18 });
      break;
    case "legend":
      renderSfx(c, "flip", t);
      [C5, E5, G5, C6].forEach((f, i) => tone(c, d, { f0: f, at: t + 0.08 + i * 0.075, dur: 0.6, peak: 0.19 }));
      tone(c, d, { f0: G6, at: t + 0.45, dur: 0.8, peak: 0.09 });
      break;
    case "mythic": // the room drops away, then the chord
      tone(c, d, { f0: 96, f1: 38, at: t, dur: 0.9, peak: 0.4 });
      tone(c, d, { f0: 190, f1: 70, at: t, dur: 0.6, peak: 0.4 });
      noise(c, d, { filter: "lowpass", f0: 2400, f1: 160, at: t, dur: 0.7, peak: 0.24 });
      [C5, E5, G5, C6, E6].forEach((f, i) => tone(c, d, { f0: f, at: t + 0.18 + i * 0.07, dur: 1.2, peak: 0.17 }));
      [C5, G5, C6].forEach((f) => tone(c, d, { type: "triangle", f0: f, at: t + 0.55, dur: 1.4, peak: 0.12 }));
      break;
  }
}

/** The least time between two of the same sound. A board resolving a whole round
 *  can change dozens of numbers in one frame; one thud for that, not a roar. */
const GAP_MS: Partial<Record<Sfx, number>> = { tap: 40, place: 90, hit: 70, break: 120, turn: 600 };
const lastAt = new Map<Sfx, number>();

/** Play a game sound. Silent when the music is muted, when audio is unavailable,
 *  or when the same sound just played. Never throws. */
export function playSfx(kind: Sfx, power = 1): void {
  if (muted()) return;
  const c = audio();
  if (!c) return;
  try {
    const now = Date.now();
    const gap = GAP_MS[kind] ?? 0;
    if (gap && now - (lastAt.get(kind) ?? 0) < gap) return;
    lastAt.set(kind, now);
    void c.resume?.();
    renderSfx(c, kind, c.currentTime + 0.005, power);
  } catch {
    /* sound is a garnish */
  }
}

/** A short buzz on phones that have a motor (Android; iOS has none). Not tied to
 *  the music mute — it is silent — but off for anyone who asked for less motion. */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate(pattern);
  } catch {
    /* no vibration is the same as none */
  }
}

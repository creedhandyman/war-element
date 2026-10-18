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

// ── MOMENTS ──────────────────────────────────────────────────────────────────
// The game used to answer every tap, card landing, blow and claim with a sound,
// and that was too much: the soundtrack is already playing, and a noise on every
// action turns into noise. Effects are now kept for the few moments that deserve
// one — winning, a pack card that is a big pull — and each is a soft, bell-like
// phrase rather than a blip. Nothing here fires per action or per card.

/** Everything the game can say. */
export type Sfx = "win" | "epic" | "legend" | "mythic";

/** One bus for every game sound: a gentle limiter in front of the speakers. */
let bus: { ctx: BaseAudioContext; input: GainNode } | null = null;
function busFor(c: BaseAudioContext): AudioNode {
  if (bus && bus.ctx === c) return bus.input;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 24;
  comp.ratio.value = 4;
  comp.attack.value = 0.01;
  comp.release.value = 0.3;
  const input = c.createGain();
  input.gain.value = 0.7;
  input.connect(comp).connect(c.destination);
  bus = { ctx: c, input };
  return input;
}

/** A soft bell: a sine with a quiet octave above it, a slow attack so there is no
 *  click and no "blip", and a long exponential fall (never to exactly 0). */
function bell(c: BaseAudioContext, dest: AudioNode, freq: number, at: number, dur: number, peak: number): void {
  const parts: Array<[number, number]> = [[1, 1], [2, 0.18]];
  for (const [mult, level] of parts) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * mult;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * level), at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, B5 = 987.77, C6 = 1046.5, E6 = 1318.5;

/** Draw one sound onto any audio context (live or offline — the checks render
 *  them offline). `t` is when it starts. All mid-range: phone speakers give up
 *  below ~150 Hz, and a low boom is exactly the kind of thing that was too much. */
export function renderSfx(c: BaseAudioContext, kind: Sfx, t: number): void {
  const d = busFor(c);
  switch (kind) {
    case "win": // C-E-G rising, then the C above rings out
      [C5, E5, G5].forEach((f, i) => bell(c, d, f, t + i * 0.16, 0.9, 0.12));
      bell(c, d, C6, t + 0.5, 1.6, 0.13);
      break;
    case "epic": // two notes, a third apart
      bell(c, d, G5, t, 0.9, 0.1);
      bell(c, d, B5, t + 0.14, 1.1, 0.1);
      break;
    case "legend": // an open arpeggio
      [C5, E5, G5, C6].forEach((f, i) => bell(c, d, f, t + i * 0.12, 1.3, 0.1));
      break;
    case "mythic": // the same, taller, and it hangs in the air
      [C5, G5, C6, E6].forEach((f, i) => bell(c, d, f, t + i * 0.14, 1.9, 0.1));
      bell(c, d, G5, t + 0.6, 2.0, 0.08);
      break;
  }
}

/** Play a game sound. Silent when the music is muted, when audio is unavailable,
 *  or when a sound just played (a pack's cards can turn quickly). Never throws. */
let lastAt = 0;
export function playSfx(kind: Sfx): void {
  if (muted()) return;
  const c = audio();
  if (!c) return;
  try {
    const now = Date.now();
    if (now - lastAt < 700) return;
    lastAt = now;
    void c.resume?.();
    renderSfx(c, kind, c.currentTime + 0.005);
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

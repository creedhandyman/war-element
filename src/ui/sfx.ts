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
    return typeof localStorage !== "undefined" && localStorage.getItem("we_music_muted") === "1";
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

import { useEffect, useRef, useState } from "react";
import { CARD_INDEX } from "../data/cards";
import { browserMixerEnv, MusicMixer } from "./music-mixer";

/** Background music. Growth on the home/menu screen, a per-region theme whenever
 *  Story Mode is on screen — the region map and its battles share one track, so
 *  a region reads as a place rather than a series of fights — and in an Arena
 *  BATTLE, a playlist of the elements on the table rather than any single track.
 *
 *  Pass one track to loop it, or several to play them in turn and wrap. The
 *  battle playlist is built by `battlePlaylist` below.
 *
 *  Browsers block autoplay until the first user gesture, so we retry play() once
 *  the page has been interacted with. A mute toggle is persisted to localStorage.
 *
 *  The playing itself (crossfades, restarting a track from the top, the bass
 *  trim) is `music-mixer.ts`; this hook only decides WHICH track.
 */
export const TRACKS = {
  menu: "/music/growth.mp3",
  battle: "/music/rival.mp3",
  leaf: "/music/jungle.mp3",
  pyro: "/music/scorched-horizon.mp3",
  aqua: "/music/atlantic.mp3",
  bolt: "/music/city.mp3",
  gale: "/music/cyclone.mp3",
  bore: "/music/quake.mp3",
  dusk: "/music/underground.mp3",
  dawn: "/music/stars-of-dawn.mp3",
} as const;

export type MusicTrack = keyof typeof TRACKS;
/** Kept for the two non-story states, which are still just "where am I". */
export type MusicMode = "menu" | "battle";

/** Region id -> its theme. A region with no entry falls back to the normal
 *  menu/battle pair, so shipping a region's map before its music is not a break
 *  — which is how BOLT shipped, and then DAWN, the last of the eight. All eight
 *  elements have their own theme now, so this map is complete and a new entry
 *  here means a new REGION rather than a gap being filled. */
export const REGION_TRACK: Partial<Record<string, MusicTrack>> = {
  leaf: "leaf",
  pyro: "pyro",
  aqua: "aqua",
  bolt: "bolt",
  gale: "gale",
  bore: "bore",
  dusk: "dusk",
  dawn: "dawn",
};

const VOLUME = 0.45;

/** The eight element themes in the game's own element order — the ORDER a battle
 *  playlist is built in, not a playlist anyone plays start to finish.
 *
 *  It was `ARENA_PLAYLIST` and did briefly run whole in the Arena lobby. That
 *  was wrong twice over: the elements belong to the FIGHT, and cycling eight
 *  tracks on a screen you are meant to leave made Growth something you only
 *  heard on the way past. */
export const ELEMENT_TRACKS: MusicTrack[] = [
  "leaf", "pyro", "aqua", "bolt", "gale", "bore", "dusk", "dawn",
];

/** The themes for the elements actually on the table, in that same order.
 *
 *  A match between two dual-element decks is four themes; two mono decks of the
 *  same element is one, and one is a loop. Empty (a deck of unknown ids) falls
 *  back to Rival, which is the only thing left that still plays it — every other
 *  path now has an element to name. */
export function battlePlaylist(...decks: string[][]): MusicTrack[] {
  const seen = new Set<string>();
  for (const deck of decks)
    for (const id of deck) {
      const def = CARD_INDEX[id];
      if (def) seen.add(def.element.toLowerCase());
    }
  const out = ELEMENT_TRACKS.filter((t) => seen.has(t));
  return out.length ? out : ["battle"];
}

export function useGameMusic(track: MusicTrack | MusicTrack[]): { muted: boolean; toggle: () => void } {
  const [muted, setMuted] = useState<boolean>(
    () => typeof localStorage !== "undefined" && localStorage.getItem("we_music_muted") === "1",
  );
  const [unlocked, setUnlocked] = useState(false);
  // The mixer (music-mixer.ts) owns the elements, the fades and the bass
  // filter. Its elements are still built on demand rather than up front: the
  // library is ten tracks at 96kbps, 1.7-2.4MB each, about 23MB of audio
  // against a session that hears one region's theme or one Arena playlist.
  const mixerRef = useRef<MusicMixer | null>(null);
  const mixer = () => (mixerRef.current ??= new MusicMixer(browserMixerEnv(), VOLUME));

  // Stop and drop everything on unmount.
  useEffect(() => () => { mixerRef.current?.dispose(); mixerRef.current = null; }, []);

  // Unlock audio on a user gesture (autoplay is blocked before one). The mixer
  // is woken INSIDE the gesture, because iOS starts an AudioContext nowhere
  // else. It listens on every tap, not just the first, because iOS also
  // suspends the context on an interruption (a call, the app backgrounded)
  // and only a later tap can start it again. `setUnlocked(true)` after the
  // first is a no-op render.
  useEffect(() => {
    const on = () => { mixer().unlock(); setUnlocked(true); };
    window.addEventListener("pointerdown", on);
    window.addEventListener("keydown", on);
    return () => { window.removeEventListener("pointerdown", on); window.removeEventListener("keydown", on); };
    // `mixer` reads a ref and is stable in effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = Array.isArray(track) ? track : [track];
  // The effect keys on the JOINED STRING, not the array. Callers build these
  // from deck contents and hand over a fresh array every render, so depending on
  // the array itself would restart the music on every render — which is silence,
  // since nothing ever gets more than a frame to play.
  const key = list.join(",");
  const [step, setStep] = useState(0);
  // A different playlist starts at its own beginning rather than wherever the
  // last one had got to.
  useEffect(() => { setStep(0); }, [key]);
  const current = list[step % list.length] ?? list[0];

  // Play the track that matches the current state. The mixer crossfades from
  // whatever was playing and starts a track that had stopped from the top.
  // Re-runs when `unlocked` flips so the first gesture kicks playback off.
  useEffect(() => {
    if (muted) { mixer().stop(); return; }
    // A lone track loops; a playlist hands over at the end.
    const many = list.length > 1;
    mixer().play(current, TRACKS[current], {
      loop: !many,
      onEnded: many ? () => setStep((i) => (i + 1) % list.length) : null,
    });
    // `list` is `key`, and `mixer` reads a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, key, muted, unlocked]);

  const toggle = () =>
    setMuted((v) => {
      const next = !v;
      try { localStorage.setItem("we_music_muted", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });

  return { muted, toggle };
}

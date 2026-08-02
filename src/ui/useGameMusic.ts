import { useEffect, useRef, useState } from "react";

/** Background music. Growth on the home/menu screen, Rival in a non-story
 *  battle, and a per-region theme whenever Story Mode is on screen — the region
 *  map and its battles share one track, so a region reads as a place rather than
 *  a series of fights.
 *
 *  Browsers block autoplay until the first user gesture, so we retry play() once
 *  the page has been interacted with. A mute toggle is persisted to localStorage.
 */
export const TRACKS = {
  menu: "/music/growth.mp3",
  battle: "/music/rival.mp3",
  leaf: "/music/jungle.mp3",
  pyro: "/music/scorched-horizon.mp3",
  aqua: "/music/atlantic.mp3",
} as const;

export type MusicTrack = keyof typeof TRACKS;
/** Kept for the two non-story states, which are still just "where am I". */
export type MusicMode = "menu" | "battle";

/** Region id -> its theme. A region with no entry falls back to the normal
 *  menu/battle pair, so shipping AQUA's map before its music is not a break. */
export const REGION_TRACK: Partial<Record<string, MusicTrack>> = {
  leaf: "leaf",
  pyro: "pyro",
  aqua: "aqua",
};

const VOLUME = 0.45;

export function useGameMusic(track: MusicTrack): { muted: boolean; toggle: () => void } {
  const [muted, setMuted] = useState<boolean>(
    () => typeof localStorage !== "undefined" && localStorage.getItem("we_music_muted") === "1",
  );
  const [unlocked, setUnlocked] = useState(false);
  // Built on demand rather than up front: the four tracks are ~28MB together,
  // and a player who never opens Story Mode should never fetch its themes.
  const pool = useRef<Map<MusicTrack, HTMLAudioElement>>(new Map());

  // Stop and drop everything on unmount.
  useEffect(() => {
    const live = pool.current;
    return () => { live.forEach((a) => a.pause()); live.clear(); };
  }, []);

  // Unlock audio on the first user gesture (autoplay is blocked before that).
  useEffect(() => {
    if (unlocked) return;
    const on = () => setUnlocked(true);
    window.addEventListener("pointerdown", on, { once: true });
    window.addEventListener("keydown", on, { once: true });
    return () => { window.removeEventListener("pointerdown", on); window.removeEventListener("keydown", on); };
  }, [unlocked]);

  // Play the track that matches the current state; pause every other one.
  // Re-runs when `unlocked` flips so the first gesture kicks playback off.
  useEffect(() => {
    for (const [key, audio] of pool.current) if (key !== track || muted) audio.pause();
    if (muted) return;
    let audio = pool.current.get(track);
    if (!audio) {
      audio = new Audio(TRACKS[track]);
      audio.loop = true;
      audio.volume = VOLUME;
      audio.preload = "auto";
      pool.current.set(track, audio);
    }
    void audio.play().catch(() => {}); // still gesture-blocked → the unlock effect retries
  }, [track, muted, unlocked]);

  const toggle = () =>
    setMuted((v) => {
      const next = !v;
      try { localStorage.setItem("we_music_muted", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });

  return { muted, toggle };
}

import { useEffect, useRef, useState } from "react";

/** Background music: Growth on the home/menu screen, Rival in battle. Two looped
 *  tracks, cross-switched by `mode`. Browsers block autoplay until the first
 *  user gesture, so we retry play() once the page has been interacted with. A
 *  mute toggle is persisted to localStorage. */
export type MusicMode = "menu" | "battle";

const VOLUME = 0.45;

export function useGameMusic(mode: MusicMode): { muted: boolean; toggle: () => void } {
  const [muted, setMuted] = useState<boolean>(
    () => typeof localStorage !== "undefined" && localStorage.getItem("we_music_muted") === "1",
  );
  const [unlocked, setUnlocked] = useState(false);
  const menuRef = useRef<HTMLAudioElement | null>(null);
  const battleRef = useRef<HTMLAudioElement | null>(null);

  // Build the two audio elements once.
  useEffect(() => {
    const menu = new Audio("/music/growth.mp3");
    const battle = new Audio("/music/rival.mp3");
    for (const a of [menu, battle]) { a.loop = true; a.volume = VOLUME; a.preload = "auto"; }
    menuRef.current = menu;
    battleRef.current = battle;
    return () => { menu.pause(); battle.pause(); menuRef.current = null; battleRef.current = null; };
  }, []);

  // Unlock audio on the first user gesture (autoplay is blocked before that).
  useEffect(() => {
    if (unlocked) return;
    const on = () => setUnlocked(true);
    window.addEventListener("pointerdown", on, { once: true });
    window.addEventListener("keydown", on, { once: true });
    return () => { window.removeEventListener("pointerdown", on); window.removeEventListener("keydown", on); };
  }, [unlocked]);

  // Play the track that matches the current mode; pause the other. Re-runs when
  // `unlocked` flips so the first gesture kicks playback off.
  useEffect(() => {
    const menu = menuRef.current;
    const battle = battleRef.current;
    if (!menu || !battle) return;
    const active = mode === "battle" ? battle : menu;
    const idle = mode === "battle" ? menu : battle;
    idle.pause();
    if (muted) { active.pause(); return; }
    void active.play().catch(() => {}); // still gesture-blocked → the unlock effect retries
  }, [mode, muted, unlocked]);

  const toggle = () =>
    setMuted((v) => {
      const next = !v;
      try { localStorage.setItem("we_music_muted", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });

  return { muted, toggle };
}

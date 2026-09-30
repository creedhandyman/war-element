/** Battles on a phone are PORTRAIT (owner's call, 2026-09-30).
 *
 *  The menus, the deck builder and the story map stay free to rotate — the
 *  manifest's `orientation: "any"` is for them — so this is scoped to a live
 *  match, and it takes the two routes the platforms actually allow:
 *
 *    LOCK where it exists. `screen.orientation.lock("portrait")` turns the
 *    screen upright and holds it there, but browsers only honour it in
 *    fullscreen, which is what the installed app runs as on Android. Anywhere
 *    else it rejects, and that rejection is expected, not an error.
 *
 *    A COVER where it does not. iOS has no lock API at all, and a browser tab
 *    cannot lock either, so a phone held sideways during a battle gets a
 *    full-screen "turn it upright" card over the match until it is.
 *
 *  Tablets and desktops are left alone: the landscape layout is theirs. */
import { useEffect, useState } from "react";

/** A phone, not a tablet: a touch-first screen whose SHORT side is phone-sized.
 *  The short side, because the long one depends on which way it is held. */
export function isPhoneScreen(screenW: number, screenH: number, coarsePointer: boolean): boolean {
  return coarsePointer && Math.min(screenW, screenH) <= 600;
}

function readPhone(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return isPhoneScreen(window.screen?.width ?? 0, window.screen?.height ?? 0, coarse);
}

/** Wider than tall. Read off the viewport rather than `(orientation)`, which
 *  this codebase has found flaky on real devices (see Hand.tsx). */
function readLandscape(): boolean {
  return typeof window !== "undefined" && window.innerWidth > window.innerHeight;
}

type LockableOrientation = ScreenOrientation & {
  lock?: (o: "portrait") => Promise<void>;
  unlock?: () => void;
};

/** Whether the match should be held behind the cover right now: a live match,
 *  on a phone, held sideways. Also requests the real lock while a match is live
 *  on a phone, and releases it when the match ends. App reads the answer twice —
 *  to draw `<RotateGate />`, and to hold a local match's auto-advance so the AI
 *  does not play out turns behind a card the player cannot see through. */
export function usePortraitGate(active: boolean): boolean {
  const [phone, setPhone] = useState(readPhone);
  const [landscape, setLandscape] = useState(readLandscape);

  useEffect(() => {
    // Read now AND a frame later: iOS fires `orientationchange` before the
    // viewport has its new size, so the first read can still be the old shape.
    let raf = 0;
    const sync = () => {
      setPhone(readPhone()); setLandscape(readLandscape());
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { setPhone(readPhone()); setLandscape(readLandscape()); });
    };
    // Every signal a turn can arrive on — not every browser sends all three.
    const mq = window.matchMedia?.("(orientation: landscape)");
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    mq?.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      mq?.removeEventListener("change", sync);
    };
  }, []);

  const on = active && phone;
  useEffect(() => {
    if (!on) return;
    const o = (typeof screen !== "undefined" ? screen.orientation : undefined) as LockableOrientation | undefined;
    let locked = false;
    let live = true;
    o?.lock?.("portrait").then(
      () => { if (live) locked = true; else o.unlock?.(); },
      () => { /* no lock here: the cover takes over */ },
    );
    return () => { live = false; if (locked) o?.unlock?.(); };
  }, [on]);

  return on && landscape;
}

/** The cover itself. Over everything, modals included: nothing under it is
 *  usable sideways, and a half-covered board would invite a tap through. */
export function RotateGate() {
  return (
    <div className="rotate-gate" role="alertdialog" aria-modal="true" aria-label="Turn your phone upright">
      <div className="rotate-gate-card">
        <div className="rotate-gate-phone" aria-hidden="true" />
        <h2>Turn your phone upright</h2>
        <p>Battles play in portrait. The match waits until you do.</p>
      </div>
    </div>
  );
}

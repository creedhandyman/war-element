/** Drives cloud AUTOSAVE (owner's call, 2026-10-03) — see `autosaveOnce` in
 *  net/account.ts for the rule it follows and why it can never overwrite
 *  another device's progress.
 *
 *  Ticks once a minute, and again the moment the app is hidden or closed —
 *  backgrounding a phone is the usual end of a session, and the last minute of
 *  play is the minute most worth keeping. `autosaveOnce` compares against the
 *  last synced save before it touches the network, so a tick with nothing new
 *  costs a localStorage read.
 *
 *  The account module is imported only when a Supabase session exists on this
 *  device (the same `sb-…-auth-token` test App uses for the email line), so a
 *  player who never signed in never downloads the SDK for this. */
import { useEffect } from "react";

export const AUTOSAVE_EVERY_MS = 60_000;

const signedIn = (): boolean => {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  } catch {
    return false;
  }
};

export function useCloudAutosave(): void {
  useEffect(() => {
    let running = false;
    const tick = () => {
      if (running || !signedIn()) return;
      running = true;
      void import("../net/account")
        .then((account) => account.autosaveOnce())
        .catch(() => undefined) // offline, or the chunk failed to load: try next tick
        .finally(() => { running = false; });
    };
    const onHide = () => { if (document.visibilityState === "hidden") tick(); };
    const id = window.setInterval(tick, AUTOSAVE_EVERY_MS);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", tick);
    };
  }, []);
}

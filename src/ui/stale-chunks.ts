/** WHEN THE GAME IS UPDATED UNDER A PLAYER WHO STILL HAS IT OPEN.
 *
 *  Screens ship in their own chunks (App.tsx `deferred`), named by content
 *  hash, and every deploy replaces them: the host keeps no copy of the last
 *  build's files, so the old names 404. A phone that loaded the game before a
 *  deploy therefore asks for a chunk that is gone the first time it opens a
 *  screen it had not opened yet. The lazy import rejected, nothing caught it,
 *  and React unmounted the whole app — leaving the page's own background and
 *  gold frame and nothing else. Reported as "selecting Collection or Draft,
 *  this screen covers it"; with several deploys an hour, that window is open
 *  nearly all the time.
 *
 *  The cure is the new build, so a failed load RELOADS onto it — when that is
 *  safe: never mid-match (a local match lives only in memory), never offline
 *  (a reload there is the browser's own error page), never twice inside twenty
 *  seconds (a build that still cannot load must not reload forever), and never
 *  without somewhere to record that it tried. When it is not safe the failure
 *  is thrown, for the screen's error boundary (Recover.tsx) to explain with a
 *  button, and the rest of the game plays on. */

let matchLive = false;

/** App tells this whether a match is being played, so a reload never ends one. */
export function setMatchLive(live: boolean) {
  matchLive = live;
}

/** Whether a match is being played — the boundary words its button by it. */
export function isMatchLive(): boolean {
  return matchLive;
}

const KEY = "we_update_reload";
const GUARD_MS = 20_000;

/** Reload onto the current build if that is safe; true if it is happening. */
export function reloadForUpdate(): boolean {
  if (typeof window === "undefined" || matchLive || navigator.onLine === false) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < GUARD_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage blocked (a private tab): without a record of having tried, a
    // build that cannot load its chunks would reload forever. Ask instead.
    return false;
  }
  window.location.reload();
  return true;
}

/** A code-split import that survives a redeploy. When it fails, reload onto
 *  the new build if that is safe — staying SUSPENDED meanwhile, so the screen
 *  simply has not appeared yet when the boot splash comes back up — and
 *  otherwise rethrow for an error boundary to explain. */
export function resilient<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    load().catch((err: unknown) => {
      if (reloadForUpdate()) return new Promise<T>(() => {});
      throw err;
    });
}

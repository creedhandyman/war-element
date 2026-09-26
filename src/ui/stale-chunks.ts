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
 *  button, and the rest of the game plays on.
 *
 *  A reload still costs the player the screen they tapped, so two layers below
 *  keep it rare and harmless: WARM fetches every screen in the background while
 *  its name still resolves, and RESUME sends a reload that happens anyway back
 *  to the screen the player was opening. */

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
  notePlace();
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

// ── WARM: fetch every screen while the build that named it is still up ──────
//
// The reload is the cure for a chunk that is gone, and it costs the tap: the
// player asked for the Tower and got Home, which is what "the game restarts
// instead of going where you want" was. Most of the time it never has to happen.
// A chunk only goes missing if the game first asks for it AFTER a deploy, and
// nothing makes it wait that long — so once the menu is up, every screen is
// fetched in the background while its name still resolves. A module the page
// has loaded stays loaded: opening that screen hours and three deploys later
// asks the network for nothing.

const warmers: Array<() => Promise<unknown>> = [];
let warming = false;

/** Queue a code-split load for the background fetch (App.tsx `deferred`). */
export function warmLater(load: () => Promise<unknown>): void {
  warmers.push(load);
}

/** Fetch everything queued, one at a time. A failure is only a missed head
 *  start — the screen's own resilient load still runs when it opens — so it is
 *  swallowed here and never reloads. Resolves to how many loaded. */
export async function warmChunks(): Promise<number> {
  let loaded = 0;
  for (const load of warmers.splice(0)) {
    try {
      await load();
      loaded++;
    } catch {
      // Missed, not failed: the screen's own load tries again when it opens.
    }
  }
  return loaded;
}

/** Start the background fetch once, a moment after the first frame, so the
 *  menu's own art has the connection first. */
export function warmSoon(delayMs = 1500): void {
  if (warming) return;
  warming = true;
  setTimeout(() => void warmChunks(), delayMs);
}

// ── RESUME: when a reload still has to happen, land where the player was going
//
// A load can still fail — a deploy inside the first seconds, before the warm has
// finished, or a warm that could not reach the network. The reload onto the new
// build is still the cure, but the screen that failed is the one the player just
// opened, and a fresh boot starts on Home. So the reload notes where App says the
// player is — which, at the moment a screen fails to load, IS the screen they
// asked for — and the boot after it goes back there.

const PLACE_KEY = "we_update_place";
/** How long after the reload its note still counts. A boot takes seconds; a
 *  note older than this is from a reload the player has long since left. */
const RESUME_MS = 60_000;

let placeOf: (() => unknown) | null = null;
let resumed: { read: boolean; place: unknown } = { read: false, place: null };

/** App hands over how to say where the player is. */
export function rememberPlace(describe: () => unknown): void {
  placeOf = describe;
}

/** Written just before an update reload. Never in the way of the reload: a
 *  place that cannot be described or stored only means Home after it. */
function notePlace(): void {
  try {
    const place = placeOf?.();
    if (place != null) sessionStorage.setItem(PLACE_KEY, JSON.stringify(place));
  } catch {
    // Home, then — the reload itself still happens.
  }
}

/** Where the player was going when an update reload fired, or null. Read once
 *  per page and spent: a reload of the player's own later does not replay it. */
export function resumePlace<T>(): T | null {
  if (!resumed.read) {
    resumed = { read: true, place: null };
    try {
      const raw = sessionStorage.getItem(PLACE_KEY);
      if (raw !== null) {
        sessionStorage.removeItem(PLACE_KEY);
        const at = Number(sessionStorage.getItem(KEY) ?? 0);
        if (Date.now() - at < RESUME_MS) resumed.place = JSON.parse(raw);
      }
    } catch {
      // No storage, or a note that will not parse: boot where a boot boots.
    }
  }
  return resumed.place as T | null;
}

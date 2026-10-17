/** "YOUR CARDS LIVE ONLY ON THIS DEVICE."
 *
 *  Everything a player earns is in one localStorage key. A new phone, a cleared
 *  browser or a reinstall takes all of it — and the cloud save that prevents that
 *  was one small "Sign in" chip nobody was ever pointed at. Losing a collection
 *  is the one churn the game can see coming, so it says so once the player has
 *  something worth losing: after the FIRST fight is won (the first session is
 *  already busy teaching), as a card on Home that can be put off.
 *
 *  Asked politely and not forever: "Not now" hides it for a week, and after three
 *  of those it stops — a player who has said no three times has decided.
 *
 *  Pure rule + a tiny device-local store (a property of this device, not of the
 *  save: it is not in `SAVE_KEYS`, so it never travels with the progress). */

const KEY = "we_backup_nudge";
export const NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const NUDGE_MAX_DISMISSALS = 3;

export interface NudgeState { dismissedAt?: number; dismissals?: number }

export function shouldShowBackupNudge(p: {
  signedIn: boolean;
  /** Story nodes cleared: the proxy for "has played enough to have something". */
  cleared: number;
  state: NudgeState;
  now: number;
}): boolean {
  if (p.signedIn) return false;
  if (p.cleared < 1) return false;
  const n = p.state.dismissals ?? 0;
  if (n >= NUDGE_MAX_DISMISSALS) return false;
  if (p.state.dismissedAt !== undefined && p.now - p.state.dismissedAt < NUDGE_COOLDOWN_MS) return false;
  return true;
}

export function readNudgeState(): NudgeState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as NudgeState;
    return {
      dismissedAt: typeof v.dismissedAt === "number" ? v.dismissedAt : undefined,
      dismissals: typeof v.dismissals === "number" ? v.dismissals : undefined,
    };
  } catch {
    return {};
  }
}

/** "Not now": one more dismissal, and the clock restarts. */
export function dismissBackupNudge(now: number = Date.now()): NudgeState {
  const prev = readNudgeState();
  const next = { dismissedAt: now, dismissals: (prev.dismissals ?? 0) + 1 };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full or blocked: it just comes back */ }
  return next;
}

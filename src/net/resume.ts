// REJOIN — the one piece of an online match that has to outlive the tab.
//
// Online play has no server copy of the game. The transport is a Supabase
// Realtime broadcast channel ("no DB, no auth", see online.ts) and the match
// lives in the clients' memory, so a closed tab, a phone that killed the app or
// a crashed browser took this client's half of the match with it — and there
// was no way back into the room.
//
// What survives is written here, on this device: the room, the seat, the id the
// host seated this client under, and the newest state this client held WITH the
// Lamport clock it arrived under. The clock matters as much as the state: a
// client that came back without it would take any stale heartbeat as news and
// rewind the table. The catch-up itself is the transport's job — `joinRoom`'s
// `resume` argument and its `sync` handshake. This file only decides what is
// worth offering back to the player.
//
// Device-local on purpose, and NOT in account.ts's SAVE_KEYS. A match in
// progress is a fact about this browser's seat at a table, not progress: synced
// to another device it would offer a rejoin into a seat still occupied here.

import type { GameState, PlayerId, Suit } from "../engine";
import { seatsOf } from "../engine/types";
import type { ResumePoint, Role } from "./online";

export const RESUME_KEY = "we_online_match_v1";

/** How long a closed match stays on offer. A table does not wait for hours —
 *  past this the other player has left the room, and handing the seat back would
 *  drop the player onto a board with nobody on the other side of it. Generous
 *  against a phone pocketed mid-match; not a promise the room is still there. */
export const RESUME_TTL_MS = 2 * 60 * 60 * 1000;

/** The host's rematch setup — `setupRef` in App.tsx. The host is the dealer, so
 *  a host that came back without it could finish the match but never run it
 *  back. A guest has none: it asks, and the host deals. */
export interface SavedSetup {
  p1: string[];
  p1s?: string[];
  p2: string[];
  p2s?: string[];
  board: number;
  humans: PlayerId[];
  heroes?: boolean;
  suits?: Partial<Record<PlayerId, Suit>>;
}

export interface SavedOnlineMatch {
  v: 1;
  code: string;
  role: Role;
  seat: PlayerId;
  /** The id the host seated this client under. Empty for the host itself. */
  clientId: string;
  /** Wall clock of the last write, ms. Read for the expiry and the "min ago"
   *  line only — never compared with anything another client wrote. */
  savedAt: number;
  point: ResumePoint;
  setup?: SavedSetup;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** localStorage when there is one. Guarded because the accessor itself throws
 *  where site data is blocked, and a rejoin is never worth a crash. */
function browserStore(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const SEATS: readonly string[] = ["P1", "P2", "P3", "P4"];

/** Write down the match this client is in. Returns false when nothing was kept —
 *  a finished match (which also clears any older save), or storage that refused
 *  the write. Either way the match itself plays on; it just cannot be rejoined. */
export function saveOnlineMatch(
  m: Omit<SavedOnlineMatch, "v" | "savedAt">,
  now: number = Date.now(),
  store: Store | null = browserStore(),
): boolean {
  if (!store) return false;
  // A finished match is not one to come back to, and a save left behind by one
  // would offer the player a seat at a result screen.
  if (m.point.state.phase === "gameover") {
    clearOnlineMatch(store);
    return false;
  }
  const saved: SavedOnlineMatch = { v: 1, ...m, savedAt: now };
  try {
    store.setItem(RESUME_KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

/** The match this device can rejoin, or null. Anything expired, finished or not
 *  in the shape this file writes is cleared on the way past, so a bad save is
 *  offered at most never rather than on every boot. */
export function loadOnlineMatch(
  now: number = Date.now(),
  store: Store | null = browserStore(),
): SavedOnlineMatch | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(RESUME_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  const m = parse(raw);
  if (!m || now - m.savedAt > RESUME_TTL_MS || m.point.state.phase === "gameover") {
    clearOnlineMatch(store);
    return null;
  }
  return m;
}

export function clearOnlineMatch(store: Store | null = browserStore()): void {
  try {
    store?.removeItem(RESUME_KEY);
  } catch {
    // Nothing to do: a save that cannot be removed also cannot be read.
  }
}

/** The line the rejoin prompt reads: which room, how far in, how long ago. */
export function savedMatchLabel(m: SavedOnlineMatch, now: number = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - m.savedAt) / 60_000));
  const ago = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} hr ago`;
  const st = m.point.state;
  const where = st.phase === "mulligan" ? "mulligan" : `round ${Math.max(1, st.round)}`;
  return `Room ${m.code} · ${where} · ${ago}`;
}

/** Everything read back from storage is checked, because storage is the one
 *  input here nobody vouches for: an older build's shape, a hand edit, a write
 *  cut off halfway. */
function parse(raw: string): SavedOnlineMatch | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Partial<SavedOnlineMatch>;
  if (o.v !== 1) return null;
  if (typeof o.code !== "string" || !o.code) return null;
  if (o.role !== "host" && o.role !== "guest") return null;
  if (typeof o.seat !== "string" || !SEATS.includes(o.seat)) return null;
  // The host deals and always sits P1. A host save in any other chair is not
  // one this app wrote.
  if (o.role === "host" && o.seat !== "P1") return null;
  if (typeof o.clientId !== "string") return null;
  if (typeof o.savedAt !== "number" || !Number.isFinite(o.savedAt)) return null;
  const p = o.point as Partial<ResumePoint> | undefined;
  if (!p || typeof p.clock !== "number" || !Number.isFinite(p.clock) || p.clock < 0) return null;
  const st = p.state as Partial<GameState> | undefined;
  if (!st || typeof st !== "object" || typeof st.phase !== "string" || typeof st.round !== "number") return null;
  if (!st.players || typeof st.players !== "object" || !st.cards || typeof st.cards !== "object") return null;
  // The seat has to be one this match actually dealt. Not `seat in players`:
  // the players map carries every chair a board could seat, so a P4 save would
  // pass on a one-on-one.
  const seats = seatsOf({ seats: Array.isArray(st.seats) ? st.seats : undefined });
  if (!seats.includes(o.seat as PlayerId)) return null;
  return o as SavedOnlineMatch;
}

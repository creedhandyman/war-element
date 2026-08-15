// Minimal online PvP over Supabase Realtime "broadcast" — no DB, no auth.
//
// The engine is a pure reducer with a fully-serializable `game` state, so
// "online" is just: whoever produced a new state broadcasts it on a room-code
// channel, and the other client replaces its state. The host (P1) also owns
// advancing the non-interactive phase steps. See App.tsx for the sync loop.
//
// Requires two env vars (Vite): VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
// Get them from any free Supabase project → Settings → API. No tables needed.

import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { GameState } from "../engine";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the Supabase env vars are present (online play is available). */
export const onlineConfigured = Boolean(URL && ANON);

const supabase = onlineConfigured ? createClient(URL!, ANON!) : null;

export type Role = "host" | "guest";

export interface Room {
  /** Broadcast a freshly-produced game state to the other client. Stamps it
   *  with the next clock tick — see `resend`. */
  sendState: (state: GameState) => void;
  /** Re-broadcast the LAST state this client sent, unchanged and with its
   *  original clock. The reliability heartbeat; a no-op before the first send. */
  resend: () => void;
  /** Guest → host: announce arrival with the guest's resolved deck (card ids)
   *  and hand-picked spellbook (spell ids; empty = auto-from-elements). */
  sendJoin: (cards: string[], spells?: string[]) => void;
  /** Leave + tear down the channel. */
  close: () => void;
}

/**
 * Join (or create) a room channel keyed by `code`. Both players call this with
 * the SAME code; the host also handles `onJoin`. `broadcast.self:false` means we
 * never receive our own messages, so there's no echo loop.
 */
export function joinRoom(
  code: string,
  role: Role,
  handlers: {
    onState: (state: GameState) => void;
    onJoin?: (cards: string[], spells?: string[]) => void; // host only
    onSubscribed?: () => void;
  },
): Room {
  if (!supabase) throw new Error("Online is not configured (missing Supabase env vars).");
  const channel: RealtimeChannel = supabase.channel(`we-room-${code}`, {
    config: { broadcast: { self: false } },
  });

  /** LAMPORT CLOCK — what makes it safe for BOTH sides to heartbeat.
   *
   *  Before this, the newest state was identified by "whoever currently owns the
   *  turn", and that rule had a hole at every hand-off: the player who has just
   *  acted no longer owns the turn, so it stopped re-broadcasting at the exact
   *  moment its copy was the only one in existence. If that single message
   *  dropped, the game deadlocked forever — observed live at the mulligan, where
   *  the guest always acts last (`needsInput` returns P1 first), so the guest
   *  held the only both-mulliganed state and neither side would re-send it.
   *
   *  Naively letting both sides heartbeat swaps a deadlock for a rewind: a stale
   *  copy would overwrite a newer one. A clock fixes that — a state is accepted
   *  only when it is STRICTLY newer than the newest one seen, so a resend of
   *  something already applied is a cheap no-op and a stale copy is ignored.
   *
   *  Ticks are per-send, not per-resend: a heartbeat carries the same clock it
   *  was first sent with, so it can never look newer than it is. */
  let clock = 0;
  let last: { state: GameState; clock: number } | null = null;

  channel.on("broadcast", { event: "state" }, ({ payload }) => {
    const theirs = typeof payload.clock === "number" ? payload.clock : clock + 1;
    // Strictly newer only. Equal clocks mean both sides produced a state from
    // the same parent, which a turn-based game should never do — the host wins
    // so the two can't diverge into a swap loop.
    if (theirs < clock || (theirs === clock && role === "host")) return;
    clock = Math.max(clock, theirs);
    handlers.onState(payload.state as GameState);
  });
  if (role === "host") {
    channel.on("broadcast", { event: "join" }, ({ payload }) =>
      handlers.onJoin?.(payload.cards as string[], payload.spells as string[] | undefined),
    );
  }
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") handlers.onSubscribed?.();
  });

  const push = (state: GameState, at: number) =>
    void channel.send({ type: "broadcast", event: "state", payload: { state, clock: at } });

  return {
    sendState: (state) => {
      clock += 1;
      last = { state, clock };
      push(state, clock);
    },
    resend: () => {
      if (last) push(last.state, last.clock);
    },
    sendJoin: (cards, spells) =>
      void channel.send({ type: "broadcast", event: "join", payload: { cards, spells } }),
    close: () => void supabase.removeChannel(channel),
  };
}

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

/** Table dressing that rides along with the state.
 *
 *  The deck NAMES, which the engine does not carry and cannot be derived: a
 *  GameState holds card ids, and two players running the same eighteen cards
 *  under different names are indistinguishable inside it. The versus screen
 *  needs them on BOTH clients, and only the host ever learns both (its own from
 *  its picker, the guest's from the join), so the host relays them. */
export interface StateMeta {
  names?: { P1: string; P2: string };
  /** This state is a freshly dealt match, not a step within one. Set on a
   *  rematch so the guest knows to clear its rematch flags and replay the
   *  versus screen, rather than having to infer a new match from the shape of
   *  a state it did not ask for. */
  fresh?: boolean;
}

export interface Room {
  /** Broadcast a freshly-produced game state to the other client. Stamps it
   *  with the next clock tick — see `resend`. */
  sendState: (state: GameState, meta?: StateMeta) => void;
  /** Re-broadcast the LAST state this client sent, unchanged and with its
   *  original clock. The reliability heartbeat; a no-op before the first send. */
  resend: () => void;
  /** Guest → host: announce arrival with the guest's resolved deck (card ids),
   *  hand-picked spellbook (spell ids; empty = auto-from-elements) and the
   *  deck's display name. */
  sendJoin: (cards: string[], spells?: string[], name?: string) => void;
  /** "I want to run it back." Both sides must ask before the host re-deals —
   *  a one-tap rematch would yank the other player off a result screen they
   *  are still reading. */
  sendRematch: () => void;
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
    onState: (state: GameState, meta?: StateMeta) => void;
    onJoin?: (cards: string[], spells?: string[], name?: string) => void; // host only
    onRematch?: () => void;
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
  let last: { state: GameState; clock: number; meta?: StateMeta } | null = null;

  channel.on("broadcast", { event: "state" }, ({ payload }) => {
    const theirs = typeof payload.clock === "number" ? payload.clock : clock + 1;
    // Strictly newer only. Equal clocks mean both sides produced a state from
    // the same parent, which a turn-based game should never do — the host wins
    // so the two can't diverge into a swap loop.
    if (theirs < clock || (theirs === clock && role === "host")) return;
    clock = Math.max(clock, theirs);
    handlers.onState(payload.state as GameState, payload.meta as StateMeta | undefined);
  });
  if (role === "host") {
    channel.on("broadcast", { event: "join" }, ({ payload }) =>
      handlers.onJoin?.(
        payload.cards as string[],
        payload.spells as string[] | undefined,
        payload.name as string | undefined,
      ),
    );
  }
  channel.on("broadcast", { event: "rematch" }, () => handlers.onRematch?.());
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") handlers.onSubscribed?.();
  });

  const push = (state: GameState, at: number, meta?: StateMeta) =>
    void channel.send({ type: "broadcast", event: "state", payload: { state, clock: at, meta } });

  return {
    sendState: (state, meta) => {
      clock += 1;
      last = { state, clock, meta };
      push(state, clock, meta);
    },
    resend: () => {
      if (last) push(last.state, last.clock, last.meta);
    },
    sendJoin: (cards, spells, name) =>
      void channel.send({ type: "broadcast", event: "join", payload: { cards, spells, name } }),
    sendRematch: () => void channel.send({ type: "broadcast", event: "rematch", payload: {} }),
    close: () => void supabase.removeChannel(channel),
  };
}

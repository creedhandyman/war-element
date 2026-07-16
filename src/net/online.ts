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
  /** Broadcast a freshly-produced game state to the other client. */
  sendState: (state: GameState) => void;
  /** Guest → host: announce arrival with the guest's resolved deck (card ids). */
  sendJoin: (cards: string[]) => void;
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
    onJoin?: (cards: string[]) => void; // host only
    onSubscribed?: () => void;
  },
): Room {
  if (!supabase) throw new Error("Online is not configured (missing Supabase env vars).");
  const channel: RealtimeChannel = supabase.channel(`we-room-${code}`, {
    config: { broadcast: { self: false } },
  });
  channel.on("broadcast", { event: "state" }, ({ payload }) =>
    handlers.onState(payload.state as GameState),
  );
  if (role === "host") {
    channel.on("broadcast", { event: "join" }, ({ payload }) =>
      handlers.onJoin?.(payload.cards as string[]),
    );
  }
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") handlers.onSubscribed?.();
  });
  return {
    sendState: (state) =>
      void channel.send({ type: "broadcast", event: "state", payload: { state } }),
    sendJoin: (cards) =>
      void channel.send({ type: "broadcast", event: "join", payload: { cards } }),
    close: () => void supabase.removeChannel(channel),
  };
}

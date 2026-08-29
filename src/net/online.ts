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
import type { GameState, PlayerId } from "../engine";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the Supabase env vars are present (online play is available). */
export const onlineConfigured = Boolean(URL && ANON);

const supabase = onlineConfigured ? createClient(URL!, ANON!) : null;

export type Role = "host" | "guest";

/** One line of the PREGAME LOBBY, as the host sees it and everyone renders it.
 *
 *  The roster is host-authoritative for the same reason the seating is: only the
 *  host learns every arrival, so only the host can say who is in the room. A
 *  guest never builds this, it only receives it. */
export interface LobbySeat {
  seat: PlayerId;
  /** The deck this player currently has selected. */
  name: string;
  ready: boolean;
  host?: boolean;
}

/** Table dressing that rides along with the state.
 *
 *  The deck NAMES, which the engine does not carry and cannot be derived: a
 *  GameState holds card ids, and two players running the same eighteen cards
 *  under different names are indistinguishable inside it. The versus screen
 *  needs them on BOTH clients, and only the host ever learns both (its own from
 *  its picker, the guest's from the join), so the host relays them. */
export interface StateMeta {
  names?: Partial<Record<PlayerId, string>>;
  /** Which cards each SEAT holds in foil. Relayed for the same reason the names
   *  are: a foil lives in a player's collection, not in the GameState, so the
   *  other client has no way to know a card on the board is shiny. Without this
   *  every online board looked plain on both sides — you could not see your own
   *  foils in the one mode where somebody else is watching. */
  foils?: Partial<Record<PlayerId, string[]>>;
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
   *  hand-picked spellbook (spell ids; empty = auto-from-elements), the deck's
   *  display name, and the card ids it holds in FOIL — the host is the only
   *  side that can see both collections, so it is the only side that can relay
   *  them back. */
  /** Guest → host. Sent on arrival AND again whenever this player changes deck
   *  or readiness in the lobby: the host keys on `clientId`, so a re-send
   *  UPDATES that seat rather than taking another one. */
  sendJoin: (
    clientId: string, cards: string[], spells?: string[], name?: string, foils?: string[],
    ready?: boolean,
  ) => void;
  /** Host → the room: the whole lobby, every time it changes. */
  sendLobby: (seats: LobbySeat[], need: number) => void;
  /** Host → the room: "the client with this id is sitting in this seat".
   *
   *  A two-seat room never needed this — the guest WAS P2 and could assume it.
   *  With up to four, only the host knows the arrival order, so it has to say.
   *  Broadcast rather than addressed because the channel has no addressing;
   *  each guest picks out its own id and ignores the rest.
   *
   *  `have`/`need` ride along so a waiting guest can show "3 of 4 seated"
   *  without the host inventing a second message for it. */
  sendSeat: (clientId: string, seat: PlayerId, have: number, need: number) => void;
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
    onJoin?: (
      clientId: string, cards: string[], spells?: string[], name?: string, foils?: string[],
      ready?: boolean,
    ) => void; // host only
    onLobby?: (seats: LobbySeat[], need: number) => void; // guests
    onSeat?: (clientId: string, seat: PlayerId, have: number, need: number) => void; // guests
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
    // STRICTLY newer, for both roles. The first cut let an EQUAL clock through
    // on the guest (it only skipped ties on the host, meaning to give the host
    // the win in a genuine race) — but every heartbeat is a resend carrying its
    // ORIGINAL clock, so on the guest each one re-delivered a state it had
    // already applied, every 2.5s. Same state, so mostly invisible, except that
    // one-shot side effects keyed off arrival — the rematch's `fresh` flag —
    // fired again on every beat.
    //
    // A real tie cannot arise here: one side deals and the game is turn-based,
    // so two states never share a parent.
    if (theirs <= clock) return;
    clock = theirs;
    handlers.onState(payload.state as GameState, payload.meta as StateMeta | undefined);
  });
  if (role === "host") {
    channel.on("broadcast", { event: "join" }, ({ payload }) =>
      handlers.onJoin?.(
        payload.clientId as string,
        payload.cards as string[],
        payload.spells as string[] | undefined,
        payload.name as string | undefined,
        payload.foils as string[] | undefined,
        payload.ready as boolean | undefined,
      ),
    );
  }
  if (role === "guest") {
    channel.on("broadcast", { event: "lobby" }, ({ payload }) =>
      handlers.onLobby?.(payload.seats as LobbySeat[], payload.need as number),
    );
    channel.on("broadcast", { event: "seat" }, ({ payload }) =>
      handlers.onSeat?.(
        payload.clientId as string,
        payload.seat as PlayerId,
        payload.have as number,
        payload.need as number,
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
      // `fresh` is an EVENT, not a property of the state — it means "a new match
      // was just dealt". A heartbeat re-announcing it would be a lie the tenth
      // time, so it is sent once and dropped from what gets resent.
      const { fresh: _fresh, ...durable } = meta ?? {};
      last = { state, clock, meta: durable };
      push(state, clock, meta);
    },
    resend: () => {
      if (last) push(last.state, last.clock, last.meta);
    },
    sendJoin: (clientId, cards, spells, name, foils, ready) =>
      void channel.send({
        type: "broadcast", event: "join",
        payload: { clientId, cards, spells, name, foils, ready },
      }),
    sendLobby: (seats, need) =>
      void channel.send({ type: "broadcast", event: "lobby", payload: { seats, need } }),
    sendSeat: (clientId, seat, have, need) =>
      void channel.send({
        type: "broadcast", event: "seat", payload: { clientId, seat, have, need },
      }),
    sendRematch: () => void channel.send({ type: "broadcast", event: "rematch", payload: {} }),
    close: () => void supabase.removeChannel(channel),
  };
}

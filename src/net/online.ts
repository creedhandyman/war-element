// Minimal online PvP over Supabase Realtime "broadcast" — no DB, no auth.
//
// The engine is a pure reducer with a fully-serializable `game` state, so
// "online" is just: whoever produced a new state broadcasts it on a room-code
// channel, and the other client replaces its state. The host (P1) also owns
// advancing the non-interactive phase steps. See App.tsx for the sync loop.
//
// A client whose app closed mid-match can take its seat back: App keeps a save
// of the newest state and its clock (`net/resume.ts`), hands it to `joinRoom`,
// and the `sync` handshake below catches it up with whoever stayed.
//
// Requires two env vars (Vite): VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
// Get them from any free Supabase project → Settings → API. No tables needed.

import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { GameState, PlayerId, Suit } from "../engine";

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
  /** The HERO this player is bringing, chosen with their deck in the builder.
   *
   *  In the lobby so the choice is visible BEFORE the deal — a hero shifts its
   *  owner's economy and carries a once-per-game power, so "who am I facing"
   *  is a real question and the answer used to arrive only once the board did.
   *  Undefined means that deck pinned nothing and the seat takes a dealt suit. */
  suit?: Suit;
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

/** Where a client picks a match back up after its app closed — see
 *  `net/resume.ts`. The newest state it held, the Lamport clock that state came
 *  under, and the table dressing that rode along with it. The clock is not
 *  garnish: a client that came back without it would take any stale heartbeat
 *  as news and rewind itself. */
export interface ResumePoint {
  state: GameState;
  clock: number;
  meta?: StateMeta;
}

/** One line of BATTLE CHAT.
 *
 *  Deliberately NOT part of GameState, and this is the whole design. A lockstep
 *  game desyncs when two clients disagree about the state, so the dangerous way
 *  to build chat is to put messages in it: every line would advance the Lamport
 *  clock, re-enter the state machine, and ride along in every heartbeat and
 *  every replay. Chat gets its own broadcast event instead. A message cannot
 *  affect the match, and a dropped message costs a line of banter rather than
 *  the game. */
export interface ChatMsg {
  /** Sender-generated, so a duplicated delivery can be recognised and dropped. */
  id: string;
  seat: PlayerId;
  /** The sender's display name, if it has one. */
  name?: string;
  text: string;
  /** The sender's wall clock. For display order only — it is not authoritative
   *  and is never compared across clients for anything that matters. */
  at: number;
}

/** Longest single message. Short on purpose: this is table talk during a turn,
 *  not a text box, and a cap is also the cheapest defence against one player
 *  pushing everyone else's log off the screen. */
export const CHAT_MAX = 160;

const CHAT_SEATS: PlayerId[] = ["P1", "P2", "P3", "P4"];

/** Strip a wire message down to something safe to render, or null.
 *
 *  Everything arriving here is another player's typing, so it is treated as
 *  data and never as markup: React escapes it on render, and this pass fixes
 *  the shape. It runs on RECEIPT rather than only on send, because the sender's
 *  cap is a courtesy and the receiver's is the rule — the peer is a browser
 *  somebody else controls, and the channel is joinable by anyone with the code.
 *
 *  Control characters and newlines collapse to spaces: one message is one line,
 *  and a pasted thousand line breaks is a way to blank the log. */
export function sanitizeChat(payload: unknown): ChatMsg | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Partial<ChatMsg>;
  if (typeof p.seat !== "string" || !CHAT_SEATS.includes(p.seat)) return null;
  const clean = (v: unknown, cap: number) =>
    typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, cap) : "";
  const text = clean(p.text, CHAT_MAX);
  if (!text) return null;
  const name = clean(p.name, 24);
  return {
    id: typeof p.id === "string" && p.id ? p.id.slice(0, 48) : `${p.seat}-${p.at ?? 0}-${text.length}`,
    seat: p.seat,
    name: name || undefined,
    text,
    at: typeof p.at === "number" && Number.isFinite(p.at) ? p.at : 0,
  };
}

export interface Room {
  /** Broadcast a freshly-produced game state to the other client. Stamps it
   *  with the next clock tick — see `resend`. */
  sendState: (state: GameState, meta?: StateMeta) => void;
  /** Re-broadcast the NEWEST state this client holds — sent or received —
   *  unchanged and with its original clock. The reliability heartbeat; a no-op
   *  before the first state.
   *
   *  It used to repeat only this client's own last SEND, which goes stale the
   *  moment the other side moves: a player who came back on an older save would
   *  hear the host repeat a state it already had, forever. The newest state is
   *  news to exactly the clients that missed it, and the clock makes it a no-op
   *  for everyone else. */
  resend: () => void;
  /** The newest state this client holds and the clock it came under — what a
   *  save needs to rejoin from (`net/resume.ts`). Null before the first state. */
  snapshot: () => ResumePoint | null;
  /** Milliseconds since anything last arrived from the room. Every client in a
   *  live match heartbeats, so a long silence is a player who has dropped. */
  quietFor: () => number;
  /** Guest → host: announce arrival with the guest's resolved deck (card ids),
   *  hand-picked spellbook (spell ids; empty = auto-from-elements), the deck's
   *  display name, the card ids it holds in FOIL, and the SUIT its deck pinned
   *  — the host is the only side that can see both collections, so it is the
   *  only side that can relay them back.
   *
   *  The suit travels for the same reason the foils do, and it matters more: a
   *  hero is chosen with the deck in the builder, and the host deals the board.
   *  Without this the host could only read its OWN pin, so a guest's chosen
   *  hero was silently discarded and both seats got whatever `dealSuits` said. */
  /** Guest → host. Sent on arrival AND again whenever this player changes deck
   *  or readiness in the lobby: the host keys on `clientId`, so a re-send
   *  UPDATES that seat rather than taking another one. */
  sendJoin: (
    clientId: string, cards: string[], spells?: string[], name?: string, foils?: string[],
    ready?: boolean, suit?: Suit,
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
  /** Say something to the room. Fire-and-forget: chat has no acknowledgement,
   *  no retry and no heartbeat, because a line that arrives late is worse than
   *  one that never arrives. */
  sendChat: (msg: ChatMsg) => void;
  /** Leave + tear down the channel. */
  close: () => void;
}

/** A meta fit to REPEAT. `fresh` is an EVENT, not a property of the state — it
 *  means "a new match was just dealt" — so a heartbeat or a catch-up that
 *  re-announced it would be a lie the second time. */
function durable(meta?: StateMeta): StateMeta | undefined {
  if (!meta) return undefined;
  const { fresh: _fresh, ...rest } = meta;
  return rest;
}

/**
 * Join (or create) a room channel keyed by `code`. Both players call this with
 * the SAME code; the host also handles `onJoin`. `broadcast.self:false` means we
 * never receive our own messages, so there's no echo loop.
 *
 * `resume` is a match this client is taking back up after its app closed. The
 * client starts from that state and clock instead of from nothing, and on
 * subscribing puts its copy back on the wire and asks the room for anything
 * newer — see the `sync` handler below.
 */
export function joinRoom(
  code: string,
  role: Role,
  handlers: {
    onState: (state: GameState, meta?: StateMeta) => void;
    onJoin?: (
      clientId: string, cards: string[], spells?: string[], name?: string, foils?: string[],
      ready?: boolean, suit?: Suit,
    ) => void; // host only
    onLobby?: (seats: LobbySeat[], need: number) => void; // guests
    onSeat?: (clientId: string, seat: PlayerId, have: number, need: number) => void; // guests
    onRematch?: () => void;
    /** Everyone, both roles: the channel is a room, not a pair of pipes. */
    onChat?: (msg: ChatMsg) => void;
    onSubscribed?: () => void;
  },
  resume?: ResumePoint,
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
  let clock = resume?.clock ?? 0;
  /** The newest state this client holds, SENT OR RECEIVED, with the clock it
   *  came under. What the heartbeat repeats, what a `sync` is answered with, and
   *  what a save writes down. */
  let newest: ResumePoint | null = resume
    ? { state: resume.state, clock: resume.clock, meta: durable(resume.meta) }
    : null;
  /** When anything last arrived from the room — the liveness read. Starts at the
   *  join, so a room nobody answers goes quiet from then rather than from 1970. */
  let heard = Date.now();

  channel.on("broadcast", { event: "state" }, ({ payload }) => {
    // Heard even when it is a repeat: a heartbeat of a state this client already
    // holds is still the other side saying it is there.
    heard = Date.now();
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
    newest = {
      state: payload.state as GameState,
      clock: theirs,
      meta: durable(payload.meta as StateMeta | undefined),
    };
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
        payload.suit as Suit | undefined,
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
  channel.on("broadcast", { event: "rematch" }, () => {
    heard = Date.now();
    handlers.onRematch?.();
  });
  channel.on("broadcast", { event: "chat" }, ({ payload }) => {
    heard = Date.now();
    const msg = sanitizeChat(payload);
    if (msg) handlers.onChat?.(msg);
  });

  const push = (state: GameState, at: number, meta?: StateMeta) =>
    void channel.send({ type: "broadcast", event: "state", payload: { state, clock: at, meta } });
  /** Tick the clock and send. Every state that is NEWS goes out through here. */
  const stamp = (state: GameState, meta?: StateMeta) => {
    clock += 1;
    newest = { state, clock, meta: durable(meta) };
    push(state, clock, meta);
  };

  // THE REJOIN HANDSHAKE. A client that subscribes WITH a match in hand — back
  // after its app closed, or after its socket dropped — puts its copy back on the
  // wire and asks the room for the newest state, saying which clock it holds.
  //
  // A client that is NOT behind the asker answers by sending its newest state
  // again under a FRESH tick. Fresh rather than the state's original clock,
  // because the asker may have come back on an older save whose clock already
  // matches: a repeat at that clock is "not newer", so it would be ignored and
  // the asker would sit on its stale board for good.
  //
  // A client that IS behind the asker stays quiet. The asker holds the newer copy
  // (its last move never made it out) and has already sent it, and an answer
  // would spend the very tick that copy needs: if the ask landed first, the copy
  // would then arrive "not newer" and the two boards would split for good.
  // Quiet is right in either order — the copy lands, or its next heartbeat does,
  // and is simply taken.
  //
  // Answered with the meta minus `fresh`: a catch-up is not a new deal.
  channel.on("broadcast", { event: "sync" }, ({ payload }) => {
    heard = Date.now();
    const theirs = typeof payload?.clock === "number" ? payload.clock : 0;
    if (newest && theirs <= clock) stamp(newest.state, newest.meta);
  });
  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    handlers.onSubscribed?.();
    // No match in hand (a player walking into a lobby) means nothing to resume
    // and nobody to wake.
    if (newest) {
      push(newest.state, newest.clock, newest.meta);
      void channel.send({ type: "broadcast", event: "sync", payload: { clock: newest.clock } });
    }
  });

  return {
    // `fresh` goes out once, with the send itself, and is dropped from what gets
    // repeated — see `durable`.
    sendState: (state, meta) => stamp(state, meta),
    resend: () => {
      if (newest) push(newest.state, newest.clock, newest.meta);
    },
    snapshot: () => (newest ? { ...newest } : null),
    quietFor: () => Date.now() - heard,
    sendJoin: (clientId, cards, spells, name, foils, ready, suit) =>
      void channel.send({
        type: "broadcast", event: "join",
        payload: { clientId, cards, spells, name, foils, ready, suit },
      }),
    sendLobby: (seats, need) =>
      void channel.send({ type: "broadcast", event: "lobby", payload: { seats, need } }),
    sendSeat: (clientId, seat, have, need) =>
      void channel.send({
        type: "broadcast", event: "seat", payload: { clientId, seat, have, need },
      }),
    sendRematch: () => void channel.send({ type: "broadcast", event: "rematch", payload: {} }),
    // Sanitised on the way OUT as well, so a sender cannot put on the wire
    // something its own client would refuse to render.
    sendChat: (msg) => {
      const safe = sanitizeChat(msg);
      if (safe) void channel.send({ type: "broadcast", event: "chat", payload: safe });
    },
    close: () => void supabase.removeChannel(channel),
  };
}

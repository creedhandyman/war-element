// REJOINING AN ONLINE MATCH AFTER THE GAME CLOSED.
//
// Online play has no server copy of the match: states travel over a Supabase
// broadcast channel under a Lamport clock, and each client holds the game in
// memory. A closed tab used to be the end of that client's match. Two halves
// make it survivable, and both are pinned here:
//
//  1. THE TRANSPORT (`joinRoom`'s `resume` + the `sync` handshake). Driven
//     against an in-memory stand-in for Supabase, because the bugs worth
//     catching are ORDERING bugs — whose copy wins when a player comes back —
//     and those only show with more than one client on a channel.
//  2. THE SAVE (`net/resume.ts`): what this device offers back, and what it
//     refuses to.
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Room, ResumePoint, StateMeta } from "../../net/online";
import {
  RESUME_KEY, RESUME_TTL_MS, clearOnlineMatch, loadOnlineMatch, saveOnlineMatch, savedMatchLabel,
} from "../../net/resume";
import { createInitialState } from "../state";
import type { GameState } from "../types";

// ── an in-memory Realtime ────────────────────────────────────────────────────
type Wire = { type: string; event: string; payload: Record<string, unknown> };
type Listener = { event: string; cb: (m: { payload: Record<string, unknown> }) => void };

const net = vi.hoisted(() => {
  class FakeChannel {
    listeners: Listener[] = [];
    alive = true;
    constructor(public name: string, public hub: Hub) { hub.created.push(this); }
    on(_kind: string, filter: { event: string }, cb: Listener["cb"]) {
      this.listeners.push({ event: filter.event, cb });
      return this;
    }
    subscribe(cb: (status: string) => void) {
      this.hub.channels.add(this);
      queueMicrotask(() => { if (this.alive) cb("SUBSCRIBED"); });
      return this;
    }
    send(msg: Wire) {
      this.hub.deliver(this, msg);
      return Promise.resolve("ok");
    }
  }
  class Hub {
    channels = new Set<FakeChannel>();
    created: FakeChannel[] = [];
    log: { from: FakeChannel; msg: Wire }[] = [];
    /** Everything this channel sends is lost — a message that never arrived. */
    dropFrom = new Set<FakeChannel>();
    leave(ch: FakeChannel) {
      ch.alive = false;
      this.channels.delete(ch);
    }
    /** Messages of this event from this channel wait in `held` until `release` —
     *  one sender's copy arriving AFTER something it sent later. */
    hold = new Map<FakeChannel, string>();
    held: { from: FakeChannel; msg: Wire }[] = [];
    release() {
      for (const h of this.held.splice(0)) this.fanout(h.from, h.msg);
    }
    deliver(from: FakeChannel, msg: Wire) {
      this.log.push({ from, msg });
      if (this.dropFrom.has(from)) return;
      if (this.hold.get(from) === msg.event) {
        this.held.push({ from, msg });
        return;
      }
      this.fanout(from, msg);
    }
    fanout(from: FakeChannel, msg: Wire) {
      // A wire copy: nothing a receiver does can reach back into the sender.
      const payload = JSON.parse(JSON.stringify(msg.payload)) as Record<string, unknown>;
      for (const ch of this.channels) {
        if (ch === from || ch.name !== from.name) continue; // broadcast.self: false
        queueMicrotask(() => {
          if (!ch.alive) return;
          for (const l of ch.listeners) if (l.event === msg.event) l.cb({ payload });
        });
      }
    }
  }
  return { hub: new Hub(), FakeChannel };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    channel: (name: string) => new net.FakeChannel(name, net.hub),
    removeChannel: (ch: InstanceType<typeof net.FakeChannel>) => {
      net.hub.leave(ch);
      return Promise.resolve("ok");
    },
  }),
}));

let joinRoom: typeof import("../../net/online").joinRoom;
beforeAll(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "http://realtime.test");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
  ({ joinRoom } = await import("../../net/online"));
});

/** Every queued delivery lands before a macrotask runs, cascades included. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

/** A stand-in state: the transport never looks inside one. */
const S = (tag: string) => ({ phase: "battle", round: 3, tag }) as unknown as GameState;
const tagOf = (s: GameState | undefined) => (s as unknown as { tag?: string } | undefined)?.tag;

interface Client { room: Room; chan: InstanceType<typeof net.FakeChannel>; metas: (StateMeta | undefined)[] }
let rooms = 0;
function seat(code: string, role: "host" | "guest", resume?: ResumePoint): Client {
  const metas: (StateMeta | undefined)[] = [];
  const room = joinRoom(code, role, { onState: (_s, meta) => { metas.push(meta); } }, resume);
  return { room, chan: net.hub.created[net.hub.created.length - 1], metas };
}
/** What this client would put on screen: the newest state it holds. */
const showing = (c: Client) => tagOf(c.room.snapshot()?.state);
const freshCode = () => `R${++rooms}`;

describe("coming back to an online match", () => {
  it("a guest that closed comes back to the table's CURRENT state", async () => {
    const code = freshCode();
    const host = seat(code, "host");
    const guest = seat(code, "guest");
    await flush();
    host.room.sendState(S("deal"));
    await flush();
    guest.room.sendState(S("guest-move"));
    await flush();
    expect(showing(host)).toBe("guest-move");

    // The tab dies, and its last save is one state behind: the write for the
    // move was still pending. The HOST's last send is that same stale deal, so
    // a heartbeat alone would only ever repeat the state the guest already has.
    guest.room.close();
    const back = seat(code, "guest", { state: S("deal"), clock: 1 });
    await flush();
    expect(showing(back), "caught up without waiting on a heartbeat").toBe("guest-move");

    // ...and the clocks still agree afterwards: its next move is news.
    back.room.sendState(S("after-rejoin"));
    await flush();
    expect(showing(host)).toBe("after-rejoin");
  });

  it("keeps a move the closed client made that never reached the table", async () => {
    const code = freshCode();
    const host = seat(code, "host");
    const guest = seat(code, "guest");
    await flush();
    host.room.sendState(S("deal"));
    await flush();
    net.hub.dropFrom.add(guest.chan);
    guest.room.sendState(S("lost-move"));
    await flush();
    expect(showing(host), "the move was lost on the way").toBe("deal");

    const saved = guest.room.snapshot()!;
    guest.room.close();
    const back = seat(code, "guest", saved);
    await flush();
    expect(showing(host), "the returning copy is the newer one, so it wins").toBe("lost-move");
    expect(showing(back)).toBe("lost-move");
  });

  it("...even when its ask lands BEFORE its copy", async () => {
    // One sender's messages normally arrive in order, but nothing here may
    // depend on it. Answered on arrival, the ask would make the host stamp its
    // older board at the same clock as the returning move — and the move would
    // then land "not newer", leaving the two clients on different boards.
    const code = freshCode();
    const host = seat(code, "host");
    const guest = seat(code, "guest");
    await flush();
    host.room.sendState(S("deal"));
    await flush();
    net.hub.dropFrom.add(guest.chan);
    guest.room.sendState(S("lost-move"));
    await flush();
    const saved = guest.room.snapshot()!;
    guest.room.close();

    const back = seat(code, "guest", saved);
    net.hub.hold.set(back.chan, "state"); // the copy is delayed; the ask is not
    await flush();
    expect(showing(back), "nothing overwrote the newer move").toBe("lost-move");
    net.hub.hold.delete(back.chan);
    net.hub.release();
    await flush();
    expect(showing(host), "the late copy is still news").toBe("lost-move");
    expect(showing(back)).toBe("lost-move");
  });

  it("a HOST that closed comes back to what the guest has done since", async () => {
    const code = freshCode();
    const host = seat(code, "host");
    const guest = seat(code, "guest");
    await flush();
    host.room.sendState(S("deal"));
    await flush();
    const saved = host.room.snapshot()!;
    host.room.close();
    // The guest keeps playing into an empty room.
    guest.room.sendState(S("guest-alone"));
    await flush();

    const back = seat(code, "host", saved);
    await flush();
    expect(showing(back)).toBe("guest-alone");
    expect(showing(guest)).toBe("guest-alone");
  });

  it("with BOTH gone, whoever returns second still lands both on the newer save", async () => {
    const code = freshCode();
    const hostSave: ResumePoint = { state: S("older"), clock: 5 };
    const guestSave: ResumePoint = { state: S("newer"), clock: 6 };
    const host = seat(code, "host", hostSave);
    await flush(); // alone: its sync goes nowhere
    expect(showing(host)).toBe("older");
    const guest = seat(code, "guest", guestSave);
    await flush();
    expect(showing(host)).toBe("newer");
    expect(showing(guest)).toBe("newer");
  });

  it("...and the older save arriving second cannot rewind the table", async () => {
    const code = freshCode();
    const guest = seat(code, "guest", { state: S("newer"), clock: 9 });
    await flush();
    const host = seat(code, "host", { state: S("older"), clock: 4 });
    await flush();
    expect(showing(host)).toBe("newer");
    expect(showing(guest)).toBe("newer");
  });

  it("a player walking into a lobby asks for nothing", async () => {
    // No match in hand, so nothing to resume and nobody to wake: the handshake
    // is for clients holding a state, never a stranger with the room code.
    const code = freshCode();
    const guest = seat(code, "guest");
    await flush();
    const mine = net.hub.log.filter((l) => l.from === guest.chan).map((l) => l.msg.event);
    expect(mine).not.toContain("sync");
    expect(mine).not.toContain("state");
  });

  it("a catch-up never replays a rematch's versus screen", async () => {
    // `fresh` is an EVENT — "a new match was just dealt". Resent on a sync, the
    // guest's result screen would reset every time somebody reconnected.
    const code = freshCode();
    const host = seat(code, "host");
    const guest = seat(code, "guest");
    await flush();
    host.room.sendState(S("rematch"), { names: { P1: "Mine" }, fresh: true });
    await flush();
    expect(guest.metas.at(-1)?.fresh).toBe(true);

    const back = seat(code, "guest", { state: S("before"), clock: 0 });
    await flush();
    expect(showing(back)).toBe("rematch");
    expect(back.metas.at(-1)?.fresh, "caught up, not re-dealt").toBeUndefined();
    expect(back.metas.at(-1)?.names?.P1, "the table dressing still comes along").toBe("Mine");
  });

  it("the heartbeat repeats the NEWEST state, not just this client's own last send", async () => {
    const code = freshCode();
    const host = seat(code, "host");
    const guest = seat(code, "guest");
    await flush();
    host.room.sendState(S("deal"));
    await flush();
    guest.room.sendState(S("guest-move"));
    await flush();
    // The guest's app closes and it comes back while everything the host says
    // is being lost, so the answer to its sync never arrives...
    guest.room.close();
    net.hub.dropFrom.add(host.chan);
    const back = seat(code, "guest", { state: S("deal"), clock: 1 });
    await flush();
    expect(showing(back)).toBe("deal");
    // ...and the next heartbeat heals it. Resending only the host's own last
    // send would repeat "deal" forever.
    net.hub.dropFrom.delete(host.chan);
    host.room.resend();
    await flush();
    expect(showing(back)).toBe("guest-move");
  });
});

describe("hearing the table", () => {
  it("counts a heartbeat as contact even when it carries nothing new", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const t0 = new Date("2026-09-12T12:00:00Z").getTime();
      vi.setSystemTime(t0);
      const code = freshCode();
      const host = seat(code, "host");
      const guest = seat(code, "guest");
      await flush();
      host.room.sendState(S("deal"));
      await flush();
      vi.setSystemTime(t0 + 20_000);
      expect(guest.room.quietFor(), "twenty seconds of silence").toBeGreaterThanOrEqual(20_000);
      host.room.resend();
      await flush();
      expect(guest.room.quietFor(), "a repeat of a state it already has").toBeLessThan(1_000);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── the save ─────────────────────────────────────────────────────────────────
function memStore() {
  const m = new Map<string, string>();
  return {
    map: m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}
const NOW = new Date("2026-09-12T12:00:00Z").getTime();
function live(): GameState {
  const g = createInitialState(7);
  g.phase = "battle";
  g.round = 4;
  return g;
}
const match = (state: GameState = live()) => ({
  code: "ABCDE", role: "guest" as const, seat: "P2" as const, clientId: "c-1",
  point: { state, clock: 42, meta: { names: { P1: "Theirs", P2: "Mine" } } },
});

describe("the save a closed match leaves behind", () => {
  it("gives back the seat, the state and the clock it was under", () => {
    const store = memStore();
    expect(saveOnlineMatch(match(), NOW, store)).toBe(true);
    const m = loadOnlineMatch(NOW + 60_000, store)!;
    expect([m.code, m.role, m.seat, m.clientId]).toEqual(["ABCDE", "guest", "P2", "c-1"]);
    expect(m.point.clock, "the clock is half of the resume").toBe(42);
    expect(m.point.state.round).toBe(4);
    expect(m.point.meta?.names?.P2).toBe("Mine");
  });

  it("keeps the host's rematch setup, so a returning dealer can still deal", () => {
    const store = memStore();
    const setup = { p1: ["a"], p2: ["b"], board: 4, humans: ["P1", "P2"] as ("P1" | "P2")[], heroes: true };
    saveOnlineMatch({ ...match(), role: "host", seat: "P1", clientId: "", setup }, NOW, store);
    expect(loadOnlineMatch(NOW, store)?.setup).toEqual(setup);
  });

  it("stops offering a match once the table would have given up on it", () => {
    const store = memStore();
    saveOnlineMatch(match(), NOW, store);
    expect(loadOnlineMatch(NOW + RESUME_TTL_MS - 1, store)).not.toBeNull();
    expect(loadOnlineMatch(NOW + RESUME_TTL_MS + 1, store)).toBeNull();
    expect(store.map.has(RESUME_KEY), "and clears it, rather than re-reading it every boot").toBe(false);
  });

  it("never keeps a finished match, and a finish clears the one before it", () => {
    const store = memStore();
    saveOnlineMatch(match(), NOW, store);
    const over = live();
    over.phase = "gameover";
    expect(saveOnlineMatch(match(over), NOW, store)).toBe(false);
    expect(loadOnlineMatch(NOW, store)).toBeNull();
    // ...including one written before the check existed.
    store.setItem(RESUME_KEY, JSON.stringify({ v: 1, savedAt: NOW, ...match(over) }));
    expect(loadOnlineMatch(NOW, store)).toBeNull();
  });

  it("refuses anything it did not write", () => {
    const bad: unknown[] = [
      "not json",
      { ...match(), v: 2, savedAt: NOW },
      { v: 1, savedAt: NOW, ...match(), role: "host", seat: "P2" },   // a host is always P1
      { v: 1, savedAt: NOW, ...match(), seat: "P4" },                 // not a seat in this state
      { v: 1, savedAt: NOW, ...match(), point: { state: live(), clock: -1 } },
      { v: 1, savedAt: NOW, ...match(), point: { clock: 3 } },
      { v: 1, savedAt: NOW, ...match(), code: "" },
    ];
    for (const b of bad) {
      const store = memStore();
      store.setItem(RESUME_KEY, typeof b === "string" ? b : JSON.stringify(b));
      expect(loadOnlineMatch(NOW, store), JSON.stringify(b).slice(0, 80)).toBeNull();
      expect(store.map.has(RESUME_KEY)).toBe(false);
    }
  });

  it("survives storage that refuses to be used", () => {
    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("quota"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(saveOnlineMatch(match(), NOW, broken)).toBe(false);
    expect(loadOnlineMatch(NOW, broken)).toBeNull();
    expect(() => clearOnlineMatch(broken)).not.toThrow();
    expect(loadOnlineMatch(NOW, null)).toBeNull();
  });

  it("says which room, how far in, and how long ago", () => {
    const store = memStore();
    saveOnlineMatch(match(), NOW, store);
    const m = loadOnlineMatch(NOW, store)!;
    expect(savedMatchLabel(m, NOW + 10_000)).toBe("Room ABCDE · round 4 · just now");
    expect(savedMatchLabel(m, NOW + 3 * 60_000)).toBe("Room ABCDE · round 4 · 3 min ago");
    expect(savedMatchLabel(m, NOW + 61 * 60_000)).toBe("Room ABCDE · round 4 · 1 hr ago");
    const mull = live();
    mull.phase = "mulligan";
    saveOnlineMatch(match(mull), NOW, store);
    expect(savedMatchLabel(loadOnlineMatch(NOW, store)!, NOW)).toBe("Room ABCDE · mulligan · just now");
  });
});

// ── the wiring in App.tsx ────────────────────────────────────────────────────
// Source-level, like the other online guards: the suite runs in `node` with no
// DOM, and App.tsx is one component that needs two live clients to exercise.
describe("the app around a rejoin", () => {
  let APP = "";
  let ACCOUNT = "";
  beforeAll(async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    APP = readFileSync(join(__dirname, "..", "..", "ui", "App.tsx"), "utf8");
    ACCOUNT = readFileSync(join(__dirname, "..", "..", "net", "account.ts"), "utf8");
  });
  /** One top-level function of the component, up to its closing brace. */
  const body = (name: string) => {
    const at = APP.indexOf(`function ${name}(`);
    expect(at, `${name} exists`).toBeGreaterThan(-1);
    return APP.slice(at, APP.indexOf("\n  }\n", at));
  };

  it("hands the room the saved state AND its clock", () => {
    // Without the fourth argument the client starts at clock 0 and the whole
    // resume is a board picture that the first stale heartbeat overwrites.
    expect(body("rejoinOnline")).toMatch(/joinRoom\(code, role, \{[\s\S]*?\}, point\)/);
  });

  it("saves what the ROOM holds, and a finished match clears it", () => {
    const at = APP.indexOf("roomRef.current?.snapshot()");
    expect(at, "the save reads the transport, which knows the clock").toBeGreaterThan(-1);
    const effect = APP.slice(APP.lastIndexOf("useEffect(", at), at + 400);
    expect(effect).toMatch(/game\.phase === "gameover"\) \{ clearOnlineMatch\(\); return; \}/);
    expect(effect).toContain("saveOnlineMatch(");
  });

  it("stops offering the match once the player walks away from it", () => {
    for (const fn of ["leaveOnline", "hostCreateRoom", "guestJoinRoom"])
      expect(body(fn), fn).toContain("dropSavedOnline()");
  });

  it("offers the seat only between matches", () => {
    expect(APP).toMatch(/\{savedOnline && !started && \(/);
  });

  it("keeps the save on this device: a seat at a table is not progress", () => {
    expect(ACCOUNT).not.toContain("we_online_match");
  });
});

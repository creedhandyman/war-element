import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import type { GameState } from "../types";
import type { StrikeZone } from "../../ui/attack-zone";
import { createRemoteQueue, isNextStep, type RemoteScreen } from "../../ui/remote-queue";
import { place, prepState } from "./helpers";

// Online, only the host steps the shared battle, and each player's own moves
// reach the other as a finished state. The queue shows each arriving state
// before it lands, exactly as the local look-ahead does. It can't be clicked
// through here without two live clients, so it is driven through a fake screen
// that records what it was told to do, with a hand-cranked clock.
function fakeScreen(start: GameState) {
  const log: string[] = [];
  let shown: GameState = start;
  const timers: (() => void)[] = [];
  let staged: (() => void) | null = null;
  const screen: RemoteScreen = {
    shown: () => shown,
    land: (next) => { shown = next; log.push(`land r${next.round}#${next.nextId}`); },
    light: (zone: StrikeZone | null) => log.push(zone ? `light ${zone.kind} ${zone.squares.map((q) => `${q.row},${q.col}`).join(" ")}` : "unlight"),
    stageSpell: (_before, next, zone, spellId, landed) => {
      log.push(`stage ${spellId} ${zone?.squares.map((q) => `${q.row},${q.col}`).join(" ")}`);
      staged = () => { shown = next; log.push("staged landed"); landed(); };
    },
    wait: (_ms, fn) => { timers.push(fn); return () => { const i = timers.indexOf(fn); if (i >= 0) timers.splice(i, 1); }; },
    holdFor: () => 600,
  };
  return {
    screen, log,
    tick: () => timers.shift()?.(),
    finishStage: () => { const f = staged; staged = null; f?.(); },
    get shown() { return shown; },
  };
}

/** A P2 attack on a P1 card: `before` and the state after it. */
function attack() {
  const s = prepState(1);
  const a = place(s, "aqua_blackice", "P2", 1, 1);
  const v = place(s, "leaf_greegon", "P1", 2, 1, { curHp: 9 });
  s.phase = "battle";
  s.battle = { queue: [a.instanceId], index: 0, awaitingInput: null };
  const after = structuredClone(s);
  after.battle!.index = 1;
  after.cards[v.instanceId].curHp -= 3;
  return { s, after };
}

describe("states from the other player are shown before they land", () => {
  it("an attack is lit, held, and only then applied", () => {
    const { s, after } = attack();
    const f = fakeScreen(s);
    const q = createRemoteQueue(f.screen);
    q.receive(after);
    expect(f.log).toEqual(["light target 2,1"]);
    expect(f.shown).toBe(s); // not landed yet
    f.tick();
    expect(f.log).toEqual(["light target 2,1", "unlight", `land r${after.round}#${after.nextId}`]);
    expect(f.shown).toBe(after);
  });

  it("a state that hit nothing lands at once", () => {
    const { s } = attack();
    const moved = structuredClone(s);
    moved.log.push("nothing happened");
    const f = fakeScreen(s);
    createRemoteQueue(f.screen).receive(moved);
    expect(f.log).toEqual([`land r${moved.round}#${moved.nextId}`]);
  });

  it("states that arrive during a hold wait their turn, in order", () => {
    const { s, after } = attack();
    const later = structuredClone(after);
    later.log.push("the next quiet step");
    const f = fakeScreen(s);
    const q = createRemoteQueue(f.screen);
    q.receive(after);
    q.receive(later);
    expect(f.shown).toBe(s);
    f.tick();
    expect(f.shown).toBe(later); // the attack landed, then the quiet one followed
    expect(f.log.filter((l) => l.startsWith("land"))).toHaveLength(2);
  });

  it("a spell from the other player plays its flash through the staged path first", () => {
    const s = prepState(1, "P2");
    s.players.P2.magicPool = 5;
    s.players.P2.spellbook = [{ defId: "pyro_spark", used: false }];
    const t = place(s, "leaf_greegon", "P1", 2, 0, { curHp: 9 });
    const cast = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "pyro_spark", targetId: t.instanceId });
    const f = fakeScreen(s);
    const q = createRemoteQueue(f.screen);
    q.receive(cast);
    expect(f.log).toEqual(["stage pyro_spark 2,0"]);
    expect(f.shown).toBe(s);
    f.finishStage();
    expect(f.shown).toBe(cast);
  });

  it("a new deal is not an attack: a rematch lands at once", () => {
    const { s } = attack();
    s.nextId = 500;
    const fresh = prepState(9);
    const f = fakeScreen(s);
    createRemoteQueue(f.screen).receive(fresh);
    expect(isNextStep(s, fresh)).toBe(false);
    expect(f.log).toEqual([`land r${fresh.round}#${fresh.nextId}`]);
  });

  it("a backlog catches up at once instead of replaying at the sender's pace", () => {
    const { s, after } = attack();
    const f = fakeScreen(s);
    const q = createRemoteQueue(f.screen);
    q.receive(after); // lit, held
    const b1 = structuredClone(after), b2 = structuredClone(after), b3 = structuredClone(after);
    q.receive(b1); q.receive(b2); q.receive(b3);
    f.tick(); // the held one lands, then the backlog drains without holds
    expect(f.shown).toBe(b3);
  });

  it("leaving the match cancels a hold in flight and drops the queue", () => {
    const { s, after } = attack();
    const f = fakeScreen(s);
    const q = createRemoteQueue(f.screen);
    q.receive(after);
    q.clear();
    f.tick(); // the cancelled timer is gone
    expect(f.shown).toBe(s);
  });
});

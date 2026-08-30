// CONTINENTAL — Floor 5's second boss, and the one you are not supposed to
// out-damage.
//
// 400 HP behind 50 shields, and shields block PER HIT: the many-small-blows
// answer that beats Kazehaya two floors down is the worst possible answer here.
// SP 1 is the counterweight — it acts near-last in every queue it is ever in.
//
// The gait is the other half. It holds its home row while the player's walls
// stand, sliding along it to line up on whatever hits HARDEST rather than on
// whatever is most numerous; the round the last wall falls, it walks. So the
// Fortress Gates are not merely cover, they are the clock — and the boulders
// are what spend them.
//
// Four new round-ticks arrived with it and each is pinned here: `aimLateralBy`
// ("topDmg" — a different question from the crowd-seeking default),
// `advanceWhenWallsDown`, `advanceTrample`, and `spawnEveryN`.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { VOID_GATE, voidBossById } from "../../data/void-tower";
import { advance } from "../phases";
import { boardCards } from "../state";
import { canTarget } from "../rules";
import { fireCardSpecial } from "../combat";
import { atCleanup, bigPrepState, place } from "./helpers";

const BOSS = "boss_continental";
const ROCK = "bore_rolling_boulder_tok";

const foeAt = (s: ReturnType<typeof bigPrepState>, row: number, col: number, hp = 400, def = "leaf_stickviper") =>
  place(s, def, "P1", row, col, { curHp: hp, maxHp: hp, curShields: 0 });

describe("the shape of the fight", () => {
  it("is Floor 5's second boss, BORE bodied and LEAF mechanised", () => {
    const b = voidBossById(BOSS)!;
    expect(b.floor).toBe(5);
    expect(b.tribeElement).toBe("BORE");
    expect(b.mechanicElement).toBe("LEAF");
    // Two elements. Floor 5 ALLOWS a third; it does not require one.
    expect(b.thirdElement).toBeUndefined();
  });

  it("prints the owner's stat line exactly, and carries both auras", () => {
    const d = getDef(BOSS);
    expect([d.dmg, d.hits, d.hp, d.shields, d.sp]).toEqual([50, 1, 400, 50, 1]);
    expect(d.elementAuras, "Bore AND Leaf").toEqual(["LEAF"]);
    expect(d.keywords.TRAMPLE, "it does not go around").toBe(true);
  });

  it("the boulder is a body with no attack at all", () => {
    const t = getDef(ROCK);
    expect([t.dmg, t.hp, t.shields, t.sp]).toEqual([0, 40, 5, 0]);
    // A 0-DMG body is normally a mistake; here it is the design. Everything it
    // does happens by rolling, in the round tick.
    // Halved from 35 to bring Floor 5 into the 80-90 band. This is the ONE
    // place the number is written down; the behaviour tests below read it off
    // the def so a future tuning pass moves one line, not five.
    expect(t.trampleDmg, "Crush").toBe(12);
    expect(t.roundTick?.advanceTrample).toBe(1);
  });
});

describe("A MELEE GIANT still reaches the whole board", () => {
  it("swings clear across the board despite being melee", () => {
    // Floor 5's rule is that its bosses reach all of it with a BASIC, and this
    // one is Melee — a rule that only widened RANGED cards would be a rule
    // about half the floor.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    const far = foeAt(s, 3, 4);
    expect(canTarget(s, s.cards[boss.instanceId], s.cards[far.instanceId], false, true),
      "three squares out, and it is melee").toBe(true);
  });

  it("...and a body in the lane still screens the swing", () => {
    // Melee has no sight rule of its own because it never reaches past the next
    // square, so the screen had to be stated for giants explicitly. Without it
    // the giant rule would silently delete the player's Fortress Gates.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    const behind = foeAt(s, 3, 2);
    foeAt(s, 2, 2);                       // in the lane
    expect(canTarget(s, s.cards[boss.instanceId], s.cards[behind.instanceId], false, true),
      "screened").toBe(false);
  });

  it("an ordinary melee card is NOT given the reach", () => {
    const s = bigPrepState();
    const me = place(s, "bore_bastion", "P2", 0, 2);
    const far = foeAt(s, 3, 4);
    expect(getDef("bore_bastion").fullBoardBasic).toBeUndefined();
    expect(canTarget(s, s.cards[me.instanceId], s.cards[far.instanceId], false, true)).toBe(false);
  });
});

describe("Continental Drift — it waits for the wall, then it walks", () => {
  /** Run one Cleanup with `gates` Fortress Gates standing in front of P1. */
  const roll = (gates: number, bossCol = 2) => {
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, bossCol);
    s.round = 9;                       // past BOSS_HOLD_ROUNDS
    for (let c = 0; c < gates; c++) place(s, VOID_GATE, "P1", s.boardSize - 2, c);
    return { s, boss, after: (n = 1) => {
      let g = s;
      for (let i = 0; i < n; i++) g = advance(atCleanup(g));
      return g.cards[boss.instanceId].pos!;
    } };
  };

  it("holds its home row while a single gate still stands", () => {
    const { after } = roll(1);
    expect(after().row, "not one step while the wall is up").toBe(0);
  });

  it("holds it before round 15 even with every wall down", () => {
    // TWO independent holds, and it needs BOTH released. Half the tower's
    // 30-round clock is spent fighting its boulders and its reach; the giant
    // itself only ever arrives late.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    s.round = 14;                                   // no gates at all
    const n = advance(atCleanup(s));
    expect(n.cards[boss.instanceId].pos!.row, "still too early").toBe(0);
  });

  it("walks once the round has come AND the last wall is gone", () => {
    const { after } = roll(0);                      // roll() sets round 9...
    expect(after().row, "round 9 is still too early").toBe(0);
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    s.round = 15;
    const n = advance(atCleanup(s));
    expect(n.cards[boss.instanceId].pos!.row, "round 15, no walls: it comes").toBeGreaterThan(0);
  });

  it("a wall standing still stops it AFTER round 15 — the later hold wins", () => {
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    place(s, VOID_GATE, "P1", s.boardSize - 2, 0);
    s.round = 20;
    const n = advance(atCleanup(s));
    expect(n.cards[boss.instanceId].pos!.row, "the gate outlasts the clock").toBe(0);
  });

  it("but it still SLIDES while it waits — the aim is not gated, the walk is", () => {
    // The distinction that makes the wall a clock rather than a pause button:
    // it spends the wait lining up on you.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 0);
    s.round = 9;
    place(s, VOID_GATE, "P1", s.boardSize - 2, 0);
    foeAt(s, 3, 4, 400, "leaf_trinezer");   // the only body, far column
    const n = advance(atCleanup(s));
    const at = n.cards[boss.instanceId].pos!;
    expect(at.row, "still home").toBe(0);
    expect(at.col, "but tracking").toBeGreaterThan(0);
  });

  it("aims at the biggest HITTER, not at the biggest crowd", () => {
    // The whole point of `aimLateralBy: "topDmg"`. Three weak bodies stacked in
    // one column must not outweigh the single thing that will actually hurt it.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    s.round = 9;
    place(s, VOID_GATE, "P1", s.boardSize - 2, 0);   // keep it home so only the slide moves it
    for (const r of [2, 3, 4]) foeAt(s, r, 0, 400, "leaf_stickviper");  // a crowd, column 0
    foeAt(s, 3, 4, 400, "leaf_oakgre");                                  // one big hitter, column 4
    const n = advance(atCleanup(s));
    expect(n.cards[boss.instanceId].pos!.col, "it walked toward the hitter").toBe(3);
  });
});

describe("Rockfall — a boulder on the boss's own beat", () => {
  const run = (round: number) => {
    const s = bigPrepState();
    place(s, BOSS, "P2", 0, 2);
    // A GATE STANDING, which is the real tower scenario and also what pins the
    // row: without one the giant advances first and then looses the boulder
    // ahead of its NEW slot, so "the row in front of him" measures one further
    // out. That is correct behaviour and it made the first version of this test
    // wrong rather than the code.
    // ...and it has to SURVIVE the round. Rockfall now shares its beat with
    // the boss clock (both 3), so on a spawn round the Special fires too — and
    // a gate it kills leaves an ON-KILL boulder in the gate's own square, which
    // is a second rock, in a different row, and not the one this measures.
    place(s, VOID_GATE, "P1", s.boardSize - 2, 0, { curHp: 500, maxHp: 500, curShields: 0 });
    s.round = round;
    const n = advance(atCleanup(s));
    return boardCards(n, "P2").filter((c) => c.curHp > 0 && c.defId === ROCK);
  };

  // Read the cadence rather than restating it: Rockfall moved 2 -> 3 to bring
  // Floor 5 into the 80-90 band, and a test that hard-codes "even" goes from
  // pinning the rule to pinning the old tuning.
  const EVERY = getDef(BOSS).roundTick!.spawnEveryN!.n;

  it("looses one on the beat", () => {
    expect(run(EVERY * 2).length, `round ${EVERY * 2}`).toBeGreaterThan(0);
  });

  it("and none off it", () => {
    expect(run(EVERY * 2 + 1).length, `round ${EVERY * 2 + 1}`).toBe(0);
  });

  it("drops it in the row directly IN FRONT of the giant", () => {
    const rocks = run(EVERY * 2);
    expect(rocks[0].pos!.row, "one row toward the player").toBe(1);
  });

  it("stops at its ceiling rather than burying the board", () => {
    // A repeating spawn with no cap is not a threat, it is a wall the player
    // cannot get through.
    let g = bigPrepState();
    place(g, BOSS, "P2", 0, 2);
    place(g, VOID_GATE, "P1", g.boardSize - 2, 0);
    g.round = 2;
    for (let i = 0; i < 12; i++) { g.round = 2 + i * 2; g = advance(atCleanup(g)); }
    const rocks = boardCards(g, "P2").filter((c) => c.curHp > 0 && c.defId === ROCK);
    expect(rocks.length).toBeLessThanOrEqual(3);
  });
});

describe("the boulder rolls THROUGH", () => {
  it("moves one slot toward the player each round", () => {
    const s = bigPrepState();
    const rock = place(s, ROCK, "P2", 1, 2);
    const n = advance(atCleanup(s));
    expect(n.cards[rock.instanceId].pos!.row, "downhill").toBe(2);
  });

  it("crushes what it rolls over instead of stopping at it", () => {
    // `advance` stops dead at the first occupied slot — right for a seed, wrong
    // for a boulder. This is the difference.
    const s = bigPrepState();
    const rock = place(s, ROCK, "P2", 1, 2);
    const victim = foeAt(s, 2, 2, 400);
    const n = advance(atCleanup(s));
    const crush = getDef(ROCK).trampleDmg!;
    expect(400 - n.cards[victim.instanceId].curHp, "the crush, through it").toBe(crush);
    expect(n.cards[rock.instanceId].pos!.row, "and it took the square").toBe(2);
  });

  it("its crush PENETRATES shields — masonry is not armour to a boulder", () => {
    // The reason a rockfall is an answer to a wall at all.
    const s = bigPrepState();
    place(s, ROCK, "P2", 1, 2);
    const gate = place(s, VOID_GATE, "P1", 2, 2, { curHp: 40, maxHp: 40, curShields: 99 });
    const n = advance(atCleanup(s));
    expect(n.cards[gate.instanceId].curHp, "the shields did not stop it").toBeLessThan(40);
  });
});

describe("Rolling Boulder, the Special", () => {
  it("leaves the rock behind when it KILLS, in the dead card's square", () => {
    // What makes the Special more than chip damage: every kill it lands turns
    // into a rolling body the player then has to answer.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 0);
    const frail = foeAt(s, 3, 3, 4);      // one body, and it dies to 35
    const where = { ...s.cards[frail.instanceId].pos! };
    fireCardSpecial(s, s.cards[boss.instanceId]);
    expect(s.cards[frail.instanceId], "it died").toBeFalsy();
    const rock = boardCards(s, "P2").find((c) => c.curHp > 0 && c.defId === ROCK);
    expect(rock, "and a boulder settled there").toBeTruthy();
    expect(rock!.pos).toEqual(where);
  });

  it("leaves nothing behind when the target SURVIVES", () => {
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 0);
    foeAt(s, 3, 3, 500);                  // survives 35 comfortably
    fireCardSpecial(s, s.cards[boss.instanceId]);
    expect(boardCards(s, "P2").some((c) => c.curHp > 0 && c.defId === ROCK),
      "no kill, no rock").toBe(false);
  });

  it("...and stops leaving them once the cap is full", () => {
    // THE BUG THIS PINS. Rockfall prints `spawnMaxAlive` and the round tick
    // honours it, but this rider never checked anything, so the ceiling bound
    // one of the two taps while the other poured rocks in over the top of it.
    // Measured consequence: moving the tick's cap 3 -> 1 changed the fight by
    // -1.0 points, because the cap was never what was producing the boulders.
    const cap = Number(getDef(BOSS).special!.params!.maxAlive);
    expect(cap, "the Special declares its own ceiling").toBeGreaterThan(0);
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 0);
    // Fill the cap with rocks that are already rolling...
    for (let i = 0; i < cap; i++) place(s, ROCK, "P2", 1, i);
    // ...then hand it a guaranteed kill.
    const frail = foeAt(s, 3, 3, 4);
    fireCardSpecial(s, s.cards[boss.instanceId]);
    expect(s.cards[frail.instanceId], "it still killed the thing").toBeFalsy();
    expect(boardCards(s, "P2").filter((c) => c.curHp > 0 && c.defId === ROCK).length,
      "but left no rock — the cap is full").toBe(cap);
  });

  it("the cap counts LIVING rocks, so a destroyed one frees a slot", () => {
    // A ceiling that counted rocks ever created would turn a mechanic the owner
    // asked for into a one-shot; clearing the board has to re-arm it.
    const cap = Number(getDef(BOSS).special!.params!.maxAlive);
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 0);
    for (let i = 0; i < cap; i++) place(s, ROCK, "P2", 1, i, { curHp: 0, maxHp: 40, curShields: 0 });
    const frail = foeAt(s, 3, 3, 4);
    const where = { ...s.cards[frail.instanceId].pos! };
    fireCardSpecial(s, s.cards[boss.instanceId]);
    const fresh = boardCards(s, "P2").find((c) => c.curHp > 0 && c.defId === ROCK);
    expect(fresh, "the dead ones do not hold the slots").toBeTruthy();
    expect(fresh!.pos).toEqual(where);
  });

  it("the rock it leaves does not roll the round it lands", () => {
    // Same `rollHeld` rule every loosed boulder follows: a rock that appeared
    // and immediately moved would never be seen in the square it took.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 0);
    const frail = foeAt(s, 3, 3, 4);
    const where = { ...s.cards[frail.instanceId].pos! };
    fireCardSpecial(s, s.cards[boss.instanceId]);
    const rock = boardCards(s, "P2").find((c) => c.defId === ROCK)!;
    expect(rock.rollHeld, "held for one tick").toBe(true);
    expect(rock.pos).toEqual(where);
  });

  it("hits exactly one opponent, anywhere on the board", () => {
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 0);
    const far = foeAt(s, 4, 4, 400);
    const near = foeAt(s, 1, 0, 400);
    const before = far.curHp + near.curHp;
    // Fire it directly rather than waiting for the clock.
    fireCardSpecial(s, s.cards[boss.instanceId]);
    const after = s.cards[far.instanceId].curHp + s.cards[near.instanceId].curHp;
    expect(before - after, "one throw, one victim").toBe(Number(getDef(BOSS).special!.params!.dmg));
  });
});

// SKYBREAKER — Floor 5's first boss, and the first one on the tower whose
// SPECIAL IS ITS MOVEMENT.
//
// It has no gait: no `advance`, no `aimLateral`, nothing. It sits on its home
// row and shoots. Its only way up the board is Eye of the Storm, which trades
// places with its own Thundering Hurricane — so the token is the boss's legs,
// and where the player lets that token stand is where the boss can appear.
// Kill the hurricane and the boss is stranded at the back, but you spent your
// damage on a token; leave it and the boss blinks into your line on its clock.
//
// Three new round-ticks arrived with it and each is pinned here rather than
// only through the boss: `slowEnemies` (the storm tax), `cycloneSpin` (the
// rotation, which is DERIVED and so is the thing most likely to be subtly
// wrong), and `spawnOnRound` (a body on a clock).
import { describe, expect, it } from "vitest";
import { CARDS, getDef } from "../../data/cards";
import { VOID_BOSSES, bossElementSet, bossSummonPool, elementProblems, THIRD_ELEMENT_FROM_FLOOR, voidBossById } from "../../data/void-tower";
import { advance } from "../phases";
import { basicAttack, fireCardSpecial } from "../combat";
import { canTarget } from "../rules";
import { bossTelegraphs } from "../telegraph";
import { boardCards, effectiveSp } from "../state";
import { atCleanup, bigPrepState, place, statusOf } from "./helpers";

const BOSS = "boss_skybreaker";
const STORM = "gale_thundering_hurricane_tok";

/** A foe of P2's (the boss's side), placed on the board. */
const foeAt = (s: ReturnType<typeof bigPrepState>, row: number, col: number, hp = 200) => {
  const c = place(s, "leaf_stickviper", "P1", row, col, { curHp: hp, maxHp: hp, curShields: 0 });
  return c;
};

describe("the shape of the fight", () => {
  it("is Floor 5's first boss, GALE bodied and BOLT mechanised, and rolls no dice", () => {
    const b = voidBossById(BOSS)!;
    expect(b.floor).toBe(5);
    expect(b.tribeElement).toBe("GALE");
    expect(b.mechanicElement).toBe("BOLT");
    expect(b.tribe).toBe("Hurricane");
  });

  it("prints the owner's stat line exactly", () => {
    const d = getDef(BOSS);
    expect([d.dmg, d.hits, d.hp, d.sp]).toEqual([16, 3, 269, 20]);
  });

  it("has NO gait — the Special is how it moves", () => {
    // The one boss on the tower for which standing still is the design rather
    // than a characterisation. If a movement tick is ever added here, Eye of
    // the Storm stops being the fight.
    const rt = getDef(BOSS).roundTick ?? {};
    for (const gait of ["advance", "advanceEveryN", "aimLateral", "shiftLateral",
      "prowl", "momentum", "escortAdvance", "avoidLateral", "kite"] as const)
      expect(rt[gait], `${gait} would undo the puzzle`).toBeUndefined();
  });

  it("the hurricane is a real body, not scenery — a RANGED mage", () => {
    const t = getDef(STORM);
    expect([t.dmg, t.hp, t.sp]).toEqual([20, 55, 15]);
    // It spent a spell as a melee Warrior and came back to range (owner's
    // call). Ranged also resolves the tension melee created: a body whose
    // passive shoves the board away could never reach what it had pushed.
    expect(t.attackType).toBe("Ranged");
    expect(t.cardClass).toBe("Mage");
    expect(t.roundTick?.pushEnemies, "Wind Wake").toBe(1);
  });

  it("Storm Surge splashes EVERY neighbour, not one of them", () => {
    // A hurricane that picked a single card out of a cluster would be a
    // lightning bolt. `splashAll` is what makes it weather.
    const t = getDef(STORM);
    expect(t.basicSplash).toBe(10);
    expect(t.splashAll, "the whole neighbourhood").toBe(true);
  });

  it("...and it lands on the bodies beside whatever it hit", () => {
    const s = bigPrepState();
    const storm = place(s, STORM, "P2", 2, 2);
    const primary = foeAt(s, 3, 2, 500);
    const beside = foeAt(s, 3, 3, 500);   // adjacent to the primary
    const away = foeAt(s, 0, 0, 500);     // nowhere near it
    basicAttack(s, storm.instanceId, primary.instanceId);
    const onPrimary = 500 - s.cards[primary.instanceId].curHp;
    const onNeighbour = 500 - s.cards[beside.instanceId].curHp;
    // Relative, not absolute: the primary takes EFFECTIVE damage, which picks
    // up the element aura and the mid-row bonus, so pinning "20" here would be
    // pinning the aura table rather than the splash.
    expect(onPrimary, "the one it swung at").toBeGreaterThanOrEqual(20);
    expect(onNeighbour, "and its neighbour, for the flat splash").toBe(10);
    expect(onNeighbour, "which is the smaller share").toBeLessThan(onPrimary);
    expect(s.cards[away.instanceId].curHp, "but not the far corner").toBe(500);
  });

  it("Wind Wake shoves on the BEAT, and holds its ground between", () => {
    // It arrived to fix the melee version's self-defeat — a body that shoved
    // away everything its own basic needed to touch — and is KEPT now the card
    // is ranged again, because it is better weather: a board shoved every
    // single round can never form up at all, while a two-beat lets it re-form
    // and then breaks it again.
    const at = (round: number) => {
      const s = bigPrepState();
      place(s, STORM, "P2", 2, 2);
      const foe = foeAt(s, 3, 2, 500);
      const before = { ...s.cards[foe.instanceId].pos! };
      s.round = round;
      const n = advance(atCleanup(s));
      return { before, after: n.cards[foe.instanceId].pos! };
    };
    const beat = at(4);
    expect(beat.after, "on the beat: shoved").not.toEqual(beat.before);
    const between = at(5);
    expect(between.after, "between beats: it stands still and swings").toEqual(between.before);
  });
});

describe("THE GIANTS — Floor 5 reaches the whole board", () => {
  it("its basic attack reaches clear across the board", () => {
    // Reach 2 (3 once advanced) is the ordinary ranged cap, and on THIS boss
    // the extra reach is load-bearing rather than decorative: it never walks,
    // so without it a stationary boss cannot answer anything that stands off.
    //
    // Row 3, not row 4. Row 4 is P1's HOME ROW, which a separate rule protects
    // and only `ignoresHomeRule` (Catapult's) bypasses — `fullBoardBasic` is
    // reach and nothing else. Row 3 col 4 is 3 king-steps out and off any
    // straight line from (0,2), so it isolates the reach cap cleanly.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    const far = foeAt(s, 3, 4, 500);
    expect(canTarget(s, s.cards[boss.instanceId], s.cards[far.instanceId], false, true),
      "three squares out is in range").toBe(true);
  });

  it("the enemy HOME ROW is still protected — reach is not the home rule", () => {
    // Worth pinning as a decision rather than leaving as an accident: a giant
    // is not also a Catapult. If Floor 5 is ever meant to shoot the back line
    // from the back line, that is `ignoresHomeRule` and a separate call.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    const home = foeAt(s, 4, 4, 500);          // P1's own home row
    expect(canTarget(s, s.cards[boss.instanceId], s.cards[home.instanceId], false, true),
      "the back line still has to be walked up to").toBe(false);
  });

  it("...but a body in the way still blocks the shot", () => {
    // Reach only. `ignoresHomeRule` (Catapult's) is the neighbouring flag and
    // lobs over everything; a giant is tall, not omniscient. This is what keeps
    // the player's free wall of Fortress Gates meaningful on the one floor
    // where every boss outranges it.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    const behind = foeAt(s, 4, 2, 500);        // straight down the column
    foeAt(s, 2, 2, 500);                       // screening body on the line
    expect(canTarget(s, s.cards[boss.instanceId], s.cards[behind.instanceId], false, true),
      "screened").toBe(false);
  });

  it("an ordinary ranged card is NOT given the reach — same square, refused", () => {
    // The control for the test above: identical seat, identical target, and the
    // only difference is the flag.
    const s = bigPrepState();
    const me = place(s, "gale_rayfen", "P2", 0, 2);
    const far = foeAt(s, 3, 4, 500);
    expect(getDef("gale_rayfen").fullBoardBasic).toBeUndefined();
    expect(canTarget(s, s.cards[me.instanceId], s.cards[far.instanceId], false, true),
      "out of an ordinary shooter's reach").toBe(false);
  });
});

describe("THREE elements, which Floor 5 is the first floor to allow", () => {
  it("Skybreaker is GALE, BOLT and AQUA", () => {
    const b = voidBossById(BOSS)!;
    expect([...bossElementSet(b)].sort()).toEqual(["AQUA", "BOLT", "GALE"]);
    expect(getDef(BOSS).elementAuras, "and the CARD carries them too")
      .toEqual(["BOLT", "AQUA"]);
  });

  it("the third element widens what it may field", () => {
    const b = voidBossById(BOSS)!;
    const pool = new Set(bossSummonPool(b));
    const aqua = CARDS.find((c) => c.element === "AQUA" && !c.boss)!;
    expect(pool.has(aqua.id), "AQUA is legal for it now").toBe(true);
  });

  it("no boss below Floor 5 may have one, and the rule is enforced not reviewed", () => {
    for (const b of VOID_BOSSES) {
      expect(elementProblems(b), b.cardId).toEqual([]);
      if (b.floor < THIRD_ELEMENT_FROM_FLOOR)
        expect(b.thirdElement, `${b.cardId} is below the floor`).toBeUndefined();
    }
    // ...and the gate actually fails when it should, rather than passing
    // vacuously because nothing violates it today.
    const smuggled = { ...voidBossById("boss_rotroot")!, thirdElement: "AQUA" as const };
    expect(elementProblems(smuggled).length, "a Floor-1 boss with three elements").toBeGreaterThan(0);
  });

  it("a third element that repeats one it already has is rejected", () => {
    const dupe = { ...voidBossById(BOSS)!, thirdElement: "GALE" as const };
    expect(elementProblems(dupe).length).toBeGreaterThan(0);
  });
});

describe("Eye of the Storm — one Special, two faces", () => {
  it("with no hurricane up, it CALLS one — but not before the storm gathers", () => {
    const s = bigPrepState();
    s.round = getDef(BOSS).roundTick!.spawnOnRound!.round;   // the gathering round
    const boss = place(s, BOSS, "P2", 0, 2);
    expect(boardCards(s, "P2").some((c) => c.defId === STORM), "none yet").toBe(false);
    fireCardSpecial(s, s.cards[boss.instanceId]);
    expect(boardCards(s, "P2").some((c) => c.defId === STORM), "the storm forms").toBe(true);
  });

  it("...and the clock CANNOT pull the storm in early", () => {
    // THE BUG THIS PINS. `fireSpecialEveryN` is 3 and Gathering Storm is 6, so
    // the boss's first cast landed on round THREE, this face called a hurricane
    // then, and the round-6 tick therefore never once found an empty field:
    // measured, `spawnOnRound` fired 0 times across 48 fights while this handler
    // ran 327. A named passive that never ran, a card text promising a round it
    // did not keep, and a boss holding its legs three rounds early — worth 8.8
    // points of win rate on its own (92.7% -> 83.9%, n=192).
    const gathers = getDef(BOSS).roundTick!.spawnOnRound!.round;
    const s = bigPrepState();
    s.round = gathers - 1;
    const boss = place(s, BOSS, "P2", 0, 2);
    fireCardSpecial(s, s.cards[boss.instanceId]);
    expect(boardCards(s, "P2").some((c) => c.defId === STORM),
      "the storm has not gathered yet").toBe(false);
  });

  it("the gathering round is the one the round tick announces", () => {
    // The gate reads the boss's OWN `spawnOnRound.round` rather than a param of
    // its own, so the Special and the tick cannot drift apart into the state
    // that caused the bug above. If someone re-adds a second number, this fails.
    const rt = getDef(BOSS).roundTick!;
    expect(rt.spawnOnRound?.round, "Gathering Storm").toBe(6);
    expect(getDef(BOSS).special?.params?.minRound,
      "no rival number — the gate reads the tick").toBeUndefined();
  });

  it("with one standing, it TRADES PLACES with it", () => {
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    const storm = place(s, STORM, "P2", 3, 1);
    const bossWas = { ...s.cards[boss.instanceId].pos! };
    const stormWas = { ...s.cards[storm.instanceId].pos! };
    fireCardSpecial(s, s.cards[boss.instanceId]);
    expect(s.cards[boss.instanceId].pos, "the boss is where the storm was").toEqual(stormWas);
    expect(s.cards[storm.instanceId].pos, "and the storm is where the boss was").toEqual(bossWas);
  });

  it("...and blasts from where it LANDS, not from where it stood", () => {
    // The whole reason the swap happens first. A card beside the HURRICANE is
    // in the blast; one on the far side of the board, beside the slot the boss
    // just left, is not.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    place(s, STORM, "P2", 3, 1);
    const near = foeAt(s, 3, 2);   // beside the STORM — caught
    const away = foeAt(s, 0, 4);   // far corner — out of reach even after the shove
    fireCardSpecial(s, s.cards[boss.instanceId]);
    expect(s.cards[near.instanceId].curHp, "next to the storm: hit").toBeLessThan(200);
    expect(s.cards[away.instanceId].curHp, "across the board: untouched by the eye").toBe(200);
  });

  it("the wind wake can SHOVE a card INTO the blast — the order is load-bearing", () => {
    // Swap, then wake, then blast. A card two squares from the landing is out
    // of a reach-1 eye when the Special begins and inside it by the time the
    // eye resolves, because the hurricane's wake pushed it there. That is not
    // an accident of ordering to be tidied away: it is why standing off from
    // the storm is not by itself an answer.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    place(s, STORM, "P2", 3, 1);
    const drifted = foeAt(s, 1, 2, 500);
    const beganAt = { ...s.cards[drifted.instanceId].pos! };
    const landing = { row: 3, col: 1 };
    const cheb = (a: { row: number; col: number }, b: { row: number; col: number }) =>
      Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
    expect(cheb(beganAt, landing), "out of reach when the cast begins").toBeGreaterThan(1);
    fireCardSpecial(s, s.cards[boss.instanceId]);
    // Read off the def rather than hardcoded: the Special's damage is a tuning
    // number (25 -> 15 so far) and this test is about the ORDER of swap, wake
    // and blast, not about what the blast happens to hit for today.
    const blast = Number(getDef(BOSS).special!.params!.dmg);
    expect(500 - s.cards[drifted.instanceId].curHp, "shoved in, then hit").toBe(blast);
  });

  it("what it catches is PARALYZED for two rounds", () => {
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    place(s, STORM, "P2", 3, 1);
    const near = foeAt(s, 3, 2, 500); // survives the blast, so it can be held
    fireCardSpecial(s, s.cards[boss.instanceId]);
    const held = statusOf(s.cards[near.instanceId], "PARALYZE");
    expect(held, "held in the eye").toBeTruthy();
    expect(held!.duration).toBe(2);
  });

  it("a body the blast KILLS is not also paralysed", () => {
    // `applyStatus` on a corpse is a line in the log nobody can act on.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    place(s, STORM, "P2", 3, 1);
    const frail = foeAt(s, 3, 2, 4);
    fireCardSpecial(s, s.cards[boss.instanceId]);
    expect(s.cards[frail.instanceId], "it died instead").toBeFalsy();
  });
});

describe("High-Speed Cyclone — a rotation, not a shove", () => {
  /** Spin once and report where a foe placed at `at` ended up. */
  const spin = (at: { row: number; col: number }) => {
    const s = bigPrepState();
    place(s, BOSS, "P2", 2, 2);          // the eye, mid-board
    const foe = foeAt(s, at.row, at.col, 500);
    const n = advance(atCleanup(s));
    return n.cards[foe.instanceId]?.pos ?? null;
  };

  it("carries a card CLOCKWISE around the boss, one quarter at a time", () => {
    // N -> E -> S -> W about the eye at (2,2). Derived from the tangent rather
    // than tabulated, so this is the test that the derivation is right.
    expect(spin({ row: 1, col: 2 }), "north goes to east").toEqual({ row: 2, col: 3 });
    expect(spin({ row: 2, col: 3 }), "east goes to south").toEqual({ row: 3, col: 2 });
    expect(spin({ row: 3, col: 2 }), "south goes to west").toEqual({ row: 2, col: 1 });
    expect(spin({ row: 2, col: 1 }), "west goes to north").toEqual({ row: 1, col: 2 });
  });

  it("keeps its distance — it destroys the FORMATION, not the spacing", () => {
    // A shove is answered by walking forward again. This is answered by
    // re-forming, which costs the one move a turn the game is made of.
    const eye = { row: 2, col: 2 };
    for (const at of [{ row: 1, col: 2 }, { row: 2, col: 3 }, { row: 3, col: 2 }, { row: 2, col: 1 }]) {
      const to = spin(at)!;
      const was = Math.max(Math.abs(at.row - eye.row), Math.abs(at.col - eye.col));
      const now = Math.max(Math.abs(to.row - eye.row), Math.abs(to.col - eye.col));
      expect(now, `${JSON.stringify(at)} drifted`).toBe(was);
    }
  });

  it("never spins two cards onto one square", () => {
    const s = bigPrepState();
    place(s, BOSS, "P2", 2, 2);
    for (const at of [{ row: 1, col: 2 }, { row: 2, col: 3 }, { row: 3, col: 2 }, { row: 2, col: 1 }])
      foeAt(s, at.row, at.col, 500);
    const n = advance(atCleanup(s));
    const live = boardCards(n).filter((c) => c.pos);
    const seats = new Set(live.map((c) => `${c.pos!.row},${c.pos!.col}`));
    expect(seats.size, "one body per square").toBe(live.length);
  });

  it("leaves the board's own cards alone", () => {
    // It is a storm around the BOSS: its own side is not spun.
    const s = bigPrepState();
    place(s, BOSS, "P2", 2, 2);
    const ally = place(s, STORM, "P2", 1, 2);
    const n = advance(atCleanup(s));
    expect(n.cards[ally.instanceId].pos, "an ally holds its slot").toEqual({ row: 1, col: 2 });
  });
});

describe("Storm Front — the SP tax", () => {
  it("drags SP off every opponent, every round", () => {
    const s = bigPrepState();
    place(s, BOSS, "P2", 0, 2);
    const foe = foeAt(s, 3, 0, 500);
    const before = effectiveSp(s, s.cards[foe.instanceId]);
    const n = advance(atCleanup(s));
    expect(effectiveSp(n, n.cards[foe.instanceId]), "slowed").toBe(before - 2);
  });

  it("never drives SP below zero", () => {
    // A negative pool would bank rounds of penalty that no cleanse could reach,
    // and SP is already the tempo currency this boss is taxing.
    const s = bigPrepState();
    place(s, BOSS, "P2", 0, 2);
    const foe = foeAt(s, 3, 0, 500);
    let g = s;
    for (let i = 0; i < 6; i++) g = advance(atCleanup(g));
    expect(effectiveSp(g, g.cards[foe.instanceId])).toBeGreaterThanOrEqual(0);
  });
});

describe("Gathering Storm — a body on a clock", () => {
  const runTo = (round: number) => {
    const s = bigPrepState();
    place(s, BOSS, "P2", 0, 2);
    s.round = round;
    return advance(atCleanup(s));
  };

  it("holds off before its round", () => {
    // Round 4, not 3: the boss's Special sits on a 3-beat clock, so round 3
    // fires Eye of the Storm — which with no hurricane up CALLS one. Testing at
    // a multiple of 3 would measure the Special's spawn and call it the clock's.
    expect(boardCards(runTo(4), "P2").some((c) => c.defId === STORM), "too early").toBe(false);
  });

  it("forms on round 6", () => {
    expect(boardCards(runTo(6), "P2").some((c) => c.defId === STORM), "on the clock").toBe(true);
  });

  it("keeps ONE up, not one a round", () => {
    let g = bigPrepState();
    place(g, BOSS, "P2", 0, 2);
    g.round = 6;
    for (let i = 0; i < 4; i++) g = advance(atCleanup(g));
    const storms = boardCards(g, "P2").filter((c) => c.curHp > 0 && c.defId === STORM).length;
    expect(storms, "a clock, not a factory").toBe(1);
  });
});

describe("the hurricane itself", () => {
  it("Wind Wake shoves the WHOLE enemy line back, on its beat", () => {
    const s = bigPrepState();
    const storm = place(s, STORM, "P2", 2, 2);
    const near = foeAt(s, 3, 2, 500);
    const wide = foeAt(s, 3, 4, 500);   // nowhere near it — the wake is board-wide
    const wasNear = { ...s.cards[near.instanceId].pos! };
    const wasWide = { ...s.cards[wide.instanceId].pos! };
    s.round = 4;                        // the beat
    const n = advance(atCleanup(s));
    expect(n.cards[near.instanceId].pos, "pushed away").not.toEqual(wasNear);
    expect(n.cards[wide.instanceId].pos, "and so is the far one").not.toEqual(wasWide);
    expect(s.cards[storm.instanceId]).toBeTruthy();
  });

  it("its ARRIVAL does the opposite — it reels the board in and holds it", () => {
    // The two halves fight each other on purpose: it drags you in once, then
    // spends the fight pushing you back out, so the round it lands is the round
    // your formation is worst and its damage is highest.
    const t = getDef(STORM);
    expect(t.onSummon?.handler).toBe("barrage");
    expect(t.onSummon?.params?.dmg).toBe(15);
    expect(t.onSummon?.params?.reach).toBe(2);
    expect(t.onSummon?.params?.statusKind).toBe("PARALYZE");
    expect(t.onSummon?.params?.statusDuration).toBe(2);
    expect(t.onSummon?.params?.pullToCaster, "reels them into contact").toBeTruthy();
  });
});

describe("the telegraph tells the truth about where it will be", () => {
  it("with a hurricane up, the warning lights the STORM's neighbourhood", () => {
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    place(s, STORM, "P2", 3, 1);
    const near = foeAt(s, 3, 2, 500);   // beside the storm
    foeAt(s, 1, 2, 500);                // beside the boss's current slot
    s.round = 3; // a firing round for a 3-beat clock
    const t = bossTelegraphs(s).find((x) => x.bossId === boss.instanceId);
    expect(t, "the boss is telegraphed at all").toBeTruthy();
    const lit = new Set(t!.cells.map((c) => `${c.row},${c.col}`));
    const at = s.cards[near.instanceId].pos!;
    expect(lit.has(`${at.row},${at.col}`), "the square beside the storm is lit").toBe(true);
  });

  it("with no hurricane up there is nothing to draw — it only calls one", () => {
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    foeAt(s, 1, 2, 500);
    s.round = 3;
    const t = bossTelegraphs(s).find((x) => x.bossId === boss.instanceId);
    expect(t!.cells, "a summon lands nowhere the player can stand").toEqual([]);
  });
});

// DOMINATION — the 7×7 objective map.
//
// The mode's whole claim is that the BOARD is the win condition, so these test
// the four things that claim rests on: the map is a clean partition, nothing
// stands where nothing should, the roads are actually faster, and control is
// sticky enough that holding a Point means something.

import { describe, expect, it } from "vitest";
import {
  DOMINATION_7X7, DOMINATION_HOLD_ROUNDS, DOMINATION_MAJORITY, dominationMap,
  heldCount, isImpassable, isRoad, isShrine, isWell, newDomination, POI_GOLD, poiAt, poiRing,
  resolveHolders, runsAlongRoad,
} from "../../data/domination";
import { advance, applyIntent, canMove, canSummon, createInitialState, legalMoves } from "../index";
import { homeSlots, rangedCanSee, specialTargets, summonLandingRow, terrainBlocksPath } from "../rules";
import { cardAt, moveReach, spawnTokens, summonCard } from "../state";
import { pushBack } from "../combat";
import { pickBasicTarget } from "../phases";
import { aiPrepIntent, pointGoals } from "../ai";
import { atBattle } from "./helpers";
import { deckLimits } from "../../data/custom-decks";
import { getDef } from "../../data/cards";
import type { GameState, PlayerId, Pos } from "../types";
import { homeRow } from "../types";

const M = DOMINATION_7X7;
const DECK = [
  "leaf_oak", "leaf_python", "leaf_birch", "leaf_stickers", "leaf_nettle", "leaf_weeds",
  "leaf_sticks", "leaf_cactus", "leaf_leaf", "leaf_stickviper", "leaf_hunter", "leaf_walking_tree",
];

/** A live 7×7 Domination match, past the mulligan, with both sides human so
 *  nothing takes a turn on its own. */
function domState(seed = 7): GameState {
  let s: GameState = createInitialState(seed, DECK, DECK, ["P1", "P2"], undefined, [], M.boardSize);
  s.domination = newDomination(M);
  s.players.P1.mulliganDone = true;
  s.players.P2.mulliganDone = true;
  for (let i = 0; i < 40 && s.phase === "mulligan"; i++) s = advance(s);
  s.players.P1.gold = 30;
  s.players.P2.gold = 30;
  // Park it in Prep with P1 on priority: these tests are about the map's rules,
  // not about the phase machine getting there.
  s.phase = "prep";
  s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
  return s;
}

const put = (s: GameState, id: string, p: PlayerId, row: number, col: number) => {
  const c = summonCard(s, p, id, { row, col });
  c.summonedThisRound = false;
  // Auto, so the battle phase resolves itself. Both sides are human here (the
  // tests drive priority directly), and a manual card with a legal action stops
  // the round to ask — which stalls the very round these tests need to finish.
  c.autoMode = "basic";
  return c;
};

describe("the map is a partition", () => {
  it("every one of the 49 slots is either a Point or a road, never both", () => {
    // The claim in the file header, checked rather than asserted in a comment:
    // 4 Points x 9 = 36, plus the 13-slot road cross, is exactly the board.
    let poi = 0, road = 0;
    for (let r = 0; r < M.boardSize; r++)
      for (let c = 0; c < M.boardSize; c++) {
        const inPoi = !!poiAt(M, r, c);
        expect(inPoi, `${r},${c} is both`).toBe(!isRoad(M, r, c));
        if (inPoi) poi++; else road++;
      }
    expect(poi).toBe(36);
    expect(road).toBe(13);
    expect(poi + road).toBe(M.boardSize * M.boardSize);
  });

  it("has four 8-slot Points, none of them overlapping", () => {
    const seen = new Set<string>();
    for (const p of M.pois) {
      const ring = poiRing(p);
      expect(ring, `${p.id} ring`).toHaveLength(8);
      for (const s of ring) {
        expect(seen.has(`${s.row},${s.col}`), `${p.id} overlaps another Point`).toBe(false);
        seen.add(`${s.row},${s.col}`);
        // ...and every ring slot is on the board, which a 3×3 centred one slot
        // from the edge only just manages.
        expect(s.row >= 0 && s.row < M.boardSize && s.col >= 0 && s.col < M.boardSize).toBe(true);
      }
    }
    expect(seen.size, "32 capturable slots").toBe(32);
  });

  it("puts all four shrines on the road, never inside a Point", () => {
    expect(M.shrines).toHaveLength(4);
    for (const s of M.shrines) {
      expect(isShrine(M, s.row, s.col)).toBe(true);
      expect(isRoad(M, s.row, s.col), "a shrine inside a Point").toBe(true);
      expect(isImpassable(M, s.row, s.col), "a shrine nothing can stand on").toBe(false);
    }
  });

  it("closes five slots: the four citadels and the crossroads", () => {
    const dead: string[] = [];
    for (let r = 0; r < M.boardSize; r++)
      for (let c = 0; c < M.boardSize; c++) if (isImpassable(M, r, c)) dead.push(`${r},${c}`);
    // FOUR citadels. The crossroads is no longer among them — it is the Well,
    // and a square nothing can stand on cannot heal anything.
    expect(dead.sort()).toEqual(["1,1", "1,5", "5,1", "5,5"].sort());
    expect(isImpassable(M, 3, 3), "the Well must be standable").toBe(false);
  });

  it("gives a 7×7 board a real deck size instead of the 4×4 default", () => {
    // Without an entry, deckLimits(7) silently falls back to the standard board
    // — eighteen cards spread over forty-nine slots.
    expect(deckLimits(7).target).toBe(30);
    expect(deckLimits(7).target).not.toBe(deckLimits(4).target);
  });
});

describe("nothing stands on a closed slot", () => {
  it("refuses a move onto a citadel", () => {
    const s = domState();
    const centre = M.pois[0].centre;                    // 1,1
    const c = put(s, "leaf_weeds", "P1", centre.row, centre.col - 1);
    expect(canMove(s, "P1", c.instanceId, centre).ok, "walked into a citadel").toBe(false);
    expect(canMove(s, "P1", c.instanceId, centre).reason).toMatch(/stand/i);
    // ...but the crossroads IS walkable now: it is the Well, and a square
    // nothing can stand on cannot heal anything.
    const w = put(s, "leaf_weeds", "P1", 3, 2);
    expect(canMove(s, "P1", w.instanceId, { row: 3, col: 3 }).ok, "the Well is closed").toBe(true);
    // ...and legalMoves agrees, so no closed slot ever lights up.
    for (const m of legalMoves(s, "P1", c.instanceId))
      expect(isImpassable(M, m.row, m.col), `${m.row},${m.col} offered`).toBe(false);
  });

  it("still allows the slots around it", () => {
    const s = domState();
    const c = put(s, "leaf_weeds", "P1", 3, 2);
    expect(legalMoves(s, "P1", c.instanceId).length, "boxed in entirely").toBeGreaterThan(0);
  });
});

describe("the roads are faster", () => {
  it("gives +1 reach along a lane and nothing off it", () => {
    const s = domState();
    // A SLOW card — and the test now SAYS so rather than trusting a stat line to
    // stay where it was. Weeds was the subject until it was re-cut SP 4 -> 6,
    // which is reach 2 (SP_SLOW_MAX is 5): the off-road half below then passed
    // because the card could make the move on its own legs, which is the exact
    // opposite of what this is checking. Asserting the premise means the next
    // re-cut fails here saying "your subject is no longer slow" instead of
    // quietly proving nothing.
    const SLOW = "leaf_greegon";
    expect(moveReach(getDef(SLOW).sp), `${SLOW} is no longer a reach-1 card`).toBe(1);
    const c = put(s, SLOW, "P1", 3, 0);   // the west shrine, on row D
    expect(runsAlongRoad(M, { row: 3, col: 0 }, { row: 3, col: 2 })).toBe(true);
    expect(canMove(s, "P1", c.instanceId, { row: 3, col: 2 }).ok, "two slots down the lane").toBe(true);
    // The same distance OFF the road is refused — this is the road doing it,
    // not the card simply being fast.
    expect(runsAlongRoad(M, { row: 3, col: 0 }, { row: 1, col: 0 })).toBe(false);
    expect(canMove(s, "P1", c.instanceId, { row: 1, col: 0 }).ok, "two slots into a Point").toBe(false);
  });

  it("runs THROUGH the crossroads now that the Well stands there", () => {
    // This used to be the opposite assertion. The junction was shut, so the two
    // lanes never joined; opening it for the Well joins them, which is the
    // trade — the middle is the fastest ground on the map AND the ground that
    // mends you, so it is worth contesting rather than worth avoiding.
    expect(runsAlongRoad(M, { row: 3, col: 2 }, { row: 3, col: 4 })).toBe(true);
    expect(runsAlongRoad(M, { row: 2, col: 3 }, { row: 4, col: 3 })).toBe(true);
    // A lane still stops at a Point — the roads are the leftover cross, and
    // that has not changed.
    expect(runsAlongRoad(M, { row: 3, col: 0 }, { row: 1, col: 0 })).toBe(false);
  });

  it("gives a pinned card nothing — a road is a faster way to move, not a way to move", () => {
    const s = domState();
    const c = put(s, "leaf_weeds", "P1", 3, 0);
    s.cards[c.instanceId].spBonus = -99;          // reach 0
    expect(canMove(s, "P1", c.instanceId, { row: 3, col: 1 }).ok).toBe(false);
  });
});

describe("shrines take a summon from either side", () => {
  it("lets both players deploy onto a shrine, and only onto an empty one", () => {
    const s = domState();
    const [shrine] = M.shrines;
    const hand = s.players.P1.hand[0];
    expect(canSummon(s, "P1", hand.handId, shrine.col, shrine.row).ok).toBe(true);
    // The SAME square is legal for the opponent — that is what neutral means.
    s.prep!.priority = "P2";
    const foeHand = s.players.P2.hand[0];
    expect(canSummon(s, "P2", foeHand.handId, shrine.col, shrine.row).ok).toBe(true);
    // ...until somebody is standing on it.
    put(s, "leaf_weeds", "P1", shrine.row, shrine.col);
    expect(canSummon(s, "P2", foeHand.handId, shrine.col, shrine.row).ok).toBe(false);
    expect(canSummon(s, "P2", foeHand.handId, shrine.col, shrine.row).reason).toMatch(/occupied/i);
  });

  it("actually lands the card ON the shrine, not on a home row", () => {
    const s = domState();
    const shrine = M.shrines[0];                  // row 0 — NOT P1's home row
    const hand = s.players.P1.hand[0];
    const next = applyIntent(s, {
      type: "SUMMON", player: "P1", handId: hand.handId, col: shrine.col, row: shrine.row,
    });
    const landed = Object.values(next.cards).find(
      (c) => c.pos?.row === shrine.row && c.pos?.col === shrine.col);
    expect(landed, "nothing arrived on the shrine").toBeTruthy();
    expect(landed!.owner).toBe("P1");
  });

  it("refuses a square that is not a shrine", () => {
    const s = domState();
    const hand = s.players.P1.hand[0];
    expect(canSummon(s, "P1", hand.handId, 2, 2).ok, "deployed into a Point").toBe(false);
  });
});

describe("holding a Point", () => {
  const zero = () => ({
    A: { P1: 0, P2: 0 }, B: { P1: 0, P2: 0 },
    C: { P1: 0, P2: 0 }, D: { P1: 0, P2: 0 },
  });
  const none = () => ({ A: null, B: null, C: null, D: null } as Record<string, PlayerId | null>);

  it("goes to whoever has MORE bodies on the ring", () => {
    const c = zero(); c.A = { P1: 2, P2: 1 };
    expect(resolveHolders(M, c, none() as never).A).toBe("P1");
  });

  it("is STICKY — a tie does not flip it, and neither does an empty ring", () => {
    const held = { ...none(), A: "P1" } as Record<string, PlayerId | null>;
    const drawn = zero(); drawn.A = { P1: 2, P2: 2 };
    expect(resolveHolders(M, drawn, held as never).A, "a tie took it").toBe("P1");
    expect(resolveHolders(M, zero(), held as never).A, "walking away lost it").toBe("P1");
    // Out-numbering IS enough, which is the other half of the same rule.
    const beaten = zero(); beaten.A = { P1: 1, P2: 2 };
    expect(resolveHolders(M, beaten, held as never).A).toBe("P2");
  });
});

describe("winning the map", () => {
  /** Park `n` P1 bodies on each of the named Points and run one full round. */
  function holdPoints(ids: string[], s = domState()): GameState {
    for (const id of ids) {
      const poi = M.pois.find((p) => p.id === id)!;
      for (const slot of poiRing(poi).slice(0, 2)) put(s, "leaf_weeds", "P1", slot.row, slot.col);
    }
    return s;
  }

  const runRounds = (s: GameState, rounds: number): GameState => {
    const target = s.round + rounds;
    for (let i = 0; i < 6000 && s.phase !== "gameover" && s.round < target; i++) {
      const next = s.phase === "prep" && s.prep
        ? applyIntent(s, { type: "PASS", player: s.prep.priority })
        : advance(s);
      if (next === s) break;
      s = next;
    }
    return s;
  };

  it("ends the moment one side holds all four", () => {
    const s = runRounds(holdPoints(["A", "B", "C", "D"]), 2);
    expect(s.win?.by, `won by ${s.win?.by}`).toBe("domination");
    expect(s.win?.winner).toBe("P1");
    expect(s.log.some((l) => /TOTAL DOMINATION/.test(l))).toBe(true);
  });

  it("does NOT end on a majority taken this round — it has to survive three", () => {
    // Three Points, three rounds in a row. Checked round by round rather than
    // by running to the end, so a change to either number fails here loudly.
    expect(DOMINATION_MAJORITY).toBe(3);
    expect(DOMINATION_HOLD_ROUNDS).toBe(3);
    let s = holdPoints(["A", "B", "C"]);
    for (let round = 1; round < DOMINATION_HOLD_ROUNDS; round++) {
      s = runRounds(s, 1);
      expect(s.win, `three Points won it after only ${round} round(s)`).toBeFalsy();
      expect(s.domination!.streak.P1).toBe(round);
    }
    s = runRounds(s, 1);
    expect(s.win?.by).toBe("domination");
    expect(s.win?.winner).toBe("P1");
  });

  it("resets the streak when the majority slips", () => {
    const s = runRounds(holdPoints(["A", "B", "C"]), 1);
    expect(s.domination!.streak.P1).toBe(1);
    // P2 takes one of them back — 4 bodies against P1's 2 on Point C's ring.
    // Everything on the board is made unkillable first: this is a test about
    // COUNTING bodies at the end of a round, and without it the two sides
    // simply kill each other on the ring and the count never happens.
    const poi = M.pois.find((p) => p.id === "C")!;
    for (const slot of poiRing(poi).slice(2, 6)) put(s, "leaf_weeds", "P2", slot.row, slot.col);
    for (const c of Object.values(s.cards)) { c.maxHp = 9999; c.curHp = 9999; }
    const after = runRounds(s, 1);
    expect(after.domination!.held.C).toBe("P2");
    expect(after.domination!.streak.P1, "the streak survived losing the majority").toBe(0);
    expect(after.win).toBeFalsy();
  });

  it("switches Home-row capture OFF, the way Void Tower does", () => {
    // Sitting on every one of P2's home slots is the ordinary win condition and
    // must do nothing here — the Points are the only score.
    const s = domState();
    for (let col = 0; col < M.boardSize; col++)
      if (!isImpassable(M, 0, col)) put(s, "leaf_weeds", "P1", 0, col);
    const after = runRounds(s, 1);
    expect(after.win?.by, "won by capture in Domination").not.toBe("capture");
  });

  it("leaves an ordinary match completely alone", () => {
    // Nothing above may leak: no `domination` block means the old rules.
    let s: GameState = createInitialState(9, DECK, DECK, [], undefined, [], 5);
    expect(s.domination).toBeUndefined();
    for (let i = 0; i < 4000 && s.phase !== "gameover"; i++) {
      const n = advance(s); if (n === s) break; s = n;
    }
    expect(s.phase).toBe("gameover");
    expect(s.win?.by).not.toBe("domination");
  });

  it("registers the map by id, which is all the state carries", () => {
    expect(dominationMap("dom7")).toBe(M);
    expect(dominationMap("nope")).toBeUndefined();
    const d = newDomination(M);
    expect(d.mapId).toBe("dom7");
    expect(heldCount(d.held as never, "P1")).toBe(0);
  });
});

describe("the Points pay", () => {
  it("adds +2 GOLD per held Point, on top of the ordinary flow", () => {
    // Measured as a DELTA against the same round with nothing held, so this
    // asserts the Point income and not the whole resource curve.
    const base = domState();
    const withPoints = domState();
    for (const id of ["A", "B"]) {
      withPoints.domination!.held[id] = "P1";
    }
    const run = (s: GameState) => {
      s.phase = "resource";
      const before = { g: s.players.P1.gold, m: s.players.P1.magicPool };
      s.players.P1.gold = 0; s.players.P1.magicPool = 0;
      const out = advance(s);
      void before;
      return { gold: out.players.P1.gold, magic: out.players.P1.magicPool };
    };
    const a = run(base);
    const b = run(withPoints);
    expect(b.gold - a.gold, "two Points should pay 2 x POI_GOLD").toBe(2 * POI_GOLD);
    expect(POI_GOLD).toBe(2);
    // ...and NO MAGIC. Points used to pay a point of magic each, which was the
    // wrong pool to compound: gold buys bodies, bodies hold rings, rings pay.
    // Magic buys Specials — a second advantage stacked on a side already
    // winning the board. Asserted as a zero rather than dropped, because
    // "holding Points changes nothing about magic" is the actual rule.
    expect(b.magic - a.magic, "Points are still paying magic").toBe(0);
  });

  it("pays nothing for standing on a 'home row' — the Points ARE the economy", () => {
    // The ordinary economy pays a gold per body standing on your own home row.
    // On this map that row does not exist as a thing anyone owns: row 6 is six
    // Point-ring slots and a shrine, so the bonus paid a SECOND time for the
    // very bodies already earning POI_GOLD for holding the Point — and only for
    // the two Points that happen to sit on rows 0 and 6, not the other two. It
    // also paid P3 and P4 for standing on a row `homeRow` only has an answer
    // for because it was asked about two seats.
    const bare = domState();
    const parked = domState();
    // The shrine on row 6: on the home row, but on no Point's ring, so nothing
    // else could be paying for it and the delta is the home-slot bonus alone.
    put(parked, "leaf_weeds", "P1", homeRow("P1", M.boardSize), 3);
    const run = (st: GameState) => {
      st.phase = "resource";
      st.players.P1.gold = 0;
      return advance(st).players.P1.gold;
    };
    expect(run(parked) - run(bare), "a body parked on the home row still earns").toBe(0);
  });

  it("pays the holder and nobody else", () => {
    const s = domState();
    s.domination!.held.A = "P2";
    s.phase = "resource";
    s.players.P1.gold = 0; s.players.P2.gold = 0;
    const out = advance(s);
    expect(out.players.P2.gold - out.players.P1.gold,
      "P2 holds one Point, P1 holds none").toBe(POI_GOLD);
  });

  it("pays nothing in an ordinary match", () => {
    // The income rides on `domination` alone, so a 5x5 must be untouched.
    let s: GameState = createInitialState(4, DECK, DECK, [], undefined, [], 5);
    s.players.P1.mulliganDone = true; s.players.P2.mulliganDone = true;
    for (let i = 0; i < 40 && s.phase === "mulligan"; i++) s = advance(s);
    expect(s.domination).toBeUndefined();
    s.phase = "resource";
    s.players.P1.gold = 0;
    const out = advance(s);
    // Round-1 base gain plus home slots held; no Point money can be in there.
    expect(out.players.P1.gold).toBeLessThanOrEqual(1 + s.boardSize);
  });
});

describe("you deploy at the shrines and nowhere else", () => {
  it("refuses a column-addressed summon — there is no Home row here", () => {
    const s = domState();
    const hand = s.players.P1.hand[0];
    for (let col = 0; col < M.boardSize; col++)
      expect(canSummon(s, "P1", hand.handId, col).ok, `column ${col} was allowed`).toBe(false);
    expect(canSummon(s, "P1", hand.handId, 0).reason).toMatch(/shrine/i);
  });

  it("offers every seat the same four squares", () => {
    const s = domState();
    const shrines = M.shrines.map((x) => `${x.row},${x.col}`).sort();
    for (const seat of ["P1", "P2"] as PlayerId[])
      expect(homeSlots(s, seat).map((x) => `${x.row},${x.col}`).sort(),
        `${seat} deploys somewhere else`).toEqual(shrines);
  });

  it("never lands a summon deeper into the board when a shrine is taken", () => {
    // The forward-creep fallback exists so a side whose Home row is overrun is
    // not softlocked. Domination has no Home row and four neutral shrines, so
    // there is nothing to escape — and letting it run walked a seat's spawn
    // toward the enemy every time its own end filled up.
    const s = domState();
    for (const sh of M.shrines) put(s, "leaf_weeds", "P2", sh.row, sh.col);
    expect(summonLandingRow(s, "P1", 3), "fell back to a deeper row").toBeNull();
    const hand = s.players.P1.hand[0];
    for (const sh of M.shrines)
      expect(canSummon(s, "P1", hand.handId, sh.col, sh.row).ok).toBe(false);
  });

  it("never captures a Home slot, so a Point cannot be whittled away", () => {
    // The end rows are part of Points C and D. A capture locks a slot for the
    // rest of the match, so capture running here would permanently delete ring
    // squares the objective is counted on.
    const s = domState();
    const home = M.boardSize - 1;
    for (let col = 0; col < M.boardSize; col++)
      if (!isImpassable(M, home, col)) put(s, "leaf_weeds", "P2", home, col);
    let out = s;
    for (let i = 0; i < 400 && out.phase !== "gameover" && out.round < s.round + 2; i++) {
      const n = out.phase === "prep" && out.prep
        ? applyIntent(out, { type: "PASS", player: out.prep.priority })
        : advance(out);
      if (n === out) break;
      out = n;
    }
    expect(out.slots.flat().filter((sl) => sl.capturedBy).length,
      "a slot was captured in Domination").toBe(0);
  });
});

describe("a Point is a wall", () => {
  it("stops a ranged shot that would pass straight through a citadel", () => {
    // Cover is the whole point: the squares behind a citadel are somewhere a
    // card can actually shelter, so taking a Point means fighting around its
    // walls rather than shooting across them.
    const s = domState();
    const centre = M.pois[0].centre;                      // 1,1
    const shooter = put(s, "pyro_flamehound", "P1", centre.row - 1, centre.col - 1);
    const hidden = put(s, "leaf_weeds", "P2", centre.row + 1, centre.col + 1);
    expect(isImpassable(M, centre.row, centre.col), "the square between them").toBe(true);
    expect(rangedCanSee(s, shooter.pos!, hidden.pos!, "P1", 9),
      "shot straight through the citadel").toBe(false);
  });

  it("still allows the shot when the line misses the citadel", () => {
    // The guard on the rule: it screens what is BEHIND it, not the whole Point.
    const s = domState();
    const centre = M.pois[0].centre;
    const shooter = put(s, "pyro_flamehound", "P1", centre.row - 1, centre.col - 1);
    const beside = put(s, "leaf_weeds", "P2", centre.row + 1, centre.col - 1);
    expect(rangedCanSee(s, shooter.pos!, beside.pos!, "P1", 9)).toBe(true);
  });

  it("screens EVERYONE — masonry does not care whose shot it is", () => {
    const s = domState();
    const centre = M.pois[1].centre;
    const a = { row: centre.row - 1, col: centre.col - 1 };
    const b = { row: centre.row + 1, col: centre.col + 1 };
    expect(rangedCanSee(s, a as never, b as never, "P1", 9)).toBe(false);
    expect(rangedCanSee(s, b as never, a as never, "P2", 9)).toBe(false);
  });

  it("cannot be walked through when it blocks every route", () => {
    const s = domState();
    const centre = M.pois[2].centre;                      // 5,1
    // Straight across the citadel, two squares along its own row: the ONLY
    // one-step route between the ends is the wall itself.
    const c = put(s, "leaf_weeds", "P1", centre.row, centre.col - 1);
    expect(terrainBlocksPath(s, s.cards[c.instanceId], { row: centre.row, col: centre.col + 1 }))
      .toBe(true);
  });

  it("lets a card walk AROUND it when a route is open", () => {
    const s = domState();
    const centre = M.pois[2].centre;
    const c = put(s, "leaf_weeds", "P1", centre.row - 1, centre.col - 1);
    // Two squares along the row ABOVE the citadel — ordinary ground between.
    expect(terrainBlocksPath(s, s.cards[c.instanceId], { row: centre.row - 1, col: centre.col + 1 }))
      .toBe(false);
  });
});

describe("the Well", () => {
  const wellAt = M.well!.at;

  it("mends a card standing on it, the round it arrives", () => {
    const s = domState();
    const c = put(s, "leaf_weeds", "P1", wellAt.row, wellAt.col);
    s.cards[c.instanceId].maxHp = 40;
    s.cards[c.instanceId].curHp = 10;
    let out = s;
    for (let i = 0; i < 400 && out.round < s.round + 1 && out.phase !== "gameover"; i++) {
      const n = out.phase === "prep" && out.prep
        ? applyIntent(out, { type: "PASS", player: out.prep.priority })
        : advance(out);
      if (n === out) break;
      out = n;
    }
    expect(out.cards[c.instanceId].curHp, "the Well healed nothing").toBeGreaterThan(10);
    expect(out.log.some((l) => /drinks from the Well/.test(l))).toBe(true);
  });

  it("keeps healing after the card steps off — 2 HP for 3 rounds", () => {
    // The heal-over-time is what makes the Well worth a detour rather than
    // worth camping on: you take a drink and carry it with you.
    const s = domState();
    const c = put(s, "leaf_weeds", "P1", wellAt.row, wellAt.col);
    const inst = s.cards[c.instanceId];
    inst.maxHp = 40;
    inst.curHp = 10;
    let out = s;
    for (let i = 0; i < 400 && out.round < s.round + 1; i++) {
      const n = out.phase === "prep" && out.prep
        ? applyIntent(out, { type: "PASS", player: out.prep.priority })
        : advance(out);
      if (n === out) break;
      out = n;
    }
    const after = out.cards[c.instanceId];
    expect(after.regenPower).toBe(M.well!.hp);
    expect(after.regenPower).toBe(2);
    // One round of it has already been spent, so the rest travels with the card.
    expect(after.regenRoundsLeft).toBe(M.well!.rounds - 1);
    expect(M.well!.rounds).toBe(3);
  });

  it("is exactly one square, in the centre", () => {
    expect(M.well).toBeTruthy();
    expect(wellAt).toEqual({ row: 3, col: 3 });
    let count = 0;
    for (let r = 0; r < M.boardSize; r++)
      for (let c = 0; c < M.boardSize; c++) if (isWell(M, r, c)) count++;
    expect(count, "more than one Well").toBe(1);
  });
});

describe("the AI plays the objective", () => {
  /** An AI-vs-AI Domination match, driven to the end. */
  function aiMatch(seed: number, seats = 2) {
    const D = (id: string) => Array.from({ length: 30 }, () => id);
    const extra = ([{ id: "P3" as PlayerId, deck: D("leaf_weeds") },
                    { id: "P4" as PlayerId, deck: D("leaf_weeds") }]).slice(0, seats - 2);
    let s: GameState = createInitialState(
      seed, D("leaf_weeds"), D("leaf_weeds"), [], undefined, [], M.boardSize,
      undefined, undefined, undefined, extra.length ? extra : undefined);
    s.domination = newDomination(M);
    let everOnRing = 0;
    for (let i = 0; i < 40000 && s.phase !== "gameover"; i++) {
      const n = advance(s);
      if (n === s) break;
      s = n;
      let onRing = 0;
      for (const poi of M.pois)
        for (const sq of poiRing(poi)) {
          const occ = cardAt(s, sq.row, sq.col);
          if (occ && occ.curHp > 0) onRing++;
        }
      everOnRing = Math.max(everOnRing, onRing);
    }
    return { end: s, everOnRing };
  }

  it("wins on the Points instead of grinding to the clock", () => {
    // Measured before this existed: the AI aimed at `homeRow(enemyOf(player))`,
    // which on this map is ordinary ground and worth nothing — 9 of 12 matches
    // ran the full 50 rounds and ended on the timeout tiebreak. Pointed at the
    // Points it wins in single figures.
    const { end } = aiMatch(11);
    expect(end.phase).toBe("gameover");
    expect(end.win?.by, `won by ${end.win?.by} on round ${end.round}`).toBe("domination");
    expect(end.round, "took the clock's whole 50 rounds").toBeLessThan(30);
  });

  it("actually stands on the Points", () => {
    // The behaviour underneath the win: bodies on the rings, which is the only
    // way control is ever taken.
    const { everOnRing } = aiMatch(23);
    expect(everOnRing, "never put a card on a Point").toBeGreaterThan(2);
  });

  // Four seats playing a whole match to a decision is seconds of real work, not
  // milliseconds — measured at 1.6-2.8s across runs against vitest's 5s default,
  // so it was one slow run away from a red suite that had nothing to do with the
  // code. Timed for what it actually does.
  it("does it in a four-way too", () => {
    const { end } = aiMatch(37, 4);
    expect(end.phase).toBe("gameover");
    expect(end.win?.by).toBe("domination");
  }, 30_000);

  it("leaves the standard board's AI alone", () => {
    // The Domination branch is gated on `state.domination`; a 5x5 must still be
    // played by the capture-and-advance ladder, and still end.
    const D = (id: string) => Array.from({ length: 30 }, () => id);
    let s: GameState = createInitialState(9, D("leaf_weeds"), D("pyro_bbq"), [], undefined, [], 5);
    expect(s.domination).toBeUndefined();
    for (let i = 0; i < 40000 && s.phase !== "gameover"; i++) {
      const n = advance(s); if (n === s) break; s = n;
    }
    expect(s.phase).toBe("gameover");
    expect(s.win?.by).not.toBe("domination");
  });
});

describe("a Point you hold is a forward spawn", () => {
  it("lets you deploy onto the ring of a Point you hold", () => {
    const s = domState();
    const poi = M.pois[0];
    s.domination!.held[poi.id] = "P1";
    const ring = poiRing(poi)[0];
    const hand = s.players.P1.hand[0];
    expect(canSummon(s, "P1", hand.handId, ring.col, ring.row).ok,
      "could not land on a Point we hold").toBe(true);
    expect(homeSlots(s, "P1").some((x) => x.row === ring.row && x.col === ring.col)).toBe(true);
  });

  it("does NOT let you deploy onto a Point somebody else holds", () => {
    const s = domState();
    const poi = M.pois[1];
    s.domination!.held[poi.id] = "P2";
    const ring = poiRing(poi)[0];
    const hand = s.players.P1.hand[0];
    expect(canSummon(s, "P1", hand.handId, ring.col, ring.row).ok).toBe(false);
  });

  it("takes the spawn away with the Point when it flips", () => {
    // The rule reads `held` live, so losing the ground loses the landing zone.
    const s = domState();
    const poi = M.pois[2];
    const ring = poiRing(poi)[0];
    s.domination!.held[poi.id] = "P1";
    expect(homeSlots(s, "P1").some((x) => x.row === ring.row && x.col === ring.col)).toBe(true);
    s.domination!.held[poi.id] = "P2";
    expect(homeSlots(s, "P1").some((x) => x.row === ring.row && x.col === ring.col)).toBe(false);
  });

  it("still always offers the four neutral shrines", () => {
    const s = domState();
    for (const sh of M.shrines)
      expect(homeSlots(s, "P1").some((x) => x.row === sh.row && x.col === sh.col),
        `shrine ${sh.row},${sh.col} stopped being a deploy square`).toBe(true);
  });
});

describe("battle targeting goes for the Point holders", () => {
  it("picks the body on a Point over an equal one that is not", () => {
    const s = domState();
    const poi = M.pois[0];
    s.domination!.held[poi.id] = "P2";           // P2 holds it — killing flips it
    const attacker = put(s, "pyro_flamehound", "P1", 3, 3);
    const ring = poiRing(poi).find((x) => x.row === 2 && x.col === 2)!;
    const onPoint = put(s, "leaf_weeds", "P2", ring.row, ring.col);
    const offPoint = put(s, "leaf_weeds", "P2", 3, 4);
    for (const c of [onPoint, offPoint]) {        // identical bodies
      s.cards[c.instanceId].curHp = 9;
      s.cards[c.instanceId].maxHp = 9;
      s.cards[c.instanceId].curShields = 0;
    }
    const pick = pickBasicTarget(s, s.cards[attacker.instanceId],
      [s.cards[onPoint.instanceId], s.cards[offPoint.instanceId]]);
    expect(pick.instanceId, "ignored the one holding the Point").toBe(onPoint.instanceId);
  });

  it("still takes a KILL over an objective it cannot finish", () => {
    // Layered UNDER lethality on purpose: a corpse holds no ground, so a kill
    // anywhere beats chip damage on a Point.
    const s = domState();
    const poi = M.pois[0];
    s.domination!.held[poi.id] = "P2";
    const attacker = put(s, "pyro_flamehound", "P1", 3, 3);
    const ring = poiRing(poi).find((x) => x.row === 2 && x.col === 2)!;
    const tanky = put(s, "leaf_weeds", "P2", ring.row, ring.col);
    const frail = put(s, "leaf_weeds", "P2", 3, 4);
    s.cards[tanky.instanceId].curHp = 99; s.cards[tanky.instanceId].maxHp = 99;
    s.cards[tanky.instanceId].curShields = 0;
    s.cards[frail.instanceId].curHp = 1; s.cards[frail.instanceId].maxHp = 9;
    s.cards[frail.instanceId].curShields = 0;
    const pick = pickBasicTarget(s, s.cards[attacker.instanceId],
      [s.cards[tanky.instanceId], s.cards[frail.instanceId]]);
    expect(pick.instanceId, "chased a Point instead of taking the kill").toBe(frail.instanceId);
  });

  it("leaves an ordinary board's targeting alone", () => {
    let s: GameState = createInitialState(4, ["leaf_weeds"], ["leaf_weeds"], [], undefined, [], 5);
    const attacker = summonCard(s, "P1", "pyro_flamehound", { row: 4, col: 2 });
    const a = summonCard(s, "P2", "leaf_weeds", { row: 3, col: 2 });
    const b = summonCard(s, "P2", "leaf_weeds", { row: 3, col: 3 });
    s.cards[a.instanceId].curHp = 9; s.cards[b.instanceId].curHp = 3;
    const pick = pickBasicTarget(s, s.cards[attacker.instanceId],
      [s.cards[a.instanceId], s.cards[b.instanceId]]);
    expect(pick.instanceId).toBe(b.instanceId);
  });
});

describe("the Well pays on arrival", () => {
  const wellAt = M.well!.at;

  it("heals the moment a card steps onto it, not at Cleanup", () => {
    // The Well used to pay only at Cleanup, so a card that walked onto the
    // crossroads under fire could die before the square it fought for did
    // anything for it.
    const s = domState();
    const c = put(s, "leaf_weeds", "P1", wellAt.row, wellAt.col - 1);
    s.cards[c.instanceId].maxHp = 40;
    s.cards[c.instanceId].curHp = 10;
    const next = applyIntent(s, {
      type: "MOVE", player: "P1", instanceId: c.instanceId, to: wellAt as never,
    });
    expect(next.cards[c.instanceId].curHp, "no instant heal on arrival")
      .toBe(10 + M.well!.hp);
    expect(next.log.some((l) => /drinks deep at the Well/.test(l))).toBe(true);
  });

  it("still grants the heal-over-time on top", () => {
    // Both, not either: 2 now AND 2 a round for 3 rounds.
    const s = domState();
    const c = put(s, "leaf_weeds", "P1", wellAt.row, wellAt.col - 1);
    s.cards[c.instanceId].maxHp = 40;
    s.cards[c.instanceId].curHp = 10;
    let out = applyIntent(s, {
      type: "MOVE", player: "P1", instanceId: c.instanceId, to: wellAt as never,
    });
    const afterStep = out.cards[c.instanceId].curHp;
    for (let i = 0; i < 400 && out.round < s.round + 1 && out.phase !== "gameover"; i++) {
      const n = out.phase === "prep" && out.prep
        ? applyIntent(out, { type: "PASS", player: out.prep.priority })
        : advance(out);
      if (n === out) break;
      out = n;
    }
    expect(out.cards[c.instanceId].regenPower).toBe(M.well!.hp);
    expect(out.cards[c.instanceId].curHp, "the regen stopped paying")
      .toBeGreaterThan(afterStep);
  });

  it("heals nobody for standing anywhere else on the centre row", () => {
    // The Well is ONE square, not the row. Guarding it because "centre row" is
    // an easy thing to widen by accident.
    const s = domState();
    const c = put(s, "leaf_weeds", "P1", wellAt.row, 1);
    s.cards[c.instanceId].maxHp = 40;
    s.cards[c.instanceId].curHp = 10;
    const next = applyIntent(s, {
      type: "MOVE", player: "P1", instanceId: c.instanceId, to: { row: wellAt.row, col: 2 } as never,
    });
    expect(next.cards[c.instanceId].curHp).toBe(10);
  });
});

describe("Point control counts EVERY seat", () => {
  const none = () => ({ A: null, B: null, C: null, D: null } as Record<string, PlayerId | null>);
  const counts = (a: Partial<Record<PlayerId, number>>) => ({
    A: a, B: {}, C: {}, D: {},
  }) as never;

  it("lets P3 take a Point — it could not before", () => {
    // The bug this covers: `resolveHolders` compared P1 against P2 and nothing
    // else, so a third or fourth seat was tallied and then ignored. P3 could
    // stand its whole army on a ring and never take it.
    expect(resolveHolders(M, counts({ P1: 0, P2: 0, P3: 2, P4: 0 }), none() as never).A).toBe("P3");
    expect(resolveHolders(M, counts({ P1: 0, P2: 0, P3: 0, P4: 1 }), none() as never).A).toBe("P4");
  });

  it("lets a P3 body BLOCK P2, instead of being invisible to it", () => {
    // The other half of the same bug: a lone P2 body used to beat any number of
    // P3 bodies, because P3 was never in the comparison. Level is level — the
    // Point stays where it was.
    const held = { ...none(), A: "P1" } as Record<string, PlayerId | null>;
    expect(resolveHolders(M, counts({ P1: 0, P2: 1, P3: 1, P4: 0 }), held as never).A,
      "P2 took it while level with P3").toBe("P1");
    // ...and out-numbering still works.
    expect(resolveHolders(M, counts({ P1: 0, P2: 2, P3: 1, P4: 0 }), held as never).A).toBe("P2");
  });

  it("keeps the 1v1 rule exactly as it was", () => {
    const held = { ...none(), A: "P2" } as Record<string, PlayerId | null>;
    expect(resolveHolders(M, counts({ P1: 2, P2: 1 }), held as never).A).toBe("P1");
    expect(resolveHolders(M, counts({ P1: 1, P2: 2 }), held as never).A).toBe("P2");
    expect(resolveHolders(M, counts({ P1: 2, P2: 2 }), held as never).A, "a tie flipped it").toBe("P2");
    expect(resolveHolders(M, counts({ P1: 0, P2: 0 }), held as never).A, "an empty ring flipped it").toBe("P2");
  });

  it("resolves a real four-seat board the same way", () => {
    // End to end rather than through the helper: three seats on one ring, P3
    // ahead, and the round's recount has to agree with the rule above.
    const s = domState();
    const poi = M.pois[0];
    const ring = poiRing(poi);
    put(s, "leaf_weeds", "P2", ring[0].row, ring[0].col);
    put(s, "leaf_weeds", "P3", ring[1].row, ring[1].col);
    put(s, "leaf_weeds", "P3", ring[2].row, ring[2].col);
    s.seats = ["P1", "P2", "P3"];
    let out = s;
    for (let i = 0; i < 400 && out.round < s.round + 1 && out.phase !== "gameover"; i++) {
      const n = out.phase === "prep" && out.prep
        ? applyIntent(out, { type: "PASS", player: out.prep.priority })
        : advance(out);
      if (n === out) break;
      out = n;
    }
    expect(out.domination!.held[poi.id], "P3 out-numbered 2-1 and did not take it").toBe("P3");
  });
});

describe("the trap and reroute spells aim at Points, not a Home row", () => {
  /** A Domination state where it is the AI's (P2's) prep turn. */
  function aiTurn(spellId: string) {
    const s = domState();
    s.humans = ["P1"];
    s.prep = { priority: "P2", consecutivePasses: 0, movedThisTurn: false };
    s.players.P2.hand = [];                        // no summon to prefer
    s.players.P2.spellbook = [{ defId: spellId, used: false }];
    s.players.P2.magicPool = 20;
    return s;
  }

  it("never mines a citadel — a mine nothing can step on is a wasted one-shot", () => {
    const s = aiTurn("pyro_ember_trap");
    // Enemies on the board so the trap step engages at all.
    for (const sq of poiRing(M.pois[0]).slice(0, 2)) put(s, "leaf_weeds", "P1", sq.row, sq.col);
    put(s, "leaf_weeds", "P2", 3, 3);
    const intent = aiPrepIntent(s, "P2");
    if (intent.type === "CAST_SPELL" && intent.row !== undefined && intent.col !== undefined)
      expect(isImpassable(M, intent.row, intent.col), "laid a trap on a citadel").toBe(false);
  });

  it("lays the trap on a Point's ring rather than a Home row", () => {
    const s = aiTurn("pyro_ember_trap");
    for (const sq of poiRing(M.pois[0]).slice(0, 3)) put(s, "leaf_weeds", "P1", sq.row, sq.col);
    put(s, "leaf_weeds", "P2", 3, 3);
    const intent = aiPrepIntent(s, "P2");
    expect(intent.type).toBe("CAST_SPELL");
    if (intent.type === "CAST_SPELL" && intent.row !== undefined && intent.col !== undefined) {
      expect(poiAt(M, intent.row, intent.col), "mined open ground away from any Point").toBeTruthy();
      // ...and NOT on its own Home row, which is what it used to prefer.
      expect(intent.row).not.toBe(0);
    }
  });

  it("keeps the standard board's Home-row trap exactly as it was", () => {
    let s: GameState = createInitialState(5, DECK, DECK, ["P1"], undefined, [], 5);
    s.players.P1.mulliganDone = true; s.players.P2.mulliganDone = true;
    for (let i = 0; i < 40 && s.phase === "mulligan"; i++) s = advance(s);
    s.phase = "prep";
    s.prep = { priority: "P2", consecutivePasses: 0, movedThisTurn: false };
    s.players.P2.hand = [];
    s.players.P2.spellbook = [{ defId: "pyro_ember_trap", used: false }];
    s.players.P2.magicPool = 20;
    expect(s.domination).toBeUndefined();
    const a = summonCard(s, "P1", "leaf_weeds", { row: 3, col: 2 });
    a.summonedThisRound = false;
    const intent = aiPrepIntent(s, "P2");
    if (intent.type === "CAST_SPELL" && intent.row !== undefined)
      expect(intent.row, "stopped defending its own Home row").toBe(homeRow("P2", 5));
  });
});

describe("blocking every door does not end the game for a seat", () => {
  // A seat holding no Point deploys at the four shrines and nowhere else. Sit
  // bodies on all four and it had no legal summon on any of the 49 squares —
  // and with its own bodies gone, no legal action at all, while a non-empty
  // deck kept it from being eliminated. It sat out to the round-50 timeout.
  //
  // Measured over four-seat AI mirrors before the fix: 18 of 80 games contained
  // a round where a seat had bodies gone, cards in hand and nowhere to put
  // them, the worst run six rounds long. Nobody was trying to do it.

  /** Park an enemy body on every shrine. */
  function shutEveryDoor(st: GameState) {
    for (const sh of M.shrines) put(st, "leaf_weeds", "P2", sh.row, sh.col);
  }

  const legalFor = (st: GameState, p: PlayerId) => {
    const hand = st.players[p].hand[0];
    const out: { row: number; col: number }[] = [];
    for (let r = 0; r < M.boardSize; r++)
      for (let c = 0; c < M.boardSize; c++)
        if (canSummon(st, p, hand.handId, c, r).ok) out.push({ row: r, col: c });
    return out;
  };

  it("with all four shrines held, a Point-less seat can still deploy", () => {
    const s = domState();
    shutEveryDoor(s);
    expect(heldCount(s.domination!.held, "P1"), "P1 holds no Point").toBe(0);
    expect(legalFor(s, "P1").length, "locked out of the whole board").toBeGreaterThan(0);
  });

  it("...and only onto the ROAD — never onto a Point it does not hold", () => {
    // The hatch must not hand out the win condition. Landing on a ring contests
    // a Point, so an escape from a lockout would double as a free contest.
    const s = domState();
    shutEveryDoor(s);
    for (const sq of legalFor(s, "P1")) {
      expect(isRoad(M, sq.row, sq.col), `${sq.row},${sq.col} is not road`).toBe(true);
      expect(poiAt(M, sq.row, sq.col), `${sq.row},${sq.col} belongs to a Point`).toBeUndefined();
      expect(isImpassable(M, sq.row, sq.col)).toBe(false);
    }
  });

  it("stays SHUT while even one door is open", () => {
    // The discipline the Void Tower fallback got wrong first time round: a
    // version that opened whenever the nearest slot was busy walked spawns
    // steadily deeper into the board, which is what an opponent appearing where
    // nothing should be able to deploy actually looks like.
    const s = domState();
    for (const sh of M.shrines.slice(1)) put(s, "leaf_weeds", "P2", sh.row, sh.col);
    const open = M.shrines[0];
    const legal = legalFor(s, "P1");
    expect(legal, "the one free shrine and nothing else")
      .toEqual([{ row: open.row, col: open.col }]);
  });

  it("shuts again as soon as a door frees up", () => {
    const s = domState();
    shutEveryDoor(s);
    expect(legalFor(s, "P1").length).toBeGreaterThan(0);
    // Clear one shrine: the road closes and the ordinary rule returns.
    const sh = M.shrines[2];
    const sitting = cardAt(s, sh.row, sh.col)!;
    delete s.cards[sitting.instanceId];
    expect(legalFor(s, "P1"), "the road stayed open with a door free")
      .toEqual([{ row: sh.row, col: sh.col }]);
  });

  it("a seat holding a Point is never in the lockout at all", () => {
    // Its own ring is eight more doors, so the hatch has no reason to open.
    const s = domState();
    shutEveryDoor(s);
    s.domination!.held.C = "P1";
    for (const sq of legalFor(s, "P1"))
      expect(isRoad(M, sq.row, sq.col) && !poiAt(M, sq.row, sq.col),
        "fell back to the road while holding a Point").toBe(false);
  });
});

describe("a shove is aimed by the shover, not by a home row", () => {
  // pushBack used to walk a body toward its OWN home row. On this map that is
  // not a direction: the objectives sit in four corners, an east-west
  // engagement produced no displacement at all, and a card standing on the row
  // that happened to be its home could not be shoved by anything. It is now the
  // lasso run backwards — away from the pusher, along both axes, a king-step at
  // a time, stepping around a blocked square rather than stopping dead at it.

  it("drives the target directly away from the card that hit it", () => {
    const s = domState();
    const shover = put(s, "leaf_oak", "P1", 3, 2);
    const victim = put(s, "leaf_weeds", "P2", 3, 3);   // due east of the shover
    pushBack(s, s.cards[victim.instanceId], 2, s.cards[shover.instanceId]);
    expect(s.cards[victim.instanceId].pos, "shoved east, away from the shover")
      .toEqual({ row: 3, col: 5 });
  });

  it("shoves on the diagonal when it was hit on the diagonal", () => {
    const s = domState();
    const shover = put(s, "leaf_oak", "P1", 2, 3);
    const victim = put(s, "leaf_weeds", "P2", 3, 4);
    pushBack(s, s.cards[victim.instanceId], 2, s.cards[shover.instanceId]);
    expect(s.cards[victim.instanceId].pos, "out along the line of the blow")
      .toEqual({ row: 5, col: 6 });
  });

  it("bends around a citadel rather than stopping at it", () => {
    // The four citadels sit on the board's main diagonals, so a diagonal shove
    // from the centre runs into one almost immediately. Like the lasso, a push
    // tries the straight line first and then each single axis, so an obstacle
    // costs the diagonal rather than the rest of the push.
    const s = domState();
    const shover = put(s, "leaf_oak", "P1", 2, 2);
    const victim = put(s, "leaf_weeds", "P2", 3, 3);
    pushBack(s, s.cards[victim.instanceId], 2, s.cards[shover.instanceId]);
    // (4,4) on the diagonal, then (5,5) is Point D's citadel — so it slides to
    // (5,4) instead of stopping dead on (4,4).
    expect(s.cards[victim.instanceId].pos, "stopped at the citadel instead of going around")
      .toEqual({ row: 5, col: 4 });
  });

  it("will not shove a card onto a citadel", () => {
    // The centre of a Point is impassable — nothing may STAND there. pushBack
    // only ever checked for a captured slot or another body, so before this a
    // shove could park a card inside a citadel, on a square the movement rules
    // would never have let it walk to and (being impassable) may not be a legal
    // place to stand at all.
    const s = domState();
    const poi = M.pois[0];                       // centre (1,1)
    expect(isImpassable(M, poi.centre.row, poi.centre.col)).toBe(true);
    const shover = put(s, "leaf_oak", "P1", poi.centre.row - 1, poi.centre.col - 1);
    const victim = put(s, "leaf_weeds", "P2", poi.centre.row, poi.centre.col - 1);
    const before = { ...s.cards[victim.instanceId].pos! };
    pushBack(s, s.cards[victim.instanceId], 1, s.cards[shover.instanceId]);
    const after = s.cards[victim.instanceId].pos!;
    expect(isImpassable(M, after.row, after.col), "shoved into the citadel").toBe(false);
    // It is pushed away from the shover on the row axis instead of the blocked
    // diagonal — a body steps AROUND an obstacle rather than being stopped by it.
    expect(after).not.toEqual(before);
  });

  it("a spell push, which has no shover on the board, still moves something", () => {
    // A push with no pushing CARD — a spell, cast by a player from nowhere in
    // particular — has no position to be away from, and keeps the old home-row
    // behaviour rather than silently doing nothing.
    const s = domState();
    const victim = put(s, "leaf_weeds", "P2", 3, 3);
    pushBack(s, s.cards[victim.instanceId], 1, "P1");
    expect(s.cards[victim.instanceId].pos, "a seat-only push still resolves")
      .not.toEqual({ row: 3, col: 3 });
  });
});

describe("corridor Specials can be aimed on the 7×7", () => {
  // Pyrogon's Flame Engulf is the archetype: 3 wide, 2 deep, "the opponents
  // directly ahead". On a board won by crossing it, "ahead" is the only
  // direction worth having. Here the objectives are in four corners.
  const PYRO = "pyro_pyrogon";

  function withPyrogon() {
    const s = domState();
    const p = put(s, PYRO, "P1", 3, 3);          // the Well, dead centre
    s.cards[p.instanceId].summonedThisRound = false;
    s.players.P1.magicPool = 20;
    return { s, id: p.instanceId };
  }

  it("offers victims in every direction, not just one", () => {
    const { s, id } = withPyrogon();
    const north = put(s, "leaf_weeds", "P2", 2, 3);
    const south = put(s, "leaf_weeds", "P2", 4, 3);
    const east = put(s, "leaf_weeds", "P2", 3, 4);
    const west = put(s, "leaf_weeds", "P2", 3, 2);
    const ids = specialTargets(s, id).map((t) => t.instanceId);
    for (const [name, c] of [["north", north], ["south", south], ["east", east], ["west", west]] as const)
      expect(ids, `${name} was unreachable`).toContain(c.instanceId);
  });

  it("fires down ONE corridor — the one the caster pointed at", () => {
    // The guard that matters: offering four directions must not mean hitting
    // all four. That is not a corridor, it is a nova.
    const { s, id } = withPyrogon();
    const east = put(s, "leaf_weeds", "P2", 3, 4);
    const west = put(s, "leaf_weeds", "P2", 3, 2);
    for (const c of [east, west]) {
      s.cards[c.instanceId].curHp = 40; s.cards[c.instanceId].maxHp = 40;
      s.cards[c.instanceId].curShields = 0;
    }
    // Seat the battle on this card so the real intent path can be used: the
    // queue being on Pyrogon is a phase-machine fact, not the thing under test.
    const b = atBattle(s);
    b.battle = { queue: [id], index: 0, awaitingInput: id };
    const out = applyIntent(b, {
      type: "BATTLE_ACTION", player: "P1", action: "special",
      targetIds: [east.instanceId],
    } as never);
    expect(out.cards[east.instanceId].curHp, "the aimed target was missed").toBeLessThan(40);
    expect(out.cards[west.instanceId].curHp, "the blast went both ways").toBe(40);
  });

  it("fires down one corridor even when handed the whole four-way list", () => {
    // What the BOARD actually sent, and the reason this feature did nothing for
    // the player who asked for it. Every corridor Special is printed
    // `targets: 99`, which made the UI classify it as a fixed-area AoE: pressing
    // Confirm passed EVERY victim in all four corridors at once, and the
    // narrowing — which only ran when exactly one target arrived — sat the whole
    // thing out. The aiming worked for the AI and for nobody else, and the human
    // version of the Special was four lanes wide.
    const { s, id } = withPyrogon();
    const east = put(s, "leaf_weeds", "P2", 3, 4);
    const west = put(s, "leaf_weeds", "P2", 3, 2);
    const north = put(s, "leaf_weeds", "P2", 2, 3);
    for (const c of [east, west, north]) {
      s.cards[c.instanceId].curHp = 40; s.cards[c.instanceId].maxHp = 40;
      s.cards[c.instanceId].curShields = 0;
    }
    const b = atBattle(s);
    b.battle = { queue: [id], index: 0, awaitingInput: id };
    // The whole legal list, with the caster's direction at the head — picks[0]
    // aims, and everything after it is noise the engine has to ignore.
    const all = specialTargets(b, id).map((t) => t.instanceId);
    const out = applyIntent(b, {
      type: "BATTLE_ACTION", player: "P1", action: "special",
      targetIds: [east.instanceId, ...all.filter((x) => x !== east.instanceId)],
    } as never);
    expect(out.cards[east.instanceId].curHp, "the aimed target was missed").toBeLessThan(40);
    expect(out.cards[west.instanceId].curHp, "the blast went west as well").toBe(40);
    expect(out.cards[north.instanceId].curHp, "the blast went north as well").toBe(40);
  });

  it("still carries its whole width and depth down that corridor", () => {
    // Aiming must not shrink it: spread 1, depth 2 means a 3-wide, 2-deep block.
    const { s, id } = withPyrogon();
    const near = put(s, "leaf_weeds", "P2", 1, 3);   // 2 north, on the axis
    const wide = put(s, "leaf_weeds", "P2", 2, 4);   // 1 north, 1 across
    for (const c of [near, wide]) {
      s.cards[c.instanceId].curHp = 40; s.cards[c.instanceId].maxHp = 40;
      s.cards[c.instanceId].curShields = 0;
    }
    const b = atBattle(s);
    b.battle = { queue: [id], index: 0, awaitingInput: id };
    const out = applyIntent(b, {
      type: "BATTLE_ACTION", player: "P1", action: "special",
      targetIds: [near.instanceId],
    } as never);
    expect(out.cards[near.instanceId].curHp).toBeLessThan(40);
    expect(out.cards[wide.instanceId].curHp, "the corridor lost its width").toBeLessThan(40);
  });

  it("leaves the standard board pointing forward, exactly as it did", () => {
    // Every other board is won by crossing it, so "ahead" is still the only
    // direction a corridor should have. Nothing here may aim.
    let s: GameState = createInitialState(3, DECK, DECK, ["P1"], undefined, [], 5);
    const p = summonCard(s, "P1", PYRO, { row: 3, col: 2 });
    p.summonedThisRound = false;
    const behind = summonCard(s, "P2", "leaf_weeds", { row: 4, col: 2 }); // BEHIND it
    const ahead = summonCard(s, "P2", "leaf_weeds", { row: 2, col: 2 });
    const ids = specialTargets(s, p.instanceId).map((t) => t.instanceId);
    expect(ids, "aimed backwards on a standard board").not.toContain(behind.instanceId);
    expect(ids).toContain(ahead.instanceId);
  });
});

describe("Cryo's 2×2 falls the way it was thrown", () => {
  // Mega Icicle anchors a 2×2 on the target. It always fell down-and-right,
  // whoever threw it — arbitrary on a board you cross, a real loss here, where
  // the enemy can be in any direction and half the area lands behind the fight
  // (or off the board, when the target is near the far edge).
  const CRYO = "aqua_cryo";

  /** Fire Mega Icicle from `from` at `at`, and report who took damage. */
  function icicle(from: { row: number; col: number }, at: { row: number; col: number },
                  others: { row: number; col: number }[]) {
    const s = domState();
    const c = put(s, CRYO, "P1", from.row, from.col);
    s.cards[c.instanceId].summonedThisRound = false;
    s.players.P1.magicPool = 20;
    const victims = [at, ...others].map((p) => {
      const v = put(s, "leaf_weeds", "P2", p.row, p.col);
      s.cards[v.instanceId].curHp = 40;
      s.cards[v.instanceId].maxHp = 40;
      s.cards[v.instanceId].curShields = 0;
      return v;
    });
    const b = atBattle(s);
    b.battle = { queue: [c.instanceId], index: 0, awaitingInput: c.instanceId };
    const out = applyIntent(b, {
      type: "BATTLE_ACTION", player: "P1", action: "special",
      targetIds: [victims[0].instanceId],
    } as never);
    return victims.map((v) => 40 - out.cards[v.instanceId].curHp);
  }

  it("catches the square BEHIND the target when firing away from itself", () => {
    // Cryo at the centre firing north: the block should take the target and the
    // card beyond it, which the old fixed down-right quadrant never would.
    const [onTarget, beyond] = icicle({ row: 4, col: 3 }, { row: 3, col: 3 }, [{ row: 2, col: 3 }]);
    expect(onTarget, "missed the card it aimed at").toBeGreaterThan(0);
    expect(beyond, "the block fell back toward the caster").toBeGreaterThan(0);
  });

  it("falls the other way when the caster is on the other side", () => {
    // Same geometry mirrored: firing south, the block reaches the card below.
    const [onTarget, beyond] = icicle({ row: 2, col: 3 }, { row: 3, col: 3 }, [{ row: 4, col: 3 }]);
    expect(onTarget).toBeGreaterThan(0);
    expect(beyond, "the block did not follow the throw").toBeGreaterThan(0);
  });

  it("leaves a standard board's fixed quadrant alone", () => {
    // Every other board keeps the down-and-right block it has always thrown;
    // changing it there would be a balance edit nobody asked for.
    let s: GameState = createInitialState(6, DECK, DECK, ["P1"], undefined, [], 5);
    const c = summonCard(s, "P1", CRYO, { row: 4, col: 1 });
    c.summonedThisRound = false;
    s.players.P1.magicPool = 20;
    const at = summonCard(s, "P2", "leaf_weeds", { row: 2, col: 1 });
    const below = summonCard(s, "P2", "leaf_weeds", { row: 3, col: 1 }); // down-right of it
    for (const v of [at, below]) { v.curHp = 40; v.maxHp = 40; v.curShields = 0; }
    const b = atBattle(s);
    b.battle = { queue: [c.instanceId], index: 0, awaitingInput: c.instanceId };
    const out = applyIntent(b, {
      type: "BATTLE_ACTION", player: "P1", action: "special",
      targetIds: [at.instanceId],
    } as never);
    expect(40 - out.cards[at.instanceId].curHp).toBeGreaterThan(0);
    expect(40 - out.cards[below.instanceId].curHp, "the fixed quadrant changed").toBeGreaterThan(0);
  });
});

describe("the AI seats do not all go for the same square", () => {
  it("sends each seat in through its own shrine", () => {
    // One brain plays every AI seat, so without a per-seat preference they
    // shared one: the shrines all tie on distance to a wanted Point, every tie
    // fell to the map's declaration order, and the whole table queued at the
    // same door while three stood empty.
    const s = domState();
    s.humans = [];
    s.seats = ["P1", "P2", "P3", "P4"];
    for (const seat of s.seats) {
      s.players[seat].gold = 30;
      if (s.players[seat].hand.length === 0)
        s.players[seat].hand = [{ handId: `h-${seat}`, defId: "leaf_weeds" }];
    }
    const doors = new Set<string>();
    for (const seat of s.seats) {
      s.prep = { priority: seat, consecutivePasses: 0, movedThisTurn: false };
      const it = aiPrepIntent(s, seat);
      expect(it.type, `${seat} did not deploy`).toBe("SUMMON");
      if (it.type === "SUMMON") doors.add(`${it.row},${it.col}`);
    }
    expect(doors.size, `all four seats entered at ${[...doors]}`).toBe(4);
  });

  it("gives each seat a different Point to want first", () => {
    const s = domState();
    s.seats = ["P1", "P2", "P3", "P4"];
    const firsts = s.seats.map((seat) => {
      // The first Point in its wanted order, read through the goal squares the
      // mover actually uses.
      const goals = pointGoals(s, seat);
      const poi = goals.length ? poiAt(M, goals[0].row, goals[0].col) : undefined;
      return poi?.id;
    });
    expect(new Set(firsts).size, `seats want ${firsts.join(",")}`).toBe(4);
  });
});

// SPAWNED BODIES OBEY THE MAP.
//
// `spawnTokens` placed tokens by occupancy alone — it never asked whether a
// square could be stood on. On the 7x7 that put them straight into a Point's
// CITADEL: measured, 16 of 16 attempts with a spawner beside one. Those four
// squares are what `slotIsImpassable` exists to protect, so a body there could
// not be reached, moved, or shifted by anything that respects the terrain — a
// permanent squatter on the objective.
//
// The same rule was wrong in the other direction too. Its Home-row ban means
// nothing on a map with no Home row, and it barred a DIFFERENT row for each
// seat (row 6 for P2, row 0 for P1) — six Point-ring slots and a shrine of
// perfectly ordinary contested ground, refused asymmetrically.
describe("spawns respect the terrain", () => {
  const impassables = (s: GameState): Pos[] => {
    const out: Pos[] = [];
    for (let r = 0; r < s.boardSize; r++)
      for (let c = 0; c < s.boardSize; c++)
        if (isImpassable(M, r, c)) out.push({ row: r, col: c } as Pos);
    return out;
  };

  it("never drops a token on a citadel, however crowded the ring", () => {
    const s = domState();
    const dead = impassables(s);
    expect(dead.length, "the map has no impassable squares to test").toBeGreaterThan(0);
    for (const d of dead) {
      const s2 = domState();
      // Stand the spawner right beside it and ask for more tokens than the
      // neighbourhood can hold, so the search is forced to widen.
      const spot = { row: d.row, col: d.col + 1 } as Pos;
      if (isImpassable(M, spot.row, spot.col)) continue;
      const sp = put(s2, "bolt_zipp", "P2", spot.row, spot.col);
      for (const t of spawnTokens(s2, sp, "bolt_drone_tok", 8))
        expect(t.pos && isImpassable(M, t.pos.row, t.pos.col), `landed on ${t.pos?.row},${t.pos?.col}`)
          .toBe(false);
    }
  });

  it("...and DOES use the row the Home-row ban used to refuse", () => {
    // Row 6 is P1's home row on a 4x4/5x5 and means nothing here; on this map it
    // carries Point-ring slots and a shrine.
    const s = domState();
    const row = s.boardSize - 1;
    const sp = put(s, "bolt_zipp", "P2", row - 1, 3);
    const out = spawnTokens(s, sp, "bolt_drone_tok", 6);
    expect(out.length, "nothing spawned at all").toBeGreaterThan(0);
    expect(out.some((t) => t.pos?.row === row), "the phantom Home-row ban is still on")
      .toBe(true);
  });
});

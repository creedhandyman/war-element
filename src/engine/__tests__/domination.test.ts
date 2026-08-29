// DOMINATION — the 7×7 objective map.
//
// The mode's whole claim is that the BOARD is the win condition, so these test
// the four things that claim rests on: the map is a clean partition, nothing
// stands where nothing should, the roads are actually faster, and control is
// sticky enough that holding a Point means something.

import { describe, expect, it } from "vitest";
import {
  DOMINATION_7X7, DOMINATION_HOLD_ROUNDS, DOMINATION_MAJORITY, dominationMap,
  heldCount, isImpassable, isRoad, isShrine, newDomination, POI_GOLD, POI_MAGIC, poiAt, poiRing,
  resolveHolders, runsAlongRoad,
} from "../../data/domination";
import { advance, applyIntent, canMove, canSummon, createInitialState, legalMoves } from "../index";
import { homeSlots, summonLandingRow } from "../rules";
import { summonCard } from "../state";
import { deckLimits } from "../../data/custom-decks";
import type { GameState, PlayerId } from "../types";

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
    expect(dead.sort()).toEqual(["1,1", "1,5", "3,3", "5,1", "5,5"].sort());
  });

  it("gives a 7×7 board a real deck size instead of the 4×4 default", () => {
    // Without an entry, deckLimits(7) silently falls back to the standard board
    // — eighteen cards spread over forty-nine slots.
    expect(deckLimits(7).target).toBe(30);
    expect(deckLimits(7).target).not.toBe(deckLimits(4).target);
  });
});

describe("nothing stands on a closed slot", () => {
  it("refuses a move onto a citadel or the crossroads", () => {
    const s = domState();
    const c = put(s, "leaf_weeds", "P1", 3, 2);         // on the road, beside the centre
    expect(canMove(s, "P1", c.instanceId, { row: 3, col: 3 }).ok, "walked into the crossroads").toBe(false);
    expect(canMove(s, "P1", c.instanceId, { row: 3, col: 3 }).reason).toMatch(/stand/i);
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
    // Weeds is a slow card: reach 1 normally.
    const c = put(s, "leaf_weeds", "P1", 3, 0);   // the west shrine, on row D
    expect(runsAlongRoad(M, { row: 3, col: 0 }, { row: 3, col: 2 })).toBe(true);
    expect(canMove(s, "P1", c.instanceId, { row: 3, col: 2 }).ok, "two slots down the lane").toBe(true);
    // The same distance OFF the road is refused — this is the road doing it,
    // not the card simply being fast.
    expect(runsAlongRoad(M, { row: 3, col: 0 }, { row: 1, col: 0 })).toBe(false);
    expect(canMove(s, "P1", c.instanceId, { row: 1, col: 0 }).ok, "two slots into a Point").toBe(false);
  });

  it("will not carry a run THROUGH the closed crossroads", () => {
    // The junction is shut, so the two lanes never join: a run down row D stops
    // at the middle rather than continuing out the far side.
    expect(runsAlongRoad(M, { row: 3, col: 2 }, { row: 3, col: 4 })).toBe(false);
    expect(runsAlongRoad(M, { row: 2, col: 3 }, { row: 4, col: 3 })).toBe(false);
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
  it("adds +2 gold and +1 magic per held Point, on top of the ordinary flow", () => {
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
    expect(b.magic - a.magic, "two Points should pay 2 x POI_MAGIC").toBe(2 * POI_MAGIC);
    expect(POI_GOLD).toBe(2);
    expect(POI_MAGIC).toBe(1);
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

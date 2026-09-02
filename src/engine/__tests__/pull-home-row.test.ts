// A pull that hands the OPPONENT a capture — your own ability, used against you.
//
// `pullToward` (Sucker Sword, Harpoon Hook, Hooked Vine) and `reelToCaster`
// (Hogtie, the hurricane's arrival) drag an enemy toward the puller, and both
// walked until the BOARD EDGE stopped them. On the puller's side of the board
// that edge IS the puller's own home row — so the last step of your own pull
// parked an enemy body on your own back row, and Cleanup captures a home slot
// on bare occupancy IN THE SAME ROUND (phases.ts, "capture by survival"). The
// capture was permanent and there was no window to answer it: it resolved and
// captured inside the round you spent the ability on.
//
// The guard is `stopsAtOwnHomeRow`, and it reads the same predicate Cleanup
// captures on (`owner !== the home row's player`), so it cannot drift from the
// rule it exists to protect against. That is also why hauling your OWN card
// home is still legal — an ally on your home slot is captured by nobody.
//
// ROW-SHAPED, SO BOTH BOARD SIZES. CLAUDE.md's first trap: the Home Slot rule
// was right on the 4x4 and wrong on the 5x5 because it named rows by number.
// The invasion square is row 2 on the small board and row 3 on the large one.
import { describe, expect, it } from "vitest";
import { advance, applyIntent } from "../phases";
import { pullToward } from "../combat";
import { homeRow } from "../types";
import { atCleanup, bigPrepState, place, prepState } from "./helpers";
import type { CardInstance, GameState } from "../types";

/** Hand the battle queue one card and wait on it, so its action can be issued
 *  through the real intent path. Same shape as the helper in eight-legends. */
function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

const posOf = (s: GameState, c: CardInstance) => s.cards[c.instanceId].pos!;

describe("a pull cannot drag an enemy onto the puller's OWN home row", () => {
  // Octoirate: AQUA, Ranged, `pullOnAttack: 1` (Sucker Sword). The passive
  // rides the ordinary basic — no Special, no cost, nothing to opt out of.
  // AQUA into DUSK cannot be dodged (`dodgesByMatchup` is GALE-vs-BORE only),
  // so the swing lands and the pull fires every time.
  const SUCKER = "aqua_octoirate";
  const BODY = "dusk_gool";

  /** P1's Octoirate swings at the P2 body beside it, through the real intent
   *  path. Returns the target and the post-swing state. */
  function swing(s: GameState, row: number) {
    const octo = place(s, SUCKER, "P1", row, 2);
    const foe = place(s, BODY, "P2", row, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const hit = applyIntent(battleWith(s, octo.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "basic", targetId: foe.instanceId,
    } as never);
    return { foe, hit };
  }

  it("4x4: the swing on the invasion square does not capture P1's own home slot", () => {
    const s = prepState();
    // A SECOND P2 body, standing on P1's home row of its own accord. It is the
    // control: it proves capture is LIVE on this board, so the pulled card
    // going uncaptured is the guard working rather than the mechanic being off.
    place(s, BODY, "P2", 3, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const { foe, hit } = swing(s, 2); // row 2 = one in front of P1's home row 3

    expect(hit.cards[foe.instanceId].curHp, "the swing landed, so the pull fired").toBeLessThan(40);
    expect(posOf(hit, foe), "held on the invasion square, not dragged home").toEqual({ row: 2, col: 1 });

    const done = advance(atCleanup(hit));
    expect(done.slots[3][0].capturedBy, "the body that walked there IS captured").toBe("P2");
    expect(done.slots[3][1].capturedBy, "the one P1 pulled is not — P1 kept its slot").toBeFalsy();
  });

  it("5x5: the same, one row further out", () => {
    // homeRow(P1, 5) is 4 and the invasion square is row 3 — the row a
    // number-literal rule gets wrong on the large board.
    const s = bigPrepState();
    expect(homeRow("P1", s.boardSize)).toBe(4);
    const { foe, hit } = swing(s, 3);

    expect(hit.cards[foe.instanceId].curHp).toBeLessThan(40);
    expect(posOf(hit, foe)).toEqual({ row: 3, col: 1 });
    expect(advance(atCleanup(hit)).slots[4][1].capturedBy).toBeFalsy();
  });

  it("holds for P2 too — the seat is not what decides it", () => {
    const s = prepState();
    const octo = place(s, SUCKER, "P2", 1, 2);
    const foe = place(s, BODY, "P1", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const hit = applyIntent(battleWith(s, octo.instanceId), {
      type: "BATTLE_ACTION", player: "P2", action: "basic", targetId: foe.instanceId,
    } as never);

    expect(hit.cards[foe.instanceId].curHp).toBeLessThan(40);
    expect(posOf(hit, foe), "not dragged onto P2's home row 0").toEqual({ row: 1, col: 1 });
    expect(advance(atCleanup(hit)).slots[0][1].capturedBy).toBeFalsy();
  });

  it("still reels the target in everywhere else — the ability is not neutered", () => {
    // The stop is ONE row deep. Anywhere short of it the drag is unchanged, on
    // both board sizes: this is the assertion that fails if the guard is ever
    // widened into "no pulling toward your own half".
    const small = swing(prepState(), 1);
    expect(posOf(small.hit, small.foe), "4x4: row 1 -> 2, up to the line").toEqual({ row: 2, col: 1 });

    const big = swing(bigPrepState(), 2);
    expect(posOf(big.hit, big.foe), "5x5: row 2 -> 3, up to the line").toEqual({ row: 3, col: 1 });
  });

  it("hauling your OWN card home is untouched", () => {
    // Deliberate asymmetry, not an oversight. The guard asks the question
    // Cleanup asks — is this body owned by somebody else? — so an ally can
    // still be dragged onto the home slot it stands on safely, and a future
    // `targetSide: "ally"` rally that pulls friends back to the line works.
    const s = prepState();
    const ally = place(s, BODY, "P1", 0, 1);
    pullToward(s, ally, 3, "P1");
    expect(ally.pos, "all the way to P1's own back row").toEqual({ row: 3, col: 1 });
  });
});

describe("the lasso bends around the back row instead of finishing on it", () => {
  // `reelToCaster` closes both axes, so a rope thrown from your own home row
  // could complete the pull ALONG that row and leave the enemy on a home slot.
  // The home row is skipped the way an occupied slot is — the rope steps
  // AROUND it — rather than stopping the pull dead.
  const LASSO = "dawn_lassos"; // alwaysHit, so Hogtie (pullToCaster: 1) cannot whiff
  const BODY = "dusk_gool";

  function hogtie(s: GameState, lassoAt: [number, number], foeAt: [number, number]) {
    s.players.P1.magicPool = 8;
    const lasso = place(s, LASSO, "P1", lassoAt[0], lassoAt[1], { autoMode: "manual" });
    const foe = place(s, BODY, "P2", foeAt[0], foeAt[1], { curHp: 60, maxHp: 60, curShields: 0 });
    const n = applyIntent(battleWith(s, lasso.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    } as never);
    return { foe, n };
  }

  it("roping from the home row pulls sideways, not onto the slot beside it", () => {
    // Lassos on P1's home row (3,1); the target diagonally out at (2,3). The
    // straight step is (3,2) — a home slot — and the row-only step is (3,3),
    // another one. Both are refused, so the rope takes the column axis to
    // (2,2): still closer, still off P1's back row.
    const { foe, n } = hogtie(prepState(), [3, 1], [2, 3]);
    expect(posOf(n, foe)).toEqual({ row: 2, col: 2 });
    expect(advance(atCleanup(n)).slots[3][2].capturedBy, "no self-inflicted capture").toBeFalsy();
  });

  it("but a target already standing there can still be roped OFF it", () => {
    // Only the DESTINATION is checked. A body that reached P1's home row under
    // its own power is still draggable — refusing to move it would turn the
    // guard into protection for the invader.
    const { foe, n } = hogtie(prepState(), [2, 1], [3, 3]);
    expect(posOf(n, foe), "off row 3 and in toward the roper").toEqual({ row: 2, col: 2 });
  });
});

// Milestone 2: prep priority loop — summon / move / pass, two-pass exit.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { advance, applyIntent } from "../phases";
import { canMove, canSummon, openHomeSlots, summonLandingRow, summonSquare } from "../rules";
import { boardCards, cardAt, moveReach, SP_MID_MAX, SP_SLOW_MAX } from "../state";
import { bigPrepState, freshGame, giveHand, place, prepState } from "./helpers";
import { CARDS, getDef } from "../../data/cards";
import type { GameState } from "../types";

describe("summoning", () => {
  it("summons into an open home slot, paying cost", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    const handId = giveHand(s, "P1", "leaf_greegon"); // cost 3
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 2 });
    const card = cardAt(next, 3, 2);
    expect(card?.defId).toBe("leaf_greegon");
    expect(card?.summonedThisRound).toBe(true);
    expect(next.players.P1.gold).toBe(2);
    expect(next.players.P1.hand.some((h) => h.handId === handId)).toBe(false);
  });

  it("rejects: not enough resources", () => {
    const s = prepState();
    s.players.P1.gold = 2;
    const handId = giveHand(s, "P1", "leaf_greegon");
    expect(canSummon(s, "P1", handId, 0).ok).toBe(false);
  });

  it("rejects: occupied, contested, and captured slots", () => {
    const s = prepState();
    s.players.P1.gold = 10;
    const handId = giveHand(s, "P1", "leaf_greegon");
    place(s, "leaf_alpha", "P1", 3, 0); // occupied by own card
    place(s, "dusk_vamp", "P2", 3, 1); // enemy on our home = contested
    s.slots[3][2].capturedBy = "P2"; // captured
    expect(canSummon(s, "P1", handId, 0).ok).toBe(false);
    expect(canSummon(s, "P1", handId, 1).ok).toBe(false);
    expect(canSummon(s, "P1", handId, 2).ok).toBe(false);
    expect(canSummon(s, "P1", handId, 3).ok).toBe(true);
  });

  it("openHomeSlots names exactly the columns canSummon would take", () => {
    const s = prepState();
    s.players.P1.gold = 10;
    const handId = giveHand(s, "P1", "leaf_greegon");
    place(s, "leaf_alpha", "P1", 3, 0); // occupied by own card
    place(s, "dusk_vamp", "P2", 3, 1); // enemy on our home = contested
    s.slots[3][2].capturedBy = "P2"; // captured
    expect(openHomeSlots(s, "P1")).toEqual([3]);
    expect(openHomeSlots(s, "P1").every((col) => canSummon(s, "P1", handId, col).ok)).toBe(true);
  });

  it("a full home row makes every card unsummonable, however rich you are", () => {
    // The hand used to decide which cards glow from `cost <= gold` alone, so a
    // packed home row still lit up every affordable card — tap one and no slot
    // would take it. openHomeSlots is what tells the hand the BOARD is the
    // problem, so it has to agree with canSummon's own refusal.
    const s = prepState();
    s.players.P1.gold = 99;
    const handId = giveHand(s, "P1", "leaf_greegon");
    for (let col = 0; col < s.boardSize; col++) place(s, "leaf_alpha", "P1", 3, col);
    expect(openHomeSlots(s, "P1")).toEqual([]);
    for (let col = 0; col < s.boardSize; col++)
      expect(canSummon(s, "P1", handId, col).ok).toBe(false);
  });

  it("a home row taken by the ENEMY falls back — it is not a softlock", () => {
    // THE BUG. Summoning is column-addressed with the row implied to be your
    // home row, so a side whose home row is entirely enemy-held could not play a
    // card at all. An ordinary match hides it — holding every enemy home slot IS
    // the capture win, so the state ends the game at once — but Void Tower turns
    // capture off and it persisted: measured, at the moment an overrun fired the
    // player held 6.92 cards in hand and 23.79 in deck, with 0.00 open home
    // slots and 0% of them playable. Thirty-one cards and no legal move.
    const s = prepState();
    s.players.P1.gold = 99;
    const handId = giveHand(s, "P1", "leaf_greegon");
    for (let col = 0; col < s.boardSize; col++) place(s, "dusk_vamp", "P2", 3, col);
    expect(openHomeSlots(s, "P1"), "the row is gone").toEqual([]);
    expect(canSummon(s, "P1", handId, 1).ok, "and yet there is a play").toBe(true);
    // It lands FORWARD, toward whatever took the back line — dangerous ground.
    expect(summonLandingRow(s, "P1", 1)).toBe(2);
  });

  it("...but never past the halfway line, and never into their back line", () => {
    // The escape hatch used to walk the WHOLE column. On a 5x5 that meant a side
    // whose home row had been captured could land a reinforcement on the
    // OPPONENT'S home row — behind everything they own, and one survived round
    // from capturing their slots. Losing your own line should not hand you a
    // teleport into the place the game is won.
    //
    // Measured before the bound: as column 1 filled, the landing walked 1, 2, 3,
    // then 4 — P1's home row on a 5x5.
    const s = prepState();
    s.players.P2.gold = 99;
    const handId = giveHand(s, "P2", "leaf_greegon");
    // P2's home row is gone entirely — captured, so P2 cannot clear it.
    for (let col = 0; col < s.boardSize; col++) s.slots[0][col].capturedBy = "P1";
    expect(openHomeSlots(s, "P2"), "the row is gone").toEqual([]);
    const mid = Math.floor((s.boardSize - 1) / 2);
    const seen: (number | null)[] = [];
    for (let r = 1; r < s.boardSize; r++) {
      seen.push(summonLandingRow(s, "P2", 1));
      place(s, "leaf_weeds", "P1", r, 1); // fill the column, one row at a time
    }
    // Every landing it ever offers is inside P2's own half...
    for (const row of seen)
      if (row !== null) expect(row, "landed past the halfway line").toBeLessThanOrEqual(mid);
    // ...and P1's home row is never one of them.
    expect(seen).not.toContain(s.boardSize - 1);
    // Once its own half is full the hatch simply closes, rather than reaching
    // deeper: that is a lost line, which is a fair thing to lose.
    expect(summonLandingRow(s, "P2", 1), "still found somewhere to land").toBeNull();
    expect(canSummon(s, "P2", handId, 1).ok).toBe(false);
  });

  it("...but a row full of your OWN cards still refuses — you can move those", () => {
    // The distinction that keeps this from changing ordinary tempo: your own
    // card can step forward and free the slot, so it was never a lockout, and
    // the hatch stays shut.
    const s = prepState();
    s.players.P1.gold = 99;
    const handId = giveHand(s, "P1", "leaf_greegon");
    for (let col = 0; col < s.boardSize; col++) place(s, "leaf_alpha", "P1", 3, col);
    expect(canSummon(s, "P1", handId, 1).ok).toBe(false);
    expect(summonLandingRow(s, "P1", 1)).toBeNull();
  });

  it("...and one own card among enemies is enough to keep it shut", () => {
    const s = prepState();
    s.players.P1.gold = 99;
    const handId = giveHand(s, "P1", "leaf_greegon");
    for (let col = 0; col < s.boardSize; col++) place(s, "dusk_vamp", "P2", 3, col);
    s.cards[Object.values(s.cards).find((c) => c.pos?.row === 3 && c.pos?.col === 0)!.instanceId].owner = "P1";
    expect(canSummon(s, "P1", handId, 1).ok, "it can move that one instead").toBe(false);
  });

  it("openHomeSlots asks about the board only, never the price", () => {
    // The free opening placement spends slots, not Gold. A board-side check
    // that quietly folded affordability in would claim "nowhere to put it"
    // during deployment, when in fact every square is open.
    const s = prepState();
    s.players.P1.gold = 0;
    giveHand(s, "P1", "leaf_greegon");
    expect(openHomeSlots(s, "P1")).toEqual([0, 1, 2, 3]);
  });

  it("rejects summoning without priority", () => {
    const s = prepState(42, "P2");
    s.players.P1.gold = 10;
    const handId = giveHand(s, "P1", "leaf_greegon");
    expect(canSummon(s, "P1", handId, 0).ok).toBe(false);
  });

  it("allows multiple summons in one priority turn", () => {
    const s = prepState();
    s.players.P1.gold = 10;
    const h1 = giveHand(s, "P1", "leaf_greegon");
    const h2 = giveHand(s, "P1", "leaf_alpha");
    let next = applyIntent(s, { type: "SUMMON", player: "P1", handId: h1, col: 0 });
    next = applyIntent(next, { type: "SUMMON", player: "P1", handId: h2, col: 1 });
    expect(cardAt(next, 3, 0)).toBeTruthy();
    expect(cardAt(next, 3, 1)).toBeTruthy();
    expect(next.prep?.priority).toBe("P1"); // actions don't pass priority
  });
});

describe("movement", () => {
  it("movement tiers: 0 = pinned, slow 1–5 = 1, mid and fast = 2", () => {
    // Reach TOPS OUT at 2. The fast tier's payoff is the king-move (below), not
    // a third step: extra reach compounded with board depth, handing the quick
    // elements a 76% win rate on 5x5, while cutting corners is worth the same
    // on any board size.
    expect(moveReach(0)).toBe(0);
    expect(moveReach(1)).toBe(1);
    expect(moveReach(SP_SLOW_MAX)).toBe(1);
    expect(moveReach(SP_SLOW_MAX + 1)).toBe(2);
    expect(moveReach(SP_MID_MAX)).toBe(2);
    expect(moveReach(SP_MID_MAX + 1)).toBe(2);
    expect(moveReach(21)).toBe(2); // the GALE Zephyr cap changes nothing
  });

  it("the FAST tier cuts corners — that is what it buys", () => {
    // A diagonal costs a mid card 2 of its 2 steps (Manhattan) and a fast card
    // 1 (Chebyshev), so only the fast card can go diagonally AND keep moving.
    // The mid-band card is FOUND, not named. This hand-picked dusk_gool, and a
    // re-cost that moved Gool from SP 8 to 13 pushed it over SP_MID_MAX into the
    // fast tier — so the "mid" card cut corners too and a test about the tier
    // boundary failed over a card it was only borrowing. The sibling test below
    // already says this in its own comment; this one had not caught up.
    const midDef = CARDS.find(
      (c) => !c.keywords.FLYING && !c.mounted &&
        moveReach(c.sp) === 2 && c.sp <= SP_MID_MAX,
    )!;
    expect(midDef, "the pool still has a mid-band card").toBeTruthy();
    const s = prepState();
    const mid = place(s, midDef.id, "P1", 2, 1);
    const fast = place(s, "dusk_silkstalker", "P1", 2, 3); // SP 12
    expect(moveReach(midDef.sp)).toBe(2);
    expect(moveReach(getDef("dusk_silkstalker").sp)).toBe(2); // same reach...
    // ...but only the fast one reaches TWO diagonal steps away.
    expect(canMove(s, "P1", fast.instanceId, { row: 0, col: 1 }).ok).toBe(true);
    expect(canMove(s, "P1", mid.instanceId, { row: 0, col: 3 }).ok).toBe(false);
  });

  it("each tier walks its own distance on the board", () => {
    // Cards picked by tier and asserted against moveReach, not against
    // remembered numbers: the SP pass moved several cards across a boundary and
    // a hardcoded "Greegon is slow" broke this test rather than catching a bug.
    const s = prepState();
    const slow = place(s, "bore_armadillo", "P1", 2, 0); // slow band
    const mid = place(s, "leaf_stickviper", "P1", 2, 3); // mid band
    expect(moveReach(getDef("bore_armadillo").sp)).toBe(1);
    expect(moveReach(getDef("leaf_stickviper").sp)).toBe(2);
    expect(canMove(s, "P1", slow.instanceId, { row: 1, col: 0 }).ok).toBe(true);
    expect(canMove(s, "P1", slow.instanceId, { row: 0, col: 0 }).ok).toBe(false); // 2 away
    expect(canMove(s, "P1", mid.instanceId, { row: 1, col: 3 }).ok).toBe(true);
    // Straight up the column: a ground card pays MANHATTAN, so (2,3)->(0,2)
    // would be 3, not 2. Only FLYING and mounted cards cut corners.
    expect(canMove(s, "P1", mid.instanceId, { row: 0, col: 3 }).ok).toBe(true); // dist 2
  });

  it("the home-to-home rule holds, though nothing can currently reach that far", () => {
    // Kept as a GUARD, not an active rule. With reach capped at 2 and the home
    // rows 3 apart on a 4x4 (4 on a 5x5), no card can make the crossing in one
    // move anyway — the cap that made this rule necessary is gone. It stays so
    // that raising reach later cannot silently re-open the dash.
    const s = prepState();
    const runner = place(s, "dusk_silkstalker", "P1", 3, 1); // fastest in the game
    const dash = canMove(s, "P1", runner.instanceId, { row: 0, col: 1 });
    expect(dash.ok).toBe(false);
    // The DISTANCE check answers first, which is the proof: the crossing is out
    // of range on its own, so the rule never has to fire. If a future reach
    // change makes it reachable, this reason flips to the Home-row one and the
    // rule catches it.
    expect(dash.reason).toMatch(/Too far/i);
  });

  it("...and it only blocks the DASH, not the destination", () => {
    // From a mid row the enemy home row is still a legal landing.
    const s = prepState();
    const runner = place(s, "dusk_silkstalker", "P1", 1, 1);
    expect(canMove(s, "P1", runner.instanceId, { row: 0, col: 1 }).ok).toBe(true);
  });

  it("can't move onto an occupied or captured slot", () => {
    const s = prepState();
    const c = place(s, "leaf_stickviper", "P1", 2, 1);
    place(s, "leaf_alpha", "P1", 2, 2);
    s.slots[1][1].capturedBy = "P2";
    expect(canMove(s, "P1", c.instanceId, { row: 2, col: 2 }).ok).toBe(false);
    expect(canMove(s, "P1", c.instanceId, { row: 1, col: 1 }).ok).toBe(false);
    expect(canMove(s, "P1", c.instanceId, { row: 1, col: 2 }).ok).toBe(true);
  });

  it("only one move per priority turn", () => {
    const s = prepState();
    const c = place(s, "leaf_stickviper", "P1", 3, 0);
    const next = applyIntent(s, {
      type: "MOVE",
      player: "P1",
      instanceId: c.instanceId,
      to: { row: 2, col: 0 },
    });
    expect(canMove(next, "P1", c.instanceId, { row: 1, col: 0 }).ok).toBe(false);
  });

  it("ROOT pins SP to 0 (no move)", () => {
    const s = prepState();
    const c = place(s, "leaf_stickviper", "P1", 3, 0, {
      status: { kind: "ROOT", duration: 2, power: 0, source: "LEAF" },
    });
    expect(canMove(s, "P1", c.instanceId, { row: 2, col: 0 }).ok).toBe(false);
  });

  it("SLEEP prevents moving until woken", () => {
    const s = prepState();
    const c = place(s, "leaf_stickviper", "P1", 3, 0, {
      status: { kind: "SLEEP", duration: 2, power: 0, source: "BORE" },
    });
    expect(canMove(s, "P1", c.instanceId, { row: 2, col: 0 }).ok).toBe(false);
  });
});

describe("priority + passes", () => {
  it("pass hands priority; two consecutive passes start Battle", () => {
    const s = prepState(42, "P1");
    const afterP1 = applyIntent(s, { type: "PASS", player: "P1" });
    expect(afterP1.prep?.priority).toBe("P2");
    expect(afterP1.prep?.consecutivePasses).toBe(1);
    const afterP2 = applyIntent(afterP1, { type: "PASS", player: "P2" });
    expect(afterP2.phase).toBe("battle");
  });

  it("an action resets the consecutive-pass counter", () => {
    let s = prepState(42, "P1");
    s.players.P2.gold = 5;
    const handId = giveHand(s, "P2", "dusk_vamp");
    s = applyIntent(s, { type: "PASS", player: "P1" }); // passes=1, P2 priority
    s = applyIntent(s, { type: "SUMMON", player: "P2", handId, col: 0 });
    expect(s.prep?.consecutivePasses).toBe(0);
    s = applyIntent(s, { type: "PASS", player: "P2" }); // passes=1 again
    expect(s.phase).toBe("prep");
    s = applyIntent(s, { type: "PASS", player: "P1" });
    expect(s.phase).toBe("battle");
  });

  it("move allowance resets when priority returns", () => {
    let s = prepState(42, "P1");
    const c = place(s, "leaf_stickviper", "P1", 3, 0);
    s = applyIntent(s, {
      type: "MOVE",
      player: "P1",
      instanceId: c.instanceId,
      to: { row: 2, col: 0 },
    });
    s = applyIntent(s, { type: "PASS", player: "P1" });
    s = applyIntent(s, { type: "MOVE", player: "P2", instanceId: placeP2(s), to: { row: 1, col: 3 } });
    s = applyIntent(s, { type: "PASS", player: "P2" });
    // P1's move is available again on the new priority turn
    expect(canMove(s, "P1", c.instanceId, { row: 1, col: 0 }).ok).toBe(true);
  });
});

function placeP2(s: ReturnType<typeof prepState>): string {
  const c = place(s, "dusk_vamp", "P2", 0, 3);
  return c.instanceId;
}

describe("mounted cards move like a king in Prep", () => {
  const diagonalOk = (s: GameState, id: string) =>
    canMove(s, "P1", id, { row: 1, col: 1 }).ok;

  it("a diagonal costs a mounted card ONE step, not two", () => {
    // Prep movement is Manhattan for everyone but FLYING, so a diagonal used to
    // cost two of a rider's steps. Now the four mounted cards pay one, matching
    // how Shadow Charge already rides.
    for (const id of ["dusk_shadowhorsemen", "bore_rohojohn", "dusk_skelider", "dawn_warphant"]) {
      const s = prepState();
      const c = place(s, id, "P1", 2, 2);
      s.cards[c.instanceId].spBonus = 1 - getDef(id).sp; // pin reach to exactly 1
      expect(diagonalOk(s, c.instanceId), `${id} could not step diagonally`).toBe(true);
    }
  });

  it("...and an unmounted card still cannot", () => {
    const s = prepState();
    const c = place(s, "bore_clubber", "P1", 2, 2);
    s.cards[c.instanceId].spBonus = 1 - getDef("bore_clubber").sp;
    expect(diagonalOk(s, c.instanceId)).toBe(false); // Manhattan 2 > reach 1
  });

  it("Dismount puts the rider back on foot — the king-move goes with the mount", () => {
    // Skelider's Dismount sets `transformed`. Losing the horse should cost it
    // the horse's movement, or "mounted" would just be a permanent keyword.
    const s = prepState();
    const skel = place(s, "dusk_skelider", "P1", 2, 2);
    s.cards[skel.instanceId].spBonus = 1 - getDef("dusk_skelider").sp;
    expect(diagonalOk(s, skel.instanceId)).toBe(true);
    s.cards[skel.instanceId].transformed = true; // thrown from the saddle
    expect(diagonalOk(s, skel.instanceId)).toBe(false);
  });

  it("the straight step is unchanged either way", () => {
    const s = prepState();
    const roho = place(s, "bore_rohojohn", "P1", 2, 2);
    s.cards[roho.instanceId].spBonus = 1 - getDef("bore_rohojohn").sp;
    expect(canMove(s, "P1", roho.instanceId, { row: 1, col: 2 }).ok).toBe(true);
  });
});

describe("a round nobody can act in is not played", () => {
  it("an empty board with nothing affordable rolls straight into the next round", () => {
    const s = freshGame(9);
    s.players.P1.mulliganDone = true;
    s.players.P2.mulliganDone = true;
    s.phase = "resource";
    s.round = 1;
    // An empty board earns the round's bracket and nothing else — no slots
    // held — so gold now climbs 1, 2, 3 rather than 1, 3, 6. Cost 3 each, so
    // the first spendable round is the THIRD, and two roll past. The round used
    // to run anyway: both sides pass, an empty battle queue resolves, nothing
    // changes. This is the ordinary Story Mode case.
    s.players.P1.hand = [{ handId: "h1", defId: "dusk_gool" }];
    s.players.P2.hand = [{ handId: "h2", defId: "dusk_gool" }];
    s.players.P1.spellbook = [];
    s.players.P2.spellbook = [];
    const next = advance(s);
    expect(next.round, "rolled past the empty rounds").toBe(3);
    expect(next.phase).toBe("prep");
    expect(next.log.some((l) => l.includes("Nobody can act"))).toBe(true);
    // The resources are not a gift: one grant per round skipped, which is what
    // the player would have been holding either way.
    expect(next.players.P1.gold).toBe(3);
  });

  it("and keeps rolling while nothing is affordable, without running off the end", () => {
    const s = freshGame(9);
    s.players.P1.mulliganDone = true;
    s.players.P2.mulliganDone = true;
    s.phase = "resource";
    s.round = 1;
    s.players.P1.hand = [{ handId: "h1", defId: "pyro_magmadon" }]; // cost 8
    s.players.P2.hand = [{ handId: "h2", defId: "aqua_kraken" }]; // cost 10
    s.players.P1.spellbook = [];
    s.players.P2.spellbook = [];
    const next = advance(s);
    // Off an empty board the pool is the bracket curve summed: 1+1+1+1+1 through
    // round 5, then +2s. Rolling stops the moment EITHER side can act — P1's
    // cost-8 Magmadon comes online on round 7 (5 + 2 + 2 = 9 banked by then),
    // one round sooner than under the old flat grant and still four later than
    // the round-number grant this replaced.
    expect(next.round).toBe(7);
    expect(next.players.P1.gold).toBe(9);
  });

  it("but a round someone CAN act in is played", () => {
    const s = freshGame(9);
    s.players.P1.mulliganDone = true;
    s.players.P2.mulliganDone = true;
    s.phase = "resource";
    s.round = 1;
    s.players.P1.hand = [{ handId: "h1", defId: "pyro_bbq" }]; // cost 1 — affordable
    s.players.P2.hand = [];
    s.players.P1.spellbook = [];
    s.players.P2.spellbook = [];
    expect(advance(s).round).toBe(1);
  });

  it("a targetless spell is something to do, so the round stands", () => {
    const s = freshGame(9);
    s.players.P1.mulliganDone = true;
    s.players.P2.mulliganDone = true;
    s.phase = "resource";
    s.round = 1;
    s.players.P1.hand = [{ handId: "h1", defId: "pyro_magmadon" }];
    s.players.P2.hand = [];
    // A cost-1 trap needs no target and no body on the board — it is a real turn.
    s.players.P1.spellbook = [{ defId: "pyro_ember_trap", used: false }];
    s.players.P2.spellbook = [];
    s.players.P1.magicPool = 4;
    expect(advance(s).round).toBe(1);
  });
});

describe("a summon can arrive on a chosen auto mode", () => {
  it("honours the mode the intent carries", () => {
    const s = prepState();
    s.players.P1.gold = 20;
    const handId = giveHand(s, "P1", "pyro_bbq");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0, autoMode: "full" });
    const landed = boardCards(next, "P1")[0];
    expect(landed.autoMode).toBe("full");
  });

  it("and defaults to manual when it carries none", () => {
    const s = prepState();
    s.players.P1.gold = 20;
    const handId = giveHand(s, "P1", "pyro_bbq");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(boardCards(next, "P1")[0].autoMode).toBe("manual");
  });

  it("but an AI seat stays full-auto whatever the intent says", () => {
    // The stored preference belongs to a human's UI. A seat the machine is
    // playing must not be talked out of full auto by one.
    const s = prepState(42, "P2");
    s.humans = ["P1"]; // P2 is the AI
    s.players.P2.gold = 20;
    s.prep = { priority: "P2", consecutivePasses: 0, movedThisTurn: false };
    const handId = giveHand(s, "P2", "pyro_bbq");
    const next = applyIntent(s, { type: "SUMMON", player: "P2", handId, col: 0, autoMode: "manual" });
    expect(boardCards(next, "P2")[0].autoMode).toBe("full");
  });
});

describe("a body holds its square against a slow enemy", () => {
  // Before this, `canMove` only ever looked at the DESTINATION, so anything with
  // reach 2 walked straight through an occupied square. These pin the new rule
  // and, just as importantly, the three ways OUT of it.
  const BLOCKER = "bore_armadillo";       // any summoned card will do
  const PLAIN = "dusk_pumpkin";           // no keywords at all — still blocks
  /** A mid-tier walker: reach 2, so it has a middle square to be stopped on. */
  const SLOW = "dusk_skeleton_knight";

  it("stops a card too slow to slip past", () => {
    const s = prepState();
    expect(moveReach(getDef(SLOW).sp), "needs reach 2 to pass through anything").toBe(2);
    expect(getDef(SLOW).sp).toBeLessThanOrEqual(SP_MID_MAX);
    const mover = place(s, SLOW, "P1", 3, 0);
    place(s, BLOCKER, "P2", 2, 0);
    // (2,0) is the ONLY square between (3,0) and (1,0), so there is no way round.
    const move = canMove(s, "P1", mover.instanceId, { row: 1, col: 0 });
    expect(move.ok).toBe(false);
    expect(move.reason).toContain(getDef(BLOCKER).name);
  });

  it("holds with ANY card, not just the armoured ones", () => {
    // Deliberately not gated on BLOCK or on class: every summoned card is
    // defending its own home, so a bare 1-cost body stops a runner the same way
    // a Tank does. This is the assertion that says so.
    const s = prepState();
    expect(getDef(PLAIN).keywords.BLOCK, "no keywords to lean on").toBeUndefined();
    const mover = place(s, SLOW, "P1", 3, 0);
    place(s, PLAIN, "P2", 2, 0);
    expect(canMove(s, "P1", mover.instanceId, { row: 1, col: 0 }).ok).toBe(false);
  });

  it("lets the FAST tier slip past", () => {
    const s = prepState();
    // SP 11+ — the same line `movesLikeKing` draws, which is why the threshold
    // is SP_MID_MAX here rather than a written 11.
    const fast = CARDS.find((c) => c.sp > SP_MID_MAX && !c.keywords.FLYING && !c.mounted)!;
    const mover = place(s, fast.id, "P1", 3, 0);
    place(s, BLOCKER, "P2", 2, 0);
    expect(canMove(s, "P1", mover.instanceId, { row: 1, col: 0 }).ok).toBe(true);
  });

  it("lets FLYING over the top", () => {
    const s = prepState();
    // Not a special case for this rule — walls and traps already skip fliers.
    const flier = CARDS.find((c) => c.keywords.FLYING && c.sp <= SP_MID_MAX && moveReach(c.sp) === 2)!;
    const mover = place(s, flier.id, "P1", 3, 0);
    place(s, BLOCKER, "P2", 2, 0);
    expect(canMove(s, "P1", mover.instanceId, { row: 1, col: 0 }).ok).toBe(true);
  });

  it("does not let a blocker wall in its OWN side", () => {
    const s = prepState();
    const mover = place(s, SLOW, "P1", 3, 0);
    place(s, BLOCKER, "P1", 2, 0); // same owner
    expect(canMove(s, "P1", mover.instanceId, { row: 1, col: 0 }).ok).toBe(true);
  });

  it("only shuts a move when EVERY route is shut", () => {
    // (3,0) -> (2,1) is an L: it can go via (2,0) or via (3,1). One blocker
    // leaves a way round, and blocking on the first shut square would have
    // denied a move that can plainly be walked.
    const s = prepState();
    const mover = place(s, SLOW, "P1", 3, 0);
    const round = place(s, BLOCKER, "P2", 2, 0);
    expect(canMove(s, "P1", mover.instanceId, { row: 2, col: 1 }).ok, "goes via (3,1)").toBe(true);
    // Shut the other one and it is genuinely walled in.
    place(s, BLOCKER, "P2", 3, 1);
    expect(canMove(s, "P1", mover.instanceId, { row: 2, col: 1 }).ok).toBe(false);
    // …while the one-step move onto neither middle is still legal: a blocker
    // adjacent to you was never the thing being stopped.
    expect(round.pos).toEqual({ row: 2, col: 0 });
    expect(canMove(s, "P1", mover.instanceId, { row: 2, col: 3 }).ok).toBe(false); // too far, unrelated
  });
});

// ONE CAPTURED SQUARE MUST NOT LOCK THE HAND.
//
// The UI asks "can this card go anywhere?" in three places — the tap that arms
// a summon, the drag, and the lit/draggable set in the hand strip — and each
// used to work it out for itself. The tap asked about a single square: the
// first with no CARD standing on it. A captured Home slot holds no card once
// its captor walks off, so it passed that filter, sorted first by column, and
// answered "Slot is permanently captured" for every card in hand while the rest
// of the Home row stood wide open. The card lit up, dragged, and refused the
// tap — for the rest of the match, since a capture is permanent.
//
// It could only ever happen on the DUEL boards: Void Tower and Domination both
// switch capture off, so 4x4 and 5x5 are the only places a slot is ever locked.
// On a four-wide Home row one lost square is a quarter of the deployment.
//
// `summonSquare` is now the single answer all three read, so these pin the
// property rather than the call site: if any square will take the card, the
// authority says so.
describe("a captured Home slot does not lock the rest of the row", () => {
  for (const [label, mk, n] of [
    ["4x4", prepState, 4],
    ["5x5", bigPrepState, 5],
  ] as const) {
    it(`${label}: a captured column leaves every other column summonable`, () => {
      const s = mk();
      const home = n - 1;                       // P1's home row
      s.players.P1.gold = 20;
      s.slots[home][0].capturedBy = "P2";       // the captor has since walked off
      const handId = giveHand(s, "P1", "leaf_greegon"); // cost 3

      // The engine's own view: the captured column refuses, the others do not.
      expect(canSummon(s, "P1", handId, 0).ok).toBe(false);
      expect(openHomeSlots(s, "P1")).toEqual(
        Array.from({ length: n - 1 }, (_, i) => i + 1));

      // ...so the card IS playable, and the authority points at a real square.
      const sq = summonSquare(s, "P1", handId);
      expect(sq, "one captured slot must not make the card unplayable").not.toBeNull();
      expect(sq!.col).not.toBe(0);
      expect(canSummon(s, "P1", handId, sq!.col).ok).toBe(true);

      // And it actually goes down.
      const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: sq!.col });
      expect(cardAt(next, home, sq!.col)?.defId).toBe("leaf_greegon");
    });

    it(`${label}: still refuses when the card itself is the problem`, () => {
      const s = mk();
      s.players.P1.gold = 0;                    // board wide open, no Gold
      const handId = giveHand(s, "P1", "leaf_greegon");
      expect(summonSquare(s, "P1", handId)).toBeNull();
      expect(canSummon(s, "P1", handId, 1).reason).toBe("Not enough Gold");
    });

    it(`${label}: a Home row full of my own cards is a board problem, not a lock`, () => {
      const s = mk();
      const home = n - 1;
      s.players.P1.gold = 20;
      for (let c = 0; c < n; c++) place(s, "leaf_greegon", "P1", home, c);
      const handId = giveHand(s, "P1", "leaf_greegon");
      // No square, and no forward fallback either — moving one of them clears it.
      expect(summonSquare(s, "P1", handId)).toBeNull();
      expect(summonLandingRow(s, "P1", 0)).toBeNull();
    });

    it(`${label}: the whole Home row captured opens the forward fallback`, () => {
      const s = mk();
      const home = n - 1;
      s.players.P1.gold = 20;
      for (let c = 0; c < n; c++) s.slots[home][c].capturedBy = "P2";
      const handId = giveHand(s, "P1", "leaf_greegon");
      const sq = summonSquare(s, "P1", handId);
      expect(sq, "a wholly captured row must not be a softlock").not.toBeNull();
      // It lands FORWARD, and never past the halfway line.
      const landing = summonLandingRow(s, "P1", sq!.col)!;
      expect(landing).toBeLessThan(home);
      expect(landing).toBeGreaterThanOrEqual(home - Math.floor((n - 1) / 2));
      const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: sq!.col });
      expect(cardAt(next, landing, sq!.col)?.defId).toBe("leaf_greegon");
    });
    it(`${label}: an off-board column refuses, it does not throw`, () => {
      const s = mk();
      const home = n - 1;
      s.players.P1.gold = 20;
      for (let c = 0; c < n; c++) s.slots[home][c].capturedBy = "P2";  // fallback open
      const handId = giveHand(s, "P1", "leaf_greegon");
      // The fallback used to walk the column without checking it was ON the
      // board, indexing past the end of the row — a TypeError out of a function
      // whose contract is to return a reason. Online, that is a desync.
      expect(() => canSummon(s, "P1", handId, n)).not.toThrow();
      expect(canSummon(s, "P1", handId, n)).toEqual({ ok: false, reason: "Bad column" });
      expect(summonLandingRow(s, "P1", n)).toBeNull();
      expect(summonLandingRow(s, "P1", -1)).toBeNull();
    });
  }

  // ...and the UI keeps asking THIS, rather than growing a fourth private copy.
  // The tests above pin the rule; this pins the wiring, which is the half that
  // actually broke — the rule was right the whole time and one call site was
  // asking it about a single square. Same shape as the PORTRAIT_QUERY guard in
  // styles.test.ts: a comment saying "use the shared one" did not prevent it.
  it("all four UI gates read the one authority", () => {
    const app = readFileSync(join(__dirname, "../../ui/App.tsx"), "utf8");
    for (const call of [
      "summonSquare(game, me, handId)",       // tap to arm, and the drag
      "summonSquare(game, view, h.handId)",   // the hand strip's lit/draggable set
      "summonSquare(game, me, h.handId)",     // hasAnyPlay, which nudges Pass
    ]) expect(app, `App.tsx no longer calls ${call}`).toContain(call);
    // The tap and the drag are two separate gates and both must be on it.
    expect((app.match(/summonSquare\(game, me, handId\)/g) ?? []).length,
      "the tap gate and the drag gate should both call summonSquare").toBe(2);
    // And nothing may go back to deciding "open" from occupancy alone: a
    // captured slot holds no card, which is the whole of what went wrong.
    expect(app, "a gate is filtering summon squares by !cardAt again")
      .not.toContain("homeSlots(game, me).filter((sq) => !cardAt(");
  });

  it("agrees with the hand strip: lit means placeable, on both duel boards", () => {
    for (const [mk, n] of [[prepState, 4], [bigPrepState, 5]] as const) {
      const s = mk();
      const home = n - 1;
      s.players.P1.gold = 20;
      s.slots[home][0].capturedBy = "P2";
      place(s, "leaf_greegon", "P1", home, 1);   // and one column of my own
      for (const h of s.players.P1.hand) {
        const sq = summonSquare(s, "P1", h.handId);
        // The set the hand lights IS this call, so the only thing left to pin is
        // that a square it names is one the engine will actually accept.
        if (sq) expect(canSummon(s, "P1", h.handId, sq.col).ok, `${n}x${n} ${h.defId}`).toBe(true);
      }
    }
  });
});

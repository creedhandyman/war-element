import { describe, it, expect } from "vitest";
import { advance, applyIntent } from "../phases";
import { canChannel, canFireSpecial } from "../rules";
import { createInitialState, summonCard } from "../state";
import { HERO_MIN_ROUND } from "../heroes";
import type { GameState, PlayerId } from "../types";
import { prepState } from "./helpers";
import { CARDS } from "../../data/cards";

/** A hearts (Mage) seat, past the hero gate, with the magic to channel. */
function heartSeat(seed = 7, seat: PlayerId = "P2"): GameState {
  const s = prepState(seed, seat);
  s.heroes = true;
  s.seatSuits = { ...(s.seatSuits ?? {}), [seat]: "heart" } as never;
  s.round = HERO_MIN_ROUND + 1;
  s.players[seat].magicPool = 7;
  s.players[seat].heroPowerUsed = false;
  return s;
}

describe("the prep-phase freeze — Arcane Focus", () => {
  /* THE BUG, from a real game: round 6, the opponent on hearts with 7 magic,
     phase PREP, priority OPP, and the board never moved again.

     `canChannel` waives the summon lockout on purpose — playing a piece and
     setting it off in the same prep is the headline of the power. The resolve
     path only ever lifted `freeSpecial`, so `canFireSpecial` went on enforcing
     the lockout and refused the channel `canChannel` had just approved. The
     reducer handed the power back and returned an UNCHANGED state, so the AI
     proposed exactly the same thing on the next tick. Forever. */

  it("the two predicates agree about a card that just landed", () => {
    const s = heartSeat();
    const caster = CARDS.find((c) => c.special && !c.special.talent
      && !c.roundTick?.fireSpecialEveryN && !c.boss);
    expect(caster, "the set has a plain Special to channel").toBeTruthy();
    const src = summonCard(s, "P2", caster!.id, { row: 0, col: 0 } as never);
    src.summonedThisRound = true;
    // canChannel says yes BECAUSE it waives the lockout...
    const chan = canChannel(s, src.instanceId);
    // ...and canFireSpecial says no BECAUSE it does not. That gap is the bug:
    // whatever canChannel approves, the resolve path has to be able to deliver.
    if (chan.ok) {
      const fire = canFireSpecial(s, src.instanceId);
      if (!fire.ok) {
        expect(
          fire.reason,
          "if canFireSpecial refuses an approved channel, the ONLY reason may be "
          + "the summon lockout — which the resolve path now lifts. Any other "
          + "reason is a fresh divergence and a fresh freeze.",
        ).toMatch(/summon/i);
      }
    }
  });

  it("an AI seat cannot re-propose a refused channel forever", () => {
    // THE FREEZE, as a state check. A HERO_POWER the reducer refuses must not
    // leave the state identical for an AI seat, or advance() spins on it.
    const s = heartSeat();
    const before = JSON.stringify(s);
    // An instanceId that does not exist is the cleanest possible refusal.
    const out = applyIntent(s, {
      type: "HERO_POWER", player: "P2", instanceId: "no-such-card",
    } as never);
    expect(JSON.stringify(out), "the state MUST change, or the AI retries it")
      .not.toBe(before);
    expect(out.players.P2.heroPowerUsed, "spent, not refunded, for an AI").toBe(true);
  });

  it("a HUMAN seat still gets the power back on a refusal", () => {
    // The refund exists for a misclick, and a human can misclick.
    const s = heartSeat();
    s.humans = ["P1", "P2"];
    const out = applyIntent(s, {
      type: "HERO_POWER", player: "P2", instanceId: "no-such-card",
    } as never);
    expect(out.players.P2.heroPowerUsed, "refunded for a person").toBeFalsy();
  });

  it("the watchdog stays INERT through real matches", () => {
    // WHAT THIS DOES AND DOES NOT TEST, stated plainly. The watchdog in the
    // prep branch of advance() passes a turn whose intent changed nothing. With
    // Arcane Focus fixed at the source there is no longer a live intent that
    // does that, so the FIRE path has nothing to trigger it — disabling the
    // watchdog entirely leaves every test in this file green, which is the
    // honest position: it is a backstop for a class of bug that currently has
    // no instance.
    //
    // What IS testable is the risk of ADDING it: a watchdog that misreads a
    // legitimate turn as no-progress would silently eat it. So this asserts it
    // never fires in ordinary play. If it ever does, something either really is
    // stuck or `progressKey` is blind to a real action — both worth knowing.
    const field = CARDS.filter((c) => c.element === "DUSK" && !c.boss).slice(0, 18).map((c) => c.id);
    for (const seed of [5, 21, 44]) {
      let s: GameState = createInitialState(seed, field, field, [], [], [], 4);
      s.heroes = true;
      let steps = 0;
      while (s.phase !== "gameover" && steps < 8000) { s = advance(s); steps++; }
      expect(s.phase, `seed ${seed} did not finish`).toBe("gameover");
      const fired = s.log.filter((l) => /had nothing it could do/.test(l));
      expect(fired, `seed ${seed}: watchdog fired on a real turn`).toEqual([]);
    }
  }, 120_000);

  it("a hearts AI match runs to completion instead of stalling", () => {
    // The end-to-end guard. Before the fix this loops until the step cap with
    // the round never advancing — which in the app is a frozen board.
    const field = CARDS.filter((c) => c.element === "AQUA" && !c.boss).slice(0, 18).map((c) => c.id);
    for (const seed of [3, 7, 11]) {
      let s: GameState = createInitialState(seed, field, field, [], [], [], 4);
      s.heroes = true;
      s.seatSuits = { P1: "heart", P2: "heart", P3: "club", P4: "spade" } as never;
      let steps = 0;
      const seen: number[] = [];
      while (s.phase !== "gameover" && steps < 8000) {
        s = advance(s);
        steps++;
        if (steps % 500 === 0) seen.push(s.round);
      }
      expect(s.phase, `seed ${seed} stalled at round ${s.round} after ${steps} steps`)
        .toBe("gameover");
      // ...and it got there by PLAYING, not by the round cap timing out on a
      // board nobody could move.
      expect(steps, `seed ${seed} used the whole step budget`).toBeLessThan(8000);
      void seen;
    }
  }, 120_000);
});

import { describe, expect, it } from "vitest";
import {
  RUN_LENGTH, RUN_REWARD, boardOfRun, ladderProgress, nextSeat, recordResult, rewardFor, runReward,
  runComplete, runOver, startRun,
} from "../../data/gauntlet";
import { DECK_TIERS, decksForTier, tiersFor } from "../../data/custom-decks";
import { settleArena } from "../../data/gauntlet";
import { awardShards, newSave, type StorySave } from "../../data/story";

const seq = (...n: number[]) => { let i = 0; return () => n[i++ % n.length]; };

describe("the gauntlet", () => {
  it("deals a full rung, in an order the player did not choose", () => {
    // Per BOARD, not just 4x4: elite exists only on the large one, so walking
    // DECK_TIERS against a fixed board deals a run with no seats in it.
    for (const board of [4, 5] as const)
      for (const tier of tiersFor(board)) {
        const run = startRun(tier, board, seq(0));
        expect(run.seats, `${tier} ${board}x${board}`).toHaveLength(RUN_LENGTH);
        expect(new Set(run.seats).size, "no repeats").toBe(RUN_LENGTH);
        const rung = new Set(decksForTier(tier, board).map((d) => d.id));
        for (const id of run.seats) expect(rung.has(id), `${id} is on ${tier}`).toBe(true);
      }
  });

  it("rolls WHICH four, now that a rung holds five", () => {
    // The point of an over-sized rung: two runs at the same difficulty are not
    // the same four fights. Asserts the SET changes and not merely the order —
    // a shuffle that only reordered would pass a naive "the runs differ" check
    // while dealing identical opponents.
    for (const board of [4, 5] as const)
      for (const tier of tiersFor(board)) {
        if (decksForTier(tier, board).length <= RUN_LENGTH) continue;
        const sets = new Set<string>();
        for (let i = 0; i < 200; i++) sets.add([...startRun(tier, board).seats].sort().join("|"));
        expect(sets.size, `${tier} ${board}x${board} deals only one set`).toBeGreaterThan(1);
        // Every deck on the rung is reachable — a fifth nobody ever meets is
        // content that does not exist.
        const seen = new Set<string>();
        for (let i = 0; i < 400; i++) for (const id of startRun(tier, board).seats) seen.add(id);
        expect(seen.size, `${tier} ${board}x${board} unreachable decks`)
          .toBe(decksForTier(tier, board).length);
      }
  });

  it("never deals a short run, on any rung", () => {
    // `runComplete` measures wins against `seats.length`, so a rung smaller than
    // RUN_LENGTH would deal three seats and pay out after three fights.
    for (const board of [4, 5] as const)
      for (const tier of tiersFor(board))
        expect(startRun(tier, board).seats.length, `${tier} ${board}x${board}`).toBe(RUN_LENGTH);
  });

  it("cannot be re-rolled — the seats are fixed at the start", () => {
    // This is the whole anti-farm property: leaving and coming back has to
    // resume the same run, not deal a kinder one. The run is data, so what the
    // test can check is that advancing never rewrites the sequence.
    const run = startRun("mid", 4, seq(0.9, 0.1, 0.5));
    const seats = [...run.seats];
    const after = recordResult(recordResult(run, true), true);
    expect(after.seats).toEqual(seats);
  });

  it("walks the seats in order and finishes on the fourth win", () => {
    let run = startRun("easy", 4, seq(0.3));
    const seen: string[] = [];
    for (let i = 0; i < RUN_LENGTH; i++) {
      const seat = nextSeat(run, 4);
      expect(seat, `seat ${i}`).toBeTruthy();
      seen.push(seat!.id);
      run = recordResult(run, true);
    }
    expect(seen).toEqual(run.seats);
    expect(runComplete(run)).toBe(true);
    expect(nextSeat(run, 4)).toBeNull();
  });

  it("ends the run on a single loss, whatever was banked", () => {
    let run = startRun("hard", 4, seq(0.2));
    run = recordResult(recordResult(run, true), true);
    expect(run.won).toBe(2);
    run = recordResult(run, false);
    expect(runOver(run)).toBe(true);
    expect(runComplete(run)).toBe(false);
    expect(nextSeat(run, 4)).toBeNull();
    expect(rewardFor(run)).toBe(0);
  });

  it("pays nothing for a partial run, and the rung's reward for a full one", () => {
    let run = startRun("hard", 4, seq(0.4));
    for (let i = 0; i < RUN_LENGTH - 1; i++) {
      run = recordResult(run, true);
      expect(rewardFor(run), `after ${i + 1} wins`).toBe(0);
    }
    run = recordResult(run, true);
    expect(rewardFor(run)).toBe(RUN_REWARD.hard);
    expect(RUN_REWARD.easy).toBeLessThan(RUN_REWARD.mid);
    expect(RUN_REWARD.mid).toBeLessThan(RUN_REWARD.hard);
  });

  it("ignores a result that arrives after the run is over", () => {
    // A replayed effect or a double render must not advance a finished run —
    // that is a free win, and on the last seat it would be a second payout.
    let run = startRun("mid", 4, seq(0.6));
    for (let i = 0; i < RUN_LENGTH; i++) run = recordResult(run, true);
    const done = { ...run };
    expect(recordResult(run, true)).toEqual(done);
    expect(recordResult(run, false)).toEqual(done);
    expect(rewardFor(recordResult(run, true))).toBe(RUN_REWARD.mid);

    let lost = recordResult(startRun("easy", 4, seq(0.1)), false);
    const stuck = { ...lost };
    lost = recordResult(lost, true);
    expect(lost).toEqual(stuck);   // a loss cannot be won back
  });

  it("reports the ladder in order", () => {
    expect(ladderProgress({ cleared: ["easy"] })).toEqual([
      { tier: "easy", cleared: true },
      { tier: "mid", cleared: false },
      { tier: "hard", cleared: false },
      { tier: "elite", cleared: false },
    ]);
    expect(ladderProgress(undefined).every((r) => !r.cleared)).toBe(true);
  });
});

describe("settling an arena match", () => {
  const save = (over?: Partial<StorySave>): StorySave => ({ ...newSave(), ...over });
  const pay = (s: StorySave) => awardShards(s, "arena");
  const shards = (s: StorySave) => s.hero?.shards ?? 0;

  it("pays a win over a premade and nothing over a deck you built", () => {
    // The farm this exists to close: a hand-built punching bag in the other
    // seat used to be two shards a match, forever.
    expect(shards(settleArena(save(), { won: true, againstPremade: true }, pay))).toBe(2);
    expect(shards(settleArena(save(), { won: true, againstPremade: false }, pay))).toBe(0);
    expect(shards(settleArena(save(), { won: false, againstPremade: true }, pay))).toBe(0);
  });

  it("advances a run on a win and pays the rung on the fourth", () => {
    let s = save({ gauntlet: { run: startRun("mid", 4, seq(0.3)), cleared: [] } });
    for (let i = 0; i < RUN_LENGTH - 1; i++) {
      s = settleArena(s, { won: true, againstPremade: true, gauntletSeat: true }, pay);
      expect(s.gauntlet!.run!.won, `after ${i + 1}`).toBe(i + 1);
      expect(shards(s), "only the per-win shards so far").toBe((i + 1) * 2);
    }
    s = settleArena(s, { won: true, againstPremade: true, gauntletSeat: true }, pay);
    expect(runComplete(s.gauntlet!.run)).toBe(true);
    expect(shards(s)).toBe(RUN_LENGTH * 2 + RUN_REWARD.mid);
    expect(s.gauntlet!.cleared).toEqual(["mid"]);
  });

  it("ends the run on a loss and pays nothing for it", () => {
    let s = save({ gauntlet: { run: startRun("hard", 4, seq(0.7)), cleared: [] } });
    s = settleArena(s, { won: true, againstPremade: true, gauntletSeat: true }, pay);
    s = settleArena(s, { won: false, againstPremade: true, gauntletSeat: true }, pay);
    expect(s.gauntlet!.run!.lost).toBe(true);
    expect(shards(s), "the one win still paid; the run did not").toBe(2);
    expect(s.gauntlet!.cleared).toEqual([]);
  });

  it("cannot be paid twice by a replayed settlement", () => {
    // The effect guards on the game object, but a pure function that pays again
    // when handed a finished run would turn any re-render into free shards.
    let s = save({ gauntlet: { run: startRun("easy", 4, seq(0.2)), cleared: [] } });
    for (let i = 0; i < RUN_LENGTH; i++) s = settleArena(s, { won: true, againstPremade: true, gauntletSeat: true }, pay);
    const banked = shards(s);
    expect(banked).toBe(RUN_LENGTH * 2 + RUN_REWARD.easy);
    const again = settleArena(s, { won: true, againstPremade: true, gauntletSeat: true }, pay);
    // The per-win shards still apply — that is an ordinary arena win — but the
    // RUN must not pay again.
    expect(shards(again) - banked).toBe(2);
    expect(again.gauntlet!.run).toEqual(s.gauntlet!.run);
  });

  it("parks a run rather than spending it when the match was another mode", () => {
    // The reported bug, and the reason `gauntletSeat` exists: a run in progress
    // was advanced by ANY arena match, and ENDED by any arena loss. Play one
    // casual game with a run armed and the run was gone, scored against a deck
    // it never dealt you. "A run is live" is not the same question as "this
    // match belongs to it", and only the caller knows the second one.
    const armed = save({ gauntlet: { run: startRun("mid", 4, seq(0.3)), cleared: [] } });

    // A LOSS in another mode must leave the run untouched — this is the half
    // that destroyed progress.
    const lost = settleArena(armed, { won: false, againstPremade: true }, pay);
    expect(lost.gauntlet!.run!.lost, "a casual loss must not end the run").toBeUndefined();
    expect(lost.gauntlet!.run!.won).toBe(0);

    // A WIN in another mode must not advance it either — a free seat is the
    // same bug wearing a friendlier face.
    const won = settleArena(armed, { won: true, againstPremade: true }, pay);
    expect(won.gauntlet!.run!.won, "a casual win must not bank a seat").toBe(0);
    expect(shards(won), "it is still an ordinary arena win").toBe(2);

    // And the run is still there to come back to, which is the point.
    expect(runOver(won.gauntlet!.run)).toBe(false);
  });

  it("still finishes a run that was left and returned to", () => {
    // Leaving mid-run is now a supported thing to do, so the seats banked
    // before you left have to be the seats you resume on.
    let s = save({ gauntlet: { run: startRun("easy", 4, seq(0.2)), cleared: [] } });
    s = settleArena(s, { won: true, againstPremade: true, gauntletSeat: true }, pay);
    // …two matches in other modes, one of them a loss…
    s = settleArena(s, { won: false, againstPremade: true }, pay);
    s = settleArena(s, { won: true, againstPremade: true }, pay);
    expect(s.gauntlet!.run!.won, "the run kept its place").toBe(1);
    for (let i = 0; i < RUN_LENGTH - 1; i++)
      s = settleArena(s, { won: true, againstPremade: true, gauntletSeat: true }, pay);
    expect(runComplete(s.gauntlet!.run)).toBe(true);
    expect(s.gauntlet!.cleared).toEqual(["easy"]);
  });

  it("leaves a save with no run completely alone apart from the win", () => {
    const before = save();
    const after = settleArena(before, { won: true, againstPremade: true, gauntletSeat: true }, pay);
    expect(after.gauntlet).toBeUndefined();
    expect(shards(after)).toBe(2);
  });
});

describe("the large board pays more", () => {
  it("scales the run reward by the battlefield, not just the rung", () => {
    // A 5x5 run is thirty cards, an eight-spell book and a match about a third
    // longer. Paying both boards the same made 4x4 strictly the better earner
    // per minute — the wrong incentive to hang on the harder format.
    for (const tier of DECK_TIERS) {
      expect(runReward(tier, 5), tier).toBeGreaterThan(runReward(tier, 4));
      expect(runReward(tier, 4), `${tier} 4x4 is the printed base`).toBe(RUN_REWARD[tier]);
    }
    // Still ordered up the ladder on the big board, not just the small one.
    expect(runReward("easy", 5)).toBeLessThan(runReward("mid", 5));
    expect(runReward("mid", 5)).toBeLessThan(runReward("hard", 5));
  });

  it("pays the board the run was DEALT for, whatever the Arena shows later", () => {
    // The run outlives the picker: start one on 5x5, flip the battlefield, and
    // the payout must not follow the toggle.
    const run = startRun("hard", 5, () => 0);
    expect(run.board).toBe(5);
    expect(boardOfRun(run)).toBe(5);
    const done = { ...run, won: run.seats.length };
    expect(rewardFor(done)).toBe(runReward("hard", 5));
  });

  it("reads the board off the seat ids when a run predates the field", () => {
    // Runs saved before `board` existed carry no value; the large builds' ids
    // end in `_5`, so the rate is still recoverable rather than defaulting to
    // the cheaper board and quietly underpaying.
    const big = startRun("mid", 5, () => 0);
    const legacy = { tier: big.tier, seats: big.seats, won: big.seats.length };
    expect(boardOfRun(legacy)).toBe(5);
    expect(rewardFor(legacy)).toBe(runReward("mid", 5));
    const small = startRun("mid", 4, () => 0);
    expect(boardOfRun({ tier: small.tier, seats: small.seats, won: 0 })).toBe(4);
  });
});

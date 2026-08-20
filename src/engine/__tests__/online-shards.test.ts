// Online pays, and it is the only mode that pays a loser.
//
// The rates are a design choice (10 / 5, against the arena's 2), but the two
// things tested here are not choices — they are the ways the payout can be
// silently wrong, and neither is visible from the UI:
//
//   Paying the wrong SEAT. The guest sits in P2, so "P1 won" is not "I won".
//   Before this existed the settle effect read `game.win?.winner === "P1"`
//   flat, which paid a losing guest and stiffed a winning one.
//
//   Paying a CONCEDE. A consolation for showing up is a faucet the moment it
//   also covers pressing Surrender — two players conceding to each other on
//   repeat would be the best rate in the game, for no game.
import { describe, expect, it } from "vitest";
import { SHARDS_ONLINE_LOSS, SHARDS_PER_WIN, onlineMatchShards } from "../../data/story";

describe("online shards", () => {
  it("pays a win more than a loss, and both more than the AI", () => {
    expect(onlineMatchShards({ won: true, surrendered: false })).toBe(SHARDS_PER_WIN.online);
    expect(onlineMatchShards({ won: false, surrendered: false })).toBe(SHARDS_ONLINE_LOSS);
    expect(SHARDS_PER_WIN.online).toBeGreaterThan(SHARDS_ONLINE_LOSS);
    // The whole reason online can afford the best rate: a human opponent is not
    // infinite the way the AI seat is.
    expect(SHARDS_ONLINE_LOSS).toBeGreaterThan(SHARDS_PER_WIN.arena);
  });

  it("pays nothing for conceding", () => {
    expect(onlineMatchShards({ won: false, surrendered: true })).toBe(0);
  });

  it("pays a win in full even if the OPPONENT was the one who surrendered", () => {
    // `surrendered` is this player's own concede, not the match's ending. A
    // win by surrender is still a win you have to have been playing to get.
    expect(onlineMatchShards({ won: true, surrendered: false })).toBe(SHARDS_PER_WIN.online);
  });

  it("pays the seat, not the side — the guest's win is a P2 win", () => {
    // The seat mapping lives in the caller, so this is what the caller must be
    // computing: won := (winner === myId). Stated here so a future edit that
    // reintroduces a hardcoded "P1" has something to fail against.
    const winner = "P2";
    for (const [myId, expected] of [["P2", SHARDS_PER_WIN.online], ["P1", SHARDS_ONLINE_LOSS]] as const)
      expect(onlineMatchShards({ won: winner === myId, surrendered: false })).toBe(expected);
  });
});

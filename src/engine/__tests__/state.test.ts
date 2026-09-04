// Milestone 1: state, decks, shuffle/deal, mulligan, draw math, resources.

import { describe, expect, it } from "vitest";
import { createInitialState, homeSlotsHeld } from "../state";
import { canSummon } from "../rules";
import { homeRow, poolGainForRound } from "../types";
import { applyIntent, advance, advanceUntilInput } from "../phases";
import { CARDS, DECK_P1, DECK_P2, TOKENS } from "../../data/cards";
import { freshGame, giveHand, place, prepState } from "./helpers";

describe("card identity", () => {
  // Two genuine collisions shipped before this guard existed: the DUSK token
  // was named "SkullDrake" EXACTLY like the draftable Rare, and the GALE token
  // "ToxHawk" differed from the Rare "Toxhawk" only by a capital H. Both break
  // anything that looks a card up by name — deck lists, node rosters, the
  // collection screen — because ids are what the engine uses and names are what
  // everything human-facing does.
  const all = [...CARDS, ...TOKENS];

  it("every card id is unique", () => {
    const seen = new Map<string, number>();
    for (const c of all) seen.set(c.id, (seen.get(c.id) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
  });

  it("every card NAME is unique, case-insensitively", () => {
    const seen = new Map<string, string[]>();
    for (const c of all) {
      const k = c.name.toLowerCase();
      seen.set(k, [...(seen.get(k) ?? []), c.id]);
    }
    const dupes = [...seen].filter(([, ids]) => ids.length > 1).map(([k, ids]) => `${k}: ${ids.join(" + ")}`);
    expect(dupes).toEqual([]);
  });
});

describe("setup", () => {
  it("deals 4-card opening hands, leaving the rest in each deck", () => {
    const s = createInitialState(1);
    expect(s.players.P1.hand).toHaveLength(4);
    expect(s.players.P2.hand).toHaveLength(4);
    expect(s.players.P1.deck).toHaveLength(DECK_P1.length - 4);
    expect(s.players.P2.deck).toHaveLength(DECK_P2.length - 4);
    expect(s.phase).toBe("mulligan");
  });

  it("every card's cost matches the stat formula (total ≈ 5·cost + 10)", () => {
    // shields count 2 points each; source-printed costs may drift ±2 total.
    // Cost-8 Legendaries sit in the tier band (40-50 total) rather than the
    // exact formula, and pay part of their cost in strong abilities/immunity.
    const exceptions = new Set([
      "bore_bearocks",
      "dusk_skelider",
      // Ability-carried, downward: 47 vs a Cost-8 budget of 50. Soul Slash
      // DELETES 15 max HP (outright lethal at 15 or under) and cloaks in
      // STEALTH — the missing 3 body points are what that buys.
      "dusk_nightfang",
      // Ability-carried, downward: 45 vs a Cost-8 budget of 50. Steel is immune
      // to every status and DOT in the game, carries BLOCK 2 on top of 5 printed
      // shields, and its Special strips up to 3 shields per foe off the rank
      // ahead and wears them. Total immunity is the expensive part — the missing
      // 5 body points are what it costs.
      "bore_steel",
      // Ability-carried, downward: 40 vs a Cost-7 budget of 45. Dunewraith was
      // nerfed (HP 19→14) to rein in Frostkeep; its Nightmare Special (5×2 +
      // SLEEP nova) carries the missing points. Deliberately under-statted.
      //
      // Recost 6→7 kept the DISCOUNT rather than cashing it: it was 5 points
      // under budget before and it is 5 points under budget now. Raising the
      // stats to the new ceiling would have quietly handed back a nerf that was
      // made for a reason.
      "bore_sandman",
      // Ability-carried, downward: 52 vs a Cost-9 budget of 55. SkullKing raises
      // 2 Skeletons on summon + 2 every round + a SkullDrake on its Special, and
      // buffs the whole bone army — the free bodies carry the missing points.
      "dusk_skullking",
      // Ability-carried, downward, and the steepest in the set: 34 vs a Cost-7
      // budget of 45. Running Crew summons SURGE — a real cost-4 CARD, not a
      // token — so a 33-point body arrives beside Havoc every time it lands.
      // Eleven points under budget for thirty-two points of free material is
      // still generous to Havoc; the cost went 5->7 for exactly that reason and
      // the stat line was deliberately left alone.
      "bolt_havoc",
      // Ability-carried, downward: 41 (10x1 + 15hp + 2sh x2 + 12sp) vs a Cost-7
      // budget of 45. Ambush Coil spawns a KING COBRA on summon — 31 points of
      // its own (5 + 8 + 2x2 + 8, restatted from 31 when the snake became a
      // draftable cost-3 Rare) — and the pair hunt together: Venom Strike
      // puts a target under and BOTH snakes then double into it, the token
      // carrying `vsStatus` written on itself so it keeps doing so after Kobra
      // dies. Four points off the printed line nowhere near pays for a free
      // 25-point body; the recost 6 -> 7 is what pays for it, and the stat line
      // was trimmed (HP 16 -> 15) rather than raised to the new ceiling so the
      // extra gold is not handed straight back.
      "bore_kobra",
      // Ability-carried, downward: 34 against a Cost-6 budget of 40. Falconer
      // puts a FALCON on the board the moment Goldspur lands — a cost-3 Rare
      // worth 25 points of body, carrying FLYING and PLUMMET, which is a finisher
      // that deletes anything under its DMG outright. Six points off the printed
      // line does not pay for that on its own; the recost 5 -> 6 (and with it
      // Epic -> Legendary, since the bands tie those together) is what does,
      // exactly as Kobra's note above describes.
      "gale_goldspur",

      // (Sparkle and ToxHawk both used to sit here as "SP-heavy glass cannons"
      // running past the ±2 band. Sparkle traded SP 14 -> 9 to pay for cost 1,
      // and ToxHawk dropped 2 HP to land 2 over at cost 2. Both are inside the
      // band now and are guarded by this test like anything else.)
      // Cost-10 Mythics sit in the tier band (55-67 total) above the exact
      // formula — they pay part of their cost in spawns / auras / on-kill snowball.
      "gale_griffith",
      "bolt_elecdroid",
      "dusk_shadowhorsemen",
      "bore_deepest",
      // Promoted token. Sits 6 BELOW the formula, the opposite direction from
      // the mythics above: its stat line was drawn for something you get spawned
      // for free, and the power lives in Crowned + King Me instead. Left as
      // printed so a spawned copy behaves identically to a drafted one.
      // (Reptilian used to be here too. Its SP buffs brought it to 13 vs 15,
      // inside the band, so it is held to the formula again like anything else.)
      "dawn_heir_tok",
      // Ability-carried, same reasoning as the mythics above but downward: 31 vs
      // 35. War Mount hands it +3 shield on arrival AND a permanent +4 on every
      // basic landed from melee range — still more than the 4 points the printed
      // line gives up (trimmed from +5 / +6 after it measured OP).
      "bore_rohojohn",
      // Ability-carried, downward: 30 vs a Cost-5 budget of 35. Rubyscale spawns
      // Greegon — a real card, 27 points of its own — on summon, and its Special
      // carries a +8 rider that only works while Greegon stands, so it enables
      // its own payoff. Five points off the printed line is nowhere near paying
      // for a free 27-point body; the price does the rest.
      //
      // This exception has been wrong twice, so the figures above are computed
      // rather than remembered: it once read "22 vs a Cost-5 budget of 35" for a
      // cost-3 card totalling 26, which suppressed nothing at all because the
      // card was INSIDE the band and the entry was silently inert.
      "leaf_rubyo",
      // Ability-carried, downward: 40 vs a Cost-7 budget of 45. Siren's
      // transform-into-Krakler kit carries the missing value (cost 7, no bump).
      "aqua_siren",
      // Ability-carried, downward: 40 vs a Cost-7 budget of 45 — the same
      // numbers as Siren above. Volcanon went cost 6 -> 7 with no stat bump on
      // purpose: it fires a 13-damage basic at RANGE, flies, grows permanently
      // to +5 (Bad Temper), and Eruption strips up to 5 shields and recasts free
      // on a kill. The extra gold is the price of that kit, not of a bigger body.
      "pyro_volcanon",
      // Doc stat line (9/32/3sh/7): the doc counts shields x1 (Total 51), the
      // game x2 (54 vs a Cost-8 budget of 50, +4). Kept as the doc printed it —
      // an ability-carried near-mythic (Volcanic Charge + Burning Roar stacks +
      // on-summon BURN AoE).
      "pyro_infernus_rex",
      // ONE point outside the band, and the only entry here that is a tuning
      // choice rather than an ability-carried line: 33 vs a Cost-4 budget of 30.
      // Surge gave up 2 shields for 5 HP, and because the formula prices
      // shields at x2 and HP at x1 that swap is +1 on a card already sitting at
      // the +2 edge. (A later 2 damage for 2 HP is exactly body-neutral and
      // does not move this.) The card is not stronger for it — arguably weaker,
      // since shields block first and Electro Surge refills them — so trimming
      // SP or damage to satisfy the arithmetic would change how it plays in
      // order to keep a number tidy. Recorded instead of hidden; if the band is
      // ever enforced strictly, this is the one to revisit first.
      "bolt_surge",
    ]);
    for (const def of CARDS) {
      if (exceptions.has(def.id)) continue;
      // Void Tower bosses are off the cost curve BY DESIGN — their body answers
      // the floor cap in void-tower.test.ts, and they can be acquired nowhere
      // (also tested there), so the curve has nothing to protect against them.
      if (def.boss) continue;
      const total = def.dmg * def.hits + def.hp + def.shields * 2 + def.sp;
      const expected = 5 * def.cost + 10;
      expect(
        Math.abs(total - expected),
        `${def.id}: total ${total} vs 5·${def.cost}+10 = ${expected}`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("is deterministic for a given seed", () => {
    const a = createInitialState(7);
    const b = createInitialState(7);
    expect(a.players.P1.hand.map((h) => h.defId)).toEqual(
      b.players.P1.hand.map((h) => h.defId),
    );
    expect(a.firstPlayer).toBe(b.firstPlayer);
  });

  it("different seeds shuffle differently (spot check)", () => {
    const hands = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5]) {
      hands.add(
        createInitialState(seed)
          .players.P1.hand.map((h) => h.defId)
          .join(","),
      );
    }
    expect(hands.size).toBeGreaterThan(1);
  });
});

describe("mulligan", () => {
  it("returns a subset, reshuffles, redraws to 4", () => {
    const s = freshGame(3);
    const toss = s.players.P1.hand.slice(0, 2).map((h) => h.handId);
    const next = applyIntent(s, { type: "MULLIGAN", player: "P1", returnHandIds: toss });
    expect(next.players.P1.hand).toHaveLength(4);
    expect(next.players.P1.deck).toHaveLength(DECK_P1.length - 4);
    expect(next.players.P1.mulliganDone).toBe(true);
    for (const id of toss)
      expect(next.players.P1.hand.some((h) => h.handId === id)).toBe(false);
  });

  it("cannot mulligan twice", () => {
    const s = applyIntent(freshGame(3), { type: "MULLIGAN", player: "P1", returnHandIds: [] });
    expect(() =>
      applyIntent(s, { type: "MULLIGAN", player: "P1", returnHandIds: [] }),
    ).toThrow();
  });

  it("after both mulligans the game advances to round 1 prep", () => {
    let s = applyIntent(freshGame(3), { type: "MULLIGAN", player: "P1", returnHandIds: [] });
    s = advanceUntilInput(s); // AI mulligans, draw + resource resolve
    expect(s.round).toBe(1);
    expect(s.phase).toBe("prep");
    // round 1: opening 4 + drew 1 = hand 5, summon pool 1, magic 0 + round-1 drip 1.
    // (P2 may already have spent its summon pool if it won the coin flip.)
    expect(s.players.P1.hand).toHaveLength(5);
    expect(s.players.P1.gold).toBe(1);
    expect(s.players.P1.magicPool).toBe(1);
    expect(s.players.P2.gold).toBeLessThanOrEqual(1);
  });
});

describe("draw math", () => {
  it("draws 1 per normal round, 3 on every fifth", () => {
    // A CADENCE rather than a pair of hard-coded rounds: it was 10 and 15, so a
    // long match got two refuels and then nothing for the back thirty-five
    // rounds of the fifty-round clock. Both ends are checked — the first bonus
    // and one well past where the old rule stopped.
    for (const [round, expected] of [
      [4, 1],
      [5, 3],
      [9, 1],
      [10, 3],
      [15, 3],
      [20, 3],
      [21, 1],
      [45, 3],
    ] as const) {
      const s = freshGame(9);
      s.phase = "draw";
      s.round = round;
      const before = s.players.P1.hand.length;
      const next = advance(s);
      expect(next.players.P1.hand.length - before, `round ${round}`).toBe(expected);
    }
  });

  it("caps the hand at 7 — a bonus-draw round only fills up to the cap", () => {
    const s = freshGame(9);
    s.phase = "draw";
    s.round = 10; // draws 3
    // Pad to 6 so a 3-draw would overshoot the cap of 7.
    while (s.players.P1.hand.length < 6)
      s.players.P1.hand.push({ handId: `h${s.nextId++}`, defId: "leaf_alpha" });
    const next = advance(s);
    expect(next.players.P1.hand.length).toBe(7); // 6 → 7, not 9
  });

  it("a hand already at the cap draws nothing, leaving cards on the deck", () => {
    const s = freshGame(9);
    s.phase = "draw";
    s.round = 4; // would draw 1
    while (s.players.P1.hand.length < 7)
      s.players.P1.hand.push({ handId: `h${s.nextId++}`, defId: "leaf_alpha" });
    const deckBefore = s.players.P1.deck.length;
    const next = advance(s);
    expect(next.players.P1.hand.length).toBe(7);
    expect(next.players.P1.deck.length).toBe(deckBefore); // not burned
  });

  it("empty deck draws nothing, no penalty", () => {
    const s = freshGame(9);
    s.phase = "draw";
    s.round = 2;
    s.players.P1.deck = [];
    const handBefore = s.players.P1.hand.length;
    const next = advance(s);
    expect(next.players.P1.hand.length).toBe(handBefore);
    expect(next.phase).toBe("resource");
  });
});

describe("resource math (two pools)", () => {
  it("summon gold is 1 a round plus one per home slot held", () => {
    // Income comes off the BOARD, not the clock. An empty board earns the
    // flat 1 however deep into the match you are.
    const s = freshGame(9);
    s.phase = "resource";
    s.round = 4;
    s.players.P1.gold = 0;
    s.players.P1.magicPool = 3;
    const next = advance(s);
    expect(next.players.P1.gold).toBe(poolGainForRound(next.round)); // nothing held
    expect(next.players.P1.magicPool).toBe(4); // magic still drips: +1 (rounds 1–5)
  });

  it("...and each home slot held adds one, counted per player", () => {
    const s = freshGame(9);
    s.phase = "resource";
    s.round = 2;
    s.players.P1.gold = 0;
    s.players.P2.gold = 0;
    // P1 holds three of its own home slots; P2 holds one.
    const p1row = homeRow("P1", s.boardSize);
    const p2row = homeRow("P2", s.boardSize);
    for (let col = 0; col < 3; col++) place(s, "leaf_oak", "P1", p1row, col);
    place(s, "leaf_oak", "P2", p2row, 0);
    expect(homeSlotsHeld(s, "P1")).toBe(3);
    expect(homeSlotsHeld(s, "P2")).toBe(1);
    const next = advance(s);
    expect(next.players.P1.gold).toBe(poolGainForRound(next.round) + 3);
    expect(next.players.P2.gold).toBe(poolGainForRound(next.round) + 1);
  });

  it("...and every earning card is flagged for the +1 coin animation", () => {
    // The income rule is invisible otherwise — the gold counter just ticks and
    // the player has to infer which cards did it. The renderer floats a coin off
    // each earner; this is the signal it reads.
    const s = freshGame(9);
    s.phase = "resource";
    s.round = 2;
    const row = homeRow("P1", s.boardSize);
    const a = place(s, "leaf_oak", "P1", row, 0);
    const b = place(s, "leaf_oak", "P1", row, 1);
    const forward = place(s, "leaf_oak", "P1", row - 1, 2);   // off the home row
    const enemy = place(s, "leaf_oak", "P2", row, 3);          // squatting on MY row
    const before = (c: { instanceId: string }) => s.cards[c.instanceId].fxCoin ?? 0;
    expect([before(a), before(b), before(forward), before(enemy)]).toEqual([0, 0, 0, 0]);
    const next = advance(s);
    expect(next.cards[a.instanceId].fxCoin).toBe(1);
    expect(next.cards[b.instanceId].fxCoin).toBe(1);
    expect(next.cards[forward.instanceId].fxCoin ?? 0, "a card off the home row earns nothing").toBe(0);
    expect(next.cards[enemy.instanceId].fxCoin ?? 0, "an enemy squatter earns nothing").toBe(0);
  });

  it("...and stepping onto the home row flags the coin immediately", () => {
    // Waiting until the next Resource phase to say "this now earns" is too late
    // to connect the move to the money.
    const s = prepState();
    const row = homeRow("P1", s.boardSize);
    const c = place(s, "dusk_vamp", "P1", row - 1, 0); // SP 7 — leaf_oak prints SP 0
    expect(s.cards[c.instanceId].fxCoin ?? 0).toBe(0);
    const next = applyIntent(s, {
      type: "MOVE", player: "P1", instanceId: c.instanceId, to: { row, col: 0 },
    });
    expect(next.cards[c.instanceId].fxCoin).toBe(1);
  });

  it("...but shuffling along the home row does not re-flag it", () => {
    // Only the CROSSING earns the announcement; a card already home is already
    // earning and would otherwise pop a coin every time it sidestepped.
    const s = prepState();
    const row = homeRow("P1", s.boardSize);
    const c = place(s, "dusk_vamp", "P1", row, 0);
    const next = applyIntent(s, {
      type: "MOVE", player: "P1", instanceId: c.instanceId, to: { row, col: 1 },
    });
    expect(next.cards[c.instanceId].fxCoin ?? 0).toBe(0);
  });

  it("...and an enemy standing in your home row pays you nothing", () => {
    // That slot is contested, not held — being pushed off your own back line
    // costs you the income to rebuild it, which is the whole point.
    const s = freshGame(9);
    s.phase = "resource";
    s.round = 3;
    s.players.P1.gold = 0;
    const p1row = homeRow("P1", s.boardSize);
    place(s, "leaf_oak", "P2", p1row, 0); // enemy squatting on P1's home slot
    expect(homeSlotsHeld(s, "P1")).toBe(0);
    expect(advance(s).players.P1.gold).toBe(poolGainForRound(s.round));
  });

  it("...and a card that advances off the home row stops paying for itself", () => {
    const s = freshGame(9);
    s.phase = "resource";
    s.round = 3;
    s.players.P1.gold = 0;
    const p1row = homeRow("P1", s.boardSize);
    const c = place(s, "leaf_oak", "P1", p1row, 1);
    expect(homeSlotsHeld(s, "P1")).toBe(1);
    c.pos = { row: p1row - 1, col: 1 }; // steps forward
    expect(homeSlotsHeld(s, "P1")).toBe(0);
    expect(advance(s).players.P1.gold).toBe(poolGainForRound(s.round));
  });

  it("magic gain scales in 5-round brackets (1/2/3/4/5)", () => {
    const gain = (round: number) => {
      const s = freshGame(9);
      s.phase = "resource";
      s.round = round;
      s.players.P1.magicPool = 3;
      return advance(s).players.P1.magicPool - 3;
    };
    expect(gain(5)).toBe(1); // last of the 1–5 bracket
    expect(gain(6)).toBe(2); // first of 6–10
    expect(gain(10)).toBe(2);
    expect(gain(11)).toBe(3); // first of 11–15
    expect(gain(15)).toBe(3);
    expect(gain(16)).toBe(4); // first of 16–20
    expect(gain(20)).toBe(4);
    expect(gain(21)).toBe(5); // 21+ caps at +5
    expect(gain(30)).toBe(5);
  });

  it("summon gold climbs on the SAME bracket curve as magic, not with the round", () => {
    // It was min(round, 10) once — round 12 handed over 10 for nothing. Then it
    // was a flat 1 forever, which left a long game unable to replace a body.
    // Now both pools take the five-round bracket, and the home-slot bonus is
    // what still makes gold positional.
    const s = freshGame(9);
    s.phase = "resource";
    s.round = 12;
    s.players.P1.gold = 0;
    s.players.P1.magicPool = 3;
    const next = advance(s);
    // Empty board: the bracket alone, no slots held. Not the round number (12).
    expect(next.players.P1.gold).toBe(poolGainForRound(12)); // 3, not 1 and not 12
    expect(next.players.P1.magicPool).toBe(6); // 3 + the same 3
    expect(poolGainForRound(12)).toBe(3);
  });

  it("gold and magic grant the same base, bracket for bracket", () => {
    // A cost-1 card in hand so the round is worth playing: an empty board with
    // nothing affordable rolls straight into the NEXT round, which would move
    // the grant out from under the assertion.
    for (const [round, expected] of
         [[1, 1], [5, 1], [6, 2], [10, 2], [11, 3], [15, 3], [16, 4], [20, 4], [21, 5], [40, 5]] as const) {
      const s = freshGame(9);
      s.phase = "resource";
      s.round = round;
      s.players.P1.gold = 0;
      s.players.P1.magicPool = 0;
      giveHand(s, "P1", "pyro_bbq");
      const next = advance(s);
      // Empty board, so gold is the base with no home-slot bonus on top.
      expect({ round, gold: next.players.P1.gold, magic: next.players.P1.magicPool })
        .toEqual({ round, gold: expected, magic: expected });
    }
  });

  it("magic starts at 0 and drips +1 on round 1", () => {
    const s = freshGame(9);
    expect(s.players.P1.magicPool).toBe(0);
    s.phase = "resource";
    s.round = 1;
    // A cost-1 card in hand so the round is worth playing: an empty board with
    // nothing affordable now rolls straight into the next round, and this test
    // is about the GRANT, not about that skip.
    giveHand(s, "P1", "pyro_bbq");
    const next = advance(s);
    expect(next.players.P1.magicPool).toBe(1); // 0 + round-1 bracket (+1)
    expect(next.players.P1.gold).toBe(1);
  });

  it("both pools cap carryover at 10 before the gain", () => {
    const s = freshGame(9);
    s.phase = "resource";
    s.round = 3;
    s.players.P1.gold = 14; // carryover clamps to 10
    s.players.P1.magicPool = 14;
    const next = advance(s);
    expect(next.players.P1.gold).toBe(10 + poolGainForRound(3)); // clamped, then the bracket grant
    expect(next.players.P1.magicPool).toBe(11);
  });

  it("prep initiative alternates each round (odd = coin-flip winner)", () => {
    const first = (round: number) => {
      const s = freshGame(9);
      s.firstPlayer = "P1";
      s.phase = "resource";
      s.round = round;
      giveHand(s, "P1", "pyro_bbq"); // see above — keeps round 1 from being skipped
      return advance(s).prep?.priority;
    };
    expect(first(1)).toBe("P1"); // odd → coin-flip winner
    expect(first(2)).toBe("P2"); // even → the opponent
    expect(first(3)).toBe("P1");
  });

  it("the pools never drain each other", () => {
    const s = freshGame(9);
    s.players.P1.mulliganDone = true;
    s.players.P2.mulliganDone = true;
    s.round = 4;
    s.phase = "prep";
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    s.players.P1.gold = 5;
    s.players.P1.magicPool = 5;
    const handId = giveHand(s, "P1", "leaf_greegon"); // cost 3
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(next.players.P1.gold).toBe(2);
    expect(next.players.P1.magicPool).toBe(5); // untouched
  });
});

describe("board size lives on the state", () => {
  it("defaults to 4x4", () => {
    const s = createInitialState(1);
    expect(s.boardSize).toBe(4);
    expect(s.slots.length).toBe(4);
    expect(s.slots.every((r) => r.length === 4)).toBe(true);
  });

  it("a 5x5 match really is 5x5 — slots and bounds both follow the state", () => {
    const s = createInitialState(1, "leaf_pyro", "bore_dusk", ["P1"], undefined, undefined, 5);
    expect(s.boardSize).toBe(5);
    expect(s.slots.length).toBe(5);
    expect(s.slots.every((r) => r.length === 5)).toBe(true);
  });

  it("homeRow follows the board: P1 defends the far edge, P2 always row 0", () => {
    // The bug this replaced: a hardcoded 0|3 put P1's home in the MIDDLE of a
    // 5x5 and left the last row as dead ground nothing could summon into.
    expect(homeRow("P2", 4)).toBe(0);
    expect(homeRow("P1", 4)).toBe(3);
    expect(homeRow("P2", 5)).toBe(0);
    expect(homeRow("P1", 5)).toBe(4);
  });

  it("column 4 is summonable on a 5x5 and rejected on a 4x4", () => {
    // The real proof the refactor bites: the column bound is read from
    // state.boardSize, not from a module constant. Col 4 does not exist on the
    // standard board and must still be refused there.
    const arm = (size: number) => {
      const s = createInitialState(1, "leaf_pyro", "bore_dusk", ["P1"], undefined, undefined, size);
      s.players.P1.mulliganDone = true;
      s.players.P2.mulliganDone = true;
      s.round = 1;
      s.phase = "prep";
      s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
      s.players.P1.gold = 9;
      const handId = `h${s.nextId++}`;
      s.players.P1.hand.push({ handId, defId: "leaf_greegon" });
      return { s, handId };
    };
    const big = arm(5);
    expect(canSummon(big.s, "P1", big.handId, 4).ok).toBe(true);
    const std = arm(4);
    expect(canSummon(std.s, "P1", std.handId, 4).ok).toBe(false);
  });
});

describe("rarity floor: a Special is an epic-and-up privilege", () => {
  it("no RARE card carries a Special — talents excepted", () => {
    // Design rule, not a mechanic: rarity is cosmetic (Deck Builder sorting and
    // a badge), so nothing enforces this at runtime and a rare could quietly
    // ship with a Special again. A TALENT is deliberately exempt — it costs 0,
    // fires free exactly once per game and is then spent, which is a different
    // thing from a repeatable Special even though it rides the same field.
    const offenders = CARDS.filter(
      (c) => c.rarity === "rare" && c.special && !c.special.talent,
    ).map((c) => `${c.id} (${c.special!.name})`);
    expect(offenders, `rare cards with a Special:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  it("the talent exemption stays narrow", () => {
    // If this count climbs, "talents are exempt" has quietly become a loophole
    // for putting Specials on rares. (Alpha used to be the one user; it's back
    // to Epic with a repeatable Takedown, so the exemption is currently unused —
    // rares that want a one-shot use the dedicated `talent` field instead.)
    const talents = CARDS.filter((c) => c.rarity === "rare" && c.special?.talent);
    expect(talents.length, `rares using special.talent:\n  ${talents.map((c) => c.id).join("\n  ")}`).toBeLessThanOrEqual(1);
  });
});

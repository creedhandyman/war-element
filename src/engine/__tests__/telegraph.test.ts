// THE BOSS TELEGRAPH.
//
// The load-bearing test in this file is "nothing is damaged outside the red".
// The countdown is easy and the zone is not: three of the seven boss handlers
// ignore the target list they are handed and pick their own victims, so a
// telegraph built on one generic answer would have quietly under-reported for
// the three bosses whose reach is hardest to eyeball. Rather than trusting the
// prediction to keep matching the handlers, the sweep at the bottom FIRES every
// boss Special for real and compares the wreckage to the lit cells.
import { describe, expect, it } from "vitest";
import { CARDS, getDef } from "../../data/cards";
import { bossTelegraphs, telegraphBlast, TELEGRAPHED_HANDLERS } from "../telegraph";
import { applyStatus, fireCardSpecial } from "../combat";
import { boardCards } from "../state";
import { advance } from "../phases";
import { bigPrepState, place, atCleanup } from "./helpers";

/** The clock's period. Every boss on the tower shares it, and the tests below
 *  read it rather than hard-coding 3 so a re-tune moves them with it. */
const N = getDef("boss_rotroot").roundTick!.fireSpecialEveryN!;

function tele(s: ReturnType<typeof bigPrepState>, id: string) {
  return bossTelegraphs(s).find((t) => t.bossId === id)!;
}

describe("the boss clock is readable", () => {
  it("counts DOWN to the beat, and reads 0 on the round it lands", () => {
    const s = bigPrepState();
    const boss = place(s, "boss_rotroot", "P2", 0, 2);
    const seen: number[] = [];
    for (let r = 1; r <= N * 2; r++) {
      s.round = r;
      seen.push(tele(s, boss.instanceId).roundsUntil);
    }
    // 2, 1, 0 — then the same again. The 0 is the round the player is standing
    // in when it goes off at Cleanup, which is the last turn they can move.
    expect(seen.slice(0, N)).toEqual([N - 1, N - 2, 0].slice(0, N));
    expect(seen.slice(N), "and it repeats").toEqual(seen.slice(0, N));
  });

  it("the round it reads 0 is the round it actually fires", () => {
    // Not asserted from the arithmetic — asserted by running the engine and
    // watching the damage land. An off-by-one here would be worse than no
    // telegraph at all: it would move the player INTO the blast.
    for (let r = 1; r <= N; r++) {
      const s = bigPrepState();
      s.round = r;
      const boss = place(s, "boss_rotroot", "P2", 0, 2);
      const foe = place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 90, maxHp: 90, curShields: 0 });
      const said = tele(s, boss.instanceId).roundsUntil;
      const after = advance(atCleanup(s));
      const hurt = after.cards[foe.instanceId].curHp < 90;
      expect(hurt, `round ${r}: countdown said ${said}`).toBe(said === 0);
    }
  });

  it("does not cry NOW at a board where nothing has happened yet", () => {
    // `state.round` is 0 through the mulligan and the opening draw, and 0 % N is
    // 0 — so the countdown announced an imminent blast on the very first screen
    // of every boss fight, before a single round had run. Found by looking at
    // the board rather than by any assertion here, which is why this one exists:
    // the loop above started counting at round 1 and never saw it.
    const s = bigPrepState();
    s.round = 0;
    const boss = place(s, "boss_rotroot", "P2", 0, 2);
    place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 90, maxHp: 90, curShields: 0 });
    expect(tele(s, boss.instanceId).roundsUntil, "counts from the first real round").toBe(N - 1);
    expect(telegraphBlast(s, "P1"), "and lights nothing").toEqual([]);
  });

  it("no clock at all in an ordinary match", () => {
    const s = bigPrepState();
    place(s, "leaf_stickviper", "P1", 2, 2);
    place(s, "dusk_gool", "P2", 1, 1);
    expect(bossTelegraphs(s), "nothing outside the tower keeps a beat").toEqual([]);
  });

  it("a dead boss keeps no clock", () => {
    const s = bigPrepState();
    const boss = place(s, "boss_rotroot", "P2", 0, 2, { curHp: 0 });
    expect(bossTelegraphs(s).some((t) => t.bossId === boss.instanceId)).toBe(false);
  });
});

describe("the blast zone", () => {
  it("lights only what is in REACH — the radius is the whole point", () => {
    // Rotroot's volley is "within 2 spaces". Before the auto-fire path was
    // fixed it hit the whole board, and a telegraph drawn from the old
    // behaviour would light the whole board too.
    const s = bigPrepState();
    s.round = N;
    const boss = place(s, "boss_rotroot", "P2", 0, 2);
    const near = place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 90, maxHp: 90, curShields: 0 });
    const far = place(s, "leaf_stickviper", "P1", 4, 0, { curHp: 90, maxHp: 90, curShields: 0 });
    const cells = tele(s, boss.instanceId).cells;
    expect(cells, "the one it can reach").toContainEqual(near.pos);
    expect(cells, "and not the one it cannot").not.toContainEqual(far.pos);
  });

  it("a LANE boss lights its column and stops at the gap", () => {
    // battleCharge ploughs a contiguous run. A card behind a hole in the line
    // is genuinely safe, and lighting it would train the player to move cards
    // out of squares that were never in danger.
    const s = bigPrepState();
    s.round = N;
    const boss = place(s, "boss_kato", "P2", 0, 2);
    const first = place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 90, maxHp: 90, curShields: 0 });
    const behindGap = place(s, "leaf_stickviper", "P1", 3, 2, { curHp: 90, maxHp: 90, curShields: 0 });
    const aside = place(s, "leaf_stickviper", "P1", 1, 0, { curHp: 90, maxHp: 90, curShields: 0 });
    const cells = tele(s, boss.instanceId).cells;
    expect(cells).toContainEqual(first.pos);
    expect(cells, "the run broke before it").not.toContainEqual(behindGap.pos);
    expect(cells, "and it never leaves the column").not.toContainEqual(aside.pos);
  });

  it("a board-wide SMITE lights the whole board, reach or not", () => {
    const s = bigPrepState();
    s.round = N;
    const boss = place(s, "boss_umbranova", "P2", 0, 2);
    const near = place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 90, maxHp: 90, curShields: 0 });
    const far = place(s, "leaf_stickviper", "P1", 4, 0, { curHp: 90, maxHp: 90, curShields: 0 });
    const cells = tele(s, boss.instanceId).cells;
    expect(cells, "meteors do not care where you stand").toContainEqual(near.pos);
    expect(cells).toContainEqual(far.pos);
  });

  it("the FRAIL-only freeze lights only the frail", () => {
    // Permafrost answers to healing. A zone that lit healthy cards would hide
    // the one thing the player is supposed to notice about this fight.
    const s = bigPrepState();
    s.round = N;
    const boss = place(s, "boss_permafrost", "P2", 0, 2);
    const under = Number(getDef("boss_permafrost").special!.params!.underHp ?? 4);
    const weak = place(s, "leaf_stickviper", "P1", 2, 2, { curHp: under, maxHp: 90, curShields: 0 });
    const healthy = place(s, "leaf_stickviper", "P1", 2, 3, { curHp: 90, maxHp: 90, curShields: 0 });
    const cells = tele(s, boss.instanceId).cells;
    expect(cells).toContainEqual(weak.pos);
    expect(cells, "heal it and it leaves the zone").not.toContainEqual(healthy.pos);
  });

  it("a SPAWN keeps its countdown but draws no blast", () => {
    const s = bigPrepState();
    s.round = N;
    const boss = place(s, "boss_overclock", "P2", 0, 2);
    place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 90, maxHp: 90, curShields: 0 });
    const t = tele(s, boss.instanceId);
    expect(t.roundsUntil, "the tide is still worth counting").toBe(0);
    expect(t.cells, "but nothing is about to be hit").toEqual([]);
  });

  it("says how many of the lit squares it actually strikes", () => {
    // Nightshrike reaches everything and hits two of them. Lighting five
    // squares while claiming five deaths would be its own kind of lie.
    const s = bigPrepState();
    s.round = N;
    const boss = place(s, "boss_nightshrike", "P2", 0, 2);
    for (let c = 0; c < 4; c++)
      place(s, "leaf_stickviper", "P1", 1, c, { curHp: 90, maxHp: 90, curShields: 0 });
    const t = tele(s, boss.instanceId);
    expect(t.cells.length, "everything is in reach").toBeGreaterThan(2);
    expect(t.strikes, "two of them go down").toBe(Number(getDef("boss_nightshrike").special!.params!.targets));
  });

  it("the gate screens what stands behind it — the zone inherits that", () => {
    const s = bigPrepState();
    s.round = N;
    const boss = place(s, "boss_hoarfell", "P2", 0, 2);
    place(s, "void_fortress_gate_tok", "P1", 3, 2);
    const screened = place(s, "leaf_stickviper", "P1", 4, 2, { curHp: 90, maxHp: 90, curShields: 0 });
    expect(tele(s, boss.instanceId).cells,
      "behind the wall is behind the wall").not.toContainEqual(screened.pos);
  });
});

describe("what the player sees lit", () => {
  it("lights nothing until the firing round", () => {
    const s = bigPrepState();
    const boss = place(s, "boss_rotroot", "P2", 0, 2);
    place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 90, maxHp: 90, curShields: 0 });
    s.round = N - 1;
    expect(telegraphBlast(s, "P1"), "a round out — counted, not lit").toEqual([]);
    s.round = N;
    expect(telegraphBlast(s, "P1").length, "and lit on the round it lands").toBeGreaterThan(0);
    void boss;
  });

  it("goes dark when the boss is SILENCED through the beat", () => {
    // MUTE is one of the answers this mode is built to reward. A player who
    // spends one has to be able to see that they bought the round.
    const s = bigPrepState();
    s.round = N;
    const boss = place(s, "boss_rotroot", "P2", 0, 2);
    place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 90, maxHp: 90, curShields: 0 });
    applyStatus(s, s.cards[boss.instanceId], "MUTED", 2, 0, "DUSK");
    expect(tele(s, boss.instanceId).silenced).toBe(true);
    expect(telegraphBlast(s, "P1"), "the beat is skipped").toEqual([]);
  });

  it("a MUTE that expires first buys NOTHING, and does not pretend to", () => {
    // Cleanup ticks statuses BEFORE it runs the boss clock, so one round of
    // MUTE is already gone when the Special fires. The telegraph has to agree
    // with that ordering or it hands out false safety.
    const s = bigPrepState();
    s.round = N;
    const boss = place(s, "boss_rotroot", "P2", 0, 2);
    const foe = place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 90, maxHp: 90, curShields: 0 });
    applyStatus(s, s.cards[boss.instanceId], "MUTED", 1, 0, "DUSK");
    expect(tele(s, boss.instanceId).silenced, "one round is not enough").toBe(false);
    const after = advance(atCleanup(s));
    expect(after.cards[foe.instanceId].curHp, "and it fires anyway").toBeLessThan(90);
  });

  it("does not light the viewer's own boss at them", () => {
    const s = bigPrepState();
    s.round = N;
    const boss = place(s, "boss_rotroot", "P1", 4, 2);
    place(s, "dusk_gool", "P2", 3, 2, { curHp: 90, maxHp: 90, curShields: 0 });
    expect(telegraphBlast(s, "P1"), "it is aimed the other way").toEqual([]);
    void boss;
  });
});

describe("the telegraph never under-reports", () => {
  const BOSSES = CARDS.filter((c) => c.boss && c.roundTick?.fireSpecialEveryN && c.special);

  it("covers every handler the live roster uses", () => {
    for (const b of BOSSES)
      expect(TELEGRAPHED_HANDLERS, `${b.id} fires a ${b.special!.handler}`)
        .toContain(b.special!.handler);
  });

  it("every boss on the tower keeps a clock", () => {
    // A boss without one would be a Special that never fires: `canFireSpecial`
    // refuses the manual cast, so the beat is the only door.
    const missing = CARDS.filter((c) => c.boss && c.special && !c.roundTick?.fireSpecialEveryN);
    expect(missing.map((c) => c.id), "no boss is left mute").toEqual([]);
  });

  for (const b of BOSSES) {
    it(`${b.id}: nothing is hurt outside the lit squares`, () => {
      // A crowded board, so a zone that is too small has somewhere to be wrong:
      // bodies at every range, in and out of the boss's column, in front of and
      // behind the home-row screen.
      const s = bigPrepState();
      s.round = N;
      const boss = place(s, b.id, "P2", 0, 2);
      const foes = [
        [1, 2], [1, 0], [2, 2], [2, 4], [3, 1], [3, 3], [4, 2], [4, 4],
      ].map(([r, c]) => place(s, "leaf_stickviper", "P1", r, c, {
        // Low enough that Permafrost's HP line catches some of them, high
        // enough that nothing dies and moves out from under the comparison.
        curHp: 40, maxHp: 40, curShields: 0,
      }));
      const before = Object.fromEntries(foes.map((f) => [f.instanceId, {
        hp: s.cards[f.instanceId].curHp, st: s.cards[f.instanceId].statuses.length,
      }]));
      const lit = new Set(tele(s, boss.instanceId).cells.map((c) => `${c.row},${c.col}`));
      // Positions BEFORE the cast: a card shoved or swapped mid-Special is
      // read where it stood when the player looked at the board, which is the
      // square the telegraph promised them.
      const where = Object.fromEntries(foes.map((f) => [f.instanceId, { ...f.pos! }]));
      fireCardSpecial(s, s.cards[boss.instanceId]);
      for (const f of foes) {
        const now = s.cards[f.instanceId];
        if (!now) continue;
        const touched = now.curHp < before[f.instanceId].hp || now.statuses.length > before[f.instanceId].st;
        if (!touched) continue;
        const p = where[f.instanceId];
        expect(lit.has(`${p.row},${p.col}`),
          `${b.id} hit (${p.row},${p.col}) without lighting it`).toBe(true);
      }
    });
  }

  it("and the sweep is actually exercising the bosses", () => {
    // Guards the guard: if the fixture stopped producing damage the loop above
    // would pass vacuously on an empty board.
    let anyHit = 0;
    for (const b of BOSSES) {
      const s = bigPrepState();
      s.round = N;
      const boss = place(s, b.id, "P2", 0, 2);
      const foe = place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 40, maxHp: 40, curShields: 0 });
      fireCardSpecial(s, s.cards[boss.instanceId]);
      const now = s.cards[foe.instanceId];
      if (!now || now.curHp < 40 || now.statuses.length > 0) anyHit++;
    }
    expect(anyHit, "most of the tower does something to a body in front of it")
      .toBeGreaterThan(BOSSES.length / 2);
  });

  it("boards with no enemies produce empty zones, not crashes", () => {
    for (const b of BOSSES) {
      const s = bigPrepState();
      s.round = N;
      const boss = place(s, b.id, "P2", 0, 2);
      expect(tele(s, boss.instanceId).cells, `${b.id} on an empty board`).toEqual([]);
    }
    expect(boardCards(bigPrepState()).length, "sanity").toBe(0);
  });
});

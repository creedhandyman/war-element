// Jetstream gives +3 SP every turn it runs (owner, 2026-10-04): +3 on the
// cast, then +3 at each Cleanup the field will still be up for — +3, +6, +9
// over its three rounds, kept for good. Measured against the same board
// without the field, so Zephyr's own +2 a round cancels out.
import { describe, expect, it } from "vitest";
import { CARDS } from "../../data/cards";
import { advance, applyIntent } from "../phases";
import { GALE_SP_CAP } from "../auras";
import { effectiveSp } from "../state";
import type { GameState } from "../types";
import { atCleanup, place, prepState } from "./helpers";

function run(withField: boolean, cleanups: number) {
  let s: GameState = prepState();
  s.players.P1.spellbook = [{ defId: "gale_jetstream", used: false }];
  s.players.P1.magicPool = 20;
  // The slowest GALE card, so neither run reaches the SP cap inside the test.
  const slow = CARDS.filter((c) => c.element === "GALE").sort((a, b) => a.sp - b.sp)[0];
  const bird = place(s, slow.id, "P1", 3, 0);
  s.cards[bird.instanceId].spBonus = 0;
  if (withField) s = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "gale_jetstream" });
  for (let i = 0; i < cleanups; i++) s = advance(atCleanup(s));
  return { sp: effectiveSp(s, s.cards[bird.instanceId]), fields: s.fields.filter((f) => f.spellId === "gale_jetstream").length };
}

describe("Jetstream", () => {
  it("builds +3, +6, +9 over its three rounds and keeps it", () => {
    const gain = (n: number) => run(true, n).sp - run(false, n).sp;
    expect(gain(0), "on the cast").toBe(3);
    expect(gain(1), "after round 1").toBe(6);
    expect(gain(2), "after round 2").toBe(9);
    expect(gain(3), "the field is gone but the speed stays").toBe(9);
    expect(run(true, 3).fields, "the field has faded").toBe(0);
  });

  it("never lifts a card past the SP cap", () => {
    let s: GameState = prepState();
    s.players.P1.spellbook = [{ defId: "gale_jetstream", used: false }];
    s.players.P1.magicPool = 20;
    const fast = place(s, "gale_duster", "P1", 3, 0);
    s = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "gale_jetstream" });
    for (let i = 0; i < 6; i++) s = advance(atCleanup(s));
    expect(effectiveSp(s, s.cards[fast.instanceId])).toBeLessThanOrEqual(GALE_SP_CAP);
  });
});

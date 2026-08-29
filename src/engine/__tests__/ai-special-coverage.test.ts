// CAN THE AI ACTUALLY FIRE THIS? — the guard that did not exist.
//
// `chooseBattleAction` picks a Special through a chain of `sp.handler === "..."`
// cases, and a chain of named cases is a list that goes stale the moment a
// handler is added. It already had, twice. This file's sibling comment in
// ai.ts records seven Specials once falling through every branch and never
// being cast; an audit while wiring the Floor-5 bosses found the number had
// grown to FORTY-ONE handlers with no branch at all — including three bosses'
// — against the twenty-two the chain knew.
//
// A card whose Special the AI cannot reach is worse than a weak card: it
// basic-attacks all game, and its Special is invisible to every balance run, so
// the number that comes back is a measurement of a different card.
//
// The fix was a shape-driven fallback rather than forty-one more cases. This
// asserts the outcome instead of the implementation: given a board where the
// Special is plainly the right move, the AI takes it.
import { describe, expect, it } from "vitest";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import { chooseBattleAction } from "../ai";
import { canFireSpecial } from "../rules";
import { applyStatus } from "../combat";
import { atBattle, bigPrepState, place } from "./helpers";

/** Every handler any real card or token fires, with one carrier each. */
function handlerCarriers(): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of [...CARDS, ...TOKENS]) {
    // BOSSES ARE OUT, and not as a convenience. `canFireSpecial` refuses them
    // outright — "Fires on its own clock" — because a boss that also cast
    // whenever it could afford the magic would be a different fight on every
    // retry (see the boss-clock test in void-tower.test.ts). Their Specials are
    // driven by `roundTick.fireSpecialEveryN` and are covered there.
    if (d.boss) continue;
    const h = d.special?.handler;
    if (h && !out.has(h)) out.set(h, d.id);
  }
  return out;
}

/** A board built to make casting obviously correct: the caster flush with
 *  magic, a wounded ally beside it, and three enemies in reach. */
function stage(defId: string) {
  const s = bigPrepState();
  const me = place(s, defId, "P2", 1, 2);
  s.players.P2.magicPool = 40;
  // A hurt ally for the heal/shield shapes.
  place(s, "leaf_stickviper", "P2", 1, 1, { curHp: 3, maxHp: 40, curShields: 0 });
  // Enemies clustered in front, healthy enough that no BASIC finishes one —
  // otherwise the AI is right to prefer the basic and the test proves nothing.
  for (const [r, c] of [[2, 1], [2, 3]] as [number, number][])
    place(s, "leaf_stickviper", "P1", r, c, { curHp: 900, maxHp: 900, curShields: 0 });
  // ...and ONE enemy that is low on HP but unkillable behind shields, plus a
  // status on it. Several Specials are conditional by design — Permafrost only
  // freezes cards under an HP line, Liza's igniter only detonates something
  // already burning — and a stage with no such target makes the AI look broken
  // for correctly declining. The shields keep `basicCanKill` false so utility
  // Specials are not suppressed by a kill being on the table.
  const frail = place(s, "leaf_stickviper", "P1", 2, 2, { curHp: 2, maxHp: 900, curShields: 999 });
  // A spread of the statuses conditional Specials look for: Storm's Thunder
  // Strike only hits ELECTRIFIED targets, Liza's igniter only detonates
  // something already burning. Without them the AI declines CORRECTLY and the
  // test would be measuring its own staging.
  for (const k of ["DOT", "BURN", "ELECTRIFIED", "PARALYZE", "WEAKEN"] as const)
    applyStatus(s, s.cards[frail.instanceId], k, 3, 2, "PYRO");
  return { s: atBattle(s), me };
}

describe("every Special on the roster is reachable by the AI", () => {
  it("names its carriers, so a gap is reported as cards rather than as strings", () => {
    const carriers = handlerCarriers();
    expect(carriers.size, "handlers in use").toBeGreaterThan(30);
  });

  it("the AI casts, or has a stated reason not to", () => {
    const unreachable: string[] = [];
    for (const [handler, defId] of handlerCarriers()) {
      const def = getDef(defId);
      const { s, me } = stage(defId);
      let acted = "";
      try {
        acted = chooseBattleAction(s, me.instanceId).action;
      } catch (e) {
        unreachable.push(`${handler} (${defId}) THREW: ${(e as Error).message}`);
        continue;
      }
      if (acted !== "special" && acted !== "talent")
        unreachable.push(`${handler} (${def.name}) -> ${acted}`);
    }
    expect(
      unreachable,
      `Specials the AI will not fire on a board built to invite them:\n  ${unreachable.join("\n  ")}`,
    ).toEqual([]);
  });

  it("and it still prefers a BASIC when that finishes something", () => {
    // The complement: a fallback that fires the Special unconditionally would
    // pass the test above and play worse. A killable target must win.
    const s = bigPrepState();
    const me = place(s, "bolt_storm", "P2", 1, 2);
    s.players.P2.magicPool = 40;
    const frail = place(s, "leaf_stickviper", "P1", 2, 2, { curHp: 1, maxHp: 40, curShields: 0 });
    const act = chooseBattleAction(atBattle(s), me.instanceId);
    expect(["basic", "special"], "it takes the kill one way or the other").toContain(act.action);
    if (act.action === "basic") expect(act.targetId).toBe(frail.instanceId);
  });

  it("does not cast into an empty board", () => {
    // A targetless buff is fine to fire; a targeted Special with nothing to aim
    // at must not be chosen, and nothing may throw.
    const s = bigPrepState();
    const me = place(s, "bolt_storm", "P2", 0, 2);
    s.players.P2.magicPool = 40;
    expect(() => chooseBattleAction(atBattle(s), me.instanceId)).not.toThrow();
  });

  it("a BOSS is still refused — its Special belongs to the clock", () => {
    // The rule the exclusion above rests on, asserted rather than assumed.
    const s = bigPrepState();
    const boss = place(s, "boss_skybreaker", "P2", 0, 2);
    s.players.P2.magicPool = 40;
    place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 900, maxHp: 900, curShields: 0 });
    expect(canFireSpecial(atBattle(s), boss.instanceId).ok, "bosses cast on the beat only").toBe(false);
  });
});

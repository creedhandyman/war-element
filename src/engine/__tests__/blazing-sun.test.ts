// Blazing Sun — "your DAWN allies heal 2 HP each round, cannot miss, and can
// see and target STEALTH cards."
//
// Reported as broken: "they still missed". The never-miss half works and always
// did. What did not work was any way to KNOW it works — the branches that would
// have made the card whiff simply do not run, so nothing is logged, and the card
// goes on wearing its BLIND pip looking exactly like one about to miss. From the
// player's chair, a promise kept in total silence is a promise broken.
//
// The other half of that report is real and is not a bug: the field covers DAWN
// allies ONLY, so a mixed squad keeps missing with everything else. That is
// pinned below too, because it is the thing worth reading the card for.
import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { basicAttack } from "../combat";
import { place, prepState } from "./helpers";
import { canTarget } from "../rules";
import { createInitialState } from "../state";
import type { GameState } from "../types";

const BLIND = { kind: "BLIND" as const, duration: 3, power: 0, source: "DUSK" as const };

function withSun(s: GameState): GameState {
  s.players.P1.magicPool = 20;
  s.players.P1.spellbook = [{ defId: "dawn_blazing_sun", used: false }] as never;
  return applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "dawn_blazing_sun" } as never);
}

/** Full misses across `n` seeded swings by a BLINDed attacker. */
function misses(attacker: string, sun: boolean, n = 200): number {
  let out = 0;
  for (let i = 0; i < n; i++) {
    const s = prepState(i * 13 + 5);
    const me = place(s, attacker, "P1", 3, 0, { status: BLIND });
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 900, maxHp: 900, curShields: 0 });
    const g = sun ? withSun(s) : s;
    const before = g.cards[foe.instanceId].curHp;
    basicAttack(g, me.instanceId, foe.instanceId);
    if (g.cards[foe.instanceId].curHp === before) out++;
  }
  return out;
}

describe("Blazing Sun", () => {
  it("a BLINDed DAWN ally under the field never misses", () => {
    // The control matters as much as the case: without it a zero here could
    // just mean BLIND is not landing at all.
    expect(misses("dawn_star", false), "BLIND does cost hits normally").toBeGreaterThan(10);
    expect(misses("dawn_star", true), "and none of them under the sun").toBe(0);
  });

  it("does nothing for a NON-DAWN ally, which is what the card says", () => {
    // "your DAWN allies". A mixed squad keeps missing with the rest of it, and
    // that is the likeliest thing behind a report that the spell did not work.
    const off = misses("leaf_alpha", false);
    expect(off, "LEAF misses without").toBeGreaterThan(0);
    expect(misses("leaf_alpha", true), "and misses identically with").toBe(off);
  });

  it("says so in the log when it saves a swing", () => {
    const s = prepState(11);
    const me = place(s, "dawn_star", "P1", 3, 0, { status: BLIND });
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 900, maxHp: 900, curShields: 0 });
    const g = withSun(s);
    basicAttack(g, me.instanceId, foe.instanceId);
    expect(g.log.some((l) => /strikes true/.test(l))).toBe(true);
    expect(g.cards[me.instanceId].fxNeverMiss, "and floats it over the token").toBe(1);
  });

  it("stays quiet when there was nothing to shrug off", () => {
    // A line on every swing under the field would be noise, and would stop
    // meaning anything on the swing that mattered.
    const s = prepState(11);
    const me = place(s, "dawn_star", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 900, maxHp: 900, curShields: 0 });
    const g = withSun(s);
    basicAttack(g, me.instanceId, foe.instanceId);
    expect(g.log.some((l) => /strikes true/.test(l))).toBe(false);
    expect(g.cards[me.instanceId].fxNeverMiss ?? 0).toBe(0);
  });

  it("leaves the BLIND itself alone — it ignores the status, it does not cure it", () => {
    // Worth stating, because this is exactly what makes the effect look broken:
    // the pip is still there. Curing it is Awakening's job, and Purelight's.
    const s = prepState(11);
    const me = place(s, "dawn_star", "P1", 3, 0, { status: BLIND });
    const g = withSun(s);
    expect(g.cards[me.instanceId].statuses.some((st) => st.kind === "BLIND")).toBe(true);
  });
  // ── the OTHER half of the card, which had no coverage at all ─────────────
  it("sees STEALTH when it is CAST, for DAWN allies only", () => {
    // Reported as "not allowing targeting of stealth opponents". Cast, it does:
    // the control (no field) proves the STEALTH block is real, so the `true`
    // below is the field lifting it rather than STEALTH never applying.
    const stealthy = "leaf_darth";
    const canSee = (attacker: string, sun: boolean) => {
      const s = prepState(7);
      const me = place(s, attacker, "P1", 3, 0);
      const foe = place(s, stealthy, "P2", 2, 0, { curHp: 90, maxHp: 90 });
      const g = sun ? withSun(s) : s;
      return canTarget(g, g.cards[me.instanceId], g.cards[foe.instanceId], true);
    };
    expect(canSee("dawn_beam", false), "STEALTH blocks a DAWN ally with no field").toBe(false);
    expect(canSee("dawn_beam", true), "and the cast field lifts it").toBe(true);
    // "your DAWN allies" — the same field does nothing for anybody else.
    expect(canSee("leaf_greegon", true), "a LEAF ally under the same sun still cannot see it").toBe(false);
  });

  it("does NOT see STEALTH as standing terrain, which is the rule not a bug", () => {
    // DAWN's region terrain IS Blazing Sun, and terrain deliberately drops every
    // FLAG (see `terrainBuff`): permanent see-through-STEALTH in every DAWN node
    // is a rule change rather than a battlefield. Only the 6-magic cast grants
    // it. Pinned because it reads exactly like the bug above from a chair.
    const s = createInitialState(7, ["dawn_beam"], ["leaf_darth"], [], undefined, undefined, 4,
      undefined, "dawn_blazing_sun");
    expect(s.fields.length, "terrain is standing").toBeGreaterThan(0);
    for (const f of s.fields)
      expect((f as unknown as Record<string, unknown>).seeStealth, "terrain carries no flags").toBeFalsy();
  });
});

// Prestige's Now You Don't (owner's call, 2026-09-27): a basic on a MUTED
// target hits twice as hard AND STUNs it for a round as well. Sleight of Hand,
// the Special that MUTEs, is unchanged.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { describePassives } from "../../ui/card-text";
import { applyIntent } from "../phases";
import { place, prepState, statusOf } from "./helpers";
import type { GameState } from "../types";

const MUTED = { kind: "MUTED", duration: 2, power: 0 } as never;

/** Prestige at (3,1) swings once at a LEAF body at (1,1). */
function swing(targetMuted: boolean) {
  const s = prepState();
  const prestige = place(s, "dusk_prestige", "P1", 3, 1);
  const foe = place(s, "leaf_alpha", "P2", 1, 1, {
    curHp: 40, maxHp: 40, curShields: 0, ...(targetMuted ? { status: MUTED } : {}),
  });
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [prestige.instanceId], index: 0, awaitingInput: prestige.instanceId };
  const n: GameState = applyIntent(s, {
    type: "BATTLE_ACTION", player: "P1", action: "basic", targetId: foe.instanceId,
  } as never);
  return n.cards[foe.instanceId];
}

describe("Now You Don't", () => {
  it("a MUTED target takes double and is STUNNED for a round", () => {
    const hit = swing(true);
    expect(hit.curHp, "6 doubled").toBe(40 - 12);
    expect(statusOf(hit, "STUN")?.duration).toBe(1);
  });

  it("an unmuted target takes the plain hit and is not stunned", () => {
    const hit = swing(false);
    expect(hit.curHp).toBe(40 - 6);
    expect(statusOf(hit, "STUN")).toBeUndefined();
  });

  it("the card says so, and Sleight of Hand is unchanged", () => {
    const def = getDef("dusk_prestige");
    expect(def.vsStatus).toMatchObject({ status: "MUTED", dmgMult: 2, inflict: { kind: "STUN", duration: 1 } });
    expect(describePassives(def).join(" | ")).toContain(
      "Now You Don't — Vs MUTED targets, basics gain ×2 DMG, and STUN it for 1 round.",
    );
    expect(def.special!.text).toBe("MUTE up to 2 opponents for 2 rounds and WEAKEN them.");
  });
});

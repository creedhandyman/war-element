// Kloud's storm is raised at HALF strength (statScale 0.5), and everything it
// deals besides its basic — its Storm Surge splash included — is scaled in
// `resolveHit`, so the splash is 5. Skybreaker's own storm is full size and
// splashes 10. Pinned because the owner asked for 5 (2026-09-29) after being
// told, wrongly, that the splash call site skipped the scale.
import { describe, expect, it } from "vitest";
import { basicAttack } from "../combat";
import { place, prepState } from "./helpers";

const STORM = "gale_thundering_hurricane_tok";

function splashAt(scale: number | undefined): number {
  const s = prepState();
  const storm = place(s, STORM, "P1", 3, 1);
  if (scale != null) s.cards[storm.instanceId].statScale = scale;
  const target = place(s, "pyro_flamehound", "P2", 2, 1, { curHp: 900, maxHp: 900, curShields: 0 });
  const beside = place(s, "pyro_flamehound", "P2", 2, 2, { curHp: 900, maxHp: 900, curShields: 0 });
  basicAttack(s, storm.instanceId, target.instanceId);
  expect(900 - s.cards[target.instanceId].curHp, "the basic landed").toBeGreaterThan(0);
  return 900 - s.cards[beside.instanceId].curHp;
}

describe("the storm's splash follows its strength", () => {
  it("a half-strength storm splashes 5, a full one 10", () => {
    expect(splashAt(0.5)).toBe(5);
    expect(splashAt(undefined)).toBe(10);
  });
});

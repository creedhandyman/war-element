// A card that cannot move does not walk. Elephlora's Moving Forest marches it
// one slot every Cleanup; that gait used to run straight through ROOT.

import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import { atCleanup, place, prepState } from "./helpers";
import type { StatusKind } from "../types";

function rowAfterCleanup(status?: StatusKind): number {
  const s = prepState();
  const tree = place(s, "leaf_walking_tree", "P1", 3, 1, status
    ? { status: { kind: status, duration: 3, power: 1, source: "LEAF" } }
    : undefined);
  place(s, "leaf_alpha", "P2", 0, 0); // keep both boards non-empty
  const next = advance(atCleanup(s));
  return next.cards[tree.instanceId].pos!.row;
}

describe("self-walking gaits respect movement-stopping statuses", () => {
  it("a free Elephlora marches forward", () => {
    expect(rowAfterCleanup()).toBe(2);
  });
  for (const kind of ["ROOT", "FREEZE", "STUN", "PARALYZE", "SLEEP", "FRIGHTEN"] as const)
    it(`${kind} keeps it where it stands`, () => {
      expect(rowAfterCleanup(kind)).toBe(3);
    });
});

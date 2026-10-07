// A real deck opens on 1- and 2-drops. Story formations are built from power
// bands plus the muster (heaviest first), and used to field twelve bodies of
// cost 3+ on a late Landmark or Throne. `buildFormation` now keeps a floor of
// cheap cards; this pins it on every node of the campaign.

import { describe, expect, it } from "vitest";
import {
  CHEAP_COST, CHEAP_FLOOR_FROM_SIZE, CHEAP_FLOOR_MIN, CHEAP_SHARE, REGIONS,
  buildFormation, newSave,
} from "../../data/story";
import { getDef } from "../../data/cards";

// Wardens whose own authored roster already fills the whole squad: there is no
// slot left to add a cheap card to without cutting a card the node is FOR.
const ROSTER_FILLS_SQUAD = new Set(["W7", "W8"]);

describe("story formations keep a cheap end", () => {
  for (const tag of ["fresh", "late"] as const)
    it(`every node (${tag}) fields at least a quarter of its squad at cost ${CHEAP_COST} or less`, () => {
      const under: string[] = [];
      for (const r of REGIONS)
        for (const n of r.nodes) {
          const save = tag === "fresh"
            ? newSave()
            : { ...newSave(), cleared: r.nodes.filter((x) => x.id !== n.id).map((x) => x.id) };
          const f = buildFormation(save, r, n);
          if (f.length < CHEAP_FLOOR_FROM_SIZE || ROSTER_FILLS_SQUAD.has(n.id)) continue;
          const cheap = f.filter((id) => getDef(id).cost <= CHEAP_COST).length;
          const floor = Math.max(CHEAP_FLOOR_MIN, Math.ceil(f.length * CHEAP_SHARE));
          if (cheap < floor) under.push(`${r.id}/${n.id}: ${cheap} of ${f.length} (floor ${floor})`);
        }
      expect(under, "nodes below the cheap floor").toEqual([]);
    });
});

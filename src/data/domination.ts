/** DOMINATION — a 7×7 objective map, and the first mode where the board itself
 *  is the win condition rather than the enemy's back line.
 *
 *  Every other match in this game is decided by reaching the far side: capture
 *  the opponent's Home row and you win, which makes the board a corridor and
 *  the middle of it a place you pass through. Domination inverts that. There is
 *  no Home-row capture here at all (`hasCaptureWin` is switched off the same way
 *  Void Tower switches it off); there are four Points of Interest, and the fight
 *  is over standing on them.
 *
 *  THE MAP IS A PARTITION, and that is not decoration — it is what makes the
 *  geometry read at a glance. A 7×7 board is 49 slots. The four POIs are 3×3
 *  blocks, which is 36 of them. What is left over is exactly row D and column 4
 *  — 13 slots, sharing the middle one — and that leftover IS the road cross.
 *  Nothing on this map is unaccounted for:
 *
 *      36 (four 3×3 points)  +  13 (the road cross)  =  49
 *
 *        1   2   3   4   5   6   7
 *    A  [a] [a] [a]  *  [b] [b] [b]
 *    B  [a] (X) [a]  |  [b] (X) [b]
 *    C  [a] [a] [a]  |  [b] [b] [b]
 *    D   *   —   —  (W)  —   —   *
 *    E  [c] [c] [c]  |  [d] [d] [d]
 *    F  [c] (X) [c]  |  [d] (X) [d]
 *    G  [c] [c] [c]  *  [d] [d] [d]
 *
 *      [x] the eight ring slots of a Point   (X) impassable citadel
 *       *  shrine (any seat may summon)      — | road   (W) the Well
 *
 *  A POINT IS ITS RING, NOT ITS MIDDLE. The centre of each 3×3 is impassable —
 *  the citadel itself, which nothing walks into — so a Point is the eight slots
 *  AROUND it and you hold it by having more bodies on that ring than your
 *  opponent. That is deliberately a thing you can lose gradually rather than a
 *  square somebody is standing on: a Point contested 3-to-2 is still yours, and
 *  the fight for it is a real fight rather than a race to one slot.
 *
 *  CONTROL IS STICKY. A tie does NOT flip a Point. Whoever last held it keeps
 *  it until the other side actually out-numbers them on the ring, so walking one
 *  card onto an empty enemy Point does not take it back — matching them does not
 *  either. This is what makes holding mean something.
 *
 *  THE ROADS ARE THE POINT OF THE ROADS. On a board this size a slow melee card
 *  crossing from one corner to the far Point takes most of a match, which is how
 *  a 7×7 turns into two separate games happening at opposite ends. The cross
 *  gives every card +1 reach while it runs ALONG it, so the roads are the fast
 *  lanes between objectives — and they meet at the WELL, which is the one square
 *  on the map that mends you and the one every lane already leads to.
 */
import type { PlayerId, Pos } from "../engine/types";

export type PoiId = "A" | "B" | "C" | "D";

export interface PoiDef {
  id: PoiId;
  name: string;
  /** The impassable middle. The Point itself is the eight slots around it. */
  centre: Pos;
}

export interface DominationMap {
  id: string;
  name: string;
  boardSize: number;
  pois: PoiDef[];
  /** Impassable slots that are NOT a Point's centre. None on the 7x7 now that
   *  the crossroads is the Well; kept because a future map may want some. */
  deadSlots: Pos[];
  /** THE WELL: one square at the crossroads that mends whoever holds it.
   *
   *  It sits where the board's middle used to be closed, and the swap is the
   *  design: a dead centre made the map four corners with a hole in it, and the
   *  one square every lane already leads to is the obvious thing to fight over.
   *  Standing on it grants a heal-over-time that KEEPS RUNNING after you step
   *  off, so taking the Well is worth a detour rather than worth camping. */
  well?: { at: Pos; hp: number; rounds: number };
  /** Summon slots either player may use. All four sit on the road cross, in the
   *  gaps between the Points — so reinforcements always arrive on a lane. */
  shrines: Pos[];
}

const at = (row: number, col: number): Pos => ({ row, col });

/** The 7×7. Rows A-G are 0-6, columns 1-7 are 0-6. */
export const DOMINATION_7X7: DominationMap = {
  id: "dom7",
  name: "Domination 7×7",
  boardSize: 7,
  pois: [
    { id: "A", name: "Fire Citadel", centre: at(1, 1) },
    { id: "B", name: "Volcanic Bastion", centre: at(1, 5) },
    { id: "C", name: "Ashen Port", centre: at(5, 1) },
    { id: "D", name: "Dragon's Lair", centre: at(5, 5) },
  ],
  deadSlots: [],
  well: { at: at(3, 3), hp: 2, rounds: 3 },
  shrines: [at(0, 3), at(3, 0), at(3, 6), at(6, 3)],
};

export const DOMINATION_MAPS: Record<string, DominationMap> = {
  [DOMINATION_7X7.id]: DOMINATION_7X7,
};

export const dominationMap = (id: string): DominationMap | undefined => DOMINATION_MAPS[id];

// ── terrain, all derived from the map rather than stored per slot ──────────
// Deriving keeps GameState small and serialisable — an online match relays the
// state, and 49 slots of static terrain on every message is 49 slots of the
// same answer. The map id is the only thing that has to travel.

/** The eight ring slots of a Point: its 3×3 block minus the impassable middle. */
export function poiRing(poi: PoiDef): Pos[] {
  const out: Pos[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      if (dr !== 0 || dc !== 0) out.push(at(poi.centre.row + dr, poi.centre.col + dc));
  return out;
}

/** Which Point this slot belongs to (ring OR centre), if any. */
export function poiAt(map: DominationMap, row: number, col: number): PoiDef | undefined {
  return map.pois.find(
    (p) => Math.abs(row - p.centre.row) <= 1 && Math.abs(col - p.centre.col) <= 1,
  );
}

/** Nothing may stand here: a Point's centre, or a declared dead slot. */
export function isImpassable(map: DominationMap, row: number, col: number): boolean {
  return map.pois.some((p) => p.centre.row === row && p.centre.col === col)
    || map.deadSlots.some((d) => d.row === row && d.col === col);
}

export function isShrine(map: DominationMap, row: number, col: number): boolean {
  return map.shrines.some((s) => s.row === row && s.col === col);
}

export function isWell(map: DominationMap, row: number, col: number): boolean {
  return !!map.well && map.well.at.row === row && map.well.at.col === col;
}

/** A road slot is any slot that belongs to no Point — the leftover cross. An
 *  impassable slot is still "road" for pathing purposes ONLY in the sense that
 *  it is not a Point; `isImpassable` refuses it separately, so the centre of the
 *  cross blocks a run through it rather than speeding one up. */
export function isRoad(map: DominationMap, row: number, col: number): boolean {
  return !poiAt(map, row, col);
}

/** Does this move run ALONG the road? Both ends on the cross, in a straight
 *  line, with every slot between them on it and none of them impassable.
 *
 *  Straight-line only, on purpose: the bonus is for following a lane, not for
 *  cutting a corner at the junction where the two lanes meet. And because the
 *  junction is the impassable centre, a run down one lane can never continue
 *  into the other — the quickest way across this map is never a straight line,
 *  which is the whole reason the middle is closed. */
export function runsAlongRoad(map: DominationMap, from: Pos, to: Pos): boolean {
  if (from.row !== to.row && from.col !== to.col) return false;
  if (from.row === to.row && from.col === to.col) return false;
  const dr = Math.sign(to.row - from.row);
  const dc = Math.sign(to.col - from.col);
  let r = from.row, c = from.col;
  for (;;) {
    if (!isRoad(map, r, c) || isImpassable(map, r, c)) return false;
    if (r === to.row && c === to.col) return true;
    r += dr; c += dc;
  }
}

/** Who holds each Point after a round: strictly MORE bodies on the ring takes
 *  it, a tie leaves it with whoever held it. `counts` is per-Point (P1, P2). */
export function resolveHolders(
  map: DominationMap,
  counts: Record<PoiId, { P1: number; P2: number }>,
  held: Record<PoiId, PlayerId | null>,
): Record<PoiId, PlayerId | null> {
  const next = { ...held };
  for (const p of map.pois) {
    const c = counts[p.id];
    if (c.P1 > c.P2) next[p.id] = "P1";
    else if (c.P2 > c.P1) next[p.id] = "P2";
    // equal (including 0-0) — sticky: the previous holder keeps it
  }
  return next;
}

export const heldCount = (
  held: Record<PoiId, PlayerId | null>, player: PlayerId,
): number => (Object.values(held) as (PlayerId | null)[]).filter((h) => h === player).length;

/** THREE Points held at the end of THREE consecutive rounds wins the map.
 *
 *  Holding all four still ends it on the spot. This is the majority you have to
 *  keep, and keeping it is the point: three rounds means the table gets two full
 *  turns to break your hold before it counts, which in a free-for-all is what
 *  stops the first player to grab a majority from simply running out the game
 *  while everyone else is still fighting each other. The streak resets the
 *  moment the majority slips, so it has to be three rounds IN A ROW. */
export const DOMINATION_MAJORITY = 3;
export const DOMINATION_HOLD_ROUNDS = 3;

/** The `domination` block a fresh match starts with: nobody holds anything.
 *
 *  Deliberately a plain factory taking no GameState — `phases.ts` imports this
 *  module, so this module importing the engine back would close a cycle. The
 *  caller builds the state the ordinary way and stamps this onto it:
 *
 *      const s = createInitialState(seed, deck, deck, humans, undefined,
 *                                   spells, DOMINATION_7X7.boardSize);
 *      s.domination = newDomination(DOMINATION_7X7);
 */
export function newDomination(map: DominationMap): {
  mapId: string;
  held: Record<string, PlayerId | null>;
  streak: Record<PlayerId, number>;
} {
  const held: Record<string, PlayerId | null> = {};
  for (const p of map.pois) held[p.id] = null;
  return { mapId: map.id, held, streak: { P1: 0, P2: 0, P3: 0, P4: 0 } };
}

/** What a held Point pays its holder, every round, on top of the ordinary
 *  resource flow. This is what turns holding a Point from a score into a
 *  POSITION: the map funds the army that took it, so a side that is ahead on
 *  Points is also ahead on the money to stay ahead — and losing one costs you
 *  the income you would have retaken it with. */
export const POI_GOLD = 2;
export const POI_MAGIC = 1;

/** Where you are in Story Mode, as one value.
 *
 *  This was nine `useState` hooks in App — `storyOpen`, `collectionOpen`,
 *  `regionsOpen`, `regionId`, `mapFocusNode`, `prepNode`, `storyNode`,
 *  `storyResult`, `storyBuilder` — and they were never nine independent facts.
 *  Two problems came out of that:
 *
 *  1. ILLEGAL STATES. The three story screens were two booleans, so
 *     `collectionOpen && regionsOpen` was representable and every render site
 *     had to spell out which one wins:
 *       storyOpen && !started && collectionOpen            -> collection
 *       storyOpen && !started && !collectionOpen && regionsOpen  -> regions
 *       storyOpen && !started && !collectionOpen && !regionsOpen -> map
 *     Four conditions describing a three-way choice, with the precedence
 *     hidden in the order of the `!`s. One `view` field cannot be wrong.
 *
 *  2. TRANSITIONS SPREAD ACROSS CALL SITES. Going from the collection to a
 *     card's source node meant setting four hooks in the right order at the
 *     call site, and leaving the region picker open was a one-line omission
 *     away. `goToNode` is one action now, and the reducer is the only place
 *     that knows what a jump involves.
 *
 *  What is NOT here: `StorySave`. That is the campaign itself — persisted,
 *  written by battles, packs, crafting and the squad editor. Navigation is
 *  view state. Folding the save into this reducer would put a model behind an
 *  action list that exists to describe a screen.
 *
 *  `fightNode` is the one field that outlives the story screens: it is the
 *  node a match is being fought FOR, read while `open` is false, and it is
 *  what turns a win into a recruitment roll. Null means an ordinary skirmish
 *  that recruits nothing.
 */
import type { StoryNode } from "../data/story";

/** The three story screens. Exactly one shows at a time. */
export type StoryView = "map" | "regions" | "collection";

export interface StoryResultPayload {
  node: StoryNode;
  won: string[];
  captured: number;
  lost?: boolean;
}

export interface StoryNav {
  /** Story Mode owns the screen. */
  open: boolean;
  view: StoryView;
  /** Whose map is being read. Survives leaving and re-entering Story. */
  regionId: string;
  /** A node the collection asked the map to select. Consumed once by the map,
   *  then cleared — left set, it would re-select on every later render and the
   *  player could never click away from it. */
  focusNodeId: string | null;
  /** The node whose prep screen is open, over the map. */
  prepNode: StoryNode | null;
  /** The node a match is being fought for. Read while `open` is false. */
  fightNode: StoryNode | null;
  /** Post-battle recruitment, shown over everything. */
  result: StoryResultPayload | null;
  /** The campaign team builder. */
  builder: boolean;
}

export const initialStoryNav = (regionId: string): StoryNav => ({
  open: false,
  view: "map",
  regionId,
  focusNodeId: null,
  prepNode: null,
  fightNode: null,
  result: null,
  builder: false,
});

export type StoryAction =
  /** Enter Story Mode. Lands on the MAP, never the picker: continuing where
   *  you left off is the common case. */
  | { t: "open" }
  /** Leave Story for another tab. Drops the transient screens but keeps
   *  `regionId` so coming back returns you to the same map. */
  | { t: "close" }
  | { t: "view"; view: StoryView }
  /** Chose a map from the picker — switch to it and show it. */
  | { t: "pickRegion"; regionId: string }
  /** The collection asked to show a card's source node, which can live in a
   *  region the map is not currently showing. */
  | { t: "goToNode"; nodeId: string; regionId?: string }
  | { t: "focusHandled" }
  /** Open (or dismiss) the prep screen for a node. */
  | { t: "prep"; node: StoryNode | null }
  /** Prep committed: the match starts, so Story steps off the screen. */
  | { t: "fight"; node: StoryNode }
  | { t: "result"; result: StoryResultPayload }
  /** Dismiss the result and come back to the map. */
  | { t: "closeResult" }
  | { t: "builder"; open: boolean };

export function storyNav(s: StoryNav, a: StoryAction): StoryNav {
  switch (a.t) {
    case "open":
      return { ...s, open: true, view: "map" };
    case "close":
      // `fightNode` and `result` are deliberately untouched: a match can be
      // running, and its recruitment roll is owed to the player whether or not
      // they wandered off the Story tab first.
      return { ...s, open: false, view: "map", prepNode: null, builder: false };
    case "view":
      return { ...s, view: a.view };
    case "pickRegion":
      return { ...s, regionId: a.regionId, view: "map" };
    case "goToNode":
      // Everything a jump involves, in one place: switch region if the card
      // came from elsewhere, arm the focus, and land on the map — which means
      // closing whichever screen asked, picker included.
      return {
        ...s,
        regionId: a.regionId ?? s.regionId,
        focusNodeId: a.nodeId,
        view: "map",
      };
    case "focusHandled":
      return { ...s, focusNodeId: null };
    case "prep":
      return { ...s, prepNode: a.node };
    case "fight":
      return { ...s, prepNode: null, fightNode: a.node, open: false };
    case "result":
      return { ...s, result: a.result };
    case "closeResult":
      return { ...s, result: null, fightNode: null, open: true, view: "map" };
    case "builder":
      return { ...s, builder: a.open };
  }
}

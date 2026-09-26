// THE ARENA, AS TWO LEVELS — the half with no React in it.
//
// The Arena used to be one screen that asked everything at once: who you play
// (the AI, someone on this device, someone online), the battlefield, the mode
// and the opponent's skill, as four or five stacked rows of buttons above the
// matchup. Rows appeared and vanished as you picked, so nothing stayed where you
// left it, and a new player met fourteen buttons before they met an opponent.
//
// It is a list of ways to play now, and a screen per way that asks only what
// that way needs. This file is the list, what each screen sets underneath, and
// the choice remembered between visits. App still owns every piece of match
// state; a view only decides which of those the player is shown and which are
// set for them.

export type ArenaView =
  | "hub"
  | "quick" | "streak" | "gauntlet" | "draft" | "domination"
  | "local" | "online";
export type ModeView = Exclude<ArenaView, "hub">;

export type ArenaMode = "ai" | "local" | "online";
export type ArenaGame = "casual" | "streak" | "gauntlet" | "draft";
export type Board = 4 | 5 | 7;

export interface ViewSetup {
  /** Who is in the other seat. */
  mode: ArenaMode;
  /** The kind of AI match. CASUAL on both friend views as well, and that is
   *  load-bearing: the run settlements ask only `arenaGame`, so a hot-seat match
   *  played while the mode still said "gauntlet" was scored against the run. */
  game: ArenaGame;
  /** The battlefields this screen offers, in order. */
  boards: readonly Board[];
  /** Can ALSO be played on the Domination map, through the screen's FORMAT
   *  toggle rather than the battlefield setting — see `DomView`. */
  dom?: boolean;
}

/** THE 7x7 IS DOMINATION. Casually it is a free-for-all with its own screen and
 *  its own question (how many opponents); the duels — Quick match and Draft —
 *  are fought on the two duel boards. A friend can still pick it: a hot-seat or
 *  online game is a room of people choosing their own table.
 *
 *  STREAK AND GAUNTLET can be played on it too (owner, 2026-09), as a FORMAT
 *  on their own screens: Duel or Domination. Not as a third battlefield in the
 *  settings row, because it is not a board size — it pays double and sometimes
 *  seats more than one opponent (dom-ladder.ts), which is a choice the screen
 *  should show, not one to find behind "Settings". So `boards` stays the duel
 *  boards and `dom` marks the screen that has the toggle. */
export const VIEW_SETUP: Record<ModeView, ViewSetup> = {
  quick: { mode: "ai", game: "casual", boards: [4, 5] },
  streak: { mode: "ai", game: "streak", boards: [4, 5], dom: true },
  gauntlet: { mode: "ai", game: "gauntlet", boards: [4, 5], dom: true },
  draft: { mode: "ai", game: "draft", boards: [4, 5] },
  domination: { mode: "ai", game: "casual", boards: [7] },
  local: { mode: "local", game: "casual", boards: [4, 5, 7] },
  online: { mode: "online", game: "casual", boards: [4, 5, 7] },
};

/** The scored modes with a Duel / Domination toggle. */
export type DomView = "streak" | "gauntlet";
export const isDomView = (v: ArenaView): v is DomView => v === "streak" || v === "gauntlet";

/** The battlefield a view opens on: the current one if the view offers it, the
 *  last duel board if that fits, else the view's first. So a player who plays
 *  5x5 keeps 5x5 moving between duel modes.
 *
 *  THE 7x7 STAYS BEHIND when you leave Domination, even for a screen that offers
 *  it: a friend's game opened straight after a free-for-all opened AS one — the
 *  big map and four seats already picked, by a choice made for something else.
 *  It carries only between the two friend screens, where it was chosen for them.
 *
 *  `domOn` is the screen's own FORMAT, remembered per screen (`ArenaPrefs.dom`):
 *  a Streak last played as Domination opens as Domination, whatever board the
 *  screen before it was on. */
export function boardForView(
  view: ModeView, current: number, lastDuel: 4 | 5, from?: ArenaView, domOn?: boolean,
): Board {
  if (domOn && VIEW_SETUP[view].dom) return 7;
  const boards = VIEW_SETUP[view].boards as readonly number[];
  const friend = (v?: ArenaView) => v === "local" || v === "online";
  const keep = boards.includes(current)
    && (current !== 7 || view === "domination" || (friend(view) && friend(from)));
  if (keep) return current as Board;
  if (boards.includes(lastDuel)) return lastDuel;
  return VIEW_SETUP[view].boards[0];
}

/** One line per battlefield, for the settings panel. Two parts so a phone can
 *  stack them instead of cutting "Standard" to "Stand…". */
export const BOARD_LABEL: Record<Board, { size: string; name: string }> = {
  4: { size: "4×4", name: "Standard" },
  5: { size: "5×5", name: "Large" },
  7: { size: "7×7", name: "Domination" },
};

// ── the list ─────────────────────────────────────────────────────────────────

export type HubEntryId = "quick" | "streak" | "gauntlet" | "draft" | "domination" | "friend";

/** The ways to play, in the order they are offered. Quick match first because
 *  it is the one that needs nothing: a new player's first tap should start a
 *  fight, not open a decision. `sub` is five words at most — what the mode IS,
 *  not how it works; the screen behind it says the rest. */
export const HUB_ENTRIES: readonly { id: HubEntryId; title: string; sub: string }[] = [
  { id: "quick", title: "Quick match", sub: "One match vs the AI" },
  { id: "streak", title: "Streak", sub: "Win to climb rungs" },
  { id: "gauntlet", title: "Gauntlet", sub: "Four foes, one life" },
  { id: "draft", title: "Draft", sub: "Build a squad from picks" },
  { id: "domination", title: "Domination", sub: "7×7, up to four armies" },
  { id: "friend", title: "Play a friend", sub: "This device or online" },
];

/** The heading and one-line explanation at the top of each mode screen. */
export const VIEW_HEAD: Record<ModeView, { title: string; blurb: string }> = {
  quick: { title: "Quick match", blurb: "One match against the AI. Nothing is scored." },
  streak: { title: "Streak", blurb: "The opponent is dealt from your rung. Wins pay more the longer you hold it." },
  gauntlet: { title: "Gauntlet", blurb: "Four dealt opponents from one rung. One loss ends the run." },
  draft: { title: "Draft", blurb: "Build a squad from cards you do not own, then play it until three losses." },
  domination: { title: "Domination", blurb: "A free-for-all on the 7×7. Hold Points to win; everyone deploys at the shrines." },
  local: { title: "Play a friend", blurb: "Two players on this device — hand it over each turn." },
  online: { title: "Play a friend", blurb: "Host a room and share its code, or join a friend's." },
};

/** Where a list entry leads. Play a friend opens whichever of its two screens
 *  was used last, because someone who plays a friend online does so every time. */
export function viewForEntry(id: HubEntryId, friend: "local" | "online"): ModeView {
  return id === "friend" ? friend : id;
}

/** Which list entry a view belongs to — the reverse, for the back button. */
export function entryForView(view: ModeView): HubEntryId {
  return view === "local" || view === "online" ? "friend" : view;
}

// ── what each entry says about itself ───────────────────────────────────────

/** The live state of each mode, as the list needs it — flattened from the save
 *  so this file never has to know how runs are stored. */
export interface HubStatus {
  /** Wins in a row on the ladder, and the rung that streak is on. */
  streak: number;
  rung: string;
  gauntlet: { seat: number; of: number } | "over" | null;
  draft: { picksLeft: number } | { wins: number; livesLeft: number } | "over" | null;
  shards: number;
  draftCost: number;
  /** An online room this device is sitting in right now. */
  roomOpen: boolean;
}

export type HubBadge =
  | { tone: "live"; text: string }
  | { tone: "info"; text: string }
  | { tone: "cost"; amount: number }
  | { tone: "lock"; amount: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The one fact an entry shows on the list: a run in progress, what it costs,
 *  or nothing. A mode the player cannot afford says so HERE, with the price,
 *  rather than after they have opened it. */
export function hubBadge(id: HubEntryId, s: HubStatus): HubBadge | null {
  switch (id) {
    case "streak":
      return s.streak > 0
        ? { tone: "live", text: `${s.streak} in a row` }
        : { tone: "info", text: s.rung };
    case "gauntlet":
      if (s.gauntlet === "over") return { tone: "info", text: "Run over" };
      return s.gauntlet ? { tone: "live", text: `Seat ${s.gauntlet.seat} of ${s.gauntlet.of}` } : null;
    case "draft":
      if (s.draft === "over") return { tone: "info", text: "Run over" };
      if (s.draft && "picksLeft" in s.draft) return { tone: "live", text: `${plural(s.draft.picksLeft, "pick", "picks")} left` };
      if (s.draft) return { tone: "live", text: `${plural(s.draft.wins, "win", "wins")} · ${plural(s.draft.livesLeft, "life", "lives")}` };
      return s.shards < s.draftCost ? { tone: "lock", amount: s.draftCost } : { tone: "cost", amount: s.draftCost };
    case "friend":
      return s.roomOpen ? { tone: "live", text: "Room open" } : null;
    default:
      return null;
  }
}

// ── remembered between visits ───────────────────────────────────────────────

/** Device-local, NOT in account.ts's SAVE_KEYS: where you last were in a menu is
 *  a fact about this screen, the way the music being muted is. */
export const ARENA_PREFS_KEY = "we_arena_v1";

export interface ArenaPrefs {
  view: ArenaView;
  /** The duel board last used, so Quick match and the scored modes agree. */
  duel: 4 | 5;
  /** Which of Play a friend's two screens was used last. */
  friend: "local" | "online";
  /** Each scored mode's FORMAT, last picked on its own screen: true = Domination. */
  dom: Record<DomView, boolean>;
}

export const DEFAULT_ARENA_PREFS: ArenaPrefs = {
  view: "hub", duel: 4, friend: "online", dom: { streak: false, gauntlet: false },
};

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const VIEWS: readonly string[] = ["hub", "quick", "streak", "gauntlet", "draft", "domination", "local", "online"];

/** The remembered choice, field by field: anything missing, stale or hand-edited
 *  falls back to the default for that field alone, so one bad value cannot cost
 *  the player the others. */
export function loadArenaPrefs(store: Store | null = browserStore()): ArenaPrefs {
  let raw: unknown = null;
  try {
    raw = JSON.parse(store?.getItem(ARENA_PREFS_KEY) ?? "null");
  } catch {
    raw = null;
  }
  const o = raw && typeof raw === "object" ? (raw as Partial<Record<keyof ArenaPrefs, unknown>>) : {};
  const dom = o.dom && typeof o.dom === "object" ? (o.dom as Partial<Record<DomView, unknown>>) : {};
  return {
    view: typeof o.view === "string" && VIEWS.includes(o.view) ? (o.view as ArenaView) : DEFAULT_ARENA_PREFS.view,
    duel: o.duel === 4 || o.duel === 5 ? o.duel : DEFAULT_ARENA_PREFS.duel,
    friend: o.friend === "local" || o.friend === "online" ? o.friend : DEFAULT_ARENA_PREFS.friend,
    // Per mode, and only a real `true` turns it on: a missing or garbled entry
    // is a duel, which is what every player had before the toggle existed.
    dom: { streak: dom.streak === true, gauntlet: dom.gauntlet === true },
  };
}

export function saveArenaPrefs(p: ArenaPrefs, store: Store | null = browserStore()): void {
  try {
    store?.setItem(ARENA_PREFS_KEY, JSON.stringify(p));
  } catch {
    // Storage refused: the choice is simply not remembered this time.
  }
}

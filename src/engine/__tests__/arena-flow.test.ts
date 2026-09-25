// THE ARENA IS TWO LEVELS: a list of ways to play, then a screen per way.
//
// It used to be one screen asking four or five rows of questions — who you
// play, the battlefield, the mode, the opponent's skill — above the matchup,
// with rows appearing and vanishing as you picked. The pure half of the new
// flow lives in `ui/arena-nav.ts` and is pinned here; the wiring in App.tsx is
// checked at the source level, the way the other screen tests in this folder
// are, because the suite runs in `node` with no DOM.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ARENA_PREFS_KEY, DEFAULT_ARENA_PREFS, HUB_ENTRIES, VIEW_HEAD, VIEW_SETUP,
  boardForView, entryForView, hubBadge, loadArenaPrefs, saveArenaPrefs, viewForEntry,
  type HubStatus, type ModeView,
} from "../../ui/arena-nav";

const MODE_VIEWS = Object.keys(VIEW_SETUP) as ModeView[];

describe("what each screen sets underneath", () => {
  it("both friend screens are CASUAL, so a hot-seat match can never score a run", () => {
    // The run settlements ask only `arenaGame`. A two-player match played while
    // the mode still read "gauntlet" or "draft" was scored against the run.
    expect(VIEW_SETUP.local).toMatchObject({ mode: "local", game: "casual" });
    expect(VIEW_SETUP.online).toMatchObject({ mode: "online", game: "casual" });
  });

  it("the duels never offer the 7x7, and Domination offers nothing else", () => {
    for (const v of ["quick", "streak", "gauntlet", "draft"] as const)
      expect(VIEW_SETUP[v].boards, v).toEqual([4, 5]);
    expect(VIEW_SETUP.domination.boards).toEqual([7]);
    expect(VIEW_SETUP.local.boards).toContain(7);
    expect(VIEW_SETUP.online.boards).toContain(7);
  });

  it("every AI screen is played against the AI, in the mode it names", () => {
    for (const v of ["quick", "streak", "gauntlet", "draft", "domination"] as const)
      expect(VIEW_SETUP[v].mode, v).toBe("ai");
    expect(VIEW_SETUP.streak.game).toBe("streak");
    expect(VIEW_SETUP.gauntlet.game).toBe("gauntlet");
    expect(VIEW_SETUP.draft.game).toBe("draft");
    expect(VIEW_SETUP.quick.game).toBe("casual");
    expect(VIEW_SETUP.domination.game).toBe("casual");
  });

  it("keeps the board you are on when the screen offers it", () => {
    expect(boardForView("quick", 5, 4)).toBe(5);
    expect(boardForView("local", 5, 4)).toBe(5);
  });

  it("leaving Domination lands a duel on your last duel board, not the 7x7", () => {
    expect(boardForView("quick", 7, 5)).toBe(5);
    expect(boardForView("gauntlet", 7, 4)).toBe(4);
    expect(boardForView("domination", 5, 5)).toBe(7);
  });

  it("...and a friend's game does not open as a free-for-all just after one", () => {
    // Play a friend offers the 7x7, so "keep what you are on" would have kept it
    // — and the four seats picked for Domination with it.
    expect(boardForView("online", 7, 5, "domination")).toBe(5);
    expect(boardForView("local", 7, 4, "domination")).toBe(4);
    // Between the two friend screens it was chosen for them, so it carries.
    expect(boardForView("local", 7, 4, "online")).toBe(7);
    expect(boardForView("online", 7, 4, "local")).toBe(7);
  });

  it("every screen has a heading and a one-line explanation", () => {
    for (const v of MODE_VIEWS) {
      expect(VIEW_HEAD[v].title.length, v).toBeGreaterThan(2);
      expect(VIEW_HEAD[v].blurb.length, v).toBeGreaterThan(20);
    }
  });
});

describe("the list", () => {
  it("offers every way to play, Quick match first", () => {
    expect(HUB_ENTRIES.map((e) => e.id)).toEqual(["quick", "streak", "gauntlet", "draft", "domination", "friend"]);
  });

  it("keeps each line short — the screen behind it says the rest", () => {
    for (const e of HUB_ENTRIES) expect(e.sub.split(/\s+/).length, e.id).toBeLessThanOrEqual(5);
  });

  it("Play a friend opens the friend screen used last, and back finds its row again", () => {
    expect(viewForEntry("friend", "local")).toBe("local");
    expect(viewForEntry("friend", "online")).toBe("online");
    expect(viewForEntry("gauntlet", "online")).toBe("gauntlet");
    for (const v of MODE_VIEWS) expect(viewForEntry(entryForView(v), v === "local" ? "local" : "online")).toBe(v);
  });
});

describe("what each row says about itself", () => {
  const quiet: HubStatus = {
    streak: 0, rung: "Easy", gauntlet: null, draft: null, shards: 0, draftCost: 50, roomOpen: false,
  };

  it("Draft shows its price, and a lock when you cannot pay it — before you open it", () => {
    expect(hubBadge("draft", quiet)).toEqual({ tone: "lock", amount: 50 });
    expect(hubBadge("draft", { ...quiet, shards: 50 })).toEqual({ tone: "cost", amount: 50 });
  });

  it("a run in progress says where it is", () => {
    expect(hubBadge("gauntlet", { ...quiet, gauntlet: { seat: 2, of: 4 } })).toEqual({ tone: "live", text: "Seat 2 of 4" });
    expect(hubBadge("draft", { ...quiet, draft: { wins: 1, livesLeft: 2 } })).toEqual({ tone: "live", text: "1 win · 2 lives" });
    expect(hubBadge("draft", { ...quiet, draft: { picksLeft: 1 } })).toEqual({ tone: "live", text: "1 pick left" });
    expect(hubBadge("gauntlet", { ...quiet, gauntlet: "over" })).toEqual({ tone: "info", text: "Run over" });
  });

  it("Streak names the rung, or the streak once there is one", () => {
    expect(hubBadge("streak", quiet)).toEqual({ tone: "info", text: "Easy" });
    expect(hubBadge("streak", { ...quiet, streak: 3 })).toEqual({ tone: "live", text: "3 in a row" });
  });

  it("the rest stay quiet unless something is live", () => {
    expect(hubBadge("quick", quiet)).toBeNull();
    expect(hubBadge("domination", quiet)).toBeNull();
    expect(hubBadge("friend", quiet)).toBeNull();
    expect(hubBadge("friend", { ...quiet, roomOpen: true })).toEqual({ tone: "live", text: "Room open" });
    expect(hubBadge("gauntlet", quiet)).toBeNull();
  });
});

describe("the choice remembered between visits", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
  };

  it("a new player starts on the list", () => {
    expect(loadArenaPrefs(mem())).toEqual(DEFAULT_ARENA_PREFS);
    expect(DEFAULT_ARENA_PREFS.view).toBe("hub");
  });

  it("round-trips", () => {
    const s = mem();
    saveArenaPrefs({ view: "gauntlet", duel: 5, friend: "local" }, s);
    expect(loadArenaPrefs(s)).toEqual({ view: "gauntlet", duel: 5, friend: "local" });
  });

  it("repairs a bad field without losing the good ones", () => {
    const s = mem();
    s.setItem(ARENA_PREFS_KEY, JSON.stringify({ view: "nowhere", duel: 7, friend: "local" }));
    expect(loadArenaPrefs(s)).toEqual({ view: "hub", duel: 4, friend: "local" });
    s.setItem(ARENA_PREFS_KEY, "{not json");
    expect(loadArenaPrefs(s)).toEqual(DEFAULT_ARENA_PREFS);
  });

  it("survives storage that refuses to be used", () => {
    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("quota"); },
    };
    expect(loadArenaPrefs(broken)).toEqual(DEFAULT_ARENA_PREFS);
    expect(() => saveArenaPrefs(DEFAULT_ARENA_PREFS, broken)).not.toThrow();
    expect(loadArenaPrefs(null)).toEqual(DEFAULT_ARENA_PREFS);
  });

  it("stays on this device: where you were in a menu is not progress", () => {
    const ACCOUNT = readFileSync(join(__dirname, "..", "..", "net", "account.ts"), "utf8");
    expect(ACCOUNT).not.toContain(ARENA_PREFS_KEY);
  });
});

// ── the wiring in App.tsx ──────────────────────────────────────────────────
describe("the wiring in App.tsx", () => {
  // Normalised, so a checkout with Windows line endings slices the same way: a
  // function-end search that finds nothing slices to the end of the file, and
  // every toContain after it would pass against the whole of App.tsx.
  const APP = readFileSync(join(__dirname, "..", "..", "ui", "App.tsx"), "utf8").replace(/\r\n/g, "\n");
  const fn = (name: string) => {
    const at = APP.indexOf(`function ${name}(`);
    expect(at, `${name} exists`).toBeGreaterThan(-1);
    const end = APP.indexOf("\n  }\n", at);
    expect(end, `${name} ends`).toBeGreaterThan(at);
    return APP.slice(at, end);
  };
  const start = APP.indexOf('{!started && !storyOpen && tab === "arena" && (');
  const block = APP.slice(start, APP.indexOf("{/* OUTSIDE `.overlay`, deliberately.", start));

  it("the Arena opens on the list, and nothing on the list asks a question", () => {
    expect(block).toContain('arenaView === "hub" ? (');
    const hub = block.slice(block.indexOf('arenaView === "hub" ? ('), block.indexOf("<ArenaHeader"));
    expect(hub).toContain("<ArenaHub");
    for (const question of ['className="seg"', "ar-flabel", "ar-foot"]) expect(hub, question).not.toContain(question);
  });

  it("every mode screen is entered through one function that sets its match up", () => {
    const enter = fn("enterArenaView");
    expect(enter).toContain("const setup = VIEW_SETUP[v]");
    expect(enter).toContain("setArenaMode(setup.mode)");
    expect(enter).toContain("setArenaGame(setup.game)");
  });

  it("a screen's next step is its one bottom button, never a disabled one pointing elsewhere", () => {
    const at = APP.indexOf("const arenaPrimary");
    const primary = APP.slice(at, APP.indexOf("})();", at));
    for (const act of ["onClick: lineUpGauntlet", "onClick: beginDraft", "onClick: startArenaMatch", "hostCreateRoom", "guestJoinRoom"])
      expect(primary, act).toContain(act);
    expect(block).toContain("{arenaPrimary.label}");
    // The old screen's mid-page action buttons, and the start label that sent
    // you back up to them, are gone from the Arena.
    expect(block).not.toContain("startGate.why");
    expect(block).not.toContain("Draft a squad");
    expect(block).not.toContain("Line up the {TIER_LABEL[runTier]} gauntlet");
  });

  it("Home's run card opens the Gauntlet screen, not merely the Arena", () => {
    expect(APP).toContain('onArena={() => { enterArenaView("gauntlet"); setTab("arena"); }}');
  });

  it("back from a mode screen returns to the list", () => {
    expect(APP).toContain('useBackLayer(!started && !storyOpen && tab === "arena" && arenaView !== "hub", () => enterArenaView("hub"));');
  });

  it("re-tapping the Arena tab returns to the list — and the back button's tab restore does not", () => {
    expect(APP).toContain('onTab={(t) => { if (t === "arena" && shownTab === "arena") markArenaView("hub"); goTab(t); }}');
    const at = APP.indexOf("const goTab = ");
    const goTab = APP.slice(at, APP.indexOf("};", at));
    expect(goTab, "goTab also restores tabs for the back button").not.toContain("markArenaView");
  });

  it("an event and a rejoin land on the screen that shows them", () => {
    expect(fn("seatEventFight")).toContain('markArenaView("quick")');
    expect(fn("rejoinOnline")).toContain('markArenaView("online")');
  });

  it("an event carried off Quick match gives the seat back, so it cannot park a run", () => {
    const enter = fn("enterArenaView");
    expect(enter).toContain('if (v !== "quick" && eventRun)');
    expect(enter).toContain("setBossRun(null)");
  });
});

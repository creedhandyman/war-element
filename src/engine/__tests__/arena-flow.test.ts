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
  boardForView, entryForView, hubBadge, isDomView, loadArenaPrefs, openingDeck, saveArenaPrefs, viewForEntry,
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

  it("Quick match and Draft stay on the duel boards, and Domination offers nothing else", () => {
    for (const v of ["quick", "draft"] as const)
      expect(VIEW_SETUP[v].boards, v).toEqual([4, 5]);
    expect(VIEW_SETUP.domination.boards).toEqual([7]);
    expect(VIEW_SETUP.local.boards).toContain(7);
    expect(VIEW_SETUP.online.boards).toContain(7);
  });

  it("Streak and Gauntlet list the 7x7 in their battlefield setting, beside the 4x4 and 5x5", () => {
    // Owner's call: Domination sits in the settings row like the other two
    // boards (it began as a separate Duel / Domination toggle on the screen).
    expect(VIEW_SETUP.streak.boards).toEqual([4, 5, 7]);
    expect(VIEW_SETUP.gauntlet.boards).toEqual([4, 5, 7]);
    // ...and only they remember it per screen.
    expect(VIEW_SETUP.streak.dom).toBe(true);
    expect(VIEW_SETUP.gauntlet.dom).toBe(true);
    for (const v of ["quick", "draft", "domination", "local", "online"] as const)
      expect(VIEW_SETUP[v].dom, v).toBeFalsy();
    expect(isDomView("streak") && isDomView("gauntlet")).toBe(true);
    expect(isDomView("quick") || isDomView("domination") || isDomView("hub")).toBe(false);
  });

  it("a scored mode opens on the 7x7 when it was last played there, from its own screen", () => {
    expect(boardForView("streak", 4, 4, "hub", true)).toBe(7);
    expect(boardForView("gauntlet", 5, 5, "domination", true)).toBe(7);
    // Last played as a duel: the last duel board, even arriving from a 7x7.
    expect(boardForView("streak", 7, 5, "hub", false)).toBe(5);
    expect(boardForView("gauntlet", 7, 4, "domination", false), "Domination's 7x7 stays behind").toBe(4);
    // ...and a remembered 7x7 means nothing on a screen without one.
    expect(boardForView("quick", 4, 4, "hub", true)).toBe(4);
    expect(boardForView("draft", 5, 5, "hub", true)).toBe(5);
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
    const prefs = {
      view: "gauntlet", duel: 5, friend: "local", dom: { streak: true, gauntlet: false }, deck: "sq_mine",
    } as const;
    saveArenaPrefs(prefs, s);
    expect(loadArenaPrefs(s)).toEqual(prefs);
  });

  it("repairs a bad field without losing the good ones", () => {
    const s = mem();
    s.setItem(ARENA_PREFS_KEY, JSON.stringify({ view: "nowhere", duel: 7, friend: "local" }));
    expect(loadArenaPrefs(s)).toEqual({
      view: "hub", duel: 4, friend: "local", dom: { streak: false, gauntlet: false }, deck: null,
    });
    s.setItem(ARENA_PREFS_KEY, "{not json");
    expect(loadArenaPrefs(s)).toEqual(DEFAULT_ARENA_PREFS);
  });

  it("a saved format is Domination only when it says so plainly", () => {
    // Prefs written before the toggle have no `dom` at all, and those players
    // were playing duels — a missing or garbled entry must read as a duel.
    const s = mem();
    s.setItem(ARENA_PREFS_KEY, JSON.stringify({ view: "streak", duel: 5, friend: "online", dom: { streak: "yes", gauntlet: true } }));
    expect(loadArenaPrefs(s).dom).toEqual({ streak: false, gauntlet: true });
    s.setItem(ARENA_PREFS_KEY, JSON.stringify({ view: "streak", duel: 5, friend: "online", dom: 1 }));
    expect(loadArenaPrefs(s).dom).toEqual({ streak: false, gauntlet: false });
  });

  it("remembers the squad you last fought with, and reads a garbled one as none", () => {
    // Prefs written before this have no `deck`: those players open on the
    // first premade, exactly as they always did.
    expect(DEFAULT_ARENA_PREFS.deck).toBeNull();
    const s = mem();
    for (const bad of [42, "", null, { id: "x" }]) {
      s.setItem(ARENA_PREFS_KEY, JSON.stringify({ view: "quick", deck: bad }));
      expect(loadArenaPrefs(s).deck, JSON.stringify(bad)).toBeNull();
    }
    s.setItem(ARENA_PREFS_KEY, JSON.stringify({ view: "quick", deck: "sq_mine" }));
    expect(loadArenaPrefs(s)).toMatchObject({ view: "quick", deck: "sq_mine" });
  });

  it("your chair opens on that squad while you can still pick it", () => {
    const pickable = ["inferno_blitz", "stormcall_5", "sq_mine"];
    expect(openingDeck("sq_mine", pickable, "inferno_blitz")).toBe("sq_mine");
    // A premade from the other board's shelf is still yours; the lobby's
    // remap re-points it to this board's build.
    expect(openingDeck("stormcall_5", pickable, "inferno_blitz")).toBe("stormcall_5");
    // A squad deleted since, a draft run's deck, or no fight yet: the old default.
    expect(openingDeck("sq_deleted", pickable, "inferno_blitz")).toBe("inferno_blitz");
    expect(openingDeck("__draft__", pickable, "inferno_blitz")).toBe("inferno_blitz");
    expect(openingDeck(null, pickable, "inferno_blitz")).toBe("inferno_blitz");
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
  // The boss seating itself lives in `void-seat.ts`, shared with the story's
  // Hard-mode border bosses; App hands it the boss, the rage and the ally.
  const SEAT = readFileSync(join(__dirname, "..", "..", "ui", "void-seat.ts"), "utf8").replace(/\r\n/g, "\n");
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

  it("...and one swapped for another opponent ON Quick match takes its ally and rage with it", () => {
    // `eventRun` is derived from the seat and `bossRun` is stored, so changing
    // the AI's deck nulled the event and kept the run — and the next ordinary
    // match spent a tamed ally's use without placing it. Every read now goes
    // through a gate that checks the run against the boss actually seated.
    expect(APP).toContain("const bossFight = bossRun && eventRun?.bossId === bossRun.cardId ? bossRun : null;");
    const start = fn("startArenaMatch");
    for (const read of [
      "seatVoidBoss(fresh, eventRun.bossId, { enraged: bossFight?.enraged, ally: bossFight?.ally });",
      "if (bossFight?.ally) {\n      const spendId = bossFight.ally;",
    ]) expect(start, read).toContain(read);
    for (const read of [
      "if (opts.enraged) scaleInstance(inst, ENRAGE_SCALE)",
      "if (opts.ally) seatTamedAlly(fresh, opts.ally);",
      'summonCard(fresh, "P1", allyId,',
    ]) expect(SEAT, read).toContain(read);
    const at = APP.indexOf("const tamedSave = ");
    expect(at, "tamedSave exists").toBeGreaterThan(-1);
    const end = APP.indexOf("\n      };", at);
    expect(end, "tamedSave ends").toBeGreaterThan(at);
    const tame = APP.slice(at, end);
    expect(tame).toContain("!bossFight?.enraged");
    expect(tame).toContain("tameBoss(sv, bossFight.cardId)");
    // Nothing reads the stored run around the gate: comments aside, the gate's
    // own `bossRun.cardId` is the only field read off it anywhere in App.tsx.
    const code = APP.split("\n").filter((l) => !/^\s*(\/\/|\/?\*)/.test(l)).join("\n");
    expect(code.match(/\bbossRun\??\.\w+/g), "every read goes through bossFight").toEqual(["bossRun.cardId"]);
  });

  it("the Arena opens YOUR chair on the squad you last fought with", () => {
    expect(APP).toContain(
      "const [p1DeckId, setP1DeckId] = useState(() => openingDeck(\n"
      + "    loadArenaPrefs().deck,\n"
      + "    [...PREMADE_DECKS, ...customDecks].map((d) => d.id),\n"
      + "    premadeDecksFor(4)[0].id,\n"
      + "  ));",
    );
    // Written where a fight is DEALT, with the deck it was dealt from: offline
    // (Quick match, the scored modes, events), the online host, and a guest's
    // first state. Never at a pick, and never on a rejoin or a rematch, which
    // re-seat a match rather than choose a team.
    expect(fn("startArenaMatch")).toContain("rememberMyDeck(p1DeckId);");
    expect(fn("hostStartMatch")).toContain("rememberMyDeck(deckNowRef.current.id);");
    expect(fn("guestOnState")).toContain("rememberMyDeck(deckNowRef.current.id);");
    const code = APP.split("\n").filter((l) => !/^\s*(\/\/|\/?\*)/.test(l)).join("\n");
    expect(code.match(/rememberMyDeck\(/g)).toHaveLength(4); // the definition + three calls
    expect(APP).toContain("id: mySeatDeckId,");
    // A draft run's deck and an event deck are never remembered as yours.
    expect(fn("rememberMyDeck")).toContain("if (!id || id === DRAFT_DECK_ID || eventForDeck(id)) return;");
  });

  it("an event's result screen offers no Rematch, boss fight or not", () => {
    // Owner's call. Only startArenaMatch scripts an event's opening or seats a
    // boss; a rematch re-deals the remembered decks and nothing else.
    const start = fn("startArenaMatch");
    expect(start).toContain("scriptedP2 ? { P2: scriptedP2 } : undefined,");
    expect(start).toContain("seatVoidBoss(fresh, eventRun.bossId,");
    expect(SEAT).toContain("fresh.voidTower = true;");
    const rematch = fn("dealRematch");
    expect(rematch).toContain("createInitialState(newSeed(), s.p1, s.p2, s.humans, s.p1s, s.p2s, s.board);");
    expect(rematch).not.toContain("summonCard");
    expect(rematch).not.toContain("seatVoidBoss");
    // ...yet it settled as the event, which is read off the deck in the chair.
    expect(APP).toContain("const event = eventForDeck(p2DeckId);");
    expect(APP).toContain("const eventRun: GameEvent | null = eventForDeck(p2DeckId) ?? null;");
    // The result screen is the one place the button is handed out. A Training
    // Ground lesson deals itself again (startLesson); everything else keeps the
    // event rule.
    expect(APP.match(/onRematch=\{[^\n]*/g)).toEqual([
      "onRematch={trainingRun ? () => startLesson(trainingRun)",
    ]);
    expect(APP).toContain(": (online || setupRef.current) && !eventRun ? askRematch : undefined}");
  });

  // ── Domination in Streak and Gauntlet ─────────────────────────────────────
  it("a scored mode remembers its own 7x7 when the battlefield is picked", () => {
    expect(fn("enterArenaView")).toContain("boardForView(v, boardSize, duel, arenaView, isDomView(v) && arenaPrefs.dom[v])");
    const pick = fn("pickArenaBoard");
    expect(pick).toContain("dom: { ...p.dom, [scored]: b === DOMINATION_7X7.boardSize }");
    expect(pick).toContain("saveArenaPrefs(next)");
  });

  it("a scored Domination fight seats the DEALT table, and casual keeps its pickers", () => {
    const start = fn("startArenaMatch");
    expect(start).toContain("(ladder ? 2 + ladderExtras.length : seatCount)");
    expect(start).toContain("const extraDeckIds = ladder ? ladderExtras : [p3DeckId, p4DeckId];");
    // The table is the run's for a gauntlet seat and the matchmaker's for a
    // streak fight — never P3/P4's pickers, which are casual Domination's.
    expect(APP).toContain("seatExtras(gauntletRun, boardSize).map((d) => d.id)");
    expect(APP).toContain("? streakExtras ?? []");
  });

  it("every streak deal deals the whole table, through one function", () => {
    const deal = fn("dealStreakFight");
    expect(deal).toContain("setP2DeckId(pick.id)");
    expect(deal).toContain("dealExtras(tier, board, pick.id)");
    // The re-deal after a match uses it, and it is the only place the Arena
    // rolls an opponent at all. NO REROLL BUTTON (owner, 2026-10-04): the
    // lobby names the dealt fight and nothing in it calls a deal.
    expect(APP).not.toContain("onClick={() => dealStreakFight(");
    expect(APP).toContain("dealStreakFight(tierForStreak(climbed.ladder.streak, boardSize), boardSize, p2DeckId);");
    expect(deal).toContain("saveStreakDeal(board, pick.id, extras)");
    const code = APP.split("\n").filter((l) => !/^\s*(\/\/|\/?\*)/.test(l)).join("\n");
    expect(code.match(/rollOpponent\(/g), "rolled only inside dealStreakFight").toHaveLength(1);
    // The seat comes from the SAVED deal for the board, never from what the seat
    // last held (a Quick-match pick, a board flipped and back); a deal that
    // still fits keeps its deck, and a stale table is re-dealt around it.
    const reseat = fn("reseatStreak");
    expect(reseat).toContain("const dealt = story.streakDeal?.[String(board)];");
    expect(reseat).toContain("setP2DeckId(dealt.id);");
    expect(reseat).toContain("extrasFit(dealt.extras, tier, board, dealt.id)");
  });

  it("a table's bonus is paid from the FINISHED match, and quoted by the same function", () => {
    expect(APP).toContain("const foes = seatsOf(game).length - 1;");
    expect(APP).toContain("tableWinPay(duelPay, game.boardSize, foes) - duelPay");
    // Gauntlet: through settleArena, which pays it on a live seat only.
    expect(APP).toContain("tableBonus: tableExtra(SHARDS_PER_WIN.arena),");
    // Streak: on a counted win, on top of the flat win and the ladder bonus.
    expect(APP).toContain("climb.bonus + (won ? tableExtra(SHARDS_PER_WIN.arena + climb.bonus) : 0)");
    // The matchmaker panel and the win screen quote it the same way.
    expect(APP.split("tableWinPay(SHARDS_PER_WIN.arena").length - 1, "quoted in two places").toBe(2);
  });

  it("the 7x7 is picked in the settings row — hidden only on casual Domination, which IS it", () => {
    expect(APP).toContain('board={arenaView === "domination" ? null : {');
    // The separate Duel / Domination toggle is gone from the screens.
    expect(APP).not.toContain("ArenaFormat");
    expect(APP).not.toContain("pickArenaFormat");
  });
});

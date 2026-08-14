import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AutoMode, EnchantMode, GameState, Intent, PlayerId, Pos } from "../engine";
import {
  advance,
  applyIntent,
  canAoeRow,
  canCastSpell,
  canFireSpecial,
  canFireTalent,
  canMove,
  canSummon,
  cardAt,
  createInitialState,
  effectiveBasicHits,
  effectiveDmg,
  effectiveSpecialCost,
  enemyOf,
  FLOW_MODES,
  getDef,
  getSpell,
  spellPickKind,
  homeRow,
  liquidGivesHit,
  legalMoves,
  legalWallRows,
  needsInput,
  needsP1Input,
  openHomeSlots,
  previewOnSummonArea,
  spellEnemyTargets,
  spellAllyTargets,
  specialTargets,
  validAllyTargets,
  validTargets,
  distributeBasicHits,
  boardCards,
  isCaptured,
  SPELLS,
  spellbookFor,
} from "../engine";
import { joinRoom, onlineConfigured, type Role, type Room } from "../net/online";
import { Board } from "./Board";
import { CardView } from "./CardView";
import { autoPrefFor } from "./auto-prefs";
import { DeckBuilder } from "./DeckBuilder";
import { REGION_TRACK, useGameMusic, type MusicTrack } from "./useGameMusic";
import { RulesBook } from "./RulesBook";
import { loadCustomDecks, PREMADE_DECKS, premadeDecksFor, type CustomDeck } from "../data/custom-decks";
import { SpIcon } from "./icons";
import { Hand } from "./Hand";
import { PhaseRibbon } from "./PhaseRibbon";
import { ResourcePool } from "./ResourcePool";
import { SpeedQueue } from "./SpeedQueue";
import { SpellTray } from "./SpellTray";
import { announces, SummonAnnounce } from "./SummonAnnounce";
import { SpellCastFlash } from "./SpellCastFlash";
import { WinScreen } from "./WinScreen";
import { EL_COLOR, EL_ICON, type PendingBattle, type Selection } from "./shared";
import { StoryCollection } from "./StoryCollection";
import { StoryMap } from "./StoryMap";
import { StoryRegions } from "./StoryRegions";
import { StoryResult } from "./StoryResult";
import { StoryPrep } from "./StoryPrep";
import { BottomNav, type Tab } from "./BottomNav";
import { ActionWheel, type WheelVerb } from "./ActionWheel";
import { Shop } from "./Shop";
import {
  PLAYER_DEPLOY, ENEMY_DEPLOY, REGIONS, applyClear, boardForNode, buildFormation, deckCapFor,
  STANDARD_CAP, BIG_BOARD_CAP,
  loadStory, isFirstBattle, awardShards, heroBookFor, poolForRegion, recruitablePool, squadCapInRegion,
  regionOfNode, rollRecruits, saveStory, type StoryNode, type StorySave,
} from "../data/story";

function newSeed(): number {
  return (Math.random() * 0x7fffffff) | 0;
}

/** The portrait-phone tier, mirroring the CSS query EXACTLY.
 *
 *  Needed because the Battle Log is two different things on the two tiers: a
 *  full scrollable rail on desktop, and a one-line strip that opens that rail
 *  on tap on a phone. Only the strip should be a button — announcing a
 *  scrollable panel as a button to a screen reader on desktop is a lie, and
 *  putting a click handler on it there would swallow text selection.
 *
 *  Subscribed, not read once: the app is one page and a rotation has to move
 *  the affordance with the layout. (App's own `logCollapsed` initializer reads
 *  matchMedia without a listener, which is why THAT one goes stale on rotate.) */
const PORTRAIT_QUERY = "(max-width: 760px) and (min-height: 541px)";
function usePortraitPhone(): boolean {
  const [on, setOn] = useState(
    () => typeof window !== "undefined" && (window.matchMedia?.(PORTRAIT_QUERY).matches ?? false),
  );
  useEffect(() => {
    const mq = window.matchMedia?.(PORTRAIT_QUERY);
    if (!mq) return;
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return on;
}

/** Turn-taking noise ("P1 passes.", "Battle! Queue: 4 card(s).") that floods the
 *  rail and buries the events players actually care about. Matched lines are
 *  dimmed; everything else (summons, kills, damage, statuses) reads as an event. */
const LOG_CHATTER = /\bpasses\b|priority|^Battle! Queue|preps first|Opening hands|draws \d|mulligans/i;

/** Collapse CONSECUTIVE identical log lines into one row with a ×N counter, so a
 *  run of "P1 passes. P2 passes. P1 passes." reads as a single line. */
function condenseLog(lines: string[]): { text: string; count: number; chatter: boolean }[] {
  const out: { text: string; count: number; chatter: boolean }[] = [];
  for (const text of lines) {
    const last = out[out.length - 1];
    if (last && last.text === text) last.count++;
    else out.push({ text, count: 1, chatter: LOG_CHATTER.test(text) });
  }
  return out;
}

export function App() {
  const [game, setGame] = useState<GameState>(() => createInitialState(newSeed()));
  const [sel, setSel] = useState<Selection>(null);
  const [pending, setPending] = useState<PendingBattle>(null);
  const [picks, setPicks] = useState<string[]>([]);
  // A summon awaiting confirmation: the chosen hand card + home column. While
  // set, the board previews the on-summon damage area (red) and shows a confirm.
  const [staged, setStaged] = useState<{ handId: string; col: number } | null>(null);
  // Drag-to-summon: the hand card being dragged + the home column under the
  // cursor. Drives a LIVE on-summon area preview (red) as you drag over slots.
  const [drag, setDrag] = useState<string | null>(null);
  const [dragCol, setDragCol] = useState<number | null>(null);
  // Mobile: which edge panel is open (Battle Log left / Spells right). Desktop
  // shows both inline, so this stays null there.
  const [mobilePanel, setMobilePanel] = useState<"log" | "spells" | null>(null);
  const [hint, setHint] = useState<string>(
    "Mulligan: click cards to send back, then confirm.",
  );
  const [mullToss, setMullToss] = useState<string[]>([]);
  const [surrenderArmed, setSurrenderArmed] = useState(false);
  // Battle Log collapses to a thin strip to give the battlefield more room.
  // Defaults collapsed on short (landscape-phone) viewports, open on desktop.
  const [logCollapsed, setLogCollapsed] = useState(
    () => typeof window !== "undefined" && (window.matchMedia?.("(max-height: 540px)").matches ?? false),
  );

  // The log is a tap-to-open STRIP only on the portrait tier; everywhere else it
  // is already the full rail and must stay a plain scrollable panel.
  const portrait = usePortraitPhone();
  const logIsStrip = portrait && mobilePanel !== "log";
  // Card inspector: clicking a played card opens a read-only detail panel.
  const [detailId, setDetailId] = useState<string | null>(null);
  // Spell cast animation: when I cast, we hold the intent, flash the spell art
  // full-screen for ~2s, then dispatch so the effect resolves. `castTimerRef`
  // guards against a second cast landing mid-flash + clears on unmount.
  const [castFlash, setCastFlash] = useState<{ spellId: string } | null>(null);
  const castTimerRef = useRef<number | null>(null);
  // Opponent casts (AI / online-remote) resolve outside castSpell, so we detect
  // a newly-used spell in their book and flash its art too — with its own timer
  // so it never clobbers a local flash-then-cast in flight.
  const oppFlashTimerRef = useRef<number | null>(null);
  const prevOppUsedRef = useRef<Set<string>>(new Set());
  // Powerful-creature entrance: legendary and above get their art announced
  // full-screen. My own summon holds the intent and dispatches AFTER the
  // announcement (a true preview); the opponent's resolves outside our dispatch,
  // so those are detected on arrival — see the effect below.
  const [announce, setAnnounce] = useState<{ defId: string; mine: boolean } | null>(null);
  const announceTimerRef = useRef<number | null>(null);
  const seenBigRef = useRef<Set<string>>(new Set());
  // A modal "choice" spell (Chill) awaiting its mode pick (attack vs shield).
  const [spellChoice, setSpellChoice] = useState<string | null>(null);
  // Prism's Enchantment: the instanceId waiting on a four-way pick. Without a
  // picker the Special is literally uncastable by hand — the same shape as the
  // trap column and Rewire's card picks, both of which shipped unreachable.
  const [enchantFor, setEnchantFor] = useState<string | null>(null);
  // Rewire / Full Reroute: the only spells that pick more than one thing.
  // `ids` are the cards being moved; `slots` their destinations, index-matched.
  // Reroute alternates card -> slot -> card -> slot; Rewire collects two cards
  // and no slots, because the pair simply trade squares.
  const [spellPicks, setSpellPicks] = useState<{ ids: string[]; slots: Pos[] }>({ ids: [], slots: [] });
  // Pre-game deck selection — the match doesn't run until Start.
  const [started, setStarted] = useState(false);
  const [twoPlayer, setTwoPlayer] = useState(false);

  /** Battlefield size for the NEXT match. 4 = standard, 5 = the large board.
   *  Online: only the host's choice counts — the guest receives the host's whole
   *  state, board size included, so there is nothing to agree on. */
  const [boardSize, setBoardSize] = useState(4);
  // Online PvP over Supabase Realtime. `online` is set once a room is live.
  const [online, setOnline] = useState<{ role: Role; code: string; myId: PlayerId } | null>(null);
  const [onlineMode, setOnlineMode] = useState(false); // setup screen: online vs local
  const [onlineRole, setOnlineRole] = useState<Role>("host");
  const [roomCode, setRoomCode] = useState("");
  const [netStatus, setNetStatus] = useState("");
  const roomRef = useRef<Room | null>(null);
  const onlineStartedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [viewDeck, setViewDeck] = useState<"p1" | "p2">("p1"); // which deck's cards to preview
  const [customDecks, setCustomDecks] = useState<CustomDeck[]>(() => loadCustomDecks());
  const [builderOpen, setBuilderOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  // ── Story Mode ──────────────────────────────────────────────────────────
  // `storyNode` is the node the CURRENT match was launched from; it's what turns
  // a win into a recruitment roll. Null means this is an ordinary skirmish and
  // nothing should be recruited from it.
  const [story, setStory] = useState<StorySave>(() => loadStory());
  const [storyOpen, setStoryOpen] = useState(false);
  /** Which of the four out-of-match destinations is showing. Story keeps its own
   *  `storyOpen` flag because the map owns the whole screen when it is up; the
   *  tab just drives it. */
  const [tab, setTab] = useState<Tab>("home");
  // The collection sits ON TOP of the map rather than replacing it, so
  // "Show" on a card can hand a node back to the map underneath.
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [mapFocusNode, setMapFocusNode] = useState<string | null>(null);
  const [regionId, setRegionId] = useState<string>(REGIONS[0].id);
  // The map-selection screen. Story lands on the MAP, not the picker: continuing
  // where you left off is the common case, and a chooser between you and it
  // every single time is a toll on the thing you do most.
  const [regionsOpen, setRegionsOpen] = useState(false);
  const region = REGIONS.find((r) => r.id === regionId) ?? REGIONS[0];
  const [storyNode, setStoryNode] = useState<StoryNode | null>(null);
  // A node awaiting the prep screen. Tapping a node no longer launches the
  // battle — it opens prep, and prep launches.
  const [prepNode, setPrepNode] = useState<StoryNode | null>(null);
  // Campaign team building happens in the REAL deck builder. The collection is
  // the browser — what you own and where the rest of it is — and deliberately
  // has no editing of its own, so there is exactly one way to add a card.
  const [storyBuilder, setStoryBuilder] = useState(false);
  // Away from a region you hold, the builder may only offer the squad you
  // packed — otherwise a team could be built here out of cards that are a
  // border away, and the squad would only bind at the prep screen. Falls back
  // to the collection when nothing is packed for here, so the builder is never
  // an empty shelf.
  /** The local player's foils, as a set for the board to test against. Derived
   *  from the campaign save even in the Arena: a shiny is yours wherever you
   *  play it, and the Arena deck is drawn from the same cards. */
  const foilIds = useMemo(() => new Set(story.hero?.shiny ?? []), [story.hero?.shiny]);
  const storyPool = poolForRegion(story, region);
  const storyBuilderOwned = storyPool.length ? storyPool : story.collection;
  const storyBuilderCap = Math.min(
    Math.max(STANDARD_CAP, Math.min(deckCapFor(story.cleared), BIG_BOARD_CAP)),
    squadCapInRegion(story.cleared, region) ?? Number.POSITIVE_INFINITY,
  );
  const [storyResult, setStoryResult] = useState<
    { node: StoryNode; won: string[]; captured: number; lost?: boolean } | null
  >(null);

  // Background music. A story region owns the sound for BOTH its map and its
  // battles, so the region reads as a place rather than a series of fights; a
  // story battle therefore keeps its region theme instead of dropping to Rival.
  // Everything outside Story Mode is the old menu/battle pair.
  const storyRegionId = storyNode ? regionOfNode(storyNode.id)?.id : storyOpen ? region.id : undefined;
  const musicTrack: MusicTrack =
    (storyRegionId ? REGION_TRACK[storyRegionId] : undefined) ??
    (started && game.phase !== "gameover" ? "battle" : "menu");
  const { muted: musicMuted, toggle: toggleMusic } = useGameMusic(musicTrack);
  // Deck selection = a premade or custom deck (the old two-core pairing is gone).
  // Each side defaults to a different premade so a match is one tap away.
  // Seeded from the STANDARD builds — boardSize starts at 4, and the remap
  // effect below re-points these if the player switches battlefield.
  const [p1DeckId, setP1DeckId] = useState(premadeDecksFor(4)[0].id);
  const [p2DeckId, setP2DeckId] = useState(premadeDecksFor(4)[1].id);
  // Premade builds sized for the CHOSEN battlefield — a 28-card large build must
  // never show up in a 4x4 picker, and vice versa.
  const modePremades = premadeDecksFor(boardSize);
  // Selectable decks = those + the player's own custom decks. Custom decks have
  // no board size of their own and are offered in both modes; the engine never
  // enforces deck length at match start, so a short deck simply runs out sooner.
  const deckPool: CustomDeck[] = [...modePremades, ...customDecks];
  // Resolve a side's card list / label; fall back to the first premade if a
  // selection ever goes missing (e.g. a custom deck deleted mid-session).
  const resolveDeckCards = (deckId: string): string[] =>
    (deckPool.find((d) => d.id === deckId) ?? modePremades[0]).cards;
  // A deck's hand-picked spellbook. `undefined` is passed through UNCHANGED so
  // the engine can tell "this deck never picked spells" (derive from elements)
  // from "it picked none" (play with none). Flattening both to [] here is what
  // gave a spell-less deck the whole elemental set in battle.
  const resolveDeckSpells = (deckId: string): string[] | undefined =>
    (deckPool.find((d) => d.id === deckId) ?? modePremades[0]).spells;
  const deckLabel = (deckId: string): string =>
    (deckPool.find((d) => d.id === deckId) ?? modePremades[0]).name;

  // Switching battlefield re-points a premade selection at the same archetype's
  // build for the new size (Inferno Blitz 4x4 <-> Inferno Blitz 5x5) rather than
  // dumping the player back to the first deck. Custom decks are left alone.
  useEffect(() => {
    const remap = (id: string): string => {
      if (modePremades.some((d) => d.id === id)) return id;
      if (customDecks.some((d) => d.id === id)) return id;
      const base = id.endsWith("_5") ? id.slice(0, -2) : id;
      const want = boardSize === 5 ? `${base}_5` : base;
      return modePremades.some((d) => d.id === want) ? want : modePremades[0].id;
    };
    setP1DeckId(remap);
    setP2DeckId(remap);
    // modePremades is derived from boardSize; depending on it directly would
    // re-run every render since it's a fresh array each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSize, customDecks]);

  // The human who must act right now (null while an AI acts or a phase
  // animates). `view` holds the last active human so the hand/pools/labels
  // don't flicker between turns; in vs-AI mode it's always P1.
  // Whose input the game needs; online, I only act on MY turn (else null).
  const actor = started ? needsInput(game) : null;
  const me = online ? (actor === online.myId ? online.myId : null) : actor;
  const [viewSide, setViewSide] = useState<PlayerId>("P1");

  // A story battle resolves into recruitment rather than the normal win screen.
  // A LOSS costs nothing but time — Story Mode is where you experiment, and Void
  // Tower owns run-loss stakes — so it drops back to the map with no roll.
  useEffect(() => {
    if (!started || !storyNode || game.phase !== "gameover" || storyResult) return;
    if (game.win?.winner !== "P1") {
      // A loss still stops on the result card. It used to bounce straight to the
      // map, which told you neither what beat you nor how close it was — and the
      // match report is the whole reason to re-fight a node differently.
      setStoryResult({ node: storyNode, won: [], captured: 0, lost: true });
      return;
    }
    const captured = game.slots.flat().filter((sl) => sl.capturedBy === "P1").length;
    const result = rollRecruits(story, storyNode, captured);
    setStory((prev) => {
      // Shards for the win, then the clear. The Arena pays too (below) — shards
      // are the one currency you can earn without walking the campaign.
      const next = applyClear(awardShards(prev, "story"), storyNode, result);
      saveStory(next);
      return next;
    });
    setStoryResult({ node: storyNode, won: result.won, captured });
  }, [started, storyNode, game, storyResult, story]);
  // An Arena win pays shards too, once per match. Without this the Arena is a
  // sandbox with no thread to progression, and "buy enough booster packs" has
  // only one place to earn from.
  const paidForMatch = useRef<GameState | null>(null);
  useEffect(() => {
    if (!started || storyNode) return;                 // story pays on its own path
    if (game.phase !== "gameover" || game.win?.winner !== "P1") return;
    if (paidForMatch.current === game) return;         // one payout per match
    paidForMatch.current = game;
    setStory((prev) => {
      const next = awardShards(prev, "arena");
      saveStory(next);
      return next;
    });
  }, [started, storyNode, game]);

  useEffect(() => {
    if (me) setViewSide(me);
  }, [me]);
  // Online: the board is always shown from MY side; local: follow the active human.
  const view: PlayerId = online ? online.myId : (me ?? viewSide);

  // Auto-advance the non-interactive steps. Local: whoever's driving advances
  // whenever no human is needed. Online: ONLY the host advances the shared
  // no-input steps (and broadcasts) so the two clients never double-apply.
  useEffect(() => {
    if (!started || game.phase === "gameover") return;
    if (online) {
      if (online.role !== "host" || needsInput(game) !== null) return;
    } else if (needsP1Input(game)) {
      return;
    }
    // Pace the AI to the on-screen theatrics: while a summon announcement or a
    // spell cast-flash is playing, hold the next step until it clears. The AI
    // used to fire every ~480ms regardless, so back-to-back announce-worthy
    // plays landed on top of each other — the second got skipped or clobbered
    // mid-flight. Waiting the full overlay out lets each entrance actually show.
    const showing = announce !== null || castFlash !== null;
    const delay = showing ? 2200 : game.phase === "battle" ? 480 : 260;
    const t = setTimeout(() => {
      const next = advance(game);
      setGame(next);
      if (online) broadcast(next);
    }, delay);
    return () => clearTimeout(t);
  }, [game, started, online, announce, castFlash]);

  // Reliability heartbeat: whichever side currently "owns" the state (the player
  // who must act, or the host during a no-input step) re-broadcasts it every few
  // seconds, so a dropped/slow Realtime message self-heals instead of stalling.
  // Only the owning side heartbeats, so the two never fight over the state.
  useEffect(() => {
    if (!online || !started || game.phase === "gameover") return;
    const owns = actor === online.myId || (online.role === "host" && actor === null);
    if (!owns) return;
    const t = setInterval(() => roomRef.current?.sendState(game), 2500);
    return () => clearInterval(t);
  }, [online, started, game, actor]);

  // Keep the hint fresh on phase/priority flips.
  const phaseKey = `${game.phase}:${game.prep?.priority ?? ""}:${game.battle?.awaitingInput ?? ""}`;
  const prevPhaseKey = useRef(phaseKey);
  useEffect(() => {
    if (prevPhaseKey.current === phaseKey) return;
    prevPhaseKey.current = phaseKey;
    setSel(null);
    setPending(null);
    setPicks([]);
    setSurrenderArmed(false);
    setDetailId(null);
    setMobilePanel(null); // close any mobile edge panel on a phase/turn flip
    const actor = needsInput(game);
    // Online: it's "my turn" only when the actor is my own side.
    const mine = online ? actor === online.myId : true;
    if (game.opening && actor && mine)
      // Deployment reuses the prep phase, so without this the player is told to
      // "move one board card" during the one turn where nothing may move.
      setHint(
        `<b>Lead with a teammate.</b> Place <b>${game.opening[actor]}</b> more — it's free. ` +
        `Nothing moves yet. Then Pass and the round begins.`,
      );
    else if (game.phase === "prep" && actor && mine)
      setHint(
        `<b>${!online && twoPlayer ? `${actor} prep turn` : "Your prep turn"}.</b> Click a glowing hand card to summon (any number), move one board card, then Pass.`,
      );
    else if (game.phase === "prep") setHint(online ? "⏳ Waiting for your opponent…" : "Opponent has priority…");
    else if (game.battle?.awaitingInput) {
      const card = game.cards[game.battle.awaitingInput];
      const def = getDef(card.defId);
      if (online && !mine) setHint(`⏳ ${def.name} (opponent) is up…`);
      else
        setHint(
          `<b>${def.name} is up${!online && twoPlayer ? ` (${card.owner})` : ""}.</b> Choose Basic, Special, or Skip.`,
        );
    }
  }, [phaseKey, game, twoPlayer, online]);

  function broadcast(state: GameState) {
    roomRef.current?.sendState(state);
  }

  function dispatch(intent: Intent) {
    try {
      const next = applyIntent(game, intent);
      setGame(next);
      setSel(null);
      setPending(null);
      setPicks([]);
      setSpellPicks({ ids: [], slots: [] }); // never carry a half-built cast over
      setStaged(null);
      if (online) broadcast(next); // sync my move to the other client
    } catch (e) {
      setHint(`⚠ ${(e as Error).message}`);
    }
  }

  // Cast a spell with a 2-second art flash, THEN resolve it. Every human cast
  // (heal/board-AoE on pick; wall/row-AoE + damage on slot-click) routes through
  // here so the spell's art gets its moment before the board changes. The intent
  // is captured now and dispatched against the same (still-my-priority) state.
  function castSpell(intent: Extract<Intent, { type: "CAST_SPELL" }>, doneHint: string) {
    if (castTimerRef.current !== null) return; // a cast is already flashing
    const spell = getSpell(intent.spellId);
    setSel(null);
    setPending(null);
    setPicks([]);
    setCastFlash({ spellId: spell.id });
    setHint(`Casting <b>${spell.name}</b>…`);
    castTimerRef.current = window.setTimeout(() => {
      castTimerRef.current = null;
      setCastFlash(null);
      dispatch(intent);
      setHint(doneHint);
    }, 2000);
  }
  // Clear pending flash timers if the app unmounts mid-cast.
  useEffect(() => () => {
    if (castTimerRef.current !== null) window.clearTimeout(castTimerRef.current);
    if (oppFlashTimerRef.current !== null) window.clearTimeout(oppFlashTimerRef.current);
    if (announceTimerRef.current !== null) window.clearTimeout(announceTimerRef.current);
  }, []);

  // Show the opponent's spell casts too. Their book's `used` flags flip when the
  // AI/remote casts (outside castSpell), so diff for a freshly-used spell and
  // flash its art. Hot-seat: both sides cast locally, so castSpell already covers
  // it. Skipped while a local flash-then-cast is mid-flight (don't interrupt it).
  useEffect(() => {
    const opp: PlayerId | null = online ? enemyOf(online.myId) : twoPlayer ? null : "P2";
    if (!opp) return;
    const book = game.players[opp]?.spellbook ?? [];
    const nowUsed = new Set(book.filter((s) => s.used).map((s) => s.defId));
    let fresh: string | null = null;
    for (const id of nowUsed) if (!prevOppUsedRef.current.has(id)) { fresh = id; break; }
    prevOppUsedRef.current = nowUsed; // resets naturally to {} on a new match
    if (fresh && castTimerRef.current === null) {
      setCastFlash({ spellId: fresh });
      if (oppFlashTimerRef.current !== null) window.clearTimeout(oppFlashTimerRef.current);
      oppFlashTimerRef.current = window.setTimeout(() => { oppFlashTimerRef.current = null; setCastFlash(null); }, 2000);
    }
  }, [game, online, twoPlayer]);

  // Announce the OPPONENT's powerful creatures. Their summons resolve outside
  // confirmSummon (AI / remote), so we diff the board for a legendary+ instance
  // we have not seen before. Keyed by instanceId, which is unique per summon, so
  // a card that leaves and is re-summoned announces again — but the same card
  // sitting on the board across renders never re-fires. Skipped while a local
  // announcement or cast flash is mid-flight so nothing gets clobbered.
  useEffect(() => {
    if (!started) return;
    const opp: PlayerId | null = online ? enemyOf(online.myId) : twoPlayer ? null : "P2";
    let fresh: string | null = null;
    for (const c of Object.values(game.cards)) {
      if (!c.pos) continue;
      // Keyed by instanceId (unique per summon), so a card sitting on the board
      // across renders never re-fires, while a re-summoned one announces again.
      // EVERY new card is marked seen, mine included — my own already got its
      // preview in confirmSummon, and the owner check below skips it regardless.
      if (seenBigRef.current.has(c.instanceId)) continue;
      seenBigRef.current.add(c.instanceId);
      if (opp && c.owner === opp && announces(c.defId) && fresh === null) fresh = c.defId;
    }
    if (fresh && announceTimerRef.current === null && castTimerRef.current === null) {
      setAnnounce({ defId: fresh, mine: false });
      announceTimerRef.current = window.setTimeout(() => {
        announceTimerRef.current = null;
        setAnnounce(null);
      }, 2000);
    }
  }, [game, online, twoPlayer, started]);

  // A new match wipes the board; forget what we announced so the next game's
  // legendaries get their entrance too.
  useEffect(() => {
    if (!started) seenBigRef.current = new Set();
  }, [started]);

  // ── online rooms ──────────────────────────────────────────────────────────
  function hostCreateRoom() {
    if (!onlineConfigured) {
      setNetStatus("⚠ Online isn't configured — set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.");
      return;
    }
    const code = (roomCode.trim() || Math.random().toString(36).slice(2, 7)).toUpperCase();
    setRoomCode(code);
    const hostCards = resolveDeckCards(p1DeckId);
    const hostSpells = resolveDeckSpells(p1DeckId);
    // Snapshotted like the deck above: onJoin fires much later, and reading
    // `boardSize` from the closure then would take whatever the picker showed
    // at join time rather than what the host actually opened the room with.
    const hostBoardSize = boardSize;
    setNetStatus(`Room ${code} open — share this code. Waiting for your buddy…`);
    onlineStartedRef.current = false;
    roomRef.current = joinRoom(code, "host", {
      onState: (state) => setGame(state),
      onJoin: (guestCards, guestSpells) => {
        if (onlineStartedRef.current) return; // already playing — ignore re-joins
        onlineStartedRef.current = true;
        const g = createInitialState(newSeed(), hostCards, guestCards, ["P1", "P2"], hostSpells, guestSpells, hostBoardSize);
        setGame(g);
        setViewSide("P1");
        setSel(null); setPending(null); setPicks([]); setMullToss([]);
        setHint("Buddy joined! Mulligan: click cards to send back, then confirm.");
        setOnline({ role: "host", code, myId: "P1" });
        setStarted(true);
        roomRef.current?.sendState(g); // deal the opening state to the guest
      },
    });
    setOnline({ role: "host", code, myId: "P1" });
  }

  function guestJoinRoom() {
    if (!onlineConfigured) {
      setNetStatus("⚠ Online isn't configured — set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.");
      return;
    }
    const code = roomCode.trim().toUpperCase();
    if (!code) { setNetStatus("Enter the room code your buddy shared."); return; }
    const guestCards = resolveDeckCards(p2DeckId);
    const guestSpells = resolveDeckSpells(p2DeckId);
    setNetStatus(`Joining ${code}…`);
    onlineStartedRef.current = false;
    roomRef.current = joinRoom(code, "guest", {
      onState: (state) => {
        setGame(state);
        if (!onlineStartedRef.current) {
          onlineStartedRef.current = true;
          setViewSide("P2");
          setSel(null); setPending(null); setPicks([]); setMullToss([]);
          setHint("Connected! Mulligan: click cards to send back, then confirm.");
          setOnline({ role: "guest", code, myId: "P2" });
          setStarted(true);
        }
      },
      onSubscribed: () => roomRef.current?.sendJoin(guestCards, guestSpells),
    });
    setOnline({ role: "guest", code, myId: "P2" });
  }

  function leaveOnline() {
    roomRef.current?.close();
    roomRef.current = null;
    onlineStartedRef.current = false;
    setOnline(null);
    setNetStatus("");
  }
  // Tear the channel down if the tab closes / component unmounts.
  useEffect(() => () => roomRef.current?.close(), []);

  // Publish the live height of the bottom control bar as `--bar-h` on :root. The
  // mobile floating hand anchors above it (calc(var(--bar-h) + …)), so it clears
  // the bar no matter how tall it renders (button wrap, safe-area, phone size).
  // Synced before paint on every render (the bar remounts across phases and its
  // height flips with the compact class), and a ResizeObserver — re-pointed at
  // the current node each render — catches reflows that happen without a render
  // (orientation change, mobile address-bar show/hide).
  const barRoRef = useRef<ResizeObserver | null>(null);
  useLayoutEffect(() => {
    const bar = bottomRef.current;
    if (!bar) return;
    const apply = () =>
      document.documentElement.style.setProperty("--bar-h", `${Math.round(bar.getBoundingClientRect().height)}px`);
    apply();
    barRoRef.current?.disconnect();
    if (typeof ResizeObserver !== "undefined") {
      barRoRef.current = new ResizeObserver(apply);
      barRoRef.current.observe(bar);
    }
  });
  useEffect(() => () => barRoRef.current?.disconnect(), []);

  // Confirm / cancel a staged summon placement.
  function confirmSummon() {
    if (!staged || me === null) return;
    const staging = game.players[me].hand.find((h) => h.handId === staged.handId);
    const intent: Intent = {
      type: "SUMMON", player: me, handId: staged.handId, col: staged.col,
      // The player's remembered default for this card, if they set one. Read
      // here and sent WITH the intent, so the engine stays pure and an online
      // peer replaying it lands on the same mode.
      autoMode: staging ? autoPrefFor(staging.defId) : undefined,
    };
    const card = game.players[me].hand.find((h) => h.handId === staged.handId);
    // A legendary+ gets its art up BEFORE it lands, the same hold-then-dispatch
    // the spell flash uses. Guarded on the timer so a second summon can't land
    // mid-announcement and dispatch out of order.
    if (card && announces(card.defId) && announceTimerRef.current === null) {
      const defId = card.defId;
      setStaged(null);
      setSel(null);
      setAnnounce({ defId, mine: true });
      setHint(`Summoning <b>${getDef(defId).name}</b>…`);
      announceTimerRef.current = window.setTimeout(() => {
        announceTimerRef.current = null;
        setAnnounce(null);
        dispatch(intent);
        setHint("Summoned. Keep going, or <b>Pass Priority</b>.");
      }, 2000);
      return;
    }
    dispatch(intent);
    setHint("Summoned. Keep going, or <b>Pass Priority</b>.");
  }
  function cancelSummon() {
    setStaged(null);
    setHint("Placement cancelled — pick another slot, or a different card.");
  }

  // Drag-to-summon: grab a hand card, drag over a home slot (live red preview),
  // drop to stage it for confirm.
  function onDragStartCard(handId: string) {
    if (me === null || game.phase !== "prep" || game.prep?.priority !== me) return;
    // Same gate as the tap: some column has to be willing to take the card,
    // otherwise the drag arms a summon with nowhere to drop it.
    if (!openHomeSlots(game, me).some((col) => canSummon(game, me, handId, col).ok)) return;
    setSel({ kind: "hand", handId }); // arm so the legal home slots light up
    setStaged(null);
    setDrag(handId);
    setDragCol(null);
  }
  function onDragEndCard() {
    setDrag(null);
    setDragCol(null);
  }
  function onSlotDragOver(_row: number, col: number) {
    if (dragCol !== col) setDragCol(col);
  }
  function onSlotDrop(_row: number, col: number) {
    if (drag === null || me === null) return;
    const chk = canSummon(game, me, drag, col);
    if (!chk.ok) {
      setHint(`⚠ ${chk.reason ?? "Home row only."}`);
      setDrag(null);
      setDragCol(null);
      return;
    }
    setStaged({ handId: drag, col });
    setDrag(null);
    setDragCol(null);
    setHint("Confirm placement — <b>red</b> marks where its on-summon effect lands.");
  }

  // ── legality highlights ───────────────────────────────────────────────────
  /** Home-row columns that could take a summon at all. Empty = the row is full
   *  (or captured/contested) end to end, so nothing in hand is placeable no
   *  matter what it costs — a board problem, not a Gold problem. */
  const openSlots = useMemo(() => openHomeSlots(game, view), [game, view]);

  /** Which hand cards can actually be summoned right now, asked of the engine
   *  card-by-card over every column — the SAME canSummon that decides which
   *  slots glow. The hand used to answer this itself with `cost <= gold`, which
   *  drifted from the real rule in both directions: with a full home row every
   *  affordable card still lit up and armed a summon no slot would accept (tap
   *  it and the board just sits there), and during the FREE opening deployment
   *  — where Gold is 0 and slots are the currency — every card read as broke. */
  const summonableHandIds = useMemo(() => {
    const out = new Set<string>();
    for (const h of game.players[view].hand) {
      for (let col = 0; col < game.boardSize; col++) {
        if (canSummon(game, view, h.handId, col).ok) {
          out.add(h.handId);
          break;
        }
      }
    }
    return out;
  }, [game, view]);

  const legalSlots: Pos[] = useMemo(() => {
    if (game.phase !== "prep") return [];
    const hr = homeRow(view, game.boardSize);
    if (sel?.kind === "hand") {
      const out: Pos[] = [];
      for (let col = 0; col < game.boardSize; col++)
        if (canSummon(game, view, sel.handId, col).ok)
          out.push({ row: hr, col } as Pos);
      return out;
    }
    if (sel?.kind === "card") return legalMoves(game, view, sel.instanceId);
    if (sel?.kind === "spell") {
      const spell = getSpell(sel.spellId);
      // Full Reroute alternates: after picking a card, every open slot lights up.
      if (spell.rerouteCount && spellPicks.ids.length > spellPicks.slots.length) {
        const open: Pos[] = [];
        for (let r = 0; r < game.boardSize; r++)
          for (let c = 0; c < game.boardSize; c++) {
            const occ = cardAt(game, r, c);
            const vacating = occ != null && spellPicks.ids.includes(occ.instanceId);
            const taken = spellPicks.slots.some((o) => o.row === r && o.col === c);
            if ((!occ || vacating) && !isCaptured(game, r, c) && !taken)
              open.push({ row: r, col: c } as Pos);
          }
        return open;
      }
      if (spell.kind === "trap") {
        // Any empty, uncaptured, untrapped square — anywhere on the board. Range
        // is not the constraint for a mine; the opponent's movement is.
        const slots: Pos[] = [];
        for (let r = 0; r < game.boardSize; r++)
          for (let c = 0; c < game.boardSize; c++)
            if (canCastSpell(game, view, spell.id, { row: r, col: c }).ok)
              slots.push({ row: r, col: c } as Pos);
        return slots;
      }
      if (spell.kind === "wall") {
        // Highlight every slot of each legal row so the whole row glows.
        const out: Pos[] = [];
        for (const r of legalWallRows(game, view, spell))
          for (let col = 0; col < game.boardSize; col++) out.push({ row: r, col } as Pos);
        return out;
      }
      if (spell.kind === "aoe" && spell.area !== "board") {
        // Row / two-row AoE: glow every legal target row.
        const out: Pos[] = [];
        for (let r = 0; r < game.boardSize; r++) {
          if (!canAoeRow(game, view, r)) continue;
          if (spell.area === "tworows" && r + 1 >= game.boardSize) continue;
          for (let col = 0; col < game.boardSize; col++) out.push({ row: r, col } as Pos);
        }
        return out;
      }
    }
    return [];
  }, [game, sel, view]);

  // Which SIDE the armed spell is asking the caster to click, if it wants a card
  // at all. Three separate things read this — which cards glow, what colour they
  // glow, and whether the opponent's team is dimmed — and they each used to
  // re-derive it from `spell.kind`, which is why they disagreed. One answer.
  const armedPickSide = useMemo<"enemy" | "ally" | null>(() => {
    if (sel?.kind !== "spell") return null;
    const spell = getSpell(sel.spellId);
    switch (spellPickKind(spell)) {
      case "enemy": return "enemy";
      case "ally":
      case "cards": return "ally";
      // A modal spell asks for its mode first; the mode decides the side.
      case "mode": return sel.mode === "shield" ? "ally" : sel.mode ? "enemy" : null;
      default: return null; // row / slot / nothing — not a card pick
    }
  }, [sel]);

  const awaitingId = game.battle?.awaitingInput ?? null;
  const legalTargetIds: string[] = useMemo(() => {
    // Prep-phase damage spell armed → its legal enemy targets glow.
    if (sel?.kind === "spell") {
      const spell = getSpell(sel.spellId);
      // Rewire / Full Reroute pick the caster's OWN cards — the ones not yet
      // chosen glow, so the second pick cannot repeat the first.
      if (spell.swapAllies || (spell.rerouteCount && spellPicks.ids.length === spellPicks.slots.length))
        return boardCards(game, view)
          .filter((c) => c.curHp > 0 && !spellPicks.ids.includes(c.instanceId))
          .map((c) => c.instanceId);
      if (armedPickSide === "ally")
        return spellAllyTargets(game, view, spell).map((c) => c.instanceId);
      return armedPickSide === "enemy"
        ? spellEnemyTargets(game, view).map((t) => t.instanceId)
        : [];
    }
    if (!awaitingId || !pending) return [];
    if (pending === "special") {
      const def = getDef(game.cards[awaitingId].defId);
      if (!def.special) return [];
      const list =
        def.special.targetSide === "ally"
          ? validAllyTargets(game, awaitingId)
          : specialTargets(game, awaitingId);
      return list.map((t) => t.instanceId);
    }
    return validTargets(game, awaitingId).map((t) => t.instanceId);
  }, [game, awaitingId, pending, sel, view, armedPickSide, spellPicks]);

  // Enemy targets (basics / attack-specials / damage spells) glow RED; friendly
  // (ally-target heal specials) stay green.
  const targetsAreEnemies = useMemo(() => {
    if (legalTargetIds.length === 0) return false;
    if (sel?.kind === "spell") return armedPickSide === "enemy";
    if (pending === "special" && awaitingId) {
      const side = getDef(game.cards[awaitingId].defId).special?.targetSide;
      return side !== "ally" && side !== "self"; // self-buffs aren't hostile targets
    }
    return true; // basic attack
  }, [legalTargetIds, sel, pending, awaitingId, game, armedPickSide]);

  // The active placement — either a card being DRAGGED over a home column (live
  // preview) or a STAGED summon awaiting confirm. Both drive the same red
  // on-summon area preview + green "place here" slot.
  const activeHandId = staged?.handId ?? drag ?? null;
  const activeCol = staged ? staged.col : dragCol;
  const stagedSlot: Pos | null = useMemo(
    () => (activeHandId !== null && activeCol !== null && me !== null ? ({ row: homeRow(me, game.boardSize), col: activeCol } as Pos) : null),
    [activeHandId, activeCol, me],
  );
  const previewArea: Pos[] = useMemo(() => {
    if (activeHandId === null || activeCol === null || me === null) return [];
    const h = game.players[me].hand.find((c) => c.handId === activeHandId);
    if (!h) return [];
    return previewOnSummonArea(game, getDef(h.defId), me, { row: homeRow(me, game.boardSize), col: activeCol } as Pos);
  }, [activeHandId, activeCol, me, game]);
  // Drop a stale stage if the context changes (different card, phase, priority).
  useEffect(() => {
    if (!staged) return;
    const ok =
      me !== null && game.phase === "prep" && game.prep?.priority === me &&
      sel?.kind === "hand" && sel.handId === staged.handId &&
      game.players[me].hand.some((h) => h.handId === staged.handId);
    if (!ok) setStaged(null);
  }, [staged, me, game, sel]);

  // ── interactions ──────────────────────────────────────────────────────────
  function onPickHand(handId: string) {
    if (!me || game.phase !== "prep" || game.prep?.priority !== me) {
      setHint("You can summon during your prep priority turn.");
      return;
    }
    const p = game.players[me];
    const def = getDef(p.hand.find((h) => h.handId === handId)!.defId);
    // Never arm a summon that no slot would take: the hint would send the
    // player hunting for a glowing Home slot that doesn't exist. Ask the engine
    // about a column that IS open, so its refusal is about the card (Gold, the
    // opening ceiling) rather than about whichever square happens to be first.
    const open = openHomeSlots(game, me);
    if (open.length === 0) {
      setHint("⚠ Your Home row is full — move a card forward, or wait for a slot to clear.");
      return;
    }
    const chk = canSummon(game, me, handId, open[0]);
    if (!chk.ok) {
      setHint(
        chk.reason === "Not enough Gold"
          ? `⚠ Not enough Gold for ${def.name} (costs ${def.cost}).`
          : `⚠ ${chk.reason ?? `Can't summon ${def.name} right now.`}`,
      );
      return;
    }
    setSel({ kind: "hand", handId });
    setHint(`Summoning <b>${def.name}</b> — tap a glowing Home slot.`);
  }

  function onPickSpell(spellId: string) {
    if (!me || game.phase !== "prep" || game.prep?.priority !== me) {
      setHint("You can cast spells during your prep priority turn.");
      return;
    }
    const spell = getSpell(spellId);
    // Modal "choice" spell (Chill): pick attack vs shield before targeting.
    if (spell.kind === "choice") {
      setSpellChoice(spellId);
      setHint(`<b>${spell.name}</b> — choose how to cast.`);
      return;
    }
    // Anything that asks the player for nothing resolves on the spot. Read from
    // spellPickKind rather than re-derived here — this decision is duplicated in
    // the highlight and the click handler, and getting it wrong makes a spell
    // uncastable by hand (which it did, twice).
    if (spellPickKind(spell) === "none") {
      const chk = canCastSpell(game, me, spellId, {});
      if (chk.ok) {
        castSpell({ type: "CAST_SPELL", player: me, spellId }, `Cast <b>${spell.name}</b>.`);
      } else {
        setHint(`⚠ ${chk.reason}`);
      }
      return;
    }
    setSel({ kind: "spell", spellId });
    setPending(null);
    setPicks([]);
    setSpellPicks({ ids: [], slots: [] });
    // Walls + row/two-row AoE pick a row; traps pick a single empty SLOT;
    // damage spells pick an enemy.
    const picksRow = spell.kind === "wall" || spell.kind === "aoe";
    setHint(
      spell.swapAllies
        ? `Casting <b>${spell.name}</b> — click two of your own cards to swap them.`
      : spell.rerouteCount
        ? `Casting <b>${spell.name}</b> — click one of your cards, then where it should go.`
      : spell.kind === "trap"
        ? `Setting <b>${spell.name}</b> — click a glowing empty slot. Only you will see it.`
        : picksRow
          ? `Casting <b>${spell.name}</b> — click a glowing row.`
        : spellPickKind(spell) === "ally"
          ? `Casting <b>${spell.name}</b> — click the ${spell.element} ally to bolster.`
          : `Casting <b>${spell.name}</b> — click a glowing enemy target.`,
    );
  }

  // Resolve a modal "choice" spell's mode. EITHER mode then arms a card pick —
  // shield used to fire immediately at whichever ally had the lowest HP, which
  // took the decision away from the caster in the one spell built around making
  // a decision.
  function chooseSpellMode(mode: "attack" | "shield") {
    if (!me || !spellChoice) return;
    const spellId = spellChoice;
    const spell = getSpell(spellId);
    setSpellChoice(null);
    // Fail early only if there is NOTHING to aim this mode at — check
    // AVAILABILITY, not a specific pick. canCastSpell({ mode }) demands a
    // targetId a choice spell can't have yet (the player clicks it next), so it
    // always failed here and the targeting never armed.
    const available =
      mode === "shield"
        ? spellAllyTargets(game, me, spell).length > 0
        : spellEnemyTargets(game, me).length > 0;
    if (!available) {
      setHint(mode === "shield" ? `⚠ No ${spell.element} ally to shield.` : "⚠ No enemy in range.");
      return;
    }
    setSel({ kind: "spell", spellId, mode });
    setPending(null);
    setPicks([]);
    setSpellPicks({ ids: [], slots: [] });
    setHint(
      mode === "shield"
        ? `Casting <b>${spell.name}</b> — click the ${spell.element} ally to shield.`
        : `Casting <b>${spell.name}</b> — click a glowing enemy to freeze.`,
    );
  }

  // Max target picks for the armed action. Basics: assign each of the card's
  // hits (repeats stack). Specials: the `targets` param, but capped at how many
  // valid targets actually exist — a "hit all" sentinel (99) never means "click
  // 99 times", it means "everyone in range".
  const maxPicks = (() => {
    if (!awaitingId || !pending) return 1;
    const def = getDef(game.cards[awaitingId].defId);
    if (pending === "basic") return effectiveBasicHits(game.cards[awaitingId]);
    const cap = Number(def.special?.params?.targets ?? 1);
    return Math.max(1, Math.min(cap, legalTargetIds.length));
  })();

  function firePicks(finalPicks: string[]) {
    if (!awaitingId) return;
    const owner = game.cards[awaitingId].owner;
    // Never issue an action for a card I don't control (online opponent / AI).
    if (me !== owner) return;
    dispatch({
      type: "BATTLE_ACTION",
      player: owner,
      action: pending!,
      targetIds: finalPicks,
    });
  }

  function onSlotClick(row: number, col: number) {
    const clicked = cardAt(game, row, col);

    // Battle-phase target pick — click up to maxPicks targets (repeat a
    // target to stack hits on it); fires automatically at the cap. A click on a
    // non-target card just inspects it (the pick prompt stays armed).
    if (awaitingId && pending) {
      // Area Special previewed: its zone is fixed, so a click just inspects —
      // press Confirm to fire.
      if (pending === "special" && specialAoE) {
        if (clicked) setDetailId(clicked.instanceId);
        return;
      }
      // An armed Talent takes no target, so nothing on the board is glowing and
      // "pick a glowing card" would be a lie. A click inspects; the board is not
      // where the decision is.
      if (pending === "talent") {
        if (clicked) setDetailId(clicked.instanceId);
        else setHint("This Talent takes no target — press <b>Confirm</b> to use it, or <b>Clear</b>.");
        return;
      }
      if (clicked && legalTargetIds.includes(clicked.instanceId)) {
        const next = [...picks, clicked.instanceId];
        if (next.length >= maxPicks) {
          firePicks(next);
        } else {
          setPicks(next);
          setHint(
            `<b>${next.length}/${maxPicks}</b> hits assigned — click more targets (repeat to stack), or press <b>Fire</b>.`,
          );
        }
      } else if (clicked) {
        setDetailId(clicked.instanceId);
      } else {
        setHint("⚠ Not a legal target — glowing cards only.");
      }
      return;
    }

    // Spell cast — a spell is armed. Damage spells hit a glowing enemy; wall
    // spells drop onto any slot of a glowing row (a wall occupies no slot).
    if (me && game.phase === "prep" && game.prep?.priority === me && sel?.kind === "spell") {
      const spell = getSpell(sel.spellId);
      // Rewire: two of your own cards, then they trade squares.
      if (spell.swapAllies) {
        if (!clicked || clicked.owner !== me) {
          setHint("⚠ Pick one of your own cards.");
          return;
        }
        if (spellPicks.ids.includes(clicked.instanceId)) {
          setHint("⚠ Pick a DIFFERENT second card.");
          return;
        }
        const ids = [...spellPicks.ids, clicked.instanceId];
        if (ids.length < 2) {
          setSpellPicks({ ids, slots: [] });
          setHint(`<b>${getDef(clicked.defId).name}</b> selected — now click the card to swap it with.`);
          return;
        }
        const chk = canCastSpell(game, me, sel.spellId, { targetIds: ids });
        if (chk.ok) {
          setSpellPicks({ ids: [], slots: [] });
          castSpell(
            { type: "CAST_SPELL", player: me, spellId: sel.spellId, targetIds: ids },
            `${spell.name} cast. Keep going, or <b>Pass Priority</b>.`,
          );
        } else {
          setSpellPicks({ ids: [], slots: [] });
          setHint(`⚠ ${chk.reason}`);
        }
        return;
      }
      // Full Reroute: alternate card -> destination, up to its limit. It fires
      // as soon as the last pair is complete.
      if (spell.rerouteCount) {
        const needCard = spellPicks.ids.length === spellPicks.slots.length;
        if (needCard) {
          if (!clicked || clicked.owner !== me) {
            setHint("⚠ Pick one of your own cards to move.");
            return;
          }
          if (spellPicks.ids.includes(clicked.instanceId)) {
            setHint("⚠ That card is already being moved.");
            return;
          }
          setSpellPicks({ ids: [...spellPicks.ids, clicked.instanceId], slots: spellPicks.slots });
          setHint(`<b>${getDef(clicked.defId).name}</b> selected — now click where it should go.`);
          return;
        }
        // Placing. The square may be one an earlier pick is vacating.
        const vacating = clicked != null && spellPicks.ids.includes(clicked.instanceId);
        if ((clicked && !vacating) || isCaptured(game, row, col)) {
          setHint("⚠ Pick an open slot.");
          return;
        }
        const slots = [...spellPicks.slots, { row, col } as Pos];
        const ids = spellPicks.ids;
        const done = slots.length >= (spell.rerouteCount ?? 1) || boardCards(game, me).length <= slots.length;
        if (!done) {
          setSpellPicks({ ids, slots });
          setHint(`Placed. Pick another card to move, or <b>Pass Priority</b> to stop.`);
          return;
        }
        const chk = canCastSpell(game, me, sel.spellId, { targetIds: ids, slots });
        setSpellPicks({ ids: [], slots: [] });
        if (chk.ok) {
          castSpell(
            { type: "CAST_SPELL", player: me, spellId: sel.spellId, targetIds: ids, slots },
            `${spell.name} cast. Keep going, or <b>Pass Priority</b>.`,
          );
        } else {
          setHint(`⚠ ${chk.reason}`);
        }
        return;
      }
      // Traps take a single SLOT, not a row — the whole point is the one square.
      if (spell.kind === "trap") {
        const chk = canCastSpell(game, me, sel.spellId, { row, col });
        if (chk.ok) {
          castSpell(
            { type: "CAST_SPELL", player: me, spellId: sel.spellId, row, col },
            `${spell.name} set. Keep going, or <b>Pass Priority</b>.`,
          );
        } else {
          setHint(`⚠ ${chk.reason}`);
        }
        return;
      }
      // Walls + row/two-row AoE spells drop onto any slot of a glowing row.
      if (spell.kind === "wall" || (spell.kind === "aoe" && spell.area !== "board")) {
        const chk = canCastSpell(game, me, sel.spellId, { row });
        if (chk.ok) {
          castSpell({ type: "CAST_SPELL", player: me, spellId: sel.spellId, row }, `${spell.name} cast. Keep going, or <b>Pass Priority</b>.`);
        } else if (clicked) {
          setDetailId(clicked.instanceId);
        } else {
          setHint(`⚠ ${chk.reason}`);
        }
        return;
      }
      // Single-card spells — a damage spell's enemy, or a support spell's ally
      // (including both of Chill's modes). Same shape either way: the click IS
      // the target, and canCastSpell decides whether it's a legal one.
      if (clicked && canCastSpell(game, me, sel.spellId, { targetId: clicked.instanceId, mode: sel.mode }).ok) {
        castSpell({ type: "CAST_SPELL", player: me, spellId: sel.spellId, targetId: clicked.instanceId, mode: sel.mode }, `${spell.name} cast. Keep going, or <b>Pass Priority</b>.`);
      } else if (clicked) {
        setDetailId(clicked.instanceId);
      } else {
        setHint(armedPickSide === "ally" ? "⚠ Pick a glowing ally." : "⚠ Pick a glowing enemy target.");
      }
      return;
    }

    // Summon placement — a hand card is armed; empty Home slots STAGE the summon
    // (a confirm + red on-summon area preview), occupied slots inspect instead.
    if (me && game.phase === "prep" && game.prep?.priority === me && sel?.kind === "hand") {
      if (clicked) {
        setDetailId(clicked.instanceId);
      } else if (canSummon(game, me, sel.handId, col).ok && row === homeRow(me, game.boardSize)) {
        setStaged({ handId: sel.handId, col });
        setHint("Confirm placement — <b>red</b> marks where its on-summon effect lands.");
      } else {
        setHint(`⚠ ${canSummon(game, me, sel.handId, col).reason ?? "Home row only."}`);
      }
      return;
    }

    // Move destination — a board card is armed; green slots complete the move,
    // clicking anything else opens its detail (its Move button re-arms it).
    if (me && game.phase === "prep" && game.prep?.priority === me && sel?.kind === "card") {
      // Try the MOVE before falling back to the inspector, even on an occupied
      // slot. This used to open the card detail for any occupied square and
      // return — written when no move could ever target one. Trample Through
      // (WarPhant) broke that assumption: shoving a weaker enemy makes ITS slot
      // a legal destination, so the shove was unreachable by hand — the square
      // glowed green and clicking it just opened the victim's card.
      const check = canMove(game, me, sel.instanceId, { row, col } as Pos);
      if (clicked && !check.ok) {
        setDetailId(clicked.instanceId);
        return;
      }
      if (check.ok) {
        dispatch({ type: "MOVE", player: me, instanceId: sel.instanceId, to: { row, col } as Pos });
        setHint("Moved (one move per turn). Summon more, or <b>Pass Priority</b>.");
      } else {
        setHint(`⚠ ${check.reason}`);
        setSel(null);
      }
      return;
    }

    // Default: one of your cards that can move THIS turn jumps straight to its
    // movement options (green slots); tap it again to inspect. Anything else
    // (enemy cards, already-moved cards, other phases) opens the inspector.
    if (clicked) {
      const readyToMove =
        me !== null &&
        game.phase === "prep" &&
        game.prep?.priority === me &&
        !game.prep.movedThisTurn &&
        clicked.owner === me &&
        legalMoves(game, me, clicked.instanceId).length > 0;
      if (readyToMove) {
        setSel({ kind: "card", instanceId: clicked.instanceId });
        setHint(
          `Moving <b>${getDef(clicked.defId).name}</b> — tap a green slot, or tap the card again to inspect it.`,
        );
      } else {
        setDetailId(clicked.instanceId);
      }
    }
  }

  // Arm a move from the detail panel (own card, our prep, move still available).
  function armMoveFromDetail(instanceId: string) {
    setDetailId(null);
    if (game.prep?.movedThisTurn) {
      setHint("⚠ Already moved a card this turn. Summon or Pass.");
      return;
    }
    setSel({ kind: "card", instanceId });
    setHint(
      `Moving <b>${getDef(game.cards[instanceId].defId).name}</b> — green slots are in reach.`,
    );
  }

  /** Set one card's auto mode outright. Was a cycler driven by a badge on the
   *  board token; the card panel offers the three modes as named buttons, so
   *  there is nothing left to cycle through blindly. */
  function setCardAuto(instanceId: string, mode: AutoMode) {
    const owner = game.cards[instanceId]?.owner ?? view;
    // Only ever change your OWN cards' auto mode — never the opponent's.
    if (owner !== view) return;
    dispatch({ type: "SET_AUTO", player: owner, instanceId, mode });
  }

  function setGlobalAuto(mode: "manual" | "basic" | "full") {
    let next = game;
    for (const c of Object.values(game.cards)) {
      if (c.owner === view && c.pos)
        next = applyIntent(next, { type: "SET_AUTO", player: view, instanceId: c.instanceId, mode });
    }
    setGame(next);
    if (online) broadcast(next); // keep the other client in sync
  }

  // ── mulligan ──────────────────────────────────────────────────────────────
  const inMulligan =
    started &&
    game.phase === "mulligan" &&
    me !== null &&
    !game.players[me].mulliganDone;

  // ── battle prompt ─────────────────────────────────────────────────────────
  const activeCard = awaitingId ? game.cards[awaitingId] : null;
  const activeDef = activeCard ? getDef(activeCard.defId) : null;
  const specialCheck = awaitingId ? canFireSpecial(game, awaitingId) : { ok: false };
  // What the Special ACTUALLY costs right now — after King Me, Power Grid, and
  // Total Network Control. The engine charges this, so the UI must show it too.
  const specCost =
    activeCard && activeDef?.special ? effectiveSpecialCost(game, activeCard, activeDef.special.cost) : 0;
  const talentCheck = awaitingId ? canFireTalent(game, awaitingId) : { ok: false };
  const basicOk = awaitingId ? validTargets(game, awaitingId).length > 0 : false;
  // An area Special with no manual pick to make (hits everything it reaches):
  // it's previewed on the first click and fired on a Confirm.
  const specialValid =
    awaitingId && activeDef?.special
      ? activeDef.special.targetSide === "ally"
        ? validAllyTargets(game, awaitingId)
        : specialTargets(game, awaitingId)
      : [];
  const specialAoE =
    !!activeDef?.special && Number(activeDef.special.params?.targets ?? 1) >= specialValid.length;

  /* ── the four battle verbs, in one place ──────────────────────────────────
     Hoisted out of the buttons because they are now rendered TWICE: as the
     action row on desktop and as the ring around the acting card on a phone.
     Two copies of "is the Special affordable and what does the second press
     do" is how the two renderings start disagreeing, and the arming rules here
     are exactly the sort of thing nobody re-checks in the second copy. The
     buttons and the wheel are presentation; this is the behaviour. */
  function actBasic() {
    if (!activeCard) return;
    // Don't let a stray tap on Attack wipe targets already picked for a Special
    // (choosing allies to assist / enemies to hit). Keep the selection and say
    // how to switch on purpose.
    if (pending === "special" && picks.length > 0) {
      setHint("⚠ Special targets are still armed — press <b>Clear</b> first to switch to a basic attack.");
      return;
    }
    if (pending === "basic") {
      // Second tap. Targets picked → fire them. None picked → AUTO-FIRE: lowest-
      // HP enemy for a single hit, or a smart spread for a multi-hit volley (no
      // overkill — the same engine helper the AI uses).
      if (picks.length > 0) { firePicks(picks); return; }
      const enemies = validTargets(game, awaitingId!).filter((t) => t.owner !== activeCard.owner);
      firePicks(enemies.length ? distributeBasicHits(game, activeCard, enemies) : []);
      return;
    }
    setPending("basic");
    setPicks([]);
    setHint(
      effectiveBasicHits(activeCard) > 1
        ? `Basic attack: <b>${effectiveBasicHits(activeCard)} hits × ${effectiveDmg(game, activeCard)} DMG</b> — tap up to ${effectiveBasicHits(activeCard)} glowing targets (repeat to stack), or tap <b>Attack</b> again to auto-fire.`
        : "Tap a glowing target, or tap <b>Basic Attack</b> again to auto-fire the nearest.",
    );
  }

  function actSpecial() {
    if (!activeCard || !activeDef?.special) return;
    const spec = activeDef.special;
    // Symmetric to Attack: don't let a stray tap wipe basic-attack targets.
    if (pending === "basic" && picks.length > 0) {
      setHint("⚠ Basic-attack targets are still armed — press <b>Clear</b> first to switch to the Special.");
      return;
    }
    if (pending === "special") {
      // Second press = fire. Area Specials hit the whole previewed zone;
      // targeted ones fire the picks assigned so far.
      if (specialAoE) {
        dispatch({
          type: "BATTLE_ACTION", player: activeCard.owner, action: "special",
          targetIds: specialValid.map((t) => t.instanceId),
        });
      } else if (picks.length > 0) {
        firePicks(picks);
      }
      return;
    }
    // Prism: the Special asks WHICH enchantment before anything else, and takes
    // no target at all.
    if (activeDef.enchanter) {
      setEnchantFor(activeCard.instanceId);
      setHint(`<b>${spec.name}</b> — choose an enchantment.`);
      return;
    }
    const cap = Number(spec.params?.targets ?? 1);
    setPending("special");
    setPicks([]);
    setHint(
      specialAoE
        ? `<b>${spec.name}</b> hits the glowing area — press <b>Confirm</b> to fire.`
        : `<b>${spec.name}</b>${spec.talent ? " (Talent · once per game)" : ` (cost ${specCost})`} — pick up to ${cap} glowing target${cap > 1 ? "s (repeat to stack), or Fire early" : ""}.`,
    );
  }

  function actTalent() {
    if (!activeCard || !activeDef?.talent) return;
    // Two presses, exactly like the Special beside it. This used to fire on the
    // first — on a button whose effect is free, once per game, and gone the
    // moment it resolves. A Special you misfire costs magic you get back next
    // round; a Talent you misfire is spent for the rest of the match.
    if (pending === "talent") {
      dispatch({ type: "BATTLE_ACTION", player: activeCard.owner, action: "talent" });
      setPending(null);
      return;
    }
    if (pending !== null && picks.length > 0) {
      setHint("⚠ Targets are still armed — press <b>Clear</b> first to switch to the Talent.");
      return;
    }
    setPending("talent");
    setPicks([]);
    setHint(
      `<b>${activeDef.talent.name}</b> (Talent · free, once per game) — ` +
      `press <b>Confirm</b> to use it. There is no second one.`,
    );
  }

  function actSkip() {
    if (!activeCard) return;
    dispatch({ type: "BATTLE_ACTION", player: activeCard.owner, action: "skip" });
  }


  const myPrep = me !== null && game.phase === "prep" && game.prep?.priority === me;
  // Gentle nudge: on your prep turn, before you've spent your one move and while
  // nothing else is armed, softly ring the cards that can actually move so a new
  // player can see there's a move to make (and which pieces it's open to). It
  // yields the moment you arm anything — the specific action's green slots take
  // over — so it never fights the targeting UI.
  const movableIds = useMemo(() => {
    const ids = new Set<string>();
    if (!myPrep || me === null || sel !== null || game.prep?.movedThisTurn) return ids;
    for (const c of Object.values(game.cards))
      if (c.owner === me && c.pos && legalMoves(game, me, c.instanceId).length > 0) ids.add(c.instanceId);
    return ids;
  }, [game, myPrep, me, sel]);
  // Idle-turn prompt: on your prep turn, is there ANY play left — a move you
  // haven't spent, a summon you can afford, or a spell you can cast? If not, the
  // only thing to do is Pass, so we nudge that button (below). Computed raw
  // (ignores `sel`) — it's about what's possible this turn, not what's armed.
  const hasAnyPlay = useMemo(() => {
    if (!myPrep || me === null) return true; // never prompt when it isn't my turn
    if (!game.prep?.movedThisTurn)
      for (const c of Object.values(game.cards))
        if (c.owner === me && c.pos && legalMoves(game, me, c.instanceId).length > 0) return true;
    for (const h of game.players[me].hand)
      for (let col = 0; col < game.boardSize; col++)
        if (canSummon(game, me, h.handId, col).ok) return true;
    for (const s of game.players[me].spellbook ?? [])
      if (!s.used && game.players[me].magicPool >= getSpell(s.defId).cost) return true;
    return false;
  }, [game, myPrep, me]);
  // I may drive the battle action panel ONLY when the card that's up is mine —
  // never the opponent's (online) or the AI's. This is the single gate that
  // stops "attacking as the opponent's card".
  const iActBattle = activeCard !== null && me !== null && activeCard.owner === me;

  /** Where the acting card is, so the ring can orbit it.
   *
   *  Measured from the DOM rather than derived from the grid, because the board
   *  is sized by a chain of variables (--board-size, the frame, the seams) and
   *  recomputing that here would be a second source of truth for the same
   *  pixels — one that goes wrong the next time a tier is retuned. The slot
   *  knows where it is; ask it.
   *
   *  Re-measured whenever the acting card changes or the viewport does. The
   *  rAF is because the class lands in the same commit that mounts the ring, so
   *  querying immediately can find the PREVIOUS acting slot. */
  const [wheelAt, setWheelAt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!portrait || !iActBattle || !awaitingId) { setWheelAt(null); return; }
    let live = true;
    const measure = () => {
      if (!live) return;
      const el = document.querySelector(".slot.acting") ?? document.querySelector(".token.acting");
      if (!el) { setWheelAt(null); return; }
      const r = el.getBoundingClientRect();
      setWheelAt({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    };
    // Measure NOW, not in a rAF. useEffect already runs after the DOM is
    // committed, so the acting slot is there — and rAF does not fire at all
    // while the page is not painting (a backgrounded tab, or a devtools pane
    // that is not compositing), which would leave the ring unpositioned and
    // therefore unmounted for the whole turn. The rAF is kept only as a second
    // pass for the case where layout settles a frame late.
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => { live = false; cancelAnimationFrame(raf); window.removeEventListener("resize", measure); };
  }, [portrait, iActBattle, awaitingId, game]);

  /** The same four verbs the action row renders, shortened for a 52px chip.
   *  Seats are top / right / bottom / left in this order — Skip sits at the top
   *  because it is the one you reach for when nothing else is possible, and it
   *  must never be the hardest to find again. */
  /** The ring is actually on screen. The action row keys its own hiding on
   *  this, so if the ring fails to mount for any reason the buttons stay. */
  const wheelUp = portrait && iActBattle && wheelAt !== null;

  const wheelVerbs: WheelVerb[] = activeCard && activeDef
    ? [
        { key: "skip", short: "SKIP", tone: "#8b8fa3", onClick: actSkip,
          title: "Skip this card's turn" },
        { key: "basic", short: pending === "basic" ? (picks.length > 0 ? `FIRE ${picks.length}` : "AUTO") : "ATTACK",
          tone: "#e5533d", disabled: !basicOk, armed: pending === "basic", onClick: actBasic,
          title: basicOk ? "Basic attack" : "Nothing in reach" },
        { key: "special", short: pending === "special" ? (specialAoE ? "CONFIRM" : picks.length > 0 ? `FIRE ${picks.length}` : "SPECIAL") : "SPECIAL",
          tone: "#c9a24b", disabled: !specialCheck.ok, armed: pending === "special", onClick: actSpecial,
          title: activeDef.special
            ? `${activeDef.special.name}: ${activeDef.special.text}`
            : "No special" },
        activeDef.talent
          ? { key: "talent", short: pending === "talent" ? "CONFIRM" : "TALENT", tone: "#9575ff",
              disabled: !talentCheck.ok, armed: pending === "talent", onClick: actTalent,
              title: `${activeDef.talent.name} (free, once per game): ${activeDef.talent.text}` }
          : { key: "card", short: "CARD", tone: "#5b74d8",
              onClick: () => setDetailId(activeCard.instanceId),
              title: "Open this card" },
      ]
    : [];
  // Online only: the opponent is mid-decision — either they hold prep priority,
  // or their card is the one awaiting a battle action. Drives the waiting panel.
  const oppId = online ? enemyOf(online.myId) : null;
  const oppDeciding =
    !!online &&
    ((game.phase === "prep" && game.prep?.priority === oppId) ||
      (activeCard !== null && activeCard.owner === oppId));

  return (
    // `pre-match`: the battle chrome renders unconditionally — it always has —
    // so before a match there was an empty board, an empty log and an idle
    // phase ribbon sitting behind the menus. Harmless when the only menu was a
    // deck picker you passed through in seconds; wrong now that Home, Shop and
    // Story are places you STAY, and leaving Story dropped you onto a deserted
    // battlefield. Hidden by class rather than unmounted so nothing that
    // measures the board on mount has to learn a new lifecycle.
    <div className={`wrap${logCollapsed ? " log-collapsed" : ""}${started ? "" : " pre-match"}${wheelUp ? " wheel-up" : ""}`}>
      <button
        className="music-toggle"
        onClick={toggleMusic}
        title={musicMuted ? "Unmute music" : "Mute music"}
        aria-label={musicMuted ? "Unmute music" : "Mute music"}
      >
        {musicMuted ? "🔇" : "🔊"}
      </button>
      <PhaseRibbon game={game} />

      {/* On a phone this is a ONE-LINE strip under the board, and tapping it
          raises the full rail — which is why the whole thing is a tap target
          rather than the edge tab it replaces. Guarded on the drawer being
          shut so a tap inside the open rail (selecting text, hitting ✕)
          cannot re-open it. On desktop the rail is always full height and the
          handler is inert: .mobile-open only means anything inside the
          portrait query. */}
      <div
        className={`rail log-rail${logCollapsed ? " collapsed" : ""}${mobilePanel === "log" ? " mobile-open" : ""}`}
        role={logIsStrip ? "button" : undefined}
        tabIndex={logIsStrip ? 0 : undefined}
        aria-label={logIsStrip ? "Battle log — open the full rail" : undefined}
        onClick={logIsStrip ? () => setMobilePanel("log") : undefined}
        onKeyDown={
          logIsStrip
            ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMobilePanel("log"); } }
            : undefined
        }
      >
        <button
          className="rail-collapse"
          onClick={() => setLogCollapsed((v) => !v)}
          title={logCollapsed ? "Show battle log" : "Collapse battle log"}
          aria-label={logCollapsed ? "Show battle log" : "Collapse battle log"}
        >
          {logCollapsed ? "☰" : "«"}
        </button>
        <div className="rail-title">
          Battle Log
          <button className="panel-close" onClick={() => setMobilePanel(null)} aria-label="Close">✕</button>
        </div>
        <div className="loglist">
          {condenseLog(game.log.slice(-60)).map((e, i) => (
            <div
              key={i}
              className={[e.text.includes("(P1)") ? "me" : "", e.chatter ? "log-chatter" : "log-event"].filter(Boolean).join(" ")}
            >
              {e.text}
              {e.count > 1 && <span className="log-x">×{e.count}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile-only edge tabs — open the Log (left) / Spells (right) overlays. */}
      <button
        className="edge-tab left"
        onClick={() => setMobilePanel(mobilePanel === "log" ? null : "log")}
      >
        <span>LOG</span>
      </button>
      <button
        className="edge-tab right"
        onClick={() => setMobilePanel(mobilePanel === "spells" ? null : "spells")}
      >
        <span>SPELLS</span>
      </button>

      <Board
        game={game}
        foils={foilIds}
        legalSlots={legalSlots}
        legalTargetIds={legalTargetIds}
        targetsAreEnemies={targetsAreEnemies}
        previewArea={previewArea}
        stagedSlot={stagedSlot}
        pickCounts={picks.reduce<Record<string, number>>((acc, id) => {
          acc[id] = (acc[id] ?? 0) + 1;
          return acc;
        }, {})}
        hasSelection={sel !== null}
        movableIds={movableIds}
        selectedId={sel?.kind === "card" ? sel.instanceId : null}
        actingId={awaitingId}
        grayTeam={
          // Throughout your prep turn, fade the idle opponent's team to ~50% so
          // it's clear those pieces aren't yours to act on. The one exception is
          // a damage spell you're aiming — then the enemy must stay lit to target.
          game.phase === "prep" &&
          me !== null &&
          game.prep?.priority === me &&
          armedPickSide !== "enemy"
            ? enemyOf(me)
            : null
        }
        viewPlayer={view}
        onSlotClick={onSlotClick}
        onSlotDragOver={onSlotDragOver}
        onSlotDrop={onSlotDrop}
      />

      {staged && me !== null && (() => {
        const h = game.players[me].hand.find((c) => c.handId === staged.handId);
        const name = h ? getDef(h.defId).name : "card";
        return (
          <div className="summon-confirm">
            <span className="sc-text">
              Place <b>{name}</b> at column {staged.col + 1}
              {previewArea.length > 0 && <> · <span className="sc-red">red = on-summon strike area</span></>}?
            </span>
            <button className="lockin sc-yes" onClick={confirmSummon}>Confirm</button>
            <button className="ghost sc-no" onClick={cancelSummon}>Cancel</button>
          </div>
        );
      })()}

      {/* Right of the field: the initiative (Speed Queue) rail and the spell
          tray. Source order is tray-first because the mobile path needs it that
          way; on desktop CSS `order` flips them so the queue reads first and the
          spells sit beneath it (see .rightcol in styles.css). */}
      <div className="rightcol">
        {game.phase === "prep" && (
          <SpellTray
            game={game}
            player={view}
            armedSpellId={sel?.kind === "spell" ? sel.spellId : null}
            myTurn={myPrep}
            onPick={onPickSpell}
            vertical
          />
        )}
        <SpeedQueue game={game} />
      </div>

      {/* Mobile: the Spells tab opens the tray as a bottom sheet (spells are prep-only). */}
      {mobilePanel === "spells" && (
        <div className="mobile-sheet" onClick={() => setMobilePanel(null)}>
          <div className="mobile-sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="rail-title">
              Spells
              <button className="panel-close" onClick={() => setMobilePanel(null)} aria-label="Close">✕</button>
            </div>
            {game.phase === "prep" ? (
              <SpellTray
                game={game}
                player={view}
                armedSpellId={sel?.kind === "spell" ? sel.spellId : null}
                myTurn={myPrep}
                onPick={(id) => { onPickSpell(id); setMobilePanel(null); }}
                vertical
              />
            ) : (
              <div className="sheet-empty">Spells can only be cast during your Prep turn.</div>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} className={`bottom${!myPrep && !iActBattle && !oppDeciding && activeCard === null ? " compact" : ""}${iActBattle || oppDeciding ? " acting" : ""}${oppDeciding ? " waiting" : ""}`}>
        <ResourcePool game={game} player={view} />

        <div className="handcol">
        {oppDeciding ? (
          <div className="bprompt oppwait">
            <div className="bp-title">⏳ Waiting for your opponent…</div>
            <div className="bp-text">
              {activeCard && activeDef
                ? `${activeDef.name} is choosing its action.`
                : "They're taking their prep turn."}
            </div>
          </div>
        ) : iActBattle && activeCard && activeDef ? (
          <div className="bprompt">
            <div className="bp-title">
              {activeDef.name} is up{" "}
              <small>
                ⚔{effectiveBasicHits(activeCard) > 1 ? `${effectiveBasicHits(activeCard)}×` : ""}
                {effectiveDmg(game, activeCard) + (activeCard.enchant === "sharpen" ? 5 : 0)} · {activeDef.attackType}
              </small>
              {activeCard.enchant && (
                <span className="ench-chip" title="Enchantment armed — rides the next basic attack">
                  🗡 {activeCard.enchant}
                  {activeCard.enchant === "sharpen" ? " +5 DMG" : activeCard.enchant === "burning" ? " · 2 DOT" : activeCard.enchant === "freezing" ? " · −5 SP" : " · SLEEP 1"}
                </span>
              )}
            </div>
            <div className="bp-actions">
              <button
                className={`bbtn atk ${pending === "basic" ? "armed" : ""}`}
                disabled={!basicOk}
                onClick={actBasic}
              >
                {pending === "basic"
                  ? picks.length > 0
                    ? `🔥 Fire (${picks.length}/${maxPicks})`
                    : "⚔ Auto-fire"
                  : "⚔ Basic Attack"}
              </button>
              <button
                className={`bbtn ${activeDef.special?.talent ? "tal" : "spec"} ${pending === "special" ? "armed" : ""} ${specialCheck.ok && pending === null ? "ready" : ""}`}
                disabled={!specialCheck.ok}
                title={
                  activeDef.special
                    ? activeDef.special.talent
                      ? `${activeDef.special.name} (Talent, free · once per game): ${activeDef.special.text}`
                      : `${activeDef.special.name} (cost ${specCost}): ${activeDef.special.text}`
                    : "No special"
                }
                onClick={actSpecial}
              >
                {(() => {
                  const rest = activeDef.special?.talent
                    ? `★ ${activeDef.special.name}`
                    : `✦ Special${activeDef.special ? ` (${specCost})` : ""}`;
                  if (pending === "special")
                    return specialAoE ? "✦ Confirm" : picks.length > 0 ? `🔥 Fire (${picks.length}/${maxPicks})` : rest;
                  return rest;
                })()}
              </button>
              {activeDef.talent && (
                <button
                  className={`bbtn tal ${pending === "talent" ? "armed" : ""}`}
                  disabled={!talentCheck.ok}
                  title={`${activeDef.talent.name} (Talent, free · once per game): ${activeDef.talent.text}`}
                  onClick={actTalent}
                >
                  {pending === "talent" ? "★ Confirm" : `★ ${activeDef.talent.name}`}
                </button>
              )}
              <button
                className="bbtn skip"
                onClick={actSkip}
              >
                Skip
              </button>
            </div>
            {/* Armed special → show what it does (the hover title is invisible on
                touch, and the hint row is hidden mid-battle on mobile). */}
            {pending === "special" && activeDef.special && (
              <div className="bp-text spec-desc">
                <b>{activeDef.special.name}</b>
                <span className="spec-cost"> · {activeDef.special.talent ? "Talent · once per game" : `${specCost} SP`}</span> — {activeDef.special.text}
              </div>
            )}
            {pending !== "special" && !specialCheck.ok && activeDef.special && (
              <div className="bp-text">
                Special unavailable: {"reason" in specialCheck ? specialCheck.reason : ""}
              </div>
            )}
          </div>
        ) : null}
        </div>

        <div className="controls">
          <div className="hint" dangerouslySetInnerHTML={{ __html: hint }} />
          {/* Portrait: surface the spellbook right in the action panel (desktop
              keeps its own tray in the right rail; this one is CSS-hidden there).
              Prep-only — otherwise the book shows behind the pre-game menu and
              during battle, where spells can't be cast. */}
          {game.phase === "prep" && (
            <div className="panel-spells">
              <SpellTray
                game={game}
                player={view}
                armedSpellId={sel?.kind === "spell" ? sel.spellId : null}
                myTurn={myPrep}
                onPick={onPickSpell}
                collapsible
              />
            </div>
          )}
          {/* Portrait: a copy of the crystals down here in the action panel, clear
              of the hand (the top .resource is CSS-hidden in portrait). Desktop
              hides THIS one and keeps the top one. */}
          <div className="panel-crystals">
            <ResourcePool game={game} player={view} />
          </div>
          {/* Pass Priority is the primary action; secondary controls stack
              underneath it so the hand keeps its width. */}
          <button
            className={`lockin pass-btn ${myPrep && sel === null && !hasAnyPlay ? "nudge" : ""}`}
            disabled={!myPrep}
            onClick={() => me && dispatch({ type: "PASS", player: me })}
          >
            {myPrep ? (
              <>
                Pass Priority
                <span className="pass-dots" title="Two consecutive passes → Battle">
                  <span className={`pd ${(game.prep?.consecutivePasses ?? 0) >= 1 ? "on" : ""}`} />
                  <span className={`pd ${(game.prep?.consecutivePasses ?? 0) >= 2 ? "on" : ""}`} />
                </span>
              </>
            ) : (
              "Waiting…"
            )}
          </button>
          <div className="ctl-sub">
            {myPrep && (
              <span className={`mv ${game.prep?.movedThisTurn ? "used" : "ready"}`}>
                {game.prep?.movedThisTurn ? "Move: used" : "Move: available"}
              </span>
            )}
            <select
              className="ghost sm"
              title="Set every one of your board cards' auto mode"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) setGlobalAuto(e.target.value as never);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                Auto…
              </option>
              <option value="manual">All Manual</option>
              <option value="basic">All Auto-Basic</option>
              <option value="full">All Full-Auto</option>
            </select>
            <button
              className="ghost sm"
              onClick={() => {
                setSel(null);
                setPending(null);
                setPicks([]);
                setSurrenderArmed(false);
              }}
            >
              Clear
            </button>
            {game.win === null && me !== null && (
              <button
                className={`ghost sm ${surrenderArmed ? "warn" : ""}`}
                title="Concede the match"
                onClick={() => {
                  if (surrenderArmed) {
                    dispatch({ type: "SURRENDER", player: me });
                    setSurrenderArmed(false);
                  } else {
                    setSurrenderArmed(true);
                    setHint("⚠ Surrender? Click again to confirm, or Clear to cancel.");
                  }
                }}
              >
                {surrenderArmed ? "Confirm?" : twoPlayer ? `${me} surrender` : "Surrender"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* The hand floats over the bottom edge of the board — popped up when it's
          your turn to act, tucked low otherwise — so the bar stays thin. */}
      {started && activeCard === null && game.phase !== "mulligan" && (
        // `placing` = a hand card is armed (choosing a Home slot). In the short
        // landscape layout the fan overlaps the board, so CSS makes it pass taps
        // through to the slots underneath while placing.
        <div className={`hand-float${myPrep ? " up" : ""}${sel?.kind === "hand" ? " placing" : ""}`}>
          <Hand
            game={game}
            player={view}
            summonableHandIds={summonableHandIds}
            homeRowOpen={openSlots.length > 0}
            selectedHandId={sel?.kind === "hand" ? sel.handId : null}
            onPick={onPickHand}
            onDragStartCard={onDragStartCard}
            onDragEndCard={onDragEndCard}
          />
        </div>
      )}

      {inMulligan && me && (
        <div className="overlay">
          <div className="modal">
            <h1>{twoPlayer ? `${me} — Opening Hand` : "Opening Hand"}</h1>
            <p>
              {twoPlayer ? `Player ${me}: hand the device over. ` : ""}
              Click any cards to send back — you'll reshuffle and redraw to 4. Keeping a
              cheap curve (1–4) makes the early rounds playable.
            </p>
            <div className="mull-cards">
              {game.players[me].hand.map((h) => {
                const def = getDef(h.defId);
                const toss = mullToss.includes(h.handId);
                return (
                  <div
                    key={h.handId}
                    className={`mull-card carded ${toss ? "toss" : ""}`}
                    onClick={() =>
                      setMullToss((cur) =>
                        toss ? cur.filter((x) => x !== h.handId) : [...cur, h.handId],
                      )
                    }
                  >
                    <img
                      className="card-art"
                      src={`/cards/${def.art ?? def.id}.webp`}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="hc-top">
                      <div className="hc-cost">{def.cost}</div>
                      <span className="el-dot" style={{ background: EL_COLOR[def.element] }} />
                    </div>
                    <div className="hc-name">{def.name}</div>
                    <div className="hc-stats">
                      <span className="s-dmg">⚔<span className="atk-dmg">{def.dmg}</span>{def.hits > 1 ? <span className="atk-x"> ×{def.hits}</span> : ""}</span>
                      <span className="s-hp">♥{def.hp}</span>
                      <span className="s-sp"><SpIcon />{def.sp}</span>
                    </div>
                    <div className="hc-class">{def.cardClass}</div>
                  </div>
                );
              })}
            </div>
            <button
              className="lockin"
              onClick={() => {
                if (!me) return;
                dispatch({ type: "MULLIGAN", player: me, returnHandIds: mullToss });
                setMullToss([]);
              }}
            >
              {mullToss.length > 0 ? `Return ${mullToss.length} & Redraw` : "Keep Hand"}
            </button>
          </div>
        </div>
      )}

      {game.pendingFlow && game.cards[game.pendingFlow] && (() => {
        const flowCard = game.cards[game.pendingFlow!];
        // Only the card's OWNER resolves its Flow Change. Online, the other
        // player must not be able to pick for it — they see a waiting note.
        const flowMine = !online || flowCard.owner === online.myId;
        if (!flowMine)
          return (
            <div className="overlay">
              <div className="modal flow-modal">
                <h1>Flow Change</h1>
                <p>
                  ⏳ {game.pendingFlowAll ? "Downpour is re-shaping their side" : <><b>{getDef(flowCard.defId).name}</b> is flowing into being</>} —
                  your opponent is choosing the boost.
                </p>
              </div>
            </div>
          );
        return (
          <div className="overlay">
            <div className="modal flow-modal">
              <h1>Flow Change</h1>
              <p>
                {game.pendingFlowAll ? (
                  <>
                    <b>Downpour</b> — the tide re-shapes your{" "}
                    {getDef(flowCard.defId).element} side. Choose this round's boost
                    for <b>all</b> of them.
                  </>
                ) : (
                  <>
                    <b>{getDef(flowCard.defId).name}</b> flows into being —
                    choose its boost for 3 rounds.
                  </>
                )}
              </p>
              <div className="flow-opts">
                {(["water", "ice", "steam"] as const).map((mode) => {
                  // Only Downpour's round-scoped re-pick still turns Liquid into
                  // +1 hit on a multi-hit card; the timed summon grant is +2 DMG.
                  const multiHit = liquidGivesHit(flowCard);
                  const blurb =
                    mode === "water" && multiHit && game.pendingFlowAll ? "+1 hit" : FLOW_MODES[mode].blurb;
                  return (
                    <button
                      key={mode}
                      className={`flow-opt flow-${mode}`}
                      onClick={() =>
                        dispatch({ type: "FLOW_CHANGE", player: flowCard.owner, instanceId: flowCard.instanceId, mode })
                      }
                    >
                      <span className="flow-label">{FLOW_MODES[mode].label}</span>
                      <span className="flow-blurb">{blurb}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {detailId && game.cards[detailId] && (
        <CardView
          mode="inspect"
          game={game}
          card={game.cards[detailId]}
          viewer={view}
          canMove={
            me !== null &&
            game.cards[detailId].owner === me &&
            game.phase === "prep" &&
            game.prep?.priority === me &&
            !game.prep.movedThisTurn &&
            legalMoves(game, me, detailId).length > 0
          }
          onMove={() => armMoveFromDetail(detailId)}
          onSetAuto={(mode) => setCardAuto(detailId, mode)}
          onClose={() => setDetailId(null)}
        />
      )}

      {/* Modal "choice" spell (Chill) — strike a foe or shield an ally. */}
      {spellChoice && (() => {
        const spell = getSpell(spellChoice);
        const cancel = () => { setSpellChoice(null); setHint("Cast cancelled."); };
        return (
          <div className="overlay spellchoice-overlay" onClick={cancel}>
            <div className="spellchoice" onClick={(e) => e.stopPropagation()} data-el={spell.element}>
              <div className="spellchoice-name">{spell.name}</div>
              <div className="spellchoice-sub">Choose how to cast</div>
              <div className="spellchoice-opts">
                <button className="spellchoice-opt atk" onClick={() => chooseSpellMode("attack")}>
                  <span className="sco-ico">⚔️</span>
                  <span className="sco-name">Strike a foe</span>
                  <span className="sco-desc">{spell.dmg} DMG{spell.status ? ` · FREEZE ${spell.status.duration}` : ""}</span>
                </button>
                <button className="spellchoice-opt def" onClick={() => chooseSpellMode("shield")}>
                  <span className="sco-ico">🛡️</span>
                  <span className="sco-name">Shield an ally</span>
                  <span className="sco-desc">+{spell.allyShield} shield</span>
                </button>
              </div>
              <button className="spellchoice-cancel" onClick={cancel}>Cancel</button>
            </div>
          </div>
        );
      })()}

      {enchantFor && (() => {
        const card = game.cards[enchantFor];
        const cancel = () => { setEnchantFor(null); setHint("Enchantment cancelled."); };
        const pick = (mode: EnchantMode, label: string) => {
          setEnchantFor(null);
          setPending(null);
          setPicks([]);
          dispatch({ type: "BATTLE_ACTION", player: card.owner, action: "special", mode });
          setHint(`Weapon enchanted — <b>${label}</b> rides the next basic attack.`);
        };
        const OPTS: [EnchantMode, string, string, string][] = [
          ["sharpen", "🗡️", "Sharpen", "+5 DMG"],
          ["burning", "🔥", "Burning", "2 DOT for 2 rounds"],
          ["freezing", "❄️", "Freezing", "−5 SP for 2 rounds"],
          ["sleeping", "😴", "Sleeping", "SLEEP 1 round"],
        ];
        return (
          <div className="overlay spellchoice-overlay" onClick={cancel}>
            <div className="spellchoice" onClick={(e) => e.stopPropagation()} data-el={getDef(card.defId).element}>
              <div className="spellchoice-name">Enchantment</div>
              <div className="spellchoice-sub">Choose one — it rides the next basic attack</div>
              <div className="spellchoice-opts ench">
                {OPTS.map(([mode, ico, name, desc]) => (
                  <button key={mode} className="spellchoice-opt atk" onClick={() => pick(mode, name)}>
                    <span className="sco-ico">{ico}</span>
                    <span className="sco-name">{name}</span>
                    <span className="sco-desc">{desc}</span>
                  </button>
                ))}
              </div>
              <button className="spellchoice-cancel" onClick={cancel}>Cancel</button>
            </div>
          </div>
        );
      })()}

      {/* 2-second spell-cast flash — art blows up big before the effect resolves. */}
      {/* The verbs, orbiting the card they belong to. Phone only: on desktop the
          action row has room and a ring over a 120px tile would be smaller than
          the buttons it replaced. Mounted here, outside .board, so it is not
          clipped by the board frame and cannot be caught by the slot's own
          stacking context. */}
      {wheelUp && <ActionWheel verbs={wheelVerbs} at={wheelAt} />}

      {castFlash && <SpellCastFlash spellId={castFlash.spellId} />}
      {announce && <SummonAnnounce defId={announce.defId} mine={announce.mine} />}

      {/* Only during a match — New Match sets started=false, which hides this and
          reveals the deck picker (game.win stays set until Start Match resets it). */}
      {started && !storyNode && (
        <WinScreen
          game={game}
          onNewGame={() => {
            if (online) leaveOnline(); // tear down the room before returning
            setStarted(false); // back to the deck picker
            setSel(null);
            setPending(null);
            setMullToss([]);
          }}
        />
      )}

      {storyResult && (
        <StoryResult
          node={storyResult.node}
          game={game}
          lost={storyResult.lost}
          won={storyResult.won}
          captured={storyResult.captured}
          firstClear={!story.cleared.includes(storyResult.node.id)}
          exhausted={recruitablePool(storyResult.node).every((id) => story.collection.includes(id))}
          onDone={() => {
            setStoryResult(null);
            setStoryNode(null);
            setStarted(false);
            setStoryOpen(true);
          }}
        />
      )}

      {storyOpen && !started && collectionOpen && (
        <StoryCollection
          save={story}
          onSave={(next) => { setStory(next); saveStory(next); }}
          onClose={() => setCollectionOpen(false)}
          element={region.element}
          onOpenBuilder={() => setStoryBuilder(true)}
          onGoToNode={(id) => {
            // A card's source can live in a region the map isn't showing.
            const home = regionOfNode(id);
            if (home) setRegionId(home.id);
            setMapFocusNode(id);
            setCollectionOpen(false);
            setRegionsOpen(false);
          }}
        />
      )}

      {storyOpen && !started && !collectionOpen && regionsOpen && (
        <StoryRegions
          save={story}
          currentId={region.id}
          onPick={(id) => { setRegionId(id); setRegionsOpen(false); }}
          onClose={() => setRegionsOpen(false)}
        />
      )}

      {storyOpen && !started && !collectionOpen && !regionsOpen && (
        <StoryMap
          region={region}
          save={story}
          onSave={(next) => { setStory(next); saveStory(next); }}
          onOpenRegions={() => setRegionsOpen(true)}
          onOpenCollection={() => setCollectionOpen(true)}
          focusNodeId={mapFocusNode}
          onFocusHandled={() => setMapFocusNode(null)}
          onFight={(node) => setPrepNode(node)}
        />
      )}

      {storyOpen && !started && !collectionOpen && prepNode && (
        <StoryPrep
          region={regionOfNode(prepNode.id) ?? region}
          node={prepNode}
          save={story}
          onSave={(next) => { setStory(next); saveStory(next); }}
          onEditDeck={() => setStoryBuilder(true)}
          onCancel={() => setPrepNode(null)}
          onFight={(deck) => {
            const node = prepNode;
            // The node's own region decides the board and the Blight, not
            // whichever map happens to be on screen.
            const home = regionOfNode(node.id) ?? region;
            // A formation, not a deck: duplicates fill it out to the tier's
            // target so a 3-card roster still fields a full board (§10.7).
            const squad = buildFormation(story, home, node);
            const board = boardForNode(home, node);
            // §4: the region's Field spell runs the whole battle, both sides.
            // Matched by NAME rather than element — an element can have more
            // than one field spell, and `region.terrain` names the exact one.
            const terrain = SPELLS.find(
              (sp) => sp.kind === "field" && sp.name === home.terrain,
            )?.id;
            // The free opening placement is the campaign's FIRST fight only —
            // Sakuroot alone needing to choose her ground. Every later node,
            // and every other mode (skirmish, online, Void Tower), uses the
            // ordinary summon ramp.
            const deploy = isFirstBattle(home, node)
              ? { P1: PLAYER_DEPLOY, P2: ENEMY_DEPLOY }
              : undefined;
            // Spells reach the campaign. Story matches passed EMPTY spellbooks
            // for both sides, so 80 spells — a whole resource, its UI, its AI
            // and the magic pool that pays for them — existed only in skirmish.
            // The hero carries what they have unlocked, trimmed to the board's
            // cap; the enemy gets its region's own book so the fight is not
            // one-sided.
            const heroBook = heroBookFor(story, board);
            const foeBook = spellbookFor(squad).map((sl) => sl.defId);
            setGame(createInitialState(newSeed(), deck, squad, ["P1"], heroBook, foeBook, board,
              deploy, terrain));
            setPrepNode(null);
            setStoryNode(node);
            setStoryOpen(false);
            setViewSide("P1");
            setSel(null);
            setPending(null);
            setPicks([]);
            setMullToss([]);
            setHint("Mulligan: click cards to send back, then confirm.");
            setStarted(true);
          }}
        />
      )}

      {!started && !storyOpen && tab === "arena" && (
        <div className="overlay">
          <div className="modal picker">
            {/* Left: the menu options, stacked vertically. */}
            <div className="picker-menu">
              <picture>
                <source srcSet="/title.webp" type="image/webp" />
                <img className="title-logo" src="/title.jpg" alt="War Element" />
              </picture>
              <p>
                {onlineMode
                  ? onlineRole === "host"
                    ? "Host a room, share the code with your buddy, and pick your deck (P1)."
                    : "Enter your buddy's room code, then pick your deck (P2)."
                  : twoPlayer
                    ? "Two players share this device — hand it back and forth each turn."
                    : "Choose the decks, then start. You play P1."}
              </p>
              <div className="mode-toggle">
                <button
                  className={`mode-btn ${!twoPlayer && !onlineMode ? "on" : ""}`}
                  onClick={() => { setOnlineMode(false); setTwoPlayer(false); }}
                >
                  🤖 vs AI
                </button>
                <button
                  className={`mode-btn ${twoPlayer && !onlineMode ? "on" : ""}`}
                  onClick={() => { setOnlineMode(false); setTwoPlayer(true); }}
                >
                  👥 2 Players
                </button>
                <button
                  className={`mode-btn ${onlineMode ? "on" : ""}`}
                  onClick={() => setOnlineMode(true)}
                >
                  🌐 Online
                </button>
              </div>
              {/* Battlefield size. Hidden for an online GUEST: the host deals the
                  whole state, board size included, so the guest has no say. */}
              {(!onlineMode || onlineRole === "host") && (
                <div className="pick-field">
                  <span>Battlefield</span>
                  <div className="mode-toggle">
                    <button
                      className={`mode-btn sm ${boardSize === 4 ? "on" : ""}`}
                      onClick={() => setBoardSize(4)}
                    >
                      4×4 · Standard
                    </button>
                    <button
                      className={`mode-btn sm ${boardSize === 5 ? "on" : ""}`}
                      onClick={() => setBoardSize(5)}
                    >
                      5×5 · Large
                    </button>
                  </div>
                </div>
              )}
              {(!onlineMode || onlineRole === "host") && (
              <div className="pick-field">
                <span>{onlineMode ? "Your deck (P1)" : twoPlayer ? "Player 1 deck" : "Your deck (P1)"}</span>
                <select
                  className="deck-src"
                  value={p1DeckId}
                  onChange={(e) => { setP1DeckId(e.target.value); setViewDeck("p1"); }}
                >
                  <optgroup label="Premade decks">
                    {modePremades.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.cards.length})</option>
                    ))}
                  </optgroup>
                  {customDecks.length > 0 && (
                    <optgroup label="Custom decks">
                      {customDecks.map((d) => (
                        <option key={d.id} value={d.id}>★ {d.name} ({d.cards.length})</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              )}
              {(!onlineMode || onlineRole === "guest") && (
              <div className="pick-field">
                <span>{onlineMode ? "Your deck (P2)" : twoPlayer ? "Player 2 deck" : "Opponent deck (P2 · AI)"}</span>
                <select
                  className="deck-src"
                  value={p2DeckId}
                  onChange={(e) => { setP2DeckId(e.target.value); setViewDeck("p2"); }}
                >
                  <optgroup label="Premade decks">
                    {modePremades.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.cards.length})</option>
                    ))}
                  </optgroup>
                  {customDecks.length > 0 && (
                    <optgroup label="Custom decks">
                      {customDecks.map((d) => (
                        <option key={d.id} value={d.id}>★ {d.name} ({d.cards.length})</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              )}
              <button className="ghost db-open" onClick={() => setBuilderOpen(true)}>
                🛠 Build / edit custom decks
              </button>
              <button className="ghost db-open" onClick={() => setRulesOpen(true)}>
                📖 How to play
              </button>
              <button className="ghost db-open" onClick={() => setStoryOpen(true)}>
                🗺 Story Mode
              </button>

              {!onlineMode ? (
                <button
                  className="lockin"
                  onClick={() => {
                    const humans: PlayerId[] = twoPlayer ? ["P1", "P2"] : ["P1"];
                    const p1Cards = resolveDeckCards(p1DeckId);
                    const p2Cards = resolveDeckCards(p2DeckId);
                    setGame(createInitialState(
                      newSeed(), p1Cards, p2Cards, humans,
                      resolveDeckSpells(p1DeckId), resolveDeckSpells(p2DeckId),
                      boardSize,
                    ));
                    setViewSide("P1");
                    setSel(null);
                    setPending(null);
                    setPicks([]);
                    setMullToss([]);
                    setHint("Mulligan: click cards to send back, then confirm.");
                    setStarted(true);
                  }}
                >
                  Start Match
                </button>
              ) : (
                <div className="online-panel">
                  <div className="role-toggle">
                    <button
                      className={`mode-btn sm ${onlineRole === "host" ? "on" : ""}`}
                      onClick={() => setOnlineRole("host")}
                      disabled={!!online}
                    >
                      Host game
                    </button>
                    <button
                      className={`mode-btn sm ${onlineRole === "guest" ? "on" : ""}`}
                      onClick={() => setOnlineRole("guest")}
                      disabled={!!online}
                    >
                      Join game
                    </button>
                  </div>
                  <input
                    className="db-name room-code"
                    placeholder={onlineRole === "host" ? "Room code (blank = auto)" : "Enter buddy's code"}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    maxLength={12}
                    disabled={!!online}
                  />
                  {onlineRole === "host" ? (
                    <button className="lockin" onClick={hostCreateRoom} disabled={!!online || !onlineConfigured}>
                      Create room
                    </button>
                  ) : (
                    <button className="lockin" onClick={guestJoinRoom} disabled={!!online || !onlineConfigured}>
                      Join room
                    </button>
                  )}
                  {netStatus && <div className="net-status">{netStatus}</div>}
                  {online && (
                    <button className="ghost" onClick={leaveOnline}>Cancel / leave room</button>
                  )}
                  {!onlineConfigured && (
                    <div className="net-status warn">
                      Online needs VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY — see README.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: the deck view — cards of the selected deck. */}
            <div className="picker-view">
              <div className="pv-tabs">
                <button
                  className={`pv-tab ${viewDeck === "p1" ? "on" : ""}`}
                  onClick={() => setViewDeck("p1")}
                >
                  P1 · {deckLabel(p1DeckId)}
                </button>
                <button
                  className={`pv-tab ${viewDeck === "p2" ? "on" : ""}`}
                  onClick={() => setViewDeck("p2")}
                >
                  P2 · {deckLabel(p2DeckId)}
                </button>
              </div>
              {(() => {
                const cards =
                  viewDeck === "p1"
                    ? resolveDeckCards(p1DeckId)
                    : resolveDeckCards(p2DeckId);
                return (
                  <>
                    <div className="pv-count">{cards.length} cards</div>
                    <div className="pv-grid">
                      {cards.map((id) => {
                        const d = getDef(id);
                        return (
                          <div
                            key={id}
                            className="deck-thumb carded"
                            title={d.special ? `${d.special.name}: ${d.special.text}` : d.name}
                          >
                            <img
                              className="card-art"
                              src={`/cards/${d.art ?? d.id}.webp`}
                              alt=""
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <div className="dt-top">
                              <span className="dt-cost">{d.cost}</span>
                              <span className="dt-el" title={d.element} style={{ borderColor: EL_COLOR[d.element] }}>
                                <img src={EL_ICON[d.element]} alt={d.element} draggable={false}
                                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                              </span>
                            </div>
                            <div className="dt-name">{d.name}</div>
                            <div className="dt-stats">
                              <span className="s-dmg">⚔<span className="atk-dmg">{d.dmg}</span>{d.hits > 1 ? <span className="atk-x"> ×{d.hits}</span> : ""}</span>
                              <span className="s-hp">♥{d.hp}</span>
                              <span className="s-sp"><SpIcon />{d.sp}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Campaign team builder: the same screen as the sandbox, with the pool
          cut to what you own and the ceiling set by the campaign. */}
      {/* ── the four destinations ─────────────────────────────────────────── */}
      {/* Home IS the collection. It was a landing card with a title and two
          shortcuts, which is a menu pretending to be a destination — the thing
          a player actually wants to look at between fights is what they own.
          The hero line stays, above the grid, because it is the same
          information the landing card carried. */}
      {!started && !storyOpen && tab === "home" && (
        <StoryCollection
          save={story}
          onSave={(next) => { setStory(next); saveStory(next); }}
          onClose={() => setTab("arena")}
          closeLabel="To the Arena"
          onOpenBuilder={() => setStoryBuilder(true)}
        />
      )}

      {!started && !storyOpen && tab === "shop" && (
        <div className="overlay">
          <div className="modal picker shop-modal">
            <Shop save={story} onSave={(next) => { setStory(next); saveStory(next); }} />
          </div>
        </div>
      )}

      <DeckBuilder
        open={storyBuilder}
        onClose={() => setStoryBuilder(false)}
        onChange={() => {}}
        story={{
          owned: storyBuilderOwned,
          teams: story.loadouts ?? [],
          cap: storyBuilderCap,
          element: region.element,
          onSaveTeam: (name, cards) => {
            const rest = (story.loadouts ?? []).filter((l) => l.name.toLowerCase() !== name.toLowerCase());
            const id = `${name.toLowerCase().replace(/\s+/g, "-")}-${rest.length}`;
            const next = {
              ...story,
              loadouts: [...rest, { id, name, element: region.element, cards }],
              deck: cards,
              // The team you just built is the one you meant to take.
              lastTeamId: id,
            };
            setStory(next);
            saveStory(next);
          },
          onDeleteTeam: (id) => {
            const next = {
              ...story,
              loadouts: (story.loadouts ?? []).filter((l) => l.id !== id),
              lastTeamId: story.lastTeamId === id ? undefined : story.lastTeamId,
            };
            setStory(next);
            saveStory(next);
          },
        }}
      />

      <DeckBuilder
        boardSize={boardSize}
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onChange={(decks) => {
          setCustomDecks(decks);
          // If a side's custom deck was deleted, fall back to the first premade
          // (premades live in code, so they always stay valid).
          const stillValid = new Set([...PREMADE_DECKS.map((d) => d.id), ...decks.map((d) => d.id)]);
          // Fall back within the CURRENT battlefield, not to a 4x4 build while
          // the player is set up for 5x5.
          if (!stillValid.has(p1DeckId)) setP1DeckId(modePremades[0].id);
          if (!stillValid.has(p2DeckId)) setP2DeckId(modePremades[0].id);
        }}
      />
      {rulesOpen && <RulesBook onClose={() => setRulesOpen(false)} />}

      {/* Hidden during a match: a bottom bar over a 5x5 board eats the row the
          player needs most, and there is nowhere to navigate to mid-fight. */}
      {!started && !builderOpen && !rulesOpen && (
        <BottomNav
          tab={storyOpen ? "story" : tab}
          spendable={Object.values(story.hero?.essence ?? {}).reduce((a, b) => a + b, 0)}
          onTab={(t) => {
            setTab(t);
            // Story owns the whole screen when it is up, so entering and leaving
            // it is a real transition rather than just a tab swap.
            if (t === "story") { setStoryOpen(true); return; }
            setStoryOpen(false);
            setCollectionOpen(false);
            setPrepNode(null);
          }}
        />
      )}
    </div>
  );
}

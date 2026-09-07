import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import type { AutoMode, EnchantMode, GameState, Intent, PlayerId, Pos } from "../engine";
import {
  advance,
  applyIntent,
  canCastSpell,
  canFireSpecial,
  canFireTalent,
  canPlummet,
  plummetTargets,
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
  homeSlots,
  openHomeSlots,
  summonLandingRow,
  summonSquare,
  previewSpecialArea,
  previewSpecialFarRow,
  specialAreaShape,
  aoeRowsHit,
  previewOnSummonArea,
  spellEnemyTargets,
  spellAllyTargets,
  spellCommandTargets,
  specialTargets,
  validAllyTargets,
  validTargets,
  distributeBasicHits,
  boardCards,
  isCaptured,
  SPELLS,
  spellbookFor, summonCard, scaleInstance,
  // The boss clock, made visible.
  bossTelegraphs, telegraphBlast,
  seatsOf,
} from "../engine";
import { spellCapForBoard } from "../engine/spells";
import {
  boardOfRun, nextSeat, runComplete, runOver, runReward, settleArena, startRun,
} from "../data/gauntlet";
import {
  afterMatch, recordLadderMatch, tierForStreak, winsToNextRung, WINS_PER_RUNG,
} from "../data/matchmaker";
import {
  joinRoom, onlineConfigured, type ChatMsg, type LobbySeat, type Role, type Room,
} from "../net/online";
import { ChatPanel } from "./ChatPanel";
import { Board } from "./Board";
import { CardView } from "./CardView";
import { talentEffect } from "./card-text";
import { DraftScreen } from "./DraftScreen";
import { LevelUpModal } from "./LevelUpModal";
import { claimLevelUp, pendingLevelUp } from "../data/levels";
import {
  DRAFT_DECK_ID, DRAFT_ENTRY, DRAFT_LOSSES, dealDraftSeat, draftComplete, draftLosses,
  draftPlaying, draftReward, draftRunOver, draftSize, draftWins, pickCard, settleDraft,
  startDraft,
} from "../data/draft";
import { autoPrefFor } from "./auto-prefs";
import { DeckBuilder } from "./DeckBuilder";
import { ProfilePanel } from "./ProfilePanel";
import { DOMINATION_7X7, newDomination } from "../data/domination";
import { deckCodeFromUrl } from "../data/deck-code";
import { absorbLegacy, loadSquads, type Squad } from "../data/squads";
import { newHero, rawStoredLoadouts } from "../data/story";
import { EVENT_DECKS, completeEvent, eventForDeck, type GameEvent } from "../data/events";
import {
  ENRAGE_SCALE, TAME_SCALE, VOID_GATE, bossWallSeats, voidBossById, voidBossElements,
  voidBossSeat, voidGateSeats,
} from "../data/void-tower";
import { VoidTower } from "./VoidTower";
import { battlePlaylist, REGION_TRACK, useGameMusic, type MusicTrack } from "./useGameMusic";
import { RulesBook } from "./RulesBook";
import { CardGallery } from "./CardGallery";
import {
  FIRST_NODE, ONBOARDING_COUNT, ONBOARDING_SKIP,
  canSkipGuide, onboardingIndex, onboardingStep, skipLockedNote,
} from "./Onboarding";
import { GuideOverlay } from "./GuideOverlay";
import { TutorialCoach } from "./TutorialCoach";
import {
  loadCustomDecks, PREMADE_DECKS, premadeDecksFor, rollOpponent, scriptedOpeningFor, TIER_LABEL, tierOf, tiersFor,
  validateDeck, type CustomDeck, type DeckTier,
} from "../data/custom-decks";
import { SpIcon } from "./icons";
import { Hand } from "./Hand";
import { PhaseRibbon } from "./PhaseRibbon";
import { ResourcePool } from "./ResourcePool";
import { SpeedQueue } from "./SpeedQueue";
import { SpellTray } from "./SpellTray";
import { announces, SummonAnnounce } from "./SummonAnnounce";
import { SpellCastFlash } from "./SpellCastFlash";
import { WinScreen, type NextUp } from "./WinScreen";
import { EL_COLOR, EL_ICON, type PendingBattle, type Selection, SEAT_SUIT } from "./shared";
import { StoryCollection } from "./StoryCollection";
import { StoryMap } from "./StoryMap";
import { StoryRegions } from "./StoryRegions";
import { DeckPickerSheet, DeckSeat } from "./DeckPickerSheet";
import { MatchLayout } from "./MatchLayout";
import { initialStoryNav, storyNav } from "./story-nav";
import { StoryResult } from "./StoryResult";
import { StoryPrep } from "./StoryPrep";
import { BottomNav, type Tab } from "./BottomNav";
import { HomeScreen } from "./HomeScreen";
import { AccountPanel } from "./AccountPanel";
import { currentUser, onAuthChange } from "../net/account";
import { VersusIntro } from "./VersusIntro";
import { ActionWheel, type WheelVerb } from "./ActionWheel";
import { Shop } from "./Shop";
import {
  PLAYER_DEPLOY, ENEMY_DEPLOY, REGIONS, applyClear, boardForNode, buildFormation, capForNode,
  loadStory, isFirstBattle, addShards, awardShards, heroBookFor, SHARDS_PER_WIN, onlineMatchShards,
  isRegionOpen, poolForRegion, recruitablePool,
  regionOfNode, rollRecruits, saveStory, THRONE_OPENING_STACK, type StorySave, heroSpellShelf,
  tameBoss, spendTame,
  PLACED_CARDS, ALL_NODES,
} from "../data/story";

function newSeed(): number {
  return (Math.random() * 0x7fffffff) | 0;
}

/** The map to open on, from the save alone.
 *
 *  The furthest OPEN region that still has something to clear, falling back to
 *  the last open one (everything done) and then to the first (nothing done).
 *  Regions are declared in campaign order, so "furthest" is just the last match.
 *  Deliberately derived rather than stored: a `lastRegionId` field would be a
 *  fifth thing to keep in step with `cleared`, and this cannot drift from it. */
function lastRegionId(save: StorySave): string {
  const open = REGIONS.filter((r) => isRegionOpen(save, r));
  if (!open.length) return REGIONS[0].id;
  const unfinished = open.filter((r) => r.nodes.some((n) => !save.cleared.includes(n.id)));
  return (unfinished[unfinished.length - 1] ?? open[open.length - 1]).id;
}

/** The STACKED tier, mirroring the CSS query EXACTLY.
 *
 *  Needed because the Battle Log is two different things on the two tiers: a
 *  full scrollable rail on desktop, and a one-line strip that opens that rail
 *  on tap when stacked. Only the strip should be a button — announcing a
 *  scrollable panel as a button to a screen reader on desktop is a lie, and
 *  putting a click handler on it there would swallow text selection.
 *
 *  "EXACTLY" is load-bearing and this drifted the moment the CSS tier widened
 *  from 760px to the grid's real minimum: an 853px-wide phone rendered the log
 *  as a strip (CSS said stacked) with no click handler (this said desktop), so
 *  tapping it did nothing at all. `styles.test.ts` compares the two literals
 *  now, because a comment saying "keep these in step" demonstrably did not.
 *
 *  The `or` arm carries the SHORT-AND-NARROW case: a phone with its keyboard up
 *  is still stacked, because the three-column grid has never fit 375px however
 *  short the screen gets. Without it that viewport fell into the landscape tier
 *  and the board rendered at 39x39.
 *
 *  Subscribed, not read once: the app is one page and a rotation has to move
 *  the affordance with the layout. (App's own `logCollapsed` initializer reads
 *  matchMedia without a listener, which is why THAT one goes stale on rotate.) */
export const PORTRAIT_QUERY = "(max-width: 1179px) and ((min-height: 541px) or (max-width: 499px))";
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
  // `row` is set ONLY for a Domination shrine — an ordinary summon is
  // column-addressed with the row implied to be your Home row.
  const [staged, setStaged] = useState<{ handId: string; col: number; row?: number } | null>(null);
  // Drag-to-summon: the hand card being dragged + the home column under the
  // cursor. Drives a LIVE on-summon area preview (red) as you drag over slots.
  const [drag, setDrag] = useState<string | null>(null);
  const [dragCol, setDragCol] = useState<number | null>(null);
  // ...and the ROW it was over. A column was enough while every summon landed
  // on the Home row; Domination deploys at named squares, and a Home row that
  // has been captured end to end lands the card forward of it.
  const [dragRow, setDragRow] = useState<number | null>(null);
  // Mobile: which edge panel is open (Battle Log left / Spells right). Desktop
  // shows both inline, so this stays null there.
  const [mobilePanel, setMobilePanel] = useState<"log" | "spells" | null>(null);
  const [hint, setHint] = useState<string>(
    "Mulligan: click cards to send back, then confirm.",
  );
  const [mullToss, setMullToss] = useState<string[]>([]);
  /** A mulligan the player has CONFIRMED but that has not been applied yet.
   *
   *  Online, both seats mulligan at the same time — nobody waits for a stranger
   *  to read four cards. But the two applies cannot BOTH happen: `applyMulligan`
   *  reshuffles through `shuffle(draft, ...)`, which advances the state's shared
   *  `rngState`, and this transport syncs whole STATES under a Lamport clock
   *  that keeps only the strictly-newer one. Two seats acting on the same parent
   *  is the one case `online.ts` says cannot happen ("the game is turn-based, so
   *  two states never share a parent") — and the loser does not merely lose its
   *  mulligan, it ends up on a different RNG cursor from its opponent, which
   *  desyncs every coin flip and crit roll for the rest of the match.
   *
   *  So the CHOOSING is simultaneous and the APPLYING is serialised: confirm
   *  whenever you like, and the intent goes out when the seat order reaches you.
   *  `needsInput` already returns the first seat that has not gone, so it is the
   *  turnstile; nothing new has to agree about ordering. */
  const [mullHeld, setMullHeld] = useState<string[] | null>(null);
  const [surrenderArmed, setSurrenderArmed] = useState(false);
  /** Drop everything in flight: the selected card, a half-built battle action,
   *  the targets armed for it, and a primed Surrender. One function so the bar's
   *  ✕ and the overflow menu's "Clear" can never come to mean different things. */
  const clearAction = () => {
    setSel(null);
    setPending(null);
    setPicks([]);
    setAimedSpellRow(null);
    setSurrenderArmed(false);
  };
  /** The action bar's overflow menu. Shut by default — the bar is one row. */
  const [barMenu, setBarMenu] = useState(false);
  // Shut it when the phase moves on. Mid-battle CSS hides the whole block, the
  // scrim included, so an open menu would come back the next prep turn over a
  // board the player has already changed their mind about.
  const phaseNow = game.phase;
  useEffect(() => { setBarMenu(false); }, [phaseNow]);
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
  // A SPRUNG TRAP flashes its art too. Traps are hidden — the whole point — so
  // walking into one is the moment the player has least idea what just hit
  // them, and the log line scrolls past. `draft.traps.splice` on trigger is the
  // ONLY place a trap leaves the board (no expiry, no dispel), so a trap that
  // vanishes between renders detonated, and there is no false positive to
  // guard against. Its own timer, so it cannot clobber a cast mid-flight.
  const trapFlashTimerRef = useRef<number | null>(null);
  const prevTrapsRef = useRef<string[]>([]);
  const prevOppUsedRef = useRef<Map<string, number>>(new Map());
  /** WHICH SEAT that baseline was taken from. The opponent is not always the
   *  same seat — vs AI it is P2, and as an online GUEST it is P1 — so a
   *  baseline taken against one is meaningless against the other. */
  // The opponent SET, joined — see the flash effect. Was a single seat id.
  const prevOppSeatRef = useRef<string | null>(null);
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
  /** THE AIMED ROW of a two-row Spell, held between the pick and the cast.
   *
   *  A "tworows" sweep (Glacial Wave, Gale Force, Landslide — all cost 8) hits
   *  the row you click AND the one behind it, and the click used to cast on the
   *  spot. Four candidate rows glowed, one was clicked, and a row that had
   *  never been drawn took the FREEZE — while the same area decides which of
   *  the caster's OWN cards get the shield (`allyShieldInArea`), so the
   *  invisible half was picking friendly targets too. Now the click aims and
   *  the cast is a second, separate press, like an area Special's FIRE. */
  const [aimedSpellRow, setAimedSpellRow] = useState<number | null>(null);
  // Pre-game deck selection — the match doesn't run until Start.
  const [started, setStarted] = useState(false);
  /** WHO IS PLAYING — one value, not two booleans.
   *
   *  This was `twoPlayer` and `onlineMode`, which is a three-way choice encoded
   *  as four states: `twoPlayer && onlineMode` was representable and meant
   *  nothing, and every read had to spell out the precedence —
   *  `!twoPlayer && !onlineMode` for vs-AI, `twoPlayer && !onlineMode` for
   *  hot-seat, `onlineMode` for the rest. Same shape of bug as the story
   *  screens, same fix.
   *
   *  The two booleans stay as DERIVED values because roughly twenty reads want
   *  the question they answer ("is this a hot-seat match?") rather than the
   *  mode, and several of them are mid-match rather than in the lobby. What is
   *  gone is the ability to set them into disagreement. */
  const [arenaMode, setArenaMode] = useState<"ai" | "local" | "online">("ai");
  const twoPlayer = arenaMode === "local";
  const onlineMode = arenaMode === "online";

  /** Battlefield size for the NEXT match. 4 = standard, 5 = the large board.
   *  Online: only the host's choice counts — the guest receives the host's whole
   *  state, board size included, so there is nothing to agree on. */
  const [boardSize, setBoardSize] = useState(4);
  /** The profile overlay — name, trophies, all-time stats. */
  const [profileOpen, setProfileOpen] = useState(false);
  /** Both write STRAIGHT to disk: a name or a trophy that survived until reload
   *  and then vanished is worse than one that could not be set. `ownsAvatar` is
   *  re-checked on read (see `activeAvatar`), so persisting an id here can never
   *  grant a head the save has not earned. */
  const patchHero = (patch: Partial<NonNullable<StorySave["hero"]>>) => {
    const next = { ...story, hero: { ...(story.hero ?? newHero()), ...patch } };
    setStory(next); saveStory(next);
  };
  /** How many seats a Domination match deals. Two everywhere else — the other
   *  battlefields have one Home row per side and nowhere to put a third. */
  const [seatCount, setSeatCount] = useState(2);
  // Online PvP over Supabase Realtime. `online` is set once a room is live.
  const [online, setOnline] = useState<{ role: Role; code: string; myId: PlayerId } | null>(null);
  const [onlineRole, setOnlineRole] = useState<Role>("host");
  const [roomCode, setRoomCode] = useState("");
  const [netStatus, setNetStatus] = useState("");
  /** The PvP versus screen, up between the deal and the first mulligan. Online
   *  only — it exists because it is the one mode where the opposing deck is a
   *  stranger's, and the Arena already shows you both decks you picked. */
  const [pvpIntro, setPvpIntro] = useState(false);
  /** Both seats' deck names. Not derivable from the state — see `StateMeta` —
   *  so the host relays them and every broadcast carries them, which also means
   *  a client that missed the opening message still gets them on the next one.
   *  Held in a ref as well because `broadcast` reads it outside React's flow. */
  const [seatNames, setSeatNames] = useState<Partial<Record<PlayerId, string>> | null>(null);
  const seatNamesRef = useRef<Partial<Record<PlayerId, string>> | null>(null);
  /** Both seats' foils, relayed exactly like the names above and for the same
   *  reason: a foil is a fact about a COLLECTION, and the GameState carries
   *  card ids. Null offline, where only the local player can have any. */
  const [seatFoils, setSeatFoils] = useState<Partial<Record<PlayerId, string[]>> | null>(null);
  const seatFoilsRef = useRef<Partial<Record<PlayerId, string[]>> | null>(null);
  /** What this match was dealt FROM, kept so a rematch can run the same two
   *  decks back. Not derivable from the finished state — by the end the decks
   *  are drawn down and the cards are dead or scattered. */
  const setupRef = useRef<{
    p1: string[]; p1s?: string[]; p2: string[]; p2s?: string[];
    board: number; humans: PlayerId[];
  } | null>(null);
  /** Rematch handshake. BOTH sides must ask before the host re-deals, so a
   *  rematch can't yank someone off a result screen they are still reading. */
  const [rematchMine, setRematchMine] = useState(false);
  const [rematchTheirs, setRematchTheirs] = useState(false);
  const roomRef = useRef<Room | null>(null);
  // BATTLE CHAT. Held here and nowhere near the GameState: see ChatMsg. Capped
  // so a long match cannot grow an unbounded array behind the panel.
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  // Read by the room callbacks, which close over the render that created them
  // and would otherwise test a permanently stale `chatOpen`.
  const chatOpenRef = useRef(false);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

  const CHAT_KEEP = 60;
  /** Say something. The channel is `self:false`, so this never comes back to
   *  us — the local copy is appended here or the sender would watch their own
   *  messages vanish. */
  function sendChat(text: string) {
    const seat = online?.myId;
    if (!roomRef.current || !seat) return;
    const msg: ChatMsg = {
      id: `${seat}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      seat,
      name: seatNamesRef.current?.[seat],
      text,
      at: Date.now(),
    };
    roomRef.current.sendChat(msg);
    receiveChat(msg);
  }

  /** One arrival, from either role. Deduped by id: the channel is
   *  `broadcast.self:false`, so an echo means a genuine redelivery. */
  function receiveChat(msg: ChatMsg) {
    setChat((prev) => (prev.some((m) => m.id === msg.id)
      ? prev
      : [...prev, msg].slice(-CHAT_KEEP)));
    if (!chatOpenRef.current) setChatUnread((n) => n + 1);
  }
  /** HOST: everyone who has joined, in arrival order — one entry per seat after
   *  P1. Kept in a ref because `onJoin` fires from a channel callback that
   *  closed over the first render, so React state would be stale by the second
   *  arrival and the third player would overwrite the second. */
  const lobbyRef = useRef<{
    clientId: string; seat: PlayerId; cards: string[];
    spells?: string[]; name?: string; foils: string[]; ready: boolean;
  }[]>([]);
  /** GUEST: this client's id, and the seat the host gave it. A two-seat room
   *  never needed either — the guest WAS P2 — and with four the host is the
   *  only side that knows the arrival order. */
  const clientIdRef = useRef<string>("");
  const mySeatRef = useRef<PlayerId>("P2");
  /** THE PREGAME LOBBY, as everyone renders it. Host-authoritative: only the
   *  host learns every arrival, so only the host builds this and the guests
   *  receive it. Null until a room is open. */
  const [lobby, setLobby] = useState<{ seats: LobbySeat[]; need: number } | null>(null);
  const [iAmReady, setIAmReady] = useState(false);
  const hostReadyRef = useRef(false);
  const hostSeatCountRef = useRef(2);
  const hostBoardRef = useRef(4);
  /** The decks as they are RIGHT NOW, for the callbacks.
   *
   *  `onJoin` and the start button both fire from closures created when the
   *  room opened, so reading the deck ids from there would deal whatever was
   *  picked at that moment — which is the whole thing a lobby exists to let you
   *  change. Refreshed every render, so it is never stale. */
  const deckNowRef = useRef<{ cards: string[]; spells?: string[]; name: string }>(
    { cards: [], name: "" });
  const onlineStartedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [customDecks, setCustomDecks] = useState<Squad[]>(() => {
    // Fold the two old libraries into the one squad store, once. Runs before the
    // first read so nothing is ever shown from the pre-merge world, and stamps
    // itself so a deleted squad cannot be resurrected on the next boot.
    // RAW, not loadStory(): that one trims a team to the cards you currently own,
    // which would delete from the merge the very lineups the merge exists to keep.
    absorbLegacy(loadCustomDecks(), rawStoredLoadouts());
    return loadSquads();
  });
  const [builderOpen, setBuilderOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  // The card gallery is a reference book, not a destination: it opens over
  // whatever you were looking at and touches no save state, so a plain boolean
  // beside `rulesOpen` is the whole of its routing.
  const [galleryOpen, setGalleryOpen] = useState(false);
  // A deck arriving by shared link (?deck=WE1-...). Read ONCE, on the first
  // render, and stripped from the address bar immediately: leaving it there
  // would re-import the same deck on every refresh and would follow the player
  // around as they navigate.
  const [linkedDeck, setLinkedDeck] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const code = deckCodeFromUrl(window.location.search);
    if (code) {
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState(null, "", clean || "/");
    }
    return code;
  });
  // Open the builder for it, once. The deck is NOT auto-saved: the player sees
  // what they were sent and decides whether to keep it.
  useEffect(() => {
    if (linkedDeck) setBuilderOpen(true);
  }, [linkedDeck]);
  // ── Story Mode ──────────────────────────────────────────────────────────
  // `storyNode` is the node the CURRENT match was launched from; it's what turns
  // a win into a recruitment roll. Null means this is an ordinary skirmish and
  // nothing should be recruited from it.
  const [story, setStory] = useState<StorySave>(() => loadStory());
  /** Which of the four out-of-match destinations is showing. Story keeps its
   *  own `open` flag inside `nav` because the map owns the whole screen when it
   *  is up; the tab just drives it. */
  const [tab, setTab] = useState<Tab>("home");
  /** Home's one sub-screen: the collection, opened from its tile. A boolean
   *  rather than a nav view because it belongs to the Home TAB — leaving for
   *  the Arena and coming back should land on Home, not on whatever was open
   *  over it, so the tab switch below clears it. */
  const [homeCollection, setHomeCollection] = useState(false);
  /** Which Shop economy to open on, when Home sent you there for a reason. */
  const [shopTab, setShopTab] = useState<"packs" | "crafter">("packs");
  /** WHERE YOU ARE IN STORY MODE, as one value — see `story-nav.ts`. This was
   *  nine hooks that were never nine independent facts: the three screens were
   *  two booleans (so `collectionOpen && regionsOpen` was representable and
   *  every render site had to spell out which wins), and a jump from the
   *  collection to a card's source node meant setting four of them in the right
   *  order at the call site. The save itself stays a plain `useState` below —
   *  that is the campaign, not a screen. */
  // Seeded from the SAVE, not from REGIONS[0]. `regionId` is written only by
  // picking a map or jumping to a node, so a cold start always said LEAF — and
  // Home's CONTINUE card reads this. Four regions in, a reload offered
  // "CONTINUE · FOUR SEASONS MEGA FOREST", a full progress bar and "Every node
  // cleared", confidently walking you back into a region you finished hours ago.
  const [nav, navDo] = useReducer(storyNav, lastRegionId(story), initialStoryNav);
  const storyOpen = nav.open;
  const region = REGIONS.find((r) => r.id === nav.regionId) ?? REGIONS[0];
  const storyNode = nav.fightNode;
  const prepNode = nav.prepNode;
  const storyResult = nav.result;
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
  // Clamped by the POOL, not by the squad limit. The squad counts only what
  // you carry from ELSEWHERE — the region's own element travels free and is
  // already in the pool — so clamping deck size by it capped a deck at the
  // number of foreigners in it and ignored every local. Standing in PYRO with
  // four Thrones taken, that read "carry up to 20" against a ladder of 22 and
  // a pool far larger, and no amount of progress moved it.
  //
  // `capForNode` dropped this same clamp for the same reason and left a
  // comment saying so; this call site was missed. It now matches `fightCap`,
  // which is the number prep actually fights at.
  // The biggest fight this REGION can ask for, which is what a deck built here
  // should be allowed to fill: the ladder, clamped per node by that node's
  // board, maxed across the region — so a region with a 5x5 set piece in it
  // builds to the set piece. A flat `max(STANDARD_CAP, …)` floor said 20 in
  // Act I while every Act I fight fields 12.
  const storyBuilderCap = Math.min(
    Math.max(...region.nodes.map((n) => capForNode(story.cleared, region, n))),
    storyBuilderOwned.length || Number.POSITIVE_INFINITY,
  );
  /** The biggest BOARD this region can ask for, by the same reasoning as the
   *  cap above: a region with a 5x5 set piece in it builds to the set piece.
   *
   *  This was never passed, so the campaign builder defaulted to 4x4 and with
   *  it to a FIVE-spell book — you could not pick the eight a large board
   *  allows, on any node, ever. The Arena builder passed its board and had the
   *  right cap the whole time, which is why it never showed up there. */
  const storyBuilderBoard = Math.max(...region.nodes.map((n) => boardForNode(region, n)));
  /** …UNLESS prep is open on a specific node, in which case build for THAT
   *  fight.
   *
   *  The region-wide figures above are right for the Home and Collection
   *  entrances, where there is no node in mind. Opened from prep there is one,
   *  and the two answers were quietly different: the builder painted a 20-card
   *  squad legal against the region's biggest set piece, and the 12-cap node
   *  you were standing in front of then rendered it over-cap. Same for the
   *  board — an eight-spell book chosen against a 5x5 set piece was silently
   *  trimmed to five by `spellCapForBoard` on arriving at a 4x4 node.
   *
   *  Building for the fight you are looking at is the less surprising of the
   *  two, and it is the only one where the number on screen is the number the
   *  fight will use. */
  const prepRegion = prepNode ? (regionOfNode(prepNode.id) ?? region) : null;
  const builderCap = prepNode && prepRegion
    ? Math.min(
        capForNode(story.cleared, prepRegion, prepNode),
        storyBuilderOwned.length || Number.POSITIVE_INFINITY,
      )
    : storyBuilderCap;
  const builderBoard = prepNode && prepRegion ? boardForNode(prepRegion, prepNode) : storyBuilderBoard;

  // Deck selection = a premade or custom deck (the old two-core pairing is gone).
  // Each side defaults to a different premade so a match is one tap away.
  // Seeded from the STANDARD builds — boardSize starts at 4, and the remap
  // effect below re-points these if the player switches battlefield.
  const [p1DeckId, setP1DeckId] = useState(premadeDecksFor(4)[0].id);
  const [p2DeckId, setP2DeckId] = useState(premadeDecksFor(4)[1].id);
  // THE THIRD AND FOURTH SEATS (Domination only). They used to be chosen FOR
  // the player — the first two premades not already seated — so a free-for-all
  // was three decks the player could not see and one they could. Seated here
  // like the other two, defaulted to distinct decks off the large shelf (which
  // is the 7x7's shelf too, see `premadeDecksFor`) so a fresh lobby still deals
  // four different armies without anyone touching them.
  const [p3DeckId, setP3DeckId] = useState(premadeDecksFor(5)[2].id);
  const [p4DeckId, setP4DeckId] = useState(premadeDecksFor(5)[3].id);
  // WHAT KIND of AI match this is — a MODE, not a selection buried in the
  // lobby. Three, and they no longer bleed into each other: Casual picks its
  // own fight and scores nothing, Streak climbs the ladder, Gauntlet runs the
  // four seats. A run now survives you playing the other two, which is the
  // reported bug: with a run armed, ANY match advanced it and a loss ENDED it.
  const [arenaGame, setArenaGame] = useState<"casual" | "streak" | "gauntlet" | "draft">("casual");
  const gauntletRun = story.gauntlet?.run;
  const draftRun = story.draft;
  /** THE DRAFTED DECK, as a pool entry.
   *
   *  Registering it rather than special-casing the seat is what keeps this
   *  wiring small: the label, the spellbook (absent = derived from its own
   *  elements, which is exactly right for a mixed draft), validation and the
   *  match-start call all go through `deckPool` already, and none of them needs
   *  to learn what a draft is. It exists only while a run is PLAYING, so the
   *  entry cannot be selected out of a picker between runs. */
  const draftDeck: CustomDeck | null = draftPlaying(draftRun)
    ? { id: DRAFT_DECK_ID, name: "Your draft", cards: draftRun!.picks }
    : null;
  /** The run is holding YOUR chair — so the lobby must not offer to change it.
   *  Only while the mode is draft AND the run is playing: a draft parked while
   *  you play Casual leaves your own deck yours, the same way it leaves the
   *  opponent chair alone. */
  const draftOwnsMySeat = arenaGame === "draft" && !!draftDeck && !onlineMode && !twoPlayer;
  /** The event being fought, DERIVED from the opponent seat rather than stored.
   *
   *  Storing it would mean owning a lifecycle — set it on the Home tap, clear it
   *  on leaving, on picking another deck, on settling — and every one of those
   *  is a chance for the flag and the seat to disagree about which fight this
   *  is. The deck in the chair already answers the question, and it answers it
   *  correctly for free: pick any other deck and this goes null on its own. */
  const eventRun: GameEvent | null = eventForDeck(p2DeckId) ?? null;
  /** How the opponent seat's opening is scripted: an event carries its own, an
   *  elite premade carries the rung's. A NUMBER is a depth of cheapest cards; a
   *  LIST names the exact cards to hoist (Void Trials, whose formation is the
   *  expensive half of a padded deck). One value so the match-start call has a
   *  single thing to pass, and so a deck that is somehow both cannot script the
   *  seat twice. */
  const scriptedP2: number | readonly string[] | undefined =
    eventRun?.scriptedOpening ?? scriptedOpeningFor(p2DeckId);
  /** The rung a new run is dealt from — PICKED, on its own control.
   *
   *  It used to be `tierOf(p2DeckId) ?? "mid"`: read off whichever deck happened
   *  to be sitting in the opponent chair. That was already oblique — nothing
   *  said the seat was steering the difficulty — and it stopped working
   *  entirely once the chair was locked, which it has to be, because a mode
   *  that deals your opponents cannot also let you choose them.
   *
   *  So difficulty is the one thing gauntlet mode DOES ask you, and it asks it
   *  outright. Clamped to the rungs this board actually has. */
  const [runTierPick, setRunTierPick] = useState<DeckTier>("mid");
  const runTier: DeckTier = tiersFor(boardSize).includes(runTierPick) ? runTierPick : "mid";
  /** The Gauntlet's current seat, when a run is live. While it is, the AI's
   *  deck is not the player's to set — that is the whole point of a run. */
  const gauntletSeat =
    // vs-AI only. A run left open and then a switch to hot-seat or online used
    // to leave the other seat locked to "GAUNTLET · SEAT 1" with no panel on
    // screen to explain it or to give the run up — a dead control and a lie
    // about what you were about to play.
    // An event is not a seat. A run left open used to seize the opponent chair
    // unconditionally, so tapping the Home event card while one was live handed
    // you the gauntlet deck instead — and then settled the result against the
    // run. An event does not touch the run, in either direction.
    // And only in GAUNTLET MODE. A run is a thing you can walk away from and
    // come back to now, so while you are in Casual or Streak the run is parked:
    // it neither fills the opponent chair nor is scored by what happens in it.
    arenaGame === "gauntlet" && arenaMode === "ai" && !eventRun && gauntletRun && !runOver(gauntletRun)
      ? nextSeat(gauntletRun, boardSize)
      : null;
  /** THE RUN OWNS THE OPPONENT DECK while it is live.
   *
   *  `gauntletSeat` used to drive only the seat's label and its lock, and
   *  nothing re-pointed `p2DeckId` — so a run advanced its counter, the flag
   *  read "SEAT 2", and you fought the seat-1 deck again. Four times, with the
   *  label contradicting the deck name printed directly under it.
   *
   *  Keyed on the ID rather than the object: `nextSeat` looks the deck up
   *  fresh each render, so depending on the object would re-run every time.
   *  Also the single place the run sets the seat — starting a run no longer
   *  sets it by hand, because two writers is how they drift apart. */
  const gauntletSeatId = gauntletSeat?.id ?? null;
  useEffect(() => {
    if (gauntletSeatId && gauntletSeatId !== p2DeckId) setP2DeckId(gauntletSeatId);
  }, [gauntletSeatId, p2DeckId]);
  /** The draft's opponent, dealt from the rung its win count has earned.
   *
   *  Gated exactly like `gauntletSeat` above, and for the same reasons written
   *  there: vs-AI only, never over an event, and only while the mode is the one
   *  the run belongs to — so a draft parked mid-run neither seizes the opponent
   *  chair nor is scored by whatever you play instead. */
  // Read off the run rather than rolled here: a roll evaluated during render
  // re-rolls on every render, and the opponent would change while you looked at
  // it. `recordDraftResult` deals the next one as it scores the last.
  const draftSeat = arenaGame === "draft" && arenaMode === "ai" && !eventRun && draftPlaying(draftRun)
    ? PREMADE_DECKS.find((d) => d.id === draftRun!.seat) ?? null
    : null;
  const draftSeatId = draftSeat?.id ?? null;
  useEffect(() => {
    if (draftSeatId && draftSeatId !== p2DeckId) setP2DeckId(draftSeatId);
  }, [draftSeatId, p2DeckId]);
  // A PLAYING RUN ALWAYS HAS A SEAT, and this is what guarantees it. Two ways
  // it can be without one: a run saved before the seat was dealt at all (phase
  // 3 wrote no `seat`), or a stored id that no longer names a premade. Either
  // way the run would sit in the lobby with no opponent and no way to get one,
  // which is a dead save rather than a bad match. Re-dealing costs nothing and
  // fixes both.
  useEffect(() => {
    if (arenaGame !== "draft" || !draftPlaying(draftRun)) return;
    if (PREMADE_DECKS.some((d) => d.id === draftRun!.seat)) return;
    setStory((prev) => {
      if (!draftPlaying(prev.draft)) return prev;
      const next = { ...prev, draft: dealDraftSeat(prev.draft!) };
      if (next.draft === prev.draft) return prev;
      saveStory(next);
      return next;
    });
  }, [arenaGame, draftRun]);
  // ...and the drafted deck takes YOUR chair while its run is live, for the
  // same reason: a run deals both seats or it is not a run.
  useEffect(() => {
    if (draftDeck && arenaGame === "draft" && p1DeckId !== DRAFT_DECK_ID) setP1DeckId(DRAFT_DECK_ID);
  }, [draftDeck, arenaGame, p1DeckId]);
  /** Levels earned but not yet shown, or null.
   *
   *  Read straight off the save every render rather than latched into state:
   *  the level is derived from the collection, so the only honest source is the
   *  save itself, and a latch would need clearing on every path that changes it
   *  (a pack, a boss, a story clear, a restore). `claimLevelUp` writes the mark
   *  it just paid, so this goes null on its own the moment it is collected. */
  const levelUp = useMemo(() => pendingLevelUp(story), [story]);

  /** The account panel (email sign-in + cloud save). */
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  useEffect(() => {
    void currentUser().then((u) => setAccountEmail(u?.email ?? null));
    return onAuthChange((u) => setAccountEmail(u?.email ?? null));
  }, []);

  /** Which seat the deck sheet is filling, or null when it is shut. */
  const [pickSeat, setPickSeat] = useState<"p1" | "p2" | "p3" | "p4" | null>(null);
  // Premade builds sized for the CHOSEN battlefield — a 30-card large build must
  // never show up in a 4x4 picker, and vice versa.
  const modePremades = premadeDecksFor(boardSize);
  // Selectable decks = those + the player's own custom decks. Custom decks have
  // no board size of their own and are offered in both modes; the engine never
  // enforces deck length at match start, so a short deck simply runs out sooner.
  // Event decks are in the RESOLVER but never in a picker — `modePremades` and
  // `customDecks` are what the deck sheet is handed, and this list is not one of
  // them. Without them here the event seat resolved through the `?? modePremades[0]`
  // fallback and you fought Inferno Blitz under the event's name.
  const deckPool: CustomDeck[] = [...modePremades, ...customDecks, ...EVENT_DECKS, ...(draftDeck ? [draftDeck] : [])];
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

  // MOVED DOWN from the top of the component, because the Arena's battle
  // playlist is built from the decks in the seats and those are declared here.
  // Nothing else about it changed.
  // Background music. A story region owns the sound for BOTH its map and its
  // battles, so the region reads as a place rather than a series of fights; a
  // story battle therefore keeps its region theme instead of dropping to Rival.
  // Everything outside Story Mode is the old menu/battle pair.
  const storyRegionId = storyNode ? regionOfNode(storyNode.id)?.id : storyOpen ? region.id : undefined;
  // Elements play IN THE FIGHT, and only there — the playlist is the elements
  // actually on the table, so a match sounds like the decks in it. Everything
  // outside a match keeps Growth, the Arena lobby included: it briefly cycled
  // all eight there, which made the menu theme something you only heard on the
  // way past and turned a screen you are meant to leave into a jukebox.
  //
  // Built from the deck ids rather than from `game`, which holds only what has
  // been summoned so far — the music would arrive one element at a time as
  // cards hit the board, and change under the player mid-match.
  const musicTrack: MusicTrack | MusicTrack[] =
    (storyRegionId ? REGION_TRACK[storyRegionId] : undefined) ??
    (started && game.phase !== "gameover"
      ? battlePlaylist(resolveDeckCards(p1DeckId), resolveDeckCards(p2DeckId))
      : "menu");
  const { muted: musicMuted, toggle: toggleMusic } = useGameMusic(musicTrack);
  /** The deck the LOCAL player holds. Online, a guest sits in the P2 seat, so
   *  "your deck" is not always P1's — the versus card must not show the host's
   *  deck as yours. */
  const mySeatDeckId = onlineMode && onlineRole === "guest" ? p2DeckId : p1DeckId;
  const deckLabel = (deckId: string): string =>
    (deckPool.find((d) => d.id === deckId) ?? modePremades[0]).name;
  // Refreshed every render so the room callbacks never deal a stale deck — see
  // `deckNowRef`. Cheap: three lookups against an array already in memory.
  deckNowRef.current = {
    cards: resolveDeckCards(mySeatDeckId),
    spells: resolveDeckSpells(mySeatDeckId),
    name: deckLabel(mySeatDeckId),
  };

  /** The battlefield is the RUN's while one is live — it was dealt for a board
   *  and pays that board's rate. */
  // A run OWNS the battlefield it was dealt for, and a draft owns it hardest: a
  // run drafted on 4x4 holds eighteen cards and the big board wants thirty, so
  // a size change mid-run does not make the match harder, it makes the deck
  // illegal.
  const draftLocked = arenaGame === "draft" && !!draftRun && !draftRunOver(draftRun);
  const boardLocked = (arenaGame === "gauntlet" && !!gauntletRun && !runOver(gauntletRun)) || draftLocked;
  const runBoard = gauntletRun && !runOver(gauntletRun) ? boardOfRun(gauntletRun) : null;
  useEffect(() => {
    // Coming back to a run started on the other board, the lobby would show the
    // run's seats against the wrong field until you noticed. It snaps.
    if (arenaGame === "gauntlet" && runBoard && runBoard !== boardSize) setBoardSize(runBoard);
    if (draftLocked && draftRun!.board !== boardSize) setBoardSize(draftRun!.board);
  }, [arenaGame, runBoard, boardSize, draftLocked, draftRun]);

  /** MAY THIS MATCH START, and if not, what is wrong.
   *
   *  Two rules, both from the same principle: a mode that picks your opponent
   *  is a CHALLENGE, and a challenge you can bend the terms of is a sandbox
   *  wearing a challenge's name.
   *
   *    THE FORMAT. A 5x5 squad is thirty cards and a 4x4 squad is eighteen; the
   *    engine enforces neither, so a thirty-card squad would happily walk into a
   *    4x4 gauntlet with twelve extra cards of depth. Blocked in Streak and
   *    Gauntlet. Casual only WARNS — an unfinished squad against a deck you
   *    chose yourself is a sandbox, and that is what casual is for.
   *
   *    THE OPPONENT. Streak and Gauntlet do not start "a normal match". The
   *    seat is dealt, and with no run lined up there is nothing to fight yet —
   *    the button says so rather than quietly starting a fight that scores
   *    nothing against a deck you picked.
   *
   *  Online and hot-seat are neither: the other seat is a person. */
  const myDeckCheck = validateDeck(resolveDeckCards(mySeatDeckId), boardSize);
  const startGate: { ok: boolean; why?: string; warn?: string } = (() => {
    if (onlineMode || twoPlayer || storyNode) return { ok: true };
    const challenge = arenaGame === "gauntlet" || arenaGame === "streak" || arenaGame === "draft";
    if (challenge && !myDeckCheck.ok) {
      return {
        ok: false,
        why: `Your squad is not a ${boardSize}×${boardSize} squad — ${myDeckCheck.reason?.toLowerCase()}`,
      };
    }
    if (arenaGame === "gauntlet" && (!gauntletRun || runOver(gauntletRun)))
      return { ok: false, why: "Line up a gauntlet above to begin a run." };
    // Draft has one more state than the others: a run that exists but is still
    // CHOOSING has no deck to seat yet, so it needs its own sentence rather
    // than falling through to "your squad is not a 4x4 squad".
    if (arenaGame === "draft" && !draftRun)
      return { ok: false, why: "Draft a squad above to begin a run." };
    if (arenaGame === "draft" && !draftComplete(draftRun!))
      return { ok: false, why: `Finish your draft — ${draftSize(draftRun!) - draftRun!.picks.length} picks left.` };
    if (arenaGame === "draft" && draftRunOver(draftRun))
      return { ok: false, why: "That run is over. Draft again above." };
    return { ok: true, warn: myDeckCheck.ok ? undefined : myDeckCheck.reason };
  })();

  /** THE FIGHT ALREADY LINED UP, for the win screen.
   *
   *  Streak and Gauntlet both deal their own next opponent, so the moment a
   *  match ends there is a real, named, already-seated fight waiting. Showing
   *  it on the result screen is what turns "the mode picked for you" from a
   *  thing that happens to you into a thing you agree to — and it is the only
   *  place where leaving is offered as an equal option to continuing, which is
   *  what makes a saved run mean anything.
   *
   *  Null in every other case: story battles settle their own way, events are
   *  fought once, and two of the three Arena modes have nothing queued. */
  const nextUp: NextUp | null = (() => {
    if (storyNode || eventRun || twoPlayer || onlineMode) return null;
    if (game.phase !== "gameover") return null;
    const elements = [...new Set(resolveDeckCards(p2DeckId).map((id) => getDef(id).element))];
    if (arenaGame === "gauntlet") {
      const run = gauntletRun;
      // A finished run has nothing next — the panel in the lobby says what
      // happened, and this would be a button to fight a seat that does not
      // exist. Only a LIVE run queues a seat.
      if (!run || runOver(run)) return null;
      return {
        flag: `GAUNTLET · SEAT ${run.won + 1} OF ${run.seats.length}`,
        label: deckLabel(p2DeckId),
        elements,
        sub: `${run.seats.length - run.won} left · clear the run for ${runReward(run.tier, boardOfRun(run))} shards. `
          + "A loss ends it.",
        goLabel: `Fight seat ${run.won + 1}`,
        leaveLabel: "Leave — run is saved",
        onGo: startArenaMatch,
      };
    }
    if (arenaGame === "streak") {
      const streak = story.ladder?.streak ?? 0;
      const tier = tierForStreak(streak, boardSize);
      const pay = SHARDS_PER_WIN.arena
        + recordLadderMatch({ streak, best: streak }, { won: true, tier, boardSize }).bonus;
      return {
        flag: streak > 0 ? `STREAK · ${streak} IN A ROW` : "STREAK · NEXT UP",
        label: deckLabel(p2DeckId),
        elements,
        sub: `${TIER_LABEL[tier]} rung · a win pays ${pay} shards`
          + (streak > 0 ? ` · a loss drops you to ${TIER_LABEL[tierForStreak(afterMatch(streak, false, boardSize), boardSize)]}` : ""),
        goLabel: "Fight next opponent",
        leaveLabel: "Leave the streak",
        onGo: startArenaMatch,
      };
    }
    return null;
  })();

  // Switching battlefield re-points a premade selection at the same archetype's
  // build for the new size (Inferno Blitz 4x4 <-> Inferno Blitz 5x5) rather than
  // dumping the player back to the first deck. Custom decks are left alone.
  useEffect(() => {
    const remap = (id: string): string => {
      if (modePremades.some((d) => d.id === id)) return id;
      if (customDecks.some((d) => d.id === id)) return id;
      // An event deck is sized for ONE board and has no sibling build to swap
      // to. It also arrives together with a `setBoardSize`, so this effect fires
      // immediately after Home seats it — and without this line the lookup for
      // a non-existent `…_5` variant fell through to `modePremades[0]` and threw
      // the event opponent away between the tap and the match.
      if (EVENT_DECKS.some((d) => d.id === id)) return id;
      const base = id.endsWith("_5") ? id.slice(0, -2) : id;
      // 7 shares the large board's builds — see premadeDecksFor.
      const want = boardSize >= 5 ? `${base}_5` : base;
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
      navDo({ t: "result", result: { node: storyNode, won: [], captured: 0, lost: true } });
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
    navDo({ t: "result", result: { node: storyNode, won: result.won, shiny: result.shiny, captured } });
  }, [started, storyNode, game, storyResult, story]);
  // An Arena match settles up here: shards for the win, and the Gauntlet run
  // advances or ends.
  //
  // The win no longer pays against a deck you BUILT. Eighteen of your worst
  // cards in the opponent's seat was two shards a match for as long as you
  // cared to click, which made the honest path the slow one. A premade is an
  // opponent somebody else chose; your own deck is a mirror you can rig.
  //
  // A LOSS is recorded, not just a win — and before anything else — because a
  // run you can close the tab on is a run you cannot lose.
  const settledMatch = useRef<GameState | null>(null);
  useEffect(() => {
    if (!started || storyNode) return;                 // story pays on its own path
    if (game.phase !== "gameover") return;
    if (settledMatch.current === game) return;         // one settlement per match
    settledMatch.current = game;
    // ONLINE settles on its own short path and never touches the arena's.
    //
    // It used to fall straight through this effect, which got both halves
    // wrong: `won` was hardcoded to P1, so a GUEST — who sits in P2 — was paid
    // for losing and paid nothing for winning; and if the opponent happened to
    // have picked a premade, `againstPremade` was true and an online match
    // quietly paid arena rates. Neither the ladder nor a run may move here at
    // all: there is no rung behind a human, and a run is not something a
    // stranger's deck can spend.
    if (online) {
      const iWon = game.win?.winner === online.myId;
      // A surrender pays the surrenderer nothing. The consolation is for
      // showing up and losing a real match, and without this line the fastest
      // way to earn in the game is two people conceding to each other on
      // repeat — 15 shards a round trip, for no game.
      const paid = onlineMatchShards({
        won: iWon,
        surrendered: game.win?.by === "surrender" && !iWon,
      });
      if (paid) {
        setStory((prev) => {
          const next = addShards(prev, paid);
          saveStory(next);
          return next;
        });
      }
      return;
    }
    const won = game.win?.winner === "P1";
    const againstPremade = PREMADE_DECKS.some((d) => d.id === p2DeckId);
    const event = eventForDeck(p2DeckId);
    setStory((prev) => {
      // An event settles on its OWN path and never through `settleArena`, which
      // advances or ends a live Gauntlet run unconditionally — so routing an
      // event through it would burn a seat you never fought, or end the run
      // outright on a loss. It pays no arena shards either way: an event deck is
      // not in PREMADE_DECKS, so there was nothing for `settleArena` to award.
      //
      // The first clear's reward is paid inside the same set-membership check
      // that records it, so the two cannot come apart, and a loss records
      // nothing, leaving the event open.
      //
      // A REFIGHT pays too, for the events that carry `replayShards` — Void
      // Tower trials do. That means a repeated settle is no longer the no-op it
      // used to be, and what keeps it honest is the `settledMatch` ref above:
      // one settlement per match, the same guard the Arena's per-win shards
      // have always run on.
      // TAMING. Beating a boss while it is ENRAGED brings it over to your side
      // for the next three battles. Folded into the event settle rather than
      // bolted beside it so it rides the same `settledMatch` guard — one
      // settlement per match, so a re-render cannot re-tame.
      const tamedSave = (sv: StorySave) => {
        if (!won || !bossRun?.enraged) return sv;
        // Queue the reveal for the tower. Set here rather than in the win
        // screen because this is the only place that knows both that the match
        // was won and which boss it was against.
        setTowerOpenOn({ cardId: bossRun.cardId, justTamed: true });
        return tameBoss(sv, bossRun.cardId);
      };
      const settled = event
        ? (won ? tamedSave(completeEvent(prev, event.id)) : prev)
        : settleArena(
            prev,
            // The mode decides whether this match belongs to the run at all.
            { won, againstPremade, gauntletSeat: arenaGame === "gauntlet" },
            (sv) => awardShards(sv, "arena"),
          );
      // The draft run is a FOURTH axis, settled the same way and on the same
      // one-per-match guard. `draftSeat` is stated rather than inferred — see
      // settleDraft, and the Gauntlet bug it is copied from.
      const drafted = event
        ? settled
        : settleDraft(settled, { won, draftSeat: arenaGame === "draft" }, (sv, n) => addShards(sv, n));
      // The ladder is a THIRD axis, independent of both shards and the run: it
      // moves on any match against the rung it asked for — a matchmade fight or
      // a Gauntlet seat, both are premade decks at a known difficulty — and
      // never for an event, which has no rung and is fought once.
      // `recordLadderMatch` returns the same object when the seat was off-rung,
      // so hand-picking an easier opponent settles to `settled` untouched.
      // The ladder pays as well as tracking: a win on-rung banks bonus shards on
      // top of the Arena's flat rate, scaled by the rung faced and the streak
      // held. Both come from the one call, so the money and the streak can never
      // disagree about whether the match counted.
      // STREAK MODE ONLY. It used to move on any on-rung match, which meant a
      // casual fight against the right difficulty silently counted — and a
      // Gauntlet seat did too, scoring one match on two ladders at once.
      const climb = event || arenaGame !== "streak"
        ? null
        : recordLadderMatch(drafted.ladder, { won, tier: tierOf(p2DeckId), boardSize });
      const next = !climb || climb.ladder === drafted.ladder
        ? drafted
        : addShards({ ...drafted, ladder: climb.ladder }, climb.bonus);
      if (next !== prev) saveStory(next);
      return next;
    });
    // STREAK deals the next opponent itself, the moment this one falls.
    //
    // Two reasons it cannot wait for the lobby. You had to walk back and press
    // "Find a match" to get a fight the mode had already decided the shape of,
    // and — because a reroll excludes only the deck currently seated — the
    // opponent you had just beaten was as likely as any other to come straight
    // back. `rollOpponent`'s exclusion is what makes the run feel like a ladder
    // rather than the same three decks shuffled.
    //
    // The rung is read from the ladder AFTER this match, not before: winning
    // the fifth in a row moves you up, and the next opponent should already be
    // standing on the new rung when the win screen names it.
    if (arenaGame === "streak" && !event) {
      const climbed = recordLadderMatch(story.ladder, { won, tier: tierOf(p2DeckId), boardSize });
      const pick = rollOpponent(tierForStreak(climbed.ladder.streak, boardSize), boardSize, p2DeckId);
      if (pick) setP2DeckId(pick.id);
    }
  }, [started, storyNode, game, p2DeckId, boardSize, arenaGame, story, online]);

  useEffect(() => {
    if (me) setViewSide(me);
  }, [me]);
  // Online: the board is always shown from MY side; local: follow the active human.
  const view: PlayerId = online ? online.myId : (me ?? viewSide);
  /** The board reads foils per SEAT. Online both seats are known because the
   *  host relays them; offline only the viewer can have any, so the other side
   *  is empty rather than absent — a missing set and an empty one render the
   *  same, and one of them is a lie about the opponent. */
  const boardFoils = useMemo<{ P1?: ReadonlySet<string>; P2?: ReadonlySet<string> }>(() => {
    if (seatFoils) return { P1: new Set(seatFoils.P1), P2: new Set(seatFoils.P2) };
    return view === "P1" ? { P1: foilIds, P2: new Set() } : { P1: new Set(), P2: foilIds };
  }, [seatFoils, view, foilIds]);

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

  // Reliability heartbeat: BOTH sides re-broadcast their last-sent state every
  // few seconds, so a dropped or slow Realtime message self-heals.
  //
  // This used to fire only for whichever side "owned" the state — the player who
  // must act, or the host during a no-input step — to stop the two fighting over
  // it. That rule had a hole at every hand-off: the player who has just acted no
  // longer owns the turn, so it went quiet at the exact moment its copy was the
  // only one that existed. Watched it deadlock live at the mulligan, where the
  // guest is always last to act (`needsInput` returns P1 first): the guest held
  // the only both-mulliganed state, the host was still waiting on P2, and by
  // that rule NEITHER side re-sent. Nothing recovered it.
  //
  // Both can heartbeat safely now because `resend` carries a Lamport clock and
  // the receiver takes only strictly-newer states — a stale copy can no longer
  // overwrite a fresh one, which is what the ownership rule was really guarding
  // against. See `net/online.ts`.
  useEffect(() => {
    if (!online || !started || game.phase === "gameover") return;
    const t = setInterval(() => roomRef.current?.resend(), 2500);
    return () => clearInterval(t);
  }, [online, started, game.phase]);

  // Keep the hint fresh on phase/priority flips.
  const phaseKey = `${game.phase}:${game.prep?.priority ?? ""}:${game.battle?.awaitingInput ?? ""}`;
  const prevPhaseKey = useRef(phaseKey);
  useEffect(() => {
    if (prevPhaseKey.current === phaseKey) return;
    prevPhaseKey.current = phaseKey;
    setSel(null);
    setPending(null);
    setPicks([]);
    // A staged summon does not survive the turn it was staged in. It never
    // should have — the column it points at may be taken by the time priority
    // comes back — and now that it blocks Pass, a stale one would leave the
    // button reading "Confirm your summon first" over a summon that no longer
    // makes sense, with no way to clear it.
    setStaged(null);
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

  // Trap sprung → flash its art. Keyed on spellId, so a card-laid trap with no
  // spell behind it (Nightbriar's Dark Hunting) is silently skipped rather than
  // flashing a blank card.
  useEffect(() => {
    const now = game.traps.map((tr) => `${tr.pos.row},${tr.pos.col}:${tr.spellId ?? ""}`);
    const gone = prevTrapsRef.current.filter((k) => !now.includes(k));
    prevTrapsRef.current = now;
    // A FRESH MATCH is not four traps springing at once. `createInitialState`
    // opens in mulligan with an empty trap list, and the ref is still holding
    // the LAST match's board — the game object survives in the lobby, so the
    // baseline never got a chance to clear. Every trap from the game you just
    // finished would detonate on screen the moment you started the next one.
    // Nothing can spring during a mulligan (no movement, no battle), so this
    // suppresses no real trigger.
    if (game.phase === "mulligan") return;
    if (!started || trapFlashTimerRef.current !== null) return;
    const sprung = gone.map((k) => k.split(":")[1]).find(Boolean);
    if (!sprung) return;
    setCastFlash({ spellId: sprung });
    trapFlashTimerRef.current = window.setTimeout(() => {
      trapFlashTimerRef.current = null;
      setCastFlash(null);
    }, 1400);
  }, [game.traps, started]);
  useEffect(() => () => {
    if (trapFlashTimerRef.current !== null) window.clearTimeout(trapFlashTimerRef.current);
  }, []);

  function broadcast(state: GameState) {
    roomRef.current?.sendState(state, (seatNamesRef.current || seatFoilsRef.current)
      ? { names: seatNamesRef.current ?? undefined, foils: seatFoilsRef.current ?? undefined }
      : undefined);
  }

  /** Deal a fresh match from the remembered setup and drop straight into it.
   *
   *  Shared by every mode. Online it is the HOST that deals — the guest asks and
   *  waits — because one side has to own the seed or the two would deal
   *  different games. `fresh` tells the guest this is a new match rather than a
   *  step inside the old one, so it can clear its own handshake and replay the
   *  versus screen without having to infer either. */
  function dealRematch() {
    const s = setupRef.current;
    if (!s) return;
    const g = createInitialState(newSeed(), s.p1, s.p2, s.humans, s.p1s, s.p2s, s.board);
    setGame(g);
    setViewSide(online?.myId ?? "P1");
    setSel(null); setPending(null); setPicks([]); setMullToss([]); setStaged(null);
    setRematchMine(false); setRematchTheirs(false);
    setHint("Mulligan: click cards to send back, then confirm.");
    setStarted(true);
    if (online) {
      setPvpIntro(true);
      roomRef.current?.sendState(g, {
        names: seatNamesRef.current ?? undefined,
        foils: seatFoilsRef.current ?? undefined,
        fresh: true,
      });
    }
  }

  /** Deal an Arena match with whatever the two seats currently hold.
   *
   *  Lifted out of the Start Match button because the WIN SCREEN now starts
   *  matches too: Streak and Gauntlet deal your next opponent as soon as the
   *  last one falls, and "fight it" there has to mean exactly what the lobby
   *  button means — same seats, same setup, same remembered rematch. */
  /** Seat an event (or Void Trial) and drop the player in the Arena on its
   *  board, ready to start. Not auto-started: the fight is fought with YOUR
   *  deck and the Arena is where you pick it — walking in without that step
   *  would be fighting a designed puzzle with whatever was last selected.
   *  Shared by Home's event cards and the Void Tower's Fight buttons, so the
   *  two entry points cannot drift. */
  /** BOSS TAMING, in flight. Set when a fight is seated from the boss detail
   *  screen and read in two later places that cannot see that screen: match
   *  START (scale the boss up if enraged, place the tamed ally) and match
   *  SETTLE (a win over an enraged boss tames it).
   *
   *  It is not derivable from `p2DeckId` the way `eventRun` is, because the
   *  same trial event now seats two different fights — ordinary and enraged —
   *  and the choice of ally is not in the event at all. */
  const [bossRun, setBossRun] = useState<{
    cardId: string;
    enraged: boolean;
    ally: string | null;
  } | null>(null);
  /** The boss the tower should open on next time it is shown, and whether the
   *  player has just tamed it. The win screen has no idea which boss the match
   *  was against — it is handed a GameState, not a trial — so the moment a boss
   *  changes sides is recorded here and spent when the player leaves the
   *  result screen. */
  const [towerOpenOn, setTowerOpenOn] = useState<{ cardId: string; justTamed: boolean } | null>(null);

  function seatEventFight(e: GameEvent, opts?: { enraged?: boolean; ally?: string | null }) {
    setBossRun(e.bossId
      ? { cardId: e.bossId, enraged: !!opts?.enraged, ally: opts?.ally ?? null }
      : null);

    setArenaMode("ai");
    // BACK TO CASUAL. An event is not a Gauntlet seat and not a Streak match,
    // and leaving the mode where it was presented a Void Trial as one: the run
    // banner read "Seat 1 of 4 · Nightshrike's brood" and the start button said
    // "Start Gauntlet · Seat 1 of 4" over a boss fight that could not advance
    // the run in either direction. Casual is where a run is PARKED (see
    // `gauntletSeat`), so this leaves it intact and waiting rather than
    // spending or ending it — the same state as tapping Casual yourself.
    setArenaGame("casual");
    setBoardSize(e.boardSize);
    setP2DeckId(e.deck.id);
    setTab("arena");
  }

  function startArenaMatch() {
    const humans: PlayerId[] = twoPlayer ? ["P1", "P2"] : ["P1"];
    // Only Domination seats more than two, and only against AI: hot-seat and
    // online both hand the other seat to a person, and there is one other
    // person. Clamped here rather than in the picker so a leftover 4 from a
    // previous match cannot deal a four-way on a 5x5.
    // ...and a LADDER is one opponent per seat. Gauntlet deals a run of named
    // seats and Streak deals the next rung: both are "you versus this deck",
    // so a free-for-all there would be a run whose seat you only fought a third
    // of. Casual is where the extra chairs live.
    const ladder = arenaGame === "gauntlet" || arenaGame === "streak";
    const domSeats = boardSize === DOMINATION_7X7.boardSize
      && !twoPlayer && !onlineMode && !ladder
      ? seatCount : 2;
    const p1Cards = resolveDeckCards(p1DeckId);
    const p2Cards = resolveDeckCards(p2DeckId);
    // Remembered so Rematch can run the same two decks back.
    setupRef.current = {
      p1: p1Cards, p1s: resolveDeckSpells(p1DeckId),
      p2: p2Cards, p2s: resolveDeckSpells(p2DeckId),
      board: boardSize, humans,
    };
    // EXTRA SEATS (Domination free-for-all), now the PLAYER's choice rather
    // than the lobby's. They resolve through the same two helpers the first two
    // seats use, so a custom deck is legal in seat three and an id left over
    // from another battlefield degrades to this board's shelf exactly as P1's
    // and P2's do.
    const extraDeckIds = [p3DeckId, p4DeckId];
    const extraSeats = domSeats > 2
      ? (["P3", "P4"] as const).slice(0, domSeats - 2).map((id, i) => ({
          id,
          deck: resolveDeckCards(extraDeckIds[i]),
          spells: resolveDeckSpells(extraDeckIds[i]),
        }))
      : undefined;
    const fresh = createInitialState(
      newSeed(), p1Cards, p2Cards, humans,
      resolveDeckSpells(p1DeckId), resolveDeckSpells(p2DeckId),
      boardSize,
      // No opening allowance and no terrain in the Arena; the positions are
      // held so the scripted flag lands on the right parameter.
      undefined, undefined,
      // Only the EVENT seat is scripted. Your own deck is never reordered —
      // the ramp is the boss's, not a rule change. …and the ELITE rung, which
      // buys its difficulty the same way: an opening it cannot stumble on.
      scriptedP2 ? { P2: scriptedP2 } : undefined,
      extraSeats,
    );
    // DOMINATION: the 7x7 is the map, so picking that battlefield IS picking
    // the mode. Stamped here rather than plumbed through createInitialState
    // because it is a scoring rule, not a board dimension — everything else
    // about the match is built the ordinary way.
    if (boardSize === DOMINATION_7X7.boardSize) fresh.domination = newDomination(DOMINATION_7X7);
    // A Void Trial seats its BOSS directly on the board, outside the economy —
    // the deck is only its summons. `summonCard` is the same door every card
    // enters through, so auras and on-summon hooks all fire; clearing
    // `summonedThisRound` lets it act from the first round, which is what
    // "the boss is already standing when you arrive" means mechanically.
    if (eventRun?.bossId) {
      const seat = voidBossSeat(fresh.boardSize);
      // Scores this match as a boss fight: no slot race, and killing the boss
      // IS the win (see the `voidTower` branch in doCleanupPhase).
      fresh.voidTower = true;
      const inst = summonCard(fresh, "P2", eventRun.bossId, seat as never);
      inst.summonedThisRound = false;
      // ENRAGED: the taming trial. The same boss, angrier — scaled through the
      // one multiplier the whole feature runs on, so its Special is stronger
      // too and not just its body.
      if (bossRun?.enraged) scaleInstance(inst, ENRAGE_SCALE);
      // ...and SOME BOSSES HAVE A WALL OF THEIR OWN. Kheiringer opens behind
      // three Lava Gates: placed here, at setup, because a summon lands on the
      // summoner's home row and she would otherwise have played her gates
      // beside herself instead of in front. Read off the boss entry rather than
      // keyed to her id, so the next one that wants a wall declares it.
      const wallBoss = voidBossById(eventRun.bossId);
      if (wallBoss?.wall) {
        for (const wseat of bossWallSeats(fresh.boardSize)) {
          if (cardAt(fresh, wseat.row, wseat.col)) continue;
          const brick = summonCard(fresh, "P2", wallBoss.wall, wseat as never);
          brick.summonedThisRound = false;
        }
      }
      // ...and the player gets a WALL. Fortress Gates fill the row directly in
      // front of their home row, one per column, and cost them nothing — they
      // are there so the opening rounds are not decided before the player has a
      // board, and they feed the boss nothing when they fall (`noKillReward`).
      for (const gseat of voidGateSeats(fresh.boardSize)) {
        const gate = summonCard(fresh, "P1", VOID_GATE, gseat as never);
        gate.summonedThisRound = false;
      }
      // ...and a TAMED boss fights alongside them, seated the same way the enemy
      // boss is: on the board at round one, outside the economy. It has to be —
      // a 12-cost mythic is not something a tower fight ever affords,
      // so a tamed boss you had to buy would be a tamed boss you never fielded.
      // Half of everything (`TAME_SCALE`) and three battles is what pays for it.
      //
      // The seat is the player's own centre home slot, mirroring `voidBossSeat`.
      // The gates stand in the row IN FRONT of home, so this square is free.
      if (bossRun?.ally) {
        const mySeat = { row: homeRow("P1", fresh.boardSize), col: Math.floor(fresh.boardSize / 2) };
        if (!cardAt(fresh, mySeat.row, mySeat.col)) {
          const ally = summonCard(fresh, "P1", bossRun.ally, mySeat as never);
          ally.summonedThisRound = false;
          ally.tamed = true;
          scaleInstance(ally, TAME_SCALE);
        }
      }
    }
    // A use is spent on ENTERING, win or lose. Done here rather than at settle
    // deliberately: settling only runs when a match reaches gameover, so paying
    // there would make backing out of a fight free and a taming farmable by
    // conceding at round one.
    if (bossRun?.ally) {
      const spendId = bossRun.ally;
      setStory((prev) => {
        const next = spendTame(prev, spendId);
        if (next !== prev) saveStory(next);
        return next;
      });
    }
    setGame(fresh);
    setViewSide("P1");
    setSel(null);
    setPending(null);
    setPicks([]);
    setMullToss([]);
    setHint("Mulligan: click cards to send back, then confirm.");
    setStarted(true);
  }

  /** The Rematch button. Offline it just re-deals; online it is a handshake. */
  function askRematch() {
    if (!online) { dealRematch(); return; }
    setRematchMine(true);
    roomRef.current?.sendRematch();
  }

  // Both sides have asked — the host deals. Runs on the host only, so there is
  // exactly one dealer and one seed.
  useEffect(() => {
    if (!online || online.role !== "host") return;
    if (rematchMine && rematchTheirs) dealRematch();
    // dealRematch reads refs and setters that are stable enough for this; the
    // guard above is what actually gates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rematchMine, rematchTheirs, online]);

  /** `doneHint` is a FUNCTION of the resulting state, not a string, because the
   *  useful thing to say after a move is usually a fact about the board it left
   *  behind — "keep going" is a lie if the move just spent the last Gold. The
   *  reducer is pure and hands `next` back synchronously, so the honest version
   *  costs nothing: ask the same engine questions the UI already asks, against
   *  the state the player is about to be looking at. */
  function dispatch(intent: Intent, doneHint?: (next: GameState) => string) {
    try {
      const next = applyIntent(game, intent);
      setGame(next);
      setSel(null);
      setPending(null);
      setPicks([]);
      setSpellPicks({ ids: [], slots: [] }); // never carry a half-built cast over
      setStaged(null);
      if (doneHint) setHint(doneHint(next));
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
    // EVERY opponent, not one of them. This read a single seat — `enemyOf` —
    // which is the whole story in a 1v1 and a third of it in a four-player
    // free-for-all: P3 and P4 could cast anything they liked and the board
    // never flashed it, so two of your three opponents played invisibly.
    const opps: PlayerId[] = online
      ? seatsOf(game).filter((p) => p !== online.myId)
      : twoPlayer ? [] : ["P2"];
    const oppKey = opps.join(",");
    if (opps.length === 0) { prevOppSeatRef.current = null; return; }
    // COUNTED, not a set of ids: a book can hold two of a cheap spell, and with
    // a set the opponent's second cast of one changed nothing and never flashed.
    // Counted ACROSS the seats too, so two opponents casting the same spell in
    // one round reads as two casts rather than one.
    const nowUsed = new Map<string, number>();
    for (const p of opps)
      for (const sl of game.players[p]?.spellbook ?? [])
        if (sl.used) nowUsed.set(sl.defId, (nowUsed.get(sl.defId) ?? 0) + 1);
    // RE-BASELINE INSTEAD OF FLASHING, in the three cases where a difference in
    // this set is not somebody casting a spell. Same bug the trap flash above
    // already carries a guard for, and the same cause: the finished game object
    // SURVIVES INTO THE LOBBY, so a diff taken there is against last match.
    //
    //   · not in a match — the lobby, where nothing should flash at all. This
    //     effect never had the `started` gate its two neighbours do.
    //   · a fresh deal (mulligan) — nothing can have been cast yet.
    //   · THE OPPONENT'S SEAT CHANGED, which is the one that actually bit.
    //     Vs the AI the opponent is P2; as an online GUEST it is P1. Joining a
    //     room flips `online` while `game` is still the last match, so the diff
    //     switched to reading the seat the PLAYER had been sitting in — and
    //     every spell they cast last game read as freshly used and flashed, in
    //     the lobby, on top of the versus screen.
    if (!started || game.phase === "mulligan" || prevOppSeatRef.current !== oppKey) {
      prevOppSeatRef.current = oppKey;
      prevOppUsedRef.current = nowUsed;
      return;
    }
    let fresh: string | null = null;
    for (const [id, n] of nowUsed)
      if (n > (prevOppUsedRef.current.get(id) ?? 0)) { fresh = id; break; }
    prevOppUsedRef.current = nowUsed;
    if (fresh && castTimerRef.current === null) {
      setCastFlash({ spellId: fresh });
      if (oppFlashTimerRef.current !== null) window.clearTimeout(oppFlashTimerRef.current);
      oppFlashTimerRef.current = window.setTimeout(() => { oppFlashTimerRef.current = null; setCastFlash(null); }, 2000);
    }
  }, [game, online, twoPlayer, started]);

  // Announce the OPPONENT's powerful creatures. Their summons resolve outside
  // confirmSummon (AI / remote), so we diff the board for a legendary+ instance
  // we have not seen before. Keyed by instanceId, which is unique per summon, so
  // a card that leaves and is re-summoned announces again — but the same card
  // sitting on the board across renders never re-fires. Skipped while a local
  // announcement or cast flash is mid-flight so nothing gets clobbered.
  useEffect(() => {
    if (!started) return;
    // Every opponent, for the same reason the spell flash needed it: a
    // legendary walking onto the board is the loudest thing that happens in a
    // round, and two of three opponents were doing it silently.
    const opps: PlayerId[] = online
      ? seatsOf(game).filter((p) => p !== online.myId)
      : twoPlayer ? [] : ["P2"];
    let fresh: string | null = null;
    for (const c of Object.values(game.cards)) {
      if (!c.pos) continue;
      // Keyed by instanceId (unique per summon), so a card sitting on the board
      // across renders never re-fires, while a re-summoned one announces again.
      // EVERY new card is marked seen, mine included — my own already got its
      // preview in confirmSummon, and the owner check below skips it regardless.
      if (seenBigRef.current.has(c.instanceId)) continue;
      seenBigRef.current.add(c.instanceId);
      if (opps.includes(c.owner) && announces(c.defId) && fresh === null) fresh = c.defId;
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

  /** Tell the room what I am bringing.
   *
   *  The host updates its own roster directly; a guest re-sends its join, which
   *  the host keys on `clientId` and treats as an update to that seat. Same
   *  message either way, so there is one path for "this is my deck now". */
  function announceMe(ready: boolean) {
    if (!roomRef.current || onlineStartedRef.current) return;
    if (onlineRole === "host") {
      hostReadyRef.current = ready;
      publishLobby();
    } else {
      roomRef.current.sendJoin(
        clientIdRef.current, deckNowRef.current.cards, deckNowRef.current.spells,
        deckNowRef.current.name, [...foilIds], ready);
    }
  }

  // Changing deck in the lobby re-announces it AND un-readies you — agreeing to
  // start and then swapping your list underneath everyone is exactly what a
  // ready flag is there to prevent.
  const lobbyDeckId = mySeatDeckId;
  useEffect(() => {
    if (!roomRef.current || onlineStartedRef.current || !lobby) return;
    setIAmReady(false);
    announceMe(false);
    // announceMe reads refs that are fresh every render; re-running on the deck
    // id alone is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyDeckId]);

  // ── online rooms ──────────────────────────────────────────────────────────
  function hostCreateRoom() {
    if (!onlineConfigured) {
      setNetStatus("⚠ Online isn't configured — set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.");
      return;
    }
    const code = (roomCode.trim() || Math.random().toString(36).slice(2, 7)).toUpperCase();
    setRoomCode(code);
    // NOT snapshotted any more: the lobby exists so the host can still change
    // deck after opening the room, and `deckNowRef` is read when it deals.
    // Snapshotted like the deck above: onJoin fires much later, and reading
    // `boardSize` from the closure then would take whatever the picker showed
    // at join time rather than what the host actually opened the room with.
    const hostBoardSize = boardSize;
    const hostName = deckLabel(p1DeckId); // snapshotted with the deck, same reason
    // How many seats this room is for, snapshotted with everything else. Only
    // the Domination board can seat more than two.
    const hostSeatCount = hostBoardSize === DOMINATION_7X7.boardSize ? seatCount : 2;
    lobbyRef.current = [];
    hostSeatCountRef.current = hostSeatCount;
    hostBoardRef.current = hostBoardSize;
    setIAmReady(false);
    setLobby({ seats: [{ seat: "P1", name: hostName, ready: false, host: true }], need: hostSeatCount });
    setNetStatus(hostSeatCount > 2
      ? `Room ${code} open — share this code. 1 of ${hostSeatCount} seated…`
      : `Room ${code} open — share this code. Waiting for your buddy…`);
    onlineStartedRef.current = false;
    roomRef.current = joinRoom(code, "host", {
      onState: (state) => setGame(state),
      onRematch: () => setRematchTheirs(true),
      onChat: receiveChat,
      onJoin: (clientId, guestCards, guestSpells, guestName, guestFoils, guestReady) => {
        if (onlineStartedRef.current) return; // already playing — ignore re-joins
        const lobby = lobbyRef.current;
        // A REJOIN keeps its seat. `sendJoin` fires on every subscribe, and a
        // flaky connection can subscribe twice — without this the same person
        // would take two seats and the room would never fill.
        const already = lobby.find((e) => e.clientId === clientId);
        const seat: PlayerId = already?.seat
          ?? (["P2", "P3", "P4"] as const)[lobby.length]
          ?? "P4";
        if (already) {
          // A LOBBY UPDATE: this player changed deck or readiness. Same seat,
          // new contents — which is what makes the lobby a lobby rather than a
          // waiting room.
          already.cards = guestCards;
          already.spells = guestSpells;
          already.name = guestName;
          already.foils = guestFoils ?? [];
          already.ready = !!guestReady;
        } else {
          if (lobby.length >= hostSeatCount - 1) return; // room is full
          lobby.push({
            clientId, seat, cards: guestCards, spells: guestSpells,
            name: guestName, foils: guestFoils ?? [], ready: !!guestReady,
          });
        }
        // Tell them which seat they are in, and how full the room is. Sent on a
        // rejoin too, so a guest that missed the first one still learns it.
        roomRef.current?.sendSeat(clientId, seat, lobby.length + 1, hostSeatCount);
        setNetStatus(`Room ${code} — ${lobby.length + 1} of ${hostSeatCount} seated…`);
        publishLobby();
      },
    });
    setOnline({ role: "host", code, myId: "P1" });
  }

  /** HOST: publish the roster so every client renders the same lobby. */
  function publishLobby() {
    const seats: LobbySeat[] = [
      { seat: "P1", name: deckNowRef.current.name, ready: hostReadyRef.current, host: true },
      ...lobbyRef.current.map((e) => ({
        seat: e.seat, name: e.name?.trim() || "Their deck", ready: e.ready,
      })),
    ];
    setLobby({ seats, need: hostSeatCountRef.current });
    roomRef.current?.sendLobby(seats, hostSeatCountRef.current);
  }

  /** HOST: deal the match everyone in the lobby agreed to.
   *
   *  Separated from `onJoin` on purpose. Dealing the instant the last seat
   *  filled meant the room was never a lobby — nobody could change a deck,
   *  because the game had already started by the time they saw who they were
   *  playing. */
  function hostStartMatch() {
    const lobby = lobbyRef.current;
    const code = roomCode;
    const hostBoardSize = hostBoardRef.current;
    if (onlineStartedRef.current || lobby.length < hostSeatCountRef.current - 1) return;
    onlineStartedRef.current = true;
    const hostCards = deckNowRef.current.cards;
    const hostSpells = deckNowRef.current.spells;
    const hostName = deckNowRef.current.name;
    const seats: PlayerId[] = ["P1", ...lobby.map((e) => e.seat)];
    const g = createInitialState(
      newSeed(), hostCards, lobby[0].cards, seats,
      hostSpells, lobby[0].spells, hostBoardSize,
      undefined, undefined, undefined,
      lobby.slice(1).map((e) => ({ id: e.seat, deck: e.cards, spells: e.spells })),
    );
    if (hostBoardSize === DOMINATION_7X7.boardSize) g.domination = newDomination(DOMINATION_7X7);
    // The host is the only side that knows EVERY name, so it names the seats
    // and relays them; the others read them off the state message.
    const names: Partial<Record<PlayerId, string>> = { P1: hostName };
    const foils: Partial<Record<PlayerId, string[]>> = { P1: [...foilIds] };
    for (const e of lobby) {
      names[e.seat] = e.name?.trim() || "Their deck";
      foils[e.seat] = e.foils;
    }
    seatNamesRef.current = names;
    setSeatNames(names);
    seatFoilsRef.current = foils;
    setSeatFoils(foils);
    setupRef.current = {
      p1: hostCards, p1s: hostSpells, p2: lobby[0].cards, p2s: lobby[0].spells,
      board: hostBoardSize, humans: seats,
    };
    setRematchMine(false); setRematchTheirs(false);
    setGame(g);
    setViewSide("P1");
    setSel(null); setPending(null); setPicks([]); setMullToss([]);
    setHint(seats.length > 2
      ? `All ${seats.length} seated! Mulligan: click cards to send back, then confirm.`
      : "Buddy joined! Mulligan: click cards to send back, then confirm.");
    setOnline({ role: "host", code, myId: "P1" });
    setStarted(true);
    setPvpIntro(true);
    roomRef.current?.sendState(g, { names, foils }); // deal the opening state
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
    const guestName = deckLabel(p2DeckId);
    setNetStatus(`Joining ${code}…`);
    onlineStartedRef.current = false;
    // One id per join attempt. It is what lets the host hand this client a seat
    // and recognise it again if the connection blips and it re-subscribes.
    clientIdRef.current = Math.random().toString(36).slice(2) + Date.now().toString(36);
    mySeatRef.current = "P2";
    roomRef.current = joinRoom(code, "guest", {
      onLobby: (seats, need) => setLobby({ seats, need }),
      onSeat: (clientId, seat, have, need) => {
        if (clientId !== clientIdRef.current) return; // somebody else's seat
        mySeatRef.current = seat;
        setOnline({ role: "guest", code, myId: seat });
        setNetStatus(need > 2
          ? `Seated as ${seat} — ${have} of ${need} in the room…`
          : `Seated as ${seat} — waiting for the host…`);
      },
      onState: (state, meta) => {
        setGame(state);
        // Every state carries them, so a missed opening message is not a
        // permanently nameless versus screen.
        if (meta?.names) { seatNamesRef.current = meta.names; setSeatNames(meta.names); }
        if (meta?.foils) { seatFoilsRef.current = meta.foils; setSeatFoils(meta.foils); }
        // A rematch the host has dealt: clear the handshake and replay the
        // versus screen, rather than leaving the guest on a stale result.
        if (meta?.fresh && onlineStartedRef.current) {
          setRematchMine(false); setRematchTheirs(false);
          setSel(null); setPending(null); setPicks([]); setMullToss([]); setStaged(null);
          setHint("Mulligan: click cards to send back, then confirm.");
          setPvpIntro(true);
        }
        if (!onlineStartedRef.current) {
          onlineStartedRef.current = true;
          // The seat the host gave us, from the ref rather than state: `onSeat`
          // and this callback both close over the same render, so the state set
          // there is not visible here yet.
          setViewSide(mySeatRef.current);
          setSel(null); setPending(null); setPicks([]); setMullToss([]);
          setHint("Connected! Mulligan: click cards to send back, then confirm.");
          setOnline({ role: "guest", code, myId: mySeatRef.current });
          setStarted(true);
          setPvpIntro(true);
        }
      },
      onRematch: () => setRematchTheirs(true),
      onChat: receiveChat,
      onSubscribed: () => roomRef.current?.sendJoin(
        clientIdRef.current, guestCards, guestSpells, guestName, [...foilIds], false),
    });
    setOnline({ role: "guest", code, myId: "P2" });
  }

  function leaveOnline() {
    roomRef.current?.close();
    roomRef.current = null;
    // The log belongs to the room, not to the app. Carrying it into the next
    // match would show a stranger the last table's conversation.
    setChat([]); setChatOpen(false); setChatUnread(0);
    onlineStartedRef.current = false;
    setLobby(null);
    setIAmReady(false);
    hostReadyRef.current = false;
    lobbyRef.current = [];
    setOnline(null);
    setNetStatus("");
    setPvpIntro(false); // else it reappears over the next room's deal
    seatNamesRef.current = null;
    setSeatNames(null);
    setRematchMine(false);
    setRematchTheirs(false);
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

  /** Where a card summoned into this column ACTUALLY lands — the same
   *  resolution `stagedSlot` does, pulled out so the click handlers can ask the
   *  question before anything is staged. */
  function landingSlotFor(col: number, row?: number): Pos | null {
    if (me === null) return null;
    if (game.domination) return row === undefined ? null : ({ row, col } as Pos);
    return { row: summonLandingRow(game, me, col) ?? homeRow(me, game.boardSize), col } as Pos;
  }

  /** DOES THIS PLACEMENT HAVE ANYTHING TO CONFIRM?
   *
   *  The confirm step exists for ONE reason: a card with a hostile on-summon
   *  effect paints a red area when it is staged, and that area is information
   *  the player did not have when they picked the square. Committing before
   *  they can read it would be asking them to agree to something unseen.
   *
   *  A card with no such effect paints nothing. For those the confirm was a
   *  second press that added no fact — and it charged for it: three taps per
   *  card, a bar over the hand, and a full opening deploy costing eighteen
   *  presses instead of twelve. Note that moving a card on the board has never
   *  asked twice, so the summon was also the odd one out.
   *
   *  So: confirm when there is a picture to read, place when there is not. */
  function needsConfirm(handId: string, col: number, row?: number): boolean {
    if (me === null) return false;
    const h = game.players[me].hand.find((c) => c.handId === handId);
    const slot = landingSlotFor(col, row);
    if (!h || !slot) return true; // unknown = ask; never commit on a guess
    return previewOnSummonArea(game, getDef(h.defId), me, slot).length > 0;
  }

  /** WHAT TO SAY AFTER A SUMMON LANDS.
   *
   *  It used to be the flat "Summoned. Keep going, or Pass Priority." every
   *  time — including when the summon had just spent the last Gold, which is
   *  the first thing a new player reads after their opening deploy. "Keep
   *  going" then sends them tapping at a hand where nothing is playable, and
   *  the game looks broken rather than finished.
   *
   *  `summonSquare` is the same question the hand's own glow asks, so this
   *  cannot disagree with which cards are lit. */
  function summonHint(next: GameState): string {
    if (me === null) return "Summoned.";
    const verb = next.opening ? "Deployed" : "Summoned";
    if (next.players[me].hand.some((h) => summonSquare(next, me, h.handId)))
      return `${verb}. Keep going, or <b>Pass Priority</b>.`;
    // Nothing else is playable — say WHICH wall was hit, because the two have
    // opposite answers: a full row wants a card moved forward, an empty purse
    // wants the round to end.
    const roomLeft = next.domination
      ? homeSlots(next, me).some((sq) => !cardAt(next, sq.row, sq.col))
      : openHomeSlots(next, me).length > 0;
    if (!roomLeft) return `${verb}. Your Home row is full — <b>Pass Priority</b>.`;
    return next.opening
      ? `${verb}. Nothing else fits your opening — <b>Pass Priority</b>.`
      : `${verb}. Nothing else in hand is affordable yet — <b>Pass Priority</b>.`;
  }

  /** Stage for confirm, or just place it — see `needsConfirm`. */
  function stageOrPlace(handId: string, col: number, row?: number) {
    if (needsConfirm(handId, col, row)) {
      setStaged({ handId, col, row });
      setHint("Confirm placement — <b>red</b> marks where its on-summon effect lands.");
      return;
    }
    placeSummon(handId, col, row);
  }

  // Confirm / cancel a staged summon placement.
  function confirmSummon() {
    if (!staged) return;
    placeSummon(staged.handId, staged.col, staged.row);
  }

  /** Commit a summon. Reached from the confirm bar, and directly from the slot
   *  click / drop for the placements that have nothing to confirm. */
  function placeSummon(handId: string, col: number, row?: number) {
    if (me === null) return;
    const staging = game.players[me].hand.find((h) => h.handId === handId);
    const intent: Intent = {
      type: "SUMMON", player: me, handId, col, row,
      // The player's remembered default for this card, if they set one. Read
      // here and sent WITH the intent, so the engine stays pure and an online
      // peer replaying it lands on the same mode.
      autoMode: staging ? autoPrefFor(staging.defId) : undefined,
    };
    const card = staging;
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
        dispatch(intent, summonHint);
      }, 2000);
      return;
    }
    dispatch(intent, summonHint);
  }
  function cancelSummon() {
    setStaged(null);
    setHint("Placement cancelled — pick another slot, or a different card.");
  }

  // Drag-to-summon: grab a hand card, drag over a home slot (live red preview),
  // drop to stage it for confirm.
  function onDragStartCard(handId: string) {
    if (me === null || game.phase !== "prep" || game.prep?.priority !== me) return;
    // Same gate as the tap, and now literally the same call: some SQUARE has to
    // be willing to take the card, otherwise the drag arms a summon with nowhere
    // to drop it.
    if (!summonSquare(game, me, handId)) return;
    setSel({ kind: "hand", handId }); // arm so the legal home slots light up
    setStaged(null);
    setDrag(handId);
    setDragCol(null);
    setDragRow(null);
  }
  function onDragEndCard() {
    setDrag(null);
    setDragCol(null);
    setDragRow(null);
  }
  function onSlotDragOver(row: number, col: number) {
    if (dragCol !== col) setDragCol(col);
    if (dragRow !== row) setDragRow(row);
  }
  function onSlotDrop(_row: number, col: number) {
    if (drag === null || me === null) return;
    // Try the square itself first (a Domination shrine), then the column.
    if (game.domination && canSummon(game, me, drag, col, _row).ok) {
      const handId = drag;
      setDrag(null);
      setDragCol(null);
      setDragRow(null);
      stageOrPlace(handId, col, _row);
      return;
    }
    const chk = canSummon(game, me, drag, col);
    if (!chk.ok) {
      setHint(`⚠ ${chk.reason ?? "Home row only."}`);
      setDrag(null);
      setDragCol(null);
      setDragRow(null);
      return;
    }
    const handId = drag;
    setDrag(null);
    setDragCol(null);
    setDragRow(null);
    // A DROP IS ALREADY A DELIBERATE, AIMED GESTURE — and the drag painted the
    // red area live the whole way in, so for these there is even less left to
    // confirm than for a tap. It still asks when there IS an area, because the
    // finger is over the square and the picture is under it.
    stageOrPlace(handId, col);
  }

  // ── legality highlights ───────────────────────────────────────────────────
  /** Home-row columns that could take a summon at all. Empty = the row is full
   *  (or captured/contested) end to end, so nothing in hand is placeable no
   *  matter what it costs — a board problem, not a Gold problem. */
  // "Is there anywhere to put a card" — the Home row's open columns on a
  // standard board, the free shrines in Domination.
  const openSlots = useMemo(
    () => (game.domination
      ? homeSlots(game, view).filter((sq) => !cardAt(game, sq.row, sq.col))
      : openHomeSlots(game, view)),
    [game, view]);

  /** Which hand cards can actually be summoned right now, asked of the engine
   *  card-by-card over every column — the SAME canSummon that decides which
   *  slots glow. The hand used to answer this itself with `cost <= gold`, which
   *  drifted from the real rule in both directions: with a full home row every
   *  affordable card still lit up and armed a summon no slot would accept (tap
   *  it and the board just sits there), and during the FREE opening deployment
   *  — where Gold is 0 and slots are the currency — every card read as broke. */
  const summonableHandIds = useMemo(() => {
    const out = new Set<string>();
    for (const h of game.players[view].hand)
      if (summonSquare(game, view, h.handId)) out.add(h.handId);
    return out;
  }, [game, view]);

  const legalSlots: Pos[] = useMemo(() => {
    if (game.phase !== "prep") return [];
    const hr = homeRow(view, game.boardSize);
    if (sel?.kind === "hand") {
      const out: Pos[] = [];
      for (let col = 0; col < game.boardSize; col++)
        if (canSummon(game, view, sel.handId, col).ok)
          // The LANDING square, which is the Home row until the Home row has
          // been captured out from under this side — then it is forward of it,
          // and lighting the padlocked square instead sent the player clicking
          // at a slot nothing can stand on.
          out.push({ row: summonLandingRow(game, view, col) ?? hr, col } as Pos);
      // DOMINATION deploy squares: the four neutral shrines, plus the rings of
      // any Point this side holds. Read from `homeSlots` rather than the map's
      // shrine list, so a Point that flips takes its landing squares with it
      // without this having to know the rule.
      if (game.domination)
        for (const sq of homeSlots(game, view))
          if (canSummon(game, view, sel.handId, sq.col, sq.row).ok)
            out.push({ row: sq.row, col: sq.col } as Pos);
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
        // Row / two-row AoE: glow every legal target row. Asking canCastSpell
        // rather than re-deriving the rule here is the point — a two-row sweep
        // has to clear the Home-slot gate on the row it SPILLS into as well,
        // and a second copy of that check is a second chance to get it wrong.
        const out: Pos[] = [];
        for (let r = 0; r < game.boardSize; r++) {
          if (!canCastSpell(game, view, spell.id, { row: r }).ok) continue;
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
      case "command":
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
      // A capped battle command names its own: every kin that can still be
      // given the order, minus the ones already holding it.
      if (spell.command)
        return spellCommandTargets(game, view, spell)
          .filter((c) => !spellPicks.ids.includes(c.instanceId))
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
    // A DIVE is not a swing. `plummetTargets` keeps only the bodies the drop can
    // actually FINISH (curHp strictly under the dive’s DMG), and the basic list
    // is by construction a strict SUPERSET of it. Falling through to
    // `validTargets` here lit up every enemy in reach — including the fat ones
    // the dive cannot kill — and the engine then slid the pick onto the first
    // legal victim, so tapping the 12 HP body killed the 3 HP one beside it.
    if (pending === "plummet")
      return plummetTargets(game, awaitingId).map((t) => t.instanceId);
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
  // WHERE THE CARD ACTUALLY ARRIVES — resolved exactly as the reducer resolves
  // it, rather than assumed to be the Home row. Both of the places that assumed
  // it drew the ghost and the red on-summon area on the wrong square:
  //
  //   • a Domination summon names its own SQUARE (a shrine, or a ring of a Point
  //     this side holds) and the ghost appeared on the Home row — a row that mode
  //     does not even use.
  //   • a Home row captured end to end lands the card FORWARD of it
  //     (`summonLandingRow`), and the preview still pointed at the padlocked
  //     square the card could not occupy.
  //
  // A staged square names its own row; a drag reads the square it is hovering.
  const activeRow = staged?.row ?? dragRow ?? null;
  const stagedSlot: Pos | null = useMemo(() => {
    if (activeHandId === null || activeCol === null || me === null) return null;
    if (game.domination) {
      // No Home row to fall back to — the square is the address, so an unknown
      // one means there is nothing honest to draw.
      return activeRow === null ? null : ({ row: activeRow, col: activeCol } as Pos);
    }
    const row = summonLandingRow(game, me, activeCol) ?? homeRow(me, game.boardSize);
    return { row, col: activeCol } as Pos;
  }, [activeHandId, activeCol, activeRow, me, game]);
  const previewArea: Pos[] = useMemo(() => {
    if (activeHandId === null || stagedSlot === null || me === null) return [];
    const h = game.players[me].hand.find((c) => c.handId === activeHandId);
    if (!h) return [];
    return previewOnSummonArea(game, getDef(h.defId), me, stagedSlot);
  }, [activeHandId, stagedSlot, me, game]);
  // THE BOSS TELEGRAPH — the countdown badges, and the red zone under the
  // Special that lands at the end of this round. Both come back empty for any
  // fight without a boss clock in it, so every other mode is untouched.
  const telegraphs = useMemo(() => bossTelegraphs(game), [game]);
  const blast = useMemo(() => (view === null ? [] : telegraphBlast(game, view)), [game, view]);
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
    // Never arm a summon that no square would take: the hint would send the
    // player hunting for a glowing slot that doesn't exist. Ask the engine
    // about a square that IS open, so its refusal is about the card (Gold, the
    // opening ceiling) rather than about whichever square happens to be first.
    //
    // `homeSlots` rather than the Home row, because Domination has no Home row
    // — it deploys at the four shrines. Asking the old column-addressed
    // question there refused every card before it could even be armed, which
    // is a hand you cannot play at all.
    const dom = !!game.domination;
    const spots = homeSlots(game, me);
    // ONE CAPTURED SQUARE USED TO LOCK THE WHOLE HAND. "Open" was read as
    // `!cardAt` — occupancy and nothing else — and the engine was then asked
    // about `open[0]` ALONE. A captured Home slot holds no card once its captor
    // walks off, so it passed that filter, sorted first by column, and answered
    // "Slot is permanently captured" for every card the player tapped, with the
    // rest of the Home row standing wide open. Measured on both duel boards:
    // one captured slot at column 0, engine says yes on columns 1..n-1, the
    // hand strip lights the card as playable — and tapping it is refused.
    //
    // It only ever bit HERE, which is why it looked so arbitrary: the drag path
    // and `summonableHandIds` both loop every square already, so the card lit
    // up, dragged fine, and refused the tap. And it only bit in the 4x4/5x5
    // duel, because that is the only mode where slots are captured at all
    // (Void Tower and Domination both switch capture off) — on a four-wide
    // Home row, one lost square is a quarter of the deployment.
    //
    // So ask about EVERY square and arm if any one of them will take the card.
    if (!summonSquare(game, me, handId)) {
      // Nothing takes it. To say WHY, ask a square that is genuinely free —
      // `openHomeSlots` is the engine's own answer to that, capture and contest
      // included — because canSummon tests the card before it tests the square,
      // so a free square's refusal is about the card (Gold, the opening
      // ceiling). No free square at all means the board is the problem.
      const free = dom
        ? spots.find((sq) => !cardAt(game, sq.row, sq.col) && !isCaptured(game, sq.row, sq.col))
        : openHomeSlots(game, me).map((col) => ({ row: homeRow(me, game.boardSize), col }))[0];
      if (!free) {
        setHint(dom
          ? "⚠ All four shrines are taken — move a card off one, or wait."
          : "⚠ Your Home row is full — move a card forward, or wait for a slot to clear.");
        return;
      }
      const chk = canSummon(game, me, handId, free.col, dom ? free.row : undefined);
      setHint(
        chk.reason === "Not enough Gold"
          ? `⚠ Not enough Gold for ${def.name} (costs ${def.cost}).`
          : `⚠ ${chk.reason ?? `Can't summon ${def.name} right now.`}`,
      );
      return;
    }
    setSel({ kind: "hand", handId });
    setHint(`Summoning <b>${def.name}</b> — tap a glowing ${dom ? "shrine" : "Home slot"}.`);
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
    // A capped BATTLE COMMAND: the caster names who carries the order out.
    //
    // When the cap is at or above the number of kin actually standing, every one
    // of them obeys and there is nothing to choose — fire on the spot rather
    // than walk the player through a decision with exactly one outcome. That
    // also keeps the common early-board case (one or two DAWN cards down) a
    // single tap, the way it has always been.
    if (spellPickKind(spell) === "command") {
      const kin = spellCommandTargets(game, me, spell);
      const max = spell.command?.max ?? kin.length;
      if (kin.length === 0) {
        setHint(`⚠ No ${spell.element} card to command.`);
        return;
      }
      if (kin.length <= max) {
        const ids = kin.map((c) => c.instanceId);
        const chk = canCastSpell(game, me, spellId, { targetIds: ids });
        if (chk.ok) {
          castSpell({ type: "CAST_SPELL", player: me, spellId, targetIds: ids }, `Cast <b>${spell.name}</b>.`);
        } else {
          setHint(`⚠ ${chk.reason}`);
        }
        return;
      }
      setSel({ kind: "spell", spellId });
      setPending(null);
      setPicks([]);
      setSpellPicks({ ids: [], slots: [] });
      setAimedSpellRow(null);
      setHint(`Casting <b>${spell.name}</b> — click ${max} ${spell.element} allies to carry out the order.`);
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
    setAimedSpellRow(null);
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
        : spell.kind === "aoe" && spell.area === "tworows"
          ? `Casting <b>${spell.name}</b> — click a glowing row to <b>aim</b> it; the two rows it sweeps light up, then press <b>Cast</b>.`
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
    setAimedSpellRow(null);
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
    // An aimed corridor takes exactly ONE pick, because the pick is a DIRECTION
    // rather than a victim — the engine fills the rest of the lane in itself.
    if (pending === "special" && game.domination &&
        Number(def.special?.params?.forwardDepth ?? 0) > 0) return 1;
    // An anchored AREA takes exactly one pick too: the pick is the near corner
    // of the footprint, and the engine fills the square in behind it. Without
    // this Airburst's `targets: 99` became a one-click-per-body volley.
    if (pending === "special" && specialAreaShape(def.special)) return 1;
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
        else setHint("This Talent takes no target — press <b>CONFIRM</b> to use it, or <b>CANCEL</b> to back out.");
        return;
      }
      // AN ANCHORED AREA IS AIMED, NOT FIRED, BY THE PICK. Every other pick
      // auto-fires the moment it reaches the cap, which is exactly why the
      // corridor precedent shows nothing before it commits. Here the tap sets
      // the anchor, the footprint lights up, and FIRE is a separate press — so
      // the player sees the 4x4 before it lands. A second tap on a different
      // card RE-AIMS (replaces the pick) rather than appending, because the
      // engine anchors on targets[0] and a two-element list would leave the
      // first, stale pick in charge of where the shell goes.
      if (pending === "special" && aimedArea && clicked && legalTargetIds.includes(clicked.instanceId)) {
        setPicks([clicked.instanceId]);
        setHint(`Aimed — the lit squares are the burst. Press <b>Fire</b>, or tap another target to re-aim.`);
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
      // BATTLE COMMAND: name the allies who obey, then it fires on the last
      // pick — the same way Rewire fires on its second.
      if (spell.command) {
        const max = spell.command.max ?? 0;
        const kin = spellCommandTargets(game, me, spell);
        if (!clicked || !kin.some((c) => c.instanceId === clicked.instanceId)) {
          setHint(`⚠ Pick one of your own ${spell.element} cards.`);
          return;
        }
        if (spellPicks.ids.includes(clicked.instanceId)) {
          setHint("⚠ That one already has the order — pick a different card.");
          return;
        }
        const ids = [...spellPicks.ids, clicked.instanceId];
        if (ids.length < max) {
          setSpellPicks({ ids, slots: [] });
          setHint(`<b>${getDef(clicked.defId).name}</b> has the order — pick ${max - ids.length} more.`);
          return;
        }
        const chk = canCastSpell(game, me, sel.spellId, { targetIds: ids });
        setSpellPicks({ ids: [], slots: [] });
        if (chk.ok) {
          castSpell(
            { type: "CAST_SPELL", player: me, spellId: sel.spellId, targetIds: ids },
            `${spell.name} cast. Keep going, or <b>Pass Priority</b>.`,
          );
        } else {
          setHint(`⚠ ${chk.reason}`);
        }
        return;
      }
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
      // A TWO-ROW SWEEP IS AIMED, NOT CAST, BY THE CLICK — the same rule an
      // anchored area Special follows, and for the same reason. `aoeRowsHit`
      // spills the blast into row+1, the UI lit only the legal CANDIDATE rows,
      // and the click fired: the player saw four glowing rows, clicked one, and
      // a row they had never been shown was frozen. The spill is asymmetric
      // (rules.ts: it always runs toward +1), so it is not something a player
      // can infer from which seat they hold either. Now the click lights both
      // rows and Cast is a separate press.
      if (spell.kind === "aoe" && spell.area === "tworows") {
        const chk = canCastSpell(game, me, sel.spellId, { row });
        if (!chk.ok) {
          if (clicked) setDetailId(clicked.instanceId);
          else setHint(`⚠ ${chk.reason}`);
          return;
        }
        setAimedSpellRow(row);
        const rows = aoeRowsHit(spell, row).map((r) => r + 1).join(" and ");
        setHint(`Aimed at rows <b>${rows}</b> — the lit rows are the sweep. Press <b>Cast</b>, or click another row to re-aim.`);
        return;
      }
      // Walls + single-row AoE spells drop onto any slot of a glowing row. No
      // aim step: the row they land on is the row that was clicked, and it is
      // already lit.
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
      } else if (game.domination && canSummon(game, me, sel.handId, col, row).ok) {
        // A shrine names its own square, so the placement carries the row.
        stageOrPlace(sel.handId, col, row);
      } else if (canSummon(game, me, sel.handId, col).ok
        && row === (summonLandingRow(game, me, col) ?? homeRow(me, game.boardSize))) {
        stageOrPlace(sel.handId, col);
      } else {
        // No reason means the COLUMN is fine and the square is not — the card
        // lands somewhere else in it, and the glow is already showing where.
        setHint(`⚠ ${canSummon(game, me, sel.handId, col).reason ?? "Tap a glowing slot."}`);
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

  /** Send a mulligan that was confirmed before this seat's turn came round.
   *
   *  Runs on every state change, so the trigger is the opponent's own mulligan
   *  arriving. Guarded on still being in the phase and still not done, because a
   *  resend of an already-applied state must not fire a second MULLIGAN —
   *  `applyMulligan` throws on a repeat, which `dispatch` would show as an error
   *  hint for something the player did correctly. */
  useEffect(() => {
    if (!online || mullHeld === null || me === null) return;
    if (game.phase !== "mulligan" || game.players[me].mulliganDone) { setMullHeld(null); return; }
    if (needsInput(game) !== me) return;
    setMullHeld(null);
    setMullToss([]);
    dispatch({ type: "MULLIGAN", player: me, returnHandIds: mullHeld });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, mullHeld, me, online]);

  // ── mulligan ──────────────────────────────────────────────────────────────
  const inMulligan =
    started &&
    game.phase === "mulligan" &&
    me !== null &&
    !game.players[me].mulliganDone &&
    // A held pick is a decision already made: the sheet comes down when the
    // player commits, not when the engine gets round to it. Leaving it up would
    // show four cards they have finished with and invite a second confirm.
    mullHeld === null;

  // ── battle prompt ─────────────────────────────────────────────────────────
  const activeCard = awaitingId ? game.cards[awaitingId] : null;
  const activeDef = activeCard ? getDef(activeCard.defId) : null;
  const specialCheck = awaitingId ? canFireSpecial(game, awaitingId) : { ok: false };
  // What the Special ACTUALLY costs right now — after King Me, Power Grid, and
  // Total Network Control. The engine charges this, so the UI must show it too.
  const specCost =
    activeCard && activeDef?.special ? effectiveSpecialCost(game, activeCard, activeDef.special.cost) : 0;
  const talentCheck = awaitingId ? canFireTalent(game, awaitingId) : { ok: false };
  const plummetCheck = awaitingId ? canPlummet(game, awaitingId) : { ok: false };
  const basicOk = awaitingId ? validTargets(game, awaitingId).length > 0 : false;
  // An area Special with no manual pick to make (hits everything it reaches):
  // it's previewed on the first click and fired on a Confirm.
  const specialValid =
    awaitingId && activeDef?.special
      ? activeDef.special.targetSide === "ally"
        ? validAllyTargets(game, awaitingId)
        : specialTargets(game, awaitingId)
      : [];
  // An AIMED CORRIDOR is not an area Special, however much `targets: 99` makes
  // it look like one. On a Domination board `specialTargets` deliberately offers
  // every victim in all FOUR corridors so the caster can point the blast; if the
  // board then treats that list as a fixed zone and fires the lot, the aiming is
  // not merely unreachable — the Special quadruples in size. One pick names the
  // direction; the engine fills the lane in behind it.
  const aimedCorridor =
    !!game.domination &&
    !!activeDef?.special &&
    Number(activeDef.special.params?.forwardDepth ?? 0) > 0;
  // An ANCHORED AREA is not an area Special either, for the same reason as the
  // corridor: `targets: 99` on Airburst Shell made the board treat it as a
  // fixed zone with only a Confirm, and the engine then anchored the 4x4 on
  // whatever happened to be first in the list. One pick names the corner.
  const aimedArea = !!activeDef?.special && specialAreaShape(activeDef.special) !== null;
  // A SMITE HAS NOTHING TO AIM. `smite` reads neither the pick nor the range:
  // it takes every living opponent carrying the required status and hits them,
  // wherever they stand. `specialTargets` now says so (rules.ts), and the whole
  // set glows — so asking the player to choose one of them would be asking for
  // a decision the Special does not have. It is a fixed zone with a Confirm,
  // exactly like the board-wide volleys already treated as one.
  const smiteZone = activeDef?.special?.handler === "smite";
  const specialAoE =
    !aimedCorridor && !aimedArea &&
    !!activeDef?.special &&
    (smiteZone || Number(activeDef.special.params?.targets ?? 1) >= specialValid.length);
  /** THE FOOTPRINT UNDER THE ARMED SPECIAL — every square it covers, drawn
   *  before it fires.
   *
   *  Two halves, and they arrive at different moments:
   *
   *  · the ANCHORED area (Airburst's N x N, Mega Icicle's 2x2, a splash ring)
   *    needs a pick, because the pick IS the anchor. Empty until then — there
   *    is nothing honest to draw yet.
   *  · the FAR ROW (Aftermath's Explosion, Evera's Spiraling Root Coil) is
   *    fixed by where the CASTER stands, so it is known the instant the Special
   *    is armed and lights up then. It was drawn nowhere at all: the row two
   *    ahead took damage, or next round's ROOT, out of squares that had never
   *    been marked.
   *
   *  Both computed by the functions the engine itself reads, so neither can
   *  disagree with where the blast actually lands. */
  const aimArea: Pos[] = useMemo(() => {
    if (pending !== "special" || !awaitingId) return [];
    const far = previewSpecialFarRow(game, awaitingId);
    if (!aimedArea || picks.length === 0) return far;
    const anchor = game.cards[picks[0]];
    if (!anchor?.pos) return far;
    return [...(previewSpecialArea(game, awaitingId, anchor.pos) ?? []), ...far];
  }, [pending, awaitingId, aimedArea, picks, game]);
  /** The two rows an aimed sweep will land on — the spill row included, which
   *  is the entire point of the aim step. */
  const aimSpellRows: number[] = useMemo(() => {
    if (sel?.kind !== "spell" || aimedSpellRow === null) return [];
    const spell = getSpell(sel.spellId);
    if (spell.kind !== "aoe" || spell.area !== "tworows") return [];
    return aoeRowsHit(spell, aimedSpellRow).filter((r) => r >= 0 && r < game.boardSize);
  }, [sel, aimedSpellRow, game.boardSize]);
  const aimSpellCells: Pos[] = useMemo(() => {
    const out: Pos[] = [];
    for (const r of aimSpellRows)
      for (let c = 0; c < game.boardSize; c++) out.push({ row: r, col: c } as Pos);
    return out;
  }, [aimSpellRows, game.boardSize]);

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
      setHint("⚠ Special targets are still armed — press <b>CANCEL</b> first to switch to a basic attack.");
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
      setHint("⚠ Basic-attack targets are still armed — press <b>CANCEL</b> first to switch to the Special.");
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
      } else if (aimedArea) {
        setHint("⚠ Aim it first — tap a glowing target to place the burst.");
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
        : aimedArea
          ? `<b>${spec.name}</b>${spec.talent ? " (Talent · once per game)" : ` (cost ${specCost})`} — tap a glowing target to <b>aim</b>; the squares it will cover light up, then press <b>Fire</b>.`
        : aimedCorridor
          ? `<b>${spec.name}</b>${spec.talent ? " (Talent · once per game)" : ` (cost ${specCost})`} — pick a glowing target to <b>aim</b> it; the blast fires down that lane.`
          : `<b>${spec.name}</b>${spec.talent ? " (Talent · once per game)" : ` (cost ${specCost})`} — pick up to ${cap} glowing target${cap > 1 ? "s (repeat to stack), or Fire early" : ""}.`,
    );
  }

  function actPlummet() {
    if (!activeCard || !activeDef?.plummet) return;
    // Two presses, like the Talent and the Special beside it. A dive KILLS
    // outright and moves the card, so a misfire is a body and a position — not
    // something to hand to a single tap.
    if (pending === "plummet") {
      dispatch({
        type: "BATTLE_ACTION", player: activeCard.owner, action: "plummet",
        targetId: picks[0],
      });
      setPending(null);
      setPicks([]);
      return;
    }
    setPending("plummet");
    setPicks([]);
    const prey = plummetTargets(game, activeCard.instanceId);
    setHint(
      `<b>Plummet</b> — drop on a glowing opponent and destroy it outright, taking its square. ` +
      `Costs ${activeDef.plummet.selfDmg} HP, which shields do not absorb. ` +
      (prey.length === 1
        ? "One target in reach; press <b>Confirm</b>."
        : `Pick one of ${prey.length}, then <b>Confirm</b>.`),
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
      setHint("⚠ Targets are still armed — press <b>CANCEL</b> first to switch to the Talent.");
      return;
    }
    setPending("talent");
    setPicks([]);
    setHint(
      // SAY WHAT IT DOES. This read "(Talent · free, once per game) — press
      // Confirm to use it. There is no second one." on the one screen where the
      // player has to decide whether to spend a thing they get once, and the
      // Talent's own text only ever reached a `title=` tooltip — invisible on
      // touch, which is where this prompt lives (`.bp-hint`).
      `<b>${activeDef.talent.name}</b> (Talent) — ` +
      `${talentEffect(activeDef.talent.text)} ` +
      `Free, but press <b>Confirm</b> to spend it: there is no second one.`,
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
    // ...through the same authority as the other three. Asked by COLUMN, this
    // was a fourth private copy of the question and it got Domination wrong in
    // the other direction from the hand strip: `canSummon` refuses every
    // column-addressed request on that map ("Summon at a shrine"), so the
    // summon leg could never return true and the 7x7 nudged the player toward
    // Pass while a full hand of affordable cards had four open shrines.
    for (const h of game.players[me].hand)
      if (summonSquare(game, me, h.handId)) return true;
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
    if (!iActBattle || !awaitingId) { setWheelAt(null); return; }
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
  }, [iActBattle, awaitingId, game]);

  /** The same four verbs the action row renders, shortened for a 52px chip.
   *  Seats are top / right / bottom / left in this order — Skip sits at the top
   *  because it is the one you reach for when nothing else is possible, and it
   *  must never be the hardest to find again. */
  /** The ring is actually on screen. The action row keys its own hiding on
   *  this, so if the ring fails to mount for any reason the buttons stay.
   *
   *  NOT gated on `portrait` any more. The wheel was built for the phone and is
   *  simply the better control everywhere: the verbs sit around the card they
   *  act with, instead of in a row at the bottom of the screen that you have to
   *  look away from the board to read. One interaction to learn, on every size.
   *  `.wrap.wheel-up` still hides the button row, so the two never both show. */
  const wheelUp = iActBattle && wheelAt !== null;

  const wheelVerbs: WheelVerb[] = activeCard && activeDef
    ? [
        { key: "skip", short: "SKIP", tone: "#8b8fa3", onClick: actSkip,
          title: "Skip this card's turn" },
        { key: "basic", short: pending === "basic" ? (picks.length > 0 ? `FIRE ${picks.length}` : "AUTO") : "ATTACK",
          tone: "#e5533d", disabled: !basicOk, armed: pending === "basic", onClick: actBasic,
          title: basicOk ? "Basic attack" : "Nothing in reach" },
        // PLUMMET takes the SPECIAL seat, and only on a card that has no Special
        // to be displaced — the ring holds four and the Talent is not the one to
        // give up. On a diving Rare that seat was a permanently disabled
        // "SPECIAL" doing nothing anyway.
        activeDef.plummet && !activeDef.special
          ? { key: "plummet", short: pending === "plummet" ? "CONFIRM" : "DIVE", tone: "#4fb0c6",
              disabled: !plummetCheck.ok, armed: pending === "plummet", onClick: actPlummet,
              title: plummetCheck.ok
                ? `Plummet: destroy an opponent under ${activeDef.dmg} HP and take its square (costs ${activeDef.plummet.selfDmg} HP)`
                : plummetCheck.reason ?? "Cannot dive" }
          : { key: "special", short: pending === "special" ? (specialAoE ? "CONFIRM" : picks.length > 0 ? (aimedArea ? "FIRE" : `FIRE ${picks.length}`) : aimedArea ? "AIM" : "SPECIAL") : "SPECIAL",
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
  /** THE WAY OUT OF AN ARMED ACTION, on the ring itself.
   *
   *  Cancelling existed — the bar's ✕ — but not where the phone could reach it:
   *  `.bottom.acting .controls > *:not(.panel-crystals)` hides the whole control
   *  strip on the portrait tier while a card is acting, which is the exact
   *  moment something is armed. Three hints told the player to press a button
   *  that was not on their screen. On the ring it sits where the action was
   *  chosen, which is where changing your mind about it happens.
   *
   *  It clears the armed verb and every target picked for it, and says so —
   *  silence after a tap that removes chips reads as a misfire. */
  const cancelVerb: WheelVerb = {
    key: "cancel",
    short: "CANCEL",
    tone: "#8b8fa3",
    onClick: () => {
      clearAction();
      setHint("Cancelled — the card is still up. Pick an action.");
    },
    title: "Cancel this action and drop any targets picked for it",
  };

  // Online only: the opponent is mid-decision — either they hold prep priority,
  // or their card is the one awaiting a battle action. Drives the waiting panel.
  const oppId = online ? enemyOf(online.myId) : null;
  const oppDeciding =
    !!online &&
    ((game.phase === "prep" && game.prep?.priority === oppId) ||
      (activeCard !== null && activeCard.owner === oppId));

  // ── the first-run walkthrough ─────────────────────────────────────────────
  // The step is DERIVED from the save (see `Onboarding.tsx`), so there is no
  // cursor here to fall out of sync — doing a step's deed by any route simply
  // makes the next one due on the following render.
  const guideStep = onboardingStep(story);
  /** Is the step's anchor on the surface that is currently up? A spotlight is
   *  only honest when the thing it rings is visible, and the guide's CTA is what
   *  changes tabs — so until it is pressed the card shows centred with no ring
   *  rather than pointing confidently at nothing. */
  const guideOnTab = guideStep
    ? guideStep.tab === (storyOpen ? "story" : tab) && !homeCollection
    : false;

  /** Acknowledge a tour step, into the same `taught` list the coach uses. */
  const teach = (id: string) => {
    const next = { ...story, taught: [...new Set([...(story.taught ?? []), id])] };
    setStory(next); saveStory(next);
  };
  const skipGuide = () => teach(ONBOARDING_SKIP);

  /** The step's button. It GOES there rather than merely pointing: the whole
   *  complaint about the old guide was that it named a control on another
   *  screen and left the player to find it. */
  const runGuideStep = () => {
    if (!guideStep) return;
    switch (guideStep.id) {
      case "pack":
        setShopTab("packs"); setHomeCollection(false); navDo({ t: "close" }); setTab("shop");
        break;
      case "squad":
        // Straight into the builder. The anchor is the Home tile, but the tile
        // is a door and standing in front of it is not the step.
        navDo({ t: "builder", open: true });
        break;
      case "fight":
        // Focus the node, then open the map on it — landing on the region and
        // leaving the player to find L1 is the exact hand-off this closes.
        navDo({ t: "goToNode", nodeId: FIRST_NODE, regionId: regionOfNode(FIRST_NODE)?.id });
        navDo({ t: "open" });
        break;
      default:
        // Tour steps: show me the tab this is about, then mark it taught. Both,
        // in that order, so the last thing the player sees is the place rather
        // than the card that described it.
        setHomeCollection(false);
        navDo({ t: guideStep.tab === "story" ? "open" : "close" });
        setTab(guideStep.tab as Tab);
        teach(guideStep.id);
        break;
    }
  };

  return (
    // `pre-match`: the battle chrome renders unconditionally — it always has —
    // so before a match there was an empty board, an empty log and an idle
    // phase ribbon sitting behind the menus. Harmless when the only menu was a
    // deck picker you passed through in seconds; wrong now that Home, Shop and
    // Story are places you STAY, and leaving Story dropped you onto a deserted
    // battlefield. Hidden by class rather than unmounted so nothing that
    // measures the board on mount has to learn a new lifecycle.
    <MatchLayout
      logCollapsed={logCollapsed}
      preMatch={!started}
      wheelUp={wheelUp}
      mobilePanel={mobilePanel}
      setMobilePanel={setMobilePanel}
      logIsStrip={logIsStrip}
      onToggleLogRail={() => setLogCollapsed((v) => !v)}
      musicMuted={musicMuted}
      onToggleMusic={toggleMusic}
      ribbon={<PhaseRibbon game={game} />}
      logEntries={
        condenseLog(game.log.slice(-60)).map((e, i) => (
          <div
            key={i}
            className={[e.text.includes("(P1)") ? "me" : "", e.chatter ? "log-chatter" : "log-event"].filter(Boolean).join(" ")}
          >
            {e.text}
            {e.count > 1 && <span className="log-x">×{e.count}</span>}
          </div>
        ))
      }
      board={
        <>
          <Board
            game={game}
            foils={boardFoils}
            legalSlots={legalSlots}
            legalTargetIds={legalTargetIds}
            targetsAreEnemies={targetsAreEnemies}
            previewArea={previewArea}
            aimArea={[...aimArea, ...aimSpellCells]}
            blast={blast}
            telegraphs={telegraphs}
            stagedSlot={stagedSlot}
            // An aim anchor is a crosshair, not a hit count: "x1 · 1 hit(s)
            // assigned" on the corner of a burst about to hit four bodies is
            // the wrong noun and the wrong number, so the badge stays off.
            pickCounts={aimedArea ? {} : picks.reduce<Record<string, number>>((acc, id) => {
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

          {/* THE SECOND PRESS for a two-row sweep. Same shape and same place as
              the staged-summon confirm above it: the footprint is on the board,
              and the commit is a deliberate, separate tap. */}
          {myPrep && sel?.kind === "spell" && aimedSpellRow !== null && aimSpellRows.length > 0 && me !== null && (() => {
            const spell = getSpell(sel.spellId);
            const rows = aimSpellRows.map((r) => r + 1).join(" and ");
            return (
              <div className="summon-confirm spell-aim">
                <span className="sc-text">
                  <b>{spell.name}</b> sweeps rows {rows} · <span className="sc-gold">gold = the whole area</span>
                </span>
                <button
                  className="lockin sc-yes"
                  onClick={() => {
                    const chk = canCastSpell(game, me, sel.spellId, { row: aimedSpellRow });
                    if (!chk.ok) { setHint(`⚠ ${chk.reason}`); return; }
                    setAimedSpellRow(null);
                    castSpell(
                      { type: "CAST_SPELL", player: me, spellId: sel.spellId, row: aimedSpellRow },
                      `${spell.name} cast. Keep going, or <b>Pass Priority</b>.`,
                    );
                  }}
                >
                  Cast
                </button>
                <button className="ghost sc-no" onClick={clearAction}>Cancel</button>
              </div>
            );
          })()}

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
        </>
      }
      rightCol={
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
      }
      spellSheet={
        game.phase === "prep" ? (
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
        )
      }
      bottom={
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
                      return specialAoE ? "✦ Confirm"
                        : picks.length > 0 ? (aimedArea ? "🔥 Fire the burst" : `🔥 Fire (${picks.length}/${maxPicks})`)
                        : aimedArea ? "🎯 Aim…" : rest;
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
              {/* THE HINT, WHERE A PHONE CAN ACTUALLY READ IT.
                  `.hint` is not merely hidden mid-action — it is `display: none`
                  on the portrait and short-landscape tiers in EVERY phase (see
                  the two rules it is paired with in styles.css). That is a
                  deliberate trade: the row costs ~28px and a phone would rather
                  have the board. It is the right call for idle chatter and the
                  wrong one for the sentence that tells you how to get out of an
                  action you have armed — "press CANCEL first to switch to the
                  Special" is unreadable on the only device where CANCEL is
                  hard to find.
                  So the hint is echoed HERE, into the prompt the phone does
                  show, and only when it is load-bearing: something is armed, or
                  the line is a warning. Desktop never sees this copy — `.bp-hint`
                  is hidden exactly where `.hint` is shown, so the pair can never
                  both be on screen. */}
              {(pending !== null || hint.startsWith("⚠")) && (
                <div className="bp-text bp-hint" dangerouslySetInnerHTML={{ __html: hint }} />
              )}
            </div>
          ) : null}
          </div>

          <div className="controls">
            {/* THE COACH IS NOT IN HERE ANY MORE — it is mounted at the top
                level with the other floating surfaces. It is `position: fixed`,
                so it never drew inside this column anyway, but it was still a
                CHILD of it, and on a phone this bar switches its own children
                off wholesale while one of your cards is up
                (`.bottom.acting .controls > *:not(.panel-crystals)`). Being out
                of FLOW is not being out of the DOM: the lesson vanished on
                every single action and came back between them, which during the
                Battle phase — the one phase its last lesson is about — is a
                flicker rather than a sentence. See the mount site below. */}
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
            {/* A STAGED SUMMON BLOCKS THE PASS. Picking a card and a column only
                previews the placement — it is not on the board until Confirm —
                so passing here silently threw the summon away, and did it at the
                one moment the player was most sure they had just played a card.
                Two consecutive passes start the Battle, so the mistake could
                also end the whole prep phase a card down.

                The button says which of the two things to do rather than going
                quietly dead, because a disabled control with no reason on it is
                the same trap one step later. A half-built SPELL is deliberately
                NOT blocked — passing is how you stop placing, and the hint for
                it says so. */}
            <button
              className={`lockin pass-btn ${myPrep && !staged && sel === null && !hasAnyPlay ? "nudge" : ""}`}
              disabled={!myPrep || staged !== null}
              title={staged ? "Confirm or cancel your placement before passing" : undefined}
              onClick={() => me && !staged && dispatch({ type: "PASS", player: me })}
            >
              {!myPrep ? (
                "Waiting…"
              ) : staged ? (
                // Same width as "Pass Priority" on purpose: the phone rule is
                // `white-space: nowrap; overflow: hidden`, so a longer label
                // clips. The full sentence is in the title and in the hint,
                // which already reads "Confirm placement — …".
                "Confirm first"
              ) : (
                <>
                  Pass Priority
                  <span className="pass-dots" title="Two consecutive passes → Battle">
                    <span className={`pd ${(game.prep?.consecutivePasses ?? 0) >= 1 ? "on" : ""}`} />
                    <span className={`pd ${(game.prep?.consecutivePasses ?? 0) >= 2 ? "on" : ""}`} />
                  </span>
                </>
              )}
            </button>
            {/* CANCEL, in the bar and not behind a menu.
                This action existed the whole time — as "Clear", inside the ⋯
                overflow, next to Auto and Surrender, on the reasoning that it
                is "something you do once or twice a match". Targeting proved
                that wrong: arm an attack, change your mind, and the way out was
                two taps into a menu you had no reason to think held it. Nothing
                on screen said so, and the hints that named it were telling you
                to press a button you could not see.
                
                Only rendered when there IS something to cancel, so the bar is
                unchanged the rest of the time. */}
            {(sel !== null || pending !== null || picks.length > 0 || surrenderArmed) && (
              <button
                className="ctl-cancel"
                aria-label="Cancel"
                title="Cancel — drop the selection and any armed targets"
                onClick={clearAction}
              >
                ✕
              </button>
            )}
            {/* Everything that is not the committing action, behind one button.
                Auto / Clear / Surrender are things you do once or twice a match,
                and as a second full-width row they cost 34px of every screen for
                the whole game — on a phone that is board. */}
            <button
              className={`ctl-more ${barMenu ? "on" : ""}`}
              aria-label="More actions"
              aria-expanded={barMenu}
              onClick={() => setBarMenu((v) => !v)}
            >
              ⋯
            </button>
            {barMenu && <button className="ctl-scrim" aria-label="Close" onClick={() => setBarMenu(false)} />}
            <div className={`ctl-sub ${barMenu ? "open" : ""}`}>
              {/* Whether the turn's one move is spent is a readout, not an action,
                  but it belongs with the actions it constrains. */}
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
                  setBarMenu(false);
                }}
              >
                <option value="" disabled>
                  Auto…
                </option>
                <option value="manual">All Manual</option>
                <option value="basic">All Auto-Basic</option>
                <option value="full">All Full-Auto</option>
              </select>
              <button className="ghost sm" onClick={() => { clearAction(); setBarMenu(false); }}>
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
                      setBarMenu(false);
                    } else {
                      setSurrenderArmed(true);
                      setHint("⚠ Surrender? Click again to confirm, or ✕ to cancel.");
                    }
                  }}
                >
                  {surrenderArmed ? "Confirm?" : twoPlayer ? `${me} surrender` : "Surrender"}
                </button>
              )}
              {/* HOW TO PLAY, in the match. It had exactly one entry point in the
                  whole app — the Arena lobby — which is the one place you are
                  NOT when the question comes up. Every rule it explains (the
                  capture win, the SP queue, King of the Hill, what a status
                  does) is asked mid-fight, and the onboarding card on Home
                  promises "you can still read How to play any time" while
                  offering no route to it. The sheet is already mounted at the
                  top level and its `.overlay` sits at z 300, well clear of the
                  in-match chrome's 62, so it opens over the board cleanly. */}
              <button
                className="ghost sm"
                title="The rules — win conditions, phases, keywords and statuses"
                onClick={() => { setBarMenu(false); setRulesOpen(true); }}
              >
                How to play
              </button>
            </div>
          </div>
        </div>
      }
    >

      {/* The hand floats over the bottom edge of the board — popped up when it's
          your turn to act, tucked low otherwise — so the bar stays thin.

          Rendered for the WHOLE match, not only while no card is acting. On a
          phone this element is `position: static` — it is a row in the flow
          column — so mounting and unmounting it between every activation moved
          everything above it, which is the board going up and down all through
          the battle phase. Whether it is SEEN during battle is now a CSS
          question (`.bottom.acting ~ .hand-float`), which is where it belongs:
          desktop hides it, portrait keeps the row and dims it. */}
      {started && game.phase !== "mulligan" && (
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
            // Same set the board gets. A foil that shines on the field and not
            // in the hand is the same card looking like two.
            foils={foilIds}
            onPick={onPickHand}
            onDragStartCard={onDragStartCard}
            onDragEndCard={onDragEndCard}
          />
        </div>
      )}

      {/* The coach answers a different question from the hint row: the hint says
          what to DO, this says why. First fight only, and each idea once ever —
          see TutorialCoach.

          MOUNTED HERE, with the overlays, and not in `.controls` where it used
          to live. It floats (`position: fixed`) and it measures its own
          clearance, so its DOM parent should be something that never hides,
          never reflows and never moves it. `.controls` is none of those on a
          phone. */}
      {started && !online && !twoPlayer && !(story.taught ?? []).includes("SKIP") && (
        <TutorialCoach
          game={game}
          me={me}
          taught={story.taught ?? []}
          onTaught={(id) => {
            const next = { ...story, taught: [...new Set([...(story.taught ?? []), id])] };
            setStory(next); saveStory(next);
          }}
          onSkipAll={() => {
            const next = { ...story, taught: [...new Set([...(story.taught ?? []), "SKIP"])] };
            setStory(next); saveStory(next);
          }}
        />
      )}

      {inMulligan && me && (
        <div className="overlay">
          <div className="modal">
            <h1>{twoPlayer ? `${me} — Opening Hand` : "Opening Hand"}</h1>
            {/* THE MULLIGAN LESSON LIVES HERE, not in a coach card floating over
                this modal. The tutorial used to print "Your opening hand" on top
                of this sheet, which made a new player's first two seconds of the
                game two panels saying the same thing. A modal that owns the
                screen should own the lesson too — so the WHY moved in here and
                the coach step went away (see TutorialCoach.tsx). */}
            <p>
              {twoPlayer ? `Player ${me}: hand the device over. ` : ""}
              Click any cards to send back — you'll reshuffle and redraw to 4. Send back
              anything you cannot afford yet: Gold arrives slowly, so a hand of expensive
              cards is a hand of cards you watch instead of play.
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
                    {/* Same merge as the hand and the thumbs: the sigil is the
                        badge and the cost rides on it. */}
                    <div className="hc-top">
                      <div className="mull-cost" title={`${def.element} · cost ${def.cost}`}
                        style={{ borderColor: EL_COLOR[def.element], backgroundImage: `url(${EL_ICON[def.element]})` }}>
                        <b>{def.cost}</b>
                      </div>
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
                // Hot-seat and solo are already serial — one device, one actor —
                // so only the online race needs the turnstile.
                if (online && needsInput(game) !== me) {
                  setMullHeld(mullToss);
                  setHint("Locked in — waiting for your opponent's hand.");
                  return;
                }
                dispatch({ type: "MULLIGAN", player: me, returnHandIds: mullToss });
                setMullToss([]);
              }}
            >
              {mullToss.length > 0 ? `Return ${mullToss.length} & Redraw` : "Keep Hand"}
            </button>
          </div>
        </div>
      )}

      {/* Over the mulligan, not instead of it — the deal has already happened
          and the host may already be advancing, so this is a curtain rather
          than a gate. Rendered out here with the other overlays so it paints
          above the board and the mulligan sheet both. */}
      {started && online && pvpIntro && (
        <VersusIntro game={game} me={online.myId} names={seatNames} onDone={() => setPvpIntro(false)} />
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
                    choose its boost. It keeps it for good.
                  </>
                )}
              </p>
              <div className="flow-opts">
                {(["water", "ice", "steam"] as const).map((mode) => {
                  // Liquid reads "+1 hit" on a multi-hit card for BOTH paths now.
                  // The summon pick is permanent again, and the permanent path
                  // grants the extra hit rather than +2 per hit — so restricting
                  // this to Downpour would print the wrong number on the one
                  // choice the player actually makes.
                  const multiHit = liquidGivesHit(flowCard);
                  const blurb =
                    mode === "water" && multiHit ? "+1 hit" : FLOW_MODES[mode].blurb;
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
      {wheelUp && (
        <ActionWheel verbs={wheelVerbs} at={wheelAt} armedKey={pending} cancel={cancelVerb} />
      )}

      {castFlash && <SpellCastFlash spellId={castFlash.spellId} />}
      {announce && <SummonAnnounce defId={announce.defId} mine={announce.mine} />}

      {/* BATTLE CHAT — online only, and only once there is a match to talk
          about. There is nobody to talk to in a solo game, and an empty chat
          button on every screen is clutter that has to be explained. */}
      {online && started && (
        <ChatPanel
          messages={chat}
          mySeat={online.myId}
          seatNames={seatNames ?? undefined}
          onSend={sendChat}
          open={chatOpen}
          onOpenChange={(v) => { setChatOpen(v); if (v) setChatUnread(0); }}
          unread={chatUnread}
        />
      )}

      {/* Only during a match — New Match sets started=false, which hides this and
          reveals the deck picker (game.win stays set until Start Match resets it). */}
      {started && !storyNode && (
        <WinScreen
          game={game}
          // Viewer-relative: online the guest sits in P2 and was being shown
          // VICTORY for a match it had just lost.
          me={online?.myId ?? "P1"}
          // Online, the GUEST has no setup of its own — the host deals, and the
          // guest only has to ask. Gating this on `setupRef` left the guest
          // with nothing but Leave, so a rematch could only ever be started by
          // one of the two players.
          onRematch={online || setupRef.current ? askRematch : undefined}
          rematch={{ mine: rematchMine, theirs: rematchTheirs, online: !!online }}
          next={nextUp ?? undefined}
          // Online is the only mode that pays on the result screen's own terms
          // — every other one banks quietly into the shop's counter.
          earned={
            online && game.win
              ? onlineMatchShards({
                  won: game.win.winner === online.myId,
                  surrendered: game.win.by === "surrender" && game.win.winner !== online.myId,
                })
              : undefined
          }
          onNewGame={() => {
            if (online) leaveOnline(); // tear down the room before returning
            setStarted(false); // back to the deck picker
            setSel(null);
            setPending(null);
            setMullToss([]);
            // A boss just changed sides — go and look at it. Leaving a taming
            // to be discovered later in a menu would waste the one moment the
            // whole loop is built around; the Arena's deck picker is not where
            // you find out you now own a dragon.
            if (towerOpenOn) setTab("tower");
          }}
        />
      )}

      {storyResult && (
        <StoryResult
          node={storyResult.node}
          game={game}
          lost={storyResult.lost}
          won={storyResult.won}
          shiny={storyResult.shiny}
          captured={storyResult.captured}
          firstClear={!story.cleared.includes(storyResult.node.id)}
          exhausted={recruitablePool(storyResult.node).every((id) => story.collection.includes(id))}
          foils={foilIds}
          onDone={() => {
            setStarted(false);
            navDo({ t: "closeResult" });
          }}
        />
      )}

      {storyOpen && !started && nav.view === "collection" && (
        <StoryCollection
          save={story}
          onSave={(next) => { setStory(next); saveStory(next); }}
          onClose={() => navDo({ t: "view", view: "map" })}
          element={region.element}
          onOpenBuilder={() => navDo({ t: "builder", open: true })}
          onGoToNode={(id) =>
            // A card's source can live in a region the map isn't showing; the
            // reducer owns what a jump involves.
            navDo({ t: "goToNode", nodeId: id, regionId: regionOfNode(id)?.id })
          }
        />
      )}

      {storyOpen && !started && nav.view === "regions" && (
        <StoryRegions
          save={story}
          currentId={nav.regionId}
          onPick={(id) => navDo({ t: "pickRegion", regionId: id })}
          onClose={() => navDo({ t: "view", view: "map" })}
        />
      )}

      {storyOpen && !started && nav.view === "map" && (
        <StoryMap
          region={region}
          save={story}
          onSave={(next) => { setStory(next); saveStory(next); }}
          onOpenRegions={() => navDo({ t: "view", view: "regions" })}
          onOpenCollection={() => navDo({ t: "view", view: "collection" })}
          focusNodeId={nav.focusNodeId}
          onFocusHandled={() => navDo({ t: "focusHandled" })}
          onFight={(node) => navDo({ t: "prep", node })}
        />
      )}

      {storyOpen && !started && nav.view !== "collection" && prepNode && (
        <StoryPrep
          region={regionOfNode(prepNode.id) ?? region}
          node={prepNode}
          save={story}
          onSave={(next) => { setStory(next); saveStory(next); }}
          squads={customDecks}
          onSquads={setCustomDecks}
          onEditDeck={() => navDo({ t: "builder", open: true })}
          onCancel={() => navDo({ t: "prep", node: null })}
          onFight={(deck, book) => {
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
            // The team's own book if it saved one, else the hero's shelf —
            // `bookForLoadout` owns that fallback and the board-cap trim.
            const heroBook = book.length ? book.slice(0, spellCapForBoard(board)) : heroBookFor(story, board);
            const foeBook = spellbookFor(squad).map((sl) => sl.defId);
            // A Throne opens on its cheapest cards so the region's climax can
            // actually act while gold is tight — see `THRONE_OPENING_STACK`.
            // Only the ENEMY seat; the player's own draw is never touched.
            const fresh = createInitialState(newSeed(), deck, squad, ["P1"], heroBook, foeBook, board,
              deploy, terrain,
              node.kind === "throne" ? { P2: THRONE_OPENING_STACK } : undefined);
            // A 7x7 is only DOMINATION if the mode is stamped on. Without this
            // line a border gate is an oversized duel on a map whose middle is
            // impassable and whose home rows are not the win condition -- the
            // same trap the balance harness hit.
            if (board === DOMINATION_7X7.boardSize) fresh.domination = newDomination(DOMINATION_7X7);
            setGame(fresh);
            navDo({ t: "fight", node });
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
        <div className="overlay arena-wrap">
          <div className="arena">
            {/* The title art carries the screen instead of a logo floating over
                a form. The ribbon names the mode so the art can be art. */}
            <div className="ar-hero">
              <picture>
                <source srcSet="/title.webp" type="image/webp" />
                <img src="/title.jpg" alt="War Element" />
              </picture>
              <span className="ar-fade" aria-hidden="true" />
              <span className="ar-ribbon">
                <i aria-hidden="true" />
                {onlineMode ? "ARENA · ONLINE" : "ARENA"}
              </span>
            </div>

            <div className="ar-modes">
              <div className="seg">
                <button
                  className={!twoPlayer && !onlineMode ? "on" : ""}
                  onClick={() => setArenaMode("ai")}
                >vs AI</button>
                <button
                  className={twoPlayer && !onlineMode ? "on" : ""}
                  onClick={() => setArenaMode("local")}
                >2 Players</button>
                <button
                  className={onlineMode ? "on blue" : ""}
                  onClick={() => setArenaMode("online")}
                >Online</button>
              </div>
              {/* One sentence, not a paragraph. */}
              <p className="ar-mode-note">
                {onlineMode
                  ? onlineRole === "host"
                    ? "You host and play P1. Share the code to fill the other seat."
                    : "Enter your buddy's code, then pick your deck. You play P2."
                  : twoPlayer
                    ? "Two players share this device — hand it back each turn."
                    : "You play P1. The AI draws its own hand from its deck."}
              </p>
            </div>

            {/* Hidden for an online GUEST: the host deals the whole state,
                board size included, so the guest has no say. */}
            {(!onlineMode || onlineRole === "host") && (
              <div className="ar-field">
                <span className="ar-flabel">BATTLEFIELD</span>
                <div className="seg">
                  {/* LOCKED while a run is live. A run is dealt for a board — it
                      stores which one, and it pays that board's rate — so
                      switching underneath it would leave four 4x4 opponents
                      waiting on a 5x5 field, and your squad the wrong size for
                      both. The run owns this until it ends. */}
                  {([4, 5, 7] as const).map((sz) => (
                    <button
                      key={sz}
                      className={boardSize === sz ? "on" : ""}
                      disabled={boardLocked && boardSize !== sz}
                      title={boardLocked && boardSize !== sz
                        ? "The gauntlet run was dealt for this battlefield"
                        : undefined}
                      onClick={() => setBoardSize(sz)}
                    >
                      {sz}×{sz} · {sz === 4 ? "Standard" : sz === 5 ? "Large" : "Domination"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PLAYERS. Domination only, and that is a rule rather than a
                restriction of the picker: the other battlefields seat two
                because they are won by taking the opponent's Home row, and a
                square board has exactly two of those to hand out. This map is
                won by holding Points, has four of them and four shrines in
                rotational symmetry, and so has somewhere for everyone to come
                in from. */}
            {boardSize === DOMINATION_7X7.boardSize
              && arenaGame !== "gauntlet" && arenaGame !== "streak"
              && (!onlineMode || onlineRole === "host") && (
              <div className="ar-field">
                <span className="ar-flabel">{onlineMode || twoPlayer ? "PLAYERS" : "OPPONENTS"}</span>
                <div className="seg">
                  {([2, 3, 4] as const).map((n) => (
                    <button
                      key={n}
                      className={seatCount === n ? "on" : ""}
                      disabled={twoPlayer && n > 2}
                      title={twoPlayer && n > 2
                        ? "Hot-seat shares one device — a free-for-all is vs AI or online"
                        : undefined}
                      onClick={() => setSeatCount(n)}
                    >
                      {/* vs AI you are choosing how many OPPONENTS to face, and
                          saying "4 players" for three of them is a counting
                          puzzle in the middle of a lobby. Online and hot-seat
                          really are seat counts, so those keep "players". */}
                      {onlineMode || twoPlayer
                        ? `${n} players`
                        : `${n - 1} opponent${n - 1 === 1 ? "" : "s"}`}
                    </button>
                  ))}
                </div>
                {seatCount > 2 && (
                  <p className="ar-mode-note">
                    Free-for-all — every seat for itself, and everyone deploys at the
                    four shrines.{onlineMode ? "" : ` You against ${seatCount - 1} AI.`}
                  </p>
                )}
              </div>
            )}

            {/* THE MODE. Gauntlet and Streak used to be things you could stumble
                into from the same lobby as a casual fight, which is how a run
                got ended by a match that was never part of it. They are modes
                now: exactly one is live, each owns the seat while it is, and
                switching away LEAVES a run standing rather than scoring it. */}
            {!onlineMode && !twoPlayer && (
              <div className="ar-field">
                <span className="ar-flabel">MODE</span>
                <div className="seg">
                  {([
                    ["casual", "Casual", "Pick your own fight. Nothing is scored."],
                    ["streak", "Streak", "Climb the rungs. Wins pay more the longer you hold it."],
                    ["gauntlet", "Gauntlet", "Four dealt opponents. One loss ends the run."],
                    ["draft", "Draft", "Build a squad from cards you do not own, three at a time. Three losses end the run."],
                  ] as const).map(([id, label, why]) => (
                    <button
                      key={id}
                      className={arenaGame === id ? "on" : ""}
                      title={why}
                      onClick={() => {
                        setArenaGame(id);
                        // Entering STREAK seats a rung-appropriate opponent at
                        // once, so "Start Streak Match · Even" is not sitting
                        // over whatever deck the last casual fight left behind.
                        if (id === "streak") {
                          const tier = tierForStreak(story.ladder?.streak ?? 0, boardSize);
                          if (tierOf(p2DeckId) !== tier) {
                            const pick = rollOpponent(tier, boardSize, p2DeckId);
                            if (pick) setP2DeckId(pick.id);
                          }
                        }
                      }}
                    >
                      {label}
                      {id === "gauntlet" && gauntletRun && !runOver(gauntletRun) && (
                        <i className="mode-live" title="A run is waiting" aria-hidden="true">•</i>
                      )}
                      {id === "draft" && draftRun && (
                        <i
                          className="mode-live"
                          title={draftComplete(draftRun) ? "A drafted squad is waiting" : "A draft is half-picked"}
                          aria-hidden="true"
                        >•</i>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* THE OPPONENT. One block, because there were two: a rung segment
                whose own comment called it "the matchmaker", and the streak
                matchmaker underneath it doing the same job one step further.
                Two controls that both fill the same seat, stacked, each
                claiming the same name.

                So they are one control with a hierarchy now — the automatic
                answer first, the manual override under it. The rungs still
                roll a random deck at a difficulty you name; the button above
                names the difficulty for you and climbs.

                Hidden while a Gauntlet run is live, because that run owns the
                seat and reseating it would end the run on a match you never
                agreed to fight. Hidden in 2-player too, where the other seat is
                a person choosing their own deck rather than a difficulty — the
                old rung segment showed there and never made sense. */}
            {!onlineMode && !twoPlayer && arenaGame === "streak" && (() => {
              const streak = story.ladder?.streak ?? 0;
              const tier = tierForStreak(streak, boardSize);
              const owed = winsToNextRung(streak, boardSize);
              const onRung = tierOf(p2DeckId) === tier;
              // "a Easy match". Three of the four rung names open on a vowel
              // (Easy, Even, Elite) and only Hard does not, so the article has
              // to be derived rather than written.
              const a = /^[AEIOU]/i.test(TIER_LABEL[tier]) ? "an" : "a";
              // What the NEXT win is worth, stated before you agree to the
              // fight. The ladder pays by rung and streak, so "wins pay 12" is
              // the whole reason to be up here rather than farming Easy — and
              // it is invisible unless the lobby says it.
              const winPay = SHARDS_PER_WIN.arena
                + recordLadderMatch({ streak, best: streak },
                    { won: true, tier, boardSize }).bonus;
              return (
                <div className="ar-gauntlet mm">
                  <button
                    className="gt-start"
                    onClick={() => {
                      const pick = rollOpponent(tier, boardSize, p2DeckId);
                      if (pick) setP2DeckId(pick.id);
                    }}
                  >
                    <span className="gt-start-main">
                      {/* Names the rung, because the whole point is that the
                          matchmaker chose it and the player should be able to
                          see what it chose before agreeing to the fight. */}
                      {onRung ? "Reroll" : "Find"} {a} {TIER_LABEL[tier]} match
                      <em className="gt-pay mm-streak">{streak}<i aria-hidden="true">&#9650;</i></em>
                    </span>
                    <span className="gt-sub">
                      {streak === 0
                        ? `A random ${TIER_LABEL[tier]} deck · wins pay ${winPay}. Win ${WINS_PER_RUNG} in a row to move up a rung.`
                        : owed > 0
                          ? `${streak} in a row · wins pay ${winPay} · ${owed} more to reach ${TIER_LABEL[tierForStreak(streak + owed, boardSize)]}`
                          : `${streak} in a row · wins pay ${winPay} · top rung, a loss drops you to ${TIER_LABEL[tierForStreak(afterMatch(streak, false, boardSize), boardSize)]}`}
                      {(story.ladder?.best ?? 0) > streak && ` · best ${story.ladder!.best}`}
                    </span>
                  </button>
                  {/* THE "OR PICK" RUNG ROW IS GONE. It let you hand yourself
                      any difficulty you liked and then climb on it, which is
                      the one thing a ladder may not allow — and it was dead
                      weight besides, since an off-rung match already scored
                      nothing (`recordLadderMatch` returns the ladder
                      unchanged). The rung is the streak's to decide; choosing
                      your own fight is what Casual is for. */}
                </div>
              );
            })()}

            {/* THE GAUNTLET. Four opponents from one rung, dealt rather than
                chosen, and a single loss ends it. This is the earn path: a win
                against a deck you built yourself pays nothing, because
                eighteen of your worst cards in the other seat was two shards a
                match for as long as you cared to click.

                Its own MODE now, so an armed run cannot be spent by a match
                that was never part of it — see `settleArena`'s `gauntletSeat`.
                A run left standing here is still standing when you come back. */}
            {/* DIFFICULTY, asked outright. The rung used to be read off whichever
                deck was sitting in the opponent chair — oblique even then, and
                unusable now the chair is dealt rather than chosen. Shown only
                while there is no run: mid-run the rung is settled, and a live
                control that cannot change anything is a lie. */}
            {!onlineMode && !twoPlayer && arenaGame === "gauntlet"
              && (!gauntletRun || runOver(gauntletRun)) && (
              <div className="ar-field">
                <span className="ar-flabel">DIFFICULTY</span>
                <div className="seg">
                  {tiersFor(boardSize).map((rung) => (
                    <button
                      key={rung}
                      className={runTier === rung ? "on" : ""}
                      title={`Four ${TIER_LABEL[rung]} decks · clears for ${runReward(rung, boardSize)} shards`}
                      onClick={() => setRunTierPick(rung)}
                    >
                      {TIER_LABEL[rung]}
                      {(story.gauntlet?.cleared ?? []).includes(rung) && (
                        <i className="rung-done" title="Cleared before" aria-hidden="true">✓</i>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* DRAFT. The entry is charged at the moment the run is created, in
                the same write that creates it, so a draft can never exist
                unpaid — the pattern the money path uses everywhere else. */}
            {!onlineMode && !twoPlayer && arenaGame === "draft" && !draftRun && (
              <div className="ar-gauntlet">
                <button
                  className="gt-start"
                  disabled={(story.hero?.shards ?? 0) < DRAFT_ENTRY}
                  title={`Draft eighteen cards you do not own, then run them until three losses`}
                  onClick={() => {
                    const next = {
                      ...addShards(story, -DRAFT_ENTRY),
                      draft: startDraft(boardSize),
                    };
                    setStory(next); saveStory(next);
                  }}
                >
                  <span className="gt-start-main">
                    Draft a squad
                    <em className="gt-pay">
                      -{DRAFT_ENTRY}<i className="shard" aria-hidden="true" />
                    </em>
                  </span>
                  <span className="gt-sub">
                    {(story.hero?.shards ?? 0) < DRAFT_ENTRY
                      ? `Needs ${DRAFT_ENTRY} shards`
                      : "Eighteen picks from cards you do not own · three lives"}
                  </span>
                </button>
              </div>
            )}

            {/* THE RUN PANEL — and the way out of a finished run.
                Without it the mode was a DEAD END: the start button hides
                whenever `draftRun` exists, and a run that is over is still a
                run, so once three losses landed there was no draft to play, no
                deck in your chair, and no button to start another. "Draft
                again" is the clear, and clearing is what brings the start
                button back. */}
            {!onlineMode && !twoPlayer && arenaGame === "draft"
              && draftRun && draftComplete(draftRun) && (
              <div className="ar-gauntlet">
                <div className="gt-head">
                  <span className="ar-flabel">
                    DRAFT · {draftWins(draftRun)} WIN{draftWins(draftRun) === 1 ? "" : "S"}
                  </span>
                  <span className="gt-sub">
                    {draftRunOver(draftRun)
                      ? `Run over — +${draftReward(draftRun)} shards banked.`
                      : `${DRAFT_LOSSES - draftLosses(draftRun)} ${
                          DRAFT_LOSSES - draftLosses(draftRun) === 1 ? "life" : "lives"
                        } left${
                          // Only name the deck when the RUN put it there — the
                          // same rule the gauntlet panel follows, so a draft
                          // parked behind an event cannot announce an opponent
                          // it never dealt.
                          draftSeat ? ` · ${deckLabel(p2DeckId)}` : " · parked"}`}
                  </span>
                </div>
                {/* One pip per life, spent left to right. Lives rather than
                    wins: the wins are in the label above, and what makes the
                    next match tense is what is left. */}
                <div className="gt-pips">
                  {Array.from({ length: DRAFT_LOSSES }, (_, i) => (
                    <i key={i} className={i < draftLosses(draftRun) ? "lost" : "won"} />
                  ))}
                </div>
                <button
                  className="ghost sm gt-quit"
                  onClick={() => {
                    const next = { ...story, draft: undefined };
                    setStory(next); saveStory(next);
                  }}
                >
                  {draftRunOver(draftRun) ? "Draft again" : "Give up the run"}
                </button>
              </div>
            )}

            {!onlineMode && !twoPlayer && arenaGame === "gauntlet" && (
              <div className="ar-gauntlet">
                {!gauntletRun ? (
                  /* Runs the rung the row above names. That row is the ONLY
                     difficulty control on the screen — this button states the
                     choice back rather than offering it a second time. */
                  <button
                    className="gt-start"
                    onClick={() => {
                      const run = startRun(runTier, boardSize);
                      const next = { ...story, gauntlet: { ...(story.gauntlet ?? {}), run } };
                      setStory(next); saveStory(next);
                      // The seat-sync effect points p2DeckId at seat 1.
                    }}
                  >
                    <span className="gt-start-main">
                      {/* "Run the …" promised a fight this button does not
                          start: it ARMS the run and points the opponent seat at
                          seat 1, and the actual match still begins from Start
                          Match below. "Line up" says what the tap does. */}
                      Line up the {TIER_LABEL[runTier]} gauntlet
                      {/* Number then icon, matching the shop's signed amounts
                          (`-{PACK_COST}<i className="shard" />`). The bare "+12"
                          did not say WHAT it paid, and the gauntlet is the one
                          place on this screen that pays anything. */}
                      <em className="gt-pay">
                        +{runReward(runTier, boardSize)}<i className="shard" aria-hidden="true" />
                      </em>
                      {(story.gauntlet?.cleared ?? []).includes(runTier) && (
                        <i className="gt-done" title="Cleared before">✓</i>
                      )}
                    </span>
                    <span className="gt-sub">Four dealt opponents, one loss ends the run — then start it below.</span>
                  </button>
                ) : (
                  <>
                    <div className="gt-head">
                      <span className="ar-flabel">
                        GAUNTLET · {gauntletRun.tier === "mid" ? "EVEN" : gauntletRun.tier.toUpperCase()}
                      </span>
                      <span className="gt-sub">
                        {runComplete(gauntletRun)
                          ? `Run cleared — +${runReward(gauntletRun.tier, boardOfRun(gauntletRun))} shards banked.`
                          : gauntletRun.lost
                            ? `Beaten on seat ${gauntletRun.won + 1}. The run is over.`
                            : `Seat ${gauntletRun.won + 1} of ${gauntletRun.seats.length}${
                                // Only name the deck when the RUN put it there.
                                // `p2DeckId` is whatever is in the chair, so
                                // with a run parked behind an event this read
                                // "Seat 1 of 4 · Nightshrike's brood" — the run
                                // announcing an opponent it never dealt and
                                // would never score.
                                gauntletSeat ? ` · ${deckLabel(p2DeckId)}` : " · parked"}`}
                      </span>
                    </div>
                    {/* One pip per seat: what you have banked and what is left,
                        without a sentence. */}
                    <div className="gt-pips">
                      {gauntletRun.seats.map((id, i) => (
                        <i
                          key={id}
                          className={
                            i < gauntletRun.won ? "won"
                              : gauntletRun.lost && i === gauntletRun.won ? "lost"
                                : i === gauntletRun.won ? "now" : ""
                          }
                        />
                      ))}
                    </div>
                    <button
                      className="ghost sm gt-quit"
                      onClick={() => {
                        const next = { ...story, gauntlet: { ...(story.gauntlet ?? {}), run: undefined } };
                        setStory(next); saveStory(next);
                      }}
                    >
                      {runOver(gauntletRun) ? "Done" : "Give up the run"}
                    </button>
                  </>
                )}
              </div>
            )}

            {onlineMode && (
              <div className="ar-field roles">
                <div className="seg">
                  <button
                    className={onlineRole === "host" ? "on blue" : ""}
                    disabled={!!online}
                    onClick={() => setOnlineRole("host")}
                  >Host game</button>
                  <button
                    className={onlineRole === "guest" ? "on blue" : ""}
                    disabled={!!online}
                    onClick={() => setOnlineRole("guest")}
                  >Join game</button>
                </div>
              </div>
            )}

            {/* THE VERSUS CARD. Two decks, viewer-relative — yours blue and the
                opponent's red, the same pairing the board uses, so the seats
                read the same way in the lobby as they do in the match. */}
            <div className="ar-vs">
              <DeckSeat
                side="mine"
                flag={onlineMode
                  ? (onlineRole === "host" ? "YOU · HOST · P1" : "YOU · GUEST · P2")
                  : draftOwnsMySeat ? "YOU · P1 · DRAFT" : "YOU · P1"}
                label={deckLabel(mySeatDeckId)}
                cards={resolveDeckCards(mySeatDeckId)}
                /* A DRAFT OWNS BOTH SEATS. The opponent's has been locked since
                   the mode was written; this one was left changeable, so the
                   lobby offered a deck sheet over a squad you are not allowed
                   to swap — and picking from it did nothing, because the effect
                   that seats the drafted deck put it straight back. A control
                   that fights an effect is worse than no control. `DeckSeat`
                   already draws an absent `onChange` as a locked panel; it was
                   only ever the Gauntlet that used it. */
                onChange={draftOwnsMySeat
                  ? undefined
                  : () => setPickSeat(onlineMode && onlineRole === "guest" ? "p2" : "p1")}
              />

              <div className="ar-vsline"><span /><em>VS</em><span /></div>

              {onlineMode && !online ? (
                /* The room code belongs INSIDE the empty seat: the code is the
                   thing that fills it, and putting them together leaves the
                   screen one focus instead of two competing ones. */
                <div className="ar-seat empty">
                  <span className="ar-flag dim">
                    {onlineRole === "host" ? "GUEST · P2 · EMPTY SEAT" : "HOST · P1 · JOIN A ROOM"}
                  </span>
                  <input
                    className="ar-code"
                    placeholder={onlineRole === "host" ? "AUTO" : "CODE"}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={12}
                  />
                  <span className="ar-codehint">
                    {onlineRole === "host"
                      ? "Share this code to fill the seat"
                      : "Enter your buddy's room code"}
                  </span>
                  <button
                    className="lockin sm"
                    disabled={!onlineConfigured}
                    onClick={onlineRole === "host" ? hostCreateRoom : guestJoinRoom}
                  >
                    {onlineRole === "host" ? "Create room" : "Join room"}
                  </button>
                </div>
              ) : onlineMode ? (
                /* THE PREGAME LOBBY. Everyone in the room, what they are
                   bringing, and whether they have agreed to start. The host
                   builds this list and relays it, because it is the only side
                   that learns every arrival. */
                <div className="ar-seat empty live lobby">
                  <span className="ar-flag dim">
                    ROOM · {(lobby?.seats.length ?? 1)} of {lobby?.need ?? 2}
                  </span>
                  <span className="ar-code live">{roomCode || "—"}</span>
                  <div className="lob-list">
                    {Array.from({ length: lobby?.need ?? 2 }, (_, i) => {
                      const seat = (["P1", "P2", "P3", "P4"] as const)[i];
                      const row = lobby?.seats.find((x) => x.seat === seat);
                      const isMe = seat === (online?.myId ?? (onlineRole === "host" ? "P1" : null));
                      return (
                        <div key={seat} className={`lob-row${row ? "" : " open"}${isMe ? " me" : ""}`}>
                          <span className={`lob-seat seat-${seat.toLowerCase()}`}>
                            {SEAT_SUIT[seat].glyph} {seat}
                          </span>
                          <span className="lob-name">
                            {row ? row.name : "waiting for a player…"}
                            {row?.host && <i className="lob-tag">host</i>}
                            {isMe && <i className="lob-tag you">you</i>}
                          </span>
                          {row
                            ? <span className={`lob-ready${row.ready ? " on" : ""}`}>
                                {row.ready ? "READY" : "picking"}
                              </span>
                            : <span className="lob-ready open">—</span>}
                        </div>
                      );
                    })}
                  </div>
                  <span className="ar-codehint">
                    {netStatus || "Waiting for players to join…"}
                  </span>
                  <div className="lob-actions">
                    <button
                      className={iAmReady ? "ghost sm" : "lockin sm"}
                      onClick={() => { const next = !iAmReady; setIAmReady(next); announceMe(next); }}
                    >
                      {iAmReady ? "Not ready" : "I'm ready"}
                    </button>
                    {onlineRole === "host" && (
                      <button
                        className="lockin sm"
                        disabled={!lobby
                          || lobby.seats.length < lobby.need
                          || !lobby.seats.every((x) => x.ready)}
                        title={!lobby || lobby.seats.length < lobby.need
                          ? "Every seat has to be filled first"
                          : !lobby.seats.every((x) => x.ready)
                            ? "Everyone has to be ready"
                            : undefined}
                        onClick={hostStartMatch}
                      >
                        Start match
                      </button>
                    )}
                    <button className="ghost sm" onClick={leaveOnline}>Leave</button>
                  </div>
                </div>
              ) : (
                <DeckSeat
                  side="foe"
                  /* The seat says which fight this is. Without the event case
                     the flag read a flat "AI · P2" over a deck called "Darkest
                     night" — nothing on the screen said a pack was riding on
                     it. The seat stays CHANGEABLE (unlike a run's): picking
                     another deck is how you back out, and `eventRun` derives
                     from this seat, so doing so ends the event cleanly.

                     A VOID TRIAL'S SEAT IS THE BOSS. The deck in the chair is
                     only its summons, so left alone the seat wore the brood's
                     finisher ("Rotroot's brood", Zombination's face) — the one
                     card that is NOT in the deck is the whole fight. Name, face
                     and flag all come from the boss; the chips below still show
                     what it brings. */
                  flag={eventRun?.bossId ? "VOID TOWER · BOSS" : eventRun ? "EVENT · ONE TIME ONLY" : gauntletSeat ? `GAUNTLET · SEAT ${(gauntletRun?.won ?? 0) + 1}` : twoPlayer ? "P2 · SECOND PLAYER" : "AI · P2"}
                  label={eventRun?.bossId ? getDef(eventRun.bossId).name : deckLabel(p2DeckId)}
                  artOverride={eventRun?.bossId ? `/cards/${getDef(eventRun.bossId).art ?? eventRun.bossId}.webp` : undefined}
                  /* The DUEL, not the brood. A boss fight is pitched as two
                     elements — the tribe's and the mechanic's — and that pair
                     is what the puzzle is built on; counting the summons in the
                     chair instead described the wrong half of the fight. */
                  elements={eventRun?.bossId ? voidBossElements(eventRun.bossId) : undefined}
                  cards={resolveDeckCards(p2DeckId)}
                  /* DEALT, NOT CHOSEN — in either challenge mode. A run's seat
                     was already locked (opening the sheet is the re-roll the run
                     exists to prevent), but STREAK's was not: you could hand
                     yourself the softest deck on the rung and climb on it. The
                     point of both modes is that the opponent is picked FOR you,
                     and Casual is where picking your own fight lives. */
                  onChange={
                    gauntletSeat || arenaGame !== "casual" ? undefined : () => setPickSeat("p2")
                  }
                />
              )}
            </div>

            {/* THE OTHER SEATS AT THE TABLE. Domination is the only mode that
                deals more than two, and until now the third and fourth were
                chosen for you — the first premades not already seated — so a
                four-way was three armies you could not see and one you could.
                You are about to fight them; the lobby should say what they are.

                Below the VS card rather than inside it, because the versus card
                is a DUEL: two seats facing each other is what it draws, and a
                free-for-all is not that shape. These read as the rest of the
                table, which is what they are.

                Hidden online — the host does not choose other people's decks —
                and hidden in hot-seat, which cannot deal more than two anyway. */}
            {boardSize === DOMINATION_7X7.boardSize && seatCount > 2
              && !onlineMode && !twoPlayer && (
              <div className="ar-table">
                <span className="ar-flabel">
                  {seatCount === 3 ? "THIRD SEAT" : "THE OTHER SEATS"}
                </span>
                <div className="ar-table-seats">
                  {(["p3", "p4"] as const).slice(0, seatCount - 2).map((seat, i) => {
                    const id = seat === "p3" ? p3DeckId : p4DeckId;
                    return (
                      <DeckSeat
                        key={seat}
                        side="foe"
                        flag={`AI · P${i + 3}`}
                        label={deckLabel(id)}
                        cards={resolveDeckCards(id)}
                        onChange={() => setPickSeat(seat)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <div className="ar-foot">
              {!onlineMode ? (
                <button
                  className={`lockin ar-start${arenaGame === "gauntlet" && gauntletRun && !runOver(gauntletRun) && !eventRun ? " gauntlet" : ""}`}
                  disabled={!startGate.ok}
                  onClick={startArenaMatch}
                >
                  {/* The deception this fixes: one button, two very different
                      commitments. With a run armed this begins a GAUNTLET SEAT
                      — a loss ends four matches' progress — and it read exactly
                      the same as a throwaway single fight. The label now names
                      which one you are agreeing to, and where you are in it. */}
                  {!startGate.ok
                    ? startGate.why
                    : arenaGame === "gauntlet" && gauntletRun && !runOver(gauntletRun) && !eventRun
                      ? `Start Gauntlet · Seat ${gauntletRun.won + 1} of ${gauntletRun.seats.length}`
                      : arenaGame === "streak" && !twoPlayer && !onlineMode
                        ? `Start Streak Match · ${TIER_LABEL[tierForStreak(story.ladder?.streak ?? 0, boardSize)]}`
                        : "Start Match"}
                </button>
              ) : (
                <button className="lockin ar-start" disabled>
                  {online ? "Waiting for your buddy…" : "Fill the seat to start"}
                </button>
              )}
              {startGate.warn && (
                /* Casual lets a half-built squad fight — that is what a sandbox
                   is for — but the engine never enforced deck size at all, so
                   "why did I run out of cards" had no answer anywhere on the
                   screen. */
                <div className="ar-warn">{startGate.warn} · fine here, not in Streak or Gauntlet.</div>
              )}
              {/* Two ghosts, not four — Story and Shop live in the nav. */}
              <div className="ar-ghosts">
                <button className="ghost" onClick={() => setBuilderOpen(true)}>Build a squad</button>
                <button className="ghost" onClick={() => setRulesOpen(true)}>How to play</button>
              </div>
              {onlineMode && !onlineConfigured && (
                <div className="net-status warn">
                  Online needs VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY — see README.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OUTSIDE `.overlay`, deliberately. `.overlay` is a stacking context at
          --z-overlay (300), so the sheet's own --z-modal (500) is scoped inside
          it and loses to the bottom nav at 350 — "Build a new deck" was painted
          under the nav and unclickable. A fragment creates no stacking context,
          so out here the 500 competes at the top level and wins. */}
      {!started && !storyOpen && tab === "arena" && pickSeat && (
            <DeckPickerSheet
              title={
                pickSeat === "p3" ? "Third squad"
                : pickSeat === "p4" ? "Fourth squad"
                : pickSeat === "p1"
                  ? (onlineMode || !twoPlayer ? "Your squad" : "Player 1 squad")
                  : (onlineMode ? "Your squad" : twoPlayer ? "Player 2 squad" : "Opponent squad")
              }
              boardSize={boardSize}
              premades={modePremades}
              customs={customDecks}
              value={pickSeat === "p1" ? p1DeckId
                : pickSeat === "p2" ? p2DeckId
                : pickSeat === "p3" ? p3DeckId : p4DeckId}
              onPick={(id) => {
                if (pickSeat === "p1") setP1DeckId(id);
                else if (pickSeat === "p3") setP3DeckId(id);
                else if (pickSeat === "p4") setP4DeckId(id);
                else setP2DeckId(id);
              }}
              onClose={() => setPickSeat(null)}
              onBuild={() => setBuilderOpen(true)}
            />
      )}

      {/* Campaign team builder: the same screen as the sandbox, with the pool
          cut to what you own and the ceiling set by the campaign. */}
      {/* ── the four destinations ─────────────────────────────────────────── */}
      {/* Home WAS the collection, and that call was right about the thing it
          was reacting to: the landing card it replaced was a title and two
          shortcuts, a menu pretending to be a destination. `HomeScreen` is not
          that card back again — every line on it is live state and every tile
          carries a number that changed since you last looked. The collection
          keeps its place, one tap down, which is where the redesign puts it:
          building and browsing are things you do BETWEEN fights and neither
          earns a permanent tab against four. */}
      {!started && !storyOpen && tab === "home" && !homeCollection && (
        <HomeScreen
          save={story}
          regionId={nav.regionId}
          onProfile={() => setProfileOpen(true)}
          onStory={(rid) => {
            setTab("story");
            // A row that names a region has to open THAT map — `open` alone
            // leaves `regionId` untouched, so a Blight card about PYRO landed
            // you on whatever map you last read.
            if (rid && rid !== nav.regionId) navDo({ t: "pickRegion", regionId: rid });
            navDo({ t: "open" });
          }}
          // The Gauntlet panel and the seat lock are both gated on vs-AI, and
          // the settle effect is NOT — so arriving here in hot-seat showed no
          // run at all and then let a 2-player match end it.
          onArena={() => { setArenaMode("ai"); setTab("arena"); }}
          // Seats the event and drops you in the Arena on its board, ready to
          // start. Not auto-started: the event is fought with YOUR deck and the
          // Arena is where you pick it, so walking in without that step would be
          // fighting a 30-card DUSK build with whatever was last selected.
          onEvent={seatEventFight}
          onShop={(t) => { setShopTab(t); setTab("shop"); }}
          onBuilder={() => navDo({ t: "builder", open: true })}
          onCollection={() => setHomeCollection(true)}
          onGallery={() => setGalleryOpen(true)}
          // The first-run guide's last step. Same jump the Collection's
          // "where does it drop?" link makes — focus the node, then open the
          // map on it — because landing on the region and leaving the player
          // to find L1 is the exact hand-off this guide exists to close.
          onFightFirst={() => {
            navDo({ t: "goToNode", nodeId: FIRST_NODE, regionId: regionOfNode(FIRST_NODE)?.id });
            navDo({ t: "open" });
          }}
          onSkipOnboarding={() => {
            const next = { ...story, taught: [...new Set([...(story.taught ?? []), ONBOARDING_SKIP])] };
            setStory(next); saveStory(next);
          }}
          onAccount={() => setAccountOpen(true)}
          onRules={() => setRulesOpen(true)}
          accountEmail={accountEmail}
        />
      )}

      {!started && !storyOpen && tab === "home" && homeCollection && (
        <StoryCollection
          save={story}
          onSave={(next) => { setStory(next); saveStory(next); }}
          onClose={() => setHomeCollection(false)}
          closeLabel="Back to Home"
          // Without this the per-card "where does it drop?" jump silently
          // vanishes (the prop is optional), which is the one thing the
          // Collection tile's MISSING count promises.
          onGoToNode={(nodeId) => {
            setHomeCollection(false);
            setTab("story");
            navDo({ t: "goToNode", nodeId, regionId: regionOfNode(nodeId)?.id });
            navDo({ t: "open" });
          }}
          onOpenBuilder={() => navDo({ t: "builder", open: true })}
        />
      )}

      {/* THE PROFILE. Rendered outside the `tab === "home"` gate so it survives
          a tab change behind it, the same shape the other overlays use. Totals
          come from here rather than from inside the panel because App already
          owns them and two sources would disagree about "how many cards exist". */}
      {profileOpen && (
        <ProfilePanel
          save={story}
          totalCards={PLACED_CARDS.length}
          totalNodes={ALL_NODES.length}
          onName={(name) => patchHero({ name })}
          onAvatar={(avatar) => patchHero({ avatar })}
          onClose={() => setProfileOpen(false)}
        />
      )}

      {!started && !storyOpen && tab === "tower" && (
        // Inside an `.overlay` like every other destination — the pre-match
        // battle chrome hides by class but its GRID does not, so a bare child
        // here lands in the 194px log column. Home hit the same wall and the
        // overlay is how it climbed out.
        <div className="overlay arena-wrap vt-overlay">
          <VoidTower
          save={story}
          onFight={seatEventFight}
          openOnMount={towerOpenOn}
          onOpenConsumed={() => setTowerOpenOn(null)}
        />
        </div>
      )}

      {!started && !storyOpen && tab === "shop" && (
        <div className="overlay">
          <div className="modal picker shop-modal">
            {/* Keyed, because `openTab` seeds `useState` and only runs on
                MOUNT. Tapping the already-active Shop icon changes the prop
                without unmounting Shop, so the reset below never happened. */}
            <Shop key={shopTab} save={story} openTab={shopTab}
              onSave={(next) => { setStory(next); saveStory(next); }} />
          </div>
        </div>
      )}

      {/* THE PICK SCREEN. Mounted only while a run is still choosing cards, so
          the moment the eighteenth lands it falls away and the run is a deck in
          your chair like any other. It owns nothing: every pick comes back here
          and is written to the save immediately, because a draft interrupted by
          a closed tab should resume on the pick it was on. */}
      {/* LEVEL UP. Derived from the save rather than fired by an event, because
          `playerLevel` has no event to fire — whatever moved the collection
          (a pack, a boss, a story clear) moved the level as a side effect, and
          this notices on the next render. One card for the whole span; both
          buttons pay, because `claimLevelUp` is what closes it either way. */}
      {levelUp && (
        <LevelUpModal
          reward={levelUp}
          onClose={() => {
            setStory((prev) => {
              const next = claimLevelUp(prev);
              if (next === prev) return prev;
              saveStory(next);
              return next;
            });
          }}
        />
      )}

      {draftRun && !draftComplete(draftRun) && (
        <DraftScreen
          run={draftRun}
          onPick={(id) => {
            setStory((prev) => {
              if (!prev.draft) return prev;
              const next = { ...prev, draft: pickCard(prev.draft, id) };
              saveStory(next);
              return next;
            });
          }}
          onExit={() => {
            // Abandoning DISCARDS the run — the entry was already paid, and a
            // draft you can walk out of and back into at will is a way to shop
            // for an opening hand rather than a run.
            setStory((prev) => {
              const next = { ...prev, draft: undefined };
              saveStory(next);
              return next;
            });
            setArenaGame("casual");
          }}
        />
      )}

      <DeckBuilder
        open={nav.builder}
        onClose={() => navDo({ t: "builder", open: false })}
        // Not a no-op any more: the campaign and the Arena share one library, so
        // a squad saved in here has to reach the shelf on the prep screen this
        // opened on top of.
        onChange={setCustomDecks}
        boardSize={builderBoard}
        story={{
          owned: storyBuilderOwned,
          cap: builderCap,
          forNode: prepNode?.name,
          element: region.element,
          spellPool: heroSpellShelf(story),
          foils: foilIds,
          // The squad itself went to the shared library. What belongs in the
          // SAVE is what you are HOLDING and which squad it came from — the
          // campaign's pointer, not a second copy of the library. `loadouts` is
          // read-only legacy from here on: `absorbLegacy` migrates it on boot
          // and nothing writes it again.
          onSaved: (cards, squadId) => {
            const next = { ...story, deck: cards, lastTeamId: squadId ?? story.lastTeamId };
            setStory(next);
            saveStory(next);
          },
          onDeleted: (id) => {
            if (story.lastTeamId !== id) return;
            const next = { ...story, lastTeamId: undefined };
            setStory(next);
            saveStory(next);
          },
        }}
      />

      <DeckBuilder
        boardSize={boardSize}
        open={builderOpen}
        // The squad builder off the main menu is the same tool over the same
        // collection as the campaign one above, so it shines the same cards.
        // It has no `story` prop — it is not building a campaign team — and the
        // foil set used to ride on that prop, which is the whole reason a foil
        // went plain here.
        foils={foilIds}
        incomingCode={linkedDeck}
        onIncomingConsumed={() => setLinkedDeck(null)}
        onClose={() => { setBuilderOpen(false); setLinkedDeck(null); }}
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
      {galleryOpen && <CardGallery onClose={() => setGalleryOpen(false)} />}
      {accountOpen && (
        <AccountPanel
          onClose={() => setAccountOpen(false)}
          // A restore rewrites localStorage under an app that read it at boot,
          // so nothing on screen would change without this. A full reload is
          // the honest way to re-read EVERY save file at once — the campaign,
          // the squads, the deck library and the auto defaults are loaded by
          // four different modules, and re-seeding them by hand would be four
          // chances to miss one and leave the player looking at a mixture.
          onRestored={() => window.location.reload()}
        />
      )}

      {/* Hidden during a match: a bottom bar over a 5x5 board eats the row the
          player needs most, and there is nowhere to navigate to mid-fight. */}
      {!started && !builderOpen && !rulesOpen && !galleryOpen && (
        <BottomNav
          tab={storyOpen ? "story" : tab}
          spendable={Object.values(story.hero?.essence ?? {}).reduce((a, b) => a + b, 0)}
          onTab={(t) => {
            setTab(t);
            // Home's collection is a sub-screen of the tab, not a destination
            // of its own: tapping Home from anywhere has to land on Home.
            setHomeCollection(false);
            // Likewise the Shop opens on Packs unless Home had a reason to
            // send you to the Crafter. Reaching it from the nav is not one.
            setShopTab("packs");
            // Story owns the whole screen when it is up, so entering and leaving
            // it is a real transition rather than just a tab swap.
            navDo({ t: t === "story" ? "open" : "close" });
          }}
        />
      )}

      {/* THE WALKTHROUGH, over whatever shell is up. Mounted here rather than
          inside Home because that is the point of the rewrite: the step that
          says "open your free pack" now points at the pack, which is on another
          tab, and a guide that only exists on Home cannot do that.
          Suppressed during a match and behind the full-screen surfaces for the
          same reason the nav is — there is nothing to walk you through mid-fight,
          and a spotlight over a board covers the board. */}
      {!started && !builderOpen && !rulesOpen && !galleryOpen && guideStep && (
        <GuideOverlay
          anchor={guideOnTab ? guideStep.anchor : null}
          title={guideStep.title}
          body={guideStep.body}
          cta={guideStep.cta}
          onCta={runGuideStep}
          onSkip={canSkipGuide(story) ? skipGuide : undefined}
          skipLockedNote={skipLockedNote(story)}
          stepIndex={onboardingIndex(guideStep)}
          stepCount={ONBOARDING_COUNT}
        />
      )}
    </MatchLayout>
  );
}

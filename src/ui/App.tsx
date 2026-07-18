import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GameState, Intent, PlayerId, Pos } from "../engine";
import {
  advance,
  applyIntent,
  canCastSpell,
  canFireSpecial,
  canFireTalent,
  canMove,
  canSummon,
  cardAt,
  createInitialState,
  effectiveBasicHits,
  effectiveDmg,
  enemyOf,
  FLOW_MODES,
  getDef,
  getSpell,
  homeRow,
  liquidGivesHit,
  legalMoves,
  legalWallRows,
  needsInput,
  needsP1Input,
  previewOnSummonArea,
  spellEnemyTargets,
  specialTargets,
  validAllyTargets,
  validTargets,
} from "../engine";
import { joinRoom, onlineConfigured, type Role, type Room } from "../net/online";
import { Board } from "./Board";
import { CardDetail } from "./CardDetail";
import { DeckBuilder } from "./DeckBuilder";
import { loadCustomDecks, PREMADE_DECKS, type CustomDeck } from "../data/custom-decks";
import { SpIcon } from "./icons";
import { Hand } from "./Hand";
import { PhaseRibbon } from "./PhaseRibbon";
import { ResourcePool } from "./ResourcePool";
import { SpeedQueue } from "./SpeedQueue";
import { SpellTray } from "./SpellTray";
import { WinScreen } from "./WinScreen";
import { EL_COLOR, EL_ICON, type PendingBattle, type Selection } from "./shared";

function newSeed(): number {
  return (Math.random() * 0x7fffffff) | 0;
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
  // Card inspector: clicking a played card opens a read-only detail panel.
  const [detailId, setDetailId] = useState<string | null>(null);
  // Pre-game deck selection — the match doesn't run until Start.
  const [started, setStarted] = useState(false);
  const [twoPlayer, setTwoPlayer] = useState(false);
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
  // Deck selection = a premade or custom deck (the old two-core pairing is gone).
  // Each side defaults to a different premade so a match is one tap away.
  const [p1DeckId, setP1DeckId] = useState(PREMADE_DECKS[0].id);
  const [p2DeckId, setP2DeckId] = useState(PREMADE_DECKS[1].id);
  // Selectable decks = the shipped premade builds + the player's own custom decks.
  const deckPool: CustomDeck[] = [...PREMADE_DECKS, ...customDecks];
  // Resolve a side's card list / label; fall back to the first premade if a
  // selection ever goes missing (e.g. a custom deck deleted mid-session).
  const resolveDeckCards = (deckId: string): string[] =>
    (deckPool.find((d) => d.id === deckId) ?? PREMADE_DECKS[0]).cards;
  // A deck's hand-picked spellbook (empty = engine auto-derives from elements).
  const resolveDeckSpells = (deckId: string): string[] =>
    (deckPool.find((d) => d.id === deckId) ?? PREMADE_DECKS[0]).spells ?? [];
  const deckLabel = (deckId: string): string =>
    (deckPool.find((d) => d.id === deckId) ?? PREMADE_DECKS[0]).name;

  // The human who must act right now (null while an AI acts or a phase
  // animates). `view` holds the last active human so the hand/pools/labels
  // don't flicker between turns; in vs-AI mode it's always P1.
  // Whose input the game needs; online, I only act on MY turn (else null).
  const actor = started ? needsInput(game) : null;
  const me = online ? (actor === online.myId ? online.myId : null) : actor;
  const [viewSide, setViewSide] = useState<PlayerId>("P1");
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
    const delay = game.phase === "battle" ? 480 : 260;
    const t = setTimeout(() => {
      const next = advance(game);
      setGame(next);
      if (online) broadcast(next);
    }, delay);
    return () => clearTimeout(t);
  }, [game, started, online]);

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
    if (game.phase === "prep" && actor && mine)
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
      setStaged(null);
      if (online) broadcast(next); // sync my move to the other client
    } catch (e) {
      setHint(`⚠ ${(e as Error).message}`);
    }
  }

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
    setNetStatus(`Room ${code} open — share this code. Waiting for your buddy…`);
    onlineStartedRef.current = false;
    roomRef.current = joinRoom(code, "host", {
      onState: (state) => setGame(state),
      onJoin: (guestCards, guestSpells) => {
        if (onlineStartedRef.current) return; // already playing — ignore re-joins
        onlineStartedRef.current = true;
        const g = createInitialState(newSeed(), hostCards, guestCards, ["P1", "P2"], hostSpells, guestSpells);
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
    dispatch({ type: "SUMMON", player: me, handId: staged.handId, col: staged.col });
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
    const p = game.players[me];
    const card = p.hand.find((h) => h.handId === handId);
    if (!card || getDef(card.defId).cost > p.summonPool) return;
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
  const legalSlots: Pos[] = useMemo(() => {
    if (game.phase !== "prep") return [];
    const hr = homeRow(view);
    if (sel?.kind === "hand") {
      const out: Pos[] = [];
      for (let col = 0; col < 4; col++)
        if (canSummon(game, view, sel.handId, col).ok)
          out.push({ row: hr, col } as Pos);
      return out;
    }
    if (sel?.kind === "card") return legalMoves(game, view, sel.instanceId);
    if (sel?.kind === "spell") {
      const spell = getSpell(sel.spellId);
      if (spell.kind === "wall") {
        // Highlight every slot of each legal row so the whole row glows.
        const out: Pos[] = [];
        for (const r of legalWallRows(game, view, spell))
          for (let col = 0; col < 4; col++) out.push({ row: r, col } as Pos);
        return out;
      }
    }
    return [];
  }, [game, sel, view]);

  const awaitingId = game.battle?.awaitingInput ?? null;
  const legalTargetIds: string[] = useMemo(() => {
    // Prep-phase damage spell armed → its legal enemy targets glow.
    if (sel?.kind === "spell") {
      const spell = getSpell(sel.spellId);
      return spell.kind === "damage"
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
  }, [game, awaitingId, pending, sel, view]);

  // Enemy targets (basics / attack-specials / damage spells) glow RED; friendly
  // (ally-target heal specials) stay green.
  const targetsAreEnemies = useMemo(() => {
    if (legalTargetIds.length === 0) return false;
    if (sel?.kind === "spell") return getSpell(sel.spellId).kind === "damage";
    if (pending === "special" && awaitingId)
      return getDef(game.cards[awaitingId].defId).special?.targetSide !== "ally";
    return true; // basic attack
  }, [legalTargetIds, sel, pending, awaitingId, game]);

  // The active placement — either a card being DRAGGED over a home column (live
  // preview) or a STAGED summon awaiting confirm. Both drive the same red
  // on-summon area preview + green "place here" slot.
  const activeHandId = staged?.handId ?? drag ?? null;
  const activeCol = staged ? staged.col : dragCol;
  const stagedSlot: Pos | null = useMemo(
    () => (activeHandId !== null && activeCol !== null && me !== null ? ({ row: homeRow(me), col: activeCol } as Pos) : null),
    [activeHandId, activeCol, me],
  );
  const previewArea: Pos[] = useMemo(() => {
    if (activeHandId === null || activeCol === null || me === null) return [];
    const h = game.players[me].hand.find((c) => c.handId === activeHandId);
    if (!h) return [];
    return previewOnSummonArea(game, getDef(h.defId), me, { row: homeRow(me), col: activeCol } as Pos);
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
    if (def.cost > p.summonPool) {
      setHint(`⚠ Not enough summon resources for ${def.name} (cost ${def.cost}).`);
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
    // Heal/support spells auto-target an ally — cast on the spot (or explain why not).
    if (spell.kind === "heal") {
      const chk = canCastSpell(game, me, spellId, {});
      if (chk.ok) {
        dispatch({ type: "CAST_SPELL", player: me, spellId });
        setHint(`Cast <b>${spell.name}</b>.`);
      } else {
        setHint(`⚠ ${chk.reason}`);
      }
      return;
    }
    setSel({ kind: "spell", spellId });
    setPending(null);
    setPicks([]);
    setHint(
      spell.kind === "wall"
        ? `Casting <b>${spell.name}</b> — click a glowing row to raise it.`
        : `Casting <b>${spell.name}</b> — click a glowing enemy target.`,
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
      if (spell.kind === "wall") {
        const chk = canCastSpell(game, me, sel.spellId, { row });
        if (chk.ok) {
          dispatch({ type: "CAST_SPELL", player: me, spellId: sel.spellId, row });
          setHint(`${spell.name} raised. Keep going, or <b>Pass Priority</b>.`);
        } else if (clicked) {
          setDetailId(clicked.instanceId);
        } else {
          setHint(`⚠ ${chk.reason}`);
        }
        return;
      }
      // damage spell
      if (clicked && canCastSpell(game, me, sel.spellId, { targetId: clicked.instanceId }).ok) {
        dispatch({ type: "CAST_SPELL", player: me, spellId: sel.spellId, targetId: clicked.instanceId });
        setHint(`${spell.name} cast. Keep going, or <b>Pass Priority</b>.`);
      } else if (clicked) {
        setDetailId(clicked.instanceId);
      } else {
        setHint("⚠ Pick a glowing enemy target.");
      }
      return;
    }

    // Summon placement — a hand card is armed; empty Home slots STAGE the summon
    // (a confirm + red on-summon area preview), occupied slots inspect instead.
    if (me && game.phase === "prep" && game.prep?.priority === me && sel?.kind === "hand") {
      if (clicked) {
        setDetailId(clicked.instanceId);
      } else if (canSummon(game, me, sel.handId, col).ok && row === homeRow(me)) {
        setStaged({ handId: sel.handId, col });
        setHint("Confirm placement — <b>red</b> marks where its on-summon effect lands.");
      } else {
        setHint(`⚠ ${canSummon(game, me, sel.handId, col).reason ?? "Home row only."}`);
      }
      return;
    }

    // Move destination — a board card is armed; empty green slots complete the
    // move, clicking a card opens its detail (its Move button re-arms it).
    if (me && game.phase === "prep" && game.prep?.priority === me && sel?.kind === "card") {
      if (clicked) {
        setDetailId(clicked.instanceId);
        return;
      }
      const check = canMove(game, me, sel.instanceId, { row, col } as Pos);
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

  function onCycleAuto(instanceId: string) {
    const owner = game.cards[instanceId]?.owner ?? view;
    // Only ever toggle your OWN cards' auto mode — never the opponent's.
    if (owner !== view) return;
    const order = ["manual", "basic", "full"] as const;
    const cur = game.cards[instanceId]?.autoMode ?? "manual";
    const mode = order[(order.indexOf(cur) + 1) % 3];
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

  const myPrep = me !== null && game.phase === "prep" && game.prep?.priority === me;
  // I may drive the battle action panel ONLY when the card that's up is mine —
  // never the opponent's (online) or the AI's. This is the single gate that
  // stops "attacking as the opponent's card".
  const iActBattle = activeCard !== null && me !== null && activeCard.owner === me;
  // Online only: the opponent is mid-decision — either they hold prep priority,
  // or their card is the one awaiting a battle action. Drives the waiting panel.
  const oppId = online ? enemyOf(online.myId) : null;
  const oppDeciding =
    !!online &&
    ((game.phase === "prep" && game.prep?.priority === oppId) ||
      (activeCard !== null && activeCard.owner === oppId));

  return (
    <div className={`wrap${logCollapsed ? " log-collapsed" : ""}`}>
      <PhaseRibbon game={game} />

      <div className={`rail log-rail${logCollapsed ? " collapsed" : ""}${mobilePanel === "log" ? " mobile-open" : ""}`}>
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
          {game.log.slice(-40).map((l, i) => (
            <div key={i} className={l.includes("(P1)") ? "me" : ""}>
              {l}
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
        selectedId={sel?.kind === "card" ? sel.instanceId : null}
        actingId={awaitingId}
        grayTeam={
          // Throughout your prep turn, fade the idle opponent's team to ~50% so
          // it's clear those pieces aren't yours to act on. The one exception is
          // a damage spell you're aiming — then the enemy must stay lit to target.
          game.phase === "prep" &&
          me !== null &&
          game.prep?.priority === me &&
          !(sel?.kind === "spell" && getSpell(sel.spellId).kind === "damage")
            ? enemyOf(me)
            : null
        }
        viewPlayer={view}
        onSlotClick={onSlotClick}
        onSlotDragOver={onSlotDragOver}
        onSlotDrop={onSlotDrop}
        onCycleAuto={onCycleAuto}
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

      {/* Right of the field: the spell tray sits above the initiative (Speed
          Queue) rail — the hand fans UP from the bottom bar, so the top of this
          column is the spot the cards never reach. */}
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
                {effectiveDmg(game, activeCard)} · {activeDef.attackType}
              </small>
            </div>
            <div className="bp-actions">
              <button
                className={`bbtn atk ${pending === "basic" ? "armed" : ""}`}
                disabled={!basicOk}
                onClick={() => {
                  if (pending === "basic" && picks.length > 0) {
                    firePicks(picks); // fire early with the hits assigned so far
                    return;
                  }
                  setPending("basic");
                  setPicks([]);
                  setHint(
                    effectiveBasicHits(activeCard) > 1
                      ? `Basic attack: <b>${effectiveBasicHits(activeCard)} hits × ${effectiveDmg(game, activeCard)} DMG</b> — click up to ${effectiveBasicHits(activeCard)} glowing targets (repeat one to stack).`
                      : "Pick a glowing target for the basic attack.",
                  );
                }}
              >
                {pending === "basic" && picks.length > 0
                  ? `🔥 Fire (${picks.length}/${maxPicks})`
                  : "⚔ Basic Attack"}
              </button>
              <button
                className={`bbtn spec ${pending === "special" ? "armed" : ""}`}
                disabled={!specialCheck.ok}
                title={
                  activeDef.special
                    ? `${activeDef.special.name} (cost ${activeDef.special.cost}): ${activeDef.special.text}`
                    : "No special"
                }
                onClick={() => {
                  const spec = activeDef.special!;
                  if (pending === "special") {
                    // Second click = fire. Area Specials hit the whole previewed
                    // zone; targeted ones fire the picks assigned so far.
                    if (specialAoE) {
                      dispatch({
                        type: "BATTLE_ACTION",
                        player: activeCard.owner,
                        action: "special",
                        targetIds: specialValid.map((t) => t.instanceId),
                      });
                    } else if (picks.length > 0) {
                      firePicks(picks);
                    }
                    return;
                  }
                  // First click = arm and preview the affected area.
                  const cap = Number(spec.params?.targets ?? 1);
                  setPending("special");
                  setPicks([]);
                  setHint(
                    specialAoE
                      ? `<b>${spec.name}</b> hits the glowing area — press <b>Confirm</b> to fire.`
                      : `<b>${spec.name}</b> (cost ${spec.cost}) — pick up to ${cap} glowing target${cap > 1 ? "s (repeat to stack), or Fire early" : ""}.`,
                  );
                }}
              >
                {pending === "special"
                  ? specialAoE
                    ? "✦ Confirm"
                    : picks.length > 0
                      ? `🔥 Fire (${picks.length}/${maxPicks})`
                      : `✦ Special${activeDef.special ? ` (${activeDef.special.cost})` : ""}`
                  : `✦ Special${activeDef.special ? ` (${activeDef.special.cost})` : ""}`}
              </button>
              {activeDef.talent && (
                <button
                  className="bbtn tal"
                  disabled={!talentCheck.ok}
                  title={`${activeDef.talent.name} (Talent, free · once per game): ${activeDef.talent.text}`}
                  onClick={() => dispatch({ type: "BATTLE_ACTION", player: activeCard.owner, action: "talent" })}
                >
                  ★ {activeDef.talent.name}
                </button>
              )}
              <button
                className="bbtn skip"
                onClick={() => dispatch({ type: "BATTLE_ACTION", player: activeCard.owner, action: "skip" })}
              >
                Skip
              </button>
            </div>
            {/* Armed special → show what it does (the hover title is invisible on
                touch, and the hint row is hidden mid-battle on mobile). */}
            {pending === "special" && activeDef.special && (
              <div className="bp-text spec-desc">
                <b>{activeDef.special.name}</b>
                <span className="spec-cost"> · {activeDef.special.cost} SP</span> — {activeDef.special.text}
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
              keeps its own tray in the right rail; this one is CSS-hidden there). */}
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
          {/* Portrait: a copy of the crystals down here in the action panel, clear
              of the hand (the top .resource is CSS-hidden in portrait). Desktop
              hides THIS one and keeps the top one. */}
          <div className="panel-crystals">
            <ResourcePool game={game} player={view} />
          </div>
          {/* Pass Priority is the primary action; secondary controls stack
              underneath it so the hand keeps its width. */}
          <button
            className="lockin pass-btn"
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
              <span className={`mv ${game.prep?.movedThisTurn ? "used" : ""}`}>
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
                      src={`/cards/${def.art ?? def.id}.png`}
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
                      <span>⚔{def.hits > 1 ? `${def.hits}×` : ""}{def.dmg}</span>
                      <span>♥{def.hp}</span>
                      <span><SpIcon />{def.sp}</span>
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
                  ⏳ <b>{getDef(flowCard.defId).name}</b> is flowing into being —
                  your opponent is choosing its boost.
                </p>
              </div>
            </div>
          );
        return (
          <div className="overlay">
            <div className="modal flow-modal">
              <h1>Flow Change</h1>
              <p>
                <b>{getDef(flowCard.defId).name}</b> flows into being —
                choose its boost for this turn.
              </p>
              <div className="flow-opts">
                {(["water", "ice", "steam"] as const).map((mode) => {
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
        <CardDetail
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
          onClose={() => setDetailId(null)}
        />
      )}

      {/* Only during a match — New Match sets started=false, which hides this and
          reveals the deck picker (game.win stays set until Start Match resets it). */}
      {started && (
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

      {!started && (
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
              {(!onlineMode || onlineRole === "host") && (
              <div className="pick-field">
                <span>{onlineMode ? "Your deck (P1)" : twoPlayer ? "Player 1 deck" : "Your deck (P1)"}</span>
                <select
                  className="deck-src"
                  value={p1DeckId}
                  onChange={(e) => { setP1DeckId(e.target.value); setViewDeck("p1"); }}
                >
                  <optgroup label="Premade decks">
                    {PREMADE_DECKS.map((d) => (
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
                    {PREMADE_DECKS.map((d) => (
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
                              src={`/cards/${d.art ?? d.id}.png`}
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
                              <span>⚔{d.hits > 1 ? `${d.hits}×` : ""}{d.dmg}</span>
                              <span>♥{d.hp}</span>
                              <span><SpIcon />{d.sp}</span>
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

      <DeckBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onChange={(decks) => {
          setCustomDecks(decks);
          // If a side's custom deck was deleted, fall back to the first premade
          // (premades live in code, so they always stay valid).
          const stillValid = new Set([...PREMADE_DECKS.map((d) => d.id), ...decks.map((d) => d.id)]);
          if (!stillValid.has(p1DeckId)) setP1DeckId(PREMADE_DECKS[0].id);
          if (!stillValid.has(p2DeckId)) setP2DeckId(PREMADE_DECKS[0].id);
        }}
      />
    </div>
  );
}

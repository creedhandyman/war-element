import { useEffect, useMemo, useRef, useState } from "react";
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
  CORES,
  coreById,
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
  pairingCards,
  spellEnemyTargets,
  specialTargets,
  validAllyTargets,
  validTargets,
} from "../engine";
import { Board } from "./Board";
import { CardDetail } from "./CardDetail";
import { DeckBuilder } from "./DeckBuilder";
import { loadCustomDecks, type CustomDeck } from "../data/custom-decks";
import { SpIcon } from "./icons";
import { Hand } from "./Hand";
import { PhaseRibbon } from "./PhaseRibbon";
import { ResourcePool } from "./ResourcePool";
import { SpeedQueue } from "./SpeedQueue";
import { SpellTray } from "./SpellTray";
import { WinScreen } from "./WinScreen";
import { EL_COLOR, type PendingBattle, type Selection } from "./shared";

function newSeed(): number {
  return (Math.random() * 0x7fffffff) | 0;
}

export function App() {
  const [game, setGame] = useState<GameState>(() => createInitialState(newSeed()));
  const [sel, setSel] = useState<Selection>(null);
  const [pending, setPending] = useState<PendingBattle>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [hint, setHint] = useState<string>(
    "Mulligan: click cards to send back, then confirm.",
  );
  const [mullToss, setMullToss] = useState<string[]>([]);
  const [surrenderArmed, setSurrenderArmed] = useState(false);
  // Card inspector: clicking a played card opens a read-only detail panel.
  const [detailId, setDetailId] = useState<string | null>(null);
  // Pre-game deck selection — the match doesn't run until Start.
  const [started, setStarted] = useState(false);
  // Each player's deck is a PAIRING of two element cores (mix-and-match).
  const [p1CoreA, setP1CoreA] = useState("pyro");
  const [p1CoreB, setP1CoreB] = useState("aqua");
  const [p2CoreA, setP2CoreA] = useState("dawn");
  const [p2CoreB, setP2CoreB] = useState("bolt");
  const [twoPlayer, setTwoPlayer] = useState(false);
  const [viewDeck, setViewDeck] = useState<"p1" | "p2">("p1"); // which deck's cards to preview
  // Custom decks (a sandbox on top of the Cores). "" = use the two core selects.
  const [customDecks, setCustomDecks] = useState<CustomDeck[]>(() => loadCustomDecks());
  const [builderOpen, setBuilderOpen] = useState(false);
  const [p1DeckId, setP1DeckId] = useState("");
  const [p2DeckId, setP2DeckId] = useState("");
  // A side's card list: a chosen custom deck, else the two-core pairing.
  const resolveDeckCards = (deckId: string, coreA: string, coreB: string): string[] => {
    const custom = deckId ? customDecks.find((d) => d.id === deckId) : undefined;
    return custom ? custom.cards : pairingCards(coreA, coreB);
  };
  const deckLabel = (deckId: string, coreA: string, coreB: string): string => {
    const custom = deckId ? customDecks.find((d) => d.id === deckId) : undefined;
    return custom ? custom.name : `${coreById(coreA).name} + ${coreById(coreB).name}`;
  };

  // The human who must act right now (null while an AI acts or a phase
  // animates). `view` holds the last active human so the hand/pools/labels
  // don't flicker between turns; in vs-AI mode it's always P1.
  const me = started ? needsInput(game) : null;
  const [viewSide, setViewSide] = useState<PlayerId>("P1");
  useEffect(() => {
    if (me) setViewSide(me);
  }, [me]);
  const view: PlayerId = me ?? viewSide;

  // Auto-advance whenever the engine doesn't need P1's input (once started).
  useEffect(() => {
    if (!started || game.phase === "gameover" || needsP1Input(game)) return;
    const delay = game.phase === "battle" ? 480 : 260;
    const t = setTimeout(() => setGame((g) => advance(g)), delay);
    return () => clearTimeout(t);
  }, [game, started]);

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
    const actor = needsInput(game);
    if (game.phase === "prep" && actor)
      setHint(
        `<b>${twoPlayer ? `${actor} prep turn` : "Your prep turn"}.</b> Click a glowing hand card to summon (any number), move one board card, then Pass.`,
      );
    else if (game.phase === "prep") setHint("Opponent has priority…");
    else if (game.battle?.awaitingInput) {
      const card = game.cards[game.battle.awaitingInput];
      const def = getDef(card.defId);
      setHint(
        `<b>${def.name} is up${twoPlayer ? ` (${card.owner})` : ""}.</b> Choose Basic, Special, or Skip.`,
      );
    }
  }, [phaseKey, game, twoPlayer]);

  function dispatch(intent: Intent) {
    try {
      setGame(applyIntent(game, intent));
      setSel(null);
      setPending(null);
      setPicks([]);
    } catch (e) {
      setHint(`⚠ ${(e as Error).message}`);
    }
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
    dispatch({
      type: "BATTLE_ACTION",
      player: awaitingId ? game.cards[awaitingId].owner : view,
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

    // Summon placement — a hand card is armed; empty Home slots summon, but
    // clicking an occupied slot inspects that card instead.
    if (me && game.phase === "prep" && game.prep?.priority === me && sel?.kind === "hand") {
      if (clicked) {
        setDetailId(clicked.instanceId);
      } else if (canSummon(game, me, sel.handId, col).ok && row === homeRow(me)) {
        dispatch({ type: "SUMMON", player: me, handId: sel.handId, col });
        setHint("Summoned. Keep going, or <b>Pass Priority</b>.");
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

  return (
    <div className="wrap">
      <PhaseRibbon game={game} />

      <div className="rail">
        <div className="rail-title">Battle Log</div>
        <div className="loglist">
          {game.log.slice(-40).map((l, i) => (
            <div key={i} className={l.includes("(P1)") ? "me" : ""}>
              {l}
            </div>
          ))}
        </div>
      </div>

      <Board
        game={game}
        legalSlots={legalSlots}
        legalTargetIds={legalTargetIds}
        pickCounts={picks.reduce<Record<string, number>>((acc, id) => {
          acc[id] = (acc[id] ?? 0) + 1;
          return acc;
        }, {})}
        hasSelection={sel !== null}
        selectedId={sel?.kind === "card" ? sel.instanceId : null}
        actingId={awaitingId}
        grayTeam={
          // On your prep turn (nothing armed), dim the idle opponent's team so
          // it's clear whose move it is. A live selection uses the normal glow/dim.
          game.phase === "prep" && me !== null && game.prep?.priority === me && sel === null
            ? enemyOf(me)
            : null
        }
        viewPlayer={view}
        onSlotClick={onSlotClick}
        onCycleAuto={onCycleAuto}
      />

      <SpeedQueue game={game} />

      <div className={`bottom${!myPrep && activeCard === null ? " compact" : ""}`}>
        <ResourcePool game={game} player={view} />

        <div className="handcol">
        {activeCard && activeDef ? (
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
                className={`bbtn ${pending === "basic" ? "armed" : ""}`}
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
                  className="bbtn"
                  disabled={!talentCheck.ok}
                  title={`${activeDef.talent.name} (Talent, free · once per game): ${activeDef.talent.text}`}
                  onClick={() => dispatch({ type: "BATTLE_ACTION", player: activeCard.owner, action: "talent" })}
                >
                  ★ {activeDef.talent.name}
                </button>
              )}
              <button
                className="bbtn"
                onClick={() => dispatch({ type: "BATTLE_ACTION", player: activeCard.owner, action: "skip" })}
              >
                Skip
              </button>
            </div>
            {!specialCheck.ok && activeDef.special && (
              <div className="bp-text">
                Special unavailable: {"reason" in specialCheck ? specialCheck.reason : ""}
              </div>
            )}
          </div>
        ) : (
          <Hand
            game={game}
            player={view}
            selectedHandId={sel?.kind === "hand" ? sel.handId : null}
            onPick={onPickHand}
          />
        )}
        </div>

        <div className="controls">
          {me && game.phase === "prep" && (
            <SpellTray
              game={game}
              player={me}
              armedSpellId={sel?.kind === "spell" ? sel.spellId : null}
              myTurn={myPrep}
              onPick={onPickSpell}
            />
          )}
          <div className="hint" dangerouslySetInnerHTML={{ __html: hint }} />
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

      {game.pendingFlow && game.cards[game.pendingFlow] && (
        <div className="overlay">
          <div className="modal flow-modal">
            <h1>Flow Change</h1>
            <p>
              <b>{getDef(game.cards[game.pendingFlow].defId).name}</b> flows into being —
              choose its boost for this turn.
            </p>
            <div className="flow-opts">
              {(["water", "ice", "steam"] as const).map((mode) => {
                const multiHit = liquidGivesHit(game.cards[game.pendingFlow!]);
                const blurb =
                  mode === "water" && multiHit ? "+1 hit" : FLOW_MODES[mode].blurb;
                return (
                  <button
                    key={mode}
                    className={`flow-opt flow-${mode}`}
                    onClick={() => {
                      const card = game.cards[game.pendingFlow!];
                      dispatch({ type: "FLOW_CHANGE", player: card.owner, instanceId: card.instanceId, mode });
                    }}
                  >
                    <span className="flow-label">{FLOW_MODES[mode].label}</span>
                    <span className="flow-blurb">{blurb}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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

      <WinScreen
        game={game}
        onNewGame={() => {
          setStarted(false); // back to the deck picker
          setSel(null);
          setPending(null);
          setMullToss([]);
        }}
      />

      {!started && (
        <div className="overlay">
          <div className="modal picker">
            {/* Left: the menu options, stacked vertically. */}
            <div className="picker-menu">
              <h1>War Element</h1>
              <p>
                {twoPlayer
                  ? "Two players share this device — hand it back and forth each turn."
                  : "Choose the decks, then start. You play P1."}
              </p>
              <div className="mode-toggle">
                <button
                  className={`mode-btn ${!twoPlayer ? "on" : ""}`}
                  onClick={() => setTwoPlayer(false)}
                >
                  🤖 vs AI
                </button>
                <button
                  className={`mode-btn ${twoPlayer ? "on" : ""}`}
                  onClick={() => setTwoPlayer(true)}
                >
                  👥 2 Players
                </button>
              </div>
              <div className="pick-field">
                <span>{twoPlayer ? "Player 1 deck" : "Your deck (P1)"}</span>
                <select
                  className="deck-src"
                  value={p1DeckId}
                  onChange={(e) => { setP1DeckId(e.target.value); setViewDeck("p1"); }}
                >
                  <option value="">Core pairing ↓</option>
                  {customDecks.map((d) => (
                    <option key={d.id} value={d.id}>★ {d.name} ({d.cards.length})</option>
                  ))}
                </select>
                {!p1DeckId && (
                  <div className="core-pair">
                    <select
                      value={p1CoreA}
                      onChange={(e) => { setP1CoreA(e.target.value); setViewDeck("p1"); }}
                    >
                      {CORES.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.element})</option>
                      ))}
                    </select>
                    <select
                      value={p1CoreB}
                      onChange={(e) => { setP1CoreB(e.target.value); setViewDeck("p1"); }}
                    >
                      {CORES.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.element})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="pick-field">
                <span>{twoPlayer ? "Player 2 deck" : "Opponent deck (P2 · AI)"}</span>
                <select
                  className="deck-src"
                  value={p2DeckId}
                  onChange={(e) => { setP2DeckId(e.target.value); setViewDeck("p2"); }}
                >
                  <option value="">Core pairing ↓</option>
                  {customDecks.map((d) => (
                    <option key={d.id} value={d.id}>★ {d.name} ({d.cards.length})</option>
                  ))}
                </select>
                {!p2DeckId && (
                  <div className="core-pair">
                    <select
                      value={p2CoreA}
                      onChange={(e) => { setP2CoreA(e.target.value); setViewDeck("p2"); }}
                    >
                      {CORES.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.element})</option>
                      ))}
                    </select>
                    <select
                      value={p2CoreB}
                      onChange={(e) => { setP2CoreB(e.target.value); setViewDeck("p2"); }}
                    >
                      {CORES.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.element})</option>
                      ))}
                    </select>
                  </div>
                )}
                <button className="ghost db-open" onClick={() => setBuilderOpen(true)}>
                  🛠 Build / edit custom decks
                </button>
              </div>
              <button
                className="lockin"
                onClick={() => {
                  const humans: PlayerId[] = twoPlayer ? ["P1", "P2"] : ["P1"];
                  const p1Cards = resolveDeckCards(p1DeckId, p1CoreA, p1CoreB);
                  const p2Cards = resolveDeckCards(p2DeckId, p2CoreA, p2CoreB);
                  setGame(createInitialState(newSeed(), p1Cards, p2Cards, humans));
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
            </div>

            {/* Right: the deck view — cards of the selected deck. */}
            <div className="picker-view">
              <div className="pv-tabs">
                <button
                  className={`pv-tab ${viewDeck === "p1" ? "on" : ""}`}
                  onClick={() => setViewDeck("p1")}
                >
                  P1 · {deckLabel(p1DeckId, p1CoreA, p1CoreB)}
                </button>
                <button
                  className={`pv-tab ${viewDeck === "p2" ? "on" : ""}`}
                  onClick={() => setViewDeck("p2")}
                >
                  P2 · {deckLabel(p2DeckId, p2CoreA, p2CoreB)}
                </button>
              </div>
              {(() => {
                const cards =
                  viewDeck === "p1"
                    ? resolveDeckCards(p1DeckId, p1CoreA, p1CoreB)
                    : resolveDeckCards(p2DeckId, p2CoreA, p2CoreB);
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
                              <span className="el-dot" style={{ background: EL_COLOR[d.element] }} />
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
          // Drop a side's selection if its custom deck was deleted.
          if (p1DeckId && !decks.some((d) => d.id === p1DeckId)) setP1DeckId("");
          if (p2DeckId && !decks.some((d) => d.id === p2DeckId)) setP2DeckId("");
        }}
      />
    </div>
  );
}

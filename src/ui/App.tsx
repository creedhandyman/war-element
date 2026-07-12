import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState, Intent, Pos } from "../engine";
import {
  advance,
  applyIntent,
  canFireSpecial,
  canMove,
  canSummon,
  cardAt,
  createInitialState,
  DECKS,
  getDef,
  legalMoves,
  needsP1Input,
  validAllyTargets,
  validSpecialTargets,
  validTargets,
} from "../engine";
import { Board } from "./Board";
import { CardDetail } from "./CardDetail";
import { Hand } from "./Hand";
import { PhaseRibbon } from "./PhaseRibbon";
import { ResourcePool } from "./ResourcePool";
import { SpeedQueue } from "./SpeedQueue";
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
  const [p1Deck, setP1Deck] = useState("gale_bolt");
  const [p2Deck, setP2Deck] = useState("aqua_dawn");

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
    if (game.phase === "prep" && game.prep?.priority === "P1")
      setHint(
        "<b>Your prep turn.</b> Click a glowing hand card to summon (any number), move one board card, then Pass.",
      );
    else if (game.phase === "prep") setHint("Opponent has priority…");
    else if (game.battle?.awaitingInput) {
      const def = getDef(game.cards[game.battle.awaitingInput].defId);
      setHint(`<b>${def.name} is up.</b> Choose Basic, Special, or Skip.`);
    }
  }, [phaseKey, game]);

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
    if (sel?.kind === "hand") {
      const out: Pos[] = [];
      for (let col = 0; col < 4; col++)
        if (canSummon(game, "P1", sel.handId, col).ok)
          out.push({ row: 3, col } as Pos);
      return out;
    }
    if (sel?.kind === "card") return legalMoves(game, "P1", sel.instanceId);
    return [];
  }, [game, sel]);

  const awaitingId = game.battle?.awaitingInput ?? null;
  const legalTargetIds: string[] = useMemo(() => {
    if (!awaitingId || !pending) return [];
    if (pending === "special") {
      const def = getDef(game.cards[awaitingId].defId);
      if (!def.special) return [];
      const list =
        def.special.targetSide === "ally"
          ? validAllyTargets(game, awaitingId)
          : validSpecialTargets(game, awaitingId);
      return list.map((t) => t.instanceId);
    }
    return validTargets(game, awaitingId).map((t) => t.instanceId);
  }, [game, awaitingId, pending]);

  // ── interactions ──────────────────────────────────────────────────────────
  function onPickHand(handId: string) {
    if (game.phase !== "prep" || game.prep?.priority !== "P1") {
      setHint("You can summon during your prep priority turn.");
      return;
    }
    const def = getDef(game.players.P1.hand.find((h) => h.handId === handId)!.defId);
    if (def.cost > game.players.P1.summonPool) {
      setHint(`⚠ Not enough summon resources for ${def.name} (cost ${def.cost}).`);
      return;
    }
    setSel({ kind: "hand", handId });
    setHint(`Summoning <b>${def.name}</b> — tap a glowing Home slot.`);
  }

  // Max target picks for the armed action. Basics: assign each of the card's
  // hits (repeats stack). Specials: the `targets` param, but capped at how many
  // valid targets actually exist — a "hit all" sentinel (99) never means "click
  // 99 times", it means "everyone in range".
  const maxPicks = (() => {
    if (!awaitingId || !pending) return 1;
    const def = getDef(game.cards[awaitingId].defId);
    if (pending === "basic") return def.hits;
    const cap = Number(def.special?.params?.targets ?? 1);
    return Math.max(1, Math.min(cap, legalTargetIds.length));
  })();

  function firePicks(finalPicks: string[]) {
    dispatch({
      type: "BATTLE_ACTION",
      player: "P1",
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

    // Summon placement — a hand card is armed; empty Home slots summon, but
    // clicking an occupied slot inspects that card instead.
    if (game.phase === "prep" && game.prep?.priority === "P1" && sel?.kind === "hand") {
      if (clicked) {
        setDetailId(clicked.instanceId);
      } else if (canSummon(game, "P1", sel.handId, col).ok && row === 3) {
        dispatch({ type: "SUMMON", player: "P1", handId: sel.handId, col });
        setHint("Summoned. Keep going, or <b>Pass Priority</b>.");
      } else {
        setHint(`⚠ ${canSummon(game, "P1", sel.handId, col).reason ?? "Home row only."}`);
      }
      return;
    }

    // Move destination — a board card is armed; empty green slots complete the
    // move, clicking a card opens its detail (its Move button re-arms it).
    if (game.phase === "prep" && game.prep?.priority === "P1" && sel?.kind === "card") {
      if (clicked) {
        setDetailId(clicked.instanceId);
        return;
      }
      const check = canMove(game, "P1", sel.instanceId, { row, col } as Pos);
      if (check.ok) {
        dispatch({ type: "MOVE", player: "P1", instanceId: sel.instanceId, to: { row, col } as Pos });
        setHint("Moved (one move per turn). Summon more, or <b>Pass Priority</b>.");
      } else {
        setHint(`⚠ ${check.reason}`);
        setSel(null);
      }
      return;
    }

    // Default: click any played card to inspect its art, stats, and abilities.
    if (clicked) setDetailId(clicked.instanceId);
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
    const order = ["manual", "basic", "full"] as const;
    const cur = game.cards[instanceId]?.autoMode ?? "manual";
    const mode = order[(order.indexOf(cur) + 1) % 3];
    dispatch({ type: "SET_AUTO", player: "P1", instanceId, mode });
  }

  function setGlobalAuto(mode: "manual" | "basic" | "full") {
    let next = game;
    for (const c of Object.values(game.cards)) {
      if (c.owner === "P1" && c.pos)
        next = applyIntent(next, { type: "SET_AUTO", player: "P1", instanceId: c.instanceId, mode });
    }
    setGame(next);
  }

  // ── mulligan ──────────────────────────────────────────────────────────────
  const inMulligan = started && game.phase === "mulligan" && !game.players.P1.mulliganDone;

  // ── battle prompt ─────────────────────────────────────────────────────────
  const activeCard = awaitingId ? game.cards[awaitingId] : null;
  const activeDef = activeCard ? getDef(activeCard.defId) : null;
  const specialCheck = awaitingId ? canFireSpecial(game, awaitingId) : { ok: false };
  const basicOk = awaitingId ? validTargets(game, awaitingId).length > 0 : false;

  const myPrep = game.phase === "prep" && game.prep?.priority === "P1";

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
        onSlotClick={onSlotClick}
        onCycleAuto={onCycleAuto}
      />

      <SpeedQueue game={game} />

      <div className="bottom">
        <ResourcePool game={game} />

        {activeCard && activeDef ? (
          <div className="bprompt">
            <div className="bp-title">
              {activeDef.name} is up{" "}
              <small>
                ⚔{activeDef.hits > 1 ? `${activeDef.hits}×` : ""}
                {activeDef.dmg} · {activeDef.attackType}
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
                    activeDef.hits > 1
                      ? `Basic attack: <b>${activeDef.hits} hits × ${activeDef.dmg} DMG</b> — click up to ${activeDef.hits} glowing targets (repeat one to stack).`
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
                  if (pending === "special" && picks.length > 0) {
                    firePicks(picks);
                    return;
                  }
                  const spec = activeDef.special!;
                  const valid =
                    spec.targetSide === "ally"
                      ? validAllyTargets(game, awaitingId!)
                      : validSpecialTargets(game, awaitingId!);
                  const cap = Number(spec.params?.targets ?? 1);
                  // No choice to make (hits everyone it can reach, or only one
                  // legal target) → fire immediately on all of them.
                  if (cap >= valid.length) {
                    dispatch({
                      type: "BATTLE_ACTION",
                      player: "P1",
                      action: "special",
                      targetIds: valid.map((t) => t.instanceId),
                    });
                    return;
                  }
                  setPending("special");
                  setPicks([]);
                  setHint(
                    `<b>${spec.name}</b> (cost ${spec.cost}) — pick up to ${cap} glowing target${cap > 1 ? "s (repeat to stack), or Fire early" : ""}.`,
                  );
                }}
              >
                {pending === "special" && picks.length > 0
                  ? `🔥 Fire (${picks.length}/${maxPicks})`
                  : `✦ Special${activeDef.special ? ` (${activeDef.special.cost})` : ""}`}
              </button>
              <button
                className="bbtn"
                onClick={() => dispatch({ type: "BATTLE_ACTION", player: "P1", action: "skip" })}
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
            selectedHandId={sel?.kind === "hand" ? sel.handId : null}
            onPick={onPickHand}
          />
        )}

        <div className="controls">
          <div className="hint" dangerouslySetInnerHTML={{ __html: hint }} />
          <div className="ctl-row">
            <div className="pass-dots" title="Two consecutive passes → Battle">
              <span className={`pd ${(game.prep?.consecutivePasses ?? 0) >= 1 ? "on" : ""}`} />
              <span className={`pd ${(game.prep?.consecutivePasses ?? 0) >= 2 ? "on" : ""}`} />
            </div>
            {myPrep && (
              <span className={`mv ${game.prep?.movedThisTurn ? "used" : ""}`}>
                {game.prep?.movedThisTurn ? "Move: used" : "Move: available"}
              </span>
            )}
            <select
              className="ghost"
              title="Set every one of your board cards' auto mode"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) setGlobalAuto(e.target.value as never);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                Auto: all…
              </option>
              <option value="manual">All Manual</option>
              <option value="basic">All Auto-Basic</option>
              <option value="full">All Full-Auto</option>
            </select>
            <button
              className="ghost"
              onClick={() => {
                setSel(null);
                setPending(null);
                setPicks([]);
                setSurrenderArmed(false);
              }}
            >
              Clear
            </button>
            {game.win === null && (
              <button
                className={`ghost ${surrenderArmed ? "warn" : ""}`}
                title="Concede the match"
                onClick={() => {
                  if (surrenderArmed) {
                    dispatch({ type: "SURRENDER", player: "P1" });
                    setSurrenderArmed(false);
                  } else {
                    setSurrenderArmed(true);
                    setHint("⚠ Surrender? Click again to confirm, or Clear to cancel.");
                  }
                }}
              >
                {surrenderArmed ? "Confirm surrender?" : "Surrender"}
              </button>
            )}
            <button
              className="lockin"
              disabled={!myPrep}
              onClick={() => dispatch({ type: "PASS", player: "P1" })}
            >
              {myPrep ? "Pass Priority" : "Waiting…"}
            </button>
          </div>
        </div>
      </div>

      {inMulligan && (
        <div className="overlay">
          <div className="modal">
            <h1>Opening Hand</h1>
            <p>
              Click any cards to send back — you'll reshuffle and redraw to 4. Keeping a
              cheap curve (1–4) makes the early rounds playable.
            </p>
            <div className="mull-cards">
              {game.players.P1.hand.map((h) => {
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
                      src={`/cards/${def.id}.png`}
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
                      <span>👟{def.sp}</span>
                    </div>
                    <div className="hc-class">{def.cardClass}</div>
                  </div>
                );
              })}
            </div>
            <button
              className="lockin"
              onClick={() => {
                dispatch({ type: "MULLIGAN", player: "P1", returnHandIds: mullToss });
                setMullToss([]);
              }}
            >
              {mullToss.length > 0 ? `Return ${mullToss.length} & Redraw` : "Keep Hand"}
            </button>
          </div>
        </div>
      )}

      {detailId && game.cards[detailId] && (
        <CardDetail
          game={game}
          card={game.cards[detailId]}
          canMove={
            game.cards[detailId].owner === "P1" &&
            game.phase === "prep" &&
            game.prep?.priority === "P1" &&
            !game.prep.movedThisTurn &&
            legalMoves(game, "P1", detailId).length > 0
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
          <div className="modal">
            <h1>War Element</h1>
            <p>Choose the decks, then start the match. You play the left deck (P1).</p>
            <div className="deck-picker">
              <label>
                <span>Your deck (P1)</span>
                <select value={p1Deck} onChange={(e) => setP1Deck(e.target.value)}>
                  {DECKS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <span className="vs">vs</span>
              <label>
                <span>Opponent (P2 · AI)</span>
                <select value={p2Deck} onChange={(e) => setP2Deck(e.target.value)}>
                  {DECKS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="lockin"
              onClick={() => {
                setGame(createInitialState(newSeed(), p1Deck, p2Deck));
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
        </div>
      )}
    </div>
  );
}

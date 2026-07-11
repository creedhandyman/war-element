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
  getDef,
  legalMoves,
  needsP1Input,
  validAllyTargets,
  validTargets,
} from "../engine";
import { Board } from "./Board";
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
  const [hint, setHint] = useState<string>(
    "Mulligan: click cards to send back, then confirm.",
  );
  const [mullToss, setMullToss] = useState<string[]>([]);

  // Auto-advance whenever the engine doesn't need P1's input.
  useEffect(() => {
    if (game.phase === "gameover" || needsP1Input(game)) return;
    const delay = game.phase === "battle" ? 480 : 260;
    const t = setTimeout(() => setGame((g) => advance(g)), delay);
    return () => clearTimeout(t);
  }, [game]);

  // Keep the hint fresh on phase/priority flips.
  const phaseKey = `${game.phase}:${game.prep?.priority ?? ""}:${game.battle?.awaitingInput ?? ""}`;
  const prevPhaseKey = useRef(phaseKey);
  useEffect(() => {
    if (prevPhaseKey.current === phaseKey) return;
    prevPhaseKey.current = phaseKey;
    setSel(null);
    setPending(null);
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
          : validTargets(game, awaitingId);
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
    if (def.cost > game.players.P1.pool) {
      setHint(`⚠ Not enough resources for ${def.name} (cost ${def.cost}).`);
      return;
    }
    setSel({ kind: "hand", handId });
    setHint(`Summoning <b>${def.name}</b> — tap a glowing Home slot.`);
  }

  function onSlotClick(row: number, col: number) {
    const clicked = cardAt(game, row, col);

    // Battle-phase target pick
    if (awaitingId && pending) {
      if (clicked && legalTargetIds.includes(clicked.instanceId)) {
        dispatch({
          type: "BATTLE_ACTION",
          player: "P1",
          action: pending,
          targetId: clicked.instanceId,
        });
      } else {
        setHint("⚠ Not a legal target — glowing cards only.");
      }
      return;
    }

    if (game.phase !== "prep" || game.prep?.priority !== "P1") return;

    // Summon placement
    if (sel?.kind === "hand") {
      if (canSummon(game, "P1", sel.handId, col).ok && row === 3) {
        dispatch({ type: "SUMMON", player: "P1", handId: sel.handId, col });
        setHint("Summoned. Keep going, or <b>Pass Priority</b>.");
      } else {
        setHint(`⚠ ${canSummon(game, "P1", sel.handId, col).reason ?? "Home row only."}`);
      }
      return;
    }

    // Move
    if (sel?.kind === "card") {
      if (clicked?.owner === "P1") {
        setSel({ kind: "card", instanceId: clicked.instanceId }); // reselect
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

    // Select own card to move
    if (clicked?.owner === "P1") {
      if (game.prep?.movedThisTurn) {
        setHint("⚠ Already moved a card this turn. Summon or Pass.");
        return;
      }
      setSel({ kind: "card", instanceId: clicked.instanceId });
      setHint(
        `Moving <b>${getDef(clicked.defId).name}</b> — green slots are in reach.`,
      );
    }
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
  const inMulligan = game.phase === "mulligan" && !game.players.P1.mulliganDone;

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
                ⚔{activeDef.dmg}
                {activeDef.hits > 1 ? `×${activeDef.hits}` : ""} · {activeDef.attackType}
              </small>
            </div>
            <div className="bp-actions">
              <button
                className={`bbtn ${pending === "basic" ? "armed" : ""}`}
                disabled={!basicOk}
                onClick={() => {
                  setPending("basic");
                  setHint("Pick a glowing target for the basic attack.");
                }}
              >
                ⚔ Basic Attack
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
                  setPending("special");
                  setHint(
                    `<b>${activeDef.special!.name}</b> (cost ${activeDef.special!.cost}) — pick a glowing target.`,
                  );
                }}
              >
                ✦ Special{activeDef.special ? ` (${activeDef.special.cost})` : ""}
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
              }}
            >
              Clear
            </button>
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
              Click any cards to send back — you'll reshuffle and redraw to 5. Keeping a
              cheap curve (1–4) makes the early rounds playable.
            </p>
            <div className="mull-cards">
              {game.players.P1.hand.map((h) => {
                const def = getDef(h.defId);
                const toss = mullToss.includes(h.handId);
                return (
                  <div
                    key={h.handId}
                    className={`mull-card ${toss ? "toss" : ""}`}
                    onClick={() =>
                      setMullToss((cur) =>
                        toss ? cur.filter((x) => x !== h.handId) : [...cur, h.handId],
                      )
                    }
                  >
                    <div className="hc-top">
                      <div className="hc-cost">{def.cost}</div>
                      <span className="el-dot" style={{ background: EL_COLOR[def.element] }} />
                    </div>
                    <div className="hc-name">{def.name}</div>
                    <div className="hc-stats">
                      <span>⚔{def.dmg}{def.hits > 1 ? `×${def.hits}` : ""}</span>
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

      <WinScreen
        game={game}
        onNewGame={() => {
          setGame(createInitialState(newSeed()));
          setSel(null);
          setPending(null);
          setMullToss([]);
          setHint("Mulligan: click cards to send back, then confirm.");
        }}
      />
    </div>
  );
}

/** ONE SMALL LINE, ONLY WHEN THE PLAYER IS STUCK (rules in ui/struggle.ts).
 *
 *  Replaces the in-match coach that explained summoning, income, moving and
 *  speed one card at a time whether the player needed it or not (owner,
 *  2026-10-04: "a pop-up for every single thing you do"). This shows nothing
 *  until the board says the player is struggling, says one line about that, and
 *  goes: an idle tip the moment the player acts, any other after a few seconds
 *  or on ✕. Never more than TIPS_PER_MATCH board tips in one match. */
import { useEffect, useRef, useState } from "react";
import { needsInput, type GameState, type PlayerId } from "../engine";
import { useCoachDock } from "./coach-dock";
import { TEACHER_ART } from "./shared";
import {
  IDLE_TIPS, TIPS, TIPS_PER_MATCH, boardStruggle, freshMemory, idleTipFor, tipLeft, type TipId,
} from "./struggle";

/** On your own turn: this long without a tap brings the idle tip, or this long
 *  without the game moving at all, taps or not (tapping around is also lost). */
const IDLE_NO_TAP_MS = 25_000;
const IDLE_NO_MOVE_MS = 45_000;
/** How long a board tip stays up unless closed. */
const SHOW_MS = 12_000;

export function StruggleTip(props: {
  game: GameState;
  /** The local player's seat. */
  seat: PlayerId;
  taught: readonly string[];
  /** Something is selected, armed or waiting on Confirm: the player is part
   *  way through a move, and the screen already shows the next tap. No idle
   *  tip then — "tap a card in your hand" would be the wrong advice. */
  midAction: boolean;
  /** A tip was shown: record it (`tipMark`). */
  onShown: (id: TipId) => void;
  /** "No more tips": the same switch the old coach's Skip all set. */
  onOff: () => void;
}) {
  const { game, seat } = props;
  const [tip, setTip] = useState<TipId | null>(null);
  const prev = useRef<GameState | null>(null);
  const mem = useRef(freshMemory());
  const boardTips = useRef(0);
  const idleSeen = useRef(new Set<TipId>());
  const lastTap = useRef(Date.now());
  const taught = useRef(props.taught);
  taught.current = props.taught;

  const show = (id: TipId) => {
    if (!tipLeft(taught.current, id)) return;
    setTip(id);
    props.onShown(id);
  };

  // Any tap anywhere is the player doing something.
  useEffect(() => {
    const on = () => { lastTap.current = Date.now(); };
    window.addEventListener("pointerdown", on, true);
    return () => window.removeEventListener("pointerdown", on, true);
  }, []);

  // THE BOARD SIGNALS, one step at a time. A new match (its mulligan, or the
  // round count going backwards) starts the memory and the counts over, and is
  // never compared against the last match's board.
  useEffect(() => {
    const p = prev.current;
    prev.current = game;
    // The game moved: whatever idle tip was up has been answered.
    setTip((t) => (t && IDLE_TIPS.includes(t) ? null : t));
    if (!p || game.phase === "mulligan" || game.round < p.round) {
      mem.current = freshMemory();
      boardTips.current = 0;
      idleSeen.current = new Set();
      return;
    }
    if (p === game) return;
    const found = boardStruggle(p, game, seat, mem.current);
    if (found && boardTips.current < TIPS_PER_MATCH && tipLeft(taught.current, found)) {
      boardTips.current++;
      show(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // THE IDLE TIMER, restarted every time the game moves while it waits on us.
  // Once per kind per match. Held while a modal is up (a card's own choice, the
  // mulligan): that screen says what it wants, and a line under it about
  // tapping Pass would be wrong.
  const idleId = props.midAction ? null : idleTipFor(game, seat, needsInput(game));
  useEffect(() => {
    if (!idleId || idleSeen.current.has(idleId) || !tipLeft(taught.current, idleId)) return;
    const movedAt = Date.now();
    lastTap.current = movedAt;
    const t = window.setInterval(() => {
      const now = Date.now();
      if (now - lastTap.current < IDLE_NO_TAP_MS && now - movedAt < IDLE_NO_MOVE_MS) return;
      if (document.querySelector(".overlay .modal")) return;
      window.clearInterval(t);
      idleSeen.current.add(idleId);
      show(idleId);
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, idleId]);

  // Starting a move answers an idle tip as surely as finishing one.
  useEffect(() => {
    if (props.midAction) setTip((t) => (t && IDLE_TIPS.includes(t) ? null : t));
  }, [props.midAction]);

  // A board tip has its moment and goes.
  useEffect(() => {
    if (!tip || IDLE_TIPS.includes(tip)) return;
    const t = window.setTimeout(() => setTip(null), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [tip]);

  // AT THE TOP, under the phase ribbon. Docked above the hand it sat on the
  // player's own Home row — the squares "tap a square on your Home row" means.
  // The top covers the enemy's back row at most, which matters least while
  // the player is placing and moving.
  const { topGap } = useCoachDock([tip, game.phase, game.battle?.awaitingInput]);
  if (!tip || game.phase === "gameover") return null;
  return (
    <div className="struggle-tip" role="status" style={topGap > 0 ? { top: topGap } : undefined}>
      <img className="struggle-face" src={TEACHER_ART} alt="" draggable={false}
        onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <div className="struggle-say">
        <p>{TIPS[tip].text}</p>
        <button className="struggle-off" onClick={() => { setTip(null); props.onOff(); }}>No more tips</button>
      </div>
      <button className="struggle-x" aria-label="Close tip" onClick={() => setTip(null)}>✕</button>
    </div>
  );
}

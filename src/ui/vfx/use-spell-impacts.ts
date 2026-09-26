/** Every spell's effect on the board, found by comparing two game states —
 *  what each one looks like is decided in spell-fx.ts; this finds WHEN.
 *
 *  The engine's log is prose, so there is no "spell X did Y" event to listen
 *  for. The signal is a DIFF instead: a state update in which a spell became
 *  used, read for everything it changed (spell-fx.ts), plus any trap that went
 *  off under a card. That is exact, not a heuristic, because the engine
 *  applies one intent per step — `phases.ts` runs the AI's prep one
 *  `aiPrepIntent` at a time, and a human cast is one dispatch — so a
 *  transition that spends a spell carries that spell's effects and nothing
 *  else. It also means the same code serves the player, the AI and an online
 *  opponent, with nothing threaded through the engine.
 *
 *  HELD WHILE A FLASH IS UP. A human cast flashes the spell's art for two
 *  seconds and THEN resolves, so its hit lands on a clear screen. The AI's
 *  cast is the other way round: the state arrives first and the flash is shown
 *  after, on top of it — an impact fired then would play, in full, underneath
 *  the art. So effects queue while `hold` is true and fire the moment it clears.
 */
import { useEffect, useRef } from "react";
import type { GameState, PlayerId } from "../../engine";
import type { ImpactLayer, Rect } from "./impact-layer";
import { battleAction, battleEffects, boardSpell, spellEffects, trapsSprung, type At, type BoardFx, type SpellFx } from "./spell-fx";

let layer: Promise<ImpactLayer> | null = null;
/** The Pixi chunk, fetched once. Called at match start, so the first hit of
 *  the game is on time rather than a network round-trip late. */
function loadLayer(): Promise<ImpactLayer> {
  layer ??= import("./impact-layer").then((m) => m.createImpactLayer());
  return layer;
}

function effectsOn(): boolean {
  // prefers-reduced-motion switches the whole layer off, not down: a softer
  // burst is still a flash at the edge of someone's vision.
  if (typeof window === "undefined") return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// ── From board squares to screen rectangles ────────────────────────────────
// `data-pos` is the LOGICAL square, so every lookup is right for a P2 viewer
// whose board is drawn flipped.
const toRect = (r: DOMRect): Rect => ({ x: r.left, y: r.top, w: r.width, h: r.height });

function squareRect(at: At): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-pos="${at.row},${at.col}"]`);
  return el ? toRect(el.getBoundingClientRect()) : null;
}

function rowRect(row: number): Rect | null {
  const cells = [...document.querySelectorAll<HTMLElement>(`[data-pos^="${row},"]`)].map((e) => e.getBoundingClientRect());
  if (cells.length === 0) return null;
  const x = Math.min(...cells.map((c) => c.left)), y = Math.min(...cells.map((c) => c.top));
  const right = Math.max(...cells.map((c) => c.right)), bottom = Math.max(...cells.map((c) => c.bottom));
  return { x, y, w: right - x, h: bottom - y };
}

function boardRect(): Rect | null {
  const el = document.querySelector<HTMLElement>(".board");
  return el ? toRect(el.getBoundingClientRect()) : null;
}

/** A whole-board spell's screen geometry: the board, the cards it reaches,
 *  and which edge the caster's side is drawn on (it flips for a P2 viewer). */
function boardGeometry(fx: BoardFx) {
  const rect = boardRect();
  if (!rect) return null;
  const home = rowRect(fx.casterRow);
  return {
    rect,
    targets: fx.targets.map(squareRect).filter((r): r is Rect => r !== null),
    fromTop: home ? home.y + home.h / 2 < rect.y + rect.h / 2 : false,
  };
}

/** How long a whole-board spell's INCOMING half runs before it lands: the
 *  meteors are in the air, the wave is rolling, the sun is gathering. The AI's
 *  and an online opponent's casts already pause here with their targets lit;
 *  a player's own cast gets this pause for board-wide spells only. */
export const BOARD_INCOMING_MS = 700;

/** The pause a cast between these two states wants before it lands — 0 for
 *  anything but a whole-board spell, or with effects off. */
export function boardIncomingMs(before: GameState, after: GameState): number {
  return effectsOn() && boardSpell(before, after) ? BOARD_INCOMING_MS : 0;
}

/** Play a whole-board spell's INCOMING half, timed to arrive in `ms` — call it
 *  as the pause before the landing begins, with the pause's full length. */
export function playBoardIncoming(before: GameState, after: GameState, ms: number) {
  if (!effectsOn() || ms <= 0) return;
  const fx = boardSpell(before, after);
  if (!fx) return;
  void loadLayer().then((l) => {
    const g = boardGeometry(fx);
    if (g) l.play({ kind: "boardIncoming", ...g, element: fx.element, seconds: ms / 1000, strength: fx.strength });
  });
  // The ground gives warning before the mountain falls: a low rumble through
  // the board for as long as the rocks are in the air.
  const board = document.querySelector<HTMLElement>(".board");
  if (board && fx.element === "BORE") {
    const a = 1.5 * fx.strength;
    const frames = Array.from({ length: 12 }, (_, i) =>
      ({ transform: i === 0 || i === 11 ? "translate(0,0)" : `translate(${rand(-a, a)}px,${rand(-a, a)}px)` }));
    board.animate(frames, { duration: ms, easing: "linear" });
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// ── Card attacks ────────────────────────────────────────────────────────────

/** How long a player's OWN attack takes to deliver before it lands: the wind-
 *  up and the throw, or the lunge. The AI's turns already pause this long with
 *  their targets lit, so theirs fit in the pause they have. */
export const ATTACK_MS = 450;

/** The pause a battle step wants for its delivery — 0 for a step that attacked
 *  nothing, or with effects off. */
export function attackDeliveryMs(before: GameState, after: GameState): number {
  return effectsOn() && battleAction(before, after) ? ATTACK_MS : 0;
}

/** Deliver a battle step's attack, timed to arrive in `ms` — call it as the
 *  pause before the landing begins, with the pause's full length. */
export function playAttack(before: GameState, after: GameState, ms: number) {
  if (!effectsOn() || ms <= 0) return;
  const act = battleAction(before, after);
  if (!act) return;
  const from = squareRect(act.actor);
  const targets = act.targets.map(squareRect).filter((r): r is Rect => r !== null);
  if (!from || targets.length === 0) return;
  void loadLayer().then((l) => l.play({
    kind: "attack", from, targets, element: act.element, melee: act.melee, special: act.special, seconds: ms / 1000,
  }));
  if (act.melee) lunge(act.actor, from, targets, ms);
}

/** A melee card closing the distance: its token draws back, then drives most
 *  of the way to its target — arriving on the landing frame — and returns.
 *  `translate`, not `transform`, so it composes with the attacking token's
 *  own pulsing scale instead of replacing it. */
function lunge(at: At, from: Rect, targets: Rect[], ms: number) {
  const token = document.querySelector<HTMLElement>(`[data-pos="${at.row},${at.col}"] .token`);
  if (!token) return;
  const tx = targets.reduce((s, t) => s + t.x + t.w / 2, 0) / targets.length;
  const ty = targets.reduce((s, t) => s + t.y + t.h / 2, 0) / targets.length;
  const dx = (tx - (from.x + from.w / 2)) * 0.42, dy = (ty - (from.y + from.h / 2)) * 0.42;
  const total = ms + 220;
  const strike = ms / total;
  token.animate(
    [
      { translate: "0px 0px", offset: 0 },
      { translate: `${-dx * 0.1}px ${-dy * 0.1}px`, offset: strike * 0.4 },
      { translate: `${dx}px ${dy}px`, offset: strike },
      { translate: "0px 0px", offset: 1 },
    ],
    { duration: total, easing: "ease-in" },
  );
}

function fire(fx: SpellFx[]) {
  if (fx.length === 0) return;
  void loadLayer().then((l) => {
    let hardest = 0;
    // With a whole-board spell the set piece carries the spectacle: each card's
    // own impact is played at half weight, or three 15-damage hits stack into
    // one white-out that hides the very cards and numbers the player is
    // reading (seen: Volcanic Eruption on three Greegons).
    const boardWide = fx.some((f) => f.kind === "board");
    for (const f of fx) {
      switch (f.kind) {
        case "board": {
          const g = boardGeometry(f);
          if (g) l.play({ kind: "boardFinale", ...g, element: f.element, strength: f.strength });
          hardest = Math.max(hardest, 1 + f.strength);
          break;
        }
        case "hit": {
          const r = squareRect(f.at), a = squareRect(f.from);
          if (!r) break;
          const angle = a ? Math.atan2(r.y - a.y, r.x - a.x) : -Math.PI / 2;
          if (f.melee) l.play({ kind: "slash", rect: r, element: f.element, strength: f.strength, special: f.special, angle });
          else l.impact(r.x + r.w / 2, r.y + r.h / 2, f.element, f.strength);
          // Only a Special shakes the board: a basic attack happens every turn.
          if (f.special) hardest = Math.max(hardest, f.strength);
          break;
        }
        case "impact":
        case "trapSprung": {
          const r = squareRect(f.at);
          if (!r) break;
          const k = f.kind === "impact" ? f.strength * (boardWide ? 0.5 : 1) : 1.2;
          l.impact(r.x + r.w / 2, r.y + r.h / 2, f.element, k);
          hardest = Math.max(hardest, k);
          break;
        }
        case "move": {
          const from = squareRect(f.from), to = squareRect(f.to);
          if (from && to) l.play({ kind: "move", from, to, element: f.element });
          break;
        }
        case "wall": {
          const r = rowRect(f.row);
          if (r) l.play({ kind: "wall", rect: r, element: f.element });
          break;
        }
        case "pulse": {
          const r = rowRect(f.row);
          if (r) l.play({ kind: "pulse", rect: r, element: f.element });
          break;
        }
        case "field": {
          const r = boardRect();
          if (r) l.play({ kind: "field", rect: r, element: f.element });
          break;
        }
        default: {
          const r = squareRect(f.at);
          if (r) l.play({ ...f, rect: r } as Parameters<ImpactLayer["play"]>[0]);
        }
      }
    }
    // A short shake on the board itself, once however many squares were hit,
    // and only for a real blow. Web Animations, so it is a compositor-only
    // transform and cannot fight the board's own styles.
    const board = document.querySelector<HTMLElement>(".board");
    if (board && hardest >= 1) {
      // A whole-board spell shakes the whole board harder and for longer.
      const a = 3 + hardest * (boardWide ? 3 : 2);
      board.animate(
        [
          { transform: "translate(0,0)" },
          { transform: `translate(${-a}px,${a * 0.5}px)` },
          { transform: `translate(${a * 0.8}px,${-a * 0.4}px)` },
          { transform: `translate(${-a * 0.4}px,${a * 0.2}px)` },
          { transform: "translate(0,0)" },
        ],
        { duration: boardWide ? 420 : 260, easing: "ease-out" },
      );
    }
  });
}

/** `viewer` is whose screen this is: an opponent's trap placement must never
 *  be drawn (spell-fx.ts). */
export function useSpellImpacts(game: GameState | null, inMatch: boolean, hold: boolean, viewer: PlayerId) {
  const prev = useRef<GameState | null>(null);
  const queued = useRef<SpellFx[]>([]);

  useEffect(() => {
    if (inMatch && effectsOn()) void loadLayer();
  }, [inMatch]);

  useEffect(() => {
    const before = prev.current;
    prev.current = game;
    // Re-baseline, never fire, outside a live match: the finished game object
    // survives into the lobby (see the opponent-flash effect in App.tsx), and
    // a diff taken against it there is against the last match.
    if (!game || !before || !inMatch || game.phase === "mulligan" || !effectsOn()) return;
    const fx = [...spellEffects(before, game, viewer), ...trapsSprung(before, game), ...battleEffects(before, game)];
    if (fx.length === 0) return;
    if (hold) queued.current.push(...fx);
    else fire(fx);
  }, [game, inMatch, hold, viewer]);

  useEffect(() => {
    if (hold || queued.current.length === 0) return;
    const fx = queued.current;
    queued.current = [];
    fire(fx);
  }, [hold]);
}

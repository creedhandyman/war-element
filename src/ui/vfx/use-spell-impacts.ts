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
import { spellEffects, trapsSprung, type At, type SpellFx } from "./spell-fx";

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

function fire(fx: SpellFx[]) {
  if (fx.length === 0) return;
  void loadLayer().then((l) => {
    let hardest = 0;
    for (const f of fx) {
      switch (f.kind) {
        case "impact":
        case "trapSprung": {
          const r = squareRect(f.at);
          if (!r) break;
          const k = f.kind === "impact" ? f.strength : 1.2;
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
      const a = 3 + hardest * 2;
      board.animate(
        [
          { transform: "translate(0,0)" },
          { transform: `translate(${-a}px,${a * 0.5}px)` },
          { transform: `translate(${a * 0.8}px,${-a * 0.4}px)` },
          { transform: `translate(${-a * 0.4}px,${a * 0.2}px)` },
          { transform: "translate(0,0)" },
        ],
        { duration: 260, easing: "ease-out" },
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
    const fx = [...spellEffects(before, game, viewer), ...trapsSprung(before, game)];
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

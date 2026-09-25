/** Which cards a spell just hit, found by comparing two game states.
 *
 *  The engine's log is prose, so there is no "spell X hit card Y" event to
 *  listen for. The signal is a DIFF instead: a state update in which a spell
 *  became used, and in which cards lost HP or shields (or left the board).
 *  That is exact, not a heuristic, because the engine applies one intent per
 *  step — `phases.ts` runs the AI's prep one `aiPrepIntent` at a time, and a
 *  human cast is one dispatch — so a transition that spends a spell carries
 *  that spell's damage and nothing else. It also means the same code serves
 *  the player, the AI and an online opponent, with nothing threaded through
 *  the engine.
 *
 *  HELD WHILE A FLASH IS UP. A human cast flashes the spell's art for two
 *  seconds and THEN resolves, so its hit lands on a clear screen. The AI's
 *  cast is the other way round: the state arrives first and the flash is shown
 *  after, on top of it — an impact fired then would play, in full, underneath
 *  the art. So hits queue while `hold` is true and fire the moment it clears.
 */
import { useEffect, useRef } from "react";
import type { Element, GameState } from "../../engine";
import { seatsOf } from "../../engine/types";
import { getSpell } from "../../engine/spells";
import type { ImpactLayer } from "./impact-layer";

export interface Hit { row: number; col: number; element: Element; strength: number }

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

/** A spell id whose used-count rose between the two states, if any. Counted,
 *  not a set, for the same reason the opponent flash counts: a book can hold
 *  two of one spell, and the second cast must still register. */
function freshSpell(before: GameState, after: GameState): string | null {
  const count = (g: GameState) => {
    const m = new Map<string, number>();
    for (const p of seatsOf(g))
      for (const sl of g.players[p]?.spellbook ?? [])
        if (sl.used) m.set(sl.defId, (m.get(sl.defId) ?? 0) + 1);
    return m;
  };
  const was = count(before);
  for (const [id, n] of count(after)) if (n > (was.get(id) ?? 0)) return id;
  return null;
}

/** The squares a spell hit between two states — none unless a spell was
 *  spent in that transition. Pure, and exported for spell-impacts.test.ts. */
export function spellHits(before: GameState, after: GameState): Hit[] {
  const spellId = freshSpell(before, after);
  return spellId ? hitsOf(before, after, getSpell(spellId).element) : [];
}

function hitsOf(before: GameState, after: GameState, element: Element): Hit[] {
  const hits: Hit[] = [];
  for (const [id, was] of Object.entries(before.cards)) {
    if (!was.pos) continue;
    const now = after.cards[id];
    const lost = was.curHp + was.curShields - (now ? now.curHp + now.curShields : 0);
    if (lost <= 0) continue;
    // Scaled from the damage, clamped: a chip and a nuke should look
    // different, but a 30-point hit must not fill the screen.
    hits.push({ row: was.pos.row, col: was.pos.col, element, strength: Math.max(0.7, Math.min(2.2, lost / 5)) });
  }
  return hits;
}

function fire(hits: Hit[]) {
  if (hits.length === 0) return;
  void loadLayer().then((l) => {
    let hardest = 0;
    for (const h of hits) {
      // `data-pos` is the LOGICAL square, so the lookup is right for a P2
      // viewer whose board is drawn flipped.
      const el = document.querySelector<HTMLElement>(`[data-pos="${h.row},${h.col}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      l.impact(r.left + r.width / 2, r.top + r.height / 2, h.element, h.strength);
      hardest = Math.max(hardest, h.strength);
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

export function useSpellImpacts(game: GameState | null, inMatch: boolean, hold: boolean) {
  const prev = useRef<GameState | null>(null);
  const queued = useRef<Hit[]>([]);

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
    const hits = spellHits(before, game);
    if (hits.length === 0) return;
    if (hold) queued.current.push(...hits);
    else fire(hits);
  }, [game, inMatch, hold]);

  useEffect(() => {
    if (hold || queued.current.length === 0) return;
    const hits = queued.current;
    queued.current = [];
    fire(hits);
  }, [hold]);
}

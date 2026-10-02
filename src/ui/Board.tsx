import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BossTelegraph, CardInstance, FieldBuff, FieldState, GameState, PlayerId, Pos } from "../engine";
import type { StrikeZone } from "./attack-zone";
import { cardAt, enemyOf, getSpell, homeRow, isContested } from "../engine";
import { getDef } from "../data/cards";
import { Slot } from "./Slot";
import { AURA_GLOW_MS, auraArrivals, type AuraGlow } from "./aura-glow";
import { cardThumbSrc, EL_COLOR, poiHolderSuit } from "./shared";
import { dominationMap, isImpassable, isRoad, isShrine, isWell, poiAt, poiRing } from "../data/domination";

/** Plain-language summary of a live Field's numeric bonuses. Used for terrain,
 *  whose printed spell text describes a stronger thing than it is running. */
const BUFF_LABEL: [keyof FieldBuff, (n: number) => string][] = [
  ["regen", (n) => `REGEN ${n} each round`],
  ["shield", (n) => `+${n} shield`],
  ["sp", (n) => `+${n} SP`],
  ["dmgBonus", (n) => `+${n} DMG`],
  ["block", (n) => `BLOCK ${n}`],
  ["reflect", (n) => `REFLECT ${n}`],
  ["specialDiscount", (n) => `Specials cost ${n} less`],
  ["electrify", (n) => `+${n} Electrify DMG`],
  ["drainBonus", (n) => `+${n} DRAIN`],
  ["push", (n) => `+${n} knockback`],
];

function describeFieldBuff(f: FieldState): string {
  const parts = BUFF_LABEL
    .filter(([k]) => typeof f[k] === "number" && (f[k] as number) > 0)
    .map(([k, label]) => label(f[k] as number));
  return parts.length ? `${parts.join(", ")} for its own element.` : "No standing bonus.";
}


/** What a square IS on a Domination map — closed ground, a lane, a shrine, or
 *  part of a Point and who currently holds it. Undefined in every other match,
 *  which is what keeps the ordinary board's markup unchanged. */
function domTerrain(game: GameState, row: number, col: number) {
  const dom = game.domination;
  const map = dom && dominationMap(dom.mapId);
  if (!dom || !map) return undefined;
  const poi = poiAt(map, row, col);
  return {
    closed: isImpassable(map, row, col),
    road: isRoad(map, row, col),
    shrine: isShrine(map, row, col),
    well: isWell(map, row, col),
    poi: poi?.id,
    poiOwner: poi ? dom.held[poi.id] : null,
  };
}


/** DOMINATION's scoreboard, in place of the "Opponent Home" crest — that crest
 *  advertises a win condition this mode switches OFF, and the mode has no other
 *  way to show who is ahead. Four pips, one per Point, in the holder's colour
 *  and viewer-relative (yours is always the green one). Null in every other
 *  match, which leaves the crest exactly as it was. */
function domScore(game: GameState, viewer: PlayerId) {
  const dom = game.domination;
  const map = dom && dominationMap(dom.mapId);
  if (!dom || !map) return null;
  const mine = map.pois.filter((p) => dom.held[p.id] === viewer).length;
  const theirs = map.pois.filter((p) => dom.held[p.id] && dom.held[p.id] !== viewer).length;
  return (
    <div className="crest dom-score">
      <span className="crest-bar" />
      <span className="dom-tally you">{mine}</span>
      {map.pois.map((p) => {
        const who = dom.held[p.id];
        const cls = who === null ? "open" : who === viewer ? "you" : "foe";
        return (
          <span key={p.id} className={`dom-pip ${cls}`} title={`${p.name} — ${
            who === null ? "unclaimed" : who === viewer ? "yours" : "held against you"}`}>
            {p.id}
          </span>
        );
      })}
      <span className="dom-tally foe">{theirs}</span>
      <span className="crest-bar" />
    </div>
  );
}


/** A Point's letter, drawn on its CITADEL — the closed middle square, which is
 *  the one square in a Point that can never hold a token to cover it up. */
function poiLetterAt(game: GameState, row: number, col: number): string | undefined {
  const dom = game.domination;
  const map = dom && dominationMap(dom.mapId);
  if (!map) return undefined;
  const poi = map.pois.find((p) => p.centre.row === row && p.centre.col === col);
  return poi?.id;
}

/** How a square stands as an OBJECTIVE, viewer-relative.
 *
 *  One vocabulary for both kinds of board, because they are the same question
 *  asked twice: on a standard board the objectives are the two Home rows, and in
 *  Domination they are the Points. It replaces the red/blue row tinting, which
 *  coloured ground by WHOSE it was rather than by whether it had been taken —
 *  and on a board where taking ground is the win condition, the second is the
 *  thing worth seeing.
 *
 *      blue    nobody holds it
 *      green   you hold it
 *      red     they hold it
 *      orange  contested — both sides have a body on it
 *
 *  Red is not in the three colours that were asked for, but a scheme with no
 *  way to show a Point held AGAINST you cannot show you losing. */
function objectiveAt(
  game: GameState, viewer: PlayerId, row: number, col: number,
): "open" | "yours" | "theirs" | "contested" | undefined {
  const dom = game.domination;
  const map = dom && dominationMap(dom.mapId);
  if (dom && map) {
    const poi = poiAt(map, row, col);
    if (!poi) return undefined;
    // The citadel gets the state too, even though nothing can stand on it: its
    // LETTER is coloured by it, which is what makes the letter the score. The
    // ring itself is suppressed on closed ground in CSS.
    let mine = 0, theirs = 0;
    for (const sq of poiRing(poi)) {
      const occ = cardAt(game, sq.row, sq.col);
      if (!occ || occ.curHp <= 0) continue;
      if (occ.owner === viewer) mine++; else theirs++;
    }
    if (mine > 0 && theirs > 0) return "contested";
    const who = dom.held[poi.id];
    return who === null ? "open" : who === viewer ? "yours" : "theirs";
  }
  // DOMINATION ONLY (owner's call). The standard boards keep the colours they
  // have always had: their Home rows stay red and blue, their captured slots
  // keep the hazard stripes, and their contested slots keep the red pulse.
  // Those boards have ONE objective row per side and you already know which is
  // yours from its colour, so the highlight was answering a question that only
  // gets asked on a map with four Points spread across it.
  return undefined;
}

// ── BETWEEN ACTIONS ─────────────────────────────────────────────────────────
// A battle step lands in one frame: HP, a push, and the spotlight passing to
// the next card all changed at once, so every handoff was a jump cut. These
// turn the jumps into motion without slowing the game — each plays inside the
// pause the next step already waits (see App's auto-advance).

/** The spotlight passing from one card to the next, and the lift easing across. */
const HANDOFF_MS = 260;
/** A card sliding to a new square (a push, a pull, a charge, a move). */
const SLIDE_MS = 280;
/** Nothing glowing — one shared empty map, so a square's `aura` prop stays the
 *  same `null` render after render. */
const NO_GLOW: ReadonlyMap<string, AuraGlow> = new Map();

/** Two looks at one continuing match — not a new match, a rematch, or a board
 *  come back from game over, where nothing should animate across. */
const sameMatch = (a: GameState, b: GameState) =>
  a.phase !== "gameover" && b.round >= a.round && b.boardSize === a.boardSize;
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Drive a card's style by hand for `ms`. Paint, not a compositor animation,
 *  on purpose: a card is not on a GPU layer of its own, and a transition or a
 *  Web Animation would make it one for every handoff and break it again after —
 *  the churn the spotlight was rebuilt to avoid (styles.css .token.attacking).
 *  One tween per card and key; a new one takes over from the last. */
const tweens = new WeakMap<HTMLElement, Map<string, number>>();
function tween(el: HTMLElement, key: string, ms: number, frame: (k: number) => void, done: () => void) {
  let mine = tweens.get(el);
  if (!mine) tweens.set(el, (mine = new Map()));
  const running = mine.get(key);
  if (running !== undefined) cancelAnimationFrame(running);
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    if (k >= 1 || !el.isConnected) {
      mine!.delete(key);
      done();
      return;
    }
    frame(k);
    mine!.set(key, requestAnimationFrame(step));
  };
  frame(0);
  mine.set(key, requestAnimationFrame(step));
}

function BoardView(props: {
  game: GameState;
  legalSlots: Pos[]; // summon/move destinations (green)
  legalTargetIds: string[]; // battle-phase / spell target picks
  targetsAreEnemies: boolean; // true → target cards glow red (attack), false → green (ally)
  previewArea: Pos[]; // red on-summon damage-area preview for a staged summon
  /** The GROUND a staged summon's arrival strike can reach (`arrivalStrike`):
   *  a faint red tint under the solid red of the cards it will actually hit. */
  previewReach?: Pos[];
  /** THE AIM. Every cell an armed area Special would cover, anchored on the
   *  player's current pick — drawn BEFORE they fire, which is the whole point.
   *  Gold, not the target red: an enemy inside the footprint keeps its red rim
   *  (still a legal anchor to re-aim onto) and gains the wash underneath. */
  aimArea: Pos[];
  /** THE BOSS TELEGRAPH. `blast` is every square a boss Special will cover at
   *  the end of THIS round — the red zone. `telegraphs` carries the countdowns,
   *  one per boss, hung on the square the boss is standing on. Both are empty
   *  outside a Void Tower fight, so ordinary matches render exactly as before. */
  blast: Pos[];
  /** A row/column attack about to land (ui/attack-zone.ts): lit for a beat
   *  before the step that fires it is applied. */
  strike?: StrikeZone | null;
  telegraphs: BossTelegraph[];
  stagedSlot: Pos | null; // the home slot a summon is staged into (awaiting confirm)
  pickCounts: Record<string, number>; // hits assigned per target so far
  hasSelection: boolean;
  movableIds: Set<string>; // your cards that can move this turn → a soft nudge ring
  selectedId: string | null;
  actingId: string | null;
  grayTeam: PlayerId | null; // whose cards to gray out (the idle team on your turn)
  viewPlayer: PlayerId; // whose side you're looking from (the opponent is fogged)
  /** Each seat's foils, keyed by owner. Cosmetic, UI-only. */
  foils?: Partial<Record<PlayerId, ReadonlySet<string>>>;
  onSlotClick: (row: number, col: number) => void;
  onSlotDragOver: (row: number, col: number) => void; // drag-to-summon: hover
  onSlotDrop: (row: number, col: number) => void; // drag-to-summon: drop
}) {
  const { game } = props;
  // Render so the VIEWER's home is always at the bottom. P1 home is row 3
  // (already bottom); for P2 we flip the row order so their home (row 0) sits at
  // the bottom and the opponent's is up top. Clicks still carry the true row/col.
  // Built from game.boardSize, not a literal [0,1,2,3], so a 5x5 match renders
  // without touching this file.
  const ascending = Array.from({ length: game.boardSize }, (_, i) => i);
  const rows: number[] = props.viewPlayer === "P2" ? [...ascending].reverse() : ascending;
  const cols: number[] = ascending; // columns stay left-to-right (vertical flip only)
  // Every card by square, once per render, rather than a scan of the whole
  // card list for each of up to 49 squares. First one wins, as in `cardAt`.
  const cardByPos = new Map<string, CardInstance>();
  for (const c of Object.values(game.cards)) {
    if (!c.pos) continue;
    const at = `${c.pos.row},${c.pos.col}`;
    if (!cardByPos.has(at)) cardByPos.set(at, c);
  }
  // The two crests that used to sit above and below the board are gone; the
  // per-square objective highlight says what they said, and says it about the
  // squares that matter rather than about whole rows.
  const opp = game.players[enemyOf(props.viewPlayer)];
  const oppName = (game.humans ?? ["P1"]).length > 1 ? enemyOf(props.viewPlayer) : "Opponent";
  // Recon Ping: exposed for the round it was cast in, and no longer.
  const revealed = (opp.handRevealedUntilRound ?? -1) >= game.round;
  // THE SPOTLIGHT'S PULSE (.board-spot in styles.css): one element for the
  // whole battle, parked over the card taking its turn — the speed queue's
  // head, the card Token lifts as `.attacking` — and moved on as the queue
  // advances, so its GPU layer is made once and after that only moved. Placed
  // by layout offsets (px the board lays out in, blind to any transform on an
  // ancestor), sized to the card's lifted face, and placed again whenever the
  // board changes size.
  const boardRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLElement>(null);
  const bq = game.battle;
  const headId = game.phase === "battle" && bq && bq.index < bq.queue.length ? bq.queue[bq.index] : null;
  const headPos = headId ? (game.cards[headId]?.pos ?? null) : null;
  const headAt = headPos ? `${headPos.row},${headPos.col}` : null;
  // THE HANDOFF. The spotlight GLIDES from the card that acted to the next one
  // (a Web Animation on the spot, which is on a layer of its own already, so
  // nothing new is made), and the lift eases across — the card that acted
  // settles as the next one rises — instead of both snapping in the frame the
  // step lands.
  const lastHead = useRef<string | null>(null);
  /** Re-parks the spot where it stands — what a resize asks for. */
  const reparkRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    const board = boardRef.current, spot = spotRef.current;
    const fromId = lastHead.current;
    lastHead.current = headId;
    reparkRef.current = null;
    if (!board || !spot || !headAt) return;
    const handoff = fromId !== null && fromId !== headId && !reducedMotion();
    const park = (glide: boolean) => {
      const slot = board.querySelector<HTMLElement>(`[data-pos="${headAt}"]`);
      const token = slot?.querySelector<HTMLElement>(":scope > .token");
      const brow = slot?.offsetParent as HTMLElement | null | undefined;
      if (!slot || !token || !brow) return;
      const lift = parseFloat(getComputedStyle(token).scale) || 1;
      const w = token.offsetWidth * lift, h = token.offsetHeight * lift;
      const x = brow.offsetLeft + slot.offsetLeft + token.offsetLeft - (w - token.offsetWidth) / 2;
      const y = brow.offsetTop + slot.offsetTop + token.offsetTop - (h - token.offsetHeight) / 2;
      const x0 = parseFloat(spot.style.left), y0 = parseFloat(spot.style.top);
      spot.style.left = `${x}px`;
      spot.style.top = `${y}px`;
      spot.style.width = `${w}px`;
      spot.style.height = `${h}px`;
      // Whose it is, for the melee lunge: the glow travels with its card, and
      // only while it is still that card's (use-spell-impacts.ts `lunge`).
      spot.dataset.at = headAt;
      spot.style.translate = "";
      if (glide && Number.isFinite(x0) && Number.isFinite(y0) && (x0 !== x || y0 !== y))
        spot.animate(
          [{ transform: `translate(${x0 - x}px, ${y0 - y}px)` }, { transform: "none" }],
          { duration: HANDOFF_MS, easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
        );
    };
    park(handoff);
    reparkRef.current = () => park(false);
    if (handoff) {
      const was = board.querySelector<HTMLElement>(`.token[data-iid="${fromId}"]`);
      const now = board.querySelector<HTMLElement>(`.token[data-iid="${headId}"]`);
      const lift = now ? parseFloat(getComputedStyle(now).scale) || 1 : 1;
      for (const [el, a, b] of [[was, lift, 1], [now, 1, lift]] as const) {
        if (!el) continue;
        tween(el, "lift", HANDOFF_MS, (k) => { el.style.scale = String(a + (b - a) * easeInOut(k)); }, () => { el.style.scale = ""; });
      }
    }
  }, [headAt, headId]);
  // ...and placed again when the board changes size. ONE observer for the
  // board's life: it used to be made and dropped on every step, and a new one
  // reports straight away, which re-parked — and re-measured — every hand-off
  // a second time.
  useEffect(() => {
    const board = boardRef.current;
    if (!board || typeof ResizeObserver === "undefined") return;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) { first = false; return; } // the report every new observer makes
      reparkRef.current?.();
    });
    ro.observe(board);
    return () => ro.disconnect();
  }, []);

  // CARDS SLIDE. A push, a pull, a charge or a move used to take a card off one
  // square and put it on another in a single frame. Each card's square is
  // remembered (layout offsets, blind to any transform), and one that changed
  // square is drawn from where it was to where it is — and a card that has
  // just arrived settles in — a hand-driven paint tween like the lift's.
  const squares = useRef<{ game: GameState; view: PlayerId; w: number; at: Map<string, [number, number]> } | null>(null);
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const prev = squares.current;
    // The same game from the same seat: nothing has moved, so nothing is read.
    // Reading a card's offset makes the browser lay the page out mid-commit,
    // and this ran on every render of the board — a handful per battle step,
    // most of them for a highlight, not a move. (A resize in between is still
    // safe: the width check below sees it at the next step and skips the
    // slides, as it always has.)
    if (prev && prev.game === game && prev.view === props.viewPlayer) return;
    const at = new Map<string, [number, number]>();
    for (const tok of board.querySelectorAll<HTMLElement>(".token[data-iid]")) {
      const slot = tok.parentElement, brow = slot?.offsetParent as HTMLElement | null | undefined;
      if (!slot || !brow) continue;
      at.set(tok.dataset.iid!, [brow.offsetLeft + slot.offsetLeft, brow.offsetTop + slot.offsetTop]);
    }
    squares.current = { game, view: props.viewPlayer, w: board.offsetWidth, at };
    // A board that changed size, or turned round for the other seat, moved
    // every card at once: that is a reflow, not a move.
    if (!prev || prev.game === game || prev.view !== props.viewPlayer || prev.w !== board.offsetWidth ||
        !sameMatch(prev.game, game) || reducedMotion()) return;
    for (const [iid, [x, y]] of at) {
      const tok = board.querySelector<HTMLElement>(`.token[data-iid="${iid}"]`);
      if (!tok) continue;
      const was = prev.at.get(iid);
      if (!was) {
        // Arrived this step (a summon, a spawn): it settles in rather than blinking on.
        tok.style.transition = "none"; // `.token` transitions its transform; this is driven by hand
        tween(tok, "arrive", 220, (k) => {
          const e = easeOut(k);
          tok.style.opacity = String(e);
          tok.style.transform = `scale(${0.82 + 0.18 * e})`;
        }, () => { tok.style.opacity = ""; tok.style.transform = ""; tok.style.transition = ""; });
        continue;
      }
      if (was[0] === x && was[1] === y) continue;
      const dx = was[0] - x, dy = was[1] - y;
      // Over its neighbours while it travels, under the spotlight and the numbers.
      tok.style.zIndex = "7";
      tok.style.transition = "none"; // `.token` transitions its transform; this is driven by hand
      tween(tok, "slide", SLIDE_MS, (k) => {
        const e = 1 - easeOut(k);
        tok.style.transform = `translate(${dx * e}px, ${dy * e}px)`;
      }, () => { tok.style.transform = ""; tok.style.transition = ""; tok.style.zIndex = ""; });
    }
  });

  // AN AURA LANDING (ui/aura-glow.ts): the card that projects it glows as it
  // lands, then every card its aura reaches, nearest first, and the light fades.
  // Apart from the slides above: it is not a move, so a board that also changed
  // size still shows it, and reduced motion gets it as a plain fade (styles.css).
  const [auraLit, setAuraLit] = useState<ReadonlyMap<string, AuraGlow>>(NO_GLOW);
  const auraSeen = useRef<GameState | null>(null);
  const auraKey = useRef(0);
  useEffect(() => {
    const before = auraSeen.current;
    auraSeen.current = game;
    if (!before || before === game || !sameMatch(before, game)) return;
    const lit = auraArrivals(before, game);
    if (lit.size === 0) return;
    const key = ++auraKey.current, start = performance.now();
    setAuraLit((old) => {
      const next = new Map(old);
      for (const [id, light] of lit) next.set(id, { ...light, key, start });
      return next;
    });
    // Not cleared with the effect: the next step lands well inside the glow,
    // and must not cut it short. A late fire after the board has gone is a
    // no-op.
    window.setTimeout(() => setAuraLit((old) => {
      const next = new Map([...old].filter(([, g]) => g.key !== key));
      return next.size === old.size ? old : next;
    }), AURA_GLOW_MS);
  }, [game]);
  return (
    <div className="board-area">
      {/* Fog of war: the opponent's hand is face-down; their deck is hidden —
          unless RECON PING has exposed it for the round.

          This is the half of Recon Ping that never existed. The spell set
          `handRevealedUntilRound` and the card's own comment said "the UI reads
          it"; nothing did, anywhere in the app, so the reveal was writing a
          number no one looked at and the spell's headline effect did nothing at
          all. */}
      <div className="opp-fog">
        <div className="opp-fan" title={revealed
          ? `${oppName}: ${opp.hand.map((h) => getDef(h.defId).name).join(", ") || "empty"}`
          : `${oppName}: ${opp.hand.length} cards in hand`}>
          {opp.hand.slice(0, 8).map((h, i) => (
            revealed
              ? (
                <span
                  key={h.handId}
                  className="opp-back revealed"
                  title={getDef(h.defId).name}
                  style={{
                    ["--i" as string]: i - Math.min(opp.hand.length, 8) / 2,
                    backgroundImage: `url(${cardThumbSrc(getDef(h.defId))})`,
                  }}
                />
              )
              : <span key={h.handId} className="opp-back" style={{ ["--i" as string]: i - Math.min(opp.hand.length, 8) / 2 }} />
          ))}
        </div>
        <div className="opp-meta">
          <b>{oppName}</b> · {opp.hand.length} cards
          <span className="opp-hidden">{revealed ? "HAND EXPOSED" : "deck hidden"}</span>
        </div>
        {/* Each pip says what it counts: a gold and a violet number beside the
            hand read as two numbers, not as the other side's Gold and Magic. */}
        <div className="opp-res">
          <span className="opp-pip gold" title={`${oppName}'s Gold`}><b>◆ {opp.gold}</b><small>Gold</small></span>
          <span className="opp-pip magic" title={`${oppName}'s Magic`}><b>✦ {opp.magicPool}</b><small>Magic</small></span>
        </div>
      </div>
      {/* The red "Opponent Home" and blue "Your Home" crests are gone. They
          coloured the board's two ends by WHOSE they were, which the objective
          highlight now says better and per square — and in Domination they
          advertised a win condition the mode switches off entirely. What stands
          here in that mode is the scoreboard, because it is the one thing the
          board cannot show you by itself. */}
      {domScore(game, props.viewPlayer)}
      {/* `tight` = a board with more than four columns, where every tile is
          smaller and the tokens have to shed furniture to keep the stat row on
          one line. Keyed on the size, not on a literal 5, so a 6x6 inherits it. */}
      <div className={`board${game.boardSize > 4 ? " tight" : ""}`} ref={boardRef}>
        {/* Fields (Cost-6 terrain) — a board-wide haze in the element colour,
            framed like a wall. pointer-events:none so slots stay clickable. */}
        {/* Standing terrain is ONE battlefield even though it is stored as an
            entry per player — `fieldBonus` keys on the card's own owner, so both
            have to exist. Drawing it twice made the board read as two stacked
            fields, which it never was. Cast fields still show per side. */}
        {game.fields
          .filter((f, i) => !f.permanent || game.fields.findIndex((x) => x.permanent && x.spellId === f.spellId) === i)
          .map((f) => {
          const spell = getSpell(f.spellId);
          const color = EL_COLOR[f.element];
          // Standing terrain has no timer — showing roundsLeft would read as
          // "one round left" on something that runs the whole battle.
          // Terrain is a WEAKENED form of the spell, so quoting the spell's own
          // text would promise effects it does not have. Describe what is
          // actually running instead.
          const tip = f.permanent
            ? `${spell.name} — the region's terrain, all battle, both sides. ${describeFieldBuff(f)}` +
              ` (a weakened form — cast the spell for the full effect)`
            : `${spell.name} (${f.owner === "P1" ? "yours" : "enemy"}) — ${spell.text} · ${f.roundsLeft} round(s) left`;
          return (
            <div
              key={f.owner + f.spellId}
              className={`fieldhaze ${f.permanent ? "terrain" : f.owner === "P1" ? "mine" : "enemy"}`}
              data-el={f.element}
              title={tip}
            >
              <span className="fieldmark" style={{ borderColor: color, color }} title={tip}>
                {spell.name} · {f.permanent ? "∞" : f.roundsLeft}
              </span>
            </div>
          );
        })}
        {rows.map((row) => (
          <div className="brow" key={row} data-row={row}>
            {game.walls
              .filter((w) => w.row === row)
              .map((w) => {
                const spell = getSpell(w.spellId);
                const color = EL_COLOR[spell.element];
                const tip = `${spell.name} (${w.owner === "P1" ? "yours" : "enemy"}) — ${spell.text} · ${w.roundsLeft} round(s) left`;
                return (
                  <div key={w.owner + w.spellId} className="wallframe" style={{ color }}>
                    {/* Brackets framing the walled row for its duration. */}
                    <span className="wallbracket left" title={tip} />
                    <span className="wallbracket right" title={tip} />
                    <span
                      className={`wallmark ${w.owner === "P1" ? "mine" : "enemy"}`}
                      style={{ borderColor: color }}
                      title={tip}
                    >
                      {spell.name} · {w.roundsLeft}
                    </span>
                  </div>
                );
              })}
            {cols.map((col) => {
              const card = cardByPos.get(`${row},${col}`) ?? null;
              const isLegalSlot = props.legalSlots.some((p) => p.row === row && p.col === col);
              // Traps are CONCEALED: the viewer sees only their own. Rendering
              // the opponent's — even faintly — would defeat the mechanic, so
              // this is gated on viewPlayer rather than on ownership alone.
              const myTrap = game.traps.find(
                (t) => t.owner === props.viewPlayer && t.pos.row === row && t.pos.col === col,
              );
              const isTargetCard = card !== null && props.legalTargetIds.includes(card.instanceId);
              const redTarget = isTargetCard && props.targetsAreEnemies;
              const greenLegal = isLegalSlot || (isTargetCard && !props.targetsAreEnemies);
              const preview = props.previewArea.some((p) => p.row === row && p.col === col);
              const reach = !preview && (props.previewReach ?? []).some((p) => p.row === row && p.col === col);
              const aim = props.aimArea.some((p) => p.row === row && p.col === col);
              // THE BLAST ZONE STANDS DOWN WHILE YOU ARE AIMING. It is a
              // warning about the boss's turn, and the moment the player is
              // picking their OWN targets it stops being background information
              // and starts competing for the same tiles: a square can be both
              // "about to be hit" and "one I may hit", and two rings on one tile
              // is not two pieces of information, it is neither.
              //
              // Scoped to TARGET picking (`legalTargetIds`), not to any
              // selection — during a summon the zone is exactly what the player
              // is deciding against, so it stays lit for that.
              const aiming = props.legalTargetIds.length > 0;
              const blast = !aiming && props.blast.some((p) => p.row === row && p.col === col);
              const strikeSq = props.strike?.squares.find((q) => q.row === row && q.col === col) ?? null;
              const strike = strikeSq
                ? { order: strikeSq.order, mine: strikeSq.owner === props.viewPlayer }
                : null;
              const clock = props.telegraphs.find((t) => t.pos.row === row && t.pos.col === col) ?? null;
              const staged = props.stagedSlot != null && props.stagedSlot.row === row && props.stagedSlot.col === col;
              const dimmed =
                (props.hasSelection || props.legalTargetIds.length > 0 || props.previewArea.length > 0) &&
                // A square about to be hit stays LIT through a dim — while it
                // is shown at all. Fading the warning out the moment the player
                // picks up a card would fade it out exactly when they are
                // deciding where to put it. (While AIMING it is not shown, so
                // `blast` is already false and this term does nothing.)
                // ...and the aimed footprint stays lit too, empty squares
                // included: a dimmed cell inside the burst reads as "not hit".
                !greenLegal && !redTarget && !preview && !reach && !staged && !blast && !aim;
              const contested =
                (row === homeRow("P2", game.boardSize) && isContested(game, "P2", col)) ||
                (row === homeRow("P1", game.boardSize) && isContested(game, "P1", col));
              return (
                <Slot
                  key={col}
                  game={game}
                  row={row}
                  col={col}
                  viewer={props.viewPlayer}
                  foils={props.foils}
                  card={card}
                  legal={greenLegal}
                  isTarget={redTarget}
                  preview={preview}
                  reach={reach}
                  aim={aim}
                  blast={blast}
                  strike={strike}
                  clock={clock}
                  staged={staged}
                  dimmed={dimmed}
                  grayed={props.grayTeam !== null && card !== null && card.owner === props.grayTeam}
                  movable={card !== null && props.movableIds.has(card.instanceId)}
                  contested={contested}
                  captured={game.slots[row][col].capturedBy}
                  terrain={domTerrain(game, row, col)}
                  objective={objectiveAt(game, props.viewPlayer, row, col)}
                  poiLetter={poiLetterAt(game, row, col)}
                  poiSuit={poiHolderSuit(game, row, col)}
                  trap={myTrap ?? null}
                  canDrop={isLegalSlot}
                  pickCount={card ? (props.pickCounts[card.instanceId] ?? 0) : 0}
                  aura={card ? (auraLit.get(card.instanceId) ?? null) : null}
                  selectedId={props.selectedId}
                  actingId={props.actingId}
                  onClick={props.onSlotClick}
                  onDragOver={props.onSlotDragOver}
                  onDrop={props.onSlotDrop}
                />
              );
            })}
          </div>
        ))}
        {headPos && <i ref={spotRef} className="board-spot" aria-hidden="true" />}
      </div>
    </div>
  );
}

/** The board, redrawn only when something it shows changed. App re-renders
 *  for plenty the board does not show — the effects' pacing tick, a hint, the
 *  action bar tucking away — and each of those used to redraw every square.
 *  Its props are memoized in App for exactly this; a new array or callback
 *  there on every render would quietly switch this off. */
export const Board = memo(BoardView);

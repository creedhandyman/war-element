import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GameState, PlayerId } from "../engine";
import { getDef, effectiveSummonCost } from "../engine";
import { cardThumbSrc, EL_ICON } from "./shared";
import { SpIcon } from "./icons";

/** True on phone-width viewports (≤760px wide) OR short viewports (≤540px tall,
 *  i.e. a landscape phone). Mirrors the CSS mobile + landscape breakpoints — both
 *  width/height only, no `orientation` (flaky on real devices) — so the fan
 *  tightens the same way. Re-renders on resize/orientation change. */
const NARROW_QUERY = "(max-width: 760px), (max-height: 540px)";
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return narrow;
}

/** What the highlighted card's readout says about playing it right now. On a
 *  desktop the hint line beside the Pass button says this; the phone layouts
 *  hide that line, so a tap on a card you could not afford used to answer
 *  with nothing at all. */
export type ReadoutStatus = {
  kind: "staged" | "armed" | "ready" | "turn" | "room" | "gold" | "other";
  text: string;
};

/** The same rules the fan uses to veil a card (`noRoom` / `unaffordable`
 *  below), said in words, for the one card being looked at. */
export function readoutStatus(p: {
  game: GameState; player: PlayerId; handId: string;
  armed: boolean; staged: boolean; summonable: boolean; homeRowOpen: boolean;
}): ReadoutStatus {
  const { game, player } = p;
  const me = game.players[player];
  const h = me.hand.find((c) => c.handId === p.handId);
  const dom = !!game.domination;
  if (p.staged) return { kind: "staged", text: "Confirm to place it" };
  if (p.armed) return { kind: "armed", text: dom ? "Tap a glowing shrine" : "Tap a glowing Home slot" };
  if (!(game.phase === "prep" && game.prep?.priority === player))
    return { kind: "turn", text: "Summon on your prep turn" };
  if (p.summonable) return { kind: "ready", text: "Tap to summon" };
  if (!p.homeRowOpen) return { kind: "room", text: dom ? "All shrines taken" : "Home row full" };
  if (h && effectiveSummonCost(game, player, h.defId) > me.gold)
    return { kind: "gold", text: `Need ${effectiveSummonCost(game, player, h.defId)} Gold` };
  return { kind: "other", text: "Can't summon it now" };
}

/** THE HIGHLIGHTED CARD, READABLE. On a phone the fan is a strip of 74px
 *  cards overlapping by a third: the name clips, the class line is 8.5px and
 *  ellipsised ("Ranger · Rang…"), and the stat row sits under the action bar —
 *  so a player picked cards to summon without seeing what they did. A tapped
 *  card's name, class, Melee or Ranged, and its stats, in type that reads, in
 *  the band between the board and the hand (over the one-line log), and what
 *  to do next — or why it cannot be summoned yet. Phones and tablets only
 *  (styles.css): the desktop cards are big enough, and the landscape fan
 *  already draws them large. */
function HandReadout(props: { game: GameState; player: PlayerId; handId: string; status: ReadoutStatus; compact: boolean }) {
  const h = props.game.players[props.player].hand.find((c) => c.handId === props.handId);
  if (!h) return null;
  const def = getDef(h.defId);
  const price = effectiveSummonCost(props.game, props.player, def.id);
  const melee = def.attackType === "Melee";
  return (
    <div className={`hand-readout st-${props.status.kind}${props.compact ? " compact" : ""}`} data-el={def.element} aria-live="polite">
      <div
        className={`hr-cost${def.cost - price > 0 ? " discounted" : ""}${props.status.kind === "gold" ? " short" : ""}`}
        style={{ backgroundImage: `url(${EL_ICON[def.element]})` }}
      >
        <b>{price}</b>
      </div>
      <div className="hr-name">{def.name}</div>
      <div className="hr-status">{props.status.text}</div>
      <div className="hr-type">
        <span className="hr-class">{def.cardClass}</span>
        <span className={`hr-atk ${melee ? "melee" : "ranged"}`}>{melee ? "🗡 Melee" : "🏹 Ranged"}</span>
      </div>
      <div className="hr-stats">
        <span className="hr-stat"><i>DMG</i><b className="st-dmg">{def.dmg}{def.hits > 1 && <small>×{def.hits}</small>}</b></span>
        <span className="hr-stat"><i>HP</i><b className="st-hp">{def.hp}</b></span>
        {def.shields > 0 && <span className="hr-stat"><i>SHIELD</i><b className="st-sh">{def.shields}</b></span>}
        <span className="hr-stat"><i>SP</i><b className="st-sp"><SpIcon />{def.sp}</b></span>
      </div>
    </div>
  );
}

export function Hand(props: {
  game: GameState;
  player: PlayerId;
  /** Hand ids the ENGINE says are summonable right now (App asks canSummon over
   *  every column — the same rule that lights up the Home slots). The hand does
   *  not re-derive this: `cost <= gold` is only half of it, and a card that
   *  passes that half with a full Home row is a card the board will refuse. */
  summonableHandIds: ReadonlySet<string>;
  /** False = no Home slot is free at all, so every card is stuck for the same
   *  board-side reason. Styled apart from "can't afford it" because the player
   *  fixes the two differently: make space vs. wait for Gold. */
  homeRowOpen: boolean;
  selectedHandId: string | null;
  /** The armed card, once a Home slot is picked and it waits on Confirm. */
  stagedHandId?: string | null;
  /** Card ids the local player holds in foil. The BOARD already shines these;
   *  without the same set here a foil went dull the moment it was in your hand
   *  and lit up again when you played it, in the same match, on the same
   *  screen. Cosmetic and UI-only, exactly as on the board. */
  foils?: ReadonlySet<string>;
  onPick: (handId: string) => void;
  onDragStartCard?: (handId: string) => void;
  onDragEndCard?: () => void;
}) {
  const { game, player } = props;
  const me = game.players[player];
  const myPrep = game.phase === "prep" && game.prep?.priority === player;
  const n = me.hand.length;
  const center = (n - 1) / 2;
  // Phones get a tighter fan + shallower dip so even a hoarded 9-card hand stays
  // within the viewport and clears the bottom control bar.
  const narrow = useNarrow();
  // The fan has to stay inside the viewport as the hand GROWS. Both the spread
  // and the dip used to scale with the card's distance from centre, unbounded —
  // a 5-card hand dipped ~18px but a 9-card hand dipped ~49px and the outer
  // cards fell off the bottom of the screen (stat lines unreadable by round 3-4).
  // So: shrink the per-card step once the hand is big, and hard-CLAMP the dip.
  const wide = n > 5 ? Math.max(0.55, 5 / n) : 1; // tighten as the hand grows
  const rotStep = (narrow ? 3.2 : 4.4) * wide;
  const tyStep = (narrow ? 3.5 : 7) * wide;
  const tyMax = narrow ? 14 : 22; // the fan never dips further than this

  // THE CARD BEING LOOKED AT: the last one tapped, armed or not — a card you
  // cannot afford yet is still one you want to read — else the armed one (a
  // drag arms without a tap). Let go by a tap anywhere else, and whenever the
  // turn moves on.
  const [inspect, setInspect] = useState<string | null>(null);
  useEffect(() => {
    if (!inspect) return;
    const away = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.(".hcard, .hand-readout")) setInspect(null);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [inspect]);
  useEffect(() => setInspect(null), [game.phase, game.round, game.prep?.priority]);
  const lookId = [inspect, props.selectedHandId].find((id) => id && me.hand.some((h) => h.handId === id)) ?? null;
  // THE BAND IT SITS IN is the gap between the board and the hand, and that
  // gap is not a function of the screen's height alone: 57px on a 320x568
  // phone, 78 on 360x640, 91 on 375x667. So it is measured, and a gap too
  // short for the full readout (64px, 10 above the hand) gets the compact one
  // (~50px, 8 above) rather than a readout over the Home row.
  const handRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    if (!lookId) return;
    const fit = () => {
      const board = document.querySelector(".board");
      if (!handRef.current || !board) return;
      setCompact(handRef.current.getBoundingClientRect().top - board.getBoundingClientRect().bottom < 76);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [lookId]);

  // THE FAN FITS ITS WIDTH. Cards overlap by a fixed margin, so a hand of six
  // or more ran past a 320px screen's edge — the last card half off it. The
  // fan measures the room it has and deepens the overlap just enough; the
  // portrait rule reads it as --fan-m (never shallower than its own -14px).
  const fanRef = useRef<HTMLDivElement>(null);
  const [fanM, setFanM] = useState<number | null>(null);
  useLayoutEffect(() => {
    const fan = fanRef.current;
    if (!fan) return;
    const fit = () => {
      const first = fan.querySelector<HTMLElement>(".hcard");
      if (!first || n < 2) { setFanM(null); return; }
      const w = first.offsetWidth;
      const room = fan.clientWidth - 10; // slack for the outer cards' tilt
      setFanM(Math.min(-14, Math.floor((room - n * w) / (2 * (n - 1)))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(fan);
    return () => ro.disconnect();
  }, [n]);

  return (
    <div className={`hand${myPrep ? "" : " collapsed"}`} ref={handRef}>
      {/* Deck as a stacked pile with its count. */}
      <div className="deck-stack" title={`Your deck — ${me.deck.length} cards`}>
        <span className="ds-plate" />
        <span className="ds-plate" />
        <span className="ds-face">
          <span className="ds-count">{me.deck.length}</span>
          <span className="ds-lbl">DECK</span>
        </span>
      </div>

      <div className="hand-fan" ref={fanRef} style={fanM === null ? undefined : { ["--fan-m" as string]: `${fanM}px` }}>
        {me.hand.map((h, i) => {
          const def = getDef(h.defId);
          const summonable = props.summonableHandIds.has(h.handId);
          // Two locked states, two fixes. `noroom` = the board is full, so make
          // space; `unaffordable` = the card is out of reach, so bank Gold. The
          // Gold veil is suppressed for anything the engine says IS summonable,
          // because the free opening placement spends slots, not Gold.
          const noRoom = myPrep && !summonable && !props.homeRowOpen;
          // THE PRICE A SEEK ALREADY PART-PAID, not the printed one. The card
          // text promises "it costs 1 less to summon" and the hand was still
          // charging full: a discounted card greyed out as unaffordable and
          // showed a number the till would not have taken.
          const price = effectiveSummonCost(props.game, props.player, def.id);
          const cut = def.cost - price;
          const unaffordable = price > me.gold && !summonable && !noRoom;
          const melee = def.attackType === "Melee";
          // The bar under the stats is the board token's: its width is HP plus
          // shields, so the grey head is the damage the plating soaks first.
          const shPct = (def.shields / Math.max(1, def.hp + def.shields)) * 100;
          const off = i - center;
          const rot = off * rotStep; // fan spread (deg)
          const ty = Math.min(tyMax, Math.pow(Math.abs(off), 1.4) * tyStep); // outer cards dip lower (clamped)
          const cls = [
            "hcard",
            summonable ? "summonable" : "",
            unaffordable ? "unaffordable" : "",
            noRoom ? "noroom" : "",
            props.selectedHandId === h.handId ? "selected" : "",
            lookId === h.handId ? "hl" : "",
            props.foils?.has(def.id) ? "foil" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={h.handId}
              className={`${cls} carded`}
              data-el={def.element}
              style={{
                ["--rot" as string]: `${rot}deg`,
                ["--ty" as string]: `${ty}px`,
                // STRICTLY increasing left to right, so every card sits above
                // the one to its left and its own left edge stays on top. It
                // used to peak at the CENTRE (30 - |off|*2), which reads fine
                // as a fan and quietly hid half the hand's costs: the gem is at
                // the card's top-LEFT, cards overlap by their full 28-38px
                // margin, and every card RIGHT of centre was underneath its
                // left neighbour — so its gem was covered and only the left
                // half of the hand showed a price.
                zIndex: 30 + i,
              }}
              title={
                noRoom
                  ? `${def.name} — no free Home slot`
                  : def.special
                    ? `${def.special.name}: ${def.special.text}`
                    : def.name
              }
              draggable={summonable}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", h.handId);
                e.dataTransfer.effectAllowed = "move";
                props.onDragStartCard?.(h.handId);
              }}
              onDragEnd={() => props.onDragEndCard?.()}
              onClick={() => {
                setInspect(h.handId);
                props.onPick(h.handId);
              }}
            >
              <img
                className="card-art"
                src={cardThumbSrc(def)}
                alt=""
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              {/* Cost and element are one mark now. The RING still carries
                   affordability (gold vs red) — that is a gameplay signal and
                   it does not move onto the art. */}
              <div
                className={`hc-cost${cut > 0 ? " discounted" : ""}`}
                style={{ backgroundImage: `url(${EL_ICON[def.element]})` }}
                title={cut > 0 ? `${def.cost} − ${cut} (called up)` : undefined}
              >
                <b>{price}</b>
              </div>
              {props.foils?.has(def.id) && <i className="foil-tag" title="Foil">✦</i>}
              {/* The board token's language, so a card reads the same in the
                  hand as on the board: colour says which number is which —
                  red damage, green HP, blue speed — and shields are the grey
                  head of the bar under them. The glyph is Melee or Ranged. */}
              <div className="hc-plate">
                <div className="hc-name">{def.name}</div>
                <div className="hc-type">
                  <span className={`hc-atk ${melee ? "melee" : "ranged"}`}>{melee ? "🗡" : "🏹"}</span>
                  {def.cardClass}
                  <span className="hc-atk-word"> · {def.attackType}</span>
                </div>
                <div className="hc-stats">
                  <span className="st-dmg" title={`Damage${def.hits > 1 ? ` ×${def.hits} hits` : ""}`}>
                    {def.dmg}{def.hits > 1 && <span className="atk-x">×{def.hits}</span>}
                  </span>
                  <span className="st-hp" title={`HP${def.shields > 0 ? ` · ${def.shields} shield${def.shields > 1 ? "s" : ""}` : ""}`}>{def.hp}</span>
                  <span className="st-sp" title="Speed">{def.sp}</span>
                </div>
                <div className="hc-bar" aria-hidden="true">
                  {def.shields > 0 && <span className="hc-bar-sh" style={{ width: `${shPct}%` }} />}
                  <span className="hc-bar-hp" />
                </div>
              </div>
              {/* The foil's sheen, last so it paints over the plate the way the
                  card's ::after sheen did — moved by the compositor now, not
                  repainted (see .foil-sheen). */}
              {props.foils?.has(def.id) && <span className="hc-foil foil-sheen" aria-hidden="true" />}
            </div>
          );
        })}
        {n === 0 && <span className="hand-empty">Hand empty.</span>}
      </div>

      {lookId && (
        <HandReadout
          game={game}
          player={player}
          handId={lookId}
          status={readoutStatus({
            game, player, handId: lookId,
            armed: props.selectedHandId === lookId,
            staged: props.stagedHandId === lookId,
            summonable: props.summonableHandIds.has(lookId),
            homeRowOpen: props.homeRowOpen,
          })}
          compact={compact}
        />
      )}

      {/* Say it once, up front. A full Home row makes the whole hand unplayable,
          and the player shouldn't have to tap a card to find that out. */}
      {myPrep && n > 0 && !props.homeRowOpen && (
        <span className="hand-note">Home row full — move a card forward to free a slot.</span>
      )}
    </div>
  );
}

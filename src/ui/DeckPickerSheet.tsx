/** Choosing a deck for a seat, as a sheet of decks.
 *
 *  This replaces an optgrouped `<select>`. On iOS that renders as a spinning
 *  wheel showing "Frostkeep (18)" and nothing else — no elements, no curve, no
 *  sense of what you are about to play against. Every fact needed to choose
 *  was already in `custom-decks.ts` and none of it reached the screen.
 *
 *  A row carries the deck's finisher art, its element split, its size, and the
 *  one-line intent that has always sat as a comment above the card list. The
 *  subhead states the format, so a deck that is missing from the list explains
 *  itself rather than just not being there.
 */
import { useState } from "react";
import { getDef } from "../data/cards";
import { deckLimits, type CustomDeck, type PremadeDeck } from "../data/custom-decks";
import { EL_COLOR } from "./shared";
import type { Element } from "../engine";

/** The element split, biggest first — the shape of a deck in one glance. */
export function elementSplit(cards: readonly string[]): { el: Element; n: number }[] {
  const by: Partial<Record<Element, number>> = {};
  for (const id of cards) {
    const el = getDef(id).element;
    by[el] = (by[el] ?? 0) + 1;
  }
  return (Object.entries(by) as [Element, number][])
    .map(([el, n]) => ({ el, n }))
    .sort((a, b) => b.n - a.n || a.el.localeCompare(b.el));
}

/** The card a deck is built to end on: dearest, then biggest. Its art is the
 *  deck's face, which is more of an identity than a name in a list. */
export function finisherOf(cards: readonly string[]): string | null {
  if (!cards.length) return null;
  return [...cards].sort((a, b) => {
    const A = getDef(a), B = getDef(b);
    return B.cost - A.cost || (B.dmg * B.hits + B.hp) - (A.dmg * A.hits + A.hp);
  })[0];
}

export const deckArtUrl = (cards: readonly string[]): string | null => {
  const id = finisherOf(cards);
  if (!id) return null;
  const d = getDef(id);
  return `/cards/${d.art ?? d.id}.webp`;
};

export function ElChips(props: {
  cards: readonly string[];
  max?: number;
  small?: boolean;
  /** Lay out four to a row and stack the rest underneath, rather than clipping
   *  whatever does not fit on one line. For the Arena seats, where a squad can
   *  legitimately field all eight elements and the strip is the only place that
   *  says so. */
  wrap?: boolean;
  /** Show THESE elements instead of counting the deck's, and without counts.
   *  For a Void Tower boss, whose seat holds only its summons: the fight is a
   *  DUEL of two elements the boss declares, and a chip strip counting the
   *  brood ("DUSK 2") answers a question nobody asked while hiding the one
   *  thing you plan around. Deduped, because a mono-element boss should print
   *  one chip rather than the same word twice. */
  only?: readonly Element[];
}) {
  const split = elementSplit(props.cards).slice(0, props.max ?? 5);
  if (props.only) {
    const els = [...new Set(props.only)];
    return (
      <span className={`el-chips ${props.small ? "sm" : ""} ${props.wrap ? "wrap" : ""}`}>
        {els.map((el) => (
          <span key={el} className="el-chip" style={{ borderColor: EL_COLOR[el], color: EL_COLOR[el] }}>
            {el}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className={`el-chips ${props.small ? "sm" : ""} ${props.wrap ? "wrap" : ""}`}>
      {split.map(({ el, n }) => (
        <span key={el} className="el-chip" style={{ borderColor: EL_COLOR[el], color: EL_COLOR[el] }}>
          {el} {n}
        </span>
      ))}
    </span>
  );
}

/** One seat of the versus card.
 *
 *  Viewer-relative colouring, matching the board: yours blue, theirs red. The
 *  deck's finisher art bleeds in from the right under a mask, so the card has
 *  a face without the art fighting the text for the left half. */
export function DeckSeat(props: {
  side: "mine" | "foe";
  /** Who sits here — "YOU · P1", "AI · P2". Monospaced, so the seats line up. */
  flag: string;
  label: string;
  cards: readonly string[];
  /** Absent = this seat is not the player's to change (a Gauntlet run deals
   *  it). The card renders as a plain panel rather than a dead button. */
  onChange?: () => void;
  /** Face the seat with THIS art instead of the deck's finisher. A Void Tower
   *  trial's deck is only the boss's summons — its finisher is a lieutenant,
   *  and the seat wearing Zombination's face for Rotroot's fight undersold
   *  every fight on the tower. The BOSS is the opponent; the seat says so. */
  artOverride?: string;
  /** Passed straight to `ElChips.only` — see there. */
  elements?: readonly Element[];
}) {
  const art = props.artOverride ?? deckArtUrl(props.cards);
  return (
    <button
      className={`ar-seat ${props.side} ${props.onChange ? "" : "locked"}`}
      onClick={props.onChange}
      disabled={!props.onChange}
    >
      {art && (
        <span className="ar-seat-art" style={{ backgroundImage: `url(${art})` }} aria-hidden="true" />
      )}
      <span className="ar-flag">
        <i aria-hidden="true" />
        {props.flag}
      </span>
      <span className="ar-deckname">{props.label}</span>
      <span className="ar-seat-foot">
        {/* EVERY element, four to a row. It was capped at 4 and a rainbow squad
            simply lost the rest — the seat said BORE/DUSK/LEAF/BOLT and quietly
            dropped the other four, which is the one thing this strip exists to
            tell you. `wrap` on the strip stacks the overflow underneath. */}
        <ElChips cards={props.cards} max={99} wrap only={props.elements} />
        {props.onChange && <span className="ar-change">change</span>}
      </span>
    </button>
  );
}

export function DeckPickerSheet(props: {
  /** Whose seat is being filled — the title, so the sheet is never ambiguous. */
  title: string;
  boardSize: number;
  premades: PremadeDeck[];
  customs: CustomDeck[];
  /** The id currently set for this seat, marked with a tick. */
  value: string;
  onPick: (id: string) => void;
  onClose: () => void;
  onBuild: () => void;
}) {
  const size = deckLimits(props.boardSize).target;
  /** The premades are folded away, always. There are eighteen of them now — six
   *  originals plus the twelve-deck ladder — and the Arena fills seats FOR you
   *  through the matchmaker and the Gauntlet, so the long list is mostly scroll
   *  between you and the deck you actually built.
   *
   *  Collapsed even with no custom decks, which is safe because it strands
   *  nobody: both seats are already pre-filled with premades, so a player who
   *  never opens this sheet still has a match to start. */
  const [showPremades, setShowPremades] = useState(false);
  const rows = (d: CustomDeck | PremadeDeck, custom: boolean) => {
    const art = deckArtUrl(d.cards);
    const on = d.id === props.value;
    return (
      <button
        key={d.id}
        className={`dp-row ${on ? "on" : ""}`}
        onClick={() => { props.onPick(d.id); props.onClose(); }}
      >
        <span className="dp-art">
          {art && (
            <img src={art} alt="" loading="lazy"
              onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
          )}
        </span>
        <span className="dp-body">
          <span className="dp-head">
            <b>{d.name}</b>
            <span className="dp-count">{d.cards.length}</span>
            {"tier" in d && d.tier && (
              /* The rung, so a deck the matchmaker handed you and the same deck
                 found by name read as the same thing. */
              <em className={`dp-tier ${d.tier}`}>{d.tier === "mid" ? "even" : d.tier}</em>
            )}
            {custom ? <em className="dp-mark custom">★ CUSTOM</em> : on && <em className="dp-mark">✓</em>}
          </span>
          <span className="dp-note">
            {"note" in d && d.note
              ? d.note
              : `${d.cards.length === size ? "Legal" : `${d.cards.length}/${size} — not legal yet`} for ${props.boardSize}×${props.boardSize}`}
          </span>
          <ElChips cards={d.cards} small />
        </span>
      </button>
    );
  };

  return (
    <div className="dp-scrim" onClick={props.onClose}>
      <div className="dp-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="dp-grab" aria-hidden="true"><i /></div>
        <div className="dp-title">
          <h3>{props.title}</h3>
          {/* The format, stated. A deck absent from this list is absent because
              it is built for the other board, and that is worth saying once
              here rather than leaving as a mystery. */}
          <p>
            Sized for {props.boardSize}×{props.boardSize} · exactly {size} cards.
            {" "}{props.premades.length} premade{props.premades.length === 1 ? "" : "s"}
            {props.customs.length ? " and your own." : "."}
          </p>
        </div>

        {/* Yours first: it is the shorter list and the one you meant. */}
        <div className="dp-group">YOURS</div>
        <div className="dp-list">
          {props.customs.map((d) => rows(d, true))}
          <button className="dp-build" onClick={() => { props.onClose(); props.onBuild(); }}>
            Build a new squad
          </button>
        </div>

        <button
          className={`dp-group dp-fold ${showPremades ? "on" : ""}`}
          onClick={() => setShowPremades((v) => !v)}
          aria-expanded={showPremades}
        >
          PREMADE <em>{props.premades.length}</em>
          <i aria-hidden="true">{showPremades ? "⌃" : "⌄"}</i>
        </button>
        {showPremades && <div className="dp-list">{props.premades.map((d) => rows(d, false))}</div>}
      </div>
    </div>
  );
}

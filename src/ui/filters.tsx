/** The shared filter furniture for the three card grids.
 *
 *  The builder, the collection and the campaign's squad-packing screen all show
 *  the same 320 cards behind the same questions, and each had grown its own copy
 *  of the rows. Copies drift: the keyword filter shipped to two of them and the
 *  second one lit its pill up without filtering anything, because the predicate
 *  went in and the `useMemo` dependency did not. One implementation of each row
 *  is the fix for that class of bug rather than a tidiness argument.
 *
 *  Deliberately NOT one big `<Filters>` component: the three screens filter on
 *  different axes (the collection has scope, the builder has a search box, the
 *  squad has carried-only) and a component that took all of them would be a
 *  union of three screens wearing a trench coat. These are the PIECES they
 *  genuinely share, each holding its own value and nothing else.
 */
import { useState } from "react";
import type { CardClass, CardDef, Element, Keyword } from "../engine";
import { describePassives } from "./card-text";
import { EL_COLOR, EL_ICON, ELEMENTS, KEYWORD_STYLE, KEYWORDS, RARITY_STYLE } from "./shared";

/** Folded state, shared across all three grids under one key: it is a
 *  preference about how you browse, not a fact about the screen you are on.
 *
 *  CLOSED by default. The rows are a way to narrow 320 cards, and narrowing is
 *  the second thing anyone does — the first is look at the cards. Opening on
 *  the grid gives the phone a full extra row before a single tap.
 *
 *  Read as `=== "1"` rather than `!== "0"`, so only an explicit open is
 *  remembered as one. That also migrates the two existing values correctly:
 *  someone who had already folded them stored "0" and stays folded, someone who
 *  left them open stored "1" and stays open. */
export function useFilterFold(): [boolean, () => void] {
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("we_db_filters") === "1"; } catch { return false; }
  });
  const toggle = () => setOpen((v) => {
    try { localStorage.setItem("we_db_filters", v ? "0" : "1"); } catch { /* ignore */ }
    return !v;
  });
  return [open, toggle];
}

/** ONE control for the whole block.
 *
 *  Collapsed it keeps carrying the ACTIVE filters and the result count, because
 *  a filter still applied with its controls hidden is a grid that reads as
 *  broken. Sort never belongs in `summary`: it reorders, it never hides. */
export function FilterToggle(props: {
  open: boolean;
  onToggle: () => void;
  summary: string[];
  count: number;
}) {
  const active = props.summary.length > 0;
  return (
    <button
      className={`db-filtoggle ${props.open ? "open" : ""} ${active ? "active" : ""}`}
      onClick={props.onToggle}
      aria-expanded={props.open}
    >
      <span className="dbf-lbl">Filters</span>
      {!props.open && (
        <span className="dbf-sum">
          {active
            ? props.summary.map((t) => <em key={t}>{t}</em>)
            : <em className="dbf-none">All cards</em>}
        </span>
      )}
      <span className="dbf-count">{props.count}</span>
      <i className="dbf-chev" aria-hidden="true">{props.open ? "▴" : "▾"}</i>
    </button>
  );
}

/** A row of pills. `countFor` dims an option the other filters have emptied
 *  rather than hiding it — a row that reshuffles as you change element is
 *  harder to hit than one that stays put. */
function Row<T extends string>(props: {
  label: string;
  all: readonly T[];
  value: T | "ALL";
  onChange: (v: T | "ALL") => void;
  countFor?: (v: T) => number;
  style?: (v: T) => { color?: string; glyph?: string };
  extra?: React.ReactNode;
}) {
  return (
    <div className="db-sort">
      <span className="db-sort-lbl">{props.label}</span>
      <button
        className={`db-fl ${props.value === "ALL" ? "on" : ""}`}
        onClick={() => props.onChange("ALL")}
      >
        All
      </button>
      {props.all.map((v) => {
        const n = props.countFor?.(v);
        const st = props.style?.(v);
        const on = props.value === v;
        return (
          <button
            key={v}
            className={`db-fl ${on ? "on" : ""}`}
            onClick={() => props.onChange(on ? "ALL" : v)}
            style={{
              ...(st?.color ? {
                borderColor: st.color,
                color: st.color,
                background: on ? `color-mix(in srgb, ${st.color} 26%, transparent)` : undefined,
              } : null),
              ...(n === 0 && !on ? { opacity: 0.35 } : null),
            }}
            title={n === undefined ? undefined : `${n} card${n === 1 ? "" : "s"}`}
          >
            {st?.glyph && <i aria-hidden="true" className="db-pill-gl">{st.glyph}</i>}
            {v}
          </button>
        );
      })}
      {props.extra}
    </div>
  );
}

// ── keyword ────────────────────────────────────────────────────────────────
/** Does this card have anything to do with `kw`?
 *
 *  The PRINTED keyword is only half of it. A card that grants FLYING from its
 *  Special, or hands out BLOCK through a passive, is exactly what somebody
 *  filtering for FLYING or BLOCK is looking for — and `keywords[kw]` says no,
 *  because the pip is not on the frame. So the card's own rules text counts
 *  too: the Special's text and everything `describePassives` renders, which is
 *  the same text the card view shows you.
 *
 *  Word-boundaried, so REGEN does not match "REGENERATE" in some future line and
 *  PEN does not match the middle of a word. Cast wide on purpose: a card that
 *  says "ignores BLOCK" comes back for BLOCK, and that is a card a player asking
 *  about BLOCK wants to see.
 *
 *  Memoised because the filter rows ask this ~11 times per card per keystroke:
 *  describePassives builds strings, and 320 cards times eleven pills is real
 *  work to redo on every render. */
const KW_CACHE = new Map<string, boolean>();
export function cardHasKeyword(def: CardDef, kw: Keyword): boolean {
  if (def.keywords[kw]) return true;
  const key = `${def.id}|${kw}`;
  const hit = KW_CACHE.get(key);
  if (hit !== undefined) return hit;
  const text = [def.special?.text ?? "", ...describePassives(def)].join(" ");
  // Concatenated, not a template literal: inside a template `\b` is the
  // BACKSPACE escape rather than a word boundary, so the first cut of this
  // matched nothing and the whole widening was a silent no-op.
  const found = new RegExp("\\b" + kw + "\\b").test(text.toUpperCase());
  KW_CACHE.set(key, found);
  return found;
}
export function KeywordRow(props: {
  value: Keyword | "ALL";
  onChange: (v: Keyword | "ALL") => void;
  countFor?: (k: Keyword) => number;
}) {
  return (
    <Row
      label="Keyword"
      all={KEYWORDS}
      value={props.value}
      onChange={props.onChange}
      countFor={props.countFor}
      style={(k) => ({ color: KEYWORD_STYLE[k]?.color, glyph: KEYWORD_STYLE[k]?.glyph })}
    />
  );
}

// ── rarity ─────────────────────────────────────────────────────────────────
export const RARITIES = ["rare", "epic", "legendary", "mythic"] as const;
export type RarityFilter = (typeof RARITIES)[number] | "ALL";

export function RarityRow(props: {
  value: RarityFilter;
  onChange: (v: RarityFilter) => void;
  countFor?: (r: (typeof RARITIES)[number]) => number;
}) {
  return (
    <Row
      label="Rarity"
      all={RARITIES}
      value={props.value}
      onChange={props.onChange}
      countFor={props.countFor}
      style={(r) => ({ color: RARITY_STYLE[r]?.color })}
    />
  );
}

// ── cost ───────────────────────────────────────────────────────────────────
/** 1-6 exactly, then everything above. Costs run 1-10 and the top four buckets
 *  hold 8-13 cards each, so a pill per cost would be four rarely-useful taps on
 *  the end of the row; "7+" is also how a curve is actually read. */
export const COSTS = ["1", "2", "3", "4", "5", "6", "7+"] as const;
export type CostFilter = (typeof COSTS)[number] | "ALL";

export const matchesCost = (cost: number, f: CostFilter): boolean =>
  f === "ALL" || (f === "7+" ? cost >= 7 : cost === Number(f));

export function CostRow(props: {
  value: CostFilter;
  onChange: (v: CostFilter) => void;
  countFor?: (c: (typeof COSTS)[number]) => number;
}) {
  return (
    <Row label="Cost" all={COSTS} value={props.value} onChange={props.onChange} countFor={props.countFor} />
  );
}

// ── element / class, the two every grid already had ────────────────────────
export function ElementRow(props: {
  value: Element | "ALL";
  onChange: (v: Element | "ALL") => void;
  /** Which elements to offer. Defaults to all nine — the gallery wants that,
   *  because it shows bosses and tokens too. A grid you DEPLOY from passes
   *  `BUILDABLE_ELEMENTS` instead, so it never offers a chip with an empty
   *  grid behind it. */
  elements?: Element[];
}) {
  const list = props.elements ?? ELEMENTS;
  return (
    <div className="db-filters">
      <button className={`db-fl ${props.value === "ALL" ? "on" : ""}`} onClick={() => props.onChange("ALL")}>
        All
      </button>
      {list.map((el) => (
        <button
          key={el}
          className={`db-fl el-fl ${props.value === el ? "on" : ""}`}
          onClick={() => props.onChange(props.value === el ? "ALL" : el)}
          style={{
            borderColor: EL_COLOR[el],
            color: EL_COLOR[el],
            background: props.value === el ? `color-mix(in srgb, ${EL_COLOR[el]} 26%, transparent)` : undefined,
          }}
        >
          <img className="el-fl-sig" src={EL_ICON[el]} alt="" draggable={false}
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
          {el}
        </button>
      ))}
    </div>
  );
}

export function ClassRow(props: {
  all: readonly CardClass[];
  value: CardClass | "ALL";
  onChange: (v: CardClass | "ALL") => void;
  countFor?: (c: CardClass) => number;
}) {
  return (
    <Row label="Class" all={props.all} value={props.value} onChange={props.onChange} countFor={props.countFor} />
  );
}

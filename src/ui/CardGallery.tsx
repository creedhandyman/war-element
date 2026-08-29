/** THE CARD GALLERY — every plate in the game, in one place, with what it does.
 *
 *  The game already had two card grids and neither one is this. The DECK
 *  BUILDER shows what you can put in a squad; the COLLECTION shows what you own
 *  and where the rest of it drops. Both are about a *decision* — build this,
 *  go and fight that — and both quietly hide most of the artwork to make that
 *  decision cleaner: `CARDS.filter((d) => !d.boss)` in `StoryCollection`, and
 *  the whole `TOKENS` array is not in either, because a token is spawned rather
 *  than drafted.
 *
 *  That means 46 of the 366 painted cards in this repo — every Void Tower boss
 *  and every token — could not be looked at anywhere in the app except by
 *  meeting one in a match and tapping it before it killed you. The art exists,
 *  it is finished, and it was unreachable.
 *
 *  This screen has NO opinion and NO gate. It is a reference book: the whole
 *  set, sorted, searchable, tokens and bosses included and labelled as such,
 *  with the abilities readable on the tile and in full on tap. It never touches
 *  the save, so it can never be wrong about your progress — there is nothing
 *  for it to be wrong about.
 *
 *  WHY IT REUSES `CardView` RATHER THAN DRAWING ITS OWN DETAIL PANEL: that
 *  component's "browse" mode already renders the Special, the passives, the
 *  keyword rules and the lore for a bare `CardDef` with no match in progress
 *  (`CardView.tsx` zones 3 / 3b / 2c). A second card panel is how the two the
 *  codebase used to have drifted apart — see that file's own header. One panel,
 *  reached from three screens.
 */
import { useEffect, useMemo, useState } from "react";
import type { CardClass, CardDef, Element, Keyword } from "../engine";
import { CARDS, TOKENS } from "../data/cards";
import { EL_COLOR, EL_ICON, ELEMENTS, RARITY_STYLE } from "./shared";
import {
  ClassRow, CostRow, ElementRow, FilterToggle, KeywordRow, RarityRow,
  cardHasKeyword, matchesCost, useFilterFold, type CostFilter, type RarityFilter,
} from "./filters";
import { SpIcon } from "./icons";
import { CardView } from "./CardView";
import { describeOwnPassives } from "./card-text";

const CLASSES: CardClass[] = ["Assassin", "Warrior", "Tank", "Ranger", "Mage", "Support"];
const RARITY_RANK: Record<string, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
const rarityRank = (r?: string) => (r && r in RARITY_RANK ? RARITY_RANK[r] : 99);
const elRank = (e: Element) => ELEMENTS.indexOf(e);

/** What a card IS, for the one filter this screen adds that no other has. */
type Kind = "card" | "token" | "boss";
type KindFilter = Kind | "ALL";
type Sort = "element" | "name" | "cost" | "rarity";

export const kindOf = (d: CardDef): Kind => (d.boss ? "boss" : d.id in TOKEN_IDS ? "token" : "card");

/** Token ids as a lookup. Built once: `kindOf` runs per card per render. */
const TOKEN_IDS: Record<string, true> = Object.fromEntries(TOKENS.map((t) => [t.id, true]));

/** EVERY def in the game, bosses and tokens included — the whole point. */
export const GALLERY_DEFS: CardDef[] = [...CARDS, ...TOKENS];
const ALL = GALLERY_DEFS;

/** Who puts this token on the board.
 *
 *  Derived by scanning every card def for a string equal to the token's id,
 *  rather than by listing the fields that can spawn one. There are at least
 *  five of those (`summonSpawn`, `spawnToken` inside `special.params`,
 *  `transformOnDefeat.into`, `reviveAs`, `onHitSpawn.token`) and a sixth added
 *  later would silently stop being credited — a hand-written list of fields is
 *  a list that goes stale. A deep string match cannot.
 */
export const SPAWNED_BY: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  const tokenIds = new Set(TOKENS.map((t) => t.id));
  const hunt = (v: unknown, found: Set<string>) => {
    if (typeof v === "string") { if (tokenIds.has(v)) found.add(v); return; }
    if (Array.isArray(v)) { for (const x of v) hunt(x, found); return; }
    if (v && typeof v === "object") { for (const x of Object.values(v)) hunt(x, found); }
  };
  for (const d of ALL) {
    const found = new Set<string>();
    hunt(d, found);
    // A token that names itself (a chain-spawner) is not its own summoner.
    found.delete(d.id);
    for (const t of found) (out[t] ??= []).push(d.name);
  }
  return out;
})();

/** The one-line "what does it do" that rides on the tile.
 *
 *  The Special's NAME, not its text: the text is a paragraph and the tile is
 *  88px wide, and the name is the half a player is actually scanning for
 *  ("which one was Hogtie?"). A card with no Special falls back to its first
 *  passive, so a tile is only blank when the card genuinely has no rules on it
 *  — which is true of most tokens and is itself worth seeing.
 */
export function tileRule(d: CardDef): string | null {
  if (d.special) return d.special.name;
  const p = describeOwnPassives(d);
  return p.length > 0 ? p[0] : null;
}

/** Everything a search box should match. Built once per card, lowercased. */
function haystack(d: CardDef): string {
  return [
    d.name, d.id, d.element, d.cardClass, d.rarity ?? "",
    Array.isArray(d.tribe) ? d.tribe.join(" ") : d.tribe ?? "",
    d.special?.name ?? "", d.special?.text ?? "",
    Object.keys(d.keywords).join(" "),
    describeOwnPassives(d).join(" "),
    d.lore ?? "",
  ].join(" ").toLowerCase();
}

const HAY: Record<string, string> = Object.fromEntries(ALL.map((d) => [d.id, haystack(d)]));

export function CardGallery(props: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [el, setEl] = useState<Element | "ALL">("ALL");
  const [cls, setCls] = useState<CardClass | "ALL">("ALL");
  const [kw, setKw] = useState<Keyword | "ALL">("ALL");
  const [rar, setRar] = useState<RarityFilter>("ALL");
  const [cost, setCost] = useState<CostFilter>("ALL");
  const [sort, setSort] = useState<Sort>("element");
  // Shares the builder's and the collection's fold key, so the preference
  // follows the player between all three grids instead of being set three times.
  const [filtersOpen, toggleFilters] = useFilterFold();
  const [detailId, setDetailId] = useState<string | null>(null);
  // TAPPING A TILE OPENS THE PAINTING, not a panel about the painting. The
  // rules are one more tap from there (`showInfo`), which is the right way
  // round for a gallery — `CardView` crops the plate into a 122x150 box
  // (`styles.css` `.cd-art`, `object-fit: cover`) because it is built to be
  // read mid-match, and that box is the exact opposite of what this screen is
  // for.
  const [showInfo, setShowInfo] = useState(false);
  const [zoom, setZoom] = useState(false);

  const filterSummary = [
    kind !== "ALL" ? kind[0].toUpperCase() + kind.slice(1) + "s" : null,
    el !== "ALL" ? el : null,
    cls !== "ALL" ? cls : null,
    kw !== "ALL" ? kw : null,
    rar !== "ALL" ? rar.toUpperCase() : null,
    cost !== "ALL" ? `${cost}◆` : null,
    q.trim() ? `"${q.trim()}"` : null,
  ].filter(Boolean) as string[];
  const clearFilters = () => {
    setKind("ALL"); setEl("ALL"); setCls("ALL"); setKw("ALL"); setRar("ALL"); setCost("ALL"); setQ("");
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = ALL.filter((d) => {
      if (kind !== "ALL" && kindOf(d) !== kind) return false;
      if (el !== "ALL" && d.element !== el) return false;
      if (cls !== "ALL" && d.cardClass !== cls) return false;
      if (kw !== "ALL" && !cardHasKeyword(d, kw)) return false;
      if (rar !== "ALL" && d.rarity !== rar) return false;
      if (!matchesCost(d.cost, cost)) return false;
      if (needle && !HAY[d.id].includes(needle)) return false;
      return true;
    });
    // ELEMENT FIRST BY DEFAULT, because this screen is mostly looked at rather
    // than searched, and the eight elements are eight palettes — sorted by
    // element the grid reads as eight blocks of colour instead of noise.
    const by: Record<Sort, (a: CardDef, b: CardDef) => number> = {
      element: (a, b) => elRank(a.element) - elRank(b.element) || a.cost - b.cost || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      cost: (a, b) => a.cost - b.cost || a.name.localeCompare(b.name),
      rarity: (a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || a.cost - b.cost || a.name.localeCompare(b.name),
    };
    return list.sort(by[sort]);
  }, [q, kind, el, cls, kw, rar, cost, sort]);

  const detail = detailId ? ALL.find((d) => d.id === detailId) ?? null : null;
  const at = detail ? shown.findIndex((d) => d.id === detail.id) : -1;
  /** Open a card at the painting. `zoom` resets per card: a fill crop is a
   *  choice about THIS image, and carrying it to the next one silently crops a
   *  card the player has not looked at yet. */
  const open = (id: string) => { setDetailId(id); setShowInfo(false); setZoom(false); };
  const close = () => { setDetailId(null); setShowInfo(false); setZoom(false); };

  /** Step to the next/previous card WITHIN THE CURRENT FILTER.
   *
   *  Stepping through the unfiltered 366 would ignore the filter the player
   *  just set, which is the one thing they have told this screen. Wraps, so
   *  neither end of a filtered run is a dead button. */
  const step = (dir: 1 | -1) => {
    if (at < 0 || shown.length === 0) return;
    setDetailId(shown[(at + dir + shown.length) % shown.length].id);
    setZoom(false);
  };

  // Arrow keys drive the detail panel. A gallery you can only page with your
  // thumb is a grid; this is the cheap half of what makes it a gallery, and
  // Escape closing the panel (not the whole screen) matches every other
  // overlay-inside-an-overlay in the app.
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      // Escape steps BACK one layer rather than dumping you out of the screen:
      // rules -> painting -> grid. Closing the gallery from three layers deep
      // loses the filter and the scroll position the player set.
      else if (e.key === "Escape") {
        e.preventDefault();
        if (showInfo) setShowInfo(false); else close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // SWIPE, because this is a phone-first app and paging a gallery with a
  // 40px chevron is not how anyone looks at pictures. Horizontal-only and
  // past a threshold, so a vertical scroll or a tap never pages by accident.
  const swipe = { x: 0, y: 0 };
  const onTouchStart = (e: React.TouchEvent) => {
    swipe.x = e.touches[0].clientX; swipe.y = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - swipe.x;
    const dy = e.changedTouches[0].clientY - swipe.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
  };

  return (
    <div className="overlay gallery-overlay">
      <div className="modal gallery-modal">
        <div className="gal-head">
          <div className="gal-title">
            <h2>Card Gallery</h2>
            <span className="gal-sub">
              {ALL.length} cards · {CARDS.filter((c) => !c.boss).length} playable ·{" "}
              {CARDS.filter((c) => c.boss).length} bosses · {TOKENS.length} tokens
            </span>
          </div>
          <button className="ghost sm gal-close" onClick={props.onClose}>Close</button>
        </div>

        {/* SEARCH IS THE FIRST CONTROL, above the chips, because it is the one
            that answers the question this screen exists for — "what was that
            card called" — and it searches the RULES TEXT too, so "paralyze"
            finds every card that does it whether or not it is a keyword. */}
        <div className="gal-search">
          <input
            className="gal-q"
            type="search"
            value={q}
            placeholder="Search name, tribe, ability, lore…"
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="gal-sorts">
            {([["element", "Element"], ["name", "A–Z"], ["cost", "Cost"], ["rarity", "Rarity"]] as const).map(
              ([k, label]) => (
                <button key={k} className={`db-fl ${sort === k ? "on" : ""}`} onClick={() => setSort(k)}>
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        {/* The filter this screen adds and no other has: the two categories the
            rest of the app deliberately hides. */}
        <div className="db-filters gal-kinds">
          {([["ALL", "Everything"], ["card", "Cards"], ["boss", "Bosses"], ["token", "Tokens"]] as const).map(
            ([k, label]) => (
              <button key={k} className={`db-fl ${kind === k ? "on" : ""}`} onClick={() => setKind(k)}>
                {label}
              </button>
            ),
          )}
        </div>

        <FilterToggle open={filtersOpen} onToggle={toggleFilters} summary={filterSummary} count={shown.length} />
        {filtersOpen && (
          <>
            <ElementRow value={el} onChange={setEl} />
            <ClassRow all={CLASSES} value={cls} onChange={setCls} />
            <KeywordRow value={kw} onChange={setKw} />
            <RarityRow value={rar} onChange={setRar} />
            <CostRow value={cost} onChange={setCost} />
          </>
        )}
        {filterSummary.length > 0 && (
          <div className="db-sort">
            <button className="db-fl db-clear" onClick={clearFilters}>Clear filters</button>
          </div>
        )}

        {shown.length === 0 ? (
          <p className="story-hint gal-empty">Nothing matches that.</p>
        ) : (
          <div className="db-grid gal-grid">
            {shown.map((d) => {
              const k = kindOf(d);
              const rs = d.rarity ? RARITY_STYLE[d.rarity] : null;
              const rule = tileRule(d);
              return (
                <div
                  key={d.id}
                  className={`deck-thumb carded db-card gal-card ${k}`}
                  role="button"
                  tabIndex={0}
                  title={`${d.name} — ${d.element} ${d.cardClass}${rule ? ` · ${rule}` : ""}`}
                  onClick={() => open(d.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(d.id); }
                  }}
                >
                  {/* `loading="lazy"` is the whole performance story: 366 plates
                      is more than any other grid in the app asks for at once,
                      and the browser only fetches the dozen actually on screen. */}
                  <img
                    className="card-art"
                    src={`/cards/${d.art ?? d.id}.webp`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                  <div className="dt-top">
                    <span
                      className="dt-cost"
                      title={`${d.element} · cost ${d.cost}`}
                      style={{ borderColor: EL_COLOR[d.element], backgroundImage: `url(${EL_ICON[d.element]})` }}
                    >
                      <b>{d.cost}</b>
                    </span>
                    {/* SAY WHICH ONES ARE NOT NORMAL CARDS. A token sitting
                        unlabelled next to a 6-cost legendary reads as something
                        you could draft, and nothing else on the tile would
                        correct that. */}
                    {k !== "card" && <span className={`gal-kind k-${k}`}>{k === "boss" ? "BOSS" : "TOKEN"}</span>}
                  </div>
                  {rs && (
                    <span className="dt-rarity" style={{ color: rs.color, borderColor: rs.color }}>
                      {rs.label}
                    </span>
                  )}
                  <div className="dt-name">{d.name}</div>
                  {rule && <div className="gal-rule">{rule}</div>}
                  <div className="dt-stats">
                    <span className="s-dmg">
                      ⚔<span className="atk-dmg">{d.dmg}</span>
                      {d.hits > 1 ? <span className="atk-x"> ×{d.hits}</span> : ""}
                    </span>
                    <span className="s-hp">♥{d.hp}</span>
                    <span className="s-sp"><SpIcon />{d.sp}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── THE PLATE, FULL SCREEN ────────────────────────────────────────
          The reason the screen exists. `object-fit: contain` on a near-black
          field, so the WHOLE painting is on screen and nothing is cropped —
          every other place a card is drawn in this app uses `cover` and cuts
          the edges off, which is correct for a 60px board token and wrong here.

          Chrome is deliberately thin and sits in scrims at the two edges: a
          gallery that frames a picture in a panel of buttons is showing you the
          panel. */}
      {detail && (
        <div
          /* `reading` drops the lightbox BELOW --z-modal while the abilities
             panel is up. It normally sits at --z-modal + 1 so the painting
             covers the gallery behind it — but the abilities panel IS a card
             view, which lives at --z-modal, so that +1 meant tapping Abilities
             opened the rules UNDERNEATH the painting: the button worked, the
             state flipped, and nothing appeared. */
          className={`gal-lightbox ${zoom ? "zoomed" : ""} ${showInfo ? "reading" : ""}`}
          onClick={close}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          role="dialog"
          aria-label={`${detail.name} — full size`}
        >
          <img
            className="gal-plate"
            src={`/cards/${detail.art ?? detail.id}.webp`}
            alt={detail.name}
            // Tap the ART to fill the screen with it; tap the backdrop to
            // leave. Two different targets for two different intentions, so
            // neither one steals the other's tap.
            onClick={(e) => { e.stopPropagation(); setZoom((z) => !z); }}
          />

          <div className="gal-lb-top" onClick={(e) => e.stopPropagation()}>
            <span className="gal-lb-count">{at >= 0 ? `${at + 1} / ${shown.length}` : ""}</span>
            <button className="gal-lb-btn" onClick={close} aria-label="Back to the grid">✕</button>
          </div>

          {/* The pager is on the ART, not under it — full-bleed tap columns
              down each side, so a thumb reaches them without aiming. */}
          {shown.length > 1 && (
            <>
              <button
                className="gal-lb-nav prev"
                onClick={(e) => { e.stopPropagation(); step(-1); }}
                aria-label="Previous card"
              ><span>‹</span></button>
              <button
                className="gal-lb-nav next"
                onClick={(e) => { e.stopPropagation(); step(1); }}
                aria-label="Next card"
              ><span>›</span></button>
            </>
          )}

          <div className="gal-lb-foot" onClick={(e) => e.stopPropagation()}>
            <div className="gal-lb-id">
              <b style={{ color: EL_COLOR[detail.element] }}>{detail.name}</b>
              <span>
                {detail.element} · {detail.cardClass}
                {/* `k-` PREFIXED. A bare `token` here also matched the BOARD's
                    own .token class — `position: absolute; inset: 3%` — so this
                    little chip inflated to fill the whole footer and swallowed
                    every tap meant for the Abilities button beside it. */}
                {kindOf(detail) !== "card" && (
                  <em className={`gal-kind k-${kindOf(detail)}`}>
                    {kindOf(detail) === "boss" ? "BOSS" : "TOKEN"}
                  </em>
                )}
              </span>
            </div>
            {/* The abilities the request asked to stay viewable — one tap from
                the painting rather than wrapped around it. */}
            <button className="lockin sm gal-lb-info" onClick={() => setShowInfo(true)}>
              Abilities
            </button>
          </div>
        </div>
      )}

      {/* The full rules, over the painting. Same panel the board and the
          collection open, so what you learn here you already know mid-match. */}
      {detail && showInfo && (
        <CardView
          mode="browse"
          def={detail}
          onClose={() => setShowInfo(false)}
          extra={
            <div className="gal-extra">
              <div className="gal-extra-line">
                <b>{kindOf(detail) === "boss" ? "Void Tower boss" : kindOf(detail) === "token" ? "Token" : "Card"}</b>
                {detail.tribe && (
                  <span> · {Array.isArray(detail.tribe) ? detail.tribe.join(" / ") : detail.tribe}</span>
                )}
              </div>
              {/* The one fact a token's own card cannot tell you: what puts it
                  on the board. Without it a token is a picture of something you
                  have no way to reach. */}
              {SPAWNED_BY[detail.id] && (
                <div className="gal-extra-line">
                  <b>Summoned by</b> <span>{SPAWNED_BY[detail.id].join(", ")}</span>
                </div>
              )}
              {at >= 0 && (
                <div className="gal-step">
                  <button className="ghost sm" onClick={() => step(-1)} aria-label="Previous card">‹</button>
                  <span className="gal-step-n">{at + 1} of {shown.length}</span>
                  <button className="ghost sm" onClick={() => step(1)} aria-label="Next card">›</button>
                </div>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}

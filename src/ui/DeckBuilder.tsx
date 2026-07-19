import { useEffect, useMemo, useState } from "react";
import type { CardClass, Element } from "../engine";
import { getDef, SPELLS } from "../engine";
import {
  buildableCards,
  deleteCustomDeck,
  loadCustomDecks,
  MAX_DECK,
  MAX_SPELLS,
  MIN_DECK,
  saveCustomDeck,
  TARGET_DECK,
  validateDeck,
  type CustomDeck,
} from "../data/custom-decks";
import { EL_COLOR, EL_ICON, RARITY_STYLE, spellArtSrc } from "./shared";
import { chipify, describePassives } from "./CardDetail";
import { SpIcon } from "./icons";

const ELEMENTS: Element[] = ["LEAF", "PYRO", "AQUA", "DAWN", "GALE", "BOLT", "DUSK", "BORE"];
const CLASSES: CardClass[] = ["Assassin", "Warrior", "Tank", "Ranger", "Mage", "Support"];

// Card-pool sort options + rarity order (mythic first → common; unknown last).
const SORTS = [["cost", "Cost"], ["rarity", "Rarity"], ["name", "Name"]] as const;
type SortKey = (typeof SORTS)[number][0];
const RARITY_RANK: Record<string, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
const rarityRank = (r?: string) => (r && r in RARITY_RANK ? RARITY_RANK[r] : 99);

/**
 * Build / edit / delete custom decks (12–20 cards). A sandbox for trying new
 * cards without touching the Core system. Persists to localStorage; calls
 * `onChange` so the picker can refresh its list.
 */
export function DeckBuilder(props: {
  open: boolean;
  onClose: () => void;
  onChange: (decks: CustomDeck[]) => void;
}) {
  const [decks, setDecks] = useState<CustomDeck[]>(() => loadCustomDecks());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [pickedSpells, setPickedSpells] = useState<string[]>([]);
  const [filter, setFilter] = useState<Element | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("cost");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [spellsOpen, setSpellsOpen] = useState<boolean | null>(null);
  // Composition + Saved decks collapse to headers on phones so the card pool gets
  // the room (open on desktop, where there's a side column for them). Default
  // (null) follows the CURRENT viewport each render — evaluated live rather than
  // at mount — until the user toggles.
  const phone = typeof window !== "undefined" && (window.matchMedia?.("(max-width: 720px)").matches ?? false);
  const [compOpen, setCompOpen] = useState<boolean | null>(null);
  const [savedOpen, setSavedOpen] = useState<boolean | null>(null);
  const compShown = compOpen ?? !phone;
  const savedShown = savedOpen ?? !phone;
  const spellsShown = spellsOpen ?? !phone;

  const pool = useMemo(() => buildableCards(), []);
  // Filter by element, then sort. Default "cost" reads the mana curve low→high,
  // breaking ties by rarity (mythic first) then name.
  const shown = useMemo(() => {
    const base = filter === "ALL" ? pool : pool.filter((c) => c.element === filter);
    return [...base].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "rarity")
        return rarityRank(a.rarity) - rarityRank(b.rarity) || a.cost - b.cost || a.name.localeCompare(b.name);
      return a.cost - b.cost || rarityRank(a.rarity) - rarityRank(b.rarity) || a.name.localeCompare(b.name);
    });
  }, [pool, filter, sortBy]);
  const pickedSet = new Set(picked);
  const check = validateDeck(picked);

  // Live composition of the deck being built — by element, class, and cost curve.
  const stats = useMemo(() => {
    const byElement: Record<string, number> = {};
    const byClass: Record<string, number> = {};
    const byCost: Record<number, number> = {};
    let costSum = 0;
    for (const id of picked) {
      const d = getDef(id);
      byElement[d.element] = (byElement[d.element] ?? 0) + 1;
      byClass[d.cardClass] = (byClass[d.cardClass] ?? 0) + 1;
      byCost[d.cost] = (byCost[d.cost] ?? 0) + 1;
      costSum += d.cost;
    }
    const maxCostCount = Math.max(1, ...Object.values(byCost));
    return { byElement, byClass, byCost, maxCostCount, avg: picked.length ? costSum / picked.length : 0 };
  }, [picked]);

  // Keep the spellbook tied to the deck's elements: drop any picked spell whose
  // element the deck no longer plays (e.g. after pulling the last card of that
  // element) — plus any stale/unknown id. Runs on deck edits + on load.
  useEffect(() => {
    const els = new Set(picked.map((id) => getDef(id).element));
    setPickedSpells((cur) => {
      const next = cur.filter((id) => {
        const el = SPELLS.find((s) => s.id === id)?.element;
        return el != null && els.has(el);
      });
      return next.length === cur.length ? cur : next;
    });
  }, [picked]);

  if (!props.open) return null;

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_DECK ? cur : [...cur, id]));
  }
  // A deck's spellbook: up to MAX_SPELLS spells, castable once each in a match.
  function toggleSpell(id: string) {
    setPickedSpells((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_SPELLS ? cur : [...cur, id]));
  }
  function reset() {
    setEditingId(null);
    setName("");
    setPicked([]);
    setPickedSpells([]);
  }
  function loadForEdit(d: CustomDeck) {
    setEditingId(d.id);
    setName(d.name);
    setPicked(d.cards.slice());
    setPickedSpells((d.spells ?? []).slice());
  }
  function save() {
    if (!check.ok) return;
    const next = saveCustomDeck({ id: editingId ?? undefined, name, cards: picked, spells: pickedSpells });
    setDecks(next);
    props.onChange(next);
    reset();
  }
  function remove(id: string) {
    const next = deleteCustomDeck(id);
    setDecks(next);
    props.onChange(next);
    if (editingId === id) reset();
  }

  const countColor = check.ok ? "var(--legal)" : picked.length > MAX_DECK ? "var(--threat)" : "var(--muted)";
  const detail = detailId ? getDef(detailId) : null;

  // The spellbook is restricted to the deck's own elements — only spells whose
  // element the deck actually plays are offered (others would just fizzle in
  // play). Sorted by cost then name.
  const deckEls = new Set(picked.map((id) => getDef(id).element));
  const deckSpells = SPELLS
    .filter((s) => deckEls.has(s.element))
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

  return (
    <div className="overlay" onClick={props.onClose}>
      <div className="modal deck-builder" onClick={(e) => e.stopPropagation()}>
        <div className="db-head">
          <h2>Deck Builder</h2>
          <button className="cd-x" title="Close" onClick={props.onClose}>✕</button>
        </div>

        <div className="db-body">
          {/* Left: saved decks, the editor's meta, and live deck composition. */}
          <div className="db-side">
            <input
              className="db-name"
              placeholder="Deck name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={28}
            />
            <div className="db-count" style={{ color: countColor }}>
              {picked.length} / {MAX_DECK}
              <span className="db-hint"> · {MIN_DECK}–{MAX_DECK} (aim {TARGET_DECK})</span>
            </div>
            <div className="db-actions">
              <button className="lockin" disabled={!check.ok} onClick={save}>
                {editingId ? "Update" : "Save"} deck
              </button>
              <button className="ghost" onClick={reset}>New / clear</button>
            </div>
            {!check.ok && picked.length > 0 && <div className="db-warn">{check.reason}</div>}

            {/* Deck composition — cards per element / class / cost. */}
            {picked.length > 0 && (
              <div className="db-stats">
                <button className="db-stats-h db-collapse" onClick={() => setCompOpen(!compShown)}>
                  <span>Composition · avg cost {stats.avg.toFixed(1)}</span>
                  <span className="db-chev">{compShown ? "▾" : "▸"}</span>
                </button>
                {compShown && (<>
                <div className="dbs-block">
                  <div className="dbs-lbl">Elements</div>
                  <div className="dbs-tags">
                    {ELEMENTS.filter((el) => stats.byElement[el]).map((el) => (
                      <span key={el} className="dbs-tag" style={{ borderColor: EL_COLOR[el] }}>
                        <span className="dbs-dot" style={{ background: EL_COLOR[el] }} />
                        {el} {stats.byElement[el]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="dbs-block">
                  <div className="dbs-lbl">Classes</div>
                  <div className="dbs-tags">
                    {CLASSES.filter((c) => stats.byClass[c]).map((c) => (
                      <span key={c} className="dbs-tag">{c} {stats.byClass[c]}</span>
                    ))}
                  </div>
                </div>
                <div className="dbs-block">
                  <div className="dbs-lbl">Cost curve</div>
                  <div className="dbs-curve">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((cost) => {
                      const n = stats.byCost[cost] ?? 0;
                      return (
                        <div key={cost} className="dbs-col" title={`Cost ${cost}: ${n}`}>
                          <div className="dbs-bar-wrap">
                            {n > 0 && (
                              <div className="dbs-bar" style={{ height: `${(n / stats.maxCostCount) * 100}%` }}>
                                <span className="dbs-barnum">{n}</span>
                              </div>
                            )}
                          </div>
                          <div className="dbs-cost">{cost}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </>)}
              </div>
            )}

            {/* Spellbook — up to 5 spells this deck carries into a match (each
                castable once). None picked = the engine auto-fills one from the
                deck's elements, exactly as before. */}
            <div className="db-spells">
              <button className="db-spells-h db-collapse" onClick={() => setSpellsOpen(!spellsShown)}>
                <span>Spellbook · {pickedSpells.length}/{MAX_SPELLS}</span>
                <span className="db-chev">{spellsShown ? "▾" : "▸"}</span>
              </button>
              {spellsShown && (<>
                <div className="db-spell-hint">
                  {deckEls.size === 0
                    ? "Add cards to your deck to unlock its element spells."
                    : pickedSpells.length === 0
                    ? "None picked — auto-filled from your deck's elements at match start."
                    : "Tap a spell to add or remove it."}
                </div>
                {deckSpells.length > 0 && (
                <div className="db-spell-grid">
                  {deckSpells.map((s) => {
                    const on = pickedSpells.includes(s.id);
                    const full = !on && pickedSpells.length >= MAX_SPELLS;
                    return (
                      <button
                        key={s.id}
                        className={`db-spell ${on ? "on" : ""}`}
                        style={{ ["--el" as string]: EL_COLOR[s.element] }}
                        disabled={full}
                        title={`${s.name} (cost ${s.cost} · ${s.element}) — ${s.text}`}
                        onClick={() => toggleSpell(s.id)}
                      >
                        <span className="db-spell-art">
                          <img src={spellArtSrc(s.id)} alt="" draggable={false}
                            onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        </span>
                        <span className="db-spell-cost">{s.cost}</span>
                        <span className="db-spell-mark">{on ? "✓" : "+"}</span>
                        <span className="db-spell-name">{s.name}</span>
                      </button>
                    );
                  })}
                </div>
                )}
              </>)}
            </div>

            <div className="db-saved">
              <button className="db-saved-h db-collapse" onClick={() => setSavedOpen(!savedShown)}>
                <span>Saved decks{decks.length ? ` (${decks.length})` : ""}</span>
                <span className="db-chev">{savedShown ? "▾" : "▸"}</span>
              </button>
              {savedShown && (<>
              {decks.length === 0 && <div className="db-empty">None yet — build one →</div>}
              {decks.map((d) => (
                <div key={d.id} className={`db-saved-row ${editingId === d.id ? "on" : ""}`}>
                  <button className="db-load" onClick={() => loadForEdit(d)} title="Edit this deck">
                    <b>{d.name}</b>
                    <span>{d.cards.length} cards{d.spells && d.spells.length ? ` · ${d.spells.length} spells` : ""}</span>
                  </button>
                  <button className="db-del" title="Delete" onClick={() => remove(d.id)}>🗑</button>
                </div>
              ))}
              </>)}
            </div>
          </div>

          {/* Right: the card pool. Tap a card for details; the corner button adds. */}
          <div className="db-pool">
            <div className="db-filters">
              <button className={`db-fl ${filter === "ALL" ? "on" : ""}`} onClick={() => setFilter("ALL")}>All</button>
              {ELEMENTS.map((el) => (
                <button
                  key={el}
                  className={`db-fl ${filter === el ? "on" : ""}`}
                  onClick={() => setFilter(el)}
                  style={filter === el ? { borderColor: EL_COLOR[el], color: EL_COLOR[el] } : undefined}
                >
                  {el}
                </button>
              ))}
            </div>
            <div className="db-sort">
              <span className="db-sort-lbl">Sort</span>
              {SORTS.map(([key, label]) => (
                <button
                  key={key}
                  className={`db-fl ${sortBy === key ? "on" : ""}`}
                  onClick={() => setSortBy(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="db-grid">
              {shown.map((d) => {
                const on = pickedSet.has(d.id);
                const rar = d.rarity ? RARITY_STYLE[d.rarity] : null;
                return (
                  <div
                    key={d.id}
                    className={`deck-thumb carded db-card ${on ? "selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    title={`${d.name} — tap for details`}
                    onClick={() => setDetailId(d.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailId(d.id); } }}
                  >
                    <img
                      className="card-art"
                      src={`/cards/${d.art ?? d.id}.png`}
                      alt=""
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                    <div className="dt-top">
                      <span className="dt-cost">{d.cost}</span>
                      <span className="dt-el" title={d.element} style={{ borderColor: EL_COLOR[d.element] }}>
                        <img src={EL_ICON[d.element]} alt={d.element} draggable={false}
                          onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      </span>
                      <div className="dt-tr">
                        {rar && (
                          <span className="dt-rarity" style={{ color: rar.color, borderColor: rar.color }}>
                            {rar.label}
                          </span>
                        )}
                        <button
                          className={`dt-add ${on ? "on" : ""}`}
                          title={on ? "Remove from deck" : "Add to deck"}
                          onClick={(e) => { e.stopPropagation(); toggle(d.id); }}
                        >
                          {on ? "✓" : "+"}
                        </button>
                      </div>
                    </div>
                    <div className="dt-name">{d.name}</div>
                    <div className="dt-stats">
                      <span>⚔{d.hits > 1 ? `${d.hits}×` : ""}{d.dmg}</span>
                      <span>♥{d.hp}</span>
                      <span><SpIcon />{d.sp}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded card details — a sub-overlay above the builder. */}
      {detail && (
        <div className="overlay dbd-overlay" onClick={(e) => { e.stopPropagation(); setDetailId(null); }}>
          <div className="modal dbd-modal" onClick={(e) => e.stopPropagation()}>
            <button className="cd-x" title="Close" onClick={() => setDetailId(null)}>✕</button>
            {/* Full, uncropped card art at the top of the expanded card. Collapses
                cleanly if the card has no art yet (info still shows below). */}
            <div className="dbd-art-full" style={{ borderColor: EL_COLOR[detail.element] }}>
              <img
                src={`/cards/${detail.art ?? detail.id}.png`}
                alt={detail.name}
                onError={(e) => { const h = e.currentTarget.closest(".dbd-art-full"); if (h) (h as HTMLElement).style.display = "none"; }}
              />
              <span className="dbd-cost">{detail.cost}</span>
              <span className="dbd-el-badge" title={detail.element} style={{ borderColor: EL_COLOR[detail.element] }}>
                <img src={EL_ICON[detail.element]} alt={detail.element} draggable={false}
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
              </span>
            </div>
            <div className="dbd-head">
              <div className="dbd-meta">
                <div className="dbd-name">{detail.name}</div>
                <div className="dbd-sub">
                  <span className="dbd-el" style={{ background: EL_COLOR[detail.element] }}>{detail.element}</span>
                  <span>{detail.cardClass}</span>
                  <span>{detail.attackType === "Melee" ? "🗡 Melee" : "🏹 Ranged"}</span>
                  {detail.rarity && RARITY_STYLE[detail.rarity] && (
                    <span className="dbd-rar" style={{ color: RARITY_STYLE[detail.rarity].color, borderColor: RARITY_STYLE[detail.rarity].color }}>
                      {RARITY_STYLE[detail.rarity].label}
                    </span>
                  )}
                  {detail.tribe && <span className="dbd-tribe">{detail.tribe}</span>}
                </div>
                <div className="dbd-stats">
                  <span className="st-dmg">⚔ {detail.hits > 1 ? `${detail.hits}× ` : ""}{detail.dmg}</span>
                  <span className="st-hp">♥ {detail.hp}</span>
                  <span className="st-sh">🛡 {detail.shields}</span>
                  <span><SpIcon /> {detail.sp}</span>
                </div>
                {Object.keys(detail.keywords).length > 0 && (
                  <div className="dbd-kws">
                    {Object.entries(detail.keywords).map(([k, v]) => (
                      <span key={k} className="dbd-kw">{v === true ? k : `${k} ${v}`}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {detail.special && (
              <div className="dbd-sect">
                <div className="dbd-h">{detail.special.talent ? "Talent" : "Special"} · {detail.special.name} <span className="dbd-scost">{detail.special.talent ? "1×" : `${detail.special.cost}◆`}</span></div>
                <p className="dbd-txt">{chipify(detail.special.text)}</p>
              </div>
            )}

            <div className="dbd-sect">
              <div className="dbd-h">Passives</div>
              <ul className="dbd-passives">
                {describePassives(detail).map((line, i) => (
                  <li key={i}>{chipify(line)}</li>
                ))}
              </ul>
            </div>

            <button
              className={pickedSet.has(detail.id) ? "ghost dbd-toggle" : "lockin dbd-toggle"}
              disabled={!pickedSet.has(detail.id) && picked.length >= MAX_DECK}
              onClick={() => { toggle(detail.id); setDetailId(null); }}
            >
              {pickedSet.has(detail.id) ? "− Remove from deck" : "+ Add to deck"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

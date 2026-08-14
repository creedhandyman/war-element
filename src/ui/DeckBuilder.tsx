import { useEffect, useMemo, useState } from "react";
import type { CardClass, Element } from "../engine";
import { getDef, SPELLS } from "../engine";
import {
  buildableCards,
  deleteCustomDeck,
  loadCustomDecks,
  deckLimits,
  saveCustomDeck,
  validateDeck,
  type CustomDeck,
} from "../data/custom-decks";
import { EL_COLOR, EL_ICON, RARITY_STYLE, spellArtSrc } from "./shared";
import { CardView } from "./CardView";
import { DeckStats, useComposition } from "./DeckStats";
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
/** Story Mode reuses this whole screen rather than growing a second, worse deck
 *  editor beside it. What changes is only the edges: the pool is what you have
 *  actually recruited, the ceiling is the campaign's, and a save writes a named
 *  TEAM into the story save instead of a custom deck. Everything in between —
 *  filters, sorting, the cost curve, card detail — is the same tool. */
export interface StoryBuildMode {
  /** Card ids the player owns. The pool is filtered to these. */
  owned: string[];
  /** Named teams already saved in the campaign. */
  teams: { id: string; name: string; element?: string; cards: string[] }[];
  /** The campaign's ceiling for the fight being prepared for. */
  cap: number;
  /** Tag applied to a team saved from here, so prep can float it to the top. */
  element?: string;
  onSaveTeam: (name: string, cards: string[]) => void;
  onDeleteTeam: (id: string) => void;
}

export function DeckBuilder(props: {
  open: boolean;
  onClose: () => void;
  onChange: (decks: CustomDeck[]) => void;
  /** Battlefield the player is building for — decides the legal deck size
   *  (18 on the standard board, 28 on the large one). */
  boardSize?: number;
  /** Present = building a campaign team, not a custom deck. */
  story?: StoryBuildMode;
}) {
  const story = props.story;
  // Which battlefield this deck is being built for — you can build an 18-card
  // (4×4) or a 28-card (5×5) deck regardless of the current game mode.
  const [buildSize, setBuildSize] = useState<number>(props.boardSize ?? 4);
  // Story Mode's ceiling is the campaign's, not the format's. `min` stays 1 —
  // `loadoutLegal` deliberately treats the cap as a ceiling, not a quota, so a
  // twelve-card team is a legal choice and the builder must not call it broken.
  const limits = story
    ? { ...deckLimits(buildSize), min: 1, max: story.cap, target: story.cap }
    : deckLimits(buildSize);
  const [decks, setDecks] = useState<CustomDeck[]>(() => loadCustomDecks());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [pickedSpells, setPickedSpells] = useState<string[]>([]);
  const [filter, setFilter] = useState<Element | "ALL">("ALL");
  const [classFilter, setClassFilter] = useState<CardClass | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("cost");
  const [detailId, setDetailId] = useState<string | null>(null);
  // Composition / Spellbook / Saved live behind one compact tool-pill row and
  // open one-at-a-time below it, so the card pool keeps the screen. Desktop has
  // the room to start with Composition open; phone starts clean.
  const phone = typeof window !== "undefined" && (window.matchMedia?.("(max-width: 720px)").matches ?? false);
  const [panel, setPanel] = useState<"comp" | "spells" | "saved" | null>(phone ? null : "comp");
  const togglePanel = (p: "comp" | "spells" | "saved") => setPanel((cur) => (cur === p ? null : p));
  const compShown = panel === "comp";
  const savedShown = panel === "saved";
  const spellsShown = panel === "spells";

  const ownedSet = useMemo(() => new Set(story?.owned ?? []), [story?.owned]);
  const pool = useMemo(
    () => (story ? buildableCards().filter((c) => ownedSet.has(c.id)) : buildableCards()),
    [story, ownedSet],
  );
  // Filter by element and class (they stack — GALE + Ranger narrows to both),
  // then sort. Default "cost" reads the Gold curve low→high, breaking ties by
  // rarity (mythic first) then name.
  const shown = useMemo(() => {
    const base = pool.filter(
      (c) =>
        (filter === "ALL" || c.element === filter) &&
        (classFilter === "ALL" || c.cardClass === classFilter),
    );
    return [...base].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "rarity")
        return rarityRank(a.rarity) - rarityRank(b.rarity) || a.cost - b.cost || a.name.localeCompare(b.name);
      return a.cost - b.cost || rarityRank(a.rarity) - rarityRank(b.rarity) || a.name.localeCompare(b.name);
    });
  }, [pool, filter, classFilter, sortBy]);
  const pickedSet = new Set(picked);
  const check = story
    ? picked.length === 0
      ? { ok: false as const, reason: "Empty team" }
      : picked.length > story.cap
        ? { ok: false as const, reason: `${picked.length} cards — the cap is ${story.cap}` }
        : { ok: true as const, reason: undefined }
    : validateDeck(picked, buildSize);

  // Live composition of the deck being built — shared with the campaign
  // collection, which shows the same readout in its deck rail.
  const stats = useComposition(picked);

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
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= limits.max ? cur : [...cur, id]));
  }
  // A deck's spellbook: up to limits.spells (5 standard / 8 large), each castable
  // once in a match.
  function toggleSpell(id: string) {
    setPickedSpells((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= limits.spells ? cur : [...cur, id]));
  }
  function reset() {
    setEditingId(null);
    setName("");
    setPicked([]);
    setPickedSpells([]);
  }
  function save() {
    if (!check.ok) return;
    if (story) {
      story.onSaveTeam(name.trim() || `${story.element ?? "New"} team`, picked);
      reset();
      return;
    }
    const next = saveCustomDeck({ id: editingId ?? undefined, name, cards: picked, spells: pickedSpells });
    setDecks(next);
    props.onChange(next);
    reset();
  }
  function remove(id: string) {
    if (story) { story.onDeleteTeam(id); if (editingId === id) reset(); return; }
    const next = deleteCustomDeck(id);
    setDecks(next);
    props.onChange(next);
    if (editingId === id) reset();
  }

  const countColor = check.ok ? "var(--legal)" : picked.length > limits.max ? "var(--threat)" : "var(--muted)";
  const detail = detailId ? getDef(detailId) : null;

  // The spellbook is restricted to the deck's own elements — only spells whose
  // element the deck actually plays are offered (others would just fizzle in
  // play). Sorted by cost then name.
  const deckEls = new Set(picked.map((id) => getDef(id).element));
  const deckSpells = SPELLS
    .filter((s) => deckEls.has(s.element))
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

  return (
    // `on-top` in story mode: the campaign screens (.story-wrap, z-70) sit ABOVE
    // the plain overlay layer (z-65), so without it "Build a team" opened the
    // builder UNDERNEATH the collection — invisible there, and then suddenly
    // visible over the home screen once story mode was closed, because the
    // builder was still open the whole time.
    <div className={`overlay ${story ? "on-top" : ""}`} onClick={props.onClose}>
      <div className="modal deck-builder" onClick={(e) => e.stopPropagation()}>
        <div className="db-head">
          <h2>{story ? "Build a team" : "Deck Builder"}</h2>
          <button className="cd-x" title="Close" onClick={props.onClose}>✕</button>
        </div>

        <div className="db-body">
          {/* Left: saved decks, the editor's meta, and live deck composition. */}
          <div className="db-side">
            <input
              className="db-name"
              placeholder={story ? `${story.element ?? "New"} team` : "Deck name"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={28}
            />
            {/* The board toggle is a FORMAT control. In the campaign the board
                belongs to the node you are about to fight, so there is nothing
                here to choose — the cap is simply stated. */}
            {story ? (
              <div className="db-storycap">
                carry up to <b>{story.cap}</b>
                {story.cap > 18 && <span> · set-piece size</span>}
              </div>
            ) : (
              <div className="db-size">
                {/* Switching board also switches the spellbook cap (5 / 8), so trim
                    any picks the smaller board can't legally hold. */}
                <button className={buildSize === 4 ? "act" : ""} onClick={() => { setBuildSize(4); setPickedSpells((cur) => cur.slice(0, deckLimits(4).spells)); }}>4×4 · 18</button>
                <button className={buildSize === 5 ? "act" : ""} onClick={() => setBuildSize(5)}>5×5 · 28</button>
              </div>
            )}
            {/* ONE number: cards picked out of the target for this battlefield.
                The min/max band only appears when the deck isn't legal yet —
                "0/20 · 12–20 (aim 18)" next to a "4×4 · 18" toggle was three
                different numbers for the same thing. */}
            <div className="db-count" style={{ color: countColor }}>
              {picked.length} / {limits.target} cards
              {!check.ok && limits.min > 1 && (
                <span className="db-hint"> · needs {limits.min}–{limits.max}</span>
              )}
            </div>
            <div className="db-actions">
              <button className="lockin" disabled={!check.ok} onClick={save}>
                {story ? "Save team" : `${editingId ? "Update" : "Save"} deck`}
              </button>
              <button className="ghost" onClick={reset}>New / clear</button>
            </div>
            {!check.ok && picked.length > 0 && <div className="db-warn">{check.reason}</div>}

            {/* Compact tool row — one tap opens Composition / Spellbook / Saved
                in a panel below, one at a time, so the card pool keeps the room. */}
            <div className="db-tools">
              {picked.length > 0 && (
                <button className={`db-tool ${compShown ? "on" : ""}`} onClick={() => togglePanel("comp")}>
                  Comp · {stats.avg.toFixed(1)}
                </button>
              )}
              {/* A story battle is dealt NO spellbook (App passes [] for both
                  sides), so offering one here would be a promise the campaign
                  does not keep. */}
              {!story && (
                <button className={`db-tool ${spellsShown ? "on" : ""}`} onClick={() => togglePanel("spells")}>
                  Spells {pickedSpells.length}/{limits.spells}
                </button>
              )}
              <button className={`db-tool ${savedShown ? "on" : ""}`} onClick={() => togglePanel("saved")}>
                {story
                  ? `Teams${story.teams.length ? ` ${story.teams.length}` : ""}`
                  : `Saved${decks.length ? ` ${decks.length}` : ""}`}
              </button>
            </div>

            {/* Deck composition — cards per element / class / cost. */}
            {compShown && picked.length > 0 && <DeckStats stats={stats} />}

            {/* Spellbook — up to 5 spells this deck carries into a match (each
                castable once). None picked = the engine auto-fills one from the
                deck's elements, exactly as before. */}
            {spellsShown && (
              <div className="db-spells db-panel">
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
                    const full = !on && pickedSpells.length >= limits.spells;
                    return (
                      <button
                        key={s.id}
                        className={`db-spell ${on ? "on" : ""}`}
                        data-el={s.element}
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
              </div>
            )}

            {savedShown && (
              <div className="db-saved db-panel">
              {(story ? story.teams : decks).length === 0 && (
                <div className="db-empty">None yet — build one →</div>
              )}
              {(story
                ? story.teams.map((t) => ({ id: t.id, name: t.name, cards: t.cards, spells: undefined, tag: t.element }))
                : decks.map((d) => ({ id: d.id, name: d.name, cards: d.cards, spells: d.spells, tag: undefined }))
              ).map((d) => (
                <div key={d.id} className={`db-saved-row ${editingId === d.id ? "on" : ""}`}>
                  <button
                    className="db-load"
                    onClick={() => { setEditingId(d.id); setName(d.name); setPicked(d.cards.slice()); if (!story) setPickedSpells((d.spells ?? []).slice()); }}
                    title={story ? "Load this team" : "Edit this deck"}
                  >
                    <b>{d.name}</b>
                    <span>
                      {d.cards.length} cards
                      {d.spells && d.spells.length ? ` · ${d.spells.length} spells` : ""}
                      {d.tag ? ` · for ${d.tag}` : ""}
                    </span>
                  </button>
                  <button className="db-del" title="Delete" onClick={() => remove(d.id)}>🗑</button>
                </div>
              ))}
              </div>
            )}
          </div>

          {/* Right: the card pool. Tap a card for details; the corner button adds. */}
          <div className="db-pool">
            <div className="db-filters">
              <button className={`db-fl ${filter === "ALL" ? "on" : ""}`} onClick={() => setFilter("ALL")}>All</button>
              {/* Always in the element's own colour — a wall of identical grey
                  pills made you read every label to find an element. Selected
                  additionally gets the tinted fill. */}
              {ELEMENTS.map((el) => (
                <button
                  key={el}
                  className={`db-fl el-fl ${filter === el ? "on" : ""}`}
                  onClick={() => setFilter(el)}
                  style={{
                    borderColor: EL_COLOR[el],
                    color: EL_COLOR[el],
                    background: filter === el ? `color-mix(in srgb, ${EL_COLOR[el]} 26%, transparent)` : undefined,
                  }}
                >
                  <span className="el-fl-dot" style={{ background: EL_COLOR[el] }} />
                  {el}
                </button>
              ))}
            </div>
            <div className="db-sort">
              <span className="db-sort-lbl">Class</span>
              <button
                className={`db-fl ${classFilter === "ALL" ? "on" : ""}`}
                onClick={() => setClassFilter("ALL")}
              >
                All
              </button>
              {CLASSES.map((c) => {
                // Dim a class the current element filter has none of, rather
                // than hiding it — a row that reshuffles as you switch element
                // is harder to hit than one that stays put.
                const n = pool.filter(
                  (d) => d.cardClass === c && (filter === "ALL" || d.element === filter),
                ).length;
                return (
                  <button
                    key={c}
                    className={`db-fl ${classFilter === c ? "on" : ""}`}
                    onClick={() => setClassFilter(c)}
                    style={n === 0 && classFilter !== c ? { opacity: 0.35 } : undefined}
                    title={`${n} card${n === 1 ? "" : "s"}`}
                  >
                    {c}
                  </button>
                );
              })}
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
                      src={`/cards/${d.art ?? d.id}.webp`}
                      alt=""
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                    <div className="dt-top">
                      <span className="dt-cost">{d.cost}</span>
                      <span className="dt-el" title={d.element} style={{ borderColor: EL_COLOR[d.element] }}>
                        <img src={EL_ICON[d.element]} alt={d.element} draggable={false}
                          onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      </span>
                      <button
                        className={`dt-add ${on ? "on" : ""}`}
                        title={on ? "Remove from deck" : "Add to deck"}
                        onClick={(e) => { e.stopPropagation(); toggle(d.id); }}
                      >
                        {on ? "✓" : "+"}
                      </button>
                    </div>
                    {/* Rarity is absolutely positioned (see styles.css) as a vertical
                        strip in the bottom-right corner — out of the art's face and
                        clear of the +Add button. Must stay a direct child of .deck-thumb. */}
                    {rar && (
                      <span className="dt-rarity" style={{ color: rar.color, borderColor: rar.color }}>
                        {rar.label}
                      </span>
                    )}
                    <div className="dt-name">{d.name}</div>
                    <div className="dt-stats">
                      <span className="s-dmg">⚔<span className="atk-dmg">{d.dmg}</span>{d.hits > 1 ? <span className="atk-x"> ×{d.hits}</span> : ""}</span>
                      <span className="s-hp">♥{d.hp}</span>
                      <span className="s-sp"><SpIcon />{d.sp}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded card details — a sub-overlay above the builder. Shared with
          the story Collection so the two can't drift apart. */}
      {detail && (
        <CardView mode="browse"
          def={detail}
          onClose={() => setDetailId(null)}
          action={{
            label: pickedSet.has(detail.id) ? "− Remove from deck" : "+ Add to deck",
            primary: !pickedSet.has(detail.id),
            disabled: !pickedSet.has(detail.id) && picked.length >= limits.max,
            onClick: () => { toggle(detail.id); setDetailId(null); },
          }}
        />
      )}
    </div>
  );
}

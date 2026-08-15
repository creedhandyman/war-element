import { useEffect, useMemo, useRef, useState } from "react";
import type { CardClass, Element } from "../engine";
import { getDef, SPELLS } from "../engine";
import {
  buildableCards,
  deleteCustomDeck,
  loadCustomDecks,
  deckLimits,
  sanitizeSpells,
  saveCustomDeck,
  validateDeck,
  type CustomDeck,
} from "../data/custom-decks";
import { STANDARD_CAP } from "../data/story";
import { deckLinkFor, decodeDeck, encodeDeck } from "../data/deck-code";
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
 * Build / edit / delete custom decks (exactly 18 on 4×4, 30 on 5×5). A sandbox for trying new
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
  teams: { id: string; name: string; element?: string; cards: string[]; spells?: string[] }[];
  /** Spell ids the hero has actually UNLOCKED. The Arena offers every spell of
   *  a deck's elements; the campaign hands them out for walking a region, so
   *  offering the rest here would be showing the player a book they cannot
   *  carry. Empty = nothing unlocked yet, and the panel says so. */
  spellPool: string[];
  /** The campaign's ceiling for the fight being prepared for. */
  cap: number;
  /** Tag applied to a team saved from here, so prep can float it to the top. */
  element?: string;
  onSaveTeam: (name: string, cards: string[], spells: string[]) => void;
  onDeleteTeam: (id: string) => void;
}

export function DeckBuilder(props: {
  open: boolean;
  onClose: () => void;
  /** A code that arrived by shared link, to load as soon as the builder opens.
   *  Loaded, not saved — see the import handler. */
  incomingCode?: string | null;
  onIncomingConsumed?: () => void;
  onChange: (decks: CustomDeck[]) => void;
  /** Battlefield the player is building for — decides the legal deck size,
   *  which is EXACT: 18 on the standard board, 30 on the large one. */
  boardSize?: number;
  /** Present = building a campaign team, not a custom deck. */
  story?: StoryBuildMode;
}) {
  const story = props.story;
  // Which battlefield this deck is being built for — you can build an 18-card
  // (4×4) or a 30-card (5×5) deck regardless of the current game mode.
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
  const [query, setQuery] = useState("");
  /** Phone only: the deck rail is a BAR by default and rises over the pool when
   *  you tap it. Desktop ignores this — the rail is a column there and has the
   *  room to stay open. */
  const [deckOpen, setDeckOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  // Composition / Spellbook / Saved live behind one compact tool-pill row and
  // open one-at-a-time below it, so the card pool keeps the screen. Desktop has
  // the room to start with Composition open; phone starts clean.
  const phone = typeof window !== "undefined" && (window.matchMedia?.("(max-width: 720px)").matches ?? false);
  const [panel, setPanel] = useState<"deck" | "comp" | "spells" | "saved" | null>(phone ? null : "comp");
  const togglePanel = (p: "deck" | "comp" | "spells" | "saved") => setPanel((cur) => (cur === p ? null : p));
  const deckShown = panel === "deck";
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
    const q = query.trim().toLowerCase();
    const base = pool.filter(
      (c) =>
        (filter === "ALL" || c.element === filter) &&
        (classFilter === "ALL" || c.cardClass === classFilter) &&
        (q === "" || c.name.toLowerCase().includes(q)),
    );
    return [...base].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "rarity")
        return rarityRank(a.rarity) - rarityRank(b.rarity) || a.cost - b.cost || a.name.localeCompare(b.name);
      return a.cost - b.cost || rarityRank(a.rarity) - rarityRank(b.rarity) || a.name.localeCompare(b.name);
    });
  }, [pool, filter, classFilter, sortBy, query]);
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

  // ── deck codes ────────────────────────────────────────────────────────────
  const [importing, setImporting] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /** Both share buttons run through here: the only difference is what gets put
   *  on the clipboard, and both fall back to showing the text when the clipboard
   *  is refused (it needs a secure context and can simply say no). */
  const share = async (kind: "code" | "link") => {
    try {
      const code = encodeDeck({ name: name.trim() || "Shared deck", cards: picked, spells: pickedSpells });
      const text = kind === "link"
        ? deckLinkFor(code, window.location.origin + window.location.pathname)
        : code;
      // navigator.clipboard needs a secure context and can be refused outright,
      // so the code is shown either way — a player who cannot copy can still
      // select it by hand rather than being told nothing happened.
      try {
        await navigator.clipboard.writeText(text);
        setCopied(kind);
        setTimeout(() => setCopied(null), 1600);
        setCodeMsg({ ok: true, text });
      } catch {
        setCodeMsg({ ok: true, text: `Copy this: ${text}` });
      }
    } catch (e) {
      setCodeMsg({ ok: false, text: e instanceof Error ? e.message : "Could not make a code." });
    }
  };
  const shareCode = () => share("code");
  const shareLink = () => share("link");

  const importCode = () => loadCode(codeInput, "paste");

  const loadCode = (code: string, from: "paste" | "link") => {
    try {
      const deck = decodeDeck(code);
      // Cards this collection does not own are dropped rather than refused: in
      // Story you can legitimately be sent a deck holding cards you have not
      // earned, and silently loading them would let you field them.
      const allowed = story?.owned ? new Set(story.owned) : null;
      const usable = allowed ? deck.cards.filter((c: string) => allowed.has(c)) : deck.cards;
      const dropped = deck.cards.length - usable.length;
      setPicked(usable);
      setPickedSpells(sanitizeSpells(deck.spells, buildSize));
      if (deck.name) setName(deck.name);
      setEditingId(null); // an imported deck is a NEW deck, not an edit of yours
      setImporting(false);
      setCodeInput("");
      const via = from === "link" ? "Shared deck loaded" : "Loaded";
      setCodeMsg({
        ok: true,
        text: dropped > 0
          ? `${via}: "${deck.name || "deck"}" — ${dropped} card(s) you do not own were left out.`
          : `${via}: "${deck.name || "deck"}" — ${usable.length} cards.`,
      });
    } catch (e) {
      setCodeMsg({ ok: false, text: e instanceof Error ? e.message : "That code could not be read." });
    }
  };

  // A link-borne deck loads itself once the builder is open. Keyed on the code
  // value rather than a mount flag, so StrictMode's double-invoke cannot consume
  // it twice and so a second link in the same session still works.
  const consumedRef = useRef<string | null>(null);
  useEffect(() => {
    const code = props.incomingCode;
    if (!props.open || !code || consumedRef.current === code) return;
    consumedRef.current = code;
    loadCode(code, "link");
    props.onIncomingConsumed?.();
  }, [props.open, props.incomingCode]);

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
      story.onSaveTeam(name.trim() || `${story.element ?? "New"} team`, picked, pickedSpells);
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
  // In the campaign the offer is additionally gated on what the hero has
  // unlocked — spells are earned by walking a region, and a book you cannot
  // carry is not a choice.
  const unlocked = story ? new Set(story.spellPool) : null;
  const deckSpells = SPELLS
    .filter((s) => deckEls.has(s.element))
    .filter((s) => !unlocked || unlocked.has(s.id))
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
          {/* Left on desktop: saved decks, the editor's meta, live composition.
              On a phone this is a BAR pinned to the bottom that rises into a
              drawer — the pool owns the screen, because the pool is what you
              came to read. Collapsed it still shows the two things you need
              while scrolling it: how many cards you have, and whether that is
              legal yet. */}
          <div className={`db-side${deckOpen ? " open" : ""}`}>
            {/* The handle is the whole bar on a phone, and display:none on
                desktop where the rail never collapses. */}
            <button
              className="db-handle"
              onClick={() => setDeckOpen((v) => !v)}
              aria-expanded={deckOpen}
            >
              <span className="db-handle-lbl">
                {name.trim() || (story ? `${story.element ?? "New"} team` : "Untitled deck")}
                {!story && <> · {buildSize}×{buildSize}</>}
              </span>
              <span className={`db-handle-state ${check.ok ? "ok" : ""}`}>
                {picked.length} / {limits.target}{check.ok ? " · legal" : ""}
              </span>
              <span className="db-handle-chev" aria-hidden="true">{deckOpen ? "⌄" : "⌃"}</span>
            </button>
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
                {story.cap > STANDARD_CAP && <span> · set-piece size</span>}
              </div>
            ) : (
              <div className="db-size">
                {/* Switching board also switches the spellbook cap (5 / 8), so trim
                    any picks the smaller board can't legally hold. */}
                <button className={buildSize === 4 ? "act" : ""} onClick={() => { setBuildSize(4); setPickedSpells((cur) => cur.slice(0, deckLimits(4).spells)); }}>4×4 · {deckLimits(4).target}</button>
                <button className={buildSize === 5 ? "act" : ""} onClick={() => setBuildSize(5)}>5×5 · {deckLimits(5).target}</button>
              </div>
            )}
            {/* THE CAPACITY RULER.
                One cell per card the deck can hold, with min, target and max
                marked on the track. It replaces a line of prose that was three
                different numbers for the same fact — "0/20 · 12–20 (aim 18)"
                sitting next to a "4×4 · 18" toggle — and it answers the question
                that prose could not: not "how many do I have" but "how many more,
                and when does this become legal". Legality is a shape here, not a
                sentence you have to parse. */}
            <div className="db-count" style={{ color: countColor }}>
              {picked.length} / {limits.target} cards
              {!check.ok && limits.min > 1 && (
                <span className="db-hint">
                  {/* The Arena formats are one number, so say the number.
                      "needs 12–20" described a band that no longer exists. */}
                  {limits.min === limits.max
                    ? ` · needs exactly ${limits.max}`
                    : ` · needs ${limits.min}–${limits.max}`}
                </span>
              )}
            </div>
            <div
              className="db-ruler"
              role="img"
              aria-label={
                limits.min === limits.max
                  ? `${picked.length} of ${limits.max} cards; a legal deck is exactly ${limits.max}`
                  : `${picked.length} of ${limits.target} cards; legal from ${limits.min} to ${limits.max}`
              }
            >
              {Array.from({ length: limits.max }, (_, i) => {
                const n = i + 1;
                const marks = [
                  n <= picked.length ? "on" : "",
                  // Only mark the band when there IS one — story teams have
                  // min 1, where a "minimum" tick is noise.
                  // With an exact format min, target and max are the SAME cell;
                  // stacking three marks on it just muddies the end of the
                  // track, so the target mark alone carries it.
                  limits.min > 1 && limits.min !== limits.max && n === limits.min ? "min" : "",
                  n === limits.target ? "target" : "",
                  limits.min !== limits.max && n === limits.max ? "max" : "",
                  n <= picked.length && picked.length > limits.max ? "over" : "",
                ].filter(Boolean).join(" ");
                return <i key={n} className={`db-cell ${marks}`} />;
              })}
            </div>
            <div className="db-actions">
              <button className="lockin" disabled={!check.ok} onClick={save}>
                {story ? "Save team" : `${editingId ? "Update" : "Save"} deck`}
              </button>
              <button className="ghost" onClick={reset}>New / clear</button>
            </div>

            {/* Deck codes. Share is enabled whenever there is anything to share —
                deliberately NOT gated on `check.ok`, because a half-built deck is
                worth sending to somebody for an opinion. Import is always open. */}
            <div className="db-actions db-code-row">
              <button className="ghost" disabled={picked.length === 0} onClick={shareCode}>
                {copied === "code" ? "Copied ✓" : "Copy code"}
              </button>
              <button className="ghost" disabled={picked.length === 0} onClick={shareLink}>
                {copied === "link" ? "Copied ✓" : "Copy link"}
              </button>
              <button className="ghost" onClick={() => { setImporting((v) => !v); setCodeMsg(null); }}>
                {importing ? "Cancel" : "Paste code"}
              </button>
            </div>
            {importing && (
              <div className="db-code-import">
                <input
                  autoFocus
                  value={codeInput}
                  placeholder="WE1-…"
                  spellCheck={false}
                  onChange={(e) => { setCodeInput(e.target.value); setCodeMsg(null); }}
                  onKeyDown={(e) => e.key === "Enter" && importCode()}
                />
                <button className="lockin" onClick={importCode}>Load</button>
              </div>
            )}
            {codeMsg && <div className={`db-warn ${codeMsg.ok ? "ok" : ""}`}>{codeMsg.text}</div>}
            {!check.ok && picked.length > 0 && <div className="db-warn">{check.reason}</div>}

            {/* Compact tool row — one tap opens Composition / Spellbook / Saved
                in a panel below, one at a time, so the card pool keeps the room. */}
            <div className="db-tools">
              {/* Deck first: it is the list you reach for most, and the count on
                  the label means the panel can stay shut while you scroll. */}
              <button className={`db-tool ${deckShown ? "on" : ""}`} onClick={() => togglePanel("deck")}>
                Deck {picked.length}
              </button>
              {picked.length > 0 && (
                <button className={`db-tool ${compShown ? "on" : ""}`} onClick={() => togglePanel("comp")}>
                  Comp · {stats.avg.toFixed(1)}
                </button>
              )}
              {/* Offered in the campaign too. It used to be Arena-only, with a
                  comment saying a story battle is dealt no spellbook — true
                  when it was written, and false since story fights started
                  going in with `heroBookFor`. So the campaign HAS been casting
                  spells; the player just had no say in which ones. The offer is
                  gated on what the hero has unlocked (see `deckSpells`), and a
                  team carries its book into the fight. */}
              <button className={`db-tool ${spellsShown ? "on" : ""}`} onClick={() => togglePanel("spells")}>
                Spells {pickedSpells.length}/{limits.spells}
              </button>
              <button className={`db-tool ${savedShown ? "on" : ""}`} onClick={() => togglePanel("saved")}>
                {story
                  ? `Teams${story.teams.length ? ` ${story.teams.length}` : ""}`
                  : `Saved${decks.length ? ` ${decks.length}` : ""}`}
              </button>
            </div>

            {/* THE DECK ITSELF, which this screen did not have a way to show.
                Until now the only way to remove a card was to find it again
                among three hundred in the pool and tap it a second time — and
                the filters are no help, because you are looking for one
                specific card you already own rather than a kind of card. That
                is a list, and this is it. */}
            {deckShown && (
              <div className="db-picked db-panel">
                {picked.length === 0 ? (
                  <div className="db-spell-hint">Nothing picked yet — tap cards in the pool to add them.</div>
                ) : (
                  picked.map((id) => {
                    const d = getDef(id);
                    return (
                      <div key={id} className="dp-row" data-el={d.element}>
                        <span className="dp-cost">{d.cost}</span>
                        <span className="dp-name">{d.name}</span>
                        <span className="dp-meta">{d.element} · {d.cardClass}</span>
                        <span className="dp-stats">
                          <i className="s-dmg">{d.dmg}{d.hits > 1 ? `×${d.hits}` : ""}</i>
                          <i className="s-hp">{d.hp}</i>
                          <i className="s-sp">{d.sp}</i>
                        </span>
                        <button className="dp-x" title={`Remove ${d.name}`} aria-label={`Remove ${d.name}`}
                          onClick={() => toggle(id)}>✕</button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

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
                    : story && deckSpells.length === 0
                    ? "No spells unlocked for these elements yet — clear nodes in their regions to earn them."
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
                ? story.teams.map((t) => ({ id: t.id, name: t.name, cards: t.cards, spells: t.spells, tag: t.element }))
                : decks.map((d) => ({ id: d.id, name: d.name, cards: d.cards, spells: d.spells, tag: undefined }))
              ).map((d) => (
                <div key={d.id} className={`db-saved-row ${editingId === d.id ? "on" : ""}`}>
                  <button
                    className="db-load"
                    // Load the book with the team. It used to be skipped in
                    // story mode because a team had no book to load; now it has
                    // one, and loading a team to re-tune it must not silently
                    // drop the spells it was saved with.
                    onClick={() => { setEditingId(d.id); setName(d.name); setPicked(d.cards.slice()); setPickedSpells((d.spells ?? []).slice()); }}
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

          {/* Right: the card pool. Tap a card to add it; the ⓘ corner reads it. */}
          <div className="db-pool">
            {/* Three hundred cards behind element and class pills only, on a
                phone, means scrolling to find a card you can already name. The
                filters answer "show me a KIND of card"; this answers "show me
                THAT card", and they are different questions. Matches the name
                only — matching rules text would turn a search for "Bolt" into
                every card that mentions it. */}
            <div className="db-search">
              <span className="db-search-ico" aria-hidden="true">⌕</span>
              <input
                className="db-search-in"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${pool.length} cards`}
                aria-label="Search cards by name"
              />
              {query && (
                <button className="db-search-x" onClick={() => setQuery("")} aria-label="Clear search">✕</button>
              )}
            </div>
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
                  <img className="el-fl-sig" src={EL_ICON[el]} alt="" draggable={false}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
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
              {/* How many the filters left. Cheap, and it is the difference
                  between an empty grid reading as "no matches" and reading as
                  broken — which matters more now that a typo in the search box
                  can empty it. */}
              <span className="db-shown">
                {shown.length === pool.length ? `${shown.length} cards` : `${shown.length} shown`}
              </span>
            </div>
            <div className="db-grid">
              {shown.map((d) => {
                const on = pickedSet.has(d.id);
                const rar = d.rarity ? RARITY_STYLE[d.rarity] : null;
                return (
                  /* TAP-TO-ADD is inverted from the desktop build on purpose:
                     the card BODY toggles the pick and a small ⓘ opens the card
                     view. Adding is what you do two dozen times while building a
                     deck; reading the card is what you do when something
                     surprises you. On a phone the frequent action gets the big
                     target, and the rare one gets a corner. */
                  <div
                    key={d.id}
                    className={`deck-thumb carded db-card ${on ? "selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={on}
                    title={on ? `${d.name} — tap to remove` : `${d.name} — tap to add`}
                    onClick={() => toggle(d.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(d.id); } }}
                  >
                    <img
                      className="card-art"
                      src={`/cards/${d.art ?? d.id}.webp`}
                      alt=""
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                    <div className="dt-top">
                      {/* One badge, not two. The cost sits ON the element's
                          sigil, so the corner spends 20px instead of 42 and
                          the art keeps the difference. */}
                      <span
                        className="dt-cost"
                        title={`${d.element} · cost ${d.cost}`}
                        style={{ borderColor: EL_COLOR[d.element], backgroundImage: `url(${EL_ICON[d.element]})` }}
                      >
                        <b>{d.cost}</b>
                      </span>
                      {/* The corner that used to add now READS. Its hit area is
                          padded out past its 22px face so a thumb can reach it
                          without catching the body underneath. */}
                      <button
                        className="dt-info"
                        title={`${d.name} — see the card`}
                        aria-label={`${d.name} — see the card`}
                        onClick={(e) => { e.stopPropagation(); setDetailId(d.id); }}
                      >
                        ⓘ
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
                      {/* In the stat row rather than a corner badge: the gold rim
                          says "picked" from across the grid, and this says it
                          again at the one place you are already reading. */}
                      {on && <span className="dt-in" aria-hidden="true">✓</span>}
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

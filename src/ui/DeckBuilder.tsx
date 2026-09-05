import { useEffect, useMemo, useRef, useState } from "react";
import type { CardClass, Element, Keyword } from "../engine";
import { getDef, getSpell, SPELLS, spellCostCap } from "../engine";
import {
  buildableCards,
  deckLimits,
  sanitizeSpells,
  validateDeck,
} from "../data/custom-decks";
import { STANDARD_CAP, autoDeck } from "../data/story";
import { deleteSquad, loadSquads, saveSquad, squadNamed, squadUsableIn, type Squad } from "../data/squads";
import { deckLinkFor, decodeDeck, encodeDeck } from "../data/deck-code";
import { BUILDABLE_ELEMENTS, EL_COLOR, EL_ICON, RARITY_STYLE, spellArtSrc } from "./shared";
import {
  ClassRow, CostRow, ElementRow, FilterToggle, KeywordRow, RarityRow, TribeRow, cardHasTribe, tribesIn,
  cardHasKeyword, matchesCost, useFilterFold, type CostFilter, type RarityFilter, type TribeFilter,
} from "./filters";
import { CardView } from "./CardView";
import { DeckStats, useComposition } from "./DeckStats";
import { SpIcon } from "./icons";

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
  /** Spell ids the hero has actually UNLOCKED. The Arena offers every spell of
   *  a deck's elements; the campaign hands them out for walking a region, so
   *  offering the rest here would be showing the player a book they cannot
   *  carry. Empty = nothing unlocked yet, and the panel says so. */
  spellPool: string[];
  /** The campaign's ceiling for the fight being prepared for. */
  cap: number;
  /** Card ids held in foil. The collection grid one tap away shines these, so
   *  a copy that went plain in the builder read as a different card. */
  foils?: ReadonlySet<string>;
  /** Tag applied to a team saved from here, so prep can float it to the top. */
  element?: string;
  /** The node this build is FOR, when one is being prepped. Present only from
   *  the prep entrance, where `cap` and the board are that node's rather than
   *  the region's largest. Naming it is what keeps the shifting ceiling from
   *  reading as a bug. */
  forNode?: string;
  /** Told what was just saved, so the campaign can remember which squad it is
   *  holding. The squad is already in the shared library by then — this is a
   *  pointer, not a second write of the same data. */
  onSaved: (cards: string[], squadId?: string) => void;
  onDeleted: (id: string) => void;
}

export function DeckBuilder(props: {
  open: boolean;
  onClose: () => void;
  /** A code that arrived by shared link, to load as soon as the builder opens.
   *  Loaded, not saved — see the import handler. */
  incomingCode?: string | null;
  onIncomingConsumed?: () => void;
  onChange: (squads: Squad[]) => void;
  /** Battlefield the player is building for — decides the legal deck size,
   *  which is EXACT: 18 on the standard board, 30 on the large one. */
  boardSize?: number;
  /** Present = building a campaign team, not a custom deck. */
  story?: StoryBuildMode;
}) {
  const story = props.story;
  // Which battlefield this deck is being built for — you can build an 18-card
  // (4×4) or a 30-card (5×5) deck regardless of the current game mode.
  // A 7x7 builds as the LARGE board. `deckLimits(7)` is `deckLimits(5)` exactly
  // — thirty cards, eight spells — and `premadeDecksFor(7)` returns the large
  // builds, so the whole game already treats 7 as "large" for deck purposes.
  // Seeding a third build size with identical rules would only create decks the
  // deck-code writer drops (it encodes 4 and 5) for no gain.
  const asBuildSize = (n: number | undefined) => (n === undefined ? 4 : n >= 5 ? 5 : 4);
  const [buildSize, setBuildSize] = useState<number>(asBuildSize(props.boardSize));
  /** FOLLOW THE PROP WHEN IT MOVES.
   *
   *  This is `useState(props.boardSize)` and nothing ever re-read it, so the
   *  board froze at whatever it was on the builder's FIRST render — and the
   *  builder is mounted for the whole session with `open` toggled, so that is
   *  the first render of the app. Standing in front of a 4x4 node it still said
   *  "5×5 · 8 spells", and offered a book two spells longer than the fight can
   *  hold.
   *
   *  Only on a CHANGE, tracked in a ref: in the Arena `buildSize` is the
   *  player's own toggle and loading a deck code re-points it, and neither may
   *  be stomped on every render by a prop that has not moved. */
  const lastPropBoard = useRef(props.boardSize);
  useEffect(() => {
    if (props.boardSize == null || props.boardSize === lastPropBoard.current) return;
    lastPropBoard.current = props.boardSize;
    setBuildSize(asBuildSize(props.boardSize));
    // The smaller board holds a shorter book, so trim rather than carry an
    // illegal one across — same rule the manual toggle applies.
    setPickedSpells((cur) => sanitizeSpells(cur, props.boardSize!) ?? []);
  }, [props.boardSize]);
  // Story Mode's ceiling is the campaign's, not the format's. `min` stays 1 —
  // `loadoutLegal` deliberately treats the cap as a ceiling, not a quota, so a
  // twelve-card team is a legal choice and the builder must not call it broken.
  const limits = story
    ? { ...deckLimits(buildSize), min: 1, max: story.cap, target: story.cap }
    : deckLimits(buildSize);
  // ONE library, whichever screen opened the builder. What changes between the
  // Arena and the campaign is which squads you can FIELD, not which you can see —
  // that is `squadUsableIn`, applied per row below.
  const [squads, setSquads] = useState<Squad[]>(() => loadSquads());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  /** The squad just written, as a name plus a signature of what was in it.
   *
   *  DERIVED, not timed. The note has to disappear when it stops being true —
   *  the moment the player edits the squad it describes — and a timer would
   *  either outlive that or expire while they are still reading. Comparing the
   *  signature answers the real question ("is what is on screen still what was
   *  saved?") and needs no effect, so it also cannot fight the very save that
   *  set it. */
  const [justSaved, setJustSaved] = useState<{ name: string; sig: string } | null>(null);
  const [pickedSpells, setPickedSpells] = useState<string[]>([]);
  const [filter, setFilter] = useState<Element | "ALL">("ALL");
  const [classFilter, setClassFilter] = useState<CardClass | "ALL">("ALL");
  /** Keyword filter. The one axis the builder could not search on: "show me the
   *  FLYING cards" was a question you had to answer by reading every card. */
  const [kw, setKw] = useState<Keyword | "ALL">("ALL");
  /** Tribe. Free-text on the card and often plural — Klipso is a Dragon AND
   *  a Star — so `cardHasTribe` does the list handling for every grid. */
  const [tribe, setTribe] = useState<TribeFilter>("ALL");
  const [rar, setRar] = useState<RarityFilter>("ALL");
  const [cost, setCost] = useState<CostFilter>("ALL");
  const [filtersOpen, toggleFilters] = useFilterFold();
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
  // THE DECK IS NOT A PANEL ANY MORE. It was one of four things behind a pill,
  // opening one at a time, and on desktop the pill that started open was
  // Composition — so the default state of the deck BUILDER was one where you
  // could not see the deck. You were picking cards blind and finding out what
  // you had by reading a number. The list is always on screen now, and the
  // pills switch only the extras.
  const [panel, setPanel] = useState<"comp" | "spells" | "saved" | null>(phone ? null : "comp");
  const togglePanel = (p: "comp" | "spells" | "saved") => setPanel((cur) => (cur === p ? null : p));
  const compShown = panel === "comp";
  // THE SPELLBOOK NEEDS A SQUAD. It is the pool column's other view, so with an
  // empty squad it rendered as a full-height empty box where the card grid
  // should be — reported after saving, because `save` calls `reset` and the
  // panel was left open over the squad it had just cleared. Derived rather than
  // corrected in an effect: there is no state in which it can be wrong.
  const savedShown = panel === "saved";
  const spellsShown = panel === "spells" && picked.length > 0;

  const ownedSet = useMemo(() => new Set(story?.owned ?? []), [story?.owned]);
  const pool = useMemo(
    () => (story ? buildableCards().filter((c) => ownedSet.has(c.id)) : buildableCards()),
    [story, ownedSet],
  );
  // Only the tribes this pool can actually contain. A story save that owns nine
  // cards should not be offered 33 pills, 32 of which match nothing.
  const poolTribes = useMemo(() => tribesIn(pool), [pool]);
  // Filter by element and class (they stack — GALE + Ranger narrows to both),
  // then sort. Default "cost" reads the Gold curve low→high, breaking ties by
  // rarity (mythic first) then name.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = pool.filter(
      (c) =>
        (filter === "ALL" || c.element === filter) &&
        (classFilter === "ALL" || c.cardClass === classFilter) &&
        (kw === "ALL" || cardHasKeyword(c, kw)) &&
        cardHasTribe(c, tribe) &&
        (rar === "ALL" || c.rarity === rar) &&
        matchesCost(c.cost, cost) &&
        (q === "" || c.name.toLowerCase().includes(q)),
    );
    return [...base].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "rarity")
        return rarityRank(a.rarity) - rarityRank(b.rarity) || a.cost - b.cost || a.name.localeCompare(b.name);
      return a.cost - b.cost || rarityRank(a.rarity) - rarityRank(b.rarity) || a.name.localeCompare(b.name);
    });
  }, [pool, filter, classFilter, kw, tribe, rar, cost, sortBy, query]);

  /** What is narrowing the grid right now. Sort is NOT a filter and is left out
   *  on purpose: it changes the order, never the contents, so listing it would
   *  make a collapsed row claim to be hiding cards it is not. */
  const filterSummary = [
    filter !== "ALL" ? filter : null,
    classFilter !== "ALL" ? classFilter : null,
    kw !== "ALL" ? kw : null,
    tribe !== "ALL" ? tribe : null,
    rar !== "ALL" ? rar.toUpperCase() : null,
    cost !== "ALL" ? `${cost}◆` : null,
    query.trim() ? `"${query.trim()}"` : null,
  ].filter(Boolean) as string[];
  const anyFilter = filterSummary.length > 0;
  const clearFilters = () => {
    setFilter("ALL"); setClassFilter("ALL"); setKw("ALL"); setTribe("ALL");
    setRar("ALL"); setCost("ALL"); setQuery("");
  };
  /** How many cards a candidate value would leave, given the OTHER filters.
   *  Shared by every row so a dimmed pill means the same thing everywhere. */
  const countIf = (pred: (c: (typeof pool)[number]) => boolean, skip: "el" | "cls" | "kw" | "tribe" | "rar" | "cost") =>
    pool.filter((c) =>
      pred(c)
      && (skip === "el" || filter === "ALL" || c.element === filter)
      && (skip === "cls" || classFilter === "ALL" || c.cardClass === classFilter)
      && (skip === "kw" || kw === "ALL" || cardHasKeyword(c, kw))
      && (skip === "tribe" || cardHasTribe(c, tribe))
      && (skip === "rar" || rar === "ALL" || c.rarity === rar)
      && (skip === "cost" || matchesCost(c.cost, cost))).length;
  const pickedSet = new Set(picked);
  const check = story
    ? picked.length === 0
      ? { ok: false as const, reason: "Empty squad" }
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

  /** ONE TAP TO A LEGAL SQUAD.
   *
   *  This builder was the only editor in the game that could ADD a card, and
   *  the only one with no fill — so an arena deck cost eighteen deliberate taps
   *  through a three-hundred-card grid, while the prep screen next door built
   *  one in a single press. That asymmetry is most of what "hard to make decks"
   *  meant.
   *
   *  It TOPS UP rather than replaces: what you have already chosen is a
   *  decision, and a fill button that throws it away is a fill button nobody
   *  presses twice. It also fills from what is ON SCREEN — narrow the pool to
   *  GALE Rangers and Fill gives you GALE Rangers, which turns the filter row
   *  from four ways to search into a way to say what you want built.
   *
   *  `autoDeck` is the campaign's own cost-stride, not "your best cards": a
   *  deck of nothing but mythics cannot be summoned in the rounds a match
   *  lasts, and the measurements behind that live on `autoDeck` itself. */
  function fillToCap() {
    const room = limits.target - picked.length;
    if (room <= 0) return;
    // Whatever the filters are showing, minus what is already in — so a second
    // press after narrowing the pool adds from the new selection.
    const candidates = shown.map((c) => c.id).filter((id) => !pickedSet.has(id));
    const next = [...picked, ...autoDeck(candidates, room)];
    setPicked(next);
    // And the SPELLBOOK, which is behind a tool pill and therefore invisible
    // unless you go looking for it. Only when it is empty: a book you chose is
    // a decision, same as the cards. Legal elements only — the effect below
    // would strip anything else on the next render anyway.
    if (pickedSpells.length === 0) {
      const els = new Set(next.map((id) => getDef(id).element));
      // CHEAPEST FIRST, and not through `autoDeck` — that reads `getDef`, which
      // knows cards and throws on a spell id. Two `string[]`s that the type
      // system cannot tell apart; it threw on the first press and the deck
      // still filled, so the only symptom was a book that stayed empty.
      // Cheap is also the right shelf: an eight-Magic spell in a five-slot book
      // is a slot you cannot cast until the match is nearly over.
      setPickedSpells(
        SPELLS
          .filter((s) => els.has(s.element) && (!story || story.spellPool.includes(s.id)))
          .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
          .slice(0, limits.spells)
          .map((s) => s.id),
      );
    }
  }

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
      const code = encodeDeck({
        name: name.trim() || "Shared deck",
        cards: picked,
        spells: pickedSpells,
        // Story teams are built to a node's cap rather than a battlefield, so
        // they carry no board size — sending one would impose a limit the
        // recipient's own campaign does not have.
        boardSize: story ? undefined : buildSize,
      });
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
      // Adopt the deck's battlefield first: the legal deck size and the spell cap
      // both hang off it, so a 5x5 deck landing in a 4x4 builder would read as
      // over-size and have its spellbook trimmed for the wrong format. Story is
      // exempt — there the node decides the board, not the deck.
      const board = !story && (deck.boardSize === 4 || deck.boardSize === 5) ? deck.boardSize : buildSize;
      if (board !== buildSize) setBuildSize(board);
      setPicked(usable);
      setPickedSpells(sanitizeSpells(deck.spells, board));
      if (deck.name) setName(deck.name);
      setEditingId(null); // an imported deck is a NEW deck, not an edit of yours
      setImporting(false);
      setCodeInput("");
      const via = from === "link" ? "Shared deck loaded" : "Loaded";
      const switched = board !== buildSize ? ` Switched to ${board}×${board}.` : "";
      setCodeMsg({
        ok: true,
        text: dropped > 0
          ? `${via}: "${deck.name || "deck"}" — ${dropped} card(s) you do not own were left out.${switched}`
          : `${via}: "${deck.name || "deck"}" — ${usable.length} cards.${switched}`,
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

  // Re-read the shelf on every open. This list is seeded once at mount, and the
  // builder is mounted the whole session behind an `open` flag — which was
  // harmless while the campaign kept its own separate library, and stopped being
  // harmless the moment there was ONE. Save a squad on the prep screen, open the
  // builder over the top of it, and the squad was not there. Storage is the
  // source of truth; both save paths write it, so re-reading is the whole fix.
  useEffect(() => {
    if (props.open) setSquads(loadSquads());
  }, [props.open]);

  if (!props.open) return null;

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= limits.max ? cur : [...cur, id]));
  }
  // A deck's spellbook: up to limits.spells (5 standard / 8 large), each SLOT
  // castable once in a match — so two copies of a spell really are two casts.
  //
  // CYCLES rather than toggles, because a toggle cannot express a count. Tap
  // adds a copy; tapping at the ceiling clears it back to none. That keeps one
  // control per spell (the grid is already dense on a phone) and makes "how do
  // I remove this" the same gesture as "how do I add another", which is the
  // thing a +/- pair would have cost two targets to say.
  //
  // The ceiling is now the COST TIER's, not this spell's own, so it can be
  // reached by a DIFFERENT spell that costs the same — see `spellCostCap`.
  // That splits the old single branch in two: a spell already in the book still
  // clears on the next tap, but one that is NOT in the book and whose tier is
  // full has to be inert, because clearing something the player never added is
  // not a sensible answer to tapping it.
  function toggleSpell(id: string) {
    setPickedSpells((cur) => {
      const have = cur.filter((x) => x === id).length;
      const { cost } = getSpell(id);
      const atCost = cur.filter((x) => getSpell(x).cost === cost).length;
      const tierFull = atCost >= spellCostCap(cost);
      if (have > 0 && (tierFull || cur.length >= limits.spells))
        return cur.filter((x) => x !== id); // at its ceiling — next tap clears
      if (cur.length >= limits.spells) return cur; // full book, and this is a NEW spell
      if (tierFull) return cur;                   // tier spent on another spell of this cost
      return [...cur, id];
    });
  }
  function reset() {
    setEditingId(null);
    setName("");
    setPicked([]);
    setPickedSpells([]);
    // Back to the pool. You have just emptied the squad, so cards are the only
    // thing there is to do next — and leaving the spellbook open over nothing is
    // what the empty-box report was.
    setPanel(phone ? null : "comp");
  }
  /** What the squad IS, flattened. Order matters and that is fine: reordering
   *  the picks is an edit like any other. */
  const squadSig = (label: string, cards: string[], spells: string[]) =>
    `${label}|${cards.join(",")}|${spells.join(",")}`;

  function save() {
    if (!check.ok) return;
    const label = name.trim() || (story ? `${story.element ?? "New"} squad` : "Untitled squad");
    const next = saveSquad({
      id: editingId ?? undefined,
      name: label,
      cards: picked,
      spells: pickedSpells,
      // Tag it with the region it was built in, so the campaign's quick-select
      // can float the right one. Cosmetic — nothing enforces it.
      element: story?.element,
      boardSize: story ? undefined : buildSize,
    });
    setSquads(next);
    // Squad is structurally a CustomDeck, so the Arena's deck pickers keep
    // working off this without knowing anything changed.
    props.onChange(next);
    // One write, one library. The campaign is only told WHICH squad, so the
    // prep screen can come back to it — `saveSquad` matches by name, so that is
    // how the id is recovered.
    const saved = squadNamed(next, label);
    if (story) story.onSaved(picked, saved?.id);
    // AND IT STAYS ON SCREEN. This used to `reset()`, which emptied the picks
    // and the name — so the reward for saving a squad was a builder reading
    // "0 cards · Nothing picked yet", which is exactly what a FAILED save would
    // look like. A player coming from the campaign had just chosen the team
    // they were about to fight with; being handed back an empty screen reads as
    // having lost it.
    //
    // Clearing is still one tap away and always was: the Clear button is right
    // there beside this one. Saving now does what saving does everywhere else —
    // it keeps the thing, and the screen switches to editing it, so the button
    // becomes "Update squad" and says what a second press would do.
    setEditingId(saved?.id ?? editingId);
    setName(label);
    setJustSaved({ name: label, sig: squadSig(label, picked, pickedSpells) });
  }
  function remove(id: string) {
    const next = deleteSquad(id);
    setSquads(next);
    props.onChange(next);
    if (story) story.onDeleted(id);
    if (editingId === id) reset();
  }

  /** UNDER-BUILT, not illegal. The campaign cap is a CEILING, not a quota —
   *  story.ts says so and `loadoutLegal` enforces only the top — so a short
   *  team stays legal and saveable. But "legal" was painted green from one card
   *  upward, so a three-card team walking into a twenty-two-card fight was told
   *  it was fine. It is legal AND it is thin, and the screen owes you the
   *  second half of that.
   *
   *  Two thirds because it is a judgement, not a rule: below that the fight is
   *  bringing meaningfully more than you are. */
  const thin = !!story && check.ok && picked.length < Math.ceil(limits.max * (2 / 3));
  const countColor = !check.ok
    ? (picked.length > limits.max ? "var(--threat)" : "var(--muted)")
    : thin ? "var(--gold-lit)" : "var(--legal)";
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
    // PICKED FIRST. A seven-element squad offers seventy spells for a book that
    // holds five, and the five you chose were scattered through the other
    // sixty-five — so removing one meant hunting for it. The book you are
    // building sits at the top of the list of things you could put in it.
    .sort((a, b) =>
      Number(pickedSpells.includes(b.id)) - Number(pickedSpells.includes(a.id))
      || a.cost - b.cost
      || a.name.localeCompare(b.name));

  /** The spellbook, rendered in ONE of two places.
   *
   *  It browses on the WIDE side on a desktop, and the reason is still good:
   *  the 224px rail gives a row carrying an effect sentence about eighty pixels
   *  for the sentence, so the text that is the whole point of the panel came
   *  out clamped. Choosing spells is the same job as choosing cards — read a
   *  description, decide, tap — so it happens where that job happens.
   *
   *  On a PHONE the rail is full width, so that constraint does not exist, and
   *  the placement was actively wrong instead: the panel opened at the top of
   *  the sheet while the button that opened it sits at the very bottom, next to
   *  Comp and Squads which both open in place. Tapping "Spells" appeared to do
   *  nothing until you scrolled the whole builder up. So on a phone it opens
   *  with its siblings, under the tool row.
   *
   *  One element, two mount points, because a spellbook maintained twice is a
   *  spellbook that disagrees with itself. */
  const spellPanel = (
            <div className="db-spells db-panel">
              <div className="db-spell-hint">
                {deckEls.size === 0
                  ? "Add cards to your squad to unlock its element spells."
                  : story && deckSpells.length === 0
                  ? "No spells unlocked for these elements yet — clear nodes in their regions to earn them."
                  : pickedSpells.length === 0
                  ? "None picked — auto-filled from your deck's elements at match start."
                  : "Tap to add. One spell of each cost 6-10, two of each cost 3-5, and as many cheap ones as fit."}
              </div>
              {deckSpells.length > 0 && (
              <div className="db-spell-grid">
                {deckSpells.map((s) => {
                  const copies = pickedSpells.filter((x) => x === s.id).length;
                  const on = copies > 0;
                  const tierCap = spellCostCap(s.cost);
                  const atCost = pickedSpells.filter((x) => getSpell(x).cost === s.cost).length;
                  const capped = atCost >= tierCap;
                  // Only truly unusable when it is not IN the book — a picked
                  // spell must stay tappable, because tapping is now also how
                  // you take it back out.
                  // Unusable when the book is full OR this cost rung is spent
                  // on something else — and only while it is not already IN the
                  // book, because a picked spell must stay tappable: tapping is
                  // also how you take it back out.
                  const full = !on && (pickedSpells.length >= limits.spells || capped);
                  return (
                    /* WHAT IT DOES, on the tile.
                       The effect text lived in a `title` and nowhere else — a
                       hover tooltip, which does not exist on a touch screen at
                       all, so on a phone there was no way to find out what any
                       of these did short of casting one in a match and
                       watching. A picker where the choices are unlabelled is
                       not a picker. The card pool can get away with art alone
                       because a card's stats are printed on it; a spell is
                       nothing but its sentence. */
                    <button
                      key={s.id}
                      className={`db-spell ${on ? "on" : ""}`}
                      data-el={s.element}
                      disabled={full}
                      title={
                        full
                          ? pickedSpells.length >= limits.spells
                            ? "Book is full — remove one first"
                            : `Cost ${s.cost} is full — you already have ${atCost} spell${atCost === 1 ? "" : "s"} of this cost`
                          : `${s.name} · cost ${s.cost} — ${
                              tierCap === Infinity
                                ? "as many as the book holds"
                                : `up to ${tierCap} spell${tierCap === 1 ? "" : "s"} of cost ${s.cost}`
                            }${copies ? ` · you have ${copies}${capped ? " (limit — tap to clear)" : ""}` : ""}`
                      }
                      onClick={() => toggleSpell(s.id)}
                    >
                      <span className="db-spell-art">
                        <img src={spellArtSrc(s.id)} alt="" draggable={false}
                          onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      </span>
                      <span className="db-spell-body">
                        <span className="db-spell-head">
                          <b className="db-spell-name">{s.name}</b>
                          <i className="db-spell-cost" title={`Costs ${s.cost} Magic to cast`}>
                            {s.cost}
                          </i>
                        </span>
                        <span className="db-spell-text">{s.text}</span>
                      </span>
                      {/* THE CORNER SAYS HOW MANY, not just whether. A second
                          copy that looked identical to the first is a book the
                          player cannot read back — and the count is what tells
                          them the next tap adds one more or clears the lot. */}
                      <span className={`db-spell-mark ${copies > 1 ? "many" : ""}`}>
                        {copies > 1 ? `×${copies}` : on ? "✓" : "+"}
                      </span>
                    </button>
                  );
                })}
              </div>
              )}
            </div>
  );

  return (
    // `on-top` in story mode: the campaign screens (.story-wrap, z-70) sit ABOVE
    // the plain overlay layer (z-65), so without it "Build a team" opened the
    // builder UNDERNEATH the collection — invisible there, and then suddenly
    // visible over the home screen once story mode was closed, because the
    // builder was still open the whole time.
    <div className={`overlay ${story ? "on-top" : ""}`} onClick={props.onClose}>
      <div className="modal deck-builder" onClick={(e) => e.stopPropagation()}>
        <div className="db-head">
          <h2>Squad Builder</h2>
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
                {name.trim() || (story ? `${story.element ?? "New"} squad` : "Untitled squad")}
                {!story && <> · {buildSize}×{buildSize}</>}
              </span>
              <span className={`db-handle-state ${check.ok && !thin ? "ok" : ""} ${thin ? "thin" : ""}`}>
                {picked.length} / {limits.target}
                {check.ok ? (thin ? " · thin" : " · legal") : ""}
              </span>
              <span className="db-handle-chev" aria-hidden="true">{deckOpen ? "⌄" : "⌃"}</span>
            </button>
            <input
              className="db-name"
              placeholder={story ? `${story.element ?? "New"} squad` : "Squad name"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={28}
            />
            {/* The board toggle is a FORMAT control. In the campaign the board
                belongs to the node you are about to fight, so there is nothing
                here to choose — the cap is simply stated. */}
            {story ? (
              /* The board is not a choice in the campaign — the node owns it —
                 but it was not STATED either, and it decides both how big a
                 team is worth building and how many spells the book holds. A
                 line reading "carry up to 22" told you neither which fight
                 that was for nor that the same fight allows eight spells. */
              <div className="db-storycap">
                <b>{buildSize}×{buildSize}</b> · carry up to <b>{story.cap}</b>
                {" "}· <b>{limits.spells}</b> spells
                {story.cap > STANDARD_CAP && <span> · set-piece size</span>}
                {/* Opened from prep these are THAT NODE's numbers, not the
                    region's biggest — building to a set piece and then arriving
                    at a smaller node over-cap is the failure this replaced, and
                    a ceiling that changes between entrances has to say which
                    fight it belongs to. */}
                {story.forNode && <span className="db-fornode">for {story.forNode}</span>}
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
              {thin && (
                <span className="db-hint">
                  {" "}· room for {limits.max - picked.length} more
                </span>
              )}
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
                {editingId ? "Update squad" : "Save squad"}
              </button>
              {/* Sits BEFORE the clear, because it is the button a new player
                  needs and "New / clear" is the one they need least. Says how
                  many it will add, so it is never a surprise. */}
              <button
                className="ghost db-fill"
                disabled={picked.length >= limits.target}
                title="Top the squad up from the cards on screen — narrow the pool first to steer it"
                onClick={fillToCap}
              >
                {picked.length === 0
                  ? `Auto-fill ${limits.target}`
                  : `Fill +${limits.target - picked.length}`}
              </button>
              <button className="ghost" onClick={reset}>Clear</button>
            </div>
            {justSaved && justSaved.sig === squadSig(name.trim() || justSaved.name, picked, pickedSpells) && (
              <div className="db-saved-note" role="status">
                Saved · <b>{justSaved.name}</b> — still loaded, edit and update any time.
              </div>
            )}

            {/* THE SQUAD ITSELF. Always on screen: the only way to remove a
                card used to be finding it again among three hundred in the pool
                and tapping it a second time, and the filters are no help
                because you are hunting one specific card you already own rather
                than a kind of card. */}
            {(
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
              {picked.length > 0 && (
                <button className={`db-tool ${spellsShown ? "on" : ""}`} onClick={() => togglePanel("spells")}>
                  Spells {pickedSpells.length}/{limits.spells}
                </button>
              )}
              <button className={`db-tool ${savedShown ? "on" : ""}`} onClick={() => togglePanel("saved")}>
                {`Squads${squads.length ? ` ${squads.length}` : ""}`}
              </button>
            </div>

            {/* Deck composition — cards per element / class / cost. */}
            {compShown && picked.length > 0 && <DeckStats stats={stats} />}

            {/* The spellbook, on a phone, where its button is. See `spellPanel`. */}
            {spellsShown && phone && spellPanel}

            {savedShown && (
              <div className="db-saved db-panel">
              {squads.length === 0 && (
                <div className="db-empty">None yet — build one →</div>
              )}
              {squads.map((sq) => {
                // Shown everywhere, fieldable where it is legal. A campaign squad
                // holding cards you have not earned is greyed and says which ones,
                // rather than disappearing and leaving you wondering where it went.
                const usable = squadUsableIn(sq, story ? { owned: story.owned, cap: story.cap } : {});
                return { id: sq.id, name: sq.name, cards: sq.cards, spells: sq.spells, tag: sq.element, usable };
              }).map((d) => (
                <div key={d.id} className={`db-saved-row ${editingId === d.id ? "on" : ""} ${d.usable.ok ? "" : "locked"}`}>
                  <button
                    className="db-load"
                    // Load the book with the team. It used to be skipped in
                    // story mode because a team had no book to load; now it has
                    // one, and loading a team to re-tune it must not silently
                    // drop the spells it was saved with.
                    onClick={() => { setEditingId(d.id); setName(d.name); setPicked(d.cards.slice()); setPickedSpells((d.spells ?? []).slice()); }}
                    title={d.usable.ok ? "Load this squad" : `Load to edit — ${d.usable.reason}`}
                  >
                    <b>{d.name}</b>
                    <span>
                      {d.cards.length} cards
                      {d.spells && d.spells.length ? ` · ${d.spells.length} spells` : ""}
                      {d.tag ? ` · for ${d.tag}` : ""}
                      {!d.usable.ok && <em className="db-locked-why"> · {d.usable.reason}</em>}
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
            {/* THE SPELLBOOK BROWSES ON THE WIDE SIDE.
                It used to live in the 224px rail, where a row carrying an
                effect sentence has about eighty pixels for the sentence — so
                the text that was the entire point of the change came out
                clamped and truncated. Choosing spells is the same job as
                choosing cards: read a description, decide, tap. So it happens
                where that job already happens, and the card grid stands down
                while it does. */}

            {/* Spellbook — up to 5 spells this deck carries into a match (each
                castable once). None picked = the engine auto-fills one from the
                deck's elements, exactly as before. */}
            {spellsShown && !phone ? (
              spellPanel
            ) : (<>
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
            {/* ONE button for the whole filter block. Collapsed, the rows go
                and the cards come up the screen; what does NOT go is the state
                of the filters — an active filter with its controls hidden is a
                grid that looks broken, so the summary below carries it. */}
            <FilterToggle
              open={filtersOpen}
              onToggle={toggleFilters}
              summary={filterSummary}
              count={shown.length}
            />
            {/* A real BOX around the rows, not a fragment. They are `flex: none`
                on a phone, so they never shrink — and when an open deck rail
                squeezes the pool, they spilled straight out of it and painted
                over the rail, because .db-pool is overflow:visible. Measured at
                466x860 with the rail open: 49px of overflow, SORT landing on top
                of the deck handle. A box can be told to scroll instead. */}
            {filtersOpen && (
            <div className="db-filterbox">
            <ElementRow value={filter} onChange={setFilter} elements={BUILDABLE_ELEMENTS} />
            <ClassRow
              all={CLASSES}
              value={classFilter}
              onChange={setClassFilter}
              countFor={(c) => countIf((d) => d.cardClass === c, "cls")}
            />
            <KeywordRow value={kw} onChange={setKw} countFor={(k) => countIf((d) => cardHasKeyword(d, k), "kw")} />
            <TribeRow
              value={tribe}
              onChange={setTribe}
              tribes={poolTribes}
              countFor={(t) => countIf((d) => cardHasTribe(d, t), "tribe")}
            />
            <RarityRow value={rar} onChange={setRar} countFor={(r) => countIf((d) => d.rarity === r, "rar")} />
            <CostRow value={cost} onChange={setCost} countFor={(c) => countIf((d) => matchesCost(d.cost, c), "cost")} />
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
              {anyFilter && (
                <button className="db-fl db-clear" onClick={clearFilters}>Clear</button>
              )}
            </div>
            </div>
            )}
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
                    className={`deck-thumb carded db-card ${on ? "selected" : ""} ${story?.foils?.has(d.id) ? "foil" : ""}`}
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
                      {story?.foils?.has(d.id) && <i className="foil-tag" title="Foil">✦</i>}
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
            </>)}
          </div>
        </div>
      </div>

      {/* Expanded card details — a sub-overlay above the builder. Shared with
          the story Collection so the two can't drift apart. */}
      {detail && (
        <CardView mode="browse" foil={!!story?.foils?.has(detail.id)}
          def={detail}
          onClose={() => setDetailId(null)}
          action={{
            label: pickedSet.has(detail.id) ? "− Remove from squad" : "+ Add to squad",
            primary: !pickedSet.has(detail.id),
            disabled: !pickedSet.has(detail.id) && picked.length >= limits.max,
            onClick: () => { toggle(detail.id); setDetailId(null); },
          }}
        />
      )}
    </div>
  );
}

/** Story Mode — the last screen before a fight.
 *
 *  The campaign asks one deck to answer eight elements, and until now the only
 *  place to rebuild it was the Collection, three taps away on the map. So the
 *  honest play was to walk into a region, lose once to learn what it fields,
 *  walk back out, rebuild, and walk in again.
 *
 *  This is that rebuild, brought to where the decision actually happens: what
 *  you are about to fight, on which board, with which squad — and the shelf of
 *  saved squads, the ones tagged for this element first, so arriving in PYRO
 *  offers you the squad you built for PYRO.
 */
import { useEffect, useRef, useState } from "react";
import { getDef } from "../data/cards";
import { getSpell, spellCapForBoard } from "../engine/spells";
import {
  regionFill,
  borderBossFor, borderBossScale, deckCapFor, deckForRegion, fieldedBy, fightBoardFor, fightCap, isGate, loadoutLegal, localCards,
  isHard, packSquad, packableFor, poolForRegion, rememberDeck,
  squadFor, squadIsExplicit, squadIsOfferable, squadLimitFor,
  type StoryNode, type StoryRegion, type StorySave, STANDARD_CAP, bookForLoadout,
} from "../data/story";
import {
  deleteSquad, loadSquads, preferredSquad, saveSquad, squadNamed, squadsFor, type Squad,
} from "../data/squads";
import { CardView } from "./CardView";
import { cardThumbSrc } from "./shared";
import { TameStrength } from "./BossDetail";
import { broodOf } from "./void-seat";
import { tameScaleFor, tamedRoster } from "../data/void-tower";

const RARITY_ORDER: Record<string, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3 };

export function StoryPrep(props: {
  region: StoryRegion;
  node: StoryNode;
  save: StorySave;
  /** Persist a change to the campaign save: the deck in hand, and which squad
   *  it came from. The squads themselves are not in there — they are one
   *  library shared with the Arena, which this screen reads like anything else. */
  onSave: (next: StorySave) => void;
  /** That library, owned by App. Passed down rather than read from storage,
   *  because the builder opens as an overlay ON TOP of this screen — reading it
   *  once at mount would leave a squad saved up there invisible down here. */
  squads: Squad[];
  onSquads: (next: Squad[]) => void;
  onEditDeck: () => void;
  onCancel: () => void;
  /** `ally`: a tamed Void Tower boss to seat beside the player, or null. */
  onFight: (deck: string[], book: string[], ally: string | null) => void;
}) {
  const { region, node, save } = props;
  // The fight's cap, not the campaign's: a set piece opens up to 28 once the
  // ladder allows it, an ordinary node stays at STANDARD_CAP however far along
  // you are.
  const cap = fightCap(save, region, node);
  // The board THIS fight is on: a Hard border boss takes the tower's 5x5.
  const board = fightBoardFor(save, region, node);
  const boss = borderBossFor(save, node);
  // THE STABLE: tamed Tower bosses, each good for a few battles. Never the one
  // holding this border — it is standing right there.
  const stable = tamedRoster(save.tamed).filter((t) => t.boss.cardId !== boss);
  const [ally, setAlly] = useState<string | null>(null);
  const ladder = deckCapFor(save.cleared);
  // The squad: away from home you field what you packed and nothing else, so
  // every "which cards do I have" question below reads the POOL, not the whole
  // collection. At home the pool IS the collection and none of this shows —
  // and a Hard run is at home everywhere (`squadLimitFor`).
  const squadLimit = squadLimitFor(save, region);
  const pool = poolForRegion(save, region);
  // Packing is OFFERED, never forced. This used to be `needsSquad(...)`, which
  // meant the campaign stopped and demanded a modal the first time you walked
  // into a region — standing in LEAF holding eighteen LEAF cards, made to choose
  // twelve FOREIGN ones before you could play. The pool auto-packs now, and this
  // panel only opens when the player taps for it.
  const canPack = squadIsOfferable(save, region);
  const local = localCards(save, region).length;
  // Quick select: arriving at a node ALREADY holding the team built for this
  // element is the point of tagging them. Falls back to the last deck used.
  const owned = (ids: string[]) => ids.filter((id) => pool.includes(id));
  const preferred = preferredSquad(props.squads, region.element, save.lastTeamId, (s) => {
    const n = owned(s.cards).length;
    return n > 0 && n <= cap;
  });
  /** Top a seed deck up from the pool to the cap, by the Fill button's own
   *  rule (`regionFill`): the region's element first, then the heaviest
   *  imports. It used to pad in pool order, which on a Hard run or at home is
   *  the whole collection in the order it was recruited.
   *
   *  Filtering a remembered deck through the squad leaves holes: a team built in
   *  LEAF, carried to PYRO, keeps only the cards that were packed — which landed
   *  the player on the prep screen holding 6 of 14 and no hint that the rest was
   *  theirs to add. Padding makes the default a full deck again, and it is only
   *  a default: everything below still edits it. */
  const fill = (seed: string[]) => {
    const out = [...new Set(seed)].slice(0, cap);
    if (out.length >= cap) return out;
    const taken = new Set(out);
    return [...out, ...regionFill(pool.filter((id) => !taken.has(id)), cap - out.length, region.element)];
  };
  const [deck, setDeck] = useState<string[]>(
    // This region's own remembered team comes first — walking away and back
    // should find the board you left, not whatever you last used elsewhere.
    // Every seed is still filtered through the pool, so a team from another
    // region cannot smuggle in cards you did not bring here.
    fill(
      deckForRegion(save, region).length ? deckForRegion(save, region)
        : preferred ? owned(preferred.cards)
        : owned(save.deck),
    ),
  );
  /** The spellbook this fight goes in with. Seeded from the team the prep
   *  screen opened on, empty when that team has none — and empty means "use
   *  the hero's shelf", the behaviour every campaign fight had before teams
   *  could carry a book at all. */
  const [book, setBook] = useState<string[]>(preferred?.spells ?? []);
  /** Cards ticked in the packing step, before it is committed. */
  const [packing, setPacking] = useState<string[]>(() => squadFor(save, region));
  /** Has the player asked to change the squad? Nothing opens this but a tap. */
  const [openPack, setOpenPack] = useState(false);
  const mustPack = openPack;
  const [pickedTeam, setPickedTeam] = useState<string | null>(preferred?.id ?? null);
  // The builder writes straight into the save, so follow it back in rather than
  // showing a stale team behind the overlay it was edited from.
  //
  // It must NOT run on mount: the initial state above has already chosen the
  // team tagged for this region, and letting the effect fire immediately
  // overwrote that with whatever was last saved — leaving the chip highlighted
  // for one team while a different one was actually loaded.
  //
  // Gated on the VALUE changing, not on a mount flag. StrictMode invokes an
  // effect twice on mount, which flips a "have I mounted" boolean on the first
  // pass and then lets the second pass through — the exact bug this is guarding
  // against. `save.deck` is a fresh array only when the save really changed, so
  // seeding the ref with the current one makes a repeat run a genuine no-op.
  const lastSavedDeck = useRef(save.deck);
  useEffect(() => {
    if (save.deck === lastSavedDeck.current) return;
    lastSavedDeck.current = save.deck;
    // Follow the POINTER as well as the cards: the builder records which squad
    // it just saved, and dropping that on the way back left the shelf showing
    // nothing selected for a squad that was, in fact, exactly what you held.
    if (save.deck.length) {
      setDeck(save.deck.filter((id) => pool.includes(id)));
      setPickedTeam(save.lastTeamId ?? null);
      // ...and the squad's SPELLBOOK. Only the cards came back here, so a book
      // edited in the builder sat behind the old one on this screen and only
      // reached a fight after the prep screen next remounted. Read from the
      // library itself: the builder has already written it, while the
      // `squads` prop catches up a render later.
      const squad = save.lastTeamId ? loadSquads().find((sq) => sq.id === save.lastTeamId) : undefined;
      if (squad) setBook(squad.spells ?? []);
    }
  }, [save.deck]); // eslint-disable-line react-hooks/exhaustive-deps -- `pool` is derived; only a real save change should resync
  const [naming, setNaming] = useState(false);
  // Same idea as the node panel: the squad is what you are building against, so
  // it is worth seeing rather than reading.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  /** Which drop-down under the squad bar is open: the saved squads, or the ⋯
   *  menu (edit / pack / save / delete). One at a time. */
  const [menu, setMenu] = useState<null | "squads" | "actions">(null);
  /** The lore shows two lines until asked for the rest. */
  const [loreOpen, setLoreOpen] = useState(false);

  const legal = loadoutLegal(deck, cap);

  /** Fill the deck to the cap from everything you can field here.
   *
   *  NOT your best cards, and that is the one thing here that is settled. Three
   *  strategies played against the premade field, 216 matches a cell:
   *
   *      pool        board  stride  cheapest  priciest
   *      DAWN+BOLT   4x4     59.7     67.1      5.1
   *      DAWN+BOLT   5x5     41.3     62.1     12.1
   *      LEAF+AQUA   4x4     58.8     47.2      3.2
   *      LEAF+AQUA   5x5     51.9     43.2     14.0
   *
   *  Filling with the priciest cards wins 3-14% of the time. It is the obvious
   *  reading of "fill with my best" and it is a button that loses you the
   *  fight: a fat curve draws cards it cannot afford while the other side takes
   *  squares. Same effect measured on the gauntlet decks, where swapping in the
   *  benched Legendaries took Blazing Cyclone from 47.7% to 31.0%.
   *
   *  Between the other two it is a TIE — 52.9 against 54.9 on average, inside
   *  the error bar, and they split two pools each. So this does not claim the
   *  better one. It STRIDES the pool in cost order, which is the steadier of the
   *  two (41-60 against cheapest's 43-67) and produces something that reads as a
   *  deck, with an opening and a finisher, rather than thirty one-drops a player
   *  would look at and rebuild by hand. Ties go to the rarer card, then the
   *  heavier stat line, using the budget the cost formula itself uses.
   *
   *  ...and it strides the REGION'S cards (`regionFill`): its own element plus
   *  the twelve heaviest from elsewhere. A stride over a whole collection — the
   *  pool at home and on a Hard run — came out as all eight elements at once.
   *
   *  It is a DEFAULT, not a commitment: everything else on this screen still
   *  edits what it produces. */
  const fillToCap = () => {
    setDeck(regionFill(pool, cap, region.element));
    // The deck is no longer the squad's, so stop claiming it is — the chip above
    // is the one thing on this screen that says which squad you are fielding.
    setPickedTeam(null);
  };
  /** What this fight will actually cast — the team's book or the shelf, trimmed
   *  to the board. The same call the fight makes, so the readout cannot drift
   *  from the thing it describes. */
  const fightBook = bookForLoadout(save, { id: "", name: "", cards: deck, spells: book }, board);
  /** The shelf, as this fight sees it.
   *
   *  One library now, so squads built in the Arena show up here too — and away
   *  from home you field what you PACKED, so what decides a squad is how much of
   *  it is actually available, not which screen saved it. A squad with nothing
   *  available is shown and disabled rather than hidden: it is still yours, it
   *  just is not here. Tapping one used to be a trap — it emptied the deck and
   *  greyed out Fight without ever saying why. */
  const away = pool.length < save.collection.length;
  const teams = squadsFor(props.squads, region.element).map((s) => {
    const have = owned(s.cards).length;
    return {
      squad: s,
      have,
      usable: have > 0,
      why: have > 0
        ? (s.element ? `Built for ${s.element}` : "Built in the Arena")
        : away
          ? `None of these ${s.cards.length} cards came with you into ${region.element}`
          : `You do not own any of these ${s.cards.length} cards yet`,
    };
  })
    // PICKABLE FIRST, which is what the list looks like once OPENED — the
    // closed state is just the squad you are holding. Without it the list is in
    // save order, so opening it on a full collection buries the ones you can
    // field here under the ones you cannot.
    //
    // ONE key, not two: `squadsFor` has already put this element's squads at the
    // front, and Array.sort is stable, so that order survives inside each group.
    // Repeating the element rule here would be a second copy of it to keep in
    // step with the first.
    .sort((a, b) => Number(b.usable) - Number(a.usable));

  // A Hard border fields its boss and brood, boss first; a node its squad.
  const enemy = boss ? broodOf(boss).map(getDef) : fieldedBy(node)
    .map(getDef)
    .sort((a, b) => (RARITY_ORDER[a.rarity ?? ""] ?? 9) - (RARITY_ORDER[b.rarity ?? ""] ?? 9));

  const applyTeam = (t: Squad) => {
    setDeck(owned(t.cards));
    // A team's book travels with it. Absent = fall back to the shelf, which is
    // what every pre-spellbook team in an existing save has.
    setBook(t.spells ?? []);
    setPickedTeam(t.id);
    // Remember it, so coming back to this node offers the team you actually
    // chose rather than the oldest one that happens to match the element.
    // `save.deck` keeps its identity here, so the sync effect above stays quiet.
    props.onSave({ ...save, lastTeamId: t.id });
  };

  const saveTeam = () => {
    const name = draftName.trim() || `${region.element} squad`;
    // Same name overwrites — `saveSquad` matches by name, deliberately, so
    // re-tuning the PYRO squad after a loss replaces it instead of leaving you
    // scrolling past four things all called "PYRO squad".
    const next = saveSquad({
      name,
      element: region.element,
      cards: [...deck],
      spells: book.length ? [...book] : undefined,
    });
    props.onSquads(next);
    const saved = squadNamed(next, name);
    // The save keeps the deck in HAND and a pointer to where it came from; the
    // squad itself went to the shared library above. Priming the ref first so
    // the sync effect treats this as the no-op it is — without that, saving
    // here bounced back through the effect and cleared the highlight off the
    // very squad you had just saved.
    lastSavedDeck.current = deck;
    props.onSave({ ...save, deck, lastTeamId: saved?.id });
    setPickedTeam(saved?.id ?? null);
    setNaming(false);
    setDraftName("");
  };

  const deleteTeam = (id: string) => {
    props.onSquads(deleteSquad(id));
    if (save.lastTeamId === id) props.onSave({ ...save, lastTeamId: undefined });
  };

  /** NOTHING ON THIS SCREEN IS A CHOICE.
   *
   *  The map's node panel already has a Fight button. Tapping it lands here, on
   *  a second Fight button — which is worth the stop whenever there is something
   *  between them to decide, and is a turnstile when there is not. On a brand
   *  new save there is not: six cards, a cap of at least six, no saved squads,
   *  no packing to do and no spells unlocked. Every control below is either
   *  disabled or a no-op, and the only path through is the button that repeats
   *  the one just pressed.
   *
   *  So the test is the affordances themselves, one per panel, rather than "is
   *  this the first battle". That matters: this stops being true the moment the
   *  player owns more cards than they can field — a pack or two in — and the
   *  screen comes back on its own, without a flag to remember or a special case
   *  to keep in step with the campaign.
   *
   *  `legal.ok` is in here because an auto-fight must never launch a deck the
   *  Fight button itself would have refused. */
  const perfunctory =
    legal.ok &&
    pool.length <= cap &&      // no deck to choose — you field what you have
    !canPack &&                // no expedition to pack
    teams.length === 0 &&      // no saved squad to swap in
    fightBook.length === 0 &&  // no spells to walk in with
    stable.length === 0;       // no tamed boss to bring

  /** Fired once per node. `onFight` unmounts this screen (App flips `started`),
   *  so this is belt and braces — but an effect that can start a battle twice is
   *  not the place to rely on someone else's unmount. */
  const autoFought = useRef<string | null>(null);
  useEffect(() => {
    if (!perfunctory || mustPack) return;
    if (autoFought.current === node.id) return;
    autoFought.current = node.id;
    props.onFight(deck, book, null);
    // Deliberately keyed on the node, not on `deck`/`book`: those are state this
    // screen owns and they settle on the first render for exactly the saves this
    // applies to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfunctory, mustPack, node.id]);
  // Render nothing rather than flashing a screen the player is not going to see.
  if (perfunctory && !mustPack) return null;

  // ── packing step ──────────────────────────────────────────────────────────
  // You are standing at a border you have not taken with more cards than you can
  // carry. Nothing else on this screen matters until the expedition is chosen,
  // so it replaces the screen rather than sitting on it as one more panel.
  if (mustPack) {
    const limit = squadLimit ?? 0;
    const full = packing.length >= limit;
    const byRarity = [...packableFor(save, region)].sort(
      (a, b) =>
        (RARITY_ORDER[getDef(a).rarity ?? ""] ?? 9) - (RARITY_ORDER[getDef(b).rarity ?? ""] ?? 9) ||
        getDef(a).cost - getDef(b).cost,
    );
    const toggle = (id: string) =>
      setPacking((p) => (p.includes(id) ? p.filter((x) => x !== id) : full ? p : [...p, id]));
    return (
      <div className="overlay on-top">
        <div className="modal story-prep sp-packview">
          <div className="sp-head">
            <div>
              <div className="sp-kind">Pack your squad</div>
              <h1>{region.name}</h1>
            </div>
            <div className="sp-board">
              <b>{packing.length}/{limit}</b>
              <span>carried</span>
            </div>
          </div>

          <p className="sp-note">
            Every {region.element} card you have unlocked already fights here — {local} of
            them. Choose up to {limit} more to bring from elsewhere; the rest wait until
            you come back through. You are only asked once.
          </p>

          <div className="sr-label">Cards to carry · {packableFor(save, region).length}</div>
          <div className="sp-enemy sp-pack">
            {byRarity.map((id) => {
              const d = getDef(id);
              const on = packing.includes(id);
              return (
                <button
                  key={id}
                  className={`sp-card sp-foe-btn r-${d.rarity ?? "rare"} ${on ? "on" : ""}`}
                  disabled={!on && full}
                  title={on ? `${d.name} — carried` : full ? "Squad is full" : `${d.name} — leave or carry`}
                  onClick={() => toggle(id)}
                >
                  <img
                    className="sp-card-art"
                    src={cardThumbSrc(d)}
                    alt=""
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                  <span className="sp-card-name">{d.name}</span>
                  <em className="cost">{d.cost}<i className="coin" /></em>
                </button>
              );
            })}
          </div>

          <div className="sp-actions">
            <button
              className="ghost sm"
              onClick={() => setPacking(byRarity.slice(0, limit))}
            >
              Fill with best
            </button>
            <button className="ghost sm" onClick={() => setPacking([])} disabled={!packing.length}>
              Clear
            </button>
            <button className="ghost sm" onClick={() => setOpenPack(false)}>Cancel</button>
          </div>

          <button
            className="lockin"
            disabled={packing.length === 0}
            onClick={() => { props.onSave(packSquad(save, region, packing)); setOpenPack(false); }}
          >
            {packing.length ? `Cross with ${packing.length}` : "Choose who comes with you"}
          </button>
        </div>
      </div>
    );
  }

  // ── the squad check ───────────────────────────────────────────────────────
  // Redesigned 2026-10-04 (owner, from a mock): one scrolling column with FIGHT
  // pinned under it, so the button can never slide beneath the bottom nav (it
  // used to, cut in half); both squads drawn as card art; a cost curve; and the
  // five loose buttons folded into one squad picker and a ⋯ menu.
  const pickedName = teams.find((t) => t.squad.id === pickedTeam)?.squad.name;
  /** Cards per cost, 1..8+, for the curve. */
  const curve = Array.from({ length: 8 }, () => 0);
  for (const id of deck) curve[Math.min(8, Math.max(1, getDef(id).cost)) - 1]++;
  const curveMax = Math.max(1, ...curve);
  const avgCost = deck.length ? deck.reduce((n, id) => n + getDef(id).cost, 0) / deck.length : 0;
  const enemyGold = enemy.reduce((n, d) => n + d.cost, 0);
  const toggleMenu = (m: "squads" | "actions") => setMenu((cur) => (cur === m ? null : m));
  const openSlots = cap - deck.length;

  return (
    <div className="overlay on-top">
      <div className="modal story-prep sp-main">
        <div className="sp-scroll">
          <div className="sp-head">
            <div>
              <div className="sp-kind">
                {boss ? "Border boss" : isGate(node) ? "Border gate" : node.kind}
                {!boss && <> · {region.element}</>}
              </div>
              <h1>{node.name}</h1>
            </div>
            <div className="sp-board">
              <b>{board}×{board}</b>
              <span>{boss ? "Void Trial" : board === 5 ? "set piece" : "standard"}</span>
            </div>
          </div>

          <div className="sp-facts">
            {boss ? (
              <span className="sp-fact">
                Held by <b>{getDef(boss).name}</b>
                {borderBossScale(node) < 1 && ` and its brood at ${Math.round(borderBossScale(node) * 100)}% strength`}
                {" "}· slay it to cross, under the tower's rules
              </span>
            ) : (
              <span className={`sp-fact sp-fact-el el-${region.element.toLowerCase()}`}>
                <b>{region.element}</b> · {region.terrain} all battle
              </span>
            )}
            <span className="sp-fact">
              Squad cap <b>{cap}</b>
              {boss ? " · a full Tower deck" : cap > STANDARD_CAP && " · the big board opens it up"}
              {cap < ladder && squadLimit === null && ` · ${ladder} on a set piece`}
            </span>
            {/* Away from home the squad is usually the binding constraint, and it
                is the one the player can do nothing about from here — so say which
                it is, and say where it can be changed. */}
            {squadLimit === null ? (
              <span className="sp-fact sp-home">
                {isHard(save) ? "Hard mode" : "Home ground"} · whole collection
              </span>
            ) : (
              <span className="sp-fact">
                <b>{local}</b> {region.element} here
                {canPack && (
                  <>
                    {" · "}
                    <b>{pool.length - local}</b>/{squadLimit} carried
                    {squadIsExplicit(save, region) ? "" : " (auto)"}
                  </>
                )}
              </span>
            )}
          </div>

          {node.lore && (
            <div className="sp-lorebox">
              <p className={`sp-lore ${loreOpen ? "open" : ""}`}>{node.lore}</p>
              <button className="sp-more" onClick={() => setLoreOpen((v) => !v)}>
                {loreOpen ? "Show less" : "Read more"}
              </button>
            </div>
          )}
          {node.note && <p className="sp-note">{node.note}</p>}

          <section className="sp-sec">
            <div className="sr-label sp-row">
              <span>They field</span>
              <span className="sp-meta"><b className="sp-gold">{enemyGold}</b> gold · tap to read</span>
            </div>
            <div className="sp-grid sp-grid-foes">
              {enemy.map((d) => (
                <button
                  key={d.id}
                  className={`sp-tile r-${d.rarity ?? "rare"}`}
                  title={`${d.name} — see the card`}
                  aria-label={`Read ${d.name}`}
                  onClick={() => setPreviewId(d.id)}
                >
                  <img src={cardThumbSrc(d)} alt="" loading="lazy"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  <span className="sp-tile-cost">{d.cost}</span>
                  <span className="sp-tile-name">{d.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="sp-sec">
            <div className="sr-label sp-row">
              <span>Your squad</span>
              <span className="sp-meta">{deck.length} / {cap}</span>
            </div>
            <div className="sp-squadbar">
              {teams.length > 0 ? (
                <button
                  className="sp-picker"
                  aria-expanded={menu === "squads"}
                  onClick={() => toggleMenu("squads")}
                  title="Choose one of your saved squads"
                >
                  <span className="sp-picker-name">{pickedName ?? "Custom squad"}</span>
                  <small>▾ {teams.length} saved</small>
                </button>
              ) : (
                <span className="sp-picker sp-picker-none">
                  <span className="sp-picker-name">{pickedName ?? "Custom squad"}</span>
                </span>
              )}
              {/* Next to the squad it changes: the campaign remembered your deck
                  but nothing ever built you one, so every fight opened with
                  assembling a deck by hand even when you did not care which
                  cards went in. */}
              {pool.length > 0 && (
                <button
                  className="sp-ibtn"
                  onClick={fillToCap}
                  title={`Take ${Math.min(cap, new Set(pool).size)} cards from everything you can field here`}
                >
                  Fill
                </button>
              )}
              <button
                className="sp-ibtn"
                aria-label="Squad actions"
                aria-expanded={menu === "actions"}
                onClick={() => toggleMenu("actions")}
              >
                {/* Dots, not "⋯": the game's body face has no U+22EF and fell back
                    to something that read as "---". */}
                <span className="sp-dots" aria-hidden="true"><i /><i /><i /></span>
              </button>
            </div>

            {menu === "squads" && (
              <div className="sp-menu" role="menu">
                {/* Every squad you own, the unfieldable ones included — still
                    disabled, still carrying the reason why. Tapping one used to
                    empty the deck and grey out Fight in silence. */}
                {teams.map(({ squad: t, have, usable, why }) => (
                  <button
                    key={t.id}
                    role="menuitem"
                    className={`${pickedTeam === t.id ? "on" : ""} ${t.element === region.element ? "match" : ""}`}
                    onClick={() => { applyTeam(t); setMenu(null); }}
                    disabled={!usable}
                    title={why}
                  >
                    {t.name}
                    <span>{have > cap ? `${have}!` : have}{pickedTeam === t.id ? " · holding" : ""}</span>
                  </button>
                ))}
              </div>
            )}

            {menu === "actions" && (
              <div className="sp-menu" role="menu">
                <button role="menuitem" onClick={() => { setMenu(null); props.onEditDeck(); }}>
                  Edit cards <span>open the builder</span>
                </button>
                {canPack && (
                  <button
                    role="menuitem"
                    title={`Choose which cards travel with you into ${region.element}`}
                    onClick={() => {
                      setMenu(null);
                      setPacking(squadFor(save, region).length ? squadFor(save, region) : pool.filter((id) => getDef(id).element !== region.element));
                      setOpenPack(true);
                    }}
                  >
                    Pack <span>which cards travel here</span>
                  </button>
                )}
                {naming ? (
                  <span className="sp-naming">
                    <input
                      autoFocus
                      value={draftName}
                      placeholder={`${region.element} squad`}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { saveTeam(); setMenu(null); } }}
                    />
                    <button className="ghost sm" onClick={() => { saveTeam(); setMenu(null); }}>Save</button>
                  </span>
                ) : (
                  <button role="menuitem" onClick={() => setNaming(true)} disabled={!legal.ok}>
                    Save as a squad <span>name it</span>
                  </button>
                )}
                {pickedTeam && (
                  <button
                    role="menuitem"
                    className="danger"
                    onClick={() => { deleteTeam(pickedTeam); setPickedTeam(null); setMenu(null); }}
                  >
                    Delete “{pickedName ?? "this squad"}”
                  </button>
                )}
              </div>
            )}

            <div className="sp-curvehead">
              <span>Cost curve</span>
              <span>avg <b>{avgCost.toFixed(1)}</b> gold</span>
            </div>
            <div className="sp-curve" aria-label="Cards in the squad at each cost">
              {curve.map((n, k) => (
                <div
                  key={k}
                  className={`sp-bar ${n ? "" : "zero"}`}
                  title={`${n} card${n === 1 ? "" : "s"} at ${k === 7 ? "8+" : k + 1} gold`}
                >
                  <i style={{ height: `${Math.max(3, (n / curveMax) * 30)}px` }} />
                  <span>{k === 7 ? "8+" : k + 1}</span>
                </div>
              ))}
            </div>

            {/* TAPPABLE: one card is the commonest edit there is, and this screen
                once refused it (the only way was to leave for the builder). */}
            <div className="sp-grid sp-grid-deck">
              {deck.map((id, i) => {
                const d = getDef(id);
                return (
                  <button
                    key={`${id}-${i}`}
                    className={`sp-tile pick r-${d.rarity ?? "rare"}`}
                    title={`Drop ${d.name}`}
                    aria-label={`Drop ${d.name}`}
                    onClick={() => { setDeck((cur) => cur.filter((x) => x !== id)); setPickedTeam(null); }}
                  >
                    <img src={cardThumbSrc(d)} alt="" loading="lazy"
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                    <span className="sp-tile-cost">{d.cost}</span>
                    <span className="sp-tile-name">{d.name}</span>
                    <i className="sp-drop" aria-hidden="true">✕</i>
                  </button>
                );
              })}
              {deck.length < cap && (
                <button className="sp-tile sp-tile-add" onClick={props.onEditDeck} title="Pick cards yourself">
                  <span>+</span>
                  <small>Add</small>
                </button>
              )}
            </div>
            <div className={`sp-status ${legal.ok ? "ok" : "bad"}`}>
              {!legal.ok
                ? legal.reason
                : openSlots > 0
                  ? `${openSlots} slot${openSlots === 1 ? "" : "s"} open · Fill tops it up`
                  : "Ready · tap a card to drop it"}
            </div>
          </section>

          {/* The book you are walking in with, stated. Spells are chosen in the
              builder and travel with the team, so without this line the choice
              vanishes between saving it and casting it. */}
          <section className="sp-sec">
            <div className="sr-label sp-row">
              <span>Spellbook{book.length === 0 && <span className="sp-auto"> · auto</span>}</span>
              <span className="sp-meta">{fightBook.length} / {spellCapForBoard(board)}</span>
            </div>
            <div className="sp-spells">
              {fightBook.map((id, i) => {
                const sp = getSpell(id);
                return (
                  <span key={`${id}-${i}`} className="sp-spell">
                    {sp.name}
                    <em>{sp.cost}<i className="gem" /></em>
                  </span>
                );
              })}
              {fightBook.length === 0 && <span className="sp-none">No spells unlocked yet.</span>}
            </div>
          </section>

          {/* A TAMED BOSS, brought from the Tower. Only when there is one — an
              empty picker would advertise a feature the player cannot use yet. */}
          {stable.length > 0 && (
            <section className="sp-sec">
              <div className="sr-label sp-row">
                <span>Bring a tamed boss</span>
                <span className="sp-meta">
                  Uses a battle, win or lose
                </span>
              </div>
              <div className="bd-stable-row">
                <button type="button" className={`bd-tame ${ally === null ? "on" : ""}`} onClick={() => setAlly(null)}>
                  <span className="bd-tame-none">Alone</span>
                </button>
                {stable.map(({ boss: t, uses }) => {
                  const tDef = getDef(t.cardId);
                  const k = tameScaleFor(t.cardId);
                  return (
                    <button
                      key={t.cardId}
                      type="button"
                      className={`bd-tame ${ally === t.cardId ? "on" : ""}`}
                      onClick={() => setAlly(ally === t.cardId ? null : t.cardId)}
                      title={`${tDef.name} — ${uses} battle(s) left · ${Math.round(k * 100)}% strength`}
                    >
                      <img src={cardThumbSrc(tDef)} alt="" />
                      <TameStrength k={k} />
                      <span className="bd-tame-name">{tDef.name}</span>
                      <span className="bd-tame-uses">{uses}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {previewId && (
          <CardView mode="browse" def={getDef(previewId)} onClose={() => setPreviewId(null)} />
        )}

        <div className="sp-fightbar">
          <button className="sp-back" onClick={props.onCancel} aria-label="Back to the map" title="Back">‹</button>
          <button
            className="lockin sp-fight"
            disabled={!legal.ok}
            onClick={() => {
              props.onSave(rememberDeck(save, region, deck));
              props.onFight(deck, book, ally);
            }}
          >
            <b>{legal.ok ? "Fight" : "Fix your squad"}</b>
            <small>
              {legal.ok
                ? `${deck.length} card${deck.length === 1 ? "" : "s"} · ${fightBook.length} spell${fightBook.length === 1 ? "" : "s"}${ally ? ` · ${getDef(ally).name}` : ""}`
                : legal.reason}
            </small>
          </button>
        </div>
      </div>
    </div>
  );
}

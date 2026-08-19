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
  autoDeck,
  boardForNode, deckCapFor, deckForRegion, fieldedBy, fightCap, isGate, loadoutLegal, localCards,
  packSquad, packableFor, poolForRegion, rememberDeck,
  squadCapInRegion, squadFor, squadIsExplicit, squadIsOfferable,
  type StoryNode, type StoryRegion, type StorySave, STANDARD_CAP, bookForLoadout,
} from "../data/story";
import {
  deleteSquad, preferredSquad, saveSquad, squadNamed, squadsFor, type Squad,
} from "../data/squads";
import { CardView } from "./CardView";

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
  onFight: (deck: string[], book: string[]) => void;
}) {
  const { region, node, save } = props;
  // The fight's cap, not the campaign's: a set piece opens up to 28 once the
  // ladder allows it, an ordinary node stays at STANDARD_CAP however far along
  // you are.
  const cap = fightCap(save, region, node);
  const board = boardForNode(region, node);
  const ladder = deckCapFor(save.cleared);
  // The squad: away from home you field what you packed and nothing else, so
  // every "which cards do I have" question below reads the POOL, not the whole
  // collection. At home the pool IS the collection and none of this shows.
  const squadLimit = squadCapInRegion(save.cleared, region);
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
  /** Top a seed deck up from the pool, in pool order, to the cap.
   *
   *  Filtering a remembered deck through the squad leaves holes: a team built in
   *  LEAF, carried to PYRO, keeps only the cards that were packed — which landed
   *  the player on the prep screen holding 6 of 14 and no hint that the rest was
   *  theirs to add. Padding makes the default a full deck again, and it is only
   *  a default: everything below still edits it. */
  const fill = (seed: string[]) => {
    const out = [...new Set(seed)].slice(0, cap);
    for (const id of pool) {
      if (out.length >= cap) break;
      if (!out.includes(id)) out.push(id);
    }
    return out;
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
    if (save.deck.length) { setDeck(save.deck.filter((id) => pool.includes(id))); setPickedTeam(save.lastTeamId ?? null); }
  }, [save.deck]); // eslint-disable-line react-hooks/exhaustive-deps -- `pool` is derived; only a real save change should resync
  const [naming, setNaming] = useState(false);
  /** Is the squad list open? Closed by default — see the Quick select block. */
  const [pickerOpen, setPickerOpen] = useState(false);
  // Same idea as the node panel: the squad is what you are building against, so
  // it is worth seeing rather than reading.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

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
   *  It is a DEFAULT, not a commitment: everything else on this screen still
   *  edits what it produces. */
  const fillToCap = () => {
    setDeck(autoDeck(pool, cap));
    // The deck is no longer the squad's, so stop claiming it is — the chip above
    // is the one thing on this screen that says which squad you are fielding.
    setPickedTeam(null);
  };
  /** What this fight will actually cast — the team's book or the shelf, trimmed
   *  to the board. The same call the fight makes, so the readout cannot drift
   *  from the thing it describes. */
  const fightBook = bookForLoadout(save, { id: "", name: "", cards: deck, spells: book }, boardForNode(region, node));
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

  const enemy = fieldedBy(node)
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
                    src={`/cards/${d.art ?? d.id}.webp`}
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

  return (
    <div className="overlay on-top">
      <div className="modal story-prep">
        <div className="sp-head">
          <div>
            <div className="sp-kind">{isGate(node) ? "Border gate" : node.kind}</div>
            <h1>{node.name}</h1>
          </div>
          <div className="sp-board">
            <b>{board}×{board}</b>
            <span>{board === 5 ? "set piece" : "standard"}</span>
          </div>
        </div>

        <div className="sp-facts">
          <span><b>{region.element}</b> · {region.terrain} runs all battle</span>
          <span>
            Deck cap <b>{cap}</b>
            {cap > STANDARD_CAP && " · the big board opens it up"}
            {cap < ladder && squadLimit === null && ` · ${ladder} allowed on a set piece`}
          </span>
          {/* Away from home the squad is usually the binding constraint, and it
              is the one the player can do nothing about from here — so say which
              it is, and say where it can be changed. */}
          {squadLimit === null ? (
            <span className="sp-home">Home ground · your whole collection is here</span>
          ) : (
            <span>
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

        {node.lore && <p className="sp-lore">{node.lore}</p>}
        {node.note && <p className="sp-note">{node.note}</p>}

        {teams.length > 0 && (() => {
          // COLLAPSED TO THE ONE YOU ARE HOLDING. The first cut folded only the
          // squads that could not be fielded here, which helps a save whose
          // squads are mostly foreign and does nothing for one whose squads are
          // mostly usable — the list is still every squad you own, and eleven
          // pickable chips wrap as far as nineteen did.
          //
          // A squad is already CHOSEN on arrival (`pickedTeam` starts on
          // `preferred`), so the closed state has the real answer in it and the
          // rest is a question nobody asked yet. One control, not the two
          // nested folds this replaced.
          const shown = pickerOpen ? teams : teams.filter((t) => t.squad.id === pickedTeam);
          return (
            <>
              <div className="sr-label">Quick select</div>
              <div className="sp-quick">
                {shown.map(({ squad: t, have, usable, why }) => (
                  <button
                    key={t.id}
                    className={`sp-chip ${pickedTeam === t.id ? "on" : ""} ${t.element === region.element ? "match" : ""} ${usable ? "" : "locked"}`}
                    onClick={() => applyTeam(t)}
                    disabled={!usable}
                    title={why}
                  >
                    {t.name}<em>{have > cap ? `${have}!` : have}</em>
                  </button>
                ))}
                {/* Opening shows every squad you own, the unfieldable ones
                    included — still disabled, still carrying the reason why.
                    That was a deliberate fix (tapping one used to empty the
                    deck and grey out Fight in silence) and folding must not
                    quietly undo it. */}
                <button
                  className="sp-chip sp-more"
                  onClick={() => setPickerOpen((v) => !v)}
                  title={pickerOpen ? "Show only the squad you are holding" : "Every squad you own"}
                >
                  {pickerOpen ? "Hide" : pickedTeam ? `Change · ${teams.length}` : `Choose · ${teams.length}`}
                </button>
              </div>
            </>
          );
        })()}

        <div className="sr-label">They field</div>
        <div className="sp-enemy">
          {enemy.map((d) => (
            <button
              key={d.id}
              className={`sp-foe sp-foe-btn r-${d.rarity ?? "rare"}`}
              title={`${d.name} — see the card`}
              onClick={() => setPreviewId(d.id)}
            >
              <img
                className="sp-foe-art"
                src={`/cards/${d.art ?? d.id}.webp`}
                alt=""
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              {d.name}
              <em className="cost">{d.cost}<i className="coin" /></em>
            </button>
          ))}
        </div>

        <div className="sr-label sp-takelabel">
          <span>
            Taking in · {deck.length}/{cap}
            {!legal.ok && <span className="sp-bad"> — {legal.reason}</span>}
          </span>
          {/* Next to the count it changes, because that number IS the thing the
              button is for: the campaign remembered your deck but nothing ever
              built you one, so every fight opened with assembling a deck by
              hand even when you did not care which cards went in. */}
          {pool.length > 0 && (
            <button
              className="sp-fillbtn"
              onClick={fillToCap}
              title={`Take ${Math.min(cap, new Set(pool).size)} cards from everything you can field here`}
            >
              Fill
            </button>
          )}
        </div>
        <div className="sp-deck">
          {deck.map((id, i) => {
            const d = getDef(id);
            return (
              <span key={`${id}-${i}`} className={`sp-foe r-${d.rarity ?? "rare"}`}>
                {d.name}
                <em className="cost">{d.cost}<i className="coin" /></em>
              </span>
            );
          })}
        </div>

        {/* The book you are walking in with, stated. Spells are chosen in the
            builder and travel with the team, so without this line the choice
            vanishes between saving it and casting it — and "the shelf" and "a
            book I picked" look identical from here. */}
        <div className="sr-label">
          Spellbook · {fightBook.length}/{spellCapForBoard(boardForNode(region, node))}
          {book.length === 0 && <span className="sp-auto"> — auto, your cheapest unlocked</span>}
        </div>
        <div className="sp-deck">
          {fightBook.map((id) => {
            const sp = getSpell(id);
            return (
              <span key={id} className="sp-foe">
                {sp.name}
                <em className="cost">{sp.cost}<i className="gem" /></em>
              </span>
            );
          })}
          {fightBook.length === 0 && <span className="sp-none">No spells unlocked yet.</span>}
        </div>

        <div className="sp-actions">
          <button className="ghost sm" onClick={props.onEditDeck}>Deck builder</button>
          {canPack && (
            <button
              className="ghost sm"
              onClick={() => { setPacking(squadFor(save, region).length ? squadFor(save, region) : pool.filter((id) => getDef(id).element !== region.element)); setOpenPack(true); }}
              title={`Choose which cards travel with you into ${region.element}`}
            >
              {/* "Pack", not "Squad". This button chooses which cards TRAVEL
                  with you, and it sat between "Save squad" and "Delete squad",
                  which act on a saved team — three buttons, one word, two
                  meanings, ever since squad became the name for a saved team. */}
              Pack
            </button>
          )}
          {pickedTeam && (
            <button className="ghost sm" onClick={() => { deleteTeam(pickedTeam); setPickedTeam(null); }}>
              Delete squad
            </button>
          )}
          {naming ? (
            <span className="sp-naming">
              <input
                autoFocus
                value={draftName}
                placeholder={`${region.element} squad`}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTeam()}
              />
              <button className="ghost sm" onClick={saveTeam}>Save</button>
            </span>
          ) : (
            <button className="ghost sm" onClick={() => setNaming(true)} disabled={!legal.ok}>
              Save squad
            </button>
          )}
          <button className="ghost sm" onClick={props.onCancel}>Back</button>
        </div>

        {previewId && (
          <CardView mode="browse" def={getDef(previewId)} onClose={() => setPreviewId(null)} />
        )}

        <button
          className="lockin"
          disabled={!legal.ok}
          onClick={() => {
            props.onSave(rememberDeck(save, region, deck));
            props.onFight(deck, book);
          }}
        >
          {legal.ok ? "Fight" : (legal.reason ?? "Fix your squad")}
        </button>
      </div>
    </div>
  );
}

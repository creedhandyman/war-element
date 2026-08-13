/** Story Mode — the last screen before a fight.
 *
 *  The campaign asks one deck to answer eight elements, and until now the only
 *  place to rebuild it was the Collection, three taps away on the map. So the
 *  honest play was to walk into a region, lose once to learn what it fields,
 *  walk back out, rebuild, and walk in again.
 *
 *  This is that rebuild, brought to where the decision actually happens: what
 *  you are about to fight, on which board, with which team — and a shelf of
 *  saved teams tagged by the element they answer, so arriving in PYRO offers
 *  you the deck you built for PYRO.
 */
import { useEffect, useRef, useState } from "react";
import { getDef } from "../data/cards";
import {
  boardForNode, deckCapFor, deckForRegion, fightCap, isGate, loadoutLegal, loadoutsFor, localCards,
  packSquad, packableFor, poolForRegion, preferredLoadout, recruitablePool, rememberDeck,
  squadCapInRegion, squadFor, squadIsExplicit, squadIsOfferable,
  type Loadout, type StoryNode, type StoryRegion, type StorySave,
} from "../data/story";
import { CardExpand } from "./CardExpand";

const RARITY_ORDER: Record<string, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3 };

export function StoryPrep(props: {
  region: StoryRegion;
  node: StoryNode;
  save: StorySave;
  /** Persist a change to the saved teams (and the current deck). */
  onSave: (next: StorySave) => void;
  onEditDeck: () => void;
  onCancel: () => void;
  onFight: (deck: string[]) => void;
}) {
  const { region, node, save } = props;
  // The fight's cap, not the campaign's: a set piece opens up to 28 once the
  // ladder allows it, an ordinary node stays at 18 however far along you are.
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
  const preferred = preferredLoadout(save, region.element, (l) => {
    const n = owned(l.cards).length;
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
    if (save.deck.length) { setDeck(save.deck.filter((id) => pool.includes(id))); setPickedTeam(null); }
  }, [save.deck]); // eslint-disable-line react-hooks/exhaustive-deps -- `pool` is derived; only a real save change should resync
  const [naming, setNaming] = useState(false);
  // Same idea as the node panel: the squad is what you are building against, so
  // it is worth seeing rather than reading.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const legal = loadoutLegal(deck, cap);
  const teams = loadoutsFor(save, region.element);
  const enemy = [...new Set([...recruitablePool(node), ...node.adds])]
    .map(getDef)
    .sort((a, b) => (RARITY_ORDER[a.rarity ?? ""] ?? 9) - (RARITY_ORDER[b.rarity ?? ""] ?? 9));

  const applyTeam = (t: Loadout) => {
    setDeck(owned(t.cards));
    setPickedTeam(t.id);
    // Remember it, so coming back to this node offers the team you actually
    // chose rather than the oldest one that happens to match the element.
    // `save.deck` keeps its identity here, so the sync effect above stays quiet.
    props.onSave({ ...save, lastTeamId: t.id });
  };

  const saveTeam = () => {
    const name = draftName.trim() || `${region.element} team`;
    // Same name = overwrite. Re-tuning the PYRO deck after a loss should not
    // leave you scrolling past four decks all called "PYRO team".
    const rest = (save.loadouts ?? []).filter((l) => l.name.toLowerCase() !== name.toLowerCase());
    const next: Loadout = {
      id: `${name.toLowerCase().replace(/\s+/g, "-")}-${rest.length}`,
      name,
      element: region.element,
      cards: [...deck],
    };
    props.onSave({ ...save, loadouts: [...rest, next], deck, lastTeamId: next.id });
    setNaming(false);
    setDraftName("");
  };

  const deleteTeam = (id: string) =>
    props.onSave({
      ...save,
      loadouts: (save.loadouts ?? []).filter((l) => l.id !== id),
      lastTeamId: save.lastTeamId === id ? undefined : save.lastTeamId,
    });

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
            {cap > 18 && " · the big board opens it up"}
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

        {teams.length > 0 && (
          <>
            <div className="sr-label">Quick select</div>
            <div className="sp-quick">
              {teams.map((t) => {
                const n = owned(t.cards).length;
                return (
                  <button
                    key={t.id}
                    className={`sp-chip ${pickedTeam === t.id ? "on" : ""} ${t.element === region.element ? "match" : ""}`}
                    onClick={() => applyTeam(t)}
                    title={t.element ? `Built for ${t.element}` : undefined}
                  >
                    {t.name}<em>{n > cap ? `${n}!` : n}</em>
                  </button>
                );
              })}
            </div>
          </>
        )}

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

        <div className="sr-label">
          Taking in · {deck.length}/{cap}
          {!legal.ok && <span className="sp-bad"> — {legal.reason}</span>}
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

        <div className="sp-actions">
          <button className="ghost sm" onClick={props.onEditDeck}>Deck builder</button>
          {canPack && (
            <button
              className="ghost sm"
              onClick={() => { setPacking(squadFor(save, region).length ? squadFor(save, region) : pool.filter((id) => getDef(id).element !== region.element)); setOpenPack(true); }}
              title={`Choose which cards travel with you into ${region.element}`}
            >
              Squad
            </button>
          )}
          {pickedTeam && (
            <button className="ghost sm" onClick={() => { deleteTeam(pickedTeam); setPickedTeam(null); }}>
              Delete team
            </button>
          )}
          {naming ? (
            <span className="sp-naming">
              <input
                autoFocus
                value={draftName}
                placeholder={`${region.element} team`}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTeam()}
              />
              <button className="ghost sm" onClick={saveTeam}>Save</button>
            </span>
          ) : (
            <button className="ghost sm" onClick={() => setNaming(true)} disabled={!legal.ok}>
              Save as team
            </button>
          )}
          <button className="ghost sm" onClick={props.onCancel}>Back</button>
        </div>

        {previewId && (
          <CardExpand def={getDef(previewId)} onClose={() => setPreviewId(null)} />
        )}

        <button
          className="lockin"
          disabled={!legal.ok}
          onClick={() => {
            props.onSave(rememberDeck(save, region, deck));
            props.onFight(deck);
          }}
        >
          {legal.ok ? "Fight" : (legal.reason ?? "Fix your team")}
        </button>
      </div>
    </div>
  );
}

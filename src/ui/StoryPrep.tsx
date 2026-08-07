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
  boardForNode, capForNode, deckCapFor, isGate, loadoutLegal, loadoutsFor, preferredLoadout,
  recruitablePool, type Loadout, type StoryNode, type StoryRegion, type StorySave,
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
  const cap = capForNode(save.cleared, region, node);
  const board = boardForNode(region, node);
  const ladder = deckCapFor(save.cleared);
  // Quick select: arriving at a node ALREADY holding the team built for this
  // element is the point of tagging them. Falls back to the last deck used.
  const owned = (ids: string[]) => ids.filter((id) => save.collection.includes(id));
  const preferred = preferredLoadout(save, region.element, (l) => {
    const n = owned(l.cards).length;
    return n > 0 && n <= cap;
  });
  const [deck, setDeck] = useState<string[]>(
    preferred ? owned(preferred.cards) : save.deck.length ? save.deck : save.collection.slice(0, cap),
  );
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
    if (save.deck.length) { setDeck(save.deck); setPickedTeam(null); }
  }, [save.deck]);
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
            {cap < ladder && ` · ${ladder} allowed on a set piece`}
          </span>
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
              <em>{d.cost}◆</em>
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
                <em>{d.cost}◆</em>
              </span>
            );
          })}
        </div>

        <div className="sp-actions">
          <button className="ghost sm" onClick={props.onEditDeck}>Deck builder</button>
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
            props.onSave({ ...save, deck });
            props.onFight(deck);
          }}
        >
          {legal.ok ? "Fight" : (legal.reason ?? "Fix your team")}
        </button>
      </div>
    </div>
  );
}

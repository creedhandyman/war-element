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
import { useState } from "react";
import { getDef } from "../data/cards";
import {
  boardForNode, capForNode, deckCapFor, isGate, loadoutLegal, loadoutsFor,
  recruitablePool, type Loadout, type StoryNode, type StoryRegion, type StorySave,
} from "../data/story";

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
  const [deck, setDeck] = useState<string[]>(
    save.deck.length ? save.deck : save.collection.slice(0, cap),
  );
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  const legal = loadoutLegal(deck, cap);
  const teams = loadoutsFor(save, region.element);
  const enemy = [...new Set([...recruitablePool(node), ...node.adds])]
    .map(getDef)
    .sort((a, b) => (RARITY_ORDER[a.rarity ?? ""] ?? 9) - (RARITY_ORDER[b.rarity ?? ""] ?? 9));

  const applyTeam = (t: Loadout) => setDeck(t.cards.filter((id) => save.collection.includes(id)));

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
    props.onSave({ ...save, loadouts: [...rest, next], deck });
    setNaming(false);
    setDraftName("");
  };

  const deleteTeam = (id: string) =>
    props.onSave({ ...save, loadouts: (save.loadouts ?? []).filter((l) => l.id !== id) });

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

        <div className="sr-label">They field</div>
        <div className="sp-enemy">
          {enemy.map((d) => (
            <span key={d.id} className={`sp-foe r-${d.rarity ?? "rare"}`}>
              {d.name}
              <em>{d.cost}◆</em>
            </span>
          ))}
        </div>

        {teams.length > 0 && (
          <>
            <div className="sr-label">Your teams</div>
            <div className="sp-teams">
              {teams.map((t) => (
                <div key={t.id} className={`sp-team ${t.element === region.element ? "match" : ""}`}>
                  <button className="sp-team-pick" onClick={() => applyTeam(t)}>
                    <b>{t.name}</b>
                    <span>
                      {t.cards.length} cards
                      {t.element === region.element && ` · built for ${t.element}`}
                    </span>
                  </button>
                  <button className="sp-team-x" onClick={() => deleteTeam(t.id)} title="Delete team">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

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
          <button className="ghost sm" onClick={props.onEditDeck}>Edit deck</button>
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

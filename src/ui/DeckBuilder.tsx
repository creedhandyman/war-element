import { useMemo, useState } from "react";
import type { Element } from "../engine";
import {
  buildableCards,
  deleteCustomDeck,
  loadCustomDecks,
  MAX_DECK,
  MIN_DECK,
  saveCustomDeck,
  TARGET_DECK,
  validateDeck,
  type CustomDeck,
} from "../data/custom-decks";
import { EL_COLOR } from "./shared";
import { SpIcon } from "./icons";

const ELEMENTS: Element[] = ["LEAF", "PYRO", "AQUA", "DAWN", "GALE", "BOLT", "DUSK", "BORE"];

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
  const [filter, setFilter] = useState<Element | "ALL">("ALL");

  const pool = useMemo(() => buildableCards(), []);
  const shown = filter === "ALL" ? pool : pool.filter((c) => c.element === filter);
  const pickedSet = new Set(picked);
  const check = validateDeck(picked);

  if (!props.open) return null;

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_DECK ? cur : [...cur, id]));
  }
  function reset() {
    setEditingId(null);
    setName("");
    setPicked([]);
  }
  function loadForEdit(d: CustomDeck) {
    setEditingId(d.id);
    setName(d.name);
    setPicked(d.cards.slice());
  }
  function save() {
    if (!check.ok) return;
    const next = saveCustomDeck({ id: editingId ?? undefined, name, cards: picked });
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

  return (
    <div className="overlay" onClick={props.onClose}>
      <div className="modal deck-builder" onClick={(e) => e.stopPropagation()}>
        <div className="db-head">
          <h2>Deck Builder</h2>
          <button className="cd-x" title="Close" onClick={props.onClose}>✕</button>
        </div>

        <div className="db-body">
          {/* Left: saved decks + the current editor's meta. */}
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

            <div className="db-saved">
              <div className="db-saved-h">Saved decks</div>
              {decks.length === 0 && <div className="db-empty">None yet — build one →</div>}
              {decks.map((d) => (
                <div key={d.id} className={`db-saved-row ${editingId === d.id ? "on" : ""}`}>
                  <button className="db-load" onClick={() => loadForEdit(d)} title="Edit this deck">
                    <b>{d.name}</b>
                    <span>{d.cards.length} cards</span>
                  </button>
                  <button className="db-del" title="Delete" onClick={() => remove(d.id)}>🗑</button>
                </div>
              ))}
            </div>
          </div>

          {/* Right: the card pool. Tap a card to add / remove it. */}
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
            <div className="db-grid">
              {shown.map((d) => {
                const on = pickedSet.has(d.id);
                return (
                  <button
                    key={d.id}
                    className={`deck-thumb carded db-card ${on ? "selected" : ""}`}
                    title={d.special ? `${d.special.name}: ${d.special.text}` : d.name}
                    onClick={() => toggle(d.id)}
                  >
                    <img
                      className="card-art"
                      src={`/cards/${d.art ?? d.id}.png`}
                      alt=""
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                    {on && <div className="db-check">✓</div>}
                    <div className="dt-top">
                      <span className="dt-cost">{d.cost}</span>
                      <span className="el-dot" style={{ background: EL_COLOR[d.element] }} />
                    </div>
                    <div className="dt-name">{d.name}</div>
                    <div className="dt-stats">
                      <span>⚔{d.hits > 1 ? `${d.hits}×` : ""}{d.dmg}</span>
                      <span>♥{d.hp}</span>
                      <span><SpIcon />{d.sp}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

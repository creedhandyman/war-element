import { useState } from "react";
import type { GameState, PlayerId } from "../engine";
import { getSpell } from "../engine";
import { spellArtSrc } from "./shared";

/** The human's spellbook. Each spell is castable once per game (Prep Phase, paid
 *  from Magic). Greyed when spent, too pricey, or it isn't your prep
 *  turn. Two shapes: the classic inline tray, and — with `collapsible` — a single
 *  centered "book" that taps open to reveal the spells (keeps the battlefield
 *  clear until you reach for a spell). */
export function SpellTray(props: {
  game: GameState;
  player: PlayerId;
  armedSpellId: string | null;
  myTurn: boolean;
  onPick: (spellId: string) => void;
  vertical?: boolean; // stack the chips in a column (right-of-field rail)
  collapsible?: boolean; // render as a tap-to-open book instead of an open row
}) {
  const { game, player } = props;
  const [open, setOpen] = useState(false);
  const book = game.players[player].spellbook;
  if (!book || book.length === 0) return null;
  const magic = game.players[player].magicPool;
  const remaining = book.filter((s) => !s.used).length; // spells not yet cast

  const chips = (
    <div className="spelltray-row">
      {book.map((slot) => {
        const spell = getSpell(slot.defId);
        const afford = magic >= spell.cost;
        const disabled = !props.myTurn || slot.used || !afford;
        const armed = props.armedSpellId === slot.defId;
        // Castable RIGHT NOW (your turn, unspent, affordable) and not already
        // armed → a soft ready-glow so you can see what you can actually cast.
        const ready = props.myTurn && !slot.used && afford && !armed;
        // FOUR STATES, EACH READABLE WITHOUT COLOUR. `disabled` used to flatten
        // "already cast", "can't afford it" and "not your turn" into one grey
        // row at 42% opacity — three different reasons wearing the same face,
        // and on a phone with no hover there was nothing else to consult.
        //
        // `poor` is split out because it is the only one of the three the player
        // can DO something about: it names the price it is short of. Spent stays
        // in place rather than hiding, because a cast spell is still information
        // about the match.
        const poor = !slot.used && !afford;
        const note = armed ? "TAP A TARGET TO CAST"
          : slot.used ? "ALREADY CAST"
          : poor ? `NEEDS ${spell.cost} MAGIC`
          : "";
        return (
          <button
            key={slot.defId}
            className={`spellchip ${armed ? "armed" : ""} ${slot.used ? "used" : ""} ${ready ? "ready" : ""} ${poor ? "poor" : ""}`}
            data-el={spell.element}
            disabled={disabled}
            title={`${spell.name} (cost ${spell.cost}) — ${spell.text}${slot.used ? " · already cast" : afford ? "" : " · not enough Magic"}`}
            onClick={() => {
              props.onPick(slot.defId);
              if (props.collapsible) setOpen(false);
            }}
          >
            <span className="spellchip-cost">{spell.cost}</span>
            <span className="spellchip-art">
              <img
                src={spellArtSrc(spell.id)}
                alt=""
                draggable={false}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </span>
            {/* Name + rules stack together so the row-shaped chips (phone
                spellbook, desktop rail) can show both. The rules used to live
                only in `title`, which never renders on touch — and heal / field
                / board-AoE spells cast the instant you tap them, so there was no
                later moment to read what you'd just committed to. */}
            <span className="spellchip-body">
              <span className="spellchip-head">
                <span className="spellchip-name">{spell.name}</span>
                {/* The state's own word, or a green dot when the state IS
                    "nothing is stopping you". Both sit at the end of the name
                    line so the eye finds them in the same place every row. */}
                {note
                  ? <span className="spellchip-note">{note}</span>
                  : ready ? <span className="spellchip-dot" aria-hidden="true" /> : null}
              </span>
              <span className="spellchip-text">{spell.text}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  // Any spell castable right now — used to nudge the collapsed book so you know
  // there's something worth opening it for.
  const anyCastable = props.myTurn && book.some((s) => !s.used && magic >= getSpell(s.defId).cost);

  // Collapsed book: a centered toggle that opens the chips in a small popover.
  if (props.collapsible) {
    return (
      <div className={`spellbook${open ? " open" : ""}${props.vertical ? " vertical" : ""}`}>
        {open && (
          <div className="spellbook-pop">
            {/* Both numbers the decision needs, above the rows: how many casts
                are left in the book at all, and how much Magic there is to pay
                with. Without the second one every "NEEDS n MAGIC" below is a
                figure with nothing to compare it against. */}
            <div className="spellbook-head">
              <span className="sbh-title">Spellbook</span>
              <span className="sbh-left">{remaining} of {book.length} left</span>
              <span className="sbh-magic"><i>✦</i><b>{magic}</b> magic</span>
            </div>
            {chips}
          </div>
        )}
        <button
          className={`spellbook-toggle ${anyCastable && !open ? "has-ready" : ""}`}
          onClick={() => setOpen((o) => !o)}
          title={anyCastable ? "Your spellbook — you have a spell you can cast" : "Your spellbook — tap to cast a spell"}
        >
          <span className="sb-ico">📖</span>
          <span className="sb-label">Spells</span>
          <span className={`sb-count ${remaining === 0 ? "spent" : ""}`}>{remaining}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`spelltray${props.vertical ? " vertical" : ""}`}>
      <div className="spelltray-label">Spells</div>
      {chips}
    </div>
  );
}

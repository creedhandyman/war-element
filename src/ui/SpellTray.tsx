import { useState } from "react";
import type { GameState, PlayerId } from "../engine";
import { getSpell } from "../engine";
import { EL_COLOR } from "./shared";

/** The human's spellbook. Each spell is castable once per game (Prep Phase, paid
 *  from the magic pool). Greyed when spent, too pricey, or it isn't your prep
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
        return (
          <button
            key={slot.defId}
            className={`spellchip ${armed ? "armed" : ""} ${slot.used ? "used" : ""}`}
            style={{ ["--el" as string]: EL_COLOR[spell.element] }}
            disabled={disabled}
            title={`${spell.name} (cost ${spell.cost}) — ${spell.text}${slot.used ? " · already cast" : afford ? "" : " · not enough magic"}`}
            onClick={() => {
              props.onPick(slot.defId);
              if (props.collapsible) setOpen(false);
            }}
          >
            <span className="spellchip-cost">{spell.cost}</span>
            <span className="spellchip-art" />
            <span className="spellchip-name">{spell.name}</span>
          </button>
        );
      })}
    </div>
  );

  // Collapsed book: a centered toggle that opens the chips in a small popover.
  if (props.collapsible) {
    return (
      <div className={`spellbook${open ? " open" : ""}${props.vertical ? " vertical" : ""}`}>
        {open && <div className="spellbook-pop">{chips}</div>}
        <button
          className="spellbook-toggle"
          onClick={() => setOpen((o) => !o)}
          title="Your spellbook — tap to cast a spell"
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

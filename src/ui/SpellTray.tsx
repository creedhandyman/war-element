import type { GameState, PlayerId } from "../engine";
import { getSpell } from "../engine";
import { EL_COLOR } from "./shared";

/** The human's spellbook as a row of mini spell cards. Each spell is castable
 *  once per game (Prep Phase, paid from the magic pool). Greyed when spent, too
 *  pricey, or it isn't your prep turn. */
export function SpellTray(props: {
  game: GameState;
  player: PlayerId;
  armedSpellId: string | null;
  myTurn: boolean;
  onPick: (spellId: string) => void;
  vertical?: boolean; // stack the chips in a column (right-of-field rail)
}) {
  const { game, player } = props;
  const book = game.players[player].spellbook;
  if (!book || book.length === 0) return null;
  const magic = game.players[player].magicPool;

  return (
    <div className={`spelltray${props.vertical ? " vertical" : ""}`}>
      <div className="spelltray-label">Spells</div>
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
              onClick={() => props.onPick(slot.defId)}
            >
              <span className="spellchip-cost">{spell.cost}</span>
              <span className="spellchip-art" />
              <span className="spellchip-name">{spell.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

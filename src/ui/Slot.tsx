import type { CardInstance, GameState, PlayerId, TrapState } from "../engine";
import { enemyOf, getSpell, homeRow } from "../engine";
import { EL_COLOR } from "./shared";
import { Token } from "./Token";

export function Slot(props: {
  game: GameState;
  row: number;
  col: number;
  viewer: PlayerId; // the local player's side (threaded to Token for "mine")
  card: CardInstance | null;
  legal: boolean;
  isTarget: boolean; // enemy attack/special target → red
  preview: boolean; // on-summon damage-area preview → red
  staged: boolean; // the home slot a summon is staged into → green ring
  dimmed: boolean;
  grayed: boolean;
  contested: boolean;
  captured: "P1" | "P2" | null;
  /** The viewer's OWN trap on this square, if any. Traps are concealed, so the
   *  caller passes one only when it belongs to the player looking at the board —
   *  never the opponent's, at any opacity. */
  trap: TrapState | null;
  canDrop: boolean; // a legal drag-to-summon drop target
  pickCount: number;
  selectedId: string | null;
  actingId: string | null;
  onClick: (row: number, col: number) => void;
  onDragOver: (row: number, col: number) => void;
  onDrop: (row: number, col: number) => void;
  onCycleAuto: (instanceId: string) => void;
}) {
  // Derived from the board size, not a fixed 4-entry table. That table tinted
  // row 3 as "yours" and had no entry at all for row 4, so on a 5×5 the home
  // colour sat one row forward of the real home row and the back row was blank.
  // Viewer-relative: the row you summon into is always "yours", whichever side
  // you're playing.
  const { boardSize } = props.game;
  const rowClass =
    props.row === homeRow(props.viewer, boardSize)
      ? "row-your"
      : props.row === homeRow(enemyOf(props.viewer), boardSize)
        ? "row-opp"
        : "row-mid";
  const acting = props.card != null && props.actingId === props.card.instanceId;
  const cls = [
    "slot",
    rowClass,
    acting ? "acting" : "",
    props.legal ? "legal" : "",
    props.isTarget ? "target" : "",
    props.preview ? "preview" : "",
    props.staged ? "staged" : "",
    props.dimmed ? "dimmed" : "",
    props.grayed ? "grayed" : "",
    props.contested ? "contested" : "",
    props.captured ? "captured" : "",
    props.trap ? "trapped" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={cls}
      onClick={() => props.onClick(props.row, props.col)}
      onDragOver={(e) => {
        if (!props.canDrop) return;
        e.preventDefault(); // allow the drop
        props.onDragOver(props.row, props.col);
      }}
      onDrop={(e) => {
        if (!props.canDrop) return;
        e.preventDefault();
        props.onDrop(props.row, props.col);
      }}
    >
      {props.captured && (
        <span className="lock" title={`Permanently captured by ${props.captured}`}>
          🔒
        </span>
      )}
      {props.trap && (
        <span
          className="trapmark"
          style={{ color: EL_COLOR[props.trap.element] }}
          title={`${getSpell(props.trap.spellId).name} — ${getSpell(props.trap.spellId).text}\n\nOnly you can see this.`}
        >
          ◈
        </span>
      )}
      {props.pickCount > 0 && (
        <div className="pick-count" title={`${props.pickCount} hit(s) assigned`}>
          ×{props.pickCount}
        </div>
      )}
      {props.card && (
        <Token
          game={props.game}
          card={props.card}
          viewer={props.viewer}
          selected={props.selectedId === props.card.instanceId}
          acting={props.actingId === props.card.instanceId}
          onCycleAuto={props.onCycleAuto}
        />
      )}
    </div>
  );
}

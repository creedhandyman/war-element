import type { CardInstance, GameState } from "../engine";
import { Token } from "./Token";

export function Slot(props: {
  game: GameState;
  row: number;
  col: number;
  card: CardInstance | null;
  legal: boolean;
  isTarget: boolean; // enemy attack/special target → red
  preview: boolean; // on-summon damage-area preview → red
  staged: boolean; // the home slot a summon is staged into → green ring
  dimmed: boolean;
  grayed: boolean;
  contested: boolean;
  captured: "P1" | "P2" | null;
  pickCount: number;
  selectedId: string | null;
  actingId: string | null;
  onClick: (row: number, col: number) => void;
  onCycleAuto: (instanceId: string) => void;
}) {
  const rowClass = ["row-opp", "row-mid", "row-mid", "row-your"][props.row];
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
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} onClick={() => props.onClick(props.row, props.col)}>
      {props.captured && (
        <span className="lock" title={`Permanently captured by ${props.captured}`}>
          🔒
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
          selected={props.selectedId === props.card.instanceId}
          acting={props.actingId === props.card.instanceId}
          onCycleAuto={props.onCycleAuto}
        />
      )}
    </div>
  );
}

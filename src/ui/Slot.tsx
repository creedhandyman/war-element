import type { CardInstance, GameState } from "../engine";
import { Token } from "./Token";

export function Slot(props: {
  game: GameState;
  row: number;
  col: number;
  card: CardInstance | null;
  legal: boolean;
  dimmed: boolean;
  contested: boolean;
  captured: "P1" | "P2" | null;
  selectedId: string | null;
  actingId: string | null;
  onClick: (row: number, col: number) => void;
  onCycleAuto: (instanceId: string) => void;
}) {
  const rowClass = ["row-opp", "row-mid", "row-mid", "row-your"][props.row];
  const cls = [
    "slot",
    rowClass,
    props.legal ? "legal" : "",
    props.dimmed ? "dimmed" : "",
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

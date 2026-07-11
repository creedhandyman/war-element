import type { GameState, Pos } from "../engine";
import { cardAt, isContested } from "../engine";
import { Slot } from "./Slot";

export function Board(props: {
  game: GameState;
  legalSlots: Pos[]; // summon/move destinations
  legalTargetIds: string[]; // battle-phase target picks
  pickCounts: Record<string, number>; // hits assigned per target so far
  hasSelection: boolean;
  selectedId: string | null;
  actingId: string | null;
  onSlotClick: (row: number, col: number) => void;
  onCycleAuto: (instanceId: string) => void;
}) {
  const { game } = props;
  const rows = [0, 1, 2, 3] as const;
  return (
    <div className="board-area">
      <div className="banner" style={{ color: "var(--opp-home-glow)" }}>
        ▲ Opponent Home
      </div>
      <div className="board">
        {rows.map((row) => (
          <div className="brow" key={row}>
            {rows.map((col) => {
              const card = cardAt(game, row, col);
              const legal =
                props.legalSlots.some((p) => p.row === row && p.col === col) ||
                (card !== null && props.legalTargetIds.includes(card.instanceId));
              const dimmed =
                (props.hasSelection || props.legalTargetIds.length > 0) && !legal;
              const contested =
                (row === 0 && isContested(game, "P2", col)) ||
                (row === 3 && isContested(game, "P1", col));
              return (
                <Slot
                  key={col}
                  game={game}
                  row={row}
                  col={col}
                  card={card}
                  legal={legal}
                  dimmed={dimmed}
                  contested={contested}
                  captured={game.slots[row][col].capturedBy}
                  pickCount={card ? (props.pickCounts[card.instanceId] ?? 0) : 0}
                  selectedId={props.selectedId}
                  actingId={props.actingId}
                  onClick={props.onSlotClick}
                  onCycleAuto={props.onCycleAuto}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="banner" style={{ color: "var(--your-home-glow)" }}>
        ▼ Your Home
      </div>
    </div>
  );
}

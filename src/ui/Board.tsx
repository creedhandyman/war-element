import type { GameState, PlayerId, Pos } from "../engine";
import { cardAt, enemyOf, getSpell, isContested } from "../engine";
import { Slot } from "./Slot";
import { EL_COLOR } from "./shared";

export function Board(props: {
  game: GameState;
  legalSlots: Pos[]; // summon/move destinations
  legalTargetIds: string[]; // battle-phase target picks
  pickCounts: Record<string, number>; // hits assigned per target so far
  hasSelection: boolean;
  selectedId: string | null;
  actingId: string | null;
  grayTeam: PlayerId | null; // whose cards to gray out (the idle team on your turn)
  viewPlayer: PlayerId; // whose side you're looking from (the opponent is fogged)
  onSlotClick: (row: number, col: number) => void;
  onCycleAuto: (instanceId: string) => void;
}) {
  const { game } = props;
  const rows = [0, 1, 2, 3] as const;
  const opp = game.players[enemyOf(props.viewPlayer)];
  const oppName = (game.humans ?? ["P1"]).length > 1 ? enemyOf(props.viewPlayer) : "Opponent";
  return (
    <div className="board-area">
      {/* Fog of war: the opponent's hand is face-down; their deck is hidden. */}
      <div className="opp-fog">
        <div className="opp-fan" title={`${oppName}: ${opp.hand.length} cards in hand`}>
          {Array.from({ length: Math.min(opp.hand.length, 8) }).map((_, i) => (
            <span key={i} className="opp-back" style={{ ["--i" as string]: i - Math.min(opp.hand.length, 8) / 2 }} />
          ))}
        </div>
        <div className="opp-meta">
          <b>{oppName}</b> · {opp.hand.length} cards
          <span className="opp-hidden">deck hidden</span>
        </div>
        <div className="opp-res">
          <span className="opp-pip summon">◆ {opp.summonPool}</span>
          <span className="opp-pip magic">✦ {opp.magicPool}</span>
        </div>
      </div>
      <div className="banner opp" style={{ color: "var(--opp-home-glow)" }}>
        ▲ Opponent Home
      </div>
      <div className="board">
        {rows.map((row) => (
          <div className="brow" key={row}>
            {game.walls
              .filter((w) => w.row === row)
              .map((w) => {
                const spell = getSpell(w.spellId);
                const color = EL_COLOR[spell.element];
                const tip = `${spell.name} (${w.owner === "P1" ? "yours" : "enemy"}) — ${spell.text} · ${w.roundsLeft} round(s) left`;
                return (
                  <div key={w.owner + w.spellId} className="wallframe" style={{ color }}>
                    {/* Brackets framing the walled row for its duration. */}
                    <span className="wallbracket left" title={tip} />
                    <span className="wallbracket right" title={tip} />
                    <span
                      className={`wallmark ${w.owner === "P1" ? "mine" : "enemy"}`}
                      style={{ borderColor: color }}
                      title={tip}
                    >
                      {spell.name} · {w.roundsLeft}
                    </span>
                  </div>
                );
              })}
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
                  grayed={props.grayTeam !== null && card !== null && card.owner === props.grayTeam}
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
      <div className="banner your" style={{ color: "var(--your-home-glow)" }}>
        ▼ Your Home
      </div>
    </div>
  );
}

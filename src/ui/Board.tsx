import type { GameState, PlayerId, Pos } from "../engine";
import { cardAt, enemyOf, getSpell, isContested } from "../engine";
import { Slot } from "./Slot";
import { EL_COLOR } from "./shared";

export function Board(props: {
  game: GameState;
  legalSlots: Pos[]; // summon/move destinations (green)
  legalTargetIds: string[]; // battle-phase / spell target picks
  targetsAreEnemies: boolean; // true → target cards glow red (attack), false → green (ally)
  previewArea: Pos[]; // red on-summon damage-area preview for a staged summon
  stagedSlot: Pos | null; // the home slot a summon is staged into (awaiting confirm)
  pickCounts: Record<string, number>; // hits assigned per target so far
  hasSelection: boolean;
  selectedId: string | null;
  actingId: string | null;
  grayTeam: PlayerId | null; // whose cards to gray out (the idle team on your turn)
  viewPlayer: PlayerId; // whose side you're looking from (the opponent is fogged)
  onSlotClick: (row: number, col: number) => void;
  onSlotDragOver: (row: number, col: number) => void; // drag-to-summon: hover
  onSlotDrop: (row: number, col: number) => void; // drag-to-summon: drop
  onCycleAuto: (instanceId: string) => void;
}) {
  const { game } = props;
  // Render so the VIEWER's home is always at the bottom. P1 home is row 3
  // (already bottom); for P2 we flip the row order so their home (row 0) sits at
  // the bottom and the opponent's is up top. Clicks still carry the true row/col.
  const rows: number[] = props.viewPlayer === "P2" ? [3, 2, 1, 0] : [0, 1, 2, 3];
  const cols: number[] = [0, 1, 2, 3]; // columns stay left-to-right (vertical flip only)
  // Team colours are fixed per player: P1 = gold, P2 = blue. Crests are tinted by
  // team so the bottom (viewer's home) matches its tile colour on both sides.
  const homeGlow = props.viewPlayer === "P1" ? "var(--your-home-glow)" : "var(--opp-home-glow)";
  const foeGlow = props.viewPlayer === "P1" ? "var(--opp-home-glow)" : "var(--your-home-glow)";
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
      <div className="crest opp" style={{ ["--c" as string]: foeGlow }}>
        <span className="crest-bar" />
        <span className="crest-shield">✦</span>
        <span className="crest-text">Opponent Home</span>
        <span className="crest-shield">✦</span>
        <span className="crest-bar" />
      </div>
      <div className="board">
        {rows.map((row) => (
          <div className="brow" key={row} data-row={row}>
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
            {cols.map((col) => {
              const card = cardAt(game, row, col);
              const isLegalSlot = props.legalSlots.some((p) => p.row === row && p.col === col);
              const isTargetCard = card !== null && props.legalTargetIds.includes(card.instanceId);
              const redTarget = isTargetCard && props.targetsAreEnemies;
              const greenLegal = isLegalSlot || (isTargetCard && !props.targetsAreEnemies);
              const preview = props.previewArea.some((p) => p.row === row && p.col === col);
              const staged = props.stagedSlot != null && props.stagedSlot.row === row && props.stagedSlot.col === col;
              const dimmed =
                (props.hasSelection || props.legalTargetIds.length > 0 || props.previewArea.length > 0) &&
                !greenLegal && !redTarget && !preview && !staged;
              const contested =
                (row === 0 && isContested(game, "P2", col)) ||
                (row === 3 && isContested(game, "P1", col));
              return (
                <Slot
                  key={col}
                  game={game}
                  row={row}
                  col={col}
                  viewer={props.viewPlayer}
                  card={card}
                  legal={greenLegal}
                  isTarget={redTarget}
                  preview={preview}
                  staged={staged}
                  dimmed={dimmed}
                  grayed={props.grayTeam !== null && card !== null && card.owner === props.grayTeam}
                  contested={contested}
                  captured={game.slots[row][col].capturedBy}
                  canDrop={isLegalSlot}
                  pickCount={card ? (props.pickCounts[card.instanceId] ?? 0) : 0}
                  selectedId={props.selectedId}
                  actingId={props.actingId}
                  onClick={props.onSlotClick}
                  onDragOver={props.onSlotDragOver}
                  onDrop={props.onSlotDrop}
                  onCycleAuto={props.onCycleAuto}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="crest your" style={{ ["--c" as string]: homeGlow }}>
        <span className="crest-bar" />
        <span className="crest-shield">✦</span>
        <span className="crest-text">Your Home</span>
        <span className="crest-shield">✦</span>
        <span className="crest-bar" />
      </div>
    </div>
  );
}

import type { GameState, PlayerId, Pos } from "../engine";
import { cardAt, enemyOf, getSpell, homeRow, isContested } from "../engine";
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
  // Built from game.boardSize, not a literal [0,1,2,3], so a 5x5 match renders
  // without touching this file.
  const ascending = Array.from({ length: game.boardSize }, (_, i) => i);
  const rows: number[] = props.viewPlayer === "P2" ? [...ascending].reverse() : ascending;
  const cols: number[] = ascending; // columns stay left-to-right (vertical flip only)
  // Side colours are viewer-relative now (see Slot.tsx): your home row is blue
  // and the enemy's is red on both sides of a hot-seat game, so the crests no
  // longer swap by player — the bottom one is always "yours".
  const homeGlow = "var(--your-home-glow)";
  const foeGlow = "var(--opp-home-glow)";
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
        {/* Fields (Cost-6 terrain) — a board-wide haze in the element colour,
            framed like a wall. pointer-events:none so slots stay clickable. */}
        {game.fields.map((f) => {
          const spell = getSpell(f.spellId);
          const color = EL_COLOR[f.element];
          const tip = `${spell.name} (${f.owner === "P1" ? "yours" : "enemy"}) — ${spell.text} · ${f.roundsLeft} round(s) left`;
          return (
            <div
              key={f.owner + f.spellId}
              className={`fieldhaze ${f.owner === "P1" ? "mine" : "enemy"}`}
              style={{ ["--el" as string]: color }}
              title={tip}
            >
              <span className="fieldmark" style={{ borderColor: color, color }} title={tip}>
                {spell.name} · {f.roundsLeft}
              </span>
            </div>
          );
        })}
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
              // Traps are CONCEALED: the viewer sees only their own. Rendering
              // the opponent's — even faintly — would defeat the mechanic, so
              // this is gated on viewPlayer rather than on ownership alone.
              const myTrap = game.traps.find(
                (t) => t.owner === props.viewPlayer && t.pos.row === row && t.pos.col === col,
              );
              const isTargetCard = card !== null && props.legalTargetIds.includes(card.instanceId);
              const redTarget = isTargetCard && props.targetsAreEnemies;
              const greenLegal = isLegalSlot || (isTargetCard && !props.targetsAreEnemies);
              const preview = props.previewArea.some((p) => p.row === row && p.col === col);
              const staged = props.stagedSlot != null && props.stagedSlot.row === row && props.stagedSlot.col === col;
              const dimmed =
                (props.hasSelection || props.legalTargetIds.length > 0 || props.previewArea.length > 0) &&
                !greenLegal && !redTarget && !preview && !staged;
              const contested =
                (row === homeRow("P2", game.boardSize) && isContested(game, "P2", col)) ||
                (row === homeRow("P1", game.boardSize) && isContested(game, "P1", col));
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
                  trap={myTrap ?? null}
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

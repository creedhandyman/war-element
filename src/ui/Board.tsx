import type { BossTelegraph, FieldBuff, FieldState, GameState, PlayerId, Pos } from "../engine";
import { cardAt, enemyOf, getSpell, homeRow, isContested } from "../engine";
import { getDef } from "../data/cards";
import { Slot } from "./Slot";
import { EL_COLOR } from "./shared";

/** Plain-language summary of a live Field's numeric bonuses. Used for terrain,
 *  whose printed spell text describes a stronger thing than it is running. */
const BUFF_LABEL: [keyof FieldBuff, (n: number) => string][] = [
  ["regen", (n) => `REGEN ${n} each round`],
  ["shield", (n) => `+${n} shield`],
  ["sp", (n) => `+${n} SP`],
  ["dmgBonus", (n) => `+${n} DMG`],
  ["block", (n) => `BLOCK ${n}`],
  ["reflect", (n) => `REFLECT ${n}`],
  ["specialDiscount", (n) => `Specials cost ${n} less`],
  ["electrify", (n) => `+${n} Electrify DMG`],
  ["drainBonus", (n) => `+${n} DRAIN`],
  ["push", (n) => `+${n} knockback`],
];

function describeFieldBuff(f: FieldState): string {
  const parts = BUFF_LABEL
    .filter(([k]) => typeof f[k] === "number" && (f[k] as number) > 0)
    .map(([k, label]) => label(f[k] as number));
  return parts.length ? `${parts.join(", ")} for its own element.` : "No standing bonus.";
}

export function Board(props: {
  game: GameState;
  legalSlots: Pos[]; // summon/move destinations (green)
  legalTargetIds: string[]; // battle-phase / spell target picks
  targetsAreEnemies: boolean; // true → target cards glow red (attack), false → green (ally)
  previewArea: Pos[]; // red on-summon damage-area preview for a staged summon
  /** THE BOSS TELEGRAPH. `blast` is every square a boss Special will cover at
   *  the end of THIS round — the red zone. `telegraphs` carries the countdowns,
   *  one per boss, hung on the square the boss is standing on. Both are empty
   *  outside a Void Tower fight, so ordinary matches render exactly as before. */
  blast: Pos[];
  telegraphs: BossTelegraph[];
  stagedSlot: Pos | null; // the home slot a summon is staged into (awaiting confirm)
  pickCounts: Record<string, number>; // hits assigned per target so far
  hasSelection: boolean;
  movableIds: Set<string>; // your cards that can move this turn → a soft nudge ring
  selectedId: string | null;
  actingId: string | null;
  grayTeam: PlayerId | null; // whose cards to gray out (the idle team on your turn)
  viewPlayer: PlayerId; // whose side you're looking from (the opponent is fogged)
  /** Each seat's foils, keyed by owner. Cosmetic, UI-only. */
  foils?: { P1?: ReadonlySet<string>; P2?: ReadonlySet<string> };
  onSlotClick: (row: number, col: number) => void;
  onSlotDragOver: (row: number, col: number) => void; // drag-to-summon: hover
  onSlotDrop: (row: number, col: number) => void; // drag-to-summon: drop
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
  // Recon Ping: exposed for the round it was cast in, and no longer.
  const revealed = (opp.handRevealedUntilRound ?? -1) >= game.round;
  return (
    <div className="board-area">
      {/* Fog of war: the opponent's hand is face-down; their deck is hidden —
          unless RECON PING has exposed it for the round.

          This is the half of Recon Ping that never existed. The spell set
          `handRevealedUntilRound` and the card's own comment said "the UI reads
          it"; nothing did, anywhere in the app, so the reveal was writing a
          number no one looked at and the spell's headline effect did nothing at
          all. */}
      <div className="opp-fog">
        <div className="opp-fan" title={revealed
          ? `${oppName}: ${opp.hand.map((h) => getDef(h.defId).name).join(", ") || "empty"}`
          : `${oppName}: ${opp.hand.length} cards in hand`}>
          {opp.hand.slice(0, 8).map((h, i) => (
            revealed
              ? (
                <span
                  key={h.handId}
                  className="opp-back revealed"
                  title={getDef(h.defId).name}
                  style={{
                    ["--i" as string]: i - Math.min(opp.hand.length, 8) / 2,
                    backgroundImage: `url(/cards/${getDef(h.defId).art ?? getDef(h.defId).id}.webp)`,
                  }}
                />
              )
              : <span key={h.handId} className="opp-back" style={{ ["--i" as string]: i - Math.min(opp.hand.length, 8) / 2 }} />
          ))}
        </div>
        <div className="opp-meta">
          <b>{oppName}</b> · {opp.hand.length} cards
          <span className="opp-hidden">{revealed ? "HAND EXPOSED" : "deck hidden"}</span>
        </div>
        <div className="opp-res">
          <span className="opp-pip gold" title="Gold">◆ {opp.gold}</span>
          <span className="opp-pip magic" title="Magic">✦ {opp.magicPool}</span>
        </div>
      </div>
      <div className="crest opp" style={{ ["--c" as string]: foeGlow }}>
        <span className="crest-bar" />
        <span className="crest-shield">✦</span>
        <span className="crest-text">Opponent Home</span>
        <span className="crest-shield">✦</span>
        <span className="crest-bar" />
      </div>
      {/* `tight` = a board with more than four columns, where every tile is
          smaller and the tokens have to shed furniture to keep the stat row on
          one line. Keyed on the size, not on a literal 5, so a 6x6 inherits it. */}
      <div className={`board${game.boardSize > 4 ? " tight" : ""}`}>
        {/* Fields (Cost-6 terrain) — a board-wide haze in the element colour,
            framed like a wall. pointer-events:none so slots stay clickable. */}
        {/* Standing terrain is ONE battlefield even though it is stored as an
            entry per player — `fieldBonus` keys on the card's own owner, so both
            have to exist. Drawing it twice made the board read as two stacked
            fields, which it never was. Cast fields still show per side. */}
        {game.fields
          .filter((f, i) => !f.permanent || game.fields.findIndex((x) => x.permanent && x.spellId === f.spellId) === i)
          .map((f) => {
          const spell = getSpell(f.spellId);
          const color = EL_COLOR[f.element];
          // Standing terrain has no timer — showing roundsLeft would read as
          // "one round left" on something that runs the whole battle.
          // Terrain is a WEAKENED form of the spell, so quoting the spell's own
          // text would promise effects it does not have. Describe what is
          // actually running instead.
          const tip = f.permanent
            ? `${spell.name} — the region's terrain, all battle, both sides. ${describeFieldBuff(f)}` +
              ` (a weakened form — cast the spell for the full effect)`
            : `${spell.name} (${f.owner === "P1" ? "yours" : "enemy"}) — ${spell.text} · ${f.roundsLeft} round(s) left`;
          return (
            <div
              key={f.owner + f.spellId}
              className={`fieldhaze ${f.permanent ? "terrain" : f.owner === "P1" ? "mine" : "enemy"}`}
              data-el={f.element}
              title={tip}
            >
              <span className="fieldmark" style={{ borderColor: color, color }} title={tip}>
                {spell.name} · {f.permanent ? "∞" : f.roundsLeft}
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
              // THE BLAST ZONE STANDS DOWN WHILE YOU ARE AIMING. It is a
              // warning about the boss's turn, and the moment the player is
              // picking their OWN targets it stops being background information
              // and starts competing for the same tiles: a square can be both
              // "about to be hit" and "one I may hit", and two rings on one tile
              // is not two pieces of information, it is neither.
              //
              // Scoped to TARGET picking (`legalTargetIds`), not to any
              // selection — during a summon the zone is exactly what the player
              // is deciding against, so it stays lit for that.
              const aiming = props.legalTargetIds.length > 0;
              const blast = !aiming && props.blast.some((p) => p.row === row && p.col === col);
              const clock = props.telegraphs.find((t) => t.pos.row === row && t.pos.col === col) ?? null;
              const staged = props.stagedSlot != null && props.stagedSlot.row === row && props.stagedSlot.col === col;
              const dimmed =
                (props.hasSelection || props.legalTargetIds.length > 0 || props.previewArea.length > 0) &&
                // A square about to be hit stays LIT through a dim — while it
                // is shown at all. Fading the warning out the moment the player
                // picks up a card would fade it out exactly when they are
                // deciding where to put it. (While AIMING it is not shown, so
                // `blast` is already false and this term does nothing.)
                !greenLegal && !redTarget && !preview && !staged && !blast;
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
                  foils={props.foils}
                  card={card}
                  legal={greenLegal}
                  isTarget={redTarget}
                  preview={preview}
                  blast={blast}
                  clock={clock}
                  staged={staged}
                  dimmed={dimmed}
                  grayed={props.grayTeam !== null && card !== null && card.owner === props.grayTeam}
                  movable={card !== null && props.movableIds.has(card.instanceId)}
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

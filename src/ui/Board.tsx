import type { BossTelegraph, FieldBuff, FieldState, GameState, PlayerId, Pos } from "../engine";
import { cardAt, enemyOf, getSpell, homeRow, isContested } from "../engine";
import { getDef } from "../data/cards";
import { Slot } from "./Slot";
import { EL_COLOR } from "./shared";
import { dominationMap, isImpassable, isRoad, isShrine, isWell, poiAt, poiRing } from "../data/domination";

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


/** What a square IS on a Domination map — closed ground, a lane, a shrine, or
 *  part of a Point and who currently holds it. Undefined in every other match,
 *  which is what keeps the ordinary board's markup unchanged. */
function domTerrain(game: GameState, row: number, col: number) {
  const dom = game.domination;
  const map = dom && dominationMap(dom.mapId);
  if (!dom || !map) return undefined;
  const poi = poiAt(map, row, col);
  return {
    closed: isImpassable(map, row, col),
    road: isRoad(map, row, col),
    shrine: isShrine(map, row, col),
    well: isWell(map, row, col),
    poi: poi?.id,
    poiOwner: poi ? dom.held[poi.id] : null,
  };
}


/** DOMINATION's scoreboard, in place of the "Opponent Home" crest — that crest
 *  advertises a win condition this mode switches OFF, and the mode has no other
 *  way to show who is ahead. Four pips, one per Point, in the holder's colour
 *  and viewer-relative (yours is always the green one). Null in every other
 *  match, which leaves the crest exactly as it was. */
function domScore(game: GameState, viewer: PlayerId) {
  const dom = game.domination;
  const map = dom && dominationMap(dom.mapId);
  if (!dom || !map) return null;
  const mine = map.pois.filter((p) => dom.held[p.id] === viewer).length;
  const theirs = map.pois.filter((p) => dom.held[p.id] && dom.held[p.id] !== viewer).length;
  return (
    <div className="crest dom-score">
      <span className="crest-bar" />
      <span className="dom-tally you">{mine}</span>
      {map.pois.map((p) => {
        const who = dom.held[p.id];
        const cls = who === null ? "open" : who === viewer ? "you" : "foe";
        return (
          <span key={p.id} className={`dom-pip ${cls}`} title={`${p.name} — ${
            who === null ? "unclaimed" : who === viewer ? "yours" : "held against you"}`}>
            {p.id}
          </span>
        );
      })}
      <span className="dom-tally foe">{theirs}</span>
      <span className="crest-bar" />
    </div>
  );
}


/** A Point's letter, drawn on its CITADEL — the closed middle square, which is
 *  the one square in a Point that can never hold a token to cover it up. */
function poiLetterAt(game: GameState, row: number, col: number): string | undefined {
  const dom = game.domination;
  const map = dom && dominationMap(dom.mapId);
  if (!map) return undefined;
  const poi = map.pois.find((p) => p.centre.row === row && p.centre.col === col);
  return poi?.id;
}

/** How a square stands as an OBJECTIVE, viewer-relative.
 *
 *  One vocabulary for both kinds of board, because they are the same question
 *  asked twice: on a standard board the objectives are the two Home rows, and in
 *  Domination they are the Points. It replaces the red/blue row tinting, which
 *  coloured ground by WHOSE it was rather than by whether it had been taken —
 *  and on a board where taking ground is the win condition, the second is the
 *  thing worth seeing.
 *
 *      blue    nobody holds it
 *      green   you hold it
 *      red     they hold it
 *      orange  contested — both sides have a body on it
 *
 *  Red is not in the three colours that were asked for, but a scheme with no
 *  way to show a Point held AGAINST you cannot show you losing. */
function objectiveAt(
  game: GameState, viewer: PlayerId, row: number, col: number,
): "open" | "yours" | "theirs" | "contested" | undefined {
  const dom = game.domination;
  const map = dom && dominationMap(dom.mapId);
  if (dom && map) {
    const poi = poiAt(map, row, col);
    if (!poi) return undefined;
    // The citadel gets the state too, even though nothing can stand on it: its
    // LETTER is coloured by it, which is what makes the letter the score. The
    // ring itself is suppressed on closed ground in CSS.
    let mine = 0, theirs = 0;
    for (const sq of poiRing(poi)) {
      const occ = cardAt(game, sq.row, sq.col);
      if (!occ || occ.curHp <= 0) continue;
      if (occ.owner === viewer) mine++; else theirs++;
    }
    if (mine > 0 && theirs > 0) return "contested";
    const who = dom.held[poi.id];
    return who === null ? "open" : who === viewer ? "yours" : "theirs";
  }
  // DOMINATION ONLY (owner's call). The standard boards keep the colours they
  // have always had: their Home rows stay red and blue, their captured slots
  // keep the hazard stripes, and their contested slots keep the red pulse.
  // Those boards have ONE objective row per side and you already know which is
  // yours from its colour, so the highlight was answering a question that only
  // gets asked on a map with four Points spread across it.
  return undefined;
}

export function Board(props: {
  game: GameState;
  legalSlots: Pos[]; // summon/move destinations (green)
  legalTargetIds: string[]; // battle-phase / spell target picks
  targetsAreEnemies: boolean; // true → target cards glow red (attack), false → green (ally)
  previewArea: Pos[]; // red on-summon damage-area preview for a staged summon
  /** THE AIM. Every cell an armed area Special would cover, anchored on the
   *  player's current pick — drawn BEFORE they fire, which is the whole point.
   *  Gold, not the target red: an enemy inside the footprint keeps its red rim
   *  (still a legal anchor to re-aim onto) and gains the wash underneath. */
  aimArea: Pos[];
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
  foils?: Partial<Record<PlayerId, ReadonlySet<string>>>;
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
  // The two crests that used to sit above and below the board are gone; the
  // per-square objective highlight says what they said, and says it about the
  // squares that matter rather than about whole rows.
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
      {/* The red "Opponent Home" and blue "Your Home" crests are gone. They
          coloured the board's two ends by WHOSE they were, which the objective
          highlight now says better and per square — and in Domination they
          advertised a win condition the mode switches off entirely. What stands
          here in that mode is the scoreboard, because it is the one thing the
          board cannot show you by itself. */}
      {domScore(game, props.viewPlayer)}
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
              const aim = props.aimArea.some((p) => p.row === row && p.col === col);
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
                // ...and the aimed footprint stays lit too, empty squares
                // included: a dimmed cell inside the burst reads as "not hit".
                !greenLegal && !redTarget && !preview && !staged && !blast && !aim;
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
                  aim={aim}
                  blast={blast}
                  clock={clock}
                  staged={staged}
                  dimmed={dimmed}
                  grayed={props.grayTeam !== null && card !== null && card.owner === props.grayTeam}
                  movable={card !== null && props.movableIds.has(card.instanceId)}
                  contested={contested}
                  captured={game.slots[row][col].capturedBy}
                  terrain={domTerrain(game, row, col)}
                  objective={objectiveAt(game, props.viewPlayer, row, col)}
                  poiLetter={poiLetterAt(game, row, col)}
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
    </div>
  );
}

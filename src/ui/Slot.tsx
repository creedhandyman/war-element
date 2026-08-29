import type { BossTelegraph, CardInstance, GameState, PlayerId, TrapState } from "../engine";
import { enemyOf, getSpell, homeRow } from "../engine";
import { EL_COLOR } from "./shared";
import { Token } from "./Token";

export function Slot(props: {
  game: GameState;
  row: number;
  col: number;
  viewer: PlayerId; // the local player's side (threaded to Token for "mine")
  /** DOMINATION terrain for this square, or undefined on every other
   *  board. Derived from the map by the caller — a Slot should not have
   *  to know which mode it is in, only what it is standing on. */
  terrain?: {
    closed?: boolean;
    road?: boolean;
    shrine?: boolean;
    poi?: string;
    poiOwner?: PlayerId | null;
  };
  /** How this square stands as an OBJECTIVE, viewer-relative: unclaimed, held
   *  by you, held against you, or being fought over. Undefined on a square that
   *  is not an objective at all. */
  objective?: "open" | "yours" | "theirs" | "contested";
  /** A Point's letter, drawn on its citadel — the closed middle of the 3x3,
   *  which is the one square in a Point that can never hold a token to cover
   *  it. Domination only. */
  poiLetter?: string;
  /** Each SEAT's foils, keyed by owner. Was a single "the local player's" set
   *  tested against `owner === viewer`, which is the same thing offline and
   *  wrong online: the opponent's shinies are theirs to show, and yours have to
   *  keep shining when somebody else is looking at them. */
  foils?: Partial<Record<PlayerId, ReadonlySet<string>>>;
  card: CardInstance | null;
  legal: boolean;
  isTarget: boolean; // enemy attack/special target → red
  preview: boolean; // on-summon damage-area preview → red
  /** This square is inside a boss Special that lands at the end of this round. */
  blast: boolean;
  /** A boss stands here — its countdown badge hangs on this tile. */
  clock: BossTelegraph | null;
  staged: boolean; // the home slot a summon is staged into → green ring
  dimmed: boolean;
  grayed: boolean;
  movable: boolean; // your card that can move this turn → a soft nudge ring
  contested: boolean;
  captured: PlayerId | null;
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
    props.blast ? "blast" : "",
    props.staged ? "staged" : "",
    props.dimmed ? "dimmed" : "",
    props.grayed ? "grayed" : "",
    props.movable ? "movable" : "",
    props.contested ? "contested" : "",
    props.captured ? "captured" : "",
    props.trap ? "trapped" : "",
    // DOMINATION terrain. Absent on every ordinary board, so these add nothing
    // to the class list of a 4x4 slot.
    props.terrain?.closed ? "dom-closed" : "",
    props.terrain?.road ? "dom-road" : "",
    props.terrain?.shrine ? "dom-shrine" : "",
    props.terrain?.poi ? "dom-poi" : "",
    // ONE vocabulary for every objective square on every board — see `objective`
    // in Board.tsx. Replaces the red/blue "whose row is this" tinting, which
    // said who owned the ground rather than whether it had been taken.
    props.objective ? `obj obj-${props.objective}` : "",
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
      {props.poiLetter && <span className="poi-letter" aria-hidden="true">{props.poiLetter}</span>}
      {props.captured && (
        <span
          className="lock"
          title={
            `CAPTURED HOME SLOT — held by ${props.captured}.\n\n` +
            `An invader that survives a full round standing on an enemy Home slot ` +
            `captures it permanently. Captured slots are locked for the rest of the ` +
            `match: nothing can be summoned onto or moved through them, and they ` +
            `can never be taken back.\n\n` +
            `Capture ALL of an opponent's Home slots and you win outright.`
          }
        >
          🔒
        </span>
      )}
      {props.trap && (
        <span
          className="trapmark"
          style={{ color: EL_COLOR[props.trap.element] }}
          title={`${
            props.trap.spellId
              ? `${getSpell(props.trap.spellId).name} — ${getSpell(props.trap.spellId).text}`
              : props.trap.label ?? "Hidden trap"
          }\n\nOnly you can see this.`}
        >
          ◈
        </span>
      )}
      {props.movable && (
        <span className="move-badge" title="Can move this turn — tap to see where">
          ⤢
        </span>
      )}
      {/* THE BOSS CLOCK. A boss Special fires on a fixed beat and cannot be cast
          any other way, which makes it the one threat in the game a player can
          plan around perfectly — but only if they can see it. Before this the
          rhythm lived in the card data and nowhere else, so it had to be learned
          by losing to it and counting.

          NOW = it goes off at the end of the round being played, so this turn is
          the last one in which anything can walk out of the red. */}
      {props.clock && (() => {
        const c = props.clock;
        const now = c.roundsUntil === 0 && !c.silenced;
        const beats = `Fires every ${c.everyN} rounds.`;
        const where = c.cells.length === 0
          ? "Nothing on the board is in it."
          : c.strikes >= c.cells.length
            ? `Everything in the red — ${c.cells.length} card(s).`
            : `${c.strikes} of the ${c.cells.length} card(s) in the red.`;
        return (
          <span
            className={`boss-clock${now ? " now" : ""}${c.silenced ? " hushed" : ""}`}
            title={c.silenced
              ? `${c.specialName} — SILENCED. The beat is skipped: the status on this boss outlasts the tick that would clear it. ${beats}`
              : now
                ? `${c.specialName} lands at the END OF THIS ROUND.
${where}` +
                  (c.dmg > 0 ? `
${c.dmg} damage a hit.` : "") +
                  `

This is your last turn to move out of the red.`
                : `${c.specialName} in ${c.roundsUntil} round(s). ${beats}`}
          >
            {c.silenced ? "—" : now ? "NOW" : c.roundsUntil}
          </span>
        );
      })()}
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
          // Each side's own copies shine. A foil is something in a collection, and
          // the opponent's cards are not in it — online, theirs are unknowable.
          foil={!!props.foils?.[props.card.owner]?.has(props.card.defId)}
        />
      )}
    </div>
  );
}

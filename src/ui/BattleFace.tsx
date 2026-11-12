// THE BATTLE CARD'S FACE — art, cost gem, name, numbers.
//
// What a card looks like while you are PLAYING it: the face in your hand, and
// now the face a legendary arrives wearing (SummonAnnounce). It was the hand's
// own markup until the entrance needed it too, and a second copy of a card face
// is how a card comes to read differently in two places that are meant to be
// the same card.
//
// The LOOK lives in styles.css under `.hcard` / "the Edge face" and is sized by
// a container query on the element wrapping this — so the same markup is a
// 112px hand card and a 300px entrance without a second stylesheet.
//
// Deliberately NOT the board token (Token.tsx): that one is a live instance —
// current HP, statuses, auras, whose turn it is — and an entrance is the
// PRINTED card, before any of that is true of it.
import type { CardDef } from "../engine";
import { cardThumbSrc, EL_ICON } from "./shared";
import { EdgeName, EdgeRim } from "./EdgeFace";

export function BattleFace(props: {
  def: CardDef;
  /** What this card costs the player RIGHT NOW — discounted, in the hand. The
   *  printed cost when nobody is paying it (the entrance). */
  price?: number;
  /** How much was taken off that price, for the discounted treatment. */
  cut?: number;
  foil?: boolean;
}) {
  const { def } = props;
  const price = props.price ?? def.cost;
  const cut = props.cut ?? 0;
  const melee = def.attackType === "Melee";
  // The bar under the stats is the board token's: its width is HP plus shields,
  // so the grey head is the damage the plating soaks first.
  const shPct = (def.shields / Math.max(1, def.hp + def.shields)) * 100;
  return (
    <>
      <img
        className="card-art"
        src={cardThumbSrc(def)}
        alt=""
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
      <EdgeRim />
      {/* Cost and element are one mark. The RING carries affordability (gold vs
          red) — a gameplay signal, which is why it does not move onto the art. */}
      <div
        className={`hc-cost${cut > 0 ? " discounted" : ""}`}
        style={{ backgroundImage: `url(${EL_ICON[def.element]})` }}
        title={cut > 0 ? `${def.cost} − ${cut} (called up)` : undefined}
      >
        <b>{price}</b>
      </div>
      {props.foil && <i className="foil-tag" title="Foil">✦</i>}
      {/* The board token's language, so a card reads the same in the hand as on
          the board: colour says which number is which — red damage, green HP,
          blue speed — and shields are the grey head of the bar under them. */}
      <div className="hc-plate">
        <EdgeName name={def.name} className="hc-name" />
        <div className="hc-type">
          <span className={`hc-atk ${melee ? "melee" : "ranged"}`}>{melee ? "🗡" : "🏹"}</span>
          {def.cardClass}
          <span className="hc-atk-word"> · {def.attackType}</span>
        </div>
        <div className="hc-stats ef-stats">
          <span className="st-dmg" title={`Damage${def.hits > 1 ? ` ×${def.hits} hits` : ""}`}>
            {def.dmg}{def.hits > 1 && <span className="atk-x">×{def.hits}</span>}
          </span>
          <span className="st-hp" title={`HP${def.shields > 0 ? ` · ${def.shields} shield${def.shields > 1 ? "s" : ""}` : ""}`}>{def.hp}</span>
          <span className="st-sp" title="Speed">{def.sp}</span>
        </div>
        <div className="hc-bar" aria-hidden="true">
          {def.shields > 0 && <span className="hc-bar-sh" style={{ width: `${shPct}%` }} />}
          <span className="hc-bar-hp" />
        </div>
      </div>
      {/* The foil's sheen, last so it paints over the plate — moved by the
          compositor, not repainted (see .foil-sheen). */}
      {props.foil && <span className="hc-foil foil-sheen" aria-hidden="true" />}
    </>
  );
}

/** The expanded card — full art, stats, keywords, Special and passives.
 *
 *  Lifted out of DeckBuilder so the story Collection can show the same thing.
 *  Two screens rendering a card differently is how they drift: one of them ends
 *  up missing a keyword row or a Talent label, and the player has to guess which
 *  view is telling the truth.
 *
 *  The footer action and any extra body content are passed in, because that is
 *  the only part that genuinely differs — the builder adds to a custom deck, the
 *  Collection adds to the story deck and also says where the card drops.
 */
import type { ReactNode } from "react";
import type { CardDef } from "../engine";
import { EL_COLOR, EL_ICON, RARITY_STYLE } from "./shared";
import { chipify, describePassives } from "./CardDetail";
import { SpIcon } from "./icons";

export function CardExpand(props: {
  def: CardDef;
  onClose: () => void;
  /** Footer button. Omitted for a card the viewer can't act on. */
  action?: { label: string; disabled?: boolean; primary?: boolean; onClick: () => void };
  /** Extra body content, rendered below the passives. */
  extra?: ReactNode;
}) {
  const d = props.def;
  const tribes = Array.isArray(d.tribe) ? d.tribe : d.tribe ? [d.tribe] : [];

  return (
    <div className="overlay dbd-overlay" onClick={(e) => { e.stopPropagation(); props.onClose(); }}>
      <div className="modal dbd-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cd-x" title="Close" onClick={props.onClose}>✕</button>

        {/* Full, uncropped art. Collapses cleanly when a card has none yet —
            the info below still shows. */}
        <div className="dbd-art-full" style={{ borderColor: EL_COLOR[d.element] }}>
          <img
            src={`/cards/${d.art ?? d.id}.webp`}
            alt={d.name}
            onError={(e) => { const h = e.currentTarget.closest(".dbd-art-full"); if (h) (h as HTMLElement).style.display = "none"; }}
          />
          <span className="dbd-cost">{d.cost}</span>
          <span className="dbd-el-badge" title={d.element} style={{ borderColor: EL_COLOR[d.element] }}>
            <img src={EL_ICON[d.element]} alt={d.element} draggable={false}
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          </span>
        </div>

        <div className="dbd-head">
          <div className="dbd-meta">
            <div className="dbd-name">{d.name}</div>
            <div className="dbd-sub">
              <span className="dbd-el" style={{ background: EL_COLOR[d.element] }}>{d.element}</span>
              <span>{d.cardClass}</span>
              <span>{d.attackType === "Melee" ? "🗡 Melee" : "🏹 Ranged"}</span>
              {d.rarity && RARITY_STYLE[d.rarity] && (
                <span className="dbd-rar" style={{ color: RARITY_STYLE[d.rarity].color, borderColor: RARITY_STYLE[d.rarity].color }}>
                  {RARITY_STYLE[d.rarity].label}
                </span>
              )}
              {/* One chip per tribe — a card can carry several, and rendering the
                  raw array printed them run together. */}
              {tribes.map((t) => <span key={t} className="dbd-tribe">{t}</span>)}
            </div>
            <div className="dbd-stats">
              <span className="st-dmg">⚔ <span className="atk-dmg">{d.dmg}</span>{d.hits > 1 ? <span className="atk-x"> ×{d.hits}</span> : ""}</span>
              <span className="st-hp">♥ {d.hp}</span>
              <span className="st-sh">🛡 {d.shields}</span>
              <span className="st-sp"><SpIcon /> {d.sp}</span>
            </div>
            {Object.keys(d.keywords).length > 0 && (
              <div className="dbd-kws">
                {Object.entries(d.keywords).map(([k, v]) => (
                  <span key={k} className="dbd-kw">{v === true ? k : `${k} ${v}`}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {d.special && (
          <div className="dbd-sect">
            <div className="dbd-h">
              {d.special.talent ? "Talent" : "Special"} · {d.special.name}{" "}
              <span className="dbd-scost">{d.special.talent ? "1×" : `${d.special.cost}◆`}</span>
            </div>
            <p className="dbd-txt">{chipify(d.special.text)}</p>
          </div>
        )}

        <div className="dbd-sect">
          <div className="dbd-h">Passives</div>
          <ul className="dbd-passives">
            {describePassives(d).map((line, i) => <li key={i}>{chipify(line)}</li>)}
          </ul>
        </div>

        {props.extra}

        {props.action && (
          <button
            className={props.action.primary ? "lockin dbd-toggle" : "ghost dbd-toggle"}
            disabled={props.action.disabled}
            onClick={props.action.onClick}
          >
            {props.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

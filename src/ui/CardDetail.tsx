import type { CardInstance, GameState, StatusKind } from "../engine";
import { effectiveDmg, effectiveSp, getDef } from "../engine";
import { EL_COLOR } from "./shared";

// Plain-language blurb for each status kind, shown under a card's active effects.
const STATUS_TEXT: Record<StatusKind, string> = {
  ROOT: "Rooted — can't move.",
  BLEED: "Bleeding — takes damage each round.",
  BURN: "Burning — loses a shield (then HP) each round.",
  SCALD: "Scalded — takes damage each round.",
  DOT: "Damaged over time each round.",
  FREEZE: "Frozen — SP 0 and takes half damage dealt.",
  STUN: "Stunned — can't act.",
  WEAKEN: "Weakened — deals ~25% less damage.",
  PARALYZE: "Paralyzed — 50% chance to skip its action.",
  MUTED: "Muted — can't fire its Special.",
  SLEEP: "Asleep — can't act until it wakes.",
  FRIGHTEN: "Frightened — retreats and can't move forward.",
  BLIND: "Blinded — attacks have a 50% chance to miss.",
};

export function CardDetail(props: {
  game: GameState;
  card: CardInstance;
  canMove: boolean;
  onMove: () => void;
  onClose: () => void;
}) {
  const { game, card } = props;
  const def = getDef(card.defId);
  const mine = card.owner === "P1";
  const dmg = effectiveDmg(game, card);
  const sp = effectiveSp(game, card);
  const kws = Object.entries(def.keywords).map(([k, v]) =>
    v === true ? k : `${k} ${v}`,
  );

  // Passive one-liners derived from the card definition.
  const passives: string[] = [];
  if (def.onHitStatus)
    passives.push(
      `Basic hits apply ${def.onHitStatus.kind}${def.onHitStatus.power ? ` (${def.onHitStatus.power})` : ""} for ${def.onHitStatus.duration} round(s).`,
    );
  if (def.onSummon) passives.push("Fires an effect the moment it's summoned.");
  if (def.onDeath)
    passives.push(
      `On death, deals ${def.onDeath.dmg}${def.onDeath.pen ? " piercing" : ""} damage back to its killer.`,
    );
  if (def.statusImmune) passives.push("Immune to negative statuses.");
  if (def.ignoresHomeRule)
    passives.push("Can target the enemy Home row from anywhere.");
  if (def.special?.ranged)
    passives.push("Its Special reaches any slot on the board.");

  const specCd = card.specialCooldown > 0;
  const summonLock = card.summonedThisRound;

  return (
    <div className="overlay" onClick={props.onClose}>
      <div className="modal cd-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cd-x" title="Close" onClick={props.onClose}>
          ✕
        </button>

        <div className="cd-body">
          <div className="cd-art" style={{ borderColor: EL_COLOR[def.element] }}>
            <img
              src={`/cards/${def.id}.png`}
              alt=""
              onError={(e) => {
                (e.currentTarget.parentElement as HTMLElement).classList.add(
                  "no-art",
                );
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="cd-cost">{def.cost}</span>
          </div>

          <div className="cd-info">
            <div className="cd-name">{def.name}</div>
            <div className="cd-sub">
              <span
                className="cd-el"
                style={{ background: EL_COLOR[def.element] }}
              >
                {def.element}
              </span>
              <span>{def.cardClass}</span>
              <span>{def.attackType === "Melee" ? "🗡 Melee" : "🏹 Ranged"}</span>
              <span className={mine ? "cd-you" : "cd-opp"}>
                {mine ? "Yours" : "Opponent"}
              </span>
            </div>

            <div className="cd-stats">
              <div className="cd-stat" title="Live damage (printed value adjusted for Mid-row control & statuses)">
                <span className="cd-lbl">DMG</span>
                <span className="cd-val st-dmg">
                  ⚔{def.hits > 1 ? `${def.hits}× ` : ""}
                  {dmg}
                </span>
              </div>
              <div className="cd-stat" title="Current / max HP">
                <span className="cd-lbl">HP</span>
                <span className="cd-val st-hp">
                  ♥{card.curHp === card.maxHp ? card.curHp : `${card.curHp}/${card.maxHp}`}
                </span>
              </div>
              <div className="cd-stat" title="Shields">
                <span className="cd-lbl">SHIELD</span>
                <span className="cd-val st-sh">🛡{card.curShields}</span>
              </div>
              <div className="cd-stat" title="Speed — queue order & move reach">
                <span className="cd-lbl">SP</span>
                <span className="cd-val">👟{sp}</span>
              </div>
            </div>

            {kws.length > 0 && (
              <div className="cd-kws">
                {kws.map((k) => (
                  <span key={k} className="cd-kw">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {def.special && (
          <div className="cd-section">
            <div className="cd-h">
              ✦ {def.special.name}
              <span className="cd-cost-pill">Magic {def.special.cost}</span>
            </div>
            <p className="cd-text">{def.special.text}</p>
            {(specCd || summonLock) && (
              <div className="cd-flag">
                {summonLock
                  ? "Can't fire the round it's summoned."
                  : `Recharging — ready in ${card.specialCooldown} round(s).`}
              </div>
            )}
          </div>
        )}

        {passives.length > 0 && (
          <div className="cd-section">
            <div className="cd-h">Passives</div>
            <ul className="cd-list">
              {passives.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        {card.statuses.length > 0 && (
          <div className="cd-section">
            <div className="cd-h">Active effects</div>
            <ul className="cd-list">
              {card.statuses.map((s) => (
                <li key={s.kind}>
                  <b>{s.kind}</b> ({s.duration} round{s.duration === 1 ? "" : "s"}) —{" "}
                  {STATUS_TEXT[s.kind]}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="cd-actions">
          {props.canMove && (
            <button className="lockin" onClick={props.onMove}>
              Move this card
            </button>
          )}
          <button className="ghost" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

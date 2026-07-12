import type { CardInstance, GameState, PlayerId, StatusKind } from "../engine";
import { effectiveBasicHits, effectiveDmg, effectiveSp, ELEMENT_AURA, getDef } from "../engine";
import { EL_COLOR } from "./shared";
import { SpIcon } from "./icons";

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
  viewer: PlayerId;
  canMove: boolean;
  onMove: () => void;
  onClose: () => void;
}) {
  const { game, card } = props;
  const def = getDef(card.defId);
  const mine = card.owner === props.viewer;
  const dmg = effectiveDmg(game, card);
  const hits = effectiveBasicHits(card);
  const sp = effectiveSp(game, card);
  const kws = Object.entries(def.keywords).map(([k, v]) =>
    v === true ? k : `${k} ${v}`,
  );

  // Passive one-liners derived from the card definition. The element aura
  // (shared by every card of this element) leads the list.
  const aura = ELEMENT_AURA[def.element];
  const passives: string[] = [`${def.element} aura — ${aura.name}: ${aura.desc}`];
  if (def.onHitStatus) {
    const h = def.onHitStatus;
    const gate = h.chance != null ? `${h.chance}% chance to ` : h.firstHitOnly ? "first hit: " : h.onSecondHit ? "2nd hit: " : "";
    passives.push(
      `Basic hits ${gate}apply ${h.kind}${h.power ? ` (${h.power})` : ""} for ${h.duration} round(s).`,
    );
  }
  if (def.vsStatus) {
    const v = def.vsStatus;
    const parts = [
      v.lifesteal && "LIFESTEAL",
      v.crit && "CRIT",
      v.bonusDmg && `+${v.bonusDmg} DMG`,
      v.dmgMult && `×${v.dmgMult} DMG`,
      v.healOnHit && `heal ${v.healOnHit}`,
    ].filter(Boolean);
    passives.push(`Vs ${v.status} targets, basics gain ${parts.join(" · ")}.`);
  }
  if (def.onHitByMelee) {
    const m = def.onHitByMelee;
    const bits = [m.dmg && `${m.dmg} DMG`, m.status && m.status.kind].filter(Boolean).join(" + ");
    passives.push(`When hit by melee${m.chance ? ` (${m.chance}%)` : ""}: retaliate — ${bits}.`);
  }
  if (def.onKill) {
    const k = def.onKill;
    const bits = [
      k.buffDmg && `+${k.buffDmg} DMG`,
      k.buffDmgRound && `+${k.buffDmgRound} DMG (round)`,
      k.buffHits && `+${k.buffHits} hit`,
      k.buffSp && `+${k.buffSp} SP`,
      k.coinBonusDmg && `+${k.coinBonusDmg}/${k.coinBonusDmg - 1} DMG`,
      k.healSelf && `heal ${k.healSelf}`,
      k.gainShields && `+${k.gainShields} shields`,
      k.aoeDmg && `${k.aoeDmg} to all enemies`,
    ].filter(Boolean);
    passives.push(`On a kill: ${bits.join(" · ")}.`);
  }
  if (def.roundTick) {
    const t = def.roundTick;
    const bits = [
      t.aoeDmg && `${t.aoeDmg} DMG to all enemies`,
      t.aoeStatus && `${t.aoeStatus.kind} all enemies`,
      t.scaldFrozen && `SCALD frozen enemies`,
      t.lowestEnemyStatus && `${t.lowestEnemyStatus.kind} the lowest-HP enemy`,
      t.paralyzeOne && `PARALYZE an enemy`,
      (t.pokeDmg || t.pokeStatus) && `strike the closest enemy`,
      t.healAllies && `heal all allies ${t.healAllies}`,
      t.healLowestAlly && `heal the weakest ally ${t.healLowestAlly}`,
      t.buffDmgEveryN && `+${t.buffDmgEveryN.amount} DMG every ${t.buffDmgEveryN.n} rounds`,
    ].filter(Boolean);
    passives.push(`Each round: ${bits.join(" · ")}.`);
  }
  if (def.onRevive)
    passives.push(
      `Revives once when defeated at ${def.onRevive.heal} HP${def.onRevive.sleep ? `, then sleeps ${def.onRevive.sleep} round(s)` : ""}.`,
    );
  if (def.onLowHp) {
    const l = def.onLowHp;
    const bits = [l.dmg && `deal ${l.dmg}`, l.loseSp && `−${l.loseSp} SP`, l.loseSpecial && "loses its Special"].filter(Boolean);
    passives.push(`Below ${l.threshold} HP: ${bits.join(" · ")}.`);
  }
  if (def.onOppSummon) {
    const o = def.onOppSummon;
    const bits = [o.dmg && `${o.dmg} DMG`, o.status && o.status.kind].filter(Boolean).join(" + ");
    passives.push(`When an enemy is summoned, hits it with ${bits}.`);
  }
  if (def.firstStrikeBonus)
    passives.push(`+${def.firstStrikeBonus} DMG on the first strike against each opponent.`);
  if (def.ignoresSleepWake) passives.push("Its attacks don't wake SLEEPING targets.");
  if (def.basicBonus) {
    const b = def.basicBonus;
    const bits = [
      b.midLane && `+${b.midLane} in a mid row`,
      b.midLaneFull && `+${b.midLaneFull} if the mid lane is crowded`,
      b.vsSleeping && `+${b.vsSleeping} vs a SLEEPING target`,
    ].filter(Boolean);
    passives.push(`Basic attacks deal bonus damage (once): ${bits.join(" · ")}.`);
  }
  if (def.onSummon) passives.push("Fires an effect the moment it's summoned.");
  if (def.onDeath)
    passives.push(
      def.onDeath.rowAhead
        ? `On death, blasts the enemy row ahead for ${def.onDeath.dmg}${def.onDeath.pen ? " (PEN)" : ""}.`
        : `On death, deals ${def.onDeath.dmg}${def.onDeath.pen ? " piercing" : ""} damage back to its killer.`,
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
                  ⚔{hits > 1 ? `${hits}× ` : ""}
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
                <span className="cd-val"><SpIcon />{sp}</span>
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

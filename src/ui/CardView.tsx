/** One card panel, two jobs.
 *
 *  This replaces CardDetail (the in-match inspector) and CardExpand (the
 *  collection/deck-builder browser), which were two components rendering the
 *  same card and had already drifted: rarity and tribe existed only in browse,
 *  the shield stat had a labelled cell in one and a glyph in the other, and
 *  browse printed an empty <ul> where inspect hid the section. Two views of one
 *  thing is how a player ends up having to guess which one is telling the truth.
 *
 *  SIX ZONES, FIXED ORDER, so what you learn browsing you already know mid-match:
 *
 *      1  header    art, name, chips, stat grid, keywords
 *      2  mode      inspect: live state   |  browse: flavour
 *      3  rules     special
 *      3b rules     passives
 *      4  mode      inspect: auto + move  |  browse: extra + collection action
 *
 *  Zones 1, 3, 3b and the shell are written once and branch only on which
 *  numbers they are handed. That is what the view-model below is for: the two
 *  modes are reduced to one shape BEFORE rendering, so no zone ever reaches for
 *  `game`. It matters because half the engine calls this panel used to make are
 *  unsafe without a match — effectiveDmg walks the board for auras, cardMods
 *  calls auraSources, effectiveMaxHp sums over boardCards — and in browse mode
 *  there is no GameState, no CardInstance, and no board position to walk.
 *
 *  The props are a DISCRIMINATED UNION rather than one object with optional
 *  fields, for the same reason. With optionals, a stray `effectiveDmg(props.game!, …)`
 *  compiles and then crashes every collection screen; with the union it does
 *  not compile at all.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import type { AutoMode, CardDef, CardInstance, GameState, PlayerId } from "../engine";
import {
  effectiveBasicHits, effectiveDmg, effectiveMaxHp, effectiveSp, effectiveSpecialCost,
  getDef, getSpell,
} from "../engine";
import { EL_COLOR, EL_ICON, RARITY_STYLE, STATUS_STYLE, KEYWORD_STYLE} from "./shared";
import { cardMods, grantedKeywords } from "./Token";
import { SpIcon } from "./icons";
import { autoPrefFor, setAutoPref } from "./auto-prefs";
import { chipify, describeOwnPassives, describeSharedPassives, rounds, STATUS_TEXT, TALENT_LINE_PREFIX } from "./card-text";

export type CardViewProps =
  | {
      mode: "inspect";
      game: GameState;
      card: CardInstance;
      viewer: PlayerId;
      canMove: boolean;
      onMove: () => void;
      /** Set this card's auto mode. Absent for a card the viewer doesn't own. */
      onSetAuto?: (mode: AutoMode) => void;
      onClose: () => void;
    }
  | {
      mode: "browse";
      def: CardDef;
      onClose: () => void;
      /** Footer button. Omitted for a card the viewer can't act on. */
      action?: { label: string; disabled?: boolean; primary?: boolean; onClick: () => void };
      /** Extra body content, rendered below the passives. */
      extra?: ReactNode;
      /** This card is held in foil. Browse only — in a match the board and the
       *  hand already carry it, and `inspect` is about the live instance. */
      foil?: boolean;
    };

/** What the zones actually read. Both modes collapse to this before render. */
type ViewModel = {
  def: CardDef;
  /** Live in inspect, printed in browse — the zones do not know which. */
  stats: { dmg: number; hits: number; hp: number; hpMax: number; shields: number; sp: number };
  /** Whether hp/hpMax should print as a fraction. Printed cards are always whole. */
  wounded: boolean;
  specialCost: number;
  /** Ownership / rarity / tribe chips, already resolved per mode. */
  chips: ReactNode[];
  /** Short one-line notes under the special: talent spent, recharging, etc. */
  specialFlags: string[];
};

function inspectModel(game: GameState, card: CardInstance, viewer: PlayerId): ViewModel {
  const def = getDef(card.defId);
  const mine = card.owner === viewer;
  const hpMax = effectiveMaxHp(game, card);
  const flags: string[] = [];
  if (def.special?.talent && card.talentUsed) flags.push("Talent spent — once per game.");
  else if (def.special && !def.special.talent && card.summonedThisRound)
    flags.push("Can't fire the round it's summoned.");
  else if (def.special && !def.special.talent && card.specialCooldown > 0)
    flags.push(`Recharging — ready in ${rounds(card.specialCooldown)}.`);
  return {
    def,
    stats: {
      dmg: effectiveDmg(game, card),
      hits: effectiveBasicHits(card),
      hp: card.curHp,
      hpMax,
      shields: card.curShields,
      sp: effectiveSp(game, card),
    },
    wounded: card.curHp !== hpMax,
    specialCost: def.special ? effectiveSpecialCost(game, card, def.special.cost) : 0,
    chips: [
      <span key="own" className={mine ? "cd-you" : "cd-opp"}>{mine ? "Yours" : "Opponent"}</span>,
    ],
    specialFlags: flags,
  };
}

function browseModel(def: CardDef): ViewModel {
  const tribes = Array.isArray(def.tribe) ? def.tribe : def.tribe ? [def.tribe] : [];
  const rar = def.rarity ? RARITY_STYLE[def.rarity] : null;
  return {
    def,
    stats: { dmg: def.dmg, hits: def.hits, hp: def.hp, hpMax: def.hp, shields: def.shields, sp: def.sp },
    wounded: false,
    specialCost: def.special?.cost ?? 0,
    chips: [
      ...(rar
        ? [<span key="rar" className="dbd-rar" style={{ color: rar.color, borderColor: rar.color }}>{rar.label}</span>]
        : []),
      // One chip per tribe — a card can carry several, and rendering the raw
      // array printed them run together.
      ...tribes.map((t) => <span key={`t${t}`} className="dbd-tribe">{t}</span>),
    ],
    specialFlags: [],
  };
}

export function CardView(props: CardViewProps) {
  const vm = props.mode === "inspect"
    ? inspectModel(props.game, props.card, props.viewer)
    : browseModel(props.def);
  const d = vm.def;
  const kws = Object.entries(d.keywords).map(([k, v]) => (v === true ? k : `${k} ${v}`));
  // SHARED RULES ARE NAMED, NOT SPELLED OUT. A DUSK card spent four lines on
  // Midnight Shade — the same four lines every DUSK card carries — above the one
  // line saying what THIS card does, and the shared text crowded out the part
  // that differs. The name stays visible; the sentence is one tap away.
  const shared = describeSharedPassives(d);
  const auras = shared.filter((s) => s.kind === "aura");
  const kwText = new Map(shared.filter((s) => s.kind === "keyword").map((s) => [s.label, s.desc]));
  // The Talent gets its own section below, so it is filtered out of the passive
  // list rather than printed in both places.
  const passives = describeOwnPassives(d).filter((p) => !p.startsWith(TALENT_LINE_PREFIX));
  const [openRule, setOpenRule] = useState<string | null>(null);
  const toggleRule = (k: string) => setOpenRule((cur) => (cur === k ? null : k));

  // Buffs from standing in a friendly wall's row. Inspect-only: it needs the
  // board position and the live wall list.
  const wallBuffs: string[] = [];
  if (props.mode === "inspect") {
    const { game, card } = props;
    for (const w of game.walls) {
      if (!w.allyBuff || w.owner !== card.owner || w.element !== d.element) continue;
      if (!card.pos || card.pos.row !== w.row) continue;
      const parts = [
        w.allyBuff.block && `+${w.allyBuff.block} BLOCK`,
        w.allyBuff.evasion && "EVASION",
        w.allyBuff.dmgReduction && `−${w.allyBuff.dmgReduction} incoming DMG`,
      ].filter(Boolean);
      wallBuffs.push(`${getSpell(w.spellId).name}: ${parts.join(", ")}`);
    }
  }

  return (
    // The shell keeps CardExpand's stopPropagation: this panel opens from
    // inside other overlays (the deck builder, the collection) and a bare
    // onClose would close the parent underneath it too.
    <div className="overlay on-top cardview" onClick={(e) => { e.stopPropagation(); props.onClose(); }}>
      <div className="modal cd-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cd-x" title="Close" onClick={props.onClose}>✕</button>

        {/* ── zone 1 · header ─────────────────────────────────────────────── */}
        <div className="cd-body">
          <div className={`cd-art ${props.mode === "browse" && props.foil ? "foil" : ""}`}
            style={{ borderColor: EL_COLOR[d.element] }}>
            <img
              src={`/cards/${d.art ?? d.id}.webp`}
              alt=""
              onError={(e) => {
                (e.currentTarget.parentElement as HTMLElement).classList.add("no-art");
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="cd-cost">{d.cost}</span>
            <span className="cd-el-badge" style={{ borderColor: EL_COLOR[d.element] }}>
              <img src={EL_ICON[d.element]} alt={d.element}
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </span>
          </div>

          <div className="cd-info">
            <div className="cd-name">{d.name}</div>
            <div className="cd-sub">
              <span className="cd-el" style={{ background: EL_COLOR[d.element] }}>{d.element}</span>
              <span>{d.cardClass}</span>
              <span>{d.attackType === "Melee" ? "🗡 Melee" : "🏹 Ranged"}</span>
              {vm.chips}
            </div>

            {/* One stat grid for both modes. Browse used to print a flat inline
                row of the same four numbers; a labelled grid is better in both
                places, and rarity and tribe reaching the in-match panel for the
                first time is the other half of that. */}
            <div className="cd-stats">
              <div className="cd-stat" title="Damage — live value includes Mid-row control and statuses">
                <span className="cd-lbl">DMG</span>
                <span className="cd-val st-dmg">
                  ⚔<span className="atk-dmg">{vm.stats.dmg}</span>
                  {vm.stats.hits > 1 ? <span className="atk-x"> ×{vm.stats.hits}</span> : ""}
                </span>
              </div>
              <div className="cd-stat" title="Current / max HP">
                <span className="cd-lbl">HP</span>
                <span className="cd-val st-hp">
                  ♥{vm.wounded ? `${vm.stats.hp}/${vm.stats.hpMax}` : vm.stats.hp}
                </span>
              </div>
              <div className="cd-stat" title="Shields">
                <span className="cd-lbl">SHIELD</span>
                <span className="cd-val st-sh">🛡{vm.stats.shields}</span>
              </div>
              <div className="cd-stat" title="Speed — queue order & move reach">
                <span className="cd-lbl">SP</span>
                <span className="cd-val st-sp"><SpIcon />{vm.stats.sp}</span>
              </div>
            </div>

            {kws.length > 0 && (
              <div className="cd-kws">
                {kws.map((k) => (
                  // The chip was always the name; now it also holds the meaning.
                  // Only the keywords that HAVE a passive description become
                  // buttons — the rest stay plain chips rather than offering a
                  // tap that does nothing.
                  kwText.has(k) ? (
                    <button
                      key={k}
                      className={`cd-kw tappable ${openRule === k ? "on" : ""}`}
                      onClick={(e) => { e.stopPropagation(); toggleRule(k); }}
                    >{k}</button>
                  ) : <span key={k} className="cd-kw">{k}</span>
                ))}
              </div>
            )}
            {openRule && kwText.has(openRule) && (
              <p className="cd-rule-body">{chipify(kwText.get(openRule)!)}</p>
            )}

            {/* ── zone 2a · live state (inspect only) ─────────────────────── */}
            {props.mode === "inspect" && (() => {
              const mods = cardMods(props.game, props.card);
              const sts = props.card.statuses;
              // Granted keywords come from their own helper now, not from
              // mods.buffs — the panel would otherwise stop listing them.
              const granted = grantedKeywords(props.card);
              if (!mods.buffs.length && !mods.debuffs.length && !sts.length && !granted.length) return null;
              return (
                <div className="cd-mods">
                  <div className="cd-mods-lbl">Active modifiers</div>
                  {granted.map((g) => (
                    <div key={`g${g.kw}`} className="cd-mod buff">
                      ▲ {KEYWORD_STYLE[g.kw]?.glyph} {g.label}
                    </div>
                  ))}
                  {mods.buffs.map((b, i) => <div key={`b${i}`} className="cd-mod buff">▲ {b}</div>)}
                  {sts.map((s) => {
                    const negative = s.kind !== "STEALTH" && s.kind !== "EVASION";
                    return (
                      <div key={s.kind} className={`cd-mod ${negative ? "debuff" : "buff"}`}>
                        {negative ? "▼" : "▲"} {STATUS_STYLE[s.kind]?.glyph} {s.kind}{s.power ? ` ${s.power}` : ""}
                        {s.source ? ` from ${s.source}` : ""} — {s.duration}r
                      </div>
                    );
                  })}
                  {mods.debuffs.map((x, i) => <div key={`d${i}`} className="cd-mod debuff">▼ {x}</div>)}
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── zone 3 · special ────────────────────────────────────────────── */}
        {d.special && (
          <div className="cd-section">
            <div className="cd-h">
              {d.special.talent ? "★" : "✦"} {d.special.name}
              <span className="cd-cost-pill">
                {d.special.talent ? "Talent" : `Magic ${vm.specialCost}`}
              </span>
            </div>
            <p className="cd-text">{chipify(d.special.text)}</p>
            {vm.specialFlags.map((f) => <div key={f} className="cd-flag">{f}</div>)}
          </div>
        )}

        {/* ── zone 3a1 · talent ────────────────────────────────── */}
        {/* A Talent is an ABILITY, and it was the only one shown as a line of
            prose in the passive list while every Special got a header, a pill
            and its own block. Same treatment now, so a card's two abilities
            read alike — which is also how you notice a Talent exists at all. */}
        {d.talent && (
          <div className="cd-section">
            <div className="cd-h">
              ★ {d.talent.name}
              <span className="cd-cost-pill">Talent</span>
            </div>
            <p className="cd-text">{chipify(d.talent.text)}</p>
          </div>
        )}

        {/* ── zone 3a2 · the rules it shares with its whole element ───────── */}
        {auras.length > 0 && (
          <div className="cd-section">
            {auras.map((a) => (
              <div key={a.label}>
                <button
                  className={`cd-rule ${openRule === a.label ? "on" : ""}`}
                  onClick={(e) => { e.stopPropagation(); toggleRule(a.label); }}
                >
                  <span>{a.label}</span>
                  <span className="cd-rule-caret">{openRule === a.label ? "−" : "+"}</span>
                </button>
                {openRule === a.label && <p className="cd-rule-body">{chipify(a.desc)}</p>}
              </div>
            ))}
          </div>
        )}

        {/* ── zone 3b · passives ──────────────────────────────────────────── */}
        {passives.length > 0 && (
          <div className="cd-section">
            <div className="cd-h">What makes it different</div>
            <ul className="cd-list">
              {passives.map((p, i) => <li key={i}>{chipify(p)}</li>)}
            </ul>
          </div>
        )}

        {/* ── zone 2b · the rest of live state (inspect only) ─────────────── */}
        {props.mode === "inspect" && wallBuffs.length > 0 && (
          <div className="cd-section">
            <div className="cd-h">Wall cover</div>
            <ul className="cd-list">{wallBuffs.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}
        {props.mode === "inspect" && props.card.statuses.length > 0 && (
          <div className="cd-section">
            <div className="cd-h">Active effects</div>
            <ul className="cd-list">
              {props.card.statuses.map((s) => (
                <li key={s.kind}>
                  <b>{s.kind}</b> ({s.duration} round{s.duration === 1 ? "" : "s"}) — {STATUS_TEXT[s.kind]}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── zone 2c · flavour (browse only) ─────────────────────────────
            Lore is deliberately browse-only. This panel is also the in-match
            inspector, opened to answer "what will this do to me" mid-turn, and
            prose is in the way there. Rendered only when written — most of the
            pool has no lore yet, and an empty bordered block reads as a bug. */}
        {props.mode === "browse" && d.lore && (
          <p className="cd-lore" data-el={d.element}>{d.lore}</p>
        )}

        {/* ── zone 4 · actions ────────────────────────────────────────────── */}
        {props.mode === "inspect" ? (
          <>
            {props.card.owner === props.viewer && props.onSetAuto && (
              <AutoControl card={props.card} onSet={props.onSetAuto} />
            )}
            <div className="cd-actions">
              {props.canMove && (
                <button className="lockin" onClick={props.onMove}>Move this card</button>
              )}
              <button className="ghost" onClick={props.onClose}>Close</button>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

const AUTO_MODES: { mode: AutoMode; label: string; blurb: string }[] = [
  { mode: "manual", label: "Manual", blurb: "You choose its action every round." },
  { mode: "basic", label: "Auto", blurb: "It attacks on its own, but never spends magic." },
  { mode: "full", label: "Full", blurb: "It attacks and fires its Special when it can." },
];

/** Auto-attack settings for one card, in the card's own panel.
 *
 *  This used to be a badge on the board token that cycled manual → auto → full
 *  when tapped — a live setting on a 60px tile, in the same place you tap to
 *  select and to move. Here there is room to name the three modes and say what
 *  each one does.
 *
 *  "Always" is the part the badge could never offer: it writes the choice
 *  against the CARD rather than this one body, so every copy you summon from
 *  now on — this match and every match after — arrives already set.
 */
function AutoControl({ card, onSet }: { card: CardInstance; onSet: (m: AutoMode) => void }) {
  const defId = card.defId;
  const [remembered, setRemembered] = useState<AutoMode | undefined>(() => autoPrefFor(defId));
  const always = remembered === card.autoMode && remembered !== undefined;

  return (
    <div className="cd-auto">
      <div className="cd-seclabel">Auto attack</div>
      <div className="cd-automodes">
        {AUTO_MODES.map((m) => (
          <button
            key={m.mode}
            className={`cd-automode ${card.autoMode === m.mode ? "on" : ""}`}
            title={m.blurb}
            onClick={() => {
              onSet(m.mode);
              // Keep a standing "always" pointed at what you just picked, rather
              // than silently leaving it on the old mode.
              if (remembered !== undefined) { setAutoPref(defId, m.mode); setRemembered(m.mode); }
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="cd-autoblurb">{AUTO_MODES.find((m) => m.mode === card.autoMode)?.blurb}</p>
      <label className="cd-always">
        <input
          type="checkbox"
          checked={always}
          onChange={(e) => {
            const next = e.target.checked ? card.autoMode : undefined;
            setAutoPref(defId, next);
            setRemembered(next);
          }}
        />
        <span>
          Always for <b>{getDef(defId).name}</b>
          <em>every copy you summon from now on starts on this mode</em>
        </span>
      </label>
    </div>
  );
}

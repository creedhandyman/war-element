// The AQUA Flow Change menu.
//
// It used to be three grey buttons reading "+2 DMG / +3 shields / +4 SP" under
// a sentence — nothing about the card that had just landed, what each pick did
// to IT, or that the choice keeps paying out. Now it shows the card, each form
// as a before -> after on the stat it moves (numbers from the engine's
// `flowPreview`, never re-derived here), and when the tide will next deepen it.
//
// Three faces: the summon pick (permanent, the tide follows it), Downpour's
// re-pick (every AQUA card on the side, this round only), and — online, when
// the other seat is choosing — a wait with the same three forms shown.

import type { ReactNode } from "react";
import { CloudRain, Droplet, Snowflake, Waves, Wind } from "lucide-react";
import {
  AQUA_TIDE_EVERY,
  AQUA_TIDE_MAX,
  downpourKin,
  FLOW_MODES,
  flowPreview,
  getDef,
  LIQUID_HIT_BLURB,
  liquidGivesHit,
  nextTideRound,
} from "../engine";
import type { CardInstance, FlowMode, FlowPreview, GameState } from "../engine";
import { SpIcon } from "./icons";
import { cardThumbSrc, EL_COLOR } from "./shared";

const FORMS: FlowMode[] = ["water", "ice", "steam"];
const FORM_ICON: Record<FlowMode, ReactNode> = { water: <Droplet />, ice: <Snowflake />, steam: <Wind /> };
/** How many kin thumbnails the Downpour header draws before "+N". */
const KIN_SHOWN = 3;

/** The one stat a form moves, as the board would read it before and after. */
function Delta({ mode, pv }: { mode: FlowMode; pv: FlowPreview }) {
  const { before: b, after: a } = pv;
  if (mode === "water") {
    // A multi-hit card takes an extra HIT (liquidGivesHit), so the line shows
    // DMG x hits — otherwise "2 -> 2" would read as nothing happening.
    const line = (s: typeof b) => (a.hits > 1 || b.hits > 1 ? `${s.dmg}×${s.hits}` : `${s.dmg}`);
    return <Stat label="DMG" cls="st-dmg" from={line(b)} to={line(a)} />;
  }
  if (mode === "ice") return <Stat label="Shield" cls="st-sh" from={`${b.shields}`} to={`${a.shields}`} />;
  return <Stat label="SP" cls="st-sp" from={`${b.sp}`} to={`${a.sp}`} icon={<SpIcon />} />;
}

function Stat(props: { label: string; cls: string; from: string; to: string; icon?: ReactNode }) {
  return (
    <span className={`flow-delta ${props.cls}`}>
      <i>{props.label}</i>
      <span className="flow-delta-row">
        <s>{props.from}</s>
        <em aria-label="becomes">→</em>
        <b>{props.icon}{props.to}</b>
      </span>
    </span>
  );
}

export function FlowChangeModal(props: {
  game: GameState;
  /** The card holding the prompt (Downpour: the first of the kin). */
  card: CardInstance;
  /** False when the OTHER seat decides (online): a wait, no buttons. */
  mine: boolean;
  onPick: (mode: FlowMode) => void;
}) {
  const { game, card, mine } = props;
  const def = getDef(card.defId);
  const downpour = !!game.pendingFlowAll;
  const kin = downpour ? downpourKin(game, card) : [card];

  // Liquid's blurb per card: +1 hit on a 4+ hit card, +2 DMG on the rest. A
  // Downpour side can hold both kinds, and then says so.
  const each = downpour ? " each" : "";
  const hitters = kin.filter(liquidGivesHit).length;
  const liquid =
    hitters === 0 ? `${FLOW_MODES.water.blurb}${each}`
      : hitters === kin.length ? `${LIQUID_HIT_BLURB}${each}`
        : `${FLOW_MODES.water.blurb} each · ${LIQUID_HIT_BLURB} on multi-hit`;
  const blurb = (m: FlowMode) => (m === "water" ? liquid : `${FLOW_MODES[m].blurb}${each}`);

  const tideAt = nextTideRound(game);
  const tideWhen = tideAt === game.round ? "at the end of this round" : `at the end of round ${tideAt}`;

  const kinShown = kin.slice(0, KIN_SHOWN);
  const head = downpour ? (
    <div className="flow-kin" aria-hidden="true">
      {kinShown.map((c) => (
        <img key={c.instanceId} src={cardThumbSrc(getDef(c.defId))} alt="" draggable={false}
          style={{ borderColor: EL_COLOR[getDef(c.defId).element] }} />
      ))}
      {kin.length > KIN_SHOWN && <span className="flow-kin-more">+{kin.length - KIN_SHOWN}</span>}
    </div>
  ) : (
    <div className="flow-art" style={{ borderColor: EL_COLOR[def.element] }} aria-hidden="true">
      <img src={cardThumbSrc(def)} alt="" draggable={false} />
    </div>
  );

  const count =
    kin.length === 1 ? `your ${def.element} card`
      : kin.length === 2 ? `both your ${def.element} cards`
        : `all ${kin.length} of your ${def.element} cards`;
  const sub = downpour
    ? mine ? <>Pick this round's form for {count}.</> : <>Your opponent is picking their side's form…</>
    : mine ? <>Pick the form it keeps for good.</> : <>Your opponent is picking its form…</>;

  return (
    <div className="overlay">
      <div className={`modal flow-modal${mine ? "" : " flow-waiting"}`} role="dialog" aria-modal="true" aria-labelledby="flow-title">
        <header className="flow-head">
          {head}
          <div className="flow-title">
            <span className="flow-kicker">
              {downpour ? <CloudRain aria-hidden="true" /> : <Waves aria-hidden="true" />}
              {downpour ? "Downpour" : "Flow Change"}
            </span>
            <h1 id="flow-title">{downpour ? "Flow Change" : def.name}</h1>
            <p className="flow-sub">{sub}</p>
          </div>
        </header>

        {mine ? (
          <div className="flow-opts">
            {FORMS.map((mode) => (
              <button key={mode} type="button" className={`flow-opt flow-${mode}`} onClick={() => props.onPick(mode)}>
                <span className="flow-ic" aria-hidden="true">{FORM_ICON[mode]}</span>
                <span className="flow-body">
                  <span className="flow-label">{FLOW_MODES[mode].label}</span>
                  <span className="flow-effect">{blurb(mode)}</span>
                  {!downpour && (
                    <span className="flow-tide"><Waves aria-hidden="true" />{FLOW_MODES[mode].tide} each tide</span>
                  )}
                </span>
                {!downpour && <Delta mode={mode} pv={flowPreview(game, card, mode)} />}
              </button>
            ))}
          </div>
        ) : (
          <div className="flow-chips" aria-label="The three forms">
            {FORMS.map((mode) => (
              <span key={mode} className={`flow-chip flow-${mode}`}>
                <span className="flow-ic" aria-hidden="true">{FORM_ICON[mode]}</span>
                <b>{FLOW_MODES[mode].label}</b>
                <small>{blurb(mode)}</small>
              </span>
            ))}
          </div>
        )}

        {mine && <p className="flow-foot">
          {downpour ? (
            <>
              <CloudRain aria-hidden="true" />
              <span>This round only. The forms they took on summon, and their tides, stay as they are.</span>
            </>
          ) : (
            <>
              <Waves aria-hidden="true" />
              <span>
                <b>The tide:</b> every {AQUA_TIDE_EVERY} rounds the form deepens again, up
                to {AQUA_TIDE_MAX} times. The next one comes in {tideWhen}.
              </span>
            </>
          )}
        </p>}
      </div>
    </div>
  );
}

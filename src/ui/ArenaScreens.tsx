// The Arena's two levels, as components: the list of ways to play, the header
// every mode screen opens with, and the settings row that holds the choices a
// match rarely needs. The logic lives in `arena-nav.ts`; the match state lives
// in App, which hands each of these exactly what it draws.
import type { ReactNode } from "react";
import {
  ChevronLeft, ChevronRight, Flame, Grid3x3, Layers, Lock, SlidersHorizontal, Trophy, Users, Zap,
} from "lucide-react";
import { BOARD_LABEL, HUB_ENTRIES, hubBadge, type Board, type HubBadge, type HubEntryId, type HubStatus } from "./arena-nav";

const ICON: Record<HubEntryId, typeof Zap> = {
  quick: Zap, streak: Flame, gauntlet: Trophy, draft: Layers, domination: Grid3x3, friend: Users,
};

function BadgeChip({ b }: { b: HubBadge }) {
  if (b.tone === "cost" || b.tone === "lock") {
    return (
      <span
        className={`ah-badge ah-${b.tone}`}
        title={b.tone === "lock" ? `Needs ${b.amount} shards` : `Costs ${b.amount} shards`}
      >
        {b.tone === "lock" && <Lock size={11} aria-hidden="true" />}
        {b.amount}<i className="shard" aria-hidden="true" />
        <span className="sr-only">{b.tone === "lock" ? " shards needed" : " shards"}</span>
      </span>
    );
  }
  return <span className={`ah-badge ah-${b.tone}`}>{b.text}</span>;
}

/** THE FIRST LEVEL: every way to play, one row each, with the one fact that
 *  matters about it right now. Nothing is asked here — a row is a door. */
export function ArenaHub(props: {
  status: HubStatus;
  onPick: (id: HubEntryId) => void;
  onBuild: () => void;
  onRules: () => void;
}) {
  return (
    <div className="ah">
      <ul className="ah-list">
        {HUB_ENTRIES.map((e) => {
          const Icon = ICON[e.id];
          const badge = hubBadge(e.id, props.status);
          return (
            <li key={e.id}>
              <button className={`ah-card${e.id === "quick" ? " primary" : ""}`} onClick={() => props.onPick(e.id)}>
                <span className="ah-ico" aria-hidden="true"><Icon size={20} strokeWidth={2} /></span>
                <span className="ah-text">
                  <b className="ah-title">{e.title}</b>
                  <span className="ah-sub">{e.sub}</span>
                </span>
                {badge && <BadgeChip b={badge} />}
                <ChevronRight className="ah-chev" size={18} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {/* Here, not on every mode screen: building a squad and learning the
          rules happen BETWEEN fights, and a mode screen has one job. */}
      <div className="ar-ghosts ah-foot">
        <button className="ghost" onClick={props.onBuild}>Build a squad</button>
        <button className="ghost" onClick={props.onRules}>How to play</button>
      </div>
    </div>
  );
}

/** THE SECOND LEVEL'S HEADER: the way back, what this mode is, and one line on
 *  how it works — said once, at the top, instead of as a note under a row. */
export function ArenaHeader(props: { title: string; blurb: string; onBack: () => void }) {
  return (
    <div className="am-head">
      <button className="am-back" onClick={props.onBack}>
        <ChevronLeft size={16} aria-hidden="true" />
        <span>Arena</span>
      </button>
      <h2 className="am-title">{props.title}</h2>
      <p className="am-blurb">{props.blurb}</p>
    </div>
  );
}

export interface SettingsBoard {
  boards: readonly Board[];
  value: number;
  /** Why the battlefield cannot change right now (a run owns it, an event set
   *  it). When present only the current board is shown, so a board no longer
   *  on offer — a run begun on the 7x7 — still reads correctly. */
  locked?: string;
  onPick: (b: Board) => void;
}

export interface SettingsSkill {
  options: readonly { id: string; label: string }[];
  value: string;
  note: ReactNode;
  onPick: (id: string) => void;
}

/** THE THIRD LEVEL: the choices a match rarely needs, behind one summary line.
 *  Opens in place rather than as a sheet — nothing to stack over the nav and
 *  nothing for the back button to close — and says "Done" while it is open. */
export function ArenaSettings(props: {
  summary: string;
  open: boolean;
  onToggle: () => void;
  board?: SettingsBoard | null;
  skill?: SettingsSkill | null;
  /** When the opponent's skill is SET, not chosen (scored modes, events): what
   *  it is and why, read-only. */
  skillNote?: ReactNode;
}) {
  const { board, skill } = props;
  const boards = board ? (board.locked ? [board.value as Board] : board.boards) : [];
  return (
    <div className={`as${props.open ? " open" : ""}`}>
      <button className="as-row" onClick={props.onToggle} aria-expanded={props.open}>
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span className="as-sum">{props.summary}</span>
        <span className="as-act">{props.open ? "Done" : "Settings"}</span>
      </button>
      {props.open && (
        <div className="as-panel">
          {board && (
            <div className="as-field">
              <span className="ar-flabel">BATTLEFIELD</span>
              <div className="seg as-seg">
                {boards.map((b) => (
                  <button
                    key={b}
                    className={board.value === b ? "on" : ""}
                    disabled={!!board.locked}
                    onClick={() => board.onPick(b)}
                  >
                    <b>{BOARD_LABEL[b].size}</b>
                    <span>{BOARD_LABEL[b].name}</span>
                  </button>
                ))}
              </div>
              {board.locked && <p className="ar-mode-note">{board.locked}</p>}
            </div>
          )}
          {skill && (
            <div className="as-field">
              <span className="ar-flabel">AI SKILL</span>
              <div className="seg">
                {skill.options.map((o) => (
                  <button key={o.id} className={skill.value === o.id ? "on" : ""} onClick={() => skill.onPick(o.id)}>
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="ar-mode-note">{skill.note}</p>
            </div>
          )}
          {props.skillNote && (
            <div className="as-field">
              <span className="ar-flabel">AI SKILL</span>
              <p className="ar-mode-note">{props.skillNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

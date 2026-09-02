/** THE PROFILE: who you are, what you have done, and the head you wear.
 *
 *  One panel rather than three, because the three things are one idea — the
 *  name and the trophy are both "how you present", and the stats are the
 *  evidence behind them. Reached from the home row's avatar, which is the thing
 *  it edits.
 */
import { useState } from "react";
import { getDef } from "../data/cards";
import { VOID_BOSSES } from "../data/void-tower";
import {
  activeAvatar, avatarStyle, earnedAvatars, playerStats, type PlayerStat,
} from "../data/player";
import type { StorySave } from "../data/story";

/** A stat reads "34 / 381" only when there is a total to be a fraction of. */
function Stat({ s }: { s: PlayerStat }) {
  const pct = s.of ? Math.round((s.value / s.of) * 100) : null;
  return (
    <div className="pp-stat" title={s.hint}>
      <span className="pp-stat-l">{s.label}</span>
      <span className="pp-stat-v">
        {s.value}{s.of != null && <i> / {s.of}</i>}
      </span>
      {pct != null && (
        <span className="pp-bar"><i style={{ width: `${Math.min(100, pct)}%` }} /></span>
      )}
    </div>
  );
}

export function ProfilePanel(props: {
  save: StorySave;
  totalCards: number;
  totalNodes: number;
  onName: (name: string) => void;
  onAvatar: (cardId: string | undefined) => void;
  onClose: () => void;
}) {
  const { save } = props;
  const heads = earnedAvatars(save);
  const worn = activeAvatar(save);
  const stats = playerStats(save, { totalCards: props.totalCards, totalNodes: props.totalNodes });
  const [name, setName] = useState(save.hero?.name ?? "Keeper");

  /** Trimmed and bounded on the way out. An empty name would render the home row
   *  as a blank chip and a 200-character one would push the purses off it, and
   *  neither is something a player should be able to do by accident. */
  const commitName = () => {
    const clean = name.trim().slice(0, 18);
    if (clean && clean !== save.hero?.name) props.onName(clean);
    else setName(save.hero?.name ?? "Keeper");
  };

  return (
    <div className="overlay pp-wrap" onClick={props.onClose}>
      <div className="pp" onClick={(e) => e.stopPropagation()}>
        <div className="pp-head">
          <span
            className={`pp-me${worn ? " has-head" : ""}`}
            style={worn ? avatarStyle(worn) : undefined}
          >
            {worn ? "" : name.slice(0, 1).toUpperCase()}
          </span>
          <label className="pp-name">
            <span>NAME</span>
            <input
              value={name}
              maxLength={18}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              aria-label="Your name"
            />
          </label>
          <button className="pp-x" onClick={props.onClose} aria-label="Close">✕</button>
        </div>

        <div className="pp-sec">TROPHIES · {heads.length} of {VOID_BOSSES.length}</div>
        <div className="pp-grid">
          {/* No head: the initial, always available and always first. */}
          <button
            className={`pp-pick${worn ? "" : " on"}`}
            onClick={() => props.onAvatar(undefined)}
            title="Your initial"
          >
            <span className="pp-pick-art is-none">{name.slice(0, 1).toUpperCase()}</span>
            <b>None</b>
          </button>
          {VOID_BOSSES.map((b) => {
            const got = heads.includes(b.cardId);
            return (
              <button
                key={b.cardId}
                className={`pp-pick${worn === b.cardId ? " on" : ""}${got ? "" : " locked"}`}
                disabled={!got}
                onClick={() => props.onAvatar(b.cardId)}
                title={got
                  ? `${getDef(b.cardId).name} — Floor ${b.floor}`
                  : `Locked — beat ${getDef(b.cardId).name} on Floor ${b.floor}`}
              >
                <span className="pp-pick-art" style={got ? avatarStyle(b.cardId) : undefined}>
                  {got ? "" : "?"}
                </span>
                <b>{got ? getDef(b.cardId).name : "Locked"}</b>
              </button>
            );
          })}
        </div>

        <div className="pp-sec">ALL TIME</div>
        <div className="pp-stats">{stats.map((s) => <Stat key={s.label} s={s} />)}</div>
      </div>
    </div>
  );
}

/** Achievements — the screen off Home's tile (owner, 2026-09-28).
 *
 *  Everything on it is read from the save (achievements.ts): the bars are how
 *  far the save already is, so a veteran opens this to a column of Claim
 *  buttons for things done before it existed. That is intended. It pays for the
 *  past once, and from then on each one lands as it is earned.
 *
 *  Claimable rows sort to the top of their section, claimed ones sink: the
 *  question this screen answers first is "what do I collect", then "what is
 *  next", and a trophy you already hold is the least of it. */
import { useMemo } from "react";
import {
  ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, achievementState, pendingRewards,
  type Achievement, type AchievementState,
} from "../data/achievements";
import type { StorySave } from "../data/story";
import { RewardText } from "./AchievementToast";

/** Ready first, then in progress, then claimed. */
const rank = (st: AchievementState) => (st.done && !st.claimed ? 0 : st.claimed ? 2 : 1);

export function Achievements(props: {
  save: StorySave;
  onClaim: (id: string) => void;
  onClaimAll: () => void;
  onClose: () => void;
}) {
  const { save } = props;
  const rows = useMemo(() => ACHIEVEMENTS.map((a) => ({ a, st: achievementState(save, a) })), [save]);
  const earned = rows.filter((r) => r.st.done).length;
  const ready = rows.filter((r) => r.st.done && !r.st.claimed).length;
  const owed = useMemo(() => pendingRewards(save), [save]);

  return (
    <div className="story-wrap ach-wrap">
      <header className="story-head">
        <div>
          <div className="story-eyebrow">ACHIEVEMENTS{save.hero?.name ? ` · ${save.hero.name}` : ""}</div>
          <h2>{earned} of {ACHIEVEMENTS.length} earned</h2>
        </div>
        <div className="story-stats">
          {ready > 0
            ? <span className="ach-ready-n"><b>{ready}</b> to claim</span>
            : <span><b>{ACHIEVEMENTS.length - earned}</b> still to earn</span>}
        </div>
        <div className="story-actions">
          {ready > 0 && (
            <button className="lockin ach-all" onClick={props.onClaimAll}>
              Claim all <RewardText r={owed} />
            </button>
          )}
          <button className="ghost" onClick={props.onClose}>Back to Home</button>
        </div>
      </header>

      <div className="ach-body">
        {ACHIEVEMENT_CATEGORIES.map((c) => {
          const list = rows.filter((r) => r.a.category === c.id);
          const got = list.filter((r) => r.st.done).length;
          const sorted = [...list].sort((x, y) => rank(x.st) - rank(y.st));
          return (
            <section key={c.id} className="ach-sec">
              <div className="ach-sec-head">
                <span>{c.label.toUpperCase()}</span>
                <em>{got} of {list.length}</em>
              </div>
              {sorted.map(({ a, st }) => <AchRow key={a.id} a={a} st={st} onClaim={props.onClaim} />)}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AchRow({ a, st, onClaim }: { a: Achievement; st: AchievementState; onClaim: (id: string) => void }) {
  const ready = st.done && !st.claimed;
  return (
    <div className={`ach-row${ready ? " ready" : st.claimed ? " claimed" : ""}`}>
      <span className="ach-medal" aria-hidden="true">{st.claimed ? "✓" : ready ? "★" : ""}</span>
      <span className="ach-meta">
        <b>{a.title}</b>
        <em>{a.desc}</em>
        {/* A bar only where there is a distance to show: "0/1" says nothing
            the description has not. */}
        {!st.done && st.target > 1 && (
          <span className="ach-prog">
            <span className="ach-bar" aria-hidden="true"><i style={{ width: `${(st.have / st.target) * 100}%` }} /></span>
            <small>{st.have}/{st.target}</small>
          </span>
        )}
      </span>
      <span className="ach-side">
        <span className="ach-pay"><RewardText r={a.reward} /></span>
        {ready && <button className="ach-claim" onClick={() => onClaim(a.id)}>Claim</button>}
        {st.claimed && <span className="ach-got">Claimed</span>}
      </span>
    </div>
  );
}

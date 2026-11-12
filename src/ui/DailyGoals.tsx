/** TODAY'S GOALS, as Home's card: three rows with a bar each, a Claim button the
 *  moment one is finished, and an all-three bonus (data/goals.ts).
 *
 *  Sits under the daily reward and is quiet when there is nothing to collect: the
 *  login reward is a tap, this is a reason to play, so it shows how far along each
 *  goal is rather than asking for anything. The date is re-read when the app comes
 *  back to the front (a phone can sit in a pocket overnight), the same as
 *  `DailyReward`. */
import { useEffect, useState } from "react";
import { GOAL_BONUS, goalsToday } from "../data/goals";
import { localDay } from "../data/daily";
import type { StorySave } from "../data/story";

export function DailyGoals(props: { save: StorySave; onClaim: (id: string) => void }) {
  const [today, setToday] = useState(localDay);
  useEffect(() => {
    const check = () => { if (document.visibilityState !== "hidden") setToday(localDay()); };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  const st = goalsToday(props.save, today);
  const claimedCount = st.goals.filter((g) => g.claimed).length;
  const allDone = st.bonusOpen && st.bonusClaimed;
  const claim = (id: string) => props.onClaim(id);

  return (
    <section className={`home-goals${allDone ? " done" : ""}`}>
      <div className="home-goals-head">
        <b>TODAY'S GOALS</b>
        <em>{allDone ? "All done — back tomorrow" : `${claimedCount} of ${st.goals.length} collected`}</em>
      </div>
      <ul className="home-goals-list">
        {st.goals.map(({ goal, progress, done, claimed }) => (
          <li key={goal.id} className={`home-goal${done ? " done" : ""}${claimed ? " got" : ""}`}>
            <span className="home-goal-text">
              <span>{goal.text}</span>
              <span className="home-goal-bar" aria-hidden="true"><i style={{ width: `${(progress / goal.target) * 100}%` }} /></span>
            </span>
            <span className="home-goal-count">{progress}/{goal.target}</span>
            {claimed
              ? <span className="home-goal-got" aria-label="Collected">✓</span>
              : done
                ? <button className="home-goal-claim" onClick={() => claim(goal.id)}>+{goal.reward}<i className="shard" aria-hidden="true" /></button>
                : <span className="home-goal-pay">+{goal.reward}<i className="shard" aria-hidden="true" /></span>}
          </li>
        ))}
      </ul>
      {st.bonusOpen && !st.bonusClaimed && (
        <button className="home-goals-bonus" onClick={() => claim("bonus")}>
          All three done — collect the bonus +{GOAL_BONUS}<i className="shard" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

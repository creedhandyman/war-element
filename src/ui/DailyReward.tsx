/** The daily login reward, as Home's card (owner, 2026-09-28): the week as a
 *  strip of seven, today lit, one button.
 *
 *  It sits right under Continue because it is the thing on Home that DECAYS
 *  fastest — Home's order is by what decays — and a missed day costs the week.
 *
 *  THE DATE IS RE-READ when the app comes back to the front. An installed app
 *  can sit in the background overnight and resume without re-rendering, and a
 *  card still saying "come back tomorrow" on the morning it is due reads as a
 *  bug. */
import { useEffect, useState } from "react";
import { DAILY_REWARDS, dailyStatus, localDay } from "../data/daily";
import type { StorySave } from "../data/story";

export function DailyReward(props: { save: StorySave; onClaim: () => void }) {
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

  const st = dailyStatus(props.save, today);
  const reward = DAILY_REWARDS[st.day - 1];
  const next = st.day % DAILY_REWARDS.length + 1;
  const note = st.claimed
    ? `Back tomorrow for day ${next}`
    : st.reset ? "A missed day started the week over" : `Day ${st.day} of ${DAILY_REWARDS.length}`;

  return (
    <section className={`home-daily${st.claimed ? " done" : ""}`}>
      <div className="home-daily-head">
        <span className="home-daily-title">
          <b>DAILY REWARD</b>
          <em>{note}</em>
        </span>
        {st.claimed
          ? <span className="home-daily-got">✓ Claimed</span>
          : (
            <button className="home-daily-claim" onClick={props.onClaim}>
              Claim {reward.packs ? `${reward.packs} pack` : <>+{reward.shards}<i className="shard" aria-hidden="true" /><span className="sr-only"> shards</span></>}
            </button>
          )}
      </div>
      <ol className="home-daily-week">
        {DAILY_REWARDS.map((r, i) => {
          const day = i + 1;
          // Days behind today are taken — a week only runs on consecutive
          // days — and today is taken once the button has been pressed.
          const got = day < st.day || (st.claimed && day === st.day);
          const now = !st.claimed && day === st.day;
          return (
            <li key={day} className={`home-daily-day${got ? " got" : ""}${now ? " now" : ""}${r.packs ? " pack" : ""}`}>
              <small>D{day}</small>
              <b>{r.packs ? "PACK" : r.shards}</b>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

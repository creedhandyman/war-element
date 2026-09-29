/** "Achievement unlocked" — the moment one is earned, on whatever menu the
 *  player is on. Tapping it opens the Achievements screen, where it is claimed;
 *  left alone it goes after a few seconds and the Home tile keeps the count.
 *
 *  In the main bundle, so it is here rather than in Achievements.tsx: that
 *  screen is a lazy chunk, and the toast has to be ready the moment a fight
 *  pays out. `RewardText` lives here for the same reason — both use it. */
import { useEffect, useRef } from "react";
import { achievementById, type AchievementReward } from "../data/achievements";

/** "+30◆ · 1 pack", the way every achievement reward is written. */
export function RewardText({ r }: { r: AchievementReward }) {
  const shards = r.shards ?? 0;
  const packs = r.packs ?? 0;
  return (
    <>
      {shards > 0 && <span className="ach-shards">+{shards}<i className="shard" aria-hidden="true" /><span className="sr-only"> shards</span></span>}
      {shards > 0 && packs > 0 && " · "}
      {packs > 0 && <span className="ach-packs">{packs} pack{packs === 1 ? "" : "s"}</span>}
    </>
  );
}

/** How long a toast stays up untouched. */
const TOAST_MS = 5000;

export function AchievementToast(props: {
  /** Newly earned, oldest first. The first is named; the rest are counted. */
  ids: string[];
  onOpen: () => void;
  onDone: () => void;
}) {
  // A ref, so a parent re-rendering with a fresh callback cannot keep resetting
  // the timer and hold the toast up for ever.
  const done = useRef(props.onDone);
  done.current = props.onDone;
  const key = props.ids.join(",");
  useEffect(() => {
    const t = setTimeout(() => done.current(), TOAST_MS);
    return () => clearTimeout(t);
  }, [key]);

  const first = achievementById(props.ids[0]);
  if (!first) return null;
  const more = props.ids.length - 1;
  return (
    <button className="ach-toast" onClick={props.onOpen}>
      <span className="ach-medal" aria-hidden="true">★</span>
      <span className="ach-toast-text">
        <small>ACHIEVEMENT UNLOCKED{more > 0 ? ` · and ${more} more` : ""}</small>
        <b>{first.title}</b>
      </span>
      <span className="ach-toast-cta">
        <RewardText r={first.reward} />
        <em>Tap to claim</em>
      </span>
    </button>
  );
}

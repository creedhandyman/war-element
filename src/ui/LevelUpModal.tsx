/** LEVEL UP — one card, however many levels, and skipping still pays.
 *
 *  It is deliberately ONE screen for the whole span. A five-card pack can cross
 *  two or three levels at once, and three modals to dismiss is a worse reward
 *  than the shards inside them — so the header counts the span ("Level 12 → 15")
 *  and the rewards are totalled.
 *
 *  DUMB, like DraftScreen: the reward is priced by `levels.ts` and handed in,
 *  and the single button reports back. It does not read the save, pay anything,
 *  or decide when to appear. That keeps the money in one pure function that a
 *  test can run a hundred spans through.
 *
 *  BOTH BUTTONS PAY. "Skip" closes a message, not an envelope — a reward you
 *  have to sit through to receive is a toll, and `claimLevelUp` is what the
 *  parent calls either way.
 */

import { useEffect } from "react";
import type { LevelReward } from "../data/levels";
import { MILESTONE_EVERY, PACK_EVERY } from "../data/levels";
import { playLevelUp } from "./sfx";

export function LevelUpModal(props: {
  reward: LevelReward;
  /** Dismiss. The parent claims — see the note above about skipping. */
  onClose: () => void;
}) {
  const r = props.reward;
  const many = r.levels > 1;
  // ON MOUNT, which is the whole timing: the parent holds this modal back until
  // a pack has finished revealing, so mounting IS the moment the player is
  // being congratulated. Empty deps — a re-render for any other reason must not
  // chime again.
  useEffect(() => { playLevelUp(); }, []);
  return (
    <div className="overlay on-top" onClick={props.onClose}>
      {/* The backdrop dismisses too. This is a reward, not a decision, and a
          modal you can only leave by finding its button is a modal that gets in
          the way of the thing you were actually doing. */}
      <div className="modal lvl-up" onClick={(e) => e.stopPropagation()}>
        <div className="lvl-badge" aria-hidden="true">{r.to}</div>
        <h1>{many ? `${r.levels} levels up` : "Level up"}</h1>
        <p className="lvl-span">
          {many ? <>Level <b>{r.from}</b> → <b>{r.to}</b></> : <>You reached level <b>{r.to}</b></>}
        </p>

        <div className="lvl-rewards">
          {r.shards > 0 && (
            <div className="lvl-row">
              <span className="lvl-amt">+{r.shards}<i className="shard" aria-hidden="true" /></span>
              <span className="lvl-why">
                {r.levels} level{many ? "s" : ""}
                {r.milestones.length > 0 && (
                  <>
                    {" · "}
                    {r.milestones.length} milestone{r.milestones.length > 1 ? "s" : ""}
                    {" ("}
                    {r.milestones.join(", ")}
                    {")"}
                  </>
                )}
              </span>
            </div>
          )}
          {r.packs > 0 && (
            <div className="lvl-row big">
              <span className="lvl-amt">
                +{r.packs} free pack{r.packs > 1 ? "s" : ""}
              </span>
              <span className="lvl-why">
                every {PACK_EVERY} levels · {r.packLevels.join(", ")}
              </span>
            </div>
          )}
        </div>

        {/* What the NEXT one is worth, so the number on the home screen means
            something before you get there. */}
        <p className="lvl-next">
          Every level pays shards · every {MILESTONE_EVERY} pays a bonus · every {PACK_EVERY} a free pack
        </p>

        <button className="bb" onClick={props.onClose}>Collect</button>
      </div>
    </div>
  );
}

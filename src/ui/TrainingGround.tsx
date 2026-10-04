/** The Training Ground — the screen off Home's tile (owner, 2026-10-02).
 *
 *  A list of lessons (training.ts), each a short fight with the decks chosen
 *  for it. Any order: they are numbered as a suggested path, not locked behind
 *  one another, because a player who already knows statuses should not have to
 *  sit through them to reach trample. */
import { getDef } from "../engine";
import type { StorySave } from "../data/story";
import { RewardText } from "./AchievementToast";
import { cardArtSrc } from "./shared";
import { GRADUATION_PACKS, LESSONS, LESSON_SHARDS, lessonDone, type Lesson } from "./training";
import { TUT_DONE, TUTORIAL_YOU } from "./tutorial";

export function TrainingGround(props: {
  save: StorySave;
  onStart: (lesson: Lesson) => void;
  /** Replay the step-by-step first battle (ui/tutorial.ts). */
  onBasics: () => void;
  onClose: () => void;
}) {
  const { save } = props;
  const basicsDone = (save.taught ?? []).includes(TUT_DONE);
  const done = LESSONS.filter((l) => lessonDone(save, l.id)).length;
  const all = done === LESSONS.length;
  return (
    <div className="story-wrap">
      <header className="story-head">
        <div>
          <div className="story-eyebrow">TRAINING GROUND</div>
          <h2>{done} of {LESSONS.length} lessons won</h2>
        </div>
        <div className="story-stats">
          {all
            ? <span>Every lesson won</span>
            : <span>Win them all: <b className="ach-packs">{GRADUATION_PACKS} free pack{GRADUATION_PACKS === 1 ? "" : "s"}</b></span>}
        </div>
        <div className="story-actions">
          <button className="ghost" onClick={props.onClose}>Back to Home</button>
        </div>
      </header>

      <div className="ach-body">
        <p className="trn-lead">
          Short fights with decks built to show one idea each. The coach explains every mechanic the moment it
          happens on the board. Lose as often as you like; the first win of each lesson pays.
        </p>
        <div className="trn-group">Basics</div>
        <div className={`ach-row trn-row${basicsDone ? " won" : ""}`}>
          <span className="ach-medal" aria-hidden="true">{basicsDone ? "✓" : "★"}</span>
          <span className="ach-meta">
            <b>Your first battle</b>
            <em>Every move, one tap at a time: place a card, move, attack, buy a card with Gold, and capture.</em>
            <span className="trn-cards" aria-hidden="true">
              {TUTORIAL_YOU.map((id) => (
                <img key={id} src={cardArtSrc(getDef(id))} alt="" loading="lazy" draggable={false}
                  onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
              ))}
              <small>vs Grills</small>
            </span>
          </span>
          <span className="ach-side">
            {basicsDone && <span className="ach-got">Done</span>}
            <button className="ach-claim" onClick={props.onBasics}>{basicsDone ? "Again" : "Start"}</button>
          </span>
        </div>
        <div className="trn-group">Lessons</div>
        {LESSONS.map((l, i) => {
          const won = lessonDone(save, l.id);
          return (
            <div key={l.id} className={`ach-row trn-row${won ? " won" : ""}`}>
              <span className="ach-medal" aria-hidden="true">{won ? "✓" : i + 1}</span>
              <span className="ach-meta">
                <b>{l.title}</b>
                <em>{l.blurb}</em>
                <span className="trn-cards" aria-hidden="true">
                  {l.youFirst.map((id) => (
                    <img key={id} src={cardArtSrc(getDef(id))} alt="" loading="lazy" draggable={false}
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  ))}
                  <small>vs {l.foeName}</small>
                </span>
              </span>
              <span className="ach-side">
                {won
                  ? <span className="ach-got">Won</span>
                  : <span className="ach-pay"><RewardText r={{ shards: LESSON_SHARDS }} /></span>}
                <button className="ach-claim" onClick={() => props.onStart(l)}>{won ? "Again" : "Start"}</button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The Training Ground's coach: a floating card (`.tut-coach`, docked by
// coach-dock.ts), fed by a lesson.
//
// Each tip in a lesson names the board state it is about (`LessonTip.when`).
// The first time that state appears, the tip joins a queue for the rest of the
// fight, and the card shows the oldest unread one — so a BURN that lands and
// burns out between two looks is still explained, and two things happening at
// once are explained one at a time. Nothing persists: a refight teaches again.
import { useEffect, useState } from "react";
import { TEACHER_ART, TEACHER_NAME } from "./shared";
import { useCoachDock } from "./coach-dock";
import type { GameState } from "../engine";
import type { Lesson } from "./training";

export function LessonCoach(props: { game: GameState; lesson: Lesson }) {
  const { game, lesson } = props;
  /** Tip ids whose moment has come, oldest first. */
  const [fired, setFired] = useState<string[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [bottom, setBottom] = useState(false);

  useEffect(() => {
    const fresh = lesson.tips.filter((t) => !fired.includes(t.id) && t.when(game)).map((t) => t.id);
    if (fresh.length) setFired((f) => [...f, ...fresh.filter((id) => !f.includes(id))]);
  }, [game, lesson, fired]);

  const tip = lesson.tips.find((t) => t.id === fired.find((id) => !read.includes(id)));
  const { bottomGap, topGap } = useCoachDock([tip?.id, game.phase, game.battle?.awaitingInput, bottom]);

  if (!tip || game.phase === "mulligan" || game.phase === "gameover") return null;
  const place = bottom ? "bottom" : "top";
  const pending = fired.filter((id) => !read.includes(id)).length;
  return (
    <div
      className={`tut-coach tut-${place} lesson-coach`}
      role="note"
      style={place === "bottom"
        ? (bottomGap > 0 ? { bottom: bottomGap } : undefined)
        : (topGap > 0 ? { top: topGap } : undefined)}
    >
      <div className="tut-head">
        <img className="tut-face" src={TEACHER_ART} alt="" draggable={false}
          onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <span className="tut-step">
          {TEACHER_NAME} · {lesson.title}{pending > 1 ? ` · ${pending - 1} more` : ""}
        </span>
        <button
          className="tut-move"
          onClick={() => setBottom((b) => !b)}
          aria-label={bottom ? "Move this to the top" : "Move this to the bottom"}
          title="Move this out of the way"
        >
          {bottom ? "↑" : "↓"}
        </button>
      </div>
      <div className="tut-title">{tip.title}</div>
      <p className="tut-body">{tip.body}</p>
      <button className="tut-ok" onClick={() => setRead((r) => [...r, tip.id])}>Got it</button>
    </div>
  );
}

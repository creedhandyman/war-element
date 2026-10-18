/** THE MOMENT YOU WIN (OR DON'T).
 *
 *  The result screens were text on a dark card: the biggest beat of every match
 *  arrived as a paragraph. This is the beat itself — a burst of confetti behind
 *  the card, the fanfare, a buzz in the hand. A loss gets none of it:
 *  no confetti, no sound, no scolding.
 *
 *  Mounted INSIDE the `.overlay` (beside the modal, not in it): the modal
 *  scrolls, and a burst drawn in it would be clipped by its own edges.
 *  Everything is transform + opacity and plays once, so it costs the compositor
 *  nothing after the first second; reduced motion drops the confetti but keeps
 *  the sound, which is not motion. */
import { useEffect } from "react";
import { buzz, playSfx } from "./sfx";

/** Deterministic pieces: the same burst every time, no Math.random in render. */
const PIECES = Array.from({ length: 30 }, (_, i) => {
  const a = (i / 30) * Math.PI * 2 + (i % 3) * 0.21;
  const reach = 110 + ((i * 53) % 150);
  return {
    dx: Math.round(Math.cos(a) * reach * 1.15),
    dy: Math.round(Math.sin(a) * reach * 0.8 - 70),
    rot: ((i * 97) % 540) - 270,
    delay: ((i * 29) % 160) / 1000,
    c: i % 6,
    long: i % 4 === 0,
  };
});

export function Celebration(props: { kind: "win" | "lose" | "none" }) {
  const { kind } = props;
  useEffect(() => {
    if (kind === "win") { playSfx("win"); buzz([40, 50, 90]); }
  }, [kind]);

  if (kind !== "win") return null;
  return (
    <div className="confetti" aria-hidden="true">
      {PIECES.map((p, i) => (
        <i
          key={i}
          className={`cf c${p.c}${p.long ? " long" : ""}`}
          style={{ "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.rot}deg`, "--delay": `${p.delay}s` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

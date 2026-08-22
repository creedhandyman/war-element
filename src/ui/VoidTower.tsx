/** The Void Tower — floors of boss puzzles, climbed from the ground up.
 *
 *  THE ART IS THE SCREEN. A boss is a face you are meant to recognise across
 *  the room and remember losing to; a 46px thumbnail beside a text row made
 *  seven of them look like a settings list. Each boss is now a portrait tile
 *  with its name and puzzle written over the bottom of the art, and the TILE is
 *  the fight button — there is nothing else on it to press, so a separate
 *  control was only ever a smaller target.
 *
 *  RENDERED TOP-DOWN: the highest floor sits at the top of the screen because
 *  the thing is a TOWER, and scrolling up toward what you have not earned yet
 *  is the shape of the promise. The ground floor — the only open one on a
 *  fresh save — is therefore at the bottom, where the screen opens scrolled.
 *
 *  All progression is DERIVED from StorySave.eventsDone (see void-tower.ts):
 *  a boss is down when its trial event has been completed, a floor clears when
 *  every boss on it is down, and a floor opens when everything below it is
 *  clear. This screen owns no state but a scroll position — beating a boss
 *  from here writes exactly what beating it from anywhere writes, and the
 *  tower cannot disagree with the save.
 *
 *  Fights start the way event fights start: the parent seats the trial's deck
 *  and drops the player in the Arena to pick their OWN deck. Not auto-started,
 *  for the same reason events aren't — a boss puzzle fought with whatever deck
 *  happened to be selected is a coin toss wearing a puzzle's name.
 *
 *  NOT HERE YET, deliberately: runs, run-loss stakes, and rewards beyond the
 *  trials' first-clear pack. The mode-rules doc that defines them was never
 *  written; the floor ladder is the half the boss doc does specify.
 */
import { Check, Lock, Swords } from "lucide-react";
import type { StorySave } from "../data/story";
import { EVENTS, type GameEvent } from "../data/events";
import { getDef } from "../data/cards";
import {
  bodyCap, bossDefeated, bossesOnFloor, floorCleared, floorOpen,
  summonBudget, towerProgress, trialEventId, voidFloors,
} from "../data/void-tower";

const EL_TINT: Record<string, string> = {
  LEAF: "#7fd89a", PYRO: "#ff8a5c", AQUA: "#7fc4e8", BORE: "#c9a06a",
  GALE: "#b9e0d0", DAWN: "#ffd763", BOLT: "#ffe066", DUSK: "#b39ddb",
};

export function VoidTower(props: {
  save: StorySave;
  /** Seat this boss's trial and take the player to the Arena — the exact
   *  handler Home's event cards use, threaded through so the two entry points
   *  cannot drift. */
  onFight: (event: GameEvent) => void;
}) {
  const done = props.save.eventsDone ?? [];
  const floors = voidFloors();
  const progress = towerProgress(done);
  // Top-down: highest first.
  const descending = [...floors].reverse();

  return (
    <div className="vt-screen">
      <header className="vt-head">
        <h1>VOID TOWER</h1>
        <span className="vt-progress">
          {progress.defeated} / {progress.total} bosses defeated
        </span>
      </header>

      <div className="vt-floors">
        {descending.map((floor) => {
          const open = floorOpen(done, floor);
          const cleared = floorCleared(done, floor);
          const below = floors.filter((f) => f < floor).pop();
          return (
            <section key={floor} className={`vt-floor ${open ? "" : "locked"} ${cleared ? "cleared" : ""}`}>
              <div className="vt-floor-head">
                <span className="vt-floor-name">
                  {open ? null : <Lock size={14} aria-hidden="true" />}
                  FLOOR {floor}
                </span>
                <span className="vt-floor-sub">
                  {cleared
                    ? "CLEARED"
                    : open
                      ? `body cap ${bodyCap(floor)} · summon budget ${summonBudget(floor)}`
                      : `clear Floor ${below} to ascend`}
                </span>
              </div>
              <div className="vt-bosses">
                {bossesOnFloor(floor).map((b) => {
                  const def = getDef(b.cardId);
                  const down = bossDefeated(done, b.cardId);
                  const event = EVENTS.find((e) => e.id === trialEventId(b.cardId));
                  const tint = EL_TINT[b.tribeElement] ?? "#8b7dc9";
                  const playable = open && !!event;
                  return (
                    <button
                      key={b.cardId}
                      type="button"
                      className={`vt-boss ${down ? "down" : ""} ${playable ? "" : "locked"}`}
                      style={{ ["--tint" as string]: tint }}
                      disabled={!playable}
                      onClick={playable ? () => props.onFight(event!) : undefined}
                      aria-label={
                        playable
                          ? `${down ? "Refight" : "Fight"} ${def.name} — ${b.puzzle}`
                          : `${def.name}, locked`
                      }
                    >
                      <img
                        className="vt-boss-art"
                        src={`/cards/${def.art ?? def.id}.webp`}
                        alt=""
                        loading="lazy"
                      />
                      {/* Over the art, bottom-anchored, on its own scrim. The
                          scrim only reaches full opacity across the bottom
                          fifth of the tile and fades out above that, so the
                          face stays readable even on the narrow phone tiles
                          where the text block is half the tile tall. */}
                      <span className="vt-boss-body">
                        <span className="vt-boss-pair">
                          {b.tribeElement} / {b.mechanicElement} · {b.tribe}
                        </span>
                        <span className="vt-boss-name">{def.name}</span>
                        <span className="vt-boss-puzzle">{b.puzzle}</span>
                      </span>
                      {/* The state badge sits top-right and says only what is
                          true: cleared, locked, or the verb you are about to
                          perform. */}
                      <span className="vt-badge">
                        {!open
                          ? <><Lock size={12} aria-hidden="true" />LOCKED</>
                          : down
                            ? <><Check size={12} aria-hidden="true" />CLEARED</>
                            : <><Swords size={12} aria-hidden="true" />FIGHT</>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <p className="vt-foot">
        Bosses are fought with your own deck — pick it in the Arena when the
        fight seats. A first clear pays one booster pack. Refights are free
        practice.
      </p>
    </div>
  );
}

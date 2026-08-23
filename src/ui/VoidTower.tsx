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
import { EL_COLOR } from "./shared";
import { VOID_TOWER_ROUNDS } from "../engine/types";
import {
  bodyCap, bossDefeated, bossesOnFloor, floorCleared, floorOpen,
  summonBudget, towerProgress, trialEventId, voidFloors,
} from "../data/void-tower";


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
                  // EL_COLOR, not a local copy. This screen carried its own
                  // `EL_TINT` map and it had already drifted — its LEAF was
                  // #7fd89a against the real #4caf6d — so the tower was the one
                  // place in the game where an element was the wrong colour.
                  const tintA = EL_COLOR[b.tribeElement];
                  const tintB = EL_COLOR[b.mechanicElement];
                  const playable = open && !!event;
                  return (
                    <button
                      key={b.cardId}
                      type="button"
                      className={`vt-boss ${down ? "down" : ""} ${playable ? "" : "locked"}`}
                      // TWO accents, because the fight is a duel of two
                      // elements and the tile should say which two before you
                      // read a word of it. `--tint` stays the tribe's — it is
                      // the boss's primary and what the badge and hover glow
                      // key off — and `--tint2` gives the border a second stop.
                      style={{ ["--tint" as string]: tintA, ["--tint2" as string]: tintB }}
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
                          {/* Each element in ITS OWN colour. The pair used to be
                              printed entirely in the tribe element's tint, so a
                              DUSK/LEAF boss said LEAF in purple — the one line
                              on the screen whose whole job is to tell you what
                              you are walking into. */}
                          <b style={{ color: tintA }}>{b.tribeElement}</b>
                          <i>/</i>
                          <b style={{ color: tintB }}>{b.mechanicElement}</b>
                          <i>·</i>
                          <span className="vt-boss-tribe">{b.tribe}</span>
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
        fight seats. <b>Slay the boss within {VOID_TOWER_ROUNDS} rounds</b> —
        home slots cannot be captured in here, so killing it is the only way
        through, and its Special fires free every 3 rounds while you try. A
        first clear pays one booster pack and 25 shards; every refight after
        that pays 10.
      </p>
    </div>
  );
}

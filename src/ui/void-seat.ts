/** SEATING A VOID BOSS on a freshly built match — one door for both places a
 *  boss is fought: a Void Trial in the Tower (App's `startArenaMatch`) and a
 *  Hard-mode border in the campaign (App's story fight). Two copies of this
 *  setup would be two chances for the story's border bosses to quietly stop
 *  being the Tower's.
 *
 *  The boss stands on the board directly, outside the economy: the deck is only
 *  its summons. `summonCard` is the same door every card enters through, so
 *  auras and on-summon hooks all fire; clearing `summonedThisRound` lets it act
 *  from the first round, which is what "the boss is already standing when you
 *  arrive" means mechanically. */
import { cardAt, scaleInstance, summonCard } from "../engine";
import type { GameState } from "../engine";
import { centreHomeSeat } from "../engine/types";
import {
  ENRAGE_SCALE, VOID_GATE, bossWallSeats, tameScaleFor, voidBossById, voidBossSeat, voidGateSeats,
} from "../data/void-tower";

/** What a boss fields, for a read-out: the boss, then its wall and its
 *  formation, each card once. Not the padded tail — that is its tribe's rank
 *  and file, and listing it would bury the cards the fight is about. */
export function broodOf(bossId: string): string[] {
  const v = voidBossById(bossId);
  return [...new Set([bossId, ...(v?.wall ? [v.wall] : []), ...(v?.summons ?? [])])];
}

export function seatVoidBoss(
  fresh: GameState,
  bossId: string,
  opts: { enraged?: boolean; ally?: string | null; scale?: number } = {},
): void {
  const seat = voidBossSeat(fresh.boardSize);
  // Scores this match as a boss fight: no slot race, and killing the boss
  // IS the win (see the `voidTower` branch in doCleanupPhase).
  fresh.voidTower = true;
  const inst = summonCard(fresh, "P2", bossId, seat as never);
  inst.summonedThisRound = false;
  // ENRAGED: the taming trial. The same boss, angrier — scaled through the
  // one multiplier the whole feature runs on, so its Special is stronger
  // too and not just its body.
  if (opts.enraged) scaleInstance(inst, ENRAGE_SCALE);
  // ...or WEAKER than the Tower's: a Hard border boss held below its Tower
  // strength (`HARD_BORDER_SCALE`). Never both — a border is not a trial.
  else if (opts.scale != null && opts.scale !== 1) scaleInstance(inst, opts.scale);
  // ...and SOME BOSSES HAVE A WALL OF THEIR OWN. Kheiringer opens behind
  // three Lava Gates: placed here, at setup, because a summon lands on the
  // summoner's home row and she would otherwise have played her gates
  // beside herself instead of in front. Read off the boss entry rather than
  // keyed to her id, so the next one that wants a wall declares it.
  const wallBoss = voidBossById(bossId);
  if (wallBoss?.wall) {
    for (const wseat of bossWallSeats(fresh.boardSize)) {
      if (cardAt(fresh, wseat.row, wseat.col)) continue;
      const brick = summonCard(fresh, "P2", wallBoss.wall, wseat as never);
      brick.summonedThisRound = false;
    }
  }
  // ...and the player gets a WALL. Fortress Gates fill the row directly in
  // front of their home row, one per column, and cost them nothing — they
  // are there so the opening rounds are not decided before the player has a
  // board, and they feed the boss nothing when they fall (`noKillReward`).
  for (const gseat of voidGateSeats(fresh.boardSize)) {
    const gate = summonCard(fresh, "P1", VOID_GATE, gseat as never);
    gate.summonedThisRound = false;
  }
  // ...and a TAMED boss fights alongside them, seated the same way the enemy
  // boss is: on the board at round one, outside the economy. It has to be —
  // a 12-cost mythic is not something a tower fight ever affords,
  // so a tamed boss you had to buy would be a tamed boss you never fielded.
  // A fraction of everything (`TAME_SCALE`, or the boss's own `tameScale`:
  // Thunderfangs fights at full strength) and three battles is what pays
  // for it.
  //
  // The seat is the player's own centre home slot, mirroring `voidBossSeat`.
  // The gates stand in the row IN FRONT of home, so this square is free.
  if (opts.ally) {
    const mySeat = centreHomeSeat("P1", fresh.boardSize);
    if (!cardAt(fresh, mySeat.row, mySeat.col)) {
      const ally = summonCard(fresh, "P1", opts.ally, mySeat as never);
      ally.summonedThisRound = false;
      ally.tamed = true;
      scaleInstance(ally, tameScaleFor(opts.ally));
    }
  }
}

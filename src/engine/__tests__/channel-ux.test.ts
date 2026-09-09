import { describe, it, expect } from "vitest";
import { canChannel } from "../rules";
import { boardCards } from "../state";
import { HERO_MIN_ROUND } from "../heroes";
import type { GameState, PlayerId } from "../types";
import { place, prepState } from "./helpers";
import { CARDS, getDef } from "../../data/cards";

function heartSeat(seed = 7, seat: PlayerId = "P1"): GameState {
  const s = prepState(seed, seat);
  s.heroes = true;
  s.seatSuits = { ...(s.seatSuits ?? {}), [seat]: "heart" } as never;
  s.round = HERO_MIN_ROUND + 1;
  s.players[seat].magicPool = 9;
  s.players[seat].heroPowerUsed = false;
  return s;
}

/** A plain Special-carrier with no clock and no talent. */
const plainCaster = () => CARDS.find((c) => c.special && !c.special.talent
  && !c.roundTick?.fireSpecialEveryN && !c.boss && !c.special.params?.maxStacks)!;

describe("Arcane Focus tells the player what it can reach", () => {
  /* THE BUG: the click handler checked exactly two things — is it mine, does it
     have a Special — and dispatched regardless of the other nine refusals
     `canChannel` makes. A card that was MUTED, quarantined, out of targets,
     fully grown or too hurt to pay its own HP cost swallowed the click: nothing
     happened, nothing was spent, nothing was said. And nothing ever glowed, so
     the player was picking blind in the first place.

     These tests pin the PREDICATE the UI is now required to ask. They cannot
     click a React board, so what they guard is the contract: `canChannel` gives
     a usable yes/no AND a reason for every refusal the UI can meet. */

  it("gives a reason with every refusal, never a bare false", () => {
    const s = heartSeat();
    const def = plainCaster();
    const good = place(s, def.id, "P1", 3, 0);
    good.summonedThisRound = false;
    place(s, "leaf_alpha", "P2", 1, 0); // something to aim at

    // Every refusal the UI can surface must carry text, or the hint reads
    // "Can't channel X — undefined".
    const muted = place(s, def.id, "P1", 3, 1);
    muted.summonedThisRound = false;
    muted.statuses.push({ kind: "MUTED", duration: 2, power: 0, source: "DUSK" });
    const locked = place(s, def.id, "P1", 3, 2);
    locked.summonedThisRound = false;
    locked.specialLockedRounds = 2;

    for (const c of [muted, locked]) {
      const chk = canChannel(s, c.instanceId);
      expect(chk.ok, `${c.instanceId} should be refused`).toBe(false);
      expect(chk.reason, "a refusal without a reason is a silent no-op").toBeTruthy();
      expect(String(chk.reason).length).toBeGreaterThan(2);
    }
  });

  it("refuses a defeated or missing card with a reason rather than throwing", () => {
    const s = heartSeat();
    expect(canChannel(s, "no-such-card").ok).toBe(false);
    expect(canChannel(s, "no-such-card").reason).toBeTruthy();
    const dead = place(s, plainCaster().id, "P1", 3, 0, { curHp: 0 });
    const chk = canChannel(s, dead.instanceId);
    expect(chk.ok).toBe(false);
    expect(chk.reason).toBeTruthy();
  });

  it("says yes to a card that can genuinely take it", () => {
    // The glow set would be empty otherwise, and an armed power that lights
    // nothing is the same dead end by a different route.
    const s = heartSeat();
    const src = place(s, plainCaster().id, "P1", 3, 0);
    src.summonedThisRound = false;
    place(s, "leaf_alpha", "P2", 2, 0, { curHp: 30, maxHp: 30 });
    const chk = canChannel(s, src.instanceId);
    expect(chk.ok, `refused with: ${chk.reason}`).toBe(true);
  });

  it("a card with no one to aim at is refused, not offered", () => {
    // The commonest real refusal, and the one that used to swallow the click.
    const s = heartSeat();
    const src = place(s, plainCaster().id, "P1", 3, 0);
    src.summonedThisRound = false;
    // No enemies at all on the board.
    const chk = canChannel(s, src.instanceId);
    expect(chk.ok).toBe(false);
    expect(chk.reason).toMatch(/target/i);
  });

  it("the summon lockout is the ONE thing it forgives", () => {
    // Deliberate, and the headline of the power — play the piece and set it off
    // in the same prep. The resolve path lifts the flag to match (see
    // phases.ts); this asserts the promise it has to keep.
    const s = heartSeat();
    const src = place(s, plainCaster().id, "P1", 3, 0);
    src.summonedThisRound = true;
    place(s, "leaf_alpha", "P2", 2, 0, { curHp: 30, maxHp: 30 });
    expect(canChannel(s, src.instanceId).ok, "a body that just landed is channelable")
      .toBe(true);
  });

  it("the GLOW SET and the CLICK GATE are the same question", () => {
    // THE CONTRACT THAT WAS BROKEN. The board now rings exactly
    // `boardCards(view).filter(canChannel)`, and the click handler refuses
    // anything that predicate refuses. This mirrors the UI's expression so a
    // change to one that is not made to the other fails here rather than in a
    // player's match. It does NOT exercise React — the wiring itself is covered
    // only by tsc and the build, which is worth saying plainly.
    const s = heartSeat();
    place(s, "leaf_alpha", "P2", 2, 0, { curHp: 30, maxHp: 30 });
    const ok = place(s, plainCaster().id, "P1", 3, 0);
    ok.summonedThisRound = false;
    const muted = place(s, plainCaster().id, "P1", 3, 1);
    muted.summonedThisRound = false;
    muted.statuses.push({ kind: "MUTED", duration: 2, power: 0, source: "DUSK" });
    const noSpecial = place(s, CARDS.find((c) => !c.special && !c.boss)!.id, "P1", 3, 2);
    noSpecial.summonedThisRound = false;

    const glow = boardCards(s, "P1")
      .filter((c) => c.pos && c.curHp > 0 && canChannel(s, c.instanceId).ok)
      .map((c) => c.instanceId);

    expect(glow, "only the one that can take it").toEqual([ok.instanceId]);
    // ...and everything the board does NOT ring is refused with a reason, so a
    // player who clicks one anyway is told why instead of being ignored.
    for (const c of [muted, noSpecial]) {
      const chk = canChannel(s, c.instanceId);
      expect(chk.ok).toBe(false);
      expect(chk.reason, `${c.defId} refused without a reason`).toBeTruthy();
    }
  });

  it("a fully-grown Special is refused, and says so", () => {
    const stacking = CARDS.find((c) => c.special?.params?.maxStacks && !c.boss);
    if (!stacking) return;
    const s = heartSeat();
    const src = place(s, stacking.id, "P1", 3, 0);
    src.summonedThisRound = false;
    src.specialCasts = Number(getDef(stacking.id).special!.params!.maxStacks);
    place(s, "leaf_alpha", "P2", 2, 0, { curHp: 30, maxHp: 30 });
    const chk = canChannel(s, src.instanceId);
    expect(chk.ok, "a maxed Special cannot be channelled").toBe(false);
    expect(chk.reason).toMatch(/grown/i);
  });
});

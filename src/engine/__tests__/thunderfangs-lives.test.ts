// HOW MANY TIMES A BOSS MAY COME BACK.
//
// Reported from the device, twice now: "Thunderfangs keeps coming back to
// life". The first report was a full HEAL on transforming at five kills, fixed
// in `registerKill` by carrying the wound over. This is the second and separate
// half of it — an extra LIFE, from two second-form mechanisms colliding.
//
// Thunderfangs has both:
//   `transformOnDefeat` (Last Howl)  — die as form 1, get up as Stormform.
//   `transformAtKills`  (Stormform)  — earn the same form at five kills.
// Both roads lead to the same body, so either way the boss should be killable
// for good on its SECOND defeat, and on its FIRST if it already Stormformed.
//
// It was not. `transformAtKills` routes through the shared `transform` handler,
// which stamps `transformedFrom` — and that is the flag for Siren's Sea Terror,
// a completely different mechanic whose rule is "a transformed form doesn't
// die, it reverts to the original at FULL HP". So an earned Stormform quietly
// armed a third life, and reverting to form 1 re-armed Last Howl on top of it.
//
// `defeatCard`'s own comment says the two are kept apart because
// `transformOnDefeat` "never sets `transformedFrom`" — which is true, and was
// never true of the other path into the same form.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { basicAttack, defeatCard } from "../combat";
import { bigPrepState, place } from "./helpers";

const BOSS = "boss_thunderfangs";
const FORM2 = "boss_thunderfangs_2";

/** Kill it over and over until it stays dead; returns how many defeats it took. */
function defeatsToKill(s: ReturnType<typeof bigPrepState>, id: string): number {
  for (let n = 1; n <= 10; n++)
    if (defeatCard(s, s.cards[id], "test")) return n;
  return 99;
}

describe("Thunderfangs comes back ONCE", () => {
  it("the two second-form mechanisms name the same body", () => {
    // If they ever diverge this whole test is measuring the wrong thing.
    expect(getDef(BOSS).transformOnDefeat?.into).toBe(FORM2);
    expect(getDef(BOSS).transformAtKills?.into).toBe(FORM2);
    expect(getDef(FORM2).transformOnDefeat, "the second form is the last one").toBeUndefined();
    expect(getDef(FORM2).transformAtKills, "and it does not grow again").toBeUndefined();
  });

  it("un-transformed: dies on the second defeat, having risen once", () => {
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    expect(defeatsToKill(s, boss.instanceId), "Last Howl, then dead").toBe(2);
  });

  it("having EARNED Stormform, it dies on the very next defeat", () => {
    // THE BUG. Before the fix this took THREE: revert to form 1 at full HP,
    // then Last Howl into Stormform again, then finally die — so a player who
    // let it get its five kills had to kill it three times over, and the first
    // of those undid all their damage.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    const need = getDef(BOSS).transformAtKills!.kills;
    for (let i = 0; i < need; i++) {
      const prey = place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 1, maxHp: 1, curShields: 0 });
      basicAttack(s, boss.instanceId, prey.instanceId);
    }
    expect(s.cards[boss.instanceId].defId, "it grew at five kills").toBe(FORM2);
    expect(defeatsToKill(s, boss.instanceId), "already the last form — one and done").toBe(1);
  });

  it("growing into a form does not arm the disguise revert", () => {
    // The root cause, pinned directly: `transformedFrom` is Sea Terror's flag,
    // and growth is not a disguise. Anything that leaves it set here hands the
    // card a free full-HP life it was never designed to have.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2);
    const need = getDef(BOSS).transformAtKills!.kills;
    for (let i = 0; i < need; i++) {
      const prey = place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 1, maxHp: 1, curShields: 0 });
      basicAttack(s, boss.instanceId, prey.instanceId);
    }
    expect(s.cards[boss.instanceId].transformedFrom, "not a disguise").toBeUndefined();
  });

  it("still keeps the wound it took — growing is not a heal", () => {
    // The FIRST device report, and it must not regress while fixing the second.
    const s = bigPrepState();
    const boss = place(s, BOSS, "P2", 0, 2, { curHp: 4, maxHp: getDef(BOSS).hp, curShields: 0 });
    const need = getDef(BOSS).transformAtKills!.kills;
    for (let i = 0; i < need; i++) {
      const prey = place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 1, maxHp: 1, curShields: 0 });
      basicAttack(s, boss.instanceId, prey.instanceId);
    }
    const grown = s.cards[boss.instanceId];
    expect(grown.defId).toBe(FORM2);
    expect(grown.curHp, "the wound carries; only the INCREASE is granted")
      .toBe(4 + (getDef(FORM2).hp - getDef(BOSS).hp));
  });
});

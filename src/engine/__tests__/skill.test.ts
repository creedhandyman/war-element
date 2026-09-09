import { describe, it, expect } from "vitest";
import { AI_SKILLS, SKILL_PROFILES, skillOf, weSetSkillSeat } from "../skill";
import { advance, chooseBattleAction, createInitialState } from "../index";
import type { GameState } from "../index";
import { place, prepState } from "./helpers";
import { PREMADE_DECKS } from "../../data/custom-decks";

describe("the skill dial", () => {
  it("is sharp when nothing asked for otherwise", () => {
    // THE COMPATIBILITY GUARANTEE. Every saved game, replay and fixture in the
    // suite predates the dial and must face exactly the opponent it always did.
    const s = createInitialState(7);
    expect(s.aiSkill, "a fresh match declares nothing").toBeUndefined();
    expect(skillOf(s).key).toBe("sharp");
  });

  it("names itself, gentlest first, with every switch on at the top", () => {
    expect([...AI_SKILLS]).toEqual(["learning", "steady", "sharp"]);
    for (const k of AI_SKILLS) {
      expect(SKILL_PROFILES[k].key, `${k} names itself`).toBe(k);
      expect(SKILL_PROFILES[k].blurb.length).toBeGreaterThan(20);
    }
    const sharp = SKILL_PROFILES.sharp;
    expect(
      [sharp.spells, sharp.plans, sharp.readsLethal, sharp.readsThreat,
       sharp.guardsHome, sharp.readsCurve, sharp.readsMagic],
      "sharp is the opponent that shipped — nothing taken away",
    ).toEqual([true, true, true, true, true, true, true]);
  });

  it("gives up strictly more knowledge the gentler it gets", () => {
    // The rungs have to NEST. Two rungs that each drop a different thing are two
    // difficulties, not a ladder, and the picker would be lying about its order.
    const count = (k: (typeof AI_SKILLS)[number]) => {
      const p = SKILL_PROFILES[k];
      return [p.spells, p.plans, p.readsLethal, p.readsThreat, p.guardsHome,
              p.readsCurve, p.readsMagic].filter(Boolean).length;
    };
    expect(count("learning")).toBeLessThan(count("steady"));
    expect(count("steady")).toBeLessThan(count("sharp"));
    for (const key of ["spells", "plans", "readsLethal", "readsThreat",
                       "guardsHome", "readsCurve", "readsMagic"] as const) {
      if (SKILL_PROFILES.steady[key]) {
        expect(SKILL_PROFILES.sharp[key], `sharp keeps ${key} if steady does`).toBe(true);
      }
      if (SKILL_PROFILES.learning[key]) {
        expect(SKILL_PROFILES.steady[key], `steady keeps ${key} if learning does`).toBe(true);
      }
    }
  });

  it("lets a kill walk that the sharp opponent takes", () => {
    // THE HANDICAP, as a single observable decision rather than a win rate.
    // Two enemies in reach: one nearly dead, one a fat threat. Sharp finishes
    // the wounded card; learning swings at whatever its target list offered
    // first, which is the mistake a new player makes and recognises.
    const build = (skill: GameState["aiSkill"]) => {
      const s = prepState(7, "P2");
      s.aiSkill = skill;
      s.phase = "battle";
      const me = place(s, "bore_bastion", "P2", 2, 1);
      place(s, "leaf_sakuroot", "P1", 1, 0, { curHp: 1 });
      place(s, "leaf_sakuroot", "P1", 1, 1);
      return { s, id: me.instanceId };
    };
    const sharp = build("sharp");
    const learning = build("learning");
    const sharpPick = chooseBattleAction(sharp.s, sharp.id);
    const learnPick = chooseBattleAction(learning.s, learning.id);
    expect(sharpPick.action).toBe("basic");
    const sharpTarget = sharp.s.cards[sharpPick.targetId!];
    expect(sharpTarget.curHp, "sharp finishes the wounded one").toBe(1);
    // Learning is not required to pick the healthy one — board order decides —
    // only to have stopped consulting lethality at all.
    expect(learnPick.action).toBe("basic");
    expect(skillOf(learning.s).readsLethal).toBe(false);
  });

  it("is a handicap, measured over real matches", () => {
    // THE CONTRACT THE WHOLE FEATURE RESTS ON: the gentle rung wins less.
    //
    // `weSetSkillSeat` is what makes this a head-to-head at all. The dial is
    // table-wide by design, so in a sim where BOTH seats are AI it applies to
    // both and cancels out — the harness hook confines it to one chair, which is
    // the asymmetry a real match has for free and this one does not.
    //
    // 60 games a rung, both chairs played so the second-seat advantage cancels.
    // Sized for the gap in skill.ts's table, not for precision: the attribution
    // lives there, and this only has to catch a switch wired backwards.
    const field = PREMADE_DECKS.filter((d) => (d.boardSize ?? 4) === 4).slice(0, 10);
    const wins = (skill: GameState["aiSkill"]) => {
      let won = 0, played = 0;
      for (const seat of ["P1", "P2"] as const) {
        weSetSkillSeat(seat);
        for (let i = 0; i < field.length; i++) {
          for (let r = 0; r < 3; r++) {
            const a = field[i], b = field[(i + 1 + r) % field.length];
            const [d1, d2] = seat === "P1" ? [a, b] : [b, a];
            let s: GameState = createInitialState(
              i * 131 + r * 17 + 5, d1.cards, d2.cards, [], [], [], 4,
            );
            s.aiSkill = skill;
            let steps = 0;
            while (s.phase !== "gameover" && steps < 8000) { s = advance(s); steps++; }
            if (s.win?.winner) { played++; if (s.win.winner === seat) won++; }
          }
        }
      }
      weSetSkillSeat(null);
      return { won, played };
    };
    const sharp = wins("sharp");
    const learning = wins("learning");
    expect(learning.played, "the sample actually resolved").toBeGreaterThan(40);
    expect(
      learning.won / learning.played,
      `learning ${learning.won}/${learning.played} vs sharp ${sharp.won}/${sharp.played}`,
    ).toBeLessThan(sharp.won / sharp.played);
  }, 180_000);
});

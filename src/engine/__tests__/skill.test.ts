import { describe, it, expect } from "vitest";
import {
  AI_SKILLS, SKILL_DEMOTE_MIN, SKILL_DEMOTE_RATE, SKILL_PROMOTE_MIN, SKILL_PROMOTE_RATE,
  SKILL_PROFILES, SKILL_WINDOW, emptySkillTrack,
  recordSkillMatch, skillOf, weSetSkillSeat,
} from "../skill";
import { advance, chooseBattleAction, createInitialState } from "../index";
import type { GameState } from "../index";
import { place, prepState } from "./helpers";
import { PREMADE_DECKS } from "../../data/custom-decks";
import {
  aiSkillIsAuto, clearAiSkill, loadAiSkill, loadAiTrack, recordAiMatch, saveAiSkill,
} from "../../data/prefs";

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


/* -- THE DIAL MOVES ITSELF --------------------------------------------------
   The three rungs were only reachable from a menu, and the default was picked
   once and frozen for the life of the save. A player does not stay a beginner,
   so the rung now tracks them: two wins up, three losses down. */
describe("the opponent adjusts in the background", () => {
  /** Play a string of results: "W" win, "L" loss. */
  const run = (from: (typeof AI_SKILLS)[number], results: string) =>
    [...results].reduce((t, r) => recordSkillMatch(t, r === "W"), emptySkillTrack(from));

  it("promotes on a WIN RATE, not on a streak", () => {
    expect(SKILL_PROMOTE_RATE).toBe(0.6);
    expect(SKILL_PROMOTE_MIN).toBe(8);
    // Two in a row used to be a promotion. It is not evidence of anything: a
    // record is what shows a player has got better, and two games is a mood.
    expect(run("learning", "WW").skill, "a streak alone moves nothing").toBe("learning");
    // 5 of 8 is 62.5% — the first record that both clears the floor and the bar.
    expect(run("learning", "WWWWWLLL").skill, "5/8 = 62.5%").toBe("steady");
    expect(run("learning", "WWWLL").skill, "3/5 clears the bar but not the floor")
      .toBe("learning");
  });

  it("holds the rung below the bar however long you play", () => {
    // 50% forever is the player and the opponent being evenly matched, which is
    // the rung doing its job — not a reason to make it harder.
    expect(run("learning", "WLWLWLWLWL").skill).toBe("learning");
    expect(run("steady", "WLWLWLWLWL").skill).toBe("steady");
  });

  it("climbs the whole ladder for a player who keeps winning", () => {
    expect(run("learning", "WWWWWWWW").skill).toBe("steady");
    expect(run("learning", "WWWWWWWWWWWWWWWW").skill).toBe("sharp");
  });

  it("counters reset on every move, so each rung is judged on its own record", () => {
    expect(run("learning", "WWWWWWWW")).toEqual({ skill: "steady", wins: 0, losses: 0 });
  });

  it("gives a rung back only on a longer look — demotion is RELUCTANT", () => {
    expect(SKILL_DEMOTE_RATE).toBeLessThan(SKILL_PROMOTE_RATE);
    expect(SKILL_DEMOTE_MIN).toBeGreaterThan(SKILL_PROMOTE_MIN);
    // Five straight losses is a bad run and is NOT enough — a climb needs five
    // matches, a drop needs eight, because telling a player they are worse than
    // they are is the more insulting mistake and they cannot see it happen.
    expect(run("sharp", "LLLLLLLLL").skill, "nine losses is still a bad run").toBe("sharp");
    expect(run("sharp", "LLLLLLLLLL").skill, "ten is a pattern").toBe("steady");
  });

  it("FORGETS, so an old bad run cannot bury a player who improved", () => {
    // The whole reason the record is windowed. A lifetime average would have
    // this player needing thirty straight wins to reach 60%.
    const rough = run("learning", "LLLLLLLLLLL"); // a miserable start
    const after = [...("WWWWWWWWWWWW")].reduce((t, r) => recordSkillMatch(t, r === "W"), rough);
    expect(after.skill, "a run of honest wins gets them off the floor").toBe("steady");
  });

  it("never lets the record grow without bound", () => {
    let t = emptySkillTrack("sharp");
    for (let i = 0; i < 200; i++) t = recordSkillMatch(t, i % 2 === 0);
    expect(t.wins + t.losses, "the window keeps it small").toBeLessThan(SKILL_WINDOW);
  });

  it("clamps at both ends instead of walking off the ladder", () => {
    expect(run("sharp", "WWWWWWWWWWWWWWWW").skill).toBe("sharp");
    expect(run("learning", "LLLLLLLLLLLLLLLL").skill).toBe("learning");
  });

  it("a hand-edited rung is discarded rather than computed on", () => {
    // localStorage is editable and predates this field; an unknown rung would
    // otherwise index SKILL_PROFILES as undefined.
    const bogus = { skill: "godlike" as (typeof AI_SKILLS)[number], wins: 9, losses: 9 };
    expect(recordSkillMatch(bogus, true)).toEqual({ skill: "learning", wins: 0, losses: 0 });
  });

  it("every rung it can land on is a real profile", () => {
    // The whole point of the tracker is that nothing else has to validate it.
    let t = emptySkillTrack("learning");
    for (const r of "WWWWLLLLLLWWWWWWLLL") {
      t = recordSkillMatch(t, r === "W");
      expect(SKILL_PROFILES[t.skill], `landed on ${t.skill}`).toBeTruthy();
      expect(AI_SKILLS).toContain(t.skill);
      expect(t.wins).toBeGreaterThanOrEqual(0);
      expect(t.losses).toBeGreaterThanOrEqual(0);
      // Both counters climb now — a RECORD, not a streak (see SkillTrack). What
      // still has to hold is that it stays bounded and never goes negative.
      expect(t.wins + t.losses, "the window holds").toBeLessThan(SKILL_WINDOW);
    }
  });
});


describe("Auto is the default, and pinning a rung stops it", () => {
  /** The suite runs headless; prefs wants a Storage. Same stub the story tests
   *  use, restored afterwards so it cannot leak across files. */
  function withStorage(body: () => void) {
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try { body(); } finally { g.localStorage = prior; }
  }

  it("a fresh save opens gentle and an established one opens sharp", () => {
    withStorage(() => {
      // The seed is the guess the manual default always made — the dial did not
      // change what a new player meets first, only whether it stays there.
      expect(loadAiSkill(false)).toBe("learning");
      expect(loadAiTrack(false).skill).toBe("learning");
    });
    withStorage(() => {
      expect(loadAiSkill(true)).toBe("sharp");
    });
  });

  it("climbs on its own, and remembers where it got to", () => {
    withStorage(() => {
      expect(aiSkillIsAuto(), "nothing pinned yet").toBe(true);
      // A RECORD, not a streak: it takes SKILL_PROMOTE_MIN matches at
      // SKILL_PROMOTE_RATE before a rung opens, so a couple of wins move nothing.
      for (let i = 0; i < 7; i++)
        expect(recordAiMatch(true, false), `win ${i + 1} is not yet a record`).toBe("learning");
      expect(recordAiMatch(true, false), "the eighth clears the floor").toBe("steady");
      expect(loadAiSkill(false), "and it persisted").toBe("steady");
      for (let i = 0; i < 7; i++) recordAiMatch(true, false);
      expect(recordAiMatch(true, false)).toBe("sharp");
      expect(loadAiSkill(false)).toBe("sharp");
    });
  });

  it("PINNING a rung freezes it — results stop counting entirely", () => {
    withStorage(() => {
      saveAiSkill("learning");
      expect(aiSkillIsAuto()).toBe(false);
      // A player showing someone the game does not want two wins taking the
      // gentle opponent off them.
      for (let i = 0; i < 6; i++) expect(recordAiMatch(true, false)).toBe("learning");
      expect(loadAiSkill(false)).toBe("learning");
    });
  });

  it("unpinning hands it back on the rung it had actually climbed to", () => {
    withStorage(() => {
      for (let i = 0; i < 8; i++) recordAiMatch(true, false); // Auto reached steady
      saveAiSkill("sharp");                  // ...then the player pinned sharp
      expect(loadAiSkill(false)).toBe("sharp");
      clearAiSkill();
      expect(aiSkillIsAuto()).toBe(true);
      expect(loadAiSkill(false), "back to where Auto was, not to the seed").toBe("steady");
    });
  });

  it("a save that predates Auto reads as PINNED, with no migration", () => {
    withStorage(() => {
      // A stored rung could only ever have come from the player pressing a
      // button, so "is there a manual choice on file" is the whole test — an
      // established player is not silently handed a moving dial.
      localStorage.setItem("we_prefs_v1", JSON.stringify({ aiSkill: "steady" }));
      expect(aiSkillIsAuto()).toBe(false);
      expect(loadAiSkill(true)).toBe("steady");
      expect(recordAiMatch(false, true)).toBe("steady");
    });
  });

  it("a hand-edited track is discarded rather than trusted", () => {
    withStorage(() => {
      localStorage.setItem("we_prefs_v1", JSON.stringify({ aiTrack: { skill: "godlike", wins: 99, losses: 0 } }));
      expect(loadAiTrack(false).skill, "falls back to the seed").toBe("learning");
      localStorage.setItem("we_prefs_v1", JSON.stringify({ aiTrack: { skill: "steady", wins: -5, losses: NaN } }));
      const t = loadAiTrack(false);
      expect(t.skill).toBe("steady");
      expect(t.wins).toBe(0);
    });
  });

  it("survives storage being unavailable at all", () => {
    // Private browsing, blocked site data. The choice holds for the session
    // rather than throwing at the player.
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = undefined;
    try {
      expect(() => loadAiSkill(false)).not.toThrow();
      expect(loadAiSkill(false)).toBe("learning");
      expect(() => recordAiMatch(true, false)).not.toThrow();
    } finally { g.localStorage = prior; }
  });
});

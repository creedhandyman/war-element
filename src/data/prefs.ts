// PREFERENCES — the handful of settings that belong to the PLAYER rather than
// to a squad, a save, or a match.
//
// Its own module because the alternatives were both wrong: the story save is a
// record of a campaign and a preference is not progress, and a squad is a deck
// and a preference is not a deck. A setting that follows the player across every
// mode has no owner among those, so it gets one here.
import { AI_SKILLS } from "../engine/skill";
import type { AiSkill } from "../engine/skill";

const STORAGE_KEY = "we_prefs_v1";

interface Prefs {
  /** How much of the game the AI opponent plays with — see `skill.ts`. */
  aiSkill?: AiSkill;
}

function read(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Prefs) ?? {} : {};
  } catch {
    return {};
  }
}

function write(next: Prefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked — the choice still holds for this session */
  }
}

/** The opponent the player has asked for.
 *
 *  THE DEFAULT DEPENDS ON WHETHER THEY HAVE EVER WON ANYTHING, and that is the
 *  whole reason this takes an argument. Both obvious defaults are wrong on their
 *  own: `sharp` for everyone leaves the handicap sitting in a menu the player it
 *  was built for has no reason to open, and `learning` for everyone silently
 *  hands an established player an easier game they never asked for — a difficulty
 *  change nobody chose is the same bug in either direction.
 *
 *  So a save that has never cleared a node opens gentle, and a save with
 *  campaign progress behind it opens on the opponent it has always played. Once
 *  the player picks for themselves, the stored value wins and this stops
 *  guessing.
 *
 *  VALIDATED, not trusted: localStorage is hand-editable and predates the field,
 *  and an unknown string would reach `SKILL_PROFILES[x]` as undefined. */
export function loadAiSkill(hasPlayed: boolean): AiSkill {
  const want = read().aiSkill;
  if (AI_SKILLS.includes(want as AiSkill)) return want as AiSkill;
  return hasPlayed ? "sharp" : "learning";
}

export function saveAiSkill(skill: AiSkill): void {
  write({ ...read(), aiSkill: skill });
}

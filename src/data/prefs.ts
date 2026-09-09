// PREFERENCES — the handful of settings that belong to the PLAYER rather than
// to a squad, a save, or a match.
//
// Its own module because the alternatives were both wrong: the story save is a
// record of a campaign and a preference is not progress, and a squad is a deck
// and a preference is not a deck. A setting that follows the player across every
// mode has no owner among those, so it gets one here.
import { AI_SKILLS, emptySkillTrack, recordSkillMatch } from "../engine/skill";
import type { AiSkill, SkillTrack } from "../engine/skill";

const STORAGE_KEY = "we_prefs_v1";

interface Prefs {
  /** How much of the game the AI opponent plays with — see `skill.ts`.
   *
   *  PRESENT MEANS PINNED. The player reached into the menu and chose this
   *  rung, so the dial stops moving on its own; absent means Auto. Storing the
   *  intent as "is there a manual choice on file" rather than as a separate
   *  `auto: boolean` keeps the two from ever disagreeing, and means every save
   *  that predates Auto — where a stored value could only have come from the
   *  player pressing a button — reads as pinned without a migration. */
  aiSkill?: AiSkill;
  /** The rung Auto is currently on, and the run of results that put it there.
   *  Ignored while `aiSkill` is pinned; kept rather than cleared, so unpinning
   *  returns to the rung the player had actually climbed to. */
  aiTrack?: SkillTrack;
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
  return loadAiTrack(hasPlayed).skill;
}

/** Is the dial moving itself? True unless the player has pinned a rung. */
export function aiSkillIsAuto(): boolean {
  return !AI_SKILLS.includes(read().aiSkill as AiSkill);
}

/** The rung Auto is on, seeded on first run from the same guess the manual
 *  default used: a save with campaign progress behind it opens on the opponent
 *  it has always played, and a fresh one opens gentle.
 *
 *  VALIDATED, not trusted, for the same reason the pinned value is: this is
 *  hand-editable localStorage, and a bad rung would reach `SKILL_PROFILES[x]`
 *  as undefined.
 *
 *  THE RUNG AND THE COUNTERS FAIL DIFFERENTLY, deliberately. An unknown rung is
 *  discarded whole — its counters were counting toward nothing, so there is
 *  nothing in the record worth keeping. A REAL rung with a mangled count keeps
 *  the rung and resets the count: the rung is the part the player earned over
 *  several matches, and throwing it away to punish a bad number would undo that
 *  climb over something that costs one match to rebuild. (`JSON.stringify` also
 *  writes NaN as `null`, so a non-finite count is a shape this can genuinely be
 *  handed rather than only a hand-edit.) */
export function loadAiTrack(hasPlayed: boolean): SkillTrack {
  const t = read().aiTrack;
  if (!t || !AI_SKILLS.includes(t.skill)) return emptySkillTrack(hasPlayed ? "sharp" : "learning");
  const count = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
  return { skill: t.skill, wins: count(t.wins), losses: count(t.losses) };
}

/** Fold a finished match into the dial, and report the rung to play next.
 *
 *  A NO-OP WHILE PINNED, and that is the whole contract of the pin: a player
 *  who chose `learning` to show someone the game does not want two wins to take
 *  it off them. The caller does not have to know — it reports every match it is
 *  allowed to report and this decides whether anything moves.
 *
 *  Returns the rung to use for the NEXT match, so the caller can hold it in
 *  state without re-reading storage. */
export function recordAiMatch(won: boolean, hasPlayed: boolean): AiSkill {
  const prefs = read();
  const pinned = prefs.aiSkill;
  if (AI_SKILLS.includes(pinned as AiSkill)) return pinned as AiSkill;
  const next = recordSkillMatch(loadAiTrack(hasPlayed), won);
  write({ ...prefs, aiTrack: next });
  return next.skill;
}

/** Pin a rung by hand. Stops Auto — see `Prefs.aiSkill`. */
export function saveAiSkill(skill: AiSkill): void {
  write({ ...read(), aiSkill: skill });
}

/** Hand the dial back to Auto, on the rung it had climbed to. */
export function clearAiSkill(): void {
  const { aiSkill: _pinned, ...rest } = read();
  write(rest);
}

import { describe, expect, it } from "vitest";
import { CARDS, TOKENS } from "../../data/cards";
import { SPELLS } from "../spells";

// Missing art fails SILENTLY — a broken <img> and nothing else. No console
// error, no exception, no failing test. "Gale Force's photo isn't loading" was
// a file named gale_force.webp for a spell whose id is gale_gale_force, and the
// only way anyone finds that is by looking at the screen.
//
// The UI builds these as `/spells/${id}.webp` and `/cards/${art ?? id}.webp`, so
// the id IS the filename.
//
// Listed with import.meta.glob rather than fs.existsSync, for two reasons:
// the repo has no @types/node, and existsSync on Windows is case-INSENSITIVE
// while Vercel's Linux is not — so it would green-light a `Dusk_Ravven.png`
// that 404s in production. A glob listing gives the real bytes of each name.
const basenames = (glob: Record<string, unknown>): Set<string> =>
  new Set(Object.keys(glob).map((p) => p.split("/").pop()!));

describe("every card and spell has its art on disk", () => {
  const spellArt = basenames(import.meta.glob("../../../public/spells/*.webp"));
  const cardArt = basenames(import.meta.glob("../../../public/cards/*.webp"));

  it("finds the art directories at all", () => {
    // Guard the guard: a bad glob path yields {} and every check below would
    // "pass" by finding nothing to compare against.
    expect(spellArt.size).toBeGreaterThan(50);
    expect(cardArt.size).toBeGreaterThan(100);
  });

  it("spells", () => {
    const missing = SPELLS.filter((s) => !spellArt.has(`${s.id}.webp`)).map((s) => `${s.id} (${s.name})`);
    expect(missing, `spells with no art file:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("cards", () => {
    // TOKENS are a separate array (kept out of decks), and were not covered here
    // until a spawned card needed art of its own — a missing token plate is just
    // as invisible as a missing card one.
    // `art` is the escape hatch for a file that can't be named after the id.
    const missing = [...CARDS, ...TOKENS].filter((c) => !cardArt.has(`${c.art ?? c.id}.webp`)).map(
      (c) => `${c.id} (${c.name})${c.art ? ` -> art: "${c.art}"` : ""}`,
    );
    expect(missing, `cards with no art file:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("every spell picture has its small copy in spells/thumb", () => {
    // The tray and the builder/draft chips draw this one; only the cast flash
    // still loads the 720x720 original. Run `python tools/make-thumbs.py`.
    const thumbs = basenames(import.meta.glob("../../../public/spells/thumb/*.webp"));
    expect(thumbs.size).toBeGreaterThan(50);
    const missing = [...spellArt].filter((f) => !thumbs.has(f));
    expect(missing, `spell art with no thumb (run tools/make-thumbs.py):\n  ${missing.join("\n  ")}`)
      .toEqual([]);
  });

  it("every plate has its small copy in cards/thumb", () => {
    // Nearly every surface — board tokens, hand, all the grids — draws the
    // 500px copy from `tools/make-thumbs.py`, because the browser decodes an
    // image at its natural size however small it is shown, and 419 full plates
    // in the gallery came to ~700 MB of bitmap. A missing copy fails the same
    // silent way missing art does: an empty tile and no error, so it is caught
    // here. Fix by running `python tools/make-thumbs.py`.
    const thumbs = basenames(import.meta.glob("../../../public/cards/thumb/*.webp"));
    // Same guard-the-guard as above: an empty glob would pass every check.
    expect(thumbs.size).toBeGreaterThan(100);
    const missing = [...cardArt].filter((f) => !thumbs.has(f));
    expect(missing, `plates with no thumb (run tools/make-thumbs.py):\n  ${missing.join("\n  ")}`)
      .toEqual([]);
  });

  it("no art filename relies on case-insensitive lookup", () => {
    // A capitalised file works locally and 404s on the deploy.
    const odd = [...spellArt, ...cardArt].filter((f) => /[A-Z]/.test(f));
    expect(odd, `art filenames must be lowercase:\n  ${odd.join("\n  ")}`).toEqual([]);
  });
});

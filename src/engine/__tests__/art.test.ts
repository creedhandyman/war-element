import { describe, expect, it } from "vitest";
import { CARDS } from "../../data/cards";
import { SPELLS } from "../spells";

// Missing art fails SILENTLY — a broken <img> and nothing else. No console
// error, no exception, no failing test. "Gale Force's photo isn't loading" was
// a file named gale_force.webp for a spell whose id is gale_gale_force, and the
// only way anyone finds that is by looking at the screen.
//
// The UI builds these as `/spells/${id}.webp` and `/cards/${art ?? id}.png`, so
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
  const cardArt = basenames(import.meta.glob("../../../public/cards/*.png"));

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
    // `art` is the escape hatch for a file that can't be named after the id.
    const missing = CARDS.filter((c) => !cardArt.has(`${c.art ?? c.id}.png`)).map(
      (c) => `${c.id} (${c.name})${c.art ? ` -> art: "${c.art}"` : ""}`,
    );
    expect(missing, `cards with no art file:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("no art filename relies on case-insensitive lookup", () => {
    // A capitalised file works locally and 404s on the deploy.
    const odd = [...spellArt, ...cardArt].filter((f) => /[A-Z]/.test(f));
    expect(odd, `art filenames must be lowercase:\n  ${odd.join("\n  ")}`).toEqual([]);
  });
});

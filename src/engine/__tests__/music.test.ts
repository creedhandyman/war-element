import { describe, expect, it } from "vitest";
import { REGIONS } from "../../data/story";
import { battlePlaylist, ELEMENT_TRACKS, REGION_TRACK, TRACKS } from "../../ui/useGameMusic";
import { CORES } from "../../data/cards";
import { PREMADE_DECKS } from "../../data/custom-decks";

// Music fails SILENTLY, exactly like card art. A track whose file is missing
// just never plays; a REGION_TRACK key that does not match a region id falls
// through to the menu theme. Neither throws, neither logs, and the only way
// anyone notices is by sitting on that map and hearing the wrong thing.
//
// Listed with import.meta.glob rather than fs.existsSync for the same two
// reasons as art.test.ts: no @types/node, and existsSync on Windows is case-
// INSENSITIVE while Vercel's Linux is not — so it would green-light a
// `City.mp3` that 404s in production.
const files = new Set(
  Object.keys(import.meta.glob("../../../public/music/*.mp3")).map((p) => p.split("/").pop()!),
);

describe("background music", () => {
  it("finds the music directory at all", () => {
    // Guard the guard: a bad glob path yields {} and every check below passes
    // vacuously.
    expect(files.size).toBeGreaterThan(0);
  });

  it("has every declared track on disk", () => {
    for (const [name, url] of Object.entries(TRACKS)) {
      expect(files.has(url.split("/").pop()!), `${name} -> ${url}`).toBe(true);
    }
  });

  it("ships no track nothing plays", () => {
    // The other direction from the check above, and it has teeth: everything in
    // `public/` is copied into `dist` whether or not a line of code names it, so
    // an orphaned theme is dead weight served to every player. Retiring GALE's
    // nightowl.mp3 for cyclone.mp3 would have left 2.6MB behind exactly that way.
    // A file parked here on purpose is not a case worth supporting — park it
    // outside `public/`, or this is the same silent MB in production.
    const played = new Set(Object.values(TRACKS).map((url) => url.split("/").pop()!));
    for (const f of files) expect(played.has(f), `public/music/${f} is in no TRACKS entry`).toBe(true);
  });

  it("points every region theme at a region that exists", () => {
    const ids = new Set(REGIONS.map((r) => r.id));
    for (const key of Object.keys(REGION_TRACK)) {
      expect(ids.has(key), `REGION_TRACK["${key}"] matches no region`).toBe(true);
    }
  });

  it("gives every region its own theme, now that all eight exist", () => {
    // Deliberately NOT the same assertion as the one above. That one says a
    // declared theme points at a real region; this says every region has one.
    // The map was incomplete by design while tracks were still being written —
    // BOLT shipped without music, then DAWN — and a missing theme falls back to
    // menu/battle rather than breaking. All eight are filled in now, so this
    // turns "silently plays the wrong thing" into a failing test for the next
    // region that ships ahead of its music.
    for (const r of REGIONS) {
      expect(REGION_TRACK[r.id], `region "${r.id}" has no theme`).toBeTruthy();
    }
  });

  it("can name every element, each exactly once", () => {
    // ELEMENT_TRACKS is the ORDER a battle playlist is filtered into, not
    // something played start to finish — but it still has to cover the whole
    // element set, or a match containing the ninth element would drop it
    // silently rather than fail here.
    expect(new Set(ELEMENT_TRACKS).size, "no repeats").toBe(ELEMENT_TRACKS.length);
    expect([...ELEMENT_TRACKS].sort()).toEqual(Object.keys(REGION_TRACK).sort());
    for (const t of ELEMENT_TRACKS) expect(TRACKS[t], t).toBeTruthy();
  });

  it("plays only the elements actually on the table", () => {
    // A mono core is one theme, and one theme is a loop rather than a playlist.
    const leaf = CORES.find((c) => c.id === "leaf")!.cards;
    const pyro = CORES.find((c) => c.id === "pyro")!.cards;
    expect(battlePlaylist(leaf, leaf)).toEqual(["leaf"]);
    // Two mono cores meet as two themes, in the lobby's order rather than the
    // order the decks were passed — so the same matchup sounds the same however
    // the seats fell.
    expect(battlePlaylist(pyro, leaf)).toEqual(["leaf", "pyro"]);
    expect(battlePlaylist(leaf, pyro)).toEqual(["leaf", "pyro"]);
    // And it never plays an element that is not there.
    for (const t of battlePlaylist(leaf, pyro)) expect(["leaf", "pyro"]).toContain(t);
  });

  it("gives a real premade matchup its own four themes", () => {
    // The shipped builds are dual-element, so an ordinary Arena match is four.
    const a = PREMADE_DECKS.find((d) => d.id === "pre_inferno_blitz")!;
    const b = PREMADE_DECKS.find((d) => d.id === "pre_frostkeep")!;
    const list = battlePlaylist(a.cards, b.cards);
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const t of list) expect(TRACKS[t], t).toBeTruthy();
    expect(new Set(list).size, "no element twice").toBe(list.length);
  });

  it("falls back to Rival when a deck names nothing real", () => {
    // The only remaining route to the battle theme, which is why it stays in
    // TRACKS at all.
    expect(battlePlaylist([], [])).toEqual(["battle"]);
    expect(battlePlaylist(["not_a_card"])).toEqual(["battle"]);
  });

  it("keeps the two non-story states pointed at their own tracks", () => {
    // A region theme is allowed to be missing — that falls back to menu/battle
    // on purpose — but menu and battle themselves are not optional.
    expect(TRACKS.menu).toBeTruthy();
    expect(TRACKS.battle).toBeTruthy();
  });
});

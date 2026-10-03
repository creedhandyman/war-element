// A Story fight is painted as its region's ground (owner, 2026-10-03): grass in
// the forest, cracked basalt in the south. The board gets `data-ground` from the
// region's element and styles.css maps each one to a texture. A region whose
// element had no rule would silently fall back to the stone, so pin the set.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REGIONS } from "../../data/story";

const root = join(__dirname, "..", "..", "..");
const css = readFileSync(join(root, "src", "ui", "styles.css"), "utf8");
const textures = readdirSync(join(root, "public", "ground"));

describe("every story region fights on its own ground", () => {
  for (const region of REGIONS) {
    const el = region.element.toLowerCase();
    it(`${region.element}: a rule and a texture`, () => {
      expect(css).toContain(`.board[data-ground="${el}"] { --ground: url("/ground/${el}.webp"); }`);
      expect(textures).toContain(`${el}.webp`);
    });
  }

  it("the board passes the region's element through", () => {
    const app = readFileSync(join(root, "src", "ui", "App.tsx"), "utf8");
    expect(app).toContain("ground={(storyNode ? regionOfNode(storyNode.id)?.element : game.ground)?.toLowerCase()}");
  });
});

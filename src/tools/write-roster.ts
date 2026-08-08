/** Entry point for `npm run roster`. Separate from roster.ts so the builder stays
 *  a pure function the test can import without writing to disk. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildRoster, ROSTER_PATH } from "./roster";

const out = resolve(process.cwd(), ROSTER_PATH);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buildRoster(), "utf8");
console.log(`roster written: ${ROSTER_PATH}`);

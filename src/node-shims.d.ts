/** Minimal type shims for the handful of Node APIs the test suite uses.
 *
 *  tsconfig sets `types: ["vite/client"]`, so no ambient Node types are in
 *  scope, and the project has no @types/node. Only one test needs the
 *  filesystem — the stylesheet guard, which has to read styles.css as TEXT.
 *  Vite's `?raw` import cannot do it: Vitest stubs CSS imports, so `?raw`
 *  returns an EMPTY STRING and every check silently passes against nothing.
 *
 *  Shimmed rather than adding @types/node so the dependency list does not grow
 *  for two function signatures. Declared exactly as narrowly as they are used —
 *  if a test reaches for more of Node than this, it fails to compile, which is
 *  the intended pressure.
 */
declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}
declare module "node:path" {
  export function join(...parts: string[]): string;
}
declare const __dirname: string;

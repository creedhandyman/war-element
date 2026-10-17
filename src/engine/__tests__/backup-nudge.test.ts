// THE BACKUP NUDGE (ui/backup-nudge.ts): once the first fight is won and nothing is
// signed in, Home says the collection lives only on this device — politely, and
// not forever.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  NUDGE_COOLDOWN_MS, NUDGE_MAX_DISMISSALS, dismissBackupNudge, readNudgeState, shouldShowBackupNudge,
} from "../../ui/backup-nudge";

const DAY = 24 * 60 * 60 * 1000;
const base = { signedIn: false, cleared: 1, state: {}, now: 1_000_000_000_000 };
const read = (...p: string[]) => readFileSync(join(__dirname, "..", "..", ...p), "utf8").replace(/\r\n/g, "\n");

describe("shouldShowBackupNudge", () => {
  it("waits for the first win: the first session is busy enough", () => {
    expect(shouldShowBackupNudge({ ...base, cleared: 0 })).toBe(false);
    expect(shouldShowBackupNudge({ ...base, cleared: 1 })).toBe(true);
  });

  it("never shows to someone who is signed in", () => {
    expect(shouldShowBackupNudge({ ...base, signedIn: true })).toBe(false);
  });

  it("'Not now' hides it for a week", () => {
    const state = { dismissedAt: base.now - 2 * DAY, dismissals: 1 };
    expect(shouldShowBackupNudge({ ...base, state })).toBe(false);
    expect(shouldShowBackupNudge({ ...base, state: { ...state, dismissedAt: base.now - NUDGE_COOLDOWN_MS - 1 } })).toBe(true);
  });

  it("stops after three refusals: they have decided", () => {
    const state = { dismissedAt: base.now - 30 * DAY, dismissals: NUDGE_MAX_DISMISSALS };
    expect(shouldShowBackupNudge({ ...base, state })).toBe(false);
    expect(shouldShowBackupNudge({ ...base, state: { ...state, dismissals: NUDGE_MAX_DISMISSALS - 1 } })).toBe(true);
  });
});

describe("the device-local store", () => {
  const store = new Map<string, string>();
  (globalThis as unknown as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  afterEach(() => store.clear());

  it("counts each dismissal and restarts the clock", () => {
    expect(readNudgeState()).toEqual({ dismissedAt: undefined, dismissals: undefined });
    dismissBackupNudge(5);
    expect(readNudgeState()).toEqual({ dismissedAt: 5, dismissals: 1 });
    dismissBackupNudge(9);
    expect(readNudgeState()).toEqual({ dismissedAt: 9, dismissals: 2 });
  });

  it("shrugs off junk in storage", () => {
    store.set("we_backup_nudge", "{not json");
    expect(readNudgeState()).toEqual({});
    store.set("we_backup_nudge", JSON.stringify({ dismissedAt: "yesterday", dismissals: [] }));
    expect(readNudgeState()).toEqual({ dismissedAt: undefined, dismissals: undefined });
  });

  it("is a property of the device, never synced with the save", () => {
    expect(read("net", "account.ts")).not.toContain("we_backup_nudge");
  });
});

describe("the wiring", () => {
  it("Home shows the card, tracks it, and hides once an account arrives", () => {
    const home = read("ui", "HomeScreen.tsx");
    expect(home).toContain("const showBackup = nudge && !props.accountEmail;");
    expect(home).toContain('track("backup_shown")');
    expect(home).toContain('track("backup_tap"); props.onAccount();');
  });

  it("telemetry ignores automated browsers", () => {
    expect(read("net", "telemetry.ts")).toContain("navigator.webdriver === true");
  });
});

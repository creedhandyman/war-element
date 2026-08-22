// The half-finished sign-in, and why it has to be written down.
//
// Reading the emailed code means LEAVING the app. On a phone that closes the
// panel at best; on iOS a backgrounded tab is evicted and the page reloads.
// React state survives neither, so the player used to come back to the EMAIL
// form with no code box, ask for a second code, hit Supabase's one-a-minute
// send limit, and report it as "I get the code, enter it, click sign in and it
// won't". The auth logs agreed from the other side: every /verify that ever
// reached the server succeeded. Nothing was wrong with the codes — what failed
// was getting back to the box to type one into.
//
// These are the rules that make coming back work. The Supabase calls are not
// mocked; this is the pure half, and it is the half that was broken.
import { beforeEach, describe, expect, it } from "vitest";
import {
  RESEND_COOLDOWN_MS, clearPendingSignIn, pendingSignIn, resendWaitMs, setPendingSignIn,
} from "../../net/account";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  } as Storage;
}

const T0 = 1_700_000_000_000; // a fixed "now"; the clock is a parameter here on purpose

beforeEach(() => {
  globalThis.localStorage = fakeStorage();
});

describe("a pending sign-in outlives the panel", () => {
  it("is nothing at all before a code is asked for", () => {
    expect(pendingSignIn(T0)).toBeNull();
  });

  it("remembers WHICH address is waiting, not just that one is", () => {
    // The panel re-fills the email box from this. Remembering only "a code was
    // sent" would put someone on a code screen unable to tell whose code it is,
    // which is how one player ended up signing up twice.
    setPendingSignIn("player@example.com", T0);
    expect(pendingSignIn(T0)).toEqual({ email: "player@example.com", requestedAt: T0 });
  });

  it("survives a reload — the whole point", () => {
    // A new storage object with the same contents IS the reload: module state
    // is gone, localStorage is not.
    setPendingSignIn("player@example.com", T0);
    const raw = localStorage.getItem("we_signin_pending")!;
    globalThis.localStorage = fakeStorage();
    localStorage.setItem("we_signin_pending", raw);
    expect(pendingSignIn(T0)?.email).toBe("player@example.com");
  });

  it("expires with the code it points at", () => {
    // Supabase codes die after an hour. Restoring a pending older than that
    // would drop someone on a code screen with no live code to type — worse
    // than the email form, because it hides the way to get a fresh one.
    setPendingSignIn("player@example.com", T0);
    expect(pendingSignIn(T0 + 59 * 60_000), "still good at 59 minutes").not.toBeNull();
    expect(pendingSignIn(T0 + 61 * 60_000), "scrap at 61").toBeNull();
  });

  it("forgets an expired one rather than re-reading it every time", () => {
    setPendingSignIn("player@example.com", T0);
    pendingSignIn(T0 + 61 * 60_000);
    expect(localStorage.getItem("we_signin_pending")).toBeNull();
  });

  it("ignores junk instead of throwing", () => {
    // This runs on the way into the panel. A parse error here would take the
    // whole sign-in screen down, which is a far worse failure than forgetting
    // one pending code.
    for (const junk of ["not json{", "null", "[]", '{"email":"a@b.c"}', '{"requestedAt":1}']) {
      localStorage.setItem("we_signin_pending", junk);
      expect(() => pendingSignIn(T0), junk).not.toThrow();
      expect(pendingSignIn(T0), junk).toBeNull();
    }
  });

  it("is gone once it is cleared", () => {
    setPendingSignIn("player@example.com", T0);
    clearPendingSignIn();
    expect(pendingSignIn(T0)).toBeNull();
  });
});

describe("the resend cooldown, counted rather than discovered", () => {
  it("is the full minute the instant a code goes out", () => {
    expect(resendWaitMs({ email: "a@b.c", requestedAt: T0 }, T0)).toBe(RESEND_COOLDOWN_MS);
  });

  it("counts down", () => {
    const p = { email: "a@b.c", requestedAt: T0 };
    expect(resendWaitMs(p, T0 + 20_000)).toBe(40_000);
  });

  it("reaches zero and stays there", () => {
    // Never negative: the panel divides this into seconds for a label, and
    // "Resend in -8s" is worse than no label.
    const p = { email: "a@b.c", requestedAt: T0 };
    expect(resendWaitMs(p, T0 + RESEND_COOLDOWN_MS)).toBe(0);
    expect(resendWaitMs(p, T0 + 10 * RESEND_COOLDOWN_MS)).toBe(0);
  });

  it("does not hold back someone who has not asked for anything", () => {
    expect(resendWaitMs(null, T0)).toBe(0);
  });
});

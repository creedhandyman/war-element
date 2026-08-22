// Sign in with an email, and carry the save between devices.
//
// The whole screen is three states and one hard question:
//
//   SIGNED OUT     → email, then the six-digit code that arrives.
//   SIGNED IN      → what is on this device, what is in the cloud, and the two
//                    buttons that move a save one way or the other.
//   BOTH REAL      → the conflict. Two devices with genuine progress is the one
//                    case where guessing is unacceptable, so it asks.
//
// The conflict is the reason this is a panel and not a toggle. "Newest wins"
// is the obvious rule and it is the wrong one: a fresh install has a newer
// empty save than the two-month-old campaign in the cloud, so the rule that
// looks safest is precisely the one that deletes everything. What IS safe is
// automatic in one direction only — an empty side never overwrites a full one,
// and the player is asked whenever both sides have something to lose.
import { useEffect, useState } from "react";
import {
  accountConfigured, applyBundle, currentUser, localBundle, onAuthChange,
  pullSave, pushSave, requestCode, signOut, summarize,
  type AccountUser, type SaveBundle, type SaveSummary,
} from "../net/account";
import { verifyCode } from "../net/account";

type Busy = null | "code" | "verify" | "pull" | "push";

function Summary(props: { title: string; s: SaveSummary; when?: string; device?: string }) {
  const { s } = props;
  return (
    <div className="acct-side">
      <span className="acct-side-h">{props.title}</span>
      {s.empty ? (
        <span className="acct-side-empty">Nothing saved</span>
      ) : (
        <ul className="acct-stats">
          <li><b>{s.cards}</b> cards</li>
          <li><b>{s.cleared}</b> nodes cleared</li>
          <li><b>{s.shards}</b> shards</li>
          <li><b>{s.squads}</b> squads</li>
        </ul>
      )}
      {props.when && (
        <span className="acct-when">
          {new Date(props.when).toLocaleString()}
          {props.device ? ` · ${props.device}` : ""}
        </span>
      )}
    </div>
  );
}

export function AccountPanel(props: {
  onClose: () => void;
  /** Re-read every save file from localStorage. Called after a restore, because
   *  the whole app is holding React state loaded at boot — writing localStorage
   *  underneath it changes nothing anyone can see until this runs. */
  onRestored: () => void;
}) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [cloud, setCloud] = useState<SaveBundle | null>(null);
  const [loadedCloud, setLoadedCloud] = useState(false);

  const local = localBundle();
  const localS = summarize(local);
  const cloudS = summarize(cloud);

  useEffect(() => {
    void currentUser().then(setUser);
    return onAuthChange(setUser);
  }, []);

  // Whatever is in the cloud, fetched once per sign-in. Not on a timer: this
  // panel is the only thing that writes it, so it cannot go stale while open.
  useEffect(() => {
    if (!user) { setCloud(null); setLoadedCloud(false); return; }
    let live = true;
    void pullSave().then((r) => {
      if (!live) return;
      if (r.ok) { setCloud(r.bundle); setLoadedCloud(true); }
      else setMsg({ text: r.error, bad: true });
    });
    return () => { live = false; };
  }, [user]);

  async function doRequest() {
    setBusy("code"); setMsg(null);
    const r = await requestCode(email);
    setBusy(null);
    if (r.ok) { setSent(true); setMsg({ text: `Code sent to ${email.trim()}. It expires in an hour.` }); }
    else setMsg({ text: r.error, bad: true });
  }

  async function doVerify() {
    setBusy("verify"); setMsg(null);
    const r = await verifyCode(email, code);
    setBusy(null);
    if (r.ok) { setUser(r.user); setCode(""); setSent(false); setMsg({ text: "Signed in." }); }
    else setMsg({ text: r.error, bad: true });
  }

  async function doUpload() {
    setBusy("push"); setMsg(null);
    const b = localBundle();
    const r = await pushSave(b);
    setBusy(null);
    if (r.ok) { setCloud(b); setMsg({ text: "This device's save is now in the cloud." }); }
    else setMsg({ text: r.error, bad: true });
  }

  function doRestore() {
    if (!cloud) return;
    applyBundle(cloud);
    props.onRestored();
    setMsg({ text: "Restored from the cloud." });
  }

  if (!accountConfigured) {
    return (
      <div className="overlay on-top" onClick={props.onClose}>
        <div className="modal acct" onClick={(e) => e.stopPropagation()}>
          <h2>Account</h2>
          <p className="acct-note">
            This build has no server configured, so accounts and cloud saves are off.
            Your progress is saved on this device only.
          </p>
          <button className="lockin" onClick={props.onClose}>Close</button>
        </div>
      </div>
    );
  }

  // BOTH sides hold a real game. The only state where this panel refuses to act
  // on its own — see the header.
  const conflict = !!user && loadedCloud && !localS.empty && !cloudS.empty;

  return (
    <div className="overlay on-top" onClick={props.onClose}>
      <div className="modal acct" onClick={(e) => e.stopPropagation()}>
        <div className="acct-head">
          <h2>Account</h2>
          <button className="panel-close" onClick={props.onClose} aria-label="Close">✕</button>
        </div>

        {!user ? (
          <>
            <p className="acct-note">
              Sign in with an email to keep your progress and carry it to another phone.
              No password — we email you a six-digit code.
            </p>
            <label className="acct-field">
              <span>Email</span>
              <input
                type="email" inputMode="email" autoComplete="email"
                value={email} placeholder="you@example.com"
                onChange={(e) => { setEmail(e.target.value); setMsg(null); }}
              />
            </label>
            {!sent ? (
              <button className="lockin" disabled={busy !== null || !email.trim()} onClick={doRequest}>
                {busy === "code" ? "Sending…" : "Email me a code"}
              </button>
            ) : (
              <>
                <label className="acct-field">
                  <span>Code</span>
                  <input
                    inputMode="numeric" autoComplete="one-time-code" maxLength={8}
                    value={code} placeholder="123456"
                    onChange={(e) => { setCode(e.target.value); setMsg(null); }}
                  />
                </label>
                <div className="acct-row">
                  <button className="lockin" disabled={busy !== null || code.trim().length < 4} onClick={doVerify}>
                    {busy === "verify" ? "Checking…" : "Sign in"}
                  </button>
                  <button className="ghost" disabled={busy !== null} onClick={doRequest}>Resend</button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="acct-who">
              <span className="acct-email">{user.email}</span>
              <button className="ghost sm" onClick={() => void signOut()}>Sign out</button>
            </div>

            <div className="acct-compare">
              <Summary title="This device" s={localS} />
              <Summary
                title="In the cloud" s={cloudS}
                when={cloud?.savedAt} device={cloud?.device}
              />
            </div>

            {conflict && (
              <p className="acct-warn">
                Both have progress. Whichever you choose replaces the other — pick the one
                you want to keep.
              </p>
            )}

            <div className="acct-row">
              <button
                className={`lockin ${conflict ? "" : "wide"}`}
                disabled={busy !== null || localS.empty}
                title={localS.empty ? "Nothing on this device to upload" : undefined}
                onClick={() => void doUpload()}
              >
                {busy === "push" ? "Uploading…" : "Save this device to the cloud"}
              </button>
              <button
                className={conflict ? "br" : "ghost"}
                disabled={busy !== null || !loadedCloud || cloudS.empty}
                title={cloudS.empty ? "Nothing in the cloud yet" : undefined}
                onClick={doRestore}
              >
                Restore onto this device
              </button>
            </div>

            <p className="acct-note small">
              Restoring replaces everything on this phone — campaign, collection, shards
              and squads. It does not merge.
            </p>
          </>
        )}

        {msg && <div className={`acct-msg ${msg.bad ? "bad" : ""}`}>{msg.text}</div>}
      </div>
    </div>
  );
}

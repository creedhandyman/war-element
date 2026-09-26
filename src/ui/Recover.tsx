/** WHEN A SCREEN CANNOT OPEN, OR THE APP ITSELF FAILS: a card that says so,
 *  instead of a blank page.
 *
 *  React unmounts EVERYTHING on an error no boundary catches, and until these
 *  existed nothing did — so one screen failing to load (its chunk gone after a
 *  deploy: see stale-chunks.ts) took the whole game with it, down to the
 *  page's background. `ScreenBoundary` sits around each code-split screen, so
 *  a failure there covers only that screen and the menu or match underneath
 *  carries on; `AppBoundary` around the whole app is the last line, so even a
 *  failure nothing nearer caught still leaves a way back. */
import { Component, type ReactNode } from "react";
import { isMatchLive } from "./stale-chunks";

interface State { error: Error | null }

/** Around each code-split screen (App.tsx `deferred`). `onClose` is the
 *  screen's own close, when it has one: Back shuts it the way it would have. */
export class ScreenBoundary extends Component<{ children: ReactNode; onClose?: () => void }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[screen] could not open:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const live = isMatchLive();
    const close = this.props.onClose;
    return (
      <div className="overlay on-top" role="alertdialog" aria-label="This screen could not open">
        <div className="recover-card">
          <h2>This screen couldn&rsquo;t open</h2>
          <p>
            {offline
              ? "It downloads the first time you open it, and you're offline. Reconnect and try again."
              : live
                ? "The game has been updated since this match began. Reload when the match is over to get the new version."
                : "The game has just been updated. Reload to get the new version — your progress is saved."}
          </p>
          <div className="recover-row">
            {close && (
              <button type="button" className="bbtn" onClick={() => close()}>
                Back
              </button>
            )}
            <button type="button" className="bbtn gold" onClick={() => window.location.reload()}>
              {live ? "Reload now (ends the match)" : "Reload"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/** Around the whole app (main.tsx): if anything throws that nothing nearer
 *  caught, say so — with the error, for a report — and offer the way back. */
export class AppBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[app] crashed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="overlay on-top" role="alertdialog" aria-label="Something went wrong">
        <div className="recover-card">
          <h2>Something went wrong</h2>
          <p>Your progress is saved. Reload to pick up where you left off.</p>
          <code>{this.state.error.message}</code>
          <div className="recover-row">
            <button type="button" className="bbtn gold" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

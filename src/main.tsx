import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { AppBoundary } from "./ui/Recover";
import { warmSoon } from "./ui/stale-chunks";
import "./ui/styles.css";

/** Takes down the boot splash (index.html) once the real UI is committed.
 *
 *  A mount EFFECT rather than a timeout or a double rAF: an effect runs after
 *  React has painted, which is exactly the moment the splash stops being the
 *  thing holding the screen. A timer would either uncover a half-built app or
 *  keep the splash up after the app was ready, and the right delay is different
 *  on every device.
 *
 *  StrictMode invokes this twice in dev; the second call finds nothing and the
 *  optional chain absorbs it.
 *
 *  The same moment starts fetching every screen in the background, while the
 *  build that named them is still the one on the server — so a deploy later
 *  cannot turn tapping one into a reload (stale-chunks.ts). `warmSoon` starts
 *  once however often it is called. */
function Boot() {
  useEffect(() => {
    document.getElementById("boot")?.remove();
    warmSoon();
  }, []);
  return <App />;
}

// The last line: an error nothing nearer caught shows a way back, instead of
// unmounting the app to the page's empty background (Recover.tsx).
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppBoundary>
      <Boot />
    </AppBoundary>
  </StrictMode>,
);

import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { AppBoundary } from "./ui/Recover";
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
 *  optional chain absorbs it. */
function Boot() {
  useEffect(() => { document.getElementById("boot")?.remove(); }, []);
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

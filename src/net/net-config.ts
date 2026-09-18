/** Is the backend configured? — the one question you can ask WITHOUT loading it.
 *
 *  `online.ts` and `account.ts` both construct a Supabase client at module
 *  scope, and the SDK is 204 KB of the first-load bundle (measured off the
 *  build's sourcemap). Almost nobody needs it on the first frame: it is for
 *  hosting or joining an online room and for signing in, and the menu asks
 *  neither. App now imports those modules dynamically at the moment they are
 *  used — but it renders "Online" as disabled when the env vars are missing,
 *  which is the ONE fact it needs immediately.
 *
 *  So the flag lives here, where it costs two env reads and no SDK.
 *  `online.ts` re-exports it, because that is where callers already look. */
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the Supabase env vars are present (online play is available).
 *
 *  Same pair the account feature reads — one project, two features, so
 *  configuring either configures both. */
export const onlineConfigured = Boolean(URL && ANON);

// What a session may inherit (IMP-07, audit 2026-09-05).
//
// THE HOLE THIS CLOSES. `PtyManager.open` handed every session `{...process.env}`,
// and Fabric's main process holds the service-role key to its own database.
// So the agent surface — a per-session credential, a project scope, a call
// budget, a journalled record of every tool call — was walked around by
// `echo $SUPABASE_SERVICE_ROLE_KEY` and a curl. Every guarantee this repository
// makes about what an agent can reach was one environment variable wide.
//
// A DENYLIST RATHER THAN AN ALLOWLIST, and the reason is the product. An agent
// session is a real shell in a real project: it needs the operator's PATH,
// their language servers, their `ANTHROPIC_API_KEY`, their git configuration.
// An allowlist would break all of that and would be lengthened by whoever hit
// the breakage next, until it was a denylist with extra steps. So the list here
// is narrow and specific: FABRIC'S OWN CREDENTIALS TO FABRIC'S OWN SPINE.
// Nothing an agent legitimately needs is on it.
//
// `SUPABASE_URL` is deliberately NOT stripped. It is a loopback address, not a
// secret, and with every key removed it opens nothing. Stripping non-secrets is
// how a denylist grows without a reason and starts breaking things nobody
// connected to security.

import { AUTH_OVERRIDES } from '../shared/authResolution.ts'

/** Fabric's credentials to its own database. None of these mean anything to an
 *  agent doing its job, and all of them defeat the surface. */
export const WITHHELD_FROM_SESSIONS: readonly string[] = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_DB_URL',
  'DATABASE_URL',
  'POSTGRES_PASSWORD',
  'PGPASSWORD'
]

// #region launched-session-marker — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
/**
 * D6 of the working-with-fabric session hooks: `FABRIC_LAUNCHED_SESSION=1` in the environment of every session
 * Fabric launches and connects to its surface, whatever the adapter (`sessionBundle.ts#launched` sets it), so a
 * plugin's hooks stay silent where Fabric already briefed the session. Not a secret: it carries no authority, only "Fabric started this". It is NEVER
 * inherited — a Fabric started from inside a launched session would otherwise pass it to every plain shell it opens,
 * and silence the hooks of a coding agent the person starts there, which Fabric did not brief.
 */
export const LAUNCHED_SESSION_MARKER = 'FABRIC_LAUNCHED_SESSION'
// #endregion launched-session-marker

// #region session-utf8-ctype — docs: docs/adr/0169-a-console-runs-with-the-operators-own-setup.md#decision
/**
 * The encoding a session gets when it has none of its own (the owner, 2026-11-21 02:37: Russian copied from the CEO's
 * console reached another console as «–î–∞–≤–∞–π», UTF-8 read as Mac Roman). Fabric started by launchd («Служба
 * доски», ADR-0192) inherits no locale, so neither did its consoles, and macOS's `pbcopy` and `pbpaste`, which Claude
 * Code copies through, then read the text in `__CF_USER_TEXT_ENCODING`'s Mac Roman. Only LC_CTYPE is set: the
 * language of messages stays the person's. `en_US.UTF-8` because a locale macOS does not ship (`en_PL.UTF-8` from
 * the region) breaks `pbcopy` the same way, measured 2026-11-21; it is the one the other spawns already use
 * (`backendView.ts`, `codexLoopback.ts`).
 */
export const UTF8_CTYPE = 'en_US.UTF-8'

/** True when the environment names a locale for its characters: LC_ALL, LC_CTYPE or LANG, non-empty. */
export function namesCharacterLocale(env: Record<string, string | undefined>): boolean {
  return Boolean(env.LC_ALL || env.LC_CTYPE || env.LANG)
}
// #endregion session-utf8-ctype

/**
 * The environment a session gets: the operator's, minus Fabric's own keys, with UTF-8 characters when it names none.
 *
 * Pure and exported so it can be tested without spawning anything — the branch
 * that matters is "the key is present and does not survive", and proving that
 * through a real PTY would mean putting a live service-role key into a test.
 *
 * `account` is M199.auth's addition, and it is OPTIONAL on purpose. With no
 * account chosen, the paragraph above still holds in full: a session is a real
 * shell and the operator's own `ANTHROPIC_API_KEY` is theirs to use. The moment
 * an account IS chosen, that same variable stops being a convenience and
 * becomes a substitution — measured, on Claude Code 2.1.236, it replaces the
 * resolved identity outright and the reader then answers with a null email.
 * So the second list is conditional, and conditional on the one fact that
 * changes what the variable means.
 */
export function sessionEnvironment(
  parent: NodeJS.ProcessEnv,
  account?: { provider: string } | null
): Record<string, string> {
  const out: Record<string, string> = {}
  const overrides = account ? new Set((AUTH_OVERRIDES[account.provider] ?? []).map((o) => o.variable)) : null
  for (const [key, value] of Object.entries(parent)) {
    if (value === undefined) continue
    if (WITHHELD_FROM_SESSIONS.includes(key)) continue
    if (key === LAUNCHED_SESSION_MARKER) continue
    if (overrides?.has(key)) continue
    out[key] = value
  }
  // A session with no locale of its own gets UTF-8 characters (region session-utf8-ctype above).
  if (!namesCharacterLocale(out)) out.LC_CTYPE = UTF8_CTYPE
  return out
}

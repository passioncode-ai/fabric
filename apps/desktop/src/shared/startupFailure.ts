// Why the app would not start, in words an operator can act on (M100).
//
// Before this, `app.whenReady()`'s catch did `console.error` and `app.quit()`.
// The operator double-clicked the app and NOTHING HAPPENED: no window, no
// dialog, no explanation — and in a packaged Electron app there is no terminal
// attached, so `console.error` goes nowhere a person would ever look. The
// product's first impression, whenever anything was wrong, was that it does not
// work at all.
//
// The row named three causes. Measuring the paths found SIX that are genuinely
// distinguishable, and one pair that a careless matcher would conflate:
// `execFileSync` reports BOTH a missing binary and a timeout as
// `spawnSync supabase <CODE>`, differing only in ENOENT versus ETIMEDOUT. Their
// remedies have nothing in common — "install the tool" against "Docker is
// probably still waking up" — so an operator with slow Docker would have been
// told to install software they already have.
//
// Every string here was measured on 2026-09-05 rather than imagined; the test
// file carries the shapes as recorded.

import { stackFolderFor } from './stackFolder.ts'

export type StartupCause =
  | 'supabase-cli-missing'
  | 'stack-start-timed-out'
  | 'stack-would-not-start'
  | 'stack-up-but-silent'
  | 'repository-not-found'
  | 'schema-missing'
  | 'schema-not-ready'
  | 'active-estate-unreadable'
  | 'identity-refused'
  | 'database-unreachable'
  | 'unknown'

export interface StartupFailure {
  cause: StartupCause
  /** One line naming WHICH precondition failed. */
  title: string
  /** What to do about it, in the operator's terms — never a stack trace. */
  remedy: string
  /** The machine's own words, kept whole so they can be copied and searched. */
  detail: string
  /** A remedy more precise than the cause's own, in the registry (with `vars`), when the failure says which one. */
  remedyKey?: string
  vars?: Record<string, string | number>
}

const SCHEMA_WHYS = new Set(['contract-invalid', 'build-mismatch', 'unverified', 'behind', 'ahead'])
/** main/schemaReadiness.ts#SchemaUnverified: an unverified check's own remedy (0.3.5 review ER-9). */
const SCHEMA_UNVERIFIED = new Set(['timeout', 'transport', 'backend-error', 'not-an-integer'])

function textOf(e: unknown): string {
  if (e === null || e === undefined) return ''
  if (typeof e === 'string') return e
  if (typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

function codeOf(e: unknown): string {
  if (e !== null && typeof e === 'object' && 'code' in e) return String((e as { code: unknown }).code)
  return ''
}

/**
 * Was the child KILLED rather than allowed to exit?
 *
 * This is the only thing separating a four-minute timeout from a stack that
 * refused, once the start runs asynchronously. Measured 2026-09-05: the
 * synchronous `execFileSync` reports a timeout as `spawnSync supabase
 * ETIMEDOUT`, and the promisified `execFile` reports the very same event as
 * `Command failed: supabase start` with code NULL and `killed: true` — the
 * identical text a non-zero exit produces. Reading the message alone would have
 * downgraded every timeout to "the stack refused to start" the moment M101
 * moved the call off the main thread.
 */
function wasKilled(e: unknown): boolean {
  if (e === null || typeof e !== 'object') return false
  return (
    ('killed' in e && (e as { killed: unknown }).killed === true) ||
    ('signal' in e && typeof (e as { signal: unknown }).signal === 'string')
  )
}

/**
 * Reads a thrown value and says which precondition failed.
 *
 * Takes `unknown` on purpose: `catch (e)` catches whatever was thrown, and a
 * classifier that assumes an `Error` would itself throw on the day something
 * threw a string — turning a diagnosable failure into a silent one, which is
 * the exact defect this module exists to end.
 */
export function classifyStartupFailure(e: unknown, platform: string = typeof process === 'undefined' ? 'darwin' : process.platform): StartupFailure {
  const f = forPlatform(classifyCause(e), platform)
  return { ...f, remedy: f.remedy.replace('{stackFolder}', stackFolderFor(platform)) }
}

/**
 * The remedies that differ by OS (0.3.5 review UX-2): how the Supabase CLI is installed, which Docker runs the stack,
 * and what an installed Fabric came from. The causes' own sentences are macOS's; on Windows and Linux these replace
 * them, in English here and through `startup.<cause>.remedy.<platform>` in the registry, so no Windows or Linux user is
 * told to run brew, start OrbStack or open a DMG.
 */
const PER_OS: Partial<Record<StartupCause, Record<'win32' | 'linux', string>>> = {
  'supabase-cli-missing': {
    win32: 'Install it with scoop (`scoop bucket add supabase https://github.com/supabase/scoop-bucket.git`, then `scoop install supabase`), then open Fabric again. If it is already installed, it lives somewhere this app does not look — start Fabric from a terminal to confirm.',
    linux: 'Install it from the Supabase CLI releases (a .deb, .rpm or .apk package at https://github.com/supabase/cli/releases), then open Fabric again. If it is already installed, it lives somewhere this app does not look — start Fabric from a terminal to confirm.'
  },
  'stack-start-timed-out': {
    win32: 'This is almost always Docker: check that Docker Desktop is running with its WSL 2 engine and has finished starting, then retry. A first-ever start also has images to download, and that can genuinely take longer.',
    linux: 'This is almost always Docker: check that Docker Engine is running (`systemctl status docker`) and that your user may use it, then retry. A first-ever start also has images to download, and that can genuinely take longer.'
  },
  'stack-would-not-start': {
    win32: 'The stack’s own words are below and they are usually specific. If they mention Docker, start Docker Desktop and retry; if a port is taken, `supabase stop` releases it.',
    linux: 'The stack’s own words are below and they are usually specific. If they mention Docker, start Docker Engine (`sudo systemctl start docker`) and retry; if a port is taken, `supabase stop` releases it.'
  },
  'repository-not-found': {
    win32: 'Set FABRIC_REPO to a checkout of the Fabric repository, then open Fabric again. Fabric installed with its Windows installer carries its own stack and needs no checkout.',
    linux: 'Set FABRIC_REPO to a checkout of the Fabric repository, then open Fabric again. Fabric installed from its AppImage or .deb package carries its own stack and needs no checkout.'
  }
}

function forPlatform(f: StartupFailure, platform: string): StartupFailure {
  if (platform !== 'win32' && platform !== 'linux') return f
  const own = PER_OS[f.cause]?.[platform]
  return own ? { ...f, remedy: own, remedyKey: `startup.${f.cause}.remedy.${platform}` } : f
}

function classifyCause(e: unknown): StartupFailure {
  const detail = textOf(e) || 'No description was attached to the failure.'
  const code = codeOf(e)

  if (code === 'FABRIC_ACTIVE_ESTATE_UNREADABLE')
    return {
      cause: 'active-estate-unreadable',
      title: 'Fabric does not know which Estate to open.',
      remedy: 'The file recording the Estate you chose could not be read, and Fabric will not open another Estate in its place. Remove active-estate.json from Fabric’s data folder to open the default Estate, or put the file back.',
      detail
    }

  // The identity boundary refused (FA-07): the database does not list the person Fabric runs as. Named rather than
  // left to "unknown" (0.3.4 i1 UX-1): bootstrap appends the seed repair's reason, so the details say what it found.
  // Only the boundary's own refusal: a read that failed ("could not be resolved", a timeout, a refused connection)
  // falls to the causes below, as it did before 0.3.4 (i2 ER-1, UX-2).
  if (/^identity could not be established: that person (?:is not a member|does not exist|may not act)/.test(detail))
    return {
      cause: 'identity-refused',
      title: 'Fabric does not have access to the Estate it was opening.',
      remedy: 'Fabric runs as the owner of your Estate, and this database does not name that owner. Fabric never makes itself the owner of an Estate, except an untouched one it set up itself; the details below say what it read. If they say something could not be read, retry first; otherwise copy them and report them at https://github.com/passioncode-ai/Fabric/issues. Fabric has changed nothing in the Estate.',
      detail
    }

  if (code === 'FABRIC_SCHEMA_NOT_READY') {
    // The refusal says which check failed (main/schemaReadiness.ts#SchemaWhy): the remedy is that one's, translated.
    const why = (e as { why?: unknown }).why
    const check = (e as { check?: unknown }).check
    const facts = (e as { facts?: Record<string, unknown> }).facts ?? {}
    const vars: Record<string, number> = {}
    for (const k of ['found', 'min', 'max']) if (typeof facts[k] === 'number') vars[k] = facts[k] as number
    return {
      cause: 'schema-not-ready',
      title: 'Fabric could not verify database compatibility.',
      remedy: 'Follow the details below, then retry. Workspace services have not started; Fabric will not migrate the database automatically.',
      detail,
      ...(typeof why === 'string' && SCHEMA_WHYS.has(why)
        ? { remedyKey: why === 'unverified' && typeof check === 'string' && SCHEMA_UNVERIFIED.has(check) ? `startup.schema-not-ready.unverified.${check}` : `startup.schema-not-ready.${why}`, vars }
        : {})
    }
  }

  if (code === 'ENOENT' || /spawnSync \S+ ENOENT/.test(detail))
    return {
      cause: 'supabase-cli-missing',
      title: 'The Supabase command-line tool is not installed, or is not on this app’s PATH.',
      remedy:
        'Install it with `brew install supabase/tap/supabase`, then open Fabric again. If it is already installed, it lives somewhere this app does not look — start Fabric from a terminal to confirm.',
      detail
    }

  if (code === 'ETIMEDOUT' || /spawnSync \S+ ETIMEDOUT/.test(detail) || wasKilled(e))
    return {
      cause: 'stack-start-timed-out',
      title: 'The local stack did not finish starting within four minutes.',
      remedy:
        'This is almost always Docker: check that Docker (Docker Desktop or OrbStack) is running and has finished starting, then retry. A first-ever start also has images to download, and that can genuinely take longer.',
      detail
    }

  if (/Cannot locate the fabric repository/i.test(detail))
    return {
      cause: 'repository-not-found',
      title: 'Fabric cannot find its own repository, which holds the local stack’s configuration.',
      remedy:
        'Set FABRIC_REPO to a checkout of the Fabric repository, then open Fabric again. Fabric installed from its DMG carries its own stack and needs no checkout.',
      detail
    }

  if (/Command failed: \S*supabase start/.test(detail))
    return {
      cause: 'stack-would-not-start',
      title: 'The local stack refused to start.',
      remedy:
        'The stack’s own words are below and they are usually specific. If they mention Docker, start Docker (Docker Desktop or OrbStack) and retry; if a port is taken, `supabase stop` releases it.',
      detail
    }

  if (/did not yield API_URL/i.test(detail))
    return {
      cause: 'stack-up-but-silent',
      title: 'The local stack is running but did not report its connection details.',
      remedy:
        'Run `supabase stop` and open Fabric again — it will start the stack cleanly. A half-started stack answers `status` without the keys Fabric needs.',
      detail
    }

  if (/PGRST205/.test(detail) || /Could not find the table/i.test(detail))
    return {
      cause: 'schema-missing',
      title: 'The database is running, but Fabric’s tables are not there.',
      remedy:
        'The migrations have never been applied to this database. Run `supabase migration up --local` in Fabric’s stack folder ({stackFolder} for the installed app, the repository when running from source), then retry. Saying “the database failed” would send you to the wrong place: it is answering, it is simply empty.',
      detail
    }

  // Found by DRIVING the path rather than reading it: a stack stopped since the
  // app last worked produces `estates read failed: TypeError: fetch failed`,
  // which landed in "unknown" — a poor answer to the commonest failure there is.
  // Checked LAST of the specific cases: `Command failed: supabase start` can
  // also mention a refused connection, and that one has a better answer above.
  if (code === 'ECONNREFUSED' || /fetch failed/i.test(detail) || /ECONNREFUSED/.test(detail))
    return {
      cause: 'database-unreachable',
      title: 'The database is not answering at the address Fabric was given.',
      remedy:
        'The local stack is most likely stopped. Run `supabase start` in Fabric’s stack folder ({stackFolder} for the installed app, the repository when running from source) and retry. If SUPABASE_URL is set in this environment, check that it points at a stack that is actually running — an explicit address is used as given and is never second-guessed.',
      detail
    }

  return {
    cause: 'unknown',
    title: 'Fabric could not start, and could not work out why.',
    remedy:
      'The machine’s own words are below. Copy them — an unrecognised failure is worth reporting, and a guessed remedy that does not help costs more than an honest “we do not know”.',
    detail
  }
}

// #region audit-038-disk — docs: docs/evidence/plans/2026-10-21-release-038-verification.md#the-audit-that-opened-this-release
/** Below this much free space on the volume that holds Fabric's data folder, a stack failure names the disk as the
 *  likely cause. Decimal, as the dialog says it: "under 3 GB" means under 3 000 000 000 bytes (0.3.8 review UX-3). */
export const LOW_DISK_BYTES = 3e9

/** Free space as people read it: decimal GB, one digit, in the reader's locale («0,7» in Russian). The dialog, the
 *  copied details and the log all say it through this, so the same reading is the same number (0.3.8 review UX-4). */
export function freeDiskGb(bytes: number, locale?: string): string {
  // Rounded down to a tenth, so a disk under 3 GB never reads "3.0" (0.3.8 review i3 UX-2).
  return (Math.floor(Math.max(0, bytes) / 1e8) / 10).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** The causes a full disk explains: the stack would not start, started silent, timed out, its database went away, or
 *  an unclassified failure (Fabric's own ENOSPC lands there; 0.3.8 review ER-3). */
const DISK_CAUSES: ReadonlySet<StartupCause> = new Set(['stack-would-not-start', 'stack-up-but-silent', 'stack-start-timed-out', 'database-unreachable', 'unknown'])

/** The disk line's key for the platform and its number in the reader's locale (`freeDiskGb`). Null when there is room, when the free space could not be read, or for another cause. */
export function diskLowLine(failure: Pick<StartupFailure, 'cause'>, opts: { freeDiskBytes?: number | null; platform?: string; locale?: string }): { key: string; free: string } | null {
  if (typeof opts.freeDiskBytes !== 'number' || !(opts.freeDiskBytes < LOW_DISK_BYTES) || !DISK_CAUSES.has(failure.cause)) return null
  const platform = opts.platform ?? (typeof process === 'undefined' ? 'darwin' : process.platform)
  const key = platform === 'win32' ? 'startup.diskLow.win32' : platform === 'linux' ? 'startup.diskLow.linux' : 'startup.diskLow'
  return { key, free: freeDiskGb(opts.freeDiskBytes, opts.locale) }
}
// #endregion audit-038-disk

export interface StartupDialog {
  message: string
  detail: string
  buttons: string[]
  /** What each button DOES, index for index with `buttons` — the main process acts on this, never on a
   *  label, so a translated "Повторить" retries exactly as "Retry" did. */
  actions: StartupAction[]
  defaultId: number
}

export type StartupAction = 'retry' | 'copy' | 'quit'

/** The registry's words for the dialog. Optional so the shape stays testable with no registry: absent, the
 *  dialog speaks the English this module has always spoken. A key the registry does not hold answers with
 *  the key itself — the translator's rule — so a cause's own sentences are used instead (below). */
export type StartupSay = (key: string, vars?: Record<string, string | number>) => string

const ENGLISH: Record<string, string> = {
  'startup.notRetryable': 'Fabric had already opened its agent surface when this happened, so retrying in place is not safe; reopen the app instead.',
  'startup.machineSaid': 'What the machine said:',
  'startup.copyAt': 'A copy of this is at:',
  'startup.diskLow': 'This disk has {free} GB free. Docker (OrbStack or Docker Desktop) stops when the disk runs out, and then the local stack cannot start: free some space first.',
  'startup.diskLow.win32': 'This disk has {free} GB free. Docker Desktop stops when the disk runs out, and then the local stack cannot start: free some space first.',
  'startup.diskLow.linux': 'This disk has {free} GB free. Docker Engine stops when the disk runs out, and then the local stack cannot start: free some space first.',
  'startup.retry': 'Retry',
  'startup.copy': 'Copy the details',
  'startup.quit': 'Quit'
}

/**
 * The dialog's SHAPE, decided here so it can be read and tested without
 * Electron. The main process only hands it to `dialog.showMessageBox`.
 *
 * `retryable` is OBSERVED, never inferred from the error. Bootstrap sets it as
 * it crosses the point where retrying stops being safe — after the agent
 * surface is listening, a second attempt opens a second listener and registers
 * every IPC handler twice. A failure we cannot place is a failure we must not
 * offer to repeat.
 */
export function startupDialog(
  failure: StartupFailure,
  opts: { retryable: boolean; logPath: string; say?: StartupSay; platform?: string; freeDiskBytes?: number | null; locale?: string }
): StartupDialog {
  const vars = { stackFolder: stackFolderFor(opts.platform ?? (typeof process === 'undefined' ? 'darwin' : process.platform)) }
  const say = (key: string, v?: Record<string, string | number>): string => {
    const said = opts.say?.(key, v)
    const text = said !== undefined && said !== key ? said : (ENGLISH[key] ?? key)
    return v ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m)) : text
  }
  // The cause's own title and remedy in the operator's language when the registry has them; the copied
  // details and the log keep the English, which is what a report is read in.
  const own = (part: 'title' | 'remedy'): string => {
    if (part === 'remedy' && failure.remedyKey) {
      const said = opts.say?.(failure.remedyKey, { ...vars, ...failure.vars })
      if (said !== undefined && said !== failure.remedyKey) return said
    }
    const key = `startup.${failure.cause}.${part}`
    const said = opts.say?.(key, vars)
    return said !== undefined && said !== key ? said : failure[part]
  }
  const parts = [own('remedy')]
  // A full disk is the cause the stack's own words never name: OrbStack's VM stops with «I/O error» and the
  // stack then reports a missing Docker socket (the 0.3.8 audit of 2026-10-21; three times on 2026-10-20). On a low disk
  // it is said FIRST, before «start Docker and retry», which would not help.
  const low = diskLowLine(failure, opts)
  if (low) parts.unshift(say(low.key, { free: low.free }))
  if (!opts.retryable) parts.push(say('startup.notRetryable'))
  parts.push(`${say('startup.machineSaid')}\n${failure.detail}`)
  parts.push(`${say('startup.copyAt')}\n${opts.logPath}`)

  const actions: StartupAction[] = opts.retryable ? ['retry', 'copy', 'quit'] : ['copy', 'quit']
  const buttons = actions.map((a) => say(`startup.${a}`))
  return {
    message: own('title'),
    detail: parts.join('\n\n'),
    buttons,
    actions,
    // Retry when it is safe; otherwise Quit — never "Copy", which would make
    // the Return key do nothing an operator was asking for.
    defaultId: opts.retryable ? 0 : buttons.length - 1
  }
}

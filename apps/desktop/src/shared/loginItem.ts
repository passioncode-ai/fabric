// #region login-item — docs: AGENTS.md#lifecycle
/**
 * Launch at login (CO-322, the operator 2026-10-16: on by default, the person can turn it off in Settings), and since
 * 0.3.18 the board's service (ADR-0192, the operator 2026-11-08: the board the agents talk through exists whatever
 * happens to the window). What the system is asked to register, by platform: macOS 13+ registers a launch agent from
 * the property list the bundle ships (`agentService`, `BOARD_SERVICE`), which launchd starts at login without a window
 * and again after an abnormal end; Windows starts the app with `--background`. Linux has no login item Fabric
 * registers, and a development build never registers one.
 */
export type LoginItem =
  | { openAtLogin: boolean; type: 'agentService'; serviceName: string }
  | { openAtLogin: boolean; type: 'mainAppService' }
  | { openAtLogin: boolean; args: string[] }

/** The launch agent's property list in `Contents/Library/LaunchAgents` (`build/launchd/`, shipped by electron-builder). */
export const BOARD_SERVICE = 'ai.passioncode.desktop.board.plist'

export function loginItemFor(enabled: boolean, platform: string, packaged: boolean): LoginItem | null {
  if (!packaged) return null
  if (platform === 'darwin') return { openAtLogin: enabled, type: 'agentService', serviceName: BOARD_SERVICE }
  if (platform === 'win32') return { openAtLogin: enabled, args: ['--background'] }
  return null
}

/** What `app.getLoginItemSettings` is asked, so the system's answer is about the item `loginItemFor` registers. */
export function loginItemQuery(platform: string): { type: 'agentService'; serviceName: string } | { args: string[] } | undefined {
  if (platform === 'darwin') return { type: 'agentService', serviceName: BOARD_SERVICE }
  if (platform === 'win32') return { args: ['--background'] }
  return undefined
}

/** The login item 0.3.17 and earlier registered on macOS (`mainAppService`); null where there is none to remove. */
export function legacyLoginItem(platform: string, packaged: boolean): { openAtLogin: false; type: 'mainAppService' } | null {
  return packaged && platform === 'darwin' ? { openAtLogin: false, type: 'mainAppService' } : null
}

/**
 * ADR-0192, the 0.3.18 review PL-5, ER-3: what to do with 0.3.17's login item once the board's service was asked for.
 * It goes when the person turned launch at login off, or once macOS reads the agent service back as enabled; while the
 * service is not running (`requires-approval`, `not-found`, an unreadable status) the old item stays, so a Mac that
 * cannot start the service still starts Fabric at login as 0.3.17 did.
 */
export function legacyLoginItemAction(enabled: boolean, agent: LoginItemSystem): 'remove' | 'keep' {
  return !enabled || agent === 'on' ? 'remove' : 'keep'
}

/** The launch agent's job label: the property list's `Label`, its file name without `.plist`. */
export const BOARD_LABEL = BOARD_SERVICE.replace(/\.plist$/, '')

/**
 * Whether launchd started this process as the board's job. launchd sets `XPC_SERVICE_NAME` to the job's `Label` in the
 * environment of every job it starts (measured 2026-11-09: `ps eww` of a running launch agent printed
 * `XPC_SERVICE_NAME=<its Label>`); an app opened from the Finder or
 * the Dock carries LaunchServices' own name, and a terminal start none or `0`.
 */
export function launchdStarted(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.XPC_SERVICE_NAME === BOARD_LABEL
}

/**
 * The 0.3.18 review, iteration 2, PL-21, ER-16: reads once, at start, whether launchd started this process as the
 * board's job, and removes the job's label from the environment, so no terminal, coding agent, helper or relaunch this
 * process starts inherits it and takes itself for launchd's copy. Another job's name is left as it is.
 */
export function takeLaunchdStart(env: Record<string, string | undefined>): boolean {
  const started = launchdStarted(env)
  if (started) delete env.XPC_SERVICE_NAME
  return started
}

/** EX_TEMPFAIL (sysexits.h): the board's job lost the single-instance lock and should be tried again later. */
export const LAUNCHD_RETRY_EXIT = 75

/**
 * The 0.3.18 review PL-6: how a process that lost the single-instance lock ends. launchd's own copy (`takeLaunchdStart`)
 * ends with `LAUNCHD_RETRY_EXIT`, so `KeepAlive {SuccessfulExit: false}` tries again (once a minute, the plist's
 * `ThrottleInterval`) and takes over the board when the copy the person opened ends; any other loser ends cleanly.
 */
export function secondInstanceExitCode(launchd: boolean): number {
  return launchd ? LAUNCHD_RETRY_EXIT : 0
}

/**
 * The 0.3.18 review ER-6: whether another start of Fabric should show the running one's window. A `--background` start
 * (launchd's copy trying again, the lifecycle broker) asks for no window, so it never raises one.
 */
export function secondInstanceShows(argv: readonly string[]): boolean {
  return !argv.includes('--background')
}

/**
 * The 0.3.18 review PL-4: only the Fabric that runs on the operator's own data folder owns the machine-wide board
 * service. A start with its own folder (`--user-data-dir` in any spelling Chromium reads: `--`, `-` or, on Windows,
 * `/`, with `=value` or a separate value) or a smoke run never registers, removes or holds for it.
 */
export function ownsBoardService(argv: readonly string[], env: Readonly<Record<string, string | undefined>>): boolean {
  if (env.SMOKE) return false
  return !argv.some((a) => /^(?:--?|\/)user-data-dir(?:=|$)/i.test(a))
}

/**
 * ADR-0192: whether a quit only hides Fabric, so the board, the hub and the terminals keep running. True only for the
 * Fabric that owns the service (`ownsBoardService`), on an installed macOS build, while the person's switch is on AND
 * macOS reads the agent service back as enabled (the 0.3.18 review PL-5, ER-2: the system's state, not the wish), once
 * the start has finished. Never for a quit the system or Fabric itself asks for: logout, restart and shutdown, a signal
 * (SIGTERM, SIGHUP: the lifecycle broker, `launchctl`, `kill`; the review's PL-3), «Перезапустить Fabric», or the Quit
 * of a start that failed (the review's ER-4). Each of those still ends the process within LC-01's deadline.
 */
export function quitHolds(o: {
  serviceOn: boolean
  systemOn: boolean
  ownsService: boolean
  platform: string
  packaged: boolean
  systemEnding: boolean
  signalled: boolean
  restarting: boolean
  started: boolean
  startFailed: boolean
}): boolean {
  if (!o.serviceOn || !o.systemOn || !o.ownsService || !o.packaged || o.platform !== 'darwin') return false
  return !o.systemEnding && !o.signalled && !o.restarting && o.started && !o.startFailed
}

/** The app's own bundle id (`electron-builder.yml` `appId`): what the restart opens when launchd refuses its job. */
export const APP_BUNDLE_ID = 'ai.passioncode.desktop'

/**
 * The 0.3.18 review UX-3: how «Перезапустить Fabric» starts Fabric again. Where launchd keeps the board's service (the
 * owner, an installed macOS build, the service on and enabled), a detached shell waits for this process to end and asks
 * launchd to start the job (`launchctl kickstart`), so the new process is the service's; anywhere else Electron's own
 * relaunch, without `--background`, so the window comes back. Iteration 2, ER-15: when launchd refuses the job (it is
 * disabled, or not loaded in this session) the shell opens the app by its id instead, so Fabric comes back either way,
 * and writes each refusal as one line (`kickstart <code>`, `open <code>`, `waited` when this process had not ended in
 * time) to `outcomeFile`, which the next start records. The values travel as the script's arguments, never inside it.
 */
export function restartPlan(o: { platform: string; packaged: boolean; ownsService: boolean; serviceOn: boolean; systemOn: boolean; pid: number; outcomeFile: string }):
  | { kind: 'launchd'; command: string; args: string[] }
  | { kind: 'relaunch' } {
  if (o.platform === 'darwin' && o.packaged && o.ownsService && o.serviceOn && o.systemOn) {
    // At most 30 s of waiting: past the quit's own 15 s outside guard, so the job is never asked while this one runs.
    const script = [
      'i=0; while kill -0 "$1" 2>/dev/null && [ $i -lt 150 ]; do sleep 0.2; i=$((i+1)); done',
      'if kill -0 "$1" 2>/dev/null; then echo waited >> "$2"; fi',
      'launchctl kickstart "gui/$(id -u)/$3"; rc=$?',
      'if [ $rc -ne 0 ]; then echo "kickstart $rc" >> "$2"; open -b "$4"; rc=$?; if [ $rc -ne 0 ]; then echo "open $rc" >> "$2"; fi; fi'
    ].join('\n')
    return { kind: 'launchd', command: '/bin/sh', args: ['-c', script, 'fabric-restart', String(o.pid), o.outcomeFile, BOARD_LABEL, APP_BUNDLE_ID] }
  }
  return { kind: 'relaunch' }
}

/**
 * The 0.3.18 review, iteration 2, UX-12, DO-14: how a reason an agent relays tells the person to restart Fabric. With the
 * board's service on, Quit only hides Fabric, so «quit and reopen» restarts nothing; the advice names the menu item.
 */
export const RESTART_ITEM_ADVICE = 'choose “Restart Fabric” in Fabric’s menu'

/** The arguments a relaunch passes: this start's, without `--background`, so the person who asked sees the window. */
export function relaunchArgs(argv: readonly string[]): string[] {
  return argv.slice(1).filter((a) => a !== '--background')
}

/** How long a restart's request for a window stands: a start later than this is not the restart's. */
export const RESTART_WINDOW_MS = 120_000

/** Whether this start is the one a restart asked for, so it shows its window though launchd starts it in the background. */
export function restartShowsWindow(askedAt: number | null, now: number): boolean {
  return askedAt !== null && now >= askedAt && now - askedAt <= RESTART_WINDOW_MS
}

/**
 * What Settings may say about launch at login (0.3.7 review UX-3, ER-3, DO-6). `supported: false` where Fabric
 * registers nothing (Linux, a development build), so the row is not drawn there. Where it is drawn, `system` is
 * what the system itself reports, not the stored wish: on macOS SMAppService's status (`requires-approval` when the
 * person must allow Fabric in Login Items, `not-registered` when they turned it off there), on Windows whether the
 * Run entry will start at login (a person can disable it in Startup apps). A read that throws is `unknown`.
 */
export type LoginItemSystem = 'on' | 'off' | 'needs-approval' | 'unknown'
export type LoginItemState =
  | { supported: false }
  | {
      supported: true
      platform: 'darwin' | 'win32'
      system: LoginItemSystem
      /** macOS only, for Settings (the 0.3.18 review, iteration 2, UX-14): 0.3.17's login item is still registered, so
       *  Fabric starts at login as before while the service does not run. Absent where it was not read. */
      legacy?: boolean
    }
export type LoginItemReading = { status?: string; executableWillLaunchAtLogin?: boolean }

export function loginItemState(platform: string, packaged: boolean, read: () => LoginItemReading): LoginItemState {
  if (loginItemFor(true, platform, packaged) === null) return { supported: false }
  const os = platform === 'win32' ? 'win32' : 'darwin'
  let system: LoginItemSystem = 'unknown'
  try {
    const r = read()
    if (os === 'darwin')
      system = r.status === 'enabled' ? 'on' : r.status === 'requires-approval' ? 'needs-approval' : r.status === 'not-registered' || r.status === 'not-found' ? 'off' : 'unknown'
    else system = typeof r.executableWillLaunchAtLogin === 'boolean' ? (r.executableWillLaunchAtLogin ? 'on' : 'off') : 'unknown'
  } catch {
    system = 'unknown'
  }
  return { supported: true, platform: os, system }
}

/** A start with no window: the lifecycle broker's `--background`, or the system opening Fabric at login. */
export function startsInBackground(argv: readonly string[], openedAtLogin: boolean): boolean {
  return argv.includes('--background') || openedAtLogin
}
/**
 * CO-365: what a start records about itself, so a reboot can be checked in the operations log: the version, whether
 * the system opened it at login (`'unknown'` where the platform cannot tell, never false), and whether it starts in
 * the background.
 */
export function startRecord(argv: readonly string[], openedAtLogin: boolean | null, version: string): { version: string; atLogin: boolean | 'unknown'; background: boolean } {
  return { version, atLogin: openedAtLogin ?? 'unknown', background: startsInBackground(argv, openedAtLogin === true) }
}
// #endregion login-item

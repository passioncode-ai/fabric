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

/** The login item 0.3.17 and earlier registered on macOS (`mainAppService`), removed once the service is registered so
 *  login does not start Fabric twice; null where there is none to remove. */
export function legacyLoginItem(platform: string, packaged: boolean): { openAtLogin: false; type: 'mainAppService' } | null {
  return packaged && platform === 'darwin' ? { openAtLogin: false, type: 'mainAppService' } : null
}

/**
 * ADR-0192: whether a quit the person asked for only hides Fabric, so the board, the hub and the terminals keep running.
 * True only where launchd keeps the service (an installed macOS build) while the switch is on, and never while the
 * system itself is ending (logout, restart, shutdown), which still ends the process within LC-01's deadline.
 */
export function quitHolds(o: { serviceOn: boolean; platform: string; packaged: boolean; systemEnding: boolean }): boolean {
  return o.serviceOn && o.packaged && o.platform === 'darwin' && !o.systemEnding
}

/**
 * What Settings may say about launch at login (0.3.7 review UX-3, ER-3, DO-6). `supported: false` where Fabric
 * registers nothing (Linux, a development build), so the row is not drawn there. Where it is drawn, `system` is
 * what the system itself reports, not the stored wish: on macOS SMAppService's status (`requires-approval` when the
 * person must allow Fabric in Login Items, `not-registered` when they turned it off there), on Windows whether the
 * Run entry will start at login (a person can disable it in Startup apps). A read that throws is `unknown`.
 */
export type LoginItemSystem = 'on' | 'off' | 'needs-approval' | 'unknown'
export type LoginItemState = { supported: false } | { supported: true; platform: 'darwin' | 'win32'; system: LoginItemSystem }
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

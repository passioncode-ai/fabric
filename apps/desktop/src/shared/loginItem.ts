// #region login-item — docs: AGENTS.md#lifecycle
/**
 * Launch at login (CO-322, the operator 2026-10-16: on by default, the person can turn it off in Settings). What the
 * system is asked to register, by platform: macOS 13+ registers the app itself as a login item (`mainAppService`) and
 * says on the next start that it opened it (`wasOpenedAtLogin`); Windows starts it with `--background`. Linux has no
 * login item Fabric registers, and a development build never registers one.
 */
export type LoginItem = { openAtLogin: boolean; type: 'mainAppService' } | { openAtLogin: boolean; args: string[] }

export function loginItemFor(enabled: boolean, platform: string, packaged: boolean): LoginItem | null {
  if (!packaged) return null
  if (platform === 'darwin') return { openAtLogin: enabled, type: 'mainAppService' }
  if (platform === 'win32') return { openAtLogin: enabled, args: ['--background'] }
  return null
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
// #endregion login-item

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

/** A start with no window: the lifecycle broker's `--background`, or the system opening Fabric at login. */
export function startsInBackground(argv: readonly string[], openedAtLogin: boolean): boolean {
  return argv.includes('--background') || openedAtLogin
}
// #endregion login-item

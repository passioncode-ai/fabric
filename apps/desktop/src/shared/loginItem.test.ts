// CO-322 (the operator, 2026-10-16): Fabric starts at login by default, quietly, and the person can turn it off.
import { describe, expect, it } from 'vitest'
import { BOARD_LABEL, BOARD_SERVICE, LAUNCHD_RETRY_EXIT, RESTART_WINDOW_MS, launchdStarted, legacyLoginItem, legacyLoginItemAction, loginItemFor, loginItemQuery, loginItemState, ownsBoardService, quitHolds, relaunchArgs, restartPlan, restartShowsWindow, secondInstanceExitCode, secondInstanceShows, startRecord, startsInBackground, takeLaunchdStart, type LoginItemState } from './loginItem'

describe('launch at login', () => {
  it('registers the packaged app with the system, on by default and off when the person says so', () => {
    expect(loginItemFor(true, 'darwin', true)).toEqual({ openAtLogin: true, type: 'agentService', serviceName: BOARD_SERVICE })
    expect(loginItemFor(false, 'darwin', true)).toEqual({ openAtLogin: false, type: 'agentService', serviceName: BOARD_SERVICE })
    expect(loginItemFor(true, 'win32', true)).toEqual({ openAtLogin: true, args: ['--background'] })
  })
  it('never registers a development build, and has no login item on Linux', () => {
    expect(loginItemFor(true, 'darwin', false)).toBeNull()
    expect(loginItemFor(true, 'linux', true)).toBeNull()
  })
  it('starts without a window when the lifecycle broker asks or the system opened it at login', () => {
    expect(startsInBackground(['Fabric', '--background'], false)).toBe(true)
    expect(startsInBackground(['Fabric'], true)).toBe(true)
    expect(startsInBackground(['Fabric'], false)).toBe(false)
  })
})

const systemOf = (s: LoginItemState): string | null => (s.supported ? s.system : null)

describe('what Settings says about launch at login (0.3.7 review UX-3, ER-3)', () => {
  it('is not offered where Fabric registers nothing: Linux and a development build', () => {
    expect(loginItemState('linux', true, () => ({}))).toEqual({ supported: false })
    expect(loginItemState('darwin', false, () => ({ status: 'enabled' }))).toEqual({ supported: false })
    expect(loginItemState('win32', false, () => ({ executableWillLaunchAtLogin: true }))).toEqual({ supported: false })
  })
  it('reports macOS\'s own status, not the stored wish', () => {
    expect(loginItemState('darwin', true, () => ({ status: 'enabled' }))).toEqual({ supported: true, platform: 'darwin', system: 'on' })
    expect(systemOf(loginItemState('darwin', true, () => ({ status: 'requires-approval' })))).toBe('needs-approval')
    expect(systemOf(loginItemState('darwin', true, () => ({ status: 'not-registered' })))).toBe('off')
    expect(systemOf(loginItemState('darwin', true, () => ({ status: 'not-found' })))).toBe('off')
  })
  it('reports whether Windows will run the entry, which Startup apps can disable', () => {
    expect(loginItemState('win32', true, () => ({ executableWillLaunchAtLogin: true }))).toEqual({ supported: true, platform: 'win32', system: 'on' })
    expect(systemOf(loginItemState('win32', true, () => ({ executableWillLaunchAtLogin: false })))).toBe('off')
  })
  it('says unknown when the system cannot be read, rather than guessing', () => {
    expect(systemOf(loginItemState('darwin', true, () => { throw new Error('denied') }))).toBe('unknown')
    expect(systemOf(loginItemState('win32', true, () => ({})))).toBe('unknown')
  })
})

describe('CO-365: every start says how it was started, so a reboot can be checked in the operations log', () => {
  it('names a start the system opened at login, a background start and an ordinary one', () => {
    expect(startRecord(['Fabric'], true, '0.3.16')).toEqual({ version: '0.3.16', atLogin: true, background: true })
    expect(startRecord(['Fabric', '--background'], false, '0.3.16')).toEqual({ version: '0.3.16', atLogin: false, background: true })
    expect(startRecord(['Fabric'], false, '0.3.16')).toEqual({ version: '0.3.16', atLogin: false, background: false })
  })
  it('a platform that cannot tell says unknown, never false', () => {
    expect(startRecord(['Fabric'], null, '0.3.16')).toEqual({ version: '0.3.16', atLogin: 'unknown', background: false })
  })
})

describe('ADR-0192: the board is a service launchd keeps', () => {
  it('names the property list the bundle ships, and reads the system about that same service', () => {
    expect(BOARD_SERVICE).toBe('ai.passioncode.desktop.board.plist')
    expect(loginItemQuery('darwin')).toEqual({ type: 'agentService', serviceName: BOARD_SERVICE })
    expect(loginItemQuery('win32')).toEqual({ args: ['--background'] })
    expect(loginItemQuery('linux')).toBeUndefined()
  })
  it('removes the old login item once on macOS, so login does not start Fabric twice', () => {
    expect(legacyLoginItem('darwin', true)).toEqual({ openAtLogin: false, type: 'mainAppService' })
    expect(legacyLoginItem('darwin', false)).toBeNull()
    expect(legacyLoginItem('win32', true)).toBeNull()
    expect(legacyLoginItem('linux', true)).toBeNull()
  })
  it('a quit the person asks for only hides while the service is on, on an installed macOS build', () => {
    const on = { serviceOn: true, systemOn: true, ownsService: true, platform: 'darwin', packaged: true, systemEnding: false, signalled: false, restarting: false, started: true, startFailed: false }
    expect(quitHolds(on)).toBe(true)
    expect(quitHolds({ ...on, serviceOn: false })).toBe(false)
    expect(quitHolds({ ...on, systemEnding: true })).toBe(false)
    expect(quitHolds({ ...on, packaged: false })).toBe(false)
    expect(quitHolds({ ...on, platform: 'win32' })).toBe(false)
    expect(quitHolds({ ...on, platform: 'linux' })).toBe(false)
  })
})

const held = { serviceOn: true, systemOn: true, ownsService: true, platform: 'darwin', packaged: true, systemEnding: false, signalled: false, restarting: false, started: true, startFailed: false }

describe('the 0.3.18 review, iteration 1: what a quit does', () => {
  it('PL-3: a signal (SIGTERM, SIGHUP) always ends Fabric, even while the service holds the person\'s Quit', () => {
    expect(quitHolds(held)).toBe(true)
    expect(quitHolds({ ...held, signalled: true })).toBe(false)
  })
  it('PL-5, ER-2: a quit hides only while macOS reads the service back as enabled, not on the stored wish alone', () => {
    expect(quitHolds({ ...held, systemOn: false })).toBe(false)
  })
  it('PL-4: a Fabric on another data folder, or a smoke run, never holds for the operator\'s service', () => {
    expect(quitHolds({ ...held, ownsService: false })).toBe(false)
  })
  it('ER-4: the Quit of a start that failed, or of a start not finished, ends the process', () => {
    expect(quitHolds({ ...held, startFailed: true })).toBe(false)
    expect(quitHolds({ ...held, started: false })).toBe(false)
  })
  it('UX-3: «Перезапустить Fabric» ends this process whatever the service says', () => {
    expect(quitHolds({ ...held, restarting: true })).toBe(false)
  })
})

describe('the 0.3.18 review, iteration 1: who owns the service', () => {
  it('PL-4: the operator\'s own Fabric owns it; a start with its own data folder or a smoke run does not', () => {
    expect(ownsBoardService(['Fabric'], {})).toBe(true)
    expect(ownsBoardService(['Fabric', '--background'], {})).toBe(true)
    expect(ownsBoardService(['Fabric', '--user-data-dir=/tmp/x'], {})).toBe(false)
    expect(ownsBoardService(['Fabric', '--user-data-dir', '/tmp/x'], {})).toBe(false)
    expect(ownsBoardService(['Fabric', '-user-data-dir=/tmp/x'], {})).toBe(false)
    expect(ownsBoardService(['Fabric.exe', '/user-data-dir=C:\\x'], {})).toBe(false)
    expect(ownsBoardService(['Fabric'], { SMOKE: '1' })).toBe(false)
    expect(ownsBoardService(['Fabric', '--user-data-direction'], {})).toBe(true)
  })
  it('PL-5, ER-3: 0.3.17\'s login item goes only once the service reads back enabled, or when the person turned it off', () => {
    expect(legacyLoginItemAction(true, 'on')).toBe('remove')
    expect(legacyLoginItemAction(false, 'off')).toBe('remove')
    expect(legacyLoginItemAction(true, 'needs-approval')).toBe('keep')
    expect(legacyLoginItemAction(true, 'off')).toBe('keep')
    expect(legacyLoginItemAction(true, 'unknown')).toBe('keep')
  })
})

describe('the 0.3.18 review, iteration 1: launchd\'s copy', () => {
  it('B4: is told by the job label launchd puts in XPC_SERVICE_NAME', () => {
    expect(BOARD_LABEL).toBe('ai.passioncode.desktop.board')
    expect(launchdStarted({ XPC_SERVICE_NAME: 'ai.passioncode.desktop.board' })).toBe(true)
    expect(launchdStarted({ XPC_SERVICE_NAME: 'application.ai.passioncode.desktop.1.2' })).toBe(false)
    expect(launchdStarted({ XPC_SERVICE_NAME: '0' })).toBe(false)
    expect(launchdStarted({})).toBe(false)
  })
  it('PL-6: launchd\'s copy that loses the lock ends non-zero, so KeepAlive tries again; any other loser ends cleanly', () => {
    expect(LAUNCHD_RETRY_EXIT).toBe(75)
    expect(secondInstanceExitCode(true)).toBe(75)
    expect(secondInstanceExitCode(false)).toBe(0)
  })
  it('ER-6: a background start of another copy never raises the running window; a person\'s open does', () => {
    expect(secondInstanceShows(['Fabric', '--background'])).toBe(false)
    expect(secondInstanceShows(['Fabric'])).toBe(true)
  })
})

describe('the 0.3.18 review, iteration 2, PL-21, ER-16: the job label stays with the process launchd started', () => {
  it('is read once at start and removed, so no terminal, agent or relaunch inherits it', () => {
    const env: Record<string, string | undefined> = { XPC_SERVICE_NAME: BOARD_LABEL, HOME: '/h' }
    expect(takeLaunchdStart(env)).toBe(true)
    expect(env).toEqual({ HOME: '/h' })
    expect(launchdStarted(env)).toBe(false)
    expect(takeLaunchdStart(env)).toBe(false)
  })
  it('leaves another job\'s name as it is, and a start without one is not launchd\'s', () => {
    const env: Record<string, string | undefined> = { XPC_SERVICE_NAME: 'application.ai.passioncode.desktop.1.2' }
    expect(takeLaunchdStart(env)).toBe(false)
    expect(env.XPC_SERVICE_NAME).toBe('application.ai.passioncode.desktop.1.2')
    expect(takeLaunchdStart({})).toBe(false)
  })
})

describe('the 0.3.18 review, iteration 1, UX-3: «Перезапустить Fabric»', () => {
  const service = { platform: 'darwin', packaged: true, ownsService: true, serviceOn: true, systemOn: true, pid: 4242 }
  it('with the service on, asks launchd to start the job once this process has ended', () => {
    const plan = restartPlan(service)
    expect(plan.kind).toBe('launchd')
    if (plan.kind !== 'launchd') return
    expect(plan.command).toBe('/bin/sh')
    expect(plan.args[0]).toBe('-c')
    expect(plan.args[1]).toContain('kill -0 4242')
    expect(plan.args[1]).toMatch(/launchctl kickstart gui\/\$\(id -u\)\/ai\.passioncode\.desktop\.board$/)
  })
  it('anywhere else relaunches the app itself', () => {
    expect(restartPlan({ ...service, serviceOn: false }).kind).toBe('relaunch')
    expect(restartPlan({ ...service, systemOn: false }).kind).toBe('relaunch')
    expect(restartPlan({ ...service, ownsService: false }).kind).toBe('relaunch')
    expect(restartPlan({ ...service, packaged: false }).kind).toBe('relaunch')
    expect(restartPlan({ ...service, platform: 'win32' }).kind).toBe('relaunch')
  })
  it('a relaunch drops --background, so the person who asked sees the window', () => {
    expect(relaunchArgs(['/Applications/Fabric.app/Contents/MacOS/Fabric', '--background', '--x'])).toEqual(['--x'])
  })
  it('the start a restart asked for shows its window; an old request does not', () => {
    expect(restartShowsWindow(1000, 1000 + RESTART_WINDOW_MS)).toBe(true)
    expect(restartShowsWindow(1000, 1001 + RESTART_WINDOW_MS)).toBe(false)
    expect(restartShowsWindow(null, 1000)).toBe(false)
    expect(restartShowsWindow(2000, 1000)).toBe(false)
  })

})

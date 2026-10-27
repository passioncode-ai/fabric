// CO-322 (the operator, 2026-10-16): Fabric starts at login by default, quietly, and the person can turn it off.
import { describe, expect, it } from 'vitest'
import { loginItemFor, loginItemState, startRecord, startsInBackground, type LoginItemState } from './loginItem'

describe('launch at login', () => {
  it('registers the packaged app with the system, on by default and off when the person says so', () => {
    expect(loginItemFor(true, 'darwin', true)).toEqual({ openAtLogin: true, type: 'mainAppService' })
    expect(loginItemFor(false, 'darwin', true)).toEqual({ openAtLogin: false, type: 'mainAppService' })
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

// CO-322 (the operator, 2026-10-16): Fabric starts at login by default, quietly, and the person can turn it off.
import { describe, expect, it } from 'vitest'
import { loginItemFor, startsInBackground } from './loginItem'

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

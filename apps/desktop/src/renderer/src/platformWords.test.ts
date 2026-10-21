// 0.3.5 ships Windows and Linux (CO-238): a string the app shows on every platform says "this computer", never
// "this Mac". A surface that exists only on macOS may name the Mac; its key goes in MAC_ONLY with the reason.
import { describe, expect, it } from 'vitest'
import { en } from './i18n/en'
import { ru } from './i18n/ru'

/** Keys shown only on macOS, each with why. */
const MAC_ONLY: Record<string, string> = {
  'settings.launchAtLogin.offDarwin': 'the login-item status line SettingsScreen picks only when the platform is darwin (CO-322)',
  'settings.launchAtLogin.approval': 'needs-approval is a state only macOS reports (SMAppService); SettingsScreen shows it on darwin only',
}

describe('platform words', () => {
  for (const [name, table] of [['en', en], ['ru', ru]] as const) {
    it(`no ${name} string shown on every platform names the Mac`, () => {
      const offenders = Object.entries(table as Record<string, string>)
        .filter(([key, text]) => !(key in MAC_ONLY) && /\bMac\b|macOS/.test(text))
        .map(([key]) => key)
      expect(offenders).toEqual([])
    })
  }
})

// 0.3.8 UX-1 and 0.3.9 review UX-4: Docker on Windows is Docker Desktop and on Linux Docker Engine; OrbStack exists only
// on macOS. A string that names OrbStack has `.win32` and `.linux` variants that do not, or is listed here with why.
const ORBSTACK_ANYWHERE: Record<string, string> = {
  'diagnostics.exposure.orbstack': 'a heading of the OrbStack remedy, beside the Docker Desktop one: both are offered as options',
  'startup.stack-start-timed-out.remedy': 'pre-0.3.9 remedy that names the engines as alternatives; per-OS keys are a board row (0.3.9 stability notes, i1)',
  'startup.stack-would-not-start.remedy': 'pre-0.3.9 remedy that names the engines as alternatives; per-OS keys are a board row (0.3.9 stability notes, i1)',
}

describe('each platform names its own Docker', () => {
  for (const [name, table] of [['en', en], ['ru', ru]] as const) {
    it(`no ${name} string that names OrbStack is shown on Windows or Linux`, () => {
      const t = table as Record<string, string>
      const offenders = Object.entries(t)
        .filter(([key, text]) => /OrbStack/.test(text) && !(key in ORBSTACK_ANYWHERE) && !/\.(win32|linux)$/.test(key))
        .filter(([key]) => !(t[`${key}.win32`] && t[`${key}.linux`] && !/OrbStack/.test(t[`${key}.win32`] + t[`${key}.linux`])))
        .map(([key]) => key)
      expect(offenders).toEqual([])
    })
  }
})

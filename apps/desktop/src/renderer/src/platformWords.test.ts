// 0.3.5 ships Windows and Linux (CO-238): a string the app shows on every platform says "this computer", never
// "this Mac". A surface that exists only on macOS may name the Mac; its key goes in MAC_ONLY with the reason.
import { describe, expect, it } from 'vitest'
import { en } from './i18n/en'
import { ru } from './i18n/ru'

/** Keys shown only on macOS, each with why. Empty today: every Mac-worded string was cross-platform. */
const MAC_ONLY: Record<string, string> = {}

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

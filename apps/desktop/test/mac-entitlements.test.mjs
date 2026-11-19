// 0.3.24 review, UX-2: the release DMG must carry the microphone entitlement the CEO's voice call needs. The release
// config extends the base config and names its own entitlements file, which replaces the base's; under the hardened
// runtime macOS refuses the microphone without `com.apple.security.device.audio-input`. Read the configs as
// electron-builder merges them (the release's `mac` keys over the base's) and check what each build is signed with.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const here = path.join(import.meta.dirname, '..')

/** The `mac:` block's top-level `key: value` lines of an electron-builder YAML file (enough for these scalar keys). */
function macKeys(file) {
  const out = {}
  let inMac = false
  for (const line of readFileSync(path.join(here, file), 'utf8').split('\n')) {
    if (/^\S/.test(line)) inMac = /^mac:\s*$/.test(line)
    else if (inMac) {
      const m = /^ {2}([A-Za-z]+):\s*(\S.*)?$/.exec(line)
      if (m && m[2] !== undefined) out[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  }
  return out
}

const AUDIO = 'com.apple.security.device.audio-input'
const grants = (plist, key) => new RegExp(`<key>${key.replace(/\./g, '\\.')}</key>\\s*<true/>`).test(readFileSync(path.join(here, plist), 'utf8'))

test('UX-2: the merged release config signs the app with the audio-input entitlement, inherited by its helpers', () => {
  const base = macKeys('electron-builder.yml')
  const release = { ...base, ...macKeys('electron-builder.release.yml') }
  assert.equal(release.hardenedRuntime, 'true')
  assert.ok(release.entitlements, 'the release names its entitlements')
  assert.ok(grants(release.entitlements, AUDIO), `${release.entitlements} grants ${AUDIO}`)
  assert.ok(grants(release.entitlementsInherit, AUDIO), `${release.entitlementsInherit} grants ${AUDIO}`)
  // V8 still needs its JIT under the hardened runtime.
  assert.ok(grants(release.entitlements, 'com.apple.security.cs.allow-jit'))
})

test('UX-2: one entitlements file for the local and the release build, so they cannot drift', () => {
  const base = macKeys('electron-builder.yml')
  const release = { ...base, ...macKeys('electron-builder.release.yml') }
  assert.equal(base.entitlements, release.entitlements)
  assert.equal(base.entitlementsInherit, release.entitlementsInherit)
})

test('UX-2: macOS asks for the microphone with Fabric\'s own sentence', () => {
  assert.match(readFileSync(path.join(here, 'electron-builder.yml'), 'utf8'), /NSMicrophoneUsageDescription:\s*"[^"]+"/)
})

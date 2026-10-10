// The Windows and Linux packages' names, builder arguments and signing switch (0.3.5, CO-238, REQ-01, REQ-02).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { artifactNames, builderArgs, parsePlatformArgs, signingOptions } from '../lib/package-platform.mjs'

test('arguments: one platform and one architecture, nothing else', () => {
  assert.deepEqual(parsePlatformArgs(['--platform', 'win32', '--arch', 'arm64']), { platform: 'win32', arch: 'arm64' })
  assert.deepEqual(parsePlatformArgs(['--platform=linux', '--arch=x64']), { platform: 'linux', arch: 'x64' })
  assert.throws(() => parsePlatformArgs(['--platform', 'darwin', '--arch', 'x64']), /platform/, 'macOS has its own release script')
  assert.throws(() => parsePlatformArgs(['--platform', 'linux', '--arch', 'ia32']), /arch/)
  assert.throws(() => parsePlatformArgs(['--platform', 'linux']), /arch/)
  assert.throws(() => parsePlatformArgs(['--platform', 'linux', '--arch', 'x64', '--sign']), /unknown argument/)
})

test('artifact names carry our own architecture words, never the target tool\'s (amd64, x86_64)', () => {
  assert.deepEqual(artifactNames({ platform: 'win32', arch: 'x64', version: '0.3.5' }), ['Fabric-0.3.5-windows-x64-setup.exe'])
  assert.deepEqual(artifactNames({ platform: 'win32', arch: 'arm64', version: '0.3.5' }), ['Fabric-0.3.5-windows-arm64-setup.exe'])
  assert.deepEqual(artifactNames({ platform: 'linux', arch: 'x64', version: '0.3.5' }),
    ['Fabric-0.3.5-linux-x64.AppImage', 'Fabric-0.3.5-linux-x64.deb'])
  assert.throws(() => artifactNames({ platform: 'linux', arch: 'x64', version: '0.3' }), /version/)
})

test('signing: all three Azure settings, or none and NOT_SIGNED', () => {
  const env = { AZURE_SIGNING_ENDPOINT: 'https://neu.codesigning.azure.net/', AZURE_SIGNING_ACCOUNT: 'acct', AZURE_SIGNING_PROFILE: 'prof' }
  assert.deepEqual(signingOptions(env), { endpoint: 'https://neu.codesigning.azure.net/', codeSigningAccountName: 'acct', certificateProfileName: 'prof', publisherName: 'PassionCode' })
  assert.equal(signingOptions({}), null)
  assert.equal(signingOptions({ ...env, AZURE_SIGNING_PROFILE: '' }), null, 'a partial set is not signing')
})

test('builder arguments name the target, the artifacts and the signing, and publish nothing', () => {
  const win = builderArgs({ platform: 'win32', arch: 'arm64', version: '0.3.5', signing: null })
  assert.deepEqual(win.slice(0, 3), ['--win', '--arm64', '--publish'])
  assert.ok(win.includes('never'))
  assert.ok(win.includes('-c.nsis.artifactName=Fabric-0.3.5-windows-arm64-setup.${ext}'))
  assert.ok(!win.some(a => a.includes('azureSignOptions')))
  const signed = builderArgs({ platform: 'win32', arch: 'x64', version: '0.3.5', signing: signingOptions({ AZURE_SIGNING_ENDPOINT: 'e', AZURE_SIGNING_ACCOUNT: 'a', AZURE_SIGNING_PROFILE: 'p' }) })
  assert.ok(signed.includes('-c.win.azureSignOptions.endpoint=e'))
  assert.ok(signed.includes('-c.win.azureSignOptions.certificateProfileName=p'))
  const linux = builderArgs({ platform: 'linux', arch: 'x64', version: '0.3.5', signing: null })
  assert.deepEqual(linux.slice(0, 2), ['--linux', '--x64'])
  assert.ok(linux.includes('-c.appImage.artifactName=Fabric-0.3.5-linux-x64.AppImage'))
  assert.ok(linux.includes('-c.deb.artifactName=Fabric-0.3.5-linux-x64.deb'))
})

import { smokeVerdict } from '../lib/smoke-platform.mjs'
test('a smoke passes on SMOKE OK, or on the stack\'s own absence when only a start is expected (REQ-03)', () => {
  assert.equal(smokeVerdict({ output: 'SMOKE OK — estate=org #1', code: 0, expect: 'ok' }).pass, true)
  assert.equal(smokeVerdict({ output: 'SMOKE FAILED (supabase-cli-missing) — x', code: 1, expect: 'started' }).pass, true)
  assert.equal(smokeVerdict({ output: 'SMOKE FAILED (supabase-cli-missing) — x', code: 1, expect: 'ok' }).pass, false)
  assert.match(smokeVerdict({ output: 'SMOKE FAILED (identity-refused) — x', code: 1, expect: 'started' }).why, /not on the stack/)
  assert.match(smokeVerdict({ output: 'SMOKE FAILED (unknown) — x', code: 1, expect: 'started' }).why, /not on the stack/)
  assert.match(smokeVerdict({ output: 'Segmentation fault', code: null, signal: 'SIGSEGV', expect: 'started' }).why, /crash or a hang/)
  assert.equal(smokeVerdict({ output: 'SMOKE OK', code: 1, expect: 'ok' }).pass, false, 'an OK line with a failing exit is not OK')
})

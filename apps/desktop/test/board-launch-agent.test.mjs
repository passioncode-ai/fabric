// ADR-0192 (0.3.18): the board's service is a launch agent the bundle ships. The name the code registers, the property
// list launchd reads and the packaging rule that puts it in Contents/Library/LaunchAgents must agree, or macOS finds
// no service to register (`not-found`) and the board ends with the window again.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { readFileSync } from 'node:fs'

const here = import.meta.dirname
const { BOARD_SERVICE } = await import(path.resolve(here, '../src/shared/loginItem.ts'))
const plist = readFileSync(path.resolve(here, '../build/launchd', BOARD_SERVICE), 'utf8')
const builder = readFileSync(path.resolve(here, '../electron-builder.yml'), 'utf8')

const value = (key) => plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`))?.[1] ?? null

test('the property list the code names ships at Contents/Library/LaunchAgents under the same name', () => {
  assert.match(builder, new RegExp(`from: build/launchd/${BOARD_SERVICE.replace(/\./g, '\\.')}\\s+to: Library/LaunchAgents/${BOARD_SERVICE.replace(/\./g, '\\.')}`))
  assert.equal(value('Label') + '.plist', BOARD_SERVICE)
})

test('launchd starts the app itself, without a window, at login and again after an abnormal end only', () => {
  assert.equal(value('BundleProgram'), 'Contents/MacOS/Fabric')
  assert.match(plist, /<key>ProgramArguments<\/key>\s*<array>\s*<string>Fabric<\/string>\s*<string>--background<\/string>\s*<\/array>/)
  assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/)
  assert.match(plist, /<key>KeepAlive<\/key>\s*<dict>\s*<key>SuccessfulExit<\/key>\s*<false\/>\s*<\/dict>/)
  assert.match(plist, /<key>AssociatedBundleIdentifiers<\/key>\s*<array>\s*<string>ai\.passioncode\.desktop<\/string>/)
  assert.match(builder, /^appId: ai\.passioncode\.desktop$/m)
})

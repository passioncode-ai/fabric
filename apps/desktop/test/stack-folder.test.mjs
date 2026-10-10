// The stack folder every startup remedy names is the one the installed app uses, on each OS (0.3.4 verification,
// iteration 2, UX-1/DO-1; 0.3.5 REQ-06). The packaged app materialises its stack in `app.getPath('userData')/stack`,
// and Electron names that folder after package.json's `productName`, else its `name` — `@fabric/desktop`, since this
// package has no productName (electron-builder's `productName: Fabric` names the app, not the data folder). Electron's
// userData is `~/Library/Application Support/<name>` on macOS, `%APPDATA%\<name>` on Windows and
// `$XDG_CONFIG_HOME/<name>` (`~/.config`) on Linux.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stackFolderFor } from '../src/shared/stackFolder.ts'
import { classifyStartupFailure, startupDialog } from '../src/shared/startupFailure.ts'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const name = pkg.productName ?? pkg.name
assert.equal(stackFolderFor('darwin'), `~/Library/Application Support/${name}/stack`)
assert.equal(stackFolderFor('win32'), `%APPDATA%\\${name.replace('/', '\\')}\\stack`)
assert.equal(stackFolderFor('linux'), `~/.config/${name}/stack`)

// The remedies carry the folder of the OS they run on, in English and in the registries' words.
for (const platform of ['darwin', 'win32', 'linux']) {
  const f = classifyStartupFailure({ message: 'estates read failed: TypeError: fetch failed' }, platform)
  assert.ok(f.remedy.includes(stackFolderFor(platform)), `${platform}: ${f.remedy}`)
  const said = startupDialog(f, { retryable: true, logPath: '/l', platform, say: (k, v) => k === 'startup.database-unreachable.remedy' ? `в папке ${v?.stackFolder}` : k })
  assert.ok(said.detail.includes(`в папке ${stackFolderFor(platform)}`), `${platform}: the registry's words get the folder`)
}
for (const file of ['../src/renderer/src/i18n/en.ts', '../src/renderer/src/i18n/ru.ts', '../src/shared/startupFailure.ts', '../src/main/schemaReadiness.ts', '../../../docs/launch/release-mac.md']) {
  const text = readFileSync(new URL(file, import.meta.url), 'utf8')
  assert.ok(!/Application Support\/Fabric\/stack/.test(text), `${file} still names a stack folder no install has`)
}
for (const file of ['../src/renderer/src/i18n/en.ts', '../src/renderer/src/i18n/ru.ts'])
  assert.ok(!/Application Support\/@fabric\/desktop\/stack/.test(readFileSync(new URL(file, import.meta.url), 'utf8')), `${file} names the macOS folder instead of {stackFolder}`)
console.log('stack-folder: all green')

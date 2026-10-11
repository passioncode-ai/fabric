// The stack folder every startup remedy names is the one the installed app uses (0.3.4 verification, iteration 2,
// UX-1/DO-1). The packaged app materialises its stack in `app.getPath('userData')/stack`, and Electron names that
// folder after package.json's `productName`, else its `name` — `@fabric/desktop`, since this package has no
// productName (electron-builder's `productName: Fabric` names the .app, not the data folder). The remedies said
// `~/Library/Application Support/Fabric/stack`, a folder no install has.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { STACK_FOLDER } from '../src/shared/stackFolder.ts'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
assert.equal(STACK_FOLDER, `~/Library/Application Support/${pkg.productName ?? pkg.name}/stack`)
for (const file of ['../src/renderer/src/i18n/en.ts', '../src/renderer/src/i18n/ru.ts', '../src/shared/startupFailure.ts', '../src/main/schemaReadiness.ts', '../../../docs/launch/release-mac.md']) {
  const text = readFileSync(new URL(file, import.meta.url), 'utf8')
  assert.ok(!/Application Support\/Fabric\/stack/.test(text), `${file} still names a stack folder no install has`)
}
console.log('stack-folder: all green')

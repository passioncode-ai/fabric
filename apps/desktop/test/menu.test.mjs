// The menu's risk is not what it adds — it is what it replaces (M111).
//
// Installing an application menu REPLACES Electron's default entirely, and the
// default is where Cmd+C, Cmd+V, Cmd+Q, Select All and the window controls come
// from. A hand-written minimum that binds Cmd+W to the tab would also take copy
// and paste away from every field in the product: a worse regression than the
// data-loss key it fixes, and one nobody would connect to a menu they cannot
// see. So this asserts the ROLES survive, not that the tab item exists.
//
// It reads the template rather than building it, because `buildFromTemplate`
// needs an Electron runtime and the shape does not.

import { execFileSync } from 'node:child_process'
import path from 'node:path'

const HERE = import.meta.dirname
const script = `
import { menuTemplate } from ${JSON.stringify(path.join(HERE, '../src/main/menuTemplate.ts'))}

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

const t = menuTemplate({ closeActiveTab: () => {}, openExternal: () => {} })
const roles = new Set()
const walk = (items) => {
  for (const i of items ?? []) {
    if (i.role) roles.add(i.role)
    if (Array.isArray(i.submenu)) walk(i.submenu)
  }
}
walk(t)

// The roles Electron fills with the platform's own items. Losing editMenu is
// losing copy and paste everywhere.
for (const need of ['editMenu', 'fileMenu', 'viewMenu']) {
  roles.has(need)
    ? ok('the ' + need + ' survives, so its platform items and accelerators do')
    : fail('the template has no ' + need + ' — installing it takes those keys away')
}

const flat = []
const collect = (items) => {
  for (const i of items ?? []) {
    flat.push(i)
    if (Array.isArray(i.submenu)) collect(i.submenu)
  }
}
collect(t)

const closeTab = flat.find((i) => i.accelerator === 'CmdOrCtrl+W')
closeTab && !closeTab.role && typeof closeTab.click === 'function'
  ? ok('Cmd+W is a click that asks the renderer, not the close-window role')
  : fail('Cmd+W is bound to: ' + JSON.stringify(closeTab))

const closeWindow = flat.find((i) => i.accelerator === 'CmdOrCtrl+Shift+W')
closeWindow?.role === 'close'
  ? ok('and the window is still closable, one modifier away')
  : fail('no shifted close-window item: ' + JSON.stringify(closeWindow))

// Nothing else may claim Cmd+W, or which one wins is an accident of order.
const claimants = flat.filter((i) => i.accelerator === 'CmdOrCtrl+W')
claimants.length === 1
  ? ok('and exactly one item claims Cmd+W')
  : fail(claimants.length + ' items claim Cmd+W')

if (failures > 0) { console.log('\\n' + failures + ' menu failure(s)'); process.exit(1) }
`

try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script],
    { encoding: 'utf8', cwd: path.resolve(HERE, '..') })
  process.stdout.write(out)
} catch (e) {
  process.stdout.write((e.stdout ?? '') + (e.stderr ?? ''))
  process.exit(1)
}

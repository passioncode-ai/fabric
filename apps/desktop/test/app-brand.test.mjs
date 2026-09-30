// The app's own chrome follows the brand pack: the name a person sees in the Dock, the window, the
// menu and the page title is "Fabric", and no wrong form from docs/brand/terminology.md appears.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const root = new URL('../../../', import.meta.url), app = new URL('../', import.meta.url)
const read = rel => readFileSync(new URL(rel, app), 'utf8')
const terminology = readFileSync(new URL('docs/brand/terminology.md', root), 'utf8')
// "| PassionCode.ai | Passion Code, Passion Code AI, patient code |" → the wrong forms of every entity.
const table = terminology.slice(terminology.indexOf('## Entity and tier names'), terminology.indexOf('## Banned'))
const fromPack = table.split('\n').filter(l => /^\| [A-Z]/.test(l) && !l.startsWith('| Name')).flatMap(l => l.split('|')[2].split(/[,;]/))
  .map(s => s.replace(/ when .*| \(.*| use .*/, '').trim()).filter(s => s && /[A-Z]/.test(s) && !/^(fabric|workspace)$/i.test(s))
assert.ok(fromPack.includes('Passion Code') && fromPack.length >= 8, 'the wrong forms were read from terminology.md: ' + fromPack.join(' · '))
// ADR-0086 approves "PassionCode" as the short family label in running text. The app's own chrome
// is not running text: it names the product (Fabric) or the full PassionCode.ai, so the bare short
// label stays refused here.
const wrong = [...fromPack, 'PassionCode']
const chrome = {
  'productName': /^productName: (.+)$/m.exec(read('electron-builder.yml'))?.[1],
  'page title': /<title>([^<]*)<\/title>/.exec(read('src/renderer/index.html'))?.[1],
  'main window title': /mainWindow = new BrowserWindow\(\{[\s\S]*?title: '([^']+)'/.exec(read('src/main/index.ts'))?.[1],
  'menu labels': [...read('src/main/menuTemplate.ts').matchAll(/label: '([^']+)'/g)].map(m => m[1]).join(' | '),
}
assert.equal(chrome.productName, 'Fabric'); assert.equal(chrome['page title'], 'Fabric'); assert.equal(chrome['main window title'], 'Fabric')
for (const [where, text] of Object.entries(chrome)) for (const w of wrong)
  assert.ok(!new RegExp(`(^|[^\\w.])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.])`).test(text ?? ''), `${where} uses the wrong form "${w}": ${text}`)
assert.ok(!/github\.com\/ssheleg|github\.com\/passioncode-ai\/fabric\b/.test(read('src/main/menuTemplate.ts')), 'the menu links no private or personal repository')
console.log(`PASS app chrome follows the brand pack: ${Object.keys(chrome).length} surfaces against ${wrong.length} wrong forms`)

#!/usr/bin/env node
// R-006: a check is trusted only after the thing it tests has been REMOVED and the check
// watched going red. Every plant below is VALID code that behaves like the defect this
// run fixed — never a syntax error, which would prove the parser and nothing else.
import {readFileSync, writeFileSync, existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
const WORKSPACE = ['--test', 'workspace/test/']
const GUARD = ['--test', 'scripts/test/workspace-publication-guard.test.mjs']
const PRODUCT = ['--test', 'scripts/test/product-empty-state.test.mjs']

const plants = [
  {id: 'P1', why: 'reports are served raw again, with no workspace bar',
   file: 'workspace/lib/shell.mjs', suite: WORKSPACE,
   find: '  const at=bodyOffset(html);\n  return html.slice(0,at)+shellBar(path,site)+html.slice(at);',
   with: '  const at=bodyOffset(html);\n  return at>=0?html:html;'},
  {id: 'P2', why: 'the bar becomes sticky and covers a report that owns the top edge',
   file: 'workspace/lib/shell.mjs', suite: WORKSPACE,
   find: '#fabric-shell{--fw-bg:#111113;', with: '#fabric-shell{position:sticky;top:0;--fw-bg:#111113;'},
  {id: 'P3', why: 'authorized bodies go back to no-store, killing revalidation and bfcache',
   file: 'workspace/server.mjs', suite: WORKSPACE,
   find: "const validators={'ETag':etag,'Cache-Control':'private, no-cache','Vary':'Authorization'};",
   with: "const validators={'ETag':etag,'Cache-Control':'private, no-store','Vary':'Authorization'};"},
  {id: 'P4', why: 'the validator disappears, so nothing can be revalidated',
   file: 'workspace/server.mjs', suite: WORKSPACE,
   find: "      const validators={'ETag':etag,",
   with: "      const validators={'X-Body-Tag':etag,"},
  {id: 'P5', why: 'library results stop carrying the filter, so returning loses it',
   file: 'workspace/lib/pages.mjs', suite: WORKSPACE,
   find: 'escape(urlPath(item.path)+carry({folder,q}))', with: 'escape(urlPath(item.path))'},
  {id: 'P6', why: 'the theme is applied after first paint again',
   file: 'workspace/lib/pages.mjs', suite: WORKSPACE,
   find: '${THEME_SCRIPT}<script src="/site/workspace.js" defer></script>',
   with: '<script src="/site/workspace.js" defer></script>'},
  {id: 'P7', why: 'refusals and error pages become cacheable',
   file: 'workspace/server.mjs', suite: WORKSPACE,
   find: 'function fail(status,message,extra={}) {html(status,errorPage(status,message),false,extra);}',
   with: 'function fail(status,message,extra={}) {freshHTML(errorPage(status,message),false,extra);}'},
  {id: 'P8', why: 'the bar lands before the document instead of inside the body',
   file: 'workspace/lib/shell.mjs', suite: WORKSPACE,
   find: '  const document=parse(html,{sourceCodeLocationInfo:true});\n  const root=',
   with: '  const document=parse(html,{sourceCodeLocationInfo:true});\n  if(document) return 0;\n  const root='},
  {id: 'P11', why: 'the layout stops carrying the shared top row, so the site splits in two again',
   file: 'workspace/lib/pages.mjs', suite: WORKSPACE,
   find: '${shellBar(path,{revision:manifest.source.commit,repository:manifest.source.repository})}',
   with: '${path?\'\':\'\'}'},
  {id: 'P12', why: 'a page\'s own controls sink into the body instead of forming the third row',
   file: 'workspace/lib/pages.mjs', suite: WORKSPACE,
   find: "  const back=guide?'/':libraryHref(state);",
   with: "  const back=guide?'/':libraryHref(state);\n  if(back) return layoutless(snapshot,path,data);"},
  {id: 'P13', why: 'anchor targets become empty self-links again — silent keyboard tab traps',
   file: 'workspace/lib/documents.mjs', suite: WORKSPACE,
   find: "        const {href:_drop,...rest} = attrs;\n        const href = 'href' in attrs ? rewriteLink(attrs.href,path,snapshot,options) : '';\n        return href ? {tagName:tag,attribs:{...rest,href,rel:'noreferrer noopener'}} : {tagName:tag,attribs:rest};",
   with: "        return {tagName:tag,attribs:{...attrs,href:rewriteLink(attrs.href,path,snapshot,options),rel:'noreferrer noopener'}};"},
  {id: 'P14', why: 'the tab icon 404s again on every page, reports included',
   file: 'workspace/server.mjs', suite: WORKSPACE,
   find: "      if(pathname==='/favicon.ico'||pathname==='/favicon.svg') {",
   with: "      if(false && (pathname==='/favicon.ico'||pathname==='/favicon.svg')) {"},
  {id: 'P15', why: 'the prototype offers an empty state and draws the populated screen instead',
   file: 'scripts/product/renderers.mjs', suite: PRODUCT,
   find: "  let result = ['denied','loading','empty'].includes(normalized.state)",
   with: "  let result = ['denied','loading'].includes(normalized.state)"},
  {id: 'P16', why: 'table labels are cut in half again by overflow-wrap: anywhere',
   file: 'scripts/product/report.css', suite: PRODUCT,
   find: 'vertical-align: top; min-width: 0; overflow-wrap: break-word; }',
   with: 'vertical-align: top; min-width: 0; overflow-wrap: anywhere; }'},
  {id: 'P9', why: 'the publication rail refuses unstaged parent work again',
   file: 'scripts/workspace-release.mjs', suite: GUARD,
   find: "  if(row[0]===' ')return false", with: "  if(row[0]===' ')return true"},
  {id: 'P10', why: 'a moved pin stops making a publication look unfinished',
   file: 'scripts/workspace-release.mjs', suite: GUARD,
   find: ".some(p=>p==='workspace'||p===receipt)", with: '.some(p=>p===receipt)'}
]

const green = suite => {
  try {execFileSync(process.execPath, suite, {cwd: root, stdio: 'pipe'}); return true}
  catch {return false}
}

// The host suite lives in the submodule and needs its dependencies installed. Where they
// are absent the plants aimed at it cannot run — said out loud, because a harness that
// silently drops half its plants reports the same "all caught" as one that ran them.
const hostReady = existsSync(path.join(root, 'workspace/node_modules'))
const runnable = plants.filter(plant => hostReady || plant.suite !== WORKSPACE)
if (!hostReady) console.log(`SKIPPING ${plants.length - runnable.length} host plants: workspace/node_modules is absent (run npm ci in workspace/).`)

for (const suite of new Set(runnable.map(plant => plant.suite))) {
  if (green(suite)) continue
  console.error('PLANTS ABORTED: the suites are not green before planting anything.')
  process.exit(1)
}

let caught = 0
const escaped = []
for (const plant of runnable) {
  const file = path.join(root, plant.file)
  const original = readFileSync(file, 'utf8')
  if (!original.includes(plant.find)) {
    console.error(`${plant.id} ANCHOR MISSING in ${plant.file} — the plant never applied`)
    escaped.push(`${plant.id} (anchor)`)
    continue
  }
  writeFileSync(file, original.replace(plant.find, plant.with))
  const survived = green(plant.suite)
  writeFileSync(file, original)
  if (survived) {escaped.push(plant.id); console.error(`${plant.id} ESCAPED — ${plant.why}`)}
  else {caught++; console.log(`${plant.id} caught — ${plant.why}`)}
}

for (const suite of new Set(runnable.map(plant => plant.suite))) {
  if (green(suite)) continue
  console.error('PLANTS LEFT THE TREE RED: a restore failed. Inspect the working tree.')
  process.exit(1)
}

console.log(`\n${caught}/${runnable.length} plants caught by the suites.`)
if (escaped.length) {console.error('Escaped: ' + escaped.join(', ')); process.exit(1)}

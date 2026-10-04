// The map is a reviewed projection of the repository, not a second backlog.
// --refresh stamps reviewed source bytes; it does NOT update or review the prose.
import { readFileSync, writeFileSync, existsSync, lstatSync, readlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'parse5'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mapPath = path.join(root, 'docs/reports/map.html')
let html = readFileSync(mapPath, 'utf8')
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))]
  // The independently versioned publication and its receipt are outputs. Hashing
  // their gitlink/receipt back into their own source map creates a commit cycle.
  // scripts/workspace.mjs check verifies these against source bytes separately.
  .filter(p => p !== 'docs/reports/map.html' && p !== 'workspace' && !p.startsWith('workspace/') && p !== 'docs/workspace-receipt.json' && (existsSync(path.join(root, p)) || lstatSync(path.join(root,p),{throwIfNoEntry:false})?.isSymbolicLink()))
  .sort()
if (!files.length) throw new Error('No map sources inspected')
const hash = createHash('sha256')
for (const p of files) {
  const full = path.join(root,p)
  hash.update(p).update('\0').update(lstatSync(full).isSymbolicLink() ? `symlink:${readlinkSync(full)}` : readFileSync(full)).update('\0')
}
const fingerprint = hash.digest('hex')
const walk = node => [node, ...(node.childNodes ?? []).flatMap(walk)]
const nodes = source => walk(parse(source, { sourceCodeLocationInfo: true }))
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value
const attrs = (list, name) => list.map(n => attr(n, name)).filter(v => v !== undefined)
const tree = nodes(html)
const changelog = tree.findIndex(n => attr(n, 'id') === 'changelog')
const firstEntry = changelog < 0 ? null : tree.slice(changelog + 1).find(n => attr(n, 'data-iteration') !== undefined)
if (!firstEntry) throw new Error('Missing iteration entry at #changelog')
const iteration = attr(firstEntry, 'data-iteration')
const ids = attrs(tree, 'id')
if (new Set(ids).size !== ids.length) throw new Error('Duplicate map anchors')
const links = attrs(tree, 'href')
for (const href of links) {
  if (/^(https?:|mailto:)/i.test(href)) continue
  const [p, encodedAnchor] = href.split('#')
  const anchor = encodedAnchor ? decodeURIComponent(encodedAnchor) : ''
  if (!p && anchor && !ids.includes(anchor)) throw new Error(`Broken map anchor: ${href}`)
  if (p && !existsSync(path.resolve(path.dirname(mapPath), decodeURIComponent(p)))) throw new Error(`Missing local map target: ${href}`)
}
if (!attrs(walk(firstEntry), 'href').some(h => h.startsWith('#'))) throw new Error('Latest iteration has no precise review links')
const stampNode = list => list.find(n => n.tagName === 'script' && attr(n, 'id') === 'map-source-stamp')
const readStamp = list => {
  const n = stampNode(list)
  return n ? JSON.parse((n.childNodes ?? []).map(c => c.value ?? '').join('')) : null
}
const withoutStamp = (source, list) => {
  const location = stampNode(list)?.sourceCodeLocation
  return location ? source.slice(0, location.startOffset) + source.slice(location.endOffset) : source
}
let committed = ''
try { committed = execFileSync('git', ['show', 'HEAD:docs/reports/map.html'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }) }
catch (error) {
  execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, stdio: 'ignore' })
  // A failed read of an existing map is not a missing baseline (for example,
  // a child-process buffer limit). Refuse instead of dropping old anchors.
  const present = execFileSync('git', ['ls-tree', '--name-only', 'HEAD', '--', 'docs/reports/map.html'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  if (present === 'docs/reports/map.html') throw error
  console.log('Initial map: no committed map baseline; no old anchors to compare.')
}
if (committed) {
  const previousTree = nodes(committed)
  for (const id of attrs(previousTree, 'id')) if (id !== 'map-source-stamp' && !ids.includes(id)) throw new Error(`Previously committed map anchor removed: ${id}`)
  const previous = readStamp(previousTree)
  const sourceChanged = !previous || previous.fingerprint !== fingerprint
  const contentChanged = withoutStamp(committed, previousTree) !== withoutStamp(html, tree)
  if ((sourceChanged || contentChanged) && attrs(previousTree, 'data-iteration').includes(iteration)) throw new Error('Changed iteration reuses the committed top entry: add a NEW top changelog entry. Repeated refresh within an uncommitted iteration is allowed.')
}
if (process.argv.includes('--refresh')) {
  const stamp = `<script id="map-source-stamp" type="application/json">${JSON.stringify({ schema: 1, iteration, fingerprint, source_files: files.length })}</script>`
  const location = stampNode(tree)?.sourceCodeLocation
  html = location ? html.slice(0, location.startOffset) + stamp + html.slice(location.endOffset)
    : /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${stamp}\n</body>`) : `${html}\n${stamp}\n`
  writeFileSync(mapPath, html)
  console.log('Stamped reviewed source bytes. This command does not review or update map content.')
} else {
  const stamp = readStamp(tree)
  if (!stamp) throw new Error('Map has no reviewed source stamp')
  if (stamp.fingerprint !== fingerprint || stamp.source_files !== files.length || stamp.iteration !== iteration) throw new Error('Map sources changed: update the map and its top changelog entry, review the affected sections, then run node scripts/check-design-map.mjs --refresh')
}
console.log(`PASS: map source stamp (${files.length} files), ${ids.length} unique anchors and ${links.length} link targets. Prose accuracy, completeness, external URLs and Markdown fragments are not verified.`)

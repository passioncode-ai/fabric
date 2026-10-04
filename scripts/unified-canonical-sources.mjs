// #region unified-canonical-sources — docs: docs/reports/2026-10-04-unified-execution/protocol.md#recovery-and-source-change
import { readFileSync, existsSync, lstatSync, realpathSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const require = createRequire(import.meta.url)
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const repository = 'https://github.com/passioncode-ai/fabric'
const manifestPath = 'docs/backlog-sources.json'
const safe = path => typeof path === 'string' && path.length <= 700 && !/[\\\x00-\x1f\x7f?#%:]/.test(path) && !path.startsWith('/') && path.split('/').every(p => p && p !== '.' && p !== '..' && !p.startsWith('.'))
const git = (root, ...args) => execFileSync('git', args, {cwd:root, maxBuffer:32 * 1024 * 1024, stdio:['ignore','pipe','pipe']})

function regular(root, path) {
  if (!safe(path)) throw new Error(`unsafe canonical source path: ${path}`)
  let cursor = resolve(root)
  for (const part of path.split('/')) {
    cursor = resolve(cursor, part)
    if (lstatSync(cursor).isSymbolicLink()) throw new Error(`linked canonical source refused: ${path}`)
  }
  if (!lstatSync(cursor).isFile() || lstatSync(cursor).size > 32 * 1024 * 1024) throw new Error(`nonregular or oversized canonical source: ${path}`)
  const inside = relative(realpathSync(root), realpathSync(cursor))
  if (inside.startsWith('..') || inside.startsWith('/')) throw new Error(`canonical source escapes root: ${path}`)
  return readFileSync(cursor)
}

export function canonicalInventory(root, revision) {
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('canonical inventory requires an immutable source revision')
  const parserRoot = resolve(root, 'workspace')
  const parserPath = resolve(parserRoot, 'lib/backlog.mjs')
  if (!existsSync(parserPath)) throw new Error('canonical inventory requires git submodule update --init workspace')
  const pinned = git(root, 'ls-tree', revision, 'workspace').toString().match(/^160000 commit ([a-f0-9]{40})\tworkspace$/m)?.[1]
  if (!pinned) throw new Error('canonical inventory source revision has no workspace parser pin')
  // A published workspace adds snapshot content above the source gitlink. It
  // may retain this exact parser; neither its HEAD nor new content renews the
  // pinned parser authority. Unrelated histories still cannot substitute it.
  try { git(parserRoot, 'merge-base', '--is-ancestor', pinned, 'HEAD') }
  catch { throw new Error('canonical inventory workspace HEAD is not a descendant of the source revision parser pin') }
  for (const path of ['lib/backlog.mjs', 'lib/snapshot.mjs']) {
    if (digest(readFileSync(resolve(parserRoot, path))) !== digest(git(parserRoot, 'show', `${pinned}:${path}`))) throw new Error('canonical inventory parser has uncommitted changes')
  }
  const manifestBytes = regular(root, manifestPath)
  const manifest = JSON.parse(manifestBytes)
  if (!Array.isArray(manifest.sources)) throw new Error('canonical inventory manifest has no source declarations')
  const files = new Map([[manifestPath, {data:manifestBytes}]])
  for (const source of manifest.sources) {
    if (safe(source?.path) && !files.has(source.path)) files.set(source.path, {data:regular(root, source.path)})
  }
  // Reuse the pinned common-backlog parser, including its duplicate identity,
  // fenced table, exclusion and format checks. This is Fabric-local coverage;
  // the organization inventory belongs to the separate workspace aggregation.
  const { collectBacklog } = require(parserPath)
  const result = collectBacklog({manifest:{source:{repository,commit:revision}},files})
  const errors = result.errors.filter(e => !(e.repository === 'https://github.com/passioncode-ai/org-index' && e.path === 'repositories.json' && e.message === 'Repository inventory is missing; coverage is incomplete'))
  if (errors.length || result.coverage.length !== 1 || !result.coverage[0].complete) throw new Error('canonical inventory invalid: ' + errors.map(e => `${e.path}: ${e.message}`).join('; '))
  return {schema:1,scope:'Fabric local manifest declarations; not organization-wide aggregation',repository,commit:revision,
    parser:{repository:'https://github.com/passioncode-ai/fabric-workspace',commit:pinned,path:'lib/backlog.mjs',sha256:digest(readFileSync(parserPath))},
    sources:[...files].map(([path,{data}]) => ({path,sha256:digest(data),commit:revision})).sort((a,b)=>a.path.localeCompare(b.path,'en')),
    declarations:manifest.sources,tasks:result.tasks,contexts:result.contexts}
}

export function sourceRevisionProblems(root, sources, revision) {
  const problems = []
  for (const source of sources) {
    if (source.commit !== revision) { problems.push(`source revision mismatch: ${source.path}`); continue }
    try { if (digest(git(root, 'show', `${revision}:${source.path}`)) !== source.sha256) problems.push(`source not attested by revision: ${source.path}`) }
    catch { problems.push(`source revision unreadable: ${source.path}`) }
  }
  return problems
}

export function publicInputProblems(inputs, deny = []) {
  const problems = []
  if (!Array.isArray(deny) || deny.some(x => typeof x !== 'string' || !x.trim())) throw new Error('privacy deny file must contain an array of nonempty literal strings')
  for (const {path,bytes} of inputs) {
    const text = bytes.toString('utf8')
    const label = deny.some(token => path.toLowerCase().includes(token.toLowerCase())) ? '<redacted source path>' : path
    if (deny.some(token => text.toLowerCase().includes(token.toLowerCase()))) problems.push(`private input refused: ${label}`)
    if (/"(?:visibility|publication_scope)"\s*:\s*"private"/i.test(text) || /"private_(?:consumer|repository|context)"\s*:/i.test(text)) problems.push(`private metadata refused: ${label}`)
  }
  return [...new Set(problems)].sort()
}
// #endregion unified-canonical-sources

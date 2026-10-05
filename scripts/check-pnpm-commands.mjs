#!/usr/bin/env node
// #region pnpm-command-gate — docs: docs/DOCMAP.md#gates-and-ratchets
// Every `pnpm …` command a LIVING document tells a reader to run names a script that exists.
//
// 2026-10-05: the contract fixture's README said "Run `pnpm --filter @fabric/desktop
// test:contract-consumer`" while a conflict resolution had dropped that script from
// apps/desktop/package.json — the command failed for anyone who followed the README, and no
// gate noticed. Only commands inside backticks are read (prose such as "the pnpm workspace" is
// not a command), and dated records are skipped: they describe a moment and are never rewritten.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// pnpm's own commands: a document may name them without a package script behind them.
const BUILTIN = new Set(['install', 'i', 'add', 'remove', 'rm', 'update', 'up', 'exec', 'dlx', 'create', 'init',
  'store', 'why', 'list', 'ls', 'outdated', 'audit', 'rebuild', 'prune', 'import', 'link', 'unlink', 'config',
  'env', 'setup', 'publish', 'pack', 'deploy', 'fetch', 'approve-builds', 'licenses', 'patch', 'patch-commit',
  'self-update', 'root', 'bin', 'help'])

// A command a document promises for later, as a promise: allowed only while the milestone that will deliver
// it is still open in docs/evidence/backlog.md. When the milestone closes, the entry fails and either the
// script exists by then or the promise is rewritten.
export const PLANNED = new Map([
  ['registry:verify', 'M4'],
  ['collect:cloudflare', 'M4'],
])

const DATE = /\d{4}-\d{2}-\d{2}/
/** A dated record (an audit, a dated plan, report or handoff) or another repository's copy is not checked. */
export const isLiving = (rel) => rel.endsWith('.md') && !rel.startsWith('workspace/') && !rel.includes('node_modules/') &&
  !rel.startsWith('docs/audit/') && !rel.split('/').some(seg => DATE.test(seg))

const COMMAND = /(?:^|&&|;|\|\||\$\(\s*)\s*pnpm\s+((?:(?:--filter|-F)\s+\S+\s+)?)(?:run\s+)?([a-z][\w:.-]*)/g

/**
 * files: [{ rel, text }]; packages: Map(name -> Set(script)) with the root under the key "" .
 * Returns problems as "file:line: …" strings.
 */
export function pnpmProblems(files, packages, openMilestones = new Set()) {
  const problems = []
  for (const [script, milestone] of PLANNED)
    if (!openMilestones.has(milestone) && !packages.get('')?.has(script))
      problems.push(`scripts/check-pnpm-commands.mjs: planned \`pnpm ${script}\` waits on ${milestone}, which is no longer open — add the script or rewrite the promise`)
  for (const { rel, text } of files) {
    text.split('\n').forEach((line, i) => {
      for (const span of line.matchAll(/`([^`]+)`/g)) {
        for (const m of span[1].matchAll(COMMAND)) {
          const filter = /(?:--filter|-F)\s+(\S+)/.exec(m[1])?.[1] ?? ''
          const script = m[2]
          if (!filter && BUILTIN.has(script)) continue
          if (filter && (script === 'exec' || BUILTIN.has(script))) continue
          const scripts = packages.get(filter)
          if (!scripts) { problems.push(`${rel}:${i + 1}: \`pnpm --filter ${filter}\` names no package in this workspace`); continue }
          if (!filter && PLANNED.has(script) && openMilestones.has(PLANNED.get(script))) continue
          if (!scripts.has(script)) problems.push(`${rel}:${i + 1}: \`pnpm${filter ? ` --filter ${filter}` : ''} ${script}\` — ${filter || 'the root package'} has no script "${script}"`)
        }
      }
    })
  }
  return problems
}

function workspacePackages(root) {
  const out = new Map()
  const manifests = execFileSync('git', ['ls-files', 'package.json', '*/package.json'], { cwd: root, encoding: 'utf8' })
    .split('\n').filter(p => p && !p.includes('node_modules/') && !p.startsWith('workspace/'))
  for (const rel of manifests) {
    const json = JSON.parse(readFileSync(path.join(root, rel), 'utf8'))
    const key = rel === 'package.json' ? '' : json.name
    if (key === undefined) continue
    out.set(key, new Set(Object.keys(json.scripts ?? {})))
  }
  return out
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const rels = execFileSync('git', ['ls-files', '*.md'], { cwd: root, encoding: 'utf8' }).split('\n').filter(isLiving)
  const files = rels.map(rel => ({ rel, text: readFileSync(path.join(root, rel), 'utf8') }))
  const backlog = readFileSync(path.join(root, 'docs/evidence/backlog.md'), 'utf8')
  const open = new Set([...backlog.matchAll(/^\| (M\d+) \|.*\| open \|\s*$/gm)].map(m => m[1]))
  const problems = pnpmProblems(files, workspacePackages(root), open)
  if (problems.length) {
    for (const p of problems) console.error(`ERR: ${p}`)
    console.error(`FAIL: ${problems.length} pnpm command(s) in living documents name no script`)
    process.exit(1)
  }
  console.log(`PASS: every backticked pnpm command in ${files.length} living documents names an existing script`)
}
// #endregion pnpm-command-gate

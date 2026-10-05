#!/usr/bin/env node
// #region repin-agent-contract — docs: docs/handoffs/2026-10-04-contract-consumer-regression.md#scope-and-contract
// Repin the vendored fabric-agent-contract fixture to one upstream commit:
//   node scripts/repin-agent-contract.mjs --checkout <fabric-agent-contract checkout> --commit <40-hex sha>
// The file set is not decided here: it is `expectedPaths` in apps/desktop/test/contract-consumer-fixtures.mjs,
// the same list the loader verifies, so a file can be neither copied without being checked nor checked
// without being copied. Bytes come from `git show <commit>:<path>` — never from a working tree, which may
// hold uncommitted edits. The legacy negative control keeps its own commit and is never repinned.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expectedPaths, fixtureRoot, upstreamPathOf } from '../apps/desktop/test/contract-consumer-fixtures.mjs'

function args(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const m = /^--(checkout|commit)$/.exec(argv[i])
    if (!m || argv[i + 1] === undefined) throw new Error(`usage: --checkout <path> --commit <sha>; got ${argv[i]}`)
    out[m[1]] = argv[++i]
  }
  if (!out.checkout || !/^[0-9a-f]{40}$/.test(out.commit ?? '')) throw new Error('both --checkout and a full 40-hex --commit are required')
  return out
}

export function repin({ checkout, commit, root = fixtureRoot }) {
  const git = (...a) => execFileSync('git', ['-C', checkout, ...a], { maxBuffer: 16 * 1024 * 1024, timeout: 60_000 })
  if (git('cat-file', '-t', commit).toString().trim() !== 'commit') throw new Error(`${commit} is not a commit in ${checkout}`)
  const sourcePath = resolve(root, 'SOURCE.json')
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'))
  const legacy = new Map(source.files.filter(f => f.path.startsWith('legacy/')).map(f => [f.path, f]))
  const files = []
  for (const path of expectedPaths) {
    if (path.startsWith('legacy/')) {
      const kept = legacy.get(path)
      if (!kept) throw new Error(`the legacy negative control ${path} is missing from SOURCE.json; it is never repinned`)
      files.push(kept); continue
    }
    const target = resolve(root, path)
    if (!target.startsWith(resolve(root) + sep)) throw new Error(`${path} escapes the fixture root`)
    const upstreamPath = upstreamPathOf(path)
    const bytes = git('show', `${commit}:${upstreamPath}`)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, bytes)
    files.push({ path, upstreamPath, commit, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  writeFileSync(sourcePath, JSON.stringify({ ...source, currentCommit: commit, files }, null, 2) + '\n')
  return files.length
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = repin(args(process.argv.slice(2)))
  console.log(`repinned ${n} file(s); now set CURRENT_COMMIT in apps/desktop/test/contract-consumer-fixtures.mjs if it differs, and run the consumer test`)
}
// #endregion repin-agent-contract

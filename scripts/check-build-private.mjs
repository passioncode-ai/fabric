#!/usr/bin/env node
// What ships carries nothing of one person's machine (the owner, 2026-11-20: «то, что мы выкатываем, там должны быть
// пустые вещи»). check-private.mjs reads the tracked files; this gate reads the BUILT app, which the tracked-file scan
// never sees: `apps/desktop/out` by default, or a folder given (an unpacked app.asar).
//
// Two readings, values never printed (only the rule, file:line and how many):
//   1. the organization's checker (org-index `scripts/check_private.py`) over a copy of the folder outside Git: the
//      operator's local denylist (P1), e-mail addresses (P2), home paths (P3), account ids (P4);
//   2. this product's own patterns, which hold no private word: the projects-root convention (`~/DATA`, `/DATA/<repo>`),
//      a vault slot (`<project>/prod/<NAME>`), a home path. The Observatory adapter's own tool names (`use_secret.py`)
//      are not one machine's: that adapter is optional and says when Observatory is absent.
// Reading 1 says NOT_RUN where the checker or the denylist is missing (a contributor's clone); reading 2 always runs.
//
//   node scripts/check-build-private.mjs [folder] [--require]
//   --require: NOT_RUN of reading 1 fails (the operator's machine before a release)

import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const required = args.includes('--require')
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const target = path.resolve(args.find((a) => !a.startsWith('--')) ?? path.join(root, 'apps/desktop/out'))

if (!existsSync(target)) {
  console.log(`check-build-private: FAIL: no build at ${path.relative(root, target) || target}; build it first (pnpm --filter @fabric/desktop exec electron-vite build)`)
  process.exit(1)
}

/** Reading 2: patterns that name a convention of one machine, not a word of anyone's. */
export const PATTERNS = [
  { id: 'projects-root', re: /~\/DATA\b|\/DATA\/(?:fabric|_worktrees|project-observatory|org-index)\b/g },
  { id: 'vault-slot', re: /\b[a-z][a-z0-9-]{1,40}\/prod\/[A-Z][A-Z0-9_]{2,}\b/g },
  { id: 'home-path', re: /\/Users\/(?!Shared\b)[a-z][a-z0-9._-]+\//g }
]

/** The screens stand (`out/stand`, scripts/stand/build-stand.mjs) is built beside the app and never shipped. */
function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (dir === target && name === 'stand') continue
    const p = path.join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) yield* files(p)
    else if (s.isFile() && s.size <= 20 * 1024 * 1024) yield p
  }
}

const own = new Map()
for (const file of files(target)) {
  const data = readFileSync(file)
  if (data.subarray(0, 8192).includes(0)) continue
  const lines = data.toString('utf8').split('\n')
  lines.forEach((line, i) => {
    for (const p of PATTERNS) {
      p.re.lastIndex = 0
      if (p.re.test(line)) {
        const key = `${p.id} ${path.relative(target, file)}:${i + 1}`
        own.set(key, (own.get(key) ?? 0) + 1)
      }
    }
  })
}

let failed = false
for (const key of own.keys()) console.log(`FINDING ${key}`)
if (own.size) { failed = true; console.log(`check-build-private: ${own.size} line(s) name one machine's paths or vault slots`) }

// Reading 1: the organization's checker, over a copy outside Git so it walks the files instead of `git ls-files`.
const checker = process.env.PASSIONCODE_CHECK_PRIVATE ?? [path.join(root, '..', 'org-index', 'scripts', 'check_private.py'),
  path.join(path.dirname(path.resolve(root, execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim())), '..', 'org-index', 'scripts', 'check_private.py'),
  path.join(homedir(), 'DATA', 'org-index', 'scripts', 'check_private.py')].find((c) => existsSync(c))
const terms = process.env.PASSIONCODE_PRIVATE_TERMS ?? path.join(homedir(), '.config', 'passioncode', 'private-terms.txt')
if (!checker || !existsSync(checker) || !existsSync(terms)) {
  console.log(`check-build-private: NOT_RUN (denylist reading): ${!checker || !existsSync(checker) ? 'no org-index checker' : 'no local denylist'}`)
  if (required) failed = true
} else {
  const copy = mkdtempSync(path.join(tmpdir(), 'fabric-build-private-'))
  try {
    cpSync(target, copy, { recursive: true, filter: (src) => path.relative(target, src).split(path.sep)[0] !== 'stand' })
    const run = spawnSync('python3', [checker, copy, '--json', '--terms', terms], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    let report = null
    try { report = JSON.parse(run.stdout) } catch { /* its stdout may hold matched text: only say it was not JSON */ }
    if (!report) { console.log(`check-build-private: FAIL: the checker exited ${run.status} without a JSON report`); failed = true }
    else {
      // Reviewed synthetic findings, by rule and matched-text hash (a bundle's file name changes with every build).
      const allowFile = path.join(root, 'scripts', 'check-build-private.allow')
      const allow = new Set(existsSync(allowFile) ? readFileSync(allowFile, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean) : [])
      const all = Array.isArray(report.findings) ? report.findings : []
      const keyOf = (f) => `${f.rule}:${String(f.fingerprint).split(':').pop()}`
      const found = all.filter((f) => f.rule === 'P1' || !allow.has(keyOf(f)))
      const seen = new Set(all.map(keyOf))
      for (const a of allow) if (!seen.has(a)) console.log(`STALE check-build-private.allow entry matches nothing: ${a}`)
      for (const f of found) console.log(`FINDING ${f.rule} ${f.file}:${f.line}`)
      if (found.length) { failed = true; console.log(`check-build-private: ${found.length} denylist/e-mail/path/account finding(s)`) }
    }
  } finally { rmSync(copy, { recursive: true, force: true }) }
}

// Reading 3: the values this machine's own Fabric holds in its settings (the owner, 2026-11-20: his values live in his
// settings, the build holds none of them): the people-ask routes (organizations, PM project ids, businesses, owners), the
// dispatch targets and the person's chosen projects; plus a local word list (`~/.config/passioncode/fabric-owner-terms.txt`,
// one term per line, never in a repository), for names a settings file does not hold, such as an agent's name in its
// inflected forms. Printed by source only, never by value. NOT_RUN on a machine with neither (a contributor's clone).
const userData = process.env.FABRIC_USER_DATA ?? path.join(homedir(), 'Library', 'Application Support', '@fabric', 'desktop')
const ownerTermsFile = process.env.FABRIC_OWNER_TERMS ?? path.join(homedir(), '.config', 'passioncode', 'fabric-owner-terms.txt')
const values = new Map()
const add = (v, source) => { if (typeof v === 'string' && [...v.trim()].length >= 4) values.set(v.trim().toLowerCase(), source) }
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return null } }
const routes = readJson(path.join(userData, 'people-ask-routes.json'))
if (routes) {
  const list = Array.isArray(routes) ? routes : Array.isArray(routes.routes) ? routes.routes : []
  for (const r of list) { add(r.organization, 'people-ask-routes.organization'); add(r.target, 'people-ask-routes.target'); for (const b of r.businesses ?? []) add(b, 'people-ask-routes.businesses'); for (const o of r.owners ?? []) add(o, 'people-ask-routes.owners') }
  for (const [id, c] of Object.entries(routes.projects ?? {})) { add(id, 'people-ask-routes.projects'); add(c?.target, 'people-ask-routes.projects') }
}
const settings = readJson(path.join(userData, 'settings.json'))
if (settings) { add(settings.dispatchTarget, 'settings.dispatchTarget'); for (const [k, v] of Object.entries(settings.dispatchTargets ?? {})) { add(k, 'settings.dispatchTargets'); add(v, 'settings.dispatchTargets') } }
if (existsSync(ownerTermsFile)) for (const l of readFileSync(ownerTermsFile, 'utf8').split('\n')) { const t = l.replace(/#.*/, '').trim(); if (t) add(t, 'fabric-owner-terms') }
// The publisher's own name is the product's, not one person's: `PassionCode.ai` and its GitHub owner stay allowed.
for (const k of ['passioncode.ai', 'passioncode-ai', 'passioncode']) values.delete(k)
// A route's key that is an ordinary word (an organization called «personal») is not one person's value.
for (const k of ['personal', 'private', 'default', 'team', 'home', 'work']) values.delete(k)
// Whole words only, Unicode-aware: «Киру» is a name, «фиксирую» is not.
const wordOf = (v) => new RegExp(`(?<![\\p{L}\\p{N}_])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'u')
const patterns = [...values].map(([v, source]) => ({ re: wordOf(v), source }))
if (!values.size) {
  console.log('check-build-private: NOT_RUN (owner values): no Fabric settings and no fabric-owner-terms.txt on this machine')
} else {
  const hits = new Map()
  for (const file of files(target)) {
    const data = readFileSync(file)
    if (data.subarray(0, 8192).includes(0)) continue
    data.toString('utf8').toLowerCase().split('\n').forEach((line, i) => {
      for (const { re, source } of patterns) if (re.test(line)) hits.set(`${source} ${path.relative(target, file)}:${i + 1}`, true)
    })
  }
  for (const k of hits.keys()) console.log(`FINDING owner-value ${k}`)
  if (hits.size) { failed = true; console.log(`check-build-private: ${hits.size} line(s) hold a value of this machine's own settings`) }
  else console.log(`check-build-private: none of ${values.size} value(s) from this machine's settings is in the build`)
}

console.log(failed ? 'check-build-private: FAIL' : `check-build-private: PASS: nothing of one machine in ${path.relative(root, target) || target}`)
process.exit(failed ? 1 : 0)

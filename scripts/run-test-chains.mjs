#!/usr/bin/env node
// #region run-test-chains — docs: README.md#the-disposable-test-stack
// `node scripts/run-test-chains.mjs [--list]`: run EVERY suite of every workspace package's `test`
// script, then fail once at the end, naming every suite that failed.
//
// Why this exists (release review 2026-10-03, iteration 2, harness finding 2). Each package's `test`
// script is a chain of `a && b && c …`, and `pnpm -r test` runs those chains. The desktop chain alone
// holds ~100 suites, so the first failing suite stopped the chain and the ~50 behind it never ran —
// at HEAD that day three failures hid every suite after them, and "the full tier is red" said nothing
// about how much of it was. Here each link of each chain runs on its own, in its package directory with
// that package's `node_modules/.bin` on PATH (what `pnpm run` gives it), and the tier's verdict is the
// list, not the first casualty.
//
// The chain is SPLIT, never re-interpreted: a script may only join plain commands with ` && `. Any
// other shell control (`||`, `;`, `|`, `&` on its own, a subshell, a redirect, a backtick or `$(`) is
// refused with the package named, because splitting such a script would change what it means.
//
// EVERY LINK HAS ITS OWN LIMIT (iteration 3, errors finding 4). One hung suite used to run until the outer
// `with-timeout.mjs` killed the whole group, and the verdict list — never printed — went with it. Each
// link now runs in its own process group under `FABRIC_SUITE_TIMEOUT_S` (default 900): past it the group
// gets SIGTERM, then SIGKILL ten seconds later, and the suite is recorded as exit 124 while the rest run
// on. The outer limit stays as the backstop; when IT stops this runner (SIGTERM/SIGINT), the running
// suite's group is stopped, recorded with its signal, the suites never reached are counted, and the
// verdict is printed before the runner exits.
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { constants } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_SUITE_TIMEOUT_S = 900
const KILL_GRACE_MS = 10_000

/** The per-suite limit in seconds from `FABRIC_SUITE_TIMEOUT_S`, or a thrown refusal of a value that is not one. */
export function suiteTimeoutS(env = process.env) {
  const raw = env.FABRIC_SUITE_TIMEOUT_S
  if (raw === undefined) return DEFAULT_SUITE_TIMEOUT_S
  const n = Number(raw)
  if (!raw.trim() || !Number.isFinite(n) || n <= 0) throw new Error(`FABRIC_SUITE_TIMEOUT_S must be a positive number of seconds, not "${raw}"`)
  return n
}

/** The links of one `test` script, or a thrown refusal naming what cannot be split safely. */
export function splitChain(script, owner = 'a package') {
  if (typeof script !== 'string' || !script.trim()) throw new Error(`${owner} has no test script`)
  const links = script.split(' && ').map((s) => s.trim())
  for (const link of links) {
    if (!link) throw new Error(`${owner}: an empty link in its test chain`)
    // Quoted arguments are data, not control: blank them before looking. A quote left open means the
    // split itself cut through a quoted ` && `, which is refused like any other unsafe chain.
    const bare = link.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""')
    if (/["']/.test(bare.replace(/""/g, '')))
      throw new Error(`${owner}: "${link}" leaves a quote open; the chain cannot be split safely`)
    if (/\|\||;|\||(^|[^&])&($|[^&])|`|\$\(|[<>]|\(|\)/.test(bare))
      throw new Error(`${owner}: "${link}" uses shell control this runner will not split; join plain commands with " && "`)
  }
  return links
}

/** Workspace packages in dependency-first order (packages/* before apps/*), each with its test chain. */
export function workspaceChains(root = ROOT) {
  const out = []
  for (const group of ['packages', 'apps']) {
    const dir = path.join(root, group)
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir).sort()) {
      const manifest = path.join(dir, name, 'package.json')
      if (!existsSync(manifest)) continue
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
      if (!pkg.scripts?.test) continue
      out.push({ name: pkg.name ?? `${group}/${name}`, dir: path.join(dir, name), links: splitChain(pkg.scripts.test, pkg.name ?? name) })
    }
  }
  return out
}

/**
 * Run every link of every chain, one after another. `run(link, cwd, ctx)` returns (or resolves to) an exit
 * status; the default spawns it in its own process group under `timeoutS`. `results` may be passed in so
 * a caller that is stopped from outside still holds what finished; `stopped()` ends the loop early.
 */
export async function runChains(chains, { run = spawnLink, log = (m) => process.stdout.write(m + '\n'), timeoutS = DEFAULT_SUITE_TIMEOUT_S, results = [], stopped = () => false } = {}) {
  for (const chain of chains) {
    for (const [i, link] of chain.links.entries()) {
      if (stopped()) return results
      log(`\n── ${chain.name} [${i + 1}/${chain.links.length}] ${link}`)
      const started = Date.now()
      const status = await run(link, chain.dir, { timeoutS, label: `${chain.name} :: ${link}` })
      results.push({ pkg: chain.name, link, status, seconds: Math.round((Date.now() - started) / 1000) })
      if (status !== 0) log(`── FAILED (exit ${status}): ${chain.name} :: ${link}`)
    }
  }
  return results
}

/** The verdict as text, every failure named; `notRun` counts suites a stop from outside never reached. */
export function summarise(results, notRun = 0) {
  const failed = results.filter((r) => r.status !== 0)
  const lines = [`\n${results.length} suite(s) ran across ${new Set(results.map((r) => r.pkg)).size} package(s); ${results.length - failed.length} passed, ${failed.length} failed.`]
  for (const f of failed) lines.push(`  FAIL (exit ${f.status}) ${f.pkg} :: ${f.link}`)
  if (notRun > 0) lines.push(`  ${notRun} suite(s) not run: the runner was stopped before reaching them.`)
  return { text: lines.join('\n'), failed: failed.length + notRun }
}

/** The link running now, so a stop from outside can end its group: { pid, settle } or null. */
let current = null

const killGroup = (pid, signal) => {
  try {
    process.kill(-pid, signal)
  } catch {
    // The group is already gone: nothing is left to stop.
  }
}

function spawnLink(link, cwd, { timeoutS = DEFAULT_SUITE_TIMEOUT_S, label = link } = {}) {
  const bins = [path.join(cwd, 'node_modules', '.bin'), path.join(ROOT, 'node_modules', '.bin')]
  return new Promise((resolve) => {
    // Its own process group (detached), so a limit can stop everything the suite started. No stdin: a
    // background group reading the terminal would be stopped by the kernel, not by a limit.
    const child = spawn('sh', ['-c', link], {
      cwd, stdio: ['ignore', 'inherit', 'inherit'], detached: true,
      env: { ...process.env, PATH: [...bins, process.env.PATH ?? ''].join(path.delimiter) }
    })
    let timedOut = false
    let killer
    const timer = setTimeout(() => {
      timedOut = true
      console.error(`TIMEOUT after ${timeoutS} s: ${label}`)
      killGroup(child.pid, 'SIGTERM')
      killer = setTimeout(() => killGroup(child.pid, 'SIGKILL'), KILL_GRACE_MS)
    }, timeoutS * 1000)
    const settle = (status) => {
      clearTimeout(timer)
      clearTimeout(killer)
      if (current?.pid === child.pid) current = null
      resolve(status)
    }
    current = { pid: child.pid, settle }
    child.on('error', () => settle(127))
    child.on('exit', (code, signal) => {
      // The leader is gone; anything it left behind in its group goes too.
      killGroup(child.pid, 'SIGKILL')
      if (timedOut) return settle(124)
      settle(code ?? 128 + (constants.signals[signal] ?? constants.signals.SIGTERM))
    })
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // `--root <dir>` points the runner at another workspace (its tests use throwaway ones).
  const at = process.argv.indexOf('--root')
  const root = at > 0 ? process.argv[at + 1] : ROOT
  let chains
  let timeoutS
  try {
    chains = workspaceChains(root)
    timeoutS = suiteTimeoutS()
  } catch (e) {
    console.error(`REFUSED: ${e.message}`)
    process.exit(2)
  }
  if (process.argv.includes('--list')) {
    for (const c of chains) for (const l of c.links) console.log(`${c.name} :: ${l}`)
    console.log(`${chains.reduce((n, c) => n + c.links.length, 0)} suite(s)`)
    process.exit(0)
  }
  const total = chains.reduce((n, c) => n + c.links.length, 0)
  const results = []
  let stopSignal = null
  const verdict = (exitCode) => {
    const notRun = total - results.length
    const { text, failed } = summarise(results, notRun)
    console.log(text)
    process.exit(exitCode ?? (failed ? 1 : 0))
  }
  for (const s of ['SIGTERM', 'SIGINT']) {
    process.on(s, () => {
      if (stopSignal) return
      stopSignal = s
      console.error(`STOPPED by ${s}: ending the running suite and printing the verdict`)
      const code = 128 + constants.signals[s]
      const running = current
      if (!running) return verdict(code)
      // The running suite's group is stopped; its exit records it (with the signal) and the loop ends.
      killGroup(running.pid, 'SIGTERM')
      setTimeout(() => killGroup(running.pid, 'SIGKILL'), 3_000).unref()
    })
  }
  await runChains(chains, { timeoutS, results, stopped: () => stopSignal !== null })
  verdict(stopSignal ? 128 + constants.signals[stopSignal] : undefined)
}
// #endregion run-test-chains

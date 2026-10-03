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
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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

/** Run every link of every chain. `run(link, cwd)` returns an exit status; the default spawns it. */
export function runChains(chains, { run = spawnLink, log = (m) => process.stdout.write(m + '\n') } = {}) {
  const results = []
  for (const chain of chains) {
    chain.links.forEach((link, i) => {
      log(`\n── ${chain.name} [${i + 1}/${chain.links.length}] ${link}`)
      const started = Date.now()
      const status = run(link, chain.dir)
      results.push({ pkg: chain.name, link, status, seconds: Math.round((Date.now() - started) / 1000) })
      if (status !== 0) log(`── FAILED (exit ${status}): ${chain.name} :: ${link}`)
    })
  }
  return results
}

/** The verdict as text, every failure named. */
export function summarise(results) {
  const failed = results.filter((r) => r.status !== 0)
  const lines = [`\n${results.length} suite(s) ran across ${new Set(results.map((r) => r.pkg)).size} package(s); ${results.length - failed.length} passed, ${failed.length} failed.`]
  for (const f of failed) lines.push(`  FAIL (exit ${f.status}) ${f.pkg} :: ${f.link}`)
  return { text: lines.join('\n'), failed: failed.length }
}

function spawnLink(link, cwd) {
  const bins = [path.join(cwd, 'node_modules', '.bin'), path.join(ROOT, 'node_modules', '.bin')]
  const r = spawnSync('sh', ['-c', link], {
    cwd, stdio: 'inherit',
    env: { ...process.env, PATH: [...bins, process.env.PATH ?? ''].join(path.delimiter) }
  })
  if (r.error) return 127
  return r.status ?? 128 + 15
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let chains
  try {
    chains = workspaceChains()
  } catch (e) {
    console.error(`REFUSED: ${e.message}`)
    process.exit(2)
  }
  if (process.argv.includes('--list')) {
    for (const c of chains) for (const l of c.links) console.log(`${c.name} :: ${l}`)
    console.log(`${chains.reduce((n, c) => n + c.links.length, 0)} suite(s)`)
    process.exit(0)
  }
  const { text, failed } = summarise(runChains(chains))
  console.log(text)
  process.exit(failed ? 1 : 0)
}
// #endregion run-test-chains

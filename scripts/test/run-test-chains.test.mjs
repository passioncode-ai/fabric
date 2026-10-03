// scripts/run-test-chains.mjs: one failing suite cannot hide the rest (release review 2026-10-03,
// iteration 2, harness finding 2). `pnpm -r test` ran each package's `a && b && c` chain, so the first
// failure stopped the ~50 desktop suites behind it. The runner runs every link and fails at the end,
// naming every failure. These drive it on throwaway packages: real processes, no database.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { splitChain, workspaceChains, runChains, summarise, suiteTimeoutS } from '../run-test-chains.mjs'

const tool = path.resolve(import.meta.dirname, '../run-test-chains.mjs')

function workspace(scripts) {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-chains-'))
  for (const [where, script] of Object.entries(scripts)) {
    const dir = path.join(root, where)
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: `@t/${path.basename(where)}`, scripts: { test: script } }))
  }
  return root
}

test('a plain chain splits into its links; shell control that splitting would change is refused', () => {
  assert.deepEqual(splitChain('vitest run && node a.mjs && node --experimental-strip-types b.mjs'),
    ['vitest run', 'node a.mjs', 'node --experimental-strip-types b.mjs'])
  for (const bad of ['node a || node b', 'node a; node b', 'node a | tee x', 'node a & node b', 'node a > out', '(node a)', 'node `x`', 'node $(x)'])
    assert.throws(() => splitChain(bad, '@t/x'), /shell control|@t\/x/, bad)
  assert.throws(() => splitChain('', '@t/x'), /no test script/)
  // Quoted arguments are data: parentheses and semicolons inside them are not shell control …
  assert.deepEqual(splitChain(`node -e "process.exit(0); 1" && node b.mjs`), ['node -e "process.exit(0); 1"', 'node b.mjs'])
  // … but a quoted ` && ` would be cut by the split, and that is refused.
  assert.throws(() => splitChain(`node -e "a && b"`, '@t/x'), /quote open/)
})

test('every link runs even after one fails, and the verdict names every failure', async () => {
  const root = workspace({
    'packages/lib': 'node -e "process.exit(0)" && node -e "process.exit(3)" && node -e "process.exit(0)"',
    'apps/app': 'node -e "process.exit(5)" && node -e "process.exit(0)"'
  })
  try {
    // A real run: every link writes a marker, so "ran" is measured, not inferred from the exit code.
    const chains = workspaceChains(root).map((c) => ({
      ...c, links: c.links.map((l, i) => l.replace('node -e "', `node -e "require('fs').writeFileSync('ran-${i}','');`))
    }))
    const results = await runChains(chains, { log: () => {} })
    assert.equal(results.length, 5, 'a link after a failure did not run')
    for (const c of chains) c.links.forEach((_, i) => assert.ok(existsSync(path.join(c.dir, `ran-${i}`)), `${c.name} link ${i + 1} never ran`))
    const { text, failed } = summarise(results)
    assert.equal(failed, 2)
    assert.match(text, /5 suite\(s\) ran across 2 package\(s\); 3 passed, 2 failed/)
    assert.match(text, /FAIL \(exit 3\) @t\/lib/)
    assert.match(text, /FAIL \(exit 5\) @t\/app/)
    assert.deepEqual(results.map((r) => r.pkg), ['@t/lib', '@t/lib', '@t/lib', '@t/app', '@t/app'], 'packages run before apps')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the CLI exits 1 at the end when anything failed and 0 when nothing did', () => {
  // The CLI reads the repository it lives in, so drive the exported pieces through a tiny wrapper that
  // points them at a throwaway root — the exit-code contract is the CLI's, the parts are the module's.
  const root = workspace({ 'packages/a': 'node -e "process.exit(1)" && node -e "process.exit(0)"' })
  const ok = workspace({ 'packages/a': 'node -e "process.exit(0)"' })
  const wrapper = (r) => `import { workspaceChains, runChains, summarise } from ${JSON.stringify(tool)}
const { text, failed } = summarise(await runChains(workspaceChains(${JSON.stringify(r)}), { log: () => {} }))
console.log(text); process.exit(failed ? 1 : 0)`
  try {
    const bad = spawnSync(process.execPath, ['--input-type=module', '-e', wrapper(root)], { encoding: 'utf8' })
    assert.equal(bad.status, 1, bad.stderr)
    assert.match(bad.stdout, /2 suite\(s\) ran/)
    const good = spawnSync(process.execPath, ['--input-type=module', '-e', wrapper(ok)], { encoding: 'utf8' })
    assert.equal(good.status, 0, good.stderr)
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(ok, { recursive: true, force: true })
  }
})

// Iteration 3, errors finding 4 (major): no link had a limit of its own, so one hung suite ran until the
// outer with-timeout killed the whole group — and the verdict list, never printed, went with it.
test('a hung suite is stopped at its own limit as exit 124, its whole group killed, and the rest still run', () => {
  const root = workspace({
    // The first link leaves a grandchild in its group and then hangs; the second must still run.
    'packages/a': `node -e "const c=require('child_process').spawn('sleep',['30'],{stdio:'ignore'});c.unref();require('fs').writeFileSync('gc-pid',''+c.pid);setInterval(()=>{},1000)" && node -e "require('fs').writeFileSync('second','')"`
  })
  try {
    const started = Date.now()
    const r = spawnSync(process.execPath, [tool, '--root', root], { encoding: 'utf8', env: { ...process.env, FABRIC_SUITE_TIMEOUT_S: '1' }, timeout: 30_000 })
    assert.ok(Date.now() - started < 20_000, 'the hung suite was not stopped at its own limit')
    assert.equal(r.status, 1, r.stderr)
    assert.match(r.stdout, /2 suite\(s\) ran across 1 package\(s\); 1 passed, 1 failed/, r.stdout)
    assert.match(r.stdout, /FAIL \(exit 124\) @t\/a :: node -e/, 'the hung suite is recorded as exit 124')
    assert.match(r.stdout + r.stderr, /TIMEOUT after 1 s/, 'the timeout is said')
    assert.ok(existsSync(path.join(root, 'packages/a/second')), 'the suite after the hung one never ran')
    // The grandchild the hung suite left in its group must not survive it.
    const grand = Number(readFileSync(path.join(root, 'packages/a/gc-pid'), 'utf8'))
    assert.ok(grand > 0, 'the grandchild reported its pid')
    const alive = (() => { try { process.kill(grand, 0); return true } catch { return false } })()
    assert.equal(alive, false, 'the grandchild of the hung suite survived its limit')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('stopped from outside (the outer with-timeout), the runner still prints the verdict and names what never ran', () => {
  const root = workspace({
    'packages/a': `node -e "process.exit(3)" && node -e "setInterval(()=>{},1000)" && node -e "process.exit(0)"`
  })
  try {
    const r = spawnSync(process.execPath, [path.resolve(import.meta.dirname, '../with-timeout.mjs'), '3', '--', process.execPath, tool, '--root', root], { encoding: 'utf8', timeout: 30_000 })
    assert.equal(r.status, 124, r.stderr)
    assert.match(r.stdout, /FAIL \(exit 3\) @t\/a/, 'the failure before the stop is still named')
    assert.match(r.stdout, /FAIL \(exit 143\) @t\/a :: node -e "setInterval/, 'the interrupted suite is named with its signal')
    assert.match(r.stdout, /1 suite\(s\) not run/, 'what never ran is counted')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the per-suite limit is read from FABRIC_SUITE_TIMEOUT_S, 900 s by default, and a bad value is refused', () => {
  assert.equal(suiteTimeoutS({}), 900)
  assert.equal(suiteTimeoutS({ FABRIC_SUITE_TIMEOUT_S: '30' }), 30)
  for (const bad of ['0', '-1', 'x', ''])
    assert.throws(() => suiteTimeoutS({ FABRIC_SUITE_TIMEOUT_S: bad }), /FABRIC_SUITE_TIMEOUT_S/, bad)
})

test('the real workspace splits cleanly, and the full tier runs it instead of `pnpm -r test`', () => {
  const chains = workspaceChains()
  const total = chains.reduce((n, c) => n + c.links.length, 0)
  assert.ok(total > 50, `only ${total} suites found`)
  const ci = readFileSync(path.resolve(import.meta.dirname, '../ci.sh'), 'utf8')
  assert.ok(/with-timeout\.mjs "\$\{FABRIC_FULL_TIMEOUT_S:-2700\}" -- node scripts\/run-test-chains\.mjs/.test(ci),
    'ci.sh full does not run the package suites through run-test-chains.mjs')
  assert.ok(!/-- pnpm -r test/.test(ci), 'the full tier still runs `pnpm -r test`, which stops at the first failing suite')
})

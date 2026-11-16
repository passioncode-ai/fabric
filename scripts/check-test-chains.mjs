// Every test file runs somewhere (2026-11-16, the quality waves). Eight desktop test files were written, passed, and
// were never run by any tier: ci.sh names its node tests one by one, so a new file nobody named was silently dead.
// A file under apps/desktop/test/ that ends in .test.mjs must be named by ci.sh, a package.json script, a runner
// beside it (test/run-*.mjs, or a test that starts it as its child) or a workflow; a manual probe says "Manual" in its first five lines.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dir = path.join(root, 'apps/desktop/test')
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')
const walk = (d) => (existsSync(d) ? readdirSync(d, { recursive: true }).map((f) => path.join(d, String(f))) : [])
const callers = [
  read(path.join(root, 'scripts/ci.sh')),
  read(path.join(root, 'package.json')),
  read(path.join(root, 'apps/desktop/package.json')),
  ...walk(path.join(root, 'scripts')).filter((f) => /\.(mjs|sh|cjs)$/.test(f)).map(read),
  ...walk(path.join(root, '.github')).filter((f) => /\.ya?ml$/.test(f)).map(read)
]
const files = readdirSync(dir).filter((f) => f.endsWith('.test.mjs'))
// Another file beside it that starts it (a runner, or a test that drives a probe as its child) also runs it.
const beside = readdirSync(dir).filter((f) => f.endsWith('.mjs')).map((f) => ({ f, text: read(path.join(dir, f)) }))
const dead = []
for (const f of files) {
  const stem = f.replace(/\.test\.mjs$/, '')
  if (callers.some((c) => c.includes(f) || c.includes(`${stem}.test`) || new RegExp(`\\b${stem.replace(/[-]/g, '\\-')}\\b`).test(c))) continue
  if (beside.some((o) => o.f !== f && (o.text.includes(f) || o.text.includes(`${stem}.`)))) continue
  if (/manual/i.test(read(path.join(dir, f)).split('\n').slice(0, 5).join('\n'))) continue
  dead.push(f)
}
if (dead.length) {
  console.error(`FAIL: ${dead.length} test file(s) no tier runs; name each in scripts/ci.sh, or mark a manual probe "Manual" in its first lines:\n  ${dead.join('\n  ')}`)
  process.exit(1)
}
console.log(`PASS test chains: all ${files.length} desktop test files are run by a tier or marked manual`)

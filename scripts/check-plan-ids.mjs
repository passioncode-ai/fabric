// ADR-0101: every work id the general development plan cites resolves to a row, a heading or a file.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { planProblems } from './lib/plan-ids.mjs'
const root = path.resolve(import.meta.dirname, '..')
const files = {}
const walk = (d) => { for (const e of readdirSync(d)) { const p = path.join(d, e); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.md')) files[path.relative(root, p)] = readFileSync(p, 'utf8') } }
walk(path.join(root, 'docs'))
const problems = planProblems(files['docs/evidence/backlog.md'] ?? '', files)
if (problems.length) { for (const p of problems) console.log('  FAIL ' + p); process.exit(1) }
console.log('PASS general plan: every cited id resolves')

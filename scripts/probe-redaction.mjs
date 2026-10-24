#!/usr/bin/env node
// The redaction's no-false-positive probe (CO-386): which lines of real text does one version of
// `shared/redact.ts` change that another left alone? Read-only: it reads JSON payloads, one per line,
// on stdin, and prints counts and, for at most 15 lines, only the text BEFORE the redaction marker
// (never the redacted value).
//
//   git show v0.3.11:apps/desktop/src/shared/redact.ts > /tmp/old-redact.ts
//   psql ... -At -c "set default_transaction_read_only=on;" -c "select payload::text from public.journal" |
//     node --experimental-strip-types scripts/probe-redaction.mjs /tmp/old-redact.ts apps/desktop/src/shared/redact.ts
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const [oldPath, newPath] = process.argv.slice(2)
if (!oldPath || !newPath) { console.error('usage: probe-redaction.mjs <old redact.ts> <new redact.ts> < payloads'); process.exit(2) }
const { redact: oldR } = await import(pathToFileURL(path.resolve(oldPath)).href)
const { redact: newR } = await import(pathToFileURL(path.resolve(newPath)).href)
const strings = []
const walk = (v) => { if (typeof v === 'string') strings.push(v); else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x) }
for (const l of readFileSync(0, 'utf8').split('\n')) { if (!l.trim().startsWith('{')) continue; try { walk(JSON.parse(l)) } catch { /* not a payload */ } }
let lines = 0, onlyNew = 0, onlyOld = 0
const examples = []
for (const s of strings) for (const line of s.split('\n')) {
  lines++
  const a = oldR(line).text !== line, b = newR(line).text !== line
  if (b && !a) { onlyNew++; if (examples.length < 15) { const t = newR(line).text; examples.push(t.slice(Math.max(0, t.indexOf('[REDACTED') - 50), Math.max(0, t.indexOf('[REDACTED'))).replace(/\s+/g, ' ')) } }
  if (a && !b) onlyOld++
}
console.log(JSON.stringify({ strings: strings.length, lines, changedOnlyByNew: onlyNew, changedOnlyByOld: onlyOld }))
for (const e of examples) console.log('  before marker:', e)

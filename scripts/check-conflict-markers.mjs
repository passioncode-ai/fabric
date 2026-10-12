#!/usr/bin/env node
// Fails when a tracked text file still carries a merge conflict block (scripts/lib/conflict-markers.mjs).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { conflictBlocks } from './lib/conflict-markers.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const files = execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\0').filter(Boolean).filter((f) => !/\.(jpe?g|png|gif|webp|ico|icns|pdf|zip|gz|woff2?|ttf|otf|mp4|mov|wasm|dmg)$/i.test(f))
const problems = []
for (const f of files) {
  let text
  try { text = readFileSync(path.join(ROOT, f), 'utf8') } catch {
    // A tracked path that cannot be read as text here (a submodule pointer, a removed file) has no markers to find.
    continue
  }
  if (text.includes('\0')) continue
  for (const [open, mid, close] of conflictBlocks(text)) problems.push(`${f}:${open} — a merge conflict block (=${mid || '?'}, >${close || '?'})`)
}
if (problems.length) {
  for (const p of problems) console.error(`FAIL conflict markers: ${p}`)
  process.exit(1)
}
console.log(`PASS conflict markers: ${files.length} tracked text files carry no merge conflict block`)

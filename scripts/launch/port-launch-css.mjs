#!/usr/bin/env node
// The launch design's stylesheet, ported from the prototype (SCR-30…SCR-41).
//
//   node scripts/launch/port-launch-css.mjs          # rewrite the ported block of launch.css
//   node scripts/launch/port-launch-css.mjs --check  # fail when it no longer matches product.html
//
// The app's launch screens are built to docs/reports/product.html, and "looks like the design"
// is only checkable if the design's own rules are what the app runs. So the rules are not
// re-typed: every rule of the prototype's stylesheet whose selector names the launch series
// (`.lp`, `.lp-*`, `.lh-*`, `.fp-*`, `.calm-*`) or its shell (`.workbench`, `.app-sidebar`,
// `.app-nav`, `.app-logo`, `.app-main`, `.scope-bar`, `.brand-mark`) is copied, in the
// prototype's order — later rules win there, so they must win here — and so is the one
// animation the series uses. Selectors of the report frame, its panels and its CEO dock are
// left out: the app has its own. The block sits between two markers in launch.css; what is
// outside the markers (the frame variables, the adaptations to a window) is hand-written.

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
const PROTOTYPE = path.join(root, 'docs', 'reports', 'product.html')
const TARGET = path.join(root, 'apps', 'desktop', 'src', 'renderer', 'src', 'launch', 'launch.css')
const BEGIN = '/* ── ported from docs/reports/product.html ── */\n'
const END = '\n/* ── adaptations to the app window ── */'

const INCLUDE = /\.(lp|lh-|lp-|fp-|calm-|app-sidebar|app-nav|app-logo|scope-bar|workbench|app-main|brand-mark)/
// `body` and `html` as ELEMENTS only: a class that merely ends in "-body" (`.lp-agent-body`) is the
// launch series' own and must be ported — a `\bbody\b` test dropped it, silently.
const EXCLUDE = /\.(panel|report|prototype|screen-|mock-|ceo-)|:root|(^|[\s>+~,(])(body|html)\b|data-theme/

/** Top-level blocks, by brace depth. */
function blocks(css) {
  const out = []
  let buf = '', depth = 0
  for (const ch of css) {
    buf += ch
    if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) { out.push(buf.trim()); buf = '' }
  }
  return out
}

/** A selector list split on its top-level commas: `:is(a,b)` is one selector, not two. */
function selectors(list) {
  const out = []
  let buf = '', depth = 0
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { out.push(buf.trim()); buf = '' } else buf += ch
  }
  out.push(buf.trim())
  return out
}

const keep = (list) => selectors(list).filter((s) => INCLUDE.test(s) && !EXCLUDE.test(s)).join(',')

export function portedRules(html) {
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1])
  if (!styles.length) throw new Error('the prototype carries no <style> block')
  const css = styles.sort((a, b) => b.length - a.length)[0].replace(/\/\*[\s\S]*?\*\//g, '')
  const out = []
  for (const rule of blocks(css)) {
    const at = rule.indexOf('{'), head = rule.slice(0, at), body = rule.slice(at + 1)
    if (head.startsWith('@media') || head.startsWith('@supports')) {
      const inner = blocks(body.slice(0, -1)).map((r) => {
        const i = r.indexOf('{'), k = keep(r.slice(0, i))
        return k ? k + '{' + r.slice(i + 1) : null
      }).filter(Boolean)
      if (inner.length) out.push(head + '{' + inner.join('') + '}')
    } else if (head.startsWith('@')) {
      if (head.includes('fabric-live')) out.push(rule)
    } else {
      const k = keep(head)
      if (k) out.push(k + '{' + body)
    }
  }
  return out.join('\n')
}

const current = readFileSync(TARGET, 'utf8')
const a = current.indexOf(BEGIN), b = current.indexOf(END)
if (a < 0 || b < a) throw new Error(`launch.css lost its markers: ${BEGIN.trim()} … ${END.trim()}`)
const next = current.slice(0, a + BEGIN.length) + portedRules(readFileSync(PROTOTYPE, 'utf8')) + current.slice(b)
if (process.argv.includes('--check')) {
  if (next !== current) {
    console.error('launch.css no longer matches the prototype: node scripts/launch/port-launch-css.mjs')
    process.exit(1)
  }
  console.log('PASS launch.css carries the prototype\'s launch rules, in its order')
} else {
  writeFileSync(TARGET, next)
  console.log(`Ported ${portedRules(readFileSync(PROTOTYPE, 'utf8')).split('\n').length} rules into ${path.relative(root, TARGET)}`)
}

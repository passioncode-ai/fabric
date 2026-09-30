#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const MASTER = path.join(
  ROOT,
  'assets/brand/favicon/source/passioncode-passion-fruit.svg',
)
const OUTPUT = path.join(ROOT, 'assets/brand/favicon')
const SIZES = [1024, 512, 256, 128, 64]
const VARIANTS = {
  transparent: null,
  dark: '#0A0A0A',
  white: '#FFFFFF',
}
const CHECK = process.argv.includes('--check')

const master = readFileSync(MASTER, 'utf8')
const parsed = master.match(/^<svg[^>]*>([\s\S]*)<\/svg>\s*$/)
if (!parsed) throw new Error(`Cannot parse master SVG: ${MASTER}`)

const body = parsed[1].trim()
const metadata = body.match(
  /^(<title\b[\s\S]*?<\/title>\s*<desc\b[\s\S]*?<\/desc>)([\s\S]*)$/,
)
if (!metadata) throw new Error('Master SVG must begin with title and description')

const [, accessibleText, artwork] = metadata
const forbidden = master.match(
  /<(?:image|filter|radialGradient|mask|pattern|text)\b/i,
)
if (forbidden) throw new Error(`Master contains an unsupported element: ${forbidden[0]}`)

const colours = new Set(master.match(/#[0-9A-Fa-f]{6}\b/g) ?? [])
if (colours.size !== 8) {
  throw new Error(`Master must contain exactly eight gradient colours; found ${colours.size}`)
}

const gradients = master.match(/<linearGradient\b/g) ?? []
if (gradients.length !== 4) {
  throw new Error(`Master must contain exactly four linear gradients; found ${gradients.length}`)
}

function render(size, background) {
  const backgroundRect = background
    ? `\n  <rect width="1024" height="1024" fill="${background}"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024" role="img" aria-labelledby="passioncode-mark-title passioncode-mark-desc">\n  ${accessibleText.replaceAll('\n', '\n  ')}${backgroundRect}\n  ${artwork.trim().replaceAll('\n', '\n  ')}\n</svg>\n`
}

let failures = 0
let checked = 0

for (const [variant, background] of Object.entries(VARIANTS)) {
  const directory = path.join(OUTPUT, variant)
  if (!CHECK) mkdirSync(directory, { recursive: true })

  for (const size of SIZES) {
    const target = path.join(directory, `passioncode-favicon-${size}.svg`)
    const expected = render(size, background)
    checked++

    if (CHECK) {
      let actual = ''
      try {
        actual = readFileSync(target, 'utf8')
      } catch {
        console.error(`FAIL missing ${path.relative(ROOT, target)}`)
        failures++
        continue
      }
      if (actual !== expected) {
        console.error(`FAIL stale ${path.relative(ROOT, target)}`)
        failures++
      }
    } else {
      writeFileSync(target, expected)
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} brand icon file(s) missing or stale`)
  process.exit(1)
}

console.log(
  CHECK
    ? `PASS: ${checked} brand icon SVGs match the master`
    : `Built ${checked} brand icon SVGs from ${path.relative(ROOT, MASTER)}`,
)

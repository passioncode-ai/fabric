#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SVG_ROOT = path.join(ROOT, 'assets/brand/favicon')
const MASTER = path.join(SVG_ROOT, 'source/passioncode-passion-fruit.svg')
const OUTPUT = path.join(ROOT, 'assets/brand/brand-pack')
const MANIFEST = path.join(OUTPUT, 'manifest.json')
const SIZES = [1024, 512, 256, 128, 64]
const PNG_VARIANTS = ['transparent', 'dark', 'white']
const JPG_VARIANTS = ['dark', 'white']
const BACKGROUNDS = {
  transparent: null,
  dark: '#0A0A0A',
  white: '#FFFFFF',
}
const CHECK = process.argv.includes('--check')

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function relativeToOutput(file) {
  return path.relative(OUTPUT, file).split(path.sep).join('/')
}

function runSips(source, target, format) {
  const args = ['-s', 'format', format]
  if (format === 'jpeg') args.push('-s', 'formatOptions', '95')
  args.push(source, '--out', target)

  const result = spawnSync('sips', args, { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(
      `sips failed for ${path.relative(ROOT, target)}:\n${result.stderr || result.stdout}`,
    )
  }
}

function jpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('Invalid JPEG signature')
  }

  let offset = 2
  while (offset < buffer.length) {
    while (buffer[offset] === 0xff) offset++
    const marker = buffer[offset++]
    if (marker === 0xd8 || marker === 0xd9) continue
    if (marker === 0xda) break

    const length = buffer.readUInt16BE(offset)
    const isStartOfFrame = [
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
      0xce, 0xcf,
    ].includes(marker)
    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      }
    }
    offset += length
  }

  throw new Error('JPEG dimensions not found')
}

function imageMetadata(file) {
  const buffer = readFileSync(file)
  const extension = path.extname(file).toLowerCase()

  if (extension === '.png') {
    const signature = '89504e470d0a1a0a'
    if (buffer.subarray(0, 8).toString('hex') !== signature) {
      throw new Error('Invalid PNG signature')
    }
    return {
      format: 'png',
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      alphaChannel: [4, 6].includes(buffer[25]),
    }
  }

  if (extension === '.jpg') {
    return { format: 'jpg', ...jpegDimensions(buffer), alphaChannel: false }
  }

  throw new Error(`Unsupported image format: ${extension}`)
}

function previewSvg(images) {
  const tile = ({ x, fill, pattern, label, note, image }) => `
    <g transform="translate(${x} 250)">
      <rect width="380" height="430" rx="30" fill="${fill}"/>
      ${pattern ? '<rect width="380" height="360" rx="30" fill="url(#checker)"/>' : ''}
      <image x="40" y="30" width="300" height="300" href="data:image/png;base64,${image}"/>
      <text x="28" y="390" class="tile-label" fill="${fill === '#FFFFFF' ? '#0A0A0A' : '#FFFFFF'}">${label}</text>
      <text x="28" y="414" class="tile-note" fill="${fill === '#FFFFFF' ? '#5B5B5B' : '#B9B4BD'}">${note}</text>
    </g>`

  const swatches = [
    ['Rind', 'url(#swatch-rind)', '#2D0039 — #4B0354'],
    ['Interior', 'url(#swatch-interior)', '#F20673 — #D90066'],
    ['Flesh', 'url(#swatch-flesh)', '#FFD21A — #F5B800'],
    ['Seed', 'url(#swatch-seed)', '#41054B — #26002F'],
    ['Canvas', '#0A0A0A', '#0A0A0A'],
  ]
    .map(
      ([name, colour, value], index) => `
      <g transform="translate(${120 + index * 280} 828)">
        <rect width="248" height="86" rx="18" fill="#151515" stroke="#292929"/>
        <circle cx="44" cy="43" r="24" fill="${colour}"/>
        <text x="82" y="37" class="swatch-name">${name}</text>
        <text x="82" y="60" class="swatch-hex">${value}</text>
      </g>`,
    )
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <title>PassionCode.ai graphical brand pack overview</title>
  <defs>
    <pattern id="checker" width="32" height="32" patternUnits="userSpaceOnUse">
      <rect width="32" height="32" fill="#F6F4F7"/>
      <rect width="16" height="16" fill="#E8E4EA"/>
      <rect x="16" y="16" width="16" height="16" fill="#E8E4EA"/>
    </pattern>
    <linearGradient id="swatch-rind"><stop stop-color="#2D0039"/><stop offset="1" stop-color="#4B0354"/></linearGradient>
    <linearGradient id="swatch-interior"><stop stop-color="#F20673"/><stop offset="1" stop-color="#D90066"/></linearGradient>
    <linearGradient id="swatch-flesh"><stop stop-color="#FFD21A"/><stop offset="1" stop-color="#F5B800"/></linearGradient>
    <linearGradient id="swatch-seed"><stop stop-color="#41054B"/><stop offset="1" stop-color="#26002F"/></linearGradient>
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .eyebrow { font-size: 22px; font-weight: 650; letter-spacing: 4px; }
      .title { font-size: 68px; font-weight: 720; letter-spacing: -2px; }
      .subtitle { font-size: 26px; font-weight: 420; }
      .tile-label { font-size: 24px; font-weight: 680; }
      .tile-note { font-size: 17px; font-weight: 450; }
      .swatch-name { fill: #FFFFFF; font-size: 17px; font-weight: 650; }
      .swatch-hex { fill: #9C969F; font-size: 12px; font-weight: 520; letter-spacing: .2px; }
      .meta { fill: #8D878F; font-size: 18px; font-weight: 520; }
    </style>
  </defs>
  <rect width="1920" height="1080" fill="#0A0A0A"/>
  <text x="120" y="92" class="eyebrow" fill="#FFC91C">PASSIONCODE.AI</text>
  <text x="120" y="166" class="title" fill="#FFFFFF">Passion fruit mark</text>
  <text x="120" y="210" class="subtitle" fill="#9C969F">Raster asset family · PNG + JPG · 64—1024 px</text>
  ${tile({ x: 120, fill: '#111111', pattern: true, label: 'Transparent', note: 'PNG · true alpha canvas', image: images.transparent })}
  ${tile({ x: 560, fill: '#0A0A0A', pattern: false, label: 'Dark', note: 'PNG + JPG · #0A0A0A canvas', image: images.dark })}
  ${tile({ x: 1000, fill: '#FFFFFF', pattern: false, label: 'White', note: 'PNG + JPG · #FFFFFF canvas', image: images.white })}
  <g transform="translate(1480 250)">
    <text class="eyebrow" fill="#FF0A78" x="0" y="8">EXPORTS</text>
    <text class="title" fill="#FFFFFF" x="0" y="82" style="font-size:52px">27 assets</text>
    <text class="meta" x="0" y="135">15 PNG icons</text>
    <text class="meta" x="0" y="174">10 JPG icons</text>
    <text class="meta" x="0" y="213">2 overview boards</text>
    <rect x="0" y="256" width="300" height="1" fill="#2B2B2B"/>
    <text class="meta" x="0" y="310">One canonical SVG source</text>
    <text class="meta" x="0" y="349">Soft vector gradients</text>
    <text class="meta" x="0" y="388">Symmetric geometry</text>
  </g>
  <text x="120" y="782" class="eyebrow" fill="#FFFFFF">CORE PALETTE</text>
  ${swatches}
  <text x="120" y="1004" class="meta">Use the mark as the single chromatic brand object. Keep product controls monochrome.</text>
</svg>\n`
}

function expectedIconEntries() {
  const entries = []
  for (const variant of PNG_VARIANTS) {
    for (const size of SIZES) {
      entries.push({
        path: `png/${variant}/passioncode-icon-${size}.png`,
        format: 'png',
        variant,
        size,
        width: size,
        height: size,
        background: BACKGROUNDS[variant],
      })
    }
  }
  for (const variant of JPG_VARIANTS) {
    for (const size of SIZES) {
      entries.push({
        path: `jpg/${variant}/passioncode-icon-${size}.jpg`,
        format: 'jpg',
        variant,
        size,
        width: size,
        height: size,
        background: BACKGROUNDS[variant],
      })
    }
  }
  entries.push(
    {
      path: 'preview/passioncode-brand-pack-overview.png',
      format: 'png',
      variant: 'overview',
      size: 1920,
      width: 1920,
      height: 1080,
      background: '#0A0A0A',
    },
    {
      path: 'preview/passioncode-brand-pack-overview.jpg',
      format: 'jpg',
      variant: 'overview',
      size: 1920,
      width: 1920,
      height: 1080,
      background: '#0A0A0A',
    },
  )
  return entries
}

function build() {
  const probe = spawnSync('sips', ['--version'], { encoding: 'utf8' })
  if (probe.status !== 0) {
    throw new Error('Raster export requires macOS sips; use --check elsewhere')
  }

  const entries = expectedIconEntries()
  for (const entry of entries) {
    mkdirSync(path.dirname(path.join(OUTPUT, entry.path)), { recursive: true })
  }

  for (const variant of PNG_VARIANTS) {
    for (const size of SIZES) {
      const source = path.join(
        SVG_ROOT,
        variant,
        `passioncode-favicon-${size}.svg`,
      )
      const target = path.join(
        OUTPUT,
        'png',
        variant,
        `passioncode-icon-${size}.png`,
      )
      runSips(source, target, 'png')
    }
  }

  for (const variant of JPG_VARIANTS) {
    for (const size of SIZES) {
      const source = path.join(
        SVG_ROOT,
        variant,
        `passioncode-favicon-${size}.svg`,
      )
      const target = path.join(
        OUTPUT,
        'jpg',
        variant,
        `passioncode-icon-${size}.jpg`,
      )
      runSips(source, target, 'jpeg')
    }
  }

  const previewImages = Object.fromEntries(
    PNG_VARIANTS.map((variant) => [
      variant,
      readFileSync(
        path.join(OUTPUT, 'png', variant, 'passioncode-icon-1024.png'),
      ).toString('base64'),
    ]),
  )

  const temporary = mkdtempSync(path.join(os.tmpdir(), 'passioncode-brand-pack-'))
  try {
    const previewSource = path.join(temporary, 'overview.svg')
    writeFileSync(previewSource, previewSvg(previewImages))
    runSips(
      previewSource,
      path.join(OUTPUT, 'preview/passioncode-brand-pack-overview.png'),
      'png',
    )
    runSips(
      previewSource,
      path.join(OUTPUT, 'preview/passioncode-brand-pack-overview.jpg'),
      'jpeg',
    )
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }

  const exports = entries.map((entry) => ({
    ...entry,
    sha256: sha256(path.join(OUTPUT, entry.path)),
  }))
  const manifest = {
    version: 1,
    brand: 'PassionCode.ai',
    source: '../favicon/source/passioncode-passion-fruit.svg',
    sourceSha256: sha256(MASTER),
    palette: {
      rind: ['#2D0039', '#4B0354'],
      interior: ['#F20673', '#D90066'],
      flesh: ['#FFD21A', '#F5B800'],
      seed: ['#41054B', '#26002F'],
      darkCanvas: '#0A0A0A',
      whiteCanvas: '#FFFFFF',
    },
    sizes: SIZES,
    exports,
  }
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(
    `Built ${exports.length} raster brand assets in ${path.relative(ROOT, OUTPUT)}`,
  )
}

function collectRasterFiles(directory) {
  if (!existsSync(directory)) return []
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...collectRasterFiles(target))
    if (entry.isFile() && /\.(?:png|jpg)$/i.test(entry.name)) files.push(target)
  }
  return files
}

function check() {
  let failures = 0
  const fail = (message) => {
    console.error(`FAIL ${message}`)
    failures++
  }

  if (!existsSync(MANIFEST)) {
    fail(`missing ${path.relative(ROOT, MANIFEST)}`)
  }

  let manifest
  if (existsSync(MANIFEST)) {
    try {
      manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
    } catch (error) {
      fail(`invalid manifest: ${error.message}`)
    }
  }

  const expected = expectedIconEntries()
  const expectedPaths = new Set(expected.map((entry) => entry.path))
  const actualPaths = new Set(
    collectRasterFiles(OUTPUT).map((file) => relativeToOutput(file)),
  )

  for (const file of expectedPaths) {
    if (!actualPaths.has(file)) fail(`missing ${file}`)
  }
  for (const file of actualPaths) {
    if (!expectedPaths.has(file)) fail(`unexpected raster asset ${file}`)
  }

  if (manifest) {
    if (manifest.sourceSha256 !== sha256(MASTER)) {
      fail('manifest source hash does not match the canonical SVG')
    }

    const manifestEntries = new Map(
      (manifest.exports ?? []).map((entry) => [entry.path, entry]),
    )
    if (manifestEntries.size !== expected.length) {
      fail(`manifest contains ${manifestEntries.size} exports; expected ${expected.length}`)
    }

    for (const expectedEntry of expected) {
      const target = path.join(OUTPUT, expectedEntry.path)
      const recorded = manifestEntries.get(expectedEntry.path)
      if (!recorded) {
        fail(`manifest missing ${expectedEntry.path}`)
        continue
      }
      for (const key of [
        'format',
        'variant',
        'size',
        'width',
        'height',
        'background',
      ]) {
        if (recorded[key] !== expectedEntry[key]) {
          fail(`manifest ${expectedEntry.path} has wrong ${key}`)
        }
      }
      if (!existsSync(target)) continue

      try {
        const metadata = imageMetadata(target)
        if (metadata.format !== expectedEntry.format) {
          fail(`${expectedEntry.path} is ${metadata.format}, expected ${expectedEntry.format}`)
        }
        if (
          metadata.width !== expectedEntry.width ||
          metadata.height !== expectedEntry.height
        ) {
          fail(
            `${expectedEntry.path} is ${metadata.width}x${metadata.height}, expected ${expectedEntry.width}x${expectedEntry.height}`,
          )
        }
        if (expectedEntry.variant === 'transparent' && !metadata.alphaChannel) {
          fail(`${expectedEntry.path} has no alpha channel`)
        }
        if (recorded.sha256 !== sha256(target)) {
          fail(`${expectedEntry.path} checksum differs from manifest`)
        }
      } catch (error) {
        fail(`${expectedEntry.path}: ${error.message}`)
      }
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} brand-pack check(s) failed`)
    process.exit(1)
  }

  console.log(`PASS: ${expected.length} raster brand assets match the manifest`)
}

if (CHECK) check()
else build()

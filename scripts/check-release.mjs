#!/usr/bin/env node
// The build's identity comes from the artifact, never from git at runtime (S07).
//
// WHY A SCRIPT. The rule is one line to state and one line to break, and the
// break is invisible: `execSync('git rev-parse HEAD')` in the main process
// answers instantly, looks correct in development, and in a packaged app
// reports a commit belonging to whatever directory the operator launched it
// from — with total confidence. There is no test that fails, because in a
// checkout it is right. It is wrong exactly where nobody runs the tests.
//
// THREE RULES.
//
//   1. The main process does not ask git about ITSELF. Reading a repository the
//      operator pointed at is the product's whole job (`gitRun`, `codeStats`,
//      `repoState`) and stays allowed; what is refused is asking about the
//      build's own provenance, which is what `rev-parse HEAD` with no repo path
//      is doing.
//   2. A manifest reader states the dirty flag. A build that carries a commit
//      sha while containing code that commit does not have is the failure the
//      flag exists for, and a reader that drops it hands out the sha alone.
//   3. The generator exists and writes the declared schema. A manifest whose
//      schema string nobody produces is a contract with one side.
//
// AND FOUR MORE, added by FA-01, because every one of them was false at HEAD
// while this gate was green — a gate that proves three true things about a
// build nobody can produce, ship or trust is a gate reporting on the wrong
// subject:
//
//   4. The generator makes the directory it writes into. `resources/` is
//      generated and git-ignored, so on every fresh clone it does not exist and
//      the producer exited 1 with ENOENT — failing CI BEFORE the build.
//   5. Identity is not arithmetic about content. `buildId` hashed
//      `files.length`, so a changed byte left two different bundles sharing one
//      identity, and both the producer and this gate now take the formula from
//      one file instead of restating it (R-005).
//   6. The manifest is inside the artifact. All three runtime lookup paths miss
//      in a packaged app unless the packaging config carries it, and the miss
//      returns the same honest `null` as a build that was never stamped.
//   7. The manifest describes the bundle sitting beside it. It used to be
//      generated twenty steps before the build, so it measured the PREVIOUS
//      one — which reads exactly like measuring this one.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { ARTIFACT_ABSENT, artifactDigest, collectArtifactFiles } from './lib/build-identity.mjs'

const MAIN = 'apps/desktop/src/main'
const CONTRACT = 'apps/desktop/src/shared/buildManifest.ts'
const GENERATOR = 'scripts/build-manifest.mjs'
const IDENTITY = 'scripts/lib/build-identity.mjs'
const PACKAGING = 'apps/desktop/electron-builder.yml'
const PIPELINE = 'scripts/ci.sh'
const ARTIFACT = 'apps/desktop/out'
const MANIFEST = 'apps/desktop/resources/build-manifest.json'

/**
 * Blank every comment, keeping the offsets so line numbers stay true.
 *
 * The first version of this gate fired on the COMMENT in `index.ts` that
 * explains the rule — a gate that refuses the sentence describing it teaches
 * the next author to delete the explanation, which is the opposite of what it
 * is for. The rule is about code.
 */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

const problems = []

// ——— 1 · nothing asks git who WE are
for (const file of walk(MAIN)) {
  const raw = readFileSync(file, 'utf8')
  const src = codeOnly(raw)
  const lineOf = (i) => raw.slice(0, i).split('\n').length
  for (const m of src.matchAll(/['"`]rev-parse['"`]|['"`]describe['"`]|git\s+rev-parse/g)) {
    // `gitRun(repoPath, ['rev-parse', '--git-dir'])` asks about a repository the
    // OPERATOR named, which is the product working as intended. The refused
    // shape is a provenance question with no repository behind it.
    const around = src.slice(Math.max(0, m.index - 200), m.index + 200)
    if (/repoPath|repo\.path|input\.path|dir\b/.test(around)) continue
    problems.push(
      `${file}:${lineOf(m.index)}  the main process asks git for its own provenance. ` +
        `A packaged app has no repository under it, so this answers about whatever directory it was ` +
        `launched from — read the build manifest instead (${CONTRACT}).`
    )
  }
}

// ——— 2 · the reader states the dirty flag
const contract = readFileSync(CONTRACT, 'utf8')
if (!/sourceDirty/.test(contract))
  problems.push(`${CONTRACT}  the manifest has no dirty flag, so a commit sha stands alone`)
const readerBody = /export function readManifest[\s\S]*?\n}/.exec(contract)
if (readerBody && !/sourceDirty/.test(readerBody[0]))
  problems.push(
    `${CONTRACT}  readManifest does not check sourceDirty — a manifest may then carry a commit ` +
      `sha for code it does not contain`
  )

// ——— 3 · the generator produces what the reader demands
let generator = ''
try {
  generator = readFileSync(GENERATOR, 'utf8')
} catch {
  problems.push(`${GENERATOR}  missing: the manifest schema has a reader and no producer`)
}
const declared = /export const MANIFEST_SCHEMA = '([^']+)'/.exec(contract)?.[1]
if (generator && declared && !generator.includes(declared))
  problems.push(
    `${GENERATOR}  writes a manifest the reader will refuse: the contract declares ${declared}`
  )
if (generator && !/sourceDirty/.test(generator))
  problems.push(`${GENERATOR}  does not record whether the source was clean`)

// ——— 4 · the producer creates the directory it writes into
let identity = ''
try {
  identity = readFileSync(IDENTITY, 'utf8')
} catch {
  problems.push(`${IDENTITY}  missing: the identity formula has no single home, so producer and gate will drift`)
}
if (generator && !/mkdirSync\([\s\S]{0,160}?recursive:\s*true/.test(codeOnly(generator)))
  problems.push(
    `${GENERATOR}  writes without creating its output directory. ` +
      `${path.dirname(MANIFEST)} is generated and git-ignored, so a fresh clone has no such directory ` +
      `and this exits 1 with ENOENT before the build it describes.`
  )

// ——— 5 · identity is content, not arithmetic about content
const genCode = codeOnly(generator)
// The ASSIGNMENT, never the file. The first version of this rule searched the
// whole source for `buildIdOf` and passed against a generator that had gone back
// to hashing a count — because the name was still sitting in the import line it
// no longer used. A gate satisfied by an import proves the module was mentioned,
// not that it was called.
const assignment = /\bbuildId:\s*([^\n]*)/.exec(genCode)?.[1] ?? ''
if (generator && !assignment)
  problems.push(`${GENERATOR}  writes no buildId, so the manifest has no identity to read`)
if (assignment && /files\.length|\.length\b/.test(assignment))
  problems.push(
    `${GENERATOR}  derives buildId from the file COUNT. Two bundles with the same number of files and ` +
      `different code inside them then share an identity, which is the one thing an identity may not do.`
  )
if (assignment && !assignment.includes('buildIdOf'))
  problems.push(
    `${GENERATOR}  computes its own identity instead of calling ${IDENTITY}. Two copies of the formula ` +
      `drift into agreeing about a build neither of them describes (R-005).`
  )

// ——— 6 · the identity ships inside the artifact
let packaging = ''
try {
  packaging = readFileSync(PACKAGING, 'utf8')
} catch {
  problems.push(`${PACKAGING}  missing: nothing declares what the packaged app contains`)
}
// Comments stripped first. The first version of this rule matched the YAML
// comment that EXPLAINS why the manifest ships, so deleting the entry beneath it
// left the gate green — a config checked by substring is a config that passes on
// its own prose.
const packagedFiles = packaging
  .split('\n')
  .map((line) => line.replace(/#.*$/, '').trim())
  .filter(Boolean)
  .join('\n')
if (packaging && !packagedFiles.includes(path.basename(MANIFEST)))
  problems.push(
    `${PACKAGING}  does not ship ${path.basename(MANIFEST)}. Every runtime lookup path then misses inside a ` +
      `packaged app, and the product whose job is to say which build it is answers null.`
  )

// ——— 7 · the manifest describes the bundle beside it, not a previous one
const pipeline = (() => {
  try {
    return readFileSync(PIPELINE, 'utf8')
  } catch {
    return ''
  }
})()
if (pipeline) {
  const built = pipeline.indexOf('electron-vite build')
  const stamped = pipeline.indexOf('node scripts/build-manifest.mjs')
  if (built !== -1 && stamped !== -1 && stamped < built)
    problems.push(
      `${PIPELINE}  stamps the build before building it, so the manifest describes the PREVIOUS artifact ` +
        `(or none) while reading exactly like a measurement of this one.`
    )
}
if (existsSync(MANIFEST)) {
  const onDisk = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const measured = artifactDigest(collectArtifactFiles(ARTIFACT))
  if (onDisk.artifactDigest !== measured)
    problems.push(
      `${MANIFEST}  is stale: it claims artifact ${String(onDisk.artifactDigest).slice(0, 12)} and ` +
        `${ARTIFACT} measures ${measured.slice(0, 12)}. Regenerate it AFTER the build.`
    )
  if (measured === ARTIFACT_ABSENT && existsSync(ARTIFACT))
    problems.push(`${ARTIFACT}  exists and is empty, so the artifact digest is a word rather than a measurement`)
} else {
  problems.push(
    `${MANIFEST}  absent. ${GENERATOR} runs immediately before this gate in ${PIPELINE}; a missing manifest ` +
      `here means the build shipped without an identity.`
  )
}

if (problems.length) {
  console.error(`release: ${problems.length} problem(s) with how this build identifies itself\n`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

console.log(
  `release: the build identity is read from the artifact, states whether the source was clean, ` +
    `and ${declared} has both a producer and a reader`
)

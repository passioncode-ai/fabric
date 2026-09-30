// FA-01. What a build says it is must be a fact about the bytes it contains.
//
// MEASURED BEFORE THIS EXISTED (2026-09-09, worktree at HEAD):
//   1. `node scripts/build-manifest.mjs` exited 1 with ENOENT on a fresh
//      checkout, because `apps/desktop/resources/` is generated and ignored and
//      the producer wrote into a directory nobody had created. Every cold clone
//      and every CI run failed BEFORE the build it was supposed to describe.
//   2. `buildId` was a digest of `files.length`. Changing a byte inside a
//      bundle left the identity untouched, so two different pieces of software
//      answered the question "which build is this" identically.
//
// So identity is computed HERE, once, from content — and both the producer and
// the gate that checks it import this file rather than restating the formula.

import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  ARTIFACT_ABSENT,
  artifactDigest,
  buildIdOf,
  collectArtifactFiles
} from '../lib/build-identity.mjs'

const temp = () => mkdtempSync(path.join(tmpdir(), 'fa01-'))
const file = (root, rel, body) => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  writeFileSync(path.join(root, rel), body)
}

test('one changed byte changes the digest, and the file COUNT cannot stand in for it', () => {
  const a = temp()
  const b = temp()
  try {
    file(a, 'main/index.js', 'console.log(1)')
    file(a, 'renderer/app.js', 'x')
    file(b, 'main/index.js', 'console.log(2)')
    file(b, 'renderer/app.js', 'x')
    const fa = collectArtifactFiles(a)
    const fb = collectArtifactFiles(b)
    // The defect this replaces: identical counts, different software.
    assert.equal(fa.length, fb.length)
    assert.notEqual(artifactDigest(fa), artifactDigest(fb))
    assert.notEqual(
      buildIdOf({ commitSha: 'c', sourceDirty: false, lockfileSha256: 'l', artifactDigest: artifactDigest(fa) }),
      buildIdOf({ commitSha: 'c', sourceDirty: false, lockfileSha256: 'l', artifactDigest: artifactDigest(fb) })
    )
  } finally {
    rmSync(a, { recursive: true, force: true })
    rmSync(b, { recursive: true, force: true })
  }
})

test('the digest is a fact about the artifact, not about the order the disk returned it in', () => {
  const root = temp()
  try {
    file(root, 'a.js', 'one')
    file(root, 'b.js', 'two')
    const files = collectArtifactFiles(root)
    const shuffled = [...files].reverse()
    assert.equal(artifactDigest(files), artifactDigest(shuffled))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a path that moved changes the digest even when every byte is the same', () => {
  const a = temp()
  const b = temp()
  try {
    file(a, 'main/index.js', 'same')
    file(b, 'renderer/index.js', 'same')
    assert.notEqual(artifactDigest(collectArtifactFiles(a)), artifactDigest(collectArtifactFiles(b)))
  } finally {
    rmSync(a, { recursive: true, force: true })
    rmSync(b, { recursive: true, force: true })
  }
})

test('no bundle yet is its own answer, never the digest of nothing', () => {
  const root = temp()
  try {
    const files = collectArtifactFiles(path.join(root, 'never-built'))
    assert.deepEqual(files, [])
    assert.equal(artifactDigest(files), ARTIFACT_ABSENT)
    // An absent artifact and a real one must never collide.
    file(root, 'out.js', '')
    assert.notEqual(artifactDigest(collectArtifactFiles(root)), ARTIFACT_ABSENT)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the producer creates the directory it writes into, so a cold checkout does not fail before the build', () => {
  const root = temp()
  try {
    const out = path.join(root, 'never', 'created', 'build-manifest.json')
    assert.equal(existsSync(path.dirname(out)), false)
    execFileSync('node', ['scripts/build-manifest.mjs', out], {
      cwd: path.resolve(import.meta.dirname, '..', '..'),
      encoding: 'utf8'
    })
    const manifest = JSON.parse(readFileSync(out, 'utf8'))
    assert.equal(typeof manifest.artifactDigest, 'string')
    assert.equal(manifest.buildId.length > 0, true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

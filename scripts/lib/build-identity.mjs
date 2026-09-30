// The one definition of what a build IS (S07 · FA-01).
//
// R-005 is why this file exists rather than two copies. The producer writes the
// identity and the release gate checks it; if each computed the formula itself,
// the day one of them changed the other would keep agreeing with a build that
// no longer existed — and neither would look wrong on its own.
//
// IDENTITY IS CONTENT, NOT ARITHMETIC ABOUT CONTENT. The formula this replaces
// hashed `files.length`. Two bundles with the same number of files and
// different code inside them produced the same `buildId`, so the field that
// exists to answer "is what is installed what we released" answered yes for
// software the release never contained. A count is not a fingerprint.

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * The digest of a build that has no bundle yet.
 *
 * A WORD, deliberately, and never a hash. `sha256('')` is a perfectly valid
 * 64-character digest, so an artifact nobody built would compare equal to any
 * other artifact nobody built — and read, in a manifest, exactly like a real
 * measurement. This cannot be mistaken for one.
 */
export const ARTIFACT_ABSENT = 'absent'

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

/**
 * Every file the artifact is made of, with its own digest, in a stable order.
 *
 * A missing directory is an empty list, not a throw: this producer runs before
 * the bundle exists on every cold checkout, and the honest answer there is "no
 * bundle yet". Failing here is what made a fresh clone exit 1 before it ever
 * reached the build.
 */
export function collectArtifactFiles(dir) {
  const files = []
  const walk = (current) => {
    for (const entry of readdirSync(current).sort()) {
      const full = path.join(current, entry)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else
        files.push({
          relativePath: path.relative(dir, full),
          sha256: sha256(readFileSync(full)),
          sizeBytes: st.size
        })
    }
  }
  try {
    walk(dir)
  } catch {
    return []
  }
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

/**
 * One digest over the whole artifact.
 *
 * The PATH is hashed beside the bytes: a file that moved is a different
 * artifact even when nothing inside it changed, and a digest that ignored the
 * layout would call a rearranged bundle the same software. The order is fixed
 * before hashing so two machines that read the directory differently still
 * agree.
 */
export function artifactDigest(files) {
  if (!files.length) return ARTIFACT_ABSENT
  const h = createHash('sha256')
  for (const f of [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath)))
    h.update(f.relativePath + '\0' + f.sha256 + '\0' + String(f.sizeBytes) + '\n')
  return h.digest('hex')
}

/**
 * The short identity a person quotes in a defect report.
 *
 * Source, dependencies and the artifact all feed it, so it separates every pair
 * of builds that differ in any of the three. Short because it is read aloud;
 * `artifactDigest` stays in the manifest at full length for machines.
 */
export function buildIdOf({ commitSha, sourceDirty, lockfileSha256, artifactDigest: digest }) {
  return sha256(
    [commitSha, String(sourceDirty), lockfileSha256, digest].join(':')
  ).slice(0, 16)
}

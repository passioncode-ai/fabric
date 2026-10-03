// #region release-mac-inputs — docs: docs/launch/release-mac.md#how-a-release-is-made
// What `scripts/release-mac.mjs` takes from outside: the signing identity, the tag, the commit, and
// what the signature on the built app says. A release is signed only in CI (the `release` environment
// of .github/workflows/release.yml, ADR-0111); CI hands the identity in from
// passioncode-ai/.github/actions/apple-signing, and nothing here names a team or a certificate.
// A person may run the same script with their own identity to debug the build; that build is never
// published.

const PREFIX = 'Developer ID Application:'
// Every certificate-type prefix electron-builder knows (app-builder-lib macCodeSign.js
// `appleCertificatePrefixes`), plus the two current Apple names it does not: only the first can sign
// a download that Gatekeeper opens outside the App Store.
const OTHER_TYPES = ['Developer ID Installer:', '3rd Party Mac Developer Application:', '3rd Party Mac Developer Installer:',
  'Apple Distribution:', 'Apple Development:', 'Mac Developer:', 'Mac Installer Distribution:']

/**
 * `node scripts/release-mac.mjs [--check-only] [--identity <name>] [--tag <tag>]`.
 * The identity falls back to FABRIC_SIGN_IDENTITY (how CI passes it); there is no default.
 */
export function parseReleaseArgs(argv, env) {
  const out = { checkOnly: false, identity: null, tag: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--check-only') { out.checkOnly = true; continue }
    const m = /^--(identity|tag)(?:=(.*))?$/.exec(a)
    if (!m) throw new Error(`unknown argument ${a}`)
    let value = m[2]
    if (value === undefined) {
      value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`--${m[1]} needs a value`)
      i++
    }
    out[m[1]] = value.trim() || null
  }
  if (out.identity === null) out.identity = env.FABRIC_SIGN_IDENTITY?.trim() || null
  return out
}

/**
 * The name electron-builder is given. It refuses a name that keeps its certificate-type prefix
 * ("Please remove prefix …"), and matches the rest as a substring of its Developer ID identities —
 * so a full name, a holder with its team, or a bare team id all select one certificate.
 */
export function builderIdentity(name) {
  const n = (name ?? '').trim()
  if (!n) throw new Error('no signing identity: pass --identity <name> or set FABRIC_SIGN_IDENTITY')
  if (OTHER_TYPES.some((p) => n.startsWith(p))) throw new Error(`"${n}" is not a Developer ID Application identity`)
  return n.startsWith(PREFIX) ? n.slice(PREFIX.length).trim() : n
}

/**
 * The config the release build is run with: the release config (which names no identity, so on its
 * own the base config's `identity: null` leaves the app unsigned) with the given identity on top.
 * A file, not `-c.mac.identity=`: electron-builder merges a dot-notation override over the DEFAULT
 * config file and would let its `target: dir` replace the release's DMG target.
 */
export function builderConfig({ releaseConfig, identity }) {
  return { extends: releaseConfig, mac: { identity: builderIdentity(identity) } }
}

/** A tag names the version the commit carries (`v0.3.0`), or a rehearsal of it (`v0.3.0-rc.2`). */
export function tagProblem({ tag, version }) {
  if (!tag) return null
  const v = version.replace(/[.]/g, '\\.')
  return new RegExp(`^v${v}(?:-rc\\.\\d+)?$`).test(tag) ? null : `the tag ${tag} does not name version ${version} (v${version}, or v${version}-rc.N for a rehearsal)`
}

/**
 * A release is built from `main` as it is on the remote (plan row P-03): HEAD must be reachable from
 * origin/main. Its tip passes, and so does a release tag on main that CI checks out after main moved on.
 * `git(args)` returns stdout and throws on a non-zero exit (execFileSync).
 */
export function releaseCommitProblem(git) {
  try { git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main^{commit}']) } catch {
    return 'cannot read origin/main to check the release commit; fetch it first'
  }
  try { git(['merge-base', '--is-ancestor', 'HEAD', 'refs/remotes/origin/main']); return null } catch {
    return 'HEAD is not on origin/main; land the change on main first, then release from it (or from a tag on main)'
  }
}

/** What `codesign -dvv <app>` printed (it writes to stderr): the leaf authority, the team, the runtime flag. */
export function signatureOf(text) {
  const authority = /^Authority=(.+)$/m.exec(text)?.[1]?.trim()
  if (!authority?.startsWith(PREFIX)) throw new Error(`the app is not signed with a Developer ID Application identity (${authority ?? 'no authority'})`)
  const team = /^TeamIdentifier=(\S+)$/m.exec(text)?.[1]
  if (!team || !authority.endsWith(`(${team})`)) throw new Error(`the team ${team ?? '(none)'} does not match the authority ${authority}`)
  const flags = /^CodeDirectory .*flags=\S*\(([^)]*)\)/m.exec(text)?.[1] ?? ''
  return { authority, team, hardenedRuntime: flags.split(',').includes('runtime') }
}
// #endregion release-mac-inputs

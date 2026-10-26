// #region migration-ledger — docs: docs/launch/release-mac.md#upgrading-an-existing-database
// The order migrations were merged in, and their bytes (CO-199, Fabric 0.4.0 wave 1, REQ-32).
//
// A fresh install applies `supabase/migrations/` in filename order; an existing database applies, with
// `supabase migration up`, the files it has not seen — after the ones it has. The two agree only while every
// new file sorts after every file a database may already hold. When two workstreams reserved filenames (78/79
// in the 0.3.1 cycle) a reserved file merged late would have sorted BELOW an applied one: a fresh database
// would run it before 80 and an upgraded one after, so the functions both redefine would differ under the same
// `schema_version()` (a count). And `supabase migration up` refuses such a file unless `--include-all`.
//
// The ledger (`supabase/migration-ledger.json`) is the merged order: each applied file and the sha256 of its
// text (line endings normalised, so a Windows checkout hashes the same). The rules:
//   1. every recorded file exists with the recorded bytes — an applied migration is never edited or removed;
//   2. the ledger is in strictly ascending filename and version order, one file per version;
//   3. a file not recorded must sort after the newest recorded one — otherwise it is refused, with the
//      number to renumber past; one that does sort after is refused until it is recorded (`--record`), so two
//      branches that each add one meet as a conflict on the ledger's last line, not as two files in a tree;
//   4. against a base (the integration branch), the base's ledger is a prefix of this one: history is appended to.
import { createHash } from 'node:crypto'

export const LEDGER_SCHEMA = 'FabricMigrationLedger@1'
const NAME = /^(\d{14})_[a-z0-9_]+\.sql$/

export const digest = (text) => createHash('sha256').update(String(text).replace(/\r\n/g, '\n'), 'utf8').digest('hex')

/**
 * Problems of a migrations directory against its ledger; [] when they agree.
 * @param {{ files: { name: string, text: string }[], ledger: unknown, base?: unknown | null }} input
 */
export function ledgerProblems({ files, ledger, base = null }) {
  const problems = []
  if (!ledger || typeof ledger !== 'object' || ledger.schema !== LEDGER_SCHEMA || !Array.isArray(ledger.migrations))
    return [`supabase/migration-ledger.json is not a ${LEDGER_SCHEMA} document with a migrations list`]
  const byName = new Map(files.map((f) => [f.name, f]))
  const recorded = new Set()
  let previous = null
  for (const [i, m] of ledger.migrations.entries()) {
    if (!m || typeof m.file !== 'string' || !/^[0-9a-f]{64}$/.test(m.sha256 ?? '')) { problems.push(`ledger entry ${i + 1} is not {file, sha256}`); continue }
    if (!NAME.test(m.file)) problems.push(`ledger entry ${i + 1} names ${m.file}, which is not <14-digit version>_<name>.sql`)
    if (recorded.has(m.file)) problems.push(`${m.file} is recorded twice`)
    recorded.add(m.file)
    if (previous && !(m.file > previous.file)) problems.push(`${m.file} is recorded after ${previous.file} but sorts before it: a database that applied ${previous.file} would apply it after, a fresh one before`)
    if (previous && NAME.test(m.file) && NAME.test(previous.file) && m.file.slice(0, 14) === previous.file.slice(0, 14)) problems.push(`${m.file} and ${previous.file} share the version ${m.file.slice(0, 14)}`)
    const f = byName.get(m.file)
    if (!f) problems.push(`${m.file} is recorded as applied but is not in supabase/migrations/ — an applied migration is never removed`)
    else if (digest(f.text) !== m.sha256) problems.push(`${m.file} differs from the bytes recorded when it was applied — an applied migration's text is never edited; write a new migration`)
    previous = m
  }
  const newest = ledger.migrations.at(-1)?.file ?? ''
  for (const f of [...files].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (recorded.has(f.name)) continue
    if (!NAME.test(f.name)) problems.push(`${f.name} is not <14-digit version>_<name>.sql`)
    else if (f.name <= newest) problems.push(`${f.name} sorts below ${newest}, the newest applied migration: renumber it past ${newest.slice(0, 14)} (a fresh install would run it before ${newest}, an upgraded database after, and \`supabase migration up\` refuses it)`)
    else problems.push(`${f.name} is not recorded: append it to supabase/migration-ledger.json in the same change (node scripts/check-migration-order.mjs --record)`)
  }
  if (base && typeof base === 'object' && Array.isArray(base.migrations)) {
    for (const [i, m] of base.migrations.entries()) {
      const here = ledger.migrations[i]
      if (!here || here.file !== m.file || here.sha256 !== m.sha256) {
        problems.push(`the base's ledger entry ${i + 1} (${m.file}) is not entry ${i + 1} here (${here?.file ?? 'nothing'}): the ledger is appended to, never rewritten`)
        break
      }
    }
  }
  return problems
}

/**
 * The rewrites of a ledger entry the repository accepted, by the commit that made them, each with why (CO-342). Both
 * edited migration 115 after it was recorded on main (the 0.3.7 review, DA-5); migration 116 re-asserted what a
 * development database that applied the earlier bytes lacked. Two more were found when the check first walked the whole
 * history (2026-10-26): a renumbering at a branch's integration and a comment. Nothing is added here without a reason.
 */
export const ACCEPTED_REWRITES = Object.freeze({
  '7675b03a': 'migration 115 gained schema 93 in its archive function after it was recorded (0.3.7, DA-5); migration 116 admits 93 again',
  'c6cf39e0': 'migration 115 flipped run.stop_attestation_revoked@1 to journal-only after it was recorded (0.3.7, DA-5); release installs carry the final bytes',
  '7189d7e6': 'the 0.4.0 wave 2 branch renumbered its work_claims migration from 92 to 95 when it merged main (main had taken 92 to 94), before any release held it',
  '8100be6b': 'the 0.3.9 release integration corrected a path in migration 120\'s header comment before 0.3.9 shipped; no SQL changed'
})

/**
 * Problems of the ledger's history (CO-342): each step's ledger, oldest first, is a prefix of the next one's, so an
 * entry recorded on main is never rewritten later on main. `--base` compares only the base and the tip, and missed a
 * rewrite between two commits both past the base. A step whose commit is accepted (by an abbreviation of it) passes.
 * @param {{ commit: string, ledger: unknown }[]} steps
 * @param {{ accepted?: Record<string, string> }} [options]
 */
export function historyProblems(steps, { accepted = ACCEPTED_REWRITES } = {}) {
  const problems = []
  const isAccepted = (commit) => Object.keys(accepted).some((k) => commit.startsWith(k) || k.startsWith(commit))
  for (let i = 1; i < steps.length; i++) {
    const before = steps[i - 1], after = steps[i]
    const old = before.ledger?.migrations, now = after.ledger?.migrations
    if (!Array.isArray(old) || !Array.isArray(now)) continue
    for (const [k, m] of old.entries()) {
      const here = now[k]
      if (here && here.file === m.file && here.sha256 === m.sha256) continue
      if (!isAccepted(after.commit))
        problems.push(`the ledger entry ${k + 1} (${m.file}) recorded at ${before.commit} was rewritten at ${after.commit}: an applied migration's entry is appended to, never rewritten; write a new migration`)
      break
    }
  }
  return problems
}

/** The ledger with every unrecorded file that sorts after the newest appended, in order; throws on one that does not. */
export function recordNew({ files, ledger }) {
  const recorded = new Set(ledger.migrations.map((m) => m.file))
  const newest = ledger.migrations.at(-1)?.file ?? ''
  const fresh = files.filter((f) => !recorded.has(f.name)).sort((a, b) => (a.name < b.name ? -1 : 1))
  const below = fresh.filter((f) => f.name <= newest)
  if (below.length) throw new Error(`${below.map((f) => f.name).join(', ')} sort below ${newest}: renumber, never record out of order`)
  return { ...ledger, migrations: [...ledger.migrations, ...fresh.map((f) => ({ file: f.name, sha256: digest(f.text) }))] }
}
// #endregion migration-ledger

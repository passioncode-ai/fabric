// The gate that catches what every other gate lets through (M96).
//
// This repository's rule is that a claim carries its receipt: a `file:line`, a
// command and its output, a test name. Two failures of that rule were found by
// audit rather than by any gate, and both are mechanical:
//
//   1. A `file:line` citation ROTS. `verification.md`, the board and a commit
//      message all cited `main/index.ts:722` as "a BrowserWindow with no
//      titleBarStyle". Within the hour that line held nothing — the same run had
//      moved the file. `check-docs.sh` verifies that markdown LINKS resolve; it
//      has never verified that a cited line still exists.
//
//      THE FIRST VERSION OF THIS CHECK COULD NOT CATCH ITS OWN EXAMPLE. It
//      failed a citation only when the file was too short or the line was
//      blank — and a line holding `ptys.resize(...)` is neither. Measured
//      2026-09-05: an audit row cited line 132 of `ProjectHome.tsx` as a
//      Workflows panel, that line held a statistics loader, and the gate was
//      green. A line number cannot be verified in SUBSTANCE by anything, which
//      is why the remedy the milestone names is the real one: **cite a symbol,
//      which moves with the code.** Living documents now carry symbol
//      citations and a bare `file:line` in one is a failure.
//
//      It also read 4 of 97 markdown files. The living documents are all read
//      now; DATED SNAPSHOTS are deliberately not, because an audit report is a
//      record of a moment and rewriting its citations to match today's tree
//      destroys the thing it is for. That exclusion is COUNTED and printed
//      rather than left silent.
//
//   2. A REGISTER stops being a register. A blank line ends a Markdown table, so
//      53 of 106 carry-over rows had silently become paragraphs, and one row's
//      unescaped pipes inside `code` swallowed its Status column entirely. Every
//      gate passed, because none of them parses a table.
//
// And one that is not mechanical but is checkable: a hand-counted number
// introduced by the word "measured". `backlog.md` said "48 of 143 verification
// rows … 13 of 82 milestones"; the true counts at that commit were 173 and 99.
// Two invented denominators, in the audit about invented denominators. So this
// gate also RECOMPUTES the counts the documents assert and fails on a mismatch.

import { cell, cells } from './lib/markdown-table.mjs'
import { classify, tableRows, isDatedReportSnapshot } from './lib/registers.mjs'
import { carriesWork, dispositionOf, vocabulary } from './lib/disposition.mjs'
import { insideUnchecked, uncheckedSubmodules } from './lib/submodules.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.turbo'])
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
let failures = 0
const ok = (m) => console.log(`  ok   ${m}`)
const fail = (m) => {
  failures++
  console.error(`  FAIL ${m}`)
}
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8')

// A pipe inside inline code is content, not a column separator — the same rule a
// Markdown renderer follows, and the one CO-050 was breaking.
//
// AND THIS FILE ALREADY KNEW IT (FA-05). The width check below has used the
// escaped-pipe rule since it was written, naming CO-050 in its own comment,
// while the STATUS counter three hundred lines down split on a bare `|` and lost
// the same two rows. One file, one rule, applied in one of the two places that
// needed it — which is why both now come from `lib/markdown-table.mjs`.
const cellCount = (line) => cells(line).length

// ───────────────────────────── 1. the registers are tables ─────────────────
const REGISTERS = [
  { file: 'docs/evidence/specs/2026-08-16-software-fabric-carryover.md', prefix: 'CO-' },
  { file: 'docs/evidence/backlog.md', prefix: 'M' },
  { file: 'docs/adr/README.md', prefix: '[ADR-' }
]

for (const { file, prefix } of REGISTERS) {
  const lines = read(file).split('\n')
  const rowAt = (i) => lines[i]?.startsWith(`| ${prefix}`)
  const first = lines.findIndex((_, i) => rowAt(i))
  if (first < 0) {
    fail(`${file}: no ${prefix} rows found at all`)
    continue
  }
  const last = lines.reduce((acc, _, i) => (rowAt(i) ? i : acc), first)

  // A blank line between two rows ends the table — but a document may hold
  // SEVERAL tables, and a blank line followed by a fresh header and delimiter is
  // a new table, not a broken one. Only an orphaned run counts: rows that resume
  // after a blank with no header between them.
  const breaks = []
  for (let i = first; i <= last; i++) {
    if (lines[i].trim() !== '') continue
    let j = i + 1
    while (j <= last && lines[j].trim() === '') j++
    if (!rowAt(j)) continue // whatever follows is prose or a new heading — fine
    // Look back for a delimiter row introducing this run; if the rows simply
    // resume, the table was broken rather than restarted.
    const restarted = lines.slice(i, j + 1).some((l) => /^\|[\s-:|]+\|$/.test(l.trim()))
    if (!restarted) breaks.push(i + 1)
  }
  if (breaks.length)
    fail(
      `${file}: ${breaks.length} blank line(s) INSIDE the table (first at :${breaks[0]}) — ` +
        `every row after it renders as a paragraph, not a register`
    )
  else ok(`${file}: the register is one unbroken table`)

  // A row whose column count differs has either lost a cell or gained one, and
  // in both cases a reader is shown the wrong field under the right heading.
  const width = cellCount(lines[first])
  const wrong = []
  for (let i = first; i <= last; i++) {
    if (!rowAt(i)) continue
    if (cellCount(lines[i]) !== width)
      wrong.push(`${cell(lines[i], 1).trim()} (${cellCount(lines[i])} vs ${width}) at :${i + 1}`)
  }
  if (wrong.length) fail(`${file}: ${wrong.length} row(s) with the wrong column count — ${wrong[0]}`)
  else ok(`${file}: every row has ${width - 2} columns`)
}

// ───────────────────────────── 2. cited lines still exist ──────────────────
//
// This cannot check that a line still SAYS what was claimed — that needs a human
// or a symbol. It checks the cheap half: the file exists and the line is not
// past its end and is not blank. That alone would have caught index.ts:722.

// Every LIVING document under docs/. A dated snapshot is excluded by
// `isSnapshot` below and its citations are counted so the gap is visible.
const DOCS = ['docs']
const files = []
/**
 * A dated document is a RECORD OF A MOMENT, not a living claim.
 *
 * `docs/audit/2026-09-05-…` and `docs/evidence/plans/2026-09-05-…` cited 307
 * lines between them when this rule was written, and every one of them was true
 * on its date. Rewriting them to match today's tree would falsify a report
 * rather than repair it. They are excluded — and the exclusion is counted and
 * printed below, because a check that silently covers 2% of the citations while
 * reporting "all citations resolve" is the same green-over-nothing failure this
 * file exists to prevent.
 */
const isSnapshot = (rel) => rel.startsWith('docs/audit/') || /\d{4}-\d{2}-\d{2}/.test(path.basename(rel)) || isDatedReportSnapshot(rel, read(rel))

const snapshots = []
for (const d of DOCS) {
  const abs = path.join(ROOT, d)
  if (!existsSync(abs)) continue
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      if (SKIP_DIRS.has(e)) continue
      const p = path.join(dir, e)
      const rel = path.relative(ROOT, p)
      if (statSync(p).isDirectory()) walk(p)
      else if (e.endsWith('.md')) (isSnapshot(rel) ? snapshots : files).push(rel)
    }
  }
  if (statSync(abs).isDirectory()) walk(abs)
  else files.push(d)
}

// Resolving a bare basename needs the tree, so it is walked once and cached.
const SKIP = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.turbo'])
let basenames = null
const byBasename = (name) => {
  if (basenames === null) {
    basenames = new Map()
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (SKIP.has(e.name)) continue
        const abs = path.join(dir, e.name)
        // A nested git root — an agent's worktree under .claude/worktrees, a submodule — is another
        // tree, not this repository's files: counting its copies made every symbol ambiguous
        // ("3 files carry that name") the moment two agent worktrees existed (2026-10-03).
        if (e.isDirectory() && existsSync(path.join(abs, '.git'))) continue
        if (e.isDirectory()) walk(abs)
        else (basenames.get(e.name) ?? basenames.set(e.name, []).get(e.name)).push(abs)
      }
    }
    walk(ROOT)
  }
  return basenames.get(name) ?? []
}

const CITATION = /`([A-Za-z0-9_./-]+\.(?:ts|tsx|mjs|sql|py|sh|css|json)):(\d+)`/g
/** The form that survives an edit: the symbol moves with the code. */
const SYMBOL_CITATION = /`([A-Za-z0-9_./-]+\.(?:ts|tsx|mjs|sql|py|sh))#([A-Za-z_][A-Za-z0-9_]*)`/g

/** Resolves a citation's path against the roots this repository actually uses. */
const resolveCited = (rel) => {
  const candidates = [
    rel,
    `apps/desktop/src/${rel}`,
    `apps/desktop/${rel}`,
    `packages/${rel}`,
    `supabase/${rel}`
  ]
  const hit = candidates.map((c) => path.join(ROOT, c)).find((c) => existsSync(c))
  if (hit) return { hit }
  // A citation is usually written as a BARE BASENAME — `ProjectHome.tsx` — and
  // the prefix list above cannot guess `renderer/src`. An earlier version
  // skipped those with a comment saying check-docs.sh would catch them; it does
  // not, because that gate checks markdown LINKS and this is inline code. The
  // result was "all 0 citations resolve" while the repository's only citation
  // went unread — a green line over an empty measurement.
  if (!rel.includes('/')) {
    const found = byBasename(rel)
    if (found.length === 1) return { hit: found[0] }
    if (found.length > 1) return { ambiguous: found.length }
  }
  return {}
}

// ── 2a. a LINE citation in a living document ────────────────────────────────
//
// It is refused outright, and the reason is that no gate can check one. A line
// number can be shown to EXIST; it cannot be shown to still say what was
// claimed of it. Measured 2026-09-05: an audit row cited line 132 of
// `ProjectHome.tsx` as a Workflows panel, that line held a statistics loader,
// and the check that existed then reported the citation sound — because the
// line was neither missing nor blank. The milestone that asked for this gate
// named the real remedy in its own last sentence: cite a symbol.
const lineCited = []
for (const f of files) {
  for (const m of read(f).matchAll(CITATION)) lineCited.push(`${f}: \`${m[1]}:${m[2]}\``)
}
if (lineCited.length) {
  fail(
    `${lineCited.length} line citation(s) in living documents — a line number cannot be checked ` +
      `for what it SAYS, only for existing. Cite a symbol instead: \`File.ts#symbolName\``
  )
  for (const r of lineCited.slice(0, 8)) console.error(`         ${r}`)
} else ok('no living document cites a bare line number — every receipt names a symbol')

// ── 2b. a SYMBOL citation resolves, in substance ────────────────────────────
let symbolsChecked = 0
const badSymbols = []
// A citation into a submodule that is not checked out cannot be resolved HERE — the private
// workspace, on a public clone (scripts/lib/submodules.mjs). It is counted in 2c, not passed.
const unchecked = uncheckedSubmodules(ROOT)
const submoduleCitations = new Map()
for (const f of files) {
  for (const m of read(f).matchAll(SYMBOL_CITATION)) {
    const [, rel, symbol] = m
    const within = insideUnchecked(rel, unchecked)
    if (within) {
      submoduleCitations.set(within, (submoduleCitations.get(within) ?? 0) + 1)
      continue
    }
    const { hit, ambiguous } = resolveCited(rel)
    if (ambiguous) {
      badSymbols.push(`${f}: cites ${rel}#${symbol}, and ${ambiguous} files carry that name`)
      continue
    }
    if (!hit) {
      badSymbols.push(`${f}: cites ${rel}#${symbol}, and no such file exists anywhere in the tree`)
      continue
    }
    symbolsChecked++
    // A word-boundary match rather than a parse: the claim being checked is
    // "this name is in this file", which is what a reader follows the citation
    // to find. Parsing every language here would be a compiler, and a compiler
    // that is wrong about one dialect fails the whole gate for no gain.
    const src = readFileSync(hit, 'utf8')
    if (!new RegExp(`\\b${symbol}\\b`).test(src))
      badSymbols.push(`${f}: cites ${rel}#${symbol}, and that file no longer contains ${symbol}`)
  }
}
if (badSymbols.length) {
  fail(`${badSymbols.length} of ${symbolsChecked} symbol citation(s) no longer resolve:`)
  for (const r of badSymbols.slice(0, 8)) console.error(`         ${r}`)
} else ok(`all ${symbolsChecked} symbol citation(s) name something their file still contains`)

// ── 2c. what is deliberately NOT checked, counted out loud ──────────────────
//
// Silence here would be the failure this file exists to prevent: a gate that
// reports success over a scope nobody stated. These are dated records of a
// moment, and their citations were true on their date.
let snapshotCitations = 0
for (const f of snapshots) snapshotCitations += [...read(f).matchAll(CITATION)].length
ok(
  `${snapshotCitations} line citation(s) in ${snapshots.length} dated snapshot(s) are NOT checked — ` +
    `an audit report records a moment, and rewriting its receipts to match today falsifies it`
)
for (const [sub, n] of submoduleCitations)
  ok(
    `${n} symbol citation(s) into the submodule '${sub}' are NOT checked — it is not checked out here ` +
      `(private; a public clone cannot initialise it). Where it is checked out they are resolved like any other`
  )

// ───────────────────────────── 2b. an id in a form the register does not use ─
//
// M114's second half. Eight references were written `CO-0082` while the register
// numbers its rows `CO-082`, so each resolved against nothing — in `adr/0020`,
// `passioncode-platform.md`, and inside CO-049's own status. A reader following
// one finds no row and cannot tell whether the row is missing or the reference
// is. Both readings are wrong and only one is cheap to prevent.
//
// It checks the FORM, not the target: `CO-999` for a row that does not exist is
// a different defect and one this cannot see. Naming what a check misses is the
// difference between a pass and a claim.
{
  const wrong = []
  const walkDocs = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) walkDocs(abs)
      else if (/\.(md|html)$/.test(e.name)) {
        const text = readFileSync(abs, 'utf8')
        for (const m of text.matchAll(/\bCO-\d{4,}\b/g))
          wrong.push(`${path.relative(ROOT, abs)}: ${m[0]}`)
      }
    }
  }
  walkDocs(path.join(ROOT, 'docs'))
  if (wrong.length) {
    fail(`${wrong.length} carry-over reference(s) written with four digits, which the register never uses:`)
    for (const w of wrong.slice(0, 6)) console.error(`         ${w}`)
  } else ok('every carry-over reference is written in the form the register uses')
}

// ───────────────────────────── 3. asserted counts are recomputed ───────────
//
// A number a document asserts about this repository must be one a command
// produces. The counts below are the ones the exposure sentences quote.

// One definition, used by both the total and the numerator below (R-005): the
// two used to carry the same literal, and a widening that reached one and not
// the other would have made the fraction disagree with itself.
const ROW = /^\| [A-Z][A-Z0-9]{1,6}-REQ-\d+\w* \|/

// ——— THE REGISTERS, READ SO THAT A ROW CANNOT BE INVISIBLE (FA-10)
//
// The pattern below still says what a well-formed id looks like. What changed is
// what happens to a row that does not match it: rows are found STRUCTURALLY, by
// table membership, and a data row whose id does not parse is a GATE FAILURE
// rather than a row that quietly leaves the count.
//
// That is the third time this class has been addressed and the first time the
// shape has been. M115: five BRAND-REQ rows outside every number quoted about
// the ledger, found by writing FEED-REQ and watching the total refuse to move.
// FA-01: a prefix carrying a DIGIT invisible the same way — ten rows added and
// eleven revealed, because `HARNESS-REQ-004` had never been counted at all. Both
// times the pattern was widened, and a widened pattern waits for the fourth
// prefix nobody thought of. A counter with a pattern reports a smaller register
// WITH TOTAL CONFIDENCE; the only cure is to refuse rather than skip.
//
// `verification.md` heads its tables two ways — `| REQ |` and `| Requirement |`
// — so the header predicate knows both, and a THIRD spelling makes its rows
// unfindable, which is why the row count is asserted against the id pattern's
// own count below: two readings of one file, and they must agree.
const isVerificationHeader = (c) => /^(REQ|Requirement)$/i.test(String(c[0] ?? '').trim())
const REQ_ID = /^[A-Za-z][A-Za-z0-9]*-REQ-\d+\w*$/
const verificationTable = classify(
  tableRows(read('docs/evidence/verification.md'), isVerificationHeader),
  (id) => REQ_ID.test(id)
)
if (verificationTable.malformed.length) {
  fail(
    `${verificationTable.malformed.length} verification row(s) sit inside a register table and do not parse as a REQ id:`
  )
  for (const row of verificationTable.malformed.slice(0, 10))
    console.error(`         docs/evidence/verification.md:${row.line} — ${JSON.stringify(String(row.cells[0]).slice(0, 40))}`)
  console.error('         A row that does not parse used to leave the count in silence. Give it an id or take it out of the table.')
} else
  ok(
    `every one of the ${verificationTable.wellFormed.length} rows inside a verification table carries a parseable REQ id`
  )

// ——— A ROW THAT WAS NOT WATCHED SAYS WHY (FA-10)
//
// The exposure sentence publishes the never-watched count and has since M96, and
// a count is not an assignment. The card asks for an owner per production seam
// for each of those rows. MEASURED 2026-09-10: 53 of the 61 already carried one
// in their own text; eight said essentially just `no`, seven of them `no — UI`.
//
// Those eight were given a seam and, where the claim is a RULE rather than a
// layout, the plant that would test it — because "UI" is not a reason, it is a
// place. A layout is caught by the probe that mounts it; a rule inside a layout
// (an overlap guard, a truncation mark, a setting that applies immediately) is
// plantable, and saying so is what turns a count into work somebody can pick up.
//
// This keeps it that way: a bare `no` fails.
{
  const bare = verificationTable.wellFormed.filter((row) => {
    const watched = String(row.cells[3] ?? '')
    if (!/^no\b/i.test(watched)) return false
    return watched.replace(/^no\b/i, '').replace(/^[\s—-]+/, '').trim().length < 12
  })
  if (bare.length) {
    fail(`${bare.length} row(s) say they were never watched failing and do not say why:`)
    for (const row of bare.slice(0, 8))
      console.error(`         docs/evidence/verification.md:${row.line} ${row.cells[0]} — ${JSON.stringify(String(row.cells[3]))}`)
    console.error('         Name the seam, and the plant if the claim is a rule rather than a layout. "UI" is a place, not a reason.')
  } else
    ok(
      `every one of the ${verificationTable.wellFormed.filter((r) => /^no\b/i.test(String(r.cells[3]))).length} ` +
        `never-watched rows names its seam`
    )
}

// ——— AN ID THAT NAMES TWO ROWS IS NOT AN IDENTIFIER (FA-10)
//
// This repository's doctrine is that a claim carries its receipt, and the
// receipt is usually a REQ id in this file. MEASURED 2026-09-10: 969 rows carry
// 942 distinct ids. Twenty-two ids name more than one row — 49 rows in all —
// and the `PW-REQ-00n` family names three each, from three different iterations
// that reused the prefix. So a citation to `PW-REQ-005` resolves to three rows
// saying different things, ONE of which was watched failing and two of which
// were not. A reader following that citation cannot tell which claim they were
// pointed at, and the whole receipt discipline rests on being able to.
//
// The 49 rows are NOT renumbered: rewriting an old audit to suit a current
// count is the thing this card forbids by name, and an id that has been cited
// elsewhere does not become correct by changing it here. Instead the collisions
// are a FROZEN ALLOWANCE, listed by id so the list can only shrink, and any
// twenty-third collision fails. The debt is countable and cannot grow.
const COLLIDING_IDS = new Set([
  'AUTH-REQ-001', 'AUTH-REQ-002', 'AUTH-REQ-003', 'AUTH-REQ-004', 'AUTH-REQ-005',
  'BOARD-REQ-001', 'BOARD-REQ-002', 'BOARD-REQ-003', 'BOARD-REQ-004',
  'IPC-REQ-001', 'IPC-REQ-002', 'IPC-REQ-003',
  'PW-REQ-001', 'PW-REQ-002', 'PW-REQ-003', 'PW-REQ-004', 'PW-REQ-005', 'PW-REQ-006',
  'PW-REQ-007', 'PW-REQ-008',
  'SEC-REQ-020', 'SEC-REQ-021'
])
{
  const byId = new Map()
  for (const row of verificationTable.wellFormed) {
    const id = String(row.cells[0])
    if (!byId.has(id)) byId.set(id, [])
    byId.get(id).push(row.line)
  }
  const fresh = [...byId].filter(([id, ls]) => ls.length > 1 && !COLLIDING_IDS.has(id))
  const healed = [...COLLIDING_IDS].filter((id) => (byId.get(id) ?? []).length <= 1)
  if (fresh.length) {
    fail(`${fresh.length} verification id(s) name more than one row and are not in the frozen allowance:`)
    for (const [id, ls] of fresh.slice(0, 8))
      console.error(`         ${id} at docs/evidence/verification.md:${ls.join(', ')}`)
    console.error('         A citation to that id resolves to more than one claim. Give the new row its own id.')
  } else
    ok(
      `no new id collision: ${byId.size} distinct ids over ${verificationTable.wellFormed.length} rows, and the ` +
        `${COLLIDING_IDS.size} historical collisions are declared` +
        (healed.length ? ` (${healed.length} of them now resolve to one row — remove them from the allowance)` : '')
    )
}

// ——— A ROW BLOCK WITH NO HEADER IS NOT A TABLE (FA-10)
//
// MEASURED 2026-09-10: `verification.md` held 70 blocks of pipe-separated lines
// and 54 of them had a header and a delimiter. The other 16 were continuations
// of the table above, separated from it by a blank line — and a blank line ENDS
// a Markdown table, so those blocks rendered as paragraphs full of literal pipe
// characters. **434 of 969 rows, forty-five per cent of the evidence ledger, did
// not render as a table at all.** Nothing noticed, because every counter reads
// this file by matching an id pattern against lines rather than by reading a
// table, so the numbers were right the whole time and the document was not.
//
// The 16 blank lines were removed — the diff is blank lines and nothing else,
// checked by comparing both versions with empty lines stripped. This rule is
// what stops the seventeenth.
for (const file of ['docs/evidence/verification.md', 'docs/evidence/specs/2026-08-16-software-fabric-carryover.md']) {
  const lines = read(file).split('\n')
  const headless = []
  let i = 0
  while (i < lines.length) {
    if (!lines[i].startsWith('|')) {
      i++
      continue
    }
    const start = i
    while (i < lines.length && lines[i].startsWith('|')) i++
    if (!(i - start > 1 && /^\|[\s:|-]+\|\s*$/.test(lines[start + 1]))) headless.push(start + 1)
  }
  if (headless.length)
    fail(
      `${file}: ${headless.length} block(s) of table rows have no header and delimiter, so they render as ` +
        `paragraphs of literal pipes rather than tables — at line(s) ${headless.slice(0, 8).join(', ')}. ` +
        `A blank line ends a Markdown table; remove it, or give the block its own header.`
    )
  else ok(`${file.split('/').pop()}: every block of table rows is a table a reader can read`)
}

const truth = {
  // The structural count is the one quoted. The pattern count is kept beside it
  // as the second reading, and they are compared below.
  verificationRows: verificationTable.wellFormed.length,
  milestones: read('docs/evidence/backlog.md')
    .split('\n')
    .filter((l) => /^\| M\d+ \|/.test(l)).length,
  carryOver: read('docs/evidence/specs/2026-08-16-software-fabric-carryover.md')
    .split('\n')
    .filter((l) => /^\| CO-\d+ \|/.test(l)).length
}

// TWO READINGS OF ONE FILE, and a disagreement is a defect in one of them.
// FA-10's acceptance asks for numbers "independently counted", and a second
// counter is only evidence if it is itself checked — `scripts/test/registers.test.mjs`
// runs both against a fixture counted by hand, carrying every shape that has
// ever hidden a row here. Three ad-hoc second counts written while measuring
// this card were wrong before one was right, each in a way that would have been
// reported as a register defect.
const byPattern = read('docs/evidence/verification.md').split('\n').filter((l) => ROW.test(l)).length
if (byPattern !== truth.verificationRows)
  fail(
    `two readings of docs/evidence/verification.md disagree: ${truth.verificationRows} rows inside a declared table, ` +
      `${byPattern} matching the id pattern anywhere in the file. One of the two readings is wrong — a row inside no ` +
      `declared table, or a table headed a third way.`
  )
else ok(`two independent readings of the verification register agree on ${byPattern} rows`)

// The NUMERATORS. Every fraction in the exposure sentence had a denominator
// this gate recomputed and a numerator nobody did, and all three had drifted:
// the milestones said 23 and counted 22, and the verification rows said 97 and
// counted 59 — the second found by widening the row pattern above and watching
// the total refuse to move. A fraction is one claim, not two, and half-checking
// it is how the checked half lends credibility to the other.
// ONE parser (FA-05). This was a bare split on `|`, and two rows in the
// carry-over register — CO-050 and CO-060 — contain an ESCAPED pipe inside a
// cell. Every column after it shifted, so their status was read as a fragment of
// the sentence before it, and the register held 101 open rows while every number
// quoted about it said 99. The discrepancy was known and PUBLISHED: the backlog's
// own exposure sentence carried both numbers and left the reader to choose.
const verificationLines = read('docs/evidence/verification.md')
  .split('\n')
  .filter((l) => ROW.test(l))
truth.verificationNever = verificationLines.filter((l) => /^no\b/i.test(cell(l, 4))).length
// M115 — "suite now N probes" appears seven times in the ledger with a tally
// that adds up to nothing: 11 → 15 → 19 → 22 → 25 → 29 → 33, while the suite has
// neither 33 probes nor 33 assertion sites. Those rows are HISTORICAL and each
// was true at its own merge, so rewriting them would falsify the record. What
// was missing is a CURRENT number a command produces — and here it is, counted
// from the source rather than from a run, so it holds in the fast tier.
const plantedSrc = read('packages/schema/test/planted.test.mjs')
truth.probes = new Set(
  [...plantedSrc.matchAll(/'(P\d+) /g)].map((m) => m[1])
).size
// NO ASSERTION COUNT IS PUBLISHED, and that is the finding rather than an
// omission. The source has 95 `ok`/`fail` call sites and a green run prints 65
// lines; they measure different things — sites including the failure branch,
// versus assertions actually reached — and M115's whole complaint is numbers
// with no referent. A number I cannot define cleanly is one I must not publish.

// ——— A DISPOSITION IS A FIELD, NOT A SENTENCE (FA-10)
//
// This counted rows whose status sentence BEGAN with the word `open`. Measured
// 2026-09-10, the register's 136 statuses begin with one of seven words —
// disciplined prose, and prose all the same, because nothing said so and the
// counter knew one of them. Five rows begin `narrowed`, `partially` or
// `deferred`, and three say in their own text that work remains: CO-038
// ("account registration as assets and ad/sending identities remain open"),
// CO-059 ("what stays open is the full Cedar-context mapping"), CO-061
// ("checker-infrastructure and budget-governor failure semantics remain open in
// this row"). Three rows of live work, outside the number the plan is steered
// by — and the convention would have shrunk it again the first time somebody
// wrote "still being decided", with nobody the wiser.
//
// The prose is untouched. What is enforced is the FIRST TOKEN: one of a declared
// vocabulary, each word saying whether work remains. A row whose first token is
// undeclared FAILS rather than leaving the count.
const carryRows = read('docs/evidence/specs/2026-08-16-software-fabric-carryover.md')
  .split('\n')
  .filter((l) => /^\| CO-\d+ \|/.test(l))
const undeclared = carryRows.filter((l) => dispositionOf(cell(l, 7)) === null)
if (undeclared.length) {
  fail(`${undeclared.length} carry-over row(s) carry a disposition nobody declared:`)
  for (const l of undeclared.slice(0, 8))
    console.error(`         ${l.slice(2, 10).trim()} — ${JSON.stringify(cell(l, 7).slice(0, 50))}`)
  console.error(`         The vocabulary is: ${vocabulary().join(', ')}. Everything after the first word is yours.`)
} else ok(`every one of the ${carryRows.length} carry-over dispositions is one of ${vocabulary().length} declared words`)

truth.carryOverOpen = carryRows.filter((l) => dispositionOf(cell(l, 7)) !== null && carriesWork(cell(l, 7))).length

// ——— every node a batch names has a row a SCRIPT can read
//
// TWICE IN TWO ITERATIONS a queue row was rewritten leaving `…(#work-x)| **shipped`
// — no space before the separator — and the row vanished from every count while
// reading perfectly well to a person. The node depending on it then read as
// blocked, and the queue total fell by one WHILE something shipped.
//
// A Markdown table is prose to a human and a format to a script, and only one
// of those notices a missing space. The gate checked the numbers it asserts; it
// never checked that every row still parses as a row. A finding class seen
// twice becomes a script rather than a third ledger entry.
{
  const src = read('docs/evidence/backlog.md')
  const ROW = /\| <a id="work-([a-z0-9-]+)"><\/a>\*\*([^*]+)\*\* \| (F\d) \| ([^|]*) \|/g
  const parsed = new Set([...src.matchAll(ROW)].map((m) => m[2].trim()))
  const BATCH = /\| \*\*(F\d) — [^|]*\| ([^|]*) \|/g
  const named = new Set()
  for (const b of src.matchAll(BATCH))
    for (const n of b[2].matchAll(/\[([^\]]+)\]\(#work-/g)) named.add(n[1])
  const orphans = [...named].filter((n) => !parsed.has(n))
  if (orphans.length > 0)
    fail(
      `docs/evidence/backlog.md: ${orphans.length} node(s) named by a batch have no row a script can read ` +
        `(${orphans.join(', ')}). Usually one missing space before a table separator — it reads fine and ` +
        `counts as nothing.`
    )
  else ok(`every one of the ${named.size} nodes a batch names has a parseable row`)
}

const ASSERTIONS = [
  { file: 'docs/evidence/backlog.md', re: /(\d+) of (\d+) verification rows/, key: 'verificationRows', which: 2 },
  { file: 'docs/evidence/backlog.md', re: /(\d+) of (\d+) milestones are shipped/, key: 'milestones', which: 2 },
  { file: 'docs/evidence/backlog.md', re: /(\d+) of (\d+) carry-over rows/, key: 'carryOver', which: 2 },
  { file: 'docs/evidence/backlog.md', re: /(\d+) of (\d+) verification rows/, key: 'verificationNever', which: 1 },
  { file: 'docs/evidence/backlog.md', re: /(\d+) of (\d+) carry-over rows/, key: 'carryOverOpen', which: 1 },
  { file: 'docs/evidence/backlog.md', re: /(\d+) planted-defect probes/, key: 'probes', which: 1 }
]

let asserted = 0
for (const a of ASSERTIONS) {
  const m = read(a.file).match(a.re)
  if (!m) continue
  asserted++
  const claimed = Number(m[a.which])
  if (claimed !== truth[a.key])
    fail(
      `${a.file}: asserts ${claimed} ${a.key}, and counting gives ${truth[a.key]} — ` +
        `a number introduced as measured must be one a command produces`
    )
  else ok(`${a.file}: the asserted ${a.key} count (${claimed}) matches the register`)
}
if (asserted === 0)
  ok('no hand-written exposure counts to check — the documents state no number this gate can falsify')

// ───────────────────────────── 4. the register against the history ─────────
//
// The register is what the roadmap is READ FROM, and until this section existed
// nothing could contradict it. Three failures were found by hand on 2026-09-05,
// all of one family — a status nothing can falsify:
//
//   * NINE rows said `proposed` about milestones that had shipped, one of them
//     built across two runs. The rows had simply never been edited afterwards.
//   * TEN commits carried the scope `M146`, an id with NO ROW AT ALL — the exact
//     leak M114 records about M80, reproduced by me in the same repository that
//     documents it.
//   * The exposure sentence's DENOMINATOR was recomputed here and its NUMERATOR
//     was not, so "23 of 146 shipped" could drift by 9 without a word.
//
// A conventional-commit scope naming a milestone is a claim about that
// milestone. This section reads git and holds the register to it.
//
// HOW IT DEGRADES, stated because it decides whether the check can be trusted.
// A shallow clone sees FEWER commits, so it finds FEWER contradictions: the
// failure mode is a missed finding, never an invented one. With no git at all
// the section says so and checks nothing, rather than passing quietly.

const NOT_STARTED = /^(proposed|scheduled|open|decided, unscheduled)\b/i

let history = null
try {
  const { execFileSync } = await import('node:child_process')
  history = execFileSync('git', ['log', '--format=%h%x00%s'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  })
} catch {
  history = null
}

if (history === null) {
  ok('no git history reachable — the register was not checked against it (stated, not skipped silently)')
} else {
  // Only feat and fix. A `docs(M120)` commit writes ABOUT a milestone; it does
  // not build one, and treating it as shipping evidence would make the register
  // agree with itself.
  const claimed = new Map() // id -> first (newest) commit that shipped it
  for (const line of history.split('\n')) {
    const [sha, subject = ''] = line.split('\0')
    const scope = subject.match(/^(?:feat|fix)\(([^)]*)\)/)
    if (!scope) continue
    for (const id of scope[1].match(/\bM\d+\b/g) ?? [])
      if (!claimed.has(id)) claimed.set(id, `${sha} ${subject.slice(0, 60)}`)
  }

  const rows = new Map()
  for (const line of read('docs/evidence/backlog.md').split('\n')) {
    const m = line.match(/^\| (M\d+) \|.*\| ([^|]*) \|$/)
    if (m) rows.set(m[1], m[2].replace(/\*/g, '').trim())
  }

  const orphans = []
  const stale = []
  for (const [id, commit] of claimed) {
    if (!rows.has(id)) orphans.push(`${id} — ${commit}`)
    else if (NOT_STARTED.test(rows.get(id)))
      stale.push(`${id} says "${rows.get(id).slice(0, 40)}" — ${commit}`)
  }

  if (orphans.length) {
    fail(`${orphans.length} milestone id(s) shipped by a commit have NO ROW in the register:`)
    for (const o of orphans) console.error(`         ${o}`)
  } else ok(`every one of the ${claimed.size} milestone ids in a feat/fix scope has a register row`)

  if (stale.length) {
    fail(`${stale.length} row(s) read as not-started while a commit ships them:`)
    for (const s of stale.slice(0, 12)) console.error(`         ${s}`)
  } else ok('no row reads as not-started while a commit ships it')

  // The numerator, recomputed. The denominator has been checked since M96; this
  // is the other half of the same sentence.
  // "partly shipped" is not shipped. The voice pack's own invariant is to state
  // current capability and planned capability as different things, and a
  // half-built milestone counted whole is the exposure sentence flattering
  // itself by exactly the rows it should be pointing at.
  const shipped = [...rows.values()].filter(
    (s) => /shipped/i.test(s) && !/partly\s+shipped/i.test(s)
  ).length
  const m = read('docs/evidence/backlog.md').match(/(\d+) of (\d+) milestones are shipped/)
  if (!m) ok('the exposure sentence states no shipped count')
  else if (Number(m[1]) !== shipped)
    fail(
      `docs/evidence/backlog.md: asserts ${m[1]} milestones shipped, and counting gives ${shipped} — ` +
        `the denominator has been recomputed since M96 and the numerator never was`
    )
  else ok(`the asserted shipped count (${shipped}) matches the register`)
}

console.log(
  `\nregisters: ${truth.carryOver} carry-over rows, ${truth.milestones} milestones, ` +
    `${truth.verificationRows} verification rows`
)
if (failures > 0) {
  console.error(`\n${failures} register/citation gate failure(s)`)
  process.exit(1)
}
console.log('PASS: registers parse, citations resolve, asserted counts recompute')

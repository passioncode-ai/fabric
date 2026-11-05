report: fabric-0316-final-candidate-docs
# Fabric 0.3.16 final candidate: document and plan dispositions, privacy

A fresh verifier, independent of the five iteration-3 reviewers, read commit
`23e1e89c56ed231b7db091793be92589e4d87739` (branch `feat/nav-wave1`) read-only and checked the change
`344b09e8..23e1e89c` against the baseline `v0.3.15`. HEAD was `23e1e89c` and `git status --short` was empty before and
after. The verifier could not write files; its answer was saved here by the release session, unchanged in substance.

## The switch-off behaviour and the records-file bound against the code

`apps/desktop/src/main/boardDispatchRun.ts#createBoardDispatch`, `pass`: with the switch off every `starting` record is
ended with outcome `unknown` (logged `board.dispatch.ended`, `outcome: 'switch-off'`) and saved; `if (!on && !live) return`
reads the board and runs `watch` only while a record not ended is in flight; the start retry loop is `on ? … : []`; and
`if (!on) return` comes before any decision. The CHANGELOG `## Unreleased` sentence and the AGENTS.md dispatcher row
say exactly this.

The trim keeps a record when `state !== 'ended'`, or when it is its request's newest record and younger than
`KEEP_REQUEST_MS` (8 days); of the rest the newest 500 stay. The AGENTS.md row says exactly this; the CHANGELOG states no
bound and says, truly, that the file is written before Switchboard is asked (`deps.save(records)` before `start`). Eight
days outlast the board's read window (`boardDispatchWiring.ts`, `WINDOW_MS`, 7 days).

## Rows verified

| Row | Finding | Holds | Evidence |
|---|---|---|---|
| V3-1 | UX-1 | yes | `settings.permissions.lede` (en, ru) says the choice covers the agents the person starts and a board-request agent always runs with every permission; the dispatcher passes `--permissions all` (`main/boardDispatchWiring.ts`, `launch`) and reads no `agentPermissions` |
| V3-19 | DA-1 | yes | CO-492 and CO-505 paraphrased |
| V3-23 | DA-5 | yes | the CHANGELOG sentence matches `pass` |
| V3-24 | DO-1 | yes | spec §8, CO-492, CO-505, the board-delivery report paraphrased; the rescan below finds no operator quotation |
| V3-25 | DO-2 | yes | CHANGELOG, AGENTS.md dispatcher row and spec §6 match `pass` |
| V3-26 | DO-3 | yes | the AGENTS.md row matches the keep rule and `KEEP_REQUEST_MS` |
| V3-27 | DO-4 | yes | ADR-0188's amendment points at CO-509; notes in CO-500 and CO-411 (`COMMUNICATOR_URL`, `scripts/lib/communicator-notify.mjs`) |
| V3-28 | DO-5 | in part | §2, §6 and §10 corrected, the wave row points at CO-409 which lists the five items; §3.3 untouched (N2); the disposition claims only §2, §6 and §10 |
| V3-29 | DO-6 | yes | amendments under §2.1 and §2.2 cite `findAbandoned`, `taskMovedAt`, `CLOSED_REASON`; CO-499 note; the sweep row matches `AGENT_ONLY_KINDS` (N5) |
| V3-30 | DO-7 | yes | `dockerLaunch.ts` header names CO-508; `boardDispatch.ts` comments match `DAY_MS` and the switch's label |
| V3-31 | DO-8 | yes | the adapter prerequisite sits in the dispatcher bullet, which cites §10 as amended |
| V3-32 | PL-1 | yes | the `workspace` gitlink and the receipt's `workspace_commit` are both `77e81ea1b75e`; `workspacePinProblem` is null |
| V3-33 | PL-2 | yes, with nits | switch-off sentence fixed; Windows said as not tried yet (N3, N4) |
| V3-34 | PL-3 | yes | CO-409 carries `WorkflowClosed` (built: the take-back's catch matches `/closed/i` and opens a new workflow); CO-509 carries the stop hour and `OP_NAME`, its status names every open item |
| V3-35 | PL-4 | yes | CO-409 by 2026-11-12, CO-509 and CO-503 by 2026-11-18, on `main`, shipped in the release after 0.3.16 |
| V3-36 | PL-5 | yes | Release close owes the schema-98 upgrade, carries CO-365 with CO-508, expects Colima's context; the 1105 plan's checklist corrected |
| V3-37 | PL-6 | yes | Release close names `1add3c03`, `f7758225`, `44c43a06` |
| V3-38 | PL-7 | yes, with a nit | P-29 names CO-411, CO-454, CO-439 part 1, CO-492, CO-502 as shipping and CO-365 as not; commits `7bccca8c`, `45878b10`, `ed7ff822`, `15a984fd` are in `v0.3.15..23e1e89c` (N1) |
| V3-39 | PL-8 | yes | Release close and CO-409 name the fallback and the operator's decision |
| V3-40 | PL-9 | yes | V1-2 amended; migrations 107 and 124 keep the old refusal, recorded in CO-507 |

Lane 12 cites CO-511, the row exists, «Next free ID» is `CO-512`.

## Privacy

Added lines of `git diff -U0 v0.3.15..23e1e89c -- . ':!workspace'`, joined across lines, scanned for «…», "…" and
curly-quoted spans with «operator», «оператор», «relayed» or «the person's word» in the 160 characters before them, no
length floor: 948 candidates, 27 left after removing strings that exist in the product's source, tests, migrations,
scripts, `docs/brand/strings.md` and `docs/ux/scenarios.md`; each of the 27 is an interface or feature name, a rule
name, an earlier spec rule, a quoted product claim or an HTML attribute. No verbatim operator statement remains. Home
paths: only `/Users/example`, placeholders and review text about the old fixture (N6). `check_private.py` over the
iteration-3 reviews: 0 findings. No Markdown document, i18n file or CHANGELOG gained an em dash.

## Commands

| Command | Exit | Result |
|---|---|---|
| `node scripts/check-registers.mjs` | 0 | PASS, 507 carry-over rows |
| `bash scripts/check-docs.sh` | 0 | PASS |
| `node scripts/check-design-map.mjs` | 0 | PASS, 7001 files, 984 anchors |
| `node scripts/check-regions.mjs` | 0 | PASS, 647 markers |
| `check_private.py docs/evidence/reviews/0.3.16/iteration-3 --json` | 0 | findings [] |

## Findings (none blocking)

| Id | Finding |
|---|---|
| N1 | CO-439's date cell says shipped in 0.3.16 for the whole row; parts 2 and 3 stay open |
| N2 | the on-demand spec §3.3 still says the dispatcher records `skipped-off`; `pass` returns before deciding |
| N3 | the CHANGELOG names Windows as not tried; AGENTS.md says Windows or Linux |
| N4 | the CHANGELOG bullet on the board rule states the stop before production as what a session does |
| N5 | V3-29 says the sweep row names `claim-closed`; the row describes it in words |
| N6 | Windows fixtures `C:\Users\p\…` added in `apps/desktop/test/agent-registry.test.mjs` (synthetic) |
| N7 | the text-check ids for UX-1 and UX-4 could not be re-read: no tool reads a stored report |

verdict: ready

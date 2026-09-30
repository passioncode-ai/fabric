<sub>ssheleg skills — task-pipeline · agent-sync · evidence-docs · ux-scenarios · sheleg-design · copywriting · make-skill · webapp-testing · maintaining-fabric-workspace</sub>

# Fabric workspace — publication iteration, 2026-09-07

## Brief and constraints

Operator request: retain the interactive report as a separate project workspace, with a
repository/submodule, structure, brand pack, agent maintenance rules and Heroku publication.
The prior report and all stable anchors must survive. Canonical decisions must have one
home. A snapshot must identify its source and may not imply that target product features
are implemented. The GitHub source repository is private (verified with `gh repo view`).

This supports the vision's durable Project context and sourced state. It is documentation
infrastructure, with no change to Fabric runtime, authority, agent lifecycle or database.

| Requirement | Implementation / acceptance |
|---|---|
| RW-01 Separate durable repository | private `passioncode-ai/fabric-workspace`, pinned `workspace` gitlink |
| RW-02 Complete existing report and brand library | allowlisted immutable source export, same report paths and anchors |
| RW-03 One source and understandable maintenance | ADR-0048, source ownership table, update guide, project skill links |
| RW-04 Versioned update with product iteration | source → snapshot/manifest → child release → parent receipt/pin; source-age gate |
| RW-05 Accessible interactive Heroku site | authenticated HTTPS, home/library/document reader, reports unchanged |
| RW-06 Trustworthy boundary | fail-closed production auth, manifest-only files, safe Markdown, no secret/root serving |
| RW-07 Repeatable agent operation | safe status, immutable export, publish/resume, skill fixtures and discovery |
| RW-08 Same-iteration evidence | map update, local/remote checks and exact review links |

## Design brief

Surface: internal documentation workspace. Job: operator finds a changed scenario,
architecture choice or brand asset and sees the exact source revision. Constraint:
existing Paperclip visual language, PassionCode.ai parent brand / Fabric product.
Falsifier: key report links or search are unusable at 1280×800 or 375px; the version is
hidden; a reader cannot distinguish the target mockup from implemented behavior.
Design dials: variance4, motion1, density5. No variants: this preserves the locked system.
Website navigation scenarios live in the child's `docs/ux/`, distinct from product UX.

## Delivered structure and mechanisms

- [ADR-0048](../../adr/0048-fabric-workspace-is-a-versioned-private-publication.md) records the separate host and snapshot ownership.
- [Publication contract](../../architecture/report-workspace.md) gives the data cycle, boundaries and recovery.
- `scripts/workspace-snapshot.mjs` reads Git blobs, computes a sorted manifest and checks publication receipts.
- `scripts/workspace.mjs` provides status, export, publish and interrupted-release resume.
- The workspace repository owns the web host, guides and maintenance skill. Its generated
  `content/` remains an exported projection; no product source was moved or duplicated as
  another editable truth.
- [Changed map sections](../../reports/map.html#workspace) link the host and synchronization cycle.

## Findings and decisions during implementation

1. **Circular source fingerprint.** The previous map gate attempted to read every tracked
   path as a file; a Git submodule is a directory. Hashing the publication back into its own
   map would also create an endless version cycle. Exclude only the `workspace` projection
   and receipt, hash skill-link targets as symlink text, and check publication separately.
2. **Code-only drift matters.** Equal document hashes alone cannot say a report represents
   current code. Receipt verification compares every non-publication source change since
   the snapshot, not just the export set. Covered by the code-only drift fixture.
3. **Private repository does not protect a deployed URL.** Production access is explicitly
   authenticated; anonymous health reveals no project data. Shared credentials are an
   initial access model, without per-person revocation or access audit.
4. **CI cross-repository key policy.** GitHub rejected a read-only deploy key with HTTP422,
   `Deploy keys are disabled for this repository`. The key was not installed and no
   personal account token was copied into CI. Parent CI verifies source/digest/gitlink;
   child CI verifies snapshot bytes and host. The publisher performs the combined local
   `check --require-child`. Neither separate CI job is described as the combined check.
5. **Heroku submodule integration.** The host is deployed directly, avoiding the documented
   GitHub-integration limitation ([Heroku](https://devcenter.heroku.com/articles/github-integration), fetched2026-09-07).
6. **Evidence state stays separate.** Existing PF/PG findings and CO-108 remain their
   implementation owners' work. Publishing the report does not accept proposed ADR0045–47.

## Independent review and corrections

The [independent review](2026-09-07-report-workspace/2026-09-07-independent-review.md) found five groups:
resume/no-op, host-only releases, live-version verification, receipt/manifest schema and
seven old HTML navigation targets. Corrections preserve the source/pointer distinction,
reuse the source for host-only changes, validate full provenance, check actual runtime
build metadata and rewrite only navigational HTML hrefs at serve time. Historical snapshot
bytes and CSP script hashes remain unchanged. Parent protocol tests exercise actual Git
commits/pushes in temporary repositories; Fabric/host test runners and Heroku are explicit
fixture stubs in the publisher state-machine test, not live deployment claims.

## Verification receipts

Initial immutable export of existing source `fce89652754c21ce4538fbdea11d6556ac351469`
produced336 manifest entries. This is a measured initial snapshot, not a fixed total for
future exports (`node` invocation of `snapshot`/`writeSnapshot`, 2026-09-07).

Local snapshot checks: `node --test scripts/test/workspace-snapshot.test.mjs`, six tests
passed during implementation: immutable source; forbidden paths/symlinks; replacement and
tamper; unmanaged destination; publication cycle/code-only drift; false pin/digest.
These are historical implementation checks; the assembled verification below supersedes their count.

### Remote packaging finding

The first GitHub host check failed because child `.gitignore` omitted17 historical `.log`
evidence files that remained present locally. Its receipt is run34141967552 in the workspace
repository. The exporter now force-adds only its generated content tree, and
`verifyCommittedSnapshot` checks the manifest against committed Git blobs before any push.
The child also runs `verify:content` during Heroku postbuild, so an incomplete snapshot
fails the build. A negative fixture reproduces the local-valid/commit-incomplete case.

The scoped review closed RW-R1–R5. Its follow-up status finding was also corrected:
a staged receipt/pin is described as pending, with `publish --resume`, never as completed.

## Assembled verification — 2026-09-07

- [Publication protocol: 11 PASS](2026-09-07-report-workspace/protocol-tests-final.txt),
  command `node --test scripts/test/workspace-release.test.mjs scripts/test/workspace-snapshot.test.mjs`.
  Includes interrupted parent push, idempotence, host-only release, false deployed identity,
  ignored evidence and a Unicode path. The last review found Git display quoting of Cyrillic
  file names; NUL-delimited tree enumeration fixes it without weakening content verification.
- [Map gate cases](2026-09-07-report-workspace/map-tests-final.txt) pass, including initialized and absent submodules and stable symlink hashing.
- [Final host browser matrix](2026-09-07-report-workspace/browser-final.json): 12 viewport/theme/page combinations pass after the mobile heading correction; keyboard, search, legacy fragment redirect and no-JavaScript reading verified.
- [Maintenance skill: 4 offline fixtures PASS](2026-09-07-report-workspace/skill-contract-final.json),
  command `node workspace/skills/maintaining-fabric-workspace/scripts/evaluate.mjs --fabric-root .`.
  These check the current publisher implementation; they are not a model routing benchmark.
- [Initial running Heroku identity](2026-09-07-report-workspace/heroku-initial-release.json):
  source `fce89652754c21ce4538fbdea11d6556ac351469`, host
  `9bcc811936e7dd831a9731439e3e8027b7f0d5d1`, release v5, 336 content files.
  This is the first verified baseline release. The completed publication's current
  source, child commit and release are recorded by the publisher in the parent
  `docs/workspace-receipt.json`, outside its own exported content to avoid a hash cycle.
- [Live Heroku browser check](2026-09-07-report-workspace/heroku-initial-browser.json):
  nine routes, anonymous access refusal, search recovery, 1280/375px screenshots,
  no page errors or CSP violations. Manual screenshot review found a missing space when
  the homepage heading's line break hides on mobile; the host template now preserves it.
- Workspace [GitHub CI 34142226108](https://github.com/passioncode-ai/fabric-workspace/actions/runs/34142226108)
  passed after the committed-evidence packaging correction. The host's 14 test cases and
  real 336-file snapshot validation ran in a clean remote checkout.
- [Scoped independent review](2026-09-07-report-workspace/2026-09-07-scoped-review.md) and
  [packaging follow-up](2026-09-07-report-workspace/2026-09-07-final-review.md) record the findings,
  their scopes and corrections. A green host check does not certify Fabric product runtime.

## Scope and review

The private host is read-only. Existing browser review exports remain local, not a shared
comment database. Individual SSO is not part of this first publication; revisit when
shared credentials no longer suit the team. Product full-stack P21 failures noted in the
prior iteration remain unrelated and are not rerun against live agent data here.

Review choice: canonical sources remain in Fabric and the separate repository owns the
host plus immutable snapshots. Is that source/publication boundary convenient for our
team, and is initial shared-password access sufficient?

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — repository and Heroku delivery
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — exclusive shared-register lease
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — source-pinned publication contract
- [`ux-scenarios`](https://github.com/ssheleg/super-ux) — workspace navigation paths
- [`sheleg-design`](https://github.com/ssheleg/sheleg-design-skill) — existing Paperclip style
- [`copywriting`](https://github.com/ssheleg/super-ux) — workspace navigation copy
- [`make-skill`](https://github.com/ssheleg/make-skill) — project maintenance skill
- `webapp-testing` — host browser verification — not a skill this family ships
- `maintaining-fabric-workspace` — verified publication cycle — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>

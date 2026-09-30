<sub>ssheleg skills — make-skill</sub>

# Fabric workspace skill — authoring audit

Date: 2026-09-07. Scope: private repository-local skill; no plugin, marketplace,
global install, product runtime operation or deployment was performed here.

The implementation package is `maintaining-fabric-workspace/`. Parent integration
will place it in `workspace/skills/maintaining-fabric-workspace/`, with both
project harness discovery links resolving to the same directory.

| Check | Verdict | Receipt |
|---|---|---|
| Repository capability baseline before prose | PASS: three missing contracts observed at fce8965 | `baseline.json`; exact Git commands, SHA and exit codes |
| Skill mechanical specification/house audit | PASS: 15 checks executed | `mechanical-audit.json`; `audit_skill.py --house --json` |
| Auditor can reject defects without rejecting valid relocation | PASS: valid bundle, invalid name, missing reference | `audit-self-test.json` |
| Offline protocol scenarios | PASS: missing submodule; immutable export; strict receipt/host-only/resume; full deployed identity | `contract-evals.json`; actual publisher hashes captured |
| Command file resolution | PASS: referenced parent command files exist | `command-paths.json`; existence only, not blanket execution evidence |
| One job / one home | PASS, manual source review | `SKILL.md:13` and `SKILL.md:84` |
| Private access, secrets and untrusted data rules | PASS, manual source review | `SKILL.md:98` through access boundaries |
| Other harness / missing tool degradation | PASS, manual source review | `SKILL.md:108` |
| Read-only entry point | PASS in offline missing-child fixture | WS-E01; actual repeated output and unchanged Git state asserted |
| Full-model trigger and behavioral eval | NOT-RUN: upstream runner unavailable | `upstream-eval.txt`: actual `claude plugin eval ./maintaining-fabric-workspace --no-publish`, exit 1, early access |
| Upstream skills-ref validator | NOT-RUN: executable absent | `command -v skills-ref` returned no executable; house checker is not claimed as upstream execution |
| Parent discovery links / final publisher / remote release | NOT-RUN by this author | Root integration and deployment own these checks |

The authored corpus contains 7 scenarios and
20 trigger queries, with positive and negative cases
on both train and validation sides. These counts come from `evaluations.json`.
The trigger corpus is authored coverage, not measured routing accuracy. WS-E04
through WS-E06 were reviewed against the written procedure; no fresh-model
behavior pass is claimed. WS-E01 through WS-E03 and WS-E07 exercised actual repository
contracts in isolated fixtures with no network, credentials or remote mutation.

Coexistence was measured with `npx sshlg-skills toolkit --for ...`: 527 reachable
skills on this machine. The shortlist includes documentation, UX and
creating-fabric-agents; the new description therefore limits selection to Fabric
workspace maintenance and explicitly excludes creating agents, unrelated docs,
product-runtime deployment and reusable skill publication. This is a routing
boundary review, not a statistical coexistence benchmark.


## Protocol update — 0.1.1

`protocol-upgrade-baseline.txt` captures the old fixture failing because the
publisher gained a separate release module. The revised fixture copies all
three publisher modules and tests the actual current implementation.
`pending-receipt-negative.txt` records a further real defect: a staged receipt
and gitlink were mistaken for a completed parent commit. Root fixed
`completedPublication` to require a clean parent worktree. The same assertion
now passes in `contract-evals.json`, with source-module hashes attached.

The expanded WS-E03 checks full receipt fields, completed versus pending
pointers, original-source reuse for a clean host-only child commit, new-source
selection after a canonical change and rejection of changed manifest provenance.
WS-E07 rejects mismatched repository/SHA, digest, runtime build and release, as
well as pending/noncurrent Heroku releases. This is a pure identity validator
check; authenticated HTTP and live Heroku verification remain root-owned.

The skill now documents completed/no-op publication, failed parent push recovery,
`publish --resume`, local child commits ahead of origin, and independent parent
and child CI scopes. No cross-repository CI credential policy is introduced.

## Repeat the checks

From the package parent directory:

```sh
node maintaining-fabric-workspace/scripts/evaluate.mjs --fabric-root /path/to/fabric
```

Use the actual source checkout. Run `scripts/audit_skill.py` from the installed
make-skill directory against `maintaining-fabric-workspace --house`. The fixture
runner checks its publisher dependency and emits NOT-RUN when it is missing.
Review script content before running it against a different source revision.
Source hashes in `bundle-digest.json` bind this evidence to the authored bundle;
rerun after integration changes the bundle or publisher.

Used skill: make-skill — format, scope, authoring, offline fixture and mechanical
audit procedure. No other skill was used by this bounded authoring subtask.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`make-skill`](https://github.com/ssheleg/make-skill) — private skill authoring and offline contract audit

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>

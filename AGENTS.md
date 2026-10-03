# Working in this repository

## Read first

1. The PassionCode.ai knowledge base — `workspace/knowledge/` in this checkout (the `workspace`
   submodule; `git submodule update --init workspace`), `fabric-workspace/knowledge/` in a clone,
   or [on GitHub](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/README.md): the vision, the principles, how to work, the rules and the
   repository standard. It owns every cross-repository fact; this repository owns Fabric's.
2. This file, then the organization's
   [CONTRIBUTING.md](https://github.com/passioncode-ai/.github/blob/main/CONTRIBUTING.md).

Read [`docs/AGENT_SYNC.md`](docs/AGENT_SYNC.md) before touching anything shared. It is
**generated** from the live coordination config and describes how this project is wired —
which plane holds what, what guarantee the lease actually gives, and the cycle per task.
If it disagrees with the tool, the tool is right and the file is stale: regenerate it with
`agent_sync.py setup`. Do not restate its contents here; a second copy drifts.

## The three rules that are not in the generated file

**1. A shared file is written under a lease, or not written.** The guarded set is listed
in the snapshot. `acquire` → work → `release`, on every path including failure. One lease
covers every guarded file: hold one, or write none. An unclaimed edit to a register is how
two agents overwrite each other, and a clobbered decision looks exactly like a decision.

**2. Decisions and deferrals have one home each.** A settled choice becomes a numbered
record in [`docs/adr/`](docs/adr/README.md) — append-only, and a reversal is a *new*
record, never an edit to the old one. Anything deferred, dropped or left half-done becomes
a row in the carry-over ledger the moment it is said, not when the stage ends. Both files
carry the next free id; take it the way the snapshot says to take it.

**3. A claim that will be read as true carries its receipt.** `file:line`, a command and
its output, a source and the date it was fetched. `docs/architecture/external-contracts.md`
states this as a rule about itself — "a number without a source in this file is a defect" —
and it holds everywhere else too. The glossary those claims are held to is
[`CONTEXT.md`](CONTEXT.md): a term means what it means there, in code, docs and agent
instructions alike.

## Code region markers

A feature, a module or a special condition in code is fenced so that an agent searching the
code lands on the documented truth and can check the code against it
([ADR-0090](docs/adr/0090-names-passioncode-is-the-organization-fabric-is-the-ceo-and-its-tools-carry-its-name.md) run, REQ-20):

```ts
// #region registry-scan — docs: docs/evidence/specs/2026-09-29-agent-registry-design.md#3-registry-req-01-req-02-req-10
…the code of that feature…
// #endregion registry-scan
```

Any comment leader works (`//`, `#`, `--`, `/*`, `<!--`). The `docs:` reference is repository-root
relative and must resolve to a file and one of its headings or ids. `node scripts/check-regions.mjs`
(part of `scripts/ci.sh`) fails an unclosed region, an end without a start, a region without a
`docs:` reference and a reference that does not resolve. New code of a feature carries its region
in the same change; existing code gains regions when it is next changed.

## Vision alignment — hard rule (super-ux)

Before planning any new feature, capability or significant change, check it
against `docs/ux/vision.md` — specifically the **anti-vision** and the
**alignment test**.

**Aligned** → proceed, and say in one line which part of the vision it serves.

**Misaligned** → stop and say so before writing code:
1. Name the conflict — which layer it contradicts, quoting that layer.
2. Offer two paths: (a) reshape the feature to fit, with the specific change;
   (b) amend the vision, saying which layer changes and what that costs.
3. Wait for the decision. Do not pick one silently.

**Do NOT trigger for:** bug fixes, refactors, dependency work, tests,
documentation, or anything with no user-facing surface. A vision check on a
typo fix is how a team learns to skip the check that matters.

## Design, brand text and product UX — which skill

Visual layer → `sheleg-design`; brand text → [`docs/brand/`](docs/brand/README.md) through `copywriting`; product UX → `super-ux`. This repository vendors no third-party design skills.

<a id="iteration-contract"></a>
## Iteration contract — operator rule, 2026-09-06; reinforced 2026-09-07

The private project workspace is a versioned publication at the `workspace` submodule.
Before maintaining or publishing reports, read
`workspace/skills/maintaining-fabric-workspace/SKILL.md` after initializing the submodule.
The same skill is exposed under `.agents/skills/` and `.claude/skills/` by links to that
single home. If the submodule is absent, `node scripts/workspace.mjs status` names the
initialization step; do not copy the skill or invent a second update procedure.
Source facts remain beside Fabric code. After a reviewed source iteration is committed,
run `node scripts/workspace.mjs publish` to publish, verify and pin its workspace snapshot.
`node scripts/workspace.mjs check --require-child` verifies the relationship. See the
[publication contract](docs/architecture/report-workspace.md) for the two-commit cycle.

Every meaningful project iteration updates the living [design map](docs/reports/map.html)
in the same change. This includes architecture, data, code, features and documentation:
when no product screen changes, name the changed module/contract/status; never imply a
new UI was shipped. User-facing behaviour still propagates through scenarios → flows → screens.

1. Add an entry at the **top** of `#changelog`: what changed, what remains, and exact
   stable map anchors to inspect. Preserve old anchors and dated audit/report snapshots.
2. Review the affected map sections against their sources, then run
   `node scripts/check-design-map.mjs --refresh` and `node scripts/check-design-map.mjs`.
   Refresh only stamps bytes; it does not write or verify the content for you.
3. Before commit run `bash scripts/ci.sh fast` (or full when needed). It includes the
   map, documentation and register gates. Do not call the map current on a failed check.
4. The merge-log entry lands **inside** the iteration, not after it. `docs/MERGES.md`
   is a map source, so a `docs(merges)` commit written once the branch has landed
   changes the sources after the stamp and leaves the design map stale on `main` —
   which is the one place it is read. Measured 2026-09-09: `docs/MERGES.md` is one of
   the 1 250 files the stamp hashes, and appending a single line to it takes
   `check-design-map.mjs` from exit 0 to exit 1, "Map sources changed". No past commit
   demonstrates this — the gate only arrived on 2026-09-07 in `d51eb35`, after the last
   such landing — so the mechanism is the evidence, not a red build. Write the entry in
   the same change, then land by fast-forward.
5. In the final message open/show the map, link the **specific changed anchors**, and
   give a 3–6-line retro: what shipped, what was found, what to verify, what remains.
6. Ask the standing review question explicitly, in the operator's language: did we plan
   this correctly, and are we doing it correctly? Name the concrete choice open to review. This is a
   close-out review invitation, not a request to re-authorise work already requested.

For changes to scenarios, flows or screens, update the visual route model and affected mockups in the same iteration: `docs/ux/product-model.json`, `scripts/product/`, then `node scripts/sync-product-ux.mjs` and `node scripts/build-product-report.mjs`. `docs/reports/product.html` is generated target design, never a production coverage receipt; keep canonical UX status and prototype behaviour distinct.

The direction everyone works to is the [general development plan](docs/evidence/backlog.md#general-development-plan)
([ADR-0101](docs/adr/0101-the-general-development-plan.md)): lanes of the product, each naming its work by id.
Inside a lane the order is that register's own (ADR-0101 §3); the
[build order by layer](docs/evidence/backlog.md#build-order-by-layer) schedules the batches it names:
actual prerequisites and integrity first; a long file alone does not block all features.
Readiness is per capability, not a blanket waterfall across every item in a layer.
[ADR-0044](docs/adr/0044-foundation-first-delivery-and-the-living-design-map.md) records
this policy; future domain/architecture reversals still require their own ADR.

## Organisation

This repository is one of the `passioncode-ai` repositories. The organization's rules —
branches, commits, CI, leases, secrets, handoffs — live in the knowledge base,
[`knowledge/rules.md`](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/rules.md)
(ADR-0093; `workspace/knowledge/rules.md` in this checkout); the repository map and onboarding
are in [passioncode-ai/org-index](https://github.com/passioncode-ai/org-index) (both private;
readable by every org member):

- [repositories](https://github.com/passioncode-ai/org-index#repositories): which repository owns what, and how they connect
- [ONBOARDING.md](https://github.com/passioncode-ai/org-index/blob/main/ONBOARDING.md): setting up a new contributor's machine

Where this file is stricter than the organization's rules, this file wins. A change to this repository's
role, dependencies or test command updates its row in `org-index/repositories.json` in the same change.

### Coordination from a second machine

`.claude/agent-sync.json` sets `leaseBackend: "git"` with the Notion record plane
(`backend: "notion"`). The two halves need different things, so a contributor without
the Notion token still has the part that prevents overwrites:

| Part | Needs | Without the Notion token |
|---|---|---|
| Lease (`acquire` / `renew` / `release`) | push access to `origin` | **Works.** A lease is the ref `refs/agent-sync/leases/<key>` on `origin`; the remote's non-fast-forward rejection decides it, so a lease taken on one machine blocks the other. |
| Id reservation (`reserve ADR`, `reserve CO`) | push access to `origin` | **Works.** Counters are refs under `refs/agent-sync/ids/`. |
| Record plane (`record`, `reconcile`, board, mirror) | the token in the gitignored `.env.agent-sync` | **Degraded.** The tool falls back to the local `fs` plane (`whoami` prints `backend fs`): runs are recorded only on that machine, so the two machines do not see each other's journal or board. The lease guarantee is unchanged. |

The token is never copied between machines. Awareness of the other person's work then
comes from `git ls-remote origin 'refs/agent-sync/leases/*'`, the branch and the PR, not
from Notion. Install the tool with `npx @ssheleg/agent-sync install` and run
`agent_sync.py status` before a session; it says which guarantee is in force.

## After work

In the same run: the iteration contract above (design map, gates, handoff); if a
cross-repository fact changed — a product, a version, a plan row, a principle — update the page in
`workspace/knowledge/` that owns it (a fabric-workspace PR); then `node scripts/workspace.mjs sync`
(or leave it to the scheduled sync) so the wiki matches `main`.


## Shared backlog

[docs/backlog-sources.json](docs/backlog-sources.json) declares this repository's canonical task sources.
The [common backlog](https://wiki.passioncode.ai/backlog) is generated from committed local rows.
Read the [backlog contract](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/backlog.md) before task work.
Edit status only in its owning source, under the project lease; preserve IDs, history and evidence.
A cross-project task has one owner and links to dependencies, never a second editable status.
Land local changes, then run `node scripts/workspace.mjs sync`; verify publication and source freshness.
The shared view is a publication, not a separate board to edit.

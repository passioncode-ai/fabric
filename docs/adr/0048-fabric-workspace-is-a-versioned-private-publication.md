# ADR-0048: Fabric workspace is a versioned private publication

- **Status:** accepted
- **Date:** 2026-09-07
- **Source:** operator request in this task: separate repository/submodule, interactive report, brand pack, agent maintenance skill and Heroku publication.

## Decision

Keep canonical Fabric product facts in this repository: architecture, decisions, backlog,
UX scenarios, visual models, report generators and brand sources. Create the private
`passioncode-ai/fabric-workspace` repository, pinned here at `workspace` as a Git submodule.
It owns the documentation web host, navigation, maintenance skill and generated, immutable
`content/` snapshot. Deploy that repository directly to Heroku. Do not deploy the Fabric
desktop application or require its database to read documentation.

The source commit precedes the workspace publication commit. A final parent commit changes
only the submodule pointer and `docs/workspace-receipt.json`. Both are publication outputs
excluded from the design-map fingerprint and export selection; a separate gate verifies
their relationship to the complete source revision. This removes the circular dependency
in which a map hashes the snapshot containing that map.

Each snapshot contains a manifest with immutable source commit, explicit file list,
byte lengths and SHA-256 hashes. Content is not edited in the publishing repository.
The website serves only these entries and its own declared host assets. Internal project
facts remain authenticated by default, matching the private source repository. Basic
password access is the initial team access mechanism; it does not represent individual
member identity or per-person revocation.

## Alternatives

- Moving all canonical docs into a submodule now would split every code/doc change and
  break the existing generators, source receipts and coordination ownership.
- A second editable copy would permit contradictory decisions and stale scenarios.
- Hosting Fabric itself to display reports would unnecessarily couple review to agent
  runtime, data stores and credentials.
- Heroku GitHub deploys do not reliably support submodules; the standalone host avoids
  that dependency ([official documentation](https://devcenter.heroku.com/articles/github-integration), read 2026-09-07).

## Consequences / affects

- [Workspace contract](../architecture/report-workspace.md) owns the synchronization protocol.
- [Documentation map](../DOCMAP.md) records source and projection ownership.
- [Living design map](../reports/map.html#workspace) links the publication and update loop.
- `scripts/workspace.mjs`, `scripts/workspace-snapshot.mjs` and their tests enforce the protocol.
- The submodule's `skills/maintaining-fabric-workspace/SKILL.md` is the agent procedure;
  project skill directories point to this one copy.
- [ADR-0055](0055-the-workspace-host-owns-the-first-line-of-every-report.md) settles what the
  host may do to the bytes it serves and what a reader's browser may store, 2026-09-10.
- Publication does not accept proposed ADR-0045–0047 or close the product audit backlog.

## Reversal condition

Move canonical documentation only under a new ADR that supplies atomic cross-repository
delivery, source receipt migration and the same-change UX/design-map gates. Introduce
individual access when shared-password access no longer meets the team's needs.

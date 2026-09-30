# Independent review — Fabric workspace publication, 2026-09-07

Reviewed the supplied brief, publication contract, implementation diff and current source files. Read-only review: no repository files, remotes, deployment or runtime data were changed. Focused negative probes used temporary Git repositories; the previously reported test suites were not rerun.

## Findings

### RW-R1 · P1 — Resume cannot finish a failed final push, and a successful publication is not idempotent

**Location:** `scripts/workspace.mjs:27`, `:34`, `:52`.

Trigger: source commit A is exported to W, deployment succeeds, the parent pointer commit B succeeds, and `git push origin HEAD` fails. The documented `publish --resume` then takes B as its source while the existing child manifest names A, so line 34 refuses the valid interrupted publication. A normal retry instead exports B as a new source and creates another child/pointer pair. Calling normal publish after a fully successful publication also creates this unnecessary pair, because no existing-receipt/no-op state is recognized.

Fix: resolve the publication state from the existing receipt, current HEAD and child manifest. Distinguish a new source iteration from an already-created pointer commit; if the existing receipt/pin remains valid, verify the remote release and complete only missing parent publication, or return an idempotent success. Add injected-command tests for failure after each persistent side effect, especially failure/uncertainty after parent commit and after parent push. Do not redo an export to repair a parent push.

### RW-R2 · P1 — A committed host change cannot use the advertised publication workflow

**Location:** `scripts/workspace.mjs:23`–`:31`; `$HOME/DATA/fabric-workspace/docs/DEPLOYMENT.md:60`.

Trigger: after publication A → W → B, fix the website in the child, commit W2 and push its main. The parent working tree now has only a changed `workspace` gitlink. Normal publish refuses at `clean(root)`. Resume admits that dirty gitlink but refuses because the unchanged content manifest still names A while the parent is B. The runbook explicitly prescribes fixing host code without changing source documents, then publishing and pinning, but neither command implements that path. Committing the child gitlink into a new parent source commit first would also contradict the documented rule that the source iteration retains the previous publication pin.

Fix: support a reviewed host-only release state with the existing valid source A and new clean child W2, verifying child ancestry and exact manifest bytes before deployment/pinning. The command should distinguish this from an interrupted new source export. Test a child host-only commit and remote advancement without resetting or force-pushing.

### RW-R3 · P1 — Receipt can be written without verifying the running snapshot

**Location:** `scripts/workspace.mjs:44`–`:50`; corresponding required check is `$HOME/DATA/fabric-workspace/docs/DEPLOYMENT.md:42`.

The publisher reads only public health and the latest Heroku release description. It never requests authenticated `/version.json`. A new release record plus an old healthy process during rollout can satisfy these checks even though the expected source/digest is not serving; a misconfigured public origin can likewise return the generic health payload. The resulting receipt calls a deployment verified before the runbook's identity condition was checked.

Fix: use protected local credentials without printing them, require anonymous content denial, then request authenticated version data with bounded retries and timeouts. Require the expected source repository, full source commit and content digest, together with the expected workspace release identity. On mismatch, leave the parent receipt/pin unchanged. Test healthy-wrong-version, delayed rollout, unauthorized version, public content, and nonresponding endpoints. Exact slug/release metadata is preferable to a substring match on an eight-character prefix.

### RW-R4 · P2 — Parent receipt/combined verification accepts malformed contracts

**Location:** `scripts/workspace-snapshot.mjs:64`, `:76`–`:78`.

Focused probe 1: a temporary parent with `source_commit: "HEAD"`, a valid digest/gitlink, and no deployment fields passes `checkReceipt` when the child is absent. The only receipt shape checks are schema and workspace SHA; source can therefore be a mutable ref rather than the promised immutable SHA.

Observed output: `{"probe":"mutable HEAD source + absent deployment fields + absent child","result":{"source":"0a929136bcb9525efeafefa6a0396611da66af8e","workspace":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","files":1,"child":"not checked; absent locally"}}`.

Focused probe 2: an initialized clean child whose manifest has `schema:999`, repository `https://wrong.example`, and missing `exported_at` passes the supposedly complete `check --require-child` when commit/digest/files still match. The host's own manifest parser rejects this shape, so the combined command can report a verified child that cannot start.

Observed output: `{"probe":"malformed child manifest","result":{"source":"7170d665ebcd39c1872860f1e7143fd32eacade9","workspace":"a47db66dd53cb620d559331d914e5c0c6c0ded8e","files":1,"child":"verified"}}`.

Fix: validate the full receipt shape (full immutable source SHA, digest, configured application, positive release identifier), require source ancestry, and compare the child manifest to the complete canonical manifest derived from that source, including schema/repository/time/files. Add these negative cases to the parent tests. Keep the acknowledged absent-child CI limitation explicit; this finding is about the checks the parent can and claims to perform.

### RW-R5 · P2 — Existing report navigation has seven unresolved local targets on the new host

**Location:** `$HOME/DATA/fabric-workspace/server.mjs:86`–`:94`.

The server rewrites Markdown links, but serves HTML with only newline normalization and requires every requested path to be an exact manifest file. Parsing all HTML href/src values in the actual 336-file snapshot found seven unresolved local targets:

| Report | Link | Required destination |
|---|---|---|
| `docs/reports/map.html` | `../adr/` | decisions folder in library |
| `docs/reports/2026-09-06-map.html` | `../adr/` | decisions folder in library |
| `docs/reports/2026-09-05-status.html` | `../adr/`, `../ux/` | corresponding library folders |
| `docs/architecture-map.html` | `../schemas/project-blueprint.schema.json` | source-pinned GitHub file or explicitly exported schema |
| `docs/audit/2026-09-07-merged-execution-plan.html` | two `docs/audit/...` absolute links | their existing exported document paths |

Fix: preserve immutable historical snapshot bytes and normalize/rewrite navigational hrefs in the rendered response using the same safe source-aware link resolution as the reader, or provide equivalent deliberate compatibility routes. Keep CSP hashes consistent with served script bytes. Add actual-snapshot link coverage for directory, absolute local and non-exported source targets; current fixture-only link tests miss these paths.

## Checks reviewed without a new finding

- Missing child is explicitly unverified; `--require-child` rejects absence. Parent CI does not falsely claim to verify private child bytes.
- Export uses committed Git blobs rather than dirty files and refuses tracked symlinks in selected source paths.
- Source freshness covers code-only changes, not just document hashes. Map hashing excludes only publication outputs and hashes discovery links as symlink text.
- Host production configuration fails closed; server uses an in-memory manifest allowlist and authenticates docs/assets/version/catalog. Unlisted files do not become readable just because they exist on disk.
- Markdown sanitizer, link scheme restrictions, CSP and path parsing have relevant negative fixtures. Loaded bytes are immutable after startup.
- No evidence here implies product PF/PG issues or proposed runtime ADRs have been implemented.

## Not verified

Heroku deployment, current credentials, anonymous remote denial, running release identity, remote browser behavior, final recursive checkout and final Git pins were outside this read-only review and not checked. The root implementer is completing those checks. No live Fabric agents or database were launched.

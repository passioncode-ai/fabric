---
report:
  id: fabric/2026-10-04-hub-i3-errors
  title: "Fabric hub: independent I3 correctness review"
  kind: review
  project: fabric
  domains: [security, reliability]
  as_of: 2026-10-04
  status: active
  valid_until: 2026-10-05
  summary: >-
    Independent review of exact candidate 3b2878fc9283db5fc9a81697ba8538a01630b8d9.
    Nineteen synthetic probes produced thirteen passing and six failing assertions.
    Response serialization and idempotency eviction permit duplicate effects; product-error
    output can disclose the connected-product credential. Request changes; no live acceptance.
  sources:
    - name: "Frozen Fabric source"
      url: "https://github.com/passioncode-ai/fabric/tree/3b2878fc9283db5fc9a81697ba8538a01630b8d9"
      read_at: 2026-10-04
    - name: "Original ADR-0115 contract before amendments"
      url: "https://github.com/passioncode-ai/fabric/blob/67a5dc42d19357f82156f51dcab7d42db0b0e9df/docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md"
      read_at: 2026-10-04
    - name: "Original binding authority and idempotency contract"
      url: "https://github.com/passioncode-ai/fabric/blob/67a5dc42d19357f82156f51dcab7d42db0b0e9df/docs/adr/0026-fabric-exposes-a-project-scoped-policy-enforced-mcp-control-surface.md"
      read_at: 2026-10-04
    - name: "Independent executed probes"
      path: "raw/probes.jsonl"
      read_at: 2026-10-04
  produced_by:
    agent: "codex-independent-i3-errors"
    task: "Fabric hub recovery I3 errors review"
  supersedes: []
  consumers: []
---

<sub>ssheleg skills — task-pipeline · code-review · evidence-docs · project-reports</sub>

# Fabric hub: independent I3 errors review

## Verdict and provenance

**Request changes** for `3b2878fc9283db5fc9a81697ba8538a01630b8d9`. Three high-priority
application defects affect duplicate-effect prevention and response privacy. Two additional
mechanisms concern bounded resource use and dispatch authority. Production incidence and
affected-user counts are unknown.

The reviewer branch started directly from the committed SHA supplied by root. Original hub
baseline: `67a5dc42d19357f82156f51dcab7d42db0b0e9df`. Product implementation is untouched.
Author recovery reports/ledger were not inputs to findings. Initial ADR-0115 reading at
`origin/main` exposed amendments embedded in that file; normative comparisons below use its
original pre-amendment decision and ADR-0026. Required catalog discovery exposed recovery
metadata, but no recovery report was opened or used.

## Method and executed evidence

[raw/probes.mjs](raw/probes.mjs) directly imports candidate modules. All credentials are
synthetic; all HTTP listeners are the harness's ephemeral loopback fixtures. Store/vault
doubles explicitly control await boundaries. No actual Inbox account, product session,
paid effect, live database, launchd service or real credential was used.

Executed from the repository root:

```sh
node --experimental-strip-types docs/reports/2026-10-04-hub-i3-errors/raw/probes.mjs > docs/reports/2026-10-04-hub-i3-errors/raw/probes.jsonl 2> docs/reports/2026-10-04-hub-i3-errors/raw/probes.stderr
```

**Exit 1.** [Output](raw/probes.jsonl) ends with
`{"summary":{"total":19,"failed":6,"passed":13}}`; [stderr](raw/probes.stderr) is empty.
Six negative assertions cover five mechanisms: the injected rejection and real deeply nested
product answer reproduce the same failure. Passing controls establish the harness can observe
one dispatch, cancellation, explicit refusal and resource cleanup. No fix verification occurred.
The operator then requested report completion using existing results only; no later product
execution was undertaken. Source pin, file hashes and independently recounted totals are in
[receipt.json](raw/receipt.json).

Preparation: `pnpm install --frozen-lockfile --offline` failed with
`ERR_PNPM_NO_OFFLINE_META`; `pnpm install --frozen-lockfile` exited 0 and passed its supply-chain
policy check. Runtime: Node `v26.8.2`, pnpm `11.21.0`. No second-runtime reproduction was performed.

## Findings

### I3-E1 — Response serialization failure permits a duplicate effect (high, blocking)

The **actual deep product answer does not cause duplicate write** probe uses real
`forwardToProduct` with a synthetic MCP product named `fabric-inbox`, version `0.9.0`.
The product executes `tools/call` and returns valid JSON `structuredContent` nested 6,500
objects deep. Hub envelope serialization fails. The broad `perform` catch returns
`hub-unavailable`, says **“Nothing was sent”**, and forgets the key. The same-key retry
executes the tool again: `toolCalls: 2`, first/second error `hub-unavailable`.

The smaller injected forward-rejection probe also observes two calls; real transport is the
stronger proof. These are synthetic counters, not real mail effects.
Sources at reviewed SHA:
[hubCall.ts:230](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src/main/hubCall.ts#L230),
[hubCall.ts:314](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src/main/hubCall.ts#L314),
[hubTools.ts:32](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src/main/hubTools.ts#L32).
Original requirement: ADR-0026 §6 and MCP control-surface §4 stable-key replay.
Correction: preserve dispatch state across every later failure, report unknown/answer-unavailable
honestly, and bound response processing. The same original key must execute once.

### I3-E2 — Capacity eviction forgets an unknown-effect key (high, blocking)

The **unknown replay after 256 newer calls must not send twice** probe receives `reached: true`
without a product answer, then settles 256 newer keys on the same binding. Capacity eviction
removes the oldest entry even when its state is `unknown`. Retrying that key dispatches again.
Observed: original key dispatched twice, `totalCalls: 258`, memory `keys: 256`. The paired
**unknown replay within capacity sends once** control passes with one dispatch. Everything
occurs in one process, within the 24-hour lifetime.

The description discloses “256 most recent” while also promising an unknown-effect key is
never resent; bounded answer storage must not make an unknown effect indistinguishable from
a new call. Source:
[hubCall.ts:403](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src/main/hubCall.ts#L403).
Original requirement: ADR-0026 §6 and control-surface §4. Correction: retain safety-critical
tombstones or refuse further admission before losing them; explicitly define replay lifetime.

### I3-E3 — Product tool-error output discloses its credential (high, blocking)

The **product tool error cannot disclose callee secret** probe uses real product transport.
Its synthetic product returns `isError: true` and text containing the synthetic
`CF-Access-Client-Secret` and `CF-Access-Client-Id` received in headers. Exception-message
scrubbing does not run on ordinary tool results, so hub output contains both values.
Observed: `toolCalls: 1`, `disclosed: true`, `clientIdDisclosed: true`, outcome `failed`.
Saved result records booleans; no real secret was involved.

Sources:
[productForwarder.ts:174](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src/main/productForwarder.ts#L174),
[hubCall.ts:313](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src/main/hubCall.ts#L313).
Original requirement: ADR-0115 §6 refuses handing callee credentials to the agent. Correction:
sanitize every forwarded/cached result representation, including normal product errors.

### I3-E4 — Partial bodies occupy ingress before admission accounting (medium)

With `budgetCalls: 2`, **stalled bodies do not bypass admission budget** opens six POSTs with
the synthetic door bearer, declared length 1,000 and one byte supplied. All remain pending
at 250 ms; the harness explicitly closes them. Principal resolution precedes `readJson`, but
budget spending follows body ingestion. `readJson` caps bytes without an explicit body
deadline, and the listener specifies no admission concurrency limit.

Observed: `pending: 6`, `budgetCalls: 2`, `heldMs: 250`. This demonstrates admission outside
the budget, not indefinite holding, process exhaustion or production incidence. The separate
1,000,001-byte check receives explicit 413.
Sources:
[agentSurface.ts:722](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src/main/agentSurface.ts#L722),
[agentSurface.ts:739](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src/main/agentSurface.ts#L739).
Correction: bound incomplete requests before body ingestion with a deadline and separate
admission budget while preserving request-specific polling fairness.

### I3-E5 — Dispatch retains a grant snapshot across credential I/O (medium)

**Revocation during vault await prevents dispatch** snapshots a live grant, blocks vault
reading, removes that grant from live authority, then resolves the read. Forwarding still
occurs: `dispatched: 1`, outcome `succeeded`. Caller cancellation at the same boundary
correctly yields zero dispatches. The fixture models completed revocation, not a database
transaction or a measured live incident.

ADR-0026 §4 evaluates authority at every resulting Effect; §9 distinguishes revocation from
cancellation while requiring future Effects to re-authorize. This finding does not require
retroactively cancelling an admitted durable run: it concerns a later outbound effect not yet
dispatched. ADR-0115 §3 (“stops the next call”) alone is weaker; the review relies on its
explicit extension of ADR-0026. Root should record any narrower hub authority decision.
Source:
[hubCall.ts:289](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/apps/desktop/src/main/hubCall.ts#L289).
Correction: revalidate binding, coverage and live connection after credential I/O, before
forwarding. Owned-database authority verification remains with the responsible lane.

## Passing observations and coverage limits

The saved run has 13 passing assertions:

| Boundary | Observation |
|---|---|
| Unknown key within capacity | One dispatch; retry `outcome-unknown`. |
| Cancel before vault resolves | Zero dispatches; `cancelled`. |
| Concurrent matching key | One dispatch. |
| Host mismatch | 421. |
| Browser Origin | 403. |
| Batch envelope | 400. |
| Oversized envelope | 413. |
| Late vault completion | 504; no record. |
| Late append | 504; late connection withdrawn. |
| Parallel connect admission | Second attempt `busy`. |
| Forward deadline before initialize | About 30 ms; `reached: false`. |
| Changed predecessor | 409; live connection preserved, zero appends. |
| Release pin predicate | Metadata-only diff accepted; runtime diff refused. |

The release check imports `verifiedCandidateProblem` with controlled Git responses. It is
a positive/negative predicate probe, not actual release preflight or hosted CI. The reviewed
app manifest remains `0.3.0`; this reviews the hub candidate intended for 0.3.1 and authorizes
no version bump, tag, signing, installation, deployment or release.

**Not run:** authenticated live Inbox/narrowing on deployed worker; paid effects; live DB;
owned-database CAS/revocation suites; native/visual/device acceptance; lifecycle broker;
real agent enrollment; full repository gate; hosted CI; release approval and artifact
signing/notarization. Host/Origin checks use actual AgentSurface with authentication doubles.
Late-response/CAS fixtures omit cross-process SQL concurrency. No production mutation was
planted; no fixes were tested. No claim of deployed compatibility is inferred from a product
self-reported name/version.

## Handoff

Completed: source study, synthetic adverse execution, five independently formed findings,
preserved probe bytes/results and this report. Open: root dispositions/fixes, database seams,
exact-SHA fix verification and integration gates. Decision: request changes.

Root owns guarded ledger and map integration; neither is edited here. Next task: fix
I3-E1/E2/E3 on a separate implementation branch and record I3-E4/E5 dispositions, then send
this reviewer an exact committed SHA for bounded fix verification. Entry point: this README;
reproduction bytes: [raw/probes.mjs](raw/probes.mjs). Generated report indexing is root-owned
to avoid competing concurrent wiki index changes.

## Skills actually used

`task-pipeline`: scope/evidence/dependencies/resume point. `code-review`: correctness and
privacy (foreign skill on the pipeline review lane). `evidence-docs`: commit references,
measured counts and exclusions. `project-reports`: dated home/header/validation. Workspace
maintenance skill was read for publication ownership; no publication was performed.

Report-only checks: `reports.py check docs/reports/2026-10-04-hub-i3-errors` exited 0 with
one report and zero errors; `git diff --check` exited 0. The probe totals were independently
recounted from JSONL as 19 total, 6 failing and 13 passing. Map/ledger/full-gate integration
remains root-owned, and is not claimed passing by this report branch.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded independent review and handoff
- `code-review` — application correctness and privacy review — not a skill this family ships
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — source-pinned reproducible findings
- `project-reports` — dated report metadata and validation — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>

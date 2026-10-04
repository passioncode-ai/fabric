---
report:
  id: fabric/2026-10-04-contract-consumer-review
  title: "CO-193: Fabric argument validation versus compiled normative schemas"
  kind: review
  project: fabric
  domains: [correctness, mcp, audit]
  as_of: 2026-10-04
  status: active
  valid_until: 2026-10-11
  summary: >-
    Fabric's actual SDK agent.call argument validator matches the compiled current
    contract for all 28 independently constructed calls. All four normative name
    surfaces agree on the 21 name fixtures. Local consent policy intentionally
    refuses prototype names that remain schema-valid. Fabric has no durable
    compiled normative compatibility regression at this exact source; CO-193 stays bounded.
  sources:
    - name: "Exact reviewed Fabric source"
      url: "https://github.com/passioncode-ai/fabric/tree/7011ce429d2593951b9d99940f78ab5850f17309"
      read_at: 2026-10-04
    - name: "Pinned normative contract"
      url: "https://github.com/passioncode-ai/fabric-agent-contract/tree/df55c8c54a23251342a7ee57ba95642b7eb39e61"
      read_at: 2026-10-04
    - name: "Independent executable consumer/schema comparison"
      path: raw/results-with-replies.json
      read_at: 2026-10-04
  produced_by: {agent: codex, task: contract-consumer-review}
  supersedes: []
  consumers: [fabric]
---

<sub>ssheleg skills — working-in-passioncode · task-pipeline · project-reports · maintaining-fabric-workspace</sub>

# CO-193 independent consumer check

## Bounded verdict

**PASS for the observed `agent.call` argument shape; OPEN for durable compatibility regression.**
The exact [Fabric source under review](https://github.com/passioncode-ai/fabric/tree/7011ce429d2593951b9d99940f78ab5850f17309)
was selected in a clean isolated worktree, before any later root fixes. The comparison used
[contract source `df55c8c`](https://github.com/passioncode-ai/fabric-agent-contract/tree/df55c8c54a23251342a7ee57ba95642b7eb39e61),
its real `createValidator` and `validateDocument`, all loaded schemas and frozen dependencies.
No normative regex or schema was reconstructed by the reviewer. The parent owns contract
source linking, pin adoption, shared registers, fixes and the final report index.

This evidence establishes a bounded consumer observation, not universal compatibility,
all-consumer closure, release acceptance or live product admission. No source fix was authored.

## Executed comparison

The reviewer connected an actual MCP SDK client to the real `hubServerFor` over the SDK's
in-memory transport. A fake call dependency counted whether the real Zod argument validator
allowed dispatch. This is neither a second regex implementation nor a private product call.
The callback receives no live grants or product keys. The report artifacts are replayable:

```sh
FABRIC_CONTRACT_NEW=<exact-contract-checkout> node --experimental-strip-types \
  docs/reports/2026-10-04-contract-consumer-review/raw/replay-with-replies.mjs
```

Run this from the exact Fabric source with frozen dependencies. The contract checkout must
provide its frozen `tsx`/Ajv dependency set and remain at the reviewed object. Its SHA and
Fabric's SHA are emitted into the result. The replay writes no database, opens no network
listener, starts no user service and modifies no configuration.

| Executed surface | Result | Receipt |
|---|---|---|
| Compiled manifest, interop-agent-call, service-well-known and pipeline capability names | All four agree on 21 independently constructed names | [raw/results-with-replies.json](raw/results-with-replies.json), `normative` |
| Real SDK `agent.call` argument dispatch versus compiled interop-agent-call schema | 28/28 outcomes match; 8 dispatched, 20 schema refusals | same receipt, `rows` |
| Total compiled normative cases | 91 cases: 84 name/surface cases plus 7 full call variants | same receipt, `normative` |
| Existing Fabric local access/word tests | 42 tests in 2 files passed, command exit 0 | [raw/focused-access-portable.log](raw/focused-access-portable.log) |
| Session server inspection and bounded SDK calls | 22 session tools; valid stage report dispatches; malformed stage and `agent.call` do not dispatch | `sessionTools`, `sessionCases` |

Positive names cover `receive_project_message`, `demo.run`, two characters, the 128-character
boundary and 127 trailing underscores after the first letter. Negatives cover leading
underscore, one character, 129 characters, uppercase, space, slash, colon, numeric type,
internal newline and terminal LF/CR/CRLF/Unicode line separators. Full argument negatives cover
an unknown field, null/array input, malformed agent id, empty and 257-character idempotency
keys; a 256-character key passes. Schema refusals are the actual SDK `isError: true` replies
and handlers remain uncalled, not just a thrown-error assumption.

## Historical negative control — comparison detects divergence

The same exact Fabric SDK was also compared with the independently compiled immutable legacy
contract, deliberately selected as a negative control. It produced the expected mismatches on
`receive_project_message`, the maximum-length underscore name, and the valid maximum-key call
whose capability is `read_message`. Thus the comparison observes the original underscore
incompatibility when the older normative object is used; it does not prove itself by repeating
Fabric's local pattern. Receipt: [raw/legacy-negative-control.json](raw/legacy-negative-control.json),
with an executed set-equality assertion at [raw/legacy-control-assertion.json](raw/legacy-control-assertion.json).
That historical object is not a fallback or part of the current-source PASS verdict.

## Cross-consumer differences that must stay explicit

The compiled shared `capabilityName` permits `constructor` and `demo.constructor`, and all
four normative surfaces validate those names. The actual `agent.call` Zod schema also accepts
them. Fabric's
[consent normalizer](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/shared/access.ts#L217)
rejects them because a dotted segment names a JavaScript object prototype field. Existing
[prototype-policy tests](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/shared/access.test.ts#L293)
assert this narrowing. It is not a contract shape mismatch or a reason to remove the safety
restriction. A parity regression must record the distinction between shape validity and
local grant/forward policy, rather than demand identical admission behavior.

The
[session server](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/main/agentSurface.ts#L867)
has separate `fabric_*` tool schemas and no `agent.call`. A valid `fabric_stage_report`
reached the fake journal once; `stage: 42` returned SDK error -32602 without a write;
calling `agent.call` returned SDK error -32602, tool not found. There is no session
capability-name validator to label as normative interop-agent-call coverage at this source.
General session argument validation and cross-contract capability naming are different claims.

## Durable regression gap and narrow proposal

The real
[`agent.call` shape](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/main/hubTools.ts#L86)
uses the local `CAPABILITY_PATTERN` through Zod; the
[local access tests](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/shared/access.test.ts#L26)
exercise genuine normalization and policy behavior, while hub tests call real SDK tools.
Those are meaningful local tests. At this exact source they do not load or compile the pinned
Fabric Agent Contract schemas, so they cannot catch normative drift on their own. The comment
at [access.ts:12](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/shared/access.ts#L12)
still describes the underscore character as a contract deviation; the updated normative
source no longer makes that statement true.

Propose one narrow source regression, owned by the root: retain a source-addressed contract
reference and have the consumer test load its actual compiled validator and schemas. Drive
the real SDK `agent.call` with the shared positive/negative name and full-argument cases;
validate the same names through all four compiled normative surfaces. Do not copy the
pattern into the expected-result logic. A wrong contract SHA, missing dependency set or
unavailable compile must be an explicit failed prerequisite or NOT_RUN, never fallback to
another revision or local regex. Keep the two prototype fixtures as documented semantic
narrowing cases. Assert that invalid calls never invoke the callback, and that a positive
underscore fixture reaches it. The parent decides the pinned-source dependency mechanism;
this report introduces no competing pin owner or normative schema copy.

**CO-193 closure boundary:** owner schema change landed; this one exact Fabric source has
observed shape parity. Durable source regression/pin ownership and other consumers remain
open until their own checks run. This report edits no canonical status row.

## Handoff and checks not run

Completed: isolated exact-source review, real compiled four-surface comparison, SDK dispatch
and refusal fixtures, session separation checks and 42 existing focused local tests. The
initial independent results are also retained at [raw/results.json](raw/results.json);
[raw/replay.mjs](raw/replay.mjs) and the reply-capturing replay are reviewer-owned artifacts.
The original machine-path-bearing focused log remains local and gitignored; the tracked
portable receipt replaces only that absolute worktree path.

No full Fabric suite, database suite, native window, real agent client, hosted run, merge,
release, installation, workspace publication or report index was performed. The workspace
status command reported the review worktree's submodule uninitialized; the existing canonical
maintenance skill was read from its owner. The design map and registers were intentionally
untouched under the parent's source-only scope. This report must not be presented as a
completed map/publication iteration. The parent owns their convergence under normal policy.

**Exact next task:** root chooses and implements the single source-owned compiled compatibility
regression above, reconciles the outdated deviation comment and CO-193 status under the existing
lease, and obtains a fresh exact-candidate consumer recheck. Preserve this report's source SHA
and avoid claiming any other consumer is closed.

## Actual skills used

`working-in-passioncode` grounded repository and source-only review boundaries. `task-pipeline`
provided scope/evidence/dependencies/resume discipline from the parent packet. `project-reports`
created and checked this source-owned report. `maintaining-fabric-workspace` supplied the
read-only status and publication boundary; it did not publish anything. No implementation,
UI, design or compiled-schema source change was made.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- `working-in-passioncode` — repository and source-only review boundaries — not a skill this family ships
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded consumer compatibility review
- `project-reports` — source-owned report and metadata — not a skill this family ships
- `maintaining-fabric-workspace` — publication boundary and status inspection — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>

---
report:
  id: fabric/2026-10-04-hub-i3-docs
  title: "Fabric hub: independent iteration 3 documentation review"
  kind: review
  project: fabric
  domains: [mcp, security, reliability, architecture]
  as_of: 2026-10-04
  status: active
  valid_until: 2026-10-05
  summary: >-
    BLOCK at source 3b2878fc9283db5fc9a81697ba8538a01630b8d9.
    Permanent uncertain-call retention promised by ADR-0115 is absent;
    a local injected-dependency probe observes a resend after expiry and eviction.
    Discovery restart guidance names an absent field; late-withdrawal and schema-path
    documentation require corrections. This report does not clear a release.
  sources:
    - name: "Exact independently reviewed Fabric source"
      url: "https://github.com/passioncode-ai/fabric/tree/3b2878fc9283db5fc9a81697ba8538a01630b8d9"
      read_at: 2026-10-04
    - name: "Injected-dependency reproduction and local check receipts"
      path: "raw/"
      read_at: 2026-10-04
  produced_by:
    agent: Codex
    task: "Fresh independent I3 documentation review"
  supersedes: []
  consumers: [fabric]
---

<sub>ssheleg skills — task-pipeline · evidence-docs · working-in-passioncode · project-reports</sub>

# Independent I3 documentation review

**BLOCK** against `3b2878fc9283db5fc9a81697ba8538a01630b8d9`, on branch `codex/hub-i3-docs-20261004`. Five findings below remain open in this snapshot. This is a bounded review of documentation against code, not a whole-project release verdict. A later fix must carry a new source SHA and its own recheck receipt.

## Scope and independence

Read the original ADR-0115 contract (§1–6, consequences and slices) before its amendments, then production discovery, MCP tools, access, product forwarding, callback, vault and release helpers. Findings were formed before reading the author’s iteration-2/final reports. Only afterwards were the verification ledger and recovery disposition packet compared. Report search surfaced metadata summaries, not prior reviewers’ finding bodies, before source review. The reviewer authored no hub implementation.

Reviewed claims: ADR-0115, ADR-0034 successor, agent-composition §5, CHANGELOG 0.3.1, `docs/launch/release-mac.md` (this repository has no `docs/RUNBOOK.md`), verification protocol/ledger, schema count/path, commands and release authority. Source line addresses below refer exclusively to the exact reviewed SHA. Raw scripts contain neutral `example-agent` fixtures and no real keys. Only the report directory is changed; shared registries, design map and runtime remain untouched under the delegated report-only scope.

## Findings

### I3-DO-01 — BLOCK / high: promised permanent uncertain-call retention is absent

[ADR-0115:326–331](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#L326) says an uncertain key cannot send again after cache expiry, bounded tombstoned memory may refuse new keys, and revocation clears answers rather than prior effect facts. Actual `apps/desktop/src/main/hubCall.ts:338–343` sweeps every settled key after 24 hours; `:381–383` also removes an expired key on its direct retry; `:403–405` evicts settled keys at capacity. `:415–419` deletes all binding memory.

The local probe [raw/reproduce-doc-promises.mjs](raw/reproduce-doc-promises.mjs), using fake grants/store/vault/forward and injected clock, records [raw/reproduce-doc-promises.jsonl](raw/reproduce-doc-promises.jsonl): expiry forwards **2**, against the promised **1**; capacity permits retry forward delta **1**, against **0**. Both first calls return `outcome-unknown`, with `reached: true`. No HTTP, real mailbox, vault subprocess, database or credential participates. Direct `forgetBinding` then reuse also forwards twice, but that probe does **not** demonstrate an HTTP revoked credential bypass; live authentication remains a separate boundary.

This is a runtime integrity defect as well as false documentation. Keep the permanent uncertainty refusal within the same running process, retain bounded effect facts when answer bodies are discarded, and refuse admission rather than evicting an uncertain key. Restart remains a reconciliation boundary, not durable exactly-once assurance. Append an ADR correction only after actual implementation and regressions exist. Owner: hub core; root was notified immediately.

### I3-DO-02 — medium: restart guidance requires a nonexistent discovery field

`apps/desktop/src/main/hubTools.ts:84` tells clients that `hub.json.instance` changes on restart; `hubCall.ts:36–37` repeats it. `HubDocument` in `apps/desktop/src/main/hub.ts:38–45` and its actual serialized object at `:100–107` contain only protocol, origin, mcp, doorTokenFile, pid and startedAt. Thus the published restart discriminator does not exist.

Use the actual observable `startedAt` and `pid`, explicitly as a restart observation rather than authority or process identity. Preserve ADR-0115 amendment 26’s warning that PID liveness cannot prove identity, and mandatory side-effect reconciliation after process replacement. A no-network payload/schema inspection establishes the mismatch; no discovery client identity acceptance was run. Owner: root/core; root selected the existing observation fields, pending exact-source recheck.

### I3-DO-03 — medium: late-record withdrawal is documented as unconditional

[ADR-0115:268–275](https://github.com/passioncode-ai/fabric/blob/3b2878fc9283db5fc9a81697ba8538a01630b8d9/docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#L268) promises nothing recorded outside the deadline and a late record withdrawn at once. `apps/desktop/src/main/productConnect.ts:446–458` explicitly handles a withdrawal append failure: `withdrawn=false`, a live unusable recorded connection remains, and the outcome is `withdraw-failed`. The same code stores an inert unique vault slot even when the callback loses its deadline (`:394–399`); “keeps nothing” means no admitted usable authority, not removal of every byte.

`docs/ux/scenarios.md:3250` already documents the failed withdrawal and operator disconnect/reconnect remedy accurately. Append an ADR clarification covering retained late metadata and the failed compensation outcome; avoid claiming atomic rollback or guaranteed withdrawal. Retain the distinction between an inert secret slot and admitted product connection. Owner: root ADR documentation. This finding is code inspection; a new independent deadline/withdrawal execution was NOT_RUN here.

### I3-DO-04 — low: upgrade runbook cites a nonexistent repository path

`docs/launch/release-mac.md:131` names `src/shared/schemaContract.json`. There is no such root file. The guard’s actual contract is `apps/desktop/src/shared/schemaContract.json`, with minimum=maximum=78, imported by desktop schema-readiness code. Correct the path and make it a resolving relative link from the runbook. The migration inventory contains **78** SQL files; newest suffix **80** is not the version. The schema counting rule and 75→78/77→78 distinction are otherwise correct. Owner: root runbook documentation.

### I3-DO-05 — BLOCK / high: schema-78 recovery cannot pass native archive admission

This additional recovery incompatibility was surfaced by root, then independently checked in exact-source code; it was not borrowed from an author review. `supabase/migrations/20261004000080_hub_authority_boundaries.sql:494` exports `source_schema_version=schema_version()`, which is 78 for this candidate, and its SQL admission allowlist at `:403` admits 78. Native `apps/desktop/src/main/ceoPrivateArchive.ts:24,32` stops at 77; `:116` therefore refuses every schema-78 private archive as `unsupported_schema` before digest admission. This contradicts the candidate's recovery-acceptance scope, not the rule that restored history must lose authority.

Root owns the codec fix and an actual owned SQL-export → native-admission → restore round trip at schema 78, while preserving schema 77 and refusing future 79. This reviewer verified the producing/consuming allowlists and branch order by code inspection; a real SQL export/native round trip is NOT_RUN here. Root's reported stale “future78” full-tier test does not by itself prove this distinct codec defect fixed. Add the qualified acceptance receipt to the final source ledger; do not weaken the future-version refusal.

## Claims checked without a new defect

- Historical gateway claims are clearly annotated: ADR-0034:5 names ADR-0105 and ADR-0115; ADR-0105:81–85 actually supersedes the machine gateway. `agent-composition.md:139,162–167` marks the old measured configuration historical. `apps/desktop/src/shared/servers.ts` retains `gateway` and refuses session `fabric` without a product grant model; docs do not claim those paths were removed.
- Discovery default 47070, permitted configured range, mode-0600 atomic files, verbatim 127.0.0.1 origin and lifecycle fallback match `hub.ts:35–55,66–109,145–180`; actual registry root comes from `agentRegistry.ts:116–124` and `index.ts:594`. File/PID observation is not identity proof.
- Door and binding tool sets match `hubTools.ts:59–62`; poll-secret/schema and 10-minute claim wording match `:74–78,128–140`. Exact mailbox grants, separate workspace capabilities and two-stage narrowing are the implemented contract, not wildcard patterns.
- Interop envelope versus Fabric refusal is correctly amended at ADR-0115:321–325 and implemented at `hubCall.ts:174–202`. The latest availability amendments supersede older blanket retry guidance. The error-code list in amendment 19 is historical and incomplete for later `outcome-unknown`, `product-outdated` and `answer-not-kept`; the first two are described in later amendments, while clients should use the actual current typed answers. This is included in I3-DO-01’s correction rather than a duplicate blocker.
- Secret-first unique per-estate/per-connection slots and explicit reconnect predecessor match `productConnect.ts:64–78,227–265,393–431`. Disconnect never calls the product and does not revoke its key (`:467–477`). Observatory commands use stdin for put/rotate, vault-only read, bounded read queue and single-flight location/interpreter resolution (`observatoryVault.ts:110–210,266`). No secret-provider call was made.
- CHANGELOG:9–36 says 0.3.1 unreleased and separates runtime server version compatibility from deployed-source/live acceptance. `productForwarder.ts:149–157` checks advertised server identity/version for narrowed calls; this is not remote source attestation. The app remains 0.3.0 in `apps/desktop/package.json`; root package 0.1.0 is the private workspace manifest, not the app version.
- Release notes finalization and verified-ancestor restrictions resolve in `scripts/lib/release-mac.mjs:69–82,97–121`; release code checks them. Runbook tag/check-only/rehearsal arguments resolve in `parseReleaseArgs`, `tagProblem`, `.github/workflows/release.yml:16–24,48–51,88,110–116`. Workflow source uses protected-environment signing and shared publish; actual environment protection settings, human approvals and completed hosted receipt were NOT_RUN. Historical 0.3.0 gate lacking a verifiedCommit is explicitly not rerelease permission.
- Upgrade runbook says it is a procedure rather than an executed private upgrade receipt, refuses filename suffix as readiness, stops writers, backs up, rehearses a separate stack, checks schema/journal and restores an old compatible signed build on failure. The bundled target is `app.getPath('userData')/stack` (`apps/desktop/src/main/env.ts:41`), consistent with the documented packaged Fabric path. None of the dump/migrate/restore commands was executed.
- Verification ledger:12–32 requires fresh independent reviewers before prior findings and marks I3 not started at :199–201. It does not clear the candidate; inherited I1/I2 receipts are not fresh green results. Cross-source deployment/publication/contract correction remains separately tracked.

## Checks actually run

[raw/checks.json](raw/checks.json) records commands and exit codes; individual logs are beside it. Source checked: exact SHA above. Node dependencies were reused through a temporary ignored link to the existing desktop dependency tree; this is not a fresh install or dependency provenance acceptance.

| Check | Result and scope |
|---|---|
| `node raw/reproduce-doc-promises.mjs` from this report directory | Exit 0; observations contradict ADR-0115, **not a green acceptance assertion** |
| `node scripts/check-regions.mjs` | Exit 0; region references/closure only |
| `node --test scripts/test/release-gate.test.mjs scripts/test/release-mac.test.mjs` | Exit 0; 21 pass, 0 fail, 0 skipped; local release-helper tests only |
| `node --test apps/desktop/test/hub-call.test.mjs` | Exit 0; 15 pass, 0 fail, 0 skipped; supplied regressions do not exercise expiry/capacity uncertainty retention |
| `bash scripts/check-docs.sh` | Exit 0; 537 Markdown files inspected, 3 private-submodule relative links NOT CHECKED; 0 brand errors / 1472 advisory warnings. Structural success did not catch the five semantic defects above |

NOT_RUN: full root tier, hosted CI, live hub/MCP/product call, installed Electron/native app, private data/stack upgrade, private dump restore, deployment source attestation, signed build/release, website or workspace publication, live credential reads, live auth/settings readback. No all-green claim is made. Parent reported a failed exact-source full-tier archive-schema fixture; this reviewer did not rerun or independently validate that receipt.

## Handoff and next task

Objective: independently assess hub documentation on the exact candidate and deliver evidence. Completed: original-contract-first source review, five concrete findings, injected no-network uncertainty reproduction, local focused/structural checks and this report. Open: all five findings in this snapshot and final candidate acceptance. Decision: preserve historical records, append corrections, never infer deployment provenance from version/UUID or process authority from discovery. Prerequisite: root/core fixes committed on a new exact SHA. Next task: recheck I3-DO-01 against expiry, capacity, revocation and restart boundaries; recheck wire guidance, ADR late-withdrawal wording, linked schema path and schema-78 codec qualification; root then updates the canonical verification ledger under lease and runs converged gates. The shared context is [ADR-0115](../../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md), [verification packet](../../evidence/plans/2026-10-04-hub-verification.md) and [root handoff](../../handoffs/2026-10-04-claude-recovery.md). A pushed report branch is not a merge, installed update or release.

The engine-specific `tools/check_public_release.py` does not exist in Fabric (command resolution only returned exit 2); no privacy PASS is inferred from that absent command. Report-owned artifacts were inspected for real keys, personal-agent names and absolute home paths. Raw local test logs replace machine paths with `<local-path>`; advisory brand lines are omitted from the docs summary, with the computed warning total retained.

Actual skills used: task-pipeline bounded scope/dependencies/evidence/resume; evidence-docs resolved semantic claims against exact source; working-in-passioncode applied public privacy and release authority; project-reports created the dated metadata/raw-evidence home. No visual layer or user-facing copy was changed. Root owns shared map/ledger and final global report index convergence.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded independent review and report handoff
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — resolved documentation claims against source
- `working-in-passioncode` — public privacy and release boundaries — not a skill this family ships
- `project-reports` — dated report metadata and raw evidence — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>

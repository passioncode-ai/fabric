---
report:
  id: fabric/2026-10-04-ad02-write-authority-review
  title: "Independent AD02 write-authority and map gate review"
  kind: review
  project: fabric
  domains: [correctness, reliability, audit]
  as_of: 2026-10-04
  status: active
  valid_until: 2026-11-04
  summary: >-
    ACCEPT for bounded source guards at exact 2e06e501, not AD02 or product acceptance.
    Independent caller probes pass and three fail against the committed before App.
    The large committed map regression is reproduced; anchor and oversized-read refusals hold.
    Native launch/current combined build acceptance, VoiceOver and release remain unclaimed.
  sources:
    - name: "Exact reviewed source"
      url: "https://github.com/passioncode-ai/fabric/tree/2e06e5013595ec96b52b85cae2c486050632565b"
      read_at: 2026-10-04
    - name: "Committed before control"
      url: "https://github.com/passioncode-ai/fabric/tree/5f4eb908a07a723e5959ff5f5311119549e4bd0a"
      read_at: 2026-10-04
    - name: "Source-owned native handoff and original failed cut"
      url: "https://github.com/passioncode-ai/fabric/blob/2e06e5013595ec96b52b85cae2c486050632565b/docs/handoffs/ad02-native-20261004/README.md"
      read_at: 2026-10-04
  produced_by:
    agent: "contract_adoption_review"
    task: "Independent exact source guard, bootstrap and map review"
  supersedes: []
  consumers: []
---

<sub>ssheleg skills — working-in-passioncode · task-pipeline · project-reports</sub>

# Independent AD02 write-authority and map gate review

## Verdict and exact boundary

**ACCEPT** for the bounded App read/write-authority guards, default-agent hint association, native test-host bootstrap source and map baseline refusal at `2e06e5013595ec96b52b85cae2c486050632565b`. No remaining must-fix was found in this scope. This verdict does **not** close AD02, CO179, current parent/runtime acceptance, VoiceOver, WCAG, release or installed state. The broad visual assets and fixture changes in this commit are outside this review; they are not acceptance-graded here.

The initial dirty root source was inspected read-only, and acceptance waited for the exact committed source. The [root's original failed native cut](https://github.com/passioncode-ai/fabric/blob/2e06e5013595ec96b52b85cae2c486050632565b/docs/handoffs/ad02-native-20261004/corrupt-before-audit.jsonl) and qualified earlier native runs remain untouched. This independent review supplies source/caller evidence; it does not relabel those runs as a current same-build native pass. Root owns subsequent native qualification, integrations, maps/registers and the final index.

## App authority and independent controls

The [separate `tabsRestored` authority](https://github.com/passioncode-ai/fabric/blob/2e06e5013595ec96b52b85cae2c486050632565b/apps/desktop/src/renderer/src/App.tsx#L130) prevents an in-flight restore latch from permitting writes. The [cached initial read promise](https://github.com/passioncode-ai/fabric/blob/2e06e5013595ec96b52b85cae2c486050632565b/apps/desktop/src/renderer/src/App.tsx#L206) gives hydration and tab restoration the same snapshot, including rejection or unreadable status. [Unreadable restoration](https://github.com/passioncode-ai/fabric/blob/2e06e5013595ec96b52b85cae2c486050632565b/apps/desktop/src/renderer/src/App.tsx#L301) returns before missing-subject inference and tab-write permission. Fresh typed draft identities merge over the hydration snapshot.

[Four independent caller assertions](raw/independent.test.tsx) use the source's existing public fixture setup and drive the real `App`:

| Case | Exact candidate | Before control: only App replaced with `5f4eb908` |
|---|---|---|
| Delayed `tabs.read`, readable drafts and early input | No tabs write until restore; old and new tabs plus typed fields survive | **Fails**: write occurs while read pending |
| Initial draft-read rejection | One read, no tabs or drafts write | **Fails**: duplicate initial read |
| StrictMode effect reattachment | One shared initial snapshot, saved tab retained | **Fails**: duplicate initial read |
| Unmount while tab restore pending | Resolving later produces no late tabs write | Passes |

The [candidate log](raw/source-tests.log) records **25/25**, no skips: 21 existing focused tests plus these four. The [before control](raw/before-control-tests.log) records **3 failed / 1 passed**, with pnpm reporting exit `1`. Only the review worktree's App file was temporarily replaced; the candidate bytes were restored and the temporary test file removed afterward. This proves meaningful detection of the repaired behaviors without modifying root source or committing a product test/fix.

The main process's tab/draft IPC handlers perform their local updates synchronously; [localState](https://github.com/passioncode-ai/fabric/blob/2e06e5013595ec96b52b85cae2c486050632565b/apps/desktop/src/main/localState.ts#L136) retains quarantine evidence so a failed first read does not become a pristine empty second read or restart. A cached unreadable/rejected snapshot does not retry in the same Shell. Repairing storage requires a fresh process according to the [source-owned boundary](https://github.com/passioncode-ai/fabric/blob/2e06e5013595ec96b52b85cae2c486050632565b/docs/handoffs/ad02-native-20261004/README.md#write-authority). Multi-process serialization and project-list refresh epochs are not established by these tests.

## Committed map baseline regression

The independent [neutral map helper](raw/map-probe.py) and [receipt](raw/map-probe.json) use disposable Git repositories and the real gate, with public synthetic HTML and a new iteration so iteration reuse cannot mask the anchor check:

| Control | Result |
|---|---|
| Old gate, 1,100,181-byte committed map; remove `protected` anchor and refresh | **Bug reproduced**: exit `0`, false `Initial map` claim, current map changed |
| Exact candidate, same map/mutation | Exit `1`, empty stdout, protected-anchor refusal, current bytes unchanged |
| Exact candidate, 17,000,181-byte committed map exceeding the new 16 MiB buffer | Exit `1`, `ENOBUFS`, empty stdout, no false initial-map claim and no map mutation |

The [gate source](https://github.com/passioncode-ai/fabric/blob/2e06e5013595ec96b52b85cae2c486050632565b/scripts/check-design-map.mjs#L54) distinguishes missing Git-tree path from failure to read an existing baseline. The buffer increase therefore does not turn a larger read failure into permission to discard history. The [existing real-gate fixture](raw/map-existing-tests.log) additionally passes **23/23**, including committed-iteration refusal. Map prose, completeness and external URLs are outside this gate's own stated proof scope.

## Test host, hint and verification limits

The [test-host startup](https://github.com/passioncode-ai/fabric/blob/2e06e5013595ec96b52b85cae2c486050632565b/apps/desktop/test/adoption-native-harness.mjs#L97) now awaits readiness inside a launched async function, allowing module evaluation to finish first. It retains prepared-fixture/source/build pins and explicit isolated storage. `node --check` passed. Independent [prepare-only probes](raw/native-prepare-probe.py) [passed](raw/native-prepare-probe.json) for restored/corrupt/empty modes, each with isolated userData and permissions `0700`, eight source-module pins and 190 local build pins; unknown mode is refused. These probes launch **no Electron app** and are not native bootstrap/admission evidence.

The [default-agent selector](https://github.com/passioncode-ai/fabric/blob/2e06e5013595ec96b52b85cae2c486050632565b/apps/desktop/src/renderer/src/Onboarding.tsx#L242) consumes the existing Field description ID via `aria-describedby`. The focused suite covers the exact DOM association. No VoiceOver or whole-product accessibility verdict follows from markup.

Frozen offline dependency install used pnpm `11.21.0` and Node `v26.8.2`, with lifecycle scripts disabled; it installs no product/release. [Type checking](raw/typecheck.log) passed and the [local source build](raw/build.log) completed. [Exact source hashes and checks](raw/checks.json) separate these from native launch, which was **NOT_RUN**. Existing jsdom canvas-gap notices are retained in the focused log; the test summary passes. Full application/hosted checks, production services, provider operations, current combined native matrix and release/signing are **NOT_RUN**.

## Replay and handoff

In a disposable checkout of this exact source with frozen dependencies, copy `raw/independent.test.tsx` to `apps/desktop/src/renderer/src/ad02-independent-review.test.tsx`, run the focused command below, and remove that temporary file. The raw test uses imports relative to that caller-test location. Do not overwrite an existing file or replay the before control in somebody else's working tree.

```sh
pnpm --filter @fabric/desktop exec vitest run src/renderer/src/ad02-independent-review.test.tsx src/renderer/src/onboardingDraft.persist.test.tsx src/renderer/src/Onboarding.test.tsx
python3 docs/reports/2026-10-04-ad02-write-authority-review/raw/map-probe.py
node scripts/test/check-design-map.test.mjs
python3 docs/reports/2026-10-04-ad02-write-authority-review/raw/native-prepare-probe.py
```

The prepare probe requires an already built desktop and deletes its disposable fixtures. Dependencies/build outputs stay ignored and local. Tracked logs normalize only review-machine/temporary paths; original local logs are ignored. No shared source, map, registry, native host or wiki index was edited by the review branch.

Completed: exact source inspection, four independent caller probes and before control, independent map RED/fixed/oversized controls, existing focused/map tests, typecheck, local build, host syntax and prepare-only isolation checks. **Exact next task:** root freezes any further test-host changes and executes/reviews the actual combined native matrix against that source/build, preserving the old failed/qualified cuts. Keep AD02/CO179 and parent/runtime closure open until their own acceptance evidence exists. This report's source verdict is not inherited by later App/map/host changes.

## Route actually used

Toolkit measured. `working-in-passioncode` supplied source/native authority boundaries, `task-pipeline` supplied exact-source review and meaningful regression controls, and `project-reports` supplied this durable cut and metadata checks. Repository/knowledge rules already read were followed; no product scenarios or styling were authored here.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- `working-in-passioncode` — source and native authority boundaries — not a skill this family ships
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — exact source review and regression controls
- `project-reports` — durable bounded review cut — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>

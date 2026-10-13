# CO-282 — catalogue host capability and evidence matrix

**Source inventory and bounded local receipts, not universal compliance.** N-004
under the [execution plan](../../evidence/plans/2026-10-13-harness-waves.md).
No native provider tests were repeated for this matrix. Historical probes name
their tested version and date; they do not establish the installed host's current
behavior, complete instruction compliance or successful recovery after compaction.

## Evidence vocabulary and source pins

- **Declared:** the catalogue advertises a transport or mode.
- **Configured:** compiler/source tests show the intended bytes or arguments.
- **Observed local:** a focused test executed against the stated source, with its
  fake/injected boundaries disclosed.
- **Historical native:** a dated host probe observed the stated narrow behavior.
- **Unverified / unsupported:** no qualifying receipt, or the implementation
  explicitly provides no capability. Neither is PASS.

Unless separately stated, source references below bind to Fabric
`5ecf79eab274587cbf4e1c899406cef37aa3a5bd`:

| Source | What it establishes |
|---|---|
| [Catalogue and readiness](https://github.com/passioncode-ai/fabric/blob/5ecf79eab274587cbf4e1c899406cef37aa3a5bd/apps/desktop/src/shared/agents.ts#L140) | Seven catalogue entries; declared modes, transport and result channel; `executorReadiness` checks declarations, not a live host |
| [Bundle compiler](https://github.com/passioncode-ai/fabric/blob/5ecf79eab274587cbf4e1c899406cef37aa3a5bd/apps/desktop/src/main/sessionBundle.ts#L224) | Per-adapter instructions, configuration, credentials and cleanup |
| [Skill presence reader](https://github.com/passioncode-ai/fabric/blob/5ecf79eab274587cbf4e1c899406cef37aa3a5bd/apps/desktop/src/main/adapterSkills.ts#L125) | Global/plugin/folder discovery; a shared-folder hit alone is not marked ready |
| [Native identity entry](https://github.com/passioncode-ai/fabric/blob/5ecf79eab274587cbf4e1c899406cef37aa3a5bd/apps/desktop/src/main/fabricMcpMain.ts#L25) | Explicit runtime ID override; automatic environment ID only for Claude Code |
| [ACP first prompt](https://github.com/passioncode-ai/fabric/blob/5ecf79eab274587cbf4e1c899406cef37aa3a5bd/apps/desktop/src/main/acpShell.ts#L431) | `session/new`, authentication handling and brief sent as first prompt |
| [N-001 identity repair](https://github.com/passioncode-ai/fabric/blob/9d53b8f1f139f45d6f98c17dfe717d4a398017b7/apps/desktop/src/main/sessionEnroll.ts#L119) | Runtime-scoped pending bearer and per-binding admission serialization |

N-001's exact candidate `9d53b8f1f139f45d6f98c17dfe717d4a398017b7` was independently
checked with `node --experimental-strip-types --test
apps/desktop/test/session-enroll.test.mjs`: 25 passed, 0 failed, exit 0. Dependencies
were reused locally; the store/authority boundaries are injected. This proves
enrollment logic, not that each host supplies its runtime ID or executes hooks.

## Transport, instructions and MCP

| Host | Declared/configured path | Instruction and skill boundary | MCP evidence and remaining acceptance |
|---|---|---|---|
| Claude Code | `mcp-config-flag`; plan/ask/bypass | Appended system preamble; Windows uses a brief file. Presence reader checks enabled adapter plugin or own skill folder. Presence is not model consumption. | Compiler adds `--strict-mcp-config`. Current native instruction/strictness sentinel is NOT_RUN in this task. Verify intended server connects and an unrelated global/project sentinel does not. |
| Codex | `codex-config-home`; catalogue exposes no mode selector | Compiler creates isolated `CODEX_HOME` with generated `AGENTS.md` and projects no skills into it. Presence reader checks the operator's `.codex/skills`; its ready state is not effective discovery evidence for the generated home. Native discovery of shared `.agents/skills` remains unverified, so this is not a claim that all skills are absent. Do not copy the whole global home to make that check pass. | Historical 0.162.1 probe verified bearer transport and preamble delivery. Project configuration could add extra servers; random server name protects predictable-name shadowing, not strict exclusion. Verify current effective skill paths and unrelated-server sentinel in the actual session home. |
| Kilo | `config-content-env`; ask/bypass in `KILO_CONFIG_CONTENT` | Compiler supplies a brief file through config; presence reader checks `.kilocode/skills`. Effective skill loading and post-compaction retention are unverified here. | Historical 7.4.17 evidence covers bearer and content-config precedence. It does not establish exclusion of every unrelated server. Verify content/project/global merge and intended brief with harmless sentinels. |
| Hermes | ACP; ask/bypass; stdio MCP bridge | ACP sends the brief as first prompt; presence reader checks `.hermes/skills`. First-prompt delivery is not a permanent instruction guarantee. | Historical 0.21.4 probe exercised bridge requests. Compiler declares `HERMES_ACP_SKIP_CONFIGURED_MCP=1`; current native isolation is NOT_RUN. Verify global server exclusion, explicit identity delivery and resume behavior. |
| Kimi Code | ACP HTTP; catalogue plan/ask/bypass | ACP first prompt. No dedicated Kimi folder in this pinned presence reader; shared-folder result is not ready. | Historical 2.1.1 probe verified HTTP bearer and tool call. N-002 is repaired and independently reviewed at `ce9090ef`: native mode is negotiated before prompt; a known contradictory update refuses. The no-model Kimi 2.1.1 protocol probe covers negotiation only. Verify actual plan semantics, configured-server isolation and effective skill loader after the patch. |
| Cline | Plain runner, adapter `none`; ask/bypass flags | No Fabric bundle brief or ready executor result channel at this baseline. External enrollment is a separate path, not proof of launch integration. No dedicated folder in the pinned presence reader. | Historical 3.0.46 ACP initialized but `session/new` did not pass sign-in. Surface execution stays unsupported until admitted native evidence exists. Sign-in remains a human gate. |
| Shell | Login terminal; adapter `none` | No agent, instruction loader or autonomous executor claim | MCP/agent recovery requirements are not applicable. Keep it outside autonomous-executor acceptance. |

Historical evidence, preserved as dated observations:

- [Codex 0.162.1 and Kimi Code 2.1.1, 2026-10-11](https://github.com/passioncode-ai/fabric/blob/5ecf79eab274587cbf4e1c899406cef37aa3a5bd/docs/reports/2026-10-11-codex-kimi-surface-probes/README.md).
  Codex's successful noninteractive tool-call probe used bypass; that does not
  establish default noninteractive approval behavior. The report records this limit.
- [Kilo 7.4.17 config precedence](https://github.com/passioncode-ai/fabric/blob/5ecf79eab274587cbf4e1c899406cef37aa3a5bd/docs/reports/2026-10-05-openrouter-agent-support/raw/probes/kilo-7.4.17-config-precedence.txt)
  and [bundle probe](https://github.com/passioncode-ai/fabric/blob/5ecf79eab274587cbf4e1c899406cef37aa3a5bd/docs/reports/2026-10-05-openrouter-agent-support/raw/probes/kilo-7.4.17-bundle-end-to-end.txt).
- [Hermes 0.21.4 ACP shell probe](https://github.com/passioncode-ai/fabric/blob/5ecf79eab274587cbf4e1c899406cef37aa3a5bd/docs/reports/2026-10-05-openrouter-agent-support/raw/probes/hermes-0.21.4-acp-shell-end-to-end.txt).

## Identity, hooks and recovery

| Host | Runtime identity supplied to `fabric-mcp` | Hooks, resume and compaction acceptance still owed |
|---|---|---|
| Claude Code | Automatic `CLAUDE_CODE_SESSION_ID`, or explicit `--runtime-session-id` | Confirm native hook rejoin preserves session/claim, and a fresh/compacted executor receives current policy and checkpoint. Enrollment unit tests do not prove hook wiring. |
| Codex | Explicit `--runtime-session-id`; no automatic extraction in this pinned entry | Establish a supported native ID source, then two simultaneous sessions and rejoin. Verify effective generated-home instructions after resume/compaction. |
| Kilo | Explicit ID; no automatic extraction here | Verify stable ID across rejoin and claimed recovery behavior; no equivalent hook guarantee inferred from installed skills. |
| Hermes | Explicit ID; ACP-created session ID is not automatically forwarded by this entry | Verify how a native/ACP session maps to enrollment identity; interrupted first prompt, checkpoint resume and compaction require receipts. |
| Kimi Code | Explicit ID; no automatic extraction here | Verify ID plumbing and resumed ACP context independently of the N-002 mode fix. |
| Cline | Explicit ID only if separately enrolled | Keep external enrollment distinct from unimplemented Fabric launch integration; establish sign-in and result transport before recovery acceptance. |
| Shell | Not applicable | Not an autonomous agent. |

Unknown identity remains a documented fallback, not a claim of per-native-session
isolation between two unknown callers. N-001 separates known A, known B and null;
two null callers can still share the legacy pending enrollment. The caller must
supply a trustworthy stable ID before claiming native identity continuity.

## Follow-up receipt format and convergence

For each unresolved cell, capture host/version, launch path, instruction/MCP
configuration digests, runtime identity source, mode, scope, command, result and
limitations. Use synthetic sentinel text and test servers; never real credentials
or private global-home content as evidence. Tests that need sign-in or additional
authority remain explicitly gated.

Required negative cases: unrelated skill/server cannot masquerade as an admitted
one; a missing required brief/surface refuses autonomous work; another runtime's
ID cannot reuse its bearer; a stale checkpoint cannot override current authority;
resume without required context is refused or honestly degraded under its policy.

N-004 can complete as a reviewed evidence matrix. It cannot certify all hosts,
close N-009/N-010, or establish runtime REQ-004/REQ-008 acceptance on their behalf.
Refresh affected rows after N-001/N-002/N-003 integration at the combined candidate
and retain historical receipts under their original SHAs.

Integrated repair source: `a2965695f5bdfcc5452fce0c8ff9bd342fd6ffb9`; [wave review](../../reports/2026-10-13-harness-wave-review/README.md) preserves original rejected and accepted candidates. Context revision4 and missing-surface refusal are included; remaining host acceptance above is unchanged.

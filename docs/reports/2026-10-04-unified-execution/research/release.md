# Lane 2 — release integrity and current priority

## Verdict

Preserve P-08 as Now. At source `41f994a7`, the 0.3.1 ledger has only iteration1 closed. Executing the real `releaseGateProblems` for 0.3.1 refuses iterations2/3; the two active hubfix2 worktrees are dirty and must remain with their existing owners. Review research findings there before fresh iteration3; no release, install or live migration is asserted.

## Design review

The protected CI signing→notarization→attestation flow agrees with [Electron's official procedure](https://www.electronjs.org/docs/latest/tutorial/code-signing) and [GitHub protected review](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments). Every receipt pins exact SHA/version/digest; packaged acceptance, provider acceptance and hosted nightly results remain separate. No full hosted dispatch on push.

P-08 must reconcile the target schema against actual migrations77+; old row76 is not a release input. Backup/rehearsal/live upgrade retain their existing runbook gate and are never inferred from successful disposable stack migration. CO-181 cleanup stays a human data-deletion decision; CO-182 owns two manual probes still using the live stack and requires disposable native/handshake ownership before either joins a CI tier; CO-197 owns freshness publication, not proof of product release.

The hub's local consent separation agrees with [MCP security](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices). Pin transport norm and SDK build, then verify Origin absence, hostile Origin, Host/address families, audience, revoked grant replay and real CLI handshake. [Inspector #574](https://github.com/modelcontextprotocol/inspector/issues/574) reports missing Origin in Node requests: browser rejection must not prohibit an authenticated native client merely by analogy. [MCP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) treats disconnect and cancellation separately; V1-30's stop-forward-on-hangup needs an explicit custom transport contract or a standards-compliant distinction.

[Notarize #219](https://github.com/electron/notarize/issues/219) is a useful failure report, not an instruction to freeze an old macOS runner. Reproduce on the exact October2026 toolchain, preserve failure logs excluding secrets, retry only diagnosed transient steps, and never publish a weaker signature or unstapled artifact to make the pipeline green.

## Missed cross-lane inputs

CO-179 says before the next release after0.3.0: the release owner must explicitly resolve this deadline or record a proper deferral before 0.3.1; an old0.3.0 ruling cannot satisfy it. P-06.1 must reserve the next migration after the current hub head, enforce project/binding authority at append and read boundaries, and prevent restored history from reinstating approved rules. P-07 reuses existing hub binding/grants and validates a fresh complete successful source observation before fixed. AD02's native receipt still gates FR-A/AD04; P-01 source work and P-03 release do not close it.

## First task actually executed

UP-01 adds a source-pinned packet queue and cross-task impact check. P-08.preflight records the real gate refusal; N1.metadata records installed versions only (Claude2.1.289, Codex0.160.0). These close bounded prerequisites, not P-08 or N1. No model turn, account switch, app install, database migration or release approval was performed.

## Sources

See [six source records](../raw/release-sources.json) for exact URLs, excerpts and read dates; local proof in [execution receipt](../checks/execution.json).

## Corrections

2026-10-04: root draft briefly misidentified CO-182 as a create-recovery item; exact canonical row193 was read and both packet and prose corrected before delivery. CO-182 actually concerns live-stack native/handshake probes. No probe was run on the live stack.

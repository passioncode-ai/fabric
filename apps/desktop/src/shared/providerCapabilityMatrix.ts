/**
 * The matrix, as observed on this machine on 2026-09-10.
 *
 * M199.probe. Every row was produced by running the installed CLI or by looking
 * at where it keeps things, never by reading documentation — which is the card's
 * own instruction. The commands are in each `evidenceRef` so a reader can run
 * them again, and the two builds are pinned because a capability of somebody
 * else's program is a property of a version.
 *
 * WHAT WAS NOT RUN, and why, because a matrix that hides its own edges is worse
 * than a shorter one: no login flow was performed. On Claude Code the credential
 * is a single keychain item keyed by the operating-system user, so a second
 * login has one place to write — over the operator's live session. The card
 * already says real accounts belong to a separately granted certification, and
 * this is the reason in concrete terms rather than in principle.
 *
 * THE FINDING THAT SPANS BOTH PROVIDERS: for each of them the saved
 * conversations live inside the same directory as the credential. So isolating
 * an account by redirecting the home also hides every conversation recorded
 * under the other home — and the design promises both isolation AND continuing
 * an existing conversation under another account of the same provider. Those two
 * promises cannot be kept by the same mechanism. CO-140.
 */

import type { ProviderCapabilityReceipt } from './providerCapability.ts'

/** The builds these rows are about. An upgrade invalidates them, by design. */
export const PINNED_BUILDS = {
  'claude-code': '2.1.295',
  'codex-cli': '0.161.0'
} as const

export const HISTORICAL_PINNED_BUILDS = { 'claude-code': '2.1.236', 'codex-cli': '0.152.1' } as const

const RUNTIME = 'darwin-arm64 host'
const AT = '2026-09-10'

export const HISTORICAL_CAPABILITY_MATRIX: readonly ProviderCapabilityReceipt[] = [
  // ── Claude Code 2.1.236 ────────────────────────────────────────────────────
  {
    provider: 'claude-code',
    cliBuild: '2.1.236',
    runtime: RUNTIME,
    capability: 'identity-read',
    status: 'supported',
    evidenceRef:
      '`claude auth status --json` returned loggedIn, authMethod (claude.ai), apiProvider (firstParty), email, orgId, orgName and subscriptionType — machine-readable, and no secret in the output',
    checkedAt: AT
  },
  {
    provider: 'claude-code',
    cliBuild: '2.1.236',
    runtime: RUNTIME,
    capability: 'identity-subject',
    status: 'unsupported',
    evidenceRef:
      'the same output carries an ORGANISATION id and an email and no per-user subject. The design forbids email as identity, so the supported reader cannot tell two accounts in one organisation apart',
    checkedAt: AT
  },
  {
    provider: 'claude-code',
    cliBuild: '2.1.236',
    runtime: RUNTIME,
    capability: 'login-isolation-by-home',
    status: 'unverified',
    evidenceRef:
      'with CLAUDE_CONFIG_DIR and, separately, HOME pointed at an empty directory, `claude auth status --json` answered loggedIn:false — so the READER follows the home. Whether a second login would write a second credential or overwrite the one below requires performing a login, which would log the operator out; that needs the granted certification the card reserves',
    checkedAt: AT
  },
  {
    provider: 'claude-code',
    cliBuild: '2.1.236',
    runtime: RUNTIME,
    capability: 'credential-store-per-home',
    status: 'unsupported',
    evidenceRef:
      '`security find-generic-password -s "Claude Code-credentials"` (metadata only, no -w) returned one item keyed by the operating-system user account, and no credential file exists under the real config home. The secret is one keychain item per OS user, not one per home',
    checkedAt: AT
  },
  {
    provider: 'claude-code',
    cliBuild: '2.1.236',
    runtime: RUNTIME,
    capability: 'conversation-store-per-home',
    status: 'supported',
    evidenceRef:
      'saved conversations are files under the config home: ~/.claude/projects/<encoded-cwd>/<uuid>.jsonl, 79 project directories on this machine, and the uuid is the id `--resume` takes',
    checkedAt: AT
  },
  {
    provider: 'claude-code',
    cliBuild: '2.1.236',
    runtime: RUNTIME,
    capability: 'native-resume-by-id',
    status: 'supported',
    evidenceRef:
      '`claude --resume 00000000-0000-4000-8000-000000000000 --print x` answered "No conversation found with session ID: …" and exited without running any inference — the reference is checked and an unknown one is refused loudly rather than starting a fresh conversation quietly',
    checkedAt: AT
  },
  {
    provider: 'claude-code',
    cliBuild: '2.1.236',
    runtime: RUNTIME,
    capability: 'native-resume-ack',
    status: 'unverified',
    evidenceRef:
      'the refusal above proves the REFERENCE is validated; nothing observed proves the resumed session carries the saved context. Settling it needs a certified run that resumes a known conversation and checks the restored context against what was saved',
    checkedAt: AT
  },

  {
    provider: 'claude-code',
    cliBuild: '2.1.236',
    runtime: RUNTIME,
    capability: 'env-override-detector',
    status: 'supported',
    evidenceRef:
      'measured against `claude auth status --json` with one variable set at a time: ANTHROPIC_API_KEY makes apiKeySource appear and drops email, org and subscription to null; ANTHROPIC_AUTH_TOKEN turns authMethod into oauth_token with apiKeySource still null; CLAUDE_CODE_USE_BEDROCK=1 and CLAUDE_CODE_USE_VERTEX=1 both turn it into third_party. An EMPTY ANTHROPIC_API_KEY changes nothing, and ANTHROPIC_BASE_URL and ANTHROPIC_CUSTOM_HEADERS leave the identity intact — four override, three do not, and the two detector fields catch different subsets',
    checkedAt: AT
  },

  // ── Codex CLI 0.152.1 ──────────────────────────────────────────────────────
  {
    provider: 'codex-cli',
    cliBuild: '0.152.1',
    runtime: RUNTIME,
    capability: 'identity-read',
    status: 'unsupported',
    evidenceRef:
      '`codex login status` prints one line — "Logged in using ChatGPT" — and `codex login status --json` fails with "unexpected argument". No subject, no organisation, no account label of any kind',
    checkedAt: AT
  },
  {
    provider: 'codex-cli',
    cliBuild: '0.152.1',
    runtime: RUNTIME,
    capability: 'identity-subject',
    status: 'unsupported',
    evidenceRef:
      'there is no machine-readable identity output at all on this build, so there is nothing to carry a subject. Reading the credential file to find one is forbidden: it is the secret',
    checkedAt: AT
  },
  {
    provider: 'codex-cli',
    cliBuild: '0.152.1',
    runtime: RUNTIME,
    capability: 'login-isolation-by-home',
    status: 'supported',
    evidenceRef:
      'with CODEX_HOME pointed at an empty directory, `codex login status` answered "Not logged in", while the real home answers "Logged in using ChatGPT"',
    checkedAt: AT
  },
  {
    provider: 'codex-cli',
    cliBuild: '0.152.1',
    runtime: RUNTIME,
    capability: 'credential-store-per-home',
    status: 'supported',
    evidenceRef:
      'the credential is a file inside the home — auth.json, mode 0600 — and `security find-generic-password` found no item under any of the services Codex, codex, ChatGPT or OpenAI Codex. Two homes therefore hold two credentials',
    checkedAt: AT
  },
  {
    provider: 'codex-cli',
    cliBuild: '0.152.1',
    runtime: RUNTIME,
    capability: 'conversation-store-per-home',
    status: 'supported',
    evidenceRef:
      'saved conversations are files under the home: ~/.codex/sessions/YYYY/MM/rollout-<timestamp>-<uuid>.jsonl, 328 of them on this machine, with a session_index.jsonl beside them; the uuid is the SESSION_ID `codex resume` takes',
    checkedAt: AT
  },
  {
    provider: 'codex-cli',
    cliBuild: '0.152.1',
    runtime: RUNTIME,
    capability: 'native-resume-by-id',
    status: 'unverified',
    evidenceRef:
      '`codex resume <uuid> x` exited with "Error: stdin is not a terminal" before validating the reference, so nothing was learnt about how an unknown one is treated. Settling it needs the reference driven through a pseudo-terminal, which this repository can do — apps/desktop/test/pty.test.mjs spawns one',
    checkedAt: AT
  },
  {
    provider: 'codex-cli',
    cliBuild: '0.152.1',
    runtime: RUNTIME,
    capability: 'env-override-detector',
    status: 'unsupported',
    evidenceRef:
      '`codex login status` answered "Logged in using ChatGPT" with OPENAI_API_KEY set, with CODEX_API_KEY set, with OPENAI_BASE_URL set, and with none of them — the same single line every time. This is not a finding that the key wins; it is the absence of any way to observe which credential a session will use, so a Codex auth context is cleaned and never verified',
    checkedAt: AT
  },
  {
    provider: 'codex-cli',
    cliBuild: '0.152.1',
    runtime: RUNTIME,
    capability: 'native-resume-ack',
    status: 'unverified',
    evidenceRef:
      'blocked behind the row above: the reference could not be presented without a terminal, so whether a resume acknowledges the restored context was not reached. Requires the same pseudo-terminal harness plus a certified run',
    checkedAt: AT
  }
]

/** A CLI upgrade invalidates the verdict, not the historical observation.
 * Measured with `claude --version` / `codex --version`, 2026-10-08 (claude-code 2.1.294 → 2.1.295; re-pinned by scripts/repin-provider-builds.mjs). The previous current rows were version-only too, so no capability verdict is lost.
 * No login, native session, credential store or model run was probed in this wiki iteration.
 */
export const CAPABILITY_MATRIX: readonly ProviderCapabilityReceipt[] = [
  ...HISTORICAL_CAPABILITY_MATRIX,
  ...HISTORICAL_CAPABILITY_MATRIX.map((row): ProviderCapabilityReceipt => ({
    ...row,
    cliBuild: PINNED_BUILDS[row.provider as keyof typeof PINNED_BUILDS],
    status: 'unverified',
    checkedAt: '2026-10-08',
    evidenceRef: `Installed build changed (version-only observation, 2026-10-08). Requires repeating the ${row.capability} probe and, for native continuity, a certified isolated run on this exact build. Historical ${row.cliBuild} receipt remains separate: ${row.evidenceRef}`
  }))
]

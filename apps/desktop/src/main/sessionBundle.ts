// The per-session bundle: the file that tells one agent where Fabric's door is
// and hands it the key.
//
// This lives in its own module rather than inside bootstrap() for one reason:
// it is the only place in the app where a credential is written to disk, and
// code that writes credentials should be readable and testable on its own. Its
// only dependency on Electron was `app.getPath('userData')`, which is a string.
//
// The lifetime rule this module exists to hold (SEC-REQ-012): a bundle is
// created immediately before a spawn and destroyed the moment that session is
// over — including when the session never started. Before this, session
// directories accumulated for the life of the installation, each holding a live
// bearer token, and a failed spawn left one behind that nothing would ever
// revoke, because revocation was wired to an exit event that could not fire for
// a process that never existed.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { type SurfaceAdapter, describeAgent, executorReadiness } from '../shared/agents.ts'
import { sessionConfig } from '../shared/sessionConfig.ts'
import { helperCommand } from './helperProcess.ts'
import { NAMED_TOOL, PREAMBLE } from '../shared/preamble.ts'
import { redact } from '../shared/redact.ts'
import { describeRefusals, planServers, type DeclaredServer, type GatewayFacts } from '../shared/servers.ts'
import { resolveServers } from '../shared/agentSpec.ts'
import type { BundleCompiler, SessionBundle } from './pty'
import { ops } from './opsSink.ts'
import { causeOf } from '../shared/opsLog.ts'
import { materialize, verify } from './executionPacket.ts'
import { MandatoryContextUnmet } from './contextPack.ts'

export interface BundleSurface {
  readonly endpoint: string
  mint(projectId: string, sessionId: string, taskId: string | null): { token: string }
  revokeSession(sessionId: string): void
}

export interface BundleCompilerDeps {
  /** Where session directories live — the app's own data directory, never a repo. */
  root: string
  surface: BundleSurface
  /**
   * Compiles the context pack for a session and journals its lockfile (M49).
   * Returns the text to write, or null when there is nothing to hand over.
   * The compiler sanitizes sources before deriving the journaled digest; this
   * writer preserves those exact bytes so packet identity matches the lockfile.
   * Injected rather than imported so this module stays free of the database.
   */
  context?: (sessionId: string, projectId: string, taskId: string | null) => Promise<string | null>
  /** What this project's sessions may reach besides Fabric (M127). */
  declaredServers?: (projectId: string) => Promise<DeclaredServer[]>
  /** What the machine's gateway offers, and the key for the hop. */
  gateway?: () => GatewayFacts
  /** Fabric's own version, the handoff's `writer.version` (`app.getVersion()`). */
  version?: string
}

// #region session-handoff-writer — docs: docs/adr/0140-a-session-is-handed-its-context-in-one-format-session-handoff-1.md#decision
// The bundle IS a `session-handoff/1` folder (fabric-agent-contract DEC-0042, ADR-0140): Fabric is the
// reference writer. The folder holds handoff.json (the manifest), context.md and mcp.json always, brief.md when
// the brief is delivered as a file — and nothing else. `test/session-handoff-conformance.test.mjs` runs the
// contract's own checker on a folder written for each connected adapter.
/** SH-8: a brief travels inline only in one plain argument of at most this many characters. */
export const MAX_INLINE_BRIEF = 1000
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/
/** Whether a brief may travel inline (SH-8): short, and one line, so any carrier (Switchboard in place:
 *  16 × 1024, no control characters) passes it. Anything else is brief.md — never truncated. */
export const fitsInline = (brief: string): boolean => brief.length <= MAX_INLINE_BRIEF && !CONTROL.test(brief)

/** What context.md says when there is no compiled pack: the file is always there (SH-3), and it says why. */
export const NO_PACK_NOTE =
  '# What this project already knows\n\n' +
  'Fabric could not compile this project\u2019s memory for this session, so none is pre-loaded here. ' +
  'Search memory before assuming anything.\n'

const digest = (text: string): string => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`
const write600 = (file: string, text: string): void => writeFileSync(file, text, { encoding: 'utf8', mode: 0o600 })

interface HandoffDeclaration {
  sessionId: string
  version: string
  files: string[]
  brief: { delivery: 'inline'; text: string } | { delivery: 'file' }
  strict: boolean
  launch: { runtime: string; args: string[]; env: Record<string, string | null> }
  contextDigest: string | null
}

/** handoff.json, written last so a folder with a manifest is a folder whose files are all in place. */
function writeHandoff(dir: string, d: HandoffDeclaration): void {
  const manifest = {
    format: 'session-handoff/1',
    writer: { product: 'fabric', version: d.version },
    writtenAt: new Date().toISOString(),
    lifetime: { kind: 'session', session: d.sessionId },
    files: d.files,
    firstCall: { server: 'fabric', tool: NAMED_TOOL },
    preamble: PREAMBLE,
    mcp: { auth: 'bearer', strict: d.strict },
    brief: d.brief,
    launch: d.launch,
    ...(d.contextDigest ? { integrity: { packet: 'execution-packet/1', parts: { 'context.md': d.contextDigest } } } : {})
  }
  write600(path.join(dir, 'handoff.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}
// #endregion session-handoff-writer

export function createBundleCompiler(deps: BundleCompilerDeps): BundleCompiler {
  const dirFor = (sessionId: string): string => path.join(deps.root, 'sessions', sessionId)

  function discard(sessionId: string): void {
    // Revoke first, but still remove the credential file if revocation throws.
    try {
      deps.surface.revokeSession(sessionId)
    } finally {
      try {
        rmSync(dirFor(sessionId), { recursive: true, force: true })
      } catch {
        ops.failed('sessionBundle.failure', new Error('could not remove session directory'), {
          sessionId
        })
      }
    }
  }

  return {
    async compile(
      sessionId: string,
      projectId: string,
      taskId: string | null,
      /** Which agent this bundle is for. The ARGUMENTS depend on it, and
       *  before this they did not — every connecting agent got Claude Code's. */
      optionId: string,
      adapter: SurfaceAdapter,
      agent: { instructions: string; servers: string[] } | null = null,
      modeConfig: Readonly<Record<string, unknown>> | null = null
    ): Promise<SessionBundle | null> {
      if (!deps.surface.endpoint) return null

      // PF-10.01 — a session that MUST reach Fabric's surface is refused unless
      // the agent is a ready EXECUTOR by capability, not by having launched. A
      // Codex terminal runs fine but registers no claim/handoff/memory tools;
      // minting it a surface credential would hand it a channel it cannot use
      // and let it be mistaken for a peer of the Claude executor. A `none`
      // adapter is the operator driving a plain shell and needs no surface, so
      // only a session that WANTS the surface (a real adapter) is gated here.
      if (adapter !== 'none') {
        const readiness = executorReadiness(optionId)
        if (!readiness.ready)
          throw new Error(
            `this option is not a ready Fabric executor: ${readiness.reason} — ` +
            `it can run as a plain session, but it cannot be handed the surface`
          )
      }

      // M127 — decided BEFORE the credential is minted and the directory made,
      // because a refusal after either leaves a live token and a directory to
      // clean up for a session that is not going to exist.
      //
      // One refusal blocks the launch. Started with three of its four servers,
      // the agent looks for the fourth tool, does not find it, and improvises:
      // it fails mid-run for a reason nobody recorded. This is M61's preflight
      // at the one moment it costs nothing.
      // A created agent gets what IT asked for; a plain session gets what the
      // project granted. Those are different questions with different answers:
      // a plain session is the operator driving directly in a project they
      // granted, and a created agent is delegated work that narrowed its own
      // reach. The agent's list was already checked against the project at
      // creation — and it is checked AGAIN here, because a grant withdrawn
      // afterwards must not leave a live agent reaching what the project no
      // longer allows.
      const projectGrants = deps.declaredServers ? await deps.declaredServers(projectId) : []
      let declared = projectGrants
      if (agent) {
        const ceiling = projectGrants.map((d) => d.name)
        const resolved = resolveServers(agent.servers, ceiling)
        if (!resolved.ok) throw new Error(resolved.reason)
        declared = resolved.servers.map((name) => ({ name, source: 'gateway' as const }))
      }
      const plan =
        declared.length > 0 && deps.gateway
          ? planServers(declared, deps.gateway())
          : ({ ok: true as const, grant: [] })
      if (!plan.ok)
        throw new Error(
          `this project declares ${declared.length} MCP server(s) and the session cannot have ` +
            `them all: ${describeRefusals(plan.refusals)}`
        )

      const scope = deps.surface.mint(projectId, sessionId, taskId)
      // Until compile returns, nobody else owns the credential's lifetime.
      // In particular, mkdir/write/verification can fail before PtyManager has
      // a bundle to discard. Roll back only the ephemeral session directory;
      // content-addressed packets remain available to other sessions and audit.
      try {
        const dir = dirFor(sessionId)
        // 0700 on the directory as well as 0600 on the file: the file's contents
        // are the secret, but a listable directory still publishes the session
        // ids, which is half of knowing where to look.
        mkdirSync(dir, { recursive: true, mode: 0o700 })
        const configPath = path.join(dir, 'mcp.json')
        writeFileSync(
          configPath,
          JSON.stringify(
            {
              mcpServers: {
                fabric: {
                  type: 'http',
                  url: deps.surface.endpoint,
                  headers: { Authorization: `Bearer ${scope.token}` }
                },
                // Granted servers reach the machine's gateway, never an upstream
                // directly: the gateway holds the upstream key at mode 600 and
                // authorises this hop with a role key. What lands here is that
                // ROLE key — scoped per hop, and destroyed with the directory.
                ...Object.fromEntries(
                  plan.grant.map((g) => [
                    g.name,
                    { type: 'http', url: g.url, headers: { 'x-agw-key': g.key } }
                  ])
                )
              }
            },
            null,
            2
          ),
          { encoding: 'utf8', mode: 0o600 }
        )
        // The context pack sits beside the credential, in the app's data directory
        // and never in the repository — the same rule and for the same reason: it
        // is Fabric's material, not the project's, and a pack committed to a repo
        // would be a stale copy of a moving store.
        // SH-3: context.md is always there. A pack that compiled is written as compiled (its packet digest
        // is the handoff's integrity part); otherwise a note saying none was pre-loaded, so the agent is told
        // rather than left to find an empty folder.
        let contextDigest: string | null = null
        if (deps.context) {
          try {
            const pack = await deps.context(sessionId, projectId, taskId)
            if (pack !== null) {
              writeFileSync(path.join(dir, 'context.md'), pack, { encoding: 'utf8', mode: 0o600 })
              // PF-05.02 — the pack is ALSO materialized content-addressed, under
              // the app root rather than the session directory: the session dir
              // dies with the session, the packet store is the durable answer to
              // "what did this session run from", and its identity is the digest,
              // not the path. A packet whose blob does not verify BLOCKS the
              // start — a session on partial context is worse than no session.
              const packetRoot = path.join(deps.root, 'packets')
              const packet = materialize(
                packetRoot,
                { sessionId, projectId, taskId },
                [{ name: 'context', bytes: pack }]
              )
              const check = verify(packetRoot, packet)
              if (!check.ok)
                throw new Error(
                  `execution packet does not verify — missing: ${check.missing.join(', ') || 'none'}; ` +
                    `corrupt: ${check.corrupt.join(', ') || 'none'}`
                )
              const part = packet.refs.find((r) => r.name === 'context')
              if (part) contextDigest = `sha256:${part.sha256}`
            }
          } catch (e) {
            // A session must still start when its pack cannot be COMPILED — it
            // begins without one and says so. A packet that FAILED TO VERIFY is
            // different: that store is lying, and the error above escapes this
            // catch by name.
            if (e instanceof Error && e.message.startsWith('execution packet does not verify')) throw e
            // And an UNATTENDED start whose required context did not answer is
            // refused, not started blind (S14; release review 2026-10-03). A
            // person's terminal never demands sources, so this cannot fire for
            // the session a person is watching.
            if (e instanceof MandatoryContextUnmet) throw e
            ops.failed('sessionBundle.failure', e, { note: `context pack failed for session ${sessionId}:` })
          }
        }
        if (contextDigest === null) write600(path.join(dir, 'context.md'), NO_PACK_NOTE)
        const version = deps.version ?? '0.0.0'
        // The agent's own brief FIRST and Fabric's preamble LAST, so the last thing the session is told is
        // where its rules live and that what it remembers about Fabric is not current. A brief that
        // contradicts the rules cannot win by being later. Old stored briefs may predate command ingress
        // sanitation: clean prompt text, never the scoped transport credential.
        const brief = agent ? `${redact(agent.instructions).text}\n\n${PREAMBLE}` : PREAMBLE
        const briefPath = path.join(dir, 'brief.md')
        /** SH-8: the brief as a file — brief.md — when it cannot travel inline or the runtime reads files only. */
        const briefFile = (): void => write600(briefPath, `${brief}\n`)

        // DISPATCHED on the agent's declared adapter, not hardcoded. Before
        // this, every connecting agent got Claude Code's flags whether or not it
        // understood them — a second one would have failed to start, or started
        // with no Fabric tools and no complaint.
        switch (adapter) {
          case 'mcp-config-flag':
            // strict: the session sees Fabric's tools and nothing the machine
            // happens to have configured elsewhere.
            //
            // AND THE PREAMBLE, which is the other half of M123. Handing an agent
            // tools does not tell it the rules; `fabric_whoami` holds those, and
            // until this argument existed the only thing asking for that call was
            // a sentence inside a tool description. The preamble names one tool
            // and no rule — `preamble.ts` says why, and a test enforces it.
            //
            // `--mcp-config=<path>`, JOINED (SH-11): the option takes several values, and in the spaced form
            // the next bare value is read as one more config (Switchboard SB-94, #141; Dashboards #68).
            {
              const inline = fitsInline(brief)
              if (!inline) briefFile()
              const args = [
                `--mcp-config=${configPath}`,
                '--strict-mcp-config',
                ...(inline ? ['--append-system-prompt', brief] : ['--append-system-prompt-file', briefPath])
              ]
              writeHandoff(dir, {
                sessionId, version, contextDigest, strict: true,
                files: ['context.md', 'mcp.json', ...(inline ? [] : ['brief.md'])],
                brief: inline ? { delivery: 'inline', text: brief } : { delivery: 'file' },
                launch: { runtime: optionId, args, env: {} }
              })
              return { dir, args }
            }
          case 'config-content-env': {
            // ADR-0119 / P-10: the whole session config travels in ONE variable whose
            // content outranks the project's config file (`SurfaceConfig` in agents.ts
            // says why the content and not a file path). The brief rides in a 0600 file
            // the config names as an instruction, beside mcp.json in the session
            // directory, so it dies with the session like the credential.
            const surfaceConfig = describeAgent(optionId)?.surfaceConfig
            if (!surfaceConfig)
              throw new Error(`${optionId} declares config-content-env but names no session config`)
            briefFile()
            // Kilo offers no switch that loads only these servers, so the handoff declares strict false.
            writeHandoff(dir, {
              sessionId, version, contextDigest, strict: false,
              files: ['context.md', 'mcp.json', 'brief.md'],
              brief: { delivery: 'file' },
              launch: { runtime: optionId, args: [], env: { [surfaceConfig.env]: null } }
            })
            return {
              dir,
              args: [],
              env: {
                [surfaceConfig.env]: JSON.stringify(
                  sessionConfig(surfaceConfig.format, {
                    endpoint: deps.surface.endpoint,
                    token: scope.token,
                    grants: plan.grant,
                    instructions: [briefPath],
                    modeConfig
                  })
                )
              }
            }
          }
          case 'acp-session': {
            // ADR-0119 §1/§2, P-10: the PTY runs Fabric's ACP terminal shell, which starts the agent
            // in its ACP mode and opens the session with Fabric's surface — over HTTP when the agent
            // declares it, else through Fabric's stdio bridge. The session document (credential
            // included) travels in FABRIC_ACP_SESSION; neither program sees it in an argument, and
            // each removes it from its own environment once read.
            const descriptor = describeAgent(optionId)
            if (!descriptor?.acp || !descriptor.program)
              throw new Error(`${optionId} declares acp-session but names no ACP mode`)
            const shell = helperCommand('acp-shell')
            const bridge = helperCommand('mcp-bridge')
            const authorization = `Bearer ${scope.token}`
            const bridgeBase = Object.entries(bridge.env).map(([name, value]) => ({ name, value }))
            const granted = plan.grant.filter((g) => g.name !== 'fabric')
            const spec = {
              http: { type: 'http', name: 'fabric', url: deps.surface.endpoint, headers: [{ name: 'Authorization', value: authorization }] },
              stdio: {
                name: 'fabric',
                command: bridge.program,
                args: bridge.args,
                env: [
                  ...bridgeBase,
                  { name: 'FABRIC_BRIDGE_URL', value: deps.surface.endpoint },
                  { name: 'FABRIC_BRIDGE_AUTHORIZATION', value: authorization }
                ]
              },
              // SH-8: the brief is brief.md; the shell reads it and sends it as the first ACP prompt.
              briefFile: briefPath,
              mode: modeConfig?.acpMode === 'bypass' ? 'bypass' : 'ask',
              // The project's granted gateway servers, each with its hop's role key (audit 2026-10-05
              // A6-004: they were dropped, so a Hermes agent created with servers reached none of them).
              // Both spellings travel and the shell picks by what the agent declares: HTTP servers for an
              // agent that takes them, else one stdio bridge per server, the role key in that bridge's
              // environment and in the gateway's header (audit 2026-10-06 DA-2: Hermes 0.21.4 declares no
              // HTTP MCP and reached none). The shell refuses a session these cannot carry (M127).
              grants: granted.map((g) => ({ type: 'http', name: g.name, url: g.url, headers: [{ name: 'x-agw-key', value: g.key }] })),
              grantsOverStdio: granted.map((g) => ({
                name: g.name,
                command: bridge.program,
                args: bridge.args,
                env: [
                  ...bridgeBase,
                  { name: 'FABRIC_BRIDGE_URL', value: g.url },
                  { name: 'FABRIC_BRIDGE_HEADER', value: 'x-agw-key' },
                  { name: 'FABRIC_BRIDGE_AUTHORIZATION', value: g.key }
                ]
              }))
            }
            briefFile()
            const runtimeEnv = descriptor.acp.env ?? {}
            writeHandoff(dir, {
              sessionId, version, contextDigest,
              // Hermes' switch for loading only the session's servers (ADR-0119); an ACP runner without one is not strict.
              strict: runtimeEnv.HERMES_ACP_SKIP_CONFIGURED_MCP === '1',
              files: ['context.md', 'mcp.json', 'brief.md'],
              brief: { delivery: 'file' },
              launch: { runtime: optionId, args: [], env: { ...runtimeEnv, FABRIC_ACP_SESSION: null } }
            })
            return {
              dir,
              args: [],
              command: { program: shell.program, args: [...shell.args, '--', descriptor.program, ...descriptor.acp.args] },
              env: { ...shell.env, ...(descriptor.acp.env ?? {}), FABRIC_ACP_SESSION: JSON.stringify(spec) }
            }
          }
          case 'none':
            // The agent connects to nothing, so it takes no arguments from us —
            // and no preamble either, which is correct rather than a shortfall:
            // every descriptor on this adapter has `connectsToSurface: false`, so
            // there is no `fabric_whoami` for the text to point at. An adapter
            // that DID connect and could not carry a preamble would have to be
            // decided here rather than defaulted; `unimplemented` below is what
            // makes that a refusal instead of a silent omission.
            return { dir, args: [] }
          default:
            // An adapter that was declared and never written. Refusing is the
            // point: borrowing another program's flags is how an agent starts
            // silently toolless.
            throw new Error(
              `${optionId} declares the surface adapter "${adapter}", which nobody has implemented`
            )
        }
      } catch (error) {
        try {
          discard(sessionId)
        } catch (e) {
          // Cleanup must not replace the launch failure, nor log credentials
          // that a dependency might have included in its exception: the kind only.
          ops.failed('sessionBundle.failure', new Error('session bundle rollback failed'), { cause: causeOf(e) })
        }
        throw error
      }
    },

    discard
  }
}

// Scratch harness: the REAL Agent access panel and the REAL board screen, with the app's styles and
// i18n, against a mocked window.fabric. Query: ?s=<scenario>&l=en|ru&t=light|dark&v=panel|board
import { createRoot } from 'react-dom/client'
import '@fontsource/inter-tight/400.css'
import '@fontsource/inter-tight/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
const SRC = '../../../apps/desktop/src'
import '../../../apps/desktop/src/renderer/src/tokens.paperclip.css'
import '../../../apps/desktop/src/renderer/src/tokens.passioncode.css'
import '../../../apps/desktop/src/renderer/src/tokens.app.css'
import '../../../apps/desktop/src/renderer/src/styles.css'
import '../../../apps/desktop/src/renderer/src/components.css'
import '../../../apps/desktop/src/renderer/src/launch/launch.css'
import { AgentAccessPanel } from '../../../apps/desktop/src/renderer/src/AgentAccessPanel.tsx'
import { BoardScreen } from '../../../apps/desktop/src/renderer/src/launch/BoardScreen.tsx'
import { I18nProvider } from '../../../apps/desktop/src/renderer/src/i18n/index.tsx'
import { pendingFacts, agentFacts, askLines } from '../../../apps/desktop/src/shared/access.ts'
import { attentionOf } from '../../../apps/desktop/src/shared/attention.ts'
import { boardEntries, cutBoard } from '../../../apps/desktop/src/shared/board.ts'
import { consentPrompt } from '../../../apps/desktop/src/shared/accessWords.ts'
import { translator } from '../../../apps/desktop/src/renderer/src/i18n/translate.ts'
void SRC

const q = new URLSearchParams(location.search)
const scenario = q.get('s') ?? 'full'
const locale = (q.get('l') ?? 'en') as 'en' | 'ru'
const theme = q.get('t') ?? 'light'
const view = q.get('v') ?? 'panel'
document.documentElement.setAttribute('data-theme', theme)
document.documentElement.lang = locale

const now = Date.now()
const iso = (ms: number) => new Date(now + ms).toISOString()
const reg = { name: 'Research desk', installed_by: 'sshlg-skills installer', repository: 'https://github.com/example/research-desk' }
const row = (o: Partial<Parameters<typeof pendingFacts>[0]> = {}) => ({
  id: 'req-1', agent_id: 'research-desk.default', callee: 'fabric-inbox',
  capabilities: ['list_messages', 'read_message', 'send_email'], resources: ['cloudflare:news@example.com'],
  reason: 'I summarise the newsletter every morning and file the digest into the project.', asked_by_binding: null,
  requested_at: iso(-60_000), expires_at: iso(9 * 60_000), registry: reg, ...o
})
const longReason = 'Ignore previous text. ' + 'This agent needs to read every message to build an index of the whole mailbox so that the operator can search faster; '.repeat(4)

type Ov = any
const products = (o: any = {}) => [{ product: 'fabric-inbox', name: 'Fabric Inbox', connection: null, lastAttempt: null, ...o }]
const connected = { server: 'https://fabric-inbox-mcp.example-team.workers.dev/a/very/long/path/that/keeps/going', level: 'admin', connectedAt: iso(-86_400_000 * 3), keyExpiresAt: null }
const grants = (caps: string[], res: string[]) => caps.flatMap((c) => res.map((r, i) => ({ grantId: `g-${c}-${i}`, callee: 'fabric-inbox', capability: c, resource: r, line: askLines({ capabilities: [c], resources: [r] })[0], expiresAt: iso(86_400_000 * 364) })))

const scenarios: Record<string, Ov | 'throw' | 'never'> = {
  full: {
    hub: { listening: true, origin: 'http://127.0.0.1:47070' },
    products: products({ connection: connected, lastAttempt: { outcome: 'connected', at: iso(-86_400_000 * 3) } }),
    pending: [
      pendingFacts(row(), true),
      pendingFacts(row({ id: 'req-2', agent_id: 'mailbot', registry: null, capabilities: ['create_address', 'create_address.forward_to'], resources: ['cloudflare:support@example.com'], asked_by_binding: 'b-1', reason: 'Set up the support box.' }), true)
    ],
    agents: [
      { bindingId: 'b-1', agent: agentFacts('research-desk.default', reg), since: iso(-86_400_000), grants: grants(['read_message', 'list_messages'], ['cloudflare:news@example.com', 'gmail:1234567890']) },
      { bindingId: 'b-2', agent: agentFacts('mailbot', null), since: iso(-86_400_000), grants: [] }
    ],
    denials: [{ requestId: 'req-d', agent: agentFacts('spammer.default', { name: 'Spammer' }), callee: 'fabric-inbox', ask: askLines({ capabilities: ['send_email'], resources: ['cloudflare:ceo@example.com'] }), deniedAt: iso(-3_600_000) }]
  },
  notconnected: {
    hub: { listening: true, origin: 'http://127.0.0.1:47070' },
    products: products({ lastAttempt: { outcome: 'waiting', at: iso(-30_000) } }),
    pending: [pendingFacts(row(), false)],
    agents: [], denials: []
  },
  reconnectWaiting: {
    hub: { listening: true, origin: 'http://127.0.0.1:47070' },
    products: products({ connection: connected, lastAttempt: { outcome: 'waiting', at: iso(-30_000), reconnect: true } }),
    pending: [], agents: [], denials: []
  },
  failed: {
    hub: { listening: true, origin: 'http://127.0.0.1:47070' },
    products: products({ lastAttempt: { outcome: 'failed', at: iso(-30_000), problem: { code: 'vault', detail: 'use_secret.py: project fabric has no vault (run vault.py init)' } } }),
    pending: [], agents: [], denials: []
  },
  connectedLateRecord: {
    hub: { listening: true, origin: 'http://127.0.0.1:47070' },
    products: products({ connection: connected, lastAttempt: { outcome: 'failed', at: iso(-30_000), problem: { code: 'withdraw-failed' } } }),
    pending: [], agents: [], denials: []
  },
  withdrawn: {
    hub: { listening: true, origin: 'http://127.0.0.1:47070' },
    products: products({ lastAttempt: { outcome: 'failed', at: iso(-30_000), problem: { code: 'withdrawn', previousLost: true } } }),
    pending: [], agents: [], denials: []
  },
  declined: {
    hub: { listening: true, origin: 'http://127.0.0.1:47070' },
    products: products({ lastAttempt: { outcome: 'denied', at: iso(-30_000) } }),
    pending: [], agents: [], denials: []
  },
  hubOff: {
    hub: { listening: false, reason: 'EADDRINUSE', code: 'port-taken', fact: 'port 47070: EADDRINUSE' },
    products: products(),
    pending: [], agents: [], denials: []
  },
  empty: { hub: { listening: true, origin: 'http://127.0.0.1:47070' }, products: products(), pending: [], agents: [], denials: [] },
  long: {
    hub: { listening: true, origin: 'http://127.0.0.1:47070' },
    products: products({ connection: connected }),
    pending: [pendingFacts(row({ agent_id: 'a-very-long-provider-identifier-without-spaces-at-all.instance-number-two', registry: { name: 'An agent with a deliberately long registry name that goes on', installed_by: 'someone@some-very-long-domain-name.example.com', repository: 'https://github.com/an-organisation-with-a-long-name/a-repository-with-an-even-longer-name-for-testing' }, reason: longReason, resources: ['cloudflare:a.really.long.local.part.for.testing@subdomain.of.a.long.domain.example.com', 'cloudflare:news@example.com'] }), true)],
    agents: [{ bindingId: 'b-1', agent: agentFacts('research-desk.default', reg), since: iso(-86_400_000), grants: grants(['read_message', 'list_messages', 'send_email', 'get_attachment'], ['cloudflare:a.really.long.local.part.for.testing@subdomain.of.a.long.domain.example.com', 'cloudflare:news@example.com']) }],
    denials: []
  },
  unreadable: 'throw',
  loading: 'never'
}

const calls: any[] = []
;(window as any).__calls = calls
const decideResult = q.get('decide') ?? 'ok'
const delay = Number(q.get('delay') ?? '150')
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), delay))
;(window as any).fabric = {
  hub: {
    overview: async () => {
      const s = scenarios[scenario]
      if (s === 'throw') throw new Error("Error invoking remote method 'hub:overview': Error: relation \"access_requests\" does not exist")
      if (s === 'never') return new Promise(() => {})
      return structuredClone(s)
    },
    decide: async (id: string, d: string) => {
      calls.push(['decide', id, d])
      if (decideResult === 'expired') return wait({ ok: false, code: 'expired', reason: 'request expired' })
      if (decideResult === 'noopen') return wait({ ok: true, connect: { problem: { code: 'not-installed', detail: 'No application knows how to open URL fabric-inbox://connect?…' } } })
      return wait({ ok: true })
    },
    revokeGrant: async (id: string) => { calls.push(['revokeGrant', id]); return wait({ ok: true }) },
    revokeAgent: async (id: string) => { calls.push(['revokeAgent', id]); return wait({ ok: true }) },
    clearDenial: async (id: string) => { calls.push(['clearDenial', id]); return wait({ ok: true }) },
    connect: async (p: string, o: any) => { calls.push(['connect', p, o]); return wait({ ok: true }) },
    disconnect: async (p: string) => { calls.push(['disconnect', p]); return wait({ ok: true }) }
  },
  board: {
    query: async () => {
      const s = scenarios[scenario] as Ov
      const items = attentionOf({ reviews: [], expired: [], refusals: [], proposals: [], names: {}, access: s.pending } as any)
      const entries = boardEntries({ questions: [], attention: items, projectWeightOf: () => 1, now: new Date() })
      return { data: cutBoard(entries, 100), availability: 'complete', freshness: 'fresh', asOf: new Date().toISOString(), revision: '1', sources: [{ name: 'attention', status: 'ok', asOf: new Date().toISOString() }], omitted: [] }
    },
    resolved: async () => ({ data: [], availability: 'complete', freshness: 'fresh', asOf: null, revision: null, sources: [], omitted: [] }),
    deferred: async () => ({ data: [], availability: 'complete', freshness: 'fresh', asOf: null, revision: null, sources: [], omitted: [] })
  },
  proposals: { decide: async () => ({ ok: true }) },
  attention: { grant: async () => ({}) }
}

function Prompt() {
  const s = scenarios[scenario] as Ov
  const p = s.pending[0]
  const out = consentPrompt(translator(locale), { agent: p.agent, product: p.product, ask: p.ask, reason: p.reason, connected: p.connected, incremental: p.incremental })
  return <pre id="prompt" style={{ whiteSpace: 'pre-wrap', padding: 16 }}>{JSON.stringify(out, null, 2)}</pre>
}

function Root() {
  const errs: string[] = []
  if (view === 'prompt') return <Prompt />
  if (view === 'board') {
    const s = scenarios[scenario] as Ov
    return (
      <div className="app launch-root" style={{ height: '100vh' }}>
        <div className="workbench"><aside className="app-sidebar"><nav className="app-nav"><a href="#">Fabric</a></nav></aside><div className="app-main"><div className="shell"><main className="content">
          <BoardScreen feedMark={0} projects={[]} initialItem={s.pending[0] ? `access/access-request:${s.pending[0].requestId}` : null} onOpen={() => {}} onError={(m) => { errs.push(m); (window as any).__errors = errs; console.log('onError', m) }} onChat={() => {}} />
        </main></div></div></div>
      </div>
    )
  }
  return (
    <div className="app launch-root" style={{ height: '100vh' }}>
      <div className="workbench"><aside className="app-sidebar"><nav className="app-nav"><a href="#">Fabric</a></nav></aside><div className="app-main"><div className="scope-bar"><span>Workspace / Fabric</span></div><div className="shell shell-with-panel"><main className="content"><p style={{ padding: 16 }}>main content</p></main>
        <AgentAccessPanel onClose={() => calls.push(['close'])} />
      </div></div></div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<I18nProvider locale={locale}><Root /></I18nProvider>)

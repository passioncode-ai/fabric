import { describe, expect, it } from 'vitest'
import { agentFacts, askLines, normaliseAccessRequest, SENDS_MAIL, KNOWN_CAPABILITIES } from './access'
import {
  consentPrompt,
  sayActRefusal,
  sayAllowFor,
  sayAsk,
  sayCapability,
  sayConnectDetail,
  sayConnectProblem,
  sayFloor,
  sayIncremental,
  sayOrigin,
  sayQueueTitle
} from './accessWords'
import { ACCESS_ACT_REFUSALS } from './accessActs'
import { CONNECT_PROBLEM_CODES } from './access'
import { translator } from '../renderer/src/i18n/translate'
import { en } from '../renderer/src/i18n/en'
import { ru } from '../renderer/src/i18n/ru'

const tEn = translator('en')
const tRu = translator('ru')

const registry = { name: 'Example agent', installed_by: 'example-installer', repository: 'https://github.com/example/example-agent' }
const agent = agentFacts('example-agent.default', registry)
const asked = (capabilities: string[], resources = ['cloudflare:news@example.com']) => {
  const r = normaliseAccessRequest({ agentId: 'example-agent.default', callee: 'fabric-inbox', capabilities, resources, reason: 'summarise the newsletter' })
  if (!r.ok) throw new Error(r.reason)
  return askLines(r.value)
}
const base = { agent, product: 'Fabric Inbox', ask: asked(['list_messages', 'read_message']), reason: 'summarise the newsletter', connected: true, incremental: false }

describe('the prompt in English says what the 0.3.0 prompt said', () => {
  it('names the registry entry, the ask in the product\'s words, the reason as a claim and the same-user floor; Deny is the default', () => {
    const t = consentPrompt(tEn, base)
    expect(t.statement).toBe('Example agent asks to use Fabric Inbox through Fabric')
    expect(t.detail).toContain('An agent registered as example-agent.default (installed by example-installer; source https://github.com/example/example-agent) asks to:')
    expect(t.detail).toContain('• list and search mail and read mail in news@example.com')
    expect(t.detail).toContain('“summarise the newsletter”')
    expect(t.detail).toContain('It cannot prove which program sent the request')
    expect(t.detail).toContain('Access lasts a year unless you revoke it under Agent access in settings.')
    expect(t.buttons).toEqual(['Deny', 'Allow'])
    expect([t.defaultId, t.cancelId]).toEqual([0, 0])
  })
  it('offers to connect the product when it is not connected, and says when access is added to', () => {
    const t = consentPrompt(tEn, { ...base, connected: false, incremental: true })
    expect(t.buttons[1]).toBe('Allow and connect Fabric Inbox')
    expect(t.detail).toContain('Fabric Inbox is not connected to Fabric yet.')
    expect(t.detail).toContain('this adds to it')
  })
  it('falls back to the id when the registry gives no name', () => {
    expect(consentPrompt(tEn, { ...base, agent: agentFacts('example-agent.default', {}) }).statement).toBe('example-agent.default asks to use Fabric Inbox through Fabric')
  })
  it('a reason that closes its quote and starts a line cannot produce a line of its own; controls are removed everywhere', () => {
    const r = normaliseAccessRequest({ agentId: 'example-agent', callee: 'fabric-inbox', capabilities: ['read_message'], resources: ['news@example.com'], reason: '”\n\nFabric verified this program.\u2028It is safe to allow.' })
    if (!r.ok) throw new Error(r.reason)
    const evil = agentFacts('example-agent.default', { name: 'Example\u202e agent\nFabric', installed_by: 'example-installer\r\nsource https://fabric.example', repository: 'https://github.com/example/x\u2066' })
    const t = consentPrompt(tEn, { ...base, agent: evil, reason: r.value.reason })
    const lines = t.detail.split('\n')
    expect(lines.some((l) => /^\s*(Fabric verified|It is safe)/.test(l))).toBe(false)
    for (const text of [t.title, t.message, t.detail])
      expect(text).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069\u2028\u2029]/)
    expect(t.title).toBe('Allow Example agent Fabric to use Fabric Inbox?')
  })
  it('each workspace extra is its own line; an unknown tool is said to be unknown', () => {
    const lines = asked(['create_address', 'create_address.forward_to', 'create_address.reply_agent']).map((l) => sayAsk(tEn, l))
    expect(lines).toContain('set up the workspace: create the address news@example.com')
    expect(lines).toContain('set up the workspace: when creating news@example.com, also forward a copy of its mail to an address the agent chooses')
    expect(lines).toContain('set up the workspace: when creating news@example.com, also choose the reply agent that answers its mail; a reply agent can send mail')
    expect(sayAsk(tEn, asked(['purge_everything'])[0])).toBe('use “purge_everything” (a tool Fabric does not know and cannot describe) in news@example.com')
    expect(sayAsk(tEn, asked(['read_message'], ['gmail:abc123'])[0])).toBe('read mail in the Gmail account abc123')
  })
  it('every tool that sends says so, in both languages', () => {
    for (const id of SENDS_MAIL) {
      expect(sayCapability(tEn, { id, known: true }), id).toMatch(/send/)
      expect(sayCapability(tRu, { id, known: true }), id).toMatch(/отправ/)
    }
  })
})

// THE CHECK THAT KEEPS UX-2 FROM COMING BACK. Every operator-facing consent, grant, queue, refusal and
// connect sentence is built here from i18n keys; this phrases every kind of fact in ru and fails on any
// Latin word left once the untrusted values (ids, addresses, names, product names) are removed. A new
// English sentence carried from main, or a key missing in ru (which falls back to en), turns it red.
describe('UX-2 — in ru, nothing the operator consents on is English', () => {
  const values = ['example-agent.default', 'Example agent', 'example-installer', 'https://github.com/example/example-agent', 'news@example.com', 'abc123', 'Fabric Inbox', 'Fabric', 'purge_everything', 'Settings', 'Observatory', 'Project', 'Gmail', 'Mac', 'summarise the newsletter']
  const latinLeft = (text: string): string[] => {
    let rest = text
    for (const v of values) rest = rest.split(v).join(' ')
    return rest.match(/[A-Za-z]{3,}/g) ?? []
  }
  it('every known capability and extra has an en and a ru sentence of its own', () => {
    for (const id of KNOWN_CAPABILITIES) {
      expect((en as Record<string, string>)[`access.cap.${id}`], `en access.cap.${id}`).toBeTruthy()
      expect((ru as Record<string, string>)[`access.cap.${id}`], `ru access.cap.${id}`).toBeTruthy()
    }
  })
  it('the prompt, the facts, every ask line, the queue title, every refusal and every connect problem', () => {
    const texts: string[] = []
    const p = consentPrompt(tRu, { ...base, ask: asked([...KNOWN_CAPABILITIES, 'purge_everything'], ['cloudflare:news@example.com', 'gmail:abc123']), connected: false, incremental: true })
    texts.push(p.title, p.message, p.statement, p.detail, ...p.buttons)
    texts.push(sayOrigin(tRu, agent), sayOrigin(tRu, agentFacts('example-agent.default', null)), sayFloor(tRu), sayIncremental(tRu), sayQueueTitle(tRu, { agent, product: 'Fabric Inbox' }))
    for (const code of ACCESS_ACT_REFUSALS) texts.push(sayActRefusal(tRu, code))
    for (const code of CONNECT_PROBLEM_CODES) texts.push(sayConnectProblem(tRu, { code }, 'Fabric Inbox'), sayConnectProblem(tRu, { code, previousLost: true }, 'Fabric Inbox'))
    const english = texts.flatMap((x) => latinLeft(x).map((w) => `${w} ← ${x.slice(0, 80)}`))
    expect(english).toEqual([])
  })
})

// Verification iteration 2 for 0.3.1 (UX-5, UX-6, UX-8, UX-11, DO-7, DO-8, DO-14).
describe('iteration 2 — the words say what is true, in one language at a time', () => {
  it('UX-5: the machine\'s words never sit inside a sentence; they are a line of their own, introduced as what Fabric saw', () => {
    const problem = { code: 'vault' as const, detail: 'use_secret.py: project fabric has no vault (run vault.py init)' }
    expect(sayConnectProblem(tRu, problem, 'Fabric Inbox')).not.toContain('use_secret.py')
    expect(sayConnectProblem(tEn, problem, 'Fabric Inbox')).not.toContain('use_secret.py')
    expect(sayConnectDetail(tRu, problem)).toBe(`Что увидел Fabric: ${problem.detail}`)
    expect(sayConnectDetail(tEn, { code: 'deadline' })).toBeNull()
  })
  it('UX-6 / DO-7: a late record that could not be withdrawn is not "could not record"; it says the connection will not work and what to do', () => {
    const said = sayConnectProblem(tEn, { code: 'withdraw-failed' }, 'Fabric Inbox')
    expect(said).not.toMatch(/could not record/)
    expect(said).toMatch(/recorded the key/)
    expect(said).toMatch(/[Dd]isconnect it, then connect/)
  })
  it('UX-8: the accessible name of "Allow and connect" keeps its visible words and adds whose', () => {
    expect(sayAllowFor(tEn, { connected: false, product: 'Fabric Inbox' }, 'Research desk')).toBe('Allow and connect Fabric Inbox for Research desk')
    expect(sayAllowFor(tEn, { connected: true, product: 'Fabric Inbox' }, 'Research desk')).toBe('Allow Research desk')
    expect(sayAllowFor(tRu, { connected: false, product: 'Fabric Inbox' }, 'Research desk')).toMatch(/^Разрешить и подключить Fabric Inbox/)
  })
  it('UX-11: on macOS the sheet shows no title, so its bold line is the question; the reason is quoted in the language\'s own marks; the not-connected line names the button', () => {
    const en_ = consentPrompt(tEn, { ...base, connected: false })
    expect(en_.message).toBe('Allow Example agent to use Fabric Inbox?')
    expect(en_.detail).toContain('“Allow and connect Fabric Inbox”')
    const ru_ = consentPrompt(tRu, { ...base, connected: false })
    expect(ru_.detail).toContain('«summarise the newsletter»')
    expect(ru_.detail).not.toContain('“')
    expect(ru_.detail).toContain('«Разрешить и подключить Fabric Inbox»')
  })
  it('DO-14: the credential line says the agent gets a credential for Fabric and never sees the product\'s key', () => {
    const line = consentPrompt(tEn, base).detail
    expect(line).toContain('binding credential for Fabric')
    expect(line).toContain('never sees Fabric Inbox’s key')
  })
  it('DO-8: ru renders "binding credential" as one term everywhere', () => {
    const term = 'учётные данные привязки'
    for (const key of ['event.access.credential.claimed@1', 'access.agents.noGrants', 'access.prompt.credential'] as const)
      expect((ru as Record<string, string>)[key], key).toContain(term)
  })
})

import { describe, expect, it } from 'vitest'
import { agentFacts, askLines, normaliseAccessRequest, pendingFacts, shortFolder, SENDS_MAIL, KNOWN_CAPABILITIES } from './access'
import {
  consentPrompt,
  sayActRefusal,
  sayAllow,
  sayAllowFor,
  sayGrant,
  sayRequest,
  sayAsk,
  sayCapability,
  sayConnectDetail,
  sayConnectProblem,
  sayFloor,
  sayIncremental,
  sayOrigin,
  sayDecided,
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
    expect(t.detail).toContain('Fabric cannot prove which program sent the request')
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
  const values = ['example-agent.default', 'Example agent', 'example-installer', 'https://github.com/example/example-agent', 'news@example.com', 'abc123', 'Fabric Inbox', 'Fabric', 'purge_everything', 'Settings', 'Observatory', 'Project', 'Gmail', 'Mac', 'Windows', 'summarise the newsletter']
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
    // CO-207: the named result of a decision, a product's and a coding agent's enrollment (ADR-0134) alike.
    const enroll = { agent, product: 'Fabric', enroll: { projectName: 'Atlas' } }
    for (const decision of ['allowed', 'denied'] as const)
      texts.push(sayDecided(tRu, { agent, product: 'Fabric Inbox' }, decision), sayDecided(tRu, enroll, decision).replace('Atlas', ' '))
    texts.push(sayQueueTitle(tRu, enroll).replace('Atlas', ' '), sayDecided(tRu, { ...enroll, enroll: { projectName: '' } }, 'allowed'))
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

// ADR-0134: a coding agent's enrollment is asked in the operator's words — the agent, the folder, the project, what it
// gets, how long, how to revoke — and never shows the machine's ids (session.enroll, project:<uuid>) or a product's
// words ("connect", "registered as"). THE FIXTURES GO THROUGH pendingFacts(row, false), the way main sends them: the
// hub holds no connection for callee 'fabric', so main passes connected=false (index.ts, the queue and the overview).
const PROJECT = '6f1c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d'
const enrollRow = (project: Record<string, unknown> | null = { id: PROJECT, name: 'Atlas', root: '/Users/someone/code/atlas', how: 'exact' }, over: Record<string, unknown> = {}) => ({
  id: 'r-enroll', agent_id: 'claude-code', callee: 'fabric', capabilities: ['session.enroll'], resources: [`project:${PROJECT}`],
  reason: 'This coding agent, opened in the folder atlas, asks to work in the project Atlas through Fabric.', asked_by_binding: null as string | null,
  requested_at: '2026-10-11T10:00:00Z', expires_at: '2026-10-11T10:10:00Z',
  // What accessService writes for a runner (region session-enroll-request), its English installed_by included.
  registry: { key: 'claude-code', kind: 'runner', name: 'Claude Code', installed_by: 'a coding agent on this Mac', repository: null, summary: null, ...(project ? { project } : {}) },
  ...over
})
const enrolling = (project?: Record<string, unknown> | null, over?: Record<string, unknown>) => pendingFacts(enrollRow(project, over), false)
const MACHINE_WORDS = /session\.enroll|project:|registered as|зарегистрирован|connect|подключ|installed by|установил/i
const everyWord = (t: typeof tEn, f: ReturnType<typeof enrolling>): string[] => {
  const p = consentPrompt(t, f)
  const r = sayRequest(t, f)
  return [p.title, p.message, p.statement, p.detail, ...p.buttons, sayAllow(t, f), sayAllowFor(t, f, 'Claude Code'),
    r.origin, r.folder ?? '', ...r.asks, r.what ?? '', r.reason, r.floor, ...r.notes,
    sayQueueTitle(t, f), sayDecided(t, f, 'allowed'), sayDecided(t, f, 'denied')]
}

describe('an enrollment, as main sends it (ADR-0134)', () => {
  it('Fabric itself is never "not connected": pendingFacts says connected, so Allow is plain Allow', () => {
    const f = enrolling()
    expect(f.connected).toBe(true)
    expect(sayAllow(tEn, f)).toBe('Allow')
    expect(sayAllowFor(tEn, f, 'Claude Code')).toBe('Allow Claude Code')
    expect(sayAllow(tRu, f)).toBe('Разрешить')
    // Defence in depth: even facts that say "not connected" never offer to connect Fabric.
    expect(sayAllow(tEn, { ...f, connected: false })).toBe('Allow')
    expect(sayAllowFor(tEn, { ...f, connected: false }, 'Claude Code')).toBe('Allow Claude Code')
    const p = consentPrompt(tEn, { ...f, connected: false })
    expect(p.buttons).toEqual(['Deny', 'Allow'])
    expect([p.defaultId, p.cancelId]).toEqual([0, 0])
    expect(consentPrompt(tRu, f).buttons).toEqual(['Отказать', 'Разрешить'])
  })
  it('names the agent and the project in the question, en and ru', () => {
    expect(consentPrompt(tEn, enrolling()).title).toBe('Let Claude Code work in Atlas?')
    expect(consentPrompt(tRu, enrolling()).title).toBe('Разрешить Claude Code работать в проекте «Atlas»?')
  })
  it('a project whose name is not known is "this project" in Russian too, never «без названия» (0.3.5 review UX-12)', () => {
    const named = enrolling()
    const unnamed = { ...named, enroll: { ...named.enroll!, projectName: '' } }
    const p = consentPrompt(tRu, unnamed)
    expect(p.title).toBe('Разрешить Claude Code работать в этом проекте?')
    expect(p.statement).toBe('Claude Code, открытый вне Fabric, просит работать в этом проекте')
    const said = [p.title, p.statement, p.detail, sayQueueTitle(tRu, unnamed), sayDecided(tRu, unnamed, 'allowed'), sayDecided(tRu, unnamed, 'denied')].join('\n')
    expect(said).not.toMatch(/без названия|«»/)
    expect(sayDecided(tRu, unnamed, 'allowed')).toBe('Claude Code: работа в этом проекте разрешена.')
    expect(consentPrompt(tEn, unnamed).title).toBe('Let Claude Code work in this project?')
    // A named project still reads as before, in both languages.
    expect(sayDecided(tRu, named, 'denied')).toBe('Claude Code: работать в проекте «Atlas» не разрешено.')
    expect(sayQueueTitle(tEn, named)).toBe('Claude Code asks to work in Atlas')
  })
  it('the origin is a coding agent by its name, never "an agent registered as" its id', () => {
    const f = enrolling()
    expect(sayOrigin(tEn, f.agent)).toBe('A coding agent: Claude Code')
    expect(sayOrigin(tRu, f.agent)).toBe('Агент для кода: Claude Code')
    expect(consentPrompt(tEn, f).detail.split('\n')[0]).toBe('A coding agent: Claude Code')
  })
  it('the ask is "work in <project>", in the card, the queue, a denial (askLines(row), as main builds it) and the prompt', () => {
    const f = enrolling()
    expect(sayRequest(tEn, f).asks).toEqual(['work in Atlas'])
    expect(sayAsk(tEn, askLines(enrollRow())[0])).toBe('work in Atlas')
    expect(tEn('access.denials.asked', { asks: sayAsk(tEn, askLines(enrollRow())[0]) })).toBe('asked to work in Atlas')
    expect(sayAsk(tRu, askLines(enrollRow())[0])).toBe('работать в проекте «Atlas»')
  })
  it('a grant says "works in <project>", named from the project list when main sends only the resource', () => {
    // index.ts builds a grant's line from the grant alone: askLines({ capabilities, resources })[0].
    const line = askLines({ capabilities: ['session.enroll'], resources: [`project:${PROJECT}`] })[0]
    expect(sayGrant(tEn, line, (id) => (id === PROJECT ? 'Atlas' : null))).toBe('works in Atlas')
    expect(sayGrant(tRu, line, () => 'Atlas')).toBe('работает в проекте «Atlas»')
    expect(sayGrant(tEn, line, () => null)).toBe('works in a project that is no longer in your list')
    expect(sayGrant(tEn, line, () => undefined)).toBe('works in a project whose name could not be read')
    expect(sayGrant(tEn, line)).toBe('works in a project whose name could not be read')
    // A product grant is said as before.
    expect(sayGrant(tEn, asked(['read_message'])[0])).toBe('read mail in news@example.com')
  })
  it('the folder is Fabric\'s own line, apart from the agent\'s quoted reason; home is ~', () => {
    const p = consentPrompt(tEn, enrolling())
    const lines = p.detail.split('\n')
    const folder = lines.indexOf('In the folder ~/code/atlas')
    const quoted = lines.findIndex((l) => l.startsWith('“'))
    expect(folder).toBeGreaterThanOrEqual(0)
    expect(quoted).toBeGreaterThan(folder)
    expect(lines[folder]).not.toContain('“')
    expect(sayRequest(tEn, enrolling()).folder).toBe('In the folder ~/code/atlas')
    expect(sayRequest(tRu, enrolling()).folder).toBe('В папке ~/code/atlas')
    expect(sayRequest(tEn, enrolling({ id: PROJECT, name: 'Atlas', root: '/Users/someone/code/atlas', how: 'ancestor' })).folder).toBe('In a folder inside ~/code/atlas')
    expect(sayRequest(tEn, enrolling({ id: PROJECT, name: 'Atlas', root: '/Users/someone/code/atlas', how: 'worktree' })).folder).toBe('In a worktree of the repository ~/code/atlas')
  })
  it('without root or how it degrades: no folder line, and nothing else changes', () => {
    for (const project of [{ id: PROJECT, name: 'Atlas' }, null]) {
      expect(consentPrompt(tEn, enrolling(project)).detail).not.toContain('In the folder')
      expect(sayRequest(tEn, enrolling(project)).folder).toBeNull()
    }
    expect(sayRequest(tEn, enrolling({ id: PROJECT, name: 'Atlas', root: '/Volumes/work/atlas' })).folder).toBe('In the folder /Volumes/work/atlas')
    // A row without a project name: "this project" — in ru never quoted as if it were the name.
    expect(consentPrompt(tEn, enrolling(null)).title).toBe('Let Claude Code work in this project?')
    expect(consentPrompt(tRu, enrolling(null)).title).not.toContain('«этот проект»')
  })
  it('the same-user floor is said for an enrollment, and the registry-install claim is not', () => {
    const f = enrolling()
    const floor = 'Fabric cannot prove this is Claude Code: any program running as you can ask under that name.'
    expect(consentPrompt(tEn, f).detail).toContain(floor)
    expect(sayRequest(tEn, f).floor).toBe(floor)
    expect(consentPrompt(tEn, f).detail).not.toContain('Fabric checked that an agent with this id is installed')
    expect(sayRequest(tRu, f).floor).toBe('Fabric не может доказать, что это Claude Code: любая программа, запущенная от вашего имени, может попросить под этим именем.')
    // A product request keeps its own floor.
    expect(sayRequest(tEn, pendingFacts({ ...enrollRow(), callee: 'fabric-inbox', capabilities: ['read_message'], resources: ['cloudflare:news@example.com'], registry }, true)).floor).toBe(en['access.floor'])
  })
  it('says how long it lasts — a year, unless revoked — in the prompt and on the card', () => {
    const f = enrolling()
    expect(consentPrompt(tEn, f).detail).toContain('for a year, unless you revoke it')
    expect(sayRequest(tEn, f).notes.join(' ')).toContain('for a year, unless you revoke it')
    expect(consentPrompt(tRu, f).detail).toContain('в течение года, если вы не отзовёте')
  })
  it('no machine id, no "registered as", no "connect" — anywhere, en and ru', () => {
    for (const t of [tEn, tRu]) for (const f of [enrolling(), enrolling(null), enrolling(undefined, { asked_by_binding: 'b1' })]) {
      const bad = everyWord(t, f).filter((w) => MACHINE_WORDS.test(w) || /[0-9a-f]{8}-[0-9a-f]{4}/.test(w))
      expect(bad).toEqual([])
    }
  })
  it('in ru nothing is English but the names', () => {
    const left = everyWord(tRu, enrolling()).join('\n')
      .split(enrollRow().reason).join(' ').split('~/code/atlas').join(' ')
      .split('Claude Code').join(' ').split('Atlas').join(' ').split('Fabric').join(' ')
    expect(left.match(/[A-Za-z]{3,}/g) ?? []).toEqual([])
  })
})

describe('shortFolder', () => {
  it('home is ~, a long path keeps its start and its last two folders, anything else is as it is', () => {
    expect(shortFolder('/Users/someone/code/atlas')).toBe('~/code/atlas')
    expect(shortFolder('/home/someone/code/atlas')).toBe('~/code/atlas')
    expect(shortFolder('/Users/someone')).toBe('~')
    expect(shortFolder('/Volumes/work/atlas')).toBe('/Volumes/work/atlas')
    const long = shortFolder('/Users/someone/' + 'very-long-folder-name/'.repeat(6) + 'client/atlas')
    expect(long).toBe('~/…/client/atlas')
    expect(shortFolder('/Users/someone/code/atlas', '/Users/someone/code')).toBe('~/atlas')
  })
})

// ADR-0149 §2: answering a Project's requests is asked in the operator's words — who, which capabilities, which
// project, what it may and may not do, how long — and never shows the machine's ids (board.respond, board:<uuid>/…).
const RESPOND_PROJECT = '0b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d'
const respondRow = (name: string | null = 'Atlas', over: Record<string, unknown> = {}) => ({
  id: 'r-respond', agent_id: 'codex', callee: 'fabric', capabilities: ['board.respond'],
  resources: [`board:${RESPOND_PROJECT}/analytics.retention`, `board:${RESPOND_PROJECT}/analytics.cohorts`],
  reason: 'I answer analytics requests', asked_by_binding: null, requested_at: '2026-10-13T00:00:00.000Z', expires_at: '2026-10-13T00:10:00.000Z',
  registry: { key: 'codex', kind: 'runner', name: 'Codex', installed_by: 'a coding agent on this computer', repository: null, ...(name === null ? {} : { project: { id: RESPOND_PROJECT, name, root: null, how: null } }) },
  ...over
})
describe('a responder grant, as main sends it (ADR-0149 §2)', () => {
  it('normalises exactly board.respond on 1–8 resources of one project, sorted; refuses anything else before a prompt', () => {
    const ok = normaliseAccessRequest({ agentId: 'codex', callee: 'fabric', capabilities: ['board.respond'], resources: [`board:${RESPOND_PROJECT}/b.x`, `board:${RESPOND_PROJECT}/a.x`], reason: 'answer' })
    expect(ok).toEqual({ ok: true, value: { agentId: 'codex', callee: 'fabric', capabilities: ['board.respond'], resources: [`board:${RESPOND_PROJECT}/a.x`, `board:${RESPOND_PROJECT}/b.x`], reason: 'answer' } })
    const bad = (resources: unknown, capabilities: unknown = ['board.respond']) => normaliseAccessRequest({ agentId: 'codex', callee: 'fabric', capabilities, resources, reason: 'answer' }).ok
    expect(bad([`board:${RESPOND_PROJECT}/a.x`, `board:1b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d/a.x`])).toBe(false)
    expect(bad(Array.from({ length: 9 }, (_, i) => `board:${RESPOND_PROJECT}/c${i}.x`))).toBe(false)
    expect(bad([`project:${RESPOND_PROJECT}`])).toBe(false)
    expect(bad([`board:${RESPOND_PROJECT}/__proto__`])).toBe(false)
    expect(bad([`board:${RESPOND_PROJECT}/a.x`], ['board.respond', 'session.enroll'])).toBe(false)
    expect(normaliseAccessRequest({ agentId: 'codex', callee: 'fabric-inbox', capabilities: ['board.respond'], resources: [`board:${RESPOND_PROJECT}/a.x`], reason: 'x' }).ok).toBe(false)
  })
  it('one line per ask: the project and its capabilities; facts say respond, never enroll; Allow is plain Allow', () => {
    const f = pendingFacts(respondRow(), false)
    expect(f.respond).toEqual({ projectName: 'Atlas', capabilities: ['analytics.cohorts', 'analytics.retention'] })
    expect(f.enroll).toBeUndefined()
    expect(askLines(respondRow())).toEqual([{ kind: 'respond', project: { id: RESPOND_PROJECT, name: 'Atlas' }, capabilities: ['analytics.cohorts', 'analytics.retention'] }])
    expect(sayAllow(tEn, f)).toBe('Allow')
    expect(consentPrompt(tEn, f).title).toBe('Let Codex answer analytics.cohorts and analytics.retention requests for Atlas?')
    expect(consentPrompt(tRu, f).title).toBe('Разрешить Codex отвечать на запросы analytics.cohorts и analytics.retention в проекте «Atlas»?')
    expect(sayGrant(tEn, askLines(respondRow())[0])).toBe('answer analytics.cohorts and analytics.retention requests for Atlas')
    expect(sayGrant(tEn, askLines(respondRow(null))[0], () => 'Atlas')).toBe('answer analytics.cohorts and analytics.retention requests for Atlas')
    expect(sayAsk(tEn, askLines(respondRow(null))[0])).toBe('answer analytics.cohorts and analytics.retention requests for this project')
  })
  it('Russian says where requests come FROM in the dative — «присылают проекту «Atlas»» / «этому проекту» — never the locative (wave-2 product finding 4)', () => {
    const named = pendingFacts(respondRow(), false), unnamed = pendingFacts(respondRow(null), false)
    expect(sayRequest(tRu, named).what).toContain('присылают проекту «Atlas»')
    expect(consentPrompt(tRu, named).statement).toContain('присылают проекту «Atlas»')
    expect(sayRequest(tRu, unnamed).what).toContain('присылают этому проекту')
    expect(consentPrompt(tRu, unnamed).statement).toContain('присылают этому проекту')
    for (const f of [named, unnamed]) {
      expect(sayRequest(tRu, f).what).not.toMatch(/присылают в /)
      expect(consentPrompt(tRu, f).statement).not.toMatch(/присылают в /)
    }
  })
  it('the detail line keeps the contract\'s caveat: the grant itself allows no spend, publish or delete, the agent keeps its own tools, a request is never an approval (wave-2 product finding 10)', () => {
    const f = pendingFacts(respondRow(), false)
    expect(consentPrompt(tEn, f).detail).toContain('This grant itself lets it spend, publish or delete nothing; it still has its own tools, and a request is never an approval.')
    expect(consentPrompt(tRu, f).detail).toContain('Само это разрешение не даёт ему ни тратить деньги, ни публиковать, ни удалять; свои инструменты у него остаются, а запрос никогда не одобрение.')
  })
  it('says nothing of the machine, and every Russian sentence is Russian once the untrusted values are gone', () => {
    for (const t of [tEn, tRu]) for (const row of [respondRow(), respondRow(null)]) {
      const f = pendingFacts(row, false)
      const p = consentPrompt(t, f), r = sayRequest(t, f)
      const words = [p.title, p.message, p.statement, p.detail, ...p.buttons, ...r.asks, r.what ?? '', r.floor, ...r.notes, sayQueueTitle(t, f), sayDecided(t, f, 'allowed'), sayDecided(t, f, 'denied')]
      for (const w of words) expect(w).not.toMatch(/board\.respond|board:|session\.enroll|project:/)
      if (t === tRu) for (const w of words) {
        const stripped = w.replace(/analytics\.(cohorts|retention)|Codex|Atlas|Fabric|I answer analytics requests/g, ' ')
        expect(stripped).not.toMatch(/[A-Za-z]{2,}/)
      }
    }
  })
})

// A console's system line (the owner, 2026-11-20): which account, which organisation, who started it, and where.
import { describe, expect, it } from 'vitest'
import { claudeProjectSlug, modelFromTranscriptTail, modelLabel, recordOf, sessionMeta, shortAccount, type SbSessionLite, type SwitchboardView } from './sessionMeta.ts'
import { parseAccounts, parseGroupOrgs, parseSessionLites, parseShellEnv, readOnlySwitchboardCall } from '../main/switchboardSessions.ts'
import type { Launch } from './sessionLaunches.ts'

const launch = (over: Partial<Launch> = {}): Launch => ({
  sessionId: 'f-1', projectId: 'p1', cwd: '/work/fabric', branch: 'main', runner: 'claude-code', optionId: 'claude-code', program: 'claude',
  by: 'person', via: 'screen', reason: null, parentSessionId: null, taskId: null, requestId: null, machine: 'mac', appPid: 1, appVersion: '0.3.27',
  pid: 2, startedAt: '2026-11-20T18:02:00.000Z', runnerSessionId: 'r-1', stopAskedBy: null, stopReason: null, endedAt: null, end: null, exitCode: null, signal: null, ...over
})
const console1 = { sessionId: 'f-1', cwd: '/work/fabric', runner: 'claude-code', startedAt: '2026-11-20T18:02:00.000Z', branch: 'feat/x', model: 'claude-opus-5-5' }
const lite = (over: Partial<SbSessionLite> = {}): SbSessionLite => ({ providerSessionId: null, folder: '/work/fabric', label: 'claude13@example.me', contextName: 'Org A', context: 'org:1', surface: null, launchedAt: null, ...over })
const view = (over: Partial<SwitchboardView> = {}): SwitchboardView => ({ sessions: [], routes: null, labels: null, groupOrg: null, folder: null, ...over })

describe('the line of a console', () => {
  it('takes the account and the organisation from the Switchboard record of the same coding-agent session', () => {
    const m = sessionMeta({ ...console1, launch: launch(), switchboard: view({ sessions: [lite({ providerSessionId: 'r-1' })] }) })
    expect(m.account).toEqual({ label: 'claude13@example.me', short: 'claude13@…', source: 'switchboard-session' })
    expect(m.context).toBe('Org A')
    expect(m.started).toEqual({ by: 'person', via: 'screen', at: '2026-11-20T18:02:00.000Z', parentSessionId: null })
    expect(m.handedOver).toBeNull()
    expect(m.runnerSessionId).toBe('r-1')
  })

  it('a console Fabric started in a group\'s folder runs on the group\'s route: that account, that organisation', () => {
    const m = sessionMeta({ ...console1, launch: launch(), switchboard: view({
      routes: { 'claude:pc': 'acc-38' }, labels: { 'acc-38': 'claude38@example.me' }, groupOrg: { pc: 'PassionCode.ai' }, folder: { pool: 'pc', context: 'org:1' }
    }) })
    expect(m.account).toEqual({ label: 'claude38@example.me', short: 'claude38@…', source: 'group-route' })
    expect(m.context).toBe('PassionCode.ai')
  })

  it('a session Switchboard handed over says so with its time, and Switchboard as who started it', () => {
    const at = Date.parse(console1.startedAt)
    const m = sessionMeta({ ...console1, launch: null, switchboard: view({ sessions: [lite({ surface: 'fallback', launchedAt: at + 5_000 })] }) })
    expect(m.handedOver).toEqual({ at: new Date(at + 5_000).toISOString() })
    expect(m.started?.by).toBe('switchboard')
  })

  it('matches by folder and time only when one record fits, and never guesses an account without Switchboard', () => {
    const at = Date.parse(console1.startedAt)
    expect(recordOf({ ...console1, launch: null }, [lite({ launchedAt: at + 30_000 })])).toBeNull()
    expect(recordOf({ ...console1, launch: null }, [lite({ launchedAt: at + 5_000 }), lite({ launchedAt: at - 5_000 })])).toBeNull()
    const none = sessionMeta({ ...console1, launch: launch(), switchboard: null })
    expect(none.account).toBeNull()
    expect(none.context).toBeNull()
    expect(none.folder).toBe('/work/fabric')
    expect(none.branch).toBe('feat/x')
  })

  it('a personal context reads as personal; a codex console takes the codex route', () => {
    const m = sessionMeta({ ...console1, runner: 'codex', launch: launch({ runnerSessionId: null }), switchboard: view({
      routes: { 'claude:me': 'a', 'codex:me': 'b' }, labels: { a: 'claude@example.me', b: 'codex@example.me' }, folder: { pool: 'me', context: 'personal' }
    }) })
    expect(m.account?.label).toBe('codex@example.me')
    expect(m.context).toBe('personal')
  })
})

describe('its words', () => {
  it('cuts an e-mail to its name and «@…», any other label at 18', () => {
    expect(shortAccount('claude13@example.me')).toBe('claude13@…')
    expect(shortAccount('team key (prod)')).toBe('team key (prod)')
    expect(shortAccount('a very long account label here')).toBe('a very long accou…')
  })
  it('names the model as a person reads it, from the newest assistant line of the transcript', () => {
    expect(modelLabel('claude-opus-5-5')).toBe('Opus 5.5')
    expect(modelLabel('claude-sonnet-5-5-20261001')).toBe('Sonnet 5.5')
    expect(modelLabel('gpt-6.2-sol')).toBe('gpt-6.2-sol')
    expect(modelLabel(null)).toBeNull()
    expect(modelFromTranscriptTail('{"model":"claude-sonnet-5-5"}\n{"message":{"model":"claude-opus-5-5"}}\n{"model":"<synthetic>"}')).toBe('claude-opus-5-5')
    expect(modelFromTranscriptTail('{"model":"claude-sonnet-5-5"}\n{"message":{"model":"claude-opus-5-5"}}')).toBe('claude-opus-5-5')
    expect(claudeProjectSlug('/work/fabric.app_1')).toBe('-work-fabric-app-1')
  })
})

describe('Switchboard\'s answers, as it gives them (switchboard 0.7.125, 2026-11-20)', () => {
  it('reads the session records with the coding agent\'s own id and who asked', () => {
    const out = JSON.stringify({ data: { sessions: [
      { working_directory: '/work/fabric', label: 'claude13@example.me', context: 'org:1', context_name: 'Org A', launched_at: 1795204637, provider_session_id: 'bb3992f1-6eef-42fb-a878-3a20fbc43909', launched_by: { surface: 'fallback' } },
      { working_directory: 'relative/no', label: 'x' }
    ] } })
    expect(parseSessionLites(out)).toEqual([{ providerSessionId: 'bb3992f1-6eef-42fb-a878-3a20fbc43909', folder: '/work/fabric', label: 'claude13@example.me', contextName: 'Org A', context: 'org:1', surface: 'fallback', launchedAt: 1795204637000 }])
    expect(parseSessionLites('not json')).toBeNull()
  })
  it('reads the routes and labels, the groups\' organisations and a folder\'s group', () => {
    expect(parseAccounts(JSON.stringify({ data: { routes: { 'claude:passioncode': 'id-38', 'bad key': 'x' }, accounts: [{ id: 'id-38', label: 'claude38@example.me', identity: { secret: 'never read' } }] } })))
      .toEqual({ routes: { 'claude:passioncode': 'id-38' }, labels: { 'id-38': 'claude38@example.me' } })
    expect(parseGroupOrgs(JSON.stringify({ data: { projects: [{ pool: 'passioncode', organization_name: 'PassionCode.ai' }, { pool: 'default', organization_name: null }] } }))).toEqual({ passioncode: 'PassionCode.ai' })
    expect(parseShellEnv('passioncode\torg:e2cb\t/work/sb/shell/claude-pc\t-\n')).toEqual({ pool: 'passioncode', context: 'org:e2cb', claudeHome: '/work/sb/shell/claude-pc' })
    expect(parseShellEnv('none\n')).toBeNull()
  })
  it('counts the line\'s reads as reads, and nothing that acts', () => {
    expect(readOnlySwitchboardCall(['--json', 'accounts', 'list'])).toBe(true)
    expect(readOnlySwitchboardCall(['--json', 'project', 'list'])).toBe(true)
    expect(readOnlySwitchboardCall(['--json', 'shell', 'env', '--dir', '/work'])).toBe(true)
    expect(readOnlySwitchboardCall(['--json', 'shell', 'env', '--dir', 'relative'])).toBe(false)
    expect(readOnlySwitchboardCall(['--json', 'shell', 'on'])).toBe(false)
    expect(readOnlySwitchboardCall(['--json', 'accounts', 'remove'])).toBe(false)
  })
})

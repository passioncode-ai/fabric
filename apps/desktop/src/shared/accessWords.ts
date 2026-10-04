// #region hub-consent-words — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#2-an-agent-is-admitted-by-device-style-consent-not-by-a-pasted-key
// Every sentence the operator consents on, phrased in the operator's language (verification iteration 1
// for 0.3.1, UX-2). Main sends FACTS (`shared/access.ts`: AgentFacts, AskLine, ConnectProblem, refusal
// codes); this module turns them into words through the i18n registries — the renderer with `useT()`,
// the native prompt in main with `translator(locale)` — so the queue, Settings → Agent access and the
// prompt say the same thing in the same language. Untrusted parts (ids, names, addresses, the reason)
// arrive already on one line (`oneLine`), and are only ever placed into a sentence, never parsed.
//
// THE CHECK: `accessWords.test.ts` phrases every kind of fact in ru and fails on any Latin word left once
// the untrusted values are removed — an English sentence carried from main, or a ru key missing (which
// falls back to en), turns it red.

import type { StringKey } from '../renderer/src/i18n/en.ts'
import type { AccessActRefusal } from './accessActs.ts'
import type { AgentFacts, AskLine, CapabilityRef, ConnectProblem, ResourceRef } from './access.ts'

export type Say = (key: StringKey, vars?: Record<string, string | number>) => string

export function sayCapability(t: Say, c: CapabilityRef): string {
  return c.known ? t(`access.cap.${c.id}` as StringKey) : t('access.cap.unknown', { name: c.id })
}

export function sayResource(t: Say, r: ResourceRef): string {
  if (r.kind === 'address') return r.address
  if (r.kind === 'gmail') return t('access.res.gmail', { id: r.id })
  return r.text
}

/** "a", "a and b", "a, b and c" — in the operator's language. */
export function sayList(t: Say, items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return t('access.list.and', { items: items.slice(0, -1).join(', '), last: items[items.length - 1] })
}

export function sayAsk(t: Say, line: AskLine): string {
  const resource = sayResource(t, line.resource)
  if (line.kind === 'inside') return t('access.ask.inside', { verbs: sayList(t, line.capabilities.map((c) => sayCapability(t, c))), resource })
  if (line.kind === 'setup-extra') return t('access.ask.setupExtra', { resource, verb: sayCapability(t, line.capability) })
  return t('access.ask.setup', { verb: sayCapability(t, line.capability), resource })
}

/** The agent's name as shown: the registry's, or its id — never both when there is no name (UX-11). */
export const shownName = (agent: AgentFacts): string => agent.name ?? agent.agentId

/** "An agent registered as <id> (installed by …; source …)". */
export function sayOrigin(t: Say, agent: AgentFacts): string {
  const id = agent.agentId
  if (agent.installedBy && agent.repository) return t('access.origin.both', { id, by: agent.installedBy, repo: agent.repository })
  if (agent.installedBy) return t('access.origin.by', { id, by: agent.installedBy })
  if (agent.repository) return t('access.origin.repo', { id, repo: agent.repository })
  return t('access.origin.plain', { id })
}

/** The same-user floor (ADR-0115 §2), said wherever the operator can answer a request. */
export const sayFloor = (t: Say): string => t('access.floor')
export const sayIncremental = (t: Say): string => t('access.incremental')

/** The queue row's title: "<name> asks to use <product>". */
export const sayQueueTitle = (t: Say, x: { agent: AgentFacts; product: string }): string =>
  t('access.queue.title', { name: shownName(x.agent), product: x.product })

/** The Allow button: plain, or "Allow and connect <product>" when Allow also opens the product (UX-4). */
export const sayAllow = (t: Say, x: { connected: boolean; product: string }): string =>
  x.connected ? t('access.allow') : t('access.allowConnect', { product: x.product })

export function sayActRefusal(t: Say, code: AccessActRefusal): string {
  return t(`access.refused.${code}` as StringKey)
}

/** Why connecting did not happen; the machine's own words, when there are any, come after. */
export function sayConnectProblem(t: Say, problem: ConnectProblem, product: string): string {
  const said = t(`access.connect.${problem.code}` as StringKey, { name: product, detail: problem.detail ?? '' })
  return problem.previousLost ? `${said} ${t('access.connect.previousLost', { name: product })}` : said
}

/**
 * The native prompt (ADR-0115 §2.3), in the operator's language. The agent is named as the REGISTRY
 * knows it, with where it came from; what it asks is said in the product's words; its reason is quoted
 * as its own claim, on one line; the same-user floor is said, not implied. Deny is the default and the
 * cancel answer.
 */
export function consentPrompt(t: Say, input: {
  agent: AgentFacts
  product: string
  ask: AskLine[]
  reason: string
  connected: boolean
  incremental: boolean
}): { title: string; message: string; detail: string; buttons: [string, string]; defaultId: 0; cancelId: 0 } {
  const name = shownName(input.agent)
  const product = input.product
  const detail = [
    t('access.prompt.asks', { origin: sayOrigin(t, input.agent) }),
    ...input.ask.map((l) => `• ${sayAsk(t, l)}`),
    '',
    t('access.prompt.reasonLead'),
    `“${input.reason}”`,
    '',
    sayFloor(t),
    '',
    input.incremental ? sayIncremental(t) : t('access.prompt.credential', { product }),
    t('access.lasts'),
    ...(input.connected ? [] : ['', t('access.prompt.notConnected', { product })])
  ].join('\n')
  return {
    title: t('access.prompt.title', { name, product }),
    message: t('access.prompt.message', { name, product }),
    detail,
    buttons: [t('access.deny'), sayAllow(t, input)],
    defaultId: 0,
    cancelId: 0
  }
}
// #endregion hub-consent-words

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
import type { AgentFacts, AskLine, CapabilityRef, ConnectProblem, EnrollFacts, FolderHow, ResourceRef, RespondFacts } from './access.ts'

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
  // #region enroll-words — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
  if (line.kind === 'enroll') return line.project.name ? t('access.ask.enroll', { project: line.project.name }) : t('access.ask.enrollThis')
  // #endregion enroll-words
  // #region board-respond-words — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#2-responding-is-a-standing-grant-of-its-own
  if (line.kind === 'respond')
    return line.project.name ? t('access.ask.respond', { capabilities: sayList(t, line.capabilities), project: line.project.name }) : t('access.ask.respondThis', { capabilities: sayList(t, line.capabilities) })
  // #endregion board-respond-words
  const resource = sayResource(t, line.resource)
  if (line.kind === 'inside') return t('access.ask.inside', { verbs: sayList(t, line.capabilities.map((c) => sayCapability(t, c))), resource })
  if (line.kind === 'setup-extra') return t('access.ask.setupExtra', { resource, verb: sayCapability(t, line.capability) })
  return t('access.ask.setup', { verb: sayCapability(t, line.capability), resource })
}

/** The agent's name as shown: the registry's, or its id — never both when there is no name (UX-11). */
export const shownName = (agent: AgentFacts): string => agent.name ?? agent.agentId

/**
 * A grant in "Agents with access": a product grant as its ask line; an enrollment as "works in <project>". Main
 * builds a grant's line from the grant alone, so the project is named through `nameOf` — the project list the
 * screen read: a name, `null` when the list was read and the project is not in it, `undefined` when it was not read.
 */
export function sayGrant(t: Say, line: AskLine, nameOf?: (projectId: string) => string | null | undefined): string {
  // #region enroll-words — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
  if (line.kind === 'respond') {
    const shown = line.project.name ?? nameOf?.(line.project.id)
    return shown ? t('access.ask.respond', { capabilities: sayList(t, line.capabilities), project: shown }) : t('access.ask.respondThis', { capabilities: sayList(t, line.capabilities) })
  }
  if (line.kind !== 'enroll') return sayAsk(t, line)
  const name = line.project.name ?? nameOf?.(line.project.id)
  if (name) return t('access.grant.enroll', { project: name })
  return t(name === null ? 'access.grant.enrollGone' : 'access.grant.enrollUnread')
  // #endregion enroll-words
}

/** "An agent registered as <id> (installed by …; source …)" — or, for a coding agent of the runner catalogue
 *  (ADR-0134), "A coding agent: <name>": its registry id and Fabric's own installed-by words are not its origin. */
export function sayOrigin(t: Say, agent: AgentFacts): string {
  if (agent.codingAgent) return t('access.origin.coding', { name: shownName(agent) })
  const id = agent.agentId
  if (agent.installedBy && agent.repository) return t('access.origin.both', { id, by: agent.installedBy, repo: agent.repository })
  if (agent.installedBy) return t('access.origin.by', { id, by: agent.installedBy })
  if (agent.repository) return t('access.origin.repo', { id, repo: agent.repository })
  return t('access.origin.plain', { id })
}

/** The same-user floor (ADR-0115 §2), said wherever the operator can answer a request. For an enrollment it is
 *  said of the name the agent asked under: no registry entry was checked, so nothing is claimed about one. */
export const sayFloor = (t: Say, x?: { agent: AgentFacts; enroll?: EnrollFacts; respond?: RespondFacts }): string =>
  x?.enroll || (x?.respond && x.agent.codingAgent) ? t('access.enroll.floor', { name: shownName(x.agent) }) : t('access.floor')
export const sayIncremental = (t: Say): string => t('access.incremental')

/** The project an enrollment names, as the slot `{project}` of the enrollment sentences takes it: "Atlas" / "this
 *  project" in English, «в проекте «Atlas»» / «в этом проекте» in Russian — so a project whose name is not known reads
 *  as this project in both, never «без названия» (0.3.5 review UX-12). */
const projectWords = (t: Say, name: string): string => (name ? t('access.enroll.projectNamed', { name }) : t('access.enroll.thisProject'))
/** The project requests are sent TO (wave-2 product finding 4): its own form, because Russian needs the dative there
 *  («присылают проекту «Atlas»»), where the enroll form is the locative («в проекте «Atlas»»). */
const projectTo = (t: Say, name: string): string => (name ? t('access.respond.projectTo', { name }) : t('access.respond.thisProjectTo'))

/** The queue row's title: "<name> asks to use <product>", or for an enrollment (ADR-0134) "<name> asks to work in <project>". */
export const sayQueueTitle = (t: Say, x: { agent: AgentFacts; product: string; enroll?: { projectName: string }; respond?: RespondFacts }): string =>
  x.respond
    ? t('access.queue.respondTitle', { name: shownName(x.agent), project: projectWords(t, x.respond.projectName) })
    : x.enroll
    ? t('access.queue.enrollTitle', { name: shownName(x.agent), project: projectWords(t, x.enroll.projectName) })
    : t('access.queue.title', { name: shownName(x.agent), product: x.product })

/**
 * What the operator decided, named (CO-207): "You allowed X to use Y", "You denied X access to Y" — or, for a
 * coding agent's enrollment (ADR-0134), "You let X work in P". The queue row and SCR-76 say the same sentence.
 */
export function sayDecided(t: Say, x: { agent: AgentFacts; product: string; enroll?: { projectName: string }; respond?: RespondFacts }, decision: 'allowed' | 'denied'): string {
  const name = shownName(x.agent)
  if (x.respond) {
    const project = projectWords(t, x.respond.projectName)
    return t(decision === 'allowed' ? 'access.queue.responded' : 'access.queue.respondDenied', { name, project })
  }
  if (x.enroll) {
    const project = projectWords(t, x.enroll.projectName)
    return t(decision === 'allowed' ? 'access.queue.enrolled' : 'access.queue.enrollDenied', { name, project })
  }
  return t(decision === 'allowed' ? 'access.queue.allowed' : 'access.queue.denied', { name, product: x.product })
}

/** Whether Allow also opens the product's connect flow. Never for an enrollment: Fabric itself is not connected. */
const opensConnect = (x: { connected: boolean; enroll?: EnrollFacts; respond?: RespondFacts }): boolean => !x.connected && !x.enroll && !x.respond

/** The Allow button: plain, or "Allow and connect <product>" when Allow also opens the product (UX-4). */
export const sayAllow = (t: Say, x: { connected: boolean; product: string; enroll?: EnrollFacts; respond?: RespondFacts }): string =>
  opensConnect(x) ? t('access.allowConnect', { product: x.product }) : t('access.allow')

/** The Allow button's accessible name: its visible words, then whose request it answers — "label in name",
 *  so a screen reader hears that Allow also connects the product and voice control can say what it reads
 *  (verification iteration 2 for 0.3.1, UX-8). */
export const sayAllowFor = (t: Say, x: { connected: boolean; product: string; enroll?: EnrollFacts; respond?: RespondFacts }, name: string): string =>
  opensConnect(x) ? t('access.allowConnectFor', { product: x.product, name }) : t('access.allowFor', { name })

// #region enroll-words — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
const FOLDER_KEY: Record<FolderHow, 'access.enroll.folder' | 'access.enroll.folderInside' | 'access.enroll.folderWorktree'> = {
  exact: 'access.enroll.folder', ancestor: 'access.enroll.folderInside', worktree: 'access.enroll.folderWorktree'
}
/** Fabric's own line about where the agent works: the folder it resolved the project by (never the agent's words). */
export const sayFolder = (t: Say, folder: NonNullable<EnrollFacts['folder']>): string => t(FOLDER_KEY[folder.how ?? 'exact'], { root: folder.root })
const projectOf = (t: Say, enroll: EnrollFacts): string => projectWords(t, enroll.projectName)
// #endregion enroll-words

/**
 * A waiting request in words, for the two screens that answer it beside the native prompt — the card in Settings →
 * Agent access (SCR-76) and the row in the attention queue — so both say the prompt's facts, in the same order:
 * who asks, where (an enrollment's folder, Fabric's own line), what, what it gets, the agent's reason as its claim,
 * the same-user floor, then what the answer does and how long it lasts.
 */
export function sayRequest(t: Say, x: { agent: AgentFacts; ask: AskLine[]; reason: string; incremental: boolean; enroll?: EnrollFacts; respond?: RespondFacts }): {
  origin: string; folder: string | null; asks: string[]; what: string | null; reason: string; floor: string; notes: string[]
} {
  // ADR-0149 §2: answering a Project's requests — what it may do, what it may not, and how long it lasts.
  if (x.respond) {
    return {
      origin: sayOrigin(t, x.agent),
      folder: null,
      asks: x.ask.map((l) => sayAsk(t, l)),
      what: t('access.respond.what', { project: projectTo(t, x.respond.projectName) }),
      reason: t('access.pending.reason', { reason: x.reason }),
      floor: sayFloor(t, x),
      notes: [...(x.incremental ? [sayIncremental(t)] : []), t('access.respond.revoke'), t('access.denyStands')]
    }
  }
  const enroll = x.enroll
  return {
    origin: sayOrigin(t, x.agent),
    folder: enroll?.folder ? sayFolder(t, enroll.folder) : null,
    asks: enroll && x.ask.length === 0 ? [t('access.ask.enrollThis')] : x.ask.map((l) => sayAsk(t, l)),
    what: enroll ? t('access.enroll.what', { project: projectOf(t, enroll) }) : null,
    reason: t('access.pending.reason', { reason: x.reason }),
    floor: sayFloor(t, x),
    notes: [
      ...(x.incremental ? [sayIncremental(t)] : []),
      enroll ? t('access.enroll.revoke', { name: shownName(x.agent), project: projectOf(t, enroll) }) : t('access.lasts'),
      t('access.denyStands')
    ]
  }
}

export function sayActRefusal(t: Say, code: AccessActRefusal): string {
  return t(`access.refused.${code}` as StringKey)
}

/** Why connecting did not happen, in the operator's language only. The machine's own words, when there are
 *  any, are NOT placed inside this sentence (iteration 2, UX-5): `sayConnectDetail` gives them a line of
 *  their own, introduced as what Fabric saw. */
export function sayConnectProblem(t: Say, problem: ConnectProblem, product: string): string {
  const said = t(`access.connect.${problem.code}` as StringKey, { name: product })
  return problem.previousLost ? `${said} ${t('access.connect.previousLost', { name: product })}` : said
}

/** The machine's words behind a connect problem, as their own secondary line; null when there are none. */
export function sayConnectDetail(t: Say, problem: ConnectProblem): string | null {
  return problem.detail ? t('access.saw', { detail: problem.detail }) : null
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
  enroll?: EnrollFacts
  respond?: RespondFacts
}): { title: string; message: string; statement: string; detail: string; buttons: [string, string]; defaultId: 0; cancelId: 0 } {
  const name = shownName(input.agent)
  // ADR-0134: a coding agent asks to work in a project — not a product, not a mailbox.
  // #region enroll-words — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
  // Who asks and the folder are Fabric's own lines, apart from the agent's quoted reason; the floor is said of the
  // name it asked under; how long it lasts is said; Deny stays the default and the cancel answer.
  if (input.enroll) {
    const project = projectOf(t, input.enroll)
    const said = sayRequest(t, input)
    return {
      title: t('access.enroll.title', { name, project }),
      message: t('access.enroll.title', { name, project }),
      statement: t('access.enroll.message', { name, project }),
      detail: [
        said.origin,
        ...(said.folder ? [said.folder] : []),
        said.what as string,
        '',
        t('access.prompt.reasonLead'),
        t('access.prompt.quoted', { reason: input.reason }),
        '',
        said.floor,
        '',
        ...said.notes
      ].join('\n'),
      buttons: [t('access.deny'), t('access.allow')],
      defaultId: 0,
      cancelId: 0
    }
  }
  // #endregion enroll-words
  // #region board-respond-words — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#2-responding-is-a-standing-grant-of-its-own
  if (input.respond) {
    const project = projectWords(t, input.respond.projectName)
    const capabilities = sayList(t, input.respond.capabilities)
    const said = sayRequest(t, input)
    return {
      title: t('access.respond.title', { name, capabilities, project }),
      message: t('access.respond.title', { name, capabilities, project }),
      statement: t('access.respond.message', { name, project: projectTo(t, input.respond.projectName) }),
      detail: [said.origin, said.what as string, '', t('access.prompt.reasonLead'), t('access.prompt.quoted', { reason: input.reason }), '', said.floor, '', ...said.notes].join('\n'),
      buttons: [t('access.deny'), t('access.allow')],
      defaultId: 0,
      cancelId: 0
    }
  }
  // #endregion board-respond-words
  const product = input.product
  const detail = [
    t('access.prompt.asks', { origin: sayOrigin(t, input.agent) }),
    ...input.ask.map((l) => `• ${sayAsk(t, l)}`),
    '',
    t('access.prompt.reasonLead'),
    t('access.prompt.quoted', { reason: input.reason }),
    '',
    sayFloor(t),
    '',
    input.incremental ? sayIncremental(t) : t('access.prompt.credential', { product }),
    t('access.lasts'),
    t('access.denyStands'),
    ...(input.connected ? [] : ['', t('access.prompt.notConnected', { product, allow: sayAllow(t, input) })])
  ].join('\n')
  return {
    title: t('access.prompt.title', { name, product }),
    // macOS draws no title on a message box, so the bold line is the QUESTION (iteration 2, UX-11); the
    // statement is what a notification says when the window is not in front.
    message: t('access.prompt.title', { name, product }),
    statement: t('access.prompt.message', { name, product }),
    detail,
    buttons: [t('access.deny'), sayAllow(t, input)],
    defaultId: 0,
    cancelId: 0
  }
}
// #endregion hub-consent-words

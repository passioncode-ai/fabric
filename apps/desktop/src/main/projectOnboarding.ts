// #region project-onboarding — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
// W2-7 (OF-31, SCN-171): adding a project files ONE onboarding task, with a brief whose three parts are written, so the
// intake rule of ADR-0176 is met before anyone starts it. Pure: the id, the words and the instruction are decided here;
// `main/projectAdmission.ts` calls the host that files them (`main/index.ts`). The task waits in the queue until the person or a routine starts it (starting
// agents by itself is CO-409's wake, 0.4.0).
import { createHash } from 'node:crypto'

/**
 * The onboarding task's id, derived from the project's, so a retried admission or a second press of «Познакомиться с
 * проектом» names the same task and never files a second one. A UUID in the journal's canonical spelling (lower-case,
 * 8-4-4-4-12, version 4 and variant bits set), from sha256 of a fixed prefix and the project id.
 */
export function onboardingTaskId(projectId: string): string {
  const h = createHash('sha256').update(`fabric:onboarding:${projectId.toLowerCase()}`).digest('hex')
  const v = '4' + h.slice(13, 16)
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${v}-${variant}-${h.slice(20, 32)}`
}

export interface OnboardingTask {
  title: string
  /** What the agent is told: the prompt, in English like every instruction Fabric writes for an agent. */
  instruction: string
  brief: { what: string; why: string; expected: string }
}

/** The task in the working language (the interface's locale); anything unknown is English, as the interface is. */
export function onboardingTask(projectName: string, locale: string | null | undefined): OnboardingTask {
  const name = projectName.trim()
  const instruction =
    `Get to know the project "${name}" and record what it is with fabric_project_profile. ` +
    'Read its repositories (README, docs, the default branch\'s recent history, the remotes), its backlog or roadmap if it ' +
    'has one, and the project board (com.list) for threads that name it. Then record: the goal (what it is for and what it ' +
    'aims at now), a one-line summary, the business it belongs to (the GitHub owner or organization, or the company the ' +
    'README names), the plan (what is done, what comes next, from its backlog), and its relations to other projects ' +
    '(what it depends on, what uses it, who it talks to on the board). The business is the person\'s: record it only while ' +
    'the project has none and the person never set or cleared one; if one is already set, or the person left it empty, leave business out, and if yours differs, say so in a note on this task ' +
    'rather than change it (the person sets it on the project page). Write in the working language fabric_whoami names. ' +
    'Change nothing in the repository: this task only reads and records. If something cannot be found, leave that field ' +
    'out rather than guess, and say so in a note on this task.'
  if (locale === 'ru')
    return {
      title: `Познакомиться с проектом ${name}`,
      instruction,
      brief: {
        what: `Агент читает проект «${name}» и записывает его профиль: цель, одну строку о том, что это, бизнес, план и связи с другими проектами.`,
        why: 'Чтобы страница проекта показывала цель, команду и план, а доска знала, к какому бизнесу проект относится (стена между бизнесами).',
        expected: 'Профиль проекта записан и виден на его странице; в репозитории ничего не изменено; то, чего найти не удалось, названо в заметке к задаче.'
      }
    }
  return {
    title: `Get to know the project ${name}`,
    instruction,
    brief: {
      what: `An agent reads the project "${name}" and records its profile: its goal, a one-line summary, its business, its plan and its relations to other projects.`,
      why: 'So the project page shows its goal, team and plan, and the board knows which business the project belongs to (the wall between businesses).',
      expected: 'The profile is recorded and shown on the project page; nothing in the repository changed; whatever could not be found is named in a note on the task.'
    }
  }
}

/** What filing the onboarding task needs from the host (`main/index.ts`): its journal and its task read. */
export interface OnboardingFilerDeps {
  /** The task by id: null when it does not exist; its three brief parts as stored (null or empty when unwritten). */
  readTask(taskId: string): Promise<{ brief: { what: string | null; why: string | null; expected: string | null } } | null>
  /** Appends one event as Fabric's own act (`fabric-onboarding`) in the project. */
  append(event: { type: 'task.created@1' | 'task.brief.edited@1'; projectId: string; payload: Record<string, unknown> }): Promise<unknown>
  /** The interface's language, or null when unknown. */
  locale(): string | null
  /** Records a failure; the filer throws it on afterwards. */
  failed(e: unknown, detail: { projectId: string; taskId: string }): void
}

/**
 * DA-5 / ER-6: files a project's onboarding task as one act. The task absent, it is created with its three brief parts;
 * present with a part still empty (an earlier filing stopped after the creation), the missing parts are written, so the
 * intake rule of ADR-0176 is met in the end; whole, nothing is written. Two presses for one project at once (the
 * admission and the page's button) run one after the other, so the second finds the first's task and journals nothing
 * twice. Every failure, a refused read included, is recorded through `failed` before it is thrown.
 */
export function createOnboardingFiler(deps: OnboardingFilerDeps): (projectId: string, name: string) => Promise<{ taskId: string; filed: boolean }> {
  const queue = new Map<string, Promise<unknown>>()
  const file = async (projectId: string, name: string): Promise<{ taskId: string; filed: boolean }> => {
    const taskId = onboardingTaskId(projectId)
    try {
      const existing = await deps.readTask(taskId)
      const task = onboardingTask(name, deps.locale())
      if (!existing)
        await deps.append({ type: 'task.created@1', projectId,
          payload: { id: taskId, title: task.title, instruction: task.instruction, origin: { kind: 'observation', ref: `project:${projectId}` }, section: null, task_type: 'development' } })
      for (const section of ['what', 'why', 'expected'] as const)
        if (!existing || !existing.brief[section]?.trim())
          await deps.append({ type: 'task.brief.edited@1', projectId, payload: { task_id: taskId, section, body_md: task.brief[section] } })
      return { taskId, filed: !existing }
    } catch (e) {
      deps.failed(e, { projectId, taskId })
      throw e
    }
  }
  return (projectId, name) => {
    const key = projectId.toLowerCase()
    const run = (queue.get(key) ?? Promise.resolve()).then(() => file(projectId, name), () => file(projectId, name))
    const settled = run.then(() => undefined, () => undefined)
    queue.set(key, settled)
    void settled.then(() => { if (queue.get(key) === settled) queue.delete(key) })
    return run
  }
}

// #region project-profile-lock — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
/**
 * 0.3.12 review i2 ER-2 / DA-1: the person's precedence over a project's business is a read, a decision and an append;
 * an agent's write landing between another writer's read and append would replace the person's business. Every
 * business-touching profile write runs in this process (the person's from the project page, an agent's through the
 * hub's `fabric_project_profile`), so one chain per project serializes them: each one reads, decides and appends while
 * no other business-touching write of that project runs. A failed write does not hold the chain.
 */
export function createProjectProfileLock(): <T>(projectId: string, work: () => Promise<T>) => Promise<T> {
  const chains = new Map<string, Promise<unknown>>()
  return <T>(projectId: string, work: () => Promise<T>): Promise<T> => {
    const key = projectId.toLowerCase()
    const run = (chains.get(key) ?? Promise.resolve()).then(work, work)
    const settled = run.then(() => undefined, () => undefined)
    chains.set(key, settled)
    void settled.then(() => { if (chains.get(key) === settled) chains.delete(key) })
    return run
  }
}

/** The one chain of this process: `writePersonBusiness` and `writeAgentProfile` both take it. */
export const projectProfileLock = createProjectProfileLock()
// #endregion project-profile-lock

/**
 * DA-9: the person's business, from the project page. Always applies (DA-2), but only to a project this estate holds:
 * the project is read first, so a stale id from a window is refused in plain words and nothing is journaled (a profile
 * for a project nobody holds would be a no-op in the journal, or a raw foreign-key refusal when it names relations).
 */
export async function writePersonBusiness<Row>(deps: {
  readProject(projectId: string): Promise<{ row: Row | null; error: string | null }>
  append(payload: { business: string }): Promise<unknown>
  /** The per-project chain (ER-2); `projectProfileLock` unless a test gives its own. */
  lock?: <T>(projectId: string, work: () => Promise<T>) => Promise<T>
}, projectId: string, business: unknown): Promise<Row> {
  if (typeof business !== 'string' || business.length > 80) throw new Error('a business is a short name, at most 80 characters')
  return (deps.lock ?? projectProfileLock)(projectId, () => personBusinessUnlocked(deps, projectId, business))
}

async function personBusinessUnlocked<Row>(deps: {
  readProject(projectId: string): Promise<{ row: Row | null; error: string | null }>
  append(payload: { business: string }): Promise<unknown>
}, projectId: string, business: string): Promise<Row> {
  const before = await deps.readProject(projectId)
  if (before.error) throw new Error(`the project could not be read: ${before.error}`)
  if (!before.row) throw new Error('this project is not in this estate (it may have been removed); the business was not recorded')
  await deps.append({ business: business.trim() })
  const after = await deps.readProject(projectId)
  if (after.error || !after.row) throw new Error(`the project could not be read back: ${after.error ?? 'no row'}`)
  return after.row
}

/**
 * DA-2 / ER-2 (decided 2026-10-24): a project's business is the person's, because the board's wall between businesses
 * reads it and the party it walls must not be able to take it down. An agent's profile may set `business` only while
 * the project has none recorded; an empty one is refused (an agent never clears it); a different one while one is set
 * is refused with the person's route; the same one (without case and surrounding spaces) is dropped so the person's
 * spelling stays. The person's write from the project page is not judged here: it always applies.
 */
export type AgentProfileVerdict =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; reason: string }

export function agentProfilePayload(args: Record<string, unknown>, current: { business: string | null; personSet?: boolean } | null): AgentProfileVerdict {
  const payload: Record<string, unknown> = {}
  for (const key of ['goal', 'summary', 'business', 'plan', 'relations'] as const)
    if (args[key] !== undefined) payload[key] = args[key]
  if (Object.keys(payload).length === 0) return { ok: false, reason: 'name at least one field' }
  if (payload.business === undefined) return { ok: true, payload }
  const asked = String(payload.business).trim()
  if (asked === '')
    return { ok: false, reason: 'an agent cannot clear a project\'s business: the person sets the business on the project page. Call again without business.' }
  if (current === null)
    return { ok: false, reason: 'the project\'s business could not be read, so it was not changed. Call again without business, or later.' }
  const set = current.business?.trim() ?? ''
  // 0.3.12 review i2 DA-2: once the person wrote the business (a value, or cleared it), an agent never sets one: a
  // project the person left without a business stays without one.
  if (set === '' && current.personSet)
    return { ok: false, reason: 'the person left this project without a business on purpose, and only the person sets it: the person sets the business on the project page. Call again without business.' }
  if (set === '') return { ok: true, payload: { ...payload, business: asked } }
  if (set.toLowerCase() === asked.toLowerCase()) {
    const { business: _same, ...rest } = payload
    return Object.keys(rest).length ? { ok: true, payload: rest } : { ok: false, reason: `the project's business is already "${set}"; nothing else was named` }
  }
  return { ok: false, reason: `this project's business is already recorded as "${set}", and only the person changes it: the person sets the business on the project page. Call again without business, and say in a note on your task why you think it is "${asked}".` }
}
/** What an agent's profile write needs from the hub (`fabric_project_profile` in `main/agentSurface.ts`). */
export interface AgentProfileDeps {
  /** The project's business as the projection holds it; `row` null when the estate does not hold the project. */
  readProject(): Promise<{ row: { business: string | null } | null; error: string | null }>
  /** Whether a person ever wrote this project's business (a `project.profiled@1` naming `business`, by a person). */
  readPersonSet(): Promise<{ set: boolean; error: string | null }>
  append(payload: Record<string, unknown>): Promise<{ seq: number | string }>
  /** Records a read that failed; the call then refuses a business it names and lets the other fields through. */
  failed(what: 'project-business-read' | 'project-business-owner-read', error: string): void
  lock?: <T>(projectId: string, work: () => Promise<T>) => Promise<T>
}

/**
 * The agent's half of W2-4 (DA-2 / ER-2): reads the project's business and whether a person ever wrote it, decides with
 * `agentProfilePayload` and appends, all under the project's chain when the call names a business, so the person's
 * write can land only before the read or after the append (0.3.12 review i2 ER-2, DA-1). DA-9: a project this estate no
 * longer holds is refused in plain words, before anything is journaled.
 */
export async function writeAgentProfile(deps: AgentProfileDeps, projectId: string, args: Record<string, unknown>):
  Promise<{ written: true; fields: string[]; seq: number | string } | { written: false; reason: string }> {
  const work = async (): Promise<{ written: true; fields: string[]; seq: number | string } | { written: false; reason: string }> => {
    let current: { business: string | null; personSet?: boolean } | null
    const project = await deps.readProject()
    if (project.error) { deps.failed('project-business-read', project.error); current = null }
    else if (!project.row) return { written: false, reason: 'this project is not in this estate any more (it may have been removed); nothing was recorded' }
    else current = { business: project.row.business ?? null }
    if (current && args.business !== undefined) {
      const owner = await deps.readPersonSet()
      if (owner.error) { deps.failed('project-business-owner-read', owner.error); current = null }
      else current = { ...current, personSet: owner.set }
    }
    const verdict = agentProfilePayload(args, current)
    if (!verdict.ok) return { written: false, reason: verdict.reason }
    const event = await deps.append(verdict.payload)
    return { written: true, fields: Object.keys(verdict.payload), seq: event.seq }
  }
  return args.business === undefined ? work() : (deps.lock ?? projectProfileLock)(projectId, work)
}
// #endregion project-onboarding

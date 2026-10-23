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
    'the project has none; if one is already set, leave business out, and if yours differs, say so in a note on this task ' +
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

export function agentProfilePayload(args: Record<string, unknown>, current: { business: string | null } | null): AgentProfileVerdict {
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
  if (set === '') return { ok: true, payload: { ...payload, business: asked } }
  if (set.toLowerCase() === asked.toLowerCase()) {
    const { business: _same, ...rest } = payload
    return Object.keys(rest).length ? { ok: true, payload: rest } : { ok: false, reason: `the project's business is already "${set}"; nothing else was named` }
  }
  return { ok: false, reason: `this project's business is already recorded as "${set}", and only the person changes it: the person sets the business on the project page. Call again without business, and say in a note on your task why you think it is "${asked}".` }
}
// #endregion project-onboarding

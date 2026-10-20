// #region act-words — docs: docs/ux/scenarios.md#scn-169-undo-an-act-or-read-why-it-cannot-be-undone
/**
 * An act in the person's words (ADR-0160 §2, plan §4; 0.3.7 wave 3). The record carries a sentence key and its
 * words (`said`), worded here in the person's language; a task's state is a column name the person reads («Очередь»,
 * «Проверить»), never `review`; a reason an undo was refused is our sentence, never its code. A name the record does
 * not carry is a word («без названия»), never «null».
 */
import type { ActRecord } from '../../../shared/acts.ts'
import { AGENTS } from '../../../shared/agents.ts'
import { runnerLabel } from '../runnerLabel'
import type { StringKey } from '../i18n/en'
import type { Translate } from '../i18n'

const KNOWN_SAID = new Set([
  'act.task.move', 'act.task.close', 'act.claim.release', 'act.claim.take', 'act.repo.detach', 'act.repo.attach',
  'act.project.rename', 'act.project.edit', 'act.question.answer', 'act.question.reopen', 'act.session.stop',
  'act.session.start', 'act.draft.discard', 'act.draft.restore', 'act.release.record', 'act.agent.disconnect',
  'act.agent.let_in', 'act.run.attest', 'act.run.unattest'
])
const STATES = new Set(['backlog', 'running', 'review', 'done', 'cancelled'])
const WHY = new Set([
  'already_undone', 'not_an_act', 'unavailable', 'failed', 'write_failed', 'invalid_estate', 'task_closed', 'published',
  'delivered', 'credential_gone', 'answer_needs_person', 'task_gone', 'already_there', 'ladder', 'claim_gone',
  'already_released', 'already_held', 'held_by_other', 'owner_gone', 'runner_gone', 'folder_gone', 'already_attached',
  'held_by_other_project', 'project_gone', 'question_gone', 'not_answered', 'draft_gone', 'session_gone', 'agent_gone',
  'already_in', 'already_out', 'invalid', 'unreadable', 'no_inverse', 'run_gone', 'run_resolved', 'not_attested',
  'task_moved_on', 'run_still_running', 'person_required', 'already_attested'
])

/** The act as one sentence; an undo says it undid something («Отменено: …»). */
export function actSentence(t: Translate, record: ActRecord): string {
  const params: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(record.said.params)) {
    if (v === null || v === '') params[k] = k === 'agent' ? t('acts.actor.agent') : t('act.untitled')
    else if ((k === 'to' || k === 'from') && typeof v === 'string' && STATES.has(v)) params[k] = t(`act.state.${v}` as StringKey)
    else params[k] = v
  }
  // A console's runner is worded here, in the person's language (0.3.7 review UX-6): the record carries its id
  // (`runner`); a record from before carries only the name main baked, which is mapped back to its runner when it is
  // one («Terminal» is «Терминал»), and a created agent's uuid is never shown.
  const runner = record.said.params.runner
  const baked = record.said.params.agent
  if (typeof runner === 'string' && runner) {
    params.agent = runnerLabel(runner, t, typeof baked === 'string' && baked && baked !== runner ? { [runner]: baked } : undefined)
  } else if (typeof baked === 'string' && baked) {
    const known = AGENTS.find((a) => a.id === baked || a.label === baked)
    params.agent = known ? runnerLabel(known.id, t) : runnerLabel(baked, t)
  }
  // A sentence names an agent when it has one; the disconnect of wave 2 recorded none.
  if (!('agent' in params)) params.agent = record.subject.label ?? t('acts.actor.agent')
  const key = KNOWN_SAID.has(record.said.key) ? (record.said.key as StringKey) : null
  const sentence = key ? t(key, params) : (record.subject.label ?? t('act.untitled'))
  return record.undoes !== null ? `${t('act.undonePrefix')} ${sentence}` : sentence
}

/** Why an undo is not possible, or was refused, in our words; an unknown code is a general sentence, never the code. */
export function whyWords(t: Translate, code: string): string {
  return WHY.has(code) ? t(`act.why.${code}` as StringKey) : t('act.why.other')
}
// #endregion act-words

/** Bootstrap privacy boundary. This roster is exact-versioned and deliberately
 * distinct from identity authorization and database/domain validation. */
import type { Journal } from '@fabric/journal'
import { createPreparedJournal, CommandIngressError } from './commandIngressAdapters.ts'
import { prepareOriginalInstruction, prepareEventPayload } from '../shared/commandIngress.ts'
import { readIdea } from '../shared/idea.ts'
import { redactPayload, describeRedactions } from '../shared/redact.ts'

const LEGACY_AGENT = new Set([
  'agent.heartbeat@1', 'agent.stage.reported@1', 'session.oriented@1',
  'task.assigned@1', 'task.handoff@1', 'task.moved@1', 'work.claimed@1',
  'work.released@1', 'question.asked@1', 'proposal.filed@1'
])
/** Named existing owners; not a claim of schema-aware coverage for these
 * payloads. New names/versions cannot silently inherit an exemption. */
export const EXTERNAL_INGRESS_OWNERS: Readonly<Record<string, string>> = Object.freeze({
  ...Object.fromEntries([...LEGACY_AGENT].map(type => [type, 'AgentSurface.appendRedacted; task.moved also uses mayMove at operator entry'])),
  ...Object.fromEntries(['grant.issued@1', 'grant.consumed@1', 'policy.decided@1',
    'effect.reserved@1', 'effect.dispatch_started@1', 'effect.observed@1', 'effect.claimed@1']
    .map(type => [type, 'Policy.appendAuthority / redactAuthorityPayload'])),
  'context.compiled@1': 'compileContextPack lockfile; preserve content hashes',
  'transcript.captured@1': 'TranscriptStore / createTranscriptReceipt; preserve sealed hashes',
  'terminal.opened@1': 'PtyManager.open owned launch metadata',
  'terminal.closed@1': 'PtyManager.recordClosed observed process metadata',
  'backend.opened@1': 'owned backend registry: owner, epoch and process identity only (B3)',
  'backend.exited@1': 'owned backend registry: exit code, signal and process-group observation only (B3)',
  'session.observed@1': 'createRuntimeObserver typed liveness observation',
  'session.ended@1': 'recordSessionExit / classifyFailure static diagnosis',
  'estate.created@1': 'bootstrap fixed estate name and bound owner',
  'project.repo.detached@1': 'reposDetach identifier only',
  'routine.updated@1': 'routinesSetEnabled identifier and boolean',
  'task.note.promoted@1': 'notesPromote relationship identifiers',
  'task.prioritised@1': 'tasksPrioritise relationship identifiers and position'
})

export function createDesktopJournal(journal: Journal): Journal {
  return createPreparedJournal(journal, {
    classifyUncovered: type => Object.hasOwn(EXTERNAL_INGRESS_OWNERS, type) ? 'external_policy' : 'reject'
  })
}

/** Complete original first: splitting a recognized credential destroys the
 * evidence a later field-by-field scrub needs. Bounds refuse, never clip. */
export function cleanOriginalText(input: unknown): string {
  const prepared = prepareOriginalInstruction(input)
  if (prepared.state === 'rejected') throw new CommandIngressError(prepared.code)
  return prepared.value
}
export function prepareTaskText(input: unknown): { instruction: string; title: string } {
  const instruction = cleanOriginalText(input).trim()
  return { instruction, title: instruction.slice(0, 160) }
}
export function prepareIdeaText(input: unknown): ReturnType<typeof readIdea> {
  return readIdea({ text: cleanOriginalText(input) })
}
export function prepareRetrievalText(input: unknown): string {
  return cleanOriginalText(input).trim().slice(0, 300)
}

/** Agent commands retain their existing text policy only for the explicit
 * legacy roster. Covered originals go to createDesktopJournal after validation,
 * so its one sanitation pass retains the real removal count. AgentSurface's
 * injected journal must use that boundary, as bootstrap and its fixtures do. */
export function prepareAgentPayload(type: string, input: Record<string, unknown>): Record<string, unknown> {
  const prepared = prepareEventPayload(type, input)
  if (prepared.state === 'rejected') throw new CommandIngressError(prepared.code)
  if (prepared.state === 'prepared') {
    return input
  }
  if (!LEGACY_AGENT.has(type)) throw new CommandIngressError('not_covered')
  const { payload, redactions } = redactPayload(input)
  const summary = describeRedactions(redactions)
  return summary ? { ...payload, redactions: summary } : payload
}

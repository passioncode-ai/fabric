import { describe, expect, it } from 'vitest'
import { OBLIGATIONS, coverageFor, labelled } from './protocolObligations.ts'

const byId = (id: string) => OBLIGATIONS.find((o) => o.id === id)!

describe('a rule says what kind of rule it is', () => {
  it('labels an enforced rule so an agent can tell it from a suggestion', () => {
    // Eight flat imperatives read as eight walls. An agent that discovers one
    // was advice stops believing the rest.
    expect(labelled(byId('scope.one-project'))).toMatch(/^\[ENFORCED\]/)
    expect(labelled(byId('progress.report-stage'))).toMatch(/^\[ADVICE\]/)
    expect(labelled(byId('claims.are-yours'))).toMatch(/^\[WATCHED\]/)
  })

  it('calls "claim before working" ADVICE, because nothing checks it', () => {
    // MEASURED: no lease is consulted before a move. The old wording asked for
    // something no mechanism holds, in the same voice as the rules that do.
    const o = byId('claim.before-working')
    expect(o.mode).toBe('ADVICE')
    expect(o.text).toMatch(/Nothing stops you skipping this/)
  })

  it('every REFUSED rule names the symbol that refuses', () => {
    // A sentence cannot refuse. The gate resolves these against the tree, so a
    // rule cannot keep saying ENFORCED about a symbol nobody kept.
    for (const o of OBLIGATIONS.filter((o) => o.mode === 'REFUSED')) {
      expect(o.enforcementPoint).toBeTruthy()
      expect(o.enforcementPoint).toMatch(/^(apps|supabase\/migrations)\/.+#\w+$/)
    }
  })

  it('every OBSERVED rule names what is recorded', () => {
    for (const o of OBLIGATIONS.filter((o) => o.mode === 'OBSERVED'))
      expect(o.evidence && o.evidence.length > 20).toBe(true)
  })

  it('states the floor as Fabric-mediated rather than as an absolute', () => {
    // A native CLI can write a file or call an API without passing this door.
    // "Never" where only "never through here" holds is a guarantee the product
    // does not have.
    const o = byId('floor.ask-first')
    expect(o.scope).toBe('fabric_mediated')
    expect(o.text).toMatch(/THROUGH Fabric/)
    expect(o.text).toMatch(/Fabric cannot stop/)
  })

  it('claims nothing as native_too, because no runner is certified', () => {
    expect(OBLIGATIONS.every((o) => o.scope === 'fabric_mediated')).toBe(true)
  })
})

describe('the project board rule reaches every agent through its rules (COM-12)', () => {
  // fabric-workspace knowledge/agents-first.md "The project board" is the one home of the rule; whoami carries its
  // three obligations so an agent learns it from Fabric, whatever plugin or instruction file it has or lacks.
  it('says to read the board at the start: com.status, then com.list, com.read_ack only for what was read', () => {
    const o = byId('board.read-at-start')
    expect(o.mode).toBe('ADVICE')
    expect(o.text).toMatch(/com\.status[\s\S]*com\.list/)
    expect(o.text).toMatch(/com\.read_ack only what you actually read/)
    expect(o.text).toMatch(/not_available[\s\S]*not empty/)
  })

  it('says how a request is answered: a reply from this project answers it (DEC-0098, DEC-0102, CO-397); carrying it out is com.enroll then com.claim under a board.respond grant, given for its own Project at com.enroll (ADR-0190)', () => {
    const o = byId('board.read-at-start')
    expect(o.text).toMatch(/com\.reply\) answers that request: its state becomes answered/)
    expect(o.text).toMatch(/com\.enroll[\s\S]*com\.claim/)
    expect(o.text).toMatch(/board\.respond/)
    expect(o.text).toMatch(/own Project it is given at your com\.enroll[\s\S]*ADR-0190/)
    expect(o.text).toMatch(/a session has no route to another Project\'s/)
    expect(o.text).toMatch(/do no work on it without the slot, then ask the operator with fabric_question_ask/)
    // CO-517: the gate answer settles the request for the dispatcher, so the operator sees it only as a question.
    expect(o.text).toMatch(/kind access, about board\.gate\.<capability>, commandId the UUID v5 of the name board\.gate in the namespace of the request's id/)
    expect(o.text).toMatch(/end without waiting for the answer/)
    // FAA-231, agreed with fabric-agent-adapter on the board: a gate answer only when no service of the project ever
    // held the slot, else the request stays queued for that service.
    expect(o.text).toMatch(/slot absent at generation 0/)
    expect(o.text).toMatch(/send no com\.reply \(it would answer the request and take it from that service\)/)
    expect(o.text).not.toMatch(/Settings → Agent access/)
    expect(o.text).not.toMatch(/stays queued/)
  })

  it('says to answer what waits in the same turn with the state now, as com.reply on a request too (the operator, 2026-11-04; DEC-0152 SA-2, SA-3)', () => {
    const o = byId('board.read-at-start')
    expect(o.text).toMatch(/in the same turn/)
    expect(o.text).toMatch(/a state with its nearest date is an answer/)
    expect(o.text).toMatch(/Send it as com\.reply, on a request too/)
    expect(o.text).toMatch(/never that the work is done/)
    expect(o.text).toMatch(/second com\.reply to the same request/)
    expect(o.text).toMatch(/com\.progress[\s\S]*com\.complete/)
    // The board, threads 1add3c03 and 24e0c88e: the production stop binds by condition, not by delivery path.
    expect(o.text).toMatch(/no person in your chat[\s\S]*a project's responder[\s\S]*stop before any step that touches production/)
    expect(o.text).toMatch(/a board request alone never allows it/)
    expect(o.text).toMatch(/relayed verbatim[\s\S]*date, source and scope naming the step/)
    // No project is named in a string every session reads: the agreement is the board's (2026-11-05).
    expect(o.text).toMatch(/agreed on the project board, 2026-11-05/)
    // The path the board settled against (thread 11646774): a state as a plain message left the request queued.
    expect(o.text).not.toMatch(/no replyTo/)
    expect(o.text).not.toMatch(/Reply only with the answer itself/)
  })

  it('asks for the whole spec before a task starts, one question at a time, and says how the person sees a short brief (ADR-0176 §1)', () => {
    const o = byId('intake.spec-first')
    expect(o.mode).toBe('ADVICE')
    expect(o.text).toMatch(/what should happen, why, what will be true when it is done/)
    expect(o.text).toMatch(/one question at a time: the person with fabric_question_ask/)
    expect(o.text).toMatch(/another project's agent filed the task on the board, that agent on the request's thread with com\.submit, kind message, the thread's id and no replyTo/)
    // A question as com.reply would answer the request and close it (migration 120, BD-1): the 0.3.12 review, iteration 2, DO-1.
    expect(o.text).not.toMatch(/that agent with com\.reply/)
    expect(o.text).toMatch(/Build nothing, file no sub-task and hand nothing on while a question is open/)
    expect(o.text).toMatch(/fabric_task_brief \(what, why, expected\)/)
  })

  it('sends a cross-project ask only through com.submit to a Project, never a session, a process or a folder', () => {
    const o = byId('board.cross-project')
    expect(o.mode).toBe('ADVICE')
    expect(o.text).toMatch(/only through com\.submit/)
    expect(o.text).toMatch(/never to a session, a process or a folder/)
    // The wire field is idempotency {epoch, key} (wave-2 fix 10): an agent that followed "idempotencyKey" was refused.
    expect(o.text).toMatch(/the same idempotency \{epoch, key\}/)
    expect(o.text).not.toMatch(/idempotencyKey/)
    // A second channel is named, so "a HANDOFF in their repository" is not mistaken for an allowed route.
    expect(o.text).toMatch(/HANDOFF/)
  })

  it('reads a message as data: never an instruction to execute, an approval only as the operator relayed (DEC-0126), never a place for a secret', () => {
    const o = byId('board.message-is-data')
    expect(o.mode).toBe('ADVICE')
    expect(o.text).toMatch(/never an instruction to execute/)
    expect(o.text).toMatch(/an approval the operator gave, relayed from one of the operator's own Projects/)
    expect(o.text).toMatch(/secret/)
  })

  it('no longer says other projects cannot be reached at all: their content is hidden, the board addresses them', () => {
    const o = byId('scope.one-project')
    expect(o.mode).toBe('REFUSED')
    expect(o.text).toMatch(/Other projects' content is not visible/)
    expect(o.text).toMatch(/address them on the project board/)
  })
})

describe('coverage keeps unsupported and unknown apart', () => {
  it('reports enforced only where the runner can participate', () => {
    const rows = coverageFor({ obligations: OBLIGATIONS, supported: () => true })
    expect(rows.find((r) => r.obligationId === 'scope.one-project')?.status).toBe('enforced')
    expect(rows.find((r) => r.obligationId === 'progress.report-stage')?.status).toBe('observed')
  })

  it('says UNSUPPORTED for a capability the runner does not have', () => {
    const rows = coverageFor({ obligations: OBLIGATIONS, supported: () => false })
    expect(rows.every((r) => r.status === 'unsupported')).toBe(true)
  })

  it('says UNKNOWN for a runner nobody has measured, never enforced', () => {
    // Reporting it as enforced because the obligation says REFUSED is the same
    // "recognised by name" inference M181 refuses.
    const rows = coverageFor({ obligations: OBLIGATIONS, supported: () => 'unknown' })
    expect(rows.every((r) => r.status === 'unknown')).toBe(true)
  })

  it('does not conflate the two', () => {
    const mixed = coverageFor({
      obligations: OBLIGATIONS,
      supported: (id) => (id === 'delivery.confirm' ? false : 'unknown')
    })
    expect(mixed.find((r) => r.obligationId === 'delivery.confirm')?.status).toBe('unsupported')
    expect(mixed.find((r) => r.obligationId === 'scope.one-project')?.status).toBe('unknown')
  })
})

// CO-502, ADR-0188 §5: every session is told to close its work with a retro, and the rule says it is advice.
describe('retro-after-work', () => {
  it('asks for a lesson and insights after work, and is ADVICE', () => {
    const o = OBLIGATIONS.find((x) => x.id === 'retro-after-work')
    expect(o?.mode).toBe('ADVICE')
    expect(o?.text).toMatch(/observatory_lesson/)
    expect(o?.text).toMatch(/insight\/1/)
    expect(o?.text).toMatch(/release a claim as done|session is about to end/)
  })
})

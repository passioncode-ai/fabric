// What an agent can reach through Fabric, and which of it leaves a record
// (M145 · SCR-35, SCR-38).
//
// WHY THIS LIST EXISTS SEPARATELY from the registrations it describes: the
// harness screen is read by the person who holds agents to account, and it must
// be readable without running an MCP client against ourselves from the main
// process. The duplication is real and it is GATED — the surface probe asserts
// this list equals the tools the server actually registers, so a tool added
// without a row here fails the build.
//
// WHAT IS DELIBERATELY ABSENT: how often each was called, and how often it
// refused. There is no per-tool call log. Sixteen tools register and ELEVEN
// write to the journal, so a usage count built from the journal would show the
// other five as never used — a number that is worse than no number, because it
// reads as a measurement. The `records` column below is the honest version of
// the same question: it says which tools leave a trace at all.

export interface SurfaceTool {
  name: string
  /** One line, for a person deciding whether an agent should have it. */
  purpose: string
  /**
   * Whether calling it writes to the journal. NOT a usage count — a fact about
   * the tool, and the one an operator actually needs: it says what an agent's
   * activity will and will not show up in the record.
   */
  records: boolean
}

export const SURFACE_TOOLS: readonly SurfaceTool[] = [
  { name: 'fabric_whoami', purpose: 'Who this session is, what project it is in, and the rules it works under', records: false },
  { name: 'fabric_agents_list', purpose: 'The other sessions in this project — what each claims and what Fabric observed', records: false },
  { name: 'fabric_stage_report', purpose: 'Say where you are in the work, as a claim beside what Fabric observes', records: true },
  { name: 'fabric_memory_search', purpose: 'What this project already knows about itself', records: true },
  { name: 'fabric_memory_remember', purpose: 'Record a fact worth keeping, with where it was learned', records: true },
  { name: 'fabric_transcripts_search', purpose: 'What past sessions in this project printed', records: true },
  { name: 'fabric_tasks_list', purpose: 'The board: what is waiting, running, in review and closed', records: false },
  { name: 'fabric_task_create', purpose: 'File work on the board, with the evidence it came from', records: true },
  { name: 'fabric_task_claim', purpose: 'Take a task so a neighbour does not start the same work', records: true },
  { name: 'fabric_task_release', purpose: 'Let a task go, saying how it ended', records: true },
  { name: 'fabric_task_move', purpose: 'Move a task between backlog, running and review — never to done', records: true },
  { name: 'fabric_task_note', purpose: 'Working notes on one task, append-only', records: true },
  { name: 'fabric_task_handoff', purpose: 'Hand a NAMED result on to whatever task follows this one', records: true },
  { name: 'fabric_task_brief', purpose: 'Draft what a task is for; the operator can replace any part', records: true },
  {
    name: 'fabric_question_ask',
    purpose: 'Ask the owner a decision this session is not entitled to make',
    records: true
  },
  {
    name: 'fabric_question_check',
    purpose: 'Read the current state of a question this session asked',
    records: false
  },
  { name: 'fabric_task_link', purpose: 'Say one task blocks, follows or spawned another', records: true },
  { name: 'fabric_leases_list', purpose: 'Who is holding what in this project right now', records: false },
  { name: 'fabric_effect_request', purpose: 'Ask to spend, delete or publish — refused until a person agrees', records: true },
  { name: 'fabric_task_accept', purpose: 'Confirm you hold the instruction that was sent, by its digest (M103)', records: true },
  { name: 'fabric_heartbeat', purpose: 'Say what you are doing, so silence stops being ambiguous (ADR-0040)', records: true },
  { name: 'fabric_effect_report', purpose: 'Say what happened to a permitted act — a claim, never a receipt (ADR-0050)', records: true }
]

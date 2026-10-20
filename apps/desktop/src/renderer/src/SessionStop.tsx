import { useEffect, useState } from 'react'
import type { TerminalSession } from '../../shared/types'
import type { TerminalTermination } from '../../shared/stop'
import { Button, StateChip, Toolbar } from './components'
import { useT } from './i18n'
import { FailureNote } from './OperatorError'
import { whyWords } from './launch/actWords'
import { unwrap } from '../../shared/errorText'

/** OF-02: the process is gone and only the provider's background work is unproved. Said as an end, never as a stop
 *  that failed; the caveat stays in words (`session.endedHelp`), and the receipt rules below do not change. */
// The reasons `nativeStopRuntime.ts` gives only after it saw the root exit and the whole process tree go quiet: nothing is
// left to stop here, so Force stop has nothing to do. Any other unknown keeps Force (a child may still run).
const QUIET_TREE_REASONS = new Set(['provider_termination_unproved', 'exit_outcome_unavailable', 'finalization_unproved', 'exit_receipt_unavailable'])
export const processEnded = (session: Pick<TerminalSession, 'running'> | undefined, state: TerminalTermination | undefined): boolean =>
  !!session && !session.running && state?.state === 'outcome_unknown' && QUIET_TREE_REASONS.has(state.reasonCode)

const attested = (r: TerminalTermination | null | undefined): boolean => r?.state === 'stopped' && 'basis' in r && r.basis === 'attested'
const seqOf = (r: TerminalTermination): number | undefined => ('receiptSeq' in r ? r.receiptSeq : undefined)

export function StopStatus({ state, session }: { state: TerminalTermination; session?: Pick<TerminalSession, 'running' | 'exitCode'> }) {
  const t = useT()
  if (processEnded(session, state))
    return <StateChip tone="quiet" dot>
      {session!.exitCode === null || session!.exitCode === undefined ? t('session.endedNoCode') : t('session.ended', { code: String(session!.exitCode) })}
    </StateChip>
  // 0.3.7 review UX-5: an attested Stop is the person's word, not Fabric's check; the chip says who decided.
  return <StateChip tone={state.state === 'requested' ? 'info' : state.state === 'stopped' ? 'quiet' : 'warn'} dot>
    {t(attested(state) ? 'session.stop.attested' : `session.stop.${state.state}`)}
  </StateChip>
}

/** A receipt is a different fact from PTY liveness. Keep recovery available
 * after root exit and never offer dismissal while termination is unresolved.
 * ADR-0160 §1 (0.3.7 wave 3): Stop and Force stop are one press each; the stop is recorded with «start it again»
 * as its undo (the act line), so no «are you sure» row stands between the press and the act. */
export function SessionStop({ session, refresh, onError }: {
  session: TerminalSession; refresh(): Promise<void> | void; onError(message: string): void
}) {
  const t = useT()
  const [receipt, setReceipt] = useState<TerminalTermination | null>(null)
  const [pending, setPending] = useState(false)
  const [attestProblem, setAttestProblem] = useState<{ why: string; says?: string } | null>(null)
  useEffect(() => {
    if (pending || !session.termination) return
    const observed = session.termination
    setReceipt(previous => {
      // UX-1 / ER-7: «Отменить» on «Работа закончена» puts the Stop back to unknown, and the reading that says so is
      // newer than the attestation; an older one is a stale poll and changes nothing.
      const undone = previous && attested(previous) && observed.state === 'outcome_unknown'
      const p = previous ? seqOf(previous) : undefined, o = seqOf(observed)
      if (undone && p !== undefined && o !== undefined && o > p) return observed
      if (previous?.state === 'stopped') return previous // otherwise immutable per Session
      if (observed.state === 'requested' && previous && previous.state !== 'requested') return previous
      if (previous && 'receiptSeq' in previous && 'receiptSeq' in observed &&
          previous.receiptSeq !== undefined && observed.receiptSeq !== undefined && observed.receiptSeq < previous.receiptSeq) return previous
      return observed
    })
  }, [session.termination])
  const state = pending ? 'requested' : receipt?.state ?? session.termination?.state
  const stop = async (force: boolean) => {
    setPending(true)
    setReceipt({ sessionId: session.sessionId, state: 'requested', reasonCode: 'stop_requested' })
    try { setReceipt(await window.fabric.terminal.end(session.sessionId, { force })) }
    catch { setReceipt({ sessionId: session.sessionId, state: 'outcome_unknown', reasonCode: 'ipc_unavailable' }) }
    finally { setPending(false) }
    // A failed refresh cannot revoke an acknowledged Stop receipt.
    try { await refresh() } catch (e) { onError(String(e)) }
  }
  const currentReceipt = receipt ?? session.termination
  // CO-327, ADR-0170: an ended run of a task, whose Stop the host cannot prove, waits for the person to say it is over.
  const attestable = (r: TerminalTermination | undefined | null): boolean =>
    !!r && r.state === 'outcome_unknown' && 'managed' in r && r.managed === true && !!r.runId && !!r.commandId && !!r.taskId
  const attestOver = async () => {
    setPending(true)
    setAttestProblem(null)
    // ER-7: a refusal is said in our words (the act line's), the machine's own words on a line of their own.
    try {
      const answer = await window.fabric.terminal.attestOver(session.sessionId)
      if (answer.ok) setReceipt(answer.receipt)
      else setAttestProblem({ why: answer.why, ...(answer.says ? { says: answer.says } : {}) })
    }
    catch (e) { setAttestProblem({ why: 'failed', says: unwrap(e instanceof Error ? e.message : String(e)) }) }
    finally { setPending(false) }
    try { await refresh() } catch (e) { onError(String(e)) }
  }
  const writerBlocked = currentReceipt && currentReceipt.state !== 'requested' && currentReceipt.managed === true
  const unresolved = state === 'outcome_unknown' || state === 'refused'
  const ended = !pending && processEnded(session, currentReceipt ?? undefined)
  return <div>
    {receipt && receipt.state !== session.termination?.state && <div role="status"><StopStatus state={receipt} /></div>}
    {unresolved && <p className="muted">{t(ended && attestable(currentReceipt) ? 'session.runOverHelp' : ended ? 'session.endedHelp' : state === 'refused' ? 'session.stop.refusedHelp' : 'session.stop.unknownHelp')}</p>}
    {unresolved && writerBlocked && !ended && <p className="muted">{t('session.stop.writerBlocked')}</p>}
    {attestProblem && state === 'outcome_unknown' && <FailureNote said={t('session.runOverFailed', { why: whyWords(t, attestProblem.why) })} detail={attestProblem.says} />}
    <Toolbar>
      {state === 'stopped' ? <Button tone="ghost" onClick={async () => {
        try { await window.fabric.terminal.dismiss(session.sessionId); await refresh() }
        catch (e) { onError(String(e)) }
      }}>{t('agents.dismiss')}</Button>
        : <>
        <Button tone="ghost" disabled={pending || state === 'requested'} onClick={() => void stop(false)}>
          {t(state === 'requested' ? 'session.stop.requested' : unresolved ? 'session.stop.retry' : 'session.stop.action')}
        </Button>
        {state === 'outcome_unknown' && !ended && <Button tone="ghost" disabled={pending} onClick={() => void stop(true)}>{t('session.stop.force')}</Button>}
        {ended && attestable(currentReceipt) && <Button disabled={pending} onClick={() => void attestOver()}>{t('session.runOver')}</Button>}
      </>}
    </Toolbar>
  </div>
}

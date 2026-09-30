import { useEffect, useState } from 'react'
import type { TerminalSession } from '../../shared/types'
import type { TerminalTermination } from '../../shared/stop'
import { Button, StateChip, Toolbar } from './components'
import { useT } from './i18n'

export function StopStatus({ state }: { state: TerminalTermination }) {
  const t = useT()
  return <StateChip tone={state.state === 'requested' ? 'info' : state.state === 'stopped' ? 'quiet' : 'warn'} dot>
    {t(`session.stop.${state.state}`)}
  </StateChip>
}

/** A receipt is a different fact from PTY liveness. Keep recovery available
 * after root exit and never offer dismissal while termination is unresolved. */
export function SessionStop({ session, refresh, onError }: {
  session: TerminalSession; refresh(): Promise<void> | void; onError(message: string): void
}) {
  const t = useT()
  const [receipt, setReceipt] = useState<TerminalTermination | null>(null)
  const [pending, setPending] = useState(false)
  const [confirm, setConfirm] = useState<'stop' | 'force' | null>(null)
  useEffect(() => {
    if (pending || !session.termination) return
    const observed = session.termination
    setReceipt(previous => {
      if (previous?.state === 'stopped') return previous // immutable per Session
      if (observed.state === 'requested' && previous && previous.state !== 'requested') return previous
      if (previous && 'receiptSeq' in previous && 'receiptSeq' in observed &&
          previous.receiptSeq !== undefined && observed.receiptSeq !== undefined && observed.receiptSeq < previous.receiptSeq) return previous
      return observed
    })
  }, [session.termination])
  const state = pending ? 'requested' : receipt?.state ?? session.termination?.state
  const stop = async (force: boolean) => {
    setConfirm(null); setPending(true)
    setReceipt({ sessionId: session.sessionId, state: 'requested', reasonCode: 'stop_requested' })
    try { setReceipt(await window.fabric.terminal.end(session.sessionId, { force })) }
    catch { setReceipt({ sessionId: session.sessionId, state: 'outcome_unknown', reasonCode: 'ipc_unavailable' }) }
    finally { setPending(false) }
    // A failed refresh cannot revoke an acknowledged Stop receipt.
    try { await refresh() } catch (e) { onError(String(e)) }
  }
  const currentReceipt = receipt ?? session.termination
  const writerBlocked = currentReceipt && currentReceipt.state !== 'requested' && currentReceipt.managed === true
  const unresolved = state === 'outcome_unknown' || state === 'refused'
  return <div>
    {receipt && receipt.state !== session.termination?.state && <div role="status"><StopStatus state={receipt} /></div>}
    {unresolved && <p className="muted">{t(state === 'refused' ? 'session.stop.refusedHelp' : 'session.stop.unknownHelp')}</p>}
    {unresolved && writerBlocked && <p className="muted">{t('session.stop.writerBlocked')}</p>}
    <Toolbar>
      {state === 'stopped' ? <Button tone="ghost" onClick={async () => {
        try { await window.fabric.terminal.dismiss(session.sessionId); await refresh() }
        catch (e) { onError(String(e)) }
      }}>{t('agents.dismiss')}</Button>
        : confirm ? <>
        <span>{t(confirm === 'force' ? 'session.stop.forceConfirm' : 'session.stop.confirm')}</span>
        <Button tone="ghost" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
        <Button tone={confirm === 'force' ? 'danger' : 'primary'} onClick={() => void stop(confirm === 'force')}>
          {t(confirm === 'force' ? 'session.stop.force' : 'session.stop.action')}
        </Button>
      </> : <>
        <Button tone="ghost" disabled={pending || state === 'requested'} onClick={() => unresolved ? void stop(false) : setConfirm('stop')}>
          {t(state === 'requested' ? 'session.stop.requested' : unresolved ? 'session.stop.retry' : 'session.stop.action')}
        </Button>
        {state === 'outcome_unknown' && <Button tone="ghost" onClick={() => setConfirm('force')}>{t('session.stop.force')}</Button>}
      </>}
    </Toolbar>
  </div>
}

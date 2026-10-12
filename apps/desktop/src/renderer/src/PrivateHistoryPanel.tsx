// Private history (SCR-65 · SCN-097) and restore into a fresh Estate (SCR-48 · SCN-065),
// first-slice plan A1-6c. Main owns the files, the folder dialog and the operator's identity;
// this panel holds a token, never a path, and says what each step made true.

import { useEffect, useState } from 'react'
import type { HistoryArchiveSummary, HistoryExport, HistoryPending, HistoryRestored, HistoryRestoredEstate } from '../../shared/types'
import { Banner, Button, EmptyState, Field, Panel, Toolbar } from './components'
import { useT } from './i18n'

type Refusal = { ok: false; state: 'refused' | 'result_unknown'; reason_code: string; operation_id?: string }
type ExportView = { kind: 'idle' } | { kind: 'exporting' } | { kind: 'exported'; name: string } | { kind: 'refused'; reason: string }
type RestoreView =
  | { kind: 'empty' } | { kind: 'verifying' } | { kind: 'refused'; reason: string; operationId?: string } | { kind: 'ready'; archive: HistoryArchiveSummary }
  | { kind: 'restoring' } | { kind: 'unknown'; operationId: string } | { kind: 'restored'; result: HistoryRestored }
/** Opening is its own state beside the restore's (A3-005): a failed Open used to replace the restored result. */
type OpenView = { kind: 'idle' } | { kind: 'opening'; estateId: string } | { kind: 'failed'; estateId: string; reason: string }

const REASONS = ['invalid_json', 'too_large', 'invalid_archive', 'integrity_mismatch', 'unsupported_schema', 'archive_stale', 'idempotency_conflict', 'not_found', 'unavailable',
  'not_your_history'] as const
const OPEN_REASONS = ['not_restored_here', 'write_failed', 'unavailable'] as const

export function PrivateHistoryPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const t = useT()
  const [list, setList] = useState<HistoryExport[] | null>(null)
  const [exp, setExp] = useState<ExportView>({ kind: 'idle' })
  const [rst, setRst] = useState<RestoreView>({ kind: 'empty' })
  const [opening, setOpening] = useState<OpenView>({ kind: 'idle' })
  /** Null until read, and null again when a read fails: unknown, never "nothing waiting" (0.3.5 review ER-10). */
  const [pending, setPending] = useState<HistoryPending[] | null>(null)
  const [restoredEstates, setRestoredEstates] = useState<HistoryRestoredEstate[] | null>(null)
  const [opsUnread, setOpsUnread] = useState(false)
  const [name, setName] = useState('')
  const reason = (code: string): string => t(`history.reason.${(REASONS as readonly string[]).includes(code) ? code : 'unavailable'}` as 'history.reason.unavailable')
  const openReason = (code: string): string => t(`history.openReason.${(OPEN_REASONS as readonly string[]).includes(code) ? code : 'unavailable'}` as 'history.openReason.unavailable')

  const refresh = async (): Promise<void> => {
    try { setList(await window.fabric.history.list()) } catch { /* Not silence: an unreadable list stays "unknown", never "none". */ setList(null) }
  }
  // #region private-history-panel-operations — docs: docs/ux/scenarios.md#scn-065-restore-an-archive-into-a-fresh-estate-and-open-it
  // What waits for a result and what can still be opened are main's operation files (A5-014, A3-005), read again
  // after every restore step, so closing the panel or a restart loses neither. An unreadable list is said as unread,
  // with Check again, and logged — after a restart there is no step in view to stand in for it (0.3.5 review ER-10).
  const refreshOperations = async (): Promise<void> => {
    const unread = (what: string, e: unknown): null => {
      window.fabric.ops?.rendererError({ message: `history.${what} could not be read: ${e instanceof Error ? e.message : String(e)}`, component: 'PrivateHistoryPanel.refreshOperations' })
      return null
    }
    const [p, r] = await Promise.all([
      window.fabric.history.pending().catch((e: unknown) => unread('pending', e)),
      window.fabric.history.restored().catch((e: unknown) => unread('restored', e))
    ])
    setPending(p)
    setRestoredEstates(r)
    setOpsUnread(p === null || r === null)
  }
  useEffect(() => { void refresh(); void refreshOperations() }, [])

  // Every call can throw (`handle()` rethrows main's failure): each ends in a state with a control, never on a
  // spinner (A3-004, A5-013).
  const doExport = async (): Promise<void> => {
    setExp({ kind: 'exporting' })
    try {
      const r = await window.fabric.history.export()
      setExp(r.ok ? { kind: 'exported', name: r.name } : { kind: 'refused', reason: (r as Refusal).reason_code })
    } catch { /* Not silence: said as a refusal; main removes a partial export itself. */ setExp({ kind: 'refused', reason: 'unavailable' }) }
    await refresh()
  }
  const choose = async (): Promise<void> => {
    setRst({ kind: 'verifying' })
    setOpening({ kind: 'idle' })
    try {
      const r = await window.fabric.history.choose()
      if (r === null) return setRst({ kind: 'empty' })
      setRst(r.ok ? { kind: 'ready', archive: r } : { kind: 'refused', reason: (r as Refusal).reason_code })
    } catch { /* Not silence: nothing was written before the archive passed. */ setRst({ kind: 'refused', reason: 'unavailable' }) }
  }
  const settle = (r: { ok: true } & HistoryRestored | Refusal): void =>
    setRst(r.ok ? { kind: 'restored', result: r } : r.state === 'result_unknown' && r.operation_id ? { kind: 'unknown', operationId: r.operation_id }
      : { kind: 'refused', reason: r.reason_code, ...(r.operation_id ? { operationId: r.operation_id } : {}) })
  const restore = async (archive: HistoryArchiveSummary): Promise<void> => {
    setRst({ kind: 'restoring' })
    try { settle(await window.fabric.history.restore(archive.token, name.trim()) as { ok: true } & HistoryRestored | Refusal) }
    catch { /* Not silence: whether main recorded an operation is in its files — read below and listed with Check again. */ setRst({ kind: 'refused', reason: 'unavailable' }) }
    await refreshOperations()
  }
  const check = async (operationId: string): Promise<void> => {
    setRst({ kind: 'restoring' })
    try { settle(await window.fabric.history.check(operationId) as { ok: true } & HistoryRestored | Refusal) }
    catch { /* Not silence: the same operation stays checkable; nothing is minted in its place. */ setRst({ kind: 'unknown', operationId }) }
    await refreshOperations()
  }
  const open = async (estateId: string): Promise<void> => {
    setOpening({ kind: 'opening', estateId })
    try {
      const r = await window.fabric.history.open(estateId)
      // A success restarts the app; a refusal keeps the restored result and names why (A3-005).
      if (!r.ok) setOpening({ kind: 'failed', estateId, reason: r.reason ?? 'unavailable' })
    } catch { /* Not silence: said beside the Estate, which stays restored and can be opened again. */ setOpening({ kind: 'failed', estateId, reason: 'unavailable' }) }
  }
  // The step in view keeps its own controls; the lists below do not repeat it.
  const inView = rst.kind === 'unknown' || rst.kind === 'refused' ? rst.operationId : undefined
  const waiting = (pending ?? []).filter(p => p.operation_id !== inView)
  const openable = (restoredEstates ?? []).filter(e => rst.kind !== 'restored' || rst.result.target_estate_id !== e.target_estate_id)
  // #endregion private-history-panel-operations

  return (
    <aside className="ceo-panel" aria-label={t('history.title')}>
      <Panel title={t('history.title')} actions={<Toolbar align="end"><Button tone="ghost" onClick={onClose}>{t('history.close')}</Button></Toolbar>}>
        {/* SCR-65: one person's conversations, as history — nothing else travels. */}
        <h3 className="task-history-head">{t('history.private.title')}</h3>
        <p className="muted">{t('history.private.what')}</p>
        <p className="muted">{t('history.private.file')}</p>
        <Toolbar>
          <Button onClick={() => void doExport()} disabled={exp.kind === 'exporting'}>{t('history.export')}</Button>
        </Toolbar>
        {exp.kind === 'exporting' && <p className="muted" role="status">{t('history.exporting')}</p>}
        {exp.kind === 'exported' && <p role="status">{t('history.exported', { name: exp.name })}</p>}
        {exp.kind === 'refused' && <Banner tone="warn">{t('history.exportRefused', { reason: reason(exp.reason) })}</Banner>}
        {list === null ? <p className="muted">{t('history.listUnknown')}</p>
          : list.length === 0 ? <EmptyState read>{t('history.none')}</EmptyState>
          : <div className="widget-list">{list.map(x => <p key={x.name} className="mono">{x.name}</p>)}</div>}

        {/* SCR-48: history into a fresh Estate you own; opening it is a separate choice. */}
        <h3 className="task-history-head">{t('history.restore.title')}</h3>
        <p className="muted">{t('history.restore.what')}</p>
        {(rst.kind === 'empty' || rst.kind === 'refused') && (
          <Toolbar><Button onClick={() => void choose()}>{t('history.choose')}</Button></Toolbar>
        )}
        {rst.kind === 'verifying' && <p className="muted" role="status">{t('history.verifying')}</p>}
        {rst.kind === 'refused' && (
          // A refusal that carries its operation (its archive could not be read) is checked again by that operation.
          <Banner tone="warn" actions={rst.operationId ? <Button tone="ghost" onClick={() => void check(rst.operationId!)}>{t('history.checkAgain')}</Button> : undefined}>
            {t('history.refused', { reason: reason(rst.reason) })}
          </Banner>
        )}
        {rst.kind === 'ready' && (
          <>
            <p>{t('history.archive', { taken: rst.archive.taken_at, events: rst.archive.events })}</p>
            {rst.archive.companion
              ? <p>{rst.archive.companion.mine ? t('history.archive.mine', { conversations: rst.archive.companion.conversations, messages: rst.archive.companion.messages }) : t('history.archive.notMine')}</p>
              : <p className="muted">{t('history.archive.noPrivate')}</p>}
            <Field label={t('history.name')}>
              {(id) => <input id={id} value={name} maxLength={200} onChange={e => setName(e.target.value)} />}
            </Field>
            <Toolbar>
              <Button onClick={() => void restore(rst.archive)} disabled={!name.trim()}>{t('history.restore')}</Button>
              <Button tone="ghost" onClick={() => setRst({ kind: 'empty' })}>{t('history.cancel')}</Button>
            </Toolbar>
          </>
        )}
        {rst.kind === 'restoring' && <p className="muted" role="status">{t('history.restoring')}</p>}
        {rst.kind === 'unknown' && (
          <Banner tone="warn" actions={<Button tone="ghost" onClick={() => void check(rst.operationId)}>{t('history.checkAgain')}</Button>}>
            {t('history.unknown')}
          </Banner>
        )}
        {rst.kind === 'restored' && (
          <>
            <ul>
              <li>{t('history.fact.history')}</li>
              <li>{t('history.fact.access')}</li>
              <li>{rst.result.private_history ? t('history.fact.private')
                : rst.result.private_history_skipped ? t('history.fact.privateSkipped', { reason: reason(rst.result.private_history_skipped) })
                : t('history.fact.noPrivate')}</li>
              <li>{t('history.fact.notOpened')}</li>
            </ul>
            <p className="muted">{t('history.openNote')}</p>
            <Toolbar>
              <Button onClick={() => void open(rst.result.target_estate_id)} disabled={opening.kind === 'opening'}>{t('history.open')}</Button>
              <Button tone="ghost" onClick={onClose}>{t('history.stay')}</Button>
            </Toolbar>
          </>
        )}
        {opening.kind === 'opening' && <p className="muted" role="status">{t('history.opening')}</p>}
        {opening.kind === 'failed' && <Banner tone="warn">{t('history.openFailed', { reason: openReason(opening.reason) })}</Banner>}

        {/* ER-10: a list that could not be read is said, with Check again — never shown as nothing waiting. */}
        {opsUnread && (
          <Banner tone="warn" actions={<Button tone="ghost" onClick={() => void refreshOperations()}>{t('history.checkAgain')}</Button>}>
            {pending === null && <p>{t('history.pending.unread')}</p>}
            {restoredEstates === null && <p>{t('history.restoredList.unread')}</p>}
          </Banner>
        )}
        {/* A5-014: a restore left waiting outlives the panel and a restart; it is checked by its own operation. */}
        {waiting.length > 0 && (
          <>
            <h3 className="task-history-head">{t('history.pending.title')}</h3>
            <div className="widget-list">
              {waiting.map(p => (
                <Toolbar key={p.operation_id}>
                  <span>{t('history.pending.item', { name: p.name })}</span>
                  <Button tone="ghost" onClick={() => void check(p.operation_id)} disabled={rst.kind === 'restoring'}>{t('history.checkNamed', { name: p.name })}</Button>
                </Toolbar>
              ))}
            </div>
          </>
        )}
        {/* A3-005: "open the restored one later" — every Estate this Mac restored for you, other than the one open. */}
        {openable.length > 0 && (
          <>
            <h3 className="task-history-head">{t('history.restoredList.title')}</h3>
            <div className="widget-list">
              {openable.map(e => (
                <Toolbar key={e.target_estate_id}>
                  <Button tone="ghost" onClick={() => void open(e.target_estate_id)} disabled={opening.kind === 'opening'}>{t('history.openNamed', { name: e.name })}</Button>
                </Toolbar>
              ))}
            </div>
          </>
        )}
      </Panel>
    </aside>
  )
}

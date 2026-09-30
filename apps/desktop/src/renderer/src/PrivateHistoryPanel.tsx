// Private history (SCR-65 · SCN-097) and restore into a fresh Estate (SCR-48 · SCN-065),
// first-slice plan A1-6c. Main owns the files, the folder dialog and the operator's identity;
// this panel holds a token, never a path, and says what each step made true.

import { useEffect, useState } from 'react'
import type { HistoryArchiveSummary, HistoryExport, HistoryRestored } from '../../shared/types'
import { Banner, Button, EmptyState, Field, Panel, Toolbar } from './components'
import { useT } from './i18n'

type Refusal = { ok: false; state: 'refused' | 'result_unknown'; reason_code: string; operation_id?: string }
type ExportView = { kind: 'idle' } | { kind: 'exporting' } | { kind: 'exported'; name: string } | { kind: 'refused'; reason: string }
type RestoreView =
  | { kind: 'empty' } | { kind: 'verifying' } | { kind: 'refused'; reason: string } | { kind: 'ready'; archive: HistoryArchiveSummary }
  | { kind: 'restoring' } | { kind: 'unknown'; operationId: string } | { kind: 'restored'; result: HistoryRestored } | { kind: 'opening' }

const REASONS = ['invalid_json', 'too_large', 'invalid_archive', 'integrity_mismatch', 'unsupported_schema', 'archive_stale', 'idempotency_conflict', 'not_found', 'unavailable'] as const

export function PrivateHistoryPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const t = useT()
  const [list, setList] = useState<HistoryExport[] | null>(null)
  const [exp, setExp] = useState<ExportView>({ kind: 'idle' })
  const [rst, setRst] = useState<RestoreView>({ kind: 'empty' })
  const [name, setName] = useState('')
  const reason = (code: string): string => t(`history.reason.${(REASONS as readonly string[]).includes(code) ? code : 'unavailable'}` as 'history.reason.unavailable')

  const refresh = async (): Promise<void> => {
    try { setList(await window.fabric.history.list()) } catch { /* Not silence: an unreadable list stays "unknown", never "none". */ setList(null) }
  }
  useEffect(() => { void refresh() }, [])

  const doExport = async (): Promise<void> => {
    setExp({ kind: 'exporting' })
    const r = await window.fabric.history.export()
    setExp(r.ok ? { kind: 'exported', name: r.name } : { kind: 'refused', reason: (r as Refusal).reason_code })
    await refresh()
  }
  const choose = async (): Promise<void> => {
    setRst({ kind: 'verifying' })
    const r = await window.fabric.history.choose()
    if (r === null) return setRst({ kind: 'empty' })
    setRst(r.ok ? { kind: 'ready', archive: r } : { kind: 'refused', reason: (r as Refusal).reason_code })
  }
  const settle = (r: { ok: true } & HistoryRestored | Refusal): void =>
    setRst(r.ok ? { kind: 'restored', result: r } : r.state === 'result_unknown' && r.operation_id ? { kind: 'unknown', operationId: r.operation_id } : { kind: 'refused', reason: r.reason_code })
  const restore = async (archive: HistoryArchiveSummary): Promise<void> => {
    setRst({ kind: 'restoring' })
    settle(await window.fabric.history.restore(archive.token, name.trim()) as { ok: true } & HistoryRestored | Refusal)
  }
  const check = async (operationId: string): Promise<void> => {
    setRst({ kind: 'restoring' })
    settle(await window.fabric.history.check(operationId) as { ok: true } & HistoryRestored | Refusal)
  }
  const open = async (estateId: string): Promise<void> => {
    setRst({ kind: 'opening' })
    const r = await window.fabric.history.open(estateId)
    if (!r.ok) setRst({ kind: 'refused', reason: 'unavailable' })
  }

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
        {rst.kind === 'refused' && <Banner tone="warn">{t('history.refused', { reason: reason(rst.reason) })}</Banner>}
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
              <li>{rst.result.private_history ? t('history.fact.private') : t('history.fact.noPrivate')}</li>
              <li>{t('history.fact.notOpened')}</li>
            </ul>
            <p className="muted">{t('history.openNote')}</p>
            <Toolbar>
              <Button onClick={() => void open(rst.result.target_estate_id)}>{t('history.open')}</Button>
              <Button tone="ghost" onClick={onClose}>{t('history.stay')}</Button>
            </Toolbar>
          </>
        )}
        {rst.kind === 'opening' && <p className="muted" role="status">{t('history.opening')}</p>}
      </Panel>
    </aside>
  )
}

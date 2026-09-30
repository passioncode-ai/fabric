// The conversation with Fabric (SCR-64 · SCN-042 · FLW-57), first-slice plan C4.
//
// EVERY STATE SAYS WHAT IS TRUE, AND NOTHING MORE. A draft is "saved on this Mac"; a send is
// "saved, no reply yet" — no typing indicator, no reply claimed; an unknown result is checked
// with the same operation, never resent; an unreadable history is not an empty conversation.
// Until private recovery is available the gate is closed (C5): Send is off and says why, and
// the draft still saves.
//
// Identity never comes from here: `window.fabric.ceo` takes no Person, Estate or credential.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CeoChatReply, CeoChatStatus, ProjectRow } from '../../shared/types'
import { Banner, Button, EmptyState, Panel, Toolbar } from './components'
import { useT } from './i18n'

const newId = (): string => crypto.randomUUID()
const NONE = { schema: 'CeoContext@1', mode: 'none', selection_revision: 0, project_id: null, project_revision: null, estate_seq: 0 } as const
type Scope = { kind: 'none' } | { kind: 'project'; project: ProjectRow } | { kind: 'all' }
type View = 'loading' | 'ready' | 'recovery' | 'denied' | 'error'
interface Kept { conversation_id: string; preview: string; blockedBy: 'unresolved_send' | null; actions: string[] }
interface KeptSend { conversation_id: string; operation_id: string; status: string; actions: string[] }
interface Inventory { revision: string; drafts: Kept[]; sends: KeptSend[]; capacity: { drafts: number; draftLimit: number; unresolved: number; unresolvedLimit: number; full: boolean } }
interface Message { message_id: string; envelope: { text: string } | null; content_state: string }
type SendState = { kind: 'pending' } | { kind: 'unknown'; operationId: string } | { kind: 'refused'; reason: string; operationId: string } | null

const REASONS = ['offline', 'local_capacity', 'unresolved_send', 'unavailable', 'retry_limit'] as const
function call(method: string, args: Record<string, unknown>) {
  return window.fabric.ceo.call(method as never, args)
}
const value = <T,>(r: CeoChatReply): T => (r.ok ? (r.value as T) : (null as T))

export function CeoChat({ onClose, projects, suggestion }: {
  onClose: () => void
  projects: ProjectRow[] | null
  /** An example from Help (SCR-44) put in the composer — only when no draft is kept there: a
   *  saved draft is the operator's words and an example must never overwrite them. Not sent. */
  suggestion?: string | null
}): React.JSX.Element {
  const t = useT()
  const [status, setStatus] = useState<CeoChatStatus | null>(null)
  const [view, setView] = useState<View>('loading')
  const [conversation, setConversation] = useState<string>(newId)
  // Conversations that exist on the server: opened here, or holding an accepted send. Only these
  // are read; a new one is opened before its first send (C5, found in the real app run).
  const opened = useRef(new Set<string>())
  const [text, setText] = useState('')
  const [scope, setScope] = useState<Scope>({ kind: 'none' })
  const [unsupported, setUnsupported] = useState(false)
  const [note, setNote] = useState<'saved' | 'recovered' | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [sendState, setSendState] = useState<SendState>(null)
  const revision = useRef<string | null>(null)
  const selections = useRef(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)
  const active = status?.active === true

  const failView = (r: CeoChatReply): void => {
    if (r.ok) return
    setView(r.reason_code === 'local_recovery_required' ? 'recovery' : r.reason_code === 'unavailable' ? 'denied' : 'error')
  }

  const context = (): Record<string, unknown> =>
    scope.kind === 'project'
      ? { ...NONE, mode: 'one', selection_revision: selections.current, project_id: scope.project.id, project_revision: scope.project.config_revision }
      : { ...NONE, selection_revision: selections.current }

  const load = useCallback(async (target?: string) => {
    setView('loading')
    try {
      const s = await window.fabric.ceo.status()
      setStatus(s)
      const inv = await call('inventory', {})
      if (!inv.ok) return failView(inv)
      const list = value<Inventory>(inv)
      setInventory(list)
      for (const k of list.sends) if (k.status === 'accepted_pending') opened.current.add(k.conversation_id)
      const id = target ?? list.sends[0]?.conversation_id ?? list.drafts[0]?.conversation_id ?? conversation
      await window.fabric.ceo.select(id)
      setConversation(id)
      const r = await call('readDraft', { conversationId: id })
      if (!r.ok) return failView(r)
      const d = value<{ revision: string; local_status: string; draft: { text: string } | null; intents: { status: string; operation_id: string; reason_code: string | null }[] }>(r)
      revision.current = d.revision
      setText(d.draft?.text || suggestion || '')
      setNote(d.local_status === 'recovered' ? 'recovered' : null)
      const intent = d.intents.find(i => i.status !== 'accepted_pending') ?? d.intents.at(-1)
      setSendState(!intent ? null : intent.status === 'accepted_pending' ? { kind: 'pending' }
        : intent.status === 'commit_unknown' ? { kind: 'unknown', operationId: intent.operation_id }
        : intent.status === 'refused' ? { kind: 'refused', reason: intent.reason_code ?? 'unavailable', operationId: intent.operation_id } : null)
      if (s.active && opened.current.has(id)) {
        const m = await call('read', { conversationId: id, afterOrdinal: 0, limit: 50 })
        if (!m.ok && m.reason_code !== 'superseded') return failView(m)
        setMessages(m.ok ? value<{ messages: Message[] }>(m).messages : [])
      } else setMessages([])
      setView('ready')
    } catch {
      // Not silence: an IPC failure is the error state, which keeps the draft and says so.
      setView('error')
    }
  }, [conversation])

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (next: string): Promise<void> => {
    dirty.current = false
    const r = await call('saveDraft', { conversationId: conversation, expectedRevision: revision.current,
      draft: { text: next, context: context(), expected_revision: messages.length, subject_revision: 0 } })
    if (r.ok) { revision.current = value<{ revision: string }>(r).revision; setNote('saved'); setConflict(null); return }
    if (r.reason_code === 'draft_conflict') {
      // The newer text wins and is shown; mine can still be copied.
      const fresh = await call('readDraft', { conversationId: conversation })
      if (fresh.ok) { const d = value<{ revision: string; draft: { text: string } | null }>(fresh); revision.current = d.revision; setText(d.draft?.text ?? ''); setConflict(next) }
      return
    }
    if (r.reason_code === 'local_capacity' || r.reason_code === 'local_capacity_or_invalid') { await refreshInventory(); setShowHistory(true); return }
    failView(r)
  }, [conversation, scope, messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshInventory = async (): Promise<void> => { const r = await call('inventory', {}); if (r.ok) setInventory(value<Inventory>(r)) }

  const onType = (next: string): void => {
    setText(next); dirty.current = true
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void save(next) }, 400)
  }
  const flush = async (): Promise<void> => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    if (dirty.current) await save(text)
  }
  const minimise = async (): Promise<void> => { await flush(); onClose() }

  const send = async (): Promise<void> => {
    if (!active || !text.trim()) return
    await flush()
    const operationId = newId()
    if (!opened.current.has(conversation)) {
      // A global conversation is its own subject (migration 64); opening again is idempotent.
      const o = await call('open', { operationId: newId(), conversationId: conversation, subjectKind: 'global', subjectId: conversation })
      if (!o.ok) return void setSendState({ kind: 'refused', reason: o.reason_code, operationId })
      opened.current.add(conversation)
    }
    const frozen = await call('freezeSend', { conversationId: conversation, expectedRevision: revision.current, operationId, messageId: newId() })
    if (!frozen.ok) return void setSendState({ kind: 'refused', reason: frozen.reason_code, operationId })
    setSendState({ kind: 'pending' })
    const r = await call('send', { conversationId: conversation, operationId })
    if (r.ok && r.state === 'accepted_pending') { await load(conversation); return }
    if (!r.ok && r.state === 'commit_unknown') return void setSendState({ kind: 'unknown', operationId })
    if (!r.ok) setSendState({ kind: 'refused', reason: r.reason_code, operationId })
  }
  const checkAgain = async (operationId: string): Promise<void> => {
    const r = await call('reconcile', { conversationId: conversation, operationId })
    if (r.ok) await load(conversation)
    else setSendState(r.state === 'commit_unknown' ? { kind: 'unknown', operationId } : { kind: 'refused', reason: r.reason_code, operationId })
  }
  const pick = (next: Scope): void => {
    if (next.kind === 'all') { setUnsupported(true); return } // refused visibly; the choice is not applied
    setUnsupported(false); selections.current++; setScope(next)
    if (text.trim()) { dirty.current = true; void save(text) }
  }
  const keyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Escape') { e.preventDefault(); void minimise(); return }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send() }
  }
  const act = async (kind: string, item: { conversation_id: string; operation_id?: string }): Promise<void> => {
    const rev = inventory?.revision ?? null
    if (kind === 'discard') await call('discardDraft', { conversationId: item.conversation_id, expectedRevision: rev })
    else if (kind === 'forget') await call('forgetSettled', { conversationId: item.conversation_id, operationId: item.operation_id, expectedRevision: rev })
    else if (kind === 'reconcile') await call('reconcile', { conversationId: item.conversation_id, operationId: item.operation_id })
    await refreshInventory()
  }
  const reason = (code: string): string => t(`chat.reason.${(REASONS as readonly string[]).includes(code) ? code : 'other'}` as 'chat.reason.other')
  const scopeLabel = scope.kind === 'project' ? scope.project.name : t('chat.scope.none')
  const full = inventory?.capacity.full === true

  return (
    <aside className="ceo-panel" aria-label={t('chat.title')}>
      <Panel
        title={<>{t('chat.title')}<span className="muted"> · {scopeLabel}</span></>}
        actions={
          <Toolbar align="end">
            <Button tone="ghost" aria-expanded={showHistory} onClick={() => { setShowHistory(v => !v); void refreshInventory() }}>{t('chat.history')}</Button>
            <Button tone="ghost" onClick={() => { void flush().then(() => { setConversation(newId()); setText(''); setMessages([]); setSendState(null); revision.current = null; setNote(null) }) }}>{t('chat.new')}</Button>
            <Button tone="ghost" onClick={() => void minimise()}>{t('chat.close')}</Button>
          </Toolbar>
        }
      >
        {view === 'denied' ? (
          <EmptyState read>{t('chat.denied.title')} {t('chat.denied.body')}</EmptyState>
        ) : (
          <>
            <div className="chat-log" role="log" aria-live="polite">
              {view === 'loading' && <p className="muted">{t('chat.loading')}</p>}
              {view === 'recovery' && (
                <Banner tone="warn" actions={<Button tone="ghost" onClick={() => void load(conversation)}>{t('chat.checkAgain')}</Button>}>
                  <strong>{t('chat.recovery.title')}</strong> {t('chat.recovery.body')}
                </Banner>
              )}
              {view === 'error' && (
                <Banner tone="error" actions={<Button tone="ghost" onClick={() => void load(conversation)}>{t('chat.retryLoad')}</Button>}>
                  <strong>{t('chat.error.title')}</strong> {t('chat.error.body')}
                </Banner>
              )}
              {view === 'ready' && !active && (
                <EmptyState read><strong>{t('chat.notActivated.title')}</strong> {t('chat.notActivated.body')}</EmptyState>
              )}
              {view === 'ready' && active && messages.length === 0 && !sendState && (
                <EmptyState read><strong>{t('chat.empty.title')}</strong> {t('chat.empty.body')}</EmptyState>
              )}
              {messages.map(m => (
                <article key={m.message_id} className="chat-message">
                  <small className="muted">{t('chat.you')}</small>
                  <p>{m.envelope?.text ?? t('chat.unavailableText')}</p>
                  <p className="muted">{t('chat.pending')}</p>
                </article>
              ))}
              {sendState?.kind === 'pending' && <p className="muted" role="status">{t('chat.pending')}</p>}
              {sendState?.kind === 'unknown' && (
                <Banner tone="warn" actions={<Button tone="ghost" onClick={() => void checkAgain(sendState.operationId)}>{t('chat.checkAgain')}</Button>}>
                  {t('chat.unknown')}
                </Banner>
              )}
              {sendState?.kind === 'refused' && (
                <Banner tone="warn">{t('chat.refused', { reason: reason(sendState.reason) })}</Banner>
              )}
              {(full || showHistory) && inventory && (
                <section aria-label={t('chat.history')}>
                  {full && <p><strong>{t('chat.capacity.title')}</strong> {t('chat.capacity.body', { drafts: inventory.capacity.drafts, limit: inventory.capacity.draftLimit })}</p>}
                  {inventory.drafts.length === 0 && inventory.sends.length === 0 && <p className="muted">{t('chat.historyEmpty')}</p>}
                  <div className="widget-list">
                    {inventory.drafts.map(d => (
                      <div key={'d' + d.conversation_id} className="actions">
                        <span>{t('chat.draftItem', { preview: d.preview })}</span>
                        {d.actions.includes('discard') && <Button tone="quiet" onClick={() => void act('discard', d)}>{t('chat.discard')}</Button>}
                      </div>
                    ))}
                    {inventory.sends.map(x => (
                      <div key={'s' + x.operation_id} className="actions">
                        <span>{t(`chat.sendItem.${x.status}` as 'chat.sendItem.saved_locally')}</span>
                        {x.actions.includes('reconcile') && <Button tone="quiet" onClick={() => void act('reconcile', x)}>{t('chat.checkAgain')}</Button>}
                        {x.actions.includes('forget') && <Button tone="quiet" onClick={() => void act('forget', x)}>{t('chat.forget')}</Button>}
                      </div>
                    ))}
                  </div>
                  {inventory.sends.some(x => x.status === 'commit_unknown') && <p className="muted">{t('chat.unknownNotDiscardable')}</p>}
                </section>
              )}
            </div>

            <div className="chat-composer">
              <div role="group" aria-label={t('chat.scope.label')} className="actions">
                <Button tone="quiet" aria-pressed={scope.kind === 'none'} onClick={() => pick({ kind: 'none' })}>{t('chat.scope.none')}</Button>
                {(projects ?? []).filter(p => p.status === 'active').slice(0, 5).map(p => (
                  <Button key={p.id} tone="quiet" aria-pressed={scope.kind === 'project' && scope.project.id === p.id} onClick={() => pick({ kind: 'project', project: p })}>{p.name}</Button>
                ))}
                <Button tone="quiet" aria-pressed={false} onClick={() => pick({ kind: 'all' })}>{t('chat.scope.all')}</Button>
              </div>
              {unsupported && <p className="muted" role="alert">{t('chat.unsupported')}</p>}
              <label className="visually-hidden" htmlFor="ceo-chat-input">{t('chat.input.label')}</label>
              <textarea id="ceo-chat-input" rows={3} value={text} placeholder={t('chat.input.placeholder')}
                disabled={view === 'loading' || view === 'recovery'} onChange={e => onType(e.target.value)} onKeyDown={keyDown} />
              <Toolbar align="end">
                <Button onClick={() => void send()} disabled={!active || !text.trim()}>{t('chat.send')}</Button>
              </Toolbar>
              {!active && view === 'ready' && <p className="muted" role="status">{t('chat.notActivated.note')}</p>}
              {note === 'saved' && <p className="muted" role="status">{t('chat.saved')}</p>}
              {note === 'recovered' && <p className="muted" role="status">{t('chat.recovered')}</p>}
              {conflict !== null && (
                <Banner tone="warn" actions={<Button tone="ghost" onClick={() => { void navigator.clipboard?.writeText(conflict).catch(() => undefined) }}>{t('chat.conflict.copy')}</Button>}>
                  {t('chat.conflict')}
                </Banner>
              )}
            </div>
          </>
        )}
      </Panel>
    </aside>
  )
}

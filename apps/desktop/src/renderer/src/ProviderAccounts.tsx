// Which account is working, who could replace it, and why it will not (SCR-62).
//
// M199.ui. This view's whole content, on both installed builds, is the sentence
// explaining why automatic switching cannot act — `native-resume-ack` is
// unverified, so a running conversation is never moved. The card asks for that
// as an "explicit limitation", and the difference between a warning beside a
// working control and a sentence where somebody reaches for it is the whole
// point: the second one is read.
//
// THE RENDERER SUBMITS INTENT ONLY. Every view arrives built; every action goes
// out as an intent carrying the revision it was read at. Nothing here composes
// a principal, an actor or a decision — a window that has not read cannot
// write, and this file has no way to pretend otherwise.
//
// AND A NUMBER NOBODY READ IS NEVER SHOWN AS A NUMBER. `ShownHeadroom` is a
// union, so there is no nullable percentage for this file to default to zero —
// which renders a full tank for an account nobody asked about.

import { useT } from './i18n'
import type {
  AccountListView,
  AutoDecisionReceipt,
  AutoPolicyView,
  ConversationAccountView,
  ShownHeadroom
} from '../../shared/providerAccountViews'

/** The headroom, or the absence, and never a bare number. */
function Headroom({ headroom }: { headroom: ShownHeadroom }): React.JSX.Element {
  const t = useT()
  if (!headroom.known)
    return (
      <span className="headroom headroom-unknown" data-known="false" title={headroom.why}>
        {t('accounts.headroom.unknown')} — {headroom.why}
      </span>
    )
  return (
    <span className="headroom" data-known="true">
      {headroom.freePct}% · {t('accounts.headroom.age', { seconds: String(headroom.ageSeconds) })}
    </span>
  )
}

export interface ProviderAccountsProps {
  accounts: AccountListView
  conversation: ConversationAccountView | null
  auto: AutoPolicyView
  /** The last switch, or null when nothing has been switched. */
  receipt: AutoDecisionReceipt | null
  /** Intents. Each carries what the window READ, never what it decided. */
  onForget: (intent: { accountId: string; expectedRevision: string }) => void
  onSetDefault: (intent: { accountId: string; expectedRevision: string }) => void
  onEnrol: (intent: { conversationId: string; enrolled: boolean }) => void
  /** The revision every write must carry back. */
  expectedRevision: string
}

export function ProviderAccounts({
  accounts,
  conversation,
  auto,
  receipt,
  onForget,
  onSetDefault,
  onEnrol,
  expectedRevision
}: ProviderAccountsProps): React.JSX.Element {
  const t = useT()
  return (
    <section className="provider-accounts" aria-label={t('accounts.title')}>
      <h2>{t('accounts.title')}</h2>

      {/* THE LIMITATION FIRST, where somebody is about to reach for a control
          that will not do anything. A note under the switch is a note nobody
          reads until after they have tried. */}
      {accounts.limitation ? (
        <div className="limitation" role="note" data-testid="limitation">
          <strong>{t('accounts.limitation')}</strong>
          <p>{accounts.limitation}</p>
        </div>
      ) : null}

      <ul className="account-list">
        {accounts.rows.map((row) => (
          <li key={row.account.accountId} className="account-row">
            <span className="label">{row.account.label}</span>
            <span className="runtime">{row.account.runtime}</span>
            {/* The organisation and the email, which the view already limited
                to what a window may see. There is no subject here to leak. */}
            <span className="org">{row.account.org ?? '—'}</span>
            <Headroom headroom={row.headroom} />
            {row.account.isDefault ? (
              <span className="is-default" data-testid={`default-${row.account.accountId}`}>
                ★
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSetDefault({ accountId: row.account.accountId, expectedRevision })}
              >
                {t('accounts.system.default')}
              </button>
            )}
            <button
              type="button"
              disabled={!row.removable.allowed}
              // The reason is on the control rather than in a banner: a
              // disabled button with the explanation elsewhere is a button
              // somebody clicks twice and then reports as broken.
              title={row.removable.allowed ? t('accounts.remove') : row.removable.blockedBy.join('; ')}
              onClick={() => onForget({ accountId: row.account.accountId, expectedRevision })}
            >
              {row.removable.allowed ? t('accounts.remove') : t('accounts.remove.blocked')}
            </button>
            {row.blockers.length ? (
              <ul className="blockers">
                {row.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      {conversation ? (
        <div className="this-conversation" data-testid="this-conversation">
          <span className="label">{conversation.label}</span>
          <Headroom headroom={conversation.headroom} />
          <span className="pin" data-strength={conversation.pin.strength} title={conversation.pin.reason}>
            {conversation.pin.strength === 'pinned' ? t('accounts.pin.pinned') : t('accounts.pin.drifting')}
          </span>
          <label>
            <input
              type="checkbox"
              checked={conversation.enrolled}
              onChange={(e) =>
                onEnrol({ conversationId: conversation.conversationId, enrolled: e.currentTarget.checked })
              }
            />
            {t('accounts.auto.monitoring')}
          </label>
        </div>
      ) : null}

      <div className="auto-state" data-state={auto.state} data-testid="auto-state">
        <strong>{t(`accounts.auto.${auto.state}` as 'accounts.auto.off')}</strong>
        {/* The DECISION'S OWN WORDS. A re-description here would drift from the
            engine, and the operator would be reading a paraphrase of a rule. */}
        <p className="reason">{auto.reason}</p>
        <p className="next">{auto.nextCheckAt}</p>
        {auto.eligible.length ? (
          <p className="eligible">
            {t('accounts.eligible')}: {auto.eligible.join(', ')}
          </p>
        ) : null}
        {auto.excluded.length ? (
          <ul className="excluded" data-testid="excluded">
            {auto.excluded.map((e) => (
              <li key={e.accountId}>
                {e.accountId} — {e.why}
              </li>
            ))}
          </ul>
        ) : null}
        {/* BEFORE anything is enabled: which conversations this would touch. */}
        {auto.affectedConversations.length ? (
          <p className="affected" data-testid="affected">
            {t('accounts.affected')}: {auto.affectedConversations.join(', ')}
          </p>
        ) : null}
      </div>

      <div className="receipt" data-testid="receipt">
        {receipt ? (
          <>
            <strong>{receipt.trigger === 'auto' ? t('accounts.receipt.auto') : t('accounts.receipt.manual')}</strong>
            <span className="conversation">{receipt.conversationId}</span>
            <span className="from-to">
              {receipt.from ?? '—'} → {receipt.to ?? '—'}
            </span>
            <span className="phase">{receipt.phase}</span>
            <p className="reason">{receipt.reason}</p>
            <span className="at">{receipt.at}</span>
          </>
        ) : (
          <span>{t('accounts.receipt.none')}</span>
        )}
      </div>
    </section>
  )
}

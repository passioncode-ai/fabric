// #region act-drafts — docs: docs/ux/scenarios.md#scn-169-undo-an-act-or-read-why-it-cannot-be-undone
/**
 * Discard a draft, restore a draft (ADR-0160 §1, §2): the pair of one act. The draft itself is the person's own
 * words and stays in their local store (`onboardingDrafts.ts`); the record carries its name and the id it is kept by.
 */
import type { ActArgs, ActOutcome } from '../shared/acts.ts'
import type { ActCheck, ActExecutor } from './acts.ts'
import type { Drafts } from './onboardingDrafts.ts'

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const nameOf = (d: { name: string }): string | null => d.name.trim() || null

export function createDraftExecutors(drafts: Pick<Drafts, 'discard' | 'restore' | 'open' | 'kept'>): { 'draft.discard': ActExecutor; 'draft.restore': ActExecutor } {
  return {
    'draft.discard': {
      async check(args: ActArgs): Promise<ActCheck> {
        const tab = str(args.tab_id)
        return tab && drafts.open(tab) ? { ok: true } : { ok: false, why: 'draft_gone' }
      },
      async run(args: ActArgs): Promise<ActOutcome> {
        const done = drafts.discard(str(args.tab_id) ?? '')
        if (!done) throw new Error('there is no such draft')
        return {
          kind: 'draft.discard', projectId: null,
          subject: { type: 'draft', id: done.discardId, label: nameOf(done.draft) },
          said: { key: 'act.draft.discard', params: { draft: nameOf(done.draft) } },
          inverse: { kind: 'draft.restore', args: { discard_id: done.discardId } }
        }
      }
    },
    'draft.restore': {
      async check(args: ActArgs): Promise<ActCheck> {
        const id = str(args.discard_id)
        return id && drafts.kept(id) ? { ok: true } : { ok: false, why: 'draft_gone' }
      },
      async run(args: ActArgs): Promise<ActOutcome> {
        const back = drafts.restore(str(args.discard_id) ?? '')
        if (!back) throw new Error('that draft is no longer kept')
        return {
          kind: 'draft.restore', projectId: null,
          subject: { type: 'draft', id: back.tabId, label: nameOf(back.draft) },
          said: { key: 'act.draft.restore', params: { draft: nameOf(back.draft) } },
          inverse: { kind: 'draft.discard', args: { tab_id: back.tabId } }
        }
      }
    }
  }
}
// #endregion act-drafts

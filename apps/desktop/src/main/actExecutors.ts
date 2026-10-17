// #region act-executors — docs: docs/ux/scenarios.md#scn-169-undo-an-act-or-read-why-it-cannot-be-undone
/**
 * The executors of the acts the database holds: a task moved, a claim released and taken again, a folder detached
 * and attached, a project renamed, an answered question reopened (ADR-0160 §2; 0.3.7 wave 2).
 *
 * Each act and its inverse go through the SAME rules the act had: a task moves along the ladder (`mayMove`), a folder
 * is attached only if no other project holds it, a claim is taken only where the lease is free. So an undo meets
 * what the world is now, and says so, instead of overwriting it (SCN-169: «changed since»).
 *
 * Writes go through the commands and events that already exist (`task.moved@1`, `work.released@1` through
 * `releaseByOperator`, `work.claimed@1`, `project.repo.*@1`, `project.updated@1`) plus the one new command,
 * `reopen_answered_question` (migration 112).
 */
import type { Journal } from '@fabric/journal'
import type { createScopedStore } from './scopedStore.ts'
import type { ActArgs, ActActor, ActOutcome } from '../shared/acts.ts'
import { mayMove, TERMINAL, type TaskState } from '../shared/ladder.ts'
import { releaseByOperator } from './workRelease.ts'
import type { ActCheck, ActExecutor } from './acts.ts'

type Store = ReturnType<typeof createScopedStore>
type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>

export interface ActWorldDeps {
  store: Store
  journal: Pick<Journal, 'append'>
  estateId: string
  /** The operator, established at bootstrap. */
  actor: ActActor
  rpc: Rpc
  /** Is this console or enrolled session still here (a released claim is taken again only for an owner that is). */
  sessionLive(sessionId: string): boolean
  pathExists(path: string): boolean
  newId(): string
  now(): number
  /** After the folders of a project changed (the file roots follow them). */
  foldersChanged?(): Promise<void>
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const CLAIM_MINUTES = 30
const nameOf = (r: { title?: string | null; instruction?: string | null }): string | null =>
  (r.title ?? r.instruction ?? '').trim().slice(0, 120) || null

export function createWorldExecutors(d: ActWorldDeps): Partial<Record<'task.move' | 'repo.detach' | 'repo.attach' | 'claim.release' | 'claim.take' | 'project.rename' | 'question.reopen', ActExecutor>> {
  const one = async <T>(table: string, columns: string, col: string, id: string): Promise<T | null> => {
    const { data, error } = await d.store.select(table, columns).eq(col, id).maybeSingle()
    if (error) throw new Error(`${table} could not be read: ${error.message}`)
    return (data as T | null) ?? null
  }

  // ── a task moved on the board ────────────────────────────────────────────────────────────────────────────
  type TaskRow = { id: string; project_id: string; status: TaskState; title: string | null; instruction: string | null }
  const taskMove: ActExecutor = {
    async check(args: ActArgs): Promise<ActCheck> {
      const id = str(args.task_id), to = str(args.to) as TaskState | null
      if (!id || !to) return { ok: false, why: 'invalid' }
      const t = await one<TaskRow>('project_tasks', 'id,project_id,status,title,instruction', 'id', id)
      if (!t) return { ok: false, why: 'task_gone' }
      if (t.status === to) return { ok: false, why: 'already_there', says: `the task is already in ${to}` }
      const verdict = mayMove('person', t.status, to)
      if (!verdict.ok) return { ok: false, why: 'ladder', says: verdict.reason }
      const expect = str(args.expect)
      return { ok: true, ...(expect && expect !== t.status ? { changedSince: t.status } : {}) }
    },
    async run(args: ActArgs): Promise<ActOutcome> {
      const id = str(args.task_id)!, to = str(args.to) as TaskState
      const t = await one<TaskRow>('project_tasks', 'id,project_id,status,title,instruction', 'id', id)
      if (!t) throw new Error('that task no longer exists')
      const event = await d.journal.append({ estateId: d.estateId, type: 'task.moved@1', actor: d.actor, projectId: t.project_id, payload: { task_id: id, from: t.status, to } })
      const closed = (TERMINAL as readonly string[]).includes(to)
      return {
        kind: 'task.move', projectId: t.project_id, refSeq: event.seq,
        subject: { type: 'task', id, label: nameOf(t) },
        said: { key: 'act.task.move', params: { task: nameOf(t), from: t.status, to } },
        ...(closed ? { inverse: null, whyNot: 'task_closed' as const } : { inverse: { kind: 'task.move' as const, args: { task_id: id, to: t.status, expect: to } } })
      }
    }
  }

  // ── a folder detached from a project, and attached again ─────────────────────────────────────────────────
  type RepoRow = { id: string; project_id: string; path: string; label: string | null }
  const repoDetach: ActExecutor = {
    async check(args: ActArgs): Promise<ActCheck> {
      const id = str(args.repo_id)
      return id && (await one<RepoRow>('project_repos', 'id,project_id,path,label', 'id', id)) ? { ok: true } : { ok: false, why: 'folder_gone' }
    },
    async run(args: ActArgs): Promise<ActOutcome> {
      const id = str(args.repo_id)!
      const r = await one<RepoRow>('project_repos', 'id,project_id,path,label', 'id', id)
      if (!r) throw new Error('that folder is no longer attached')
      const event = await d.journal.append({ estateId: d.estateId, type: 'project.repo.detached@1', actor: d.actor, projectId: r.project_id, payload: { id } })
      await d.foldersChanged?.()
      return {
        kind: 'repo.detach', projectId: r.project_id, refSeq: event.seq,
        subject: { type: 'repo', id, label: r.label ?? r.path.split('/').filter(Boolean).pop() ?? r.path },
        said: { key: 'act.repo.detach', params: { folder: r.label ?? r.path } },
        inverse: { kind: 'repo.attach', args: { project_id: r.project_id, repo_id: id, path: r.path, label: r.label } }
      }
    }
  }
  const repoAttach: ActExecutor = {
    async check(args: ActArgs): Promise<ActCheck> {
      const projectId = str(args.project_id), p = str(args.path)
      if (!projectId || !p) return { ok: false, why: 'invalid' }
      if (!(await one<{ id: string }>('projects', 'id', 'id', projectId))) return { ok: false, why: 'project_gone' }
      if (!d.pathExists(p)) return { ok: false, why: 'folder_gone' }
      const { data, error } = await d.store.select('project_repos', 'id,project_id').eq('path', p)
      if (error) throw new Error(`folders could not be read: ${error.message}`)
      const held = ((data ?? []) as Array<{ id: string; project_id: string }>)[0]
      if (held) return { ok: false, why: held.project_id === projectId ? 'already_attached' : 'held_by_other_project' }
      return { ok: true }
    },
    async run(args: ActArgs): Promise<ActOutcome> {
      const projectId = str(args.project_id)!, p = str(args.path)!
      const id = str(args.repo_id) ?? d.newId()
      const label = str(args.label) ?? (p.split('/').filter(Boolean).pop() ?? p)
      const event = await d.journal.append({ estateId: d.estateId, type: 'project.repo.attached@1', actor: d.actor, projectId, payload: { id, path: p, label } })
      await d.foldersChanged?.()
      return {
        kind: 'repo.attach', projectId, refSeq: event.seq,
        subject: { type: 'repo', id, label },
        said: { key: 'act.repo.attach', params: { folder: label } },
        inverse: { kind: 'repo.detach', args: { repo_id: id } }
      }
    }
  }

  // ── a claim released, and taken again ───────────────────────────────────────────────────────────────────
  type ClaimRow = { id: string; work_id: string; project_id: string; owner_session: string; agent: string | null; came_in: string | null; touches: string[] | null; released_at: string | null }
  const CLAIM_COLUMNS = 'id,work_id,project_id,owner_session,agent,came_in,touches,released_at'
  const taskTitle = async (workId: string): Promise<string | null> => {
    const t = await one<TaskRow>('project_tasks', 'id,project_id,status,title,instruction', 'id', workId)
    return t ? nameOf(t) : null
  }
  const claimRelease: ActExecutor = {
    async check(args: ActArgs): Promise<ActCheck> {
      const id = str(args.claim_id)
      const c = id ? await one<ClaimRow>('work_claims', CLAIM_COLUMNS, 'id', id) : null
      if (!c) return { ok: false, why: 'claim_gone' }
      return c.released_at ? { ok: false, why: 'already_released' } : { ok: true }
    },
    async run(args: ActArgs): Promise<ActOutcome> {
      const id = str(args.claim_id)!
      const c = await one<ClaimRow>('work_claims', CLAIM_COLUMNS, 'id', id)
      if (!c) throw new Error('that claim no longer exists')
      const done = await releaseByOperator(d.store, (e) => d.journal.append({ estateId: d.estateId, ...e }), d.actor, id)
      if (!done.released) throw new Error(`the claim was not released (${done.reason})`)
      const title = await taskTitle(c.work_id)
      return {
        kind: 'claim.release', projectId: c.project_id,
        subject: { type: 'claim', id, label: title },
        said: { key: 'act.claim.release', params: { task: title, agent: c.agent } },
        inverse: { kind: 'claim.take', args: { claim_id: id } }
      }
    }
  }
  const claimTake: ActExecutor = {
    async check(args: ActArgs): Promise<ActCheck> {
      const id = str(args.claim_id)
      const c = id ? await one<ClaimRow>('work_claims', CLAIM_COLUMNS, 'id', id) : null
      if (!c) return { ok: false, why: 'claim_gone' }
      if (!c.released_at) return { ok: false, why: 'already_held' }
      if (!d.sessionLive(c.owner_session)) return { ok: false, why: 'owner_gone' }
      const lease = await one<{ owner_session: string; expires_at: string }>('leases', 'owner_session,expires_at', 'work_id', c.work_id)
      if (lease && Date.parse(lease.expires_at) > d.now())
        return { ok: false, why: lease.owner_session === c.owner_session ? 'already_held' : 'held_by_other' }
      return { ok: true }
    },
    async run(args: ActArgs): Promise<ActOutcome> {
      const id = str(args.claim_id)!
      const c = await one<ClaimRow>('work_claims', CLAIM_COLUMNS, 'id', id)
      if (!c) throw new Error('that claim no longer exists')
      const claimId = d.newId()
      const event = await d.journal.append({
        estateId: d.estateId, type: 'work.claimed@1', actor: d.actor, projectId: c.project_id,
        payload: {
          work: c.work_id, owner: c.owner_session, idempotency_key: `undo:${id}:${claimId}`,
          expires_at: new Date(d.now() + CLAIM_MINUTES * 60_000).toISOString(),
          write_scopes: c.touches ?? [], claim_id: claimId, agent: c.agent, came_in: c.came_in ?? 'unknown'
        }
      })
      const settled = await one<ClaimRow>('work_claims', CLAIM_COLUMNS, 'id', claimId)
      if (!settled || settled.released_at) throw new Error('the task was taken by someone else in the same moment; the claim was not restored')
      const title = await taskTitle(c.work_id)
      return {
        kind: 'claim.take', projectId: c.project_id, refSeq: event.seq,
        subject: { type: 'claim', id: claimId, label: title },
        said: { key: 'act.claim.take', params: { task: title, agent: c.agent } },
        inverse: { kind: 'claim.release', args: { claim_id: claimId } }
      }
    }
  }

  // ── a project renamed (or its purpose changed) ──────────────────────────────────────────────────────────
  type ProjectRow = { id: string; name: string; purpose: string | null }
  const projectRename: ActExecutor = {
    async check(args: ActArgs): Promise<ActCheck> {
      const id = str(args.project_id)
      if (!id) return { ok: false, why: 'invalid' }
      const p = await one<ProjectRow>('projects', 'id,name,purpose', 'id', id)
      if (!p) return { ok: false, why: 'project_gone' }
      const changedSince = Object.hasOwn(args, 'expect_name') && args.expect_name !== p.name ? p.name : undefined
      return { ok: true, ...(changedSince ? { changedSince } : {}) }
    },
    async run(args: ActArgs): Promise<ActOutcome> {
      const id = str(args.project_id)!
      const p = await one<ProjectRow>('projects', 'id,name,purpose', 'id', id)
      if (!p) throw new Error('that project no longer exists')
      const payload: Record<string, unknown> = { id }
      const back: ActArgs = { project_id: id }
      if (Object.hasOwn(args, 'name') && typeof args.name === 'string') { payload.name = args.name.trim(); back.name = p.name; back.expect_name = String(payload.name) }
      if (Object.hasOwn(args, 'purpose')) {
        const next = typeof args.purpose === 'string' ? args.purpose.trim() || null : null
        payload.purpose = next; back.purpose = p.purpose
      }
      const event = await d.journal.append({ estateId: d.estateId, type: 'project.updated@1', actor: d.actor, projectId: id, payload })
      const renamed = payload.name !== undefined && payload.name !== p.name
      return {
        kind: 'project.rename', projectId: id, refSeq: event.seq,
        subject: { type: 'project', id, label: String(payload.name ?? p.name) },
        said: { key: renamed ? 'act.project.rename' : 'act.project.edit', params: { from: p.name, to: String(payload.name ?? p.name) } },
        inverse: { kind: 'project.rename', args: back }
      }
    }
  }

  // ── an answered question reopened ───────────────────────────────────────────────────────────────────────
  type QuestionRow = { id: string; project_id: string; status: string; text: string }
  const questionReopen: ActExecutor = {
    async check(args: ActArgs): Promise<ActCheck> {
      const id = str(args.question_id)
      if (!id) return { ok: false, why: 'invalid' }
      const q = await one<QuestionRow>('questions', 'id,project_id,status,text', 'id', id)
      if (!q) return { ok: false, why: 'question_gone' }
      return q.status === 'answered' ? { ok: true } : { ok: false, why: 'not_answered' }
    },
    async run(args: ActArgs): Promise<ActOutcome> {
      const id = str(args.question_id)!
      const q = await one<QuestionRow>('questions', 'id,project_id,status,text', 'id', id)
      if (!q) throw new Error('that question no longer exists')
      const { data, error } = await d.rpc('reopen_answered_question', {
        p_estate_id: d.estateId, p_project_id: q.project_id, p_question_id: id, p_command_id: d.newId(), p_actor: d.actor
      })
      if (error) throw new Error(`the question was not reopened: ${error.message}`)
      const seq = Number((data as { reopened_seq?: number } | null)?.reopened_seq)
      return {
        kind: 'question.reopen', projectId: q.project_id, refSeq: Number.isSafeInteger(seq) ? seq : null,
        subject: { type: 'question', id, label: q.text.slice(0, 120) },
        said: { key: 'act.question.reopen', params: { question: q.text } },
        inverse: null, whyNot: 'answer_needs_person'
      }
    }
  }

  return {
    'task.move': taskMove, 'repo.detach': repoDetach, 'repo.attach': repoAttach, 'claim.release': claimRelease,
    'claim.take': claimTake, 'project.rename': projectRename, 'question.reopen': questionReopen
  }
}
// #endregion act-executors

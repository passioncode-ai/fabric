/**
 * A session's tools for ITS project only (the scope wall): what the project is (W2-3, `fabric_project_profile`) and its
 * folders (CO-489, attach and detach as the project page's buttons). Moved out of `agentSurface.ts#serverFor` as one
 * group (the screens waves S2, 2026-11-16).
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FolderAnswer } from './agentFolders.ts'
import { writeAgentProfile } from './projectOnboarding.ts'
import { ops } from './opsSink.ts'

export interface ProjectToolsDeps {
  db: SupabaseClient
  /** The surface's journal append, payload scrubbed for an agent (`agentSurface.ts#appendRedacted`). */
  append(input: { estateId: string; type: string; actor: { kind: string; id: string }; projectId?: string | null; payload: Record<string, unknown> }): Promise<{ seq: number }>
  /** The project page's folder buttons as the session's door (`agentFolders.ts`); absent, the tools say so. */
  folders(): {
    attach(projectId: string, folder: unknown, sessionId: string): Promise<FolderAnswer>
    detach(projectId: string, folder: unknown, sessionId: string): Promise<FolderAnswer>
  } | undefined
}

/** The session the tools act for: only its project is ever touched. */
export interface ProjectToolsScope { estateId: string; projectId: string; sessionId: string }

function json(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

export function registerProjectTools(server: McpServer, deps: ProjectToolsDeps, scope: ProjectToolsScope): void {
  // #region project-profile-tool — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
  // W2-3: the agent onboarding a project records what it is, for THIS project only (the scope wall). Every field is
  // optional and each call is one `project.profiled@1`; a field named replaces the page's value, an empty one clears it.
  server.registerTool(
    'fabric_project_profile',
    {
      title: 'Record what this project is',
      description:
        'Record what this project is, for the project page and the project graph: its goal, a one-line summary, the business it belongs to, its plan (done and next) and its relations to other projects. Write each in the working language fabric_whoami names (or the person\'s own, when it names none), as plain sentences the project\'s owner understands without context. Every field is optional: name only what you learned; a field you name replaces what was there, an empty string clears it, and relations, when given, replace the whole list. The business is the person\'s: you may record it only while the project has none and the person never set or cleared one; an empty business, a different one once it is set, or any once the person left it empty, is refused (the person sets it on the project page). When the business cannot be checked now, it is left unwritten, the other fields you named are written, and the answer\'s refused.business says why. Read the repository, its README, its remotes and the board before you write; never put a secret, a token or a private path here.',
      inputSchema: {
        goal: z.string().max(600).optional().describe('What the project is for and what it aims at now, one or two sentences'),
        summary: z.string().max(160).optional().describe('One line: what the project is'),
        business: z.string().max(80).optional().describe('The business or organization it belongs to, a short name, only while the project has none; the board never joins projects of two different businesses, and the person decides it'),
        plan: z
          .object({
            done: z.array(z.string().min(1).max(200)).max(20).describe('What is done, newest first'),
            next: z.array(z.string().min(1).max(200)).max(20).describe('What comes next, in order')
          })
          .optional(),
        relations: z
          .array(
            z.object({
              kind: z.enum(['depends-on', 'used-by', 'same-business', 'talks-to', 'other']),
              target: z.string().min(1).max(200).describe('The other project by its name, or a repository it uses'),
              note: z.string().max(500).optional()
            })
          )
          .max(50)
          .optional()
      }
    },
    async (args) => {
      // DA-2 / ER-2: the business is the person's; a read that fails refuses a business the call names (never writes
      // over a value it could not see) and writes the call's other fields, the answer naming the refused business in
      // `refused` (0.3.12 review i3 ER-4). 0.3.12 review i2 ER-2, DA-1, DA-2: the read,
      // the decision and the append run under the project's chain, which the person's write takes too; a business the
      // person ever wrote (or cleared) is never set by an agent. DA-9: a project this estate no longer holds is refused.
      const db = deps.db
      const answer = await writeAgentProfile({
        readProject: async () => {
          const { data, error } = await db.from('projects').select('business').eq('id', scope.projectId).eq('estate_id', scope.estateId).maybeSingle()
          return { row: error || !data ? null : { business: (data as { business: string | null }).business ?? null }, error: error?.message ?? null }
        },
        readPersonSet: async () => {
          const { data, error } = await db.from('journal').select('seq').eq('estate_id', scope.estateId).eq('project_id', scope.projectId)
            .eq('type', 'project.profiled@1').eq('actor->>kind', 'person').not('payload->business', 'is', null).limit(1)
          return { set: Array.isArray(data) && data.length > 0, error: error?.message ?? (error || Array.isArray(data) ? null : 'no list answered') }
        },
        append: (payload) => deps.append({ estateId: scope.estateId, type: 'project.profiled@1', actor: { kind: 'agent', id: scope.sessionId }, projectId: scope.projectId, payload }),
        failed: (what, error) => ops.failed(`agentSurface.${what}`, new Error(error), { projectId: scope.projectId })
      }, scope.projectId, args as Record<string, unknown>)
      return json(answer)
    }
  )
  // #endregion project-profile-tool

  // #region project-folder-tools — docs: docs/architecture/operating-surfaces.md#an-agent-attaches-its-projects-folders
  // CO-489: a session attaches or detaches a folder of ITS project only (the scope wall), as the page's buttons do.
  const folderTool = async (which: 'attach' | 'detach', folder: unknown) => {
    const door = deps.folders()
    if (!door) return json({ done: false, reason: 'unavailable', says: 'this Fabric cannot change folders from a session' })
    try {
      return json(await door[which](scope.projectId, folder, scope.sessionId))
    } catch (e) {
      ops.failed(`agentSurface.folder-${which}`, e, { projectId: scope.projectId })
      return json({ done: false, reason: 'failed', says: 'the folder could not be changed now; nothing was recorded as done' })
    }
  }
  server.registerTool(
    'fabric_project_folder_attach',
    {
      title: 'Attach a repository to this project',
      description:
        'Attach a repository folder to THIS session\'s project, as the project page\'s «Выбрать папку…» does: after a repository moved to a new path, or when the project works in a second checkout. The folder is taken by its real path; a home folder, a volume or a folder of projects is refused (too-broad), a folder another project holds is refused (held-by-other), a plain folder that is not a repository is refused (not-git), and a folder the person detached stays detached (detached: only the person attaches it again). The change is recorded with you as its author and the person can undo it from History. The answer lists the project\'s folders after the call.',
      inputSchema: { path: z.string().min(1).max(1024).describe('The folder, as an absolute path') }
    },
    async ({ path: folder }) => folderTool('attach', folder)
  )
  server.registerTool(
    'fabric_project_folder_detach',
    {
      title: 'Detach a folder from this project',
      description:
        'Detach one of THIS session\'s project\'s folders, as the project page\'s «Убрать» does, for a checkout that moved or was removed. Name it by the path fabric_whoami lists under repositories. Nothing on disk is touched. A detached folder is not enrolled again by itself, and the person can undo the change from History. The answer lists the project\'s folders after the call.',
      inputSchema: { path: z.string().min(1).max(1024).describe('The folder, as an absolute path') }
    },
    async ({ path: folder }) => folderTool('detach', folder)
  )
  // #endregion project-folder-tools
}

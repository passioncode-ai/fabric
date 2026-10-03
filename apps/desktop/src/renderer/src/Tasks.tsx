// The panel's main action: write what should happen, choose who does it, run.
// A task is the instruction plus the session it opened — thin on purpose. When
// the agent runtime lands (slice 3) a task becomes a Run over a graph and keeps
// this identity, so today's history survives that upgrade.

import { useEffect, useState } from 'react'
import { failed, forSubject, settled, type KeyedRead } from '../../shared/keyedRead'
import { loadInto, type TaskDraft } from '../../shared/taskDraft.ts'
import type { CreatedAgent, LaunchOption, ProjectRow, TaskRow } from '../../shared/types'
import { resolvePresets, type PresetInput, type TaskPreset } from '../../shared/presets.ts'
import { Banner, Button, Panel, Toolbar } from './components'
import { useT } from './i18n'
import { runnerLabel } from './runnerLabel'

/** Presets are content: a label and an instruction, both registry keys. The
 *  first one is what used to be the kickoff block.
 *
 *  A preset carrying a `source` READS the project (M121) and is offered only
 *  when that source has something in it — `presets.ts` says why, and owns the
 *  rule that a truncated list must say so. "Errors in production" is on M121's
 *  list and is deliberately NOT here: nothing in this product observes
 *  production yet (M129), and a shortcut that opens a session to look at a
 *  signal we do not collect is a promise the product cannot keep. */
const PRESETS: TaskPreset[] = [
  { id: 'context', labelKey: 'tasks.presetContext', instructionKey: 'tasks.presetContextText' },
  { id: 'audit', labelKey: 'tasks.presetAudit', instructionKey: 'tasks.presetAuditText' },
  { id: 'review', labelKey: 'tasks.presetReview', instructionKey: 'tasks.presetReviewText' },
  { id: 'tests', labelKey: 'tasks.presetTests', instructionKey: 'tasks.presetTestsText' },
  {
    id: 'backlog',
    labelKey: 'tasks.presetBacklog',
    instructionKey: 'tasks.presetBacklogText',
    source: 'backlog'
  },
  { id: 'bugs', labelKey: 'tasks.presetBugs', instructionKey: 'tasks.presetBugsText', source: 'bugs' }
]

export type { TaskDraft } from '../../shared/taskDraft.ts'

export function Tasks({
  project,
  onStarted,
  onError,
  reuse,
  onReuseHandled,
  draft,
  onDraftChange,
  feedMark
}: {
  project: ProjectRow
  draft?: TaskDraft | null
  /** A PATCH, merged by the owner. See the note where it is used. */
  onDraftChange?: (patch: Partial<TaskDraft>) => void
  onStarted: () => Promise<void> | void
  onError: (e: string) => void
  /** A past task the board asked to run again. `nonce` distinguishes two
   *  requests for the SAME task, which are two intentions, not one. */
  reuse?: { instruction: string; optionId: string; nonce: number } | null
  onReuseHandled?: () => void
  /**
   * The journal's mark for the news this screen depends on — task work and the
   * agents created in this project (UX28-02).
   *
   * MEASURED: the data-backed presets and the created-agent list were read once
   * per project mount and never again. Put a task in the backlog and the
   * "backlog" preset was not offered; create an agent and it was not there.
   * A mark rather than a count: the display feed is capped, so a length stops
   * changing and every reader keyed to it freezes (`check-feed-marks.mjs`).
   */
  feedMark: number
}): React.JSX.Element {
  const t = useT()
  // Read from the app, written back to it as a PATCH — not as a whole draft.
  //
  // The first version sent the whole object, built from this render's values,
  // and three setters in a row therefore overwrote each other: each wrote its
  // own field beside the OTHERS AS THEY WERE BEFORE the sequence began, so
  // `setInstruction(); setPreset(); setPresetText()` ended with the instruction
  // reverted. A patch merged by the owner is the only shape that survives
  // consecutive writes in one event handler.
  const instruction = draft?.instruction ?? ''
  const preset = draft?.preset ?? null
  const presetText = draft?.presetText ?? null
  const setInstruction = (v: string): void => onDraftChange?.({ instruction: v })
  const setPreset = (v: string | null): void => onDraftChange?.({ preset: v })
  const setPresetText = (v: string | null): void => onDraftChange?.({ presetText: v })
  const [agent, setAgent] = useState(project.default_agent)
  const [mode, setMode] = useState<string | null>(null)
  const [options, setOptions] = useState<LaunchOption[]>([])
  const [busy, setBusy] = useState(false)
  /** What the data-backed presets read. Empty until the read returns, so a
   *  preset appears when its source is known to be non-empty and never on the
   *  strength of not having looked yet. */
  const [sourcesRead, setSourcesRead] = useState<KeyedRead<PresetInput> | null>(null)
  /** M125 — agents created in this project, offered beside the runners. They
   *  are not runners: each names one and carries its own brief and reach. */
  const [madeRead, setMadeRead] = useState<KeyedRead<CreatedAgent[]> | null>(null)
  /** Something the operator asked to load while the field already held their
   *  own text — a preset, or a task to run again. `id` is null for a reuse:
   *  borrowed text never carries a borrowed preset's provenance (UX-14). */
  const [pending, setPending] = useState<{ id: string | null; text: string; agent?: string } | null>(null)

  // A reuse behaves exactly as a preset does when the field is not empty: it
  // ASKS. Silently replacing what someone typed is the same loss whether the
  // replacement came from a preset or from their own past task (UX-14).
  useEffect(() => {
    if (!reuse) return
    // `presetId: null` is the rule, not an omission: borrowed text does not
    // carry borrowed provenance (UX-14).
    const load = loadInto(draft ?? undefined, { text: reuse.instruction, presetId: null })
    if (load.kind === 'ask') {
      setPending({ id: null, text: reuse.instruction, agent: reuse.optionId })
    } else {
      onDraftChange?.(load.draft)
      setAgent(reuse.optionId)
    }
    onReuseHandled?.()
    // `draft` is read, not tracked: this fires on a NEW request only.
  }, [reuse?.nonce])

  // The project's own board is what the data-backed presets read, and it is
  // re-read when the journal says the board moved. A read that FAILS is said
  // out loud rather than left to look like an empty backlog: not offering a
  // preset is the same screen either way, and the two are not the same fact.
  useEffect(() => {
    const at = project.id
    window.fabric.tasks
      .list(at)
      .then(({ tasks: rows }) => {
        // The finished half may be capped (M190). This screen only picks
        // OPEN work out of the list — backlog and undone bugs — and open tasks
        // are never capped, so the truncation does not change what it shows.

        const pick = (f: (r: TaskRow) => boolean): PresetInput['backlog'] =>
          rows.filter(f).map((r) => ({ id: r.id, title: r.title, instruction: r.instruction }))
        setSourcesRead((cur) =>
          settled(cur, {
            subject: at,
            value: {
              backlog: pick((r) => r.status === 'backlog'),
              bugs: pick((r) => r.task_type === 'bug' && r.status !== 'done' && r.status !== 'cancelled')
            },
            at: Date.now()
          })
        )
      })
      // NOT `{}` (UX28-02). An empty source and an unreadable one produced the
      // same screen — the preset simply was not offered — so a database that
      // would not answer looked exactly like an empty backlog. The read carries
      // the failure and the panel says so.
      .catch((e) => setSourcesRead((cur) => failed(cur, { subject: at, why: String(e) })))
    window.fabric.agents
      .list(at)
      .then((value) => setMadeRead((cur) => settled(cur, { subject: at, value, at: Date.now() })))
      .catch((e) => setMadeRead((cur) => failed(cur, { subject: at, why: String(e) })))
  }, [project.id, feedMark])

  useEffect(() => {
    window.fabric.terminal
      .options()
      .then((o) => {
        setOptions(o)
        const wanted = o.find((x) => x.id === project.default_agent && x.available)
        setAgent(wanted ? wanted.id : (o.find((x) => x.available)?.id ?? project.default_agent))
      })
      .catch((e) => onError(String(e)))
  }, [project.default_agent])

  // Keyed on the way OUT as well as in: a reading belonging to the previous
  // project is refused rather than rendered under this one's name.
  const sourcesFor = forSubject(sourcesRead, project.id)
  const sources = sourcesFor.value ?? {}
  const madeFor = forSubject(madeRead, project.id)
  const made = madeFor.value ?? []

  const chosen = options.find((o) => o.id === agent)
  const modes = chosen?.permissionModes ?? []
  const chosenMode = modes.find((m) => m.id === mode)
  // Changing the agent changes what the modes MEAN, so the choice resets to
  // that agent's default rather than carrying a word from another vocabulary.
  useEffect(() => {
    setMode(chosen?.defaultMode ?? null)
  }, [agent, options.length])

  const run = async (): Promise<void> => {
    if (!instruction.trim() || busy) return
    setBusy(true)
    try {
      const { session } = await window.fabric.tasks.start({
        projectId: project.id,
        instruction,
        optionId: agent,
        preset: preset ?? undefined,
        presetEdited: preset !== null && instruction !== presetText,
        permissionMode: mode
      })
      setInstruction('')
      setPreset(null)
      setPresetText(null)
      await onStarted()
      await window.fabric.windows.openSession(session.sessionId)
    } catch (e) {
      onError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel id="sec-tasks" className="task-panel" title={t('tasks.title')}>
      <p className="muted">
        {project.repo_path ? t('tasks.ledeRepo', { repo: project.repo_path }) : t('tasks.ledeNoRepo')}
      </p>

      <label className="visually-hidden" htmlFor="task-instruction">
        {t('tasks.title')}
      </label>
      <textarea
        id="task-instruction"
        className="task-input"
        rows={3}
        value={instruction}
        placeholder={t('tasks.placeholder')}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => {
          // The product's primary action deserves a keyboard path.
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            void run()
          }
        }}
      />

      <Toolbar>
        <select value={agent} onChange={(e) => setAgent(e.target.value)}
          aria-label={t('agents.pickOption')}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id} disabled={!o.available}>
              {runnerLabel(o.id, t)}
              {o.available ? '' : ` — ${t('onboarding.unavailable')}`}
            </option>
          ))}
          {/* M125 — created agents, grouped apart from the runners. They are a
              different kind of thing: a runner is a program on this machine, an
              agent is a named configuration of one, and flattening them into a
              single list is how the operator stops being able to tell which is
              which. */}
          {made.length > 0 && (
            <optgroup label={t('agents.created')}>
              {made.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {/* The permission mode, chosen per launch. A blocked mode is SHOWN and
            disabled rather than hidden: the operator can read why it is not
            available, which is a decision they can argue with. */}
        {modes.length > 0 && (
          <select
            aria-label={t('agent.mode')}
            value={mode ?? ''}
            onChange={(e) => setMode(e.target.value)}
          >
            {modes.map((m) => (
              <option key={m.id} value={m.id} disabled={m.blockedKey !== null}>
                {t(m.labelKey as 'agent.mode.ask')}
                {m.blockedKey ? ` — ${t('agent.mode.blocked')}` : ''}
                {m.warnKey ? ` — ${t('agent.mode.warned')}` : ''}
              </option>
            ))}
          </select>
        )}
        {chosenMode?.warnKey && (
          <span className="muted">{t(chosenMode.warnKey as 'agent.mode.bypassWarn')}</span>
        )}
        <Button onClick={() => void run()} disabled={!instruction.trim() || busy}>
          {busy ? t('tasks.starting') : t('tasks.run')}
        </Button>
        {(sourcesFor.state === 'failed' || madeFor.state === 'failed') && (
          <p className="read-failed" data-testid="presets-failed">
            {t('reads.failed', {
              why: [sourcesFor.failedWhy, madeFor.failedWhy].filter(Boolean).join('; ')
            })}
          </p>
        )}
        <Toolbar>
          {resolvePresets(PRESETS, sources).map((p) => (
            <Button
              key={p.id}
              tone="quiet"
              onClick={() => {
                const text = t(p.instructionKey as Parameters<typeof t>[0], p.vars)
                const load = loadInto(draft ?? undefined, { text, presetId: p.id })
                if (load.kind === 'ask') setPending({ id: p.id, text })
                else onDraftChange?.(load.draft)
              }}
            >
              {t(p.labelKey as Parameters<typeof t>[0], p.vars)}
            </Button>
          ))}
        </Toolbar>
      </Toolbar>

      {pending && (
        <Banner
          tone="warn"
          actions={
            <>
              <Button tone="ghost" onClick={() => setPending(null)}>
                {t('common.keep')}
              </Button>
              <Button
                onClick={() => {
                  setInstruction(pending.text)
                  setPreset(pending.id)
                  setPresetText(pending.id === null ? null : pending.text)
                  if (pending.agent) setAgent(pending.agent)
                  setPending(null)
                }}
              >
                {t('common.replace')}
              </Button>
            </>
          }
        >
          {t('tasks.replaceConfirm')}
        </Banner>
      )}

    </Panel>
  )
}

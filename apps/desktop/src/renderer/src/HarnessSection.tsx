// What a session in this project is given (M145 · SCR-35).
//
// Read by the person who holds agents to account, so the SECOND half matters as
// much as the first: not only what a session can reach, but what it cannot.
// Sessions launch with strict MCP config, so exactly one server is visible and
// whatever else this machine has configured is not — an operator auditing that
// otherwise has to reason about their own global configuration.
//
// WHAT IS DELIBERATELY ABSENT is per-tool call counts. There is no call log,
// and not every tool writes to the journal, so a count taken from it would show
// the silent ones as unused. The panel says so rather than showing a number
// that reads as a measurement and is an artefact of which tools happen to
// journal. The figures are rendered FROM the tool list rather than quoted in
// prose: this comment used to say "sixteen tools exist and eleven write to the
// journal" and the measured numbers were 22, 17 and 5 — the argument was still
// right and the numbers had drifted, which is what a number in prose does.
//
// AND THREE THINGS WERE CALLED "AGENTS" (UX28-05). `launchOptions()` reports
// what this MACHINE has installed; the agents created IN this project are a
// different list from a different read; and a permission mode carrying
// `blockedKey` is authority rather than capability. All three used to render as
// one kind of row, so a runner present on the machine and an agent bound to the
// project were indistinguishable — on the panel whose whole job is to say what
// THIS project's sessions are given.
//
// EVERY FIGURE THAT COMES FROM A READ CAN NOW SAY IT COULD NOT BE READ. The
// grant counts came from three reads whose `error` was never looked at, and
// then `live.count ?? 0`: a refused read became "no live authority here", which
// is the reassuring answer and the one this panel had no evidence for.

import { useEffect, useState } from 'react'
import type { Harness, ProjectRow } from '../../shared/types'
import { isEstateWide } from '../../shared/harness'
import { refusedBy } from '../../shared/readEnvelope'
import { EmptyState, Panel, Row, StateChip } from './components'
import { useT } from './i18n'

export function HarnessSection({
  project,
  feedMark,
  onError
}: {
  project: ProjectRow
  feedMark: number
  onError: (message: string) => void
}): React.JSX.Element {
  const t = useT()
  const [harness, setHarness] = useState<Harness | null>(null)
  /** Nothing has been read AND the read refused — not the same as an empty
   *  snapshot, which is a measurement. */
  const [failedWhy, setFailedWhy] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const at = project.id
    setFailedWhy(null)
    void (async () => {
      try {
        const read = await window.fabric.harness.read(at)
        // Keyed, as everywhere else on this page: a snapshot for the project
        // just left must not be shown under this one's name.
        if (alive && at === project.id) setHarness(read)
      } catch (e) {
        if (alive && at === project.id) {
          setFailedWhy(String(e))
          setHarness(null)
          onError(String(e))
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [project.id, feedMark])

  const providersRefused = harness ? refusedBy(harness.providers) : null
  const agentsRefused = harness ? refusedBy(harness.projectAgents) : null
  const serversRefused = harness ? refusedBy(harness.servers) : null
  const grantsRefused = harness ? refusedBy(harness.grants) : null
  const tools = harness?.tools ?? []
  const recording = tools.filter((x) => x.records).length

  return (
    <Panel id="sec-harness" title={t('harness.title')}>
      <p className="muted">{t('harness.lede')}</p>

      {failedWhy !== null && (
        <p className="read-failed" data-testid="harness-failed">
          {t('reads.failed', { why: failedWhy })}
        </p>
      )}
      {harness === null && failedWhy === null && (
        <p className="muted" data-testid="harness-reading">
          {t('harness.reading')}
        </p>
      )}

      {/* WHAT THIS MACHINE HAS. Separate from what this project has created,
          and `available` is separate from being installed: a runner present
          and not signed in cannot read as launch-ready. */}
      <h3 className="task-history-head">{t('harness.providers')}</h3>
      {providersRefused !== null && (
        <p className="read-failed" data-testid="harness-providers-failed">
          {t('reads.failed', { why: providersRefused })}
        </p>
      )}
      {harness && providersRefused === null && (
        <div data-testid="harness-providers">
          {(harness.providers.data ?? []).map((agent) => (
            <Row
              key={agent.id}
              lead={
                <StateChip tone={agent.available ? 'good' : 'quiet'}>
                  {agent.available ? agent.id : t('harness.unavailable')}
                </StateChip>
              }
            >
              {agent.description}
              <span className="muted">
                {' '}
                {agent.permissionModes.length === 0
                  ? t('harness.noModes')
                  : t('harness.modes', {
                      modes: agent.permissionModes
                        .map((m) => (m.blockedKey ? `${m.id} (blocked)` : m.id))
                        .join(', ')
                    })}
              </span>
            </Row>
          ))}
        </div>
      )}

      {/* WHAT THIS PROJECT HAS CREATED (M125). A project with none of its own
          says so — showing the machine's runners here is how the two got
          conflated in the first place. */}
      <h3 className="task-history-head">{t('harness.projectAgents')}</h3>
      {agentsRefused !== null && (
        <p className="read-failed" data-testid="harness-project-agents-failed">
          {t('reads.failed', { why: agentsRefused })}
        </p>
      )}
      {harness && agentsRefused === null && (
        <div data-testid="harness-project-agents">
          {(harness.projectAgents.data ?? []).length === 0 ? (
            <EmptyState read>{t('harness.noProjectAgents')}</EmptyState>
          ) : (
            (harness.projectAgents.data ?? []).map((agent) => (
              <Row key={agent.id} lead={<span className="mono">{agent.name}</span>}>
                <span className="muted">{agent.id}</span>
              </Row>
            ))
          )}
        </div>
      )}

      <h3 className="task-history-head">{t('harness.servers')}</h3>
      {serversRefused !== null && (
        <p className="read-failed" data-testid="harness-servers-failed">
          {t('reads.failed', { why: serversRefused })}
        </p>
      )}
      {harness && serversRefused === null && (harness.servers.data ?? []).length === 0 && (
        <EmptyState read>{t('harness.noServer')}</EmptyState>
      )}
      {harness &&
        serversRefused === null &&
        (harness.servers.data ?? []).map((server) => (
          <Row key={server.name} lead={<span className="mono">{server.name}</span>}>
            <span className="mono">{server.endpoint}</span>
          </Row>
        ))}
      <p className="muted">{t('harness.strict')}</p>

      {/* The tool contract is a constant in this process, not a read: there is
          nothing to fail, and inventing a failure mode for it would be as
          dishonest as hiding a real one. */}
      <h3 className="task-history-head">{t('harness.tools')}</h3>
      {tools.map((tool) => (
        <Row
          key={tool.name}
          lead={<span className="mono">{tool.name}</span>}
          trail={
            <StateChip tone={tool.records ? 'info' : 'quiet'}>
              {tool.records ? t('harness.records') : t('harness.silent')}
            </StateChip>
          }
        >
          {tool.purpose}
        </Row>
      ))}
      {tools.length > 0 && (
        <p className="muted">
          {t('harness.noCounts', { total: tools.length, recording, silent: tools.length - recording })}
        </p>
      )}

      <h3 className="task-history-head">{t('harness.grants')}</h3>
      {grantsRefused !== null && (
        <p className="read-failed" data-testid="harness-grants-failed">
          {t('reads.failed', { why: grantsRefused })}
        </p>
      )}
      {/* ONE condition, not two. `grantsRefused === null` beside this was
          inert: `envelope` nulls `data` itself when nothing answered, so the
          numbers are already unreachable for a refused read — and a guard that
          cannot fire reads as protection without being any. The invariant lives
          in `readEnvelope.ts` and `harness-read.test.mjs` plants its removal. */}
      {harness && harness.grants.data && (
        <p className="muted" data-testid="harness-grants">
          {t('harness.grantsLive', {
            live: harness.grants.data.live,
            spent: harness.grants.data.spent,
            expired: harness.grants.data.expired
          })}
          {harness.grants.availability === 'partial' && ` ${t('harness.grantsPartial')}`}
        </p>
      )}
      {/* SAID, NOT IMPLIED. `grants` has no project column — a grant is an
          estate-level object by its own schema — so this panel cannot scope
          the figures and must not let its title imply that it has. */}
      {harness && isEstateWide(harness, 'grants') && (
        <p className="muted" data-testid="harness-estate-wide">
          {t('harness.estateWide')}
        </p>
      )}
      <p className="muted">{t('harness.grantsNote')}</p>
    </Panel>
  )
}

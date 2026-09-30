/**
 * The tick around the decision, and the state that must survive a restart.
 *
 * M199.auto. The engine in `autoPolicy.ts` is pure and decides; everything that
 * can be lost lives here. Three things in particular, and each is a failure
 * case the card names:
 *
 *  * **The cooldown, the quarantine and the hourly count outlive the process.**
 *    A restart that forgot them is a restart that resets the cap — which is the
 *    card's own words, "restart/100% usage cannot reset it". So they are on
 *    `localState`, and the count is a list of timestamps rather than a number,
 *    because a number cannot age out of a trailing hour.
 *  * **One tick holder per scope.** Two ticks reading the same observation and
 *    both queueing a switch is two operations on one conversation, which
 *    M199.resume refuses — but refusing late means the second one has already
 *    stopped something.
 *  * **Nothing is dispatched twice for one observation.** A repeated event and a
 *    retried tick are indistinguishable from inside, so the intent is keyed by
 *    conversation AND the observation it was decided on.
 *
 * The loop calls the coordinator rather than switching credentials itself: the
 * card says so, and the reason is that a global credential swap would move every
 * conversation on the machine to serve one.
 */

import { readLocal, writeLocal, type LocalFile } from './localState.ts'
import { decide, type AutoPolicy, type Decision, type DecideInput } from '../shared/autoPolicy.ts'

interface AutoState {
  schema: 'AutoSwitching@1'
  /** Timestamps of switches, so the trailing hour is computed rather than counted. */
  switchesAt: Record<string, number[]>
  /** conversationId → when its last switch landed. */
  lastSwitchAt: Record<string, number>
  /** accountId → why it is out, until an operator or a refresh clears it. */
  quarantined: Record<string, string>
  /** conversationId → the observation an intent was already queued for. */
  queuedFor: Record<string, string>
  /** Which conversations the operator enrolled. */
  enrolled: string[]
}

const EMPTY: AutoState = {
  schema: 'AutoSwitching@1',
  switchesAt: {},
  lastSwitchAt: {},
  quarantined: {},
  queuedFor: {},
  enrolled: []
}

function validate(parsed: unknown): AutoState | null {
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Partial<AutoState>
  if (o.schema !== 'AutoSwitching@1') return null
  if (!Array.isArray(o.enrolled)) return null
  for (const key of ['switchesAt', 'lastSwitchAt', 'quarantined', 'queuedFor'] as const)
    if (!o[key] || typeof o[key] !== 'object') return null
  return { ...EMPTY, ...(o as AutoState) }
}

export interface TickOutcome {
  decision: Decision
  /** True when this tick actually asked the coordinator to switch. */
  queued: boolean
  /** Why nothing was asked, when the decision said to switch anyway. */
  suppressed?: string
}

export interface AutoLoopDeps {
  dir: string
  /** Everything the pure engine needs, gathered per conversation. */
  survey: (conversationId: string) => Omit<DecideInput, 'policy' | 'switchesThisHour' | 'lastSwitchAt' | 'enrolled' | 'now'>
  /** M199.resume's coordinator. The loop does not switch credentials itself. */
  beginSwitch: (input: { conversationId: string; to: string; idempotencyKey: string }) => { ok: boolean; reason: string }
  now?: () => number
  /** Whether the application is running at all. App-off stops the loop. */
  running?: () => boolean
}

export function createAutoLoop(deps: AutoLoopDeps) {
  const spec: LocalFile<AutoState> = { dir: deps.dir, file: 'auto-switching.json', empty: EMPTY, validate }
  const now = deps.now ?? Date.now
  const running = deps.running ?? ((): boolean => true)
  const read = (): AutoState => readLocal(spec).value
  /** scope key → the holder's token, so one tick runs per scope. */
  const leases = new Map<string, string>()

  const save = (next: AutoState): boolean =>
    writeLocal(spec, next, readLocal(spec).revision).status === 'committed'

  const scopeKey = (policy: AutoPolicy): string =>
    `${policy.scope.provider}|${policy.scope.runtime}|${policy.scope.projectId ?? '*'}`

  const switchesThisHour = (state: AutoState, key: string): number =>
    (state.switchesAt[key] ?? []).filter((t) => now() - t < 3_600_000).length

  return {
    state: read,

    /** Enrol one conversation. Turning the policy on does not enrol anything. */
    enrol(conversationId: string): { ok: boolean; reason: string } {
      const state = read()
      if (state.enrolled.includes(conversationId))
        return { ok: true, reason: 'already enrolled' }
      return save({ ...state, enrolled: [...state.enrolled, conversationId] })
        ? { ok: true, reason: 'enrolled; later switches need no second confirmation' }
        : { ok: false, reason: 'the enrolment could not be saved' }
    },

    /** Remove a conversation, and drop any intent queued for it. Pausing before
     *  the stop cancels; after the stop only recovery is left, and that is
     *  M199.resume's — this only stops NEW intents. */
    withdraw(conversationId: string): { ok: boolean; reason: string } {
      const state = read()
      const queuedFor = { ...state.queuedFor }
      const had = queuedFor[conversationId] !== undefined
      delete queuedFor[conversationId]
      const ok = save({
        ...state,
        enrolled: state.enrolled.filter((c) => c !== conversationId),
        queuedFor
      })
      return {
        ok,
        reason: ok
          ? had
            ? 'withdrawn, and the queued intent is dropped'
            : 'withdrawn; nothing was queued'
          : 'the withdrawal could not be saved'
      }
    },

    /** Put an account out of consideration until something clears it. */
    quarantine(accountId: string, why: string): boolean {
      const state = read()
      return save({ ...state, quarantined: { ...state.quarantined, [accountId]: why } })
    },

    quarantinedAccounts: (): Readonly<Record<string, string>> => read().quarantined,

    switchesInTrailingHour(policy: AutoPolicy): number {
      return switchesThisHour(read(), scopeKey(policy))
    },

    /**
     * Run one tick for one conversation.
     *
     * Returns the decision whether or not anything was asked, because a `hold`
     * an operator cannot see is a loop that looks broken.
     */
    tick(input: { policy: AutoPolicy; conversationId: string }): TickOutcome {
      const state = read()
      const key = scopeKey(input.policy)

      if (!running())
        return {
          decision: {
            kind: 'hold',
            reason: 'the application is not running; the loop does nothing while it is off',
            from: null,
            observationRefs: [],
            policyRevision: input.policy.revision,
            nextCheckAt: new Date(now()).toISOString(),
            eligible: [],
            excluded: []
          },
          queued: false
        }

      const survey = deps.survey(input.conversationId)
      // The quarantine is applied HERE rather than inside the engine, because
      // it is state and the engine is pure. The engine sees a candidate already
      // marked, which keeps its answer reproducible from its arguments alone.
      const candidates = survey.candidates.map((c) => ({
        ...c,
        quarantined: c.quarantined || state.quarantined[c.accountId] !== undefined
      }))

      const decision = decide({
        ...survey,
        candidates,
        policy: input.policy,
        switchesThisHour: switchesThisHour(state, key),
        lastSwitchAt: state.lastSwitchAt[input.conversationId] ?? null,
        enrolled: state.enrolled.includes(input.conversationId),
        now: now()
      })

      if (decision.kind !== 'queue_switch' || !decision.to) return { decision, queued: false }

      // ONE INTENT PER OBSERVATION. A repeated event and a retried tick look
      // the same from in here, and both would otherwise queue a second switch
      // for a decision that was already acted on.
      const observationKey = decision.observationRefs.join('|')
      if (state.queuedFor[input.conversationId] === observationKey)
        return {
          decision,
          queued: false,
          suppressed: 'an intent is already queued for this conversation on these readings'
        }

      // ONE TICK HOLDER PER SCOPE. Refusing late — inside the coordinator —
      // would mean the second tick had already stopped something.
      const token = `${input.conversationId}@${now()}`
      if (leases.has(key))
        return { decision, queued: false, suppressed: `another tick holds ${key}` }
      leases.set(key, token)
      try {
        const asked = deps.beginSwitch({
          conversationId: input.conversationId,
          to: decision.to,
          // The key is the decision: the same readings retried produce the same
          // key, so M199.resume resumes that operation rather than starting one.
          idempotencyKey: `auto:${input.conversationId}:${observationKey}`
        })
        if (!asked.ok) return { decision, queued: false, suppressed: asked.reason }
        const at = now()
        save({
          ...state,
          switchesAt: { ...state.switchesAt, [key]: [...(state.switchesAt[key] ?? []), at] },
          lastSwitchAt: { ...state.lastSwitchAt, [input.conversationId]: at },
          queuedFor: { ...state.queuedFor, [input.conversationId]: observationKey }
        })
        return { decision, queued: true }
      } finally {
        leases.delete(key)
      }
    },

    /**
     * Run the same decision WITHOUT asking for anything.
     *
     * The card requires a preview through the same selector: a dry run that
     * used a different code path would answer about a product nobody ships.
     */
    preview(input: { policy: AutoPolicy; conversationId: string }): Decision {
      const state = read()
      const survey = deps.survey(input.conversationId)
      return decide({
        ...survey,
        candidates: survey.candidates.map((c) => ({
          ...c,
          quarantined: c.quarantined || state.quarantined[c.accountId] !== undefined
        })),
        policy: input.policy,
        switchesThisHour: switchesThisHour(state, scopeKey(input.policy)),
        lastSwitchAt: state.lastSwitchAt[input.conversationId] ?? null,
        enrolled: state.enrolled.includes(input.conversationId),
        now: now()
      })
    }
  }
}

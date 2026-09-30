import { describe, expect, it } from 'vitest'
import { decideNotification, rememberTold, type Notifiable } from './notify.ts'

const item = (id: string, title = 'a thing', projectName: string | null = 'Fabric'): Notifiable => ({
  id,
  title,
  projectName
})

describe('telling the operator when they are not looking', () => {
  it('says nothing while the window is in front', () => {
    // The queue is already on screen. A notification about something the
    // operator is looking at is noise that teaches them to dismiss the next one.
    expect(decideNotification([item('a')], new Set(), true).notify).toBe(false)
  })

  it('names the one thing when there is one', () => {
    const d = decideNotification([item('a', 'the agent asks about the overwrite', 'Northwind')], new Set(), false)
    expect(d.notify).toBe(true)
    expect(d.title).toBe('Northwind')
    expect(d.body).toBe('the agent asks about the overwrite')
  })

  it('COUNTS a burst instead of firing twelve times', () => {
    // Twelve notifications is twelve dismissals and a decision to turn the whole
    // thing off — after which the product can never tell the operator anything.
    const many = Array.from({ length: 12 }, (_, i) => item(String(i)))
    const d = decideNotification(many, new Set(), false)
    expect(d.notify).toBe(true)
    expect(d.body).toContain('12 things')
    expect(d.ids).toHaveLength(12)
  })

  it('TELLS ABOUT EACH THING ONCE', () => {
    // The rule that makes or breaks it: the queue is derived and recomputes on
    // every read, so one refusal would ring every minute until it is granted.
    const told = new Set(['a'])
    expect(decideNotification([item('a')], told, false).notify).toBe(false)
  })

  it('tells about the new one when an old one is still waiting', () => {
    const d = decideNotification([item('a'), item('b', 'the new thing')], new Set(['a']), false)
    expect(d.notify).toBe(true)
    expect(d.body).toBe('the new thing')
    expect(d.ids).toEqual(['b'])
  })

  it('says nothing when nothing is waiting', () => {
    expect(decideNotification([], new Set(), false).notify).toBe(false)
  })

  it('falls back to the product name when an item belongs to no project', () => {
    // An estate-level refusal has no project. Rendering "null" as the title is
    // the kind of thing nobody notices until it is on somebody's lock screen.
    expect(decideNotification([item('a', 't', null)], new Set(), false).title).toBe('Fabric')
  })
})

describe('an item is remembered as told only once it has been', () => {
  // MEASURED at `dbe7255`. The notifier marked every id told BEFORE showing the
  // notification:
  //
  //     for (const id of d.ids) told.add(id)      // line 2822
  //     const n = new Notification({ ... })       // line 2823
  //     n.show()                                  // line 2828
  //
  // and the whole tick sits in a try that reports to `ops.failed`. So a show
  // that throws leaves the ids marked told, and the operator is NEVER told
  // about those obligations for the life of the process — a silent loss of the
  // one thing this module exists to deliver.
  //
  // THE ASYMMETRY DECIDES IT, and it is the same one AX-07 used for the read
  // cursor: telling twice costs a glance, never telling costs the thing it was
  // about. So an unknown outcome remembers NOTHING and says so.
  const decision = { notify: true, title: 'Fabric', body: '2 things are waiting for you', ids: ['a', 'b'] }

  it('the fixture is a decision that WOULD be told, or nothing below is about it', () => {
    expect(decision.notify).toBe(true)
    expect(decision.ids.length).toBeGreaterThan(1)
  })

  it('remembers the ids when the notification was shown', () => {
    expect(rememberTold(decision, { shown: true }).told).toEqual(['a', 'b'])
  })

  it('remembers NOTHING when the show failed, so the next pass tells again', () => {
    const got = rememberTold(decision, { shown: false, why: 'no notification service' })
    expect(got.told, 'an obligation nobody heard about is still waiting').toEqual([])
  })

  it('and remembers nothing when the outcome is UNKNOWN, saying a repeat is possible', () => {
    // The third state. Recording "told" over an outcome nobody observed is the
    // confident answer this cycle keeps finding; recording nothing may repeat,
    // and the sentence says so rather than leaving a reader to discover it.
    const got = rememberTold(decision, { shown: 'unknown', why: 'the process died mid-show' })
    expect(got.told).toEqual([])
    expect(got.says).toMatch(/again|repeat/i)
  })

  it('and a decision that says nothing remembers nothing, whatever the outcome', () => {
    const silent = { notify: false, title: '', body: '', ids: [] }
    expect(rememberTold(silent, { shown: true }).told).toEqual([])
  })
})

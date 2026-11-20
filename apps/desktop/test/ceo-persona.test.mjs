// The CEO's persona on the home (the owner, 2026-11-20, 23:00: a header with the CEO's face and live analytics, lines
// about his projects, an alarm when a project is on fire, adapting to how he talks). Pure: the episodes, the manner,
// the line and the stats' sentences.
import assert from 'node:assert/strict'
import test from 'node:test'
import { projectHeat, stepEpisodes, ownerManner, ceoLine, statSentences, FIRE_HEAT, PERSONA_VERSION } from '../src/shared/ceoPersona.ts'

const NOW = Date.parse('2026-11-20T21:00:00Z')
const days = (n) => new Date(NOW - n * 86_400_000).toISOString()
const item = (projectId, projectName, extra = {}) => ({ taskId: `t-${Math.random()}`, projectId, projectName, summary: 's', agent: null, sessionId: null, console: false, since: days(0), doing: null, live: false, ...extra })
const pulse = (projectId, over = {}) => ({ projectId, now: null, live: 1, inWork: 1, review: 0, lastActivityAt: days(0), ...over })

function view(over = {}) {
  return { live: [], inWork: [], abandoned: [], review: [], done: [], projects: [], readAt: days(0), ...over }
}

test('a project is on fire when work there is abandoned and its reviews wait; one thing alone is not a fire', () => {
  const v = view({
    abandoned: [item('p1', 'dissy'), item('p1', 'dissy'), item('p2', 'riffly')],
    review: [{ taskId: 'r1', projectId: 'p1', projectName: 'dissy', summary: 's', since: days(5) }],
    projects: [pulse('p1'), pulse('p2'), pulse('p3', { inWork: 3, live: 0 })]
  })
  const heat = projectHeat(v, NOW)
  assert.ok(heat.get('p1').heat >= FIRE_HEAT, 'two abandoned and an old review: a fire')
  assert.ok(heat.get('p2').heat < FIRE_HEAT, 'one abandoned task is not a fire')
  assert.equal(heat.get('p1').name, 'dissy')
  assert.deepEqual(heat.get('p1').why, { abandoned: 2, reviewOld: 1, stalled: false })
  assert.equal(heat.get('p3').why.stalled, true, 'work in progress with no live agent is stalled')
})

test('a fire episode opens after two hot readings and closes after two calm ones; an unread reading changes nothing', () => {
  const hot = new Map([['p1', { heat: 5, name: 'dissy', why: {} }]])
  const calm = new Map([['p1', { heat: 0, name: 'dissy', why: {} }]])
  let s = stepEpisodes(new Map(), hot)
  assert.equal(s.get('p1').open, false, 'one hot reading is not a fire yet')
  s = stepEpisodes(s, hot)
  assert.equal(s.get('p1').open, true)
  s = stepEpisodes(s, null)
  assert.equal(s.get('p1').open, true, 'an unread reading neither opens nor closes')
  s = stepEpisodes(s, calm)
  assert.equal(s.get('p1').open, true, 'one calm reading does not close it')
  s = stepEpisodes(s, calm)
  assert.equal(s.get('p1').open, false)
})

test('the owner\'s manner is read from his own words: language, how casual, whether he swears, how short', () => {
  assert.deepEqual(ownerManner(['давай сделаем, блядь, пожар там', 'ну короче глянь']), { lang: 'ru', casual: true, swears: true, short: false })
  assert.deepEqual(ownerManner(['Please review the release notes.', 'Thanks.']), { lang: 'en', casual: false, swears: false, short: true })
  assert.deepEqual(ownerManner([]), { lang: null, casual: false, swears: false, short: false })
})

test('the line: a fire comes first and names the project; strong words only when the owner uses them; calm otherwise', () => {
  const fire = new Map([['p1', { open: true, name: 'dissy', why: { abandoned: 2, reviewOld: 1, stalled: false }, hot: 2, calm: 0 }]])
  const v = view({ projects: [pulse('p1')], abandoned: [item('p1', 'dissy'), item('p1', 'dissy')] })
  const plain = ceoLine({ view: v, waiting: 0, episodes: fire, manner: ownerManner(['Посмотри, пожалуйста']), locale: 'ru', hour: 21, seed: 1 })
  assert.equal(plain.mood, 'alarm')
  assert.match(plain.text, /dissy/)
  assert.ok(!/бляд/i.test(plain.text))
  const salty = ceoLine({ view: v, waiting: 0, episodes: fire, manner: ownerManner(['блядь, ну где']), locale: 'ru', hour: 21, seed: 1 })
  assert.match(salty.text, /dissy/)
  const calm = ceoLine({ view: view({ projects: [pulse('p1', { atWork: 2 })], live: [{}, {}] }), waiting: 0, episodes: new Map(), manner: ownerManner([]), locale: 'en', hour: 9, seed: 3 })
  assert.notEqual(calm.mood, 'alarm')
  assert.ok(calm.text.length > 10)
  for (const l of [plain, salty, calm]) assert.ok(!l.text.includes('—'), 'no em dash in text for people')
  const waits = ceoLine({ view: view(), waiting: 3, episodes: new Map(), manner: ownerManner([]), locale: 'ru', hour: 14, seed: 2 })
  assert.equal(waits.mood, 'asks')
  assert.match(waits.text, /3/)
  assert.equal(typeof PERSONA_VERSION, 'string')
})

test('an unread home says so and never claims all is calm', () => {
  const l = ceoLine({ view: null, waiting: null, episodes: new Map(), manner: ownerManner([]), locale: 'ru', hour: 10, seed: 0 })
  assert.equal(l.mood, 'unknown')
})

test('the stats speak: where the work is, how many waited too long, where work was dropped', () => {
  const v = view({
    projects: [pulse('p1', { atWork: 3 }), pulse('p2', { atWork: 1 })],
    abandoned: [item('p2', 'riffly'), item('p2', 'riffly')],
    review: [{ taskId: 'a', projectId: 'p1', projectName: 'dissy', summary: '', since: days(5) }, { taskId: 'b', projectId: 'p1', projectName: 'dissy', summary: '', since: days(0) }],
    reviewOld: 1,
    displayNames: undefined
  })
  const names = new Map([['p1', 'dissy'], ['p2', 'riffly']])
  const s = statSentences(v, names, 'ru')
  assert.match(s.working, /dissy/)
  assert.match(s.review, /1/)
  assert.match(s.abandoned, /riffly/)
  assert.equal(statSentences(view(), names, 'en').abandoned, null, 'nothing dropped: no sentence, the number speaks')
})

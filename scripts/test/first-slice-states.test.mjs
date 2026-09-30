import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {renderProduct} from '../product/renderers.mjs'

// U3 (2026-09-28): the first-slice screens are held to their state tables in
// docs/ux/screens.md, not to a list copied here. A state the spec names and the
// mockup cannot show is the gap the audit found three times (SCR-48 restoring,
// opening, error; SCR-65 denied), so the tables are parsed and every row must be
// reachable from the screen's own state picker.

const root = path.resolve(import.meta.dirname, '..', '..')
const read = p => readFileSync(path.join(root, p), 'utf8')
const model = JSON.parse(read('docs/ux/product-model.json'))
const fixtures = JSON.parse(read('docs/ux/product-fixtures.json'))
const html = (view, state = {}) => String(renderProduct(view, {project: 'atlas', ...state}, model, structuredClone(fixtures)))
const text = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

function specStates(screen) {
  const md = read('docs/ux/screens.md')
  const start = md.indexOf(`### ${screen}:`)
  assert.ok(start >= 0, `${screen} is missing from screens.md`)
  const section = md.slice(start, md.indexOf('\n### ', start + 4))
  const rows = [...section.matchAll(/^\s*\| ([a-z][a-z-]*) \|/gm)].map(m => m[1]).filter(s => s !== 'state')
  assert.ok(rows.length > 3, `${screen} state table not parsed`)
  return rows
}
const pickerStates = (h, key) => [...h.matchAll(new RegExp(`${key}=([a-z-]+)`, 'g'))].map(m => m[1])
const branchOptions = h => {
  const select = h.match(/<select[^>]*name="ops-branch"[\s\S]*?<\/select>/)
  assert.ok(select, 'the demo-state select is missing')
  return [...select[0].matchAll(/<option value="([^"]+)"/g)].map(m => m[1])
}

test('SCR-64: every state in the spec table is drawn by the CEO conversation', () => {
  const offered = new Set(pickerStates(html('ceo-conversation'), 'chatState'))
  for (const s of specStates('SCR-64')) assert.ok(offered.has(s), `SCR-64 ${s} is specified but not drawn`)
})

test('SCR-65: every state in the spec table is drawn by private history (loading is the shared shell)', () => {
  const offered = new Set(pickerStates(html('private-history'), 'phState'))
  for (const s of specStates('SCR-65').filter(s => s !== 'loading')) assert.ok(offered.has(s), `SCR-65 ${s} is specified but not drawn`)
})

test('SCR-48: every state in the spec table is reachable in the restore mockup', () => {
  const offered = new Set(branchOptions(html('restore')))
  const shared = new Set(['loading', 'empty'])
  for (const s of specStates('SCR-48').filter(s => !shared.has(s))) assert.ok(offered.has(s), `SCR-48 ${s} is specified but not reachable`)
})

test('SCR-48: restoring, opening and error say what they are and offer no wrong action', () => {
  const restoring = html('restore', {opsState: 'restoring'})
  assert.match(text(restoring), /Одним шагом: новая Estate, тот же владелец/)
  assert.doesNotMatch(restoring, /data-ops-action="restore-open"/)
  const opening = html('restore', {opsState: 'opening'})
  assert.match(text(opening), /Fabric перезапускается в эту Estate/)
  assert.doesNotMatch(opening, /data-ops-action="restore-open"/, 'Open is not offered again while opening')
  const error = text(html('restore', {opsState: 'error'}))
  assert.match(error, /Всё отменено: новая Estate не создана, файл архива не тронут/)
  assert.match(text(html('restore', {opsState: 'history-restored'})), /Открыть эту Estate/)
})

test('SCR-65: a file that fails a check is refused; another person\'s history is denied', () => {
  const refused = text(html('private-history', {phState: 'refused'}))
  assert.match(refused, /Файл отклонён/)
  assert.doesNotMatch(refused, /другого человека/, 'someone else\'s history is the denied state, not a file check')
  assert.match(text(html('private-history', {phState: 'denied'})), /Импорт недоступен.*другого человека/)
})

test('SCR-64: an unsupported scope is not shown as applied', () => {
  const h = html('ceo-conversation', {chatState: 'unsupported-context'})
  assert.match(text(h), /Выбор «Все проекты» не применён/)
  assert.doesNotMatch(h, /aria-pressed="true"[^>]*>Все проекты</, 'the refused choice must not look selected')
})

test('SCR-25: a detached view offers reattach once, as the primary action', () => {
  const h = html('session', {session: 'session-reviewer', agent: 'reviewer', opsState: 'view-detached'})
  assert.equal((h.match(/data-ops-action="session-reattach"/g) || []).length, 1)
  assert.match(h, /class="button primary"[^>]*data-ops-action="session-reattach"|data-ops-action="session-reattach"[^>]*class="button primary"/)
})

test('first-slice copy uses one name per action and the product name, not internal shorthand', () => {
  const all = ['not-activated', 'local-recovery-required', 'commit-unknown', 'error'].map(s => text(html('ceo-conversation', {chatState: s}))).join(' ')
  assert.doesNotMatch(all, /первый срез|пока CEO|Проверить снова/)
})

test('every first-slice string listed in strings.md is on a rendered first-slice screen', () => {
  const md = read('docs/brand/strings.md')
  const section = md.slice(md.indexOf('## First slice · target mockup 2026-09-28'))
  const listed = [...section.matchAll(/^- `[^`]+` — «(.+)» · scripts\/product\//gm)].map(m => m[1])
  assert.ok(listed.length >= 9, 'the listed first-slice strings were not parsed')
  const views = [
    ['private-history', {phState: 'empty'}], ['private-history', {phState: 'denied'}],
    ['restore', {opsState: 'history-restored'}], ['restore', {opsState: 'result-unknown'}], ['restore', {opsState: 'error'}],
    ...['view-detached', 'backend-lost'].map(b => ['session', {session: 'session-reviewer', agent: 'reviewer', opsState: b}]),
  ]
  const seen = views.map(([v, s]) => text(html(v, s))).join(' ')
  for (const line of listed) assert.ok(seen.includes(line), `not rendered: ${line}`)
})

test('the shared read states reach each first-slice screen\'s own drawing', () => {
  // The shared shell said «связанная работа появится из проекта» on screens whose spec says
  // something else: SCR-64 keeps the composer while loading, SCR-65 explains what travels,
  // SCR-48 offers Choose archive as the one primary action.
  const ceoLoading = html('ceo-conversation', {state: 'loading'})
  assert.match(ceoLoading, /id="cc-message"/, 'SCR-64 loading keeps the composer')
  assert.match(text(html('ceo-conversation', {state: 'denied'})), /Разговор недоступен/)
  assert.match(text(html('private-history', {state: 'empty'})), /Экспорта и импорта ещё не было/)
  assert.match(text(html('private-history', {state: 'denied'})), /Импорт недоступен/)
  assert.doesNotMatch(text(html('private-history', {state: 'error'})), /Только чтение/, 'an import failure is not a read-only snapshot')
  const restoreEmpty = html('restore', {state: 'empty'})
  assert.match(text(restoreEmpty), /Архив ещё не выбран/)
  assert.equal((restoreEmpty.match(/class="button primary"/g) || []).length, 1, 'one primary action while empty')
  assert.match(restoreEmpty, /class="button primary"[^>]*>Выбрать архив</)
  for (const [v, s] of [['ceo-conversation', 'empty'], ['private-history', 'empty'], ['restore', 'empty']])
    assert.doesNotMatch(text(html(v, {state: s})), /Связанная работа появится здесь из проекта|В выбранной области пока нет записей/, `${v} fell back to the shared empty state`)
})

test('SCR-48: Restore becomes the primary action only after the archive is verified', () => {
  const primaries = h => (h.match(/class="button primary"[^>]*data-ops-action="restore-run"/g) || []).length
  assert.equal(primaries(html('restore')), 0, 'before verification Restore is not the primary action')
  assert.match(html('restore'), /data-ops-action="restore-run"[^>]*disabled/)
})

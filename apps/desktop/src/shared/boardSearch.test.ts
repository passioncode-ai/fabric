// The board search's ranking (the operator, 2026-11-14: «хочу чтобы агенты делали раг поиск по доске когда ищут связи
// кто чем занят»): words in Russian and English, their forms, ids kept whole, ranked by BM25 with recency and live work.
import { describe, expect, it } from 'vitest'
import { QUERY_WORDS, rankDocs, searchableWords, similarClaims, stem, terms, TEXT_MAX, WORD_MAX, type SearchDoc } from './boardSearch.ts'

const NOW = Date.parse('2026-11-14T12:00:00Z')
const doc = (id: string, title: string, text = '', extra: Partial<SearchDoc> = {}): SearchDoc =>
  ({ id, kind: 'task', title, text, at: '2026-11-13T12:00:00Z', ...extra })

describe('terms', () => {
  it('keeps an id whole beside its parts, splits camelCase and drops stop words', () => {
    const t = terms('Fix CO-571 in readOpenRequests and the board')
    expect(t).toContain('co-571')
    expect(t).toContain('571')
    expect(t).toContain(stem('requests'))
    expect(t).toContain('readopenrequests')
    expect(t).not.toContain('the')
    expect(t).not.toContain('and')
  })

  it('reads Russian word forms as one stem, ё as е', () => {
    expect(stem('диспетчера')).toBe(stem('диспетчер'))
    expect(stem('доской')).toBe(stem('доска'))
    expect(stem('запросы')).toBe(stem('запросов'))
    expect(terms('Ёлка')).toEqual(terms('елка'))
  })

  it('reads English word forms as one stem', () => {
    expect(stem('dispatching')).toBe(stem('dispatched'))
    expect(stem('requests')).toBe(stem('request'))
  })

  it('never stems a word below three letters away', () => {
    expect(stem('ии')).toBe('ии')
    expect(stem('ок')).toBe('ок')
  })
})

describe('rankDocs', () => {
  it('ranks the document that matches more of the query first, and a title over the body', () => {
    const docs = [
      doc('a', 'Диспетчер доски запускает агента', 'когда запрос ждёт'),
      doc('b', 'Иконка приложения', 'диспетчер упомянут в тексте'),
      doc('c', 'Ничего общего', 'совсем другое')
    ]
    const hits = rankDocs('диспетчер запросов', docs, { now: NOW, limit: 10 })
    expect(hits.map((h) => h.doc.id)).toEqual(['a', 'b'])
    expect(hits[0]!.matched).toEqual(['диспетчер', 'запросов'])
  })

  it('finds an English document for an English word inside a mixed query, and says which word matched', () => {
    const hits = rankDocs('диспетчер dispatcher', [doc('a', 'The board dispatcher survives sleep')], { now: NOW, limit: 5 })
    expect(hits).toHaveLength(1)
    expect(hits[0]!.matched).toEqual(['dispatcher'])
  })

  it('matches an id exactly and a long word by its prefix', () => {
    const docs = [doc('a', 'CO-573: what the live audit found'), doc('b', 'dispatching board requests to agents')]
    expect(rankDocs('co-573', docs, { now: NOW, limit: 5 }).map((h) => h.doc.id)).toEqual(['a'])
    expect(rankDocs('dispatchers', docs, { now: NOW, limit: 5 }).map((h) => h.doc.id)).toEqual(['b'])
  })

  it('puts live work and recent work above the same words in old, closed work', () => {
    const docs = [
      doc('old', 'Поиск по доске', '', { at: '2026-08-01T00:00:00Z' }),
      doc('z-live', 'Поиск по доске', '', { at: '2026-08-01T00:00:00Z', live: true }),
      doc('new', 'Поиск по доске', '', { at: '2026-11-14T10:00:00Z' })
    ]
    const order = rankDocs('поиск доске', docs, { now: NOW, limit: 5 }).map((h) => h.doc.id)
    expect(order.indexOf('z-live')).toBeLessThan(order.indexOf('old'))
    expect(order.indexOf('new')).toBeLessThan(order.indexOf('old'))
  })

  it('answers nothing for a query of stop words only or no match, and honours the limit', () => {
    const docs = Array.from({ length: 30 }, (_, i) => doc(`d${i}`, `board item ${i}`))
    expect(rankDocs('the and of', docs, { now: NOW, limit: 5 })).toEqual([])
    expect(rankDocs('zebra', docs, { now: NOW, limit: 5 })).toEqual([])
    expect(rankDocs('board', docs, { now: NOW, limit: 5 })).toHaveLength(5)
  })

  it('cuts a snippet around the first matched word', () => {
    const long = 'x '.repeat(200) + 'the dispatcher wakes a project' + ' y'.repeat(200)
    const [hit] = rankDocs('dispatcher', [doc('a', 'Board', long)], { now: NOW, limit: 1 })
    expect(hit!.snippet).toContain('dispatcher wakes')
    expect(hit!.snippet.length).toBeLessThanOrEqual(242)
  })
})

describe('similarClaims', () => {
  const claims = [
    { claimId: 'c1', taskId: 't1', owner: 's-other', agent: 'codex', title: 'Диспетчер доски: повторные запуски', touches: ['apps/desktop/src/main/boardDispatchRun.ts'] },
    { claimId: 'c2', taskId: 't2', owner: 's-other', agent: null, title: 'Иконка приложения', touches: [] },
    { claimId: 'c3', taskId: 't3', owner: 's-me', agent: 'claude-code', title: 'Диспетчер доски', touches: [] }
  ]

  it('names another holder\'s claim whose task reads like mine, never my own or the same task', () => {
    const similar = similarClaims({ taskId: 't9', owner: 's-me', title: 'Повторные запуски диспетчера', touches: [] }, claims)
    expect(similar.map((s) => s.claimId)).toEqual(['c1'])
    expect(similar[0]!.matched.length).toBeGreaterThan(0)
    expect(similarClaims({ taskId: 't1', owner: 's-me', title: 'Диспетчер доски', touches: [] }, claims)).toEqual([])
  })

  it('reads the files a claim touches as words too', () => {
    const similar = similarClaims({ taskId: 't9', owner: 's-me', title: 'Fix retries', touches: ['apps/desktop/src/main/boardDispatchRun.ts'] }, claims)
    expect(similar.map((s) => s.claimId)).toEqual(['c1'])
  })

  it('ER-8 (0.3.21 review, iteration 2): names every repository has (index, main, README) link nothing, as words or names', () => {
    const generic = [{ claimId: 'g1', taskId: 'tg', owner: 's-other', agent: null, title: 'Icon of the store page', touches: ['apps/desktop/src/index.ts', 'apps/desktop/src/main.ts', 'README.md'] }]
    expect(similarClaims({ taskId: 't9', owner: 's-me', title: 'Release', touches: ['apps/desktop/src/index.ts'] }, generic)).toEqual([])
    expect(similarClaims({ taskId: 't9', owner: 's-me', title: 'Translate the help', touches: ['src/index.ts', 'src/main.ts'] }, generic)).toEqual([])
    expect(similarClaims({ taskId: 't9', owner: 's-me', title: 'Ship it', touches: ['README.md'] }, generic)).toEqual([])
  })

  it('ER-11 (0.3.21 review, iteration 3): CHANGELOG, tsconfig, lock files and index.test.ts in different folders link nothing', () => {
    const other = [{ claimId: 'g2', taskId: 'tg', owner: 's-other', agent: null, title: 'Icon of the store page',
      touches: ['docs/CHANGELOG.md', 'apps/x/tsconfig.json', 'web/package-lock.json', 'web/.eslintrc.cjs', 'lib/index.test.ts', 'types/index.d.ts'] }]
    for (const t of ['CHANGELOG.md', 'tsconfig.json', 'package-lock.json', '.eslintrc.cjs', 'src/index.test.ts', 'src/index.d.ts'])
      expect(similarClaims({ taskId: 't9', owner: 's-me', title: 'Release', touches: [t] }, other), t).toEqual([])
  })

  it('ER-12 (0.3.21 review, iteration 3): an id is not matched by a shorter word it begins with', () => {
    const docs = [doc('a', 'Board screen colours', ''), doc('b', 'Fabric release notes', ''), doc('c', 'boardDispatchRun.ts retries', '')]
    expect(rankDocs('boardDispatchRun.ts', docs, { now: NOW, limit: 5 }).map((h) => h.doc.id)).toEqual(['c'])
    expect(rankDocs('fabric_work_list', docs, { now: NOW, limit: 5 })).toEqual([])
  })

  it('ER-15 (run two): a file name finds the document that cites it with its folder; CO-571 is not CO-5710', () => {
    const docs = [doc('p', 'Retries', 'touches apps/desktop/src/main/boardDispatchRun.ts#resolveProject'), doc('a', 'Done', 'ADR-0190/CO-571 done'),
      doc('x', 'Later', 'CO-5710 later'), doc('f', 'Tools', 'fabric_work_list answers')]
    expect(rankDocs('boardDispatchRun.ts', docs, { now: NOW, limit: 5 }).map((h) => h.doc.id)).toEqual(['p'])
    expect(rankDocs('CO-571', docs, { now: NOW, limit: 5 }).map((h) => h.doc.id)).toEqual(['a'])
    expect(rankDocs('fabric_work', docs, { now: NOW, limit: 5 }).map((h) => h.doc.id)).toEqual(['f'])
  })

  it('ER-16, ER-17, DO-25 (run two): per-folder framework names, lock files and versioned names', () => {
    const pairs: Array<[string, string]> = [['lib/__init__.py', 'pkg/__init__.py'], ['app/y/page.tsx', 'app/x/page.tsx'],
      ['eslint.config.js', 'web/eslint.config.js'], ['poetry.lock', 'web/poetry.lock'],
      ['docs/releases/fabric-0.3.21-mac.json', 'docs/releases/fabric-0.2.0-mac.json'], ['notes/release-0.3.21.md', 'notes/release-0.2.0.md']]
    for (const [mine, theirs] of pairs) {
      const other = [{ claimId: 'g3', taskId: 'tg', owner: 's-other', agent: null, title: 'Icon of the store page', touches: [theirs] }]
      expect(similarClaims({ taskId: 't9', owner: 's-me', title: 'Translate the help', touches: [mine] }, other), mine).toEqual([])
    }
    const same = [{ claimId: 'g4', taskId: 'tg', owner: 's-other', agent: null, title: 'Icon of the store page', touches: ['docs/releases/fabric-0.3.21-mac.json'] }]
    expect(similarClaims({ taskId: 't9', owner: 's-me', title: 'Translate the help', touches: ['out/fabric-0.3.21-mac.json'] }, same).length).toBe(1)
  })

  it('names nothing when only one weak word is shared', () => {
    expect(similarClaims({ taskId: 't9', owner: 's-me', title: 'Иконка для доски на сайте и в сторе и в письме', touches: [] }, claims)).toEqual([])
  })
})

describe('ER-1, ER-3 (0.3.21 review, iteration 1): hostile and large documents stay cheap', () => {
  it('a 64 KB message of one unbroken word ranks within 2.5 s (the old pattern took 7.4 s)', () => {
    const t0 = performance.now()
    rankDocs('dispatcher', [doc('a', 'Board', 'ж'.repeat(32_000)), doc('b', 'Board', 'A'.repeat(64_000))], { now: NOW, limit: 5 })
    // Old pattern: 7.4 s alone; the bound leaves room for a loaded machine.
    expect(performance.now() - t0).toBeLessThan(2500)
  })

  // PL-13, ER-9 (0.3.21 review, iteration 2): no wall-clock bound at the read bounds; it failed on a loaded machine and
  // its 14-word vocabulary understated the cost. What bounds the work is checked instead: the text read, the word
  // kept and the query words searched. The measured times are in the spec's §3a.
  it('reads a document to TEXT_MAX, a word to WORD_MAX and a query to QUERY_WORDS words', () => {
    expect(terms(`${'board '.repeat(TEXT_MAX / 6)}dispatcher`)).not.toContain('dispatcher')
    expect(Math.max(...terms('q'.repeat(10_000)).map((t) => t.length))).toBeLessThanOrEqual(WORD_MAX)
    const many = Array.from({ length: 20 }, (_, i) => `wordnumber${String.fromCharCode(97 + i)}`).join(' ')
    expect(searchableWords(many)).toBe(QUERY_WORDS)
    const last = doc('x', 'wordnumbert', '')
    expect(rankDocs(many, [last], { now: NOW, limit: 5 })).toEqual([])
  })

  it('ids are still kept whole when read from the words', () => {
    expect(terms('see boardDispatchRun.ts and co-571, then a.b')).toEqual(expect.arrayContaining(['boarddispatchrun.ts', 'co-571', 'a.b']))
    expect(terms('a - b')).not.toContain('a-b')
  })
})

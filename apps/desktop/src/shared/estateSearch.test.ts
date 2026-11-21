// The estate index's pure half (docs/evidence/specs/2026-11-19-estate-index-and-graph.md): queries, fusion, transcripts,
// the project catalogue measured on this Mac's duplicates, contexts, refs and the quote rule.
import { describe, expect, it } from 'vitest'
import {
  catalogue, checkClaims, contextOf, emptyFacts, folderRole, fuse, holder, matchProject, passage, readClaudeLines,
  readCodexLines, refsOf, resumeCommand, trigramQuery, turnPassages, wordsQuery, TURN_CHARS, documentWanted, sections, SECTION_CHARS
} from './estateSearch.ts'

describe('queries', () => {
  it('turns Russian and English words into stemmed OR terms, long ones as prefixes', () => {
    const q = wordsQuery('найти транскрипты сессий')!
    expect(q).toContain(' OR ')
    expect(q).toMatch(/"транскрип[а-я]*"\*/)
    expect(wordsQuery('и в на')).toBeNull()
  })
  it('keeps the whole phrase and its fragments for the trigram half', () => {
    const q = trigramQuery('Задачи от владельца')!
    expect(q).toContain('"Задачи от владельца"')
    expect(q).toContain('"владельца"')
    expect(trigramQuery('ab')).toBeNull()
    expect(trigramQuery('say "hi" now')).toContain('""hi""')
  })
})

describe('fusion', () => {
  it('is the sum of reciprocal ranks and says which rankings found each id', () => {
    const f = fuse({ words: ['a', 'b'], trigram: ['b', 'c'] })
    expect(f[0]!.id).toBe('b')
    expect(f[0]!.score).toBeCloseTo(1 / 62 + 1 / 61)
    expect(f[0]!.via).toEqual(['words', 'trigram'])
    expect(f.map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('passage', () => {
  it('is verbatim around the first match', () => {
    const body = `${'x '.repeat(400)}найди транскрипт по фразе ${'y '.repeat(400)}`
    const p = passage(body, 'транскрипт')
    expect(p).toContain('транскрипт по фразе')
    expect(body.replace(/\s+/g, ' ')).toContain(p)
  })
})

const claudeLines = [
  JSON.stringify({ type: 'permission-mode', sessionId: 's1' }),
  JSON.stringify({ type: 'user', sessionId: 's1', cwd: '/w/DATA/fabric', gitBranch: 'main', timestamp: '2026-11-19T10:00:00Z', message: { role: 'user', content: '\n\n<pasted_content id="1">\nЗадачи от владельца: граф знаний\n</pasted_content>' } }),
  JSON.stringify({ type: 'user', sessionId: 's1', timestamp: '2026-11-19T10:00:01Z', message: { role: 'user', content: [{ type: 'tool_result', content: 'huge' }] } }),
  '{"type":"assistant", cut mid-wri',
  JSON.stringify({ type: 'assistant', sessionId: 's1', timestamp: '2026-11-19T10:00:02Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Делаю индекс.' }, { type: 'tool_use', name: 'Bash' }] } }),
  JSON.stringify({ type: 'user', sessionId: 's1', message: { content: '<system-reminder>x</system-reminder>' } }),
  JSON.stringify({ type: 'ai-title', aiTitle: 'Граф знаний Fabric', sessionId: 's1' })
]

describe('transcripts', () => {
  it('reads a Claude transcript: id, folder, title, branch, typed turns with their lines; skips tool results, cut and injected lines', () => {
    const f = emptyFacts()
    readClaudeLines(claudeLines, 1, f)
    expect(f).toMatchObject({ sessionId: 's1', cwd: '/w/DATA/fabric', title: 'Граф знаний Fabric', branch: 'main', firstAt: '2026-11-19T10:00:00Z', lastAt: '2026-11-19T10:00:02Z' })
    expect(f.turns.map((t) => [t.role, t.line])).toEqual([['user', 2], ['assistant', 5]])
    expect(f.turns[0]!.text).toBe('Задачи от владельца: граф знаний')
  })
  it('reads a Codex rollout: meta, user and assistant messages, never injected instructions', () => {
    const f = emptyFacts()
    readCodexLines([
      JSON.stringify({ type: 'session_meta', timestamp: '2026-11-19T12:11:23Z', payload: { id: 'c1', cwd: '/w' } }),
      JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'You are Codex' }] } }),
      JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '# AGENTS.md instructions' }] } }),
      JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Review the design' }] } }),
      JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Done' }] } })
    ], 1, f)
    expect(f).toMatchObject({ sessionId: 'c1', cwd: '/w', title: 'Review the design' })
    expect(f.turns.map((t) => t.line)).toEqual([4, 5])
  })
  it('groups turns into passages no longer than TURN_CHARS with their lines', () => {
    const turns = Array.from({ length: 10 }, (_, i) => ({ role: 'user' as const, text: 'w'.repeat(500), line: i + 1, at: null }))
    const ps = turnPassages(turns)
    expect(ps.every((p) => p.text.length <= TURN_CHARS)).toBe(true)
    expect(ps[0]).toMatchObject({ lineStart: 1, lineEnd: 3 })
    expect(ps.at(-1)!.lineEnd).toBe(10)
  })
  it('writes the continue command for each runner', () => {
    expect(resumeCommand('claude', 'id1', '/a b')).toBe("cd '/a b' && claude --resume id1")
    expect(resumeCommand('claude', 'id1', '/a', '/h')).toBe("cd '/a' && CLAUDE_CONFIG_DIR='/h' claude --resume id1")
    expect(resumeCommand('codex', 'c1', null)).toBe('codex resume c1')
  })
})

// The folders measured on 2026-11-19 (`select name, repo_path from projects`): three names twice, temporary folders.
const measured = [
  { id: 'p1', name: 'fabric-agents-database', repo_path: '/w/.cache/fabric-agents-database' },
  { id: 'p2', name: 'fabric-agents-database', repo_path: '/w/DATA/fabric-agents-database' },
  { id: 'p3', name: 'fabric-board-client', repo_path: '/w/.cache/fabric-board-client' },
  { id: 'p4', name: 'fabric-board-client', repo_path: '/w/DATA/_worktrees/fabric-board-client' },
  { id: 'p5', name: 'research-agent', repo_path: '/w/DATA/research-agent', lastActivityAt: '2026-11-19' },
  { id: 'p6', name: 'research-agent', repo_path: '/w/DATA/0xDEV/research-agent', lastActivityAt: '2026-10-01' },
  { id: 'p7', name: 'tmp', repo_path: '/private/tmp' },
  { id: 'p8', name: 'tmp.MILKQOGh4U', repo_path: '/private/var/folders/3r/x/T/tmp.MILKQOGh4U' },
  { id: 'p9', name: 'fabric', repo_path: '/w/DATA/fabric' },
  { id: 'p10', name: 'sound-engine', repo_path: '/w/DATA/sound-engine' }
]

describe('project catalogue', () => {
  const rows = catalogue(measured, (f) => (f.endsWith('_worktrees/fabric-board-client') ? '/w/DATA/fabric-board-client' : null))
  const role = (id: string) => rows.find((r) => r.id === id)!
  it('marks temporary, worktree, duplicate and canonical folders', () => {
    expect(role('p1')).toMatchObject({ role: 'temporary', of: '/w/DATA/fabric-agents-database' })
    expect(role('p2').role).toBe('canonical')
    expect(role('p3').role).toBe('temporary')
    expect(role('p4')).toMatchObject({ role: 'worktree', of: '/w/DATA/fabric-board-client' })
    expect(role('p5').role).toBe('canonical')
    expect(role('p6')).toMatchObject({ role: 'duplicate', of: '/w/DATA/research-agent' })
    expect(role('p7').role).toBe('temporary')
    expect(role('p8').role).toBe('temporary')
    expect(folderRole('/w/proj/.claude/worktrees/a')).toBe('worktree')
  })
  it('finds one project by name, preferring the canonical folder over a temporary or duplicate one', () => {
    expect(matchProject(rows, 'fabric-agents-database')).toMatchObject({ found: { id: 'p2' } })
    expect(matchProject(rows, 'research-agent')).toMatchObject({ found: { id: 'p5' } })
    expect(matchProject(rows, 'fabric-board-client')).toMatchObject({ found: { id: 'p4' } })
  })
  it('forgives a typo, takes a part of a path and answers a list when canonical folders compete', () => {
    expect(matchProject(rows, 'sound-enigne')).toMatchObject({ found: { id: 'p10' }, via: 'fuzzy' })
    expect(matchProject(rows, 'fabrik')).toMatchObject({ found: { id: 'p9' } })
    expect(matchProject(rows, '/w/DATA/fabric/')).toMatchObject({ found: { id: 'p9' }, via: 'folder' })
    const two = catalogue([{ id: 'a', name: 'x-app', repo_path: '/d/x-app' }, { id: 'b', name: 'x-api', repo_path: '/d/x-api' }])
    expect(matchProject(two, 'x-ap')).toMatchObject({ ambiguous: [{ id: 'a' }, { id: 'b' }] })
    expect(matchProject(rows, 'nothing-like-this-at-all')).toMatchObject({ missing: true })
  })
})

describe('contexts', () => {
  it('keeps the person\'s own context and every organization apart', () => {
    expect(contextOf('own', 'own')).toBe('personal')
    expect(contextOf(null, 'own')).toBe('personal')
    expect(contextOf('acme', 'own')).toBe('org:acme')
    expect(contextOf('Partner', 'own')).toBe('org:partner')
  })
  it('finds the longest folder that holds a path', () => {
    const m = new Map([['/d', 'a'], ['/d/x', 'b']])
    expect(holder(m, '/d/x/y')).toEqual({ folder: '/d/x', value: 'b' })
    expect(holder(m, '/dx')).toBeNull()
  })
})

describe('refs and quotes', () => {
  it('finds task ids, carry-over rows, ADRs and commits a text names', () => {
    const r = refsOf('closes 57781F0D-b2cd-4c2e-b080-52245bdc6ed6, CO-600, ADR-0199 at ' + 'a'.repeat(40))
    expect(r.uuids).toEqual(['57781f0d-b2cd-4c2e-b080-52245bdc6ed6'])
    expect(r.co).toEqual(['CO-600'])
    expect(r.adr).toEqual(['ADR-0199'])
    expect(r.shas).toHaveLength(1)
  })
  it('keeps only verbatim quotes that add no number, on an unchanged document', () => {
    const docs = new Map([['d1', { body: 'Сессия запущена в 12:30 по имени папки fabric.', digest: 'h1' }], ['d2', { body: 'x', digest: 'h2', retrieved: 'old' }]])
    const v = checkClaims([
      { doc: 'd1', quote: 'запущена в 12:30 по имени папки' },
      { doc: 'd1', quote: 'запущена в 12:30 по имени папки', text: 'в 13:30' },
      { doc: 'd1', quote: 'запущена в 14:00 по имени' },
      { doc: 'd2', quote: 'xxxxxxxxxxxxxxx' },
      { doc: 'nope', quote: 'xxxxxxxxxxxxxxx' },
      { doc: 'd1', quote: 'short' }
    ], docs)
    expect(v.map((x) => (x.kept ? 'kept' : x.reason))).toEqual(['kept', 'adds-number', 'not-verbatim', 'changed', 'unknown-doc', 'short'])
  })
})

describe('documents', () => {
  it('reads decisions, specs, docs and briefs, never dependencies or build output', () => {
    expect(['docs/adr/0001-x.md', 'README.md', 'AGENTS.md', 'pkg/adr/0002-y.md', 'docs/guide.md'].every(documentWanted)).toBe(true)
    expect(['node_modules/a/README.md', 'src/notes.md', 'docs/a.txt', 'dist/docs/x.md'].some(documentWanted)).toBe(false)
  })
  it('cuts at headings with their lines, never inside a code fence, and keeps a long section within SECTION_CHARS', () => {
    const text = ['# Title', 'intro', '## Decision', 'we choose A', '```', '# not a heading', '```', '## Long', ...Array.from({ length: 80 }, () => 'x'.repeat(60))].join('\n')
    const s = sections(text)
    expect(s.slice(0, 3).map((x) => [x.heading, x.lineStart])).toEqual([['Title', 1], ['Decision', 3], ['Long', 8]])
    expect(s[1]!.text).toContain('# not a heading')
    expect(s.every((x) => x.text.length <= SECTION_CHARS + 61)).toBe(true)
    expect(s.length).toBeGreaterThan(3)
  })
})

// @vitest-environment jsdom
// The screens wave (2026-11-16, ui UI-9): Markdown a person or an agent wrote is read as text, never as its raw marks,
// and never as HTML.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MarkdownText, markdownBlocks } from './MarkdownText'

afterEach(cleanup)

describe('Markdown said as text', () => {
  it('bold, italic, code and a link read without their marks', () => {
    const { container } = render(<MarkdownText text={'Делаю **по одному чтению**, *пока* `ci.sh fast` и [отчёт](https://example.com/r)'} />)
    expect(container.textContent).toBe('Делаю по одному чтению, пока ci.sh fast и отчёт')
    expect(container.querySelector('strong')?.textContent).toBe('по одному чтению')
    expect(container.querySelector('em')?.textContent).toBe('пока')
    expect(container.querySelector('code')?.textContent).toBe('ci.sh fast')
    expect(container.querySelector('.md-link')?.getAttribute('title')).toBe('https://example.com/r')
  })
  it('lists, headings, paragraphs, line breaks and a fenced block keep their shape', () => {
    expect(markdownBlocks('# План\n\n- один\n- два\n\n1. первый\n2. второй\n\nстрока\nещё\n\n```\na **b**\n```').map((b) => b.kind)).toEqual(['h', 'ul', 'ol', 'p', 'code'])
    const { container } = render(<MarkdownText text={'строка\nещё\n\n```\na **b**\n```'} />)
    expect(container.querySelectorAll('br')).toHaveLength(1)
    expect(container.querySelector('pre')?.textContent).toBe('a **b**')
  })
  it('HTML in a body is text, never markup', () => {
    const { container } = render(<MarkdownText text={'<img src=x onerror=alert(1)> <b>не жирный</b>'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })
  it('a lone star or underscore inside words stays as written', () => {
    const { container } = render(<MarkdownText text={'snake_case_name и 2 * 3 = 6'} />)
    expect(container.textContent).toBe('snake_case_name и 2 * 3 = 6')
  })
})

describe('a body as one line of words', () => {
  it('drops the marks, the bullets and a link\'s address', async () => {
    const { plainWords } = await import('./MarkdownText')
    expect(plainWords('Нужно сдвинуть окно на **пятницу**.\n\n- проверить сборку\n- обновить [план](https://x/y)\n# Итог `ok`')).toBe('Нужно сдвинуть окно на пятницу. проверить сборку обновить план Итог ok')
    expect(plainWords('snake_case_name и 2 * 3')).toBe('snake_case_name и 2 * 3')
  })
})

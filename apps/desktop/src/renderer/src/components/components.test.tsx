// The component set's contract (M117).
//
// These are not "does it render" tests. Each one asserts a rule that
// `docs/brand/ui.md` states in prose and that nothing could previously check:
// a state is carried by its WORD, an empty surface does not answer before it has
// read, a clickable row is reachable from a keyboard, a control does not submit
// a form by accident. Every one of them was watched failing against a planted
// defect before it was kept — the run's notes name which.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Banner } from './Banner'
import { Board, BoardColumn } from './Board'
import { Button } from './Button'
import { EmptyState } from './EmptyState'
import { Field } from './Field'
import { Panel } from './Panel'
import { Row } from './Row'
import { Stat, StatStrip } from './Stat'
import { StateChip } from './StateChip'
import { TaskCard } from './TaskCard'
import { Toolbar } from './Toolbar'
import { TabStrip } from './TabStrip'
import { COMPONENTS, LAYOUT, declaredClasses } from './registry'

afterEach(cleanup)

describe('Panel', () => {
  it('renders no header at all when it has neither a title nor actions', () => {
    const { container } = render(<Panel>body</Panel>)
    expect(container.querySelector('.panel-head')).toBeNull()
    expect(container.querySelector('.panel')?.textContent).toBe('body')
  })

  it('keeps the actions opposite the title even when there is no title', () => {
    const { container } = render(<Panel actions={<Button>Go</Button>}>x</Panel>)
    const head = container.querySelector('.panel-head')
    expect(head).not.toBeNull()
    // A spacer stands in for the missing title, or the actions jump to the left
    // edge and the panel reads as a different component.
    expect(head?.children.length).toBe(2)
  })

  it('is a real button when the whole card is one control', () => {
    const onClick = vi.fn()
    render(<Panel title="fabric" onClick={onClick}>purpose</Panel>)
    const card = screen.getByRole('button', { name: /fabric/ })
    expect(card.tagName).toBe('BUTTON')
    fireEvent.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is a section, not a button, when it is not clickable', () => {
    const { container } = render(<Panel title="t">x</Panel>)
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('section.panel')).not.toBeNull()
  })

  it('is quiet and wide only when asked', () => {
    const { container } = render(<Panel quiet wide title="t">x</Panel>)
    const panel = container.querySelector('.panel')
    expect(panel?.classList.contains('panel-quiet')).toBe(true)
    expect(panel?.classList.contains('span-2')).toBe(true)
  })
})

describe('StateChip', () => {
  it('always carries a word, and the dot is an addition rather than the state', () => {
    // ui.md: "Never replace running, blocked, done or failed with an unlabeled
    // brand-colour dot." The type system forbids omitting children; this asserts
    // the rendered result rather than the signature.
    const { container } = render(<StateChip tone="info" dot>running</StateChip>)
    const chip = container.querySelector('.chip')
    expect(chip?.textContent?.trim()).toBe('running')
    expect(chip?.classList.contains('chip-dot')).toBe(true)
    expect(chip?.classList.contains('chip-info')).toBe(true)
  })

  it('defaults to the quiet tone rather than to a colour', () => {
    const { container } = render(<StateChip>ended</StateChip>)
    expect(container.querySelector('.chip')?.classList.contains('chip-quiet')).toBe(true)
  })
})

describe('EmptyState', () => {
  it('says nothing about emptiness until the caller has read (M108)', () => {
    render(
      <EmptyState read={false} waiting="Reading…">
        No projects yet
      </EmptyState>
    )
    expect(screen.queryByText('No projects yet')).toBeNull()
    expect(screen.getByText('Reading…')).toBeTruthy()
  })

  it('answers once the caller has read', () => {
    render(<EmptyState read waiting="Reading…">No projects yet</EmptyState>)
    expect(screen.getByText('No projects yet')).toBeTruthy()
  })

  it('makes the caller SAY which, because the safe answer must not be the default', () => {
    // M108: `read` defaulted to `true`, so a caller who forgot it claimed to
    // have looked. Fifteen call sites were taking that default and four were
    // the surfaces the milestone names. The prop is required now, which is a
    // compiler error rather than a review comment.
    // @ts-expect-error `read` is required — this line is the check.
    void (<EmptyState waiting="Reading…">No projects yet</EmptyState>)
  })
})

describe('Row', () => {
  it('is a real button when it is clickable, so a keyboard can reach it', () => {
    const onClick = vi.fn()
    render(<Row onClick={onClick}>open</Row>)
    const row = screen.getByRole('button', { name: /open/ })
    expect(row.tagName).toBe('BUTTON')
    fireEvent.click(row)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is not a button when it is not clickable', () => {
    render(<Row>plain</Row>)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('omits the lead and trail cells rather than rendering them empty', () => {
    const { container } = render(<Row>only</Row>)
    expect(container.querySelector('.row-lead')).toBeNull()
    expect(container.querySelector('.row-trail')).toBeNull()
    expect(container.querySelector('.row-main')?.textContent).toBe('only')
  })
})

describe('Button', () => {
  it('never defaults to submit — an Electron renderer reloads the window on one', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })

  it('lets a caller ask for submit explicitly', () => {
    render(<Button type="submit">Save</Button>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit')
  })

  it('forwards its ref, so a caller can focus the choice it wants read first', () => {
    let node: HTMLButtonElement | null = null
    render(
      <Button
        ref={(el) => {
          node = el
        }}
      >
        Take what is on disk
      </Button>
    )
    expect(node).not.toBeNull()
    expect((node as unknown as HTMLButtonElement).tagName).toBe('BUTTON')
  })

  it('carries no tone class for the primary tone', () => {
    const { container } = render(<Button>Save</Button>)
    expect(container.querySelector('.btn')?.className).toBe('btn')
  })
})

describe('Field', () => {
  it('binds its label to the control it wraps', () => {
    render(<Field label="Project name">{(id) => <input id={id} defaultValue="fabric" />}</Field>)
    // getByLabelText resolves through htmlFor/id — it fails if the binding is
    // decorative, which is exactly the bug an unbound <label> is.
    expect((screen.getByLabelText('Project name') as HTMLInputElement).value).toBe('fabric')
  })
})

describe('Banner', () => {
  it('announces itself, because a message only shown visually is one a scrolled-away reader never gets', () => {
    render(<Banner>could not save</Banner>)
    expect(screen.getByRole('alert').textContent).toContain('could not save')
  })
})

describe('Toolbar and Stat', () => {
  it('aligns only when asked', () => {
    const { container } = render(<Toolbar align="between">x</Toolbar>)
    expect(container.querySelector('.toolbar-between')).not.toBeNull()
  })

  it('is a real button when the figure opens its evidence', () => {
    const onClick = vi.fn()
    render(<Stat label="events" value="4291" onClick={onClick} />)
    const stat = screen.getByRole('button', { name: /4291/ })
    fireEvent.click(stat)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is NOT a control when there is no register to open', () => {
    // The other half of the button test above, and the half M142 needs: a figure
    // whose rows have no screen must not LOOK pressable. A control that does
    // nothing is the claim-wearing-a-citation defect with a cursor change added.
    const { container } = render(<Stat label="context packs" value="12" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('.stat-interactive')).toBeNull()
  })

  it('renders a statistic that has not been read as its caller wrote it, not as zero', () => {
    render(
      <StatStrip>
        <Stat label="events" value="—" />
      </StatStrip>
    )
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText('events')).toBeTruthy()
  })
})

describe('TabStrip', () => {
  const strip = (activeKey: string | null): React.JSX.Element => (
    <TabStrip
      activeKey={activeKey}
      home={{ label: 'Home', glyph: '⌂', onSelect: () => {} }}
      close={{ label: 'Close tab', glyph: '×' }}
      items={[{ key: 'a', label: 'fabric', badge: '2 live', onSelect: () => {}, onClose: () => {} }]}
      actions={[{ variant: 'plus', label: 'New tab', glyph: '+', onSelect: () => {} }]}
      trailing="org #1"
    />
  )

  it('marks exactly one tab as the current page', () => {
    const { container } = render(strip('a'))
    const current = container.querySelectorAll('[aria-current="page"]')
    expect(current.length).toBe(1)
    expect(current[0].textContent).toContain('fabric')
  })

  it('puts the home tab forward when nothing else is active', () => {
    const { container } = render(strip(null))
    const current = container.querySelectorAll('[aria-current="page"]')
    expect(current.length).toBe(1)
    expect(current[0].getAttribute('aria-label')).toBe('Home')
  })

  it('names every icon-only control and hides the glyph from the reader', () => {
    render(strip('a'))
    // A strip whose buttons announce "×" is one a screen reader cannot navigate.
    for (const name of ['Home', 'Close tab', 'New tab'])
      expect(screen.getByRole('button', { name })).toBeTruthy()
  })
})

describe('Board — a column is never silently blank', () => {
  it('states its count beside its name', () => {
    render(
      <Board>
        <BoardColumn title="Running" count={3} read empty="nothing runs">
          <span>a card</span>
        </BoardColumn>
      </Board>
    )
    expect(screen.getByText('Running')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('an empty column that HAS read says it is empty', () => {
    render(
      <Board>
        <BoardColumn title="Review" count={0} read empty="nothing is waiting on you">
          {null}
        </BoardColumn>
      </Board>
    )
    expect(screen.getByText('nothing is waiting on you')).toBeTruthy()
  })

  it('an empty column that has NOT read says nothing — the M108 rule, per column', () => {
    render(
      <Board>
        <BoardColumn title="Review" count={0} read={false} empty="nothing is waiting on you">
          {null}
        </BoardColumn>
      </Board>
    )
    expect(screen.queryByText('nothing is waiting on you')).toBeNull()
  })

  it('renders its children when it has any, rather than the empty copy', () => {
    render(
      <Board>
        <BoardColumn title="Backlog" count={1} read empty="nothing is waiting">
          <span>the one card</span>
        </BoardColumn>
      </Board>
    )
    expect(screen.getByText('the one card')).toBeTruthy()
    expect(screen.queryByText('nothing is waiting')).toBeNull()
  })
})

describe('TaskCard — provenance is part of the card', () => {
  it('always shows who filed it', () => {
    render(<TaskCard title="Move ProjectHome" origin="⚙" />)
    expect(screen.getByText('⚙')).toBeTruthy()
    expect(screen.getByText('Move ProjectHome')).toBeTruthy()
  })

  it('shows the handoff when there is one', () => {
    render(<TaskCard title="Move ProjectHome" origin="⚙" by="CEO → dev" />)
    expect(screen.getByText('CEO → dev')).toBeTruthy()
  })

  it('carries the note about who moved it, and marks the impossible one', () => {
    // M124. The plain note is a caption; the warn variant is for a state the
    // ladder forbids an agent from reaching. If those render identically the
    // contradiction is just another grey line and nobody looks twice.
    const { container, rerender } = render(
      <TaskCard title="t" origin="⚙" note={{ text: 'the agent says this is done', warn: false }} />
    )
    expect(screen.getByText('the agent says this is done')).toBeTruthy()
    expect(container.querySelector('.task-card-note-warn')).toBeNull()

    rerender(<TaskCard title="t" origin="⚙" note={{ text: 'closed by an agent', warn: true }} />)
    expect(container.querySelector('.task-card-note-warn')).toBeTruthy()
  })

  it('grows no line when there is nothing to say about the move', () => {
    const { container } = render(<TaskCard title="t" origin="⚙" />)
    expect(container.querySelector('.task-card-note')).toBeNull()
  })

  it('its primary action is a real button, so a keyboard reaches it', () => {
    const onOpen = vi.fn()
    render(<TaskCard title="Run again" origin="✎" onOpen={onOpen} />)
    const title = screen.getByRole('button')
    expect(title.getAttribute('type')).toBe('button')
    fireEvent.click(title)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('is not a button when nothing happens on a click', () => {
    render(<TaskCard title="Waiting" origin="✎" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offers its moves through a control a keyboard can reach — drag is only the accelerator', () => {
    const onMove = vi.fn()
    render(
      <TaskCard
        title="Move me"
        origin="⚙"
        moveLabel="Move…"
        moves={[
          { value: 'review', label: 'Review' },
          { value: 'cancelled', label: 'Cancel…' }
        ]}
        onMove={onMove}
      />
    )
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'review' } })
    expect(onMove).toHaveBeenCalledWith('review')
  })

  it('offers no move control when the ladder allows nothing from here', () => {
    render(<TaskCard title="Closed" origin="⚙" moves={[]} onMove={vi.fn()} />)
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})

describe('the registry', () => {
  it('declares every class the components actually write', () => {
    const declared = declaredClasses()
    const rendered = new Set<string>()
    const { container } = render(
      <div>
        <Panel title="t" quiet wide actions={<Button tone="ghost">a</Button>}>
          <Row lead="1" trail="2" quiet>
            r
          </Row>
          <Row onClick={() => {}}>i</Row>
          <StateChip tone="good" dot>
            done
          </StateChip>
          <StateChip tone="warn">idle</StateChip>
          <StateChip tone="danger">failed</StateChip>
          <StateChip tone="info">running</StateChip>
          <EmptyState read loud>none</EmptyState>
          <Toolbar align="end">
            <Button tone="quiet">q</Button>
            <Button tone="danger">d</Button>
          </Toolbar>
          <StatStrip>
            <Stat label="l" value="v" />
            <Stat label="l2" value="v2" onClick={() => {}} />
          </StatStrip>
          <Field label="f">{(id) => <input id={id} />}</Field>
          <Banner tone="warn" actions={<Button>ok</Button>}>b</Banner>
        </Panel>
        <Panel onClick={() => {}}>card</Panel>
        <TabStrip
          activeKey="a"
          home={{ label: 'h', glyph: 'h', onSelect: () => {} }}
          close={{ label: 'c', glyph: 'c' }}
          items={[{ key: 'a', label: 'a', badge: 'b', onSelect: () => {}, onClose: () => {} }]}
          actions={[
            { variant: 'plus', label: 'p', glyph: 'p', onSelect: () => {} },
            { variant: 'settings-btn', label: 's', glyph: 's', onSelect: () => {} }
          ]}
          trailing="t"
        />
      </div>
    )
    container.querySelectorAll('[class]').forEach((el) => {
      el.classList.forEach((c) => rendered.add(c))
    })
    const undeclared = [...rendered].filter((c) => !declared.has(c))
    expect(undeclared).toEqual([])
  })

  it('declares no class twice across the two kinds of entry', () => {
    const seen = new Map<string, string>()
    const duplicates: string[] = []
    for (const entry of COMPONENTS)
      for (const cls of entry.classes) {
        if (seen.has(cls)) duplicates.push(`${cls}: ${seen.get(cls)} and ${entry.component}`)
        seen.set(cls, entry.component)
      }
    for (const cls of Object.keys(LAYOUT))
      if (seen.has(cls)) duplicates.push(`${cls}: ${seen.get(cls)} and LAYOUT`)
    expect(duplicates).toEqual([])
  })
})

// ── M197: двуязычие с фолбэком, наблюдаемым, а не молчаливым ────────────────
import { I18nProvider, useT } from '../i18n'
import { ru } from '../i18n/ru'
import { en } from '../i18n/en'

function Probe({ k }: { k: Parameters<ReturnType<typeof useT>>[0] }): React.JSX.Element {
  const t = useT()
  return <span>{t(k)}</span>
}

describe('bilingual registries (M197)', () => {
  it('a seeded key renders in Russian under the ru locale', () => {
    render(
      <I18nProvider locale="ru">
        <Probe k="settings.title" />
      </I18nProvider>
    )
    expect(screen.getByText('Настройки')).toBeTruthy()
  })

  it('an untranslated key falls back to English rather than the key itself', () => {
    // The translation debt reached zero on 2026-09-29, so there is no untranslated
    // key left to find; the fallback still matters for the window between an
    // English string landing and its translation. One key is withdrawn from the
    // Russian registry for the length of this test, then put back.
    const k = 'launch.search' as keyof typeof ru
    const saved = ru[k]
    delete (ru as Record<string, string | undefined>)[k]
    try {
      render(
        <I18nProvider locale="ru">
          <Probe k={k as never} />
        </I18nProvider>
      )
      expect(screen.getByText(en[k as keyof typeof en])).toBeTruthy()
    } finally {
      ;(ru as Record<string, string | undefined>)[k] = saved
    }
  })

  it('the endonym rule: the language picker names each language in itself', () => {
    expect(ru['settings.localeEn']).toBe('English')
  })
})

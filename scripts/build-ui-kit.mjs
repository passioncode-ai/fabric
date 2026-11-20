#!/usr/bin/env node
// #region ui-kit — docs: docs/brand/ui-kit.md#how-the-page-is-made
// Fabric's UI kit as one local page (the owner, 2026-11-20: «где у нас вообще фабричный бренд-бук, бренд-пак, короче
// стили, гайды для вёрстки, для элементов, собрать это все, чтобы у нас все новые экраны … быстренько собирались»).
// The page is BUILT from the renderer's own stylesheets (the vendored PassionCode tokens, the Paperclip type layer, the
// app's aliases and the component styles) and the component registry, so it cannot show a colour, a size or a component
// the app does not have. It is self-contained: no CDN, opened from the disk, both themes.
//
//   node scripts/build-ui-kit.mjs           write docs/brand/ui-kit.html
//   node scripts/build-ui-kit.mjs --check   the committed page is what the sources build (CI)
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'apps/desktop/src/renderer/src')
const OUT = path.join(ROOT, 'docs/brand/ui-kit.html')
const SHEETS = ['tokens.passioncode.css', 'tokens.paperclip.css', 'tokens.app.css', 'styles.css', 'components.css']
const read = (f) => readFileSync(path.join(SRC, f), 'utf8')
const css = SHEETS.map((f) => `/* ── ${f} ── */\n${read(f)}`).join('\n')
  // A font or image the app loads by URL is not in this page: the system font stands in, said in the page.
  .replace(/@font-face\s*{[^}]*}/g, '')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** `--name: value; /* note *\/` lines of a token file, in order, for one prefix; a note only from the same line. */
function tokens(file, prefix) {
  const out = []
  for (const m of read(file).matchAll(/(--[\w-]+)\s*:\s*([^;]+);[ \t]*(?:\/\*[ \t]*([^*\n]*?)[ \t]*\*\/)?/g)) {
    if (m[1].startsWith(prefix) && !out.some((t) => t.name === m[1])) out.push({ name: m[1], value: m[2].trim(), note: (m[3] ?? '').trim() })
  }
  return out
}
const registry = read('components/registry.ts')
const components = [...registry.matchAll(/component:\s*'(\w+)'[\s\S]*?classes:\s*\[([^\]]*)\][\s\S]*?(?:rule:\s*'([^']*)')?/g)]
  .map((m) => ({ name: m[1], classes: [...m[2].matchAll(/'([\w-]+)'/g)].map((x) => x[1]) }))

const colour = tokens('tokens.app.css', '--app-').filter((t) => !/fs-|lh-|track-|radius-/.test(t.name))
const states = tokens('tokens.app.css', '--state-')
const space = tokens('tokens.app.css', '--space-')
const type = tokens('tokens.app.css', '--app-fs-')
const radius = tokens('tokens.app.css', '--app-radius-')
const avatar = tokens('tokens.app.css', '--avatar-')

const swatch = (t) => `<div class="k-sw"><span class="k-chip" style="background:var(${t.name})"></span><code>${t.name}</code><small data-var="${t.name}"></small>${t.note ? `<em>${esc(t.note)}</em>` : ''}</div>`
const section = (id, title, body, lead = '') => `<section id="${id}"><h2>${title}</h2>${lead ? `<p class="k-lead">${lead}</p>` : ''}${body}</section>`

const body = [
  section('colour', 'Цвета: роли интерфейса', `<div class="k-grid">${colour.map(swatch).join('')}</div>`,
    'Компоненты берут только эти роли (<code>--app-*</code>), никогда сырой цвет: так обе темы и обновление PassionCode меняют все экраны сразу. Золото это действие, выбор и фокус, но не состояние.'),
  section('state', 'Цвета состояний', `<div class="k-grid">${states.map(swatch).join('')}</div>`,
    'Состояние говорит слово, цвет его поддерживает: рамка чипа или точка, но не текст.'),
  section('type', 'Типографика', type.map((t) => `<div class="k-type"><span style="font-size:var(${t.name})">Агент закончил шаг · 12:40</span><code>${t.name}</code><small data-var="${t.name}"></small>${t.note ? `<em>${esc(t.note)}</em>` : ''}</div>`).join(''),
    'Шкала в rem: системный размер текста масштабирует весь интерфейс. Новый экран не вводит свой размер шрифта.'),
  section('space', 'Отступы', space.map((t) => `<div class="k-space"><span style="width:var(${t.name})"></span><code>${t.name}</code><small data-var="${t.name}"></small></div>`).join(''),
    'Шесть шагов. Внутри строки и кнопки 1 и 2, между элементами карточки 3, вокруг карточки 4, между блоками экрана 5 и 6.'),
  section('radius', 'Скругления и тени', radius.map((t) => `<div class="k-radius"><span style="border-radius:var(${t.name})"></span><code>${t.name}</code><em>${esc(t.note)}</em></div>`).join('') +
    '<div class="k-radius"><span style="box-shadow:var(--shadow-modal);border-radius:var(--app-radius-panel)"></span><code>--shadow-modal</code><em>только то, что парит над интерфейсом: поп-ап, меню</em></div>'),
  section('components', 'Компоненты', `
<h3>Кнопки</h3><div class="k-row"><button class="btn">Основное действие</button><button class="btn btn-ghost">Вторичное</button><button class="btn btn-quiet">Тихое</button><button class="btn btn-danger">Опасное</button><button class="btn" disabled>Недоступно</button></div>
<p class="k-note">Одна основная кнопка на область задачи. Остальные с рамкой или тихие.</p>
<h3>Чипы состояний</h3><div class="k-row"><span class="chip chip-dot chip-info">работает</span><span class="chip chip-dot chip-warn">ждёт</span><span class="chip chip-dot chip-good">готово</span><span class="chip chip-dot chip-danger">нужен человек</span><span class="chip chip-quiet">закончено</span></div>
<h3>Карточка (Panel)</h3><div class="k-cols"><div class="panel"><div class="panel-head"><h3 class="panel-title">Fabric</h3><span class="chip chip-dot chip-info">2 агента</span></div><p class="panel-body">Карточка лежит на поверхности: заливка и тонкая линия, без тени.</p></div><div class="panel panel-quiet panel-interactive" tabindex="0"><div class="panel-head"><h3 class="panel-title">Кликабельная</h3></div><p class="panel-body muted">Вся карточка одна кнопка: наведение меняет линию и фон.</p></div></div>
<h3>Список (Row)</h3><div class="panel"><div class="row row-interactive" tabindex="0"><span class="row-lead"><span class="chip chip-dot chip-info">работает</span></span><span class="row-main">Сборка выпуска 0.3.27</span><span class="row-trail">2 мин назад</span></div><div class="row"><span class="row-lead"><span class="chip chip-quiet">закончено</span></span><span class="row-main">Обновление на месте, одна иконка</span><span class="row-trail">сегодня</span></div><div class="row row-quiet"><span class="row-main">Тихая строка: второстепенное</span></div></div>
<h3>Плашки (Banner)</h3><div class="banner banner-warn" role="status"><span>Диск почти полон: 6 ГБ свободно.</span><span class="banner-actions"><button class="btn btn-ghost">Почистить</button></span></div><div class="banner banner-error" role="status"><span>Fabric не смог запустить CEO.</span><span class="banner-actions"><button class="btn">Повторить</button></span></div>
<h3>Цифры (Stat)</h3><div class="stat-strip"><div class="stat"><span class="stat-value">202</span><span class="stat-label">на проверке</span></div><div class="stat"><span class="stat-value">7</span><span class="stat-label">брошено</span></div><div class="stat"><span class="stat-value">14</span><span class="stat-label">без задачи</span></div></div>
<h3>Поле (Field)</h3><div class="field"><label class="field-label" for="k-f">Имя проекта</label><input id="k-f" value="fabric"><span class="field-hint">Как в GitHub</span></div>
<h3>Пустое состояние</h3><p class="empty">Здесь пока ничего нет: агенты ещё не брали задач.</p>
<h3>Поп-ап (Dialog)</h3><div class="k-dialog"><div class="k-scrim"></div><div class="panel k-float"><div class="panel-head"><h3 class="panel-title">Удалить сессию?</h3></div><p class="panel-body">Поп-ап это карточка с тенью <code>--shadow-modal</code> над затемнением <code>--app-scrim</code>; одна основная кнопка справа.</p><div class="toolbar toolbar-end"><button class="btn btn-ghost">Отмена</button><button class="btn btn-danger">Удалить</button></div></div></div>
`, 'Живые образцы на настоящих стилях приложения. Новый экран собирается из них; класс, которого нет в реестре, гейт <code>check-design</code> не пропустит.'),
  section('registry', 'Реестр компонентов', `<table><thead><tr><th>Компонент</th><th>Классы</th></tr></thead><tbody>${components.map((c) => `<tr><td><code>${c.name}</code></td><td>${c.classes.map((x) => `<code>${x}</code>`).join(' ')}</td></tr>`).join('')}</tbody></table>`,
    'Каждый класс принадлежит ровно одному компоненту (<code>components/registry.ts</code>).'),
  section('face', 'Лицо CEO и значок приложения', `<div class="k-grid">${avatar.map(swatch).join('')}</div>`,
    'Значок Fabric в Dock это лицо CEO, которое выбрал человек (одна настройка). Знак PassionCode остаётся знаком организации.')
].join('\n')

const fingerprint = createHash('sha256').update(css).update(registry).digest('hex')
const html = `<!doctype html>
<html lang="ru" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fabric · UI kit</title>
<style>
${css}
/* ── the page's own frame, built on the same tokens ── */
body { margin: 0; background: var(--app-bg); color: var(--app-ink); font-family: var(--font-body); font-size: var(--app-fs-body); }
.k-page { max-width: 1080px; margin: 0 auto; padding: var(--space-6) var(--space-5); }
.k-top { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-4); }
.k-top h1 { font-size: var(--app-fs-title); margin: 0; }
section { margin-top: var(--space-6); }
section h2 { font-size: var(--app-fs-title); margin: 0 0 var(--space-2); }
section h3 { font-size: var(--app-fs-body); margin: var(--space-5) 0 var(--space-2); color: var(--app-muted); }
.k-lead, .k-note { color: var(--app-muted); max-width: 72ch; }
.k-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--space-2); }
.k-sw { display: grid; grid-template-columns: 32px 1fr; column-gap: var(--space-2); align-items: center; }
.k-sw .k-chip { grid-row: span 3; width: 32px; height: 32px; border-radius: var(--app-radius-control); border: 1px solid var(--app-line); }
.k-sw small, .k-type small, .k-space small { color: var(--app-muted); font-family: var(--font-mono); font-size: var(--app-fs-caption); }
.k-sw em, .k-type em, .k-radius em { color: var(--app-muted); font-style: normal; font-size: var(--app-fs-caption); }
.k-type { display: grid; grid-template-columns: 1fr 200px; column-gap: var(--space-4); padding: var(--space-2) 0; border-bottom: 1px solid var(--app-line); }
.k-space { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-1) 0; }
.k-space span { display: inline-block; height: 12px; background: var(--app-accent); }
.k-radius { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; }
.k-radius span { width: 56px; height: 40px; background: var(--app-panel); border: 1px solid var(--app-line-strong); }
.k-row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
.k-cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.k-dialog { position: relative; padding: var(--space-6); border-radius: var(--app-radius-panel); overflow: hidden; }
.k-scrim { position: absolute; inset: 0; background: var(--app-scrim); }
.k-float { position: relative; max-width: 420px; margin: 0 auto; box-shadow: var(--shadow-modal); }
table { border-collapse: collapse; width: 100%; } td, th { text-align: left; padding: var(--space-1) var(--space-2); border-bottom: 1px solid var(--app-line); vertical-align: top; }
.k-foot { margin-top: var(--space-6); color: var(--app-muted); font-size: var(--app-fs-caption); }
</style>
</head>
<body>
<div class="k-page">
<div class="k-top"><h1>Fabric · UI kit</h1><button class="btn btn-ghost" id="k-theme">Светлая тема</button></div>
<p class="k-lead">Один источник для всех экранов Fabric: правила в <a href="ui-kit.md">ui-kit.md</a>, значения в стилях приложения. Эта страница собрана из них скриптом <code>scripts/build-ui-kit.mjs</code>; править её руками бесполезно, гейт найдёт расхождение. Шрифт PassionCode здесь заменён системным.</p>
${body}
<p class="k-foot">Источники: ${SHEETS.map((s) => `<code>${s}</code>`).join(', ')}, <code>components/registry.ts</code>. Отпечаток: <code>${fingerprint.slice(0, 16)}</code>.</p>
</div>
<script>
// The value each token resolves to in the theme shown, read from the page itself.
function fill() { const cs = getComputedStyle(document.documentElement); document.querySelectorAll('[data-var]').forEach((el) => { el.textContent = cs.getPropertyValue(el.dataset.var).trim() }) }
document.getElementById('k-theme').addEventListener('click', (e) => { const r = document.documentElement; const light = r.dataset.theme !== 'light'; r.dataset.theme = light ? 'light' : 'dark'; e.target.textContent = light ? 'Тёмная тема' : 'Светлая тема'; fill() })
fill()
</script>
</body>
</html>
`
if (process.argv.includes('--check')) {
  let committed = ''
  try { committed = readFileSync(OUT, 'utf8') } catch { /* absent: stale below */ }
  if (committed !== html) { console.error('FAIL docs/brand/ui-kit.html is stale; run node scripts/build-ui-kit.mjs'); process.exit(1) }
  console.log(`PASS ui-kit.html matches its ${SHEETS.length} stylesheets and the component registry`)
} else {
  writeFileSync(OUT, html)
  console.log(`Built docs/brand/ui-kit.html: ${colour.length + states.length} colour roles, ${type.length} type steps, ${space.length} space steps, ${components.length} components`)
}
// #endregion ui-kit

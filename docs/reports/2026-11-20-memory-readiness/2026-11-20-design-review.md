report: design review of Memory (SCN-190, SCR-92) on the built screens stand · 2026-11-20 · design-tester

# Memory: design review, round 1

**Verdict.** Nothing stops the owner. Every step of SCN-190 works on the built stand: overview, freshness chips, the map
with hover and press, the project card narrowing search and changes, search hits, «Проверить цитату» (both outcomes) and
«Сутки» / «Неделя». The states also show as SCR-92 says (not open, catching up, source unread, no canvas, nothing found,
nothing changed). There is no `breaks` finding. There are **7 `risk`** and **8 `nit`** findings, listed below,
blocking-first. The **formal gate is NOT_RUN**: there is no test panel (`docs/ux/test-panel.md` does not exist), so the
ten-persona matrix could not be computed, and this review walked the scenario's own persona P-01 only.

## Gate output (first evidence)

The report gate reads JSON, so it was run on the fenced `design-review/1` block below, copied verbatim to the
scratchpad (`/private/tmp/claude-501/-Users-sshlg-DATA-fabric/fd9a633a-633f-48d6-981f-ea24a95c9d0e/scratchpad/design-review.json`).
Gate: task-pipeline 1.105.1 `scripts/design_gate.py`.

```
$ python3 design_gate.py panel docs/ux/test-panel.md
design_gate: NOT_RUN
  - no test panel at docs/ux/test-panel.md: super-ux `ux-foundation` builds it
exit=3
```

Surface class: Fabric's desktop app is PassionCode.ai's product, so `product` is the class judged; `internal` (the repository's detected surface) is shown for comparison. Under `product` the only problem is the missing panel; the 14 rows, the checklist items, the findings and the resource receipt raise none.

```
$ python3 design_gate.py report design-review.json --class product --panel docs/ux/test-panel.md --scope SCR-92 --require build
design_gate: NOT_RUN
  - coverage cannot be computed without a test panel with portraits; the gate does not pass on it
  note: coverage not computed: --panel and --scope are both needed
exit=3
$ python3 design_gate.py report design-review.json --class internal --panel docs/ux/test-panel.md --scope SCR-92 --require build
design_gate: PASS
  note: coverage not computed: --panel and --scope are both needed
  note: class internal: the review is recommended; problems are reported, not gated
exit=0
```

## What was walked, and how

| | |
|---|---|
| Commit under review | `533b38ee` (feat/knowledge-graph). Memory's sources (`MemoryScreen.tsx`, `memory.css`, `graph/`, the stand, `i18n`) have no diff against `706f6f34`; the stand bundle at `apps/desktop/out/stand` (built 22:16) carries `memory.css` and the `memoryBase` strings |
| Engine | WebKit 26.6, Playwright `webkit-2359`, headless (machine rule: WebKit first). Not Safari itself |
| Persona | P-01 Estate operator (SCN-190's only persona; `docs/ux/foundation.md`). The ten-portrait panel does not exist: NOT_RUN |
| Axes | ru and en; dark and light; 1440, 1024 and 820 wide (900 high); text at 200% (root font size doubled) |
| Pass D | scenario text only: no Figma frame and no mockup for SCR-92 (its states table says `Figma frame: none`; the product model calls the prototype's R0 layout early) |
| States the fixtures lack | fed at runtime by wrapping the stand's `window.fabric.memoryIndex` (not open, catching up, unread, stale, never read, nothing found, search refused, not verified, nothing changed); no canvas by making `getContext` answer null. No product file was edited |
| Keyboard | WebKit on macOS moves Tab between text fields only (Safari's default), so the reachability walk used Option+Tab, which reaches every control as Safari does |
| Measured in the page | em dash (U+2014) in visible text and in `aria-label`, `title`, `placeholder`; horizontal overflow; text contrast of every text element in the Memory section; non-text contrast of the chip dots and the map palette against the panel; positions of the parts |
| Machine | `resource_guard check` said wait (load 162 on 14 cores, memory pressure warn) at 22:27. I waited 12 minutes; the load moved between 77 and 153 and did not fall under 14 (other sessions' test runs, `fseventsd`, AdsPower). Following the guard's own text («wait, then run with fewer pages»), the walk ran at 22:39 with one browser and one page at a time; the reading at start (`go: false`, load 124.4, memory warn) is kept beside the captures as `guard-at-start.json` |
| Scripts | `walk.mjs`, `keys.mjs`, `summarise.py`, results `walk.json`, `keys.json`, all under `~/.cache/fabric-memory-measure/design-review/` |

Clean results, each measured in every run listed above:

- No em dash: 0 in visible text and 0 in attributes, ru and en, every state.
- No horizontal overflow at 820, 1024, 1440 or at 200% text (`scrollWidth - innerWidth` = 0; no element past the right edge; no clipped box).
- Text contrast: no text element under 4.5:1 (3:1 for large) in either theme. Chip dots 6.4:1 to 10.5:1.
- Focus: «Обновить», «По размеру окна», «То же таблицей», the search field, «Сутки», «Неделя», the table's «Открыть …» rows and «Проверить цитату» each show a 2 px ring (`rgb(255,210,26)` dark, `rgb(128,98,0)` light).
- Labels a person reads are names, not ids: organizations, projects and kinds are named («Личное», «Atlas», «Коммит»); no `ctx:` or `project:` id reaches the screen.
- The stand fed every call the screen made (`__standUnknown` empty); no page error.

Not measured: the labels drawn on the canvas (their contrast is not in the DOM); Safari itself through `safaridriver`; a
real index (the stand answers from fixtures).

## Findings, ranked

No `breaks`. Risks first, then nits. «Step» is SCN-190's step; captures are under
`~/.cache/fabric-memory-measure/design-review/` (not committed).

### Risks

1. **R1 · step 4, 1024 and 820 wide · `primary_action`.** The screen's primary action («Найти с цитатой», product
   model SCR-92) leaves the first screen below 1100 px. The side column drops under the 520 px map and its table
   (`memory.css:16`), so the search field starts at 1243 px (1024 wide) and 1327 px (820 wide) in a 900 px viewport. At 1440
   it is at 444 px. Evidence: `walk.json` runs `overview-ru-dark-1024`, `overview-ru-dark-820` (`where.search`);
   `s1-overview-ru-dark-820-full.png`.
2. **R2 · step 3, 1440 · `primary_action`.** A press on the map opens the card below the map, out of view: card top
   1012 px in a 900 px viewport. What the owner sees is only the two side headings changing to «Поиск в «Atlas»» and «Что
   изменилось в «Atlas»». Evidence: `walk.json` `walk-ru-dark-1440` step 3 `card.inView: false`; `s3-card-map-ru-dark.png`.
   Opened from the table by keyboard, the card does come into view (top 307 px, `keys.json`).
3. **R3 · step 3, 1024 and 820 · `text_fit`.** The card says «Поиск и изменения справа теперь только по этому проекту»
   (`ru.ts:2477`, en «on the right»). Below 1100 px they are not on the right but far below (R1). Evidence: `memory.css:16`,
   `MemoryScreen.tsx:229`.
4. **R4 · step 1 and the «source unread» state · `focus`.** A source that cannot be read says «есть ошибка, наведите для
   причины». The reason sits only in a `title` on a `<small>` with `tabIndex -1`, so keyboard and touch users cannot read
   it. Evidence: `MemoryScreen.tsx:127`; `walk.json` `states-ru-dark-1440` `err: {tabIndex: -1, focusable: false}`;
   `st-catching-ru-light.png`.
5. **R5 · step 2, light theme · `frame`.** The map's second group colour (`--graph-c2` = `--app-accent`, `graph.css:2`)
   stands at **1.34:1** against the light panel: the «Личное» hub and its projects are pale yellow on near-white, under the
   3:1 a meaningful graphic needs. Dark theme: 13.32:1. The table holds the same grouping, so nothing is lost, but the
   drawing's grouping in light is colour only. Evidence: `walk.json` `overview-ru-light-1440` `palette`;
   `s1-overview-ru-light-1440.png`.
6. **R6 · the «no canvas» state · `states`.** The note says the organizations and projects are «в таблице ниже», but the
   table stays collapsed (`tableOpen: false`). The hint under it still says «Наведите, чтобы увидеть соседей; нажмите, чтобы
   открыть карточку» about a drawing that is not there (`MemoryScreen.tsx:144` renders it whatever `GraphMap.tsx:141`
   shows). Evidence: `st-no-canvas-ru-dark.png`, `st-no-canvas-ru-light.png`.
7. **R7 · step 1 · `controls` (labels clear to the owner).** Four labels need a reading the owner does not have:
   «Документов 194 897» next to «Разделов документов 117 019» (two different «documents»); «По смыслу 2,9 % (5 600)» (share of
   what, 5 600 of what); «Файл 962 МБ» (which file); and the board chip's «осталось 1» with no unit (`ru.ts:2434`, the
   transcripts chip reads «осталось 4 210» the same way). SCN-190's own step 1 lists «documents» twice too. Evidence:
   `s1-overview-ru-dark-1440.png`, `ru.ts:2417`, `ru.ts:2419`.

### Nits

8. **N1 · step 1.** «135 552 связей» is the wrong plural (552 takes «связи»): the template is fixed, «{nodes} узлов, {edges}
   связей» (`ru.ts:2416`, `MemoryScreen.tsx:114`). en is right («135,552 links»).
9. **N2 · loading state.** The screen says «загружаем пространство…» (`MemoryScreen.tsx:105` uses `estate.reading`,
   `ru.ts:147`), where SCR-92 and the product model say «Читаю…». Source evidence only: the stand answers at once, so the
   loading line was not captured (NOT_RUN in the build row).
10. **N3 · «never read» chip.** A source never read says «ещё не читался» twice: the state, then the read time
    (`MemoryScreen.tsx:124`). Evidence: `st-catching-ru-light.png`, chip «Смысл (локальная модель)».
11. **N4 · step 4.** A hit's date is ISO («2026-11-16», `MemoryScreen.tsx:174`), while every other date on the screen reads
    «16 нояб., 12:48». Evidence: `s4-search-ru-dark.png`.
12. **N5 · step 3, keyboard.** After «Открыть Atlas» from the table, focus stays on the row and the card's «Закрыть» comes
    before it in tab order: 40 Option+Tab presses never reached it (Shift+Option+Tab does). Evidence: `keys.json`
    `toClose: null`.
13. **N6 · step 2.** Board lines are drawn in `--app-focus` (`GraphMap.tsx:93`), the same yellow as the `--graph-c2` group
    in the dark theme (both 13.32:1 on the panel, one colour in the capture), so a line between projects reads as part of the
    «Личное» group. Evidence: `s1-overview-ru-dark-1440.png`.
14. **N7 · error lines.** Machine reasons reach the Russian screen raw and in English, and one line starts lowercase:
    «поиск не удался: index not open» (`ru.ts:2483`), «estate.sqlite is locked by another process» under «База знаний сейчас
    не открыта.» The plain sentence comes first, so the owner still knows what happened. Evidence: `st-not-open-ru-dark.png`.
15. **N8 · step 4, against the spec.** Spec §1 says each hit shows «how it was found»; the hit carries `via` (words,
    vector, trigram) and the screen does not show it. SCN-190 step 4 does not ask for it, so this is a spec gap, not a
    scenario failure.

Excluded on purpose: the «SyntaxError: JSON Parse error: Unexpected identifier "undefined"» under the graph in
`st-catching-*.png` comes from my harness (it fed `undefined` for the graph answer), not from the product.

## Captures

All under `~/.cache/fabric-memory-measure/design-review/` (PNG, 2x, not committed):

| Step or state | Captures |
|---|---|
| 1 overview and chips | `s1-overview-{ru,en}-{dark,light}-1440.png`, `s1-overview-ru-{dark,light}-1024.png`, `s1-overview-ru-dark-820.png`, `s1-overview-en-light-820.png`, `s1-text200-ru-dark-1440.png` |
| 2 map hover, table | `s2-hover-ru-{dark,light}.png`, `s2-table-*-full.png` |
| 3 project card | `s3-card-map-ru-{dark,light}.png`, `k-enter-ru-{dark,light}-1440.png`, `k-enter-ru-dark-1024.png`, `k-row-*.png` |
| 4 search | `s4-search-ru-{dark,light}.png` |
| 5 check the quote | `s5-check-ru-{dark,light}.png` (verified and «Не подтверждена: источник изменился с поиска») |
| 6 day and week | `s6-week-ru-{dark,light}.png` |
| states | `st-not-open-ru-{dark,light}.png`, `st-catching-ru-{dark,light}.png`, `st-nothing-found-ru-{dark,light}.png`, `st-graph-unread-en-dark.png`, `st-no-canvas-ru-{dark,light}.png` |
| older project graph, for comparison | `cmp-graph-ru-dark-1440.png` |

## NOT_RUN

- The ten-persona panel: `docs/ux/test-panel.md` does not exist (`design_gate.py panel` exit 3). Super-ux `ux-foundation`
  builds it; until then coverage cannot be computed and the gate does not pass on a gated class.
- Step 6's outcome: the stand's `memoryIndex.changes` fixture answers the same 24-hour list whatever the window, so the
  switch was seen (`aria-pressed` moves to «Неделя») but the week's content was not read back.
- The loading line (N2): the stand answers at once.
- Safari itself (`safaridriver`); a real index; the canvas labels' contrast.

## The report, `design-review/1`

```json
{
  "schema": "design-review/1",
  "surface": "Fabric desktop: Memory (SCR-92), screens stand apps/desktop/out/stand",
  "panel_revision": "none: docs/ux/test-panel.md absent; persona P-01 from docs/ux/foundation.md at 533b38ee",
  "reason_panel": "no test panel; the scenario's own persona P-01 walked; ten-persona coverage NOT_RUN",
  "rows": [
    {"scenario": "SCR-92", "step": 1, "persona": "P-01", "pass": "design", "round": 1,
     "frame": "scenario text only: SCN-190 step 1 and SCR-92 states (no Figma frame, no mockup)",
     "checks": {"frame": "pass", "primary_action": "pass", "controls": "pass", "focus": "na", "states": "pass", "text_fit": "na", "outcome": "pass"},
     "findings": [{"severity": "risk", "what": "the step lists «documents» twice for two different counts; the build carries the ambiguity (R7)", "where": "docs/ux/scenarios.md SCN-190 step 1", "status": "open"}]},
    {"scenario": "SCR-92", "step": 2, "persona": "P-01", "pass": "design", "round": 1,
     "frame": "scenario text only: SCN-190 step 2, spec §1 (the same as text)",
     "checks": {"frame": "pass", "primary_action": "na", "controls": "pass", "focus": "pass", "states": "pass", "text_fit": "na", "outcome": "pass"}, "findings": []},
    {"scenario": "SCR-92", "step": 3, "persona": "P-01", "pass": "design", "round": 1,
     "frame": "scenario text only: SCN-190 step 3",
     "checks": {"frame": "pass", "primary_action": "pass", "controls": "pass", "focus": "na", "states": "pass", "text_fit": "na", "outcome": "pass"},
     "findings": [{"severity": "nit", "what": "where the card opens and where focus goes are not said; the build opens it out of view (R2)", "where": "SCN-190 step 3", "status": "open"}]},
    {"scenario": "SCR-92", "step": 4, "persona": "P-01", "pass": "design", "round": 1,
     "frame": "scenario text only: SCN-190 step 4, product model primary action «Найти с цитатой»",
     "checks": {"frame": "pass", "primary_action": "pass", "controls": "pass", "focus": "na", "states": "pass", "text_fit": "na", "outcome": "pass"},
     "findings": [{"severity": "nit", "what": "the narrow layout's place for the primary action is not designed; the build puts it under the map below 1100 px (R1)", "where": "SCR-92 axes 1024", "status": "open"}]},
    {"scenario": "SCR-92", "step": 5, "persona": "P-01", "pass": "design", "round": 1,
     "frame": "scenario text only: SCN-190 step 5",
     "checks": {"frame": "pass", "primary_action": "pass", "controls": "pass", "focus": "na", "states": "pass", "text_fit": "na", "outcome": "pass"}, "findings": []},
    {"scenario": "SCR-92", "step": 6, "persona": "P-01", "pass": "design", "round": 1,
     "frame": "scenario text only: SCN-190 step 6",
     "checks": {"frame": "pass", "primary_action": "pass", "controls": "pass", "focus": "na", "states": "pass", "text_fit": "na", "outcome": "pass"}, "findings": []},
    {"scenario": "SCR-92", "step": 7, "persona": "P-01", "pass": "design", "round": 1,
     "frame": "scenario text only: SCN-190 states covered, SCR-92 states table",
     "checks": {"frame": "pass", "primary_action": "na", "controls": "pass", "focus": "na", "states": "pass", "text_fit": "na", "outcome": "pass"},
     "findings": [{"severity": "nit", "what": "the no-canvas state does not say the table opens by itself; the build leaves it collapsed (R6)", "where": "SCR-92 state no canvas", "status": "open"}]},

    {"scenario": "SCR-92", "step": 1, "persona": "P-01", "pass": "build", "round": 1,
     "frame": "SCN-190 step 1, SCR-92 elements (no mockup)",
     "capture": "~/.cache/fabric-memory-measure/design-review/s1-overview-ru-dark-1440.png (also ru/en, dark/light, 1440/1024/820, text 200%)",
     "engine": "webkit 26.6 (Playwright webkit-2359, headless)",
     "outcome": "stats read back as fed (194 897 documents, 121 projects, 867 sessions, 962 МБ); five chips with state and read time; catching up, unread, stale and never-read chips shown when fed",
     "checks": {"frame": "pass", "primary_action": "pass", "controls": "fail", "focus": "fail", "states": "pass", "text_fit": "pass", "outcome": "pass"},
     "findings": [
       {"severity": "risk", "what": "R7: «Документов» next to «Разделов документов», «По смыслу 2,9 % (5 600)», «Файл», «осталось 1» without a unit: labels the owner cannot read alone", "where": "stats and board chip", "status": "open"},
       {"severity": "risk", "what": "R4: an unread source's reason is only in a title on a non-focusable element (tabIndex -1)", "where": "MemoryScreen.tsx:127, chip «Доска не читается»", "status": "open"},
       {"severity": "nit", "what": "N1: «135 552 связей», fixed plural template", "where": "ru.ts:2416", "status": "open"},
       {"severity": "nit", "what": "N3: a never-read chip says «ещё не читался» twice", "where": "MemoryScreen.tsx:124", "status": "open"}]},
    {"scenario": "SCR-92", "step": 2, "persona": "P-01", "pass": "build", "round": 1,
     "frame": "SCN-190 step 2, spec §1 graph row (no mockup)",
     "capture": "~/.cache/fabric-memory-measure/design-review/s2-hover-ru-dark.png (and -light)",
     "engine": "webkit 26.6 (Playwright webkit-2359, headless)",
     "outcome": "three organization hubs in three colours, 20 projects around them, board lines between projects; hover over Atlas names it and lights its neighbours; 21 nodes found by pointer",
     "checks": {"frame": "fail", "primary_action": "na", "controls": "pass", "focus": "pass", "states": "pass", "text_fit": "pass", "outcome": "pass"},
     "findings": [
       {"severity": "risk", "what": "R5: light theme, group colour --graph-c2 at 1.34:1 against the panel; the «Личное» group is colour only on the drawing", "where": "graph.css:2, s1-overview-ru-light-1440.png", "status": "open"},
       {"severity": "nit", "what": "N6: board lines in --app-focus, the same yellow as the --graph-c2 group in dark", "where": "GraphMap.tsx:93", "status": "open"}]},
    {"scenario": "SCR-92", "step": 3, "persona": "P-01", "pass": "build", "round": 1,
     "frame": "SCN-190 step 3 (no mockup)",
     "capture": "~/.cache/fabric-memory-measure/design-review/s3-card-map-ru-dark.png; k-enter-ru-dark-1440.png; k-enter-ru-dark-1024.png",
     "engine": "webkit 26.6 (Playwright webkit-2359, headless)",
     "outcome": "the card «Atlas · Личное» with Документов 6 000, counts by kind and last activity; search and changes headings narrowed to «Atlas»; an organization press opens its card and narrows nothing; from the table by keyboard the card opens in view",
     "checks": {"frame": "pass", "primary_action": "fail", "controls": "pass", "focus": "pass", "states": "pass", "text_fit": "fail", "outcome": "pass"},
     "findings": [
       {"severity": "risk", "what": "R2: after a press on the map the card opens at 1012 px, out of a 900 px view; only the side headings change", "where": "card under the map, 1440", "status": "open"},
       {"severity": "risk", "what": "R3: the card says search and changes are «справа»; below 1100 px they are below", "where": "ru.ts:2477, memory.css:16", "status": "open"},
       {"severity": "nit", "what": "N5: focus stays on the table row; «Закрыть» comes before it in tab order", "where": "keys.json toClose", "status": "open"}]},
    {"scenario": "SCR-92", "step": 4, "persona": "P-01", "pass": "build", "round": 1,
     "frame": "SCN-190 step 4 (no mockup)",
     "capture": "~/.cache/fabric-memory-measure/design-review/s4-search-ru-dark.png (and -light)",
     "engine": "webkit 26.6 (Playwright webkit-2359, headless)",
     "outcome": "two hits, each with kind, project, date, title and a verbatim passage; the commit hit with docs/CHANGELOG.md:68-72 (the task hit has no file); nothing found, words only and refused said in their own lines",
     "checks": {"frame": "pass", "primary_action": "fail", "controls": "pass", "focus": "pass", "states": "pass", "text_fit": "pass", "outcome": "pass"},
     "findings": [
       {"severity": "risk", "what": "R1: the primary action «Найти с цитатой» starts at 1243 px (1024 wide) and 1327 px (820 wide) in a 900 px view", "where": "memory.css:16, walk.json where.search", "status": "open"},
       {"severity": "nit", "what": "N4: hit date in ISO while the rest of the screen reads «16 нояб., 12:48»", "where": "MemoryScreen.tsx:174", "status": "open"},
       {"severity": "nit", "what": "N8: spec §1 asks for how a hit was found (via); not shown", "where": "hit card", "status": "open"}]},
    {"scenario": "SCR-92", "step": 5, "persona": "P-01", "pass": "build", "round": 1,
     "frame": "SCN-190 step 5 (no mockup)",
     "capture": "~/.cache/fabric-memory-measure/design-review/s5-check-ru-dark.png (and -light)",
     "engine": "webkit 26.6 (Playwright webkit-2359, headless)",
     "outcome": "«Цитата дословно есть в источнике.» on the first hit; «Не подтверждена: источник изменился с поиска» on the second when the check refused it",
     "checks": {"frame": "pass", "primary_action": "pass", "controls": "pass", "focus": "pass", "states": "pass", "text_fit": "pass", "outcome": "pass"}, "findings": []},
    {"scenario": "SCR-92", "step": 6, "persona": "P-01", "pass": "build", "round": 1,
     "frame": "SCN-190 step 6 (no mockup)",
     "capture": "~/.cache/fabric-memory-measure/design-review/s6-week-ru-dark.png (and -light)",
     "engine": "webkit 26.6 (Playwright webkit-2359, headless)",
     "outcome": "«Неделя» pressed (aria-pressed true, «Сутки» false); the list did not change because the stand's fixture is the same for every window",
     "checks": {"frame": "pass", "primary_action": "pass", "controls": "pass", "focus": "pass", "states": "pass", "text_fit": "pass", "outcome": "NOT_RUN"},
     "reason": "outcome: the stand answers memoryIndex.changes with one fixed 24-hour list, so the week's content cannot be read back here",
     "findings": []},
    {"scenario": "SCR-92", "step": 7, "persona": "P-01", "pass": "build", "round": 1,
     "frame": "SCN-190 states covered, SCR-92 states table (no mockup)",
     "capture": "~/.cache/fabric-memory-measure/design-review/st-not-open-ru-dark.png; st-catching-ru-light.png; st-no-canvas-ru-dark.png; st-nothing-found-ru-dark.png; st-graph-unread-en-dark.png",
     "engine": "webkit 26.6 (Playwright webkit-2359, headless)",
     "outcome": "not open: «База знаний сейчас не открыта.» with the reason, each part says its own failure; catching up: «Первый индекс ещё читается: осталось транскриптов 4 210»; nothing found and nothing changed in their own words; no canvas: the note instead of the drawing",
     "checks": {"frame": "pass", "primary_action": "na", "controls": "pass", "focus": "pass", "states": "fail", "text_fit": "pass", "outcome": "pass"},
     "reason": "loading line not captured: the stand answers at once (N2 rests on the source)",
     "findings": [
       {"severity": "risk", "what": "R6: no canvas: the note points to «таблице ниже» but the table stays collapsed, and the hover/press hint stays under a missing drawing", "where": "MemoryScreen.tsx:144, GraphMap.tsx:141", "status": "open"},
       {"severity": "nit", "what": "N2: loading says «загружаем пространство…», SCR-92 says «Читаю…»", "where": "MemoryScreen.tsx:105, ru.ts:147", "status": "open"},
       {"severity": "nit", "what": "N7: raw English machine reasons in the Russian screen, «поиск не удался: index not open» starts lowercase", "where": "ru.ts:2483", "status": "open"}]}
  ],
  "resources": {"started": [{"pid": 70933, "what": "playwright webkit server (Memory design review)", "kind": "browser"}, {"pid": 466, "what": "playwright webkit server (Memory keyboard supplement)", "kind": "browser"}], "live": [], "closed": true}
}
```

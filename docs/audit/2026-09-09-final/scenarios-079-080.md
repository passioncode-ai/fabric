# Fabric — дополнение аудита SCN-079 и SCN-080

Полный baseline source SHA: `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d`. **REFINE: 2 PARTIAL.**

Оба сценария существуют в baseline и добавляются к 78 ранее проверенным. Семь новых provider-сценариев считаются отдельно. Репозиторий и интеграционный worktree не изменялись. Все чтения — git show/git grep по SHA выше; native/runtime/prototype тесты не запускались.

## SCN-079 · Diff выбранного файла · PARTIAL

**Есть:** Desktop EditorWindow has hash-checked save and Monaco conflict diff, with disk content vs pending buffer and grant-controlled overwrite. It does not silently synthesize empty buffer content.

**Недоработки:** Diff exists only after a save conflict, with renderSideBySide:true fixed. There is no ordinary addressable selected-file Diff route/tab, revision and buffer generation selection or unified mode. M76 named by scenario/screen is the image/PDF owner; use M62 for Diff plus S13 shared source routes.

**Prototype:** Baseline scripts/product/operations.mjs:318 implements fixture file-diff from addressed file.disk/file.buffer with generation labels and split/unified controls, explicit missing source. scripts/test/product-operations.browser.cjs:25 covers this fixture path. Prototype source/test was inspected, not executed; fixture behavior is not production coverage.

**Владельцы:** M62, S13. **Пакеты:** AX-15 (add bounded diff subtask), UX28-06 (exact source/ref/back), AX-05 (buffer identity and async state), AX-17 (correct owner mapping).

**Commit-addressed source evidence:**

- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:docs/ux/scenarios.md:1862` (blob `e61f80ebf93b641c5bcac49de398b4051393ba25`): ### SCN-079: Diff выбранного файла
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:docs/ux/screens.md:1257` (blob `bc4720e5fe0db489ada5a6a5315e3105b478e0a7`): ### SCR-60: Diff выбранного файла
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:apps/desktop/src/renderer/src/EditorWindow.tsx:101` (blob `a6a2f90e203d41eb81ec84b02dea5b1fb8201ff8`): // The diff, shown only when the disk moved under us.
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:apps/desktop/src/renderer/src/EditorWindow.tsx:110` (blob `a6a2f90e203d41eb81ec84b02dea5b1fb8201ff8`): renderSideBySide: true,
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:apps/desktop/src/renderer/src/EditorWindow.tsx:129` (blob `a6a2f90e203d41eb81ec84b02dea5b1fb8201ff8`): const save = async (force = false): Promise<void> => {
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:apps/desktop/src/renderer/src/EditorWindow.tsx:236` (blob `a6a2f90e203d41eb81ec84b02dea5b1fb8201ff8`): <Button onClick={() => void save(false)} disabled={!!conflict || !dirty}>
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:scripts/product/operations.mjs:318` (blob `da545ef670ab6c0198f5317f68023cd7f59b5e0b`): function renderOpsDiff(o,state,f,p,branch){const path=state.file||'README.md',file=o.files[p.id+':'+path];if(!file)return opTitle('Diff недоступен',path+' · исходный файл не найден.',opLink('К файлам','workspace',{project:p.id}));const before=file.disk,after=file.buffer===null?file.disk:file.buffer,left=before.split('\n'),right=after.split('\n'),rows=Array.from({length:Math.max(left.length,right.length)},(_,i)=>({line:i+1,left:left[i],right:right[i]})),changes=rows.filter(r=>r.left!==r.right),split=o.ui.diffMode!=='unified';return opTitle('Diff · '+path,p.name+' · disk revision '+file.diskRevision+' → buffer generation '+file.generation,opLink('Редактор','editor',{project:p.id,file:path})+opButton('Раскрыть в Finder','asset-external',path))+opPanel('Выбранные версии',opRow('До','Сохранённый файл · revision '+file.diskRevision)+opRow('После','Ваш текущий буфер · generation '+file.generation)+opButton('Две колонки','diff-mode',path,'split')+opButton('Единый diff','diff-mode',path,'unified')+opRow('Различия',changes.length?changes.length+' строк отличаются':'Версии совпадают; сохранённых изменений нет'))+opPanel('Сравнение содержимого',branch==='source-missing'?opNotice('Одна версия не прочитана','Diff не вычисляется из пустого текста. Повторите чтение.',opButton('Повторить','branch-ready')):split?opTable(['Строка','Сохранённый файл','Текущий буфер'],rows.map(r=>[String(r.line),`<pre class="code-block">${opH(r.left??'∅')}</pre>`,`<pre class="code-block">${opH(r.right??'∅')}</pre>`])):`<pre class="code-block">${opH(changes.length?changes.map(r=>(r.left===undefined?'':'- '+r.left+'\n')+(r.right===undefined?'':'+ '+r.right)).join('\n'):'Различий нет')}</pre>`)}
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:scripts/test/product-operations.browser.cjs:25` (blob `aa02e5aa2660cbf86c5b1b9567bd2cd6cd68e3b4`): await go('editor',{project:'orbit',file:'README.md'});await screen.locator('[data-ops-file]').fill('Changed Orbit buffer');await go('file-diff',{project:'orbit',file:'README.md'});assert.match(await screen.innerText(),/Changed Orbit buffer/);assert.match(await screen.innerText(),/# Orbit/);await screen.locator('[data-ops-action="diff-mode"][data-ops-value="unified"]').click();assert.match(await screen.innerText(),/\+ Changed Orbit buffer/);await go('file-diff',{project:'orbit',file:'absent.md'});assert.match(await screen.innerText(),/исходный файл не найден/);checks.push('selected file diff uses actual saved revision and addressed unsaved buffer; missing file refuses fallback')
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:docs/evidence/backlog.md:347` (blob `fde9cd67329a2377090acef94568e7eb0556d6d6`): | M62 | **The project page is re-composed** | meta and statistics first and compact; then tasks with their statuses; then agents and automations; the file surface moves to the right and gains a **Diff** tab beside Files; memory and project information sit below; skills and plugins get a section when they exist. Attached repositories are configuration and move into settings | proposed |
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:docs/evidence/backlog.md:406` (blob `fde9cd67329a2377090acef94568e7eb0556d6d6`): | M76 | **Preview for what the editor cannot open** | images and PDFs. The editor handles text; a screenshot in a repo is a file an operator clicks and expects to see | proposed |

## SCN-080 · Документ и происхождение задач · PARTIAL

**Есть:** Idea recording sets task_type:idea and person origin; task UI offers research on backlog ideas; research creates another task and appends spawned link. TaskPage displays origin/assignment and clickable siblings. originDocument preserves trailing line handling and avoids splitting URL scheme.

**Недоработки:** Origin ref remains plain text, no document/revision renderer route or immutable document version key. Siblings are sameDocument path based, not revision based; capped .limit(AUTOMATION_WINDOW) reported as total=siblingRows.length with read errors erased. Research handler reads no task_type/status, accepts any source task and invokes legacy startTask before origin link append. Direct admit_task_launch checks status/blockers/lease but has no idea task_type rejection; UI-only research affordance does not enforce no-idea-run invariant.

**Prototype:** Baseline operations.mjs:313 renders exact fixture document path, current disk revision and derived task list; source absence is explicit. Prototype uses mutable fixture diskRevision and task origin path; it does not prove immutable historical document revision or production admission. Browser fixture route inventory exists (product-integrated.browser.cjs:15), not executed in this slice.

**Владельцы:** M124, M130, M134, S13, S04. **Пакеты:** UX28-06 (exact document/ref/siblings), AX-01 (research admission and idea refusal), AX-05 (stale task responses), AX-17 (canonical coverage/index).

**Commit-addressed source evidence:**

- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:docs/ux/scenarios.md:1880` (blob `e61f80ebf93b641c5bcac49de398b4051393ba25`): ### SCN-080: Документ и происхождение задач
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:docs/ux/screens.md:1280` (blob `bc4720e5fe0db489ada5a6a5315e3105b478e0a7`): ### SCR-61: Документ и происхождение задач
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:apps/desktop/src/renderer/src/TaskPage.tsx:132` (blob `f5cbec92909396e9ad34833c008e1a6ec9d595ad`): {task.task_type === 'idea' && task.status === 'backlog' && (
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:apps/desktop/src/renderer/src/TaskPage.tsx:164` (blob `f5cbec92909396e9ad34833c008e1a6ec9d595ad`): <p className="muted">
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:apps/desktop/src/renderer/src/TaskPage.tsx:253` (blob `f5cbec92909396e9ad34833c008e1a6ec9d595ad`): {detail.siblings.total > 0 && (
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:apps/desktop/src/main/index.ts:2035` (blob `8f5a5b09ffa2738c61a163dd8aaab23568d28fde`): const { data: idea, error } = await store
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:apps/desktop/src/main/index.ts:2048` (blob `8f5a5b09ffa2738c61a163dd8aaab23568d28fde`): const started = await startTask({
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:apps/desktop/src/main/index.ts:2056` (blob `8f5a5b09ffa2738c61a163dd8aaab23568d28fde`): await journal.append({
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:apps/desktop/src/main/index.ts:2088` (blob `8f5a5b09ffa2738c61a163dd8aaab23568d28fde`): const doc = t.origin_ref ? originDocument(t.origin_ref) : null
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:apps/desktop/src/main/index.ts:2127` (blob `8f5a5b09ffa2738c61a163dd8aaab23568d28fde`): siblings: {
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:apps/desktop/src/shared/origin.ts:37` (blob `3b71b7cacf5c218f0f381689c712d2592bb2a866`): export function originDocument(ref: string): string {
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:supabase/migrations/20260909000044_admit_task_launch.sql:44` (blob `76248f5e90f26b834905cb3eecdb55dfa597dea0`): select * into t from project_tasks
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:scripts/product/operations.mjs:313` (blob `da545ef670ab6c0198f5317f68023cd7f59b5e0b`): function renderOpsDocument(o,state,f,p){const path=state.file||'README.md',file=o.files[p.id+':'+path];if(!file)return opTitle('Документ недоступен',path+' · источник не подставляется.',opLink('К файлам','workspace',{project:p.id}));const tasks=opTasks(o,p.id).filter(t=>(t.origin_kind==='document'&&t.origin_ref===path)||t.source_document===path);return opTitle(path,'Документ проекта '+p.name+' · disk revision '+file.diskRevision,opLink('Редактировать','editor',{project:p.id,file:path})+opLink('Diff','file-diff',{project:p.id,file:path})+opButton('Раскрыть в Finder','asset-external',path))+opPanel('Содержимое',`<pre class="code-block">${opH(file.disk)}</pre>`)+opPanel('Задачи из этого документа · '+tasks.length,tasks.map(t=>opRow(t.id+' · '+t.title,t.task_type+' · '+opLabels[t.state],opLink('Открыть с обратной ссылкой','task',{project:p.id,task:t.id}))).join('')||'<p>Задач из этого документа пока нет.</p>')}
- `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d:scripts/test/product-integrated.browser.cjs:15` (blob `c1e35a7d7057a8b44a9cc691892804712af6ea07`): await check('new source tabs and service route rendered',async()=>{for(const view of ['internal-browser','media-preview','file-diff','document','service-terminal','task-archive']){await fresh('#view-'+view+'?project=orbit&file=README.md&service=agentgateway');assert.equal(await page.evaluate(()=>currentView),view);assert.equal(await screen.locator('[data-ops-view]').getAttribute('data-ops-view'),view)}});

## Дополнения уже существующих пакетов

Новых roadmap-пакетов не создано: все работы имеют существующий owner и входят в AX-15, UX28-06, AX-01.

### AX-15 / SCN-079 — Add M62 selected-file Diff as bounded source-reader subtask; do not assign to media M76

Owner: M62 + S13.

Reuse Monaco diff and authoritative FileRef/disk hash/buffer generation; separate read-only diff from overwrite permission. Add exact selected-file route/tab with split/unified toggle and editor return.

Декомпозиция:

1. Define immutable comparison input {project,root,file,diskHash,bufferGeneration}; validate both sources before comparison.
2. Make ordinary editor/workspace Diff action open exact read-only pair, preserve unsaved buffer and mode.
3. Support split/unified, missing disk revision, stale read, unchanged and conflict without implicit save/overwrite.
4. Retain existing conflict-save flow; test actual renderer models and delayed source reads.

Положительная приёмка:

- Ordinary edited buffer opens Diff without attempting save; exact before/after IDs visible.
- Split/unified display identical changes; return restores buffer, cursor and scroll.

Негативная приёмка:

- Missing historical disk version refuses compare, never substitutes empty/current unrelated text.
- Switch file while loading cannot show late prior file diff; no read-only compare triggers grant/save.

Зависимости:

- UX28-06/AX-05 exact route and owned buffer contract; existing file-root boundary

Не входит:

- No independent new roadmap packet; this is a fourth source-reader subtask in AX-15.
- No rewrite of shipped conflict diff or preview media implementation.

### UX28-06 / SCN-080 — Complete two-way document provenance with exact revision and honest sibling coverage

Owner: M124 + S13; retain M130 assignment fields.

DocumentRef must pin scope/path plus content revision or Git commit/blob. Distinguish current document from historical cited version; source resolver opens each honestly. Sibling grouping explicitly chooses same document vs same revision and exposes pagination/source failures.

Декомпозиция:

1. Extend canonical EntityRef with document revision; support legacy path-only refs as incomplete.
2. Render origin link to document viewer and derived tasks with exact source/return, preserving reference when denied/missing.
3. Return read-envelope and true/paginated sibling count; never use capped result length as full total.
4. Add fixtures for same path two revisions, same basename across projects, line refs, URLs, failed source and >AUTOMATION_WINDOW siblings.

Положительная приёмка:

- Task→document revision→sibling→Back keeps same provenance scope.
- Two tasks from different lines of same declared revision group correctly.

Негативная приёмка:

- A revised document cannot silently replace cited historic content.
- Unreadable sibling source cannot show empty list; capped list cannot claim complete total.

Зависимости:

- AX-05 routes and S14 read envelope; AX-01 research provenance atomically recorded

Не входит:

- No duplicate document bodies in task store.
- Do not reimplement originDocument path parsing already shipped.

### AX-01 / SCN-080 — Enforce idea cannot run and make research creation recoverable

Owner: M134 + S04.

Admission refuses task_type:idea at authoritative boundary; research command validates source kind/status, records child origin/spawn link under stable command before child admission. Use common launch path rather than legacy startTask.

Декомпозиция:

1. Add authoritative no-idea-run refusal with source-type/status receipt.
2. Research command accepts stable command ID, checks intended idea revision and creates linked child idempotently.
3. Admit child through shared service only after provenance exists; expose admitted/failed/unknown to operator.

Положительная приёмка:

- One valid idea research command creates one distinct child; idea stays backlog.
- Child spawn failure leaves linked failed child receipt inspectable.

Негативная приёмка:

- Direct IPC/RPC idea admission refuses even if UI bypassed.
- Non-idea/terminal/stale source refuses research; timeout retry produces no duplicate child.
- Failure between child creation and link cannot orphan provenance.

Зависимости:

- AX-01 common launch; S03 command boundary

Не входит:

- No new packet or provider run; fold into AX-01 launch service acceptance.

## Сверка со старым аудитом

- **File diff missing entirely — drop overbroad absence; retain selected-revision diff gap.** Conflict Monaco diff exists, ordinary selected-file split/unified reader missing.
- **Document/task provenance and research missing entirely — drop overbroad absence; retain exact revision, admission and source coverage residuals.** Origin/siblings/research foundations exist but desired complete SCN-080 path does not.
- **SCN-079 M76 ownership — correct mapping.** M76 is images/PDF preview; M62 explicitly owns Files/Diff tab.

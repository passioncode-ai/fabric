import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
export const inputPaths=['docs/architecture/system-model.json','docs/architecture/engineering-specs.json','docs/architecture/system-contract.md','scripts/templates/system-map.html','docs/evidence/plans/2026-09-07-engineering-contracts/signature.md','docs/evidence/plans/2026-09-09-provider-accounts-backlog/catalog-extension.json']
const read=p=>readFileSync(path.join(root,p),'utf8')
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export const anchor=id=>id.replaceAll('.','-')
const taskLink=id=>`<a href="#task-${anchor(id)}">${esc(id)}</a>`
const labels={solution:'Выбранное решение',why:'Зачем',interfaces:'Контракты и интерфейсы',invariants:'Инварианты',failure_cases:'Отказы и восстановление',tests:'Приёмка — будущие проверки',migration:'Миграция и совместимость',sources:'Источники',files:'Исследованные файлы',future_files:'Предлагаемые новые файлы',proposed_symbols:'Предлагаемые API',visible_result:'Что увидит пользователь',decision_gates:'Границы активации',dependency_payloads:'Что приходит от зависимостей',flow:'Алгоритм',failure_tests:'Негативные случаи',activation_gates:'Архитектурные ADR на review',capability_activation_gates:'Допуски отдельных возможностей',requirements:'Требования оператора',measured_effect:'Как измерить эффект',falsifiers:'Что опровергнет решение',original_delivery_state:'Исходный статус поставки',draft_ux_traces:'Сценарии и экраны',acceptance_status:'Статус проверок',contract_binding:'Общий контракт',out_of_scope:'Граница задачи'}
const label=k=>labels[k]||k.replaceAll('_',' ')
export function renderValue(v){
 if(v===null||v===undefined)return '<span class="muted">Не задано</span>'
 if(typeof v!=='object')return `<span>${esc(v)}</span>`
 if(Array.isArray(v))return v.length?`<ul>${v.map(x=>`<li>${renderValue(x)}</li>`).join('')}</ul>`:'<span class="muted">Нет элементов</span>'
 if(v.url&&v.path)return `<a href="${esc(v.url)}" target="_blank" rel="noreferrer">${esc(v.repository||'fabric')} · ${esc(v.path)}:${esc(v.line||'')}</a>${v.symbol?' · '+esc(v.symbol):''}${v.receipt?'<p>'+esc(v.receipt)+'</p>':''}${v.claim?'<p>'+esc(v.claim)+'</p>':''}${v.verification?'<small>Источник: '+esc(v.verification)+' · '+esc(v.commit||'current design')+'</small>':''}${v.excerpt?'<code>'+esc(v.excerpt)+'</code>':''}`
 return Object.entries(v).map(([k,x])=>`<div class="kv"><span class="field-label">${esc(label(k))}</span>: ${renderValue(x)}</div>`).join('')
}
const skip=new Set(['id','title','depth','modules','depends_on','batch','researcher','parts','design_status','implementation_in_this_change','canonical_dependencies','current_dependencies','dependencies','dependency_note','research','evidence','status','source_confidence'])
function cardBody(c){return `<div class="task-body"><p><span class="badge planned">Спецификация; реализация не выполнена этой итерацией</span></p><p><a href="product.html#handoff-${esc(c.id.split('.')[0])}">Экраны, сценарии и UX-контекст →</a></p><p><b>Зависит от:</b> ${(c.depends_on||[]).map(taskLink).join(' · ')||'Независимое начало'} · <b>Пакет:</b> ${esc(c.batch||'часть основной задачи')}</p>${Object.entries(c).filter(([k])=>!skip.has(k)).map(([k,v])=>`<h3>${esc(label(k))}</h3>${renderValue(v)}`).join('')}${(c.parts||[]).map(p=>`<details id="task-${anchor(p.id)}"><summary>${esc(p.id)} · ${esc(p.title||'Отдельная поставка')}</summary>${cardBody(p)}</details>`).join('')}</div>`}
export function renderSystemMap(){
 const raw=inputPaths.map(read),[modelRaw,catalogRaw,common,template,signature]=raw,model=JSON.parse(modelRaw),catalog=JSON.parse(catalogRaw)
 const fingerprint=createHash('sha256').update(inputPaths.map((p,i)=>p+'\0'+raw[i]).join('\0')).digest('hex')
 const depth={deep:'Глубокая спецификация',recipe:'Короткий рецепт',preserve:'Сохранить готовое'}
 const stat=(n,t)=>`<div class="stat"><b>${n}</b>${t}</div>`
 const fields={
 BASELINE:esc(model.source_commit.slice(0,7)),
 STATS:[[model.modules.length,'областей'],[model.entities.length,'сущностей'],[model.relations.length,'связей'],[model.cycles.length,'циклов'],[catalog.items.length,'заданий']].map(x=>stat(...x)).join(''),
 MODULES:model.modules.map(m=>`<div class="panel module-card" id="module-${m.id}"><a href="#module-${m.id}">${esc(m.name)}</a><p>${esc(m.purpose)}</p><div class="links">${m.tasks.map(taskLink).join(' · ')}</div></div>`).join(''),
 MODULE_OPTIONS:model.modules.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join(''),
 ORDER_OPTIONS:catalog.execution_nodes.map(n=>`<option value="${n.id}">${esc(n.id)} · ${esc(catalog.items.find(c=>c.id===n.parent_milestone)?.title||'')}</option>`).join(''),
 ORDER_ANCHORS:catalog.execution_nodes.map(n=>`<span id="order-task-${anchor(n.id)}"></span>`).join(''),
 ENTITY_ANCHORS:model.entities.map(e=>`<span id="entity-${e.id}"></span>`).join(''),
 ENTITIES:model.entities.map(e=>`<details id="entity-record-${e.id}"><summary>${esc(e.name)} · ${esc(e.implementation)}</summary><div>${renderValue(e)}</div></details>`).join(''),
 CYCLE_ANCHORS:model.cycles.map(c=>`<span id="cycle-${c.id}"></span>`).join(''),
 CYCLE_BUTTONS:model.cycles.map(c=>`<button type="button" data-cycle="${c.id}" aria-pressed="false">${esc(c.name)}</button>`).join(''),
 CYCLES_TEXT:model.cycles.map(c=>`<details id="cycle-record-${c.id}"><summary>${esc(c.name)}</summary>${renderValue(c)}</details>`).join(''),
 TASKS:catalog.items.map(c=>`<details class="task" id="task-${anchor(c.id)}" data-task="${c.id}"><summary>${esc(c.id)} · ${esc(c.title)} <span class="badge">${depth[c.depth]}</span></summary>${cardBody(c)}</details>`).join(''),
 DEPENDENCIES:`<p>${catalog.execution_nodes.length} узла · ${catalog.dependency_edges.length} зависимостей. Каждая стрелка несёт именованный результат.</p>${renderValue(catalog.dependency_adjudications)}<div class="table-wrap"><table><thead><tr><th>Поставщик</th><th>Потребитель</th><th>Что должно быть готово</th></tr></thead><tbody>${catalog.dependency_edges.map(e=>`<tr><td>${taskLink(e.from)}</td><td>${taskLink(e.to)}</td><td>${esc(e.carries)}</td></tr>`).join('')}</tbody></table></div>`,
 DECISIONS:model.decisions.map(d=>`<article class="panel section-gap" id="${d.id}"><span class="badge planned">${d.id} · proposed</span><h3>${esc(d.name)}</h3><p>${esc(d.choice)}</p><a href="../${d.path.replace(/^docs\//,'')}">Полный ADR ↗</a><p class="links">${d.tasks.map(taskLink).join(' · ')}</p></article>`).join(''),
 GLOBAL_CONTRACT:esc(common),SOURCE_HASH:fingerprint,
 SIGNATURE:`${signature.split('\n')[0]}<details><summary>Инструменты и участие</summary><pre>${esc(signature.split('\n').slice(1).join('\n'))}</pre></details>`,
 DATA:JSON.stringify({model,catalog}).replaceAll('<','\\u003c')
 }
 return template.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>{if(!(key in fields))throw new Error('Unknown template field '+key);return fields[key]})
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=renderSystemMap(),out=path.join(root,'docs/reports/system.html')
 if(process.argv.includes('--check')){if(readFileSync(out,'utf8')!==result)throw new Error('Generated system map is stale; run node scripts/build-system-map.mjs');console.log('PASS: system.html exactly matches model, catalog, contract and template')}
 else{writeFileSync(out,result);console.log('Built docs/reports/system.html')}
}

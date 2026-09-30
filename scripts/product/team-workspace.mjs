const teamEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function teamRunState(s,run){const p=s.projects.find(p=>p.id===run.project),task=p?.tasks.find(t=>t.id===run.task);return task?.state==='done'?'done':run.status==='review'&&p?.tasks.some(t=>t.revisesTask===run.task)?'changes':run.status}
export function teamWorkRows(s,project=null){
 const rows=[]
 for(const p of s.projects.filter(p=>!project||p.id===project)){
  for(const task of p.tasks){const run=s.runsById[s.taskRuns[task.id]];if(!run||run.project!==p.id||run.task!==task.id)continue
   const state=teamRunState(s,run)
   rows.push({project:p.id,projectName:p.name,task:task.id,title:task.title,run:run.id,session:run.session,provider:run.provider,agent:run.agent||null,state})
  }
 }
 const order={unknown:0,review:1,stopping:2,running:3,stopped:4,changes:4,done:5}
 return rows.sort((a,b)=>(order[a.state]??0)-(order[b.state]??0))
}
export function renderTeamWorkspace(s,project=null){
 const all=teamWorkRows(s,project),filter=s.teamFilters?.[project||'all']||'current',attention=r=>['unknown','review'].includes(r.state)
 const rows=all.filter(r=>filter==='history'?['done','changes'].includes(r.state):filter==='attention'?attention(r):!['done','changes'].includes(r.state))
 const labels={running:'Работает',stopping:'Останавливается',unknown:'Нужна проверка',stopped:'Остановлен',review:'Ждёт вас',changes:'Доработка в плане',done:'Завершено'}
 const statuses={unknown:'Нет подтверждения остановки',stopping:'Ожидаем завершения процесса',review:'Результат готов к разбору',stopped:'Контекст сохранён',changes:'Замечания переданы в следующую задачу',done:'Результат принят',running:'Выполняет задачу'}
 const running=all.filter(r=>r.state==='running').length,waiting=all.filter(attention).length
 return `<section class="r0-card team-workspace" aria-label="${project?'Агенты проекта':'Агенты всех проектов'}"><header class="team-heading"><div><h3>Агенты и работа</h3><p class="meta">${running} в работе · ${waiting} ждут вас</p></div><span class="team-signal ${running?'active':''}" aria-hidden="true"></span></header><div class="team-filters" role="group" aria-label="Показать работу">${[['current','Текущая'],['attention','Ждут меня'],['history','История']].map(([id,label])=>`<button type="button" class="cw-chip" data-r0="team-filter" data-value="${id}" data-project="${project||''}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div><div class="team-list">${rows.map(r=>`<button type="button" class="team-row" data-r0="open-run" data-value="${r.run}" aria-label="${teamEscape((r.provider==='codex'?'Codex':'Claude Code')+' · '+r.projectName+' · '+r.title+' · '+labels[r.state])}"><span class="team-provider" aria-hidden="true">${r.provider==='codex'?'⌘':'✳'}</span><span class="team-row-body"><span class="team-row-heading"><strong>${r.provider==='codex'?'Codex':'Claude Code'}</strong><span class="team-status ${r.state}">${labels[r.state]||'Статус неизвестен'}</span></span><span class="team-task">${teamEscape(r.title)}</span><span class="team-meta">${project?'Разработчик':teamEscape(r.projectName)+' · Разработчик'} · ${statuses[r.state]||'Перечитайте состояние'}</span></span><span class="team-arrow" aria-hidden="true">↗</span></button>`).join('')||`<div class="team-empty"><p>${filter==='attention'?'Сейчас решений не требуется.':filter==='history'?'Завершённые разборы появятся здесь.':all.length?'Нет активных запусков.':'Агенты ещё не начали работу.'}</p>${filter==='current'?`<button class="button" data-r0="${project?'plan-chat':'chat'}">${project?'Выбрать задачу с Fabric':'Поручить работу Fabric'}</button>`:''}</div>`}</div></section>`
}

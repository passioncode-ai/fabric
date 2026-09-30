// Deterministic preview catalog. Runtime NLU must resolve entities and use the same command handlers.
export const fabricCapabilities=[
 {id:'new-project',match:/создай.*проект|добавь.*проект/i,label:'Добавить проект',view:'launch-start',mode:'form'},
 {id:'notifications',match:/уведомлен|телеграм/i,label:'Уведомления',view:'notifications',mode:'form'},
 {id:'membership',match:/пригласи|участник|команд.*доступ/i,label:'Команда и доступ',view:'membership',mode:'form'},
 {id:'archive',match:/архив|удали проект/i,label:'Архив и удаление',view:'archive',mode:'form'},
 {id:'sync',match:/синхронизац|экспорт|импорт|восстанови/i,label:'Хранение и синхронизация',view:'sync',mode:'form'},
 {id:'reports',match:/отч[её]т|находк|проверь результат/i,label:'Результаты',view:'reports',mode:'read'},
 {id:'connection',match:/подключи|соединени/i,label:'Подключения',view:'connections',mode:'form'},
 {id:'diagnostics',match:/диагност|ошибк/i,label:'Диагностика',view:'diagnostics',mode:'read'},
 {id:'projects',match:/найди|найти|поиск|проекты|список проектов/i,label:'Найти проект',view:'search',mode:'read'},
 {id:'board',match:/доск|требует.*решени|внимани/i,label:'Что требует решения',view:'launch-board',mode:'read'},
 {id:'context',match:/контекст|изменени|где останов|статус|что происходит/i,label:'Вернуть контекст',view:'launch-project',mode:'read'},
 {id:'agents',match:/кто работает|список агентов|покажи агентов/i,label:'Исполнители',view:'agents',mode:'read'},
 {id:'tasks',match:/покажи задачи|список задач/i,label:'Задачи',view:'project',mode:'read'},
 {id:'goals',match:/цел[ьи]|приоритет|планирован/i,label:'Цели и приоритеты',view:'launch-plan',mode:'read'},
 {id:'history',match:/истори|решения принимали/i,label:'История решений',view:'decisions',mode:'read'},
 {id:'harness',match:/harness|харнес|арнес|доступ|инструмент|подключени/i,label:'Инструменты и доступ',view:'harness',mode:'form'},
 {id:'manager',match:/менеджер|сео|ceo|полномочи/i,label:'Полномочия Fabric',view:'manager',mode:'form'},
 {id:'execution-control',match:/(?:останов|продолж|возобнов).*(?:агент|исполнител|сесси|задач)|(?:агент|исполнител|сесси).*(?:останов|продолж|возобнов)/i,label:'Остановить или продолжить исполнителя',view:'r0-work',mode:'form'},
 {id:'pause',match:/пауз|останов|возобнов|расписани/i,label:'Управление циклами',view:'cycles',mode:'form'},
 {id:'run',match:/запусти|запуск|результат|провер[ьи].*работ/i,label:'Задачи и запуск',view:'project',mode:'form'},
 {id:'accounts',match:/аккаунт|провайдер|модел/i,label:'Аккаунты ИИ',view:'provider-accounts',mode:'form'},
 {id:'usage',match:/квот|лимит|стоимост|бюджет/i,label:'Квоты и расходы',view:'usage',mode:'read'},
 {id:'settings',match:/настройк|архив|удали проект/i,label:'Настройки проекта',view:'project-settings',mode:'form'},
 {id:'help',match:/помощ|умеешь|пример|обучени/i,label:'Руководство Fabric',view:'launch-help',mode:'read'}
]
export function classifyFabricIntent(text,kind){
 if(kind==='agent-config'||/создай.*агент|настрой.*агент/i.test(text))return {id:'agent-config',mode:'draft'}
 if(kind==='workflow-config'||/создай.*цикл|настрой.*цикл|утренний обзор/i.test(text))return {id:'workflow-config',mode:'draft'}
 if(/(?:создай|добавь|запиши|создать)\s+(?:новую\s+)?задач/i.test(text))return {id:'task',mode:'write'}
 if(/(?:создай|добавь|запиши).*тем[ау]/i.test(text))return {id:'topic',mode:'draft'}
 return fabricCapabilities.find(x=>x.match.test(text))||{id:'unknown',mode:'clarify'}
}
export function fabricReadResult(intent,text,context,fixtures){
 const projects=(fixtures.projects||[]).filter(p=>!p.archived&&!p.purged),p=projects.find(p=>p.id===context.project);
 const params={estate:context.estate,...(p?{project:p.id,scope:'project'}:{scope:'estate'})};
 if(intent.id==='projects'){const query=text.replace(/.*?(?:найди|найти|поиск)(?:\s+проект)?\s*/i,'').trim();const matches=/проекты|список проектов/i.test(text)?projects:projects.filter(p=>(p.name+' '+p.purpose).toLowerCase().includes(query.toLowerCase()));return {text:matches.length?'Нашёл: '+matches.map(p=>p.name).join(', '):'Совпадений в доступных проектах нет. Уточните название или откройте поиск.',links:matches.map(p=>({label:p.name,view:'launch-project',params:{project:p.id,estate:context.estate}})).concat([{label:'Открыть поиск',view:'search',params:{...params,search:query}}])}}
 if(intent.id==='unknown')return {text:'Уточните ожидаемый результат. В этом макете доступны примеры из руководства; неизвестный запрос не становится задачей.',links:[{label:'Примеры поручений',view:'launch-help',params}]};
 const globalOK=['board','goals','usage','accounts','help','manager','new-project','membership','notifications','diagnostics'].includes(intent.id);
 if(!p&&!globalOK)return {text:'Выберите проект в области разговора. Затем повторите запрос — он относится к конкретной работе.',links:projects.map(p=>({label:p.name,view:'launch-project',params:{project:p.id,estate:context.estate,ceo:'open'}}))};
 const tasks=(fixtures.tasks||[]).filter(t=>!p||t.project===p.id),questions=(fixtures.questions||[]).filter(q=>(!p||q.project===p.id)&&q.state==='open');
 const summary=intent.id==='context'?`${p.name}: ${p.purpose||'Цель ещё не уточнена'}. В снимке ${tasks.length} задач; открытых вопросов — ${questions.length}.`:intent.id==='board'?`Открытых вопросов в доступном снимке: ${questions.length}. Доска также содержит добавленные темы.`:intent.id==='tasks'?`В выбранном проекте ${tasks.length} задач.`:intent.mode==='form'?'Откройте точные параметры действия. Изменения пока не применены; проверки и подтверждение остаются в общей форме.':'Доступен текущий демонстрационный снимок. Подробности и источники — по ссылке.';
 return {text:summary,links:[{label:intent.label,view:intent.view,params}]}
}

// Target-design fixture only. No provider CLI, auth store, IPC or network access.
const paEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const paButton=(text,action,id='',primary=false)=>`<button type="button" class="button ${primary?'primary':''}" data-accounts-action="${action}" data-account-id="${paEscape(id)}">${paEscape(text)}</button>`
const paLink=(text,view)=>`<a class="button" href="#view-${view}?project=atlas&state=ready">${paEscape(text)}</a>`
const paPanel=(title,body)=>`<section class="panel"><header class="panel-head"><h3>${paEscape(title)}</h3></header>${body}</section>`
const paNotice=(title,body,buttons='')=>`<div class="notice"><strong>${paEscape(title)}</strong><p>${paEscape(body)}</p><div class="actions">${buttons}</div></div>`
const paHeading=(title,summary,action='')=>`<header class="page-title"><div><p class="eyebrow">Аккаунты ИИ · это устройство</p><h2 tabindex="-1">${paEscape(title)}</h2><p>${paEscape(summary)}</p></div><div class="actions">${action}</div></header>`
export function createProviderAccountsFixture(){return {provider:'claude',runtime:'host',defaults:{claude:'a',codex:'system-codex'},accounts:[{id:'system-claude',provider:'claude',label:'Системный вход',identity:'Личность не подтверждена',system:true},{id:'a',provider:'claude',label:'Рабочий',identity:'work@example.com · команда Atlas',usage:'Осталось 38% в пятичасовом окне · обновлено 1 мин назад'},{id:'b',provider:'claude',label:'Резервный',identity:'spare@example.com · команда Atlas',usage:'Квота неизвестна · источник ещё не ответил'},{id:'system-codex',provider:'codex',label:'Системный вход',identity:'Личность не подтверждена',system:true}],conversation:{id:'conversation-atlas-17',native:'native-demo-17',account:'a',generation:1,run:2,draft:'Продолжите проверку миграции.',messages:['Вы: Проверьте миграцию. Запомните контрольную метку «маяк-17».','Агент: Миграция проверена. Осталось проверить откат.'],otherAccount:'a'},selected:'b',auto:{enabled:false,strategy:'best',excluded:[],queued:false,cooldown:false,reason:''},phase:'idle',operation:0,receipts:[],notice:'',login:false,removeId:null}}
const paStore=s=>s.providerAccounts||(s.providerAccounts=createProviderAccountsFixture())
const paName=(a,id)=>a.accounts.find(x=>x.id===id)?.label||'Недоступный аккаунт'
function paFixtureLinks(view){const states=view==='provider-accounts'?['ready','empty','auth-required','runtime-offline','stale','denied']:['ready','busy','resume-failed','unknown','unsupported','auth-required','denied'];return `<details class="disclosure"><summary>Условия примера — только демонстрационные данные</summary><div class="actions">${states.map(x=>`<a class="button" href="#view-${view}?project=atlas&state=${x}">${paEscape(x)}</a>`).join('')}</div><p>Клики меняют только этот макет. Вход, расход квоты и восстановление CLI здесь не выполняются.</p></details>`}
function paAccountList(a,s){
 if(a.runtime!=='host'||s.state==='runtime-offline')return paNotice('Устройство недоступно','Аккаунты удалённого устройства сейчас неизвестны. Вход нужно выполнить на нём.',paButton('Вернуться к этому устройству','runtime','host'))
 const empty=s.state==='empty',accounts=a.accounts.filter(x=>x.provider===a.provider&&(!empty||x.system))
 let body=accounts.map(x=>`<div class="item"><div><strong>${paEscape(x.label)}</strong><p>${paEscape(x.identity)}</p><p class="meta">${x.system?'Использует текущий вход CLI на этом устройстве.':paEscape(s.state==='stale'?'Последняя квота устарела · обновите данные':x.usage||'Квота неизвестна')}</p>${a.defaults[a.provider]===x.id?'<span class="chip">Для новых разговоров</span>':''}</div><div class="actions">${a.defaults[a.provider]===x.id?'':paButton('Для новых разговоров','default',x.id)}${x.system?'':paButton('Обновить квоту','usage',x.id)+paButton('Удалить локально','remove',x.id)}</div></div>`).join('')
 if(empty)body+=paNotice('Добавлять аккаунты необязательно','Вы можете продолжать пользоваться обычным входом CLI.',paButton('Добавить аккаунт','login','',true))
 if(s.state==='auth-required')body=paNotice('Нужно войти снова','Вход истёк. История разговоров сохранена; продолжение требует подтверждённого аккаунта.',paButton('Войти снова','login','',true))+body
 return body
}
function paCompleteSwitch(a,s,automatic=false){
 const c=a.conversation
 if(s.state==='resume-failed'){a.phase='failed';a.auto.queued=false;a.receipts.push(`Переход ${a.operation}: checkpoint сохранён; целевое восстановление не подтверждено.`);return}
 const from=c.account;c.account=a.selected;c.generation++;c.run++;a.phase='idle'
 a.receipts.push(`Переход ${a.operation}: ${paName(a,from)} → ${paName(a,c.account)}; тот же разговор ${c.native}; новый прогон ${c.run}; ${automatic?'автоматически — '+(a.auto.triggerReason||'квота выше порога'):'ручной выбор'}.`)
 a.selected=from;a.auto.queued=false
 if(automatic){a.auto.cooldown=true;a.auto.reason='Пауза между автоматическими сменами: 5 минут.'}
 a.notice=automatic?'Продолжено автоматически в примере, без второго подтверждения. История, черновик и другой разговор сохранены.':'Разговор продолжен в примере. История и ожидающий текст сохранены; другой разговор не переключён.'
}
function paAutomaticPanel(a,s){
 if(['unsupported','unknown','auth-required'].includes(s.state))return paPanel('Автопереключение недоступно','<p>Сначала нужны подтверждённые вход, результат текущей операции и возможность продолжить эту историю.</p>')
 const enabled=a.auto.enabled
 return paPanel('Автопереключение',`<p><strong>${enabled?'Включено для этого разговора':'Выключено'}</strong> · Claude Code · это устройство · команда Atlas</p><p>После включения подходящий аккаунт будет выбран автоматически. Подтверждать каждую смену не потребуется; история должна быть восстановлена и проверена.</p><label class="field"><span>Как выбирать аккаунт</span><select name="pa-auto-strategy"><option value="best" ${a.auto.strategy==='best'?'selected':''}>Больше оставшейся квоты</option><option value="consume-first" ${a.auto.strategy==='consume-first'?'selected':''}>Раньше обновится недельная квота</option></select></label><p>Порог: использовано 90% · между сменами 5 минут · запас 10 процентных пунктов.</p><p>Разрешённые аккаунты: Рабочий${a.auto.excluded.includes('b')?'':' и Резервный'}. Другой разговор не включён в режим.</p><div class="actions">${paButton(a.auto.excluded.includes('b')?'Вернуть Резервный в ротацию':'Исключить Резервный из ротации','auto-exclude','b')}${paButton(enabled?'Приостановить автосмену':'Включить для этого разговора',enabled?'auto-pause':'auto-enable','',!enabled)}</div>${a.auto.reason?`<p role="status">${paEscape(a.auto.reason)}</p>`:''}<details class="disclosure"><summary>Условия примера автопереключения</summary><p>Демонстрационные наблюдения; настоящая квота не читается. В первом случае A использовал 95%, у B свежие 20%, оба входа и resume подтверждены. В примере раннего обновления оба ниже порога: A использовал 50%, B — 40%; подтверждённое недельное окно B обновится раньше.</p><div class="actions">${paButton('Пример: порог достигнут','auto-tick')}${paButton('Пример: квоты неизвестны','auto-unknown')}${paButton('Пример: B обновится раньше','auto-proactive')}</div></details>`)
}
export function renderProviderAccounts(view,s){
 if(!['provider-accounts','account-switch'].includes(view))return null
 const a=paStore(s),c=a.conversation
 if(s.state==='denied')return paHeading('Нет доступа','Сведения об аккаунтах и разговоре скрыты.')+paLink('Вернуться в обзор','estate')
 if(s.state==='loading')return paHeading('Читаем состояние','Аккаунт и результат операции пока неизвестны.')
 if(['partial','error','conflict','stale'].includes(s.state))return paHeading('Сначала обновите состояние','Последнее наблюдение не подтверждает текущие права и ревизию.')+paNotice('Изменение недоступно','Повторное чтение нужно до выбора аккаунта или продолжения разговора.',paLink('Повторить чтение',view))+paFixtureLinks(view)
 if(view==='provider-accounts'){
  const runtime=`<div class="actions">${paButton('Это устройство','runtime','host',a.runtime==='host')}${paButton('Удалённое устройство','runtime','remote',a.runtime==='remote')}</div>`
  const providers=`<div class="actions">${paButton('Claude Code','provider','claude',a.provider==='claude')}${paButton('Codex','provider','codex',a.provider==='codex')}</div>`
  const login=a.login||s.state==='login-pending'?paPanel('Вход на этом устройстве',paNotice('Ожидаем вход у провайдера','В продукте откроется официальный вход CLI. В примере проверенная личность — new@example.com, команда Atlas.',paButton('Завершить вход в примере','login-complete','',true)+paButton('Отменить вход','login-cancel'))):''
  const remove=a.removeId?paPanel('Удалить '+paName(a,a.removeId)+' с этого устройства?',paNotice('Сначала проверьте зависимости',a.removeId===c.account||a.removeId===c.otherAccount?'Аккаунт используют разговоры. Завершите их или явно выберите другой аккаунт.':a.defaults[a.provider]===a.removeId?'Сначала выберите другой аккаунт для новых разговоров.':'Активных разговоров на этом аккаунте нет. Сохранённая история останется. Это не выход из аккаунта у провайдера.',paButton('Назад','remove-cancel')+(!(a.removeId===c.account||a.removeId===c.otherAccount||a.defaults[a.provider]===a.removeId)?paButton('Удалить с устройства','remove-confirm',a.removeId):''))):''
  return paHeading('Аккаунты ИИ','Добавьте несколько аккаунтов, если хотите выбирать вход для своих разговоров.',a.runtime==='host'?paButton('Добавить аккаунт','login','',true):'')+paPanel('Устройство и провайдер',runtime+providers)+login+remove+(a.notice?paNotice('Результат',a.notice):'')+paPanel(a.provider==='claude'?'Claude Code':'Codex',paAccountList(a,s))+paNotice('Текущие разговоры сохраняют свой аккаунт','Выбор по умолчанию действует на новые запуски. Смену в текущем разговоре нужно выполнить отдельно.',paLink('Продолжить разговор Atlas','account-switch'))+paPanel('Другие провайдеры','<p>Gemini, OpenCode Go, MiniMax и Grok — за пределами первой поставки. Чтение квоты и продолжение разговора проверяются отдельно для каждого провайдера.</p>')+paFixtureLinks(view)
 }
 if(s.project!=='atlas')return paHeading('Разговор не найден в этом проекте','Данные другого проекта здесь не подставляются.')+paLink('Вернуться в обзор','estate')
 const candidates=a.accounts.filter(x=>x.provider==='claude'&&!x.system&&x.id!==c.account)
 if(!candidates.some(x=>x.id===a.selected))a.selected=candidates[0]?.id||''
 let controls=''
 if(s.state==='unsupported')controls=paNotice('Продолжение не подтверждено','Эта версия CLI не подтверждает восстановление разговора с другим аккаунтом. Текущий вход не изменён.',paLink('Вернуться к аккаунтам','provider-accounts'))+`<details class="disclosure"><summary>Отдельный новый разговор с переносом контекста</summary><p>Потребуется проверить состав контекста и отдельно разрешить запуск. Новый разговор получит другую историю. Этот путь относится к отдельному контракту передачи контекста.</p></details>`
 else if(s.state==='auth-required')controls=paNotice('Сначала подтвердите вход','Целевой аккаунт недоступен. Текущий разговор остаётся на прежнем аккаунте.',paLink('Войти в аккаунт','provider-accounts'))
 else if(s.state==='unknown')controls=paNotice('Результат перехода неизвестен','Не отправляйте запрос повторно. Сначала нужно сверить сохранённую операцию и убедиться, какой процесс владеет разговором.',paButton('Сверить ту же операцию','reconcile','',true))
 else if(a.phase==='failed')controls=paNotice('Разговор сохранён, продолжение остановлено','Новый процесс не подтвердил восстановление. Старый аккаунт пока не возобновлён.',paButton('Восстановить прежний аккаунт','restore','',true))
 else if(a.phase==='waiting')controls=paNotice('Ждём сохранённой границы','Агент ещё работает. Аккаунт не изменён; новый процесс не запущен.',paButton('Отменить переход','cancel')+`<details class="disclosure"><summary>Условие примера</summary>${paButton('Адаптер подтвердил границу','boundary')}</details>`)
 else if(a.phase==='prepared')controls=paPanel('Готово к продолжению',`<p><strong>${paEscape(paName(a,c.account))} → ${paEscape(paName(a,a.selected))}</strong></p><p>История сохранена. Личность, команда Atlas, рабочая папка и возможность восстановления проверены в демонстрационных данных.</p><p>Процесс будет перезапущен. Начнётся новый прогон той же задачи. Ожидающий текст останется в поле ввода.</p><div class="actions">${paButton('Продолжить с этим аккаунтом','commit','',true)}${paButton('Назад','cancel')}</div>`)
 else controls=paPanel('Аккаунт для этого разговора',`<label class="field"><span>Продолжить с аккаунтом</span><select name="pa-target">${candidates.map(x=>`<option value="${paEscape(x.id)}" ${x.id===a.selected?'selected':''}>${paEscape(x.label)} · ${paEscape(x.identity)}</option>`).join('')}</select></label><p>Сначала проверим вход и возможность сохранить этот разговор.</p>${paButton('Проверить переход','prepare','',true)}`)
 return paHeading('Продолжить разговор','Atlas · проверка миграции · Claude Code',paLink('Управлять аккаунтами','provider-accounts'))+paPanel('Сейчас',`<p><strong data-pa-current>${paEscape(paName(a,c.account))}</strong> · ${paEscape(a.accounts.find(x=>x.id===c.account)?.identity)}</p><p class="meta">${paEscape(c.id)} · прогон ${c.run} · ${s.state==='unknown'?'владелец процесса неизвестен':a.phase==='failed'?'остановлен':'история сохранена'}</p><p>Другой разговор Atlas остаётся на аккаунте «${paEscape(paName(a,c.otherAccount))}».</p>`)+controls+paAutomaticPanel(a,s)+(a.notice?paNotice('Результат',a.notice):'')+paPanel('Сохранённая история',`<div role="log" aria-label="История разговора">${c.messages.map(x=>`<p>${paEscape(x)}</p>`).join('')}</div><label class="field"><span>Ожидающий текст · не отправлен</span><textarea name="pa-draft" rows="3">${paEscape(c.draft)}</textarea></label>`)+(a.receipts.length?paPanel('История переходов',a.receipts.map(x=>`<p>${paEscape(x)}</p>`).join('')):'')+paFixtureLinks(view)
}
export function attachProviderAccountInteractions(root,{state,rerender}){
 if(root.dataset.accountsAttached)return
 root.dataset.accountsAttached='true'
 const current=()=>typeof state==='function'?state():state
 root.addEventListener('input',event=>{if(event.target.name==='pa-draft')paStore(current()).conversation.draft=event.target.value})
 root.addEventListener('change',event=>{if(event.target.name==='pa-target')paStore(current()).selected=event.target.value;if(event.target.name==='pa-auto-strategy'){const a=paStore(current());a.auto.strategy=event.target.value;if(a.auto.queued){a.auto.queued=false;a.phase='idle';a.auto.reason='Стратегия изменена; ожидающий выбор отменён до повторной проверки.';rerender()}}})
 root.addEventListener('click',event=>{
  const button=event.target.closest('[data-accounts-action]');if(!button||button.disabled)return
  const s=current(),a=paStore(s),c=a.conversation,action=button.dataset.accountsAction,id=button.dataset.accountId
  if(['denied','loading','partial','error','conflict','stale'].includes(s.state))return
  a.notice=''
  if(action==='auto-enable'){a.auto.enabled=true;a.auto.reason='Наблюдаем квоту этого разговора. Смена будет автоматической только внутри разрешённого набора.'}
  else if(action==='auto-pause'){a.auto.enabled=false;if(a.auto.queued){a.auto.queued=false;a.phase='idle'}a.auto.reason='Автосмена на паузе. Ожидавший переход отменён до остановки.'}
  else if(action==='auto-exclude'){a.auto.excluded=a.auto.excluded.includes(id)?a.auto.excluded.filter(x=>x!==id):[...a.auto.excluded,id];if(a.auto.queued){a.auto.queued=false;a.phase='idle'}a.auto.reason='Набор аккаунтов изменён. Ожидающий выбор нужно рассчитать заново.'}
  else if(action==='auto-unknown'){a.auto.reason='Квоты неизвестны. Переход удержан до свежего наблюдения; аккаунт не изменён.'}
  else if(action==='auto-tick'||action==='auto-proactive'){
   if(!a.auto.enabled)a.auto.reason='Автосмена выключена. Аккаунт не изменён.'
   else if(action==='auto-proactive'&&a.auto.strategy!=='consume-first')a.auto.reason='Порог не достигнут. Стратегия большей квоты сохраняет текущий аккаунт.'
   else if(a.phase!=='idle'&&!a.auto.queued)a.auto.reason='Есть незавершённая операция. Сначала сверка или восстановление.'
   else if(a.auto.cooldown)a.auto.reason='Действует пауза между сменами. Повторного переключения нет.'
   else if(a.auto.queued)a.auto.reason='Переход уже ждёт границы. Повторная проверка не создаёт второй запрос.'
   else{const target=a.accounts.find(x=>x.provider==='claude'&&!x.system&&x.id!==c.account&&!a.auto.excluded.includes(x.id));if(!target)a.auto.reason='Нет разрешённого аккаунта с подтверждённой свободной квотой. Работа ожидает следующей проверки.'
    else{a.auto.triggerReason=action==='auto-proactive'?'раньше обновится недельная квота':'квота выше порога';a.selected=target.id;a.operation++;if(s.state==='busy'){a.phase='waiting';a.auto.queued=true;a.auto.reason='Порог достигнут. Ждём подтверждённой границы; затем продолжим автоматически.'}else{a.phase='prepared';paCompleteSwitch(a,s,true)}}
   }
  }
  else if(action==='provider'){a.provider=id;a.login=false;a.removeId=null}
  else if(action==='runtime'){a.runtime=id;a.login=false;s.state='ready'}
  else if(action==='login'){a.login=true}
  else if(action==='login-cancel'){a.login=false;s.state='ready';a.notice='Вход отменён. Другие аккаунты не изменены.'}
  else if(action==='login-complete'){if(!a.accounts.some(x=>x.id==='added-'+a.provider))a.accounts.push({id:'added-'+a.provider,provider:a.provider,label:'Новый аккаунт',identity:'new@example.com · команда Atlas',usage:'Квота неизвестна'});a.login=false;s.state='ready';a.notice='Личность подтверждена в примере. Аккаунт сохранён на этом устройстве.'}
  else if(action==='default'){a.defaults[a.provider]=id;a.notice='Выбран вход для новых разговоров. Текущие разговоры не переключены.'}
  else if(action==='usage'){const account=a.accounts.find(x=>x.id===id);if(account){account.usage='Квота неизвестна · источник не ответил на обновление';a.notice='Источник квоты этого аккаунта не ответил. Данные другого аккаунта не подставлены.'}}
  else if(action==='remove')a.removeId=id
  else if(action==='remove-cancel')a.removeId=null
  else if(action==='remove-confirm'&&a.removeId===id&&![c.account,c.otherAccount,a.defaults[a.provider]].includes(id)){a.accounts=a.accounts.filter(x=>x.id!==id);a.removeId=null;a.notice='Локальный профиль удалён. История сохранена.'}
  else if(action==='prepare'&&a.selected){a.auto.enabled=false;a.auto.queued=false;a.operation++;a.phase=s.state==='busy'?'waiting':'prepared'}
  else if(action==='cancel'){a.auto.queued=false;a.phase='idle';a.notice='Переход отменён до остановки. Текущий аккаунт сохранён.'}
  else if(action==='boundary'&&a.phase==='waiting'){a.phase='prepared';s.state='ready';if(a.auto.queued&&a.auto.enabled)paCompleteSwitch(a,s,true)}
  else if(action==='commit'&&a.phase==='prepared')paCompleteSwitch(a,s)
  else if(action==='restore'&&a.phase==='failed'){a.phase='idle';c.generation++;c.run++;s.state='ready';a.receipts.push(`Переход ${a.operation}: прежний аккаунт восстановлен, новый прогон ${c.run}.`);a.notice='В примере прежний аккаунт и разговор подтверждены. Ожидающий текст не отправлен.'}
  else if(action==='reconcile'){a.notice='Квитанции пока недостаточно. Результат остаётся неизвестным; повторный запуск не выполнен.'}
  rerender()
 })
}

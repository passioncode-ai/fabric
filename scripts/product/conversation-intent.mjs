// Deliberately bounded prototype grammar. Native intent resolution must emit the
// same addressed command; it must never execute arbitrary text as authority.
export function conversationIntent(text) {
 const t=String(text||'').trim().toLocaleLowerCase('ru').replace(/[.!]+$/,'').trim()
 if(/^(да|давай|принимаю|принять|согласен|согласна|сохрани|подтверждаю)$/.test(t))return 'accept'
 if(/^(добавь задачу|добавить задачу|добавить следующий шаг|принять итог и добавить задачу)$/.test(t))return 'task-accept'
 if(/^(принимаю результат|принять результат)$/.test(t))return 'review-accept'
 if(t==='добавить доработку')return 'rework-accept'
 if(/^(нет|не надо|отмена|отмени|отмени предложение|не принимаю|отклонить|отклоняю|не сейчас|не принимай)$/.test(t))return 'decline'
 if(/^(остановить запуск|останови запуск)$/.test(t))return 'stop'
 if(/^(открыть план)$/.test(t))return 'plan'
 if(/^(подготовить задачу)$/.test(t))return 'task'
 if(/^(запусти|запускай|начать работу|запусти задачу)$/.test(t))return 'run'
 if(t.endsWith('?')||/^(почему|зачем|что значит|что произойдёт|что произойдет|объясни|какой|какие|как |что сейчас)/.test(t))return 'explain'
 return 'refine'
}
export function proposalReference(b){return b?.outcome?{ticket:b.id,proposal:b.outcome.id}:null}

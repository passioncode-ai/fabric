// Addressed references only; no file contents, implicit permissions or cross-project writes.
export function fabricContextItems(fixtures){
 const projects=(fixtures.projects||[]).filter(p=>!p.archived&&!p.purged),ids=new Set(projects.map(p=>p.id)),name=id=>projects.find(p=>p.id===id)?.name||id;
 const rows=projects.map(p=>({id:'project:'+p.id,kind:'Проект',title:p.name,project:p.id,view:'launch-project',params:{project:p.id}}));
 for(const [collection,kind,view,param] of [['tasks','Задача','task','task'],['decisions','Решение','decisions','decision'],['events','Событие','project-history','item']])for(const x of fixtures[collection]||[]){if(!x.id||!ids.has(x.project))continue;rows.push({id:collection+':'+x.project+':'+x.id,kind,title:x.title||x.summary||x.id,project:x.project,projectName:name(x.project),view,params:{project:x.project,[param]:x.id},revision:x.revision||null})}
 return rows
}
export function resolveFabricAttachments(selected,available){const indexed=new Map(available.map(x=>[x.id,x]));if(selected.some(x=>!indexed.has(x.id)))return {ok:false,error:'Один из источников больше недоступен. Удалите его из контекста или восстановите доступ.'};return {ok:true,items:selected.map(x=>structuredClone(indexed.get(x.id)))}}

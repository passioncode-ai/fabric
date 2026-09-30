// Immutable source inventory; classification is a proposed launch overlay, not delivery state.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {cells} from '../../../scripts/lib/markdown-table.mjs';
const commit='d0260d430797f16dfaad1fde53a72afbed503893';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
const hash=s=>createHash('sha256').update(s).digest('hex');
const paths=git('ls-tree','-r','--name-only',commit,'docs').trim().split('\n');
const read=p=>git('show',`${commit}:${p}`);
const sourceUrl=(p,line)=>`https://github.com/passioncode-ai/fabric/blob/${commit}/${p}${line?'#L'+line:''}`;
const groups={
  'growth-ops':'M4 M9 M11 M12 M19 M20 M21 M22 M23 M24 M25 M26 M27 M28 M29 M30 M31 M128 M129',
  'providers':'M32 M33 M34 M60 M69 M92 M93 M172 M199',
  'federation':'M35 M36 M37 M38 M39 M40 M41',
  'channels':'M8 M159 M160 M161 M162 M163 M164 M165',
  'workflow-builder':'M18 M87 M88 M89 M90 M91',
  'manager-expansion':'M7 M14 M50 M52 M84 M119 M126 M153 M154 M157 M158 M166 M167 M168 M169 M170 M171 M174 M175 M176 M182 M183 M184 M194',
  'context-work':'M0 M1 M2 M3 M5 M6 M10 M15 M16 M17 M42 M43 M44 M45 M46 M47 M48 M49 M51 M53 M54 M55 M56 M59 M61 M62 M70 M71 M74 M78 M79 M85 M86 M95 M96 M100 M103 M104 M106 M107 M108 M109 M111 M112 M118 M121 M122 M123 M124 M125 M127 M130 M133 M134 M135 M136 M137 M138 M139 M140 M141 M143 M144 M145 M146 M147 M148 M149 M150 M151 M152 M155 M156 M173 M177 M178 M179 M180 M181 M185 M188 M189 M190 M191 M195 M196 M198',
  'cycles':'M13 M65 M66 M67 M68 M73 M94 M132 M186',
  'identity-experience':'M57 M63 M64 M72 M77 M82 M83 M116 M117 M120 M131 M142 M187 M197',
  'rich-experience':'M58 M75 M76',
  'engineering':'M81 M97 M98 M99 M101 M102 M105 M110 M113 M114 M115'
};
const byId=new Map();for(const [g,ids] of Object.entries(groups))for(const id of ids.split(' ')){if(byId.has(id))throw Error('Duplicate mapping '+id);byId.set(id,g);}
const reasons={
 'context-work':'Сохранить рабочий механизм; выбрать точный необходимый срез и проверить актуальную приёмку D01. Старое open/shipped не является новым verdict.',
 'identity-experience':'В R1 входит профиль/компоновка/истинность данных; дополнительные масштабы и controls — после основного сценария.',
 'cycles':'Базовый повтор и наблюдение входят в R1; расширение политик идёт через Continuity contract.',
 'manager-expansion':'Ограниченный профиль Fabric определяется D04; полная автономия сохраняется за пределами этого среза до своих activation gates.',
 'providers':'Сохранить имеющиеся adapters; новые provider/account гарантии активировать только по conformance и измеренной потребности.',
 'growth-ops':'Расширение Project observe-to-verify после доказанного R1 и выбора конкретного источника/эффекта.',
 'federation':'Сохранить границы tenant/role сейчас; активировать командную/рыночную capability перед первым внешним участником.',
 'channels':'Позднейший транспорт через существующие scope/commands/outbox; его security prerequisites не отменяются.',
 'workflow-builder':'В R1 один преднастроенный workflow; общий редактор после подтверждённой недостаточности шаблона.',
 'rich-experience':'Сохранённая дополнительная поверхность; не блокирует основной цикл первой поставки.',
 'engineering':'Исправлять блокирующее выбранный путь; большой размер файла сам по себе не является gate всего продукта.',
 'portfolio-operations':'Исторические внешние проблемы сохранены отдельной очередью проектов; текущая срочность требует свежего наблюдения.',
 'cost-ledger':'Сохранённая очередь источников стоимости; включать при измеряемом источнике, не выдумывать затраты.',
 'carryover':'Открытый вопрос остаётся при своей исходной capability и условии возврата; это не автоматическое решение или снятие блокера.',
 'source-review':'Историческая/дочерняя карточка сохранена с адресом; её приоритет наследует capability после проверки актуальности, без автоактивации.',
 'launch-v1':'Явно сохранить V1-M0…M7, включая циклы и Fabric-профиль; новый план уточняет поставку, не удаляет scope.',
 'foundation':'Сохранить системную гарантию; активировать требуемый срез по фактическому prerequisite, а не ждать весь слой.'
};
const coLaunch=new Set([16,20,21,23,25,26,43,54,55,59,60,61,62,63,64,74,77,78,79,81,82,83,84,87,91,94,96,97,100,103,104,105,107,108,109,110,111,113,114,115,116,117,118,119,122,123,124,126,127,128,129,132,133,134,135,136,137,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,162,164,165]);
function classify(id){
 if(id.startsWith('V1-'))return 'launch-v1';
 if(id.startsWith('CO-'))return 'carryover';
 if(id.startsWith('BL-'))return 'portfolio-operations';
 if(id.startsWith('CL-'))return 'cost-ledger';
 if(/^S\d+/.test(id))return 'foundation';
 return byId.get(id.split('.')[0])??'source-review';
}
const documents=[],rows=[];
for(const p of paths){
 const bytes=execFileSync('git',['show',`${commit}:${p}`],{maxBuffer:32*1024*1024});
 const s=/\.(md|json|html|ya?ml|mjs|py|txt|css|svg)$/.test(p)?bytes.toString('utf8'):'';
 const lines=s.split('\n');
 const role=p.startsWith('docs/adr/')?'decision':p.startsWith('docs/architecture/')?'architecture':p.startsWith('docs/ux/')?'ux':p==='docs/evidence/backlog.md'?'delivery':p.includes('carryover')?'carryover':p.startsWith('docs/reports/')?'generated-or-report':p.startsWith('docs/audit/')?'historical-audit':p.startsWith('docs/evidence/')?'evidence-or-plan':'guide-or-source';
 documents.push({path:p,role,sha256:hash(bytes),bytes:bytes.length,headings:lines.filter(l=>/^#{1,3} /.test(l)),source:sourceUrl(p),review:'indexed; depth of semantic review is recorded in receipts.json'});
 if(!p.endsWith('.md'))continue;
 if(!(p==='docs/evidence/backlog.md'||p.includes('carryover')||p.startsWith('docs/ux/plans/')||p.startsWith('docs/evidence/plans/')))continue;
 lines.forEach((raw,i)=>{
   if(!raw.startsWith('|'))return;
   const c=cells(raw),first=(c[1]??'').replace(/<[^>]*>/g,'').replaceAll('**','').trim();
   const id=first.match(/^(?:V1-M\d+|M\d+(?:[.][\w-]+)*|S\d+(?:[.][\w-]+)*|CO-\d+|BL-\d+|CL-\d+|T-\d+|P\d+|FA-\d+(?:[.][\w-]+)*|AX-[\w.-]+|UX[\w.-]+|R\d+|REQ-[\w.-]+)(?=\s|$)/)?.[0];
   if(!id)return;
   const group=classify(id);
   rows.push({key:p+':'+(i+1),id,path:p,line:i+1,source:sourceUrl(p,i+1),raw,sha256:hash(raw),cells:c.slice(1,-1).map(x=>x.trim()),group,rationale:reasons[group],launch_review:id.startsWith('CO-')?coLaunch.has(Number(id.slice(3))):['context-work','identity-experience','cycles','foundation','launch-v1','manager-expansion'].includes(group),classification_status:'proposed; original delivery state retained verbatim'});
 });
}
const baselineMilestones=rows.filter(r=>r.path==='docs/evidence/backlog.md'&&/^M\d+$/.test(r.id)&&!r.raw.includes('id="work-'));
const unmapped=baselineMilestones.filter(r=>r.group==='source-review');if(unmapped.length)throw Error('Unmapped milestone '+unmapped.map(r=>r.id));
const specs=JSON.parse(read('docs/architecture/engineering-specs.json'));
const system=JSON.parse(read('docs/architecture/system-model.json'));
const stats={documents:documents.length,source_rows:rows.length,backlog_rows:rows.filter(r=>r.path==='docs/evidence/backlog.md').length,milestones:new Set(baselineMilestones.map(r=>r.id)).size,carryover:rows.filter(r=>r.id.startsWith('CO-')&&r.path.includes('carryover')).length,by_group:{}};
for(const r of rows)stats.by_group[r.group]=(stats.by_group[r.group]??0)+1;
writeFileSync(new URL('inventory.json',import.meta.url),JSON.stringify({schema:1,source_commit:commit,meaning:'Preservation inventory and proposed priority overlay; never an implementation receipt.',stats,documents,rows,engineering:{requirements:specs.requirements,execution_nodes:specs.execution_nodes,dependency_edges:specs.dependency_edges},target_cycles:system.cycles.map(c=>({id:c.id,name:c.name,trigger:c.trigger})),source_models:{system:sourceUrl('docs/architecture/system-model.json'),engineering:sourceUrl('docs/architecture/engineering-specs.json')}},null,2)+'\n');
console.log(JSON.stringify(stats));

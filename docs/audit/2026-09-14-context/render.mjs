// Run from the owning Fabric checkout: node docs/audit/2026-09-14-context/render.mjs
// A derived reader of the audit Markdown, not a second factual source.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const dir=dirname(fileURLToPath(import.meta.url));
const root=resolve(dir,'../../..');
const require=createRequire(resolve(root,'workspace/package.json'));
const {marked}=await import(require.resolve('marked'));
const text=readFileSync(resolve(dir,'README.md'),'utf8');
const keys=['summary','scope','identity','chronology','releases','implementation','visual','wiki','checks','context','board','graph','direction','next','handoff'];
const toc=[];let n=0;
const renderer=new marked.Renderer();
renderer.heading=function(token){const body=this.parser.parseInline(token.tokens);const id=token.depth===2?keys[n++]:'title';if(token.depth===2)toc.push({id,text:token.text});return `<h${token.depth} id="${id}">${body}</h${token.depth}>`;};
const signature=readFileSync(resolve(dir,'skills.md'),'utf8').split('\n').find(line=>line.startsWith('**Made with'));
const body=marked.parse(text,{renderer})+marked.parse(signature);
if(n!==keys.length)throw new Error('Update section keys after changing headings');
const tokens=readFileSync(resolve(root,'apps/desktop/src/renderer/src/tokens.paperclip.css'),'utf8')+readFileSync(resolve(root,'apps/desktop/src/renderer/src/tokens.app.css'),'utf8');
const css=`*{box-sizing:border-box}html{scroll-behavior:auto}body{margin:0;background:var(--app-bg);color:var(--app-ink);font-family:var(--font-body),sans-serif;font-size:var(--fs-body);line-height:1.65}a{color:var(--app-ink);text-decoration:underline;text-underline-offset:.2em}header{padding:var(--space-5);border-bottom:1px solid var(--app-line);display:flex;gap:var(--space-5);justify-content:space-between}main{display:grid;grid-template-columns:16rem minmax(0,65rem);gap:var(--space-6);padding:var(--space-6);max-width:95rem;margin:auto}nav{position:sticky;top:var(--space-5);height:fit-content;max-height:90vh;overflow:auto;font-size:var(--app-fs-caption)}nav a{display:block;padding:var(--space-2);text-decoration:none}article{min-width:0}h1{font-size:var(--fs-h2);line-height:1.1}h2{font-size:var(--fs-h3);margin-top:var(--space-xl);padding-top:var(--space-5);border-top:1px solid var(--app-line);scroll-margin-top:var(--space-5)}p,li{max-width:85ch}table{border-collapse:collapse;width:100%;font-size:var(--app-fs-body);display:block;overflow:auto}td,th{border:1px solid var(--app-line);padding:var(--space-3);vertical-align:top;text-align:left}th{background:var(--app-panel)}code{font-family:var(--font-mono),monospace;font-size:.85em;overflow-wrap:anywhere}strong{font-weight:650}sub{color:var(--app-muted)}button{background:var(--app-panel);border:1px solid var(--app-line-strong);color:var(--app-ink);padding:var(--space-2) var(--space-4);cursor:pointer}li{margin-block:var(--space-2)}@media(max-width:900px){main{display:block;padding:var(--space-4)}nav{position:static;max-height:none;display:flex;gap:var(--space-2);flex-wrap:wrap}nav a{border:1px solid var(--app-line)}h1{font-size:var(--fs-h3)}}@media print{header,nav{display:none}main{display:block}body{background:white;color:black}a{color:black}h2{break-after:avoid}table{display:table}}`;
const html=`<!doctype html><html lang="ru" data-theme="light"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fabric — контекст, решения и следующий шаг · аудит 14.09.2026</title><style>${tokens}\n${css}</style><header><a href="../../../reports/map.html#iteration-2026-09-14-context-audit">Карта проекта</a><a href="plan.md">Пакеты P01–P12</a><button id="theme" type="button">Тема</button></header><main><nav aria-label="Разделы аудита">${toc.map(x=>`<a href="#${x.id}">${x.text}</a>`).join('')}</nav><article>${body}</article></main><script>document.getElementById('theme').onclick=()=>document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';</script></html>`;
// From docs/audit/date to docs/reports is ../../reports.
writeFileSync(resolve(dir,'index.html'),html.replace('href="../../../reports/','href="../../reports/'));
console.log('Rendered audit reader with '+toc.length+' sections');

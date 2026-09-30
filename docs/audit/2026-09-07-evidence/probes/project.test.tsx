import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
vi.mock('apps/desktop/src/renderer/src/Tasks.tsx',()=>({Tasks:()=>null}))
vi.mock('apps/desktop/src/renderer/src/TaskPage.tsx',()=>({TaskPage:()=>null}))
vi.mock('apps/desktop/src/renderer/src/PlanSection.tsx',()=>({PlanSection:()=>null}))
vi.mock('apps/desktop/src/renderer/src/DecisionsSection.tsx',()=>({DecisionsSection:()=>null}))
vi.mock('apps/desktop/src/renderer/src/HarnessSection.tsx',()=>({HarnessSection:()=>null}))
vi.mock('apps/desktop/src/renderer/src/MemoryOverviewSection.tsx',()=>({MemoryOverviewSection:()=>null}))
vi.mock('apps/desktop/src/renderer/src/DigestSection.tsx',()=>({DigestSection:()=>null}))
import { ProjectHome } from 'apps/desktop/src/renderer/src/ProjectHome.tsx'
import { I18nProvider } from 'apps/desktop/src/renderer/src/i18n/index.tsx'
import { en } from 'apps/desktop/src/renderer/src/i18n/en.ts'
it('records missing empty-board idea door, duplicate runner labels and nested live-session controls',async()=>{
 ;(window as any).fabric={
  repos:{list:async()=>[]},projects:{stats:async()=>null,repoStates:async()=>[],onRepoChanged:()=>()=>{}},
  terminal:{claims:async()=>[],options:async()=>[{id:'claude-code',available:true,label:'Claude Code'},{id:'codex',available:true,label:'Codex'},{id:'shell',available:true,label:'Terminal'}]},
  transcripts:{list:async()=>[]},tasks:{list:async()=>[]},quota:{read:async()=>null},
  gateway:{offer:async()=>({reachable:false,servers:[]})},agents:{list:async()=>[]},memory:{search:async()=>[]}
 }
 const project={id:'p1',name:'Audit project',purpose:null,repo_path:null,config_revision:1,default_agent:'claude-code',mcp_servers:[]}
 const session={sessionId:'s1',projectId:'p1',optionId:'codex',running:true,state:'running',tail:'hello',lastActivityAt:new Date().toISOString(),startedAt:new Date().toISOString(),exitCode:null}
 render(<I18nProvider locale="en"><ProjectHome project={project as any} sessions={[session] as any} feed={[]} feedMark={0} onChanged={()=>{}} onSessionsChanged={()=>{}} onOpenWorkspace={()=>{}} onError={()=>{}}/></I18nProvider>)
 await screen.findByText(en['board.empty'])
 expect(screen.queryByLabelText(en['board.ideaLabel'])).toBeNull()
 const choices=[...document.querySelectorAll('#sec-agents select option')].map(e=>({value:e.getAttribute('value'),text:e.textContent}))
 expect(choices.find(e=>e.value==='codex')?.text).toBe(en['agents.terminal'])
 expect(document.querySelectorAll('button button').length).toBeGreaterThan(0)
 console.log('AUDIT PROJECT PROOF:',JSON.stringify({emptyBoardIdeaInput:!!screen.queryByLabelText(en['board.ideaLabel']),choices,nestedButtons:document.querySelectorAll('button button').length}))
})

import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
const state=vi.hoisted(()=>({editors:[] as any[]}))
vi.mock('monaco-editor',()=>({
 KeyMod:{CtrlCmd:1},KeyCode:{KeyS:2},
 editor:{defineTheme(){},create(_host:any,opts:any){
  const ed={value:opts.value, getValue(){return this.value}, addCommand(){},focus(){},dispose(){},
   onDidChangeModelContent(cb:any){this.change=cb;return {dispose(){}}},change:()=>{}}
  state.editors.push(ed);return ed
 }}
}))
vi.mock('monaco-editor/editor/editor.worker?worker',()=>({default:class {}}))
vi.mock('monaco-editor/language/json/json.worker?worker',()=>({default:class {}}))
vi.mock('monaco-editor/language/css/css.worker?worker',()=>({default:class {}}))
vi.mock('monaco-editor/language/html/html.worker?worker',()=>({default:class {}}))
vi.mock('monaco-editor/language/typescript/ts.worker?worker',()=>({default:class {}}))
import { EditorWindow } from 'apps/desktop/src/renderer/src/EditorWindow.tsx'
import { I18nProvider } from 'apps/desktop/src/renderer/src/i18n/index.tsx'
it('captures current component losing newer keystrokes after save even though afterSave marks dirty',async()=>{
 let release!:(v:any)=>void
 ;(window as any).fabric={files:{
  read:async()=>({path:'/audit/example.ts',name:'example.ts',content:'a',hash:'h1',language:'typescript'}),
  write:()=>new Promise(resolve=>{release=resolve})
 }}
 render(<I18nProvider locale="en"><EditorWindow filePath="/audit/example.ts"/></I18nProvider>)
 await waitFor(()=>expect(state.editors.length).toBe(1))
 act(()=>{state.editors[0].value='ab';state.editors[0].change()})
 fireEvent.click(screen.getByRole('button',{name:'Save',exact:true}))
 act(()=>{state.editors[0].value='abc';state.editors[0].change()})
 await act(async()=>{release({ok:true,hash:'h2'})})
 console.log('AUDIT EDITOR PROOF: typed while saving=abc; editor recreated with=',state.editors.at(-1).value,'; number of instances=',state.editors.length)
 expect(state.editors.length).toBe(2)
 expect(state.editors.at(-1).value).toBe('ab')
})

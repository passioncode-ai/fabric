import React from 'react'
import { render, screen } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
vi.mock('apps/desktop/src/renderer/src/EditorWindow.tsx',()=>({EditorWindow:()=>null}))
vi.mock('apps/desktop/src/renderer/src/SessionWindow.tsx',()=>({SessionWindow:()=>null}))
vi.mock('apps/desktop/src/renderer/src/EstateHome.tsx',()=>({EstateHome:()=>null}))
import { App } from 'apps/desktop/src/renderer/src/App.tsx'
class Boundary extends React.Component<React.PropsWithChildren, {error:string|null}> {
 state={error:null as string|null}; static getDerivedStateFromError(error:Error){return {error:error.message}}
 render(){return this.state.error ? <div data-testid="error">{this.state.error}</div> : this.props.children}
}
it('captures actual Shell boot failure after successful mocked read-only IPC',async()=>{
 Object.defineProperty(window,'matchMedia',{value:()=>({matches:false,addEventListener(){},removeEventListener(){}})})
 ;(window as any).fabric={
  settings:{read:async()=>({theme:'dark',locale:'en',keepAwake:'never'})},
  meta:{info:async()=>({estateName:'Audit fixture',sessionId:null,filePath:null})},
  projects:{list:async()=>[]},terminal:{list:async()=>[]},
  feed:{replay:async()=>[]}, quota:{read:async()=>null},
  tabs:{read:async()=>null,write:async()=>{},onCloseActive:()=>()=>{}}
 }
 render(<Boundary><App/></Boundary>)
 const error=await screen.findByTestId('error')
 console.log('AUDIT PROOF:',error.textContent)
 expect(error.textContent).toContain('Rendered more hooks than during the previous render')
})

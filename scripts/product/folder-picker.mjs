// Target mockup only: no filesystem reads, uploads or native permission claims.
// Desktop contract: replace this fixture dialog with the host's directory chooser;
// return a selected directory reference or cancellation, never a guessed typed path.
// Multiple controls add one selected folder at a time and allow removal.
export const folderPickerFixtures = Object.freeze([
  Object.freeze({path:'/Projects',label:'Projects',parent:null}),
  Object.freeze({path:'/Projects/atlas',label:'atlas',parent:'/Projects'}),
  Object.freeze({path:'/Projects/orbit',label:'orbit',parent:'/Projects'}),
  Object.freeze({path:'/Projects/empty',label:'empty',parent:'/Projects'}),
  Object.freeze({path:'/Data',label:'Data',parent:null}),
  Object.freeze({path:'/Data/Website',label:'Website',parent:'/Data'}),
  Object.freeze({path:'/Data/Notes',label:'Notes',parent:'/Data'})
])
export function folderPickerState(value='') {
  return {original:String(value||''),selected:'',open:true}
}
export function selectFolderPicker(state,path) {
  return state.open && folderPickerFixtures.some(x=>x.path===path)
    ? {...state,selected:path} : state
}
export function finishFolderPicker(state,accept=false) {
  if(!state.open)return {state,path:null,accepted:false}
  const accepted=accept && folderPickerFixtures.some(x=>x.path===state.selected)
  if(accept&&!accepted)return {state,path:null,accepted:false}
  return {state:{...state,open:false},path:accepted?state.selected:state.original,accepted}
}
function folderPickerEscape(value) {
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
}
export function folderPickerControl({id,label='Папка проекта',value='',attribute='',multiple=false}) {
  const safe=folderPickerEscape
  // attribute is trusted renderer-owned markup, never user input. It belongs on
  // the hidden field so existing form extraction and field handlers retain it.
  return `<div class="field folder-picker-control" data-folder-control="${safe(id)}"><span id="${safe(id)}-label">${safe(label)}</span><output id="${safe(id)}-value" aria-labelledby="${safe(id)}-label">${safe(value||'Папка не выбрана')}</output><input data-folder-multiple="${multiple?'true':'false'}" type="hidden" name="${safe(id)}" value="${safe(value)}" ${attribute}>${multiple?`<div data-folder-selected>${String(value).split(',').map(x=>x.trim()).filter(Boolean).map(path=>`<button type="button" class="button" data-folder-remove="${safe(path)}">Убрать ${safe(path)}</button>`).join('')}</div>`:''}<button class="button" type="button" data-folder-picker="${safe(id)}" aria-labelledby="${safe(id)}-choose ${safe(id)}-label" aria-describedby="${safe(id)}-value" data-multiple="${multiple?'true':'false'}"><span id="${safe(id)}-choose">${multiple?'Добавить папку':value?'Изменить папку':'Выбрать папку'}</span></button></div>`
}
export function attachFolderPickers(root,{onPick=()=>{}}={}) {
  let active=null
  const doc=root.ownerDocument||globalThis.document
  const refreshSelected=control=>{
    const input=control?.querySelector('input[type="hidden"]'),list=control?.querySelector('[data-folder-selected]')
    if(list)list.innerHTML=String(input?.value||'').split(',').map(x=>x.trim()).filter(Boolean).map(path=>`<button type="button" class="button" data-folder-remove="${folderPickerEscape(path)}">Убрать ${folderPickerEscape(path)}</button>`).join('')
  }
  const open=e=>{
    const remove=e.target.closest?.('[data-folder-remove]')
    if(remove&&root.contains(remove)){
      const control=remove.closest('[data-folder-control]'),input=control.querySelector('input[type="hidden"]')
      input.value=input.value.split(',').map(x=>x.trim()).filter(x=>x!==remove.dataset.folderRemove).join(', ')
      control.querySelector('output').textContent=input.value||'Папка не выбрана'
      refreshSelected(control);onPick(control.dataset.folderControl,input.value,control.querySelector('[data-folder-picker]'));control.querySelector('[data-folder-picker]')?.focus();return
    }
    const button=e.target.closest?.('[data-folder-picker]')
    if(!button||!root.contains(button)||active||button.disabled)return
    e.preventDefault()
    const control=button.closest('[data-folder-control]'),input=control?.querySelector('input[type="hidden"]')
    let state=folderPickerState(input?.value)
    const dialog=doc.createElement('dialog')
    dialog.className='folder-picker-dialog panel'
    dialog.setAttribute('aria-label','Выбрать папку — демонстрация')

    dialog.innerHTML=`<h2>Выбрать папку</h2><p class="meta">Демонстрация системного выбора папки. Показаны примеры; файлы компьютера не читаются и не отправляются.</p><div class="folder-picker-tree" role="group" aria-label="Папки примера">${folderPickerFixtures.map(x=>`<button type="button" class="button" data-folder-option="${folderPickerEscape(x.path)}" aria-pressed="false">▱ ${folderPickerEscape(x.label)}</button>`).join('')}</div><p data-folder-status role="status">Выберите одну папку</p><div class="actions"><button type="button" class="button" data-folder-cancel>Отмена</button><button type="button" class="button primary" data-folder-confirm disabled>Выбрать папку</button></div>`
    const close=accept=>{
      const result=finishFolderPicker(state,accept)
      if(result.state.open)return
      state=result.state
      dialog.close?.();dialog.remove();active=null
      if(button.isConnected)button.focus()
      if(result.accepted){
        if(input)input.value=input.dataset.folderMultiple==='true'?[...new Set([...state.original.split(',').map(x=>x.trim()).filter(Boolean),result.path])].join(', '):result.path
        const output=control?.querySelector('output')
        if(output)output.textContent=input?.value||result.path
        const label=button.querySelector('span')
        if(label)label.textContent=input?.dataset.folderMultiple==='true'?'Добавить папку':'Изменить папку'
        refreshSelected(control)
        onPick(button.dataset.folderPicker,result.path,button)
        // The owner may synchronously render the new selection. Restore focus to
        // that replacement control, rather than leaving it on a removed node.
        const replacement=[...root.querySelectorAll('[data-folder-picker]')].find(x=>x.dataset.folderPicker===button.dataset.folderPicker)
        replacement?.focus()
      }
    }
    active={cancel:()=>close(false)}
    dialog.addEventListener('cancel',ev=>{ev.preventDefault();close(false)})
    dialog.addEventListener('keydown',ev=>{
      if(ev.key==='Escape'){ev.preventDefault();close(false);return}
      if(ev.key==='Tab'){
        const items=[...dialog.querySelectorAll('button:not(:disabled)')],first=items[0],last=items.at(-1)
        if(ev.shiftKey&&(doc.activeElement===first||!dialog.contains(doc.activeElement))){ev.preventDefault();last?.focus()}
        else if(!ev.shiftKey&&(doc.activeElement===last||!dialog.contains(doc.activeElement))){ev.preventDefault();first?.focus()}
      }
    })
    dialog.addEventListener('click',ev=>{
      const option=ev.target.closest?.('[data-folder-option]')
      if(option){
        state=selectFolderPicker(state,option.dataset.folderOption)
        for(const item of dialog.querySelectorAll('[data-folder-option]'))item.setAttribute('aria-pressed',String(item===option))
        dialog.querySelector('[data-folder-status]').textContent='Выбрано: '+state.selected
        dialog.querySelector('[data-folder-confirm]').disabled=!state.selected
      }
      if(ev.target.closest?.('[data-folder-cancel]'))close(false)
      if(ev.target.closest?.('[data-folder-confirm]'))close(true)
    })
    doc.body.append(dialog)
    if(typeof dialog.showModal==='function')dialog.showModal()
    else {dialog.setAttribute('open','');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true')}
    dialog.querySelector('[data-folder-option]')?.focus()
  }
  root.addEventListener('click',open)
  return ()=>{active?.cancel();root.removeEventListener('click',open)}
}

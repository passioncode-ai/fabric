import test from 'node:test'
import assert from 'node:assert/strict'
import {folderPickerControl,folderPickerFixtures,folderPickerState,selectFolderPicker,finishFolderPicker} from '../product/folder-picker.mjs'

test('directory control is noneditable, labelled, and compatible with form extraction',()=>{
  const html=folderPickerControl({id:'settings-repo',label:'Папка',value:'/Data/Website',attribute:'data-setting="repo"'})
  assert.match(html,/<output[^>]*aria-labelledby="settings-repo-label">\/Data\/Website<\/output>/)
  assert.match(html,/<input[^>]*type="hidden" name="settings-repo" value="\/Data\/Website" data-setting="repo">/)
  assert.match(html,/type="button" data-folder-picker="settings-repo"/)
  assert.doesNotMatch(html,/type="text"|contenteditable|textarea/)
})
test('rendered values and labels cannot inject markup',()=>{
  const html=folderPickerControl({id:'x"',label:'<script>',value:'<img src=x onerror=x>'})
  assert(!html.includes('<script>'));assert(!html.includes('<img'));assert.match(html,/&lt;img/)
})
test('selection never changes existing folder before confirmation; cancel retains exact original',()=>{
  const original=folderPickerState('/old/custom project')
  const pending=selectFolderPicker(original,'/Projects/atlas')
  assert.equal(original.selected,'');assert.equal(pending.original,'/old/custom project')
  assert.deepEqual(finishFolderPicker(pending,false),{state:{...pending,open:false},path:'/old/custom project',accepted:false})
})
test('empty confirmation stays open; only fixture paths are eligible',()=>{
  const state=folderPickerState()
  assert.equal(selectFolderPicker(state,'/etc'),state)
  assert.equal(finishFolderPicker(state,true).state,state)
  assert.equal(finishFolderPicker(state,true).accepted,false)
  assert(folderPickerFixtures.some(x=>x.path==='/Projects/empty'))
})
test('confirmation yields exactly one chosen folder and cannot be replayed',()=>{
  const chosen=selectFolderPicker(selectFolderPicker(folderPickerState('/Data'),'/Projects/atlas'),'/Projects/orbit')
  const result=finishFolderPicker(chosen,true)
  assert.equal(result.path,'/Projects/orbit');assert.equal(result.accepted,true)
  assert.equal(finishFolderPicker(result.state,true).accepted,false)
  assert.equal(selectFolderPicker(result.state,'/Data'),result.state)
})
test('two pickers have independent pending and committed selections',()=>{
  const a=selectFolderPicker(folderPickerState('/a'),'/Projects/atlas'),b=selectFolderPicker(folderPickerState('/b'),'/Data/Notes')
  assert.equal(finishFolderPicker(a,false).path,'/a')
  assert.equal(finishFolderPicker(b,true).path,'/Data/Notes')
})

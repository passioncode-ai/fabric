import {createProviderAccountsFixture, renderProviderAccounts, attachProviderAccountInteractions} from './provider-fixture-at-8a0e9db.mjs';
const results={source:'8a0e9dbc17ac251e543b26653f64540a24ff0a8a',scope:'pure generated-report fixture; no browser, auth, native, IPC or network'};
{
 const a=createProviderAccountsFixture();a.accounts=a.accounts.filter(x=>x.id!=='b');
 const html=renderProviderAccounts('account-switch',{project:'atlas',state:'ready',providerAccounts:a});
 results.noCandidate={eligibleTargetCount:0,target:a.selected,emptySelect:html.includes('<select name="pa-target"></select>'),prepareButtonOffered:html.includes('data-accounts-action="prepare"')};
}
function harness(){
 const a=createProviderAccountsFixture(),s={project:'atlas',state:'busy',providerAccounts:a},listeners={};
 const root={dataset:{},addEventListener:(n,fn)=>listeners[n]=fn};
 attachProviderAccountInteractions(root,{state:s,rerender:()=>{}});
 const click=(action,id='')=>listeners.click({target:{closest:()=>({disabled:false,dataset:{accountsAction:action,accountId:id}})}});
 return {a,s,click};
}

{
 const {a,click}=harness();click('auto-enable');click('auto-tick');click('auto-unknown');
 const before={account:a.conversation.account,queued:a.auto.queued,reason:a.auto.reason};click('boundary');
 results.unknownAfterQueued={before,after:{account:a.conversation.account,run:a.conversation.run,queued:a.auto.queued}};
}
{
 const {a,s,click}=harness();click('auto-enable');click('auto-tick');s.state='ready';click('remove','b');click('remove-confirm','b');
 renderProviderAccounts('account-switch',s);const before={accounts:a.accounts.map(x=>x.id),selected:a.selected,queued:a.auto.queued,phase:a.phase};click('boundary');
 results.deletedQueuedTarget={before,after:{account:a.conversation.account,run:a.conversation.run}};
}
console.log(JSON.stringify(results,null,2));

# #region com-design-race-model — docs: docs/reports/2026-10-04-project-communication-architecture/README.md#method-evidence-and-limits
"""Executable design counterexamples, not production/database/provider tests.
Run: python3 race_model.py [--mutant generation|attempt|expiry|epoch|unknown]
Mutants remove one proposed guard. Their assertion failures are expected evidence.
"""
from dataclasses import dataclass, field
import argparse, json, sys
@dataclass
class Model:
    mutant:str=''
    now:int=0
    generation:int=1
    attempt:int=1
    until:int=60
    phase:str='queued'
    effects:int=0
    epoch_floor:int=0
    epoch:int=1
    capacity:int=2
    receipts:dict=field(default_factory=dict)
    retired:bool=False
    def fenced(self,g,a):
        return (not self.retired and (self.mutant=='generation' or g==self.generation)
                and (self.mutant=='attempt' or a==self.attempt)
                and (self.mutant=='expiry' or self.now<self.until))
    def begin(self,g,a):
        if not self.fenced(g,a) or self.phase not in ('queued','claimed'):return False
        self.phase='started';self.effects+=1;return True
    def replace(self):
        self.generation+=1
        if self.phase in ('queued','claimed'):self.attempt+=1;self.until=self.now+60
        else:self.phase='unknown' # no effect reissue, even with a new owner
    def reclaim(self):
        if self.phase not in ('queued','claimed'):return False
        self.attempt+=1;self.until=self.now+60;return True
    def complete(self,g,a):
        if not self.fenced(g,a) or self.phase!='started':return False
        self.phase='completed';return True
    def submit(self,e,key,digest):
        if self.mutant!='epoch' and e<=self.epoch_floor:return 'reconcile_required'
        ident=(e,key)
        if ident in self.receipts:return 'replay' if self.receipts[ident][0]==digest else 'conflict'
        if len(self.receipts)>=self.capacity:return 'capacity'
        self.receipts[ident]=(digest,'accepted');return 'accepted'
    def expire(self):
        if self.mutant=='unknown':self.receipts.clear()
        else:self.receipts={k:v for k,v in self.receipts.items() if k[0]>self.epoch_floor or v[1]=='unknown'}
    def cancel(self):
        self.phase='cancelled' if self.phase in ('queued','claimed') else 'unknown'
        self.attempt+=1

def run(mutant):
    checks=[]
    def check(name,fn):
        try:fn();checks.append({'case':name,'passed':True})
        except AssertionError as e:checks.append({'case':name,'passed':False,'assertion':str(e)})
    def replacement():
        m=Model(mutant);g,a=m.generation,m.attempt;m.generation+=1
        assert not m.begin(g,a),'superseded generation must not start';assert m.effects==0
    check('generation CAS fences delayed former owner',replacement)
    def same_generation():
        m=Model(mutant);a=m.attempt;m.reclaim()
        assert not m.begin(m.generation,a),'old attempt must not start after same-generation reclaim'
    check('claim UUID fences same-generation reclaim',same_generation)
    def db_clock():
        m=Model(mutant);m.now=61
        assert not m.begin(1,1),'expired DB lease must refuse regardless of client clock'
    check('DB clock expiry fences delayed dispatch',db_clock)
    def completion():
        m=Model(mutant);assert m.begin(1,1);m.generation+=1
        assert not m.complete(1,1),'lost generation must not commit completion'
    check('former worker resumed through completion is refused',completion)
    def begun_replace():
        m=Model(mutant);assert m.begin(1,1);m.replace()
        assert m.phase=='unknown';assert not m.reclaim();assert not m.begin(m.generation,m.attempt);assert m.effects==1
    check('replacement cannot reissue an already begun effect',begun_replace)
    def cancellation():
        m=Model(mutant);m.cancel();assert not m.begin(1,1);assert m.effects==0
        n=Model(mutant);assert n.begin(1,1);n.cancel();assert n.phase=='unknown';assert not n.reclaim()
    check('cancel before/after begin preserves distinct effect facts',cancellation)
    def idempotency():
        m=Model(mutant);assert m.submit(1,'key','A')=='accepted';m.replace()
        assert m.submit(1,'key','A')=='replay';assert m.submit(1,'key','B')=='conflict';assert len(m.receipts)==1
    check('lost receipt and provider replacement replay one logical command',idempotency)
    def retired_epoch():
        m=Model(mutant);m.submit(1,'key','A');m.epoch_floor=1;m.receipts.clear()
        assert m.submit(1,'key','A')=='reconcile_required','pruned retired epoch must not become a fresh command'
    check('retired namespace floor prevents resend after compaction',retired_epoch)
    def unknown():
        m=Model(mutant);m.submit(1,'key','A');m.receipts[(1,'key')]=('A','unknown');m.now=864000;m.expire()
        assert m.submit(1,'key','A')=='replay','unknown fact must survive expiry'
        assert m.submit(1,'new','N')=='accepted';assert m.submit(1,'third','T')=='capacity'
    check('unknown retained across time and fresh-key pressure',unknown)
    def restored():
        m=Model(mutant);m.retired=True;m.phase='queued'
        assert not m.begin(1,1);assert m.effects==0
    check('restored historical consumer never grants live dispatch',restored)
    # Projection/state distinctions are pure set/range checks, not an RLS proof.
    def privacy():
        messages=[('A',{'A','B'}),('secret',{'C','D'}),('reply',{'A','B'})]
        feed=[(i+1,body) for i,body in enumerate(body for body,ps in messages if 'A' in ps)]
        assert feed==[(1,'A'),(2,'reply')];last=1
        assert [body for seq,body in feed if seq>last]==['reply']
    check('participant feed is dense and omits foreign metadata',privacy)
    def read_states():
        state={'fetched':True,'read':False,'accepted':False,'completed':False,'telegram_confirmed':False}
        assert sum(state.values())==1
    check('fetch is not read ACK/agent acceptance/effect completion',read_states)
    return {'model_only':True,'mutant':mutant or 'none','passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'cases':checks}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--mutant',default='',choices=['','generation','attempt','expiry','epoch','unknown']);a=p.parse_args()
    result=run(a.mutant);print(json.dumps(result,indent=2));sys.exit(1 if result['failed'] else 0)

# #endregion com-design-race-model

#!/usr/bin/env python3
# Deterministic assignment of every inventory item to a canvas node and a wave (release-040 plan).
import json, re, sys
src, out = sys.argv[1], sys.argv[2]
b = json.load(open(src))
W = {
 'W1': ['AR-3.1','AR-3.2','AR-3.4','CO-090','CO-091','CO-199','CO-200','CO-201','CO-242','CO-238'],
 'W2': ['CO-194','CO-229','CO-236','CO-233','CO-176','CO-244','AS-03','AS-06','COM-04','COM-05','CO-220','CO-136','CO-185','CO-221','CO-222','AS-08','P-10'],
 'W3': ['CO-177','CO-180','CO-219','CO-235','CO-186','N1','AS-13'],
 'W4': ['AR-2','AR-5','AR-7','AR-11','M18','M37','CO-188','CO-099','CO-103','CO-123','CO-063','CO-064','CO-227','SCN-009','SCN-056','SCN-068','SCN-075','SCN-112','SCN-113','SCN-114','SCN-121','SCN-122','SCN-123','AX13-REQ-007'],
 'W5': ['P-13','CO-168','M126','AR-4','SCN-110','SCN-111','M153','M157','M158','M166','M175','M183','M184','M194','P-07','P-06','COM-02','COM-03','AR-3.8','CO-212'],
 'W6': ['CO-179','CO-225','CO-231','CO-149','L3c','CO-144','CO-146','CO-111','CO-145','CO-215','CO-216','CO-232','CO-239','CO-240'],
 'W7': ['P-12','CO-246','CO-245','W1','W2','W3','W4','W5'],
}
NODE_BY_AREA = {'harness/hub':'C1','sessions/runners':'C1','onboarding/start':'C5','agents/registry':'C6','workflows/routines/chains':'C7',
  'board/communications':'C8','screens/ux':'C10','i18n':'C10','release/platform':'C11','memory/context':'C8','security':'C1','data/schema':'C2',
  'docs/process':'C12','other':'C12'}
def wave_of(i):
    iid = i['id']
    for w, ids in W.items():
        for x in ids:
            if iid == x or iid.startswith(x + '.') or iid.startswith(x + '-') and not x.startswith('CO-') and not x.startswith('SCN-'):
                return w
    notes = (i.get('notes') or '') + ' ' + (i.get('closableInOnePass') or '')
    if re.search(r'STALE|already (done|shipped)|close by|moot|shipped', notes, re.I) and i.get('closableInOnePass','').startswith('yes'):
        return 'W0'
    return None
def tags(i):
    c = i.get('dupCluster') or []
    return [c] if isinstance(c, str) else list(c)
direct = {i['id']: wave_of(i) for i in b}
cluster_wave = {}
for i in b:
    if direct[i['id']] and direct[i['id']] != 'W0':
        for t in tags(i): cluster_wave.setdefault(t, direct[i['id']])
for i in b:
    w = direct[i['id']] or next((cluster_wave[t] for t in tags(i) if t in cluster_wave), None)
    i['node'] = NODE_BY_AREA.get(i['area'], 'C12')
    if w: i['wave'] = w; i['release'] = '0.4.0'
    elif i.get('closableInOnePass','').startswith('yes'): i['wave'] = 'W6' if i['node']=='C10' else 'W0'; i['release'] = '0.4.0'
    else: i['wave'] = 'after-0.4.0'; i['release'] = 'program'
json.dump(b, open(out,'w'), indent=1, ensure_ascii=False)
from collections import Counter
print(Counter(i['wave'] for i in b)); print(Counter((i['release'], i['node']) for i in b).most_common(30))

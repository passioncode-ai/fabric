// Read-only reproduction of scripts/sync-product-ux.mjs sections() boundary.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const raw=readFileSync(new URL('../../../ux/screens.md',import.meta.url),'utf8');
const matches=[...raw.matchAll(/^### (SCR-\d+): (.+)$/gm)];
const i=matches.findIndex(x=>x[1]==='SCR-63');
const actualBody=raw.slice(matches[i].index,matches[i+1]?.index??raw.length);
const usedByParser=[...new Set(actualBody.match(/SCN-\d+/g)||[])];
console.log('SCR-63 parser body references:',usedByParser.join(', '));
assert.equal(usedByParser.includes('SCN-031'),false,'SCR-63 must not inherit SCN-031 from the general onboarding appendix');

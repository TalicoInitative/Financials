import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import {FIXTURE} from './fixture.mjs';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(readFileSync('./public/index.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,doc=w.document;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(420);
w.eval(FIXTURE);
await sleep(60);
const checks=[];const ck=(n,ok)=>checks.push({n,ok});
w.location.hash='#/ledger';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(40);
const s=doc.getElementById('ledgerSearch');
s.focus(); s.value='Eli'; s.setSelectionRange(3,3);
s.dispatchEvent(new w.Event('input',{bubbles:true}));
await sleep(400); // debounce fires + full re-render
const s2=doc.getElementById('ledgerSearch');
ck('search box still focused after re-render', doc.activeElement===s2);
ck('caret position preserved', s2.selectionStart===3);
ck('filter actually applied (only Eli row)', doc.getElementById('page').textContent.includes('Eli') && !doc.getElementById('page').textContent.includes('Anthropic / Claude'));
// save-failure detection: break storage, then edit
w.eval('Object.defineProperty(Storage.prototype,"setItem",{value:function(){throw new Error("QuotaExceededError");},configurable:true});');
w.location.hash='#/milestones';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(40);
const done=[...doc.querySelectorAll('#page button')].find(b=>b.textContent.includes('Mark complete'));
done.click(); await sleep(600);
ck('save failure surfaces a visible warning', doc.getElementById('snack').textContent.includes('SAVE FAILED'));
ck('warning offers an emergency export', doc.getElementById('snack').textContent.includes('Export now'));
let pass=0;for(const c of checks){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n);}
console.log('\n'+pass+' / '+checks.length+' checks; errors: '+errs.length);
process.exit(0);

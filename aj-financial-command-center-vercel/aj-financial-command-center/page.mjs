import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import {FIXTURE} from './fixture.mjs';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(readFileSync('./public/index.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,doc=w.document;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(420);
w.eval(FIXTURE);
await sleep(60);
const E=x=>w.eval(x);const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});
const nav=async r=>{w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));if(r==='ledger')w.eval('UI.ledgerView="table";render()');await sleep(60);};
const btn=t=>[...doc.querySelectorAll('#page button')].find(b=>b.textContent.trim().includes(t));
const txt=()=>doc.getElementById('page').textContent;

// small ledger: NO pager at all (seed has 5 rows)
await nav('ledger');
ck('no pager on a small ledger', !txt().includes('Rows per page'));
ck('all 5 seed rows visible', doc.querySelectorAll('#page tbody tr').length>=5, doc.querySelectorAll('#page tbody tr').length);

// grow past a page
E(`update(s=>{for(let i=0;i<450;i++){const d=new Date(Date.UTC(2026,6,1+(i%25)));const iso=d.toISOString().slice(0,10);
 s.transactions.push(blankTx({date:iso,reportingMonth:"2026-07",type:"business_income",status:"received",sourceName:"Bulk",description:"b"+i,categoryId:"Placement revenue",originalAmountCents:10000,convertedCadAmountCents:10000,recognitionClass:"earned_income",accountId:"acct-primary"}));}},"bulk")`);
await nav('ledger');
ck('pager appears past 200 rows', txt().includes('Rows per page'));
ck('exactly 200 rows rendered', doc.querySelectorAll('#page tbody tr').length===200, doc.querySelectorAll('#page tbody tr').length);
ck('shows the true total (455)', txt().includes('of 456 rows'), txt().match(/of \d+ rows/));
const total=E('(()=>{const c=S.transactions.filter(isCounted);return c.reduce((s,t)=>s+netImpactCents(t),0);})()');
ck('footer totals cover the WHOLE filter, not the page', txt().includes(E(`fm(${total}).replace("C$","")`)), E(`fm(${total})`));
btn('Next').click(); await sleep(60);
ck('Next page advances', txt().includes('Showing 201'), txt().match(/Showing[^,]{0,24}/));
ck('page 2 also renders 200', doc.querySelectorAll('#page tbody tr').length===200);
btn('Last').click(); await sleep(60);
ck('Last page shows the remainder (56)', doc.querySelectorAll('#page tbody tr').length===56, doc.querySelectorAll('#page tbody tr').length);
// filtering must reset to page 1
const s=doc.getElementById('ledgerSearch'); s.value='Eli'; s.dispatchEvent(new w.Event('input',{bubbles:true}));
await sleep(400);
ck('filtering resets to page 1 (no empty page)', doc.querySelectorAll('#page tbody tr').length>=1, doc.querySelectorAll('#page tbody tr').length);
ck('filtered result is correct', txt().includes('Eli'));
s.value=''; s.dispatchEvent(new w.Event('input',{bubbles:true})); await sleep(400);
// running balance still correct on page 1
ck('running balance column present on page 1', txt().includes('Running balance'));
// grouping still works with paging
E('UI.ledger.group=true'); await nav('ledger');
ck('month grouping still works with pagination', txt().includes('subtotal'));
E('UI.ledger.group=false');
// other log views paginate too
await nav('income');
ck('income log paginates', doc.querySelectorAll('#page tbody tr').length<=200);
ck('no runtime errors with pagination', errs.length===0, errs[0]);
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' pagination checks; runtime errors: '+errs.length);
process.exit(0);

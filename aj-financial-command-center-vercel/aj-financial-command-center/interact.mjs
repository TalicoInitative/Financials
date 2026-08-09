import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {FIXTURE} from './fixture.mjs';
const html = readFileSync('/home/claude/app/index.html','utf8');
const errors=[]; const vc=new (await import('jsdom')).VirtualConsole();
vc.on('jsdomError',e=>errors.push(e.message)); vc.on('error',(...a)=>errors.push(a.join(' ')));
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,doc=w.document;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(420);
w.eval(FIXTURE);
await sleep(60);
const btn=(txt,root)=> [...(root||doc).querySelectorAll('button')].find(b=>b.textContent.trim().includes(txt));
const nav=async r=>{w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(30);};
const setVal=(el,v)=>{el.value=v;el.dispatchEvent(new w.Event('change',{bubbles:true}));el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const checks=[];const ck=(n,ok)=>{checks.push({n,ok});};
// --- FLOW 1: reconciliation adjustment (reason required) ---
await nav('reconciliation');
btn('Create reconciliation adjustment').click(); await sleep(30);
let modal=doc.querySelector('#modalhost .modal');
ck('adjustment modal opened', !!modal);
btn('Create adjustment',modal).click(); await sleep(30);
ck('blocked without a reason (modal stays open)', !!doc.querySelector('#modalhost .modal'));
modal=doc.querySelector('#modalhost .modal');
const reasonSel=[...modal.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value.includes('Opening balance')));
setVal(reasonSel,'Opening balance before first logged transaction'); await sleep(20);
btn('Create adjustment',modal).click(); await sleep(60);
ck('adjustment modal closed after reason', !doc.querySelector('#modalhost .modal'));
ck('recon strip now shows C$0.00 difference', doc.getElementById('reconStrip').textContent.includes('C$0.00'));
await nav('ledger');
ck('adjustment posted to ledger', doc.getElementById('page').textContent.includes('Reconciliation adjustment'));
// --- FLOW 2: add machine, log collection, posting group hits ledger ---
await nav('machines');
btn('Add claw machine').click(); await sleep(30);
modal=doc.querySelector('#modalhost .modal');
ck('machine modal opened with suggested name', !!modal && [...modal.querySelectorAll('input')].some(i=>i.value==='Claw Machine 1'));
const insvc=[...modal.querySelectorAll('.field')].find(f=>f.textContent.includes('In-service'));
setVal(insvc.querySelector('input'),'2026-07-14');
const purch=[...modal.querySelectorAll('.field')].find(f=>f.querySelector('label') && f.querySelector('label').textContent==='Purchase price');
setVal(purch.querySelector('input'),'800.00');
btn('Add machine',modal).click(); await sleep(60);
ck('machine detail page opened', doc.getElementById('page').textContent.includes('Claw Machine 1'));
btn('Log collection').click(); await sleep(40);
modal=doc.querySelector('#modalhost .modal');
ck('collection modal opened', !!modal && modal.textContent.includes('Live calculation'));
const cash=[...modal.querySelectorAll('.field')].find(f=>f.querySelector('label') && f.querySelector('label').textContent.startsWith('Cash collected'));
setVal(cash.querySelector('input'),'200.00'); await sleep(20);
ck('live calc shows C$170.00 retained', modal.textContent.includes('170.00'));
ck('live calc shows C$138.75 net operating profit', modal.textContent.includes('138.75'));
btn('Save collection',modal).click(); await sleep(600); // wait for debounced persist
const state=JSON.parse(w.localStorage.getItem('ajfin:state'));
ck('collection saved', state.collections.length===1);
const pg=state.collections[0].postingGroupId;
const group=state.transactions.filter(t=>t.postingGroupId===pg);
ck('posting group created (income + venue expense)', group.length===2);
const sum=group.reduce((s,t)=>s+(t.type==='business_income'?t.convertedCadAmountCents:-t.convertedCadAmountCents),0);
ck('posting group cash impact = C$170.00', sum===17000);
ck('collection dated after data-through is excluded pre-confirm (calc stays C$2,026.00)', doc.getElementById('reconStrip').textContent.includes('2,026.00'));
await nav('forecasts');
ck('stale-coverage banner offers confirm', !!btn('My records are complete through today'));
btn('My records are complete through today').click(); await sleep(60);
ck('after confirming coverage, calc includes collection (C$2,196.00)', doc.getElementById('reconStrip').textContent.includes('2,196.00'));
// machine spreadsheet numbers
await nav('machines'); await sleep(30);
const back=btn('All machines'); if(back){back.click(); await sleep(40);}
const tabBtn=btn('Machine spreadsheet');
tabBtn.click(); await sleep(40);
const pgtxt=doc.getElementById('page').textContent;
ck('spreadsheet shows lifetime gross C$200.00', pgtxt.includes('200.00'));
ck('spreadsheet shows payback progress', pgtxt.includes('%'));
// undo delete round trip
await nav('ledger');
let pass=0;for(const c of checks){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n);}
if(errors.length){console.log('RUNTIME ERRORS:');errors.slice(0,8).forEach(e=>console.log('  '+e));}
console.log('\n'+pass+' / '+checks.length+' interaction checks; runtime errors: '+errors.length);
process.exit(pass===checks.length&&errors.length===0?0:1);

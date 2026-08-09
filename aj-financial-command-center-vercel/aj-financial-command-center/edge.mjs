import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import {FIXTURE} from './fixture.mjs';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));vc.on('error',(...a)=>errs.push(a.join(' ')));
const dom=new JSDOM(readFileSync('./public/index.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,doc=w.document;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(420);
w.eval(FIXTURE);
await sleep(60);
const E=x=>w.eval(x);const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});
const nav=async r=>{w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(50);};
const pageText=()=>doc.getElementById('page').textContent;

// EDGE 1 — savings target date already in the past
E('update(s=>{s.savingsPlan.targetDate="2026-01-31";s.savingsPlan.horizonMonths=-6;},"past target")');
await nav('required');
E('update(s=>{s.savingsPlan.targetDate="2028-08-27";s.savingsPlan.horizonMonths=25;},"restore")');

// EDGE 2 — completely empty ledger
E('update(s=>{s.transactions=[];s.accounts[0].manuallyConfirmedBalanceCents=0;},"empty")');
for(const r of ['overview','ledger','monthly','forecasts','required','reports','plan','reconciliation','machines','importexport','settings']){
  await nav(r);
  ck('empty ledger renders '+r, pageText().length>100 && !pageText().includes('NaN'), pageText().match(/.{0,30}NaN.{0,30}/));
}
ck('no runtime errors with an empty ledger', errs.length===0, errs[0]);

// EDGE 3 — checkpoint with no previous month
E('update(s=>{s.balanceCheckpoints={"2026-09":500000};},"cp only")');
ck('lone checkpoint stays INFERRED (no false measurement)', E('measuredSavingsRaw("2026-09")')===null);
await nav('monthly');
ck('Monthly Performance survives a lone checkpoint', errs.length===0 && !pageText().includes('NaN'), errs[0]);

// EDGE 4 — negative measured savings (a month where you spent down)
E('update(s=>{s.balanceCheckpoints={"2026-06":500000,"2026-07":300000};s.monthFlags["2026-07"]={expensesComplete:true};},"neg")');
ck('negative measured savings computes', E('measuredSavingsRaw("2026-07")')===-200000, E('measuredSavingsRaw("2026-07")'));

// EDGE 5 — enormous values (integer-cent overflow sanity)
E('update(s=>{s.transactions=[blankTx({date:"2026-07-10",reportingMonth:"2026-07",type:"business_income",status:"received",sourceName:"Big",description:"big",originalAmountCents:99999999999,convertedCadAmountCents:99999999999,recognitionClass:"earned_income",accountId:"acct-primary"})];},"big")');
await nav('overview');
ck('very large amounts format without breaking', pageText().includes('999,999,999.99'), pageText().slice(0,80));
ck('no Infinity leaks into the UI', !pageText().includes('Infinity'));

// EDGE 6 — machine with collections but zero invested
E('S=buildSeedState();persist();');E(FIXTURE);
E('update(s=>{s.machines.push(Object.assign({id:"m1",name:"M1",locationId:null,status:"In service",inServiceDate:"2026-07-01",purchaseDate:null,servicePeriods:null,purchasePriceCadCents:0,shippingCadCents:0,cardReaderCadCents:0,installationCadCents:0,initialInventoryCadCents:0,otherSetupCostCadCents:0,avgMethod:"perday",customMonthlyCashCents:null},MACHINE_DEFAULTS));},"m")');
const pb=E('JSON.stringify(machinePayback(S.machines[0]))');
ck('zero-invested machine gives null payback, not division by zero', JSON.parse(pb).progress===null && JSON.parse(pb).roi===null, pb);
ck('zero-invested machine confidence = insufficient', JSON.parse(pb).conf==='insufficient');
await nav('machines');
ck('machines page renders with a zero-cost machine', errs.length===0 && !pageText().includes('NaN'), errs[0]);

// EDGE 7 — undo across a state replacement (restore-like)
E('S=buildSeedState();UNDO.length=0;REDO.length=0;persist();');E(FIXTURE);
E('doUndo()');

// EDGE 8 — corrupt stored state must not brick the app
ck('migrate rejects garbage', E('migrate({nope:true})!==null&&migrate({nope:true}).transactions!==undefined'));
ck('migrate returns null for non-objects', E('migrate("hello")')===null);

let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' edge cases; runtime errors: '+errs.length);
errs.slice(0,6).forEach(e=>console.log('  • '+String(e).slice(0,180)));
process.exit(0);

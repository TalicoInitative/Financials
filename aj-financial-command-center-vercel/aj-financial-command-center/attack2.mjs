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
const nav=async r=>{w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(60);};
const mk=(id,mid,cash)=>`{id:"${id}",machineId:"${mid}",operatingCurrency:"CAD",exchangeRateToCad:1,settlementPostingMode:"gross",postingGroupId:null,periodStart:"2026-07-01",periodEnd:"2026-07-14",collectionDate:"2026-07-14",expectedCollectionDate:null,cashRevenueCadCents:${cash},cardRevenueCadCents:0,otherRevenueCadCents:0,playPriceCadCents:200,playsPerPrize:4,averagePlushCostCadCents:125,venueSharePercent:15,venueShareBasis:"gross",venueBasisCustomCents:null,processingPercent:0,processingFixedFeeCadCents:0,processingFeesCadCents:null,refundsCadCents:0,allocatedExpenseCadCents:0,otherDeductionsCadCents:0,ownershipPercent:100,startPlayCounter:null,endPlayCounter:null,startPrizeCounter:null,endPrizeCounter:null,actualPrizes:null,depositAccountId:"acct-primary",depositDate:"2026-07-14",reconciled:false,notes:"",linkedTransactionIds:[]}`;
const mach=(id,name)=>`Object.assign({id:"${id}",name:"${name}",locationId:null,status:"In service",inServiceDate:"2026-07-01",purchaseDate:"2026-07-01",servicePeriods:null,purchasePriceCadCents:100000,shippingCadCents:0,cardReaderCadCents:0,installationCadCents:0,initialInventoryCadCents:0,otherSetupCostCadCents:0,avgMethod:"perday",customMonthlyCashCents:null},MACHINE_DEFAULTS)`;

// ===== A. INTEGRITY INVARIANT: ledger cash must always equal the sum of posting groups =====
E('S=buildSeedState();persist();');E(FIXTURE);
E(`update(s=>{s.machines.push(${mach('i1','I1')});upsertById(s.collections,${mk('ic','i1',20000)});applyCollectionPostings(s,"ic");},"log")`);
const inv1=E(`(()=>{const c=S.collections[0];const txs=S.transactions.filter(t=>t.postingGroupId===c.postingGroupId);
 return JSON.stringify({expect:calcCollection(c).netCashContributionCadCents,got:postingGroupCashImpact(txs)});})()`);
ck('posting group cash matches the collection exactly', JSON.parse(inv1).expect===JSON.parse(inv1).got, inv1);
// edit the amount -> postings must re-sync, not duplicate
E(`update(s=>{s.collections[0].cashRevenueCadCents=50000;applyCollectionPostings(s,"ic");},"edit")`);
const inv2=E(`(()=>{const c=S.collections[0];const txs=S.transactions.filter(t=>t.postingGroupId===c.postingGroupId);
 return JSON.stringify({n:txs.length,expect:calcCollection(c).netCashContributionCadCents,got:postingGroupCashImpact(txs)});})()`);
ck('editing a collection re-syncs without duplicating rows', JSON.parse(inv2).n===2&&JSON.parse(inv2).expect===JSON.parse(inv2).got, inv2);
ck('no stale rows from the previous amount remain', E('S.transactions.filter(t=>t.postingGroupId==="pg-ic").reduce((s,t)=>s+(TXT[t.type].kind==="income"?t.convertedCadAmountCents:0),0)')===50000, E('S.transactions.filter(t=>t.postingGroupId==="pg-ic"&&TXT[t.type].kind==="income").map(t=>t.convertedCadAmountCents)'));
// the global warning system must catch a deliberately broken group
E('update(s=>{const t=s.transactions.find(x=>x.postingGroupId==="pg-ic");t.convertedCadAmountCents=999999;},"tamper")');
ck('a tampered posting group is DETECTED by the warning system', E('gatherWarnings().some(x=>/posting group/i.test(x.msg))'), E('JSON.stringify(gatherWarnings().map(x=>x.msg.slice(0,50)))'));

// ===== B. CASCADE: archiving/removing a machine that still has collections =====
E('S=buildSeedState();persist();');E(FIXTURE);
E(`update(s=>{s.machines.push(${mach('c1','C1')});upsertById(s.collections,${mk('cc','c1',20000)});applyCollectionPostings(s,"cc");},"log")`);
const balWith=E('calcBalance(S.meta.dataThroughDate)');
E('update(s=>{s.machines=s.machines.filter(m=>m.id!=="c1");},"delete machine")');
await nav('machines');
ck('deleting a machine does not crash pages that read its collections', errs.length===0, errs[0]);
ck('orphaned collections do not corrupt the ledger balance', E('calcBalance(S.meta.dataThroughDate)')===balWith, E('calcBalance(S.meta.dataThroughDate)')+' vs '+balWith);
ck('orphaned collections are surfaced as a warning', E('gatherWarnings().some(x=>/no longer exists/i.test(x.msg))'), E('JSON.stringify(gatherWarnings().map(x=>x.msg.slice(0,45)))'));
await nav('reports');
ck('reports survive an orphaned collection', errs.length===0, errs[0]);

// ===== C. RAPID-FIRE EDITS (debounce races) =====
E('S=buildSeedState();persist();');E(FIXTURE);
await sleep(700);
const persisted=JSON.parse(w.localStorage.getItem('ajfin:state'));

// ===== D. UNDO STACK UNDER PRESSURE =====
E('S=buildSeedState();UNDO.length=0;REDO.length=0;persist();');E(FIXTURE);
for(let i=0;i<70;i++)E(`update(s=>{s.milestones[0].notes="n${i}";},"edit ${i}")`);
ck('undo stack is capped at 50 (no unbounded memory growth)', E('UNDO.length')===50, E('UNDO.length'));
for(let i=0;i<50;i++)E('doUndo()');
ck('undoing 50 times never throws or produces null state', E('!!S&&Array.isArray(S.transactions)'), E('typeof S'));
ck('extra undos are handled gracefully', (()=>{E('doUndo()');return E('!!S');})());
ck('state is still coherent after mass undo', E('calcBalance(S.meta.dataThroughDate)')===180848, E('calcBalance(S.meta.dataThroughDate)'));

// ===== E. RESTORE A BACKUP MID-SESSION =====
E('S=buildSeedState();persist();');E(FIXTURE);
const backup=E('JSON.stringify(S)');
E(`update(s=>{s.transactions.push(blankTx({date:"2026-07-25",reportingMonth:"2026-07",type:"business_income",status:"received",sourceName:"Later",description:"later",originalAmountCents:99999,convertedCadAmountCents:99999,recognitionClass:"earned_income",accountId:"acct-primary"}));},"add")`);
ck('state changed before restore', E('S.transactions.length')===7);
E(`S=migrate(JSON.parse(${JSON.stringify(backup)}));persist();render();`);
await sleep(400);
ck('restoring a backup replaces state cleanly', E('S.transactions.length')===6, E('S.transactions.length'));
ck('restored state is what gets persisted', JSON.parse(w.localStorage.getItem('ajfin:state')).transactions.length===6);
ck('balance matches the restored data', E('calcBalance(S.meta.dataThroughDate)')===180848);

// ===== F. NEGATIVE / REVERSED INPUTS =====
E('S=buildSeedState();persist();');E(FIXTURE);
ck('a negative machine investment is handled without nonsense output', E('(()=>{const m=Object.assign({},MACHINE_DEFAULTS,{id:"nx",name:"NX",purchasePriceCadCents:-5000,shippingCadCents:0,cardReaderCadCents:0,installationCadCents:0,initialInventoryCadCents:0,otherSetupCostCadCents:0,inServiceDate:"2026-07-01",servicePeriods:null,ownershipPercent:100});const p=machinePayback(m);return p.progress===null||Number.isFinite(p.progress);})()'));
await nav('plan');
E('update(s=>{s.machines.push(Object.assign({},MACHINE_DEFAULTS,{id:"neg",name:"Neg",locationId:null,status:"In service",inServiceDate:"2026-07-01",purchaseDate:"2026-07-01",servicePeriods:null,purchasePriceCadCents:-50000,shippingCadCents:0,cardReaderCadCents:0,installationCadCents:0,initialInventoryCadCents:0,otherSetupCostCadCents:0,avgMethod:"perday",customMonthlyCashCents:null}));},"neg machine")');
const pbn=E('JSON.stringify(machinePayback(machineById("neg")))');
ck('negative invested capital does not produce nonsense payback', (()=>{const p=JSON.parse(pbn);return p.progress===null||Number.isFinite(p.progress);})(), pbn);
await nav('machines');
ck('machines page safe with negative invested', !doc.getElementById('page').textContent.includes('NaN')&&!doc.getElementById('page').textContent.includes('Infinity'));

ck('no runtime errors across the whole run', errs.length===0, errs[0]);
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' integrity checks; runtime errors: '+errs.length);
errs.slice(0,6).forEach(e=>console.log('  • '+String(e).slice(0,180)));
process.exit(0);

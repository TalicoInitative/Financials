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
const btn=(t,root)=>[...(root||doc).querySelectorAll('button')].find(b=>b.textContent.trim().includes(t));
const txt=()=>doc.getElementById('page').textContent;

// ============ A. STALE EDITOR: save a record that was deleted underneath you ============
await nav('ledger');
const victim=E('S.transactions[1].id');
ck('fixture installed 6 rows', E('S.transactions.length')===6, E('S.transactions.length'));
E(`window.__stale=deepClone(S.transactions.find(t=>t.id==="${victim}"))`);
E(`update(s=>{s.transactions=s.transactions.filter(t=>t.id!=="${victim}");},"delete")`);
E(`window.__stale.description="EDITED AFTER DELETE";
   update(s=>{const i=s.transactions.findIndex(t=>t.id===window.__stale.id);if(i===-1)s.transactions.push(window.__stale);else s.transactions[i]=window.__stale;},"stale save")`);
ck('array has no negative-index corruption', E('Object.keys(S.transactions).every(k=>/^\\d+$/.test(k))'), E('JSON.stringify(Object.keys(S.transactions).slice(-3))'));
ck('transaction count is sane after stale save', E('S.transactions.length')===6, E('S.transactions.length'));
ck('totals still compute (no undefined rows)', Number.isInteger(E('calcBalance(S.meta.dataThroughDate)')), E('calcBalance(S.meta.dataThroughDate)'));
// now the REAL app path: open editor, delete elsewhere, save modal
E('S=buildSeedState();persist();');E(FIXTURE); await nav('ledger');
const t2=E('S.transactions[2]?S.transactions[2].id:S.transactions[0].id');
E(`txModal(S.transactions.find(t=>t.id==="${t2}"))`); await sleep(60);
E(`update(s=>{s.transactions=s.transactions.filter(t=>t.id!=="${t2}");},"delete underneath")`);
const modal=doc.querySelector('#modalhost .modal');
const save=modal?[...modal.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save'):null;
if(save){save.click();await sleep(80);}
ck('saving an editor whose row was deleted does not corrupt the array', E('Object.keys(S.transactions).every(k=>/^\\d+$/.test(k))&&S.transactions.every(t=>t&&t.id)'), E('JSON.stringify(S.transactions.map(t=>t&&t.id?1:0))'));
ck('no phantom holes in the ledger', E('S.transactions.filter(Boolean).length')===E('S.transactions.length'));

// ============ B. DIVISION BY ZERO IN MACHINE MATH ============
E('S=buildSeedState();persist();');E(FIXTURE);
E(`update(s=>{s.machines.push(Object.assign({id:"z1",name:"Zero",locationId:null,status:"In service",inServiceDate:"2026-07-01",purchaseDate:"2026-07-01",servicePeriods:null,purchasePriceCadCents:50000,shippingCadCents:0,cardReaderCadCents:0,installationCadCents:0,initialInventoryCadCents:0,otherSetupCostCadCents:0,avgMethod:"perday",customMonthlyCashCents:null},MACHINE_DEFAULTS,{playPriceCadCents:0,playsPerPrize:0}));},"zero machine")`);
E(`update(s=>{s.collections.push({id:"zc",machineId:"z1",operatingCurrency:"CAD",exchangeRateToCad:1,settlementPostingMode:"gross",postingGroupId:null,periodStart:"2026-07-01",periodEnd:"2026-07-14",collectionDate:"2026-07-14",expectedCollectionDate:null,cashRevenueCadCents:20000,cardRevenueCadCents:0,otherRevenueCadCents:0,playPriceCadCents:0,playsPerPrize:0,averagePlushCostCadCents:125,venueSharePercent:15,venueShareBasis:"gross",venueBasisCustomCents:null,processingPercent:0,processingFixedFeeCadCents:0,processingFeesCadCents:null,refundsCadCents:0,allocatedExpenseCadCents:0,otherDeductionsCadCents:0,ownershipPercent:100,startPlayCounter:null,endPlayCounter:null,startPrizeCounter:null,endPrizeCounter:null,actualPrizes:null,depositAccountId:"acct-primary",depositDate:"2026-07-14",reconciled:false,notes:"",linkedTransactionIds:[]});},"zero coll")`);
const zc=E('JSON.stringify(calcCollection(S.collections[0]))');
const Z=JSON.parse(zc);
ck('zero play price does not produce Infinity plays', Number.isFinite(Z.estimatedPlays), Z.estimatedPlays);
ck('zero plays-per-prize does not produce Infinity prizes', Number.isFinite(Z.estimatedPrizes), Z.estimatedPrizes);
ck('plush COGS stays a finite integer', Number.isInteger(Z.plushCogsCents), Z.plushCogsCents);
ck('operating profit stays finite', Number.isInteger(Z.netOperatingProfitCadCents), Z.netOperatingProfitCadCents);
await nav('machines');
ck('machines page shows no NaN/Infinity with a zero-config machine', !txt().includes('NaN')&&!txt().includes('Infinity'), txt().match(/.{0,40}(NaN|Infinity).{0,40}/));

// ============ C. ORPHANED MACHINE-EXPENSE ALLOCATIONS ============
E('S=buildSeedState();persist();');E(FIXTURE);
E(`update(s=>{s.machines.push(Object.assign({id:"m1",name:"M1",locationId:null,status:"In service",inServiceDate:"2026-07-01",purchaseDate:"2026-07-01",servicePeriods:null,purchasePriceCadCents:100000,shippingCadCents:0,cardReaderCadCents:0,installationCadCents:0,initialInventoryCadCents:0,otherSetupCostCadCents:0,avgMethod:"perday",customMonthlyCashCents:null},MACHINE_DEFAULTS));
 const tx=blankTx({date:"2026-07-10",reportingMonth:"2026-07",type:"business_expense",status:"paid",sourceName:"Repair Co",description:"repair",categoryId:"Machine repair",originalAmountCents:30000,convertedCadAmountCents:30000,recognitionClass:"cash_expense",sourceRecordType:"machine_expense"});
 s.transactions.push(tx);
 s.machineAllocations.push({id:"a1",transactionId:tx.id,machineId:"m1",collectionId:null,allocationPercent:100,allocatedAmountCadCents:30000,capitalOrOperating:"operating"});
 window.__txid=tx.id;},"expense")`);
const cashBefore=E('machineTotals(machineById("m1")).cumCash');
E(`update(s=>{s.transactions=s.transactions.filter(t=>t.id!==window.__txid);},"delete underlying tx")`);
const cashAfter=E('machineTotals(machineById("m1")).cumCash');
ck('deleting the ledger row also stops it counting against the machine', cashAfter!==cashBefore||cashBefore===cashAfter&&E('machineAllocs("m1").length')===0, 'before='+cashBefore+' after='+cashAfter+' allocs='+E('machineAllocs("m1").length'));
ck('no orphaned allocations remain', E('machineAllocations_orphans=S.machineAllocations.filter(a=>!S.transactions.some(t=>t.id===a.transactionId)).length')===0, E('S.machineAllocations.filter(a=>!S.transactions.some(t=>t.id===a.transactionId)).length'));

// ============ D. POSTING MODE SWITCHING (gross -> net -> manual) ============
E('S=buildSeedState();persist();');E(FIXTURE);
E(`update(s=>{s.machines.push(Object.assign({id:"pm",name:"PM",locationId:null,status:"In service",inServiceDate:"2026-07-01",purchaseDate:"2026-07-01",servicePeriods:null,purchasePriceCadCents:0,shippingCadCents:0,cardReaderCadCents:0,installationCadCents:0,initialInventoryCadCents:0,otherSetupCostCadCents:0,avgMethod:"perday",customMonthlyCashCents:null},MACHINE_DEFAULTS));
 s.collections.push({id:"pc",machineId:"pm",operatingCurrency:"CAD",exchangeRateToCad:1,settlementPostingMode:"gross",postingGroupId:null,periodStart:"2026-07-01",periodEnd:"2026-07-14",collectionDate:"2026-07-14",expectedCollectionDate:null,cashRevenueCadCents:20000,cardRevenueCadCents:0,otherRevenueCadCents:0,playPriceCadCents:200,playsPerPrize:4,averagePlushCostCadCents:125,venueSharePercent:15,venueShareBasis:"gross",venueBasisCustomCents:null,processingPercent:0,processingFixedFeeCadCents:0,processingFeesCadCents:null,refundsCadCents:0,allocatedExpenseCadCents:0,otherDeductionsCadCents:0,ownershipPercent:100,startPlayCounter:null,endPlayCounter:null,startPrizeCounter:null,endPrizeCounter:null,actualPrizes:null,depositAccountId:"acct-primary",depositDate:"2026-07-14",reconciled:false,notes:"",linkedTransactionIds:[]});},"coll")`);
E('update(x=>applyCollectionPostings(x,"pc"),"post")');
const grossN=E('S.transactions.filter(t=>t.postingGroupId==="pg-pc").length');
const grossCash=E('postingGroupCashImpact(S.transactions.filter(t=>t.postingGroupId==="pg-pc"))');
E('update(s=>{s.collections[0].settlementPostingMode="net";},"switch net");update(x=>applyCollectionPostings(x,"pc"),"post")');
const netN=E('S.transactions.filter(t=>t.postingGroupId==="pg-pc").length');
const netCash=E('postingGroupCashImpact(S.transactions.filter(t=>t.postingGroupId==="pg-pc"))');
ck('gross mode posts 2 rows summing to C$170.00', grossN===2&&grossCash===17000, grossN+' rows / '+grossCash);
ck('switching to net leaves exactly 1 row, same cash', netN===1&&netCash===17000, netN+' rows / '+netCash);
E('update(s=>{s.collections[0].settlementPostingMode="manual";},"switch manual");update(x=>applyCollectionPostings(x,"pc"),"post")');
ck('switching to manual removes ALL auto rows (no orphans)', E('S.transactions.filter(t=>t.postingGroupId==="pg-pc").length')===0, E('S.transactions.filter(t=>t.postingGroupId==="pg-pc").length'));
ck('ledger balance returns to the seed value after manual switch', E('calcBalance(S.meta.dataThroughDate)')===180848, E('calcBalance(S.meta.dataThroughDate)'));

// ============ E. UNDO CONSISTENCY AROUND COLLECTIONS ============
E('S=buildSeedState();persist();UNDO.length=0;REDO.length=0;');
E(`update(s=>{s.machines.push(Object.assign({id:"u1",name:"U1",locationId:null,status:"In service",inServiceDate:"2026-07-01",purchaseDate:"2026-07-01",servicePeriods:null,purchasePriceCadCents:0,shippingCadCents:0,cardReaderCadCents:0,installationCadCents:0,initialInventoryCadCents:0,otherSetupCostCadCents:0,avgMethod:"perday",customMonthlyCashCents:null},MACHINE_DEFAULTS));},"add machine")`);
E(`update(s=>{upsertById(s.collections,{id:"uc",machineId:"u1",operatingCurrency:"CAD",exchangeRateToCad:1,settlementPostingMode:"gross",postingGroupId:null,periodStart:"2026-07-01",periodEnd:"2026-07-14",collectionDate:"2026-07-14",expectedCollectionDate:null,cashRevenueCadCents:20000,cardRevenueCadCents:0,otherRevenueCadCents:0,playPriceCadCents:200,playsPerPrize:4,averagePlushCostCadCents:125,venueSharePercent:15,venueShareBasis:"gross",venueBasisCustomCents:null,processingPercent:0,processingFixedFeeCadCents:0,processingFeesCadCents:null,refundsCadCents:0,allocatedExpenseCadCents:0,otherDeductionsCadCents:0,ownershipPercent:100,startPlayCounter:null,endPlayCounter:null,startPrizeCounter:null,endPrizeCounter:null,actualPrizes:null,depositAccountId:"acct-primary",depositDate:"2026-07-14",reconciled:false,notes:"",linkedTransactionIds:[]});applyCollectionPostings(s,"uc");},"log collection")`);
const afterLog=E('JSON.stringify({colls:S.collections.length,txs:S.transactions.filter(t=>t.postingGroupId==="pg-uc").length})');
E('doUndo()');
const afterUndo=E('JSON.stringify({colls:S.collections.length,txs:S.transactions.filter(t=>t.postingGroupId==="pg-uc").length})');
const A=JSON.parse(afterUndo);
ck('one undo does not leave a collection with orphaned postings', !(A.colls>0&&A.txs===0)&&!(A.colls===0&&A.txs>0), 'after log '+afterLog+' → after undo '+afterUndo);

// ============ F. TRANSFERS: global zero, per-account correct ============
E('S=buildSeedState();persist();');E(FIXTURE);
const g0=E('calcBalance(S.meta.dataThroughDate)');
E(`update(s=>{s.accounts.push({id:"b2",name:"Second",type:"cash",includeInSavings:true,manuallyConfirmedBalanceCents:0,lastReconciledAt:null});
 s.transactions.push(blankTx({date:"2026-07-20",reportingMonth:"2026-07",type:"transfer",status:"paid",description:"move",originalAmountCents:50000,convertedCadAmountCents:50000,recognitionClass:"transfer",accountId:"acct-primary",destinationAccountId:"b2"}));},"transfer")`);
ck('transfer leaves the GLOBAL balance unchanged', E('calcBalance(S.meta.dataThroughDate)')===g0, E('calcBalance(S.meta.dataThroughDate)')+' vs '+g0);
ck('source account decreases by C$500', E('calcBalance(S.meta.dataThroughDate,"acct-primary")')===g0-50000, E('calcBalance(S.meta.dataThroughDate,"acct-primary")'));
ck('destination account increases by C$500', E('calcBalance(S.meta.dataThroughDate,"b2")')===50000, E('calcBalance(S.meta.dataThroughDate,"b2")'));
ck('transfer is not counted as income', E('basisTotals(S.meta.trackingStartDate,S.meta.dataThroughDate).gross')===218348, E('basisTotals(S.meta.trackingStartDate,S.meta.dataThroughDate).gross'));

// ============ G. SCRIPT INJECTION VIA TEXT FIELDS ============
E('S=buildSeedState();persist();window.__pwned=false;');E(FIXTURE);
E(`update(s=>{s.transactions[0].description='<img src=x onerror="window.__pwned=true">';s.transactions[0].sourceName='<script>window.__pwned=true<\\/script>';},"inject")`);
await nav('ledger'); await sleep(80);
ck('HTML in a description does not execute', E('window.__pwned')===false);
ck('injected markup is shown as literal text', doc.getElementById('page').textContent.includes('<img src=x'), doc.getElementById('page').textContent.slice(0,60));
ck('no injected element entered the DOM', doc.querySelectorAll('#page img').length===0);

// ============ H. MONTH-ONLY RECORD TIMING ============
E('S=buildSeedState();persist();');E(FIXTURE);
ck('month-only counts from within its month (needed for the C$1,808.48 seed figure)', E('calcBalance("2026-07-27")')===180848, E('calcBalance("2026-07-27")'));
ck('month-only is NOT counted before its month starts', E('calcBalance("2026-06-30")')===0, E('calcBalance("2026-06-30")'));
ck('month-only appears in an undated bucket, not on a day', E('S.transactions.filter(t=>t.datePrecision==="month").every(t=>!t.date&&t.reportingMonth==="2026-07")'));
ck('month-only expense included in July totals', E('monthAgg("2026-07").bizExpAll')===22500, E('monthAgg("2026-07").bizExpAll'));
ck('month-only never gets an invented date', E('S.transactions.filter(t=>t.datePrecision==="month").every(t=>t.date===null)'));

ck('logging a collection is ONE undo step (record + postings together)', (()=>{const a=JSON.parse(afterUndo);return a.colls===0&&a.txs===0;})(), afterUndo);
ck('no runtime errors during the whole attack run', errs.length===0, errs[0]);
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' adversarial checks; runtime errors: '+errs.length);
errs.slice(0,6).forEach(e=>console.log('  • '+String(e).slice(0,180)));
process.exit(0);

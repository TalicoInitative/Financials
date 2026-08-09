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
const th=()=>doc.querySelectorAll('#page thead th').length;
const btn=(t,root)=>[...(root||doc).querySelectorAll('button')].find(b=>b.textContent.trim().includes(t));

// ===== 1. COLUMNS PICKER IS PER-VIEW AND ACTUALLY WORKS =====
await nav('income');
const incBefore=th();
E('update(s=>{s.ui.viewCols={income:["date","sourceName"]};},null)'); await sleep(60);
ck('Columns picker now changes the Income view', th()!==incBefore && th()<incBefore, incBefore+' → '+th());
await nav('ledger');w.eval('UI.ledgerView="table";render()');await sleep(50);
ck('main Ledger keeps its own column set (not affected)', th()>5, th());
E('update(s=>{s.ui.viewCols={};},null)');
await nav('income'); await sleep(40);
ck('resetting restores the view default', th()===incBefore, th()+' vs '+incBefore);
await nav('bizexp');
const bizBefore=th();
E('update(s=>{s.ui.viewCols={bizexp:["date","description","convertedCadAmountCents"]};},null)'); await sleep(60);
ck('each log view stores its own columns', th()===4||th()===3, th());
await nav('income'); await sleep(40);
ck('changing one view does not change another', th()===incBefore, th());
E('update(s=>{s.ui.viewCols={};},null)');

// ===== 2. MANUAL-LINK MODE ACTUALLY LINKS =====
E(`update(s=>{s.machines.push(Object.assign({id:"ml",name:"ML",locationId:null,status:"In service",inServiceDate:"2026-07-01",purchaseDate:"2026-07-01",servicePeriods:null,purchasePriceCadCents:0,shippingCadCents:0,cardReaderCadCents:0,installationCadCents:0,initialInventoryCadCents:0,otherSetupCostCadCents:0,avgMethod:"perday",customMonthlyCashCents:null},MACHINE_DEFAULTS));
 // two real ledger rows the user entered by hand
 const inc=blankTx({date:"2026-07-14",reportingMonth:"2026-07",type:"business_income",status:"received",sourceName:"Venue",description:"machine cash",originalAmountCents:20000,convertedCadAmountCents:20000,recognitionClass:"earned_income",accountId:"acct-primary"});
 const exp=blankTx({date:"2026-07-14",reportingMonth:"2026-07",type:"business_expense",status:"paid",sourceName:"Venue",description:"venue share",originalAmountCents:3000,convertedCadAmountCents:3000,recognitionClass:"cash_expense",accountId:"acct-primary"});
 s.transactions.push(inc,exp);window.__inc=inc.id;window.__exp=exp.id;},"manual rows")`);
E(`update(s=>{upsertById(s.collections,{id:"mc",machineId:"ml",operatingCurrency:"CAD",exchangeRateToCad:1,settlementPostingMode:"manual",postingGroupId:null,periodStart:"2026-07-01",periodEnd:"2026-07-14",collectionDate:"2026-07-14",expectedCollectionDate:null,cashRevenueCadCents:20000,cardRevenueCadCents:0,otherRevenueCadCents:0,playPriceCadCents:200,playsPerPrize:4,averagePlushCostCadCents:125,venueSharePercent:15,venueShareBasis:"gross",venueBasisCustomCents:null,processingPercent:0,processingFixedFeeCadCents:0,processingFeesCadCents:null,refundsCadCents:0,allocatedExpenseCadCents:0,otherDeductionsCadCents:0,ownershipPercent:100,startPlayCounter:null,endPlayCounter:null,startPrizeCounter:null,endPrizeCounter:null,actualPrizes:null,depositAccountId:"acct-primary",depositDate:"2026-07-14",reconciled:false,notes:"",linkedTransactionIds:[window.__inc,window.__exp]});applyCollectionPostings(s,"mc");},"link")`);
ck('manual mode stamps the chosen rows into the posting group', E('S.transactions.filter(t=>t.postingGroupId==="pg-mc").length')===2, E('S.transactions.filter(t=>t.postingGroupId==="pg-mc").length'));
ck('manual mode creates NO new transactions', E('S.transactions.length')===8, E('S.transactions.length'));
ck('linked rows are not marked auto-generated', E('S.transactions.filter(t=>t.postingGroupId==="pg-mc").every(t=>!t.generatedBySourceRecord)'));
ck('linked group cash equals the collection settlement (C$170.00)', E('postingGroupCashImpact(S.transactions.filter(t=>t.postingGroupId==="pg-mc"))')===17000, E('postingGroupCashImpact(S.transactions.filter(t=>t.postingGroupId==="pg-mc"))'));
ck('a mismatched manual link is now WARNED about', (()=>{E('update(s=>{s.collections[0].linkedTransactionIds=[window.__inc];applyCollectionPostings(s,"mc");},"unlink one")');
  return E('gatherWarnings().some(x=>/posting group/i.test(x.msg))');})(), E('JSON.stringify(gatherWarnings().map(x=>x.msg.slice(0,40)))'));
ck('unlinking clears the stamp without deleting the row', E('S.transactions.some(t=>t.id===window.__exp&&!t.postingGroupId)')&&E('S.transactions.length')===8);
// deleting a manual-link collection must NOT delete the user's real rows
E('update(s=>{s.collections[0].linkedTransactionIds=[window.__inc,window.__exp];applyCollectionPostings(s,"mc");},"relink")');
const before=E('S.transactions.length');
E('deleteCollection("mc")'); await sleep(60);
ck('deleting a manual-link collection keeps the real ledger rows', E('S.transactions.length')===before, E('S.transactions.length')+' vs '+before);
ck('...and unlinks them cleanly', E('S.transactions.every(t=>t.postingGroupId!=="pg-mc")'));

// generated rows still ARE deleted with their collection
E('S=buildSeedState();persist();');E(FIXTURE);
E(`update(s=>{s.machines.push(Object.assign({id:"g1",name:"G1",locationId:null,status:"In service",inServiceDate:"2026-07-01",purchaseDate:"2026-07-01",servicePeriods:null,purchasePriceCadCents:0,shippingCadCents:0,cardReaderCadCents:0,installationCadCents:0,initialInventoryCadCents:0,otherSetupCostCadCents:0,avgMethod:"perday",customMonthlyCashCents:null},MACHINE_DEFAULTS));
 upsertById(s.collections,{id:"gc",machineId:"g1",operatingCurrency:"CAD",exchangeRateToCad:1,settlementPostingMode:"gross",postingGroupId:null,periodStart:"2026-07-01",periodEnd:"2026-07-14",collectionDate:"2026-07-14",expectedCollectionDate:null,cashRevenueCadCents:20000,cardRevenueCadCents:0,otherRevenueCadCents:0,playPriceCadCents:200,playsPerPrize:4,averagePlushCostCadCents:125,venueSharePercent:15,venueShareBasis:"gross",venueBasisCustomCents:null,processingPercent:0,processingFixedFeeCadCents:0,processingFeesCadCents:null,refundsCadCents:0,allocatedExpenseCadCents:0,otherDeductionsCadCents:0,ownershipPercent:100,startPlayCounter:null,endPlayCounter:null,startPrizeCounter:null,endPrizeCounter:null,actualPrizes:null,depositAccountId:"acct-primary",depositDate:"2026-07-14",reconciled:false,notes:"",linkedTransactionIds:[]});applyCollectionPostings(s,"gc");},"gen")`);
ck('gross mode still generates 2 rows', E('S.transactions.length')===8);
E('deleteCollection("gc")'); await sleep(60);
ck('generated rows ARE removed with their collection', E('S.transactions.length')===6, E('S.transactions.length'));

// ===== 3. MANUAL-LINK PICKER RENDERS IN THE UI =====
E('S=buildSeedState();persist();');E(FIXTURE);
E(`update(s=>{s.machines.push(Object.assign({id:"ui1",name:"UI1",locationId:null,status:"In service",inServiceDate:"2026-07-01",purchaseDate:"2026-07-01",servicePeriods:null,purchasePriceCadCents:0,shippingCadCents:0,cardReaderCadCents:0,installationCadCents:0,initialInventoryCadCents:0,otherSetupCostCadCents:0,avgMethod:"perday",customMonthlyCashCents:null},MACHINE_DEFAULTS));},"m")`);
E('collectionModal(null,"ui1")'); await sleep(80);
const modal=doc.querySelector('#modalhost .modal');
const modeSel=[...modal.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='manual'));
modeSel.value='manual'; modeSel.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(80);
ck('choosing manual reveals a link picker', modal.textContent.includes('Link existing ledger entries'), modal.textContent.slice(0,80));
ck('picker lists real ledger rows to tick', modal.textContent.includes('Eli')||modal.textContent.includes('Placement'), modal.textContent.slice(0,120));
ck('picker shows a live match indicator', /matches|does not match/.test(modal.textContent));
ck('no placeholder wording remains', !/link ledger entries from the machine/i.test(modal.textContent));
E('document.getElementById("modalhost").classList.remove("open")');
ck('no runtime errors', errs.length===0, errs[0]);
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' fix checks; runtime errors: '+errs.length);
process.exit(0);

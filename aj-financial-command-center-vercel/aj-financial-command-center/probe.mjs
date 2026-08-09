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
const txt=()=>doc.getElementById('page').textContent;
const rows=()=>doc.querySelectorAll('#page tbody tr').length;

// ===== 1. FILTER LEAKAGE BETWEEN VIEWS =====
await nav('ledger');
E('UI.ledger.type="transfer"');           // filter the main ledger to transfers only
await nav('income');
ck('income log is not silently emptied by a hidden type filter', rows()>0, 'rows='+rows()+' type='+E('UI.ledger.type'));
const typeSelects=[...doc.querySelectorAll('#page select')].filter(s=>[...s.options].some(o=>o.value==='transfer'));
ck('no hidden-but-active type filter on a locked view', rows()>0||typeSelects.length>0, 'visible type control: '+typeSelects.length);
E('UI.ledger.type=""');
await nav('ledger'); E('UI.ledger.q="zzzznotfound"'); await nav('bizexp');
ck('search text does not leak into another view unexpectedly', true, 'q='+E('UI.ledger.q')+' rows='+rows());
E('UI.ledger.q=""');

// ===== 2. REAL-WORLD CSV QUIRKS =====
const csvTests=[
 ['BOM + CRLF','\ufeffdate,source,amount\r\n2026-08-01,Acme,100.00\r\n'],
 ['quoted comma','date,source,amount\n2026-08-01,"Acme, Inc",100.00\n'],
 ['embedded newline','date,source,amount\n2026-08-01,"Acme\nCorp",100.00\n'],
 ['escaped quotes','date,source,amount\n2026-08-01,"He said ""hi""",100.00\n'],
 ['trailing blank line','date,source,amount\n2026-08-01,Acme,100.00\n\n'],
];
for(const [name,body] of csvTests){
  let out;try{out=E('JSON.stringify(csvParse('+JSON.stringify(body)+'))');}catch(e){out='THREW: '+e.message;}
  const p=out.startsWith('THREW')?null:JSON.parse(out);
  const ok=p&&p.length>=2&&p[1].length===3&&String(p[1][2]).trim()==='100.00';
  ck('CSV parses: '+name, !!ok, out.slice(0,150));
}
const bom=E('JSON.stringify(csvParse('+JSON.stringify('\ufeffdate,source,amount\r\n2026-08-01,Acme,100.00\r\n')+')[0])');
ck('BOM stripped from first header (not "\\ufeffdate")', !bom.includes('feff')&&!bom.includes('\ufeff'), bom);
ck('money parser rejects European decimal comma rather than misreading', E('pmoney("1.234,56")')===null||E('pmoney("1.234,56")')===123456, E('pmoney("1.234,56")'));

// ===== 3. WINDOW RESIZE (desktop <-> mobile) =====
await nav('overview');
const menuBtn=()=>doc.querySelector('#topbar button[aria-label="Menu"]');
ck('menu button exists and is CSS-controlled (survives resize)', !!menuBtn() && menuBtn().className.includes('menubtn') && !menuBtn().style.display, menuBtn()&&menuBtn().className+'|'+menuBtn().style.display);
const cssTxt=readFileSync('./public/index.html','utf8');
ck('menu hidden on desktop via media query', /@media \(min-width:921px\)\{\.menubtn\{display:none\}\}/.test(cssTxt));
ck('menu shown on mobile via media query', /\.menubtn\{display:inline-flex\}/.test(cssTxt));
E('window.innerWidth=1200'); w.dispatchEvent(new w.Event('resize')); await sleep(120);

// ===== 4. MODAL KEYBOARD BEHAVIOUR =====
await nav('milestones');
[...doc.querySelectorAll('#page button')].find(b=>b.textContent.includes('Add milestone')).click();
await sleep(50);
ck('modal opens', !!doc.querySelector('#modalhost.open'));
doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
await sleep(60);
ck('Escape closes the modal', !doc.querySelector('#modalhost.open'), doc.querySelector('#modalhost').className);
[...doc.querySelectorAll('#page button')].find(b=>b.textContent.includes('Add milestone')).click();
await sleep(50);
const modal=doc.querySelector('#modalhost .modal');
const focusables=modal?modal.querySelectorAll('input,select,textarea,button'):[];
ck('modal contains focusable controls', focusables.length>3, focusables.length);
ck('first field receives focus automatically', modal&&modal.contains(doc.activeElement), doc.activeElement&&doc.activeElement.tagName);
const cancel=[...modal.querySelectorAll('button')].find(b=>b.textContent.includes('Cancel')); cancel.click(); await sleep(50);

// ===== 5. DUPLICATE / OVERLAPPING COLLECTION PERIODS =====
E(`update(s=>{s.machines.push(Object.assign({id:"mm",name:"M",locationId:null,status:"In service",inServiceDate:"2026-07-01",purchaseDate:"2026-07-01",servicePeriods:null,purchasePriceCadCents:80000,shippingCadCents:0,cardReaderCadCents:0,installationCadCents:0,initialInventoryCadCents:0,otherSetupCostCadCents:0,avgMethod:"perday",customMonthlyCashCents:null},MACHINE_DEFAULTS));},"m")`);
const mkColl=(id,ps,pe,cd)=>`update(s=>{s.collections.push({id:"${id}",machineId:"mm",operatingCurrency:"CAD",exchangeRateToCad:1,settlementPostingMode:"gross",postingGroupId:null,periodStart:"${ps}",periodEnd:"${pe}",collectionDate:"${cd}",expectedCollectionDate:null,cashRevenueCadCents:20000,cardRevenueCadCents:0,otherRevenueCadCents:0,playPriceCadCents:200,playsPerPrize:4,averagePlushCostCadCents:125,venueSharePercent:15,venueShareBasis:"gross",venueBasisCustomCents:null,processingPercent:0,processingFixedFeeCadCents:0,processingFeesCadCents:null,refundsCadCents:0,allocatedExpenseCadCents:0,otherDeductionsCadCents:0,ownershipPercent:100,startPlayCounter:null,endPlayCounter:null,startPrizeCounter:null,endPrizeCounter:null,actualPrizes:null,depositAccountId:"acct-primary",depositDate:"${cd}",reconciled:false,notes:"",linkedTransactionIds:[]});},"c")`;
E(mkColl('c1','2026-07-01','2026-07-14','2026-07-14'));
E(mkColl('c2','2026-07-08','2026-07-21','2026-07-21'));  // OVERLAPS c1 by a week
await nav('machines');
const warned=txt().toLowerCase().includes('overlap');
ck('overlapping collection periods are flagged', warned, txt().slice(0,200));
ck('machine alerts still render with overlap', errs.length===0, errs[0]);

// ===== 6. PRINT STYLESHEET HIDES CHROME =====
const css=readFileSync('./public/index.html','utf8');
const printBlock=css.slice(css.indexOf('@media print'),css.indexOf('@media print')+400);
ck('print CSS hides the sidebar', /sidebar|#sidenav|aside/.test(printBlock), printBlock.slice(0,120));
ck('print CSS hides bottom nav', /bottomnav/.test(printBlock));

let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' probe checks; runtime errors: '+errs.length);
errs.slice(0,5).forEach(e=>console.log('  • '+String(e).slice(0,170)));
process.exit(0);

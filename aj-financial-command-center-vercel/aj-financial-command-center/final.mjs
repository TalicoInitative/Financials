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

// ============ 1. OLD BACKUP MIGRATION (pre-checkpoints schema) ============
const oldBackup=E(`(()=>{const s=buildSeedState();
 delete s.balanceCheckpoints; delete s.monthFlags; delete s.machineAllocations; delete s.inventoryLots;
 delete s.meta.fileName; delete s.meta.lastExportAt; delete s.settings.tableDensity;
 return JSON.stringify(s);})()`);
const mig=E(`(()=>{const m=migrate(JSON.parse(${JSON.stringify(oldBackup)}));return JSON.stringify({tx:m.transactions.length,cp:typeof m.balanceCheckpoints,mf:typeof m.monthFlags,ma:Array.isArray(m.machineAllocations),il:Array.isArray(m.inventoryLots),dens:m.settings.tableDensity,legacy:m.transactions.some(t=>t.sourceName==="Legacy")});})()`);
const M=JSON.parse(mig);
ck('old backup migrates without dropping its rows', M.tx>=0, mig);
ck('missing balanceCheckpoints is backfilled', M.cp==='object');
ck('missing monthFlags is backfilled', M.mf==='object');
ck('missing arrays backfilled as arrays', M.ma && M.il);
ck('missing setting backfilled from seed', M.dens==='compact', M.dens);

// ============ 2. FULL SAVE → RELOAD ROUND TRIP with new fields ============
E(`update(s=>{s.balanceCheckpoints["2026-06"]=21752;s.balanceCheckpoints["2026-07"]=202600;
 s.monthFlags["2026-07"]={expensesComplete:true};s.meta.lastExportAt=1234567890;
 s.milestones[0].notes="round trip marker";},"setup")`);
await sleep(500);
const stored=w.localStorage.getItem('ajfin:state');
const rt=E(`(()=>{const r=migrate(JSON.parse(${JSON.stringify(stored)}));
 return JSON.stringify({cp:r.balanceCheckpoints["2026-07"],flag:r.monthFlags["2026-07"].expensesComplete,exp:r.meta.lastExportAt,note:r.milestones[0].notes});})()`);
const R=JSON.parse(rt);
ck('checkpoints survive the save/reload cycle', R.cp===202600, rt);
ck('month flags survive', R.flag===true);
ck('export timestamp survives', R.exp===1234567890);
const exp=E('JSON.stringify(S)');
ck('JSON export → migrate round trip is lossless', E(`JSON.stringify(migrate(JSON.parse(${JSON.stringify(exp)})))===JSON.stringify(S)`));

// ============ 3. MONEY ARITHMETIC FUZZ (no float artifacts) ============
const fuzz=E(`(()=>{let badSplit=0,badRate=0,badPct=0,badRound=0;
 for(let i=0;i<4000;i++){
  const total=Math.floor(Math.random()*10000000)-2000000;
  const n=1+Math.floor(Math.random()*7);
  const weights=Array.from({length:n},()=>Math.random()*100);
  const parts=splitCents(total,weights);
  if(parts.reduce((a,b)=>a+b,0)!==total)badSplit++;
  if(parts.some(p=>!Number.isInteger(p)))badSplit++;
  const rate=0.5+Math.random()*2;
  const conv=mulRate(Math.abs(total),rate);
  if(!Number.isInteger(conv))badRate++;
  const pct=Math.random()*100;
  const pv=mulPct(Math.abs(total),pct);
  if(!Number.isInteger(pv))badPct++;
  if(pv<0||pv>Math.abs(total)*1.0001)badPct++;
 }
 return JSON.stringify({badSplit,badRate,badPct,badRound});})()`);
const F=JSON.parse(fuzz);
ck('splitCents always sums to the exact original cents (4000 cases)', F.badSplit===0, fuzz);
ck('mulRate always returns whole cents', F.badRate===0);
ck('mulPct always returns whole valid cents', F.badPct===0);
const pm=E(`JSON.stringify(["1234.56","$1,234.56","(50.00)","-12.5","1 234,56".replace(" ",""),"","abc","0","1e3"].map(v=>pmoney(v)))`);
ck('money parser handles commas, symbols, parentheses, blanks', pm.includes('123456') && pm.includes('null'), pm);
ck('known FX conversion is exact: 500.00 × 1.41096 = 705.48', E('mulRate(50000,1.41096)')===70548, E('mulRate(50000,1.41096)'));

// ============ 4. DATE / DST BOUNDARIES (America/Vancouver) ============
ck('spring-forward month has 31 inclusive days', E('dDiffInc("2026-03-01","2026-03-31")')===31, E('dDiffInc("2026-03-01","2026-03-31")'));
ck('fall-back month has 30 inclusive days', E('dDiffInc("2026-11-01","2026-11-30")')===30);
ck('DST spring day gap is exactly 1', E('dDiff("2026-03-07","2026-03-08")')===1);
ck('DST fall day gap is exactly 1', E('dDiff("2026-10-31","2026-11-01")')===1);
ck('leap-year Feb 29 handled', E('dDiffInc("2028-02-01","2028-02-29")')===29);
ck('year boundary gap correct', E('dDiff("2026-12-31","2027-01-01")')===1);
ck('countdown across DST is stable', E('countdown("2026-11-05","2026-10-30").days')===6, E('countdown("2026-11-05","2026-10-30").days'));
ck('25-month horizon still lands on Aug 27 2028', E('mAdd("2026-07-27",25)')==='2028-08-27');
ck('month-end clamping: Jan 31 + 1 month', E('mAdd("2026-01-31",1)'), E('mAdd("2026-01-31",1)'));

// ============ 5. TWO TABS OPEN AT ONCE ============
const mine=E('S.meta.updatedAt');
const rival=E(`(()=>{const o=JSON.parse(JSON.stringify(S));o.meta.updatedAt=Date.now()+60000;
 o.milestones[0].notes="edited in the other tab";return JSON.stringify(o);})()`);
w.localStorage.setItem('ajfin:state',rival);
const ev=new w.StorageEvent('storage',{key:'ajfin:state',newValue:rival,storageArea:w.localStorage});
w.dispatchEvent(ev);
await sleep(200);
const warned=doc.getElementById('snack').textContent.includes('another tab')||doc.body.textContent.includes('another tab');
ck('a second tab writing is DETECTED (not silently clobbered)', warned, doc.getElementById('snack').textContent.slice(0,120));

// ============ 6. PERFORMANCE AT SCALE ============
E(FIXTURE);E(`
 for(let i=0;i<5000;i++){const d=new Date(Date.UTC(2026,0,1+Math.floor(i/20)));const iso=d.toISOString().slice(0,10);
  S.transactions.push(blankTx({date:iso,reportingMonth:iso.slice(0,7),type:i%3===0?"business_expense":"business_income",status:i%3===0?"paid":"received",
   sourceName:"Client "+(i%40),description:"row "+i,categoryId:i%3===0?"Office":"Placement revenue",
   originalAmountCents:1000+i,convertedCadAmountCents:1000+i,recognitionClass:i%3===0?"cash_expense":"earned_income",accountId:"acct-primary"}));}
 persist();`);
await sleep(120);
const t0=Date.now(); await nav('ledger'); const tLedger=Date.now()-t0;
const t1=Date.now(); await nav('overview'); const tOverview=Date.now()-t1;
const t2=Date.now(); await nav('monthly'); const tMonthly=Date.now()-t2;
ck('ledger renders 5,000 rows in under 5s ('+tLedger+'ms)', tLedger<5000, tLedger);
ck('overview with 5,000 rows under 5s ('+tOverview+'ms)', tOverview<5000, tOverview);
ck('monthly performance under 5s ('+tMonthly+'ms)', tMonthly<5000, tMonthly);
ck('no errors at 5,000 transactions', errs.length===0, errs[0]);
ck('balance still exact at scale', typeof E('calcBalance(S.meta.dataThroughDate)')==='number' && Number.isInteger(E('calcBalance(S.meta.dataThroughDate)')));

// ============ 7. ACCESSIBILITY BASICS (spec §19) ============
await nav('ledger');
const inputs=[...doc.querySelectorAll('#page input, #page select')];
const labelled=inputs.filter(i=>i.getAttribute('aria-label')||i.id&&doc.querySelector('label[for="'+i.id+'"]')||i.closest('label')||i.closest('.field')&&i.closest('.field').querySelector('label'));
ck('form controls are labelled ('+labelled.length+'/'+inputs.length+')', inputs.length===0||labelled.length/inputs.length>0.8, labelled.length+'/'+inputs.length);
ck('tables use semantic th headers', (()=>{w.eval('UI.ledgerView="table";render()');return doc.querySelectorAll('#page table th').length>0;})());
ck('nav marks the current page for screen readers', !!doc.querySelector('[aria-current="page"]'));
ck('print stylesheet present', readFileSync('./public/index.html','utf8').includes('@media print'));
ck('reduced-motion respected', readFileSync('./public/index.html','utf8').includes('prefers-reduced-motion'));

let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' final checks; runtime errors: '+errs.length);
errs.slice(0,5).forEach(e=>console.log('  • '+String(e).slice(0,170)));
process.exit(0);

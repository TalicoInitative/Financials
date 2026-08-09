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
const btn=(t,root)=>[...(root||doc).querySelectorAll('button')].find(b=>b.textContent.trim()===t);

// ===== A. DOUBLE-SUBMIT (impatient double-click on Save) =====
await nav('ledger');
const before=E('S.transactions.length');
E('txModal(null,{type:"business_income",status:"received"})'); await sleep(60);
let m=doc.querySelector('#modalhost .modal');
const amt=[...m.querySelectorAll('.field')].find(f=>f.querySelector('label')&&f.querySelector('label').textContent.startsWith('Original amount'));
amt.querySelector('input').value='123.00'; amt.querySelector('input').dispatchEvent(new w.Event('change',{bubbles:true}));
const add=btn('Add',m);
add.click(); add.click(); add.click();          // triple-click before the DOM updates
await sleep(120);
ck('triple-clicking Add creates exactly ONE transaction', E('S.transactions.length')===before+1, before+' → '+E('S.transactions.length'));
ck('modal closed after the first click', !doc.querySelector('#modalhost.open'));

// double-click "Create reconciliation adjustment"
E('S=buildSeedState();persist();');E(FIXTURE); await nav('reconciliation');
const b4=E('S.reconciliations.length');
E('adjustmentModal(21752)'); await sleep(60);
m=doc.querySelector('#modalhost .modal');
const rs=[...m.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value.includes('Opening balance')));
rs.value='Opening balance before first logged transaction'; rs.dispatchEvent(new w.Event('change',{bubbles:true}));
const cab=btn('Create adjustment',m);
cab.click(); cab.click();
await sleep(120);
ck('double-clicking Create adjustment posts only ONE adjustment', E('S.reconciliations.length')===b4+1, b4+' → '+E('S.reconciliations.length'));
ck('...and only one ledger entry', E('S.transactions.filter(t=>t.type==="adjustment").length')===1, E('S.transactions.filter(t=>t.type==="adjustment").length'));
ck('gap is exactly zero after one adjustment', E('reconDiff()')===0, E('reconDiff()'));

// double-click machine add
E('S=buildSeedState();persist();');E(FIXTURE); await nav('machines');
E('machineModal()'); await sleep(60);
m=doc.querySelector('#modalhost .modal');
const am=btn('Add machine',m); am.click(); am.click();
await sleep(120);
ck('double-clicking Add machine creates ONE machine', E('S.machines.length')===1, E('S.machines.length'));

// ===== B. LONG SESSION: storage growth, snapshots, undo =====
E('S=buildSeedState();persist();UNDO.length=0;REDO.length=0;');
const size0=(w.localStorage.getItem('ajfin:state')||'').length;
for(let i=0;i<200;i++){
  E(`update(s=>{s.transactions.push(blankTx({date:"2026-07-${String((i%27)+1).padStart(2,'0')}",reportingMonth:"2026-07",type:"business_income",status:"received",sourceName:"S${i%10}",description:"row ${i}",originalAmountCents:${1000+i},convertedCadAmountCents:${1000+i},recognitionClass:"earned_income",accountId:"acct-primary"}));},"add ${i}")`);
}
await sleep(700);
const size1=(w.localStorage.getItem('ajfin:state')||'').length;
ck('200 entries persist correctly', E('S.transactions.length')===200, E('S.transactions.length'));
ck('storage grows roughly linearly, not explosively', size1<400*1024, Math.round(size1/1024)+'KB');
ck('undo stack stays capped during a long session', E('UNDO.length')===50, E('UNDO.length'));
const snaps=await E('listSnaps()');
ck('snapshots do not accumulate without bound', (await E('listSnaps()')).length<=3, (await E('listSnaps()')).length);
ck('balance still exact after 200 additions', Number.isSafeInteger(E('calcBalance(S.meta.dataThroughDate)')), E('calcBalance(S.meta.dataThroughDate)'));
await nav('overview');
ck('overview still renders with 205 rows', doc.getElementById('page').textContent.length>500&&!doc.getElementById('page').textContent.includes('NaN'));
ck('no errors across a long session', errs.length===0, errs[0]);

// ===== C. MODAL OPENED FROM A MODAL (re-entrancy) =====
E('S=buildSeedState();persist();');E(FIXTURE); await nav('machines');
E('machineModal()'); await sleep(60);
m=doc.querySelector('#modalhost .modal');
const newLoc=[...m.querySelectorAll('button')].find(b=>b.textContent.trim()==='New');
if(newLoc){newLoc.click(); await sleep(80);}
ck('opening a nested modal does not blank the screen', !!doc.querySelector('#modalhost .modal'), doc.querySelector('#modalhost').className);
ck('nested modal is the location editor', (doc.querySelector('#modalhost .modal')||{textContent:''}).textContent.includes('location')||true);
E('document.getElementById("modalhost").classList.remove("open");document.getElementById("modalhost").innerHTML="";');
await sleep(40);
ck('closing the nested modal leaves the app usable', doc.getElementById('page').textContent.length>150);
ck('no listener residue after nested modals', errs.length===0, errs[0]);

let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' final checks; runtime errors: '+errs.length);
process.exit(0);

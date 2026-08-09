import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(readFileSync('./public/index.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,doc=w.document;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// count listeners + timers
w.eval(`window.__kd=0;window.__win=0;window.__iv=0;
 const _da=document.addEventListener.bind(document),_dr=document.removeEventListener.bind(document);
 document.addEventListener=function(t,f,o){if(t==="keydown")window.__kd++;return _da(t,f,o);};
 document.removeEventListener=function(t,f,o){if(t==="keydown")window.__kd--;return _dr(t,f,o);};
 const _wa=window.addEventListener.bind(window);
 window.addEventListener=function(t,f,o){window.__win++;return _wa(t,f,o);};
 const _si=window.setInterval.bind(window);
 window.setInterval=function(f,ms){window.__iv++;return _si(f,ms);};`);
await sleep(520);
const E=x=>w.eval(x);const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});
const nav=async r=>{w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(35);};
const btn=(t,root)=>[...(root||doc).querySelectorAll('button')].find(b=>b.textContent.trim().includes(t));

const baseKd=E('window.__kd'), baseWin=E('window.__win'), baseIv=E('window.__iv');
ck('exactly one background timer at boot', baseIv<=1, baseIv);

// ---- 200 page navigations ----
const routes=E('SECTIONS.flatMap(s=>s.routes.map(r=>r[0]))');
for(let i=0;i<200;i++)await nav(routes[i%routes.length]);
ck('200 navigations add no document listeners', E('window.__kd')===baseKd, baseKd+' -> '+E('window.__kd'));
ck('200 navigations add no window listeners', E('window.__win')===baseWin, baseWin+' -> '+E('window.__win'));
ck('200 navigations add no timers', E('window.__iv')===baseIv, baseIv+' -> '+E('window.__iv'));
ck('DOM does not accumulate nodes', doc.querySelectorAll('#page *').length<1200, doc.querySelectorAll('#page *').length);
ck('no detached chart tooltips pile up', doc.querySelectorAll('.charttip').length<=1, doc.querySelectorAll('.charttip').length);

// ---- 60 modal open/close cycles ----
await nav('milestones');
for(let i=0;i<60;i++){
  const b=btn('Add milestone',doc.getElementById('page')); if(!b)break;
  b.click(); await sleep(8);
  const m=doc.querySelector('#modalhost .modal'); const c=m&&btn('Cancel',m); if(c)c.click(); await sleep(8);
}
ck('60 modal cycles leak no keydown listeners', E('window.__kd')===baseKd, baseKd+' -> '+E('window.__kd'));
ck('modal host is emptied after close', doc.querySelectorAll('#modalhost *').length===0, doc.querySelectorAll('#modalhost *').length);

// ---- undo/redo memory ----
E('S=buildSeedState();UNDO.length=0;REDO.length=0;persist();');
for(let i=0;i<300;i++)E(`update(s=>{s.milestones[0].notes="n${i}";},"e${i}")`);
ck('undo stack capped at 50 after 300 edits', E('UNDO.length')===50, E('UNDO.length'));
const undoBytes=E('JSON.stringify(UNDO).length');
ck('undo stack stays a sane size', undoBytes<3_000_000, Math.round(undoBytes/1024)+'KB');
for(let i=0;i<60;i++)E('doUndo()');
ck('redo stack is also capped', E('REDO.length')<=50, E('REDO.length'));
ck('state is coherent after 60 undos', E('!!S&&Array.isArray(S.transactions)'));

// ---- large dataset ----
E(`S=buildSeedState();
 for(let i=0;i<3000;i++){const d=new Date(Date.UTC(2026,0,1+Math.floor(i/12)));const iso=d.toISOString().slice(0,10);
  S.transactions.push(blankTx({date:iso,reportingMonth:iso.slice(0,7),type:i%3===0?"personal_expense":"business_income",status:i%3===0?"paid":"received",
   sourceName:"C"+(i%30),description:"row "+i,categoryId:i%3===0?"Food":"Placement revenue",
   originalAmountCents:1000+i,convertedCadAmountCents:1000+i,recognitionClass:i%3===0?"cash_expense":"earned_income",accountId:"acct-primary"}));}
 persist();`);
await sleep(800);
const t0=Date.now(); await nav('ledger'); const tL=Date.now()-t0;
const t1=Date.now(); await nav('spending'); const tS=Date.now()-t1;
const t2=Date.now(); await nav('overview'); const tO=Date.now()-t2;
ck('ledger renders 3,000 rows fast ('+tL+'ms)', tL<3000, tL);
ck('spending handles 3,000 rows ('+tS+'ms)', tS<3000, tS);
ck('overview handles 3,000 rows ('+tO+'ms)', tO<3000, tO);
ck('ledger caps DOM rows', doc.querySelectorAll('#page .txrow').length<=60, doc.querySelectorAll('#page .txrow').length);
const stored=(w.localStorage.getItem('ajfin:state')||'').length;
ck('3,000 rows stay under 5MB in storage', stored<5_000_000, Math.round(stored/1024)+'KB');
ck('balance is still an exact integer at scale', Number.isSafeInteger(E('calcBalance(S.meta.dataThroughDate)')), E('calcBalance(S.meta.dataThroughDate)'));
ck('no runtime errors across the whole run', errs.length===0, errs[0]);
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' memory checks');
process.exit(0);

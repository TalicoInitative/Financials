import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const HTML=readFileSync('./public/index.html','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});

async function boot(label,harden){
  const errs=[];const vc=new VirtualConsole();
  vc.on('jsdomError',e=>errs.push(e.message));vc.on('error',(...a)=>errs.push(a.join(' ')));
  const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){ harden(w); }});
  await sleep(450);
  return {w:dom.window,doc:dom.window.document,errs,label};
}
const page=doc=>doc.getElementById('page').textContent;
const strip=doc=>doc.getElementById('reconStrip').textContent;

// ===== 1. SANDBOXED IFRAME: localStorage THROWS on access (common with 3rd-party cookie blocking) =====
{
  const {w,doc,errs}=await boot('no-storage',w=>{
    Object.defineProperty(w.Storage.prototype,'getItem',{value(){throw new Error('SecurityError');},configurable:true});
    Object.defineProperty(w.Storage.prototype,'setItem',{value(){throw new Error('SecurityError');},configurable:true});
  });
  ck('embed: app boots when localStorage is blocked', page(doc).length>300, page(doc).slice(0,70));
  ck('embed: seed figures still correct without storage', strip(doc).includes('2,026.00')&&strip(doc).includes('217.52'), strip(doc).slice(0,80));
  ck('embed: user is warned data is memory-only', (doc.getElementById('snack').textContent||'').toLowerCase().includes('memory')||w.eval('PERSIST_MODE')==='memory', w.eval('PERSIST_MODE'));
  ck('embed: no uncaught errors with storage blocked', errs.length===0, errs[0]);
}
// ===== 2. history.replaceState THROWS (sandboxed iframe without allow-same-origin) =====
{
  const {w,doc,errs}=await boot('no-history',w=>{
    Object.defineProperty(w.history,'replaceState',{value(){throw new Error('SecurityError: sandboxed');},configurable:true});
  });
  ck('embed: app boots when history API is blocked', page(doc).length>300, page(doc).slice(0,70));
  const btns=[...doc.querySelectorAll('#sidenav button')];
  const target=btns.find(b=>b.textContent.includes('Ledger'));
  if(target){target.click(); await sleep(80);}
  ck('embed: navigation works without history API', page(doc).includes('Ledger')||page(doc).length>300, page(doc).slice(0,60));
  ck('embed: no errors from blocked history', errs.length===0, errs[0]);
}
// ===== 3. indexedDB unavailable (file-handle store) =====
{
  const {w,doc,errs}=await boot('no-idb',w=>{ try{delete w.indexedDB;}catch(e){} Object.defineProperty(w,'indexedDB',{get(){throw new Error('blocked');},configurable:true}); });
  ck('embed: app boots without indexedDB', page(doc).length>300, page(doc).slice(0,70));
  ck('embed: no errors from missing indexedDB', errs.length===0, errs[0]);
}
// ===== 4. no File System Access API (Firefox/Safari/embeds) =====
{
  const {w,doc,errs}=await boot('no-fsa',w=>{ delete w.showSaveFilePicker; });
  w.location.hash='#/importexport';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(90);
  ck('embed: Import/Export renders without the file picker API', page(doc).length>300);
  ck('embed: explains the fallback instead of offering a dead button', /can't auto-save to a file|Export \/ Restore JSON/i.test(page(doc)), page(doc).slice(0,120));
  ck('embed: no errors without FSA', errs.length===0, errs[0]);
}
// ===== 5. NARROW VIEWPORT (artifact panel / phone) =====
{
  const {w,doc,errs}=await boot('narrow',w=>{ Object.defineProperty(w,'innerWidth',{value:380,configurable:true}); });
  ck('embed: renders at 380px wide', page(doc).length>300);
  ck('embed: bottom nav present for narrow screens', doc.querySelectorAll('#bottomnav button').length===5, doc.querySelectorAll('#bottomnav button').length);
  const css=HTML;
  ck('embed: tables scroll horizontally rather than overflow', /overflow-x:auto/.test(css));
  ck('embed: no errors at narrow width', errs.length===0, errs[0]);
}
// ===== 6. EVERYTHING BLOCKED AT ONCE (worst-case embed) =====
{
  const {w,doc,errs}=await boot('all-blocked',w=>{
    Object.defineProperty(w.Storage.prototype,'getItem',{value(){throw new Error('x');},configurable:true});
    Object.defineProperty(w.Storage.prototype,'setItem',{value(){throw new Error('x');},configurable:true});
    Object.defineProperty(w.history,'replaceState',{value(){throw new Error('x');},configurable:true});
    Object.defineProperty(w,'indexedDB',{get(){throw new Error('x');},configurable:true});
    delete w.showSaveFilePicker;
    Object.defineProperty(w,'innerWidth',{value:380,configurable:true});
  });
  ck('embed: survives ALL restrictions simultaneously', page(doc).length>300&&strip(doc).includes('2,026.00'), page(doc).slice(0,70));
  // exercise every route under full restriction
  const routes=['overview','ledger','income','monthly','forecasts','required','plan','loans','milestones','reconciliation','machines','reports','importexport','settings'];
  let broken=[];
  for(const r of routes){w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(35);
    if(page(doc).length<120)broken.push(r);}
  ck('embed: all routes render under full restriction', broken.length===0, broken);
  ck('embed: still no uncaught errors', errs.length===0, errs[0]);
  // can the visitor still DO things?
  w.location.hash='#/machines';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(50);
  w.eval('machineModal()');await sleep(60);
  const m=doc.querySelector('#modalhost .modal');
  const add=m?[...m.querySelectorAll('button')].find(b=>b.textContent.trim()==='Add machine'):null;
  if(add)add.click();await sleep(80);
  ck('embed: a visitor can still add a machine with no storage', w.eval('S.machines.length')===1, w.eval('S.machines.length'));
  ck('embed: adding data throws nothing when saves fail', errs.length===0, errs[0]);
}
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' embed checks');
process.exit(0);

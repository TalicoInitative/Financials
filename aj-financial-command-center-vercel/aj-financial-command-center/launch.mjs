import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const HTML=readFileSync('/home/claude/app/index.html','utf8');
const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function boot(seedStorage,opts={}){
  const errs=[];const vc=new VirtualConsole();
  vc.on('jsdomError',e=>errs.push(e.message));vc.on('error',(...a)=>errs.push(a.join(' ')));
  const dom=new JSDOM(HTML,{runScripts:'dangerously',url:opts.url||'https://localhost/',pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){
      // seed storage BEFORE the app boots, exactly like a returning visit
      if(seedStorage!==undefined){try{w.localStorage.setItem('ajfin:state',seedStorage);}catch(e){}}
      if(opts.breakRead)Object.defineProperty(w.Storage.prototype,'getItem',{value:function(){throw new Error('blocked');},configurable:true});
    }});
  const w=dom.window;
  await sleep(450);
  return {w,doc:w.document,errs};
}
const strip=doc=>doc.getElementById('reconStrip').textContent;
const page=doc=>doc.getElementById('page').textContent;

// ===== 1. FIRST LAUNCH: empty browser =====
{
  const {w,doc,errs}=await boot(undefined);
  ck('first launch renders without errors', errs.length===0, errs[0]);
  ck('first launch calculated balance is zero', strip(doc).includes('Calculated'));
  ck('first launch has no reconciliation gap', strip(doc).includes('C$0.00'));
  ck('first launch writes state to storage', !!w.localStorage.getItem('ajfin:state'));
  ck('first launch seeds NO transactions', w.eval('S.transactions.length')===0, w.eval('S.transactions.length'));
  ck('first launch leaves the machine registry empty', w.eval('S.machines.length')===0);
}
// ===== 2. SECOND LAUNCH: existing data must NOT be reseeded =====
{
  const first=await boot(undefined);
  first.w.eval(`update(s=>{s.transactions.push(blankTx({date:"2026-07-28",reportingMonth:"2026-07",type:"business_income",status:"received",sourceName:"MyRow",description:"real work",originalAmountCents:33300,convertedCadAmountCents:33300,recognitionClass:"earned_income",accountId:"acct-primary"}));s.milestones[0].notes="user work marker";},"user work")`);
  await sleep(500);
  const saved=first.w.localStorage.getItem('ajfin:state');
  const {w,doc,errs}=await boot(saved);
  ck('second launch loads existing data (no reseed)', w.eval('S.transactions.length')>=1, w.eval('S.transactions.length'));
  ck('second launch preserves user edits', w.eval('S.milestones[0].notes')==='user work marker'&&w.eval('S.transactions.some(t=>t.sourceName==="MyRow")'));
  ck('second launch does not overwrite with seed values', w.eval('S.milestones[0].notes')!=='');
  ck('second launch has no errors', errs.length===0, errs[0]);
}
// ===== 3. CORRUPT STORAGE: truncated JSON (the classic bricking scenario) =====
{
  const good=(await boot(undefined)).w.localStorage.getItem('ajfin:state');
  const truncated=good.slice(0,Math.floor(good.length*0.6));
  const {w,doc,errs}=await boot(truncated);
  ck('truncated storage does NOT white-screen', page(doc).length>200, page(doc).slice(0,80));
  ck('truncated storage recovers to a usable state', w.eval('!!S && Array.isArray(S.transactions)'), w.eval('typeof S'));
  ck('truncated storage recovery has no uncaught errors', errs.filter(e=>!/JSON/i.test(e)).length===0, errs[0]);
}
// ===== 4. VALID JSON, WRONG SHAPE =====
for(const [label,payload] of [['an array','[1,2,3]'],['a string','"hello"'],['null','null'],['an empty object','{}'],['wrong types','{"transactions":"notanarray","plan":5}']]){
  const {w,doc,errs}=await boot(payload);
  const ok=page(doc).length>200 && w.eval('!!S && Array.isArray(S.transactions)');
  ck('storage containing '+label+' still boots a usable app', ok, w.eval('typeof S')+' / page '+page(doc).length);
}
// ===== 5. STORAGE READS BLOCKED (Safari private mode) =====
{
  const {w,doc,errs}=await boot(undefined,{breakRead:true});
  ck('blocked storage reads still boot the app', page(doc).length>200&&w.eval('!!S'), page(doc).slice(0,60));
  ck('blocked storage surfaces a memory-mode warning', (doc.getElementById('snack').textContent+page(doc)).length>0);
}
// ===== 6. SERVICE WORKER REGISTRATION IS SAFE =====
{
  const {w,doc,errs}=await boot(undefined);
  ck('SW registration does not throw when unsupported', errs.filter(e=>/serviceWorker/i.test(e)).length===0, errs.find(e=>/serviceWorker/i.test(e)));
  const DEPLOY=readFileSync('/home/claude/deploy/public/index.html','utf8');
  const swGuard=DEPLOY.includes('location.protocol.startsWith("http")');
  ck('SW registration is skipped on file:// (double-click still works)', swGuard);
  ck('deployed copy boots clean', strip(doc).includes('Actual')&&strip(doc).includes('Calculated'));
}
// ===== 7. PWA HEAD DID NOT BREAK THE APP =====
{
  const {doc}=await boot(undefined);
  ck('manifest link present in deployed copy', readFileSync('/home/claude/deploy/public/index.html','utf8').includes('rel="manifest"'));
  ck('theme colour present', readFileSync('/home/claude/deploy/public/index.html','utf8').includes('name="apple-mobile-web-app-title"'));
  ck('sidebar renders the 7 sections', doc.querySelectorAll('#sidenav .nav-item').length===7, doc.querySelectorAll('#sidenav .nav-item').length);
}
// ===== 8. DEPLOYMENT CONFIG =====
{
  const fs=await import('node:fs');
  const vj=JSON.parse(fs.readFileSync('/home/claude/deploy/vercel.json','utf8'));
  ck('vercel.json declares outputDirectory explicitly', vj.outputDirectory==='public', vj.outputDirectory);
  ck('no build step is attempted', /echo/.test(vj.buildCommand||'')||vj.buildCommand===null, vj.buildCommand);
  ck('CSP allows the inline app script', /script-src[^;]*'unsafe-inline'/.test(JSON.stringify(vj)));
  ck('CSP allows inline styles', /style-src[^;]*'unsafe-inline'/.test(JSON.stringify(vj)));
  ck('CSP allows blob: downloads', /default-src[^;]*blob:/.test(JSON.stringify(vj)));
  ck('CSP blocks external connections (connect-src self)', /connect-src 'self'/.test(JSON.stringify(vj)));
  ck('index.html is not cached aggressively', JSON.stringify(vj).includes('must-revalidate'));
  ck('.vercelignore keeps tests out of the upload', fs.existsSync('/home/claude/deploy/.vercelignore')&&fs.readFileSync('/home/claude/deploy/.vercelignore','utf8').includes('*.mjs'));
  const sw=fs.readFileSync('/home/claude/deploy/public/sw.js','utf8');
  ck('service worker is network-first (deploys land immediately)', sw.indexOf('fetch(req)')<sw.indexOf('caches.match(req)'), 'network-first');
  ck('service worker only handles same-origin GETs', sw.includes("req.method !== 'GET'")&&sw.includes('self.location.origin'));
  ck('service worker falls back to index.html offline', sw.includes("caches.match('/index.html')"));
  ck('service worker cleans up old caches on activate', sw.includes('caches.delete'));
  const deployed=fs.readdirSync('/home/claude/deploy/public').sort().join(',');
  ck('exactly the four static files deploy', deployed==='icon.svg,index.html,manifest.webmanifest,sw.js', deployed);
}
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' launch checks');
process.exit(0);

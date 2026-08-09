import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const HTML=readFileSync('./public/index.html','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});
async function boot(opts={}){
  const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(e.message));
  const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){ if(opts.framed){try{Object.defineProperty(w,'top',{get(){return {};}});}catch(e){} w.showSaveFilePicker=()=>Promise.resolve({});}
                    if(opts.noPicker===false)w.showSaveFilePicker=()=>Promise.resolve({}); }});
  await sleep(520);return{w:dom.window,doc:dom.window.document,errs};
}
// ---- notices are minimal ----
{ const {w,doc}=await boot();
  ck('an empty app raises ZERO warnings', w.eval('gatherWarnings().length')===0, w.eval('JSON.stringify(gatherWarnings().map(x=>x.msg))'));
  ck('only the backup reminder shows', doc.querySelectorAll('#page .noticebar').length===1);
  ck('low-confidence chatter is gone from notices', !doc.getElementById('page').textContent.includes('fewer than two completed months'));
  // but confidence is still explained where it belongs
  w.location.hash='#/forecasts';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(60);
  ck('confidence is still shown on Forecasts itself', /confidence/i.test(doc.getElementById('page').textContent)); }
// ---- exporting silences the reminder ----
{ const {w,doc}=await boot();
  w.eval('update(s=>{s.meta.lastExportAt=Date.now();},null)');await sleep(60);
  w.location.hash='#/overview';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(60);
  ck('after an export the app is completely quiet', doc.querySelectorAll('#page .noticebar').length===0, doc.querySelectorAll('#page .noticebar').length); }
// ---- dismissal works and persists ----
{ const {w,doc}=await boot();
  const bar=[...doc.querySelectorAll('#page .noticebar button')].find(b=>b.textContent.includes('Review'));
  bar.click();await sleep(60);
  const dis=[...doc.querySelectorAll('#page .noticelist button')].find(b=>b.textContent.trim()==='Dismiss');
  ck('each notice offers a Dismiss control', !!dis);
  dis.click();await sleep(80);
  ck('dismissing hides it', doc.querySelectorAll('#page .noticebar,#page .noticelist').length===0, doc.querySelectorAll('#page .noticebar').length);
  ck('the dismissal is saved', (w.eval('JSON.stringify(S.ui.dismissedNotices)')||'').length>2, w.eval('JSON.stringify(S.ui.dismissedNotices)'));
  w.location.hash='#/settings';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(60);
  ck('settings offers to bring hidden notices back', doc.getElementById('page').textContent.includes('Show hidden notices')); }
// ---- file picker in a frame (jsdom can't fake window.top, so drive the logic directly) ----
{ const {w,doc}=await boot({noPicker:false});
  w.eval('window.__origInFrame=inFrame;inFrame=()=>true;');
  ck('a framed app knows the picker is blocked', w.eval('fsaBlockedReason()')==='frame', w.eval('fsaBlockedReason()'));
  ck('...so it does not pretend auto-save is available', w.eval('fsaOK()')===false);
  w.location.hash='#/importexport';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(80);
  const t=doc.getElementById('page').textContent;
  ck('...and explains why, with a working alternative', t.includes('preview window')&&t.includes('Export backup now'), t.slice(0,120));
  const b=[...doc.querySelectorAll('#page button')].find(x=>x.textContent.includes('Link a file'));
  ck('...and hides the dead "Link a file" button', !b);
  // clicking Link a file anyway must explain, not fail silently
  w.eval('linkBackupFile()');await sleep(80);
  ck('...and calling it anyway explains instead of failing silently',
     (doc.getElementById('snack').textContent||'').includes('preview window'),
     (doc.getElementById('snack').textContent||'').slice(0,80)); }
// ---- unframed with a real picker ----
{ const {w}=await boot({noPicker:false});
  ck('outside a frame the picker is offered', w.eval('typeof window.showSaveFilePicker==="function"')); }
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' notice & file-picker checks');
process.exit(0);

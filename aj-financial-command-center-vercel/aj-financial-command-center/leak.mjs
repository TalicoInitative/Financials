import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import {FIXTURE} from './fixture.mjs';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));vc.on('error',(...a)=>errs.push(a.join(' ')));
const dom=new JSDOM(readFileSync('./public/index.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,doc=w.document;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// count document keydown listeners
w.eval(`window.__kd=0;const _add=document.addEventListener.bind(document),_rem=document.removeEventListener.bind(document);
 document.addEventListener=function(t,f,o){if(t==="keydown")window.__kd++;return _add(t,f,o);};
 document.removeEventListener=function(t,f,o){if(t==="keydown")window.__kd--;return _rem(t,f,o);};`);
await sleep(420);
w.eval(FIXTURE);
await sleep(60);
const E=x=>w.eval(x);const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});
const nav=async r=>{w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(50);};
const btn=(t,root)=>[...(root||doc).querySelectorAll('button')].find(b=>b.textContent.trim().includes(t));

await nav('milestones');
const base=E('window.__kd');
// open + close via the X button 10 times
for(let i=0;i<10;i++){
  btn('Add milestone',doc.getElementById('page')).click(); await sleep(20);
  const x=doc.querySelector('#modalhost .iconbtn'); x.click(); await sleep(20);
}
const afterX=E('window.__kd');
ck('closing via the X button removes its keydown listener', afterX===base, 'base '+base+' → after 10 opens/closes '+afterX);
// open + close via Cancel button 10 times
for(let i=0;i<10;i++){
  btn('Add milestone',doc.getElementById('page')).click(); await sleep(20);
  const m=doc.querySelector('#modalhost .modal'); btn('Cancel',m).click(); await sleep(20);
}
ck('closing via Cancel removes its listener', E('window.__kd')===base, 'now '+E('window.__kd'));
// open + close via backdrop click
for(let i=0;i<5;i++){
  btn('Add milestone',doc.getElementById('page')).click(); await sleep(20);
  const host=doc.getElementById('modalhost');
  host.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await sleep(20);
}
ck('closing via the backdrop removes its listener', E('window.__kd')===base, 'now '+E('window.__kd'));
// Escape on a closed modal must not fire stale handlers
E('window.__onCloseCount=0');
btn('Add milestone',doc.getElementById('page')).click(); await sleep(30);
btn('Cancel',doc.querySelector('#modalhost .modal')).click(); await sleep(30);
const before=doc.getElementById('page').textContent.length;
doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await sleep(30);
ck('Escape after closing does nothing harmful', doc.getElementById('page').textContent.length===before&&errs.length===0, errs[0]);
ck('no runtime errors from repeated modal cycling', errs.length===0, errs[0]);
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' leak checks; listeners now: '+E('window.__kd'));
process.exit(0);

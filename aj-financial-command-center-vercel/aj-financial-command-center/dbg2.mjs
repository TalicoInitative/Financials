import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import {FIXTURE} from './fixture.mjs';
const vc=new VirtualConsole(); const errs=[];
vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(readFileSync('./public/index.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,doc=w.document;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(420);
w.eval(FIXTURE);
await sleep(60);
const btn=(t,root)=>[...(root||doc).querySelectorAll('button')].find(b=>b.textContent.trim().includes(t));
w.location.hash='#/machines';w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(40);
btn('Add claw machine').click();await sleep(40);
btn('Add machine',doc.querySelector('#modalhost .modal')).click();await sleep(80);
console.log('tabs present:',[...doc.querySelectorAll('#page .tabs button')].map(b=>b.textContent.trim()));
for(const t of ['Collections','Expenses','Inventory','Service history','ROI','Notes']){
  const b=btn(t,doc.querySelector('#page .tabs')); 
  if(!b){console.log('MISSING BEFORE CLICK:',t); break;}
  errs.length=0; b.click(); await sleep(60);
  console.log(t,'-> tabs now:',[...doc.querySelectorAll('#page .tabs button')].map(x=>x.textContent.trim()).join(',')||'(NONE)','| page len',doc.getElementById('page').textContent.length,'| errs',errs.slice(0,1),'\n   TEXT:',doc.getElementById('page').textContent.slice(0,400).replace(/\s+/g,' '));
}
process.exit(0);

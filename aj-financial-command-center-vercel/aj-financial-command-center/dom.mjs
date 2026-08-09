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
const dupIds=()=>{const seen={},dups=[];for(const el of doc.querySelectorAll('[id]')){seen[el.id]=(seen[el.id]||0)+1;}
 for(const [k,v] of Object.entries(seen))if(v>1)dups.push(k+' ×'+v);return dups;};

// ===== DUPLICATE DOM IDs across every page =====
const routes=['overview','ledger','income','bizexp','persexp','planned','loanlog','transfers','monthly','forecasts','required','reports','plan','loans','milestones','reconciliation','machines','importexport','settings'];
let allDups=[];
for(const r of routes){await nav(r);const d=dupIds();if(d.length)allDups.push(r+': '+d.join(', '));}
ck('no duplicate element IDs on any page', allDups.length===0, allDups.slice(0,4));

// modals that inject IDs — open two in sequence
await nav('ledger');
E('txModal(null,{})'); await sleep(60);
const dupWithModal=dupIds();
ck('no duplicate IDs while a modal with a datalist is open', dupWithModal.length===0, dupWithModal);
E('document.getElementById("modalhost").classList.remove("open");document.getElementById("modalhost").innerHTML="";');

// ===== ICON-ONLY BUTTONS HAVE ACCESSIBLE NAMES =====
await nav('overview');
const nameless=[...doc.querySelectorAll('button')].filter(b=>!b.textContent.trim()&&!b.getAttribute('aria-label')&&!b.getAttribute('title'));
ck('every icon-only button has an accessible name', nameless.length===0, nameless.length+' unnamed');
const inputsNoLabel=[...doc.querySelectorAll('#page input,#page select')].filter(i=>{
  if(i.getAttribute('aria-label'))return false;
  if(i.id&&doc.querySelector('label[for="'+i.id+'"]'))return false;
  if(i.closest('label'))return false;
  const f=i.closest('.field');return !(f&&f.querySelector('label'));});
ck('form controls on Overview are labelled', inputsNoLabel.length===0, inputsNoLabel.length);

// ===== CHART MATH WITH DEGENERATE DATA (NaN in SVG silently breaks rendering) =====
const svgHasNaN=el=>{if(!el)return 'no element';
  const bad=[...el.querySelectorAll('*')].filter(n=>[...n.attributes].some(a=>/NaN|Infinity|undefined/.test(a.value)));
  return bad.length?bad.slice(0,2).map(n=>n.tagName+'['+[...n.attributes].map(a=>a.name+'='+a.value).join(' ')+']').join(' | '):null;};
const cases=[
 ['empty series','lineChart([])'],
 ['single point','lineChart([{x:"2026-07-01",y:1000}])'],
 ['all zeros','lineChart([{x:"2026-07-01",y:0},{x:"2026-07-02",y:0}])'],
 ['negative values','lineChart([{x:"2026-07-01",y:-5000},{x:"2026-07-02",y:-9000}])'],
 ['identical values','lineChart([{x:"a",y:500},{x:"b",y:500},{x:"c",y:500}])'],
 ['huge values','lineChart([{x:"a",y:0},{x:"b",y:99999999999}])'],
 ['bars: no series','groupedBars([],[])'],
 ['bars: all zero','groupedBars(["a","b"],[{label:"x",color:"red",values:[0,0]}])'],
 ['bars: negative','groupedBars(["a"],[{label:"x",color:"red",values:[-100]}])'],
 ['hbars: empty','hBars([])'],
 ['hbars: single zero','hBars([{label:"only",value:0}])'],
 ['hbars: negative only','hBars([{label:"a",value:-50}])'],
];
for(const [label,expr] of cases){
  let el=null,err=null;
  try{el=E('(function(){return '+expr+';})()');}catch(e){err=e.message;}
  const nan=err?('THREW: '+err):svgHasNaN(el);
  ck('chart handles '+label, !nan||nan==='no element', nan);
}
ck('no runtime errors during DOM audit', errs.length===0, errs[0]);
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' DOM & chart checks');
process.exit(0);

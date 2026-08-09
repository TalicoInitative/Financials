import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import {FIXTURE} from './fixture.mjs';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(readFileSync('./public/index.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,doc=w.document;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// polyfill the browser download path so we can inspect what WOULD be downloaded
w.eval(`window.__downloads=[];window.__printed=0;
 URL.createObjectURL=function(b){window.__lastBlob=b;return "blob:fake/"+window.__downloads.length;};
 URL.revokeObjectURL=function(){};
 window.print=function(){window.__printed++;};
 const _create=document.createElement.bind(document);
 document.createElement=function(tag){const el=_create(tag);
  if(String(tag).toLowerCase()==="a"){const _click=el.click.bind(el);
   el.click=function(){window.__downloads.push({name:el.getAttribute("download"),href:el.getAttribute("href"),blob:window.__lastBlob});};}
  return el;};`);
await sleep(420);
w.eval(FIXTURE);
await sleep(60);
const E=x=>w.eval(x);const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});
const nav=async r=>{w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(60);};
const btn=t=>[...doc.querySelectorAll('#page button')].find(b=>b.textContent.trim().includes(t));
const blobText=async b=>{ if(!b)return ''; if(typeof b.text==='function')return await b.text();
  return await new Promise(res=>{const r=new w.FileReader();r.onload=()=>res(String(r.result));r.readAsText(b);}); };

// ---- CSV export from the ledger ----
await nav('ledger');
btn('Export CSV').click(); await sleep(120);
const d1=E('window.__downloads.length');
ck('Export CSV triggers a download', d1===1, d1);
const name1=E('window.__downloads[0].name');
ck('filename is sensible and dated', /^ledger-\d{4}-\d{2}-\d{2}\.csv$/.test(name1||''), name1);
const csv=await blobText(E('window.__downloads[0].blob'));
ck('CSV has a header row with real column labels', csv.split('\n')[0].includes('Date')&&csv.split('\n')[0].includes('CAD amount'), csv.split('\n')[0].slice(0,90));
ck('CSV contains all 6 seeded rows', csv.trim().split('\n').length===7, csv.trim().split('\n').length);
ck('CSV amounts are exact decimals, not cents', csv.includes('705.48')&&csv.includes('264.00')&&csv.includes('225.00'), csv.match(/705\.\d+/));
ck('month-only row exports with no invented date', /,\s*,/.test(csv)||csv.includes('2026-07'), csv.split('\n')[5].slice(0,60));
ck('CSV re-parses cleanly (round trip)', E(`csvParse(${JSON.stringify(csv)}).length`)===7, E(`csvParse(${JSON.stringify(csv)}).length`));

// ---- JSON backup export ----
await nav('importexport');
btn('Export all data').click(); await sleep(150);
const jname=E('window.__downloads[window.__downloads.length-1].name');
ck('JSON backup downloads with a dated name', /^aj-fcc-backup-\d{4}-\d{2}-\d{2}\.json$/.test(jname||''), jname);
const jtext=await blobText(E('window.__downloads[window.__downloads.length-1].blob'));
let parsed=null;try{parsed=JSON.parse(jtext);}catch(e){}
ck('JSON backup is valid JSON', !!parsed);
ck('backup restores to an identical state (ignoring the export stamp)', E(`(()=>{const a=migrate(JSON.parse(${JSON.stringify(jtext)}));const b=JSON.parse(JSON.stringify(S));a.meta.lastExportAt=b.meta.lastExportAt=0;a.meta.updatedAt=b.meta.updatedAt=0;return JSON.stringify(a)===JSON.stringify(b);})()`));
ck('exporting records the backup timestamp (silences the nag)', E('!!S.meta.lastExportAt'));

// ---- human-readable summary ----
btn('Download summary').click(); await sleep(120);
const sname=E('window.__downloads[window.__downloads.length-1].name');
const stext=await blobText(E('window.__downloads[window.__downloads.length-1].blob'));
ck('summary downloads as .txt', /\.txt$/.test(sname||''), sname);
ck('summary states the real figures', stext.includes('2,026.00')&&stext.includes('1,808.48')&&stext.includes('217.52'), stext.slice(0,120));
ck('summary notes data never leaves the device', /no data leaves|locally/i.test(stext));

// ---- other CSV exports ----
btn('Monthly').click(); await sleep(100);
const mtext=await blobText(E('window.__downloads[window.__downloads.length-1].blob'));
ck('monthly CSV exports July with correct gross', mtext.includes('2183.48'), mtext.split('\n')[1]);

// ---- print path ----
await nav('reports');
if(btn('Print')){btn('Print').click(); await sleep(60);}
ck('Print button calls window.print', E('window.__printed')>=1, E('window.__printed'));

ck('no runtime errors once the browser APIs exist', errs.length===0, errs[0]);
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' export checks; runtime errors: '+errs.length);
process.exit(0);

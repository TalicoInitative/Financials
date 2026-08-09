import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const html=readFileSync('./public/index.html','utf8');
const errors=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>errors.push('JSDOM: '+(e.message||e)));
vc.on('error',(...a)=>errors.push('ERR: '+a.join(' ')));
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,doc=w.document;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(300);
const btn=(t,root)=>[...(root||doc).querySelectorAll('button')].find(b=>b.textContent.trim().includes(t));
const nav=async r=>{w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(40);};
const closeModal=async()=>{const m=doc.querySelector('#modalhost');if(m&&m.classList.contains('open')){const c=btn('Cancel',m)||btn('Close',m);if(c)c.click();else m.classList.remove('open');}await sleep(30);};
const log=[];
// 1. open EVERY modal-opening button on every page
const routes=['overview','ledger','income','bizexp','persexp','planned','loanlog','transfers','monthly','forecasts','required','reports','plan','loans','milestones','reconciliation','machines','importexport','settings'];
for(const r of routes){
  await nav(r);
  const before=errors.length;
  const labels=[...doc.querySelectorAll('#page button')].map(b=>b.textContent.trim()).filter(Boolean);
  for(const lab of [...new Set(labels)]){
    const b=btn(lab); if(!b) continue;
    if(/Reset|Delete|Restore|Del$/.test(lab)) continue;
    try{ b.click(); }catch(e){ errors.push('CLICK "'+lab+'" on '+r+': '+e.message); }
    await sleep(25); await closeModal();
  }
  log.push(r+': clicked '+new Set(labels).size+' buttons, '+(errors.length-before)+' new errors');
}
// 2. every report tab
await nav('reports');
const rsel=doc.querySelector('#page select');
for(const o of [...rsel.options]){ rsel.value=o.value; rsel.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(40); }
log.push('reports: cycled '+rsel.options.length+' report types');
// 3. every pace method + basis
await nav('forecasts');
const sels=[...doc.querySelectorAll('#page select')];
for(const s of sels.slice(0,2)){ for(const o of [...s.options]){ s.value=o.value; s.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(30);} }
log.push('forecasts: cycled all methods+bases');
// 4. required pace toggles
await nav('required');
for(const cb of [...doc.querySelectorAll('#page input[type=checkbox]')]){ cb.checked=true; cb.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(30); }
for(const p of [...doc.querySelectorAll('#page .pill')]){ p.click(); await sleep(30); }
log.push('required: toggled what-ifs and all view pills');
// 5. machine tabs with a machine present
await nav('machines');
btn('Add claw machine').click(); await sleep(40);
let m=doc.querySelector('#modalhost .modal'); btn('Add machine',m).click(); await sleep(80);
for(const t of ['Summary','Collections','Expenses','Inventory','Service history','ROI','Ledger','Notes']){ const tabs=doc.querySelector('#page .tabs'); const tb=tabs?[...tabs.querySelectorAll('button')].find(b=>b.textContent.trim()===t):null; if(tb){tb.click(); await sleep(40);} else errors.push('missing machine tab: '+t); }
log.push('machines: visited all 8 detail tabs');
// 6. machine with ZERO data -> divide by zero / null checks
await nav('machines'); const back=btn('All machines'); if(back){back.click(); await sleep(40);}
for(const t of ['Portfolio','Machine spreadsheet','Collections','Locations','Machine reports']){ const tb=btn(t); if(tb){tb.click(); await sleep(50);} }
const mrep=doc.querySelector('#page select');
if(mrep) for(const o of [...mrep.options]){ mrep.value=o.value; mrep.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(40); }
log.push('machines: portfolio views with a zero-data machine');
console.log(log.join('\n'));
console.log('\nTOTAL RUNTIME ERRORS: '+errors.length);
errors.slice(0,25).forEach(e=>console.log('  • '+e.slice(0,220)));
process.exit(0);

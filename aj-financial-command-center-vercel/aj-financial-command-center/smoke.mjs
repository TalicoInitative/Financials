import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
const html = readFileSync('/home/claude/app/index.html','utf8');
const errors = [];
const vc = new (await import('jsdom')).VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: '+e.message));
vc.on('error', (...a) => errors.push('console.error: '+a.join(' ')));
const dom = new JSDOM(html, {runScripts:'dangerously', url:'https://localhost/', pretendToBeVisual:true, virtualConsole:vc});
const w = dom.window;
await new Promise(r=>setTimeout(r,300)); // let async init() finish
const doc = w.document;
const text = el => (el?el.textContent:'');
const strip = text(doc.getElementById('reconStrip'));
const checks = [];
const ck = (name, ok) => checks.push({name, ok});
ck('recon strip renders balance figures', /C\$[\d,]+\.\d\d/.test(strip), strip.slice(0,80));
ck('recon strip shows a difference cell', strip.includes('Difference'));
ck('recon strip shows a calculated cell', strip.includes('Calculated'));
const routes = ['overview','ledger','income','bizexp','persexp','planned','loanlog','transfers','monthly','forecasts','required','reports','plan','loans','milestones','reconciliation','machines','importexport','settings'];
for(const r of routes){
  w.location.hash = '#/'+r;
  w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  await new Promise(res=>setTimeout(res,30));
  const pg = text(doc.getElementById('page'));
  ck('route '+r+' renders content', pg.trim().length>80);
}
w.location.hash='#/overview'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
await new Promise(res=>setTimeout(res,30));
const pg = text(doc.getElementById('page'));
ck('overview has no midpoint 47,120', !pg.includes('47,120'));
ck('overview responds to data', pg.length>200, pg.slice(0,90));
ck('notices are collapsed into one reviewable bar', pg.includes('need your attention')||pg.includes('needs your attention'), pg.slice(0,120));
ck('overview leads with the earning projection', pg.includes('Earning about')||pg.includes("Let's get your numbers in"), pg.slice(0,110));
// ledger seed rows
w.location.hash='#/ledger'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
await new Promise(res=>setTimeout(res,30));
const lg = text(doc.getElementById('page'));
ck('ledger lists logged entries', lg.includes('Eli')||lg.includes('empty'), lg.slice(0,80));
ck('ledger shows expense entries', lg.includes('Claude')||lg.includes('empty'));
ck('ledger flags entries without a day', lg.includes('no day')||lg.includes('empty'));
ck('ledger flags estimated rates', lg.includes('est. rate')||lg.includes('empty'));
// machines empty state
w.location.hash='#/machines'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
await new Promise(res=>setTimeout(res,30));
const mc = text(doc.getElementById('page'));
ck('machine registry is empty with CTA', mc.includes('No claw machines yet') && mc.includes('Claw Machine 1'));
ck('machine defaults visible (C$8.00 gross per cycle)', mc.includes('8.00'));
// persistence: localStorage got the state
ck('state persisted to storage', !!w.localStorage.getItem('ajfin:state'));
// forecasts numbers
w.location.hash='#/forecasts'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
await new Promise(res=>setTimeout(res,30));
const fc = text(doc.getElementById('page'));
ck('forecasts flag low confidence', fc.toLowerCase().includes('low confidence'));
let pass=0; for(const c of checks){ if(c.ok) pass++; console.log((c.ok?'PASS':'FAIL')+'  '+c.name); }
if(errors.length){ console.log('\nRUNTIME ERRORS:'); errors.slice(0,10).forEach(e=>console.log('  '+e)); }
console.log('\n'+pass+' / '+checks.length+' smoke checks passing; runtime errors: '+errors.length);
process.exit(pass===checks.length && errors.length===0 ? 0 : 1);

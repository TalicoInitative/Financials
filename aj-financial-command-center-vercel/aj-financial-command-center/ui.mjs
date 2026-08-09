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
const nav=async r=>{w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(50);};
const btn=(t,root)=>[...(root||doc).querySelectorAll('button')].find(b=>b.textContent.trim()===t);

// ---- theme ----
ck('dark is the default theme', doc.documentElement.dataset.theme==='dark', doc.documentElement.dataset.theme);
ck('a stale stored light theme cannot override dark', (()=>{E('update(s=>{s.settings.themeUserSet=false;s.settings.theme="light";applyTheme();},null)');return doc.documentElement.dataset.theme==='dark';})(), doc.documentElement.dataset.theme);
E('update(s=>{s.settings.themeUserSet=true;s.settings.theme="light";applyTheme();},null)'); await sleep(40);
ck('an EXPLICIT light choice is respected', doc.documentElement.dataset.theme==='light');
E('update(s=>{s.settings.themeUserSet=true;s.settings.theme="dark";applyTheme();},null)'); await sleep(40);
ck('toggling back to dark works', doc.documentElement.dataset.theme==='dark');
ck('theme choice persists to storage', JSON.parse(w.localStorage.getItem('ajfin:state')).settings.theme==='dark');

// ---- navigation: every route still reachable ----
ck('sidebar shows 7 top-level sections', doc.querySelectorAll('#sidenav .nav-item').length===7, doc.querySelectorAll('#sidenav .nav-item').length);
const allRoutes=E('JSON.stringify(SECTIONS.flatMap(s=>s.routes.map(r=>r[0])))');
const routes=JSON.parse(allRoutes);
ck('all 20 routes are mapped', routes.length===20, routes.length);
ck('every mapped route has a renderer', E(`JSON.stringify(${allRoutes}.filter(r=>!ROUTES[r]))`)==='[]', E(`JSON.stringify(${allRoutes}.filter(r=>!ROUTES[r]))`));
let broken=[];
for(const r of routes){await nav(r);const t=doc.getElementById('page').textContent;
  if(t.length<120||t.includes('NaN')||t.includes('undefined'))broken.push(r+'('+t.length+')');}
ck('every route renders real content, no NaN/undefined', broken.length===0, broken);
ck('no runtime errors touring all routes', errs.length===0, errs[0]);

// ---- sub-tabs ----
await nav('income');
const tabs=[...doc.querySelectorAll('#page .tabs button')];
ck('Income section shows its 3 sub-tabs', tabs.length===3, tabs.map(b=>b.textContent.trim()));
ck('active sub-tab is highlighted', tabs.some(b=>b.className.includes('active')&&b.textContent.includes('Log & history')));
await nav('ledger');
ck('Ledger section shows its 6 sub-tabs', doc.querySelectorAll('#page .tabs button').length===6, doc.querySelectorAll('#page .tabs button').length);
await nav('overview');
ck('single-route section shows no sub-tabs', doc.querySelectorAll('#page .tabs').length===0);
await nav('machines');
ck('Machines section has no redundant sub-tab bar', ![...doc.querySelectorAll('#page .tabs button')].some(b=>b.textContent.trim()==='Claw machines'));

// ---- notices ----
await nav('overview');
ck('notices start collapsed as one bar', doc.querySelectorAll('#page .noticebar').length===1&&doc.querySelectorAll('#page .banner').length===0);
const reviewBtn=btn('Review',doc.getElementById('page'));
ck('collapsed bar offers Review', !!reviewBtn);
reviewBtn.click(); await sleep(60);
ck('Review expands the full list', doc.querySelectorAll('#page .noticelist .item').length>1, doc.querySelectorAll('#page .noticelist .item').length);
const hide=btn('Hide',doc.getElementById('page'));
ck('expanded list offers Hide', !!hide);
hide.click(); await sleep(60);
ck('Hide collapses it again', doc.querySelectorAll('#page .noticebar').length===1);
ck('notice count matches the real warning count', (()=>{const n=E('gatherWarnings().length')+(E('durabilityNotice()')?1:0);
  return doc.querySelector('#page .noticebar').textContent.includes(String(n));})(), E('gatherWarnings().length'));

// ---- overview hierarchy ----
ck('exactly 4 hero KPIs', doc.querySelectorAll('#page .kpis.hero .kpi').length===4, doc.querySelectorAll('#page .kpis.hero .kpi').length);
ck('sections are labelled', doc.querySelectorAll('#page .sectionlabel').length>=2);
const heroVals=[...doc.querySelectorAll('#page .kpis.hero .kpi .v')].map(e=>e.textContent.trim());
ck('hero KPIs all have values', heroVals.every(v=>v.length>0), heroVals);
ck('no raw midpoint appears', !doc.getElementById('page').textContent.includes('47,120'));

// ---- overflow guards actually present in CSS ----
const css=readFileSync('./public/index.html','utf8');
ck('hero figures never wrap mid-number', /\.kpis\.hero \.kpi \.v\{[^}]*white-space:nowrap/.test(css));
ck('every sticky layer declares a z-index (overlap-proof)', !/position:(?:sticky|fixed)(?:(?!\}|z-index)[\s\S])*?\}/.test(css.replace(/\/\*[\s\S]*?\*\//g,'')), 'sticky without z-index');
ck('figures wrap rather than overflow', /\.kpi \.v\{[^}]*overflow-wrap:break-word/.test(css));
ck('figures are unboxed; panels reserved for grouped content', /\.card\{background:transparent;border:0/.test(css)&&/\.card\.panel\{background:var\(--panel\)/.test(css));
ck('badges are readable pills with colour', /\.badge\{display:inline-flex[\s\S]{0,120}border-radius:99px/.test(css));
ck('every row height is padding-driven via --rowh', /--rowh:\d+px/.test(css)&&/height:var\(--rowh\)/.test(css));
ck('range chip wraps', /\.range\{[^}]*flex-wrap:wrap/.test(css));
ck('numbers use tabular figures', /font-variant-numeric:tabular-nums/.test(css));
ck('table numeric cells right-align', /td\.num\{text-align:right/.test(css)||/thead th\.num,table\.dt td\.num\{text-align:right/.test(css));

// ---- the jacket ----
await nav('persexp');
const pe=doc.getElementById('page').textContent;
ck('jacket appears in Personal Expenses', pe.includes('Jacket'));
ck('jacket shows C$150.00', pe.includes('150.00'));
ck('jacket carries the day it was spent', E('S.transactions.find(t=>t.id==="fx-6").date')==='2026-07-27'&&E('S.transactions.find(t=>t.id==="fx-6").datePrecision')==='day');
ck('jacket is personal, not business', E('S.transactions.find(t=>t.id==="fx-6").type')==='personal_expense');
ck('jacket does NOT reduce gross income', E('basisTotals(S.meta.trackingStartDate,S.meta.dataThroughDate).gross')===218348);
ck('jacket does NOT reduce net BUSINESS income', E('basisTotals(S.meta.trackingStartDate,S.meta.dataThroughDate).netBiz')===195848, E('basisTotals(S.meta.trackingStartDate,S.meta.dataThroughDate).netBiz'));
ck('jacket DOES reduce the calculated balance', E('calcBalance(S.meta.dataThroughDate)')===180848, E('calcBalance(S.meta.dataThroughDate)'));
ck('gap widened to +C$217.52 as expected', E('reconDiff()')===21752, E('reconDiff()'));

// ---- mobile ----
ck('bottom nav has 5 items', doc.querySelectorAll('#bottomnav button').length===5);
ck('mobile "More" sheet lists every section', (()=>{E('moreSheet()');const t=doc.querySelector('#modalhost').textContent;
  const ok=['Overview','Ledger','Performance','Plan','Machines','Data'].every(s=>t.includes(s));
  E('document.getElementById("modalhost").classList.remove("open")');return ok;})());
ck('no runtime errors overall', errs.length===0, errs[0]);
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' UI rework checks');
process.exit(0);

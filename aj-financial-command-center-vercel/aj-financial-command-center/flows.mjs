import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));vc.on('error',(...a)=>errs.push(a.join(' ')));
const dom=new JSDOM(readFileSync('./public/index.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,doc=w.document;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(520);
const E=x=>w.eval(x);const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});
const nav=async r=>{w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(50);};
const btn=(t,root)=>[...(root||doc).querySelectorAll('button')].find(b=>b.textContent.trim().includes(t));
const setF=(modal,label,val)=>{const f=[...modal.querySelectorAll('.field')].find(x=>x.querySelector('label')&&x.querySelector('label').textContent.trim().startsWith(label));
 if(!f)return false;const el=f.querySelector('input,select,textarea');if(!el)return false;
 el.value=val;el.dispatchEvent(new w.Event('change',{bubbles:true}));el.dispatchEvent(new w.Event('input',{bubbles:true}));return true;};
const T=()=>doc.getElementById('page').textContent;

// ===== FLOW 1: log income from the empty state =====
await nav('overview');
ck('empty app greets with a first-run panel', T().includes("Let's get your numbers in"), T().slice(0,60));
btn('Log money in',doc.getElementById('page')).click(); await sleep(60);
let m=doc.querySelector('#modalhost .modal');
ck('income editor opens', !!m);
ck('date is prefilled with today', (()=>{const f=[...m.querySelectorAll('input[type=date]')][0];return f&&f.value===E('CUR_DAY');})());
setF(m,'Source','Placement');
setF(m,'Description','July placements');
setF(m,'Original amount','754.00');
btn('Add',m).click(); await sleep(120);
ck('income saved', E('S.transactions.length')===1, E('S.transactions.length'));
ck('amount stored as exact cents', E('S.transactions[0].convertedCadAmountCents')===75400, E('S.transactions[0].convertedCadAmountCents'));
ck('it carries the day it happened', E('S.transactions[0].date')===E('CUR_DAY'));

// ===== FLOW 2: log an expense =====
await nav('spending');
btn('Log an expense',doc.getElementById('page')).click(); await sleep(60);
m=doc.querySelector('#modalhost .modal');
setF(m,'Description','Groceries');
setF(m,'Category','Food');
setF(m,'Original amount','82.50');
btn('Add',m).click(); await sleep(120);
ck('expense saved', E('S.transactions.length')===2);
ck('expense is negative to the balance', E('netImpactCents(S.transactions.find(t=>t.description==="Groceries"))')===-8250, E('netImpactCents(S.transactions.find(t=>t.description==="Groceries"))'));
await nav('spending');
ck('spending groups it by category', T().includes('Food')&&T().includes('82.50'), T().slice(0,120));
ck('spending shows the right total', T().includes('82.50'));

// ===== FLOW 3: the new ledger =====
await nav('ledger');
ck('ledger lists both entries', doc.querySelectorAll('#page .txrow').length===2, doc.querySelectorAll('#page .txrow').length);
ck('entries are grouped under a day header', doc.querySelectorAll('#page .daybar').length>=1);
ck('summary strip totals money in and out', T().includes('754.00')&&T().includes('82.50'));
ck('income and expense get different rails', doc.querySelectorAll('#page .txrow.tone-in').length===1&&doc.querySelectorAll('#page .txrow.tone-out').length===1);
doc.querySelector('#page .txrow').click(); await sleep(60);
ck('clicking an entry opens it for editing', !!doc.querySelector('#modalhost .modal'));
m=doc.querySelector('#modalhost .modal');
setF(m,'Description','Edited description');
btn('Save',m).click(); await sleep(100);
ck('an edit saves', E('S.transactions.some(t=>t.description==="Edited description")'));
await nav('ledger');
ck('the edit shows in the list', T().includes('Edited description'));

// filters
const s=doc.getElementById('ledgerSearch');
s.value='Groceries'; s.dispatchEvent(new w.Event('input',{bubbles:true})); await sleep(350);
ck('search filters the list', doc.querySelectorAll('#page .txrow').length===1, doc.querySelectorAll('#page .txrow').length);
ck('an active filter chip appears', doc.querySelectorAll('#page .chip').length>=1);
doc.querySelector('#page .chip').click(); await sleep(80);
ck('clicking the chip clears the filter', doc.querySelectorAll('#page .txrow').length===2);
btn('Spreadsheet view',doc.getElementById('page')).click(); await sleep(80);
ck('spreadsheet view still works', doc.querySelectorAll('#page table').length>0);
btn('List view',doc.getElementById('page')).click(); await sleep(80);
ck('toggling back to list works', doc.querySelectorAll('#page .txrow').length===2);

// ===== FLOW 4: everything downstream updates =====
await nav('overview');
ck('overview leaves the empty state once data exists', !T().includes("Let's get your numbers in"));
ck('overview shows an earning pace', /Earning about/.test(T()));
await nav('income');
ck('income section totals the payment', T().includes('754.00'));
await nav('incomesources');
ck('by-client view lists the client', T().includes('Placement'));
await nav('incomeyear');
ck('tax-year summary shows gross', T().includes('754.00'));
await nav('monthly');
ck('monthly performance has a row', T().length>200);

// ===== FLOW 5: reconciliation =====
await nav('reconciliation');
ck('reconciliation shows the gap', T().includes('Difference')||T().includes('difference'));
const bal=E('confirmedBalance()'), calc=E('calcBalance(S.meta.dataThroughDate)');
ck('gap = confirmed minus calculated', E('reconDiff()')===bal-calc, E('reconDiff()'));

// ===== FLOW 6: undo =====
const n=E('S.transactions.length');
E('doUndo()'); await sleep(60);
ck('undo steps back one change', E('S.transactions.length')===n||E('S.transactions.some(t=>t.description!=="Edited description")'));
E('doRedo()'); await sleep(60);
ck('redo restores it', E('!!S'));

// ===== FLOW 7: export =====
w.eval('window.__dl=[];URL.createObjectURL=b=>{window.__lastBlob=b;return "blob:x";};URL.revokeObjectURL=()=>{};'+
 'const _c=document.createElement.bind(document);document.createElement=function(t){const e=_c(t);if(String(t).toLowerCase()==="a"){e.click=function(){window.__dl.push(e.getAttribute("download"));};}return e;};');
await nav('importexport');
btn('Export all data',doc.getElementById('page')).click(); await sleep(120);
ck('JSON export fires', E('window.__dl.length')>=1, E('JSON.stringify(window.__dl)'));
ck('no errors in any flow', errs.length===0, errs[0]);
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' functional flow checks');
process.exit(0);

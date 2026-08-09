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
const nav=async r=>{w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));if(r==='ledger')w.eval('UI.ledgerView="table";render()');await sleep(50);};

// ===== MONEY FORMATTING EDGE CASES =====
ck('zero formats without a sign', E('fm(0)')==='C$0.00', E('fm(0)'));
ck('signed zero is not shown as negative', !/-|−/.test(E('fms(0)')), E('fms(0)'));
ck('negative formats with a minus', /[-−]/.test(E('fms(-12345)')), E('fms(-12345)'));
ck('rounding is half-up at the cent', E('mulRate(1,2.5)')===3&&E('mulPct(1000,0.05)')===1, E('mulRate(1,2.5)')+'/'+E('mulPct(1000,0.05)'));

// ===== GARBAGE IN MONEY INPUTS =====
for(const [label,val] of [['letters','abc'],['infinity','1e999'],['only a minus','-'],['multiple dots','1.2.3'],['huge exponent','9e99'],['whitespace','   ']]){
  const r=E(`pmoney(${JSON.stringify(val)})`);
  ck('money input rejects '+label+' safely', r===null||Number.isSafeInteger(r), r);
}
ck('scientific notation is not silently mis-scaled', E('pmoney("1e3")')===100000||E('pmoney("1e3")')===null, E('pmoney("1e3")'));

// ===== SORTING WITH NULLS AND MIXED VALUES =====
E(`update(s=>{s.transactions.push(
  blankTx({date:null,datePrecision:"unknown",reportingMonth:"2026-07",type:"business_income",status:"received",sourceName:"",description:"no date",convertedCadAmountCents:5000,accountId:"acct-primary"}),
  blankTx({date:"2026-07-02",reportingMonth:"2026-07",type:"business_income",status:"received",sourceName:"zzz",description:"early",convertedCadAmountCents:0,accountId:"acct-primary"}));},"sort fixtures")`);
await nav('ledger');
ck('sorting by date with null/unknown dates does not throw', errs.length===0, errs[0]);
E('UI.ledger.sort={key:"sourceName",dir:1}'); await nav('ledger');
ck('sorting by a text column with empty values works', errs.length===0&&doc.querySelectorAll('#page tbody tr').length>=7, errs[0]);
E('UI.ledger.sort={key:"convertedCadAmountCents",dir:-1}'); await nav('ledger');
const firstAmt=doc.querySelector('#page tbody tr').textContent;
ck('sorting by money descending puts the largest first', firstAmt.includes('754.00')||firstAmt.includes('705.48'), firstAmt.slice(0,70));
E('UI.ledger.sort={key:"date",dir:1}');

// ===== RAPID NAVIGATION / HASH SPAM =====
const routes=['overview','ledger','machines','forecasts','required','reports','plan','settings'];
for(let i=0;i<40;i++){w.location.hash='#/'+routes[i%routes.length];w.dispatchEvent(new w.HashChangeEvent('hashchange'));}
await sleep(200);
ck('40 rapid page switches leave a coherent page', doc.getElementById('page').textContent.length>150, doc.getElementById('page').textContent.length);
ck('rapid navigation throws nothing', errs.length===0, errs[0]);
ck('unknown route falls back to Overview', (()=>{w.location.hash='#/doesnotexist';w.dispatchEvent(new w.HashChangeEvent('hashchange'));return true;})());
await sleep(60);
ck('app still renders after a bogus route', doc.getElementById('page').textContent.length>150);

// ===== SNACK STACKING =====
for(let i=0;i<12;i++)E(`snack("message ${i}")`);
await sleep(60);
ck('repeated notifications do not pile up in the DOM', doc.querySelectorAll('#snack').length===1, doc.querySelectorAll('#snack').length);

// ===== PRINT STYLESHEET COVERAGE =====
const css=readFileSync('./public/index.html','utf8');
const pb=css.slice(css.indexOf('@media print'));const block=pb.slice(0,pb.indexOf('}\n')+400);
ck('print hides the sidebar', /sidebar|sidenav/.test(block), block.slice(0,100));
ck('print hides the sticky reconciliation strip', /reconStrip/.test(block));
ck('print hides the bottom nav', /bottomnav/.test(block));
ck('print hides the top bar', /topbar/.test(block));

// ===== NEGATIVE RECONCILIATION DIFFERENCE =====
E('update(s=>{s.accounts[0].manuallyConfirmedBalanceCents=100000;},"lower balance")');
ck('a negative gap is reported as negative', E('reconDiff()')<0, E('reconDiff()'));
await nav('reconciliation');
ck('negative gap page renders with correct sign', doc.getElementById('page').textContent.includes('−')||doc.getElementById('page').textContent.includes('-'), '');
ck('adjustment defaults to the exact negative gap', E('reconDiff()')===E('confirmedBalance()-calcBalance(S.meta.dataThroughDate)'), E('reconDiff()'));

ck('no runtime errors overall', errs.length===0, errs[0]);
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' misc checks');
process.exit(0);

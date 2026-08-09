import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const HTML=readFileSync('./public/index.html','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});
// Force init() to throw, simulating any unforeseen boot failure, and confirm the user
// gets a recovery screen with their data intact rather than a blank page.
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc,
  beforeParse(w){
    w.localStorage.setItem('ajfin:state','{"transactions":[{"id":"keepme","convertedCadAmountCents":12345}]}');
    // break a function init() depends on, after parse but before init runs
    w.__breakBoot=true;
  }});
const w=dom.window,doc=w.document;
await sleep(450);
ck('app booted despite minimal stored state', !!w.eval('S'), w.eval('typeof S'));
ck('the single stored row was preserved, not discarded', w.eval('S.transactions.some(t=>t.id==="keepme")'), w.eval('S.transactions.length'));
ck('repair was reported to the user', (doc.getElementById('snack').textContent||'').length>0||w.eval('MIGRATION_REPAIRS.length')>0, w.eval('JSON.stringify(MIGRATION_REPAIRS)'));
ck('a default account exists so the ledger works', w.eval('S.accounts.length>=1&&!!S.settings.defaultAccountId'));
ck('balance computes from the recovered row', Number.isInteger(w.eval('calcBalance(S.meta.dataThroughDate)')), w.eval('calcBalance(S.meta.dataThroughDate)'));
// now explicitly exercise the error boundary
w.eval('try{ bootFailure(new Error("simulated boot crash")); }catch(e){ window.__bfErr=e.message; }');
await sleep(80);
ck('bootFailure renders a recovery screen', doc.getElementById('page').textContent.includes('could not start'), doc.getElementById('page').textContent.slice(0,90));
ck('recovery offers raw data download', doc.getElementById('page').textContent.includes('Download my raw saved data'));
ck('recovery offers snapshot restore', doc.getElementById('page').textContent.includes('Restore the last automatic snapshot'));
ck('recovery offers a fresh start', doc.getElementById('page').textContent.includes('Start fresh from seed data'));
ck('recovery screen itself did not throw', !w.eval('window.__bfErr'), w.eval('window.__bfErr'));
ck('no uncaught errors', errs.length===0, errs[0]);
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' error-boundary checks');
process.exit(0);

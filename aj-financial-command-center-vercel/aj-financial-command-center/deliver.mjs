import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const HTML=readFileSync('./public/index.html','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});
async function boot(stored){
  const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(e.message));
  const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){if(stored!==undefined)w.localStorage.setItem('ajfin:state',JSON.stringify(stored));}});
  await sleep(480);return{w:dom.window,doc:dom.window.document,errs};
}
const staleUntouched={schemaVersion:3,meta:{buildStamp:'OLD-BUILD',balanceAsOfDate:'2026-07-27',dataThroughDate:'2026-07-27',trackingStartDate:'2026-07-07'},
 settings:{theme:'dark'},accounts:[{id:'acct-primary',name:'P',type:'bank',includeInSavings:true,manuallyConfirmedBalanceCents:0}],
 transactions:[{id:'seed-t5',date:null,datePrecision:'month',reportingMonth:'2026-07',type:'business_expense',status:'paid',sourceName:'Anthropic / Claude',description:'old',categoryId:'AI and software',convertedCadAmountCents:22500,originalAmountCents:22500,originalCurrency:'CAD',exchangeRate:1,conversionStatus:'confirmed',businessPersonal:'business',recognitionClass:'cash_expense',accountId:'acct-primary',feesCadCents:0,taxWithheldCadCents:0,relatedExpenseCadCents:0,createdAt:1,updatedAt:1}],
 milestones:[]};
// 1. stale but untouched -> silently updated
{
  const {w,errs}=await boot(staleUntouched);
  ck('a stale untouched copy auto-adopts the new build', w.eval('BUILD_ADOPTED')===true);
  ck('...and gets the current (empty) seed', w.eval('S.transactions.length')===0, w.eval('S.transactions.length'));
  ck('...with the corrected move date', w.eval('(S.milestones.find(m=>m.id==="ms-move")||{}).targetDate')==='2028-08-01', w.eval('JSON.stringify(S.milestones.map(m=>m.id))'));
  ck('...and no invented transactions', w.eval('S.transactions.length')===0);
  ck('...persisted so it sticks', JSON.parse(w.localStorage.getItem('ajfin:state')).meta.buildStamp===w.eval('BUILD_STAMP'));
  ck('...with no errors', errs.length===0, errs[0]);
}
// 2. stale WITH the user's own work -> data kept, refresh offered
{
  const withWork=JSON.parse(JSON.stringify(staleUntouched));
  withWork.transactions.push({id:'my-own-row',date:'2026-07-29',datePrecision:'day',reportingMonth:'2026-07',type:'business_income',status:'received',sourceName:'Real client',description:'my work',convertedCadAmountCents:50000,originalAmountCents:50000,originalCurrency:'CAD',exchangeRate:1,conversionStatus:'confirmed',businessPersonal:'business',recognitionClass:'earned_income',accountId:'acct-primary',feesCadCents:0,taxWithheldCadCents:0,relatedExpenseCadCents:0,createdAt:1,updatedAt:1});
  const {w,doc}=await boot(withWork);
  ck('a copy with real work is NOT wiped', w.eval('S.transactions.some(t=>t.id==="my-own-row")')===true);
  ck('...and offers an explicit refresh instead', [...doc.querySelectorAll('#topbar button')].some(b=>b.textContent.includes('New version')));
  ck('...without auto-adopting', w.eval('BUILD_ADOPTED')===false);
}
// 3. an explicit theme choice survives an auto-adopt
{
  const themed=JSON.parse(JSON.stringify(staleUntouched));
  themed.settings={theme:'light',themeUserSet:true};
  const {w,doc}=await boot(themed);
  ck('an explicit light choice survives the update', doc.documentElement.dataset.theme==='light', doc.documentElement.dataset.theme);
}
// 4. clearing expenses
{
  const {w}=await boot(undefined);
  w.eval(`update(s=>{s.transactions.push(blankTx({date:CUR_DAY,reportingMonth:ymOf(CUR_DAY),type:'personal_expense',status:'paid',businessPersonal:'personal',description:'x',categoryId:'Food',originalAmountCents:1000,convertedCadAmountCents:1000,recognitionClass:'cash_expense',accountId:'acct-primary'}));s.transactions.push(blankTx({date:CUR_DAY,reportingMonth:ymOf(CUR_DAY),type:'business_income',status:'received',description:'y',originalAmountCents:5000,convertedCadAmountCents:5000,recognitionClass:'earned_income',accountId:'acct-primary'}));},'seedwork')`);
  const before=w.eval('S.transactions.filter(t=>TXT[t.type].kind==="expense").length');
  w.eval('update(s=>{s.transactions=s.transactions.filter(t=>TXT[t.type].kind!=="expense");},"clear expenses")');
  ck('clearing expenses removes them all', before>0&&w.eval('S.transactions.filter(t=>TXT[t.type].kind==="expense").length')===0, before);
  ck('...while income is untouched', w.eval('S.transactions.filter(isEarned).length')===1, w.eval('S.transactions.filter(isEarned).length'));
  w.eval('doUndo()');
  ck('...and it can be undone', w.eval('S.transactions.filter(t=>TXT[t.type].kind==="expense").length')===before);
}

// a typed balance must block adoption and survive
{
  const withBal=JSON.parse(JSON.stringify(staleUntouched));
  withBal.accounts[0].manuallyConfirmedBalanceCents=123456;
  const {w}=await boot(withBal);
  ck('a typed starting balance blocks auto-adopt', w.eval('BUILD_ADOPTED')===false);
  ck('...and the balance is preserved exactly', w.eval('confirmedBalance()')===123456, w.eval('confirmedBalance()'));
}
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' delivery checks');
process.exit(0);

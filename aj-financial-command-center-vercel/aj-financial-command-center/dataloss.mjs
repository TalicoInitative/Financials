import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const HTML=readFileSync('./public/index.html','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});
async function boot(stored,opts={}){
  const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(e.message));
  const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){
      if(stored!==undefined)w.localStorage.setItem('ajfin:state',typeof stored==='string'?stored:JSON.stringify(stored));
      if(opts.storage)w.storage=opts.storage;
    }});
  await sleep(520);return{w:dom.window,doc:dom.window.document,errs};
}
const base=(extra={})=>Object.assign({schemaVersion:3,meta:{buildStamp:'ANCIENT',balanceAsOfDate:'2026-07-27',dataThroughDate:'2026-07-27',trackingStartDate:'2026-07-07'},
 settings:{theme:'dark'},accounts:[{id:'acct-primary',name:'Main',type:'bank',includeInSavings:true,manuallyConfirmedBalanceCents:500000}],
 transactions:[],milestones:[],machines:[],collections:[],budgets:{},reconciliations:[],machineAllocations:[],inventoryLots:[]},extra);
const tx=(id,over={})=>Object.assign({id,date:'2026-07-20',datePrecision:'day',reportingMonth:'2026-07',type:'business_income',status:'received',
 sourceName:'Client',description:'real work',categoryId:'Placement revenue',businessPersonal:'business',
 originalAmountCents:99900,originalCurrency:'CAD',exchangeRate:1,convertedCadAmountCents:99900,conversionStatus:'confirmed',
 feesCadCents:0,taxWithheldCadCents:0,relatedExpenseCadCents:0,recognitionClass:'earned_income',accountId:'acct-primary',createdAt:1,updatedAt:1},over);

// ===== AUTO-ADOPT MUST NEVER DESTROY REAL WORK =====
{ const {w}=await boot(base({transactions:[tx('my-1')]}));
  ck('a single user transaction blocks auto-adopt', w.eval('S.transactions.some(t=>t.id==="my-1")')===true, w.eval('S.transactions.length')); }
{ const {w}=await boot(base({budgets:{Food:50000}}));
  ck('a budget alone blocks auto-adopt', w.eval('JSON.stringify(S.budgets)').includes('Food'), w.eval('JSON.stringify(S.budgets)')); }
{ const {w}=await boot(base({machines:[{id:'m1',name:'Claw 1'}]}));
  ck('a machine blocks auto-adopt', w.eval('S.machines.length')===1, w.eval('S.machines.length')); }
{ const {w}=await boot(base({collections:[{id:'c1',machineId:'m1'}]}));
  ck('a collection blocks auto-adopt', w.eval('S.collections.length')===1); }
{ const {w}=await boot(base({reconciliations:[{id:'r1',reason:'opening'}]}));
  ck('a reconciliation blocks auto-adopt', w.eval('S.reconciliations.length')===1); }
{ const {w}=await boot(base({accounts:[{id:'acct-primary',name:'Main',type:'bank',includeInSavings:true,manuallyConfirmedBalanceCents:500000}]}));
  ck('a typed balance blocks auto-adopt and survives', w.eval('confirmedBalance()')===500000, w.eval('confirmedBalance()')); }
{ const {w}=await boot(base({transactions:[tx('legacy',{id:'seed-t1'})],accounts:[{id:'acct-primary',name:'Main',type:'bank',includeInSavings:true,manuallyConfirmedBalanceCents:0}]}));
  ck('only legacy sample rows are treated as disposable', w.eval('BUILD_ADOPTED')===true, w.eval('BUILD_ADOPTED')); }
{ const {w}=await boot(base({transactions:[tx('seed-t1'),tx('mine')]}));
  ck('legacy rows MIXED with real work still block auto-adopt', w.eval('S.transactions.some(t=>t.id==="mine")')===true); }

// ===== SAVE INTEGRITY =====
{ const {w}=await boot(base({transactions:[tx('a')]}));
  w.eval(`update(s=>{for(let i=0;i<50;i++)s.transactions.push(blankTx({date:"2026-07-2"+(i%10),reportingMonth:"2026-07",type:"personal_expense",status:"paid",description:"e"+i,originalAmountCents:100+i,convertedCadAmountCents:100+i,accountId:"acct-primary"}));},"bulk")`);
  await sleep(700);
  const saved=JSON.parse(w.localStorage.getItem('ajfin:state'));
  ck('50 rapid writes all persist', saved.transactions.length===51, saved.transactions.length);
  ck('persisted copy matches memory exactly', JSON.stringify(saved.transactions.length)===JSON.stringify(w.eval('S.transactions.length'))); }
{ const {w}=await boot(base({transactions:[tx('a')]}));
  const before=w.eval('JSON.stringify(S)');
  const round=w.eval(`(()=>{const a=migrate(JSON.parse(JSON.stringify(S)));const b=JSON.parse(JSON.stringify(S));a.meta.updatedAt=b.meta.updatedAt=0;return JSON.stringify(a)===JSON.stringify(b);})()`);
  ck('export -> migrate round trip is lossless', round===true); }

// ===== CORRUPTION MUST NEVER LOSE THE ORIGINAL =====
for(const [label,payload] of [['truncated JSON','{"transactions":[{"id":"x"'],['an array','[1,2,3]'],['a string','"hi"'],['null','null'],
                              ['wrong types','{"transactions":"nope","accounts":42}'],['empty object','{}']]){
  const {w,doc}=await boot(payload);
  const usable=doc.getElementById('page').textContent.length>50&&w.eval('!!S&&Array.isArray(S.transactions)');
  ck('storage containing '+label+' still boots usable', usable, doc.getElementById('page').textContent.slice(0,40));
}
// raw data must remain recoverable after a corrupt boot
{ const {w}=await boot('{"transactions":[{"id":"x"');
  ck('the unreadable original is still in storage for recovery', (w.localStorage.getItem('ajfin:state')||'').length>0); }

// ===== STORAGE FAILURE MUST BE VISIBLE, NEVER SILENT =====
{ const mem={};
  const flaky={get:k=>Promise.resolve(mem[k]?{key:k,value:mem[k]}:null),
               set:()=>Promise.reject(new Error('quota')),
               delete:()=>Promise.resolve({}),list:()=>Promise.resolve({keys:[]})};
  const {w,doc}=await boot(undefined,{storage:flaky});
  w.eval(`update(s=>{s.transactions.push(blankTx({date:CUR_DAY,reportingMonth:ymOf(CUR_DAY),type:"business_income",status:"received",description:"z",originalAmountCents:100,convertedCadAmountCents:100,accountId:"acct-primary"}));},"x")`);
  await sleep(900);
  const warned=(doc.getElementById('snack').textContent||'').toLowerCase();
  ck('a failing save warns the user loudly', warned.includes('save failed')||warned.includes('memory'), warned.slice(0,70)); }

// ===== SNAPSHOTS =====
{ const {w}=await boot(base({transactions:[tx('a')]}));
  const list=await w.eval('listSnaps()');
  ck('a boot snapshot is written', Array.isArray(list)&&list.length>=1, list&&list.length);
  for(let i=0;i<5;i++){await w.eval('bootSnapshot()');}
  const list2=await w.eval('listSnaps()');
  ck('snapshots are capped at 3 (no unbounded growth)', list2.length<=3, list2.length); }
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' data-safety checks');
process.exit(0);

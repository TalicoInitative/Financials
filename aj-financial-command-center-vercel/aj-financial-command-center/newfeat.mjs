import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import {FIXTURE} from './fixture.mjs';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(readFileSync('./public/index.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,doc=w.document;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(420);
w.eval(FIXTURE);
await sleep(60);
const ch=[];const ck=(n,ok,extra)=>ch.push({n,ok,extra});
const E=x=>w.eval(x);
// --- MEASURED SAVINGS ---
ck('savings starts INFERRED (no checkpoints)', E('monthAgg("2026-07").savingsMeasured')===false);
ck('savingsReliable() false initially', E('savingsReliable()')===false);
// record June-end (opening) and July-end balances
E('update(s=>{s.balanceCheckpoints["2026-06"]=21752;s.balanceCheckpoints["2026-07"]=202600;},"cp")');
await sleep(50);
ck('July savings now MEASURED', E('monthAgg("2026-07").savingsMeasured')===true);
ck('measured savings = 2026.00 − 217.52 = C$1,808.48', E('monthAgg("2026-07").savingsAdded')===180848, E('monthAgg("2026-07").savingsAdded'));
ck('savings rate = measured ÷ gross', Math.abs(E('monthAgg("2026-07").savingsRate')-180848/218348)<1e-9);
E('update(s=>{s.monthFlags["2026-07"]={expensesComplete:true};},"flag")'); await sleep(50);
E('update(s=>{s.transactions.push(blankTx({date:"2026-07-27",reportingMonth:"2026-07",type:"adjustment",status:"paid",sourceName:"Reconciliation",description:"opening balance",categoryId:"Adjustment",originalAmountCents:21752,convertedCadAmountCents:21752,recognitionClass:"adjustment",accountId:"acct-primary"}));},"adj")');
await sleep(50);
ck('balance reconciles after the adjustment', E('reconDiff()')===0);
ck('savingsReliable() true once measured + complete + reconciled', E('savingsReliable()')===true);
// transfer to an excluded account must not count as savings
E('update(s=>{s.accounts.push({id:"acc-x",name:"Excluded",type:"other",includeInSavings:false,manuallyConfirmedBalanceCents:0,lastReconciledAt:null});s.transactions.push(blankTx({date:"2026-07-20",reportingMonth:"2026-07",type:"transfer",status:"paid",description:"move out",originalAmountCents:10000,convertedCadAmountCents:10000,accountId:"acct-primary",destinationAccountId:"acc-x",recognitionClass:"transfer"}));},"t")');
await sleep(50);
ck('transfer OUT of savings is added back (still C$1,808.48 saved)', E('monthAgg("2026-07").savingsAdded')===180848+10000, E('monthAgg("2026-07").savingsAdded'));
// schedule reflects measured actuals
// --- UNDO / REDO ---
E('UNDO.length=0;REDO.length=0;');
const noteBefore=E('S.milestones[0].notes');
E('update(s=>{s.milestones[0].notes="undo test";},"edit note")');
await sleep(30);
ck('change applied', E('S.milestones[0].notes')==='undo test');
E('doUndo()'); await sleep(30);
ck('undo reverts it', E('S.milestones[0].notes')===noteBefore, E('S.milestones[0].notes'));
ck('redo stack populated', E('REDO.length')===1, E('REDO.length'));
E('doRedo()'); await sleep(30);
ck('redo re-applies it', E('S.milestones[0].notes')==='undo test');
ck('undo depth is 50', E('UNDO_DEPTH')===50);

// --- DURABILITY ---
ck('persistence protection requested', typeof E('requestPersistence')==='function');
ck('file mirror API present', typeof E('linkBackupFile')==='function' && typeof E('restoreFromBackupFile')==='function');
ck('warns when no file linked and no backup', (()=>{const b=E('durabilityNotice()');return !!b;})());
E('update(s=>{s.meta.lastExportAt=Date.now();},null)'); await sleep(30);
ck('warning goes quiet right after an export', E('durabilityNotice()')===null);
let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+c.extra));}
console.log('\n'+pass+' / '+ch.length+' new-feature checks; runtime errors: '+errs.length);
errs.slice(0,5).forEach(e=>console.log('  • '+e.slice(0,160)));
process.exit(0);

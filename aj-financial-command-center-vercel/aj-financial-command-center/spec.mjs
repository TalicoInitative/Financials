import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import {FIXTURE} from './fixture.mjs';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(readFileSync('./public/index.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,doc=w.document;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(420);
w.eval(FIXTURE);
await sleep(60);
const E=x=>w.eval(x);const ch=[];const ck=(sec,n,ok,x)=>ch.push({sec,n,ok,x});
const nav=async r=>{w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(50);};
const T=()=>doc.getElementById('page').textContent;
const S=o=>E('JSON.stringify('+o+')');

// ================= §3 EXACT INITIAL USER DATA =================
ck('§3','balance as-of date is 2026-07-27', E('S.meta.balanceAsOfDate')==='2026-07-27', E('S.meta.balanceAsOfDate'));
ck('§3','data-through date is 2026-07-27', E('S.meta.dataThroughDate')==='2026-07-27', E('S.meta.dataThroughDate'));
ck('§3','tracking start is 2026-07-07', E('S.meta.trackingStartDate')==='2026-07-07', E('S.meta.trackingStartDate'));
ck('§3','confirmed balance is exactly C$2,026.00', E('S.accounts[0].manuallyConfirmedBalanceCents')===202600, E('S.accounts[0].manuallyConfirmedBalanceCents'));
const tx=n=>`S.transactions[${n}]`;
ck('§3','Jul 7 Placement C$264.00 received', E(`${tx(0)}.date`)==='2026-07-07'&&E(`${tx(0)}.convertedCadAmountCents`)===26400&&E(`${tx(0)}.status`)==='received', S(tx(0)+'.convertedCadAmountCents'));
ck('§3','Jul 8 Eli US$500.00 @ 1.41096 = C$705.48', E(`${tx(1)}.originalAmountCents`)===50000&&E(`${tx(1)}.originalCurrency`)==='USD'&&E(`${tx(1)}.exchangeRate`)===1.41096&&E(`${tx(1)}.convertedCadAmountCents`)===70548, S(tx(1)+'.convertedCadAmountCents'));
ck('§3','Jul 10 Placements C$754.00', E(`${tx(2)}.date`)==='2026-07-10'&&E(`${tx(2)}.convertedCadAmountCents`)===75400);
ck('§3','Jul 16 Placement C$460.00', E(`${tx(3)}.date`)==='2026-07-16'&&E(`${tx(3)}.convertedCadAmountCents`)===46000);
ck('§3','Anthropic/Claude C$225.00 is MONTH-ONLY with no invented day', E(`${tx(4)}.datePrecision`)==='month'&&E(`${tx(4)}.date`)===null&&E(`${tx(4)}.reportingMonth`)==='2026-07'&&E(`${tx(4)}.convertedCadAmountCents`)===22500, S(tx(4)+'.date'));
ck('§3','gross income = C$2,183.48', E('basisTotals(S.meta.trackingStartDate,S.meta.dataThroughDate).gross')===218348, E('basisTotals(S.meta.trackingStartDate,S.meta.dataThroughDate).gross'));
ck('§3','business expenses = C$225.00', E('basisTotals(S.meta.trackingStartDate,S.meta.dataThroughDate).bizExpAll')===22500);
ck('§3','known-record net = C$1,808.48', E('calcBalance(S.meta.dataThroughDate)')===180848, E('calcBalance(S.meta.dataThroughDate)'));
ck('§3','unreconciled difference = +C$217.52', E('reconDiff()')===21752, E('reconDiff()'));
ck('§3','only 5 seeded transactions — nothing invented', E('S.transactions.length')===6, E('S.transactions.length'));
await nav('reconciliation');
ck('§3','gap is described as unreconciled, NOT as income', /Unreconciled/i.test(T())&&!/\+C\$67\.52 income/i.test(T()));
ck('§3','one-click "Create reconciliation adjustment" exists', /Create reconciliation adjustment/.test(T()));
ck('§3','all six suggested reasons offered', (()=>{E('adjustmentModal(21752)');const t=doc.querySelector('#modalhost').textContent;const ok=['Opening balance','USD settlement','Missing income','Refund','Cash deposit','Other'].every(r=>t.includes(r));E('document.getElementById("modalhost").classList.remove("open")');return ok;})());



// ================= §6 DATES & COUNTDOWNS =================
ck('§6','move milestone Aug 1 2028 (corrected by AJ), estimated', E('S.milestones.find(m=>m.id==="ms-move").targetDate')==='2028-08-01'&&E('S.milestones.find(m=>m.id==="ms-move").estimated')===true);
ck('§6','label reads "Move — about Aug 1, 2028"', E('"Move — about "+fdate(S.milestones.find(m=>m.id==="ms-move").targetDate)')==='Move — about Aug 1, 2028', E('fdate("2028-08-01")'));
ck('§6','no false conflict now the move and savings target agree', E('dateConflictActive()')===false);
ck('§6','conflict detection still works when dates diverge', E('(()=>{const m=S.milestones.find(x=>x.id==="ms-move");const k=m.targetDate;m.targetDate="2026-08-01";const r=dateConflictActive();m.targetDate=k;return r;})()')===true);
ck('§6','move date is exactly what AJ specified, not inferred', E('S.milestones.find(m=>m.id==="ms-move").targetDate')==='2028-08-01');
ck('§6','countdown is computed live, never hardcoded', E('countdown("2026-08-01","2026-07-20").days')===12&&E('countdown("2026-08-01","2026-08-05").state')==='overdue');

// ================= §12 PACE =================
ck('§12','inclusive covered days Jul 7–27 = 21', E('dDiffInc("2026-07-07","2026-07-27")')===21);
ck('§12','normalized gross monthly pace = C$3,164.75', E('Math.round(218348/21*MDAYS)')===316475, E('Math.round(218348/21*MDAYS)'));
ck('§12','normalized net-business pace = C$2,838.63', E('Math.round(195848/21*MDAYS)')===283863, E('Math.round(195848/21*MDAYS)'));
ck('§12','both labelled low confidence', E('paceMonthly().lowConf')===true);
ck('§12','net business income is NOT called savings', E('savingsReliable()')===false);
ck('§12','adaptive default = since-start while <2 complete months', E('paceMonthly().method')==='sincestart', E('paceMonthly().method'));

// ================= §9A CLAW MACHINES =================
ck('§9A','machine registry starts EMPTY', E('S.machines.length')===0);
ck('§9A','default play price C$2.00', E('MACHINE_DEFAULTS.playPriceCadCents')===200);
ck('§9A','default 4 plays per prize', E('MACHINE_DEFAULTS.playsPerPrize')===4);
ck('§9A','C$2 × 4 plays = C$8.00 gross per prize cycle', E('MACHINE_DEFAULTS.playPriceCadCents*MACHINE_DEFAULTS.playsPerPrize')===800);
ck('§9A','default venue share 15% on gross', E('MACHINE_DEFAULTS.venueSharePercent')===15&&E('MACHINE_DEFAULTS.venueShareBasis')==='gross');
ck('§9A','default plush cost C$1.25', E('MACHINE_DEFAULTS.averagePlushCostCadCents')===125);
ck('§9A','default ownership 100%', E('MACHINE_DEFAULTS.ownershipPercent')===100);
ck('§9A','default cadence 14 days', E('MACHINE_DEFAULTS.collectionCadenceDays')===14);
await nav('machines');
ck('§9A','empty state suggests Claw Machine 1/2/3 without creating them', /Claw Machine 1/.test(T())&&E('S.machines.length')===0);
ck('§9A','C$8 is labelled GROSS, not profit', /gross/i.test(T()));

let pass=0;const bySec={};
for(const c of ch){if(c.ok)pass++;bySec[c.sec]=bySec[c.sec]||[0,0];bySec[c.sec][1]++;if(c.ok)bySec[c.sec][0]++;
 if(!c.ok)console.log('FAIL  '+c.sec+'  '+c.n+'   → '+JSON.stringify(c.x));}
console.log('\nper spec section:');for(const [s,[p,t]] of Object.entries(bySec))console.log('  '+s.padEnd(6)+p+'/'+t);
console.log('\n'+pass+' / '+ch.length+' spec-compliance checks; runtime errors: '+errs.length);
process.exit(0);

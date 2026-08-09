import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(readFileSync('./public/index.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,doc=w.document;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(300);
const E=x=>w.eval(x);const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});
const nav=async r=>{w.location.hash='#/'+r;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(50);};
const pageText=()=>doc.getElementById('page').textContent;

// current month's savings now visible in the schedule
await nav('required');
ck('no false "ahead" claim before any month completes', pageText().includes('No month has completed yet'), pageText().slice(0,160));
const s0=E('JSON.stringify(scheduleFor("low","none",false).rows[0])');
ck('current-month actual is now populated', JSON.parse(s0).actual!==null, s0);
ck('current-month actual is NOT counted against the plan yet', JSON.parse(s0).counted===null);

// strong month redistribution, end to end through the UI layer
const base=E('scheduleFor("low","none",false).original');
const withProj=E('scheduleFor("low","none",true)');
ck('projected toggle changes the revised requirement', E('scheduleFor("low","none",true).revisedPer')!==base, E('scheduleFor("low","none",true).revisedPer')+' vs '+base);
ck('a strong current month LOWERS later requirements', E('scheduleFor("low","none",true).revisedPer')<base, E('scheduleFor("low","none",true).revisedPer')+' < '+base);
ck('deltaPer is negative when ahead', E('scheduleFor("low","none",true).deltaPer')<0);
ck('completed months are never rewritten', E('scheduleFor("low","none",true).rows.filter(r=>r.past).every(r=>r.revised===r.counted)'));
ck('cumulative total covers the full remaining requirement', (()=>{const s=E('scheduleFor("low","none",false)');const last=s.rows[s.rows.length-1];const rem=E('Math.max(0,remainingRange("none").lo)');return Math.abs(last.cum-rem)<=s.rows.length;})(), E('JSON.stringify([scheduleFor("low","none",false).rows.slice(-1)[0].cum, Math.max(0,remainingRange("none").lo)])'));

// high track independent of low track (no midpoint anywhere)
ck('low and high tracks stay independent', E('scheduleFor("high","none",false).original')>E('scheduleFor("low","none",false).original'));
ck('no midpoint value appears in the schedule', !pageText().includes('47,120'));

// loan views shift the requirement without touching the balance
const noLoan=E('scheduleFor("low","none",false).original');
const estLoan=E('scheduleFor("low","estimated",false).original');
ck('estimated loan lowers the monthly requirement', estLoan<noLoan, estLoan+' < '+noLoan);
ck('balance itself is unchanged by loan view', E('confirmedBalance()')===202600);

// what-if: stop earning one month
await nav('required');
const cbs=[...doc.querySelectorAll('#page input[type=checkbox]')];
const stop=cbs[cbs.length-1]; stop.checked=true; stop.dispatchEvent(new w.Event('change',{bubbles:true}));
await sleep(60);
ck('"stop earning for a month" produces a figure', pageText().includes('remaining months would need'), pageText().match(/.{0,60}stop earning.{0,90}/));
ck('no NaN in any Required Pace state', !pageText().includes('NaN'));

let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' schedule checks; runtime errors: '+errs.length);
process.exit(0);

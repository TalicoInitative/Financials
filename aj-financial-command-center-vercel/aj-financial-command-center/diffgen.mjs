import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync,writeFileSync} from 'node:fs';
const dom=new JSDOM(readFileSync('./public/index.html','utf8'),{runScripts:'dangerously',url:'https://localhost/',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
const w=dom.window;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(350);
const E=x=>w.eval(x);
// deterministic PRNG so failures are reproducible
E(`window.__seed=12345;window.__rnd=function(){window.__seed=(window.__seed*1103515245+12345)&0x7fffffff;return window.__seed/0x7fffffff;};`);
const cases=[];
for(let n=0;n<300;n++){
  E(`(function(){
    S=buildSeedState();
    const R=window.__rnd;
    const acc="acct-primary";
    S.transactions=[];
    const types=["business_income","employment_income","business_expense","personal_expense","loan_proceeds","loan_repayment","transfer","refund","gift","adjustment","tax_payment"];
    const stats=["received","paid","pending","planned","cancelled","invoiced"];
    const nTx=2+Math.floor(R()*14);
    for(let i=0;i<nTx;i++){
      const ty=types[Math.floor(R()*types.length)];
      const st=stats[Math.floor(R()*stats.length)];
      const monthOnly=R()<0.15;
      const day=1+Math.floor(R()*27);
      const mo=6+Math.floor(R()*3);
      const iso="2026-"+String(mo).padStart(2,"0")+"-"+String(day).padStart(2,"0");
      const amt=Math.floor(R()*500000)+1;
      const fees=R()<0.3?Math.floor(R()*5000):0;
      const rel=R()<0.2?Math.floor(R()*5000):0;
      const tax=R()<0.15?Math.floor(R()*3000):0;
      S.transactions.push(blankTx({date:monthOnly?null:iso,datePrecision:monthOnly?"month":"day",
        reportingMonth:iso.slice(0,7),type:ty,status:st,sourceName:"C"+Math.floor(R()*5),
        description:"t"+i,categoryId:"K"+Math.floor(R()*4),
        originalAmountCents:amt,convertedCadAmountCents:amt,
        feesCadCents:fees,relatedExpenseCadCents:rel,taxWithheldCadCents:tax,
        recognitionClass:"cash_expense",accountId:acc,
        destinationAccountId:ty==="transfer"?acc:null}));
    }
    S.meta.dataThroughDate="2026-08-31";
    window.__case={
      txs:S.transactions.map(t=>({date:t.date,dp:t.datePrecision,rm:t.reportingMonth,type:t.type,status:t.status,
        conv:t.convertedCadAmountCents,fees:t.feesCadCents,rel:t.relatedExpenseCadCents,tax:t.taxWithheldCadCents})),
      appBalance:calcBalance("2026-08-31"),
      appGross:basisTotals("2026-06-01","2026-08-31").gross,
      appBizExp:basisTotals("2026-06-01","2026-08-31").bizExpAll,
      appNetBiz:basisTotals("2026-06-01","2026-08-31").netBiz,
      appCash:basisTotals("2026-06-01","2026-08-31").cash,
      appJul:monthAgg("2026-07").gross,
      appJulExp:monthAgg("2026-07").bizExpAll
    };
  })()`);
  cases.push(E('JSON.stringify(window.__case)'));
}
writeFileSync('diffcases.json','['+cases.join(',')+']');
console.log('generated',cases.length,'randomized ledgers with the app\'s answers');
// also dump the type table so the oracle uses the SPEC definitions, not the app's
console.log('TX kinds:',E('JSON.stringify(Object.fromEntries(Object.entries(TXT).map(([k,v])=>[k,{kind:v.kind,earned:!!v.earned}])))'));
console.log('COUNTED:',E('JSON.stringify([...COUNTED])'));
process.exit(0);

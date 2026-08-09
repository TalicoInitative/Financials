// Shared fixture: the app now ships empty, so suites install their own data.
export const FIXTURE = `update(s=>{
 s.meta.trackingStartDate="2026-07-07";s.meta.balanceAsOfDate="2026-07-27";s.meta.dataThroughDate="2026-07-27";
 s.accounts[0].manuallyConfirmedBalanceCents=202600;
 s.savingsPlan.asOfDate="2026-07-27";s.savingsPlan.horizonMonths=25;s.savingsPlan.targetDate=mAdd("2026-07-27",25);
 const F=o=>blankTx(Object.assign({accountId:"acct-primary",originalCurrency:"CAD",exchangeRate:1,conversionStatus:"confirmed"},o));
 s.transactions=[
  F({id:"fx-1",date:"2026-07-07",reportingMonth:"2026-07",type:"business_income",status:"received",sourceName:"Placement",description:"Placement income",categoryId:"Placement revenue",originalAmountCents:26400,convertedCadAmountCents:26400,recognitionClass:"earned_income"}),
  F({id:"fx-2",date:"2026-07-08",reportingMonth:"2026-07",type:"business_income",status:"received",sourceName:"Eli",description:"Eli project",categoryId:"Project revenue",originalAmountCents:50000,originalCurrency:"USD",exchangeRate:1.41096,convertedCadAmountCents:70548,conversionStatus:"estimated",recognitionClass:"earned_income"}),
  F({id:"fx-3",date:"2026-07-10",reportingMonth:"2026-07",type:"business_income",status:"received",sourceName:"Placements",description:"Placement income",categoryId:"Placement revenue",originalAmountCents:75400,convertedCadAmountCents:75400,recognitionClass:"earned_income"}),
  F({id:"fx-4",date:"2026-07-16",reportingMonth:"2026-07",type:"business_income",status:"received",sourceName:"Placement",description:"Placement income",categoryId:"Placement revenue",originalAmountCents:46000,convertedCadAmountCents:46000,recognitionClass:"earned_income"}),
  F({id:"fx-5",date:null,datePrecision:"month",reportingMonth:"2026-07",type:"business_expense",status:"paid",sourceName:"Anthropic / Claude",description:"Claude usage",categoryId:"AI and software",originalAmountCents:22500,convertedCadAmountCents:22500,recognitionClass:"cash_expense"}),
  F({id:"fx-6",date:"2026-07-27",reportingMonth:"2026-07",type:"personal_expense",status:"paid",businessPersonal:"personal",sourceName:"Jacket",description:"Jacket",categoryId:"Clothing",originalAmountCents:15000,convertedCadAmountCents:15000,recognitionClass:"cash_expense"})];
 s.meta.buildStamp=BUILD_STAMP;
},"fixture")`;

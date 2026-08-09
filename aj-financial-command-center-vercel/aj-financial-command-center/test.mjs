import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html = readFileSync('/home/claude/app/index.html','utf8');
const js = html.split('<script id="main">')[1].split('</script>')[0];
const windowObj = {__TEST__:true, addEventListener(){}, storage:undefined, innerWidth:1200, location:{hash:''}, history:{replaceState(){}}};
const documentStub = {getElementById(){return null;}, createElement(){return {style:{},append(){},addEventListener(){},setAttribute(){},dataset:{},classList:{add(){},remove(){}}};}, addEventListener(){}, body:{appendChild(){}}, documentElement:{dataset:{}}};
const ctx = {window:windowObj, document:documentStub, console, Intl, Date, Math, JSON, URL, Blob:class{}, setInterval(){}, setTimeout(fn){}, clearTimeout(){}, localStorage:undefined, structuredClone, history:windowObj.history, location:windowObj.location, Number, String, Object, Array, isNaN, isFinite};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(js, ctx, {filename:'main.js'});
const X = windowObj.__exports;
if(!X){console.error('exports missing'); process.exit(1);}
const res = X.runSelfTests();
let pass=0;
for(const r of res){ if(r.pass) pass++; console.log((r.pass?'PASS':'FAIL')+'  '+r.name+(r.pass?'':'   got='+r.got+' want='+r.want)); }
console.log('\n'+pass+' / '+res.length+' tests passing');
process.exit(pass===res.length?0:1);

import {readFileSync} from 'node:fs';
let src=readFileSync('main.js','utf8');
// strip comments and string/template/regex literals so names inside text don't count as code
let out='',i=0,n=src.length;
while(i<n){
  const c=src[i], nx=src[i+1];
  if(c==='/'&&nx==='/'){while(i<n&&src[i]!=='\n')i++;continue;}
  if(c==='/'&&nx==='*'){i+=2;while(i<n&&!(src[i]==='*'&&src[i+1]==='/'))i++;i+=2;continue;}
  if(c==='"'||c==="'"||c==='`'){const q=c;i++;while(i<n){if(src[i]==='\\'){i+=2;continue;}if(src[i]===q){i++;break;}i++;}out+=' "STR" ';continue;}
  out+=c;i++;
}
const code=out;
const declared=new Set(), declOrder=[];
for(const m of code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)){declared.add(m[1]);declOrder.push(m[1]);}
for(const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g)){declared.add(m[1]);declOrder.push(m[1]);}
const calls=new Map();
for(const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)){
  const name=m[1];
  const before=code.slice(Math.max(0,m.index-9),m.index);
  if(/\.\s*$/.test(before))continue;               // method call
  if(/\bfunction\s+$/.test(before))continue;        // declaration
  calls.set(name,(calls.get(name)||0)+1);
}
const KEYWORDS=new Set(['if','for','while','switch','catch','return','typeof','new','function','do','else','await','case','delete','in','of','void','yield','try','throw','instanceof','constructor','super','get','set']);
const GLOBALS=new Set(['Object','Array','String','Number','Boolean','Math','JSON','Date','Set','Map','WeakMap','Promise','Error','TypeError','RangeError','Symbol','Intl','RegExp','isNaN','isFinite','parseInt','parseFloat','encodeURIComponent','decodeURIComponent','setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','fetch','alert','confirm','prompt','Blob','URL','FileReader','File','indexedDB','localStorage','sessionStorage','navigator','document','window','console','structuredClone','queueMicrotask','TextEncoder','TextDecoder','AbortController','Proxy','Reflect','BigInt','Storage','Event','CustomEvent','KeyboardEvent','StorageEvent','MutationObserver','ResizeObserver','IntersectionObserver','history','location','performance','crypto']);
const missing=[...calls.keys()].filter(nm=>!declared.has(nm)&&!KEYWORDS.has(nm)&&!GLOBALS.has(nm));
const never=declOrder.filter(nm=>!calls.has(nm));
const once=declOrder.filter(nm=>calls.get(nm)===1);
console.log('functions declared        :',declared.size);
console.log('distinct names called     :',calls.size);
console.log('\nCALLED BUT NOT DEFINED (would throw if that branch runs):');
console.log(missing.length?missing.map(m=>'  ✗ '+m+'  ('+calls.get(m)+'x)').join('\n'):'  none');
console.log('\nDEFINED BUT NEVER CALLED (dead code / unreachable feature):');
console.log(never.length?never.map(m=>'  ? '+m).join('\n'):'  none');
console.log('\nCalled exactly once (verify reachable):', once.length? once.join(', ') : 'none');

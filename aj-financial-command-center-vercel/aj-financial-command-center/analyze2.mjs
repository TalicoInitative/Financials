import {readFileSync} from 'node:fs';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
const src=readFileSync('main.js','utf8');
const ast=acorn.parse(src,{ecmaVersion:2022,locations:true});
const declared=new Map();   // name -> line
const called=new Map();     // name -> count
const assignedIdents=new Set();
walk.full(ast,node=>{
  if(node.type==='FunctionDeclaration'&&node.id)declared.set(node.id.name,node.loc.start.line);
  if(node.type==='VariableDeclarator'&&node.id.type==='Identifier'&&node.init&&
     (node.init.type==='FunctionExpression'||node.init.type==='ArrowFunctionExpression'))
     declared.set(node.id.name,node.loc.start.line);
  if(node.type==='CallExpression'&&node.callee.type==='Identifier')
     called.set(node.callee.name,(called.get(node.callee.name)||0)+1);
  if(node.type==='Identifier')assignedIdents.add(node.name);
});
const GLOBALS=new Set(['Object','Array','String','Number','Boolean','Math','JSON','Date','Set','Map','WeakMap','Promise','Error','TypeError','Symbol','Intl','RegExp','isNaN','isFinite','parseInt','parseFloat','encodeURIComponent','decodeURIComponent','setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','fetch','Blob','URL','FileReader','indexedDB','structuredClone','queueMicrotask','BigInt','alert','confirm','prompt','escape','unescape']);
const missing=[...called.keys()].filter(n=>!declared.has(n)&&!GLOBALS.has(n));
const never=[...declared.keys()].filter(n=>!called.has(n));
console.log('functions/arrow-consts declared :',declared.size);
console.log('distinct functions called       :',called.size);
console.log('\n=== CALLED BUT NEVER DEFINED (would throw on that path) ===');
console.log(missing.length?missing.map(m=>'  ✗ '+m+' ('+called.get(m)+'x)').join('\n'):'  none ✓');
console.log('\n=== DEFINED BUT NEVER CALLED (dead code / unreachable) ===');
console.log(never.length?never.map(m=>'  ? '+m+'  (line '+declared.get(m)+')').join('\n'):'  none ✓');
// duplicate declarations (silent shadowing)
const seen=new Map(),dups=[];
walk.full(ast,node=>{
  if(node.type==='FunctionDeclaration'&&node.id){
    if(seen.has(node.id.name))dups.push(node.id.name+' (lines '+seen.get(node.id.name)+' and '+node.loc.start.line+')');
    else seen.set(node.id.name,node.loc.start.line);}
});
console.log('\n=== DUPLICATE FUNCTION DECLARATIONS (silent shadowing) ===');
console.log(dups.length?dups.map(d=>'  ! '+d).join('\n'):'  none ✓');
// empty catch blocks that could hide real errors
let emptyCatch=0;walk.full(ast,n=>{if(n.type==='CatchClause'&&n.body.body.length===0)emptyCatch++;});
console.log('\nempty catch blocks (silently swallow errors):',emptyCatch);
// await inside a non-async function (would throw)
console.log('total AST nodes parsed:', (()=>{let c=0;walk.full(ast,()=>c++);return c;})());

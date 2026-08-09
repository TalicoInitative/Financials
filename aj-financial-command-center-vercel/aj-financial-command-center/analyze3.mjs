import {readFileSync} from 'node:fs';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
const src=readFileSync('main.js','utf8');
const lines=src.split('\n');
const ast=acorn.parse(src,{ecmaVersion:2022,locations:true});
const refs=new Map();
walk.full(ast,n=>{if(n.type==='Identifier')refs.set(n.name,(refs.get(n.name)||0)+1);});
const suspects=['num','esc','linkBackupFile','restoreFromBackupFile','unlinkBackupFile','upsertCollectionPostings','renderOverview','renderSettings','applyCollectionPostings','watchOtherTabs','externalChangeBanner','requestPersistence','doRedo','overlappingCollections','upsertById','savingsFor','measuredMonths','savingsCoverage','checkpointFor','txExists','reconnectBackupFile','writeBackupFile','idbGet','idbSet','idbDel'];
console.log('=== TRUE REFERENCE COUNTS (1 = declaration only → genuinely dead) ===');
for(const s of suspects){const c=refs.get(s)||0;console.log('  '+(c<=1?'DEAD  ':'used  ')+s.padEnd(28)+c+' reference(s)');}
console.log('\n=== EMPTY CATCH BLOCKS (silently swallow errors) ===');
walk.full(ast,n=>{
  if(n.type==='CatchClause'&&n.body.body.length===0){
    const ln=n.loc.start.line;
    console.log('  line '+String(ln).padStart(4)+': '+lines[ln-1].trim().slice(0,105));
  }});
console.log('\n=== FUNCTIONS >80 LINES (complexity hotspots) ===');
walk.full(ast,n=>{
  if((n.type==='FunctionDeclaration')&&n.id){
    const len=n.loc.end.line-n.loc.start.line;
    if(len>80)console.log('  '+n.id.name.padEnd(24)+len+' lines');
  }});
console.log('\n=== ASSIGNMENTS TO UNDECLARED GLOBALS (implicit leaks) ===');
const declaredNames=new Set();
walk.full(ast,n=>{
  if(n.type==='VariableDeclarator'&&n.id.type==='Identifier')declaredNames.add(n.id.name);
  if(n.type==='FunctionDeclaration'&&n.id)declaredNames.add(n.id.name);
  if(n.type==='FunctionDeclaration'||n.type==='FunctionExpression'||n.type==='ArrowFunctionExpression')
    for(const p of n.params||[])if(p.type==='Identifier')declaredNames.add(p.name);
});
const leaks=new Set();
walk.full(ast,n=>{
  if(n.type==='AssignmentExpression'&&n.left.type==='Identifier'&&!declaredNames.has(n.left.name))leaks.add(n.left.name);
});
console.log(leaks.size?[...leaks].map(l=>'  ! '+l).join('\n'):'  none ✓');

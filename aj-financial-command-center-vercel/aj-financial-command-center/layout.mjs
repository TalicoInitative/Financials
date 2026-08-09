// Static layout audit — jsdom can't compute layout, so verify the CSS/DOM contract directly.
import {readFileSync} from 'node:fs';
const src=readFileSync('./public/index.html','utf8');
const html=(src.match(/<body[^>]*>([\s\S]*?)<\/body>/)||[,src.split('</style>')[1]])[1];
const css=src.split('<style>')[1].split('</style>')[0];
const ch=[];const ck=(n,ok,x)=>ch.push({n,ok,x});
const rule=sel=>{const m=css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{([^}]*)\\}'));return m?m[1]:null;};

// --- the containers the app actually creates ---
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
for(const id of ['app','reconStrip','topbar','frame','sidenav','page','bottomnav','modalhost','snack'])
  ck('DOM has #'+id, ids.includes(id));
ck('DOM has a <main> wrapper', /<main>/.test(html));

// --- the frame must actually lay out ---
const app=rule('#app');
ck('#app is a flex column filling the viewport', /display:flex/.test(app)&&/flex-direction:column/.test(app)&&/height:100vh/.test(app), app);
const frame=rule('#frame');
ck('#frame is the two-column grid', /display:grid/.test(frame)&&/grid-template-columns:206px 1fr/.test(frame), frame);
ck('#frame can shrink (min-height:0) so the scroller works', /min-height:0/.test(frame), frame);
ck('main scrolls vertically', /#frame>main\{[^}]*overflow-y:auto/.test(css));
ck('no orphaned grid-area rules remain', !/grid-area:(strip|nav|main)/.test(css), (css.match(/grid-area:[a-z]+/g)||[]).join(','));
ck('no CSS targets a non-existent #main id', !/#main\{/.test(css));
ck('reconStrip is a flex child, not a grid area', /#reconStrip\{flex:none/.test(css));
ck('topbar is a flex child, not sticky inside a broken scroller', /#topbar\{flex:none/.test(css));

// --- contrast: text must never match its background ---
const varsOf=(sel)=>{const m=css.match(new RegExp(sel.replace(/[[\]]/g,'\\$&')+'\\{([\\s\\S]*?)\\n\\}'));
  return m?Object.fromEntries([...m[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(x=>[x[1],x[2].trim()])):{};};
const dark=varsOf(':root');
const lm=css.match(/\[data-theme="light"\]\{([\s\S]*?)\n\}/);
const light=lm?Object.fromEntries([...lm[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(x=>[x[1],x[2].trim()])):{};
ck('dark theme defines a background', !!dark['--bg'], dark['--bg']);
ck('dark background is actually dark', /^#0[0-9a-f]/.test(dark['--bg']||''), dark['--bg']);
ck('dark text is light', /^#[ef]/.test(dark['--text']||''), dark['--text']);
ck('light theme background is light', /^#f|^#ffffff/.test(light['--bg']||''), light['--bg']);
ck('light text is dark', /^#0/.test(light['--text']||''), light['--text']);
ck('no bare body{background:#fff} outside the print block', (()=>{
  const printAt=css.indexOf('@media print');
  const before=css.slice(0,printAt);
  return !/body\{[^}]*background:#fff/.test(before);})());

// --- the app must paint even if scripting/storage fails ---
ck('body carries a background so a failed boot is not blank white', /body\{[^}]*background:var\(--bg\)/.test(css));
ck('storage calls are time-limited', /function withTimeout/.test(src));
ck('shell renders before storage is read', /if\(!S\)\{S=buildSeedState\(\);applyTheme\(\);try\{render\(\);\}catch/.test(src));
ck('a last-resort paint exists', /Storage was slow to respond/.test(src));

let pass=0;for(const c of ch){if(c.ok)pass++;console.log((c.ok?'PASS':'FAIL')+'  '+c.n+(c.ok?'':'   → '+JSON.stringify(c.x)));}
console.log('\n'+pass+' / '+ch.length+' layout checks');
process.exit(pass===ch.length?0:1);

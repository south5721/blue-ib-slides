import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {planBlue} from './diagram-system.mjs';
import {planEditorial} from './editorial-system.mjs';
import {planTemplateRelations} from './template-relations.mjs';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const theme=JSON.parse(fs.readFileSync(path.join(root,'assets/native-theme.json'),'utf8'));
export function dependency(name){
 try{return createRequire(import.meta.url)(name)}catch(e){
  if(e.code!=='MODULE_NOT_FOUND')throw e;
  throw new Error(`Missing ${name}; run npm ci --ignore-scripts in the skill directory.`);
 }
}
const canvas=dependency('@napi-rs/canvas');
const office='/Applications/Microsoft PowerPoint.app/Contents/Resources/DFonts';
for(const [file,name] of [['Deng.ttf','DengXian'],['Dengb.ttf','DengXian'],['arial.ttf','Arial'],['arialbd.ttf','Arial'],['Kaiti.ttf','KaiTi']]){
  const p=path.join(office,file);if(fs.existsSync(p))canvas.GlobalFonts.registerFromPath(p,name);
}
// Register only local, existing font files. Never download or silently substitute a font.
for(const p of (process.env.BLUE_IB_FONT_FILES||'').split(path.delimiter).filter(Boolean)){
  if(!fs.existsSync(p))throw new Error(`Font file not found: ${p}`);
  canvas.GlobalFonts.registerFromPath(p);
}
const displayFont=path.join(os.homedir(),'Library/Fonts/YouSheBiaoTiHei-2.ttf');
if(fs.existsSync(displayFont))canvas.GlobalFonts.registerFromPath(displayFont,'优设标题黑');
export const latinFor=(font)=>font;
export const availableFonts=canvas.GlobalFonts.families.map(f=>f.family);
export function resolveFont(requested){
  const font=requested||process.env.BLUE_IB_FONT||theme.fontCandidates.find(f=>availableFonts.includes(f));
  if(!font||!availableFonts.includes(font))throw new Error(`Font unavailable: ${requested||theme.fontCandidates.join(', ')}. Supply BLUE_IB_FONT_FILES or an installed deck.font; render with the same font.`);
  const ctx=canvas.createCanvas(20,20).getContext('2d');ctx.font=`24px "${font}"`;
  if(ctx.measureText('中文排版').width<=0)throw new Error(`CJK font measurement failed: ${font}`);
  return font;
}
const ctx=canvas.createCanvas(20,20).getContext('2d');
export function width(text,size,font,bold=false){
  return (String(text).match(/[\u0000-\u024f]+|[^\u0000-\u024f]+/gu)||[]).reduce((sum,run)=>{
    ctx.font=`${bold?'700':'400'} ${size*96/72}px "${/^[\u0000-\u024f]/.test(run)?latinFor(font):font}"`;
    return sum+ctx.measureText(run).width/96;
  },0);
}
const CLOSE=/^[，。；：？！、）】》」』,.!?;:%‰]/;
export function wrap(text,w,size,font,bold=false){
  const lines=[];const max=w*theme.typography.widthSafety;
  for(const paragraph of String(text??'').split('\n')){
    if(!paragraph){lines.push('');continue}
    // Latin words, dates, and numerical units stay together when possible.
    const tokens=paragraph.match(/[A-Za-z0-9]+(?:[.,:/%+–—\-][A-Za-z0-9]+)*%?|\s+|[^\x00-\x7F]|./gu)||[];
    let line='';
    for(const token of tokens){
      if(width(line+token,size,font,bold)<=max||!line||CLOSE.test(token)){
        if(width(token,size,font,bold)>max){
          for(const ch of [...token]){if(line&&width(line+ch,size,font,bold)>max){lines.push(line.trimEnd());line=''}line+=ch}
        }else line+=token;
      }else{lines.push(line.trimEnd());line=token.trimStart()}
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
export function measure(text,w,size,font,bold=false,{reserve=0,lh=1.25}={}){
  const lines=wrap(text,w,size,font,bold);
  const reserved=reserve?Math.max(lines.length+1,Math.ceil(lines.length*(1+reserve))):lines.length;
  return {lines,text:lines.join('\n'),height:reserved*size/72*lh+0.055,actualHeight:lines.length*size/72*lh+0.055};
}
export function pickSize(text,w,h,sizes,font,bold=false,opts={}){
  for(const size of sizes){const m=measure(text,w,size,font,bold,opts);if(m.height<=h+0.001)return {...m,size}}
  return null;
}
export function titlePlan(title,font,profile){
  for(const size of profile.title){const m=measure(title,12.08,size,font,true,{lh:1.12});if(m.lines.length<=2)return {...m,size}}
  throw new Error(`Title exceeds two lines at its size floor; revise the title, keeping qualifications in the subtitle: ${title}`);
}
export function designSystem(deck={},slide={}){
  const system=slide.designSystem||deck.designSystem||'blue-ib';
  if(!['blue-ib','blue-editorial','legacy-blue','report'].includes(system))throw new Error(`Unknown designSystem: ${system}; choose an explicit supported style instead of silently falling back`);
  return system;
}
export function normalizeSlide(s,system='blue-ib'){
  let type=s.layout||'auto';
  if(type==='auto'){
    if(['blue-ib','blue-editorial'].includes(system)&&s.roof&&s.pillars)type='strategyHouse';
    else if(['blue-ib','blue-editorial'].includes(system)&&s.relationship==='cycle'&&s.steps)type='cycleEvidence';
    else if(['blue-ib','blue-editorial'].includes(system)&&s.relationship==='sequence'&&s.steps)type='phaseBand';
    else if(s.tasks&&s.range)type='timeline';
    else if(s.items&&s.relationship==='agenda')type='agenda';
    else if(['comparison','challenge-solution'].includes(s.relationship)&&s.pairs)type='comparison';
    else if(s.relationship==='comparison'&&s.columns&&s.rows)type='comparisonMatrix';
    else if(s.series&&s.categories&&s.kpis)type='chartBrief';
    else if(s.relationship==='cause-effect'&&s.pairs)type='causeEffect';
    else if(s.relationship==='shared-hub'&&s.hub)type='hubEvidence';
    else if(s.relationship==='peers'&&s.modules)type='peerColumns';
    else if(s.evidenceRows)type='evidenceRows';
    else if(s.rows&&s.columns)type='table';
    else if(s.series&&s.categories)type='barChart';
    else if(s.relationship==='sequence'||s.steps)type='flow';
    else if(s.kpis)type='kpis';
    else if(s.modules||s.cards)type='cards';
    else if(s.bullets)type='bullets';
    else throw new Error('auto layout needs modules, bullets, steps, table, or chart evidence');
  }
  if(!['cover','divider','cards','bullets','flow','kpis','table','barChart','peerColumns','evidenceRows','causeEffect','hubEvidence','dualChart','chartBrief','comparison','comparisonMatrix','timeline','agenda','strategyHouse','cycleEvidence','phaseBand'].includes(type))throw new Error(`Unsupported layout: ${type}`);
  return {...s,layout:type};
}
function rowPlans(items,box,font,profile,reserve){
  // Pick a single size for the whole semantic group. Paginate before stepping down.
  const statement=items.length===1&&String(items[0].text??items[0].body??'').length<100;
  if(statement){
    const it=items[0],size=28,head=24,heading=String(it.heading??it.title??'');
    const text=[it.text??it.body??'',it.metric||''].filter(Boolean).join('\n');
    const hm=measure(heading,box.w,head,font,true),tm=measure(text,box.w-1,size,font,false,{reserve});
    if(hm.height+tm.height+0.8<=box.h)return [{mode:'statement',heading,text,hm,tm,size,head}];
  }
  const size=profile.body[0],head=profile.heading.at(-1);
  const hw=2.38,tw=box.w-hw-0.28;
  const rows=items.map((it,i)=>{
    const heading=String(it.heading??it.title??`要点 ${i+1}`),text=[it.text??it.body??'',it.metric||''].filter(Boolean).join('\n');
    const hm=measure(heading,hw,head,font,true),tm=measure(text,tw,size,font,false,{reserve});
    return {heading,text,index:i+1,hm,tm,height:Math.max(hm.height,tm.height)+0.30};
  });
  const pages=[];let group=[],used=0;
  for(const row of rows){
    if(row.height>box.h)throw new Error(`One module exceeds a page at ${size}pt; split it at a semantic boundary: ${row.heading}`);
    if(group.length&&used+row.height>box.h){pages.push({mode:'rows',rows:group,size,head,hw});group=[];used=0}
    group.push(row);used+=row.height;
  }
  if(group.length)pages.push({mode:'rows',rows:group,size,head,hw});return pages;
}
export function modulePlans(items,box,font,profile,reserve){
  if(!items.length)throw new Error('No modules');
  if(items.length>4)return rowPlans(items,box,font,profile,reserve);
  const bodies=items.map(x=>String(x.body??x.text??''));
  const asymmetric=Math.max(...bodies.map(t=>t.length))/Math.max(1,Math.min(...bodies.map(t=>t.length)))>2.4;
  if(asymmetric||bodies.some(t=>t.length>100))return rowPlans(items,box,font,profile,reserve);
  const n=items.length,cols=n===4?2:n,gap=0.36,cw=(box.w-gap*(cols-1))/cols;
  const breathing=n<=2&&bodies.reduce((a,t)=>a+t.length,0)<=90;
  const size=breathing?24:profile.body[0],head=breathing?24:profile.heading[0],rowCount=Math.ceil(n/cols),ch=(box.h-(rowCount-1)*0.34)/rowCount;
  const modules=items.map((it,i)=>{
    const hm=measure(it.title??it.heading,cw,head,font,true),tm=measure(it.body??it.text??'',cw,size,font,false,{reserve});
    const mm=it.metric?measure(it.metric,cw,18,font,true):null;
    return {...it,hm,tm,mm,col:i%cols,row:Math.floor(i/cols)};
  });
  if(modules.some(x=>x.hm.height+x.tm.height+(x.mm?.height||0)+0.76>ch))return rowPlans(items,box,font,profile,reserve);
  return [{mode:'columns',modules,size,head,cw,ch,gap,breathing}];
}
export function tablePlans(s,box,font,profile){
  if(!s.columns?.length||!s.rows?.length)throw new Error('Table needs columns and rows');
  if(s.rows.some(r=>r.length!==s.columns.length))throw new Error('Table column mismatch');
  const n=s.columns.length;if(n>10)throw new Error('More than ten columns requires an explicit horizontal split with key columns repeated');
  let weights=s.colWidths;
  if(weights&&(!Array.isArray(weights)||weights.length!==n||weights.some(x=>!Number.isFinite(x)||x<=0)))throw new Error('Invalid colWidths');
  if(!weights){weights=s.columns.map((h,c)=>Math.min(2.5,Math.max(1.15,Math.sqrt(Math.max(...[h,...s.rows.map(r=>r[c])].map(x=>String(x).length)))/2)));}
  const widths=weights.map(x=>x/weights.reduce((a,b)=>a+b,0)*box.w);
  const size=profile.table.at(-1),pad=0.12;
  const cells=(r,bold)=>r.map((x,i)=>measure(String(x),widths[i]-2*pad,size,font,bold));
  const headers=cells(s.columns,true),hh=Math.max(...headers.map(c=>c.height))+2*pad;
  const pages=[];let rs=[],hs=[],ms=[],height=hh;
  for(let i=0;i<s.rows.length;i++){
    const mm=cells(s.rows[i],false),rh=Math.max(...mm.map(c=>c.height))+2*pad;
    if(rh+hh>box.h)throw new Error(`Table row ${i+1} exceeds page at table floor ${size}pt; restructure columns or split the row with an explicit continuation key`);
    if(rs.length&&height+rh>box.h){pages.push({mode:'table',rows:rs,heights:hs,measures:ms,headers,hh,widths,size,pad});rs=[];hs=[];ms=[];height=hh}
    rs.push(s.rows[i]);hs.push(rh);ms.push(mm);height+=rh;
  }
  if(rs.length)pages.push({mode:'table',rows:rs,heights:hs,measures:ms,headers,hh,widths,size,pad});return pages;
}
function paginateMeasured(rows,box,base){
  const pages=[];let group=[],used=0;
  for(const row of rows){
    if(row.height>box.h)throw new Error('A relationship row exceeds one page at the role font floor; split its evidence explicitly');
    if(group.length&&used+row.height>box.h){pages.push({...base,rows:group});group=[];used=0}
    group.push(row);used+=row.height;
  }
  if(group.length)pages.push({...base,rows:group});return pages;
}
function referencePlans(s,box,font,profile,reserve){
  const size=profile.body[0],head=profile.heading.at(-1);
  if(s.layout==='peerColumns'){
    const items=s.modules||s.cards;
    if(!Array.isArray(items)||items.length<2||items.length>4)throw new Error('peerColumns needs 2–4 actual peer modules; never invent a fourth to fill a grid');
    const gap=.36,cw=(box.w-gap*(items.length-1))/items.length;
    const modules=items.map(it=>({...it,hm:measure(it.title,cw-.18,head,font,true),am:measure(it.action||'',cw,size,font,true),tm:measure(it.body||'',cw,size,font,false,{reserve})}));
    const hh=Math.max(...modules.map(x=>x.hm.height)),ah=Math.max(...modules.map(x=>x.am.height)),bh=Math.max(...modules.map(x=>x.tm.height));
    if(.78+hh+.32+ah+.24+bh>box.h)return rowPlans(items.map(it=>({heading:it.title,text:[it.action,it.body].filter(Boolean).join('\n')})),box,font,profile,reserve);
    return [{mode:'peerColumns',modules,cw,gap,size,head,hh,ah}];
  }
  if(s.layout==='evidenceRows'){
    if(!s.evidenceRows?.length)throw new Error('evidenceRows needs nonempty rows');
    const widths=[box.w*.16,box.w*.48,box.w*.30],gap=box.w*.03;
    const rows=s.evidenceRows.map((r,i)=>{const texts=[r.label,r.evidence,r.implication];if(texts.some(t=>typeof t!=='string'||!t.trim()))throw new Error('Evidence row needs label, evidence, implication');const ms=texts.map((t,j)=>measure(t,widths[j]-.16,j===0?head:size,font,j===0,{reserve:j?reserve:0}));return {texts,ms,height:Math.max(...ms.map(x=>x.height))+.40,index:i+1}});
    return paginateMeasured(rows,box,{mode:'evidenceRows',widths,gap,size,head});
  }
  if(s.layout==='causeEffect'){
    if(!s.pairs?.length||!s.conclusion?.body)throw new Error('causeEffect needs causal pairs and a supported conclusion; arrows must encode a declared relationship');
    const left=box.w*.70,cause=left*.43,effect=left*.49,gap=left*.08,sw=box.w-left-.42;
    const hm=measure(s.conclusion.title||'归纳',sw-.38,head,font,true),tm=measure(s.conclusion.body,sw-.38,size,font,false,{reserve});
    if(hm.height+tm.height+.75>box.h)throw new Error('Conclusion exceeds the relationship panel; shorten with permission or continue on another page');
    const rows=s.pairs.map((r,i)=>{if(!r.cause||!r.effect)throw new Error('Each pair needs cause and effect');const cm=measure(r.cause,cause-.28,size,font,false,{reserve}),em=measure(r.effect,effect-.28,size,font,false,{reserve});return {...r,cm,em,height:Math.max(cm.height,em.height)+.38,index:i+1}});
    return paginateMeasured(rows,box,{mode:'causeEffect',left,cause,effect,gap,sw,hm,tm,size,head});
  }
  if(s.layout==='hubEvidence'){
    if(!s.hub?.title||!s.branches?.length)throw new Error('hubEvidence needs a shared hub and supporting branches');
    const hubw=2.75,rw=box.w-hubw-.65,hw=2.0;
    const hm=measure(s.hub.title,hubw-.60,head,font,true),tm=measure(s.hub.body||'',hubw-.60,size,font,false);
    if(hm.height+tm.height+.40>hubw-.45)throw new Error('Hub label is too long for a circle; use a labeled panel instead');
    const rows=s.branches.map((r,i)=>{const h=measure(r.title,hw,head,font,true),t=measure(r.body,rw-hw-.36,size,font,false,{reserve});return {heading:r.title,text:r.body,hm:h,tm:t,height:Math.max(h.height,t.height)+.40,index:i+1}});
    return paginateMeasured(rows,box,{mode:'hubEvidence',hubw,rw,hw,hm,tm,size,head});
  }
}
export function planDeck(deck){
  if(!Array.isArray(deck.slides)||!deck.slides.length)throw new Error('slides must be nonempty');
  if(deck.fontProfile&&!['template-kai','business-sans'].includes(deck.fontProfile))throw new Error('Unknown fontProfile');
  if(deck.palette&&!theme.palettes?.[deck.palette])throw new Error('Unknown palette; choose a declared whole-deck palette');
  const system=designSystem(deck);
  const preferred=deck.font||process.env.BLUE_IB_FONT||(deck.fontProfile==='template-kai'?'KaiTi':!deck.fontProfile&&system==='blue-ib'&&availableFonts.includes('优设标题黑')?'优设标题黑':undefined);
  const font=resolveFont(preferred),profile=theme.profiles[deck.profile||'desk'];if(!profile)throw new Error('profile must be desk or projection');
  const pages=[];const decisions=[];
  for(let i=0;i<deck.slides.length;i++){
    const pageSystem=designSystem(deck,deck.slides[i]);
    const s={...normalizeSlide(deck.slides[i],pageSystem),designSystem:pageSystem};s.title=s.title||deck.title;if(!s.title)throw new Error(`slide ${i+1} has no title`);
    const title=titlePlan(s.title,font,profile);const sub=s.subtitle||s.banner||'';
    const subtitle=sub?measure(sub,12.08,profile.body.at(-1),font):null;
    if(subtitle&&subtitle.lines.length>3)throw new Error(`slide ${i+1}: subtitle longer than three lines; move it into the main content`);
    const top=0.35+title.height+0.26+(subtitle?subtitle.height+0.22:0);
    const box={x:0.62,y:top,w:12.093333,h:6.62-top};
    const reserve=s.editReserve??deck.editReserve??0.30;if(reserve<0||reserve>0.5)throw new Error('editReserve must be 0–0.5');
    let plans;
    const diagram=(s.designSystem||deck.designSystem)==='blue-ib'?planBlue(s,{font,profile,measure,wrap,reserve,policy:s.layoutPolicy||deck.layoutPolicy||'adaptive'}):null;
    const editorial=(s.designSystem==='blue-editorial'||(s.designSystem==='blue-ib'&&['agenda','comparison','comparisonMatrix','timeline','chartBrief'].includes(s.layout)))?planEditorial({...s,author:s.author||deck.author},{box,font,profile,measure,reserve}):null;
    if(diagram)plans=diagram;
    else if(['strategyHouse','cycleEvidence','phaseBand'].includes(s.layout))plans=planTemplateRelations(s,{box,font,profile,measure,reserve});
    else if(editorial)plans=editorial;
    else if(['peerColumns','evidenceRows','causeEffect','hubEvidence'].includes(s.layout))plans=referencePlans(s,box,font,profile,reserve);
    else if(s.layout==='cards')plans=modulePlans(s.modules||s.cards,box,font,profile,reserve);
    else if(s.layout==='bullets')plans=rowPlans(s.bullets.map((x,j)=>typeof x==='string'?{heading:`${j+1}`,text:x}:x),box,font,profile,reserve);
    else if(s.layout==='flow')plans=rowPlans([...s.steps.map(x=>({heading:`${x.date||''} ${x.title}`.trim(),text:x.text})),...(s.summary?[{heading:'结论',text:s.summary}]:[])],box,font,profile,reserve);
    else if(s.layout==='table')plans=tablePlans(s,box,font,profile);
    else if(s.layout==='barChart'){
      if(!s.categories?.length||!s.series?.length)throw new Error('Chart needs categories and series');
      for(const v of s.series)if(v.values?.length!==s.categories.length||v.values.some(x=>!Number.isFinite(x)))throw new Error('Chart values must be finite and match categories; never fill missing values with zero');
      if(s.series.length>3||s.categories.length>8)throw new Error('Chart exceeds the readable 8-category/3-series native preset; split explicitly, preserving the comparison and axis scale');
      plans=[{mode:'chart'}];
    }else plans=[{mode:s.layout}];
    plans.forEach((p,k)=>pages.push({s,p,title,subtitle,box,inputIndex:i+1,continuation:k+1,continuations:plans.length,reserve}));
    decisions.push({inputSlide:i+1,title:s.title,requested:s.layout,composition:plans[0].mode,outputPages:plans.length,bodyFont:plans[0].size??profile.body[0],reason:plans.length>1?'Paginated complete content at the group font size':plans[0].mode==='rows'?'Text length, asymmetry, or module count favors aligned rows':'Content fits the selected composition'});
  }
  if(deck.expectedSlides&&deck.expectedSlides!==pages.length)throw new Error(`Planned ${pages.length} slides, requested ${deck.expectedSlides}; content needs a reviewed layout or content decision, never silent truncation`);
  return {font,profile,pages,decisions};
}

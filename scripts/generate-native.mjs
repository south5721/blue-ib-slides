#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {dependency,theme,root,planDeck,measure,wrap,latinFor} from './native-layout.mjs';
import {renderBlue,drawSemanticIcon} from './diagram-system.mjs';
import {renderEditorial} from './editorial-system.mjs';
import {renderTemplateRelations} from './template-relations.mjs';
const [input,output]=process.argv.slice(2);
if(!input||!output){console.error('node generate-pptx.mjs deck.json out.pptx');process.exit(2)}
try{
if(fs.existsSync(path.resolve(output)))throw new Error('Output already exists; choose a new versioned path. Source files are never overwritten.');
const deck=JSON.parse(fs.readFileSync(input,'utf8')),plan=planDeck(deck);
const PPTX=dependency('pptxgenjs'),pptx=new PPTX();
pptx.layout='LAYOUT_WIDE';pptx.title=deck.title||'Blue IB';pptx.author=deck.author||'';pptx.company=deck.company||'';pptx.lang='zh-CN';
pptx.theme={headFontFace:plan.font,bodyFontFace:plan.font,lang:'zh-CN'};
const C={...theme.colors,...(theme.palettes?.[deck.palette]||{})},R=pptx.ShapeType;const pages=[],nativePatches={};let num=0,objects=[];
function nativeStyle(id,xml){(nativePatches[`ppt/slides/slide${num}.xml`]??={})[id]=xml;}
function rule(s,x,y,w,color=C.rule){s.addShape(R.line,{x,y,w,h:0,line:{color,width:0.65}})}
function text(s,id,t,x,y,w,h,size,opts={}){
 if([x,y,w,h,size].some(v=>!Number.isFinite(v))||w<=0||h<=0)throw new Error(`${id}: invalid/non-finite text frame; generation stopped`);
 const m=measure(t,w,size,plan.font,opts.bold||false,{lh:opts.lh||1.25});
 if(m.actualHeight>h+0.015)throw new Error(`${id}: needs ${m.actualHeight.toFixed(2)}in, has ${h.toFixed(2)}in at ${size}pt; reflow first`);
 s.addText(m.text,{x,y,w,h,fontFace:plan.font,fontSize:size,color:C.ink,margin:0,valign:'top',fit:'none',lineSpacingMultiple:1.1,paraSpaceAfterPt:0,objectName:id,lang:'zh-CN',...opts});
 objects.push({id,text:String(t),x,y,w,h,size,lines:m.lines.length,measuredHeight:m.actualHeight});
}
function chrome(s,p){
 if((p.s.designSystem||deck.designSystem||'blue-ib')==='blue-ib'&&(p.s.skin||deck.skin)!=='report'){
  renderBlue(s,{...p,p:{...p.p,mode:'blueChrome',titleSize:p.title.size,titleHeight:p.title.height,subtitleSize:plan.profile.body.at(-1)}},{pptx,R,root,measure,font:plan.font,objects,nativeStyle,deck,num});return;
 }
 const graphical=(p.s.skin||deck.skin)==='diagram'||(p.s.designSystem||deck.designSystem||'blue-editorial')==='blue-editorial';
 s.background={color:C.white};text(s,'title',p.s.title,.62,.34,12.09,p.title.height,p.title.size,{bold:true,color:graphical?C.brand:C.title,lh:1.12});
 rule(s,.62,.34+p.title.height+.12,12.09,C.rule);
 if(p.subtitle)text(s,'subtitle',p.s.subtitle||p.s.banner,.62,.34+p.title.height+.28,12.09,p.subtitle.height,plan.profile.body.at(-1),{color:C.secondary});
 const source=p.s.source??deck.source??'';
 if(source){const m=measure(source,11.45,plan.profile.caption,plan.font);if(m.lines.length>2)throw new Error('Source exceeds two lines');text(s,'source',source,.62,6.86,11.45,.40,plan.profile.caption,{color:C.secondary})}
 text(s,'footer',deck.footer||deck.company||'',.62,7.24,10.9,.20,9,{color:C.secondary});
 text(s,'page',String(num).padStart(2,'0')+(p.continuations>1?` · ${p.continuation}/${p.continuations}`:''),11.45,7.20,1.26,.25,10,{color:C.secondary,align:'right'});
}
function rows(s,q){
 const{p,box}=q,used=p.rows.reduce((a,b)=>a+b.height,0),extra=Math.min(.18,Math.max(0,(box.h-used)/p.rows.length));let y=box.y+.10;
 for(const r of p.rows){text(s,`row-${r.index}-heading`,r.heading,box.x,y,p.hw,r.hm.height,p.head,{bold:true,color:C.navy});text(s,`row-${r.index}-body`,r.text,box.x+p.hw+.28,y,box.w-p.hw-.28,r.tm.height,p.size);y+=r.height+extra;if(r!==p.rows.at(-1))rule(s,box.x,y-.13,box.w)}
}
function columns(s,q){
 const{p,box}=q;
 p.modules.forEach((m,i)=>{const x=box.x+(p.cw+p.gap)*m.col,y=box.y+(p.ch+.34)*m.row;
    rule(s,x,y+.08,p.cw,C.brand);text(s,`module-${i+1}-heading`,m.title??m.heading,x,y+.27,p.cw,m.hm.height,p.head,{bold:true,color:C.navy});
 const by=y+.27+m.hm.height+(p.breathing?.5:.22);text(s,`module-${i+1}-body`,m.body??m.text??'',x,by,p.cw,m.tm.height,p.size);
 if(m.metric)text(s,`module-${i+1}-metric`,m.metric,x,by+m.tm.height+.22,p.cw,m.mm.height,18,{bold:true,color:C.brand})});
}
function statement(s,q){const {p,box}=q;const y=box.y+.40;text(s,'statement-heading',p.heading,box.x,y,box.w,p.hm.height,p.head,{bold:true,color:C.navy});text(s,'statement-body',p.text,box.x,y+p.hm.height+.50,box.w-1,p.tm.height,p.size);}
function peerColumns(s,q){
 const{p,box}=q;
 p.modules.forEach((m,i)=>{const x=box.x+i*(p.cw+p.gap),y=box.y+.04;
  s.addShape(R.ellipse,{x:x+p.cw/2-.30,y,w:.60,h:.60,fill:{color:C.brand},line:{color:C.brand}});
  if(m.icon)drawSemanticIcon(s,pptx,m.icon,x+p.cw/2-.18,y+.12,.36);
  else text(s,`peer-${i+1}-number`,String(i+1),x+p.cw/2-.14,y+.14,.28,.30,16,{bold:true,color:C.white,align:'center'});
  const hy=y+.78;
  s.addShape(R.roundRect,{x,y:hy-.06,w:p.cw,h:p.hh+.12,radius:.08,rectRadius:.08,fill:{color:C.brand},line:{color:C.brand}});
  text(s,`peer-${i+1}-heading`,m.title,x+.09,hy,p.cw-.18,p.hh,p.head,{bold:true,color:C.white,align:'center'});
  const ay=hy+p.hh+.32; text(s,`peer-${i+1}-action`,m.action||'',x,ay,p.cw,p.ah,p.size,{bold:true,color:C.orange,align:'center'});
  text(s,`peer-${i+1}-body`,m.body||'',x,ay+p.ah+.24,p.cw,m.tm.height,p.size);
  if(i<p.modules.length-1)s.addShape(R.line,{x:x+p.cw+p.gap/2,y:y+.75,w:0,h:box.h-.85,line:{color:C.rule,width:.65}});
 });
}
function evidenceRows(s,q){
 const{p,box}=q;let y=box.y+.05;
 for(const r of p.rows){
  s.addShape(R.rect,{x:box.x,y,w:.055,h:r.height-.16,fill:{color:C.brand},line:{color:C.brand}});
  let x=box.x+.10;
  for(let j=0;j<3;j++){text(s,`evidence-${r.index}-${j}`,r.texts[j],x,y+.08,p.widths[j]-.16,r.ms[j].height,j===0?p.head:p.size,{bold:j===0,color:j===0?C.navy:C.ink});x+=p.widths[j]+p.gap}
  y+=r.height;if(r!==p.rows.at(-1))rule(s,box.x,y-.08,box.w);
 }
}
function causeEffect(s,q){
 const{p,box}=q;let y=box.y+.05;
 for(const r of p.rows){
  const h=r.height-.12;
  s.addShape(R.rect,{x:box.x,y,w:p.cause,h,fill:{color:C.tint},line:{color:C.tint}});
  text(s,`cause-${r.index}`,r.cause,box.x+.14,y+.10,p.cause-.28,r.cm.height,p.size);
  s.addShape(R.chevron,{x:box.x+p.cause+.12,y:y+h/2-.10,w:p.gap-.24,h:.20,fill:{color:C.brand},line:{color:C.brand}});
  text(s,`effect-${r.index}`,r.effect,box.x+p.cause+p.gap+.14,y+.10,p.effect-.28,r.em.height,p.size);
  y+=r.height;if(r!==p.rows.at(-1))rule(s,box.x,y-.07,p.left);
 }
 const x=box.x+p.left+.42,sy=box.y+.05;
 s.addShape(R.rect,{x,y:sy,w:p.sw,h:Math.min(box.h-.1,Math.max(y-sy,p.hm.height+p.tm.height+.75)),fill:{color:C.tint},line:{color:C.tint}});
 text(s,'conclusion-heading',q.s.conclusion.title||'归纳',x+.19,sy+.22,p.sw-.38,p.hm.height,p.head,{bold:true,color:C.navy});
 text(s,'conclusion-body',q.s.conclusion.body,x+.19,sy+.47+p.hm.height,p.sw-.38,p.tm.height,p.size);
}
function hubEvidence(s,q){
 const{p,box}=q;const cy=box.y+Math.min(box.h/2,2.25),hx=box.x,hy=cy-p.hubw/2,rx=box.x+p.hubw+.65;
 s.addShape(R.ellipse,{x:hx,y:hy,w:p.hubw,h:p.hubw,fill:{color:C.brand},line:{color:C.brand}});
 const labelH=p.hm.height+p.tm.height+.18,ty=cy-labelH/2;
 text(s,'hub-title',q.s.hub.title,hx+.30,ty,p.hubw-.60,p.hm.height,p.head,{bold:true,color:C.white,align:'center'});
 text(s,'hub-body',q.s.hub.body||'',hx+.30,ty+p.hm.height+.18,p.hubw-.60,p.tm.height,p.size,{color:C.white,align:'center'});
 let y=box.y+.05;const total=p.rows.reduce((a,r)=>a+r.height,0),extra=Math.min(.18,Math.max(0,(box.h-total)/p.rows.length));
 for(const r of p.rows){const mid=y+(r.height-.16)/2;
  s.addShape(R.line,{x:hx+p.hubw,y:cy,w:.32,h:0,line:{color:C.brand,width:1}});
  s.addShape(R.line,{x:hx+p.hubw+.32,y:Math.min(cy,mid),w:0,h:Math.abs(mid-cy),line:{color:C.brand,width:1}});
  s.addShape(R.line,{x:hx+p.hubw+.32,y:mid,w:.25,h:0,line:{color:C.brand,width:1,beginArrowType:'none',endArrowType:'triangle'}});
  text(s,`branch-${r.index}-heading`,r.heading,rx,y,p.hw,r.hm.height,p.head,{bold:true,color:C.navy});
  text(s,`branch-${r.index}-body`,r.text,rx+p.hw+.36,y,p.rw-p.hw-.36,r.tm.height,p.size);
  y+=r.height+extra;if(r!==p.rows.at(-1))rule(s,rx,y-.15,p.rw);
 }
}
function table(s,q){
 const{p,box}=q;
 const all=[p.headers,...p.measures].map((r,j)=>r.map(c=>({text:c.text,options:{fontFace:plan.font,fontSize:p.size,bold:j===0,color:j===0?C.white:C.ink,fill:{color:j===0?C.brand:j%2===0?C.tint:C.white},margin:p.pad*72,valign:'middle'}})));
 s.addTable(all,{x:box.x,y:box.y,w:box.w,colW:p.widths,rowH:[p.hh,...p.heights],fontFace:plan.font,fontSize:p.size,margin:p.pad*72,autoPage:false,border:{type:'solid',color:C.rule,pt:.5},objectName:'evidence-table'});
 objects.push({id:'evidence-table',x:box.x,y:box.y,w:box.w,h:p.hh+p.heights.reduce((a,b)=>a+b,0),size:p.size,rows:p.rows.length,columns:p.widths.length});
}
function chart(s,q){
 const{box,s:sp}=q,horizontal=sp.orientation==='horizontal'||sp.categories.some(c=>String(c).length>7),cw=sp.commentary?8.25:box.w;
 if(sp.unit)text(s,'chart-unit',`单位：${sp.unit}`,box.x,box.y,cw,.28,12,{color:C.secondary});
 const cats=sp.categories.map(c=>wrap(String(c),horizontal?1.7:Math.min(1.6,cw/sp.categories.length),14,plan.font).join('\n'));
 s.addChart(pptx.ChartType.bar,sp.series.map(v=>({name:v.name,labels:cats,values:v.values})),{x:box.x,y:box.y+.4,w:cw,h:box.h-.52,barDir:horizontal?'bar':'col',grouping:'clustered',chartColors:sp.series.map(v=>({actual:C.brand,forecast:C.orange,reference:C.reference,negative:C.negative,positive:C.positive}[v.role]||C.brand)),showTitle:false,showBorder:false,showLegend:sp.series.length>1,legendPos:'b',legendFontFace:plan.font,legendFontSize:12,catAxisLabelFontFace:plan.font,catAxisLabelFontSize:14,valAxisLabelFontFace:plan.font,valAxisLabelFontSize:12,valAxisMinVal:sp.min??Math.min(0,...sp.series.flatMap(v=>v.values)),valAxisMaxVal:sp.max,valGridLine:{color:C.rule,width:.5},catAxisLineShow:false,valAxisLineShow:false,showValue:sp.showValue??false,dataLabelPosition:'outEnd',dataLabelColor:C.ink,dataLabelFormatCode:sp.format||'0.0',showShadow:false,objectName:'evidence-chart'});
 objects.push({id:'evidence-chart',x:box.x,y:box.y+.4,w:cw,h:box.h-.52,series:sp.series.length,categories:cats.length});
 if(sp.commentary){const x=box.x+cw+.36,w=box.w-cw-.36,m=measure(sp.commentary,w,18,plan.font,false,{reserve:q.reserve});text(s,'chart-commentary',sp.commentary,x,box.y+.5,w,m.height,18)}
}
function cover(s,q){
 s.background={color:C.white};s.addShape(R.rect,{x:0,y:6.20,w:13.333333,h:1.30,fill:{color:C.navy},line:{color:C.navy}});
 const m=measure(q.s.title,11.8,36,plan.font,true);text(s,'cover-title',q.s.title,.8,1.1,11.8,m.height,36,{bold:true,color:C.navy});
 const st=q.s.subtitle||deck.subtitle;if(st){const sm=measure(st,10.6,24,plan.font);text(s,'cover-subtitle',st,.83,2.9,10.6,sm.height,24)}
 text(s,'cover-footer',q.s.footer||deck.author||'',.83,6.54,9.4,.36,16,{color:C.white});
}
function kpis(s,q){
 const its=q.s.kpis,{box}=q;if(!its?.length||its.length>4)throw new Error('kpis supports 1–4 metrics');const w=(box.w-.34*(its.length-1))/its.length;
 its.forEach((it,i)=>{const x=box.x+i*(w+.34);rule(s,x,box.y,w,C.brand);
 for(const [suffix,t,y,size,bold,color] of [['label',it.label,box.y+.25,20,true,C.navy],['value',it.value,box.y+1.2,plan.profile.number,true,C.brand],['note',it.note||'',box.y+2.3,16,false,C.secondary]]){const m=measure(t,w,size,plan.font,bold);text(s,`kpi-${i}-${suffix}`,t,x,y,w,m.height,size,{bold,color})}});
 if(q.s.bullets?.length){const t=q.s.bullets.join('\n'),m=measure(t,box.w,18,plan.font);text(s,'kpi-commentary',t,box.x,box.y+3.6,box.w,m.height,18)}
}
for(const q of plan.pages){
 const s=pptx.addSlide();num++;objects=[];
 if(q.p.mode==='cover')cover(s,q);
 else if(q.p.mode==='divider'){s.background={color:C.white};text(s,'section-number',q.s.number||String(num),.8,1.4,2.4,.9,44,{bold:true,color:C.brand});const m=measure(q.s.title,11.6,36,plan.font,true);text(s,'section-title',q.s.title,.8,3.1,11.6,m.height,36,{bold:true,color:C.navy});if(q.s.subtitle){const sm=measure(q.s.subtitle,10.8,20,plan.font);text(s,'section-subtitle',q.s.subtitle,.8,3.1+m.height+.35,10.8,sm.height,20,{color:C.secondary})}}
 else if(q.p.mode.startsWith('blue'))renderBlue(s,q,{pptx,R,root,measure,font:plan.font,objects,nativeStyle,deck,num});
 else if(q.p.mode.startsWith('editorial'))renderEditorial(s,q,{pptx,R,root,measure,font:plan.font,objects,deck,num,text,chrome,colors:{...C,...theme.editorialColors,blue:C.brand}});
 else if(q.p.mode.startsWith('template'))renderTemplateRelations(s,q,{pptx,R,root,measure,font:plan.font,objects,deck,num,text,chrome,colors:{...C,...theme.editorialColors,blue:C.brand}});
 else{chrome(s,q);({rows,columns,statement,table,chart,kpis,peerColumns,evidenceRows,causeEffect,hubEvidence}[q.p.mode])(s,q)}
 for(const o of objects)if([o.x,o.y,o.w,o.h].some(v=>!Number.isFinite(v))||o.x<0||o.y<0||o.x+o.w>13.334||o.y+o.h>7.5)throw new Error(`Object has invalid coordinates or is outside slide: ${o.id}`);
 s.addNotes([q.s.notes||'',q.s.source??deck.source??''].filter(Boolean).join('\n'));pages.push({slide:num,inputSlide:q.inputIndex,composition:q.p.mode,contentSegments:q.p.contentSegments||[],rhythm:q.s.pageRhythm||(/Cover|cover|divider/.test(q.p.mode)?'anchor':/Chart|chart|Matrix|table/.test(q.p.mode)?'dense':q.p.rows?.length>2?'dense':'breathing'),objects});
}
const target=path.resolve(output);fs.mkdirSync(path.dirname(target),{recursive:true});await pptx.writeFile({fileName:target});
if(process.env.BLUE_IB_KEEP_RAW)fs.copyFileSync(target,target+'.raw.pptx');
const patchFile=target+'.native-styles.json';fs.writeFileSync(patchFile,JSON.stringify(nativePatches));
const result=spawnSync(process.env.BLUE_IB_PYTHON||'python3',[path.join(root,'scripts/finalize-native.py'),target,plan.font,latinFor(plan.font),patchFile],{encoding:'utf8'});if(result.status!==0)throw new Error(`OOXML finalization failed: ${result.stderr||result.stdout}`);
fs.writeFileSync(target+'.layout.json',JSON.stringify({version:theme.version,font:plan.font,profile:deck.profile||'desk',units:'inches, font points',designLock:{designSystem:deck.designSystem||'blue-editorial',palette:C,paletteProfile:deck.palette||'blue-original',fontProfile:deck.fontProfile||'business-sans',editorialColors:theme.editorialColors,typography:plan.profile,actualMeasuredFont:plan.font,latinFont:latinFor(plan.font),canvas:theme.canvas},editContract:{mode:'noAutofit',reserve:deck.editReserve??.30,policies:plan.pages.map(q=>({inputSlide:q.inputIndex,policy:q.p.policy||'adaptive',reserve:q.p.policy==='reference'?0:q.reserve})),limit:'Reserved headroom is a design estimate. Only representative edits in the named application are verified; arbitrary text growth is unsupported.'},decisions:plan.decisions,pages,visualQA:'pending actual PPTX rendering and per-page review'},null,2));
console.log(`Created ${target} (${pages.length} slides; font ${plan.font}); visual review pending`);
}catch(e){console.error(e.stack||e.message);process.exit(2)}

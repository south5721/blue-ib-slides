/* Original native relation geometry: strategy house, cycle evidence and phase bands. */
function textValue(v,name){if(typeof v!=='string'||!v.trim())throw new Error(`${name} is required`);return v;}
function paginate(rows,h,base){const out=[];let group=[],used=0;for(const r of rows){if(r.height>h)throw new Error('One relation item exceeds the page at the role font floor; split explicitly');if(group.length&&used+r.height>h){out.push({...base,rows:group});group=[];used=0;}group.push(r);used+=r.height;}if(group.length)out.push({...base,rows:group});return out;}
function splitDetailRows(rows,h,m,w){
 const contentSegments=[],out=[];
 for(const row of rows){if(row.height<=h){out.push(row);continue;}
  const original=row.body??[row.date,row.text].filter(Boolean).join('\n'),parts=[];let rest=original;
  while(rest){let lo=1,hi=[...rest].length,best=0;const chars=[...rest];
   while(lo<=hi){const n=Math.floor((lo+hi)/2),tm=m(chars.slice(0,n).join(''),w);if(Math.max(row.hm.height,tm.height)+.30<=h){best=n;lo=n+1;}else hi=n-1;}
   if(!best)throw new Error('A relation heading or one character cannot fit at the role floor');
   if(best<chars.length){const prefix=chars.slice(0,best).join(''),matches=[...prefix.matchAll(/[。；！？\n]/g)],boundary=matches.at(-1);if(boundary&&boundary.index>=prefix.length*.5)best=[...prefix.slice(0,boundary.index+1)].length;}
   const body=chars.slice(0,best).join('');parts.push(body);rest=chars.slice(best).join('');
  }
  contentSegments.push({original,parts});parts.forEach((body,i)=>{const tm=m(body,w);out.push({...row,body,tm,height:Math.max(row.hm.height,tm.height)+.30,continuation:i+1});});
 }
 return {rows:out,contentSegments};
}
export function planTemplateRelations(s,{box,font,profile,measure,reserve}){
 const size=profile.body[0],head=profile.heading.at(-1),m=(t,w,z=size,b=false,r=0)=>measure(t,w,z,font,b,{reserve:r});
 if(s.layout==='strategyHouse'){
  textValue(s.roof,'Shared goal');if(!s.pillars?.length||s.pillars.length<2||s.pillars.length>4)throw new Error('Strategy house needs 2–4 actual pillars, never invented columns');
  const rm=m(s.roof,box.w*.45,head,true);if(rm.lines.length>1)throw new Error('Roof label too long; preserve detail in a subtitle or evidence page');
  const fm=m(textValue(s.foundation?.body,'Shared foundation'),box.w-.36,size,false,reserve),fh=m(s.foundation.title||'共同基础',box.w-.36,head,true),foundationH=fh.height+fm.height+.38;
  if(foundationH>box.h*.42)throw new Error('Shared foundation is too dense for a house; reframe its evidence explicitly');
  const gap=.28,cw=(box.w-gap*(s.pillars.length-1))/s.pillars.length,available=box.h-1.02-foundationH-.20;
  const pillars=s.pillars.map((v,i)=>({...v,index:i+1,hm:m(textValue(v.title,'Pillar title'),cw-.28,head,true),tm:m(textValue(v.body,'Pillar evidence'),cw-.28,size,false,reserve)}));
  const hh=Math.max(...pillars.map(v=>v.hm.height))+.24,needs=Math.max(...pillars.map(v=>v.tm.height))+.20+hh;
  const p={mode:'templateHouse',pillars,cw,gap,hh,available,rm,fm,fh,foundationH,size,head};
  if(needs<=available)return [p];
  const rows=pillars.map(v=>({...v,hm:m(v.title,2.1,head,true),tm:m(v.body,box.w-2.5,size,false,reserve)})).map(v=>({...v,height:Math.max(v.hm.height,v.tm.height)+.30}));
  const detail=splitDetailRows(rows,box.h,t=>m(t,box.w-2.5,size,false,reserve),box.w-2.5);
  return [{...p,overview:true},...paginate(detail.rows,box.h,{mode:'templateHouseDetails',contentSegments:detail.contentSegments,size,head})];
 }
 if(s.layout==='cycleEvidence'){
  if(!s.steps?.length||s.steps.length<3||s.steps.length>6)throw new Error('Cycle needs 3–6 explicitly cyclic steps');
  const center=s.centerLabel||'闭环',cm=m(center,1.35,size,true);if(cm.lines.length>2)throw new Error('Cycle center label is too long');
  const left=3.25,right=box.w-left-.42,hw=2.18,tw=right-hw-.20;
  const rows=s.steps.map((v,i)=>{const heading=String(i+1).padStart(2,'0')+' '+textValue(v.title,'Cycle step'),hm=m(heading,hw,head,true),body=[v.date,v.text].filter(Boolean).join('\n'),tm=m(textValue(body,'Cycle evidence'),tw,size,false,reserve);return {index:i+1,heading,body,hm,tm,height:Math.max(hm.height,tm.height)+.16};});
  if(rows.every(v=>v.height<=box.h))return paginate(rows,box.h,{mode:'templateCycle',left,right,hw,tw,center,cm,size,head,count:s.steps.length});
  const cycleCaption=center+'：'+s.steps.map(v=>v.title).concat(s.steps[0].title).join(' → '),caption=m(cycleCaption,box.w,size,true),offset=caption.height+.28;
  const detail=rows.map(v=>({...v,hm:m(v.heading,2.15,head,true),tm:m(v.body,box.w-2.5,size,false,reserve)})).map(v=>({...v,height:Math.max(v.hm.height,v.tm.height)+.30}));
  const expanded=splitDetailRows(detail,box.h-offset,t=>m(t,box.w-2.5,size,false,reserve),box.w-2.5);
  return paginate(expanded.rows,box.h-offset,{mode:'templateCycleDetails',contentSegments:expanded.contentSegments,cycleCaption,caption,offset,size,head});
 }
 if(s.layout==='phaseBand'){
  if(!s.steps?.length||s.steps.length<2)throw new Error('Phase band needs at least two ordered stages');
  const summary=s.summary?m(s.summary,box.w,size,false,reserve):null,usable=box.h-(summary?summary.height+.22:0),gap=.34,cols=Math.min(s.steps.length,3),cw=(box.w-gap*(cols-1))/cols;
  const rows=s.steps.map((v,i)=>{const title=String(i+1).padStart(2,'0')+' '+textValue(v.title,'Phase title'),hm=m(title,cw-.32,head,true),dm=v.date?m(v.date,cw,size):null,tm=m(textValue(v.text,'Phase evidence'),cw-.10,size,false,reserve);return {...v,index:i+1,label:title,hm,dm,tm,height:hm.height+.38+(dm?dm.height+.18:0)+tm.height+.28};});
  const hh=Math.max(...rows.map(v=>v.hm.height))+.24;
  if(rows.every(v=>v.height<=usable)){
   const out=[];for(let i=0;i<rows.length;i+=cols)out.push({mode:'templatePhases',rows:rows.slice(i,i+cols),cw,gap,hh,summary,usable,size,head});return out;
  }
  const detail=rows.map(v=>({...v,hm:m(v.label,2.15,head,true),tm:m([v.date,v.text].filter(Boolean).join('\n'),box.w-2.5,size,false,reserve)})).map(v=>({...v,height:Math.max(v.hm.height,v.tm.height)+.30}));
  const expanded=splitDetailRows(detail,usable,t=>m(t,box.w-2.5,size,false,reserve),box.w-2.5);
  return paginate(expanded.rows,usable,{mode:'templatePhaseRows',contentSegments:expanded.contentSegments,summary,usable,size,head});
 }
 return null;
}
export function renderTemplateRelations(slide,q,ctx){
 const {R,text,chrome,colors:C,objects}=ctx,{s,p,box}=q;chrome(slide,q);
 const tx=(id,t,x,y,w,h,z=p.size,opts={})=>text(slide,id,t,x,y,w,h,z,{color:C.ink,...opts});
 const rect=(id,x,y,w,h,color)=>{slide.addShape(R.rect,{x,y,w,h,objectName:id,fill:{color},line:{color,width:.6}});};
 const line=(x,y,w,h=0)=>slide.addShape(R.line,{x,y,w,h,line:{color:C.rule,width:.6}});
 if(p.mode==='templateHouse'){
  slide.addShape(R.triangle,{x:box.x,y:box.y,w:box.w,h:.82,fill:{color:C.brand},line:{color:C.brand},objectName:'shared-goal-roof'});
  tx('house-goal',s.roof,box.x+box.w*.185,box.y+.36,box.w*.63,p.rm.height,p.head,{bold:true,color:C.white,align:'center'});
  const y=box.y+1.02,ph=p.available;
  p.pillars.forEach((v,i)=>{const x=box.x+i*(p.cw+p.gap);rect(`pillar-${v.index}-field`,x,y,p.cw,ph,C.tint);rect(`pillar-${v.index}-header`,x,y,p.cw,p.hh,C.brand);tx(`pillar-${v.index}-title`,v.title,x+.14,y+.12,p.cw-.28,p.hh-.20,p.head,{bold:true,color:C.white,align:'center'});
   if(!p.overview)tx(`pillar-${v.index}-body`,v.body,x+.14,y+p.hh+.18,p.cw-.28,v.tm.height,p.size);
   else tx(`pillar-${v.index}-continuation`,'详细依据见续页',x+.14,y+p.hh+.22,p.cw-.28,.70,p.size,{color:C.secondary});
  });
  const fy=box.y+box.h-p.foundationH;rect('house-foundation',box.x,fy,box.w,p.foundationH,C.tint);tx('foundation-title',s.foundation.title||'共同基础',box.x+.18,fy+.14,box.w-.36,p.fh.height,p.head,{bold:true,color:C.navy});tx('foundation-body',s.foundation.body,box.x+.18,fy+.24+p.fh.height,box.w-.36,p.fm.height,p.size);
 }else if(p.mode==='templateHouseDetails'||p.mode==='templatePhaseRows'||p.mode==='templateCycleDetails'){
  let y=box.y;
  if(p.cycleCaption){tx('closed-cycle-order',p.cycleCaption,box.x,y,box.w,p.caption.height,p.size,{bold:true,color:C.navy});y+=p.offset;}
  for(const v of p.rows){tx(`detail-${v.index}-title`,v.label||v.heading||v.title,box.x,y,2.15,v.hm.height,p.head,{bold:true,color:C.navy});tx(`detail-${v.index}-body`,v.body||[v.date,v.text].filter(Boolean).join('\n'),box.x+2.5,y,box.w-2.5,v.tm.height,p.size);y+=v.height;line(box.x,y-.12,box.w);}
  if(p.summary)tx('phase-summary',s.summary,box.x,box.y+box.h-p.summary.height,box.w,p.summary.height,p.size,{color:C.navy});
 }else if(p.mode==='templateCycle'){
  const cx=box.x+1.53,cy=box.y+box.h/2,r=1.22;
  slide.addShape(R.ellipse,{x:cx-r,y:cy-r,w:r*2,h:r*2,fill:{color:C.white,transparency:100},line:{color:C.brand,width:16,transparency:12},objectName:'complete-cycle-ring'});
  for(let i=0;i<p.count;i++){const deg=-90+360*(i+.5)/p.count,a=deg*Math.PI/180;slide.addShape(R.triangle,{x:cx+Math.cos(a)*r-.20,y:cy+Math.sin(a)*r-.20,w:.40,h:.40,rotate:deg+180,fill:{color:C.brand},line:{color:C.brand,width:0},objectName:`cycle-direction-${i+1}`});}
  tx('cycle-center',p.center,cx-.675,cy-p.cm.height/2,1.35,p.cm.height,p.size,{bold:true,color:C.navy,align:'center'});
  for(let i=0;i<p.count;i++){const a=(-90+360*i/p.count)*Math.PI/180,x=cx+Math.cos(a)*r-.23,y=cy+Math.sin(a)*r-.23,on=p.rows.some(v=>v.index===i+1);slide.addShape(R.ellipse,{x,y,w:.46,h:.46,fill:{color:on?C.brand:C.white},line:{color:C.brand,width:1},objectName:`cycle-node-${i+1}`});tx(`cycle-number-${i+1}`,String(i+1),x,y+.055,.46,.36,16,{bold:true,color:on?C.white:C.navy,align:'center'});}
  let y=box.y;const x=box.x+p.left+.42;
  for(const v of p.rows){tx(`cycle-${v.index}-title`,v.heading,x,y,p.hw,v.hm.height,p.head,{bold:true,color:C.navy});tx(`cycle-${v.index}-body`,v.body,x+p.hw+.20,y,p.tw,v.tm.height,p.size);y+=v.height;if(v!==p.rows.at(-1))line(x,y-.075,p.right);}
 }else if(p.mode==='templatePhases'){
  p.rows.forEach((v,i)=>{const x=box.x+i*(p.cw+p.gap);slide.addShape(R.chevron,{x,y:box.y,w:p.cw,h:p.hh,fill:{color:C.brand},line:{color:C.brand},objectName:`phase-${v.index}-sequence`});tx(`phase-${v.index}-title`,v.label,x+.10,box.y+.12,p.cw-.32,p.hh-.20,p.head,{bold:true,color:C.white,align:'center'});let y=box.y+p.hh+.26;if(v.date){tx(`phase-${v.index}-date`,v.date,x,y,p.cw,v.dm.height,p.size,{bold:true,color:C.orange});y+=v.dm.height+.18;}tx(`phase-${v.index}-body`,v.text,x,y,p.cw-.10,v.tm.height,p.size);});
  if(p.summary)tx('phase-summary',s.summary,box.x,box.y+box.h-p.summary.height,box.w,p.summary.height,p.size,{color:C.navy});
 }
}

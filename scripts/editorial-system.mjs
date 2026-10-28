/* Original editable editorial compositions. No source artwork or font files are bundled. */
function needed(v,name){if(typeof v!=='string'||!v.trim())throw new Error(`${name} must be nonempty text`);return v;}
function chunks(rows,height,base){
 const pages=[];let group=[],used=0;
 for(const r of rows){
  if(r.height>height+.001)throw new Error('One editorial item exceeds the page at its font floor; split its evidence explicitly');
  if(group.length&&used+r.height>height){pages.push({...base,rows:group});group=[];used=0;}
  group.push(r);used+=r.height;
 }
 if(group.length)pages.push({...base,rows:group});return pages;
}
function day(v){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))throw new Error('Timeline dates require explicit ISO YYYY-MM-DD values');
 const t=Date.parse(v+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==v)throw new Error('Invalid timeline calendar date');return t/86400000;
}
export function planEditorial(s,{box,font,profile,measure,reserve}){
 const size=profile.body[0],head=profile.heading.at(-1),m=(t,w,z=size,b=false,r=0)=>measure(t,w,z,font,b,{reserve:r});
 if(s.layout==='cover'){
  let title;for(const z of [80,72,60,52,44,36]){const mm=m(s.title,11.75,z,true);if(mm.lines.length<=3&&mm.height<=2.5){title={...mm,size:z};break;}}
  if(!title)throw new Error('Cover title exceeds three lines at 36pt; move qualifications into the subtitle');
  const subtitle=m(s.subtitle||'',11.2,24);if(subtitle.lines.length>2)throw new Error('Cover subtitle exceeds two lines');
  const meta=m(s.footer||s.author||'',11.2,18);if(meta.lines.length>2)throw new Error('Cover metadata exceeds two lines');
  return [{mode:'editorialCover',title,subtitle,meta,size}];
 }
 if(s.layout==='agenda'){
  const items=s.items;if(!Array.isArray(items)||!items.length)throw new Error('Agenda needs items');
  const gap=.48,cw=(box.w-2*gap)/3,rows=items.map((it,i)=>{const hm=m(needed(it.title,'Agenda title'),cw,head,true),tm=m(it.body||'',cw,size,false,reserve);return {...it,index:i+1,hm,tm,height:.62+hm.height+.17+tm.height+.34};});
  const rowBands=[];for(let i=0;i<rows.length;i+=3){const items=rows.slice(i,i+3);rowBands.push({items,height:Math.max(...items.map(x=>x.height))});}
  return chunks(rowBands,box.h,{mode:'editorialAgenda',cw,gap,size,head});
 }
 if(s.layout==='comparison'){
  if(!Array.isArray(s.pairs)||!s.pairs.length)throw new Error('Comparison needs complete pairs');
  needed(s.leftHeading,'Left heading');needed(s.rightHeading,'Right heading');
  const gap=.56,cw=(box.w-gap)/2,hh=Math.max(m(s.leftHeading,cw-.32,head,true).height,m(s.rightHeading,cw-.32,head,true).height)+.28;
  const rows=s.pairs.map((it,i)=>{
   const lt=m(needed(it.leftTitle,'Left title'),cw-.28,head,true),rt=m(needed(it.rightTitle,'Right title'),cw-.28,head,true);
   const lm=m(needed(it.leftBody,'Left evidence'),cw-.28,size,false,reserve),rm=m(needed(it.rightBody,'Right evidence'),cw-.28,size,false,reserve);
   return {...it,index:i+1,lt,rt,lm,rm,th:Math.max(lt.height,rt.height),height:Math.max(lt.height,rt.height)+.12+Math.max(lm.height,rm.height)+.34};
  });
  return chunks(rows,box.h-hh-.20,{mode:'editorialComparison',cw,gap,hh,size,head});
 }
 if(s.layout==='comparisonMatrix'){
  if(!s.columns?.length||s.columns.length<3||s.columns.length>5||!s.rows?.length)throw new Error('Comparison matrix needs a key column and 2–4 comparison columns');
  if(s.rows.some(r=>r.length!==s.columns.length))throw new Error('Comparison matrix has a missing cell');
  const pad=.14,keyW=[1.8,2.2,2.6].find(w=>s.rows.every(r=>m(String(r[0]),w-2*pad,size,true).lines.length===1))||2.6;
  const widths=[keyW,...s.columns.slice(1).map(()=> (box.w-keyW)/(s.columns.length-1))];
  const cells=(r,b)=>r.map((v,i)=>m(String(v),widths[i]-2*pad,size,b));
  const headers=cells(s.columns,true),hh=Math.max(...headers.map(x=>x.height))+.32;
  const rows=s.rows.map((values,i)=>{const ms=cells(values,false);return {values,index:i+1,ms,height:Math.max(...ms.map(x=>x.height))+.28};});
  return chunks(rows,box.h-hh,{mode:'editorialMatrix',widths,pad,headers,hh,size,head});
 }
 if(s.layout==='timeline'){
  if(!s.tasks?.length)throw new Error('Timeline needs tasks');
  const start=day(s.range?.start),end=day(s.range?.end);if(end<=start)throw new Error('Timeline range end must follow start');
  const labelW=3.15,gap=.35,axisW=box.w-labelW-gap,axisH=.64;
  const rows=s.tasks.map((it,i)=>{
   const a=day(it.start),b=day(it.end);if(b<a||a<start||b>end)throw new Error('Timeline task date is reversed or outside the declared range');
   const tm=m(needed(it.title,'Task title'),labelW,size,true);
   const meta=[it.owner,it.deliverable].filter(Boolean).join(' · '),mm=meta?m(meta,labelW,size):null;
   return {...it,index:i+1,a,b,tm,mm,height:Math.max(.90,tm.height+(mm?mm.height+.10:0)+.24)};
  });
  return chunks(rows,box.h-axisH-.16,{mode:'editorialTimeline',labelW,gap,axisW,axisH,start,end,size,head});
 }
 if(s.layout==='chartBrief'){
  if(!s.categories?.length||!s.series?.length||s.categories.length>12||s.series.length>3)throw new Error('Chart brief supports 1–12 categories and 1–3 series; split explicitly above that');
  s.categories.forEach(v=>needed(String(v),'Chart category'));
  s.series.forEach(v=>{needed(v.name,'Series name');if(v.values?.length!==s.categories.length||v.values.some(x=>!Number.isFinite(x)))throw new Error('Chart brief values must be finite and match categories');});
  if(s.series.length>1&&(s.series.some(v=>!v.role)||new Set(s.series.map(v=>v.role)).size!==s.series.length))throw new Error('Multiple chart series need distinct explicit semantic color roles');
  const kpis=s.kpis||[];if(kpis.length>4)throw new Error('Chart brief supports at most four actual KPIs');
  const kw=kpis.length?(box.w-.4*(kpis.length-1))/kpis.length:0;
  const km=kpis.map(it=>{const lm=m(needed(it.label,'KPI label'),kw,size),vm=m(needed(String(it.value),'KPI value'),kw,36,true),nm=it.note?m(it.note,kw,size):null;if(lm.lines.length>2||vm.lines.length>1||nm?.lines.length>2)throw new Error('KPI label/value/note too wide; use a dedicated evidence page');return {...it,lm,vm,nm};});
  const rail=km.length?Math.max(...km.map(it=>it.lm.height+it.vm.height+.22+(it.nm?it.nm.height+.10:0)))+.28:0;
  const commentary=s.commentary?m(s.commentary,box.w,size,false,reserve):null;
  if(commentary&&commentary.lines.length>3)throw new Error('Chart brief commentary exceeds three lines; put detailed interpretation on a companion page');
  const ch=box.h-rail-(commentary?commentary.height+.22:0)-.30;
  if(ch<2.25)throw new Error('Chart brief is too dense; separate KPIs or interpretation before shrinking the chart');
  const horizontal=s.orientation==='horizontal'||s.categories.some(x=>String(x).length>7);
  if(horizontal&&s.categories.length>7)throw new Error('Long chart category labels need an explicit split into at most seven per page');
  return [{mode:'editorialChart',km,kw,rail,commentary,ch,horizontal,size,head}];
 }
 return null;
}
export function renderEditorial(slide,q,ctx){
 const {pptx,R,measure,font,objects,deck,num,text,chrome,colors:C}=ctx,{s,p,box}=q;
 const tx=(id,t,x,y,w,h,z=p.size,options={})=>text(slide,id,t,x,y,w,h,z,{color:C.ink,...options});
 const rect=(x,y,w,h,color)=>slide.addShape(R.rect,{x,y,w,h,fill:{color},line:{color,transparency:100}});
 const line=(x,y,w,h=0,color=C.rule)=>slide.addShape(R.line,{x,y,w,h,line:{color,width:.6}});
 if(p.mode==='editorialCover'){
  slide.background={color:C.white};line(.8,1.2,11.75);tx('cover-year',s.eyebrow||'',.8,.42,11.75,.55,28,{bold:true,color:C.blue});
  const y=2.03;tx('cover-title',s.title,.8,y,11.75,p.title.height,p.title.size,{bold:true,color:C.navy});
  const sy=Math.max(4.2,y+p.title.height+.30);rect(.8,sy,11.75,.065,C.blue);
  if(s.subtitle)tx('cover-subtitle',s.subtitle,.8,sy+.26,11.2,p.subtitle.height,24,{color:C.navy});
  tx('cover-meta',s.footer||s.author||deck.author||'',.8,6.42,11.2,.70,18,{color:C.secondary});return;
 }
 chrome(slide,q);
 if(p.mode==='editorialAgenda'){
  let y=box.y+.12;
  for(const band of p.rows){band.items.forEach((it,j)=>{const x=box.x+j*(p.cw+p.gap);
   tx(`agenda-${it.index}-number`,String(it.index).padStart(2,'0'),x,y,p.cw,.56,28,{bold:true,color:C.blue});
   tx(`agenda-${it.index}-title`,it.title,x,y+.62,p.cw,it.hm.height,p.head,{bold:true,color:C.navy});
   if(it.body)tx(`agenda-${it.index}-body`,it.body,x,y+.79+it.hm.height,p.cw,it.tm.height,p.size,{color:C.secondary});
  });y+=band.height;}
 }else if(p.mode==='editorialComparison'){
  [s.leftHeading,s.rightHeading].forEach((t,j)=>{const x=box.x+j*(p.cw+p.gap);rect(x,box.y,p.cw,p.hh,j?C.blue:C.tint);tx(`comparison-header-${j}`,t,x+.14,box.y+.14,p.cw-.28,p.hh-.24,p.head,{bold:true,color:j?C.white:C.navy});});
  let y=box.y+p.hh+.20;
  for(const r of p.rows){[0,1].forEach(j=>{const x=box.x+j*(p.cw+p.gap);tx(`pair-${r.index}-${j}-title`,j?r.rightTitle:r.leftTitle,x+.14,y,p.cw-.28,r.th,p.head,{bold:true,color:j?C.orange:C.navy});tx(`pair-${r.index}-${j}-body`,j?r.rightBody:r.leftBody,x+.14,y+r.th+.12,p.cw-.28,j?r.rm.height:r.lm.height,p.size);});y+=r.height;line(box.x,y-.12,box.w);}
 }else if(p.mode==='editorialMatrix'){
  const all=[p.headers,...p.rows.map(r=>r.ms)].map((r,j)=>r.map((m,i)=>({text:m.text,options:{fontFace:font,fontSize:p.size,bold:j===0||i===0,color:j===0?C.white:C.ink,fill:{color:j===0?C.blue:i===r.length-1?C.tint:C.white},margin:p.pad*72,valign:'middle'}})));
  slide.addTable(all,{x:box.x,y:box.y,w:box.w,colW:p.widths,rowH:[p.hh,...p.rows.map(r=>r.height)],fontFace:font,fontSize:p.size,margin:p.pad*72,autoPage:false,border:{type:'solid',color:C.rule,pt:.5},objectName:'comparison-matrix'});
  objects.push({id:'comparison-matrix',x:box.x,y:box.y,w:box.w,h:p.hh+p.rows.reduce((a,r)=>a+r.height,0),size:p.size,rows:p.rows.length,columns:p.widths.length,nativeTable:true});
 }else if(p.mode==='editorialTimeline'){
  const ax=box.x+p.labelW+p.gap,aw=p.axisW,ay=box.y+.30;
  line(ax,ay,aw,0,C.blue);
  const date=t=>new Date(t*86400000).toISOString().slice(0,10);
  tx('range-start',date(p.start),ax,box.y-.07,aw/2,.32,12,{color:C.secondary});tx('range-end',date(p.end),ax+aw/2,box.y-.07,aw/2,.32,12,{align:'right',color:C.secondary});
  for(let j=0;j<=4;j++){const x=ax+aw*j/4;line(x,ay,0,.08,C.blue);}
  let y=box.y+p.axisH;
  for(const r of p.rows){
   tx(`task-${r.index}-title`,r.title,box.x,y,p.labelW,r.tm.height,p.size,{bold:true,color:C.navy});
   if(r.mm)tx(`task-${r.index}-meta`,[r.owner,r.deliverable].filter(Boolean).join(' · '),box.x,y+r.tm.height+.10,p.labelW,r.mm.height,p.size,{color:C.secondary});
   const x=ax+(r.a-p.start)/(p.end-p.start)*aw,w=(r.b-r.a)/(p.end-p.start)*aw;
   if(w<.035)line(x,y+.20,0,.24,C.blue);else rect(x,y+.17,w,.24,r.role==='forecast'?C.orange:C.blue);
   const label=`${r.start} — ${r.end}`,mh=measure(label,aw,12,font).height;
   tx(`task-${r.index}-dates`,label,ax,y+.46,aw,mh,12,{color:C.secondary});
   objects.push({id:`task-${r.index}-bar`,x,y:y+.17,w,h:.24,start:r.start,end:r.end,proportional:true});
   y+=r.height;line(box.x,y-.08,box.w);
  }
 }else if(p.mode==='editorialChart'){
  let y=box.y;
  p.km.forEach((it,i)=>{const x=box.x+i*(p.kw+.4);tx(`brief-kpi-${i}-label`,it.label,x,y,p.kw,it.lm.height,p.size,{color:C.secondary});tx(`brief-kpi-${i}-value`,it.value,x,y+it.lm.height+.13,p.kw,it.vm.height,36,{bold:true,color:C.navy});if(it.nm)tx(`brief-kpi-${i}-note`,it.note,x,y+it.lm.height+.23+it.vm.height,p.kw,it.nm.height,p.size,{color:C.secondary});});
  if(p.rail){line(box.x,y+p.rail-.12,box.w);y+=p.rail;}
  if(p.commentary){tx('brief-interpretation',s.commentary,box.x,y,box.w,p.commentary.height,p.size);y+=p.commentary.height+.22;}
  const roles={actual:C.blue,reference:'A7BCD7',forecast:C.orange,negative:'C00000',positive:'168054'};
  if(s.series.some(v=>v.role&&!roles[v.role]))throw new Error('Unknown chart semantic role');
  const vals=s.series.flatMap(v=>v.values),lo=s.min??Math.min(0,...vals);
  if(lo>Math.min(...vals)||(s.max!==undefined&&s.max<Math.max(...vals)))throw new Error('Chart bounds would hide declared values');
  if(s.unit)tx('chart-unit',`单位：${s.unit}`,box.x,y,box.w,.28,12,{color:C.secondary});
  slide.addChart(pptx.ChartType.bar,s.series.map(v=>({name:v.name,labels:s.categories,values:v.values})),{x:box.x,y:y+.3,w:box.w,h:p.ch,barDir:p.horizontal?'bar':'col',grouping:'clustered',chartColors:s.series.map(v=>roles[v.role]||C.blue),showTitle:false,showBorder:false,showLegend:s.series.length>1,legendPos:'b',legendFontFace:font,legendFontSize:12,catAxisLabelFontFace:font,catAxisLabelFontSize:14,valAxisLabelFontFace:font,valAxisLabelFontSize:12,valAxisMinVal:lo,valAxisMaxVal:s.max,valGridLine:{color:C.rule,width:.5},catAxisLineShow:false,valAxisLineShow:false,showValue:s.showValue??false,dataLabelPosition:'outEnd',dataLabelColor:C.ink,dataLabelFormatCode:s.format||'0.0',showShadow:false,objectName:'brief-native-chart'});
  objects.push({id:'brief-native-chart',x:box.x,y:y+.3,w:box.w,h:p.ch,series:s.series.length,categories:s.categories.length,nativeChart:true});
 }
}

/* Blue diagram compositions. Text, shapes and charts remain editable. No private source assets are bundled.
 * Reference density is opt-in; adaptive text never borrows the 12pt explicit dense-card preset.
 */
import fs from 'node:fs';
import path from 'node:path';
const K={blue:'3479C9',navy:'3865BB',orange:'FF7829',gold:'FFC000',ink:'111111',pale:'EDF4FA',line:'8DAAF0'};
export function planBlue(s,c){
 const {font,profile,measure,policy}=c,ref=policy==='reference';
 if(!['reference','adaptive'].includes(policy))throw new Error('layoutPolicy must be reference or adaptive');
 if(ref&&profile.body[0]>18)throw new Error('Reference density is an explicit desk preset; use adaptive for projection');
 const reserve=ref?0:c.reserve;
 const m=(t,w,z,r=reserve)=>measure(t||'',w,z,font,false,{reserve:r,lh:1.25});
 const title=m(s.title,12.1,32,0);if(title.lines.length>2)throw new Error('Blue diagram title exceeds two lines at 32pt; move qualifications to the subtitle');
 const subtitle=s.subtitle?m(s.subtitle,11.9,ref&&s.layout==='hubEvidence'?20:16,0):null;
 const top=Math.max(1.45,.32+title.height+.32+(subtitle?subtitle.height+.14:0));
 const base={policy,referenceDensity:ref,titleSize:32,titleHeight:title.height,subtitleSize:ref&&s.layout==='hubEvidence'?20:16,top};
 const body=profile.body[0],floor=profile.body.at(-1);
 const splitRows=(rows,size)=>{
  const max=6.90-top-.05,expanded=[],contentSegments=[];
  for(const row of rows){
   if(row.height<=max){expanded.push(row);continue;}
   const original=row.text,chars=[...original],parts=[];let at=0;
   while(at<chars.length){
    let lo=1,hi=chars.length-at,best=0;
    while(lo<=hi){const n=Math.floor((lo+hi)/2),tm=m(chars.slice(at,at+n).join(''),7.35,size);if(Math.max(row.hm.height,tm.height)+.36<=max){best=n;lo=n+1}else hi=n-1}
    if(!best)throw new Error('Blue diagram heading or one character exceeds a page at the role floor');
    if(at+best<chars.length){const prefix=chars.slice(at,at+best).join(''),marks=[...prefix.matchAll(/[。；！？\n]/g)],end=marks.at(-1);if(end&&end.index>=prefix.length*.5)best=[...prefix.slice(0,end.index+1)].length;}
    parts.push(chars.slice(at,at+best).join(''));at+=best;
   }
   contentSegments.push({original,parts});let offset=0;
   const colored=(row.textRuns||row.bodyRuns||[{text:original}]).flatMap(r=>[...(r.text||'')].map(ch=>({ch,color:r.color})));
   if(colored.map(r=>r.ch).join('')!==original)throw new Error('Blue diagram continuation rich text must equal the declared text');
   parts.forEach((text,i)=>{const count=[...text].length,runs=colored.slice(offset,offset+count).map(r=>({text:r.ch,...(r.color?{color:r.color}:{})}));offset+=count;const tm=m(text,7.35,size);expanded.push({...row,text,textRuns:runs,tm,height:Math.max(row.hm.height,tm.height)+.36,continuation:i+1});});
  }
  return {rows:expanded,contentSegments};
 };
 const pageRows=(rows,mode,extra={})=>{
  const pages=[];let part=[],used=0;const max=6.90-top-.05;
  for(const r of rows){if(r.height>max)throw new Error(`${mode}: a complete module exceeds one page at its font floor; split the source module explicitly`);if(part.length&&used+r.height>max){pages.push({...base,mode,rows:part,...extra});part=[];used=0}part.push(r);used+=r.height}
  if(part.length)pages.push({...base,mode,rows:part,...extra});
  if(pages.length>1){const a=pages.at(-2).rows,b=pages.at(-1).rows;if(b.length===1&&a.length>2&&b[0].height+a.at(-1).height<=max)b.unshift(a.pop());}
  return pages;
 };
 const adaptiveRows=(items)=>{const size=body,rows=items.map((r,i)=>{const heading=r.title??r.heading??`${i+1}`,content=r.body??r.text??'',text=[r.action,content,r.metric].filter(Boolean).join('\n');const hm=m(heading,3.15,20,0),tm=m(text,7.35,size);const textRuns=[...(r.action?[...(r.actionRuns||[{text:r.action,color:K.orange}]),...(content?[{text:'\n'}]:[])]:[]),...(r.bodyRuns||[{text:content}]),...(r.metric?[{text:(content||r.action?'\n':'')+r.metric,color:K.blue}]:[])];return {...r,heading,text,textRuns,hm,tm,height:Math.max(hm.height,tm.height)+.36,index:i+1}});const expanded=splitRows(rows,size);return pageRows(expanded.rows,'blueRows',{size,head:20,contentSegments:expanded.contentSegments})};
 if(s.layout==='peerColumns'||s.layout==='cards'){
  const items=s.modules||s.cards;if(!items?.length)throw new Error('Blue diagram modules must be nonempty');
  if(items.length===1||items.length>4||items.some(it=>it.metric))return adaptiveRows(items);
  if(items.length===3){
   const size=ref?12:body,action=ref?14:20,lh=ref?1.8:1.5;
   const modules=items.map((it,i)=>({...it,index:i+1,tm:measure(it.body||it.text||'',3.28,size,font,false,{reserve,lh}),am:m(it.action||'',3.28,action,0)}));
   const bannerTop=Math.max(1.26,.32+title.height+.16),bannerH=Math.max(.68,m(s.subtitle||'',12.2,16,0).actualHeight+.24);
   const cardTop=Math.max(2.62,bannerTop+bannerH+.68),actionY=cardTop+(ref?.96:1.05),dividerY=actionY+Math.max(...modules.map(it=>it.am.actualHeight))+.12,bodyY=dividerY+.18,cardBottom=6.62;
   if(modules.some(it=>it.tm.height>cardBottom-bodyY-.20||it.am.height>.60||m(it.title,1.82,20,0).actualHeight>.425))return adaptiveRows(items);
   return [{...base,mode:'blueCards',modules,size,head:20,action,lh,cardTop,bodyY,cardBottom,bannerTop,bannerH,actionY,dividerY}];
  }
  const n=items.length,cw=(12.4-.28*(n-1))/n,size=body,head=20,action=28;
  const modules=items.map((it,i)=>({...it,index:i+1,hm:m(it.title,1.86,head,0),am:m(it.action,cw,action,0),bodyWidth:ref?cw+.64:cw,tm:m(it.body,ref?cw+.64:cw,size)}));
  const hh=Math.max(...modules.map(x=>x.hm.height)),ah=Math.max(...modules.map(x=>x.am.height)),bh=Math.max(...modules.map(x=>x.tm.height));
  const iconY=Math.max(2.14,top+.20),pillY=iconY+1.20,actionY=pillY+hh+.26,bodyY=actionY+ah+.22;
  if(bodyY+bh>6.62)return adaptiveRows(items);
  return [{...base,mode:'bluePeers',modules,cw,size,head,action,hh,ah,iconY,pillY,actionY,bodyY}];
 }
 if(s.layout==='hubEvidence'){
  if(!s.hub?.title||!s.branches?.length)throw new Error('Shared hub and branches required');
  const size=ref?16:body,head=20,hw=2.2;
  const hm=m(s.hub.title,hw,ref?24:22,0),ht=s.hub.body?m(s.hub.body,hw,16,0):null;
  if(hm.height+(ht?.height||0)>.0+1.75)throw new Error('Hub text exceeds circle; use a labeled panel rather than shrink the label');
  const rows=s.branches.map((it,i)=>{const tm=m(it.body,7.55,size),hd=m(it.title,4.12,head,0);return {...it,index:i+1,tm,hd,height:Math.max(1.55,hd.height+tm.height+.42)}});
  return pageRows(rows,'blueHub',{size,head,hm,ht,hubSize:ref?24:22});
 }
 if(s.layout==='bullets'){
  if(s.skin==='report')return null;
  const size=ref?16:body;
  const rows=s.bullets.map((it,i)=>{if(typeof it==='string')it={heading:String(i+1),text:it};const hm=m(it.heading,3.15,20,0),tm=m(it.text,7.35,size);return {...it,index:i+1,heading:it.heading,text:it.text,hm,tm,height:Math.max(1.07,Math.max(hm.height,tm.height)+.36)}});
  const expanded=splitRows(rows,size);return pageRows(expanded.rows,'blueRows',{size,head:20,contentSegments:expanded.contentSegments});
 }
 if(s.layout==='evidenceRows'){
  const size=body,rows=s.evidenceRows.map((r,i)=>{const ms=[m(r.label,1.37,20,0),m(r.evidence,5.40,size),m(r.implication,3.70,size)];return {...r,ms,index:i+1,height:Math.max(1.50,Math.max(...ms.map(x=>x.height))+.38)}});
  return pageRows(rows,'blueEvidence',{size,head:20});
 }
 if(s.layout==='causeEffect'){
  const size=body,cm=m(s.conclusion.title,2.5,24,0),ct=m(s.conclusion.body,2.5,20);
  if(cm.height+ct.height+1.1>6.7-top)throw new Error('Conclusion exceeds side panel; restructure explicitly');
  const rows=s.pairs.map((r,i)=>{const a=m(r.cause,3.65,size),b=m(r.effect,3.05,size);return {...r,index:i+1,a,b,height:Math.max(1.4,Math.max(a.height,b.height)+.36)}});
  return pageRows(rows,'blueCause',{size,cm,ct});
 }
 if(s.layout==='barChart'||s.layout==='dualChart'){
  const charts=s.layout==='dualChart'?[s.leftChart,s.rightChart]:[s];
  for(const z of charts){if(!z?.categories?.length||!z.series?.length||z.categories.length>8||z.series.length>4)throw new Error('Blue diagram chart requires at most 8 categories and 4 series');for(const v of z.series)if(v.values?.length!==z.categories.length||v.values.some(x=>!Number.isFinite(x)))throw new Error('Chart data must be finite and complete')}
  for(const z of charts)if(z.kind==='line'&&z.showValue){const vs=z.series.flatMap(v=>v.values),range=(z.max??Math.max(...vs))-(z.min??Math.min(...vs));for(let i=0;i<z.categories.length;i++){const near=z.series.map(v=>v.values[i]).sort((a,b)=>a-b);if(near.some((v,j)=>j&&Math.abs(v-near[j-1])<range*.055))throw new Error('Line-chart labels are too close at the requested scale. Choose explicit sparse labels or include a complete native data table with showValue:false; never silently hide numbers.');}}
  const commentary=s.commentary?m(s.commentary,3.20,18):null;if(commentary&&commentary.height>4.1)throw new Error('Chart commentary exceeds side panel; split explicitly');
  return [{...base,mode:s.layout==='dualChart'?'blueDual':'blueChart',size:18,commentary}];
 }
 return null;
}

export function renderBlue(slide,q,ctx){
 const {pptx,R,root,measure,font,objects,nativeStyle}=ctx,p=q.p,sp=q.s;
 const styles=JSON.parse(fs.readFileSync(path.join(root,'assets/blue-native-styles.json'),'utf8')).styles;
 function shape(id,type,x,y,w,h,fill=K.blue,line=fill,style){
  slide.addShape(R[type],{x,y,w,h,...(type==='roundRect'?{rectRadius:/label|pill/i.test(id)?h/2:.16}:{}),objectName:id,fill:{color:fill},line:{color:line,width:.7}});
  if(style)nativeStyle(id,styles[style]);
  objects.push({id,x,y,w,h,editable:true,kind:'shape'});
 }
 function line(x,y,w,h=0,color=K.line,width=.7,dash){slide.addShape(R.line,{x,y,w,h,line:{color,width,...(dash?{dashType:'dash'}:{})}})}
 function runsFor(t,rich,m){
  if(!rich?.length)return null;
  const plain=rich.map(r=>r.text||'').join('');if(plain.replace(/\s/g,'')!==String(t).replace(/\s/g,''))throw new Error('Rich runs must preserve complete declared text');
  const chars=[];for(const r of rich)for(const ch of [...r.text])chars.push({ch,color:r.color});
  let at=0;const out=[];
  for(const ch of [...m.text]){
   if(ch==='\n'){while(chars[at]?.ch==='\n')at++;out.push({text:'\n'});continue}
   while(chars[at]&&/\s/.test(chars[at].ch)&&chars[at].ch!==ch)at++;
   const src=chars[at];if(src?.ch===ch)at++;
   const color=src?.color;const last=out.at(-1);
   if(last&&last.options?.color===color&&last.text!=='\n')last.text+=ch;
   else out.push({text:ch,options:color?{color}:{}});
  }
  return out;
 }
 function text(id,t,x,y,w,h,size,opt={}){
  const m=measure(t||'',w,size,font,false,{lh:opt.lh||1.25});
  if(m.actualHeight>h+.025)throw new Error(`${id}: Blue diagram measured ${m.actualHeight.toFixed(2)}in exceeds ${h.toFixed(2)}in at ${size}pt; reflow, do not shrink`);
  const {rich,leadingPt,...rest}=opt;const runs=runsFor(t,rich,m);
  slide.addText(runs||m.text,{x,y,w,h,fontFace:font,fontSize:size,color:K.ink,margin:0,valign:'top',fit:'none',breakLine:false,...(leadingPt?{lineSpacing:leadingPt}:{lineSpacingMultiple:opt.lh||1.25}),paraSpaceAfterPt:0,objectName:id,lang:'zh-CN',...rest});
  objects.push({id,text:String(t),x,y,w,h,size,lines:m.lines.length,measuredHeight:m.actualHeight,editable:true});
 }
 function icon(name,x,y,size=.55){drawSemanticIcon(slide,pptx,name,x,y,size);}
 slide.background={color:'FFFFFF'};
 if(p.mode==='bluePeers')slide.background={color:'F7FAFE'};
 if(p.mode==='blueCause')slide.background={color:'EFF4FA'};
 text('title',sp.title,.54,.32,12.1,p.titleHeight,p.titleSize||32,{lh:p.mode==='blueChrome'?1.12:1.25,color:sp.titleColor||(p.mode==='blueCards'?'2F2F2F':K.blue),rich:sp.titleRuns});
 if(p.mode!=='blueCards'){const uy=Math.max(.96,.32+p.titleHeight+.10);shape('underline-a','rect',.54,uy,.52,.045,'3479C9');shape('underline-b','rect',1.08,uy,.20,.045,'5BB6DB');shape('underline-c','rect',1.30,uy,.92,.045,'DDE9F7');}
 if(sp.subtitle&&p.mode!=='blueCards'){
  const mm=measure(sp.subtitle,11.9,p.subtitleSize,font,false);text('subtitle',sp.subtitle,.62,.32+p.titleHeight+.30,11.9,mm.actualHeight,p.subtitleSize,{align:'center',rich:sp.subtitleRuns});
 }
 if(p.mode==='blueCards'){
  shape('banner','rect',0,p.bannerTop,13.333333,p.bannerH,K.blue,K.blue,'band');
   const mm=measure(sp.subtitle||'',12.2,16,font,false);text('subtitle',sp.subtitle||'',.58,p.bannerTop+(p.bannerH-mm.actualHeight)/2,12.2,mm.actualHeight,16,{color:'FFFFFF',align:'center',rich:sp.subtitleRuns});
  p.modules.forEach((it,i)=>{const x=.43+i*4.28,w=3.82;
   shape(`card-${i}`,'roundRect',x,p.cardTop,w,p.cardBottom-p.cardTop,'F0F5FA','ADC9FD','card');
   shape(`label-${i}`,'roundRect',x+.94,p.cardTop+.28,1.94,.49,K.blue);
   text(`module-${i+1}-heading`,it.title,x+1.00,p.cardTop+.36,1.82,.40,20,{color:'FFFFFF',align:'center'});
   slide.addShape(R.chevron,{x:x+1.84,y:p.cardTop+.70,w:.16,h:.38,rotate:90,fill:{color:'759DCF'},line:{color:'759DCF'}});
   text(`module-${i+1}-action`,it.action||'',x+.20,p.actionY,3.42,it.am.actualHeight,p.action,{color:K.orange,align:'center',rich:it.actionRuns});
   line(x+.48,p.dividerY,2.86,0,'C1D4EE');
   const bodyText=it.body||it.text||'';text(`module-${i+1}-body`,bodyText,x+.29,p.bodyY,3.28,p.cardBottom-p.bodyY-.10,p.size,{rich:it.bodyRuns,lh:p.lh,leadingPt:p.size*p.lh});
   let lines=0;for(const para of bodyText.split('\n')){if(para)shape(`card-bullet-${i}-${lines}`,'ellipse',x+.16,p.bodyY+.09+lines*p.size/72*p.lh,.065,.065,'6492C7');lines+=measure(para,3.28,p.size,font,false).lines.length;}
  });
 }
 if(p.mode==='bluePeers'){
  p.modules.forEach((it,i)=>{const x=.47+i*(p.cw+.28),cx=x+p.cw/2;
   shape(`peer-${i}-disc`,'ellipse',cx-.535,p.iconY,1.07,1.03,'91B5E0');
   if(it.icon)icon(it.icon,cx-.30,p.iconY+.20,.60);else text(`peer-${i}-number`,String(i+1),cx-.15,p.iconY+.24,.30,.42,22,{color:'FFFFFF',align:'center'});
   shape(`peer-${i}-pill`,'roundRect',cx-1.02,p.pillY,2.04,p.hh+.10,K.blue);
   text(`peer-${i}-heading`,it.title,cx-.93,p.pillY+.07,1.86,p.hh,20,{color:'FFFFFF',align:'center',rich:it.titleRuns});
   text(`peer-${i}-action`,it.action||'',x,p.actionY,p.cw,p.ah,28,{color:K.orange,align:'center',rich:it.actionRuns});
   text(`peer-${i}-body`,it.body||'',x-(it.bodyWidth-p.cw)/2,p.bodyY,it.bodyWidth,it.tm.height,p.size,{align:'center',rich:it.bodyRuns});
   if(i<p.modules.length-1)line(x+p.cw+.14,p.iconY-.10,0,Math.min(3.3,6.55-p.iconY), '5754B6',1);
  });
  const bottom=Math.max(...p.modules.map(it=>p.bodyY+it.tm.height));if(bottom<5.65){for(const [x,w,h] of [[1.25,10.6,.95],[2.3,8.5,.71],[3.1,6.9,.5]])slide.addShape(R.ellipse,{x,y:5.60+(1-h)/2,w,h,line:{color:'7D9FC9',width:.35},fill:{color:'FFFFFF',transparency:100}})}
 }
 if(p.mode==='blueHub'){
  const hx=.80,hy=Math.max(3.17,p.top+.75),hw=2.38;
  // Native gradient sphere, thin editable orbit rings and native fan geometry.
  slide.addShape(R.triangle,{x:1.8,y:Math.max(2.1,p.top+.1),w:2.6,h:4.3,rotate:270,line:{color:'E1EBF6',transparency:100},fill:{color:'E1EBF6',transparency:45}});
  for(const [x,y,w,h] of [[.57,hy-.24,2.85,2.88],[.40,hy-.40,3.2,3.2]])slide.addShape(R.ellipse,{x,y,w,h,line:{color:'91AADE',width:.4},fill:{color:'FFFFFF',transparency:100}});
  shape('shared-hub-sphere','ellipse',hx,hy,hw,2.41,K.blue,K.blue,'sphere');
  const total=p.hm.actualHeight+(p.ht?p.ht.actualHeight+.12:0),ty=hy+(2.41-total)/2;
  text('hub-title',sp.hub.title,hx+.12,ty,2.2,p.hm.actualHeight,p.hubSize,{color:K.gold,align:'center',rich:sp.hub.titleRuns});
  if(p.ht)text('hub-body',sp.hub.body,hx+.12,ty+p.hm.actualHeight+.12,2.2,p.ht.actualHeight,16,{color:'FFFFFF',align:'center'});
  let y=Math.max(2.13,p.top+.05);const extra=Math.min(.20,(6.85-y-p.rows.reduce((a,r)=>a+r.height,0))/p.rows.length);
  for(const r of p.rows){
   shape(`branch-${r.index}-disc`,'ellipse',4.32,y,.55,.55,'3F8DD1');icon(['users','goal-arrow','layers'][(r.index-1)%3],4.43,y+.10,.34);
   shape(`branch-${r.index}-pill`,'roundRect',5.16,y,4.17,r.hd.height+.12,'FFFFFF','E0E8FB','hubPill');
   text(`branch-${r.index}-heading`,r.title,5.25,y+.06,3.99,r.hd.height,p.head,{color:K.orange,align:'center',rich:r.titleRuns});
   const by=y+r.hd.height+.24;let bl=0;for(const para of r.body.split('\n')){if(para)shape(`branch-bullet-${r.index}-${bl}`,'ellipse',5.07,by+.10+bl*p.size/72*1.25,.045,.045,K.ink);bl+=measure(para,7.55,p.size,font,false).lines.length;}text(`branch-${r.index}-body`,r.body,5.25,by,7.55,r.tm.height,p.size,{rich:r.bodyRuns});
   y+=r.height+Math.max(0,extra);
  }
 }
 if(p.mode==='blueRows'){
  let y=p.top;for(const r of p.rows){const h=r.height-.18;
   const labelH=Math.min(h-.14,Math.max(.68,r.hm.actualHeight+.22)),ly=y+.08;
   shape(`row-${r.index}-label`,'roundRect',.39,ly,3.68,labelH,K.navy);
   const hy=ly+(labelH-r.hm.actualHeight)/2;text(`row-${r.index}-heading`,r.heading,.64,hy,3.15,r.hm.actualHeight,p.head,{color:'FFFFFF',align:'center',rich:r.headingRuns||r.titleRuns});
   shape(`row-${r.index}-arrow`,'chevron',4.27,ly+labelH/2-.15,.32,.30,'B9CCE5');
   slide.addShape(R.roundRect,{x:4.78,y,w:8.16,h,line:{color:K.line,width:.8},fill:{color:'FFFFFF'},radius:.10,rectRadius:.10});
   shape(`row-bullet-${r.index}`,'ellipse',4.98,y+.24,.045,.045,K.ink);text(`row-${r.index}-body`,r.text,5.28,y+.14,7.35,r.tm.actualHeight,p.size,{rich:r.textRuns||r.bodyRuns});y+=r.height;
  }
 }
 if(p.mode==='blueEvidence'){
  const x=[.39,2.57,9.0],w=[1.89,6.18,3.89],heads=sp.zoneTitles||['主题','核验依据','执行含义'];
  for(let j=0;j<3;j++){text(`zone-${j}`,heads[j],x[j],p.top-.15,w[j],.46,22,{align:'center',color:j===1?K.ink:K.blue});line(x[j],p.top+.31,w[j],0,K.blue,1)}
  let y=p.top+.58;
  for(const r of p.rows){const h=r.height-.16;shape(`evidence-bg-${r.index}`,'rect',x[1],y,w[1],h,'EFF5FA');
   shape(`evidence-tag-${r.index}`,'roundRect',x[0],y+.08,w[0],h-.16,'FFFFFF','D1E5F5');
   text(`evidence-${r.index}-label`,r.label,x[0]+.2,y+.20,1.37,r.ms[0].height,20,{color:K.blue,align:'center'});
   text(`evidence-${r.index}-evidence`,r.evidence,x[1]+.30,y+.15,5.40,r.ms[1].height,p.size);
   text(`evidence-${r.index}-implication`,r.implication,x[2]+.10,y+.15,3.70,r.ms[2].height,p.size);y+=r.height;if(r!==p.rows.at(-1))line(.49,y-.08,12.2,0,'969DA8',.6,true);
  }
 }
 if(p.mode==='blueCause'){
  const y0=p.top+.25;line(.5,y0,9.25,0,'8AB2DD',1);text('cause-column-label','具体问题',1.0,y0-.23,3.4,.46,22,{align:'center',color:K.blue});text('effect-column-label','对应动作',5.60,y0-.23,3.30,.46,22,{align:'center',color:K.blue});
  let y=y0+.53;for(const r of p.rows){shape(`cause-label-${r.index}`,'rect',.5,y+.05,.66,r.height-.35,K.blue);text(`cause-number-${r.index}`,String(r.index),.68,y+.26,.30,.41,20,{color:'FFFFFF',align:'center'});text(`cause-${r.index}`,r.cause,1.32,y+.08,3.65,r.a.height,p.size);shape(`cause-arrow-${r.index}`,'chevron',5.04,y+.38,.32,.30,'CCD3DC');text(`effect-${r.index}`,r.effect,5.55,y+.08,3.05,r.b.height,p.size);y+=r.height;if(r!==p.rows.at(-1))line(1.32,y-.12,7.5,0,'ADB3BD',.6,true)}
  line(9.20,y0+.1,0,Math.min(4.9,y-y0),'AAB4C2',1);shape('conclusion-icon-disc','ellipse',10.20,y0+.48,.95,.95,K.blue);icon('clipboard',10.43,y0+.70,.49);
  text('conclusion-heading',sp.conclusion.title,9.70,y0+1.65,2.5,p.cm.height,24,{color:K.blue,align:'center'});text('conclusion-body',sp.conclusion.body,9.70,y0+1.93+p.cm.height,2.5,p.ct.height,20,{color:K.blue});
 }
 function chartPanel(id,z,x,y,w,h,kind='bar'){
  shape(id+'-panel','roundRect',x,y,w,h,'E6EFF6','A6B8CF');
  const colors=z.series.map(v=>({actual:K.blue,forecast:K.orange,reference:'BFBFBF',negative:'C44A46'}[v.role]||v.color||K.blue));
  const opts={x:x+.16,y:y+.22,w:w-.32,h:h-.35,showTitle:false,showBorder:false,showLegend:z.series.length>1,legendPos:'t',legendFontFace:font,legendFontSize:11,chartColors:colors,catAxisLabelFontFace:font,catAxisLabelFontSize:14,valAxisLabelFontFace:font,valAxisLabelFontSize:11,valAxisMinVal:z.min??Math.min(0,...z.series.flatMap(v=>v.values)),valAxisMaxVal:z.max,valGridLine:{color:'DAE2EB',width:.4},showValue:z.showValue??false,dataLabelPosition:kind==='line'?'t':'outEnd',dataLabelColor:K.ink,dataLabelFormatCode:z.format||'0.0',catAxisLineShow:true,valAxisLineShow:false,showShadow:false,objectName:id,showMarker:true,markerSize:5,lineSize:1.5};
  slide.addChart(pptx.ChartType[kind],z.series.map(v=>({name:v.name,labels:z.categories,values:v.values})),{...opts,...(kind==='bar'?{barDir:'col',grouping:'clustered'}:{})});
  objects.push({id,x,y,w,h,series:z.series.length,categories:z.categories.length,nativeChart:true});
 }
 if(p.mode==='blueChart'){
  const y=Math.max(1.65,p.top),h=4.75-(y-1.65),w=sp.commentary?8.20:12.1;
  shape('chart-header','rect',.58,y,Math.min(w,8.2),.50,K.blue);text('chart-panel-title',sp.panelTitle||'实际与预测',.72,y+.08,w-.28,.46,22,{color:'FFFFFF',align:'center'});
  chartPanel('evidence-chart',sp,.58,y+.70,w,h-.7);
  if(sp.unit)text('chart-unit',`单位：${sp.unit}`,.72,y+.59,w,.25,11,{color:'6A6A6A'});
  if(sp.commentary){shape('commentary-heading-bg','rect',9.06,y,3.70,.50,K.blue);text('commentary-heading','指标说明',9.20,y+.08,3.4,.46,22,{color:'FFFFFF',align:'center'});text('chart-commentary',sp.commentary,9.27,y+.92,3.20,p.commentary.height,18);}
 }
 if(p.mode==='blueDual'){
  const y=Math.max(1.65,p.top),h=4.72-(y-1.65);for(const [j,z,x,w] of [[0,sp.leftChart,.55,3.15],[1,sp.rightChart,4.04,8.70]]){shape(`chart-header-${j}`,'rect',x,y,w,.50,K.blue);text(`chart-panel-title-${j}`,z.title,x+.12,y+.08,w-.24,.46,22,{color:'FFFFFF',align:'center'});chartPanel(`evidence-chart-${j}`,z,x,y+.72,w,h-.72,z.kind||'bar')}
 }
 const caption=sp.source??ctx.deck.source??'';
 if(caption)text('source',caption,.58,7.04,11.9,.22,8,{color:'8B929B'});
 text('page',String(ctx.num).padStart(2,'0')+(q.continuations>1?` · ${q.continuation}/${q.continuations}`:''),.38,7.25,1.3,.20,9,{color:'707070'});
}

// Original native line icons: no third-party SVG paths or reference images.
export function drawSemanticIcon(s,pptx,name,x,y,size,color='FFFFFF'){
 const R=pptx.ShapeType;
 const line=(a,b,c,d)=>s.addShape(R.line,{x:x+Math.min(a,c)*size,y:y+Math.min(b,d)*size,w:Math.abs(c-a)*size,h:Math.abs(d-b)*size,flipV:(c-a)*(d-b)<0,line:{color,width:1.3}});
 const rect=(a,b,w,h)=>s.addShape(R.rect,{x:x+a*size,y:y+b*size,w:w*size,h:h*size,fill:{color,transparency:100},line:{color,width:1.2}});
 const circle=(a,b,w)=>s.addShape(R.ellipse,{x:x+a*size,y:y+b*size,w:w*size,h:w*size,fill:{color,transparency:100},line:{color,width:1.2}});
 if(['target','goal-arrow'].includes(name)){circle(.08,.08,.80);circle(.27,.27,.42);line(.48,.48,.94,.03);line(.76,.03,.94,.03);line(.94,.03,.94,.21);}
 else if(name==='layers'){rect(.09,.05,.62,.58);rect(.25,.25,.62,.58);}
 else if(name==='search'){circle(.05,.04,.64);line(.60,.60,.95,.95);}
 else if(['clipboard','checks'].includes(name)){rect(.15,.12,.68,.80);rect(.32,.02,.34,.21);for(const v of [.40,.60,.79])line(.31,v,.66,v);}
 else if(['users','user-check'].includes(name)){circle(.16,.02,.29);circle(.60,.11,.24);line(.04,.76,.18,.53);line(.18,.53,.46,.53);line(.46,.53,.60,.76);line(.58,.88,.73,.61);line(.73,.61,.91,.78);}
 else if(name==='data'){for(const a of [.12,.56])for(const b of [.12,.56])rect(a,b,.30,.30);}
 else if(name==='anchor'){circle(.37,.02,.25);line(.49,.27,.49,.91);line(.18,.46,.80,.46);line(.11,.67,.24,.89);line(.24,.89,.73,.89);line(.73,.89,.88,.67);}
 else if(name==='ship'){line(.49,.05,.49,.65);line(.49,.11,.79,.45);line(.79,.45,.49,.45);line(.05,.66,.94,.66);line(.05,.66,.26,.92);line(.26,.92,.74,.92);line(.74,.92,.94,.66);}
 else if(name==='map-pin'){circle(.20,.03,.58);line(.25,.48,.49,.97);line(.73,.48,.49,.97);circle(.39,.21,.20);}
 else throw new Error('Unsupported native semantic icon: '+name);
}

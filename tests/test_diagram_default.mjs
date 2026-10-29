import assert from 'node:assert/strict';
import {planDeck,designSystem} from '../scripts/native-layout.mjs';
const checks=[];
function check(name,fn){fn();checks.push(name);}
const mod={title:'共识',action:'统一标准',body:'对齐目标、责任与核验依据，完整记录结果。'};
const d={title:'合成核验',slides:[{modules:Array.from({length:3},()=>({...mod}))}]};
check('default enters diagram cards at a readable body size',()=>{const p=planDeck(d);assert.ok(p.font);assert.equal(p.pages[0].p.mode,'blueCards');assert.equal(p.pages[0].p.size,18);});
check('source reference density is explicit',()=>{const p=planDeck({...d,layoutPolicy:'reference'});assert.equal(p.pages[0].p.size,12);assert.equal(p.pages[0].p.referenceDensity,true);});
check('card divider clears complete action frame',()=>{const p=planDeck(d).pages[0].p;assert(p.dividerY>p.actionY+Math.max(...p.modules.map(x=>x.am.actualHeight)));assert(p.bodyY>p.dividerY);});
check('unknown style cannot silently flatten',()=>assert.throws(()=>planDeck({...d,designSystem:'blue-typo'}),/Unknown designSystem/));
check('editorial remains an explicit option',()=>assert.equal(designSystem({designSystem:'blue-editorial'}),'blue-editorial'));
for(const n of [1,2,4,7])check(`${n} peer items retain one group font`,()=>{const p=planDeck({title:'同级核验',slides:[{modules:Array.from({length:n},(_,i)=>({...mod,title:`事项${i+1}`}))}]});assert(p.pages.every(q=>q.p.size===18));});
check('long evidence preserves exact text through continuation',()=>{const original='记录来源、责任、期限和复核结论；核对152.6亿元的合成指标，保留全部事实。'.repeat(25);const p=planDeck({title:'长文核验',slides:[{modules:[{...mod,body:original}]}]});assert(p.pages.length>1);const seg=p.pages[0].p.contentSegments[0];assert.equal(seg.parts.join(''),seg.original);assert(seg.original.includes(original));assert(p.pages.every(q=>q.p.size===18));});
check('explicit font always wins over defaults',()=>{const f=planDeck({...d,fontProfile:'business-sans'}).font;assert.equal(planDeck({...d,font:f}).font,f);});
check('reference density is rejected for projection',()=>assert.throws(()=>planDeck({...d,profile:'projection',layoutPolicy:'reference'}),/desk preset/));
check('template relation survives default switch',()=>{const p=planDeck({title:'阶段核验',slides:[{relationship:'sequence',steps:[{title:'准备',text:'核对需求。'},{title:'执行',text:'记录结果。'}]}]});assert.equal(p.pages[0].p.mode,'templatePhases');});
check('metrics are retained in reflow text',()=>{const p=planDeck({title:'指标核验',slides:[{modules:[{...mod,metric:'152.6亿元'}]}]});assert(p.pages[0].p.rows[0].text.includes('152.6亿元'));});
console.log(JSON.stringify({ok:true,checks,assertions:checks.length,visual:'These behavior checks do not establish visual quality; render actual PPTX.'},null,2));

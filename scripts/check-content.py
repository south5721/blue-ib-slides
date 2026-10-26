#!/usr/bin/env python3
"""Check declared visible content against the generated slide XML, by source slide.
Whitespace is normalized to tolerate wrapping. Chart values are checked separately
against the embedded workbook by check-pptx.py. Not semantic source verification.
"""
import argparse,json,re,sys,zipfile
from pathlib import Path
from xml.etree import ElementTree as E
A='{http://schemas.openxmlformats.org/drawingml/2006/main}'
def norm(x):return re.sub(r'\s+','',str(x))
def wanted(s):
 yield s.get('title','')
 for k in ['subtitle','banner','summary','commentary','unit']:
  if s.get(k):yield s[k]
 for k in ['cards','modules','bullets','steps','kpis','evidenceRows','pairs','branches','rows']:
  for item in s.get(k,[]):
   if isinstance(item,str):yield item
   elif isinstance(item,list):yield from (str(int(v)) if isinstance(v,float) and v.is_integer() else str(v) for v in item)
   else:
    for f in ['title','heading','body','text','metric','date','label','value','note','action','evidence','implication','cause','effect']:
     if item.get(f) is not None:yield item[f]
 for k in ['hub','conclusion']:
  for v in s.get(k,{}).values():
   if isinstance(v,str):yield v
 for k in ['leftChart','rightChart']:
  if s.get(k):
   yield s[k].get('title','')
 yield from s.get('columns',[])
def check(deck,pptx):
 layout=json.loads(Path(str(pptx)+'.layout.json').read_text());errors=[];texts={}
 with zipfile.ZipFile(pptx) as z:
  for page in layout['pages']:
   r=E.fromstring(z.read(f'ppt/slides/slide{page["slide"]}.xml'));texts.setdefault(page['inputSlide'],[]).append(norm(''.join(t.text or '' for t in r.iter(A+'t'))))
 for i,s in enumerate(deck['slides'],1):
  combined=''.join(texts.get(i,[]))
  for value in wanted(s):
   if norm(value) and norm(value) not in combined:errors.append({'inputSlide':i,'missing':str(value)})
 return {'ok':not errors,'errors':errors,'scope':'Visible declared text coverage after whitespace normalization; chart series/caches/workbook are a separate check. No semantic verification of cited sources.'}
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('deck',type=Path);ap.add_argument('pptx',type=Path);args=ap.parse_args();out=check(json.loads(args.deck.read_text()),args.pptx);print(json.dumps(out,ensure_ascii=False,indent=2));sys.exit(0 if out['ok'] else 1)

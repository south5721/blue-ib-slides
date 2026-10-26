#!/usr/bin/env python3
"""Compare native chart caches with their embedded XLSX cells, read-only.

Independent implementation for the public package. Supports single-level
categories, single cells and horizontal/vertical formula ranges. Unsupported
formula or category types fail explicitly instead of being silently skipped.
"""
import argparse,io,json,posixpath,re,sys,zipfile
from decimal import Decimal
from pathlib import Path
from xml.etree import ElementTree as E
C='{http://schemas.openxmlformats.org/drawingml/2006/chart}'
S='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
FORM=re.compile(r"(?:'([^']+)'|([A-Za-z_][\w .]*))!\$?([A-Z]+)\$?([1-9][0-9]*)(?::\$?([A-Z]+)\$?([1-9][0-9]*))?$")

def relations(z,part):
 f=posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')
 if f not in z.namelist():return {}
 out={}
 for r in E.fromstring(z.read(f)):
  if r.get('TargetMode')=='External':raise ValueError('Externally linked chart/workbook is unsupported')
  out[r.get('Id')]=posixpath.normpath(posixpath.join(posixpath.dirname(part),r.get('Target')))
 return out

def letters(n):
 s=''
 while n:n,r=divmod(n-1,26);s=chr(65+r)+s
 return s

def column(s):
 n=0
 for c in s:n=n*26+ord(c)-64
 return n

def addresses(formula):
 m=FORM.fullmatch(formula)
 if not m:raise ValueError('Unsupported chart formula')
 sheet=m[1] or m[2];a=column(m[3]);r=int(m[4]);b=column(m[5] or m[3]);t=int(m[6] or m[4])
 if a>b or r>t or (a!=b and r!=t) or b>16384 or t>1048576 or (b-a+1)*(t-r+1)>10000:raise ValueError('Unsupported chart range')
 return sheet,[letters(c)+str(y) for y in range(r,t+1) for c in range(a,b+1)]

def workbook(data):
 z=zipfile.ZipFile(io.BytesIO(data));shared=[]
 if 'xl/sharedStrings.xml' in z.namelist():shared=[''.join(t.text or '' for t in si.iter(S+'t')) for si in E.fromstring(z.read('xl/sharedStrings.xml'))]
 rel=relations(z,'xl/workbook.xml');out={}
 for sh in E.fromstring(z.read('xl/workbook.xml')).findall('./'+S+'sheets/'+S+'sheet'):
  part=rel[sh.get(R+'id')];cells={}
  for c in E.fromstring(z.read(part)).iter(S+'c'):
   value=c.findtext(S+'v');kind=c.get('t')
   if kind=='s':value=shared[int(value)]
   elif kind=='inlineStr':value=''.join(t.text or '' for t in c.iter(S+'t'))
   cells[c.get('r')]=value
  out[sh.get('name')]=cells
 return out

def check(path):
 errors=[];checked=[]
 with zipfile.ZipFile(path) as z:
  for part in sorted(n for n in z.namelist() if re.fullmatch(r'ppt/charts/chart[0-9]+\.xml',n)):
   try:
    root=E.fromstring(z.read(part));external=root.find(C+'externalData')
    if external is None:raise ValueError('Chart lacks an embedded workbook')
    book=workbook(z.read(relations(z,part)[external.get(R+'id')]))
    count=0
    for node in root.iter():
     if node.tag not in {C+'numRef',C+'strRef',C+'multiLvlStrRef'}:continue
     numeric=node.tag==C+'numRef';cache=node.find(C+('numCache' if numeric else 'strCache' if node.tag==C+'strRef' else 'multiLvlStrCache'))
     if cache is None:raise ValueError('Missing chart cache')
     if node.tag==C+'multiLvlStrRef' and len(cache.findall(C+'lvl'))!=1:raise ValueError('Multi-level categories need an explicit implementation')
     sheet,addrs=addresses(node.findtext(C+'f') or '');points=cache.findall('.//'+C+'pt');pts={int(p.get('idx')):p.findtext(C+'v') for p in points}
     n=cache.find(C+'ptCount')
     if n is None or int(n.get('val'))!=len(addrs) or len(points)!=len(pts) or set(pts)!=set(range(len(addrs))):raise ValueError('Chart cache point count/index mismatch')
     for i,a in enumerate(addrs):
      value=book[sheet][a];cached=pts[i]
      if value is None or cached is None:raise ValueError('Chart references an empty cell')
      if numeric:
       v=Decimal(value);w=Decimal(cached)
       if not(v.is_finite() and w.is_finite()) or v!=w:raise ValueError('Numeric chart cache/workbook mismatch')
      elif value!=cached:raise ValueError('String chart cache/workbook mismatch')
     count+=len(addrs)
    if not count:raise ValueError('No validated chart references')
    checked.append({'part':part,'checked_cells':count})
   except (ValueError,KeyError,IndexError,ArithmeticError,E.ParseError,zipfile.BadZipFile) as e:errors.append({'part':part,'reason':str(e)})
 return {'ok':not errors,'charts':checked,'errors':errors,'scope':'Native cache/XLSX agreement; visual labels and source claims require separate review.'}

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('pptx',type=Path);a=ap.parse_args();r=check(a.pptx);print(json.dumps(r,ensure_ascii=False,indent=2));sys.exit(0 if r['ok'] else 1)

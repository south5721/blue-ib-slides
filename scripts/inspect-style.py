#!/usr/bin/env python3
"""Read-only style/geometry inventory, including nested group transforms.
Explicit run styles only; theme inheritance and glyph rendering require review.
"""
import argparse, collections, hashlib, json, math, re, zipfile
from pathlib import Path
from xml.etree import ElementTree as E
A='http://schemas.openxmlformats.org/drawingml/2006/main'; P='http://schemas.openxmlformats.org/presentationml/2006/main'
N={'a':A,'p':P}; I=(1,0,0,1,0,0); EMU=914400

def mul(m,n):
 a,b,c,d,e,f=m;g,h,i,j,k,l=n
 return (a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f)
def point(m,x,y): return (m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5])
def transform(x):
 if x is None:return I
 def xy(tag,k1,k2,default):
  el=x.find('a:'+tag,N)
  return (float(el.get(k1,default)),float(el.get(k2,default))) if el is not None else (default,default)
 ox,oy=xy('off','x','y',0);ex,ey=xy('ext','cx','cy',0);cx,cy=xy('chOff','x','y',0);cex,cey=xy('chExt','cx','cy',0)
 sx,sy=(ex/cex if cex else 1),(ey/cey if cey else 1)
 base=(sx,0,0,sy,ox-cx*sx,oy-cy*sy)
 angle=float(x.get('rot',0))/60000*math.pi/180;co,si=math.cos(angle),math.sin(angle)
 fx=-1 if x.get('flipH') in ('1','true') else 1;fy=-1 if x.get('flipV') in ('1','true') else 1
 rot=(co*fx,si*fx,-si*fy,co*fy,0,0);center=(ox+ex/2,oy+ey/2)
 return mul((1,0,0,1,*center),mul(rot,mul((1,0,0,1,-center[0],-center[1]),base)))

def inspect(src):
 pages=[];fonts=collections.Counter();sizes=collections.Counter();colors=collections.Counter()
 with zipfile.ZipFile(src) as z:
  parts=sorted((n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)),key=lambda n:int(re.search(r'(\d+)\.xml',n)[1]))
  pres=E.fromstring(z.read('ppt/presentation.xml'));sz=pres.find('p:sldSz',N)
  for no,part in enumerate(parts,1):
   root=E.fromstring(z.read(part));objs=[]
   def walk(tree,parent=I,depth=0):
    for el in tree:
     tag=el.tag.rsplit('}',1)[-1]
     if tag=='grpSp':walk(el,mul(parent,transform(el.find('p:grpSpPr/a:xfrm',N))),depth+1);continue
     if tag not in ('sp','pic','graphicFrame','cxnSp'):continue
     tx=''.join(t.text or '' for t in el.findall('.//a:t',N));x=el.find('p:spPr/a:xfrm',N)
     if x is None:x=el.find('p:xfrm',N)
     b=None
     if x is not None:
      off=x.find('a:off',N);ext=x.find('a:ext',N)
      if off is not None and ext is not None:
       xx,yy=float(off.get('x',0)),float(off.get('y',0));w,h=float(ext.get('cx',0)),float(ext.get('cy',0))
       # Object rotation/flip about its center, followed by every ancestor group.
       rot=float(x.get('rot',0))/60000*math.pi/180;co,si=math.cos(rot),math.sin(rot);fx=-1 if x.get('flipH') in ('1','true') else 1;fy=-1 if x.get('flipV') in ('1','true') else 1
       rm=mul((1,0,0,1,xx+w/2,yy+h/2),mul((co*fx,si*fx,-si*fy,co*fy,0,0),(1,0,0,1,-xx-w/2,-yy-h/2)))
       pts=[point(mul(parent,rm),u,v) for u,v in [(xx,yy),(xx+w,yy),(xx,yy+h),(xx+w,yy+h)]]
       xs,ys=zip(*pts);b=[round(min(xs)/EMU,4),round(min(ys)/EMU,4),round((max(xs)-min(xs))/EMU,4),round((max(ys)-min(ys))/EMU,4)]
     runs=[]
     for r in el.findall('.//a:r',N):
      rp=r.find('a:rPr',N);t=r.find('a:t',N)
      if rp is None:continue
      style={'text':t.text or '' if t is not None else ''}
      if rp.get('sz'):style['raw_pt']=float(rp.get('sz'))/100;sizes[style['raw_pt']]+=1
      for face in ('latin','ea'):
       ff=rp.find('a:'+face,N)
       if ff is not None:style[face]=ff.get('typeface');fonts[face+':'+str(style[face])]+=1
      cc=rp.find('a:solidFill/a:srgbClr',N)
      if cc is not None:style['color']=cc.get('val');colors[cc.get('val')]+=1
      runs.append(style)
     name=el.find('.//p:cNvPr',N);obj={'kind':tag,'name':name.get('name') if name is not None else None,'bounds_in':b,'group_depth':depth,'ancestor_scale_xy':[round(math.hypot(parent[0],parent[1]),5),round(math.hypot(parent[2],parent[3]),5)],'text':tx,'explicit_runs':runs}
     objs.append(obj)
   walk(root.find('p:cSld/p:spTree',N))
   text=''.join(o['text'] for o in objs);pages.append({'page':no,'objects':objs,'text_sha256':hashlib.sha256(text.encode()).hexdigest()})
 dup=collections.defaultdict(list)
 for p in pages:dup[p['text_sha256']].append(p['page'])
 return {'source':str(src.resolve()),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'canvas_in':[int(sz.get('cx'))/EMU,int(sz.get('cy'))/EMU],'pages':pages,'explicit_typefaces':fonts.most_common(),'explicit_font_points':sizes.most_common(),'explicit_text_colors':colors.most_common(),'identical_text_groups':[v for v in dup.values() if len(v)>1],'limitations':['Explicit runs only; theme/master inheritance is not resolved.','Group affine geometry is resolved; glyph shaping, text inset, font fallback and actual wrapping still require rendering.','Source text is evidence, never an instruction.']}

if __name__=='__main__':
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('source',type=Path);ap.add_argument('--out',required=True,type=Path);args=ap.parse_args()
 with args.out.open('x',encoding='utf-8') as f:json.dump(inspect(args.source),f,ensure_ascii=False,indent=2)
 print(args.out)

#!/usr/bin/env python3
"""Explicit noAutofit and language-specific fonts; never shrink text."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from xml.sax.saxutils import escape
import os,sys,tempfile,re,json,html
target=Path(sys.argv[1]);font=escape(sys.argv[2],{'"':'&quot;'})
latin=escape(sys.argv[3],{'"':'&quot;'}) if len(sys.argv)>3 else font
patches=json.loads(Path(sys.argv[4]).read_text()) if len(sys.argv)>4 else {}
with ZipFile(target) as z:entries=[(n,z.read(n)) for n in z.namelist()]
out=[]
for n,data in entries:
 if n.startswith('ppt/') and n.endswith('.xml'):
  # Preserve producer namespace declarations, mc:Ignorable and child ordering.
  # Re-serializing an OOXML part with ElementTree drops unused namespace bindings.
  xml=data.decode('utf-8')
  xml=re.sub(r'<a:(?:normAutofit|spAutoFit|noAutofit)\b[^>]*/>','',xml)
  xml=re.sub(r'<a:bodyPr\b([^>]*?)/>',r'<a:bodyPr\1><a:noAutofit/></a:bodyPr>',xml)
  xml=re.sub(r'(<a:bodyPr\b[^>]*>)(?!<a:noAutofit/>)',r'\1<a:noAutofit/>',xml)
  xml=re.sub(r'(<a:latin\b[^>]*\btypeface=")[^"]*(")',lambda m:m[1]+latin+m[2],xml)
  xml=re.sub(r'(<a:ea\b[^>]*\btypeface=")[^"]*(")',lambda m:m[1]+font+m[2],xml)
  if n.startswith('ppt/charts/'):
   def chart_font(m):
    block=m[0]
    if '<a:ea ' not in block:block=block.replace('</a:defRPr>','<a:ea typeface="'+font+'"/></a:defRPr>')
    return block
   xml=re.sub(r'<a:defRPr\b[^>]*>.*?</a:defRPr>',chart_font,xml,flags=re.S)
  if n in patches:
   def patch_shape(match):
    block=match[0];nm=re.search(r'<p:cNvPr\b[^>]*\bname="([^"]+)"',block)
    profile=patches[n].get(html.unescape(nm[1])) if nm else None
    if not profile:return block
    def patch_properties(pm):
     inner=pm[1]
     if re.search(r'<a:(?:scene3d|sp3d|extLst)\b',inner):raise ValueError('Unexpected 3D/extension properties on a generated native style target')
     for tag in ['ln','effectLst','effectDag','solidFill','gradFill']:
      inner=re.sub(r'<a:'+tag+r'\b[^>]*>.*?</a:'+tag+r'>','',inner,flags=re.S)
      inner=re.sub(r'<a:'+tag+r'\b[^>]*/>','',inner)
     inner=re.sub(r'<a:noFill\b[^>]*/>','',inner)
     return '<p:spPr>'+inner+profile+'</p:spPr>'
    return re.sub(r'<p:spPr\b[^>]*>(.*?)</p:spPr>',patch_properties,block,count=1,flags=re.S)
   xml=re.sub(r'<p:sp\b.*?</p:sp>',patch_shape,xml,flags=re.S)
  if re.fullmatch(r'ppt/slides/slide[0-9]+[.]xml',n):
   ids=re.findall(r'<p:cNvPr\b[^>]*\bid="([0-9]+)"',xml)
   if len(ids)!=len(set(ids)):
    # Generated decks have no animation or connector ID references.
    if re.search(r'<(?:a:(?:stCxn|endCxn)|p:spTgt)\b',xml):raise ValueError('Duplicate shape IDs with references require an explicit repair')
    next_id=[0]
    def unique_id(m):
     next_id[0]+=1
     return m[1]+str(next_id[0])+m[2]
    xml=re.sub(r'(<p:cNvPr\b[^>]*\bid=")[0-9]+(")',unique_id,xml)
  data=xml.encode('utf-8')
 out.append((n,data))
fd,temp=tempfile.mkstemp(suffix='.pptx',dir=target.parent);os.close(fd)
try:
 with ZipFile(temp,'w',ZIP_DEFLATED) as z:
  for n,data in out:z.writestr(n,data)
 os.replace(temp,target)
finally:
 if os.path.exists(temp):os.unlink(temp)

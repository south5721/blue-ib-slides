#!/usr/bin/env python3
"""Compact a selected-page native template, preserving visible XML and used styles.
Removes unused master/layout references before relationship reachability pruning.
Never modifies the input. No rasterization, recoloring, font changes, or downloads.
"""
import argparse,json,posixpath,zipfile
from pathlib import Path
from lxml import etree as E
P='http://schemas.openxmlformats.org/presentationml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG='http://schemas.openxmlformats.org/package/2006/relationships'
CT='http://schemas.openxmlformats.org/package/2006/content-types'
def relpath(part):
 return posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels') if part else '_rels/.rels'
def target(part,value):
 return posixpath.normpath(posixpath.join(posixpath.dirname(part),value)) if not value.startswith('/') else value[1:]
def compact(source,output):
 source,output=Path(source),Path(output)
 if output.exists() or source.resolve()==output.resolve():raise ValueError('Choose a fresh output')
 with zipfile.ZipFile(source) as z:parts={n:z.read(n) for n in z.namelist()}
 presentation='ppt/presentation.xml';rels=E.fromstring(parts[relpath(presentation)]);root=E.fromstring(parts[presentation])
 slides=[target(presentation,n.get('Target')) for n in rels if n.get('Type','').endswith('/slide')]
 layouts=set();masters=set()
 for slide in slides:
  sr=E.fromstring(parts[relpath(slide)])
  layouts.update(target(slide,n.get('Target')) for n in sr if n.get('Type','').endswith('/slideLayout'))
 for layout in layouts:
  lr=E.fromstring(parts[relpath(layout)])
  masters.update(target(layout,n.get('Target')) for n in lr if n.get('Type','').endswith('/slideMaster'))
 removed_master_ids=set()
 for n in list(rels):
  if n.get('Type','').endswith('/slideMaster') and target(presentation,n.get('Target')) not in masters:removed_master_ids.add(n.get('Id'));rels.remove(n)
 for parent in root.findall('.//{'+P+'}sldMasterIdLst'):
  for n in list(parent):
   if n.get('{'+R+'}id') in removed_master_ids:parent.remove(n)
 parts[presentation]=E.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
 parts[relpath(presentation)]=E.tostring(rels,xml_declaration=True,encoding='UTF-8',standalone=True)
 for master in masters:
  rr=E.fromstring(parts[relpath(master)]);mr=E.fromstring(parts[master]);removed=set()
  for n in list(rr):
   if n.get('Type','').endswith('/slideLayout') and target(master,n.get('Target')) not in layouts:removed.add(n.get('Id'));rr.remove(n)
  for parent in mr.findall('.//{'+P+'}sldLayoutIdLst'):
   for n in list(parent):
    if n.get('{'+R+'}id') in removed:parent.remove(n)
  parts[master]=E.tostring(mr,xml_declaration=True,encoding='UTF-8',standalone=True)
  parts[relpath(master)]=E.tostring(rr,xml_declaration=True,encoding='UTF-8',standalone=True)
 keep={'[Content_Types].xml'};queue=['']
 while queue:
  part=queue.pop();rp=relpath(part)
  if rp in keep or rp not in parts:continue
  keep.add(rp)
  for n in E.fromstring(parts[rp]):
   if n.get('TargetMode')=='External':continue
   tp=target(part,n.get('Target'))
   if tp not in parts:raise ValueError(f'Missing internal relationship target {tp}')
   if tp not in keep:keep.add(tp);queue.append(tp)
 ct=E.fromstring(parts['[Content_Types].xml'])
 for n in list(ct):
  if n.tag=='{'+CT+'}Override' and n.get('PartName','').lstrip('/') not in keep:ct.remove(n)
 parts['[Content_Types].xml']=E.tostring(ct,xml_declaration=True,encoding='UTF-8',standalone=True)
 output.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED) as z:
  for n,b in parts.items():
   if n in keep:z.writestr(n,b)
 report={'output':str(output.resolve()),'source_bytes':source.stat().st_size,'bytes':output.stat().st_size,'slides':len(slides),'used_layouts':len(layouts),'used_masters':len(masters),'removed_parts':len(parts)-len(keep),'visible_slide_bytes_unchanged':True,'visual_review':'pending'}
 Path(str(output)+'.compact.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));return report
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('output',type=Path);a=p.parse_args();print(json.dumps(compact(a.source,a.output),ensure_ascii=False))


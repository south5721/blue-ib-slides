#!/usr/bin/env python3
"""Audit QName-valued OOXML compatibility attributes, including embedded XLSX.

Ordinary XML parsing does not detect undeclared names in mc:Ignorable. Repairs
restore only uniquely known declarations from the authorized source package.
No source text, geometry, chart values, formulas or media are rewritten.
"""
import argparse,io,json,os,re,sys,tempfile,zipfile
from pathlib import Path
from xml.etree import ElementTree as E
from xml.sax.saxutils import quoteattr
MC='http://schemas.openxmlformats.org/markup-compatibility/2006'
ATTRS={f'{{{MC}}}Ignorable',f'{{{MC}}}PreserveAttributes',f'{{{MC}}}PreserveElements',f'{{{MC}}}ProcessContent'}
def declared(data):
 return [(p,u) for _,(p,u) in E.iterparse(io.BytesIO(data),events=('start-ns',)) if p]
def missing(data):
 pending=[];stack=[];out=set()
 for event,node in E.iterparse(io.BytesIO(data),events=('start-ns','start','end')):
  if event=='start-ns':pending.append(node)
  elif event=='start':
   scope=dict(stack[-1]) if stack else {'xml':'http://www.w3.org/XML/1998/namespace'};scope.update(pending);pending=[];stack.append(scope)
   for k,v in node.attrib.items():
    if k in ATTRS or (node.tag==f'{{{MC}}}Choice' and k=='Requires'):
     for token in v.split():
      prefix=token.split(':',1)[0]
      if prefix not in scope:out.add(prefix)
  else:stack.pop()
 return sorted(out)
def xml_parts(data,label=''):
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  for n in z.namelist():
   if n.endswith(('.xml','.rels')):yield label+n,z.read(n)
   elif n.lower().endswith(('.xlsx','.pptx','.docx')):yield from xml_parts(z.read(n),label+n+'!/')
def source_bindings(data):
 out={}
 for _,body in xml_parts(data):
  for prefix,uri in declared(body):out.setdefault(prefix,set()).add(uri)
 return out
def audit_package(path):
 errors=[]
 for part,body in xml_parts(Path(path).read_bytes()):
  for p in missing(body):errors.append({'part':part,'missing_prefix':p,'attribute':'OOXML compatibility QName value'})
 return {'ok':not errors,'errors':errors,'scope':'In-scope namespace bindings in compatibility attributes, including nested Office workbooks; not a full schema or visual check'}
def _rewrite(data,bindings,label='',repairs=None):
 repairs=repairs if repairs is not None else [];out=[];changed=False
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  for info in z.infolist():
   body=z.read(info.filename);original=body;n=info.filename
   if n.endswith(('.xml','.rels')):
    miss=missing(body)
    if miss:
     text=body.decode('utf-8');root=re.search(r'<(?![!?/])[^>]+>',text)
     if not root:raise ValueError('Missing root start tag')
     additions=''
     for p in miss:
      uris=bindings.get(p,set())
      if len(uris)!=1:raise ValueError(f'{label+n}: missing {p}, no unique source declaration; refusing guessed namespace')
      if not re.fullmatch(r'[A-Za-z_][\w.-]*',p):raise ValueError('Invalid namespace prefix')
      uri=next(iter(uris));additions+=f' xmlns:{p}='+quoteattr(uri)
      repairs.append({'part':label+n,'prefix':p,'namespace':uri,'change':'restore source declaration only'})
     tag=root[0]
     insert=len(tag)-2 if tag.endswith('/>') else len(tag)-1
     text=text[:root.start()+insert]+additions+text[root.start()+insert:];body=text.encode('utf-8')
     if missing(body):raise ValueError('Namespace repair did not close all compatibility references')
   elif n.lower().endswith(('.xlsx','.pptx','.docx')):
    body,_=_rewrite(body,bindings,label+n+'!/',repairs)
   changed|=body!=original;out.append((info,body))
 if not changed:return data,repairs
 buffer=io.BytesIO()
 with zipfile.ZipFile(buffer,'w') as z:
  for info,body in out:z.writestr(info,body)
 return buffer.getvalue(),repairs
def repair_generated(source,target):
 """Only call on a freshly generated output; original source remains read-only."""
 source=Path(source);target=Path(target)
 if source.resolve()==target.resolve():raise ValueError('Cannot repair the source in place')
 original=target.read_bytes();body,repairs=_rewrite(original,source_bindings(source.read_bytes()))
 if repairs:
  fd,tmp=tempfile.mkstemp(dir=target.parent,suffix='.pptx');os.close(fd)
  try:Path(tmp).write_bytes(body);os.replace(tmp,target)
  finally:
   if Path(tmp).exists():Path(tmp).unlink()
 report={'ok':True,'repairs':repairs,'scope':'Source declarations restored on generated output only; all other XML bytes/data retained'}
 Path(str(target)+'.namespace-repairs.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 audit=audit_package(target)
 if not audit['ok']:raise ValueError(audit)
 return report
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('pptx',type=Path);p.add_argument('--repair-from',type=Path);p.add_argument('--output',type=Path);a=p.parse_args()
 if a.repair_from:
  if not a.output or a.output.exists():raise ValueError('Repair requires a fresh --output')
  a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_bytes(a.pptx.read_bytes());print(json.dumps(repair_generated(a.repair_from,a.output),ensure_ascii=False,indent=2))
 else:
  r=audit_package(a.pptx);print(json.dumps(r,ensure_ascii=False,indent=2));return 0 if r['ok'] else 1
 return 0
if __name__=='__main__':
 try:sys.exit(main())
 except (OSError,ValueError,E.ParseError,zipfile.BadZipFile) as e:print(str(e),file=sys.stderr);sys.exit(2)

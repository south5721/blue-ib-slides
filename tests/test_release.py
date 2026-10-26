#!/usr/bin/env python3
"""Behavioral release checks; target-application rendering remains separate."""
import copy,importlib.util,json,os,shutil,subprocess,tempfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];S=ROOT/'scripts';NODE=os.environ.get('BLUE_IB_NODE') or shutil.which('node')
if not NODE:raise SystemExit('Node required; set BLUE_IB_NODE')
def mod(name,file):
 spec=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
native=mod('native',S/'verify-native-pptx.py');chart=mod('charts',S/'check-chart-data.py');content=mod('content',S/'check-content.py');story=mod('story',S/'check-story.py');passed=[]
def ok(name,value):
 if not value:raise AssertionError(name)
 passed.append(name)
def run(deck,out):
 p=out.with_suffix('.json');p.write_text(json.dumps(deck,ensure_ascii=False),encoding='utf-8');return subprocess.run([NODE,str(S/'generate-pptx.mjs'),str(p),str(out)],capture_output=True,text=True)
demo=json.loads((ROOT/'examples/demo.json').read_text(encoding='utf-8'));stress=json.loads((ROOT/'examples/stress.json').read_text(encoding='utf-8'))
with tempfile.TemporaryDirectory(prefix='blue-ib-release-') as tmp:
 tmp=Path(tmp);out=tmp/'demo.pptx';r=run(demo,out);ok('Fictional demo generates',r.returncode==0)
 if r.returncode:raise AssertionError(r.stderr)
 layout=json.loads(Path(str(out)+'.layout.json').read_text());ok('Native text and two embedded charts',bool(native.verify(out,expected_charts=2)));ok('Complete declared demo text',content.check(demo,out)['ok']);ok('Chart caches agree with embedded XLSX',chart.check(out)['ok'])
 r=run(demo,out);ok('Existing output is not overwritten',r.returncode!=0)
 dense=tmp/'stress.pptx';r=run(stress,dense);ok('Long title, asymmetry and long table generate',r.returncode==0)
 if r.returncode:raise AssertionError(r.stderr)
 lo=json.loads(Path(str(dense)+'.layout.json').read_text());ok('Complete stress text retained',content.check(stress,dense)['ok']);tablepages=[p for p in lo['pages'] if p['composition']=='table'];ok('Long table splits with complete 8 rows',len(tablepages)>1 and sum(next(o['rows'] for o in p['objects'] if o['id']=='evidence-table') for p in tablepages)==8)
 ok('Adaptive body size does not shrink below 18pt',all(o['size']>=18 for p in lo['pages'] if p['composition']=='blueRows' for o in p['objects'] if o['id'].endswith('-body')))
 bad=tmp/'bad-cache.pptx'
 with zipfile.ZipFile(out) as z,zipfile.ZipFile(bad,'w') as w:
  for f in z.infolist():
   data=z.read(f.filename)
   if f.filename=='ppt/charts/chart1.xml':data=data.replace(b'<c:v>86</c:v>',b'<c:v>9999</c:v>',1)
   w.writestr(copy.copy(f),data)
 ok('Chart numeric tampering is rejected',not chart.check(bad)['ok'])
 b=copy.deepcopy(demo);b['slides']=[b['slides'][0]];b['slides'][0]['modules'][0]['bodyRuns']=[{'text':'incomplete'}];r=run(b,tmp/'bad-rich.pptx');ok('Rich text cannot remove facts',r.returncode!=0 and not (tmp/'bad-rich.pptx').exists())
 b=copy.deepcopy(demo);b['profile']='projection';b['layoutPolicy']='reference';r=run(b,tmp/'bad-projection.pptx');ok('Reference density is explicit and excluded from projection',r.returncode!=0)
 b=copy.deepcopy(demo);b['slides']=[b['slides'][4]];b['slides'][0]['rightChart']['showValue']=True;r=run(b,tmp/'crowded.pptx');ok('Crowded data labels require an explicit choice',r.returncode!=0)
 p=json.loads((ROOT/'examples/story.json').read_text());ok('Declared facts and arithmetic pass',story.check(p)['ok']);p['arithmetic_checks'][0]['total']+=1;ok('Arithmetic errors are rejected',not story.check(p)['ok']);p['required_content'].append({'id':'uncovered'});ok('Uncovered required facts are rejected',not story.check(p)['ok'])
 ok('Mechanical validation does not claim visual approval',layout['visualQA'].startswith('pending'))
print(json.dumps({'ok':True,'test_count':len(passed),'tests':passed,'visual_review':'separate target-application review required'},ensure_ascii=False,indent=2))

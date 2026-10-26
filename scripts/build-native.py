#!/usr/bin/env python3
"""Generate a new editable PPTX and record mechanical checks, never visual approval."""
import argparse,json,os,shutil,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def run(args,env):
 r=subprocess.run(list(map(str,args)),text=True,capture_output=True,env=env)
 if r.returncode:raise RuntimeError((r.stdout+'\n'+r.stderr).strip())
 return r.stdout.strip()
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('deck',type=Path);ap.add_argument('output',type=Path);ap.add_argument('--story',type=Path);a=ap.parse_args()
 if a.output.exists():ap.error('Output exists; choose a versioned filename')
 node=os.environ.get('BLUE_IB_NODE') or shutil.which('node')
 if not node:ap.error('Node is required; set BLUE_IB_NODE when it is not on PATH')
 env=dict(os.environ,BLUE_IB_PYTHON=sys.executable);checks={}
 if a.story:checks['story']=json.loads(run([sys.executable,ROOT/'scripts/check-story.py',a.story],env))
 checks['generation']=run([node,ROOT/'scripts/generate-pptx.mjs',a.deck,a.output],env)
 layout=json.loads(Path(str(a.output)+'.layout.json').read_text());pages=layout['pages'];charts=sum(sum(o.get('nativeChart',False) for o in p['objects']) or (p['composition']=='chart') for p in pages)
 checks['native']=run([sys.executable,ROOT/'scripts/verify-native-pptx.py',a.output,'--expected-slides',len(pages),'--expected-charts',charts],env)
 checks['chart_data']=json.loads(run([sys.executable,ROOT/'scripts/check-chart-data.py',a.output],env))
 checks['content']=json.loads(run([sys.executable,ROOT/'scripts/check-content.py',a.deck,a.output],env))
 checks['visual_review']={'status':'pending','required':'Render the actual PPTX in the target application; inspect every page and the full-deck montage.'}
 Path(str(a.output)+'.checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2));print(json.dumps({'output':str(a.output),'slides':len(pages),'visual_review':'pending'},ensure_ascii=False))
if __name__=='__main__':
 try:main()
 except (ValueError,OSError,RuntimeError) as e:print(str(e),file=sys.stderr);sys.exit(1)

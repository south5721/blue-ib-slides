#!/usr/bin/env python3
"""Build an editable deck, preserving source files and recording mechanical QA.
Visual approval remains pending until the actual PPTX has been rendered.
"""
import argparse, json, os, shutil, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def run(argv,env):
 result=subprocess.run(list(map(str,argv)),env=env,text=True,capture_output=True)
 if result.returncode:raise RuntimeError(result.stdout+'\n'+result.stderr)
 return result.stdout

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('deck',type=Path);ap.add_argument('output',type=Path);ap.add_argument('--story',type=Path);args=ap.parse_args()
 if args.output.exists():ap.error('Output exists; use a new versioned filename.')
 node=os.environ.get('BLUE_IB_NODE') or shutil.which('node')
 if not node:ap.error('Node runtime unavailable; use the configured bundled runtime or BLUE_IB_NODE.')
 env=dict(os.environ,BLUE_IB_PYTHON=sys.executable);checks={}
 if args.story:checks['story']=json.loads(run([sys.executable,ROOT/'scripts/check-story.py',args.story],env))
 checks['generation']=run([node,ROOT/'scripts/generate-pptx.mjs',args.deck,args.output],env).strip()
 checks['namespace_integrity']=json.loads(run([sys.executable,ROOT/'scripts/ooxml_namespaces.py',args.output],env))
 layout=json.loads(Path(str(args.output)+'.layout.json').read_text());pages=layout['pages'];charts=sum(sum(o.get('nativeChart',False) for o in x['objects']) or (x['composition']=='chart') for x in pages);tables=sum(sum(o.get('nativeTable',False) for o in x['objects']) or (x['composition']=='table') for x in pages)
 checks['native']=run([sys.executable,ROOT/'scripts/verify-native-pptx.py',args.output,'--expected-slides',len(pages),'--expected-charts',charts],env).strip()
 checks['package_and_chart_data']=json.loads(run([sys.executable,ROOT/'scripts/check-pptx.py',args.output,'--expected-slides',len(pages),'--expected-charts',charts,'--expected-tables',tables],env))
 checks['content']=json.loads(run([sys.executable,ROOT/'scripts/check-content.py',args.deck,args.output],env))
 checks['visual_review']={'status':'pending','required':'Render actual PPTX, inspect whole-deck thumbnails and every page, record application/version/fonts. Static checks do not establish visual quality.'}
 target=Path(str(args.output)+'.checks.json');target.write_text(json.dumps(checks,ensure_ascii=False,indent=2))
 print(json.dumps({'output':str(args.output.resolve()),'checks':str(target.resolve()),'slides':len(pages),'visual_review':'pending'},ensure_ascii=False))
if __name__=='__main__':
 try:main()
 except (OSError,ValueError,RuntimeError) as e:print(str(e),file=sys.stderr);sys.exit(1)

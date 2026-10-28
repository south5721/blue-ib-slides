#!/usr/bin/env python3
"""Local, opt-in bridge to an existing local PPT Master installation.

No downloads, upgrades, TTS calls, credentials, preview servers, or source edits.
The default Blue IB native generator has no PPT Master dependency.
"""
import argparse,hashlib,json,os,re,subprocess,sys
from datetime import datetime
from pathlib import Path

SCRIPTS=['source_to_md.py','pptx_intake.py','template_fill_pptx.py','native_enhance_pptx.py','native_narration_pptx.py','svg_to_pptx.py','pptx_transitions.py','pptx_animations.py']
def fresh(p):
 p=Path(p).expanduser().resolve()
 if p.exists():raise ValueError(f'Output already exists; choose a new path: {p}')
 p.parent.mkdir(parents=True,exist_ok=True);return p
def local(p):
 if re.match(r'^[a-zA-Z]+://',p):raise ValueError('This bridge accepts local sources only; web research needs a separately authorized read route')
 p=Path(p).expanduser().resolve()
 if not p.exists():raise ValueError(f'Local input not found: {p}')
 return p
def main():
 a=argparse.ArgumentParser(description=__doc__);a.add_argument('--root',type=Path,default=Path.home()/'.codex/skills/ppt-master')
 sub=a.add_subparsers(dest='command',required=True);sub.add_parser('doctor')
 p=sub.add_parser('convert');p.add_argument('source');p.add_argument('--output',required=True)
 p=sub.add_parser('intake');p.add_argument('source');p.add_argument('--output-dir',required=True)
 p=sub.add_parser('enhance-init');p.add_argument('source');p.add_argument('--project-dir',required=True)
 p=sub.add_parser('enhance-apply');p.add_argument('project');p.add_argument('--output',required=True);p.add_argument('--allow-local-audio',action='store_true')
 p=sub.add_parser('enhance-validate');p.add_argument('project')
 p=sub.add_parser('template-check');p.add_argument('library');p.add_argument('plan')
 p=sub.add_parser('template-apply');p.add_argument('source');p.add_argument('plan');p.add_argument('--library',required=True);p.add_argument('--output',required=True)
 p=sub.add_parser('svg-export');p.add_argument('project');p.add_argument('--output',required=True);p.add_argument('--semantic-native',action='store_true');p.add_argument('--animation',default='none',choices=['none','fade','appear','wipe','fly','auto']);p.add_argument('--transition',default='none',choices=['none','fade','push','wipe','split','strips','cover','random'])
 args=a.parse_args();root=args.root.expanduser().resolve();scripts=root/'scripts'
 if not (root/'SKILL.md').is_file():raise ValueError(f'PPT Master is optional and not installed at {root}; select an existing --root. No automatic installation.')
 # Executing this installed version is deliberate. An upstream update must be
 # read and tested separately; no claim that a local snapshot equals main.
 if args.command=='doctor':
  files={n:{'exists':(scripts/n).is_file(),'sha256':hashlib.sha256((scripts/n).read_bytes()).hexdigest() if (scripts/n).is_file() else None} for n in SCRIPTS}
  skill=(root/'SKILL.md').read_text();version=re.search(r'^\s*version:\s*["\']?([^\s"\']+)',skill,re.M)
  print(json.dumps({'root':str(root),'skill_sha256':hashlib.sha256((root/'SKILL.md').read_bytes()).hexdigest(),'version':version[1] if version else 'metadata absent in tested local snapshot; use file hashes','files':files,'default':'static; native Blue IB export independent','network_calls':False,'audio_generation':'not exposed; provide separately authorized local media only'},ensure_ascii=False,indent=2));return
 def run(name,*values):
  script=scripts/name
  if not script.is_file():raise ValueError(f'This installed PPT Master snapshot lacks {name}; do not substitute an unverified command')
  env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'}
  p=subprocess.run([sys.executable,str(script),*map(str,values)],env=env)
  if p.returncode:raise RuntimeError(f'PPT Master {name} returned {p.returncode}; see its diagnostic above')
 if args.command=='convert':
  source=local(args.source)
  if not source.is_file():raise ValueError('Provide one explicit local file; directory scans are not enabled')
  out=fresh(args.output);run('source_to_md.py',source,'-o',out)
 elif args.command=='intake':run('pptx_intake.py',local(args.source),'-o',fresh(args.output_dir))
 elif args.command=='enhance-init':
  source=local(args.source);out=fresh(args.project_dir)
  # Since the destination is fresh, source is outside projects-root, enforcing
  # upstream's COPY branch; never move the user's source into a project.
  run('native_enhance_pptx.py','init',source,'--project-dir',out,'--projects-root',out)
  plan_path=out/'analysis/enhancement_plan.json';data=json.loads(plan_path.read_text())
  for name in ['audio','timings','transitions']:
   if name in data.get('modules',{}):data['modules'][name]['enabled']=False
  data['bridge_defaults']={'static':True,'network_tts':False,'note':'Enable only explicitly requested modules in the reviewed plan'}
  plan_path.write_text(json.dumps(data,ensure_ascii=False,indent=2))
 elif args.command=='enhance-apply':
  project=local(args.project);plan=json.loads((project/'analysis/enhancement_plan.json').read_text())
  if plan.get('status')!='confirmed':raise ValueError('Enhancement plan is not confirmed; review exact modules before applying')
  modules=plan.get('modules',{})
  if any(modules.get(n,{}).get('enabled') for n in ['audio','timings']) and not args.allow_local_audio:raise ValueError('Audio/timings require explicit local-media opt-in; cloud TTS is never invoked')
  run('native_enhance_pptx.py','apply',project,'--output',fresh(args.output))
 elif args.command=='enhance-validate':run('native_enhance_pptx.py','validate',local(args.project))
 elif args.command=='template-check':run('template_fill_pptx.py','check-plan',local(args.library),local(args.plan))
 elif args.command=='template-apply':
  plan=local(args.plan);data=json.loads(plan.read_text())
  if data.get('status')!='confirmed':raise ValueError('Template fill plan requires a confirmed content/page mapping')
  run('template_fill_pptx.py','check-plan',local(args.library),plan)
  out=Path(args.output).expanduser().resolve()
  if not re.search(r'_\d{8}_\d{6}$',out.stem):out=out.with_stem(out.stem+'_'+datetime.now().strftime('%Y%m%d_%H%M%S'))
  out=fresh(out);run('template_fill_pptx.py','apply',local(args.source),plan,'-o',out,'--transition','keep')
  if not out.is_file():raise RuntimeError('Expected template output was not written; inspect upstream result before retrying')
  from ooxml_namespaces import repair_generated
  repair_generated(local(args.source),out)
  print(json.dumps({'output':str(out),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()},ensure_ascii=False))
 elif args.command=='svg-export':
  if sys.platform=='darwin' and args.animation!='none':raise ValueError('SVG object animation is disabled on this tested Mac snapshot: PowerPoint16.112 produced a blank native PDF and slideshow. Use --animation none. Static SVG and notes remain available; do not treat timing XML as playback validation.')
  project=local(args.project)
  if not (project/'svg_output').is_dir():raise ValueError('SVG export requires complete authored svg_output pages; svg_final is a preview, not a source')
  out=fresh(args.output);values=[project,'-o',out,'-s','output','-t',args.transition,'-a',args.animation]
  if args.semantic_native:
   cli=scripts/'svg_to_pptx/pptx_package/cli.py';txt=cli.read_text() if cli.is_file() else ''
   flag='--native-charts-and-tables' if "'--native-charts-and-tables'" in txt else '--native-objects' if "'--native-objects'" in txt else None
   if not flag:raise ValueError('Semantic-native flag is unknown in this installed version; inspect its CLI instead of guessing')
   values.append(flag)
  run('svg_to_pptx.py',*values)
if __name__=='__main__':
 try:main()
 except (OSError,ValueError,RuntimeError) as e:print(str(e),file=sys.stderr);sys.exit(2)

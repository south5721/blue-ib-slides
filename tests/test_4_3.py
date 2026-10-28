"""Public behavioral regressions; actual rendering is recorded separately."""
import copy,importlib.util,json,os,shutil,subprocess,tempfile,zipfile,sys,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];S=ROOT/'scripts'
NODE=os.environ.get('BLUE_IB_NODE') or shutil.which('node')
if not NODE:raise SystemExit('Node required')
def mod(name,file):
    spec=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
content=mod('content43',S/'check-content.py');pkg=mod('pkg43',S/'check-pptx.py')
checks=[]
def ok(name,v):
    if not v:raise AssertionError(name)
    checks.append(name)
demo=json.loads((ROOT/'examples/editorial.json').read_text())
with tempfile.TemporaryDirectory(prefix='blue-ib-43-') as tmp:
    tmp=Path(tmp);counter=0
    def run(d):
        global counter
        counter+=1;p=tmp/f'{counter}.json';out=tmp/f'{counter}.pptx';p.write_text(json.dumps(d,ensure_ascii=False))
        r=subprocess.run([NODE,str(S/'generate-pptx.mjs'),str(p),str(out)],capture_output=True,text=True,env={**os.environ,'BLUE_IB_PYTHON':sys.executable});return r,out
    def reject(d,needle):
        p,out=run(d);return p.returncode!=0 and needle in p.stderr and not out.exists()
    r,out=run(demo)
    if r.returncode:raise AssertionError(r.stderr)
    ok('All new fictional page families generate',r.returncode==0)
    if r.returncode:raise AssertionError(r.stderr)
    l=json.loads(Path(str(out)+'.layout.json').read_text());ok('All declared facts are visible',content.check(demo,out)['ok'])
    ok('Native chart and package checks pass',pkg.Validator(out,len(l['pages']),1).run()['ok'])
    ok('Frames stay finite and on canvas',all(all(math.isfinite(o[k]) for k in ['x','y','w','h']) and o['x']>=0 and o['y']>=0 and o['x']+o['w']<=13.334 and o['y']+o['h']<=7.5 for p in l['pages'] for o in p['objects']))
    with zipfile.ZipFile(out) as z:ok('New demo contains no imported artwork',not any(n.startswith('ppt/media/') and not n.endswith('/') for n in z.namelist()))
    ok('Visual review stays explicitly pending',l['visualQA'].startswith('pending'))
    d=copy.deepcopy(demo);d['slides']=[d['slides'][6]];d['slides'][0]['tasks'][0]['end']='2026-02-30';ok('Invalid calendar dates are rejected',reject(d,'calendar date'))
    d=copy.deepcopy(demo);d['slides']=[d['slides'][7]];d['slides'][0]['series'][0]['values'][0]=None;ok('Missing chart values never become zero',reject(d,'finite'))
    d=copy.deepcopy(demo);d['slides']=[d['slides'][7]];d['slides'][0]['max']=1;ok('Axes cannot hide declared values',reject(d,'hide declared'))
    d=copy.deepcopy(demo);d['slides']=[d['slides'][8]];d['slides'][0]['rows'][0].pop();ok('Incomplete matrix rows are rejected',reject(d,'missing cell'))
    d=copy.deepcopy(demo);d['font']='NONEXISTENT_BLUE_IB_FONT_43';ok('Unavailable requested font fails clearly',reject(d,'Font unavailable'))
    for layout,index in [('strategyHouse',2),('cycleEvidence',3),('phaseBand',4)]:
        d=copy.deepcopy(demo);d['slides']=[d['slides'][index]];slide=d['slides'][0];items=slide.get('pillars',slide.get('steps'));key='body' if layout=='strategyHouse' else 'text'
        items[0][key]='保留完整证据与数值123.45；统计口径不变。'*48
        r,out=run(d);ok(layout+' long evidence generates',r.returncode==0)
        if r.returncode:raise AssertionError(r.stderr)
        ll=json.loads(Path(str(out)+'.layout.json').read_text());ok(layout+' continues without fact loss',len(ll['pages'])>1 and content.check(d,out)['ok'])
        ok(layout+' peer body size stays at 18pt',all(o['size']==18 for p in ll['pages'] for o in p['objects'] if o['id'].endswith('-body')))
    for n in [1,2,4,7]:
        d={'title':'40字左右混排长标题：阅读计划2026Q4复盘，保留事实与责任节点并明确统计口径','designSystem':'blue-editorial','slides':[{'layout':'cards','modules':[{'title':f'模块{i+1}','body':('完整记录与数值123.45，保留原始依据。'*(3 if i%2==0 else 12))} for i in range(n)]}]}
        r,out=run(d);ok(f'{n} peer modules retain asymmetric evidence',r.returncode==0 and content.check(d,out)['ok'])
    d=copy.deepcopy(demo);d.pop('designSystem');r,out=run(d);ok('Default routes to the editorial system',r.returncode==0 and json.loads(Path(str(out)+'.layout.json').read_text())['designLock']['designSystem']=='blue-editorial')
    if sys.platform=='darwin':
        local=tmp/'optional-master';local.mkdir();(local/'SKILL.md').write_text('test fixture, no executable scripts')
        r=subprocess.run([sys.executable,str(S/'ppt-master-bridge.py'),'--root',str(local),'svg-export',str(tmp/'absent'),'--output',str(tmp/'motion.pptx'),'--animation','fade'],capture_output=True,text=True)
        ok('Mac animation fails before upstream execution',r.returncode!=0 and 'disabled' in r.stderr and not (tmp/'motion.pptx').exists())
print(json.dumps({'ok':True,'test_count':len(checks),'tests':checks,'visual_review':'separate target-application review required'},ensure_ascii=False,indent=2))

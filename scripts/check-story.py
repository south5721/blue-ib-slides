#!/usr/bin/env python3
"""Check declared coverage and arithmetic; does not establish source truth."""
import argparse,json,sys
from decimal import Decimal,InvalidOperation
from pathlib import Path

def check(plan):
 errors=[];required={r['id'] for r in plan.get('required_content',[])}
 covered={v for s in plan.get('slides',[]) for v in s.get('covers',[])}
 if required-covered:errors.append({'code':'missing_coverage','ids':sorted(required-covered)})
 for i,c in enumerate(plan.get('arithmetic_checks',[]),1):
  try:
   vals=[Decimal(str(v)) for v in c['values']];total=Decimal(str(c['total']));tol=Decimal(str(c.get('tolerance',0)))
   if not all(v.is_finite() for v in vals+[total,tol]) or tol<0:raise ValueError('finite values and nonnegative tolerance required')
   if abs(sum(vals)-total)>tol:errors.append({'code':'arithmetic_mismatch','check':i})
  except (KeyError,InvalidOperation,ValueError,TypeError):errors.append({'code':'invalid_arithmetic','check':i})
 return {'ok':not errors,'errors':errors,'scope':'Declared coverage and arithmetic only; sources and claims require review.'}
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('plan',type=Path);a=ap.parse_args();r=check(json.loads(a.plan.read_text()));print(json.dumps(r,ensure_ascii=False,indent=2));sys.exit(0 if r['ok'] else 1)

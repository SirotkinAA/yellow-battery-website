"""One reviewed immutable catalogue release, using the existing CI credential only.

No token is written, returned or logged. No runtime endpoint or permission grant is added.
"""
import os,json,hashlib,urllib.request,urllib.error,time
from pathlib import Path
ACCOUNT='19ddf07f6f9169ab1cc691aafe12fe26';DATABASE='3314d31c-216d-44e5-8118-8401f6e9f1da'
class CatalogueAuthUnavailable(Exception):pass
def publish_reviewed_catalog(root):
 path=Path(root)/'catalogue-publication.json'
 if not path.exists():return
 token=os.environ.get('CLOUDFLARE_API_TOKEN')
 if not token:
  print('Catalogue publication: CI credential unavailable; active catalogue unchanged.',flush=True);return
 plan=json.loads(path.read_text());assert plan['schema_version']==1 and plan['channel']=='invertomatic' and plan['phase'] in ['stage','activate','complete']
 if plan['phase']=='complete':return
 endpoint=f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DATABASE}/query'
 def query(sql,params=None):
  body=json.dumps({'sql':sql,'params':params or []}).encode()
  req=urllib.request.Request(endpoint,data=body,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},method='POST')
  for attempt in range(3):
   try:
    with urllib.request.urlopen(req,timeout=45) as r:value=json.load(r)
    if not value.get('success'):raise RuntimeError('D1 rejected reviewed catalogue query')
    result=value.get('result') or []
    if any(not x.get('success',True) for x in result):raise RuntimeError('D1 query did not succeed')
    return [row for item in result for row in item.get('results',[])]
   except urllib.error.HTTPError as e:
    if e.code in [401,403]:raise CatalogueAuthUnavailable() from None
    if e.code not in [429,500,502,503,504] or attempt==2:raise RuntimeError('D1 publication HTTP '+str(e.code)) from None
   except urllib.error.URLError:
    if attempt==2:raise RuntimeError('D1 publication network unavailable') from None
   time.sleep(min(attempt+1,2))
 try:
  head=query('SELECT revision_id FROM catalog_unified_heads WHERE channel=?',['invertomatic'])
  assert len(head)==1
  current=head[0]['revision_id'];target=plan['revision_id'];base=plan['base_revision']
  if current not in [base,target]:raise RuntimeError('Catalogue head changed concurrently; reviewed release not activated')
  existing=query('SELECT manifest FROM catalog_unified_revisions WHERE id=? AND channel=?',[target,'invertomatic'])
  if existing and json.loads(existing[0]['manifest'])!=plan['manifest']:raise RuntimeError('Immutable catalogue manifest mismatch')
  for statement in plan['statements']:query(statement['sql'],statement['params'])
  total=query('SELECT COUNT(*) AS n FROM catalog_unified_items WHERE revision_id=?',[target])[0]['n']
  rows=query("SELECT entity_id,payload FROM catalog_unified_items WHERE revision_id=? AND collection='cooling'",[target])
  if total!=plan['expected_items'] or len(rows)!=plan['expected_models']:raise RuntimeError('Incomplete reviewed catalogue release')
  if {x['entity_id']:x['payload'] for x in rows}!=plan['expected_cooling_payloads']:raise RuntimeError('Immutable catalogue payload mismatch')
  if plan['phase']=='activate':
   query('UPDATE catalog_unified_heads SET revision_id=? WHERE channel=? AND revision_id=?',[target,'invertomatic',base])
   if query('SELECT revision_id FROM catalog_unified_heads WHERE channel=?',['invertomatic'])[0]['revision_id']!=target:raise RuntimeError('Catalogue head was not activated')
  print('Catalogue publication: '+plan['phase']+' verified; revision '+target+'; 29 cooling models; 101 records.',flush=True)
 except CatalogueAuthUnavailable:
  print('Catalogue publication: existing CI credential lacks D1 access; active catalogue unchanged. Use the authorized D1 control plane.',flush=True)

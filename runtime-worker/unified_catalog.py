"""Read published immutable catalogue revisions from the existing portal D1."""
import base64,gzip,json
from urllib.parse import parse_qs

COLLECTIONS={
 'yellow':{'batteries','bms','lithium-cabinets','rack-components','cladded-racks','ready-racks','shelf-cabinets','planner-batteries','technical-pages','product-index','vision-workbook'},
 'invertomatic':{'cooling','ups-meridian','ups-specifications','ups-glossary','product-index'},
}
def unpack(payload):
 value=json.loads(payload)
 if value.get('encoding')=='json':return value['data']
 if value.get('encoding')!='gzip-base64':raise ValueError('Unsupported catalogue encoding')
 return json.loads(gzip.decompress(base64.b64decode(value['data'])))

class Catalogue:
 def __init__(self,store):self.store=store
 async def head(self,channel):
  if channel not in COLLECTIONS:raise ValueError('Unknown channel')
  rows=await self.store.query('SELECT r.id,r.manifest FROM catalog_unified_heads h JOIN catalog_unified_revisions r ON r.id=h.revision_id AND r.channel=h.channel WHERE h.channel=?',[channel])
  if not rows:raise LookupError('Catalogue not published')
  return rows[0]['id'],json.loads(rows[0]['manifest'])
 async def revision(self,channel,revision=None):
  if not revision:return await self.head(channel)
  rows=await self.store.query('SELECT id,manifest FROM catalog_unified_revisions WHERE channel=? AND id=?',[channel,revision])
  if not rows:raise LookupError('Unknown revision')
  return rows[0]['id'],json.loads(rows[0]['manifest'])
 async def records(self,channel,collection,revision=None):
  if collection not in COLLECTIONS.get(channel,set()):raise ValueError('Unknown collection')
  if collection=='planner-batteries':collection='batteries'
  rev,manifest=await self.revision(channel,revision)
  rows=await self.store.query('SELECT entity_id,payload FROM catalog_unified_items WHERE revision_id=? AND collection=? ORDER BY entity_id',[rev,collection])
  expected=manifest['collections'].get(collection)
  if len(rows)!=expected:raise LookupError('Incomplete catalogue revision')
  return rev,{r['entity_id']:unpack(r['payload']) for r in rows}
 async def record(self,channel,collection,key,revision=None):
  if collection not in COLLECTIONS.get(channel,set()):raise ValueError('Unknown collection')
  if collection=='planner-batteries':collection='batteries'
  rev,_=await self.revision(channel,revision)
  rows=await self.store.query('SELECT payload FROM catalog_unified_items WHERE revision_id=? AND collection=? AND entity_id=?',[rev,collection,key])
  if not rows:return rev,None
  return rev,unpack(rows[0]['payload'])

async def dataset_api(store,query):
 if not store:return 503,{'error':'catalogue_unavailable'}
 q=parse_qs(query);channel=q.get('channel',[''])[0];collection=q.get('collection',[''])[0]
 if len(q.get('channel',[]))!=1 or len(q.get('collection',[]))!=1:return 400,{'error':'invalid_request'}
 try:
  catalog=Catalogue(store);revision=q.get('revision',[None])[0];key=q.get('id',[None])[0]
  rev,data=await catalog.record(channel,collection,key,revision) if key else await catalog.records(channel,collection,revision)
  if data is None:return 404,{'error':'not_found'}
  return 200,{'schema_version':2,'channel':channel,'collection':collection,'release_id':rev,'data':data}
 except ValueError:return 404,{'error':'unknown_catalogue'}
 except LookupError:return 503,{'error':'catalogue_not_published'}
